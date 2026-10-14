---
name: btw
description: "Отвечает на побочный вопрос парой фраз и сразу возвращает."
user_description: "Отвечает на побочный вопрос парой фраз и сразу возвращает вас к прерванной работе, не теряя её контекст. Нужен, когда посреди задачи всплыло «а кстати...», а уводить разговор в сторону и потом заново собирать нить не хочется."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: thinking-and-methodology
    tags: [btw]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Быстрый ответ на побочный вопрос — коротко и назад к основной задаче. Триггеры: «кстати», «/btw», «side question».

# BTW — Side Question

The user wants to ask a quick side question without derailing the main task.

## Rules

1. Answer the side question **briefly** (1-5 sentences max)
2. Do NOT lose context of the main task you were working on
3. After answering, **explicitly return** to what you were doing before
4. If the side question requires significant research, say so and suggest asking it as a separate task
5. Format: answer the question, then "Back to [main task]..." and continue

## Example

User: `/btw what's the default port for Redis?`
Assistant: 6379. Back to your task...
