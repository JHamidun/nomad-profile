#!/usr/bin/env python3
"""RU Counterparty Check MCP Server — ЕГРЮЛ/ЕГРИП, ИНН, самозанятые (ФНС), банки по БИК, ФИАС-адреса.

Uses DaData Suggestions API when ``DADATA_API_KEY`` is set (free tier: 10 000 requests/day at https://dadata.ru/api/)
and falls back to official public ФНС endpoints (``egrul.nalog.ru`` for ЕГРЮЛ/ЕГРИП search,
``statusnpd.nalog.ru`` for self-employed НПД status) which work without any API key.

Single-file stdio MCP server, stdlib HTTP only.
"""
from __future__ import annotations

import datetime as dt
import inspect
import json
import os
import re
import sys
import time
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
    "ru-counterparty",
    instructions="Проверка российских контрагентов (ЕГРЮЛ/ЕГРИП по ИНН/ОГРН/названию, статус самозанятого НПД в ФНС, банк по БИК, стандартизация адресов ФИАС/КЛАДР).",
)

USER_AGENT = "Nomad-MCP-RuCounterparty/1.0"
ALLOWED_RU_SUFFIXES = (".dadata.ru", ".nalog.ru", ".gov.ru", ".ru", ".рф", ".su")


def _dadata_suggestions_url() -> str:
    return os.environ.get(
        "DADATA_SUGGESTIONS_URL", "https://suggestions.dadata.ru/suggestions/api/4_1/rs"
    ).strip().rstrip("/")


def _dadata_cleaner_url() -> str:
    return os.environ.get(
        "DADATA_CLEANER_URL", "https://cleaner.dadata.ru/api/v1"
    ).strip().rstrip("/")


def _egrul_base_url() -> str:
    return os.environ.get("EGRUL_BASE_URL", "https://egrul.nalog.ru").strip().rstrip("/")


def _npd_base_url() -> str:
    return os.environ.get(
        "NPD_BASE_URL", "https://statusnpd.nalog.ru/api/v1/tracker/taxpayer_status"
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


def _http_json(
    url: str,
    *,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    payload: Any | None = None,
    form: dict[str, str] | None = None,
    timeout: int = 20,
) -> Any:
    _assert_ru_endpoint(url)
    hdrs = {"User-Agent": USER_AGENT, "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    data: bytes | None = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/json; charset=utf-8")
    elif form is not None:
        data = urllib.parse.urlencode(form).encode("utf-8")
        hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8")
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {e.code} from {url}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error calling {url}: {e.reason}") from e


def _dadata_headers(with_secret: bool = False) -> dict[str, str] | None:
    key = os.environ.get("DADATA_API_KEY", "").strip()
    if not key:
        return None
    hdrs = {"Authorization": f"Token {key}"}
    if with_secret:
        secret = os.environ.get("DADATA_SECRET_KEY", "").strip()
        if secret:
            hdrs["X-Secret"] = secret
    return hdrs


def _format_party_suggestion(item: dict[str, Any]) -> dict[str, Any]:
    d = item.get("data") or {}
    state = d.get("state") or {}
    mgmt = d.get("management") or {}
    addr = (d.get("address") or {}).get("value")
    reg_ts = state.get("registration_date")
    reg_date = (
        dt.datetime.fromtimestamp(reg_ts / 1000, tz=dt.timezone.utc).strftime("%Y-%m-%d")
        if isinstance(reg_ts, (int, float))
        else None
    )
    return {
        "name": item.get("value"),
        "full_name": (d.get("name") or {}).get("full_with_opf"),
        "type": d.get("type"),
        "inn": d.get("inn"),
        "kpp": d.get("kpp"),
        "ogrn": d.get("ogrn"),
        "okpo": d.get("okpo"),
        "okved": d.get("okved"),
        "status": state.get("status"),
        "registration_date": reg_date,
        "management": {"name": mgmt.get("name"), "post": mgmt.get("post")} if mgmt else None,
        "address": addr,
    }


def _egrul_nalog_search(query: str, count: int = 10) -> list[dict[str, Any]]:
    base = _egrul_base_url()
    token_resp = _http_json(f"{base}/", method="POST", form={"query": query})
    t = token_resp.get("t")
    if not t:
        return []
    for _ in range(10):
        res = _http_json(f"{base}/search-result/{t}", method="GET")
        if res.get("status") == "wait":
            time.sleep(0.5)
            continue
        rows = res.get("rows") or []
        out = []
        for r in rows[:count]:
            out.append(
                {
                    "name": r.get("c") or r.get("n"),
                    "full_name": r.get("n"),
                    "kind": "INDIVIDUAL" if r.get("k") == "fl" else "LEGAL",
                    "inn": r.get("i"),
                    "kpp": r.get("p"),
                    "ogrn": r.get("o"),
                    "registration_date": r.get("r"),
                    "termination_date": r.get("e"),
                    "director": r.get("g"),
                    "address": r.get("a"),
                }
            )
        return out
    return []


@mcp.tool()
def counterparty_by_inn(inn_or_ogrn: str, kpp: str = "") -> dict[str, Any]:
    """Find a Russian company or sole proprietor (ИП) by exact ИНН or ОГРН. Uses DaData if ``DADATA_API_KEY`` is set, otherwise public ФНС ``egrul.nalog.ru``."""
    q = inn_or_ogrn.strip()
    hdrs = _dadata_headers()
    if hdrs:
        payload: dict[str, Any] = {"query": q}
        if kpp:
            payload["kpp"] = kpp.strip()
        res = _http_json(
            f"{_dadata_suggestions_url()}/findById/party",
            method="POST",
            headers=hdrs,
            payload=payload,
        )
        items = [_format_party_suggestion(x) for x in (res.get("suggestions") or [])]
        return {"source": "dadata", "query": q, "results": items}
    return {"source": "egrul.nalog.ru", "query": q, "results": _egrul_nalog_search(q, count=10)}


@mcp.tool()
def counterparty_search(query: str, count: int = 10) -> dict[str, Any]:
    """Search Russian companies / ИП by name, ИНН, ОГРН, or address."""
    n = max(1, min(count, 20))
    hdrs = _dadata_headers()
    if hdrs:
        res = _http_json(
            f"{_dadata_suggestions_url()}/suggest/party",
            method="POST",
            headers=hdrs,
            payload={"query": query, "count": n},
        )
        items = [_format_party_suggestion(x) for x in (res.get("suggestions") or [])]
        return {"source": "dadata", "query": query, "results": items}
    return {"source": "egrul.nalog.ru", "query": query, "results": _egrul_nalog_search(query, count=n)}


@mcp.tool()
def self_employed_status(inn: str, on_date: str = "") -> dict[str, Any]:
    """Check whether an individual (12-digit ИНН) is registered as a self-employed taxpayer (самозанятый / плательщик НПД) via the official ФНС endpoint ``statusnpd.nalog.ru``. Works without API keys."""
    clean_inn = re.sub(r"\D", "", inn)
    if len(clean_inn) != 12:
        raise ValueError("Self-employed status check requires a 12-digit individual ИНН (физлицо/ИП).")
    date_str = on_date.strip() or dt.date.today().isoformat()
    res = _http_json(
        _npd_base_url(),
        method="POST",
        payload={"inn": clean_inn, "requestDate": date_str},
    )
    return {
        "inn": clean_inn,
        "date": date_str,
        "is_self_employed": bool(res.get("status")),
        "message": res.get("message", ""),
    }


@mcp.tool()
def bank_by_bic(bic_or_inn_or_swift: str) -> dict[str, Any]:
    """Look up a Russian bank by БИК, ИНН, SWIFT, or name (correspondent account, status, address). Requires ``DADATA_API_KEY``."""
    hdrs = _dadata_headers()
    if not hdrs:
        raise RuntimeError(
            "DADATA_API_KEY is required for bank lookup. Get a free key (10 000 req/day) at https://dadata.ru/api/"
        )
    res = _http_json(
        f"{_dadata_suggestions_url()}/findById/bank",
        method="POST",
        headers=hdrs,
        payload={"query": bic_or_inn_or_swift.strip()},
    )
    banks = []
    for item in res.get("suggestions") or []:
        d = item.get("data") or {}
        banks.append(
            {
                "name": item.get("value"),
                "bic": d.get("bic"),
                "swift": d.get("swift"),
                "inn": d.get("inn"),
                "kpp": d.get("kpp"),
                "correspondent_account": d.get("correspondent_account"),
                "registration_number": d.get("registration_number"),
                "payment_city": d.get("payment_city"),
                "address": (d.get("address") or {}).get("value"),
                "status": (d.get("state") or {}).get("status"),
            }
        )
    return {"query": bic_or_inn_or_swift, "banks": banks}


@mcp.tool()
def address_fias_suggest(query: str, count: int = 5) -> dict[str, Any]:
    """Normalize a Russian postal address and return its ФИАС / КЛАДР codes, postal index, region, city, and coordinates. Requires ``DADATA_API_KEY``."""
    hdrs = _dadata_headers()
    if not hdrs:
        raise RuntimeError(
            "DADATA_API_KEY is required for FIAS address lookup. Get a free key at https://dadata.ru/api/"
        )
    res = _http_json(
        f"{_dadata_suggestions_url()}/suggest/address",
        method="POST",
        headers=hdrs,
        payload={"query": query, "count": max(1, min(count, 20))},
    )
    addresses = []
    for item in res.get("suggestions") or []:
        d = item.get("data") or {}
        addresses.append(
            {
                "value": item.get("value"),
                "unrestricted_value": item.get("unrestricted_value"),
                "postal_code": d.get("postal_code"),
                "region": d.get("region_with_type"),
                "city": d.get("city_with_type") or d.get("settlement_with_type"),
                "street": d.get("street_with_type"),
                "house": d.get("house"),
                "fias_id": d.get("fias_id"),
                "fias_level": d.get("fias_level"),
                "kladr_id": d.get("kladr_id"),
                "okato": d.get("okato"),
                "oktmo": d.get("oktmo"),
                "geo_lat": d.get("geo_lat"),
                "geo_lon": d.get("geo_lon"),
            }
        )
    return {"query": query, "addresses": addresses}


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
