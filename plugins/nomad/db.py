"""Own SQLite database of the Nomad plugin: ``<hermes home>/plugin-data/nomad/data.db``.

Путь даёт документированный ``plugins.plugin_storage.plugin_db`` (plugin guide, раздел
«Store durable state»), взятый через адаптер ядра (``core_adapter.plugin_db``, M-157): каталог
переживает ``hermes plugins update/remove`` и следует активному профилю. В каталог самого плагина
(дерево установки) не пишем ничего — его стирает обновление.

Версия схемы хранится в ``PRAGMA user_version``: это часть заголовка файла, пишется в той же
транзакции, что и DDL, поэтому оборванная миграция откатывается целиком, а не оставляет таблицы
без отметки версии (или отметку без таблиц).
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from . import core_adapter

PLUGIN_NAME = "nomad"
USAGE_TABLE = "usage_events"
DEPTH_TABLE = "task_depth"
PINS_TABLE = "task_pins"
DEFAULT_MAX_DEPTH = 2

# Список ТОЛЬКО дописывается. Уже выпущенную миграцию не править: у покупателя она уже применена,
# и правка молча разведёт схемы старых и новых установок. Изменение схемы = новая запись в конце.
MIGRATIONS: list[tuple[int, tuple[str, ...]]] = [
    (1, (
        """
        CREATE TABLE swarms (
            id                    TEXT PRIMARY KEY,
            goal                  TEXT NOT NULL,
            status                TEXT NOT NULL,
            created_at            TEXT NOT NULL,
            pool_mode_at_creation TEXT NOT NULL
                CHECK (pool_mode_at_creation IN ('owner_machine', 'shipped'))
        )
        """,
        # swarm_id допускает NULL: события дирижёра (старт цикла, отказ дорожки вне роя)
        # к конкретному рою не привязаны.
        """
        CREATE TABLE events (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            swarm_id TEXT REFERENCES swarms(id),
            ts       TEXT NOT NULL,
            kind     TEXT NOT NULL,
            detail   TEXT
        )
        """,
        "CREATE INDEX events_by_swarm ON events(swarm_id, id)",
        "CREATE INDEX events_by_kind ON events(kind, id)",
    )),
    # M-107 / M-173: единая таблица расхода токен-метра (M1) и трёх счётчиков роя (M-173).
    # Дедупликация повторных доставок post_api_request — по уникальному api_request_id.
    (2, (
        """
        CREATE TABLE usage_events (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            api_request_id     TEXT NOT NULL UNIQUE,
            account            TEXT NOT NULL DEFAULT '',
            provider           TEXT NOT NULL DEFAULT '',
            model              TEXT NOT NULL DEFAULT '',
            task_id            TEXT,
            goal_id            TEXT,
            swarm_id           TEXT,
            lane               TEXT,
            billing            TEXT,
            session_id         TEXT,
            turn_id            TEXT,
            input_tokens       INTEGER NOT NULL DEFAULT 0,
            output_tokens      INTEGER NOT NULL DEFAULT 0,
            cached_tokens      INTEGER NOT NULL DEFAULT 0,
            cache_read_tokens  INTEGER NOT NULL DEFAULT 0,
            cache_write_tokens INTEGER NOT NULL DEFAULT 0,
            reasoning_tokens   INTEGER NOT NULL DEFAULT 0,
            total_tokens       INTEGER NOT NULL DEFAULT 0,
            cost_usd           REAL NOT NULL DEFAULT 0.0,
            created_at         TEXT NOT NULL
        )
        """,
        "CREATE INDEX usage_events_by_account ON usage_events(account, id)",
        "CREATE INDEX usage_events_by_goal ON usage_events(goal_id, id)",
        "CREATE INDEX usage_events_by_task ON usage_events(task_id, id)",
    )),
    # M-163 (N6): таблица глубины вложенности задач в собственной БД плагина (data.db).
    # Карточки канбана живут в БД ядра (kanban.db), куда свои столбцы не добавляются;
    # связь по логическому ключу (task_id, board) без внешнего ключа между разными файлами SQLite.
    (3, (
        """
        CREATE TABLE task_depth (
            task_id        TEXT NOT NULL,
            board          TEXT NOT NULL DEFAULT 'default',
            parent_task_id TEXT,
            swarm_id       TEXT,
            depth          INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0),
            max_depth      INTEGER NOT NULL DEFAULT 2 CHECK (max_depth >= 0),
            created_at     TEXT NOT NULL,
            PRIMARY KEY (task_id, board)
        )
        """,
        "CREATE INDEX task_depth_by_swarm ON task_depth(swarm_id, task_id)",
        "CREATE INDEX task_depth_by_parent ON task_depth(parent_task_id, board)",
    )),
    # M-164 (N7): ручные пины карточек на дорожку (`hermes nomad swarm pin <task_id> <lane>`).
    # Хранит привязку карточки к дорожке/провайдеру/цене/семейству модели и роли (executor/judge),
    # чтобы перекрёстная проверка семьи судьи и аудит пинов работали даже когда карточка ещё не в kanban.db.
    (4, (
        """
        CREATE TABLE task_pins (
            task_id           TEXT NOT NULL,
            board             TEXT NOT NULL DEFAULT 'default',
            lane              TEXT NOT NULL,
            track             TEXT NOT NULL DEFAULT '',
            assignee          TEXT NOT NULL DEFAULT '',
            provider_override TEXT NOT NULL DEFAULT '',
            model_override    TEXT NOT NULL DEFAULT '',
            billing           TEXT NOT NULL DEFAULT '',
            vendor            TEXT NOT NULL DEFAULT '',
            role              TEXT NOT NULL DEFAULT 'executor',
            judge_of          TEXT,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL,
            PRIMARY KEY (task_id, board)
        )
        """,
        "CREATE INDEX task_pins_by_lane ON task_pins(lane, board)",
    )),
]
SCHEMA_VERSION = MIGRATIONS[-1][0]

_versions = [version for version, _ in MIGRATIONS]
if _versions != list(range(1, len(_versions) + 1)):  # pragma: no cover - guards future edits
    raise RuntimeError(f"nomad db: migration versions must be 1..N without gaps, got {_versions}")


class SchemaTooNewError(RuntimeError):
    """The file was written by a newer Nomad than this code knows.

    Отказ вместо «работаем как есть»: после отката сборки старый код не должен писать в схему,
    которую он не понимает, — иначе порча данных будет тихой.
    """


class DepthLimitExceeded(RuntimeError, ValueError):
    """Task nesting depth exceeds the configured ``max_depth`` ceiling (M-163 / N6)."""

    def __init__(
        self,
        task_id: str,
        depth: int,
        max_depth: int,
        *,
        parent_task_id: Optional[str] = None,
        board: str = "default",
    ) -> None:
        self.task_id = str(task_id)
        self.depth = int(depth)
        self.max_depth = int(max_depth)
        self.parent_task_id = parent_task_id
        self.board = str(board or "default")
        parent_Part = f" (parent={parent_task_id!r})" if parent_task_id else ""
        super().__init__(
            f"task {self.task_id!r} depth {self.depth} exceeds max_depth {self.max_depth}{parent_Part}"
        )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def _user_version(conn: sqlite3.Connection) -> int:
    return int(conn.execute("PRAGMA user_version").fetchone()[0])


@contextmanager
def transaction(conn: sqlite3.Connection) -> Iterator[sqlite3.Connection]:
    """``BEGIN IMMEDIATE`` … ``COMMIT``; rollback on any exception.

    IMMEDIATE, а не DEFERRED: берём блокировку записи сразу, иначе два процесса (шлюз и CLI)
    читают версию схемы одновременно и оба начинают одну и ту же миграцию.
    """
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    conn.execute("COMMIT")


def migrate(conn: sqlite3.Connection) -> int:
    """Bring the schema to ``SCHEMA_VERSION``; safe to call any number of times. Returns the version."""
    current = _user_version(conn)
    if current > SCHEMA_VERSION:
        raise SchemaTooNewError(
            f"nomad data.db has schema v{current}, this code knows up to v{SCHEMA_VERSION}")
    if current == SCHEMA_VERSION:
        return current
    with transaction(conn):
        # Перечитываем под блокировкой: пока ждали её, миграцию мог сделать другой процесс.
        current = _user_version(conn)
        for version, statements in MIGRATIONS:
            if version <= current:
                continue
            for statement in statements:
                conn.execute(statement)
            conn.execute(f"PRAGMA user_version = {int(version)}")
    return _user_version(conn)


def connect() -> sqlite3.Connection:
    """Open the plugin database for the ACTIVE profile and migrate it.

    Autocommit mode (``isolation_level=None``): транзакции открываем сами через ``transaction()``,
    а не полагаемся на неявные BEGIN модуля sqlite3 — с ними миграция и её отметка версии могут
    оказаться в разных транзакциях.
    """
    conn = core_adapter.plugin_db(PLUGIN_NAME)
    try:
        conn.isolation_level = None
        conn.row_factory = sqlite3.Row
        migrate(conn)
    except BaseException:
        conn.close()
        raise
    return conn


def _encode_detail(detail: Any) -> Optional[str]:
    if detail is None:
        return None
    if isinstance(detail, str):
        return detail
    return json.dumps(detail, ensure_ascii=False, sort_keys=True)


def _decode_detail(raw: Optional[str]) -> Any:
    if raw is None:
        return None
    try:
        return json.loads(raw)
    except ValueError:
        return raw


def _insert_event(conn: sqlite3.Connection, kind: str, detail: Any, swarm_id: Optional[str]) -> int:
    cur = conn.execute(
        "INSERT INTO events (swarm_id, ts, kind, detail) VALUES (?, ?, ?, ?)",
        (swarm_id, _now(), kind, _encode_detail(detail)),
    )
    return int(cur.lastrowid)


def add_event(conn: sqlite3.Connection, kind: str, detail: Any = None,
              swarm_id: Optional[str] = None) -> int:
    """Append one event row and return its id."""
    if not kind:
        raise ValueError("event kind must be non-empty")
    with transaction(conn):
        return _insert_event(conn, kind, detail, swarm_id)


def create_swarm(conn: sqlite3.Connection, goal: str, pool_mode: str) -> dict:
    """Insert a swarm in status ``created`` together with its ``swarm_created`` event."""
    if not goal or not goal.strip():
        raise ValueError("swarm goal must be non-empty")
    swarm_id = f"sw-{uuid.uuid4().hex[:16]}"
    with transaction(conn):
        conn.execute(
            "INSERT INTO swarms (id, goal, status, created_at, pool_mode_at_creation) "
            "VALUES (?, ?, 'created', ?, ?)",
            (swarm_id, goal, _now(), pool_mode),
        )
        _insert_event(conn, "swarm_created", {"pool_mode": pool_mode}, swarm_id)
    record = get_swarm(conn, swarm_id, with_events=False)
    assert record is not None  # just inserted in a committed transaction
    return record


def list_events(conn: sqlite3.Connection, *, swarm_id: Optional[str] = None,
                kind: Optional[str] = None) -> list[dict]:
    clauses, params = [], []
    if swarm_id is not None:
        clauses.append("swarm_id = ?")
        params.append(swarm_id)
    if kind is not None:
        clauses.append("kind = ?")
        params.append(kind)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT id, swarm_id, ts, kind, detail FROM events{where} ORDER BY id", params).fetchall()
    return [{**dict(row), "detail": _decode_detail(row["detail"])} for row in rows]


# --- lane journal (M-160) ---------------------------------------------------------------------------
# Пробы дорожек и наблюдения окна живут в той же таблице events, отдельной схемы им не нужно:
# это журнал, а не состояние. lane_probe — каждый запуск внешней CLI каталогом возможностей
# (argv, путь к запущенному бинарю, код выхода, paid=false); lane_window_observed — наблюдение
# окна дорожки, привязанное к аккаунту и способу оплаты, при которых оно сделано.
EVENT_LANE_PROBE = "lane_probe"
EVENT_LANE_WINDOW_OBSERVED = "lane_window_observed"


def record_lane_observation(conn: sqlite3.Connection, lane: str, observation: dict, *,
                            account: Optional[str], billing: str) -> int:
    """Journal one observation of a lane's window; ``observed_at`` is stamped when absent.

    Для Claude Code это единственный источник остатка окна: сам CLI квоту наружу не отдаёт, её
    видно только по нашим же прогонам (429, ``rate_limit_error``).

    Дорожка — это каталог слота, а в каталог можно перелогиниться в другой аккаунт или на ключ
    API. Поэтому наблюдение хранит, ЧЬЁ это окно: ``account`` (ключ личности из
    ``capabilities.account_key``; None — личность неизвестна, такое наблюдение не приписывается
    никому) и ``billing``. Обязательные keyword-аргументы: забытая привязка — ошибка вызова, а не
    окно, тихо доставшееся следующему владельцу слота.
    """
    if not lane:
        raise ValueError("lane must be non-empty")
    if not billing:
        raise ValueError("billing must be non-empty")
    detail = {**observation, "lane": lane, "account": account, "billing": billing}
    detail.setdefault("observed_at", _now())
    return add_event(conn, EVENT_LANE_WINDOW_OBSERVED, detail)


def latest_lane_observation(conn: sqlite3.Connection, lane: str, *, account: Optional[str],
                            billing: str) -> Optional[dict]:
    """The newest ``lane_window_observed`` detail for ``lane`` made under the SAME ``account`` and
    ``billing`` (plus ``event_id``/``ts``), or None. ``account=None`` matches nothing: an
    unidentified login cannot claim anyone's window."""
    if account is None:
        return None
    # json_valid прежде json_extract, и именно через CASE: у AND в SQLite нет гарантированного
    # порядка вычисления, а строковый detail чужого события не должен ронять запрос.
    row = conn.execute(
        "SELECT id, ts, detail FROM events WHERE kind = ? "
        "AND CASE WHEN json_valid(detail) THEN json_extract(detail, '$.lane') = ? "
        "AND json_extract(detail, '$.account') = ? AND json_extract(detail, '$.billing') = ? "
        "ELSE 0 END "
        "ORDER BY id DESC LIMIT 1",
        (EVENT_LANE_WINDOW_OBSERVED, lane, account, billing),
    ).fetchone()
    if row is None:
        return None
    detail = _decode_detail(row["detail"])
    if not isinstance(detail, dict):
        return None
    return {**detail, "event_id": int(row["id"]), "ts": row["ts"]}


def get_swarm(conn: sqlite3.Connection, swarm_id: str, *, with_events: bool = True) -> Optional[dict]:
    row = conn.execute(
        "SELECT id, goal, status, created_at, pool_mode_at_creation FROM swarms WHERE id = ?",
        (swarm_id,),
    ).fetchone()
    if row is None:
        return None
    record = dict(row)
    if with_events:
        record["events"] = list_events(conn, swarm_id=swarm_id)
    return record


# --- token meter & unified usage table (M-107 / M-173) ----------------------------------------------

def _non_negative_int(value: Any) -> int:
    if value is None or isinstance(value, bool):
        return 0
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def _non_negative_float(value: Any) -> float:
    if value is None or isinstance(value, bool):
        return 0.0
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def record_usage(
    conn: sqlite3.Connection,
    *,
    api_request_id: str,
    account: Optional[str] = "",
    provider: Optional[str] = "",
    model: Optional[str] = "",
    task_id: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    lane: Optional[str] = None,
    billing: Optional[str] = None,
    session_id: Optional[str] = None,
    turn_id: Optional[str] = None,
    input_tokens: Any = 0,
    output_tokens: Any = 0,
    cached_tokens: Any = 0,
    cache_read_tokens: Any = 0,
    cache_write_tokens: Any = 0,
    reasoning_tokens: Any = 0,
    total_tokens: Any = None,
    cost_usd: Any = 0.0,
    created_at: Optional[str] = None,
) -> bool:
    """Insert one usage row deduplicated by ``api_request_id``.

    Returns ``True`` when a new row was inserted and ``False`` when ``api_request_id`` was already
    present (idempotent duplicate delivery of ``post_api_request``).
    """
    req_id = str(api_request_id).strip() if api_request_id is not None else ""
    if not req_id:
        raise ValueError("api_request_id must be non-empty")

    in_tok = _non_negative_int(input_tokens)
    out_tok = _non_negative_int(output_tokens)
    c_read = _non_negative_int(cache_read_tokens)
    c_write = _non_negative_int(cache_write_tokens)
    cached = _non_negative_int(cached_tokens)
    if cached == 0 and (c_read or c_write):
        cached = c_read + c_write
    reas_tok = _non_negative_int(reasoning_tokens)
    tot_tok = _non_negative_int(total_tokens)
    if tot_tok == 0 and (in_tok or out_tok or cached):
        tot_tok = in_tok + out_tok + cached

    effective_goal = goal_id if goal_id is not None else swarm_id
    effective_swarm = swarm_id if swarm_id is not None else goal_id
    stamp = str(created_at).strip() if created_at and str(created_at).strip() else _now()

    with transaction(conn):
        cur = conn.execute(
            "INSERT OR IGNORE INTO usage_events ("
            "api_request_id, account, provider, model, task_id, goal_id, swarm_id, lane, billing, "
            "session_id, turn_id, input_tokens, output_tokens, cached_tokens, cache_read_tokens, "
            "cache_write_tokens, reasoning_tokens, total_tokens, cost_usd, created_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                req_id,
                str(account or ""),
                str(provider or ""),
                str(model or ""),
                str(task_id) if task_id else None,
                str(effective_goal) if effective_goal else None,
                str(effective_swarm) if effective_swarm else None,
                str(lane) if lane else None,
                str(billing) if billing else None,
                str(session_id) if session_id else None,
                str(turn_id) if turn_id else None,
                in_tok,
                out_tok,
                cached,
                c_read,
                c_write,
                reas_tok,
                tot_tok,
                _non_negative_float(cost_usd),
                stamp,
            ),
        )
        return cur.rowcount == 1


def get_usage_by_request_id(conn: sqlite3.Connection, api_request_id: str) -> Optional[dict]:
    """Return one usage row by ``api_request_id``, or ``None`` if absent."""
    row = conn.execute(
        "SELECT * FROM usage_events WHERE api_request_id = ?",
        (str(api_request_id),),
    ).fetchone()
    return dict(row) if row is not None else None


def list_usage(
    conn: sqlite3.Connection,
    *,
    account: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    task_id: Optional[str] = None,
    lane: Optional[str] = None,
    provider: Optional[str] = None,
) -> list[dict]:
    """List usage rows ordered by ``id`` with optional filters."""
    clauses: list[str] = []
    params: list[Any] = []
    if account is not None:
        clauses.append("account = ?")
        params.append(account)
    if goal_id is not None:
        clauses.append("goal_id = ?")
        params.append(goal_id)
    if swarm_id is not None:
        clauses.append("swarm_id = ?")
        params.append(swarm_id)
    if task_id is not None:
        clauses.append("task_id = ?")
        params.append(task_id)
    if lane is not None:
        clauses.append("lane = ?")
        params.append(lane)
    if provider is not None:
        clauses.append("provider = ?")
        params.append(provider)
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(f"SELECT * FROM usage_events{where} ORDER BY id", params).fetchall()
    return [dict(row) for row in rows]


# --- task depth table (M-163 / N6) -------------------------------------------------------------------

def _normalize_board(board: Optional[str]) -> str:
    slug = str(board).strip() if board is not None else ""
    return slug or "default"


def get_task_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    board: Optional[str] = "default",
) -> Optional[dict]:
    """Return the ``task_depth`` row for ``(task_id, board)``, or ``None`` if absent."""
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        return None
    row = conn.execute(
        "SELECT task_id, board, parent_task_id, swarm_id, depth, max_depth, created_at "
        "FROM task_depth WHERE task_id = ? AND board = ?",
        (tid, _normalize_board(board)),
    ).fetchone()
    return dict(row) if row is not None else None


def resolve_task_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    parent_task_id: Optional[str] = None,
    board: Optional[str] = "default",
) -> int:
    """Compute the effective nesting depth for ``task_id`` without mutating ``task_depth``.

    If ``task_id`` already has a recorded row on ``board`` and ``parent_task_id`` is not given,
    returns the stored ``depth``. When ``parent_task_id`` is provided, resolves ``parent.depth + 1``
    (or ``1`` if the parent row is not yet recorded, treating the parent as root depth ``0``).
    Root tasks without a parent have depth ``0``.
    """
    board_slug = _normalize_board(board)
    existing = get_task_depth(conn, task_id, board=board_slug)
    if existing is not None and parent_task_id is None:
        return int(existing["depth"])
    parent_id = str(parent_task_id).strip() if parent_task_id is not None else ""
    if parent_id:
        parent_row = get_task_depth(conn, parent_id, board=board_slug)
        parent_depth = int(parent_row["depth"]) if parent_row is not None else 0
        return parent_depth + 1
    if existing is not None:
        return int(existing["depth"])
    return 0


def record_task_depth(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    parent_task_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    depth: Optional[int] = None,
    max_depth: Optional[int] = None,
    board: Optional[str] = "default",
    created_at: Optional[str] = None,
) -> dict:
    """Validate and persist a task's nesting depth in ``task_depth`` (M-163).

    Raises :class:`DepthLimitExceeded` BEFORE writing if the resolved ``depth`` exceeds
    ``max_depth`` (or the parent row's ``max_depth`` when ``max_depth`` is omitted).
    """
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        raise ValueError("task_id must be non-empty")
    board_slug = _normalize_board(board)
    parent_id = str(parent_task_id).strip() if parent_task_id else None
    if parent_id == tid:
        raise ValueError(f"task {tid!r} cannot be its own parent")

    parent_row = get_task_depth(conn, parent_id, board=board_slug) if parent_id else None

    if max_depth is None:
        effective_max = int(parent_row["max_depth"]) if parent_row is not None else DEFAULT_MAX_DEPTH
    else:
        if isinstance(max_depth, bool) or int(max_depth) < 0:
            raise ValueError("max_depth must be a non-negative integer")
        effective_max = int(max_depth)

    if depth is None:
        if parent_id is not None:
            parent_depth = int(parent_row["depth"]) if parent_row is not None else 0
            resolved_depth = parent_depth + 1
        else:
            existing = get_task_depth(conn, tid, board=board_slug)
            resolved_depth = int(existing["depth"]) if existing is not None else 0
    else:
        if isinstance(depth, bool) or int(depth) < 0:
            raise ValueError("depth must be a non-negative integer")
        resolved_depth = int(depth)

    if resolved_depth > effective_max:
        raise DepthLimitExceeded(
            tid,
            resolved_depth,
            effective_max,
            parent_task_id=parent_id,
            board=board_slug,
        )

    effective_swarm = (
        str(swarm_id).strip()
        if swarm_id
        else (parent_row["swarm_id"] if parent_row is not None else None)
    )
    stamp = str(created_at).strip() if created_at and str(created_at).strip() else _now()

    with transaction(conn):
        conn.execute(
            "INSERT INTO task_depth (task_id, board, parent_task_id, swarm_id, depth, max_depth, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(task_id, board) DO UPDATE SET "
            "parent_task_id = excluded.parent_task_id, "
            "swarm_id = COALESCE(excluded.swarm_id, task_depth.swarm_id), "
            "depth = excluded.depth, "
            "max_depth = excluded.max_depth",
            (tid, board_slug, parent_id, effective_swarm, resolved_depth, effective_max, stamp),
        )
    row = get_task_depth(conn, tid, board=board_slug)
    assert row is not None
    return row


def list_task_depths(
    conn: sqlite3.Connection,
    *,
    swarm_id: Optional[str] = None,
    board: Optional[str] = None,
) -> list[dict]:
    """Return rows from ``task_depth`` ordered by ``(board, depth, task_id)``."""
    clauses: list[str] = []
    params: list[Any] = []
    if swarm_id is not None:
        clauses.append("swarm_id = ?")
        params.append(swarm_id)
    if board is not None:
        clauses.append("board = ?")
        params.append(_normalize_board(board))
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT task_id, board, parent_task_id, swarm_id, depth, max_depth, created_at "
        f"FROM task_depth{where} ORDER BY board, depth, task_id",
        params,
    ).fetchall()
    return [dict(r) for r in rows]


def prune_orphan_depths(
    conn: sqlite3.Connection,
    active_task_ids: Any,
    *,
    board: Optional[str] = "default",
) -> int:
    """Delete ``task_depth`` rows on ``board`` whose ``task_id`` is not in ``active_task_ids``."""
    board_slug = _normalize_board(board)
    keep = {str(tid).strip() for tid in (active_task_ids or ()) if tid and str(tid).strip()}
    with transaction(conn):
        if not keep:
            cur = conn.execute("DELETE FROM task_depth WHERE board = ?", (board_slug,))
            return int(cur.rowcount)
        placeholders = ", ".join("?" for _ in keep)
        cur = conn.execute(
            f"DELETE FROM task_depth WHERE board = ? AND task_id NOT IN ({placeholders})",
            [board_slug, *sorted(keep)],
        )
        return int(cur.rowcount)


# --- task pins table & slot/pin journal (M-164 / N7) -------------------------------------------------

EVENT_TASK_PINNED = "task_pinned"
EVENT_TASK_PIN_REFUSED = "task_pin_refused"
EVENT_SLOT_IDENTITY_REJECTED = "slot_identity_rejected"


def get_task_pin(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    board: Optional[str] = "default",
) -> Optional[dict]:
    """Return the ``task_pins`` row for ``(task_id, board)``, or ``None`` if absent."""
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        return None
    row = conn.execute(
        "SELECT task_id, board, lane, track, assignee, provider_override, model_override, "
        "billing, vendor, role, judge_of, created_at, updated_at "
        "FROM task_pins WHERE task_id = ? AND board = ?",
        (tid, _normalize_board(board)),
    ).fetchone()
    return dict(row) if row is not None else None


def set_task_pin(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    lane: str,
    track: str = "",
    assignee: str = "",
    provider_override: str = "",
    model_override: str = "",
    billing: str = "",
    vendor: str = "",
    role: str = "executor",
    judge_of: Optional[str] = None,
    board: Optional[str] = "default",
    swarm_id: Optional[str] = None,
    created_at: Optional[str] = None,
) -> dict:
    """Upsert a manual task pin into ``task_pins`` and record ``task_pinned`` in ``events``."""
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        raise ValueError("task_id must be non-empty")
    lane_slug = str(lane).strip() if lane is not None else ""
    if not lane_slug:
        raise ValueError("lane must be non-empty")
    board_slug = _normalize_board(board)
    stamp = str(created_at).strip() if created_at and str(created_at).strip() else _now()
    judge_target = str(judge_of).strip() if judge_of and str(judge_of).strip() else None
    normalized_role = str(role or "executor").strip().lower() or "executor"

    with transaction(conn):
        conn.execute(
            "INSERT INTO task_pins ("
            "task_id, board, lane, track, assignee, provider_override, model_override, "
            "billing, vendor, role, judge_of, created_at, updated_at"
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(task_id, board) DO UPDATE SET "
            "lane = excluded.lane, "
            "track = excluded.track, "
            "assignee = excluded.assignee, "
            "provider_override = excluded.provider_override, "
            "model_override = excluded.model_override, "
            "billing = excluded.billing, "
            "vendor = excluded.vendor, "
            "role = excluded.role, "
            "judge_of = excluded.judge_of, "
            "updated_at = excluded.updated_at",
            (
                tid,
                board_slug,
                lane_slug,
                str(track or ""),
                str(assignee or lane_slug),
                str(provider_override or ""),
                str(model_override or ""),
                str(billing or ""),
                str(vendor or ""),
                normalized_role,
                judge_target,
                stamp,
                stamp,
            ),
        )
        _insert_event(
            conn,
            EVENT_TASK_PINNED,
            {
                "task_id": tid,
                "board": board_slug,
                "lane": lane_slug,
                "track": str(track or ""),
                "provider_override": str(provider_override or ""),
                "model_override": str(model_override or ""),
                "billing": str(billing or ""),
                "vendor": str(vendor or ""),
                "role": normalized_role,
                "judge_of": judge_target,
            },
            swarm_id,
        )
    row = get_task_pin(conn, tid, board=board_slug)
    assert row is not None
    return row


def delete_task_pin(
    conn: sqlite3.Connection,
    task_id: str,
    *,
    board: Optional[str] = "default",
) -> bool:
    """Delete a pin row for ``(task_id, board)``. Returns ``True`` if a row was removed."""
    tid = str(task_id).strip() if task_id is not None else ""
    if not tid:
        return False
    with transaction(conn):
        cur = conn.execute(
            "DELETE FROM task_pins WHERE task_id = ? AND board = ?",
            (tid, _normalize_board(board)),
        )
        return cur.rowcount == 1


def list_task_pins(
    conn: sqlite3.Connection,
    *,
    board: Optional[str] = None,
    lane: Optional[str] = None,
) -> list[dict]:
    """List ``task_pins`` rows ordered by ``(board, task_id)``."""
    clauses: list[str] = []
    params: list[Any] = []
    if board is not None:
        clauses.append("board = ?")
        params.append(_normalize_board(board))
    if lane is not None:
        clauses.append("lane = ?")
        params.append(str(lane).strip())
    where = f" WHERE {' AND '.join(clauses)}" if clauses else ""
    rows = conn.execute(
        f"SELECT task_id, board, lane, track, assignee, provider_override, model_override, "
        f"billing, vendor, role, judge_of, created_at, updated_at "
        f"FROM task_pins{where} ORDER BY board, task_id",
        params,
    ).fetchall()
    return [dict(r) for r in rows]
