"""N26 — delivery-mode flag ``nomad.pool_mode`` and the single gate for account pooling.

Два значения:

* ``owner_machine`` — машина владельца: дирижёр может запускать дорожки, которые берут учётки из
  пула подписок, и писать файлы учётных данных для них;
* ``shipped`` — проданная сборка: ни того, ни другого. **Это значение по умолчанию.**

Почему по умолчанию именно ``shipped``: ошибка в эту сторону стоит покупателю одной недоступной
функции, а ошибка в обратную — чужие учётки владельца в чужой сборке. Поэтому всё, что не является
ровно строкой ``owner_machine`` (ключа нет, конфиг не читается, опечатка, ``true``), читается как
``shipped``.

Ключ живёт в ``config.yaml`` профиля верхнего уровня (``nomad:`` → ``pool_mode:``). Ядро такие ключи
допускает («Custom top-level keys are supported», ``hermes config set nomad.pool_mode …``), но
``ctx.get_config`` плагина видит только ``plugins.entries.<id>.settings``, а дирижёр запускается из
шлюзового хука без ``ctx`` вообще. Поэтому файл читается напрямую, каждый раз заново: переключение
режима действует без перезапуска, и тест «переключил → отказ» проверяет именно это.

Единственная дверь — ``require_pool_access()``. Всё в плагине, что стартует дорожку из пула или
пишет файл учётных данных, обязано пройти через неё; запись файла учётных данных вне её не делается
вообще (см. ``write_credential_file``).
"""

from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional, Union

from . import profile_config

logger = logging.getLogger("hermes_plugins.nomad.pool_mode")

OWNER_MACHINE = "owner_machine"
SHIPPED = "shipped"
MODES = (OWNER_MACHINE, SHIPPED)
DEFAULT_MODE = SHIPPED

CONFIG_SECTION = "nomad"
CONFIG_KEY = "pool_mode"

ACTION_POOLED_LANE = "start_pooled_lane"
ACTION_CREDENTIAL_WRITE = "write_credential_file"
ACTIONS = (ACTION_POOLED_LANE, ACTION_CREDENTIAL_WRITE)

# Именованная причина отказа — её ищут в логах и в событиях базы, поэтому это константа, а не текст.
REASON_SHIPPED_BUILD = "pool_mode_shipped_forbids_account_pool"

# Откуда взялся режим: config — явное значение из файла; default — ключа нет; invalid — значение
# есть, но не из MODES; unreadable — файл не читается или не разбирается как YAML.
SOURCES = ("config", "default", "invalid", "unreadable")


@dataclass(frozen=True)
class PoolMode:
    mode: str
    source: str
    raw: Any = None

    @property
    def allows_pooling(self) -> bool:
        return self.mode == OWNER_MACHINE


class PoolModeRefused(PermissionError):
    """Raised by the gate when the build is not allowed to touch the account pool."""

    def __init__(self, *, action: str, subject: str, pool_mode: PoolMode):
        self.action = action
        self.subject = subject
        self.pool_mode = pool_mode
        self.reason = REASON_SHIPPED_BUILD
        super().__init__(
            f"{action} refused: reason={self.reason} "
            f"(nomad.pool_mode={pool_mode.mode}, source={pool_mode.source}, subject={subject!r})")


def resolve_pool_mode(config_path: Optional[Path] = None) -> PoolMode:
    """Read ``nomad.pool_mode`` from the active profile's config.yaml. Never raises."""
    try:
        data = profile_config.load(config_path)
    except profile_config.ConfigUnreadable as exc:
        logger.warning("nomad: %s — pool_mode=%s", exc, DEFAULT_MODE)
        return PoolMode(DEFAULT_MODE, "unreadable")
    if data is None:
        return PoolMode(DEFAULT_MODE, "default")
    section = data.get(CONFIG_SECTION)
    if not isinstance(section, dict) or CONFIG_KEY not in section:
        return PoolMode(DEFAULT_MODE, "default")
    raw = section[CONFIG_KEY]
    if isinstance(raw, str) and raw in MODES:
        return PoolMode(raw, "config", raw)
    logger.warning("nomad: nomad.pool_mode=%r is not one of %s — treated as %s",
                   raw, "/".join(MODES), DEFAULT_MODE)
    return PoolMode(DEFAULT_MODE, "invalid", raw)


def require_pool_access(action: str, subject: str = "", *,
                        config_path: Optional[Path] = None) -> PoolMode:
    """THE gate: call before starting a pooled lane or writing a credential file.

    Returns the resolved mode when pooling is allowed. Otherwise logs the refusal with the named
    reason and raises ``PoolModeRefused`` — the caller must not proceed.
    """
    if action not in ACTIONS:
        # Неизвестное действие — ошибка программиста; молча пропустить его значило бы открыть дверь.
        raise ValueError(f"unknown pool action {action!r}; expected one of {ACTIONS}")
    mode = resolve_pool_mode(config_path)
    if mode.allows_pooling:
        logger.info("nomad: pool access allowed action=%s subject=%s pool_mode=%s",
                    action, subject, mode.mode)
        return mode
    logger.warning("nomad: REFUSED action=%s subject=%s reason=%s pool_mode=%s source=%s",
                   action, subject, REASON_SHIPPED_BUILD, mode.mode, mode.source)
    raise PoolModeRefused(action=action, subject=subject, pool_mode=mode)


def write_credential_file(path: Union[str, Path], data: Union[str, bytes], *,
                          config_path: Optional[Path] = None) -> Path:
    """The only sanctioned way for Nomad to write a credential file.

    Сначала дверь, потом диск: в ``shipped`` файл не создаётся вовсе, даже пустой. Запись атомарная
    (временный файл рядом + ``os.replace``), права 0600 там, где ОС их понимает.
    """
    target = Path(path)
    require_pool_access(ACTION_CREDENTIAL_WRITE, str(target), config_path=config_path)
    payload = data.encode("utf-8") if isinstance(data, str) else bytes(data)
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp_name = tempfile.mkstemp(prefix=f".{target.name}.", dir=str(target.parent))
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(payload)
        os.chmod(tmp_name, 0o600)
        os.replace(tmp_name, target)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return target
