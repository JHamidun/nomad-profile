"""Nomad — swarm orchestrator plugin for Hermes (skeleton, tasks N1 + N26).

Что регистрирует ``register(ctx)`` — только документированными методами ``PluginContext``:

* инструменты чата ``swarm_start`` и ``swarm_show`` (``ctx.register_tool``);
* подкоманды ``hermes nomad swarm show <id> [--json]`` и ``hermes nomad connect [KEY]``
  (``ctx.register_cli_command``): дерево ``swarm`` строит ``cli.py``, ``connect`` добавляет
  ``activation.py`` в ту же группу подкоманд, разбор по имени — в ``_handle_cli`` ниже.

Подключение ключа NomadNet НЕ сделано инструментом чата намеренно: аргументы инструмента уходят
провайдеру текущей модели и оседают в истории сессии — купленный ключ туда попадать не должен.

Чего здесь намеренно нет:

* запуска цикла дирижёра — его стартует шлюзовый хук ``gateway:startup`` из ``hooks/nomad-loop``
  (``conductor.ensure_started``), а не ``ctx.spawn_task``: тот вне контракта совместимости и падает
  без работающего цикла событий;
* обращений к базе при загрузке — ``register`` должен быть дешёвым и без побочных эффектов, база
  открывается и мигрирует при первом вызове инструмента.

Ошибки регистрации не глушатся: если ``register`` упал, загрузчик ядра выключит плагин и покажет
причину в ``hermes plugins list`` — это лучше, чем плагин, который «загружен», но без инструментов.
"""

from __future__ import annotations

TOOLSET = "nomad"


from . import guard as _guard_init
from . import no_nous as _no_nous_init
from . import untrusted as _untrusted_init

_guard_init.register_policy_callback(_untrusted_init.on_pre_tool_call)
_no_nous_init.install_no_nous_guard()


def register(ctx) -> None:
    from . import selfcheck  # M-071: contract.yaml, sync from the tree, retired paths; never raises
    selfcheck.on_start()
    # Импорт внутри register: пакет импортируют и без ctx (хук шлюза берёт отсюда только
    # conductor), и тянуть туда инструменты и argparse-дерево незачем.
    from . import billing, guard, k6, meter, no_nous, skill_finder, spotlight, thinking_policy, tools, untrusted, verification, whitelabel

    no_nous.install_no_nous_guard()
    whitelabel.patch_loaded_attribution_headers()
    guard.register_policy_callback(untrusted.on_pre_tool_call)
    verification.register_auxiliary_task(ctx)
    k6.register(ctx)
    thinking_policy.register(ctx)

    ctx.register_tool(name="swarm_start", toolset=TOOLSET, schema=tools.SWARM_START,
                      handler=tools.swarm_start, description="Create a Nomad swarm", emoji="🐝")
    ctx.register_tool(name="swarm_show", toolset=TOOLSET, schema=tools.SWARM_SHOW,
                      handler=tools.swarm_show, description="Show a Nomad swarm", emoji="🐝")
    ctx.register_tool(name="skill_find", toolset=TOOLSET, schema=skill_finder.FIND_SCHEMA,
                      handler=skill_finder.handle_find,
                      description="Search active and dormant skills or read full SKILL.md", emoji="🔎")
    ctx.register_hook("pre_tool_call", untrusted.on_pre_tool_call)
    ctx.register_hook("pre_tool_call", guard.on_pre_tool_call)
    ctx.register_hook("post_tool_call", verification.on_post_tool_call)
    ctx.register_hook("post_api_request", meter.on_post_api_request)
    ctx.register_hook("transform_api_error_classification", billing.on_transform_api_error_classification)
    ctx.register_hook("transform_tool_result", spotlight.on_transform_tool_result)
    ctx.register_hook("transform_llm_output", whitelabel.on_transform_llm_output)
    ctx.register_hook("transform_llm_output", verification.on_transform_llm_output)
    ctx.register_cli_command(name="nomad", help="Nomad swarm orchestrator",
                             setup_fn=_setup_cli, handler_fn=_handle_cli,
                             description="Inspect swarms of the Nomad orchestrator and "
                                         "connect a purchased NomadNet key.")
    ctx.register_cli_command(name="swarm", help="Inspect and control Nomad swarms",
                             setup_fn=_setup_swarm_cli, handler_fn=_handle_swarm_cli,
                             description="Inspect and control swarms of the Nomad orchestrator.")


def _setup_cli(parser) -> None:
    from . import activation, cli

    cli.setup(parser)
    activation.add_cli_parser(parser)


def _handle_cli(args) -> int:
    from . import activation, cli

    if activation.is_cli_command(args):
        return activation.handle_cli(args)
    return cli.handle(args)


def _setup_swarm_cli(parser) -> None:
    from . import cli

    cli.setup_swarm(parser)


def _handle_swarm_cli(args) -> int:
    from . import cli

    return cli.handle_swarm(args)

