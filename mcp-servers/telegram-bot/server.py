#!/usr/bin/env python3
"""Telegram Bot connector — the channel both Russian competitors do not have.

WHY THIS ONE
------------
A partner who tested the two Russian agent platforms on real clients said the
same thing about each: no working Telegram integration. Not a missing nicety —
Telegram is where Russian business actually talks, so an agent that cannot
reach it is an agent people have to remember to go and visit.

It is also the cheapest credential in the whole catalog: @BotFather, one
minute, no legal entity, no app registration, no OAuth redirect.

SENDING IS ALLOW-LISTED, AND THAT IS THE POINT
----------------------------------------------
Every other connector here is read-only, because a tool installed from a
picker by someone who will not read its source must not be able to damage
anything. Telegram is different: sending IS the feature. So instead of
forbidding it, the destinations are named in advance — TELEGRAM_ALLOWED_CHATS,
empty by default. Nothing can be messaged until a human writes down where.

That converts the risk from "the model might message anyone" to "the model
might message the two chats you listed", which is a risk a person can actually
reason about before installing.

TWO LIMITS OF THE BOT API, SAID OUT LOUD
----------------------------------------
* **A bot cannot read chat history.** There is no endpoint for it. ``getUpdates``
  returns only what arrived since the last poll. Anyone who expects "summarise
  this chat from last month" is going to be disappointed, and it is cheaper to
  say so here than to have them find out mid-demo.
* **``getUpdates`` STEALS updates from a running bot.** Telegram delivers each
  update once. If the same token is being polled by a gateway or has a webhook
  set, calling it here consumes messages that process will never see. So this
  refuses when a webhook is configured, and says plainly what the risk is
  otherwise.
"""

from __future__ import annotations

import inspect
import json
import os
import sys
from typing import Any, Optional

import httpx

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


API = "https://api.telegram.org"
TOKEN_ENV = "TELEGRAM_BOT_TOKEN"
ALLOWED_ENV = "TELEGRAM_ALLOWED_CHATS"

_MAX_TEXT = 4096  # Telegram's own per-message limit

mcp = FastMCP(
    "telegram-bot",
    instructions=(
        "Send and read Telegram through a bot. Sending only works to chats "
        "listed in TELEGRAM_ALLOWED_CHATS. A bot cannot read chat history — "
        "only updates that arrived since the last poll."
    ),
)


class TgError(RuntimeError):
    """Carries a sentence for the user, not a stack trace."""


def _token() -> str:
    token = (os.environ.get(TOKEN_ENV) or "").strip()
    if not token:
        raise TgError(
            f"{TOKEN_ENV} is not set. Get one from @BotFather in Telegram: "
            "send /newbot, pick a name, and copy the token it gives you. "
            "Takes about a minute and needs no account beyond Telegram itself."
        )
    if ":" not in token:
        raise TgError(
            "That does not look like a bot token — they are of the form "
            "123456789:AA... Copy the whole line @BotFather sent."
        )
    return token


def _allowed_chats() -> list[str]:
    raw = (os.environ.get(ALLOWED_ENV) or "").strip()
    return [c.strip() for c in raw.replace(";", ",").split(",") if c.strip()]


def _call(method: str, params: Optional[dict] = None, timeout: float = 30.0) -> dict:
    try:
        resp = httpx.post(
            f"{API}/bot{_token()}/{method}", json=params or {}, timeout=timeout
        )
    except httpx.HTTPError as exc:
        raise TgError(f"Could not reach Telegram: {exc}") from exc

    try:
        body = resp.json()
    except ValueError as exc:
        raise TgError(
            f"Telegram returned a non-JSON body (HTTP {resp.status_code})."
        ) from exc

    if not body.get("ok"):
        description = body.get("description") or "no description"
        if resp.status_code == 401:
            raise TgError(
                "Telegram rejected the token (401 Unauthorized). It was revoked "
                "in @BotFather, or belongs to a bot that was deleted. Issue a "
                "new one with /token and re-run `nmd mcp install telegram-bot`."
            )
        if resp.status_code == 403:
            raise TgError(
                f"Telegram refused: {description}. Usually this means the bot "
                "was never added to that chat, or the user has not pressed "
                "Start on it — a bot cannot message someone first."
            )
        if resp.status_code == 429:
            retry = (body.get("parameters") or {}).get("retry_after")
            raise TgError(
                f"Rate limited by Telegram; retry after {retry or '?'} seconds."
            )
        raise TgError(f"Telegram refused `{method}`: {description}")
    return body.get("result") or {}


@mcp.tool()
def tg_whoami() -> str:
    """Confirm the token works and describe what this bot can and cannot do."""
    me = _call("getMe")
    allowed = _allowed_chats()
    lines = [
        f"Bot @{me.get('username')} (id {me.get('id')}, {me.get('first_name')})",
        f"  may join groups        : {'yes' if me.get('can_join_groups') else 'no'}",
        f"  reads all group messages: "
        f"{'yes' if me.get('can_read_all_group_messages') else 'no (privacy mode on)'}",
        "",
    ]
    if allowed:
        lines.append(f"  MAY SEND to {len(allowed)} chat(s): {', '.join(allowed)}")
    else:
        lines.append(
            f"  MAY SEND to nothing — {ALLOWED_ENV} is empty, so tg_send will "
            "refuse. That is the default on purpose."
        )
    return "\n".join(lines)


@mcp.tool()
def tg_send(chat: str, text: str) -> str:
    """Send a message. Only to a chat listed in TELEGRAM_ALLOWED_CHATS."""
    chat = str(chat).strip()
    if not chat:
        raise TgError("No chat given.")
    if not text.strip():
        raise TgError("Refusing to send an empty message.")

    allowed = _allowed_chats()
    if not allowed:
        raise TgError(
            f"{ALLOWED_ENV} is empty, so this connector may not message anyone.\n"
            "That is the default, deliberately: a tool installed from a picker "
            "should not be able to write to arbitrary people.\n"
            "Add the destinations you intend — chat ids or @channelnames, comma "
            f"separated — to {ALLOWED_ENV} in ~/.hermes/.env and reinstall."
        )
    if chat not in allowed:
        raise TgError(
            f"{chat} is not in {ALLOWED_ENV}. Permitted: {', '.join(allowed)}.\n"
            "Add it there deliberately if that is really where this should go."
        )

    if len(text) > _MAX_TEXT:
        raise TgError(
            f"That message is {len(text)} characters; Telegram's limit is "
            f"{_MAX_TEXT}. Split it rather than having Telegram truncate it."
        )

    result = _call("sendMessage", {"chat_id": chat, "text": text})
    return (
        f"Sent to {chat} (message id {result.get('message_id')}, "
        f"{len(text)} characters)."
    )


@mcp.tool()
def tg_chat_info(chat: str) -> str:
    """What the bot knows about one chat. Read-only."""
    info = _call("getChat", {"chat_id": str(chat).strip()})
    kind = info.get("type")
    name = info.get("title") or " ".join(
        x for x in (info.get("first_name"), info.get("last_name")) if x
    ) or info.get("username")
    lines = [
        f"{name} — {kind}",
        f"  id: {info.get('id')}",
    ]
    if info.get("username"):
        lines.append(f"  @{info['username']}")
    if info.get("description"):
        lines.append(f"  {info['description'][:200]}")
    return "\n".join(lines)


@mcp.tool()
def tg_updates(limit: int = 20) -> str:
    """Messages that arrived since the last poll. NOT chat history.

    Refuses when a webhook is configured, because reading here would fight the
    process that owns it.
    """
    limit = max(1, min(int(limit), 100))

    hook = _call("getWebhookInfo")
    if hook.get("url"):
        raise TgError(
            f"This bot has a webhook set ({hook['url'][:60]}), so Telegram "
            "delivers its updates there and getUpdates is not allowed.\n"
            "Reading here would mean tearing down someone's webhook — do that "
            "deliberately, not as a side effect of asking a question."
        )

    updates = _call("getUpdates", {"limit": limit, "timeout": 0})
    if not isinstance(updates, list) or not updates:
        return (
            "No pending updates.\n"
            "Note this is NOT chat history — the Bot API has no endpoint for "
            "that. It shows only what arrived since the last poll, and each "
            "update is delivered once."
        )

    lines = [
        f"{len(updates)} pending update(s).",
        "WARNING: reading these CONSUMES them. If a gateway or another process "
        "polls this same token, those messages are now gone from its queue.",
        "",
    ]
    for upd in updates:
        msg = upd.get("message") or upd.get("channel_post") or {}
        chat = msg.get("chat") or {}
        who = msg.get("from") or {}
        sender = who.get("username") or who.get("first_name") or "?"
        where = chat.get("title") or chat.get("username") or chat.get("id")
        body = (msg.get("text") or "").strip().replace("\n", " ")
        lines.append(f"  [{where}] {sender}: {body[:160] or '(no text)'}")
    return "\n".join(lines)


def list_tools() -> list[dict[str, Any]]:
    return mcp.list_tools()


def call_tool(name: str, arguments: dict[str, Any] | None = None) -> Any:
    return mcp.call_tool(name, arguments)


def main() -> None:
    try:
        mcp.run()
    except TgError as exc:  # pragma: no cover - startup guard
        print(f"telegram-bot: {exc}", file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
