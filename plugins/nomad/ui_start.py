"""М-144: Экран и маршруты «Перенос и старт» (`/nomad-start`, UI-N7 / UI-F1).

Функции:
  1. Превью импорта (`POST /start/preview`):
     вызывает `hermes import-agent {claude-code,codex} --source <dir> --dry-run`
     через `ui_cli.run_hermes(...)`, возвращает точный вывод CLI (`cli_stdout`),
     структурированный список найденных артефактов (инструкции, разрешения, MCP-серверы,
     навыки) и обязательное предупреждение «ключи не переносятся».
  2. Выполнение переноса (`POST /start/import`):
     переносит инструкции, разрешения, навыки и MCP-серверы в активный профиль
     `$HERMES_HOME`, гарантируя, что ни один `*_API_KEY`, токен или секрет из исходной
     папки не попадает в `.env` или `config.yaml` профиля.
  3. Чек-лист первого дня (`GET /start/checklist`, `POST /start/checklist`):
     хранит прогресс прохождения стартовых шагов в `$HERMES_HOME`; когда все шаги
     отмечены выполненными (`completed=True`), выставляет `hide_menu_item=True`,
     скрывая строку «Перенос и старт» из бокового меню.

Все обращения к путям и конфигу профиля выполняются строго через `core_adapter` и `ui_cli`.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import shutil
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import yaml

from . import core_adapter, profile_config, ui_cli, ui_skills

SUPPORTED_IMPORT_AGENTS: dict[str, str] = {
    "claude-code": "Claude Code",
    "codex": "Codex CLI",
}

KEYS_NOT_IMPORTED_NOTICE = (
    "Ключи не переносятся: все переменные *_API_KEY, *_SECRET, *_TOKEN и пароли "
    "автоматически исключаются и не попадают в .env профиля."
)

SECRET_ENV_KEY_RE = re.compile(
    r"(?:_API_KEY|_SECRET|_TOKEN|_PASSWORD|_PRIVATE_KEY|_PAT|_AUTH|APIKEY|SECRET_KEY|ACCESS_KEY|BEARER)$",
    re.IGNORECASE,
)

DEFAULT_CHECKLIST_ITEMS: tuple[dict[str, str], ...] = (
    {
        "id": "connect_account",
        "title": "Подключить аккаунт или подписку",
        "description": "Добавьте подписку или API-ключ провайдера на экране «Аккаунты».",
        "action_label": "Открыть «Аккаунты»",
        "target_path": "/nomad-accounts",
    },
    {
        "id": "choose_model",
        "title": "Выбрать рабочую модель",
        "description": "Проверьте основную модель и цепочку резервных провайдеров.",
        "action_label": "Открыть настройки модели",
        "target_path": "/nomad-accounts",
    },
    {
        "id": "enable_channels",
        "title": "Включить каналы связи",
        "description": "При необходимости подключите Telegram, Slack или другие мессенджеры.",
        "action_label": "Открыть «Каналы»",
        "target_path": "/messaging",
    },
    {
        "id": "explore_capabilities",
        "title": "Что умеет Nomad и перенос настроек",
        "description": "Перенесите навыки и MCP из Claude Code / Codex CLI или откройте витрину навыков.",
        "action_label": "Открыть «Навыки Nomad»",
        "target_path": "/nomad-skills",
    },
)


class PreviewImportRequest(BaseModel):
    agent: str = Field(default="claude-code", description="claude-code | codex")
    source_dir: str = Field(..., min_length=1, description="Путь к исходной папке агента")


class ExecuteImportRequest(BaseModel):
    agent: str = Field(default="claude-code", description="claude-code | codex")
    source_dir: str = Field(..., min_length=1, description="Путь к исходной папке агента")
    overwrite: bool = Field(default=False, description="Перезаписывать существующие навыки")


class ChecklistUpdateRequest(BaseModel):
    item_id: str | None = Field(default=None, description="Идентификатор пункта чек-листа")
    done: bool | None = Field(default=None, description="Новое состояние пункта")
    completed_ids: list[str] | None = Field(default=None, description="Полный список выполненных пунктов")
    complete_all: bool = Field(default=False, description="Отметить весь чек-лист выполненным")
    reset: bool = Field(default=False, description="Сбросить чек-лист")


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _is_secret_key_name(key: str) -> bool:
    k = key.strip().upper()
    if not k:
        return False
    if SECRET_ENV_KEY_RE.search(k):
        return True
    return any(
        token in k
        for token in ("API_KEY", "SECRET", "TOKEN", "PASSWORD", "CREDENTIAL", "PRIVATE_KEY")
    )


def _parse_dotenv_keys(env_path: Path) -> dict[str, str]:
    if not env_path.is_file():
        return {}
    out: dict[str, str] = {}
    try:
        for raw_line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            if line.startswith("export "):
                line = line[7:].strip()
            k, _, v = line.partition("=")
            k = k.strip()
            v = v.strip().strip("'").strip('"')
            if k:
                out[k] = v
    except OSError:
        pass
    return out


def _write_dotenv_without_keys(env_path: Path, forbidden_keys: set[str]) -> None:
    if not env_path.is_file():
        return
    try:
        lines = env_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return
    kept: list[str] = []
    for raw_line in lines:
        stripped = raw_line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            kept.append(raw_line)
            continue
        check_line = stripped[7:].strip() if stripped.startswith("export ") else stripped
        k, _, _ = check_line.partition("=")
        k_norm = k.strip()
        if k_norm in forbidden_keys or _is_secret_key_name(k_norm):
            continue
        kept.append(raw_line)
    env_path.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")


def _inspect_source_dir(source_dir: Path, agent: str) -> dict[str, Any]:
    """Собрать структурированное описание содержимого папки источника без чтения значений секретов."""
    instructions: list[str] = []
    for candidate in ("CLAUDE.md", "AGENTS.md", "instructions.md"):
        if (source_dir / candidate).is_file():
            instructions.append(candidate)

    permissions_count = 0
    mcp_servers: dict[str, dict[str, Any]] = {}
    filtered_secret_keys: set[str] = set()

    # Разбор settings.json / .claude.json / mcp.json
    for json_name in ("settings.json", ".claude.json", "mcp.json"):
        jpath = source_dir / json_name
        if not jpath.is_file():
            continue
        try:
            data = json.loads(jpath.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(data, dict):
            continue
        perms = data.get("permissions")
        if isinstance(perms, dict):
            allow_list = perms.get("allow")
            if isinstance(allow_list, list):
                permissions_count += len(allow_list)
        raw_mcps = data.get("mcpServers") or data.get("mcp_servers")
        if isinstance(raw_mcps, dict):
            for srv_name, srv_cfg in raw_mcps.items():
                if not isinstance(srv_cfg, dict):
                    continue
                sanitized_cfg = dict(srv_cfg)
                raw_env = sanitized_cfg.get("env")
                if isinstance(raw_env, dict):
                    clean_env: dict[str, str] = {}
                    for ek, ev in raw_env.items():
                        if _is_secret_key_name(str(ek)) or (
                            isinstance(ev, str)
                            and (ev.startswith("sk-") or ev.startswith("ghp_") or len(ev) > 24)
                        ):
                            filtered_secret_keys.add(str(ek))
                        else:
                            clean_env[str(ek)] = str(ev)
                    if clean_env:
                        sanitized_cfg["env"] = clean_env
                    else:
                        sanitized_cfg.pop("env", None)
                mcp_servers[str(srv_name)] = sanitized_cfg

    # Проверим .env в исходной папке на наличие ключей, чтобы явно перечислить их имена как отфильтрованные
    for env_candidate in (source_dir / ".env", source_dir / ".credentials.env"):
        for k in _parse_dotenv_keys(env_candidate):
            if _is_secret_key_name(k):
                filtered_secret_keys.add(k)

    # Навыки в source_dir / skills
    skills_found: list[dict[str, str]] = []
    skills_dir = source_dir / "skills"
    if skills_dir.is_dir():
        for skill_md in sorted(skills_dir.rglob("SKILL.md")):
            try:
                fm, _ = ui_skills.parse_skill_frontmatter(
                    skill_md.read_text(encoding="utf-8", errors="replace")
                )
            except OSError:
                fm = {}
            sname = str(fm.get("name") or skill_md.parent.name).strip() or skill_md.parent.name
            sdesc = str(fm.get("description") or "").strip()
            skills_found.append(
                {
                    "name": sname,
                    "description": sdesc,
                    "rel_dir": str(skill_md.parent.relative_to(skills_dir)).replace("\\", "/"),
                }
            )

    return {
        "agent": agent,
        "agent_label": SUPPORTED_IMPORT_AGENTS.get(agent, agent),
        "instructions": instructions,
        "permissions_count": permissions_count,
        "mcp_servers": mcp_servers,
        "mcp_server_names": sorted(mcp_servers.keys()),
        "skills": skills_found,
        "skill_names": [s["name"] for s in skills_found],
        "filtered_secret_keys": sorted(filtered_secret_keys),
    }


def _read_yaml_cfg(cfg_path: Path) -> dict[str, Any]:
    if not cfg_path.is_file():
        return {}
    try:
        loaded = profile_config.load(cfg_path)
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        pass
    return {}


def _write_yaml_cfg(cfg_path: Path, cfg: dict[str, Any]) -> None:
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = cfg_path.with_suffix(".yaml.tmp")
    tmp_path.write_text(
        yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    tmp_path.replace(cfg_path)


def preview_agent_import(
    source_dir: Path | str,
    *,
    agent: str = "claude-code",
    home: Path | None = None,
) -> dict[str, Any]:
    """Сформировать превью импорта (`hermes import-agent <agent> --source <dir> --dry-run`)."""
    if agent not in SUPPORTED_IMPORT_AGENTS:
        raise ValueError(f"Неподдерживаемый источник импорта: {agent}")
    src_path = Path(source_dir).expanduser().resolve()
    if not src_path.is_dir():
        raise FileNotFoundError(f"Папка источника не найдена: {src_path}")

    resolved_home = _resolve_home(home)
    cli_res = ui_cli.run_hermes(
        ["import-agent", agent, "--source", str(src_path), "--dry-run"],
        home=resolved_home,
        timeout=30.0,
    )
    cli_stdout = str(cli_res.get("stdout") or "")
    cli_ok = bool(cli_res.get("ok", False))
    inspected = _inspect_source_dir(src_path, agent)

    preview_text = (
        f"{cli_stdout.rstrip()}\n\n"
        f"⚠ {KEYS_NOT_IMPORTED_NOTICE}"
    ).strip()

    return {
        "ok": cli_ok,
        "agent": agent,
        "agent_label": SUPPORTED_IMPORT_AGENTS[agent],
        "source_dir": str(src_path),
        "cli_stdout": cli_stdout,
        "dry_run_output": cli_stdout,
        "preview_text": preview_text,
        "keys_notice": KEYS_NOT_IMPORTED_NOTICE,
        "keys_transferred": False,
        "discovered": inspected,
    }


def execute_agent_import(
    source_dir: Path | str,
    *,
    agent: str = "claude-code",
    overwrite: bool = False,
    home: Path | None = None,
) -> dict[str, Any]:
    """Выполнить перенос настроек из Claude Code / Codex CLI в `$HERMES_HOME` без переноса ключей."""
    if agent not in SUPPORTED_IMPORT_AGENTS:
        raise ValueError(f"Неподдерживаемый источник импорта: {agent}")
    src_path = Path(source_dir).expanduser().resolve()
    if not src_path.is_dir():
        raise FileNotFoundError(f"Папка источника не найдена: {src_path}")

    resolved_home = _resolve_home(home)
    env_path = resolved_home / ".env"
    before_env_keys = set(_parse_dotenv_keys(env_path).keys())

    argv = ["import-agent", agent, "--source", str(src_path), "--yes"]
    if overwrite:
        argv.append("--overwrite")
    cli_res = ui_cli.run_hermes(argv, home=resolved_home, timeout=30.0)
    cli_stdout = str(cli_res.get("stdout") or "")

    inspected = _inspect_source_dir(src_path, agent)

    # Гарантируем, что все навыки из source_dir/skills доступны в $HERMES_HOME/skills
    src_skills_dir = src_path / "skills"
    dst_skills_root = resolved_home / "skills" / f"imported-{agent}"
    imported_skills: list[str] = []
    if src_skills_dir.is_dir():
        for skill_md in sorted(src_skills_dir.rglob("SKILL.md")):
            fm, _ = ui_skills.parse_skill_frontmatter(
                skill_md.read_text(encoding="utf-8", errors="replace")
            )
            sname = str(fm.get("name") or skill_md.parent.name).strip() or skill_md.parent.name
            # Проверим, не скопирован ли уже навык штатным CLI в $HERMES_HOME/skills/**
            already_present = any(
                p.parent.name == sname for p in (resolved_home / "skills").rglob("SKILL.md")
            ) if (resolved_home / "skills").is_dir() else False
            if not already_present or overwrite:
                target_skill_dir = dst_skills_root / sname
                if target_skill_dir.exists() and overwrite:
                    shutil.rmtree(target_skill_dir)
                if not target_skill_dir.exists():
                    target_skill_dir.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copytree(skill_md.parent, target_skill_dir)
            imported_skills.append(sname)

    # Гарантируем, что все очищенные от секретов MCP-серверы записаны в config.yaml
    cfg_path = resolved_home / "config.yaml"
    cfg = _read_yaml_cfg(cfg_path)
    mcp_cfg = cfg.get("mcp_servers")
    if not isinstance(mcp_cfg, dict):
        mcp_cfg = {}

    # Очистим любые секретные переменные окружения из уже импортированных и новых MCP-серверов
    for srv_name, srv_def in inspected["mcp_servers"].items():
        if srv_name not in mcp_cfg or overwrite:
            mcp_cfg[srv_name] = srv_def

    for srv_name, srv_def in list(mcp_cfg.items()):
        if isinstance(srv_def, dict) and isinstance(srv_def.get("env"), dict):
            clean_env = {
                str(k): str(v)
                for k, v in srv_def["env"].items()
                if not _is_secret_key_name(str(k)) and str(v) != "[REDACTED_BY_HERMES_IMPORT]"
            }
            if clean_env:
                srv_def["env"] = clean_env
            else:
                srv_def.pop("env", None)

    if mcp_cfg:
        cfg["mcp_servers"] = mcp_cfg
        _write_yaml_cfg(cfg_path, cfg)

    # Жёсткая защита .env: удаляем любые новые *_API_KEY или секреты из исходной папки
    after_env_keys = set(_parse_dotenv_keys(env_path).keys())
    newly_added_keys = after_env_keys - before_env_keys
    forbidden = set(inspected["filtered_secret_keys"]) | {
        k for k in newly_added_keys if _is_secret_key_name(k)
    }
    _write_dotenv_without_keys(env_path, forbidden)

    # Автоматически отметим шаг переноса/знакомства в чек-листе
    update_checklist(item_id="explore_capabilities", done=True, home=resolved_home)

    skills_now = ui_skills.list_skills(home=resolved_home)
    final_cfg = _read_yaml_cfg(cfg_path)
    final_mcps = final_cfg.get("mcp_servers") if isinstance(final_cfg.get("mcp_servers"), dict) else {}

    return {
        "ok": True,
        "agent": agent,
        "source_dir": str(src_path),
        "cli_stdout": cli_stdout,
        "keys_notice": KEYS_NOT_IMPORTED_NOTICE,
        "keys_transferred": False,
        "imported_skills": sorted(set(imported_skills) | set(inspected["skill_names"])),
        "imported_mcp_servers": sorted(final_mcps.keys()),
        "filtered_secret_keys": inspected["filtered_secret_keys"],
        "skills_total": skills_now["total"],
    }


def _checklist_file_path(home: Path) -> Path:
    return home / "plugins" / "nomad" / "data" / "start_checklist.json"


def get_checklist_state(home: Path | None = None) -> dict[str, Any]:
    """Прочитать состояние чек-листа первого дня."""
    resolved_home = _resolve_home(home)
    fpath = _checklist_file_path(resolved_home)
    done_map: dict[str, bool] = {}
    if fpath.is_file():
        try:
            raw = json.loads(fpath.read_text(encoding="utf-8"))
            if isinstance(raw, dict) and isinstance(raw.get("done_by_id"), dict):
                done_map = {str(k): bool(v) for k, v in raw["done_by_id"].items()}
        except Exception:
            done_map = {}

    items: list[dict[str, Any]] = []
    for spec in DEFAULT_CHECKLIST_ITEMS:
        item_id = spec["id"]
        items.append(
            {
                **spec,
                "done": bool(done_map.get(item_id, False)),
            }
        )

    completed_count = sum(1 for item in items if item["done"])
    total_count = len(items)
    all_completed = total_count > 0 and completed_count == total_count

    return {
        "ok": True,
        "items": items,
        "completed_count": completed_count,
        "total_count": total_count,
        "completed": all_completed,
        "hide_menu_item": all_completed,
    }


def update_checklist(
    *,
    item_id: str | None = None,
    done: bool | None = None,
    completed_ids: list[str] | None = None,
    complete_all: bool = False,
    reset: bool = False,
    home: Path | None = None,
) -> dict[str, Any]:
    """Обновить состояние пунктов чек-листа первого дня и вернуть актуальный статус."""
    resolved_home = _resolve_home(home)
    current = get_checklist_state(resolved_home)
    done_map: dict[str, bool] = {item["id"]: bool(item["done"]) for item in current["items"]}
    valid_ids = {spec["id"] for spec in DEFAULT_CHECKLIST_ITEMS}

    if reset:
        for k in valid_ids:
            done_map[k] = False
    elif complete_all:
        for k in valid_ids:
            done_map[k] = True
    else:
        if completed_ids is not None:
            done_set = {str(x).strip() for x in completed_ids}
            for k in valid_ids:
                done_map[k] = k in done_set
        if item_id is not None:
            if item_id not in valid_ids:
                raise KeyError(f"Неизвестный пункт чек-листа: {item_id}")
            done_map[item_id] = True if done is None else bool(done)

    fpath = _checklist_file_path(resolved_home)
    fpath.parent.mkdir(parents=True, exist_ok=True)
    fpath.write_text(
        json.dumps({"done_by_id": done_map}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return get_checklist_state(resolved_home)


router = APIRouter(tags=["nomad-start"])


@router.get("/start")
@router.get("/start/status")
def api_get_start_status() -> dict[str, Any]:
    resolved_home = _resolve_home()
    checklist = get_checklist_state(resolved_home)
    cfg = _read_yaml_cfg(resolved_home / "config.yaml")
    mcps = cfg.get("mcp_servers") if isinstance(cfg.get("mcp_servers"), dict) else {}
    skills_summary = ui_skills.list_skills(home=resolved_home)
    return {
        "ok": True,
        "supported_agents": [
            {"id": k, "label": v} for k, v in SUPPORTED_IMPORT_AGENTS.items()
        ],
        "keys_notice": KEYS_NOT_IMPORTED_NOTICE,
        "checklist": checklist,
        "hide_menu_item": checklist["hide_menu_item"],
        "skills_count": skills_summary["total"],
        "mcp_servers": sorted(mcps.keys()),
    }


@router.post("/start/preview")
def api_preview_import(body: PreviewImportRequest) -> dict[str, Any]:
    try:
        return preview_agent_import(body.source_dir, agent=body.agent)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/start/preview")
def api_preview_import_get(
    source_dir: str = Query(..., min_length=1),
    agent: str = Query(default="claude-code"),
) -> dict[str, Any]:
    try:
        return preview_agent_import(source_dir, agent=agent)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/start/import")
def api_execute_import(body: ExecuteImportRequest) -> dict[str, Any]:
    try:
        return execute_agent_import(
            body.source_dir,
            agent=body.agent,
            overwrite=body.overwrite,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/start/checklist")
def api_get_checklist() -> dict[str, Any]:
    return get_checklist_state()


@router.post("/start/checklist")
@router.put("/start/checklist")
def api_update_checklist(body: ChecklistUpdateRequest) -> dict[str, Any]:
    try:
        return update_checklist(
            item_id=body.item_id,
            done=body.done,
            completed_ids=body.completed_ids,
            complete_all=body.complete_all,
            reset=body.reset,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
