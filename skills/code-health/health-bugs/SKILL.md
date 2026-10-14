---
name: health-bugs
description: "Bug detection and fixing workflow (inline orchestration)."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: code-health
    tags: [health, bugs, claude]
    source: claude-code-config-pack
    origin: "command"
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Bug detection and fixing workflow (inline orchestration)

# Bug Health Check

Execute the `health-inline` skill (mode: bug) for inline orchestration.

**You ARE the orchestrator.** Do not spawn a separate orchestrator agent.

## Quick Start

1. Read `.hermes/skills/health-inline/SKILL.md` (mode table) + `.hermes/skills/health-inline/references/modes/bug.md` (full workflow)
2. Follow the workflow phases directly
3. Use delegate_task tool only for workers (bug-hunter, bug-fixer)
4. Run quality gates inline via Bash

## Workflow Summary

```
Pre-flight → Detect → [Fix by Priority] → Verify → Report
```

**Workers**: bug-hunter, bug-fixer
**Quality gates**: `pnpm type-check && pnpm build`
**Max iterations**: 3

---

Now read and execute the workflow: `.hermes/skills/health-inline/references/modes/bug.md`
