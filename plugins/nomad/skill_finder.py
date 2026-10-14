"""Skill finder for active and dormant skills in the Nomad skill pack (M-087).

Allows the agent to search across all ~420 bundled/installed skills (both active
in the system prompt index and dormant skills gated out of the prompt index to
stay within the <= 12,000 char budget) and load the full SKILL.md of any skill.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from . import core_adapter

SKIP_DIRS = {".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv", ".tox", "dist", "build"}

_RU_ENDINGS = (
    "иями", "ями", "ами", "ого", "ему", "ому", "ыми", "ими",
    "ть", "ти", "ся", "сь", "ешь", "ет", "ем", "ете", "ут", "ют", "ит", "ат", "ят",
    "ой", "ей", "ий", "ый", "ая", "яя", "ое", "ее", "ые", "ие",
    "ам", "ям", "ах", "ях", "ов", "ев", "ей", "ом", "ем",
    "ия", "ие", "ий", "а", "я", "о", "е", "ы", "и", "у", "ю", "ь",
)

_STOPWORDS = {
    "как", "что", "это", "для", "при", "или", "без", "над", "под", "про", "все", "всё",
    "мне", "мой", "моя", "мои", " наш", "ваш", "его", "ее", "её", "их", "тут", "там",
    "где", "когда", "если", "чтобы", "через", "после", "перед", "между", "нужно", "надо",
    "сделай", "сделать", "хочу", "могу", "помоги", "покажи", "найди", "найти", "используй",
    "the", "and", "for", "with", "from", "that", "this", "into", "when", "use", "using",
    "how", "what", "why", "where", "who", "can", "will", "should", "need", "make",
}

_WORD_RE = re.compile(r"[a-zа-яё0-9][a-zа-яё0-9_-]*", re.IGNORECASE)
_TRIG_LINE_RE = re.compile(r"(?:триггер\w*|triggers?|use when|когда применять)[:\s—-]+([^\n]+)", re.IGNORECASE)


def _stem(word: str) -> str:
    w = word.lower().replace("ё", "е")
    if len(w) <= 3:
        return w
    for suf in _RU_ENDINGS:
        if len(w) - len(suf) >= 3 and w.endswith(suf):
            return w[: -len(suf)]
    if len(w) > 4 and w.endswith(("ing", "ers", "ies")):
        return w[:-3]
    if len(w) > 3 and w.endswith(("ed", "es", "er", "ly")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith("ss"):
        return w[:-1]
    return w


def _tokens(text: str) -> list[str]:
    out: list[str] = []
    for m in _WORD_RE.finditer(text.lower().replace("ё", "е")):
        tok = m.group(0)
        if tok in _STOPWORDS or len(tok) < 2:
            continue
        out.append(_stem(tok))
        if "-" in tok or "_" in tok:
            for part in re.split(r"[-_]+", tok):
                if len(part) >= 2 and part not in _STOPWORDS:
                    out.append(_stem(part))
    return out


def _parse_frontmatter_and_body(content: str) -> tuple[dict[str, Any], str]:
    if not content.startswith("---"):
        return {}, content
    end = content.find("\n---", 3)
    if end == -1:
        return {}, content
    fm_text = content[3:end]
    body = content[end + 4 :].lstrip("\r\n")
    meta: dict[str, Any] = {}
    for line in fm_text.splitlines():
        if ":" not in line or line.lstrip().startswith("#"):
            continue
        k, _, v = line.partition(":")
        key = k.strip()
        val = v.strip()
        if val.startswith("[") and val.endswith("]"):
            items = [x.strip().strip("'\"") for x in val[1:-1].split(",") if x.strip()]
            meta[key] = items
        else:
            meta[key] = val.strip("'\"")
    return meta, body


def _skill_roots() -> list[Path]:
    roots: list[Path] = []
    seen: set[str] = set()

    def _add(p: Path) -> None:
        try:
            resolved = str(p.expanduser().resolve())
        except OSError:
            resolved = str(p)
        if resolved not in seen and p.is_dir():
            seen.add(resolved)
            roots.append(p)

    try:
        hhome = core_adapter.get_hermes_home()
        _add(hhome / "skills")
    except Exception:
        pass

    try:
        cfg = core_adapter.load_config() or {}
        ext = (cfg.get("skills") or {}).get("external_dirs") or []
        for entry in ext:
            if entry:
                _add(Path(str(entry)).expanduser())
    except Exception:
        pass

    pkg_skills = Path(__file__).resolve().parents[2] / "skills"
    _add(pkg_skills)
    return roots


def disabled_names() -> set[str]:
    try:
        cfg = core_adapter.load_config() or {}
        raw = (cfg.get("skills") or {}).get("disabled") or []
        if isinstance(raw, list):
            return {str(x).strip() for x in raw if x}
    except Exception:
        pass
    return set()


_INDEX_CACHE: tuple[tuple[str, ...], list[dict[str, Any]]] | None = None


def clear_cache() -> None:
    global _INDEX_CACHE
    _INDEX_CACHE = None


def _build_index() -> list[dict[str, Any]]:
    global _INDEX_CACHE
    roots = _skill_roots()
    disabled = disabled_names()
    cache_key = tuple(str(r) for r in roots) + tuple(sorted(disabled))
    if _INDEX_CACHE is not None and _INDEX_CACHE[0] == cache_key:
        return _INDEX_CACHE[1]

    records: list[dict[str, Any]] = []
    seen_names: set[str] = set()

    for root in roots:
        for dirpath, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS and not d.startswith("."))
            if "SKILL.md" not in files:
                continue
            skill_md = Path(dirpath) / "SKILL.md"
            skill_dir = skill_md.parent
            name = skill_dir.name
            if name in seen_names:
                continue
            seen_names.add(name)

            try:
                content = skill_md.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue

            meta, body = _parse_frontmatter_and_body(content)
            desc = str(meta.get("description") or "").strip()
            cat = str(meta.get("category") or skill_dir.parent.name or "general").strip()
            req_apps = meta.get("requires_apps") or []
            if isinstance(req_apps, str):
                req_apps = [req_apps]

            is_dormant = (name in disabled) or ("dormant" in req_apps)

            head_body = body[:2500]
            triggers_list = _TRIG_LINE_RE.findall(content[:3500])
            triggers_text = " ".join(triggers_list)

            records.append(
                {
                    "name": name,
                    "category": cat,
                    "description": desc,
                    "active": not is_dormant,
                    "path": skill_md,
                    "name_tokens": set(_tokens(name)),
                    "desc_tokens": set(_tokens(desc)),
                    "trig_tokens": set(_tokens(triggers_text)),
                    "body_tokens": set(_tokens(head_body)),
                    "raw_lower": (name + " " + desc + " " + triggers_text + " " + head_body).lower().replace("ё", "е"),
                }
            )

    _INDEX_CACHE = (cache_key, records)
    return records


def dormant_count() -> int:
    return sum(1 for r in _build_index() if not r["active"])


def search_skills(query: str, top_n: int = 8) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    q_low = q.lower().replace("ё", "е")
    q_tokens = _tokens(q)
    if not q_tokens and len(q_low) < 2:
        return []

    scored: list[tuple[float, dict[str, Any]]] = []
    for rec in _build_index():
        score = 0.0
        if q_low == rec["name"].lower():
            score += 50.0
        elif q_low in rec["name"].lower():
            score += 20.0
        elif q_low in rec["raw_lower"]:
            score += 12.0

        for qt in q_tokens:
            if qt in rec["name_tokens"]:
                score += 8.0
            if qt in rec["trig_tokens"]:
                score += 6.0
            if qt in rec["desc_tokens"]:
                score += 5.0
            if qt in rec["body_tokens"]:
                score += 3.0
            # Prefix match for Russian/English inflections
            if len(qt) >= 4:
                if any(t.startswith(qt) or qt.startswith(t) for t in rec["trig_tokens"] if len(t) >= 4):
                    score += 3.5
                elif any(t.startswith(qt) or qt.startswith(t) for t in rec["body_tokens"] if len(t) >= 4):
                    score += 2.0

        if score > 0:
            scored.append((score, rec))

    scored.sort(key=lambda item: (-item[0], item[1]["name"]))
    results: list[dict[str, Any]] = []
    for score, rec in scored[: max(1, int(top_n))]:
        results.append(
            {
                "name": rec["name"],
                "category": rec["category"],
                "description": rec["description"],
                "active": rec["active"],
                "status": "активен" if rec["active"] else "спящий",
                "score": round(score, 2),
                "path": str(rec["path"]),
            }
        )
    return results


def show_skill(name: str) -> str:
    target = (name or "").strip().lstrip("/")
    if not target:
        return "Skill name is required."
    target_low = target.lower()
    for rec in _build_index():
        if rec["name"].lower() == target_low:
            try:
                return rec["path"].read_text(encoding="utf-8", errors="replace")
            except OSError as exc:
                return f"Error reading skill '{target}': {exc}"
    return f"Skill '{target}' not found."


def schema(n_dormant: int | None = None) -> dict[str, Any]:
    desc = (
        "Search across all bundled and installed skills (both active and dormant/sleeping skills) "
        "by task description in Russian or English, or load the full SKILL.md of a specific skill "
        "by name (`show`), even when the skill is dormant and omitted from the system prompt index."
    )
    if n_dormant:
        desc += f" ({n_dormant} dormant skills available via search/show.)"
    return {
        "name": "skill_find",
        "description": desc,
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Task description or keywords in Russian or English (e.g. 'вырежи паузы', 'landing page', 'audit').",
                },
                "show": {
                    "type": "string",
                    "description": "Exact skill name to read its full SKILL.md content (works for both active and dormant skills).",
                },
                "top_n": {
                    "type": "integer",
                    "description": "Maximum number of search matches to return (default: 8).",
                },
            },
        },
    }


FIND_SCHEMA = schema()
CCPACK_FIND_SCHEMA = FIND_SCHEMA


def handle_find(args: dict[str, Any] | str | None = None, **_kw: Any) -> str:
    if isinstance(args, str):
        try:
            args = json.loads(args) if args.strip().startswith("{") else {"query": args}
        except Exception:
            args = {"query": args}
    params = args if isinstance(args, dict) else {}

    show_name = str(params.get("show") or "").strip()
    if show_name:
        return show_skill(show_name)

    query = str(params.get("query") or "").strip()
    top_n = int(params.get("top_n") or 8)
    if not query:
        return "Укажите `query` для поиска навыка или `show` с именем навыка для чтения SKILL.md."

    hits = search_skills(query, top_n=top_n)
    if not hits:
        return f"По запросу «{query}» навыков не найдено."

    lines = [f"Найдено навыков по запросу «{query}» ({len(hits)}):"]
    for h in hits:
        badge = "[активен]" if h["active"] else "[спящий]"
        lines.append(f"- {h['name']} ({h['category']}) {badge} — {h['description']}")
    lines.append("\nДля чтения полного текста навыка вызови skill_find(show=\"<имя>\").")
    return "\n".join(lines)


handle = handle_find
ccpack_find = handle_find
