"""Gateway hook ``gateway:startup`` -> start the Nomad conductor loop.

Почему шлюзовый хук, а не ``ctx.spawn_task`` из плагина: хуки ``<home>/hooks/<имя>/HOOK.yaml +
handler.py`` и событие ``gateway:startup`` описаны в документации (user-guide/features/hooks.md,
с примером фонового потока), а ``spawn_task`` в контракт совместимости плагинов не входит и без
работающего цикла событий падает RuntimeError.

Хук живёт только в шлюзе — CLI шлюзовые хуки не грузит, и это правильно: цикл дирижёра нужен
долгоживущему процессу, а не разовой команде.

Идемпотентность держит реестр дирижёра (``conductor.ensure_started``), общий на процесс: повторный
``gateway:startup``, перезагрузка реестра хуков (новый объект этого модуля) или вторая копия пакета
плагина в том же процессе второй цикл не запустят.
"""

# nomad-workaround: PR-6 (docs/upstream-prs.md)
# До регистрации хука gateway_started в VALID_HOOKS плагинов ядра (PR-6)
# дирижёр запускается через шлюзовый хук gateway:startup в hooks/nomad-loop/.

from __future__ import annotations

import hashlib
import importlib
import importlib.util
import logging
import sys
import threading
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("hermes_plugins.nomad.hook")

EVENT = "gateway:startup"

# <home>/hooks/nomad-loop/handler.py -> <home>/plugins/nomad. Хук и плагин приезжают одной
# установкой профиля (оба пути в distribution_owned), поэтому путь выводится от этого файла,
# а не от «активного профиля» в момент вызова.
PLUGIN_DIR = Path(__file__).resolve().parents[2] / "plugins" / "nomad"

_IMPORT_LOCK = threading.Lock()


def _runtime_package_name() -> str:
    # Своё имя пакета, а не hermes_plugins.nomad: то — внутренняя деталь загрузчика ядра, и у хука
    # нет документированного способа получить уже загруженный плагин. Хеш пути — чтобы два профиля
    # в одном процессе не делили один модуль.
    digest = hashlib.sha256(str(PLUGIN_DIR).encode("utf-8")).hexdigest()[:12]
    return f"nomad_gateway_runtime_{digest}"


_DEFAULTS_CACHE: dict[str, tuple[tuple[int, int], Any]] = {}


def _load_conductor():
    name = _runtime_package_name()
    with _IMPORT_LOCK:
        package = sys.modules.get(name)
        if package is None:
            init_file = PLUGIN_DIR / "__init__.py"
            if not init_file.is_file():
                raise FileNotFoundError(f"nomad plugin is not installed at {PLUGIN_DIR}")
            spec = importlib.util.spec_from_file_location(
                name, init_file, submodule_search_locations=[str(PLUGIN_DIR)])
            if spec is None or spec.loader is None:
                raise ImportError(f"cannot build an import spec for {init_file}")
            package = importlib.util.module_from_spec(spec)
            sys.modules[name] = package
            try:
                spec.loader.exec_module(package)
            except BaseException:
                sys.modules.pop(name, None)
                raise
    return importlib.import_module(f"{name}.conductor")


def _load_defaults():
    """Load ``<plugin>/defaults.py`` under the hook's runtime package, reloading if the file on disk
    changed (e.g. after ``hermes profile update`` in the same process)."""
    name = _runtime_package_name()
    defaults_file = PLUGIN_DIR / "defaults.py"
    if not defaults_file.is_file():
        return None
    st = defaults_file.stat()
    sig = (st.st_mtime_ns, st.st_size)
    mod_name = f"{name}.defaults"
    with _IMPORT_LOCK:
        cached = _DEFAULTS_CACHE.get(mod_name)
        if cached is not None and cached[0] == sig:
            return cached[1]
        spec = importlib.util.spec_from_file_location(mod_name, defaults_file)
        if spec is None or spec.loader is None:
            raise ImportError(f"cannot build an import spec for {defaults_file}")
        module = importlib.util.module_from_spec(spec)
        sys.modules[mod_name] = module
        spec.loader.exec_module(module)
        _DEFAULTS_CACHE[mod_name] = (sig, module)
        return module


def _reconcile_defaults() -> list[str]:
    try:
        defaults = _load_defaults()
        if defaults is None:
            return []
        return list(defaults.reconcile())
    except Exception:
        logger.exception("nomad: config defaults reconciliation failed")
        return []


def handle(event_type: str, context: Optional[dict] = None, **_: Any) -> None:
    """Must be named ``handle``; sync is fine — the loop itself runs in a daemon thread."""
    if event_type != EVENT:
        return None
    try:
        conductor = _load_conductor()
        enabled, why = conductor.plugin_enabled()
        if enabled:
            loop, started_now = conductor.ensure_started()
            if started_now:
                loop.started.wait(5.0)
        _reconcile_defaults()
        if not enabled:
            # WARNING, а не INFO: чаще всего это не выбор покупателя, а сборка, в конфиге которой
            # забыли включить плагин, — и тогда цикл молчит на каждой машине.
            logger.warning("nomad: conductor loop not started — plugin 'nomad' is not enabled (%s)", why)
            return None
    except Exception:
        # Хук не должен ронять старт шлюза (ядро и так ловит исключения хуков), но отказ обязан
        # быть виден: строка с трассировкой в agent.log / gateway.log.
        logger.exception("nomad: conductor loop NOT started")
    return None

