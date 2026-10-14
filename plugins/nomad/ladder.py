"""Лестница переключений дорожек при упоре в лимит с проверкой контура «Только РФ» (M-197).

При упоре дорожки в лимит (HTTP 429 / ``limit``) планировщик строит лестницу запасных шагов и
обязан пропустить каждый кандидат через :func:`ru_only.filter_ladder` и
:func:`ru_only.require_ru_lane` с действием ``ACTION_LADDER_STEP``:

* при ``nomad.ru_only=true`` зарубежные шаги (``deepseek``, ``anthropic``, ``openrouter`` и др.)
  и неактивные российские точки (``gigachat``, ``active=False``) отсекаются ДО попытки старта
  дорожки — ни один зарубежный шаг не запускается и не делает сетевых соединений;
* если после упора ``yandex`` в лимит допустимых шагов в контуре РФ не осталось, прогон/карточка
  переводится в ``blocked`` (``reason="limit"``, ``block_kind="transient"``) с русскоязычным
  докладом владельцу в журнале событий ``data.db``;
* при ``nomad.ru_only=false`` те же зарубежные шаги лестницы разрешены и запускаются через
  :func:`conductor.start_lane`.
"""

from __future__ import annotations

import logging
import sqlite3
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from . import conductor, db, failures, ru_only

logger = logging.getLogger("hermes_plugins.nomad.ladder")

EVENT_LADDER_STEP_REFUSED = "ladder_step_refused"
EVENT_LADDER_STEP_STARTED = "ladder_step_started"
EVENT_LADDER_BLOCKED = "ladder_blocked"

DEFAULT_SWITCH_LADDER: tuple[ru_only.LaneTarget, ...] = (
    ru_only.LaneTarget(
        lane_id="yandex",
        provider="yandex",
        base_url=ru_only.YANDEX_OPENAI_BASE,
        model=ru_only.DEFAULT_YANDEX_MODEL,
    ),
    ru_only.LaneTarget(
        lane_id="deepseek",
        provider="deepseek",
        base_url="https://api.deepseek.com/v1",
        model="deepseek-chat",
    ),
    ru_only.LaneTarget(
        lane_id="anthropic",
        provider="anthropic",
        base_url="https://api.anthropic.com",
        model="claude-sonnet-4-6",
    ),
    ru_only.LaneTarget(
        lane_id="openrouter",
        provider="openrouter",
        base_url="https://openrouter.ai/api/v1",
    ),
)


@dataclass(frozen=True)
class LadderPlan:
    """Отфильтрованный план лестницы переключений после упора текущей дорожки в лимит."""

    exhausted_lane: str
    ru_only: bool
    ru_only_source: str
    allowed_steps: tuple[ru_only.LaneTarget, ...]
    refused_steps: tuple[tuple[ru_only.LaneTarget, str], ...]


def normalize_target(
    step: ru_only.LaneTarget | conductor.Lane | Mapping[str, Any] | str,
) -> ru_only.LaneTarget:
    """Привести описание шага лестницы к :class:`ru_only.LaneTarget`."""
    if isinstance(step, ru_only.LaneTarget):
        return step
    if isinstance(step, conductor.Lane):
        prov = conductor._infer_provider(step.lane_id, step.provider)
        base_url = step.base_url
        if not base_url and prov in ("yandex", "custom:yandex"):
            base_url = ru_only.YANDEX_OPENAI_BASE
        return ru_only.LaneTarget(
            lane_id=step.lane_id,
            provider=prov,
            base_url=base_url,
            model=step.model,
        )
    if isinstance(step, Mapping):
        raw_id = str(step.get("lane_id") or step.get("lane") or step.get("provider") or "").strip()
        prov = conductor._infer_provider(raw_id, step.get("provider"))
        base_url = step.get("base_url")
        if not base_url and prov in ("yandex", "custom:yandex"):
            base_url = ru_only.YANDEX_OPENAI_BASE
        return ru_only.LaneTarget(
            lane_id=raw_id or prov,
            provider=prov,
            base_url=str(base_url) if base_url else None,
            model=str(step.get("model")) if step.get("model") else None,
        )
    raw_id = str(step or "").strip()
    prov = conductor._infer_provider(raw_id, None)
    base_url = ru_only.YANDEX_OPENAI_BASE if prov in ("yandex", "custom:yandex") else None
    return ru_only.LaneTarget(
        lane_id=raw_id,
        provider=prov,
        base_url=base_url,
    )


def _same_provider_or_lane(a: ru_only.LaneTarget, b: ru_only.LaneTarget) -> bool:
    if a.lane_id.strip().lower() == b.lane_id.strip().lower():
        return True
    pa = a.provider.strip().lower()
    pb = b.provider.strip().lower()
    if pa.startswith("custom:"):
        pa = pa.split(":", 1)[1]
    if pb.startswith("custom:"):
        pb = pb.split(":", 1)[1]
    return bool(pa and pa == pb)


def build_ladder(
    exhausted_lane: ru_only.LaneTarget | conductor.Lane | Mapping[str, Any] | str,
    candidates: Optional[Iterable[ru_only.LaneTarget | conductor.Lane | Mapping[str, Any] | str]] = None,
    *,
    config_path: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
) -> LadderPlan:
    """Построить план переключения при упоре ``exhausted_lane`` в лимит."""
    exhausted_target = normalize_target(exhausted_lane)
    raw_steps = list(candidates) if candidates is not None else list(DEFAULT_SWITCH_LADDER)
    remaining: list[ru_only.LaneTarget] = []
    for item in raw_steps:
        target = normalize_target(item)
        if _same_provider_or_lane(target, exhausted_target):
            continue
        remaining.append(target)

    mode = ru_only.resolve_ru_only(config_path, env=env)
    allowed, refused = ru_only.filter_ladder(remaining, config_path=config_path, env=env)
    return LadderPlan(
        exhausted_lane=exhausted_target.lane_id,
        ru_only=mode.enabled,
        ru_only_source=mode.source,
        allowed_steps=tuple(allowed),
        refused_steps=tuple(refused),
    )


def step_on_limit(
    conn: sqlite3.Connection,
    exhausted_lane: ru_only.LaneTarget | conductor.Lane | Mapping[str, Any] | str,
    *,
    candidates: Optional[Iterable[ru_only.LaneTarget | conductor.Lane | Mapping[str, Any] | str]] = None,
    swarm_id: Optional[str] = None,
    task_id: str = "",
    config_path: Optional[Path] = None,
    env: Optional[Mapping[str, str]] = None,
) -> dict[str, Any]:
    """Выполнить шаг лестницы переключений после упора ``exhausted_lane`` в лимит (429 / ``limit``).

    При ``nomad.ru_only=true`` все зарубежные кандидаты отсекаются через ``require_ru_lane`` с
    действием ``ACTION_LADDER_STEP`` без единого запуска зарубежной дорожки; если допустимых шагов
    не осталось (например, упор ``yandex`` в лимит), прогон встаёт в ``blocked`` с русскоязычным
    докладом владельцу.
    """
    exhausted_target = normalize_target(exhausted_lane)
    plan = build_ladder(
        exhausted_target,
        candidates,
        config_path=config_path,
        env=env,
    )

    refused_records: list[dict[str, Any]] = []
    for refused_target, _reason in plan.refused_steps:
        try:
            ru_only.require_ru_lane(
                ru_only.ACTION_LADDER_STEP,
                refused_target,
                config_path=config_path,
                env=env,
            )
        except ru_only.RuOnlyRefused as refused_exc:
            rec = {
                "action": ru_only.ACTION_LADDER_STEP,
                "from_lane": exhausted_target.lane_id,
                "lane_id": refused_target.lane_id,
                "provider": refused_target.provider,
                "host": refused_exc.host,
                "reason": refused_exc.reason,
                "ru_only": refused_exc.ru_only.enabled,
                "ru_only_source": refused_exc.ru_only.source,
            }
            if task_id:
                rec["task_id"] = task_id
            refused_records.append(rec)
            db.add_event(conn, EVENT_LADDER_STEP_REFUSED, rec, swarm_id=swarm_id)

    for candidate in plan.allowed_steps:
        try:
            ru_only.require_ru_lane(
                ru_only.ACTION_LADDER_STEP,
                candidate,
                config_path=config_path,
                env=env,
            )
        except ru_only.RuOnlyRefused as refused_exc:
            rec = {
                "action": ru_only.ACTION_LADDER_STEP,
                "from_lane": exhausted_target.lane_id,
                "lane_id": candidate.lane_id,
                "provider": candidate.provider,
                "host": refused_exc.host,
                "reason": refused_exc.reason,
                "ru_only": refused_exc.ru_only.enabled,
                "ru_only_source": refused_exc.ru_only.source,
            }
            if task_id:
                rec["task_id"] = task_id
            refused_records.append(rec)
            db.add_event(conn, EVENT_LADDER_STEP_REFUSED, rec, swarm_id=swarm_id)
            continue

        started = conductor.start_lane(
            conn,
            candidate,
            swarm_id=swarm_id,
            task_id=task_id,
            config_path=config_path,
            env=env,
        )
        if started.get("started"):
            step_detail = {
                "from_lane": exhausted_target.lane_id,
                "to_lane": candidate.lane_id,
                "provider": candidate.provider,
                "ru_only": plan.ru_only,
                "refused_steps": refused_records,
            }
            if task_id:
                step_detail["task_id"] = task_id
            db.add_event(conn, EVENT_LADDER_STEP_STARTED, step_detail, swarm_id=swarm_id)
            return {
                "started": True,
                "switched": True,
                "blocked": False,
                "status": "running",
                "reason": None,
                "block_kind": None,
                "exhausted_lane": exhausted_target.lane_id,
                "next_lane": candidate.lane_id,
                "provider": candidate.provider,
                "ru_only": plan.ru_only,
                "allowed_steps": [s.lane_id for s in plan.allowed_steps],
                "refused_steps": refused_records,
                "foreign_steps_started": 0 if plan.ru_only else (
                    1 if ru_only.classify(candidate)[0] is not None else 0
                ),
                "report": (
                    f"Дорожка {exhausted_target.lane_id} упёрлась в лимит; "
                    f"выполнен переход по лестнице на {candidate.lane_id}."
                ),
            }

    refused_names = ", ".join(r["lane_id"] for r in refused_records) or "нет кандидатов"
    if plan.ru_only:
        report = (
            f"Дорожка {exhausted_target.lane_id} упёрлась в лимит в режиме «Только РФ» "
            f"(nomad.ru_only=true): зарубежные шаги лестницы ({refused_names}) отклонены "
            f"контуром 152-ФЗ, других активных российских провайдеров нет. "
            f"Задача переведена в блок (blocked, reason=limit)."
        )
    else:
        report = (
            f"Дорожка {exhausted_target.lane_id} упёрлась в лимит: все шаги лестницы "
            f"исчерпаны ({refused_names}). Задача переведена в блок (blocked, reason=limit)."
        )

    block_detail: dict[str, Any] = {
        "exhausted_lane": exhausted_target.lane_id,
        "provider": exhausted_target.provider,
        "status": "blocked",
        "reason": failures.CODE_LIMIT,
        "block_kind": failures.BLOCK_TRANSIENT,
        "ru_only": plan.ru_only,
        "ru_only_source": plan.ru_only_source,
        "refused_steps": refused_records,
        "foreign_steps_started": 0,
        "report": report,
    }
    if task_id:
        block_detail["task_id"] = task_id

    db.add_event(conn, EVENT_LADDER_BLOCKED, block_detail, swarm_id=swarm_id)
    if swarm_id:
        try:
            conn.execute("UPDATE swarms SET status = 'blocked' WHERE id = ?", (swarm_id,))
            conn.commit()
        except Exception:
            pass
    logger.warning(
        "nomad: ladder blocked exhausted_lane=%s ru_only=%s refused=%d report=%s",
        exhausted_target.lane_id,
        plan.ru_only,
        len(refused_records),
        report,
    )
    return {
        **block_detail,
        "started": False,
        "switched": False,
        "blocked": True,
        "next_lane": None,
        "allowed_steps": [],
        "message": report,
    }


advance_on_limit = step_on_limit
handle_limit = step_on_limit
execute_ladder_step = step_on_limit


# ---------------------------------------------------------------------------
# Per-vendor limit ladders (M-174: Anthropic vs Codex)
# ---------------------------------------------------------------------------

ANTHROPIC_LIMIT_LADDER: tuple[str, ...] = ("wait_reset", "rotate_account", "switch_model", "block")
CODEX_LIMIT_LADDER: tuple[str, ...] = ("smaller_model", "block")


def vendor_ladder_steps(vendor: str) -> tuple[str, ...]:
    """Return the ordered per-vendor limit ladder steps (M-174).

    - Anthropic (``claude-code``): ``wait_reset`` -> ``rotate_account`` -> ``switch_model`` -> ``block``
    - Codex (``codex``): ``smaller_model`` -> ``block`` (no account rotation)
    """
    norm = failures.normalize_vendor(vendor)
    if norm == failures.VENDOR_CODEX:
        return CODEX_LIMIT_LADDER
    return ANTHROPIC_LIMIT_LADDER


def resolve_vendor_limit_step(
    vendor: str,
    *,
    reset_in_seconds: Optional[float] = None,
    max_wait_seconds: float = 300.0,
    has_alternate_account: bool = False,
    has_smaller_model: bool = False,
) -> dict[str, Any]:
    """Select the next action on the vendor's limit ladder (M-174)."""
    norm = failures.normalize_vendor(vendor)
    steps = vendor_ladder_steps(norm)
    can_wait = reset_in_seconds is not None and 0.0 <= float(reset_in_seconds) <= float(max_wait_seconds)
    decision = failures.resolve_limit_step(
        norm,
        pool_mode="owner" if has_alternate_account else "shipped",
        can_wait_reset=can_wait,
        current_account="slot-a",
        available_accounts=("slot-a", "slot-b") if has_alternate_account else ("slot-a",),
        current_model="default",
        alternate_model="claude-sonnet-4-6" if has_smaller_model else None,
        smaller_model="gpt-5.4-mini" if has_smaller_model else None,
    )
    if norm == failures.VENDOR_CODEX:
        selected = "smaller_model" if decision.step == "smaller_model" else "block"
        allow_rot = False
    else:
        if decision.step == "wait_reset":
            selected = "wait_reset"
        elif decision.step == "switch_account":
            selected = "rotate_account"
        elif decision.step == "switch_model":
            selected = "switch_model"
        else:
            selected = "block"
        allow_rot = True
    return {
        "vendor": norm,
        "ladder_steps": steps,
        "allow_account_rotation": allow_rot,
        "selected_step": selected,
        "should_block": selected == "block",
        "vendor_basis": decision.vendor_basis,
    }


