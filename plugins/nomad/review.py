"""M-172 (N10): Two-stage card acceptance review — free deterministic checks -> selective cross-family judge, single revision cap.

Канон §10.2 спецификации:
1. Сначала выполняются бесплатные детерминированные проверки:
   - код возврата рабочего (``exit_code == 0``);
   - непустой ``git diff`` / список изменённых файлов (если карточка требует правку репозитория);
   - перезапуск указанной команды тестов и проверки синтаксиса;
   - наличие и непустой размер заявленных выходных файлов (``deliverables``);
   - сверка заявления рабочего «все тесты прошли» с реальным результатом перезапуска тестов:
     при расхождении карточка немедленно получает ``red`` и **0 вызовов судьи**.
2. Карточка класса «код» (``code``, ``repo_work``, ``precise_patch``, ``boilerplate``)
   с полностью зелёными детерминированными проверками **не вызывает** платную модель-судью (``judge_calls == 0``).
3. Если нужен избирательный судья (не-кодовая карточка, высокий риск, низкая уверенность),
   назначается судья из **другого** модельного семейства (``judge.vendor != executor_vendor``):
   - при исполнителе из семейства Claude (``vendor == "anthropic"``) назначается судья с ``vendor != "anthropic"``
     (приоритетно ``codex`` / ``openai``, а если семафор единственного аккаунта Codex занят — ``deepseek`` или ``gemini``);
   - в ``data.db`` пишется событие ``judge_assigned`` с ``vendor != "anthropic"``.
4. По замечаниям судьи допускается **не более одной** доработки (``max_revisions = 1``).
   Вторая подряд попытка доработки отклоняется: пишется событие ``revision_refused``
   (``subreason = "revision_refused"``), а карточка переводится в ``needs_owner`` (``blocked`` / ``needs_input``).
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
import sqlite3
import subprocess
from typing import Any, Callable, Optional, Sequence

from . import db, routing, slots, verification


DEFAULT_MAX_REVISIONS = 1

CODE_WORK_CLASSES: frozenset[str] = frozenset(
    {
        "code",
        "код",
        "repo_work",
        "precise_patch",
        "boilerplate",
        "test_writing",
        "patch",
    }
)

_CLAIMS_TESTS_PASSED_RE = re.compile(
    r"(?:"
    r"все\s+тесты\s+(?:успешно\s+)?прошли"
    r"|тесты\s+(?:успешно\s+)?прошли"
    r"|тесты\s+зел[её]ные"
    r"|all\s+tests\s+pass(?:ed)?"
    r"|tests\s+pass(?:ed)?"
    r"|pytest\s+pass(?:ed)?"
    r")",
    re.IGNORECASE,
)

# Кандидаты в судьи: (lane, vendor, model, billing)
_JUDGE_CANDIDATES: tuple[tuple[str, str, str, str], ...] = (
    ("codex", "openai", "gpt-5.4", "subscription"),
    ("claude-code", "anthropic", "claude-opus-4-7", "subscription"),
    ("deepseek", "deepseek", "deepseek-reasoner", "byok"),
    ("gemini", "google", "gemini-3.1-pro-preview", "free"),
)


@dataclass(frozen=True)
class DeterministicCheckResult:
    """Итог бесплатных детерминированных проверок (этап 1 приёмки)."""

    passed: bool
    exit_code_ok: bool
    git_diff_ok: bool
    tests_ok: bool
    syntax_ok: bool
    deliverables_ok: bool
    false_test_claim: bool
    failures: tuple[str, ...]
    subreason: str = ""
    test_output: str = ""


@dataclass(frozen=True)
class JudgeAssignment:
    """Назначение перекрёстного судьи из другого модельного семейства."""

    task_id: str
    executor_lane: str
    executor_vendor: str
    judge_lane: str
    vendor: str
    model: str
    billing: str
    codex_busy: bool = False

    @property
    def judge_vendor(self) -> str:
        return self.vendor


@dataclass(frozen=True)
class JudgeVerdict:
    """Вердикт модели-судьи по карточке."""

    passed: bool
    remarks: str = ""
    confidence: float = 1.0


@dataclass(frozen=True)
class ReviewOutcome:
    """Итоговое решение двухэтапной приёмки карточки."""

    task_id: str
    verdict: str  # "green" | "red" | "revision_requested" | "needs_owner"
    passed: bool
    deterministic: DeterministicCheckResult
    judge_called: bool
    judge_calls: int
    judge_assignment: Optional[JudgeAssignment]
    revision_count: int
    revision_requested: bool
    revision_refused: bool
    target_status: str  # "done" | "red" | "ready" | "needs_owner"
    subreason: str = ""
    remarks: str = ""


def claims_tests_passed(text: Optional[str]) -> bool:
    """Проверяет, утверждает ли текст отчёта исполнителя, что все тесты прошли."""
    if not text:
        return False
    ver_fn = getattr(verification, "claims_tests_passed", None)
    if callable(ver_fn) and ver_fn(text):
        return True
    ver_re = getattr(verification, "_CLAIMS_TESTS_PASSED_RE", None)
    if ver_re is not None and ver_re.search(str(text)):
        return True
    return bool(_CLAIMS_TESTS_PASSED_RE.search(str(text)))


def is_code_class(work_class: Optional[str]) -> bool:
    """Возвращает ``True``, если класс задачи относится к кодовым с детерминированной проверкой."""
    norm = str(work_class or "").strip().lower()
    return norm in CODE_WORK_CLASSES


def _resolve_vendor(lane: str = "", vendor: str = "") -> str:
    v = str(vendor or "").strip().lower()
    if v:
        return v
    l_norm = routing.normalize_lane_name(lane) if lane else ""
    vendor_map = {
        "claude-code": "anthropic",
        "cc": "anthropic",
        "hermes": "anthropic",
        "codex": "openai",
        "gemini": "google",
        "deepseek": "deepseek",
        "yandex": "yandex",
    }
    return vendor_map.get(l_norm or str(lane or "").strip().lower(), "unknown")


def _check_git_diff(
    *,
    git_diff: Optional[str],
    changed_files: Optional[Sequence[str]],
    workspace: Optional[str | Path],
) -> bool:
    if git_diff is not None:
        return bool(str(git_diff).strip())
    if changed_files is not None:
        return len([f for f in changed_files if str(f).strip()]) > 0
    if workspace is not None:
        ws = Path(workspace)
        if ws.is_dir():
            try:
                proc = subprocess.run(
                    ["git", "status", "--porcelain"],
                    cwd=str(ws),
                    capture_output=True,
                    text=True,
                    encoding="utf-8",
                    errors="replace",
                    timeout=15,
                    check=False,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    return True
            except OSError:
                pass
    return False


def _check_deliverables(
    deliverables: Sequence[str | Path],
    workspace: Optional[str | Path] = None,
) -> tuple[bool, list[str]]:
    missing: list[str] = []
    base = Path(workspace) if workspace is not None else None
    for item in deliverables:
        p = Path(item)
        if not p.is_absolute() and base is not None:
            p = base / p
        try:
            if not p.is_file() or p.stat().st_size <= 0:
                missing.append(str(item))
        except OSError:
            missing.append(str(item))
    return (len(missing) == 0, missing)


def run_deterministic_checks(
    *,
    exit_code: int = 0,
    git_diff: Optional[str] = None,
    changed_files: Optional[Sequence[str]] = None,
    require_git_diff: bool = False,
    test_returncode: Optional[int] = None,
    test_output: str = "",
    test_command: Optional[Sequence[str] | str] = None,
    test_runner: Optional[Callable[[], tuple[int, str]]] = None,
    syntax_ok: bool = True,
    deliverables: Sequence[str | Path] = (),
    worker_report: str = "",
    workspace: Optional[str | Path] = None,
) -> DeterministicCheckResult:
    """Этап 1 приёмки (§10.2): бесплатные детерминированные проверки до любого вызова судьи."""
    failures: list[str] = []

    exit_code_ok = int(exit_code) == 0
    if not exit_code_ok:
        failures.append(f"nonzero_exit_code:{exit_code}")

    if require_git_diff:
        git_diff_ok = _check_git_diff(
            git_diff=git_diff,
            changed_files=changed_files,
            workspace=workspace,
        )
        if not git_diff_ok:
            failures.append("empty_git_diff")
    else:
        git_diff_ok = True

    observed_test_rc: Optional[int] = test_returncode
    observed_test_out: str = str(test_output or "")
    if observed_test_rc is None and test_runner is not None:
        observed_test_rc, observed_test_out = test_runner()
    elif observed_test_rc is None and test_command is not None:
        cmd = (
            ["cmd", "/c", test_command]
            if isinstance(test_command, str)
            else [str(part) for part in test_command]
        )
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(workspace) if workspace is not None else None,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=60,
                check=False,
            )
            observed_test_rc = proc.returncode
            observed_test_out = (proc.stdout or "") + "\n" + (proc.stderr or "")
        except Exception as exc:
            observed_test_rc = 1
            observed_test_out = str(exc)

    tests_ok = True if observed_test_rc is None else (int(observed_test_rc) == 0)
    if not tests_ok:
        failures.append(f"tests_failed:{observed_test_rc}")

    claimed_green = claims_tests_passed(worker_report)
    false_test_claim = bool(claimed_green and not tests_ok)
    if false_test_claim:
        failures.insert(0, "false_test_claim")

    if not syntax_ok:
        failures.append("syntax_error")

    deliverables_ok, missing_files = _check_deliverables(deliverables, workspace=workspace)
    if not deliverables_ok:
        failures.append(f"missing_deliverables:{','.join(missing_files)}")

    passed = (
        exit_code_ok
        and git_diff_ok
        and tests_ok
        and bool(syntax_ok)
        and deliverables_ok
        and not false_test_claim
    )
    if false_test_claim:
        subreason = "false_test_claim"
    elif failures:
        subreason = failures[0].split(":", 1)[0]
    else:
        subreason = ""

    return DeterministicCheckResult(
        passed=passed,
        exit_code_ok=exit_code_ok,
        git_diff_ok=git_diff_ok,
        tests_ok=tests_ok,
        syntax_ok=bool(syntax_ok),
        deliverables_ok=deliverables_ok,
        false_test_claim=false_test_claim,
        failures=tuple(failures),
        subreason=subreason,
        test_output=observed_test_out,
    )


def should_invoke_judge(
    work_class: Optional[str],
    deterministic: DeterministicCheckResult,
    *,
    high_risk: bool = False,
    low_confidence: bool = False,
    subjective_criteria: bool = False,
    force_judge: bool = False,
) -> bool:
    """Определяет, нужно ли вызывать модель-судью после детерминированных проверок.

    - Если детерминированные проверки красные — судья НЕ вызывается никогда (``False``).
    - Если карточка класса «код» и нет флагов риска/сомнений — судья НЕ вызывается (``False``).
    - Иначе (не-кодовая карточка или повышенный риск / субъективный критерий) — ``True``.
    """
    if not deterministic.passed:
        return False
    if force_judge or high_risk or low_confidence or subjective_criteria:
        return True
    if is_code_class(work_class):
        return False
    return True


def _lane_cap(semaphores: Any, lane: str) -> int:
    if hasattr(semaphores, "limits") and hasattr(semaphores.limits, "lane_cap"):
        return int(semaphores.limits.lane_cap(lane))
    if hasattr(semaphores, "lane_cap"):
        return int(semaphores.lane_cap(lane))
    return 1


def _lane_active(semaphores: Any, lane: str) -> int:
    if hasattr(semaphores, "lane_active"):
        return int(semaphores.lane_active(lane))
    if hasattr(semaphores, "lane_in_use"):
        return int(semaphores.lane_in_use(lane))
    return 0


def _swarm_full(semaphores: Any) -> bool:
    if hasattr(semaphores, "swarm_active") and hasattr(semaphores, "limits"):
        return int(semaphores.swarm_active) >= int(semaphores.limits.max_parallel)
    if hasattr(semaphores, "total_in_use") and hasattr(semaphores, "total_slots"):
        return int(semaphores.total_in_use) >= int(semaphores.total_slots)
    return False


def _try_acquire_judge_slot(semaphores: Any, slot_key: str, lane: str) -> bool:
    if semaphores is None:
        return False
    try:
        res = semaphores.try_acquire(slot_key, lane, f"{lane}:judge")
    except TypeError:
        res = semaphores.try_acquire(slot_key, lane)
    if isinstance(res, tuple):
        return bool(res[0])
    return bool(res)


def _is_codex_slot_available(semaphores: Any) -> bool:
    """Проверяет, свободен ли семафор единственного аккаунта Codex."""
    if semaphores is None:
        return True
    if _swarm_full(semaphores):
        return False
    if _lane_active(semaphores, "codex") >= _lane_cap(semaphores, "codex"):
        return False
    if hasattr(semaphores, "can_acquire"):
        try:
            acct = (
                semaphores.select_available_account("codex")[0]
                if hasattr(semaphores, "select_available_account")
                else "codex:slot-00"
            )
            ok, _ = semaphores.can_acquire("codex", acct)
            if not ok:
                return False
        except Exception:
            pass
    return True


def select_cross_family_judge(
    conn: sqlite3.Connection,
    *,
    task_id: str,
    executor_lane: str = "",
    executor_vendor: str = "",
    semaphores: Any = None,
    swarm_id: Optional[str] = None,
    board: str = "default",
) -> JudgeAssignment:
    """Назначает судью из другого модельного семейства (``vendor != executor_vendor``)
    с учётом семафора единственного аккаунта Codex и записывает событие ``judge_assigned``."""
    pin = db.get_task_pin(conn, task_id, board=board)
    eff_lane = str(executor_lane or (pin["lane"] if pin else "") or "claude-code").strip()
    eff_vendor = _resolve_vendor(
        eff_lane,
        executor_vendor or (pin["vendor"] if pin else ""),
    )

    codex_available = _is_codex_slot_available(semaphores)
    codex_busy = not codex_available

    chosen: Optional[tuple[str, str, str, str]] = None
    for cand_lane, cand_vendor, cand_model, cand_billing in _JUDGE_CANDIDATES:
        if cand_vendor == eff_vendor:
            continue
        if cand_lane == "codex" and not codex_available:
            continue
        if semaphores is not None:
            if _lane_active(semaphores, cand_lane) >= _lane_cap(semaphores, cand_lane):
                continue
        chosen = (cand_lane, cand_vendor, cand_model, cand_billing)
        break

    if chosen is None:
        # Fallback: гарантируем другое семейство даже если все слоты заняты.
        for cand_lane, cand_vendor, cand_model, cand_billing in _JUDGE_CANDIDATES:
            if cand_vendor != eff_vendor and (cand_lane != "codex" or codex_available):
                chosen = (cand_lane, cand_vendor, cand_model, cand_billing)
                break
        if chosen is None:
            for cand_lane, cand_vendor, cand_model, cand_billing in _JUDGE_CANDIDATES:
                if cand_vendor != eff_vendor:
                    chosen = (cand_lane, cand_vendor, cand_model, cand_billing)
                    break

    assert chosen is not None
    j_lane, j_vendor, j_model, j_billing = chosen
    assert j_vendor != eff_vendor, f"judge vendor {j_vendor!r} must differ from executor {eff_vendor!r}"

    assignment = JudgeAssignment(
        task_id=task_id,
        executor_lane=eff_lane,
        executor_vendor=eff_vendor,
        judge_lane=j_lane,
        vendor=j_vendor,
        model=j_model,
        billing=j_billing,
        codex_busy=codex_busy,
    )

    db.add_event(
        conn,
        "judge_assigned",
        {
            "task_id": task_id,
            "executor_lane": eff_lane,
            "executor_vendor": eff_vendor,
            "judge_lane": j_lane,
            "vendor": j_vendor,
            "judge_vendor": j_vendor,
            "model": j_model,
            "billing": j_billing,
            "codex_busy": codex_busy,
        },
        swarm_id=swarm_id,
    )
    return assignment


def _apply_kanban_transition(
    kconn: Optional[sqlite3.Connection],
    *,
    task_id: str,
    target_status: str,
    subreason: str,
    remarks: str,
) -> None:
    """Синхронизирует статус карточки в ``kanban.db`` при наличии соединения."""
    if kconn is None:
        return
    import json
    import time

    now = int(time.time())
    if target_status == "done":
        kconn.execute(
            "UPDATE tasks SET status = 'done', claim_lock = NULL, claim_expires = NULL, "
            "worker_pid = NULL, worker_started_at = NULL, consecutive_failures = 0, "
            "last_failure_error = NULL WHERE id = ?",
            (task_id,),
        )
        kconn.execute(
            "INSERT INTO task_events (task_id, kind, payload, created_at) "
            "VALUES (?, 'completed', ?, ?)",
            (task_id, json.dumps({"remarks": remarks}, ensure_ascii=False), now),
        )
        kconn.commit()
    elif target_status == "ready":
        kconn.execute(
            "UPDATE tasks SET status = 'ready', claim_lock = NULL, claim_expires = NULL, "
            "worker_pid = NULL, worker_started_at = NULL WHERE id = ?",
            (task_id,),
        )
        kconn.execute(
            "INSERT INTO task_events (task_id, kind, payload, created_at) "
            "VALUES (?, 'changes_requested', ?, ?)",
            (
                task_id,
                json.dumps({"subreason": subreason, "remarks": remarks}, ensure_ascii=False),
                now,
            ),
        )
        kconn.commit()
    elif target_status in ("needs_owner", "red"):
        kconn.execute(
            "UPDATE tasks SET status = 'blocked', claim_lock = NULL, claim_expires = NULL, "
            "worker_pid = NULL, worker_started_at = NULL, last_failure_error = ? WHERE id = ?",
            (f"{subreason}: {remarks}"[:500], task_id),
        )
        kconn.execute(
            "INSERT INTO task_events (task_id, kind, payload, created_at) "
            "VALUES (?, 'revision_refused', ?, ?)",
            (
                task_id,
                json.dumps(
                    {
                        "block_kind": "needs_input",
                        "target_status": target_status,
                        "subreason": subreason,
                        "remarks": remarks,
                    },
                    ensure_ascii=False,
                ),
                now,
            ),
        )
        kconn.commit()


def review_card(
    conn: sqlite3.Connection,
    *,
    task_id: str,
    work_class: str = "code",
    executor_lane: str = "claude-code",
    executor_vendor: str = "",
    exit_code: int = 0,
    git_diff: Optional[str] = None,
    changed_files: Optional[Sequence[str]] = None,
    require_git_diff: bool = False,
    test_returncode: Optional[int] = None,
    test_output: str = "",
    test_command: Optional[Sequence[str] | str] = None,
    test_runner: Optional[Callable[[], tuple[int, str]]] = None,
    syntax_ok: bool = True,
    deliverables: Sequence[str | Path] = (),
    worker_report: str = "",
    workspace: Optional[str | Path] = None,
    high_risk: bool = False,
    low_confidence: bool = False,
    subjective_criteria: bool = False,
    force_judge: bool = False,
    judge_fn: Optional[Callable[[JudgeAssignment], JudgeVerdict | bool]] = None,
    semaphores: Optional[slots.SwarmSemaphores] = None,
    max_revisions: int = DEFAULT_MAX_REVISIONS,
    swarm_id: Optional[str] = None,
    board: str = "default",
    kconn: Optional[sqlite3.Connection] = None,
) -> ReviewOutcome:
    """Полный конвейер приёмки карточки (M-172 / §10.2).

    1. Запускает бесплатные детерминированные проверки.
       При ложном заявлении «все тесты прошли» на фоне красного перезапуска тестов
       сразу возвращает ``verdict="red"`` и ``judge_calls=0``.
    2. Для карточки класса «код» с зелёными проверками (без флагов риска)
       принимает работу без вызова судьи (``verdict="green"``, ``judge_calls=0``).
    3. При необходимости вызывает перекрёстного судью из другого семейства
       (``judge.vendor != executor_vendor``) с учётом семафора Codex.
    4. На замечания судьи разрешает не более 1 доработки (``revision_count == 1``);
       вторая доработка отклоняется (``revision_refused``, переход в ``needs_owner``).
    """
    existing = db.get_task_review(conn, task_id, board=board)
    prev_revisions = int(existing["revision_count"]) if existing is not None else 0
    prev_judge_calls = int(existing["judge_calls"]) if existing is not None else 0
    eff_max_revisions = int(existing["max_revisions"]) if existing is not None else int(max_revisions)

    pin = db.get_task_pin(conn, task_id, board=board)
    eff_lane = str(executor_lane or (pin["lane"] if pin else "") or "claude-code").strip()
    eff_vendor = _resolve_vendor(eff_lane, executor_vendor or (pin["vendor"] if pin else ""))

    det = run_deterministic_checks(
        exit_code=exit_code,
        git_diff=git_diff,
        changed_files=changed_files,
        require_git_diff=require_git_diff,
        test_returncode=test_returncode,
        test_output=test_output,
        test_command=test_command,
        test_runner=test_runner,
        syntax_ok=syntax_ok,
        deliverables=deliverables,
        worker_report=worker_report,
        workspace=workspace,
    )

    # Этап 1: Детерминированный провал -> 0 вызовов судьи!
    if not det.passed:
        remarks = (
            "Исполнитель заявил «все тесты прошли», но перезапуск тестов завершился с ошибкой"
            if det.false_test_claim
            else f"Детерминированные проверки не пройдены: {', '.join(det.failures)}"
        )
        db.upsert_task_review(
            conn,
            task_id=task_id,
            board=board,
            swarm_id=swarm_id,
            work_class=work_class,
            executor_lane=eff_lane,
            executor_vendor=eff_vendor,
            verdict="red",
            subreason=det.subreason,
            revision_count=prev_revisions,
            max_revisions=eff_max_revisions,
            judge_calls=prev_judge_calls,
            deterministic_passed=False,
            remarks=remarks,
        )
        db.add_event(
            conn,
            "review_deterministic_red",
            {
                "task_id": task_id,
                "verdict": "red",
                "subreason": det.subreason,
                "false_test_claim": det.false_test_claim,
                "failures": list(det.failures),
                "judge_calls": 0,
            },
            swarm_id=swarm_id,
        )
        _apply_kanban_transition(
            kconn,
            task_id=task_id,
            target_status="red",
            subreason=det.subreason,
            remarks=remarks,
        )
        return ReviewOutcome(
            task_id=task_id,
            verdict="red",
            passed=False,
            deterministic=det,
            judge_called=False,
            judge_calls=0,
            judge_assignment=None,
            revision_count=prev_revisions,
            revision_requested=False,
            revision_refused=False,
            target_status="red",
            subreason=det.subreason,
            remarks=remarks,
        )

    # Этап 2: Карточка класса «код» с зелёными проверками судью не вызывает.
    if not should_invoke_judge(
        work_class,
        det,
        high_risk=high_risk,
        low_confidence=low_confidence,
        subjective_criteria=subjective_criteria,
        force_judge=force_judge,
    ):
        db.upsert_task_review(
            conn,
            task_id=task_id,
            board=board,
            swarm_id=swarm_id,
            work_class=work_class,
            executor_lane=eff_lane,
            executor_vendor=eff_vendor,
            verdict="green",
            subreason="deterministic_only",
            revision_count=prev_revisions,
            max_revisions=eff_max_revisions,
            judge_calls=prev_judge_calls,
            deterministic_passed=True,
            remarks="Детерминированные проверки пройдены; вызов судьи не требуется",
        )
        db.add_event(
            conn,
            "review_passed",
            {
                "task_id": task_id,
                "work_class": work_class,
                "judge_called": False,
                "judge_calls": 0,
                "revision_count": prev_revisions,
            },
            swarm_id=swarm_id,
        )
        _apply_kanban_transition(
            kconn,
            task_id=task_id,
            target_status="done",
            subreason="deterministic_only",
            remarks="Детерминированные проверки пройдены",
        )
        return ReviewOutcome(
            task_id=task_id,
            verdict="green",
            passed=True,
            deterministic=det,
            judge_called=False,
            judge_calls=0,
            judge_assignment=None,
            revision_count=prev_revisions,
            revision_requested=False,
            revision_refused=False,
            target_status="done",
            subreason="deterministic_only",
            remarks="Детерминированные проверки пройдены; вызов судьи не требуется",
        )

    # Этап 3: Избирательный вызов перекрёстного судьи.
    assignment = select_cross_family_judge(
        conn,
        task_id=task_id,
        executor_lane=eff_lane,
        executor_vendor=eff_vendor,
        semaphores=semaphores,
        swarm_id=swarm_id,
        board=board,
    )

    judge_slot_key = f"judge:{task_id}"
    acquired_slot = _try_acquire_judge_slot(semaphores, judge_slot_key, assignment.judge_lane)

    try:
        if judge_fn is None:
            judge_verdict = JudgeVerdict(passed=True, remarks="Принято судьёй")
        else:
            raw_verdict = judge_fn(assignment)
            if isinstance(raw_verdict, JudgeVerdict):
                judge_verdict = raw_verdict
            elif isinstance(raw_verdict, bool):
                judge_verdict = JudgeVerdict(
                    passed=raw_verdict,
                    remarks="Принято судьёй" if raw_verdict else "Отклонено судьёй",
                )
            elif isinstance(raw_verdict, dict):
                judge_verdict = JudgeVerdict(
                    passed=bool(raw_verdict.get("passed", False)),
                    remarks=str(raw_verdict.get("remarks", "")),
                    confidence=float(raw_verdict.get("confidence", 1.0)),
                )
            else:
                judge_verdict = JudgeVerdict(passed=bool(raw_verdict))
    finally:
        if acquired_slot and semaphores is not None:
            semaphores.release(judge_slot_key)

    total_judge_calls = prev_judge_calls + 1

    if judge_verdict.passed:
        db.upsert_task_review(
            conn,
            task_id=task_id,
            board=board,
            swarm_id=swarm_id,
            work_class=work_class,
            executor_lane=eff_lane,
            executor_vendor=eff_vendor,
            judge_lane=assignment.judge_lane,
            judge_vendor=assignment.vendor,
            judge_model=assignment.model,
            verdict="green",
            subreason="judge_approved",
            revision_count=prev_revisions,
            max_revisions=eff_max_revisions,
            judge_calls=total_judge_calls,
            deterministic_passed=True,
            remarks=judge_verdict.remarks,
        )
        db.add_event(
            conn,
            "review_passed",
            {
                "task_id": task_id,
                "work_class": work_class,
                "judge_called": True,
                "judge_calls": 1,
                "judge_lane": assignment.judge_lane,
                "judge_vendor": assignment.vendor,
                "revision_count": prev_revisions,
            },
            swarm_id=swarm_id,
        )
        _apply_kanban_transition(
            kconn,
            task_id=task_id,
            target_status="done",
            subreason="judge_approved",
            remarks=judge_verdict.remarks,
        )
        return ReviewOutcome(
            task_id=task_id,
            verdict="green",
            passed=True,
            deterministic=det,
            judge_called=True,
            judge_calls=1,
            judge_assignment=assignment,
            revision_count=prev_revisions,
            revision_requested=False,
            revision_refused=False,
            target_status="done",
            subreason="judge_approved",
            remarks=judge_verdict.remarks,
        )

    # Этап 4: Замечания судьи — не более 1 доработки; вторая отклоняется -> needs_owner.
    if prev_revisions < eff_max_revisions:
        new_revisions = prev_revisions + 1
        db.upsert_task_review(
            conn,
            task_id=task_id,
            board=board,
            swarm_id=swarm_id,
            work_class=work_class,
            executor_lane=eff_lane,
            executor_vendor=eff_vendor,
            judge_lane=assignment.judge_lane,
            judge_vendor=assignment.vendor,
            judge_model=assignment.model,
            verdict="revision_requested",
            subreason="judge_changes_requested",
            revision_count=new_revisions,
            max_revisions=eff_max_revisions,
            judge_calls=total_judge_calls,
            deterministic_passed=True,
            remarks=judge_verdict.remarks,
        )
        db.add_event(
            conn,
            "revision_requested",
            {
                "task_id": task_id,
                "revision_count": new_revisions,
                "max_revisions": eff_max_revisions,
                "judge_lane": assignment.judge_lane,
                "judge_vendor": assignment.vendor,
                "remarks": judge_verdict.remarks,
            },
            swarm_id=swarm_id,
        )
        _apply_kanban_transition(
            kconn,
            task_id=task_id,
            target_status="ready",
            subreason="judge_changes_requested",
            remarks=judge_verdict.remarks,
        )
        return ReviewOutcome(
            task_id=task_id,
            verdict="revision_requested",
            passed=False,
            deterministic=det,
            judge_called=True,
            judge_calls=1,
            judge_assignment=assignment,
            revision_count=new_revisions,
            revision_requested=True,
            revision_refused=False,
            target_status="ready",
            subreason="judge_changes_requested",
            remarks=judge_verdict.remarks,
        )

    # Вторая доработка отклоняется -> revision_refused + needs_owner
    db.upsert_task_review(
        conn,
        task_id=task_id,
        board=board,
        swarm_id=swarm_id,
        work_class=work_class,
        executor_lane=eff_lane,
        executor_vendor=eff_vendor,
        judge_lane=assignment.judge_lane,
        judge_vendor=assignment.vendor,
        judge_model=assignment.model,
        verdict="needs_owner",
        subreason="revision_refused",
        revision_count=prev_revisions,
        max_revisions=eff_max_revisions,
        judge_calls=total_judge_calls,
        deterministic_passed=True,
        remarks=judge_verdict.remarks,
    )
    db.add_event(
        conn,
        "revision_refused",
        {
            "task_id": task_id,
            "subreason": "revision_refused",
            "target_status": "needs_owner",
            "revision_count": prev_revisions,
            "max_revisions": eff_max_revisions,
            "judge_lane": assignment.judge_lane,
            "judge_vendor": assignment.vendor,
            "remarks": judge_verdict.remarks,
        },
        swarm_id=swarm_id,
    )
    _apply_kanban_transition(
        kconn,
        task_id=task_id,
        target_status="needs_owner",
        subreason="revision_refused",
        remarks=judge_verdict.remarks,
    )
    return ReviewOutcome(
        task_id=task_id,
        verdict="needs_owner",
        passed=False,
        deterministic=det,
        judge_called=True,
        judge_calls=1,
        judge_assignment=assignment,
        revision_count=prev_revisions,
        revision_requested=False,
        revision_refused=True,
        target_status="needs_owner",
        subreason="revision_refused",
        remarks=judge_verdict.remarks,
    )
