"""M-175 (N12): Startup reconciliation between ``kanban.db``, ``data.db``, and the OS process table.

Канон §2.4 и §13.3 спецификации:
При запуске проводника (в том числе после ``hermes gateway stop`` / ``hermes gateway start``
посреди живого роя) выполняется сверка состояния доски ``kanban.db``, журнала ``data.db``
и таблицы процессов ОС:
1. Живой ``pid`` с совпадающим ``start_time``:
   - рабочий пережил перезапуск шлюза (detached process);
   - проводник переподхватывает аренду в ``LeaseKeeper`` (``reacquire``) и слот в ``SwarmSemaphores``
     под тем же ``<host>:nomad-<lane>`` **без второго запуска** рабочего;
2. Живой ``pid`` с **другим** ``start_time`` (переиспользованный ОС PID):
   - трактуется как мёртвый рабочий (не сигналится!);
   - запись в ``worker_processes`` помечается ``dead``;
   - захват карточки в ``kanban.db`` освобождается (``status = 'ready'``, ``claim_lock = NULL``),
     чтобы карточка была перевыдана проводником;
3. Мёртвый ``pid`` (процесса нет в ОС, либо захват осиротел без процесса):
   - запись в ``worker_processes`` помечается ``dead``;
   - захват карточки в ``kanban.db`` освобождается (``status = 'ready'``, ``claim_lock = NULL``);
4. Висящие денежные брони (``budget_reservations`` со ``status = 'held'``, не привязанные
   к живым переподхваченным карточкам) освобождаются (``status = 'released'``);
5. По итогам прохода сверки в ``data.db`` пишется **ровно одно** событие ``reconcile_done``.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import sqlite3
import time
from typing import Any, Callable, Mapping, Optional

from . import core_adapter, db, launcher, lease


EVENT_RECONCILE_DONE = "reconcile_done"


@dataclass
class ReconcileSummary:
    """Итог стартовой сверки проводника (M-175)."""

    reacquired: list[str] = field(default_factory=list)
    dead_pid_released: list[str] = field(default_factory=list)
    recycled_pid_released: list[str] = field(default_factory=list)
    released_claims: list[str] = field(default_factory=list)
    released_reservations: list[str] = field(default_factory=list)
    reconciled_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "reacquired": list(self.reacquired),
            "dead_pid_released": list(self.dead_pid_released),
            "recycled_pid_released": list(self.recycled_pid_released),
            "released_claims": list(self.released_claims),
            "released_reservations": list(self.released_reservations),
            "reconciled_at": self.reconciled_at,
        }


def _default_probe_process(
    pid: int,
    expected_start_time: Optional[float],
    *,
    tolerance_s: float = 2.0,
) -> tuple[bool, bool]:
    """Возвращает ``(pid_alive, start_time_matches)`` для ``pid``."""
    if not pid or int(pid) <= 0:
        return False, False
    alive = launcher.is_process_alive(int(pid), expected_start_time=None)
    if not alive:
        return False, False
    if expected_start_time is None:
        return True, True
    matches = launcher.is_process_alive(
        int(pid),
        expected_start_time=float(expected_start_time),
        tolerance_seconds=tolerance_s,
    )
    return True, matches


def _release_claim_to_ready(
    kconn: sqlite3.Connection,
    task_id: str,
    *,
    reason: str,
    pid: Optional[int] = None,
) -> bool:
    """Освобождает захват карточки с мёртвым/переиспользованным рабочим обратно в ``ready``."""
    now = int(time.time())
    row = kconn.execute(
        "SELECT status, claim_lock, current_run_id FROM tasks WHERE id = ?",
        (task_id,),
    ).fetchone()
    if row is None:
        return False
    status = row["status"] if isinstance(row, Mapping) or hasattr(row, "keys") else row[0]
    if status != "running":
        return False
    run_id = row["current_run_id"] if isinstance(row, Mapping) or hasattr(row, "keys") else row[2]

    cur = kconn.execute(
        "UPDATE tasks SET status = 'ready', claim_lock = NULL, claim_expires = NULL, "
        "worker_pid = NULL, worker_started_at = NULL, last_heartbeat_at = NULL, "
        "current_run_id = NULL "
        "WHERE id = ? AND status = 'running'",
        (task_id,),
    )
    if cur.rowcount != 1:
        return False

    if run_id is not None:
        kconn.execute(
            "UPDATE task_runs SET ended_at = COALESCE(ended_at, ?), "
            "outcome = COALESCE(outcome, ?), status = ? "
            "WHERE id = ? AND ended_at IS NULL",
            (now, reason, reason, int(run_id)),
        )
    kconn.commit()
    return True


def _latest_worker_for_task(
    dconn: sqlite3.Connection,
    task_id: str,
) -> Optional[dict[str, Any]]:
    """Находит самую свежую запись в ``worker_processes`` для ``task_id``."""
    rows = db.list_worker_processes(dconn, task_id=task_id)
    if not rows:
        return None
    # Приоритет у running-записей, затем по времени создания (последняя добавленная).
    running_rows = [r for r in rows if r.get("status") == "running"]
    if running_rows:
        return running_rows[-1]
    return rows[-1]


def _lane_from_claimer(claim_lock: str) -> str:
    """Извлекает имя дорожки из ``<host>:nomad-<lane>``."""
    prefix = f"{lease.host_prefix()}{lease.CLAIMER_TAG}"
    if claim_lock.startswith(prefix):
        return claim_lock[len(prefix) :].strip()
    marker = f":{lease.CLAIMER_TAG}"
    if marker in claim_lock:
        return claim_lock.split(marker, 1)[1].strip()
    return ""


def reconcile_on_startup(
    dconn: sqlite3.Connection,
    *,
    kconn: Optional[sqlite3.Connection] = None,
    db_path: Optional[Path | str] = None,
    board: Optional[str] = None,
    keeper: Optional[lease.LeaseKeeper] = None,
    semaphores: Any = None,
    process_probe: Optional[Callable[[int, Optional[float]], tuple[bool, bool]]] = None,
    tolerance_s: float = 2.0,
    swarm_id: Optional[str] = None,
) -> ReconcileSummary:
    """Выполняет стартовую сверку ``kanban.db`` и ``data.db`` и пишет одно событие ``reconcile_done``."""
    summary = ReconcileSummary(reconciled_at=time.time())
    probe = process_probe or (
        lambda pid, exp_st: _default_probe_process(pid, exp_st, tolerance_s=tolerance_s)
    )

    def _run_with_kconn(active_kconn: Optional[sqlite3.Connection]) -> None:
        prefix = f"{lease.host_prefix()}{lease.CLAIMER_TAG}"
        running_cards: list[dict[str, Any]] = []
        if active_kconn is not None:
            rows = active_kconn.execute(
                "SELECT id, assignee, claim_lock, claim_expires, worker_pid, "
                "worker_started_at, current_run_id "
                "FROM tasks WHERE status = 'running' AND claim_lock LIKE ?",
                (f"{prefix}%",),
            ).fetchall()
            for r in rows:
                if isinstance(r, Mapping) or hasattr(r, "keys"):
                    running_cards.append(dict(r))
                else:
                    running_cards.append(
                        {
                            "id": r[0],
                            "assignee": r[1],
                            "claim_lock": r[2],
                            "claim_expires": r[3],
                            "worker_pid": r[4],
                            "worker_started_at": r[5],
                            "current_run_id": r[6],
                        }
                    )

        to_reacquire: dict[str, str] = {}

        for card in running_cards:
            task_id = str(card["id"]).strip()
            claim_lock = str(card.get("claim_lock") or "")
            lane = _lane_from_claimer(claim_lock) or str(card.get("assignee") or "claude-code").strip()

            wp = _latest_worker_for_task(dconn, task_id)
            pid: Optional[int] = None
            expected_st: Optional[float] = None
            run_id_str = ""

            if wp is not None:
                pid = int(wp["pid"])
                expected_st = float(wp["start_time"])
                run_id_str = str(wp.get("run_id") or "")
            elif card.get("worker_pid") is not None:
                pid = int(card["worker_pid"])
                raw_st = card.get("worker_started_at")
                if raw_st is not None:
                    try:
                        expected_st = float(raw_st)
                    except (TypeError, ValueError):
                        expected_st = None

            if pid is None or pid <= 0:
                # Захват без запущенного процесса — освобождаем карточку для повторной выдачи.
                if active_kconn is not None:
                    _release_claim_to_ready(active_kconn, task_id, reason="dead_worker")
                if semaphores is not None:
                    semaphores.release(task_id)
                if keeper is not None:
                    keeper.release(task_id)
                summary.dead_pid_released.append(task_id)
                summary.released_claims.append(task_id)
                continue

            pid_alive, st_matches = probe(pid, expected_st)

            if pid_alive and st_matches:
                # Рабочий жив и его start_time совпадает: переподхватываем аренду и семафор!
                to_reacquire[task_id] = lane
                summary.reacquired.append(task_id)
                if semaphores is not None:
                    acct = f"{lane}:slot-00"
                    if hasattr(semaphores, "select_available_account"):
                        try:
                            acct, _ = semaphores.select_available_account(lane)
                        except Exception:
                            acct = f"{lane}:slot-00"
                    try:
                        semaphores.try_acquire(
                            task_id,
                            lane,
                            acct,
                            pid=pid,
                            start_time=expected_st,
                            run_id=run_id_str,
                        )
                    except TypeError:
                        semaphores.try_acquire(task_id, lane)
                continue

            # Процесс мёртв ИЛИ его PID был переиспользован ОС (start_time не совпал)
            reason = "pid_recycled" if (pid_alive and not st_matches) else "dead_worker"
            if wp is not None:
                db.update_worker_process_status(
                    dconn,
                    int(wp["pid"]),
                    "dead",
                    start_time=float(wp["start_time"]),
                )
            if active_kconn is not None:
                _release_claim_to_ready(active_kconn, task_id, reason=reason, pid=pid)
            if semaphores is not None:
                semaphores.release(task_id)
            if keeper is not None:
                keeper.release(task_id)

            if pid_alive and not st_matches:
                summary.recycled_pid_released.append(task_id)
            else:
                summary.dead_pid_released.append(task_id)
            summary.released_claims.append(task_id)

        # Переподхватываем живые аренды в LeaseKeeper (сразу шлёт heartbeat_claim + heartbeat_worker).
        if to_reacquire and keeper is not None:
            keeper.reacquire(to_reacquire)

        # Помечаем оставшиеся осиротевшие записи в worker_processes со статусом 'running'.
        reacquired_set = set(summary.reacquired)
        for wp in db.list_worker_processes(dconn, status="running"):
            tid = str(wp.get("task_id") or "").strip()
            if tid and tid in reacquired_set:
                continue
            wp_pid = int(wp["pid"])
            wp_st = float(wp["start_time"])
            alive, matches = probe(wp_pid, wp_st)
            if not (alive and matches):
                db.update_worker_process_status(
                    dconn,
                    wp_pid,
                    "dead",
                    start_time=wp_st,
                )

    if kconn is not None:
        _run_with_kconn(kconn)
    else:
        kpath = Path(db_path) if db_path is not None else (core_adapter.get_hermes_home() / "kanban.db")
        if kpath.is_file():
            with core_adapter.kanban.connect_closing(db_path=kpath, board=board) as opened_kconn:
                _run_with_kconn(opened_kconn)
        else:
            _run_with_kconn(None)

    # Освобождаем висящие денежные брони (status='held' без активного живого рабочего).
    released_res = db.release_orphaned_budget_reservations(
        dconn,
        active_task_ids=summary.reacquired,
    )
    summary.released_reservations = [str(r["reservation_id"]) for r in released_res]

    # Записываем ровно одно событие reconcile_done на весь проход сверки.
    db.add_event(
        dconn,
        EVENT_RECONCILE_DONE,
        summary.to_dict(),
        swarm_id=swarm_id,
    )
    return summary
