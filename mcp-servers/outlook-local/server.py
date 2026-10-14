"""Local Microsoft Outlook — the mailbox that already sits on this desktop.

WHY THIS ENTRY IS THE INTERESTING ONE
-------------------------------------
Every rival agent platform on the Russian market speaks MCP over HTTP only —
Yandex's hub (Streamable HTTP + SSE), Just AI's, Bitrix24's. None of them can
reach a desktop application, because none of them execute on the desktop.

A corporate Exchange mailbox is exactly that: it is already authenticated,
already synced, already inside the company perimeter, and it is reachable
through COM by a process running as the user. No OAuth app to register, no
admin to petition, no token to expire — the credential is the Windows session.
An agent that runs locally can do this and a cloud agent cannot, which makes it
worth more than another wrapper around a public API.

READ-ONLY, DELIBERATELY
-----------------------
There is no send tool here, and its absence is a decision rather than an
omission. Sending mail is an outward, irreversible act performed under the
owner's own corporate identity; a connector that can do it silently is a
connector nobody should install on a work machine. Reading is where the value
is, and read-only means installing this can lose nothing.

WINDOWS ONLY. COM is a Windows facility; the server says so plainly rather than
failing with an import error.
"""

from __future__ import annotations

import inspect
import json
import os
import sys
from datetime import datetime, timedelta
from typing import Any, Optional

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


mcp = FastMCP("outlook-local")

# MAPI default folder ids (olDefaultFolders).
FOLDERS = {
    "inbox": 6,
    "sent": 5,
    "drafts": 16,
    "outbox": 4,
    "deleted": 3,
    "junk": 23,
    "calendar": 9,
    "contacts": 10,
    "tasks": 13,
}


class OutlookError(RuntimeError):
    """A failure worth showing the user verbatim."""


def _require_windows() -> None:
    if sys.platform != "win32":
        raise OutlookError(
            "This connector talks to the Outlook desktop application through "
            f"COM, which exists only on Windows (running on {sys.platform}). "
            "For a mailbox reachable over the network, use the yandex-mail "
            "entry or a generic IMAP one instead."
        )


def _outlook():
    """Return a MAPI namespace, or raise something a human can act on."""
    _require_windows()
    try:
        import pythoncom  # noqa: F401
        import win32com.client
    except ImportError as exc:
        raise OutlookError(
            "pywin32 is not installed in this Python, so COM is unavailable. "
            "Install it into the interpreter Nomad runs on: "
            "`uv pip install pywin32` (or `python -m pip install pywin32`)."
        ) from exc

    import pythoncom
    import win32com.client

    # Every call runs on whatever thread the MCP server hands us; COM has to be
    # initialised on that thread or Dispatch raises CoInitialize-not-called.
    try:
        pythoncom.CoInitialize()
    except Exception:
        pass

    try:
        app = win32com.client.Dispatch("Outlook.Application")
        return app.GetNamespace("MAPI")
    except Exception as exc:
        raise OutlookError(
            f"Could not attach to Outlook ({type(exc).__name__}: {exc}). "
            "Outlook must be installed and the profile configured; starting "
            "Outlook once by hand usually settles it."
        ) from exc


def _folder(namespace, name: str):
    key = (name or "inbox").strip().lower()
    if key in FOLDERS:
        try:
            return namespace.GetDefaultFolder(FOLDERS[key])
        except Exception as exc:
            raise OutlookError(f"Folder '{key}' is not available: {exc}") from exc
    # Named folder: search one level under each store's root.
    try:
        for store_index in range(1, namespace.Folders.Count + 1):
            root = namespace.Folders.Item(store_index)
            for child_index in range(1, root.Folders.Count + 1):
                child = root.Folders.Item(child_index)
                if str(child.Name).strip().lower() == key:
                    return child
    except Exception:
        pass
    raise OutlookError(
        f"No folder named '{name}'. Known shortcuts: {', '.join(sorted(FOLDERS))}. "
        "`outlook_folders` lists what this profile actually has."
    )


def _text(value: Any, limit: int = 0) -> str:
    try:
        out = "" if value is None else str(value).strip()
    except Exception:
        return ""
    out = " ".join(out.split())
    return out[:limit] if limit and len(out) > limit else out


def _when(item) -> str:
    for attr in ("ReceivedTime", "SentOn", "Start", "CreationTime"):
        try:
            value = getattr(item, attr, None)
            if value:
                return str(value)[:16]
        except Exception:
            continue
    return "—"


def _sorted_items(folder, newest_first: bool = True):
    """Items sorted by time. Sorting in Outlook is cheap; filtering is not."""
    items = folder.Items
    for field in ("[ReceivedTime]", "[Start]", "[CreationTime]"):
        try:
            items.Sort(field, newest_first)
            return items
        except Exception:
            continue
    return items


# ---------------------------------------------------------------------------
# tools
# ---------------------------------------------------------------------------


@mcp.tool()
def outlook_accounts() -> str:
    """Which mailboxes this Outlook profile has, and how full the inbox is."""
    ns = _outlook()
    lines = []
    try:
        accounts = ns.Accounts
        lines.append(f"Учётных записей: {accounts.Count}")
        for i in range(1, accounts.Count + 1):
            account = accounts.Item(i)
            lines.append(f"  {_text(account.DisplayName)}  <{_text(account.SmtpAddress)}>")
    except Exception as exc:
        lines.append(f"  (список учёток не прочитался: {type(exc).__name__})")
    try:
        inbox = ns.GetDefaultFolder(FOLDERS["inbox"])
        lines.append(
            f"\nВходящие: {inbox.Items.Count} писем, непрочитанных {inbox.UnReadItemCount}"
        )
    except Exception:
        pass
    return "\n".join(lines)


@mcp.tool()
def outlook_folders() -> str:
    """The folder tree with message counts — what exists and where the mail is."""
    ns = _outlook()
    lines = []
    try:
        for store_index in range(1, ns.Folders.Count + 1):
            root = ns.Folders.Item(store_index)
            lines.append(f"{_text(root.Name)}")
            try:
                for child_index in range(1, root.Folders.Count + 1):
                    child = root.Folders.Item(child_index)
                    try:
                        total = child.Items.Count
                        unread = child.UnReadItemCount
                    except Exception:
                        total, unread = "?", "?"
                    mark = f"  ({unread} непроч.)" if unread not in ("?", 0) else ""
                    lines.append(f"   {_text(child.Name):<34} {total} писем{mark}")
            except Exception as exc:
                lines.append(f"   (подпапки не прочитались: {type(exc).__name__})")
    except Exception as exc:
        raise OutlookError(f"Could not walk the folder tree: {exc}") from exc
    return "\n".join(lines) if lines else "Папок не найдено."


@mcp.tool()
def outlook_recent(folder: str = "inbox", limit: int = 15) -> str:
    """The newest messages in a folder: time, sender, subject, read state."""
    ns = _outlook()
    target = _folder(ns, folder)
    count = max(1, min(int(limit), 100))
    items = _sorted_items(target)
    lines = [f"{_text(target.Name)} — последние {count}:"]
    shown = 0
    total = 0
    try:
        total = items.Count
    except Exception:
        pass
    for index in range(1, min(count, total) + 1):
        try:
            item = items.Item(index)
            unread = ""
            try:
                unread = "•" if getattr(item, "UnRead", False) else " "
            except Exception:
                unread = " "
            lines.append(
                f" {unread} {_when(item)}  {_text(getattr(item, 'SenderName', ''), 24):<24} "
                f"{_text(getattr(item, 'Subject', ''), 52)}"
            )
            shown += 1
        except Exception:
            continue
    if not shown:
        return f"{_text(target.Name)}: писем нет."
    lines.append("\n• — непрочитанное. Полный текст — outlook_read с темой или отправителем.")
    return "\n".join(lines)


@mcp.tool()
def outlook_unread(limit: int = 25) -> str:
    """Everything unread across the inbox — what is actually waiting."""
    ns = _outlook()
    inbox = ns.GetDefaultFolder(FOLDERS["inbox"])
    count = max(1, min(int(limit), 100))
    try:
        # Restrict on UnRead is a supported Jet clause and is locale-independent,
        # unlike date filters, which is why dates are filtered in Python below.
        unread = inbox.Items.Restrict("[UnRead] = True")
        unread.Sort("[ReceivedTime]", True)
    except Exception as exc:
        raise OutlookError(f"Could not filter unread mail: {exc}") from exc
    total = 0
    try:
        total = unread.Count
    except Exception:
        pass
    if not total:
        return "Непрочитанных писем нет."
    lines = [f"Непрочитанных: {total}"]
    for index in range(1, min(count, total) + 1):
        try:
            item = unread.Item(index)
            lines.append(
                f"  {_when(item)}  {_text(getattr(item, 'SenderName', ''), 24):<24} "
                f"{_text(getattr(item, 'Subject', ''), 52)}"
            )
        except Exception:
            continue
    if total > count:
        lines.append(f"  … и ещё {total - count}")
    return "\n".join(lines)


@mcp.tool()
def outlook_search(query: str, folder: str = "inbox", days: int = 90, limit: int = 20) -> str:
    """Find mail by words in the subject, sender or body.

    Dates are filtered in Python rather than through Outlook's Restrict: its
    date syntax is locale-dependent and silently matches nothing on a machine
    whose short-date format differs from the one the filter string was written
    for. A wrong-but-quiet empty result is the worst outcome for a search tool.
    """
    text = _text(query)
    if not text:
        raise OutlookError("Give me something to search for.")
    ns = _outlook()
    target = _folder(ns, folder)
    count = max(1, min(int(limit), 100))
    cutoff = datetime.now() - timedelta(days=max(1, min(int(days), 3650)))

    items = _sorted_items(target)
    needle = text.casefold()
    lines = []
    scanned = 0
    total = 0
    try:
        total = items.Count
    except Exception:
        pass

    for index in range(1, total + 1):
        if len(lines) >= count:
            break
        try:
            item = items.Item(index)
        except Exception:
            continue
        scanned += 1
        # Sorted newest-first, so the first message older than the cutoff ends
        # the scan — no point walking 5 000 items to the bottom.
        try:
            received = getattr(item, "ReceivedTime", None) or getattr(item, "SentOn", None)
            if received is not None:
                stamp = datetime(received.year, received.month, received.day)
                if stamp < cutoff:
                    break
        except Exception:
            pass
        haystack = " ".join(
            _text(getattr(item, attr, "")) for attr in ("Subject", "SenderName", "SenderEmailAddress")
        )
        body = ""
        if needle not in haystack.casefold():
            try:
                body = _text(getattr(item, "Body", ""), 4000)
            except Exception:
                body = ""
        if needle in haystack.casefold() or needle in body.casefold():
            lines.append(
                f"  {_when(item)}  {_text(getattr(item, 'SenderName', ''), 22):<22} "
                f"{_text(getattr(item, 'Subject', ''), 54)}"
            )

    if not lines:
        return (
            f'По «{text}» в папке {_text(target.Name)} за {days} дн. ничего не нашлось '
            f"(просмотрено писем: {scanned})."
        )
    head = f'Найдено по «{text}» в {_text(target.Name)} за {days} дн. — {len(lines)}:'
    return "\n".join([head] + lines)


@mcp.tool()
def outlook_read(subject_contains: str = "", sender_contains: str = "", folder: str = "inbox") -> str:
    """Full text of the newest message matching a subject and/or sender."""
    subject = _text(subject_contains).casefold()
    sender = _text(sender_contains).casefold()
    if not subject and not sender:
        raise OutlookError("Give me part of a subject or a sender name.")
    ns = _outlook()
    target = _folder(ns, folder)
    items = _sorted_items(target)
    total = 0
    try:
        total = items.Count
    except Exception:
        pass
    for index in range(1, min(total, 500) + 1):
        try:
            item = items.Item(index)
            subject_value = _text(getattr(item, "Subject", "")).casefold()
            sender_value = (
                _text(getattr(item, "SenderName", "")) + " " +
                _text(getattr(item, "SenderEmailAddress", ""))
            ).casefold()
        except Exception:
            continue
        if subject and subject not in subject_value:
            continue
        if sender and sender not in sender_value:
            continue
        body = _text(getattr(item, "Body", ""), 6000)
        attachments = []
        try:
            for a_index in range(1, item.Attachments.Count + 1):
                attachments.append(_text(item.Attachments.Item(a_index).FileName, 60))
        except Exception:
            pass
        out = [
            f"Тема:      {_text(getattr(item, 'Subject', ''))}",
            f"От:        {_text(getattr(item, 'SenderName', ''))} <{_text(getattr(item, 'SenderEmailAddress', ''))}>",
            f"Кому:      {_text(getattr(item, 'To', ''), 200)}",
            f"Получено:  {_when(item)}",
        ]
        if attachments:
            out.append(f"Вложения:  {', '.join(attachments)}")
        out.append("")
        out.append(body or "(пустое тело)")
        return "\n".join(out)
    return "Подходящего письма не нашлось среди последних 500."


@mcp.tool()
def outlook_calendar(days: int = 7) -> str:
    """Meetings in the next N days: when, how long, subject, organiser."""
    ns = _outlook()
    calendar = ns.GetDefaultFolder(FOLDERS["calendar"])
    horizon = max(1, min(int(days), 365))
    now = datetime.now()
    until = now + timedelta(days=horizon)

    items = calendar.Items
    try:
        # Recurring meetings only expand into individual occurrences when both
        # of these are set; without them a weekly standup shows up once, on the
        # day it was created, and every later occurrence is invisible.
        items.IncludeRecurrences = True
        items.Sort("[Start]", False)
    except Exception:
        pass

    lines = []
    try:
        total = items.Count
    except Exception:
        total = 0
    for index in range(1, min(total, 800) + 1):
        try:
            item = items.Item(index)
            start = getattr(item, "Start", None)
            if start is None:
                continue
            when = datetime(start.year, start.month, start.day, start.hour, start.minute)
            if when < now - timedelta(hours=12):
                continue
            if when > until:
                break
            duration = ""
            try:
                duration = f"{int(getattr(item, 'Duration', 0))} мин"
            except Exception:
                pass
            lines.append(
                f"  {when.strftime('%d.%m %H:%M')}  {duration:<8} "
                f"{_text(getattr(item, 'Subject', ''), 46):<46} "
                f"{_text(getattr(item, 'Organizer', ''), 24)}"
            )
        except Exception:
            continue
        if len(lines) >= 60:
            break
    if not lines:
        return f"В ближайшие {horizon} дн. встреч не запланировано."
    return "\n".join([f"Встречи на {horizon} дн.:"] + lines)


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
