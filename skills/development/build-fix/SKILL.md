---
name: build-fix
description: "Чинит падающую сборку и ошибки типов минимальными правками."
user_description: "Чинит упавшую сборку и ошибки типов — минимальными правками, пока прогон не станет зелёным. Нужен, когда проект перестал собираться, а разбираться в причине некогда."
user_description_i18n:
  ar: "يصلح البناء المتعطل وأخطاء الأنواع بأصغر تعديلات ممكنة، خطأً تلو الآخر، حتى يعود البناء إلى النجاح. مفيد عندما يتوقف المشروع عن التجميع ولا وقت لديك للبحث عن السبب."
  en: "Fixes a broken build and type errors with the smallest possible edits, one error at a time, until the build passes. Useful when the project has stopped compiling and there is no time to dig into why."
  es: "Arregla una compilación rota y los errores de tipos con cambios mínimos, un error cada vez, hasta que la build vuelva a pasar. Útil cuando el proyecto ha dejado de compilar y no hay tiempo para investigar la causa."
  fr: "Répare une compilation qui échoue et les erreurs de typage par des modifications minimales, une erreur à la fois, jusqu'à ce que le build repasse au vert. Utile quand le projet ne se compile plus et qu'on n'a pas le temps d'en chercher la cause."
  ja: "失敗したビルドと型エラーを、最小限の修正でひとつずつ直し、ビルドが通るまで続けます。プロジェクトが急にビルドできなくなったのに、原因を調べている時間がないときに役立ちます。"
  pt: "Conserta uma build quebrada e erros de tipos com as menores alterações possíveis, um erro por vez, até a build voltar a passar. Útil quando o projeto parou de compilar e não há tempo para investigar o motivo."
  zh: "用最小的改动逐个修复失败的构建和类型错误，直到构建重新通过。适用于项目突然无法编译、又没时间深究原因的情况。"
  zh-hant: "用最小的改動逐一修復失敗的建置和型別錯誤，直到建置重新通過。適用於專案突然無法編譯、又沒時間深究原因的情況。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: development
    tags: [build, fix, python, git]
    source: claude-code-config-pack
---
## Когда применять

Чинит падающую сборку и ошибки типов минимальными правками до зелёного прогона. Триггеры: «не собирается», «почини сборку», «tsc ругается».

# Build and Fix

Incrementally fix build and type errors with minimal, safe changes.

## Step 1: Detect Build System

Identify the project's build tool and run the build:

| Indicator | Build Command |
|-----------|---------------|
| `package.json` with `build` script | `npm run build` or `pnpm build` |
| `tsconfig.json` (TypeScript only) | `npx tsc --noEmit` |
| `Cargo.toml` | `cargo build 2>&1` |
| `pom.xml` | `mvn compile` |
| `build.gradle` | `./gradlew compileJava` |
| `go.mod` | `go build ./...` |
| `pyproject.toml` | `python -m compileall -q .` or `mypy .` |

## Step 2: Parse and Group Errors

1. Run the build command and capture stderr
2. Group errors by file path
3. Sort by dependency order (fix imports/types before logic errors)
4. Count total errors for progress tracking

## Step 3: Fix Loop (One Error at a Time)

For each error:

1. **Read the file** — Use read_file tool to see error context (10 lines around the error)
2. **Diagnose** — Identify root cause (missing import, wrong type, syntax error)
3. **Fix minimally** — Use patch tool for the smallest change that resolves the error
4. **Re-run build** — Verify the error is gone and no new errors introduced
5. **Move to next** — Continue with remaining errors

## Step 4: Guardrails

Stop and ask the user if:
- A fix introduces **more errors than it resolves**
- The **same error persists after 3 attempts** (likely a deeper issue)
- The fix requires **architectural changes** (not just a build fix)
- Build errors stem from **missing dependencies** (need `npm install`, `cargo add`, etc.)

## Step 4b: Rollback Anchor (capture BEFORE the first edit)

A build-fix run touches many files quickly. Capture a return point before the first Edit — not after the third failed attempt:

- [ ] `git status --short` — is the tree already dirty? Someone else's uncommitted work will get mixed into yours
- [ ] Dirty tree → `git stash push -u -m "pre-build-fix"` or commit a WIP snapshot. Clean tree → record `git rev-parse --short HEAD`
- [ ] Not a git repo → copy the files you are about to touch: `cp <file> <file>.bak-build-fix`
- [ ] State the revert trigger up front: "if total error count grows, or the same error survives 3 attempts, revert to the anchor and report"

Revert path: `git checkout -- <specific files>` or `git stash pop`. Never `git checkout -- .` — it discards every uncommitted change in the tree, including work unrelated to this build (the bash-guard blocks that form for exactly this reason).

## Step 5: Summary

Show results:
- Errors fixed (with file paths)
- Errors remaining (if any)
- New errors introduced (should be zero)
- Suggested next steps for unresolved issues

## Recovery Strategies

| Situation | Action |
|-----------|--------|
| Missing module/import | Check if package is installed; suggest install command |
| Type mismatch | Read both type definitions; fix the narrower type |
| Circular dependency | Identify cycle with import graph; suggest extraction |
| Version conflict | Check `package.json` / `Cargo.toml` for version constraints |
| Build tool misconfiguration | Read config file; compare with working defaults |

Fix one error at a time for safety. Prefer minimal diffs over refactoring.
