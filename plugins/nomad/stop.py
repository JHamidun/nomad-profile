"""Three-level stop control for the Nomad swarm orchestrator (task M-176 / N13).

Levels:
1. Global pause (ESTOP sentinel in HERMES_HOME and fleet root):
   Halts new work, cron dispatches, lane starts, and turn dispatching;
   in-flight work continues or completes its current turn.
2. Swarm stop (`hermes nomad swarm stop <id>`):
   Sets stop markers on all cards/runs of the specified swarm, terminates its
   worker processes via :func:`terminate_pid` guarded by expected start time,
   releases kanban claims, and closes budget reservations, leaving any other
   concurrent swarms intact.
3. Service stop:
   Halts conductor loops and background watchers.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import subprocess
import sys
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from . import core_adapter, db, launcher, lease

logger = logging.getLogger("hermes_plugins.nomad.stop")

SENTINEL_NAME = "ESTOP"


def sentinel_path() -> Path:
    """Path of the ESTOP sentinel written by `engage` in active HERMES_HOME."""
    return core_adapter.get_hermes_home() / SENTINEL_NAME


def _fleet_root() -> Path:
    """Fleet root directory containing profiles/ or the fallback root directory."""
    home = core_adapter.get_hermes_home()
    if home.parent.name == "profiles":
        return home.parent.parent
    env_root = os.environ.get("HERMES_ROOT")
    if env_root and env_root.strip():
        return Path(env_root.strip())
    return home


def _candidate_sentinel_paths() -> list[Path]:
    """Candidate sentinel paths: profile-local first, then fleet root when distinct."""
    primary = sentinel_path()
    try:
        root_path = _fleet_root() / SENTINEL_NAME
    except Exception:
        return [primary]
    distinct = False
    try:
        distinct = root_path.resolve() != primary.resolve()
    except Exception:
        distinct = root_path != primary
    return [primary, root_path] if distinct else [primary]


def is_stopped() -> bool:
    """Return True if ANY candidate ESTOP sentinel exists or is unreadable (fail safe)."""
    saw_stat_error = False
    for path in _candidate_sentinel_paths():
        try:
            if path.exists():
                return True
        except OSError:
            saw_stat_error = True
    return saw_stat_error


def engage(reason: Optional[str] = None) -> Path:
    """Create the ESTOP sentinel. Idempotent; re-engaging updates the file."""
    path = sentinel_path()
    payload = {
        "engaged_at": datetime.now(timezone.utc).isoformat(),
        "reason": reason or None,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    except OSError:
        with suppress(OSError):
            path.touch(exist_ok=True)
    logger.info("nomad: stop engaged (reason=%s, sentinel=%s)", reason, path)
    return path


def resume() -> bool:
    """Remove every candidate ESTOP sentinel (both profile and fleet-root)."""
    lifted = False
    for path in _candidate_sentinel_paths():
        try:
            path.unlink()
            lifted = True
        except (OSError, AttributeError):
            continue
    if lifted:
        logger.info("nomad: stop resumed (sentinels cleared)")
    return lifted


def get_state() -> Optional[dict[str, Any]]:
    """Return `{"reason": ..., "engaged_at": ...}` or None when not stopped."""
    if not is_stopped():
        return None
    state: dict[str, Any] = {"reason": None, "engaged_at": None}
    found = False
    for path in _candidate_sentinel_paths():
        try:
            if not path.exists():
                continue
        except OSError:
            return state
        found = True
        try:
            raw = json.loads(path.read_text(encoding="utf-8-sig"))
            if isinstance(raw, dict):
                state = {
                    "reason": raw.get("reason") or None,
                    "engaged_at": raw.get("engaged_at") or None,
                }
                break
        except Exception:
            pass
    return state if found else state


def terminate_pid(
    pid: int,
    *,
    force: bool = True,
    expected_start_time: Optional[float] = None,
) -> None:
    """Terminate PID with start-time identity verification.

    Refuses with OSError if expected_start_time is mismatched or unavailable when required.
    """
    if isinstance(pid, bool) or int(pid) <= 0:
        raise OSError(f"invalid pid: {pid}")
    target_pid = int(pid)

    if force or expected_start_time is not None:
        current_start = launcher.get_process_start_time(target_pid)
        if expected_start_time is not None:
            if current_start is None:
                raise OSError(f"refusing to force-kill PID {target_pid}; process start time is unavailable")
            if abs(current_start - float(expected_start_time)) > 2.0:
                raise OSError(f"refusing to force-kill PID {target_pid}; process identity changed")

    if sys.platform == "win32":
        try:
            res = subprocess.run(
                ["taskkill", "/PID", str(target_pid), "/T", "/F"],
                capture_output=True,
                text=True,
                timeout=10,
                check=False,
            )
            if res.returncode != 0:
                if not launcher.is_process_alive(target_pid):
                    return
                if not launcher.terminate_process(target_pid, expected_start_time=expected_start_time):
                    details = (res.stderr or res.stdout or "").strip()
                    raise OSError(details or f"taskkill failed for PID {target_pid}")
        except FileNotFoundError:
            if not launcher.terminate_process(target_pid, expected_start_time=expected_start_time):
                raise OSError(f"failed to terminate PID {target_pid}")
    else:
        try:
            os.kill(target_pid, 9 if force else 15)
        except OSError as exc:
            if launcher.is_process_alive(target_pid):
                raise OSError(f"failed to terminate PID {target_pid}: {exc}") from exc


def stop_swarm(
    conn: sqlite3.Connection,
    swarm_id: str,
    *,
    timeout: float = 10.0,
    kconn: Optional[sqlite3.Connection] = None,
    board: Optional[str] = "default",
    keeper: Optional[lease.LeaseKeeper] = None,
) -> dict[str, Any]:
    """Stop an individual swarm by ID.

    Sets stop markers for its cards/runs, calls terminate_pid on its processes,
    releases its kanban cards and budget reservations, while other swarms remain intact.
    """
    target_id = str(swarm_id or "").strip()
    if not target_id:
        return {"ok": False, "error": "empty_swarm_id"}

    swarm = db.get_swarm(conn, target_id)
    if swarm is None:
        return {"ok": False, "error": f"swarm {target_id} not found", "swarm_id": target_id}

    # 1. Active worker processes for this swarm
    active_procs = db.list_worker_processes(conn, status="running")
    swarm_task_ids: set[str] = set()
    try:
        rows = conn.execute("SELECT task_id FROM task_depth WHERE swarm_id = ?", (target_id,)).fetchall()
        swarm_task_ids.update(r[0] for r in rows if r and r[0])
    except Exception:
        pass
    try:
        evs = db.list_events(conn, swarm_id=target_id)
        for ev in evs:
            if ev.get("kind") == "worker_launched":
                d = ev.get("detail")
                if isinstance(d, dict) and d.get("task_id"):
                    swarm_task_ids.add(str(d["task_id"]).strip())
    except Exception:
        pass

    swarm_procs = [
        p for p in active_procs
        if p.get("swarm_id") == target_id
        or (p.get("task_id") and str(p["task_id"]).strip() in swarm_task_ids)
    ]

    # 2. Write stop markers and terminate each process
    for p in swarm_procs:
        pid = p.get("pid")
        start_time = p.get("start_time")
        slot_dir = p.get("slot_dir")
        if slot_dir:
            launcher.write_stop_marker(
                slot_dir=slot_dir,
                task_id=p.get("task_id", ""),
                run_id=p.get("run_id", ""),
                reason="swarm_stopped",
                pid=pid,
                expected_start_time=start_time,
                terminate=False,
            )
        if pid:
            try:
                terminate_pid(pid, force=True, expected_start_time=start_time)
            except OSError as err:
                logger.warning("nomad: terminate_pid(%s) failed: %s", pid, err)
            try:
                db.update_worker_process_status(conn, pid=pid, start_time=start_time, status="stopped")
            except Exception:
                pass

    # 3. Release claimed cards in Kanban
    released_tasks: list[str] = []
    if keeper is not None:
        for tid in list(keeper.claimed_tasks()):
            try:
                keeper.release(tid, reason="swarm_stopped")
                released_tasks.append(tid)
            except Exception:
                pass

    kpath = core_adapter.get_hermes_home() / "kanban.db"
    if kconn is not None:
        rows = kconn.execute(
            "SELECT id FROM tasks WHERE claim_lock LIKE ?",
            (f"%nomad%{target_id}%",),
        ).fetchall()
        for r in rows:
            tid = str(r[0] if isinstance(r, (tuple, list)) else r["id"])
            kconn.execute(
                "UPDATE tasks SET claim_lock = NULL, claim_expires = NULL WHERE id = ?",
                (tid,),
            )
            released_tasks.append(tid)
        kconn.commit()
    elif kpath.is_file():
        try:
            with core_adapter.kanban.connect_closing(db_path=kpath, board=board) as kc:
                rows = kc.execute(
                    "SELECT id FROM tasks WHERE claim_lock LIKE ?",
                    (f"%nomad%{target_id}%",),
                ).fetchall()
                for r in rows:
                    tid = str(r[0] if isinstance(r, (tuple, list)) else r["id"])
                    kc.execute(
                        "UPDATE tasks SET claim_lock = NULL, claim_expires = NULL WHERE id = ?",
                        (tid,),
                    )
                    released_tasks.append(tid)
                kc.commit()
        except Exception:
            pass

    # 4. Release budget reservations & record stop event
    db.add_event(conn, "budget_released", {"swarm_id": target_id, "reason": "swarm_stopped"})
    db.set_swarm_status(conn, target_id, "stopped")
    db.add_event(
        conn,
        "swarm_stopped",
        {
            "swarm_id": target_id,
            "terminated_processes": len(swarm_procs),
            "released_tasks": released_tasks,
        },
    )

    return {
        "ok": True,
        "swarm_id": target_id,
        "status": "stopped",
        "terminated_processes": len(swarm_procs),
        "released_tasks": released_tasks,
    }
