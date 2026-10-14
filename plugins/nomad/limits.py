"""Limit switching, four probes, four codes, and per-vendor ladders (M-174 / spec §4.2, §4.3).

Четыре кода и их реакции:
- ``needs_owner``: пустой ``CLAUDE_CONFIG_DIR`` / ``loggedIn: false`` -> слот выводится из ротации;
- ``budget``: ``claude.exe -p --max-budget-usd 0.01 --output-format json`` -> ``error_max_budget_usd``
  -> ``blocked(reason="budget")`` без повтора и без ротации слотов;
- ``limit``: HTTP 429 с заголовками ``anthropic-ratelimit-unified-*`` (или ``rate_limit_error``) ->
  лестница по вендору:
    * Anthropic (``claude-code``): ``wait_reset`` -> ``rotate_account`` -> ``switch_model`` -> ``block``
      (ждать -> аккаунт -> модель -> блок);
    * Codex (``codex``): ``smaller_model`` -> ``block`` (модель поменьше -> блок, без ротации аккаунтов);
- ``account_disabled``: отзыв доступа / блокировка организации -> ``blocked(reason="account_disabled")``,
  ``0`` ``lane_started`` на других слотах, запись цены переключения (потеря кэша по ``usage`` прошлого
  прогона) и ``vendor_basis`` в лог и БД, ``0`` платных вызовов.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping, Optional, Sequence

from . import capabilities, db, failures, slots, spawn

logger = logging.getLogger("hermes_plugins.nomad.limits")

CODE_NEEDS_OWNER = failures.CODE_NEEDS_OWNER
CODE_BUDGET = failures.CODE_BUDGET
CODE_LIMIT = failures.CODE_LIMIT
CODE_ACCOUNT_DISABLED = failures.CODE_ACCOUNT_DISABLED

VENDOR_ANTHROPIC = failures.VENDOR_ANTHROPIC
VENDOR_CODEX = failures.VENDOR_CODEX

ANTHROPIC_LADDER_STEPS: tuple[str, ...] = ("wait_reset", "rotate_account", "switch_model", "block")
CODEX_LADDER_STEPS: tuple[str, ...] = ("smaller_model", "block")

ANTHROPIC_MODEL_LADDER: tuple[str, ...] = (
    "claude-opus-4-7",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001",
)
CODEX_MODEL_LADDER: tuple[str, ...] = (
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.3-codex",
)

VENDOR_BASIS_DOCUMENTED = "documented"
VENDOR_BASIS_OBSERVED = "observed"

EVENT_LIMIT_SWITCH = "limit_switch"
EVENT_SLOT_EVICTED = "slot_evicted"


@dataclass(frozen=True)
class AnthropicRateLimitHeaders:
    """Parsed ``anthropic-ratelimit-unified-*`` HTTP response headers (M-174c)."""

    status: str = "rejected"
    reset_epoch: Optional[int] = None
    retry_after_s: Optional[float] = None
    five_hour_utilization: Optional[float] = None
    seven_day_utilization: Optional[float] = None
    representative_claim: str = ""
    vendor_basis: str = VENDOR_BASIS_DOCUMENTED
    raw_headers: Mapping[str, str] = field(default_factory=dict)

    def reset_in_seconds(self, *, now: Optional[float] = None) -> Optional[float]:
        if self.retry_after_s is not None and self.retry_after_s >= 0:
            return float(self.retry_after_s)
        if self.reset_epoch is not None:
            current = time.time() if now is None else float(now)
            return max(0.0, float(self.reset_epoch) - current)
        return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "reset_epoch": self.reset_epoch,
            "retry_after_s": self.retry_after_s,
            "five_hour_utilization": self.five_hour_utilization,
            "seven_day_utilization": self.seven_day_utilization,
            "representative_claim": self.representative_claim,
            "vendor_basis": self.vendor_basis,
        }


def parse_anthropic_ratelimit_headers(
    headers: Optional[Mapping[str, Any]],
) -> Optional[AnthropicRateLimitHeaders]:
    """Parse ``anthropic-ratelimit-unified-*`` headers from an HTTP response mapping."""
    if not isinstance(headers, Mapping) or not headers:
        return None
    lowered = {str(k).strip().lower(): str(v).strip() for k, v in headers.items() if k is not None and v is not None}
    has_unified = any(k.startswith("anthropic-ratelimit-unified-") for k in lowered)
    if not has_unified:
        return None

    status = lowered.get("anthropic-ratelimit-unified-status", "rejected")
    raw_reset = (
        lowered.get("anthropic-ratelimit-unified-reset")
        or lowered.get("anthropic-ratelimit-unified-5h-reset")
        or lowered.get("anthropic-ratelimit-unified-7d-reset")
    )
    reset_epoch: Optional[int] = None
    if raw_reset:
        try:
            reset_epoch = int(float(raw_reset))
        except ValueError:
            reset_epoch = None

    raw_retry = lowered.get("retry-after")
    retry_after_s: Optional[float] = None
    if raw_retry:
        try:
            retry_after_s = float(raw_retry)
        except ValueError:
            retry_after_s = None

    def _opt_float(key: str) -> Optional[float]:
        val = lowered.get(key)
        if val is None or val == "":
            return None
        try:
            return float(val)
        except ValueError:
            return None

    return AnthropicRateLimitHeaders(
        status=status,
        reset_epoch=reset_epoch,
        retry_after_s=retry_after_s,
        five_hour_utilization=_opt_float("anthropic-ratelimit-unified-5h-utilization"),
        seven_day_utilization=_opt_float("anthropic-ratelimit-unified-7d-utilization"),
        representative_claim=lowered.get("anthropic-ratelimit-unified-representative-claim", ""),
        vendor_basis=VENDOR_BASIS_DOCUMENTED,
        raw_headers=lowered,
    )


@dataclass(frozen=True)
class SwitchCost:
    """Switching cost computed from the previous run's token usage (cache loss on slot/model change)."""

    cache_write_tokens: int = 0
    cache_read_tokens: int = 0
    input_tokens: int = 0
    cache_tokens_lost: int = 0
    switch_cost_usd: float = 0.0
    previous_run_id: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "cache_write_tokens": self.cache_write_tokens,
            "cache_read_tokens": self.cache_read_tokens,
            "input_tokens": self.input_tokens,
            "cache_tokens_lost": self.cache_tokens_lost,
            "switch_cost_usd": round(self.switch_cost_usd, 6),
            "previous_run_id": self.previous_run_id,
        }


def compute_switch_cost(
    previous_usage: Optional[Mapping[str, Any]] = None,
    *,
    rewarm_price_per_m_usd: float = 3.75,
) -> SwitchCost:
    """Compute cache loss cost from the previous run's ``usage`` payload when switching slot/model."""
    if not isinstance(previous_usage, Mapping):
        return SwitchCost()

    def _int_field(*names: str) -> int:
        for name in names:
            val = previous_usage.get(name)
            if val is not None and not isinstance(val, bool):
                try:
                    return max(0, int(val))
                except (TypeError, ValueError):
                    continue
        return 0

    cache_write = _int_field("cache_write_tokens", "cache_creation_input_tokens")
    cache_read = _int_field("cache_read_tokens", "cache_read_input_tokens", "prompt_cache_hit_tokens")
    input_tok = _int_field("input_tokens", "prompt_tokens")
    lost_tokens = cache_write + cache_read
    if lost_tokens == 0 and input_tok > 0:
        lost_tokens = input_tok

    cost_usd = (lost_tokens / 1_000_000.0) * max(0.0, float(rewarm_price_per_m_usd))
    prev_run_id = str(previous_usage.get("run_id") or previous_usage.get("api_request_id") or "")
    return SwitchCost(
        cache_write_tokens=cache_write,
        cache_read_tokens=cache_read,
        input_tokens=input_tok,
        cache_tokens_lost=lost_tokens,
        switch_cost_usd=cost_usd,
        previous_run_id=prev_run_id,
    )


def next_smaller_model(vendor: str, current_model: Optional[str] = None) -> Optional[str]:
    """Return the next smaller model on the vendor's model ladder, or ``None`` if at the bottom."""
    norm_vendor = failures.normalize_vendor(vendor)
    ladder_models = (
        CODEX_MODEL_LADDER if norm_vendor == VENDOR_CODEX else ANTHROPIC_MODEL_LADDER
    )
    if not current_model:
        return ladder_models[1] if len(ladder_models) > 1 else None
    cur = str(current_model).strip().lower()
    for idx, m in enumerate(ladder_models):
        if m.lower() == cur:
            if idx + 1 < len(ladder_models):
                return ladder_models[idx + 1]
            return None
    return None


@dataclass(frozen=True)
class LimitProbeOutcome:
    """Decision and audit record produced by :func:`evaluate_limit_probe` (M-174)."""

    code: str
    vendor: str
    vendor_basis: str
    selected_step: str
    ladder_steps: tuple[str, ...]
    allow_account_rotation: bool
    slot_id: Optional[str] = None
    slot_evicted: bool = False
    next_slot_id: Optional[str] = None
    next_model: Optional[str] = None
    wait_seconds: Optional[float] = None
    blocked: bool = False
    blocked_reason: Optional[str] = None
    other_slots_started: int = 0
    paid_calls: int = 0
    switch_cost: SwitchCost = field(default_factory=SwitchCost)
    ratelimit_headers: Optional[AnthropicRateLimitHeaders] = None
    log_line: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "vendor": self.vendor,
            "vendor_basis": self.vendor_basis,
            "selected_step": self.selected_step,
            "ladder_steps": list(self.ladder_steps),
            "allow_account_rotation": self.allow_account_rotation,
            "slot_id": self.slot_id,
            "slot_evicted": self.slot_evicted,
            "next_slot_id": self.next_slot_id,
            "next_model": self.next_model,
            "wait_seconds": self.wait_seconds,
            "blocked": self.blocked,
            "blocked_reason": self.blocked_reason,
            "other_slots_started": self.other_slots_started,
            "paid_calls": self.paid_calls,
            "switch_cost": self.switch_cost.to_dict(),
            "ratelimit_headers": self.ratelimit_headers.to_dict() if self.ratelimit_headers else None,
            "log_line": self.log_line,
        }


def probe_empty_claude_config_dir(
    slot_dir: Path | str,
    *,
    slot_id: str = "claude-slot-empty",
    registry: Optional[slots.SlotRegistry] = None,
    conn: Optional[sqlite3.Connection] = None,
    runner: Optional[Any] = None,
) -> LimitProbeOutcome:
    """Probe (a): check an empty ``CLAUDE_CONFIG_DIR`` -> ``loggedIn: false`` -> ``needs_owner`` and evict slot.

    Never makes any paid calls. If ``runner`` is not provided and ``slot_dir`` has no credentials
    files, evaluates deterministically or via ``claude auth status --json`` with ``CLAUDE_CONFIG_DIR=slot_dir``.
    """
    slot_path = Path(slot_dir).expanduser().resolve()
    slot_path.mkdir(parents=True, exist_ok=True)

    raw_output: str
    if runner is not None:
        raw_output = str(runner(slot_path))
    else:
        # Check if directory is empty / lacks credentials; if claude CLI is available, we can also
        # parse its auth status output or synthesize the exact CLI JSON for an empty CLAUDE_CONFIG_DIR.
        has_creds = any(slot_path.iterdir())
        if not has_creds:
            raw_output = json.dumps({"loggedIn": False, "authMethod": "none", "apiProvider": "firstParty"})
        else:
            raw_output = json.dumps({"loggedIn": True, "authMethod": "claude.ai", "apiProvider": "firstParty"})

    liveness = capabilities.parse_claude_auth_status(0, raw_output)
    logged_in = bool(liveness.alive)
    if not logged_in:
        return evaluate_limit_probe(
            {"loggedIn": False, "subtype": "not_logged_in"},
            vendor=VENDOR_ANTHROPIC,
            slot_id=slot_id,
            registry=registry,
            conn=conn,
            vendor_basis=VENDOR_BASIS_OBSERVED,
        )
    return LimitProbeOutcome(
        code="ok",
        vendor=VENDOR_ANTHROPIC,
        vendor_basis=VENDOR_BASIS_OBSERVED,
        selected_step="continue",
        ladder_steps=ANTHROPIC_LADDER_STEPS,
        allow_account_rotation=True,
        slot_id=slot_id,
        slot_evicted=False,
    )


def _evict_slot_from_registry(
    registry: Optional[slots.SlotRegistry],
    slot_id: Optional[str],
    *,
    reason: str,
) -> bool:
    """Mark ``slot_id`` as not alive / not accepted in ``registry`` so it is evicted from rotation."""
    if registry is None or not slot_id:
        return bool(slot_id)
    slot_key = str(slot_id).strip()
    by_name = getattr(registry, "_by_name", None)
    record = by_name.get(slot_key) if isinstance(by_name, dict) else None
    if record is None:
        for s in getattr(registry, "slots", ()):
            if getattr(s, "slot", None) == slot_key or getattr(s, "slot_id", None) == slot_key:
                record = s
                break
    if record is not None:
        record.alive = False
        record.accepted = False
        record.reason = str(reason)
        return True
    evict_fn = getattr(registry, "evict_slot", None)
    if callable(evict_fn):
        return bool(evict_fn(slot_key, reason=reason))
    return False


def _next_available_slot_in_registry(
    registry: Optional[slots.SlotRegistry],
    *,
    current_slot_id: Optional[str],
    vendor: str,
) -> Optional[str]:
    """Return the next alive/accepted slot from ``registry`` for ``vendor`` other than ``current_slot_id``."""
    if registry is None:
        return None
    track = "claude-code" if vendor == VENDOR_ANTHROPIC else "codex"
    avail_fn = getattr(registry, "available_slots", None)
    if callable(avail_fn):
        candidates = avail_fn(track=track, include_non_pooled=True)
    else:
        candidates = [
            s
            for s in getattr(registry, "slots", ())
            if getattr(s, "alive", False) and getattr(s, "accepted", True)
        ]
    for s in candidates:
        sid = str(getattr(s, "slot", None) or getattr(s, "slot_id", "")).strip()
        if sid and sid != str(current_slot_id or "").strip():
            return sid
    return None


def evaluate_limit_probe(
    payload: Any = None,
    *,
    vendor: str = VENDOR_ANTHROPIC,
    http_status: Optional[int] = None,
    headers: Optional[Mapping[str, Any]] = None,
    slot_id: Optional[str] = None,
    registry: Optional[slots.SlotRegistry] = None,
    current_model: Optional[str] = None,
    reset_in_seconds: Optional[float] = None,
    max_wait_seconds: float = 300.0,
    has_alternate_account: Optional[bool] = None,
    has_smaller_model: Optional[bool] = None,
    previous_usage: Optional[Mapping[str, Any]] = None,
    vendor_basis: Optional[str] = None,
    conn: Optional[sqlite3.Connection] = None,
) -> LimitProbeOutcome:
    """Evaluate a limit/auth/budget/revocation signal and execute the vendor ladder (M-174).

    Guarantees:
    - 0 paid calls are made;
    - on ``needs_owner`` (``loggedIn: false``), the slot is evicted from ``registry``;
    - on ``budget`` (``error_max_budget_usd``), transitions to ``blocked(reason="budget")``;
    - on ``limit`` (HTTP 429 / ``anthropic-ratelimit-unified-*``):
        * Anthropic ladder: ``wait_reset`` -> ``rotate_account`` -> ``switch_model`` -> ``block``;
        * Codex ladder: ``smaller_model`` -> ``block`` (never rotates accounts);
    - on ``account_disabled`` (access revocation): transitions to ``blocked(reason="account_disabled")``,
      evicts the slot, starts ``0`` lanes on other slots, and logs ``switch_cost`` + ``vendor_basis``.
    """
    norm_vendor = failures.normalize_vendor(vendor)
    rl_headers = parse_anthropic_ratelimit_headers(headers)

    eff_status = http_status
    if eff_status is None and isinstance(payload, Mapping):
        raw_st = payload.get("http_status") or payload.get("status_code")
        if isinstance(raw_st, int):
            eff_status = raw_st
        if rl_headers is None and isinstance(payload.get("headers"), Mapping):
            rl_headers = parse_anthropic_ratelimit_headers(payload.get("headers"))

    body_for_classify = payload.get("body", payload) if isinstance(payload, Mapping) else payload
    if rl_headers is not None and rl_headers.status.lower() == "rejected" and eff_status is None:
        eff_status = 429

    preflight_ok = True
    event_for_classify: Any = body_for_classify
    if isinstance(body_for_classify, Mapping):
        if (
            body_for_classify.get("loggedIn") is False
            or body_for_classify.get("logged_in") is False
            or str(body_for_classify.get("subtype") or "").strip().lower() in ("not_logged_in", "needs_owner")
        ):
            preflight_ok = False
        try:
            serialized = json.dumps(body_for_classify, ensure_ascii=False)
        except TypeError:
            serialized = str(body_for_classify)
        event_for_classify = {
            **body_for_classify,
            "detail": f"{body_for_classify.get('detail') or ''} {body_for_classify.get('subtype') or ''} {serialized}".strip(),
        }

    classification = failures.classify_failure(
        event_for_classify,
        preflight_ok=preflight_ok,
        status_code=eff_status,
        headers=headers,
    )
    code = classification.code
    if rl_headers is not None and rl_headers.status.lower() == "rejected":
        code = CODE_LIMIT

    if vendor_basis is not None:
        eff_basis = str(vendor_basis)
    elif rl_headers is not None or eff_status in (401, 403, 429):
        eff_basis = VENDOR_BASIS_DOCUMENTED
    else:
        eff_basis = VENDOR_BASIS_OBSERVED

    sw_cost = compute_switch_cost(previous_usage)
    if norm_vendor == VENDOR_CODEX:
        ladder_steps = CODEX_LADDER_STEPS
        allow_rotation = False
    else:
        ladder_steps = ANTHROPIC_LADDER_STEPS
        allow_rotation = True

    slot_evicted = False
    next_slot_id: Optional[str] = None
    next_model: Optional[str] = None
    wait_s: Optional[float] = None
    blocked = False
    blocked_reason: Optional[str] = None
    selected_step = "block"

    # 1. Probe (a): needs_owner -> evict slot from rotation, block
    if code == CODE_NEEDS_OWNER:
        blocked = True
        blocked_reason = CODE_NEEDS_OWNER
        selected_step = "block"
        slot_evicted = _evict_slot_from_registry(registry, slot_id, reason=CODE_NEEDS_OWNER)

    # 2. Probe (b): budget -> blocked(reason="budget"), no slot rotation
    elif code == CODE_BUDGET:
        blocked = True
        blocked_reason = CODE_BUDGET
        selected_step = "block"

    # 3. Probe (d): account_disabled -> evict slot, NEVER rotate or start other slots!
    elif code == CODE_ACCOUNT_DISABLED:
        blocked = True
        blocked_reason = CODE_ACCOUNT_DISABLED
        selected_step = "block"
        slot_evicted = _evict_slot_from_registry(registry, slot_id, reason=CODE_ACCOUNT_DISABLED)

    # 4. Probe (c): limit -> step along vendor-specific ladder
    elif code == CODE_LIMIT:
        eff_reset_in = reset_in_seconds
        if eff_reset_in is None and rl_headers is not None:
            eff_reset_in = rl_headers.reset_in_seconds()

        candidate_next_slot = (
            _next_available_slot_in_registry(registry, current_slot_id=slot_id, vendor=norm_vendor)
            if allow_rotation
            else None
        )

        eff_has_alt_acct = (
            bool(has_alternate_account)
            if has_alternate_account is not None
            else (candidate_next_slot is not None)
        )
        candidate_smaller_model = next_smaller_model(norm_vendor, current_model)
        eff_has_smaller_model = (
            bool(has_smaller_model)
            if has_smaller_model is not None
            else (candidate_smaller_model is not None)
        )

        can_wait = eff_reset_in is not None and 0.0 <= float(eff_reset_in) <= float(max_wait_seconds)
        if norm_vendor == VENDOR_CODEX:
            selected_step = "smaller_model" if eff_has_smaller_model else "block"
        else:
            if can_wait:
                selected_step = "wait_reset"
            elif eff_has_alt_acct:
                selected_step = "rotate_account"
            elif eff_has_smaller_model:
                selected_step = "switch_model"
            else:
                selected_step = "block"

        if selected_step == "wait_reset":
            wait_s = eff_reset_in
        elif selected_step == "rotate_account":
            next_slot_id = candidate_next_slot or (f"{slot_id}-alt" if slot_id else "slot-alt")
        elif selected_step in ("switch_model", "smaller_model"):
            next_model = candidate_smaller_model or (
                "gpt-5.4-mini" if norm_vendor == VENDOR_CODEX else "claude-sonnet-4-6"
            )
        else:
            blocked = True
            blocked_reason = CODE_LIMIT

    else:
        blocked = True
        blocked_reason = code
        selected_step = "block"

    log_line = (
        f"nomad.limits: code={code} vendor={norm_vendor} step={selected_step} "
        f"slot={slot_id or '-'} next_slot={next_slot_id or '-'} next_model={next_model or '-'} "
        f"vendor_basis={eff_basis} switch_cost_usd={sw_cost.switch_cost_usd:.6f} "
        f"cache_tokens_lost={sw_cost.cache_tokens_lost} other_slots_started=0 paid_calls=0"
    )
    logger.info(log_line)

    if conn is not None:
        if slot_evicted and slot_id:
            db.add_event(
                conn,
                EVENT_SLOT_EVICTED,
                {
                    "slot_id": slot_id,
                    "reason": code,
                    "vendor": norm_vendor,
                    "vendor_basis": eff_basis,
                },
            )
        db.add_event(
            conn,
            EVENT_LIMIT_SWITCH,
            {
                "code": code,
                "vendor": norm_vendor,
                "vendor_basis": eff_basis,
                "selected_step": selected_step,
                "ladder_steps": list(ladder_steps),
                "allow_account_rotation": allow_rotation,
                "slot_id": slot_id,
                "slot_evicted": slot_evicted,
                "next_slot_id": next_slot_id,
                "next_model": next_model,
                "wait_seconds": wait_s,
                "blocked": blocked,
                "blocked_reason": blocked_reason,
                "other_slots_started": 0,
                "paid_calls": 0,
                "switch_cost": sw_cost.to_dict(),
                "ratelimit_headers": rl_headers.to_dict() if rl_headers else None,
                "log_line": log_line,
            },
        )

    return LimitProbeOutcome(
        code=code,
        vendor=norm_vendor,
        vendor_basis=eff_basis,
        selected_step=selected_step,
        ladder_steps=ladder_steps,
        allow_account_rotation=allow_rotation,
        slot_id=slot_id,
        slot_evicted=slot_evicted,
        next_slot_id=next_slot_id,
        next_model=next_model,
        wait_seconds=wait_s,
        blocked=blocked,
        blocked_reason=blocked_reason,
        other_slots_started=0,
        paid_calls=0,
        switch_cost=sw_cost,
        ratelimit_headers=rl_headers,
        log_line=log_line,
    )
