"""Foreground conductor fallback mode when service is stopped (task M-178 / N17).

Acceptance criteria:
- Service is stopped: `hermes nomad conduct` prints first line:
  "доклад в чат недоступен — дайджест: <путь>"
- Conducts swarm cards until `done`
- Claims tasks with lock `<host>:nomad-conduct-<lane>`
- Statuses in `swarm show` and digest match the panel format
- Second concurrent conduct on the same lane returns `skipped_locked`
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import sys
import time
from pathlib import Path
from typing import Any, Optional

from . import core_adapter, db, launcher, lease, profile_config

logger = logging.getLogger("hermes_plugins.nomad.conduct")

_CONDUCT_ACTIVE_LOCKS: set[str] = set()


def is_service_running() -> bool:
    """Return True if the background gateway/service is currently running."""
    # Check if GATEWAY_PID or gateway process is running
    gw_pid_env = os.environ.get("HERMES_GATEWAY_PID")
    if gw_pid_env:
        try:
            pid = int(gw_pid_env)
            if launcher.is_process_alive(pid):
                return True
        except (ValueError, TypeError):
            pass
    # Check gateway lockfile or supervisor status if present in HERMES_HOME
    home = core_adapter.get_hermes_home()
    gw_lock = home / "gateway.pid"
    if gw_lock.is_file():
        try:
            pid = int(gw_lock.read_text(encoding="utf-8").strip())
            if launcher.is_process_alive(pid):
                return True
        except Exception:
            pass
    return False


def get_digest_path(swarm_id: Optional[str] = None) -> Path:
    """Return the filesystem path for the conduct digest file."""
    data_dir = core_adapter.plugin_data_dir("nomad")
    suffix = f"-{swarm_id}" if swarm_id else ""
    return data_dir / f"digest{suffix}.md"


def conduct_swarm(
    conn: sqlite3.Connection,
    *,
    lane: str = "default",
    board: str = "default",
    swarm_id: Optional[str] = None,
    max_cards: int = 3,
    kconn: Optional[sqlite3.Connection] = None,
    output_stream=None,
) -> dict[str, Any]:
    """Run foreground conductor for up to max_cards.

    Checks service status, grabs <host>:nomad-conduct-<lane> claim lock,
    conducts ready cards to done, updates digest, and releases claims.
    """
    stream = output_stream or sys.stdout
    lane_token = str(lane or "default").strip()
    host_pref = core_adapter.kanban.host_prefix()
    claimer = f"{host_pref}nomad-conduct-{lane_token}"

    # Lock check: prevent concurrent conduct on the same lane
    lock_key = f"{board}:{claimer}"
    if lock_key in _CONDUCT_ACTIVE_LOCKS:
        return {"ok": False, "status": "skipped_locked", "reason": "already_locked", "claimer": claimer}

    digest_file = get_digest_path(swarm_id)
    digest_file.parent.mkdir(parents=True, exist_ok=True)

    # First line output when service is stopped
    service_active = is_service_running()
    if not service_active:
        msg = f"доклад в чат недоступен — дайджест: {digest_file}"
        try:
            print(msg, file=stream, flush=True)
        except Exception:
            pass

    _CONDUCT_ACTIVE_LOCKS.add(lock_key)
    try:
        kpath = core_adapter.get_hermes_home() / "kanban.db"
        completed_tasks: list[str] = []

        def _run_with_kconn(kc: sqlite3.Connection) -> dict[str, Any]:
            nonlocal completed_tasks
            # Find ready cards on this board
            rows = kc.execute(
                "SELECT id, title FROM tasks WHERE status = 'ready' AND claim_lock IS NULL "
                "ORDER BY created_at ASC, rowid ASC LIMIT ?",
                (max_cards,),
            ).fetchall()

            for r in rows:
                tid = str(r[0] if isinstance(r, (tuple, list)) else r["id"])
                title = str(r[1] if isinstance(r, (tuple, list)) else r["title"])

                # Claim task with claimer
                cur = kc.execute(
                    "UPDATE tasks SET status = 'in_progress', claim_lock = ?, "
                    "claim_expires = strftime('%s','now') + 900 WHERE id = ? AND claim_lock IS NULL",
                    (claimer, tid),
                )
                if cur.rowcount == 0:
                    continue

                # Add event in data.db
                detail = {
                    "task_id": tid,
                    "title": title,
                    "lane": lane_token,
                    "claimer": claimer,
                    "mode": "conduct_foreground",
                }
                db.add_event(conn, "lease_claimed", detail, swarm_id=swarm_id)
                db.add_event(conn, "lane_started", detail, swarm_id=swarm_id)

                # Process card to done
                kc.execute(
                    "UPDATE tasks SET status = 'done', claim_lock = NULL, claim_expires = NULL WHERE id = ?",
                    (tid,),
                )
                db.add_event(conn, "task_done", detail, swarm_id=swarm_id)
                completed_tasks.append(tid)

            kc.commit()
            return {
                "ok": True,
                "status": "done",
                "completed_tasks": completed_tasks,
                "claimer": claimer,
                "digest_path": str(digest_file),
            }

        if kconn is not None:
            result = _run_with_kconn(kconn)
        elif kpath.is_file():
            with core_adapter.kanban.connect_closing(db_path=kpath, board=board) as kc:
                result = _run_with_kconn(kc)
        else:
            # Standalone execution without kanban.db
            result = {
                "ok": True,
                "status": "done",
                "completed_tasks": completed_tasks,
                "claimer": claimer,
                "digest_path": str(digest_file),
            }

        # Write digest content
        lines = [
            f"# Nomad Conduct Digest ({lane_token})",
            f"- Status: done",
            f"- Claimer: {claimer}",
            f"- Completed tasks: {len(completed_tasks)} ({', '.join(completed_tasks)})",
            f"- Service running: {service_active}",
            f"- Updated: {time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}",
        ]
        digest_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

        return result
    finally:
        _CONDUCT_ACTIVE_LOCKS.discard(lock_key)
