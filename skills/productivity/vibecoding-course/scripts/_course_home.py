#!/usr/bin/env python3
"""Resolve the writable course-home directory for the vibecoding-course skill.

The course CONTENT (tracks/knowledge/config) ships read-only inside the skill
(``${HERMES_SKILL_DIR}/references/content``). The student's PROGRESS
(``state.json``, ``identity.json``, ``sandbox/``) must live in a stable,
per-user, writable location that survives skill reinstalls/updates — the Nomad
home directory, never the skill dir.

This resolves ``<Nomad home>/vibecoding-course`` and prints it, so the agent /
skill can ``mkdir -p`` it and read/write progress there. It mirrors the
``skills/productivity/google-workspace/scripts/_hermes_home.py`` precedent:
prefer ``nomad_constants`` when importable, fall back to a stdlib-only
reimplementation (HERMES_HOME / NOMAD_HOME env, then ~/.nomad, then ~/.hermes)
so it also works when run as a bare subprocess outside the agent process.

Usage:
    python _course_home.py          # prints the absolute course-home path
    python _course_home.py --ensure # also creates it (and sandbox/) if missing
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

COURSE_DIR_NAME = "vibecoding-course"


def _fallback_home() -> Path:
    """Stdlib-only mirror of ``nomad_constants.get_hermes_home()``.

    Honors HERMES_HOME / NOMAD_HOME env first (either may be set), then prefers
    the Nomad layout (~/.nomad) if it already exists, else the legacy Hermes
    layout (~/.hermes), else ~/.nomad for a fresh machine.
    """
    for var in ("HERMES_HOME", "NOMAD_HOME"):
        val = os.environ.get(var, "").strip()
        if val:
            return Path(val)
    nomad = Path.home() / ".nomad"
    hermes = Path.home() / ".hermes"
    if nomad.exists():
        return nomad
    if hermes.exists():
        return hermes
    return nomad


def get_hermes_home() -> Path:
    return _fallback_home()


def get_course_home() -> Path:
    return get_hermes_home() / COURSE_DIR_NAME


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    home = get_course_home()
    if "--ensure" in argv:
        (home / "sandbox").mkdir(parents=True, exist_ok=True)
    print(str(home))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
