"""Raw read of the active profile's ``config.yaml`` for the switches Nomad needs outside ``ctx``.

Зачем свой чтец, а не ``ctx.get_config``: тот видит только ``plugins.entries.<id>.settings``, а
Nomad нужны ключи вне этого поддерева (``nomad.pool_mode``, ``plugins.enabled``), и читает их код,
у которого ``ctx`` нет вовсе, — шлюзовый хук. Файл читается каждый раз заново: переключение
через ``hermes config set`` / ``hermes plugins enable`` действует без перезапуска.

Путь к профилю — ``hermes_constants.get_hermes_home()``: так его велят брать документы ядра
(developer-guide: contributing, memory-provider-plugin «Profile Isolation»). Берётся через адаптер
ядра (``core_adapter.get_hermes_home``, M-157).
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import yaml

from . import core_adapter


class ConfigUnreadable(RuntimeError):
    """config.yaml exists but cannot be read or parsed. Callers decide how to fail closed."""

    def __init__(self, message: str, *, path: Optional[Path] = None, error: Optional[object] = None):
        super().__init__(message)
        self.path = path
        self.error = str(error) if error is not None else message
        self.reason = self.error


def config_path() -> Path:
    return core_adapter.get_hermes_home() / "config.yaml"


def load(path: Optional[Path] = None) -> Optional[dict]:
    """Parsed mapping, ``None`` when the file does not exist; ``ConfigUnreadable`` otherwise."""
    target = path if path is not None else config_path()
    try:
        text = target.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except (OSError, UnicodeError) as exc:
        raise ConfigUnreadable(f"{target}: {exc}", path=target, error=exc) from exc
    try:
        data = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ConfigUnreadable(f"{target}: not valid YAML ({exc})", path=target, error=exc) from exc
    if data is not None and not isinstance(data, dict):
        err = f"expected YAML mapping at root, got {type(data).__name__}"
        raise ConfigUnreadable(f"{target}: {err}", path=target, error=err)
    return data if isinstance(data, dict) else {}


def load_strict(path: Optional[Path] = None) -> dict:
    """Strict reader for fail-closed callers (conductor tick): returns mapping or raises ``ConfigUnreadable``."""
    data = load(path)
    return data if data is not None else {}
