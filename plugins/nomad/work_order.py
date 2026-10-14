"""Наряд поверх штатного брифа апстрима + таблица глубины (задача M-163, спека §3.5, §5.2, §7 N6).

Правила модуля:

1. **Штатный бриф собирает ядро Hermes** (``hermes_cli.kanban_db.build_worker_context``): заголовок,
   тело карточки, вложения, прошлые попытки, результаты родительских карточек, недавние прогоны роли
   и нитка комментариев. Свой сборщик брифа в плагине **не пишется**. Карточка, назначенная
   штатному профилю Hermes (``default``, ``researcher`` и т.д.), получает ровно штатный бриф
   ядра без вызова нашего сборщика наряда (:func:`build_work_order`).
2. **Наряд содержит ровно 9 ключей** (:data:`WORK_ORDER_KEYS`):
   ``{executor, slot, limits, spend_cap_usd, policy, depth, progress_file, stop_marker, deliverables}``.
   Ни одно поле брифа ядра (:data:`FORBIDDEN_BRIEF_KEYS`: ``title``, ``body``, ``assignee``,
   ``status``, ``comments``, ``attachments``, ``prior_attempts``, ``parent_results`` и др.)
   в наряде не дублируется — ни на верхнем уровне, ни внутри ``limits``/``policy``.
3. **Вход и выход передаются путями на диске**: ``slot``, ``progress_file``, ``stop_marker`` и все
   элементы ``deliverables`` (а при материализации пакета запуска — также ``brief_path`` и
   ``work_order_path``) обязаны быть валидными файловыми путями на диске, а не встроенным текстом.
4. **Глубина вложенности хранится в собственной таблице БД плагина** (``task_depth`` в
   ``<hermes home>/plugin-data/nomad/data.db``, миграция v3 в ``db.py``), не в ``kanban.db``.
   При превышении потолка ``max_depth`` выбрасывается :class:`DepthLimitExceeded` — запись в
   ``task_depth`` не производится и наряд не выдаётся.
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from collections.abc import Callable, Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from . import core_adapter, db
from .db import (
    DEFAULT_MAX_DEPTH,
    DEPTH_TABLE,
    DepthLimitExceeded,
    get_task_depth,
    list_task_depths,
    prune_orphan_depths,
    record_task_depth,
    resolve_task_depth,
)

__all__ = [
    "BriefFieldDuplicationError",
    "CardDispatchPackage",
    "CORE_BRIEF_KEYS",
    "DEFAULT_LIMITS",
    "DEFAULT_MAX_DEPTH",
    "DEFAULT_POLICY",
    "DEPTH_TABLE",
    "DepthLimitExceeded",
    "DepthSpec",
    "FORBIDDEN_BRIEF_KEYS",
    "HERMES_PROFILE_EXECUTOR",
    "InvalidWorkOrderPathError",
    "NOMAD_EXTERNAL_EXECUTORS",
    "UPSTREAM_BRIEF_KEYS",
    "WORK_ORDER_KEYS",
    "WorkOrder",
    "WorkOrderDepthError",
    "WorkOrderError",
    "build_work_order",
    "extract_brief_field_names",
    "get_task_depth",
    "is_hermes_profile",
    "is_nomad_lane",
    "list_task_depths",
    "load_work_order",
    "normalize_executor_lane",
    "prepare_card_dispatch",
    "prune_orphan_depths",
    "record_task_depth",
    "resolve_task_depth",
    "validate_disk_path",
    "validate_work_order",
    "write_work_order",
]

# Ровно 9 разрешённых ключей наряда (спека §3.5, приёмка M-163).
WORK_ORDER_KEYS: frozenset[str] = frozenset({
    "executor",
    "slot",
    "limits",
    "spend_cap_usd",
    "policy",
    "depth",
    "progress_file",
    "stop_marker",
    "deliverables",
})

# Поля карточки и штатного брифа ядра (Task + build_worker_context), которым запрещено
# появляться в наряде (ни на верхнем уровне, ни внутри вложенных словарей limits/policy).
FORBIDDEN_BRIEF_KEYS: frozenset[str] = frozenset({
    "id",
    "task_id",
    "title",
    "body",
    "status",
    "priority",
    "assignee",
    "tenant",
    "skills",
    "parent_id",
    "parent_ids",
    "workspace_kind",
    "workspace_path",
    "branch_name",
    "max_runtime_seconds",
    "terminal_timeout_seconds",
    "model_override",
    "provider_override",
    "reasoning_effort",
    "goal_mode",
    "goal_max_turns",
    "attachments",
    "prior_attempts",
    "parent_results",
    "role_history",
    "recent_work",
    "comments",
    "comment_thread",
    "worker_context",
    "brief",
})
UPSTREAM_BRIEF_KEYS = FORBIDDEN_BRIEF_KEYS
CORE_BRIEF_KEYS = FORBIDDEN_BRIEF_KEYS

# Внешние дорожки, для которых дирижёр Nomad собирает наряд поверх брифа ядра.
NOMAD_EXTERNAL_EXECUTORS: frozenset[str] = frozenset({
    "claude-code",
    "codex-cli",
    "gemini-cli",
    "cursor-agent",
})
HERMES_PROFILE_EXECUTOR = "hermes"

_LANE_ALIASES: dict[str, str] = {
    "claude": "claude-code",
    "claude-code": "claude-code",
    "codex": "codex-cli",
    "codex-cli": "codex-cli",
    "gemini": "gemini-cli",
    "gemini-cli": "gemini-cli",
    "cursor": "cursor-agent",
    "cursor-agent": "cursor-agent",
}
_NOMAD_LANE_PREFIXES: tuple[str, ...] = (
    "nomad:",
    "nomad-",
    "nomad-lane-",
    "lane:",
)

DEFAULT_LIMITS: dict[str, Any] = {
    "max_turns": 40,
    "wall_clock_seconds": 1800,
    "max_retries": 1,
}

DEFAULT_POLICY: dict[str, Any] = {
    "sandbox": "workspace-write",
    "network": "restricted",
    "approval": "never",
}

_WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:[\\/]")


class WorkOrderError(RuntimeError, ValueError):
    """Базовая ошибка сборки или валидации наряда (M-163)."""


class BriefFieldDuplicationError(WorkOrderError):
    """В наряд попало поле штатного брифа ядра (нарушение запрета дублирования §3.5)."""


class InvalidWorkOrderPathError(WorkOrderError):
    """Вход или выход наряда передан не путём на диске (например, пустой строкой или текстом)."""


WorkOrderDepthError = DepthLimitExceeded


class DepthSpec(int):
    """Целое число текущей глубины ``depth``, одновременно поддерживающее доступ к потолку.

    Является подклассом :class:`int`, поэтому ``isinstance(d, int)`` истинно, ``d == current``
    работает как число, и ``json.dumps`` сериализует его в число ``current`` без кастомного
    энкодера, но при этом доступны ``d.current``, ``d.max``, ``d.max_depth``, ``d["current"]``,
    ``d["max"]`` и ``d.to_dict()``.
    """

    current: int
    max: int
    max_depth: int

    def __new__(cls, current: int, max_depth: int = DEFAULT_MAX_DEPTH) -> DepthSpec:
        cur_val = int(current)
        max_val = int(max_depth)
        if cur_val < 0:
            raise ValueError("depth must be >= 0")
        if max_val < 0:
            raise ValueError("max_depth must be >= 0")
        obj = super().__new__(cls, cur_val)
        obj.current = cur_val
        obj.max = max_val
        obj.max_depth = max_val
        return obj

    def __getitem__(self, key: str) -> int:
        if key in ("current", "depth"):
            return self.current
        if key in ("max", "max_depth"):
            return self.max
        raise KeyError(key)

    def get(self, key: str, default: Any = None) -> Any:
        try:
            return self[key]
        except KeyError:
            return default

    def __contains__(self, key: object) -> bool:
        return key in ("current", "depth", "max", "max_depth")

    def to_dict(self) -> dict[str, int]:
        return {"current": self.current, "max": self.max}


def _is_path_like_string(raw: str) -> bool:
    """Return True if *raw* looks like a filesystem path rather than inline prose/markdown."""
    if not raw or not raw.strip():
        return False
    if "\n" in raw or "\r" in raw or "\x00" in raw:
        return False
    stripped = raw.strip()
    if stripped.startswith("# ") or stripped.startswith("## "):
        return False
    if len(stripped) > 1024:
        return False
    if os.path.isabs(stripped) or _WINDOWS_DRIVE_RE.match(stripped):
        return True
    if "/" in stripped or "\\" in stripped:
        return True
    return False


def validate_disk_path(
    value: Any,
    *,
    field_name: str,
    base_dir: Path | str | None = None,
    require_absolute: bool = True,
) -> str:
    """Validate that *value* is a filesystem path (not inline content) and return it as ``str``.

    If *base_dir* is provided and *value* is a relative path (e.g. ``"progress.ndjson"``),
    resolves it under *base_dir*. Rejects empty values, multiline strings, markdown blocks,
    and bare relative tokens when *require_absolute* is True and no *base_dir* is given.
    """
    if isinstance(value, Path):
        raw_str = str(value)
    elif isinstance(value, str):
        raw_str = value
    else:
        raise InvalidWorkOrderPathError(
            f"{field_name}: expected a filesystem path (str or Path), got {type(value).__name__}"
        )

    if not raw_str or not raw_str.strip():
        raise InvalidWorkOrderPathError(f"{field_name}: path must be non-empty")
    if "\n" in raw_str or "\r" in raw_str or "\x00" in raw_str:
        raise InvalidWorkOrderPathError(
            f"{field_name}: must be a filesystem path on disk, not multiline inline text"
        )
    stripped = raw_str.strip()
    if stripped.startswith("# ") or stripped.startswith("## ") or "Kanban task " in stripped:
        raise InvalidWorkOrderPathError(
            f"{field_name}: must be a filesystem path on disk, not inline brief markdown"
        )

    candidate = Path(stripped)
    is_abs = candidate.is_absolute() or bool(_WINDOWS_DRIVE_RE.match(stripped))
    if not is_abs:
        if base_dir is not None:
            candidate = Path(base_dir).resolve() / candidate
            return str(candidate)
        if require_absolute or not _is_path_like_string(stripped):
            raise InvalidWorkOrderPathError(
                f"{field_name}: expected an on-disk path (got relative/inline value {stripped!r})"
            )
    return str(candidate)


def _normalize_deliverables(
    deliverables: Sequence[str | Path] | Mapping[str, str | Path] | None,
    *,
    base_dir: Path | str | None = None,
    require_absolute: bool = True,
) -> list[str] | dict[str, str]:
    """Validate and normalize ``deliverables`` as a non-empty list or dict of on-disk paths."""
    if deliverables is None:
        if base_dir is None:
            raise InvalidWorkOrderPathError(
                "deliverables: must provide deliverable paths or workspace directory"
            )
        default_dir = Path(base_dir).resolve() / "deliverables"
        return [str(default_dir / "result.json")]

    if isinstance(deliverables, (str, Path)):
        raise InvalidWorkOrderPathError(
            "deliverables: must be a sequence or mapping of paths, not a single scalar"
        )

    if isinstance(deliverables, Mapping):
        if not deliverables:
            raise InvalidWorkOrderPathError("deliverables: mapping of paths must be non-empty")
        normalized_map: dict[str, str] = {}
        for key, path_val in deliverables.items():
            k = str(key).strip()
            if not k:
                raise InvalidWorkOrderPathError("deliverables: mapping key must be non-empty")
            if k in FORBIDDEN_BRIEF_KEYS:
                raise BriefFieldDuplicationError(
                    f"deliverables key {k!r} duplicates an upstream brief field"
                )
            normalized_map[k] = validate_disk_path(
                path_val,
                field_name=f"deliverables[{k!r}]",
                base_dir=base_dir,
                require_absolute=require_absolute,
            )
        return normalized_map

    if isinstance(deliverables, Sequence):
        items = list(deliverables)
        if not items:
            raise InvalidWorkOrderPathError("deliverables: list of paths must be non-empty")
        return [
            validate_disk_path(
                item,
                field_name=f"deliverables[{idx}]",
                base_dir=base_dir,
                require_absolute=require_absolute,
            )
            for idx, item in enumerate(items)
        ]

    raise InvalidWorkOrderPathError(
        f"deliverables: expected list or dict of paths, got {type(deliverables).__name__}"
    )


def validate_work_order(
    payload: Mapping[str, Any],
    *,
    require_absolute_paths: bool = True,
) -> dict[str, Any]:
    """Validate that *payload* has strictly :data:`WORK_ORDER_KEYS`, duplicates no brief fields,
    and passes all inputs/outputs as filesystem paths.
    """
    if not isinstance(payload, Mapping):
        raise WorkOrderError(f"work order must be a mapping, got {type(payload).__name__}")

    present_keys = set(payload.keys())
    duplicated_brief = present_keys & FORBIDDEN_BRIEF_KEYS
    if duplicated_brief:
        raise BriefFieldDuplicationError(
            f"work order must not duplicate upstream brief fields: {sorted(duplicated_brief)}"
        )

    extra_keys = present_keys - WORK_ORDER_KEYS
    missing_keys = WORK_ORDER_KEYS - present_keys
    if extra_keys or missing_keys:
        parts: list[str] = []
        if extra_keys:
            parts.append(f"unexpected keys {sorted(extra_keys)}")
        if missing_keys:
            parts.append(f"missing keys {sorted(missing_keys)}")
        raise WorkOrderError(f"work order keys mismatch ({', '.join(parts)})")

    executor = str(payload["executor"]).strip() if payload["executor"] is not None else ""
    if not executor:
        raise WorkOrderError("executor must be a non-empty string")

    slot_path = validate_disk_path(
        payload["slot"],
        field_name="slot",
        require_absolute=require_absolute_paths,
    )
    progress_path = validate_disk_path(
        payload["progress_file"],
        field_name="progress_file",
        require_absolute=require_absolute_paths,
    )
    stop_path = validate_disk_path(
        payload["stop_marker"],
        field_name="stop_marker",
        require_absolute=require_absolute_paths,
    )
    deliverables_paths = _normalize_deliverables(
        payload["deliverables"],
        require_absolute=require_absolute_paths,
    )

    limits = payload["limits"]
    if not isinstance(limits, Mapping):
        raise WorkOrderError("limits must be a mapping")
    nested_brief_in_limits = set(limits.keys()) & FORBIDDEN_BRIEF_KEYS
    if nested_brief_in_limits:
        raise BriefFieldDuplicationError(
            f"limits must not duplicate upstream brief fields: {sorted(nested_brief_in_limits)}"
        )

    policy = payload["policy"]
    if not isinstance(policy, Mapping):
        raise WorkOrderError("policy must be a mapping")
    nested_brief_in_policy = set(policy.keys()) & FORBIDDEN_BRIEF_KEYS
    if nested_brief_in_policy:
        raise BriefFieldDuplicationError(
            f"policy must not duplicate upstream brief fields: {sorted(nested_brief_in_policy)}"
        )

    spend_cap = payload["spend_cap_usd"]
    if spend_cap is not None:
        if isinstance(spend_cap, bool) or not isinstance(spend_cap, (int, float)):
            raise WorkOrderError("spend_cap_usd must be a non-negative number or None")
        if float(spend_cap) < 0.0:
            raise WorkOrderError("spend_cap_usd must be >= 0")
        spend_cap_val: Optional[float] = round(float(spend_cap), 6)
    else:
        spend_cap_val = None

    raw_depth = payload["depth"]
    if isinstance(raw_depth, DepthSpec):
        depth_spec = raw_depth
    elif isinstance(raw_depth, Mapping):
        cur = int(raw_depth.get("current", raw_depth.get("depth", 0)))
        mx = int(raw_depth.get("max", raw_depth.get("max_depth", DEFAULT_MAX_DEPTH)))
        if cur > mx:
            raise DepthLimitExceeded("<work-order>", cur, mx)
        depth_spec = DepthSpec(cur, mx)
    elif not isinstance(raw_depth, bool) and isinstance(raw_depth, int):
        if raw_depth < 0:
            raise WorkOrderError("depth must be >= 0")
        depth_spec = DepthSpec(int(raw_depth), max(int(raw_depth), DEFAULT_MAX_DEPTH))
    else:
        raise WorkOrderError(f"depth must be an int or DepthSpec, got {type(raw_depth).__name__}")

    return {
        "executor": executor,
        "slot": slot_path,
        "limits": dict(limits),
        "spend_cap_usd": spend_cap_val,
        "policy": dict(policy),
        "depth": depth_spec,
        "progress_file": progress_path,
        "stop_marker": stop_path,
        "deliverables": deliverables_paths,
    }


@dataclass(frozen=True)
class WorkOrder(Mapping[str, Any]):
    """Типизированная обёртка наряда, совместимая с ``Mapping`` и ``dict``."""

    executor: str
    slot: str
    limits: dict[str, Any]
    spend_cap_usd: Optional[float]
    policy: dict[str, Any]
    depth: DepthSpec
    progress_file: str
    stop_marker: str
    deliverables: list[str] | dict[str, str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "executor": self.executor,
            "slot": self.slot,
            "limits": dict(self.limits),
            "spend_cap_usd": self.spend_cap_usd,
            "policy": dict(self.policy),
            "depth": self.depth,
            "progress_file": self.progress_file,
            "stop_marker": self.stop_marker,
            "deliverables": (
                dict(self.deliverables)
                if isinstance(self.deliverables, Mapping)
                else list(self.deliverables)
            ),
        }

    def __getitem__(self, key: str) -> Any:
        return self.to_dict()[key]

    def __iter__(self):
        return iter(WORK_ORDER_KEYS)

    def __len__(self) -> int:
        return len(WORK_ORDER_KEYS)


def normalize_executor_lane(
    assignee: Optional[str],
    *,
    nomad_lanes: Optional[Iterable[str]] = None,
) -> Optional[str]:
    """Return canonical Nomad external executor name for *assignee*, or ``None`` if *assignee*
    is a standard Hermes profile.
    """
    if not assignee or not str(assignee).strip():
        return None
    raw = str(assignee).strip().lower()
    allowed_lanes = (
        {str(x).strip().lower() for x in nomad_lanes}
        if nomad_lanes is not None
        else set(NOMAD_EXTERNAL_EXECUTORS)
    )
    if raw in allowed_lanes:
        return _LANE_ALIASES.get(raw, raw)
    if raw in _LANE_ALIASES and _LANE_ALIASES[raw] in allowed_lanes:
        return _LANE_ALIASES[raw]
    for prefix in _NOMAD_LANE_PREFIXES:
        if raw.startswith(prefix):
            tail = raw[len(prefix):].strip()
            canon = _LANE_ALIASES.get(tail, tail)
            if canon in allowed_lanes:
                return canon
    return None


def is_nomad_lane(
    assignee: Optional[str],
    *,
    nomad_lanes: Optional[Iterable[str]] = None,
) -> bool:
    """Return ``True`` when *assignee* targets an external Nomad executor lane."""
    return normalize_executor_lane(assignee, nomad_lanes=nomad_lanes) is not None


def is_hermes_profile(
    assignee: Optional[str],
    *,
    nomad_lanes: Optional[Iterable[str]] = None,
) -> bool:
    """Return ``True`` when *assignee* is a standard Hermes profile (receives upstream brief
    directly without calling Nomad's work order builder).
    """
    return not is_nomad_lane(assignee, nomad_lanes=nomad_lanes)


def _default_run_dir(workspace: Path | str | None, task_id: Optional[str]) -> Path:
    tid = str(task_id).strip() if task_id and str(task_id).strip() else "run"
    if workspace is not None:
        return Path(workspace).resolve() / ".nomad" / tid
    return (core_adapter.plugin_data_dir(db.PLUGIN_NAME) / "work-orders" / tid).resolve()


def _default_slot_dir(executor: str, slot: Path | str | None) -> str:
    if slot is not None:
        return validate_disk_path(slot, field_name="slot", require_absolute=True)
    slot_root = (
        core_adapter.plugin_data_dir(db.PLUGIN_NAME) / "slots" / executor / "slot-0"
    ).resolve()
    return str(slot_root)


def build_work_order(
    *,
    executor: str,
    slot: str | Path | None = None,
    workspace: str | Path | None = None,
    limits: Optional[Mapping[str, Any]] = None,
    spend_cap_usd: Optional[float | int] = 0.0,
    policy: Optional[Mapping[str, Any]] = None,
    depth: int | DepthSpec | None = None,
    max_depth: Optional[int] = None,
    progress_file: str | Path | None = None,
    stop_marker: str | Path | None = None,
    deliverables: Sequence[str | Path] | Mapping[str, str | Path] | None = None,
    nomad_conn: Optional[sqlite3.Connection] = None,
    task_id: Optional[str] = None,
    parent_task_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    board: str = "default",
    extra_fields: Optional[Mapping[str, Any]] = None,
) -> dict[str, Any]:
    """Assemble and validate a Nomad work order dictionary with strictly :data:`WORK_ORDER_KEYS`.

    * Never duplicates any field from the upstream brief (:data:`FORBIDDEN_BRIEF_KEYS`).
    * Checks and records task nesting depth in ``task_depth`` (when ``nomad_conn`` and ``task_id``
      are provided), raising :class:`DepthLimitExceeded` if ``depth > max_depth``.
    * Ensures ``slot``, ``progress_file``, ``stop_marker``, and ``deliverables`` are on-disk paths.
    """
    if extra_fields:
        candidate = dict(extra_fields)
        duplicated = set(candidate.keys()) & FORBIDDEN_BRIEF_KEYS
        if duplicated:
            raise BriefFieldDuplicationError(
                f"work order must not duplicate upstream brief fields: {sorted(duplicated)}"
            )
        unknown = set(candidate.keys()) - WORK_ORDER_KEYS
        if unknown:
            raise WorkOrderError(f"work order received unexpected keys: {sorted(unknown)}")

    effective_max = DEFAULT_MAX_DEPTH if max_depth is None else int(max_depth)
    if effective_max < 0:
        raise WorkOrderError("max_depth must be >= 0")

    explicit_depth = int(depth) if depth is not None else None
    if nomad_conn is not None and task_id:
        depth_row = record_task_depth(
            nomad_conn,
            task_id,
            parent_task_id=parent_task_id,
            swarm_id=swarm_id,
            depth=explicit_depth,
            max_depth=max_depth,
            board=board,
        )
        resolved_depth = int(depth_row["depth"])
        effective_max = int(depth_row["max_depth"])
    else:
        resolved_depth = explicit_depth if explicit_depth is not None else (1 if parent_task_id else 0)
        if resolved_depth < 0:
            raise WorkOrderError("depth must be >= 0")
        if resolved_depth > effective_max:
            raise DepthLimitExceeded(
                task_id or "<anonymous>",
                resolved_depth,
                effective_max,
                parent_task_id=parent_task_id,
                board=board,
            )

    run_dir = _default_run_dir(workspace, task_id)
    base_for_rel = Path(workspace).resolve() if workspace is not None else run_dir

    exec_name = str(executor).strip() if executor is not None else ""
    if not exec_name:
        raise WorkOrderError("executor must be non-empty")

    slot_path = _default_slot_dir(exec_name, slot)
    progress_path = (
        validate_disk_path(progress_file, field_name="progress_file", base_dir=base_for_rel)
        if progress_file is not None
        else str(run_dir / "progress.ndjson")
    )
    stop_path = (
        validate_disk_path(stop_marker, field_name="stop_marker", base_dir=base_for_rel)
        if stop_marker is not None
        else str(run_dir / "STOP")
    )
    deliverables_paths = _normalize_deliverables(
        deliverables,
        base_dir=base_for_rel,
        require_absolute=True,
    )

    merged_limits = dict(DEFAULT_LIMITS) if limits is None else dict(limits)
    merged_policy = dict(DEFAULT_POLICY) if policy is None else dict(policy)

    raw_order: dict[str, Any] = {
        "executor": exec_name,
        "slot": slot_path,
        "limits": merged_limits,
        "spend_cap_usd": spend_cap_usd,
        "policy": merged_policy,
        "depth": DepthSpec(resolved_depth, effective_max),
        "progress_file": progress_path,
        "stop_marker": stop_path,
        "deliverables": deliverables_paths,
    }
    return validate_work_order(raw_order, require_absolute_paths=True)


def write_work_order(
    order: Mapping[str, Any],
    path: str | Path,
) -> Path:
    """Validate *order* and write it as UTF-8 JSON to *path* on disk."""
    validated = validate_work_order(order, require_absolute_paths=True)
    target = Path(validate_disk_path(path, field_name="work_order_path", require_absolute=True))
    target.parent.mkdir(parents=True, exist_ok=True)
    # Create parent directories for output/signal files so executors can write immediately.
    Path(validated["progress_file"]).parent.mkdir(parents=True, exist_ok=True)
    Path(validated["stop_marker"]).parent.mkdir(parents=True, exist_ok=True)
    delivs = validated["deliverables"]
    for dpath in (delivs.values() if isinstance(delivs, Mapping) else delivs):
        Path(dpath).parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(validated, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return target


def load_work_order(path: str | Path) -> dict[str, Any]:
    """Read and validate a work order JSON file from disk."""
    source = Path(validate_disk_path(path, field_name="work_order_path", require_absolute=True))
    raw = json.loads(source.read_text(encoding="utf-8"))
    return validate_work_order(raw, require_absolute_paths=True)


def extract_brief_field_names() -> frozenset[str]:
    """Return the set of upstream brief / task field names prohibited inside a work order."""
    return FORBIDDEN_BRIEF_KEYS


@dataclass(frozen=True)
class CardDispatchPackage:
    """Result of preparing a Kanban card for execution (M-163).

    * For a standard **Hermes profile** card (``is_hermes_profile=True``):
      ``brief`` comes directly from upstream's ``build_worker_context`` and ``work_order`` is
      ``None`` (our work order builder is never called).
    * For a **Nomad external lane** card (``is_hermes_profile=False``):
      both the upstream brief and the 9-key Nomad ``work_order`` are materialized on disk and
      passed as file paths (``brief_path``, ``work_order_path``).
    """

    task_id: str
    assignee: str
    is_hermes_profile: bool
    brief: Optional[str]
    brief_path: Optional[str]
    work_order: Optional[dict[str, Any]]
    work_order_path: Optional[str]


def prepare_card_dispatch(
    kanban_conn: sqlite3.Connection,
    task_id: str,
    *,
    nomad_conn: Optional[sqlite3.Connection] = None,
    brief_fn: Optional[Callable[[sqlite3.Connection, str], str]] = None,
    slot: str | Path | None = None,
    workspace: str | Path | None = None,
    limits: Optional[Mapping[str, Any]] = None,
    spend_cap_usd: Optional[float | int] = 0.0,
    policy: Optional[Mapping[str, Any]] = None,
    depth: Optional[int] = None,
    max_depth: Optional[int] = None,
    parent_task_id: Optional[str] = None,
    swarm_id: Optional[str] = None,
    board: str = "default",
    progress_file: str | Path | None = None,
    stop_marker: str | Path | None = None,
    deliverables: Sequence[str | Path] | Mapping[str, str | Path] | None = None,
    nomad_lanes: Optional[Iterable[str]] = None,
) -> CardDispatchPackage:
    """Prepare a Kanban card for execution according to its assignee (M-163 / N6).

    * If the card is assigned to a standard **Hermes profile** (e.g. ``default``, ``researcher``),
      it receives ONLY the standard upstream brief via *brief_fn* (`build_worker_context`) and
      **never** invokes :func:`build_work_order`.
    * If the card is assigned to a **Nomad external executor lane** (e.g. ``claude-code``,
      ``codex-cli``, ``gemini-cli``, ``cursor-agent``), it checks/records nesting depth in
      ``task_depth``, builds the 9-key work order via :func:`build_work_order`, and writes both
      the upstream brief and the work order to disk so inputs and outputs are passed by paths.
    """
    task = core_adapter.kanban.get_task(kanban_conn, task_id)
    if task is None:
        raise LookupError(f"kanban task {task_id!r} not found")

    assignee = (getattr(task, "assignee", None) or "default").strip() or "default"
    lane = normalize_executor_lane(assignee, nomad_lanes=nomad_lanes)

    # Карточка штатного профиля Hermes: получает штатный бриф ядра БЕЗ вызова нашего сборщика.
    if lane is None:
        upstream_brief = brief_fn(kanban_conn, task.id) if brief_fn is not None else None
        return CardDispatchPackage(
            task_id=task.id,
            assignee=assignee,
            is_hermes_profile=True,
            brief=upstream_brief,
            brief_path=None,
            work_order=None,
            work_order_path=None,
        )

    effective_parent = (
        parent_task_id
        if parent_task_id is not None
        else getattr(task, "parent_id", None)
    )
    effective_workspace = (
        workspace
        if workspace is not None
        else (getattr(task, "workspace_path", None) or None)
    )

    order = build_work_order(
        executor=lane,
        slot=slot,
        workspace=effective_workspace,
        limits=limits,
        spend_cap_usd=spend_cap_usd,
        policy=policy,
        depth=depth,
        max_depth=max_depth,
        progress_file=progress_file,
        stop_marker=stop_marker,
        deliverables=deliverables,
        nomad_conn=nomad_conn,
        task_id=task.id,
        parent_task_id=effective_parent,
        swarm_id=swarm_id,
        board=board,
    )

    run_dir = Path(order["progress_file"]).parent
    run_dir.mkdir(parents=True, exist_ok=True)
    order_file = write_work_order(order, run_dir / "work_order.json")

    upstream_brief = brief_fn(kanban_conn, task.id) if brief_fn is not None else None
    brief_file_path: Optional[str] = None
    if upstream_brief is not None:
        bpath = (run_dir / "brief.md").resolve()
        bpath.write_text(upstream_brief, encoding="utf-8")
        brief_file_path = str(bpath)

    return CardDispatchPackage(
        task_id=task.id,
        assignee=assignee,
        is_hermes_profile=False,
        brief=upstream_brief,
        brief_path=brief_file_path,
        work_order=order,
        work_order_path=str(order_file),
    )
