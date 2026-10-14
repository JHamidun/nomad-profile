"""DeepSeek executor lane implementation (M-183 / N21).

Provides:
1. Balance checks against DeepSeek User API (GET https://api.deepseek.com/user/balance).
2. Safety guard ensuring balance is positive, available, and <= budget cap.
3. OpenAI-compatible caller for DeepSeek chat/completions (deepseek-chat, deepseek-reasoner).
4. Direct calculation of token costs according to official pricing and verification against
   Nomad money counter (tolerance <= 10%).
5. Swarm card execution through Nomad money preflight guard and Kanban DB integration.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import urllib.error
import urllib.request
from collections.abc import Mapping, Sequence
from typing import Any, Optional

from .. import db, money

logger = logging.getLogger(__name__)

DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEEPSEEK_BUDGET_CAP_USD = 5.00

# Официальные тарифы DeepSeek за 1M токенов (USD) согласно prices.yaml и api-docs.deepseek.com
OFFICIAL_RATES_PER_M = {
    "deepseek-chat": {
        "input": 0.27,
        "output": 1.10,
        "cache_hit": 0.07,
        "cache_miss": 0.27,
    },
    "deepseek-reasoner": {
        "input": 0.55,
        "output": 2.19,
        "cache_hit": 0.14,
        "cache_miss": 0.55,
    },
}


class DeepSeekError(RuntimeError):
    """Base error for DeepSeek lane operations."""


class DeepSeekBudgetRefused(DeepSeekError):
    """Raised when balance exceeds cap or is depleted."""


def get_deepseek_balance(
    api_key: Optional[str] = None,
    timeout: float = 15.0,
) -> dict[str, Any]:
    """Query DeepSeek user balance from the official endpoint.

    Returns dict with keys:
      - is_available (bool)
      - total_balance_usd (float)
      - raw (dict)
    """
    key = (api_key or os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not key:
        raise DeepSeekError("DEEPSEEK_API_KEY is not configured")

    req = urllib.request.Request(
        DEEPSEEK_BALANCE_URL,
        headers={
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise DeepSeekError(f"DeepSeek balance API HTTP {exc.code}: {err_msg}") from exc
    except Exception as exc:
        raise DeepSeekError(f"DeepSeek balance network error: {exc}") from exc

    is_available = bool(data.get("is_available", False))
    total_balance_usd = 0.0
    for info in data.get("balance_infos", []):
        if info.get("currency") == "USD":
            try:
                total_balance_usd = float(info.get("total_balance", 0.0))
            except (ValueError, TypeError):
                pass

    return {
        "is_available": is_available,
        "total_balance_usd": total_balance_usd,
        "raw": data,
    }


def check_balance_within_budget(
    budget_usd: float = DEEPSEEK_BUDGET_CAP_USD,
    api_key: Optional[str] = None,
) -> tuple[bool, str, dict[str, Any]]:
    """Verify that user balance is active and does not exceed the allowed budget cap.

    Returns (ok, reason_str, balance_info).
    """
    info = get_deepseek_balance(api_key=api_key)
    if not info["is_available"]:
        return False, "DeepSeek balance is marked unavailable", info

    bal = info["total_balance_usd"]
    if bal <= 0.0:
        return False, f"DeepSeek balance is zero or negative ({bal} USD)", info

    if bal > budget_usd:
        return (
            False,
            f"DeepSeek balance ({bal:.2f} USD) exceeds safety budget cap ({budget_usd:.2f} USD); requires owner review",
            info,
        )

    return True, f"Balance {bal:.2f} USD within budget cap {budget_usd:.2f} USD", info


def compute_official_price_usd(
    usage: Mapping[str, Any],
    model: str = DEFAULT_DEEPSEEK_MODEL,
) -> float:
    """Compute exact USD cost based on DeepSeek's published token pricing."""
    rates = OFFICIAL_RATES_PER_M.get(model, OFFICIAL_RATES_PER_M[DEFAULT_DEEPSEEK_MODEL])
    in_tok = int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)
    out_tok = int(usage.get("completion_tokens") or usage.get("output_tokens") or 0)
    c_read = int(
        usage.get("prompt_cache_hit_tokens")
        or usage.get("cache_read_tokens")
        or usage.get("cached_tokens")
        or 0
    )
    c_miss = int(
        usage.get("prompt_cache_miss_tokens")
        or max(0, in_tok - c_read)
    )

    cost = (
        (c_miss / 1_000_000.0) * rates["cache_miss"]
        + (c_read / 1_000_000.0) * rates["cache_hit"]
        + (out_tok / 1_000_000.0) * rates["output"]
    )
    return round(max(0.0, cost), 8)


def verify_counter_reconciliation(
    money_cost_usd: float,
    usage: Mapping[str, Any],
    model: str = DEFAULT_DEEPSEEK_MODEL,
    tolerance_ratio: float = 0.10,
) -> dict[str, Any]:
    """Check that Nomad money.py counter matches published price within tolerance (default <= 10%)."""
    official_usd = compute_official_price_usd(usage, model=model)
    diff_usd = abs(money_cost_usd - official_usd)
    denom = max(official_usd, money_cost_usd, 1e-9)
    rel_diff = diff_usd / denom

    is_reconciled = rel_diff <= tolerance_ratio or diff_usd < 0.00001
    return {
        "reconciled": is_reconciled,
        "money_cost_usd": money_cost_usd,
        "official_cost_usd": official_usd,
        "diff_usd": diff_usd,
        "relative_diff": rel_diff,
        "tolerance_ratio": tolerance_ratio,
    }


def call_deepseek_chat(
    messages: Sequence[Mapping[str, Any]],
    *,
    model: str = DEFAULT_DEEPSEEK_MODEL,
    api_key: Optional[str] = None,
    base_url: str = DEEPSEEK_API_URL,
    temperature: float = 0.2,
    max_tokens: int = 256,
    timeout: float = 30.0,
    thinking: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Execute raw chat completion request to DeepSeek API."""
    key = (api_key or os.environ.get("DEEPSEEK_API_KEY") or "").strip()
    if not key:
        raise DeepSeekError("DEEPSEEK_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": model,
        "messages": list(messages),
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if thinking is not None:
        payload["thinking"] = thinking

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        base_url,
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        err_msg = exc.read().decode("utf-8", errors="replace")
        raise DeepSeekError(f"DeepSeek chat API HTTP {exc.code}: {err_msg}") from exc
    except Exception as exc:
        raise DeepSeekError(f"DeepSeek chat network error: {exc}") from exc


def run_card_task(
    conn: sqlite3.Connection,
    task_id: str,
    prompt: str,
    *,
    swarm_id: Optional[str] = None,
    model: str = DEFAULT_DEEPSEEK_MODEL,
    api_key: Optional[str] = None,
    budget_cap_usd: float = DEEPSEEK_BUDGET_CAP_USD,
    config: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Execute a real Kanban/Swarm card using DeepSeek lane with budget and verification."""
    # 1. Config check: paid_provider_allowlist: [deepseek], ceiling_usd: $5.00
    effective_config = config or {
        "nomad": {
            "money": {
                "ceiling_usd": budget_cap_usd,
                "paid_provider_allowlist": ["deepseek"],
            }
        }
    }

    # 2. Check balance <= cap
    ok, reason, balance_info = check_balance_within_budget(budget_usd=budget_cap_usd, api_key=api_key)
    if not ok:
        raise DeepSeekBudgetRefused(f"DeepSeek balance check failed: {reason}")

    # 3. Execute through Nomad money guard
    def _do_call() -> dict[str, Any]:
        return call_deepseek_chat(
            messages=[{"role": "user", "content": prompt}],
            model=model,
            api_key=api_key,
        )

    res = money.execute_paid_call(
        conn,
        "deepseek",
        _do_call,
        model=model,
        prompt_text=prompt,
        task_id=task_id,
        swarm_id=swarm_id,
        ceiling_usd=budget_cap_usd,
        config=effective_config,
    )

    if not res.get("ok"):
        return {
            "ok": False,
            "status": res.get("status", "blocked"),
            "reason": res.get("reason"),
            "error_code": res.get("error_code"),
            "balance_info": balance_info,
        }

    response = res.get("response", {})
    usage = response.get("usage", {})
    money_cost_usd = float(res.get("actual_usd") or res.get("cost_usd") or 0.0)

    # 4. Reconcile money.py cost with published DeepSeek pricing
    reconciliation = verify_counter_reconciliation(money_cost_usd, usage, model=model)

    choice = (response.get("choices") or [{}])[0]
    message_content = choice.get("message", {}).get("content", "")

    return {
        "ok": True,
        "task_id": task_id,
        "swarm_id": swarm_id,
        "model": model,
        "content": message_content,
        "usage": usage,
        "balance_info": balance_info,
        "cost_usd": money_cost_usd,
        "reconciliation": reconciliation,
    }
