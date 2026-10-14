"""Run ``hermes <argv>`` for ``plugin_api`` screens (task M-128, UI-BE6).

Зачем. Семь экранов интерфейса (Аккаунты, Стоп, Навыки, Безопасность, Данные, Перенос и старт,
Сбои расписания и строка палитры ``slack manifest``) вызывают команды CLI ядра из маршрутов
``plugin_api.py``. Голый ``subprocess`` здесь недопустим по трём причинам:

1. **Профиль (M-090, замер W0-15).** В шлюзе и дашборде активный профиль часто задан контекстным
   переопределением ``hermes_constants.set_hermes_home_override``, а не ``os.environ``. Без явного
   ``HERMES_HOME`` в окружении ребёнка команда молча падает в профиль ``default`` и пишет туда.
   Поэтому окружение всегда собирается через :func:`spawn.child_env`, а запуск идёт через
   :func:`spawn.popen`.
2. **Безопасность и живучесть.** Аргументы передаются только списком строк
   ``[sys.executable, "-m", "hermes_cli.main", *argv]`` — никакого ``shell=True``. Зависший вызов
   ограничен ``timeout``: по истечении времени процесс убивается, дескрипторы закрываются, а
   вызывающий получает структурированный словарь отказа вместо исключения.
3. **Маскировка секретов.** Вывод и текст ошибки проходят через :func:`redact` до возврата из
   функции: ключи ``nmd_…``, ``sk-…``, ``ghp_…``, ``Bearer …``, заголовки авторизации, присваивания
   ``*_API_KEY=…``, поля JSON ``"api_key": "…"`` и значения секретных переменных окружения
   заменяются на ``***`` и никогда не уходят в HTTP-ответ дашборда или десктопа.
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
from collections.abc import Mapping, Sequence
from typing import Any, Optional, Union

from . import spawn

PathLike = Union[str, "os.PathLike[str]"]

DEFAULT_TIMEOUT: float = 60.0
TIMEOUT_CODE: str = "timeout"
MASK: str = "***"

# Префиксы ключей и токенов провайдеров (NomadNet, OpenAI, Anthropic, OpenRouter, GitHub, GitLab,
# Slack, Google, AWS, HuggingFace, Replicate, Stripe, Telegram, JWT и др.).
_TOKEN_PREFIX_PATTERNS: tuple[str, ...] = (
    r"nmd_[A-Za-z0-9_-]{6,}",
    r"sk-[A-Za-z0-9_.-]{8,}",
    r"sk_[A-Za-z0-9_-]{8,}",
    r"rk_(?:live|test)_[A-Za-z0-9_-]{8,}",
    r"pk-lf-[A-Za-z0-9_-]{8,}",
    r"gh[pousr]_[A-Za-z0-9_]{8,}",
    r"github_pat_[A-Za-z0-9_]{8,}",
    r"gl(?:pat|oas|dt|rt|rtr|cbt|ptt|ft|imt|agent|soat|ffct|wt)-[A-Za-z0-9_.-]{8,}",
    r"xox[baprs]-[A-Za-z0-9-]{8,}",
    r"xapp-\d+-[A-Za-z0-9-]{8,}",
    r"AIza[A-Za-z0-9_-]{20,}",
    r"AKIA[A-Z0-9]{16}",
    r"(?:hf|r8|fal|exa|gsk|syt|mem0|brv|ntn|npm)_[A-Za-z0-9_-]{8,}",
    r"(?:pplx|fc|tvly|hsk|xai|pypi)-[A-Za-z0-9_-]{8,}",
    r"fw[-_][A-Za-z0-9_-]{12,}",
    r"fpk_[A-Za-z0-9_-]{12,}",
    r"do[po]_v1_[A-Za-z0-9_-]{8,}",
    r"bb_live_[A-Za-z0-9_-]{8,}",
    r"SG\.[A-Za-z0-9_.-]{10,}",
    r"eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_.-]{8,}",
    r"(?<!\d)(?:bot)?\d{8,}:[A-Za-z0-9_-]{30,}",
)

_TOKEN_PREFIX_RE = re.compile(
    r"(?<![A-Za-z0-9_-])(?:" + "|".join(_TOKEN_PREFIX_PATTERNS) + r")(?![A-Za-z0-9_-])"
)

_PRIVATE_KEY_BLOCK_RE = re.compile(
    r"-----BEGIN[A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z0-9 ]*PRIVATE KEY-----"
)

_AUTH_HEADER_RE = re.compile(
    r"((?:Proxy-)?Authorization\s*:\s*)(?:(Bearer|Basic|Token|Digest)\s+)?([^\s\"',;}\]]+)",
    re.IGNORECASE,
)

_BEARER_RE = re.compile(
    r"(\b(?:Bearer|Basic)\s+)([A-Za-z0-9._~+/=-]{6,})",
    re.IGNORECASE,
)

_SECRET_HEADER_RE = re.compile(
    r"(\b(?:x-api-key|x-goog-api-key|api-key|apikey|x-api-token|x-auth-token|x-access-token)\s*:\s*)"
    r"([^\s\"',;}\]]+)",
    re.IGNORECASE,
)

_JSON_SECRET_FIELD_RE = re.compile(
    r'("(?:api_?key|access_token|refresh_token|id_token|auth_token|client_secret|private_key'
    r'|password|passwd|secret|bearer)"\s*:\s*")([^"]+)(")',
    re.IGNORECASE,
)

_ENV_ASSIGN_RE = re.compile(
    r"(\b[A-Za-z0-9_]*(?:API_?KEY|ACCESS_KEY|SECRET_KEY|PRIVATE_KEY|LICENSE_KEY|AUTH_TOKEN"
    r"|ACCESS_TOKEN|REFRESH_TOKEN|ID_TOKEN|CLIENT_SECRET|PASSWORD|PASSWD|CREDENTIAL|SECRET|TOKEN)"
    r"[A-Za-z0-9_]*\s*=\s*)(['\"]?)([^\s'\",;}\]]+)\2",
    re.IGNORECASE,
)

_CLI_FLAG_SECRET_RE = re.compile(
    r"(--(?:api-key|token|secret|password|client-secret)(?:\s+|\s*=\s*))(['\"]?)([^\s'\"]+)\2",
    re.IGNORECASE,
)

_SECRET_ENV_SUFFIXES: tuple[str, ...] = (
    "_API_KEY",
    "_ACCESS_KEY",
    "_SECRET_KEY",
    "_PRIVATE_KEY",
    "_LICENSE_KEY",
    "_TOKEN",
    "_SECRET",
    "_PASSWORD",
    "_PASSWD",
    "_CREDENTIAL",
)
_SECRET_ENV_EXACT: frozenset[str] = frozenset({
    "API_KEY",
    "TOKEN",
    "SECRET",
    "PASSWORD",
    "PASSWD",
    "CREDENTIAL",
})
_NON_SECRET_ENV_SUFFIXES: tuple[str, ...] = (
    "_URL",
    "_HOST",
    "_PORT",
    "_USER",
    "_ID",
    "_DIR",
    "_PATH",
    "_HOME",
    "_FILE",
    "_MODE",
    "_NAME",
    "_TYPE",
    "_COUNT",
    "_LIMIT",
    "_TIMEOUT",
)
_BENIGN_VALUES: frozenset[str] = frozenset({
    "true",
    "false",
    "null",
    "none",
    "unknown",
    "default",
    "nomad",
    "localhost",
    "***",
})


def _is_secret_env_name(name: str) -> bool:
    upper = name.strip().upper()
    if not upper or upper.endswith(_NON_SECRET_ENV_SUFFIXES):
        return False
    return upper in _SECRET_ENV_EXACT or upper.endswith(_SECRET_ENV_SUFFIXES)


def _secret_env_values(env: Optional[Mapping[str, str]]) -> list[str]:
    source = os.environ if env is None else env
    values: set[str] = set()
    for key, raw in source.items():
        if not isinstance(key, str) or not isinstance(raw, str):
            continue
        if not _is_secret_env_name(key):
            continue
        val = raw.strip()
        if len(val) < 8 or val.lower() in _BENIGN_VALUES:
            continue
        if any(ch.isspace() for ch in val) or "/" in val or "\\" in val:
            continue
        if val.startswith("${") and val.endswith("}"):
            continue
        values.add(val)
    return sorted(values, key=len, reverse=True)


def _replace_auth_header(match: re.Match[str]) -> str:
    prefix, scheme, _ = match.groups()
    if scheme:
        return f"{prefix}{scheme} {MASK}"
    return f"{prefix}{MASK}"


def _replace_env_assign(match: re.Match[str]) -> str:
    prefix, quote, value = match.groups()
    if value.startswith("${") and value.endswith("}"):
        return match.group(0)
    return f"{prefix}{quote}{MASK}{quote}"


def redact(text: str, *, env: Optional[Mapping[str, str]] = None) -> str:
    """Mask API keys, tokens, auth headers, and secret env values in *text*."""
    if not text:
        return ""
    if not isinstance(text, str):
        text = str(text)

    out = _PRIVATE_KEY_BLOCK_RE.sub(MASK, text)
    out = _AUTH_HEADER_RE.sub(_replace_auth_header, out)
    out = _BEARER_RE.sub(rf"\1{MASK}", out)
    out = _SECRET_HEADER_RE.sub(rf"\1{MASK}", out)
    out = _CLI_FLAG_SECRET_RE.sub(rf"\1\2{MASK}\2", out)
    out = _JSON_SECRET_FIELD_RE.sub(rf"\1{MASK}\3", out)
    out = _ENV_ASSIGN_RE.sub(_replace_env_assign, out)
    out = _TOKEN_PREFIX_RE.sub(MASK, out)

    for secret_val in _secret_env_values(env):
        if secret_val in out:
            out = out.replace(secret_val, MASK)
    return out


redact_secrets = redact
mask_secrets = redact


def _resolve_home(home: Optional[PathLike], hermes_home: Optional[PathLike]) -> Optional[PathLike]:
    if home is not None and hermes_home is not None and str(home) != str(hermes_home):
        raise ValueError("Specify at most one of 'home' or 'hermes_home'")
    return home if home is not None else hermes_home


def _validate_argv(argv: Sequence[str]) -> list[str]:
    if isinstance(argv, (str, bytes)) or not isinstance(argv, Sequence):
        raise TypeError("argv must be a sequence of strings, not a single string or non-sequence")
    items = list(argv)
    if not items:
        raise ValueError("argv must not be empty")
    for item in items:
        if not isinstance(item, str):
            raise TypeError(f"every argv item must be a str, got {type(item).__name__}")
    return items


def hermes_command(argv: Sequence[str]) -> list[str]:
    """Build the argument list ``[sys.executable, '-m', 'hermes_cli.main', *argv]`` (never shell)."""
    return [sys.executable, "-m", "hermes_cli.main", *_validate_argv(argv)]



def build_env(
    env: Optional[Mapping[str, str]] = None,
    *,
    home: Optional[PathLike] = None,
    hermes_home: Optional[PathLike] = None,
    extra_env: Optional[Mapping[str, str]] = None,
) -> dict[str, str]:
    """Construct the child environment with explicit ``HERMES_HOME`` via :func:`spawn.child_env`."""
    target_home = _resolve_home(home, hermes_home)
    base: dict[str, str] = dict(os.environ if env is None else env)
    if extra_env:
        base.update(extra_env)
    child = spawn.child_env(base, hermes_home=target_home)
    child.setdefault("HERMES_NO_UPDATE_CHECK", "1")
    child.setdefault("PYTHONUTF8", "1")
    child.setdefault("PYTHONIOENCODING", "utf-8")
    child.setdefault("PYTHONDONTWRITEBYTECODE", "1")
    return child


def _combine_message(primary: str, secondary: str, *, default: str) -> str:
    p = primary.strip()
    s = secondary.strip()
    if p and s and p != s:
        return f"{p}\n{s}"
    return p or s or default


def _mask_argv(argv: Sequence[str], *, env: Optional[Mapping[str, str]] = None) -> list[str]:
    masked = redact(" ".join(argv), env=env)
    items: list[str] = []
    redact_next = False
    for arg in argv:
        if redact_next:
            items.append(MASK)
            redact_next = False
            continue
        if arg.lower() in {"--api-key", "--token", "--secret", "--password", "--client-secret"}:
            items.append(arg)
            redact_next = True
            continue
        items.append(redact(arg, env=env))
    _ = masked
    return items


def run_hermes(
    argv: Sequence[str],
    *,
    home: Optional[PathLike] = None,
    hermes_home: Optional[PathLike] = None,
    timeout: float = DEFAULT_TIMEOUT,
    input_text: Optional[str] = None,
    env: Optional[Mapping[str, str]] = None,
    extra_env: Optional[Mapping[str, str]] = None,
    cwd: Optional[PathLike] = None,
) -> dict[str, Any]:
    """Run ``hermes <argv>`` in a child process with explicit ``HERMES_HOME``, timeout, and redaction.

    Returns a dictionary:

    * on exit 0: ``{"ok": True, "code": 0, "exit_code": 0, "returncode": 0, "timed_out": False,
      "stdout": ..., "stderr": ..., "message": ..., "argv": [...]}``;
    * on non-zero exit: ``{"ok": False, "code": <int>, "exit_code": <int>, "returncode": <int>,
      "timed_out": False, "stdout": ..., "stderr": ..., "message": ..., "argv": [...]}``;
    * on timeout: ``{"ok": False, "code": "timeout", "exit_code": None, "returncode": None,
      "timed_out": True, "stdout": ..., "stderr": ..., "message": ..., "argv": [...]}``.
    """
    items = _validate_argv(argv)
    cmd = hermes_command(items)
    if timeout is None or timeout < 0:
        raise ValueError("timeout must be a non-negative number")

    child_env = build_env(env, home=home, hermes_home=hermes_home, extra_env=extra_env)
    explicit_home = child_env[spawn.ENV_NAME]
    safe_argv = _mask_argv(items, env=child_env)

    with spawn.popen(
        cmd,
        env=child_env,
        hermes_home=explicit_home,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
        cwd=cwd,
    ) as proc:
        try:
            raw_out, raw_err = proc.communicate(input=input_text, timeout=float(timeout))
        except subprocess.TimeoutExpired as exc:
            proc.kill()
            try:
                tail_out, tail_err = proc.communicate(timeout=5.0)
            except Exception:
                tail_out, tail_err = "", ""
            partial_out = (
                (exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or ""))
                + (tail_out or "")
            )
            partial_err = (
                (exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or ""))
                + (tail_err or "")
            )
            masked_out = redact(partial_out, env=child_env)
            masked_err = redact(partial_err, env=child_env)
            timeout_note = f"hermes {' '.join(safe_argv)} timed out after {timeout:g}s"
            detail = _combine_message(masked_err, masked_out, default="")
            message = f"{timeout_note}: {detail}" if detail else timeout_note
            return {
                "ok": False,
                "code": TIMEOUT_CODE,
                "exit_code": None,
                "returncode": None,
                "timed_out": True,
                "stdout": masked_out,
                "stderr": masked_err,
                "message": message,
                "argv": safe_argv,
            }

        rc = proc.returncode

    masked_out = redact(raw_out or "", env=child_env)
    masked_err = redact(raw_err or "", env=child_env)
    if rc == 0:
        return {
            "ok": True,
            "code": 0,
            "exit_code": 0,
            "returncode": 0,
            "timed_out": False,
            "stdout": masked_out,
            "stderr": masked_err,
            "message": _combine_message(masked_out, masked_err, default=""),
            "argv": safe_argv,
        }

    default_err = f"hermes {' '.join(safe_argv)} exited with code {rc}"
    return {
        "ok": False,
        "code": rc,
        "exit_code": rc,
        "returncode": rc,
        "timed_out": False,
        "stdout": masked_out,
        "stderr": masked_err,
        "message": _combine_message(masked_err, masked_out, default=default_err),
        "argv": safe_argv,
    }
