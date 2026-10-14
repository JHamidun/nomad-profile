"""Chat tools of the Nomad plugin: ``swarm_start`` and ``swarm_show``.

Контракт обработчика инструмента из plugin guide: ``handler(args: dict, **kwargs) -> str``, всегда
JSON-строка, никогда не бросает. Рой — настоящая строка в базе плагина, не словарь в памяти:
после перезапуска процесса ``swarm_show`` находит его по id. При передаче декомпозитора или списка
подзадач (либо вызове ``plan_swarm``) ``swarm_start`` запускает планировщик ``planner.plan_goal``,
проводит маршрутизацию до взятия карточек (``claim_lock`` пуст) и записывает граф в ``kanban.db``.
"""

from __future__ import annotations

import json
import logging
from contextlib import closing
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional, Sequence, Union

from . import db, planner, pool_mode

logger = logging.getLogger("hermes_plugins.nomad.tools")

MAX_GOAL_CHARS = 4000

SWARM_START = {
    "name": "swarm_start",
    "description": (
        "Create a new Nomad swarm for a goal and return its id. Use when the user asks to start a "
        "swarm / hand a multi-step goal to the orchestrator. Only records the swarm (status "
        "'created'); nothing is executed yet. Returns JSON with swarm_id."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "goal": {
                "type": "string",
                "description": "What the swarm must achieve, in the user's words.",
            },
        },
        "required": ["goal"],
    },
}

SWARM_SHOW = {
    "name": "swarm_show",
    "description": (
        "Show a Nomad swarm by id: goal, status, creation time, delivery mode and its event log, "
        "as JSON. Use after swarm_start or when the user asks about a swarm."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "swarm_id": {
                "type": "string",
                "description": "Swarm id as returned by swarm_start (sw-…).",
            },
        },
        "required": ["swarm_id"],
    },
}


def _error(message: str, **extra: Any) -> str:
    return json.dumps({"error": message, **extra}, ensure_ascii=False)


def create_swarm(goal: str) -> dict:
    """Create the swarm row; the delivery mode in force right now is stamped onto it."""
    mode = pool_mode.resolve_pool_mode()
    with closing(db.connect()) as conn:
        return db.create_swarm(conn, goal, mode.mode)


def load_swarm(swarm_id: str) -> Optional[dict]:
    with closing(db.connect()) as conn:
        return db.get_swarm(conn, swarm_id)


def plan_swarm(
    goal: str,
    *,
    decomposer: Any = None,
    subtasks: Optional[Sequence[Mapping[str, Any]]] = None,
    kanban_conn: Any = None,
    db_path: Optional[Union[Path, str]] = None,
    board: Optional[str] = None,
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    allowlist: Optional[Iterable[str]] = None,
    swarm_id: Optional[str] = None,
) -> planner.PlanResult:
    """Decompose ``goal``, route subtasks via ``routing.py``, and persist cards to ``kanban.db``."""
    if swarm_id is not None:
        with closing(db.connect()) as plugin_conn:
            return planner.plan_goal(
                conn=kanban_conn,
                goal=goal,
                decomposer=decomposer,
                subtasks=subtasks,
                db_path=db_path,
                board=board,
                catalog=catalog,
                allowlist=allowlist,
                swarm_id=swarm_id,
                plugin_conn=plugin_conn,
            )
    return planner.plan_goal(
        conn=kanban_conn,
        goal=goal,
        decomposer=decomposer,
        subtasks=subtasks,
        db_path=db_path,
        board=board,
        catalog=catalog,
        allowlist=allowlist,
    )


def swarm_start(args: dict, **kwargs: Any) -> str:
    try:
        payload = args or {}
        goal = payload.get("goal")
        if not isinstance(goal, str) or not goal.strip():
            return _error("goal is required and must be a non-empty string")
        goal = goal.strip()
        if len(goal) > MAX_GOAL_CHARS:
            return _error(f"goal is too long ({len(goal)} chars, max {MAX_GOAL_CHARS})")
        swarm = create_swarm(goal)
        response: dict[str, Any] = {
            "swarm_id": swarm["id"],
            "status": swarm["status"],
            "created_at": swarm["created_at"],
            "pool_mode_at_creation": swarm["pool_mode_at_creation"],
        }

        decomposer = (
            kwargs.get("decomposer")
            or kwargs.get("decomposer_fn")
            or payload.get("decomposer")
            or payload.get("tasks")
            or payload.get("subtasks")
        )
        if decomposer is not None:
            plan = plan_swarm(
                goal,
                decomposer=decomposer,
                kanban_conn=kwargs.get("kanban_conn") or payload.get("kanban_conn"),
                db_path=kwargs.get("db_path") or payload.get("db_path"),
                board=kwargs.get("board") or payload.get("board"),
                catalog=kwargs.get("catalog") or payload.get("catalog"),
                allowlist=kwargs.get("allowlist") or payload.get("allowlist"),
                swarm_id=swarm["id"],
            )
            response["root_task_id"] = plan.root_task_id
            response["child_ids"] = plan.child_ids
            response["plan"] = plan.to_dict()

        return json.dumps(response, ensure_ascii=False)
    except Exception as exc:  # contract: a tool handler never raises
        logger.exception("nomad: swarm_start failed")
        return _error(f"swarm_start failed: {type(exc).__name__}: {exc}")


def swarm_show(args: dict, **kwargs: Any) -> str:
    try:
        swarm_id = (args or {}).get("swarm_id")
        if not isinstance(swarm_id, str) or not swarm_id.strip():
            return _error("swarm_id is required")
        swarm = load_swarm(swarm_id.strip())
        if swarm is None:
            return _error("swarm not found", swarm_id=swarm_id.strip())
        return json.dumps(swarm, ensure_ascii=False)
    except Exception as exc:  # contract: a tool handler never raises
        logger.exception("nomad: swarm_show failed")
        return _error(f"swarm_show failed: {type(exc).__name__}: {exc}")
