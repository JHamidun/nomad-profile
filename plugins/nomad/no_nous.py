"""Строгая блокировка всех обращений к инфраструктуре Nous (M-126 / D06).

Модуль нейтрализует все 6 точек возможного сетевого контакта с ``*.nousresearch.com``
даже при наличии сохранённого ``auth.json`` с Nous-токенами в профиле:

1. ``hermes_cli.models``: ``fetch_nous_recommended_models``, ``_nous_catalog``,
   ``check_nous_free_tier``, ``get_nous_recommended_aux_model``.
2. ``tools.skills_sync`` / ``tools.skills_sync_optional``:
   ``resolve_identity``, ``resolve_org_identity``, ``sync_skills``.
3. ``tools.tool_backend_helpers`` / ``tools.managed_tool_gateway`` / ``hermes_cli.nous_account``:
   ``managed_nous_tools_enabled``, ``resolve_managed_tool_gateway``,
   ``_read_nous_provider_state``, ``read_nous_access_token``, ``get_nous_portal_account_info``.
4. ``hermes_cli.plugin_catalog``: ``fetch_live_catalog``.
5. ``tools.skills_hub_search``: ``_load_hermes_index``.
6. ``hermes_cli.auth_nous`` / ``hermes_cli.auth`` / ``hermes_cli.runtime_provider``:
   Nous provider router (``resolve_nous_runtime_credentials``, ``fetch_nous_models``,
   ``get_provider_auth_state("nous")``, ``get_active_provider()``).

Дополнительно устанавливается перехватчик на уровне ``socket.getaddrinfo``,
``socket.create_connection`` и ``urllib.request.urlopen``, блокирующий любые
обращения к доменам ``nousresearch.com`` и ``*.nousresearch.com`` с нулём сетевых пакетов.
"""

from __future__ import annotations

import gc
import socket
import sys
import threading
import types
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

NOUS_DOMAIN = "nousresearch.com"
NOUS_DOMAIN_SUFFIX = ".nousresearch.com"

SIX_NOUS_POINTS: Tuple[str, ...] = (
    "models.py:fetch_nous_recommended_models",
    "skills_sync.py:resolve_identity",
    "tool_backend_helpers.py:managed_nous_tools_enabled",
    "plugin_catalog.py:fetch_live_catalog",
    "skills_hub_search.py:_load_hermes_index",
    "auth_nous.py:resolve_nous_runtime_credentials",
)


class NousBlockedError(RuntimeError):
    """Исключение при попытке обращения к заблокированному контуру Nous."""


@dataclass(frozen=True)
class BlockedNousEvent:
    """Запись о перехваченном и заблокированном обращении к Nous."""

    point: str
    detail: str


_LOCK: threading.Lock = getattr(socket, "_nomad_no_nous_lock", None) or threading.Lock()
setattr(socket, "_nomad_no_nous_lock", _LOCK)
_BLOCKED_EVENTS: List[BlockedNousEvent] = getattr(socket, "_nomad_no_nous_events", None)
if _BLOCKED_EVENTS is None:
    _BLOCKED_EVENTS = []
    setattr(socket, "_nomad_no_nous_events", _BLOCKED_EVENTS)
_INSTALLED = False
_ORIG_GETADDRINFO: Optional[Callable[..., Any]] = None
_ORIG_CREATE_CONNECTION: Optional[Callable[..., Any]] = None
_ORIG_URLOPEN: Optional[Callable[..., Any]] = None
_PATCHED_AUTH_MODULE_IDS: set[int] = set()


def _record_block(point: str, detail: str) -> None:
    with _LOCK:
        _BLOCKED_EVENTS.append(BlockedNousEvent(point=point, detail=detail))


def get_blocked_events() -> List[BlockedNousEvent]:
    """Возвращает копию журнала перехваченных вызовов Nous."""
    with _LOCK:
        return list(_BLOCKED_EVENTS)


def clear_blocked_events() -> None:
    """Очищает журнал перехваченных вызовов Nous."""
    with _LOCK:
        _BLOCKED_EVENTS.clear()


def is_nous_host(host: Any) -> bool:
    """Проверяет, принадлежит ли имя хоста домену ``nousresearch.com`` или его поддоменам."""
    if not isinstance(host, str):
        return False
    clean = host.strip().lower().rstrip(".")
    if not clean:
        return False
    if "://" in clean:
        parsed = urllib.parse.urlsplit(clean)
        clean = (parsed.hostname or "").strip().lower().rstrip(".")
    if ":" in clean and not clean.startswith("["):
        clean = clean.split(":", 1)[0]
    return clean == NOUS_DOMAIN or clean.endswith(NOUS_DOMAIN_SUFFIX)


# --- Заглушки для 6 точек контакта с Nous ---


def _disabled_fetch_nous_recommended_models(*args: Any, **kwargs: Any) -> Dict[str, Any]:
    _record_block("models.py:fetch_nous_recommended_models", "blocked recommended-models fetch")
    return {}


def _disabled_nous_catalog(*args: Any, **kwargs: Any) -> List[Any]:
    _record_block("models.py:fetch_nous_recommended_models", "blocked _nous_catalog")
    return []


def _disabled_check_nous_free_tier(*args: Any, **kwargs: Any) -> bool:
    _record_block("models.py:fetch_nous_recommended_models", "blocked check_nous_free_tier")
    return False


def _disabled_get_nous_recommended_aux_model(*args: Any, **kwargs: Any) -> None:
    _record_block("models.py:fetch_nous_recommended_models", "blocked get_nous_recommended_aux_model")
    return None


def _disabled_sync_resolve_identity(*args: Any, **kwargs: Any) -> None:
    _record_block("skills_sync.py:resolve_identity", "blocked skills sync identity resolution")
    return None


def _disabled_managed_nous_tools_enabled(*args: Any, **kwargs: Any) -> bool:
    _record_block("tool_backend_helpers.py:managed_nous_tools_enabled", "blocked managed_nous_tools_enabled")
    return False


def _disabled_resolve_managed_tool_gateway(*args: Any, **kwargs: Any) -> None:
    _record_block("tool_backend_helpers.py:managed_nous_tools_enabled", "blocked resolve_managed_tool_gateway")
    return None


def _disabled_read_nous_provider_state(*args: Any, **kwargs: Any) -> None:
    _record_block("tool_backend_helpers.py:managed_nous_tools_enabled", "blocked _read_nous_provider_state")
    return None


def _disabled_read_nous_access_token(*args: Any, **kwargs: Any) -> None:
    _record_block("tool_backend_helpers.py:managed_nous_tools_enabled", "blocked read_nous_access_token")
    return None


def _disabled_portal_account_info(*args: Any, **kwargs: Any) -> None:
    _record_block("tool_backend_helpers.py:managed_nous_tools_enabled", "blocked get_nous_portal_account_info")
    return None


def _disabled_fetch_live_catalog(*args: Any, **kwargs: Any) -> None:
    _record_block("plugin_catalog.py:fetch_live_catalog", "blocked live plugin catalog fetch")
    return None


def _disabled_load_hermes_index(*args: Any, **kwargs: Any) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    _record_block("skills_hub_search.py:_load_hermes_index", "blocked skills-index.json HTTP fetch")
    return [], "Nous/Hermes skills index is disabled by Nomad no-Nous policy."


def _disabled_resolve_nous_runtime_credentials(*args: Any, **kwargs: Any) -> Dict[str, Any]:
    _record_block("auth_nous.py:resolve_nous_runtime_credentials", "blocked Nous credential resolution")
    if kwargs.get("read_only"):
        return {}
    raise NousBlockedError("Nous provider is strictly disabled in Nomad (M-126).")


def _disabled_fetch_nous_models(*args: Any, **kwargs: Any) -> List[str]:
    _record_block("auth_nous.py:resolve_nous_runtime_credentials", "blocked fetch_nous_models")
    return []


def _patch_auth_module(mod: Any) -> None:
    mod_id = id(mod)
    if mod_id not in _PATCHED_AUTH_MODULE_IDS:
        _PATCHED_AUTH_MODULE_IDS.add(mod_id)

        orig_get_state = getattr(mod, "get_provider_auth_state", None)
        if callable(orig_get_state):
            def _guarded_get_provider_auth_state(provider: str, *a: Any, **kw: Any) -> Any:
                if isinstance(provider, str) and provider.strip().lower() == "nous":
                    _record_block(
                        "auth_nous.py:resolve_nous_runtime_credentials",
                        "suppressed saved nous auth.json state",
                    )
                    return None
                return orig_get_state(provider, *a, **kw)

            setattr(mod, "get_provider_auth_state", _guarded_get_provider_auth_state)

        orig_active = getattr(mod, "get_active_provider", None)
        if callable(orig_active):
            def _guarded_get_active_provider(*a: Any, **kw: Any) -> Any:
                res = orig_active(*a, **kw)
                if isinstance(res, str) and res.strip().lower() == "nous":
                    _record_block(
                        "auth_nous.py:resolve_nous_runtime_credentials",
                        "suppressed active_provider=nous from auth.json",
                    )
                    return None
                return res

            setattr(mod, "get_active_provider", _guarded_get_active_provider)

    err_cls = getattr(mod, "AuthError", None)

    def _bound_resolve_nous(*args: Any, **kwargs: Any) -> Dict[str, Any]:
        _record_block("auth_nous.py:resolve_nous_runtime_credentials", "blocked Nous credential resolution")
        if kwargs.get("read_only"):
            return {}
        msg = "Nous provider is strictly disabled in Nomad (M-126)."
        if isinstance(err_cls, type) and issubclass(err_cls, Exception):
            raise err_cls(msg)
        raise NousBlockedError(msg)

    setattr(mod, "resolve_nous_runtime_credentials", _bound_resolve_nous)
    setattr(mod, "fetch_nous_models", _disabled_fetch_nous_models)


def patch_module_if_target(module_name: str, mod: Any) -> bool:
    """Применяет патчи блокировки Nous к целевому модулю ядра, если он загружен."""
    if mod is None:
        return False

    if module_name == "hermes_cli.models":
        setattr(mod, "fetch_nous_recommended_models", _disabled_fetch_nous_recommended_models)
        setattr(mod, "_nous_catalog", _disabled_nous_catalog)
        setattr(mod, "check_nous_free_tier", _disabled_check_nous_free_tier)
        setattr(mod, "get_nous_recommended_aux_model", _disabled_get_nous_recommended_aux_model)
        return True

    if module_name in (
        "tools.skills_sync",
        "tools.skills_sync_optional",
        "tools.skills_sync_client",
        "tools.skills_sync_client_org",
    ):
        setattr(mod, "resolve_identity", _disabled_sync_resolve_identity)
        setattr(mod, "resolve_org_identity", _disabled_sync_resolve_identity)
        return True

    if module_name in (
        "tools.tool_backend_helpers",
        "tools.managed_tool_gateway",
        "tools.managed_gateway_auth",
        "hermes_cli.nous_account",
    ):
        setattr(mod, "managed_nous_tools_enabled", _disabled_managed_nous_tools_enabled)
        setattr(mod, "resolve_managed_tool_gateway", _disabled_resolve_managed_tool_gateway)
        setattr(mod, "_read_nous_provider_state", _disabled_read_nous_provider_state)
        setattr(mod, "read_nous_access_token", _disabled_read_nous_access_token)
        setattr(mod, "get_nous_portal_account_info", _disabled_portal_account_info)
        return True

    if module_name == "hermes_cli.plugin_catalog":
        setattr(mod, "fetch_live_catalog", _disabled_fetch_live_catalog)
        return True

    if module_name == "tools.skills_hub_search":
        setattr(mod, "_load_hermes_index", _disabled_load_hermes_index)
        return True

    if module_name in ("hermes_cli.auth_nous", "hermes_cli.auth", "hermes_cli.runtime_provider"):
        _patch_auth_module(mod)
        return True

    if module_name == "agent.auxiliary_client":
        setattr(mod, "resolve_nous_runtime_credentials", _disabled_resolve_nous_runtime_credentials)
        return True

    return False


_TARGET_MODULES: Tuple[str, ...] = (
    "hermes_cli.models",
    "tools.skills_sync",
    "tools.skills_sync_optional",
    "tools.skills_sync_client",
    "tools.skills_sync_client_org",
    "tools.tool_backend_helpers",
    "tools.managed_tool_gateway",
    "tools.managed_gateway_auth",
    "hermes_cli.nous_account",
    "hermes_cli.plugin_catalog",
    "tools.skills_hub_search",
    "hermes_cli.auth_nous",
    "hermes_cli.auth",
    "hermes_cli.runtime_provider",
    "agent.auxiliary_client",
)

_TARGET_MODULE_SET = frozenset(_TARGET_MODULES)


def patch_all_loaded_targets() -> int:
    """Находит в памяти уже загруженные целевые модули и накладывает патчи (без обращения к sys.modules)."""
    count = 0
    for obj in list(gc.get_objects()):
        if not isinstance(obj, types.ModuleType):
            continue
        mod_name = getattr(obj, "__name__", "")
        if mod_name in _TARGET_MODULE_SET and patch_module_if_target(mod_name, obj):
            count += 1
    return count


class _LoaderWrapper:
    """Обёртка над стандартным loader, пропатчивающая модуль сразу после ``exec_module``."""

    def __init__(self, inner_loader: Any, fullname: str) -> None:
        self._inner = inner_loader
        self._fullname = fullname

    def create_module(self, spec: Any) -> Any:
        create_fn = getattr(self._inner, "create_module", None)
        if callable(create_fn):
            return create_fn(spec)
        return None

    def exec_module(self, module: Any) -> None:
        exec_fn = getattr(self._inner, "exec_module", None)
        if callable(exec_fn):
            exec_fn(module)
        patch_module_if_target(self._fullname, module)


class _NoNousPostImportFinder:
    """MetaPathFinder, перехватывающий первую загрузку целевых модулей ядра."""

    def __init__(self) -> None:
        self._in_progress: set[str] = set()

    def find_spec(self, fullname: str, path: Any = None, target: Any = None) -> Any:
        if fullname not in _TARGET_MODULE_SET or fullname in self._in_progress:
            return None
        self._in_progress.add(fullname)
        try:
            for finder in sys.meta_path:
                if finder is self:
                    continue
                find_spec_fn = getattr(finder, "find_spec", None)
                if not callable(find_spec_fn):
                    continue
                spec = find_spec_fn(fullname, path, target)
                if spec is not None and getattr(spec, "loader", None) is not None:
                    if not isinstance(spec.loader, _LoaderWrapper):
                        spec.loader = _LoaderWrapper(spec.loader, fullname)
                    return spec
            return None
        finally:
            self._in_progress.discard(fullname)


_FINDER_SINGLETON = _NoNousPostImportFinder()


def _install_transport_guards() -> None:
    global _ORIG_GETADDRINFO, _ORIG_CREATE_CONNECTION, _ORIG_URLOPEN

    if _ORIG_GETADDRINFO is None:
        _ORIG_GETADDRINFO = socket.getaddrinfo

        def _guarded_getaddrinfo(host: Any, port: Any, *args: Any, **kwargs: Any) -> Any:
            if is_nous_host(host):
                _record_block("transport:socket.getaddrinfo", f"blocked DNS lookup for {host}")
                raise OSError(f"Blocked by Nomad no_nous guard: DNS lookup for {host}")
            assert _ORIG_GETADDRINFO is not None
            return _ORIG_GETADDRINFO(host, port, *args, **kwargs)

        socket.getaddrinfo = _guarded_getaddrinfo  # type: ignore[assignment]

    if _ORIG_CREATE_CONNECTION is None:
        _ORIG_CREATE_CONNECTION = socket.create_connection

        def _guarded_create_connection(address: Any, *args: Any, **kwargs: Any) -> Any:
            host = address[0] if isinstance(address, tuple) and address else address
            if is_nous_host(host):
                _record_block("transport:socket.create_connection", f"blocked TCP connection to {host}")
                raise OSError(f"Blocked by Nomad no_nous guard: connection to {host}")
            assert _ORIG_CREATE_CONNECTION is not None
            return _ORIG_CREATE_CONNECTION(address, *args, **kwargs)

        socket.create_connection = _guarded_create_connection  # type: ignore[assignment]

    if _ORIG_URLOPEN is None:
        _ORIG_URLOPEN = urllib.request.urlopen

        def _guarded_urlopen(url: Any, *args: Any, **kwargs: Any) -> Any:
            target_url = getattr(url, "full_url", url)
            if is_nous_host(target_url):
                _record_block("transport:urllib.request.urlopen", f"blocked HTTP request to {target_url}")
                raise urllib.error.URLError(f"Blocked by Nomad no_nous guard: {target_url}")
            assert _ORIG_URLOPEN is not None
            return _ORIG_URLOPEN(url, *args, **kwargs)

        urllib.request.urlopen = _guarded_urlopen  # type: ignore[assignment]


def install_no_nous_guard() -> None:
    """Активирует все уровни защиты от обращений к Nous (идемпотентно)."""
    global _INSTALLED
    with _LOCK:
        _install_transport_guards()
        if _FINDER_SINGLETON not in sys.meta_path:
            sys.meta_path.insert(0, _FINDER_SINGLETON)
        _INSTALLED = True
    patch_all_loaded_targets()
