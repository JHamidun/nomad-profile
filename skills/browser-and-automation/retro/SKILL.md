---
name: retro
description: "Facilitation ретроспективы с анализом и action items."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: browser-and-automation
    tags: [retro, python, docx]
    source: claude-code-config-pack
    origin: "command"
    argument_hint: "[sprint number / project name]"
requires_apps: [dormant]
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Facilitation ретроспективы с анализом и action items

# 🔄 Retrospective: текст, который пользователь написал вместе с вызовом навыка

Проведи ретроспективу для: **текст, который пользователь написал вместе с вызовом навыка**

## Структура:

### 1. Context & Data Gathering
Собери факты о спринте/проекте:
- **Timeline:** Основные события и вехи
- **Metrics:** Velocity, bugs, blockers, deployment frequency
- **Key Achievements:** Что успели сделать
- **Challenges:** С чем столкнулись

### 2. What Went Well ✅
Что сработало хорошо?
- Technical wins
- Process wins
- Team collaboration wins

### 3. What Didn't Go Well ⚠️
Что было сложно?
- Technical challenges
- Process bottlenecks
- Communication issues

### 4. Learnings & Insights 💡
Что узнали нового?

### 5. Action Items 🎯
**Конкретные действия:**
- What, Why, Who, When, How

### 6. Documentation
Создай retro document в Markdown; нужен .docx — собери через `python-docx` (пример: `skills/seo-machine-ru/scripts/build_report_docx.py`)

