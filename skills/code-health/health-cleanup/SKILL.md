---
name: health-cleanup
description: "Dead code detection and cleanup workflow (inline."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: code-health
    tags: [health, cleanup, claude]
    source: claude-code-config-pack
    origin: "command"
requires_apps: [dormant]
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Dead code detection and cleanup workflow (inline orchestration)

# Cleanup Health Check

Execute the `health-inline` skill (mode: cleanup) for inline orchestration.

**You ARE the orchestrator.** Do not spawn a separate orchestrator agent.

## Quick Start

1. Read `.hermes/skills/health-inline/SKILL.md` (mode table) + `.hermes/skills/health-inline/references/modes/cleanup.md` (full workflow)
2. Follow the workflow phases directly
3. Use delegate_task tool only for workers (dead-code-hunter, dead-code-remover)
4. Run quality gates inline via Bash

## Workflow Summary

```
Pre-flight → Detect → [Remove by Priority] → Verify → Report
```

**Workers**: dead-code-hunter, dead-code-remover
**Quality gates**: `pnpm type-check && pnpm build`
**Max iterations**: 3

---

Now read and execute the workflow: `.hermes/skills/health-inline/references/modes/cleanup.md`
