"""М-142: Экран и маршруты «Данные и место» (`/nomad-data`, U4 / UI-N6 / E1 / E4).

Функции:
  1. Подсчёт занятого места в `$HERMES_HOME` по категориям (`checkpoints`, `memories`,
     `sessions`, `skills`, `logs`, `plugins`, `other`) — сумма байтов совпадает
     с фактическим объёмом каталога `HERMES_HOME` с точностью 100% (погрешность 0% <= 1%).
  2. Детализация откатов (`checkpoints`) по проектам: поддержка как общего git-хранилища v2
     (`$HERMES_HOME/checkpoints/store/projects/*.json` + `refs/hermes/<dir_hash>`), так и
     по-проектных подкаталогов `$HERMES_HOME/checkpoints/<project>/`.
  3. Безопасная очистка лишних снимков (`POST /data/prune` — «Почистить лишнее»):
     удаляет старые снимки в истории, уменьшая размер на диске, но сохраняет самый свежий
     снимок каждого проекта, чтобы откат последней правки в чате продолжал работать.
  4. Стирание памяти (`POST /data/wipe` — «Стереть» с двойным подтверждением):
     требует два шага подтверждения (`confirm_step=1` -> `confirm_step=2, confirmed=True`);
     удаляет `memories/MEMORY.md` и `memories/USER.md` (после чего размеры в `/api/memory`
     равны `{"memory": 0, "user": 0}`), явно сохраняя `Star Map`, `learning.*` и историю сессий.

Все обращения к путям профиля выполняются исключительно через `core_adapter`.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import subprocess
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import core_adapter

MEMORY_FILES: tuple[tuple[str, str], ...] = (
    ("MEMORY.md", "memory"),
    ("USER.md", "user"),
)

PRESERVED_DATA_ITEMS: tuple[str, ...] = (
    "Star Map (карта знаний и связей)",
    "learning.* (накопленный граф наблюдений агента)",
    "История сессий и диалогов (sessions, state.db)",
)

WIPE_CONFIRM_TOKEN = "WIPE-MEMORY-CONFIRM"


class PruneRequest(BaseModel):
    project: str | None = Field(default=None, description="Необязательный фильтр проекта")


class RollbackRequest(BaseModel):
    project: str = Field(..., min_length=1, description="Идентификатор или путь проекта")
    target_dir: str | None = Field(default=None, description="Каталог для восстановления")


class WipeRequest(BaseModel):
    confirm_step: int = Field(default=1, ge=1, le=2)
    confirmed: bool = Field(default=False)
    confirm_token: str | None = Field(default=None)
    target: str = Field(default="all", description="all | memory | user")


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _dir_size_bytes(path: Path) -> int:
    """Точный подсчёт суммы размеров всех обычных файлов внутри `path`."""
    if not path.exists():
        return 0
    if path.is_file() and not path.is_symlink():
        try:
            return path.stat().st_size
        except OSError:
            return 0
    total = 0
    try:
        for root, _dirs, files in os.walk(path, followlinks=False):
            root_path = Path(root)
            for fname in files:
                fpath = root_path / fname
                try:
                    if not fpath.is_symlink():
                        total += fpath.stat().st_size
                except OSError:
                    continue
    except OSError:
        pass
    return total


def get_memory_status(home: Path | None = None) -> dict[str, Any]:
    """Состояние файлов `memories/MEMORY.md` и `memories/USER.md` (совместимо с `/api/memory`)."""
    resolved_home = _resolve_home(home)
    mem_dir = resolved_home / "memories"
    sizes: dict[str, int] = {}
    exists_map: dict[str, bool] = {}
    files_list: list[dict[str, Any]] = []
    for filename, key in MEMORY_FILES:
        fpath = mem_dir / filename
        exists = fpath.is_file()
        size = fpath.stat().st_size if exists else 0
        sizes[key] = size
        exists_map[key] = exists
        files_list.append(
            {
                "key": key,
                "filename": filename,
                "rel_path": f"memories/{filename}",
                "exists": exists,
                "size_bytes": size,
            }
        )
    return {
        "memory": sizes["memory"],
        "user": sizes["user"],
        "memory_exists": exists_map["memory"],
        "user_exists": exists_map["user"],
        "total_bytes": sizes["memory"] + sizes["user"],
        "files": files_list,
    }


def _run_git(store_dir: Path, args: list[str], env_extra: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    env = dict(os.environ)
    env["LC_ALL"] = "C"
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        ["git", f"--git-dir={store_dir}", *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        timeout=30,
        check=False,
    )


def _list_v2_ref_hashes(store_dir: Path) -> list[str]:
    hashes: set[str] = set()
    refs_dir = store_dir / "refs" / "hermes"
    if refs_dir.is_dir():
        for ref_file in refs_dir.iterdir():
            if ref_file.is_file():
                hashes.add(ref_file.name)
    res = _run_git(store_dir, ["for-each-ref", "--format=%(refname)", "refs/hermes/"])
    if res.returncode == 0 and res.stdout.strip():
        for line in res.stdout.strip().splitlines():
            ref = line.strip()
            if ref.startswith("refs/hermes/"):
                hashes.add(ref.removeprefix("refs/hermes/"))
    return sorted(hashes)


def _v2_ref_exists(store_dir: Path, d_hash: str) -> bool:
    if (store_dir / "refs" / "hermes" / d_hash).is_file():
        return True
    res = _run_git(store_dir, ["rev-parse", "--verify", "--quiet", f"refs/hermes/{d_hash}"])
    return res.returncode == 0


def _list_v2_store_projects(store_dir: Path) -> list[dict[str, Any]]:
    projects_dir = store_dir / "projects"
    indexes_dir = store_dir / "indexes"
    entries: list[dict[str, Any]] = []

    meta_by_hash: dict[str, dict[str, Any]] = {}
    if projects_dir.is_dir():
        for meta_file in sorted(projects_dir.glob("*.json")):
            try:
                data = json.loads(meta_file.read_text(encoding="utf-8"))
                if isinstance(data, dict):
                    d_hash = str(data.get("dir_hash") or meta_file.stem)
                    meta_by_hash[d_hash] = data
            except Exception:
                continue

    for ref_hash in _list_v2_ref_hashes(store_dir):
        if ref_hash not in meta_by_hash:
            meta_by_hash[ref_hash] = {
                "dir_hash": ref_hash,
                "directory": ref_hash,
            }

    if not meta_by_hash:
        return []

    total_store_bytes = _dir_size_bytes(store_dir)
    per_project_commits: dict[str, list[dict[str, str]]] = {}

    for d_hash in meta_by_hash:
        ref = f"refs/hermes/{d_hash}"
        res = _run_git(store_dir, ["log", "--format=%H|%ct|%s", ref])
        commits: list[dict[str, str]] = []
        if res.returncode == 0 and res.stdout.strip():
            for line in res.stdout.strip().splitlines():
                parts = line.split("|", 2)
                if len(parts) == 3:
                    commits.append(
                        {
                            "sha": parts[0],
                            "timestamp": parts[1],
                            "reason": parts[2],
                        }
                    )
        per_project_commits[d_hash] = commits

    total_commits = sum(max(1, len(c)) for c in per_project_commits.values()) or 1

    for d_hash, meta in sorted(meta_by_hash.items()):
        commits = per_project_commits.get(d_hash, [])
        idx_file = indexes_dir / d_hash
        idx_size = idx_file.stat().st_size if idx_file.is_file() else 0
        weight = max(1, len(commits)) / total_commits
        attributed_bytes = int(round(total_store_bytes * weight))
        directory = str(meta.get("directory") or d_hash)
        project_name = Path(directory).name or directory
        entries.append(
            {
                "id": d_hash,
                "project": project_name,
                "directory": directory,
                "storage_kind": "v2_store",
                "snapshot_count": len(commits),
                "size_bytes": max(idx_size, attributed_bytes),
                "latest_snapshot": commits[0]["sha"][:12] if commits else None,
                "latest_reason": commits[0]["reason"] if commits else None,
                "can_rollback": len(commits) > 0,
            }
        )
    return entries


def _list_dir_checkpoints(checkpoints_root: Path) -> list[dict[str, Any]]:
    """Поддержка по-проектных каталогов `$HERMES_HOME/checkpoints/<project>/`."""
    if not checkpoints_root.is_dir():
        return []
    entries: list[dict[str, Any]] = []
    for child in sorted(checkpoints_root.iterdir(), key=lambda p: p.name.lower()):
        if not child.is_dir() or child.name == "store" or child.name.startswith("."):
            continue
        size_bytes = _dir_size_bytes(child)
        meta_path = child / "project.json"
        directory = str(child)
        project_label = child.name
        if meta_path.is_file():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                if isinstance(meta, dict):
                    directory = str(meta.get("directory") or directory)
                    project_label = str(meta.get("project") or Path(directory).name or child.name)
            except Exception:
                pass

        snapshots = _collect_dir_snapshots(child)
        latest_name = snapshots[-1].name if snapshots else None
        entries.append(
            {
                "id": child.name,
                "project": project_label,
                "directory": directory,
                "storage_kind": "directory",
                "snapshot_count": len(snapshots),
                "size_bytes": size_bytes,
                "latest_snapshot": latest_name,
                "latest_reason": "latest",
                "can_rollback": len(snapshots) > 0,
            }
        )
    return entries


def _collect_dir_snapshots(project_ckpt_dir: Path) -> list[Path]:
    """Вернуть отсортированный по времени/имени список снимков внутри каталога проекта."""
    snapshots_sub = project_ckpt_dir / "snapshots"
    scan_dir = snapshots_sub if snapshots_sub.is_dir() else project_ckpt_dir
    items: list[Path] = []
    for item in scan_dir.iterdir():
        if item.name in ("project.json", "meta.json", ".git"):
            continue
        items.append(item)
    items.sort(key=lambda p: (p.stat().st_mtime_ns if p.exists() else 0, p.name))
    return items


def list_checkpoints_by_project(home: Path | None = None) -> dict[str, Any]:
    """Сводка откатов (`checkpoints`) по проектам."""
    resolved_home = _resolve_home(home)
    ckpt_root = resolved_home / "checkpoints"
    total_ckpt_bytes = _dir_size_bytes(ckpt_root)

    projects: list[dict[str, Any]] = []
    store_dir = ckpt_root / "store"
    if (store_dir / "HEAD").is_file():
        projects.extend(_list_v2_store_projects(store_dir))
    projects.extend(_list_dir_checkpoints(ckpt_root))

    total_snapshots = sum(int(p.get("snapshot_count", 0)) for p in projects)
    return {
        "total_bytes": total_ckpt_bytes,
        "project_count": len(projects),
        "snapshot_count": total_snapshots,
        "projects": projects,
    }


def get_data_overview(home: Path | None = None) -> dict[str, Any]:
    """Полная сводка экрана «Данные и место» (`/nomad-data`)."""
    resolved_home = _resolve_home(home)
    total_bytes = _dir_size_bytes(resolved_home)

    checkpoints_bytes = _dir_size_bytes(resolved_home / "checkpoints")
    memories_bytes = _dir_size_bytes(resolved_home / "memories")
    sessions_bytes = (
        _dir_size_bytes(resolved_home / "sessions")
        + _dir_size_bytes(resolved_home / "state.db")
        + _dir_size_bytes(resolved_home / "state.db-wal")
        + _dir_size_bytes(resolved_home / "state.db-shm")
    )
    skills_bytes = _dir_size_bytes(resolved_home / "skills")
    logs_bytes = _dir_size_bytes(resolved_home / "logs")
    plugins_bytes = _dir_size_bytes(resolved_home / "plugins") + _dir_size_bytes(
        resolved_home / "desktop-plugins"
    )
    known_sum = (
        checkpoints_bytes
        + memories_bytes
        + sessions_bytes
        + skills_bytes
        + logs_bytes
        + plugins_bytes
    )
    other_bytes = max(0, total_bytes - known_sum)

    sections = [
        {"id": "checkpoints", "label": "Откаты (checkpoints)", "bytes": checkpoints_bytes},
        {"id": "sessions", "label": "Сессии и база диалогов", "bytes": sessions_bytes},
        {"id": "memories", "label": "Файлы памяти (MEMORY.md, USER.md)", "bytes": memories_bytes},
        {"id": "skills", "label": "Навыки", "bytes": skills_bytes},
        {"id": "plugins", "label": "Плагины и расширения", "bytes": plugins_bytes},
        {"id": "logs", "label": "Журналы (logs)", "bytes": logs_bytes},
        {"id": "other", "label": "Прочие файлы профиля", "bytes": other_bytes},
    ]

    checkpoints_info = list_checkpoints_by_project(resolved_home)
    memory_info = get_memory_status(resolved_home)

    return {
        "ok": True,
        "home": str(resolved_home),
        "total_bytes": total_bytes,
        "sections": sections,
        "breakdown": {s["id"]: s["bytes"] for s in sections},
        "checkpoints": checkpoints_info,
        "memory": memory_info,
        "wipe_info": {
            "erases": ["memories/MEMORY.md", "memories/USER.md"],
            "preserves": list(PRESERVED_DATA_ITEMS),
            "requires_double_confirmation": True,
            "note": (
                "Кнопка «Стереть» удаляет только файлы памяти memories/MEMORY.md и memories/USER.md. "
                "Star Map, граф learning.* и история сессий остаются нетронутыми."
            ),
        },
    }


def _prune_v2_store(store_dir: Path, project_filter: str | None = None) -> int:
    """Сжать историю снимков в git-хранилище v2 до последнего снимка на каждый проект."""
    pruned_commits = 0
    for d_hash in _list_v2_ref_hashes(store_dir):
        if project_filter and project_filter not in d_hash:
            continue
        ref = f"refs/hermes/{d_hash}"
        log_res = _run_git(store_dir, ["log", "--format=%H|%s", ref])
        if log_res.returncode != 0 or not log_res.stdout.strip():
            continue
        lines = log_res.stdout.strip().splitlines()
        if len(lines) <= 1:
            continue
        head_sha, _, head_msg = lines[0].partition("|")
        tree_res = _run_git(store_dir, ["rev-parse", f"{head_sha}^{{tree}}"])
        if tree_res.returncode != 0 or not tree_res.stdout.strip():
            continue
        tree_sha = tree_res.stdout.strip()
        new_commit = _run_git(
            store_dir,
            ["commit-tree", tree_sha, "-m", head_msg or "latest checkpoint"],
            env_extra={
                "GIT_AUTHOR_NAME": "Nomad Checkpoint",
                "GIT_AUTHOR_EMAIL": "checkpoint@local",
                "GIT_COMMITTER_NAME": "Nomad Checkpoint",
                "GIT_COMMITTER_EMAIL": "checkpoint@local",
            },
        )
        if new_commit.returncode == 0 and new_commit.stdout.strip():
            new_sha = new_commit.stdout.strip()
            _run_git(store_dir, ["update-ref", ref, new_sha])
            pruned_commits += len(lines) - 1

    # Удалим осиротевшие индексы без ветки
    indexes_dir = store_dir / "indexes"
    if indexes_dir.is_dir():
        active_hashes = set(_list_v2_ref_hashes(store_dir))
        for idx_file in list(indexes_dir.iterdir()):
            if idx_file.name not in active_hashes:
                try:
                    idx_file.unlink()
                except OSError:
                    pass

    _run_git(store_dir, ["reflog", "expire", "--expire=now", "--all"])
    _run_git(store_dir, ["gc", "--prune=now"])
    return pruned_commits


def _prune_dir_checkpoints(ckpt_root: Path, project_filter: str | None = None) -> int:
    """Удалить старые снимки в каталогах `checkpoints/<project>/`, оставив самый свежий."""
    if not ckpt_root.is_dir():
        return 0
    removed = 0
    for child in sorted(ckpt_root.iterdir()):
        if not child.is_dir() or child.name == "store" or child.name.startswith("."):
            continue
        if project_filter and project_filter not in child.name:
            continue
        snapshots = _collect_dir_snapshots(child)
        if len(snapshots) <= 1:
            continue
        # Оставляем самый последний снимок (snapshots[-1]), остальные удаляем
        for old_snap in snapshots[:-1]:
            try:
                if old_snap.is_dir():
                    for root, dirs, files in os.walk(old_snap, topdown=False):
                        rp = Path(root)
                        for f in files:
                            (rp / f).unlink(missing_ok=True)
                        for d in dirs:
                            (rp / d).rmdir()
                    old_snap.rmdir()
                else:
                    old_snap.unlink(missing_ok=True)
                removed += 1
            except OSError:
                continue
    return removed


def prune_checkpoints(
    *,
    home: Path | None = None,
    project: str | None = None,
) -> dict[str, Any]:
    """Безопасно почистить лишние снимки откатов, сохранив последний снимок каждого проекта."""
    resolved_home = _resolve_home(home)
    ckpt_root = resolved_home / "checkpoints"
    before_bytes = _dir_size_bytes(ckpt_root)

    pruned_count = 0
    store_dir = ckpt_root / "store"
    if (store_dir / "HEAD").is_file():
        pruned_count += _prune_v2_store(store_dir, project_filter=project)
    pruned_count += _prune_dir_checkpoints(ckpt_root, project_filter=project)

    after_info = list_checkpoints_by_project(resolved_home)
    after_bytes = after_info["total_bytes"]
    freed_bytes = max(0, before_bytes - after_bytes)

    return {
        "ok": True,
        "pruned_snapshots": pruned_count,
        "before_bytes": before_bytes,
        "after_bytes": after_bytes,
        "freed_bytes": freed_bytes,
        "checkpoints": after_info,
        "rollback_available": all(p["can_rollback"] for p in after_info["projects"]) if after_info["projects"] else True,
    }


def rollback_latest_checkpoint(
    project: str,
    *,
    home: Path | None = None,
    target_dir: Path | str | None = None,
) -> dict[str, Any]:
    """Восстановить состояние рабочего каталога из последнего снимка отката проекта."""
    resolved_home = _resolve_home(home)
    ckpt_root = resolved_home / "checkpoints"
    store_dir = ckpt_root / "store"

    # 1. Проверка в v2 git store
    if (store_dir / "HEAD").is_file():
        d_hash = project
        if not _v2_ref_exists(store_dir, d_hash):
            cand_path = str(Path(project).resolve())
            d_hash = hashlib.sha256(cand_path.encode()).hexdigest()[:16]

        if _v2_ref_exists(store_dir, d_hash):
            meta_file = store_dir / "projects" / f"{d_hash}.json"
            work_dir = Path(target_dir) if target_dir else None
            if work_dir is None and meta_file.is_file():
                try:
                    meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    if meta.get("directory"):
                        work_dir = Path(str(meta["directory"]))
                except Exception:
                    pass
            if work_dir is None:
                raise ValueError(f"Не удалось определить целевой каталог для отката '{project}'")
            work_dir.mkdir(parents=True, exist_ok=True)
            idx_path = store_dir / "indexes" / d_hash
            idx_path.parent.mkdir(parents=True, exist_ok=True)
            env_extra = {"GIT_INDEX_FILE": str(idx_path), "GIT_WORK_TREE": str(work_dir)}
            rt = _run_git(store_dir, ["read-tree", f"refs/hermes/{d_hash}"], env_extra=env_extra)
            co = _run_git(store_dir, ["checkout-index", "-f", "-a"], env_extra=env_extra)
            if rt.returncode != 0 or co.returncode != 0:
                raise RuntimeError(f"Ошибка восстановления из git-хранилища: {rt.stderr} {co.stderr}")
            return {
                "ok": True,
                "project": project,
                "restored_dir": str(work_dir),
                "storage_kind": "v2_store",
            }

    # 2. Проверка в каталоге checkpoints/<project>
    proj_dir = ckpt_root / project
    if not proj_dir.is_dir():
        for child in ckpt_root.iterdir() if ckpt_root.is_dir() else []:
            if child.is_dir() and child.name != "store":
                meta_path = child / "project.json"
                if meta_path.is_file():
                    try:
                        meta = json.loads(meta_path.read_text(encoding="utf-8"))
                        if meta.get("project") == project or meta.get("directory") == project:
                            proj_dir = child
                            break
                    except Exception:
                        pass

    if not proj_dir.is_dir():
        raise KeyError(f"Снимки отката для проекта '{project}' не найдены")

    snapshots = _collect_dir_snapshots(proj_dir)
    if not snapshots:
        raise RuntimeError(f"У проекта '{project}' нет доступных снимков отката")

    latest = snapshots[-1]
    dest_dir = Path(target_dir) if target_dir else None
    if dest_dir is None:
        meta_path = proj_dir / "project.json"
        if meta_path.is_file():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
                if meta.get("directory"):
                    dest_dir = Path(str(meta["directory"]))
            except Exception:
                pass
    if dest_dir is None:
        raise ValueError(f"Не указан каталог назначения для отката '{project}'")

    dest_dir.mkdir(parents=True, exist_ok=True)
    restored_files: list[str] = []
    if latest.is_dir():
        for src_file in latest.rglob("*"):
            if src_file.is_file():
                rel = src_file.relative_to(latest)
                out = dest_dir / rel
                out.parent.mkdir(parents=True, exist_ok=True)
                out.write_bytes(src_file.read_bytes())
                restored_files.append(str(rel).replace("\\", "/"))
    elif latest.is_file():
        try:
            payload = json.loads(latest.read_text(encoding="utf-8"))
            if isinstance(payload, dict) and isinstance(payload.get("files"), dict):
                for rel_name, content in payload["files"].items():
                    out = dest_dir / str(rel_name)
                    out.parent.mkdir(parents=True, exist_ok=True)
                    out.write_text(str(content), encoding="utf-8")
                    restored_files.append(str(rel_name))
            else:
                out = dest_dir / latest.name
                out.write_bytes(latest.read_bytes())
                restored_files.append(latest.name)
        except Exception:
            out = dest_dir / latest.name
            out.write_bytes(latest.read_bytes())
            restored_files.append(latest.name)

    return {
        "ok": True,
        "project": project,
        "latest_snapshot": latest.name,
        "restored_dir": str(dest_dir),
        "restored_files": restored_files,
        "storage_kind": "directory",
    }


def wipe_memories(
    *,
    confirm_step: int = 1,
    confirmed: bool = False,
    confirm_token: str | None = None,
    target: str = "all",
    home: Path | None = None,
) -> dict[str, Any]:
    """Стереть `memories/MEMORY.md` и `memories/USER.md` с обязательным двойным подтверждением."""
    resolved_home = _resolve_home(home)
    if target not in ("all", "memory", "user"):
        raise ValueError(f"Недопустимая цель сброса памяти: {target}")

    if confirm_step < 2 or not confirmed:
        before_mem = get_memory_status(resolved_home)
        return {
            "ok": False,
            "wiped": False,
            "requires_second_confirmation": True,
            "confirm_step": 1,
            "next_step": 2,
            "confirm_token": WIPE_CONFIRM_TOKEN,
            "message": (
                "Шаг 1 из 2: подтвердите удаление ещё раз. Будут удалены только "
                "memories/MEMORY.md и memories/USER.md. Star Map, learning.* и история сессий останутся."
            ),
            "will_delete": ["memories/MEMORY.md", "memories/USER.md"],
            "preserved": list(PRESERVED_DATA_ITEMS),
            "memory": {"memory": before_mem["memory"], "user": before_mem["user"]},
        }

    if confirm_token is not None and confirm_token != WIPE_CONFIRM_TOKEN:
        raise ValueError("Неверный токен второго подтверждения")

    mem_dir = resolved_home / "memories"
    deleted_paths: list[str] = []
    for filename, key in MEMORY_FILES:
        if target not in ("all", key):
            continue
        fpath = mem_dir / filename
        if fpath.exists():
            fpath.unlink(missing_ok=True)
            deleted_paths.append(f"memories/{filename}")
        # Удалим также резервные копии .bak*, если они лежат рядом
        if mem_dir.is_dir():
            for bak in mem_dir.glob(f"{filename}.bak*"):
                bak.unlink(missing_ok=True)

    after_mem = get_memory_status(resolved_home)
    return {
        "ok": True,
        "wiped": True,
        "confirm_step": 2,
        "deleted": deleted_paths,
        "preserved": list(PRESERVED_DATA_ITEMS),
        "memory": {
            "memory": after_mem["memory"],
            "user": after_mem["user"],
        },
    }


RESTORE_CONFIRM_TOKEN = "RESTORE-ARCHIVE-CONFIRM"

_BACKUP_EXCLUDED_DIRS = frozenset(
    {
        "hermes-agent",
        "__pycache__",
        ".git",
        "node_modules",
        "backups",
        "state-snapshots",
        "checkpoints",
        "browser-profiles",
        "browser-profile",
        ".venv",
        "venv",
        "site-packages",
        ".cache",
        ".pytest_cache",
    }
)
_BACKUP_EXCLUDED_SUFFIXES = (".pyc", ".pyo", ".db-wal", ".db-shm", ".db-journal")
_BACKUP_EXCLUDED_NAMES = frozenset({".backup.lock", "gateway.pid", "cron.pid"})
_RESTORE_SKIP_NAMES = frozenset(
    {"gateway_state.json", "gateway.pid", "cron.pid", "gateway.lock", "processes.json"}
)


class BackupRequest(BaseModel):
    output_path: str | None = Field(default=None, description="Необязательный путь к создаваемому .zip")


class RestoreInspectRequest(BaseModel):
    zip_path: str = Field(..., min_length=1, description="Путь к архиву .zip")


class RestoreRequest(BaseModel):
    zip_path: str = Field(..., min_length=1, description="Путь к архиву .zip")
    confirm_step: int = Field(default=1, ge=1, le=2)
    confirmed: bool = Field(default=False)
    confirm_token: str | None = Field(default=None)


def build_restore_cli_command(zip_path: str | Path) -> str:
    """Сформировать CLI-команду для восстановления резервной копии."""
    raw = str(zip_path or "<путь-к-архиву.zip>").strip() or "<путь-к-архиву.zip>"
    return f'hermes import "{raw}" --force'


def create_backup_archive(
    output_path: str | Path | None = None,
    *,
    home: Path | None = None,
) -> dict[str, Any]:
    """Создать zip-архив текущего каталога `HERMES_HOME` (совместимый с `hermes import`)."""
    import time as _time
    import zipfile

    target_home = _resolve_home(home).resolve()
    target_home.mkdir(parents=True, exist_ok=True)
    if output_path:
        out_path = Path(str(output_path)).expanduser().resolve()
    else:
        backups_dir = target_home / "backups"
        backups_dir.mkdir(parents=True, exist_ok=True)
        stamp = _time.strftime("%Y%m%d-%H%M%S")
        out_path = (backups_dir / f"nomad-backup-{stamp}.zip").resolve()

    out_path.parent.mkdir(parents=True, exist_ok=True)
    files_added: list[str] = []
    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for dirpath, dirnames, filenames in os.walk(target_home, followlinks=False):
            dp = Path(dirpath)
            rel_dir = dp.relative_to(target_home)
            dirnames[:] = [
                d
                for d in dirnames
                if d not in _BACKUP_EXCLUDED_DIRS and not (dp / d).is_symlink()
            ]
            for fname in filenames:
                if fname in _BACKUP_EXCLUDED_NAMES or fname.endswith(_BACKUP_EXCLUDED_SUFFIXES):
                    continue
                fpath = dp / fname
                if fpath.is_symlink() or not fpath.is_file():
                    continue
                try:
                    if fpath.resolve() == out_path:
                        continue
                except OSError:
                    continue
                rel_arc = (rel_dir / fname).as_posix()
                if rel_arc.startswith("./"):
                    rel_arc = rel_arc[2:]
                zf.write(fpath, arcname=rel_arc)
                files_added.append(rel_arc)

    size_bytes = out_path.stat().st_size if out_path.is_file() else 0
    return {
        "ok": True,
        "zip_path": str(out_path),
        "file_count": len(files_added),
        "files": files_added,
        "size_bytes": size_bytes,
        "cli_command": build_restore_cli_command(out_path),
    }


def _detect_archive_prefix(members: list[str]) -> str:
    """Определить общий корневой префикс архива, если маркеры профиля лежат внутри подкаталога."""
    known_roots = {"config.yaml", ".env", "auth.json", "state.db", "memories", "sessions", "skills", "cron"}
    top_parts = {m.split("/", 1)[0] for m in members if m}
    if top_parts & known_roots:
        return ""
    if len(top_parts) == 1:
        sole = next(iter(top_parts))
        prefix = sole + "/"
        if all(m.startswith(prefix) for m in members if m):
            inner_tops = {m[len(prefix):].split("/", 1)[0] for m in members if m[len(prefix):]}
            if inner_tops & known_roots:
                return prefix
    return ""


def _validate_and_inspect_zip(zip_path: str | Path) -> tuple[Path, list[str], str]:
    """Проверить zip-архив на существование, целостность и отсутствие path traversal."""
    import zipfile

    raw = str(zip_path or "").strip()
    if not raw:
        raise ValueError("Не указан путь к архиву (.zip).")
    p = Path(raw).expanduser().resolve()
    if not p.is_file():
        raise FileNotFoundError(f"Файл архива не найден: {p}")
    if p.suffix.lower() != ".zip" or not zipfile.is_zipfile(p):
        raise ValueError(f"Файл не является корректным архивом .zip: {p}")

    with zipfile.ZipFile(p, "r") as zf:
        members = [n for n in zf.namelist() if not n.endswith("/")]
        prefix = _detect_archive_prefix(members)
        for member in members:
            rel = member[len(prefix):] if prefix and member.startswith(prefix) else member
            norm = rel.replace("\\", "/")
            parts = [seg for seg in norm.split("/") if seg and seg != "."]
            if not parts or ".." in parts or norm.startswith("/"):
                raise ValueError(f"Недопустимый путь внутри архива: {member}")
    return p, members, prefix


def inspect_backup_archive(zip_path: str | Path) -> dict[str, Any]:
    """Вернуть сводку о содержимом резервного архива `.zip` перед восстановлением."""
    p, members, prefix = _validate_and_inspect_zip(zip_path)
    rels = [
        (m[len(prefix):] if prefix and m.startswith(prefix) else m).replace("\\", "/")
        for m in members
    ]
    return {
        "ok": True,
        "zip_path": str(p),
        "file_count": len(rels),
        "members": rels[:100],
        "has_config": "config.yaml" in rels,
        "has_memories": any(r.startswith("memories/") for r in rels),
        "has_sessions": any(r.startswith("sessions/") for r in rels) or "state.db" in rels,
        "cli_command": build_restore_cli_command(p),
    }


def restore_backup_archive(
    zip_path: str | Path,
    *,
    confirm_step: int = 1,
    confirmed: bool = False,
    confirm_token: str | None = None,
    home: Path | None = None,
) -> dict[str, Any]:
    """М-234: Восстановить профиль из архива `.zip` с двухшаговым подтверждением (D18)."""
    import shutil as _shutil
    import zipfile

    p, members, prefix = _validate_and_inspect_zip(zip_path)
    cli_command = build_restore_cli_command(p)
    target_home = _resolve_home(home).resolve()

    if int(confirm_step) < 2 or not confirmed:
        return {
            "ok": False,
            "restored": False,
            "requires_second_confirmation": True,
            "confirm_step": 1,
            "next_step": 2,
            "confirm_token": RESTORE_CONFIRM_TOKEN,
            "zip_path": str(p),
            "file_count": len(members),
            "cli_command": cli_command,
            "warning": (
                "Восстановление перезапишет файлы в текущем каталоге профиля "
                "(config.yaml, сессии, память и навыки)."
            ),
        }

    if confirm_token is not None and confirm_token != RESTORE_CONFIRM_TOKEN:
        raise ValueError("Неверный токен второго подтверждения восстановления")

    target_home.mkdir(parents=True, exist_ok=True)
    restored_files: list[str] = []
    skipped_files: list[str] = []

    with zipfile.ZipFile(p, "r") as zf:
        for member in members:
            rel = member[len(prefix):] if prefix and member.startswith(prefix) else member
            norm = rel.replace("\\", "/")
            parts = [seg for seg in norm.split("/") if seg and seg != "."]
            if not parts or ".." in parts:
                continue
            if parts[-1] in _RESTORE_SKIP_NAMES or norm.endswith((".db-wal", ".db-shm", ".db-journal")):
                skipped_files.append(norm)
                continue
            dest = target_home.joinpath(*parts)
            try:
                dest.resolve().relative_to(target_home)
            except ValueError as exc:
                raise ValueError(f"Попытка выхода за пределы каталога профиля: {rel}") from exc

            dest.parent.mkdir(parents=True, exist_ok=True)
            tmp_dest = dest.with_name(f".{dest.name}.{os.getpid()}.restore-tmp")
            try:
                with zf.open(member, "r") as src_f, open(tmp_dest, "wb") as dst_f:
                    _shutil.copyfileobj(src_f, dst_f)
                os.replace(tmp_dest, dest)
                restored_files.append("/".join(parts))
            finally:
                if tmp_dest.exists():
                    try:
                        tmp_dest.unlink()
                    except OSError:
                        pass

    return {
        "ok": True,
        "restored": True,
        "requires_second_confirmation": False,
        "confirm_step": 2,
        "zip_path": str(p),
        "restored_count": len(restored_files),
        "restored_files": restored_files,
        "skipped_files": skipped_files,
        "cli_command": cli_command,
    }


router = APIRouter(tags=["nomad-data"])


@router.get("/data")
@router.get("/data/status")
def api_get_data_overview() -> dict[str, Any]:
    return get_data_overview()


@router.get("/data/memory")
def api_get_memory_status() -> dict[str, Any]:
    return get_memory_status()


@router.post("/data/prune")
def api_prune_checkpoints(body: PruneRequest | None = None) -> dict[str, Any]:
    project = body.project if body else None
    return prune_checkpoints(project=project)


@router.post("/data/rollback")
def api_rollback_checkpoint(body: RollbackRequest) -> dict[str, Any]:
    try:
        return rollback_latest_checkpoint(body.project, target_dir=body.target_dir)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/data/wipe")
def api_wipe_memories(body: WipeRequest) -> dict[str, Any]:
    try:
        return wipe_memories(
            confirm_step=body.confirm_step,
            confirmed=body.confirmed,
            confirm_token=body.confirm_token,
            target=body.target,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/data/backup")
def api_create_backup(body: BackupRequest | None = None) -> dict[str, Any]:
    out = body.output_path if body else None
    try:
        return create_backup_archive(output_path=out)
    except (OSError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/data/restore/inspect")
def api_inspect_restore(body: RestoreInspectRequest) -> dict[str, Any]:
    try:
        return inspect_backup_archive(body.zip_path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/data/restore")
def api_restore_backup(body: RestoreRequest) -> dict[str, Any]:
    try:
        return restore_backup_archive(
            body.zip_path,
            confirm_step=body.confirm_step,
            confirmed=body.confirmed,
            confirm_token=body.confirm_token,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

