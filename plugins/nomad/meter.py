"""Token meter (M-107): records ``post_api_request`` usage into ``plugin-data/nomad/data.db``.

Каждое завершённое обращение ядра к модели вызывает хук ``post_api_request`` с уникальным
``api_request_id`` и сводкой ``usage``. Обработчик пишет строку в единую таблицу ``usage_events``
базы плагина (``db.record_usage``): она служит и токен-метру M1, и трём счётчикам роя (M-173).
Повторная доставка того же ``api_request_id`` отсекается уникальным ограничением таблицы
(``INSERT OR IGNORE``).
"""

from __future__ import annotations

from collections.abc import Mapping
import logging
import os
from typing import Any, Optional

from . import core_adapter, db, profile_config

logger = logging.getLogger("hermes_plugins.nomad.meter")

_ACCOUNT_ENV_KEYS = ("NOMAD_ACCOUNT_ID", "NOMADNET_ACCOUNT_ID", "NOMAD_ACCOUNT")


def _clean_str(value: Any) -> str:
    if value is None or isinstance(value, bool):
        return ""
    return str(value).strip()


def _first_str(*values: Any) -> str:
    for value in values:
        text = _clean_str(value)
        if text:
            return text
    return ""


def _int_or_none(value: Any) -> Optional[int]:
    if value is None or isinstance(value, bool):
        return None
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return None


def _first_int(*values: Any, default: int = 0) -> int:
    for value in values:
        parsed = _int_or_none(value)
        if parsed is not None:
            return parsed
    return default


def _first_float(*values: Any, default: float = 0.0) -> float:
    for value in values:
        if value is None or isinstance(value, bool):
            continue
        try:
            return max(0.0, float(value))
        except (TypeError, ValueError):
            continue
    return default


def _resolve_account(data: Mapping[str, Any], usage: Mapping[str, Any],
                     response: Mapping[str, Any]) -> str:
    """Resolve the account identifier for the request (explicit -> env -> config -> profile -> '')."""
    explicit = _first_str(
        data.get("account"),
        data.get("account_id"),
        usage.get("account"),
        usage.get("account_id"),
        response.get("account"),
        response.get("account_id"),
    )
    if explicit:
        return explicit

    for env_key in _ACCOUNT_ENV_KEYS:
        val = _clean_str(os.environ.get(env_key)) or _clean_str(core_adapter.get_env_value(env_key))
        if val:
            return val

    try:
        cfg = profile_config.read_profile_config()
    except Exception:
        cfg = {}
    nomad_cfg = cfg.get("nomad") if isinstance(cfg, Mapping) else None
    if isinstance(nomad_cfg, Mapping):
        configured = _first_str(nomad_cfg.get("account"), nomad_cfg.get("account_id"))
        if configured:
            return configured

    try:
        active_profile = _clean_str(core_adapter.get_active_profile())
    except Exception:
        active_profile = ""
    if active_profile and active_profile != "default":
        return active_profile
    return ""


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def extract_usage_record(data: Mapping[str, Any]) -> Optional[dict[str, Any]]:
    """Normalize a ``post_api_request`` hook payload into ``db.record_usage`` keyword arguments.

    Returns ``None`` when ``api_request_id`` is missing or blank.
    """
    response = _mapping(data.get("response"))
    usage = _mapping(data.get("usage"))
    if not usage:
        usage = _mapping(response.get("usage"))

    api_request_id = _first_str(
        data.get("api_request_id"),
        data.get("request_id"),
        response.get("id"),
    )
    if not api_request_id:
        return None

    prompt_details = _mapping(usage.get("prompt_tokens_details")) or _mapping(
        usage.get("input_tokens_details")
    )
    completion_details = _mapping(usage.get("completion_tokens_details")) or _mapping(
        usage.get("output_tokens_details")
    )

    cache_read_tokens = _first_int(
        usage.get("cache_read_tokens"),
        usage.get("cache_read_input_tokens"),
        data.get("cache_read_tokens"),
    )
    cache_write_tokens = _first_int(
        usage.get("cache_write_tokens"),
        usage.get("cache_creation_input_tokens"),
        data.get("cache_write_tokens"),
    )
    cached_tokens = _first_int(
        usage.get("cached_tokens"),
        data.get("cached_tokens"),
        prompt_details.get("cached_tokens"),
        default=cache_read_tokens + cache_write_tokens,
    )
    if cache_read_tokens == 0 and cache_write_tokens == 0 and cached_tokens > 0:
        cache_read_tokens = cached_tokens

    input_tokens = _first_int(
        usage.get("input_tokens"),
        data.get("input_tokens"),
        usage.get("prompt_tokens"),
        data.get("prompt_tokens"),
    )
    output_tokens = _first_int(
        usage.get("output_tokens"),
        data.get("output_tokens"),
        usage.get("completion_tokens"),
        data.get("completion_tokens"),
    )
    reasoning_tokens = _first_int(
        usage.get("reasoning_tokens"),
        data.get("reasoning_tokens"),
        completion_details.get("reasoning_tokens"),
    )
    total_tokens = _first_int(
        usage.get("total_tokens"),
        data.get("total_tokens"),
        default=0,
    )
    if total_tokens == 0 and (input_tokens or output_tokens or cached_tokens):
        prompt_total = _int_or_none(usage.get("prompt_tokens"))
        if prompt_total is not None and prompt_total >= input_tokens:
            total_tokens = prompt_total + output_tokens
        else:
            total_tokens = input_tokens + output_tokens + cached_tokens

    cost_usd = _first_float(
        data.get("cost_usd"),
        data.get("cost"),
        usage.get("cost_usd"),
        usage.get("cost"),
        response.get("cost_usd"),
    )

    account = _resolve_account(data, usage, response)
    provider = _first_str(data.get("provider"), response.get("provider"))
    model = _first_str(data.get("model"), data.get("response_model"), response.get("model"))
    task_id = _first_str(data.get("task_id"), os.environ.get("NOMAD_TASK_ID")) or None
    goal_id = _first_str(
        data.get("goal_id"),
        data.get("swarm_id"),
        os.environ.get("NOMAD_GOAL_ID"),
        os.environ.get("NOMAD_SWARM_ID"),
    ) or None
    swarm_id = _first_str(
        data.get("swarm_id"),
        data.get("goal_id"),
        os.environ.get("NOMAD_SWARM_ID"),
        os.environ.get("NOMAD_GOAL_ID"),
    ) or None
    lane = _first_str(data.get("lane"), os.environ.get("NOMAD_LANE")) or None
    billing = _first_str(data.get("billing"), os.environ.get("NOMAD_BILLING")) or None
    if not billing:
        try:
            from . import billing as billing_mod

            if billing_mod._is_nomadnet_provider(provider, model):
                billing = "nomadnet"
        except Exception:
            pass
    session_id = _first_str(data.get("session_id")) or None
    turn_id = _first_str(data.get("turn_id")) or None
    created_at = _first_str(data.get("created_at"), data.get("ts")) or None

    return {
        "api_request_id": api_request_id,
        "account": account,
        "provider": provider,
        "model": model,
        "task_id": task_id,
        "goal_id": goal_id,
        "swarm_id": swarm_id,
        "lane": lane,
        "billing": billing,
        "session_id": session_id,
        "turn_id": turn_id,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "cached_tokens": cached_tokens,
        "cache_read_tokens": cache_read_tokens,
        "cache_write_tokens": cache_write_tokens,
        "reasoning_tokens": reasoning_tokens,
        "total_tokens": total_tokens,
        "cost_usd": cost_usd,
        "created_at": created_at,
    }


def on_post_api_request(
    payload: Optional[Mapping[str, Any]] = None,
    /,
    **kwargs: Any,
) -> bool:
    """Plugin hook callback for ``post_api_request``.

    Accepts either keyword arguments (as dispatched by ``PluginManager.invoke_hook``) or a single
    positional mapping, writes the usage row into ``plugin-data/nomad/data.db``, and deduplicates
    repeated calls with the same ``api_request_id``.
    """
    merged: dict[str, Any] = {}
    if isinstance(payload, Mapping):
        merged.update(payload)
    if kwargs:
        merged.update(kwargs)

    record = extract_usage_record(merged)
    if record is None:
        logger.debug("nomad.meter: skipping post_api_request without api_request_id")
        return False

    try:
        conn = db.connect()
        try:
            return db.record_usage(conn, **record)
        finally:
            conn.close()
    except Exception as exc:
        logger.warning("nomad.meter: failed to record usage for %s: %s", record["api_request_id"], exc)
        return False
