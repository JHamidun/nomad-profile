"""Container daemon redirect guard rules (task M-111 / W2-16).

Pointing ``docker`` or ``podman`` at another daemon (``-H`` / ``--host`` / ``-c`` /
``--context`` / ``--remote`` / ``-r`` / ``--url`` / ``--connection``, ``docker context
use|update``, ``podman system connection default|add``, ``DOCKER_HOST=...``,
``DOCKER_CONTEXT=...``, ``CONTAINER_HOST=...``, ``CONTAINER_CONNECTION=...``,
``PODMAN_HOST=...``, ``$env:DOCKER_HOST = ...``) leaves the local machine's sandbox
perimeter and must be gated in ``pre_tool_call``.

Upstream's ``tools/approval_detection.py`` had 5 misses and 2 false positives on the
55-command reference corpus:
- False positive 1: ``docker -h 2>&1 | head -30`` (upstream matched ``-h`` case-insensitively
  as ``--host`` when followed by ``2>&1``). Here ``(?-i:-H)`` is strictly uppercase.
- False positive 2: ``echo "see docker -H in the docs"`` (upstream scanned quoted data
  arguments of ``echo`` without command-position anchoring or data masking).
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any, Optional

# Global flags that can precede -H/--host/-c/--context on the docker/podman CLI
# BEFORE the subcommand. Bounded and anchored so flags AFTER the subcommand
# (`docker run -h buildbox`, `docker run -c 512`, `docker run alpine curl -H ...`)
# are never misclassified as daemon redirects.
_CONTAINER_GLOBAL_FLAGS = (
    r"(?:(?:--tls(?:verify)?|--debug|-(?-i:D)|"
    r"--(?:tlscacert|tlscert|tlskey|config|log-level)(?:=\S+|\s+\S+)|"
    r"-l\s+\S+)\s+)*"
)

# Command-start position (start of string or after shell control operators / wrappers)
# so prose arguments like `echo "see docker -H in the docs"` never match as a command.
_CONTAINER_CMDPOS = (
    r"(?:^|[;&|\n`(]|\$\()"
    r"\s*"
    r"(?:sudo\s+(?:-[^\s]+\s+)*)?"
    r"(?:env\s+(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*)?"
    r"(?:(?:exec|nohup|setsid|time)\s+)*"
    r"\s*"
)

CONTAINER_DAEMON_REDIRECT_PATTERNS: list[tuple[str, str, str]] = [
    (
        _CONTAINER_CMDPOS
        + r"(?:docker|podman)\s+"
        + _CONTAINER_GLOBAL_FLAGS
        + r"(?:(?-i:-H)(?:=\S+|\s+\S+)|--(?:host|url)(?:=\S+|\s+\S+)|--remote\b|-r\b)",
        "point the container client at a different daemon (-H/--host/--url/--remote)",
        "container_remote_host",
    ),
    (
        _CONTAINER_CMDPOS
        + r"(?:docker|podman)\s+"
        + _CONTAINER_GLOBAL_FLAGS
        + r"(?:--(?:context|connection)(?:=\S+|\s+\S+)|-c(?:=\S+|\s+\S+))",
        "switch the container daemon context (--context/-c/--connection)",
        "container_context_flag",
    ),
    (
        _CONTAINER_CMDPOS + r"docker\s+context\s+(?:use|update)\b",
        "repoint the active docker daemon context (docker context use/update)",
        "docker_context_switch",
    ),
    (
        _CONTAINER_CMDPOS + r"podman\s+system\s+connection\s+(?:default|add)\b",
        "repoint the podman daemon connection (podman system connection)",
        "podman_connection_switch",
    ),
    (
        _CONTAINER_CMDPOS
        + r"(?:export\s+|env\s+)?"
        + r"(?:DOCKER_HOST|DOCKER_CONTEXT|CONTAINER_HOST|CONTAINER_CONNECTION|PODMAN_HOST)=\S+",
        "override the container daemon via environment variable (DOCKER_HOST/CONTAINER_HOST/PODMAN_HOST)",
        "container_host_env",
    ),
    (
        r"\$env:(?:DOCKER_HOST|DOCKER_CONTEXT|CONTAINER_HOST|CONTAINER_CONNECTION|PODMAN_HOST)\s*=",
        "override the container daemon via PowerShell $env:DOCKER_HOST / $env:DOCKER_CONTEXT",
        "container_host_env_ps",
    ),
]

COMPILED_CONTAINER_PATTERNS: list[tuple[re.Pattern[str], str, str]] = [
    (re.compile(pattern, re.IGNORECASE | re.DOTALL), description, rule_key)
    for pattern, description, rule_key in CONTAINER_DAEMON_REDIRECT_PATTERNS
]

_DATA_CARRIER_PROGRAMS = frozenset({
    "git", "grep", "egrep", "fgrep", "rg", "findstr", "select-string",
    "echo", "printf",
})

_CODE_INTERPRETER_RE = re.compile(
    r"\b(?:powershell|pwsh|cmd|bash|sh|zsh|ksh|dash|python[23]?|node|perl|"
    r"ruby|iex|invoke-expression|invoke-command|eval|source)\b",
    re.IGNORECASE,
)

_SCRIPT_REDIRECT_RE = re.compile(
    r">>?\s*\S+\.(?:ps1|psm1|bat|cmd|sh|bash|zsh|py|rb|pl|js|vbs)\b",
    re.IGNORECASE,
)

_QUOTED_SPAN_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_GIT_DASH_C_RE = re.compile(r"\bgit\b[^\n]*?\s-c\s+\S+=", re.IGNORECASE)
_ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")


def _normalize_preserving_case(command: str) -> str:
    text = _ANSI_RE.sub("", command).replace("\x00", "")
    text = unicodedata.normalize("NFKC", text)
    text = re.sub(r"\\([^\n])", r"\1", text)
    text = re.sub(r"''|\"\"", "", text)
    return text


def _leading_program(segment: str) -> str:
    stripped = segment.lstrip()
    if not stripped:
        return ""
    token = stripped.split(None, 1)[0]
    token = token.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].lower()
    if token.endswith(".exe"):
        token = token[:-4]
    return token


def _mask_quoted_data_if_safe(command: str) -> str:
    if _CODE_INTERPRETER_RE.search(command) or _SCRIPT_REDIRECT_RE.search(command):
        return command
    prog = _leading_program(command)
    if prog not in _DATA_CARRIER_PROGRAMS:
        return command
    if prog == "git" and _GIT_DASH_C_RE.search(command):
        return command
    return _QUOTED_SPAN_RE.sub(" ", command)


def detect_container_daemon_redirect(
    command: str,
) -> tuple[bool, Optional[str], Optional[str]]:
    """Return ``(is_redirect, reason, rule_key)`` for container daemon redirect commands.

    Preserves case on ``-H`` vs ``-h`` and ``-D`` so ``docker -h`` (help) and
    ``docker run -h hostname`` never false-positive as ``docker -H <daemon>``.
    """
    if not isinstance(command, str) or not command.strip():
        return (False, None, None)

    normalized = _normalize_preserving_case(command)
    scan_target = _mask_quoted_data_if_safe(normalized)

    for pattern_re, description, rule_key in COMPILED_CONTAINER_PATTERNS:
        if pattern_re.search(scan_target):
            return (True, description, rule_key)

    return (False, None, None)


def check_container_daemon_redirect(command: str) -> Optional[dict[str, Any]]:
    """Return a ``guard.py`` directive dict when *command* redirects the container daemon."""
    matched, reason, rule_key = detect_container_daemon_redirect(command)
    if not matched or not reason:
        return None
    msg = f"Container daemon redirect requires approval: {reason}"
    full_key = f"nomad:container:{rule_key or 'daemon_redirect'}"
    return {
        "action": "approve",
        "approve": True,
        "reason": msg,
        "message": msg,
        "rule_key": full_key,
    }
