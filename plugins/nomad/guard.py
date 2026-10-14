"""Pre-tool-call safety guard for Nomad (tasks M-109, M-110, M-111, M-112, M-113, M-119).

Объединяет контуры защиты на хуке ``pre_tool_call``:

1. **SAF1(в) (задача M-109)** — политика ``deny`` / ``ask`` для не-терминальных вызовов:
   * ``read_file`` / ``search_files`` по ``**/.env`` и секретным ``.env.*`` файлам → ``block``;
   * внешние MCP-инструменты ``mcp_*`` (и настраиваемые правила ``nomad.guard.ask``) → ``approve`` (запрос подтверждения), если категория ``safety.mcp`` не выключена явно;
   * любая непойманная ошибка внутри пользовательского/плагинного колбэка политики → ``block`` (fail-closed, в пару к ``hermes_cli/plugins_dispatch.py:235, :244``).
2. **SAF3 (задача M-110)** — самозащита установки:
   * запрещает модификацию (``write_file``, ``patch``, ``terminal``) защищённых каталогов и артефактов установки профиля (``hooks/``, ``plugins/``, ``node``), не мешая штатной записи в рабочие каталоги проектов.
3. **M-111 (W2-16)** — перехват перенаправления демон-контейнера (``guard_rules/container.py``).
4. **M-112 (W2-17)** — перехват разрушительных команд Windows уровня DANGEROUS (``guard_rules/windows_dangerous.py``).
5. **M-113 (W2-18)** — безусловная блокировка катастрофических команд Windows уровня HARDLINE (``guard_rules/windows_hardline.py``), включая режим ``--yolo``.
6. **M-119 (W2-22)** — пользовательские категории защиты ``safety.*`` (``browser``, ``mcp``, ``delete`` / ``file_deletion``, ``external_file``, ``outbound``, ``run_mode``) из ``plugins.entries.nomad.settings``, ``nomad.safety`` и корневого ``safety`` в ``config.yaml``.
7. **Совместимость с контуром допуска карточек (``admission.py``)**:
   * если ``guard`` не заблокировал вызов и не потребовал подтверждения ``approve``, управление передаётся в ``admission.on_pre_tool_call``, поэтому в ``PluginManager`` регистрируется ровно один обработчик ``pre_tool_call``.
"""

from __future__ import annotations

import logging
import os
import re
from fnmatch import fnmatchcase
from pathlib import Path
from typing import Any, Callable, Mapping, Optional

from . import admission, core_adapter, profile_config
from .guard_rules import container, windows_dangerous, windows_hardline

logger = logging.getLogger("hermes_plugins.nomad.guard")

PolicyCallback = Callable[[str, Mapping[str, Any], dict[str, Any]], Optional[dict[str, Any]]]

_custom_policy_callbacks: list[PolicyCallback] = []

# Безопасные шаблоны окружения, не содержащие боевых секретов.
_SAFE_ENV_TEMPLATE_NAMES: frozenset[str] = frozenset(
    {
        ".env.example",
        ".env.sample",
        ".env.template",
        ".env.dist",
        ".env.schema",
    }
)

# Защищённые подкаталоги/бинарники установки внутри профиля и корня Hermes (SAF3, M-110).
PROTECTED_INSTALL_COMPONENTS: tuple[str, ...] = ("hooks", "plugins", "node")
_PROTECTED_NODE_ALIASES: frozenset[str] = frozenset({"node", "node.exe", "node_modules"})
_PROTECTED_ROOT_FILES: frozenset[str] = frozenset(
    {"config.yaml", ".env", "distribution.yaml", "nomad-retired.yaml"}
)

# Заголовки файлов в V4A патчах (`patch` в режиме `mode="patch"`) и unified diff.
_V4A_HEADER_RE = re.compile(
    r"^\*\*\*\s*(?:Update|Add|Delete)\s+File:\s*(.+?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
_V4A_DELETE_HEADER_RE = re.compile(
    r"^\*\*\*\s*Delete\s+File:\s*(.+?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
_V4A_MOVE_RE = re.compile(
    r"^\*\*\*\s*Move\s+File:\s*(.+?)\s*->\s*(.+?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
_V4A_MOVE_TO_RE = re.compile(
    r"^\*\*\*\s*Move\s+to:\s*(.+?)\s*$",
    re.MULTILINE | re.IGNORECASE,
)
_UNIFIED_DIFF_HEADER_RE = re.compile(
    r"^(?:\+\+\+|---)\s+(?:[ab]/)?([^\t\r\n]+)",
    re.MULTILINE,
)

# Признаки модифицирующей команды терминала (запись, перенаправление, удаление, переименование,
# копирование, inline-скрипт интерпретатора).
_TERMINAL_MUTATION_RE = re.compile(
    r"(?:"
    r">>?|"
    r"\b(?:tee|rm|del|erase|rmdir|rd|unlink|mv|cp|install|touch|mkdir|chmod|chown|icacls|"
    r"remove-item|set-content|add-content|out-file|new-item|copy-item|move-item|rename-item|clear-content)\b|"
    r"\bsed\s+(?:-[^\s]*i|--in-place)\b|"
    r"\b(?:perl|ruby)\b[^\n;|&]*\s-[^\s]*i\b|"
    r"\b(?:python[23]?|py|node|pwsh|powershell)(?:\.exe)?\b[^\n;|&]*\s(?:-[ec]|-command|--eval)\b|"
    r"\b(?:write_text|write_bytes|shutil\.rmtree|os\.remove|os\.unlink|os\.replace|os\.rename|fs\.writefile)\b"
    r")",
    re.IGNORECASE,
)

# Команды удаления файлов/каталогов в терминале для категории safety.delete / safety.file_deletion (M-119).
_TERMINAL_DELETE_VERB_RE = re.compile(
    r"(?:^|[;&|\n`(]|\$\()\s*"
    r"(?:sudo\s+(?:-[^\s]+\s+)*)?"
    r"(?:(?:cmd|cmd\.exe)\s+(?:/[a-z]\s+)*/(?:c|k)\s+)?"
    r"(?:(?:powershell|powershell\.exe|pwsh|pwsh\.exe)\s+(?:-[^\s]+\s+)*(?:-c(?:ommand)?\s+)?)?"
    r"[\"']?\s*"
    r"(?:\b(?:rm|unlink|shred|del|erase|rd|rmdir|remove-item)\b|(?<![-\w])ri\b)",
    re.IGNORECASE,
)

# Признаки исходящей отправки данных в терминале для категории safety.outbound (M-119).
_TERMINAL_OUTBOUND_RE = re.compile(
    r"(?:"
    r"\bcurl\b[^\n;|&]*(?:\s-(?:X\s*(?:POST|PUT|PATCH)|d\b|-data|F\b|-form|T\b|-upload-file))|"
    r"\bwget\b[^\n;|&]*\s--post-(?:data|file)\b|"
    r"\b(?:invoke-restmethod|irm|invoke-webrequest|iwr)\b[^\n;|&]*\s-(?:method\s+(?:post|put|patch)|body\b|infile\b)|"
    r"\bgit\s+push\b|"
    r"\bgh\s+(?:pr|issue|release)\s+(?:create|comment|edit)\b|"
    r"\b(?:scp|sftp)\b|"
    r"\bnpm\s+publish\b|"
    r"\btwine\s+upload\b"
    r")",
    re.IGNORECASE,
)


def register_policy_callback(callback: PolicyCallback) -> None:
    """Register an additional ``pre_tool_call`` policy callback (used by extensions and tests)."""
    if callback not in _custom_policy_callbacks:
        _custom_policy_callbacks.append(callback)


def unregister_policy_callback(callback: PolicyCallback) -> None:
    """Remove a previously registered policy callback if present."""
    while callback in _custom_policy_callbacks:
        _custom_policy_callbacks.remove(callback)


def clear_policy_callbacks() -> None:
    """Clear all dynamically registered policy callbacks."""
    _custom_policy_callbacks.clear()


def _normalize_slash(value: str) -> str:
    return value.replace("\\", "/").strip()


def _is_env_secret_target(raw_path: str) -> bool:
    """Return True if *raw_path* (or glob) points at ``.env`` or ``.env.<stage>`` secrets."""
    norm = _normalize_slash(raw_path).rstrip("/")
    if not norm:
        return False
    basename = norm.rsplit("/", 1)[-1].lower()
    if basename in {".env", "*.env", ".env*", "**/.env"}:
        return True
    if basename in _SAFE_ENV_TEMPLATE_NAMES:
        return False
    if basename.startswith(".env.") or basename.endswith("/.env"):
        return True
    if fnmatchcase(norm.lower(), "*/.env") or fnmatchcase(norm.lower(), "**/.env"):
        return True
    if fnmatchcase(norm.lower(), "*/.env.*") and basename not in _SAFE_ENV_TEMPLATE_NAMES:
        return True
    return False


def _load_raw_profile_config(home: Optional[Path] = None) -> dict[str, Any]:
    """Read active profile's ``config.yaml`` safely via ``profile_config.load``."""
    try:
        cfg_path = (Path(home) / "config.yaml") if home is not None else None
        cfg = profile_config.load(cfg_path)
        return dict(cfg) if isinstance(cfg, dict) else {}
    except Exception:
        return {}


def _load_guard_config(home: Optional[Path] = None) -> dict[str, Any]:
    """Load optional ``nomad.guard`` rules from ``config.yaml`` (fail-safe on unreadable YAML)."""
    cfg = _load_raw_profile_config(home=home)
    nomad_sec = cfg.get("nomad")
    if not isinstance(nomad_sec, dict):
        return {}
    guard_sec = nomad_sec.get("guard")
    return dict(guard_sec) if isinstance(guard_sec, dict) else {}


# ---------------------------------------------------------------------------
# M-119: Категории safety.* через pre_tool_call
# ---------------------------------------------------------------------------

_CATEGORY_ALIASES: dict[str, tuple[str, ...]] = {
    "browser": ("browser", "protect_browser", "safety.browser", "safety.protect_browser"),
    "mcp": ("mcp", "protect_mcp", "safety.mcp", "safety.protect_mcp"),
    "file_deletion": (
        "delete",
        "file_deletion",
        "protect_file_deletion",
        "protect_delete",
        "safety.delete",
        "safety.file_deletion",
        "safety.protect_file_deletion",
        "safety.protect_delete",
    ),
    "external_file": (
        "external_file",
        "protect_external_file",
        "safety.external_file",
        "safety.protect_external_file",
    ),
    "outbound": (
        "outbound",
        "protect_outbound",
        "safety.outbound",
        "safety.protect_outbound",
    ),
}


def _parse_category_mode(value: Any) -> Optional[str]:
    """Normalize a category config value to ``"off"``, ``"ask"``, ``"block"``, or ``None``."""
    if value is None:
        return None
    if isinstance(value, bool):
        return "ask" if value else "off"
    if isinstance(value, (int, float)):
        return "ask" if value != 0 else "off"
    if isinstance(value, str):
        norm = value.strip().lower()
        if norm in {"false", "off", "0", "no", "none", "allow", "disabled", "auto"}:
            return "off"
        if norm in {"block", "deny"}:
            return "block"
        if norm in {"true", "on", "1", "yes", "ask", "approve", "prompt", "enabled"}:
            return "ask"
    return None


def _extract_safety_sources(
    cfg: Mapping[str, Any],
    explicit_settings: Optional[Mapping[str, Any]] = None,
) -> list[Mapping[str, Any]]:
    """Collect safety config dicts in ascending precedence order:
    1. top-level ``safety`` in ``config.yaml``
    2. ``nomad.safety`` in ``config.yaml``
    3. ``plugins.entries.nomad.settings`` (and its nested ``safety`` dict) in ``config.yaml``
    4. explicit *explicit_settings* (and its nested ``safety`` dict) passed by caller
    """
    sources: list[Mapping[str, Any]] = []

    top_safety = cfg.get("safety")
    if isinstance(top_safety, Mapping):
        sources.append(top_safety)

    nomad_sec = cfg.get("nomad")
    if isinstance(nomad_sec, Mapping):
        nomad_safety = nomad_sec.get("safety")
        if isinstance(nomad_safety, Mapping):
            sources.append(nomad_safety)

    plugins_sec = cfg.get("plugins")
    if isinstance(plugins_sec, Mapping):
        entries = plugins_sec.get("entries")
        if isinstance(entries, Mapping):
            nomad_entry = entries.get("nomad")
            if isinstance(nomad_entry, Mapping):
                entry_settings = nomad_entry.get("settings")
                if isinstance(entry_settings, Mapping):
                    sources.append(entry_settings)
                    nested_safety = entry_settings.get("safety")
                    if isinstance(nested_safety, Mapping):
                        sources.append(nested_safety)

    if isinstance(explicit_settings, Mapping):
        sources.append(explicit_settings)
        nested_exp = explicit_settings.get("safety")
        if isinstance(nested_exp, Mapping):
            sources.append(nested_exp)

    return sources


def resolve_safety_categories(
    *,
    home: Optional[Path] = None,
    settings: Optional[Mapping[str, Any]] = None,
) -> dict[str, str]:
    """Return resolved mode (``"unset"``, ``"off"``, ``"ask"``, ``"block"``) per category."""
    cfg = _load_raw_profile_config(home=home)
    sources = _extract_safety_sources(cfg, settings)

    modes: dict[str, str] = {cat: "unset" for cat in _CATEGORY_ALIASES}
    run_mode = "auto"

    for src in sources:
        rm = src.get("run_mode") or src.get("safety.run_mode")
        if isinstance(rm, str) and rm.strip():
            run_mode = rm.strip().lower()
        for cat, aliases in _CATEGORY_ALIASES.items():
            for key in aliases:
                if key in src:
                    parsed = _parse_category_mode(src[key])
                    if parsed is not None:
                        modes[cat] = parsed

    if run_mode == "ask":
        for cat, cur in list(modes.items()):
            if cur != "block":
                modes[cat] = "ask"

    return modes


def _effective_workspace_root(
    args: Mapping[str, Any],
    *,
    settings: Optional[Mapping[str, Any]] = None,
) -> Path:
    """Resolve the active project workspace root for ``external_file`` checks."""
    for candidate in (
        args.get("workdir") if isinstance(args.get("workdir"), str) else None,
        settings.get("workspace_root") if isinstance(settings, Mapping) else None,
        settings.get("cwd") if isinstance(settings, Mapping) else None,
        os.environ.get("HERMES_WORKSPACE"),
        os.environ.get("TERMINAL_CWD"),
    ):
        if isinstance(candidate, str) and candidate.strip():
            return _resolve_safe(Path(candidate.strip()))
    return _resolve_safe(Path.cwd())


def _external_file_target(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    settings: Optional[Mapping[str, Any]] = None,
) -> Optional[str]:
    """Return the first target path outside the workspace root, or ``None`` if all are inside."""
    t_lower = tool_name.strip().lower()
    if t_lower not in {"write_file", "patch", "read_file", "search_files", "edit_file", "append_file"}:
        return None

    ws_root = _effective_workspace_root(args, settings=settings)
    ws_norm = Path(os.path.normcase(os.path.normpath(str(ws_root))))

    raw_paths: list[str] = []
    if t_lower == "patch":
        raw_paths.extend(_extract_patch_paths(args))
    else:
        for key in ("path", "file_path", "filepath"):
            val = args.get(key)
            if isinstance(val, str) and val.strip():
                raw_paths.append(val.strip())

    for raw in raw_paths:
        cleaned = raw.strip().strip("\"'")
        if not cleaned:
            continue
        expanded = os.path.expanduser(cleaned)
        cand = Path(expanded)
        resolved = _resolve_safe(ws_root / cand) if not cand.is_absolute() else _resolve_safe(cand)
        res_norm = Path(os.path.normcase(os.path.normpath(str(resolved))))
        try:
            res_norm.relative_to(ws_norm)
        except ValueError:
            return str(resolved)
    return None


def _is_file_deletion_call(tool_name: str, args: Mapping[str, Any]) -> bool:
    t_lower = tool_name.strip().lower()
    if t_lower in {"delete_file", "remove_file"}:
        return True
    if t_lower == "patch":
        patch_text = args.get("patch")
        return bool(isinstance(patch_text, str) and _V4A_DELETE_HEADER_RE.search(patch_text))
    if t_lower == "terminal":
        cmd = args.get("command")
        if not isinstance(cmd, str) or not cmd.strip():
            return False
        masked = windows_dangerous._data_masked_detection_variant(cmd.lower())
        scan_text = masked if masked is not None else cmd
        return bool(_TERMINAL_DELETE_VERB_RE.search(scan_text))
    return False


def _is_outbound_call(tool_name: str, args: Mapping[str, Any]) -> bool:
    t_lower = tool_name.strip().lower()
    if t_lower == "send_message":
        return True
    if t_lower == "terminal":
        cmd = args.get("command")
        if not isinstance(cmd, str) or not cmd.strip():
            return False
        masked = windows_dangerous._data_masked_detection_variant(cmd.lower())
        scan_text = masked if masked is not None else cmd
        return bool(_TERMINAL_OUTBOUND_RE.search(scan_text))
    return False


def _make_category_verdict(
    category: str,
    mode: str,
    label: str,
    tool_name: str,
    detail: str = "",
) -> dict[str, Any]:
    suffix = f" ({detail})" if detail else ""
    rule_key = f"category:{category}"
    if mode == "block":
        msg = f"{label}: вызов {tool_name!r}{suffix} заблокирован категорией безопасности (category: {category})."
        return {
            "action": "block",
            "block": True,
            "category": category,
            "reason": f"category_{category}_blocked",
            "rule_key": rule_key,
            "message": msg,
        }
    msg = f"{label}: вызов {tool_name!r}{suffix} требует подтверждения пользователя (category: {category})."
    return {
        "action": "approve",
        "approve": True,
        "block": False,
        "category": category,
        "reason": f"category_{category}_requires_approval",
        "rule_key": rule_key,
        "message": msg,
    }


def _check_safety_categories(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
    settings: Optional[Mapping[str, Any]] = None,
    modes: Optional[dict[str, str]] = None,
) -> Optional[dict[str, Any]]:
    """Evaluate ``safety.*`` category protections (`browser`, `mcp`, `file_deletion`,
    `external_file`, `outbound`)."""
    t_lower = tool_name.strip().lower()
    if not t_lower:
        return None

    resolved = modes if modes is not None else resolve_safety_categories(home=home, settings=settings)

    # 1. Browser category
    if t_lower == "browser" or t_lower.startswith("browser_"):
        mode = resolved.get("browser", "unset")
        if mode in {"ask", "block"}:
            return _make_category_verdict("browser", mode, "Browser Protection", tool_name)

    # 2. MCP category (when explicitly configured in safety.*)
    if fnmatchcase(t_lower, "mcp_*"):
        mode = resolved.get("mcp", "unset")
        if mode in {"ask", "block"}:
            verdict = _make_category_verdict("mcp", mode, "MCP Protection", tool_name)
            return verdict

    # 3. File deletion category (`delete` / `file_deletion`)
    del_mode = resolved.get("file_deletion", "unset")
    if del_mode in {"ask", "block"} and _is_file_deletion_call(tool_name, args):
        return _make_category_verdict("file_deletion", del_mode, "File Deletion Protection", tool_name)

    # 4. External file category (`external_file`)
    ext_mode = resolved.get("external_file", "unset")
    if ext_mode in {"ask", "block"}:
        ext_target = _external_file_target(tool_name, args, settings=settings)
        if ext_target is not None:
            return _make_category_verdict(
                "external_file", ext_mode, "External File Protection", tool_name, detail=ext_target
            )

    # 5. Outbound category (`outbound`)
    out_mode = resolved.get("outbound", "unset")
    if out_mode in {"ask", "block"} and _is_outbound_call(tool_name, args):
        return _make_category_verdict("outbound", out_mode, "Outbound Protection", tool_name)

    return None


def _matches_rule_spec(rule: str, tool_name: str, candidate_Args: list[str]) -> bool:
    """Match a rule string like ``read_file(**/.env)``, ``mcp_*``, or ``domain:docs.python.org``."""
    spec = rule.strip()
    if not spec:
        return False
    spec_lower = spec.lower()
    tool_lower = tool_name.strip().lower()

    if "(" in spec_lower and spec_lower.endswith(")"):
        t_pat, arg_pat = spec_lower[:-1].split("(", 1)
        t_pat = t_pat.strip()
        arg_pat = arg_pat.strip().strip("\"'")
        if not fnmatchcase(tool_lower, t_pat):
            return False
        if not arg_pat:
            return True
        norm_pat = _normalize_slash(arg_pat)
        for cand in candidate_Args:
            norm_cand = _normalize_slash(cand).lower()
            if (
                fnmatchcase(norm_cand, norm_pat)
                or (norm_pat.startswith("**/") and fnmatchcase(norm_cand, norm_pat[3:]))
                or (norm_pat.startswith("**/") and fnmatchcase(norm_cand, f"*/{norm_pat[3:]}"))
            ):
                return True
        return False

    if spec_lower.startswith("domain:"):
        domain = spec_lower.split(":", 1)[1].strip()
        if not domain:
            return False
        return any(domain in cand.lower() for cand in candidate_Args)

    return fnmatchcase(tool_lower, spec_lower)


def _extract_candidate_arg_strings(args: Mapping[str, Any]) -> list[str]:
    out: list[str] = []
    for key in ("path", "file_path", "filepath", "file_glob", "pattern", "url", "query", "command"):
        val = args.get(key)
        if isinstance(val, str) and val.strip():
            out.append(val.strip())
    return out


def _check_non_terminal_saf1_deny(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
) -> Optional[dict[str, Any]]:
    """Evaluate SAF1(в) ``deny`` rules for non-terminal tool calls."""
    t_lower = tool_name.strip().lower()
    if not t_lower or t_lower == "terminal":
        return None

    candidates = _extract_candidate_arg_strings(args)

    # 1. Встроенный безусловный запрет чтения `.env` через `read_file` / `search_files`.
    if t_lower in {"read_file", "search_files"}:
        for key in ("path", "file_path", "filepath", "file_glob"):
            raw_val = args.get(key)
            if isinstance(raw_val, str) and _is_env_secret_target(raw_val):
                msg = (
                    f"SAF1(в): чтение секретного файла окружения {raw_val!r} через {tool_name} "
                    "заблокировано политикой безопасности Nomad (read_file(**/.env) -> block)."
                )
                logger.warning("nomad.guard: %s", msg)
                return {
                    "action": "block",
                    "block": True,
                    "reason": "env_file_read_denied",
                    "rule": "read_file(**/.env)",
                    "message": msg,
                }

    guard_cfg = _load_guard_config(home=home)

    # 2. Пользовательские / шаблонные правила `nomad.guard.deny`.
    deny_rules = guard_cfg.get("deny")
    if isinstance(deny_rules, list):
        for raw_rule in deny_rules:
            if isinstance(raw_rule, str) and _matches_rule_spec(raw_rule, tool_name, candidates):
                msg = f"SAF1(в): вызов {tool_name} заблокирован правилом nomad.guard.deny ({raw_rule!r})."
                logger.warning("nomad.guard: %s", msg)
                return {
                    "action": "block",
                    "block": True,
                    "reason": "guard_deny_rule",
                    "rule": raw_rule,
                    "message": msg,
                }
    return None


def _check_non_terminal_saf1_ask(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
    mcp_category_mode: str = "unset",
) -> Optional[dict[str, Any]]:
    """Evaluate SAF1(в) ``ask`` rules for non-terminal tool calls."""
    t_lower = tool_name.strip().lower()
    if not t_lower or t_lower == "terminal":
        return None

    candidates = _extract_candidate_arg_strings(args)
    guard_cfg = _load_guard_config(home=home)

    # 3. Встроенное правило `mcp_* -> ask` (если категория safety.mcp не выключена явно в настройках).
    if fnmatchcase(t_lower, "mcp_*") and mcp_category_mode != "off":
        msg = (
            f"SAF1(в): внешний MCP-инструмент {tool_name!r} требует подтверждения пользователя "
            "(mcp_* -> ask)."
        )
        logger.info("nomad.guard: %s", msg)
        return {
            "action": "approve",
            "approve": True,
            "block": False,
            "category": "mcp",
            "reason": "mcp_tool_requires_approval",
            "rule": "mcp_*",
            "rule_key": f"nomad_guard:{tool_name}",
            "message": msg,
        }

    # 4. Пользовательские / шаблонные правила `nomad.guard.ask`.
    ask_rules = guard_cfg.get("ask")
    if isinstance(ask_rules, list):
        for raw_rule in ask_rules:
            if isinstance(raw_rule, str) and _matches_rule_spec(raw_rule, tool_name, candidates):
                msg = (
                    f"SAF1(в): вызов {tool_name!r} требует подтверждения по правилу "
                    f"nomad.guard.ask ({raw_rule!r})."
                )
                logger.info("nomad.guard: %s", msg)
                return {
                    "action": "approve",
                    "approve": True,
                    "block": False,
                    "reason": "guard_ask_rule",
                    "rule": raw_rule,
                    "rule_key": f"nomad_guard:{tool_name}:{raw_rule}",
                    "message": msg,
                }

    return None


def _check_non_terminal_saf1(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
    mcp_category_mode: str = "unset",
) -> Optional[dict[str, Any]]:
    """Evaluate SAF1(в) ``deny`` and ``ask`` rules for non-terminal tool calls."""
    verdict = _check_non_terminal_saf1_deny(tool_name, args, home=home)
    if verdict is not None:
        return verdict
    return _check_non_terminal_saf1_ask(
        tool_name, args, home=home, mcp_category_mode=mcp_category_mode
    )


def _resolve_safe(path: Path) -> Path:
    try:
        return Path(os.path.realpath(str(path)))
    except OSError:
        try:
            return path.resolve(strict=False)
        except OSError:
            return path


def _protected_installation_bases(home: Optional[Path] = None) -> list[Path]:
    """Return all installation base directories whose ``hooks/``, ``plugins/``, ``node`` are protected."""
    bases: list[Path] = []
    seen: set[str] = set()

    def _add(candidate: Optional[Path]) -> None:
        if candidate is None:
            return
        for variant in (candidate, _resolve_safe(candidate)):
            key = os.path.normcase(os.path.normpath(str(variant)))
            if key and key not in seen:
                seen.add(key)
                bases.append(variant)

    active_home = Path(home) if home is not None else core_adapter.get_hermes_home()
    _add(active_home)

    # Если профиль именованный (`<root>/profiles/<name>`), защищаем и корневой каталог Hermes.
    try:
        resolved_home = _resolve_safe(active_home)
        if resolved_home.parent.name.lower() == "profiles":
            _add(resolved_home.parent.parent)
        if active_home.parent.name.lower() == "profiles":
            _add(active_home.parent.parent)
    except Exception:
        pass

    env_install = os.environ.get("NOMAD_INSTALL_ROOT", "").strip()
    if env_install:
        _add(Path(env_install))

    return bases


def _classify_protected_path(
    target_path: str,
    *,
    home: Optional[Path] = None,
    workdir: Optional[str] = None,
) -> Optional[tuple[str, Path]]:
    """If *target_path* points inside a protected installation tree (``hooks/``, ``plugins/``,
    ``node``), return ``(component_name, resolved_path)``; otherwise return ``None``."""
    raw = str(target_path or "").strip().strip("\"'")
    if not raw:
        return None

    active_home = Path(home) if home is not None else core_adapter.get_hermes_home()
    expanded = raw
    for token in ("${HERMES_HOME}", "$HERMES_HOME", "%HERMES_HOME%"):
        if token.lower() in expanded.lower():
            pattern = re.compile(re.escape(token), re.IGNORECASE)
            expanded = pattern.sub(str(active_home), expanded)
    expanded = os.path.expanduser(expanded)

    base_cwd = Path(workdir) if workdir else active_home
    candidate = Path(expanded)
    if not candidate.is_absolute():
        candidate_from_cwd = base_cwd / candidate
        candidate_from_home = active_home / candidate
        candidates = [candidate_from_cwd, _resolve_safe(candidate_from_cwd)]
        if base_cwd != active_home:
            candidates.extend([candidate_from_home, _resolve_safe(candidate_from_home)])
    else:
        candidates = [candidate, _resolve_safe(candidate)]

    bases = _protected_installation_bases(active_home)

    for cand in candidates:
        cand_norm = Path(os.path.normcase(os.path.normpath(str(cand))))
        for base in bases:
            base_norm = Path(os.path.normcase(os.path.normpath(str(base))))
            try:
                rel = cand_norm.relative_to(base_norm)
            except ValueError:
                continue
            parts = rel.parts
            if not parts:
                continue
            top = parts[0].lower().rstrip(". ")
            if top == "hooks":
                return ("hooks", cand)
            if top == "plugins":
                return ("plugins", cand)
            if top in _PROTECTED_NODE_ALIASES:
                return ("node", cand)
            if len(parts) >= 2 and top == "bin" and parts[1].lower().startswith("node"):
                return ("node", cand)
            if len(parts) == 1 and top in _PROTECTED_ROOT_FILES:
                return (top, cand)

    return None


def _extract_patch_paths(args: Mapping[str, Any]) -> list[str]:
    paths: list[str] = []
    direct = args.get("path") or args.get("file_path") or args.get("filepath")
    if isinstance(direct, str) and direct.strip():
        paths.append(direct.strip())

    patch_text = args.get("patch")
    if isinstance(patch_text, str) and patch_text.strip():
        for match in _V4A_HEADER_RE.finditer(patch_text):
            paths.append(match.group(1).strip())
        for match in _V4A_MOVE_RE.finditer(patch_text):
            paths.append(match.group(1).strip())
            paths.append(match.group(2).strip())
        for match in _V4A_MOVE_TO_RE.finditer(patch_text):
            paths.append(match.group(1).strip())
        for match in _UNIFIED_DIFF_HEADER_RE.finditer(patch_text):
            p = match.group(1).strip()
            if p and p != "/dev/null":
                paths.append(p)
    return paths


def _check_terminal_selfprotect(
    command: str,
    *,
    workdir: Optional[str] = None,
    home: Optional[Path] = None,
) -> Optional[dict[str, Any]]:
    """Block terminal commands that attempt to modify protected installation directories
    (``hooks/``, ``plugins/``, ``node``)."""
    raw_cmd = str(command or "").strip()
    if not raw_cmd:
        return None

    active_home = Path(home) if home is not None else core_adapter.get_hermes_home()

    if workdir:
        wd_hit = _classify_protected_path(workdir, home=active_home, workdir=str(active_home))
        if wd_hit is not None and wd_hit[0] in PROTECTED_INSTALL_COMPONENTS:
            if _TERMINAL_MUTATION_RE.search(raw_cmd):
                comp, resolved = wd_hit
                msg = (
                    f"SAF3: самозащита установки Nomad — выполнение модифицирующей команды terminal "
                    f"в защищённом каталоге {comp!r} ({resolved}) запрещено."
                )
                logger.warning("nomad.guard: %s", msg)
                return {
                    "action": "block",
                    "block": True,
                    "reason": "selfprotect_terminal_blocked",
                    "protected_component": comp,
                    "message": msg,
                }

    if not _TERMINAL_MUTATION_RE.search(raw_cmd):
        return None

    norm_cmd = _normalize_slash(raw_cmd).lower()
    bases = _protected_installation_bases(active_home)

    for base in bases:
        base_slash = _normalize_slash(str(base)).rstrip("/").lower()
        if not base_slash:
            continue
        for comp in PROTECTED_INSTALL_COMPONENTS:
            for prefix in (
                f"{base_slash}/{comp}",
                f"$hermes_home/{comp}",
                f"${{hermes_home}}/{comp}",
                f"%hermes_home%/{comp}",
            ):
                idx = norm_cmd.find(prefix)
                if idx != -1:
                    after = norm_cmd[idx + len(prefix) : idx + len(prefix) + 1]
                    if after in {"", "/", " ", '"', "'", ";", "|", "&", ")", "\n", "\r", "."}:
                        msg = (
                            f"SAF3: самозащита установки Nomad — модификация защищённого каталога "
                            f"{comp!r} через terminal запрещена."
                        )
                        logger.warning("nomad.guard: %s", msg)
                        return {
                            "action": "block",
                            "block": True,
                            "reason": "selfprotect_terminal_blocked",
                            "protected_component": comp,
                            "message": msg,
                        }

    effective_wd = _resolve_safe(Path(workdir)) if workdir else _resolve_safe(active_home)
    base_resolved_set = {
        os.path.normcase(os.path.normpath(str(_resolve_safe(b)))) for b in bases
    }
    if os.path.normcase(os.path.normpath(str(effective_wd))) in base_resolved_set:
        rel_match = re.search(
            r"(?:^|[\s\"'=><;|&])(?:\./)?(hooks|plugins|node(?:\.exe|_modules)?)(?:[/\\]|[\s\"';|&)]|$)",
            raw_cmd,
            re.IGNORECASE,
        )
        if rel_match:
            comp_raw = rel_match.group(1).lower()
            comp = "node" if comp_raw.startswith("node") else comp_raw
            msg = (
                f"SAF3: самозащита установки Nomad — модификация относительного пути {comp!r} "
                "внутри каталога профиля через terminal запрещена."
            )
            logger.warning("nomad.guard: %s", msg)
            return {
                "action": "block",
                "block": True,
                "reason": "selfprotect_terminal_blocked",
                "protected_component": comp,
                "message": msg,
            }

    return None


def _check_selfprotect_saf3(
    tool_name: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
) -> Optional[dict[str, Any]]:
    """Evaluate SAF3 self-protection rules for ``write_file``, ``patch``, and ``terminal``."""
    t_lower = tool_name.strip().lower()
    workdir = args.get("workdir") if isinstance(args.get("workdir"), str) else None

    if t_lower == "write_file":
        raw_path = args.get("path") or args.get("file_path") or args.get("filepath")
        if isinstance(raw_path, str):
            hit = _classify_protected_path(raw_path, home=home, workdir=workdir)
            if hit is not None:
                comp, resolved = hit
                msg = (
                    f"SAF3: самозащита установки Nomad — запись через write_file в защищённый путь "
                    f"{comp!r} ({resolved}) запрещена."
                )
                logger.warning("nomad.guard: %s", msg)
                return {
                    "action": "block",
                    "block": True,
                    "reason": "selfprotect_write_blocked",
                    "protected_component": comp,
                    "message": msg,
                }
        return None

    if t_lower == "patch":
        for candidate_path in _extract_patch_paths(args):
            hit = _classify_protected_path(candidate_path, home=home, workdir=workdir)
            if hit is not None:
                comp, resolved = hit
                msg = (
                    f"SAF3: самозащита установки Nomad — изменение через patch защищённого пути "
                    f"{comp!r} ({resolved}) запрещена."
                )
                logger.warning("nomad.guard: %s", msg)
                return {
                    "action": "block",
                    "block": True,
                    "reason": "selfprotect_patch_blocked",
                    "protected_component": comp,
                    "message": msg,
                }
        return None

    if t_lower == "terminal":
        cmd = args.get("command")
        if isinstance(cmd, str):
            return _check_terminal_selfprotect(cmd, workdir=workdir, home=home)
        return None

    return None


def _check_terminal_rules(
    command: str,
    args: Mapping[str, Any],
    *,
    home: Optional[Path] = None,
    settings: Optional[Mapping[str, Any]] = None,
    category_modes: Optional[dict[str, str]] = None,
) -> Optional[dict[str, Any]]:
    """Run M-113 (Windows HARDLINE), M-111 (container daemon redirect), M-112 (Windows DANGEROUS),
    and M-119 (terminal safety categories: `file_deletion`, `outbound`)."""
    # 1. M-113: Windows HARDLINE (unconditional block, including under --yolo).
    hardline_verdict = windows_hardline.check_windows_hardline(command)
    if hardline_verdict is not None:
        return hardline_verdict

    # 2. If a safety category is explicitly set to "block", enforce the block before approve rules.
    cat_verdict = _check_safety_categories(
        "terminal", args, home=home, settings=settings, modes=category_modes
    )
    if cat_verdict is not None and cat_verdict.get("action") == "block":
        return cat_verdict

    # 3. M-111: Container daemon redirect (-H, DOCKER_HOST=, podman -r/--url, context use/update).
    container_verdict = container.check_container_daemon_redirect(command)
    if container_verdict is not None:
        return container_verdict

    # 4. M-112: Windows DANGEROUS tier (Remove-Item -Recurse -Force, del /s /q, taskkill /F, etc.).
    dangerous_verdict = windows_dangerous.check_windows_dangerous(command)
    if dangerous_verdict is not None:
        return dangerous_verdict

    # 5. M-119: Terminal safety category approve gates (e.g. plain `rm notes.txt` under safety.delete).
    if cat_verdict is not None:
        return cat_verdict

    return None


def evaluate_tool_call(
    tool_name: str,
    args: Optional[Mapping[str, Any]] = None,
    *,
    home: Optional[Path] = None,
    settings: Optional[Mapping[str, Any]] = None,
    **kwargs: Any,
) -> Optional[dict[str, Any]]:
    """Run SAF3 self-protection, M-113/M-111/M-112 terminal rules, M-119 ``safety.*`` categories,
    SAF1(в) non-terminal rules, and custom policy callbacks.

    Returns a hook directive dict (``action="block"`` or ``action="approve"``) when gated,
    or ``None`` when the call may proceed to downstream admission checks.
    Fail-closed: any unexpected exception in a rule or callback produces ``action="block"``.
    """
    safe_args: Mapping[str, Any] = args if isinstance(args, Mapping) else {}
    t_name = str(tool_name or "").strip()
    t_lower = t_name.lower()

    try:
        # 1. SAF3: самозащита каталогов установки (`hooks/`, `plugins/`, `node`).
        saf3_verdict = _check_selfprotect_saf3(t_name, safe_args, home=home)
        if saf3_verdict is not None:
            return saf3_verdict

        category_modes = resolve_safety_categories(home=home, settings=settings)

        # 2. Терминальные правила: M-113 (HARDLINE), M-111 (container redirect), M-112 (DANGEROUS), M-119.
        if t_lower == "terminal":
            cmd = safe_args.get("command")
            if isinstance(cmd, str) and cmd.strip():
                term_verdict = _check_terminal_rules(
                    cmd,
                    safe_args,
                    home=home,
                    settings=settings,
                    category_modes=category_modes,
                )
                if term_verdict is not None:
                    return term_verdict
        else:
            # 3. SAF1(в) deny-правила (чтение `.env` и `nomad.guard.deny`) — всегда имеют приоритет.
            saf1_deny = _check_non_terminal_saf1_deny(t_name, safe_args, home=home)
            if saf1_deny is not None:
                return saf1_deny

            # 4. M-119: категории `safety.*` (`browser`, `mcp`, `file_deletion`, `external_file`, `outbound`).
            # Для `mcp_*`: если категория `mcp` не в режиме `block` и не `off`, штатный SAF1(в) ниже
            # вернёт `approve` с ключом `nomad_guard:<tool_name>`.
            if not (fnmatchcase(t_lower, "mcp_*") and category_modes.get("mcp") == "ask"):
                cat_verdict = _check_safety_categories(
                    t_name, safe_args, home=home, settings=settings, modes=category_modes
                )
                if cat_verdict is not None:
                    return cat_verdict

            # 5. SAF1(в) ask-правила (`mcp_* -> ask`, если `safety.mcp != "off"`, и `nomad.guard.ask`).
            saf1_ask = _check_non_terminal_saf1_ask(
                t_name,
                safe_args,
                home=home,
                mcp_category_mode=category_modes.get("mcp", "unset"),
            )
            if saf1_ask is not None:
                return saf1_ask

        # 6. Дополнительные зарегистрированные колбэки политики (fail-closed при исключении).
        for cb in list(_custom_policy_callbacks):
            cb_res = cb(t_name, safe_args, kwargs)
            if isinstance(cb_res, dict) and cb_res.get("action") in {"block", "approve"}:
                return cb_res
    except Exception as exc:
        msg = (
            f"SAF1(в): колбэк политики pre_tool_call выбросил исключение "
            f"({type(exc).__name__}: {exc}) — вызов {t_name!r} заблокирован (fail-closed)."
        )
        logger.error("nomad.guard: %s", msg)
        return {
            "action": "block",
            "block": True,
            "reason": "guard_callback_exception",
            "message": msg,
        }

    return None


# Удобный псевдоним для вызовов в тестах и внешних модулях.
check = evaluate_tool_call


def on_pre_tool_call(
    tool_name: str = "",
    args: Optional[Mapping[str, Any]] = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Unified ``pre_tool_call`` hook callback registered by the Nomad plugin.

    Executes SAF3 + M-113/M-111/M-112 + M-119 + SAF1(в) guards first (fail-closed on any
    exception) and delegates permitted calls to :func:`admission.on_pre_tool_call` so
    card-creation gates and ``ru_only`` admission continue to operate through a single
    hook registration.
    """
    verdict = evaluate_tool_call(tool_name, args, **kwargs)
    if verdict is not None:
        return verdict
    try:
        return admission.on_pre_tool_call(tool_name=tool_name, args=args, **kwargs)
    except Exception as exc:
        msg = (
            f"SAF1(в): обработчик pre_tool_call выбросил исключение "
            f"({type(exc).__name__}: {exc}) — вызов {tool_name!r} заблокирован (fail-closed)."
        )
        logger.error("nomad.guard: %s", msg)
        return {
            "action": "block",
            "block": True,
            "reason": "guard_callback_exception",
            "message": msg,
        }
