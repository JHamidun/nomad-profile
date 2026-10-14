"""Reconcile required Nomad ``config.yaml`` keys on gateway startup (task M-072, W2-02, F-11).

Зачем:

* ``hermes profile update`` сохраняет ``config.yaml`` покупателя (заменяет только с ``--force-config``,
  ``hermes_cli/profile_distribution.py:562``), поэтому новый обязательный ключ из пакета v2 сам в
  уже установленный профиль не попадёт;
* ``hermes update`` гоняет миграции конфига по каждому профилю (``_check_and_apply_config_migration``
  и ``_migrate_sibling_profile_configs``), где шаги миграции могут сбрасывать или переписывать ключи;
* если ``nomad`` выпал из ``plugins.enabled``, загрузчик ядра плагин вообще не импортирует
  (``register()`` и ``selfcheck.on_start()`` не вызываются), а шлюзовый хук ``hooks/nomad-loop``
  загружается ядром всегда.

Поэтому сверка живёт в ``package/plugins/nomad/defaults.py`` и вызывается из шлюзового хука
``hooks/nomad-loop/handler.py`` на ``gateway:startup``.

Правило границ (notes M-072):

* возвращаем ``nomad`` в ``plugins.enabled`` (если покупатель явно не внёс ``nomad`` в deny-list
  ``plugins.disabled``), не трогая другие включённые плагины;
* держим только блоки безопасности и приватности: ``model_catalog``, ``telemetry``, ``nous.guest``,
  ``auxiliary``, ``nomad.pool_mode`` (причём явный ``owner_machine`` владельца не затираем в
  ``shipped``);
* пользовательские настройки модели и провайдеров (``model``, ``custom_providers``, ``providers``,
  ``display``, ``updates`` и др.) не трогаем никогда.
"""

from __future__ import annotations

import contextlib
import copy
import logging
import os
import time
from pathlib import Path
from typing import Any, Optional

import yaml

from . import pool_mode, profile_config

logger = logging.getLogger("hermes_plugins.nomad.defaults")

PLUGIN_NAME = "nomad"
MANIFEST_FILE = "distribution.yaml"

# Разделы безопасности и приватности: ключи вне этих разделов (и вне plugins.enabled) сверка
# никогда не перезаписывает, даже если они есть в шаблоне package/config.yaml.
SECURITY_SECTIONS: tuple[str, ...] = (
    "model_catalog",
    "auxiliary",
    "nous",
    "telemetry",
    "nomad",
    "security",
    "privacy",
)

# Обязательные значения по умолчанию для блоков безопасности и приватности.
REQUIRED_DEFAULTS: dict[str, Any] = {
    "model_catalog": {
        "enabled": False,
    },
    "auxiliary": {
        "compression": {
            "provider": "deepseek",
        },
        "vision": {
            "provider": "custom",
            "base_url": "https://openrouter.ai/api/v1",
            "model": "google/gemini-3.6-flash",
            "key_env": "OPENROUTER_API_KEY",
        },
    },
    "nous": {
        "guest": False,
    },
    "telemetry": {
        "shared_metrics": {
            "enabled": False,
            "send": False,
        },
    },
    "nomad": {
        "pool_mode": pool_mode.SHIPPED,
    },
}

_BASELINE_DEFAULTS: dict[str, Any] = copy.deepcopy(REQUIRED_DEFAULTS)


def _same_value(current: Any, expected: Any) -> bool:
    """Exact equality where ``bool`` and ``int`` do not alias (``False == 0`` is True in Python)."""
    if isinstance(current, bool) != isinstance(expected, bool):
        return False
    return current == expected


def _iter_leaf_items(mapping: dict[str, Any], prefix: tuple[str, ...] = ()):
    """Yield ``(path_tuple, leaf_value)`` for every non-dict leaf in *mapping*."""
    for key, value in mapping.items():
        path = (*prefix, str(key))
        if isinstance(value, dict) and value:
            yield from _iter_leaf_items(value, path)
        else:
            yield path, value


def _get_leaf(mapping: dict[str, Any], path: tuple[str, ...]) -> tuple[bool, Any]:
    cur: Any = mapping
    for part in path:
        if not isinstance(cur, dict) or part not in cur:
            return False, None
        cur = cur[part]
    return True, cur


def _set_leaf(mapping: dict[str, Any], path: tuple[str, ...], value: Any) -> None:
    cur = mapping
    for part in path[:-1]:
        child = cur.get(part)
        if not isinstance(child, dict):
            child = {}
            cur[part] = child
        cur = child
    cur[path[-1]] = copy.deepcopy(value)


def _read_yaml_dict(path: Path) -> Optional[dict[str, Any]]:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, yaml.YAMLError):
        return None
    return data if isinstance(data, dict) else None


def _source_security_defaults(home: Path) -> dict[str, Any]:
    """Read security/privacy sections from the distribution's local source ``config.yaml`` if any.

    При ``hermes profile update`` ядро не переписывает ``<home>/config.yaml``, но обновляет
    ``<home>/distribution.yaml``. Если пакет v2 добавил обязательный ключ в свой ``config.yaml``
    внутри одного из разделов ``SECURITY_SECTIONS``, мы подхватываем его и оттуда.
    """
    manifest = _read_yaml_dict(home / MANIFEST_FILE)
    if not manifest:
        return {}
    source = str(manifest.get("source") or "").strip()
    if not source or "://" in source or source.startswith("git@"):
        return {}
    source_cfg = _read_yaml_dict(Path(source).expanduser() / "config.yaml")
    if not source_cfg:
        return {}
    extracted: dict[str, Any] = {}
    for section in SECURITY_SECTIONS:
        block = source_cfg.get(section)
        if isinstance(block, dict):
            if section == "nomad":
                # В разделе `nomad` сверяем только обязательные ключи безопасности из
                # REQUIRED_DEFAULTS["nomad"] (pool_mode), не перезаписывая пользовательские
                # списки (paid_provider_allowlist) и потолки роя (nomad.swarm.*).
                req_nomad = REQUIRED_DEFAULTS.get("nomad", {})
                filtered = {
                    k: copy.deepcopy(block[k])
                    for k in req_nomad
                    if k in block
                }
                if filtered:
                    extracted[section] = filtered
            else:
                extracted[section] = copy.deepcopy(block)
    return extracted


def effective_defaults(
    home: Optional[Path] = None,
    *,
    defaults: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Build the mapping of required security/privacy keys to reconcile for *home*."""
    if defaults is not None:
        return copy.deepcopy(defaults)
    merged = copy.deepcopy(REQUIRED_DEFAULTS)
    if home is not None:
        from_source = _source_security_defaults(home)
        for path, val in _iter_leaf_items(from_source):
            if path[0] not in SECURITY_SECTIONS:
                continue
            in_code, code_val = _get_leaf(merged, path)
            in_base, base_val = _get_leaf(_BASELINE_DEFAULTS, path)
            # Если ключ новый в config.yaml пакета v2 или изменён в config.yaml пакета v2 (а в коде
            # остался базовым), берём значение из config.yaml пакета; если ключ изменён в
            # REQUIRED_DEFAULTS кода v2 — приоритет у REQUIRED_DEFAULTS.
            if not in_code or (in_base and _same_value(code_val, base_val) and not _same_value(val, base_val)):
                _set_leaf(merged, path, val)
    return merged


def _write_config_atomically(path: Path, data: dict[str, Any]) -> None:
    """Atomically replace *path* with serialized YAML, ensuring ``st_mtime_ns`` advances so
    ``hermes_cli.config._RAW_CONFIG_CACHE`` never serves a stale pre-reconcile dict."""
    path.parent.mkdir(parents=True, exist_ok=True)
    prev_mtime_ns: Optional[int] = None
    with contextlib.suppress(OSError):
        prev_mtime_ns = path.stat().st_mtime_ns

    text = yaml.safe_dump(data, sort_keys=False, default_flow_style=False, allow_unicode=True)
    tmp = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        if prev_mtime_ns is not None:
            with contextlib.suppress(OSError):
                now_ns = max(time.time_ns(), prev_mtime_ns + 1_000_000)
                os.utime(tmp, ns=(now_ns, now_ns))
        for attempt in range(5):
            try:
                os.replace(tmp, path)
                break
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.05)
    finally:
        with contextlib.suppress(OSError):
            if tmp.exists():
                tmp.unlink()


def _reconcile_plugins_enabled(data: dict[str, Any]) -> bool:
    """Ensure ``nomad`` is in ``plugins.enabled`` unless explicitly listed in ``plugins.disabled``."""
    plugins = data.get("plugins")
    if not isinstance(plugins, dict):
        plugins = {}
    disabled = plugins.get("disabled")
    if isinstance(disabled, list) and PLUGIN_NAME in disabled:
        return False
    enabled = plugins.get("enabled")
    if isinstance(enabled, list):
        if PLUGIN_NAME in enabled:
            return False
        plugins["enabled"] = [*enabled, PLUGIN_NAME]
    else:
        plugins["enabled"] = [PLUGIN_NAME]
    data["plugins"] = plugins
    return True


def reconcile(
    config_path: Optional[Path] = None,
    *,
    defaults: Optional[dict[str, Any]] = None,
) -> list[str]:
    """Ensure ``plugins.enabled`` and all required security/privacy keys exist in ``config.yaml``.

    Returns the list of dotted key names that were restored or updated (empty if nothing changed).
    Never raises on an unreadable config: logs a warning and leaves the file untouched.
    """
    target = Path(config_path) if config_path is not None else profile_config.config_path()
    try:
        loaded = profile_config.load(target)
    except profile_config.ConfigUnreadable as exc:
        logger.warning("nomad: cannot reconcile %s (%s) — leaving config untouched", target, exc)
        return []

    data: dict[str, Any] = copy.deepcopy(loaded) if isinstance(loaded, dict) else {}
    reconciled: list[str] = []

    if _reconcile_plugins_enabled(data):
        reconciled.append("plugins.enabled")

    wanted = effective_defaults(target.parent, defaults=defaults)
    for path, expected in _iter_leaf_items(wanted):
        dotted = ".".join(path)
        present, current = _get_leaf(data, path)
        if path == ("nomad", "pool_mode") and expected == pool_mode.SHIPPED:
            # На машине владельца ставится `owner_machine`; его при старте шлюза не сбрасываем,
            # а отсутствие ключа или любое невалидное значение приводим к `shipped`.
            if present and isinstance(current, str) and current in pool_mode.MODES:
                continue
            _set_leaf(data, path, pool_mode.SHIPPED)
            reconciled.append(dotted)
            continue

        if present and _same_value(current, expected):
            continue
        _set_leaf(data, path, expected)
        reconciled.append(dotted)

    if not reconciled:
        return []

    try:
        _write_config_atomically(target, data)
    except OSError as exc:
        logger.warning("nomad: failed to write reconciled config %s (%s)", target, exc)
        return []

    logger.info(
        "nomad: reconciled config.yaml required keys (%d): %s",
        len(reconciled),
        ", ".join(reconciled),
    )
    return reconciled


reconcile_config = reconcile
