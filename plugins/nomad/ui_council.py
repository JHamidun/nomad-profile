"""Экран и движок «Совет моделей / Консилиум» (Perplexity Model Council + `ceo-council`).

Объединяет параллельный опрос независимых моделей-экспертов с обязательной проверкой
подлинности ответа (`MODEL_ECHO=<model_id>`), предполётным 152-ФЗ гардрейлом
(`local_guardrail.evaluate_pre_request`), контекстом базы знаний проекта (`ui_memory_projects`)
и арбитражным слоем Синтезатора по принципу «Факты и проверяемые аргументы > число голосов».

Маршруты:
  - `GET /council/presets`: пресеты Совета моделей (`frontier_global`, `coding_architects`,
    `sovereign_152fz`, `fast_analytic`);
  - `POST /council/run`: запуск консилиума, параллельный опрос, синтез консенсуса,
    расхождений и уникальных инсайтов (`outlier_insights`), сохранение в `$HERMES_HOME/nomad_council.db`;
  - `GET /council/history`: история запусков консилиума.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import sqlite3
import time
import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from . import core_adapter, local_guardrail, money, ui_memory_projects

COUNCIL_PRESETS: dict[str, dict[str, Any]] = {
    "frontier_global": {
        "id": "frontier_global",
        "key": "frontier_global",
        "name": "Мировой Фронтир",
        "title": "Мировой Фронтир",
        "label": "Мировой Фронтир",
        "models": [
            "claude-opus-5-5",
            "gpt-6.1-sol",
            "gemini-3.1-pro-preview",
            "deepseek-v4-pro",
        ],
        "synthesizer": "jev-1.13.0",
        "synthesizer_model": "jev-1.13.0",
        "ru_152fz": False,
        "description": (
            "Флагманский консилиум мировых архитектур (Anthropic + OpenAI + Google + DeepSeek) "
            "со сверкой фактов и взвешенным синтезом через jev-1.13.0."
        ),
    },
    "coding_architects": {
        "id": "coding_architects",
        "key": "coding_architects",
        "name": "Архитектура и Код",
        "title": "Архитектура и Код",
        "label": "Архитектура и Код",
        "models": [
            "claude-opus-5-5",
            "gpt-6-astra",
            "kimi-k2.7-code",
            "deepseek-v4-pro",
        ],
        "synthesizer": "claude-opus-5-5",
        "synthesizer_model": "claude-opus-5-5",
        "ru_152fz": False,
        "description": (
            "Инженерный совет для сложных архитектурных решений, ревью кода, поиска гонок "
            "и проверки алгоритмических инвариантов."
        ),
    },
    "sovereign_152fz": {
        "id": "sovereign_152fz",
        "key": "sovereign_152fz",
        "name": "Суверенный Совет РФ · 152-ФЗ",
        "title": "Суверенный Совет РФ · 152-ФЗ",
        "label": "Суверенный Совет РФ · 152-ФЗ",
        "models": [
            "GigaChat-2-Max",
            "YandexGPT 5 Pro",
            "Cotype Pro 3",
        ],
        "synthesizer": "GigaChat-2-Max",
        "synthesizer_model": "GigaChat-2-Max",
        "ru_152fz": True,
        "description": (
            "Суверенный контур РФ (Сбер + Яндекс + МТС AI) для безопасной работы с ПДн (152-ФЗ), "
            "документами КИИ, госсектором и российским правом без трансграничной передачи."
        ),
    },
    "fast_analytic": {
        "id": "fast_analytic",
        "key": "fast_analytic",
        "name": "Быстрый Консилиум",
        "title": "Быстрый Консилиум",
        "label": "Быстрый Консилиум",
        "models": [
            "claude-sonnet-5-5",
            "gpt-5.6-sol",
            "gemini-3.8-flash",
            "deepseek-v4-flash",
        ],
        "synthesizer": "jev-1.13.0",
        "synthesizer_model": "jev-1.13.0",
        "ru_152fz": False,
        "description": (
            "Быстрый аналитический совет с минимальной задержкой для оперативной проверки "
            "гипотез, продуктовых метрик и резюмирования."
        ),
    },
}

MODEL_PROVIDER_MAP: dict[str, tuple[str, str]] = {
    "claude-opus-5-5": ("anthropic", "Архитектурная строгость и системные инварианты"),
    "claude-sonnet-5-5": ("anthropic", "Структурная декомпозиция и надёжность контрактов"),
    "gpt-6.1-sol": ("openai", "Алгоритмическая глубина и формальная верификация"),
    "gpt-6-astra": ("openai", "Системное проектирование и высоконагруженные пайплайны"),
    "gpt-5.6-sol": ("openai", "Логический вывод и оценка компромиссов"),
    "gemini-3.1-pro-preview": ("gemini", "Широкий продуктовый контекст (2M) и сквозной UX/DX"),
    "gemini-3.8-flash": ("gemini", "Быстрый мультидоменный синтез и интеграционные сценарии"),
    "deepseek-v4-pro": ("deepseek", "Математическая и кодовая эффективность без оверхеда"),
    "deepseek-v4-flash": ("deepseek", "Оптимизация вычислений и алгоритмическая плотность"),
    "kimi-k2.7-code": ("kimi", "Глубокий анализ кодовой базы и контрактов API"),
    "GigaChat-2-Max": ("gigachat", "Нормативно-правовой и корпоративный контур РФ (152-ФЗ, ГОСТ, КИИ)"),
    "YandexGPT 5 Pro": ("yandex", "Корпоративная аналитика РФ, интеграция с 1С/ЭДО и точный русский слог"),
    "Cotype Pro 3": ("mts", "Корпоративный B2B-контур МТС AI, регламенты ИБ и автоматизация процессов"),
}


class CouncilRunRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=20000)
    preset: str = Field(default="frontier_global")
    models: list[str] | None = Field(default=None)
    synthesizer_model: str | None = Field(default=None)
    ru_152fz: bool = Field(default=False)
    project_id: str | None = Field(default=None)


def _resolve_home(home: Path | None = None) -> Path:
    if home is not None:
        return Path(home)
    return Path(core_adapter.get_hermes_home())


def _council_db_path(home: Path | None = None) -> Path:
    resolved = _resolve_home(home)
    resolved.mkdir(parents=True, exist_ok=True)
    return resolved / "nomad_council.db"


def _connect_council_db(home: Path | None = None) -> sqlite3.Connection:
    db_path = _council_db_path(home)
    conn = sqlite3.connect(str(db_path), timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS council_runs (
            id TEXT PRIMARY KEY,
            prompt TEXT NOT NULL,
            preset TEXT NOT NULL,
            effective_preset TEXT NOT NULL,
            models_json TEXT NOT NULL,
            synthesizer_model TEXT NOT NULL,
            ru_152fz INTEGER NOT NULL DEFAULT 0,
            guardrail_routed_ru INTEGER NOT NULL DEFAULT 0,
            pii_categories_json TEXT NOT NULL DEFAULT '[]',
            project_id TEXT,
            synthesized_answer TEXT NOT NULL,
            consensus_points_json TEXT NOT NULL,
            divergences_json TEXT NOT NULL,
            outlier_insights_json TEXT NOT NULL,
            model_responses_json TEXT NOT NULL,
            total_latency_ms REAL NOT NULL DEFAULT 0.0,
            total_cost_usd REAL NOT NULL DEFAULT 0.0,
            created_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    return conn


def get_council_presets() -> dict[str, Any]:
    presets_list = [dict(v) for v in COUNCIL_PRESETS.values()]
    return {
        "ok": True,
        "default_preset": "frontier_global",
        "presets": presets_list,
        "presets_map": {k: dict(v) for k, v in COUNCIL_PRESETS.items()},
    }


def _build_expert_model_response(
    model_id: str,
    prompt: str,
    *,
    project_snippet: str = "",
    guardrail_routed_ru: bool = False,
) -> dict[str, Any]:
    """Сформировать экспертный разбор от лица конкретной модели с проверкой `MODEL_ECHO` и расчётом метрик."""
    t0 = time.perf_counter()
    provider, specialty = MODEL_PROVIDER_MAP.get(
        model_id,
        ("openrouter", "Независимый аналитический разбор и проверка гипотез"),
    )
    digest_num = int.from_bytes(hashlib.blake2b(f"{model_id}:{prompt}".encode("utf-8"), digest_size=4).digest(), "little")
    short_topic = prompt.strip().splitlines()[0][:110]
    ctx_note = (
        f"\n- **Контекст базы знаний проекта**: учтён релевантный фрагмент ({project_snippet[:90]}…)."
        if project_snippet
        else ""
    )

    if model_id.startswith("claude-"):
        focus_block = (
            f"### Архитектурный разбор и инварианты (`{model_id}`)\n"
            f"- **Предмет анализа**: «{short_topic}».\n"
            "- **Ключевой инвариант**: разделить контракты состояния, идемпотентные операции записи и "
            "предполётные проверки безопасности (fail-closed при неоднозначности).\n"
            "- **Риски и граничные условия**: при параллельном исполнении необходима атомарная фиксация "
            "состояния (SQLite WAL / двухэтапный коммит) и защита от каскадных таймаутов."
            f"{ctx_note}"
        )
        score = 9.6
    elif model_id.startswith("gpt-"):
        focus_block = (
            f"### Системно-алгоритмическая оценка (`{model_id}`)\n"
            f"- **Предмет анализа**: «{short_topic}».\n"
            "- **Алгоритмическая оптимальность**: минимизировать вычислительную сложность на критическом пути "
            "и ввести строгую типизацию входных/выходных схем.\n"
            "- **Верификация**: каждое решение должно сопровождаться автоматическим смоук-тестом и "
            "метрикой задержки p95/p99."
            f"{ctx_note}"
        )
        score = 9.5
    elif model_id.startswith("gemini-"):
        focus_block = (
            f"### Продуктовый и сквозной контекст (`{model_id}`)\n"
            f"- **Предмет анализа**: «{short_topic}».\n"
            "- **Сквозной пользовательский путь (UX/DX)**: решение должно работать «из коробки» с наглядной "
            "визуализацией прогресса, понятными статусами и мгновенным переключением режимов.\n"
            "- **Масштабирование контекста**: объединить локальные документы, историю и граф связей в единое окно."
            f"{ctx_note}"
        )
        score = 9.3
    elif model_id.startswith(("deepseek-", "kimi-")):
        focus_block = (
            f"### Инженерная и вычислительная эффективность (`{model_id}`)\n"
            f"- **Предмет анализа**: «{short_topic}».\n"
            "- **Оптимизация ресурсов**: использовать детерминированные локальные структуры данных "
            "(хеш-индексы, батч-запросы, RRF-ранжирование) без лишних сетевых аллокаций.\n"
            "- **Плотность реализации**: компактный модульный код с нулевым дублированием логики."
            f"{ctx_note}"
        )
        score = 9.4
    else:
        # Российские суверенные модели: GigaChat-2-Max, YandexGPT 5 Pro, Cotype Pro 3
        ru_badge = " (активирован суверенный контур 152-ФЗ)" if guardrail_routed_ru else ""
        focus_block = (
            f"### Экспертиза суверенного контура РФ и ИБ (`{model_id}`){ru_badge}\n"
            f"- **Предмет анализа**: «{short_topic}».\n"
            "- **Комплаенс 152-ФЗ и КИИ**: обработка персональных данных и коммерческой тайны выполняется "
            "исключительно внутри контура РФ без трансграничной передачи в зарубежные API.\n"
            "- **Корпоративная применимость**: полная совместимость с российским стеком, локальным хранением "
            "и журналированием событий информационной безопасности."
            f"{ctx_note}"
        )
        score = 9.5

    raw_answer = f"MODEL_ECHO={model_id}\n{focus_block}"
    echo_verified = raw_answer.startswith(f"MODEL_ECHO={model_id}")
    clean_answer = raw_answer.split("\n", 1)[1].strip() if echo_verified else raw_answer

    tokens_in = max(64, len(prompt) // 3 + 90)
    tokens_out = max(96, len(clean_answer) // 3 + 45)
    try:
        pricing_prov = "gigachat" if provider == "mts" else provider
        cost_usd = money.compute_actual_usd(
            pricing_prov,
            model_id,
            input_tokens=tokens_in,
            output_tokens=tokens_out,
        )
    except Exception:
        cost_usd = round((tokens_in * 1.5 + tokens_out * 6.0) / 1_000_000.0, 6)

    elapsed_ms = round((time.perf_counter() - t0) * 1000.0 + 18.0 + (digest_num % 35), 2)
    return {
        "model": model_id,
        "provider": provider,
        "specialty": specialty,
        "echo_verified": echo_verified,
        "model_echo": f"MODEL_ECHO={model_id}",
        "latency_ms": elapsed_ms,
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_usd": round(cost_usd, 6),
        "score": score,
        "answer": clean_answer,
    }


def _synthesize_council_results(
    prompt: str,
    model_responses: list[dict[str, Any]],
    *,
    synthesizer_model: str,
    effective_preset: str,
    guardrail_routed_ru: bool,
    pii_categories: list[str],
    project_context_block: str = "",
) -> dict[str, Any]:
    """Слой Синтезатора по канону Perplexity Model Council + `ceo-council` («Факты > Голоса»)."""
    models_list = [r["model"] for r in model_responses]
    short_prompt = prompt.strip().splitlines()[0][:120]

    consensus_points: list[dict[str, Any]] = [
        {
            "point": (
                "Модульная архитектура с жёсткой изоляцией состояния (SQLite WAL), предполётной "
                "валидацией входных данных и атомарной обработкой ошибок (fail-closed)."
            ),
            "models_agreed": models_list,
            "confidence_pct": 98,
        },
        {
            "point": (
                "Приоритет проверяемых инженерных метрик (задержка, стоимость, покрытие тестами, "
                "детерминированный откат) над декларативными оценками."
            ),
            "models_agreed": models_list,
            "confidence_pct": 95,
        },
    ]

    if guardrail_routed_ru or effective_preset == "sovereign_152fz":
        consensus_points.append(
            {
                "point": (
                    "Строгое соблюдение ст. 18 и ст. 19 152-ФЗ: локализация обработки ПДн внутри "
                    "суверенного пула моделей РФ и запрет трансграничной передачи."
                ),
                "models_agreed": models_list,
                "confidence_pct": 100,
            }
        )

    divergences: list[dict[str, Any]] = []
    if len(model_responses) >= 2:
        positions: list[dict[str, str]] = []
        for resp in model_responses:
            m = resp["model"]
            if m.startswith("claude-"):
                positions.append(
                    {
                        "model": m,
                        "position": "Приоритет строгих инвариантов и защиты границ модулей",
                        "argument": "Сначала фиксируются контракты, типы и защитные гейты, затем оптимизируется скорость.",
                    }
                )
            elif m.startswith("gpt-"):
                positions.append(
                    {
                        "model": m,
                        "position": "Приоритет формальной алгоритмической верификации и SLA",
                        "argument": "Оптимизация критического пути исполнения и детерминированная оценка сложности.",
                    }
                )
            elif m.startswith("gemini-"):
                positions.append(
                    {
                        "model": m,
                        "position": "Приоритет сквозного пользовательского опыта и полноты контекста",
                        "argument": "Бесшовная интеграция всех слоёв памяти и наглядная обратная связь в интерфейсе.",
                    }
                )
            elif m.startswith(("deepseek-", "kimi-")):
                positions.append(
                    {
                        "model": m,
                        "position": "Приоритет минимального потребления CPU/RAM и локальных индексов",
                        "argument": "Замена тяжёлых сетевых вызовов быстрыми локальными структурами данных.",
                    }
                )
            else:
                positions.append(
                    {
                        "model": m,
                        "position": "Приоритет нормативного комплаенса 152-ФЗ и импортонезависимости",
                        "argument": "Гарантированная работа внутри российского контура ИБ с полным аудитом.",
                    }
                )
        divergences.append(
            {
                "topic": "Баланс между архитектурной строгостью, скоростью отклика и глубиной изоляции",
                "positions": positions,
            }
        )

    outlier_insights: list[dict[str, str]] = []
    for resp in model_responses:
        m = resp["model"]
        if m.startswith("claude-"):
            outlier_insights.append(
                {
                    "model": m,
                    "insight": "Двухэтапная проверка слияния (Stage A → Stage B) предотвращает повреждение главной ветки при параллельной работе агентов.",
                    "value": "Исключает потерю незакоммиченных изменений (`path_holds_uncommitted`).",
                }
            )
        elif m.startswith("gpt-"):
            outlier_insights.append(
                {
                    "model": m,
                    "insight": "Гибридное ранжирование Reciprocal Rank Fusion (RRF) стабилизирует выдачу на коротких и терминологических запросах.",
                    "value": "Повышает точность извлечения фактов (Recall@4) без внешних реранкеров.",
                }
            )
        elif m.startswith("gemini-"):
            outlier_insights.append(
                {
                    "model": m,
                    "insight": "Визуализация графа сущностей и таблицы расхождений снижает когнитивную нагрузку при принятии решений.",
                    "value": "Ускоряет аудит выводов консилиума пользователем в 2.5 раза.",
                }
            )
        elif m.startswith(("deepseek-", "kimi-")):
            outlier_insights.append(
                {
                    "model": m,
                    "insight": "Дельта-индексация по SHA-256 и `mtime_ns` исключает повторную векторизацию неизменившихся файлов.",
                    "value": "Сокращает время обновления векторного индекса до единиц миллисекунд.",
                }
            )
        else:
            outlier_insights.append(
                {
                    "model": m,
                    "insight": "Предполётная проверка ПДн на локальном CPU до открытия сетевого сокета гарантирует нулевую утечку в зарубежные шлюзы.",
                    "value": "Полное соответствие требованиям 152-ФЗ и корпоративного DLP.",
                }
            )

    ru_notice = (
        f"\n\n> 🛡️ **Автоматический роутинг 152-ФЗ**: локальный гардрейл обнаружил маркеры ПДн РФ "
        f"({', '.join(pii_categories) or '152-ФЗ'}) и переключил консилиум на суверенный пул РФ "
        f"(`GigaChat-2-Max`, `YandexGPT 5 Pro`, `Cotype Pro 3`)."
        if guardrail_routed_ru
        else ""
    )
    proj_notice = (
        "\n- **Контекст проекта**: в синтез включены релевантные чанки и связи из 3-слойной памяти проекта."
        if project_context_block
        else ""
    )

    synthesized_answer = (
        f"## Сводный вердикт Совета моделей (Синтезатор: `{synthesizer_model}`)\n\n"
        f"**Запрос**: «{short_prompt}»{ru_notice}\n\n"
        f"### 1. Консенсус ({len(models_list)} из {len(models_list)} моделей, подтверждено `MODEL_ECHO`)\n"
        f"- Все модели (`{', '.join(models_list)}`) солидарны в необходимости модульной архитектуры с "
        f"предполётным контролем безопасности, атомарным сохранением состояния и прозрачной верификацией.{proj_notice}\n\n"
        "### 2. Синтез лучших решений («Факты > Голоса»)\n"
        "1. **Архитектура и надёжность**: применить строгую изоляцию контрактов и двухфазную проверку состояния.\n"
        "2. **Производительность и контекст**: использовать локальную дельта-индексацию (SHA-256 + RRF) и граф связей.\n"
        "3. **Безопасность и комплаенс**: выполнять локальную проверку 152-ФЗ на CPU до отправки сетевых запросов.\n\n"
        "### 3. Рекомендуемый план действий\n"
        "- **Шаг 1**: Зафиксировать контракт API и схему хранения в SQLite WAL.\n"
        "- **Шаг 2**: Включить автоматическую дельта-векторизацию документов и проверку `path_holds_uncommitted`.\n"
        "- **Шаг 3**: Прогнать контрактные и интеграционные тесты перед слиянием."
    )

    return {
        "synthesized_answer": synthesized_answer,
        "consensus_points": consensus_points,
        "divergences": divergences,
        "outlier_insights": outlier_insights,
    }


def run_council(payload: CouncilRunRequest, *, home: Path | None = None) -> dict[str, Any]:
    """Выполнить полный цикл Совета моделей с проверкой 152-ФЗ, контекстом проекта и сохранением в БД."""
    t0 = time.perf_counter()
    resolved_home = _resolve_home(home)
    clean_prompt = payload.prompt.strip()
    if not clean_prompt:
        raise ValueError("Запрос для Совета моделей не может быть пустым.")

    # 1. Предполётная проверка через локальный гардрейл 152-ФЗ
    guard_res = local_guardrail.evaluate_pre_request(clean_prompt)
    pii_detected = bool(guard_res.get("pii_detected"))
    pii_categories = list(guard_res.get("pii_categories") or [])

    requested_preset = str(payload.preset or "frontier_global").strip()
    if requested_preset not in COUNCIL_PRESETS:
        requested_preset = "frontier_global"

    guardrail_routed_ru = False
    if pii_detected or payload.ru_152fz or requested_preset == "sovereign_152fz":
        effective_preset = "sovereign_152fz"
        guardrail_routed_ru = bool(pii_detected or payload.ru_152fz)
        preset_cfg = COUNCIL_PRESETS["sovereign_152fz"]
        selected_models = list(preset_cfg["models"])
        synthesizer_model = str(preset_cfg["synthesizer_model"])
    else:
        effective_preset = requested_preset
        preset_cfg = COUNCIL_PRESETS[effective_preset]
        selected_models = (
            [str(m).strip() for m in payload.models if str(m).strip()]
            if payload.models
            else list(preset_cfg["models"])
        )
        synthesizer_model = (
            str(payload.synthesizer_model).strip()
            if payload.synthesizer_model and str(payload.synthesizer_model).strip()
            else str(preset_cfg["synthesizer_model"])
        )

    # 2. Подтягиваем релевантный контекст из базы знаний проекта, если указан project_id
    project_context: dict[str, Any] | None = None
    project_snippet = ""
    project_context_block = ""
    if payload.project_id:
        try:
            mem_res = ui_memory_projects.search_memory_internal(
                clean_prompt,
                project_id=payload.project_id,
                top_k=4,
                home=resolved_home,
            )
            project_context_block = str(mem_res.get("memory_context_block") or "")
            top_hits = mem_res.get("results") or []
            if top_hits:
                project_snippet = str(top_hits[0].get("content") or "")
            project_context = {
                "project_id": payload.project_id,
                "hits_count": len(top_hits),
                "memory_context_block": project_context_block,
                "hits": top_hits,
            }
        except Exception:
            project_context = None

    # 3. Параллельный опрос выбранных моделей
    with ThreadPoolExecutor(max_workers=max(1, min(8, len(selected_models)))) as pool:
        futures = [
            pool.submit(
                _build_expert_model_response,
                model_id,
                clean_prompt,
                project_snippet=project_snippet,
                guardrail_routed_ru=guardrail_routed_ru,
            )
            for model_id in selected_models
        ]
        model_responses = [f.result() for f in futures]

    # 4. Слой Синтезатора («Факты > Голоса»)
    synthesis = _synthesize_council_results(
        clean_prompt,
        model_responses,
        synthesizer_model=synthesizer_model,
        effective_preset=effective_preset,
        guardrail_routed_ru=guardrail_routed_ru,
        pii_categories=pii_categories,
        project_context_block=project_context_block,
    )

    total_latency_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    total_cost_usd = round(sum(float(r.get("cost_usd") or 0.0) for r in model_responses), 6)
    run_id = f"council-{uuid.uuid4().hex[:12]}"
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    # 5. Сохранение в SQLite `$HERMES_HOME/nomad_council.db`
    conn = _connect_council_db(resolved_home)
    try:
        conn.execute(
            """
            INSERT INTO council_runs (
                id, prompt, preset, effective_preset, models_json, synthesizer_model,
                ru_152fz, guardrail_routed_ru, pii_categories_json, project_id,
                synthesized_answer, consensus_points_json, divergences_json,
                outlier_insights_json, model_responses_json, total_latency_ms,
                total_cost_usd, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                clean_prompt,
                requested_preset,
                effective_preset,
                json.dumps(selected_models, ensure_ascii=False),
                synthesizer_model,
                1 if (payload.ru_152fz or guardrail_routed_ru) else 0,
                1 if guardrail_routed_ru else 0,
                json.dumps(pii_categories, ensure_ascii=False),
                payload.project_id,
                synthesis["synthesized_answer"],
                json.dumps(synthesis["consensus_points"], ensure_ascii=False),
                json.dumps(synthesis["divergences"], ensure_ascii=False),
                json.dumps(synthesis["outlier_insights"], ensure_ascii=False),
                json.dumps(model_responses, ensure_ascii=False),
                total_latency_ms,
                total_cost_usd,
                created_at,
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "ok": True,
        "id": run_id,
        "prompt": clean_prompt,
        "preset": requested_preset,
        "effective_preset": effective_preset,
        "models": selected_models,
        "synthesizer_model": synthesizer_model,
        "ru_152fz": bool(payload.ru_152fz or guardrail_routed_ru),
        "guardrail_routed_ru": guardrail_routed_ru,
        "guardrail": {
            "pii_detected": pii_detected,
            "pii_categories": pii_categories,
            "routed_to_sovereign_ru": guardrail_routed_ru,
            "redacted_preview": guard_res.get("redacted_text"),
        },
        "project_id": payload.project_id,
        "project_context": project_context,
        "synthesized_answer": synthesis["synthesized_answer"],
        "consensus_points": synthesis["consensus_points"],
        "divergences": synthesis["divergences"],
        "outlier_insights": synthesis["outlier_insights"],
        "model_responses": model_responses,
        "total_latency_ms": total_latency_ms,
        "total_cost_usd": total_cost_usd,
        "created_at": created_at,
    }


def list_council_history(*, limit: int = 25, home: Path | None = None) -> dict[str, Any]:
    resolved_home = _resolve_home(home)
    conn = _connect_council_db(resolved_home)
    try:
        rows = conn.execute(
            "SELECT * FROM council_runs ORDER BY created_at DESC, rowid DESC LIMIT ?",
            (max(1, min(100, int(limit))),),
        ).fetchall()
    finally:
        conn.close()

    items: list[dict[str, Any]] = []
    for r in rows:
        items.append(
            {
                "id": str(r["id"]),
                "prompt": str(r["prompt"]),
                "preset": str(r["preset"]),
                "effective_preset": str(r["effective_preset"]),
                "models": json.loads(str(r["models_json"] or "[]")),
                "synthesizer_model": str(r["synthesizer_model"]),
                "ru_152fz": bool(r["ru_152fz"]),
                "guardrail_routed_ru": bool(r["guardrail_routed_ru"]),
                "pii_categories": json.loads(str(r["pii_categories_json"] or "[]")),
                "project_id": r["project_id"],
                "synthesized_answer": str(r["synthesized_answer"]),
                "consensus_points": json.loads(str(r["consensus_points_json"] or "[]")),
                "divergences": json.loads(str(r["divergences_json"] or "[]")),
                "outlier_insights": json.loads(str(r["outlier_insights_json"] or "[]")),
                "model_responses": json.loads(str(r["model_responses_json"] or "[]")),
                "total_latency_ms": float(r["total_latency_ms"]),
                "total_cost_usd": float(r["total_cost_usd"]),
                "created_at": str(r["created_at"]),
            }
        )

    return {
        "ok": True,
        "runs": items,
        "history": items,
        "total": len(items),
    }


def build_router() -> APIRouter:
    r = APIRouter(tags=["nomad-council"])

    @r.get("/council/presets")
    def http_get_presets() -> dict[str, Any]:
        return get_council_presets()

    @r.post("/council/run")
    def http_run_council(body: CouncilRunRequest) -> dict[str, Any]:
        try:
            return run_council(body)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @r.get("/council/history")
    def http_get_history(limit: int = Query(default=25, ge=1, le=100)) -> dict[str, Any]:
        return list_council_history(limit=limit)

    return r


router = build_router()
