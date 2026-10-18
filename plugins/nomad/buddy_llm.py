"""Живая LLM для Бадди (Ника / Сократ) — тот же провайдер и тот же ключ, что у чата.

До этого модуля эндпоинт ``/api/plugins/nomad/buddy/ask`` искал в окружении ``OPENROUTER_API_KEY``,
``OPENAI_API_KEY`` или ``DEEPSEEK_API_KEY`` и ходил с ними НАПРЯМУЮ к провайдеру. У платного
подписчика NomadNet таких ключей нет (у него один ``nmd_…``), поэтому Бадди молча отвечал
заготовкой, а если у человека случайно лежал свой ключ — запрос шёл мимо подписки и мимо счёта CP.

Порядок теперь такой:

1. NomadNet подключён (``activation.connection_status()['connected']``) — запрос идёт в
   ``{cp}/v1/chat/completions`` с ключом подписчика и моделью чата. Других ключей не трогаем,
   даже если они есть: подписчик платит за Бадди так же, как за чат.
2. Иначе — основная модель профиля, если у неё явный ``base_url`` и ключ (как у чата).
3. Иначе — прежние ключи из окружения (OpenRouter / OpenAI / DeepSeek).

Ответ CP 402 не прячется за заготовкой: Бадди возвращает русский текст CP и ссылку на пополнение
(``billing_block``), как карточка пополнения в чате. Каждое платное обращение пишется в счётчик
плагина (``usage_events``) с ``billing='nomadnet'`` — так локальный счёт совпадает с журналом CP
(SRV-03: считаются и вспомогательные вызовы). Ключ никогда не попадает в ответ и в логи.
"""

from __future__ import annotations

import logging
import re
import uuid
from typing import Any, Dict, Optional
from urllib.parse import urlsplit

logger = logging.getLogger("hermes_plugins.nomad.buddy_llm")

TIMEOUT_S = 30.0
MAX_TOKENS = 600
TOPUP_PATH = "/cabinet/topup"
BILLING_NOMADNET = "nomadnet"

# Запасные маршруты для покупателя без подписки (свой ключ). Модели — актуальные, без gpt-4o*.
_ENV_FALLBACKS = (
    ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1", "google/gemini-2.5-flash"),
    ("OPENAI_API_KEY", "https://api.openai.com/v1", "gpt-5.4-mini"),
    ("DEEPSEEK_API_KEY", "https://api.deepseek.com/v1", "deepseek-chat"),
)

_ENV_REF = re.compile(r"^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$")


def topup_url_for(cp_url: Optional[str]) -> Optional[str]:
    """Страница пополнения в кабинете того же CP, что выдал ключ (``{cp}/cabinet/topup``)."""
    if not cp_url:
        return None
    return f"{str(cp_url).rstrip('/')}{TOPUP_PATH}"


def _expand_key(core: Any, raw: Any) -> str:
    text = str(raw or "").strip()
    match = _ENV_REF.match(text)
    if match:
        try:
            return str(core.get_env_value(match.group(1)) or "").strip()
        except Exception:  # noqa: BLE001
            return ""
    return text


def resolve_route(core: Any, activation: Any) -> Optional[Dict[str, Any]]:
    """Куда Бадди отправит вопрос: ``{base_url, api_key, model, provider, billing, cp_url}`` или ``None``."""
    try:
        status = activation.connection_status()
    except Exception:  # noqa: BLE001
        status = {}
    if status.get("connected"):
        key = ""
        try:
            key = str(core.get_env_value(activation.KEY_ENV) or "").strip()
        except Exception:  # noqa: BLE001
            key = ""
        if key:
            return {
                "base_url": str(status.get("base_url") or "").rstrip("/"),
                "api_key": key,
                "model": str(status.get("model") or "") or activation.FALLBACK_MODEL,
                "provider": activation.PROVIDER_NAME,
                "billing": BILLING_NOMADNET,
                "cp_url": status.get("cp_url"),
            }

    try:
        cfg = core.load_config() or {}
    except Exception:  # noqa: BLE001
        cfg = {}
    model_cfg = cfg.get("model") if isinstance(cfg, dict) and isinstance(cfg.get("model"), dict) else {}
    base_url = str(model_cfg.get("base_url") or "").strip().rstrip("/")
    model_name = str(model_cfg.get("default") or "").strip()
    key = _expand_key(core, model_cfg.get("api_key"))
    if base_url and model_name and key:
        return {"base_url": base_url, "api_key": key, "model": model_name,
                "provider": str(model_cfg.get("provider") or "custom"), "billing": None, "cp_url": None}

    for env_k, def_url, def_model in _ENV_FALLBACKS:
        try:
            val = str(core.get_env_value(env_k) or "").strip()
        except Exception:  # noqa: BLE001
            val = ""
        if val:
            return {"base_url": def_url, "api_key": val, "model": def_model,
                    "provider": env_k.split("_", 1)[0].lower(), "billing": None, "cp_url": None}
    return None


def _is_loopback(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return host in {"localhost", "127.0.0.1", "::1"}


def _error_message(body: Any) -> str:
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and isinstance(err.get("message"), str):
            return err["message"].strip()
        for k in ("message", "detail"):
            if isinstance(body.get(k), str):
                return body[k].strip()
    return ""


def _record_usage(route: Dict[str, Any], data: Dict[str, Any]) -> None:
    usage = data.get("usage") if isinstance(data.get("usage"), dict) else None
    if not usage:
        return
    try:
        from . import db, meter

        record = meter.extract_usage_record({
            "api_request_id": f"buddy:{data.get('id') or uuid.uuid4().hex}",
            "provider": route.get("provider"),
            "model": route.get("model"),
            "billing": route.get("billing"),
            "lane": "buddy",
            "usage": usage,
        })
        if record is None:
            return
        conn = db.connect()
        try:
            db.record_usage(conn, **record)
        finally:
            conn.close()
    except Exception as exc:  # noqa: BLE001 — счётчик не должен ронять ответ
        logger.warning("nomad.buddy: usage not recorded: %s", type(exc).__name__)


def ask(route: Dict[str, Any], system: str, prompt: str, *, client: Any = None) -> Dict[str, Any]:
    """Один вызов chat/completions. ``{'ok', 'answer'?, 'status_code', 'billing_block'?}``; ключа в ответе нет."""
    import httpx

    payload = {
        "model": route["model"],
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        "temperature": 0.3,
        "max_tokens": MAX_TOKENS,
    }
    headers = {"Authorization": f"Bearer {route['api_key']}", "Content-Type": "application/json",
               "X-Title": "Nomad Buddy"}
    url = f"{route['base_url']}/chat/completions"
    owns = client is None
    if owns:
        client = httpx.Client(timeout=httpx.Timeout(TIMEOUT_S), trust_env=not _is_loopback(url))
    try:
        resp = client.post(url, json=payload, headers=headers)
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "status_code": None, "error": type(exc).__name__}
    finally:
        if owns:
            client.close()

    try:
        data = resp.json()
    except Exception:  # noqa: BLE001
        data = {}
    status = resp.status_code
    if status == 402 and route.get("billing") == BILLING_NOMADNET:
        message = _error_message(data) or "Баланс NomadNet исчерпан. Пополните баланс в личном кабинете."
        return {"ok": False, "status_code": 402, "billing_block": {
            "status_code": 402,
            "reason": (data.get("error") or {}).get("code") if isinstance(data.get("error"), dict) else None,
            "message": message,
            "topup_url": topup_url_for(route.get("cp_url")),
            "provider": route.get("provider"),
        }}
    if status >= 400:
        return {"ok": False, "status_code": status, "error": _error_message(data)[:300]}

    _record_usage(route, data if isinstance(data, dict) else {})
    choices = data.get("choices") if isinstance(data, dict) else None
    if choices and isinstance(choices[0], dict):
        msg = (choices[0].get("message") or {}).get("content")
        if msg and str(msg).strip():
            return {"ok": True, "status_code": status, "answer": str(msg).strip()}
    return {"ok": False, "status_code": status, "error": "empty answer"}
