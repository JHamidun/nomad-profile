"""Классификатор ошибок Nomad Control Plane (M-096).

Обрабатывает хук ``transform_api_error_classification``: только для
провайдера NomadNet переопределяет ответы шлюза CP:
  * 402 ``insufficient_credits`` / ``insufficient_balance`` -> ``billing``
    без ретраев, ротации ключей и фолбэка;
  * 429 ``… credits used in the Ns window`` -> ``billing`` без ретраев;
  * 403 ``model_not_allowed`` -> ``billing`` без ретраев;
  * 503 ``not available on this deployment`` / ``no active price for model``
    -> ``model_not_found`` без ретраев.

Ошибки от других провайдеров не затрагиваются (возвращается ``None``).
"""

from __future__ import annotations

import re
from typing import Any

from . import core_adapter as core

PROVIDER_NAME = "NomadNet"
_NOMADNET_SLUGS = frozenset({
    "nomadnet",
    "custom:nomadnet",
    "nomad-cp",
    "custom:nomad-cp",
})

_BALANCE_CODES = frozenset({
    "insufficient_credits",
    "insufficient_balance",
    "balance_depleted",
    "payment_required",
})

_WINDOW_CREDITS_RE = re.compile(
    r"credits\s+used\s+in\s+the\s+(?:\d+\s*s\s+)?window",
    re.IGNORECASE,
)

_BILLING_VERDICT: dict[str, Any] = {
    "reason": "billing",
    "retryable": False,
    "should_compress": False,
    "should_rotate_credential": False,
    "should_fallback": False,
}

_MODEL_NOT_FOUND_VERDICT: dict[str, Any] = {
    "reason": "model_not_found",
    "retryable": False,
    "should_compress": False,
    "should_rotate_credential": False,
    "should_fallback": False,
}


def _find_nomadnet_entry(cfg: dict[str, Any]) -> dict[str, Any] | None:
    """Ищет запись custom-провайдера NomadNet в загруженном ``config.yaml``."""
    custom_providers = cfg.get("custom_providers")
    if isinstance(custom_providers, list):
        for item in custom_providers:
            if isinstance(item, dict) and str(item.get("name") or "").strip().lower() == "nomadnet":
                return item

    providers = cfg.get("providers")
    if isinstance(providers, dict):
        for key, item in providers.items():
            if str(key).strip().lower() == "nomadnet" and isinstance(item, dict):
                return item
            if isinstance(item, dict) and str(item.get("name") or "").strip().lower() == "nomadnet":
                return item
    elif isinstance(providers, list):
        for item in providers:
            if isinstance(item, dict) and str(item.get("name") or "").strip().lower() == "nomadnet":
                return item

    return None


def _is_nomadnet_provider(provider: str | None, model: str | None) -> bool:
    """Определяет, относится ли вызов к провайдеру NomadNet по ``provider``/``model``."""
    prov = (provider or "").strip().lower()
    mod = (model or "").strip()

    if prov in _NOMADNET_SLUGS:
        return True

    # Явно указан другой провайдер (openrouter, anthropic, openai, custom:novita и т.д.)
    if prov and prov != "custom":
        return False

    if not prov and not mod:
        return False

    try:
        cfg = core.load_config()
    except Exception:
        return False

    if not isinstance(cfg, dict):
        return False

    entry = _find_nomadnet_entry(cfg)
    if entry is None:
        return False

    entry_model = str(entry.get("model") or "").strip()
    entry_base_url = str(entry.get("base_url") or "").strip().rstrip("/")

    cfg_model = cfg.get("model") if isinstance(cfg.get("model"), dict) else {}
    cfg_default = str(cfg_model.get("default") or "").strip()
    cfg_base_url = str(cfg_model.get("base_url") or "").strip().rstrip("/")
    cfg_api_key = str(cfg_model.get("api_key") or "").strip()

    if prov == "custom":
        if not mod:
            return True
        if entry_model and mod == entry_model:
            return True
        if cfg_default and mod == cfg_default:
            return True
        if entry_base_url and cfg_base_url == entry_base_url:
            return True
        if "NOMADNET_API_KEY" in cfg_api_key:
            return True
        if not entry_model:
            return True
        return False

    # prov == "" — срабатывает только если model явно совпадает с моделью NomadNet в профиле
    if mod and entry_model and mod == entry_model:
        return True

    return False


def _extract_body(error_body: Any, error: Any) -> dict[str, Any]:
    if isinstance(error_body, dict) and error_body:
        return error_body
    raw = getattr(error, "body", None) if error is not None else None
    if isinstance(raw, dict):
        return raw
    return {}


def _extract_code(error_code: str | None, body: dict[str, Any]) -> str:
    if isinstance(error_code, str) and error_code.strip():
        return error_code.strip().lower()
    nested = body.get("error")
    if isinstance(nested, dict):
        code = nested.get("code")
        if isinstance(code, str) and code.strip():
            return code.strip().lower()
    top = body.get("code")
    if isinstance(top, str) and top.strip():
        return top.strip().lower()
    return ""


def _extract_body_message(body: dict[str, Any]) -> str:
    nested = body.get("error")
    if isinstance(nested, dict):
        msg = nested.get("message")
        if isinstance(msg, str) and msg.strip():
            return msg.strip()
    for key in ("message", "detail"):
        val = body.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _extract_combined_message(
    error_message: str | None,
    body: dict[str, Any],
    error: Any,
) -> str:
    parts: list[str] = []
    if isinstance(error_message, str) and error_message.strip():
        parts.append(error_message)
    body_msg = _extract_body_message(body)
    if body_msg:
        parts.append(body_msg)
    if error is not None:
        err_str = str(error)
        if err_str:
            parts.append(err_str)
    return "\n".join(parts).lower()


def _with_message(verdict: dict[str, Any], body: dict[str, Any]) -> dict[str, Any]:
    out = dict(verdict)
    body_msg = _extract_body_message(body)
    if body_msg:
        out["message"] = body_msg[:500]
    return out


def on_transform_api_error_classification(
    *,
    provider: str = "",
    model: str = "",
    status_code: int | None = None,
    error_type: str = "",
    error_code: str | None = None,
    error_message: str = "",
    error_body: dict[str, Any] | None = None,
    error: Any = None,
    approx_tokens: int = 0,
    context_length: int = 0,
    num_messages: int = 0,
    **kwargs: Any,
) -> dict[str, Any] | None:
    raw_status = status_code
    if raw_status is None and error is not None:
        raw_code = getattr(error, "status_code", None)
        if isinstance(raw_code, int):
            raw_status = raw_code

    # M-133: хук ошибки отслеживает 429 и ротацию аккаунтов в пул-ленту
    if raw_status == 429:
        try:
            from . import ui_switch_feed
            body_dict = _extract_body(error_body, error)
            rid = kwargs.get("api_request_id") or kwargs.get("request_id") or body_dict.get("id") or body_dict.get("request_id")
            if rid:
                ui_switch_feed.detect_and_record_switch(
                    api_request_id=str(rid),
                    provider=provider,
                    model=model,
                    status_code=429,
                )
        except Exception:
            pass

    if not _is_nomadnet_provider(provider, model):
        return None

    status_code = raw_status

    body = _extract_body(error_body, error)
    code = _extract_code(error_code, body)
    msg = _extract_combined_message(error_message, body, error)

    # 1. 402 insufficient_credits / insufficient_balance -> billing без ретраев, ротации и фолбэка
    if status_code == 402 and (
        code in _BALANCE_CODES
        or not code
        or "insufficient" in msg
        or "баланс" in msg
        or "средств" in msg
    ):
        return _with_message(_BILLING_VERDICT, body)

    # 2. 429 "... credits used in the Ns window" -> billing без ретрая
    if status_code == 429 and (
        _WINDOW_CREDITS_RE.search(msg) is not None
        or "credits used in the" in msg
    ):
        return _with_message(_BILLING_VERDICT, body)

    # 3. 403 model_not_allowed -> billing без ретрая
    if status_code == 403 and (
        code == "model_not_allowed"
        or "is not included in your current plan" in msg
    ):
        return _with_message(_BILLING_VERDICT, body)

    # 4. 503 "not available on this deployment" / "no active price for model" -> model_not_found
    if status_code in {503, 529} and (
        "not available on this deployment" in msg
        or "no active price for model" in msg
    ):
        return _with_message(_MODEL_NOT_FOUND_VERDICT, body)

    return None
