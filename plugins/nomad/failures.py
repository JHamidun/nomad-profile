"""Таксономия отказов роя на типах блока апстрима + защита от выдуманных ссылок (M-171, N11).

Модуль связывает девять канонических кодов отказа дирижёра роя (спека ``docs/spec-roy-orkestrator.md``
§4.1, §4.2, §5.5) с:

1. **ровно одним детерминированным действием кода** на каждый из 9 кодов отказа — решение «повторить
   ещё раз или переключить» никогда не отдаётся модели;
2. **четырьмя типами блокировки апстрима** ``VALID_BLOCK_KINDS = {"dependency", "needs_input",
   "capability", "transient"}`` (``hermes_cli/kanban_db.py:107`` на 0.21.3, ``:110`` на 0.21.7),
   которые понимают диспетчер Kanban, ``block_task``, счётчик повторных блоков
   ``BLOCK_RECURRENCE_LIMIT`` и автоблок по числу падений;
3. **правилом ``account_disabled``** (§4.2, §4.4, §5.5): отзыв доступа или принудительная мера
   поставщика («without prior notice») даёт **0 ротаций** (``rotate_account=False``,
   ``max_rotations=0``), замораживает дорожку и аккаунт (``freeze_lane=True``,
   ``freeze_account=True``) и докладывает владельцу, чтобы не разнести бан по всему пулу;
4. **повендорным шагом ``limit``** (§4.2, ответ владельца Q5): для **Anthropic** (Claude Code)
   разрешён переход на другую модель того же вендора (``switch_model=True``; ротация аккаунтов —
   только в ``pool_mode: owner_machine`` при другой распознанной личности), а для **Codex**
   (OpenAI) ротация аккаунтов при упоре запрещена условиями поставщика («circumvent any rate
   limits», ``rotate_account=False``, ``max_rotations=0``);
5. **перехватом выдуманных ссылок на карточки**: штатное исключение апстрима
   ``kanban_db.HallucinatedCardsError`` (``kanban_db.py:2607``) при попытке закрыть карточку со
   ссылкой на несуществующую или чужую карточку в ``created_cards`` (а также проверка ссылок
   ``t_<hex>`` через ``core_adapter.kanban.get_task``) переводится в канонический код ``contract``
   с подпричиной ``hallucinated_cards`` и списком фантомных карточек ``phantom_cards``.

Доступ к ядру Hermes идёт только через ``core_adapter`` (гейт ``core-adapter``, M-157). Равенство
``VALID_BLOCK_KINDS`` с ``hermes_cli.kanban_db.VALID_BLOCK_KINDS`` и перехват настоящего
``kanban_db.HallucinatedCardsError`` на временной доске ``kanban.db`` проверяет
``tests/test_failures.py``.
"""

from __future__ import annotations

import enum
import re
import sqlite3
import subprocess
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from typing import Any, Optional

from . import core_adapter

__all__ = [
    "ACTION_ASK_OWNER",
    "ACTION_FREEZE_LANE",
    "ACTION_HOLD_NEW_LAUNCHES",
    "ACTION_REASSIGN_LANE",
    "ACTION_RESTART_FROM_PROGRESS",
    "ACTION_SINGLE_REVISION",
    "ACTION_STOP_AND_REQUEUE",
    "ACTION_VENDOR_LADDER",
    "ACTION_WAIT_DEPENDENCY",
    "BLOCK_CAPABILITY",
    "BLOCK_DEPENDENCY",
    "BLOCK_NEEDS_INPUT",
    "BLOCK_TRANSIENT",
    "CODE_ACCOUNT_DISABLED",
    "CODE_BUDGET",
    "CODE_CAPABILITY",
    "CODE_CONTRACT",
    "CODE_CRASH",
    "CODE_DEPENDENCY",
    "CODE_LIMIT",
    "CODE_NEEDS_OWNER",
    "CODE_TIMEOUT",
    "ConductorAction",
    "FAILURE_ACTIONS",
    "FAILURE_CODES",
    "FailureClassification",
    "FailureCode",
    "FailureDecision",
    "FailureSpec",
    "LimitStepDecision",
    "SUBREASON_EMPTY_COMPLETION",
    "SUBREASON_HALLUCINATED_CARDS",
    "SUBREASON_NOT_LOGGED_IN",
    "SUBREASON_REVISION_REFUSED",
    "TAXONOMY",
    "VALID_BLOCK_KINDS",
    "VENDOR_ANTHROPIC",
    "VENDOR_CODEX",
    "VENDOR_LIMIT_POLICIES",
    "VendorLimitPolicy",
    "action_for_code",
    "block_kind_for_code",
    "classify_failure",
    "decide_failure",
    "extract_card_ids",
    "guard_completion",
    "is_hallucinated_cards_error",
    "normalize_vendor",
    "resolve_limit_step",
    "verify_card_references",
]


# ---------------------------------------------------------------------------
# Типы блокировки апстрима (hermes_cli/kanban_db.py:107 / :110)
# ---------------------------------------------------------------------------

BLOCK_DEPENDENCY = "dependency"
BLOCK_NEEDS_INPUT = "needs_input"
BLOCK_CAPABILITY = "capability"
BLOCK_TRANSIENT = "transient"

# Копия hermes_cli.kanban_db.VALID_BLOCK_KINDS: импортировать kanban_db напрямую в пакете нельзя
# (гейт core-adapter). Точное совпадение с апстримом проверяется в tests/test_failures.py.
VALID_BLOCK_KINDS: frozenset[str] = frozenset({
    BLOCK_DEPENDENCY,
    BLOCK_NEEDS_INPUT,
    BLOCK_CAPABILITY,
    BLOCK_TRANSIENT,
})


# ---------------------------------------------------------------------------
# 9 канонических кодов отказа (спека §5.5) и 9 детерминированных действий
# ---------------------------------------------------------------------------

class FailureCode(str, enum.Enum):
    """Девять канонических кодов отказа роя (спека §5.5)."""

    NEEDS_OWNER = "needs_owner"
    CAPABILITY = "capability"
    DEPENDENCY = "dependency"
    CONTRACT = "contract"
    LIMIT = "limit"
    ACCOUNT_DISABLED = "account_disabled"
    BUDGET = "budget"
    TIMEOUT = "timeout"
    CRASH = "crash"


CODE_NEEDS_OWNER = FailureCode.NEEDS_OWNER.value
CODE_CAPABILITY = FailureCode.CAPABILITY.value
CODE_DEPENDENCY = FailureCode.DEPENDENCY.value
CODE_CONTRACT = FailureCode.CONTRACT.value
CODE_LIMIT = FailureCode.LIMIT.value
CODE_ACCOUNT_DISABLED = FailureCode.ACCOUNT_DISABLED.value
CODE_BUDGET = FailureCode.BUDGET.value
CODE_TIMEOUT = FailureCode.TIMEOUT.value
CODE_CRASH = FailureCode.CRASH.value

FAILURE_CODES: tuple[str, ...] = tuple(code.value for code in FailureCode)


class ConductorAction(str, enum.Enum):
    """Однозначное действие дирижёра на каждый из 9 кодов отказа (§5.5)."""

    ASK_OWNER = "ask_owner"
    REASSIGN_LANE = "reassign_lane"
    WAIT_DEPENDENCY = "wait_dependency"
    SINGLE_REVISION = "request_single_revision"
    VENDOR_LADDER = "step_vendor_ladder"
    FREEZE_LANE = "freeze_lane"
    HOLD_NEW_LAUNCHES = "hold_new_launches"
    STOP_AND_REQUEUE = "stop_and_requeue"
    RESTART_FROM_PROGRESS = "restart_from_progress"


ACTION_ASK_OWNER = ConductorAction.ASK_OWNER.value
ACTION_REASSIGN_LANE = ConductorAction.REASSIGN_LANE.value
ACTION_WAIT_DEPENDENCY = ConductorAction.WAIT_DEPENDENCY.value
ACTION_SINGLE_REVISION = ConductorAction.SINGLE_REVISION.value
ACTION_VENDOR_LADDER = ConductorAction.VENDOR_LADDER.value
ACTION_FREEZE_LANE = ConductorAction.FREEZE_LANE.value
ACTION_HOLD_NEW_LAUNCHES = ConductorAction.HOLD_NEW_LAUNCHES.value
ACTION_STOP_AND_REQUEUE = ConductorAction.STOP_AND_REQUEUE.value
ACTION_RESTART_FROM_PROGRESS = ConductorAction.RESTART_FROM_PROGRESS.value

FAILURE_ACTIONS: tuple[str, ...] = tuple(action.value for action in ConductorAction)

# Именованные подпричины для журнала и проверок.
SUBREASON_HALLUCINATED_CARDS = "hallucinated_cards"
SUBREASON_EMPTY_COMPLETION = "empty_completion"
SUBREASON_REVISION_REFUSED = "revision_refused"
SUBREASON_NOT_LOGGED_IN = "not_logged_in"


@dataclass(frozen=True)
class FailureSpec:
    """Строка таблицы таксономии §5.5: один код -> ровно одно действие и один block_kind апстрима."""

    code: str
    action: str
    block_kind: str
    description: str
    user_template: str
    rotate_account: bool = False
    max_rotations: Optional[int] = 0
    freeze_lane: bool = False
    freeze_account: bool = False
    evict_slot: bool = False
    kill_running: bool = False
    allow_new_launches: bool = True
    max_revisions: int = 0
    max_attempts: int = 1
    report_to_owner: bool = False

    def __post_init__(self) -> None:
        if self.code not in FAILURE_CODES:
            raise ValueError(f"unknown failure code {self.code!r}")
        if self.action not in FAILURE_ACTIONS:
            raise ValueError(f"unknown conductor action {self.action!r}")
        if self.block_kind not in VALID_BLOCK_KINDS:
            raise ValueError(
                f"block_kind {self.block_kind!r} must be one of {sorted(VALID_BLOCK_KINDS)}"
            )


TAXONOMY: Mapping[str, FailureSpec] = {
    CODE_NEEDS_OWNER: FailureSpec(
        code=CODE_NEEDS_OWNER,
        action=ACTION_ASK_OWNER,
        block_kind=BLOCK_NEEDS_INPUT,
        description="Нужно решение владельца или вход в аккаунт (включая предполётный loggedIn: false)",
        user_template="✋ Жду тебя: {detail}",
        rotate_account=False,
        max_rotations=0,
        evict_slot=True,
        report_to_owner=True,
    ),
    CODE_CAPABILITY: FailureSpec(
        code=CODE_CAPABILITY,
        action=ACTION_REASSIGN_LANE,
        block_kind=BLOCK_CAPABILITY,
        description="Исполнителю нечем выполнить шаг — переназначить на дорожку с нужным инструментом",
        user_template="переназначено: нет инструмента ({detail})",
        rotate_account=False,
        max_rotations=0,
        report_to_owner=False,
    ),
    CODE_DEPENDENCY: FailureSpec(
        code=CODE_DEPENDENCY,
        action=ACTION_WAIT_DEPENDENCY,
        block_kind=BLOCK_DEPENDENCY,
        description="Ждёт результат родительской карточки — снять блок автоматически по готовности",
        user_template="ждёт карточку-родителя ({detail})",
        rotate_account=False,
        max_rotations=0,
        report_to_owner=False,
    ),
    CODE_CONTRACT: FailureSpec(
        code=CODE_CONTRACT,
        action=ACTION_SINGLE_REVISION,
        block_kind=BLOCK_NEEDS_INPUT,
        description="Результат не по форме или содержит выдуманные ссылки — ровно одна ревизия, затем к владельцу",
        user_template="одна ревизия, дальше — к тебе ({detail})",
        rotate_account=False,
        max_rotations=0,
        max_revisions=1,
        report_to_owner=False,
    ),
    CODE_LIMIT: FailureSpec(
        code=CODE_LIMIT,
        action=ACTION_VENDOR_LADDER,
        block_kind=BLOCK_TRANSIENT,
        description="Упор в квоту при зелёной предполётной пробе — повендорная лестница §4.2",
        user_template="переключение по лимиту: {detail}",
        rotate_account=False,  # решается повендорно в resolve_limit_step (Codex — всегда False)
        max_rotations=None,
        report_to_owner=False,
    ),
    CODE_ACCOUNT_DISABLED: FailureSpec(
        code=CODE_ACCOUNT_DISABLED,
        action=ACTION_FREEZE_LANE,
        block_kind=BLOCK_NEEDS_INPUT,
        description="Доступ отозван поставщиком — заморозить дорожку, 0 ротаций, доложить владельцу",
        user_template="дорожка {lane} заморожена: доступ отозван ({detail})",
        rotate_account=False,
        max_rotations=0,
        freeze_lane=True,
        freeze_account=True,
        evict_slot=True,
        report_to_owner=True,
    ),
    CODE_BUDGET: FailureSpec(
        code=CODE_BUDGET,
        action=ACTION_HOLD_NEW_LAUNCHES,
        block_kind=BLOCK_NEEDS_INPUT,
        description="Потолок денег или нет ни одной разрешённой дорожки — новых не запускать, живых не убивать",
        user_template="потолок бюджета достигнут ({detail}), поднять?",
        rotate_account=False,
        max_rotations=0,
        kill_running=False,
        allow_new_launches=False,
        report_to_owner=True,
    ),
    CODE_TIMEOUT: FailureSpec(
        code=CODE_TIMEOUT,
        action=ACTION_STOP_AND_REQUEUE,
        block_kind=BLOCK_TRANSIENT,
        description="Дедлайн карточки — стоп-маркер, дедлайн, tree-kill с проверкой start_time; 2-я попытка последняя",
        user_template="{task_id} не уложился, попытка {attempt} из {max_attempts}",
        rotate_account=False,
        max_rotations=0,
        kill_running=True,
        max_attempts=2,
        report_to_owner=False,
    ),
    CODE_CRASH: FailureSpec(
        code=CODE_CRASH,
        action=ACTION_RESTART_FROM_PROGRESS,
        block_kind=BLOCK_TRANSIENT,
        description="Процесс умер — перезапуск с файла прогресса; два падения подряд -> автоблок",
        user_template="{task_id} падает ({attempt} из {max_attempts}), смотрю сам",
        rotate_account=False,
        max_rotations=0,
        max_attempts=2,
        report_to_owner=False,
    ),
}


def _normalize_code(code: str | FailureCode) -> str:
    value = code.value if isinstance(code, FailureCode) else str(code or "").strip().lower()
    if value not in TAXONOMY:
        raise ValueError(f"unknown failure code {code!r}; expected one of {FAILURE_CODES}")
    return value


def action_for_code(code: str | FailureCode) -> str:
    """Ровно одно детерминированное действие дирижёра для канонического кода отказа."""
    return TAXONOMY[_normalize_code(code)].action


def block_kind_for_code(code: str | FailureCode) -> str:
    """Тип блокировки апстрима (из ``VALID_BLOCK_KINDS``) для канонического кода отказа."""
    return TAXONOMY[_normalize_code(code)].block_kind


# ---------------------------------------------------------------------------
# Повендорная лестница для кода `limit` (спека §4.2, Q5)
# ---------------------------------------------------------------------------

VENDOR_ANTHROPIC = "anthropic"
VENDOR_CODEX = "codex"

_VENDOR_ALIASES: Mapping[str, str] = {
    "anthropic": VENDOR_ANTHROPIC,
    "claude": VENDOR_ANTHROPIC,
    "claude-code": VENDOR_ANTHROPIC,
    "claude_code": VENDOR_ANTHROPIC,
    "codex": VENDOR_CODEX,
    "openai": VENDOR_CODEX,
    "openai-codex": VENDOR_CODEX,
    "openai_codex": VENDOR_CODEX,
}

ANTHROPIC_DEFAULT_FALLBACK_MODEL = "claude-sonnet-4-6"


def normalize_vendor(vendor: Optional[str]) -> str:
    """Каноническое имя вендора дорожки (``anthropic``, ``codex`` или нижний регистр как есть)."""
    raw = str(vendor or "").strip().lower()
    if not raw:
        return "unknown"
    return _VENDOR_ALIASES.get(raw, raw)


@dataclass(frozen=True)
class VendorLimitPolicy:
    """Повендорная политика переключения при упоре в квоту (спека §4.2 и ответ владельца Q5)."""

    vendor: str
    ladder_steps: tuple[str, ...]
    allow_account_rotation: bool
    allow_model_switch: bool
    max_rotations: Optional[int]
    default_step: str
    vendor_basis: str


VENDOR_LIMIT_POLICIES: Mapping[str, VendorLimitPolicy] = {
    VENDOR_ANTHROPIC: VendorLimitPolicy(
        vendor=VENDOR_ANTHROPIC,
        # Шаг «другой вендор по API» ответом владельца Q5 (вариант б) не включён по умолчанию.
        ladder_steps=("wait_reset", "rotate_account", "switch_model", "block"),
        allow_account_rotation=True,
        allow_model_switch=True,
        max_rotations=None,
        default_step="switch_model",
        vendor_basis=(
            "Anthropic: документированный подписочный токен для неинтерактивных прогонов "
            "(CLAUDE_CODE_OAUTH_TOKEN) и смена модели того же вендора (спека §4.2, Q5)"
        ),
    ),
    VENDOR_CODEX: VendorLimitPolicy(
        vendor=VENDOR_CODEX,
        # У Codex шага rotate_account нет вовсе: ротация своих аккаунтов в момент упора
        # запрещена условиями OpenAI («circumvent any rate limits», спека §4.2 и §4.4).
        ladder_steps=("smaller_model", "block"),
        allow_account_rotation=False,
        allow_model_switch=False,
        max_rotations=0,
        default_step="no_rotation",
        vendor_basis=(
            "OpenAI Codex: ротация аккаунтов в момент упора запрещена доками вендора "
            "(circumvent any rate limits); без ротации внутри лимитного пула (спека §4.2, Q5)"
        ),
    ),
}


@dataclass(frozen=True)
class LimitStepDecision:
    """Решение по одному шагу повендорной лестницы при коде ``limit``."""

    vendor: str
    step: str
    rotate_account: bool
    switch_model: bool
    max_rotations: int
    should_block: bool
    block_kind: str
    vendor_basis: str
    target_account: Optional[str] = None
    target_model: Optional[str] = None
    cache_tokens_lost: int = 0
    reason: str = "rate_limit"


def _SelectOtherAnthropicAccount(
    current_account: Optional[str],
    available_accounts: Optional[Iterable[Any]],
) -> Optional[str]:
    """Выбрать живой слот ДРУГОЙ распознанной личности с запасом окна >= 20 % или ``unknown``."""
    if not available_accounts:
        return None
    for item in available_accounts:
        if isinstance(item, str):
            candidate_id = item.strip()
            window_left: Any = "unknown"
            alive = True
        elif isinstance(item, Mapping):
            candidate_id = str(item.get("account") or item.get("identity") or item.get("slot") or "").strip()
            window_left = item.get("window_left", "unknown")
            alive = bool(item.get("alive", True))
        else:
            continue
        if not candidate_id or not alive:
            continue
        # Слот на ту же подписку (ту же личность) переключением не считается (§3.3).
        if current_account and candidate_id == current_account:
            continue
        if window_left == "unknown":
            return candidate_id
        if isinstance(window_left, (int, float)) and not isinstance(window_left, bool) and window_left >= 20:
            return candidate_id
    return None


def resolve_limit_step(
    vendor: str,
    *,
    pool_mode: str = "shipped",
    can_wait_reset: bool = False,
    current_account: Optional[str] = None,
    available_accounts: Optional[Iterable[Any]] = None,
    current_model: Optional[str] = None,
    alternate_model: Optional[str] = None,
    smaller_model: Optional[str] = None,
    model_switched: bool = False,
    previous_cache_write_tokens: int = 0,
) -> LimitStepDecision:
    """Вычислить детерминированный повендорный шаг при упоре в квоту (``limit``, §4.2).

    * **Anthropic**:
      1. если окно сбросится до дедлайна (``can_wait_reset=True``) — ``wait_reset``;
      2. иначе если ``pool_mode == "owner_machine"`` и есть живой слот **другой** распознанной
         личности — ``rotate_account``;
      3. иначе если ещё не переключали модель (``model_switched=False``) — ``switch_model``
         (переход на другую модель того же вендора, ``switch_model=True``);
      4. иначе — ``block``.
    * **Codex**:
      Ротация аккаунтов запрещена всегда (``rotate_account=False``, ``max_rotations=0``), даже в
      ``owner_machine`` и при наличии других слотов. Без явно переданной ``smaller_model`` ротации
      модели внутри лимитного пула нет (``switch_model=False``, ``step="no_rotation"``,
      ``should_block=True``); если передана ``smaller_model`` и смена ещё не делалась —
      переход на ``smaller_model`` без ротации аккаунта.
    """
    norm_vendor = normalize_vendor(vendor)
    cache_cost = max(0, int(previous_cache_write_tokens or 0))

    if norm_vendor == VENDOR_ANTHROPIC:
        policy = VENDOR_LIMIT_POLICIES[VENDOR_ANTHROPIC]
        if can_wait_reset:
            return LimitStepDecision(
                vendor=VENDOR_ANTHROPIC,
                step="wait_reset",
                rotate_account=False,
                switch_model=False,
                max_rotations=0,
                should_block=False,
                block_kind=BLOCK_TRANSIENT,
                vendor_basis=policy.vendor_basis,
                cache_tokens_lost=0,
            )
        if pool_mode == "owner_machine":
            next_account = _SelectOtherAnthropicAccount(current_account, available_accounts)
            if next_account is not None:
                return LimitStepDecision(
                    vendor=VENDOR_ANTHROPIC,
                    step="rotate_account",
                    rotate_account=True,
                    switch_model=False,
                    max_rotations=1,
                    should_block=False,
                    block_kind=BLOCK_TRANSIENT,
                    vendor_basis=policy.vendor_basis,
                    target_account=next_account,
                    cache_tokens_lost=cache_cost,
                )
        if not model_switched:
            chosen_model = (alternate_model or "").strip() or ANTHROPIC_DEFAULT_FALLBACK_MODEL
            if current_model and chosen_model == current_model and not alternate_model:
                chosen_model = "claude-haiku-4-5-20251001"
            return LimitStepDecision(
                vendor=VENDOR_ANTHROPIC,
                step="switch_model",
                rotate_account=False,
                switch_model=True,
                max_rotations=0,
                should_block=False,
                block_kind=BLOCK_TRANSIENT,
                vendor_basis=policy.vendor_basis,
                target_model=chosen_model,
                cache_tokens_lost=cache_cost,
            )
        return LimitStepDecision(
            vendor=VENDOR_ANTHROPIC,
            step="block",
            rotate_account=False,
            switch_model=False,
            max_rotations=0,
            should_block=True,
            block_kind=BLOCK_TRANSIENT,
            vendor_basis=policy.vendor_basis,
            cache_tokens_lost=cache_cost,
            reason="anthropic_ladder_exhausted",
        )

    if norm_vendor == VENDOR_CODEX:
        policy = VENDOR_LIMIT_POLICIES[VENDOR_CODEX]
        if smaller_model and not model_switched:
            return LimitStepDecision(
                vendor=VENDOR_CODEX,
                step="smaller_model",
                rotate_account=False,
                switch_model=True,
                max_rotations=0,
                should_block=False,
                block_kind=BLOCK_TRANSIENT,
                vendor_basis=policy.vendor_basis,
                target_model=smaller_model.strip(),
                cache_tokens_lost=cache_cost,
                reason="codex_smaller_model_no_account_rotation",
            )
        return LimitStepDecision(
            vendor=VENDOR_CODEX,
            step="no_rotation",
            rotate_account=False,
            switch_model=False,
            max_rotations=0,
            should_block=True,
            block_kind=BLOCK_TRANSIENT,
            vendor_basis=policy.vendor_basis,
            cache_tokens_lost=cache_cost,
            reason="codex_no_rotation",
        )

    # Прочие провайдеры: ротации подписных слотов нет; если явно дана запасная модель того же
    # провайдера — переключаем модель, иначе блокируем карточку.
    if alternate_model and not model_switched:
        return LimitStepDecision(
            vendor=norm_vendor,
            step="switch_model",
            rotate_account=False,
            switch_model=True,
            max_rotations=0,
            should_block=False,
            block_kind=BLOCK_TRANSIENT,
            vendor_basis=f"{norm_vendor}: смена модели внутри того же провайдера",
            target_model=alternate_model.strip(),
            cache_tokens_lost=cache_cost,
        )
    return LimitStepDecision(
        vendor=norm_vendor,
        step="block",
        rotate_account=False,
        switch_model=False,
        max_rotations=0,
        should_block=True,
        block_kind=BLOCK_TRANSIENT,
        vendor_basis=f"{norm_vendor}: лимит исчерпан, ротация аккаунтов не применяется",
        cache_tokens_lost=cache_cost,
        reason="limit_exhausted",
    )


# ---------------------------------------------------------------------------
# Защита от выдуманных ссылок (kanban_db.HallucinatedCardsError, :2607)
# ---------------------------------------------------------------------------

# То же регулярное выражение, что hermes_cli/kanban_db.py:2589 (_TASK_ID_PROSE_RE).
_CARD_ID_RE = re.compile(r"\bt_[a-f0-9]{8,}\b", re.IGNORECASE)


def extract_card_ids(text: Optional[str]) -> tuple[str, ...]:
    """Извлечь все ссылки вида ``t_<hex>`` из текста с сохранением порядка и без дубликатов."""
    if not text:
        return ()
    return tuple(dict.fromkeys(match.lower() for match in _CARD_ID_RE.findall(str(text))))


def is_hallucinated_cards_error(exc: BaseException | Any) -> bool:
    """Распознать ``hermes_cli.kanban_db.HallucinatedCardsError`` без прямого импорта ``kanban_db``.

    Проверяет имя класса в иерархии наследования, атрибут ``.phantom`` (список выдуманных id из
    ``kanban_db.py:2605``), атрибут ``.missing_ids`` и канонический текст исключения апстрима.
    """
    if not isinstance(exc, BaseException):
        return False
    if any(cls.__name__ == "HallucinatedCardsError" for cls in type(exc).__mro__):
        return True
    phantom = getattr(exc, "phantom", None)
    if isinstance(phantom, (list, tuple, set, frozenset)) and phantom:
        return True
    missing = getattr(exc, "missing_ids", None)
    if isinstance(missing, (list, tuple, set, frozenset)) and missing:
        return True
    msg = str(exc).lower()
    return (
        "claimed created_cards that do not exist" in msg
        or "were not created by this worker" in msg
        or "completion_blocked_hallucination" in msg
    )


def _phantom_ids_from_error(exc: BaseException) -> tuple[str, ...]:
    for attr in ("phantom", "missing_ids", "phantom_cards"):
        raw = getattr(exc, attr, None)
        if isinstance(raw, (list, tuple, set, frozenset)):
            cleaned = tuple(dict.fromkeys(str(x).strip() for x in raw if str(x).strip()))
            if cleaned:
                return cleaned
    extracted = extract_card_ids(str(exc))
    if extracted:
        return extracted
    # Если в HallucinatedCardsError передали произвольные id (не только t_<hex>), достаём хвост после двоеточия.
    text = str(exc)
    if ":" in text:
        tail = text.rsplit(":", 1)[-1]
        parts = tuple(dict.fromkeys(p.strip() for p in tail.split(",") if p.strip()))
        if parts:
            return parts
    return ()


def verify_card_references(
    conn: sqlite3.Connection,
    references: Iterable[str] | str,
    *,
    completing_task_id: Optional[str] = None,
) -> Optional[FailureClassification]:
    """Проверить через ``core_adapter.kanban.get_task``, что все упомянутые карточки существуют.

    Принимает либо коллекцию id карточек (например, ``created_cards`` или ``depends_on``), либо
    строку отчёта воркера, из которой извлекаются ``t_<hex>``. Если хотя бы одной карточки нет в
    ``kanban.db``, возвращает классификацию с кодом ``contract`` и подпричиной
    ``hallucinated_cards``; если все существуют — ``None``.
    """
    if isinstance(references, str):
        candidate_ids = extract_card_ids(references)
    else:
        candidate_ids = tuple(
            dict.fromkeys(str(item).strip() for item in (references or ()) if str(item).strip())
        )
    if not candidate_ids:
        return None
    missing: list[str] = []
    for card_id in candidate_ids:
        if core_adapter.kanban.get_task(conn, card_id) is None:
            missing.append(card_id)
    if not missing:
        return None
    phantom = tuple(missing)
    return FailureClassification(
        code=CODE_CONTRACT,
        subreason=SUBREASON_HALLUCINATED_CARDS,
        message=(
            f"completion blocked: claimed created_cards that do not exist "
            f"or were not created by this worker: {', '.join(phantom)}"
        ),
        phantom_cards=phantom,
        completing_task_id=completing_task_id,
    )


# ---------------------------------------------------------------------------
# Классификация отказов (исключения, HTTP-ответы, строки логов, коды)
# ---------------------------------------------------------------------------

_ACCOUNT_DISABLED_PATTERNS: tuple[str, ...] = (
    "account_disabled",
    "account has been disabled",
    "account is disabled",
    "account disabled",
    "account has been suspended",
    "account is suspended",
    "account suspended",
    "organization has been disabled",
    "organization is disabled",
    "access has been revoked",
    "access revoked",
    "credential revoked",
    "token_revoked",
    "oauth token has been revoked",
    "account banned",
    "user_banned",
    "violating our terms",
    "terms of service violation",
    "take measures to enforce these restrictions",
    "disabled without prior notice",
)

_BUDGET_PATTERNS: tuple[str, ...] = (
    "error_max_budget_usd",
    "max_budget_usd",
    "exceeded max budget",
    "credit_balance_exhausted",
    "organization_spend_limit_exceeded",
    "organization_usage_limit_exceeded",
    "project_spend_limit_exceeded",
    "insufficient_credits",
    "insufficient credits",
    "insufficient_quota",
    "insufficient_balance",
    "insufficient balance",
    "payment_required",
    "payment required",
    "billing_not_active",
    "no_usable_credits",
    "balance_depleted",
    "member_spend_cap_exceeded",
    "terminal_quota_exhausted",
    "personal-team-blocked:spending-limit",
    "insufficient_credits_for_paid_model",
    "budget limit exceeded",
    "hard billing limit",
    "out of extra usage",
    "no_allowed_lane",
    "paid_provider_not_allowed",
    "budget_exceeded",
)

_OVERLOAD_NOT_QUOTA_PATTERNS: tuple[str, ...] = (
    "temporarily overloaded",
    "service is temporarily overloaded",
    "server is overloaded",
    "server overloaded",
    "overloaded_error",
    "this is not your limit",
    "это не ваш лимит",
    "upstream model provider is temporarily unavailable",
)

_LIMIT_PATTERNS: tuple[str, ...] = (
    "rate_limit_error",
    "rate_limit",
    "rate limit",
    "you've hit your usage limit",
    "hit your usage limit",
    "usage limit",
    "quota exceeded",
    "too many requests",
    "throttlingexception",
    "resource_exhausted",
    "anthropic-ratelimit-unified",
)

_NOT_LOGGED_IN_PATTERNS: tuple[str, ...] = (
    "not logged in",
    "please run /login",
    '"loggedin": false',
    '"loggedin":false',
    "loggedin: false",
    "not_logged_in",
)

_CAPABILITY_PATTERNS: tuple[str, ...] = (
    "missing_tool",
    "tool_not_found",
    "tool not found",
    "tool_not_available",
    "unsupported_capability",
    "capability_missing",
    "no tool named",
    "нет инструмента",
)

_DEPENDENCY_PATTERNS: tuple[str, ...] = (
    "dependency_wait",
    "parent_incomplete",
    "parent dependencies are not satisfied",
    "unmet_dependency",
    "waiting for parent",
)

_CONTRACT_PATTERNS: tuple[str, ...] = (
    "completion_blocked_empty_result",
    "has no result or summary evidence",
    "declared scratch artifact",
    "schema_validation_failed",
    "invalid_output_schema",
    "missing_deliverable",
    "contract_violation",
    "suspected_hallucinated_references",
)

_TIMEOUT_PATTERNS: tuple[str, ...] = (
    "timed out",
    "timeout",
    "deadline_exceeded",
    "deadline exceeded",
    "max_runtime_exceeded",
)

_QUOTA_HEADER_PREFIXES: tuple[str, ...] = (
    "anthropic-ratelimit-",
    "x-ratelimit-",
    "ratelimit-",
    "retry-after",
)


def _has_quota_headers(headers: Optional[Mapping[str, Any]]) -> bool:
    if not headers:
        return False
    for key in headers:
        lower = str(key).strip().lower()
        if any(lower.startswith(prefix) for prefix in _QUOTA_HEADER_PREFIXES):
            return True
    return False


@dataclass(frozen=True)
class FailureClassification:
    """Результат классификации отказа в один из 9 канонических кодов."""

    code: str
    subreason: str
    message: str = ""
    phantom_cards: tuple[str, ...] = ()
    completing_task_id: Optional[str] = None
    status_code: Optional[int] = None

    def __post_init__(self) -> None:
        if self.code not in TAXONOMY:
            raise ValueError(f"invalid failure code {self.code!r}")


def classify_failure(
    event: BaseException | Mapping[str, Any] | str | FailureCode,
    *,
    preflight_ok: bool = True,
    status_code: Optional[int] = None,
    headers: Optional[Mapping[str, Any]] = None,
) -> FailureClassification:
    """Классифицировать исключение, словарь события или текст ошибки в один из 9 кодов §5.5.

    Порядок приоритетов исключает опасные смешения:
    1. ``HallucinatedCardsError`` / ``EmptyCompletionError`` / ``ArtifactPreservationError`` апстрима
       -> ``contract`` (с сохранением ``phantom_cards``);
    2. ``TimeoutError`` / ``subprocess.TimeoutExpired`` -> ``timeout``;
    3. явный канонический код из ``FAILURE_CODES``;
    4. ``account_disabled`` проверяется ДО ``limit`` и ``needs_owner``, чтобы отзыв доступа никогда
       не вызвал ротацию слотов;
    5. ``Not logged in`` / ``loggedIn: false``: при ``preflight_ok=False`` -> ``needs_owner``
       (слот выводится из пула), при ``preflight_ok=True`` (всплыло посреди прогона после зелёной
       предполётной пробы, §4.1) -> ``limit``;
    6. ``budget`` (HTTP 402, ``error_max_budget_usd``, ``credit_balance_exhausted``,
       ``organization_spend_limit_exceeded``, отсутствие разрешённой дорожки);
    7. перегруз сервера без заголовков квоты (529 / «temporarily overloaded») -> ``crash`` (повтор
       на том же ключе, а не сжигание лестницы квот);
    8. ``limit`` (429 с заголовками квоты, ``rate_limit_error``, ``usage limit``);
    9. ``capability``, ``dependency``, ``contract``, ``timeout`` по признакам;
    10. всё остальное (ненулевой код выхода, неожиданное исключение) -> ``crash``.
    """
    if isinstance(event, FailureCode):
        return FailureClassification(code=event.value, subreason=event.value, message=event.value)

    if isinstance(event, BaseException):
        if is_hallucinated_cards_error(event):
            phantom = _phantom_ids_from_error(event)
            task_id = getattr(event, "completing_task_id", None) or getattr(event, "task_id", None)
            return FailureClassification(
                code=CODE_CONTRACT,
                subreason=SUBREASON_HALLUCINATED_CARDS,
                message=str(event),
                phantom_cards=phantom,
                completing_task_id=task_id,
            )
        cls_name = type(event).__name__
        if cls_name == "EmptyCompletionError":
            return FailureClassification(
                code=CODE_CONTRACT,
                subreason=SUBREASON_EMPTY_COMPLETION,
                message=str(event),
                completing_task_id=getattr(event, "task_id", None),
            )
        if cls_name == "ArtifactPreservationError":
            return FailureClassification(
                code=CODE_CONTRACT,
                subreason="artifact_preservation_failed",
                message=str(event),
            )
        if isinstance(event, (TimeoutError, subprocess.TimeoutExpired)):
            return FailureClassification(
                code=CODE_TIMEOUT,
                subreason="timeout_exception",
                message=str(event),
            )
        status_code = status_code or getattr(event, "status_code", None)
        raw_text = str(event)
    elif isinstance(event, Mapping):
        if "loggedIn" in event and event.get("loggedIn") is False and preflight_ok:
            # Снимок `claude auth status --json` с `"loggedIn": false` — это предполётная проба,
            # если вызывающий явно не передал другое: классифицируем по правилу §4.1.
            preflight_ok = bool(event.get("preflight_ok", False))
        elif "preflight_ok" in event:
            preflight_ok = bool(event["preflight_ok"])
        status_code = status_code if status_code is not None else event.get("status_code")
        if headers is None and isinstance(event.get("headers"), Mapping):
            headers = event["headers"]
        explicit = str(event.get("code") or event.get("reason") or event.get("error_code") or "").strip().lower()
        msg = str(event.get("message") or event.get("error") or event.get("detail") or "")
        if explicit in TAXONOMY:
            return FailureClassification(
                code=explicit,
                subreason=str(event.get("subreason") or explicit),
                message=msg or explicit,
                phantom_cards=tuple(event.get("phantom_cards") or ()),
                completing_task_id=event.get("task_id"),
                status_code=status_code,
            )
        raw_text = f"{explicit} {msg}".strip()
        if event.get("loggedIn") is False and "not logged in" not in raw_text.lower():
            raw_text = f"{raw_text} not_logged_in".strip()
    else:
        raw_text = str(event or "").strip()
        lower_exact = raw_text.lower()
        if lower_exact in TAXONOMY:
            return FailureClassification(code=lower_exact, subreason=lower_exact, message=raw_text)

    lower = raw_text.lower()
    has_quota_hdrs = _has_quota_headers(headers)

    # 1. Отзыв доступа / бан аккаунта — всегда заморозка дорожки без ротации.
    if any(pat in lower for pat in _ACCOUNT_DISABLED_PATTERNS):
        return FailureClassification(
            code=CODE_ACCOUNT_DISABLED,
            subreason="account_revoked_or_disabled",
            message=raw_text,
            status_code=status_code,
        )

    # 2. Выдуманные ссылки в тексте ошибки (если прилетели строкой из подпроцесса/лога).
    if "claimed created_cards that do not exist" in lower or "completion_blocked_hallucination" in lower:
        return FailureClassification(
            code=CODE_CONTRACT,
            subreason=SUBREASON_HALLUCINATED_CARDS,
            message=raw_text,
            phantom_cards=extract_card_ids(raw_text),
            status_code=status_code,
        )

    # 3. Оговорка §4.1 про «Not logged in»: предполётный loggedIn:false -> needs_owner,
    # а в логе прогона после зелёной предполётной пробы -> limit.
    if any(pat in lower for pat in _NOT_LOGGED_IN_PATTERNS):
        if not preflight_ok:
            return FailureClassification(
                code=CODE_NEEDS_OWNER,
                subreason=SUBREASON_NOT_LOGGED_IN,
                message=raw_text,
                status_code=status_code,
            )
        return FailureClassification(
            code=CODE_LIMIT,
            subreason="not_logged_in_during_run_after_green_preflight",
            message=raw_text,
            status_code=status_code,
        )

    # 4. Бюджет и потолки расхода (HTTP 402, error_max_budget_usd, credit_balance_exhausted).
    if status_code == 402 or any(pat in lower for pat in _BUDGET_PATTERNS):
        return FailureClassification(
            code=CODE_BUDGET,
            subreason="budget_or_credits_exhausted",
            message=raw_text,
            status_code=status_code,
        )

    # 5. Перегруз сервера (529 или «temporarily overloaded» без заголовков квоты) — не квота аккаунта.
    if status_code == 529 or (
        any(pat in lower for pat in _OVERLOAD_NOT_QUOTA_PATTERNS) and not has_quota_hdrs
    ):
        return FailureClassification(
            code=CODE_CRASH,
            subreason="server_overloaded_transient",
            message=raw_text,
            status_code=status_code,
        )

    # 6. Квота / rate limit (429 или явные маркеры квоты при зелёной предполётной пробе).
    if status_code == 429 or has_quota_hdrs or any(pat in lower for pat in _LIMIT_PATTERNS):
        if not preflight_ok:
            return FailureClassification(
                code=CODE_NEEDS_OWNER,
                subreason=SUBREASON_NOT_LOGGED_IN,
                message=raw_text,
                status_code=status_code,
            )
        return FailureClassification(
            code=CODE_LIMIT,
            subreason="rate_or_usage_limit",
            message=raw_text,
            status_code=status_code,
        )

    # 7. Зависимость от родительской карточки.
    if any(pat in lower for pat in _DEPENDENCY_PATTERNS):
        return FailureClassification(
            code=CODE_DEPENDENCY,
            subreason="parent_dependency",
            message=raw_text,
            status_code=status_code,
        )

    # 8. Отсутствие нужного инструмента / возможности на дорожке.
    if any(pat in lower for pat in _CAPABILITY_PATTERNS):
        return FailureClassification(
            code=CODE_CAPABILITY,
            subreason="missing_capability",
            message=raw_text,
            status_code=status_code,
        )

    # 9. Нарушение контракта результата (пустой ответ, нет файла, битая схема).
    if any(pat in lower for pat in _CONTRACT_PATTERNS):
        return FailureClassification(
            code=CODE_CONTRACT,
            subreason="contract_violation",
            message=raw_text,
            phantom_cards=extract_card_ids(raw_text),
            status_code=status_code,
        )

    # 10. Таймаут / дедлайн карточки.
    if status_code in (408, 504) or any(pat in lower for pat in _TIMEOUT_PATTERNS):
        return FailureClassification(
            code=CODE_TIMEOUT,
            subreason="card_deadline_exceeded",
            message=raw_text,
            status_code=status_code,
        )

    # 11. Запрос подтверждения/входа владельца (401/403 без признаков бана).
    if status_code in (401, 403) or "needs_owner" in lower or "permission_denied" in lower:
        return FailureClassification(
            code=CODE_NEEDS_OWNER,
            subreason="owner_input_or_auth_required",
            message=raw_text,
            status_code=status_code,
        )

    # 12. Всё остальное — падение процесса / неожиданный сбой.
    return FailureClassification(
        code=CODE_CRASH,
        subreason="worker_crash",
        message=raw_text or "worker process crashed",
        status_code=status_code,
    )


# ---------------------------------------------------------------------------
# Детерминированное решение дирижёра по коду отказа
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class FailureDecision:
    """Полное детерминированное решение дирижёра по отказу карточки (§5.5)."""

    code: str
    action: str
    block_kind: str
    subreason: str
    should_block: bool
    rotate_account: bool
    max_rotations: int
    switch_model: bool
    freeze_lane: bool
    freeze_account: bool
    evict_slot: bool
    kill_running: bool
    require_expected_start_time: bool
    write_stop_marker: bool
    allow_new_launches: bool
    should_revise: bool
    should_requeue: bool
    resume_from_progress: bool
    auto_unblock_on_parent: bool
    report_to_owner: bool
    user_message: str
    vendor: Optional[str] = None
    vendor_basis: Optional[str] = None
    ladder_step: Optional[str] = None
    target_account: Optional[str] = None
    target_model: Optional[str] = None
    target_lane: Optional[str] = None
    phantom_cards: tuple[str, ...] = ()
    attempt: int = 1
    max_attempts: int = 1
    revision: int = 0
    max_revisions: int = 0
    cache_tokens_lost: int = 0
    extra: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.code not in TAXONOMY:
            raise ValueError(f"invalid failure code {self.code!r}")
        if self.action != TAXONOMY[self.code].action:
            raise ValueError(
                f"code {self.code!r} must map to action {TAXONOMY[self.code].action!r}, "
                f"got {self.action!r}"
            )
        if self.block_kind not in VALID_BLOCK_KINDS:
            raise ValueError(
                f"block_kind {self.block_kind!r} is not in VALID_BLOCK_KINDS {sorted(VALID_BLOCK_KINDS)}"
            )


def decide_failure(
    event: BaseException | FailureClassification | Mapping[str, Any] | str | FailureCode,
    *,
    vendor: Optional[str] = None,
    lane: str = "default",
    task_id: str = "t_unknown",
    pool_mode: str = "shipped",
    preflight_ok: bool = True,
    attempt: int = 1,
    revision: int = 0,
    fallback_lane: Optional[str] = None,
    can_wait_reset: bool = False,
    current_account: Optional[str] = None,
    available_accounts: Optional[Iterable[Any]] = None,
    current_model: Optional[str] = None,
    alternate_model: Optional[str] = None,
    smaller_model: Optional[str] = None,
    model_switched: bool = False,
    previous_cache_write_tokens: int = 0,
    status_code: Optional[int] = None,
    headers: Optional[Mapping[str, Any]] = None,
) -> FailureDecision:
    """Построить единственное детерминированное решение дирижёра для любого отказа (§5.5)."""
    classified = (
        event
        if isinstance(event, FailureClassification)
        else classify_failure(
            event, preflight_ok=preflight_ok, status_code=status_code, headers=headers
        )
    )
    spec = TAXONOMY[classified.code]
    effective_task_id = classified.completing_task_id or task_id
    detail = classified.message or classified.subreason or classified.code

    if classified.code == CODE_ACCOUNT_DISABLED:
        # Жёсткое правило §4.2 / §5.5: 0 ротаций, дорожка и аккаунт заморожены, доклад владельцу.
        return FailureDecision(
            code=CODE_ACCOUNT_DISABLED,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=True,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=True,
            freeze_account=True,
            evict_slot=True,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=False,
            resume_from_progress=False,
            auto_unblock_on_parent=False,
            report_to_owner=True,
            user_message=spec.user_template.format(lane=lane, detail=detail),
            vendor=normalize_vendor(vendor) if vendor else None,
        )

    if classified.code == CODE_LIMIT:
        step_decision = resolve_limit_step(
            vendor or "anthropic",
            pool_mode=pool_mode,
            can_wait_reset=can_wait_reset,
            current_account=current_account,
            available_accounts=available_accounts,
            current_model=current_model,
            alternate_model=alternate_model,
            smaller_model=smaller_model,
            model_switched=model_switched,
            previous_cache_write_tokens=previous_cache_write_tokens,
        )
        msg_detail = (
            f"{lane} · шаг={step_decision.step} · основание: {step_decision.vendor_basis} · "
            f"цена: {step_decision.cache_tokens_lost} токенов записи кэша"
        )
        return FailureDecision(
            code=CODE_LIMIT,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=step_decision.should_block,
            rotate_account=step_decision.rotate_account,
            max_rotations=step_decision.max_rotations,
            switch_model=step_decision.switch_model,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=not step_decision.should_block,
            resume_from_progress=not step_decision.should_block,
            auto_unblock_on_parent=False,
            report_to_owner=step_decision.should_block,
            user_message=spec.user_template.format(detail=msg_detail),
            vendor=step_decision.vendor,
            vendor_basis=step_decision.vendor_basis,
            ladder_step=step_decision.step,
            target_account=step_decision.target_account,
            target_model=step_decision.target_model,
            cache_tokens_lost=step_decision.cache_tokens_lost,
        )

    if classified.code == CODE_CONTRACT:
        # Ровно одна ревизия (revision == 0 -> ревизия, revision >= 1 -> блок needs_input и к владельцу).
        can_revise = revision < spec.max_revisions
        subreason = classified.subreason if can_revise else SUBREASON_REVISION_REFUSED
        if classified.phantom_cards:
            detail = f"выдуманные карточки: {', '.join(classified.phantom_cards)}"
        return FailureDecision(
            code=CODE_CONTRACT,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=subreason,
            should_block=not can_revise,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=can_revise,
            should_requeue=can_revise,
            resume_from_progress=False,
            auto_unblock_on_parent=False,
            report_to_owner=not can_revise,
            user_message=spec.user_template.format(detail=detail),
            phantom_cards=classified.phantom_cards,
            revision=revision,
            max_revisions=spec.max_revisions,
        )

    if classified.code == CODE_NEEDS_OWNER:
        return FailureDecision(
            code=CODE_NEEDS_OWNER,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=True,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=True,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=False,
            resume_from_progress=False,
            auto_unblock_on_parent=False,
            report_to_owner=True,
            user_message=spec.user_template.format(detail=detail),
        )

    if classified.code == CODE_CAPABILITY:
        has_fallback = bool(fallback_lane and str(fallback_lane).strip())
        return FailureDecision(
            code=CODE_CAPABILITY,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=not has_fallback,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=has_fallback,
            resume_from_progress=False,
            auto_unblock_on_parent=False,
            report_to_owner=not has_fallback,
            user_message=spec.user_template.format(detail=detail),
            target_lane=str(fallback_lane).strip() if has_fallback else None,
        )

    if classified.code == CODE_DEPENDENCY:
        return FailureDecision(
            code=CODE_DEPENDENCY,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=True,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=False,
            resume_from_progress=False,
            auto_unblock_on_parent=True,
            report_to_owner=False,
            user_message=spec.user_template.format(detail=detail),
        )

    if classified.code == CODE_BUDGET:
        return FailureDecision(
            code=CODE_BUDGET,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=True,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=False,
            require_expected_start_time=False,
            write_stop_marker=False,
            allow_new_launches=False,
            should_revise=False,
            should_requeue=False,
            resume_from_progress=False,
            auto_unblock_on_parent=False,
            report_to_owner=True,
            user_message=spec.user_template.format(detail=detail),
        )

    if classified.code == CODE_TIMEOUT:
        can_retry = attempt < spec.max_attempts
        return FailureDecision(
            code=CODE_TIMEOUT,
            action=spec.action,
            block_kind=spec.block_kind,
            subreason=classified.subreason,
            should_block=not can_retry,
            rotate_account=False,
            max_rotations=0,
            switch_model=False,
            freeze_lane=False,
            freeze_account=False,
            evict_slot=False,
            kill_running=True,
            require_expected_start_time=True,
            write_stop_marker=True,
            allow_new_launches=True,
            should_revise=False,
            should_requeue=can_retry,
            resume_from_progress=can_retry,
            auto_unblock_on_parent=False,
            report_to_owner=not can_retry,
            user_message=spec.user_template.format(
                task_id=effective_task_id, attempt=attempt, max_attempts=spec.max_attempts
            ),
            attempt=attempt,
            max_attempts=spec.max_attempts,
        )

    # CODE_CRASH
    can_retry = attempt < spec.max_attempts
    return FailureDecision(
        code=CODE_CRASH,
        action=spec.action,
        block_kind=spec.block_kind,
        subreason=classified.subreason,
        should_block=not can_retry,
        rotate_account=False,
        max_rotations=0,
        switch_model=False,
        freeze_lane=False,
        freeze_account=False,
        evict_slot=False,
        kill_running=False,
        require_expected_start_time=False,
        write_stop_marker=False,
        allow_new_launches=True,
        should_revise=False,
        should_requeue=can_retry,
        resume_from_progress=True,
        auto_unblock_on_parent=False,
        report_to_owner=not can_retry,
        user_message=spec.user_template.format(
            task_id=effective_task_id, attempt=attempt, max_attempts=spec.max_attempts
        ),
        attempt=attempt,
        max_attempts=spec.max_attempts,
    )


def guard_completion(
    complete_fn: Callable[..., Any],
    *args: Any,
    revision: int = 0,
    **kwargs: Any,
) -> tuple[bool, Optional[FailureDecision]]:
    """Выполнить закрытие карточки (``complete_task``), перехватывая ``HallucinatedCardsError``.

    Возвращает ``(True, None)`` при успешном закрытии карточки, либо ``(False, decision)`` с
    каноническим кодом ``contract`` (и списком выдуманных карточек в ``decision.phantom_cards``),
    когда ``complete_task`` апстрима выбросил ``HallucinatedCardsError``, ``EmptyCompletionError``
    или ``ArtifactPreservationError``.
    """
    try:
        ok = complete_fn(*args, **kwargs)
    except BaseException as exc:
        if (
            is_hallucinated_cards_error(exc)
            or type(exc).__name__ in ("EmptyCompletionError", "ArtifactPreservationError")
        ):
            return False, decide_failure(exc, revision=revision)
        raise
    return bool(ok), None
