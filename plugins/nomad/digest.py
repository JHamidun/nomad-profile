"""Swarm digest, milestone accumulation, and chat reporting (task M-177 / N16).

Rules:
- 10 intermediate milestones during owner turn -> 0 inject_message calls;
  all milestones accumulate in digest.
- Critical events: "жду тебя" (needs_owner) and "готово" (done) -> exactly 2 inject_message calls.
- Owner responses: "да" (approve) / "посмотрю сам" (inspect) / "отменить" (cancel) apply action.
- When chat injection is not allowed by config, inject_message refuses with WARNING,
  while digest and panel continue working.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from . import core_adapter, db, profile_config

logger = logging.getLogger("hermes_plugins.nomad.digest")

# In-memory milestone accumulator: swarm_id -> list of milestone strings
_DIGEST_MILESTONES: dict[str, list[dict[str, Any]]] = {}

# Injected messages spy/record for testing
_INJECTED_MESSAGES: list[dict[str, Any]] = []


def is_chat_report_allowed(config: Optional[dict[str, Any]] = None) -> bool:
    """Check if chat report injection is enabled in profile config."""
    cfg = config if config is not None else profile_config.load()
    nomad_cfg = (cfg or {}).get("nomad", {}) if isinstance(cfg, dict) else {}
    report_cfg = nomad_cfg.get("chat_report", {})
    if isinstance(report_cfg, dict):
        return bool(report_cfg.get("enabled", True))
    if isinstance(report_cfg, bool):
        return report_cfg
    return True


def record_milestone(
    conn,
    swarm_id: str,
    milestone: str,
    *,
    owner_in_turn: bool = True,
    detail: Optional[dict[str, Any]] = None,
) -> None:
    """Record an intermediate milestone. During owner turn, accumulates without chat injection."""
    sid = str(swarm_id or "default").strip()
    entry = {
        "text": str(milestone),
        "ts": datetime.now(timezone.utc).isoformat(),
        "owner_in_turn": bool(owner_in_turn),
        "detail": detail or {},
    }
    _DIGEST_MILESTONES.setdefault(sid, []).append(entry)
    db.add_event(conn, "milestone", {"text": str(milestone), "detail": detail or {}}, swarm_id=sid)


def get_milestones(swarm_id: str) -> list[dict[str, Any]]:
    """Return accumulated milestones for swarm_id."""
    return list(_DIGEST_MILESTONES.get(str(swarm_id or "default").strip(), []))


def clear_milestones(swarm_id: Optional[str] = None) -> None:
    """Clear milestones (used in testing)."""
    if swarm_id:
        _DIGEST_MILESTONES.pop(str(swarm_id).strip(), None)
    else:
        _DIGEST_MILESTONES.clear()
        _INJECTED_MESSAGES.clear()


def inject_message(
    chat_id: str,
    text: str,
    *,
    swarm_id: Optional[str] = None,
    config: Optional[dict[str, Any]] = None,
    injector: Optional[Callable[[str, str], Any]] = None,
) -> dict[str, Any]:
    """Inject a high-priority message to owner chat.

    If chat_report.enabled is false, refuses with WARNING and returns refusal dict.
    """
    if not is_chat_report_allowed(config):
        logger.warning("nomad: chat report inject_message disabled by configuration")
        return {
            "ok": False,
            "status": "refused",
            "reason": "disabled_by_config",
            "warning": "chat report inject_message disabled by configuration",
        }

    entry = {
        "chat_id": chat_id,
        "text": text,
        "swarm_id": swarm_id,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    _INJECTED_MESSAGES.append(entry)

    if injector is not None:
        try:
            injector(chat_id, text)
        except Exception as exc:
            logger.warning("nomad: injector failed: %s", exc)

    return {"ok": True, "status": "injected", "chat_id": chat_id, "text": text}


def notify_critical_event(
    conn,
    swarm_id: str,
    event_type: str,
    *,
    chat_id: str = "owner",
    config: Optional[dict[str, Any]] = None,
    injector: Optional[Callable[[str, str], Any]] = None,
) -> Optional[dict[str, Any]]:
    """Send chat notification for critical events ('жду тебя' or 'готово')."""
    sid = str(swarm_id or "default").strip()
    ev_lower = str(event_type).strip().lower()

    if ev_lower in ("needs_owner", "жду тебя", "waiting_for_owner", "waiting"):
        text = f"🐝 Рой {sid}: жду тебя — требуется решение владельца."
        db.add_event(conn, "needs_owner", {"swarm_id": sid}, swarm_id=sid)
        return inject_message(chat_id, text, swarm_id=sid, config=config, injector=injector)

    if ev_lower in ("done", "готово", "completed", "success"):
        text = f"🐝 Рой {sid}: готово — все задачи завершены."
        db.add_event(conn, "swarm_done", {"swarm_id": sid}, swarm_id=sid)
        return inject_message(chat_id, text, swarm_id=sid, config=config, injector=injector)

    return None


def handle_owner_response(
    conn,
    swarm_id: str,
    response: str,
) -> dict[str, Any]:
    """Apply action based on owner response: 'да' / 'посмотрю сам' / 'отменить'."""
    sid = str(swarm_id or "default").strip()
    text = str(response or "").strip().lower()

    if text in ("да", "yes", "ок", "ok", "allow", "продолжить", "approve"):
        db.add_event(conn, "owner_approved", {"swarm_id": sid, "response": response}, swarm_id=sid)
        return {
            "ok": True,
            "action": "approved",
            "swarm_id": sid,
            "message": "Решение подтверждено. Рой продолжает работу.",
        }

    if text in ("посмотрю сам", "inspect", "check", "панель"):
        db.add_event(conn, "owner_inspecting", {"swarm_id": sid, "response": response}, swarm_id=sid)
        return {
            "ok": True,
            "action": "inspect",
            "swarm_id": sid,
            "panel_url": f"/api/plugins/nomad/panel?swarm_id={sid}",
            "message": "Открыта панель мониторинга роя.",
        }

    if text in ("отменить", "cancel", "stop", "отмена"):
        from . import stop
        res = stop.stop_swarm(conn, sid)
        db.add_event(conn, "owner_cancelled", {"swarm_id": sid, "response": response}, swarm_id=sid)
        return {
            "ok": True,
            "action": "cancelled",
            "swarm_id": sid,
            "details": res,
            "message": "Рой остановлен по команде владельца.",
        }

    return {
        "ok": False,
        "action": "unknown",
        "swarm_id": sid,
        "message": f"Неизвестный ответ: {response}",
    }
