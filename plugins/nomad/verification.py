"""Верификация ответов модели по следам инструментов (A1 / M-116).

Модуль реализует:
1. Регистрацию auxiliary-задачи ``nomad_verification_judge`` через
   ``ctx.register_auxiliary_task(...)`` (наследует маршрут от ``compression``).
2. Накопление следов вызовов инструментов через хук ``post_tool_call``.
3. Проверку финального ответа модели в ``transform_llm_output`` (детерминированный
   аудитор несоответствий след↔ответ + подключаемый LLM-судья) и не более одного
   прохода ревизии (1-pass revision) строго в бюджете
   ``judge_timeout + revision_timeout < plugins.hook_callback_timeout``.
"""

from __future__ import annotations

import concurrent.futures
import logging
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from . import core_adapter

logger = logging.getLogger("nomad.verification")

AUX_TASK_KEY = "nomad_verification_judge"
AUX_TASK_DISPLAY_NAME = "Nomad Verification Judge"
AUX_TASK_DESCRIPTION = (
    "Проверка фактических утверждений ответа модели по следам вызовов инструментов (A1)"
)
AUX_TASK_INHERIT_FROM = "compression"
MAX_REVISION_PASSES = 1
DEFAULT_HOOK_CALLBACK_TIMEOUT = 30.0
MAX_TRACE_RESULT_CHARS = 4000


@dataclass(frozen=True)
class VerificationBudget:
    """Бюджет времени на оценку судьёй и один проход ревизии внутри hook_callback_timeout."""

    hook_callback_timeout: float
    judge_timeout: float
    revision_timeout: float
    safety_margin: float

    @property
    def total_budget(self) -> float:
        return self.judge_timeout + self.revision_timeout


@dataclass
class ToolTraceEntry:
    """Единичная запись о завершённом вызове инструмента из ``post_tool_call``."""

    tool_name: str
    args: Any
    result_preview: str
    failed: bool
    timestamp: float = field(default_factory=time.monotonic)


@dataclass
class VerificationVerdict:
    """Вердикт верификатора по ответу модели."""

    passed: bool
    issues: List[str] = field(default_factory=list)
    revised_text: Optional[str] = None
    timed_out: bool = False
    verdict: str = field(default="")

    def __post_init__(self) -> None:
        if not self.verdict:
            self.verdict = "pass" if self.passed else "revise"
        elif self.verdict == "revise":
            self.passed = False
        elif self.verdict in {"pass", "allow"}:
            self.passed = True


JudgeCallable = Callable[[str, List[ToolTraceEntry], float], VerificationVerdict]
RevisionCallable = Callable[[str, VerificationVerdict, List[ToolTraceEntry], float], str]

_LOCK = threading.Lock()
_TRACES_BY_SESSION: Dict[str, List[ToolTraceEntry]] = {}
_DEFAULT_SESSION = "__default__"
_CUSTOM_JUDGE_FN: Optional[JudgeCallable] = None
_CUSTOM_REVISION_FN: Optional[RevisionCallable] = None

WRITE_TOOL_NAMES = frozenset({
    "write_file",
    "create_file",
    "edit_file",
    "patch",
    "write",
    "terminal",
    "bash",
    "powershell",
    "exec_command",
    "shell",
})

_REVISION_MARKER = "[Проверка верификатора Nomad:"
_REVISED_TURNS: set[str] = set()

_CLAIM_TESTS_PASSED_RE = re.compile(
    r"""(?ix)
    (?:
        \ball\s+tests?\s+passed\b
      | \bpytest\s+passed\b
      | \bвсе\s+тесты\s+прошли\b
      | \bтесты\s+успешно\s+пройдены\b
      | \b0\s+failed\b
    )
    """
)

_CLAIM_FILE_CREATED_RE = re.compile(
    r"""(?ix)
    (?:
        \bфайл\s+(?:был\s+)?(?:успешно\s+)?создан\b
      | \bсоздан\s+(?:новый\s+)?файл\b
      | \bфайл\s+\S+\s+(?:был\s+)?(?:успешно\s+)?создан\b
      | \bсоздали\s+файл\b
      | \bfile\s+(?:was\s+)?(?:successfully\s+)?created\b
      | \bcreated\s+(?:the\s+|a\s+)?file\b
    )
    """
)

_CLAIM_NEGATED_FILE_CREATED_RE = re.compile(
    r"""(?ix)
    (?:
        \bне\s+(?:был\s+)?(?:успешно\s+)?создан\b
      | \bне\s+удалось\s+создать\b
      | \bошибка\s+создания\s+файла\b
      | \bне\s+создан\b
      | \bне\s+создали\b
      | \bnot\s+created\b
      | \bfailed\s+to\s+create\b
      | \bcould\s+not\s+create\b
    )
    """
)

_PATH_MENTIONS_RE = re.compile(
    r"""(?ix)
    (?:файл|file|путь|path)?\s*[`'"]([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9_-]+)[`'"]
    | (?:файл|file|path)\s*[:=]\s*([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9_-]+)
    | \b([a-zA-Z0-9_.-]+/[a-zA-Z0-9_./-]+\.[a-zA-Z0-9_-]+)\b
    """
)


def _safe_file_exists(path_str: str) -> bool:
    try:
        p = Path(path_str)
        return p.is_file()
    except Exception:
        return False


def _extract_file_candidates(response_text: str, traces: List[ToolTraceEntry]) -> List[str]:
    candidates: List[str] = []
    # Из аргументов инструментов
    for t in traces:
        if isinstance(t.args, dict):
            for k in ("path", "file_path", "filepath", "file", "target", "filename"):
                v = t.args.get(k)
                if isinstance(v, str) and v.strip() and v.strip() not in candidates:
                    candidates.append(v.strip())
    # Из текста ответа
    for m in _PATH_MENTIONS_RE.finditer(response_text):
        for g in m.groups():
            if g and g.strip() and g.strip() not in candidates:
                candidates.append(g.strip())
    return candidates

_TRACE_FAILURE_RE = re.compile(
    r"""(?ix)
    (?:
        \bFAILED\b
      | \bAssertionError\b
      | \bexit\s+code\s*[:=]\s*[1-9]\d*\b
      | \breturncode\s*[:=]\s*[1-9]\d*\b
      | "error"\s*:\s*"[^"]+"
      | \bTraceback\s+\(most\s+recent\s+call\s+last\)
    )
    """
)


def _session_key(session_id: Any = None) -> str:
    if isinstance(session_id, str) and session_id.strip():
        return session_id.strip()
    return _DEFAULT_SESSION


def get_verification_config(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Возвращает актуальный конфиг через load_config_readonly, если config не передан явно."""
    if config is not None and isinstance(config, dict):
        return config
    try:
        return core_adapter.load_config_readonly() or {}
    except Exception:
        return {}


def resolve_verification_budget(
    hook_callback_timeout: Optional[float] = None,
    config: Optional[Dict[str, Any]] = None,
) -> VerificationBudget:
    """Вычисляет таймауты судьи и ревизии так, чтобы ``judge + revision < hook_callback_timeout``.

    Читает глобальные настройки ``verification.*`` и ``plugins.hook_callback_timeout``
    через :func:`core_adapter.load_config_readonly`.
    """
    cfg = get_verification_config(config)
    v_cfg = cfg.get("verification") if isinstance(cfg.get("verification"), dict) else {}
    p_cfg = cfg.get("plugins") if isinstance(cfg.get("plugins"), dict) else {}

    raw_timeout = hook_callback_timeout
    if raw_timeout is None:
        for candidate in (
            v_cfg.get("hook_callback_timeout"),
            p_cfg.get("hook_callback_timeout"),
        ):
            if candidate is not None:
                try:
                    raw_timeout = float(candidate)
                    break
                except (TypeError, ValueError):
                    pass

    total_hook = (
        float(raw_timeout)
        if (raw_timeout is not None and raw_timeout > 0)
        else DEFAULT_HOOK_CALLBACK_TIMEOUT
    )

    custom_judge = v_cfg.get("judge_timeout")
    custom_revision = v_cfg.get("revision_timeout")
    custom_margin = v_cfg.get("safety_margin")

    try:
        judge_t = float(custom_judge) if custom_judge is not None else round(total_hook * 0.40, 3)
    except (TypeError, ValueError):
        judge_t = round(total_hook * 0.40, 3)

    try:
        revision_t = (
            float(custom_revision) if custom_revision is not None else round(total_hook * 0.40, 3)
        )
    except (TypeError, ValueError):
        revision_t = round(total_hook * 0.40, 3)

    if judge_t + revision_t >= total_hook:
        judge_t = max(0.05, total_hook * 0.35)
        revision_t = max(0.05, total_hook * 0.35)

    if custom_margin is not None:
        try:
            margin = float(custom_margin)
        except (TypeError, ValueError):
            margin = max(0.01, round(total_hook - (judge_t + revision_t), 3))
    else:
        margin = max(0.01, round(total_hook - (judge_t + revision_t), 3))

    return VerificationBudget(
        hook_callback_timeout=total_hook,
        judge_timeout=judge_t,
        revision_timeout=revision_t,
        safety_margin=margin,
    )


def register_auxiliary_task(ctx: Any) -> bool:
    """Регистрирует auxiliary-задачу ``nomad_verification_judge`` в контексте плагина."""
    reg_fn = getattr(ctx, "register_auxiliary_task", None)
    if not callable(reg_fn):
        return False
    budget = resolve_verification_budget()
    try:
        reg_fn(
            AUX_TASK_KEY,
            display_name=AUX_TASK_DISPLAY_NAME,
            description=AUX_TASK_DESCRIPTION,
            defaults={
                "provider": "auto",
                "model": "",
                "timeout": int(max(1, round(budget.judge_timeout))),
            },
            inherit_from=AUX_TASK_INHERIT_FROM,
        )
    except TypeError:
        reg_fn(
            AUX_TASK_KEY,
            display_name=AUX_TASK_DISPLAY_NAME,
            description=AUX_TASK_DESCRIPTION,
            defaults={
                "provider": "auto",
                "model": "",
                "timeout": int(max(1, round(budget.judge_timeout))),
            },
        )
    return True


def reset_revisions(session_id: Optional[str] = None) -> None:
    """Очищает историю ревизий для защиты от циклов."""
    with _LOCK:
        if session_id is None:
            _REVISED_TURNS.clear()
        else:
            prefix = f"{_session_key(session_id)}:"
            for k in list(_REVISED_TURNS):
                if k.startswith(prefix):
                    _REVISED_TURNS.discard(k)


def reset_traces(session_id: Optional[str] = None) -> None:
    """Очищает накопленные следы инструментов."""
    with _LOCK:
        if session_id is None:
            _TRACES_BY_SESSION.clear()
        else:
            _TRACES_BY_SESSION.pop(_session_key(session_id), None)
    reset_revisions(session_id)


def set_judge_fn(fn: Optional[JudgeCallable]) -> None:
    """Устанавливает пользовательскую функцию судьи (для тестов или кастомного адаптера)."""
    global _CUSTOM_JUDGE_FN
    with _LOCK:
        _CUSTOM_JUDGE_FN = fn


def set_revision_fn(fn: Optional[RevisionCallable]) -> None:
    """Устанавливает пользовательскую функцию однопроходной ревизии."""
    global _CUSTOM_REVISION_FN
    with _LOCK:
        _CUSTOM_REVISION_FN = fn


def get_traces(session_id: Optional[str] = None) -> List[ToolTraceEntry]:
    """Возвращает список записанных вызовов инструментов для сессии."""
    key = _session_key(session_id)
    with _LOCK:
        entries = _TRACES_BY_SESSION.get(key)
        if not entries and key != _DEFAULT_SESSION:
            entries = _TRACES_BY_SESSION.get(_DEFAULT_SESSION)
        return list(entries or [])


def _detect_trace_failure(result: Any) -> bool:
    if isinstance(result, dict):
        if result.get("error") or result.get("failed") is True:
            return True
        rc = result.get("returncode", result.get("exit_code", 0))
        if isinstance(rc, int) and rc != 0:
            return True
    text = result if isinstance(result, str) else str(result or "")
    return bool(_TRACE_FAILURE_RE.search(text))


def record_tool_trace(
    tool_name: str,
    args: Any = None,
    result: Any = None,
    *,
    session_id: Any = None,
) -> ToolTraceEntry:
    """Сохраняет след вызова инструмента."""
    raw = result if isinstance(result, str) else str(result or "")
    preview = raw[:MAX_TRACE_RESULT_CHARS]
    entry = ToolTraceEntry(
        tool_name=(tool_name or "").strip(),
        args=args,
        result_preview=preview,
        failed=_detect_trace_failure(result),
    )
    keys = {_DEFAULT_SESSION, _session_key(session_id)}
    with _LOCK:
        for k in keys:
            _TRACES_BY_SESSION.setdefault(k, []).append(entry)
    return entry


def on_post_tool_call(
    tool_name: str = "",
    args: Any = None,
    result: Any = None,
    **kwargs: Any,
) -> None:
    """Хук ``post_tool_call``: накапливает доказательную базу вызовов инструментов."""
    if not tool_name:
        return
    record_tool_trace(
        tool_name=tool_name,
        args=args,
        result=result,
        session_id=kwargs.get("session_id") or kwargs.get("task_id"),
    )


def default_judge(
    response_text: str,
    traces: List[ToolTraceEntry],
    timeout: float = 12.0,
) -> VerificationVerdict:
    """Базовый детерминированный судья: сверяет утверждения об успехе с реальными следами инструментов."""
    if not response_text:
        return VerificationVerdict(passed=True, verdict="pass")

    issues: List[str] = []

    # 1. Проверка утверждений об успешных тестах
    if _CLAIM_TESTS_PASSED_RE.search(response_text):
        if not traces:
            issues.append(
                "Ответ утверждает успешное прохождение проверок, но тестовые инструменты не запускались."
            )
        else:
            failed_traces = [t for t in traces if t.failed]
            if failed_traces:
                failed_names = ", ".join(sorted({t.tool_name for t in failed_traces}))
                issues.append(
                    f"Ответ утверждает успешное прохождение проверок, но в следах инструментов "
                    f"зафиксирована ошибка ({failed_names})."
                )

    # 2. Проверка утверждений о создании файла
    if _CLAIM_FILE_CREATED_RE.search(response_text) and not _CLAIM_NEGATED_FILE_CREATED_RE.search(response_text):
        write_traces = [t for t in traces if t.tool_name in WRITE_TOOL_NAMES]
        write_ok = any(not t.failed for t in write_traces)
        candidates = _extract_file_candidates(response_text, traces)
        file_on_disk = any(_safe_file_exists(c) for c in candidates) if candidates else False

        if not write_traces:
            if not file_on_disk:
                issues.append(
                    "Ответ утверждает, что файл создан, но инструмент записи не вызывался и файл не обнаружен."
                )
        elif not write_ok:
            if not file_on_disk:
                failed_names = ", ".join(sorted({t.tool_name for t in write_traces if t.failed}))
                issues.append(
                    f"Ответ утверждает, что файл создан, но инструмент записи завершился ошибкой ({failed_names})."
                )
        elif candidates and not file_on_disk:
            issues.append(
                "Ответ утверждает, что файл создан, но указанный файл отсутствует на диске."
            )

    if issues:
        return VerificationVerdict(passed=False, issues=issues, verdict="revise")
    return VerificationVerdict(passed=True, verdict="pass")


def default_revision(
    response_text: str,
    verdict: VerificationVerdict,
    traces: List[ToolTraceEntry],
    timeout: float = 12.0,
) -> str:
    """Однопроходная корректировка ответа при обнаружении расхождения со следами инструментов."""
    if verdict.revised_text:
        return verdict.revised_text
    bullet_issues = "; ".join(verdict.issues)
    return (
        f"{response_text.rstrip()}\n\n"
        f"[Проверка верификатора Nomad: обнаружено расхождение со следами инструментов — {bullet_issues}]"
    )


def _run_with_timeout(fn: Callable[[], Any], timeout_s: float) -> Any:
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
    future = executor.submit(fn)
    try:
        return future.result(timeout=max(0.01, float(timeout_s)))
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def verify_and_revise_response(
    response_text: str,
    *,
    session_id: Optional[str] = None,
    turn_id: Optional[str] = None,
    budget: Optional[VerificationBudget] = None,
    judge_fn: Optional[JudgeCallable] = None,
    revision_fn: Optional[RevisionCallable] = None,
) -> Optional[str]:
    """Выполняет оценку судьёй и не более 1 прохода ревизии в рамках ``VerificationBudget``."""
    if not isinstance(response_text, str) or not response_text.strip():
        return None

    # Проверка глобального флага verification.enabled через load_config_readonly
    cfg = get_verification_config()
    v_cfg = cfg.get("verification") if isinstance(cfg.get("verification"), dict) else {}
    if v_cfg.get("enabled") is False:
        return None

    # Защита от бесконечного цикла: если в тексте уже есть маркер ревизии — не ревизировать повторно
    if _REVISION_MARKER in response_text or "[Ревизия верификатора Nomad:" in response_text:
        return None

    s_key = _session_key(session_id)
    turn_key = f"{s_key}:{turn_id or '__default_turn__'}"
    with _LOCK:
        if turn_key in _REVISED_TURNS:
            return None

    traces = get_traces(session_id)
    # Если следов нет и текст не содержит проверяемых утверждений — выходим без ревизии
    if not traces and not (
        _CLAIM_FILE_CREATED_RE.search(response_text) or _CLAIM_TESTS_PASSED_RE.search(response_text)
    ):
        return None

    active_budget = budget or resolve_verification_budget()
    with _LOCK:
        active_judge = judge_fn or _CUSTOM_JUDGE_FN or default_judge
        active_revision = revision_fn or _CUSTOM_REVISION_FN or default_revision

    try:
        verdict: VerificationVerdict = _run_with_timeout(
            lambda: active_judge(response_text, traces, active_budget.judge_timeout),
            active_budget.judge_timeout,
        )
    except concurrent.futures.TimeoutError:
        return None
    except Exception:
        return None

    if verdict is None or verdict.passed or verdict.verdict not in {"revise", "failed"}:
        return None

    # Строго ровно один проход ревизии на ход (MAX_REVISION_PASSES == 1)
    passes = 0
    revised: Optional[str] = None
    while passes < MAX_REVISION_PASSES:
        passes += 1
        try:
            revised = _run_with_timeout(
                lambda: active_revision(
                    response_text,
                    verdict,
                    traces,
                    active_budget.revision_timeout,
                ),
                active_budget.revision_timeout,
            )
        except concurrent.futures.TimeoutError:
            return None
        except Exception:
            return None

    if isinstance(revised, str) and revised.strip() and revised != response_text:
        with _LOCK:
            _REVISED_TURNS.add(turn_key)
        return revised
    return None


def on_transform_llm_output(
    response_text: str = "",
    session_id: str = "",
    model: str = "",
    platform: str = "",
    turn_id: str = "",
    **kwargs: Any,
) -> Optional[str]:
    """Хук ``transform_llm_output``: проверяет ответ по следам ``post_tool_call`` и при необходимости правит."""
    return verify_and_revise_response(
        response_text,
        session_id=session_id or None,
        turn_id=turn_id or kwargs.get("turn_id") or None,
        budget=kwargs.get("budget"),
        judge_fn=kwargs.get("judge_fn"),
        revision_fn=kwargs.get("revision_fn"),
    )
