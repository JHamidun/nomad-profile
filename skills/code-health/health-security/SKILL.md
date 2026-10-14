---
name: health-security
description: "Security vulnerability detection and remediation workflow."
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: code-health
    tags: [health, security, claude]
    source: claude-code-config-pack
    origin: "command"
---
> **Аргументы.** Всё, что пользователь написал в одном сообщении с вызовом
> этого навыка, — и есть его аргумент. Если аргумента нет, спроси одним
> вопросом через `clarify` и работай дальше.

## Когда применять

Security vulnerability detection and remediation workflow (inline orchestration)

# Security Health Check

Execute the `health-inline` skill (mode: security) for inline orchestration.

**You ARE the orchestrator.** Do not spawn a separate orchestrator agent.

## Quick Start

1. Read `.hermes/skills/health-inline/SKILL.md` (mode table) + `.hermes/skills/health-inline/references/modes/security.md` (full workflow)
2. Follow the workflow phases directly
3. Use delegate_task tool only for workers (security-scanner, vulnerability-fixer)
4. Run quality gates inline via Bash

## Workflow Summary

```
Pre-flight → Detect → [Fix by Priority] → Verify → Report
```

**Workers**: security-scanner, vulnerability-fixer
**Quality gates**: `pnpm type-check && pnpm build`
**Max iterations**: 3

---

Now read and execute the workflow: `.hermes/skills/health-inline/references/modes/security.md`
