# nomad-workaround: PR-2 (docs/upstream-prs.md)
"""Nested swarms depth ceiling and orphan cleanup (task M-182 / N20).

Provides:
- check_and_record_depth: validates and registers nesting depth; returns
  {"allowed": False, "status": "depth_refused", "reason": "depth_refused"} when depth > max_depth
  without crashing or raising exceptions.
- prune_orphans: daily orphan cleanup of task_depth records based on active kanban.db tasks.
- Invariant: kanban.db schema (PRAGMA table_info(tasks)) remains strictly untouched.
"""

from __future__ import annotations

import logging
import sqlite3
from typing import Any, Mapping, Optional, Sequence

from . import core_adapter, db, profile_config

logger = logging.getLogger("hermes_plugins.nomad.depth")

DEFAULT_MAX_DEPTH = db.DEFAULT_MAX_DEPTH  # 2


def get_max_depth(config: Optional[Mapping[str, Any]] = None) -> int:
    """Read configured max_depth ceiling from nomad.max_depth or default to 2."""
    if config is not None:
        cfg = config
    else:
        try:
            cfg = profile_config.load()
        except Exception:
            cfg = {}

    nomad_sec = (cfg or {}).get("nomad", {}) if isinstance(cfg, Mapping) else {}
    if isinstance(nomad_sec, Mapping):
        val = nomad_sec.get("max_depth")
        if val is not None and not isinstance(val, bool):
            try:
                parsed = int(val)
                if parsed >= 0:
                    return parsed
            except (TypeError, ValueError):
                pass
    return DEFAULT_MAX_DEPTH


def resolve_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    parent_task_id: Optional[str] = None,
    board: str = "default",
) -> int:
    """Resolve effective depth for task_id without mutating task_depth table."""
    return db.resolve_task_depth(
        conn,
        task_id=task_id,
        parent_task_id=parent_task_id,
        board=board,
    )


def check_and_record_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    parent_task_id: Optional[str] = None,
    max_depth: Optional[int] = None,
    board: str = "default",
    swarm_id: Optional[str] = None,
) -> dict[str, Any]:
    """Check task depth against ceiling and record it if allowed.

    When depth > effective_max, returns depth_refused dict without raising exceptions.
    When depth <= effective_max, records depth in task_depth and returns ok dict.
    """
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        return {
            "allowed": False,
            "status": "error",
            "reason": "empty_task_id",
            "task_id": "",
            "depth": 0,
            "max_depth": DEFAULT_MAX_DEPTH,
        }

    board_slug = str(board or "default").strip() or "default"
    parent_id = str(parent_task_id).strip() if parent_task_id else None

    # Resolve parent row if given
    parent_row = db.get_task_depth(conn, parent_id, board=board_slug) if parent_id else None

    if max_depth is not None:
        effective_max = max(0, int(max_depth))
    elif parent_row is not None:
        effective_max = int(parent_row.get("max_depth", get_max_depth()))
    else:
        effective_max = get_max_depth()

    depth = resolve_depth(
        conn,
        tid,
        parent_task_id=parent_id,
        board=board_slug,
    )

    if depth > effective_max:
        logger.warning(
            "nomad depth: task %r depth %d exceeds ceiling %d (refused)",
            tid,
            depth,
            effective_max,
        )
        return {
            "allowed": False,
            "status": "depth_refused",
            "reason": "depth_refused",
            "task_id": tid,
            "depth": depth,
            "max_depth": effective_max,
            "parent_task_id": parent_id,
            "swarm_id": swarm_id,
            "board": board_slug,
        }

    # Record in data.db
    row = db.record_task_depth(
        conn,
        tid,
        parent_task_id=parent_id,
        swarm_id=swarm_id,
        depth=depth,
        max_depth=effective_max,
        board=board_slug,
    )

    return {
        "allowed": True,
        "status": "ok",
        "task_id": tid,
        "depth": depth,
        "max_depth": effective_max,
        "parent_task_id": parent_id,
        "swarm_id": swarm_id,
        "board": board_slug,
        "row": row,
    }


def prune_orphans(
    conn: sqlite3.Connection,
    kconn: Optional[sqlite3.Connection] = None,
    *,
    board: str = "default",
) -> int:
    """Daily orphan cleanup: remove task_depth records not present in active kanban tasks."""
    board_slug = str(board or "default").strip() or "default"
    active_ids: set[str] = set()
    owns_kconn = False

    active_kconn = kconn
    if active_kconn is None:
        try:
            active_kconn = core_adapter.kanban_db()
            owns_kconn = True
        except Exception as e:
            logger.warning("nomad depth: unable to open kanban_db for prune_orphans: %s", e)
            return 0

    try:
        cur = active_kconn.execute("SELECT id FROM tasks WHERE board = ?", (board_slug,))
        rows = cur.fetchall()
        for r in rows:
            if isinstance(r, sqlite3.Row):
                active_ids.add(str(r["id"]))
            elif isinstance(r, (tuple, list)) and len(r) > 0:
                active_ids.add(str(r[0]))
            elif isinstance(r, str):
                active_ids.add(r)
    except Exception as e:
        logger.warning("nomad depth: query tasks error: %s", e)
        return 0
    finally:
        if owns_kconn and active_kconn is not None:
            active_kconn.close()

    return db.prune_orphan_depths(conn, active_task_ids=active_ids, board=board_slug)


def get_task_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    board: str = "default",
) -> Optional[dict[str, Any]]:
    """Retrieve task depth row from data.db."""
    return db.get_task_depth(conn, task_id, board=board)


def list_task_depths(
    conn: sqlite3.Connection,
    *,
    swarm_id: Optional[str] = None,
    board: Optional[str] = None,
) -> list[dict[str, Any]]:
    """List task depth rows ordered by (board, depth, task_id)."""
    return db.list_task_depths(conn, swarm_id=swarm_id, board=board)
