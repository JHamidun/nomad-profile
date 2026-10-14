"""Four-track router, slot integration, cross-family judge guard, and manual task pinning (M-164 / N7).

Четыре дорожки (tracks) роутера:

1. ``claude-code`` (``cc``, ``cc-1..cc-7``) — архитектура, планирование, ревью, судья, синтез;
2. ``codex`` (``codex-1``) — точные патчи (``patch``), диффы, багфиксы, код;
3. ``paid_api`` (``deepseek``, ``gemini``, ``kimi``, ``yandex``, ``perplexity``) — платные API
   из ``nomad.paid_provider_allowlist``;
4. ``tool`` — детерминированные шаги без вызова модели (``build``, ``test``, ``compile``, ``script``).

Ручной пин (``pin_task`` / ``hermes nomad swarm pin <task_id> <lane>``) переопределяет дорожку,
провайдера, модель и тариф карточки, но отклоняется в четырёх случаях:

1. Целевая дорожка/слот мертва (``alive=False``);
2. Нарушено перекрёстное правило семьи модели у судьи (судья того же вендора/семьи, что и автор);
3. Платный провайдер не входит в ``nomad.paid_provider_allowlist``;
4. Включён контур ``nomad.ru_only=True``, а запрошена зарубежная дорожка/провайдер.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping, Optional

from . import capabilities, core_adapter, db, pool_mode, routing, ru_only, slots

TRACK_CLAUDE = "claude-code"
TRACK_CODEX = "codex"
TRACK_PAID_API = "paid_api"
TRACK_TOOL = "tool"

FOUR_TRACKS: tuple[str, ...] = (
    TRACK_CLAUDE,
    TRACK_CODEX,
    TRACK_PAID_API,
    TRACK_TOOL,
)

REASON_LANE_NOT_ALIVE = "lane_not_alive"
REASON_JUDGE_SAME_FAMILY = "judge_same_family"
REASON_PAID_NOT_WHITELISTED = "paid_provider_not_whitelisted"
REASON_RU_ONLY_VIOLATION = "ru_only_foreign_lane"
REASON_POOL_MODE_SHIPPED = "pool_mode_shipped"
REASON_NO_ELIGIBLE_LANE = "no_eligible_lane"

_TOOL_KINDS: frozenset[str] = frozenset({
    "tool",
    "build",
    "deterministic_step",
    "deterministic",
    "test",
    "compile",
    "script",
    "check",
    "lint",
    "format",
    "ci",
    "сборка",
    "тест",
    "скрипт",
    "проверка",
})

_PATCH_KINDS: frozenset[str] = frozenset({
    "patch",
    "precise_patch",
    "code",
    "diff",
    "bugfix",
    "fix",
    "implement",
    "refactor",
    "патч",
    "код",
    "багфикс",
    "исправление",
})

_CLAUDE_KINDS: frozenset[str] = frozenset({
    "architecture",
    "architecture_and_synthesis",
    "synthesis",
    "plan",
    "planning",
    "review",
    "judge",
    "verifier",
    "design",
    "архитектура",
    "план",
    "ревью",
    "судья",
    "синтез",
})

_PAID_API_KINDS: frozenset[str] = frozenset({
    "bulk_search",
    "search",
    "research",
    "crawl",
    "paid_api",
    "api",
    "поиск",
    "ресёрч",
})

_JUDGE_ROLES: frozenset[str] = frozenset({
    "judge",
    "verifier",
    "reviewer",
    "review",
    "critic",
    "судья",
    "проверяющий",
    "ревьюер",
})

_PAID_LANE_VENDORS: dict[str, str] = {
    "deepseek": "deepseek",
    "gemini": "google",
    "google": "google",
    "kimi": "moonshot",
    "moonshot": "moonshot",
    "perplexity": "perplexity",
    "yandex": "yandex",
    "custom:yandex": "yandex",
    "openrouter": "openrouter",
    "paid_api": "deepseek",
    "api": "deepseek",
}

_PAID_LANE_MODELS: dict[str, tuple[str, str]] = {
    "deepseek": ("deepseek", "deepseek-reasoner"),
    "gemini": ("gemini", "gemini-2.5-pro"),
    "google": ("gemini", "gemini-2.5-pro"),
    "kimi": ("kimi", "kimi-k2"),
    "moonshot": ("kimi", "kimi-k2"),
    "perplexity": ("perplexity", "sonar-pro"),
    "yandex": ("custom:yandex", "yandexgpt"),
    "custom:yandex": ("custom:yandex", "yandexgpt"),
    "paid_api": ("deepseek", "deepseek-reasoner"),
    "api": ("deepseek", "deepseek-reasoner"),
}


class PinRefusedError(ValueError, RuntimeError):
    """Raised when ``pin_task`` rejects a manual lane pin (M-164)."""

    def __init__(
        self,
        task_id: str,
        lane: str,
        reason: str,
        message: Optional[str] = None,
        *,
        detail: Optional[dict[str, Any]] = None,
    ) -> None:
        self.task_id = str(task_id)
        self.lane = str(lane)
        self.reason = str(reason)
        self.detail = dict(detail or {})
        text = message or f"cannot pin task {self.task_id!r} to lane {self.lane!r}: {self.reason}"
        super().__init__(text)


class CrossFamilyPinError(PinRefusedError):
    """Raised when pinning a judge/reviewer violates the cross-family model rule."""


class RuOnlyPinError(PinRefusedError, ru_only.RuOnlyRefused):
    """Raised when pinning or routing violates ``nomad.ru_only=True``."""

    def __init__(
        self,
        task_id: str,
        lane: str,
        violation: ru_only.RuOnlyRefused,
    ) -> None:
        ru_only.RuOnlyRefused.__init__(
            self,
            action=violation.action,
            target=violation.target,
            reason=violation.reason,
            host=violation.host,
            ru_only=violation.ru_only,
        )
        PinRefusedError.__init__(
            self,
            task_id=task_id,
            lane=lane,
            reason=REASON_RU_ONLY_VIOLATION,
            message=str(violation),
            detail={
                "ru_only_reason": violation.reason,
                "host": violation.host,
                "provider": violation.target.provider,
            },
        )
        self.reason = REASON_RU_ONLY_VIOLATION
        self.ru_reason = violation.reason


def _check_ru_lane(
    lane_id: str,
    provider: str,
    model: str,
    *,
    base_url: Optional[str] = None,
    config: Optional[Mapping[str, Any]] = None,
    ru_only_enabled: Optional[bool] = None,
) -> ru_only.RuOnly:
    """Validate ``(lane_id, provider, model, base_url)`` through ``ru_only.require_ru_lane``."""
    target = ru_only.LaneTarget(
        lane_id=str(lane_id or ""),
        provider=str(provider or lane_id or ""),
        base_url=base_url,
        model=str(model or "") or None,
    )
    env_override: Optional[dict[str, str]] = None
    if ru_only_enabled is True:
        env_override = {ru_only.ENV_LOCK: "1"}
    elif isinstance(config, Mapping):
        nomad_sec = config.get("nomad")
        if isinstance(nomad_sec, Mapping) and nomad_sec.get("ru_only") is True:
            env_override = {ru_only.ENV_LOCK: "1"}
    return ru_only.require_ru_lane(
        ru_only.ACTION_START_LANE,
        target,
        env=env_override,
    )


def resolve_vendor_family(
    lane_or_provider: Optional[str],
    *,
    vendor: Optional[str] = None,
    model: Optional[str] = None,
) -> str:
    """Normalize a lane, provider, vendor, or model identifier into its canonical model family."""
    for candidate in (vendor, lane_or_provider, model):
        if not candidate or not isinstance(candidate, str):
            continue
        slug = candidate.strip().lower()
        if not slug:
            continue
        if slug in ("anthropic", "claude", "claude-code", "cc") or slug.startswith(("cc-", "claude-")):
            return "anthropic"
        if (
            slug in ("openai", "codex", "openai-codex")
            or slug.startswith(("codex-", "gpt-", "o1", "o3", "o4"))
        ):
            return "openai"
        if slug in ("deepseek",) or slug.startswith("deepseek"):
            return "deepseek"
        if slug in ("google", "gemini") or slug.startswith("gemini"):
            return "google"
        if slug in ("moonshot", "kimi") or slug.startswith(("kimi", "moonshot")):
            return "moonshot"
        if slug in ("yandex", "custom:yandex") or "yandex" in slug:
            return "yandex"
        if slug in ("perplexity",) or slug.startswith("sonar"):
            return "perplexity"
        if slug in ("tool", "local"):
            return "local"
    if lane_or_provider and str(lane_or_provider).strip():
        return str(lane_or_provider).strip().lower()
    return "unknown"


def resolve_track_for_lane(lane: str, *, billing: Optional[str] = None) -> str:
    """Map a concrete lane or slot name onto one of the 4 canonical tracks."""
    slug = str(lane or "").strip().lower()
    if slug in ("tool", "local", "build", "deterministic_step"):
        return TRACK_TOOL
    if slug in ("claude", "claude-code", "cc") or slug.startswith(("cc-", "claude-")):
        return TRACK_CLAUDE
    if slug in ("codex", "openai-codex") or slug.startswith("codex-"):
        return TRACK_CODEX
    if slug in _PAID_LANE_VENDORS or billing in ("paid", capabilities.METERED):
        return TRACK_PAID_API
    return TRACK_CLAUDE


def resolve_lane_defaults(lane: str, catalog_row: Optional[Mapping[str, Any]] = None) -> dict[str, str]:
    """Return ``(track, vendor, billing, provider_override, model_override)`` for ``lane``."""
    row = dict(catalog_row or {})
    slug = str(lane or "").strip()
    lower = slug.lower()

    if lower in ("tool", "build", "deterministic_step"):
        return {
            "lane": TRACK_TOOL,
            "track": TRACK_TOOL,
            "vendor": "local",
            "billing": capabilities.FREE,
            "provider_override": TRACK_TOOL,
            "model_override": "",
        }

    billing = str(row.get("billing") or "").strip()
    vendor = str(row.get("vendor") or "").strip()

    if lower in ("claude", "claude-code", "cc") or lower.startswith(("cc-", "claude-")):
        provider, model = routing.LANE_MODELS["claude-code"]
        return {
            "lane": "claude-code" if lower in ("claude", "cc") else slug,
            "track": TRACK_CLAUDE,
            "vendor": vendor or "anthropic",
            "billing": billing or capabilities.SUBSCRIPTION,
            "provider_override": provider,
            "model_override": model,
        }

    if lower in ("codex", "openai-codex") or lower.startswith("codex-"):
        provider, model = routing.LANE_MODELS["codex"]
        return {
            "lane": "codex" if lower == "openai-codex" else slug,
            "track": TRACK_CODEX,
            "vendor": vendor or "openai",
            "billing": billing or capabilities.SUBSCRIPTION,
            "provider_override": provider,
            "model_override": model,
        }

    if lower in _PAID_LANE_MODELS or billing in ("paid", capabilities.METERED):
        base_paid = "yandex" if lower == "custom:yandex" else lower
        provider, model = routing.LANE_MODELS.get(
            base_paid, _PAID_LANE_MODELS.get(lower, (slug, f"{slug}-default"))
        )
        return {
            "lane": slug,
            "track": TRACK_PAID_API,
            "vendor": vendor or _PAID_LANE_VENDORS.get(lower, lower),
            "billing": billing or capabilities.METERED,
            "provider_override": provider,
            "model_override": model,
        }

    resolved_vendor = resolve_vendor_family(slug, vendor=vendor)
    track = resolve_track_for_lane(slug, billing=billing)
    provider, model = routing.LANE_MODELS.get(track, (slug, ""))
    return {
        "lane": slug,
        "track": track,
        "vendor": resolved_vendor,
        "billing": billing or capabilities.SUBSCRIPTION,
        "provider_override": provider,
        "model_override": model,
    }


def classify_track(task_or_kind: Any) -> str:
    """Classify a task descriptor or kind string onto one of the 4 tracks:
    ``claude-code``, ``codex``, ``paid_api``, or ``tool``.

    Specifically guarantees:
    - ``"patch"`` -> ``"codex"``
    - ``"build"`` -> ``"tool"``
    """
    if isinstance(task_or_kind, str):
        token = task_or_kind.strip().lower()
        if token in _TOOL_KINDS:
            return TRACK_TOOL
        if token in _PATCH_KINDS:
            return TRACK_CODEX
        if token in _CLAUDE_KINDS:
            return TRACK_CLAUDE
        if token in _PAID_API_KINDS or token in _PAID_LANE_VENDORS:
            return TRACK_PAID_API
        # Check substring keywords
        for word in _TOOL_KINDS:
            if word in token:
                return TRACK_TOOL
        for word in _PATCH_KINDS:
            if word in token:
                return TRACK_CODEX
        for word in _PAID_API_KINDS:
            if word in token:
                return TRACK_PAID_API
        return TRACK_CLAUDE

    if isinstance(task_or_kind, Mapping):
        for key in ("track", "kind", "work_class", "type", "step_kind", "category"):
            val = task_or_kind.get(key)
            if isinstance(val, str) and val.strip():
                t = val.strip().lower()
                if t in FOUR_TRACKS:
                    return t
                if t in _TOOL_KINDS:
                    return TRACK_TOOL
                if t in _PATCH_KINDS:
                    return TRACK_CODEX
                if t in _CLAUDE_KINDS:
                    return TRACK_CLAUDE
                if t in _PAID_API_KINDS or t in _PAID_LANE_VENDORS:
                    return TRACK_PAID_API

        role_val = str(task_or_kind.get("role") or "").strip().lower()
        if role_val in _TOOL_KINDS:
            return TRACK_TOOL
        if role_val in _PATCH_KINDS:
            return TRACK_CODEX
        if role_val in _CLAUDE_KINDS or role_val in _JUDGE_ROLES:
            return TRACK_CLAUDE
        if role_val in _PAID_API_KINDS:
            return TRACK_PAID_API

        text = " ".join(
            str(task_or_kind.get(k) or "")
            for k in ("title", "description", "summary")
        ).strip()
        if text:
            return classify_track(text)
        return TRACK_CLAUDE

    # Object with attributes (e.g. WorkOrder)
    for attr in ("track", "kind", "work_class", "role", "title"):
        val = getattr(task_or_kind, attr, None)
        if isinstance(val, str) and val.strip():
            return classify_track(val)
    return TRACK_CLAUDE


@dataclass(frozen=True)
class RouteOutcome:
    """Routing result across the 4 tracks (supports both attribute and dict-style access)."""

    track: str
    lane: str
    vendor: str
    billing: str
    provider_override: str
    model_override: str
    work_class: str = ""
    task_id: Optional[str] = None
    slot: Optional[str] = None
    slot_dir: Optional[str] = None
    is_tool_step: bool = False
    pinned: bool = False
    reason: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def provider(self) -> str:
        return self.provider_override

    @property
    def model(self) -> str:
        return self.model_override

    @property
    def price(self) -> str:
        return self.billing

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "track": self.track,
            "lane": self.lane,
            "vendor": self.vendor,
            "billing": self.billing,
            "price": self.billing,
            "provider_override": self.provider_override,
            "provider": self.provider_override,
            "model_override": self.model_override,
            "model": self.model_override,
            "work_class": self.work_class,
            "task_id": self.task_id,
            "slot": self.slot,
            "slot_dir": self.slot_dir,
            "is_tool_step": self.is_tool_step,
            "pinned": self.pinned,
            "reason": self.reason,
        }
        if self.extra:
            data.update(self.extra)
        return data

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    def get(self, key: str, default: Any = None) -> Any:
        return self.to_dict().get(key, default)

    def __contains__(self, key: object) -> bool:
        return key in self.to_dict()

    def __eq__(self, other: object) -> bool:
        if isinstance(other, str):
            return self.lane == other or self.track == other
        if isinstance(other, RouteOutcome):
            return self.to_dict() == other.to_dict()
        if isinstance(other, Mapping):
            return self.to_dict() == dict(other)
        return NotImplemented


def _find_catalog_row(
    lane: str,
    catalog: Optional[Iterable[Mapping[str, Any]]],
) -> Optional[dict[str, Any]]:
    if catalog is None:
        return None
    slug = str(lane or "").strip().lower()
    aliases = {slug}
    if slug in ("claude", "cc", "claude-code"):
        aliases.update({"claude", "cc", "claude-code"})
    elif slug in ("codex", "openai-codex"):
        aliases.update({"codex", "openai-codex"})
    for item in catalog:
        if not isinstance(item, Mapping):
            continue
        item_lane = str(item.get("lane") or item.get("slot") or "").strip().lower()
        if item_lane in aliases:
            return dict(item)
    return None


def _is_paid_allowed(
    lane: str,
    defaults: Mapping[str, str],
    catalog_row: Optional[Mapping[str, Any]],
    *,
    config: Optional[Mapping[str, Any]] = None,
    paid_allowlist: Optional[Iterable[str]] = None,
) -> bool:
    """Verify whether a paid lane/provider is permitted by ``nomad.paid_provider_allowlist``."""
    if defaults.get("billing") not in ("paid", capabilities.METERED):
        return True

    if paid_allowlist is not None:
        allow_set = {
            capabilities.normalize_provider(str(x))
            for x in paid_allowlist
            if str(x).strip()
        }
    elif config is not None and isinstance(config, Mapping):
        if "paid_provider_allowlist" in config and "nomad" not in config:
            raw_list = config.get("paid_provider_allowlist") or []
            allow_set = {
                capabilities.normalize_provider(str(x))
                for x in raw_list
                if str(x).strip()
            }
        else:
            allow_set = set(capabilities.paid_allowlist_from(dict(config)))
    else:
        allow_set = set(capabilities.read_paid_allowlist())

    if catalog_row is not None and "allowed_by_whitelist" in catalog_row:
        if not bool(catalog_row["allowed_by_whitelist"]):
            return False
        if not allow_set and paid_allowlist is None and config is None:
            return True

    candidates = {
        capabilities.normalize_provider(str(lane or "")),
        capabilities.normalize_provider(str(defaults.get("vendor") or "")),
        capabilities.normalize_provider(str(defaults.get("provider_override") or "")),
    } - {""}
    return bool(candidates & allow_set)


def _load_kanban_task(task_id: str, board: str = "default") -> Optional[dict[str, Any]]:
    try:
        with core_adapter.kanban.connect_closing(board=board) as kconn:
            row = core_adapter.kanban.get_task(kconn, task_id)
            if row is None:
                return None
            if isinstance(row, Mapping):
                return dict(row)
            if hasattr(row, "to_dict") and callable(row.to_dict):
                return dict(row.to_dict())
            if hasattr(row, "__dict__"):
                return dict(vars(row))
            return dict(row)
    except Exception:
        return None


def _update_kanban_task_pin(
    task_id: str,
    *,
    board: str,
    assignee: str,
    provider_override: str,
    model_override: str,
) -> bool:
    try:
        with core_adapter.kanban.connect_closing(board=board) as kconn:
            row = core_adapter.kanban.get_task(kconn, task_id)
            if row is None:
                return False
            effective_model = model_override or (TRACK_TOOL if provider_override == TRACK_TOOL else "")
            model_val, provider_val = routing.validate_model_override(effective_model, provider_override)
            kconn.execute(
                "UPDATE tasks SET assignee = ?, provider_override = ?, model_override = ? "
                "WHERE id = ?",
                (routing.canonical_assignee(assignee), provider_val, model_val, task_id),
            )
            kconn.commit()
            return True
    except Exception:
        return False


def _detect_judge_context(
    task_id: str,
    *,
    board: str = "default",
    role: Optional[str] = None,
    judge_of: Optional[str] = None,
    executor_lane: Optional[str] = None,
    executor_vendor: Optional[str] = None,
    card: Optional[Mapping[str, Any]] = None,
    conn: Optional[Any] = None,
) -> tuple[bool, Optional[str], Optional[str]]:
    """Determine `(is_judge, counter_vendor_family, counter_task_id)` for cross-family checking."""
    role_slug = str(role or "").strip().lower()
    is_judge = role_slug in _JUDGE_ROLES or bool(judge_of)

    # Inspect card fields if provided or loaded from kanban.db
    kanban_card = dict(card) if isinstance(card, Mapping) else _load_kanban_task(task_id, board)
    if kanban_card:
        card_role = str(kanban_card.get("role") or "").strip().lower()
        if card_role in _JUDGE_ROLES:
            is_judge = True
        if not judge_of and kanban_card.get("judge_of"):
            judge_of = str(kanban_card["judge_of"]).strip()
            is_judge = True
        if not executor_lane:
            for k in ("executor_lane", "author_lane", "worker_lane"):
                if kanban_card.get(k):
                    executor_lane = str(kanban_card[k]).strip()
                    is_judge = True
                    break
        if not executor_vendor:
            for k in ("executor_vendor", "author_vendor", "worker_vendor"):
                if kanban_card.get(k):
                    executor_vendor = str(kanban_card[k]).strip()
                    is_judge = True
                    break
        body_text = kanban_card.get("body") or kanban_card.get("description") or ""
        title_desc = f"{kanban_card.get('title') or ''} {body_text}".lower()
        for marker in ("role: judge", "role=judge", "[judge]", "judge:", "verifier:", "судья"):
            if marker in title_desc:
                is_judge = True
                break
        if isinstance(body_text, str) and body_text.strip().startswith("{"):
            try:
                parsed = json.loads(body_text)
            except ValueError:
                parsed = None
            if isinstance(parsed, Mapping):
                if str(parsed.get("role") or "").strip().lower() in _JUDGE_ROLES:
                    is_judge = True
                if not judge_of and parsed.get("judge_of"):
                    judge_of = str(parsed["judge_of"]).strip()
                    is_judge = True
                if not executor_lane and (parsed.get("executor_lane") or parsed.get("author_lane")):
                    executor_lane = str(parsed.get("executor_lane") or parsed.get("author_lane")).strip()
                    is_judge = True
                if not executor_vendor and (parsed.get("executor_vendor") or parsed.get("author_vendor")):
                    executor_vendor = str(parsed.get("executor_vendor") or parsed.get("author_vendor")).strip()
                    is_judge = True

    if executor_vendor or executor_lane:
        family = resolve_vendor_family(executor_lane, vendor=executor_vendor)
        return True, family, judge_of

    own_conn = None
    db_conn = conn
    if db_conn is None:
        try:
            own_conn = db.connect()
            db_conn = own_conn
        except Exception:
            db_conn = None

    try:
        if db_conn is not None:
            existing_pin = db.get_task_pin(db_conn, task_id, board=board)
            if existing_pin is not None:
                if str(existing_pin.get("role") or "").lower() in _JUDGE_ROLES:
                    is_judge = True
                if not judge_of and existing_pin.get("judge_of"):
                    judge_of = str(existing_pin["judge_of"]).strip()
                    is_judge = True
                if (
                    is_judge
                    and not judge_of
                    and str(existing_pin.get("role") or "executor").lower() == "executor"
                    and existing_pin.get("vendor")
                ):
                    return True, resolve_vendor_family(
                        existing_pin.get("lane"),
                        vendor=existing_pin.get("vendor"),
                        model=existing_pin.get("model_override"),
                    ), task_id

            if is_judge and not judge_of:
                depth_row = db.get_task_depth(db_conn, task_id, board=board)
                if depth_row and depth_row.get("parent_task_id"):
                    judge_of = str(depth_row["parent_task_id"]).strip()

            if judge_of:
                target_pin = db.get_task_pin(db_conn, judge_of, board=board)
                if target_pin is not None:
                    fam = resolve_vendor_family(
                        target_pin.get("lane"),
                        vendor=target_pin.get("vendor"),
                        model=target_pin.get("model_override"),
                    )
                    return True, fam, judge_of

            all_pins = db.list_task_pins(db_conn, board=board)
            for pin_row in all_pins:
                if pin_row.get("judge_of") == task_id and pin_row.get("task_id") != task_id:
                    fam = resolve_vendor_family(
                        pin_row.get("lane"),
                        vendor=pin_row.get("vendor"),
                        model=pin_row.get("model_override"),
                    )
                    return True, fam, str(pin_row.get("task_id"))

        if judge_of:
            target_card = _load_kanban_task(judge_of, board)
            if target_card is not None:
                fam = resolve_vendor_family(
                    target_card.get("assignee") or target_card.get("provider_override"),
                    model=target_card.get("model_override"),
                )
                if fam != "unknown":
                    return True, fam, judge_of

        if is_judge and kanban_card is not None:
            existing_assignee = kanban_card.get("assignee") or kanban_card.get("provider_override")
            existing_model = kanban_card.get("model_override")
            if existing_assignee or existing_model:
                fam = resolve_vendor_family(existing_assignee, model=existing_model)
                if fam != "unknown":
                    return True, fam, judge_of or task_id
    finally:
        if own_conn is not None:
            own_conn.close()

    return is_judge, None, judge_of


def _record_pin_refused(
    conn: Optional[Any],
    *,
    task_id: str,
    lane: str,
    reason: str,
    detail: Optional[Mapping[str, Any]] = None,
) -> None:
    payload = {
        "task_id": task_id,
        "lane": lane,
        "reason": reason,
        **(dict(detail) if detail else {}),
    }
    if conn is not None:
        try:
            db.add_event(conn, db.EVENT_TASK_PIN_REFUSED, payload)
        except Exception:
            pass
        return
    try:
        own = db.connect()
        try:
            db.add_event(own, db.EVENT_TASK_PIN_REFUSED, payload)
        finally:
            own.close()
    except Exception:
        pass


def pin_task(
    task_id: str,
    lane: str,
    *,
    board: str = "default",
    catalog: Optional[Iterable[Mapping[str, Any]]] = None,
    slot_registry: Optional[slots.SlotRegistry] = None,
    alive: Optional[bool] = None,
    role: Optional[str] = None,
    judge_of: Optional[str] = None,
    executor_lane: Optional[str] = None,
    executor_vendor: Optional[str] = None,
    card: Optional[Mapping[str, Any]] = None,
    config: Optional[Mapping[str, Any]] = None,
    paid_allowlist: Optional[Iterable[str]] = None,
    ru_only_enabled: Optional[bool] = None,
    base_url: Optional[str] = None,
    conn: Optional[Any] = None,
) -> dict[str, Any]:
    """Manually pin ``task_id`` to ``lane``, overriding its track, provider, model, and billing.

    Enforces all 4 M-164 safety gates before persisting the pin:
    1. Target lane/slot must be alive (``alive=True``);
    2. Judge cross-family rule: a judge/verifier cannot share the same model family/vendor as the
       reviewed card's executor;
    3. Paid provider must be permitted by ``nomad.paid_provider_allowlist``;
    4. Under ``nomad.ru_only=True``, foreign lanes/providers are rejected via
       ``ru_only.require_ru_lane``.
    """
    tid = str(task_id or "").strip()
    if not tid:
        raise ValueError("task_id must be non-empty")
    lane_slug = str(lane or "").strip()
    if not lane_slug:
        raise ValueError("lane must be non-empty")

    slot_rec = slot_registry.get(lane_slug) if slot_registry is not None else None
    cat_row = _find_catalog_row(lane_slug, catalog)
    if cat_row is None and slot_rec is not None:
        cat_row = slot_rec.to_dict()

    defaults = resolve_lane_defaults(lane_slug, cat_row)

    # Gate 0: pooled slot under pool_mode=shipped
    if slots.is_pooled_slot(cat_row or lane_slug):
        try:
            pool_mode.require_pool_access(pool_mode.ACTION_POOLED_LANE, lane_slug)
        except pool_mode.PoolModeRefused as exc:
            _record_pin_refused(
                conn,
                task_id=tid,
                lane=lane_slug,
                reason=REASON_POOL_MODE_SHIPPED,
                detail={"pool_mode": exc.pool_mode.mode},
            )
            raise PinRefusedError(
                tid,
                lane_slug,
                REASON_POOL_MODE_SHIPPED,
                str(exc),
                detail={"pool_mode": exc.pool_mode.mode},
            ) from exc

    # Gate 4: ru_only contour check
    effective_cfg: Optional[dict[str, Any]] = dict(config) if isinstance(config, Mapping) else None
    if ru_only_enabled is not None:
        effective_cfg = dict(effective_cfg or {})
        nomad_sec = dict(effective_cfg.get("nomad") or {})
        nomad_sec["ru_only"] = bool(ru_only_enabled)
        effective_cfg["nomad"] = nomad_sec

    if defaults["track"] != TRACK_TOOL:
        try:
            _check_ru_lane(
                lane_slug,
                defaults["provider_override"],
                defaults["model_override"],
                base_url=base_url,
                config=effective_cfg,
                ru_only_enabled=ru_only_enabled,
            )
        except ru_only.RuOnlyRefused as exc:
            _record_pin_refused(
                conn,
                task_id=tid,
                lane=lane_slug,
                reason=REASON_RU_ONLY_VIOLATION,
                detail={"host": exc.host, "ru_reason": exc.reason},
            )
            raise RuOnlyPinError(tid, lane_slug, exc) from exc

    # Gate 3: paid provider whitelist check
    if not _is_paid_allowed(
        lane_slug,
        defaults,
        cat_row,
        config=effective_cfg,
        paid_allowlist=paid_allowlist,
    ):
        _record_pin_refused(
            conn,
            task_id=tid,
            lane=lane_slug,
            reason=REASON_PAID_NOT_WHITELISTED,
            detail={"vendor": defaults["vendor"], "billing": defaults["billing"]},
        )
        raise PinRefusedError(
            tid,
            lane_slug,
            REASON_PAID_NOT_WHITELISTED,
            f"paid lane {lane_slug!r} (vendor={defaults['vendor']!r}) is not in nomad.paid_provider_allowlist",
            detail={"vendor": defaults["vendor"], "billing": defaults["billing"]},
        )

    # Gate 1: lane alive check
    if alive is not None:
        is_alive = bool(alive)
    elif slot_rec is not None:
        is_alive = bool(slot_rec.alive and slot_rec.accepted)
    elif cat_row is not None and "alive" in cat_row:
        is_alive = bool(cat_row["alive"])
    else:
        is_alive = True

    if not is_alive:
        dead_reason = (
            (cat_row.get("reason") if cat_row else None)
            or (slot_rec.reason if slot_rec else None)
            or REASON_LANE_NOT_ALIVE
        )
        _record_pin_refused(
            conn,
            task_id=tid,
            lane=lane_slug,
            reason=REASON_LANE_NOT_ALIVE,
            detail={"dead_reason": dead_reason},
        )
        raise PinRefusedError(
            tid,
            lane_slug,
            REASON_LANE_NOT_ALIVE,
            f"lane {lane_slug!r} is not alive ({dead_reason})",
            detail={"dead_reason": dead_reason},
        )

    # Gate 2: cross-family judge check
    is_judge, counter_family, counter_task = _detect_judge_context(
        tid,
        board=board,
        role=role,
        judge_of=judge_of,
        executor_lane=executor_lane,
        executor_vendor=executor_vendor,
        card=card,
        conn=conn,
    )
    target_family = resolve_vendor_family(
        lane_slug,
        vendor=defaults["vendor"],
        model=defaults["model_override"],
    )
    if is_judge and counter_family and counter_family != "unknown" and target_family == counter_family:
        _record_pin_refused(
            conn,
            task_id=tid,
            lane=lane_slug,
            reason=REASON_JUDGE_SAME_FAMILY,
            detail={
                "judge_family": target_family,
                "executor_family": counter_family,
                "counter_task_id": counter_task,
            },
        )
        raise CrossFamilyPinError(
            tid,
            lane_slug,
            REASON_JUDGE_SAME_FAMILY,
            f"judge cross-family violation on task {tid!r}: judge family {target_family!r} "
            f"matches executor family {counter_family!r}",
            detail={
                "judge_family": target_family,
                "executor_family": counter_family,
                "counter_task_id": counter_task,
            },
        )

    effective_role = "judge" if is_judge else (str(role or "executor").strip().lower() or "executor")

    own_conn = None
    db_conn = conn
    if db_conn is None:
        own_conn = db.connect()
        db_conn = own_conn
    try:
        pin_row = db.set_task_pin(
            db_conn,
            tid,
            lane=defaults["lane"],
            track=defaults["track"],
            assignee=lane_slug,
            provider_override=defaults["provider_override"],
            model_override=defaults["model_override"],
            billing=defaults["billing"],
            vendor=target_family,
            role=effective_role,
            judge_of=counter_task if is_judge else judge_of,
            board=board,
        )
    finally:
        if own_conn is not None:
            own_conn.close()

    kanban_updated = _update_kanban_task_pin(
        tid,
        board=board,
        assignee=lane_slug,
        provider_override=defaults["provider_override"],
        model_override=defaults["model_override"],
    )

    return {
        "ok": True,
        "task_id": tid,
        "board": board,
        "lane": defaults["lane"],
        "assignee": lane_slug,
        "track": defaults["track"],
        "vendor": target_family,
        "billing": defaults["billing"],
        "price": defaults["billing"],
        "provider_override": defaults["provider_override"],
        "provider": defaults["provider_override"],
        "model_override": defaults["model_override"],
        "model": defaults["model_override"],
        "role": effective_role,
        "judge_of": pin_row.get("judge_of"),
        "kanban_updated": kanban_updated,
    }


def route_task(
    task_or_kind: Any,
    *,
    catalog: Optional[Iterable[Mapping[str, Any]]] = None,
    slot_registry: Optional[slots.SlotRegistry] = None,
    board: str = "default",
    config: Optional[Mapping[str, Any]] = None,
    paid_allowlist: Optional[Iterable[str]] = None,
    ru_only_enabled: Optional[bool] = None,
    author_vendor: Optional[str] = None,
    conn: Optional[Any] = None,
) -> RouteOutcome:
    """Route a task or step kind across the 4 tracks (``claude-code``, ``codex``, ``paid_api``,
    ``tool``).

    - Checks manual pins in ``task_pins`` first when ``task_id`` is present;
    - Maps ``"patch"`` -> ``codex`` and ``"build"`` -> ``tool``;
    - Enforces ``ru_only.require_ru_lane`` when ``ru_only=True``;
    - Filters out pooled slots when ``pool_mode=shipped`` via ``pool_mode.require_pool_access``;
    - Enforces cross-family vendor selection when routing a judge/review task.
    """
    task_id: Optional[str] = None
    explicit_lane: Optional[str] = None
    role: Optional[str] = None
    if isinstance(task_or_kind, Mapping):
        raw_tid = task_or_kind.get("task_id") or task_or_kind.get("id")
        if raw_tid:
            task_id = str(raw_tid).strip()
        raw_lane = task_or_kind.get("lane") or task_or_kind.get("pinned_lane")
        if raw_lane:
            explicit_lane = str(raw_lane).strip()
        if task_or_kind.get("role"):
            role = str(task_or_kind["role"]).strip().lower()
        if not author_vendor:
            for k in ("author_vendor", "executor_vendor", "worker_vendor", "author_lane", "executor_lane"):
                if task_or_kind.get(k):
                    author_vendor = resolve_vendor_family(str(task_or_kind[k]))
                    break

    effective_cfg: Optional[dict[str, Any]] = dict(config) if isinstance(config, Mapping) else None
    if ru_only_enabled is not None:
        effective_cfg = dict(effective_cfg or {})
        nomad_sec = dict(effective_cfg.get("nomad") or {})
        nomad_sec["ru_only"] = bool(ru_only_enabled)
        effective_cfg["nomad"] = nomad_sec

    if task_id and not explicit_lane:
        own_conn = None
        db_conn = conn
        if db_conn is None:
            try:
                own_conn = db.connect()
                db_conn = own_conn
            except Exception:
                db_conn = None
        try:
            if db_conn is not None:
                pin_row = db.get_task_pin(db_conn, task_id, board=board)
                if pin_row is not None:
                    explicit_lane = pin_row["lane"]
        finally:
            if own_conn is not None:
                own_conn.close()

    if explicit_lane:
        defaults = resolve_lane_defaults(explicit_lane, _find_catalog_row(explicit_lane, catalog))
        if defaults["track"] != TRACK_TOOL:
            _check_ru_lane(
                explicit_lane,
                defaults["provider_override"],
                defaults["model_override"],
                config=effective_cfg,
                ru_only_enabled=ru_only_enabled,
            )
        if slots.is_pooled_slot(explicit_lane):
            pool_mode.require_pool_access(pool_mode.ACTION_POOLED_LANE, explicit_lane)
        return RouteOutcome(
            track=defaults["track"],
            lane=defaults["lane"],
            vendor=defaults["vendor"],
            billing=defaults["billing"],
            provider_override=defaults["provider_override"],
            model_override=defaults["model_override"],
            work_class=defaults["track"],
            task_id=task_id,
            slot=explicit_lane if slots.is_pooled_slot(explicit_lane) else None,
            is_tool_step=(defaults["track"] == TRACK_TOOL),
            pinned=True,
            reason="pinned",
        )

    track = classify_track(task_or_kind)

    # Track 4: deterministic tool step (no model invocation)
    if track == TRACK_TOOL:
        return RouteOutcome(
            track=TRACK_TOOL,
            lane=TRACK_TOOL,
            vendor="local",
            billing=capabilities.FREE,
            provider_override=TRACK_TOOL,
            model_override="",
            work_class=routing.WORK_DETERMINISTIC,
            task_id=task_id,
            is_tool_step=True,
            reason="deterministic_tool_step",
        )

    is_judge = (role in _JUDGE_ROLES) or (
        isinstance(task_or_kind, str) and task_or_kind.strip().lower() in _JUDGE_ROLES
    )

    if slot_registry is not None:
        candidates = slot_registry.available_slots(track=track)
        if is_judge and author_vendor:
            candidates = [
                s for s in candidates
                if resolve_vendor_family(s.slot, vendor=s.vendor) != resolve_vendor_family(author_vendor)
            ]
        if candidates:
            chosen_slot = candidates[0]
            defaults = resolve_lane_defaults(chosen_slot.slot, chosen_slot.to_dict())
            _check_ru_lane(
                chosen_slot.slot,
                defaults["provider_override"],
                defaults["model_override"],
                config=effective_cfg,
                ru_only_enabled=ru_only_enabled,
            )
            return RouteOutcome(
                track=track,
                lane=chosen_slot.slot,
                vendor=chosen_slot.vendor,
                billing=chosen_slot.billing,
                provider_override=defaults["provider_override"],
                model_override=defaults["model_override"],
                work_class=track,
                task_id=task_id,
                slot=chosen_slot.slot,
                slot_dir=str(chosen_slot.slot_dir) if chosen_slot.slot_dir else None,
                is_tool_step=False,
                reason="slot_selected",
            )

    rows = [dict(r) for r in catalog] if catalog is not None else list(routing.default_catalog())
    eligible_rows: list[dict[str, Any]] = []
    for row in rows:
        lane_name = str(row.get("lane") or row.get("slot") or "").strip()
        if not lane_name or not row.get("alive", False):
            continue
        if slots.is_pooled_slot(row):
            try:
                pool_mode.require_pool_access(pool_mode.ACTION_POOLED_LANE, lane_name)
            except pool_mode.PoolModeRefused:
                continue
        defaults = resolve_lane_defaults(lane_name, row)
        if not _is_paid_allowed(
            lane_name,
            defaults,
            row,
            config=effective_cfg,
            paid_allowlist=paid_allowlist,
        ):
            continue
        if is_judge and author_vendor:
            if resolve_vendor_family(lane_name, vendor=defaults["vendor"]) == resolve_vendor_family(author_vendor):
                continue
        eligible_rows.append({**row, **defaults, "lane": lane_name})

    track_matches = [r for r in eligible_rows if r.get("track") == track]
    selected = track_matches[0] if track_matches else (eligible_rows[0] if eligible_rows else None)

    if selected is None:
        fallback_lane = (
            "codex"
            if track == TRACK_CODEX
            else ("deepseek" if track == TRACK_PAID_API else "claude-code")
        )
        defaults = resolve_lane_defaults(fallback_lane)
        _check_ru_lane(
            defaults["lane"],
            defaults["provider_override"],
            defaults["model_override"],
            config=effective_cfg,
            ru_only_enabled=ru_only_enabled,
        )
        return RouteOutcome(
            track=track,
            lane=defaults["lane"],
            vendor=defaults["vendor"],
            billing=defaults["billing"],
            provider_override=defaults["provider_override"],
            model_override=defaults["model_override"],
            work_class=track,
            task_id=task_id,
            is_tool_step=False,
            reason=REASON_NO_ELIGIBLE_LANE,
        )

    _check_ru_lane(
        selected["lane"],
        selected["provider_override"],
        selected["model_override"],
        config=effective_cfg,
        ru_only_enabled=ru_only_enabled,
    )
    return RouteOutcome(
        track=selected["track"],
        lane=selected["lane"],
        vendor=selected["vendor"],
        billing=selected["billing"],
        provider_override=selected["provider_override"],
        model_override=selected["model_override"],
        work_class=track,
        task_id=task_id,
        slot=selected["lane"] if slots.is_pooled_slot(selected) else None,
        slot_dir=selected.get("slot_dir") or selected.get("config_dir") or selected.get("codex_home"),
        is_tool_step=False,
        reason="routed",
    )
