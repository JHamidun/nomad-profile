"""Start-up self-check of the Nomad plugin (task M-071): package sync, retired paths, core contract.

Зовётся первой строкой ``register()`` — то есть в каждом процессе, который грузит плагины: в шлюзе
(``discover_plugins`` на старте идёт ДО загрузки шлюзовых хуков, поэтому обновлённый
``hooks/nomad-loop`` грузится уже в этом же старте), в агенте, в ``hermes nomad …``. На встроенных
подкомандах ядра (``hermes update``, ``hermes profile …``) плагины не грузятся — самопроверки там нет.

Три шага, в этом порядке. Каждый отказывает мягко: причина — строка в журнале (``logs/agent.log``,
от WARNING и в ``errors.log``), а регистрация инструментов идёт дальше. Плагин, который из-за
самопроверки не загрузился, хуже плагина, который работает и честно пишет, что с ним не так.

1. **Синхронизация профиля из дерева.** Установщик ставит профиль из папки в дереве кода
   (``hermes profile install <папка> --name nomad``); ``hermes update`` меняет эту папку, но не профиль.
   На старте плагин сверяет поставляемые пути папки с отметкой прошлой синхронизации
   (``plugin-data/nomad/package-sync.json``): сперва по размеру и времени изменения файлов, и только
   если они сдвинулись — по содержимому. Если содержимое другое, делается то же, что ``hermes profile
   update``: ``distribution_owned`` переносится с теми же правилами — корень внутри каталога верхнего
   уровня заменяется целиком, корни покупателя рядом живут, ``config.yaml`` покупателя не трогается,
   пользовательские пути ядра не трогаются никогда (и в другом регистре тоже), ``.env.EXAMPLE``
   пишется из ``env_requires``, если его нет, ссылка (симлинк или junction) в профиле — отказ до
   первой записи, — и ``distribution.yaml`` переписывается с прежними ``name``/``source`` и свежим
   ``installed_at``.
   В отличие от ядра перенос транзакционный: новые корни сперва целиком копируются рядом
   (``plugin-data/nomad/sync/<pid>``), потом каждый встаёт на место переименованием, а прежний
   отходит в сторону. Если хоть одно переименование не удалось (файл держит антивирус, индексатор,
   другой процесс — на Windows переименовать его нельзя), всё уже переставленное возвращается, и
   профиль остаётся прежним целиком; отметка не сдвигается — следующий старт повторяет. Иначе
   ``rmtree`` + ``copytree`` мог оставить от ``plugins/nomad`` половину без ``plugin.yaml`` — а такой
   плагин ядро уже не находит, и самопроверка, которая починила бы его, больше не запускается.
   Совпадение с ядром проверяет ``tests/test_selfcheck.py`` на близнеце профиля, обновлённом самим
   ``hermes profile update``. Импортировать ``hermes_cli.profile_distribution`` отсюда нельзя (гейт
   core-adapter), а звать её через адаптер незачем: она ищет профиль по имени среди профилей, а не
   берёт активный, и тянет подтверждение с превью.
   Источник — только локальная папка: git-источник обновляет ``hermes profile update`` по сети, на
   старте сеть не трогаем. Пакет, которому нужно ядро новее текущего, не переносится (ядро при
   ``profile update`` отказывает так же). Одновременные старты: файл-замок, опоздавший не ждёт.
2. **Снятые пути.** Перенос заменяет только то, что пакет поставляет сейчас; корень, который пакет
   перестал возить, остаётся в профиле. ``nomad-retired.yaml`` (приезжает с пакетом в корень профиля)
   перечисляет такие пути, и самопроверка удаляет их — кроме путей, которые не удаляются никогда
   (см. :func:`retired_entry_problem` и :func:`retire_paths`).
3. **Ядро против ``contract.yaml``** — после переноса, то есть против контракта, с которым плагин
   будет работать: первый старт после ``hermes update`` сверяет уже новый контракт, а не прежний.
   Ниже ``hermes.requires`` — ERROR (загрузчик ядра такой плагин обычно даже не импортирует: та же
   граница стоит в ``requires_hermes`` манифеста). Вне ``hermes.verified`` — WARNING «режим
   совместимости» с версией, диапазоном и коммитом проверки.

Ограничение, которое не лечится здесь: процесс, в котором прошла синхронизация, уже исполнил старый
``__init__.py``; модули плагина, импортируемые позже, придут из обновлённых файлов. Поэтому
``__init__.py`` держится тонким (только регистрация), а полностью новый код работает со следующего
старта.
"""

from __future__ import annotations

import contextlib
import functools
import hashlib
import importlib.metadata
import json
import logging
import os
import re
import shutil
import stat
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any, Iterator, Optional

import yaml

logger = logging.getLogger("hermes_plugins.nomad.selfcheck")

PLUGIN_NAME = "nomad"
PLUGIN_DIR = Path(__file__).resolve().parent
CONTRACT_FILE = "contract.yaml"
MANIFEST_FILE = "distribution.yaml"
RETIRED_FILE = "nomad-retired.yaml"
STAMP_FILE = "package-sync.json"
LOCK_FILE = "package-sync.lock"
STAGING_DIR = "sync"
STALE_LOCK_SECONDS = 600
ENV_TEMPLATE_FILE = ".env.template"
ENV_EXAMPLE_FILE = ".env.EXAMPLE"

# Копия hermes_cli.profile_distribution.USER_OWNED_EXCLUDE на закреплённом коммите: пути, которые не
# входят в поставку никогда. Импортировать нельзя (гейт core-adapter); равенство с ядром сверяет
# tests/test_selfcheck.py::test_user_owned_names_mirror_the_core_list на каждом теге.
USER_OWNED_EXCLUDE = frozenset({
    "auth.json", ".env",
    "state.db", "state.db-shm", "state.db-wal",
    "hermes_state.db", "response_store.db",
    "response_store.db-shm", "response_store.db-wal",
    "gateway.pid", "gateway_state.json", "processes.json",
    "auth.lock", "active_profile", ".update_check",
    "errors.log", ".hermes_history",
    "memories", "sessions", "logs", "plans", "workspace", "home",
    "image_cache", "audio_cache", "document_cache",
    "browser_screenshots", "checkpoints", "sandboxes",
    "backups", "cache",
    "hermes-agent", ".worktrees", "profiles", "bin", "node_modules",
    ".hermes-runtime", "installs", "node", "source-checks", "tools",
    "local",
})

# Первый сегмент пути, который nomad-retired.yaml не удалит ни при каком содержимом: данные
# покупателя, его конфиг, запись об установке, сам список и база плагина.
NEVER_RETIRED = USER_OWNED_EXCLUDE | {"config.yaml", MANIFEST_FILE, RETIRED_FILE, "plugin-data"}


def _name_key(segment: str) -> str:
    """How a case-insensitive file system (Windows, macOS) matches a name: ``Auth.json.`` is
    ``auth.json`` there — Windows also drops a trailing dot or space of every segment."""
    return segment.rstrip(" .").casefold()


_USER_OWNED_KEYS = frozenset(_name_key(n) for n in USER_OWNED_EXCLUDE)
_NEVER_RETIRED_KEYS = frozenset(_name_key(n) for n in NEVER_RETIRED)

_MOUNT_POINT = getattr(stat, "IO_REPARSE_TAG_MOUNT_POINT", 0xA0000003)


def _is_link_stat(st: os.stat_result) -> bool:
    return stat.S_ISLNK(st.st_mode) or getattr(st, "st_reparse_tag", 0) == _MOUNT_POINT


def _is_link(path: Path) -> bool:
    """A symlink or a Windows directory junction. ``Path.is_symlink()`` does not see a junction
    (Python < 3.12), and a junction needs no privilege — it is how a Windows user usually points a
    folder elsewhere. Neither is followed; both are removed as a link, never through it."""
    try:
        return _is_link_stat(os.lstat(path))
    except OSError:
        return False


# ---------------------------------------------------------------------------
# Версия ядра против contract.yaml
# ---------------------------------------------------------------------------

_COMPARATOR_RE = re.compile(r"^\s*(>=|<=|==|!=|>|<)\s*(.+?)\s*$")


def _version_tuple(value: Any) -> Optional[tuple]:
    """``v1.2.3-rc1`` -> ``(1, 2, 3)``; ``None`` when a segment is not a number (as the core loader)."""
    parts = re.split(r"[-+]", str(value).strip().lstrip("v"), maxsplit=1)[0].split(".")
    parts += ["0"] * (3 - len(parts))
    try:
        return tuple(int(x) for x in parts[:3])
    except ValueError:
        return None


def version_satisfies(spec: str, current: str) -> bool:
    """The core loader's ``requires_hermes`` rule: comma = AND, bare version = ``>=``, unparseable = pass."""
    cur = _version_tuple(current)
    if cur is None:
        return True
    ops = {">=": cur.__ge__, "<=": cur.__le__, "==": cur.__eq__, "!=": cur.__ne__,
           ">": cur.__gt__, "<": cur.__lt__}
    for clause in filter(None, (c.strip() for c in str(spec).split(","))):
        match = _COMPARATOR_RE.match(clause)
        op, target = (match.group(1), match.group(2)) if match else (">=", clause)
        wanted = _version_tuple(target)
        if wanted is not None and not ops[op](wanted):
            return False
    return True


@functools.lru_cache(maxsize=1)
def running_hermes_version() -> Optional[str]:
    """Version of the installed ``hermes-agent`` distribution — what the core loader compares with.

    В 0.21.6+ апстрим держит в pyproject.toml заглушку ``0.0.0``, а настоящую версию ядра берёт из
    ``install-stamp.json`` или тегов ``v<semver>`` чекаута (``hermes_cli/version_info.py``). Поиск
    идёт один раз на процесс, без прямого импорта ``hermes_cli`` (гейт core-adapter)."""
    try:
        dist = importlib.metadata.distribution("hermes-agent")
        ver = (dist.version or "").strip()
        if ver and ver != "0.0.0":
            return ver
        candidates: list[Path] = []
        raw_url = dist.read_text("direct_url.json")
        if raw_url:
            url = str(json.loads(raw_url).get("url") or "")
            if url.startswith("file://"):
                from urllib.parse import unquote, urlparse
                from urllib.request import url2pathname

                candidates.append(Path(url2pathname(unquote(urlparse(url).path))))
        candidates.append(Path(dist.locate_file("")).resolve())
        for repo in candidates:
            stamp = repo / "install-stamp.json"
            if stamp.is_file():
                base = str(json.loads(stamp.read_text(encoding="utf-8-sig")).get("baseVersion") or "")
                if _version_tuple(base) is not None and base != "0.0.0":
                    return base
            if (repo / ".git").exists():
                import subprocess

                out = subprocess.run(
                    ["git", "tag", "--merged", "HEAD", "--list", "v[0-9]*"],
                    cwd=repo, capture_output=True, text=True, encoding="utf-8",
                    errors="replace", timeout=3, check=False,
                )
                tags = [
                    t.strip()[1:] for t in (out.stdout or "").splitlines()
                    if re.fullmatch(r"v\d+\.\d+\.\d+", t.strip())
                ]
                if tags:
                    return max(tags, key=lambda v: tuple(int(p) for p in v.split(".")))
        return ver or None
    except Exception:
        return None


def load_contract(plugin_dir: Path = PLUGIN_DIR) -> dict:
    data = yaml.safe_load((plugin_dir / CONTRACT_FILE).read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("hermes"), dict):
        raise ValueError(f"{CONTRACT_FILE} must be a mapping with a 'hermes' section")
    return data


def check_core_version(contract: dict, current: Optional[str]) -> list[str]:
    """Compare the running core with the contract; every problem is logged and returned."""
    hermes = contract.get("hermes") or {}
    requires = str(hermes.get("requires") or "").strip()
    verified = str(hermes.get("verified") or "").strip()
    verified_on = str(hermes.get("verified_on") or "")[:10] or "?"
    if not requires or not verified:
        message = (f"nomad selfcheck: {CONTRACT_FILE} has no hermes.requires / hermes.verified — "
                   "the core version is not checked")
        logger.warning(message)
        return [message]
    if current is None or _version_tuple(current) is None:
        message = (f"nomad selfcheck: cannot determine the Hermes core version ({current!r}); "
                   f"{CONTRACT_FILE} requires {requires!r}, verified {verified!r} — running unchecked")
        logger.warning(message)
        return [message]
    if not version_satisfies(requires, current):
        message = (f"nomad selfcheck: Hermes {current} is below the floor {requires!r} of "
                   f"{CONTRACT_FILE} — this core is not supported, update Hermes")
        logger.error(message)
        return [message]
    if not version_satisfies(verified, current):
        message = (f"nomad selfcheck: Hermes {current} is outside the range {verified!r} verified in "
                   f"{CONTRACT_FILE} (on {verified_on}) — compatibility mode: the plugin keeps "
                   "working, but this core was not tested with it")
        logger.warning(message)
        return [message]
    logger.debug("nomad selfcheck: Hermes %s within %r of %s", current, verified, CONTRACT_FILE)
    return []


# ---------------------------------------------------------------------------
# Синхронизация профиля из дерева
# ---------------------------------------------------------------------------

@dataclass
class SyncResult:
    # not-a-distribution | no-source | remote-source | missing-source | refused | busy |
    # up-to-date | synced | failed (nothing changed, the next start retries)
    status: str
    source: str = ""
    copied: list[str] = field(default_factory=list)
    reason: str = ""


class _Refused(Exception):
    pass


class _SwapFailed(Exception):
    def __init__(self, rel: str, error: BaseException, stuck: list[str]):
        super().__init__(rel)
        self.rel, self.error, self.stuck = rel, error, stuck


def _read_mapping(path: Path) -> Optional[dict]:
    if not path.is_file():
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def _looks_like_git_url(source: str) -> bool:
    # Как profile_distribution._looks_like_git_url: любой URL и git-адрес — удалённый источник.
    source = source.strip()
    return (source.endswith(".git")
            or source.startswith(("git@", "ssh://", "git://", "http://", "https://"))
            or bool(re.match(r"^github\.com/[\w.-]+/[\w.-]+/?$", source)))


def _local_source(home: Path) -> Optional[Path]:
    """The package tree the profile was installed from, when it is a local directory."""
    try:
        installed = _read_mapping(home / MANIFEST_FILE)
    except Exception:
        return None
    source = str((installed or {}).get("source") or "").strip()
    if not source or _looks_like_git_url(source):
        return None
    tree = Path(source).expanduser()
    return tree if (tree / MANIFEST_FILE).is_file() else None


Stats = dict[tuple[str, ...], os.stat_result]


def _scan_tree(tree: Path) -> tuple[Optional[Path], Stats]:
    """One walk of the whole tree, links not followed: the first symlink or junction (``None`` if
    there is none) and ``lstat`` of every entry, by its path under the tree.

    Ядро (``_reject_distribution_symlinks``) отказывает дереву с симлинком; junction оно не видит и
    скопировало бы сквозь него чужой каталог — здесь отказ и на junction. На Windows ``scandir``
    отдаёт тип ссылки, размер и время из того же ответа каталога: один вызов на каталог, не на файл.
    """
    stats: Stats = {}
    pending: list[tuple[tuple[str, ...], Path]] = [((), tree)]
    while pending:
        sub, path = pending.pop()
        with os.scandir(path) as it:
            for entry in it:
                st = entry.stat(follow_symlinks=False)
                if _is_link_stat(st):
                    return Path(entry.path), stats
                stats[sub + (entry.name,)] = st
                if stat.S_ISDIR(st.st_mode):
                    pending.append((sub + (entry.name,), Path(entry.path)))
    return None, stats


def _owned_entries(tree: Path, owned: list[str], stats: Optional[Stats] = None
                   ) -> Iterator[tuple[Path, tuple[str, ...]]]:
    # Как profile_distribution._owned_entries для явного списка: пользовательское, «..» и
    # абсолютное пропускаются, отсутствующее в дереве — тоже. Строже ядра в одном: пользовательский
    # путь в другом регистре («Memories») на Windows и macOS — тот же каталог покупателя.
    for rel in owned:
        parts = PurePosixPath(rel).parts
        if not parts or _name_key(parts[0]) in _USER_OWNED_KEYS:
            continue
        if ".." in parts or PurePosixPath(rel).is_absolute():
            continue
        path = tree.joinpath(*parts)
        if (stats is not None and parts in stats) or path.exists():
            yield path, parts


def _walk(root: Path) -> Iterator[tuple[tuple[str, ...], os.stat_result]]:
    """``(sub-path, lstat)`` of *root* and everything below it, in a stable order."""
    top = os.lstat(root)
    yield (), top
    pending = [((), root)] if stat.S_ISDIR(top.st_mode) else []
    while pending:
        sub, path = pending.pop()
        with os.scandir(path) as it:
            children = sorted(it, key=lambda e: e.name)
        for entry in children:
            st = entry.stat(follow_symlinks=False)
            yield sub + (entry.name,), st
            if stat.S_ISDIR(st.st_mode):
                pending.append((sub + (entry.name,), Path(entry.path)))


def _stat_fingerprint(entries: list[tuple[Path, tuple[str, ...]]], stats: Stats) -> str:
    """Names, sizes and modification times of the shipped paths — no file is read.

    Каждый старт обходится этим: чтение и sha256 всех поставляемых файлов стоило секунду и росло с
    каждым навыком. Содержимое сверяется, только когда размер или время сдвинулись. Данные — из
    обхода :func:`_scan_tree`; корень, записанный в манифесте не тем регистром, что на диске,
    обходится отдельно."""
    digest = hashlib.sha256()
    for path, parts in sorted(entries, key=lambda e: e[1]):
        if parts in stats:
            depth = len(parts)
            walked = sorted((key[depth:], st) for key, st in stats.items() if key[:depth] == parts)
        else:
            walked = sorted(_walk(path))
        for sub, st in walked:
            rel = "/".join(parts + sub)
            if stat.S_ISDIR(st.st_mode):
                digest.update(f"D {rel}\n".encode("utf-8"))
            else:
                digest.update(f"F {rel} {st.st_size} {st.st_mtime_ns}\n".encode("utf-8"))
    return digest.hexdigest()


def _hash_file_entry(args: tuple[str, Path]) -> str:
    rel, item = args
    file_hash = hashlib.sha256()
    with item.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            file_hash.update(chunk)
    return f"F {rel} {file_hash.hexdigest()}\n"


def _content_fingerprint(entries: list[tuple[Path, tuple[str, ...]]]) -> str:
    from concurrent.futures import ThreadPoolExecutor

    lines: list[Optional[str]] = []
    file_tasks: list[tuple[int, str, Path]] = []
    for path, parts in sorted(entries, key=lambda e: e[1]):
        if path.is_file():
            rel = "/".join(parts)
            file_tasks.append((len(lines), rel, path))
            lines.append(None)
        else:
            walked = [(path.joinpath(*sub), sub, stat.S_ISDIR(st.st_mode))
                      for sub, st in _walk(path) if sub]
            walked.sort(key=lambda x: x[0])
            for item, sub, is_dir in walked:
                rel = "/".join(parts + sub)
                if is_dir:
                    lines.append(f"D {rel}\n")
                else:
                    file_tasks.append((len(lines), rel, item))
                    lines.append(None)
    if file_tasks:
        with ThreadPoolExecutor(max_workers=16) as pool:
            for (idx, _, _), hashed_line in zip(
                file_tasks,
                pool.map(_hash_file_entry, [(rel, item) for _, rel, item in file_tasks]),
            ):
                lines[idx] = hashed_line
    digest = hashlib.sha256()
    for line in lines:
        if line is not None:
            digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def _remove(path: Path) -> None:
    """Remove one entry; a symlink or junction is unlinked, never followed."""
    if _is_link(path) or not path.is_dir():
        if os.path.lexists(path):
            path.unlink()  # os.unlink снимает и junction, и симлинк на каталог, не трогая цель
    else:
        shutil.rmtree(path)


def _is_container(path: Path) -> bool:
    # Каталог без файлов (категория навыков) — вместилище корней, а не корень.
    return path.is_dir() and not any(p.is_file() for p in path.iterdir())


@dataclass
class _Root:
    """One step of the transfer: a directory made real (``src is None``) or a root replaced whole."""
    parts: tuple[str, ...]
    src: Optional[Path] = None
    staged: Optional[Path] = None


def _plan(home: Path, entries: list[tuple[Path, tuple[str, ...]]]) -> tuple[list[_Root], list[str]]:
    """profile_distribution._copy_dist_payload(preserve_config=True) as a list of steps, manifest
    written separately."""
    plan: list[_Root] = []
    copied: list[str] = []

    def merge(src: Path, parts: tuple[str, ...]) -> None:
        plan.append(_Root(parts))
        for child in src.iterdir():
            if _is_container(child):
                merge(child, parts + (child.name,))
            else:
                plan.append(_Root(parts + (child.name,), child))

    for src, parts in entries:
        rel = "/".join(parts)
        if len(parts) == 1:
            name = parts[0]
            if name == MANIFEST_FILE:
                continue  # переписывается ниже, с записью об установке
            if name == ENV_TEMPLATE_FILE:
                plan.append(_Root((ENV_EXAMPLE_FILE,), src))  # никогда не встаёт на место .env
                copied.append(rel)
                continue
            if name == "config.yaml" and (home / "config.yaml").exists():
                continue  # конфиг покупателя: как `hermes profile update` без --force-config
            if src.is_dir():
                merge(src, parts)
                copied.append(rel)
                continue
        plan.append(_Root(parts, src))
        copied.append(rel)
    return plan, copied


def _refuse_linked_targets(home: Path, plan: list[_Root]) -> None:
    """Check the whole write set BEFORE the first write: nothing is written through a link.

    Как profile_distribution._refuse_symlinked_targets: каталог, в который пишется корень, и
    каталог-вместилище должны быть настоящими; сам заменяемый корень может быть ссылкой — уходит
    ссылка, а не то, на что она указывает. Строже ядра: junction — тоже ссылка."""
    seen: set[Path] = set()
    for root in plan:
        path = home
        for part in (root.parts if root.src is None else root.parts[:-1]):
            path = path / part
            if path not in seen:
                seen.add(path)
                if _is_link(path):
                    raise _Refused(f"{path} is a link (symlink or junction) — nothing is written "
                                   "through it; replace it with a real directory")


def _stage_one_root(root: _Root) -> None:
    assert root.src is not None and root.staged is not None
    if root.src.is_dir():
        shutil.copytree(root.src, root.staged)
    else:
        shutil.copy2(root.src, root.staged)


def _stage(plan: list[_Root], stage: Path) -> None:
    """Copy every new root next to the profile first: a failure here changes nothing."""
    from concurrent.futures import ThreadPoolExecutor

    new = stage / "new"
    new.mkdir(parents=True)
    roots_to_copy: list[_Root] = []
    for index, root in enumerate(plan):
        if root.src is None:
            continue
        root.staged = new / str(index)
        roots_to_copy.append(root)
    if roots_to_copy:
        with ThreadPoolExecutor(max_workers=16) as pool:
            for _ in pool.map(_stage_one_root, roots_to_copy):
                pass


def _move(src: Path, dest: Path, attempts: int = 1) -> None:
    for attempt in range(attempts):
        try:
            os.replace(src, dest)
            return
        except PermissionError:  # Windows: антивирус или индексатор держит файл мгновение
            if attempt == attempts - 1:
                raise
            time.sleep(0.2)


def _make_real_dirs(home: Path, parts: tuple[str, ...], aside: Path, undo: list) -> None:
    # Как profile_distribution._real_dir: файл на месте каталога уступает ему место (здесь — уходит
    # в сторону, чтобы откат его вернул), ссылка — отказ.
    path = home
    for part in parts:
        path = path / part
        if _is_link(path):
            raise _Refused(f"{path} became a link during the transfer")
        if os.path.lexists(path) and not path.is_dir():
            moved = aside / f"blocker-{len(undo)}"
            _move(path, moved)
            undo.append(("move", moved, path))
        if not path.is_dir():
            path.mkdir()
            undo.append(("rmdir", path))


def _swap(home: Path, plan: list[_Root], stage: Path) -> None:
    """Put every staged root in place by renaming; on any failure put everything back."""
    aside = stage / "old"
    aside.mkdir(parents=True, exist_ok=True)
    undo: list[tuple] = []
    rel = ""
    try:
        for index, root in enumerate(plan):
            rel = "/".join(root.parts)
            if root.src is None:
                _make_real_dirs(home, root.parts, aside, undo)
                continue
            _make_real_dirs(home, root.parts[:-1], aside, undo)
            dest = home.joinpath(*root.parts)
            if os.path.lexists(dest):
                old = aside / str(index)
                os.replace(dest, old)  # каталог с занятым файлом не переименуется — и ничего не тронуто
                undo.append(("move", old, dest))
            os.replace(root.staged, dest)
            undo.append(("move", dest, root.staged))
    except (OSError, _Refused) as exc:
        raise _SwapFailed(rel, exc, _rollback(undo)) from exc


def _rollback(undo: list[tuple]) -> list[str]:
    """Undo the swap step by step, newest first; returns what could not be put back."""
    stuck: list[str] = []
    for step in reversed(undo):
        if step[0] == "rmdir":
            with contextlib.suppress(OSError):
                step[1].rmdir()
            continue
        _, src, dest = step
        try:
            _move(src, dest, attempts=5)
        except OSError as exc:
            stuck.append(f"{dest} ({exc})")
    return stuck


def _env_requires(manifest: dict) -> list[dict]:
    """``env_requires`` as the core keeps it (EnvRequirement.from_dict().to_dict())."""
    env = []
    for item in manifest.get("env_requires") or []:
        req = {"name": str(item.get("name") or "").strip(),
               "description": str(item.get("description") or "")}
        if not bool(item.get("required", True)):
            req["required"] = False
        if item.get("default") is not None:
            req["default"] = item["default"]
        env.append(req)
    return env


def _env_example_text(env: list[dict]) -> str:
    """profile_distribution._env_template_from_manifest, line for line."""
    lines = ["# Environment variables required by this Hermes distribution.",
             "# Copy to `.env` and fill in your own values before running.", ""]
    for req in env:
        if req["description"]:
            lines.append(f"# {req['description']}")
        default = req.get("default")
        default = "" if default is None else default
        if req.get("required", True):
            lines += ["# (required)", f"{req['name']}={default}", ""]
        else:
            lines += ["# (optional)", f"# {req['name']}={default}", ""]
    return "\n".join(lines).rstrip() + "\n"


def _manifest_record(tree_manifest: dict, installed: dict) -> dict:
    """The manifest the core writes after an update (DistributionManifest.from_dict().to_dict())."""
    def text(data: dict, key: str, default: str = "") -> str:
        return str(data.get(key) or default)

    owned = [str(p).strip().strip("/") for p in tree_manifest.get("distribution_owned") or []
             if str(p).strip()]
    record: dict[str, Any] = {"name": text(installed, "name").strip() or text(tree_manifest, "name"),
                              "version": text(tree_manifest, "version", "0.1.0")}
    optional = (
        ("description", text(tree_manifest, "description")),
        ("hermes_requires", text(tree_manifest, "hermes_requires")),
        ("author", text(tree_manifest, "author")),
        ("license", text(tree_manifest, "license")),
        ("env_requires", _env_requires(tree_manifest)),
        ("distribution_owned", owned),
        ("source", text(installed, "source")),
        ("installed_at", datetime.now(timezone.utc).isoformat(timespec="seconds")),
    )
    record.update((k, v) for k, v in optional if v)
    return record


def _write_atomically(path: Path, text: str) -> None:
    # Обрыв посреди записи не должен оставить профиль без манифеста: ядро сочло бы его «не поставкой».
    tmp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    tmp.write_text(text, encoding="utf-8")
    try:
        _move(tmp, path, attempts=5)
    except OSError:
        with contextlib.suppress(OSError):
            tmp.unlink()
        raise


def _acquire_lock(lock: Path) -> bool:
    lock.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(2):
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            try:
                age = time.time() - lock.stat().st_mtime
            except FileNotFoundError:
                continue
            if attempt or age < STALE_LOCK_SECONDS:
                return False
            with contextlib.suppress(FileNotFoundError):
                lock.unlink()  # замок упавшего процесса
            continue
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(f"{os.getpid()}\n")
        return True
    return False


def _overlaps(a: Path, b: Path) -> bool:
    a, b = a.resolve(), b.resolve()
    return a == b or a in b.parents or b in a.parents


def _read_stamp(stamp_file: Path) -> dict:
    try:
        data = json.loads(stamp_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def _clear_staging(staging: Path) -> None:
    """Leftovers of an interrupted transfer; called under the lock, so nobody else is using them."""
    if not staging.is_dir() or _is_link(staging):
        return
    for leftover in staging.iterdir():
        with contextlib.suppress(OSError):
            _remove(leftover)


def sync_profile(home: Path) -> SyncResult:
    """Bring the profile at *home* up to its package tree when the tree changed since the last sync."""
    home = Path(home)
    installed = _read_mapping(home / MANIFEST_FILE)
    if installed is None:
        return SyncResult("not-a-distribution")
    source = str(installed.get("source") or "").strip()
    if not source:
        logger.debug("nomad selfcheck: %s records no source — nothing to sync from", MANIFEST_FILE)
        return SyncResult("no-source")
    if _looks_like_git_url(source):
        logger.debug("nomad selfcheck: source %s is remote — `hermes profile update` pulls it", source)
        return SyncResult("remote-source", source)
    tree = Path(source).expanduser()
    if not (tree / MANIFEST_FILE).is_file():
        logger.warning("nomad selfcheck: package tree %s recorded in %s has no %s — profile not "
                       "synced", tree.resolve(), MANIFEST_FILE, MANIFEST_FILE)
        return SyncResult("missing-source", source)
    if _overlaps(tree, home):
        return _refuse(source, f"the package tree {tree} and the profile {home} overlap")

    manifest = _read_mapping(tree / MANIFEST_FILE) or {}
    owned = [str(p).strip().strip("/") for p in manifest.get("distribution_owned") or []
             if str(p).strip()]
    if not owned:
        return _refuse(source, f"{MANIFEST_FILE} in {tree} declares no distribution_owned")
    requires = str(manifest.get("hermes_requires") or "").strip()
    current = running_hermes_version()
    if requires and current and not version_satisfies(requires, current):
        return _refuse(source, f"the package in {tree} needs Hermes {requires}, running {current}")
    link, stats = _scan_tree(tree)
    if link is not None:
        return _refuse(source, f"the package tree contains a link (symlink or junction): {link}")

    entries = list(_owned_entries(tree, owned, stats))
    by_stat = _stat_fingerprint(entries, stats)
    data_dir = home / "plugin-data" / PLUGIN_NAME
    stamp_file = data_dir / STAMP_FILE
    stamp = _read_stamp(stamp_file)
    if stamp.get("source") == source and stamp.get("stat") == by_stat:
        return SyncResult("up-to-date", source)
    fingerprint = _content_fingerprint(entries)
    if stamp.get("source") == source and stamp.get("fingerprint") == fingerprint:
        # Файлы тронуты, но не изменены (checkout, копирование): следующий старт снова обойдётся
        # размером и временем.
        with contextlib.suppress(OSError):
            _write_atomically(stamp_file, json.dumps({**stamp, "stat": by_stat},
                                                     ensure_ascii=False, indent=2))
        return SyncResult("up-to-date", source)

    lock = data_dir / LOCK_FILE
    if not _acquire_lock(lock):
        logger.info("nomad selfcheck: another process is syncing the profile — skipped this start")
        return SyncResult("busy", source)
    staging = data_dir / STAGING_DIR
    stage = staging / f"{os.getpid()}-{time.time_ns()}"
    keep_stage = False
    try:
        stamp = _read_stamp(stamp_file)
        if stamp.get("source") == source and stamp.get("fingerprint") == fingerprint:
            return SyncResult("up-to-date", source)  # синхронизировал тот, кто держал замок до нас
        _clear_staging(staging)
        try:
            plan, copied = _plan(home, entries)
            _refuse_linked_targets(home, plan)
        except _Refused as exc:
            return _refuse(source, str(exc))
        try:
            _stage(plan, stage)
            _swap(home, plan, stage)
        except _SwapFailed as exc:
            if exc.stuck:
                keep_stage = True
                logger.error(
                    "nomad selfcheck: profile not synced from %s: cannot replace %s (%s), and the "
                    "rollback could not put back %s — the previous copies stay in %s; the next start "
                    "retries", source, exc.rel, exc.error, ", ".join(exc.stuck), stage)
                return SyncResult("failed", source, reason=f"{exc.rel}: {exc.error}")
            logger.warning(
                "nomad selfcheck: profile not synced from %s: cannot replace %s (%s) — the profile "
                "is unchanged, the next start retries", source, exc.rel, exc.error)
            return SyncResult("failed", source, reason=f"{exc.rel}: {exc.error}")
        except OSError as exc:
            logger.warning(
                "nomad selfcheck: profile not synced from %s: cannot stage the package (%s) — the "
                "profile is unchanged, the next start retries", source, exc)
            return SyncResult("failed", source, reason=str(exc))

        env = _env_requires(manifest)
        example = home / ENV_EXAMPLE_FILE
        if env and not os.path.lexists(example):  # как ядро: только когда файла нет
            _write_atomically(example, _env_example_text(env))
        _write_atomically(home / MANIFEST_FILE, yaml.safe_dump(
            _manifest_record(manifest, installed), sort_keys=False, default_flow_style=False,
            allow_unicode=True))
        _write_atomically(stamp_file, json.dumps({
            "source": source, "fingerprint": fingerprint, "stat": by_stat,
            "package_version": str(manifest.get("version") or ""),
            "synced_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }, ensure_ascii=False, indent=2))
    finally:
        if not keep_stage:
            with contextlib.suppress(OSError):
                _remove(stage)  # прежние копии корней; занятый файл дочистит следующий перенос
            with contextlib.suppress(OSError):
                staging.rmdir()
        with contextlib.suppress(OSError):
            lock.unlink()
    logger.info("nomad selfcheck: profile synced from %s — package %s, %d entries: %s",
                source, manifest.get("version"), len(copied), ", ".join(copied))
    return SyncResult("synced", source, copied)


def _refuse(source: str, reason: str) -> SyncResult:
    logger.warning("nomad selfcheck: profile not synced from %s: %s", source, reason)
    return SyncResult("refused", source, reason=reason)


# ---------------------------------------------------------------------------
# Пути, снятые с поставки
# ---------------------------------------------------------------------------

# Символы, которые Windows в имени не допускает или толкует как шаблон, и тильда короткого имени
# 8.3 (``AUTH~1.JSO`` — это auth.json). В имени, которое мы сами снимаем с поставки, их не бывает.
_FORBIDDEN_CHARS = set('<>:"|?*~\\') | {chr(c) for c in range(32)}


def retired_entry_problem(entry: Any) -> Optional[str]:
    """Why a ``nomad-retired.yaml`` entry must not run (static rules), or ``None``."""
    if not isinstance(entry, dict):
        return "an entry must be a mapping {path, reason}"
    rel, reason = entry.get("path"), entry.get("reason")
    if not isinstance(rel, str) or not rel.strip():
        return "empty path"
    if not isinstance(reason, str) or not reason.strip():
        return "no reason given"
    if rel.startswith("/") or "\\" in rel or ":" in rel:
        return "the path must be relative to the profile root, with '/' separators"
    segments = rel.split("/")
    if any(seg in ("", ".", "..") for seg in segments):
        return "the path has an empty, '.' or '..' segment"
    if any(ch in _FORBIDDEN_CHARS for ch in rel):
        return "the path has a wildcard, a control character or '~' (a Windows short name)"
    if any(seg != seg.strip() or seg.endswith(".") for seg in segments):
        # Windows отбрасывает точку и пробел в конце: «auth.json.» и «auth.json » — это auth.json.
        return "a segment starts or ends with a space or ends with a dot"
    if _name_key(segments[0]) in _NEVER_RETIRED_KEYS:
        # Регистр не различают Windows и macOS: «Auth.json» и «MEMORIES» — данные покупателя.
        return f"{segments[0]!r} is never removed (in any letter case)"
    return None


def retire_paths(home: Path) -> list[str]:
    """Remove from the profile every path ``nomad-retired.yaml`` lists; returns what was removed."""
    home = Path(home)
    listing = home / RETIRED_FILE
    if not listing.is_file():
        return []
    try:
        data = yaml.safe_load(listing.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("nomad selfcheck: %s is unreadable (%s) — nothing retired", RETIRED_FILE, exc)
        return []
    entries = data.get("retired") if isinstance(data, dict) else None
    if not isinstance(entries, list):
        logger.warning("nomad selfcheck: %s must hold a list 'retired' — nothing retired", RETIRED_FILE)
        return []
    tree = _local_source(home)
    removed: list[str] = []
    for entry in entries:
        rel = entry.get("path") if isinstance(entry, dict) else entry
        problem = retired_entry_problem(entry)
        if problem is None:
            problem = _runtime_problem(home, tree, rel)
        if problem:
            if problem != "absent":
                logger.warning("nomad selfcheck: %s entry %r skipped: %s", RETIRED_FILE, rel, problem)
            continue
        try:
            _remove(home.joinpath(*rel.split("/")))
        except OSError as exc:  # занятый файл: остальные записи всё равно исполняются
            logger.warning("nomad selfcheck: %s entry %r not removed: %s — the next start retries",
                           RETIRED_FILE, rel, exc)
            continue
        removed.append(rel)
        logger.info("nomad selfcheck: removed retired path %s (%s)", rel, entry["reason"].strip())
    return removed


def _runtime_problem(home: Path, tree: Optional[Path], rel: str) -> Optional[str]:
    """Rules that need the disk. Every segment must be spelled exactly as it is on disk: a
    case-insensitive file system resolves «Auth.json», «auth.json.» or «AUTH~1.JSO» to auth.json,
    so a spelling that differs from the name on disk is refused — whatever the static rules let by."""
    segments = rel.split("/")
    path = home
    for depth, seg in enumerate(segments):
        if depth and _is_link(path):
            return f"{path} is a link (symlink or junction) — not followed"
        try:
            names = os.listdir(path)
        except OSError:
            return "absent"
        if seg not in names:
            if os.path.lexists(path / seg):
                alias = next((n for n in names if _name_key(n) == _name_key(seg)), "another entry")
                return (f"{seg!r} is spelled differently on disk ({alias!r}) — a listed path must "
                        "match the name on disk exactly")
            return "absent"
        path = path / seg
    if _name_key(segments[0]) in _NEVER_RETIRED_KEYS:
        return f"{segments[0]!r} is never removed"
    if len(segments) == 1 and path.is_dir() and not _is_link(path):
        return "a whole top-level directory is never removed (it holds the buyer's roots too)"
    if tree is not None and os.path.lexists(tree.joinpath(*segments)):
        return f"the package in {tree} still ships it"
    return None


# ---------------------------------------------------------------------------
# Точка входа
# ---------------------------------------------------------------------------

def on_start() -> None:
    """Run the three steps for the active profile. Never raises: a failure is a line in the log."""
    try:
        from .core_adapter import get_hermes_home

        home = get_hermes_home()
    except Exception:
        logger.exception("nomad selfcheck: cannot resolve the active profile — sync skipped")
    else:
        _guarded("package sync", sync_profile, home)
        _guarded("retired paths", retire_paths, home)
    # После переноса: сверяется контракт, с которым плагин будет работать, а не тот, что лежал в
    # профиле до `hermes update`.
    try:
        contract = load_contract()
    except Exception as exc:
        logger.warning("nomad selfcheck: %s is unreadable (%s) — the core version is not checked",
                       CONTRACT_FILE, exc)
    else:
        _guarded("core version check", check_core_version, contract, running_hermes_version())


def _guarded(step: str, fn, *args) -> None:
    try:
        fn(*args)
    except Exception:
        logger.exception("nomad selfcheck: %s failed", step)
