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
import logging
import re
import sys
import uuid
from pathlib import Path
from types import ModuleType
from typing import Any

import yaml
from fastapi import APIRouter

log = logging.getLogger(__name__)

PLUGIN_DIR = Path(__file__).resolve().parent.parent

# Одна строка на экран. Порядок — порядок монтирования.
SCREENS: tuple[str, ...] = (
    "dashboard.nomad_account_api",
    "ui_accounts",
)

router = APIRouter()
MOUNTED: list[str] = []
ERRORS: dict[str, str] = {}

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


def _mount_screens() -> None:
    if not SCREENS:
        return
    try:
        root = _exec_file(f"nomad_dashboard_pkg_{uuid.uuid4().hex}", PLUGIN_DIR / "__init__.py")
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
