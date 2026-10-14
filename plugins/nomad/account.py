"""NomadNet Control Plane account & balance client (M-100, M-101).

Queries the configured NomadNet Control Plane for the current account balance,
plan/tariff, and connection state without ever exposing ``NOMADNET_API_KEY``.
All Hermes core config/env reads go through :mod:`package.plugins.nomad.core_adapter`
and :mod:`package.plugins.nomad.activation`.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Tuple, Union

import httpx

from . import activation
from . import core_adapter as core

KEY_ENV = activation.KEY_ENV
CP_URL_ENV = activation.CP_URL_ENV
PROVIDER_NAME = activation.PROVIDER_NAME
PROBE_TIMEOUT_S = activation.PROBE_TIMEOUT_S

CODE_CP_URL_UNSET = activation.CODE_CP_URL_UNSET
CODE_MISSING_KEY = activation.CODE_MISSING_KEY
CODE_INVALID_KEY = activation.CODE_INVALID_KEY
CODE_UNREACHABLE = activation.CODE_UNREACHABLE
CODE_CP_UNAVAILABLE = activation.CODE_CP_UNAVAILABLE
CODE_BAD_REQUEST = activation.CODE_BAD_REQUEST

ACCOUNT_PATHS: Tuple[str, ...] = ("/account", "/v1/account")

Number = Union[int, float]


def _coerce_number(value: Any) -> Optional[Number]:
    """Convert int/float/numeric-string into an int (if integral) or float."""
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value.is_integer():
            return int(value)
        return value
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        try:
            if "." in text or "e" in text.lower():
                num = float(text)
                return int(num) if num.is_integer() else num
            return int(text)
        except ValueError:
            return None
    return None


def format_balance(value: Optional[Number]) -> Optional[str]:
    """Format a numeric balance cleanly without trailing `.0` noise."""
    num = _coerce_number(value)
    if num is None:
        return None
    if isinstance(num, int):
        return str(num)
    if num.is_integer():
        return str(int(num))
    return f"{num:g}" if abs(num) >= 1e-4 else f"{num:.6f}".rstrip("0").rstrip(".")


def _extract_account_fields(payload: Any) -> Dict[str, Any]:
    """Normalize diverse CP `/account` JSON shapes into a canonical dict."""
    if isinstance(payload, (int, float)) and not isinstance(payload, bool):
        bal = _coerce_number(payload)
        return {
            "balance": bal,
            "available": bal,
            "reserved": None,
            "currency": None,
            "plan": None,
            "account_id": None,
            "email": None,
        }

    if not isinstance(payload, dict):
        return {
            "balance": None,
            "available": None,
            "reserved": None,
            "currency": None,
            "plan": None,
            "account_id": None,
            "email": None,
        }

    source: Dict[str, Any] = payload
    for wrapper_key in ("account", "data", "result", "wallet"):
        nested = payload.get(wrapper_key)
        if isinstance(nested, dict):
            merged = dict(nested)
            for k, v in payload.items():
                if k != wrapper_key and k not in merged:
                    merged[k] = v
            source = merged
            break

    balance: Optional[Number] = None
    for key in (
        "balance",
        "available",
        "credits",
        "credits_left",
        "balance_credits",
        "balance_usd",
        "balance_rub",
        "amount",
    ):
        if key in source:
            candidate = _coerce_number(source.get(key))
            if candidate is not None:
                balance = candidate
                break

    available = _coerce_number(source.get("available"))
    if available is None:
        available = balance

    reserved: Optional[Number] = None
    for key in ("reserved", "locked", "hold"):
        if key in source:
            candidate = _coerce_number(source.get(key))
            if candidate is not None:
                reserved = candidate
                break

    currency: Optional[str] = None
    for key in ("currency", "unit"):
        val = source.get(key)
        if isinstance(val, str) and val.strip():
            currency = val.strip()
            break

    plan: Optional[str] = None
    for key in ("plan", "tariff", "tier", "subscription"):
        val = source.get(key)
        if isinstance(val, str) and val.strip():
            plan = val.strip()
            break

    account_id: Optional[str] = None
    for key in ("account_id", "id", "user_id"):
        val = source.get(key)
        if isinstance(val, (str, int)) and not isinstance(val, bool):
            text = str(val).strip()
            if text:
                account_id = text
                break

    email: Optional[str] = None
    raw_email = source.get("email")
    if isinstance(raw_email, str) and raw_email.strip():
        email = raw_email.strip()

    return {
        "balance": balance,
        "available": available,
        "reserved": reserved,
        "currency": currency,
        "plan": plan,
        "account_id": account_id,
        "email": email,
    }


def _resolve_api_key(explicit_key: Optional[str] = None) -> str:
    if isinstance(explicit_key, str) and explicit_key.strip():
        return explicit_key.strip()
    env_key = (core.get_env_value(KEY_ENV) or "").strip()
    if env_key:
        return env_key
    return os.environ.get(KEY_ENV, "").strip()


def _base_state(status_info: Dict[str, Any], cp_url: Optional[str], key_present: bool) -> Dict[str, Any]:
    return {
        "ok": False,
        "code": None,
        "status": "disconnected",
        "connected": False,
        "reachable": False,
        "balance": None,
        "formatted_balance": None,
        "available": None,
        "reserved": None,
        "currency": None,
        "plan": None,
        "account_id": None,
        "email": None,
        "provider": status_info.get("provider"),
        "model": status_info.get("model"),
        "base_url": status_info.get("base_url"),
        "cp_url": cp_url,
        "key_present": bool(key_present),
        "message": None,
    }


def probe_account(cp_url: str, key: str) -> Dict[str, Any]:
    """Query Control Plane ``GET /account`` (falling back to ``/v1/account`` on 404)."""
    headers = {
        "Authorization": f"Bearer {key}",
        "X-API-Key": key,
        "Accept": "application/json",
    }
    last_response: Optional[httpx.Response] = None
    try:
        with activation._http_client(cp_url) as client:
            for idx, path in enumerate(ACCOUNT_PATHS):
                resp = client.get(f"{cp_url}{path}", headers=headers)
                last_response = resp
                if resp.status_code == 404 and idx + 1 < len(ACCOUNT_PATHS):
                    continue
                break
    except httpx.HTTPError as exc:
        return {
            "ok": False,
            "code": CODE_UNREACHABLE,
            "reachable": False,
            "message": f"Could not reach NomadNet Control Plane at {cp_url}: {exc}",
        }

    assert last_response is not None
    status_code = last_response.status_code
    if status_code in (401, 403):
        return {
            "ok": False,
            "code": CODE_INVALID_KEY,
            "reachable": True,
            "message": (
                f"NomadNet Control Plane rejected {KEY_ENV} "
                f"(HTTP {status_code}). Check your key and try again."
            ),
        }
    if status_code >= 500:
        return {
            "ok": False,
            "code": CODE_CP_UNAVAILABLE,
            "reachable": True,
            "message": f"NomadNet Control Plane returned HTTP {status_code}.",
        }
    if status_code != 200:
        return {
            "ok": False,
            "code": CODE_CP_UNAVAILABLE,
            "reachable": True,
            "message": f"NomadNet Control Plane /account returned HTTP {status_code}.",
        }

    try:
        payload = last_response.json()
    except ValueError:
        payload = last_response.text.strip()

    fields = _extract_account_fields(payload)
    if fields["balance"] is None:
        return {
            "ok": False,
            "code": CODE_CP_UNAVAILABLE,
            "reachable": True,
            "message": "NomadNet Control Plane /account response did not include a numeric balance.",
        }

    return {
        "ok": True,
        "code": None,
        "reachable": True,
        "message": None,
        **fields,
    }


def get_account_state(
    *,
    cp_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Return full account connection + balance state from the Control Plane."""
    status_info = activation.connection_status()
    key = _resolve_api_key(api_key)
    key_present = bool(key)

    if cp_url is not None:
        normalized_cp = activation.normalize_cp_url(cp_url)
        cp_err = (
            None
            if normalized_cp is not None
            else {
                "ok": False,
                "code": CODE_BAD_REQUEST,
                "message": "Invalid NomadNet Control Plane URL.",
            }
        )
    else:
        normalized_cp, cp_err = activation.resolve_cp_url()

    state = _base_state(status_info, normalized_cp, key_present)

    if cp_err is not None:
        code = cp_err.get("code") or CODE_CP_URL_UNSET
        state.update(
            {
                "ok": False,
                "code": code,
                "status": code,
                "connected": False,
                "reachable": False,
                "message": cp_err.get("message"),
            }
        )
        return state

    assert normalized_cp is not None

    if not key_present:
        state.update(
            {
                "ok": False,
                "code": CODE_MISSING_KEY,
                "status": CODE_MISSING_KEY,
                "connected": False,
                "reachable": False,
                "message": f"{KEY_ENV} is not configured. Connect your NomadNet key first.",
            }
        )
        return state

    probe = probe_account(normalized_cp, key)
    if not probe.get("ok"):
        code = probe.get("code") or CODE_CP_UNAVAILABLE
        state.update(
            {
                "ok": False,
                "code": code,
                "status": code,
                "connected": False,
                "reachable": bool(probe.get("reachable")),
                "message": probe.get("message"),
            }
        )
        return state

    balance = probe.get("balance")
    state.update(
        {
            "ok": True,
            "code": None,
            "status": "connected",
            "connected": True,
            "reachable": True,
            "balance": balance,
            "formatted_balance": format_balance(balance),
            "available": probe.get("available"),
            "reserved": probe.get("reserved"),
            "currency": probe.get("currency"),
            "plan": probe.get("plan"),
            "account_id": probe.get("account_id"),
            "email": probe.get("email"),
            "provider": status_info.get("provider") or PROVIDER_NAME,
            "model": status_info.get("model"),
            "base_url": status_info.get("base_url") or f"{normalized_cp}/v1",
            "cp_url": normalized_cp,
            "key_present": True,
            "message": None,
        }
    )
    return state


def get_balance(
    *,
    cp_url: Optional[str] = None,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Alias for :func:`get_account_state` used by CLI and API callers."""
    return get_account_state(cp_url=cp_url, api_key=api_key)
