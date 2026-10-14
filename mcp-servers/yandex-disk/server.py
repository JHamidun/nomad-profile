#!/usr/bin/env python3
"""Yandex Disk MCP Server — browse, search, upload, download, and publish files via Yandex Disk REST API.

Auth: obtain an OAuth token with ``cloud_api:disk.read`` and ``cloud_api:disk.write`` scopes
(e.g. via https://oauth.yandex.ru) and set ``YANDEX_DISK_TOKEN`` in the environment.

Single-file stdio MCP server, stdlib HTTP only.
"""
from __future__ import annotations

import inspect
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
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
    "yandex-disk",
    instructions="Yandex Disk cloud storage: quota, list/search files, create folders, read/write text files, and publish share links.",
)

USER_AGENT = "Nomad-MCP-YandexDisk/1.0"
ALLOWED_RU_SUFFIXES = (".yandex.net", ".yandex.ru", ".ya.ru", ".ru", ".рф", ".su")


def _base_url() -> str:
    return os.environ.get("YANDEX_DISK_BASE_URL", "https://cloud-api.yandex.net/v1/disk").strip().rstrip("/")


def _is_ru_only() -> bool:
    env_val = os.environ.get("NOMAD_RU_ONLY", "").strip().lower()
    if env_val in ("1", "true", "yes", "on"):
        return True
    home = os.environ.get("HERMES_HOME", "").strip()
    if not home:
        return False
    cfg_path = Path(home) / "config.yaml"
    if not cfg_path.is_file():
        return False
    try:
        import yaml

        data = yaml.safe_load(cfg_path.read_text(encoding="utf-8-sig"))
    except Exception:
        return True
    if not isinstance(data, dict) or "nomad" not in data or data["nomad"] is None:
        return False
    sec = data["nomad"]
    if not isinstance(sec, dict):
        return True
    if "ru_only" not in sec:
        return False
    raw = sec["ru_only"]
    return raw if isinstance(raw, bool) else True


def _assert_ru_endpoint(url_or_host: str, allowed_suffixes: tuple[str, ...] = ALLOWED_RU_SUFFIXES) -> None:
    if not _is_ru_only():
        return
    raw = (url_or_host or "").strip()
    parts = urllib.parse.urlsplit(raw if "://" in raw else f"//{raw}")
    scheme = (parts.scheme or "").lower()
    host = (parts.hostname or "").lower().rstrip(".")
    if not host or not any(
        host == s.lstrip(".") or host.endswith(s if s.startswith(".") else "." + s)
        for s in allowed_suffixes
    ):
        raise PermissionError(
            f"ru_only_endpoint_not_in_ru_allowlist: host={host!r} is outside the RU contour"
        )
    if scheme != "https":
        raise PermissionError(
            f"ru_only_ru_endpoint_without_tls: {raw!r} must use https under nomad.ru_only"
        )


def _token() -> str:
    tok = os.environ.get("YANDEX_DISK_TOKEN", "").strip()
    if not tok:
        raise RuntimeError(
            "YANDEX_DISK_TOKEN is not set. Create an OAuth token with cloud_api:disk.read / cloud_api:disk.write "
            "at https://oauth.yandex.ru and set YANDEX_DISK_TOKEN."
        )
    return tok


def _request(
    method: str,
    path: str,
    params: dict[str, Any] | None = None,
    body: bytes | None = None,
    content_type: str = "application/json",
) -> Any:
    url = f"{_base_url()}{path}"
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    _assert_ru_endpoint(url)
    headers = {
        "Authorization": f"OAuth {_token()}",
        "Accept": "application/json",
        "User-Agent": USER_AGENT,
    }
    if body is not None:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read()
            if not raw:
                return {"status": resp.status}
            return json.loads(raw.decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Yandex Disk API {method} {path} HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Yandex Disk network error: {e.reason}") from e


def _norm_path(p: str) -> str:
    p = (p or "/").strip()
    if p in ("", "/"):
        return "disk:/"
    if not p.startswith("disk:") and not p.startswith("app:") and not p.startswith("trash:"):
        p = "disk:/" + p.lstrip("/")
    return p


@mcp.tool()
def ydisk_quota() -> dict[str, Any]:
    """Return Yandex Disk total space, used space, trash size, and user info."""
    data = _request("GET", "")
    total = int(data.get("total_space") or 0)
    used = int(data.get("used_space") or 0)
    trash = int(data.get("trash_size") or 0)
    return {
        "user": (data.get("user") or {}).get("display_name") or (data.get("user") or {}).get("login"),
        "total_gb": round(total / (1024**3), 2),
        "used_gb": round(used / (1024**3), 2),
        "free_gb": round(max(0, total - used) / (1024**3), 2),
        "trash_mb": round(trash / (1024**2), 2),
    }


@mcp.tool()
def ydisk_list(path: str = "/", limit: int = 50, offset: int = 0) -> dict[str, Any]:
    """List files and folders at ``path`` on Yandex Disk (e.g. ``/``, ``/Documents``)."""
    data = _request(
        "GET",
        "/resources",
        {"path": _norm_path(path), "limit": max(1, min(limit, 200)), "offset": max(0, offset)},
    )
    emb = data.get("_embedded") or {}
    items = [
        {
            "name": it.get("name"),
            "path": it.get("path"),
            "type": it.get("type"),
            "size": it.get("size"),
            "modified": it.get("modified"),
            "public_url": it.get("public_url"),
            "mime_type": it.get("mime_type"),
        }
        for it in (emb.get("items") or [])
    ]
    return {"path": data.get("path"), "total": emb.get("total", len(items)), "items": items}


@mcp.tool()
def ydisk_recent_files(limit: int = 25, media_type: str = "") -> dict[str, Any]:
    """List recently uploaded files across the entire Yandex Disk. Optional ``media_type``: ``document``, ``spreadsheet``, ``text``, ``image``, ``audio``, ``video``, ``compressed``."""
    params: dict[str, Any] = {"limit": max(1, min(limit, 100))}
    if media_type:
        params["media_type"] = media_type
    data = _request("GET", "/resources/files", params)
    items = [
        {
            "name": it.get("name"),
            "path": it.get("path"),
            "size": it.get("size"),
            "modified": it.get("modified"),
            "mime_type": it.get("mime_type"),
            "public_url": it.get("public_url"),
        }
        for it in (data.get("items") or [])
    ]
    return {"items": items}


@mcp.tool()
def ydisk_mkdir(path: str) -> dict[str, Any]:
    """Create a folder on Yandex Disk."""
    return _request("PUT", "/resources", {"path": _norm_path(path)})


@mcp.tool()
def ydisk_delete(path: str, permanently: bool = False) -> dict[str, Any]:
    """Delete a file or folder on Yandex Disk (moves to Trash unless ``permanently=True``)."""
    return _request("DELETE", "/resources", {"path": _norm_path(path), "permanently": str(permanently).lower()})


@mcp.tool()
def ydisk_publish(path: str) -> dict[str, Any]:
    """Publish a file or folder and return its public share URL."""
    norm = _norm_path(path)
    _request("PUT", "/resources/publish", {"path": norm})
    meta = _request("GET", "/resources", {"path": norm})
    return {"path": norm, "public_url": meta.get("public_url"), "public_key": meta.get("public_key")}


@mcp.tool()
def ydisk_upload_text(path: str, content: str, overwrite: bool = True) -> dict[str, Any]:
    """Upload a UTF-8 text/Markdown/JSON/CSV file to ``path`` on Yandex Disk."""
    norm = _norm_path(path)
    slot = _request("GET", "/resources/upload", {"path": norm, "overwrite": str(overwrite).lower()})
    href = slot.get("href")
    if not href:
        raise RuntimeError(f"Yandex Disk did not return an upload URL: {slot}")
    _assert_ru_endpoint(href)
    data = content.encode("utf-8")
    req = urllib.request.Request(
        href,
        data=data,
        method=slot.get("method") or "PUT",
        headers={"Content-Type": "text/plain; charset=utf-8", "User-Agent": USER_AGENT},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return {"path": norm, "bytes_written": len(data), "status": resp.status}


@mcp.tool()
def ydisk_download_text(path: str, max_chars: int = 20000) -> dict[str, Any]:
    """Download and decode a text file from Yandex Disk."""
    norm = _norm_path(path)
    slot = _request("GET", "/resources/download", {"path": norm})
    href = slot.get("href")
    if not href:
        raise RuntimeError(f"Yandex Disk did not return a download URL: {slot}")
    _assert_ru_endpoint(href)
    req = urllib.request.Request(href, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as resp:
        raw = resp.read(max_chars * 4 + 1024)
    text = raw.decode("utf-8", errors="replace")
    return {"path": norm, "truncated": len(text) > max_chars, "content": text[:max_chars]}


@mcp.tool()
def ydisk_upload_url(url: str, path: str) -> dict[str, Any]:
    """Tell Yandex Disk to fetch a remote ``url`` directly into ``path`` on Disk (server-side copy)."""
    _assert_ru_endpoint(url)
    norm = _norm_path(path)
    return _request("POST", "/resources/upload", {"path": norm, "url": url})


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
