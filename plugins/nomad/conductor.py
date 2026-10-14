"""Conductor loop of the Nomad swarm orchestrator (skeleton: start, stub tick, lane gate).

Запускается документированным шлюзовым хуком ``gateway:startup`` (``hooks/nomad-loop``), а не
``ctx.spawn_task``: тот вне контракта совместимости плагинов и падает RuntimeError без
работающего цикла событий — а у CLI его нет.

Тело цикла появится в следующих задачах. Сейчас цикл честно делает три вещи: пишет событие
``conductor_started`` в базу, пишет строку ``nomad: conductor loop started`` в лог и тикает
заглушкой. Запуск идемпотентен: повторный вызов не создаёт второй поток и второе событие.
"""

from __future__ import annotations

import contextvars
import logging
import os
import sys
import threading
import types
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Optional

from . import core_adapter, db, pool_mode, profile_config, ru_only

logger = logging.getLogger("hermes_plugins.nomad.conductor")

DEFAULT_TICK_SECONDS = 30.0
THREAD_NAME = "nomad-conductor"
STARTED_LOG_LINE = "nomad: conductor loop started"
EVENT_CONFIG_UNREADABLE = "conductor_config_unreadable"

# Реестр запущенных циклов должен быть ОДИН на процесс. Глобалы модуля для этого не годятся:
# в шлюзе этот код живёт в двух копиях — загрузчик плагинов импортирует пакет под своим именем,
# а хук — под своим (у хука нет документированного способа достать уже загруженный плагин).
# Поэтому реестр — отдельный модуль-объект в sys.modules под фиксированным именем:
# setdefault атомарен, и обе копии получают один и тот же замок и один словарь.
_REGISTRY_MODULE = "nomad_conductor_registry"


def _registry() -> types.ModuleType:
    fresh = types.ModuleType(_REGISTRY_MODULE)
    fresh.lock = threading.Lock()
    fresh.running = {}
    return sys.modules.setdefault(_REGISTRY_MODULE, fresh)


@dataclass(frozen=True)
class Lane:
    """A unit of work the conductor hands to an executor. ``pooled`` = draws from the account pool."""

    lane_id: str
    pooled: bool = False
    swarm_id: Optional[str] = None
    provider: Optional[str] = None
    base_url: Optional[str] = None
    model: Optional[str] = None

    def __post_init__(self) -> None:
        if isinstance(self.pooled, str) and self.provider is None:
            object.__setattr__(self, "provider", self.pooled)
            object.__setattr__(self, "pooled", False)


def _infer_provider(lane_id: str, explicit_provider: Optional[str]) -> str:
    if explicit_provider and str(explicit_provider).strip():
        return str(explicit_provider).strip()
    raw = (lane_id or "").strip()
    lower = raw.lower()
    if lower in ru_only.KNOWN_PROVIDER_HOSTS or lower == ru_only.TOOL_PROVIDER:
        return lower
    if ":" in lower:
        prefix = lower.split(":", 1)[0]
        if prefix in ru_only.KNOWN_PROVIDER_HOSTS or prefix == "custom":
            return lower if prefix == "custom" else prefix
    for sep in ("-", "_", "/"):
        if sep in lower:
            head, tail = lower.split(sep, 1)
            if head in ru_only.KNOWN_PROVIDER_HOSTS:
                return head
            if tail in ru_only.KNOWN_PROVIDER_HOSTS:
                return tail
    return raw


def _normalize_lane(
    lane: Lane | ru_only.LaneTarget | Mapping[str, Any] | str,
    *,
    pooled: Optional[bool] = None,
    swarm_id: Optional[str] = None,
    provider: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> Lane:
    if isinstance(lane, Lane):
        return Lane(
            lane_id=lane.lane_id,
            pooled=lane.pooled if pooled is None else bool(pooled),
            swarm_id=lane.swarm_id if swarm_id is None else swarm_id,
            provider=lane.provider if provider is None else provider,
            base_url=lane.base_url if base_url is None else base_url,
            model=lane.model if model is None else model,
        )
    if isinstance(lane, ru_only.LaneTarget):
        return Lane(
            lane_id=lane.lane_id,
            pooled=bool(pooled),
            swarm_id=swarm_id,
            provider=lane.provider if provider is None else provider,
            base_url=lane.base_url if base_url is None else base_url,
            model=lane.model if model is None else model,
        )
    if isinstance(lane, Mapping):
        raw_id = str(lane.get("lane_id") or lane.get("lane") or lane.get("provider") or "")
        return Lane(
            lane_id=raw_id,
            pooled=bool(lane.get("pooled", False) if pooled is None else pooled),
            swarm_id=lane.get("swarm_id") if swarm_id is None else swarm_id,
            provider=lane.get("provider") if provider is None else provider,
            base_url=lane.get("base_url") if base_url is None else base_url,
            model=lane.get("model") if model is None else model,
        )
    raw_id = str(lane)
    return Lane(
        lane_id=raw_id,
        pooled=bool(pooled) if pooled is not None else (":" in raw_id and not raw_id.lower().startswith("custom:")),
        swarm_id=swarm_id,
        provider=provider,
        base_url=base_url,
        model=model,
    )


def start_lane(
    conn,
    lane: Lane | ru_only.LaneTarget | Mapping[str, Any] | str,
    *,
    pooled: Optional[bool] = None,
    swarm_id: Optional[str] = None,
    provider: Optional[str] = None,
    base_url: Optional[str] = None,
    model: Optional[str] = None,
    config_path: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
) -> dict:
    """Start one lane, or refuse it. Every lane start in Nomad goes through here.

    Любая дорожка сначала проходит через ``ru_only.require_ru_lane``, а дорожка из пула — через
    ``pool_mode.require_pool_access``; отказ записывается в базу событием ``lane_refused`` с
    именованной причиной и в лог. Исполнителей ещё нет, поэтому «старт» пока — событие
    ``lane_started``.
    """
    normalized = _normalize_lane(
        lane,
        pooled=pooled,
        swarm_id=swarm_id,
        provider=provider,
        base_url=base_url,
        model=model,
    )
    resolved_provider = _infer_provider(normalized.lane_id, normalized.provider)
    target = ru_only.LaneTarget(
        lane_id=normalized.lane_id,
        provider=resolved_provider,
        base_url=normalized.base_url,
        model=normalized.model,
    )
    detail: dict[str, Any] = {"lane_id": normalized.lane_id, "pooled": normalized.pooled}
    try:
        ru_mode = ru_only.require_ru_lane(
            ru_only.ACTION_START_LANE,
            target,
            config_path=config_path,
            env=env,
        )
    except ru_only.RuOnlyRefused as refused:
        detail.update(
            reason=refused.reason,
            provider=refused.target.provider,
            host=refused.host,
            ru_only=refused.ru_only.enabled,
            ru_only_source=refused.ru_only.source,
        )
        db.add_event(conn, "lane_refused", detail, swarm_id=normalized.swarm_id)
        return {**detail, "started": False}
    if ru_mode.enabled:
        detail["ru_only"] = True

    if normalized.pooled:
        try:
            mode = pool_mode.require_pool_access(
                pool_mode.ACTION_POOLED_LANE,
                normalized.lane_id,
                config_path=config_path,
            )
        except pool_mode.PoolModeRefused as refused:
            detail.update(reason=refused.reason, pool_mode=refused.pool_mode.mode,
                          pool_mode_source=refused.pool_mode.source)
            db.add_event(conn, "lane_refused", detail, swarm_id=normalized.swarm_id)
            return {**detail, "started": False}
        detail["pool_mode"] = mode.mode
    db.add_event(conn, "lane_started", detail, swarm_id=normalized.swarm_id)
    logger.info("nomad: lane started lane=%s pooled=%s", normalized.lane_id, normalized.pooled)
    return {**detail, "started": True}


class Conductor:
    """One background loop per profile data directory."""

    def __init__(self, key: str, *, tick_seconds: float = DEFAULT_TICK_SECONDS):
        self.key = key
        self.tick_seconds = tick_seconds
        self.ticks = 0
        self.started = threading.Event()  # set once conductor_started is committed
        self.failed: Optional[BaseException] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None

    def is_alive(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    def start(self) -> None:
        # Поток не наследует ContextVar'ы вызывающего, а переопределение HERMES_HOME в шлюзе
        # (профильная область) живёт именно в ContextVar. Без copy_context цикл открыл бы базу
        # не того профиля.
        context = contextvars.copy_context()
        self._thread = threading.Thread(target=context.run, args=(self._run,),
                                        name=THREAD_NAME, daemon=True)
        self._thread.start()

    def stop(self, timeout: float = 10.0) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout)

    def tick(self, conn, *, claim_fn=None) -> int:
        """One conductor tick. Fails closed (0 cards taken) if ``<home>/config.yaml`` is unreadable."""
        self.ticks += 1
        try:
            profile_config.load_strict()
        except profile_config.ConfigUnreadable as exc:
            cfg_path = str(exc.path if exc.path is not None else profile_config.config_path())
            err_text = str(exc.error if getattr(exc, "error", None) else exc)
            db.add_event(conn, EVENT_CONFIG_UNREADABLE, {"path": cfg_path, "error": err_text})
            logger.warning(
                "nomad: %s path=%s error=%s — 0 cards taken",
                EVENT_CONFIG_UNREADABLE,
                cfg_path,
                err_text,
            )
            return 0
        if claim_fn is not None:
            claimed = claim_fn()
            return int(claimed) if isinstance(claimed, int) else 0
        return 0

    def _run(self) -> None:
        try:
            conn = db.connect()
        except BaseException as exc:
            self.failed = exc
            logger.exception("nomad: conductor loop failed to open its database")
            return
        try:
            mode = pool_mode.resolve_pool_mode()
            db.add_event(conn, "conductor_started", {
                "pid": os.getpid(), "pool_mode": mode.mode, "pool_mode_source": mode.source,
                "tick_seconds": self.tick_seconds,
            })
            logger.info("%s (pool_mode=%s, source=%s, pid=%s)",
                        STARTED_LOG_LINE, mode.mode, mode.source, os.getpid())
            self.started.set()
            while not self._stop.wait(self.tick_seconds):
                self.tick(conn)
        except BaseException as exc:
            self.failed = exc
            logger.exception("nomad: conductor loop crashed")
        finally:
            conn.close()
            logger.info("nomad: conductor loop stopped")


def plugin_enabled(config_path=None) -> tuple[bool, str]:
    """Would the core loader load ``nomad`` in this profile? Mirrors its gate on config.yaml.

    Загрузчик ядра грузит пользовательский плагин, только если он есть в ``plugins.enabled`` и нет
    в ``plugins.disabled`` (hermes_cli/plugins_discovery.gate_manifest). Хук шлюза этот шлюз не
    проходит, поэтому повторяет его сам: выключенный покупателем плагин не должен крутить цикл за
    его спиной. Нечитаемый конфиг — «выключен» (не запускаем то, в чём не уверены).
    """
    try:
        data = profile_config.load(config_path)
    except profile_config.ConfigUnreadable as exc:
        return False, f"config unreadable: {exc}"
    plugins = (data or {}).get("plugins")
    plugins = plugins if isinstance(plugins, dict) else {}
    disabled, enabled = plugins.get("disabled"), plugins.get("enabled")
    if isinstance(disabled, list) and db.PLUGIN_NAME in disabled:
        return False, "listed in plugins.disabled"
    if not isinstance(enabled, list) or db.PLUGIN_NAME not in enabled:
        return False, "not in plugins.enabled — run `hermes plugins enable nomad`"
    return True, "in plugins.enabled"


def _profile_key() -> str:
    return str(core_adapter.plugin_data_dir(db.PLUGIN_NAME).resolve())


def ensure_started(*, tick_seconds: float = DEFAULT_TICK_SECONDS) -> tuple[Conductor, bool]:
    """Start the loop for the active profile unless it already runs. Returns ``(loop, started_now)``.

    Не блокирует: база открывается уже в потоке, чтобы не держать цикл событий шлюза на SQLite.
    """
    key = _profile_key()
    registry = _registry()
    with registry.lock:
        current = registry.running.get(key)
        if current is not None and current.is_alive():
            logger.info("nomad: conductor loop already running (%s) — not starting another", key)
            return current, False
        conductor = Conductor(key, tick_seconds=tick_seconds)
        conductor.start()
        registry.running[key] = conductor
        return conductor, True


def running() -> dict:
    """Snapshot of registered loops (key -> Conductor)."""
    registry = _registry()
    with registry.lock:
        return dict(registry.running)


def stop_all(timeout: float = 10.0) -> None:
    """Stop every registered loop; a loop that did not stop in time stays registered (still alive)."""
    registry = _registry()
    with registry.lock:
        loops = dict(registry.running)
    for loop in loops.values():
        loop.stop(timeout)
    with registry.lock:
        for key, loop in loops.items():
            if registry.running.get(key) is loop and not loop.is_alive():
                del registry.running[key]
