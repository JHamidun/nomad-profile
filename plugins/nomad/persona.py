"""Персона ИИ-ментора для «Симулятора ИИ» и настройка фильтра «недавних» (задача M-154, U8).

Что здесь живёт:

* канонический системный промпт ведущего курса («Симулятор ИИ», навык ``vibecoding-course``) и
  стартовые сценарии/треки на русском языке с обращением строго на «вы» (решение D10);
* разрешение персоны по ключу (``resolve_persona("simulator")``) и сборка патча настроек
  профиля ``config.yaml`` (``personalities.simulator``, ``agent.personalities.simulator``);
* настройка фильтрации служебных сессий (``cron``, ``subagent``, ``tool``) из списка «недавних»
  через конфигурацию профиля (``sessions.show_subagents: false``, ``sessions.exclude_sources``),
  без единого патча к ядру апстрима (D04, ui-parity §U8).

Импорты ядра — строго через ``core_adapter`` и ``profile_config`` (гейт ``core-adapter``, M-157).
"""

from __future__ import annotations

import copy
from pathlib import Path
from typing import Any, Iterable, Mapping, Optional

import yaml

from . import core_adapter, profile_config

SIMULATOR_PERSONA_KEY: str = "simulator"
SIMULATOR_PERSONA_ALIASES: frozenset[str] = frozenset({"simulator", "mentor", "nomad_mentor"})
SIMULATOR_SESSION_SOURCE: str = "simulator"
SIMULATOR_SESSION_TITLE: str = "Симулятор ИИ"
SIMULATOR_ROUTE_PATH: str = "/nomad-simulator"
SIMULATOR_NAV_LABEL: str = "Симулятор ИИ"
SIMULATOR_NAV_CODICON: str = "mortar-board"
SIMULATOR_NAV_ORDER: int = 60
MAX_SIDEBAR_NAV_ITEMS: int = 6

# Три служебных источника сессий, которые скрываются из «Недавних» настройкой профиля (без патча):
#   1) cron     — фоновые прогоны расписания;
#   2) subagent — дочерние сессии делегирования и воркеров роя;
#   3) tool     — служебные вызовы инструментов.
SERVICE_SESSION_SOURCES: tuple[str, str, str] = ("cron", "subagent", "tool")

# Внутренние источники хранения БД сессий (hermes_state_sessions.py: INTERNAL_LISTING_SOURCES).
INTERNAL_LISTING_SOURCES: tuple[str, str, str] = ("kanban", "tool", "oneshot")

# Шесть канонических строк плагина Nomad в боковом меню десктопа (M-207a, M-154, D09):
# N1 Аккаунты, N4 Навыки Nomad, N5 Безопасность, N6 Данные и место, N7 Перенос и старт, U8 Симулятор ИИ.
NOMAD_SIDEBAR_NAV_ITEMS: tuple[dict[str, Any], ...] = (
    {
        "id": "accounts",
        "code": "N1",
        "label": "Аккаунты",
        "path": "/nomad-accounts",
        "codicon": "account",
        "order": 60,
    },
    {
        "id": "skills",
        "code": "N4",
        "label": "Навыки Nomad",
        "path": "/nomad-skills",
        "codicon": "extensions",
        "order": 61,
    },
    {
        "id": "safety",
        "code": "N5",
        "label": "Безопасность",
        "path": "/nomad-safety",
        "codicon": "shield",
        "order": 62,
    },
    {
        "id": "data",
        "code": "N6",
        "label": "Данные и место",
        "path": "/nomad-data",
        "codicon": "database",
        "order": 63,
    },
    {
        "id": "start",
        "code": "N7",
        "label": "Перенос и старт",
        "path": "/nomad-start",
        "codicon": "rocket",
        "order": 64,
    },
    {
        "id": "simulator",
        "code": "U8",
        "label": SIMULATOR_NAV_LABEL,
        "path": SIMULATOR_ROUTE_PATH,
        "codicon": SIMULATOR_NAV_CODICON,
        "order": 65,
    },
)

SIMULATOR_TRACKS: tuple[dict[str, str], ...] = (
    {
        "id": "founder",
        "label": "Основатель",
        "summary": "Проверка продуктовых гипотез, сборка MVP, лендингов и расчёт экономики без штата разработчиков.",
        "first_mission": "Собрать интерактивный калькулятор юнит-экономики и посадочную страницу для вашего продукта.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Основатель» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу предложите первую практическую микро-миссию."
        ),
    },
    {
        "id": "marketer",
        "label": "Маркетолог",
        "summary": "Контент-конвейеры, посадочные страницы, лид-магниты и автоматическая аналитика кампаний.",
        "first_mission": "Собрать генератор мультиформатного контент-плана и интерактивный квиз для лидов.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Маркетолог» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "product",
        "label": "Продакт",
        "summary": "Живые прототипы функций, разбор обратной связи пользователей, PRD и быстрые эксперименты.",
        "first_mission": "Превратить сырые заметки интервью в кликабельный прототип новой функции.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Продакт» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "project",
        "label": "Проджект",
        "summary": "Контроль сроков, автоматическая сводка статусов, управление рисками и прозрачные отчёты.",
        "first_mission": "Настроить автоматический сборщик недельного отчёта и детектор блокеров по задачам.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Проджект» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "analyst",
        "label": "Аналитик",
        "summary": "Очистка выгрузок, SQL/Python-пайплайны, наглядные дашборды и проверка гипотез на данных.",
        "first_mission": "Построить воспроизводимый пайплайн очистки CSV-выгрузки с интерактивным отчётом.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Аналитик» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "designer",
        "label": "Дизайнер",
        "summary": "Живые UI-компоненты, токены дизайн-системы, анимации и проверка сценариев в коде.",
        "first_mission": "Собрать интерактивную витрину компонентов с переключением состояний и темы.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Дизайнер» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "hr",
        "label": "HR",
        "summary": "Профили ролей, разбор резюме, планы адаптации новичков и внутренняя база знаний.",
        "first_mission": "Собрать интерактивный чек-лист онбординга и матрицу оценки кандидатов под вашу вакансию.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «HR» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "sales",
        "label": "Продажи",
        "summary": "Персонализация коммерческих предложений, подготовка к встречам и автоматизация CRM-рутины.",
        "first_mission": "Собрать генератор персонального коммерческого предложения по карточке клиента.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Продажи» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
    {
        "id": "operations",
        "label": "Операции",
        "summary": "Регламенты, сверка таблиц, связка внутренних сервисов и устранение ручных операций.",
        "first_mission": "Автоматизировать сверку регулярных таблиц и выпуск операционной сводки без ручного копирования.",
        "kickoff": (
            "Здравствуйте! Я выбираю трек «Операции» в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
        ),
    },
)

SIMULATOR_SCENARIOS: tuple[dict[str, str], ...] = (
    {
        "id": "prompting",
        "title": "Точный промптинг и постановка задачи",
        "description": "Научитесь формулировать контекст, критерии приёмки и ограничения так, чтобы агент выдавал готовый результат с первого шага.",
        "kickoff": (
            "Здравствуйте! Хочу потренировать навык точной постановки задач агенту в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор и предложите первую короткую миссию."
        ),
    },
    {
        "id": "automation",
        "title": "Автоматизация рутины и расписаний",
        "description": "Соберите собственный рабочий конвейер: разбор файлов, проверка данных и регулярные отчёты по расписанию.",
        "kickoff": (
            "Здравствуйте! Хочу освоить автоматизацию рутины и регулярных задач в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор и предложите первую практическую миссию."
        ),
    },
    {
        "id": "swarm",
        "title": "Управление роем параллельных агентов",
        "description": "Разделите крупную задачу на независимые дорожки роя, проверьте результаты и соберите итоговое решение.",
        "kickoff": (
            "Здравствуйте! Хочу научиться запускать параллельный рой агентов в «Симуляторе ИИ». "
            "Поприветствуйте меня как ментор и начните первую миссию по работе с роем."
        ),
    },
)

SIMULATOR_UI: dict[str, str] = {
    "nav_label": SIMULATOR_NAV_LABEL,
    "title": "Симулятор ИИ",
    "subtitle": "Интерактивный практикум с персональным ИИ-ментором Nomad",
    "description": (
        "Учитесь вайбкодингу и управлению агентами вместе с ведущим курса: выберите вашу роль, "
        "проходите короткие практические миссии и собирайте рабочие инструменты прямо в чате."
    ),
    "start": "Начать курс",
    "start_hint": "Откроется новый диалог с ментором, и первый ответ сразу запустит практикум",
    "continue_label": "Продолжить",
    "continue_hint": "Вернуться к вашей последней учебной сессии «Симулятора ИИ»",
    "tracks_heading": "Выберите трек под вашу роль",
    "scenarios_heading": "Быстрые сценарии тренажёра",
    "recents_filter_note": "Служебные сессии (cron, subagent, tool) скрыты из списка «Недавних» настройкой профиля.",
}

SIMULATOR_KICKOFF: str = (
    "Здравствуйте! Запускаю «Симулятор ИИ». Поприветствуйте меня как ведущий курса в двух "
    "предложениях и предложите выбрать один из 9 треков роли (Основатель, Маркетолог, Продакт, "
    "Проджект, Аналитик, Дизайнер, HR, Продажи, Операции) в столбик по одному на строке — "
    "без вызова инструментов и чтения файлов, сразу живым ответом."
)

SIMULATOR_FIRST_TURN_GREETING: str = (
    "Приветствую вас в «Симуляторе ИИ»! Я ваш инструктор по вайбкодингу — за несколько практических "
    "миссий мы соберём рабочую систему под ваши задачи. С какого направления начнём? Выберите трек:\n"
    "- Основатель — проверка гипотез, MVP и расчёт экономики продукта\n"
    "- Маркетолог — контент-конвейеры, посадочные страницы и аналитика кампаний\n"
    "- Продакт — живые прототипы функций, исследования и быстрые эксперименты\n"
    "- Проджект — контроль сроков, автоматические сводки и управление рисками\n"
    "- Аналитик — очистка данных, пайплайны и наглядные дашборды\n"
    "- Дизайнер — интерактивные UI-прототипы и дизайн-системы в коде\n"
    "- HR — профили ролей, адаптация сотрудников и база знаний\n"
    "- Продажи — подготовка коммерческих предложений и автоматизация работы с клиентами\n"
    "- Операции — связка сервисов, регламенты и устранение ручной рутины"
)

SIMULATOR_PERSONA: str = """\
Вы — ведущий интерактивного курса «Симулятор ИИ» в Nomad (навык `vibecoding-course`): практичный, доброжелательный и структурный ИИ-ментор, который обучает пользователя вайбкодингу, точной постановке задач, автоматизации и работе с роем агентов на реальных микро-миссиях.

Обращайтесь к пользователю строго на «вы» (уважительно, живо и по делу, без канцелярита и фамильярности). Вы ведёте занятие, предлагаете конкретные шаги и помогаете довести каждую миссию до осязаемого результата в рабочей папке проекта.

ПРАВИЛО ПЕРВОГО ОТВЕТА (высший приоритет):
На самое первое сообщение пользователя в новой сессии ответьте МГНОВЕННО — без вызова каких-либо инструментов (`skills_list`, `skill_view`, `read_file`, `terminal`, поиска и т. п.) и без чтения диска. Ваш первый ответ — это тёплое приветствие в 1–2 предложениях и список из 9 ролевых треков в столбик (по одному на строке с коротким пояснением), чтобы пользователь сразу выбрал близкую ему роль:
- Основатель — проверка гипотез, MVP и экономика продукта
- Маркетолог — контент-конвейеры, лендинги и аналитика кампаний
- Продакт — живые прототипы функций, исследования и эксперименты
- Проджект — контроль сроков, статусы и автоматизация отчётов
- Аналитик — пайплайны данных, отчёты и проверка гипотез
- Дизайнер — интерактивные UI-компоненты и дизайн-системы
- HR — подбор, онбординг и внутренняя база знаний
- Продажи — персонализация офферов и автоматизация CRM-сценариев
- Операции — регламенты, сверка таблиц и снятие ручной рутины

ПРАВИЛО ВТОРОГО И ПОСЛЕДУЮЩИХ ХОДОВ (вы ведёте курс, а не ждёте ТЗ от ученика):
Как только пользователь ответил на приветствие (назвал роль, выбрал трек, описал свою задачу или просто написал «давайте начнём»):
1. Сразу зафиксируйте наиболее подходящий трек (если роль не уточнена — выберите «Основатель» по умолчанию) и запустите Миссию 1 этого трека.
2. Никогда не просите пользователя «придумать сценарий для тренировки» или «описать программу курса» — сценарий, шаги и критерий успеха миссии всегда предлагаете вы как ментор.
3. Каждая миссия строится по циклу: короткий бриф (2–3 предложения) → одно понятное действие для пользователя → проверка результата → переход к следующему шагу.
4. Задавайте не более одного уточняющего вопроса за ход и всегда сопровождайте его готовым вариантом по умолчанию, чтобы пользователь мог двигаться вперёд одним кликом или коротким ответом.
"""

# Совместимость со старым приватным именем из архива форка.
_SIMULATOR_PERSONA: str = SIMULATOR_PERSONA


def resolve_persona(key: Optional[str]) -> Optional[str]:
    """Вернуть системный промпт персоны по ключу (или ``None`` для неизвестного ключа)."""
    if not key or not isinstance(key, str):
        return None
    normalized = key.strip().lower()
    if normalized in SIMULATOR_PERSONA_ALIASES:
        return SIMULATOR_PERSONA
    return None


def get_mentor_system_prompt(track_id: Optional[str] = None) -> str:
    """Вернуть системный промпт ментора; при указании ``track_id`` добавляет контекст выбранного трека."""
    if not track_id:
        return SIMULATOR_PERSONA
    needle = str(track_id).strip().lower()
    for track in SIMULATOR_TRACKS:
        if track["id"] == needle or track["label"].lower() == needle:
            return (
                f"{SIMULATOR_PERSONA}\n\n"
                f"Выбранный пользователем трек: «{track['label']}» ({track['summary']}). "
                f"Первая практическая миссия: {track['first_mission']}"
            )
    for scenario in SIMULATOR_SCENARIOS:
        if scenario["id"] == needle:
            return (
                f"{SIMULATOR_PERSONA}\n\n"
                f"Выбранный пользователем сценарий: «{scenario['title']}» ({scenario['description']})."
            )
    return SIMULATOR_PERSONA


def get_simulator_kickoff(track_id: Optional[str] = None) -> str:
    """Сформировать стартовое сообщение пользователя для запуска чата с ментором (на «вы», D10)."""
    if not track_id:
        return SIMULATOR_KICKOFF
    needle = str(track_id).strip().lower()
    for track in SIMULATOR_TRACKS:
        if track["id"] == needle or track["label"].lower() == needle:
            return track["kickoff"]
    for scenario in SIMULATOR_SCENARIOS:
        if scenario["id"] == needle or scenario["title"].lower() == needle:
            return scenario["kickoff"]
    return SIMULATOR_KICKOFF


def get_simulator_tracks() -> list[dict[str, str]]:
    """Копия списка из 9 ролевых треков «Симулятора ИИ»."""
    return [dict(track) for track in SIMULATOR_TRACKS]


def get_simulator_scenarios() -> list[dict[str, str]]:
    """Копия списка быстрых сценариев тренажёра (промптинг, автоматизация, рои)."""
    return [dict(scenario) for scenario in SIMULATOR_SCENARIOS]


def build_simulator_config_patch() -> dict[str, Any]:
    """Патч ``config.yaml`` для регистрации персоны ментора и фильтрации служебных сессий в «Недавних».

    Записывает:
    * ``personalities.simulator`` и ``agent.personalities.simulator`` — чтобы ``config.set``
      с ключом ``personality='simulator'`` и ``hermes_cli.personality`` разрешали персону ментора
      штатным механизмом ядра без патчей;
    * ``sessions.show_subagents: False`` и ``sessions.exclude_sources: ['cron', 'subagent', 'tool']`` —
      чтобы три служебные сессии скрывались из списка «Недавних» настройкой профиля.
    """
    return {
        "personalities": {
            SIMULATOR_PERSONA_KEY: {
                "description": SIMULATOR_UI["description"],
                "system_prompt": SIMULATOR_PERSONA,
                "tone": "уважительное обращение на «вы», практичный наставник",
                "style": "короткие шаги, микро-миссии, живые примеры без воды",
            },
        },
        "agent": {
            "personalities": {
                SIMULATOR_PERSONA_KEY: SIMULATOR_PERSONA,
            },
        },
        "sessions": {
            "show_subagents": False,
            "exclude_sources": list(SERVICE_SESSION_SOURCES),
        },
        "nomad": {
            "simulator": {
                "persona": SIMULATOR_PERSONA_KEY,
                "source": SIMULATOR_SESSION_SOURCE,
                "exclude_recent_sources": list(SERVICE_SESSION_SOURCES),
            },
        },
    }


def apply_simulator_settings(config: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Применить настройки персоны ментора и фильтра «недавних» к словарю конфигурации."""
    target: dict[str, Any] = copy.deepcopy(config) if isinstance(config, dict) else {}
    patch = build_simulator_config_patch()

    personalities = target.get("personalities")
    if not isinstance(personalities, dict):
        personalities = {}
    personalities[SIMULATOR_PERSONA_KEY] = patch["personalities"][SIMULATOR_PERSONA_KEY]
    target["personalities"] = personalities

    agent = target.get("agent")
    if not isinstance(agent, dict):
        agent = {}
    agent_personalities = agent.get("personalities")
    if not isinstance(agent_personalities, dict):
        agent_personalities = {}
    agent_personalities[SIMULATOR_PERSONA_KEY] = SIMULATOR_PERSONA
    agent["personalities"] = agent_personalities
    target["agent"] = agent

    sessions_cfg = target.get("sessions")
    if not isinstance(sessions_cfg, dict):
        sessions_cfg = {}
    sessions_cfg["show_subagents"] = False
    existing_excluded = sessions_cfg.get("exclude_sources")
    merged_excluded: list[str] = []
    if isinstance(existing_excluded, list):
        for item in existing_excluded:
            val = str(item or "").strip().lower()
            if val and val not in merged_excluded:
                merged_excluded.append(val)
    for src in SERVICE_SESSION_SOURCES:
        if src not in merged_excluded:
            merged_excluded.append(src)
    sessions_cfg["exclude_sources"] = merged_excluded
    target["sessions"] = sessions_cfg

    nomad_cfg = target.get("nomad")
    if not isinstance(nomad_cfg, dict):
        nomad_cfg = {}
    sim_cfg = nomad_cfg.get("simulator")
    if not isinstance(sim_cfg, dict):
        sim_cfg = {}
    sim_cfg["persona"] = SIMULATOR_PERSONA_KEY
    sim_cfg["source"] = SIMULATOR_SESSION_SOURCE
    sim_cfg["exclude_recent_sources"] = list(merged_excluded)
    nomad_cfg["simulator"] = sim_cfg
    target["nomad"] = nomad_cfg

    return target


def configure_profile(config_file: Optional[Path] = None) -> dict[str, Any]:
    """Записать персону ментора и настройку фильтра «недавних» в ``config.yaml`` профиля."""
    target_path = config_file if config_file is not None else profile_config.config_path()
    current = profile_config.load(target_path) or {}
    updated = apply_simulator_settings(current)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_text(
        yaml.safe_dump(updated, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )
    if config_file is None:
        try:
            core_cfg = core_adapter.load_config()
            if isinstance(core_cfg, dict):
                core_adapter.save_config(apply_simulator_settings(core_cfg))
        except Exception:
            pass
    return updated


def excluded_recent_sources(config: Optional[Mapping[str, Any]] = None) -> tuple[str, ...]:
    """Кортеж источников сессий, скрытых из «Недавних» согласно настройке профиля."""
    cfg: Mapping[str, Any]
    if isinstance(config, Mapping):
        cfg = config
    else:
        try:
            cfg = profile_config.load() or {}
        except Exception:
            cfg = {}

    sessions_cfg = cfg.get("sessions") if isinstance(cfg.get("sessions"), Mapping) else {}
    show_subagents = bool(sessions_cfg.get("show_subagents", False))

    excluded: list[str] = []
    for src in ("cron", "tool"):
        if src not in excluded:
            excluded.append(src)
    if not show_subagents and "subagent" not in excluded:
        excluded.append("subagent")

    raw_exclude = sessions_cfg.get("exclude_sources")
    if isinstance(raw_exclude, (list, tuple, set)):
        for item in raw_exclude:
            val = str(item or "").strip().lower()
            if val == "subagent" and show_subagents:
                continue
            if val and val not in excluded:
                excluded.append(val)

    nomad_cfg = cfg.get("nomad") if isinstance(cfg.get("nomad"), Mapping) else {}
    sim_cfg = nomad_cfg.get("simulator") if isinstance(nomad_cfg.get("simulator"), Mapping) else {}
    raw_sim_exclude = sim_cfg.get("exclude_recent_sources")
    if isinstance(raw_sim_exclude, (list, tuple, set)):
        for item in raw_sim_exclude:
            val = str(item or "").strip().lower()
            if val == "subagent" and show_subagents:
                continue
            if val and val not in excluded:
                excluded.append(val)

    for src in INTERNAL_LISTING_SOURCES:
        if src not in excluded:
            excluded.append(src)

    return tuple(excluded)


def is_service_session(session_or_source: Any, config: Optional[Mapping[str, Any]] = None) -> bool:
    """Проверить, является ли сессия (или строка источника) служебной и скрытой из «Недавних»."""
    excluded = set(excluded_recent_sources(config))
    if isinstance(session_or_source, str):
        source = session_or_source.strip().lower()
        return source in excluded
    if isinstance(session_or_source, Mapping):
        if bool(session_or_source.get("hidden")):
            return True
        source = str(session_or_source.get("source") or "").strip().lower()
        if source in excluded:
            return True
        if session_or_source.get("parent_session_id") and "subagent" in excluded and source in {"subagent", "delegate"}:
            return True
    return False


def filter_recent_sessions(
    sessions: Iterable[Mapping[str, Any]],
    config: Optional[Mapping[str, Any]] = None,
) -> list[dict[str, Any]]:
    """Отфильтровать список сессий для раздела «Недавние» по настройке профиля."""
    result: list[dict[str, Any]] = []
    for row in sessions:
        if not isinstance(row, Mapping):
            continue
        if is_service_session(row, config=config):
            continue
        result.append(dict(row))
    return result
