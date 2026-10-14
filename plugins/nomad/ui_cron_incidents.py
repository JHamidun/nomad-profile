"""М-147: Сбои задач по расписанию (`/api/plugins/nomad/cron/incidents`).

Работает поверх таблицы `cron_incidents` в `<HERMES_HOME>/cron/executions.db`
(схема полностью совместима с `cron/incidents.py`):
  - `GET /cron/incidents` — список инцидентов (`detected`, `alerted`, `resolved`, `closed`)
    с текстом ошибки, именем задачи, числом повторов (`repeat_count`) и счётчиками;
  - `POST /cron/incidents/{incident_id}/ack` — подтверждение инцидента («Принято»),
    переводящее `state` в `'closed'` и заполняющее `acked_at` / `closed_at`.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
import sqlite3
from typing import Any

from . import core_adapter

INCIDENT_STATES = ("detected", "alerted", "resolved", "closed")
OPEN_INCIDENT_STATES = ("detected", "alerted")


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home).expanduser().resolve()
    return core_adapter.get_hermes_home().expanduser().resolve()


def _db_path(home: Path | None = None) -> Path:
    return _resolve_home(home) / "cron" / "executions.db"


def _initialize_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """CREATE TABLE IF NOT EXISTS cron_incidents (
             id            TEXT PRIMARY KEY,
             job_id        TEXT NOT NULL,
             error_sig     TEXT NOT NULL,
             state         TEXT NOT NULL,
             failure_type  TEXT NOT NULL DEFAULT 'unknown',
             first_seen_at TEXT NOT NULL,
             last_seen_at  TEXT NOT NULL,
             acked_at      TEXT,
             alerted_at    TEXT,
             closed_at     TEXT,
             error         TEXT NOT NULL,
             output_file   TEXT
           )"""
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_cron_incidents_job ON cron_incidents(job_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_cron_incidents_state ON cron_incidents(state)"
    )


def _open_conn(home: Path | None = None) -> sqlite3.Connection:
    db_file = _db_path(home)
    db_file.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_file), timeout=10.0)
    conn.row_factory = sqlite3.Row
    _initialize_schema(conn)
    return conn


def _load_jobs_Metadata(home: Path | None = None) -> dict[str, dict[str, Any]]:
    jobs_file = _resolve_home(home) / "cron" / "jobs.json"
    if not jobs_file.is_file():
        return {}
    try:
        raw = json.loads(jobs_file.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {}
    jobs = raw.get("jobs", []) if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
    out: dict[str, dict[str, Any]] = {}
    for item in jobs:
        if isinstance(item, dict) and item.get("id"):
            out[str(item["id"])] = item
    return out


def _count_failed_executions_by_job(conn: sqlite3.Connection) -> dict[str, int]:
    try:
        rows = conn.execute(
            "SELECT job_id, COUNT(*) AS cnt FROM executions WHERE status='failed' GROUP BY job_id"
        ).fetchall()
        return {str(r["job_id"]): int(r["cnt"] or 0) for r in rows}
    except sqlite3.OperationalError:
        return {}


def _enrich_incident(
    row: dict[str, Any],
    jobs_meta: dict[str, dict[str, Any]],
    failed_counts: dict[str, int],
) -> dict[str, Any]:
    job_id = str(row.get("job_id") or "")
    job_info = jobs_meta.get(job_id) or {}
    streak = int(job_info.get("failure_streak") or 0)
    exec_failures = int(failed_counts.get(job_id) or 0)
    base_repeats = 2 if (row.get("last_seen_at") and row.get("last_seen_at") != row.get("first_seen_at")) else 1
    repeat_count = max(streak, exec_failures, base_repeats, 1)
    raw_state = str(row.get("state") or "detected")
    ui_status = "resolved" if raw_state in ("closed", "resolved") else raw_state
    err_str = str(row.get("error") or "")
    return {
        **row,
        "status": ui_status,
        "error_text": err_str,
        "last_error": err_str,
        "consecutive_failures": repeat_count,
        "job_name": str(job_info.get("name") or job_id or "Задача по расписанию"),
        "repeat_count": repeat_count,
        "is_open": raw_state in OPEN_INCIDENT_STATES,
    }


def list_cron_incidents(
    *,
    state: str | None = None,
    include_closed: bool = True,
    home: Path | None = None,
) -> list[dict[str, Any]]:
    """Вернуть список инцидентов расписания, отсортированный от новых к старым."""
    if state is not None and state not in INCIDENT_STATES:
        return []
    jobs_meta = _load_jobs_Metadata(home)
    conn = _open_conn(home)
    try:
        failed_counts = _count_failed_executions_by_job(conn)
        if state is not None:
            rows = conn.execute(
                "SELECT * FROM cron_incidents WHERE state=? "
                "ORDER BY julianday(last_seen_at) DESC, last_seen_at DESC, id DESC",
                (state,),
            ).fetchall()
        elif not include_closed:
            rows = conn.execute(
                "SELECT * FROM cron_incidents WHERE state IN ('detected', 'alerted') "
                "ORDER BY julianday(last_seen_at) DESC, last_seen_at DESC, id DESC"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM cron_incidents "
                "ORDER BY julianday(last_seen_at) DESC, last_seen_at DESC, id DESC"
            ).fetchall()
        return [_enrich_incident(dict(r), jobs_meta, failed_counts) for r in rows]
    finally:
        conn.close()


def get_cron_incident(
    incident_id: str,
    *,
    home: Path | None = None,
) -> dict[str, Any] | None:
    clean_id = str(incident_id or "").strip()
    if not clean_id:
        return None
    jobs_meta = _load_jobs_Metadata(home)
    conn = _open_conn(home)
    try:
        row = conn.execute(
            "SELECT * FROM cron_incidents WHERE id=?",
            (clean_id,),
        ).fetchone()
        if row is None:
            return None
        failed_counts = _count_failed_executions_by_job(conn)
        return _enrich_incident(dict(row), jobs_meta, failed_counts)
    finally:
        conn.close()


def ack_cron_incident(
    incident_id: str,
    *,
    home: Path | None = None,
) -> dict[str, Any]:
    """Подтвердить инцидент (`state='closed'`, заполнить `acked_at` и `closed_at`)."""
    clean_id = str(incident_id or "").strip()
    if not clean_id:
        raise ValueError("Не указан идентификатор инцидента.")
    now_iso = datetime.now(timezone.utc).isoformat()
    conn = _open_conn(home)
    try:
        with conn:
            row = conn.execute(
                "SELECT * FROM cron_incidents WHERE id=?",
                (clean_id,),
            ).fetchone()
            if row is None:
                raise KeyError(f"Инцидент {clean_id!r} не найден.")
            already_closed = str(row["state"]) == "closed"
            if not already_closed:
                conn.execute(
                    """UPDATE cron_incidents
                       SET state='closed', closed_at=?, acked_at=?
                       WHERE id=? AND state != 'closed'""",
                    (now_iso, now_iso, clean_id),
                )
            updated = conn.execute(
                "SELECT * FROM cron_incidents WHERE id=?",
                (clean_id,),
            ).fetchone()
            failed_counts = _count_failed_executions_by_job(conn)
    finally:
        conn.close()

    jobs_meta = _load_jobs_Metadata(home)
    enriched = _enrich_incident(dict(updated), jobs_meta, failed_counts) if updated else {}
    all_open = [
        i
        for i in list_cron_incidents(include_closed=False, home=home)
        if i.get("state") in OPEN_INCIDENT_STATES
    ]
    return {
        "ok": True,
        "acknowledged": not already_closed,
        "state": enriched.get("state", "closed"),
        "status": enriched.get("status", "resolved"),
        "incident": enriched,
        "open_count": len(all_open),
    }


try:
    from fastapi import APIRouter, HTTPException, Query
except ImportError:  # pragma: no cover
    APIRouter = None  # type: ignore[assignment,misc]


def build_router():
    if APIRouter is None:  # pragma: no cover
        return None
    r = APIRouter(tags=["nomad-cron-incidents"])

    @r.get("/cron/incidents")
    def _get_cron_incidents(
        state: str | None = Query(default=None),
        include_closed: bool | None = Query(default=None),
        include_resolved: bool | None = Query(default=None),
    ) -> dict[str, Any]:
        if include_resolved is not None:
            with_closed = bool(include_resolved)
        elif include_closed is not None:
            with_closed = bool(include_closed)
        else:
            with_closed = True
        all_items = list_cron_incidents(state=state, include_closed=with_closed)
        open_items = [i for i in all_items if i.get("state") in OPEN_INCIDENT_STATES]
        closed_items = [i for i in all_items if i.get("state") in ("closed", "resolved")]
        return {
            "ok": True,
            "incidents": all_items,
            "open_count": len(open_items),
            "closed_count": len(closed_items),
            "total": len(all_items),
        }

    @r.post("/cron/incidents/{incident_id}/ack")
    def _post_ack_cron_incident(incident_id: str) -> dict[str, Any]:
        try:
            return ack_cron_incident(incident_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return r


router = build_router()
