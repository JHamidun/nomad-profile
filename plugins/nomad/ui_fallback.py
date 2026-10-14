"""Вкладка «Порядок и запас» экрана «Аккаунты» (M-134).

Управляет режимом обхода пула подписок и ключей (`nomad.pool_mode`) и упорядоченным
списком запасных провайдеров (`fallback_providers`) в `config.yaml` активного
профиля через единый адаптер `ui_config` (`M-130`).

При подключённом NomadNet или включённом российском контуре (`nomad.ru_only: true`)
секция внешних запасных провайдеров блокируется с понятным русским объяснением,
а попытки добавить внешнего провайдера отклоняются без изменения `config.yaml`,
чтобы `ru_only.audit_hermes_config` оставался `[]`.
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Mapping, Sequence

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import activation, core_adapter, profile_config, ru_only, ui_config

POOL_MODES: tuple[dict[str, str], ...] = (
    {
        "id": "Subscription -> API",
        "label": "Сначала подписки, затем ключи API",
        "description": "Приоритет отдаётся входам по подписке (OAuth); при упоре в лимит запрос переходит на ключи API.",
    },
    {
        "id": "Round-Robin",
        "label": "По очереди (равномерно)",
        "description": "Запросы распределяются по кругу между всеми готовыми аккаунтами пула.",
    },
    {
        "id": "Priority",
        "label": "Строго по приоритету",
        "description": "Всегда выбирается первый доступный аккаунт с наивысшим приоритетом независимо от способа входа.",
    },
    {
        "id": "Single",
        "label": "Только активный аккаунт",
        "description": "Автоматическое переключение внутри пула отключено; работает только выбранный аккаунт.",
    },
)

DEFAULT_POOL_MODE = "Subscription -> API"

KNOWN_FALLBACK_PROVIDERS: tuple[dict[str, str], ...] = (
    {"id": "openrouter", "label": "OpenRouter", "default_model": "anthropic/claude-sonnet-4.5"},
    {"id": "openai", "label": "OpenAI API", "default_model": "gpt-4.1"},
    {"id": "anthropic", "label": "Anthropic API", "default_model": "claude-sonnet-4-5"},
    {"id": "deepseek", "label": "DeepSeek", "default_model": "deepseek-chat"},
    {"id": "gemini", "label": "Google Gemini", "default_model": "gemini-2.5-pro"},
    {"id": "custom", "label": "Свой совместимый адрес (OpenAI API)", "default_model": ""},
)

RESTRICTION_REASON_NOMADNET = (
    "Вы подключены к NomadNet. Маршрутизация и резервирование управляются единым шлюзом NomadNet, "
    "поэтому добавление внешних запасных провайдеров заблокировано."
)
RESTRICTION_REASON_RU_ONLY = (
    "Включён российский контур (nomad.ru_only: true). Передача запросов внешним зарубежным провайдерам "
    "заблокирована, чтобы данные не покидали разрешённый контур."
)
RESTRICTION_REASON_BOTH = (
    "Активно подключение к NomadNet и включён российский контур (nomad.ru_only: true). "
    "Добавление внешних запасных провайдеров заблокировано."
)


class FallbackProviderItem(BaseModel):
    provider: str = Field(..., min_length=1)
    model: str = Field(..., min_length=1)
    base_url: str | None = None
    api_key_env: str | None = None
    api_mode: str | None = None


class FallbackUpdateRequest(BaseModel):
    pool_mode: str | None = None
    fallback_providers: list[dict[str, Any]] | None = None


def _restriction_state(home: Path | None = None) -> dict[str, Any]:
    cfg_path = (Path(home) / "config.yaml") if home is not None else None
    try:
        conn = activation.connection_status()
        nomadnet_connected = bool(conn.get("connected"))
    except Exception:
        nomadnet_connected = False

    try:
        ru_mode = ru_only.resolve_ru_only(cfg_path)
        ru_enabled = bool(ru_mode.enabled)
    except Exception:
        cfg_data = profile_config.load_strict(cfg_path)
        nomad_sec = cfg_data.get("nomad") if isinstance(cfg_data.get("nomad"), Mapping) else {}
        ru_enabled = bool(nomad_sec.get("ru_only"))

    if nomadnet_connected and ru_enabled:
        reason: str | None = RESTRICTION_REASON_BOTH
    elif nomadnet_connected:
        reason = RESTRICTION_REASON_NOMADNET
    elif ru_enabled:
        reason = RESTRICTION_REASON_RU_ONLY
    else:
        reason = None

    return {
        "restricted": bool(nomadnet_connected or ru_enabled),
        "nomadnet_connected": nomadnet_connected,
        "ru_only": ru_enabled,
        "restriction_reason": reason,
    }


def _normalize_fallback_entry(raw: Mapping[str, Any]) -> dict[str, Any]:
    provider = str(raw.get("provider") or "").strip()
    model = str(raw.get("model") or "").strip()
    if not provider:
        raise ValueError("Укажите код провайдера для запасного шага.")
    if not model:
        raise ValueError(f"Укажите название модели для провайдера «{provider}».")

    entry: dict[str, Any] = {
        "provider": provider,
        "model": model,
    }
    base_url = str(raw.get("base_url") or "").strip()
    if base_url:
        entry["base_url"] = base_url
    api_key_env = str(raw.get("api_key_env") or "").strip()
    if api_key_env:
        entry["api_key_env"] = api_key_env
    api_mode = str(raw.get("api_mode") or "").strip()
    if api_mode:
        entry["api_mode"] = api_mode
    return entry


def _read_current_fallback_list(cfg: Mapping[str, Any]) -> list[dict[str, Any]]:
    raw_list = cfg.get("fallback_providers")
    out: list[dict[str, Any]] = []
    if isinstance(raw_list, list):
        for item in raw_list:
            if isinstance(item, Mapping):
                provider = str(item.get("provider") or "").strip()
                model = str(item.get("model") or "").strip()
                if provider and model:
                    entry: dict[str, Any] = {"provider": provider, "model": model}
                    for opt_key in ("base_url", "api_key_env", "api_mode"):
                        val = str(item.get(opt_key) or "").strip()
                        if val:
                            entry[opt_key] = val
                    out.append(entry)
    if not out:
        legacy = cfg.get("fallback_model")
        if isinstance(legacy, Mapping):
            provider = str(legacy.get("provider") or "").strip()
            model = str(legacy.get("model") or "").strip()
            if provider and model:
                entry = {"provider": provider, "model": model}
                for opt_key in ("base_url", "api_key_env", "api_mode"):
                    val = str(legacy.get(opt_key) or "").strip()
                    if val:
                        entry[opt_key] = val
                out.append(entry)
    return out


def get_fallback_settings(*, home: Path | None = None) -> dict[str, Any]:
    """Вернуть текущие настройки порядка обхода пула и цепочки запасных провайдеров."""
    cfg_path = (Path(home) / "config.yaml") if home is not None else None
    cfg = profile_config.load_strict(cfg_path)
    nomad_sec = cfg.get("nomad") if isinstance(cfg.get("nomad"), Mapping) else {}
    pool_mode = str(nomad_sec.get("pool_mode") or "").strip() or DEFAULT_POOL_MODE
    fallback_providers = _read_current_fallback_list(cfg)
    restriction = _restriction_state(home=home)

    return {
        "ok": True,
        "pool_mode": pool_mode,
        "available_pool_modes": list(POOL_MODES),
        "fallback_providers": fallback_providers,
        "known_providers": list(KNOWN_FALLBACK_PROVIDERS),
        **restriction,
    }


def update_fallback_settings(
    *,
    pool_mode: str | None = None,
    fallback_providers: Sequence[Mapping[str, Any]] | None = None,
    home: Path | None = None,
) -> dict[str, Any]:
    """Сохранить `nomad.pool_mode` и упорядоченный список `fallback_providers` в `config.yaml`."""
    restriction = _restriction_state(home=home)
    cfg_path = (Path(home) / "config.yaml") if home is not None else None
    current_cfg = profile_config.load_strict(cfg_path)

    normalized_providers: list[dict[str, Any]] | None = None
    if fallback_providers is not None:
        normalized_providers = []
        for raw_item in fallback_providers:
            if not isinstance(raw_item, Mapping):
                raise ValueError("Элемент списка запасных провайдеров должен быть объектом.")
            normalized_providers.append(_normalize_fallback_entry(raw_item))

        if restriction["restricted"] and len(normalized_providers) > 0:
            if restriction["nomadnet_connected"]:
                raise PermissionError(
                    restriction["restriction_reason"] or RESTRICTION_REASON_NOMADNET
                )
            if restriction["ru_only"]:
                candidate_cfg = copy.deepcopy(current_cfg)
                candidate_cfg["fallback_providers"] = normalized_providers
                candidate_cfg.pop("fallback_model", None)
                violations = ru_only.audit_hermes_config(candidate_cfg)
                if violations or len(normalized_providers) > 0:
                    raise PermissionError(
                        restriction["restriction_reason"] or RESTRICTION_REASON_RU_ONLY
                    )

    cleaned_mode: str | None = None
    if pool_mode is not None:
        cleaned_mode = str(pool_mode).strip()
        if not cleaned_mode:
            raise ValueError("Режим обхода пула не может быть пустым.")

    if normalized_providers is not None:
        ui_config.update_global_config(
            {"fallback_providers": normalized_providers},
            raise_on_error=True,
        )

    if cleaned_mode is not None or normalized_providers is not None:
        disk_cfg = profile_config.load_strict(cfg_path)
        full_cfg = core_adapter.load_config()
        merged_cfg = copy.deepcopy(full_cfg) if isinstance(full_cfg, dict) else {}
        for k, v in disk_cfg.items():
            merged_cfg[k] = copy.deepcopy(v)

        if cleaned_mode is not None:
            nomad_sec = merged_cfg.get("nomad")
            nomad_dict = dict(nomad_sec) if isinstance(nomad_sec, Mapping) else {}
            nomad_dict["pool_mode"] = cleaned_mode
            merged_cfg["nomad"] = nomad_dict

        if normalized_providers is not None:
            merged_cfg["fallback_providers"] = copy.deepcopy(normalized_providers)
            merged_cfg.pop("fallback_model", None)

        core_adapter.save_config(merged_cfg)

    return get_fallback_settings(home=home)


def build_router() -> APIRouter:
    router = APIRouter(tags=["nomad-fallback"])

    @router.get("/accounts/fallback")
    def http_get_fallback() -> dict[str, Any]:
        return get_fallback_settings()

    @router.put("/accounts/fallback")
    def http_put_fallback(body: FallbackUpdateRequest) -> dict[str, Any]:
        try:
            return update_fallback_settings(
                pool_mode=body.pool_mode,
                fallback_providers=body.fallback_providers,
            )
        except PermissionError as exc:
            raise HTTPException(status_code=403, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router


router = build_router()
