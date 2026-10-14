"""Лента переключений аккаунтов (задача M-133).

Хук ошибки (429/исчерпание) + снимок пула аккаунтов до/после:
- При status_code=429, когда слот #1 между снимками стал exhausted,
  записывает событие:
  {ts, provider, model, status_code: 429, from_slot: "#1", to_slot: "#2",
   line: "HH:MM · провайдер · 429 · активна #2"}
- Повтор того же api_request_id дедуплицируется и не удваивает запись.
- Маршрут GET /accounts/switch-feed отдаёт список событий для экрана «Аккаунты»
  и карточки в чате десктопа (switch-card.js).
"""

from __future__ import annotations

from datetime import datetime, timezone
import logging
from pathlib import Path
import time
from typing import Any, Mapping, Optional

from fastapi import APIRouter, Query, Request

from . import db

logger = logging.getLogger("hermes_plugins.nomad.ui_switch_feed")

router = APIRouter(tags=["nomad-account-switch-feed"])

_RECENT_SEEN_REQUEST_IDS: set[str] = set()


def _format_time_hh_mm(ts_str: Optional[str] = None) -> str:
    """Вернуть время в формате HH:MM по UTC / ISO timestamp."""
    if ts_str:
        try:
            dt = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
            return dt.strftime("%H:%M")
        except Exception:
            pass
    return datetime.now(timezone.utc).strftime("%H:%M")


def format_switch_line(
    *,
    time_str: str,
    provider: str,
    status_code: int = 429,
    to_slot: str = "#2",
) -> str:
    """Сформировать стандартную строку события: «HH:MM · провайдер · 429 · активна #2»."""
    from . import ui_accounts

    prov_clean = ui_accounts.sanitize_brand_text(str(provider or "провайдер").strip())
    slot_clean = str(to_slot or "#2").strip()
    if not slot_clean.startswith("#"):
        slot_clean = f"#{slot_clean}"
    return f"{time_str} · {prov_clean} · {int(status_code)} · активна {slot_clean}"


def detect_and_record_switch(
    *,
    api_request_id: str,
    provider: str,
    model: str = "",
    status_code: int = 429,
    snapshot_before: Optional[Mapping[str, Any]] = None,
    snapshot_after: Optional[Mapping[str, Any]] = None,
    from_slot: Optional[str] = None,
    to_slot: Optional[str] = None,
    ts: Optional[str] = None,
    home: Optional[Path] = None,
) -> Optional[dict[str, Any]]:
    """Анализирует снимки пула до/после или явные слоты и фиксирует факт переключения.

    При status_code=429 (или exhausted), когда слот #1 стал exhausted,
    сохраняет событие переключения на слот #2 в БД плагина.
    Повторные запросы с тем же api_request_id игнорируются (дедупликация).
    """
    req_id = str(api_request_id or "").strip()
    if not req_id:
        return None

    if req_id in _RECENT_SEEN_REQUEST_IDS:
        return None

    resolved_from = from_slot
    resolved_to = to_slot

    # Если слоты не переданы явно, вычисляем их по снимкам пула
    if not resolved_from or not resolved_to:
        before_entries = []
        after_entries = []
        if snapshot_before and isinstance(snapshot_before, Mapping):
            before_entries = snapshot_before.get("entries") or []
        if snapshot_after and isinstance(snapshot_after, Mapping):
            after_entries = snapshot_after.get("entries") or []

        # Если снимка after нет, пробуем снять свежий с диска
        if not after_entries:
            try:
                from . import ui_accounts

                curr_snap = ui_accounts.build_accounts_snapshot(home=home, provider_filter=provider)
                pools = curr_snap.get("pools") or {}
                prov_pool = pools.get(provider) or {}
                after_entries = prov_pool.get("entries") or []
            except Exception:
                after_entries = []

        if before_entries:
            # Ищем, какой слот был активен до
            active_before = next((e for e in before_entries if e.get("is_active") or e.get("index") == 1), None)
            from_idx = active_before.get("index", 1) if active_before else 1
            resolved_from = f"#{from_idx}"

        if after_entries:
            # Ищем, какой слот стал активен после
            active_after = next((e for e in after_entries if e.get("is_active")), None)
            to_idx = active_after.get("index", 2) if active_after else 2
            resolved_to = f"#{to_idx}"

    resolved_from = str(resolved_from or "#1").strip()
    resolved_to = str(resolved_to or "#2").strip()

    now_iso = datetime.now(timezone.utc).isoformat()
    event_ts = str(ts or now_iso).strip()
    time_hh_mm = _format_time_hh_mm(event_ts)
    line = format_switch_line(
        time_str=time_hh_mm,
        provider=provider,
        status_code=status_code,
        to_slot=resolved_to,
    )

    try:
        conn = db.connect()
        try:
            inserted = db.record_account_switch(
                conn,
                api_request_id=req_id,
                provider=provider,
                model=model,
                status_code=status_code,
                from_slot=resolved_from,
                to_slot=resolved_to,
                line=line,
                ts=event_ts,
                created_at=now_iso,
            )
        finally:
            conn.close()

        if inserted:
            _RECENT_SEEN_REQUEST_IDS.add(req_id)
            if len(_RECENT_SEEN_REQUEST_IDS) > 10000:
                _RECENT_SEEN_REQUEST_IDS.clear()

            return {
                "api_request_id": req_id,
                "provider": provider,
                "model": model,
                "status_code": status_code,
                "from_slot": resolved_from,
                "to_slot": resolved_to,
                "line": line,
                "ts": event_ts,
            }
    except Exception as exc:
        logger.warning("nomad.ui_switch_feed: failed to record switch for %s: %s", req_id, exc)

    return None


@router.get("/accounts/switch-feed")
@router.get("/accounts/switches")
def get_account_switch_feed(
    provider: Optional[str] = Query(None, description="Фильтр по провайдеру"),
    limit: int = Query(50, ge=1, le=500, description="Лимит последних записей"),
) -> dict[str, Any]:
    """Вернуть ленту переключений аккаунтов из базы данных плагина."""
    try:
        conn = db.connect()
        try:
            items = db.list_account_switches(conn, provider=provider, limit=limit)
        finally:
            conn.close()
        return {
            "ok": True,
            "items": items,
            "total": len(items),
        }
    except Exception as exc:
        logger.error("get_account_switch_feed failed: %s", exc)
        return {
            "ok": False,
            "items": [],
            "total": 0,
            "error": str(exc),
        }


@router.post("/accounts/switch-feed")
def record_account_switch_endpoint(payload: dict[str, Any]) -> dict[str, Any]:
    """Ручная/тестовая запись события переключения аккаунта."""
    api_request_id = str(payload.get("api_request_id") or "").strip()
    provider = str(payload.get("provider") or "").strip()
    model = str(payload.get("model") or "").strip()
    status_code = int(payload.get("status_code", 429) or 429)
    from_slot = str(payload.get("from_slot") or "#1").strip()
    to_slot = str(payload.get("to_slot") or "#2").strip()
    ts = payload.get("ts")

    res = detect_and_record_switch(
        api_request_id=api_request_id,
        provider=provider,
        model=model,
        status_code=status_code,
        from_slot=from_slot,
        to_slot=to_slot,
        ts=ts,
    )
    if res is None:
        return {"ok": False, "recorded": False, "message": "Duplicate or invalid event"}
    return {"ok": True, "recorded": True, "event": res}
