"""Activation — a purchased NomadNet key connects Nomad to our Control Plane router.

Путь платного доступа: покупатель платит нам, получает ОДИН ключ ``nmd_…``, и агент ходит в
модели через наш роутер CP (OpenAI-совместимый ``{cp}/v1``), который сам раскидывает запросы по
нескольким API, в основном DeepSeek. Вместо Nous Research — мы.

Единственная дверь — ``connect(key)``. Её зовут:

* CLI ``hermes nomad connect [KEY]`` (``handle_cli`` ниже, регистрация — в ``__init__.py``);
* будущий экран оплаты внутри приложения: получил ключ после оплаты → ``connect(key)`` → словарь
  с ``ok`` и стабильным ``code``. Поэтому результат — простой JSON-совместимый ``dict``, а не
  исключение, и в нём никогда нет самого ключа.

Порядок шагов (перенесён с ветки форка ``stage1/connect-endpoint`` 5c9872fc51 и сверен с живым
кодом CP ``JHamidun/nomad-control-plane`` b9b914b):

1. ключ проверяется локально по форме — чужой секрет (``sk-…`` от OpenAI) на наш сервер не уходит;
2. адрес CP берётся из ``NOMADNET_CP_URL`` → ``plugins.entries.nomad.settings.cp_url``; вшитого
   боевого адреса НЕТ — не задан, значит отказ ``cp-url-unset`` до любой сети;
3. бесплатная проба ключа: ``POST {cp}/v1/chat/completions`` с пустой моделью. CP сначала
   проверяет ключ (401/403), потом отвечает 404 «Unknown model ''» — ДО резерва кредитов и до
   вызова провайдера (gateway_api.py:2874-2879). Только этот 404 доказывает, что ключ живой;
4. каталог ``GET {cp}/v1/models`` → модель по умолчанию из списка предпочтений (deepseek-chat
   первой), а не ``catalogue[0]``;
5. запись одной транзакцией: ключ — в ``.env`` профиля штатным ``save_env_value``, в
   ``config.yaml`` только ссылка ``${NOMADNET_API_KEY}``; провайдер ``custom`` на ``{cp}/v1`` и
   запись ``custom_providers`` с именем «NomadNet». Любой сбой откатывает ОБА файла байт в байт.

Отказ до шага 5 не пишет ничего; отказ на шаге 5 возвращает файлы как были. Полузаписанного
состояния («ключ в .env есть, а модель смотрит в другое место» или наоборот) не бывает.
"""

from __future__ import annotations

import argparse
import ipaddress
import json
import logging
import os
import re
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlsplit

from . import core_adapter as core

logger = logging.getLogger("hermes_plugins.nomad.activation")

# ---------------------------------------------------------------------------
# Константы контракта
# ---------------------------------------------------------------------------

KEY_ENV = "NOMADNET_API_KEY"
# В config.yaml пишется ссылка, а не ключ: load_config разворачивает её из окружения, так что
# сам ключ живёт только в .env (тот же приём, что у штатной настройки своего эндпоинта).
KEY_REF = "${" + KEY_ENV + "}"
PROVIDER_NAME = "NomadNet"
CP_URL_ENV = "NOMADNET_CP_URL"
# plugins.entries.<id>.settings.cp_url — то место, которое ядро отдаёт плагину через
# ctx.get_config("cp_url"); порядок «переменная → настройка» задан бэклогом (W2-04a).
CP_URL_SETTING = ("plugins", "entries", "nomad", "settings", "cp_url")

# Первая из этих моделей, что есть в каталоге CP, становится моделью по умолчанию. Все четыре —
# прямые маршруты CP (app/gateway/registry.py:28,32,50,60); deepseek-chat там — публичный алиас
# deepseek-v4-flash без thinking, по той же цене.
MODEL_PREFERENCE: Tuple[str, ...] = (
    "deepseek-chat",
    "gpt-4o-mini",
    "claude-haiku-4-5",
    "kimi-k2.6",
)

# Форма ключа CP: nmd_<prefix>_<secret> (apikeys.py:121-134; resolve_key режет по «_» на три
# части и требует «nmd», :179-181). Алфавит — hex-префикс и base64url-секрет, то есть ровно то, что
# переживает заголовок Authorization и .env без кавычек. Проверка здесь не заменяет сервер, она
# не даёт отправить на наш сервер чужой секрет, вставленный по ошибке.
_KEY_RE = re.compile(r"nmd_[0-9A-Za-z]+_[A-Za-z0-9_-]+")

PROBE_TIMEOUT_S = 10.0

# Коды отказа — стабильные строки: по ним UI выбирает текст и действие, в логах их ищут поиском.
# Десять перенесены с ветки форка как есть; cp-url-unset добавлен, потому что вшитого адреса
# больше нет и «не задан» — отдельная, нормальная ситуация сборки, а не «кривой адрес».
CODE_MISSING_KEY = "missing-key"
CODE_INVALID_KEY = "invalid-key"
CODE_KEY_NOT_PROVISIONED = "key-not-provisioned"
CODE_RATE_LIMITED = "rate-limited"
CODE_CP_UNAVAILABLE = "cp-unavailable"
CODE_UNREACHABLE = "unreachable"
CODE_BAD_REQUEST = "bad-request"
CODE_NO_MODELS = "no-models"
CODE_SAVE_FAILED = "save-failed"
CODE_UNKNOWN = "unknown"
CODE_CP_URL_UNSET = "cp-url-unset"
CODES = (
    CODE_MISSING_KEY, CODE_INVALID_KEY, CODE_KEY_NOT_PROVISIONED, CODE_RATE_LIMITED,
    CODE_CP_UNAVAILABLE, CODE_UNREACHABLE, CODE_BAD_REQUEST, CODE_NO_MODELS, CODE_SAVE_FAILED,
    CODE_UNKNOWN, CODE_CP_URL_UNSET,
)

# Два подключения разом (двойной клик на экране оплаты) не должны перемешать записи двух файлов.
_APPLY_LOCK = threading.Lock()


def _error(code: str, message: str, *, reachable: bool = True) -> Dict[str, Any]:
    return {"ok": False, "code": code, "message": message, "reachable": reachable}


# ---------------------------------------------------------------------------
# Адрес Control Plane
# ---------------------------------------------------------------------------

def _is_loopback(host: str) -> bool:
    # 0.0.0.0 сюда намеренно не входит (в отличие от runtime_provider._loopback_hostname ядра):
    # это «все интерфейсы», а не петля, и ключ по голому http туда не отправляется.
    host = host.strip().lower().rstrip(".").strip("[]")
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def normalize_cp_url(raw: str) -> Optional[str]:
    """Origin ``scheme://host[:port]`` or ``None`` when the value is not an acceptable CP address.

    Только origin: путь, запрос, фрагмент и userinfo запрещены — ``/v1`` дописывается здесь, и
    адрес с путём означает, что кто-то перепутал поле. Только https; голый http — лишь на петле,
    чтобы локальный стаб и разработка работали, а ключ не ушёл открытым текстом в сеть.
    """
    text = (raw or "").strip().rstrip("/")
    try:
        parts = urlsplit(text)
        host = parts.hostname or ""
        parts.port  # noqa: B018 — кривой порт поднимает ValueError только при обращении
    except ValueError:
        return None
    if not host or parts.path or parts.query or parts.fragment:
        return None
    if parts.username is not None or parts.password is not None:
        return None
    if parts.scheme == "https" or (parts.scheme == "http" and _is_loopback(host)):
        return f"{parts.scheme}://{parts.netloc}"
    return None


def _setting_cp_url() -> str:
    node: Any = core.load_config()
    for segment in CP_URL_SETTING:
        if not isinstance(node, dict):
            return ""
        node = node.get(segment)
    return node.strip() if isinstance(node, str) else ""


def resolve_cp_url() -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """``(origin, None)`` or ``(None, error)``: env ``NOMADNET_CP_URL`` → plugin setting ``cp_url``.

    ``get_env_value`` ядра читает окружение процесса с учётом области профиля, а при промахе —
    ``.env`` профиля. Пустая строка — то же, что не задано: установка профиля кладёт в .env
    ``NOMADNET_CP_URL=`` без значения.
    """
    raw = (core.get_env_value(CP_URL_ENV) or "").strip() or _setting_cp_url()
    if not raw:
        return None, _error(
            CODE_CP_URL_UNSET,
            f"Адрес NomadNet не настроен: задайте {CP_URL_ENV} или "
            f"{'.'.join(CP_URL_SETTING)}. Ключ никуда не отправлялся.")
    url = normalize_cp_url(raw)
    if url is None:
        return None, _error(
            CODE_BAD_REQUEST,
            "Адрес NomadNet в настройках недопустим: нужен https://хост без пути "
            "(http — только для localhost). Ключ никуда не отправлялся.")
    return url, None


# ---------------------------------------------------------------------------
# Проба ключа и каталог моделей
# ---------------------------------------------------------------------------

def _http_client(cp_url: str):
    import httpx

    # На петле системный прокси не нужен и вреден: он увёл бы запрос к стабу наружу.
    loopback = _is_loopback(urlsplit(cp_url).hostname or "")
    return httpx.Client(timeout=httpx.Timeout(PROBE_TIMEOUT_S), trust_env=not loopback)


def _catalogue(client, base_url: str, headers: Dict[str, str]) -> Optional[List[str]]:
    """Model ids from ``{base_url}/models``; ``None`` when the list cannot be read.

    На живом CP этот маршрут без авторизации и отдаёт статический реестр
    (gateway_api.py:2863-2865). Ключ всё равно передаётся: тот же доверенный origin, и если
    сервер начнёт фильтровать каталог по тарифу, клиент менять не придётся.
    """
    try:
        resp = client.get(f"{base_url}/models", headers=headers)
        payload = resp.json() if resp.is_success else None
    except Exception:  # noqa: BLE001 — нечитаемый каталог не должен ронять подключение
        return None
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, list):
        return None
    return [str(item["id"]) for item in data if isinstance(item, dict) and item.get("id")]


def probe_key(cp_url: str, key: str) -> Dict[str, Any]:
    """Check *key* against the CP without spending anything; on success also read the catalogue.

    Ответ ``{"ok": True, "models": [...] | None}`` или форма отказа. Редиректы не выполняются
    (по умолчанию httpx): заголовок с ключом не уходит на чужой хост.
    """
    base_url = f"{cp_url}/v1"
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    try:
        with _http_client(cp_url) as client:
            resp = client.post(f"{base_url}/chat/completions",
                               json={"model": "", "messages": []}, headers=headers)
            status = resp.status_code
            logger.debug("NomadNet key probe answered HTTP %s", status)
            if status == 404:
                try:
                    body = resp.json()
                except Exception:  # noqa: BLE001 — не-JSON 404 это чужой прокси, не CP
                    body = None
                detail = body.get("detail") if isinstance(body, dict) else None
                if isinstance(detail, str) and detail.startswith("Unknown model"):
                    return {"ok": True, "models": _catalogue(client, base_url, headers)}
    except Exception:  # noqa: BLE001 — любая транспортная ошибка: DNS, TLS, отказ соединения
        return _error(CODE_UNREACHABLE, "Не удалось связаться с NomadNet; ключ не проверен.",
                      reachable=False)

    if status == 401:
        return _error(CODE_INVALID_KEY, "NomadNet не принял ключ: он неверный или отозван.")
    if status == 403:
        return _error(CODE_KEY_NOT_PROVISIONED, "У этого ключа NomadNet нет доступа к моделям.")
    if status == 429:
        return _error(CODE_RATE_LIMITED, "Слишком много попыток. Подождите минуту и повторите.")
    if 500 <= status <= 599:
        return _error(CODE_CP_UNAVAILABLE, "NomadNet временно недоступен; ключ не проверен.")
    return _error(CODE_UNKNOWN, f"NomadNet ответил HTTP {status}; ключ не подключён.")


def pick_default_model(catalogue: Optional[List[str]]) -> Optional[str]:
    """First preferred model the CP offers; the launch default when the catalogue was unreadable.

    Ключ уже принят, поэтому сбой каталога не должен останавливать покупателя. Читаемый каталог
    без единой модели из списка — это ``None`` (отказ ``no-models``), а не ``catalogue[0]``.
    """
    if catalogue is None:
        return MODEL_PREFERENCE[0]
    offered = set(catalogue)
    return next((m for m in MODEL_PREFERENCE if m in offered), None)


# ---------------------------------------------------------------------------
# Запись: .env + config.yaml одной транзакцией
# ---------------------------------------------------------------------------

class _NotSaved(RuntimeError):
    """A write returned without landing (managed install, administrator-pinned key, …)."""


def _read_bytes(path: Path) -> Optional[bytes]:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None


def _restore_bytes(path: Path, data: Optional[bytes]) -> None:
    if data is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        return
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".nomad-restore-", suffix=".tmp")
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _is_nomadnet_entry(entry: Any, base_url: str) -> bool:
    if not isinstance(entry, dict):
        return False
    same_url = str(entry.get("base_url") or "").rstrip("/") == base_url
    return same_url or str(entry.get("name") or "").strip() == PROVIDER_NAME


def _point_model_at_cp(cfg: Dict[str, Any], base_url: str, model_id: str) -> None:
    """Mutate *cfg* the way upstream's custom-endpoint setup does, plus the NomadNet name.

    Как в model_setup_flows_custom.py:180-213: ``provider: custom``, ``base_url``, ключ ссылкой
    в ``api_key``, старые указатели ``key_env``/``api_key_env`` и ``api_mode`` убраны (CP говорит
    chat completions — пусть ядро определит само). Остальные ключи ``model`` — например
    ``default_headers`` из шаблона профиля — не трогаются.
    """
    model = cfg.get("model")
    if not isinstance(model, dict):
        model = {"default": model} if model else {}
    model["default"] = model_id
    model["provider"] = "custom"
    model["base_url"] = base_url
    for stale in ("key_env", "api_key_env", "api", "api_mode"):
        model.pop(stale, None)
    model["api_key"] = KEY_REF
    cfg["model"] = model

    # Одна запись NomadNet: прежние записи с тем же адресом или тем же именем (адрес CP мог
    # смениться с препрода на прод) заменяются, чужие провайдеры остаются как были. Ключ — через
    # key_env, как пишет штатный _save_custom_provider (main_provider_setup.py:472), не строкой.
    providers = cfg.get("custom_providers")
    providers = [p for p in providers if not _is_nomadnet_entry(p, base_url)] \
        if isinstance(providers, list) else []
    providers.append({"name": PROVIDER_NAME, "base_url": base_url, "key_env": KEY_ENV,
                      "model": model_id})
    cfg["custom_providers"] = providers


def _verify_on_disk(config_path: Path, base_url: str, model_id: str) -> None:
    import yaml

    raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) if config_path.exists() else None
    model = raw.get("model") if isinstance(raw, dict) else None
    if not (isinstance(model, dict) and model.get("provider") == "custom"
            and str(model.get("base_url") or "").rstrip("/") == base_url
            and model.get("api_key") == KEY_REF and model.get("default") == model_id):
        raise _NotSaved("config.yaml does not point the model at the CP after save")
    entries = [p for p in raw.get("custom_providers") or [] if _is_nomadnet_entry(p, base_url)]
    if len(entries) != 1 or entries[0].get("key_env") != KEY_ENV:
        raise _NotSaved("config.yaml has no single NomadNet custom provider after save")


def _apply(key: str, base_url: str, model_id: str) -> None:
    """Write .env and config.yaml; on ANY failure restore both files byte for byte and re-raise."""
    env_path, config_path = core.get_env_path(), core.get_config_path()
    saved_env, saved_config = _read_bytes(env_path), _read_bytes(config_path)
    saved_process_key = os.environ.get(KEY_ENV)
    try:
        core.save_env_value(KEY_ENV, key)
        # save_env_value молча возвращается без записи на managed-установке и для ключа,
        # закреплённого администратором: модель нельзя направлять на ключ, которого нет.
        if core.load_env().get(KEY_ENV) != key:
            raise _NotSaved(f"{KEY_ENV} did not land in .env")
        cfg = core.load_config()
        _point_model_at_cp(cfg, base_url, model_id)
        core.save_config(cfg)
        _verify_on_disk(config_path, base_url, model_id)
    except BaseException:
        _restore_bytes(env_path, saved_env)
        _restore_bytes(config_path, saved_config)
        core.invalidate_env_cache()
        if saved_process_key is None:
            os.environ.pop(KEY_ENV, None)
        else:
            os.environ[KEY_ENV] = saved_process_key
        raise


def _deactivate_oauth_provider() -> None:
    # Как _commit_model_config ядра: снять активного OAuth-провайдера (например, вход в Nous
    # Portal), чтобы автовыбор не вернул запросы туда. Это не наша запись и не часть транзакции:
    # сбой здесь не отменяет подключение — модель уже явно смотрит в CP.
    try:
        core.deactivate_provider()
    except Exception:  # noqa: BLE001
        logger.warning("NomadNet connected, but the active OAuth provider could not be cleared",
                       exc_info=True)


# ---------------------------------------------------------------------------
# Публичные функции: подключить и статус
# ---------------------------------------------------------------------------

def _save_accepted_key(
    cp_url: str,
    key: str,
    models: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Select default model and transactionally write *key* to .env and config.yaml."""
    model_id = pick_default_model(models)
    if model_id is None:
        return _error(CODE_NO_MODELS,
                      "NomadNet принял ключ, но не предлагает ни одной модели для этой сборки.")

    base_url = f"{cp_url}/v1"
    with _APPLY_LOCK:
        try:
            _apply(key, base_url, model_id)
        except Exception:  # noqa: BLE001 — любая причина: файлы уже возвращены как были
            logger.exception("NomadNet key was accepted but the connection could not be saved")
            return _error(CODE_SAVE_FAILED,
                          "Ключ верный, но настройку сохранить не удалось; ничего не изменено.")
    _deactivate_oauth_provider()
    return {"ok": True, "code": None, "provider": PROVIDER_NAME, "model": model_id,
            "base_url": base_url,
            "message": f"NomadNet подключён: модель {model_id} через {base_url}."}


def connect(
    key: str = "",
    *,
    handoff_token: Optional[str] = None,
    cp_url: Optional[str] = None,
) -> Dict[str, Any]:
    """Connect a purchased NomadNet key (or ``nomad://connect`` handoff) as the main model provider.

    Returns ``{"ok": True, "code": None, "provider", "model", "base_url", "message"}`` or
    ``{"ok": False, "code", "message", "reachable"}`` with ``code`` from ``CODES``. The key is
    never part of the result, never logged. Nothing is written unless the CP accepted the key
    and a default model was chosen; a failed write leaves .env and config.yaml as they were.
    """
    if handoff_token is not None:
        from . import key_handoff

        return key_handoff.redeem_handoff_token(handoff_token, cp_url=cp_url)

    key = (key or "").strip()
    if key.lower().startswith("nomad://"):
        from . import key_handoff

        return key_handoff.connect_from_uri(key, cp_url=cp_url)

    if not key:
        return _error(CODE_MISSING_KEY, "Сначала вставьте ключ NomadNet.")
    if not _KEY_RE.fullmatch(key):
        return _error(CODE_INVALID_KEY, "Это не похоже на ключ NomadNet (он начинается с nmd_).")
    if cp_url is not None and str(cp_url).strip():
        resolved_cp = normalize_cp_url(str(cp_url))
        if resolved_cp is None:
            return _error(
                CODE_BAD_REQUEST,
                "Адрес NomadNet в настройках недопустим: нужен https://хост без пути "
                "(http — только для localhost). Ключ никуда не отправлялся.",
            )
    else:
        resolved_cp, refusal = resolve_cp_url()
        if refusal is not None or resolved_cp is None:
            return refusal

    probe = probe_key(resolved_cp, key)
    if not probe["ok"]:
        return probe
    return _save_accepted_key(resolved_cp, key, probe["models"])


def connect_handoff(
    handoff_token_or_uri: str,
    *,
    cp_url: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> Dict[str, Any]:
    """Redeem a one-time cabinet handoff token or ``nomad://connect`` link and save the key."""
    from . import key_handoff

    raw = (handoff_token_or_uri or "").strip() if isinstance(handoff_token_or_uri, str) else ""
    if key_handoff.is_connect_uri(raw):
        return key_handoff.connect_from_uri(raw, cp_url=cp_url)
    return key_handoff.redeem_handoff_token(raw, cp_url=cp_url, tenant_id=tenant_id)


def connection_status() -> Dict[str, Any]:
    """Whether the main model runs on NomadNet. Never contains the key.

    ``connected`` — модель ``custom`` смотрит ровно в ``{cp}/v1`` настроенного CP, и ключ есть в
    окружении или в .env профиля. Адрес CP не настроен — не подключено.
    """
    cfg = core.load_config()
    model = cfg.get("model") if isinstance(cfg.get("model"), dict) else {}
    base_url = str(model.get("base_url") or "").strip().rstrip("/")
    cp_url, _ = resolve_cp_url()
    key_present = bool((core.get_env_value(KEY_ENV) or "").strip())
    connected = bool(cp_url and key_present and model.get("provider") == "custom"
                     and base_url == f"{cp_url}/v1")
    return {"connected": connected, "provider": PROVIDER_NAME if connected else None,
            "model": str(model.get("default") or "") or None, "base_url": base_url or None,
            "cp_url": cp_url, "key_present": key_present}


# ---------------------------------------------------------------------------
# CLI: hermes nomad connect [KEY] [--json] [--status]
# ---------------------------------------------------------------------------

CLI_COMMAND = "connect"
EXIT_OK, EXIT_REFUSED, EXIT_USAGE = 0, 1, 2


def add_cli_parser(parser: argparse.ArgumentParser) -> None:
    """Add ``connect`` to the ``hermes nomad`` tree that ``cli.setup`` already built.

    argparse даёт парсеру одну группу подкоманд, и её создаёт cli.py (дерево ``swarm``, чужая
    задача). Поэтому группа ищется среди действий парсера, а не создаётся второй раз.
    """
    subs = next((a for a in parser._actions if isinstance(a, argparse._SubParsersAction)), None)
    if subs is None:
        subs = parser.add_subparsers(dest="nomad_command")
    sub = subs.add_parser(
        CLI_COMMAND, help="Connect a purchased NomadNet key as the model provider",
        description="Проверить купленный ключ NomadNet и подключить через него модели. "
                    "Без KEY ключ читается из stdin или спрашивается без эха.")
    sub.add_argument("key", nargs="?", default=None, metavar="KEY",
                     help="NomadNet key (nmd_…) or nomad://connect link; omit to paste it without echo")
    sub.add_argument("--handoff-token", dest="nomad_handoff_token", default=None, metavar="TOKEN",
                     help="One-time handoff token from the NomadNet cabinet")
    sub.add_argument("--status", action="store_true", dest="nomad_connect_status",
                     help="Only show whether NomadNet is connected")
    sub.add_argument("--json", action="store_true", dest="nomad_connect_json",
                     help="Print the result as JSON")


def is_cli_command(args) -> bool:
    return getattr(args, "nomad_command", None) == CLI_COMMAND


def _read_key_interactively() -> str:
    # Ключ в argv виден в списке процессов и в истории оболочки, поэтому без аргумента он
    # берётся из stdin (конвейер) или спрашивается без эха.
    if not sys.stdin or not sys.stdin.isatty():
        return (sys.stdin.readline() if sys.stdin else "").strip()
    import getpass

    try:
        return getpass.getpass("Ключ NomadNet: ").strip()
    except (EOFError, KeyboardInterrupt):
        return ""


def handle_cli(args) -> int:
    as_json = getattr(args, "nomad_connect_json", False)
    if getattr(args, "nomad_connect_status", False):
        status = connection_status()
        if as_json:
            print(json.dumps(status, ensure_ascii=False))
        elif status["connected"]:
            print(f"NomadNet подключён: модель {status['model']} через {status['base_url']}")
        else:
            print("NomadNet не подключён.")
        return EXIT_OK if status["connected"] else EXIT_REFUSED

    handoff_token = getattr(args, "nomad_handoff_token", None)
    if handoff_token is not None:
        result = connect_handoff(handoff_token)
    else:
        key = args.key if args.key is not None else _read_key_interactively()
        result = connect(key)
    if as_json:
        print(json.dumps(result, ensure_ascii=False))
    elif result["ok"]:
        print(result["message"])
        print(f"Ключ сохранён в .env профиля как {KEY_ENV}.")
    else:
        print(f"nomad: не подключено [{result['code']}]: {result['message']}", file=sys.stderr)
    if result["ok"]:
        return EXIT_OK
    return EXIT_USAGE if result["code"] == CODE_MISSING_KEY else EXIT_REFUSED

