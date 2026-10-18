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
    _SUGGESTIONS_CACHE.clear()
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


_SUGGESTIONS_CACHE: dict[tuple[Any, ...], list[dict[str, Any]]] = {}


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

    try:
        mtime_ns = db_path.stat().st_mtime_ns
    except OSError:
        mtime_ns = 0
    existing_allowlist = set(get_command_allowlist(home=resolved_home))
    cache_key = (str(db_path), mtime_ns, days, min_count, limit, tuple(sorted(existing_allowlist)))
    if cache_key in _SUGGESTIONS_CACHE:
        raw_proposals = list(_SUGGESTIONS_CACHE[cache_key])
    else:
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
        raw_proposals = []
        if res.get("ok") and res.get("stdout"):
            try:
                parsed = json.loads(res["stdout"])
                if isinstance(parsed, dict) and isinstance(parsed.get("proposals"), list):
                    raw_proposals = parsed["proposals"]
            except ValueError:
                raw_proposals = []
        _SUGGESTIONS_CACHE[cache_key] = list(raw_proposals)

    proposals = [
        p
        for p in raw_proposals
        if isinstance(p, dict) and not _matches_existing(str(p.get("pattern") or ""), existing_allowlist)
    ]
    return {
        "ok": True,
        "db": str(db_path),
        "db_path": str(db_path),
        "days": days,
        "min_count": min_count,
        "proposals": proposals,
    }


# ---------------------------------------------------------------------------
# Корпоративный контур ИБ, DLP-маскирование ПДн (152-ФЗ) и комплаенс CISO
# ---------------------------------------------------------------------------

DEFAULT_GUARDRAILS: dict[str, Any] = {
    "preset": "corp_152fz",
    "ru_only": False,
    "dlp_enabled": True,
    "dlp_mode": "mask",  # "mask" | "block" | "audit_only"
    "mask_fio": True,
    "mask_passport_inn_snils": True,
    "mask_cards_accounts": True,
    "mask_phones_emails": True,
    "mask_nda_contracts": True,
    "mask_secrets_tokens": True,
    "zdr_no_training": True,
    "os_keychain_encrypt": True,
    "history_ttl_days": 30,
    "block_wildcards_ssrf": True,
    "require_corp_vpn": False,
    "block_env_exfiltration": True,
    "siem_syslog_enabled": False,
    "siem_endpoint": "syslog://siem.company.local:514",
}

GUARDRAIL_PRESETS: dict[str, dict[str, Any]] = {
    "startup": {
        "preset": "startup",
        "ru_only": False,
        "dlp_enabled": True,
        "dlp_mode": "mask",
        "mask_fio": False,
        "mask_passport_inn_snils": True,
        "mask_cards_accounts": True,
        "mask_phones_emails": False,
        "mask_nda_contracts": False,
        "mask_secrets_tokens": True,
        "zdr_no_training": True,
        "os_keychain_encrypt": True,
        "history_ttl_days": 90,
        "block_wildcards_ssrf": True,
        "require_corp_vpn": False,
        "block_env_exfiltration": True,
    },
    "corp_152fz": {
        "preset": "corp_152fz",
        "ru_only": False,
        "dlp_enabled": True,
        "dlp_mode": "mask",
        "mask_fio": True,
        "mask_passport_inn_snils": True,
        "mask_cards_accounts": True,
        "mask_phones_emails": True,
        "mask_nda_contracts": True,
        "mask_secrets_tokens": True,
        "zdr_no_training": True,
        "os_keychain_encrypt": True,
        "history_ttl_days": 30,
        "block_wildcards_ssrf": True,
        "require_corp_vpn": False,
        "block_env_exfiltration": True,
    },
    "strict_kii": {
        "preset": "strict_kii",
        "ru_only": True,
        "dlp_enabled": True,
        "dlp_mode": "block",
        "mask_fio": True,
        "mask_passport_inn_snils": True,
        "mask_cards_accounts": True,
        "mask_phones_emails": True,
        "mask_nda_contracts": True,
        "mask_secrets_tokens": True,
        "zdr_no_training": True,
        "os_keychain_encrypt": True,
        "history_ttl_days": 7,
        "block_wildcards_ssrf": True,
        "require_corp_vpn": True,
        "block_env_exfiltration": True,
        "siem_syslog_enabled": True,
    },
}


def get_guardrails_config(*, home: Path | None = None) -> dict[str, Any]:
    """Вернуть текущие настройки корпоративных гардрейлов ИБ и 152-ФЗ."""
    cfg_path = (_resolve_home(home) / "config.yaml") if home is not None else None
    cfg = profile_config.load_strict(cfg_path)
    if not isinstance(cfg, dict):
        cfg = {}
    nomad_sec = cfg.get("nomad") if isinstance(cfg.get("nomad"), dict) else {}
    saved = nomad_sec.get("guardrails") if isinstance(nomad_sec.get("guardrails"), dict) else {}
    merged = {**DEFAULT_GUARDRAILS, **saved}
    if "ru_only" in nomad_sec and isinstance(nomad_sec.get("ru_only"), bool):
        merged["ru_only"] = nomad_sec["ru_only"]
    return merged


def save_guardrails_config(
    updates: dict[str, Any],
    *,
    home: Path | None = None,
) -> dict[str, Any]:
    """Сохранить настройки корпоративных гардрейлов ИБ и 152-ФЗ в `config.yaml`."""
    resolved_home = _resolve_home(home)
    cfg_path = resolved_home / "config.yaml"
    current = get_guardrails_config(home=resolved_home)

    preset_name = str(updates.get("apply_preset") or "").strip()
    if preset_name and preset_name in GUARDRAIL_PRESETS:
        current.update(GUARDRAIL_PRESETS[preset_name])

    for key, default_val in DEFAULT_GUARDRAILS.items():
        if key in updates:
            val = updates[key]
            if isinstance(default_val, bool):
                current[key] = bool(val)
            elif isinstance(default_val, int):
                try:
                    current[key] = max(1, min(3650, int(val)))
                except (TypeError, ValueError):
                    pass
            else:
                current[key] = str(val or "").strip()

    ru_flag_changed = "ru_only" in updates or (preset_name in GUARDRAIL_PRESETS)
    ru_enabled = bool(current.get("ru_only", False))

    if ru_flag_changed and ru_enabled:
        from . import ru_only as _ru_only
        _ru_only.apply_ru_config(resolved_home)

    cfg = profile_config.load_strict(cfg_path if cfg_path.is_file() else None)
    if not isinstance(cfg, dict):
        cfg = {}
    nomad_sec = dict(cfg.get("nomad")) if isinstance(cfg.get("nomad"), dict) else {}
    nomad_sec["guardrails"] = dict(current)
    if ru_flag_changed:
        nomad_sec["ru_only"] = ru_enabled
    cfg["nomad"] = nomad_sec

    import yaml as _yaml
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = cfg_path.with_suffix(".yaml.tmp")
    tmp_path.write_text(_yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")
    tmp_path.replace(cfg_path)
    return current


def redact_dlp_text(text: str, *, guardrails: dict[str, Any] | None = None) -> dict[str, Any]:
    """Интерактивный DLP-фильтр 152-ФЗ: находит и маскирует ПДн, реквизиты и секреты до отправки в LLM."""
    cfg = guardrails or DEFAULT_GUARDRAILS
    raw = str(text or "")
    redacted = raw
    findings: list[dict[str, Any]] = []

    rules: list[tuple[bool, str, str, re.Pattern[str]]] = [
        (
            bool(cfg.get("mask_secrets_tokens", True)),
            "API-ключ / Приватный токен",
            "[СЕКРЕТ:ТОКЕН_СКРЫТ]",
            re.compile(r"\b(?:sk-[A-Za-z0-9_-]{12,}|y0_[A-Za-z0-9_-]{12,}|AQVN[A-Za-z0-9_-]{12,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,})\b"),
        ),
        (
            bool(cfg.get("mask_passport_inn_snils", True)),
            "СНИЛС РФ (152-ФЗ)",
            "[ПДн:СНИЛС_РФ]",
            re.compile(r"\b\d{3}-\d{3}-\d{3}[\s-]\d{2}\b"),
        ),
        (
            bool(cfg.get("mask_passport_inn_snils", True)),
            "Паспорт РФ (серия и номер)",
            "[ПДн:ПАСПОРТ_РФ]",
            re.compile(r"\b\d{2}\s?\d{2}\s№?\s?\d{6}\b"),
        ),
        (
            bool(cfg.get("mask_cards_accounts", True)),
            "Расчётный счёт РФ / Карта",
            "[ПДн:БАНК_СЧЁТ]",
            re.compile(r"\b(?:40702|40802|40817|30101)\d{15}\b|\b(?:\d{4}[\s-]?){3}\d{4}\b"),
        ),
        (
            bool(cfg.get("mask_passport_inn_snils", True)),
            "ИНН (10/12 цифр)",
            "[ПДн:ИНН_РФ]",
            re.compile(r"(?:ИНН\s*[:№]?\s*)(\d{10}|\d{12})\b", re.IGNORECASE),
        ),
        (
            bool(cfg.get("mask_phones_emails", True)),
            "Телефон / Email (152-ФЗ)",
            "[ПДн:КОНТАКТ]",
            re.compile(r"(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
        ),
        (
            bool(cfg.get("mask_fio", True)),
            "ФИО физлица (152-ФЗ)",
            "[ПДн:ФИО]",
            re.compile(r"\b[А-ЯЁ][а-яё]{2,}(?:ов|ев|ин|ский|цкий|ова|ева|ина|ская|ко|ук|юк)\s+[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{3,}(?:ович|евич|ич|овна|евна|ична)\b"),
        ),
        (
            bool(cfg.get("mask_nda_contracts", True)),
            "Договор / Коммерческая тайна (NDA)",
            "[NDA:ДОГОВОР]",
            re.compile(r"(?:Договор\s*№\s*[А-ЯA-Z0-9/-]+|Коммерческая\s+тайна)", re.IGNORECASE),
        ),
    ]

    for enabled, label, replacement, pattern in rules:
        if not enabled:
            continue
        matches = list(pattern.finditer(redacted))
        if matches:
            findings.append({"category": label, "count": len(matches), "mask": replacement})
            redacted = pattern.sub(replacement, redacted)

    blocked = bool(cfg.get("dlp_mode") == "block" and findings)
    return {
        "ok": True,
        "original_length": len(raw),
        "redacted_text": redacted,
        "findings": findings,
        "findings_count": sum(f["count"] for f in findings),
        "blocked": blocked,
        "verdict": (
            "Запрос заблокирован политикой Zero-Trust (обнаружены ПДн / секреты)"
            if blocked
            else (
                f"Обезличено объектов ПДн/секретов: {sum(f['count'] for f in findings)} (152-ФЗ DLP)"
                if findings
                else "Персональных данных и секретов не обнаружено — запрос безопасен"
            )
        ),
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
    guardrails = get_guardrails_config(home=resolved_home)
    return {
        "ok": True,
        "db_path": sug["db_path"],
        "days": days,
        "min_count": min_count,
        "command_allowlist": allowlist,
        "approvals_deny": deny_rules,
        "proposals": sug["proposals"],
        "egress": egress,
        "guardrails": guardrails,
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

    @router.get("/safety/guardrails")
    def http_get_guardrails() -> dict[str, Any]:
        return {"ok": True, "guardrails": get_guardrails_config()}

    @router.post("/safety/guardrails")
    @router.put("/safety/guardrails")
    def http_save_guardrails(payload: dict[str, Any]) -> dict[str, Any]:
        updated = save_guardrails_config(payload or {})
        return {"ok": True, "guardrails": updated, **get_safety_overview()}

    @router.post("/safety/dlp/test")
    @router.post("/safety/dlp-test")
    def http_test_dlp(payload: dict[str, Any]) -> dict[str, Any]:
        sample = str((payload or {}).get("text") or "")
        cfg = get_guardrails_config()
        return redact_dlp_text(sample, guardrails=cfg)

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

