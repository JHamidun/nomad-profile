---
name: codegraph
description: "Строит карту вызовов в проекте и показывает."
user_description: "Строит карту вызовов в проекте и показывает, что сломается от правки. Нужен перед изменением незнакомого кода: отвечает на «кто это вызывает» и «кого заденет»."
user_description_i18n:
  ar: "يبني خريطة الاستدعاءات في المشروع ويُظهر ما الذي سيتعطل إذا غيّرت شيئًا. مفيد قبل تعديل شيفرة غير مألوفة: يجيب عن \"من يستدعي هذا\" و\"ما الذي سيتأثر أيضًا\"."
  en: "Builds a call map of the project and shows what will break if you change something. Useful before touching unfamiliar code: it answers \"who calls this\" and \"what else will be affected\"."
  es: "Construye el mapa de llamadas del proyecto y muestra qué se romperá si cambias algo. Útil antes de tocar código desconocido: responde a \"quién llama a esto\" y \"a qué más afectará\"."
  fr: "Construit la carte des appels du projet et montre ce qui cassera si vous modifiez quelque chose. Utile avant de toucher à du code inconnu : il répond à « qui appelle ceci » et « qu'est-ce qui sera touché »."
  ja: "プロジェクトの呼び出しマップを作り、変更によって何が壊れるかを示します。見慣れないコードを修正する前に役立ちます。「これを呼んでいるのは誰か」「ほかにどこに影響するか」に答えてくれます。"
  pt: "Constrói o mapa de chamadas do projeto e mostra o que vai quebrar se você mudar algo. Útil antes de mexer em código desconhecido: responde \"quem chama isto\" e \"o que mais será afetado\"."
  zh: "为项目构建调用关系图，并显示改动会破坏哪些地方。适合在修改不熟悉的代码之前使用：它能回答\"谁调用了这个\"和\"还会影响到谁\"。"
  zh-hant: "為專案建立呼叫關係圖，並顯示改動會破壞哪些地方。適合在修改不熟悉的程式碼之前使用：它能回答「誰呼叫了這個」和「還會影響到誰」。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: development
    tags: [codegraph, python, node, git, pdf, sql, claude]
    source: claude-code-config-pack
---
## Когда применять

Граф кода: навигация и impact-анализ кодбазы (CLI codegraph). Триггеры: «кто вызывает», «что затронет изменение», «трейс вызовов», «blast-radius». НЕ правка кода.

# codegraph — граф кода для навигации и impact-анализа

Инструмент: **@colbymchenry/codegraph** (публичный npm, с паком не едет — ставится глобально: `npm i -g @colbymchenry/codegraph`). Хранит граф символов/вызовов в `.codegraph/codegraph.db` (SQLite) внутри папки каждого проекта. Индексирует TS/JS(ESM)/Python/PHP/Vue и др. (30+ языков; НЕ Dart, НЕ .sh/.json/.md/.html).

Всё описанное ниже снято на **1.4.1** — гочи вроде «не резолвит `@/*` path-alias» привязаны к версии, на свежей проверяй заново (`codegraph --version`).

## Как ЗАПРОСИТЬ граф (работает из ЛЮБОЙ сессии)

MCP у каждого проекта **project-scoped** (`.mcp.json` в папке графа) — авто-подхватывается ТОЛЬКО если сессия Claude Code запущена с этой папкой как cwd. Из основной сессии — **используй CLI** (читает `.codegraph` из cwd):

```bash
cd <папка-проекта-с-графом>       # перейти в папку, где лежит .codegraph
codegraph callers <symbol>     # кто вызывает функцию/метод (точные file:line, без grep-шума)
codegraph callees <symbol>     # что вызывает данный символ (трейс пайплайна)
codegraph impact <symbol>      # blast-radius: ВСЕ транзитивно затронутые изменением символы
codegraph explore <query...>   # область: релевантные символы + исходники + call paths одним вызовом
codegraph node <name>          # один символ: исходник + caller/callee-трейл (или файл с зависимыми)
codegraph query <search>       # поиск символа по имени
codegraph status               # статистика графа (узлы/рёбра/языки)
codegraph files                # структура файлов из индекса
```

Запросы **на английском** (символы/имена как в коде). Пример: «кто вызывает getUser в сервисе auth» → `cd <папка> && codegraph callers getUser`.

## Когда граф, когда grep
- **Граф**: «кто вызывает / что сломается если поменять / трейс вызовов / зависимости / где определён» — точно, транзитивно, без шума (def/импорты/логи/.bak grep тащит, граф — нет).
- **grep**: строковый поиск в .sh/.json/.md/.env/конфигах (граф их не индексит); символы через tsconfig `@/*`-alias (codegraph не резолвит alias); маршруты фреймворков вроде Lumen (`routes/web.php`=0 символов); CommonJS `require` (слабо — call-вопросы grep'ом).

## Статичная карта репо: ARCHITECTURE.md (комплемент графу)
Граф отвечает «кто вызывает X / blast-radius» (динамика). Для durable-карты «что за система, границы, стек, потоки, риски», которую свежий агент/человек читает ПЕРВОЙ — держи `ARCHITECTURE.md` в корне крупного репо. Канонический 10+4-секционный скелет + анти-галлюцинационные правила заполнения + поток генерации через `codegraph explore/status` → **references/architecture-md-template.md**.

## Организация графов нескольких проектов
Удобно держать графы всех проектов в одной папке-хабе (напр. `~/graphs/<project-name>/`), а не внутри исходников. Тогда `.codegraph` не мусорит в рабочих репозиториях, а `ls ~/graphs/` даёт быструю карту «какие проекты проиндексированы». Для in-place-графа (в самой папке кода) — просто `codegraph init` из корня репо.

## Ре-синк (код проекта изменился)
Граф — снапшот. Перед работой обнови исходники в папке графа (напр. `git pull` или `tar`-стрим с сервера) → `codegraph sync` (не re-init; mtime сохраняются). Если файл ломает checkout — полный `codegraph index`, не sync.

**Стандартный exclude при переносе исходников** (иначе граф распухает на чужом коде и генерёнке): `node_modules` `vendor` `.git` `dist` `build` `.next` `__pycache__` `.venv` `venv` `coverage` `*.min.js` `logs` `backups*` `*.db` `*.bak*` и бинарь (png/jpg/pdf/zip). Тащить `tar` **явным списком код-каталогов**, а не `. --exclude=…`: на медленном диске корневой `node_modules` статится бесконечно. На MSYS/Windows — `tar --force-local` (иначе `C:` читается как имя хоста), а ADS-файлы `:Zone.Identifier` ломают checkout — `git rm --cached` их.

## Построить НОВЫЙ граф (проект без графа)
`cd <папка-кода>` → `git init -q` (нужен git-репо; проверь, что родительский `.gitignore` не глушит `scripts/` кейс-инсенситивно → 0 files) → `codegraph init`. Проверь `codegraph status` — если property-узлов 10k+ (сгенерированный код `generated/` / бандлы) → удали bloat-каталоги локально + `codegraph index`. Прерванный init (корраптный `.db-wal`) → `rm -rf .codegraph` + заново. Для прод Node-контейнера индексируй ИСХОДНИК на хосте, не компилят в контейнере.

## Обогащение смыслом (опционально, по запросу)
Граф даёт СТРУКТУРУ (символы/вызовы), но не знает, что код ДЕЛАЕТ и какой бизнес-процесс закрывает. Для вопросов «объясни архитектуру / онбординг / какой код за процесс Y» — доложить LLM-семантический слой поверх графа (node summaries · слои API/Service/Data/UI/Utility · domain→flow→step · guided tour), инкрементально, кэш в `.codegraph/enrichment.json`. Рецепт → references/llm-semantic-enrichment.md. Для «кто вызывает / трейс / impact» это НЕ нужно — чистый CLI выше.

## Kill-switch
`codegraph uninit <dir>` + удалить `.mcp.json`. Демонов не остаётся (`codegraph daemons` проверить/погасить).
