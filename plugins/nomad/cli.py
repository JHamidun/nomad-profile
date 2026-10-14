"""``hermes nomad …`` — the plugin's CLI tree (registered via ``ctx.register_cli_command``).

Каноническая форма из спецификации — ``hermes nomad swarm …``. Отдельный бинарник ``nmd`` плагин
зарегистрировать не может: ядро даёт плагину только подкоманду верхнего уровня.

Подкоманды ``swarm``:

* ``show <id> [--json]`` — один рой с журналом событий;
* ``lanes [--json]`` — каталог возможностей (M-160): каждая дорожка с живостью, способом оплаты,
  остатком окна (число или ``unknown``) и разрешением белого списка. Пробы бесплатные, см.
  ``capabilities.py``.

Коды выхода (ядро превращает int, возвращённый обработчиком, в код выхода процесса):
0 — найдено и напечатано, 1 — роя с таким id нет, 2 — неполная команда.
"""

from __future__ import annotations

import json
import sys

from . import account, capabilities, router, ru_only, slots, tools

EXIT_OK, EXIT_NOT_FOUND, EXIT_USAGE = 0, 1, 2

_ORIG_BUILD_CATALOG = capabilities.build_catalog


def setup(parser) -> None:
    subs = parser.add_subparsers(dest="nomad_command")
    swarm = subs.add_parser("swarm", help="Inspect swarms of the Nomad orchestrator")
    swarm_subs = swarm.add_subparsers(dest="nomad_swarm_command")
    show = swarm_subs.add_parser("show", help="Show one swarm by id")
    show.add_argument("swarm_id", help="Swarm id as returned by swarm_start (sw-…)")
    # dest со своим префиксом: общее имя вроде "json" может совпасть с опцией ядра и тихо её затереть.
    show.add_argument("--json", action="store_true", dest="nomad_json",
                      help="Print the record as JSON")
    lanes = swarm_subs.add_parser(
        "lanes", help="List executor lanes: alive, billing, window left, paid whitelist")
    lanes.add_argument("--json", action="store_true", dest="nomad_json",
                       help="Print the catalog as a JSON array")

    pin = swarm_subs.add_parser(
        "pin", help="Manually pin a kanban card to a lane/slot (M-164)")
    pin.add_argument("task_id", help="Task id on the kanban board (e.g. T-03)")
    pin.add_argument("lane", help="Target lane or slot (e.g. codex, claude-code, cc-1, deepseek, tool)")
    pin.add_argument("--board", default="default", dest="nomad_board",
                     help="Kanban board slug (default: default)")
    pin.add_argument("--role", default=None, dest="nomad_role",
                     help="Card role (executor or judge/verifier)")
    pin.add_argument("--judge-of", default=None, dest="nomad_judge_of",
                     help="Reviewed task id when pinning a judge card")
    pin.add_argument("--executor-lane", default=None, dest="nomad_executor_lane",
                     help="Executor lane of the reviewed card (for cross-family check)")
    pin.add_argument("--executor-vendor", default=None, dest="nomad_executor_vendor",
                     help="Executor vendor family of the reviewed card (for cross-family check)")
    pin.add_argument("--dead", action="store_true", dest="nomad_dead",
                     help="Mark target lane as alive=false")
    pin.add_argument("--json", action="store_true", dest="nomad_json",
                     help="Print the pin result as JSON")

    ru = subs.add_parser("ru", help="Inspect and enforce the RU-only contour")
    ru_subs = ru.add_subparsers(dest="nomad_ru_command")
    audit = ru_subs.add_parser("audit", help="Audit the active profile for RU-only contour compliance")
    audit.add_argument("--json", action="store_true", dest="nomad_json",
                       help="Print the audit report as JSON")
    apply_cmd = ru_subs.add_parser("apply", help="Enforce RU-only contour settings on the active profile")
    apply_cmd.add_argument("--json", action="store_true", dest="nomad_json",
                           help="Print the enforcement report as JSON")

    balance = subs.add_parser("balance", help="Show NomadNet Control Plane balance")
    balance.add_argument("--json", action="store_true", dest="nomad_json",
                         help="Print the account balance state as JSON")

    parser.set_defaults(nomad_parser=parser, nomad_swarm_parser=swarm, nomad_ru_parser=ru)


def _print_human(swarm: dict) -> None:
    print(f"swarm      {swarm['id']}")
    print(f"goal       {swarm['goal']}")
    print(f"status     {swarm['status']}")
    print(f"created    {swarm['created_at']}")
    print(f"pool_mode  {swarm['pool_mode_at_creation']}")
    events = swarm.get("events") or []
    print(f"events     {len(events)}")
    for event in events:
        detail = event.get("detail")
        detail_text = "" if detail is None else " " + json.dumps(detail, ensure_ascii=False)
        print(f"  #{event['id']} {event['ts']} {event['kind']}{detail_text}")


def _handle_show(args) -> int:
    swarm = tools.load_swarm(args.swarm_id)
    if swarm is None:
        message = {"error": "swarm not found", "swarm_id": args.swarm_id}
        if getattr(args, "nomad_json", False):
            print(json.dumps(message, ensure_ascii=False))
        else:
            print(f"nomad: swarm {args.swarm_id} not found", file=sys.stderr)
        return EXIT_NOT_FOUND
    if getattr(args, "nomad_json", False):
        print(json.dumps(swarm, ensure_ascii=False, indent=2))
    else:
        _print_human(swarm)
    return EXIT_OK


def _lane_who(row: dict) -> str:
    if not row["alive"]:
        return row.get("reason") or "-"
    identity = row.get("identity") or {}
    return str(identity.get("email") or identity.get("auth_method") or "-")


def _print_lanes(rows: list[dict]) -> None:
    table = [("LANE", "VENDOR", "BILLING", "ALIVE", "WINDOW", "ALLOWED", "WHO / WHY")]
    for row in rows:
        left = row["window_left"]
        window = left if left == capabilities.UNKNOWN else f"{left:g}%"
        table.append((row["lane"], row["vendor"], row["billing"], "yes" if row["alive"] else "no",
                      window, "yes" if row["allowed_by_whitelist"] else "no", _lane_who(row)))
    widths = [max(len(str(line[i])) for line in table) for i in range(len(table[0]) - 1)]
    for line in table:
        cells = [str(cell).ljust(width) for cell, width in zip(line, widths)]
        print("  ".join([*cells, str(line[-1])]))


def _handle_lanes(args) -> int:
    rows = capabilities.build_catalog()
    if getattr(args, "nomad_json", False):
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        _print_lanes(rows)
    return EXIT_OK


def _handle_pin(args) -> int:
    catalog = None
    if capabilities.build_catalog is not _ORIG_BUILD_CATALOG:
        catalog = capabilities.build_catalog()
    alive_override = False if getattr(args, "nomad_dead", False) else None
    try:
        result = router.pin_task(
            args.task_id,
            args.lane,
            board=getattr(args, "nomad_board", "default") or "default",
            catalog=catalog,
            alive=alive_override,
            role=getattr(args, "nomad_role", None),
            judge_of=getattr(args, "nomad_judge_of", None),
            executor_lane=getattr(args, "nomad_executor_lane", None),
            executor_vendor=getattr(args, "nomad_executor_vendor", None),
        )
    except (router.PinRefusedError, ru_only.RuOnlyViolation, ValueError) as exc:
        reason = getattr(exc, "reason", "pin_refused")
        payload = {
            "ok": False,
            "task_id": args.task_id,
            "lane": args.lane,
            "reason": reason,
            "error": str(exc),
            "detail": getattr(exc, "detail", {}),
        }
        if getattr(args, "nomad_json", False):
            print(json.dumps(payload, ensure_ascii=False))
        else:
            print(f"nomad: pin refused ({reason}): {exc}", file=sys.stderr)
        return EXIT_NOT_FOUND

    if getattr(args, "nomad_json", False):
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(
            f"pinned {result['task_id']} -> {result['lane']} "
            f"(provider={result['provider_override']}, model={result['model_override']}, "
            f"billing={result['billing']})"
        )
    return EXIT_OK


def _handle_ru_audit(args) -> int:
    report = ru_only.audit_ru_config()
    if getattr(args, "nomad_json", False):
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        violations = report.get("violations") or []
        if not violations:
            print("[]")
        else:
            for item in violations:
                print(item)
    return EXIT_OK if report.get("ok") else EXIT_NOT_FOUND


def _handle_ru_apply(args) -> int:
    report = ru_only.apply_ru_config()
    if getattr(args, "nomad_json", False):
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"ru_only applied: {report.get('config_path')} (violations={len(report.get('violations') or [])})")
    return EXIT_OK if report.get("ok") else EXIT_NOT_FOUND


def _handle_balance(args) -> int:
    state = account.get_account_state()
    if getattr(args, "nomad_json", False):
        print(json.dumps(state, ensure_ascii=False, indent=2))
        return EXIT_OK if state.get("ok") else EXIT_NOT_FOUND
    if not state.get("ok"):
        code = state.get("code") or "error"
        msg = state.get("message") or "unable to read balance"
        print(f"nomad: {code}: {msg}", file=sys.stderr)
        return EXIT_NOT_FOUND
    formatted = state.get("formatted_balance")
    if formatted is None:
        formatted = account.format_balance(state.get("balance")) or str(state.get("balance"))
    print(formatted)
    return EXIT_OK


_SWARM_HANDLERS = {"show": _handle_show, "lanes": _handle_lanes, "pin": _handle_pin}
_RU_HANDLERS = {"audit": _handle_ru_audit, "apply": _handle_ru_apply}


def handle(args) -> int:
    command = getattr(args, "nomad_command", None)
    if command == "balance":
        return _handle_balance(args)
    if command == "swarm":
        handler = _SWARM_HANDLERS.get(getattr(args, "nomad_swarm_command", None))
        if handler is None:
            parser = getattr(args, "nomad_swarm_parser", None)
            if parser is not None:
                parser.print_help()
            return EXIT_USAGE
        return handler(args)
    if command == "ru":
        handler = _RU_HANDLERS.get(getattr(args, "nomad_ru_command", None))
        if handler is None:
            parser = getattr(args, "nomad_ru_parser", None)
            if parser is not None:
                parser.print_help()
            return EXIT_USAGE
        return handler(args)
    parser = getattr(args, "nomad_parser", None)
    if parser is not None:
        parser.print_help()
    return EXIT_USAGE
