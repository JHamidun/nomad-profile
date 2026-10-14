---
name: graph-memory
description: "Связывает то, что вы делали раньше, в единую картину."
user_description: "Связывает то, что вы делали раньше, в единую картину: проекты, людей, решения и их даты. Нужен, чтобы спросить «что мы решали про это» и получить ответ."
user_description_i18n:
  ar: "يربط كل ما فعلته سابقًا في صورة واحدة مترابطة: المشاريع والأشخاص والقرارات وتواريخها. تحتاجه لتسأل «ماذا قررنا بشأن هذا» وتحصل على إجابة فعلية."
  en: "Links everything you have done before into one connected picture: projects, people, decisions and when they happened. Use it to ask \"what did we decide about this\" and actually get an answer."
  es: "Conecta todo lo que hiciste antes en un solo panorama: proyectos, personas, decisiones y sus fechas. Útil para preguntar «qué decidimos sobre esto» y obtener una respuesta de verdad."
  fr: "Relie tout ce que vous avez fait auparavant en une seule vue d'ensemble : projets, personnes, décisions et leurs dates. Utile pour demander « qu'a-t-on décidé à ce sujet » et obtenir une vraie réponse."
  ja: "これまでにやってきたことを、プロジェクト、人、決定とその日付でつなぎ、一枚の全体像にまとめます。「この件はどう決めたっけ」と聞いて、ちゃんと答えが返ってくるようにするためのものです。"
  pt: "Conecta tudo o que você fez antes em um único panorama: projetos, pessoas, decisões e suas datas. Útil para perguntar “o que decidimos sobre isso” e realmente obter uma resposta."
  zh: "把你以前做过的事串成一幅完整的图景：项目、人物、决定及其日期。用它来问“我们当时对这件事是怎么决定的”，并真正得到答案。"
  zh-hant: "把你以前做過的事串成一幅完整的圖景：專案、人物、決定及其日期。用它來問「我們當時對這件事是怎麼決定的」，並真正得到答案。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: memory-and-knowledge
    tags: [graph, memory, python, node, sql]
    source: claude-code-config-pack
---
## Когда применять

Локальный граф твоей памяти (SQLite, офлайн): соседи, пути, хронология, хабы, разрывы. Триггеры: «что связано с», «хронология проекта», «мои сессии по проекту», «висячие ссылки в памяти». НЕ: уборка→dream; запись→memory-agent; поиск фразы→search_chats.py.

# Graph Memory — локальный граф знаний (offline)

Запрашиваемый граф поверх твоей памяти. Ноль сети, ноль туннелей — один Python-скрипт
и один SQLite-файл. Отвечает на многохоповые вопросы («кто/что/как связано с X»,
«хронология», «мои кейсы по проекту»), которые линейный поиск по заметкам не тянет.

**Два пути, один движок:**

- **MCP-инструменты** `graph_build`, `graph_stats`, `graph_neighbors`, `graph_path`,
  `graph_timeline`, `graph_hubs`, `graph_orphans`, `graph_search`, `graph_cases`,
  `graph_dangling`, `graph_gaps` — сервер `graph-memory` включён в `settings.json` по умолчанию.
- **CLI** — то же самое из терминала:
  `python ~/.hermes/ccpack/scripts/memory_graph.py {build|stats|neighbors|path|timeline|hubs|orphans|search|dangling|cases|gaps} [args]`

**Хранилище:** `~/.hermes/ccpack/memory-graph/graph.db` (SQLite). Размер бери из `stats`, не хардкодь.
**Актуальность:** снимок на момент последнего `build` (обычно прогоняется в `dream`).

## Первый запуск — база едет пустой

Граф собирается из **твоих** заметок; вместе с паком не приезжает ничего, кроме движка.
Пока ты не написал ни одной заметки, любая команда честно вернёт ноль — это не поломка.

```bash
# 1. Заметки живут здесь. Каталог создаётся при первой записи через memory-agent.
ls ~/.hermes/memories/*.md          # пусто — значит писать ещё нечего

# 2. Собрать граф (создаст ~/.hermes/ccpack/memory-graph/graph.db)
python ~/.hermes/ccpack/scripts/memory_graph.py build

# 3. Убедиться, что он видит заметки
python ~/.hermes/ccpack/scripts/memory_graph.py stats
```

`nodes=0` после `build` при непустой папке заметок — смотри, есть ли у файлов frontmatter
`name`/`type` и `[[wikilinks]]`: узлы и рёбра берутся оттуда.

## Когда использовать

- Вопрос о ПРОШЛОМ: решения, грабли, статусы проектов, «что мы делали с X», «с кем работал над Y».
- Нужна связь через несколько шагов: «как связаны A и B», путь между сущностями.
- Хронология замен/решений: «что заместило старую заметку», «timeline проекта».
- Обзорные: топ-хабы памяти, орфаны (несвязанные заметки), висячие ссылки (кандидаты на новую заметку).
- Каталог кейсов: «покажи мои сессии по проекту X» (если у тебя собран Layer 2, см. ниже).

Для полнотекстового поиска по сырым чатам — `~/.hermes/ccpack/tools/search_chats.py` (другой
инструмент). Граф отвечает на структурные и связевые вопросы, не на «найди фразу».

> **Граница с `memory-agent`, `save-knowledge-base`, `dream` — все четыре про одну память.**
> Этот навык **только читает**: он не пишет ни одной заметки и не меняет ни одного файла
> (кроме `build`, который пересобирает снимок). Поэтому любая просьба «запомни» сюда не
> попадает: готовый документ с названными триггерами → `save-knowledge-base`, наблюдение
> без явного места → `memory-agent` (он выберет слой). Прибраться в уже записанном → `dream`;
> он же обычно и прогоняет `build`, так что свежесть графа — его работа, не твоя. Правило:
> **вопрос про СВЯЗИ и хронологию → сюда; «найди фразу» → `search_chats.py`; любое
> «запомни» → `save-knowledge-base`/`memory-agent`.**

## Что внутри графа (модель данных)

Две склеенные схемы в одной БД.

**Layer 1 — курированные заметки** (`~/.hermes/memories/*.md`) — работает
сразу, ничего настраивать не нужно:

- Узел = заметка. `id` = frontmatter `name` или имя файла. Тип из frontmatter `type`:
  `user` / `feedback` / `project` / `reference` / `memory`.
- Рёбра: `[[wikilinks]]` → `rel=link`; frontmatter `supersedes`/`superseded_by` →
  `rel=supersedes` (bi-temporal: факт не удаляем, а замещаем).

**Layer 2 — кейсбук из истории чатов** (`~/_casebook/`) — **опционально**. Пака он не
касается: движок ищет каталог, не находит и молча собирает граф из одного Layer 1.
Если ты выгружаешь свои сессии в такой формат сам, схема ожидается такая:

- Узлы-сущности с префиксами: `case:<session_id>` (сессия-кейс), `proj:<name>`,
  `person:<Имя>`, `company:<X>`, `tool:<Y>`.
- Рёбра: `involves` (case→person), `for_company` (case→company), `uses` (case→tool),
  `in_project` / `in_cluster` (case→proj).
- Файлы: `all_cards_v2.json` и/или `cards_db/*.json`, сущности `entities_v1/*.json`,
  кластеры `clusters.json`, канон-карты имён `canon/*_map.json`.
- L1↔L2 мост: `about` — заметка → `proj:` по дистинктивному ключу в имени-слаге.

Имена сущностей нормализуются канон-картами (вариант→канон), поэтому «Alexander Smith»
и «Александр Смирнов» схлопываются в один узел — **при условии**, что маппинг в карте есть.

## Команды

| Команда | Что делает |
|---------|-----------|
| `stats` | Узлы/рёбра, разбивка по типам и rel, orphans, dangling. **Всегда отсюда бери свежие цифры.** |
| `search <substr>` | Узлы по подстроке имени или заголовка (до 40). Первый шаг: найти точное имя узла. |
| `neighbors <name> [depth]` | Соседи узла на глубину depth (по умолч. 1). Помечает цели без заметки. |
| `path <a> <b>` | Кратчайший путь между двумя узлами (BFS, ненаправленный). |
| `timeline <name>` | Цепочка `supersedes`: что узел заместил и кем замещён (bi-temporal история). |
| `cases <substr>` | Кейсы (сессии) по проекту/подстроке — каталог «мои сессии по X» (нужен Layer 2). |
| `hubs [N]` | Топ-N самых связанных узлов (центры тяжести памяти). |
| `orphans` | Узлы без единого ребра — не вплетены в граф. |
| `dangling` | `[[ссылки]]` на несуществующие узлы — кандидаты завести заметку. |
| `gaps [stale_days]` | Gap-анализ (0 LLM): orphans + dangling + stale-hubs + superseded-unmarked. Порог устаревания по умолч. 45 дней. |
| `build` | Пересобрать граф из заметок (+ кейсбука, если есть). Прогоняется в `dream`; вручную — после крупной правки памяти. |

Имена узлов часто содержат пробелы, кириллицу и префиксы (`proj:`, `person:`) — оборачивай в кавычки:
`python ~/.hermes/ccpack/scripts/memory_graph.py neighbors "person:Мария Иванова" 2`

## Процедура (типовой запрос)

1. **Найди узел.** Точного имени обычно не знаешь → `search <подстрока>`. Возьми `name` из вывода.
2. **Выбери обход** под вопрос:
   - «что связано / кто рядом» → `neighbors <name> [depth]` (depth 2 для второго кольца).
   - «как связаны A и B» → `path <A> <B>`.
   - «что заместило / хронология» → `timeline <name>`.
   - «мои сессии по проекту» → `cases <project>`.
   - «центры / что забыто» → `hubs`, `orphans`, `dangling`, `gaps`.
3. **Синтезируй** — прочитай реальные заметки и кейсы по путям, не пересказывай сам граф.
   Файл заметки лежит в колонке `file` таблицы nodes; кейс — по `jsonl_path`.
4. **Применяй невидимо** — как собственный опыт, без «судя по графу памяти»
   (если не спросили источник).

## Выход

Скрипт печатает plain-text в stdout (UTF-8, форсится под Windows-консоль). Примеры формата:

- `neighbors`: `d1 <src> --<rel>--> <dst>` (плюс `(нет заметки)` для висячих целей).
- `path`: `A -> X -> B` или `нет пути A .. B`.
- `stats`: `nodes=… edges=…`, затем словари `by type` / `by rel`.

## Пример

Подставь свои имена — граф знает только то, что ты в него записал.

```bash
# 1. найти узел
python ~/.hermes/ccpack/scripts/memory_graph.py search MyProject
#   proj:MyProject  -- MyProject
#   case:...        -- 2026-06-… [MyProject] …

# 2. второе кольцо связей проекта
python ~/.hermes/ccpack/scripts/memory_graph.py neighbors "proj:MyProject" 2

# 3. как связаны компания и проект
python ~/.hermes/ccpack/scripts/memory_graph.py path "company:SomeCorp" "proj:MyProject"

# 4. все мои сессии по проекту
python ~/.hermes/ccpack/scripts/memory_graph.py cases MyProject

# 5. что память НЕ знает / где дыры
python ~/.hermes/ccpack/scripts/memory_graph.py gaps 30
```

## Чек-лист

- [ ] Сначала `search` → взял точное `name`, а не угадал.
- [ ] Имена с пробелами/префиксом/кириллицей — в кавычках.
- [ ] Цифры (узлы/типы) — из `stats`, не по памяти и не из этого файла.
- [ ] Прочитал реальные заметки и кейсы по найденным путям перед ответом.
- [ ] Чувствительное (семья, финансы, здоровье, конфликты) первым не поднимал, пока
      владелец памяти сам не затронул тему.
- [ ] После крупной правки памяти или если граф выглядит устаревшим — `build`
      (обычно это делает `dream`).

## Файлы

- `~/.hermes/ccpack/scripts/memory_graph.py` — единственный движок (build + все запросы).
- `~/.hermes/ccpack/mcps/graph-memory/server.py` — тонкая MCP-обёртка над тем же движком.
- `~/.hermes/ccpack/memory-graph/graph.db` — SQLite-снимок (nodes, edges). Создаётся первым `build`.
- `~/.hermes/memories/*.md` — источник Layer 1 (заметки).
- `~/_casebook/` — источник Layer 2, опционально (см. выше).
- `references/gbrain-typed-edges-gap-analysis.md` — откуда взялся `gaps` и что решили не тянуть.

## Известные ограничения (honest)

- **Снимок, не live.** Граф отражает состояние на момент последнего `build`. Свежие заметки
  появятся в нём только после пересборки.
- **База приезжает пустой.** Первые дни граф будет отвечать «ничего не найдено» — это
  нормально, ему нечего показывать, пока нет заметок.
- **Нормализация имён неполна.** Схлопывание вариантов работает лишь для того, что есть
  в канон-картах; незамапленные варианты остаются отдельными узлами.
- **`path` ненаправленный.** BFS игнорирует направление и тип ребра — путь может проходить
  через слабую связь `about`/`link`.
- **Layer 2 никто за тебя не соберёт.** Без `~/_casebook/` команда `cases` вернёт пусто,
  остальные работают.
- **Инкрементальных апдейтов нет** — только полная пересборка `build`.
