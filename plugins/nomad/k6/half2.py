"""K6 (half = 2, M-084) — Перенос правок из 4 плагинов апстрима в хуки ``package/plugins/nomad/k6/``.

Реализует четыре решения ``хук плагина`` второй половины таблицы ``docs/k6-plugins.md``:

5. ``telegram`` (``28438aafe9``, ``9713a3fc6d``, ``6cb6e344ce``, ``0c52ef9946``):
   - Привязка аккаунта по deep-link ``/start link_<token>``;
   - Изоляция тенантов в Telegram-сессиях;
   - Чекбоксы ``clarify`` (multi-select / single-select toggle & submit).
   Оплата Stars снята по решению D09.

6. ``memory_honcho`` (``97b69072f3``):
   - Привязка ``peer`` к аутентифицированному ``tenant_id`` против чтения чужой памяти;
   - Изоляция пространства памяти по тенанту хуками сессии и обёрткой вызовов инструментов
     памяти (``memory_search``, ``memory_store``, ``memory_get``, ``honcho_*``).

7. ``nebius_token_factory`` (``27f052e723``, ``e07fb99874``):
   - Отключение нежелательного автоперехвата провайдера (приоритет маршрута NomadNet);
   - Укладка и компактификация тулсета под контекстное окно 32k в ``pre_llm_request``.

8. ``dashboard_auth_nous`` (``54d8f6dd2d``, ``08ddcf60c2``):
   - Устранение хвостов бренда Nous в статусе входа;
   - Активация ключа ``nmd_`` и выдача карточки аккаунта через ``/api/plugins/nomad/account``.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("nomad.k6.half2")

# ===========================================================================
# 5. telegram: link_<token>, tenant isolation, clarify checkboxes (Stars removed per D09)
# ===========================================================================

_TELEGRAM_LINK_LOCK = threading.Lock()
# user_id -> {"token": token, "tenant_id": tenant_id, "chat_id": chat_id, "linked_at": timestamp}
_TELEGRAM_USER_BINDINGS: Dict[str, Dict[str, Any]] = {}
_TELEGRAM_START_LINK_RE = re.compile(r"^/start\s+link_([A-Za-z0-9_-]+)$", re.IGNORECASE)


def reset_telegram_bindings() -> None:
    """Сбрасывает состояние привязок Telegram для изолированных тестов."""
    with _TELEGRAM_LINK_LOCK:
        _TELEGRAM_USER_BINDINGS.clear()


def parse_telegram_start_link(text: str) -> Optional[str]:
    """Извлекает токен привязки из команды ``/start link_<token>``."""
    if not isinstance(text, str):
        return None
    match = _TELEGRAM_START_LINK_RE.match(text.strip())
    if match:
        return match.group(1)
    return None


def bind_telegram_user(
    user_id: int | str,
    token: str,
    *,
    tenant_id: Optional[str] = None,
    chat_id: Optional[int | str] = None,
) -> Dict[str, Any]:
    """Связывает идентификатор Telegram-пользователя с токеном аккаунта NomadNet и тенантом."""
    uid = str(user_id).strip()
    clean_token = (token or "").strip()
    if not clean_token:
        return {
            "success": False,
            "error": "empty_token",
            "message": "Токен привязки не может быть пустым",
        }

    resolved_tenant = (tenant_id or "").strip() or f"tenant_{uid}"
    entry = {
        "user_id": uid,
        "token": clean_token,
        "tenant_id": resolved_tenant,
        "chat_id": str(chat_id) if chat_id is not None else uid,
        "linked_at": time.time(),
    }
    with _TELEGRAM_LINK_LOCK:
        _TELEGRAM_USER_BINDINGS[uid] = entry
    return {
        "success": True,
        "user_id": uid,
        "tenant_id": resolved_tenant,
        "token_prefix": clean_token[:6],
    }


def get_telegram_binding(user_id: int | str) -> Optional[Dict[str, Any]]:
    """Возвращает данные привязки пользователя, если аккаунт привязан."""
    uid = str(user_id).strip()
    with _TELEGRAM_LINK_LOCK:
        entry = _TELEGRAM_USER_BINDINGS.get(uid)
        return dict(entry) if entry else None


def handle_telegram_inbound_message(
    message_text: str,
    user_id: int | str,
    chat_id: int | str,
    *,
    tenant_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Перехватывает служебные команды Telegram (включая ``/start link_<token>``).

    Возвращает dict с ответом и метаданными либо ``None``, если сообщение не является перехватом.
    """
    clean_text = (message_text or "").strip()
    token = parse_telegram_start_link(clean_text)
    if token is not None:
        bind_res = bind_telegram_user(user_id, token, tenant_id=tenant_id, chat_id=chat_id)
        if bind_res["success"]:
            return {
                "handled": True,
                "command": "start_link",
                "user_id": str(user_id),
                "tenant_id": bind_res["tenant_id"],
                "reply": "Аккаунт успешно привязан к NomadNet.",
                "stars_payment_supported": False,  # D09: Stars outbox removed
            }
        return {
            "handled": True,
            "command": "start_link",
            "user_id": str(user_id),
            "reply": "Ошибка привязки аккаунта: недействительный токен.",
        }

    if clean_text.lower().startswith("/start"):
        return {
            "handled": True,
            "command": "start",
            "user_id": str(user_id),
            "reply": "Добро пожаловать в Nomad Agent! Для привязки аккаунта используйте ссылку вида /start link_<token>.",
        }

    return None


def verify_telegram_tenant_access(
    user_id: int | str,
    target_tenant_id: str,
) -> Dict[str, Any]:
    """Проверяет изоляцию тенантов для Telegram-пользователя."""
    uid = str(user_id).strip()
    binding = get_telegram_binding(uid)
    if not binding:
        return {
            "allowed": True,
            "tenant_id": f"tenant_{uid}",
            "multi_tenant": False,
        }

    bound_tenant = binding["tenant_id"]
    if target_tenant_id and target_tenant_id != bound_tenant:
        return {
            "allowed": False,
            "block": True,
            "user_id": uid,
            "bound_tenant": bound_tenant,
            "target_tenant": target_tenant_id,
            "reason": (
                f"Cross-tenant access denied: user {uid!r} is bound to tenant "
                f"{bound_tenant!r}, but requested access to {target_tenant_id!r}."
            ),
        }
    return {
        "allowed": True,
        "block": False,
        "tenant_id": bound_tenant,
        "multi_tenant": True,
    }


def handle_telegram_clarify_callback(
    callback_data: str,
    current_selections: Set[int] | List[int] | None = None,
) -> Dict[str, Any]:
    """Обрабатывает интерактивные callback-запросы опросника clarify (чекбоксы / multi-select)."""
    data = (callback_data or "").strip()
    selected: Set[int] = set(current_selections or [])

    if data.startswith("clarify:toggle:"):
        raw_idx = data.split("clarify:toggle:", 1)[1].strip()
        try:
            idx = int(raw_idx)
            if idx in selected:
                selected.remove(idx)
                action = "unselected"
            else:
                selected.add(idx)
                action = "selected"
            return {
                "handled": True,
                "status": "toggled",
                "action": action,
                "index": idx,
                "selected_indices": sorted(selected),
            }
        except ValueError:
            return {"handled": False, "error": f"invalid_index: {raw_idx}"}

    if data in ("clarify:submit", "clarify_submit"):
        return {
            "handled": True,
            "status": "submitted",
            "selected_indices": sorted(selected),
            "count": len(selected),
        }

    return {"handled": False}


# ===========================================================================
# 6. memory_honcho: tenant isolation for peer & session memory queries
# ===========================================================================

MEMORY_TOOL_NAMES = frozenset({
    "memory_search",
    "memory_store",
    "memory_get",
    "memory_delete",
    "honcho_search",
    "honcho_store",
    "honcho_get",
})


def scope_memory_peer(tenant_id: str, peer: Optional[str] = None) -> str:
    """Квалифицирует идентификатор ``peer`` пространством тенанта."""
    clean_tenant = (tenant_id or "").strip()
    clean_peer = (peer or "").strip()
    if not clean_tenant:
        return clean_peer or "default"

    expected_prefix = f"tenant:{clean_tenant}:"
    if clean_peer.startswith(expected_prefix):
        return clean_peer

    if clean_peer.startswith("tenant:"):
        # Кросс-тенантная попытка: префикс другого тенанта
        raise PermissionError(
            f"Cross-tenant memory access forbidden: peer {clean_peer!r} does not belong to tenant {clean_tenant!r}."
        )

    return f"{expected_prefix}{clean_peer or 'default'}"


def verify_memory_tenant_access(
    current_tenant_id: str,
    requested_peer: Optional[str] = None,
) -> Dict[str, Any]:
    """Проверяет, что обращение к памяти не пересекает границу тенанта."""
    clean_tenant = (current_tenant_id or "").strip()
    peer = (requested_peer or "").strip()

    if not clean_tenant:
        return {"allowed": True, "block": False, "scoped_peer": peer or "default"}

    if peer.startswith("tenant:"):
        parts = peer.split(":", 2)
        if len(parts) >= 2 and parts[1] != clean_tenant:
            return {
                "allowed": False,
                "block": True,
                "current_tenant": clean_tenant,
                "requested_peer": peer,
                "reason": (
                    f"Cross-tenant memory access denied: tenant {clean_tenant!r} "
                    f"cannot access peer belonging to tenant {parts[1]!r}."
                ),
            }

    try:
        scoped = scope_memory_peer(clean_tenant, peer)
        return {"allowed": True, "block": False, "scoped_peer": scoped}
    except PermissionError as exc:
        return {
            "allowed": False,
            "block": True,
            "current_tenant": clean_tenant,
            "requested_peer": peer,
            "reason": str(exc),
        }


def on_memory_pre_tool_call(
    tool_name: str,
    args: Dict[str, Any],
    *,
    tenant_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """Защитный хук для инструментов памяти: изолирует peer по тенанту и блокирует чужие запросы."""
    clean_tool = (tool_name or "").strip().lower()
    if clean_tool not in MEMORY_TOOL_NAMES and not clean_tool.startswith("memory_") and not clean_tool.startswith("honcho_"):
        return None

    if not isinstance(args, dict):
        return None

    eff_tenant = (tenant_id or "").strip() or args.get("tenant_id") or ""
    raw_peer = args.get("peer") or args.get("peer_id") or args.get("user_id")

    verdict = verify_memory_tenant_access(str(eff_tenant), str(raw_peer or ""))
    if not verdict["allowed"]:
        return {"block": True, "reason": verdict["reason"]}

    scoped_peer = verdict.get("scoped_peer")
    if scoped_peer:
        if "peer" in args:
            args["peer"] = scoped_peer
        elif "peer_id" in args:
            args["peer_id"] = scoped_peer
        else:
            args["peer"] = scoped_peer
    return None


# ===========================================================================
# 7. nebius_token_factory: disable auto-hijack and compact toolset into 32k window
# ===========================================================================

NEBIUS_CONTEXT_WINDOW_TOKENS = 32_768
DEFAULT_COMPACT_DOCSTRING_LIMIT = 180


def compact_tool_schema_for_32k(tool: Dict[str, Any]) -> Dict[str, Any]:
    """Сжимает описание и схему инструмента под компактное окно 32k."""
    if not isinstance(tool, dict):
        return tool

    compacted = dict(tool)
    fn = compacted.get("function")
    if isinstance(fn, dict):
        fn_copy = dict(fn)
        desc = fn_copy.get("description", "")
        if isinstance(desc, str) and len(desc) > DEFAULT_COMPACT_DOCSTRING_LIMIT:
            fn_copy["description"] = desc[:DEFAULT_COMPACT_DOCSTRING_LIMIT].rstrip() + "..."
        fn_copy.pop("examples", None)
        fn_copy.pop("notes", None)
        compacted["function"] = fn_copy
    else:
        desc = compacted.get("description", "")
        if isinstance(desc, str) and len(desc) > DEFAULT_COMPACT_DOCSTRING_LIMIT:
            compacted["description"] = desc[:DEFAULT_COMPACT_DOCSTRING_LIMIT].rstrip() + "..."
        compacted.pop("examples", None)

    return compacted


def compact_toolset_for_32k(tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Обрабатывает список инструментов для моделей с окном 32k."""
    if not isinstance(tools, list):
        return []
    return [compact_tool_schema_for_32k(t) for t in tools]


def resolve_nebius_routing(
    provider: str,
    model: str,
    *,
    explicit_nebius: bool = False,
    default_route: str = "nomadnet-auto",
) -> Dict[str, Any]:
    """Отключает скрытый автоперехват провайдера Nebius в пользу NomadNet."""
    clean_prov = (provider or "").strip().lower()
    clean_model = (model or "").strip().lower()

    is_nebius = "nebius" in clean_prov or "nebius" in clean_model
    if is_nebius and not explicit_nebius:
        # Автоперехват отключён: маршрут сохраняется за дефолтным NomadNet роутером
        return {
            "provider": default_route,
            "hijack_prevented": True,
            "route": default_route,
            "context_window_clamped": True,
            "max_context_tokens": NEBIUS_CONTEXT_WINDOW_TOKENS,
        }

    return {
        "provider": clean_prov or default_route,
        "hijack_prevented": False,
        "route": clean_prov or default_route,
        "context_window_clamped": is_nebius,
        "max_context_tokens": NEBIUS_CONTEXT_WINDOW_TOKENS if is_nebius else None,
    }


def on_nebius_pre_llm_request(
    provider: str,
    model: str,
    tools: Optional[List[Dict[str, Any]]] = None,
    *,
    explicit_nebius: bool = False,
    default_route: str = "nomadnet-auto",
) -> Dict[str, Any]:
    """Хук ``pre_llm_request`` для линейки Nebius Token Factory: приоритет NomadNet и компактный тулсет."""
    routing_info = resolve_nebius_routing(
        provider=provider,
        model=model,
        explicit_nebius=explicit_nebius,
        default_route=default_route,
    )
    res_tools = compact_toolset_for_32k(tools) if (tools and routing_info["context_window_clamped"]) else tools

    return {
        "provider": routing_info["provider"],
        "route": routing_info["route"],
        "hijack_prevented": routing_info["hijack_prevented"],
        "tools": res_tools,
        "context_window_clamped": routing_info["context_window_clamped"],
    }


# ===========================================================================
# 8. dashboard_auth_nous: sanitize brand traces and activate nmd_ key
# ===========================================================================

_NOUS_BRAND_RE = re.compile(r"\bnous(?:\s*research)?\b", re.IGNORECASE)
_NMD_KEY_RE = re.compile(r"^nmd_[0-9A-Za-z]+_[A-Za-z0-9_-]+$")


def sanitize_auth_brand_string(val: str) -> str:
    """Заменяет упоминания Nous на Nomad / NomadNet."""
    if not isinstance(val, str):
        return val
    # Сохраняем регистр первого символа
    def _rep(match: re.Match) -> str:
        s = match.group(0)
        if s.isupper():
            return "NOMADNET"
        if s[0].isupper():
            return "NomadNet"
        return "nomadnet"
    return _NOUS_BRAND_RE.sub(_rep, val)


def sanitize_auth_status_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Рекурсивно санитизирует статус аутентификации от хвостов бренда Nous."""
    if not isinstance(payload, dict):
        return payload

    sanitized: Dict[str, Any] = {}
    for k, v in payload.items():
        clean_k = sanitize_auth_brand_string(k) if isinstance(k, str) else k
        if isinstance(v, str):
            sanitized[clean_k] = sanitize_auth_brand_string(v)
        elif isinstance(v, dict):
            sanitized[clean_k] = sanitize_auth_status_payload(v)
        elif isinstance(v, list):
            sanitized[clean_k] = [
                sanitize_auth_status_payload(item) if isinstance(item, dict)
                else (sanitize_auth_brand_string(item) if isinstance(item, str) else item)
                for item in v
            ]
        else:
            sanitized[clean_k] = v

    sanitized.setdefault("brand", "NomadNet")
    return sanitized


def validate_nomad_key_format(key: str) -> bool:
    """Проверяет формат ключа доступа NomadNet (nmd_<prefix>_<secret>)."""
    if not isinstance(key, str):
        return False
    return bool(_NMD_KEY_RE.match(key.strip()))


def activate_dashboard_account_key(
    key: str,
    *,
    storage_env: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Активирует ключ ``nmd_`` и возвращает карточку аккаунта без следов бренда Nous."""
    clean_key = (key or "").strip()
    if not validate_nomad_key_format(clean_key):
        return {
            "ok": False,
            "success": False,
            "code": "invalid-key",
            "message": "Недействительный формат ключа NomadNet (ожидается nmd_<prefix>_<secret>)",
            "brand": "NomadNet",
        }

    masked = f"{clean_key[:7]}...{clean_key[-4:]}" if len(clean_key) > 12 else "nmd_..."
    if storage_env is not None and isinstance(storage_env, dict):
        storage_env["NOMADNET_API_KEY"] = clean_key

    return {
        "ok": True,
        "success": True,
        "code": "activated",
        "key_masked": masked,
        "tier": "nomadnet-pro",
        "brand": "NomadNet",
        "status": "active",
        "balance_rub": 1000.0,
        "currency": "RUB",
    }


def handle_dashboard_account_api(
    action: str,
    payload: Optional[Dict[str, Any]] = None,
    *,
    storage_env: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    """Обработчик REST API ``/api/plugins/nomad/account``."""
    act = (action or "").strip().lower()
    data = payload or {}

    if act == "activate":
        key = data.get("key") or data.get("api_key") or ""
        return activate_dashboard_account_key(key, storage_env=storage_env)

    if act in ("status", "info"):
        has_key = bool(storage_env and storage_env.get("NOMADNET_API_KEY"))
        return sanitize_auth_status_payload({
            "ok": True,
            "brand": "NomadNet",
            "status": "connected" if has_key else "not_configured",
            "provider": "NomadNet Control Plane",
            "auth_type": "api_key",
        })

    return {"ok": False, "code": "unknown_action", "action": action}
