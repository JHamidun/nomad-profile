"""N4 (M-161): deterministic pre-claim task router — «Модель предлагает смысл. Код решает факты».

Декомпозитор (LLM или стаб в тестах) предлагает смысловой граф подзадач: заголовки, описания,
связи ``parents`` и, возможно, пожелания по классу работы или исполнителю. Даже если модель в
ответе попросила конкретную дорогую или запрещённую пару ``model="opus"`` / ``provider="anthropic"``
(или ``model_override`` / ``provider_override``), роутер игнорирует модельные пожелания по модели и
провайдеру и выставляет ``assignee``, ``model_override`` и ``provider_override`` исключительно из
политики дорожек и живого каталога возможностей (``capabilities.py``).

Правила выбора дорожки (спека §1.1, §3.1, §3.2, §4.1, §5.8):

1. Каждая подзадача классифицируется в канонический ``work_class`` (из явного валидного поля
   ``work_class`` либо детерминированно по тексту задачи и навыкам).
2. Для класса работы строится лестница дорожек (таблица §3.1).
3. Кандидаты фильтруются по живости (``alive=True``), белому списку платных провайдеров
   (``allowed_by_whitelist=True`` для ``billing == "metered"``), контуру ``ru_only``
   (``ru_only.classify``) и порогу окна (§4.1: остаток ``window_left <= 10`` %, т.е. использовано
   ≥ 90 %, новую карточку не берёт).
4. Холодные слоты (``window_left > 30`` %, использовано < 70 %) предпочитаются тёплым
   (``10 < window_left <= 30`` % или ``"unknown"``); при равной теплоте выбирается слот с большим
   остатком окна и меньшим числом уже назначенных карточек в текущем плане.
5. Назначенные ``model_override`` и ``provider_override`` проходят валидацию совместимости с
   ``kanban_db._validate_model_override``: непустой ``provider_override`` всегда сопровождается
   непустым каноническим ``model_override``.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Callable, Iterable, Mapping, Optional, Sequence

from . import capabilities, ru_only

WORK_REPO = "repo_work"
WORK_PRECISE_PATCH = "precise_patch"
WORK_BULK_CHEAP = "bulk_cheap"
WORK_LARGE_READING = "large_reading"
WORK_WEB_FACTS = "web_facts"
WORK_RU_CONTOUR = "ru_contour"
WORK_DETERMINISTIC = "deterministic_step"

WORK_CLASSES: tuple[str, ...] = (
    WORK_REPO,
    WORK_PRECISE_PATCH,
    WORK_BULK_CHEAP,
    WORK_LARGE_READING,
    WORK_WEB_FACTS,
    WORK_RU_CONTOUR,
    WORK_DETERMINISTIC,
)

# Пороги окна из спеки §4.1 (в терминах остатка window_left = 100 - used_percent):
# used >= 90 % -> window_left <= 10 % (новая карточка не выдаётся);
# used >= 70 % -> window_left <= 30 % («тёплый» слот, как и "unknown").
WINDOW_EXHAUSTED_LEFT = 10.0
WINDOW_WARM_LEFT = 30.0

WINDOW_COLD = "cold"
WINDOW_WARM = "warm"
WINDOW_EXHAUSTED = "exhausted"
WINDOW_UNROUTABLE = "unroutable"

# Канонические пары (provider_override, model_override) по базовой дорожке.
# Назначаются ТОЛЬКО этим словарём (и проверенным провайдером слота), никогда не из ответа LLM.
LANE_MODELS: dict[str, tuple[str, str]] = {
    "claude-code": ("claude-code", "claude-sonnet-4-6"),
    "codex": ("codex", "gpt-5.4"),
    "deepseek": ("deepseek", "deepseek-chat"),
    "gemini": ("gemini", "gemini-2.5-flash"),
    "kimi": ("kimi", "kimi-k2.5"),
    "perplexity": ("perplexity", "sonar-pro"),
    "yandex": ("yandex", ru_only.DEFAULT_YANDEX_MODEL),
    "tool": ("tool", "tool"),
}

# Лестницы переключений по классу работы (спека §3.1).
WORK_CLASS_LADDERS: dict[str, tuple[str, ...]] = {
    WORK_REPO: ("claude-code", "codex", "deepseek", "gemini", "kimi", "yandex"),
    WORK_PRECISE_PATCH: ("codex", "claude-code", "kimi", "deepseek", "gemini", "yandex"),
    WORK_BULK_CHEAP: ("deepseek", "gemini", "claude-code", "codex", "yandex"),
    WORK_LARGE_READING: ("gemini", "deepseek", "claude-code", "codex", "yandex"),
    WORK_WEB_FACTS: ("perplexity", "claude-code", "codex", "gemini", "yandex"),
    WORK_RU_CONTOUR: ("yandex",),
    WORK_DETERMINISTIC: ("tool",),
}

# Запасной порядок всех модельных дорожек, если профильные ступени класса недоступны.
_FALLBACK_MODEL_LANES: tuple[str, ...] = (
    "claude-code",
    "codex",
    "deepseek",
    "gemini",
    "kimi",
    "perplexity",
    "yandex",
)

_ASSIGNEE_RE = re.compile(r"[^a-z0-9_-]+")

_KEYWORDS_PRECISE_PATCH = (
    "patch", "hotfix", "bugfix", "fix ", "debug", "algorithm", "race condition", "deadlock",
    "патч", "баг", "исправ", "отлад", "алгоритм", "гонк", "регресс", "точн",
)
_KEYWORDS_LARGE_READING = (
    "recon", "research", "audit", "survey", "explore", "large corpus", "read all", "investigate",
    "разведк", "исслед", "аудит", "обзор", "чтени", "изуч", "анализ корпуса", "инвентаризац",
)
_KEYWORDS_BULK_CHEAP = (
    "translate", "translation", "summarize", "summary", "markup", "extract", "rewrite",
    "boilerplate", "changelog", "format", "docstring",
    "перевод", "перевест", "выжимк", "разметк", "перепис", "черновик", "шаблон", "конспект",
)
_KEYWORDS_WEB_FACTS = (
    "web search", "perplexity", "citations", "current price", "latest news", "fact check",
    "свежие факты", "поиск в сети", "из сети", "источник", "актуальн",
)


@dataclass(frozen=True)
class AdvisorSuggestion:
    """External route suggestion produced by an advisor hook."""

    work_class: str
    confidence: float = 1.0
    source: str = "advisor"
    metadata: Optional[Mapping[str, Any]] = None


_ROUTE_ADVISORS: list[Any] = []


def register_route_advisor(advisor: Any) -> None:
    """Register an external route advisor hook."""
    if advisor not in _ROUTE_ADVISORS:
        _ROUTE_ADVISORS.append(advisor)


def unregister_route_advisor(advisor: Any) -> None:
    """Remove a previously registered route advisor hook."""
    if advisor in _ROUTE_ADVISORS:
        _ROUTE_ADVISORS.remove(advisor)


def clear_route_advisors() -> None:
    """Clear all registered route advisor hooks."""
    _ROUTE_ADVISORS.clear()


def get_route_advisors() -> list[Any]:
    """Return a shallow copy of registered route advisor hooks."""
    return list(_ROUTE_ADVISORS)


@dataclass(frozen=True)
class RouteDecision:
    """Routing outcome for a single subtask before any card is claimed."""

    lane: str
    assignee: str
    provider_override: Optional[str]
    model_override: Optional[str]
    work_class: str
    billing: str
    window_state: str
    requested_model: Optional[str] = None
    requested_provider: Optional[str] = None
    overridden_model_wish: bool = False
    blocked_reason: Optional[str] = None
    rule_class: Optional[str] = None
    advisor_class: Optional[str] = None
    advisor_conf: Optional[float] = None
    advisor_source: Optional[str] = "disabled"
    advisor_lane: Optional[str] = None
    rule_lane: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def validate_model_override(
    model: Optional[str], provider: Optional[str],
) -> tuple[Optional[str], Optional[str]]:
    """Parity with ``kanban_db._validate_model_override``: provider requires a non-empty model."""
    clean_model = (model or "").strip() or None
    clean_provider = (provider or "").strip() or None
    if clean_provider and not clean_model:
        raise ValueError("provider_override requires a model_override")
    return clean_model, clean_provider


def base_lane_name(lane: str) -> str:
    """Strip pool slot suffix (``claude-code:acc2`` → ``claude-code``)."""
    return (lane or "").strip().lower().split(":", 1)[0]


def canonical_assignee(lane: str) -> str:
    """Normalize a lane / slot name into a valid kanban assignee identifier."""
    raw = (lane or "").strip().lower().replace(":", "-")
    cleaned = _ASSIGNEE_RE.sub("-", raw).strip("-")
    return cleaned or "nomad"


def default_catalog(*, allowlist: Optional[Iterable[str]] = None) -> list[dict[str, Any]]:
    """Offline capability catalog used when no live probe catalog is supplied.

    Содержит те же строки, что возвращает ``capabilities.build_catalog``, с живыми подписными
    дорожками ``claude-code`` и ``codex``, локальной дорожкой ``tool`` и API-дорожками, чья
    доступность по счётчику определяется белым списком ``paid_provider_allowlist``.
    """
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist)
        if allowlist is not None
        else capabilities.read_paid_allowlist()
    )
    rows: list[dict[str, Any]] = [
        {
            "lane": "claude-code",
            "vendor": "anthropic",
            "provider": "claude-code",
            "billing": capabilities.SUBSCRIPTION,
            "alive": True,
            "reason": None,
            "identity": {"auth_method": "claude.ai"},
            "window_left": capabilities.UNKNOWN,
            "window": None,
            "allowed_by_whitelist": True,
            "work_class": WORK_REPO,
            "slot": None,
        },
        {
            "lane": "codex",
            "vendor": "openai",
            "provider": "codex",
            "billing": capabilities.SUBSCRIPTION,
            "alive": True,
            "reason": None,
            "identity": {"auth_method": "chatgpt"},
            "window_left": capabilities.UNKNOWN,
            "window": None,
            "allowed_by_whitelist": True,
            "work_class": WORK_PRECISE_PATCH,
            "slot": None,
        },
    ]
    for api in capabilities.API_LANES:
        allowed = capabilities.allowed_by_whitelist(
            capabilities.METERED, api.provider, active_allowlist,
        )
        rows.append({
            "lane": api.lane,
            "vendor": api.vendor,
            "provider": api.provider,
            "billing": capabilities.METERED,
            "alive": allowed,
            "reason": None if allowed else capabilities.REASON_NO_API_KEY,
            "identity": None,
            "window_left": capabilities.UNKNOWN,
            "window": None,
            "allowed_by_whitelist": allowed,
            "work_class": api.work_class,
            "slot": None,
        })
    rows.append({
        "lane": capabilities.TOOL_LANE,
        "vendor": "local",
        "provider": capabilities.TOOL_LANE,
        "billing": capabilities.FREE,
        "alive": True,
        "reason": None,
        "identity": None,
        "window_left": capabilities.UNKNOWN,
        "window": None,
        "allowed_by_whitelist": True,
        "work_class": WORK_DETERMINISTIC,
        "slot": None,
    })
    return rows


def window_tier(window_left: Any) -> tuple[int, float, str]:
    """Classify ``window_left`` into ``(tier_rank, effective_left, state_label)``.

    * ``tier_rank == 0`` («cold»): наблюдаемый остаток > 30 % (использовано < 70 %).
    * ``tier_rank == 1`` («warm»): остаток 10..30 % (использовано 70..90 %) либо ``"unknown"``.
    * ``tier_rank == 2`` («exhausted»): остаток <= 10 % (использовано >= 90 %) — слот не берёт
      новые карточки (спека §4.1).
    """
    if isinstance(window_left, (int, float)) and not isinstance(window_left, bool):
        left = float(min(max(window_left, 0.0), 100.0))
        if left <= WINDOW_EXHAUSTED_LEFT:
            return (2, left, WINDOW_EXHAUSTED)
        if left <= WINDOW_WARM_LEFT:
            return (1, left, WINDOW_WARM)
        return (0, left, WINDOW_COLD)
    return (1, 50.0, WINDOW_WARM)


def is_lane_eligible(
    row: Mapping[str, Any],
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
) -> tuple[bool, Optional[str]]:
    """Return ``(True, None)`` when ``row`` may take a new card, else ``(False, reason)``."""
    if not row.get("alive"):
        return False, str(row.get("reason") or "lane_not_alive")

    billing = str(row.get("billing") or capabilities.METERED)
    provider = str(row.get("provider") or base_lane_name(str(row.get("lane") or "")))

    if billing == capabilities.METERED:
        if allowlist is not None:
            allowed = capabilities.allowed_by_whitelist(billing, provider, allowlist)
        else:
            allowed = bool(row.get("allowed_by_whitelist"))
        if not allowed:
            return False, "paid_provider_not_whitelisted"

    _rank, _left, win_state = window_tier(row.get("window_left"))
    if win_state == WINDOW_EXHAUSTED:
        return False, "window_exhausted"

    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    if active_ru.enabled:
        target = ru_only.LaneTarget(
            lane_id=str(row.get("lane") or provider),
            provider=provider,
            base_url=row.get("base_url"),
        )
        reason, _host = ru_only.classify(target)
        if reason is not None:
            return False, reason

    return True, None


def format_catalog_for_prompt(
    catalog: Sequence[Mapping[str, Any]],
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
) -> str:
    """Render ONLY alive & eligible lanes for the decomposer prompt (spec §5.8)."""
    lines: list[str] = []
    for row in catalog:
        ok, _reason = is_lane_eligible(row, ru_mode=ru_mode, allowlist=allowlist)
        if not ok:
            continue
        lane = str(row.get("lane") or "")
        work_class = str(row.get("work_class") or WORK_REPO)
        billing = str(row.get("billing") or capabilities.SUBSCRIPTION)
        _rank, _left, win_state = window_tier(row.get("window_left"))
        lines.append(
            f"- {lane}: work_class={work_class}, billing={billing}, window={win_state}"
        )
    if not lines:
        return "- (no eligible lanes available)"
    return "\n".join(lines)


def infer_work_class(
    subtask: Mapping[str, Any],
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
) -> str:
    """Deterministically classify a subtask into one of ``WORK_CLASSES``."""
    for field in ("work_class", "kind", "class"):
        explicit = subtask.get(field)
        if isinstance(explicit, str):
            norm = explicit.strip().lower()
            if norm in WORK_CLASSES:
                return norm

    lane_hint = str(subtask.get("lane") or subtask.get("assignee") or "").strip().lower()
    base_hint = base_lane_name(lane_hint)
    if base_hint == "tool":
        return WORK_DETERMINISTIC

    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    if active_ru.enabled and base_hint == "yandex":
        return WORK_RU_CONTOUR

    title = str(subtask.get("title") or "").lower()
    body = str(subtask.get("body") or "").lower()
    skills_raw = subtask.get("skills") or ()
    if isinstance(skills_raw, Iterable) and not isinstance(skills_raw, str):
        skills_text = " ".join(str(s).lower() for s in skills_raw)
    else:
        skills_text = str(skills_raw).lower()
    combined = f"{title}\n{body}\n{skills_text}"

    if any(kw in combined for kw in _KEYWORDS_WEB_FACTS):
        return WORK_WEB_FACTS
    if any(kw in combined for kw in _KEYWORDS_LARGE_READING):
        return WORK_LARGE_READING
    if any(kw in combined for kw in _KEYWORDS_PRECISE_PATCH):
        return WORK_PRECISE_PATCH
    if any(kw in combined for kw in _KEYWORDS_BULK_CHEAP):
        return WORK_BULK_CHEAP

    # Если декомпозитор предложил известную живую дорожку по имени (не модель!), используем её класс
    # как смысловую подсказку, но модель и провайдер всё равно назначит код.
    if base_hint == "codex":
        return WORK_PRECISE_PATCH
    if base_hint == "gemini":
        return WORK_LARGE_READING
    if base_hint == "deepseek":
        return WORK_BULK_CHEAP
    if base_hint == "perplexity":
        return WORK_WEB_FACTS
    if base_hint == "yandex":
        return WORK_RU_CONTOUR

    return WORK_REPO


def canonical_lane_model(row: Mapping[str, Any]) -> tuple[str, str]:
    """Return ``(provider_override, model_override)`` from code policy for ``row``."""
    lane = str(row.get("lane") or "")
    base = base_lane_name(lane)
    default_provider, default_model = LANE_MODELS.get(base, LANE_MODELS["claude-code"])
    row_provider = str(row.get("provider") or "").strip().lower()
    # Для подписных CLI-дорожек (claude-code, codex) канонический провайдер — имя самой дорожки,
    # чтобы карточка никогда не уходила напрямую в платный API anthropic/openai мимо CLI.
    if base in ("claude-code", "codex"):
        provider = default_provider
    elif row_provider:
        provider = row_provider
    else:
        provider = default_provider
    model, provider = validate_model_override(default_model, provider)
    assert model is not None and provider is not None
    return provider, model


def _extract_model_wishes(subtask: Mapping[str, Any]) -> tuple[Optional[str], Optional[str]]:
    req_model = subtask.get("model_override") or subtask.get("model")
    req_provider = subtask.get("provider_override") or subtask.get("provider")
    clean_model = str(req_model).strip() if isinstance(req_model, str) and req_model.strip() else None
    clean_provider = (
        str(req_provider).strip() if isinstance(req_provider, str) and req_provider.strip() else None
    )
    return clean_model, clean_provider


def _ladder_for_class(work_class: str) -> tuple[str, ...]:
    primary = WORK_CLASS_LADDERS.get(work_class, WORK_CLASS_LADDERS[WORK_REPO])
    if work_class == WORK_DETERMINISTIC:
        return primary
    tail = tuple(lane for lane in _FALLBACK_MODEL_LANES if lane not in primary)
    return primary + tail


def _select_best_slot(
    candidates: Sequence[Mapping[str, Any]],
    usage_counts: Mapping[str, int],
) -> Mapping[str, Any]:
    """Pick the best slot for a base lane: cold > warm, higher window_left, fewer assigned tasks."""
    def sort_key(row: Mapping[str, Any]) -> tuple[int, int, float, str]:
        lane = str(row.get("lane") or "")
        tier_rank, effective_left, _state = window_tier(row.get("window_left"))
        assigned = int(usage_counts.get(lane, 0))
        return (tier_rank, assigned, -effective_left, lane)

    return min(candidates, key=sort_key)


def route_subtask(
    subtask: Mapping[str, Any],
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
    usage_counts: Optional[dict[str, int]] = None,
) -> RouteDecision:
    """Assign lane, ``assignee``, ``provider_override`` and ``model_override`` to one subtask.

    Любые модельные поля ``model``/``model_override`` и ``provider``/``provider_override`` из
    ответа декомпозитора сохраняются только в ``requested_model``/``requested_provider`` для
    журнала и НЕ влияют на назначенные значения в БД.
    """
    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    rows = list(catalog) if catalog is not None else default_catalog(allowlist=allowlist)
    counts = usage_counts if usage_counts is not None else {}

    req_model, req_provider = _extract_model_wishes(subtask)
    rule_class = infer_work_class(subtask, ru_mode=active_ru)

    eligible_by_base: dict[str, list[Mapping[str, Any]]] = {}
    rejection_reasons: list[str] = []
    allowed_lanes: list[str] = []
    for row in rows:
        ok, reason = is_lane_eligible(row, ru_mode=active_ru, allowlist=allowlist)
        base = base_lane_name(str(row.get("lane") or ""))
        if ok:
            eligible_by_base.setdefault(base, []).append(row)
            allowed_lanes.append(str(row.get("lane") or base))
        elif reason:
            rejection_reasons.append(f"{row.get('lane')}:{reason}")

    # Neutral route advisor hook
    adv_sug: Optional[AdvisorSuggestion] = None
    advisor_source: str = "disabled"
    advisor_class: Optional[str] = None
    advisor_conf: Optional[float] = None

    if _ROUTE_ADVISORS:
        adv = _ROUTE_ADVISORS[0]
        try:
            if hasattr(adv, "advise"):
                res = adv.advise(subtask, allowed_lanes)
            elif callable(adv):
                res = adv(subtask, allowed_lanes)
            else:
                res = None
            if isinstance(res, AdvisorSuggestion):
                adv_sug = res
            elif isinstance(res, tuple) and len(res) >= 2:
                adv_sug = AdvisorSuggestion(work_class=str(res[0]), confidence=float(res[1]))
            elif isinstance(res, str):
                adv_sug = AdvisorSuggestion(work_class=res)
        except Exception:
            # Advisor failure -> source=fallback, rule lane is maintained
            adv_sug = AdvisorSuggestion(work_class=rule_class, confidence=0.0, source="fallback")

    if adv_sug is not None:
        advisor_class = adv_sug.work_class if adv_sug.work_class in WORK_CLASSES else rule_class
        advisor_conf = adv_sug.confidence
        advisor_source = adv_sug.source or "advisor"

    # Rule ladder and rule slot
    rule_ladder = _ladder_for_class(rule_class)
    rule_slot: Optional[Mapping[str, Any]] = None
    for step_base in rule_ladder:
        slots = eligible_by_base.get(step_base)
        if slots:
            rule_slot = _select_best_slot(slots, counts)
            break
    rule_lane = str(rule_slot.get("lane") or "") if rule_slot is not None else None

    # Advisor ladder and advisor slot (table lookup "class -> lane", whitelist and window remainder)
    advisor_lane: Optional[str] = None
    advisor_slot: Optional[Mapping[str, Any]] = None
    if advisor_class is not None:
        adv_ladder = _ladder_for_class(advisor_class)
        for step_base in adv_ladder:
            slots = eligible_by_base.get(step_base)
            if slots:
                advisor_slot = _select_best_slot(slots, counts)
                advisor_lane = str(advisor_slot.get("lane") or step_base)
                break

    # Determine assigned lane:
    # If advisor is active and has a valid eligible slot -> use advisor_slot;
    # Otherwise (shadow mode, disabled, fallback, or advisor lane unroutable) -> use rule_slot.
    chosen: Optional[Mapping[str, Any]] = None
    chosen_class: str = rule_class
    if advisor_source == "active" and advisor_slot is not None:
        chosen = advisor_slot
        chosen_class = advisor_class
    elif rule_slot is not None:
        chosen = rule_slot
        chosen_class = rule_class

    decision: Optional[RouteDecision] = None
    if chosen is not None:
        lane = str(chosen.get("lane") or chosen_class)
        counts[lane] = int(counts.get(lane, 0)) + 1
        provider_override, model_override = canonical_lane_model(chosen)
        _rank, _left, win_state = window_tier(chosen.get("window_left"))
        billing = str(chosen.get("billing") or capabilities.SUBSCRIPTION)
        overridden = bool(
            (req_model is not None and req_model != model_override)
            or (req_provider is not None and req_provider != provider_override)
        )
        decision = RouteDecision(
            lane=lane,
            assignee=canonical_assignee(lane),
            provider_override=provider_override,
            model_override=model_override,
            work_class=chosen_class,
            billing=billing,
            window_state=win_state,
            requested_model=req_model,
            requested_provider=req_provider,
            overridden_model_wish=overridden,
            blocked_reason=None,
            rule_class=rule_class,
            advisor_class=advisor_class,
            advisor_conf=advisor_conf,
            advisor_source=advisor_source,
            advisor_lane=advisor_lane,
            rule_lane=rule_lane,
        )
    else:
        # Fallback when no lane is eligible
        fallback_base = "yandex" if active_ru.enabled else rule_ladder[0]
        fallback_provider, fallback_model = LANE_MODELS.get(fallback_base, LANE_MODELS["claude-code"])
        validate_model_override(fallback_model, fallback_provider)
        overridden = bool(
            (req_model is not None and req_model != fallback_model)
            or (req_provider is not None and req_provider != fallback_provider)
        )
        reason_summary = ", ".join(rejection_reasons) if rejection_reasons else "no_eligible_lane"
        decision = RouteDecision(
            lane=fallback_base,
            assignee=canonical_assignee(fallback_base),
            provider_override=fallback_provider,
            model_override=fallback_model,
            work_class=rule_class,
            billing=capabilities.METERED if fallback_base != "tool" else capabilities.FREE,
            window_state=WINDOW_UNROUTABLE,
            requested_model=req_model,
            requested_provider=req_provider,
            overridden_model_wish=overridden,
            blocked_reason=f"no_eligible_lane ({reason_summary})",
            rule_class=rule_class,
            advisor_class=advisor_class,
            advisor_conf=advisor_conf,
            advisor_source=advisor_source,
            advisor_lane=advisor_lane,
            rule_lane=rule_lane,
        )

    # Notify route advisors (e.g. shadow logging / pair scheduling)
    if _ROUTE_ADVISORS:
        for adv_hook in _ROUTE_ADVISORS:
            if hasattr(adv_hook, "on_routed"):
                try:
                    adv_hook.on_routed(subtask, decision)
                except Exception:
                    pass

    return decision


def route_subtasks(
    subtasks: Sequence[Mapping[str, Any]],
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    *,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
) -> list[RouteDecision]:
    """Route a batch of decomposed subtasks, balancing load across eligible slots."""
    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    rows = list(catalog) if catalog is not None else default_catalog(allowlist=allowlist)
    usage_counts: dict[str, int] = {}
    return [
        route_subtask(
            subtask,
            rows,
            ru_mode=active_ru,
            allowlist=allowlist,
            usage_counts=usage_counts,
        )
        for subtask in subtasks
    ]


# ---------------------------------------------------------------------------
# Канон моделей октября 2026 (CANONICAL_OCT_2026_POOL)
# ---------------------------------------------------------------------------

CANONICAL_OCT_2026_POOL: dict[str, tuple[str, ...]] = {
    "anthropic": (
        "claude-opus-5-5",
        "claude-fable-5-1",
        "claude-sonnet-5-5",
        "claude-haiku-5-5",
        "claude-opus-4-7",
        "claude-sonnet-4-6",
        "claude-haiku-4-5-20251001",
    ),
    "openai": (
        "gpt-6.1-sol",
        "gpt-6-astra",
        "gpt-6-sol",
        "gpt-6-luna",
        "gpt-5.6-sol",
        "gpt-5.6-terra",
        "gpt-5.6-luna",
        "gpt-5.4",
        "gpt-5.4-mini",
    ),
    "gemini": (
        "gemini-3.1-pro-preview",
        "gemini-3.8-flash",
        "gemini-3.7-flash",
    ),
    "deepseek": (
        "deepseek-v4-pro",
        "deepseek-v4-flash",
        "deepseek-flash",
    ),
    "kimi": (
        "kimi-k3",
        "kimi-k2.7-code",
        "kimi-k2.7-code-highspeed",
        "kimi-k2.6",
    ),
    "ru": (
        "yandexgpt",
        "yandexgpt-lite",
        "gigachat",
        "gigachat-pro",
        "gigachat-max",
    ),
}

_CANONICAL_2026_BY_WORK_CLASS: dict[str, tuple[str, ...]] = {
    WORK_REPO: (
        "claude-fable-5-1",
        "claude-sonnet-5-5",
        "claude-opus-5-5",
        "gpt-6.1-sol",
        "deepseek-v4-pro",
        "kimi-k3",
    ),
    WORK_PRECISE_PATCH: (
        "gpt-6.1-sol",
        "gpt-6-astra",
        "gpt-5.6-sol",
        "kimi-k2.7-code",
        "claude-sonnet-5-5",
        "deepseek-v4-pro",
    ),
    WORK_BULK_CHEAP: (
        "deepseek-v4-flash",
        "gpt-5.6-luna",
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "claude-haiku-5-5",
    ),
    WORK_LARGE_READING: (
        "gemini-3.1-pro-preview",
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "claude-sonnet-5-5",
        "gpt-5.4",
    ),
    WORK_WEB_FACTS: (
        "gemini-3.8-flash",
        "claude-sonnet-5-5",
        "gpt-5.6-sol",
        "deepseek-v4-flash",
    ),
    WORK_RU_CONTOUR: (
        "yandexgpt",
        "gigachat-max",
        "gigachat-pro",
        "yandexgpt-lite",
    ),
    WORK_DETERMINISTIC: ("tool",),
}

_ALL_CANONICAL_2026_MODELS: frozenset[str] = frozenset(
    m for group in CANONICAL_OCT_2026_POOL.values() for m in group
)


def select_canonical_2026_model(
    work_class: str,
    quota_utilization_5h: float = 0.0,
    quota_utilization_7d: float = 0.0,
    cache_warm_model: Optional[str] = None,
    context_tokens: int = 0,
) -> str:
    """Выбрать актуальную модель из пула октября 2026 по классу задачи, квотам и контексту."""
    norm_class = (work_class or "").strip().lower()
    if norm_class == WORK_DETERMINISTIC:
        return "tool"
    if norm_class == WORK_RU_CONTOUR:
        return "yandexgpt"

    max_util = max(float(quota_utilization_5h or 0.0), float(quota_utilization_7d or 0.0))
    if max_util > 1.0:
        max_util = max_util / 100.0

    if cache_warm_model and cache_warm_model in _ALL_CANONICAL_2026_MODELS and max_util < 0.90:
        if int(context_tokens or 0) <= 200_000 or cache_warm_model in (
            "claude-opus-5-5",
            "claude-fable-5-1",
            "claude-sonnet-5-5",
            "gemini-3.1-pro-preview",
            "gemini-3.8-flash",
            "gpt-5.4",
        ):
            return cache_warm_model

    if int(context_tokens or 0) > 400_000:
        if max_util >= 0.85 or norm_class == WORK_LARGE_READING:
            return "gemini-3.1-pro-preview"
        return "claude-sonnet-5-5"

    if max_util >= 0.90:
        if norm_class in (WORK_PRECISE_PATCH, "codex_patch"):
            return "kimi-k2.7-code"
        if norm_class in (WORK_LARGE_READING, "large_context"):
            return "gemini-3.8-flash"
        if norm_class in (WORK_BULK_CHEAP,):
            return "deepseek-v4-flash"
        return "deepseek-v4-pro"

    if max_util >= 0.70:
        if norm_class in (WORK_REPO, "long_repo", "orchestration"):
            return "claude-sonnet-5-5"
        if norm_class in (WORK_PRECISE_PATCH, "codex_patch"):
            return "gpt-5.6-sol"
        if norm_class in (WORK_LARGE_READING, "large_context"):
            return "gemini-3.8-flash"
        return "deepseek-v4-flash"

    ladder = _CANONICAL_2026_BY_WORK_CLASS.get(norm_class)
    if ladder:
        return ladder[0]
    if norm_class in ("architecture", "synthesis", "review_judge", "judge"):
        return "claude-opus-5-5"
    if norm_class in ("long_repo", "orchestration"):
        return "claude-fable-5-1"
    if norm_class in ("codex_patch",):
        return "gpt-6.1-sol"
    if norm_class in ("large_context",):
        return "gemini-3.1-pro-preview"
    return "claude-fable-5-1"

