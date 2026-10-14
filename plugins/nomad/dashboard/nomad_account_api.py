"""FastAPI screen module for NomadNet account & connection endpoints (M-100).

Mounted under ``/api/plugins/nomad`` by :mod:`package.plugins.nomad.dashboard.plugin_api`:
- ``POST /api/plugins/nomad/connect`` -> :func:`package.plugins.nomad.activation.connect`
- ``GET  /api/plugins/nomad/account`` -> :func:`package.plugins.nomad.account.get_account_state`
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, Body

from .. import account, activation
from .. import core_adapter as core

router = APIRouter()


@router.post("/connect")
def connect_nomad_account(
    payload: Optional[Dict[str, Any]] = Body(default=None),
) -> Dict[str, Any]:
    """Validate and activate a NomadNet key against the Control Plane."""
    body = payload if isinstance(payload, dict) else {}

    raw_cp_url = body.get("cp_url")
    if isinstance(raw_cp_url, str) and raw_cp_url.strip():
        normalized_cp = activation.normalize_cp_url(raw_cp_url)
        if normalized_cp is None:
            code = activation.CODE_BAD_REQUEST
            return {
                "ok": False,
                "connected": False,
                "status": code,
                "code": code,
                "message": "Invalid NomadNet Control Plane URL.",
            }
        core.save_env_value(activation.CP_URL_ENV, normalized_cp)

    raw_key = body.get("key")
    if not isinstance(raw_key, str) or not raw_key.strip():
        raw_key = body.get("api_key")
    key = raw_key.strip() if isinstance(raw_key, str) else ""

    result = activation.connect(key)
    ok = bool(result.get("ok"))
    code = result.get("code")
    return {
        **result,
        "ok": ok,
        "connected": ok,
        "status": "connected" if ok else (code or "error"),
        "key_present": True if ok else bool((core.get_env_value(activation.KEY_ENV) or "").strip()),
    }


@router.get("/account")
def get_nomad_account() -> Dict[str, Any]:
    """Return current NomadNet connection status and Control Plane balance."""
    return account.get_account_state()
