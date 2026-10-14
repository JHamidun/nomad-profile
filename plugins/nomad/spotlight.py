"""Local MCP catalog cards (K13) and untrusted tool result spotlighting (K5 / M-081).

Provides:
1. Nine curated local/reference MCP catalog manifests missing from upstream's
   65-card SaaS catalog (``brave-search``, ``everything``, ``fetch``, ``memory``,
   ``postgres``, ``redis``, ``sequential-thinking``, ``sqlite``, ``time``), bringing
   the combined catalog to ``65 + 9 = 74`` cards.
2. Materialization of the merged ``optional-mcps`` catalog directory so one-command
   installation (e.g. ``postgres``) and tool discovery (``list_tools``) work out of
   the box via ``HERMES_OPTIONAL_MCPS``.
3. ``transform_tool_result`` hook (``on_transform_tool_result`` / ``spotlight_wrap``)
   that marks external MCP and web tool results as untrusted content.
"""

from __future__ import annotations

from collections.abc import Mapping
import os
from pathlib import Path
import shutil
import sys
from typing import Any

from . import core_adapter, untrusted

LOCAL_MCP_CARDS: tuple[str, ...] = (
    "brave-search",
    "everything",
    "fetch",
    "memory",
    "postgres",
    "redis",
    "sequential-thinking",
    "sqlite",
    "time",
)

LOCAL_MCP_MANIFESTS: dict[str, str] = {
    "brave-search": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: brave-search
description: Web, news, image, video, and local-business search via the Brave Search API (free tier available).
source: https://github.com/brave/brave-search-mcp-server

transport:
  type: stdio
  command: npx
  args:
    - "-y"
    - "@brave/brave-search-mcp-server"
  env:
    BRAVE_API_KEY: "${BRAVE_API_KEY}"

auth:
  type: api_key
  env:
    - name: BRAVE_API_KEY
      prompt: "Brave Search API key (free tier: https://brave.com/search/api/)"
      required: true
      secret: true

post_install: |
  When to enable: you want the agent to search the live web — research,
  current events, "find me X" — through a privacy-focused API instead of
  scraping. Get a key at https://brave.com/search/api/ (the free plan is
  enough for personal use; local-business search needs a paid plan).

  Requires Node.js (npx). Start a new session to load the search tools.
""",
    "everything": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: everything
description: MCP protocol test server — exercises tools, prompts, resources, sampling, and progress. For debugging MCP wiring, not for real work.
source: https://github.com/modelcontextprotocol/servers/tree/main/src/everything

transport:
  type: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-everything"

auth:
  type: none

post_install: |
  When to enable: you are developing or debugging MCP integrations and want
  a reference server that exercises every protocol feature — echo/add tools,
  long-running progress, sampling requests, test resources and prompts.
  Not useful for everyday agent work; uninstall when you are done testing.

  Requires Node.js (npx). Start a new session to load the test tools.
""",
    "fetch": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: fetch
description: Fetch a URL and convert the page to clean markdown the model can read. The building block for "read this link".
source: https://github.com/modelcontextprotocol/servers/tree/main/src/fetch

transport:
  type: stdio
  command: uvx
  args:
    - mcp-server-fetch

auth:
  type: none

post_install: |
  When to enable: you paste links into chats and want the agent to actually
  read them — articles, docs, changelogs — without a full browser stack.
  Fetches happen from THIS machine (your IP), honor robots.txt by default,
  and support chunked reading of long pages.

  Requires `uv` on PATH. Start a new session to load the fetch tool.
""",
    "memory": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: memory
description: Persistent knowledge-graph memory — the agent stores entities, relations, and observations in a local JSON file and recalls them across sessions.
source: https://github.com/modelcontextprotocol/servers/tree/main/src/memory

transport:
  type: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-memory"
  env:
    MEMORY_FILE_PATH: "${MEMORY_FILE_PATH}"

auth:
  type: api_key
  env:
    - name: MEMORY_FILE_PATH
      prompt: "Absolute path for the knowledge-graph JSON file (created if missing), e.g. /home/you/.hermes/memory.json"
      required: true
      secret: false

post_install: |
  When to enable: you want the agent to remember facts between sessions —
  people, projects, preferences, decisions — as a searchable local knowledge
  graph. Everything is stored in the single JSON file you chose; delete the
  file to wipe the memory.

  Requires Node.js (npx). Start a new session to load the memory tools.
""",
    "postgres": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: postgres
description: Inspect schemas, run read-only SQL, explain query plans, and check database health on PostgreSQL.
source: https://github.com/crystaldba/postgres-mcp

transport:
  type: stdio
  command: uvx
  args:
    - postgres-mcp
    - "--access-mode=restricted"
  env:
    DATABASE_URI: "${DATABASE_URI}"

auth:
  type: api_key
  env:
    - name: DATABASE_URI
      prompt: "Postgres connection URI (postgresql://user:password@host:5432/dbname)"
      required: true
      secret: true

post_install: |
  When to enable: you want the agent to answer questions from a real Postgres
  database — run SELECTs, explore schemas, EXPLAIN slow queries, get index
  recommendations and health checks.

  Installed in RESTRICTED (read-only) mode. To allow writes, edit
  mcp_servers.postgres.args in ~/.hermes/config.yaml and change
  --access-mode=restricted to --access-mode=unrestricted.

  Requires `uv` on PATH (uvx downloads and runs the server on first launch).
  Start a new session to load the Postgres tools.
""",
    "redis": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: redis
description: Talk to a Redis instance — keys, hashes, lists, sets, streams, pub/sub, and server info.
source: https://github.com/redis/mcp-redis

transport:
  type: stdio
  command: uvx
  args:
    - "--from"
    - "redis-mcp-server"
    - "redis-mcp-server"
    - "--url"
    - "${REDIS_URL}"

auth:
  type: api_key
  env:
    - name: REDIS_URL
      prompt: "Redis connection URL (redis://[user:password@]host:6379/0)"
      default: "redis://127.0.0.1:6379/0"
      required: true
      secret: true

post_install: |
  When to enable: your project uses Redis (cache, queues, pub/sub) and you
  want the agent to inspect keys, debug cache contents, read streams, or
  publish messages.

  Note: the tool surface includes write operations (set/delete/publish)
  against your live Redis. Use the install-time tool checklist to prune
  mutating tools if you only want read access.

  Requires `uv` on PATH. Start a new session to load the Redis tools.
""",
    "sequential-thinking": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: sequential-thinking
description: Structured step-by-step reasoning scratchpad — the model breaks hard problems into numbered, revisable thought chains.
source: https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking

transport:
  type: stdio
  command: npx
  args:
    - "-y"
    - "@modelcontextprotocol/server-sequential-thinking"

auth:
  type: none

post_install: |
  When to enable: you regularly give the agent multi-step analysis or
  planning problems and want it to think in explicit, revisable steps
  (with branching and backtracking) instead of one long answer. Purely
  local; stores nothing and calls no external service.

  Requires Node.js (npx). Start a new session to load the tool.
""",
    "sqlite": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: sqlite
description: Local SQLite database — run SQL, create tables, inspect schemas. Zero-setup storage in a single local file.
source: https://github.com/modelcontextprotocol/servers-archived/tree/main/src/sqlite

transport:
  type: stdio
  command: uvx
  args:
    - mcp-server-sqlite
    - "--db-path"
    - "${SQLITE_DB_PATH}"

auth:
  type: api_key
  env:
    - name: SQLITE_DB_PATH
      prompt: "Absolute path to the SQLite database file (created if missing), e.g. /home/you/.hermes/data.sqlite"
      required: true
      secret: false

post_install: |
  When to enable: you want a lightweight local database the agent can read
  and write — notes, scraped data, small app prototypes — without running a
  database server. The file is created on first use if it does not exist.

  Note: this server can execute write queries (CREATE/INSERT/UPDATE) against
  the file you pointed it at. Point it at a dedicated file, not at another
  application's production database.

  Requires `uv` on PATH. Start a new session to load the SQLite tools.
""",
    "time": """\
# Curated Nomad MCP catalog entry (K13).
manifest_version: 1

name: time
description: Current time and timezone conversion — IANA timezones, DST-aware. Useful for scheduling across timezones.
source: https://github.com/modelcontextprotocol/servers/tree/main/src/time

transport:
  type: stdio
  command: uvx
  args:
    - mcp-server-time

auth:
  type: none

post_install: |
  When to enable: the agent needs reliable "what time is it in <timezone>"
  answers or timezone conversions — meeting planning, cron reasoning,
  cross-timezone scheduling. The model's own clock knowledge is unreliable;
  this makes it exact.

  Requires `uv` on PATH. Start a new session to load the time tools.
""",
}

_CARD_PREFIXES: tuple[str, ...] = tuple(
    prefix
    for card in LOCAL_MCP_CARDS
    for variant in {card, card.replace("-", "_")}
    for prefix in (f"{variant}:", f"{variant}_", f"{variant}-")
)


def find_upstream_optional_mcps_dir() -> Path | None:
    """Locate the upstream ``optional-mcps/`` directory without importing Hermes core."""
    candidates: list[Path] = []
    for env_key in ("HERMES_UPSTREAM", "NOMAD_UPSTREAM"):
        val = os.environ.get(env_key, "").strip()
        if val:
            candidates.append(Path(val) / "optional-mcps")

    exe = Path(sys.executable).resolve()
    for parent in exe.parents:
        candidates.append(parent / "optional-mcps")

    for entry in sys.path:
        if entry:
            candidates.append(Path(entry) / "optional-mcps")

    for candidate in candidates:
        try:
            if candidate.is_dir() and any(
                (child / "manifest.yaml").is_file()
                for child in candidate.iterdir()
                if child.is_dir()
            ):
                return candidate.resolve()
        except OSError:
            continue
    return None


def materialize_local_mcp_cards(dest_dir: Path) -> dict[str, Path]:
    """Write the 9 local K13 MCP card ``manifest.yaml`` files under *dest_dir*."""
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    written: dict[str, Path] = {}
    for name, content in LOCAL_MCP_MANIFESTS.items():
        card_dir = dest_dir / name
        card_dir.mkdir(parents=True, exist_ok=True)
        manifest_path = card_dir / "manifest.yaml"
        manifest_path.write_text(content, encoding="utf-8", newline="\n")
        written[name] = manifest_path
    return written


def ensure_merged_catalog_dir(
    target_dir: Path | None = None,
    *,
    upstream_mcps_dir: Path | None = None,
    set_env: bool = True,
) -> Path:
    """Materialize a merged MCP catalog (65 upstream + 9 local K13 = 74 cards).

    When *set_env* is True, sets ``HERMES_OPTIONAL_MCPS`` to *target_dir* so
    ``hermes_cli.mcp_catalog.list_catalog()`` and ``get_entry()`` see all 74 cards.
    """
    if target_dir is None:
        try:
            base = core_adapter.plugin_data_dir("nomad")
        except Exception:
            base = core_adapter.get_hermes_home() / "plugin-data" / "nomad"
        target_dir = base / "optional-mcps"
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    src_dir = upstream_mcps_dir or find_upstream_optional_mcps_dir()
    if src_dir is not None and src_dir.is_dir() and src_dir.resolve() != target_dir.resolve():
        for child in sorted(src_dir.iterdir()):
            manifest = child / "manifest.yaml"
            if child.is_dir() and manifest.is_file():
                dst_card_dir = target_dir / child.name
                dst_card_dir.mkdir(parents=True, exist_ok=True)
                shutil.copy2(manifest, dst_card_dir / "manifest.yaml")

    materialize_local_mcp_cards(target_dir)

    if set_env:
        os.environ["HERMES_OPTIONAL_MCPS"] = str(target_dir)
    return target_dir


def is_untrusted_tool(tool_name: str) -> bool:
    """Return True when *tool_name* is an external/MCP tool whose output is untrusted."""
    name = (tool_name or "").strip().lower()
    if not name:
        return False
    if untrusted.is_untrusted_tool(name):
        return True
    if name.startswith(_CARD_PREFIXES):
        return True
    return False


_is_untrusted = is_untrusted_tool


def spotlight_wrap(
    tool_name: str,
    content: str,
    *,
    session_id: str | None = None,
) -> str:
    """Wrap *content* in ``<untrusted-content>`` delimiters if *tool_name* is untrusted."""
    if not is_untrusted_tool(tool_name):
        return content
    wrapped = untrusted.on_transform_tool_result(
        tool_name=tool_name,
        args=None,
        result=content,
        session_id=session_id,
    )
    return wrapped if wrapped is not None else content


def on_transform_tool_result(
    tool_name: str = "",
    args: Mapping[str, Any] | None = None,
    result: Any = None,
    session_id: str | None = None,
    **kwargs: Any,
) -> str | None:
    """Runtime ``transform_tool_result`` hook for untrusted web and MCP tool results."""
    if not tool_name or result is None or not is_untrusted_tool(tool_name):
        return None
    # Normalize card-prefixed tool names (e.g. "postgres_query" -> recognized by untrusted)
    effective_extra = (tool_name,) if not untrusted.is_untrusted_tool(tool_name) else None
    if effective_extra is not None:
        raw_text = untrusted._stringify_result(result)
        if not raw_text:
            return None
        record = untrusted.mark_tainted(
            tool_name,
            raw_text,
            args=args,
            session_id=session_id,
            task_id=kwargs.get("task_id"),
        )
        return untrusted.wrap_untrusted_content(
            raw_text,
            source=tool_name,
            injection_detected=record.injection_detected,
        )
    return untrusted.on_transform_tool_result(
        tool_name=tool_name,
        args=args,
        result=result,
        session_id=session_id,
        **kwargs,
    )


_transform_tool_result = on_transform_tool_result


def register(ctx: Any) -> None:
    """Activate the 74-card MCP catalog overlay and register the spotlight hook."""
    if not os.environ.get("HERMES_OPTIONAL_MCPS"):
        try:
            ensure_merged_catalog_dir(set_env=True)
        except Exception:
            pass
    ctx.register_hook("transform_tool_result", on_transform_tool_result)
