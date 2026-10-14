---
name: health-deps
description: "Dependency audit and update workflow (inline orchestration)."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: code-health
    tags: [health, deps, claude]
    source: claude-code-config-pack
    origin: "command"
requires_apps: [dormant]
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Dependency audit and update workflow (inline orchestration)

# Dependency Health Check

Execute the `health-inline` skill (mode: deps) for inline orchestration.

**You ARE the orchestrator.** Do not spawn a separate orchestrator agent.

## Quick Start

1. Read `.hermes/skills/health-inline/SKILL.md` (mode table) + `.hermes/skills/health-inline/references/modes/deps.md` (full workflow)
2. Follow the workflow phases directly
3. Use delegate_task tool only for workers (dependency-auditor, dependency-updater)
4. Run quality gates inline via Bash

## Workflow Summary

```
Pre-flight → Audit → [Update by Priority] → Verify → Report
```

**Workers**: dependency-auditor, dependency-updater
**Quality gates**: `pnpm type-check && pnpm build`
**Max iterations**: 3

---

Now read and execute the workflow: `.hermes/skills/health-inline/references/modes/deps.md`
