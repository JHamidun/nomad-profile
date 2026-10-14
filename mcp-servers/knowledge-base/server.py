#!/usr/bin/env python3
"""Knowledge Base MCP Server — local RAG over a folder of documents with SQLite FTS5 + Russian/English stemming.

Indexes ``.md``, ``.txt``, ``.rst``, ``.html``, ``.csv``, ``.json``, ``.yaml``, ``.py``, ``.docx``, ``.pdf`` (when
``pypdf`` is installed; ``.docx`` uses stdlib ``zipfile``+``xml`` so it works out of the box). Stores chunks in
``<KNOWLEDGE_BASE_DIR>/.kb-index.sqlite`` with BM25 ranking and snippet highlighting.
"""
from __future__ import annotations

import hashlib
import inspect
import json
import os
import re
import sqlite3
import sys
import time
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

try:
    from mcp.server.fastmcp import FastMCP as _SdkFastMCP
except ImportError:
    _SdkFastMCP = None


class FastMCP:
    """Stdlib-compatible FastMCP wrapper with fallback stdio JSON-RPC loop when ``mcp`` SDK is absent."""

    def __init__(self, name: str, instructions: str = "") -> None:
        self.name = name
        self.instructions = instructions
        self._tools: dict[str, Any] = {}
        self._sdk = _SdkFastMCP(name, instructions=instructions) if _SdkFastMCP is not None else None

    def tool(self):
        def _decorator(fn):
            self._tools[fn.__name__] = fn
            if self._sdk is not None:
                self._sdk.tool()(fn)
            return fn

        return _decorator

    def list_tools(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        for name, fn in self._tools.items():
            sig = inspect.signature(fn)
            props: dict[str, Any] = {}
            required: list[str] = []
            for p_name, param in sig.parameters.items():
                ann_str = str(param.annotation).lower()
                if "int" in ann_str:
                    jtype = "integer"
                elif "float" in ann_str:
                    jtype = "number"
                elif "bool" in ann_str:
                    jtype = "boolean"
                elif "dict" in ann_str:
                    jtype = "object"
                elif "list" in ann_str:
                    jtype = "array"
                else:
                    jtype = "string"
                prop: dict[str, Any] = {"type": jtype}
                if param.default is inspect.Parameter.empty:
                    required.append(p_name)
                else:
                    prop["default"] = param.default
                props[p_name] = prop
            out.append(
                {
                    "name": name,
                    "description": (inspect.getdoc(fn) or name).strip(),
                    "inputSchema": {"type": "object", "properties": props, "required": required},
                }
            )
        return out

    def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        if name not in self._tools:
            raise KeyError(f"Unknown tool: {name}")
        return self._tools[name](**(arguments or {}))

    def run(self) -> None:
        if self._sdk is not None and os.environ.get("NOMAD_FORCE_STDIO_JSONRPC") != "1":
            self._sdk.run()
            return
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue
            try:
                req = json.loads(line)
            except Exception:
                continue
            req_id = req.get("id")
            method = req.get("method", "")
            params = req.get("params") or {}
            if method == "notifications/initialized" or req_id is None:
                continue
            try:
                if method == "initialize":
                    result: Any = {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": self.name, "version": "1.0.0"},
                    }
                elif method == "ping":
                    result = {}
                elif method == "tools/list":
                    result = {"tools": self.list_tools()}
                elif method == "tools/call":
                    val = self.call_tool(params.get("name", ""), params.get("arguments") or {})
                    text = val if isinstance(val, str) else json.dumps(val, ensure_ascii=False)
                    result = {"content": [{"type": "text", "text": text}], "isError": False}
                else:
                    raise ValueError(f"Unsupported method: {method}")
                resp = {"jsonrpc": "2.0", "id": req_id, "result": result}
            except Exception as exc:
                resp = {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32000, "message": f"{type(exc).__name__}: {exc}"},
                }
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()


mcp = FastMCP(
    "knowledge-base",
    instructions="Local RAG over a folder of documents (Markdown, TXT, DOCX, HTML, CSV, JSON, code) with Russian/English full-text search (SQLite FTS5 BM25).",
)

TEXT_EXTS = {
    ".md", ".markdown", ".txt", ".rst", ".csv", ".tsv", ".json", ".yaml", ".yml",
    ".html", ".htm", ".py", ".js", ".ts", ".sql", ".sh", ".ps1", ".ini", ".toml",
}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next"}
MAX_FILE_BYTES = 8 * 1024 * 1024
CHUNK_CHARS = 1600
CHUNK_OVERLAP = 200

RU_SUFFIX_RE = re.compile(
    r"(иями|ями|ами|его|ого|ему|ому|ими|ыми|ей|ий|ый|ой|ая|яя|ое|ее|ие|ые|ую|юю|"
    r"ешь|ет|ем|ете|ут|ют|ишь|ит|им|ите|ат|ят|ла|ло|ли|ть|ться|лся|лась|"
    r"ов|ев|ей|ам|ям|ах|ях|ом|ем|ую|ии|ия|ие|ью|ию|ья|а|я|о|е|и|ы|у|ю|ь)$"
)
EN_SUFFIX_RE = re.compile(r"(ingly|edly|ings|ing|ed|ies|es|s|ly|ment|ness|tion|ations)$")
WORD_RE = re.compile(r"[0-9A-Za-zА-Яа-яЁё]{2,}")


def _stem(token: str) -> str:
    w = token.lower().replace("ё", "е")
    if len(w) <= 4:
        return w
    if re.search(r"[а-я]", w):
        s = RU_SUFFIX_RE.sub("", w)
        return s if len(s) >= 3 else w
    s = EN_SUFFIX_RE.sub("", w)
    return s if len(s) >= 3 else w


def _stem_text(text: str) -> str:
    return " ".join(_stem(m.group(0)) for m in WORD_RE.finditer(text))


def _default_dir() -> Path:
    raw = os.environ.get("KNOWLEDGE_BASE_DIR", "").strip()
    if raw:
        p = Path(os.path.expanduser(raw)).resolve()
    else:
        hermes_home = os.environ.get("HERMES_HOME", "").strip()
        if hermes_home:
            p = Path(os.path.expanduser(hermes_home)).resolve() / "knowledge"
        else:
            p = (Path.home() / ".nomad" / "knowledge").resolve()
    p.mkdir(parents=True, exist_ok=True)
    return p


def _db(root: Path) -> sqlite3.Connection:
    db_path = root / ".kb-index.sqlite"
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS files (
            rel_path TEXT PRIMARY KEY,
            mtime REAL NOT NULL,
            size INTEGER NOT NULL,
            sha1 TEXT NOT NULL,
            chunk_count INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rel_path TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            heading TEXT NOT NULL,
            content TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(rel_path);
        CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
            rel_path, heading, content, stems,
            content='',
            tokenize='unicode61'
        );
        """
    )
    return conn


def _read_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as zf:
        xml_bytes = zf.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    paragraphs: list[str] = []
    for p in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
        texts = [t.text for t in p.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t") if t.text]
        if texts:
            paragraphs.append("".join(texts))
    return "\n\n".join(paragraphs)


def _read_pdf(path: Path) -> str:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        return ""
    reader = PdfReader(str(path))
    return "\n\n".join((page.extract_text() or "") for page in reader.pages)


def _extract_text(path: Path) -> str:
    ext = path.suffix.lower()
    if ext == ".docx":
        return _read_docx(path)
    if ext == ".pdf":
        return _read_pdf(path)
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "utf-8", "cp1251", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    else:
        text = raw.decode("utf-8", errors="replace")
    if ext in {".html", ".htm"}:
        text = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", text)
        text = re.sub(r"(?s)<[^>]+>", " ", text)
    return text


def _chunk_text(text: str) -> list[tuple[str, str]]:
    lines = text.splitlines()
    sections: list[tuple[str, list[str]]] = [("", [])]
    for line in lines:
        m = re.match(r"^\s{0,3}(#{1,4})\s+(.+?)\s*$", line)
        if m:
            sections.append((m.group(2).strip(), [line]))
        else:
            sections[-1][1].append(line)

    chunks: list[tuple[str, str]] = []
    for heading, sec_lines in sections:
        block = "\n".join(sec_lines).strip()
        if not block:
            continue
        start = 0
        while start < len(block):
            end = min(len(block), start + CHUNK_CHARS)
            if end < len(block):
                nl = block.rfind("\n", start + CHUNK_CHARS // 2, end)
                if nl > start:
                    end = nl
            piece = block[start:end].strip()
            if piece:
                chunks.append((heading, piece))
            if end >= len(block):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


def _iter_files(root: Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn.startswith("."):
                continue
            p = Path(dirpath) / fn
            ext = p.suffix.lower()
            if ext not in TEXT_EXTS and ext not in {".docx", ".pdf"}:
                continue
            try:
                if p.stat().st_size > MAX_FILE_BYTES:
                    continue
            except OSError:
                continue
            yield p


def _sync_index(root: Path, force: bool = False) -> dict[str, int]:
    conn = _db(root)
    try:
        existing = {
            row["rel_path"]: (row["mtime"], row["size"])
            for row in conn.execute("SELECT rel_path, mtime, size FROM files")
        }
        seen: set[str] = set()
        added = updated = skipped = removed = 0

        for path in _iter_files(root):
            rel = path.relative_to(root).as_posix()
            seen.add(rel)
            st = path.stat()
            prev = existing.get(rel)
            if not force and prev and abs(prev[0] - st.st_mtime) < 1e-3 and prev[1] == st.st_size:
                skipped += 1
                continue
            try:
                text = _extract_text(path)
            except Exception:
                continue
            sha1 = hashlib.sha1(text.encode("utf-8", errors="replace")).hexdigest()
            chunks = _chunk_text(text)

            old_ids = [r[0] for r in conn.execute("SELECT id FROM chunks WHERE rel_path = ?", (rel,))]
            for cid in old_ids:
                conn.execute("DELETE FROM chunks_fts WHERE rowid = ?", (cid,))
            conn.execute("DELETE FROM chunks WHERE rel_path = ?", (rel,))

            for idx, (heading, content) in enumerate(chunks):
                cur = conn.execute(
                    "INSERT INTO chunks(rel_path, chunk_index, heading, content) VALUES (?, ?, ?, ?)",
                    (rel, idx, heading, content),
                )
                rowid = cur.lastrowid
                conn.execute(
                    "INSERT INTO chunks_fts(rowid, rel_path, heading, content, stems) VALUES (?, ?, ?, ?, ?)",
                    (rowid, rel, heading, content, _stem_text(f"{heading} {content}")),
                )
            conn.execute(
                "INSERT OR REPLACE INTO files(rel_path, mtime, size, sha1, chunk_count) VALUES (?, ?, ?, ?, ?)",
                (rel, st.st_mtime, st.st_size, sha1, len(chunks)),
            )
            if prev:
                updated += 1
            else:
                added += 1

        for stale in set(existing) - seen:
            old_ids = [r[0] for r in conn.execute("SELECT id FROM chunks WHERE rel_path = ?", (stale,))]
            for cid in old_ids:
                conn.execute("DELETE FROM chunks_fts WHERE rowid = ?", (cid,))
            conn.execute("DELETE FROM chunks WHERE rel_path = ?", (stale,))
            conn.execute("DELETE FROM files WHERE rel_path = ?", (stale,))
            removed += 1

        conn.commit()
        total_files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
        total_chunks = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        return {
            "root": str(root),
            "added": added,
            "updated": updated,
            "removed": removed,
            "unchanged": skipped,
            "total_files": total_files,
            "total_chunks": total_chunks,
        }
    finally:
        conn.close()


@mcp.tool()
def kb_index(folder: str = "", force: bool = False) -> dict[str, Any]:
    """Index (or incrementally refresh) the knowledge base folder. Run automatically on search, or call with ``force=True`` to rebuild."""
    root = Path(os.path.expanduser(folder)).resolve() if folder else _default_dir()
    if not root.exists():
        raise FileNotFoundError(f"Knowledge base folder does not exist: {root}")
    return _sync_index(root, force=force)


@mcp.tool()
def kb_search(query: str, limit: int = 8, folder: str = "") -> dict[str, Any]:
    """Full-text BM25 search across the knowledge base (supports Russian & English morphology). Returns ranked chunks with file paths and headings."""
    root = Path(os.path.expanduser(folder)).resolve() if folder else _default_dir()
    _sync_index(root, force=False)
    words = [m.group(0) for m in WORD_RE.finditer(query)]
    if not words:
        return {"query": query, "results": []}
    terms = [f'("{w}" OR "{_stem(w)}*")' for w in words[:12]]
    fts_query = " AND ".join(terms)
    conn = _db(root)
    try:
        rows = conn.execute(
            """
            SELECT c.id, c.rel_path, c.chunk_index, c.heading, c.content,
                   bm25(chunks_fts, 1.5, 2.0, 1.0, 0.8) AS score
            FROM chunks_fts
            JOIN chunks c ON c.id = chunks_fts.rowid
            WHERE chunks_fts MATCH ?
            ORDER BY score
            LIMIT ?
            """,
            (fts_query, max(1, min(limit, 25))),
        ).fetchall()
        if not rows and len(terms) > 1:
            fts_or = " OR ".join(terms)
            rows = conn.execute(
                """
                SELECT c.id, c.rel_path, c.chunk_index, c.heading, c.content,
                       bm25(chunks_fts, 1.5, 2.0, 1.0, 0.8) AS score
                FROM chunks_fts
                JOIN chunks c ON c.id = chunks_fts.rowid
                WHERE chunks_fts MATCH ?
                ORDER BY score
                LIMIT ?
                """,
                (fts_or, max(1, min(limit, 25))),
            ).fetchall()
        return {
            "root": str(root),
            "query": query,
            "results": [
                {
                    "path": r["rel_path"],
                    "chunk_index": r["chunk_index"],
                    "heading": r["heading"],
                    "score": round(float(r["score"]), 4),
                    "content": r["content"],
                }
                for r in rows
            ],
        }
    finally:
        conn.close()


@mcp.tool()
def kb_list_documents(folder: str = "") -> dict[str, Any]:
    """List all indexed documents in the knowledge base with size, chunk count, and last-modified timestamp."""
    root = Path(os.path.expanduser(folder)).resolve() if folder else _default_dir()
    _sync_index(root, force=False)
    conn = _db(root)
    try:
        rows = conn.execute(
            "SELECT rel_path, size, chunk_count, mtime FROM files ORDER BY rel_path"
        ).fetchall()
        return {
            "root": str(root),
            "documents": [
                {
                    "path": r["rel_path"],
                    "size_bytes": r["size"],
                    "chunks": r["chunk_count"],
                    "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(r["mtime"])),
                }
                for r in rows
            ],
        }
    finally:
        conn.close()


@mcp.tool()
def kb_read_document(rel_path: str, max_chars: int = 12000, folder: str = "") -> dict[str, Any]:
    """Read the extracted plain text of a document in the knowledge base by its relative path."""
    root = Path(os.path.expanduser(folder)).resolve() if folder else _default_dir()
    target = (root / rel_path).resolve()
    if root not in target.parents and target != root:
        raise ValueError("Path escapes knowledge base root")
    if not target.is_file():
        raise FileNotFoundError(f"Document not found: {rel_path}")
    text = _extract_text(target)
    return {
        "path": rel_path,
        "total_chars": len(text),
        "truncated": len(text) > max_chars,
        "content": text[:max_chars],
    }


@mcp.tool()
def kb_save_note(rel_path: str, content: str, folder: str = "") -> dict[str, Any]:
    """Save or overwrite a Markdown/text note inside the knowledge base and immediately index it."""
    root = Path(os.path.expanduser(folder)).resolve() if folder else _default_dir()
    if not Path(rel_path).suffix:
        rel_path = f"{rel_path}.md"
    target = (root / rel_path).resolve()
    if root not in target.parents:
        raise ValueError("Path escapes knowledge base root")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    stats = _sync_index(root, force=False)
    return {"saved": target.relative_to(root).as_posix(), "index": stats}


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
