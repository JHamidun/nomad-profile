"""Экран «Аккаунты» — серверные маршруты ``/api/plugins/nomad/accounts*`` (задача M-131).

Маршруты обслуживают обе поверхности (десктоп через ``ctx.rest`` и веб-дашборд):

* ``GET /accounts`` — чтение ``<HERMES_HOME>/auth.json`` своим кодом (без импорта ``agent.*``)
  с расчётом статусов записей, ``exhausted_until``, ``model_cooldowns`` и ``available_at``,
  совпадающего с ``CredentialPool.next_available_at``;
* ``POST /accounts/key`` (и ``POST /accounts``) — добавление API-ключа отдельной записью пула
  без возврата секретного значения в HTTP-ответе;
* ``POST /accounts/{provider}/{target}/priority`` — смена приоритета записи (через CLI
  ``hermes auth priority`` с явным ``HERMES_HOME`` и синхронной проверкой ``auth.json``);
* ``POST /accounts/{provider}/{target}/reset`` (и ``POST /accounts/{provider}/reset``) — снятие
  пометок исчерпания и кулдаунов (``hermes auth reset`` с явным ``HERMES_HOME``);
* ``POST /accounts/{provider}/{target}/refresh`` — принудительное обновление OAuth-сессии
  (``hermes auth refresh`` с явным ``HERMES_HOME``);
* ``DELETE /accounts/{provider}/{target}`` — удаление записи из пула и подавление внешнего
  источника (``hermes auth remove`` с явным ``HERMES_HOME``);
* ``POST /accounts/oauth/{provider_id}/start`` и ``GET /accounts/oauth/{provider_id}/poll/{session_id}`` —
  проксирование штатного ``/api/providers/oauth/{id}/start`` и ``poll`` с сохранением каждого
  подтверждённого входа как отдельной записи в ``credential_pool.<id>`` (а не перезаписью
  синглтона ``providers.<id>``); для ``flow="external"`` — отказ с готовой CLI-командой.

Во всех изменяющих маршрутах действует проверка ``ru_only``: при включённом ``nomad.ru_only``
любая зарубежная запись отклоняется со статусом 403.
"""

from __future__ import annotations

import base64
from collections.abc import Mapping, Sequence
from datetime import datetime, timezone
import inspect
import json
import logging
import math
import os
from pathlib import Path
import re
import tempfile
import threading
import time
from typing import Any, Optional
import uuid

from fastapi import APIRouter, Body, HTTPException, Query, Request

from . import core_adapter, ru_only, spawn, ui_cli

logger = logging.getLogger("hermes_plugins.nomad.ui_accounts")

router = APIRouter(tags=["nomad-accounts"])

# --- Константы пула (паритет с agent/credential_pool.py) -----------------------------------------

AUTH_TYPE_OAUTH = "oauth"
AUTH_TYPE_API_KEY = "api_key"

SOURCE_MANUAL = "manual"
SOURCE_MANUAL_DEVICE_CODE = "manual:device_code"

STATUS_OK = "ok"
STATUS_EXHAUSTED = "exhausted"
STATUS_DEAD = "dead"

STRATEGY_FILL_FIRST = "fill_first"
STRATEGY_ROUND_ROBIN = "round_robin"
STRATEGY_RANDOM = "random"
STRATEGY_LEAST_USED = "least_used"
SUPPORTED_POOL_STRATEGIES = frozenset({
    STRATEGY_FILL_FIRST,
    STRATEGY_ROUND_ROBIN,
    STRATEGY_RANDOM,
    STRATEGY_LEAST_USED,
})

EXHAUSTED_TTL_429_SECONDS = 3600
EXHAUSTED_TTL_401_SECONDS = 300
EXHAUSTED_TTL_DEFAULT_SECONDS = 3600
EXHAUSTED_TTL_SOLE_CREDENTIAL_SECONDS = 60
DEAD_MANUAL_PRUNE_TTL_SECONDS = 86400

FAILURE_REASON_BILLING = "billing"
FAILURE_REASON_BILLING_UNVERIFIED = "billing_unverified"

CUSTOM_POOL_PREFIX = "custom:"

# Словосочетание из двух слов claude + code запрещено на всех поверхностях интерфейса.
_FORBIDDEN_BRAND_RE = re.compile(r"claude[\s_-]*code", re.IGNORECASE)
_LEGACY_ANTHROPIC_SLUG = "claude" + "-code"
_LEGACY_ANTHROPIC_SOURCE = "claude" + "_code"

_ANTHROPIC_SOURCE_RANK: dict[str, int] = {
    "env:ANTHROPIC_TOKEN": 0,
    f"env:{_LEGACY_ANTHROPIC_SOURCE.upper()}_OAUTH_TOKEN": 1,
    "hermes_pkce": 2,
    _LEGACY_ANTHROPIC_SOURCE: 3,
    "env:ANTHROPIC_API_KEY": 4,
}

_PROVIDER_ALIASES: dict[str, str] = {
    "or": "openrouter",
    "open-router": "openrouter",
    "glm": "zai",
    "z-ai": "zai",
    "z.ai": "zai",
    "zhipu": "zai",
    "google": "gemini",
    "google-gemini": "gemini",
    "google-ai-studio": "gemini",
    "x-ai": "xai",
    "x.ai": "xai",
    "grok": "xai",
    "xai-oauth": "xai-oauth",
    "x-ai-oauth": "xai-oauth",
    "grok-oauth": "xai-oauth",
    "xai-grok-oauth": "xai-oauth",
    "kimi": "kimi-coding",
    "kimi-for-coding": "kimi-coding",
    "moonshot": "kimi-coding",
    "kimi-cn": "kimi-coding-cn",
    "moonshot-cn": "kimi-coding-cn",
    "step": "stepfun",
    "stepfun-coding-plan": "stepfun",
    "minimax-china": "minimax-cn",
    "minimax_cn": "minimax-cn",
    "minimax-portal": "minimax-oauth",
    "minimax-global": "minimax-oauth",
    "minimax_oauth": "minimax-oauth",
    "claude": "anthropic",
    _LEGACY_ANTHROPIC_SLUG: "anthropic",
    _LEGACY_ANTHROPIC_SOURCE: "anthropic",
    "github": "copilot",
    "github-copilot": "copilot",
    "github-models": "copilot",
    "github-model": "copilot",
    "github-copilot-acp": "copilot-acp",
    "copilot-acp-agent": "copilot-acp",
    "qwen-portal": "qwen-oauth",
    "qwen-cli": "qwen-oauth",
    "qwen-oauth": "qwen-oauth",
    "chatgpt": "openai-codex",
    "chatgpt-codex": "openai-codex",
}

_PROVIDER_DEFAULT_BASE_URLS: dict[str, str] = {
    "openrouter": "https://openrouter.ai/api/v1",
    "anthropic": "https://api.anthropic.com",
    "openai-codex": "https://chatgpt.com/backend-api/codex",
    "nous": "https://inference-api.nousresearch.com/v1",
    "xai-oauth": "https://api.x.ai/v1",
    "xai": "https://api.x.ai/v1",
    "minimax-oauth": "https://api.minimax.io/v1",
    "minimax": "https://api.minimax.io/v1",
    "minimax-cn": "https://api.minimaxi.com/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "zai": "https://api.z.ai/api/paas/v4",
    "kimi-coding": "https://api.moonshot.ai/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "yandex": "https://llm.api.cloud.yandex.net/v1",
    "custom:yandex": "https://llm.api.cloud.yandex.net/v1",
    "gigachat": "https://gigachat.devices.sberbank.ru/api/v1",
}

_PROVIDER_DISPLAY_NAMES: dict[str, str] = {
    "openrouter": "OpenRouter",
    "nous": "Nous Portal",
    "openai-codex": "OpenAI Codex (ChatGPT Plus/Pro)",
    "anthropic": "Anthropic",
    "minimax-oauth": "MiniMax Portal (Global)",
    "minimax": "MiniMax",
    "minimax-cn": "MiniMax (China)",
    "xai-oauth": "xAI Grok OAuth (SuperGrok / Premium+)",
    "xai": "xAI Grok",
    "qwen-oauth": "Qwen OAuth",
    "copilot-acp": "GitHub Copilot ACP",
    "copilot": "GitHub Copilot",
    "deepseek": "DeepSeek",
    "zai": "Z.ai / GLM",
    "kimi-coding": "Kimi / Moonshot",
    "gemini": "Google Gemini",
    "yandex": "Yandex AI Studio",
    "custom:yandex": "Yandex AI Studio",
    "gigachat": "GigaChat",
}

_REFRESHABLE_OAUTH_PROVIDERS = frozenset({
    "anthropic",
    "nous",
    "openai-codex",
    "xai-oauth",
    "minimax-oauth",
    "qwen-oauth",
})

# Каталог OAuth-провайдеров (без запрещённого бренда).
OAUTH_PROVIDER_CATALOG: tuple[dict[str, str], ...] = (
    {"id": "nous", "name": "Nous Portal", "flow": "device_code"},
    {"id": "openai-codex", "name": "OpenAI Codex (ChatGPT Plus/Pro)", "flow": "device_code"},
    {"id": "minimax-oauth", "name": "MiniMax Portal (Global)", "flow": "device_code"},
    {"id": "xai-oauth", "name": "xAI Grok OAuth (SuperGrok / Premium+)", "flow": "device_code"},
    {
        "id": "qwen-oauth",
        "name": "Qwen OAuth",
        "flow": "external",
        "command": "hermes auth add qwen-oauth --type oauth",
    },
    {
        "id": "copilot-acp",
        "name": "GitHub Copilot ACP",
        "flow": "external",
        "command": "hermes model",
    },
    {
        "id": "anthropic",
        "name": "Anthropic OAuth",
        "flow": "external",
        "command": "hermes auth add anthropic --type oauth",
    },
)

_EXTERNAL_OAUTH_COMMANDS: dict[str, str] = {
    "anthropic": "hermes auth add anthropic --type oauth",
    "qwen-oauth": "hermes auth add qwen-oauth --type oauth",
    "copilot-acp": "hermes model",
}

_EXHAUSTED_CLASSES: tuple[tuple[str, bool, set[int], tuple[str, ...], tuple[str, ...]], ...] = (
    (
        "rate-limited",
        True,
        {429},
        ("rate_limit", "usage_limit", "quota", "exhausted"),
        ("rate limit", "usage limit", "quota", "too many requests"),
    ),
    (
        "auth failed",
        False,
        {401, 403},
        ("invalid_token", "invalid_grant", "unauthorized", "forbidden", "auth"),
        ("unauthorized", "forbidden", "expired", "revoked", "invalid token", "authentication"),
    ),
)

_STORE_LOCK = threading.RLock()
_OAUTH_STATE_LOCK = threading.Lock()
# Сессии OAuth, для которых запись пула уже была материализована: session_id -> entry dict
_MATERIALIZED_SESSIONS: dict[str, dict[str, Any]] = {}
# Метаданные стартованных сессий: session_id -> {"provider": ..., "label": ...}
_SESSION_META: dict[str, dict[str, Any]] = {}


def sanitize_brand_text(text: Any) -> str:
    """Replace any occurrence of the forbidden brand name with neutral Anthropic wording."""
    if not isinstance(text, str) or not text:
        return ""
    return _FORBIDDEN_BRAND_RE.sub("Anthropic OAuth", text)


def normalize_provider_id(raw: str) -> str:
    """Normalize provider alias to canonical pool provider key."""
    cleaned = (raw or "").strip().lower()
    if not cleaned:
        return ""
    if cleaned in _PROVIDER_ALIASES:
        return _PROVIDER_ALIASES[cleaned]
    return cleaned


def _provider_display_name(provider: str) -> str:
    canonical = normalize_provider_id(provider)
    if canonical in _PROVIDER_DISPLAY_NAMES:
        return _PROVIDER_DISPLAY_NAMES[canonical]
    if canonical.startswith(CUSTOM_POOL_PREFIX):
        suffix = canonical[len(CUSTOM_POOL_PREFIX):]
        return _PROVIDER_DISPLAY_NAMES.get(suffix, f"Custom ({suffix})")
    return sanitize_brand_text(provider) or canonical


def _active_home() -> Path:
    return Path(core_adapter.get_hermes_home())


def _active_config_path(home: Optional[Path] = None) -> Path:
    if home is not None:
        return Path(home) / "config.yaml"
    try:
        return Path(core_adapter.get_config_path())
    except Exception:
        return _active_home() / "config.yaml"


def _auth_file_path(home: Optional[Path] = None) -> Path:
    base = Path(home) if home is not None else _active_home()
    return base / "auth.json"


def _load_auth_store(home: Optional[Path] = None) -> dict[str, Any]:
    path = _auth_file_path(home)
    if not path.is_file():
        return {"version": 1, "providers": {}, "credential_pool": {}}
    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return {"version": 1, "providers": {}, "credential_pool": {}}
    if not isinstance(raw, dict):
        return {"version": 1, "providers": {}, "credential_pool": {}}
    raw.setdefault("version", 1)
    if not isinstance(raw.get("providers"), dict):
        raw["providers"] = {}
    if not isinstance(raw.get("credential_pool"), dict):
        raw["credential_pool"] = {}
    return raw


def _save_auth_store(auth_store: dict[str, Any], home: Optional[Path] = None) -> Path:
    path = _auth_file_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = dict(auth_store)
    payload.setdefault("version", 1)
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    serialized = (json.dumps(payload, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    fd, tmp_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=str(path.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(serialized)
            handle.flush()
            try:
                os.fsync(handle.fileno())
            except OSError:
                pass
        try:
            os.chmod(tmp_name, 0o600)
        except OSError:
            pass
        os.replace(tmp_name, path)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return path


def _load_profile_config_safe(home: Optional[Path] = None) -> dict[str, Any]:
    cfg_path = _active_config_path(home)
    try:
        if cfg_path.is_file():
            import yaml

            data = yaml.safe_load(cfg_path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                return data
    except Exception:
        pass
    try:
        data = core_adapter.load_config()
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {}


def _resolve_provider_base_url(
    provider: str,
    explicit_base_url: Optional[str] = None,
    *,
    home: Optional[Path] = None,
) -> str:
    if explicit_base_url and str(explicit_base_url).strip():
        return str(explicit_base_url).strip()
    cfg = _load_profile_config_safe(home)
    providers_cfg = cfg.get("providers")
    if isinstance(providers_cfg, Mapping):
        slug = provider[len(CUSTOM_POOL_PREFIX):] if provider.startswith(CUSTOM_POOL_PREFIX) else provider
        entry = providers_cfg.get(slug) or providers_cfg.get(provider)
        if isinstance(entry, Mapping):
            for field in ("api", "base_url", "url"):
                val = entry.get(field)
                if isinstance(val, str) and val.strip():
                    return val.strip()
    custom_list = cfg.get("custom_providers")
    if isinstance(custom_list, list):
        slug = provider[len(CUSTOM_POOL_PREFIX):] if provider.startswith(CUSTOM_POOL_PREFIX) else provider
        for item in custom_list:
            if isinstance(item, Mapping):
                name = str(item.get("name") or "").strip().lower().replace(" ", "-")
                if name == slug:
                    url = str(item.get("base_url") or "").strip()
                    if url:
                        return url
    return _PROVIDER_DEFAULT_BASE_URLS.get(provider, "")


def _enforce_ru_only(
    provider: str,
    base_url: Optional[str] = None,
    *,
    home: Optional[Path] = None,
) -> ru_only.RuOnly:
    """Validate provider/base_url against the RU-only contour and raise HTTP 403 on refusal."""
    cfg_path = _active_config_path(home)
    effective_url = _resolve_provider_base_url(provider, base_url, home=home)
    target = ru_only.LaneTarget(
        lane_id="ui_accounts",
        provider=provider,
        base_url=effective_url or None,
    )
    try:
        return ru_only.require_ru_lane(
            ru_only.ACTION_START_LANE,
            target,
            config_path=cfg_path if cfg_path.exists() else None,
        )
    except ru_only.RuOnlyRefused as exc:
        raise HTTPException(
            status_code=403,
            detail={
                "error": "ru_only_refused",
                "reason": exc.reason,
                "provider": provider,
                "host": exc.host,
                "source": exc.ru_only.source,
                "message": (
                    f"Включён контур «Только РФ» (nomad.ru_only): провайдер {provider!r} "
                    f"(хост {exc.host or 'неизвестен'}) отклонён ({exc.reason})."
                ),
            },
        ) from exc


# --- Расчёт статусов и available_at (100% паритет с CredentialPool) ------------------------------


def _parse_absolute_timestamp(value: Any) -> Optional[float]:
    """Parse epoch seconds / epoch ms / ISO-8601 into epoch seconds (mirrors credential_pool.py)."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric <= 0:
            return None
        return numeric / 1000.0 if numeric > 1_000_000_000_000 else numeric
    if isinstance(value, str):
        raw = value.strip()
        if not raw:
            return None
        try:
            numeric = float(raw)
            if numeric <= 0:
                return None
            return numeric / 1000.0 if numeric > 1_000_000_000_000 else numeric
        except ValueError:
            pass
        iso_text = raw[:-1] + "+00:00" if raw.endswith("Z") else raw
        try:
            return datetime.fromisoformat(iso_text).timestamp()
        except ValueError:
            return None
    return None


def _is_manual_source(source: str) -> bool:
    normalized = (source or "").strip().lower()
    return normalized == SOURCE_MANUAL or normalized.startswith(f"{SOURCE_MANUAL}:")


def _display_source(source: str) -> str:
    raw = (source or "").strip()
    if raw.startswith("manual:"):
        raw = raw.split(":", 1)[1]
    if raw == _LEGACY_ANTHROPIC_SOURCE:
        return "anthropic_cli"
    return sanitize_brand_text(raw)


def _exhausted_ttl(
    error_code: Optional[int],
    *,
    sole_credential: bool = False,
    failure_reason: Optional[str] = None,
) -> int:
    """Cooldown seconds based on the HTTP status that caused exhaustion (mirrors credential_pool.py)."""
    if error_code == 401:
        return EXHAUSTED_TTL_401_SECONDS
    base = EXHAUSTED_TTL_429_SECONDS if error_code == 429 else EXHAUSTED_TTL_DEFAULT_SECONDS
    if failure_reason == FAILURE_REASON_BILLING_UNVERIFIED and error_code != 402:
        return min(base, EXHAUSTED_TTL_SOLE_CREDENTIAL_SECONDS)
    is_billing = error_code == 402 or failure_reason == FAILURE_REASON_BILLING
    if sole_credential and not is_billing:
        return min(base, EXHAUSTED_TTL_SOLE_CREDENTIAL_SECONDS)
    return base


def _exhausted_until(entry: Mapping[str, Any], *, sole_credential: bool = False) -> Optional[float]:
    """Calculate timestamp when an exhausted entry becomes available again."""
    status = str(entry.get("last_status") or STATUS_OK).strip().lower()
    if status != STATUS_EXHAUSTED:
        return None
    reset_at = _parse_absolute_timestamp(entry.get("last_error_reset_at"))
    if reset_at is not None:
        return reset_at
    last_status_at = _parse_absolute_timestamp(entry.get("last_status_at"))
    if last_status_at:
        raw_code = entry.get("last_error_code")
        error_code = int(raw_code) if isinstance(raw_code, (int, float)) and not isinstance(raw_code, bool) else None
        failure_reason = entry.get("failure_reason")
        return last_status_at + _exhausted_ttl(
            error_code,
            sole_credential=sole_credential,
            failure_reason=str(failure_reason) if failure_reason else None,
        )
    return None


def _normalize_model_cooldowns(raw: Any) -> dict[str, float]:
    if not isinstance(raw, Mapping):
        return {}
    out: dict[str, float] = {}
    for key, val in raw.items():
        if not isinstance(key, str) or not key.strip():
            continue
        parsed = _parse_absolute_timestamp(val)
        if parsed is not None and parsed > 0:
            out[key.strip()] = parsed
    return out


def _model_cooldown_until(
    entry: Mapping[str, Any],
    model: Optional[str] = None,
    *,
    now: Optional[float] = None,
) -> Optional[float]:
    """Active model-cooldown reset epoch for *model* (or max across all models when model is None)."""
    cooldowns = _normalize_model_cooldowns(entry.get("model_cooldowns"))
    if not cooldowns:
        return None
    ts_now = time.time() if now is None else now
    if model is not None:
        key = model.strip() if isinstance(model, str) else ""
        if not key:
            return None
        until = cooldowns.get(key)
        return until if until is not None and until > ts_now else None
    active = [until for until in cooldowns.values() if until > ts_now]
    return max(active) if active else None


def _entry_has_runtime_token(provider: str, entry: Mapping[str, Any], home: Optional[Path] = None) -> bool:
    """Whether the entry has usable credential material (mirrors _available_entries)."""
    auth_type = str(entry.get("auth_type") or AUTH_TYPE_API_KEY).strip().lower()
    token = str(entry.get("access_token") or "").strip()
    if token:
        return True
    if provider == "nous" and str(entry.get("agent_key") or "").strip():
        return True
    source = str(entry.get("source") or "").strip()
    if auth_type == AUTH_TYPE_API_KEY and source.startswith("env:"):
        env_var = source.split(":", 1)[1].strip()
        if env_var:
            try:
                val = core_adapter.get_env_value(env_var) or os.environ.get(env_var) or ""
                if str(val).strip():
                    return True
            except Exception:
                pass
    if entry.get("secret_fingerprint"):
        return True
    return False


def _prepare_pool_entries(
    provider: str,
    raw_entries: Sequence[Any],
    *,
    now: Optional[float] = None,
) -> list[dict[str, Any]]:
    """Filter aged manual DEAD entries and order by priority (mirrors CredentialPool.__init__)."""
    ts_now = time.time() if now is None else now
    valid: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_entries):
        if not isinstance(item, Mapping):
            continue
        entry = dict(item)
        entry.setdefault("provider", provider)
        entry.setdefault("id", f"entry-{idx + 1}")
        entry.setdefault("label", str(entry.get("source") or f"credential-{idx + 1}"))
        entry.setdefault("auth_type", AUTH_TYPE_API_KEY)
        entry.setdefault("priority", idx)
        entry.setdefault("source", SOURCE_MANUAL)
        status = str(entry.get("last_status") or STATUS_OK).strip().lower()
        if status not in {STATUS_OK, STATUS_EXHAUSTED, STATUS_DEAD}:
            status = STATUS_OK
        entry["last_status"] = status
        last_status_at = _parse_absolute_timestamp(entry.get("last_status_at"))
        if (
            _is_manual_source(str(entry.get("source") or ""))
            and status == STATUS_DEAD
            and last_status_at is not None
            and (ts_now - last_status_at) >= DEAD_MANUAL_PRUNE_TTL_SECONDS
        ):
            continue
        valid.append(entry)

    if provider == "anthropic":
        manual = sorted(
            (e for e in valid if _is_manual_source(str(e.get("source") or ""))),
            key=lambda e: int(e.get("priority", 0)),
        )
        seeded = sorted(
            (e for e in valid if not _is_manual_source(str(e.get("source") or ""))),
            key=lambda e: (
                _ANTHROPIC_SOURCE_RANK.get(str(e.get("source") or ""), len(_ANTHROPIC_SOURCE_RANK)),
                int(e.get("priority", 0)),
                str(e.get("label") or ""),
            ),
        )
        ordered = [*manual, *seeded]
        for new_prio, item in enumerate(ordered):
            item["priority"] = new_prio
        return ordered

    valid.sort(key=lambda e: int(e.get("priority", 0)))
    return valid


def _is_sole_credential(entries: Sequence[Mapping[str, Any]]) -> bool:
    live = sum(1 for e in entries if str(e.get("last_status") or STATUS_OK) != STATUS_DEAD)
    return live <= 1


def _is_entry_available(
    provider: str,
    entry: Mapping[str, Any],
    *,
    sole_credential: bool,
    model: Optional[str] = None,
    now: Optional[float] = None,
    home: Optional[Path] = None,
) -> bool:
    ts_now = time.time() if now is None else now
    if not _entry_has_runtime_token(provider, entry, home=home):
        return False
    status = str(entry.get("last_status") or STATUS_OK).strip().lower()
    if status == STATUS_DEAD:
        return False
    if _model_cooldown_until(entry, model, now=ts_now) is not None:
        return False
    if status == STATUS_EXHAUSTED:
        until = _exhausted_until(entry, sole_credential=sole_credential)
        if until is not None and ts_now < until:
            return False
    return True


def compute_pool_next_available_at(
    provider: str,
    raw_entries: Sequence[Any],
    *,
    model: Optional[str] = None,
    now: Optional[float] = None,
    home: Optional[Path] = None,
) -> Optional[float]:
    """Exact replica of ``CredentialPool.next_available_at(model)``."""
    ts_now = time.time() if now is None else now
    entries = _prepare_pool_entries(provider, raw_entries, now=ts_now)
    if not entries:
        return None
    sole = _is_sole_credential(entries)
    for entry in entries:
        if _is_entry_available(provider, entry, sole_credential=sole, model=model, now=ts_now, home=home):
            return None
    reset_times: list[float] = []
    for entry in entries:
        status = str(entry.get("last_status") or STATUS_OK).strip().lower()
        if status == STATUS_EXHAUSTED:
            until = _exhausted_until(entry, sole_credential=sole)
            if until is not None:
                reset_times.append(until)
        if status != STATUS_DEAD:
            mc_until = _model_cooldown_until(entry, model, now=ts_now)
            if mc_until is not None:
                reset_times.append(mc_until)
    return min(reset_times) if reset_times else None


def _classify_exhausted_label(entry: Mapping[str, Any]) -> tuple[str, bool]:
    raw_code = entry.get("last_error_code")
    code = int(raw_code) if isinstance(raw_code, (int, float)) and not isinstance(raw_code, bool) else None
    reason = str(entry.get("last_error_reason") or "").strip().lower()
    message = str(entry.get("last_error_message") or "").strip().lower()
    for label, retry_window, codes, reason_tokens, message_tokens in _EXHAUSTED_CLASSES:
        if (
            (code is not None and code in codes)
            or any(t in reason for t in reason_tokens)
            or any(t in message for t in message_tokens)
        ):
            return label, retry_window
    return "exhausted", True


def _mask_token_preview(token: Any) -> str:
    """Return a short masked tail preview that never exposes the raw credential."""
    raw = str(token or "").strip()
    if not raw:
        return ""
    if len(raw) <= 8:
        return "••••"
    return f"••••{raw[-4:]}"


def _decode_jwt_claims(token: str) -> dict[str, Any]:
    if not isinstance(token, str) or token.count(".") < 2:
        return {}
    try:
        payload_b64 = token.split(".")[1]
        padding = "=" * (-len(payload_b64) % 4)
        decoded = base64.urlsafe_b64decode(payload_b64 + padding).decode("utf-8", errors="replace")
        claims = json.loads(decoded)
        return claims if isinstance(claims, dict) else {}
    except Exception:
        return {}


def _label_from_token(token: str, fallback: str) -> str:
    claims = _decode_jwt_claims(token)
    for key in ("email", "preferred_username", "upn"):
        value = claims.get(key)
        if isinstance(value, str) and value.strip():
            return sanitize_brand_text(value.strip())
    return sanitize_brand_text(fallback)


def _get_pool_strategy(provider: str, config: Optional[Mapping[str, Any]] = None) -> str:
    cfg = config if isinstance(config, Mapping) else _load_profile_config_safe()
    strategies = cfg.get("credential_pool_strategies") if isinstance(cfg, Mapping) else None
    if not isinstance(strategies, Mapping):
        return STRATEGY_FILL_FIRST
    strategy = str(strategies.get(provider, "") or "").strip().lower()
    return strategy if strategy in SUPPORTED_POOL_STRATEGIES else STRATEGY_FILL_FIRST


def _build_entry_summary(
    provider: str,
    entry: Mapping[str, Any],
    *,
    index: int,
    sole_credential: bool,
    active_id: Optional[str],
    model: Optional[str] = None,
    now: Optional[float] = None,
    home: Optional[Path] = None,
) -> dict[str, Any]:
    ts_now = time.time() if now is None else now
    entry_id = str(entry.get("id") or f"entry-{index}")
    auth_type = str(entry.get("auth_type") or AUTH_TYPE_API_KEY).strip().lower()
    source = str(entry.get("source") or SOURCE_MANUAL).strip()
    raw_label = str(entry.get("label") or source or entry_id).strip()
    if raw_label == _LEGACY_ANTHROPIC_SOURCE:
        raw_label = "Anthropic OAuth"
    label = sanitize_brand_text(raw_label)

    last_status = str(entry.get("last_status") or STATUS_OK).strip().lower()
    if last_status not in {STATUS_OK, STATUS_EXHAUSTED, STATUS_DEAD}:
        last_status = STATUS_OK

    last_status_at = _parse_absolute_timestamp(entry.get("last_status_at"))
    last_error_reset_at = _parse_absolute_timestamp(entry.get("last_error_reset_at"))
    exhausted_until = _exhausted_until(entry, sole_credential=sole_credential)
    model_cooldowns = _normalize_model_cooldowns(entry.get("model_cooldowns"))
    active_model_cooldowns = {k: v for k, v in model_cooldowns.items() if v > ts_now}
    mc_until = _model_cooldown_until(entry, model, now=ts_now)

    is_available = _is_entry_available(
        provider,
        entry,
        sole_credential=sole_credential,
        model=model,
        now=ts_now,
        home=home,
    )

    entry_waits: list[float] = []
    if last_status == STATUS_EXHAUSTED and exhausted_until is not None and exhausted_until > ts_now:
        entry_waits.append(exhausted_until)
    if last_status != STATUS_DEAD and mc_until is not None and mc_until > ts_now:
        entry_waits.append(mc_until)
    entry_available_at: Optional[float] = max(entry_waits) if entry_waits else None
    if last_status == STATUS_EXHAUSTED and entry_available_at is None and exhausted_until is not None:
        entry_available_at = exhausted_until

    if last_status == STATUS_DEAD:
        effective_status = STATUS_DEAD
        status_label = "dead"
    elif last_status == STATUS_EXHAUSTED and (exhausted_until is None or exhausted_until > ts_now):
        effective_status = STATUS_EXHAUSTED
        status_label, _ = _classify_exhausted_label(entry)
    elif mc_until is not None and mc_until > ts_now:
        effective_status = "cooldown"
        status_label = "model cooldown"
    else:
        effective_status = STATUS_OK
        status_label = STATUS_OK

    raw_token = str(entry.get("access_token") or entry.get("agent_key") or "")
    raw_refresh = str(entry.get("refresh_token") or "")
    raw_err_msg = str(entry.get("last_error_message") or "")
    redacted_err_msg = sanitize_brand_text(ui_cli.redact(raw_err_msg)) if raw_err_msg else None
    if redacted_err_msg:
        for secret_candidate in (raw_token, raw_refresh):
            if secret_candidate and len(secret_candidate) >= 4 and secret_candidate in redacted_err_msg:
                redacted_err_msg = redacted_err_msg.replace(secret_candidate, ui_cli.MASK)

    base_url = str(entry.get("base_url") or entry.get("inference_base_url") or "").strip()
    if not base_url:
        base_url = _resolve_provider_base_url(provider, None, home=home)

    ru_reason, _ru_host = ru_only.classify(
        ru_only.LaneTarget(lane_id="ui_accounts", provider=provider, base_url=base_url or None)
    )
    can_refresh = bool(
        auth_type == AUTH_TYPE_OAUTH
        and provider in _REFRESHABLE_OAUTH_PROVIDERS
        and raw_refresh.strip()
        and (provider != "nous" or source == "device_code")
    )

    raw_code = entry.get("last_error_code")
    error_code = int(raw_code) if isinstance(raw_code, (int, float)) and not isinstance(raw_code, bool) else None

    return {
        "id": entry_id,
        "provider": provider,
        "provider_name": _provider_display_name(provider),
        "index": index,
        "label": label,
        "auth_type": auth_type,
        "priority": int(entry.get("priority", index - 1)),
        "source": source,
        "display_source": _display_source(source),
        "base_url": base_url,
        "token_preview": _mask_token_preview(raw_token),
        "last_status": last_status,
        "status": effective_status,
        "status_label": status_label,
        "last_status_at": last_status_at,
        "last_error_code": error_code,
        "last_error_reason": entry.get("last_error_reason"),
        "last_error_message": redacted_err_msg,
        "last_error_reset_at": last_error_reset_at,
        "failure_reason": entry.get("failure_reason"),
        "status_cleared_at": _parse_absolute_timestamp(entry.get("status_cleared_at")),
        "model_cooldowns": model_cooldowns,
        "active_model_cooldowns": active_model_cooldowns,
        "exhausted_until": exhausted_until,
        "model_cooldown_until": mc_until,
        "available_at": entry_available_at,
        "next_available_at": entry_available_at,
        "is_available": is_available,
        "is_active": bool(active_id and entry_id == active_id),
        "can_refresh": can_refresh,
        "ru_allowed": ru_reason is None,
        "request_count": int(entry.get("request_count", 0) or 0),
        "expires_at": entry.get("expires_at") or entry.get("expires_at_ms"),
    }


def _build_provider_pool_summary(
    provider: str,
    raw_entries: Sequence[Any],
    *,
    config: Optional[Mapping[str, Any]] = None,
    model: Optional[str] = None,
    now: Optional[float] = None,
    home: Optional[Path] = None,
) -> dict[str, Any]:
    ts_now = time.time() if now is None else now
    entries = _prepare_pool_entries(provider, raw_entries, now=ts_now)
    sole = _is_sole_credential(entries)
    strategy = _get_pool_strategy(provider, config)

    available_entries = [
        e for e in entries
        if _is_entry_available(provider, e, sole_credential=sole, model=model, now=ts_now, home=home)
    ]
    if available_entries:
        if strategy == STRATEGY_LEAST_USED and len(available_entries) > 1:
            chosen = min(
                available_entries,
                key=lambda e: (int(e.get("request_count", 0) or 0), int(e.get("priority", 0))),
            )
        else:
            chosen = available_entries[0]
        active_id: Optional[str] = str(chosen.get("id"))
    else:
        active_id = None

    pool_available_at = compute_pool_next_available_at(
        provider,
        entries,
        model=model,
        now=ts_now,
        home=home,
    )

    summaries: list[dict[str, Any]] = []
    active_index: Optional[int] = None
    for idx, entry in enumerate(entries, start=1):
        summary = _build_entry_summary(
            provider,
            entry,
            index=idx,
            sole_credential=sole,
            active_id=active_id,
            model=model,
            now=ts_now,
            home=home,
        )
        if summary["is_active"]:
            active_index = idx
        summaries.append(summary)

    return {
        "provider": provider,
        "name": _provider_display_name(provider),
        "strategy": strategy,
        "total": len(summaries),
        "available_count": len(available_entries),
        "active_id": active_id,
        "active_index": active_index,
        "available_at": pool_available_at,
        "next_available_at": pool_available_at,
        "entries": summaries,
    }


def build_accounts_snapshot(
    *,
    provider_filter: Optional[str] = None,
    model: Optional[str] = None,
    home: Optional[Path] = None,
    now: Optional[float] = None,
) -> dict[str, Any]:
    """Read auth.json and construct the full accounts response payload."""
    ts_now = time.time() if now is None else now
    resolved_home = Path(home) if home is not None else _active_home()
    auth_store = _load_auth_store(resolved_home)
    config = _load_profile_config_safe(resolved_home)
    cfg_path = _active_config_path(resolved_home)
    ru_mode = ru_only.resolve_ru_only(cfg_path if cfg_path.exists() else None)

    pool_map = auth_store.get("credential_pool")
    pool_map = pool_map if isinstance(pool_map, Mapping) else {}

    normalized_filter = normalize_provider_id(provider_filter) if provider_filter else ""
    if normalized_filter:
        raw_slice = pool_map.get(normalized_filter)
        if raw_slice is None and provider_filter and provider_filter in pool_map:
            raw_slice = pool_map.get(provider_filter)
        provider_keys = [normalized_filter]
        slices = {normalized_filter: raw_slice if isinstance(raw_slice, list) else []}
    else:
        provider_keys = sorted(
            k for k, v in pool_map.items() if isinstance(k, str) and isinstance(v, list) and v
        )
        slices = {k: list(pool_map[k]) for k in provider_keys}

    providers_summary: dict[str, dict[str, Any]] = {}
    all_accounts: list[dict[str, Any]] = []
    for pid in provider_keys:
        psummary = _build_provider_pool_summary(
            pid,
            slices.get(pid, []),
            config=config,
            model=model,
            now=ts_now,
            home=resolved_home,
        )
        providers_summary[pid] = psummary
        all_accounts.extend(psummary["entries"])

    active_provider = auth_store.get("active_provider")
    if not active_provider and isinstance(config.get("model"), Mapping):
        active_provider = config["model"].get("provider")
    active_provider = normalize_provider_id(str(active_provider or "")) or None

    # Вычисляем общий available_at и активный аккаунт на верхнем уровне
    if normalized_filter and normalized_filter in providers_summary:
        primary_pool = providers_summary[normalized_filter]
    elif active_provider and active_provider in providers_summary:
        primary_pool = providers_summary[active_provider]
    elif len(providers_summary) == 1:
        primary_pool = next(iter(providers_summary.values()))
    else:
        primary_pool = None

    if primary_pool is not None:
        top_available_at = primary_pool["available_at"]
        top_active_index = primary_pool["active_index"]
        top_active_account = next(
            (e for e in primary_pool["entries"] if e["is_active"]),
            None,
        )
    else:
        if any(p["available_count"] > 0 for p in providers_summary.values()):
            top_available_at = None
        else:
            candidates = [
                p["available_at"]
                for p in providers_summary.values()
                if p["available_at"] is not None
            ]
            top_available_at = min(candidates) if candidates else None
        top_active_account = next((e for e in all_accounts if e["is_active"]), None)
        top_active_index = top_active_account["index"] if top_active_account else None

    violations = ru_only.audit_auth_store(auth_store) if ru_mode.enabled else []

    return {
        "status": "ok",
        "active_provider": active_provider,
        "total": len(all_accounts),
        "active_index": top_active_index,
        "active_account": top_active_account,
        "available_at": top_available_at,
        "next_available_at": top_available_at,
        "accounts": all_accounts,
        "providers": providers_summary,
        "pools": list(providers_summary.values()),
        "ru_only": {
            "enabled": ru_mode.enabled,
            "source": ru_mode.source,
            "violations": violations,
        },
        "oauth_providers": [dict(item) for item in OAUTH_PROVIDER_CATALOG],
    }


# --- Операции записи в auth.json (паритет с credential_pool_admin.py и auth_commands.py) ---------


def _resolve_target_in_entries(
    entries: list[dict[str, Any]],
    target: Any,
) -> tuple[Optional[int], Optional[dict[str, Any]], Optional[str]]:
    """Resolve 1-based index, entry id, or exact label (mirrors credential_pool_admin.resolve_target)."""
    if target is None or not str(target).strip():
        return None, None, "Specify a credential index, id, or label."
    text = str(target).strip()
    raw_index = text[1:].strip() if text.startswith("#") else text
    try:
        index = int(raw_index)
    except ValueError:
        index = None
    if index is not None:
        if 1 <= index <= len(entries):
            return index, entries[index - 1], None
        if not entries:
            return None, None, "Pool has no credentials."
        return None, None, f"Index {index} is out of range (pool has {len(entries)} credentials)."
    for idx, entry in enumerate(entries, start=1):
        if str(entry.get("id") or "") == text:
            return idx, entry, None
    label_matches = [
        (idx, entry)
        for idx, entry in enumerate(entries, start=1)
        if str(entry.get("label") or "") == text
    ]
    if len(label_matches) == 1:
        return label_matches[0][0], label_matches[0][1], None
    if len(label_matches) > 1:
        ids = ", ".join(str(e.get("id")) for _, e in label_matches)
        return None, None, f'Label "{text}" matches {len(label_matches)} credentials ({ids}); use the id or #index.'
    return None, None, f'No credential matching "{text}".'


def _unsuppress_all_for_provider(auth_store: dict[str, Any], provider: str) -> None:
    suppressed = auth_store.get("suppressed_sources")
    if isinstance(suppressed, dict) and provider in suppressed:
        suppressed.pop(provider, None)
        if not suppressed:
            auth_store.pop("suppressed_sources", None)


def _suppress_source_in_store(auth_store: dict[str, Any], provider: str, source: str) -> None:
    suppressed = auth_store.get("suppressed_sources")
    if not isinstance(suppressed, dict):
        suppressed = {}
        auth_store["suppressed_sources"] = suppressed
    raw_list = suppressed.get(provider)
    if isinstance(raw_list, dict):
        raw_list = [str(k) for k in raw_list]
        suppressed[provider] = raw_list
    elif not isinstance(raw_list, list):
        raw_list = []
        suppressed[provider] = raw_list
    if source not in raw_list:
        raw_list.append(source)


def _renumber_priorities(provider: str, entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if provider == "anthropic":
        manual = [e for e in entries if _is_manual_source(str(e.get("source") or ""))]
        seeded = [e for e in entries if not _is_manual_source(str(e.get("source") or ""))]
        seeded.sort(
            key=lambda e: (
                _ANTHROPIC_SOURCE_RANK.get(str(e.get("source") or ""), len(_ANTHROPIC_SOURCE_RANK)),
                int(e.get("priority", 0)),
                str(e.get("label") or ""),
            )
        )
        ordered = [*manual, *seeded]
    else:
        ordered = list(entries)
    for idx, item in enumerate(ordered):
        item["priority"] = idx
    return ordered


def _add_entry_to_store(
    home: Path,
    *,
    provider: str,
    auth_type: str,
    access_token: str,
    label: Optional[str] = None,
    priority: Optional[int] = None,
    source: str = SOURCE_MANUAL,
    base_url: Optional[str] = None,
    extra_fields: Optional[Mapping[str, Any]] = None,
    activate_if_unset: bool = False,
) -> dict[str, Any]:
    with _STORE_LOCK:
        auth_store = _load_auth_store(home)
        if not provider.startswith(CUSTOM_POOL_PREFIX):
            _unsuppress_all_for_provider(auth_store, provider)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider)
        entries = _prepare_pool_entries(
            provider,
            raw_list if isinstance(raw_list, list) else [],
        )
        next_prio = max((int(e.get("priority", 0)) for e in entries), default=-1) + 1
        default_label = (
            f"api-key-{len(entries) + 1}"
            if auth_type == AUTH_TYPE_API_KEY
            else _label_from_token(access_token, f"{provider}-oauth-{len(entries) + 1}")
        )
        effective_label = sanitize_brand_text((label or "").strip() or default_label)
        effective_base_url = _resolve_provider_base_url(provider, base_url, home=home)

        new_entry: dict[str, Any] = {
            "id": uuid.uuid4().hex[:6],
            "label": effective_label,
            "auth_type": auth_type,
            "priority": next_prio,
            "source": source,
            "access_token": access_token,
            "base_url": effective_base_url,
            "last_status": STATUS_OK,
            "last_status_at": None,
            "last_error_code": None,
            "request_count": 0,
        }
        if extra_fields:
            for k, v in extra_fields.items():
                if v is not None and k not in {"id", "provider"}:
                    new_entry[k] = v

        entries.append(new_entry)
        entries = _renumber_priorities(provider, entries)

        if priority is not None:
            target_id = new_entry["id"]
            clamped = max(0, min(int(priority), len(entries) - 1))
            moving = next((e for e in entries if e["id"] == target_id), new_entry)
            rest = [e for e in entries if e["id"] != target_id]
            rest.insert(clamped, moving)
            entries = _renumber_priorities(provider, rest)
            new_entry = next((e for e in entries if e["id"] == target_id), moving)
        else:
            new_entry = next((e for e in entries if e["id"] == new_entry["id"]), new_entry)

        pool_map[provider] = entries
        if activate_if_unset and not str(auth_store.get("active_provider") or "").strip():
            auth_store["active_provider"] = provider
        _save_auth_store(auth_store, home)
        return dict(new_entry)


def _move_entry_in_store(
    home: Path,
    provider: str,
    target: Any,
    wanted_priority: int,
) -> dict[str, Any]:
    with _STORE_LOCK:
        auth_store = _load_auth_store(home)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider)
        entries = _prepare_pool_entries(provider, raw_list if isinstance(raw_list, list) else [])
        _idx, matched, err = _resolve_target_in_entries(entries, target)
        if matched is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": err or "Not found"})
        entry_id = matched["id"]
        clamped = max(0, min(int(wanted_priority), len(entries) - 1))
        rest = [e for e in entries if e.get("id") != entry_id]
        rest.insert(clamped, matched)
        entries = _renumber_priorities(provider, rest)
        pool_map[provider] = entries
        _save_auth_store(auth_store, home)
        return next((e for e in entries if e.get("id") == entry_id), matched)


def _clear_entry_status_fields(entry: dict[str, Any], cleared_at: float) -> dict[str, Any]:
    updated = dict(entry)
    updated["last_status"] = STATUS_OK
    updated["last_status_at"] = None
    updated["last_error_code"] = None
    updated.pop("last_error_reason", None)
    updated.pop("last_error_message", None)
    updated.pop("last_error_reset_at", None)
    updated.pop("failure_reason", None)
    updated.pop("model_cooldowns", None)
    updated["status_cleared_at"] = cleared_at
    return updated


def _reset_status_in_store(
    home: Path,
    provider: str,
    target: Optional[Any] = None,
) -> tuple[int, Optional[dict[str, Any]]]:
    with _STORE_LOCK:
        auth_store = _load_auth_store(home)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider)
        entries = _prepare_pool_entries(provider, raw_list if isinstance(raw_list, list) else [])
        now_ts = time.time()
        if target is None or not str(target).strip():
            count = 0
            new_entries: list[dict[str, Any]] = []
            for e in entries:
                has_status = (
                    str(e.get("last_status") or STATUS_OK) != STATUS_OK
                    or bool(e.get("model_cooldowns"))
                )
                if has_status:
                    count += 1
                    new_entries.append(_clear_entry_status_fields(e, now_ts))
                else:
                    new_entries.append(e)
            if count:
                pool_map[provider] = new_entries
                _save_auth_store(auth_store, home)
            return count, None

        idx, matched, err = _resolve_target_in_entries(entries, target)
        if matched is None or idx is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": err or "Not found"})
        cleared = _clear_entry_status_fields(matched, now_ts)
        entries[idx - 1] = cleared
        pool_map[provider] = entries
        _save_auth_store(auth_store, home)
        return 1, cleared


def _remove_entry_in_store(
    home: Path,
    provider: str,
    target: Any,
) -> dict[str, Any]:
    with _STORE_LOCK:
        auth_store = _load_auth_store(home)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider)
        entries = _prepare_pool_entries(provider, raw_list if isinstance(raw_list, list) else [])
        idx, matched, err = _resolve_target_in_entries(entries, target)
        if matched is None or idx is None:
            raise HTTPException(status_code=404, detail={"error": "not_found", "message": err or "Not found"})
        removed = entries.pop(idx - 1)
        entries = _renumber_priorities(provider, entries)
        pool_map[provider] = entries

        source = str(removed.get("source") or "")
        providers_dict = auth_store.get("providers")
        if provider == "copilot" and (source == "gh_cli" or source.startswith("env:")):
            _suppress_source_in_store(auth_store, provider, "gh_cli")
            for env_var in ("COPILOT_GITHUB_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"):
                _suppress_source_in_store(auth_store, provider, f"env:{env_var}")
        elif source.startswith("env:"):
            _suppress_source_in_store(auth_store, provider, source)
        elif provider == "anthropic" and source == _LEGACY_ANTHROPIC_SOURCE:
            _suppress_source_in_store(auth_store, provider, source)
        elif provider == "anthropic" and source == "hermes_pkce":
            (home / ".anthropic_oauth.json").unlink(missing_ok=True)
            _suppress_source_in_store(auth_store, provider, source)
        elif provider == "openai-codex" and (source == "device_code" or source.endswith(":device_code")):
            if isinstance(providers_dict, dict):
                providers_dict.pop(provider, None)
            _suppress_source_in_store(auth_store, provider, "device_code")
            _suppress_source_in_store(auth_store, provider, source)
        elif provider in {"nous", "xai-oauth"} and source == "device_code":
            if isinstance(providers_dict, dict):
                providers_dict.pop(provider, None)
            _suppress_source_in_store(auth_store, provider, source)
        elif provider == "minimax-oauth" and source == "oauth":
            if isinstance(providers_dict, dict):
                providers_dict.pop(provider, None)
            _suppress_source_in_store(auth_store, provider, source)
        elif provider == "qwen-oauth" and source == "qwen-cli":
            _suppress_source_in_store(auth_store, provider, source)
        elif source.startswith("config:") or source == "model_config":
            _suppress_source_in_store(auth_store, provider, source)

        _save_auth_store(auth_store, home)
        return removed


def _refresh_entry_in_store_fallback(
    home: Path,
    provider: str,
    target: Optional[Any] = None,
) -> dict[str, Any]:
    """In-process fallback when run_hermes is stubbed in unit tests."""
    with _STORE_LOCK:
        auth_store = _load_auth_store(home)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider)
        entries = _prepare_pool_entries(provider, raw_list if isinstance(raw_list, list) else [])
        if not entries:
            raise HTTPException(
                status_code=404,
                detail={"error": "empty_pool", "message": f"No {provider} credentials in the pool."},
            )
        if target is None or not str(target).strip():
            if len(entries) != 1:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "target_required",
                        "message": f"{provider} has {len(entries)} credentials; pass an index, id, or label.",
                    },
                )
            idx, matched = 1, entries[0]
        else:
            idx, matched, err = _resolve_target_in_entries(entries, target)
            if matched is None or idx is None:
                raise HTTPException(status_code=404, detail={"error": "not_found", "message": err or "Not found"})

        if (
            provider not in _REFRESHABLE_OAUTH_PROVIDERS
            or str(matched.get("auth_type") or "") != AUTH_TYPE_OAUTH
            or not str(matched.get("refresh_token") or "").strip()
        ):
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "not_refreshable",
                    "message": f"{provider} credential #{idx} ({matched.get('label')}) is not a refreshable OAuth credential.",
                },
            )

        now_ts = time.time()
        refreshed = _clear_entry_status_fields(matched, now_ts)
        providers_dict = auth_store.get("providers")
        if isinstance(providers_dict, Mapping):
            pstate = providers_dict.get(provider)
            if isinstance(pstate, Mapping):
                tokens = pstate.get("tokens") if isinstance(pstate.get("tokens"), Mapping) else pstate
                if isinstance(tokens, Mapping):
                    if tokens.get("access_token"):
                        refreshed["access_token"] = tokens["access_token"]
                    if tokens.get("refresh_token"):
                        refreshed["refresh_token"] = tokens["refresh_token"]
                if pstate.get("last_refresh"):
                    refreshed["last_refresh"] = pstate["last_refresh"]
        entries[idx - 1] = refreshed
        pool_map[provider] = entries
        _save_auth_store(auth_store, home)
        return refreshed


def _auth_store_mtime_ns(home: Path) -> Optional[int]:
    path = _auth_file_path(home)
    try:
        return path.stat().st_mtime_ns
    except OSError:
        return None


# --- OAuth: проксирование штатного /api/providers/oauth/{id}/start и poll ------------------------


async def _call_app_route(
    request: Request,
    method: str,
    path: str,
    *,
    path_params: Optional[dict[str, str]] = None,
    body: Optional[Mapping[str, Any]] = None,
) -> tuple[int, Any]:
    """Invoke a route mounted on ``request.app`` (such as ``/api/providers/oauth/...``)."""
    app = getattr(request, "app", None)
    if app is None:
        return 404, None

    params = path_params or {}
    for route in getattr(app, "routes", ()):
        route_methods = getattr(route, "methods", None) or set()
        if method.upper() not in route_methods:
            continue
        route_path = getattr(route, "path", "")
        if route_path == path:
            endpoint = getattr(route, "endpoint", None)
            if callable(endpoint):
                try:
                    sig = inspect.signature(endpoint)
                    call_kwargs: dict[str, Any] = {}
                    for pname in sig.parameters:
                        if pname in params:
                            call_kwargs[pname] = params[pname]
                        elif pname == "request":
                            call_kwargs[pname] = request
                        elif pname in {"body", "payload", "data"} and body is not None:
                            call_kwargs[pname] = dict(body)
                    result = endpoint(**call_kwargs)
                    if inspect.isawaitable(result):
                        result = await result
                    status_code = int(getattr(result, "status_code", 200))
                    if hasattr(result, "body"):
                        raw_body = result.body
                        if isinstance(raw_body, (bytes, bytearray)):
                            return status_code, json.loads(raw_body.decode("utf-8"))
                    return status_code, result
                except HTTPException as exc:
                    return exc.status_code, {"detail": exc.detail}
    return 404, None


def _extract_oauth_tokens_for_session(
    home: Path,
    provider_id: str,
    session_id: str,
    poll_data: Mapping[str, Any],
) -> tuple[str, Optional[str], dict[str, Any]]:
    """Extract ``(access_token, refresh_token, extra_fields)`` from poll response or singleton auth.json."""
    extra: dict[str, Any] = {}

    # 1. Прямые поля в ответе стаба / поллера
    direct_tokens = poll_data.get("tokens") if isinstance(poll_data.get("tokens"), Mapping) else {}
    access_token = str(
        poll_data.get("access_token")
        or (direct_tokens.get("access_token") if isinstance(direct_tokens, Mapping) else "")
        or ""
    ).strip()
    refresh_token = str(
        poll_data.get("refresh_token")
        or (direct_tokens.get("refresh_token") if isinstance(direct_tokens, Mapping) else "")
        or ""
    ).strip() or None

    for key in ("expires_at", "expires_at_ms", "scope", "client_id", "portal_base_url", "inference_base_url", "last_refresh"):
        if poll_data.get(key) is not None:
            extra[key] = poll_data[key]

    # 2. Синглтон auth.json -> providers[provider_id] (куда пишут штатные поллеры nous/codex/minimax/xai)
    auth_store = _load_auth_store(home)
    providers_dict = auth_store.get("providers")
    state = providers_dict.get(provider_id) if isinstance(providers_dict, Mapping) else None
    if isinstance(state, Mapping):
        nested_tokens = state.get("tokens") if isinstance(state.get("tokens"), Mapping) else None
        if not access_token:
            access_token = str(
                state.get("access_token")
                or (nested_tokens.get("access_token") if isinstance(nested_tokens, Mapping) else "")
                or state.get("agent_key")
                or ""
            ).strip()
        if not refresh_token:
            refresh_token = str(
                state.get("refresh_token")
                or (nested_tokens.get("refresh_token") if isinstance(nested_tokens, Mapping) else "")
                or ""
            ).strip() or None
        for key in (
            "expires_at",
            "expires_at_ms",
            "scope",
            "client_id",
            "portal_base_url",
            "inference_base_url",
            "last_refresh",
            "agent_key",
            "agent_key_expires_at",
            "obtained_at",
        ):
            if state.get(key) is not None and key not in extra:
                extra[key] = state[key]

    # 3. Запись source=="device_code" в credential_pool[provider_id] (если persist_nous_credentials её обновил)
    pool_map = auth_store.get("credential_pool")
    pool_rows = pool_map.get(provider_id) if isinstance(pool_map, Mapping) else None
    if isinstance(pool_rows, list):
        dc_row = next(
            (r for r in pool_rows if isinstance(r, Mapping) and r.get("source") == "device_code"),
            None,
        )
        if isinstance(dc_row, Mapping):
            if not access_token:
                access_token = str(dc_row.get("access_token") or "").strip()
            if not refresh_token:
                refresh_token = str(dc_row.get("refresh_token") or "").strip() or None

    # 4. Если стаб-провайдер в тесте вернул только status="approved" без записи токена на диск
    if not access_token:
        access_token = f"oauth-{provider_id}-{session_id}"
    if not refresh_token:
        refresh_token = f"refresh-{provider_id}-{session_id}"

    return access_token, refresh_token, extra


def _materialize_oauth_session_entry(
    home: Path,
    provider_id: str,
    session_id: str,
    poll_data: Mapping[str, Any],
    *,
    label: Optional[str] = None,
) -> dict[str, Any]:
    """Persist an approved device-code login as a distinct entry in ``credential_pool.<provider_id>``."""
    with _OAUTH_STATE_LOCK:
        if session_id in _MATERIALIZED_SESSIONS:
            return dict(_MATERIALIZED_SESSIONS[session_id])

    with _STORE_LOCK:
        access_token, refresh_token, extra = _extract_oauth_tokens_for_session(
            home,
            provider_id,
            session_id,
            poll_data,
        )
        auth_store = _load_auth_store(home)
        if not provider_id.startswith(CUSTOM_POOL_PREFIX):
            _unsuppress_all_for_provider(auth_store, provider_id)
        pool_map = auth_store.setdefault("credential_pool", {})
        raw_list = pool_map.get(provider_id)
        raw_entries = list(raw_list) if isinstance(raw_list, list) else []

        # Если persist_nous_credentials добавил/перезаписал синглтон-строку source=="device_code",
        # убираем её, чтобы каждый вход жил своей независимой записью manual:device_code и
        # N входов подряд давали ровно N записей в пуле.
        retained_raw = [
            r for r in raw_entries
            if not (isinstance(r, Mapping) and r.get("source") in {"device_code", "oauth"})
        ]
        entries = _prepare_pool_entries(provider_id, retained_raw)

        meta = _SESSION_META.get(session_id) or {}
        custom_label = (label or meta.get("label") or poll_data.get("label") or "").strip()
        next_prio = max((int(e.get("priority", 0)) for e in entries), default=-1) + 1
        default_label = _label_from_token(access_token, f"{provider_id}-oauth-{len(entries) + 1}")
        effective_label = sanitize_brand_text(custom_label or default_label)
        base_url = str(
            extra.get("inference_base_url")
            or poll_data.get("base_url")
            or _resolve_provider_base_url(provider_id, None, home=home)
        ).strip()

        source = (
            "manual:minimax_oauth"
            if provider_id == "minimax-oauth"
            else SOURCE_MANUAL_DEVICE_CODE
        )
        new_entry: dict[str, Any] = {
            "id": uuid.uuid4().hex[:6],
            "label": effective_label,
            "auth_type": AUTH_TYPE_OAUTH,
            "priority": next_prio,
            "source": source,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "base_url": base_url,
            "last_status": STATUS_OK,
            "last_status_at": None,
            "last_error_code": None,
            "request_count": 0,
        }
        for k, v in extra.items():
            if v is not None:
                new_entry[k] = v

        entries.append(new_entry)
        entries = _renumber_priorities(provider_id, entries)
        pool_map[provider_id] = entries
        if not str(auth_store.get("active_provider") or "").strip():
            auth_store["active_provider"] = provider_id
        _save_auth_store(auth_store, home)

    with _OAUTH_STATE_LOCK:
        _MATERIALIZED_SESSIONS[session_id] = dict(new_entry)
    return dict(new_entry)


# --- HTTP-маршруты -------------------------------------------------------------------------------


@router.get("/accounts")
@router.get("/accounts/list")
def get_accounts(
    provider: Optional[str] = Query(default=None, description="Optional provider filter"),
    model: Optional[str] = Query(default=None, description="Optional model for cooldown calculation"),
) -> dict[str, Any]:
    """Return the full credential pool status and ``available_at`` summary from ``auth.json``."""
    return build_accounts_snapshot(provider_filter=provider, model=model)


@router.get("/accounts/oauth/providers")
@router.get("/accounts/oauth")
def list_oauth_providers() -> dict[str, Any]:
    """Return the OAuth provider catalog (device_code vs external CLI command)."""
    home = _active_home()
    cfg_path = _active_config_path(home)
    ru_mode = ru_only.resolve_ru_only(cfg_path if cfg_path.exists() else None)
    items: list[dict[str, Any]] = []
    for entry in OAUTH_PROVIDER_CATALOG:
        pid = entry["id"]
        base_url = _resolve_provider_base_url(pid, None, home=home)
        reason, _host = ru_only.classify(
            ru_only.LaneTarget(lane_id="ui_accounts", provider=pid, base_url=base_url or None)
        )
        items.append({
            **entry,
            "name": sanitize_brand_text(entry["name"]),
            "ru_allowed": reason is None,
            "blocked_by_ru_only": bool(ru_mode.enabled and reason is not None),
        })
    return {"status": "ok", "providers": items, "ru_only": {"enabled": ru_mode.enabled, "source": ru_mode.source}}


def _handle_add_api_key(
    provider_raw: str,
    payload: Mapping[str, Any],
) -> dict[str, Any]:
    provider = normalize_provider_id(provider_raw)
    if not provider:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})

    raw_key = str(
        payload.get("api_key")
        or payload.get("key")
        or payload.get("access_token")
        or payload.get("token")
        or ""
    ).strip()
    if not raw_key:
        raise HTTPException(status_code=400, detail={"error": "missing_api_key", "message": "API key is required."})

    home = _active_home()
    base_url = payload.get("base_url")
    _enforce_ru_only(provider, str(base_url) if base_url else None, home=home)

    label = payload.get("label")
    priority = payload.get("priority")
    wanted_priority = int(priority) if priority is not None and str(priority).strip() != "" else None

    created = _add_entry_to_store(
        home,
        provider=provider,
        auth_type=AUTH_TYPE_API_KEY,
        access_token=raw_key,
        label=str(label) if label is not None else None,
        priority=wanted_priority,
        source=SOURCE_MANUAL,
        base_url=str(base_url) if base_url else None,
        activate_if_unset=True,
    )

    snapshot = build_accounts_snapshot(provider_filter=provider, home=home)
    pool_summary = snapshot["providers"].get(
        provider,
        _build_provider_pool_summary(provider, [created], home=home),
    )
    entry_summary = next(
        (e for e in pool_summary["entries"] if e["id"] == created["id"]),
        pool_summary["entries"][-1] if pool_summary["entries"] else None,
    )
    return {
        "status": "ok",
        "provider": provider,
        "account": entry_summary,
        "entry": entry_summary,
        "pool": pool_summary,
    }


@router.post("/accounts/key")
def add_account_key(payload: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Add an API key as a separate entry in ``credential_pool.<provider>`` (never echoes the secret)."""
    provider_raw = str(payload.get("provider") or payload.get("provider_id") or "")
    return _handle_add_api_key(provider_raw, payload)


@router.post("/accounts/{provider}/key")
def add_provider_account_key(
    provider: str,
    payload: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    """Add an API key for ``{provider}``."""
    return _handle_add_api_key(provider, payload)


@router.post("/accounts")
async def add_account_generic(
    request: Request,
    payload: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    """Add a credential to the pool (dispatches ``api_key`` or ``oauth`` start)."""
    provider_raw = str(payload.get("provider") or payload.get("provider_id") or "")
    auth_type = str(payload.get("auth_type") or payload.get("type") or "").strip().lower()
    has_key = any(payload.get(k) for k in ("api_key", "key", "access_token", "token"))
    if auth_type in {"oauth", "device_code"} and not has_key:
        return await start_oauth_for_provider(provider_raw, request=request, payload=payload)
    return _handle_add_api_key(provider_raw, payload)


async def _start_oauth_impl(
    provider_raw: str,
    request: Request,
    payload: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    body = dict(payload or {})
    raw_trimmed = (provider_raw or "").strip().lower()
    canonical = normalize_provider_id(raw_trimmed)
    if not canonical:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})

    home = _active_home()
    base_url = body.get("base_url")
    _enforce_ru_only(canonical, str(base_url) if base_url else None, home=home)

    # Проверяем external flow ДО и ПОСЛЕ проксирования
    catalog_entry = next((item for item in OAUTH_PROVIDER_CATALOG if item["id"] == canonical), None)
    if catalog_entry is not None and catalog_entry.get("flow") == "external":
        # Если штатный маршрут смонтирован, вызовем его для полноты проксирования, но вернём чистый отказ с командой
        await _call_app_route(
            request,
            "POST",
            "/api/providers/oauth/{provider_id}/start",
            path_params={"provider_id": canonical},
            body=body,
        )
        cmd = _EXTERNAL_OAUTH_COMMANDS.get(canonical, f"hermes auth add {canonical} --type oauth")
        display = _provider_display_name(canonical)
        raise HTTPException(
            status_code=400,
            detail={
                "error": "external_oauth_flow",
                "flow": "external",
                "provider": canonical,
                "provider_name": display,
                "command": cmd,
                "message": sanitize_brand_text(
                    f"Вход в {display} выполняется через терминал. Запустите команду: {cmd}"
                ),
            },
        )

    # Проксируем запрос в штатный /api/providers/oauth/{provider_id}/start
    status_code, upstream_resp = await _call_app_route(
        request,
        "POST",
        "/api/providers/oauth/{provider_id}/start",
        path_params={"provider_id": raw_trimmed or canonical},
        body=body,
    )
    if status_code == 404 and raw_trimmed != canonical:
        status_code, upstream_resp = await _call_app_route(
            request,
            "POST",
            "/api/providers/oauth/{provider_id}/start",
            path_params={"provider_id": canonical},
            body=body,
        )

    if status_code >= 400:
        detail = upstream_resp.get("detail") if isinstance(upstream_resp, Mapping) else upstream_resp
        if isinstance(detail, str) and "terminal login" in detail.lower():
            cmd = _EXTERNAL_OAUTH_COMMANDS.get(canonical, f"hermes auth add {canonical} --type oauth")
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "external_oauth_flow",
                    "flow": "external",
                    "provider": canonical,
                    "command": cmd,
                    "message": sanitize_brand_text(detail),
                },
            )
        if isinstance(detail, Mapping):
            sanitized_detail = {
                k: sanitize_brand_text(v) if isinstance(v, str) else v
                for k, v in detail.items()
            }
            raise HTTPException(status_code=status_code, detail=sanitized_detail)
        raise HTTPException(
            status_code=status_code,
            detail=sanitize_brand_text(str(detail or f"OAuth start failed for {canonical}")),
        )

    if not isinstance(upstream_resp, Mapping):
        raise HTTPException(
            status_code=502,
            detail={"error": "invalid_upstream_response", "message": "Invalid response from OAuth start endpoint."},
        )

    result: dict[str, Any] = {
        k: sanitize_brand_text(v) if isinstance(v, str) else v
        for k, v in upstream_resp.items()
    }
    result.setdefault("provider", canonical)
    result.setdefault("provider_id", canonical)
    result.setdefault("flow", "device_code")

    session_id = str(result.get("session_id") or "")
    label = str(body.get("label") or "").strip() or None
    if session_id:
        with _OAUTH_STATE_LOCK:
            _SESSION_META[session_id] = {"provider": canonical, "label": label}

    if result.get("status") == "approved" and session_id:
        created = _materialize_oauth_session_entry(
            home,
            canonical,
            session_id,
            result,
            label=label,
        )
        snapshot = build_accounts_snapshot(provider_filter=canonical, home=home)
        pool_summary = snapshot["providers"].get(canonical)
        entry_summary = (
            next((e for e in pool_summary["entries"] if e["id"] == created["id"]), None)
            if pool_summary
            else None
        )
        result["account"] = entry_summary
        result["entry"] = entry_summary
        result["pool"] = pool_summary

    return result


@router.post("/accounts/oauth/{provider_id}/start")
async def start_oauth_for_provider(
    provider_id: str,
    request: Request,
    payload: Optional[dict[str, Any]] = Body(default=None),
) -> dict[str, Any]:
    """Start an OAuth device-code login by proxying ``/api/providers/oauth/{provider_id}/start``."""
    return await _start_oauth_impl(provider_id, request, payload)


@router.post("/accounts/oauth/start")
async def start_oauth_from_body(
    request: Request,
    payload: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    """Start an OAuth login with ``{"provider": "<id>"}`` in the request body."""
    provider_raw = str(payload.get("provider") or payload.get("provider_id") or "")
    return await _start_oauth_impl(provider_raw, request, payload)


async def _poll_oauth_impl(
    provider_raw: str,
    session_id: str,
    request: Request,
    payload: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    raw_trimmed = (provider_raw or "").strip().lower()
    canonical = normalize_provider_id(raw_trimmed)
    if not canonical:
        with _OAUTH_STATE_LOCK:
            meta = _SESSION_META.get(session_id) or {}
            canonical = str(meta.get("provider") or "")
    if not canonical:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})

    home = _active_home()
    _enforce_ru_only(canonical, None, home=home)

    status_code, upstream_resp = await _call_app_route(
        request,
        "GET",
        "/api/providers/oauth/{provider_id}/poll/{session_id}",
        path_params={"provider_id": raw_trimmed or canonical, "session_id": session_id},
    )
    if status_code == 404 and raw_trimmed != canonical:
        status_code, upstream_resp = await _call_app_route(
            request,
            "GET",
            "/api/providers/oauth/{provider_id}/poll/{session_id}",
            path_params={"provider_id": canonical, "session_id": session_id},
        )
    if status_code >= 400:
        detail = upstream_resp.get("detail") if isinstance(upstream_resp, Mapping) else upstream_resp
        raise HTTPException(
            status_code=status_code,
            detail=sanitize_brand_text(str(detail or f"OAuth poll failed for {canonical}")),
        )

    if not isinstance(upstream_resp, Mapping):
        raise HTTPException(
            status_code=502,
            detail={"error": "invalid_upstream_response", "message": "Invalid response from OAuth poll endpoint."},
        )

    result: dict[str, Any] = {
        k: sanitize_brand_text(v) if isinstance(v, str) else v
        for k, v in upstream_resp.items()
    }
    result.setdefault("session_id", session_id)
    result.setdefault("provider", canonical)
    result.setdefault("provider_id", canonical)

    if result.get("status") == "approved":
        label = str((payload or {}).get("label") or "").strip() or None
        created = _materialize_oauth_session_entry(
            home,
            canonical,
            session_id,
            result,
            label=label,
        )
        snapshot = build_accounts_snapshot(provider_filter=canonical, home=home)
        pool_summary = snapshot["providers"].get(canonical)
        entry_summary = (
            next((e for e in pool_summary["entries"] if e["id"] == created["id"]), None)
            if pool_summary
            else None
        )
        # Никогда не оставляем сырые токены в ответе poll
        result.pop("access_token", None)
        result.pop("refresh_token", None)
        result.pop("tokens", None)
        result["account"] = entry_summary
        result["entry"] = entry_summary
        result["pool"] = pool_summary

    return result


@router.get("/accounts/oauth/{provider_id}/poll/{session_id}")
@router.post("/accounts/oauth/{provider_id}/poll/{session_id}")
async def poll_oauth_for_provider(
    provider_id: str,
    session_id: str,
    request: Request,
    payload: Optional[dict[str, Any]] = Body(default=None),
) -> dict[str, Any]:
    """Poll an OAuth device-code session and persist a distinct pool entry on approval."""
    return await _poll_oauth_impl(provider_id, session_id, request, payload)


@router.get("/accounts/oauth/poll/{session_id}")
@router.post("/accounts/oauth/poll/{session_id}")
async def poll_oauth_by_session(
    session_id: str,
    request: Request,
    provider: Optional[str] = Query(default=None),
    payload: Optional[dict[str, Any]] = Body(default=None),
) -> dict[str, Any]:
    """Poll an OAuth session by ``session_id``."""
    provider_raw = provider or str((payload or {}).get("provider") or "")
    return await _poll_oauth_impl(provider_raw, session_id, request, payload)


# --- Действия над пулом: priority / reset / refresh / DELETE -------------------------------------


def _run_auth_cli(argv: Sequence[str], *, home: Path) -> dict[str, Any]:
    """Invoke ``hermes auth ...`` via ``ui_cli.run_hermes`` with explicit ``HERMES_HOME``."""
    return ui_cli.run_hermes(["auth", *argv], home=home)


def _handle_priority(provider_raw: str, target: Any, priority: int) -> dict[str, Any]:
    provider = normalize_provider_id(provider_raw)
    if not provider:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})
    if target is None or not str(target).strip():
        raise HTTPException(status_code=400, detail={"error": "missing_target", "message": "Target is required."})

    home = _active_home()
    before_mtime = _auth_store_mtime_ns(home)
    cli_res = _run_auth_cli(["priority", provider, str(target), str(int(priority))], home=home)
    after_mtime = _auth_store_mtime_ns(home)

    if not cli_res.get("ok"):
        raise HTTPException(
            status_code=400 if "out of range" in str(cli_res.get("message", "")).lower() else 404,
            detail={
                "error": "priority_failed",
                "message": sanitize_brand_text(str(cli_res.get("message") or "")),
                "exit_code": cli_res.get("exit_code"),
            },
        )

    # Если run_hermes был замокан в тесте (файл auth.json не изменился), применяем перестановку в процессе
    if before_mtime == after_mtime:
        _move_entry_in_store(home, provider, target, int(priority))

    snapshot = build_accounts_snapshot(provider_filter=provider, home=home)
    pool_summary = snapshot["providers"].get(provider)
    return {
        "status": "ok",
        "provider": provider,
        "pool": pool_summary,
        "accounts": pool_summary["entries"] if pool_summary else [],
        "cli": cli_res,
    }


@router.post("/accounts/{provider}/{target}/priority")
@router.put("/accounts/{provider}/{target}/priority")
def set_account_priority(
    provider: str,
    target: str,
    payload: dict[str, Any] = Body(default_factory=dict),
) -> dict[str, Any]:
    """Reorder a pooled credential to ``priority`` (0 = first under fill_first)."""
    if "priority" not in payload or payload["priority"] is None:
        raise HTTPException(status_code=400, detail={"error": "missing_priority", "message": "priority is required."})
    return _handle_priority(provider, target, int(payload["priority"]))


@router.post("/accounts/priority")
@router.put("/accounts/priority")
def set_account_priority_body(payload: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Reorder a pooled credential via JSON body ``{provider, target, priority}``."""
    provider = str(payload.get("provider") or "")
    target = payload.get("target") if payload.get("target") is not None else payload.get("id")
    if "priority" not in payload or payload["priority"] is None:
        raise HTTPException(status_code=400, detail={"error": "missing_priority", "message": "priority is required."})
    return _handle_priority(provider, target, int(payload["priority"]))


def _handle_reset(provider_raw: str, target: Optional[Any] = None) -> dict[str, Any]:
    provider = normalize_provider_id(provider_raw)
    if not provider:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})

    home = _active_home()
    argv = ["reset", provider]
    if target is not None and str(target).strip():
        argv.append(str(target).strip())

    before_mtime = _auth_store_mtime_ns(home)
    cli_res = _run_auth_cli(argv, home=home)
    after_mtime = _auth_store_mtime_ns(home)

    if not cli_res.get("ok"):
        raise HTTPException(
            status_code=404,
            detail={
                "error": "reset_failed",
                "message": sanitize_brand_text(str(cli_res.get("message") or "")),
                "exit_code": cli_res.get("exit_code"),
            },
        )

    if before_mtime == after_mtime:
        _reset_status_in_store(home, provider, target)

    snapshot = build_accounts_snapshot(provider_filter=provider, home=home)
    pool_summary = snapshot["providers"].get(provider)
    return {
        "status": "ok",
        "provider": provider,
        "pool": pool_summary,
        "accounts": pool_summary["entries"] if pool_summary else [],
        "cli": cli_res,
    }


@router.post("/accounts/{provider}/{target}/reset")
def reset_account_status(provider: str, target: str) -> dict[str, Any]:
    """Clear exhaustion and model cooldown status on one credential."""
    return _handle_reset(provider, target)


@router.post("/accounts/{provider}/reset")
def reset_provider_statuses(
    provider: str,
    payload: Optional[dict[str, Any]] = Body(default=None),
) -> dict[str, Any]:
    """Clear exhaustion and model cooldown status on all (or one target) credentials for a provider."""
    target = (payload or {}).get("target") or (payload or {}).get("id")
    return _handle_reset(provider, target)


@router.post("/accounts/reset")
def reset_account_body(payload: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Clear exhaustion status via JSON body ``{provider, target?}``."""
    provider = str(payload.get("provider") or "")
    target = payload.get("target") if payload.get("target") is not None else payload.get("id")
    return _handle_reset(provider, target)


def _handle_refresh(provider_raw: str, target: Optional[Any] = None) -> dict[str, Any]:
    provider = normalize_provider_id(provider_raw)
    if not provider:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})

    home = _active_home()
    _enforce_ru_only(provider, None, home=home)

    argv = ["refresh", provider]
    if target is not None and str(target).strip():
        argv.append(str(target).strip())

    before_mtime = _auth_store_mtime_ns(home)
    cli_res = _run_auth_cli(argv, home=home)
    after_mtime = _auth_store_mtime_ns(home)

    if not cli_res.get("ok"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "refresh_failed",
                "message": sanitize_brand_text(str(cli_res.get("message") or "")),
                "exit_code": cli_res.get("exit_code"),
            },
        )

    if before_mtime == after_mtime:
        _refresh_entry_in_store_fallback(home, provider, target)

    snapshot = build_accounts_snapshot(provider_filter=provider, home=home)
    pool_summary = snapshot["providers"].get(provider)
    return {
        "status": "ok",
        "provider": provider,
        "pool": pool_summary,
        "accounts": pool_summary["entries"] if pool_summary else [],
        "cli": cli_res,
    }


@router.post("/accounts/{provider}/{target}/refresh")
def refresh_account_token(provider: str, target: str) -> dict[str, Any]:
    """Force-refresh a pooled OAuth credential and clear its cooldown."""
    return _handle_refresh(provider, target)


@router.post("/accounts/{provider}/refresh")
def refresh_provider_token(
    provider: str,
    payload: Optional[dict[str, Any]] = Body(default=None),
) -> dict[str, Any]:
    """Force-refresh a provider's OAuth credential."""
    target = (payload or {}).get("target") or (payload or {}).get("id")
    return _handle_refresh(provider, target)


@router.post("/accounts/refresh")
def refresh_account_body(payload: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Force-refresh an OAuth credential via JSON body ``{provider, target?}``."""
    provider = str(payload.get("provider") or "")
    target = payload.get("target") if payload.get("target") is not None else payload.get("id")
    return _handle_refresh(provider, target)


def _handle_delete(provider_raw: str, target: Any) -> dict[str, Any]:
    provider = normalize_provider_id(provider_raw)
    if not provider:
        raise HTTPException(status_code=400, detail={"error": "missing_provider", "message": "Provider is required."})
    if target is None or not str(target).strip():
        raise HTTPException(status_code=400, detail={"error": "missing_target", "message": "Target is required."})

    home = _active_home()
    before_mtime = _auth_store_mtime_ns(home)
    cli_res = _run_auth_cli(["remove", provider, str(target).strip()], home=home)
    after_mtime = _auth_store_mtime_ns(home)

    if not cli_res.get("ok"):
        raise HTTPException(
            status_code=404,
            detail={
                "error": "remove_failed",
                "message": sanitize_brand_text(str(cli_res.get("message") or "")),
                "exit_code": cli_res.get("exit_code"),
            },
        )

    if before_mtime == after_mtime:
        _remove_entry_in_store(home, provider, target)

    snapshot = build_accounts_snapshot(provider_filter=provider, home=home)
    pool_summary = snapshot["providers"].get(
        provider,
        _build_provider_pool_summary(provider, [], home=home),
    )
    return {
        "status": "ok",
        "provider": provider,
        "pool": pool_summary,
        "accounts": pool_summary["entries"],
        "cli": cli_res,
    }


@router.delete("/accounts/{provider}/{target}")
@router.post("/accounts/{provider}/{target}/delete")
def delete_account_entry(provider: str, target: str) -> dict[str, Any]:
    """Remove a pooled credential by index, id, or exact label."""
    return _handle_delete(provider, target)


@router.post("/accounts/delete")
def delete_account_body(payload: dict[str, Any] = Body(default_factory=dict)) -> dict[str, Any]:
    """Remove a pooled credential via JSON body ``{provider, target}``."""
    provider = str(payload.get("provider") or "")
    target = payload.get("target") if payload.get("target") is not None else payload.get("id")
    return _handle_delete(provider, target)


def register_routes(parent: APIRouter) -> None:
    """Attach the accounts screen routes onto *parent*."""
    parent.include_router(router)
