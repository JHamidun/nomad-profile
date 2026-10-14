"""Core adapter: the ONE module of the Nomad plugin that touches Hermes core (task M-157, N25).

Зачем. «Ноль патчей ядра» ещё не значит «ноль зависимостей от ядра»: плагин зовёт функции
``hermes_cli``, ``plugins``, ``hermes_constants``, а внутренние пути ядра уже переезжали
(декомпозиция сентября 2026, COMPAT_MANIFEST.md апстрима: «Internal import paths are not a stable
API»). Поэтому весь доступ к ядру собран здесь:

* остальные модули плагина импортируют ядро только отсюда — это держит гейт
  ``python tools/ci_checks.py core-adapter`` (``tools/check_core_adapter.py``);
* каждый символ ядра, на который ссылается этот файл, записан в ``docs/core-symbols.md``: где
  живёт, публичный или приватный, документирован ли, сигнатура на закреплённом коммите и чем его
  заменить, если он уйдёт; строка без ссылки или ссылка без строки — гейт красный;
* ``tests/test_core_adapter_contract.py`` сверяет таблицу с настоящим апстримом (символ определён
  там, где записан, сигнатура та же) и гоняет каждую функцию на настоящем ядре; робот гоняет его на
  каждом новом теге (M-158). Смена ядра ломает один тест и правится в одном файле.

Два правила внутри файла:

1. **Импорт ядра — внутри функции, в момент вызова.** Пакет плагина импортируют хук шлюза и
   загрузчик ядра, и импорт должен оставаться дешёвым; кроме того, функция ядра берётся заново при
   каждом вызове, поэтому подмена атрибута модуля ядра (``monkeypatch`` в тестах) действует.
   Импорт под ``try/except ImportError`` допустим: гейт видит все привязки имени, и ``k = None``
   в ветке отказа не прячет ``k._x`` от таблицы.
2. **Только статические ссылки** ``модуль.имя``: без ``getattr`` по переменной, без импорта по
   строке (``importlib.import_module``, ``__import__``, ``sys.modules[…]`` — даже литералом, даже
   через псевдоним) и без ``exec``/``eval`` — такие ссылки гейт с таблицей сверить не может и
   краснеет.
"""

from __future__ import annotations

import sqlite3
from contextlib import AbstractContextManager
from pathlib import Path
from typing import Any, Optional

__all__ = [
    "KanbanBoard",
    "deactivate_provider",
    "get_config_path",
    "get_env_path",
    "get_env_value",
    "get_hermes_home",
    "invalidate_env_cache",
    "kanban",
    "load_config",
    "load_env",
    "plugin_data_dir",
    "plugin_db",
    "save_config",
    "save_env_value",
]


# ---------------------------------------------------------------------------
# Профиль и хранилище плагина (документированные пути)
# ---------------------------------------------------------------------------

def get_hermes_home() -> Path:
    """Home of the ACTIVE profile; follows ``HERMES_HOME`` and the gateway's profile scope."""
    from hermes_constants import get_hermes_home as core_get_hermes_home

    return core_get_hermes_home()


def plugin_data_dir(name: str) -> Path:
    """``<hermes home>/plugin-data/<name>/`` of the active profile (created on demand)."""
    from plugins import plugin_storage

    return plugin_storage.plugin_data_dir(name)


def plugin_db(name: str) -> sqlite3.Connection:
    """The plugin's own SQLite file ``<plugin data dir>/data.db`` (WAL, caller owns transactions)."""
    from plugins import plugin_storage

    return plugin_storage.plugin_db(name)


# ---------------------------------------------------------------------------
# Конфиг и .env профиля
# ---------------------------------------------------------------------------

def load_config() -> dict:
    """Merged ``config.yaml`` of the active profile, ``${VAR}`` references expanded."""
    from hermes_cli import config as core_config

    return core_config.load_config()


def save_config(config: dict) -> None:
    """Write ``config.yaml`` the way ``hermes config set`` does (may silently refuse: managed)."""
    from hermes_cli import config as core_config

    core_config.save_config(config)


def get_config_path() -> Path:
    from hermes_cli import config as core_config

    return core_config.get_config_path()


def get_env_value(key: str) -> Optional[str]:
    """Process environment within the profile scope first, then the profile's ``.env``."""
    from hermes_cli import config as core_config

    return core_config.get_env_value(key)


def save_env_value(key: str, value: str) -> None:
    """Write one ``KEY=value`` into the profile's ``.env`` and publish it to ``os.environ``."""
    from hermes_cli import config as core_config

    core_config.save_env_value(key, value)


def load_env() -> dict:
    from hermes_cli import config as core_config

    return core_config.load_env()


def get_env_path() -> Path:
    from hermes_cli import config as core_config

    return core_config.get_env_path()


def invalidate_env_cache() -> None:
    from hermes_cli import config as core_config

    core_config.invalidate_env_cache()


def deactivate_provider() -> None:
    """Clear the active OAuth provider of the profile (credentials stay)."""
    from hermes_cli import auth as core_auth

    core_auth.deactivate_provider()


# ---------------------------------------------------------------------------
# Доска Kanban
# ---------------------------------------------------------------------------

class KanbanBoard:
    """The part of the Kanban board the conductor uses: claim, renew, beat, read.

    Один объект :data:`kanban` на модуль, а не набор свободных функций: так вызов читается как
    вызов доски, а тест подменяет одну функцию доски (``mock.patch.object(kanban, …)``), не трогая
    ядро. Функции берут соединение первым аргументом — как в ядре: открывает его
    :meth:`connect_closing`.
    """

    @staticmethod
    def connect_closing(db_path: Path | str | None = None, *,
                        board: Optional[str] = None) -> AbstractContextManager:
        """Context manager: a connection to the board (default: the active board), closed on exit."""
        from hermes_cli import kanban_db_connect as core_connect

        return core_connect.connect_closing(Path(db_path) if db_path is not None else None,
                                            board=board)

    @staticmethod
    def claim_task(conn: sqlite3.Connection, task_id: str, *, ttl_seconds: int,
                   claimer: str) -> Any:
        """Take a ``ready`` card under *claimer*; ``None`` when someone else got it."""
        from hermes_cli import kanban_db as core_kanban

        return core_kanban.claim_task(conn, task_id, ttl_seconds=ttl_seconds, claimer=claimer)

    @staticmethod
    def heartbeat_claim(conn: sqlite3.Connection, task_id: str, *, ttl_seconds: int,
                        claimer: str) -> bool:
        """Move ``claim_expires`` forward; ``False`` when the claim is no longer *claimer*'s."""
        from hermes_cli import kanban_db as core_kanban

        return core_kanban.heartbeat_claim(conn, task_id, ttl_seconds=ttl_seconds,
                                           claimer=claimer)

    @staticmethod
    def heartbeat_worker(conn: sqlite3.Connection, task_id: str, *,
                         expected_run_id: Optional[int] = None,
                         note: Optional[str] = None) -> bool:
        """Record worker liveness (``last_heartbeat_at``) on the current run."""
        from hermes_cli import kanban_db_dispatch as core_dispatch

        return core_dispatch.heartbeat_worker(conn, task_id, note=note,
                                              expected_run_id=expected_run_id)

    @staticmethod
    def get_task(conn: sqlite3.Connection, task_id: str) -> Any:
        """The card, or ``None`` when there is no such id."""
        from hermes_cli import kanban_db as core_kanban

        return core_kanban.get_task(conn, task_id)

    @staticmethod
    def host_prefix() -> str:
        """``"<host>:"`` — the prefix upstream compares claim locks with to call them host-local.

        Единственный приватный символ ядра в плагине. Берётся у ядра, а не считается здесь: именно
        с ним сверяется ``release_stale_claims``. Замена и её проверка — в docs/core-symbols.md.
        """
        from hermes_cli import kanban_db as core_kanban

        return core_kanban._host_prefix()


kanban = KanbanBoard()
