"""Приём одноразового токена из личного кабинета и обмен на ключ агента (M-106).

Поток «оплатил в кабинете → ключ подтянулся в агент сам»:

1. Личный кабинет выпускает короткоживущий одноразовый ``handoff_token`` (TTL 60 с) через
   ``POST /cabinet/sso/agent-key`` и передаёт его агенту по ссылке ``nomad://connect?handoff_token=…``
   или запросом на локальный петлевой адрес агента (``http://127.0.0.1:<port>/callback``).
2. Агент сам обращается в Control Plane: ``POST <cp_url>/cabinet/sso/redeem`` с телом
   ``{"handoff_token": "<токен>"}`` (и необязательным ``tenant_id``).
3. При ответе 200 (``{"ok": true, "tenant_id": …, "key": "nmd_<префикс>_<секрет>", "scopes": […]}``)
   агент проверяет формат ключа, подбирает модель и атомарно записывает ``NOMADNET_API_KEY`` в
   ``.env`` профиля и провайдер ``NomadNet`` в ``config.yaml`` тем же транзакционным путём, что и
   ``activation.connect()`` (``activation._save_accepted_key``).
4. Повторный обмен того же токена или обмен по истечении срока возвращает 401
   ``invalid_handoff_token`` — существующие ``.env`` и ``config.yaml`` при этом не затрагиваются.
5. Ни одноразовый ``handoff_token``, ни выпущенный ключ ``nmd_…`` никогда не попадают в логи,
   сообщения об ошибках, возвращаемые словари или историю команд.
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
import re
import threading
from typing import Any, Dict, Mapping, Optional
from urllib.parse import parse_qs, urlencode, urlsplit

from . import activation

logger = logging.getLogger("hermes_plugins.nomad.key_handoff")

HANDOFF_SCHEME = "nomad"
REDEEM_PATH = "/cabinet/sso/redeem"
AGENT_KEY_PATH = "/cabinet/sso/agent-key"
HANDOFF_TTL_SECONDS = 60

CODE_INVALID_HANDOFF_TOKEN = "invalid-handoff-token"
CODE_INVALID_HANDOFF_URI = "invalid-handoff-uri"
CODE_KEY_LIMIT_REACHED = "key-limit-reached"
CODE_INVALID_REDEEM_RESPONSE = "invalid-redeem-response"

# secrets.token_urlsafe(32) в CP даёт 43 символа [A-Za-z0-9_-]; допускаем печатный токен 4..512
# символов без пробелов и управляющих знаков.
_HANDOFF_TOKEN_RE = re.compile(r"^[A-Za-z0-9_.:-]{4,512}$")
_KEY_PATTERN = re.compile(r"nmd_[0-9A-Za-z]+_[A-Za-z0-9_-]+")
_QUERY_SECRET_PATTERN = re.compile(
    r"((?:handoff_token|token|api_key|key)=)([^&\s\"'#]+)",
    re.IGNORECASE,
)
_JSON_SECRET_PATTERN = re.compile(
    r'("(?:handoff_token|token|api_key|key)"\s*:\s*")([^"]*)(")',
    re.IGNORECASE,
)

_ALLOWED_CONNECT_TARGETS = frozenset({
    "connect",
    "nomad/connect",
    "open/nomad-connect",
    "open/nomad-accounts",
    "accounts",
    "nomad-accounts",
})


def _handoff_error(
    code: str,
    message: str,
    *,
    reachable: bool = True,
    status: Optional[int] = None,
) -> Dict[str, Any]:
    out = activation._error(code, message, reachable=reachable)
    out["connected"] = False
    if status is not None:
        out["http_status"] = status
        out["status_code"] = status
    return out


def redact_secrets(text: str) -> str:
    """Скрыть ключи ``nmd_…`` и одноразовые токены в произвольной строке."""
    if not text:
        return ""
    scrubbed = _KEY_PATTERN.sub("nmd_***", str(text))
    scrubbed = _QUERY_SECRET_PATTERN.sub(r"\1***", scrubbed)
    scrubbed = _JSON_SECRET_PATTERN.sub(r"\1***\3", scrubbed)
    return scrubbed


def is_connect_uri(value: object) -> bool:
    """Проверить, является ли строка ссылкой схемы ``nomad://``."""
    return isinstance(value, str) and value.strip().lower().startswith(f"{HANDOFF_SCHEME}://")


def build_connect_uri(
    handoff_token: str,
    *,
    cp_url: Optional[str] = None,
    tenant_id: Optional[int] = None,
) -> str:
    """Собрать глубокую ссылку ``nomad://connect?handoff_token=…`` для передачи агенту."""
    token = (handoff_token or "").strip()
    if not _HANDOFF_TOKEN_RE.fullmatch(token):
        raise ValueError("handoff_token has invalid format")
    params: Dict[str, str] = {"handoff_token": token}
    if cp_url is not None and str(cp_url).strip():
        params["cp_url"] = str(cp_url).strip()
    if tenant_id is not None:
        params["tenant_id"] = str(int(tenant_id))
    return f"{HANDOFF_SCHEME}://connect?{urlencode(params)}"


def _extract_query_params(query: str) -> Dict[str, str]:
    parsed = parse_qs(query, keep_blank_values=True)
    return {k: (v[-1].strip() if v else "") for k, v in parsed.items()}


def parse_connect_uri(uri: str, *, allow_http_callback: bool = False) -> Dict[str, Any]:
    """Разобрать ссылку ``nomad://connect?handoff_token=…`` (или локальный callback URL).

    Возвращает словарь ``{"handoff_token": str, "cp_url": str | None, "tenant_id": int | None}``.
    При любой ошибке формата выбрасывает ``ValueError`` без включения секрета в текст исключения.
    """
    if not isinstance(uri, str) or not uri.strip():
        raise ValueError("Пустая ссылка подключения.")
    raw = uri.strip()
    try:
        parts = urlsplit(raw)
    except ValueError as exc:
        raise ValueError("Некорректный URL подключения.") from exc

    scheme = (parts.scheme or "").lower()
    if scheme == HANDOFF_SCHEME:
        host = (parts.netloc or "").strip().lower()
        path = (parts.path or "").strip().strip("/").lower()
        target = f"{host}/{path}".strip("/") if host and path else (host or path)
        if target not in _ALLOWED_CONNECT_TARGETS:
            raise ValueError(f"Неподдерживаемая цель ссылки {HANDOFF_SCHEME}://.")
    elif allow_http_callback and scheme in ("http", "https", ""):
        path = (parts.path or "/").strip().lower()
        if path not in ("/", "/callback", "/connect", "/sso/callback", "/api/plugins/nomad/connect"):
            raise ValueError("Неподдерживаемый путь локального callback-адреса.")
    else:
        raise ValueError(f"Ожидалась схема {HANDOFF_SCHEME}://.")

    params = _extract_query_params(parts.query)
    token = params.get("handoff_token") or params.get("token") or ""
    if not token:
        raise ValueError("В ссылке отсутствует параметр handoff_token.")
    if not _HANDOFF_TOKEN_RE.fullmatch(token):
        raise ValueError("Параметр handoff_token имеет недопустимый формат.")

    cp_url = params.get("cp_url") or None
    tenant_raw = params.get("tenant_id")
    tenant_id: Optional[int] = None
    if tenant_raw is not None and tenant_raw != "":
        try:
            tenant_id = int(tenant_raw)
        except ValueError as exc:
            raise ValueError("Параметр tenant_id должен быть целым числом.") from exc

    return {
        "handoff_token": token,
        "cp_url": cp_url,
        "tenant_id": tenant_id,
    }


def try_parse_connect_uri(uri: str, *, allow_http_callback: bool = False) -> Dict[str, Any]:
    """Безопасная обёртка над ``parse_connect_uri`` со словарём ошибки в формате ``activation``."""
    try:
        parsed = parse_connect_uri(uri, allow_http_callback=allow_http_callback)
    except ValueError as exc:
        return _handoff_error(
            CODE_INVALID_HANDOFF_URI,
            redact_secrets(str(exc)),
            reachable=False,
        )
    return {"ok": True, **parsed}


def _resolve_target_cp_url(explicit_cp_url: Optional[str]) -> tuple[Optional[str], Optional[Dict[str, Any]]]:
    if explicit_cp_url is not None and str(explicit_cp_url).strip():
        clean = activation.normalize_cp_url(str(explicit_cp_url))
        if clean is None:
            return None, _handoff_error(
                activation.CODE_BAD_REQUEST,
                "Адрес NomadNet в настройках недопустим: нужен https://хост без пути "
                "(http — только для localhost). Токен никуда не отправлялся.",
                reachable=False,
            )
        return clean, None
    resolved, err = activation.resolve_cp_url()
    if err is not None:
        err = dict(err)
        err.setdefault("connected", False)
        return None, err
    return resolved, None


def redeem_handoff_token(
    handoff_token: str,
    *,
    cp_url: Optional[str] = None,
    tenant_id: Optional[int] = None,
    timeout: float = activation.PROBE_TIMEOUT_S,
) -> Dict[str, Any]:
    """Обменять одноразовый ``handoff_token`` в Control Plane и сохранить полученный ключ ``nmd_…``.

    Ни сам ``handoff_token``, ни полученный ключ ``nmd_…`` не пишутся в логи и не возвращаются
    в ответе. При любом отказе Control Plane существующие ``.env`` и ``config.yaml`` остаются
    нетронутыми.
    """
    token = (handoff_token or "").strip() if isinstance(handoff_token, str) else ""
    if not token or not _HANDOFF_TOKEN_RE.fullmatch(token):
        return _handoff_error(
            CODE_INVALID_HANDOFF_TOKEN,
            "Одноразовый токен подключения пуст или имеет неверный формат.",
            reachable=False,
        )

    if tenant_id is not None:
        try:
            tenant_id = int(tenant_id)
        except (TypeError, ValueError):
            return _handoff_error(
                activation.CODE_BAD_REQUEST,
                "Идентификатор тенанта (tenant_id) должен быть целым числом.",
                reachable=False,
            )

    resolved_cp_url, err = _resolve_target_cp_url(cp_url)
    if err is not None or resolved_cp_url is None:
        return err or _handoff_error(
            activation.CODE_CP_URL_UNSET,
            f"Не задан адрес Control Plane ({activation.CP_URL_ENV}).",
            reachable=False,
        )

    payload: Dict[str, Any] = {"handoff_token": token}
    if tenant_id is not None:
        payload["tenant_id"] = tenant_id

    headers = {"Accept": "application/json"}
    try:
        with activation._http_client(resolved_cp_url) as client:
            resp = client.post(
                f"{resolved_cp_url}{REDEEM_PATH}",
                json=payload,
                headers=headers,
                timeout=timeout,
            )
            status = resp.status_code
            logger.debug("NomadNet SSO handoff redeem answered HTTP %s", status)
            try:
                body = resp.json()
            except Exception:  # noqa: BLE001
                body = None

            error_code = body.get("error") if isinstance(body, dict) else None
            if status == 401 or error_code == "invalid_handoff_token":
                return _handoff_error(
                    CODE_INVALID_HANDOFF_TOKEN,
                    "Одноразовый токен подключения недействителен, истёк (60 с) или уже был использован.",
                    status=status if status else 401,
                )
            if status == 409 or error_code == "key_limit_reached":
                return _handoff_error(
                    CODE_KEY_LIMIT_REACHED,
                    "Достигнут лимит ключей в личном кабинете (409). Отзовите старый ключ и повторите подключение.",
                    status=status if status else 409,
                )
            if status == 403:
                return _handoff_error(
                    activation.CODE_KEY_NOT_PROVISIONED,
                    "Выпуск ключа для аккаунта запрещён (403).",
                    status=403,
                )
            if status == 429 or error_code == "err_rate_limit":
                return _handoff_error(
                    activation.CODE_RATE_LIMITED,
                    "Слишком много попыток (429). Подождите минуту и повторите.",
                    status=429,
                )
            if 500 <= status <= 599:
                return _handoff_error(
                    activation.CODE_CP_UNAVAILABLE,
                    f"NomadNet временно недоступен ({status}); токен не обменян.",
                    status=status,
                )
            if status != 200 or not isinstance(body, dict):
                return _handoff_error(
                    activation.CODE_UNKNOWN,
                    f"NomadNet ответил HTTP {status} при обмене токена.",
                    status=status,
                )

            raw_key = body.get("key") or body.get("api_key")
            key = raw_key.strip() if isinstance(raw_key, str) else ""
            if not key or not activation._KEY_RE.fullmatch(key):
                return _handoff_error(
                    CODE_INVALID_REDEEM_RESPONSE,
                    "Control Plane не вернул действительный ключ формата nmd_<префикс>_<секрет>.",
                    status=200,
                )

            auth_headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
            models = activation._catalogue(client, f"{resolved_cp_url}/v1", auth_headers)
    except Exception:  # noqa: BLE001 — любая транспортная ошибка: DNS, TLS, отказ соединения
        return _handoff_error(
            activation.CODE_UNREACHABLE,
            "Не удалось связаться с NomadNet; одноразовый токен не проверен.",
            reachable=False,
        )

    saved = activation._save_accepted_key(resolved_cp_url, key, models)
    if not saved.get("ok"):
        saved = dict(saved)
        saved.setdefault("connected", False)
        return saved

    result = dict(saved)
    result["connected"] = True
    result["cp_url"] = resolved_cp_url
    if isinstance(body.get("tenant_id"), int):
        result["tenant_id"] = body["tenant_id"]
    if isinstance(body.get("scopes"), list):
        result["scopes"] = [str(s) for s in body["scopes"] if isinstance(s, str)]
    return result


def connect_from_uri(
    uri: str,
    *,
    cp_url: Optional[str] = None,
    timeout: float = activation.PROBE_TIMEOUT_S,
    allow_http_callback: bool = False,
) -> Dict[str, Any]:
    """Принять ссылку ``nomad://connect?handoff_token=…``, обменять токен в CP и сохранить ключ."""
    parsed = try_parse_connect_uri(uri, allow_http_callback=allow_http_callback)
    if not parsed.get("ok"):
        return parsed
    return redeem_handoff_token(
        parsed["handoff_token"],
        cp_url=cp_url or parsed.get("cp_url"),
        tenant_id=parsed.get("tenant_id"),
        timeout=timeout,
    )


def handle_handoff_payload(
    payload: Mapping[str, Any] | str,
    *,
    cp_url: Optional[str] = None,
    timeout: float = activation.PROBE_TIMEOUT_S,
) -> Dict[str, Any]:
    """Обработать полезную нагрузку передачи токена (словарь JSON, ``nomad://`` или сам токен)."""
    if isinstance(payload, str):
        raw = payload.strip()
        if is_connect_uri(raw) or raw.startswith(("http://", "https://", "/")):
            return connect_from_uri(raw, cp_url=cp_url, timeout=timeout, allow_http_callback=True)
        return redeem_handoff_token(raw, cp_url=cp_url, timeout=timeout)

    if not isinstance(payload, Mapping):
        return _handoff_error(
            CODE_INVALID_HANDOFF_TOKEN,
            "Некорректный формат данных для обмена токена.",
            reachable=False,
        )

    target_cp = cp_url or (str(payload["cp_url"]).strip() if payload.get("cp_url") else None)
    uri = payload.get("uri") or payload.get("url")
    if isinstance(uri, str) and uri.strip():
        return connect_from_uri(
            uri.strip(),
            cp_url=target_cp,
            timeout=timeout,
            allow_http_callback=True,
        )

    token = payload.get("handoff_token") or payload.get("token")
    if isinstance(token, str) and is_connect_uri(token):
        return connect_from_uri(token, cp_url=target_cp, timeout=timeout)

    return redeem_handoff_token(
        token if isinstance(token, str) else "",
        cp_url=target_cp,
        tenant_id=payload.get("tenant_id"),
        timeout=timeout,
    )


class LocalHandoffServer:
    """Локальный петлевой HTTP-приёмник (``127.0.0.1``) для прямой доставки токена из кабинета.

    Принимает ``GET /callback?handoff_token=…`` или ``POST /callback`` (а также ``/`` и ``/connect``)
    с JSON-телом ``{"handoff_token": "…"}``, сразу вызывает ``redeem_handoff_token`` и возвращает
    результат без секретов. Логирование HTTP-запросов отключено, чтобы ``handoff_token`` из
    query-строки не попал в ``stderr`` или стандартные логи.
    """

    def __init__(
        self,
        *,
        cp_url: Optional[str] = None,
        port: int = 0,
        timeout: float = activation.PROBE_TIMEOUT_S,
    ):
        self._cp_url = cp_url
        self._timeout = timeout
        self._done = threading.Event()
        self.last_result: Optional[Dict[str, Any]] = None
        parent = self

        class _Handler(BaseHTTPRequestHandler):
            def log_message(self, format: str, *args: object) -> None:  # noqa: A002
                # Никогда не логируем URL/query с handoff_token.
                return

            def _send_json(self, status_code: int, data: Mapping[str, Any]) -> None:
                raw_bytes = json.dumps(dict(data), ensure_ascii=False).encode("utf-8")
                self.send_response(status_code)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(raw_bytes)))
                self.send_header("Cache-Control", "no-store")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.end_headers()
                self.wfile.write(raw_bytes)

            def do_OPTIONS(self) -> None:  # noqa: N802
                self._send_json(200, {"ok": True})

            def do_GET(self) -> None:  # noqa: N802
                result = connect_from_uri(
                    self.path,
                    cp_url=parent._cp_url,
                    timeout=parent._timeout,
                    allow_http_callback=True,
                )
                parent.last_result = result
                parent._done.set()
                http_code = 200 if result.get("ok") else int(result.get("http_status") or 400)
                self._send_json(http_code, result)

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                raw_body = self.rfile.read(length) if length > 0 else b""
                parsed_body: Any = {}
                if raw_body:
                    try:
                        parsed_body = json.loads(raw_body.decode("utf-8"))
                    except (UnicodeDecodeError, json.JSONDecodeError):
                        parsed_body = {}
                if isinstance(parsed_body, Mapping) and (
                    parsed_body.get("handoff_token")
                    or parsed_body.get("token")
                    or parsed_body.get("uri")
                    or parsed_body.get("url")
                ):
                    result = handle_handoff_payload(
                        parsed_body,
                        cp_url=parent._cp_url,
                        timeout=parent._timeout,
                    )
                else:
                    result = connect_from_uri(
                        self.path,
                        cp_url=parent._cp_url,
                        timeout=parent._timeout,
                        allow_http_callback=True,
                    )
                parent.last_result = result
                parent._done.set()
                http_code = 200 if result.get("ok") else int(result.get("http_status") or 400)
                self._send_json(http_code, result)

        self._server = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
        self.port: int = int(self._server.server_address[1])
        self._thread: Optional[threading.Thread] = None

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"

    @property
    def callback_url(self) -> str:
        return f"{self.base_url}/callback"

    def start(self) -> "LocalHandoffServer":
        if self._thread is None:
            self._thread = threading.Thread(
                target=self._server.serve_forever,
                name="nomad-key-handoff",
                daemon=True,
            )
            self._thread.start()
        return self

    def wait_for_result(self, timeout: float = 5.0) -> Optional[Dict[str, Any]]:
        self._done.wait(timeout=timeout)
        return self.last_result

    def stop(self) -> None:
        if self._thread is not None:
            self._server.shutdown()
            self._server.server_close()
            self._thread.join(timeout=2.0)
            self._thread = None

    def __enter__(self) -> "LocalHandoffServer":
        return self.start()

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.stop()
