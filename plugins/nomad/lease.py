"""Аренда карточки Kanban у внешнего исполнителя (задача N24, спека §2.4).

Зачем это вообще нужно. Карточку, которую ведёт внешний исполнитель (Claude Code, Codex,
tool-шаг), ядро Hermes не спавнило — значит у неё нет ``worker_pid``, и апстрим не продлит
её claim сам: ``release_stale_claims`` продлевает только host-локальный claim с живым pid.
Через TTL (15 минут по умолчанию) ближайший тик диспетчера отбирает карточку, она уходит в
``ready``, дирижёр запускает её ВТОРОЙ раз рядом с живым процессом, а reclaim книжится как
отказ: при ``failure_limit = 2`` карточка через ~30 минут блокируется сама.

Четыре правила, которые реализует модуль:

1. claim берётся из процесса дирижёра с claimer'ом ``<host>:nomad-<lane>``. Префикс
   ``<host>:`` обязателен (без него апстрим считает claim чужим), а хвост привязан к ДОРОЖКЕ,
   не к pid — чтобы тот же claimer продолжал аренду после перезапуска gateway.
2. Петля продления зовёт ``heartbeat_claim`` тем же claimer'ом не реже чем раз в TTL/3 и
   вместе с ним ``heartbeat_worker``. Первый двигает ``claim_expires``; второй — только
   ``last_heartbeat_at``, но без него карточку снимет детектор «нет пульса»
   (``detect_stale_running``: по умолчанию 4 ч работы и час без пульса).
3. TTL передаётся явно из конфигурации; скрытого значения по умолчанию нет. Модуль
   сам говорит, с каким TTL работает (:meth:`LeaseKeeper.describe`).
4. После перезапуска дирижёра :meth:`LeaseKeeper.reacquire` заново берёт аренду на живые
   внешние карточки под тем же claimer'ом.

Весь доступ к ядру — через настоящие функции доски Kanban, и только через адаптер ядра
(``core_adapter.kanban``, задача M-157); база не переизобретается. Единственный приватный
символ ядра здесь — ``kanban_db._host_prefix`` (тот же префикс, с которым сверяется
``release_stale_claims``); он спрятан за ``kanban.host_prefix()`` и записан с заменой в
docs/core-symbols.md.
"""

from __future__ import annotations

import enum
import logging
import os
import re
import threading
import time
from collections.abc import Callable, Mapping
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Any

if __package__:
    from . import core_adapter as _core
else:  # одиночный файл без пакета (так грузит tests/test_lease.py) — адаптер лежит рядом
    import importlib.util as _importlib_util

    _spec = _importlib_util.spec_from_file_location(
        "nomad_lease_core_adapter", Path(__file__).with_name("core_adapter.py"))
    _core = _importlib_util.module_from_spec(_spec)
    _spec.loader.exec_module(_core)

# Доска Kanban — только через адаптер ядра. Три прежних имени указывают на неё же: ими вызовы
# ниже читаются как раньше (claim/get — _kb, соединение — _kbc, пульс — _kbd), и по ним
# tests/test_lease.py подменяет функции доски (mock.patch.object(lease._kbd, ...)).
_kb = _kbc = _kbd = _core.kanban

__all__ = [
    "CLAIMER_TAG",
    "ClaimerError",
    "Lease",
    "LeaseConfig",
    "LeaseConfigError",
    "LeaseError",
    "LeaseKeeper",
    "Outcome",
    "claimer_for_lane",
    "host_prefix",
    "validate_claimer",
]

log = logging.getLogger("nomad.lease")

# Все claimer'ы Nomad начинаются с этого тега после host-префикса: по нему сверка при
# старте отличает нашу аренду от чужой, а запасной режим получает «nomad-conduct-<lane>».
CLAIMER_TAG = "nomad-"

# Минимальный TTL: claim_expires в апстриме считается в ЦЕЛЫХ секундах, и при TTL < 3
# округление съедает весь запас между продлениями (TTL/3 < 1 с).
MIN_TTL_SECONDS = 3

_LANE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


class LeaseError(RuntimeError):
    """Базовая ошибка модуля аренды."""


class LeaseConfigError(LeaseError, ValueError):
    """Неверная конфигурация аренды: TTL, интервал продления, дорожка."""


class ClaimerError(LeaseConfigError):
    """claimer, который апстрим не продлит или не переживёт перезапуск gateway."""


class Outcome(str, enum.Enum):
    """Итог продления или повторного взятия аренды по одной карточке."""

    RENEWED = "renewed"  # claim продлён под нашим claimer'ом
    RETAKEN = "retaken"  # (reacquire) карточка уже вернулась в ready — взяли снова, новый run
    LOST = "lost"  # карточка больше не наша: завершена, заблокирована, чужой claim, удалена
    ERROR = "error"  # временный сбой — аренда сохранена, повтор в следующем цикле


@dataclass(frozen=True)
class LeaseConfig:
    """TTL аренды и интервал продления. Значения только явные — из конфига стенда."""

    ttl_seconds: int
    renew_interval_seconds: float

    def __post_init__(self) -> None:
        ttl = self.ttl_seconds
        if isinstance(ttl, bool) or not isinstance(ttl, int) or ttl < MIN_TTL_SECONDS:
            raise LeaseConfigError(
                f"claim_ttl_seconds must be an integer >= {MIN_TTL_SECONDS}, got {ttl!r}"
            )
        interval = self.renew_interval_seconds
        if isinstance(interval, bool) or not isinstance(interval, (int, float)) or interval <= 0:
            raise LeaseConfigError(f"renew_interval_seconds must be > 0, got {interval!r}")
        # Правило 2: чаще чем раз в TTL/3. Реже — один пропущенный цикл (занятая база,
        # пауза процесса) уже роняет аренду.
        if interval > ttl / 3:
            raise LeaseConfigError(
                f"renew_interval_seconds={interval} exceeds TTL/3={ttl / 3:g} (ttl={ttl})"
            )

    @classmethod
    def from_mapping(cls, cfg: Mapping[str, Any]) -> LeaseConfig:
        """Читает секцию конфига: ``claim_ttl_seconds`` обязателен, без запасного значения.

        ``renew_interval_seconds`` необязателен и тогда выводится как TTL/3 — это не
        скрытое умолчание, а само правило 2, посчитанное от явно заданного TTL.
        """
        if "claim_ttl_seconds" not in cfg:
            raise LeaseConfigError(
                "claim_ttl_seconds is required in the lease config (no hidden default: "
                "spec §2.4 rule 3)"
            )
        raw_ttl = cfg["claim_ttl_seconds"]
        # Целое число или строка из цифр (значение из окружения). 900.5 и True — ошибка,
        # а не «округлим»: TTL задаётся осознанно.
        if isinstance(raw_ttl, int) and not isinstance(raw_ttl, bool):
            ttl = raw_ttl
        elif isinstance(raw_ttl, str) and raw_ttl.strip().isdigit():
            ttl = int(raw_ttl.strip())
        else:
            raise LeaseConfigError(f"claim_ttl_seconds is not an integer: {raw_ttl!r}")
        raw_interval = cfg.get("renew_interval_seconds")
        if raw_interval is None:
            interval = ttl / 3
        else:
            try:
                interval = float(raw_interval)
            except (TypeError, ValueError) as exc:
                raise LeaseConfigError(
                    f"renew_interval_seconds is not a number: {raw_interval!r}"
                ) from exc
        return cls(ttl_seconds=ttl, renew_interval_seconds=interval)


def host_prefix() -> str:
    """``"<host>:"`` — ровно тот префикс, с которым апстрим сверяет «наш ли это claim»."""
    return _kb.host_prefix()


def _check_lane(lane: str) -> str:
    if not isinstance(lane, str) or not _LANE_RE.match(lane):
        raise LeaseConfigError(
            f"lane must match {_LANE_RE.pattern} (it becomes part of the claim lock), got {lane!r}"
        )
    return lane


def claimer_for_lane(lane: str) -> str:
    """claimer дорожки: ``<host>:nomad-<lane>``. Не зависит от pid — переживает рестарт."""
    return f"{host_prefix()}{CLAIMER_TAG}{_check_lane(lane)}"


def validate_claimer(claimer: str) -> str:
    """Возвращает claimer без изменений или бросает :class:`ClaimerError`.

    Отказ, а не молчаливое исправление: апстрим такой claim примет, но НЕ продлит —
    поломка всплыла бы только через TTL на живом рое, в виде двойного запуска.
    """
    prefix = host_prefix()
    if not isinstance(claimer, str) or not claimer.startswith(prefix):
        raise ClaimerError(
            f"claimer {claimer!r} must start with this host's prefix {prefix!r}: upstream "
            "treats any other lock as foreign and never extends it"
        )
    suffix = claimer[len(prefix):]
    if suffix.isdigit():
        raise ClaimerError(
            f"claimer {claimer!r} is pid-bound (host:pid); after a gateway restart the pid "
            "changes and the lease can no longer be renewed — bind it to a lane"
        )
    if not suffix.startswith(CLAIMER_TAG) or not _LANE_RE.match(suffix[len(CLAIMER_TAG):]):
        raise ClaimerError(
            f"claimer {claimer!r} must look like {prefix}{CLAIMER_TAG}<lane> so the startup "
            "reconciliation can tell Nomad leases from foreign ones"
        )
    return claimer


@dataclass(frozen=True)
class Lease:
    """Аренда одной карточки, которую держит этот keeper."""

    task_id: str
    lane: str
    claimer: str
    run_id: int | None
    claim_expires: int | None
    renewed_at: float  # time.time() последнего успешного продления или взятия


class LeaseKeeper:
    """Держит аренду внешних карточек: берёт claim, продлевает в фоне, подхватывает после рестарта.

    Каждая операция с базой открывает своё соединение: sqlite-соединение привязано к
    потоку, а продление идёт в фоновом потоке, параллельно с вызовами дирижёра.
    """

    def __init__(
        self,
        config: LeaseConfig,
        *,
        db_path: Path | str | None = None,
        board: str | None = None,
        on_lost: Callable[[Lease, str], None] | None = None,
    ) -> None:
        if not isinstance(config, LeaseConfig):
            raise LeaseConfigError("config must be a LeaseConfig (use LeaseConfig.from_mapping)")
        self._config = config
        self._db_path = Path(db_path) if db_path is not None else None
        self._board = board
        self._on_lost = on_lost
        self._leases: dict[str, Lease] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    # --- что keeper говорит о себе -------------------------------------------------

    @property
    def ttl_seconds(self) -> int:
        return self._config.ttl_seconds

    @property
    def renew_interval_seconds(self) -> float:
        return self._config.renew_interval_seconds

    def describe(self) -> dict[str, Any]:
        """Строка для журнала при старте: с каким TTL и каким шагом работает аренда.

        ``env_ttl_seconds`` показан рядом, потому что апстрим берёт TTL из окружения там,
        где мы его не передаём (claim диспетчера, продление живого host-pid).
        """
        return {
            "ttl_seconds": self._config.ttl_seconds,
            "renew_interval_seconds": self._config.renew_interval_seconds,
            "env_ttl_seconds": os.environ.get("HERMES_KANBAN_CLAIM_TTL_SECONDS"),
            "host_prefix": host_prefix(),
            "running": self.running,
            "held": len(self.held()),
        }

    def held(self) -> list[Lease]:
        with self._lock:
            return list(self._leases.values())

    @property
    def running(self) -> bool:
        return self._thread is not None and self._thread.is_alive()

    # --- работа с карточками ---------------------------------------------------

    def claim(self, task_id: str, lane: str, *, claimer: str | None = None) -> Lease | None:
        """Забрать ``ready``-карточку под claimer дорожки. None — карточку забрал кто-то другой.

        ``claimer`` задаётся явно только в особых режимах (запасной: ``nomad-conduct-<lane>``)
        и проходит ту же проверку, что и выведенный из дорожки.
        """
        _check_lane(lane)
        lock = validate_claimer(claimer) if claimer is not None else claimer_for_lane(lane)
        with self._connect() as conn:
            task = _kb.claim_task(conn, task_id, ttl_seconds=self.ttl_seconds, claimer=lock)
            if task is None:
                return None
            # Пульс сразу: last_heartbeat_at с первой секунды, а не с первого продления.
            _kbd.heartbeat_worker(conn, task_id, expected_run_id=task.current_run_id,
                                  note=f"nomad lease: claimed by {lock}")
        lease = Lease(task_id=task_id, lane=lane, claimer=lock, run_id=task.current_run_id,
                      claim_expires=task.claim_expires, renewed_at=time.time())
        with self._lock:
            self._leases[task_id] = lease
        log.info("lease claimed task=%s claimer=%s ttl=%ss", task_id, lock, self.ttl_seconds)
        return lease

    def release(self, task_id: str) -> Lease | None:
        """Перестать продлевать (исполнитель закончил, дирижёр закрыл карточку). База не трогается."""
        with self._lock:
            return self._leases.pop(task_id, None)

    def renew_once(self) -> dict[str, Outcome]:
        """Один проход продления по всем удерживаемым карточкам."""
        outcomes: dict[str, Outcome] = {}
        leases = self.held()
        if not leases:
            return outcomes
        lost: list[tuple[Lease, str]] = []
        with self._connect() as conn:
            for lease in leases:
                try:
                    outcome, reason = self._renew_one(conn, lease)
                except Exception:  # временный сбой базы не должен ронять аренду
                    log.exception("lease renew failed task=%s claimer=%s", lease.task_id,
                                  lease.claimer)
                    outcome, reason = Outcome.ERROR, ""
                outcomes[lease.task_id] = outcome
                if outcome is Outcome.LOST:
                    with self._lock:
                        # release() мог уже снять карточку — тогда это не потеря, а конец.
                        still_held = self._leases.pop(lease.task_id, None) is not None
                    if still_held:
                        lost.append((lease, reason))
        for lease, reason in lost:
            self._notify_lost(lease, reason)
        return outcomes

    def reacquire(self, cards: Mapping[str, str]) -> dict[str, Outcome]:
        """После рестарта дирижёра: заново взять аренду на живые внешние карточки.

        ``cards`` — ``{task_id: lane}`` тех карточек, чей исполнитель по сверке жив.
        Карточка ``running`` под нашим claimer'ом продлевается (тот же run). Карточка,
        которая пока дирижёра не было успела вернуться в ``ready``, берётся заново — иначе
        дирижёр запустил бы рядом с живым исполнителем второй. Чужой claim не трогаем.
        """
        outcomes: dict[str, Outcome] = {}
        with self._connect() as conn:
            for task_id, lane in cards.items():
                lock = claimer_for_lane(lane)
                try:
                    outcomes[task_id] = self._reacquire_one(conn, task_id, lane, lock)
                except Exception:
                    log.exception("lease reacquire failed task=%s claimer=%s", task_id, lock)
                    outcomes[task_id] = Outcome.ERROR
        log.info("lease reacquire: %s", {k: v.value for k, v in outcomes.items()})
        return outcomes

    # --- фоновое продление -----------------------------------------------------

    def start(self) -> None:
        """Запустить фоновую петлю продления (идемпотентно)."""
        if self.running:
            return
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, name="nomad-lease-keeper",
                                        daemon=True)
        self._thread.start()
        log.info("lease keeper started %s", self.describe())

    def stop(self, timeout: float = 10.0) -> bool:
        """Остановить петлю. True — поток завершился и больше ничего не пишет в базу."""
        self._stop.set()
        thread = self._thread
        if thread is None:
            return True
        thread.join(timeout)
        stopped = not thread.is_alive()
        if stopped:
            self._thread = None
        else:
            log.warning("lease keeper did not stop within %.1fs", timeout)
        return stopped

    def __enter__(self) -> LeaseKeeper:
        self.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.stop()

    # --- внутреннее ------------------------------------------------------------

    def _connect(self):
        return _kbc.connect_closing(db_path=self._db_path, board=self._board)

    def _loop(self) -> None:
        interval = self._config.renew_interval_seconds
        next_at = time.monotonic() + interval
        # Расписание по дедлайнам, а не sleep(interval) после работы: длинный проход
        # продления не должен растягивать шаг сверх TTL/3.
        while not self._stop.wait(max(0.0, next_at - time.monotonic())):
            try:
                self.renew_once()
            except Exception:
                log.exception("lease renew pass failed")
            next_at += interval
            now = time.monotonic()
            if next_at < now:  # процесс проспал несколько шагов — продлить сразу, без догонялок
                next_at = now

    def _renew_one(self, conn, lease: Lease) -> tuple[Outcome, str]:
        ok = _kb.heartbeat_claim(conn, lease.task_id, ttl_seconds=self.ttl_seconds,
                                 claimer=lease.claimer)
        if not ok:
            task = _kb.get_task(conn, lease.task_id)
            reason = "missing" if task is None else f"{task.status}:{task.claim_lock}"
            return Outcome.LOST, reason
        task = _kb.get_task(conn, lease.task_id)
        run_id = task.current_run_id if task is not None else lease.run_id
        if run_id != lease.run_id:
            # Тот же claimer, но другой run: второй keeper на той же дорожке. Пульс шлём
            # в действующий run, но кричим — это ошибка сборки дирижёра.
            log.warning("lease run changed under the same claimer task=%s run %s -> %s",
                        lease.task_id, lease.run_id, run_id)
        _kbd.heartbeat_worker(conn, lease.task_id, expected_run_id=run_id)
        self._store(replace(lease, run_id=run_id,
                            claim_expires=task.claim_expires if task else lease.claim_expires,
                            renewed_at=time.time()))
        return Outcome.RENEWED, ""

    def _reacquire_one(self, conn, task_id: str, lane: str, lock: str) -> Outcome:
        task = _kb.get_task(conn, task_id)
        if task is None:
            return Outcome.LOST
        if task.status == "running" and task.claim_lock == lock:
            lease = Lease(task_id=task_id, lane=lane, claimer=lock, run_id=task.current_run_id,
                          claim_expires=task.claim_expires, renewed_at=time.time())
            outcome, _ = self._renew_one(conn, lease)
            return outcome
        if task.status == "ready" and task.claim_lock is None:
            claimed = _kb.claim_task(conn, task_id, ttl_seconds=self.ttl_seconds, claimer=lock)
            if claimed is None:
                return Outcome.LOST
            _kbd.heartbeat_worker(conn, task_id, expected_run_id=claimed.current_run_id,
                                  note=f"nomad lease: retaken by {lock} after restart")
            self._store(Lease(task_id=task_id, lane=lane, claimer=lock,
                              run_id=claimed.current_run_id,
                              claim_expires=claimed.claim_expires, renewed_at=time.time()))
            log.warning("lease retaken task=%s: it was reclaimed while the conductor was down",
                        task_id)
            return Outcome.RETAKEN
        return Outcome.LOST

    def _store(self, lease: Lease) -> None:
        with self._lock:
            self._leases[lease.task_id] = lease

    def _notify_lost(self, lease: Lease, reason: str) -> None:
        log.warning("lease lost task=%s claimer=%s now=%s", lease.task_id, lease.claimer, reason)
        if self._on_lost is None:
            return
        try:
            self._on_lost(lease, reason)
        except Exception:
            log.exception("lease on_lost callback failed task=%s", lease.task_id)
