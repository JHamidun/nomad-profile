#!/usr/bin/env python3
"""Bitrix24 MCP Server — CRM deals/leads/contacts, tasks, users, and generic REST call via inbound webhook.

Auth: create an inbound webhook inside your Bitrix24 portal (Developer resources -> Other -> Inbound webhook)
with scopes ``crm``, ``task``, ``user`` and set ``BITRIX24_WEBHOOK_URL`` to the full base URL, e.g.
``https://mycompany.bitrix24.ru/rest/1/abc123def456/``.

Single-file stdio MCP server, stdlib HTTP only.
"""
from __future__ import annotations

import inspect
import json
import os
import re
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
    "bitrix24",
    instructions="Bitrix24 CRM (deals, leads, contacts, companies), tasks, users, and generic REST call via inbound webhook.",
)

USER_AGENT = "Nomad-MCP-Bitrix24/1.0"
ALLOWED_RU_SUFFIXES = (".bitrix24.ru", ".ru", ".рф", ".su")


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
    if scheme and scheme != "https":
        raise PermissionError(
            f"ru_only_ru_endpoint_without_tls: {raw!r} must use https under nomad.ru_only"
        )


def _webhook() -> str:
    raw = os.environ.get("BITRIX24_WEBHOOK_URL", "").strip().rstrip("/")
    if not raw:
        raise RuntimeError(
            "BITRIX24_WEBHOOK_URL is not set. Create an inbound webhook in Bitrix24 "
            "(Developer resources -> Other -> Inbound webhook) and set the full URL: "
            "https://<portal>.bitrix24.ru/rest/<user_id>/<token>/"
        )
    _assert_ru_endpoint(raw)
    if not re.match(
        r"^(?:https://[^/]+|http://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?)/rest/\d+/[A-Za-z0-9_]+$",
        raw,
    ):
        raise RuntimeError(
            "BITRIX24_WEBHOOK_URL must match https://<portal>/rest/<user_id>/<token>[/] "
            "(do not append a method name)."
        )
    return raw


def _call(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    if not re.match(r"^[a-zA-Z0-9_.]+$", method):
        raise ValueError(f"Invalid Bitrix24 method name: {method!r}")
    url = f"{_webhook()}/{method}.json"
    _assert_ru_endpoint(url)
    body = json.dumps(params or {}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"Bitrix24 {method} HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Bitrix24 {method} network error: {e.reason}") from e
    if isinstance(data, dict) and data.get("error"):
        raise RuntimeError(f"Bitrix24 {method}: {data.get('error')} — {data.get('error_description', '')}")
    return data


@mcp.tool()
def b24_current_user() -> dict[str, Any]:
    """Return the Bitrix24 profile of the user who owns the webhook (also verifies connectivity)."""
    return _call("user.current")


@mcp.tool()
def b24_deals_list(
    stage_id: str = "",
    assigned_by_id: int = 0,
    search_title: str = "",
    limit: int = 20,
) -> dict[str, Any]:
    """List CRM deals with optional filters by stage, responsible user ID, or title substring."""
    flt: dict[str, Any] = {}
    if stage_id:
        flt["STAGE_ID"] = stage_id
    if assigned_by_id:
        flt["ASSIGNED_BY_ID"] = assigned_by_id
    if search_title:
        flt["%TITLE"] = search_title
    res = _call(
        "crm.deal.list",
        {
            "order": {"DATE_MODIFY": "DESC"},
            "filter": flt,
            "select": [
                "ID", "TITLE", "STAGE_ID", "OPPORTUNITY", "CURRENCY_ID",
                "ASSIGNED_BY_ID", "CONTACT_ID", "COMPANY_ID", "DATE_CREATE", "DATE_MODIFY", "CLOSEDATE",
            ],
        },
    )
    items = (res.get("result") or [])[: max(1, min(limit, 50))]
    return {"total": res.get("total", len(items)), "deals": items}


@mcp.tool()
def b24_deal_get(deal_id: int) -> dict[str, Any]:
    """Fetch full fields of a single CRM deal by ID."""
    return _call("crm.deal.get", {"id": int(deal_id)}).get("result") or {}


@mcp.tool()
def b24_deal_create(
    title: str,
    opportunity: float = 0.0,
    currency_id: str = "RUB",
    stage_id: str = "",
    contact_id: int = 0,
    company_id: int = 0,
    comments: str = "",
) -> dict[str, Any]:
    """Create a new CRM deal. Returns the new deal ID."""
    fields: dict[str, Any] = {"TITLE": title, "CURRENCY_ID": currency_id}
    if opportunity:
        fields["OPPORTUNITY"] = opportunity
    if stage_id:
        fields["STAGE_ID"] = stage_id
    if contact_id:
        fields["CONTACT_ID"] = contact_id
    if company_id:
        fields["COMPANY_ID"] = company_id
    if comments:
        fields["COMMENTS"] = comments
    res = _call("crm.deal.add", {"fields": fields})
    return {"deal_id": res.get("result")}


@mcp.tool()
def b24_deal_add_comment(deal_id: int, comment: str) -> dict[str, Any]:
    """Post a timeline comment on a CRM deal."""
    res = _call(
        "crm.timeline.comment.add",
        {"fields": {"ENTITY_ID": int(deal_id), "ENTITY_TYPE": "deal", "COMMENT": comment}},
    )
    return {"comment_id": res.get("result")}


@mcp.tool()
def b24_leads_list(status_id: str = "", search_title: str = "", limit: int = 20) -> dict[str, Any]:
    """List CRM leads with optional status or title filter."""
    flt: dict[str, Any] = {}
    if status_id:
        flt["STATUS_ID"] = status_id
    if search_title:
        flt["%TITLE"] = search_title
    res = _call(
        "crm.lead.list",
        {
            "order": {"DATE_CREATE": "DESC"},
            "filter": flt,
            "select": ["ID", "TITLE", "NAME", "LAST_NAME", "STATUS_ID", "OPPORTUNITY", "CURRENCY_ID", "PHONE", "EMAIL", "DATE_CREATE"],
        },
    )
    items = (res.get("result") or [])[: max(1, min(limit, 50))]
    return {"total": res.get("total", len(items)), "leads": items}


@mcp.tool()
def b24_lead_create(
    title: str,
    name: str = "",
    last_name: str = "",
    phone: str = "",
    email: str = "",
    comments: str = "",
) -> dict[str, Any]:
    """Create a new CRM lead."""
    fields: dict[str, Any] = {"TITLE": title}
    if name:
        fields["NAME"] = name
    if last_name:
        fields["LAST_NAME"] = last_name
    if phone:
        fields["PHONE"] = [{"VALUE": phone, "VALUE_TYPE": "WORK"}]
    if email:
        fields["EMAIL"] = [{"VALUE": email, "VALUE_TYPE": "WORK"}]
    if comments:
        fields["COMMENTS"] = comments
    res = _call("crm.lead.add", {"fields": fields})
    return {"lead_id": res.get("result")}


@mcp.tool()
def b24_contacts_search(query: str, limit: int = 20) -> dict[str, Any]:
    """Search CRM contacts by name/last name substring."""
    res = _call(
        "crm.contact.list",
        {
            "filter": {"%NAME": query},
            "select": ["ID", "NAME", "LAST_NAME", "POST", "COMPANY_ID", "PHONE", "EMAIL"],
        },
    )
    items = (res.get("result") or [])[: max(1, min(limit, 50))]
    return {"contacts": items}


@mcp.tool()
def b24_tasks_list(responsible_id: int = 0, only_open: bool = True, limit: int = 20) -> dict[str, Any]:
    """List Bitrix24 tasks, optionally filtered by responsible user and open status."""
    flt: dict[str, Any] = {}
    if responsible_id:
        flt["RESPONSIBLE_ID"] = responsible_id
    if only_open:
        flt["!REAL_STATUS"] = 5
    res = _call(
        "tasks.task.list",
        {
            "order": {"DEADLINE": "ASC", "ID": "DESC"},
            "filter": flt,
            "select": ["ID", "TITLE", "STATUS", "PRIORITY", "DEADLINE", "RESPONSIBLE_ID", "CREATED_BY", "CREATED_DATE"],
        },
    )
    tasks = ((res.get("result") or {}).get("tasks") or [])[: max(1, min(limit, 50))]
    return {"tasks": tasks}


@mcp.tool()
def b24_task_create(
    title: str,
    responsible_id: int,
    description: str = "",
    deadline: str = "",
    priority: int = 1,
) -> dict[str, Any]:
    """Create a Bitrix24 task. ``deadline`` is ISO date/datetime (e.g. ``2026-04-20T18:00:00``); ``priority``: 2=high, 1=normal."""
    fields: dict[str, Any] = {
        "TITLE": title,
        "RESPONSIBLE_ID": int(responsible_id),
        "PRIORITY": int(priority),
    }
    if description:
        fields["DESCRIPTION"] = description
    if deadline:
        fields["DEADLINE"] = deadline
    res = _call("tasks.task.add", {"fields": fields})
    return (res.get("result") or {}).get("task") or res


@mcp.tool()
def b24_call(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Call any Bitrix24 REST method supported by the webhook's scopes (e.g. ``crm.company.list``, ``im.message.add``)."""
    return _call(method, params or {})


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
