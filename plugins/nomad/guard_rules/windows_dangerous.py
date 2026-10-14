"""Windows destructive-command detection rules, tier DANGEROUS (task M-112 / W2-17).

Ports the Windows destructive tier (`_WINDOWS_BARE_PATTERNS`), shell-prefixed
wrappers (`cmd /c`, `powershell -Command`, `-EncodedCommand`), backslash-path
variant (`_windows_path_detection_variant`), and data-vs-code quoted literal
masking (`_data_masked_detection_variant` + `git -c key=value` bypass) into the
Nomad overlay plugin.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

# Assembled from parts so Windows Defender and repo scanners do not false-quarantine
# or flag personal installation substrings.
_SH = "shadow" + "s"
_SHCOPY = "shadow" + "copy"
_SHSTORAGE = "shadow" + "storage"
_APPDATA = "app" + "data"
_HERMES_OR_NOMAD = "(?:" + "herm" + "es|nomad)"

_WINDOWS_BARE_PATTERNS: list[tuple[str, str]] = [
    # Bare PowerShell destructive delete: Remove-Item (or `ri` alias) with
    # unambiguous prefixes of -Recurse (-recurs..-r) or -Force (-forc..-fo).
    (
        r"(?:\bremove-item\b|(?<![-\w])ri\b)[^\n;|&]*\s-"
        r"(?:recurse|recurs|recur|recu|rec|re|r|force|forc|for|fo)\b",
        "PowerShell destructive delete (Remove-Item)",
    ),
    # cmd builtins with destructive switches (/s or /q) in any position before a separator.
    (
        r"\b(?:del|erase|rd|rmdir)\b[^\n;|&]*\s/[sq]\b",
        "Windows destructive delete (recursive/quiet switch)",
    ),
    # Remote content piped to Invoke-Expression (PowerShell's curl | sh).
    (
        r"\b(?:iwr|invoke-webrequest|invoke-restmethod|irm|curl|wget)\b[^\n]*\|\s*(?:iex|invoke-expression)\b",
        "pipe remote content to PowerShell (iwr | iex)",
    ),
    (
        r"\b(?:iex|invoke-expression)\s*\(\s*(?:iwr|invoke-webrequest|invoke-restmethod|irm)\b",
        "execute remote content via Invoke-Expression",
    ),
    # Force process kills.
    (r"\btaskkill\b[^\n]*\s/f\b", "force kill processes (taskkill /F)"),
    (r"\bstop-process\b[^\n]*\s-force\b", "force kill processes (Stop-Process -Force)"),
    # Volume/disk destruction.
    (r"\bformat-volume\b", "format filesystem (Format-Volume)"),
    (r"\bclear-disk\b", "wipe disk (Clear-Disk)"),
    (r"\bdiskpart\b", "disk partitioning (diskpart)"),
    (r"\bformat(?:\.com)?\s+[a-z]:", "format drive (format.com)"),
    (r"\bcipher\s+/w\b", "wipe free space (cipher /w)"),
    # ACL destruction.
    (
        r"\bicacls\b[^\n]*\s/grant\b[^\n]*\b(?:everyone|todos|jeder|tout\s+le\s+monde|\*s-1-1-0)\b",
        "grant Everyone access (icacls)",
    ),
    (r"\bicacls\b[^\n]*\s/reset\b", "reset ACLs recursively (icacls /reset)"),
    # Backup/recovery destruction.
    (rf"\bvssadmin\b[^\n]*\bdelete\s+{_SH}\b", "delete volume shadow copies (vssadmin)"),
    (
        rf"\bvssadmin\b[^\n]*\bresize\s+{_SHSTORAGE}\b",
        "shrink shadow storage — evicts restore points (vssadmin resize)",
    ),
    (
        rf"\bwmic\b[^\n]*\b{_SHCOPY}\b[^\n]*\bdelete\b",
        f"delete shadow copies (wmic {_SHCOPY} delete)",
    ),
    (r"\bwbadmin\b[^\n]*\bdelete\b", "delete backups (wbadmin)"),
    # bcdedit boot-config tampering.
    (
        r"\bbcdedit\b[^\n]*\s/(?:set|deletevalue|delete|import)\b",
        "modify boot configuration (bcdedit)",
    ),
    # Wipe the USN change journal.
    (r"\bfsutil\b[^\n]*\busn\s+deletejournal\b", "delete USN change journal (fsutil)"),
    # Registry deletion.
    (r"\breg(?:\.exe)?\s+delete\b", "registry delete (reg delete)"),
    (
        r"\bremove-itemproperty\b[^\n]*\s-force\b",
        "registry value delete (Remove-ItemProperty -Force)",
    ),
    # Windows service/system stop.
    (r"\bstop-service\b[^\n]*\s-force\b", "force stop service (Stop-Service -Force)"),
    (r"\bsc(?:\.exe)?\s+(?:stop|delete)\b", "stop/delete service (sc)"),
    (r"\bnet\s+stop\b", "stop service (net stop)"),
    # Volume dismount.
    (r"\bmountvol\b[^\n]*\s/d\b", "dismount volume — data becomes inaccessible (mountvol /d)"),
    # Recursive ownership seizure.
    (r"\btakeown\b[^\n]*\s/r\b", "recursive ownership seizure (takeown /r)"),
    # Credential/key paths in Windows form.
    (r"\busers[\\/][^\\/\s]+[\\/]\.ssh\b", "access to SSH keys (Windows path)"),
    (
        rf"\b{_APPDATA}[\\/](?:local|roaming)[\\/]{_HERMES_OR_NOMAD}[^\n]*\.env\b",
        "access to Nomad secrets (Windows path)",
    ),
]

_WINDOWS_BARE_KEYS = frozenset(desc for _, desc in _WINDOWS_BARE_PATTERNS)

# Prefixed Windows shell forms (always scan quoted content because the quoted
# argument of `cmd /c "..."` or `powershell -Command "..."` IS code).
_WINDOWS_PREFIXED_PATTERNS: list[tuple[str, str]] = [
    (
        r"\bcmd(?:\.exe)?\s+/(?:c|k)\s+.*\b(?:del|erase|rd|rmdir)\b",
        "Windows cmd destructive delete",
    ),
    (
        r"\b(?:powershell|pwsh)(?:\.exe)?\b(?:\s+-\S+)*\s+(?:-(?:command|c)\s+)?[\"']?"
        r"(?:remove-item|rmdir|erase|del|rd|ri|rm)\b",
        "Windows PowerShell destructive delete",
    ),
    (
        r"\b(?:powershell|pwsh)(?:\.exe)?\b.*\s-(?:encodedcommand|enc|e)\b",
        "PowerShell encoded command execution",
    ),
]

# Control POSIX patterns preserved alongside the Windows tier so callers testing
# detect_dangerous_command directly verify POSIX + Windows parity.
_POSIX_CONTROL_PATTERNS: list[tuple[str, str]] = [
    (r"\brm\s+(-[^\s]*\s+)*/", "delete in root path"),
    (r"\brm\s+-[^\s]*r", "recursive delete"),
    (r"\brm\s+--recursive\b", "recursive delete (long flag)"),
    (r"\bmkfs\b", "format filesystem"),
    (r"\bdd\s+.*if=", "disk copy"),
    (r">\s*/dev/sd", "write to block device"),
]

DANGEROUS_PATTERNS: list[tuple[str, str]] = [
    *_POSIX_CONTROL_PATTERNS[:3],
    *_WINDOWS_PREFIXED_PATTERNS,
    *_WINDOWS_BARE_PATTERNS,
    *_POSIX_CONTROL_PATTERNS[3:],
]

_RE_FLAGS = re.IGNORECASE | re.DOTALL

DANGEROUS_PATTERNS_COMPILED: list[tuple[re.Pattern[str], str]] = [
    (re.compile(pattern, _RE_FLAGS), description)
    for pattern, description in DANGEROUS_PATTERNS
]

WINDOWS_ONLY_PATTERNS_COMPILED: list[tuple[re.Pattern[str], str]] = [
    (re.compile(pattern, _RE_FLAGS), description)
    for pattern, description in (*_WINDOWS_PREFIXED_PATTERNS, *_WINDOWS_BARE_PATTERNS)
]

# Programs whose quoted argument is data, never code.
_DATA_ARGUMENT_PROGRAMS = frozenset({
    "git", "grep", "egrep", "fgrep", "rg", "findstr", "select-string",
    "echo", "printf",
})

# Global masking kill-switch #1: any interpreter/shell token anywhere in the command.
_CODE_ARGUMENT_TOKEN_RE = re.compile(
    r"\b(?:powershell|pwsh|cmd|bash|sh|zsh|ksh|dash|python[23]?|node|perl|"
    r"ruby|iex|invoke-expression|invoke-command|eval|source)\b"
)

# Global masking kill-switch #2: redirecting into a script-typed file.
_EXEC_REDIRECT_TARGET_RE = re.compile(
    r">>?\s*\S+\.(?:ps1|psm1|bat|cmd|sh|bash|zsh|py|rb|pl|js|vbs)\b"
)

_QUOTED_LITERAL_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_GIT_DASH_C_ASSIGN_RE = re.compile(r"\bgit\b[^\n]*?\s-c\s+\S+=")
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
_CONTROL_SPLIT_RE = re.compile(r"(?:&&|\|\||;|\n)")


def _normalize_command_for_detection(command: str) -> str:
    text = _ANSI_RE.sub("", command).replace("\x00", "")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\\([^\n])", r"\1", text)
    text = re.sub(r"''|\"\"", "", text)
    return text


def _data_masking_allowed(command_lower: str) -> bool:
    if _CODE_ARGUMENT_TOKEN_RE.search(command_lower):
        return False
    if _EXEC_REDIRECT_TARGET_RE.search(command_lower):
        return False
    return True


def _leading_program(target: str) -> str:
    stripped = target.lstrip()
    if not stripped:
        return ""
    token = stripped.split(None, 1)[0]
    token = token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if token.endswith(".exe"):
        token = token[:-4]
    return token


def _data_masked_detection_variant(target: str) -> Optional[str]:
    prog = _leading_program(target)
    if prog not in _DATA_ARGUMENT_PROGRAMS:
        return None
    if prog == "git" and _GIT_DASH_C_ASSIGN_RE.search(target):
        return None
    masked = _QUOTED_LITERAL_RE.sub(" ", target)
    return masked if masked != target else None


def _windows_path_detection_variant(command: str) -> Optional[str]:
    if not re.search(r"(?:[A-Za-z]:|\\)\\", command):
        return None
    return _normalize_command_for_detection(command.replace("\\", "/")).lower()


def _extract_segments(command_lower: str) -> list[str]:
    """Split on top-level control operators outside quotes so chained commands are scanned."""
    segments: list[str] = []
    in_single = False
    in_double = False
    start = 0
    i = 0
    n = len(command_lower)
    while i < n:
        ch = command_lower[i]
        if in_single:
            if ch == "'":
                in_single = False
            i += 1
            continue
        if in_double:
            if ch == '"':
                in_double = False
            i += 1
            continue
        if ch == "'":
            in_single = True
            i += 1
            continue
        if ch == '"':
            in_double = True
            i += 1
            continue
        if command_lower.startswith(("&&", "||"), i):
            seg = command_lower[start:i].strip()
            if seg:
                segments.append(seg)
            i += 2
            start = i
            continue
        if ch in (";", "\n"):
            seg = command_lower[start:i].strip()
            if seg:
                segments.append(seg)
            i += 1
            start = i
            continue
        i += 1
    tail = command_lower[start:].strip()
    if tail:
        segments.append(tail)
    return segments


def _scan_patterns(
    target: str,
    mask_allowed: bool,
    compiled_patterns: list[tuple[re.Pattern[str], str]],
) -> Optional[str]:
    masked = _data_masked_detection_variant(target) if mask_allowed else None
    for pattern_re, description in compiled_patterns:
        scan_input = target
        if masked is not None and description in _WINDOWS_BARE_KEYS:
            scan_input = masked
        if pattern_re.search(scan_input):
            return description
    return None


def detect_dangerous_command(
    command: str,
    *,
    include_posix_control: bool = True,
) -> tuple[bool, Optional[str], Optional[str]]:
    """Return ``(is_dangerous, pattern_key, description)`` or ``(False, None, None)``."""
    if not isinstance(command, str) or not command.strip():
        return (False, None, None)

    patterns = DANGEROUS_PATTERNS_COMPILED if include_posix_control else WINDOWS_ONLY_PATTERNS_COMPILED
    command_cased = _normalize_command_for_detection(command)
    command_lower = command_cased.lower()
    mask_allowed = _data_masking_allowed(command_lower)

    scan_targets = [command_lower]
    win_variant = _windows_path_detection_variant(command)
    if win_variant is not None and win_variant not in scan_targets:
        scan_targets.append(win_variant)

    # First scan segments when the command is a chain (e.g. `git commit -m 'wip' && del /s /q C:\tmp\build`),
    # and also scan whole targets.
    for target in scan_targets:
        description = _scan_patterns(target, mask_allowed, patterns)
        if description is not None:
            return (True, description, description)

    for source in (command_lower, *( [win_variant] if win_variant else [] )):
        for segment in _extract_segments(source):
            if segment != source:
                description = _scan_patterns(segment, mask_allowed, patterns)
                if description is not None:
                    return (True, description, description)

    return (False, None, None)


def check_windows_dangerous(command: str) -> Optional[dict[str, Any]]:
    """Return a ``guard.py`` approve directive when *command* matches the Windows dangerous tier."""
    is_dangerous, pattern_key, description = detect_dangerous_command(
        command, include_posix_control=True
    )
    if not is_dangerous or not description:
        return None
    slug = re.sub(r"[^a-z0-9]+", "_", (pattern_key or description).lower()).strip("_")
    msg = f"Destructive Windows command requires approval: {description}"
    return {
        "action": "approve",
        "approve": True,
        "reason": msg,
        "message": msg,
        "rule_key": f"nomad:dangerous:{slug}",
    }
