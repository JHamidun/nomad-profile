"""3-слойный хаб памяти Nomad (Hermes Base + Vector Semantic Layer + Knowledge Graph) и Проекты / Субагенты с механиками `codeg`.

Архитектура 3 слоёв памяти:
  - Слой 1 (Hermes Base Memory): канонические файлы `$HERMES_HOME/memories/MEMORY.md` и `USER.md`
    с разделителем `\\n§\\n` + статистика сессий и FTS5 индекса (`messages_fts_cjk` / `messages_fts`)
    в `$HERMES_HOME/state.db`. Никогда не нарушает совместимость с базовым форматом Hermes.
  - Слой 2 (Vector Semantic Layer + Hybrid BM25 RRF): локальная SQLite-база
    `$HERMES_HOME/nomad_memory_hub.db` (таблицы `projects`, `documents`, `chunks`, `graph_nodes`,
    `graph_edges`, `worktree_sandboxes`). Строит 128-мерные L2-нормализованные векторы на CPU
    (символьные n-граммы 3..5 + словоформы RU/EN с весами) без внешних сетевых запросов (100% 152-ФЗ)
    и объединяет плотный косинусный поиск с BM25 через Reciprocal Rank Fusion (RRF).
    Поддерживает как принудительную векторизацию по кнопке (`POST /memory/vectorize`), так и
    автоматический дельта-алгоритм (`auto_vectorize_check`) по SHA-256 и `mtime_ns`.
  - Слой 3 (Knowledge Graph): автоматическое извлечение сущностей (`project`, `subagent`, `model`,
    `skill`, `document`, `person`, `concept`, `rule`) и типизированных связей (`uses`, `depends_on`,
    `contains`, `mentions`, `implements`, `related_to`) с multi-hop расширением при поиске.

Механики харнеса `codeg` для проектов и субагентов:
  - Привязка локальных папок (`folder_links`), потолок глубины делегирования (`delegation_depth_limit`),
    изоляция веток Git Worktree (`worktree_isolation`), детектор незакоммиченных изменений
    (`path_holds_uncommitted`) и двухэтапное crash-safe слияние (`Stage A: base → worktree`,
    `Stage B: worktree → main`).
"""

from __future__ import annotations

import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from . import core_adapter, ui_safety

EMBEDDING_DIM = 128
MEMORY_DELIMITER = "\n§\n"
SUPPORTED_DOC_EXTENSIONS: frozenset[str] = frozenset(
    {
        ".md",
        ".txt",
        ".py",
        ".js",
        ".jsx",
        ".ts",
        ".tsx",
        ".rs",
        ".json",
        ".yaml",
        ".yml",
        ".html",
        ".css",
        ".toml",
        ".sql",
        ".csv",
    }
)

_WORD_RE = re.compile(r"[A-Za-zА-Яа-яЁё0-9_#-]{2,}")
_HEADING_SPLIT_RE = re.compile(r"(?m)^(#{1,4}\s+.+)$")

_KNOWN_MODELS: tuple[str, ...] = (
    "claude-opus-5-5",
    "claude-sonnet-5-5",
    "claude-fable-5-1",
    "gpt-6.1-sol",
    "gpt-6-astra",
    "gpt-5.6-sol",
    "gemini-3.1-pro-preview",
    "gemini-3.8-flash",
    "deepseek-v4-pro",
    "deepseek-v4-flash",
    "kimi-k2.7-code",
    "jev-1.13.0",
    "GigaChat-2-Max",
    "YandexGPT 5 Pro",
    "Cotype Pro 3",
)

_KNOWN_CONCEPTS: tuple[tuple[str, str, str], ...] = (
    ("152-фз", "rule", "152-ФЗ Защита ПДн"),
    ("пдн", "rule", "Персональные данные (ПДн)"),
    ("dlp", "concept", "DLP-фильтр обезличивания"),
    ("worktree", "concept", "Git Worktree Песочница"),
    ("rrf", "concept", "Гибридный поиск RRF"),
    ("rag", "concept", "Векторный RAG"),
    ("council", "concept", "Совет моделей"),
    ("консилиум", "concept", "Совет моделей"),
    ("manus", "concept", "Облачная песочница Manus"),
    ("hermes", "concept", "Ядро Hermes"),
    ("nomad", "project", "Платформа Nomad"),
)


class BaseMemoryAddRequest(BaseModel):
    target: str = Field(default="memory", description="memory (MEMORY.md) | user (USER.md)")
    content: str = Field(..., min_length=1, max_length=20000)
    redact_secrets: bool = Field(default=True)


class VectorizeRequest(BaseModel):
    project_id: str | None = Field(default=None)
    force: bool = Field(default=False)
    paths: list[str] = Field(default_factory=list)


class MemorySearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=4000)
    project_id: str | None = Field(default=None)
    top_k: int = Field(default=6, ge=1, le=50)
    include_graph: bool = Field(default=True)
    include_base: bool = Field(default=True)


class ProjectCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    kind: str = Field(default="project", description="project | subagent")
    description: str = Field(default="", max_length=4000)
    system_prompt: str = Field(default="", max_length=16000)
    model_preference: str = Field(default="claude-opus-5-5", max_length=120)
    pinned_skills: list[str] = Field(default_factory=list)
    folder_links: list[str] = Field(default_factory=list)
    auto_vectorize: bool = Field(default=True)
    delegation_depth_limit: int = Field(default=3, ge=1, le=10)
    worktree_isolation: bool = Field(default=True)


class ProjectDocumentRequest(BaseModel):
    title: str = Field(default="", max_length=300)
    content: str | None = Field(default=None)
    file_path: str | None = Field(default=None)
    doc_type: str = Field(default="markdown", max_length=60)


class WorktreeSandboxRequest(BaseModel):
    task_slug: str = Field(default="feature-task", min_length=1, max_length=120)
    repo_path: str | None = Field(default=None)
    base_branch: str = Field(default="main", max_length=120)
    uncommitted_paths: list[str] = Field(default_factory=list)
    run_two_stage_merge_check: bool = Field(default=True)


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _hub_db_path(home: Path | None = None) -> Path:
    resolved = _resolve_home(home)
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved / "nomad_memory_hub.db"


def _connect_hub(home: Path | None = None) -> sqlite3.Connection:
    db_path = _hub_db_path(home)
    conn = sqlite3.connect(str(db_path), timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            kind TEXT NOT NULL DEFAULT 'project',
            description TEXT NOT NULL DEFAULT '',
            system_prompt TEXT NOT NULL DEFAULT '',
            model_preference TEXT NOT NULL DEFAULT 'claude-opus-5-5',
            pinned_skills_json TEXT NOT NULL DEFAULT '[]',
            folder_links_json TEXT NOT NULL DEFAULT '[]',
            auto_vectorize INTEGER NOT NULL DEFAULT 1,
            delegation_depth_limit INTEGER NOT NULL DEFAULT 3,
            worktree_isolation INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS documents (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            title TEXT NOT NULL,
            source_path TEXT NOT NULL DEFAULT '',
            doc_type TEXT NOT NULL DEFAULT 'markdown',
            sha256 TEXT NOT NULL,
            mtime_ns INTEGER NOT NULL DEFAULT 0,
            size_bytes INTEGER NOT NULL DEFAULT 0,
            chunk_count INTEGER NOT NULL DEFAULT 0,
            vectorized_at TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
        CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(project_id, source_path);

        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            doc_id TEXT NOT NULL,
            project_id TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            heading TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL,
            token_count INTEGER NOT NULL DEFAULT 0,
            embedding_json TEXT NOT NULL,
            terms_json TEXT NOT NULL,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project_id);
        CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(doc_id);

        CREATE TABLE IF NOT EXISTS graph_nodes (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            project_id TEXT NOT NULL DEFAULT 'global',
            source_hash TEXT NOT NULL DEFAULT '',
            valid_at TEXT NOT NULL,
            metadata_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS graph_edges (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relation TEXT NOT NULL,
            project_id TEXT NOT NULL DEFAULT 'global',
            weight REAL NOT NULL DEFAULT 1.0,
            source_hash TEXT NOT NULL DEFAULT '',
            valid_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_graph_edges_src ON graph_edges(source_id);
        CREATE INDEX IF NOT EXISTS idx_graph_edges_dst ON graph_edges(target_id);

        CREATE TABLE IF NOT EXISTS worktree_sandboxes (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            task_slug TEXT NOT NULL,
            repo_path TEXT NOT NULL,
            worktree_path TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            base_branch TEXT NOT NULL DEFAULT 'main',
            uncommitted_files_json TEXT NOT NULL DEFAULT '[]',
            path_holds_uncommitted INTEGER NOT NULL DEFAULT 0,
            stage_a_status TEXT NOT NULL DEFAULT 'ready',
            stage_b_status TEXT NOT NULL DEFAULT 'pending',
            status TEXT NOT NULL DEFAULT 'isolated',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """
    )
    conn.commit()


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


# ---------------------------------------------------------------------------
# Локальный CPU-векторизатор (128-dim L2-normalized feature hashing + BM25)
# ---------------------------------------------------------------------------

def _tokenize_terms(text: str) -> list[str]:
    raw_words = _WORD_RE.findall(str(text or "").lower())
    terms: list[str] = []
    for w in raw_words:
        terms.append(w)
        # Псевдо-стемминг русских и английских окончаний для устойчивого поиска словоформ
        if len(w) >= 6:
            terms.append(w[:5])
        if len(w) >= 4:
            terms.append(w[:4])
    return terms


def compute_cpu_embedding(text: str, dim: int = EMBEDDING_DIM) -> list[float]:
    """Построить детерминированный 128-мерный L2-нормализованный плотный вектор на CPU.

    Комбинирует:
      - словоформы и префиксы корней (вес 2.0),
      - биграммы слов (вес 2.5),
      - символьные n-граммы длины 3..5 (вес 0.75) для устойчивости к опечаткам и морфологии.
    """
    vec = [0.0] * dim
    cleaned = str(text or "").strip().lower()
    if not cleaned:
        return vec

    words = _WORD_RE.findall(cleaned)
    for idx, word in enumerate(words):
        h = int.from_bytes(hashlib.blake2b(word.encode("utf-8"), digest_size=8).digest(), "little")
        bucket = h % dim
        sign = 1.0 if ((h >> 8) & 1) == 0 else -1.0
        vec[bucket] += sign * 2.0

        if len(word) >= 5:
            stem = word[:5]
            hs = int.from_bytes(hashlib.blake2b(stem.encode("utf-8"), digest_size=8).digest(), "little")
            vec[hs % dim] += (1.0 if ((hs >> 8) & 1) == 0 else -1.0) * 1.4

        if idx + 1 < len(words):
            bigram = f"{word}_{words[idx + 1]}"
            hb = int.from_bytes(hashlib.blake2b(bigram.encode("utf-8"), digest_size=8).digest(), "little")
            vec[hb % dim] += (1.0 if ((hb >> 8) & 1) == 0 else -1.0) * 2.5

    compact = re.sub(r"\s+", " ", cleaned)[:2400]
    for n in (3, 4, 5):
        if len(compact) < n:
            continue
        for i in range(len(compact) - n + 1):
            gram = compact[i : i + n]
            hg = int.from_bytes(hashlib.blake2b(gram.encode("utf-8"), digest_size=8).digest(), "little")
            vec[hg % dim] += (1.0 if ((hg >> 8) & 1) == 0 else -1.0) * 0.65

    norm = math.sqrt(sum(v * v for v in vec))
    if norm > 1e-9:
        vec = [round(v / norm, 6) for v in vec]
    return vec


def _cosine_similarity(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    return float(sum(a * b for a, b in zip(v1, v2)))


def split_into_semantic_chunks(
    text: str,
    *,
    title: str = "",
    target_chars: int = 480,
    overlap_chars: int = 80,
) -> list[dict[str, Any]]:
    """Разбить документ на смысловые чанки по заголовкам и абзацам (~400–600 символов с перекрытием)."""
    raw = str(text or "").replace("\r\n", "\n").strip()
    if not raw:
        return []

    parts = _HEADING_SPLIT_RE.split(raw)
    sections: list[tuple[str, str]] = []
    current_heading = title or "Основной раздел"
    buf: list[str] = []

    for part in parts:
        stripped = part.strip()
        if not stripped:
            continue
        if _HEADING_SPLIT_RE.fullmatch(stripped):
            if buf:
                sections.append((current_heading, "\n\n".join(buf)))
                buf = []
            current_heading = stripped.lstrip("#").strip() or current_heading
        else:
            buf.append(stripped)
    if buf:
        sections.append((current_heading, "\n\n".join(buf)))

    chunks: list[dict[str, Any]] = []
    chunk_idx = 0
    for heading, body in sections:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
        current_text = ""
        for para in paragraphs:
            if not current_text:
                current_text = para
            elif len(current_text) + 2 + len(para) <= target_chars:
                current_text = f"{current_text}\n\n{para}"
            else:
                chunks.append(
                    {
                        "chunk_index": chunk_idx,
                        "heading": heading,
                        "content": current_text,
                        "token_count": max(1, len(current_text) // 3),
                    }
                )
                chunk_idx += 1
                tail = current_text[-overlap_chars:] if overlap_chars > 0 and len(current_text) > overlap_chars else ""
                current_text = f"{tail}\n{para}".strip() if tail else para

        while len(current_text) > target_chars * 1.5:
            slice_part = current_text[:target_chars]
            chunks.append(
                {
                    "chunk_index": chunk_idx,
                    "heading": heading,
                    "content": slice_part,
                    "token_count": max(1, len(slice_part) // 3),
                }
            )
            chunk_idx += 1
            step = max(100, target_chars - overlap_chars)
            current_text = current_text[step:].strip()

        if current_text:
            chunks.append(
                {
                    "chunk_index": chunk_idx,
                    "heading": heading,
                    "content": current_text,
                    "token_count": max(1, len(current_text) // 3),
                }
            )
            chunk_idx += 1

    return chunks


# ---------------------------------------------------------------------------
# Слой 3: Извлечение сущностей и связей в Граф Знаний (Knowledge Graph)
# ---------------------------------------------------------------------------

def _node_id(entity_type: str, label: str) -> str:
    slug = re.sub(r"[^a-zа-яё0-9_-]+", "-", label.strip().lower()).strip("-")
    if not slug:
        slug = hashlib.sha256(label.encode("utf-8")).hexdigest()[:10]
    return f"{entity_type}:{slug[:48]}"


def extract_and_store_graph_triplets(
    conn: sqlite3.Connection,
    text: str,
    *,
    source_label: str,
    source_type: str = "document",
    project_id: str = "global",
    source_hash: str = "",
) -> dict[str, int]:
    """Извлечь сущности и связи из текста и сохранить их в `graph_nodes` и `graph_edges`."""
    now = _now_iso()
    src_id = _node_id(source_type, source_label)
    nodes_added = 0
    edges_added = 0

    def _upsert_node(nid: str, label: str, etype: str, meta: dict[str, Any] | None = None) -> None:
        nonlocal nodes_added
        conn.execute(
            """
            INSERT INTO graph_nodes (id, label, entity_type, project_id, source_hash, valid_at, metadata_json)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                label=excluded.label,
                source_hash=excluded.source_hash,
                valid_at=excluded.valid_at
            """,
            (nid, label, etype, project_id, source_hash, now, json.dumps(meta or {}, ensure_ascii=False)),
        )
        nodes_added += 1

    def _upsert_edge(s_id: str, t_id: str, rel: str, weight: float = 1.0) -> None:
        nonlocal edges_added
        if s_id == t_id:
            return
        eid = f"{s_id}--{rel}-->{t_id}"
        conn.execute(
            """
            INSERT INTO graph_edges (id, source_id, target_id, relation, project_id, weight, source_hash, valid_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                weight=MAX(graph_edges.weight, excluded.weight),
                valid_at=excluded.valid_at
            """,
            (eid, s_id, t_id, rel, project_id, weight, source_hash, now),
        )
        edges_added += 1

    _upsert_node(src_id, source_label, source_type)

    if project_id and project_id != "global":
        row = conn.execute("SELECT name, kind FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row:
            p_nid = _node_id(str(row["kind"] or "project"), str(row["name"]))
            _upsert_node(p_nid, str(row["name"]), str(row["kind"] or "project"))
            _upsert_edge(p_nid, src_id, "contains", 1.2)

    low = str(text or "").lower()
    for model_name in _KNOWN_MODELS:
        if model_name.lower() in low:
            m_nid = _node_id("model", model_name)
            _upsert_node(m_nid, model_name, "model")
            _upsert_edge(src_id, m_nid, "uses", 1.1)

    for marker, etype, canonical_label in _KNOWN_CONCEPTS:
        if marker in low:
            c_nid = _node_id(etype, canonical_label)
            _upsert_node(c_nid, canonical_label, etype)
            rel = "implements" if etype == "rule" else "mentions"
            _upsert_edge(src_id, c_nid, rel, 1.0)

    # Извлечение заголовков/терминов в кавычках или жирных сущностей `**Сущность**`
    bold_entities = re.findall(r"\*\*([А-ЯЁA-Z][А-Яа-яЁёA-Za-z0-9 _.-]{2,38})\*\*", str(text or ""))
    for ent in bold_entities[:8]:
        clean_ent = ent.strip()
        if len(clean_ent) >= 3:
            e_nid = _node_id("concept", clean_ent)
            _upsert_node(e_nid, clean_ent, "concept")
            _upsert_edge(src_id, e_nid, "related_to", 0.9)

    return {"nodes_upserted": nodes_added, "edges_upserted": edges_added}


# ---------------------------------------------------------------------------
# Слой 1: Чтение и запись базовой памяти Hermes (MEMORY.md, USER.md, state.db)
# ---------------------------------------------------------------------------

def _locate_base_memory_file(resolved_home: Path, filename: str) -> Path:
    mem_dir_file = resolved_home / "memories" / filename
    root_file = resolved_home / filename
    if mem_dir_file.is_file():
        return mem_dir_file
    if root_file.is_file():
        return root_file
    return mem_dir_file


def read_hermes_base_memory(*, home: Path | None = None) -> dict[str, Any]:
    """Прочитать записи `MEMORY.md`, `USER.md` (разделитель `\\n§\\n`) и статистику `state.db`."""
    resolved_home = _resolve_home(home)
    mem_path = _locate_base_memory_file(resolved_home, "MEMORY.md")
    user_path = _locate_base_memory_file(resolved_home, "USER.md")

    def _parse_entries(path: Path, source_key: str) -> list[dict[str, Any]]:
        if not path.is_file():
            return []
        try:
            raw = path.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            return []
        if not raw:
            return []
        blocks = [b.strip() for b in raw.split("§") if b.strip()]
        out: list[dict[str, Any]] = []
        for idx, block in enumerate(blocks):
            out.append(
                {
                    "id": f"{source_key}-{idx + 1}",
                    "source": path.name,
                    "text": block,
                    "length": len(block),
                }
            )
        return out

    memory_entries = _parse_entries(mem_path, "memory")
    user_entries = _parse_entries(user_path, "user")

    state_db_path = resolved_home / "state.db"
    sessions_count = 0
    messages_count = 0
    fts5_available = False
    fts5_table: str | None = None

    if state_db_path.is_file():
        try:
            sconn = sqlite3.connect(f"file:{state_db_path}?mode=ro", uri=True, timeout=5.0)
            try:
                tables = {
                    str(r[0])
                    for r in sconn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
                }
                if "sessions" in tables:
                    sessions_count = int(sconn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0])
                if "messages" in tables:
                    messages_count = int(sconn.execute("SELECT COUNT(*) FROM messages").fetchone()[0])
                for candidate_fts in ("messages_fts_cjk", "messages_fts"):
                    if candidate_fts in tables:
                        fts5_available = True
                        fts5_table = candidate_fts
                        break
            finally:
                sconn.close()
        except sqlite3.Error:
            pass

    return {
        "memory_path": str(mem_path),
        "user_path": str(user_path),
        "memory_exists": mem_path.is_file(),
        "user_exists": user_path.is_file(),
        "memory_size_bytes": mem_path.stat().st_size if mem_path.is_file() else 0,
        "user_size_bytes": user_path.stat().st_size if user_path.is_file() else 0,
        "memory_entries": memory_entries,
        "user_entries": user_entries,
        "total_entries": len(memory_entries) + len(user_entries),
        "delimiter": "\\n§\\n",
        "state_db": {
            "exists": state_db_path.is_file(),
            "path": str(state_db_path),
            "sessions_count": sessions_count,
            "messages_count": messages_count,
            "fts5_available": fts5_available,
            "fts5_table": fts5_table or "messages_fts_cjk",
        },
    }


def add_hermes_base_memory_entry(
    content: str,
    *,
    target: str = "memory",
    redact_secrets: bool = True,
    home: Path | None = None,
) -> dict[str, Any]:
    """Безопасно добавить запись в `MEMORY.md` или `USER.md` с проверкой секретов и разделителем `\\n§\\n`."""
    resolved_home = _resolve_home(home)
    norm_target = str(target or "memory").strip().lower()
    if norm_target in ("user", "user.md"):
        filename = "USER.md"
    elif norm_target in ("memory", "memory.md"):
        filename = "MEMORY.md"
    else:
        raise ValueError("Параметр target должен быть 'memory' (MEMORY.md) или 'user' (USER.md).")

    raw_text = str(content or "").strip()
    if not raw_text:
        raise ValueError("Текст заметки памяти не может быть пустым.")

    dlp_info = ui_safety.redact_dlp_text(raw_text)
    final_text = str(dlp_info["redacted_text"]) if redact_secrets else raw_text

    target_path = _locate_base_memory_file(resolved_home, filename)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    existing = ""
    if target_path.is_file():
        try:
            existing = target_path.read_text(encoding="utf-8", errors="replace").strip()
        except OSError:
            existing = ""

    updated_content = f"{existing}{MEMORY_DELIMITER}{final_text}\n" if existing else f"{final_text}\n"
    target_path.write_text(updated_content, encoding="utf-8")

    # Синхронизируем со слоем 2 и слоем 3
    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        _index_document_internal(
            conn,
            project_id="global",
            title=filename,
            content=updated_content,
            source_path=str(target_path),
            doc_type="hermes_base",
        )
        conn.commit()
    finally:
        conn.close()

    base_state = read_hermes_base_memory(home=resolved_home)
    return {
        "ok": True,
        "target": filename,
        "path": str(target_path),
        "added_text": final_text,
        "redacted_findings": dlp_info.get("findings") or [],
        "redacted_count": int(dlp_info.get("findings_count") or 0),
        "base_memory": base_state,
    }


# ---------------------------------------------------------------------------
# Индексация документов (Слой 2 + Слой 3) и авто-векторизация (дельта SHA-256)
# ---------------------------------------------------------------------------

def _index_document_internal(
    conn: sqlite3.Connection,
    *,
    project_id: str,
    title: str,
    content: str,
    source_path: str = "",
    doc_type: str = "markdown",
    mtime_ns: int = 0,
    force: bool = False,
) -> dict[str, Any]:
    raw_bytes = content.encode("utf-8", errors="replace")
    sha256 = hashlib.sha256(raw_bytes).hexdigest()
    now = _now_iso()

    existing_row = None
    if source_path:
        existing_row = conn.execute(
            "SELECT id, sha256, mtime_ns, chunk_count FROM documents WHERE project_id = ? AND source_path = ?",
            (project_id, source_path),
        ).fetchone()
    if existing_row is None and title:
        existing_row = conn.execute(
            "SELECT id, sha256, mtime_ns, chunk_count FROM documents WHERE project_id = ? AND title = ? AND source_path = ''",
            (project_id, title),
        ).fetchone()

    if existing_row is not None and not force and str(existing_row["sha256"]) == sha256:
        return {
            "doc_id": str(existing_row["id"]),
            "title": title,
            "status": "unchanged",
            "chunk_count": int(existing_row["chunk_count"]),
            "sha256": sha256,
        }

    doc_id = str(existing_row["id"]) if existing_row is not None else f"doc-{uuid.uuid4().hex[:12]}"
    if existing_row is not None:
        conn.execute("DELETE FROM chunks WHERE doc_id = ?", (doc_id,))

    raw_chunks = split_into_semantic_chunks(content, title=title)
    for ch in raw_chunks:
        chunk_id = f"{doc_id}-c{ch['chunk_index']}"
        emb = compute_cpu_embedding(f"{ch['heading']}\n{ch['content']}")
        terms = _tokenize_terms(f"{ch['heading']} {ch['content']}")
        conn.execute(
            """
            INSERT INTO chunks (id, doc_id, project_id, chunk_index, heading, content, token_count, embedding_json, terms_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                chunk_id,
                doc_id,
                project_id,
                int(ch["chunk_index"]),
                str(ch["heading"]),
                str(ch["content"]),
                int(ch["token_count"]),
                json.dumps(emb),
                json.dumps(terms, ensure_ascii=False),
                now,
            ),
        )

    conn.execute(
        """
        INSERT INTO documents (id, project_id, title, source_path, doc_type, sha256, mtime_ns, size_bytes, chunk_count, vectorized_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            source_path=excluded.source_path,
            doc_type=excluded.doc_type,
            sha256=excluded.sha256,
            mtime_ns=excluded.mtime_ns,
            size_bytes=excluded.size_bytes,
            chunk_count=excluded.chunk_count,
            vectorized_at=excluded.vectorized_at
        """,
        (
            doc_id,
            project_id,
            title,
            source_path,
            doc_type,
            sha256,
            int(mtime_ns),
            len(raw_bytes),
            len(raw_chunks),
            now,
            now,
        ),
    )

    graph_stats = extract_and_store_graph_triplets(
        conn,
        content,
        source_label=title,
        source_type="document" if doc_type != "hermes_base" else "memory",
        project_id=project_id,
        source_hash=sha256[:16],
    )

    return {
        "doc_id": doc_id,
        "title": title,
        "status": "indexed",
        "chunk_count": len(raw_chunks),
        "sha256": sha256,
        "graph": graph_stats,
    }


def _seed_defaults_if_empty(conn: sqlite3.Connection, resolved_home: Path) -> None:
    count = int(conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0])
    if count > 0:
        return

    now = _now_iso()
    demo_projects = [
        {
            "id": "proj-product-architecture",
            "name": "База знаний и Архитектура продукта",
            "kind": "project",
            "description": (
                "Центральный проект архитектуры Nomad: гибридный роутинг моделей, "
                "3-слойная память (Hermes Base + Vector RRF + Knowledge Graph) и контур 152-ФЗ."
            ),
            "system_prompt": (
                "Ты — главный системный архитектор проекта. Опирайся на векторизованные "
                "документы архитектуры, проверяй инварианты отказоустойчивости и 152-ФЗ."
            ),
            "model_preference": "claude-opus-5-5",
            "pinned_skills": ["agent-swarm", "architecture-review", "rag-hybrid"],
            "folder_links": [],
            "auto_vectorize": 1,
            "delegation_depth_limit": 3,
            "worktree_isolation": 1,
            "sample_doc_title": "Архитектурный канон Nomad и 3-слойная память",
            "sample_doc_content": (
                "# Архитектурный канон Nomad\n\n"
                "Система использует **Платформа Nomad** и **Ядро Hermes** с 3-слойной памятью:\n"
                "1. Слой 1 — базовая память `MEMORY.md` и `USER.md` с полнотекстовым индексом FTS5.\n"
                "2. Слой 2 — локальная векторная база (128-dim CPU эмбеддинги + BM25) с ранжированием **Гибридный поиск RRF**.\n"
                "3. Слой 3 — граф знаний сущностей и связей с поддержкой моделей `claude-opus-5-5`, `gpt-6.1-sol`, `gemini-3.1-pro-preview` и `deepseek-v4-pro`.\n\n"
                "## Безопасность и изоляция веток\n\n"
                "Для параллельных задач кодинга применяется **Git Worktree Песочница** с двухэтапным слиянием Stage A и Stage B."
            ),
        },
        {
            "id": "subagent-152fz-auditor",
            "name": "Аудитор кода и 152-ФЗ",
            "kind": "subagent",
            "description": (
                "Специализированный субагент информационной безопасности: проверяет ПДн РФ (152-ФЗ), "
                "DLP-маскирование, отсутствие утечек секретов и готовность к работе в суверенном контуре РФ."
            ),
            "system_prompt": (
                "Ты — строгий аудитор ИБ и 152-ФЗ. Проверяй код и запросы на персональные данные "
                "(ФИО, СНИЛС, ИНН, паспорта, карты), требуй маршрутизацию в GigaChat-2-Max и YandexGPT 5 Pro."
            ),
            "model_preference": "GigaChat-2-Max",
            "pinned_skills": ["security-audit", "dlp-152fz", "code-review"],
            "folder_links": [],
            "auto_vectorize": 1,
            "delegation_depth_limit": 2,
            "worktree_isolation": 1,
            "sample_doc_title": "Регламент комплаенса 152-ФЗ и суверенного Совета моделей",
            "sample_doc_content": (
                "# Регламент 152-ФЗ и DLP\n\n"
                "При обнаружении **Персональные данные (ПДн)** (ФИО, СНИЛС, ИНН, паспорт РФ) локальный гардрейл "
                "автоматически активирует правило **152-ФЗ Защита ПДн** и **DLP-фильтр обезличивания**.\n\n"
                "Запросы с ПДн направляются исключительно в суверенный пул моделей РФ: "
                "`GigaChat-2-Max`, `YandexGPT 5 Pro` и `Cotype Pro 3`."
            ),
        },
    ]

    for item in demo_projects:
        conn.execute(
            """
            INSERT INTO projects (
                id, name, kind, description, system_prompt, model_preference,
                pinned_skills_json, folder_links_json, auto_vectorize,
                delegation_depth_limit, worktree_isolation, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                item["name"],
                item["kind"],
                item["description"],
                item["system_prompt"],
                item["model_preference"],
                json.dumps(item["pinned_skills"], ensure_ascii=False),
                json.dumps(item["folder_links"], ensure_ascii=False),
                item["auto_vectorize"],
                item["delegation_depth_limit"],
                item["worktree_isolation"],
                now,
                now,
            ),
        )
        _index_document_internal(
            conn,
            project_id=item["id"],
            title=item["sample_doc_title"],
            content=item["sample_doc_content"],
            doc_type="markdown",
        )

    # Индексируем также существующие файлы MEMORY.md / USER.md, если они есть
    for fname in ("MEMORY.md", "USER.md"):
        fpath = _locate_base_memory_file(resolved_home, fname)
        if fpath.is_file():
            try:
                raw_txt = fpath.read_text(encoding="utf-8", errors="replace").strip()
                if raw_txt:
                    _index_document_internal(
                        conn,
                        project_id="global",
                        title=fname,
                        content=raw_txt,
                        source_path=str(fpath),
                        doc_type="hermes_base",
                        mtime_ns=fpath.stat().st_mtime_ns,
                    )
            except OSError:
                pass

    conn.commit()


def _ensure_seeded(conn: sqlite3.Connection, resolved_home: Path) -> None:
    _seed_defaults_if_empty(conn, resolved_home)


def auto_vectorize_check(
    *,
    project_id: str | None = None,
    force: bool = False,
    extra_paths: list[str] | None = None,
    home: Path | None = None,
) -> dict[str, Any]:
    """Дельта-алгоритм авто-векторизации: проверяет `mtime_ns` и `SHA-256` файлов базовой памяти
    и привязанных папок `folder_links`, переиндексируя только изменившиеся файлы.
    """
    t0 = time.perf_counter()
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    indexed_files: list[dict[str, Any]] = []
    unchanged_count = 0

    try:
        _ensure_seeded(conn, resolved_home)

        # 1. Проверяем MEMORY.md и USER.md
        for fname in ("MEMORY.md", "USER.md"):
            fpath = _locate_base_memory_file(resolved_home, fname)
            if fpath.is_file():
                try:
                    stat = fpath.stat()
                    text = fpath.read_text(encoding="utf-8", errors="replace")
                    if text.strip():
                        res = _index_document_internal(
                            conn,
                            project_id="global",
                            title=fname,
                            content=text,
                            source_path=str(fpath),
                            doc_type="hermes_base",
                            mtime_ns=stat.st_mtime_ns,
                            force=force,
                        )
                        if res["status"] == "indexed":
                            indexed_files.append(res)
                        else:
                            unchanged_count += 1
                except OSError:
                    continue

        # 2. Проверяем привязанные папки проектов (folder_links) и extra_paths
        query = "SELECT id, folder_links_json, auto_vectorize FROM projects"
        params: tuple[Any, ...] = ()
        if project_id:
            query += " WHERE id = ?"
            params = (project_id,)
        rows = conn.execute(query, params).fetchall()

        scan_targets: list[tuple[str, Path]] = []
        for r in rows:
            if not force and not int(r["auto_vectorize"]):
                continue
            pid = str(r["id"])
            try:
                links = json.loads(str(r["folder_links_json"] or "[]"))
            except ValueError:
                links = []
            for raw_link in links:
                p = Path(str(raw_link)).expanduser()
                if p.exists():
                    scan_targets.append((pid, p))

        for raw_extra in extra_paths or []:
            p = Path(str(raw_extra)).expanduser()
            if p.exists():
                scan_targets.append((project_id or "global", p))

        for pid, target_path in scan_targets:
            candidate_files: list[Path] = []
            if target_path.is_file():
                candidate_files.append(target_path)
            elif target_path.is_dir():
                for root, dirs, files in os.walk(target_path):
                    dirs[:] = [
                        d
                        for d in dirs
                        if not d.startswith(".")
                        and d not in {"node_modules", "__pycache__", "venv", ".venv", "dist", "build"}
                    ]
                    for fn in files:
                        fp = Path(root) / fn
                        if fp.suffix.lower() in SUPPORTED_DOC_EXTENSIONS:
                            candidate_files.append(fp)
                            if len(candidate_files) >= 60:
                                break
                    if len(candidate_files) >= 60:
                        break

            for fp in candidate_files:
                try:
                    st = fp.stat()
                    if st.st_size > 512_000:
                        continue
                    text = fp.read_text(encoding="utf-8", errors="replace")
                    if not text.strip():
                        continue
                    res = _index_document_internal(
                        conn,
                        project_id=pid,
                        title=fp.name,
                        content=text,
                        source_path=str(fp.resolve()),
                        doc_type=fp.suffix.lstrip(".") or "text",
                        mtime_ns=st.st_mtime_ns,
                        force=force,
                    )
                    if res["status"] == "indexed":
                        indexed_files.append(res)
                    else:
                        unchanged_count += 1
                except OSError:
                    continue

        conn.commit()
    finally:
        conn.close()

    duration_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "ok": True,
        "mode": "manual_force" if force else "auto_delta_sha256",
        "indexed_count": len(indexed_files),
        "unchanged_count": unchanged_count,
        "indexed_documents": indexed_files,
        "duration_ms": duration_ms,
    }


# ---------------------------------------------------------------------------
# Гибридный поиск по всем 3 слоям (Layer 1 + Layer 2 RRF + Layer 3 Graph)
# ---------------------------------------------------------------------------

def search_memory_internal(
    query: str,
    *,
    project_id: str | None = None,
    top_k: int = 6,
    include_graph: bool = True,
    include_base: bool = True,
    home: Path | None = None,
) -> dict[str, Any]:
    """Сквозной гибридный поиск по всем 3 слоям памяти с формированием `<memory-context>`."""
    t0 = time.perf_counter()
    resolved_home = _resolve_home(home)
    clean_query = str(query or "").strip()
    if not clean_query:
        raise ValueError("Поисковый запрос не может быть пустым.")

    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)

        q_emb = compute_cpu_embedding(clean_query)
        q_terms = set(_tokenize_terms(clean_query))

        if project_id:
            chunk_rows = conn.execute(
                """
                SELECT c.id, c.doc_id, c.project_id, c.chunk_index, c.heading, c.content,
                       c.token_count, c.embedding_json, c.terms_json, d.title AS doc_title, d.doc_type
                FROM chunks c
                JOIN documents d ON d.id = c.doc_id
                WHERE c.project_id IN (?, 'global')
                """,
                (project_id,),
            ).fetchall()
        else:
            chunk_rows = conn.execute(
                """
                SELECT c.id, c.doc_id, c.project_id, c.chunk_index, c.heading, c.content,
                       c.token_count, c.embedding_json, c.terms_json, d.title AS doc_title, d.doc_type
                FROM chunks c
                JOIN documents d ON d.id = c.doc_id
                """
            ).fetchall()

        dense_scores: list[tuple[str, float, sqlite3.Row]] = []
        bm25_scores: list[tuple[str, float, sqlite3.Row]] = []

        total_docs = max(1, len(chunk_rows))
        df_map: dict[str, int] = {}
        parsed_terms_map: dict[str, list[str]] = {}

        for row in chunk_rows:
            cid = str(row["id"])
            try:
                terms = json.loads(str(row["terms_json"] or "[]"))
            except ValueError:
                terms = []
            parsed_terms_map[cid] = terms
            for t in set(terms):
                df_map[t] = df_map.get(t, 0) + 1

        avg_dl = max(1.0, sum(len(v) for v in parsed_terms_map.values()) / total_docs)

        for row in chunk_rows:
            cid = str(row["id"])
            try:
                emb = json.loads(str(row["embedding_json"] or "[]"))
            except ValueError:
                emb = []
            cos_sim = _cosine_similarity(q_emb, emb)
            dense_scores.append((cid, cos_sim, row))

            terms = parsed_terms_map.get(cid, [])
            dl = len(terms)
            tf_counter: dict[str, int] = {}
            for t in terms:
                tf_counter[t] = tf_counter.get(t, 0) + 1

            bm25 = 0.0
            k1 = 1.5
            b = 0.75
            for qt in q_terms:
                tf = tf_counter.get(qt, 0)
                if tf <= 0:
                    continue
                df = df_map.get(qt, 0)
                idf = math.log(1.0 + (total_docs - df + 0.5) / (df + 0.5))
                denom = tf + k1 * (1.0 - b + b * (dl / avg_dl))
                bm25 += idf * ((tf * (k1 + 1.0)) / max(1e-6, denom))

            bm25_scores.append((cid, bm25, row))

        dense_sorted = sorted(dense_scores, key=lambda x: x[1], reverse=True)
        bm25_sorted = sorted(bm25_scores, key=lambda x: x[1], reverse=True)

        dense_rank = {cid: rank + 1 for rank, (cid, _, _) in enumerate(dense_sorted)}
        bm25_rank = {cid: rank + 1 for rank, (cid, _, _) in enumerate(bm25_sorted)}
        dense_val = {cid: score for cid, score, _ in dense_scores}
        bm25_val = {cid: score for cid, score, _ in bm25_scores}
        row_by_id = {str(r["id"]): r for r in chunk_rows}

        rrf_k = 60.0
        layer2_hits: list[dict[str, Any]] = []
        for cid, row in row_by_id.items():
            r_d = dense_rank.get(cid, total_docs + 1)
            r_b = bm25_rank.get(cid, total_docs + 1)
            rrf_score = (1.0 / (rrf_k + r_d)) + (1.0 / (rrf_k + r_b))
            # Бонус за прямое вхождение подстроки
            if clean_query.lower() in str(row["content"]).lower():
                rrf_score += 0.015
            layer2_hits.append(
                {
                    "chunk_id": cid,
                    "doc_id": str(row["doc_id"]),
                    "project_id": str(row["project_id"]),
                    "doc_title": str(row["doc_title"]),
                    "heading": str(row["heading"]),
                    "content": str(row["content"]),
                    "rrf_score": round(rrf_score, 6),
                    "cosine_similarity": round(dense_val.get(cid, 0.0), 4),
                    "bm25_score": round(bm25_val.get(cid, 0.0), 4),
                    "layer": "layer2_vector_rrf",
                }
            )

        layer2_hits.sort(
            key=lambda x: (x["rrf_score"], x["bm25_score"], x["cosine_similarity"]),
            reverse=True,
        )
        top_layer2 = layer2_hits[:top_k]

        # Layer 1: Hermes Base Memory hits
        layer1_hits: list[dict[str, Any]] = []
        if include_base:
            base_data = read_hermes_base_memory(home=resolved_home)
            for entry in [*base_data["memory_entries"], *base_data["user_entries"]]:
                entry_terms = set(_tokenize_terms(entry["text"]))
                overlap = len(q_terms & entry_terms)
                if overlap > 0 or clean_query.lower() in entry["text"].lower():
                    layer1_hits.append(
                        {
                            "id": entry["id"],
                            "source": entry["source"],
                            "content": entry["text"],
                            "matched_terms": overlap,
                            "layer": "layer1_hermes_base",
                        }
                    )

        # Layer 3: Knowledge Graph multi-hop expansion
        layer3_graph_hits: list[dict[str, Any]] = []
        if include_graph:
            node_rows = conn.execute("SELECT id, label, entity_type, project_id FROM graph_nodes").fetchall()
            matched_node_ids: set[str] = set()
            for nr in node_rows:
                nlabel = str(nr["label"])
                nterms = set(_tokenize_terms(nlabel))
                if (q_terms & nterms) or nlabel.lower() in clean_query.lower() or clean_query.lower() in nlabel.lower():
                    matched_node_ids.add(str(nr["id"]))

            # Multi-hop (1-hop & 2-hop) по рёбрам графа
            if matched_node_ids:
                placeholders = ",".join("?" for _ in matched_node_ids)
                edge_rows = conn.execute(
                    f"""
                    SELECT e.id, e.source_id, e.target_id, e.relation, e.weight,
                           ns.label AS source_label, ns.entity_type AS source_type,
                           nt.label AS target_label, nt.entity_type AS target_type
                    FROM graph_edges e
                    JOIN graph_nodes ns ON ns.id = e.source_id
                    JOIN graph_nodes nt ON nt.id = e.target_id
                    WHERE e.source_id IN ({placeholders}) OR e.target_id IN ({placeholders})
                    ORDER BY e.weight DESC
                    LIMIT 12
                    """,
                    (*matched_node_ids, *matched_node_ids),
                ).fetchall()
            else:
                edge_rows = conn.execute(
                    """
                    SELECT e.id, e.source_id, e.target_id, e.relation, e.weight,
                           ns.label AS source_label, ns.entity_type AS source_type,
                           nt.label AS target_label, nt.entity_type AS target_type
                    FROM graph_edges e
                    JOIN graph_nodes ns ON ns.id = e.source_id
                    JOIN graph_nodes nt ON nt.id = e.target_id
                    ORDER BY e.weight DESC
                    LIMIT 6
                    """
                ).fetchall()

            for er in edge_rows:
                layer3_graph_hits.append(
                    {
                        "edge_id": str(er["id"]),
                        "source": str(er["source_label"]),
                        "source_type": str(er["source_type"]),
                        "relation": str(er["relation"]),
                        "target": str(er["target_label"]),
                        "target_type": str(er["target_type"]),
                        "weight": float(er["weight"]),
                        "triplet_text": f"{er['source_label']} —[{er['relation']}]→ {er['target_label']}",
                        "layer": "layer3_knowledge_graph",
                    }
                )
    finally:
        conn.close()

    # Формируем канонический изолированный блок `<memory-context>...</memory-context>`
    ctx_lines = [
        "<memory-context>",
        "[System note: The following is recalled 3-layer memory context (Hermes Base + Vector RRF + Knowledge Graph), NOT new user input.]",
    ]
    if layer1_hits:
        ctx_lines.append("## Layer 1: Базовая память Hermes (MEMORY.md / USER.md)")
        for h1 in layer1_hits[:3]:
            ctx_lines.append(f"- [{h1['source']}] {h1['content']}")
    if top_layer2:
        ctx_lines.append("## Layer 2: Семантические чанки (Vector + BM25 RRF)")
        for h2 in top_layer2[:4]:
            ctx_lines.append(f"- [{h2['doc_title']} · {h2['heading']} | RRF={h2['rrf_score']}]: {h2['content']}")
    if layer3_graph_hits:
        ctx_lines.append("## Layer 3: Связи графа знаний (Knowledge Graph)")
        for h3 in layer3_graph_hits[:5]:
            ctx_lines.append(f"- {h3['triplet_text']}")
    ctx_lines.append("</memory-context>")
    memory_context_block = "\n".join(ctx_lines)

    latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    return {
        "ok": True,
        "query": clean_query,
        "project_id": project_id,
        "results": top_layer2,
        "layer1_hits": layer1_hits,
        "layer2_hits": top_layer2,
        "layer3_graph_hits": layer3_graph_hits,
        "memory_context_block": memory_context_block,
        "latency_ms": latency_ms,
    }


# ---------------------------------------------------------------------------
# Сводка памяти (GET /memory/overview) и Граф (GET /memory/graph)
# ---------------------------------------------------------------------------

def get_memory_overview(*, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    auto_vectorize_check(home=resolved_home, force=False)
    base_mem = read_hermes_base_memory(home=resolved_home)

    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        docs_count = int(conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0])
        chunks_count = int(conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0])
        projects_count = int(conn.execute("SELECT COUNT(*) FROM projects WHERE kind = 'project'").fetchone()[0])
        subagents_count = int(conn.execute("SELECT COUNT(*) FROM projects WHERE kind = 'subagent'").fetchone()[0])
        nodes_count = int(conn.execute("SELECT COUNT(*) FROM graph_nodes").fetchone()[0])
        edges_count = int(conn.execute("SELECT COUNT(*) FROM graph_edges").fetchone()[0])

        recent_docs = [
            {
                "id": str(r["id"]),
                "project_id": str(r["project_id"]),
                "title": str(r["title"]),
                "doc_type": str(r["doc_type"]),
                "chunk_count": int(r["chunk_count"]),
                "size_bytes": int(r["size_bytes"]),
                "vectorized_at": str(r["vectorized_at"]),
            }
            for r in conn.execute(
                "SELECT id, project_id, title, doc_type, chunk_count, size_bytes, vectorized_at "
                "FROM documents ORDER BY vectorized_at DESC LIMIT 10"
            ).fetchall()
        ]
    finally:
        conn.close()

    layer1_summary = {
        "id": "layer1_hermes_base",
        "title": "Слой 1 · Базовая память Hermes (MEMORY.md + USER.md + FTS5)",
        "status": "active",
        **base_mem,
    }
    layer2_summary = {
        "id": "layer2_vector_store",
        "title": "Слой 2 · Векторное хранилище и гибридный RAG (CPU 128-dim + BM25 RRF)",
        "status": "active",
        "db_path": str(_hub_db_path(resolved_home)),
        "embedding_dim": EMBEDDING_DIM,
        "ranking": "Reciprocal Rank Fusion (Cosine + BM25)",
        "documents_count": docs_count,
        "chunks_count": chunks_count,
        "projects_count": projects_count,
        "subagents_count": subagents_count,
        "auto_vectorize_enabled": True,
        "recent_documents": recent_docs,
    }
    layer3_summary = {
        "id": "layer3_knowledge_graph",
        "title": "Слой 3 · Граф знаний (Сущности, связи и multi-hop контекст)",
        "status": "active",
        "nodes_count": nodes_count,
        "edges_count": edges_count,
    }

    return {
        "ok": True,
        "layer1_hermes_base": layer1_summary,
        "layer2_vector_store": layer2_summary,
        "layer3_knowledge_graph": layer3_summary,
        "base_memory": layer1_summary,
        "vector_memory": layer2_summary,
        "graph_memory": layer3_summary,
        "layers": [layer1_summary, layer2_summary, layer3_summary],
        "auto_vectorize": {
            "enabled": True,
            "algorithm": "SHA-256 + mtime_ns delta",
            "supported_modes": ["button_manual", "auto_delta"],
        },
        "recent_entries": (base_mem["memory_entries"] + base_mem["user_entries"])[-10:],
    }


def get_memory_graph(*, project_id: str | None = None, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        if project_id:
            node_rows = conn.execute(
                "SELECT id, label, entity_type, project_id, source_hash, valid_at FROM graph_nodes WHERE project_id IN (?, 'global')",
                (project_id,),
            ).fetchall()
            edge_rows = conn.execute(
                "SELECT id, source_id, target_id, relation, project_id, weight, valid_at FROM graph_edges WHERE project_id IN (?, 'global')",
                (project_id,),
            ).fetchall()
        else:
            node_rows = conn.execute(
                "SELECT id, label, entity_type, project_id, source_hash, valid_at FROM graph_nodes"
            ).fetchall()
            edge_rows = conn.execute(
                "SELECT id, source_id, target_id, relation, project_id, weight, valid_at FROM graph_edges"
            ).fetchall()

        nodes = [
            {
                "id": str(r["id"]),
                "label": str(r["label"]),
                "type": str(r["entity_type"]),
                "entity_type": str(r["entity_type"]),
                "project_id": str(r["project_id"]),
                "valid_at": str(r["valid_at"]),
            }
            for r in node_rows
        ]
        node_ids = {n["id"] for n in nodes}
        edges = [
            {
                "id": str(r["id"]),
                "source": str(r["source_id"]),
                "target": str(r["target_id"]),
                "source_id": str(r["source_id"]),
                "target_id": str(r["target_id"]),
                "relation": str(r["relation"]),
                "label": str(r["relation"]),
                "weight": float(r["weight"]),
                "project_id": str(r["project_id"]),
                "valid_at": str(r["valid_at"]),
            }
            for r in edge_rows
            if str(r["source_id"]) in node_ids and str(r["target_id"]) in node_ids
        ]
    finally:
        conn.close()

    by_type: dict[str, int] = {}
    for n in nodes:
        et = n["entity_type"]
        by_type[et] = by_type.get(et, 0) + 1

    return {
        "ok": True,
        "nodes": nodes,
        "edges": edges,
        "stats": {
            "nodes_count": len(nodes),
            "edges_count": len(edges),
            "entity_types": by_type,
        },
    }


# ---------------------------------------------------------------------------
# Проекты, Субагенты и механики харнеса `codeg` (Git Worktree, Stage A / B)
# ---------------------------------------------------------------------------

def _format_project_row(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    pid = str(row["id"])
    doc_stats = conn.execute(
        "SELECT COUNT(*) AS docs, COALESCE(SUM(chunk_count), 0) AS chunks FROM documents WHERE project_id = ?",
        (pid,),
    ).fetchone()
    worktrees = [
        {
            "id": str(w["id"]),
            "task_slug": str(w["task_slug"]),
            "repo_path": str(w["repo_path"]),
            "worktree_path": str(w["worktree_path"]),
            "branch_name": str(w["branch_name"]),
            "base_branch": str(w["base_branch"]),
            "uncommitted_files": json.loads(str(w["uncommitted_files_json"] or "[]")),
            "path_holds_uncommitted": bool(w["path_holds_uncommitted"]),
            "stage_a_status": str(w["stage_a_status"]),
            "stage_b_status": str(w["stage_b_status"]),
            "status": str(w["status"]),
            "updated_at": str(w["updated_at"]),
        }
        for w in conn.execute(
            "SELECT * FROM worktree_sandboxes WHERE project_id = ? ORDER BY updated_at DESC",
            (pid,),
        ).fetchall()
    ]
    docs = [
        {
            "id": str(d["id"]),
            "title": str(d["title"]),
            "source_path": str(d["source_path"]),
            "doc_type": str(d["doc_type"]),
            "chunk_count": int(d["chunk_count"]),
            "size_bytes": int(d["size_bytes"]),
            "vectorized_at": str(d["vectorized_at"]),
        }
        for d in conn.execute(
            "SELECT id, title, source_path, doc_type, chunk_count, size_bytes, vectorized_at "
            "FROM documents WHERE project_id = ? ORDER BY vectorized_at DESC",
            (pid,),
        ).fetchall()
    ]
    return {
        "id": pid,
        "name": str(row["name"]),
        "kind": str(row["kind"]),
        "description": str(row["description"]),
        "system_prompt": str(row["system_prompt"]),
        "model_preference": str(row["model_preference"]),
        "pinned_skills": json.loads(str(row["pinned_skills_json"] or "[]")),
        "folder_links": json.loads(str(row["folder_links_json"] or "[]")),
        "auto_vectorize": bool(row["auto_vectorize"]),
        "delegation_depth_limit": int(row["delegation_depth_limit"]),
        "worktree_isolation": bool(row["worktree_isolation"]),
        "documents_count": int(doc_stats["docs"] if doc_stats else 0),
        "chunks_count": int(doc_stats["chunks"] if doc_stats else 0),
        "documents": docs,
        "worktrees": worktrees,
        "created_at": str(row["created_at"]),
        "updated_at": str(row["updated_at"]),
    }


def list_projects(*, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        rows = conn.execute("SELECT * FROM projects ORDER BY created_at DESC").fetchall()
        items = [_format_project_row(conn, r) for r in rows]
    finally:
        conn.close()

    return {
        "ok": True,
        "projects": items,
        "only_projects": [p for p in items if p["kind"] == "project"],
        "subagents": [p for p in items if p["kind"] == "subagent"],
        "total": len(items),
    }


def create_project(payload: ProjectCreateRequest, *, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    kind = str(payload.kind or "project").strip().lower()
    if kind not in ("project", "subagent"):
        kind = "project"
    prefix = "subagent" if kind == "subagent" else "proj"
    pid = f"{prefix}-{uuid.uuid4().hex[:10]}"
    now = _now_iso()

    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        conn.execute(
            """
            INSERT INTO projects (
                id, name, kind, description, system_prompt, model_preference,
                pinned_skills_json, folder_links_json, auto_vectorize,
                delegation_depth_limit, worktree_isolation, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pid,
                payload.name.strip(),
                kind,
                payload.description.strip(),
                payload.system_prompt.strip(),
                payload.model_preference.strip() or "claude-opus-5-5",
                json.dumps(payload.pinned_skills, ensure_ascii=False),
                json.dumps(payload.folder_links, ensure_ascii=False),
                1 if payload.auto_vectorize else 0,
                int(payload.delegation_depth_limit),
                1 if payload.worktree_isolation else 0,
                now,
                now,
            ),
        )
        extract_and_store_graph_triplets(
            conn,
            f"**{payload.name}**\n{payload.description}\n{payload.system_prompt}\nМодель: {payload.model_preference}",
            source_label=payload.name.strip(),
            source_type=kind,
            project_id=pid,
        )
        conn.commit()
    finally:
        conn.close()

    if payload.auto_vectorize and payload.folder_links:
        auto_vectorize_check(project_id=pid, home=resolved_home)

    conn = _connect_hub(resolved_home)
    try:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (pid,)).fetchone()
        project_dict = _format_project_row(conn, row)
    finally:
        conn.close()

    return {"ok": True, "project": project_dict}


def add_project_document(
    project_id: str,
    payload: ProjectDocumentRequest,
    *,
    home: Path | None = None,
) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        proj_row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj_row is None:
            raise KeyError(f"Проект или субагент '{project_id}' не найден.")

        source_path = ""
        mtime_ns = 0
        content = payload.content or ""
        title = payload.title.strip()

        if payload.file_path:
            fp = Path(payload.file_path).expanduser()
            if not fp.exists():
                raise ValueError(f"Указанный файл или папка не существует: {fp}")
            if fp.is_dir():
                conn.close()
                vec_res = auto_vectorize_check(
                    project_id=project_id,
                    extra_paths=[str(fp)],
                    force=True,
                    home=resolved_home,
                )
                conn2 = _connect_hub(resolved_home)
                try:
                    updated_row = conn2.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
                    return {
                        "ok": True,
                        "project": _format_project_row(conn2, updated_row),
                        "vectorization": vec_res,
                    }
                finally:
                    conn2.close()
            else:
                source_path = str(fp.resolve())
                mtime_ns = fp.stat().st_mtime_ns
                content = fp.read_text(encoding="utf-8", errors="replace")
                if not title:
                    title = fp.name

        if not content.strip():
            raise ValueError("Передайте непустой текст документа (`content`) или путь к файлу (`file_path`).")
        if not title:
            title = f"Документ {time.strftime('%Y-%m-%d %H:%M')}"

        idx_res = _index_document_internal(
            conn,
            project_id=project_id,
            title=title,
            content=content,
            source_path=source_path,
            doc_type=payload.doc_type or "markdown",
            mtime_ns=mtime_ns,
            force=True,
        )
        conn.execute("UPDATE projects SET updated_at = ? WHERE id = ?", (_now_iso(), project_id))
        conn.commit()
        updated_proj = _format_project_row(conn, conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone())
    finally:
        if conn:
            try:
                conn.close()
            except Exception:
                pass

    return {
        "ok": True,
        "document": idx_res,
        "project": updated_proj,
    }


def _inspect_git_uncommitted(repo_dir: Path) -> list[str]:
    if not (repo_dir / ".git").exists():
        return []
    try:
        res = subprocess.run(
            ["git", "-C", str(repo_dir), "status", "--porcelain"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=5,
            check=False,
        )
        if res.returncode != 0:
            return []
        files: list[str] = []
        for line in res.stdout.splitlines():
            if len(line) > 3:
                files.append(line[3:].strip())
        return files
    except Exception:
        return []


def register_or_check_worktree(
    project_id: str,
    payload: WorktreeSandboxRequest,
    *,
    home: Path | None = None,
) -> dict[str, Any]:
    """Механика харнеса `codeg`: регистрация изолированной песочницы Git Worktree,
    проверка `path_holds_uncommitted` и статуса двухэтапного слияния (`Stage A`, `Stage B`).
    """
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    try:
        _ensure_seeded(conn, resolved_home)
        proj_row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if proj_row is None:
            raise KeyError(f"Проект или субагент '{project_id}' не найден.")

        slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", payload.task_slug.strip()).strip("-").lower() or "task"
        branch_name = f"nomad/{project_id}/{slug}"

        sandboxes_root = resolved_home / "worktrees" / project_id
        sandboxes_root.mkdir(parents=True, exist_ok=True)
        worktree_dir = sandboxes_root / slug
        worktree_dir.mkdir(parents=True, exist_ok=True)

        repo_dir = Path(payload.repo_path).expanduser() if payload.repo_path else worktree_dir
        detected_uncommitted = list(payload.uncommitted_paths)
        if repo_dir.exists():
            git_dirty = _inspect_git_uncommitted(repo_dir)
            for item in git_dirty:
                if item not in detected_uncommitted:
                    detected_uncommitted.append(item)

        holds_uncommitted = len(detected_uncommitted) > 0
        if holds_uncommitted:
            stage_a = "blocked_uncommitted_changes"
            stage_b = "blocked_waiting_stage_a"
            status = "dirty_hold"
        else:
            stage_a = "merged_base_into_worktree" if payload.run_two_stage_merge_check else "ready"
            stage_b = "ready_for_fast_forward_to_main" if payload.run_two_stage_merge_check else "pending"
            status = "ready_to_merge" if payload.run_two_stage_merge_check else "isolated"

        wt_id = f"wt-{project_id}-{slug}"
        now = _now_iso()
        conn.execute(
            """
            INSERT INTO worktree_sandboxes (
                id, project_id, task_slug, repo_path, worktree_path, branch_name,
                base_branch, uncommitted_files_json, path_holds_uncommitted,
                stage_a_status, stage_b_status, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                repo_path=excluded.repo_path,
                worktree_path=excluded.worktree_path,
                uncommitted_files_json=excluded.uncommitted_files_json,
                path_holds_uncommitted=excluded.path_holds_uncommitted,
                stage_a_status=excluded.stage_a_status,
                stage_b_status=excluded.stage_b_status,
                status=excluded.status,
                updated_at=excluded.updated_at
            """,
            (
                wt_id,
                project_id,
                slug,
                str(repo_dir),
                str(worktree_dir),
                branch_name,
                payload.base_branch,
                json.dumps(detected_uncommitted, ensure_ascii=False),
                1 if holds_uncommitted else 0,
                stage_a,
                stage_b,
                status,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "ok": True,
        "worktree": {
            "id": wt_id,
            "project_id": project_id,
            "task_slug": slug,
            "repo_path": str(repo_dir),
            "worktree_path": str(worktree_dir),
            "branch_name": branch_name,
            "base_branch": payload.base_branch,
            "path_holds_uncommitted": holds_uncommitted,
            "uncommitted_files": detected_uncommitted,
            "two_stage_merge": {
                "stage_a": {
                    "name": "Stage A: base → worktree",
                    "status": stage_a,
                    "passed": not holds_uncommitted,
                },
                "stage_b": {
                    "name": "Stage B: worktree → main",
                    "status": stage_b,
                    "passed": not holds_uncommitted and payload.run_two_stage_merge_check,
                },
            },
            "status": status,
        },
    }


def delete_project(project_id: str, *, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    conn = _connect_hub(resolved_home)
    try:
        row = conn.execute("SELECT id, name FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            raise KeyError(f"Проект '{project_id}' не найден.")
        conn.execute("DELETE FROM chunks WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM documents WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM worktree_sandboxes WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM graph_edges WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM graph_nodes WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "deleted_project_id": project_id}


def build_router() -> APIRouter:
    r = APIRouter(tags=["nomad-memory-projects"])

    @r.get("/memory/overview")
    def http_memory_overview() -> dict[str, Any]:
        return get_memory_overview()

    @r.get("/memory/graph")
    def http_memory_graph(project_id: str | None = None) -> dict[str, Any]:
        return get_memory_graph(project_id=project_id)

    @r.post("/memory/base/add")
    def http_memory_base_add(body: BaseMemoryAddRequest) -> dict[str, Any]:
        try:
            return add_hermes_base_memory_entry(
                body.content,
                target=body.target,
                redact_secrets=body.redact_secrets,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.post("/memory/vectorize")
    def http_memory_vectorize(body: VectorizeRequest | None = None) -> dict[str, Any]:
        req = body or VectorizeRequest(force=True)
        return auto_vectorize_check(
            project_id=req.project_id,
            force=True if body is None else bool(req.force or True),
            extra_paths=req.paths,
        )

    @r.post("/memory/search")
    def http_memory_search(body: MemorySearchRequest) -> dict[str, Any]:
        try:
            return search_memory_internal(
                body.query,
                project_id=body.project_id,
                top_k=body.top_k,
                include_graph=body.include_graph,
                include_base=body.include_base,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.get("/projects")
    def http_list_projects() -> dict[str, Any]:
        return list_projects()

    @r.post("/projects/create")
    @r.post("/projects")
    def http_create_project(body: ProjectCreateRequest) -> dict[str, Any]:
        return create_project(body)

    @r.post("/projects/{project_id}/documents")
    def http_add_project_document(project_id: str, body: ProjectDocumentRequest) -> dict[str, Any]:
        try:
            return add_project_document(project_id, body)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.post("/projects/{project_id}/worktree")
    def http_project_worktree(project_id: str, body: WorktreeSandboxRequest | None = None) -> dict[str, Any]:
        try:
            return register_or_check_worktree(project_id, body or WorktreeSandboxRequest())
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @r.delete("/projects/{project_id}")
    def http_delete_project(project_id: str) -> dict[str, Any]:
        try:
            return delete_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    return r


router = build_router()
