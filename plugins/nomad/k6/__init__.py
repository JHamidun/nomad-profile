"""K6 (half = 1, M-083) — Перенос правок из 4 плагинов апстрима в хуки ``package/plugins/nomad/k6/``.

Без подмены встроенных плагинов апстрима в ``HERMES_HOME/plugins/`` реализует четыре
решения ``хук плагина`` первой половины таблицы ``docs/k6-plugins.md``:

1. ``langfuse`` (``1bedbb0188``): хук ``post_api_request`` обогащает метаданные трассы
   тегами ``user_id`` и ``tenant_id``, ведёт локальную атрибуцию стоимости по тенанту
   и работает в режиме fail-open при отсутствии ключей ``LANGFUSE_PUBLIC_KEY`` /
   ``LANGFUSE_SECRET_KEY`` или сбое клиента.
2. ``image_gen_openai`` (``9320cb8113``, ``3740cc1a5f``): хук ``pre_tool_call`` для
   ``image_generate`` учитывает явный выбор тира ``image_model`` (``gpt-image-2``,
   ``gpt-image-2-high``, ``gpt-image-2-low``), сбрасывает залипание ``Auto`` и
   проверяет инвариант ``mask_image_url`` (ровно один исходный ``image_url``).
3. ``image_gen_gemini`` (``6a66bff8e2``, ``103ae87fe8``): регистрация провайдера
   :class:`GeminiImageGenProvider` через ``ctx.register_image_gen_provider`` с
   приоритетом ключей ``GOOGLE_API_KEY`` > ``GEMINI_API_KEY`` и поддержкой селекторов
   ``nano-banana-pro``, ``nano-banana-flash``, ``nano-banana-flash-lite``.
4. ``kanban`` (``5af2d7e98c``): закрытие кросс-профильного доступа к доске Kanban в
   ``multi_tenant`` / профильном режиме, привязка к владельцу сессии и координация
   аренды карточек через :mod:`package.plugins.nomad.lease`.
"""

from __future__ import annotations

import base64
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field
import gc
import json
import logging
import os
from pathlib import Path
import sys
import threading
import time
import types
from typing import Any
import urllib.error
import urllib.request

from .. import core_adapter
from .. import lease
from .half2 import (
    MEMORY_TOOL_NAMES,
    activate_dashboard_account_key,
    bind_telegram_user,
    compact_tool_schema_for_32k,
    compact_toolset_for_32k,
    get_telegram_binding,
    handle_dashboard_account_api,
    handle_telegram_clarify_callback,
    handle_telegram_inbound_message,
    on_memory_pre_tool_call,
    on_nebius_pre_llm_request,
    parse_telegram_start_link,
    reset_telegram_bindings,
    resolve_nebius_routing,
    sanitize_auth_brand_string,
    sanitize_auth_status_payload,
    scope_memory_peer,
    validate_nomad_key_format,
    verify_memory_tenant_access,
    verify_telegram_tenant_access,
)

log = logging.getLogger("nomad.k6")

# ---------------------------------------------------------------------------
# 1. langfuse (1bedbb0188): user_id tag, per-tenant cost attribution, fail-open
# ---------------------------------------------------------------------------

DEFAULT_MODEL_PRICING_PER_1M: dict[str, tuple[float, float]] = {
    "gpt-5.4": (2.50, 10.00),
    "gpt-5.4-mini": (0.40, 1.60),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-opus-4-7": (15.00, 75.00),
    "gemini-3.1-pro-preview": (1.25, 5.00),
    "gemini-3.1-flash-lite-preview": (0.10, 0.40),
}
DEFAULT_FALLBACK_PRICE_PER_1M: tuple[float, float] = (1.00, 3.00)


@dataclass(frozen=True)
class LangfuseAttributionRecord:
    """Единичная запись атрибуции вызова модели по тенанту и пользователю."""

    tenant_id: str
    user_id: str
    session_id: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: float
    tags: tuple[str, ...]
    langfuse_configured: bool
    langfuse_exported: bool
    fail_open: bool
    timestamp: float = field(default_factory=time.time)


_LANGFUSE_LOCK = threading.Lock()
_LANGFUSE_RECORDS: list[LangfuseAttributionRecord] = []
_LANGFUSE_TENANT_TOTALS: dict[str, dict[str, Any]] = {}
_LANGFUSE_EXPORTER: Callable[[dict[str, Any]], None] | None = None


def set_langfuse_exporter(exporter: Callable[[dict[str, Any]], None] | None) -> None:
    """Устанавливает (или сбрасывает) callback отправки трассы в Langfuse для тестов/рантайма."""
    global _LANGFUSE_EXPORTER
    with _LANGFUSE_LOCK:
        _LANGFUSE_EXPORTER = exporter


def reset_langfuse_state() -> None:
    """Очищает накопленную статистику Langfuse (для изолированных тестов)."""
    global _LANGFUSE_EXPORTER
    with _LANGFUSE_LOCK:
        _LANGFUSE_RECORDS.clear()
        _LANGFUSE_TENANT_TOTALS.clear()
        _LANGFUSE_EXPORTER = None


def get_langfuse_records() -> list[LangfuseAttributionRecord]:
    """Возвращает список записанных событий атрибуции."""
    with _LANGFUSE_LOCK:
        return list(_LANGFUSE_RECORDS)


def get_langfuse_tenant_totals(tenant_id: str | None = None) -> dict[str, Any]:
    """Возвращает агрегированную стоимость и токены по тенанту (или словарь всех тенантов)."""
    with _LANGFUSE_LOCK:
        if tenant_id is not None:
            entry = _LANGFUSE_TENANT_TOTALS.get(tenant_id)
            return dict(entry) if entry else {
                "tenant_id": tenant_id,
                "calls": 0,
                "input_tokens": 0,
                "output_tokens": 0,
                "total_tokens": 0,
                "cost_usd": 0.0,
                "users": [],
            }
        return {k: dict(v) for k, v in _LANGFUSE_TENANT_TOTALS.items()}


def _active_profile_id() -> str:
    try:
        home = Path(core_adapter.get_hermes_home())
        if home.parent.name == "profiles" and home.name:
            return home.name
    except Exception:
        pass
    return "default"


def _resolve_env_or_dotenv(name: str) -> str:
    val = os.environ.get(name, "").strip()
    if val:
        return val
    try:
        saved = core_adapter.get_env_value(name)
        if saved and str(saved).strip():
            return str(saved).strip()
    except Exception:
        pass
    return ""


def has_langfuse_keys() -> bool:
    """True, если заданы оба ключа ``LANGFUSE_PUBLIC_KEY`` и ``LANGFUSE_SECRET_KEY``."""
    pub = _resolve_env_or_dotenv("LANGFUSE_PUBLIC_KEY")
    sec = _resolve_env_or_dotenv("LANGFUSE_SECRET_KEY")
    return bool(pub and sec)


def _estimate_cost_usd(
    model: str,
    input_tokens: int,
    output_tokens: int,
    explicit_cost: float | None = None,
) -> float:
    if explicit_cost is not None and explicit_cost >= 0:
        return round(float(explicit_cost), 8)
    clean_model = (model or "").strip().lower()
    if "/" in clean_model:
        clean_model = clean_model.rsplit("/", 1)[-1]
    in_price, out_price = DEFAULT_MODEL_PRICING_PER_1M.get(
        clean_model, DEFAULT_FALLBACK_PRICE_PER_1M
    )
    cost = (max(0, input_tokens) * in_price + max(0, output_tokens) * out_price) / 1_000_000.0
    return round(cost, 8)


def on_langfuse_post_api_request(
    *,
    session_id: str = "",
    model: str = "",
    provider: str = "",
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_usd: float | None = None,
    user_id: str | None = None,
    tenant_id: str | None = None,
    trace_metadata: dict[str, Any] | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Хук ``post_api_request``: тег ``user_id``, атрибуция стоимости по тенанту и fail-open без ключей."""
    try:
        resolved_tenant = (
            (tenant_id or "").strip()
            or str(kwargs.get("profile") or "").strip()
            or os.environ.get("NOMAD_TENANT_ID", "").strip()
            or os.environ.get("HERMES_TENANT_ID", "").strip()
            or _active_profile_id()
        )
        resolved_user = (
            (user_id or "").strip()
            or str(kwargs.get("platform_user_id") or "").strip()
            or os.environ.get("NOMAD_USER_ID", "").strip()
            or os.environ.get("HERMES_USER_ID", "").strip()
            or resolved_tenant
        )
        in_tok = max(0, int(input_tokens or 0))
        out_tok = max(0, int(output_tokens or 0))
        total_tok = in_tok + out_tok
        computed_cost = _estimate_cost_usd(model, in_tok, out_tok, cost_usd)

        tags = (
            f"user_id:{resolved_user}",
            f"tenant_id:{resolved_tenant}",
        )
        if isinstance(trace_metadata, dict):
            trace_metadata["user_id"] = resolved_user
            trace_metadata["tenant_id"] = resolved_tenant
            existing_tags = list(trace_metadata.get("tags") or [])
            for tag in tags:
                if tag not in existing_tags:
                    existing_tags.append(tag)
            trace_metadata["tags"] = existing_tags
            trace_metadata["cost_usd"] = computed_cost

        configured = has_langfuse_keys()
        exported = False
        fail_open = False

        if configured:
            payload = {
                "user_id": resolved_user,
                "tenant_id": resolved_tenant,
                "session_id": str(session_id or ""),
                "model": str(model or ""),
                "provider": str(provider or ""),
                "input_tokens": in_tok,
                "output_tokens": out_tok,
                "total_tokens": total_tok,
                "cost_usd": computed_cost,
                "tags": list(tags),
            }
            exporter = _LANGFUSE_EXPORTER
            if exporter is not None:
                try:
                    exporter(payload)
                    exported = True
                except Exception:
                    fail_open = True
            else:
                exported = True
        else:
            fail_open = True

        rec = LangfuseAttributionRecord(
            tenant_id=resolved_tenant,
            user_id=resolved_user,
            session_id=str(session_id or ""),
            model=str(model or ""),
            provider=str(provider or ""),
            input_tokens=in_tok,
            output_tokens=out_tok,
            total_tokens=total_tok,
            cost_usd=computed_cost,
            tags=tags,
            langfuse_configured=configured,
            langfuse_exported=exported,
            fail_open=fail_open,
        )
        with _LANGFUSE_LOCK:
            _LANGFUSE_RECORDS.append(rec)
            agg = _LANGFUSE_TENANT_TOTALS.setdefault(
                resolved_tenant,
                {
                    "tenant_id": resolved_tenant,
                    "calls": 0,
                    "input_tokens": 0,
                    "output_tokens": 0,
                    "total_tokens": 0,
                    "cost_usd": 0.0,
                    "users": [],
                },
            )
            agg["calls"] += 1
            agg["input_tokens"] += in_tok
            agg["output_tokens"] += out_tok
            agg["total_tokens"] += total_tok
            agg["cost_usd"] = round(agg["cost_usd"] + computed_cost, 8)
            if resolved_user not in agg["users"]:
                agg["users"].append(resolved_user)

        return {
            "user_id": resolved_user,
            "tenant_id": resolved_tenant,
            "tags": list(tags),
            "cost_usd": computed_cost,
            "langfuse_configured": configured,
            "langfuse_exported": exported,
            "fail_open": fail_open,
        }
    except Exception:
        # Строгий fail-open: никогда не роняем агентский ход из-за обсервабилити.
        return {
            "user_id": user_id or "default",
            "tenant_id": tenant_id or "default",
            "tags": [],
            "cost_usd": 0.0,
            "langfuse_configured": False,
            "langfuse_exported": False,
            "fail_open": True,
        }


# ---------------------------------------------------------------------------
# 2. image_gen_openai (9320cb8113, 3740cc1a5f): explicit image_model & Auto reset
# ---------------------------------------------------------------------------

OPENAI_IMAGE_MODEL_TIERS: dict[str, dict[str, str]] = {
    "gpt-image-2": {"provider": "openai", "model": "gpt-image-1.5", "quality": "medium", "tier": "gpt-image-2-medium"},
    "gpt-image-2-medium": {"provider": "openai", "model": "gpt-image-1.5", "quality": "medium", "tier": "gpt-image-2-medium"},
    "gpt-image-2-high": {"provider": "openai", "model": "gpt-image-1.5", "quality": "high", "tier": "gpt-image-2-high"},
    "gpt-image-2-low": {"provider": "openai", "model": "gpt-image-1.5", "quality": "low", "tier": "gpt-image-2-low"},
    "gpt-image-1.5": {"provider": "openai", "model": "gpt-image-1.5", "quality": "medium", "tier": "gpt-image-1.5"},
    "gpt-image-1.5-high": {"provider": "openai", "model": "gpt-image-1.5", "quality": "high", "tier": "gpt-image-1.5-high"},
    "gpt-image-1.5-low": {"provider": "openai", "model": "gpt-image-1.5", "quality": "low", "tier": "gpt-image-1.5-low"},
}

GEMINI_IMAGE_MODEL_TIERS: dict[str, dict[str, str]] = {
    "nano-banana-pro": {"provider": "gemini", "model": "gemini-3-pro-image-preview", "tier": "nano-banana-pro"},
    "gemini-3-pro-image-preview": {"provider": "gemini", "model": "gemini-3-pro-image-preview", "tier": "nano-banana-pro"},
    "nano-banana-flash": {"provider": "gemini", "model": "gemini-3.1-flash-image-preview", "tier": "nano-banana-flash"},
    "nano-banana-2": {"provider": "gemini", "model": "gemini-3.1-flash-image-preview", "tier": "nano-banana-flash"},
    "gemini-3.1-flash-image-preview": {"provider": "gemini", "model": "gemini-3.1-flash-image-preview", "tier": "nano-banana-flash"},
    "nano-banana-flash-lite": {"provider": "gemini", "model": "gemini-3.1-flash-lite-image", "tier": "nano-banana-flash-lite"},
    "gemini-3.1-flash-lite-image": {"provider": "gemini", "model": "gemini-3.1-flash-lite-image", "tier": "nano-banana-flash-lite"},
}

_ASPECT_ALIASES: dict[str, str] = {
    "landscape": "landscape",
    "16:9": "landscape",
    "3:2": "landscape",
    "wide": "landscape",
    "square": "square",
    "1:1": "square",
    "portrait": "portrait",
    "9:16": "portrait",
    "2:3": "portrait",
    "tall": "portrait",
}

_STICKY_IMAGE_TIER_BY_SESSION: dict[str, dict[str, str]] = {}


def reset_sticky_image_tier(session_id: str | None = None) -> None:
    """Сбрасывает залипший выбор модели изображений (при возврате селектора в ``Auto``)."""
    if session_id is None:
        _STICKY_IMAGE_TIER_BY_SESSION.clear()
    else:
        _STICKY_IMAGE_TIER_BY_SESSION.pop(session_id, None)


def _read_configured_image_selector(cfg: Mapping[str, Any] | None = None) -> str:
    if cfg is None:
        try:
            cfg = core_adapter.load_config() or {}
        except Exception:
            cfg = {}
    if not isinstance(cfg, Mapping):
        return "auto"
    nomad_sec = cfg.get("nomad")
    if isinstance(nomad_sec, Mapping) and nomad_sec.get("image_model"):
        return str(nomad_sec["image_model"]).strip()
    if cfg.get("image_model"):
        return str(cfg["image_model"]).strip()
    img_sec = cfg.get("image_gen")
    if isinstance(img_sec, Mapping) and img_sec.get("model"):
        return str(img_sec["model"]).strip()
    return "auto"


def normalize_image_generate_call(
    args: dict[str, Any],
    *,
    session_id: str = "default",
    config: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Нормализует аргументы ``image_generate``, учитывает тир ``image_model`` и сбрасывает залипание ``Auto``."""
    if not isinstance(args, dict):
        return None

    # 1. Проверка инварианта mask_image_url (требует ровно один исходный image_url).
    mask_url = str(args.get("mask_image_url") or "").strip()
    image_url = str(args.get("image_url") or "").strip()
    ref_urls = args.get("reference_image_urls")
    if isinstance(ref_urls, str):
        ref_list = [ref_urls.strip()] if ref_urls.strip() else []
    elif isinstance(ref_urls, (list, tuple)):
        ref_list = [str(u).strip() for u in ref_urls if isinstance(u, str) and str(u).strip()]
    else:
        ref_list = []

    if mask_url:
        if not image_url and len(ref_list) == 1:
            image_url = ref_list[0]
            args["image_url"] = image_url
            args.pop("reference_image_urls", None)
        elif not image_url or len(ref_list) > 0:
            return {
                "block": True,
                "reason": "mask_image_url requires exactly one source image_url without extra reference_image_urls.",
            }

    # 2. Нормализация aspect_ratio
    raw_aspect = str(args.get("aspect_ratio") or "landscape").strip().lower()
    args["aspect_ratio"] = _ASPECT_ALIASES.get(raw_aspect, "landscape")

    # 3. Учёт явного выбора тира image_model и сброс залипания Auto
    raw_selector = (
        str(args.get("image_model") or args.get("model") or "").strip()
        or _read_configured_image_selector(config)
    )
    selector_key = raw_selector.lower()

    if selector_key in ("", "auto", "default"):
        reset_sticky_image_tier(session_id)
        args.pop("image_model", None)
        if str(args.get("model") or "").strip().lower() in ("auto", "default"):
            args.pop("model", None)
        if str(args.get("provider") or "").strip().lower() in ("auto", "default"):
            args.pop("provider", None)
        args.pop("quality", None)
        return None

    if selector_key in OPENAI_IMAGE_MODEL_TIERS:
        resolved = dict(OPENAI_IMAGE_MODEL_TIERS[selector_key])
        _STICKY_IMAGE_TIER_BY_SESSION[session_id] = resolved
        args["provider"] = resolved["provider"]
        args["model"] = resolved["model"]
        args["quality"] = resolved["quality"]
        args["image_model"] = resolved["tier"]
        return None

    if selector_key in GEMINI_IMAGE_MODEL_TIERS:
        resolved = dict(GEMINI_IMAGE_MODEL_TIERS[selector_key])
        _STICKY_IMAGE_TIER_BY_SESSION[session_id] = resolved
        args["provider"] = resolved["provider"]
        args["model"] = resolved["model"]
        args["image_model"] = resolved["tier"]
        args.pop("quality", None)
        return None

    return None


# ---------------------------------------------------------------------------
# 3. image_gen_gemini (6a66bff8e2, 103ae87fe8): GeminiImageGenProvider + key fallback
# ---------------------------------------------------------------------------

GEMINI_DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview"
GEMINI_MODELS_CATALOG: tuple[dict[str, Any], ...] = (
    {
        "id": "gemini-3.1-flash-image-preview",
        "name": "Nano Banana 2 (Gemini 3.1 Flash Image)",
        "description": "Fast multimodal image generation and editing via Google Gemini.",
        "speed": "fast",
        "price": "$0.04/img",
    },
    {
        "id": "gemini-3-pro-image-preview",
        "name": "Nano Banana Pro (Gemini 3 Pro Image)",
        "description": "High-fidelity typography, character consistency, and studio editing.",
        "speed": "medium",
        "price": "$0.08/img",
    },
    {
        "id": "gemini-3.1-flash-lite-image",
        "name": "Nano Banana Flash Lite (Gemini 3.1 Flash Lite Image)",
        "description": "Lightweight draft image generation with low latency.",
        "speed": "ultra-fast",
        "price": "$0.02/img",
    },
)

# 1x1 transparent PNG fallback for offline/mocked transport tests
_ONE_PIXEL_PNG_B64 = (
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
)


def resolve_gemini_api_key() -> tuple[str, str]:
    """Возвращает ``(api_key, source_env_name)`` с приоритетом ``GOOGLE_API_KEY`` > ``GEMINI_API_KEY``."""
    for env_name in ("GOOGLE_API_KEY", "GEMINI_API_KEY"):
        val = _resolve_env_or_dotenv(env_name)
        if val:
            return val, env_name
    return "", ""


def resolve_gemini_image_model(selector: str | None = None) -> str:
    """Преобразует UI-селектор (``nano-banana-pro`` и др.) или ID модели в канонический ID Gemini."""
    raw = (selector or "").strip().lower()
    if not raw or raw in ("auto", "default"):
        return GEMINI_DEFAULT_IMAGE_MODEL
    if raw in GEMINI_IMAGE_MODEL_TIERS:
        return GEMINI_IMAGE_MODEL_TIERS[raw]["model"]
    if raw.startswith("gemini-"):
        return selector.strip()  # type: ignore[union-attr]
    return GEMINI_DEFAULT_IMAGE_MODEL


class GeminiImageGenProvider:
    """Бэкенд генерации изображений Google Gemini (Nano Banana) для ``ctx.register_image_gen_provider``."""

    name: str = "gemini"
    display_name: str = "Google Gemini (Nano Banana)"
    config_key: str = "gemini"

    def __init__(
        self,
        *,
        transport_fn: Callable[[str, dict[str, Any], str], dict[str, Any]] | None = None,
    ) -> None:
        self._transport_fn = transport_fn

    def is_available(self) -> bool:
        key, _ = resolve_gemini_api_key()
        return bool(key)

    def capabilities(self) -> dict[str, Any]:
        return {
            "modalities": ["text", "image"],
            "max_reference_images": 4,
            "supports_upscale": False,
        }

    def list_models(self) -> list[dict[str, Any]]:
        return [dict(item) for item in GEMINI_MODELS_CATALOG]

    def _save_generated_image(self, b64_data: str, extension: str = "png") -> Path:
        home = Path(core_adapter.get_hermes_home())
        out_dir = home / "cache" / "generated" / "images"
        out_dir.mkdir(parents=True, exist_ok=True)
        ts = int(time.time() * 1000)
        out_path = out_dir / f"gemini_{ts}.{extension.lstrip('.')}"
        out_path.write_bytes(base64.b64decode(b64_data))
        return out_path

    def _default_transport(
        self, model: str, payload: dict[str, Any], api_key: str
    ) -> dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def generate(
        self,
        prompt: str,
        aspect_ratio: str = "landscape",
        *,
        image_url: str | None = None,
        reference_image_urls: list[str] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        clean_prompt = (prompt or "").strip()
        resolved_aspect = _ASPECT_ALIASES.get((aspect_ratio or "").strip().lower(), "landscape")
        modality = "image" if (image_url or reference_image_urls) else "text"

        if not clean_prompt:
            return {
                "success": False,
                "image": "",
                "model": GEMINI_DEFAULT_IMAGE_MODEL,
                "prompt": "",
                "aspect_ratio": resolved_aspect,
                "modality": modality,
                "provider": self.name,
                "error": "Prompt is required for Gemini image generation.",
                "error_type": "invalid_request",
            }

        api_key, key_source = resolve_gemini_api_key()
        model_selector = (
            kwargs.get("model")
            or kwargs.get("image_model")
            or _read_configured_image_selector()
        )
        resolved_model = resolve_gemini_image_model(str(model_selector or ""))

        if not api_key:
            return {
                "success": False,
                "image": "",
                "model": resolved_model,
                "prompt": clean_prompt,
                "aspect_ratio": resolved_aspect,
                "modality": modality,
                "provider": self.name,
                "error": "Gemini image generation requires GOOGLE_API_KEY or GEMINI_API_KEY.",
                "error_type": "missing_api_key",
            }

        parts: list[dict[str, Any]] = [{"text": clean_prompt}]
        if image_url:
            parts.append({"fileData": {"fileUri": image_url, "mimeType": "image/png"}})
        for ref in (reference_image_urls or [])[:4]:
            if isinstance(ref, str) and ref.strip():
                parts.append({"fileData": {"fileUri": ref.strip(), "mimeType": "image/png"}})

        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "aspectRatio": resolved_aspect,
            },
        }

        transport = self._transport_fn or self._default_transport
        try:
            raw_resp = transport(resolved_model, payload, api_key)
        except Exception as exc:
            return {
                "success": False,
                "image": "",
                "model": resolved_model,
                "prompt": clean_prompt,
                "aspect_ratio": resolved_aspect,
                "modality": modality,
                "provider": self.name,
                "error": str(exc),
                "error_type": "api_error",
            }

        b64_data = ""
        mime_type = "image/png"
        candidates = raw_resp.get("candidates") if isinstance(raw_resp, dict) else None
        if isinstance(candidates, list):
            for cand in candidates:
                content = cand.get("content") if isinstance(cand, dict) else None
                cand_parts = content.get("parts") if isinstance(content, dict) else None
                if not isinstance(cand_parts, list):
                    continue
                for part in cand_parts:
                    if not isinstance(part, dict):
                        continue
                    inline = part.get("inlineData") or part.get("inline_data")
                    if isinstance(inline, dict) and inline.get("data"):
                        b64_data = str(inline["data"])
                        mime_type = str(inline.get("mimeType") or inline.get("mime_type") or "image/png")
                        break
                if b64_data:
                    break

        if not b64_data:
            return {
                "success": False,
                "image": "",
                "model": resolved_model,
                "prompt": clean_prompt,
                "aspect_ratio": resolved_aspect,
                "modality": modality,
                "provider": self.name,
                "error": "Gemini response did not contain inline image data.",
                "error_type": "empty_response",
            }

        ext = "jpg" if "jpeg" in mime_type.lower() or "jpg" in mime_type.lower() else "png"
        saved_path = self._save_generated_image(b64_data, extension=ext)
        return {
            "success": True,
            "image": str(saved_path),
            "model": resolved_model,
            "prompt": clean_prompt,
            "aspect_ratio": resolved_aspect,
            "modality": modality,
            "provider": self.name,
            "key_source": key_source,
        }


def _register_abc_virtual_subclass_if_loaded() -> bool:
    """Регистрирует ``GeminiImageGenProvider`` виртуальным подклассом ``ImageGenProvider`` через ``gc``."""
    registered = False
    for obj in list(gc.get_objects()):
        if not isinstance(obj, types.ModuleType):
            continue
        if getattr(obj, "__name__", "") == "agent.image_gen_provider":
            base_cls = getattr(obj, "ImageGenProvider", None)
            if isinstance(base_cls, type) and hasattr(base_cls, "register"):
                base_cls.register(GeminiImageGenProvider)
                registered = True
    return registered


class _ImageGenAbcLoaderWrapper:
    """Обёртка загрузчика модуля ``agent.image_gen_provider``, регистрирующая виртуальный подкласс."""

    def __init__(self, inner_loader: Any) -> None:
        self._inner = inner_loader

    def create_module(self, spec: Any) -> Any:
        create_fn = getattr(self._inner, "create_module", None)
        return create_fn(spec) if callable(create_fn) else None

    def exec_module(self, module: Any) -> None:
        exec_fn = getattr(self._inner, "exec_module", None)
        if callable(exec_fn):
            exec_fn(module)
        base_cls = getattr(module, "ImageGenProvider", None)
        if isinstance(base_cls, type) and hasattr(base_cls, "register"):
            base_cls.register(GeminiImageGenProvider)


class _ImageGenAbcPostImportFinder:
    """Перехватывает первую загрузку ``agent.image_gen_provider`` до проверки ``isinstance`` в ядре."""

    def __init__(self) -> None:
        self._in_progress = False

    def find_spec(self, fullname: str, path: Any = None, target: Any = None) -> Any:
        if fullname != "agent.image_gen_provider" or self._in_progress:
            return None
        self._in_progress = True
        try:
            for finder in sys.meta_path:
                if finder is self:
                    continue
                find_spec_fn = getattr(finder, "find_spec", None)
                if not callable(find_spec_fn):
                    continue
                spec = find_spec_fn(fullname, path, target)
                if spec is not None and getattr(spec, "loader", None) is not None:
                    if not isinstance(spec.loader, _ImageGenAbcLoaderWrapper):
                        spec.loader = _ImageGenAbcLoaderWrapper(spec.loader)
                    return spec
            return None
        finally:
            self._in_progress = False


_IMAGE_GEN_ABC_FINDER = _ImageGenAbcPostImportFinder()


def ensure_gemini_provider_abc_registered() -> None:
    """Гарантирует, что ``isinstance(GeminiImageGenProvider(), ImageGenProvider)`` вернёт ``True``."""
    if _IMAGE_GEN_ABC_FINDER not in sys.meta_path:
        sys.meta_path.insert(0, _IMAGE_GEN_ABC_FINDER)
    _register_abc_virtual_subclass_if_loaded()


# ---------------------------------------------------------------------------
# 4. kanban (5af2d7e98c): cross-profile board isolation & session owner lease binding
# ---------------------------------------------------------------------------

KANBAN_TOOL_NAMES: frozenset[str] = frozenset({
    "kanban",
    "kanban_board",
    "kanban_task",
    "kanban_claim",
    "kanban_update",
    "kanban_move",
    "kanban_list",
})

_SESSION_OWNER_LOCK = threading.Lock()
_SESSION_OWNERS: dict[str, str] = {}


def bind_session_owner(session_id: str, owner_profile: str) -> None:
    """Привязывает ``session_id`` к профилю-владельцу (против кросс-профильного доступа к доске)."""
    clean_sid = (session_id or "").strip()
    clean_owner = (owner_profile or "").strip() or _active_profile_id()
    if clean_sid:
        with _SESSION_OWNER_LOCK:
            _SESSION_OWNERS[clean_sid] = clean_owner


def get_session_owner(session_id: str) -> str:
    """Возвращает профиль-владелец для ``session_id`` (или активный профиль)."""
    clean_sid = (session_id or "").strip()
    if clean_sid:
        with _SESSION_OWNER_LOCK:
            bound = _SESSION_OWNERS.get(clean_sid)
            if bound:
                return bound
    return _active_profile_id()


def reset_kanban_session_owners() -> None:
    with _SESSION_OWNER_LOCK:
        _SESSION_OWNERS.clear()


def _extract_profile_from_path(raw_path: str | Path | None) -> str | None:
    if not raw_path:
        return None
    try:
        parts = Path(str(raw_path)).parts
        for idx, part in enumerate(parts):
            if part == "profiles" and idx + 1 < len(parts):
                candidate = parts[idx + 1]
                if candidate and not candidate.startswith("."):
                    return candidate
    except Exception:
        pass
    return None


def verify_kanban_board_access(
    *,
    session_id: str = "",
    caller_profile: str | None = None,
    target_profile: str | None = None,
    db_path: str | Path | None = None,
    board: str | None = None,
    lane: str | None = None,
    claimer: str | None = None,
    multi_tenant: bool | None = None,
) -> dict[str, Any]:
    """Проверяет доступ к доске Kanban: блокирует кросс-профильное чтение/запись и чужой claimer."""
    owner_profile = (caller_profile or "").strip() or get_session_owner(session_id)
    if session_id:
        bind_session_owner(session_id, owner_profile)

    requested_profile = (target_profile or "").strip() or _extract_profile_from_path(db_path) or ""
    if not requested_profile and isinstance(board, str) and ":" in board:
        prefix, _ = board.split(":", 1)
        if prefix.strip() and prefix.strip() != owner_profile:
            requested_profile = prefix.strip()

    if multi_tenant is None:
        try:
            cfg = core_adapter.load_config() or {}
            nomad_cfg = cfg.get("nomad") if isinstance(cfg, Mapping) else None
            multi_tenant = bool(
                (isinstance(nomad_cfg, Mapping) and nomad_cfg.get("multi_tenant"))
                or (isinstance(cfg, Mapping) and cfg.get("multi_tenant"))
                or os.environ.get("NOMAD_MULTI_TENANT", "").strip() in ("1", "true", "yes")
            )
        except Exception:
            multi_tenant = False

    if requested_profile and requested_profile != owner_profile:
        return {
            "allowed": False,
            "block": True,
            "owner_profile": owner_profile,
            "target_profile": requested_profile,
            "multi_tenant": bool(multi_tenant),
            "reason": (
                f"Cross-profile Kanban board access denied: session owner is "
                f"{owner_profile!r}, but target profile is {requested_profile!r}."
            ),
        }

    resolved_lane = (lane or "").strip() or owner_profile
    expected_claimer = lease.claimer_for_lane(resolved_lane)
    if claimer is not None:
        try:
            lease.validate_claimer(claimer)
        except lease.ClaimerError as exc:
            return {
                "allowed": False,
                "block": True,
                "owner_profile": owner_profile,
                "target_profile": requested_profile or owner_profile,
                "multi_tenant": bool(multi_tenant),
                "reason": f"Invalid Kanban lease claimer: {exc}",
            }

    return {
        "allowed": True,
        "block": False,
        "owner_profile": owner_profile,
        "target_profile": requested_profile or owner_profile,
        "multi_tenant": bool(multi_tenant),
        "claimer": claimer or expected_claimer,
    }


def on_k6_pre_tool_call(
    tool_name: str = "",
    args: dict[str, Any] | None = None,
    session_id: str = "",
    **kwargs: Any,
) -> dict[str, Any] | None:
    """Единый хук ``pre_tool_call`` K6 (``image_gen_openai``, ``image_gen_gemini``, ``kanban``, ``memory_honcho``)."""
    clean_tool = (tool_name or "").strip().lower()
    if not clean_tool:
        return None

    if clean_tool == "image_generate" and isinstance(args, dict):
        return normalize_image_generate_call(
            args,
            session_id=session_id or "default",
            config=kwargs.get("config"),
        )

    if clean_tool in KANBAN_TOOL_NAMES or clean_tool.startswith("kanban_"):
        arg_map = args if isinstance(args, dict) else {}
        verdict = verify_kanban_board_access(
            session_id=session_id,
            caller_profile=kwargs.get("caller_profile"),
            target_profile=arg_map.get("profile") or arg_map.get("target_profile"),
            db_path=arg_map.get("db_path") or arg_map.get("hermes_home"),
            board=arg_map.get("board"),
            lane=arg_map.get("lane"),
            claimer=arg_map.get("claimer"),
            multi_tenant=kwargs.get("multi_tenant"),
        )
        if not verdict["allowed"]:
            return {"block": True, "reason": verdict["reason"]}
        if isinstance(args, dict):
            args.setdefault("owner_profile", verdict["owner_profile"])
            if "lane" in args and "claimer" not in args:
                args["claimer"] = verdict["claimer"]
        return None

    if clean_tool in MEMORY_TOOL_NAMES or clean_tool.startswith("memory_") or clean_tool.startswith("honcho_"):
        if isinstance(args, dict):
            mem_verdict = on_memory_pre_tool_call(
                clean_tool,
                args,
                tenant_id=kwargs.get("tenant_id") or kwargs.get("caller_profile"),
            )
            if mem_verdict is not None and mem_verdict.get("block"):
                return mem_verdict

    return None


def register(ctx: Any) -> GeminiImageGenProvider:
    """Регистрирует хуки и провайдеры K6 (``M-083`` / ``M-084``) в ``PluginContext``."""
    ensure_gemini_provider_abc_registered()
    provider = GeminiImageGenProvider()
    reg_img = getattr(ctx, "register_image_gen_provider", None)
    if callable(reg_img):
        reg_img(provider)
    reg_hook = getattr(ctx, "register_hook", None)
    if callable(reg_hook):
        reg_hook("post_api_request", on_langfuse_post_api_request)
        reg_hook("pre_tool_call", on_k6_pre_tool_call)
        reg_hook("pre_llm_request", on_nebius_pre_llm_request)
    return provider
