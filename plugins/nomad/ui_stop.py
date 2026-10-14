"""UI backend routes for Stop and Pause controls (task M-137 / UI-N2).

Provides routes under `/api/plugins/nomad`:
  - POST /pause: calls stop.engage(reason)
  - POST /resume: calls stop.resume()
  - GET /state: returns current stop/pause state and indicator status
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel, Field

from . import stop

router = APIRouter(tags=["stop"])


class PauseRequest(BaseModel):
    reason: Optional[str] = Field(default=None, description="Reason for pausing work")


class PauseResponse(BaseModel):
    ok: bool = True
    stopped: bool
    reason: Optional[str] = None


class ResumeResponse(BaseModel):
    ok: bool = True
    stopped: bool = False
    resumed: bool


class StateResponse(BaseModel):
    ok: bool = True
    stopped: bool
    indicator: str
    state: Optional[dict[str, Any]] = None


@router.post("/pause", response_model=PauseResponse)
def post_pause(body: Optional[PauseRequest] = None) -> PauseResponse:
    reason = body.reason if body else None
    stop.engage(reason)
    return PauseResponse(ok=True, stopped=True, reason=reason)


@router.post("/resume", response_model=ResumeResponse)
def post_resume() -> ResumeResponse:
    resumed = stop.resume()
    return ResumeResponse(ok=True, stopped=False, resumed=resumed)


@router.get("/state", response_model=StateResponse)
@router.get("/status", response_model=StateResponse)
def get_state() -> StateResponse:
    stopped = stop.is_stopped()
    curr_state = stop.get_state()
    indicator = "stopped" if stopped else "running"
    return StateResponse(ok=True, stopped=stopped, indicator=indicator, state=curr_state)
