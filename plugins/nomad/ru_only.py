"""RU-only contour: flag ``nomad.ru_only``, the allow-list of Russian LLM endpoints, the lane guard.

Режим для покупателя, чьи данные по 152-ФЗ не должны уходить за пределы российских провайдеров.
Обещание — не «обычно не уходят», а «не уходят ни при каком упоре»: ни при старте дорожки, ни на
шаге лестницы переключений, ни через собственные запасные пути Hermes (``fallback_providers``,
ротация пула, вспомогательные модели), которые срабатывают без вопроса к нашему роутеру.

Три двери:

* ``require_ru_lane()`` — роутер обязан звать её перед стартом ЛЮБОЙ дорожки и перед каждым шагом
  лестницы переключений. Решение принимается по ХОСТУ адреса, а не по имени провайдера или модели:
  в каталоге Яндекса живёт и ``deepseek-v4-flash`` — он обрабатывается в Yandex Cloud и допустим,
  а тот же DeepSeek по ``api.deepseek.com`` — нет;
* ``hermes_constraints()`` / ``apply_constraints()`` — ключи config.yaml профиля Hermes, которые
  закрывают его внутренние пути смены провайдера (список путей с файлами и строками — в
  ``docs/ru-contour.md``);
* ``audit_hermes_config()`` / ``audit_auth_store()`` / ``sanitize_env()`` — проверка того, что
  профиль, пул учёток и окружение исполнителя действительно в контуре, перед запуском.

Флаг читается как ``pool_mode``: напрямую из config.yaml профиля, каждый раз заново. Но сторона
отказа здесь обратная. Для ``pool_mode`` безопасно «выключено», а здесь безопасно «включено»:
ошибка в сторону «включено» стоит покупателю недоступной зарубежной дорожки, ошибка в сторону
«выключено» — нарушения закона у покупателя, который режим включал. Поэтому выключен режим только
в двух случаях: ключа нет вовсе (или нет файла — свежая установка) либо он равен ровно ``false``.
Всё прочее — опечатка, строка ``"false"``, ``null``, нечитаемый файл — читается как «включено».

Переменная окружения ``NOMAD_RU_ONLY`` может режим только ВКЛЮЧИТЬ, но не выключить: её ставит
администратор покупателя в окружении службы, и тогда правка config.yaml из интерфейса режим не снимет.
"""

from __future__ import annotations

import copy
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional
from urllib.parse import urlsplit

import yaml

from . import profile_config

logger = logging.getLogger("hermes_plugins.nomad.ru_only")

CONFIG_SECTION = "nomad"
CONFIG_KEY = "ru_only"
ENV_LOCK = "NOMAD_RU_ONLY"
_ENV_TRUE = frozenset({"1", "true", "yes", "on"})

# Откуда взялся режим: config — явное true/false; default — ключа (или файла) нет; invalid — ключ
# есть, но не булев; unreadable — файл не читается/не разбирается; env — включён переменной.
SOURCES = ("config", "default", "invalid", "unreadable", "env")

ACTION_START_LANE = "start_lane"
ACTION_LADDER_STEP = "ladder_step"
ACTIONS = (ACTION_START_LANE, ACTION_LADDER_STEP)

# Именованные причины отказа — их ищут в логах и в событиях базы, поэтому это константы.
REASON_FOREIGN = "ru_only_endpoint_not_in_ru_allowlist"
REASON_INACTIVE = "ru_only_ru_endpoint_inactive"
REASON_INSECURE = "ru_only_ru_endpoint_without_tls"
REASON_UNKNOWN = "ru_only_destination_unknown"

# Дорожка без модели (сборка, тесты, готовый скрипт): запроса к LLM нет, решать нечего.
TOOL_PROVIDER = "tool"


@dataclass(frozen=True)
class RuEndpoint:
    """A Russian LLM endpoint. ``active=False`` = listed, but no lane may use it yet."""

    provider: str
    hosts: tuple[str, ...]
    active: bool
    note: str


RU_ENDPOINTS: tuple[RuEndpoint, ...] = (
    RuEndpoint(
        provider="yandex",
        hosts=("llm.api.cloud.yandex.net",),
        active=True,
        note="Yandex AI Studio, OpenAI-совместимый /v1 (Bearer <API-ключ сервис-аккаунта>); "
             "проверено 21.09.2026",
    ),
    RuEndpoint(
        provider="gigachat",
        hosts=("gigachat.devices.sberbank.ru", "ngw.devices.sberbank.ru"),
        active=False,
        note="ключа GigaChat нет; вход — обмен ключа на OAuth-токен через ngw, сертификат НУЦ "
             "Минцифры; включать после проверки живым вызовом",
    ),
)

# Куда уходит дорожка, у которой адреса нет, а есть только имя провайдера. Нужен лишь для того,
# чтобы назвать хост в отказе; решение всё равно «хост в списке RU_ENDPOINTS или отказ».
KNOWN_PROVIDER_HOSTS: dict[str, str] = {
    "yandex": "llm.api.cloud.yandex.net",
    "custom:yandex": "llm.api.cloud.yandex.net",
    "gigachat": "gigachat.devices.sberbank.ru",
    "deepseek": "api.deepseek.com",
    "openrouter": "openrouter.ai",
    "anthropic": "api.anthropic.com",
    "claude-code": "api.anthropic.com",
    "openai": "api.openai.com",
    "openai-codex": "chatgpt.com",
    "codex": "chatgpt.com",
    "gemini": "generativelanguage.googleapis.com",
    "kimi": "api.moonshot.ai",
    "moonshot": "api.moonshot.ai",
    "xai": "api.x.ai",
    "nous": "inference-api.nousresearch.com",
    "perplexity": "api.perplexity.ai",
}


@dataclass(frozen=True)
class RuOnly:
    enabled: bool
    source: str
    raw: Any = None


@dataclass(frozen=True)
class LaneTarget:
    """Where a lane (or a ladder step) would send its model requests."""

    lane_id: str
    provider: str
    base_url: Optional[str] = None
    model: Optional[str] = None


class RuOnlyRefused(PermissionError):
    """Raised by the guard when a lane or a ladder step would leave the RU contour."""

    def __init__(self, *, action: str, target: LaneTarget, reason: str, host: Optional[str],
                 ru_only: RuOnly):
        self.action = action
        self.target = target
        self.reason = reason
        self.host = host
        self.ru_only = ru_only
        super().__init__(
            f"{action} refused: reason={reason} (nomad.ru_only on, source={ru_only.source}, "
            f"lane={target.lane_id!r}, provider={target.provider!r}, host={host!r})")


RuOnlyViolation = RuOnlyRefused


# --- the flag -------------------------------------------------------------------------------------

def _env_lock(env: Optional[Mapping[str, str]]) -> bool:
    source = os.environ if env is None else env
    return str(source.get(ENV_LOCK, "")).strip().lower() in _ENV_TRUE


def resolve_ru_only(config_path: Optional[Path] = None, *,
                    env: Optional[Mapping[str, str]] = None) -> RuOnly:
    """Read ``nomad.ru_only`` from the active profile's config.yaml. Never raises."""
    if _env_lock(env):
        return RuOnly(True, "env", True)
    try:
        data = profile_config.load(config_path)
    except profile_config.ConfigUnreadable as exc:
        logger.warning("nomad: %s — ru_only treated as ON (fail closed)", exc)
        return RuOnly(True, "unreadable")
    if data is None or CONFIG_SECTION not in data or data[CONFIG_SECTION] is None:
        return RuOnly(False, "default")
    section = data[CONFIG_SECTION]
    if not isinstance(section, dict):
        logger.warning("nomad: section nomad=%r is not a mapping — ru_only treated as ON", section)
        return RuOnly(True, "invalid", section)
    if CONFIG_KEY not in section:
        return RuOnly(False, "default")
    raw = section[CONFIG_KEY]
    if isinstance(raw, bool):
        return RuOnly(raw, "config", raw)
    logger.warning("nomad: nomad.ru_only=%r is not true/false — treated as ON (fail closed)", raw)
    return RuOnly(True, "invalid", raw)


# --- the allow-list -------------------------------------------------------------------------------

def _ru_endpoint_for_host(host: str) -> Optional[RuEndpoint]:
    for endpoint in RU_ENDPOINTS:
        if host in endpoint.hosts:
            return endpoint
    return None


def active_ru_hosts() -> frozenset[str]:
    return frozenset(h for e in RU_ENDPOINTS if e.active for h in e.hosts)


def _host_of(target: LaneTarget) -> tuple[Optional[str], Optional[str]]:
    """``(scheme, host)`` of the target; for a provider-only target — the catalogue host."""
    raw = (target.base_url or "").strip()
    if not raw:
        host = KNOWN_PROVIDER_HOSTS.get(target.provider.strip().lower())
        return ("https", host) if host else (None, None)
    parts = urlsplit(raw if "://" in raw else f"//{raw}")
    # urlsplit сам отделяет userinfo (``user@host``) и порт; hostname уже в нижнем регистре.
    return (parts.scheme.lower() or None), parts.hostname


def classify(target: LaneTarget) -> tuple[Optional[str], Optional[str]]:
    """``(reason, host)`` — reason is None when the target stays inside the RU contour."""
    if target.provider == TOOL_PROVIDER and not target.base_url:
        return None, None
    scheme, host = _host_of(target)
    if not host:
        return REASON_UNKNOWN, None
    # Точное совпадение хоста, без поддоменов и суффиксов: «похожий» хост — чужой.
    endpoint = _ru_endpoint_for_host(host)
    if endpoint is None:
        return REASON_FOREIGN, host
    if not endpoint.active:
        return REASON_INACTIVE, host
    if scheme != "https":
        return REASON_INSECURE, host
    return None, host


# --- the guard ------------------------------------------------------------------------------------

def require_ru_lane(action: str, target: LaneTarget, *, config_path: Optional[Path] = None,
                    env: Optional[Mapping[str, str]] = None) -> RuOnly:
    """THE guard: call before starting ANY lane and before EVERY ladder step.

    Returns the resolved mode when the target may be used. Under RU-only a target outside the
    allow-list is logged with its named reason and ``RuOnlyRefused`` is raised — the caller must
    not proceed (and must not try the next ladder step on its own: see ``filter_ladder``).
    """
    if action not in ACTIONS:
        # Неизвестное действие — ошибка программиста; молча пропустить его значило бы открыть дверь.
        raise ValueError(f"unknown RU-only action {action!r}; expected one of {ACTIONS}")
    mode = resolve_ru_only(config_path, env=env)
    if not mode.enabled:
        return mode
    reason, host = classify(target)
    if reason is None:
        logger.info("nomad: RU-only allowed action=%s lane=%s provider=%s host=%s",
                    action, target.lane_id, target.provider, host)
        return mode
    logger.warning("nomad: REFUSED action=%s lane=%s provider=%s host=%s reason=%s source=%s",
                   action, target.lane_id, target.provider, host, reason, mode.source)
    raise RuOnlyRefused(action=action, target=target, reason=reason, host=host, ru_only=mode)


def filter_ladder(steps: Iterable[LaneTarget], *, config_path: Optional[Path] = None,
                  env: Optional[Mapping[str, str]] = None
                  ) -> tuple[list[LaneTarget], list[tuple[LaneTarget, str]]]:
    """Split a switch ladder into steps usable under the current mode and refused ones.

    Для планировщика: при упоре лестница строится только из допустимых шагов, и если их не
    осталось — карточка встаёт в блок с докладом, а не уезжает к чужому вендору.
    """
    steps = list(steps)
    mode = resolve_ru_only(config_path, env=env)
    if not mode.enabled:
        return steps, []
    allowed: list[LaneTarget] = []
    refused: list[tuple[LaneTarget, str]] = []
    for step in steps:
        reason, _host = classify(step)
        if reason is None:
            allowed.append(step)
        else:
            refused.append((step, reason))
    return allowed, refused


# --- Hermes constraints ---------------------------------------------------------------------------
#
# Снимок для Hermes 0.21.7 (перенесён с 0.21.5 14.10.2026: в 0.21.7 добавилась задача voice_chat, итого 19).
# Что закрывает каждый ключ и где в коде ядра живёт закрываемый путь —
# таблица в docs/ru-contour.md. Здесь только данные и механика слияния.

YANDEX_PROVIDER_KEY = "yandex"
YANDEX_OPENAI_BASE = "https://llm.api.cloud.yandex.net/v1"
YANDEX_KEY_ENV = "YANDEX_API_KEY"
# YandexGPT 5.x (Lite и Pro) — окно 32 768 токенов, а Hermes отказывается стартовать ниже 64 000
# (agent/agent_init.py:2057, MINIMUM_CONTEXT_LENGTH в agent/model_metadata.py:272). Поэтому
# исполнитель по умолчанию — собственная модель Яндекса нового поколения с окном 65 536.
DEFAULT_YANDEX_MODEL = "aliceai-llm-flash/latest"
DEFAULT_CONTEXT_LENGTH = 65_536
HERMES_MIN_CONTEXT = 64_000

# Все вспомогательные задачи ядра (DEFAULT_CONFIG["auxiliary"], hermes_cli/config_defaults.py:738).
AUX_TASKS = (
    "vision", "compression", "skills_hub", "approval", "review", "mcp", "title_generation",
    "memory_query_rewrite", "tts_audio_tags", "triage_specifier", "kanban_decomposer",
    "profile_describer", "goal_judge", "curator", "monitor", "background_review",
    "moa_reference", "moa_aggregator", "voice_chat",
)

# Наборы инструментов, которые сами отправляют содержимое разговора внешним зарубежным сервисам,
# мимо выбора модели: веб-поиск, генерация картинок и видео, синтез речи, облачные браузеры,
# внешние коннекторы. В RU-режиме выключены; вернуть можно, только поставив российский или свой
# бэкенд, — это решение ведущего, а не этого модуля.
FOREIGN_EGRESS_TOOLSETS = (
    "web", "search", "x_search", "video", "image_gen", "video_gen", "tts", "browser", "connections",
)

# Шаблоны имён переменных окружения с учётками и адресами API. Российские префиксы оставляем.
_CREDENTIAL_ENV_SUFFIXES = ("_API_KEY", "_TOKEN", "_ACCESS_KEY", "_SECRET", "_SECRET_KEY",
                            "_BASE_URL", "_API_BASE")
_CREDENTIAL_ENV_NAMES = frozenset({
    "GOOGLE_APPLICATION_CREDENTIALS", "AWS_PROFILE", "AWS_REGION", "AWS_DEFAULT_REGION",
})
RU_ENV_PREFIXES = ("YANDEX_", "GIGACHAT_", "NOMAD_")


def yandex_model_uri(folder_id: str, model: str = DEFAULT_YANDEX_MODEL) -> str:
    """``gpt://<folder>/<model>`` — the model id Yandex's OpenAI-compatible API expects."""
    folder_id = folder_id.strip()
    if not folder_id or "/" in folder_id:
        raise ValueError("folder_id must be a bare Yandex Cloud folder id")
    return f"gpt://{folder_id}/{model}"


def hermes_constraints(*, model: str, context_length: int = DEFAULT_CONTEXT_LENGTH,
                       provider_key: str = YANDEX_PROVIDER_KEY, api: str = YANDEX_OPENAI_BASE,
                       key_env: str = YANDEX_KEY_ENV) -> dict:
    """The config.yaml keys that pin a Hermes profile to one RU endpoint and shut its fallbacks."""
    reason, host = classify(LaneTarget("hermes-profile", provider=f"custom:{provider_key}",
                                       base_url=api))
    if reason is not None:
        raise ValueError(f"{api!r} is not an active RU endpoint ({reason}, host={host!r})")
    if context_length < HERMES_MIN_CONTEXT:
        raise ValueError(f"context_length {context_length} is below Hermes' floor "
                         f"{HERMES_MIN_CONTEXT}; Hermes would refuse to start")
    pinned_aux = {"provider": "main", "model": "", "base_url": "", "api_key": "", "fallback_chain": []}
    return {
        # Явный провайдер обязателен: встроенная цепочка обнаружения (OpenRouter → Nous → Codex → …)
        # включается только при provider: auto или пустом.
        "model": {"provider": f"custom:{provider_key}", "default": model,
                  "context_length": context_length},
        "providers": {provider_key: {
            "name": provider_key, "api": api, "key_env": key_env,
            "transport": "chat_completions", "discover_models": False,
        }},
        "fallback_providers": [],
        "auxiliary": {
            **{task: dict(pinned_aux) for task in AUX_TASKS},
            # Шаг OpenRouter в авто-цепочке вспомогательных задач — только бесплатный и без модели.
            "free_only": True,
            "openrouter_model": "",
        },
        "delegation": {"provider": "", "model": "", "base_url": "", "api_key": "",
                       "fallback_providers": []},
        "moa": {"active_preset": "", "default_preset": "", "presets": {}},
        # Не содержимое разговора, но зарубежные запросы метаданных при старте (замерено прокси).
        "model_catalog": {"enabled": False},
        "updates": {"check": False},
        "telemetry": {"shared_metrics": {"enabled": False, "send": False}},
        "agent": {"disabled_toolsets": list(FOREIGN_EGRESS_TOOLSETS)},
    }


def constraints_for_mode(mode: RuOnly, **kwargs: Any) -> Optional[dict]:
    """``hermes_constraints(**kwargs)`` when RU-only is on, ``None`` otherwise (nothing to apply)."""
    return hermes_constraints(**kwargs) if mode.enabled else None


def _merge(base: Any, overlay: Any) -> Any:
    if isinstance(base, dict) and isinstance(overlay, dict):
        merged = dict(base)
        for key, value in overlay.items():
            merged[key] = _merge(base.get(key), value)
        return merged
    return copy.deepcopy(overlay)


def apply_constraints(config: Optional[Mapping[str, Any]], constraints: Mapping[str, Any]) -> dict:
    """A copy of ``config`` with the RU constraints enforced.

    Слияние годится не везде: списки и словари, через которые Hermes уходит к другому провайдеру,
    ЗАМЕНЯЮТСЯ целиком, иначе чужая запись пользователя пережила бы слияние. Остальное (таймауты
    вспомогательных задач, прочие ключи профиля) сохраняется.
    """
    original = copy.deepcopy(dict(config or {}))
    result = _merge(original, dict(constraints))
    if isinstance(result.get("model"), dict):
        constraint_model = constraints.get("model") if isinstance(constraints.get("model"), Mapping) else {}
        for stale_key in ("base_url", "api", "api_key", "key_env", "api_key_env"):
            if stale_key not in constraint_model:
                result["model"].pop(stale_key, None)
    result["providers"] = copy.deepcopy(constraints["providers"])
    result["fallback_providers"] = []
    result.pop("fallback_model", None)
    result.pop("custom_providers", None)
    result["delegation"]["fallback_providers"] = []
    result["moa"]["presets"] = {}
    for block in result["auxiliary"].values():
        if isinstance(block, dict):
            block["fallback_chain"] = []
    # Отключённые наборы — объединение: выключенное самим покупателем остаётся выключенным.
    agent = original.get("agent") if isinstance(original.get("agent"), dict) else {}
    previously = agent.get("disabled_toolsets") or []
    result["agent"]["disabled_toolsets"] = sorted(
        set(previously) | set(constraints["agent"]["disabled_toolsets"]))
    return result


def _entry_target(entry: Any, label: str, providers: Mapping[str, Any]) -> Optional[LaneTarget]:
    """LaneTarget for a fallback / aux / delegation entry; ``None`` when it means «same as main»."""
    if not isinstance(entry, Mapping):
        return LaneTarget(label, provider=str(entry))
    provider = str(entry.get("provider") or "").strip()
    base_url = str(entry.get("base_url") or entry.get("api") or "").strip()
    if not base_url and provider in ("", "main", "auto"):
        return None
    if not base_url and provider.startswith("custom:"):
        named = providers.get(provider.split(":", 1)[1])
        if isinstance(named, Mapping):
            base_url = str(named.get("api") or named.get("base_url") or named.get("url") or "")
    return LaneTarget(label, provider=provider, base_url=base_url or None, model=entry.get("model"))


def _check(target: Optional[LaneTarget], where: str, out: list[str]) -> None:
    if target is None:
        return
    reason, host = classify(target)
    if reason is not None:
        out.append(f"{where}: {reason} (provider={target.provider!r}, host={host!r})")


def _section(config: Mapping[str, Any], key: str) -> Mapping[str, Any]:
    value = config.get(key)
    return value if isinstance(value, Mapping) else {}


def audit_hermes_config(config: Optional[Mapping[str, Any]]) -> list[str]:
    """Every place in a Hermes config.yaml that could send a request outside the RU contour.

    Пустой список — профиль в контуре. Проверяется то же, что закрывает ``hermes_constraints``,
    но по факту: пользователь мог дописать ключи руками или через ``hermes fallback add``.
    """
    config = config or {}
    out: list[str] = []
    providers = _section(config, "providers")

    model = _section(config, "model")
    model_provider = str(model.get("provider") or "").strip()
    if model_provider in ("", "auto"):
        out.append("model.provider: must name an RU provider explicitly "
                   "(empty/auto enables built-in provider discovery)")
    else:
        _check(_entry_target({"provider": model_provider, "base_url": model.get("base_url")},
                             "model", providers), "model", out)

    for name, entry in providers.items():
        if not isinstance(entry, Mapping) or entry.get("enabled") is False:
            continue
        api = entry.get("api") or entry.get("base_url") or entry.get("url") or ""
        _check(LaneTarget("providers", provider=f"custom:{name}", base_url=str(api)),
               f"providers.{name}", out)
    for i, entry in enumerate(config.get("custom_providers") or []):
        _check(_entry_target(entry, "custom_providers", providers)
               or LaneTarget("custom_providers", provider="custom"), f"custom_providers[{i}]", out)

    for i, entry in enumerate(config.get("fallback_providers") or []):
        _check(_entry_target(entry, "fallback", providers), f"fallback_providers[{i}]", out)
    if config.get("fallback_model"):
        _check(_entry_target(config["fallback_model"], "fallback", providers), "fallback_model", out)

    for task, block in _section(config, "auxiliary").items():
        if not isinstance(block, Mapping):
            continue
        _check(_entry_target(block, "aux", providers), f"auxiliary.{task}", out)
        for i, entry in enumerate(block.get("fallback_chain") or []):
            _check(_entry_target(entry, "aux", providers), f"auxiliary.{task}.fallback_chain[{i}]", out)

    delegation = _section(config, "delegation")
    _check(_entry_target(delegation, "delegation", providers), "delegation", out)
    for i, entry in enumerate(delegation.get("fallback_providers") or []):
        _check(_entry_target(entry, "delegation", providers), f"delegation.fallback_providers[{i}]", out)

    for name, preset in (_section(config, "moa").get("presets") or {}).items():
        if not isinstance(preset, Mapping) or preset.get("enabled") is False:
            continue
        slots = [s for s in list(preset.get("reference_models") or []) + [preset.get("aggregator")] if s]
        for i, slot in enumerate(slots):
            _check(_entry_target(slot, "moa", providers), f"moa.presets.{name}[{i}]", out)

    disabled = set(_section(config, "agent").get("disabled_toolsets") or [])
    missing = [t for t in FOREIGN_EGRESS_TOOLSETS if t not in disabled]
    if missing:
        out.append(f"agent.disabled_toolsets: foreign-egress toolsets still enabled: {missing}")
    return out


def audit_auth_store(auth: Optional[Mapping[str, Any]]) -> list[str]:
    """Credentials in a profile's auth.json that could carry a request outside the contour.

    Пул учёток ротируется внутри провайдера, но у записи пула есть свои ``base_url`` /
    ``inference_base_url``, а запасной провайдер получает СВОЙ пул. Поэтому в RU-режиме в хранилище
    не должно быть ни одной нероссийской учётки — ни в пуле, ни в OAuth-синглтонах.
    """
    auth = auth or {}
    out: list[str] = []
    ru_keys = {e.provider for e in RU_ENDPOINTS if e.active}
    ru_keys |= {f"custom:{key}" for key in ru_keys}
    for key, entries in _section(auth, "credential_pool").items():
        if not entries:
            continue
        if key not in ru_keys:
            out.append(f"credential_pool.{key}: non-RU pool with {len(entries)} credential(s)")
            continue
        for i, entry in enumerate(entries if isinstance(entries, list) else []):
            for field in ("base_url", "inference_base_url"):
                url = entry.get(field) if isinstance(entry, Mapping) else None
                if url:
                    _check(LaneTarget("pool", provider=key, base_url=str(url)),
                           f"credential_pool.{key}[{i}].{field}", out)
    for key, state in _section(auth, "providers").items():
        if state and key not in ru_keys:
            out.append(f"providers.{key}: non-RU login stored in auth.json")
    return out


def sanitize_env(env: Mapping[str, str]) -> tuple[dict, list[str]]:
    """Executor environment without non-RU credentials. Returns ``(clean_env, removed_names)``.

    Второй рубеж после конфига: без ключа зарубежного провайдера Hermes не соберёт к нему клиента,
    даже если кто-то вернёт запасную цепочку. Удаляются имена, похожие на учётки и адреса API;
    ``YANDEX_*``, ``GIGACHAT_*``, ``NOMAD_*`` остаются.
    """
    clean: dict = {}
    removed: list[str] = []
    for name, value in env.items():
        upper = name.upper()
        credential_like = upper in _CREDENTIAL_ENV_NAMES or upper.endswith(_CREDENTIAL_ENV_SUFFIXES)
        if credential_like and not upper.startswith(RU_ENV_PREFIXES):
            removed.append(name)
        else:
            clean[name] = value
    return clean, sorted(removed)


def _resolve_home_and_config(home: Optional[Path | str] = None) -> tuple[Path, Path]:
    if home is None:
        cfg = profile_config.config_path()
        return cfg.parent, cfg
    path = Path(home)
    if path.suffix.lower() in (".yaml", ".yml") or (path.exists() and path.is_file()):
        return path.parent, path
    return path, path / "config.yaml"


def audit_ru_config(home: Optional[Path | str | Mapping[str, Any]] = None, *,
                    env: Optional[Mapping[str, str]] = None) -> dict:
    """Audit a Hermes profile (or raw config mapping) for RU-only contour compliance."""
    if isinstance(home, Mapping):
        raw_config = dict(home)
        home_dir: Optional[Path] = None
        config_path: Optional[Path] = None
        unreadable_error: Optional[str] = None
        nomad_sec = raw_config.get(CONFIG_SECTION)
        raw_flag = nomad_sec.get(CONFIG_KEY) if isinstance(nomad_sec, Mapping) else None
        if _env_lock(env):
            mode = RuOnly(True, "env", True)
        elif isinstance(raw_flag, bool):
            mode = RuOnly(raw_flag, "config", raw_flag)
        else:
            mode = RuOnly(False, "default")
    else:
        home_dir, config_path = _resolve_home_and_config(home)
        mode = resolve_ru_only(config_path, env=env)
        try:
            loaded = profile_config.load(config_path)
        except profile_config.ConfigUnreadable as exc:
            raw_config = {}
            unreadable_error = str(exc)
        else:
            raw_config = loaded if isinstance(loaded, dict) else {}
            unreadable_error = None

    violations: list[str] = []
    if unreadable_error is not None:
        violations.append(f"config.yaml: {unreadable_error}")
    else:
        nomad_sec = raw_config.get(CONFIG_SECTION)
        if nomad_sec is not None and not isinstance(nomad_sec, Mapping):
            violations.append(f"nomad: expected a mapping, got {type(nomad_sec).__name__}")
        elif isinstance(nomad_sec, Mapping) and CONFIG_KEY in nomad_sec:
            if nomad_sec[CONFIG_KEY] is not True:
                violations.append(f"nomad.ru_only: must be true in RU contour (got {nomad_sec[CONFIG_KEY]!r})")
        violations.extend(audit_hermes_config(raw_config))

    if home_dir is not None:
        auth_path = home_dir / "auth.json"
        if auth_path.is_file():
            try:
                auth_data = json.loads(auth_path.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                violations.append(f"auth.json: unreadable ({exc})")
            else:
                if isinstance(auth_data, Mapping):
                    violations.extend(audit_auth_store(auth_data))

    return {
        "ok": len(violations) == 0,
        "ru_only": mode.enabled,
        "source": mode.source,
        "home": str(home_dir) if home_dir is not None else "",
        "config_path": str(config_path) if config_path is not None else "",
        "violations": violations,
        "findings": list(violations),
        "issues": list(violations),
    }


def apply_ru_config(home: Optional[Path | str] = None, *, model: Optional[str] = None,
                    folder_id: Optional[str] = None) -> dict:
    """Enforce ``nomad.ru_only: true`` and ``hermes_constraints`` on a profile's config.yaml."""
    home_dir, config_path = _resolve_home_and_config(home)
    home_dir.mkdir(parents=True, exist_ok=True)
    try:
        loaded = profile_config.load(config_path)
    except profile_config.ConfigUnreadable:
        existing: dict[str, Any] = {}
    else:
        existing = loaded if isinstance(loaded, dict) else {}

    existing_model = _section(existing, "model")
    existing_default = str(existing_model.get("default") or "").strip()
    existing_provider = str(existing_model.get("provider") or "").strip().lower()
    resolved_folder = (folder_id if folder_id is not None else os.environ.get("YANDEX_FOLDER_ID", "")).strip()

    if model and model.strip():
        chosen_model = model.strip()
    elif existing_default and (
        existing_default.startswith("gpt://")
        or existing_provider in (YANDEX_PROVIDER_KEY, f"custom:{YANDEX_PROVIDER_KEY}")
    ):
        chosen_model = existing_default
    elif resolved_folder and "/" not in resolved_folder:
        chosen_model = yandex_model_uri(resolved_folder, DEFAULT_YANDEX_MODEL)
    else:
        chosen_model = DEFAULT_YANDEX_MODEL

    existing_ctx = existing_model.get("context_length")
    context_length = (
        existing_ctx
        if isinstance(existing_ctx, int) and not isinstance(existing_ctx, bool) and existing_ctx >= HERMES_MIN_CONTEXT
        else DEFAULT_CONTEXT_LENGTH
    )

    constraints = hermes_constraints(model=chosen_model, context_length=context_length)
    enforced = apply_constraints(existing, constraints)
    nomad_sec = existing.get(CONFIG_SECTION)
    nomad_dict = dict(nomad_sec) if isinstance(nomad_sec, Mapping) else {}
    nomad_dict[CONFIG_KEY] = True
    enforced[CONFIG_SECTION] = nomad_dict

    config_path.write_text(
        yaml.safe_dump(enforced, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )

    auth_path = home_dir / "auth.json"
    if auth_path.is_file():
        try:
            auth_data = json.loads(auth_path.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            auth_data = None
        if isinstance(auth_data, dict):
            ru_keys = {e.provider for e in RU_ENDPOINTS if e.active}
            ru_keys |= {f"custom:{key}" for key in ru_keys}
            pool = auth_data.get("credential_pool")
            if isinstance(pool, dict):
                auth_data["credential_pool"] = {
                    k: v for k, v in pool.items() if k in ru_keys
                }
            provs = auth_data.get("providers")
            if isinstance(provs, dict):
                auth_data["providers"] = {
                    k: v for k, v in provs.items() if k in ru_keys
                }
            auth_path.write_text(json.dumps(auth_data, ensure_ascii=False, indent=2), encoding="utf-8")

    audit = audit_ru_config(home_dir)
    return {
        "ok": audit["ok"],
        "ru_only": True,
        "home": str(home_dir),
        "config_path": str(config_path),
        "model": enforced["model"]["default"],
        "violations": audit["violations"],
        "findings": audit["findings"],
        "issues": audit["issues"],
        "config": enforced,
    }

