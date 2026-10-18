"""GigaChat Foundation Models executor lane implementation (M-198 / Q8-R3 / F-16).

Provides:
1. Credentials resolution (GIGACHAT_CREDENTIALS / GIGACHAT_API_KEY).
2. OAuth token exchange with RqUID against ngw.devices.sberbank.ru:9443.
3. Chat completions caller against gigachat.devices.sberbank.ru/api/v1/chat/completions.
4. Support for Russian Ministry of Digital Development (Минцифры) TLS root certificates.
5. Preflight ru_only validation ensuring strictly sovereign RU contour network egress.
6. Swarm card execution under nomad.ru_only=true with audit verification.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from collections.abc import Mapping, Sequence
from typing import Any, Optional

from .. import db, money, ru_only

logger = logging.getLogger(__name__)

DEFAULT_GIGACHAT_MODEL = "GigaChat"
GIGACHAT_OAUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
GIGACHAT_API_URL = "https://gigachat.devices.sberbank.ru/api/v1/chat/completions"
GIGACHAT_OPENAI_BASE = "https://gigachat.devices.sberbank.ru/api/v1"
DEFAULT_SCOPE = "GIGACHAT_API_PERS"

# In-memory token cache: (access_token, expires_at_timestamp)
_TOKEN_CACHE: dict[str, tuple[str, float]] = {}


class GigaChatError(RuntimeError):
    """Base error for GigaChat lane operations."""


class GigaChatRuOnlyRefused(GigaChatError):
    """Raised when Russian sovereign contour validation fails."""


def get_gigachat_credentials(env: Optional[Mapping[str, str]] = None) -> str:
    """Retrieve GigaChat authorization credentials from environment."""
    source = env if env is not None else os.environ
    key = (
        source.get("GIGACHAT_CREDENTIALS")
        or source.get("GIGACHAT_API_KEY")
        or source.get("GIGACHAT_AUTH_KEY")
        or ""
    ).strip()
    return key


def create_gigachat_ssl_context(ca_bundle: Optional[str] = None) -> ssl.SSLContext:
    """Create SSLContext configured for Sberbank services with Минцифры root certificates."""
    bundle_path = (
        ca_bundle
        or os.environ.get("GIGACHAT_CA_BUNDLE")
        or os.environ.get("REQUESTS_CA_BUNDLE")
        or os.environ.get("SSL_CERT_FILE")
    )
    if bundle_path and os.path.isfile(bundle_path):
        ctx = ssl.create_default_context(cafile=bundle_path)
    else:
        ctx = ssl.create_default_context()
        # If running in environment without installed Минцифры CA, allow optional insecure fallback
        if os.environ.get("GIGACHAT_VERIFY_SSL", "").lower() in ("0", "false", "no"):
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
    return ctx


def get_gigachat_oauth_token(
    credentials: Optional[str] = None,
    *,
    scope: str = DEFAULT_SCOPE,
    oauth_url: str = GIGACHAT_OAUTH_URL,
    timeout: float = 30.0,
    ssl_context: Optional[ssl.SSLContext] = None,
    force_refresh: bool = False,
) -> str:
    """Exchange client credentials for OAuth Bearer token with unique RqUID."""
    cred = (credentials or get_gigachat_credentials()).strip()
    if not cred:
        raise GigaChatError("GIGACHAT_CREDENTIALS is not configured")

    cache_key = f"{cred}:{scope}"
    now = time.time()
    if not force_refresh and cache_key in _TOKEN_CACHE:
        token, expires_at = _TOKEN_CACHE[cache_key]
        if expires_at - now > 60:  # Refresh 60s before expiration
            return token

    rquid = str(uuid.uuid4())
    headers = {
        "Authorization": f"Basic {cred}",
        "RqUID": rquid,
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
    }
    data = urllib.parse.urlencode({"scope": scope}).encode("utf-8")
    req = urllib.request.Request(oauth_url, data=data, headers=headers, method="POST")

    ctx = ssl_context or create_gigachat_ssl_context()

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            access_token = body.get("access_token")
            if not access_token:
                raise GigaChatError(f"OAuth response missing access_token: {body}")
            expires_at = float(body.get("expires_at", now + 1800000) / 1000.0 if body.get("expires_at", 0) > 1e11 else body.get("expires_at", now + 1800))
            _TOKEN_CACHE[cache_key] = (access_token, expires_at)
            return access_token
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise GigaChatError(f"GigaChat OAuth HTTP {exc.code}: {err_msg}") from exc
    except Exception as exc:
        raise GigaChatError(f"GigaChat OAuth network error: {exc}") from exc


def call_gigachat_chat(
    messages: Sequence[Mapping[str, Any]],
    *,
    model: str = DEFAULT_GIGACHAT_MODEL,
    credentials: Optional[str] = None,
    token: Optional[str] = None,
    base_url: str = GIGACHAT_API_URL,
    temperature: float = 0.3,
    max_tokens: int = 256,
    timeout: float = 30.0,
    ssl_context: Optional[ssl.SSLContext] = None,
) -> dict[str, Any]:
    """Execute chat completion request against GigaChat API."""
    auth_token = token or get_gigachat_oauth_token(credentials, ssl_context=ssl_context)

    payload: dict[str, Any] = {
        "model": model,
        "messages": list(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )

    ctx = ssl_context or create_gigachat_ssl_context()

    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise GigaChatError(f"GigaChat chat API HTTP {exc.code}: {err_msg}") from exc
    except Exception as exc:
        raise GigaChatError(f"GigaChat chat network error: {exc}") from exc


def run_gigachat_card(
    conn: sqlite3.Connection,
    task_id: str,
    prompt: str,
    *,
    swarm_id: Optional[str] = None,
    model: str = DEFAULT_GIGACHAT_MODEL,
    credentials: Optional[str] = None,
    config: Optional[Mapping[str, Any]] = None,
    env: Optional[Mapping[str, str]] = None,
    ssl_context: Optional[ssl.SSLContext] = None,
) -> dict[str, Any]:
    """Run a real Kanban card on GigaChat lane under RU-only verification."""
    effective_config = config or {
        "nomad": {
            "ru_only": True,
            "money": {
                "ceiling_usd": 5.0,
                "paid_provider_allowlist": ["gigachat"],
            },
        }
    }

    # 1. Enforce ru_only compliance
    target = ru_only.LaneTarget(
        lane_id="gigachat",
        provider="gigachat",
        base_url=GIGACHAT_OPENAI_BASE,
        model=model,
    )
    try:
        ru_only.require_ru_lane(
            ru_only.ACTION_START_LANE,
            target,
            env=env,
        )
    except ru_only.RuOnlyRefused as exc:
        raise GigaChatRuOnlyRefused(f"RU contour refused GigaChat lane: {exc.reason}") from exc

    # 2. Execute via Nomad money guard
    def _do_call() -> dict[str, Any]:
        return call_gigachat_chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            credentials=credentials,
            ssl_context=ssl_context,
        )

    res = money.execute_paid_call(
        conn,
        "gigachat",
        _do_call,
        model=model,
        prompt_text=prompt,
        task_id=task_id,
        swarm_id=swarm_id,
        config=effective_config,
    )

    if not res.get("ok"):
        return {
            "ok": False,
            "status": res.get("status", "blocked"),
            "reason": res.get("reason"),
            "error_code": res.get("error_code"),
        }

    response = res.get("response", {})
    usage = response.get("usage", {})
    cost_usd = float(res.get("actual_usd") or res.get("cost_usd") or 0.0)
    choice = (response.get("choices") or [{}])[0]
    content = choice.get("message", {}).get("content", "")

    return {
        "ok": True,
        "task_id": task_id,
        "swarm_id": swarm_id,
        "model": model,
        "content": content,
        "usage": usage,
        "cost_usd": cost_usd,
        "ru_only": True,
    }
