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
import time
import types
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Mapping, Optional

from collections.abc import Sequence

from . import (
    core_adapter,
    db,
    launcher,
    lease,
    money,
    pool_mode,
    profile_config,
    reconcile,
    review,
    ru_only,
)

logger = logging.getLogger("hermes_plugins.nomad.conductor")

DEFAULT_TICK_SECONDS = 30.0
THREAD_NAME = "nomad-conductor"
STARTED_LOG_LINE = "nomad: conductor loop started"
EVENT_CONFIG_UNREADABLE = "conductor_config_unreadable"
EVENT_LEASE_CLAIMED = "lease_claimed"
EVENT_CARD_DEADLINE_STOP = "card_deadline_stop"
EVENT_SEMAPHORE_DEFERRED = "semaphore_deferred"
EVENT_RECONCILE_DONE = reconcile.EVENT_RECONCILE_DONE

MAX_SWARM_PARALLEL_CEILING = 25
MIN_SESSIONS_PER_ACCOUNT = 1
MAX_SESSIONS_PER_ACCOUNT = 2
DEFAULT_CARD_DEADLINE_S = 900.0

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
    if lower.startswith("paid:"):
        raw = raw.split(":", 1)[1].strip()
        lower = raw.lower()
    if lower in ru_only.KNOWN_PROVIDER_HOSTS or lower == ru_only.TOOL_PROVIDER or lower in ("glm", "zai"):
        return "glm" if lower == "zai" else lower
    if ":" in lower:
        prefix = lower.split(":", 1)[0]
        if prefix in ru_only.KNOWN_PROVIDER_HOSTS or prefix == "custom" or prefix in ("glm", "zai"):
            if prefix == "custom":
                return lower
            return "glm" if prefix == "zai" else prefix
    for sep in ("-", "_", "/"):
        if sep in lower:
            head, tail = lower.split(sep, 1)
            if head in ru_only.KNOWN_PROVIDER_HOSTS or head in ("glm", "zai"):
                return "glm" if head == "zai" else head
            if tail in ru_only.KNOWN_PROVIDER_HOSTS or tail in ("glm", "zai"):
                return "glm" if tail == "zai" else tail
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
    is_paid_prefix = raw_id.lower().startswith("paid:")
    return Lane(
        lane_id=raw_id,
        pooled=bool(pooled) if pooled is not None else (
            ":" in raw_id and not raw_id.lower().startswith("custom:") and not is_paid_prefix
        ),
        swarm_id=swarm_id,
        provider=provider,
        base_url=base_url,
        model=model,
    )


def _mark_swarm_failed(conn, swarm_id: Optional[str]) -> None:
    if not swarm_id:
        return
    try:
        conn.execute("UPDATE swarms SET status = 'failed' WHERE id = ?", (swarm_id,))
        conn.commit()
    except Exception:
        pass


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
    executable: Optional[str | Path] = None,
    args: Sequence[str | Path] = (),
    slot_dir: Optional[str | Path] = None,
    task_id: str = "",
    run_id: str = "",
    method: str = "wmi",
    gateway_pid: Optional[int] = None,
    paid: Optional[bool] = None,
    billing: Optional[str] = None,
    config: Optional[Mapping[str, Any]] = None,
    prices: Optional[Mapping[str, Any]] = None,
) -> dict:
    """Start one lane, or refuse it. Every lane start in Nomad goes through here.

    Любая дорожка сначала проходит через ``ru_only.require_ru_lane``, а дорожка из пула — через
    ``pool_mode.require_pool_access``; отказ записывается в базу событием ``lane_refused`` с
    именованной причиной и в лог. При переданных ``executable`` и ``slot_dir`` также запускает
    отвязанный процесс исполнителя через :func:`launcher.launch_worker` (M-165) и пишет
    ``(pid, start_time, slot_dir)`` в таблицу ``worker_processes``.
    """
    lane_mapping_paid: Optional[bool] = None
    lane_mapping_billing: Optional[str] = None
    if isinstance(lane, Mapping):
        if "paid" in lane:
            lane_mapping_paid = bool(lane.get("paid"))
        if "billing" in lane and lane.get("billing") is not None:
            lane_mapping_billing = str(lane.get("billing")).strip().lower()
    normalized = _normalize_lane(
        lane,
        pooled=pooled,
        swarm_id=swarm_id,
        provider=provider,
        base_url=base_url,
        model=model,
    )
    resolved_provider = _infer_provider(normalized.lane_id, normalized.provider)
    effective_billing = (billing or lane_mapping_billing or "").strip().lower()
    is_paid_lane = (
        bool(paid)
        or bool(lane_mapping_paid)
        or effective_billing in ("metered", "paid")
        or normalized.lane_id.lower().startswith("paid:")
    )
    target = ru_only.LaneTarget(
        lane_id=normalized.lane_id,
        provider=resolved_provider,
        base_url=normalized.base_url,
        model=normalized.model,
    )
    detail: dict[str, Any] = {"lane_id": normalized.lane_id, "pooled": normalized.pooled}
    if task_id:
        detail["task_id"] = task_id
    from . import stop
    if stop.is_stopped():
        detail["reason"] = "paused"
        db.add_event(conn, "lane_refused", detail, swarm_id=normalized.swarm_id)
        return {**detail, "started": False, "status": "paused"}
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
        _mark_swarm_failed(conn, normalized.swarm_id)
        return {**detail, "started": False, "status": "failed"}
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
            _mark_swarm_failed(conn, normalized.swarm_id)
            return {**detail, "started": False, "status": "failed"}
        detail["pool_mode"] = mode.mode

    canonical_paid = money.normalize_paid_provider(resolved_provider)
    if is_paid_lane:
        effective_config = config
        if effective_config is None and config_path is None and not money.has_verified_pricing(
            canonical_paid, prices=prices
        ):
            effective_config = {
                "nomad": {
                    "money": {
                        "ceiling_usd": 5.0,
                        "paid_provider_allowlist": [canonical_paid],
                    }
                }
            }
        decision = money.preflight_guard(
            canonical_paid,
            model=normalized.model,
            conn=conn,
            swarm_id=normalized.swarm_id,
            task_id=task_id or None,
            config=effective_config,
            config_path=config_path,
            prices=prices,
        )
        if not decision.allowed:
            detail.update(
                provider=canonical_paid,
                reason=decision.reason or money.REASON_BUDGET,
                error_code=decision.error_code,
                message=decision.message,
                block_kind=decision.block_kind,
                billing="metered",
            )
            db.add_event(conn, "lane_refused", detail, swarm_id=normalized.swarm_id)
            return {**detail, "started": False, "status": decision.card_status}
        detail["billing"] = "metered"
    elif canonical_paid == "glm":
        detail["stub"] = True
        detail["billing"] = "free"
        detail["cost_usd"] = 0.0

    if executable is not None and slot_dir is not None:
        launched = launcher.launch_worker(
            conn,
            executable,
            args,
            slot_dir=slot_dir,
            lane=normalized.lane_id,
            task_id=task_id,
            run_id=run_id,
            swarm_id=normalized.swarm_id,
            env=env,
            gateway_pid=gateway_pid,
            method=method,
        )
        detail.update(
            pid=launched.pid,
            start_time=launched.start_time,
            slot_dir=str(launched.slot_dir),
            executable=str(launched.executable),
            parent_pid=launched.parent_pid,
            gateway_pid=launched.gateway_pid,
            method=launched.method,
        )

    db.add_event(conn, "lane_started", detail, swarm_id=normalized.swarm_id)
    logger.info("nomad: lane started lane=%s pooled=%s", normalized.lane_id, normalized.pooled)
    return {**detail, "started": True, "status": "running"}


def start_paid_lane(
    conn,
    lane: Lane | ru_only.LaneTarget | Mapping[str, Any] | str,
    **kwargs: Any,
) -> dict:
    """Start a metered (paid) lane through :func:`start_lane` with ``paid=True``."""
    kwargs.setdefault("paid", True)
    return start_lane(conn, lane, **kwargs)


def _claimer_lane_token(lane: str) -> str:
    """Normalize a lane identifier so it is valid inside ``<host>:nomad-<lane>``."""
    raw = (lane or "").strip()
    if raw.lower().startswith("custom:"):
        raw = raw.split(":", 1)[1].strip()
    return raw.replace(":", "-")


DEFAULT_ACCOUNT_POOL_SIZE = 30


@dataclass(frozen=True)
class SwarmLimits:
    """Three-level concurrency ceilings and card deadline read from ``config.yaml`` (M-167)."""

    max_parallel: int = MAX_SWARM_PARALLEL_CEILING
    sessions_per_account: int = MAX_SESSIONS_PER_ACCOUNT
    lane_caps: Mapping[str, int] = field(default_factory=dict)
    card_deadline_s: float = DEFAULT_CARD_DEADLINE_S
    accounts: tuple[str, ...] = ()

    @property
    def max_sessions_per_account(self) -> int:
        return self.sessions_per_account

    def lane_cap(self, lane: str) -> int:
        raw_lane = str(lane or "").strip()
        base_lane = _claimer_lane_token(raw_lane)
        for key in (raw_lane, base_lane, raw_lane.lower(), base_lane.lower()):
            if key in self.lane_caps:
                cap = int(self.lane_caps[key])
                return max(1, min(cap, self.max_parallel))
        return self.max_parallel

    @classmethod
    def from_mapping(cls, cfg: Optional[Mapping[str, Any]] = None) -> "SwarmLimits":
        cfg_map = cfg if isinstance(cfg, Mapping) else {}
        nomad_cfg = cfg_map.get("nomad") if isinstance(cfg_map.get("nomad"), Mapping) else {}
        swarm_cfg = nomad_cfg.get("swarm") if isinstance(nomad_cfg.get("swarm"), Mapping) else {}
        kanban_cfg = cfg_map.get("kanban") if isinstance(cfg_map.get("kanban"), Mapping) else {}
        lease_cfg = nomad_cfg.get("lease") if isinstance(nomad_cfg.get("lease"), Mapping) else {}

        raw_parallel = swarm_cfg.get("max_parallel")
        if raw_parallel is None or isinstance(raw_parallel, bool):
            raw_parallel = kanban_cfg.get("max_in_progress", MAX_SWARM_PARALLEL_CEILING)
        try:
            max_parallel = int(raw_parallel)
        except (TypeError, ValueError):
            max_parallel = MAX_SWARM_PARALLEL_CEILING
        if max_parallel <= 0:
            max_parallel = 1
        max_parallel = min(max_parallel, MAX_SWARM_PARALLEL_CEILING)

        if (
            "kanban" in cfg_map
            and isinstance(kanban_cfg.get("max_in_progress"), int)
            and not isinstance(kanban_cfg.get("max_in_progress"), bool)
            and kanban_cfg["max_in_progress"] > 0
        ):
            max_parallel = min(max_parallel, int(kanban_cfg["max_in_progress"]))

        raw_spa = swarm_cfg.get("max_sessions_per_account")
        if raw_spa is None or isinstance(raw_spa, bool):
            raw_spa = swarm_cfg.get("sessions_per_account")
        if raw_spa is None or isinstance(raw_spa, bool):
            sessions_per_account = MAX_SESSIONS_PER_ACCOUNT
        else:
            try:
                sessions_per_account = int(raw_spa)
            except (TypeError, ValueError):
                sessions_per_account = MAX_SESSIONS_PER_ACCOUNT
        sessions_per_account = max(
            MIN_SESSIONS_PER_ACCOUNT,
            min(sessions_per_account, MAX_SESSIONS_PER_ACCOUNT),
        )

        lane_caps: dict[str, int] = {}
        raw_lane_caps = swarm_cfg.get("lane_caps")
        if not isinstance(raw_lane_caps, Mapping):
            raw_lane_caps = nomad_cfg.get("lane_caps")
        if isinstance(raw_lane_caps, Mapping):
            for k, v in raw_lane_caps.items():
                if isinstance(v, bool):
                    continue
                try:
                    cap_val = int(v)
                except (TypeError, ValueError):
                    continue
                if cap_val > 0:
                    lane_caps[str(k).strip()] = min(cap_val, max_parallel)

        raw_deadline = swarm_cfg.get("card_deadline_s")
        if raw_deadline is None or isinstance(raw_deadline, bool):
            raw_deadline = lease_cfg.get("claim_ttl_s", DEFAULT_CARD_DEADLINE_S)
        try:
            card_deadline_s = float(raw_deadline)
        except (TypeError, ValueError):
            card_deadline_s = DEFAULT_CARD_DEADLINE_S
        if card_deadline_s <= 0:
            card_deadline_s = DEFAULT_CARD_DEADLINE_S

        accounts_list: list[str] = []
        raw_accounts = swarm_cfg.get("accounts")
        if isinstance(raw_accounts, Sequence) and not isinstance(raw_accounts, (str, bytes)):
            accounts_list = [str(a).strip() for a in raw_accounts if str(a).strip()]

        return cls(
            max_parallel=max_parallel,
            sessions_per_account=sessions_per_account,
            lane_caps=lane_caps,
            card_deadline_s=card_deadline_s,
            accounts=tuple(accounts_list),
        )

    @classmethod
    def load(cls, config_path: Optional[Path | str] = None) -> "SwarmLimits":
        cfg = profile_config.load(config_path)
        return cls.from_mapping(cfg)


@dataclass
class ActiveCardSlot:
    """State of an in-flight card holding swarm, lane, and account semaphore permits."""

    task_id: str
    lane: str
    account: str
    started_at: float
    deadline_s: float
    run_dir: Optional[Path] = None
    stop_marker: Optional[Path] = None
    pid: Optional[int] = None
    start_time: Optional[float] = None
    run_id: str = ""

    @property
    def deadline_at(self) -> float:
        return self.started_at + self.deadline_s

    def is_expired(self, now: Optional[float] = None) -> bool:
        current = time.time() if now is None else float(now)
        return (current - self.started_at) >= self.deadline_s


class SwarmSemaphores:
    """Three-level semaphore guard for conductor card execution (M-167):

    1. Swarm ceiling: ``active <= max_parallel`` (at most 25);
    2. Lane ceiling: ``active_on_lane <= lane_cap(lane)``;
    3. Account ceiling: ``active_on_account <= sessions_per_account`` (1–2 from ``config.yaml``).
    """

    def __init__(self, limits: Optional[SwarmLimits] = None) -> None:
        self._lock = threading.RLock()
        self.limits: SwarmLimits = limits or SwarmLimits()
        self._swarm_sem = threading.BoundedSemaphore(self.limits.max_parallel)
        self._lane_sems: dict[str, threading.BoundedSemaphore] = {}
        self._account_sems: dict[str, threading.BoundedSemaphore] = {}
        self._active: dict[str, ActiveCardSlot] = {}
        self._lane_counts: dict[str, int] = {}
        self._account_counts: dict[str, int] = {}
        self.peak_swarm_active: int = 0
        self.peak_lane_active: dict[str, int] = {}
        self.peak_account_active: dict[str, int] = {}

    def update_limits(self, limits: SwarmLimits) -> None:
        with self._lock:
            self.limits = limits

    @property
    def swarm_active(self) -> int:
        with self._lock:
            return len(self._active)

    @property
    def active_cards(self) -> dict[str, ActiveCardSlot]:
        with self._lock:
            return dict(self._active)

    @property
    def max_account_peak(self) -> int:
        with self._lock:
            return max(self.peak_account_active.values(), default=0)

    @property
    def max_lane_peak(self) -> int:
        with self._lock:
            return max(self.peak_lane_active.values(), default=0)

    def lane_active(self, lane: str) -> int:
        with self._lock:
            return self._lane_counts.get(str(lane or "").strip(), 0)

    def account_active(self, account: str) -> int:
        with self._lock:
            return self._account_counts.get(str(account or "").strip(), 0)

    def can_acquire(self, lane: str, account: str) -> tuple[bool, Optional[str]]:
        lane_key = str(lane or "").strip() or "default"
        acct_key = str(account or "").strip() or f"{lane_key}:slot-00"
        with self._lock:
            if len(self._active) >= self.limits.max_parallel:
                return False, "swarm"
            if self._lane_counts.get(lane_key, 0) >= self.limits.lane_cap(lane_key):
                return False, "lane"
            if self._account_counts.get(acct_key, 0) >= self.limits.sessions_per_account:
                return False, "account"
            return True, None

    def select_available_account(
        self,
        lane: str,
        candidates: Optional[Sequence[str]] = None,
    ) -> tuple[str, bool]:
        """Pick the first account from ``candidates`` (or default slot pool) below ``sessions_per_account``."""
        lane_key = _claimer_lane_token(str(lane or "").strip() or "default")
        with self._lock:
            pool = list(candidates) if candidates else list(self.limits.accounts)
            if not pool:
                pool = [f"{lane_key}:slot-{i:02d}" for i in range(DEFAULT_ACCOUNT_POOL_SIZE)]
            for acct in pool:
                acct_str = str(acct).strip()
                if not acct_str:
                    continue
                if self._account_counts.get(acct_str, 0) < self.limits.sessions_per_account:
                    return acct_str, True
            return (str(pool[0]).strip() if pool else f"{lane_key}:slot-00"), False

    def try_acquire(
        self,
        task_id: str,
        lane: str,
        account: str,
        *,
        started_at: Optional[float] = None,
        deadline_s: Optional[float] = None,
        run_dir: Optional[Path | str] = None,
        stop_marker: Optional[Path | str] = None,
        pid: Optional[int] = None,
        start_time: Optional[float] = None,
        run_id: str = "",
    ) -> tuple[bool, Optional[str]]:
        """Attempt to acquire all three semaphores (swarm, lane, account) for ``task_id``."""
        task_key = str(task_id or "").strip()
        if not task_key:
            raise ValueError("task_id must not be empty")
        lane_key = str(lane or "").strip() or "default"
        acct_key = str(account or "").strip() or f"{lane_key}:slot-00"

        with self._lock:
            if task_key in self._active:
                return True, None
            ok, reason = self.can_acquire(lane_key, acct_key)
            if not ok:
                return False, reason

            now_ts = time.time() if started_at is None else float(started_at)
            eff_deadline = (
                float(deadline_s)
                if deadline_s is not None
                else float(self.limits.card_deadline_s)
            )
            resolved_run_dir = Path(run_dir).expanduser().resolve() if run_dir is not None else None
            resolved_stop = (
                Path(stop_marker).expanduser().resolve()
                if stop_marker is not None
                else (resolved_run_dir / launcher.DEFAULT_STOP_MARKER_FILENAME if resolved_run_dir is not None else None)
            )
            slot = ActiveCardSlot(
                task_id=task_key,
                lane=lane_key,
                account=acct_key,
                started_at=now_ts,
                deadline_s=eff_deadline,
                run_dir=resolved_run_dir,
                stop_marker=resolved_stop,
                pid=pid,
                start_time=start_time,
                run_id=str(run_id or ""),
            )
            self._active[task_key] = slot
            new_swarm = len(self._active)
            new_lane = self._lane_counts.get(lane_key, 0) + 1
            new_acct = self._account_counts.get(acct_key, 0) + 1
            self._lane_counts[lane_key] = new_lane
            self._account_counts[acct_key] = new_acct

            if new_swarm > self.peak_swarm_active:
                self.peak_swarm_active = new_swarm
            if new_lane > self.peak_lane_active.get(lane_key, 0):
                self.peak_lane_active[lane_key] = new_lane
            if new_acct > self.peak_account_active.get(acct_key, 0):
                self.peak_account_active[acct_key] = new_acct

            return True, None

    def release(self, task_id: str) -> Optional[ActiveCardSlot]:
        """Release swarm, lane, and account permits held by ``task_id``."""
        task_key = str(task_id or "").strip()
        with self._lock:
            slot = self._active.pop(task_key, None)
            if slot is None:
                return None
            lane_cnt = self._lane_counts.get(slot.lane, 0) - 1
            if lane_cnt <= 0:
                self._lane_counts.pop(slot.lane, None)
            else:
                self._lane_counts[slot.lane] = lane_cnt

            acct_cnt = self._account_counts.get(slot.account, 0) - 1
            if acct_cnt <= 0:
                self._account_counts.pop(slot.account, None)
            else:
                self._account_counts[slot.account] = acct_cnt
            return slot

    def check_deadlines(
        self,
        *,
        now: Optional[float] = None,
        conn=None,
        keeper: Optional[lease.LeaseKeeper] = None,
        default_stop_dir: Optional[Path | str] = None,
        terminate_processes: bool = True,
    ) -> list[dict[str, Any]]:
        """Check all active cards for deadline expiration and write ``STOP`` markers (M-167)."""
        current = time.time() if now is None else float(now)
        with self._lock:
            expired_ids = [
                tid for tid, slot in self._active.items() if slot.is_expired(current)
            ]

        stopped: list[dict[str, Any]] = []
        for tid in expired_ids:
            slot = self.release(tid)
            if slot is None:
                continue
            elapsed = current - slot.started_at
            target_stop = slot.stop_marker
            target_dir = slot.run_dir
            if target_stop is None and target_dir is None:
                base = (
                    Path(default_stop_dir)
                    if default_stop_dir is not None
                    else (core_adapter.get_hermes_home() / "plugin-data" / "nomad" / "runs" / tid)
                )
                target_dir = base

            marker_path = launcher.write_stop_marker(
                target_dir,
                stop_marker=target_stop,
                task_id=slot.task_id,
                run_id=slot.run_id,
                reason="card_deadline_exceeded",
                deadline_s=slot.deadline_s,
                elapsed_s=elapsed,
                pid=slot.pid,
                expected_start_time=slot.start_time,
                terminate=terminate_processes,
            )
            slot.stop_marker = marker_path

            if keeper is not None:
                try:
                    keeper.release(slot.task_id, reason="card_deadline_exceeded")
                except Exception:
                    pass

            if conn is not None:
                if slot.pid is not None and slot.start_time is not None:
                    try:
                        db.update_worker_process_status(
                            conn,
                            pid=slot.pid,
                            start_time=slot.start_time,
                            status="deadline_exceeded",
                        )
                    except Exception:
                        pass
                db.add_event(
                    conn,
                    EVENT_CARD_DEADLINE_STOP,
                    {
                        "task_id": slot.task_id,
                        "lane_id": slot.lane,
                        "account": slot.account,
                        "deadline_s": slot.deadline_s,
                        "elapsed_s": round(elapsed, 3),
                        "stop_marker": str(marker_path),
                    },
                )

            stopped.append(
                {
                    "task_id": slot.task_id,
                    "lane_id": slot.lane,
                    "account": slot.account,
                    "deadline_s": slot.deadline_s,
                    "elapsed_s": round(elapsed, 3),
                    "stop_marker": marker_path,
                }
            )
        return stopped


def _split_lane_and_account(raw_assignee: str) -> tuple[str, Optional[str]]:
    """Extract optional explicit account from ``lane@account`` or ``lane#account``."""
    text = str(raw_assignee or "").strip()
    for sep in ("@", "#"):
        if sep in text:
            lane_part, acct_part = text.split(sep, 1)
            lane_part = lane_part.strip()
            acct_part = acct_part.strip()
            if lane_part and acct_part:
                return lane_part, acct_part
    return text, None


def _list_ready_external_cards(
    db_path: Path,
    *,
    local_profiles: set[str],
    board: Optional[str] = None,
) -> list[tuple[str, str]]:
    """Return ``[(task_id, assignee), ...]`` for ready external cards in ``kanban.db``."""
    if not db_path.is_file():
        return []
    cards: list[tuple[str, str]] = []
    with core_adapter.kanban.connect_closing(db_path=db_path, board=board) as kconn:
        rows = kconn.execute(
            "SELECT id, assignee FROM tasks "
            "WHERE status = 'ready' AND claim_lock IS NULL "
            "ORDER BY created_at ASC, rowid ASC"
        ).fetchall()
    for row in rows:
        task_id = str(row["id"] if isinstance(row, Mapping) or hasattr(row, "keys") else row[0])
        raw_assignee = row["assignee"] if isinstance(row, Mapping) or hasattr(row, "keys") else row[1]
        assignee = str(raw_assignee or "").strip()
        if not assignee or assignee == "unassigned" or assignee in local_profiles:
            continue
        cards.append((task_id, assignee))
    return cards


class Conductor:
    """One background loop per profile data directory."""

    def __init__(
        self,
        key: str,
        *,
        tick_seconds: float = DEFAULT_TICK_SECONDS,
        db_path: Optional[Path | str] = None,
        board: Optional[str] = None,
        limits: Optional[SwarmLimits] = None,
        semaphores: Optional[SwarmSemaphores] = None,
    ):
        self.key = key
        self.tick_seconds = tick_seconds
        self.ticks = 0
        self.started = threading.Event()  # set once conductor_started is committed
        self.failed: Optional[BaseException] = None
        self._stop = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._kanban_db_path: Optional[Path] = Path(db_path) if db_path is not None else None
        self._board: Optional[str] = board
        self._keeper: Optional[lease.LeaseKeeper] = None
        self._keeper_sig: Optional[tuple[str, int, float]] = None
        self.limits: SwarmLimits = limits or SwarmLimits()
        self.semaphores: SwarmSemaphores = semaphores or SwarmSemaphores(self.limits)

    @property
    def keeper(self) -> Optional[lease.LeaseKeeper]:
        return self._keeper

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
        if self._keeper is not None:
            self._keeper.stop(timeout)
        if self._thread is not None:
            self._thread.join(timeout)

    def _ensure_keeper(
        self,
        lease_cfg: lease.LeaseConfig,
        *,
        db_path: Path,
        board: Optional[str] = None,
    ) -> lease.LeaseKeeper:
        sig = (str(db_path.resolve()), lease_cfg.ttl_seconds, lease_cfg.renew_interval_seconds)
        if self._keeper is None or self._keeper_sig != sig:
            if self._keeper is not None:
                self._keeper.stop(timeout=2.0)
            self._keeper = lease.LeaseKeeper(lease_cfg, db_path=db_path, board=board)
            self._keeper_sig = sig
        self._keeper.start()
        return self._keeper

    def launch_worker(
        self,
        conn,
        executable_or_cli: str | Path,
        args: Sequence[str | Path] = (),
        *,
        slot_dir: str | Path,
        lane: str = "claude-code",
        task_id: str = "",
        run_id: str = "",
        swarm_id: Optional[str] = None,
        env: Optional[Mapping[str, str]] = None,
        gateway_pid: Optional[int] = None,
        method: str = "wmi",
    ) -> launcher.LaunchedProcess:
        """Launch a detached executor process for ``lane`` and record it in ``worker_processes``."""
        return launcher.launch_worker(
            conn,
            executable_or_cli,
            args,
            slot_dir=slot_dir,
            lane=lane,
            task_id=task_id,
            run_id=run_id,
            swarm_id=swarm_id,
            env=env,
            gateway_pid=gateway_pid,
            method=method,
        )

    def list_processes(self, conn, *, status: Optional[str] = None) -> list[dict]:
        """Return rows from ``worker_processes`` in ``data.db``."""
        return db.list_worker_processes(conn, status=status)

    def complete_card(
        self,
        task_id: str,
        *,
        keeper: Optional[lease.LeaseKeeper] = None,
        mark_done_in_kanban: bool = False,
        db_path: Optional[Path | str] = None,
        board: Optional[str] = None,
    ) -> Optional[ActiveCardSlot]:
        """Release the card's three semaphores and optionally release its kanban lease."""
        slot = self.semaphores.release(task_id)
        active_keeper = keeper if keeper is not None else self._keeper
        if active_keeper is not None:
            try:
                active_keeper.release(task_id)
            except Exception:
                pass
        if mark_done_in_kanban:
            kpath = (
                Path(db_path)
                if db_path is not None
                else (self._kanban_db_path or (core_adapter.get_hermes_home() / "kanban.db"))
            )
            if kpath.is_file():
                with core_adapter.kanban.connect_closing(
                    db_path=kpath,
                    board=board if board is not None else self._board,
                ) as kconn:
                    kconn.execute(
                        "UPDATE tasks SET status = 'done', claim_lock = NULL, claim_expires = NULL WHERE id = ?",
                        (str(task_id),),
                    )
                    kconn.commit()
        return slot

    def check_deadlines(
        self,
        conn=None,
        *,
        now: Optional[float] = None,
        keeper: Optional[lease.LeaseKeeper] = None,
        default_stop_dir: Optional[Path | str] = None,
        terminate_processes: bool = True,
    ) -> list[dict[str, Any]]:
        """Check active cards against their deadlines and write ``STOP`` markers on overdue cards."""
        return self.semaphores.check_deadlines(
            now=now,
            conn=conn,
            keeper=keeper if keeper is not None else self._keeper,
            default_stop_dir=default_stop_dir,
            terminate_processes=terminate_processes,
        )

    def reconcile_on_startup(
        self,
        conn,
        *,
        kconn=None,
        db_path: Optional[Path | str] = None,
        board: Optional[str] = None,
        keeper: Optional[lease.LeaseKeeper] = None,
        process_probe: Optional[Callable[[int, Optional[float]], tuple[bool, bool]]] = None,
        tolerance_s: float = 2.0,
        swarm_id: Optional[str] = None,
    ) -> reconcile.ReconcileSummary:
        """Reconcile running kanban claims, worker_processes, and budget reservations on startup (M-175)."""
        kpath = (
            Path(db_path)
            if db_path is not None
            else (self._kanban_db_path or (core_adapter.get_hermes_home() / "kanban.db"))
        )
        active_board = board if board is not None else self._board
        active_keeper = keeper if keeper is not None else self._keeper
        if active_keeper is None and (kconn is not None or kpath.is_file()):
            try:
                cfg_map = profile_config.load() or {}
                lease_cfg = lease.LeaseConfig.from_mapping(
                    cfg_map if isinstance(cfg_map, Mapping) else {}
                )
            except Exception:
                ttl = int(DEFAULT_CARD_DEADLINE_S)
                lease_cfg = lease.LeaseConfig(
                    ttl_seconds=ttl,
                    renew_interval_seconds=max(1.0, float(ttl) / 3.0),
                )
            active_keeper = self._ensure_keeper(lease_cfg, db_path=kpath, board=active_board)
        elif keeper is not None:
            self._keeper = keeper

        return reconcile.reconcile_on_startup(
            conn,
            kconn=kconn,
            db_path=kpath,
            board=active_board,
            keeper=active_keeper,
            semaphores=self.semaphores,
            process_probe=process_probe,
            tolerance_s=tolerance_s,
            swarm_id=swarm_id,
        )

    def review_card(self, conn, **kwargs: Any) -> review.ReviewOutcome:
        """Run two-stage acceptance review for a card using this conductor's semaphores (M-172)."""
        kwargs.setdefault("semaphores", self.semaphores)
        if self._board is not None:
            kwargs.setdefault("board", self._board)
        return review.review_card(conn, **kwargs)

    def tick(
        self,
        conn,
        *,
        claim_fn=None,
        db_path: Optional[Path | str] = None,
        board: Optional[str] = None,
        keeper: Optional[lease.LeaseKeeper] = None,
        now: Optional[float] = None,
        account_resolver: Optional[Callable[[str, str], str | Sequence[str]]] = None,
        accounts: Optional[Sequence[str]] = None,
        run_dir_resolver: Optional[Callable[[str, str, str], Path | str]] = None,
        card_deadline_s: Optional[float] = None,
    ) -> int:
        """One conductor tick.

        1. Fails closed (0 cards taken) if ``<home>/config.yaml`` is unreadable (M-159).
        2. Reads ``nomad.lease.claim_ttl_s`` via :meth:`lease.LeaseConfig.from_mapping` (M-166);
           if the key is missing or invalid, refuses to start external lanes and logs/records the
           reason in the journal.
        3. Enforces card deadlines (writes ``STOP`` marker for overdue cards) and three-level
           concurrency semaphores (swarm <= 25, lane <= lane_cap, account <= sessions_per_account
           from ``config.yaml``, M-167).
        4. Claims ready external cards in ``kanban.db`` via :class:`lease.LeaseKeeper` with claimer
           ``<host>:nomad-<lane>`` and TTL from ``nomad.lease.claim_ttl_s``.
        """
        self.ticks += 1
        from . import stop
        if stop.is_stopped():
            logger.info("nomad: conductor tick paused by emergency stop (ESTOP)")
            return 0
        try:
            cfg = profile_config.load_strict()
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

        cfg_map = cfg if isinstance(cfg, Mapping) else {}
        self.limits = SwarmLimits.from_mapping(cfg_map)
        self.semaphores.update_limits(self.limits)

        kanban_cfg = cfg_map.get("kanban") if isinstance(cfg_map.get("kanban"), Mapping) else {}
        raw_profiles = kanban_cfg.get("dispatch_profiles")
        local_profiles = (
            {str(p).strip() for p in raw_profiles if str(p).strip()}
            if isinstance(raw_profiles, list)
            else {"nomad"}
        )

        kpath = (
            Path(db_path)
            if db_path is not None
            else (self._kanban_db_path or (core_adapter.get_hermes_home() / "kanban.db"))
        )
        active_board = board if board is not None else self._board

        # Check deadlines on already-active cards before claiming new ones (M-167)
        self.check_deadlines(conn, now=now, keeper=keeper or self._keeper)

        ready_cards = _list_ready_external_cards(
            kpath,
            local_profiles=local_profiles,
            board=active_board,
        )

        try:
            lease_cfg = lease.LeaseConfig.from_mapping(cfg_map)
        except lease.LeaseConfigError as exc:
            err_msg = str(exc)
            if ready_cards:
                for task_id, lane in ready_cards:
                    db.add_event(
                        conn,
                        "lane_refused",
                        {
                            "lane_id": lane,
                            "task_id": task_id,
                            "reason": "missing_lease_ttl",
                            "key": "nomad.lease.claim_ttl_s",
                            "error": err_msg,
                        },
                    )
            else:
                db.add_event(
                    conn,
                    "lane_refused",
                    {
                        "lane_id": "*",
                        "reason": "missing_lease_ttl",
                        "key": "nomad.lease.claim_ttl_s",
                        "error": err_msg,
                    },
                )
            logger.warning(
                "nomad: lane_refused reason=missing_lease_ttl key=nomad.lease.claim_ttl_s error=%s — 0 cards taken",
                err_msg,
            )
            return 0

        if not ready_cards:
            return 0

        active_keeper = (
            keeper
            if keeper is not None
            else self._ensure_keeper(lease_cfg, db_path=kpath, board=active_board)
        )
        if keeper is not None:
            self._keeper = keeper

        tick_ts = time.time() if now is None else float(now)
        eff_deadline = (
            float(card_deadline_s)
            if card_deadline_s is not None
            else float(self.limits.card_deadline_s)
        )

        taken = 0
        for task_id, raw_assignee in ready_cards:
            lane, explicit_acct = _split_lane_and_account(raw_assignee)
            claim_lane = _claimer_lane_token(lane)

            if explicit_acct is not None:
                acct = explicit_acct
            elif account_resolver is not None:
                resolved_acct = account_resolver(task_id, lane)
                if isinstance(resolved_acct, (list, tuple)):
                    acct, _ = self.semaphores.select_available_account(lane, resolved_acct)
                else:
                    acct = str(resolved_acct).strip()
            else:
                acct, _ = self.semaphores.select_available_account(lane, accounts)

            run_dir = (
                Path(run_dir_resolver(task_id, lane, acct))
                if run_dir_resolver is not None
                else None
            )

            acquired, blocked_by = self.semaphores.try_acquire(
                task_id,
                claim_lane,
                acct,
                started_at=tick_ts,
                deadline_s=eff_deadline,
                run_dir=run_dir,
            )
            if not acquired:
                db.add_event(
                    conn,
                    EVENT_SEMAPHORE_DEFERRED,
                    {
                        "task_id": task_id,
                        "lane_id": lane,
                        "account": acct,
                        "blocked_by": blocked_by,
                        "swarm_active": self.semaphores.swarm_active,
                        "max_parallel": self.limits.max_parallel,
                        "sessions_per_account": self.limits.sessions_per_account,
                    },
                )
                continue

            started_info = start_lane(conn, lane, task_id=task_id)
            if not started_info.get("started"):
                self.semaphores.release(task_id)
                continue
            held = active_keeper.claim(task_id, claim_lane)
            if held is None:
                self.semaphores.release(task_id)
                continue
            db.add_event(
                conn,
                EVENT_LEASE_CLAIMED,
                {
                    "task_id": task_id,
                    "lane_id": lane,
                    "account": acct,
                    "claimer": held.claimer,
                    "claim_ttl_s": lease_cfg.claim_ttl_s,
                    "ttl_seconds": active_keeper.ttl_seconds,
                    "run_id": held.run_id,
                    "claim_expires": held.claim_expires,
                },
            )
            taken += 1
        return taken

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
            if self._keeper is not None:
                self._keeper.stop(timeout=2.0)
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
