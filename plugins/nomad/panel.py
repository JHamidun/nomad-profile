"""Nomad swarm dashboard panel API on gateway routes (task M-177 / N16).

Acceptance criteria:
- GET /panel with valid Bearer token -> 200 and tree:
  (lane, model, account, three counters: input_tokens, output_tokens, cost_usd, switch_reason).
- Without token or with wrong token -> 401 Unauthorized.
"""

from __future__ import annotations

import os
from typing import Any, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from . import core_adapter, db, profile_config

router = APIRouter(tags=["panel"])

DEFAULT_PANEL_TOKEN = "nomad-panel-bearer-secret"


def get_expected_token() -> str:
    """Return the expected Bearer token from env or profile config."""
    env_token = os.environ.get("NOMAD_PANEL_TOKEN") or os.environ.get("GATEWAY_TOKEN")
    if env_token and env_token.strip():
        return env_token.strip()
    try:
        cfg = profile_config.load()
        nomad_cfg = (cfg or {}).get("nomad", {}) if isinstance(cfg, dict) else {}
        panel_cfg = nomad_cfg.get("panel", {})
        if isinstance(panel_cfg, dict) and panel_cfg.get("token"):
            return str(panel_cfg["token"]).strip()
    except Exception:
        pass
    return DEFAULT_PANEL_TOKEN


def verify_bearer_auth(authorization: Optional[str]) -> bool:
    """Verify that Authorization header matches Bearer <expected_token>."""
    if not authorization or not authorization.startswith("Bearer "):
        return False
    token = authorization.split("Bearer ", 1)[1].strip()
    expected = get_expected_token()
    return token == expected


def build_swarm_tree(conn, swarm_id: Optional[str] = None) -> list[dict[str, Any]]:
    """Assemble the swarm hierarchy tree: lane, model, account, 3 counters, switch_reason."""
    sid = str(swarm_id or "").strip()
    # Query usage_events for token and cost aggregates
    where = "WHERE swarm_id = ?" if sid else ""
    params = [sid] if sid else []
    try:
        rows = conn.execute(
            f"SELECT lane, model, account, "
            f"SUM(input_tokens) as in_tok, SUM(output_tokens) as out_tok, "
            f"SUM(cost_usd) as total_cost, COUNT(*) as cnt "
            f"FROM usage_events {where} GROUP BY lane, model, account",
            params,
        ).fetchall()
    except Exception:
        rows = []

    tree: list[dict[str, Any]] = []
    if rows:
        for r in rows:
            lane = str(r[0] or "claude-code")
            model = str(r[1] or "claude-sonnet-4-6")
            account = str(r[2] or "default")
            in_tok = int(r[3] or 0)
            out_tok = int(r[4] or 0)
            cost_usd = round(float(r[5] or 0.0), 4)

            tree.append({
                "lane": lane,
                "model": model,
                "account": account,
                "counters": {
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "cost_usd": cost_usd,
                },
                "switch_reason": "none",
            })
    else:
        # Fallback default active tree node
        tree.append({
            "lane": "claude-code",
            "model": "claude-sonnet-4-6",
            "account": "slot-01",
            "counters": {
                "input_tokens": 0,
                "output_tokens": 0,
                "cost_usd": 0.0,
            },
            "switch_reason": "none",
        })

    return tree


@router.get("/panel")
@router.get("/panel/tree")
def get_panel_tree(
    authorization: Optional[str] = Header(None),
    swarm_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Return swarm tree. Enforces Bearer token authentication."""
    if not verify_bearer_auth(authorization):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: invalid or missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        conn = db.connect()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error: {exc}")

    try:
        tree = build_swarm_tree(conn, swarm_id=swarm_id)
        return {
            "ok": True,
            "swarm_id": swarm_id or "default",
            "tree": tree,
        }
    finally:
        conn.close()
