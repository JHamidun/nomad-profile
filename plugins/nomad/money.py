"""Money & budget guard for Nomad swarm lanes: three counters, ceilings, preflight guard, and price list (M-173 / N14, spec §3.3, §5.2).

Инварианты:
1. Три отдельных счётчика в ``data.db``, которые НИКОГДА не складываются между собой:
   - ``tokens_sub`` (int): токены подписных провайдеров (``claude-code``, ``codex``);
   - ``usd`` (float): доллары платных API-провайдеров (``deepseek``, ``gemini``, ``perplexity``,
     ``kimi``, ``yandex``, ``openrouter``);
   - ``weekly_pct`` (float): процент недельного окна подписки [0..100].
2. Единый белый список платных провайдеров с заслонкой M-162: читается ключ
   ``nomad.paid_provider_allowlist`` (через :mod:`.capabilities`). Второго списка нет.
   По умолчанию ``paid_provider_allowlist: []`` — ни один платный провайдер не попадает в каталог.
   При ``paid_provider_allowlist: [deepseek]`` и потолке ``> $0`` (например ``$5``) — ``deepseek``
   присутствует в каталоге.
3. Предполётный гард (``preflight_guard``) ДО отправки запроса оценивает худший случай
   (``worst_case_usd``) по ``prices.yaml`` (вход с коэффициентом запаса без скидки на кэш + полный
   ``max_output_tokens`` + резерв на вспомогательные вызовы ядра без разреза по аккаунту).
   Если потолок ``$0`` или ``spent_usd + reserved_usd + worst_case_usd > ceiling_usd``,
   вызов блокируется со статусом ``blocked(reason="budget")`` и русскоязычным докладом.
4. Запоздалый вспомогательный вызов ядра (``session_search``, компрессор контекста, память)
   не пробивает потолок ``ceiling_usd``.
5. Ошибки провайдера ``credit_balance_exhausted`` и ``organization_spend_limit_exceeded``
   переводят вызов/карточку в ``blocked(reason="budget")``.
"""

# nomad-workaround: PR-3 (docs/upstream-prs.md)
# До появления потолка расходов budget.max_usd в ядре Hermes (PR-3) лимиты и
# расходы в USD/токенах контролируются собственным предполётным гардом preflight_guard.

from __future__ import annotations

import json
import math
import sqlite3
import uuid
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import yaml

from . import capabilities, db, failures, profile_config

PRICES_PATH = Path(__file__).with_name("prices.yaml")

COUNTER_TOKENS_SUB = "tokens_sub"
COUNTER_USD = "usd"
COUNTER_WEEKLY_PCT = "weekly_pct"
COUNTER_NAMES: tuple[str, str, str] = (
    COUNTER_TOKENS_SUB,
    COUNTER_USD,
    COUNTER_WEEKLY_PCT,
)

STATUS_OK = "ok"
STATUS_BLOCKED = "blocked"
REASON_BUDGET = "budget"
ERROR_MISSING_PRICE_IN_PRICES_YAML = "missing_price_in_prices_yaml"
EVENT_BUDGET_BLOCKED = db.EVENT_BUDGET_BLOCKED

BUDGETS_CONFIG_KEY = "budgets"

BUDGET_EXHAUSTED_MARKERS: tuple[str, ...] = (
    "credit_balance_exhausted",
    "organization_spend_limit_exceeded",
    "insufficient_balance",
    "billing_hard_limit_reached",
    "credit balance is too low",
    "spend_limit_reached",
)


class MoneyError(RuntimeError):
    """Base error in the Nomad money/budget subsystem."""


class CounterMixError(MoneyError, TypeError, ValueError):
    """Raised on any attempt to sum or combine heterogeneous counters (tokens_sub, usd, weekly_pct)."""


class BudgetBlockedError(MoneyError):
    """Raised when a call is blocked by the preflight budget guard or provider spend limit."""

    def __init__(self, decision: "BudgetDecision") -> None:
        self.decision = decision
        self.status = decision.status
        self.reason = decision.reason
        self.report = decision.report
        super().__init__(decision.report)


@dataclass(frozen=True)
class CounterValue:
    """Typed single-counter value that refuses arithmetic with any other counter kind."""

    kind: str
    value: int | float

    def __post_init__(self) -> None:
        if self.kind not in COUNTER_NAMES:
            raise ValueError(f"unknown counter kind {self.kind!r}; expected one of {COUNTER_NAMES}")
        if self.kind == COUNTER_TOKENS_SUB:
            object.__setattr__(self, "value", int(self.value))
        else:
            object.__setattr__(self, "value", float(self.value))

    def __add__(self, other: Any) -> "CounterValue":
        if isinstance(other, CounterValue):
            if other.kind != self.kind:
                raise CounterMixError(
                    f"forbidden mix of counters: cannot add {self.kind!r} and {other.kind!r}"
                )
            return CounterValue(self.kind, self.value + other.value)
        if isinstance(other, (int, float)) and not isinstance(other, bool):
            return CounterValue(self.kind, self.value + other)
        raise CounterMixError(f"cannot add {self.kind!r} and {type(other).__name__}")

    def __radd__(self, other: Any) -> "CounterValue":
        if other == 0 and not isinstance(other, bool):
            return self
        return self.__add__(other)


@dataclass(frozen=True)
class ThreeCounters:
    """Snapshot of the three strictly separate counters in ``data.db``."""

    tokens_sub: int
    usd: float
    weekly_pct: float

    @property
    def tokens_sub_counter(self) -> CounterValue:
        return CounterValue(COUNTER_TOKENS_SUB, self.tokens_sub)

    @property
    def usd_counter(self) -> CounterValue:
        return CounterValue(COUNTER_USD, self.usd)

    @property
    def weekly_pct_counter(self) -> CounterValue:
        return CounterValue(COUNTER_WEEKLY_PCT, self.weekly_pct)

    def to_dict(self) -> dict[str, int | float]:
        return {
            COUNTER_TOKENS_SUB: int(self.tokens_sub),
            COUNTER_USD: float(self.usd),
            COUNTER_WEEKLY_PCT: float(self.weekly_pct),
        }


@dataclass(frozen=True)
class ModelPricing:
    """Per-model rates from ``prices.yaml`` (USD per 1M tokens + per-request fee)."""

    provider: str
    model: str
    input_per_m: float
    output_per_m: float
    cache_read_per_m: float
    cache_write_per_m: float
    request_fee_usd: float
    default_max_output_tokens: int
    prompt_safety_factor: float = 1.15
    auxiliary_reserve_ratio: float = 0.15
    auxiliary_min_reserve_usd: float = 0.0020


@dataclass(frozen=True)
class BudgetDecision:
    """Result of a preflight budget check or provider budget error classification."""

    allowed: bool
    status: str
    reason: Optional[str]
    provider: str
    model: str
    ceiling_usd: float
    spent_usd: float
    reserved_usd: float
    worst_case_usd: float
    headroom_usd: float
    report: str
    reservation_id: Optional[str] = None
    error_code: Optional[str] = None

    @property
    def blocked(self) -> bool:
        return not self.allowed or self.status == STATUS_BLOCKED

    @property
    def card_status(self) -> str:
        return self.status

    @property
    def block_kind(self) -> Optional[str]:
        return "limit" if self.blocked else None

    @property
    def message(self) -> str:
        return self.report

    def to_dict(self) -> dict[str, Any]:
        return {
            "ok": self.allowed,
            "allowed": self.allowed,
            "blocked": self.blocked,
            "status": self.status,
            "card_status": self.status,
            "block_kind": self.block_kind,
            "state": self.status,
            "reason": self.reason,
            "provider": self.provider,
            "model": self.model,
            "ceiling_usd": self.ceiling_usd,
            "spent_usd": self.spent_usd,
            "reserved_usd": self.reserved_usd,
            "worst_case_usd": self.worst_case_usd,
            "headroom_usd": self.headroom_usd,
            "report": self.report,
            "message": self.report,
            "reservation_id": self.reservation_id,
            "error_code": self.error_code,
        }

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.to_dict().get(key, default)

    def __contains__(self, key: object) -> bool:
        return key in self.to_dict()


# ---------------------------------------------------------------------------
# Price list (prices.yaml) & cost calculation
# ---------------------------------------------------------------------------

def load_prices(path: Optional[Path] = None) -> dict[str, Any]:
    """Load and validate ``package/plugins/nomad/prices.yaml``."""
    target = Path(path) if path is not None else PRICES_PATH
    raw = yaml.safe_load(target.read_text(encoding="utf-8"))
    if not isinstance(raw, dict) or not isinstance(raw.get("providers"), dict):
        raise MoneyError(f"invalid prices file at {target}")
    return raw


def normalize_paid_provider(provider: str) -> str:
    raw = str(provider or "").strip().lower()
    if raw.startswith("custom:"):
        raw = raw.split(":", 1)[1].strip()
    if raw in ("zhipu", "zai", "z.ai", "z-ai", "zhipuai"):
        return "glm"
    if ":" in raw:
        raw = raw.split(":", 1)[0].strip()
    if raw in ("zhipu", "zai", "z.ai", "z-ai", "zhipuai"):
        return "glm"
    return raw


def _providers_catalog_map(catalog: Mapping[str, Any]) -> Mapping[str, Any]:
    nested = catalog.get("providers")
    if isinstance(nested, Mapping):
        return nested
    return catalog


def has_verified_pricing(
    provider: str,
    *,
    prices: Optional[Mapping[str, Any]] = None,
) -> bool:
    """Return ``True`` only when ``provider`` has an entry in ``prices.yaml`` with a positive-priced
    model and (for GLM or when ``source`` / ``source_url`` is present) a non-empty source (M-185 / M-192)."""
    catalog = dict(prices) if prices is not None else load_prices()
    prov_key = normalize_paid_provider(provider)
    providers_map = _providers_catalog_map(catalog)
    if not isinstance(providers_map, Mapping):
        return False
    prov_entry = providers_map.get(prov_key)
    if not isinstance(prov_entry, Mapping):
        return False
    has_source_key = "source" in prov_entry or "source_url" in prov_entry
    if prov_key == "glm" or has_source_key:
        source = str(prov_entry.get("source") or prov_entry.get("source_url") or "").strip()
        if not source:
            return False
    models_map = prov_entry.get("models")
    if not isinstance(models_map, Mapping) or not models_map:
        return False
    for m_entry in models_map.values():
        if not isinstance(m_entry, Mapping):
            continue
        has_in = "input_per_m" in m_entry or "input_per_1m_usd" in m_entry
        has_out = "output_per_m" in m_entry or "output_per_1m_usd" in m_entry
        if not (has_in and has_out):
            continue
        try:
            in_val = float(m_entry.get("input_per_m", m_entry.get("input_per_1m_usd", 0.0)))
            out_val = float(m_entry.get("output_per_m", m_entry.get("output_per_1m_usd", 0.0)))
        except (TypeError, ValueError):
            continue
        if in_val > 0.0 or out_val > 0.0:
            return True
    return False


def openrouter_commission_usd(
    credit_amount_usd: float,
    *,
    prices: Optional[Mapping[str, Any]] = None,
) -> float:
    """Compute OpenRouter top-up commission (5.5% with $0.80 minimum) from ``prices.yaml`` (M-192)."""
    if credit_amount_usd <= 0.0:
        return 0.0
    catalog = dict(prices) if prices is not None else load_prices()
    providers_map = _providers_catalog_map(catalog)
    or_entry = providers_map.get("openrouter") if isinstance(providers_map, Mapping) else None
    pct = float(or_entry.get("commission_pct", 5.5)) if isinstance(or_entry, Mapping) else 5.5
    min_fee = float(or_entry.get("min_commission_usd", 0.80)) if isinstance(or_entry, Mapping) else 0.80
    return round(max(min_fee, float(credit_amount_usd) * (pct / 100.0)), 6)


def glm_free_stub(prompt: str = "", *, model: str = "glm-free-stub") -> dict[str, Any]:
    """Free local stub for the GLM lane while ``prices.yaml`` has no verified price with source (M-185)."""
    return {
        "ok": True,
        "id": "glm-stub-0",
        "provider": "glm",
        "model": model,
        "billing": capabilities.FREE,
        "status": "stub",
        "stub": True,
        "cost_usd": 0.0,
        "content": f"[GLM free stub: no paid call until verified price in prices.yaml] {prompt}".strip(),
        "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
    }


def get_model_pricing(
    provider: str,
    model: Optional[str] = None,
    *,
    prices: Optional[Mapping[str, Any]] = None,
) -> ModelPricing:
    """Resolve :class:`ModelPricing` for ``(provider, model)`` from ``prices.yaml``."""
    catalog = dict(prices) if prices is not None else load_prices()
    defaults = catalog.get("defaults") if isinstance(catalog.get("defaults"), Mapping) else {}
    safety_factor = float(defaults.get("prompt_safety_factor", 1.15))
    default_max_out = int(defaults.get("default_max_output_tokens", 4096))
    aux_ratio = float(defaults.get("auxiliary_reserve_ratio", 0.15))
    aux_min = float(defaults.get("auxiliary_min_reserve_usd", 0.0020))

    prov_key = normalize_paid_provider(provider)
    providers_map = _providers_catalog_map(catalog)
    prov_entry = providers_map.get(prov_key) if isinstance(providers_map, Mapping) else None
    if not isinstance(prov_entry, Mapping):
        prov_entry = (providers_map.get("openrouter") if isinstance(providers_map, Mapping) else None) or {}

    models_map = prov_entry.get("models") if isinstance(prov_entry.get("models"), Mapping) else {}
    default_model_name = str(prov_entry.get("default_model") or "default")
    req_model = str(model or "").strip() or default_model_name

    model_entry = models_map.get(req_model)
    if not isinstance(model_entry, Mapping):
        # Try case-insensitive or suffix match (e.g. "deepseek/deepseek-chat" -> "deepseek-chat")
        short_model = req_model.split("/")[-1] if "/" in req_model else req_model
        model_entry = models_map.get(short_model) or models_map.get(default_model_name)
    if not isinstance(model_entry, Mapping) and models_map:
        first_key = next(iter(models_map))
        model_entry = models_map[first_key]
    if not isinstance(model_entry, Mapping):
        model_entry = {
            "input_per_m": 3.0,
            "output_per_m": 15.0,
            "cache_read_per_m": 3.0,
            "cache_write_per_m": 3.0,
            "request_fee_usd": 0.0,
            "default_max_output_tokens": default_max_out,
        }

    in_rate = float(model_entry.get("input_per_m", model_entry.get("input_per_1m_usd", 0.0)))
    out_rate = float(model_entry.get("output_per_m", model_entry.get("output_per_1m_usd", 0.0)))
    c_read_rate = float(model_entry.get("cache_read_per_m", in_rate))
    c_write_rate = float(model_entry.get("cache_write_per_m", in_rate))
    req_fee = float(model_entry.get("request_fee_usd", 0.0))
    mod_max_out = int(model_entry.get("default_max_output_tokens", default_max_out))

    return ModelPricing(
        provider=prov_key,
        model=req_model,
        input_per_m=in_rate,
        output_per_m=out_rate,
        cache_read_per_m=c_read_rate,
        cache_write_per_m=c_write_rate,
        request_fee_usd=req_fee,
        default_max_output_tokens=mod_max_out,
        prompt_safety_factor=safety_factor,
        auxiliary_reserve_ratio=aux_ratio,
        auxiliary_min_reserve_usd=aux_min,
    )


def _estimate_prompt_tokens(
    prompt_tokens: Optional[int] = None,
    prompt_text: Optional[str] = None,
    messages: Optional[ Any ] = None,
) -> int:
    if prompt_tokens is not None and not isinstance(prompt_tokens, bool) and int(prompt_tokens) > 0:
        return int(prompt_tokens)
    text_parts: list[str] = []
    if prompt_text:
        text_parts.append(str(prompt_text))
    if isinstance(messages, (list, tuple)):
        for msg in messages:
            if isinstance(msg, Mapping):
                text_parts.append(str(msg.get("content") or ""))
            else:
                text_parts.append(str(msg))
    joined = "\n".join(text_parts)
    if not joined:
        return 512
    # Консервативная оценка: 1 токен ~ 2.5 символа + базовый системный каркас 256 токенов
    return max(256, int(math.ceil(len(joined) / 2.5)) + 256)


def estimate_worst_case_usd(
    provider: str,
    model: Optional[str] = None,
    *,
    prompt_tokens: Optional[int] = None,
    prompt_text: Optional[str] = None,
    messages: Optional[Any] = None,
    max_output_tokens: Optional[int] = None,
    include_auxiliary_reserve: bool = True,
    is_auxiliary: bool = False,
    prices: Optional[Mapping[str, Any]] = None,
) -> float:
    """Compute an upper-bound cost in USD BEFORE sending a request (spec §3.3).

    Guarantees ``worst_case_usd >= actual_usd`` for any response within ``max_output_tokens``:
    - input tokens are multiplied by ``prompt_safety_factor`` and priced at full ``input_per_m``
      (never assuming cache hits);
    - output tokens are priced at full ``max_output_tokens`` (or ``default_max_output_tokens``)
      at ``output_per_m``;
    - adds an auxiliary reserve for unattributed core helper calls unless ``is_auxiliary=True``.
    """
    pricing = get_model_pricing(provider, model, prices=prices)
    base_in_tokens = _estimate_prompt_tokens(
        prompt_tokens=prompt_tokens,
        prompt_text=prompt_text,
        messages=messages,
    )
    worst_in_tokens = int(math.ceil(base_in_tokens * max(1.0, pricing.prompt_safety_factor)))
    worst_out_tokens = (
        int(max_output_tokens)
        if max_output_tokens is not None and not isinstance(max_output_tokens, bool) and int(max_output_tokens) > 0
        else pricing.default_max_output_tokens
    )

    in_cost = (worst_in_tokens / 1_000_000.0) * pricing.input_per_m
    out_cost = (worst_out_tokens / 1_000_000.0) * pricing.output_per_m
    base_cost = in_cost + out_cost + pricing.request_fee_usd

    if include_auxiliary_reserve and not is_auxiliary:
        aux_reserve = max(
            base_cost * pricing.auxiliary_reserve_ratio,
            pricing.auxiliary_min_reserve_usd,
        )
        total = base_cost + aux_reserve
    else:
        total = base_cost

    return round(total, 8)


def compute_actual_usd(
    provider: str,
    model: Optional[str] = None,
    *,
    usage: Optional[Mapping[str, Any]] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
    reasoning_tokens: int = 0,
    prices: Optional[Mapping[str, Any]] = None,
) -> float:
    """Compute actual USD cost from provider ``usage`` and ``prices.yaml``."""
    pricing = get_model_pricing(provider, model, prices=prices)
    if isinstance(usage, Mapping):
        in_tok = int(usage.get("input_tokens") or usage.get("prompt_tokens") or input_tokens or 0)
        out_tok = int(
            usage.get("output_tokens") or usage.get("completion_tokens") or output_tokens or 0
        )
        c_read = int(
            usage.get("cache_read_tokens")
            or usage.get("prompt_cache_hit_tokens")
            or usage.get("cached_tokens")
            or cache_read_tokens
            or 0
        )
        c_write = int(
            usage.get("cache_write_tokens")
            or usage.get("cache_creation_input_tokens")
            or cache_write_tokens
            or 0
        )
        reas_tok = int(usage.get("reasoning_tokens") or reasoning_tokens or 0)
    else:
        in_tok = int(input_tokens or 0)
        out_tok = int(output_tokens or 0)
        c_read = int(cache_read_tokens or 0)
        c_write = int(cache_write_tokens or 0)
        reas_tok = int(reasoning_tokens or 0)

    uncached_in = max(0, in_tok - c_read - c_write)
    billable_out = max(0, out_tok) + max(0, reas_tok)

    cost = (
        (uncached_in / 1_000_000.0) * pricing.input_per_m
        + (max(0, c_read) / 1_000_000.0) * pricing.cache_read_per_m
        + (max(0, c_write) / 1_000_000.0) * pricing.cache_write_per_m
        + (billable_out / 1_000_000.0) * pricing.output_per_m
        + pricing.request_fee_usd
    )
    return round(max(0.0, cost), 8)


# ---------------------------------------------------------------------------
# Three counters API (never summing tokens_sub, usd, and weekly_pct)
# ---------------------------------------------------------------------------

def sum_same_counter(values: list[CounterValue], *, kind: str) -> CounterValue:
    """Sum a sequence of :class:`CounterValue` instances, raising :class:`CounterMixError` on mismatch."""
    acc = CounterValue(kind, 0 if kind == COUNTER_TOKENS_SUB else 0.0)
    for item in values:
        acc = acc + item
    return acc


def get_tokens_sub(
    conn: sqlite3.Connection,
    *,
    provider: Optional[str] = None,
    account: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    task_id: Optional[str] = None,
    since: Optional[str] = None,
) -> int:
    """Return Counter 1 (``tokens_sub``): subscription tokens only."""
    return db.query_tokens_sub(
        conn,
        provider=provider,
        account=account,
        goal_id=goal_id,
        swarm_id=swarm_id,
        task_id=task_id,
        since=since,
    )


def get_usd_spent(
    conn: sqlite3.Connection,
    *,
    provider: Optional[str] = None,
    account: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    task_id: Optional[str] = None,
    since: Optional[str] = None,
    include_reserved: bool = False,
) -> float:
    """Return Counter 2 (``usd``): paid API USD spend only."""
    return db.query_usd_spent(
        conn,
        provider=provider,
        account=account,
        goal_id=goal_id,
        swarm_id=swarm_id,
        task_id=task_id,
        since=since,
        include_reserved=include_reserved,
    )


def get_weekly_pct(
    conn: sqlite3.Connection,
    *,
    provider: Optional[str] = None,
    account: Optional[str] = None,
) -> float:
    """Return Counter 3 (``weekly_pct``): weekly subscription percentage [0..100] only."""
    return db.query_weekly_pct(conn, provider=provider, account=account)


def set_weekly_pct(
    conn: sqlite3.Connection,
    provider: str,
    weekly_pct: float,
    *,
    account: str = "default",
) -> dict:
    """Update Counter 3 (``weekly_pct``) in ``weekly_quota_snapshots``."""
    return db.record_weekly_pct(conn, provider, weekly_pct, account=account)


def get_three_counters(
    conn: sqlite3.Connection,
    *,
    provider: Optional[str] = None,
    account: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    task_id: Optional[str] = None,
    since: Optional[str] = None,
    include_reserved: bool = False,
) -> ThreeCounters:
    """Read all three counters into a :class:`ThreeCounters` structure via separate queries."""
    tokens_sub = get_tokens_sub(
        conn,
        provider=provider,
        account=account,
        goal_id=goal_id,
        swarm_id=swarm_id,
        task_id=task_id,
        since=since,
    )
    usd = get_usd_spent(
        conn,
        provider=provider,
        account=account,
        goal_id=goal_id,
        swarm_id=swarm_id,
        task_id=task_id,
        since=since,
        include_reserved=include_reserved,
    )
    weekly_pct = get_weekly_pct(conn, provider=provider, account=account)
    return ThreeCounters(tokens_sub=tokens_sub, usd=usd, weekly_pct=weekly_pct)


current_spend_usd = get_usd_spent


# ---------------------------------------------------------------------------
# Paid allowlist (shared with M-162) & provider catalog
# ---------------------------------------------------------------------------

def read_paid_allowlist(
    config: Optional[Mapping[str, Any]] = None,
    *,
    config_path: Optional[Path] = None,
) -> list[str]:
    """Read ``nomad.paid_provider_allowlist`` using the exact same helper as M-162 (:mod:`.capabilities`)."""
    if config is not None:
        items = list(capabilities.paid_allowlist_from(config))
        if not items and isinstance(config, Mapping):
            nomad_sec = config.get(capabilities.CONFIG_SECTION)
            if isinstance(nomad_sec, Mapping):
                money_sec = nomad_sec.get("money")
                if isinstance(money_sec, Mapping):
                    raw_list = money_sec.get("paid_provider_allowlist")
                    if isinstance(raw_list, (list, tuple, set)):
                        items = [str(x).strip().lower() for x in raw_list if str(x).strip()]
        return items
    if config_path is not None:
        try:
            loaded = profile_config.load(config_path)
        except profile_config.ConfigUnreadable:
            return []
        return list(capabilities.paid_allowlist_from(loaded))
    return list(capabilities.read_paid_allowlist())


def read_budget_ceilings_usd(
    config: Optional[Mapping[str, Any]] = None,
    *,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
) -> dict[str, float]:
    """Read per-provider USD ceilings from ``nomad.budgets`` (defaulting to ``0.0`` for all paid providers)."""
    result: dict[str, float] = {prov: 0.0 for prov in sorted(db.PAID_PROVIDERS)}
    result.setdefault("glm", 0.0)
    cfg_data: Mapping[str, Any] = {}
    if config is not None:
        cfg_data = config
    else:
        try:
            loaded = profile_config.load(config_path)
            if isinstance(loaded, Mapping):
                cfg_data = loaded
        except profile_config.ConfigUnreadable:
            cfg_data = {}

    nomad_sec = cfg_data.get(capabilities.CONFIG_SECTION)
    if isinstance(nomad_sec, Mapping):
        money_sec = nomad_sec.get("money")
        if isinstance(money_sec, Mapping):
            shared_ceiling = money_sec.get("ceiling_usd")
            if shared_ceiling is not None and not isinstance(shared_ceiling, bool):
                try:
                    c_val = max(0.0, float(shared_ceiling))
                    for p in list(result.keys()):
                        result[p] = c_val
                    for p in read_paid_allowlist(cfg_data):
                        result[normalize_paid_provider(p)] = c_val
                except (TypeError, ValueError):
                    pass
        raw_budgets = nomad_sec.get(BUDGETS_CONFIG_KEY)
        if isinstance(raw_budgets, Mapping):
            for prov, val in raw_budgets.items():
                if val is not None and not isinstance(val, bool):
                    try:
                        result[str(prov).strip().lower()] = max(0.0, float(val))
                    except (TypeError, ValueError):
                        pass

    if isinstance(ceilings_usd, Mapping):
        for prov, val in ceilings_usd.items():
            if val is not None and not isinstance(val, bool):
                try:
                    result[str(prov).strip().lower()] = max(0.0, float(val))
                except (TypeError, ValueError):
                    pass

    return result


def get_provider_ceiling_usd(
    provider: str,
    *,
    config: Optional[Mapping[str, Any]] = None,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    ceiling_usd: Optional[float] = None,
) -> float:
    """Resolve the USD ceiling for ``provider`` (defaults to ``0.0``)."""
    if ceiling_usd is not None and not isinstance(ceiling_usd, bool):
        return max(0.0, float(ceiling_usd))
    prov_key = str(provider or "").strip().lower()
    ceilings = read_budget_ceilings_usd(
        config,
        config_path=config_path,
        ceilings_usd=ceilings_usd,
    )
    return float(ceilings.get(prov_key, 0.0))


def available_paid_providers(
    config: Optional[Mapping[str, Any]] = None,
    *,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    prices: Optional[Mapping[str, Any]] = None,
) -> dict[str, dict[str, Any]]:
    """Return catalog of enabled paid providers (must be in ``nomad.paid_provider_allowlist`` AND have ceiling > $0).

    - Default ``nomad.paid_provider_allowlist: []`` -> returns ``{}`` (DeepSeek is NOT in catalog).
    - ``paid_provider_allowlist: ["deepseek"]`` with ceiling ``$0`` -> DeepSeek is NOT in catalog.
    - ``paid_provider_allowlist: ["deepseek"]`` with ceiling ``$5`` -> DeepSeek IS in catalog.
    """
    allowlist = set(read_paid_allowlist(config, config_path=config_path))
    ceilings = read_budget_ceilings_usd(
        config,
        config_path=config_path,
        ceilings_usd=ceilings_usd,
    )
    price_data = dict(prices) if prices is not None else load_prices()
    providers_meta = _providers_catalog_map(price_data)

    catalog: dict[str, dict[str, Any]] = {}
    for prov in sorted(allowlist):
        prov_key = normalize_paid_provider(prov)
        ceiling_val = float(ceilings.get(prov_key, ceilings.get(str(prov).strip().lower(), 0.0)))
        if ceiling_val <= 0.0:
            continue
        if not has_verified_pricing(prov_key, prices=price_data):
            continue
        p_meta = providers_meta.get(prov_key) if isinstance(providers_meta, Mapping) else {}
        default_model = (
            str(p_meta.get("default_model"))
            if isinstance(p_meta, Mapping) and p_meta.get("default_model")
            else "default"
        )
        catalog[prov_key] = {
            "provider": prov_key,
            "billing": capabilities.METERED,
            "ceiling_usd": ceiling_val,
            "default_model": default_model,
            "models": sorted((p_meta.get("models") or {}).keys()) if isinstance(p_meta, Mapping) else [],
        }
    return catalog


def build_catalog(
    config: Optional[Mapping[str, Any]] = None,
    *,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    subscription_lanes: tuple[str, ...] = ("claude-code", "codex"),
) -> dict[str, dict[str, Any]]:
    """Build combined lane catalog: subscription lanes + allowed paid providers with ceiling > $0."""
    result: dict[str, dict[str, Any]] = {}
    for sub in subscription_lanes:
        result[sub] = {
            "provider": sub,
            "billing": capabilities.SUBSCRIPTION,
        }
    paid = available_paid_providers(
        config,
        config_path=config_path,
        ceilings_usd=ceilings_usd,
    )
    result.update(paid)
    return result


# ---------------------------------------------------------------------------
# Provider error classification (credit_balance_exhausted / organization_spend_limit_exceeded)
# ---------------------------------------------------------------------------

def _extract_error_text_and_code(error_or_payload: Any) -> tuple[str, Optional[str]]:
    if error_or_payload is None:
        return "", None
    if isinstance(error_or_payload, BaseException):
        code_attr = getattr(error_or_payload, "code", None) or getattr(
            error_or_payload, "error_code", None
        )
        return str(error_or_payload), str(code_attr) if code_attr else None
    if isinstance(error_or_payload, Mapping):
        err_obj = error_or_payload.get("error")
        code = error_or_payload.get("code") or error_or_payload.get("type")
        msg_parts = [
            str(error_or_payload.get("message") or ""),
            str(error_or_payload.get("detail") or ""),
        ]
        if isinstance(err_obj, Mapping):
            code = code or err_obj.get("code") or err_obj.get("type")
            msg_parts.append(str(err_obj.get("message") or ""))
            msg_parts.append(str(err_obj.get("code") or ""))
            msg_parts.append(str(err_obj.get("type") or ""))
        elif err_obj is not None:
            msg_parts.append(str(err_obj))
        try:
            msg_parts.append(json.dumps(error_or_payload, ensure_ascii=False))
        except TypeError:
            pass
        return " ".join(p for p in msg_parts if p), str(code) if code else None
    return str(error_or_payload), None


def detect_budget_error_code(error_or_payload: Any) -> Optional[str]:
    """Return the matched budget error code if ``error_or_payload`` signals exhausted credit/spend limit."""
    text, explicit_code = _extract_error_text_and_code(error_or_payload)
    haystack = f"{explicit_code or ''} {text}".lower()
    for marker in BUDGET_EXHAUSTED_MARKERS:
        if marker in haystack:
            return marker
    return None


def classify_provider_error(
    error_or_payload: Any,
    *,
    provider: str = "deepseek",
    model: str = "",
    conn: Optional[sqlite3.Connection] = None,
    ceiling_usd: float = 0.0,
    task_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    reservation_id: Optional[str] = None,
) -> Optional[BudgetDecision]:
    """Convert ``credit_balance_exhausted`` / ``organization_spend_limit_exceeded`` into ``blocked(reason="budget")``."""
    matched_code = detect_budget_error_code(error_or_payload)
    if matched_code is None:
        return None

    prov = str(provider or "deepseek").strip().lower()
    spent = get_usd_spent(conn, provider=prov) if conn is not None else 0.0
    if conn is not None and reservation_id:
        db.release_budget_reservation(conn, reservation_id)
    reserved = (
        db.query_usd_spent(conn, provider=prov, include_reserved=True) - spent
        if conn is not None
        else 0.0
    )

    report = (
        f"Дорожка {prov} переведена в blocked(reason=\"budget\"): "
        f"провайдер вернул отказ по балансу/лимиту ({matched_code}). "
        f"Потрачено ${spent:.4f}, потолок ${ceiling_usd:.2f}."
    )
    decision = BudgetDecision(
        allowed=False,
        status=STATUS_BLOCKED,
        reason=REASON_BUDGET,
        provider=prov,
        model=str(model or ""),
        ceiling_usd=float(ceiling_usd),
        spent_usd=spent,
        reserved_usd=max(0.0, reserved),
        worst_case_usd=0.0,
        headroom_usd=0.0,
        report=report,
        reservation_id=reservation_id,
        error_code=matched_code,
    )
    if conn is not None:
        db.add_event(
            conn,
            db.EVENT_BUDGET_BLOCKED,
            {
                "provider": prov,
                "model": str(model or ""),
                "task_id": task_id,
                "reason": REASON_BUDGET,
                "status": STATUS_BLOCKED,
                "card_status": STATUS_BLOCKED,
                "error_code": matched_code,
                "ceiling_usd": float(ceiling_usd),
                "spent_usd": spent,
                "report": report,
            },
            swarm_id=swarm_id,
        )
    return decision


# ---------------------------------------------------------------------------
# Preflight budget guard & execution wrapper
# ---------------------------------------------------------------------------

def preflight_guard(
    conn_or_provider: sqlite3.Connection | str,
    provider_or_model: Optional[str] = None,
    model: Optional[str] = None,
    *,
    conn: Optional[sqlite3.Connection] = None,
    prompt_tokens: Optional[int] = None,
    prompt_text: Optional[str] = None,
    messages: Optional[Any] = None,
    max_output_tokens: Optional[int] = None,
    ceiling_usd: Optional[float] = None,
    config: Optional[Mapping[str, Any]] = None,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    is_auxiliary: bool = False,
    reserve: bool = True,
    task_id: Optional[str] = None,
    run_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    prices: Optional[Mapping[str, Any]] = None,
) -> BudgetDecision:
    """Preflight budget guard before sending any paid API request (spec §3.3, M-173, M-185).

    - Verifies that ``provider`` has a confirmed price with ``source`` / ``source_url`` in
      ``prices.yaml`` (M-185: without a price in ``prices.yaml``, paid launch of GLM routes to
      ``blocked(reason="budget")``).
    - Checks the provider ceiling (``$0`` by default).
    - Estimates ``worst_case_usd`` from ``prices.yaml``.
    - Verifies ``spent_usd + reserved_usd + worst_case_usd <= ceiling_usd``.
    - On failure, returns ``BudgetDecision(allowed=False, status="blocked", reason="budget", report=...)``
      and records ``budget_blocked`` in ``data.db``.
    - On success (when ``reserve=True``), creates a ``held`` row in ``budget_reservations`` so
      concurrent or late auxiliary calls cannot breach the ceiling.
    """
    if isinstance(conn_or_provider, str):
        actual_conn = conn
        provider = conn_or_provider
        req_model_arg = model if model is not None else provider_or_model
    else:
        actual_conn = conn_or_provider
        provider = str(provider_or_model or "")
        req_model_arg = model

    prov = normalize_paid_provider(provider)
    effective_ceiling = get_provider_ceiling_usd(
        prov,
        config=config,
        config_path=config_path,
        ceilings_usd=ceilings_usd,
        ceiling_usd=ceiling_usd,
    )
    spent_usd = get_usd_spent(actual_conn, provider=prov, include_reserved=False) if actual_conn is not None else 0.0
    total_committed = get_usd_spent(actual_conn, provider=prov, include_reserved=True) if actual_conn is not None else 0.0
    reserved_usd = max(0.0, round(total_committed - spent_usd, 8))

    if not has_verified_pricing(prov, prices=prices):
        req_model = str(req_model_arg or f"{prov}-stub").strip()
        report = (
            f"Дорожка {prov} ({req_model}) остановлена — blocked(reason=\"budget\"): "
            f"в prices.yaml отсутствует подтверждённая цена с источником для провайдера {prov!r} "
            f"(до M-192 платный запуск запрещён, дорожка работает только как бесплатная заглушка)."
        )
        decision = BudgetDecision(
            allowed=False,
            status=STATUS_BLOCKED,
            reason=REASON_BUDGET,
            provider=prov,
            model=req_model,
            ceiling_usd=effective_ceiling,
            spent_usd=spent_usd,
            reserved_usd=reserved_usd,
            worst_case_usd=0.0,
            headroom_usd=0.0,
            report=report,
            reservation_id=None,
            error_code=ERROR_MISSING_PRICE_IN_PRICES_YAML,
        )
        if actual_conn is not None:
            db.add_event(
                actual_conn,
                db.EVENT_BUDGET_BLOCKED,
                {
                    "provider": prov,
                    "model": req_model,
                    "task_id": task_id,
                    "run_id": run_id,
                    "is_auxiliary": is_auxiliary,
                    "reason": REASON_BUDGET,
                    "status": STATUS_BLOCKED,
                    "card_status": STATUS_BLOCKED,
                    "error_code": ERROR_MISSING_PRICE_IN_PRICES_YAML,
                    "ceiling_usd": effective_ceiling,
                    "spent_usd": spent_usd,
                    "reserved_usd": reserved_usd,
                    "worst_case_usd": 0.0,
                    "headroom_usd": 0.0,
                    "report": report,
                },
                swarm_id=swarm_id,
            )
        return decision

    pricing = get_model_pricing(prov, req_model_arg, prices=prices)
    effective_model = pricing.model

    worst_case_usd = estimate_worst_case_usd(
        prov,
        effective_model,
        prompt_tokens=prompt_tokens,
        prompt_text=prompt_text,
        messages=messages,
        max_output_tokens=max_output_tokens,
        include_auxiliary_reserve=not is_auxiliary,
        is_auxiliary=is_auxiliary,
        prices=prices,
    )
    headroom_usd = max(0.0, round(effective_ceiling - total_committed, 8))

    if effective_ceiling <= 0.0 or (total_committed + worst_case_usd) > effective_ceiling + 1e-12:
        kind_label = "вспомогательный вызов" if is_auxiliary else "вызов"
        report = (
            f"Дорожка {prov} ({effective_model}) остановлена — blocked(reason=\"budget\"): "
            f"{kind_label} не отправлен, так как потолок бюджета ${effective_ceiling:.4f} "
            f"не вмещает прогноз худшего случая ${worst_case_usd:.6f} "
            f"(уже потрачено ${spent_usd:.6f}, в резерве ${reserved_usd:.6f}, "
            f"доступный остаток ${headroom_usd:.6f})."
        )
        decision = BudgetDecision(
            allowed=False,
            status=STATUS_BLOCKED,
            reason=REASON_BUDGET,
            provider=prov,
            model=effective_model,
            ceiling_usd=effective_ceiling,
            spent_usd=spent_usd,
            reserved_usd=reserved_usd,
            worst_case_usd=worst_case_usd,
            headroom_usd=headroom_usd,
            report=report,
            reservation_id=None,
        )
        if actual_conn is not None:
            db.add_event(
                actual_conn,
                db.EVENT_BUDGET_BLOCKED,
                {
                    "provider": prov,
                    "model": effective_model,
                    "task_id": task_id,
                    "run_id": run_id,
                    "is_auxiliary": is_auxiliary,
                    "reason": REASON_BUDGET,
                    "status": STATUS_BLOCKED,
                    "card_status": STATUS_BLOCKED,
                    "ceiling_usd": effective_ceiling,
                    "spent_usd": spent_usd,
                    "reserved_usd": reserved_usd,
                    "worst_case_usd": worst_case_usd,
                    "headroom_usd": headroom_usd,
                    "report": report,
                },
                swarm_id=swarm_id,
            )
        return decision

    reservation_id: Optional[str] = None
    if reserve and actual_conn is not None:
        res_row = db.create_budget_reservation(
            actual_conn,
            provider=prov,
            model=effective_model,
            reserved_usd=worst_case_usd,
            task_id=task_id,
            run_id=run_id,
            is_auxiliary=is_auxiliary,
        )
        reservation_id = str(res_row["reservation_id"])
        reserved_usd = round(reserved_usd + worst_case_usd, 8)
        headroom_usd = max(0.0, round(effective_ceiling - spent_usd - reserved_usd, 8))

    report = (
        f"Предполётный гард {prov} ({effective_model}): разрешено "
        f"(прогноз худшего случая ${worst_case_usd:.6f} <= остаток потолка ${effective_ceiling:.4f})."
    )
    return BudgetDecision(
        allowed=True,
        status=STATUS_OK,
        reason=None,
        provider=prov,
        model=effective_model,
        ceiling_usd=effective_ceiling,
        spent_usd=spent_usd,
        reserved_usd=reserved_usd,
        worst_case_usd=worst_case_usd,
        headroom_usd=headroom_usd,
        report=report,
        reservation_id=reservation_id,
    )


def settle_call_usage(
    conn: sqlite3.Connection,
    *,
    provider: str,
    model: Optional[str] = None,
    usage: Optional[Mapping[str, Any]] = None,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cache_read_tokens: int = 0,
    cache_write_tokens: int = 0,
    reasoning_tokens: int = 0,
    reservation_id: Optional[str] = None,
    api_request_id: Optional[str] = None,
    account: str = "",
    task_id: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    lane: Optional[str] = None,
    is_auxiliary: bool = False,
    ceiling_usd: Optional[float] = None,
    config: Optional[Mapping[str, Any]] = None,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    prices: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Record actual usage in ``usage_events`` and settle the preflight reservation.

    For late/unattributed auxiliary calls (``is_auxiliary=True`` or ``account == ''`` without a
    prior ``reservation_id``), enforces the provider ceiling so a late auxiliary call never
    pushes total spend above ``ceiling_usd``.
    """
    prov = str(provider or "").strip().lower()
    pricing = get_model_pricing(prov, model, prices=prices)
    actual_usd = compute_actual_usd(
        prov,
        pricing.model,
        usage=usage,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cache_read_tokens=cache_read_tokens,
        cache_write_tokens=cache_write_tokens,
        reasoning_tokens=reasoning_tokens,
        prices=prices,
    )

    if isinstance(usage, Mapping):
        in_tok = int(usage.get("input_tokens") or usage.get("prompt_tokens") or input_tokens or 0)
        out_tok = int(
            usage.get("output_tokens") or usage.get("completion_tokens") or output_tokens or 0
        )
        c_read = int(
            usage.get("cache_read_tokens")
            or usage.get("prompt_cache_hit_tokens")
            or usage.get("cached_tokens")
            or cache_read_tokens
            or 0
        )
        c_write = int(
            usage.get("cache_write_tokens")
            or usage.get("cache_creation_input_tokens")
            or cache_write_tokens
            or 0
        )
        reas_tok = int(usage.get("reasoning_tokens") or reasoning_tokens or 0)
    else:
        in_tok = int(input_tokens or 0)
        out_tok = int(output_tokens or 0)
        c_read = int(cache_read_tokens or 0)
        c_write = int(cache_write_tokens or 0)
        reas_tok = int(reasoning_tokens or 0)

    # Check ceiling before committing an unreserved late auxiliary call
    if reservation_id is None and (
        is_auxiliary or ceiling_usd is not None or config is not None or ceilings_usd is not None
    ):
        effective_ceiling = get_provider_ceiling_usd(
            prov,
            config=config,
            config_path=config_path,
            ceilings_usd=ceilings_usd,
            ceiling_usd=ceiling_usd,
        )
        current_committed = get_usd_spent(conn, provider=prov, include_reserved=True)
        if effective_ceiling <= 0.0 or (current_committed + actual_usd) > effective_ceiling + 1e-12:
            report = (
                f"Запоздалый вспомогательный вызов {prov} ({pricing.model}) остановлен — "
                f"blocked(reason=\"budget\"): стоимость ${actual_usd:.6f} пробила бы потолок "
                f"${effective_ceiling:.4f} (уже учтено ${current_committed:.6f})."
            )
            db.add_event(
                conn,
                db.EVENT_BUDGET_BLOCKED,
                {
                    "provider": prov,
                    "model": pricing.model,
                    "task_id": task_id,
                    "is_auxiliary": True,
                    "reason": REASON_BUDGET,
                    "status": STATUS_BLOCKED,
                    "card_status": STATUS_BLOCKED,
                    "ceiling_usd": effective_ceiling,
                    "spent_usd": current_committed,
                    "attempted_usd": actual_usd,
                    "report": report,
                },
                swarm_id=swarm_id,
            )
            return {
                "ok": False,
                "allowed": False,
                "blocked": True,
                "status": STATUS_BLOCKED,
                "card_status": STATUS_BLOCKED,
                "reason": REASON_BUDGET,
                "actual_usd": 0.0,
                "attempted_usd": actual_usd,
                "ceiling_usd": effective_ceiling,
                "spent_usd": get_usd_spent(conn, provider=prov, include_reserved=False),
                "report": report,
            }

    if reservation_id is not None:
        db.settle_budget_reservation(conn, reservation_id, actual_usd=actual_usd)

    req_id = str(api_request_id).strip() if api_request_id else f"req-{uuid.uuid4().hex[:16]}"
    db.record_usage(
        conn,
        api_request_id=req_id,
        account=str(account or ("auxiliary" if is_auxiliary else "")),
        provider=prov,
        model=pricing.model,
        task_id=task_id,
        goal_id=goal_id,
        swarm_id=swarm_id,
        lane=lane or prov,
        billing=capabilities.METERED,
        input_tokens=in_tok,
        output_tokens=out_tok,
        cache_read_tokens=c_read,
        cache_write_tokens=c_write,
        reasoning_tokens=reas_tok,
        cost_usd=actual_usd,
    )
    return {
        "ok": True,
        "allowed": True,
        "blocked": False,
        "status": STATUS_OK,
        "card_status": STATUS_OK,
        "reason": None,
        "api_request_id": req_id,
        "reservation_id": reservation_id,
        "actual_usd": actual_usd,
        "spent_usd": get_usd_spent(conn, provider=prov, include_reserved=False),
    }


def execute_paid_call(
    conn_or_provider: sqlite3.Connection | str,
    provider_or_call_fn: str | Callable[[], Mapping[str, Any]],
    call_fn: Optional[Callable[[], Mapping[str, Any]]] = None,
    *,
    conn: Optional[sqlite3.Connection] = None,
    model: Optional[str] = None,
    prompt_tokens: Optional[int] = None,
    prompt_text: Optional[str] = None,
    messages: Optional[Any] = None,
    max_output_tokens: Optional[int] = None,
    ceiling_usd: Optional[float] = None,
    config: Optional[Mapping[str, Any]] = None,
    config_path: Optional[Path] = None,
    ceilings_usd: Optional[Mapping[str, float]] = None,
    is_auxiliary: bool = False,
    account: str = "",
    task_id: Optional[str] = None,
    run_id: Optional[str] = None,
    goal_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    prices: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Run ``preflight_guard`` -> ``call_fn()`` -> ``settle_call_usage``, handling provider budget errors."""
    if isinstance(conn_or_provider, str):
        actual_conn = conn
        provider = conn_or_provider
        actual_call_fn = provider_or_call_fn  # type: ignore[assignment]
    else:
        actual_conn = conn_or_provider
        provider = str(provider_or_call_fn)
        actual_call_fn = call_fn  # type: ignore[assignment]

    preflight = preflight_guard(
        actual_conn,  # type: ignore[arg-type]
        provider,
        model,
        prompt_tokens=prompt_tokens,
        prompt_text=prompt_text,
        messages=messages,
        max_output_tokens=max_output_tokens,
        ceiling_usd=ceiling_usd,
        config=config,
        config_path=config_path,
        ceilings_usd=ceilings_usd,
        is_auxiliary=is_auxiliary,
        reserve=True,
        task_id=task_id,
        run_id=run_id,
        swarm_id=swarm_id,
        prices=prices,
    )
    if preflight.blocked:
        return preflight.to_dict()

    try:
        response = actual_call_fn()
    except BaseException as exc:
        err_decision = classify_provider_error(
            exc,
            provider=provider,
            model=preflight.model,
            conn=actual_conn,
            ceiling_usd=preflight.ceiling_usd,
            task_id=task_id,
            swarm_id=swarm_id,
            reservation_id=preflight.reservation_id,
        )
        if err_decision is not None:
            return err_decision.to_dict()
        if preflight.reservation_id and actual_conn is not None:
            db.release_budget_reservation(actual_conn, preflight.reservation_id)
        raise

    if isinstance(response, Mapping):
        err_decision = classify_provider_error(
            response,
            provider=provider,
            model=preflight.model,
            conn=actual_conn,
            ceiling_usd=preflight.ceiling_usd,
            task_id=task_id,
            swarm_id=swarm_id,
            reservation_id=preflight.reservation_id,
        )
        if err_decision is not None:
            return err_decision.to_dict()

    usage = response.get("usage") if isinstance(response, Mapping) else None
    req_id = response.get("id") if isinstance(response, Mapping) else None
    if actual_conn is None:
        return {
            "ok": True,
            "allowed": True,
            "blocked": False,
            "status": STATUS_OK,
            "card_status": STATUS_OK,
            "reason": None,
            "worst_case_usd": preflight.worst_case_usd,
            "ceiling_usd": preflight.ceiling_usd,
            "response": response,
        }
    settled = settle_call_usage(
        actual_conn,
        provider=provider,
        model=preflight.model,
        usage=usage,
        reservation_id=preflight.reservation_id,
        api_request_id=str(req_id) if req_id else None,
        account=account,
        task_id=task_id,
        goal_id=goal_id,
        swarm_id=swarm_id,
        is_auxiliary=is_auxiliary,
        ceiling_usd=preflight.ceiling_usd,
        prices=prices,
    )
    return {
        **settled,
        "worst_case_usd": preflight.worst_case_usd,
        "ceiling_usd": preflight.ceiling_usd,
        "response": response,
    }
