"""N4 (M-161): planner on top of the upstream decomposer + pre-claim routing pass.

Планировщик принимает цель роя (``goal``) или существующую карточку в ``triage`` (``root_task_id``),
подаёт декомпозитору каталог ТОЛЬКО живых и разрешённых дорожек (спека §5.8), валидирует граф
подзадач (индексы родителей, отсутствие самоссылок и циклов по алгоритму Кана), прогоняет каждую
подзадачу через ``routing.route_subtasks`` ДО взятия карточки в работу (``claim_lock`` остаётся
``NULL``) и атомарно записывает корневую карточку, дочерние карточки, связи ``task_links`` и
события ``task_events`` в ``kanban.db`` (через ``core_adapter.kanban``).

Ключевые инварианты (M-161):

* **Модель предлагает смысл, код решает факты**: если декомпозитор (или тестовый стаб) просит
  ``model="opus"`` / ``provider="anthropic"`` (либо ``model_override`` / ``provider_override``),
  в SQL-колонки ``tasks.model_override`` и ``tasks.provider_override`` попадают ТОЛЬКО значения,
  назначенные ``routing.py`` по классу работы и живому каталогу возможностей.
* **Маршрутизация строго до claim**: все созданные карточки имеют ``claim_lock IS NULL``,
  ``claim_expires IS NULL``, ``worker_pid IS NULL``, ``current_run_id IS NULL``.
* **Целостность графа**: дочерние карточки без незавершённых зависимостей переводятся в ``ready``
  (при ``auto_promote=True``), зависимые остаются в ``todo``, а корневая карточка ждёт завершения
  всех дочерних через ``task_links``.
"""

from __future__ import annotations

import inspect
import json
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Mapping, Optional, Sequence, Union

from . import core_adapter, db, ru_only, routing

_FENCE_RE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL | re.IGNORECASE)

EVENT_SWARM_PLANNED = "swarm_planned"
EVENT_MODEL_WISH_OVERRIDDEN = "model_wish_overridden"

DECOMPOSER_SYSTEM_PROMPT = (
    "Ты — декомпозитор задач роя Nomad. Разбей цель пользователя на направленный ациклический "
    "граф (DAG) конкретных подзадач. Предлагай ТОЛЬКО смысловую разбивку (title, body, parents, "
    "work_class). Не назначай платные или недоступные модели: фактические model_override и "
    "provider_override выставит детерминированный роутер Nomad.\n"
    "Ответ верни строго в JSON:\n"
    '{"fanout": true, "tasks": [{"title": "...", "body": "...", "work_class": "repo_work", '
    '"parents": []}]}'
)


class PlannerError(ValueError):
    """Raised when the decomposer output or subtask dependency graph is invalid."""


class CyclicDependencyError(PlannerError):
    """Raised when the decomposed subtasks contain a dependency cycle."""


@dataclass(frozen=True)
class PlannedTask:
    """One persisted child card produced by the planner and routed before claim."""

    task_id: str
    index: int
    title: str
    body: str
    parents: tuple[int, ...]
    parent_task_ids: tuple[str, ...]
    status: str
    assignee: str
    lane: str
    work_class: str
    provider_override: Optional[str]
    model_override: Optional[str]
    billing: str
    window_state: str
    requested_model: Optional[str] = None
    requested_provider: Optional[str] = None
    overridden_model_wish: bool = False
    blocked_reason: Optional[str] = None
    claim_lock: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class PlanResult:
    """Full result of decomposing a goal, routing all subtasks, and writing to ``kanban.db``."""

    root_task_id: str
    goal: str
    child_ids: list[str]
    children: list[PlannedTask]
    links: list[tuple[str, str]]
    sibling_links: list[tuple[str, str]]
    catalog_prompt: str
    fanout: bool = True

    def to_dict(self) -> dict[str, Any]:
        return {
            "root_task_id": self.root_task_id,
            "goal": self.goal,
            "child_ids": list(self.child_ids),
            "children": [c.to_dict() for c in self.children],
            "links": [list(edge) for edge in self.links],
            "sibling_links": [list(edge) for edge in self.sibling_links],
            "catalog_prompt": self.catalog_prompt,
            "fanout": self.fanout,
        }


def _new_task_id() -> str:
    return "t_" + secrets.token_hex(4)


@contextmanager
def _write_txn(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """Atomic write transaction compatible with both autocommit and standard sqlite3 connections."""
    if conn.in_transaction:
        sp_name = f"sp_nomad_{secrets.token_hex(4)}"
        conn.execute(f"SAVEPOINT {sp_name}")
        try:
            yield conn
        except BaseException:
            conn.execute(f"ROLLBACK TO SAVEPOINT {sp_name}")
            conn.execute(f"RELEASE SAVEPOINT {sp_name}")
            raise
        conn.execute(f"RELEASE SAVEPOINT {sp_name}")
    else:
        conn.execute("BEGIN IMMEDIATE")
        try:
            yield conn
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")


def build_decomposer_prompt(
    goal: str,
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
) -> str:
    """Build the user prompt for the decomposer with ONLY alive & allowed lanes (spec §5.8)."""
    rows = list(catalog) if catalog is not None else routing.default_catalog(allowlist=allowlist)
    lanes_block = routing.format_catalog_for_prompt(rows, ru_mode=ru_mode, allowlist=allowlist)
    return (
        f"Цель роя:\n{goal.strip()}\n\n"
        f"Доступные живые дорожки (каталог возможностей ДО планирования):\n{lanes_block}\n\n"
        f"Допустимые классы работы (work_class): {', '.join(routing.WORK_CLASSES)}.\n"
        f"Верни JSON со списком подзадач `tasks` и индексами зависимостей `parents`."
    )


def extract_json_blob(raw: str) -> Optional[Any]:
    """Extract a JSON object or array from raw LLM text or markdown code fence."""
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if not text:
        return None
    fence_match = _FENCE_RE.search(text)
    if fence_match:
        text = fence_match.group(1).strip()
    try:
        return json.loads(text)
    except ValueError:
        pass
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        start = text.find(open_ch)
        end = text.rfind(close_ch)
        if start != -1 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except ValueError:
                continue
    return None


def _invoke_decomposer(
    decomposer: Callable[..., Any],
    goal: str,
    prompt: str,
    catalog: Sequence[Mapping[str, Any]],
) -> Any:
    """Invoke a decomposer callable/stub regardless of whether it takes 0, 1, 2, or keyword args."""
    try:
        sig = inspect.signature(decomposer)
        params = list(sig.parameters.values())
    except (TypeError, ValueError):
        return decomposer(goal)

    positional = [
        p for p in params
        if p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
    ]
    has_varargs = any(p.kind == inspect.Parameter.VAR_POSITIONAL for p in params)
    has_varkw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in params)
    param_names = {p.name for p in params}

    kwargs: dict[str, Any] = {}
    if "prompt" in param_names:
        kwargs["prompt"] = prompt
    if "catalog" in param_names:
        kwargs["catalog"] = list(catalog)

    if len(positional) == 0 and not has_varargs:
        return decomposer(**kwargs) if (kwargs or has_varkw) else decomposer()
    if len(positional) == 1 or (has_varargs and len(positional) <= 1):
        first_name = positional[0].name if positional else "goal"
        kwargs.pop(first_name, None)
        return decomposer(goal, **kwargs)
    if len(positional) == 2:
        second_name = positional[1].name
        kwargs.pop(positional[0].name, None)
        kwargs.pop(second_name, None)
        second_arg = catalog if second_name in ("catalog", "lanes", "capabilities") else prompt
        return decomposer(goal, second_arg, **kwargs)
    return decomposer(goal, prompt, list(catalog))


def parse_decomposer_output(
    raw_output: Any,
    *,
    goal: str = "",
) -> tuple[bool, list[dict[str, Any]]]:
    """Normalize raw decomposer output (JSON str, dict, or list) into ``(fanout, tasks_list)``."""
    parsed = extract_json_blob(raw_output) if isinstance(raw_output, str) else raw_output
    if parsed is None:
        raise PlannerError("decomposer returned empty or malformed JSON output")

    if isinstance(parsed, Mapping):
        if parsed.get("fanout") is False and not (
            parsed.get("tasks") or parsed.get("children") or parsed.get("subtasks")
        ):
            title = str(parsed.get("title") or goal or "").strip()
            if not title:
                raise PlannerError("decomposer returned fanout=false without a title")
            single = dict(parsed)
            single["title"] = title
            single["body"] = str(parsed.get("body") or "").strip()
            single["parents"] = []
            return False, [single]

        raw_tasks = (
            parsed.get("tasks")
            if "tasks" in parsed
            else parsed.get("children")
            if "children" in parsed
            else parsed.get("subtasks")
        )
        if not isinstance(raw_tasks, Sequence) or isinstance(raw_tasks, (str, bytes)):
            raise PlannerError("decomposer object must contain a 'tasks' list")
        tasks_list = [dict(item) if isinstance(item, Mapping) else item for item in raw_tasks]
        return bool(parsed.get("fanout", True)), tasks_list

    if isinstance(parsed, Sequence) and not isinstance(parsed, (str, bytes)):
        tasks_list = [dict(item) if isinstance(item, Mapping) else item for item in parsed]
        return True, tasks_list

    raise PlannerError(f"unsupported decomposer output type: {type(parsed).__name__}")


def validate_subtasks_graph(
    subtasks: Sequence[Any],
    *,
    strict_parents: bool = True,
) -> list[dict[str, Any]]:
    """Validate subtask titles, parent indices and acyclicity (Kahn's topological sort).

    Raises ``PlannerError`` on missing titles or invalid parent indices, and
    ``CyclicDependencyError`` when a cycle is present in ``parents``.
    """
    if not isinstance(subtasks, Sequence) or isinstance(subtasks, (str, bytes)) or not subtasks:
        raise PlannerError("subtasks list must be a non-empty sequence")

    total = len(subtasks)
    cleaned: list[dict[str, Any]] = []

    for idx, raw_item in enumerate(subtasks):
        if not isinstance(raw_item, Mapping):
            raise PlannerError(f"subtask[{idx}] must be a mapping, got {type(raw_item).__name__}")
        title = raw_item.get("title")
        if not isinstance(title, str) or not title.strip():
            raise PlannerError(f"subtask[{idx}].title is required and must be a non-empty string")

        raw_parents = (
            raw_item.get("parents")
            if "parents" in raw_item
            else raw_item.get("depends_on")
        )
        if raw_parents is None:
            raw_parents = []
        if not isinstance(raw_parents, (list, tuple)):
            raise PlannerError(f"subtask[{idx}].parents must be a list of integer indices")

        normalized_parents: list[int] = []
        for p in raw_parents:
            is_int = isinstance(p, int) and not isinstance(p, bool)
            if not is_int or p < 0 or p >= total:
                if strict_parents:
                    raise PlannerError(
                        f"subtask[{idx}].parents contains invalid index {p!r} (total={total})"
                    )
                continue
            if p == idx:
                if strict_parents:
                    raise PlannerError(f"subtask[{idx}] cannot list itself as a parent")
                continue
            if p not in normalized_parents:
                normalized_parents.append(p)

        entry = dict(raw_item)
        entry["title"] = title.strip()[:200]
        body = raw_item.get("body")
        entry["body"] = body.strip() if isinstance(body, str) else ""
        entry["parents"] = normalized_parents
        cleaned.append(entry)

    # Топологическая сортировка Кана (как в kanban_db_graph._validate_children_graph).
    in_deg = [0] * total
    adj: list[list[int]] = [[] for _ in range(total)]
    for i, item in enumerate(cleaned):
        for p in item["parents"]:
            adj[p].append(i)
            in_deg[i] += 1

    queue = [i for i in range(total) if in_deg[i] == 0]
    seen = 0
    while queue:
        node = queue.pop(0)
        seen += 1
        for nb in adj[node]:
            in_deg[nb] -= 1
            if in_deg[nb] == 0:
                queue.append(nb)

    if seen != total:
        raise CyclicDependencyError("cyclic dependency detected in decomposed subtasks")

    return cleaned


def _append_kanban_event(
    conn: sqlite3.Connection,
    task_id: str,
    kind: str,
    payload: Mapping[str, Any],
    now: int,
) -> None:
    conn.execute(
        "INSERT INTO task_events (task_id, run_id, kind, payload, created_at) "
        "VALUES (?, NULL, ?, ?, ?)",
        (task_id, kind, json.dumps(dict(payload), ensure_ascii=False, sort_keys=True), now),
    )


def _link_tasks(conn: sqlite3.Connection, parent_id: str, child_id: str) -> None:
    conn.execute(
        "INSERT OR IGNORE INTO task_links (parent_id, child_id) VALUES (?, ?)",
        (parent_id, child_id),
    )


def _ensure_root_task(
    conn: sqlite3.Connection,
    *,
    root_task_id: Optional[str],
    goal: str,
    root_assignee: str,
    root_decision: routing.RouteDecision,
    author: str,
    now: int,
) -> tuple[str, sqlite3.Row]:
    """Load an existing triage/root card or create a new root card for ``goal`` (unclaimed)."""
    assignee = routing.canonical_assignee(root_assignee or root_decision.assignee)
    model_override, provider_override = routing.validate_model_override(
        root_decision.model_override, root_decision.provider_override,
    )

    if root_task_id is not None:
        existing = conn.execute(
            "SELECT id, title, status, tenant, workspace_kind, workspace_path "
            "FROM tasks WHERE id = ?",
            (root_task_id,),
        ).fetchone()
        if existing is None:
            raise PlannerError(f"root_task_id {root_task_id!r} not found in tasks")
        already = conn.execute(
            "SELECT 1 FROM task_events WHERE task_id = ? AND kind = 'decomposed' LIMIT 1",
            (root_task_id,),
        ).fetchone()
        if already is not None:
            raise PlannerError(f"task {root_task_id!r} has already been decomposed")
        conn.execute(
            "UPDATE tasks SET status = 'todo', assignee = ?, "
            "model_override = ?, provider_override = ?, "
            "claim_lock = NULL, claim_expires = NULL "
            "WHERE id = ?",
            (assignee, model_override, provider_override, root_task_id),
        )
        updated = conn.execute(
            "SELECT id, title, status, tenant, workspace_kind, workspace_path "
            "FROM tasks WHERE id = ?",
            (root_task_id,),
        ).fetchone()
        assert updated is not None
        return root_task_id, updated

    new_root_id = _new_task_id()
    conn.execute(
        "INSERT INTO tasks ("
        "id, title, body, assignee, status, priority, created_by, created_at, "
        "workspace_kind, workspace_path, tenant, model_override, provider_override, "
        "claim_lock, claim_expires"
        ") VALUES (?, ?, ?, ?, 'todo', 0, ?, ?, 'scratch', NULL, NULL, ?, ?, NULL, NULL)",
        (
            new_root_id,
            goal.strip()[:200],
            goal.strip(),
            assignee,
            author,
            now,
            model_override,
            provider_override,
        ),
    )
    _append_kanban_event(
        conn,
        new_root_id,
        "created",
        {
            "by": author,
            "role": "swarm_root",
            "assignee": assignee,
            "status": "todo",
            "model_override": model_override,
            "provider_override": provider_override,
        },
        now,
    )
    row = conn.execute(
        "SELECT id, title, status, tenant, workspace_kind, workspace_path "
        "FROM tasks WHERE id = ?",
        (new_root_id,),
    ).fetchone()
    assert row is not None
    return new_root_id, row


def _insert_routed_child(
    conn: sqlite3.Connection,
    *,
    root_id: str,
    root_row: sqlite3.Row,
    index: int,
    subtask: Mapping[str, Any],
    decision: routing.RouteDecision,
    author: str,
    auto_promote: bool,
    now: int,
) -> tuple[str, str]:
    """Insert one child card into ``tasks`` with routed overrides and ``claim_lock = NULL``."""
    child_id = _new_task_id()
    root_ws_kind = root_row["workspace_kind"] or "scratch"
    child_ws_kind = str(subtask.get("workspace_kind") or root_ws_kind)
    if subtask.get("workspace_path"):
        child_ws_path = str(subtask["workspace_path"])
    elif child_ws_kind == "worktree":
        child_ws_path = None
    elif child_ws_kind == root_ws_kind:
        child_ws_path = root_row["workspace_path"]
    else:
        child_ws_path = None

    parents_idx = list(subtask.get("parents") or [])
    if decision.blocked_reason:
        initial_status = "blocked"
        block_kind: Optional[str] = "capability"
    elif auto_promote and not parents_idx:
        initial_status = "ready"
        block_kind = None
    else:
        initial_status = "todo"
        block_kind = None

    model_override, provider_override = routing.validate_model_override(
        decision.model_override, decision.provider_override,
    )
    priority = int(subtask.get("priority") or 0)
    skills = subtask.get("skills")
    skills_json = (
        json.dumps([str(s) for s in skills], ensure_ascii=False)
        if isinstance(skills, (list, tuple)) and skills
        else None
    )

    conn.execute(
        "INSERT INTO tasks ("
        "id, title, body, assignee, status, priority, created_by, created_at, "
        "workspace_kind, workspace_path, tenant, skills, "
        "model_override, provider_override, block_kind, "
        "claim_lock, claim_expires, worker_pid, current_run_id"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)",
        (
            child_id,
            str(subtask["title"]).strip()[:200],
            str(subtask.get("body") or ""),
            decision.assignee,
            initial_status,
            priority,
            author,
            now,
            child_ws_kind,
            child_ws_path,
            root_row["tenant"],
            skills_json,
            model_override,
            provider_override,
            block_kind,
        ),
    )
    _append_kanban_event(
        conn,
        child_id,
        "created",
        {
            "by": author,
            "from_decompose_of": root_id,
            "index": index,
            "lane": decision.lane,
            "assignee": decision.assignee,
            "work_class": decision.work_class,
            "status": initial_status,
            "model_override": model_override,
            "provider_override": provider_override,
            "requested_model": decision.requested_model,
            "requested_provider": decision.requested_provider,
            "overridden_model_wish": decision.overridden_model_wish,
        },
        now,
    )
    _append_kanban_event(
        conn,
        child_id,
        "routed",
        decision.to_dict(),
        now,
    )
    return child_id, initial_status


def plan_goal(
    first: Union[sqlite3.Connection, str, None] = None,
    second: Union[sqlite3.Connection, str, None] = None,
    *,
    conn: Optional[sqlite3.Connection] = None,
    goal: Optional[str] = None,
    decomposer: Any = None,
    decomposer_fn: Any = None,
    subtasks: Optional[Sequence[Mapping[str, Any]]] = None,
    root_task_id: Optional[str] = None,
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    db_path: Optional[Union[Path, str]] = None,
    board: Optional[str] = None,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
    root_assignee: str = "nomad",
    author: str = "nomad-planner",
    auto_promote: bool = True,
    strict_parents: bool = True,
    swarm_id: Optional[str] = None,
    plugin_conn: Optional[sqlite3.Connection] = None,
) -> PlanResult:
    """Decompose ``goal``, run the pre-claim routing pass, and write the graph to ``kanban.db``.

    Поддерживает позиционный вызов как ``plan_goal(conn, goal, decomposer=...)``, так и
    ``plan_goal(goal, conn=..., decomposer=...)``, а также открытие ``kanban.db`` по ``db_path``
    через ``core_adapter.kanban.connect_closing``.
    """
    for arg in (first, second):
        if isinstance(arg, sqlite3.Connection) and conn is None:
            conn = arg
        elif isinstance(arg, str) and goal is None:
            goal = arg

    if conn is None:
        with core_adapter.kanban.connect_closing(db_path, board=board) as opened_conn:
            return plan_goal(
                conn=opened_conn,
                goal=goal,
                decomposer=decomposer,
                decomposer_fn=decomposer_fn,
                subtasks=subtasks,
                root_task_id=root_task_id,
                catalog=catalog,
                ru_mode=ru_mode,
                allowlist=allowlist,
                root_assignee=root_assignee,
                author=author,
                auto_promote=auto_promote,
                strict_parents=strict_parents,
                swarm_id=swarm_id,
                plugin_conn=plugin_conn,
            )

    if (goal is None or not str(goal).strip()) and root_task_id is not None:
        row = conn.execute("SELECT title, body FROM tasks WHERE id = ?", (root_task_id,)).fetchone()
        if row is not None:
            goal = str(row["title"] or row["body"] or "").strip()

    if not isinstance(goal, str) or not goal.strip():
        raise PlannerError("goal is required and must be a non-empty string")
    goal = goal.strip()

    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    active_catalog = (
        list(catalog) if catalog is not None else routing.default_catalog(allowlist=allowlist)
    )
    catalog_prompt = build_decomposer_prompt(
        goal, active_catalog, ru_mode=active_ru, allowlist=allowlist,
    )

    chosen_decomposer = (
        decomposer
        if decomposer is not None
        else decomposer_fn
        if decomposer_fn is not None
        else subtasks
    )
    if chosen_decomposer is None:
        raise PlannerError("a decomposer callable or subtasks sequence is required")

    if callable(chosen_decomposer):
        raw_output = _invoke_decomposer(chosen_decomposer, goal, catalog_prompt, active_catalog)
    else:
        raw_output = chosen_decomposer

    fanout, raw_subtasks = parse_decomposer_output(raw_output, goal=goal)
    validated_subtasks = validate_subtasks_graph(raw_subtasks, strict_parents=strict_parents)

    # Проход маршрутизации ДО записи и ДО взятия любой карточки (claim_lock пуст).
    decisions = routing.route_subtasks(
        validated_subtasks,
        active_catalog,
        ru_mode=active_ru,
        allowlist=allowlist,
    )
    root_decision = routing.route_subtask(
        {"title": goal, "work_class": routing.WORK_REPO},
        active_catalog,
        ru_mode=active_ru,
        allowlist=allowlist,
    )

    now = int(time.time())
    child_ids: list[str] = []
    child_statuses: list[str] = []
    sibling_links: list[tuple[str, str]] = []
    all_links: list[tuple[str, str]] = []

    with _write_txn(conn):
        actual_root_id, root_row = _ensure_root_task(
            conn,
            root_task_id=root_task_id,
            goal=goal,
            root_assignee=root_assignee,
            root_decision=root_decision,
            author=author,
            now=now,
        )

        for idx, (subtask, decision) in enumerate(zip(validated_subtasks, decisions)):
            cid, status = _insert_routed_child(
                conn,
                root_id=actual_root_id,
                root_row=root_row,
                index=idx,
                subtask=subtask,
                decision=decision,
                author=author,
                auto_promote=auto_promote,
                now=now,
            )
            child_ids.append(cid)
            child_statuses.append(status)

        # Связи зависимостей между дочерними карточками (parents -> child).
        for idx, subtask in enumerate(validated_subtasks):
            child_id = child_ids[idx]
            for p_idx in subtask["parents"]:
                parent_id = child_ids[p_idx]
                _link_tasks(conn, parent_id, child_id)
                edge = (parent_id, child_id)
                sibling_links.append(edge)
                all_links.append(edge)
                _append_kanban_event(
                    conn,
                    child_id,
                    "linked",
                    {"parent": parent_id, "child": child_id},
                    now,
                )

        # Корневая карточка ждёт завершения всех дочерних (как в decompose_triage_task).
        for cid in child_ids:
            _link_tasks(conn, cid, actual_root_id)
            all_links.append((cid, actual_root_id))

        _append_kanban_event(
            conn,
            actual_root_id,
            "decomposed",
            {
                "child_ids": child_ids,
                "root_assignee": routing.canonical_assignee(root_assignee),
                "fanout": fanout,
            },
            now,
        )

    planned_children: list[PlannedTask] = []
    for idx, (cid, subtask, decision, status) in enumerate(
        zip(child_ids, validated_subtasks, decisions, child_statuses)
    ):
        parents_tuple = tuple(int(p) for p in subtask["parents"])
        parent_ids_tuple = tuple(child_ids[p] for p in parents_tuple)
        planned_children.append(
            PlannedTask(
                task_id=cid,
                index=idx,
                title=subtask["title"],
                body=subtask["body"],
                parents=parents_tuple,
                parent_task_ids=parent_ids_tuple,
                status=status,
                assignee=decision.assignee,
                lane=decision.lane,
                work_class=decision.work_class,
                provider_override=decision.provider_override,
                model_override=decision.model_override,
                billing=decision.billing,
                window_state=decision.window_state,
                requested_model=decision.requested_model,
                requested_provider=decision.requested_provider,
                overridden_model_wish=decision.overridden_model_wish,
                blocked_reason=decision.blocked_reason,
                claim_lock=None,
            )
        )

    if plugin_conn is not None and swarm_id is not None:
        db.add_event(
            plugin_conn,
            EVENT_SWARM_PLANNED,
            {
                "root_task_id": actual_root_id,
                "child_ids": child_ids,
                "lanes": [c.lane for c in planned_children],
            },
            swarm_id=swarm_id,
        )

    return PlanResult(
        root_task_id=actual_root_id,
        goal=goal,
        child_ids=child_ids,
        children=planned_children,
        links=all_links,
        sibling_links=sibling_links,
        catalog_prompt=catalog_prompt,
        fanout=fanout,
    )


# Синонимы для удобства вызова из тестов и смежных модулей.
decompose_and_route = plan_goal
plan_task = plan_goal
