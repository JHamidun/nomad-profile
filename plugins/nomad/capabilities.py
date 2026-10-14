"""N3 (M-160): capability catalog — which lanes exist, whether each is ALIVE, how much WINDOW is left.

Каталог отдаётся планировщику ДО планирования (спека §5.8): модель не предлагает того, чего нет,
вместо того чтобы потом вычищать плохой план. На каждую дорожку — одна строка::

    lane, vendor, provider, billing, alive, reason, identity, window_left, window,
    allowed_by_whitelist, work_class, slot

Два поля, которые первая ревизия спеки сливала в одно (§4.1), здесь разведены:

* **живость** (``alive``) — бесплатная проба: ``claude.exe auth status --json``; у Codex — текст
  ``codex login status`` (флага ``--json`` у него нет, строка уходит в stderr) и структурный
  ``account/read`` через ``codex app-server``; у API-дорожек — есть ли ключ в окружении профиля;
* **остаток окна** (``window_left``) — процент оставшегося окна, только если он наблюдался, иначе
  строка ``"unknown"``. У Claude Code квоты наружу нет вовсе (ни в ``auth status``, ни в
  ``-p --output-format json``), поэтому это последнее наблюдение из журнала (``db``), и оно гаснет
  со сбросом своего окна. У Codex есть бесплатный read-only источник — ``account/rateLimits/read``
  app-server (тот же ответ, что у инструмента ``get_usage_limits``): «This read-only tool does not
  consume a reset or purchase credits». Для Codex в счёт идёт ТОЛЬКО свежее чтение: не прочиталось
  (ошибка, таймаут, инструмента нет) — ``unknown``, а не прошлое число из журнала, которое для
  недельного окна прожило бы до семи дней. ``unknown`` для роутера — «тёплый», а не «0 %».

Наблюдение окна принадлежит аккаунту, а не каталогу: в журнал оно пишется с ключом личности
(``account_key``: способ входа + email/организация) и способом оплаты, и засчитывается только при
том же входе. Слот, перелогиненный в другую подписку или на ключ API, чужое окно не наследует;
вход без распознаваемой личности (``oauth_token``, ключ API) не присваивает ничьё.

Чего здесь не бывает ни при каких условиях — платного вызова. Запуск внешней CLI идёт только через
``run_free_probe``/``read_codex_app_server``, а они пропускают лишь argv из ``FREE_PROBES`` и
методы из ``FREE_APP_SERVER_METHODS``; всё прочее (``-p``, ``exec``, ``turn/start``) — отказ
``PaidCallRefused`` ДО старта процесса. Каждый запуск пишется в журнал событий (``lane_probe``,
``paid: false``), так что «ноль платных вызовов» проверяется по журналу, а не на слово.

Бинарь — только нативный: ``claude``/``codex`` в PATH на Windows — это ``.cmd``-шимы npm, у них
чужой pid и своя разборка аргументов в ``cmd.exe`` (спека §3.3). Шим не запускается никогда: либо
найден ``claude.exe``/``codex.exe``, либо дорожка мертва с причиной ``native_cli_not_found``.
Какой именно нативный: тот, что стоит за командой владельца (``claude`` в PATH → нативный бинарь
за её шимом), и только потом первый ``claude.exe`` в PATH — установок бывает несколько, и
случайная из них бывает на сотню сборок старше. Путь запущенного бинаря пишется в журнал.

Слоты — каталоги аккаунтов (§3.3): у каждой CLI есть слот по умолчанию (её собственный каталог
конфига), а в режиме ``owner_machine`` ещё и пул ``<nomad.pool_root>/cc/<имя>`` и
``<nomad.pool_root>/codex/<имя>``. Проба идёт на каталоге слота (``CLAUDE_CONFIG_DIR`` /
``CODEX_HOME``). В проданной сборке (``shipped``) пул не читается вовсе. Регистрация слотов с
проверкой уникальности личности — задача M-164; здесь только обнаружение и пробы.

Белый список платного — ``nomad.paid_provider_allowlist`` (тот же ключ, что у заслонки M-162),
по умолчанию пуст: «ключ есть» ≠ «разрешён». Нечитаемый конфиг не разрешает ничего.
"""

from __future__ import annotations

import json
import logging
import os
import queue
import shutil
import subprocess
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import closing
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable, Optional, Sequence

from . import core_adapter, db, pool_mode, profile_config

logger = logging.getLogger("hermes_plugins.nomad.capabilities")

SUBSCRIPTION, METERED, FREE = "subscription", "metered", "free"
BILLINGS = (SUBSCRIPTION, METERED, FREE)
UNKNOWN = "unknown"

CONFIG_SECTION = "nomad"
ALLOWLIST_KEY = "paid_provider_allowlist"
POOL_ROOT_KEY = "pool_root"

# Явный путь к нативному бинарю. Если задан — он единственный кандидат: поиск по PATH не
# подставит вместо него другой файл.
ENV_CLAUDE_EXE = "NOMAD_CLAUDE_EXE"
ENV_CODEX_EXE = "NOMAD_CODEX_EXE"

PROBE_TIMEOUT_S = 30.0
APP_SERVER_TIMEOUT_S = 30.0
APP_SERVER_EXIT_GRACE_S = 5.0
# Наблюдение без времени сброса живёт не дольше самого короткого окна (пятичасового у Claude).
OBSERVATION_MAX_AGE = timedelta(hours=5)
MAX_PROBE_WORKERS = 8

# Единственные команды, которые каталог вправе запустить. Все три ничего не тратят: печать статуса
# входа и JSON-RPC сервер, которому мы шлём только методы чтения ниже.
FREE_PROBES = frozenset({
    ("auth", "status", "--json"),   # claude.exe
    ("login", "status"),            # codex.exe
    ("app-server",),                # codex.exe, JSON-RPC по stdio
})
FREE_APP_SERVER_METHODS = ("initialize", "initialized", "account/read", "account/rateLimits/read")
APP_SERVER_CLIENT = {"name": "nomad-capabilities", "version": "1"}

REASON_NOT_LOGGED_IN = "not_logged_in"
REASON_NATIVE_CLI_NOT_FOUND = "native_cli_not_found"
REASON_PROBE_FAILED = "probe_failed"
REASON_PROBE_UNREADABLE = "probe_unreadable"
REASON_NO_API_KEY = "no_api_key"

_SHIM_SUFFIXES = frozenset({".cmd", ".bat", ".ps1"})

# Где лежит нативный бинарь за npm-шимом (относительно каталога шима) и где он бывает ещё.
_NPM_NATIVE_GLOBS = {
    "claude": ("node_modules/@anthropic-ai/claude-code/bin/claude.exe",),
    "codex": ("node_modules/@openai/codex/node_modules/@openai/codex-*/vendor/*/bin/codex.exe",
              "node_modules/@openai/codex/vendor/*/codex/codex.exe"),
}


def _known_native_locations(cli: str) -> tuple[Path, ...]:
    if cli != "claude":
        return ()
    local_app = os.environ.get("LOCALAPPDATA")
    places = [Path.home() / ".local" / "bin" / "claude.exe"]
    if local_app:
        places.append(Path(local_app) / "Microsoft" / "WinGet" / "Links" / "claude.exe")
    return tuple(places)


# Синонимы id провайдеров в белом списке: владелец пишет id так, как его знает Hermes.
PROVIDER_ALIASES = {
    "kimi-coding": "kimi",
    "moonshot": "kimi",
    "custom:yandex": "yandex",
    "openai-api": "openai",
    "google": "gemini",
}


class PaidCallRefused(RuntimeError):
    """A probe tried to run something that is not a free read-only command. Nothing was started."""


@dataclass(frozen=True)
class Liveness:
    """What a free probe says about a lane: alive or not, and on whose money it would run."""

    alive: bool
    billing: str
    provider: str
    identity: Optional[dict] = None
    reason: Optional[str] = None


@dataclass(frozen=True)
class Slot:
    """An account directory of a CLI lane. ``home=None`` — the CLI's own default directory."""

    lane: str
    cli: str  # "claude" | "codex"
    home: Optional[Path] = None


@dataclass(frozen=True)
class ApiLane:
    lane: str
    vendor: str
    provider: str
    work_class: str
    # Все группы обязательны, внутри группы достаточно любого имени (как api_key_env_vars ядра).
    env_keys: tuple[tuple[str, ...], ...]


# Классы работы — из таблицы спеки §3.1. ``live_window``: у CLI есть бесплатное чтение остатка
# окна, и тогда в счёт идёт только оно; без него (Claude Code) — наблюдение из журнала.
_CLI_LANES = {
    "claude": {"prefix": "claude-code", "vendor": "anthropic", "provider": "claude-code",
               "work_class": "repo_work", "home_env": "CLAUDE_CONFIG_DIR", "pool_dir": "cc",
               "live_window": False},
    "codex": {"prefix": "codex", "vendor": "openai", "provider": "codex",
              "work_class": "precise_patch", "home_env": "CODEX_HOME", "pool_dir": "codex",
              "live_window": True},
}

API_LANES: tuple[ApiLane, ...] = (
    ApiLane("deepseek", "deepseek", "deepseek", "bulk_cheap", (("DEEPSEEK_API_KEY",),)),
    ApiLane("gemini", "google", "gemini", "large_reading", (("GOOGLE_API_KEY", "GEMINI_API_KEY"),)),
    ApiLane("kimi", "moonshot", "kimi", "precise_patch",
            (("KIMI_API_KEY", "KIMI_CODING_API_KEY"),)),
    ApiLane("perplexity", "perplexity", "perplexity", "web_facts", (("PERPLEXITY_API_KEY",),)),
    ApiLane("yandex", "yandex", "yandex", "ru_contour", (("YANDEX_API_KEY",), ("YANDEX_FOLDER_ID",))),
)
TOOL_LANE = "tool"


# --- the paid whitelist ---------------------------------------------------------------------------

def normalize_provider(provider: str) -> str:
    key = provider.strip().lower()
    return PROVIDER_ALIASES.get(key, key)


def paid_allowlist_from(data: Optional[dict]) -> tuple[str, ...]:
    """``nomad.paid_provider_allowlist`` from a parsed config; anything but a list of names → ()."""
    section = (data or {}).get(CONFIG_SECTION)
    raw = section.get(ALLOWLIST_KEY) if isinstance(section, dict) else None
    if raw is None:
        return ()
    if not isinstance(raw, list):
        logger.warning("nomad: %s.%s=%r is not a list — no paid provider is allowed",
                       CONFIG_SECTION, ALLOWLIST_KEY, raw)
        return ()
    names: list[str] = []
    for item in raw:
        if isinstance(item, str) and item.strip():
            name = normalize_provider(item)
            if name not in names:
                names.append(name)
    return tuple(names)


def _load_config() -> Optional[dict]:
    try:
        return profile_config.load()
    except profile_config.ConfigUnreadable as exc:
        # Сломанный конфиг не открывает ни пула, ни платного: читаем его как пустой.
        logger.warning("nomad: %s — capability catalog uses defaults (no pool, no paid)", exc)
        return None


def read_paid_allowlist() -> tuple[str, ...]:
    return paid_allowlist_from(_load_config())


def allowed_by_whitelist(billing: str, provider: str, allowlist: Iterable[str]) -> bool:
    """Subscription and free lanes need no permission; a metered one only by name in the list."""
    if billing != METERED:
        return True
    return normalize_provider(provider) in set(allowlist)


# --- native binaries --------------------------------------------------------------------------------

def _is_shim(path: Path) -> bool:
    return path.suffix.lower() in _SHIM_SUFFIXES


def native_behind_npm_shim(shim: Path, cli: str) -> Optional[Path]:
    """The native ``<cli>.exe`` that an npm ``.cmd`` shim would launch, if it is on disk."""
    for pattern in _NPM_NATIVE_GLOBS.get(cli, ()):
        for candidate in sorted(shim.parent.glob(pattern)):
            if candidate.is_file():
                return candidate
    return None


def resolve_windows_cli(cli: str) -> Optional[Path]:
    """The native binary the owner's own ``<cli>`` command runs, else the first ``<cli>.exe``.

    1. ``<cli>`` по PATH (как его найдёт ``cmd.exe`` по PATHEXT): нативный ``.exe`` — он и есть;
       npm-шим — нативный бинарь за ним. Так проба идёт той же версией, что и команда владельца.
    2. Первый ``<cli>.exe`` в PATH.
    3. Известные места установки.
    Шим и файл без расширения (sh-скрипт npm) не возвращаются никогда.
    """
    command = shutil.which(cli)
    if command:
        path = Path(command)
        if path.suffix.lower() == ".exe":
            return path
        if _is_shim(path):
            native = native_behind_npm_shim(path, cli)
            if native is not None:
                return native
    found = shutil.which(f"{cli}.exe")
    if found:
        return Path(found)
    for place in _known_native_locations(cli):
        if place.is_file():
            return place
    return None


def resolve_cli(cli: str) -> Optional[Path]:
    """Path to the native ``claude``/``codex`` binary, never a ``.cmd``/``.bat`` shim; None if absent."""
    override = os.environ.get(ENV_CLAUDE_EXE if cli == "claude" else ENV_CODEX_EXE)
    if override:
        path = Path(override)
        return path if path.is_file() and not _is_shim(path) else None
    if os.name != "nt":
        found = shutil.which(cli)
        return Path(found) if found else None
    return resolve_windows_cli(cli)


# --- the probe runner: free commands only ---------------------------------------------------------

def _guard(args: Sequence[str]) -> tuple[str, ...]:
    argv = tuple(str(a) for a in args)
    if argv not in FREE_PROBES:
        raise PaidCallRefused(
            f"refusing to run {list(argv)!r}: the capability catalog runs only free read-only "
            f"probes {sorted(FREE_PROBES)}")
    return argv


def _creationflags() -> int:
    # Проба из шлюза (без консоли) иначе мигает окном cmd на каждый запуск.
    return getattr(subprocess, "CREATE_NO_WINDOW", 0)


def run_free_probe(exe: Path, args: Sequence[str], *, env: dict, lane: str,
                   journal: Optional[list] = None) -> Optional[subprocess.CompletedProcess]:
    """Run ONE command from ``FREE_PROBES``; None when it could not run or timed out."""
    argv = _guard(args)
    if _is_shim(exe):
        raise PaidCallRefused(f"refusing to run the shim {exe.name!r}: native binaries only")
    record: dict[str, Any] = {"lane": lane, "command": [exe.name, *argv], "exe": str(exe),
                              "paid": False, "exit_code": None}
    started = time.monotonic()
    try:
        proc = subprocess.run([str(exe), *argv], capture_output=True, text=True, encoding="utf-8",
                              errors="replace", env=env, timeout=PROBE_TIMEOUT_S,
                              stdin=subprocess.DEVNULL, creationflags=_creationflags())
        record["exit_code"] = proc.returncode
        return proc
    except (OSError, subprocess.TimeoutExpired) as exc:
        record["error"] = type(exc).__name__
        logger.warning("nomad: probe %s for lane %s failed: %s", record["command"], lane, exc)
        return None
    finally:
        record["duration_ms"] = int((time.monotonic() - started) * 1000)
        if journal is not None:
            journal.append(record)


# --- Claude Code ------------------------------------------------------------------------------------

# authMethod → (billing, provider). Значения — из самого claude.exe 2.1.235 (``auth status``):
# claude.ai и oauth_token (``claude setup-token``) — подписка; api_key и api_key_helper — API
# Anthropic по счётчику; third_party — Bedrock/Vertex/Foundry, провайдер = apiProvider.
_CLAUDE_AUTH = {
    "claude.ai": (SUBSCRIPTION, "claude-code"),
    "oauth_token": (SUBSCRIPTION, "claude-code"),
    "api_key": (METERED, "anthropic"),
    "api_key_helper": (METERED, "anthropic"),
}


def parse_claude_auth_status(exit_code: Optional[int], stdout: Optional[str]) -> Liveness:
    """Liveness from ``claude.exe auth status --json`` (exit 0 ⇔ ``loggedIn``; JSON is the source)."""
    nominal = Liveness(False, SUBSCRIPTION, "claude-code")
    try:
        data = json.loads(stdout or "")
    except ValueError:
        return replace(nominal, reason=REASON_PROBE_UNREADABLE)
    if not isinstance(data, dict) or not isinstance(data.get("loggedIn"), bool):
        return replace(nominal, reason=REASON_PROBE_UNREADABLE)
    if not data["loggedIn"]:
        return replace(nominal, reason=REASON_NOT_LOGGED_IN)
    method = data.get("authMethod")
    if method == "third_party":
        billing, provider = METERED, str(data.get("apiProvider") or "third_party")
    else:
        # Незнакомый способ входа — по счётчику: так его отсечёт белый список, а не пропустит.
        billing, provider = _CLAUDE_AUTH.get(method, (METERED, "anthropic"))
    identity: dict[str, Any] = {"auth_method": method}
    if method == "claude.ai":
        identity.update(email=data.get("email"), org_id=data.get("orgId"),
                        org_name=data.get("orgName"), plan=data.get("subscriptionType"))
    if data.get("apiKeySource"):
        identity["api_key_source"] = str(data["apiKeySource"])  # имя источника, не сам ключ
    return Liveness(True, billing, provider, identity)


# --- Codex: text form -------------------------------------------------------------------------------

def parse_codex_login_status(exit_code: Optional[int], stdout: Optional[str],
                             stderr: Optional[str]) -> Liveness:
    """Liveness from ``codex login status``: exit code plus the text, whichever stream it is on.

    codex-cli 0.153.4 пишет строку в stderr (stdout пуст): «Logged in using ChatGPT» (0),
    «Logged in using an API key - sk-…***…» (0), «Not logged in» (1), а при битом ``CODEX_HOME`` —
    «Error loading configuration: …» (1). Маскированный ключ из текста дальше не передаётся.
    """
    nominal = Liveness(False, SUBSCRIPTION, "codex")
    text = f"{stdout or ''}\n{stderr or ''}".lower()
    if "not logged in" in text:
        return replace(nominal, reason=REASON_NOT_LOGGED_IN)
    if exit_code != 0:
        return replace(nominal, reason=REASON_PROBE_FAILED)
    if "logged in using chatgpt" in text:
        return Liveness(True, SUBSCRIPTION, "codex", {"auth_method": "chatgpt"})
    if "api key" in text:
        return Liveness(True, METERED, "openai", {"auth_method": "api_key"})
    if "logged in" in text:
        # Новая формулировка: вход есть, но на чьи деньги — неизвестно. Считаем по счётчику.
        return Liveness(True, METERED, "codex", {"auth_method": "unknown"})
    return replace(nominal, reason=REASON_PROBE_UNREADABLE)


# --- Codex: structured form (app-server) --------------------------------------------------------------

def read_jsonrpc_responses(lines: Iterable[str]) -> dict[Any, dict]:
    """Responses (``result`` or ``error``) by id; notifications and non-JSON lines are skipped."""
    responses: dict[Any, dict] = {}
    for line in lines:
        try:
            message = json.loads(line)
        except (TypeError, ValueError):
            continue
        if isinstance(message, dict) and "id" in message and (
                "result" in message or "error" in message):
            responses[message["id"]] = message
    return responses


def parse_codex_account(result: Any) -> Optional[Liveness]:
    """Liveness from the ``account/read`` result; None when the result is not recognisable."""
    if not isinstance(result, dict) or "account" not in result:
        return None
    account = result["account"]
    if account is None:
        return Liveness(False, SUBSCRIPTION, "codex", None, REASON_NOT_LOGGED_IN)
    if not isinstance(account, dict):
        return None
    kind = account.get("type")
    if kind == "chatgpt":
        return Liveness(True, SUBSCRIPTION, "codex", {
            "auth_method": "chatgpt", "email": account.get("email"),
            "plan": account.get("planType")})
    if kind == "apiKey":
        return Liveness(True, METERED, "openai", {"auth_method": "api_key"})
    if kind == "amazonBedrock":
        return Liveness(True, METERED, "bedrock", {"auth_method": "amazon_bedrock"})
    return Liveness(True, METERED, "codex", {"auth_method": str(kind)})


def _percent(value: Any) -> Optional[float]:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return min(max(value, 0), 100)


def parse_codex_rate_limits(result: Any) -> Optional[dict]:
    """Window observation from ``account/rateLimits/read``; None = unknown.

    Схема app-server: снимок ``rateLimitsByLimitId.codex`` (или исторический ``rateLimits``), в нём
    окна ``primary``/``secondary`` с ``usedPercent``, ``windowDurationMins``, ``resetsAt`` (epoch,
    секунды). «Null or missing values mean unavailable» — отсутствие окон даёт None, а не 0 %.
    Остаток считается по самому тесному окну; ``rateLimitReachedType`` — упор, остаток 0.
    """
    if not isinstance(result, dict):
        return None
    by_id = result.get("rateLimitsByLimitId")
    snapshot = by_id.get("codex") if isinstance(by_id, dict) else None
    if not isinstance(snapshot, dict):
        snapshot = result.get("rateLimits")
    if not isinstance(snapshot, dict):
        return None
    windows = []
    for name in ("primary", "secondary"):
        window = snapshot.get(name)
        if isinstance(window, dict) and _percent(window.get("usedPercent")) is not None:
            windows.append((name, window))
    if not windows:
        return None
    name, tight = max(windows, key=lambda item: _percent(item[1]["usedPercent"]))
    used = _percent(tight["usedPercent"])
    reached = snapshot.get("rateLimitReachedType")
    resets = tight.get("resetsAt")
    resets_at = (datetime.fromtimestamp(resets, timezone.utc).isoformat()
                 if isinstance(resets, int) and not isinstance(resets, bool) else None)
    minutes = tight.get("windowDurationMins")
    return {
        "window_left": 0 if reached else 100 - used,
        "used_percent": used,
        "window_name": name,
        "window_minutes": minutes if isinstance(minutes, int) else None,
        "resets_at": resets_at,
        "limit_reached": reached,
        "plan": snapshot.get("planType"),
    }


@dataclass(frozen=True)
class AppServerReadout:
    account: Optional[Liveness] = None
    window: Optional[dict] = None
    error: Optional[str] = None


def _error_text(response: Optional[dict]) -> Optional[str]:
    if response is None:
        return "no_response"
    error = response.get("error")
    if isinstance(error, dict):
        return str(error.get("message") or error.get("code"))
    return None if "result" in response else "malformed_response"


def read_codex_app_server(exe: Path, *, env: dict, lane: str,
                          journal: Optional[list] = None) -> AppServerReadout:
    """One short ``codex app-server`` session: initialize → account/read → account/rateLimits/read.

    Никакой ошибки наружу: не запустился, не ответил за ``APP_SERVER_TIMEOUT_S``, метода нет —
    результат без окна (``unknown``). Зависший сервер убивается.
    """
    _guard(("app-server",))
    if _is_shim(exe):
        raise PaidCallRefused(f"refusing to run the shim {exe.name!r}: native binaries only")
    record: dict[str, Any] = {"lane": lane, "command": [exe.name, "app-server"], "exe": str(exe),
                              "paid": False, "exit_code": None, "methods": []}
    started = time.monotonic()
    try:
        proc = subprocess.Popen([str(exe), "app-server"], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                                encoding="utf-8", errors="replace", env=env,
                                creationflags=_creationflags())
    except OSError as exc:
        record.update(error=type(exc).__name__,
                      duration_ms=int((time.monotonic() - started) * 1000))
        if journal is not None:
            journal.append(record)
        logger.warning("nomad: codex app-server for lane %s did not start: %s", lane, exc)
        return AppServerReadout(error=f"not_started: {type(exc).__name__}")

    lines: "queue.Queue[Optional[str]]" = queue.Queue()

    def pump() -> None:
        try:
            for line in proc.stdout:
                lines.put(line)
        except (OSError, ValueError):
            pass
        finally:
            lines.put(None)

    threading.Thread(target=pump, name="nomad-codex-app-server", daemon=True).start()
    deadline = time.monotonic() + APP_SERVER_TIMEOUT_S
    responses: dict[Any, dict] = {}
    state = {"eof": False, "timed_out": False}

    def send(message: dict) -> None:
        method = message["method"]
        if method not in FREE_APP_SERVER_METHODS:
            raise PaidCallRefused(f"refusing to call app-server method {method!r}")
        record["methods"].append(method)
        proc.stdin.write(json.dumps(message) + "\n")
        proc.stdin.flush()

    def wait_for(ids: set) -> bool:
        while not ids <= responses.keys() and not state["eof"]:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                state["timed_out"] = True
                return False
            try:
                line = lines.get(timeout=remaining)
            except queue.Empty:
                state["timed_out"] = True
                return False
            if line is None:
                state["eof"] = True
                break
            responses.update(read_jsonrpc_responses([line]))
        return ids <= responses.keys()

    io_error = None
    try:
        send({"id": 1, "method": "initialize", "params": {"clientInfo": APP_SERVER_CLIENT}})
        if wait_for({1}) and "result" in responses[1]:
            send({"method": "initialized"})
            send({"id": 2, "method": "account/read", "params": {"refreshToken": False}})
            send({"id": 3, "method": "account/rateLimits/read"})
            wait_for({2, 3})
    except (OSError, ValueError) as exc:
        io_error = type(exc).__name__
    finally:
        _stop(proc, kill=state["timed_out"])
        record["exit_code"] = proc.returncode
        record["duration_ms"] = int((time.monotonic() - started) * 1000)
        if state["timed_out"]:
            record["error"] = "timeout"
        elif io_error:
            record["error"] = io_error
        if journal is not None:
            journal.append(record)

    account_response, limits_response = responses.get(2), responses.get(3)
    account = (parse_codex_account(account_response.get("result"))
               if account_response and "result" in account_response else None)
    window = (parse_codex_rate_limits(limits_response.get("result"))
              if limits_response and "result" in limits_response else None)
    error = None
    if window is None:
        error = ("timeout" if state["timed_out"] else io_error) or _error_text(limits_response) \
            or "rate_limits_unavailable"
    return AppServerReadout(account=account, window=window, error=error)


def _stop(proc: Any, *, kill: bool) -> None:
    """End the app-server: EOF on stdin is its normal exit; a hung one is killed."""
    try:
        proc.stdin.close()
    except (OSError, ValueError):
        pass
    if kill and proc.poll() is None:
        proc.kill()
    try:
        proc.wait(timeout=APP_SERVER_EXIT_GRACE_S)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            proc.wait(timeout=APP_SERVER_EXIT_GRACE_S)
        except subprocess.TimeoutExpired:
            logger.warning("nomad: codex app-server pid %s ignored kill", getattr(proc, "pid", "?"))


# --- slots and probes -------------------------------------------------------------------------------

def discover_slots(data: Optional[dict], mode: pool_mode.PoolMode) -> list[Slot]:
    """Default slot of each CLI, plus pool slots ``<pool_root>/cc|codex/<name>`` in owner_machine."""
    slots = [Slot(_CLI_LANES[cli]["prefix"], cli) for cli in ("claude", "codex")]
    if not mode.allows_pooling:
        return slots
    section = (data or {}).get(CONFIG_SECTION)
    root = section.get(POOL_ROOT_KEY) if isinstance(section, dict) else None
    if not isinstance(root, str) or not root.strip():
        return slots
    base = Path(root).expanduser()
    for cli in ("claude", "codex"):
        spec = _CLI_LANES[cli]
        try:
            children = sorted(p for p in (base / spec["pool_dir"]).iterdir() if p.is_dir())
        except OSError:
            continue
        slots.extend(Slot(f"{spec['prefix']}:{child.name}", cli, child) for child in children)
    return slots


def _probe_env(slot: Slot) -> dict:
    env = dict(os.environ)
    if slot.home is not None:
        env[_CLI_LANES[slot.cli]["home_env"]] = str(slot.home)
    return env


def _probe_claude(slot: Slot, exe: Path, journal: list) -> tuple[Liveness, Optional[dict]]:
    proc = run_free_probe(exe, ("auth", "status", "--json"), env=_probe_env(slot),
                          lane=slot.lane, journal=journal)
    if proc is None:
        return Liveness(False, SUBSCRIPTION, "claude-code", reason=REASON_PROBE_FAILED), None
    return parse_claude_auth_status(proc.returncode, proc.stdout), None


def _probe_codex(slot: Slot, exe: Path, journal: list) -> tuple[Liveness, Optional[dict]]:
    env = _probe_env(slot)
    proc = run_free_probe(exe, ("login", "status"), env=env, lane=slot.lane, journal=journal)
    text = (parse_codex_login_status(proc.returncode, proc.stdout, proc.stderr) if proc is not None
            else Liveness(False, SUBSCRIPTION, "codex", reason=REASON_PROBE_FAILED))
    if text.reason == REASON_NOT_LOGGED_IN:
        return text, None  # читать окно не у кого; app-server ответил бы ошибкой авторизации
    readout = read_codex_app_server(exe, env=env, lane=slot.lane, journal=journal)
    # Структурный ответ точнее текста (в нём личность и тип входа); текст — запасной детектор.
    state = readout.account or text
    return state, (readout.window if state.alive else None)


def _probe_slot(slot: Slot, exe: Optional[Path], journal: list) -> tuple[Liveness, Optional[dict]]:
    spec = _CLI_LANES[slot.cli]
    if exe is None:
        return Liveness(False, SUBSCRIPTION, spec["provider"],
                        reason=REASON_NATIVE_CLI_NOT_FOUND), None
    try:
        if slot.cli == "claude":
            return _probe_claude(slot, exe, journal)
        return _probe_codex(slot, exe, journal)
    except Exception:  # один сломанный слот не валит весь каталог
        logger.exception("nomad: probing lane %s failed", slot.lane)
        return Liveness(False, SUBSCRIPTION, spec["provider"], reason=REASON_PROBE_FAILED), None


def _parse_time(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def observation_left(observation: dict, now: datetime) -> Optional[float]:
    """Window left in % from a journaled observation, or None when it is stale or unusable."""
    left = _percent(observation.get("window_left"))
    if left is None:
        used = _percent(observation.get("used_percent"))
        left = None if used is None else 100 - used
    if left is None:
        return None
    resets_at = _parse_time(observation.get("resets_at"))
    if resets_at is not None:
        return left if now < resets_at else None
    observed_at = _parse_time(observation.get("observed_at")) or _parse_time(observation.get("ts"))
    if observed_at is None or now - observed_at >= OBSERVATION_MAX_AGE:
        return None
    return left


def account_key(state: Liveness) -> Optional[str]:
    """Whose window an observation is: provider + login method + email/org of the account.

    None, когда личность не распознаётся (``oauth_token`` от ``claude setup-token``, ключ API,
    вход, опознанный только по тексту без email): такому входу окно не приписывается, и сам он
    ничьё не получает. План подписки в ключ не входит — это тот же аккаунт.
    """
    identity = state.identity if isinstance(state.identity, dict) else {}
    email, org = identity.get("email"), identity.get("org_id")
    email = email.strip().lower() if isinstance(email, str) and email.strip() else None
    org = org.strip() if isinstance(org, str) and org.strip() else None
    if email is None and org is None:
        return None
    return json.dumps({"provider": state.provider, "auth_method": identity.get("auth_method"),
                       "email": email, "org_id": org}, sort_keys=True, ensure_ascii=False)


_NOT_WINDOW_FIELDS = ("lane", "event_id", "ts", "account", "billing")


def _window(conn, slot: Slot, state: Liveness, fresh: Optional[dict],
            now: datetime) -> tuple[Any, Optional[dict]]:
    if not state.alive:
        return UNKNOWN, None
    account = account_key(state)
    if fresh is not None:
        observation = {**fresh, "source": "codex_app_server",
                       "observed_at": now.isoformat(timespec="milliseconds")}
        db.record_lane_observation(conn, slot.lane, observation, account=account,
                                   billing=state.billing)
        return fresh["window_left"], observation
    if _CLI_LANES[slot.cli]["live_window"]:
        # Живое чтение не удалось — это «неизвестно сейчас», а не повод выдать старое число.
        return UNKNOWN, None
    last = db.latest_lane_observation(conn, slot.lane, account=account, billing=state.billing)
    if last is not None:
        left = observation_left(last, now)
        if left is not None:
            return left, {k: v for k, v in last.items() if k not in _NOT_WINDOW_FIELDS}
    return UNKNOWN, None


def _api_key_present(lane: ApiLane) -> bool:
    for group in lane.env_keys:
        if not any(_env_value(name) for name in group):
            return False
    return True


def _env_value(name: str) -> Optional[str]:
    try:
        value = core_adapter.get_env_value(name)
    except (OSError, ValueError):  # .env профиля не читается → ключа для каталога нет
        logger.warning("nomad: could not read %s from the profile environment", name,
                       exc_info=True)
        return None
    return value.strip() if isinstance(value, str) and value.strip() else None


def _row(*, lane: str, vendor: str, work_class: str, state: Liveness, window_left: Any,
         window: Optional[dict], allowlist: Sequence[str], slot: Optional[Path] = None) -> dict:
    return {
        "lane": lane,
        "vendor": vendor,
        "provider": state.provider,
        "billing": state.billing,
        "alive": state.alive,
        "reason": state.reason,
        "identity": state.identity,
        "window_left": window_left,
        "window": window,
        "allowed_by_whitelist": allowed_by_whitelist(state.billing, state.provider, allowlist),
        "work_class": work_class,
        "slot": str(slot) if slot is not None else None,
    }


def build_catalog(*, conn=None, now: Optional[datetime] = None) -> list[dict]:
    """Probe every lane (free commands only) and return the catalog rows; journals every probe."""
    now = now or datetime.now(timezone.utc)
    data = _load_config()
    allowlist = paid_allowlist_from(data)
    slots = discover_slots(data, pool_mode.resolve_pool_mode())
    exes = {cli: resolve_cli(cli) for cli in ("claude", "codex")}

    journal: list[dict] = []
    with ThreadPoolExecutor(max_workers=max(1, min(MAX_PROBE_WORKERS, len(slots))),
                            thread_name_prefix="nomad-probe") as executor:
        futures = [executor.submit(_probe_slot, slot, exes[slot.cli], journal) for slot in slots]
        results = [future.result() for future in futures]

    if conn is None:
        with closing(db.connect()) as own:
            return _assemble(own, slots, results, journal, allowlist, now)
    return _assemble(conn, slots, results, journal, allowlist, now)


def _assemble(conn, slots: list[Slot], results: list, journal: list, allowlist: Sequence[str],
              now: datetime) -> list[dict]:
    for record in journal:
        db.add_event(conn, db.EVENT_LANE_PROBE, record)
    rows = []
    for slot, (state, fresh) in zip(slots, results):
        spec = _CLI_LANES[slot.cli]
        window_left, window = _window(conn, slot, state, fresh, now)
        rows.append(_row(lane=slot.lane, vendor=spec["vendor"], work_class=spec["work_class"],
                         state=state, window_left=window_left, window=window,
                         allowlist=allowlist, slot=slot.home))
    for api in API_LANES:
        present = _api_key_present(api)
        state = Liveness(present, METERED, api.provider,
                         reason=None if present else REASON_NO_API_KEY)
        rows.append(_row(lane=api.lane, vendor=api.vendor, work_class=api.work_class, state=state,
                         window_left=UNKNOWN, window=None, allowlist=allowlist))
    rows.append(_row(lane=TOOL_LANE, vendor="local", work_class="deterministic_step",
                     state=Liveness(True, FREE, TOOL_LANE), window_left=UNKNOWN, window=None,
                     allowlist=allowlist))
    return rows
