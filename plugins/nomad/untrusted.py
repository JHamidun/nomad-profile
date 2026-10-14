"""Маркировка недоверенного контента (P0-B / M-114) и защита от эксфильтрации.

Модуль решает две задачи:
1. Через хук ``transform_tool_result`` оборачивает результаты внешних/недоверенных
   инструментов (``web_fetch``, ``web_search``, ``web_extract``, ``browser_*``,
   ``http_request``, ``mcp_*``) в изолирующий тег
   ``<untrusted-content source="..." trust="untrusted">...</untrusted-content>``
   с экранированием вложенных закрывающих/открывающих тегов, чтобы внешний сайт
   не мог закрыть контейнер и внедрить инструкцию в контекст модели.
2. Отслеживает «заражение» (taint) текущей сессии недоверенным контентом и через
   ``pre_tool_call`` (и callback в ``guard.register_policy_callback``) блокирует
   последующие попытки эксфильтрации данных (сетевой egress в ``terminal``/``bash``
   через ``curl``/``wget``/``Invoke-WebRequest``/``nc``/``scp``, обращение к URL,
   извлечённым из недоверенного текста, или отправку секретов вовне).
"""

from __future__ import annotations

import json
import os
import re
import threading
from collections.abc import Mapping
from dataclasses import dataclass, field
from typing import Any, Dict, FrozenSet, Iterable, List, Optional, Set

UNTRUSTED_TAG_NAME = "untrusted-content"
UNTRUSTED_OPEN_PREFIX = f"<{UNTRUSTED_TAG_NAME}"
UNTRUSTED_CLOSE_TAG = f"</{UNTRUSTED_TAG_NAME}>"

DEFAULT_UNTRUSTED_TOOLS: FrozenSet[str] = frozenset({
    "web_fetch",
    "web_search",
    "web_extract",
    "fetch",
    "browser_navigate",
    "browser_snapshot",
    "browser_get_images",
    "browser_get_text",
    "browser_console",
    "browser_click",
    "browser_vision",
    "http_request",
    "fetch_url",
    "read_url",
})

SHELL_TOOL_NAMES: FrozenSet[str] = frozenset({
    "terminal",
    "bash",
    "shell",
    "execute_command",
    "run_command",
})

NETWORK_EGRESS_TOOLS: FrozenSet[str] = frozenset({
    "http_request",
    "webhook",
    "send_email",
    "message_send",
})

MEMORY_WRITE_TOOLS: FrozenSet[str] = frozenset({
    "memory",
    "save_memory",
    "write_memory",
    "memory_write",
    "update_memory",
})

FILE_WRITE_TOOLS: FrozenSet[str] = frozenset({
    "write_file",
    "patch",
    "edit_file",
})

DEFAULT_EGRESS_ALLOWLIST: FrozenSet[str] = frozenset({
    "localhost",
    "127.0.0.1",
    "::1",
})

_TAG_ESCAPE_RE = re.compile(r"(</?)\s*untrusted-content\b", re.IGNORECASE)
_URL_RE = re.compile(r"https?://([a-zA-Z0-9._-]+)(?::\d+)?(/[^\s\"'<>)]*)?", re.IGNORECASE)

_SHELL_EGRESS_RE = re.compile(
    r"""(?ix)
    (?:^|[;&|()\s])
    (?:
        curl\b
      | wget\b
      | Invoke-WebRequest\b
      | Invoke-RestMethod\b
      | iwr\b
      | irm\b
      | nc\b
      | ncat\b
      | netcat\b
      | scp\b
      | sftp\b
      | ftp\b
      | telnet\b
      | socat\b
      | certutil\s+-urlcache\b
      | bitsadmin\s+/transfer\b
      | (?:python|python3|py)\s+-[a-zA-Z]*c\b[^\n]*(?:urllib|requests|httpx|socket|http\.client)
      | (?:node|bun|deno)\s+-[a-zA-Z]*e\b[^\n]*(?:fetch|http|https|net)
    )
    """
)

_SECRET_EXFIL_RE = re.compile(
    r"""(?ix)
    (?:
        \$(?:\{)?(?:OPENAI|ANTHROPIC|OPENROUTER|DEEPSEEK|GEMINI|GOOGLE|NOMAD|HERMES|AWS|GITHUB|TELEGRAM)[A-Z0-9_]*
      | %[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*%
      | \bauth\.json\b
      | \.credentials\.
      | \b\.env\b
      | \bapi[_-]?key\s*=
      | \bauthorization\s*:\s*bearer\b
    )
    """
)

_INJECTION_SIGNAL_RE = re.compile(
    r"""(?ix)
    (?:
        ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions
      | disregard\s+(?:all\s+)?(?:previous|prior|above)\s+instructions
      | system\s+prompt
      | new\s+instructions\s*:
      | <\s*/?\s*system\s*>
      | exfiltrate
      | curl\s+https?://
      | wget\s+https?://
    )
    """
)


@dataclass
class TaintRecord:
    """Состояние заражения (taint) для конкретной сессии или задачи."""

    tainted: bool = False
    sources: Set[str] = field(default_factory=set)
    injected_hosts: Set[str] = field(default_factory=set)
    injected_urls: Set[str] = field(default_factory=set)
    injection_detected: bool = False
    event_count: int = 0


_LOCK = threading.Lock()
_TAINT_BY_SESSION: Dict[str, TaintRecord] = {}
_DEFAULT_SESSION_KEY = "__default__"


def _normalize_session_key(session_id: Any = None, task_id: Any = None) -> str:
    for candidate in (session_id, task_id):
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return _DEFAULT_SESSION_KEY


def reset_taint_state(session_id: Optional[str] = None) -> None:
    """Сбрасывает отслеживание недоверенного контента (для тестов и новых сессий)."""
    with _LOCK:
        if session_id is None:
            _TAINT_BY_SESSION.clear()
        else:
            _TAINT_BY_SESSION.pop(_normalize_session_key(session_id), None)


def get_taint_state(session_id: Optional[str] = None, task_id: Optional[str] = None) -> TaintRecord:
    """Возвращает копию состояния taint для указанной сессии (или глобального контекста)."""
    key = _normalize_session_key(session_id, task_id)
    with _LOCK:
        rec = _TAINT_BY_SESSION.get(key)
        if rec is None and key != _DEFAULT_SESSION_KEY:
            rec = _TAINT_BY_SESSION.get(_DEFAULT_SESSION_KEY)
        if rec is None:
            return TaintRecord()
        return TaintRecord(
            tainted=rec.tainted,
            sources=set(rec.sources),
            injected_hosts=set(rec.injected_hosts),
            injected_urls=set(rec.injected_urls),
            injection_detected=rec.injection_detected,
            event_count=rec.event_count,
        )


def is_untrusted_tool(tool_name: str, extra_tools: Optional[Iterable[str]] = None) -> bool:
    """Определяет, относится ли инструмент к внешним/недоверенным источникам."""
    name = (tool_name or "").strip().lower()
    if not name:
        return False
    if name in DEFAULT_UNTRUSTED_TOOLS:
        return True
    if extra_tools and name in {t.strip().lower() for t in extra_tools if t}:
        return True
    if (
        name.startswith("mcp_")
        or name.startswith("mcp__")
        or name.startswith("mcp-")
        or name.startswith("browser_")
    ):
        return True
    if ":" in name and not name.startswith("nomad:"):
        return True
    return False


def sanitize_untrusted_payload(text: str) -> str:
    """Экранирует попытки закрыть или открыть тег ``<untrusted-content>`` внутри данных."""
    if not text:
        return ""

    def _repl(match: re.Match[str]) -> str:
        prefix = match.group(1)
        escaped_prefix = "&lt;/" if "/" in prefix else "&lt;"
        return f"{escaped_prefix}{UNTRUSTED_TAG_NAME}"

    return _TAG_ESCAPE_RE.sub(_repl, text)


def wrap_untrusted_content(
    content: str,
    *,
    source: str,
    injection_detected: bool = False,
) -> str:
    """Оборачивает текст в ``<untrusted-content ...>`` с защитой от побега из тега."""
    raw = content if isinstance(content, str) else str(content or "")
    stripped = raw.strip()
    if (
        stripped.startswith(UNTRUSTED_OPEN_PREFIX)
        and stripped.endswith(UNTRUSTED_CLOSE_TAG)
        and stripped.count(UNTRUSTED_CLOSE_TAG) == 1
    ):
        return raw

    safe_source = re.sub(r'[^a-zA-Z0-9_.:/-]', "_", (source or "unknown").strip()) or "unknown"
    sanitized = sanitize_untrusted_payload(raw)
    risk_attr = ' injection_signal="detected"' if injection_detected else ""
    return (
        f'<{UNTRUSTED_TAG_NAME} source="{safe_source}" trust="untrusted"{risk_attr}>\n'
        f"{sanitized}\n"
        f"{UNTRUSTED_CLOSE_TAG}"
    )


def mark_tainted(
    source_tool: str,
    content: str,
    *,
    session_id: Any = None,
    task_id: Any = None,
) -> TaintRecord:
    """Регистрирует поступление недоверенного контента в сессию."""
    text = content if isinstance(content, str) else str(content or "")
    hosts: Set[str] = set()
    urls: Set[str] = set()
    for match in _URL_RE.finditer(text):
        host = (match.group(1) or "").strip().lower().rstrip(".")
        if host:
            hosts.add(host)
        full_url = (match.group(0) or "").strip()
        if full_url:
            urls.add(full_url)

    inj = bool(_INJECTION_SIGNAL_RE.search(text))
    keys = {_DEFAULT_SESSION_KEY, _normalize_session_key(session_id, task_id)}
    with _LOCK:
        for k in keys:
            rec = _TAINT_BY_SESSION.setdefault(k, TaintRecord())
            rec.tainted = True
            rec.sources.add((source_tool or "unknown").strip().lower())
            rec.injected_hosts.update(hosts)
            rec.injected_urls.update(urls)
            rec.injection_detected = rec.injection_detected or inj
            rec.event_count += 1
        current = _TAINT_BY_SESSION[_normalize_session_key(session_id, task_id)]
        return TaintRecord(
            tainted=current.tainted,
            sources=set(current.sources),
            injected_hosts=set(current.injected_hosts),
            injected_urls=set(current.injected_urls),
            injection_detected=current.injection_detected,
            event_count=current.event_count,
        )


def _allowed_egress_hosts(extra_allowlist: Optional[Iterable[str]] = None) -> Set[str]:
    allowed = set(DEFAULT_EGRESS_ALLOWLIST)
    env_raw = os.environ.get("NOMAD_UNTRUSTED_EGRESS_ALLOWLIST", "")
    if env_raw:
        for item in env_raw.split(","):
            host = item.strip().lower().rstrip(".")
            if host:
                allowed.add(host)
    if extra_allowlist:
        for item in extra_allowlist:
            host = (item or "").strip().lower().rstrip(".")
            if host:
                allowed.add(host)
    return allowed


def _host_is_allowed(host: str, allowlist: Set[str]) -> bool:
    clean = (host or "").strip().lower().rstrip(".")
    if not clean:
        return True
    if clean in allowlist:
        return True
    for allowed in allowlist:
        if allowed.startswith("*.") and clean.endswith(allowed[1:]):
            return True
    return False


def _extract_args_text(args: Any) -> str:
    if isinstance(args, str):
        return args
    if isinstance(args, dict):
        parts: List[str] = []
        for k in (
            "command",
            "cmd",
            "script",
            "url",
            "uri",
            "endpoint",
            "body",
            "data",
            "query",
            "content",
            "text",
            "target",
            "path",
            "file_path",
        ):
            val = args.get(k)
            if isinstance(val, str):
                parts.append(val)
            elif val is not None:
                try:
                    parts.append(json.dumps(val, ensure_ascii=False))
                except Exception:
                    parts.append(str(val))
        if parts:
            return "\n".join(parts)
        try:
            return json.dumps(args, ensure_ascii=False)
        except Exception:
            return str(args)
    return str(args or "")


def _block_dict(reason_msg: str) -> Dict[str, Any]:
    return {
        "action": "block",
        "block": True,
        "reason": reason_msg,
        "message": reason_msg,
    }


def on_transform_tool_result(
    tool_name: str = "",
    args: Any = None,
    result: Any = None,
    **kwargs: Any,
) -> Optional[str]:
    """Хук ``transform_tool_result``: оборачивает вывод недоверенных инструментов в ``<untrusted-content>``."""
    if not is_untrusted_tool(tool_name):
        return None
    if result is None:
        return None
    raw_text = result if isinstance(result, str) else str(result)
    session_id = kwargs.get("session_id")
    task_id = kwargs.get("task_id")
    rec = mark_tainted(tool_name, raw_text, session_id=session_id, task_id=task_id)
    return wrap_untrusted_content(
        raw_text,
        source=tool_name,
        injection_detected=rec.injection_detected,
    )


def on_pre_tool_call(
    tool_name: str = "",
    args: Any = None,
    context_or_task_id: Any = None,
    session_id: Any = None,
    **kwargs: Any,
) -> Optional[Dict[str, Any]]:
    """Хук ``pre_tool_call``: блокирует эксфильтрацию данных и отравление памяти после чтения недоверенного контента."""
    if isinstance(context_or_task_id, Mapping):
        resolved_session_id = session_id or context_or_task_id.get("session_id")
        resolved_task_id = kwargs.get("task_id") or context_or_task_id.get("task_id")
        extra_allowlist = kwargs.get("egress_allowlist") or context_or_task_id.get("egress_allowlist")
    else:
        resolved_session_id = session_id or kwargs.get("session_id")
        resolved_task_id = context_or_task_id or kwargs.get("task_id")
        extra_allowlist = kwargs.get("egress_allowlist")

    name = (tool_name or "").strip().lower()
    text = _extract_args_text(args)
    if not text:
        return None

    has_raw_untrusted_tag = (
        UNTRUSTED_OPEN_PREFIX in text.lower()
        or f"&lt;{UNTRUSTED_TAG_NAME}" in text.lower()
    )

    state = get_taint_state(session_id=resolved_session_id, task_id=resolved_task_id)

    # Защита памяти (MEMORY.md / USER.md / инструмент memory) от отравления недоверенным контентом
    is_memory_target = name in MEMORY_WRITE_TOOLS or (
        name in FILE_WRITE_TOOLS
        and any(m in text.upper() for m in ("MEMORY.MD", "USER.MD"))
    )
    if is_memory_target and (
        has_raw_untrusted_tag
        or (state.tainted and (state.injection_detected or bool(_INJECTION_SIGNAL_RE.search(text))))
    ):
        return _block_dict(
            f"Nomad Untrusted Content Guard: заблокирована запись в память через '{tool_name}' "
            f"из-за признаков недоверенного контента / prompt injection."
        )

    if not state.tainted:
        return None

    allowlist = _allowed_egress_hosts(extra_allowlist)
    urls_in_call = list(_URL_RE.finditer(text))
    hosts_in_call = [
        (m.group(1) or "").strip().lower().rstrip(".")
        for m in urls_in_call
        if (m.group(1) or "").strip()
    ]

    if name in SHELL_TOOL_NAMES:
        has_egress_cmd = bool(_SHELL_EGRESS_RE.search(text))
        has_secret_ref = bool(_SECRET_EXFIL_RE.search(text))
        if has_egress_cmd:
            non_allowed_hosts = [h for h in hosts_in_call if not _host_is_allowed(h, allowlist)]
            if non_allowed_hosts or has_secret_ref or not hosts_in_call:
                sources_str = ", ".join(sorted(state.sources)) or "untrusted"
                target_desc = ", ".join(non_allowed_hosts) if non_allowed_hosts else "network egress"
                return _block_dict(
                    f"Nomad Untrusted Content Guard: заблокирован сетевой egress ({target_desc}) "
                    f"в инструменте '{tool_name}' после чтения недоверенного источника ({sources_str})."
                )

    if name in NETWORK_EGRESS_TOOLS or name in DEFAULT_UNTRUSTED_TOOLS:
        has_secret_ref = bool(_SECRET_EXFIL_RE.search(text))
        non_allowed_hosts = [h for h in hosts_in_call if not _host_is_allowed(h, allowlist)]
        injected_hit = [h for h in non_allowed_hosts if h in state.injected_hosts]
        if has_secret_ref and non_allowed_hosts:
            return _block_dict(
                f"Nomad Untrusted Content Guard: заблокирована попытка отправки секретов "
                f"через '{tool_name}' на внешний хост ({', '.join(non_allowed_hosts)})."
            )
        if name in NETWORK_EGRESS_TOOLS and non_allowed_hosts:
            return _block_dict(
                f"Nomad Untrusted Content Guard: инструмент '{tool_name}' заблокирован "
                f"в заражённой сессии (целевой хост: {', '.join(non_allowed_hosts)})."
            )
        if injected_hit and state.injection_detected:
            return _block_dict(
                f"Nomad Untrusted Content Guard: заблокирован переход по URL ({', '.join(injected_hit)}), "
                f"внедрённому из недоверенного контента с признаками prompt injection."
            )

    return None
