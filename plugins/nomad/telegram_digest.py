"""Telegram digest of swarm with inline keyboard buttons stop / allow / raise_budget (M-180 / N19).

Provides:
- format_inline_keyboard(swarm_id, budget_amount)
- build_swarm_digest(conn, swarm_id, budget_amount)
- send_telegram_swarm_digest(conn, swarm_id, bot_token, chat_id, api_base, ...)
- handle_telegram_callback(conn, callback_data, callback_id)
All callbacks modify data.db and are strictly idempotent on repeat invocation.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import urllib.error
import urllib.request
from typing import Any, Mapping, Optional

from . import db, digest

logger = logging.getLogger("hermes_plugins.nomad.telegram_digest")

DEFAULT_API_BASE = "https://api.telegram.org"
DEFAULT_BUDGET_RAISE = 5.0

_TELEGRAM_TABLES_DDL: tuple[str, ...] = (
    """
    CREATE TABLE IF NOT EXISTS swarm_budgets (
        swarm_id   TEXT PRIMARY KEY REFERENCES swarms(id),
        budget_usd REAL NOT NULL DEFAULT 0.0 CHECK (budget_usd >= 0.0),
        updated_at TEXT NOT NULL
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS telegram_callbacks (
        callback_key TEXT PRIMARY KEY,
        swarm_id     TEXT,
        action       TEXT NOT NULL,
        created_at   TEXT NOT NULL
    );
    """,
)


def ensure_telegram_tables(conn: sqlite3.Connection) -> None:
    """Create swarm_budgets and telegram_callbacks tables if not present."""
    with db.transaction(conn):
        for stmt in _TELEGRAM_TABLES_DDL:
            conn.execute(stmt)


def format_inline_keyboard(swarm_id: str, budget_amount: float = DEFAULT_BUDGET_RAISE) -> dict[str, Any]:
    """Build Telegram inline keyboard reply_markup with stop, allow, and raise_budget buttons."""
    sid = str(swarm_id).strip()
    amt_str = f"{budget_amount:g}"
    return {
        "inline_keyboard": [
            [
                {
                    "text": "🛑 Стоп",
                    "callback_data": f"nomad:stop:{sid}",
                },
                {
                    "text": "✅ Разрешить",
                    "callback_data": f"nomad:allow:{sid}",
                },
                {
                    "text": f"💰 +${amt_str}",
                    "callback_data": f"nomad:raise_budget:{sid}:{amt_str}",
                },
            ]
        ]
    }


def get_swarm_budget(conn: sqlite3.Connection, swarm_id: str) -> float:
    """Return currently allocated budget_usd for swarm_id in data.db."""
    ensure_telegram_tables(conn)
    row = conn.execute(
        "SELECT budget_usd FROM swarm_budgets WHERE swarm_id = ?",
        (str(swarm_id).strip(),),
    ).fetchone()
    return float(row["budget_usd"]) if row is not None else 0.0


def build_swarm_digest(
    conn: sqlite3.Connection,
    swarm_id: str,
    *,
    budget_amount: float = DEFAULT_BUDGET_RAISE,
) -> dict[str, Any]:
    """Generate the digest text and inline keyboard markup for swarm_id."""
    ensure_telegram_tables(conn)
    sid = str(swarm_id).strip()
    sw = db.get_swarm(conn, sid, with_events=True)
    if sw is None:
        raise ValueError(f"swarm {sid!r} not found in data.db")

    goal = sw.get("goal") or "Без цели"
    status = sw.get("status") or "unknown"
    pool_mode = sw.get("pool_mode_at_creation") or "owner_machine"
    created_at = sw.get("created_at") or ""
    current_budget = get_swarm_budget(conn, sid)

    # Check for needs_owner condition
    db.ensure_review_tables(conn)
    needs_owner_row = conn.execute(
        "SELECT COUNT(*) AS cnt FROM task_reviews WHERE swarm_id = ? AND verdict = 'needs_owner'",
        (sid,),
    ).fetchone()
    has_needs_owner = (needs_owner_row and needs_owner_row["cnt"] > 0) or (status == "needs_owner")

    # Accumulated milestones
    milestones = digest.get_milestones(sid)
    milestone_lines: list[str] = []
    for m in milestones[-5:]:  # Show recent up to 5
        t = m.get("text", "")
        if t:
            milestone_lines.append(f"• {t}")

    milestone_section = (
        "\n<b>Вехи:</b>\n" + "\n".join(milestone_lines)
        if milestone_lines
        else ""
    )

    owner_alert = "\n⚠️ <b>Требуется решение владельца (needs_owner)</b>\n" if has_needs_owner else ""

    text = (
        f"<b>Дайджест роя: {sid}</b>\n"
        f"<b>Цель:</b> {goal}\n"
        f"<b>Статус:</b> {status}\n"
        f"<b>Режим:</b> {pool_mode}\n"
        f"<b>Бюджет:</b> ${current_budget:.2f}"
        f"{owner_alert}"
        f"{milestone_section}"
    ).strip()

    keyboard = format_inline_keyboard(sid, budget_amount=budget_amount)
    return {
        "swarm_id": sid,
        "text": text,
        "reply_markup": keyboard,
        "status": status,
        "has_needs_owner": has_needs_owner,
        "budget_usd": current_budget,
    }


def send_telegram_swarm_digest(
    conn: sqlite3.Connection,
    swarm_id: str,
    *,
    bot_token: str,
    chat_id: str | int,
    api_base: str = DEFAULT_API_BASE,
    budget_amount: float = DEFAULT_BUDGET_RAISE,
    timeout: float = 10.0,
) -> dict[str, Any]:
    """Send swarm digest with inline keyboard buttons to Telegram Bot API."""
    if not bot_token or not str(bot_token).strip():
        raise ValueError("bot_token must be non-empty")
    if not chat_id or not str(chat_id).strip():
        raise ValueError("chat_id must be non-empty")

    digest_info = build_swarm_digest(conn, swarm_id, budget_amount=budget_amount)
    url = f"{api_base.rstrip('/')}/bot{bot_token.strip()}/sendMessage"
    payload = {
        "chat_id": str(chat_id).strip(),
        "text": digest_info["text"],
        "parse_mode": "HTML",
        "reply_markup": digest_info["reply_markup"],
    }

    req_data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=req_data,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw_resp = resp.read().decode("utf-8")
            data = json.loads(raw_resp)
            msg_id = data.get("result", {}).get("message_id")
            return {
                "ok": bool(data.get("ok")),
                "message_id": msg_id,
                "swarm_id": swarm_id,
                "text": digest_info["text"],
                "reply_markup": digest_info["reply_markup"],
                "response": data,
            }
    except urllib.error.HTTPError as err:
        err_body = err.read().decode("utf-8", errors="replace")
        logger.error("Telegram API HTTPError %s: %s", err.code, err_body)
        raise RuntimeError(f"Telegram Bot API failed with code {err.code}: {err_body}") from err
    except urllib.error.URLError as err:
        logger.error("Telegram API URLError: %s", err.reason)
        raise RuntimeError(f"Telegram Bot API unreachable: {err.reason}") from err


def handle_telegram_callback(
    conn: sqlite3.Connection,
    callback_data: str,
    *,
    callback_id: Optional[str] = None,
) -> dict[str, Any]:
    """Handle Telegram callback query with idempotency guarantees.

    Supports:
    - nomad:stop:<swarm_id>
    - nomad:allow:<swarm_id>
    - nomad:raise_budget:<swarm_id>:<amount>
    """
    ensure_telegram_tables(conn)
    raw = str(callback_data or "").strip()
    parts = raw.split(":")
    if len(parts) < 3 or parts[0] != "nomad":
        return {
            "ok": False,
            "status": "error",
            "reason": f"unknown callback_data format: {raw!r}",
        }

    action = parts[1]
    swarm_id = parts[2]

    # Verify swarm exists in data.db
    sw = db.get_swarm(conn, swarm_id, with_events=False)
    if sw is None:
        return {
            "ok": False,
            "status": "not_found",
            "reason": f"swarm {swarm_id!r} not found",
            "swarm_id": swarm_id,
        }

    # 1. STOP action
    if action == "stop":
        if sw.get("status") == "stopped":
            return {
                "ok": True,
                "action": "stop",
                "swarm_id": swarm_id,
                "status": "stopped",
                "idempotent": True,
                "already_stopped": True,
            }

        with db.transaction(conn):
            conn.execute(
                "UPDATE swarms SET status = 'stopped' WHERE id = ?",
                (swarm_id,),
            )
            db._insert_event(
                conn,
                "swarm_stopped",
                {"source": "telegram", "action": "stop"},
                swarm_id,
            )

        return {
            "ok": True,
            "action": "stop",
            "swarm_id": swarm_id,
            "status": "stopped",
            "idempotent": False,
            "already_stopped": False,
        }

    # 2. ALLOW action
    if action == "allow":
        db.ensure_review_tables(conn)
        reviews_in_needs_owner = conn.execute(
            "SELECT COUNT(*) AS cnt FROM task_reviews WHERE swarm_id = ? AND verdict = 'needs_owner'",
            (swarm_id,),
        ).fetchone()
        count_needs_owner = reviews_in_needs_owner["cnt"] if reviews_in_needs_owner else 0
        swarm_in_needs_owner = sw.get("status") == "needs_owner"

        if count_needs_owner == 0 and not swarm_in_needs_owner:
            # Already cleared or not in needs_owner -> idempotent
            return {
                "ok": True,
                "action": "allow",
                "swarm_id": swarm_id,
                "status": sw.get("status") or "running",
                "idempotent": True,
                "already_allowed": True,
                "cleared_tasks": 0,
            }

        with db.transaction(conn):
            cur = conn.execute(
                "UPDATE task_reviews SET verdict = 'pending' WHERE swarm_id = ? AND verdict = 'needs_owner'",
                (swarm_id,),
            )
            cleared = cur.rowcount
            if swarm_in_needs_owner:
                conn.execute(
                    "UPDATE swarms SET status = 'running' WHERE id = ?",
                    (swarm_id,),
                )
            db._insert_event(
                conn,
                "owner_allowed",
                {"source": "telegram", "action": "allow", "cleared_tasks": cleared},
                swarm_id,
            )

        new_sw = db.get_swarm(conn, swarm_id, with_events=False)
        return {
            "ok": True,
            "action": "allow",
            "swarm_id": swarm_id,
            "status": new_sw.get("status") if new_sw else "running",
            "idempotent": False,
            "already_allowed": False,
            "cleared_tasks": cleared,
        }

    # 3. RAISE BUDGET action
    if action == "raise_budget":
        amount = DEFAULT_BUDGET_RAISE
        if len(parts) >= 4:
            try:
                amount = float(parts[3])
            except (ValueError, TypeError):
                amount = DEFAULT_BUDGET_RAISE

        callback_key = str(callback_id or raw).strip()
        already = conn.execute(
            "SELECT callback_key FROM telegram_callbacks WHERE callback_key = ?",
            (callback_key,),
        ).fetchone()

        cur_budget = get_swarm_budget(conn, swarm_id)
        if already is not None:
            return {
                "ok": True,
                "action": "raise_budget",
                "swarm_id": swarm_id,
                "amount": amount,
                "budget_usd": cur_budget,
                "idempotent": True,
                "already_processed": True,
            }

        new_budget = cur_budget + amount
        stamp = db._now()
        with db.transaction(conn):
            conn.execute(
                "INSERT INTO telegram_callbacks (callback_key, swarm_id, action, created_at) "
                "VALUES (?, ?, 'raise_budget', ?)",
                (callback_key, swarm_id, stamp),
            )
            conn.execute(
                "INSERT INTO swarm_budgets (swarm_id, budget_usd, updated_at) "
                "VALUES (?, ?, ?) "
                "ON CONFLICT(swarm_id) DO UPDATE SET "
                "budget_usd = budget_usd + excluded.budget_usd, "
                "updated_at = excluded.updated_at",
                (swarm_id, amount, stamp),
            )
            db._insert_event(
                conn,
                "budget_raised",
                {"amount": amount, "new_budget_usd": new_budget, "source": "telegram"},
                swarm_id,
            )

        return {
            "ok": True,
            "action": "raise_budget",
            "swarm_id": swarm_id,
            "amount": amount,
            "budget_usd": new_budget,
            "idempotent": False,
            "already_processed": False,
        }

    return {
        "ok": False,
        "status": "error",
        "reason": f"unrecognized action: {action!r}",
    }
