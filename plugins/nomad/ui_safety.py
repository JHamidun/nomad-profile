"""Экран «Разрешения и безопасность» (`/nomad-safety`, M-140).

Собирает подсказки для постоянного белого списка команд (`command_allowlist`)
по истории вызовов инструментов в `state.db` через `hermes approvals suggest --json` (`ui_cli`),
позволяет принимать/отключать правила `command_allowlist`, а также управлять списком
жёстких запретов `approvals.deny` (блокирующих команды даже при включённом `--yolo`) через `ui_config`.
"""

from __future__ import annotations

import fnmatch
import json
from pathlib import Path
import re
from typing import Any, Iterable, Sequence

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from . import core_adapter, profile_config, ui_cli, ui_config

_SEGMENT_SPLIT_RE = re.compile(r"\s*(?:\|\||&&|\||;|\n)\s*")


class PatternRequest(BaseModel):
    pattern: str = Field(..., min_length=1, max_length=500)


class DenyListUpdateRequest(BaseModel):
    deny: list[str] = Field(default_factory=list)


class CommandCheckRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=2000)
    yolo: bool = False


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _matches_existing(command: str, existing: set[str]) -> bool:
    for pat in existing:
        if pat == command or fnmatch.fnmatch(command, pat):
            return True
    return False


def get_command_allowlist(*, home: Path | None = None) -> list[str]:
    cfg_path = (_resolve_home(home) / "config.yaml") if home is not None else None
    cfg = profile_config.load_strict(cfg_path)
    raw = cfg.get("command_allowlist")
    if not isinstance(raw, list):
        return []
    return [str(x).strip() for x in raw if isinstance(x, str) and str(x).strip()]


def save_command_allowlist(patterns: Iterable[str], *, home: Path | None = None) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for p in patterns:
        s = str(p or "").strip()
        if s and s not in seen:
            seen.add(s)
            cleaned.append(s)
    cleaned.sort()
    ui_config.update_global_config({"command_allowlist": cleaned}, raise_on_error=True)
    return get_command_allowlist(home=home)


def add_allowlist_pattern(pattern: str, *, home: Path | None = None) -> dict[str, Any]:
    cleaned = (pattern or "").strip()
    if not cleaned:
        raise ValueError("Укажите шаблон команды для разрешения.")
    current = set(get_command_allowlist(home=home))
    current.add(cleaned)
    save_command_allowlist(current, home=home)
    return get_safety_overview(home=home)


def remove_allowlist_pattern(pattern: str, *, home: Path | None = None) -> dict[str, Any]:
    cleaned = (pattern or "").strip()
    if not cleaned:
        raise ValueError("Укажите шаблон команды для удаления из разрешённых.")
    current = [p for p in get_command_allowlist(home=home) if p != cleaned]
    save_command_allowlist(current, home=home)
    return get_safety_overview(home=home)


def get_deny_rules(*, home: Path | None = None) -> list[str]:
    cfg_path = (_resolve_home(home) / "config.yaml") if home is not None else None
    cfg = profile_config.load_strict(cfg_path)
    approvals = cfg.get("approvals")
    if not isinstance(approvals, dict):
        return []
    raw_deny = approvals.get("deny")
    if not isinstance(raw_deny, list):
        return []
    return [str(x).strip() for x in raw_deny if isinstance(x, str) and str(x).strip()]


def save_deny_rules(rules: Sequence[str], *, home: Path | None = None) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for r in rules:
        s = str(r or "").strip()
        if s and s not in seen:
            seen.add(s)
            cleaned.append(s)
    ui_config.update_global_config({"approvals.deny": cleaned}, raise_on_error=True)
    return get_deny_rules(home=home)


def add_deny_rule(pattern: str, *, home: Path | None = None) -> dict[str, Any]:
    cleaned = (pattern or "").strip()
    if not cleaned:
        raise ValueError("Укажите шаблон запрещаемой команды.")
    current = get_deny_rules(home=home)
    if cleaned not in current:
        current.append(cleaned)
    save_deny_rules(current, home=home)
    return get_safety_overview(home=home)


def remove_deny_rule(pattern: str, *, home: Path | None = None) -> dict[str, Any]:
    cleaned = (pattern or "").strip()
    if not cleaned:
        raise ValueError("Укажите шаблон запрещаемой команды для удаления.")
    current = [r for r in get_deny_rules(home=home) if r != cleaned]
    save_deny_rules(current, home=home)
    return get_safety_overview(home=home)


def match_user_deny_rule(command: str, *, home: Path | None = None) -> str | None:
    """Проверить команду по правилам `approvals.deny` (в точности как `tools.approval_floors._match_user_deny_rule`)."""
    rules = get_deny_rules(home=home)
    if not rules:
        return None
    full = command.strip()
    segments = [seg.strip() for seg in _SEGMENT_SPLIT_RE.split(full) if seg.strip()]
    targets = [full, *segments]
    for pat in rules:
        for target in targets:
            if fnmatch.fnmatchcase(target, pat) or fnmatch.fnmatchcase(" ".join(target.split()), pat):
                return pat
    return None


def evaluate_command_safety(
    command: str,
    *,
    yolo: bool = False,
    home: Path | None = None,
) -> dict[str, Any]:
    """Проверить, будет ли команда разрешена или заблокирована (в том числе при `--yolo`)."""
    cleaned = (command or "").strip()
    if not cleaned:
        raise ValueError("Укажите команду для проверки.")

    matched_deny = match_user_deny_rule(cleaned, home=home)
    if matched_deny is not None:
        return {
            "ok": True,
            "command": cleaned,
            "yolo": bool(yolo),
            "approved": False,
            "blocked": True,
            "user_deny": True,
            "matched_deny_rule": matched_deny,
            "reason": f"Заблокировано вашим правилом запрета (approvals.deny: {matched_deny!r}) — действует даже в режиме --yolo.",
        }

    allowlist = set(get_command_allowlist(home=home))
    is_allowed = _matches_existing(cleaned, allowlist)
    return {
        "ok": True,
        "command": cleaned,
        "yolo": bool(yolo),
        "approved": bool(is_allowed or yolo),
        "blocked": False,
        "user_deny": False,
        "allowlisted": is_allowed,
        "matched_deny_rule": None,
        "reason": (
            "Команда разрешена постоянным списком command_allowlist."
            if is_allowed
            else (
                "Разрешено в режиме --yolo (правила approvals.deny не сработали)."
                if yolo
                else "Потребуется подтверждение при выполнении."
            )
        ),
    }


def get_suggestions(
    *,
    days: int = 30,
    min_count: int = 2,
    limit: int = 25,
    home: Path | None = None,
) -> dict[str, Any]:
    """Вернуть подсказки `proposals` через `hermes approvals suggest --json` (`ui_cli`)."""
    resolved_home = _resolve_home(home)
    db_path = resolved_home / "state.db"
    if not db_path.exists():
        return {
            "ok": True,
            "db": str(db_path),
            "db_path": str(db_path),
            "days": days,
            "min_count": min_count,
            "proposals": [],
        }

    res = ui_cli.run_hermes(
        [
            "approvals",
            "suggest",
            "--json",
            "--db",
            str(db_path),
            "--days",
            str(days),
            "--min-count",
            str(min_count),
            "--limit",
            str(limit),
        ]
    )
    proposals: list[dict[str, Any]] = []
    if res.get("ok") and res.get("stdout"):
        try:
            parsed = json.loads(res["stdout"])
            if isinstance(parsed, dict) and isinstance(parsed.get("proposals"), list):
                proposals = parsed["proposals"]
        except ValueError:
            proposals = []

    return {
        "ok": True,
        "db": str(db_path),
        "db_path": str(db_path),
        "days": days,
        "min_count": min_count,
        "proposals": proposals,
    }


def get_egress_overview(*, home: Path | None = None) -> dict[str, Any]:
    """Возвращает статус сетевого фильтра Egress (только чтение, M-141).

    Блок показывает домены и состояние прокси либо честное «прокси не настроен»
    и команду `hermes egress setup`. Управление egress — в терминале.
    """
    resolved_home = _resolve_home(home)
    proxy_dir = resolved_home / "proxy"
    cfg_path = resolved_home / "config.yaml"
    cfg = profile_config.load_strict(cfg_path)
    proxy_cfg = cfg.get("proxy") if isinstance(cfg, dict) else None

    mappings_file = proxy_dir / "mappings.json"
    proxy_yaml_file = proxy_dir / "proxy.yaml"
    pid_file = proxy_dir / "proxy.pid"

    configured = False
    allowed_domains: list[str] = []

    # 1. Читаем mappings.json
    if mappings_file.is_file():
        configured = True
        try:
            data = json.loads(mappings_file.read_text(encoding="utf-8-sig"))
            for item in data.get("tokens", []):
                for host in item.get("upstream_hosts", []):
                    h_clean = str(host).strip()
                    if h_clean and h_clean not in allowed_domains:
                        allowed_domains.append(h_clean)
        except Exception:
            pass

    # 2. Читаем proxy.yaml
    if proxy_yaml_file.is_file():
        configured = True
        try:
            p_data = profile_config.load_strict(proxy_yaml_file)
            if isinstance(p_data, dict):
                for host in p_data.get("allowed_hosts", []) or []:
                    h_clean = str(host).strip()
                    if h_clean and h_clean not in allowed_domains:
                        allowed_domains.append(h_clean)
        except Exception:
            pass

    # 3. Проверяем PID процесса через psutil.pid_exists (без os.kill footgun на Windows)
    is_running = False
    pid = None
    if pid_file.is_file():
        try:
            raw_pid = pid_file.read_text(encoding="utf-8").strip()
            if raw_pid.isdigit():
                pid = int(raw_pid)
                if pid > 0:
                    try:
                        import psutil

                        is_running = bool(psutil.pid_exists(pid))
                    except ImportError:
                        if sys.platform != "win32":
                            try:
                                import os

                                os.kill(pid, 0)
                                is_running = True
                            except (ProcessLookupError, OSError):
                                is_running = False
        except Exception:
            pass

    allowed_domains.sort()

    if not configured and not (isinstance(proxy_cfg, dict) and proxy_cfg.get("enabled")):
        return {
            "ok": True,
            "configured": False,
            "status": "not_configured",
            "status_text": "Прокси не настроен",
            "allowed_domains": [],
            "remediation_cmd": "hermes egress setup",
            "remediation_text": "Запустите в терминале: hermes egress setup",
            "pid": None,
        }

    status = "running" if is_running else "stopped"
    status_text = "Работает" if is_running else "Остановлен"
    remediation_cmd = "hermes egress start" if not is_running else ""
    remediation_text = (
        "Запустите в терминале: hermes egress start" if not is_running else ""
    )

    return {
        "ok": True,
        "configured": True,
        "status": status,
        "status_text": status_text,
        "allowed_domains": allowed_domains,
        "remediation_cmd": remediation_cmd,
        "remediation_text": remediation_text,
        "pid": pid if is_running else None,
    }


def get_safety_overview(
    *,
    days: int = 30,
    min_count: int = 2,
    limit: int = 25,
    home: Path | None = None,
) -> dict[str, Any]:
    """Полная сводка экрана «Разрешения и безопасность»."""
    resolved_home = _resolve_home(home)
    allowlist = get_command_allowlist(home=resolved_home)
    deny_rules = get_deny_rules(home=resolved_home)
    sug = get_suggestions(days=days, min_count=min_count, limit=limit, home=resolved_home)
    egress = get_egress_overview(home=resolved_home)
    return {
        "ok": True,
        "db_path": sug["db_path"],
        "days": days,
        "min_count": min_count,
        "command_allowlist": allowlist,
        "approvals_deny": deny_rules,
        "proposals": sug["proposals"],
        "egress": egress,
    }


def build_router() -> APIRouter:
    router = APIRouter(tags=["nomad-safety"])

    @router.get("/safety")
    def http_get_safety(
        days: int = Query(default=30, ge=1, le=3650),
        min_count: int = Query(default=2, ge=1, le=1000),
        limit: int = Query(default=25, ge=1, le=200),
    ) -> dict[str, Any]:
        return get_safety_overview(days=days, min_count=min_count, limit=limit)

    @router.get("/safety/egress")
    def http_get_egress() -> dict[str, Any]:
        return get_egress_overview()

    @router.get("/safety/suggestions")
    def http_get_suggestions(
        days: int = Query(default=30, ge=1, le=3650),
        min_count: int = Query(default=2, ge=1, le=1000),
        limit: int = Query(default=25, ge=1, le=200),
    ) -> dict[str, Any]:
        return get_suggestions(days=days, min_count=min_count, limit=limit)

    @router.post("/safety/suggestions/accept")
    @router.post("/safety/allowlist/add")
    def http_add_allowlist(body: PatternRequest) -> dict[str, Any]:
        try:
            return add_allowlist_pattern(body.pattern)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/safety/allowlist/remove")
    def http_remove_allowlist(body: PatternRequest) -> dict[str, Any]:
        try:
            return remove_allowlist_pattern(body.pattern)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/safety/deny/add")
    def http_add_deny(body: PatternRequest) -> dict[str, Any]:
        try:
            return add_deny_rule(body.pattern)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/safety/deny/remove")
    def http_remove_deny(body: PatternRequest) -> dict[str, Any]:
        try:
            return remove_deny_rule(body.pattern)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.put("/safety/deny")
    def http_put_deny(body: DenyListUpdateRequest) -> dict[str, Any]:
        save_deny_rules(body.deny)
        return get_safety_overview()

    @router.post("/safety/test")
    def http_test_command(body: CommandCheckRequest) -> dict[str, Any]:
        try:
            return evaluate_command_safety(body.command, yolo=body.yolo)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router


router = build_router()
