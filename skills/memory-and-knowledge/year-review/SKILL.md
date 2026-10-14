---
name: year-review
description: "Подводит итоги работы за период."
user_description: "Подводит итоги работы за период: сколько было сессий, каким проектам ушло больше всего внимания, какими инструментами вы пользовались чаще, что успели сделать и как менялись привычки. Нужен, когда хочется оглянуться на месяц или год и увидеть цифры, а не ощущения."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: memory-and-knowledge
    tags: [year, review, python, git, sql]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Разбор истории сессий за период: паттерны, продуктивность, инструменты. Триггеры: «итоги месяца», «итоги года». НЕ одна сессия → session-mentor.

# Year/Month Review — Work Analytics

Analyze session history to generate insights about work patterns.

## Data Sources

1. **Chat search DB**: `python ~/.hermes/ccpack/tools/search_chats.py` — SQLite FTS5 index of all sessions
2. **Session files**: `~/.hermes/sessions/*/` — JSONL transcript files
3. **Memory files**: `~/.hermes/memories/` — accumulated knowledge
4. **Git history**: `git log` in relevant repos

## Analysis Dimensions

1. **Volume**: sessions count, messages count, estimated tokens used
2. **Top Projects**: which directories/repos got most attention
3. **Tool Usage**: which tools/skills/agents used most frequently
4. **Patterns**: peak hours, average session length, common workflows
5. **Accomplishments**: major features shipped, bugs fixed, new tools configured
6. **Knowledge Growth**: new memory entries created, topics covered
7. **Agent Delegation**: how often and which agents delegated to
8. **Evolution**: how work patterns changed over the period

## Output Format

Generate a structured report with:
- Key stats (numbers)
- Top 5 accomplishments
- Most used tools/skills
- Patterns and trends
- Recommendations for improvement

Use the period specified by the user (default: last 30 days).
