"""МТС AI (Cotype Pro 3 / Cotype Light / Kodify) — российская суверенная дорожка (152-ФЗ).

Интеграция с MTS Web Services (MWS GPT / MTS AI API) по OpenAI-совместимому протоколу:
- Базовый эндпоинт: ``https://api.gpt.mws.ru/v1`` (резервный: ``https://api.mts.ai/v1``)
- Флагманские модели:
  * ``cotype-pro-3`` — глубокое рассуждение, аналитика, корпоративные документы РФ
  * ``cotype-light`` — быстрая генерация, классификация и суммаризация
  * ``kodify-pro`` — генерация и ревью кода в закрытом контуре
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

LANE_ID = "mts-ai"
PROVIDER = "mts-ai"
DEFAULT_BASE_URL = "https://api.gpt.mws.ru/v1"
FALLBACK_BASE_URL = "https://api.mts.ai/v1"

MODEL_COTYPE_PRO = "cotype-pro-3"
MODEL_COTYPE_LIGHT = "cotype-light"
MODEL_KODIFY = "kodify-pro"
DEFAULT_MODEL = MODEL_COTYPE_PRO

ENV_API_KEY = "MTS_AI_API_KEY"
ENV_COTYPE_KEY = "COTYPE_API_KEY"
ENV_BASE_URL = "MTS_BASE_URL"


class MtsAiError(RuntimeError):
    """Ошибка дорожки МТС AI (Cotype)."""


@dataclass(frozen=True)
class MtsAiConfig:
    api_key: str
    model: str = DEFAULT_MODEL
    base_url: str = DEFAULT_BASE_URL


@dataclass(frozen=True)
class MtsAiResult:
    ok: bool
    text: str
    model: str
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
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> MtsAiConfig:
    api_key = _read_setting(ENV_API_KEY, env) or _read_setting(ENV_COTYPE_KEY, env)
    if not api_key:
        raise MtsAiError(f"Не задан ключ МТС AI ({ENV_API_KEY} или {ENV_COTYPE_KEY})")
    resolved_base = (base_url or _read_setting(ENV_BASE_URL, env) or DEFAULT_BASE_URL).strip().rstrip("/")
    resolved_model = (model or DEFAULT_MODEL).strip()
    return MtsAiConfig(api_key=api_key, model=resolved_model, base_url=resolved_base)


def run_prompt(
    prompt: str,
    *,
    system_prompt: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
    env: Optional[Mapping[str, str]] = None,
    temperature: float = 0.2,
    max_tokens: int = 4096,
    timeout_s: float = 60.0,
    conn: Any = None,
    swarm_id: Optional[str] = None,
) -> MtsAiResult:
    cfg = resolve_config(env=env, model=model, base_url=base_url)
    target = ru_only.LaneTarget(
        lane_id=LANE_ID,
        provider=PROVIDER,
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
        return MtsAiResult(
            ok=False,
            text="",
            model=cfg.model,
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
                {"lane": LANE_ID, "model": cfg.model, "tokens": tot_tok, "duration_ms": duration_ms},
            )
        except Exception:
            pass

    return MtsAiResult(
        ok=True,
        text=text,
        model=cfg.model,
        status="completed",
        input_tokens=in_tok,
        output_tokens=out_tok,
        total_tokens=tot_tok,
        duration_ms=duration_ms,
        raw=data if isinstance(data, dict) else {},
    )
