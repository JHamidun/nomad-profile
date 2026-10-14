#!/usr/bin/env python3
"""Yandex Metrika MCP Server — counters, traffic summary, sources, top pages, search phrases, goals, and custom reports.

Auth: obtain an OAuth token with ``metrika:read`` scope at https://oauth.yandex.ru and set ``YANDEX_METRIKA_TOKEN``.

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
    "yandex-metrika",
    instructions="Яндекс.Метрика: список счётчиков, цели, сводка трафика, источники, популярные страницы, поисковые запросы и произвольные отчёты Stat API v1.",
)

USER_AGENT = "Nomad-MCP-YandexMetrika/1.0"
ALLOWED_RU_SUFFIXES = (".yandex.net", ".yandex.ru", ".ya.ru", ".ru", ".рф", ".su")


def _mgmt_url() -> str:
    return os.environ.get(
        "YANDEX_METRIKA_MGMT_URL", "https://api-metrika.yandex.net/management/v1"
    ).strip().rstrip("/")


def _stat_url() -> str:
    return os.environ.get(
        "YANDEX_METRIKA_STAT_URL", "https://api-metrika.yandex.net/stat/v1/data"
    ).strip().rstrip("/")


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
    tok = os.environ.get("YANDEX_METRIKA_TOKEN", "").strip()
    if not tok:
        raise RuntimeError(
            "YANDEX_METRIKA_TOKEN is not set. Obtain an OAuth token with metrika:read scope at https://oauth.yandex.ru."
        )
    return tok


def _get(url: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if params:
        clean = {k: v for k, v in params.items() if v is not None and v != ""}
        if clean:
            url = f"{url}?{urllib.parse.urlencode(clean)}"
    _assert_ru_endpoint(url)
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"OAuth {_token()}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Yandex Metrika HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Yandex Metrika network error: {e.reason}") from e


def _format_stat(res: dict[str, Any]) -> dict[str, Any]:
    query = res.get("query") or {}
    dim_names = query.get("dimensions") or []
    met_names = query.get("metrics") or []
    rows = []
    for item in res.get("data") or []:
        dims = [d.get("name") for d in (item.get("dimensions") or [])]
        mets = item.get("metrics") or []
        rows.append(
            {
                "dimensions": dict(zip(dim_names, dims)),
                "metrics": dict(zip(met_names, mets)),
            }
        )
    return {
        "total_rows": res.get("total_rows", len(rows)),
        "totals": dict(zip(met_names, res.get("totals") or [])),
        "rows": rows,
    }


@mcp.tool()
def metrika_counters(search: str = "") -> dict[str, Any]:
    """List Yandex Metrika counters accessible to the token."""
    params: dict[str, Any] = {"per_page": 100}
    if search:
        params["search_string"] = search
    res = _get(f"{_mgmt_url()}/counters", params)
    counters = [
        {
            "id": c.get("id"),
            "name": c.get("name"),
            "site": c.get("site2", {}).get("site") or c.get("site"),
            "status": c.get("status"),
            "code_status": c.get("code_status"),
            "create_time": c.get("create_time"),
        }
        for c in (res.get("counters") or [])
    ]
    return {"counters": counters}


@mcp.tool()
def metrika_goals(counter_id: int) -> dict[str, Any]:
    """List conversion goals configured on a Yandex Metrika counter."""
    res = _get(f"{_mgmt_url()}/counter/{int(counter_id)}/goals")
    goals = [
        {
            "id": g.get("id"),
            "name": g.get("name"),
            "type": g.get("type"),
            "is_retargeting": g.get("is_retargeting"),
            "conditions": g.get("conditions"),
        }
        for g in (res.get("goals") or [])
    ]
    return {"counter_id": counter_id, "goals": goals}


@mcp.tool()
def metrika_traffic_summary(
    counter_id: int,
    date1: str = "7daysAgo",
    date2: str = "today",
) -> dict[str, Any]:
    """Return overall traffic metrics (visits, users, pageviews, bounceRate, pageDepth, avgVisitDurationSeconds) for ``counter_id`` over ``[date1, date2]`` (``YYYY-MM-DD`` or ``today``, ``yesterday``, ``7daysAgo``, ``30daysAgo``)."""
    res = _get(
        _stat_url(),
        {
            "ids": str(int(counter_id)),
            "metrics": "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds",
            "date1": date1,
            "date2": date2,
        },
    )
    return _format_stat(res)


@mcp.tool()
def metrika_traffic_sources(
    counter_id: int,
    date1: str = "30daysAgo",
    date2: str = "today",
    limit: int = 20,
) -> dict[str, Any]:
    """Breakdown of traffic sources (search engines, direct, social, referrals, ads) for ``counter_id``."""
    res = _get(
        _stat_url(),
        {
            "ids": str(int(counter_id)),
            "dimensions": "ym:s:lastSignTrafficSource,ym:s:lastSignSourceEngine",
            "metrics": "ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth",
            "date1": date1,
            "date2": date2,
            "limit": max(1, min(limit, 100)),
        },
    )
    return _format_stat(res)


@mcp.tool()
def metrika_top_pages(
    counter_id: int,
    date1: str = "30daysAgo",
    date2: str = "today",
    limit: int = 25,
) -> dict[str, Any]:
    """Return top landing / entry URLs by visits and users for ``counter_id``."""
    res = _get(
        _stat_url(),
        {
            "ids": str(int(counter_id)),
            "dimensions": "ym:s:startURL",
            "metrics": "ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:avgVisitDurationSeconds",
            "date1": date1,
            "date2": date2,
            "limit": max(1, min(limit, 100)),
        },
    )
    return _format_stat(res)


@mcp.tool()
def metrika_report(
    counter_id: int,
    metrics: str = "ym:s:visits,ym:s:users",
    dimensions: str = "",
    filters: str = "",
    date1: str = "30daysAgo",
    date2: str = "today",
    sort: str = "",
    limit: int = 25,
) -> dict[str, Any]:
    """Run any custom Yandex Metrika Stat API v1 report with arbitrary ``metrics``, ``dimensions``, and ``filters``."""
    res = _get(
        _stat_url(),
        {
            "ids": str(int(counter_id)),
            "metrics": metrics,
            "dimensions": dimensions,
            "filters": filters,
            "date1": date1,
            "date2": date2,
            "sort": sort,
            "limit": max(1, min(limit, 100)),
        },
    )
    return _format_stat(res)


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
