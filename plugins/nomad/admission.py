"""N5 (M-162): pre-tool-call admission guard, red gate, and paid-provider allowlist.

Заслонка на вход (крючок ядра ``pre_tool_call``, спека §1.1, §3.2, §3.6, §5.4, §7 N5):

1. **Перезапись модели и провайдера по политике дорожки**: агент или декомпозитор не выбирает
   модель сам. Если в аргументах вызова канбана/роя указаны ``model="opus"``,
   ``provider="anthropic"`` (или ``model_override`` / ``provider_override``), заслонка вычисляет
   дорожку через :func:`routing.route_subtask` и принудительно перезаписывает ``assignee``,
   ``model`` / ``model_override`` и ``provider`` / ``provider_override`` канонической парой из
   :data:`routing.LANE_MODELS` (а при наличии ``task_id`` в существующей БД канбана синхронизирует
   и SQL-строку ``tasks`` через ``core_adapter.kanban.connect_closing``).
2. **Белый список платных провайдеров (``nomad.paid_provider_allowlist``, по умолчанию ``[]``)**:
   дорожки с тарификацией ``metered`` (``deepseek``, ``gemini``, ``kimi``, ``perplexity``,
   ``yandex`` и прямые API ``anthropic`` / ``openai`` / ``openrouter``) заперты, пока покупатель
   явно не включил их в ``nomad.paid_provider_allowlist``. Ни одна карточка не попадает на платный
   провайдер вне этого списка.
3. **Режим «только РФ» (``nomad.ru_only: true``)**: при включённом флаге заслонка обязательно
   вызывает :func:`ru_only.require_ru_lane` (``ACTION_START_LANE``). Попытка пойти на зарубежную
   дорожку или провайдер блокируется с понятным отказом на русском языке.
4. **Отказобезопасность (fail-closed)**: любое необработанное исключение внутри заслонки
   перехватывается на верхнем уровне и возвращает блокирующий вердикт
   (``{"action": "block", "message": ..., "block": True, "reason": ...}``), не пропуская вызов
   инструмента мимо защиты.

Модуль обращается к ядру Hermes исключительно через :mod:`.core_adapter`.
"""

# nomad-workaround: PR-1 (docs/upstream-prs.md)
# До появления хука pre_kanban_task_create в ядре Hermes (PR-1) заслонка входа
# перехватывает вызовы на уровне pre_tool_call и валидирует модель/протекции до записи.

from __future__ import annotations

import logging
import os
import sqlite3
from collections.abc import Iterable, Mapping, MutableMapping, Sequence
from pathlib import Path
from typing import Any, Optional

from . import capabilities, core_adapter, routing, ru_only

logger = logging.getLogger(__name__)

# Подписные CLI-дорожки и бесплатная локальная дорожка; все остальные внешние провайдеры
# считаются платными по счётчику (metered) и требуют явного присутствия в paid_provider_allowlist.
SUBSCRIPTION_PROVIDERS: frozenset[str] = frozenset({"claude-code", "codex"})
FREE_PROVIDERS: frozenset[str] = frozenset({"tool"})
METERED_PROVIDERS: frozenset[str] = frozenset({
    "deepseek",
    "gemini",
    "kimi",
    "perplexity",
    "yandex",
    "anthropic",
    "openai",
    "openrouter",
    "google",
    "moonshot",
    "xai",
    "mistral",
    "together",
    "fireworks",
    "groq",
})

CARD_TOOL_NAMES: frozenset[str] = frozenset({
    "kanban_create",
    "kanban_update",
    "kanban_assign",
    "kanban_requeue",
})

_CARD_ARG_KEYS: frozenset[str] = frozenset({
    "model",
    "provider",
    "model_override",
    "provider_override",
    "assignee",
    "lane",
    "title",
    "work_class",
})


def provider_billing(provider: Optional[str]) -> str:
    """Classify a provider/lane identifier into ``subscription``, ``free``, or ``metered``."""
    base = routing.base_lane_name(capabilities.normalize_provider(provider or ""))
    if not base:
        return capabilities.SUBSCRIPTION
    if base in SUBSCRIPTION_PROVIDERS:
        return capabilities.SUBSCRIPTION
    if base in FREE_PROVIDERS:
        return capabilities.FREE
    return capabilities.METERED


def is_paid_provider_allowed(
    provider: Optional[str],
    allowlist: Optional[Iterable[str]] = None,
) -> bool:
    """Return ``True`` if ``provider`` is non-metered or explicitly listed in ``allowlist``."""
    billing = provider_billing(provider)
    norm_provider = routing.base_lane_name(capabilities.normalize_provider(provider or ""))
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist)
        if allowlist is not None
        else capabilities.read_paid_allowlist()
    )
    return capabilities.allowed_by_whitelist(billing, norm_provider, active_allowlist)


def _block_verdict(reason: str, *, code: str = "blocked", error: Optional[str] = None) -> dict[str, Any]:
    """Build a fail-closed blocking directive compatible with Hermes ``pre_tool_call`` and tests."""
    clean_reason = (reason or "").strip() or "Вызов инструмента заблокирован заслонкой Nomad."
    verdict: dict[str, Any] = {
        "action": "block",
        "message": clean_reason,
        "block": True,
        "reason": clean_reason,
        "code": code,
    }
    if error is not None:
        verdict["error"] = error
    return verdict


def _build_lane_target(
    *,
    lane_id: Optional[str],
    provider: Optional[str],
    base_url: Optional[str] = None,
    model: Optional[str] = None,
) -> ru_only.LaneTarget:
    """Construct a :class:`ru_only.LaneTarget` for ``ru_only.require_ru_lane`` verification."""
    raw_lane = (lane_id or provider or "claude-code").strip()
    base_lane = routing.base_lane_name(raw_lane) or "claude-code"
    default_provider, default_model = routing.LANE_MODELS.get(base_lane, (base_lane, None))
    clean_provider = (provider or "").strip().lower() or default_provider
    clean_model = (model or "").strip() or default_model
    resolved_url = base_url
    if not resolved_url and base_lane == "yandex":
        resolved_url = ru_only.YANDEX_OPENAI_BASE
    return ru_only.LaneTarget(
        lane_id=raw_lane,
        provider=clean_provider,
        base_url=resolved_url,
        model=clean_model,
    )


def _resolve_existing_kanban_db(
    *,
    db_path: Optional[Path | str] = None,
    board: Optional[str] = None,
) -> Optional[Path]:
    """Return the path to an existing ``kanban.db`` if present on disk, without creating one."""
    if db_path is not None:
        candidate = Path(db_path)
        return candidate if candidate.is_file() else None
    env_db = (os.environ.get("HERMES_KANBAN_DB") or "").strip()
    if env_db:
        candidate = Path(env_db)
        return candidate if candidate.is_file() else None
    try:
        home = core_adapter.get_hermes_home()
    except Exception:
        return None
    if board and board != "default":
        board_db = home / "kanban" / "boards" / str(board).strip() / "kanban.db"
        if board_db.is_file():
            return board_db
    root_db = home / "kanban.db"
    if root_db.is_file():
        return root_db
    default_db = home / "kanban" / "kanban.db"
    if default_db.is_file():
        return default_db
    return None


def _sync_task_in_kanban_db(
    *,
    task_id: str,
    decision: routing.RouteDecision,
    db_path: Optional[Path | str] = None,
    board: Optional[str] = None,
) -> bool:
    """Update an existing card's ``assignee``, ``model_override``, ``provider_override`` in SQL."""
    clean_id = (task_id or "").strip()
    if not clean_id or not decision.model_override or not decision.provider_override:
        return False
    existing_db = _resolve_existing_kanban_db(db_path=db_path, board=board)
    if existing_db is None:
        return False
    with core_adapter.kanban.connect_closing(existing_db, board=board) as conn:
        cur = conn.execute(
            """
            UPDATE tasks
               SET assignee = ?,
                   model_override = ?,
                   provider_override = ?
             WHERE id = ?
            """,
            (
                decision.assignee,
                decision.model_override,
                decision.provider_override,
                clean_id,
            ),
        )
        conn.commit()
        return bool(cur.rowcount)


def enforce_kanban_db_policy(
    conn: sqlite3.Connection,
    *,
    task_id: Optional[str] = None,
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
) -> int:
    """Reconcile cards in ``tasks`` so every card obeys the lane policy and paid allowlist."""
    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only()
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist)
        if allowlist is not None
        else capabilities.read_paid_allowlist()
    )
    active_catalog = (
        list(catalog)
        if catalog is not None
        else routing.default_catalog(allowlist=active_allowlist)
    )

    if task_id:
        rows = conn.execute(
            "SELECT id, title, body, assignee, skills, model_override, provider_override "
            "FROM tasks WHERE id = ?",
            (task_id,),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, title, body, assignee, skills, model_override, provider_override "
            "FROM tasks"
        ).fetchall()

    updated = 0
    for row in rows:
        row_dict = dict(row) if isinstance(row, sqlite3.Row) else {
            "id": row[0],
            "title": row[1],
            "body": row[2],
            "assignee": row[3],
            "skills": row[4],
            "model_override": row[5],
            "provider_override": row[6],
        }
        decision = routing.route_subtask(
            {
                "title": row_dict.get("title") or "",
                "body": row_dict.get("body") or "",
                "assignee": row_dict.get("assignee"),
                "model_override": row_dict.get("model_override"),
                "provider_override": row_dict.get("provider_override"),
            },
            catalog=active_catalog,
            ru_mode=active_ru,
            allowlist=active_allowlist,
        )
        if decision.blocked_reason or not decision.model_override or not decision.provider_override:
            continue
        if (
            row_dict.get("assignee") != decision.assignee
            or row_dict.get("model_override") != decision.model_override
            or row_dict.get("provider_override") != decision.provider_override
        ):
            conn.execute(
                """
                UPDATE tasks
                   SET assignee = ?,
                       model_override = ?,
                       provider_override = ?
                 WHERE id = ?
                """,
                (
                    decision.assignee,
                    decision.model_override,
                    decision.provider_override,
                    row_dict["id"],
                ),
            )
            updated += 1
    if updated:
        conn.commit()
    return updated


def find_disallowed_paid_cards(
    conn: sqlite3.Connection,
    *,
    allowlist: Optional[Iterable[str]] = None,
) -> list[dict[str, Any]]:
    """Query ``tasks`` in SQL for any card assigned to a paid provider outside ``allowlist``."""
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist)
        if allowlist is not None
        else capabilities.read_paid_allowlist()
    )
    rows = conn.execute(
        "SELECT id, title, assignee, model_override, provider_override FROM tasks"
    ).fetchall()
    violations: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row) if isinstance(row, sqlite3.Row) else {
            "id": row[0],
            "title": row[1],
            "assignee": row[2],
            "model_override": row[3],
            "provider_override": row[4],
        }
        provider = item.get("provider_override") or item.get("assignee") or ""
        if not is_paid_provider_allowed(provider, active_allowlist):
            violations.append(item)
    return violations


def admit_card_args(
    args: MutableMapping[str, Any],
    *,
    tool_name: str = "kanban_create",
    catalog: Optional[Sequence[Mapping[str, Any]]] = None,
    ru_mode: Optional[ru_only.RuOnly] = None,
    allowlist: Optional[Iterable[str]] = None,
    config_path: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
) -> routing.RouteDecision:
    """Validate and rewrite card arguments in-place according to lane policy and allowlists.

    Raises :class:`ru_only.RuOnlyRefused` when ``nomad.ru_only`` is active and the target lane or
    provider leaves the RU contour.
    """
    active_ru = ru_mode if ru_mode is not None else ru_only.resolve_ru_only(config_path, env=env)
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist)
        if allowlist is not None
        else capabilities.read_paid_allowlist()
    )
    active_catalog = (
        list(catalog)
        if catalog is not None
        else routing.default_catalog(allowlist=active_allowlist)
    )

    raw_model = (
        args.get("model_override")
        if "model_override" in args and args.get("model_override") is not None
        else args.get("model")
    )
    raw_provider = (
        args.get("provider_override")
        if "provider_override" in args and args.get("provider_override") is not None
        else args.get("provider")
    )
    raw_assignee = args.get("assignee") or args.get("lane")
    raw_base_url = args.get("base_url")

    # При nomad.ru_only=true обязательно проверяем целевую дорожку через ru_only.require_ru_lane.
    if active_ru.enabled:
        explicit_lane = (
            str(raw_assignee).strip()
            if isinstance(raw_assignee, str) and raw_assignee.strip()
            else None
        )
        explicit_provider = (
            str(raw_provider).strip()
            if isinstance(raw_provider, str) and raw_provider.strip()
            else None
        )
        if explicit_lane or explicit_provider or raw_base_url:
            req_target = _build_lane_target(
                lane_id=explicit_lane or explicit_provider,
                provider=explicit_provider or explicit_lane,
                base_url=str(raw_base_url) if raw_base_url else None,
                model=str(raw_model) if isinstance(raw_model, str) else None,
            )
            ru_only.require_ru_lane(
                ru_only.ACTION_START_LANE,
                req_target,
                config_path=config_path,
                env=env,
            )

    subtask_spec: dict[str, Any] = {
        "title": args.get("title") or args.get("goal") or "",
        "body": args.get("body") or "",
        "assignee": raw_assignee,
        "lane": args.get("lane"),
        "skills": args.get("skills") or [],
        "work_class": args.get("work_class"),
        "model": raw_model,
        "provider": raw_provider,
        "model_override": args.get("model_override"),
        "provider_override": args.get("provider_override"),
    }

    decision = routing.route_subtask(
        subtask_spec,
        catalog=active_catalog,
        ru_mode=active_ru,
        allowlist=active_allowlist,
    )

    if active_ru.enabled:
        routed_lane = decision.lane or "yandex"
        routed_provider = decision.provider_override or routed_lane
        routed_target = _build_lane_target(
            lane_id=routed_lane,
            provider=routed_provider,
            base_url=ru_only.YANDEX_OPENAI_BASE if routing.base_lane_name(routed_lane) == "yandex" else None,
            model=decision.model_override,
        )
        ru_only.require_ru_lane(
            ru_only.ACTION_START_LANE,
            routed_target,
            config_path=config_path,
            env=env,
        )

    if decision.blocked_reason or not decision.lane or not decision.model_override or not decision.provider_override:
        return decision

    # Жёсткий инвариант канонической модели дорожки: никогда не оставляем модель из запроса агента.
    base_lane = routing.base_lane_name(decision.lane)
    canonical_provider, canonical_model = routing.LANE_MODELS.get(
        base_lane,
        routing.LANE_MODELS["claude-code"],
    )
    final_provider = decision.provider_override or canonical_provider
    final_model = canonical_model

    if not is_paid_provider_allowed(final_provider, active_allowlist):
        return routing.RouteDecision(
            lane="",
            assignee="",
            provider_override=None,
            model_override=None,
            work_class=decision.work_class,
            billing=provider_billing(final_provider),
            window_state=routing.WINDOW_UNROUTABLE,
            requested_model=decision.requested_model,
            requested_provider=decision.requested_provider,
            overridden_model_wish=decision.overridden_model_wish,
            blocked_reason=(
                f"Платный провайдер {final_provider!r} не разрешён в nomad.paid_provider_allowlist "
                f"(текущий список: {list(active_allowlist)})."
            ),
        )

    final_decision = routing.RouteDecision(
        lane=decision.lane,
        assignee=decision.assignee,
        provider_override=final_provider,
        model_override=final_model,
        work_class=decision.work_class,
        billing=decision.billing,
        window_state=decision.window_state,
        requested_model=decision.requested_model,
        requested_provider=decision.requested_provider,
        overridden_model_wish=decision.overridden_model_wish,
        blocked_reason=None,
    )

    should_set_card_fields = (
        tool_name in CARD_TOOL_NAMES
        or "model" in args
        or "provider" in args
        or "assignee" in args
        or "title" in args
    )
    if should_set_card_fields:
        args["assignee"] = final_decision.assignee
        args["model"] = final_decision.model_override
        args["provider"] = final_decision.provider_override

    if "model_override" in args:
        args["model_override"] = final_decision.model_override
    if "provider_override" in args:
        args["provider_override"] = final_decision.provider_override
    if "lane" in args:
        args["lane"] = final_decision.lane

    return final_decision


def _admit_tool_call_impl(
    tool_name: str = "",
    args: Any = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Internal implementation of ``pre_tool_call`` admission logic."""
    if args is None:
        working_args: MutableMapping[str, Any] = {}
    elif isinstance(args, MutableMapping):
        working_args = args
    else:
        raise TypeError(f"pre_tool_call args must be a mutable mapping, got {type(args).__name__}")

    config_path = kwargs.get("config_path")
    env = kwargs.get("env")
    catalog = kwargs.get("catalog")
    allowlist_override = kwargs.get("allowlist")

    active_ru = ru_only.resolve_ru_only(config_path, env=env)
    active_allowlist = (
        tuple(capabilities.normalize_provider(x) for x in allowlist_override)
        if allowlist_override is not None
        else capabilities.read_paid_allowlist()
    )

    clean_tool = (tool_name or "").strip()
    has_card_keys = bool(set(working_args.keys()) & _CARD_ARG_KEYS)
    is_card_call = (
        clean_tool in CARD_TOOL_NAMES
        or clean_tool == "swarm_start"
        or has_card_keys
        or not clean_tool
    )

    if not is_card_call:
        if active_ru.enabled:
            ru_only.require_ru_lane(
                ru_only.ACTION_START_LANE,
                _build_lane_target(lane_id="yandex", provider="yandex", base_url=ru_only.YANDEX_OPENAI_BASE),
                config_path=config_path,
                env=env,
            )
        return {"action": "allow", "block": False, "args": dict(working_args)}

    try:
        decision = admit_card_args(
            working_args,
            tool_name=clean_tool or "kanban_create",
            catalog=catalog,
            ru_mode=active_ru,
            allowlist=active_allowlist,
            config_path=config_path,
            env=env,
        )
    except ru_only.RuOnlyRefused as exc:
        reason = (
            f"Отказ режима «только РФ» (nomad.ru_only): дорожка {exc.target.lane_id!r} "
            f"(провайдер {exc.target.provider!r}) запрещена вне контура РФ ({exc.reason})."
        )
        return _block_verdict(reason, code="ru_only_refused")

    if decision.blocked_reason or not decision.model_override or not decision.provider_override:
        return _block_verdict(
            decision.blocked_reason or "Нет доступной дорожки для выполнения карточки.",
            code="unroutable",
        )

    target_task_id = (
        kwargs.get("task_id")
        or working_args.get("task_id")
        or working_args.get("id")
    )
    if isinstance(target_task_id, str) and target_task_id.strip():
        _sync_task_in_kanban_db(
            task_id=target_task_id,
            decision=decision,
            db_path=kwargs.get("db_path") or working_args.get("db_path"),
            board=working_args.get("board"),
        )

    return {
        "action": "modify",
        "block": False,
        "args": dict(working_args),
        "lane": decision.lane,
        "assignee": decision.assignee,
        "model": decision.model_override,
        "provider": decision.provider_override,
        "model_override": decision.model_override,
        "provider_override": decision.provider_override,
        "work_class": decision.work_class,
        "billing": decision.billing,
        "overridden_model_wish": decision.overridden_model_wish,
    }


def admit_tool_call(
    tool_name: str = "",
    args: Any = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Fail-closed admission guard callable directly or via ``on_pre_tool_call``."""
    try:
        return _admit_tool_call_impl(tool_name=tool_name, args=args, **kwargs)
    except Exception as exc:
        logger.error("nomad: admission guard exception on tool=%r: %s", tool_name, exc)
        reason = (
            f"Заслонка Nomad заблокировала вызов {tool_name or '<unknown>'!r} "
            f"из-за внутренней ошибки: {exc}"
        )
        return _block_verdict(reason, code="internal_error", error=type(exc).__name__)


def on_pre_tool_call(
    tool_name: str = "",
    args: Any = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Hermes ``pre_tool_call`` hook callback registered by ``nomad.register(ctx)``.

    Never raises and never returns ``None`` on internal failure: any exception inside the guard
    produces a blocking directive so tool execution cannot bypass admission controls.
    """
    try:
        verdict = admit_tool_call(tool_name=tool_name, args=args, **kwargs)
        if not isinstance(verdict, dict):
            raise TypeError(f"admission verdict must be a dict, got {type(verdict).__name__}")
        return verdict
    except Exception as exc:
        logger.error("nomad: unhandled error in on_pre_tool_call for tool=%r: %s", tool_name, exc)
        reason = (
            f"Заслонка Nomad заблокировала вызов {tool_name or '<unknown>'!r} "
            f"из-за критической ошибки: {exc}"
        )
        return _block_verdict(reason, code="internal_error", error=type(exc).__name__)
