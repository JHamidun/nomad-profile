"""Бэкенд плагина Nomad: агрегатор маршрутов ``/api/plugins/nomad/*`` (M-127).

Один роутер кормит обе поверхности: дашборд ходит сюда ``fetchJSON``, десктоп — ``ctx.rest``,
который жёстко заскоуплен на ``/api/plugins/<id>`` (apps/desktop/src/api/plugins.ts). Ядро
импортирует этот файл само (``hermes_cli/web_server_dashboard.py``, ``_mount_plugin_api_routes``)
и монтирует ``router`` под ``/api/plugins/nomad`` — но только если ``nomad`` стоит в
``plugins.enabled`` (гейт ``_plugin_api_mount_skip_reason``). Своего гейта здесь нет и быть не должно.

Экран подключается ОДНОЙ строкой в ``SCREENS`` — это правка лида при слиянии (пометка ``lead:``).
Строка — имя модуля относительно каталога ``plugins/nomad/``:

* ``"ui_accounts"`` → ``plugins/nomad/ui_accounts.py`` (или ``ui_accounts/__init__.py``);
* ``"dashboard.nomad_account_api"`` → ``plugins/nomad/dashboard/nomad_account_api.py``.

У модуля обязан быть атрибут ``router`` (``fastapi.APIRouter``); его пути — относительно
``/api/plugins/nomad``. Модули исполняются как часть пакета плагина, поэтому относительные
импорты (``from . import activation``, ``from .. import db``) работают.

Почему пакет поднимается здесь, а не берётся у ядра. Ядро грузит этот файл через
``spec_from_file_location`` под именем ``hermes_dashboard_plugin_nomad`` — без пакета, и
``from . import …`` отсюда не работает. Агентская половина плагина живёт под
``hermes_plugins.nomad`` в процессе шлюза, а дашборд — обычно другой процесс. Поэтому корень
плагина поднимается своим, приватным именем, и общего состояния в памяти с шлюзом у экранов
нет: всё, что должно быть видно обеим сторонам, живёт на диске (база плагина, config.yaml, .env).

Почему экран грузится как ФАЙЛ, а не по имени модуля. Имя известно только во время работы, и
гейт core-adapter (M-157) не может доказать, что ``import_module(имя)`` не достаёт ядро Hermes.
Путь же строится из строки ``SCREENS`` внутри каталога плагина и после ``resolve()`` обязан там
остаться (ссылка наружу — отказ), так что ядром он не бывает по построению — это проверяет сам
код при каждой загрузке, а не исключение в списке гейта. ``sys.modules`` здесь только
пополняется своими именами и чистится от них; как значение он не читается.

Имя пакета новое при каждой загрузке: ядро исполняет этот файл заново при каждом монтировании, и
подмодули прошлой загрузки не должны отдать старый код. Прошлые копии не выгружаются — на них
всё равно держатся маршруты прошлого монтирования.

Сломанный экран не прячется: его маршрутов нет, соседние работают, а ``GET /health`` называет
его с причиной. ``/health`` всегда отвечает 200, состояние — в поле ``status`` (``ok`` или
``degraded``): оба транспорта интерфейса — ``ctx.rest`` десктопа и ``fetchJSON`` дашборда —
превращают любой ответ >= 400 в исключение и тело не отдают, и покупатель видел бы «сервер не
отвечает» вместо имени сломанного экрана.
"""

from __future__ import annotations

import importlib.util
import json
import logging
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException, Response

log = logging.getLogger(__name__)

PLUGIN_DIR = Path(__file__).resolve().parent.parent

# Одна строка на экран. Порядок — порядок монтирования.
SCREENS: tuple[str, ...] = (
    "dashboard.nomad_account_api",
    "ui_accounts",
    "ui_fallback",
    "ui_skills",
    "ui_safety",
    "ui_cron_incidents",
    "ui_data",
    "ui_start",
    "ui_stop",
)

router = APIRouter()
MOUNTED: list[str] = []
ERRORS: dict[str, str] = {}
_ROOT_PKG: ModuleType | None = None

_SCREEN_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*")


def _plugin_version() -> Any:
    try:
        return (yaml.safe_load((PLUGIN_DIR / "plugin.yaml").read_text(encoding="utf-8")) or {}).get("version")
    except (OSError, yaml.YAMLError) as exc:
        log.warning("Nomad: plugin.yaml unreadable: %s", exc)
        return None


@router.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "degraded" if ERRORS else "ok",
        "plugin": "nomad",
        "version": _plugin_version(),
        "screens": list(MOUNTED),
        "errors": dict(ERRORS),
    }


def _exec_file(name: str, path: Path) -> ModuleType:
    """Исполнить файл плагина модулем *name*; ``__init__.py`` становится пакетом со своим каталогом."""
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise ImportError(f"cannot load {path}")
    module = importlib.util.module_from_spec(spec)
    # Как у ядра: модуль в sys.modules ДО исполнения — pydantic/FastAPI ищут строковые
    # аннотации (``from __future__ import annotations``) по имени модуля.
    sys.modules[name] = module
    try:
        spec.loader.exec_module(module)
    except BaseException:
        if name in sys.modules:
            del sys.modules[name]
        raise
    return module


def _screen_file(screen: str) -> Path:
    """Файл экрана внутри PLUGIN_DIR: ``a.b`` → ``a/b.py`` или ``a/b/__init__.py``."""
    if not _SCREEN_NAME.fullmatch(screen):
        raise ValueError(f"{screen!r} is not a dotted module name")
    base = PLUGIN_DIR.joinpath(*screen.split("."))
    for candidate in (base.parent / f"{base.name}.py", base / "__init__.py"):
        if candidate.is_file():
            resolved = candidate.resolve()
            if not resolved.is_relative_to(PLUGIN_DIR):
                raise ImportError(f"{candidate} leads outside the plugin directory ({resolved})")
            return resolved
    raise ModuleNotFoundError(f"no {screen.replace('.', '/')}.py in {PLUGIN_DIR}")


def _loaded(root: ModuleType, dotted: str) -> ModuleType | None:
    """Подмодуль пакета, который уже поднял импорт (соседний экран сделал ``from . import x``)."""
    node: Any = root
    for part in dotted.split("."):
        node = getattr(node, part, None)
        if not isinstance(node, ModuleType):
            return None
    return node


def _load_screen(root: ModuleType, screen: str) -> ModuleType:
    module = _loaded(root, screen)
    if module is not None:
        return module  # второй экземпляр модуля разделил бы его состояние надвое
    module = _exec_file(f"{root.__name__}.{screen}", _screen_file(screen))
    parent_name, _, leaf = screen.rpartition(".")
    parent = _loaded(root, parent_name) if parent_name else root
    if parent is not None:
        setattr(parent, leaf, module)  # как у импорта: ``from . import leaf`` найдёт этот же модуль
    return module


def _ensure_root_pkg() -> ModuleType:
    global _ROOT_PKG
    if _ROOT_PKG is None:
        _ROOT_PKG = _exec_file(f"nomad_dashboard_pkg_{uuid.uuid4().hex}", PLUGIN_DIR / "__init__.py")
    return _ROOT_PKG


@router.get("/slack/manifest")
def get_slack_manifest() -> Response:
    """М-146: Сгенерировать манифест Slack, побайтово совпадающий со stdout ``hermes slack manifest``."""
    root = _ensure_root_pkg()
    ui_cli_mod = _load_screen(root, "ui_cli")
    res = ui_cli_mod.run_hermes(["slack", "manifest"])
    if not res.get("ok"):
        raise HTTPException(
            status_code=500,
            detail=res.get("message") or "Не удалось сгенерировать манифест Slack.",
        )
    stdout_bytes = (res.get("stdout") or "").encode("utf-8")
    return Response(content=stdout_bytes, media_type="application/json")


@router.get("/swarm")
@router.get("/swarm/tree")
def get_swarm_tree() -> dict[str, Any]:
    """М-181: Дерево роя, дорожки исполнения и события роя из базы плагина."""
    root = _ensure_root_pkg()
    db_mod = _load_screen(root, "db")
    caps_mod = _load_screen(root, "capabilities")

    lanes = []
    try:
        lanes = caps_mod.build_catalog()
    except Exception as exc:
        log.warning("get_swarm_tree: failed to build catalog: %s", exc)

    swarms = []
    try:
        conn = db_mod.connect()
        try:
            swarms = db_mod.list_swarms(conn, limit=50, with_events=True)
        finally:
            conn.close()
    except Exception as exc:
        log.warning("get_swarm_tree: failed to list swarms: %s", exc)

    tree = []
    for sw in swarms:
        node = {
            "id": sw["id"],
            "title": sw["goal"],
            "status": sw["status"],
            "created_at": sw["created_at"],
            "pool_mode": sw.get("pool_mode_at_creation", "shipped"),
            "events": sw.get("events") or [],
            "children": [],
        }
        for ev in node["events"]:
            node["children"].append({
                "id": f"ev-{ev.get('id', '')}",
                "kind": ev.get("kind", ""),
                "ts": ev.get("ts", ""),
                "detail": ev.get("detail"),
                "status": "completed",
            })
        tree.append(node)

    return {
        "ok": True,
        "swarms": swarms,
        "lanes": lanes,
        "tree": tree,
        "total": len(swarms),
    }


@router.get("/swarm/{swarm_id}")
def get_swarm_by_id(swarm_id: str) -> dict[str, Any]:
    """М-181: Получить отдельный рой по идентификатору."""
    root = _ensure_root_pkg()
    db_mod = _load_screen(root, "db")
    conn = db_mod.connect()
    try:
        sw = db_mod.get_swarm(conn, swarm_id, with_events=True)
    finally:
        conn.close()
    if sw is None:
        raise HTTPException(status_code=404, detail="Рой не найден")
    return {"ok": True, "swarm": sw}


@router.get("/models/local")
def get_local_models_state() -> dict[str, Any]:
    """М-145: Текущее состояние рабочей модели, локальных серверов и пользовательского эндпоинта."""
    root = _ensure_root_pkg()
    adapter = _load_screen(root, "core_adapter")
    cfg = adapter.load_config() if adapter.get_config_path().is_file() else {}
    model_cfg = cfg.get("model") if isinstance(cfg, dict) else {}
    if isinstance(model_cfg, dict):
        model_name = str(model_cfg.get("default") or model_cfg.get("name") or "")
        provider = str(model_cfg.get("provider") or "")
        base_url = str(model_cfg.get("base_url") or "")
    else:
        model_name = str(model_cfg or "")
        provider = ""
        base_url = ""
    custom_cfg = cfg.get("custom_endpoint") if isinstance(cfg, dict) and isinstance(cfg.get("custom_endpoint"), dict) else {}
    return {
        "ok": True,
        "model": model_name,
        "provider": provider,
        "base_url": base_url,
        "custom_base_url": str(custom_cfg.get("base_url") or base_url or ""),
        "custom_models": list(custom_cfg.get("models") or []),
    }


def _extract_models_from_http_json(data: Any) -> list[str]:
    if not isinstance(data, dict):
        return []
    out: list[str] = []
    for key in ("models", "data"):
        items = data.get(key)
        if isinstance(items, list):
            for item in items:
                if isinstance(item, str) and item.strip():
                    out.append(item.strip())
                elif isinstance(item, dict):
                    val = item.get("id") or item.get("name") or item.get("model") or item.get("key")
                    if val:
                        out.append(str(val).strip())
    return out


@router.post("/models/local/test")
def test_local_or_custom_endpoint(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """М-145: Проверка соединения с локальным сервером (Ollama/LM Studio/vLLM) или своим эндпоинтом."""
    body = payload or {}
    kind = str(body.get("kind") or "ollama").strip().lower()
    base_url = str(body.get("base_url") or "").strip().rstrip("/")
    if not base_url:
        raise HTTPException(status_code=400, detail="Укажите базовый адрес сервера (base_url).")

    default_probe = {
        "ollama": "/api/tags",
        "lmstudio": "/api/v1/models",
        "vllm": "/v1/models",
        "custom": "/v1/models",
    }.get(kind, "/v1/models")
    probe_path = str(body.get("probe_path") or default_probe).strip()
    if not probe_path.startswith("/"):
        probe_path = "/" + probe_path

    # Если base_url уже заканчивается на /v1, не дублируем /v1 в probe_path
    if base_url.endswith("/v1") and probe_path.startswith("/v1/"):
        target_url = base_url + probe_path[3:]
    else:
        target_url = base_url + probe_path

    headers: dict[str, str] = {"Accept": "application/json"}
    api_key = str(body.get("api_key") or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    manual_models = [str(m).strip() for m in (body.get("models") or []) if str(m).strip()]
    try:
        req = urllib.request.Request(target_url, headers=headers, method="GET")
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            parsed = json.loads(raw) if raw.strip() else {}
            discovered = _extract_models_from_http_json(parsed)
            models = discovered or manual_models
            return {
                "ok": True,
                "reachable": True,
                "kind": kind,
                "endpoint": target_url,
                "models": models,
                "message": f"Соединение установлено ({target_url}). Найдено моделей: {len(models)}.",
            }
    except (OSError, urllib.error.URLError, ValueError) as exc:
        return {
            "ok": True,
            "reachable": False,
            "kind": kind,
            "endpoint": target_url,
            "models": manual_models,
            "error": str(exc),
            "message": f"Сервер по адресу {target_url} недоступен: {exc}",
        }


@router.post("/models/local/activate")
def activate_local_or_custom_model(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    """М-145: Назначить выбранную локальную или пользовательскую модель рабочей моделью профиля."""
    body = payload or {}
    model_name = str(body.get("model") or "").strip()
    if not model_name:
        raise HTTPException(status_code=400, detail="Укажите имя модели для активации.")
    provider = str(body.get("provider") or "custom").strip() or "custom"
    base_url = str(body.get("base_url") or "").strip()
    api_key = str(body.get("api_key") or "").strip()
    models_list = [str(m).strip() for m in (body.get("models") or []) if str(m).strip()]

    root = _ensure_root_pkg()
    adapter = _load_screen(root, "core_adapter")
    cfg = adapter.load_config() if adapter.get_config_path().is_file() else {}
    if not isinstance(cfg, dict):
        cfg = {}

    model_section = cfg.get("model")
    if not isinstance(model_section, dict):
        model_section = {}
    model_section["default"] = model_name
    model_section["name"] = model_name
    model_section["provider"] = provider
    if base_url:
        model_section["base_url"] = base_url
    cfg["model"] = model_section

    if provider == "custom" or models_list:
        cfg["custom_endpoint"] = {
            "base_url": base_url,
            "models": models_list or [model_name],
        }

    adapter.save_config(cfg)
    if api_key:
        adapter.save_env_value("CUSTOM_API_KEY", api_key)

    return {
        "ok": True,
        "model": model_name,
        "provider": provider,
        "base_url": base_url,
    }


def _mount_screens() -> None:
    global _ROOT_PKG
    if not SCREENS:
        return
    try:
        root = _exec_file(f"nomad_dashboard_pkg_{uuid.uuid4().hex}", PLUGIN_DIR / "__init__.py")
        _ROOT_PKG = root
    except Exception as exc:
        log.exception("Nomad: plugin package failed to import, no screens mounted")
        ERRORS.update({screen: f"plugin package: {type(exc).__name__}: {exc}" for screen in SCREENS})
        return
    for screen in SCREENS:
        try:
            screen_router = getattr(_load_screen(root, screen), "router", None)
            if not isinstance(screen_router, APIRouter):
                raise TypeError(f"module has no APIRouter named 'router' (got {type(screen_router).__name__})")
            router.include_router(screen_router)
        except Exception as exc:
            log.exception("Nomad: screen %s failed to mount", screen)
            ERRORS[screen] = f"{type(exc).__name__}: {exc}"
        else:
            MOUNTED.append(screen)


_mount_screens()

