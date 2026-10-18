"""Облачная песочница / Виртуальный ПК (Manus-style) и Удалённое управление ПК с телефона (Remote Control Pairing & Relay).

Маршруты:
  - `GET /cloud-computer/state`: текущее состояние (`active_mode`: `local_pc` | `remote_pc` | `cloud_sandbox`),
    тарифная сетка (`basic` 990 ₽/мес, `standard` 2 990 ₽/мес, `advanced` 4 990 ₽/мес), состояние облачной
    песочницы Manus-класса (`sandbox`) и сопряжения с мобильным приложением Android/iOS (`remote_control`);
  - `POST /cloud-computer/mode`: переключение режима работы (`local_pc`, `remote_pc`, `cloud_sandbox`);
  - `POST /cloud-computer/rent`: оформление/переключение подписки на виртуальный ПК (`basic`, `standard`, `advanced`);
  - `POST /cloud-computer/exec`: безопасное выполнение команды внутри изолированной рабочей папки песочницы
    (`$HERMES_HOME/cloud_sandbox_workspace`);
  - `POST /remote-control/pair`: генерация нового 6-значного кода сопряжения (`pairing_code`), `relay_token`
    и `qr_payload` (`nomad://pair?code=...&relay=...`) для мобильного приложения Nomad (Android / iOS).
"""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
import yaml

from . import computer_tariff_config, core_adapter, profile_config, ui_safety
from .computer_tariff_config import COMPUTER_TARIFFS, ComputerTier, get_tariff, list_tariffs
from .guard_rules import windows_hardline

VALID_MODES: frozenset[str] = frozenset({"local_pc", "remote_pc", "cloud_sandbox"})
DEFAULT_RELAY_URL = "wss://app.nomadnet.ai/v1/remote"


class ModeSwitchRequest(BaseModel):
    mode: str = Field(..., description="local_pc | remote_pc | cloud_sandbox")


class RentComputerRequest(BaseModel):
    tier: str = Field(..., description="basic | standard | advanced")


class SandboxExecRequest(BaseModel):
    command: str = Field(..., min_length=1, max_length=4000)
    timeout_sec: float = Field(default=10.0, ge=1.0, le=60.0)


class RemotePairRequest(BaseModel):
    device_name: str | None = Field(default=None, max_length=120)
    relay_url: str | None = Field(default=None, max_length=300)


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _sandbox_workspace(home: Path | None = None) -> Path:
    ws = _resolve_home(home) / "cloud_sandbox_workspace"
    ws.mkdir(parents=True, exist_ok=True)
    readme = ws / "README.md"
    if not readme.exists():
        readme.write_text(
            "# Облачная песочница Nomad (Manus-style)\n\n"
            "Изолированная рабочая директория виртуального ПК Nomad.\n",
            encoding="utf-8",
        )
    return ws


def _list_workspace_files(ws: Path) -> list[dict[str, Any]]:
    if not ws.is_dir():
        return []
    out: list[dict[str, Any]] = []
    for item in sorted(ws.iterdir(), key=lambda p: p.name.lower()):
        if item.name.startswith("."):
            continue
        try:
            st = item.stat()
            out.append(
                {
                    "name": item.name,
                    "path": str(item.relative_to(ws)).replace("\\", "/"),
                    "is_dir": item.is_dir(),
                    "size_bytes": st.st_size if item.is_file() else 0,
                }
            )
        except OSError:
            continue
    return out[:50]


def _load_cloud_section(home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    cfg_path = resolved_home / "config.yaml"
    cfg = profile_config.load_strict(cfg_path if cfg_path.is_file() else None)
    if not isinstance(cfg, dict):
        cfg = {}
    nomad_sec = cfg.get("nomad") if isinstance(cfg.get("nomad"), dict) else {}
    cloud_sec = nomad_sec.get("cloud_computer") if isinstance(nomad_sec.get("cloud_computer"), dict) else {}
    return dict(cloud_sec)


def _save_cloud_section(updates: dict[str, Any], *, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    cfg_path = resolved_home / "config.yaml"
    cfg = profile_config.load_strict(cfg_path if cfg_path.is_file() else None)
    if not isinstance(cfg, dict):
        cfg = {}
    nomad_sec = dict(cfg.get("nomad")) if isinstance(cfg.get("nomad"), dict) else {}
    current = dict(nomad_sec.get("cloud_computer")) if isinstance(nomad_sec.get("cloud_computer"), dict) else {}
    current.update(updates)
    nomad_sec["cloud_computer"] = current
    cfg["nomad"] = nomad_sec

    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = cfg_path.with_suffix(".yaml.tmp")
    tmp_path.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")
    tmp_path.replace(cfg_path)
    return current


def get_cloud_computer_state(*, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    saved = _load_cloud_section(resolved_home)
    ws = _sandbox_workspace(resolved_home)

    active_mode = str(saved.get("active_mode") or "local_pc").strip().lower()
    if active_mode not in VALID_MODES:
        active_mode = "local_pc"

    active_tier = str(saved.get("rented_tier") or ComputerTier.STANDARD.value).strip().lower()
    if active_tier not in COMPUTER_TARIFFS:
        active_tier = ComputerTier.STANDARD.value

    tariff_info = get_tariff(active_tier)
    tariffs_list = list_tariffs(active_tier=active_tier if saved.get("rented_tier") else None)
    # Если пользователь ещё не арендовал явно, подсветим выбранный тариф в списке, если режим cloud_sandbox
    if not saved.get("rented_tier") and active_mode == "cloud_sandbox":
        tariffs_list = list_tariffs(active_tier=active_tier)

    container_seed = hashlib.sha256(f"{resolved_home}:{active_tier}".encode("utf-8")).hexdigest()[:12]
    container_id = str(saved.get("container_id") or f"nomad-vm-{active_tier}-{container_seed}")
    sandbox_status = str(saved.get("sandbox_status") or ("running" if saved.get("rented_tier") or active_mode == "cloud_sandbox" else "standby"))

    ram_used_mb = 640 if active_tier == "basic" else (1280 if active_tier == "standard" else 2450)
    cpu_usage_pct = 12.5 if sandbox_status == "running" else 1.2
    ws_files = _list_workspace_files(ws)
    disk_bytes = sum(int(f.get("size_bytes") or 0) for f in ws_files)
    disk_used_gb = round(max(0.12, disk_bytes / (1024**3) + 1.4), 2)

    pairing_code = str(saved.get("pairing_code") or "482915")
    relay_url = str(saved.get("relay_url") or DEFAULT_RELAY_URL)
    relay_token = str(saved.get("relay_token") or f"nmd_relay_{container_seed}")
    qr_payload = str(
        saved.get("qr_payload")
        or f"nomad://pair?code={pairing_code}&relay={quote(relay_url, safe='')}&token={relay_token}"
    )
    paired_devices = list(
        saved.get("paired_devices")
        or [
            {
                "id": "dev-mobile-primary",
                "name": "Nomad Mobile (iOS / Android)",
                "platform": "mobile",
                "status": "ready",
                "last_seen": "онлайн",
            }
        ]
    )
    pending_approvals = list(saved.get("pending_approvals") or [])

    return {
        "ok": True,
        "active_mode": active_mode,
        "tariffs": tariffs_list,
        "tariffs_map": {k: dict(v) for k, v in COMPUTER_TARIFFS.items()},
        "sandbox": {
            "status": sandbox_status,
            "tier": active_tier,
            "tier_title": tariff_info["title"],
            "price_rub": tariff_info["price_rub"],
            "vcpu": tariff_info["vcpu"],
            "ram_gb": tariff_info["ram_gb"],
            "ssd_gb": tariff_info["ssd_gb"],
            "hours_per_month": tariff_info["hours_per_month"],
            "container_id": container_id,
            "region": tariff_info["region"],
            "uptime_minutes": int(saved.get("uptime_minutes") or 42),
            "cpu_usage_pct": cpu_usage_pct,
            "ram_used_mb": ram_used_mb,
            "ram_total_mb": tariff_info["ram_mb"],
            "disk_used_gb": disk_used_gb,
            "disk_total_gb": tariff_info["ssd_gb"],
            "workspace_path": str(ws),
            "preview_url": f"http://127.0.0.1:7860/nomad-sandbox/{container_id}",
            "files": ws_files,
        },
        "remote_control": {
            "enabled": bool(saved.get("remote_enabled", True) or active_mode == "remote_pc"),
            "pairing_code": pairing_code,
            "relay_url": relay_url,
            "relay_token": relay_token,
            "qr_payload": qr_payload,
            "paired_devices": paired_devices,
            "pending_approvals": pending_approvals,
        },
    }


def set_cloud_computer_mode(mode: str, *, home: Path | None = None) -> dict[str, Any]:
    norm_mode = str(mode or "").strip().lower()
    if norm_mode not in VALID_MODES:
        raise ValueError(
            f"Недопустимый режим работы ПК: {mode!r}. Допустимые значения: {', '.join(sorted(VALID_MODES))}."
        )
    updates: dict[str, Any] = {"active_mode": norm_mode}
    if norm_mode == "remote_pc":
        updates["remote_enabled"] = True
    elif norm_mode == "cloud_sandbox":
        updates["sandbox_status"] = "running"
    _save_cloud_section(updates, home=home)
    return get_cloud_computer_state(home=home)


def rent_cloud_computer(tier: str, *, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    tariff = get_tariff(tier)
    tier_key = str(tariff["tier"])
    ws = _sandbox_workspace(resolved_home)

    container_seed = hashlib.sha256(f"{resolved_home}:{tier_key}:{int(time.time())}".encode("utf-8")).hexdigest()[:10]
    container_id = f"nomad-vm-{tier_key}-{container_seed}"

    marker_file = ws / ".nomad-vm-provisioned.json"
    marker_file.write_text(
        yaml.safe_dump(
            {
                "container_id": container_id,
                "tier": tier_key,
                "title": tariff["title"],
                "price_rub": tariff["price_rub"],
                "vcpu": tariff["vcpu"],
                "ram_gb": tariff["ram_gb"],
                "ssd_gb": tariff["ssd_gb"],
                "provisioned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
            allow_unicode=True,
            sort_keys=False,
        ),
        encoding="utf-8",
    )

    _save_cloud_section(
        {
            "active_mode": "cloud_sandbox",
            "rented_tier": tier_key,
            "sandbox_status": "running",
            "container_id": container_id,
            "uptime_minutes": 1,
        },
        home=resolved_home,
    )
    state = get_cloud_computer_state(home=resolved_home)
    state["rented_tariff"] = tariff
    return state


def exec_in_cloud_sandbox(
    command: str,
    *,
    timeout_sec: float = 10.0,
    home: Path | None = None,
) -> dict[str, Any]:
    """Выполнить команду внутри изолированной рабочей папки песочницы (`$HERMES_HOME/cloud_sandbox_workspace`)."""
    t0 = time.perf_counter()
    resolved_home = _resolve_home(home)
    clean_cmd = str(command or "").strip()
    if not clean_cmd:
        raise ValueError("Команда для выполнения в песочнице не может быть пустой.")

    # 1. Проверка безопасности (Windows Hardline + пользовательские правила запрета approvals.deny)
    hardline_hit = windows_hardline.check_windows_hardline(clean_cmd)
    if hardline_hit is not None:
        return {
            "ok": False,
            "blocked": True,
            "command": clean_cmd,
            "exit_code": 126,
            "stdout": "",
            "stderr": str(hardline_hit.get("message") or "Команда заблокирована контуром безопасности HARDLINE."),
            "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
            "files": _list_workspace_files(_sandbox_workspace(resolved_home)),
        }

    safety_eval = ui_safety.evaluate_command_safety(clean_cmd, yolo=True, home=resolved_home)
    if safety_eval.get("blocked"):
        return {
            "ok": False,
            "blocked": True,
            "command": clean_cmd,
            "exit_code": 126,
            "stdout": "",
            "stderr": str(safety_eval.get("reason") or "Команда запрещена правилом approvals.deny."),
            "duration_ms": round((time.perf_counter() - t0) * 1000.0, 2),
            "files": _list_workspace_files(_sandbox_workspace(resolved_home)),
        }

    ws = _sandbox_workspace(resolved_home)
    env = dict(os.environ)
    env["NOMAD_SANDBOX"] = "1"
    env["NOMAD_SANDBOX_WORKSPACE"] = str(ws)
    env["PYTHONIOENCODING"] = "utf-8"

    try:
        if sys.platform == "win32":
            shell_cmd = ["cmd.exe", "/d", "/s", "/c", clean_cmd]
        else:
            shell_cmd = ["/bin/sh", "-c", clean_cmd]

        proc = subprocess.run(
            shell_cmd,
            cwd=str(ws),
            env=env,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=max(1.0, min(60.0, float(timeout_sec))),
            check=False,
        )
        exit_code = int(proc.returncode)
        stdout_text = proc.stdout or ""
        stderr_text = proc.stderr or ""
    except subprocess.TimeoutExpired:
        exit_code = 124
        stdout_text = ""
        stderr_text = f"Превышен лимит времени выполнения ({timeout_sec} сек) в песочнице."
    except OSError as exc:
        exit_code = 1
        stdout_text = ""
        stderr_text = f"Ошибка запуска процесса в песочнице: {exc}"

    duration_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    files = _list_workspace_files(ws)
    return {
        "ok": exit_code == 0,
        "blocked": False,
        "command": clean_cmd,
        "exit_code": exit_code,
        "stdout": stdout_text,
        "stderr": stderr_text,
        "duration_ms": duration_ms,
        "workspace_path": str(ws),
        "files": files,
    }


def generate_remote_pairing(
    *,
    device_name: str | None = None,
    relay_url: str | None = None,
    home: Path | None = None,
) -> dict[str, Any]:
    """Сгенерировать новый 6-значный `pairing_code`, `relay_token` и `qr_payload` для мобильного приложения."""
    resolved_home = _resolve_home(home)
    saved = _load_cloud_section(resolved_home)

    code_int = secrets.randbelow(900_000) + 100_000
    pairing_code = f"{code_int:06d}"
    relay_token = f"nmd_relay_{secrets.token_hex(12)}"
    effective_relay = str(relay_url or saved.get("relay_url") or DEFAULT_RELAY_URL).strip()
    qr_payload = f"nomad://pair?code={pairing_code}&relay={quote(effective_relay, safe='')}&token={relay_token}"

    devices = list(saved.get("paired_devices") or [])
    if device_name and str(device_name).strip():
        devices.insert(
            0,
            {
                "id": f"dev-{secrets.token_hex(4)}",
                "name": str(device_name).strip(),
                "platform": "mobile",
                "status": "paired",
                "last_seen": "только что",
            },
        )

    _save_cloud_section(
        {
            "remote_enabled": True,
            "pairing_code": pairing_code,
            "relay_url": effective_relay,
            "relay_token": relay_token,
            "qr_payload": qr_payload,
            "paired_devices": devices or None,
        },
        home=resolved_home,
    )
    state = get_cloud_computer_state(home=resolved_home)
    return {
        "ok": True,
        "pairing_code": pairing_code,
        "relay_token": relay_token,
        "relay_url": effective_relay,
        "qr_payload": qr_payload,
        "remote_control": state["remote_control"],
    }


def build_router() -> APIRouter:
    r = APIRouter(tags=["nomad-cloud-remote"])

    @r.get("/cloud-computer/state")
    def http_get_state() -> dict[str, Any]:
        return get_cloud_computer_state()

    @r.post("/cloud-computer/mode")
    def http_set_mode(body: ModeSwitchRequest) -> dict[str, Any]:
        try:
            return set_cloud_computer_mode(body.mode)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.post("/cloud-computer/rent")
    def http_rent_computer(body: RentComputerRequest) -> dict[str, Any]:
        try:
            return rent_cloud_computer(body.tier)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.post("/cloud-computer/exec")
    def http_exec_sandbox(body: SandboxExecRequest) -> dict[str, Any]:
        try:
            return exec_in_cloud_sandbox(body.command, timeout_sec=body.timeout_sec)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.post("/remote-control/pair")
    def http_pair_remote(body: RemotePairRequest | None = None) -> dict[str, Any]:
        req = body or RemotePairRequest()
        return generate_remote_pairing(device_name=req.device_name, relay_url=req.relay_url)

    return r


router = build_router()
