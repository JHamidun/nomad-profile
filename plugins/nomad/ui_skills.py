"""М-138: Экран и маршруты «Навыки Nomad» (`/nomad-skills`, K11).

Отдаёт список установленных в профиле навыков (`$HERMES_HOME/skills/**/SKILL.md`
и `skills.external_dirs`) с русскими пользовательскими описаниями из
`package/plugins/nomad/data/descriptions.ru.yaml`.

Для навыков, присутствующих в словаре `descriptions.ru.yaml`, возвращается
русское описание (`has_ru_translation=True`, `user_description=<ru>`).
Для навыков без перевода возвращается исходное английское описание из
фронтматтера `SKILL.md` с явной пометкой (`has_ru_translation=False`,
`language_note="Описание на английском (русский перевод пока не добавлен)"`).

Все обращения к путям и конфигу профиля выполняются строго через `core_adapter`.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
from typing import Any, Sequence

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import yaml

from . import core_adapter, profile_config

DESCRIPTIONS_RU_PATH = Path(__file__).resolve().parent / "data" / "descriptions.ru.yaml"

SKIP_SKILL_SUBDIRS = frozenset({
    ".archive",
    ".git",
    ".github",
    ".hub",
    ".locks",
    "__pycache__",
    "node_modules",
    "references",
    "templates",
    "scripts",
    "assets",
    "examples",
})

UNTRANSLATED_NOTE = "Описание на английском (русский перевод пока не добавлен)"
UNTRANSLATED_BADGE = "На английском (без перевода)"
TRANSLATED_BADGE = "Русское описание"


class SkillToggleRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    enabled: bool


class BundleSaveRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    skills: list[str] = Field(default_factory=list)
    description: str = ""
    instruction: str = ""
    overwrite: bool = True


class CuratorSkillRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)


class CuratorPinRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    pinned: bool = True


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def load_ru_descriptions(yaml_path: Path | None = None) -> dict[str, Any]:
    """Загрузить словарь русских описаний `descriptions.ru.yaml`."""
    target = Path(yaml_path) if yaml_path is not None else DESCRIPTIONS_RU_PATH
    if not target.is_file():
        return {"categories": {}, "skills": {}}
    try:
        raw = yaml.safe_load(target.read_text(encoding="utf-8"))
    except Exception:
        return {"categories": {}, "skills": {}}
    if not isinstance(raw, dict):
        return {"categories": {}, "skills": {}}

    categories = raw.get("categories") if isinstance(raw.get("categories"), dict) else {}
    skills_block = raw.get("skills") if isinstance(raw.get("skills"), dict) else {}

    # Поддержка плоского формата (если ключи навыков лежат и на верхнем уровне)
    merged_skills: dict[str, dict[str, str]] = {}
    for key, val in raw.items():
        if key in ("categories", "skills"):
            continue
        norm = _normalize_ru_entry(key, val)
        if norm:
            merged_skills[key] = norm
    for key, val in skills_block.items():
        norm = _normalize_ru_entry(key, val)
        if norm:
            merged_skills[key] = norm

    return {
        "categories": {str(k): str(v) for k, v in categories.items() if v},
        "skills": merged_skills,
    }


def _normalize_ru_entry(skill_name: str, raw_entry: Any) -> dict[str, str] | None:
    if isinstance(raw_entry, str):
        text = raw_entry.strip()
        if not text:
            return None
        return {
            "title": skill_name,
            "user_description": text,
            "category_ru": "",
        }
    if isinstance(raw_entry, dict):
        desc = str(
            raw_entry.get("user_description")
            or raw_entry.get("description")
            or raw_entry.get("summary")
            or ""
        ).strip()
        if not desc:
            return None
        title = str(raw_entry.get("title") or skill_name).strip() or skill_name
        category_ru = str(raw_entry.get("category_ru") or raw_entry.get("category") or "").strip()
        return {
            "title": title,
            "user_description": desc,
            "category_ru": category_ru,
        }
    return None


def parse_skill_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Разобрать YAML-фронтматтер `SKILL.md` и вернуть `(meta, body)`."""
    if not text.startswith("---"):
        return {}, text.strip()
    lines = text.splitlines()
    end_idx: int | None = None
    for idx in range(1, len(lines)):
        if lines[idx].strip() == "---":
            end_idx = idx
            break
    if end_idx is None:
        return {}, text.strip()
    yaml_chunk = "\n".join(lines[1:end_idx])
    body = "\n".join(lines[end_idx + 1 :]).strip()
    try:
        parsed = yaml.safe_load(yaml_chunk)
        if isinstance(parsed, dict):
            return parsed, body
    except Exception:
        pass
    return {}, body


def _iter_skill_files(skills_root: Path) -> list[Path]:
    """Найти все `SKILL.md` в каталоге навыков, пропуская служебные подпапки."""
    if not skills_root.is_dir():
        return []
    found: list[Path] = []

    def _walk(current: Path, depth: int) -> None:
        if depth > 4:
            return
        skill_md = current / "SKILL.md"
        if skill_md.is_file():
            found.append(skill_md)
            return
        try:
            children = sorted(current.iterdir(), key=lambda p: p.name.lower())
        except OSError:
            return
        for child in children:
            if not child.is_dir():
                continue
            if child.name.startswith(".") or child.name in SKIP_SKILL_SUBDIRS:
                continue
            _walk(child, depth + 1)

    _walk(skills_root, 0)
    return found


def _load_profile_cfg(home: Path) -> dict[str, Any]:
    cfg_path = home / "config.yaml"
    if cfg_path.is_file():
        loaded = profile_config.load(cfg_path)
        if isinstance(loaded, dict):
            return loaded
    try:
        cfg = core_adapter.load_config()
        if isinstance(cfg, dict):
            return cfg
    except Exception:
        pass
    return {}


def _save_profile_cfg(home: Path, cfg: dict[str, Any]) -> None:
    cfg_path = home / "config.yaml"
    try:
        if Path(core_adapter.get_hermes_home()).resolve() == home.resolve():
            core_adapter.save_config(cfg)
            if cfg_path.is_file():
                return
    except Exception:
        pass
    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = cfg_path.with_suffix(".yaml.tmp")
    tmp_path.write_text(
        yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    tmp_path.replace(cfg_path)


def _disabled_skill_set(cfg: dict[str, Any]) -> set[str]:
    skills_cfg = cfg.get("skills")
    if not isinstance(skills_cfg, dict):
        return set()
    disabled = skills_cfg.get("disabled")
    if not isinstance(disabled, list):
        return set()
    return {str(item).strip() for item in disabled if str(item).strip()}


def _skill_roots(home: Path, cfg: dict[str, Any]) -> list[tuple[Path, str]]:
    roots: list[tuple[Path, str]] = [(home / "skills", "profile")]
    skills_cfg = cfg.get("skills")
    if isinstance(skills_cfg, dict):
        ext_dirs = skills_cfg.get("external_dirs")
        if isinstance(ext_dirs, list):
            for raw_dir in ext_dirs:
                if not raw_dir:
                    continue
                p = Path(str(raw_dir)).expanduser()
                if p.is_dir():
                    roots.append((p, "external"))
    return roots


def _extract_tags(frontmatter: dict[str, Any]) -> list[str]:
    tags = frontmatter.get("tags")
    if isinstance(tags, list):
        return [str(t).strip() for t in tags if str(t).strip()]
    metadata = frontmatter.get("metadata")
    if isinstance(metadata, dict):
        hermes_meta = metadata.get("hermes") or metadata.get("nomad")
        if isinstance(hermes_meta, dict) and isinstance(hermes_meta.get("tags"), list):
            return [str(t).strip() for t in hermes_meta["tags"] if str(t).strip()]
    return []


def _usage_file_path(home: Path) -> Path:
    return home / "skills" / ".usage.json"


def _archive_dir_path(home: Path) -> Path:
    return home / "skills" / ".archive"


def _suppressed_file_path(home: Path) -> Path:
    return home / "skills" / ".curator_suppressed"


def _load_usage_map(home: Path) -> dict[str, dict[str, Any]]:
    path = _usage_file_path(home)
    if not path.is_file():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return {}
    if not isinstance(raw, dict):
        return {}
    return {str(k): dict(v) for k, v in raw.items() if isinstance(v, dict)}


def _save_usage_map(home: Path, data: dict[str, dict[str, Any]]) -> None:
    path = _usage_file_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_suffix(".json.tmp")
    tmp_path.write_text(
        json.dumps(data, indent=2, sort_keys=True, ensure_ascii=False),
        encoding="utf-8",
    )
    tmp_path.replace(path)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _default_usage_record() -> dict[str, Any]:
    return {
        "created_by": "agent",
        "use_count": 0,
        "view_count": 0,
        "last_used_at": None,
        "last_viewed_at": None,
        "patch_count": 0,
        "patch_generation": 0,
        "last_reused_patch_generation": 0,
        "last_patched_at": None,
        "created_at": _now_iso(),
        "state": "active",
        "pinned": False,
        "archived_at": None,
        "first_seen_at": None,
    }


def list_skills(
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
    query: str = "",
    category: str = "",
    only_translated: bool = False,
    only_enabled: bool = False,
) -> dict[str, Any]:
    """Собрать список навыков с русскими описаниями и пометками для непереведённых."""
    resolved_home = _resolve_home(home)
    cfg = _load_profile_cfg(resolved_home)
    disabled_set = _disabled_skill_set(cfg)
    usage_map = _load_usage_map(resolved_home)
    ru_dict = load_ru_descriptions(descriptions_path)
    ru_skills: dict[str, dict[str, str]] = ru_dict["skills"]
    ru_categories: dict[str, str] = ru_dict["categories"]

    seen_names: set[str] = set()
    items: list[dict[str, Any]] = []

    for root_dir, source_kind in _skill_roots(resolved_home, cfg):
        for skill_md in _iter_skill_files(root_dir):
            try:
                raw_text = skill_md.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            frontmatter, body = parse_skill_frontmatter(raw_text)
            rel_parts = skill_md.parent.relative_to(root_dir).parts
            fallback_name = skill_md.parent.name
            skill_name = str(frontmatter.get("name") or fallback_name).strip() or fallback_name
            if skill_name in seen_names:
                continue
            seen_names.add(skill_name)

            raw_category = rel_parts[0] if len(rel_parts) > 1 else str(frontmatter.get("category") or "general")
            en_description = str(frontmatter.get("description") or "").strip()
            if not en_description and body:
                first_para = next((line.strip("# ").strip() for line in body.splitlines() if line.strip()), "")
                en_description = first_para[:240]

            ru_entry = ru_skills.get(skill_name) or ru_skills.get(fallback_name)
            has_ru = ru_entry is not None and bool(ru_entry.get("user_description"))

            category_ru = (
                (ru_entry.get("category_ru") if ru_entry else "")
                or ru_categories.get(raw_category)
                or raw_category
            )

            if has_ru and ru_entry is not None:
                ru_desc = ru_entry["user_description"]
                title_display = ru_entry.get("title") or skill_name
                description_display = ru_desc
                user_description = ru_desc
                language_note = None
                badge = TRANSLATED_BADGE
            else:
                ru_desc = None
                title_display = skill_name
                base_en = en_description or "No description provided"
                description_display = f"{base_en} — {UNTRANSLATED_NOTE}"
                user_description = description_display
                language_note = UNTRANSLATED_NOTE
                badge = UNTRANSLATED_BADGE

            enabled = skill_name not in disabled_set
            tags = _extract_tags(frontmatter)
            usage_rec = usage_map.get(skill_name) or {}

            items.append(
                {
                    "name": skill_name,
                    "title": title_display,
                    "category": raw_category,
                    "category_ru": category_ru,
                    "enabled": enabled,
                    "pinned": bool(usage_rec.get("pinned", False)),
                    "curator_state": str(usage_rec.get("state") or "active"),
                    "use_count": int(usage_rec.get("use_count") or 0),
                    "source": source_kind,
                    "path": str(skill_md.relative_to(root_dir)).replace("\\", "/"),
                    "has_ru_translation": has_ru,
                    "user_description": user_description,
                    "description": description_display,
                    "description_ru": ru_desc,
                    "description_en": en_description,
                    "language": "ru" if has_ru else "en",
                    "language_note": language_note,
                    "badge": badge,
                    "tags": tags,
                }
            )

    # Сортировка: сначала с русским описанием по категории и имени, затем остальные
    items.sort(key=lambda s: (not s["has_ru_translation"], s["category_ru"].lower(), s["name"].lower()))

    total_all = len(items)
    translated_all = sum(1 for s in items if s["has_ru_translation"])
    untranslated_all = total_all - translated_all
    enabled_all = sum(1 for s in items if s["enabled"])
    disabled_all = total_all - enabled_all

    categories_map: dict[str, dict[str, Any]] = {}
    for item in items:
        cat_id = item["category"]
        if cat_id not in categories_map:
            categories_map[cat_id] = {
                "id": cat_id,
                "label": item["category_ru"],
                "count": 0,
            }
        categories_map[cat_id]["count"] += 1

    filtered = items
    q_norm = query.strip().lower()
    if q_norm:
        filtered = [
            s
            for s in filtered
            if q_norm in s["name"].lower()
            or q_norm in s["title"].lower()
            or q_norm in s["description"].lower()
            or q_norm in (s["description_en"] or "").lower()
            or q_norm in s["category_ru"].lower()
            or any(q_norm in t.lower() for t in s["tags"])
        ]
    cat_norm = category.strip().lower()
    if cat_norm and cat_norm != "all":
        filtered = [
            s
            for s in filtered
            if s["category"].lower() == cat_norm or s["category_ru"].lower() == cat_norm
        ]
    if only_translated:
        filtered = [s for s in filtered if s["has_ru_translation"]]
    if only_enabled:
        filtered = [s for s in filtered if s["enabled"]]

    return {
        "ok": True,
        "total": total_all,
        "filtered_total": len(filtered),
        "translated_count": translated_all,
        "untranslated_count": untranslated_all,
        "enabled_count": enabled_all,
        "disabled_count": disabled_all,
        "categories": sorted(categories_map.values(), key=lambda c: c["label"].lower()),
        "skills": filtered,
    }


def get_skill_detail(
    skill_name: str,
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Вернуть подробную карточку навыка вместе с содержимым `SKILL.md`."""
    resolved_home = _resolve_home(home)
    listing = list_skills(home=resolved_home, descriptions_path=descriptions_path)
    target = next((s for s in listing["skills"] if s["name"] == skill_name), None)
    if target is None:
        raise KeyError(f"Навык '{skill_name}' не найден")

    cfg = _load_profile_cfg(resolved_home)
    body_text = ""
    for root_dir, _ in _skill_roots(resolved_home, cfg):
        candidate = root_dir / target["path"]
        if candidate.is_file():
            raw_text = candidate.read_text(encoding="utf-8", errors="replace")
            _, body_text = parse_skill_frontmatter(raw_text)
            break

    detail = dict(target)
    detail["body"] = body_text
    return detail


def set_skill_enabled(
    skill_name: str,
    enabled: bool,
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Включить или выключить навык в `config.yaml` (`skills.disabled`)."""
    resolved_home = _resolve_home(home)
    cfg = _load_profile_cfg(resolved_home)
    skills_cfg = cfg.get("skills")
    if not isinstance(skills_cfg, dict):
        skills_cfg = {}
    disabled_raw = skills_cfg.get("disabled")
    disabled_list = [str(x).strip() for x in disabled_raw if str(x).strip()] if isinstance(disabled_raw, list) else []

    if enabled:
        disabled_list = [x for x in disabled_list if x != skill_name]
    else:
        if skill_name not in disabled_list:
            disabled_list.append(skill_name)

    skills_cfg["disabled"] = disabled_list
    cfg["skills"] = skills_cfg
    _save_profile_cfg(resolved_home, cfg)

    listing = list_skills(home=resolved_home, descriptions_path=descriptions_path)
    updated_skill = next((s for s in listing["skills"] if s["name"] == skill_name), None)
    return {
        "ok": True,
        "name": skill_name,
        "enabled": enabled,
        "disabled": disabled_list,
        "skill": updated_skill,
    }


# ---------------------------------------------------------------------------
# M-139: Вкладка «Наборы» (skill-bundles)
# ---------------------------------------------------------------------------

_BUNDLE_INVALID_CHARS = re.compile(r"[^\w-]")
_BUNDLE_MULTI_HYPHEN = re.compile(r"-{2,}")


def slugify_bundle_name(name: str) -> str:
    """Нормализация имени набора навыков в слэш-команду (совпадает с `agent.skill_commands.slugify_skill_name`)."""
    cmd = _BUNDLE_INVALID_CHARS.sub("", (name or "").lower().replace(" ", "-").replace("_", "-"))
    return _BUNDLE_MULTI_HYPHEN.sub("-", cmd).strip("-")


def _bundles_dir(home: Path | None = None) -> Path:
    override = os.environ.get("HERMES_BUNDLES_DIR")
    if override:
        return Path(override).expanduser()
    return _resolve_home(home) / "skill-bundles"


def _load_bundle_file(path: Path) -> dict[str, Any] | None:
    try:
        data = yaml.safe_load(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    name = str(data.get("name") or path.stem).strip()
    if not name:
        return None
    raw_skills = data.get("skills") or []
    if not isinstance(raw_skills, list):
        return None
    skills = [str(s).strip() for s in raw_skills if str(s).strip()]
    if not skills:
        return None
    slug = slugify_bundle_name(name)
    if not slug:
        return None
    description = str(data.get("description") or "").strip() or f"Набор из {len(skills)} навыков"
    instruction = str(data.get("instruction") or "").strip()
    return {
        "name": name,
        "slug": slug,
        "command": f"/{slug}",
        "skills": skills,
        "description": description,
        "instruction": instruction,
        "path": str(path),
    }


def list_bundles(*, home: Path | None = None) -> dict[str, Any]:
    """Вернуть список наборов навыков из `<HERMES_HOME>/skill-bundles/`."""
    bdir = _bundles_dir(home)
    bundles_by_slug: dict[str, dict[str, Any]] = {}
    if bdir.is_dir():
        files = [f for ext in ("*.yaml", "*.yml") for f in sorted(bdir.glob(ext))]
        for fpath in files:
            info = _load_bundle_file(fpath)
            if info and info["slug"] not in bundles_by_slug:
                bundles_by_slug[info["slug"]] = info
    items = sorted(bundles_by_slug.values(), key=lambda b: b["slug"])
    return {
        "ok": True,
        "count": len(items),
        "bundles": items,
    }


def save_bundle(
    name: str,
    skills: Sequence[str],
    *,
    description: str = "",
    instruction: str = "",
    overwrite: bool = True,
    home: Path | None = None,
) -> dict[str, Any]:
    """Создать или обновить набор навыков в `<HERMES_HOME>/skill-bundles/<slug>.yaml`."""
    cleaned_name = (name or "").strip()
    if not cleaned_name:
        raise ValueError("Укажите название набора навыков.")
    slug = slugify_bundle_name(cleaned_name)
    if not slug:
        raise ValueError(f"Название набора {cleaned_name!r} не содержит допустимых символов.")
    cleaned_skills = [str(s).strip() for s in skills if str(s).strip()]
    if not cleaned_skills:
        raise ValueError("Выберите хотя бы один навык для набора.")

    bdir = _bundles_dir(home)
    path = bdir / f"{slug}.yaml"
    if path.exists() and not overwrite:
        raise FileExistsError(f"Набор «{cleaned_name}» уже существует.")

    bdir.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "name": cleaned_name,
        "skills": cleaned_skills,
    }
    if description and description.strip():
        payload["description"] = description.strip()
    if instruction and instruction.strip():
        payload["instruction"] = instruction.strip()

    path.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    bundle_info = _load_bundle_file(path) or {
        "name": cleaned_name,
        "slug": slug,
        "command": f"/{slug}",
        "skills": cleaned_skills,
        "description": description.strip(),
        "instruction": instruction.strip(),
        "path": str(path),
    }
    return {
        "ok": True,
        "bundle": bundle_info,
        "bundles": list_bundles(home=home)["bundles"],
    }


def delete_bundle(name: str, *, home: Path | None = None) -> dict[str, Any]:
    """Удалить набор навыков по имени или слагу."""
    slug = slugify_bundle_name(name)
    if not slug:
        raise KeyError(f"Набор {name!r} не найден.")
    bdir = _bundles_dir(home)
    candidates = [bdir / f"{slug}.yaml", bdir / f"{slug}.yml"]
    target = next((p for p in candidates if p.is_file()), None)
    if target is None:
        raise KeyError(f"Набор «{name}» не найден.")
    target.unlink()
    return {
        "ok": True,
        "deleted": slug,
        "bundles": list_bundles(home=home)["bundles"],
    }


# ---------------------------------------------------------------------------
# M-139: Вкладка «Архив» (curator: list-archived, restore, pin/unpin, archive; БЕЗ purge)
# ---------------------------------------------------------------------------

def _find_local_skill_dir(skills_root: Path, skill_name: str) -> Path | None:
    if not skills_root.is_dir():
        return None
    for skill_md in _iter_skill_files(skills_root):
        try:
            raw_text = skill_md.read_text(encoding="utf-8", errors="replace")[:4000]
        except OSError:
            continue
        fm, _ = parse_skill_frontmatter(raw_text)
        candidate_name = str(fm.get("name") or skill_md.parent.name).strip()
        if candidate_name == skill_name or skill_md.parent.name == skill_name:
            return skill_md.parent
    return None


def list_curator_state(
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Вернуть список архивных навыков (`.archive/`) и закреплённых/управляемых навыков."""
    resolved_home = _resolve_home(home)
    usage_map = _load_usage_map(resolved_home)
    ru_dict = load_ru_descriptions(descriptions_path)
    ru_skills: dict[str, dict[str, str]] = ru_dict["skills"]

    archive_root = _archive_dir_path(resolved_home)
    archived_items: list[dict[str, Any]] = []
    if archive_root.is_dir():
        for entry in sorted(archive_root.iterdir(), key=lambda p: p.name.lower()):
            if not entry.is_dir():
                continue
            skill_md = entry / "SKILL.md"
            frontmatter: dict[str, Any] = {}
            body = ""
            if skill_md.is_file():
                try:
                    raw_text = skill_md.read_text(encoding="utf-8", errors="replace")
                    frontmatter, body = parse_skill_frontmatter(raw_text)
                except OSError:
                    pass
            skill_name = entry.name
            ru_entry = ru_skills.get(skill_name)
            en_desc = str(frontmatter.get("description") or "").strip()
            if not en_desc and body:
                en_desc = next((line.strip("# ").strip() for line in body.splitlines() if line.strip()), "")[:240]
            desc = (ru_entry.get("user_description") if ru_entry else None) or en_desc or "Архивный навык"
            title = (ru_entry.get("title") if ru_entry else None) or str(frontmatter.get("name") or skill_name)
            rec = usage_map.get(skill_name) or {}
            archived_items.append(
                {
                    "name": skill_name,
                    "title": title,
                    "description": desc,
                    "state": "archived",
                    "archived_at": rec.get("archived_at"),
                    "use_count": int(rec.get("use_count") or 0),
                    "pinned": bool(rec.get("pinned", False)),
                    "path": str(entry),
                }
            )

    active_listing = list_skills(home=resolved_home, descriptions_path=descriptions_path)["skills"]
    pinned_names = sorted(
        {
            s["name"]
            for s in active_listing
            if s.get("pinned")
        }
        | {
            name
            for name, rec in usage_map.items()
            if isinstance(rec, dict) and bool(rec.get("pinned")) and rec.get("state") != "archived"
        }
    )

    return {
        "ok": True,
        "purge_allowed": False,
        "archived_count": len(archived_items),
        "archived": archived_items,
        "pinned_skills": pinned_names,
        "active_skills": [
            {
                "name": s["name"],
                "title": s["title"],
                "description": s["description"],
                "pinned": bool(s.get("pinned", False)),
                "state": s.get("curator_state", "active"),
                "use_count": s.get("use_count", 0),
            }
            for s in active_listing
        ],
    }


def restore_archived_skill(
    skill_name: str,
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Восстановить навык из `<HERMES_HOME>/skills/.archive/<name>` в `<HERMES_HOME>/skills/<name>`."""
    cleaned = (skill_name or "").strip()
    if not cleaned:
        raise ValueError("Укажите имя навыка для восстановления.")
    resolved_home = _resolve_home(home)
    src = _archive_dir_path(resolved_home) / cleaned
    if not src.is_dir():
        raise KeyError(f"Архивный навык «{cleaned}» не найден.")
    dest = resolved_home / "skills" / cleaned
    if dest.exists():
        raise FileExistsError(f"Активный навык «{cleaned}» уже существует в каталоге навыков.")

    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        src.rename(dest)
    except OSError:
        shutil.move(str(src), str(dest))

    # Снимаем из .curator_suppressed при наличии
    suppressed_path = _suppressed_file_path(resolved_home)
    if suppressed_path.is_file():
        try:
            lines = [
                ln.strip()
                for ln in suppressed_path.read_text(encoding="utf-8-sig").splitlines()
                if ln.strip() and ln.strip() != cleaned
            ]
            suppressed_path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")
        except OSError:
            pass

    usage_map = _load_usage_map(resolved_home)
    rec = {**_default_usage_record(), **(usage_map.get(cleaned) or {})}
    if not rec.get("created_by"):
        rec["created_by"] = "agent"
    rec["state"] = "active"
    rec["archived_at"] = None
    usage_map[cleaned] = rec
    _save_usage_map(resolved_home, usage_map)

    state = list_curator_state(home=resolved_home, descriptions_path=descriptions_path)
    return {
        "ok": True,
        "restored": cleaned,
        **state,
    }


def archive_active_skill(
    skill_name: str,
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Переместить навык в `<HERMES_HOME>/skills/.archive/<name>` (без удаления)."""
    cleaned = (skill_name or "").strip()
    if not cleaned:
        raise ValueError("Укажите имя навыка для архивации.")
    resolved_home = _resolve_home(home)
    skills_root = resolved_home / "skills"
    src = _find_local_skill_dir(skills_root, cleaned)
    if src is None:
        raise KeyError(f"Навык «{cleaned}» не найден в профиле.")
    archive_root = _archive_dir_path(resolved_home)
    archive_root.mkdir(parents=True, exist_ok=True)
    dest = archive_root / cleaned
    if dest.exists():
        dest = archive_root / f"{cleaned}-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    try:
        src.rename(dest)
    except OSError:
        shutil.move(str(src), str(dest))

    usage_map = _load_usage_map(resolved_home)
    rec = {**_default_usage_record(), **(usage_map.get(cleaned) or {})}
    if not rec.get("created_by"):
        rec["created_by"] = "agent"
    rec["state"] = "archived"
    rec["archived_at"] = _now_iso()
    usage_map[cleaned] = rec
    _save_usage_map(resolved_home, usage_map)

    state = list_curator_state(home=resolved_home, descriptions_path=descriptions_path)
    return {
        "ok": True,
        "archived_skill": cleaned,
        **state,
    }


def set_skill_pinned(
    skill_name: str,
    pinned: bool,
    *,
    home: Path | None = None,
    descriptions_path: Path | None = None,
) -> dict[str, Any]:
    """Закрепить (`pin`) или открепить (`unpin`) навык от автоматической архивации куратором."""
    cleaned = (skill_name or "").strip()
    if not cleaned:
        raise ValueError("Укажите имя навыка.")
    resolved_home = _resolve_home(home)
    skills_root = resolved_home / "skills"
    archive_dir = _archive_dir_path(resolved_home)
    if _find_local_skill_dir(skills_root, cleaned) is None and not (archive_dir / cleaned).is_dir():
        raise KeyError(f"Навык «{cleaned}» не найден.")

    usage_map = _load_usage_map(resolved_home)
    rec = {**_default_usage_record(), **(usage_map.get(cleaned) or {})}
    # Чтобы `hermes curator status` / `curated_report()` учитывал навык и отображал флаг `pinned`,
    # убедимся, что запись помечена `created_by: "agent"`.
    if not rec.get("created_by"):
        rec["created_by"] = "agent"
    rec["pinned"] = bool(pinned)
    usage_map[cleaned] = rec
    _save_usage_map(resolved_home, usage_map)

    state = list_curator_state(home=resolved_home, descriptions_path=descriptions_path)
    return {
        "ok": True,
        "name": cleaned,
        "pinned": bool(pinned),
        **state,
    }


router = APIRouter(tags=["nomad-skills"])


@router.get("/skills")
def api_list_skills(
    q: str = Query(default="", description="Поисковый запрос по имени, тегам или описанию"),
    category: str = Query(default="", description="Фильтр по категории"),
    only_translated: bool = Query(default=False, description="Только навыки с русским описанием"),
    only_enabled: bool = Query(default=False, description="Только включённые навыки"),
) -> dict[str, Any]:
    return list_skills(
        query=q,
        category=category,
        only_translated=only_translated,
        only_enabled=only_enabled,
    )


@router.get("/skills/descriptions")
def api_get_ru_descriptions() -> dict[str, Any]:
    data = load_ru_descriptions()
    return {
        "ok": True,
        "count": len(data["skills"]),
        "categories": data["categories"],
        "skills": data["skills"],
    }


@router.post("/skills/toggle")
@router.put("/skills/toggle")
def api_toggle_skill(body: SkillToggleRequest) -> dict[str, Any]:
    return set_skill_enabled(body.name.strip(), body.enabled)


@router.get("/skills/bundles")
def api_list_bundles() -> dict[str, Any]:
    return list_bundles()


@router.post("/skills/bundles")
@router.put("/skills/bundles")
def api_save_bundle(body: BundleSaveRequest) -> dict[str, Any]:
    try:
        return save_bundle(
            body.name,
            body.skills,
            description=body.description,
            instruction=body.instruction,
            overwrite=body.overwrite,
        )
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/skills/bundles/{bundle_name}")
def api_delete_bundle(bundle_name: str) -> dict[str, Any]:
    try:
        return delete_bundle(bundle_name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/skills/curator")
@router.get("/skills/archived")
def api_list_curator() -> dict[str, Any]:
    return list_curator_state()


@router.post("/skills/curator/restore")
def api_restore_skill(body: CuratorSkillRequest) -> dict[str, Any]:
    try:
        return restore_archived_skill(body.name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except (ValueError, FileExistsError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/skills/curator/archive")
def api_archive_skill(body: CuratorSkillRequest) -> dict[str, Any]:
    try:
        return archive_active_skill(body.name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/skills/curator/pin")
@router.put("/skills/curator/pin")
def api_pin_skill(body: CuratorPinRequest) -> dict[str, Any]:
    try:
        return set_skill_pinned(body.name, body.pinned)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/skills/curator/purge")
@router.delete("/skills/curator/purge")
def api_refuse_curator_purge() -> dict[str, Any]:
    raise HTTPException(
        status_code=403,
        detail="Безвозвратное удаление архива навыков (purge) отключено в интерфейсе для защиты ваших данных.",
    )


@router.get("/skills/{skill_name}")
def api_get_skill_detail(skill_name: str) -> dict[str, Any]:
    try:
        skill = get_skill_detail(skill_name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return {"ok": True, "skill": skill}
