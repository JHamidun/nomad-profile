"""Т-Банк (T-Pro 2.0 / T-Lite 2.0) и Cloud.ru Evolution — российские суверенные дорожки (152-ФЗ).

Поддерживает OpenAI-совместимые корпоративные эндпоинты:
- Т-Банк GenAI: ``https://api.tbank.ru/v1`` (модели ``T-pro-it-2.0``, ``T-lite-it-2.0``)
- Cloud.ru Evolution Foundation Models: ``https://foundation-models.api.cloud.ru/v1``
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Mapping, Optional

from .. import core_adapter, db, ru_only

LANE_ID = "tbank"
PROVIDER = "tbank"
DEFAULT_BASE_URL = "https://api.tbank.ru/v1"
CLOUDRU_BASE_URL = "https://foundation-models.api.cloud.ru/v1"

MODEL_TPRO_2 = "T-pro-it-2.0"
MODEL_TLITE_2 = "T-lite-it-2.0"
DEFAULT_MODEL = MODEL_TPRO_2

ENV_TBANK_KEY = "TBANK_API_KEY"
ENV_TPRO_KEY = "TPRO_API_KEY"
ENV_CLOUDRU_KEY = "CLOUDRU_API_KEY"


class TProError(RuntimeError):
    """Ошибка суверенной дорожки T-Pro / Cloud.ru."""


@dataclass(frozen=True)
class TProConfig:
    api_key: str
    provider: str = PROVIDER
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL


@dataclass(frozen=True)
class TProResult:
    ok: bool
    text: str
    model: str
    provider: str = PROVIDER
    status: str = "completed"
    input_tokens: int = 0
    output_tokens: int = 0
    total_tokens: int = 0
    duration_ms: int = 0
    error: Optional[str] = None
    raw: dict[str, Any] = field(default_factory=dict)


def _read_setting(name: str, env: Optional[Mapping[str, str]]) -> str:
    if env is not None and name in env:
        return str(env.get(name) or "").strip()
    val = os.environ.get(name)
    if val and val.strip():
        return val.strip()
    try:
        from_profile = core_adapter.get_env_value(name)
    except Exception:
        from_profile = None
    return str(from_profile or "").strip()


def resolve_config(
    *,
    env: Optional[Mapping[str, str]] = None,
    provider: str = PROVIDER,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> TProConfig:
    is_cloudru = provider in ("cloudru", "cloud-ru", "sbercloud")
    if is_cloudru:
        api_key = _read_setting(ENV_CLOUDRU_KEY, env) or _read_setting(ENV_TBANK_KEY, env)
        default_url = CLOUDRU_BASE_URL
        canon_provider = "cloudru"
    else:
        api_key = _read_setting(ENV_TBANK_KEY, env) or _read_setting(ENV_TPRO_KEY, env)
        default_url = DEFAULT_BASE_URL
        canon_provider = "tbank"

    if not api_key:
        raise TProError(f"Не задан API-ключ для {canon_provider} ({ENV_TBANK_KEY} / {ENV_CLOUDRU_KEY})")

    resolved_base = (base_url or default_url).strip().rstrip("/")
    resolved_model = (model or DEFAULT_MODEL).strip()
    return TProConfig(
        api_key=api_key,
        provider=canon_provider,
        model=resolved_model,
        base_url=resolved_base,
    )


def run_prompt(
    prompt: str,
    *,
    provider: str = PROVIDER,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    env: Optional[Mapping[str, str]] = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    timeout_s: float = 60.0,
    conn: Any = None,
    swarm_id: Optional[str] = None,
) -> TProResult:
    cfg = resolve_config(env=env, provider=provider, model=model, base_url=base_url)
    target = ru_only.LaneTarget(
        lane_id=cfg.provider,
        provider=cfg.provider,
        base_url=cfg.base_url,
        model=cfg.model,
    )
    ru_only.require_ru_lane(ru_only.ACTION_START_LANE, target)

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": cfg.model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    url = f"{cfg.base_url}/chat/completions"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "Authorization": f"Bearer {cfg.api_key}",
        },
    )

    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw_text = resp.read().decode("utf-8", errors="replace")
            data = json.loads(raw_text) if raw_text.strip() else {}
    except (OSError, urllib.error.URLError, ValueError) as exc:
        duration_ms = int((time.monotonic() - started) * 1000)
        return TProResult(
            ok=False,
            text="",
            model=cfg.model,
            provider=cfg.provider,
            status="failed",
            duration_ms=duration_ms,
            error=str(exc),
        )

    duration_ms = int((time.monotonic() - started) * 1000)
    choices = data.get("choices") if isinstance(data, dict) else None
    text = ""
    if isinstance(choices, list) and choices:
        msg = choices[0].get("message") if isinstance(choices[0], dict) else {}
        if isinstance(msg, dict):
            text = str(msg.get("content") or "")
    usage = data.get("usage") if isinstance(data, dict) and isinstance(data.get("usage"), dict) else {}
    in_tok = int(usage.get("prompt_tokens") or 0)
    out_tok = int(usage.get("completion_tokens") or 0)
    tot_tok = int(usage.get("total_tokens") or (in_tok + out_tok))

    if conn is not None and swarm_id:
        try:
            db.append_event(
                conn,
                swarm_id,
                "lane_completed",
                {"lane": cfg.provider, "model": cfg.model, "tokens": tot_tok, "duration_ms": duration_ms},
            )
        except Exception:
            pass

    return TProResult(
        ok=True,
        text=text,
        model=cfg.model,
        provider=cfg.provider,
        status="completed",
        input_tokens=in_tok,
        output_tokens=out_tok,
        total_tokens=tot_tok,
        duration_ms=duration_ms,
        raw=data if isinstance(data, dict) else {},
    )
