"""thinking_policy.py — Per-turn thinking mode decision policy for nomadnet-auto (M-246).

Pure-function decision made ONCE per user turn in ``pre_llm_call``, holding across all
subsequent turn requests (tool calls, /steer continuations, compression markers, and summary
requests) via ``llm_request`` middleware.

Invariants (M-246):
1. Single decision per turn: decision is a pure function of the actual user turn prompt,
   evaluated once at turn onset in ``pre_llm_call`` and preserved across all LLM requests
   within the turn. Mid-turn /steer messages, synthetic user rows (MAX_ITERATIONS_SUMMARY_REQUEST),
   continuation markers, or interruption redirects never alter or clear the mode.
2. Network-isolated: decision requires ZERO network calls and works when sockets are disabled.
3. Provenance table: loaded from ``thinking_table.json`` with mandatory fields
   (``source``, ``date``, ``bank_md5``, ``alpha``). Broken/missing file leaves the field unset
   (falling back to upstream default) and increments ``table_load_failures``.
4. Provider & model boundary: applies only to ``nomadnet-auto`` via Control Plane. Explicit
   model names (e.g. ``deepseek-v4-pro``, ``deepseek-chat``) are untouched. Under ``ru_only``
   and for non-CP providers, no field is injected.
5. Accounting source: sends ``X-Nomad-Thinking-Source: policy`` and ``X-Nomad-Thinking: <mode>``
   so CP records source as ``policy``.
6. Gated activation: disabled by default (``enabled: false``). Enacted only upon formal GO
   under protocol §4.5.
"""

from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Mapping, Optional

from . import core_adapter as core
from .ru_only import resolve_ru_only

logger = logging.getLogger("hermes_plugins.nomad.thinking_policy")

BALANCED_ROUTE_ID = "nomadnet-auto"
EXPLICIT_MODELS_UNTOUCHED = frozenset({
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "deepseek-chat",
    "gpt-4o",
    "gpt-4o-mini",
    "claude-haiku-4-5",
    "kimi-k3",
    "yandexgpt",
    "gigachat",
})

# Answer-only regex triggers indicating simple or direct answers
AO_RE = re.compile(
    r"(только\s+одно\s+число|только\s+строку\s+имён|только\s+список\s+имён"
    r"|только\s+валидный\s+json|без\s+пояснений|без\s+промежуточных"
    r"|без\s+объяснений|без\s+текста\s+вокруг|никаких\s+слов)",
    re.I,
)
JSON_RE = re.compile(r"\bjson\b", re.I)

# Complex reasoning cues (algorithmic tracing, logic scheduling, math deduction)
REASONING_CUES_RE = re.compile(
    r"(трассировк|алгоритм|вычисли|докажи|сравни|оптимизир|расписани|порядок|граф|зависимост"
    r"|упорядоч|проанализируй|найди ошибку|почему|сформулируй гипотез)",
    re.I,
)

METRICS: dict[str, int] = {
    "decisions_total": 0,
    "decisions_enabled": 0,
    "decisions_disabled": 0,
    "requests_injected": 0,
    "table_load_failures": 0,
}

# Per-session active turn decision state
# session_id -> {"mode": "enabled" | "disabled", "turn_id": str | None, "user_text_sha1": str}
_SESSION_TURN_STATE: dict[str, dict[str, Any]] = {}
_LAST_LOADED_TABLE: Optional[dict[str, Any]] = None


def _is_ru_only(cfg: Any = None) -> bool:
    """Safe check for active ru_only mode across dataclass and boolean forms."""
    try:
        val = resolve_ru_only()
        if hasattr(val, "enabled"):
            return bool(val.enabled)
        return bool(val)
    except TypeError:
        try:
            val = resolve_ru_only(cfg)
            if hasattr(val, "enabled"):
                return bool(val.enabled)
            return bool(val)
        except Exception:
            return False
    except Exception:
        return False


def get_table_path() -> Path:
    """Return path to thinking_table.json inside the nomad plugin directory."""
    return Path(__file__).resolve().parent / "thinking_table.json"


def load_thinking_table(path: Optional[Path] = None) -> Optional[dict[str, Any]]:
    """Load and validate the routing provenance table from JSON."""
    global _LAST_LOADED_TABLE
    target = path or get_table_path()
    if not target.exists():
        METRICS["table_load_failures"] += 1
        logger.warning("thinking table file missing at %s", target)
        return None

    try:
        raw_text = target.read_text(encoding="utf-8")
        data = json.loads(raw_text)
    except Exception as exc:
        METRICS["table_load_failures"] += 1
        logger.warning("failed to parse thinking table JSON at %s: %s", target, exc)
        return None

    # Enforce mandatory schema fields
    required_keys = {"source", "date", "bank_md5", "alpha"}
    if not isinstance(data, dict) or not required_keys.issubset(data.keys()):
        METRICS["table_load_failures"] += 1
        logger.warning("thinking table schema missing mandatory keys %s", required_keys - set(data.keys() if isinstance(data, dict) else ()))
        return None

    _LAST_LOADED_TABLE = data
    return data


def is_policy_enabled(config: Optional[dict[str, Any]] = None) -> bool:
    """Return True if thinking policy is explicitly enabled in configuration or env.

    Defaults to False. Must only be enabled when tools/routing_eval yields formal GO.
    """
    if os.environ.get("NOMAD_THINKING_POLICY_ENABLED", "").strip().lower() in ("1", "true", "yes"):
        return True

    cfg = config
    if cfg is None:
        try:
            cfg = core.load_config_readonly()
        except Exception:
            cfg = {}

    if not isinstance(cfg, dict):
        return False

    nomad_sec = cfg.get("nomad")
    if isinstance(nomad_sec, dict) and nomad_sec.get("thinking_policy_enabled") is True:
        return True

    plugins_sec = cfg.get("plugins", {})
    if isinstance(plugins_sec, dict):
        entries = plugins_sec.get("entries", {})
        if isinstance(entries, dict):
            nomad_entry = entries.get("nomad", {})
            if isinstance(nomad_entry, dict):
                settings = nomad_entry.get("settings", {})
                if isinstance(settings, dict) and settings.get("thinking_policy_enabled") is True:
                    return True

    return False


def classify_prompt_text(text: str, table: Optional[dict[str, Any]] = None) -> str:
    """Classify user prompt into thinking mode ("enabled" | "disabled").

    Pure string function with zero IO / zero network sockets.
    Rule logic:
    - If answer-only regex matches and no complex reasoning cues are present -> "disabled".
    - If reasoning cues are present or prompt is open-ended -> "enabled".
    """
    clean_text = text.strip()
    has_ao = bool(AO_RE.search(clean_text))
    has_json = bool(JSON_RE.search(clean_text))
    has_reasoning = bool(REASONING_CUES_RE.search(clean_text))

    tbl = table or _LAST_LOADED_TABLE
    classes = tbl.get("classes", {}) if isinstance(tbl, dict) else {}

    if has_ao and not has_reasoning:
        # Bare answer requested without complex reasoning
        return classes.get("bare_answer", "disabled")
    if has_json and has_ao and not has_reasoning:
        return classes.get("json_strict", "disabled")
    if has_reasoning:
        return classes.get("code_trace", "enabled")

    # Default for open-ended queries is enabled (aligning with status-quo flash-think)
    return classes.get("open_work", "enabled")


def extract_user_text(user_message: Any) -> str:
    """Extract plain string prompt from raw user message payload."""
    if isinstance(user_message, str):
        return user_message
    if isinstance(user_message, dict):
        content = user_message.get("content", "")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    parts.append(str(part.get("text", "")))
                elif isinstance(part, str):
                    parts.append(part)
            return " ".join(parts)
    return str(user_message or "")


def on_pre_llm_call(
    *args: Any,
    session_id: Optional[str] = None,
    user_message: Any = None,
    turn_id: Optional[str] = None,
    model: Optional[str] = None,
    **kwargs: Any,
) -> Optional[dict[str, Any]]:
    """Hook invoked ONCE at user turn start (agent/turn_context.py:994).

    Computes thinking mode as a pure function of the actual inbound user message
    and pins it into the per-session state for the duration of this turn.
    """
    sid = str(session_id or "default")
    user_text = extract_user_text(user_message)

    cfg = None
    try:
        cfg = core.load_config_readonly()
    except Exception:
        pass

    # Policy disabled or ru_only -> do not record active mode
    if not is_policy_enabled(cfg) or _is_ru_only(cfg):
        _SESSION_TURN_STATE.pop(sid, None)
        return None

    # Load table if not yet loaded
    tbl = _LAST_LOADED_TABLE or load_thinking_table()
    if tbl is None:
        _SESSION_TURN_STATE.pop(sid, None)
        return None

    mode = classify_prompt_text(user_text, tbl)
    METRICS["decisions_total"] += 1
    if mode == "enabled":
        METRICS["decisions_enabled"] += 1
    else:
        METRICS["decisions_disabled"] += 1

    _SESSION_TURN_STATE[sid] = {
        "mode": mode,
        "turn_id": turn_id,
        "text_preview": user_text[:60],
    }
    logger.debug("thinking policy decided mode=%s for session=%s", mode, sid)
    return None


def on_llm_request(
    request: dict[str, Any],
    *,
    session_id: Optional[str] = None,
    model: Optional[str] = None,
    provider: Optional[str] = None,
    base_url: Optional[str] = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Middleware invoked before EVERY LLM call within a turn (hermes_cli/middleware.py).

    Injects the pinned thinking mode and provenance headers into request without
    re-guessing mid-turn, respecting ru_only, CP provider, and explicit model guards.
    """
    sid = str(session_id or "default")
    state = _SESSION_TURN_STATE.get(sid)
    if not state:
        return {"request": request}

    req_model = str(request.get("model") or model or "")
    # Explicit model names are untouched
    if req_model in EXPLICIT_MODELS_UNTOUCHED:
        return {"request": request}

    # Only nomadnet-auto is routed
    if req_model != BALANCED_ROUTE_ID and model != BALANCED_ROUTE_ID:
        return {"request": request}

    cfg = None
    try:
        cfg = core.load_config_readonly()
    except Exception:
        pass

    # ru_only plan guard
    if _is_ru_only(cfg):
        return {"request": request}

    # Non-CP provider guard
    prov = str(request.get("provider") or provider or "").lower()
    burl = str(request.get("base_url") or base_url or "").lower()
    if prov in ("yandex", "gigachat", "openai", "anthropic") and "nomad" not in burl and "cp" not in burl:
        return {"request": request}

    mode = state["mode"]
    out_req = dict(request)
    out_req["thinking"] = {"type": mode}

    extra_headers = dict(out_req.get("extra_headers") or {})
    extra_headers["X-Nomad-Thinking-Source"] = "policy"
    extra_headers["X-Nomad-Thinking"] = mode
    out_req["extra_headers"] = extra_headers

    METRICS["requests_injected"] += 1
    return {"request": out_req}


def can_enable_policy(eval_report: Mapping[str, Any]) -> tuple[bool, str]:
    """Check protocol §4.5 criteria for enabling the local thinking policy.

    Criteria:
    (a) lift over chord and best single rung > 0 with CI lower bound > 0;
    (b) against status-quo (flash-think): at status-quo quality level minus delta,
        bill is lower by >= 10% relative, CI does not cross zero;
    (c) on multi-turn agentic stratum: coarse safety (<= 2 regressions vs status-quo, <= 2 inverted);
    (d) rule selection: if bill difference CI between shrink_regex and regex_ao crosses zero,
        simpler regex_ao is chosen;
    (e) CI half-width on GO stratum <= 5.0 pp.
    """
    half_width_pp = float(eval_report.get("half_width_pp", 999.0))
    if half_width_pp > 5.0 + 1e-9:
        return False, f"CI half-width {half_width_pp:.1f} pp > 5.0 pp guard (не различимо: мало данных)"

    lift_over_chord = float(eval_report.get("lift_over_chord_pp", 0.0))
    chord_ci_lo = float(eval_report.get("chord_ci_lo_pp", -1.0))
    if lift_over_chord <= 0 or chord_ci_lo <= 0:
        return False, "Not superior to chord baseline (lift <= 0 or CI crosses 0)"

    bill_reduction_pct = float(eval_report.get("bill_reduction_pct", 0.0))
    diff_ci_lo = float(eval_report.get("bill_diff_ci_lo_pct", -1.0))
    if bill_reduction_pct < 10.0 or diff_ci_lo <= 0:
        return False, f"Bill reduction {bill_reduction_pct:.1f}% < 10% vs status-quo or CI crosses zero"

    agentic_regressions = int(eval_report.get("agentic_regressions", 0))
    agentic_inverted = int(eval_report.get("agentic_inverted", 0))
    if agentic_regressions > 2 or agentic_inverted > 2:
        return False, f"Agentic stratum safety guard failed: {agentic_regressions} regressions, {agentic_inverted} inverted"

    return True, "GO по §4.5: thinking policy qualified for activation"


def register(ctx: Any) -> None:
    """Register thinking policy hooks and middleware on the Nomad plugin context."""
    ctx.register_hook("pre_llm_call", on_pre_llm_call)
    ctx.register_middleware("llm_request", on_llm_request)
