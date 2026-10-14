"""Detached executor process launcher for the Nomad conductor loop (M-165 / N8, spec §2.2, §5.3).

Зачем:
1. На Windows ``gateway`` гасится через ``taskkill /T /F /PID <gateway_pid>`` — с флагом ``/T``,
   убивающим всё дерево дочерних процессов по ``ParentProcessId``. Простой ``DETACHED_PROCESS``
   или ``CREATE_NEW_PROCESS_GROUP`` оставляет ``ParentProcessId == gateway_pid``, и остановка шлюза
   убивает живых исполнителей посреди работы.
2. Обёртки ``.cmd`` / ``.bat`` (например ``claude.cmd``, ``codex.cmd``) при ``kill`` дерева
   оставляют висеть настоящий ``.exe``, который продолжает писать в рабочий каталог слота.
   Поэтому ``launcher`` разрешает путь до нативного ``claude.exe`` / ``codex.exe`` (в том числе
   за обёрткой npm), а если нативного ``.exe`` нет — отказывает до старта (:class:`ShimExecutableError`).
3. Окружение каждого дочернего процесса строится через единый помощник M-090 (:mod:`.spawn`:
   ``spawn.child_env`` / ``spawn.run``), с UTF-8 и изоляцией каталога слота (``slot_dir``).
4. После старта в ``data.db`` (таблица ``worker_processes``) записываются ``pid``, ``start_time``
   и ``slot_dir``.
"""

from __future__ import annotations

import base64
import ctypes
import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import uuid
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional, Union

from . import capabilities, db, spawn

PathLike = Union[str, "os.PathLike[str]"]

SHIM_EXTENSIONS: frozenset[str] = frozenset({".cmd", ".bat", ".ps1", ".vbs", ".sh"})
SUPPORTED_METHODS: frozenset[str] = frozenset({"wmi", "schtasks", "trampoline"})

PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PROCESS_SYNCHRONIZE = 0x00100000
TH32CS_SNAPPROCESS = 0x00000002
WAIT_TIMEOUT = 0x00000102
STILL_ACTIVE = 259
_EPOCH_AS_FILETIME = 116444736000000000
_HUNDREDS_OF_NANOSECONDS = 10_000_000


class LauncherError(RuntimeError):
    """Base error raised when an executor process cannot be launched."""


class ShimExecutableError(LauncherError, ValueError):
    """Raised when a ``.cmd`` / ``.bat`` wrapper is passed and no native ``.exe`` exists behind it."""


@dataclass(frozen=True)
class LaunchedProcess:
    """Metadata of a detached executor process started by :func:`launch_worker`."""

    pid: int
    start_time: float
    slot_dir: Path
    executable: Path
    command: tuple[str, ...]
    parent_pid: Optional[int]
    gateway_pid: int
    method: str
    task_id: str = ""
    run_id: str = ""
    lane: str = ""
    env: dict[str, str] = field(default_factory=dict, repr=False)

    def to_dict(self) -> dict[str, Any]:
        return {
            "pid": self.pid,
            "start_time": self.start_time,
            "slot_dir": str(self.slot_dir),
            "executable": str(self.executable),
            "command": list(self.command),
            "parent_pid": self.parent_pid,
            "gateway_pid": self.gateway_pid,
            "method": self.method,
            "task_id": self.task_id,
            "run_id": self.run_id,
            "lane": self.lane,
        }


# ---------------------------------------------------------------------------
# Win32 process inspection (start_time, ParentProcessId, liveness)
# ---------------------------------------------------------------------------

if sys.platform == "win32":
    import ctypes.wintypes

    class _FILETIME(ctypes.Structure):
        _fields_ = [
            ("dwLowDateTime", ctypes.wintypes.DWORD),
            ("dwHighDateTime", ctypes.wintypes.DWORD),
        ]

    class _PROCESSENTRY32W(ctypes.Structure):
        _fields_ = [
            ("dwSize", ctypes.wintypes.DWORD),
            ("cntUsage", ctypes.wintypes.DWORD),
            ("th32ProcessID", ctypes.wintypes.DWORD),
            ("th32DefaultHeapID", ctypes.POINTER(ctypes.c_ulong)),
            ("th32ModuleID", ctypes.wintypes.DWORD),
            ("cntThreads", ctypes.wintypes.DWORD),
            ("th32ParentProcessID", ctypes.wintypes.DWORD),
            ("pcPriClassBase", ctypes.wintypes.LONG),
            ("dwFlags", ctypes.wintypes.DWORD),
            ("szExeFile", ctypes.c_wchar * 260),
        ]


def get_process_start_time(pid: int) -> Optional[float]:
    """Return the OS process creation timestamp (Unix epoch seconds) for ``pid``, or ``None``."""
    if isinstance(pid, bool) or int(pid) <= 0:
        return None
    target_pid = int(pid)
    if sys.platform == "win32":
        k32 = ctypes.windll.kernel32
        handle = k32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, target_pid)
        if not handle:
            return None
        try:
            ct = _FILETIME()
            et = _FILETIME()
            kt = _FILETIME()
            ut = _FILETIME()
            ok = k32.GetProcessTimes(
                handle,
                ctypes.byref(ct),
                ctypes.byref(et),
                ctypes.byref(kt),
                ctypes.byref(ut),
            )
            if not ok:
                return None
            ticks = (int(ct.dwHighDateTime) << 32) | int(ct.dwLowDateTime)
            if ticks <= _EPOCH_AS_FILETIME:
                return None
            return (ticks - _EPOCH_AS_FILETIME) / _HUNDREDS_OF_NANOSECONDS
        finally:
            k32.CloseHandle(handle)

    proc_stat = Path(f"/proc/{target_pid}/stat")
    if proc_stat.is_file():
        try:
            return proc_stat.stat().st_ctime
        except OSError:
            return None
    return None


def get_process_parent_pid(pid: int) -> Optional[int]:
    """Return ``ParentProcessId`` of ``pid`` from the OS process table, or ``None`` if not found."""
    if isinstance(pid, bool) or int(pid) <= 0:
        return None
    target_pid = int(pid)
    if sys.platform == "win32":
        k32 = ctypes.windll.kernel32
        snap = k32.CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0)
        if snap and snap != ctypes.wintypes.HANDLE(-1).value:
            try:
                pe = _PROCESSENTRY32W()
                pe.dwSize = ctypes.sizeof(_PROCESSENTRY32W)
                if k32.Process32FirstW(snap, ctypes.byref(pe)):
                    while True:
                        if int(pe.th32ProcessID) == target_pid:
                            return int(pe.th32ParentProcessID)
                        if not k32.Process32NextW(snap, ctypes.byref(pe)):
                            break
            finally:
                k32.CloseHandle(snap)
        return None

    proc_status = Path(f"/proc/{target_pid}/status")
    if proc_status.is_file():
        try:
            for line in proc_status.read_text(encoding="utf-8", errors="replace").splitlines():
                if line.startswith("PPid:"):
                    return int(line.split(":", 1)[1].strip())
        except (OSError, ValueError):
            return None
    return None


def is_process_alive(
    pid: int,
    *,
    expected_start_time: Optional[float] = None,
    tolerance_seconds: float = 1.0,
) -> bool:
    """Return ``True`` if ``pid`` is currently running and matches ``expected_start_time``."""
    if isinstance(pid, bool) or int(pid) <= 0:
        return False
    target_pid = int(pid)
    if sys.platform == "win32":
        k32 = ctypes.windll.kernel32
        handle = k32.OpenProcess(
            PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
            False,
            target_pid,
        )
        if not handle:
            return False
        try:
            wait_res = k32.WaitForSingleObject(handle, 0)
            if wait_res != WAIT_TIMEOUT:
                return False
        finally:
            k32.CloseHandle(handle)
    else:
        try:
            os.kill(target_pid, 0)
        except OSError:
            return False

    if expected_start_time is not None:
        actual_start = get_process_start_time(target_pid)
        if actual_start is None:
            return False
        if abs(actual_start - float(expected_start_time)) > float(tolerance_seconds):
            return False
    return True


def terminate_process(pid: int, *, expected_start_time: Optional[float] = None) -> bool:
    """Terminate ``pid`` only if its creation timestamp matches ``expected_start_time``."""
    if not is_process_alive(pid, expected_start_time=expected_start_time):
        return False
    target_pid = int(pid)
    if sys.platform == "win32":
        PROCESS_TERMINATE = 0x0001
        k32 = ctypes.windll.kernel32
        handle = k32.OpenProcess(PROCESS_TERMINATE, False, target_pid)
        if not handle:
            return False
        try:
            return bool(k32.TerminateProcess(handle, 1))
        finally:
            k32.CloseHandle(handle)
    try:
        os.kill(target_pid, 15)
        return True
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Native executable resolution (.exe required, .cmd/.bat refused)
# ---------------------------------------------------------------------------

def _find_native_exe_behind_shim(shim_path: Path) -> Optional[Path]:
    """Locate a real ``.exe`` behind an npm/Windows ``.cmd`` or ``.bat`` shim."""
    found = capabilities.native_behind_npm_shim(shim_path, shim_path.stem)
    if found is not None and found.is_file() and found.suffix.lower() == ".exe":
        return found.resolve()

    stem = shim_path.stem
    for suffix in ("-cli", ""):
        base_stem = stem[: -len(suffix)] if suffix and stem.lower().endswith(suffix) else stem
        sibling_exe = shim_path.with_name(f"{base_stem}.exe")
        if sibling_exe.is_file():
            return sibling_exe.resolve()
        bin_exe = shim_path.parent / "bin" / f"{base_stem}.exe"
        if bin_exe.is_file():
            return bin_exe.resolve()
        nm_root = shim_path.parent / "node_modules"
        if nm_root.is_dir():
            for candidate in sorted(nm_root.rglob(f"{base_stem}.exe")):
                if candidate.is_file():
                    return candidate.resolve()
    return None


def resolve_native_executable(
    executable_or_cli: PathLike,
    *,
    path: Optional[str] = None,
    which: Optional[Callable[[str], Optional[str]]] = None,
    resolve_shims: bool = True,
) -> Path:
    """Resolve ``executable_or_cli`` to a native ``.exe`` binary.

    - Never returns a ``.cmd``, ``.bat``, ``.ps1``, or ``.sh`` wrapper.
    - When given ``claude.cmd`` / ``codex.cmd`` (or ``"claude"`` / ``"codex"`` whose ``PATH``
      entry is an npm ``.cmd`` shim) and ``resolve_shims=True``, finds the native ``claude.exe``
      or ``codex.exe`` behind the shim.
    - If no native ``.exe`` exists (or ``resolve_shims=False``), raises :class:`ShimExecutableError`.
    """
    raw = str(executable_or_cli).strip() if executable_or_cli is not None else ""
    if not raw:
        raise ShimExecutableError("executable_or_cli must be non-empty")

    candidate_path = Path(raw)
    ext = candidate_path.suffix.lower()

    # 1. Explicit path or filename with a shim extension (.cmd / .bat / .ps1).
    if ext in SHIM_EXTENSIONS:
        if resolve_shims and candidate_path.is_file():
            native = _find_native_exe_behind_shim(candidate_path)
            if native is not None:
                return native
        raise ShimExecutableError(
            f"refusing to launch wrapper {candidate_path.name!r}: native .exe binary is required "
            f"(no native .exe found behind shim {str(candidate_path)!r})"
        )

    # 2. Direct path to an existing native binary.
    if candidate_path.is_file():
        if sys.platform == "win32" and ext != ".exe":
            exe_sibling = candidate_path.with_suffix(".exe")
            if exe_sibling.is_file():
                return exe_sibling.resolve()
            raise ShimExecutableError(
                f"refusing to launch non-.exe file on Windows: {str(candidate_path)!r}"
            )
        return candidate_path.resolve()

    # 3. Symbolic CLI name ("claude", "claude-code", "codex", etc.).
    cli_key = raw.lower()
    if cli_key in ("claude-code", "claude"):
        cli_name = "claude"
    elif cli_key == "codex":
        cli_name = "codex"
    else:
        cli_name = raw

    lookup_path = os.environ.get("PATH", "") if path is None else path
    found_str = which(cli_name) if which is not None else shutil.which(cli_name, path=lookup_path)
    if found_str:
        found_path = Path(found_str)
        if found_path.suffix.lower() in SHIM_EXTENSIONS:
            if resolve_shims and found_path.is_file():
                native = _find_native_exe_behind_shim(found_path)
                if native is not None:
                    return native
            raise ShimExecutableError(
                f"refusing to launch wrapper {found_path.name!r} from PATH: native .exe required"
            )
        if found_path.is_file():
            return found_path.resolve()

    resolved = capabilities.resolve_windows_cli(cli_name, which=which)
    if resolved is not None and resolved.is_file():
        if resolved.suffix.lower() in SHIM_EXTENSIONS:
            if resolve_shims:
                native = _find_native_exe_behind_shim(resolved)
                if native is not None:
                    return native
            raise ShimExecutableError(
                f"resolved {cli_name!r} to wrapper {str(resolved)!r}; native .exe required"
            )
        return resolved.resolve()

    raise ShimExecutableError(f"native .exe executable not found for {raw!r}")


# ---------------------------------------------------------------------------
# Environment construction via M-090 helper (spawn.py)
# ---------------------------------------------------------------------------

def build_worker_env(
    env: Optional[Mapping[str, str]] = None,
    *,
    slot_dir: PathLike,
    lane: str = "",
    task_id: str = "",
    run_id: str = "",
    hermes_home: Optional[PathLike] = None,
) -> dict[str, str]:
    """Build child environment via M-090 helper (:func:`spawn.child_env`) with slot isolation."""
    slot_path = Path(slot_dir).expanduser().resolve()
    base_env = spawn.child_env(env, hermes_home=hermes_home)
    base_env["PYTHONUTF8"] = "1"
    base_env["PYTHONIOENCODING"] = "utf-8"
    base_env["NOMAD_SLOT_DIR"] = str(slot_path)

    lane_lower = str(lane or "").strip().lower()
    if "claude" in lane_lower:
        base_env["CLAUDE_CONFIG_DIR"] = str(slot_path)
    elif "codex" in lane_lower:
        base_env["CODEX_HOME"] = str(slot_path)
    else:
        base_env.setdefault("CLAUDE_CONFIG_DIR", str(slot_path))
        base_env.setdefault("CODEX_HOME", str(slot_path))

    if task_id:
        base_env["NOMAD_TASK_ID"] = str(task_id)
    if run_id:
        base_env["NOMAD_RUN_ID"] = str(run_id)
    return base_env


# ---------------------------------------------------------------------------
# Detached launch backends (WMI Win32_Process.Create, schtasks /Run, trampoline)
# ---------------------------------------------------------------------------

def _creationflags_no_window() -> int:
    return int(getattr(subprocess, "CREATE_NO_WINDOW", 0)) if sys.platform == "win32" else 0


def _launch_via_wmi(
    command: Sequence[str],
    *,
    cwd: Path,
    env: Mapping[str, str],
    hermes_home: Optional[PathLike] = None,
    timeout: float = 20.0,
) -> tuple[int, Optional[float]]:
    """Launch ``command`` via WMI ``Win32_Process.Create`` so ``ParentProcessId != gateway_pid``."""
    cmd_line = subprocess.list2cmdline([str(part) for part in command])
    env_list = [f"{k}={v}" for k, v in env.items() if k and "\x00" not in k and "\x00" not in str(v)]

    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".nomad-wmi.json",
        delete=False,
        encoding="utf-8",
    ) as tmp_file:
        json.dump(
            {
                "command_line": cmd_line,
                "cwd": str(cwd),
                "env": env_list,
            },
            tmp_file,
            ensure_ascii=False,
        )
        payload_path = Path(tmp_file.name)

    try:
        ps_path = str(payload_path).replace("'", "''")
        ps_script = (
            "$ErrorActionPreference = 'Stop'\n"
            f"$data = Get-Content -LiteralPath '{ps_path}' -Raw -Encoding UTF8 | ConvertFrom-Json\n"
            "$envArr = [string[]]@($data.env)\n"
            "$startup = New-CimInstance -ClassName Win32_ProcessStartup "
            "-Property @{ ShowWindow = [uint16]0; EnvironmentVariables = $envArr } -ClientOnly\n"
            "$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{\n"
            "    CommandLine = [string]$data.command_line\n"
            "    CurrentDirectory = [string]$data.cwd\n"
            "    ProcessStartupInformation = $startup\n"
            "}\n"
            "$out = @{ return_value = [int]$res.ReturnValue; pid = [int]($res.ProcessId) } "
            "| ConvertTo-Json -Compress\n"
            "Write-Output $out\n"
        )
        encoded = base64.b64encode(ps_script.encode("utf-16le")).decode("ascii")
        completed = spawn.run(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
            env=env,
            hermes_home=hermes_home,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            creationflags=_creationflags_no_window(),
        )
    finally:
        try:
            payload_path.unlink(missing_ok=True)
        except OSError:
            pass

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise LauncherError(f"WMI Win32_Process.Create failed (exit {completed.returncode}): {detail}")

    raw_out = (completed.stdout or "").strip()
    lines = [line.strip() for line in raw_out.splitlines() if line.strip().startswith("{")]
    if not lines:
        raise LauncherError(f"WMI Win32_Process.Create returned unexpected output: {raw_out!r}")

    data = json.loads(lines[-1])
    ret_val = int(data.get("return_value", -1))
    pid = int(data.get("pid") or 0)
    if ret_val != 0 or pid <= 0:
        raise LauncherError(
            f"WMI Win32_Process.Create returned code {ret_val} (pid={pid})"
        )

    start_time = get_process_start_time(pid)
    return pid, start_time


def _launch_via_trampoline(
    command: Sequence[str],
    *,
    cwd: Path,
    env: Mapping[str, str],
    hermes_home: Optional[PathLike] = None,
    timeout: float = 15.0,
) -> tuple[int, Optional[float]]:
    """Launch ``command`` via a short-lived intermediate process that exits immediately."""
    trampoline_code = (
        "import json, os, subprocess, sys, time\n"
        "payload = json.loads(sys.stdin.read())\n"
        "flags = 0\n"
        "if sys.platform == 'win32':\n"
        "    flags = ("
        "getattr(subprocess, 'DETACHED_PROCESS', 0x00000008) | "
        "getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0x00000200) | "
        "getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)"
        ")\n"
        "proc = subprocess.Popen(\n"
        "    payload['command'],\n"
        "    cwd=payload['cwd'],\n"
        "    env=payload['env'],\n"
        "    stdin=subprocess.DEVNULL,\n"
        "    stdout=subprocess.DEVNULL,\n"
        "    stderr=subprocess.DEVNULL,\n"
        "    close_fds=True,\n"
        "    creationflags=flags,\n"
        "    start_new_session=(sys.platform != 'win32'),\n"
        ")\n"
        "sys.stdout.write(json.dumps({'pid': proc.pid, 'ts': time.time()}))\n"
        "sys.stdout.flush()\n"
    )
    payload_json = json.dumps(
        {
            "command": [str(part) for part in command],
            "cwd": str(cwd),
            "env": dict(env),
        },
        ensure_ascii=False,
    )
    completed = spawn.run(
        [sys.executable, "-c", trampoline_code],
        input=payload_json,
        env=env,
        hermes_home=hermes_home,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
        check=False,
        creationflags=_creationflags_no_window(),
    )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise LauncherError(f"trampoline launch failed (exit {completed.returncode}): {detail}")
    parsed = json.loads((completed.stdout or "").strip())
    pid = int(parsed["pid"])
    start_time = get_process_start_time(pid) or float(parsed.get("ts") or time.time())
    return pid, start_time


def _launch_via_schtasks(
    command: Sequence[str],
    *,
    cwd: Path,
    env: Mapping[str, str],
    hermes_home: Optional[PathLike] = None,
    timeout: float = 20.0,
) -> tuple[int, Optional[float]]:
    """Launch ``command`` through Windows Task Scheduler (``schtasks /Run``)."""
    token = uuid.uuid4().hex[:12]
    task_name = f"NomadWorker_{token}"
    temp_dir = Path(tempfile.gettempdir())
    req_file = temp_dir / f"nomad_schtasks_req_{token}.json"
    res_file = temp_dir / f"nomad_schtasks_res_{token}.json"
    runner_py = temp_dir / f"nomad_schtasks_run_{token}.py"

    req_file.write_text(
        json.dumps(
            {
                "command": [str(part) for part in command],
                "cwd": str(cwd),
                "env": dict(env),
                "res_file": str(res_file),
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )
    runner_py.write_text(
        "import json, pathlib, subprocess, sys, time\n"
        f"req = json.loads(pathlib.Path({str(req_file)!r}).read_text(encoding='utf-8'))\n"
        "flags = getattr(subprocess, 'CREATE_NO_WINDOW', 0x08000000)\n"
        "p = subprocess.Popen(\n"
        "    req['command'], cwd=req['cwd'], env=req['env'],\n"
        "    stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,\n"
        "    creationflags=flags,\n"
        ")\n"
        "pathlib.Path(req['res_file']).write_text("
        "json.dumps({'pid': p.pid, 'ts': time.time()}), encoding='utf-8')\n",
        encoding="utf-8",
    )

    tr_command = subprocess.list2cmdline([sys.executable, str(runner_py)])
    try:
        create_proc = spawn.run(
            [
                "schtasks.exe",
                "/Create",
                "/TN",
                task_name,
                "/TR",
                tr_command,
                "/SC",
                "ONCE",
                "/ST",
                "00:00",
                "/F",
            ],
            env=env,
            hermes_home=hermes_home,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            creationflags=_creationflags_no_window(),
        )
        if create_proc.returncode != 0:
            raise LauncherError(f"schtasks /Create failed: {(create_proc.stderr or create_proc.stdout).strip()}")

        run_proc = spawn.run(
            ["schtasks.exe", "/Run", "/I", "/TN", task_name],
            env=env,
            hermes_home=hermes_home,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            check=False,
            creationflags=_creationflags_no_window(),
        )
        if run_proc.returncode != 0:
            raise LauncherError(f"schtasks /Run failed: {(run_proc.stderr or run_proc.stdout).strip()}")

        deadline = time.monotonic() + min(timeout, 10.0)
        while time.monotonic() < deadline:
            if res_file.is_file():
                try:
                    data = json.loads(res_file.read_text(encoding="utf-8"))
                    pid = int(data["pid"])
                    if pid > 0:
                        start_time = get_process_start_time(pid) or float(data.get("ts") or time.time())
                        return pid, start_time
                except (OSError, ValueError, KeyError):
                    pass
            time.sleep(0.05)
        raise LauncherError("schtasks /Run did not produce a worker PID within timeout")
    finally:
        spawn.run(
            ["schtasks.exe", "/Delete", "/TN", task_name, "/F"],
            env=env,
            hermes_home=hermes_home,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=10.0,
            check=False,
            creationflags=_creationflags_no_window(),
        )
        for path in (req_file, res_file, runner_py):
            try:
                path.unlink(missing_ok=True)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# High-level launch_detached & launch_worker
# ---------------------------------------------------------------------------

def launch_detached(
    executable_or_cli: PathLike,
    args: Sequence[PathLike] = (),
    *,
    slot_dir: PathLike,
    lane: str = "",
    task_id: str = "",
    run_id: str = "",
    env: Optional[Mapping[str, str]] = None,
    hermes_home: Optional[PathLike] = None,
    gateway_pid: Optional[int] = None,
    method: str = "wmi",
    path: Optional[str] = None,
    which: Optional[Callable[[str], Optional[str]]] = None,
    resolve_shims: bool = True,
) -> LaunchedProcess:
    """Resolve native ``.exe``, prepare M-090 environment, and start a detached process.

    Guarantees:
    - ``executable`` is a native binary (never ``.cmd`` / ``.bat``);
    - environment is built via ``spawn.child_env`` (M-090);
    - ``ParentProcessId != gateway_pid`` (defaults to ``os.getpid()``).
    """
    method_norm = str(method or "wmi").strip().lower()
    if method_norm not in SUPPORTED_METHODS:
        raise ValueError(f"unsupported launch method {method!r}; expected one of {sorted(SUPPORTED_METHODS)}")

    native_exe = resolve_native_executable(
        executable_or_cli,
        path=path,
        which=which,
        resolve_shims=resolve_shims,
    )
    if native_exe.suffix.lower() in SHIM_EXTENSIONS:
        raise ShimExecutableError(f"refusing to launch shim {str(native_exe)!r}")

    slot_path = Path(slot_dir).expanduser().resolve()
    slot_path.mkdir(parents=True, exist_ok=True)

    worker_env = build_worker_env(
        env,
        slot_dir=slot_path,
        lane=lane or native_exe.stem,
        task_id=task_id,
        run_id=run_id,
        hermes_home=hermes_home,
    )

    full_command = tuple([str(native_exe), *(str(a) for a in args)])
    effective_gateway_pid = int(gateway_pid) if gateway_pid is not None else os.getpid()

    if sys.platform != "win32" and method_norm in ("wmi", "schtasks"):
        effective_method = "trampoline"
    else:
        effective_method = method_norm

    if effective_method == "wmi":
        pid, start_time = _launch_via_wmi(
            full_command,
            cwd=slot_path,
            env=worker_env,
            hermes_home=hermes_home,
        )
    elif effective_method == "schtasks":
        pid, start_time = _launch_via_schtasks(
            full_command,
            cwd=slot_path,
            env=worker_env,
            hermes_home=hermes_home,
        )
    else:
        pid, start_time = _launch_via_trampoline(
            full_command,
            cwd=slot_path,
            env=worker_env,
            hermes_home=hermes_home,
        )

    resolved_start = float(start_time) if start_time is not None else time.time()
    parent_pid = get_process_parent_pid(pid)
    if parent_pid is not None and parent_pid == effective_gateway_pid:
        terminate_process(pid, expected_start_time=resolved_start)
        raise LauncherError(
            f"detached launch invariant violated: worker pid={pid} has "
            f"ParentProcessId={parent_pid} == gateway_pid={effective_gateway_pid}"
        )

    return LaunchedProcess(
        pid=pid,
        start_time=resolved_start,
        slot_dir=slot_path,
        executable=native_exe,
        command=full_command,
        parent_pid=parent_pid,
        gateway_pid=effective_gateway_pid,
        method=effective_method,
        task_id=str(task_id or ""),
        run_id=str(run_id or ""),
        lane=str(lane or native_exe.stem),
        env=worker_env,
    )


def launch_worker(
    conn: sqlite3.Connection,
    executable_or_cli: PathLike,
    args: Sequence[PathLike] = (),
    *,
    slot_dir: PathLike,
    lane: str = "",
    task_id: str = "",
    run_id: str = "",
    swarm_id: Optional[str] = None,
    env: Optional[Mapping[str, str]] = None,
    hermes_home: Optional[PathLike] = None,
    gateway_pid: Optional[int] = None,
    method: str = "wmi",
    path: Optional[str] = None,
    which: Optional[Callable[[str], Optional[str]]] = None,
    resolve_shims: bool = True,
) -> LaunchedProcess:
    """Launch a detached executor process and record ``(pid, start_time, slot_dir)`` in ``data.db``."""
    launched = launch_detached(
        executable_or_cli,
        args,
        slot_dir=slot_dir,
        lane=lane,
        task_id=task_id,
        run_id=run_id,
        env=env,
        hermes_home=hermes_home,
        gateway_pid=gateway_pid,
        method=method,
        path=path,
        which=which,
        resolve_shims=resolve_shims,
    )
    db.record_worker_process(
        conn,
        pid=launched.pid,
        start_time=launched.start_time,
        slot_dir=str(launched.slot_dir),
        task_id=launched.task_id,
        run_id=launched.run_id,
        lane=launched.lane,
        executable=str(launched.executable),
        parent_pid=launched.parent_pid,
        gateway_pid=launched.gateway_pid,
        method=launched.method,
        status="running",
        swarm_id=swarm_id,
    )
    return launched


# ---------------------------------------------------------------------------
# Stop marker helpers for expired / timed-out cards (M-167)
# ---------------------------------------------------------------------------

DEFAULT_STOP_MARKER_FILENAME = "STOP"


def resolve_stop_marker_path(
    run_dir: Optional[PathLike] = None,
    *,
    stop_marker: Optional[PathLike] = None,
    slot_dir: Optional[PathLike] = None,
) -> Path:
    """Resolve the filesystem path for a card's ``STOP`` marker file."""
    if stop_marker is not None and str(stop_marker).strip():
        candidate = Path(stop_marker).expanduser().resolve()
        if candidate.is_dir():
            return candidate / DEFAULT_STOP_MARKER_FILENAME
        return candidate

    base_dir = run_dir if run_dir is not None else slot_dir
    if base_dir is None or not str(base_dir).strip():
        raise ValueError("either stop_marker, run_dir, or slot_dir must be provided")

    resolved = Path(base_dir).expanduser().resolve()
    if resolved.name.upper() == DEFAULT_STOP_MARKER_FILENAME or resolved.suffix:
        return resolved
    return resolved / DEFAULT_STOP_MARKER_FILENAME


def write_stop_marker(
    run_dir: Optional[PathLike] = None,
    *,
    stop_marker: Optional[PathLike] = None,
    slot_dir: Optional[PathLike] = None,
    task_id: str = "",
    run_id: str = "",
    reason: str = "card_deadline_exceeded",
    deadline_s: Optional[float] = None,
    elapsed_s: Optional[float] = None,
    pid: Optional[int] = None,
    expected_start_time: Optional[float] = None,
    terminate: bool = False,
) -> Path:
    """Atomically write a ``STOP`` marker for an overdue or cancelled card (M-167).

    If ``terminate=True`` and ``pid`` is provided, also terminates the worker
    process only if its ``(pid, expected_start_time)`` still matches.
    """
    marker_path = resolve_stop_marker_path(
        run_dir,
        stop_marker=stop_marker,
        slot_dir=slot_dir,
    )
    marker_path.parent.mkdir(parents=True, exist_ok=True)

    payload: dict[str, Any] = {
        "stop": True,
        "reason": str(reason or "card_deadline_exceeded"),
        "task_id": str(task_id or ""),
        "run_id": str(run_id or ""),
        "ts": time.time(),
    }
    if deadline_s is not None:
        payload["deadline_s"] = float(deadline_s)
    if elapsed_s is not None:
        payload["elapsed_s"] = round(float(elapsed_s), 3)
    if pid is not None and int(pid) > 0:
        payload["pid"] = int(pid)

    tmp_path = marker_path.with_name(f".{marker_path.name}.{uuid.uuid4().hex[:8]}.tmp")
    tmp_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(marker_path)

    if terminate and pid is not None and int(pid) > 0:
        terminate_process(int(pid), expected_start_time=expected_start_time)

    return marker_path


def has_stop_marker(
    run_dir: Optional[PathLike] = None,
    *,
    stop_marker: Optional[PathLike] = None,
    slot_dir: Optional[PathLike] = None,
) -> bool:
    """Return ``True`` if the resolved ``STOP`` marker file exists on disk."""
    try:
        marker_path = resolve_stop_marker_path(
            run_dir,
            stop_marker=stop_marker,
            slot_dir=slot_dir,
        )
    except ValueError:
        return False
    return marker_path.is_file()

