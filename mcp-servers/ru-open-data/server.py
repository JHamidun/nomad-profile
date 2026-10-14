#!/usr/bin/env python3
"""RU Open Data MCP Server — ЦБ РФ (курсы валют), производственный календарь РФ (ТК РФ), котировки и индексы Мосбиржи (MOEX ISS).

Works out of the box with zero API keys.
Single-file stdio MCP server, stdlib HTTP only.
"""
from __future__ import annotations

import datetime as dt
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
    "ru-open-data",
    instructions="Открытые государственные и финансовые данные РФ без ключей: официальные курсы валют ЦБ РФ (с конвертером), производственный календарь РФ по ТК РФ (рабочие/выходные/праздники), котировки акций, ОФЗ и индексов Московской биржи (MOEX ISS).",
)

USER_AGENT = "Nomad-MCP-RuOpenData/1.0"
ALLOWED_RU_SUFFIXES = (
    ".cbr-xml-daily.ru",
    ".cbr.ru",
    ".xmlcalendar.ru",
    ".moex.com",
    ".gov.ru",
    ".ru",
    ".рф",
    ".su",
)


def _cbr_daily_url() -> str:
    return os.environ.get("CBR_URL", "https://www.cbr-xml-daily.ru/daily_json.js").strip()


def _cbr_archive_url_template() -> str:
    return os.environ.get(
        "CBR_ARCHIVE_URL_TEMPLATE",
        "https://www.cbr-xml-daily.ru/archive/{year:04d}/{month:02d}/{day:02d}/daily_json.js",
    ).strip()


def _calendar_url_template() -> str:
    return os.environ.get(
        "CALENDAR_URL_TEMPLATE", "https://xmlcalendar.ru/data/ru/{year}/calendar.json"
    ).strip()


def _moex_url() -> str:
    return os.environ.get("MOEX_URL", "https://iss.moex.com/iss").strip().rstrip("/")


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


def _get_json(url: str) -> Any:
    _assert_ru_endpoint(url)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            return json.loads(resp.read().decode("utf-8", errors="replace"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:400]
        raise RuntimeError(f"HTTP {e.code} from {url}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Network error calling {url}: {e.reason}") from e


def _cbr_fetch(on_date: str = "") -> dict[str, Any]:
    if not on_date:
        return _get_json(_cbr_daily_url())
    d = dt.date.fromisoformat(on_date.strip())
    for delta in range(7):
        cur = d - dt.timedelta(days=delta)
        url = _cbr_archive_url_template().format(year=cur.year, month=cur.month, day=cur.day)
        try:
            return _get_json(url)
        except RuntimeError:
            continue
    return _get_json(_cbr_daily_url())


@mcp.tool()
def cbr_exchange_rates(codes: str = "USD,EUR,CNY,AED,TRY,KZT,BYN", on_date: str = "") -> dict[str, Any]:
    """Return official Central Bank of Russia (ЦБ РФ) exchange rates to RUB. ``codes`` is a comma-separated list of ISO currency codes (or ``ALL``); ``on_date`` is optional ``YYYY-MM-DD``."""
    data = _cbr_fetch(on_date)
    valute = data.get("Valute") or {}
    wanted = {c.strip().upper() for c in codes.split(",") if c.strip()}
    rates: dict[str, Any] = {}
    for code, info in valute.items():
        if "ALL" not in wanted and code not in wanted:
            continue
        nominal = info.get("Nominal") or 1
        value = info.get("Value") or 0.0
        prev = info.get("Previous") or 0.0
        rates[code] = {
            "name": info.get("Name"),
            "nominal": nominal,
            "value_rub": value,
            "per_unit_rub": round(value / nominal, 6),
            "previous_rub": prev,
            "change_rub": round(value - prev, 4),
        }
    return {"date": (data.get("Date") or "")[:10], "rates": rates}


@mcp.tool()
def cbr_convert(amount: float, from_currency: str, to_currency: str = "RUB", on_date: str = "") -> dict[str, Any]:
    """Convert ``amount`` between RUB and any foreign currency at the official ЦБ РФ rate."""
    data = _cbr_fetch(on_date)
    valute = data.get("Valute") or {}

    def _per_unit_rub(code: str) -> float:
        c = code.strip().upper()
        if c in {"RUB", "RUR"}:
            return 1.0
        info = valute.get(c)
        if not info:
            raise ValueError(f"Unknown currency code in ЦБ РФ table: {c}")
        return float(info["Value"]) / float(info.get("Nominal") or 1)

    src_rub = _per_unit_rub(from_currency)
    dst_rub = _per_unit_rub(to_currency)
    result = amount * src_rub / dst_rub
    return {
        "date": (data.get("Date") or "")[:10],
        "amount": amount,
        "from": from_currency.upper(),
        "to": to_currency.upper(),
        "converted": round(result, 2),
        "rate": round(src_rub / dst_rub, 6),
    }


@mcp.tool()
def ru_work_calendar(year: int = 0, month: int = 0) -> dict[str, Any]:
    """Return the official Russian production calendar (производственный календарь РФ по ТК РФ) for ``year`` (and optionally ``month`` 1..12): non-working holidays/weekends, shortened pre-holiday days, and working-day / 40h-norm counts."""
    y = year or dt.date.today().year
    cal = _get_json(_calendar_url_template().format(year=y))
    months_in = cal.get("months") or []
    holidays_map = {str(h.get("id")): h.get("title") for h in (cal.get("holidays") or [])}
    out_months = []
    for m in months_in:
        m_num = int(m.get("month"))
        if month and m_num != month:
            continue
        raw_days = [x.strip() for x in (m.get("days") or "").split(",") if x.strip()]
        off_days = [int(d.rstrip("*+")) for d in raw_days if not d.endswith("*")]
        short_days = [int(d.rstrip("*")) for d in raw_days if d.endswith("*")]
        days_in_month = (dt.date(y + (m_num // 12), (m_num % 12) + 1, 1) - dt.timedelta(days=1)).day
        work_days = days_in_month - len(off_days)
        hours_40h = work_days * 8 - len(short_days)
        out_months.append(
            {
                "month": m_num,
                "days_in_month": days_in_month,
                "working_days": work_days,
                "days_off": off_days,
                "shortened_pre_holiday_days": short_days,
                "norm_hours_40h_week": hours_40h,
            }
        )
    return {"year": y, "holidays": holidays_map, "months": out_months}


@mcp.tool()
def ru_is_working_day(date_iso: str = "") -> dict[str, Any]:
    """Check whether a specific date (``YYYY-MM-DD``, defaults to today) is a working day, day off, or shortened pre-holiday day in Russia."""
    d = dt.date.fromisoformat(date_iso.strip()) if date_iso.strip() else dt.date.today()
    cal = ru_work_calendar(year=d.year, month=d.month)
    m = (cal.get("months") or [{}])[0]
    is_off = d.day in (m.get("days_off") or [])
    is_short = d.day in (m.get("shortened_pre_holiday_days") or [])
    return {
        "date": d.isoformat(),
        "weekday": d.strftime("%A"),
        "is_working_day": not is_off,
        "is_day_off": is_off,
        "is_shortened_day": is_short,
    }


def _iss_rows(block: dict[str, Any]) -> list[dict[str, Any]]:
    cols = block.get("columns") or []
    return [dict(zip(cols, row)) for row in (block.get("data") or [])]


@mcp.tool()
def moex_security_quote(ticker: str) -> dict[str, Any]:
    """Fetch live/last-session Moscow Exchange (MOEX) quote and metadata for a stock, bond, or index ticker (e.g. ``SBER``, ``GAZP``, ``LKOH``, ``YDEX``, ``IMOEX``, ``RGBI``)."""
    sec = urllib.parse.quote(ticker.strip().upper())
    base = _moex_url()
    info = _get_json(f"{base}/securities/{sec}.json?iss.meta=off")
    desc = {r.get("name"): r.get("value") for r in _iss_rows(info.get("description") or {})}
    boards = _iss_rows(info.get("boards") or {})
    primary = next((b for b in boards if b.get("is_primary") == 1), boards[0] if boards else {})
    engine = primary.get("engine") or "stock"
    market = primary.get("market") or "shares"
    boardid = primary.get("boardid") or "TQBR"

    mkt_url = f"{base}/engines/{engine}/markets/{market}/boards/{boardid}/securities/{sec}.json?iss.meta=off"
    mkt = _get_json(mkt_url)
    sec_row = (_iss_rows(mkt.get("securities") or {}) or [{}])[0]
    md_row = (_iss_rows(mkt.get("marketdata") or {}) or [{}])[0]
    return {
        "ticker": sec,
        "short_name": desc.get("SHORTNAME") or sec_row.get("SHORTNAME"),
        "full_name": desc.get("NAME") or sec_row.get("SECNAME"),
        "isin": desc.get("ISIN"),
        "board": boardid,
        "currency": sec_row.get("CURRENCYID") or sec_row.get("FACEUNIT"),
        "last_price": md_row.get("LAST") or md_row.get("CURRENTVALUE") or sec_row.get("PREVPRICE"),
        "open": md_row.get("OPEN"),
        "high": md_row.get("HIGH"),
        "low": md_row.get("LOW"),
        "change_pct": md_row.get("LASTTOPREVPRICE"),
        "volume_rub": md_row.get("VALTODAY"),
        "updated_time": md_row.get("SYSTIME") or md_row.get("TIME"),
    }


@mcp.tool()
def moex_search(query: str, limit: int = 10) -> dict[str, Any]:
    """Search securities on Moscow Exchange (MOEX) by company name, ticker, or ISIN."""
    q = urllib.parse.quote(query.strip())
    data = _get_json(f"{_moex_url()}/securities.json?q={q}&iss.meta=off&limit={max(1, min(limit, 30))}")
    rows = _iss_rows(data.get("securities") or {})
    return {
        "query": query,
        "securities": [
            {
                "secid": r.get("secid"),
                "shortname": r.get("shortname"),
                "name": r.get("name"),
                "isin": r.get("isin"),
                "regnumber": r.get("regnumber"),
                "type": r.get("type"),
                "group": r.get("group"),
                "primary_boardid": r.get("primary_boardid"),
                "is_traded": r.get("is_traded"),
            }
            for r in rows[:limit]
        ],
    }


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
