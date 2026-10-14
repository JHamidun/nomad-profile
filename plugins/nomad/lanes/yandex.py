"""Yandex Cloud Foundation Models executor lane implementation (M-184 / F-29).

Provides:
1. Credentials resolution (YANDEX_API_KEY, YANDEX_FOLDER_ID).
2. Model URI generation (gpt://<folder_id>/aliceai-llm-flash/latest).
3. Direct OpenAI-compatible chat completion caller against llm.api.cloud.yandex.net.
4. Preflight ru_only validation ensuring zero foreign network egress.
5. Swarm card execution under nomad.ru_only=true with audit verification.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import urllib.error
import urllib.request
from collections.abc import Mapping, Sequence
from typing import Any, Optional

from .. import db, money, ru_only

logger = logging.getLogger(__name__)

DEFAULT_YANDEX_MODEL = "aliceai-llm-flash/latest"
YANDEX_API_URL = "https://llm.api.cloud.yandex.net/v1/chat/completions"
YANDEX_OPENAI_BASE = "https://llm.api.cloud.yandex.net/v1"


class YandexError(RuntimeError):
    """Base error for Yandex lane operations."""


class YandexRuOnlyRefused(YandexError):
    """Raised when Russian sovereign contour validation fails."""


def get_yandex_credentials(env: Optional[Mapping[str, str]] = None) -> tuple[str, str]:
    """Retrieve Yandex API key and Folder ID from environment."""
    source = env if env is not None else os.environ
    key = (source.get("YANDEX_API_KEY") or "").strip()
    folder = (source.get("YANDEX_FOLDER_ID") or "").strip()
    return key, folder


def build_yandex_model_uri(folder_id: str, model: str = DEFAULT_YANDEX_MODEL) -> str:
    """Format full Yandex Cloud Foundation Models model URI."""
    clean_folder = folder_id.strip()
    clean_model = model.strip()
    if clean_model.startswith("gpt://"):
        return clean_model
    if not clean_folder:
        return clean_model
    return f"gpt://{clean_folder}/{clean_model}"


def call_yandex_chat(
    messages: Sequence[Mapping[str, Any]],
    *,
    model: str = DEFAULT_YANDEX_MODEL,
    api_key: Optional[str] = None,
    folder_id: Optional[str] = None,
    base_url: str = YANDEX_API_URL,
    temperature: float = 0.3,
    max_tokens: int = 256,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Execute chat completion request to Yandex Cloud Foundation Models."""
    env_key, env_folder = get_yandex_credentials()
    key = (api_key or env_key).strip()
    folder = (folder_id or env_folder).strip()

    if not key:
        raise YandexError("YANDEX_API_KEY is not configured")

    model_uri = build_yandex_model_uri(folder, model=model)
    payload: dict[str, Any] = {
        "model": model_uri,
        "messages": list(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    req = urllib.request.Request(
        base_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    if folder:
        req.add_header("x-folder-id", folder)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise YandexError(f"Yandex chat API HTTP {exc.code}: {err_msg}") from exc
    except Exception as exc:
        raise YandexError(f"Yandex chat network error: {exc}") from exc


def run_yandex_card(
    conn: sqlite3.Connection,
    task_id: str,
    prompt: str,
    *,
    swarm_id: Optional[str] = None,
    model: str = DEFAULT_YANDEX_MODEL,
    api_key: Optional[str] = None,
    folder_id: Optional[str] = None,
    config: Optional[Mapping[str, Any]] = None,
    env: Optional[Mapping[str, str]] = None,
) -> dict[str, Any]:
    """Run a real Kanban card on Yandex lane under RU-only verification."""
    effective_config = config or {
        "nomad": {
            "ru_only": True,
            "money": {
                "ceiling_usd": 5.0,
                "paid_provider_allowlist": ["yandex"],
            },
        }
    }

    # 1. Enforce ru_only compliance
    target = ru_only.LaneTarget(
        lane_id="yandex",
        provider="custom:yandex",
        base_url=YANDEX_OPENAI_BASE,
        model=model,
    )
    try:
        ru_only.require_ru_lane(
            ru_only.ACTION_START_LANE,
            target,
            env=env,
        )
    except ru_only.RuOnlyRefused as exc:
        raise YandexRuOnlyRefused(f"RU contour refused Yandex lane: {exc.reason}") from exc

    # 2. Execute via Nomad money guard
    def _do_call() -> dict[str, Any]:
        return call_yandex_chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            api_key=api_key,
            folder_id=folder_id,
        )

    res = money.execute_paid_call(
        conn,
        "yandex",
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
