---
name: review
description: "Comprehensive review of code or documents."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: browser-and-automation
    tags: [review]
    source: claude-code-config-pack
    origin: "command"
    argument_hint: "[file path or topic]"
requires_apps: [dormant]
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Comprehensive review of code or documents

# Review: текст, который пользователь написал вместе с вызовом навыка

Conduct thorough review with appropriate agents:

## For Documents (PRD, specs, etc.):
- @business-analyst: Requirements clarity and completeness
- @system-analyst: Technical feasibility
- @product-designer: UX considerations

## For Code:
- @code-reviewer: Code quality, standards, best practices
- @security-engineer: Security vulnerabilities
- @software-architect: Architecture compliance

## Review Checklist:

### Strengths
- What's done well
- Good practices observed

### Issues Found
- CRITICAL: Must fix before proceeding
- HIGH: Should fix soon
- MEDIUM: Nice to fix
- LOW: Minor improvements

### Suggestions
- How to improve
- Alternative approaches
- Best practices to follow

### Action Items
- Specific next steps
- Priority order
- Assigned to whom

Provide structured, actionable feedback.
