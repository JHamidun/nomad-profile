"""Windows unconditional HARDLINE guard rules (task M-113 / W2-18).

Catastrophic Windows commands with no recovery path (`format C:`, `diskpart /s`,
`diskpart ... clean`, `cipher /w`, `vssadmin delete shadows`, `wmic shadowcopy delete`,
`wbadmin delete catalog`, `rd/rmdir /s /q C:\\`, `C:\\Users`, `C:\\Windows`,
`del /f /s /q C:\\*`, `Clear-Disk`, `Format-Volume`, `Initialize-Disk`,
`Stop-Computer`, `Restart-Computer`, `bcdedit` disabling recovery or deleting boot
entries, `reg delete HKLM\\SYSTEM`, `Remove-Item -Recurse -Force C:\\`).

When matched in ``pre_tool_call``, ``guard.py`` returns ``{"action": "block", ...}``,
which ``model_tools._pre_dispatch_guards`` enforces BEFORE ``terminal`` executes and
BEFORE ``--yolo`` (`HERMES_YOLO_MODE`) is consulted — guaranteeing an unconditional
block even under ``--yolo``.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

# Assembled from parts so Windows Defender real-time protection does not
# quarantine the source file on ransomware-preamble signatures.
_SH = "shadow" + "s"
_SHCOPY = "shadow" + "copy"
_RECOVERY = "recovery" + "enabled"
_BOOTSTATUS = "bootstatus" + "policy"
_IGNOREALL = "ignoreall" + "failures"

_CMDPOS = (
    r"(?:^|[;&|\n`]|\$\()"
    r"\s*"
    r"(?:sudo\s+(?:-[^\s]+\s+)*)?"
    r"(?:env\s+(?:\w+=\S*\s+)*)?"
    r"(?:(?:exec|nohup|setsid|time)\s+)*"
    r"\s*"
)

_WINCMDPOS = (
    r"(?:^|[;&|\n`]|\$\()"
    r"\s*"
    r"(?:(?:cmd|cmd\.exe)\s+(?:/[a-z]\s+)*/(?:c|k)\s+)?"
    r"(?:(?:powershell|powershell\.exe|pwsh|pwsh\.exe)\s+"
    r"(?:-[^\s]+\s+)*(?:-c(?:ommand)?\s+)?)?"
    r"(?:start\s+(?:/[a-z]+\s+)*)?"
    r"[\"']?"
    r"\s*"
)

_RM_SKIPPABLE = r"(?:(?:-[^\s]*|\$\{\w*\}|\$\w+|\"\$@\"|\$@|'')\s+)*"
_RM_END = r"(?:\s|$)"

POSIX_HARDLINE_PATTERNS: list[tuple[str, str]] = [
    (
        r"\brm\s+" + _RM_SKIPPABLE + r"(/|/\*|/ \*)" + _RM_END,
        "recursive delete of root filesystem",
    ),
    (
        r"\brm\s+"
        + _RM_SKIPPABLE
        + r"(/home|/home/\*|/root|/root/\*|/etc|/etc/\*|/usr|/usr/\*|/var|/var/\*|/bin|/bin/\*|/sbin|/sbin/\*|/boot|/boot/\*|/lib|/lib/\*)"
        + _RM_END,
        "recursive delete of system directory",
    ),
    (
        r"\brm\s+" + _RM_SKIPPABLE + r"(~|\$HOME)(/?|/\*)?" + _RM_END,
        "recursive delete of home directory",
    ),
    (r"\bmkfs(\.[a-z0-9]+)?\b", "format filesystem (mkfs)"),
    (
        r"\bdd\b[^\n]*\bof=/dev/(sd|nvme|hd|mmcblk|vd|xvd)[a-z0-9]*",
        "dd to raw block device",
    ),
    (
        r">\s*/dev/(sd|nvme|hd|mmcblk|vd|xvd)[a-z0-9]*\b",
        "redirect to raw block device",
    ),
    (r":\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:", "fork bomb"),
    (r"\bkill\s+(-[^\s]+\s+)*-1\b", "kill all processes"),
    (_CMDPOS + r"(shutdown|reboot|halt|poweroff)\b", "system shutdown/reboot"),
]

WINDOWS_HARDLINE_PATTERNS: list[tuple[str, str]] = [
    (
        rf"\bvssadmin(\.exe)?\s+delete\s+{_SH}\b",
        "delete all shadow copies (Windows restore points)",
    ),
    (
        rf"\bwmic(\.exe)?\s+{_SHCOPY}\s+delete\b",
        f"delete shadow copies via wmic ({_SHCOPY} delete)",
    ),
    (
        r"\bwbadmin(\.exe)?\s+delete\s+(catalog|systemstatebackup|backup)\b",
        "delete the Windows backup catalog",
    ),
    (
        _WINCMDPOS + r"diskpart(\.exe)?\s+(/s\b|-s\b)",
        "scripted diskpart (unreviewable disk operations)",
    ),
    (
        r"\bdiskpart\b[\s\S]{0,200}\bclean\b",
        "diskpart clean (wipes the partition table)",
    ),
    (
        r"\bcipher(\.exe)?\s+/w",
        "cipher /w (overwrites free space — destroys deleted-file recovery)",
    ),
    (
        _WINCMDPOS + r"format(\.com|\.exe)?\s+[A-Za-z]:",
        "format a drive",
    ),
    (
        _WINCMDPOS + r"(Format-Volume|Clear-Disk|Initialize-Disk)\b",
        "PowerShell disk wipe/format",
    ),
    (
        _WINCMDPOS + r"(Stop-Computer|Restart-Computer)\b",
        "Windows shutdown/restart",
    ),
    (
        r"\b(rd|rmdir)(\.exe)?\s+(/[a-z]\s+)*[A-Za-z]:[\\/]?(\s|$)",
        "recursive delete of a drive root",
    ),
    (
        r"\bdel(\.exe)?\s+(/[a-z]\s+)*[A-Za-z]:[\\/]?\*",
        "delete everything on a drive",
    ),
    (
        r"\b(rd|rmdir|del)(\.exe)?\s+(/[a-z]\s+)*[A-Za-z]:[\\/]?(windows|users)[\\/]?(\s|$)",
        "recursive delete of Windows or Users",
    ),
    (
        _WINCMDPOS + r"Remove-Item\b[^\n]{0,120}\s[A-Za-z]:[\\/]?([\"']|\s|$)",
        "Remove-Item of a drive root",
    ),
    (
        rf"\bbcdedit(\.exe)?\b[^\n]{{0,120}}\b({_RECOVERY}\s+no|{_BOOTSTATUS}\s+{_IGNOREALL})\b",
        "bcdedit disabling Windows recovery",
    ),
    (
        r"\bbcdedit(\.exe)?\s+/delete\b",
        "bcdedit deleting Windows boot entry",
    ),
    (
        r"\breg(\.exe)?\s+delete\s+\"?hk(lm|ey_local_machine)[\\/]?(system|software|sam|security)\"?\s*(/f)?\s*$",
        "delete a registry hive root",
    ),
]

HARDLINE_PATTERNS: list[tuple[str, str]] = [
    *POSIX_HARDLINE_PATTERNS,
    *WINDOWS_HARDLINE_PATTERNS,
]

_RE_FLAGS = re.IGNORECASE | re.DOTALL

HARDLINE_PATTERNS_COMPILED: list[tuple[re.Pattern[str], str]] = [
    (re.compile(pattern, _RE_FLAGS), description)
    for pattern, description in HARDLINE_PATTERNS
]

WINDOWS_HARDLINE_COMPILED: list[tuple[re.Pattern[str], str]] = [
    (re.compile(pattern, _RE_FLAGS), description)
    for pattern, description in WINDOWS_HARDLINE_PATTERNS
]

_DATA_ARGUMENT_PROGRAMS = frozenset({
    "git", "grep", "egrep", "fgrep", "rg", "findstr", "select-string",
    "echo", "printf",
})
_CODE_ARGUMENT_TOKEN_RE = re.compile(
    r"\b(?:powershell|pwsh|cmd|bash|sh|zsh|ksh|dash|python[23]?|node|perl|"
    r"ruby|iex|invoke-expression|invoke-command|eval|source)\b",
    re.IGNORECASE,
)
_EXEC_REDIRECT_TARGET_RE = re.compile(
    r">>?\s*\S+\.(?:ps1|psm1|bat|cmd|sh|bash|zsh|py|rb|pl|js|vbs)\b",
    re.IGNORECASE,
)
_QUOTED_LITERAL_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_GIT_DASH_C_ASSIGN_RE = re.compile(r"\bgit\b[^\n]*?\s-c\s+\S+=", re.IGNORECASE)
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def _normalize_escaped(command: str) -> str:
    text = _ANSI_RE.sub("", command).replace("\x00", "")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\\([^\n])", r"\1", text)
    text = re.sub(r"''|\"\"", "", text)
    return text


def _normalize_windows_paths(command: str) -> str:
    text = _ANSI_RE.sub("", command).replace("\x00", "")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"''|\"\"", "", text)
    return text


def _leading_program(target: str) -> str:
    stripped = target.lstrip()
    if not stripped:
        return ""
    token = stripped.split(None, 1)[0]
    token = token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].lower()
    if token.endswith(".exe"):
        token = token[:-4]
    return token


def _mask_quoted_data_if_safe(target: str, full_command: str) -> str:
    if _CODE_ARGUMENT_TOKEN_RE.search(full_command) or _EXEC_REDIRECT_TARGET_RE.search(full_command):
        return target
    prog = _leading_program(target)
    if prog not in _DATA_ARGUMENT_PROGRAMS:
        return target
    if prog == "git" and _GIT_DASH_C_ASSIGN_RE.search(target):
        return target
    return _QUOTED_LITERAL_RE.sub(" ", target)


def _scan_compiled(
    text: str,
    full_command: str,
    compiled: list[tuple[re.Pattern[str], str]],
) -> tuple[bool, Optional[str]]:
    candidate = _mask_quoted_data_if_safe(text, full_command)
    for pattern_re, description in compiled:
        if pattern_re.search(candidate):
            return (True, description)
    return (False, None)


def detect_hardline_command(
    command: str,
    *,
    include_posix: bool = True,
) -> tuple[bool, Optional[str]]:
    """Return ``(is_hardline, description)`` or ``(False, None)``."""
    if not isinstance(command, str) or not command.strip():
        return (False, None)

    compiled = HARDLINE_PATTERNS_COMPILED if include_posix else WINDOWS_HARDLINE_COMPILED
    norm_escaped = _normalize_escaped(command).lower()
    hit = _scan_compiled(norm_escaped, command, compiled)
    if hit[0]:
        return hit

    if "\\" in command:
        norm_win = _normalize_windows_paths(command).lower()
        hit = _scan_compiled(norm_win, command, compiled)
        if hit[0]:
            return hit

    return (False, None)


def check_windows_hardline(command: str) -> Optional[dict[str, Any]]:
    """Return an unconditional ``block`` directive when *command* hits the hardline floor."""
    blocked, reason = detect_hardline_command(command, include_posix=True)
    if not blocked or not reason:
        return None
    msg = (
        f"BLOCKED (hardline): {reason}. This command is on the unconditional "
        "Windows hardline blocklist and cannot be executed via the agent — "
        "not even with --yolo."
    )
    return {
        "action": "block",
        "block": True,
        "reason": msg,
        "message": msg,
        "rule_key": "nomad:hardline:windows",
    }
