"""М-129 (UI-BE7): Запись глобальных ключей конфига из ``plugin_api``.

Разрешённый белый список глобальных ключей (ровно три):
  1. ``fallback_providers`` — цепочка резервных провайдеров (список строк или словарей ``{"provider": ..., "model": ...}``);
  2. ``approvals.deny`` — список glob-шаблонов команд терминала, блокируемых даже под ``--yolo``;
  3. ``command_allowlist`` — список разрешённых шаблонов команд терминала, выполняемых без запроса подтверждения.

Инварианты безопасности и надёжности:
  * Любой ключ вне белого списка из трёх жёстко отклоняется (``DisallowedConfigKeyError`` / HTTP 400).
  * Запись выполняется транзакционно через ``core_adapter.save_config`` под блокировкой ``_WRITE_LOCK``
    со снятием побайтового снимка ``config.yaml`` до записи и проверкой результата на диске после записи.
    При любом сбое записи или проверки файл ``config.yaml`` восстанавливается байт-в-байт.
  * При включённом режиме ``nomad.ru_only`` (из ``config.yaml`` или ``NOMAD_RU_ONLY``) любой
    зарубежный провайдер в ``fallback_providers`` отклоняется до записи на диск
    (``RuOnlyConfigError`` / HTTP 403), а ``ru_only.audit_hermes_config`` остаётся пустым (``[]``).
"""

from __future__ import annotations

from collections.abc import Mapping
import copy
import logging
import os
from pathlib import Path
import tempfile
import threading
from typing import Any

from fastapi import APIRouter, Body, HTTPException
import yaml

from . import core_adapter, profile_config, ru_only

logger = logging.getLogger("hermes_plugins.nomad.ui_config")

ALLOWED_GLOBAL_CONFIG_KEYS: tuple[str, str, str] = (
    "fallback_providers",
    "approvals.deny",
    "command_allowlist",
)
ALLOWED_GLOBAL_CONFIG_KEY_SET: frozenset[str] = frozenset(ALLOWED_GLOBAL_CONFIG_KEYS)

CODE_DISALLOWED_KEY = "disallowed-key"
CODE_INVALID_VALUE = "invalid-value"
CODE_RU_ONLY_VIOLATION = "ru-only-violation"
CODE_SAVE_FAILED = "save-failed"

_WRITE_LOCK = threading.Lock()

router = APIRouter(tags=["nomad-config"])


class DisallowedConfigKeyError(ValueError):
    """Попытка чтения или записи ключа вне белого списка ``ALLOWED_GLOBAL_CONFIG_KEYS``."""

    code = CODE_DISALLOWED_KEY

    def __init__(self, key: str):
        self.key = key
        super().__init__(
            f"Ключ {key!r} не входит в белый список глобальных ключей конфига "
            f"({', '.join(ALLOWED_GLOBAL_CONFIG_KEYS)})."
        )


class InvalidConfigValueError(ValueError):
    """Значение разрешённого ключа не соответствует ожидаемой схеме."""

    code = CODE_INVALID_VALUE

    def __init__(self, key: str, detail: str):
        self.key = key
        self.detail = detail
        super().__init__(f"Некорректное значение для {key!r}: {detail}")


class RuOnlyConfigError(PermissionError):
    """Попытка записать зарубежного провайдера в ``fallback_providers`` при включённом ``nomad.ru_only``."""

    code = CODE_RU_ONLY_VIOLATION

    def __init__(self, violations: list[str]):
        self.violations = list(violations)
        joined = "; ".join(self.violations)
        super().__init__(
            f"Запись отклонена режимом «Только РФ» (nomad.ru_only): {joined}"
        )


class ConfigSaveFailedError(RuntimeError):
    """Сбой сохранения ``config.yaml``; исходный файл на диске восстановлен байт-в-байт."""

    code = CODE_SAVE_FAILED


def _read_bytes(path: Path) -> bytes | None:
    try:
        return path.read_bytes()
    except FileNotFoundError:
        return None


def _restore_bytes(path: Path, data: bytes | None) -> None:
    """Атомарно возвращает точное побайтовое содержимое *path* (или удаляет файл, если его не было)."""
    if data is None:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=".nomad-uiconfig-restore-", suffix=".tmp")
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


def _validate_Allowed_Key(key: Any) -> str:
    if not isinstance(key, str):
        raise DisallowedConfigKeyError(repr(key))
    cleaned = key.strip()
    if cleaned not in ALLOWED_GLOBAL_CONFIG_KEY_SET:
        raise DisallowedConfigKeyError(key)
    return cleaned


def _validate_string_list(key: str, value: Any) -> list[str]:
    if not isinstance(value, list):
        raise InvalidConfigValueError(
            key,
            f"ожидается список строк (list[str]), получено {type(value).__name__}",
        )
    out: list[str] = []
    for idx, item in enumerate(value):
        if not isinstance(item, str):
            raise InvalidConfigValueError(
                key,
                f"элемент [{idx}] должен быть строкой, получено {type(item).__name__}",
            )
        stripped = item.strip()
        if not stripped:
            raise InvalidConfigValueError(
                key,
                f"элемент [{idx}] не может быть пустой строкой",
            )
        out.append(stripped)
    return out


def _validate_fallback_providers(value: Any) -> list[Any]:
    if not isinstance(value, list):
        raise InvalidConfigValueError(
            "fallback_providers",
            f"ожидается список (list), получено {type(value).__name__}",
        )
    normalized: list[Any] = []
    for idx, entry in enumerate(value):
        if isinstance(entry, str):
            provider = entry.strip()
            if not provider:
                raise InvalidConfigValueError(
                    "fallback_providers",
                    f"элемент [{idx}] не может быть пустой строкой",
                )
            normalized.append(provider)
        elif isinstance(entry, Mapping):
            provider_raw = entry.get("provider")
            if not isinstance(provider_raw, str) or not provider_raw.strip():
                raise InvalidConfigValueError(
                    "fallback_providers",
                    f"элемент [{idx}] должен содержать непустое строковое поле 'provider'",
                )
            item_dict: dict[str, Any] = dict(entry)
            item_dict["provider"] = provider_raw.strip()
            for opt_str_field in ("model", "base_url", "api", "key_env", "api_key"):
                if opt_str_field in item_dict and item_dict[opt_str_field] is not None:
                    if not isinstance(item_dict[opt_str_field], str):
                        raise InvalidConfigValueError(
                            "fallback_providers",
                            f"поле {opt_str_field!r} элемента [{idx}] должно быть строкой",
                        )
                    item_dict[opt_str_field] = item_dict[opt_str_field].strip()
            normalized.append(item_dict)
        else:
            raise InvalidConfigValueError(
                "fallback_providers",
                f"элемент [{idx}] должен быть строкой или словарём, получено {type(entry).__name__}",
            )
    return normalized


def _validate_key_value(key: str, value: Any) -> tuple[str, Any]:
    canonical_key = _validate_Allowed_Key(key)
    if canonical_key == "fallback_providers":
        return canonical_key, _validate_fallback_providers(value)
    if canonical_key in ("approvals.deny", "command_allowlist"):
        return canonical_key, _validate_string_list(canonical_key, value)
    raise DisallowedConfigKeyError(key)


def _normalize_updates_mapping(updates: Any) -> dict[str, Any]:
    """Приводит словарь обновлений к каноническим ключам из белого списка (отклоняя любые посторонние)."""
    if not isinstance(updates, Mapping) or not updates:
        raise InvalidConfigValueError(
            "config",
            "ожидается непустой словарь обновляемых ключей",
        )
    normalized: dict[str, Any] = {}
    for raw_key, raw_val in updates.items():
        if not isinstance(raw_key, str):
            raise DisallowedConfigKeyError(repr(raw_key))
        # Поддержка вложенной записи `{"approvals": {"deny": [...]}}` только если внутри ровно `deny`.
        if raw_key == "approvals" and isinstance(raw_val, Mapping):
            extra_subkeys = [k for k in raw_val.keys() if k != "deny"]
            if extra_subkeys or "deny" not in raw_val:
                bad_subkey = f"approvals.{extra_subkeys[0]}" if extra_subkeys else "approvals"
                raise DisallowedConfigKeyError(bad_subkey)
            k, v = _validate_key_value("approvals.deny", raw_val["deny"])
            normalized[k] = v
            continue
        k, v = _validate_key_value(raw_key, raw_val)
        normalized[k] = v
    return normalized


def _extract_key_from_config(cfg: Mapping[str, Any], key: str) -> Any:
    canonical = _validate_Allowed_Key(key)
    if canonical == "fallback_providers":
        val = cfg.get("fallback_providers")
        return copy.deepcopy(val) if isinstance(val, list) else []
    if canonical == "command_allowlist":
        val = cfg.get("command_allowlist")
        return copy.deepcopy(val) if isinstance(val, list) else []
    if canonical == "approvals.deny":
        approvals = cfg.get("approvals")
        if isinstance(approvals, Mapping):
            deny = approvals.get("deny")
            if isinstance(deny, list):
                return copy.deepcopy(deny)
        return []
    raise DisallowedConfigKeyError(key)


def _apply_updates_to_config_dict(cfg: dict[str, Any], updates: Mapping[str, Any]) -> dict[str, Any]:
    updated = copy.deepcopy(cfg)
    for key, value in updates.items():
        if key == "fallback_providers":
            updated["fallback_providers"] = copy.deepcopy(value)
        elif key == "command_allowlist":
            updated["command_allowlist"] = copy.deepcopy(value)
        elif key == "approvals.deny":
            approvals = updated.get("approvals")
            approvals_dict = dict(approvals) if isinstance(approvals, Mapping) else {}
            approvals_dict["deny"] = copy.deepcopy(value)
            updated["approvals"] = approvals_dict
        else:
            raise DisallowedConfigKeyError(key)
    return updated


def _check_ru_only_compliance(
    config_path: Path,
    current_cfg: Mapping[str, Any],
    candidate_cfg: Mapping[str, Any],
    updates: Mapping[str, Any],
) -> None:
    """Проверяет соблюдение контура ``nomad.ru_only`` перед сохранением ``fallback_providers``."""
    mode = ru_only.resolve_ru_only(config_path)
    if not mode.enabled:
        nomad_sec = current_cfg.get(ru_only.CONFIG_SECTION)
        if isinstance(nomad_sec, Mapping) and nomad_sec.get(ru_only.CONFIG_KEY) is True:
            mode = ru_only.RuOnly(True, "config", True)
    if not mode.enabled:
        return

    if "fallback_providers" not in updates:
        return

    fallback_entries = updates["fallback_providers"]
    providers_section = candidate_cfg.get("providers")
    providers_map = providers_section if isinstance(providers_section, Mapping) else {}

    violations: list[str] = []
    for idx, entry in enumerate(fallback_entries):
        target = ru_only._entry_target(entry, f"fallback_providers[{idx}]", providers_map)
        if target is None:
            violations.append(
                f"fallback_providers[{idx}]: {ru_only.REASON_UNKNOWN} (provider={entry!r})"
            )
            continue
        reason, host = ru_only.classify(target)
        if reason is not None:
            violations.append(
                f"fallback_providers[{idx}]: {reason} (provider={target.provider!r}, host={host!r})"
            )

    # Также проверяем через штатный аудитор ru_only.audit_hermes_config, что в fallback_providers нет нарушений.
    audit_issues = [
        issue
        for issue in ru_only.audit_hermes_config(candidate_cfg)
        if issue.startswith("fallback_providers")
    ]
    for issue in audit_issues:
        if issue not in violations:
            violations.append(issue)

    if violations:
        logger.warning(
            "nomad.ui_config: запись fallback_providers отклонена под nomad.ru_only (%s): %s",
            mode.source,
            violations,
        )
        raise RuOnlyConfigError(violations)


def _verify_saved_on_disk(config_path: Path, updates: Mapping[str, Any]) -> None:
    """Убеждается, что записанные значения реально попали в ``config.yaml`` и читаются ``load_config``."""
    if not config_path.is_file():
        raise ConfigSaveFailedError("config.yaml отсутствует на диске после save_config")
    try:
        raw_text = config_path.read_text(encoding="utf-8")
        raw_data = yaml.safe_load(raw_text)
    except Exception as exc:  # noqa: BLE001
        raise ConfigSaveFailedError(f"config.yaml не читается после записи: {exc}") from exc

    if raw_data is None:
        raw_data = {}
    if not isinstance(raw_data, Mapping):
        raise ConfigSaveFailedError("config.yaml на диске не является YAML-словарём")

    loaded_cfg = core_adapter.load_config()
    for key, expected in updates.items():
        actual_loaded = _extract_key_from_config(loaded_cfg, key)
        actual_raw = _extract_key_from_config(raw_data, key)
        if actual_loaded != expected or actual_raw != expected:
            raise ConfigSaveFailedError(
                f"Значение ключа {key!r} не сохранилось на диске "
                f"(ожидалось {expected!r}, в файле {actual_raw!r})"
            )
        # Если записан непустой список, ключ обязан явно присутствовать в сыром YAML.
        if expected:
            if key == "approvals.deny":
                approvals_raw = raw_data.get("approvals")
                if not isinstance(approvals_raw, Mapping) or "deny" not in approvals_raw:
                    raise ConfigSaveFailedError("Ключ 'approvals.deny' отсутствует в config.yaml после записи")
            elif key not in raw_data:
                raise ConfigSaveFailedError(f"Ключ {key!r} отсутствует в config.yaml после записи")


def get_global_config() -> dict[str, Any]:
    """Возвращает текущие значения трёх разрешённых глобальных ключей и статус ``ru_only``."""
    config_path = Path(core_adapter.get_config_path())
    cfg = core_adapter.load_config()
    ru_mode = ru_only.resolve_ru_only(config_path)
    return {
        "ok": True,
        "fallback_providers": _extract_key_from_config(cfg, "fallback_providers"),
        "approvals.deny": _extract_key_from_config(cfg, "approvals.deny"),
        "approvals": {"deny": _extract_key_from_config(cfg, "approvals.deny")},
        "command_allowlist": _extract_key_from_config(cfg, "command_allowlist"),
        "allowed_keys": list(ALLOWED_GLOBAL_CONFIG_KEYS),
        "ru_only": ru_mode.enabled,
    }


def get_global_config_key(key: str) -> Any:
    """Возвращает текущее значение одного из трёх глобальных ключей конфига."""
    canonical = _validate_Allowed_Key(key)
    cfg = core_adapter.load_config()
    return _extract_key_from_config(cfg, canonical)


def update_global_config(
    updates: Mapping[str, Any],
    *,
    raise_on_error: bool = False,
) -> dict[str, Any]:
    """Транзакционно записывает разрешённые глобальные ключи в ``config.yaml`` активного профиля.

    По умолчанию возвращает JSON-совместимый словарь ``{"ok": bool, "code": ..., ...}``
    (как ``activation.connect``). При ``raise_on_error=True`` выбрасывает типизированное исключение.
    В обоих режимах при любом сбое записи ``config.yaml`` восстанавливается байт-в-байт.
    """
    try:
        normalized_updates = _normalize_updates_mapping(updates)
    except (DisallowedConfigKeyError, InvalidConfigValueError) as exc:
        if raise_on_error:
            raise
        return {
            "ok": False,
            "code": exc.code,
            "message": str(exc),
        }

    with _WRITE_LOCK:
        config_path = Path(core_adapter.get_config_path())
        saved_bytes = _read_bytes(config_path)
        try:
            try:
                raw_existing = profile_config.load(config_path)
            except profile_config.ConfigUnreadable as exc:
                raise ConfigSaveFailedError(f"Исходный config.yaml повреждён: {exc}") from exc

            loaded_existing = core_adapter.load_config()
            base_cfg: dict[str, Any] = (
                copy.deepcopy(raw_existing)
                if isinstance(raw_existing, dict)
                else copy.deepcopy(loaded_existing)
            )
            candidate_cfg = _apply_updates_to_config_dict(base_cfg, normalized_updates)

            # Проверка контура «Только РФ» выполняется ДО обращения к диску.
            _check_ru_only_compliance(config_path, base_cfg, candidate_cfg, normalized_updates)

            # Применяем обновления к полному конфигу для core_adapter.save_config.
            save_payload = _apply_updates_to_config_dict(
                copy.deepcopy(loaded_existing), normalized_updates
            )
            # Если в raw_existing были собственные ключи (например, шаблоны ${VAR} или секции ru_only),
            # переносим их поверх, чтобы save_config ничего не потерял.
            for raw_k, raw_v in base_cfg.items():
                if raw_k not in ("fallback_providers", "command_allowlist", "approvals"):
                    save_payload[raw_k] = copy.deepcopy(raw_v)
                elif raw_k == "approvals" and isinstance(raw_v, Mapping):
                    merged_approvals = dict(raw_v)
                    if "approvals.deny" in normalized_updates:
                        merged_approvals["deny"] = copy.deepcopy(normalized_updates["approvals.deny"])
                    save_payload["approvals"] = merged_approvals

            core_adapter.save_config(save_payload)
            _verify_saved_on_disk(config_path, normalized_updates)
        except RuOnlyConfigError as exc:
            _restore_bytes(config_path, saved_bytes)
            if raise_on_error:
                raise
            return {
                "ok": False,
                "code": exc.code,
                "message": str(exc),
                "violations": list(exc.violations),
            }
        except BaseException as exc:
            _restore_bytes(config_path, saved_bytes)
            if isinstance(exc, (DisallowedConfigKeyError, InvalidConfigValueError)):
                if raise_on_error:
                    raise
                return {
                    "ok": False,
                    "code": exc.code,
                    "message": str(exc),
                }
            logger.exception("nomad.ui_config: сбой записи глобальных ключей конфига, выполнен откат")
            if raise_on_error:
                if isinstance(exc, ConfigSaveFailedError):
                    raise
                raise ConfigSaveFailedError(f"Не удалось сохранить config.yaml: {exc}") from exc
            return {
                "ok": False,
                "code": CODE_SAVE_FAILED,
                "message": f"Не удалось сохранить config.yaml; файл восстановлен без изменений ({exc}).",
            }

    state = get_global_config()
    state["updated_keys"] = list(normalized_updates.keys())
    state["code"] = None
    return state


def set_global_config_key(
    key: str,
    value: Any,
    *,
    raise_on_error: bool = False,
) -> dict[str, Any]:
    """Записывает один глобальный ключ из белого списка (``fallback_providers``, ``approvals.deny``, ``command_allowlist``)."""
    try:
        canonical = _validate_Allowed_Key(key)
    except DisallowedConfigKeyError as exc:
        if raise_on_error:
            raise
        return {
            "ok": False,
            "code": exc.code,
            "message": str(exc),
        }
    return update_global_config({canonical: value}, raise_on_error=raise_on_error)


def _raise_http_for_result(result: Mapping[str, Any]) -> None:
    if result.get("ok"):
        return
    code = result.get("code")
    detail = {
        "ok": False,
        "code": code,
        "message": result.get("message") or "Ошибка обновления конфига",
        "violations": result.get("violations", []),
    }
    if code == CODE_RU_ONLY_VIOLATION:
        raise HTTPException(status_code=403, detail=detail)
    if code in (CODE_DISALLOWED_KEY, CODE_INVALID_VALUE):
        raise HTTPException(status_code=400, detail=detail)
    raise HTTPException(status_code=500, detail=detail)


def _parse_config_write_body(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, Mapping):
        raise InvalidConfigValueError("body", "тело запроса должно быть JSON-объектом")
    if "key" in payload and "value" in payload and len(payload) == 2:
        k, v = _validate_key_value(payload["key"], payload["value"])
        return {k: v}
    if "updates" in payload and isinstance(payload["updates"], Mapping) and len(payload) == 1:
        return _normalize_updates_mapping(payload["updates"])
    return _normalize_updates_mapping(payload)


@router.get("/config")
def api_get_config() -> dict[str, Any]:
    """Возвращает значения трёх разрешённых глобальных ключей конфига."""
    return get_global_config()


@router.get("/config/{key:path}")
def api_get_config_key(key: str) -> dict[str, Any]:
    """Возвращает значение одного разрешённого глобального ключа конфига."""
    try:
        canonical = _validate_Allowed_Key(key)
        value = get_global_config_key(canonical)
    except DisallowedConfigKeyError as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "code": exc.code, "message": str(exc)},
        ) from exc
    return {"ok": True, "key": canonical, "value": value}


@router.put("/config")
@router.post("/config")
@router.patch("/config")
def api_update_config(payload: Any = Body(...)) -> dict[str, Any]:
    """Обновляет один или несколько глобальных ключей из белого списка."""
    try:
        updates = _parse_config_write_body(payload)
    except (DisallowedConfigKeyError, InvalidConfigValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail={"ok": False, "code": exc.code, "message": str(exc)},
        ) from exc
    result = update_global_config(updates, raise_on_error=False)
    _raise_http_for_result(result)
    return result


@router.put("/config/{key:path}")
def api_set_config_key(key: str, payload: Any = Body(...)) -> dict[str, Any]:
    """Записывает один глобальный ключ по пути ``/config/{key}``."""
    if isinstance(payload, Mapping) and "value" in payload and len(payload) == 1:
        value = payload["value"]
    else:
        value = payload
    result = set_global_config_key(key, value, raise_on_error=False)
    _raise_http_for_result(result)
    return result
