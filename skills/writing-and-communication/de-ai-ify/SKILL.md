---
name: de-ai-ify
description: "Убирает из русского текста следы машинного письма."
user_description: "Убирает из русского текста следы машинного письма: штампы, канцелярит, безликие обороты. Нужен, когда текст технически верный, но читается как сгенерированный."
user_description_i18n:
  ar: "ينقّي النص الروسي من آثار الكتابة الآلية: العبارات المبتذلة واللغة البيروقراطية والصياغات الجامدة. مفيد عندما يكون النص الروسي صحيحًا من الناحية التقنية لكنه يُقرأ وكأنه مولَّد آليًا."
  en: "Cleans Russian text of the telltale signs of machine writing: clichés, bureaucratic phrasing and faceless turns of phrase. Useful when a Russian text is technically correct but reads as if it were generated."
  es: "Limpia un texto en ruso de las huellas de la escritura automática: clichés, lenguaje burocrático y giros impersonales. Útil cuando un texto en ruso es técnicamente correcto pero se lee como si estuviera generado."
  fr: "Nettoie un texte en russe des traces d'écriture automatique : clichés, jargon administratif, tournures impersonnelles. Utile quand un texte russe est techniquement correct mais se lit comme s'il avait été généré."
  ja: "ロシア語の文章から機械的な書き味を取り除きます。決まり文句やお役所的な言い回し、無個性な表現を直します。内容は正しいのに、生成された文章のように読めてしまうロシア語テキストに役立ちます。"
  pt: "Limpa um texto em russo dos sinais de escrita automática: clichês, linguagem burocrática e frases impessoais. Útil quando um texto em russo está tecnicamente correto, mas parece gerado por máquina."
  zh: "清除俄语文本中的机器写作痕迹：套话、公文腔和缺乏个性的表达。适合俄语文本内容准确、但读起来像是自动生成的情况。"
  zh-hant: "清除俄語文本中的機器寫作痕跡：套話、公文腔和缺乏個性的表達。適合俄語文本內容準確、但讀起來像是自動生成的情況。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: writing-and-communication
    tags: [ify]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

КАНОН чистки русских текстов от ИИ-клише и жаргона. Триггеры: «звучит как ИИ», «перепиши по-человечески». EN/LinkedIn → linkedin-humanizer.

# De-AI-ify: Remove AI Jargon

**Очисти текст от ИИ-клише и сделай его человечным.**

> **Разграничение:** этот скилл — КАНОН для русских текстов на любых площадках. Для английских LinkedIn-постов — `linkedin-humanizer` (tier-система forensic/strict/aesthetic, AI-детекторы, emoji-паттерны).

## RU-применимые техники из linkedin-humanizer (используй вместе с таблицами ниже)

Языконезависимые приёмы, проверяй и в русских текстах:

1. **Forensic-маркеры утечки модели** — `oaicite`, `contentReference`, `turn0search`, «по состоянию на момент моего последнего обновления», Mad-Libs-заглушки `[Опишите X]`, `[Ваше имя]` → удалять всегда.
2. **Негативный параллелизм** (жёсткий AI-tell и в RU): «Это не X, это Y», «Дело не в X, а в Y», «Вопрос не в том…, а в том…» → переписать прямыми утверждениями.
3. **Burstiness** — если все предложения по 15–22 слова, разбей минимум каждое третье на короткое (<8 слов); добавь фрагмент («Работает.», «Каждый раз.»).
4. **Human fingerprints** — конкретное число вместо «многие/значительно», именованная сущность (человек, компания, дата, город), самокоррекция/уязвимость. Чего нет в исходнике — НЕ выдумывать, спросить у автора.
5. **Передоз тире** — 3+ тире на короткий текст → часть в запятые/точки (в RU тире родное, но частота выдаёт).

Полные regex-паттерны и обоснования по ярусам — `linkedin-humanizer/references/{scrub-rules,tier-rationale}.md`.

## Процесс

### Step 0: Калибровка голоса (опционально, если есть образцы)

Если автор дал 2-3 своих текста — сначала прочитай их и зафиксируй: типичная длина предложений и ритм (burstiness), любимые слова/обороты, пунктуационные привычки, уровень формальности, фирменные «квирки». Дальше переписывай ПОД этот голос, а не в усреднённый нейтральный стиль. Нет образцов → пропусти, чисти в нейтральный человеческий.

### Step 1: Найди AI-жаргон

Сканируй текст на наличие следующих категорий. **Полная таксономия 33 паттернов** (содержание/язык/стиль/коммуникация/филлеры, на базе Wikipedia «Signs of AI writing», RU-адаптировано) — `references/ai-writing-patterns.md`; в первую очередь ⭐-паттерны: негативный параллелизм, правило трёх, сигнпостинг, равномерный burstiness.

**Buzzwords (заменить на простые слова):**
| AI-клише | Замена |
|----------|--------|
| leverage | use, apply |
| utilize | use |
| streamline | simplify, speed up |
| harness | use, apply |
| synergy | cooperation, teamwork |
| paradigm shift | major change |
| cutting-edge | modern, new |
| game-changer | important improvement |
| delve into | look at, explore |
| navigate | handle, manage |
| robust | strong, reliable |
| scalable | expandable |
| holistic | complete, full |
| empower | enable, help |
| optimize | improve |
| innovative | new, creative |
| seamless | smooth |
| transformative | significant |
| ecosystem | system, environment |
| actionable | practical, useful |

**Фразы-паразиты (удалить или упростить):**
- "In today's rapidly evolving landscape..."
- "It's important to note that..."
- "At the end of the day..."
- "Moving forward..."
- "In terms of..."
- "With that being said..."
- "It goes without saying..."
- "Needless to say..."
- "As a matter of fact..."
- "By and large..."

**Русские AI-клише:**
| Клише | Замена |
|-------|--------|
| в современном мире | сейчас |
| на сегодняшний день | сейчас |
| данный | этот |
| является | — (тире) |
| осуществлять | делать |
| в рамках | в, при |
| представляет собой | это |
| обеспечивает | даёт, позволяет |
| функционал | функции |
| имплементация | внедрение, реализация |

### Step 2: Проверь структуру

- Убери избыточные заголовки
- Сократи lists до сути
- Убери "водянистые" абзацы без информации
- Проверь: каждое предложение несёт смысл?

### Step 3: Проверь тон

- Звучит как живой человек, а не маркетинговый бот?
- Нет ли повторяющихся конструкций?
- Длина предложений варьируется?
- Есть конкретика вместо абстракций?

### Step 4: Выведи результат

```
## De-AI-ify Report

**Найдено клише:** X
**Заменено:** Y
**Удалено фраз:** Z

### Очищенный текст:
[cleaned text]

### Изменения:
1. "leverage" → "use" (строка N)
2. ...
```

### Step 5: Второй проход (обязательно) — «явно ИИ?»-аудит

Однопроходная чистка оставляет следы. После Step 1-4 перечитай СВЕЖИМ взглядом и спроси: «Если бы это прислал незнакомый человек — я бы заподозрил ИИ?» Пройди по ⭐-паттернам таксономии ещё раз (негативный параллелизм, триады, сигнпостинг, ровный ритм — они возвращаются исподволь). Нашёл остаток → перепиши ещё раз. Гейт: во втором проходе не должно всплывать НИ ОДНОГО сильного tell'а. Только тогда выдавай.

## Примеры

**До:**
> We leverage cutting-edge AI to streamline your workflow, delivering a seamless and transformative experience that empowers teams to navigate complex challenges in today's rapidly evolving landscape.

**После:**
> We use modern AI to simplify your work. Teams handle complex tasks faster.

**До (русский):**
> На сегодняшний день наше решение представляет собой инновационную платформу, которая осуществляет комплексный подход к оптимизации бизнес-процессов в рамках цифровой трансформации.

**После:**
> Наша платформа упрощает бизнес-процессы и помогает перейти на цифровые инструменты.
