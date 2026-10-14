#!/usr/bin/env python3
"""Yandex Mail MCP Server — search, read, and send email via Yandex 360 / Yandex Mail (IMAP + SMTP over SSL).

Auth: create an App Password for Mail at https://id.yandex.ru/security/app-passwords (enable IMAP access in
Yandex Mail settings -> All settings -> Email clients) and set ``YANDEX_MAIL_USER`` (full email, e.g. ``user@yandex.ru``
or your Yandex 360 domain address) and ``YANDEX_MAIL_APP_PASSWORD``.

Single-file stdio MCP server, stdlib ``imaplib`` / ``smtplib`` / ``email`` only.
"""
from __future__ import annotations

import email
import email.header
import email.message
import email.utils
import imaplib
import inspect
import json
import os
import re
import smtplib
import ssl
import sys
import urllib.parse
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
    "yandex-mail",
    instructions="Yandex Mail / Yandex 360 почта: папки, поиск писем, чтение цепочек и отправка писем по IMAP/SMTP SSL с паролем приложения.",
)

ALLOWED_RU_SUFFIXES = (".yandex.ru", ".yandex.net", ".ya.ru", ".ru", ".рф", ".su")


def _imap_host() -> str:
    return os.environ.get("YANDEX_IMAP_HOST", "imap.yandex.ru").strip()


def _imap_port() -> int:
    return int(os.environ.get("YANDEX_IMAP_PORT", "993"))


def _smtp_host() -> str:
    return os.environ.get("YANDEX_SMTP_HOST", "smtp.yandex.ru").strip()


def _smtp_port() -> int:
    return int(os.environ.get("YANDEX_SMTP_PORT", "465"))


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
    if scheme and scheme not in ("https", "imaps", "smtps"):
        raise PermissionError(
            f"ru_only_ru_endpoint_without_tls: {raw!r} must use TLS under nomad.ru_only"
        )


def _creds() -> tuple[str, str]:
    user = os.environ.get("YANDEX_MAIL_USER", "").strip()
    pwd = os.environ.get("YANDEX_MAIL_APP_PASSWORD", "").strip()
    if not user or not pwd:
        raise RuntimeError(
            "YANDEX_MAIL_USER and YANDEX_MAIL_APP_PASSWORD must be set. Create an App Password at "
            "https://id.yandex.ru/security/app-passwords (scope: Mail / Почта)."
        )
    return user, pwd


def _decode_hdr(raw: str | None) -> str:
    if not raw:
        return ""
    parts = []
    for chunk, enc in email.header.decode_header(raw):
        if isinstance(chunk, bytes):
            parts.append(chunk.decode(enc or "utf-8", errors="replace"))
        else:
            parts.append(str(chunk))
    return "".join(parts).strip()


def _extract_body(msg: email.message.Message, max_chars: int = 8000) -> tuple[str, list[dict[str, Any]]]:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    attachments: list[dict[str, Any]] = []

    if msg.is_multipart():
        for part in msg.walk():
            disp = (part.get("Content-Disposition") or "").lower()
            fn = _decode_hdr(part.get_filename())
            ctype = part.get_content_type()
            if fn or "attachment" in disp:
                payload = part.get_payload(decode=True) or b""
                attachments.append({"filename": fn or "attachment", "content_type": ctype, "size": len(payload)})
                continue
            if ctype == "text/plain":
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                plain_parts.append(payload.decode(charset, errors="replace"))
            elif ctype == "text/html":
                payload = part.get_payload(decode=True) or b""
                charset = part.get_content_charset() or "utf-8"
                html_parts.append(payload.decode(charset, errors="replace"))
    else:
        payload = msg.get_payload(decode=True) or b""
        charset = msg.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
        if msg.get_content_type() == "text/html":
            html_parts.append(text)
        else:
            plain_parts.append(text)

    if plain_parts:
        body = "\n".join(plain_parts).strip()
    elif html_parts:
        raw_html = "\n".join(html_parts)
        raw_html = re.sub(r"(?is)<(script|style).*?>.*?</\1>", " ", raw_html)
        body = re.sub(r"\s+", " ", re.sub(r"(?s)<[^>]+>", " ", raw_html)).strip()
    else:
        body = ""
    return body[:max_chars], attachments


def _imap() -> imaplib.IMAP4_SSL:
    host = _imap_host()
    _assert_ru_endpoint(host)
    user, pwd = _creds()
    conn = imaplib.IMAP4_SSL(host, _imap_port(), ssl_context=ssl.create_default_context())
    conn.login(user, pwd)
    return conn


@mcp.tool()
def ymail_folders() -> dict[str, Any]:
    """List IMAP folders in the Yandex Mail account."""
    conn = _imap()
    try:
        typ, data = conn.list()
        folders = []
        for raw in data or []:
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace")
            folders.append(line)
        return {"status": typ, "folders": folders}
    finally:
        conn.logout()


@mcp.tool()
def ymail_list_messages(
    folder: str = "INBOX",
    unread_only: bool = False,
    from_filter: str = "",
    limit: int = 20,
) -> dict[str, Any]:
    """List recent messages in ``folder`` (default ``INBOX``) with UID, subject, sender, date, and flags."""
    conn = _imap()
    try:
        conn.select(folder, readonly=True)
        criteria = ["UNSEEN"] if unread_only else ["ALL"]
        if from_filter and from_filter.isascii():
            criteria.extend(["FROM", f'"{from_filter}"'])
        _, data = conn.uid("search", None, *criteria)
        uids = (data[0].split() if data and data[0] else [])[-max(1, min(limit, 50)) :]
        uids.reverse()
        messages = []
        for uid in uids:
            _, msg_data = conn.uid("fetch", uid, "(FLAGS BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE MESSAGE-ID)])")
            if not msg_data or not isinstance(msg_data[0], tuple):
                continue
            hdr = email.message_from_bytes(msg_data[0][1])
            messages.append(
                {
                    "uid": uid.decode("ascii", errors="replace"),
                    "subject": _decode_hdr(hdr.get("Subject")),
                    "from": _decode_hdr(hdr.get("From")),
                    "to": _decode_hdr(hdr.get("To")),
                    "date": hdr.get("Date"),
                    "message_id": hdr.get("Message-ID"),
                }
            )
        return {"folder": folder, "count": len(messages), "messages": messages}
    finally:
        conn.logout()


@mcp.tool()
def ymail_read_message(uid: str, folder: str = "INBOX", max_chars: int = 8000) -> dict[str, Any]:
    """Read full message headers, plain-text body, and attachment list by ``uid``."""
    conn = _imap()
    try:
        conn.select(folder, readonly=True)
        _, msg_data = conn.uid("fetch", uid.encode("ascii"), "(RFC822)")
        if not msg_data or not isinstance(msg_data[0], tuple):
            raise RuntimeError(f"Message UID {uid} not found in {folder}")
        msg = email.message_from_bytes(msg_data[0][1])
        body, attachments = _extract_body(msg, max_chars=max_chars)
        return {
            "uid": uid,
            "folder": folder,
            "subject": _decode_hdr(msg.get("Subject")),
            "from": _decode_hdr(msg.get("From")),
            "to": _decode_hdr(msg.get("To")),
            "cc": _decode_hdr(msg.get("Cc")),
            "date": msg.get("Date"),
            "message_id": msg.get("Message-ID"),
            "body": body,
            "attachments": attachments,
        }
    finally:
        conn.logout()


@mcp.tool()
def ymail_search(query: str, folder: str = "INBOX", limit: int = 20) -> dict[str, Any]:
    """Search messages in ``folder`` by substring in Subject, From, or Body (supports Russian UTF-8)."""
    conn = _imap()
    try:
        conn.select(folder, readonly=True)
        _, data = conn.uid("search", None, "ALL")
        all_uids = (data[0].split() if data and data[0] else [])[-200:]
        all_uids.reverse()
        q = query.strip().lower()
        matches = []
        for uid in all_uids:
            _, msg_data = conn.uid("fetch", uid, "(BODY.PEEK[HEADER.FIELDS (SUBJECT FROM TO DATE)])")
            if not msg_data or not isinstance(msg_data[0], tuple):
                continue
            hdr = email.message_from_bytes(msg_data[0][1])
            subj = _decode_hdr(hdr.get("Subject"))
            sender = _decode_hdr(hdr.get("From"))
            to_hdr = _decode_hdr(hdr.get("To"))
            if q in subj.lower() or q in sender.lower() or q in to_hdr.lower():
                matches.append(
                    {
                        "uid": uid.decode("ascii", errors="replace"),
                        "subject": subj,
                        "from": sender,
                        "to": to_hdr,
                        "date": hdr.get("Date"),
                    }
                )
                if len(matches) >= max(1, min(limit, 50)):
                    break
        return {"folder": folder, "query": query, "matches": matches}
    finally:
        conn.logout()


@mcp.tool()
def ymail_send(to: str, subject: str, body: str, cc: str = "", reply_to_message_id: str = "") -> dict[str, Any]:
    """Send an email via Yandex SMTP over SSL (``smtp.yandex.ru:465``). ``to`` and ``cc`` accept comma-separated addresses."""
    host = _smtp_host()
    _assert_ru_endpoint(host)
    user, pwd = _creds()
    msg = email.message.EmailMessage()
    msg["From"] = user
    msg["To"] = to
    if cc:
        msg["Cc"] = cc
    msg["Subject"] = subject
    msg["Date"] = email.utils.formatdate(localtime=True)
    msg["Message-ID"] = email.utils.make_msgid(domain=user.split("@")[-1] if "@" in user else "yandex.ru")
    if reply_to_message_id:
        msg["In-Reply-To"] = reply_to_message_id
        msg["References"] = reply_to_message_id
    msg.set_content(body)

    recipients = [addr for _, addr in email.utils.getaddresses([to, cc]) if addr]
    with smtplib.SMTP_SSL(host, _smtp_port(), context=ssl.create_default_context(), timeout=25) as smtp:
        smtp.login(user, pwd)
        smtp.send_message(msg, from_addr=user, to_addrs=recipients)
    return {"sent": True, "from": user, "to": recipients, "subject": subject, "message_id": msg["Message-ID"]}


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
