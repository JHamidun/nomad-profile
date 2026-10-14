---
name: thinking-frameworks
description: "Структурные фреймворки анализа и решений."
user_description: "Даёт структуру для сложного решения: разбор до основ, предварительный разбор провала, пошаговое улучшение. Нужен, когда вариантов много и непонятно, с чего начать."
user_description_i18n:
  ar: "يمنح قرارًا صعبًا بنية واضحة: تفكيك المشكلة إلى أساسياتها، تخيّل الفشل مسبقًا، التحسين خطوة بخطوة. مفيد عندما تكثر الخيارات ولا يتضح من أين تبدأ."
  en: "Gives structure to a hard decision: breaking the problem down to first principles, imagining the failure in advance, improving step by step. Useful when there are many options and it is unclear where to start."
  es: "Da estructura a una decisión difícil: descomponer el problema hasta sus fundamentos, imaginar el fracaso por adelantado, mejorar paso a paso. Útil cuando hay muchas opciones y no está claro por dónde empezar."
  fr: "Donne une structure à une décision difficile : décomposition jusqu'aux principes de base, analyse anticipée de l'échec, amélioration pas à pas. Utile quand les options sont nombreuses et qu'on ne sait pas par où commencer."
  ja: "難しい判断に枠組みを与えます。問題を根本まで分解する、失敗を先に想定する、一歩ずつ改善する。選択肢が多くて何から手をつければよいか分からないときに役立ちます。"
  pt: "Dá estrutura a uma decisão difícil: decompor o problema até os fundamentos, imaginar o fracasso de antemão, melhorar passo a passo. Útil quando há muitas opções e não está claro por onde começar."
  zh: "为复杂的决策提供思考框架：拆解到最基本的原理、预先推演失败的原因、逐步改进。适合选项很多、却不知从何下手的时候。"
  zh-hant: "為複雜的決策提供思考框架：拆解到最基本的原理、預先推演失敗的原因、逐步改進。適合選項很多、卻不知從何下手的時候。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: thinking-and-methodology
    tags: [thinking, frameworks]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Структурные фреймворки анализа и решений: first principles, pre-mortem, kaizen/PDCA. Триггеры: «фреймворк», «кайдзен», «улучшение процессов».

# Thinking Frameworks

Apply structured analytical frameworks to any problem. Pick the most relevant framework(s) or let the user choose.

## Available Frameworks

### 1. First Principles Thinking
Break down to fundamental truths, then rebuild.

```
1. IDENTIFY the problem/assumption
2. BREAK DOWN to basic truths (what do we KNOW for certain?)
3. CHALLENGE each assumption — "Why do we believe this?"
4. REBUILD from scratch — what solution emerges from fundamentals?
```

### 2. Inversion
Think backwards from failure.

```
1. STATE the goal
2. INVERT — "How could this FAIL spectacularly?"
3. LIST all failure modes
4. FLIP each failure into a prevention strategy
```

### 3. Pre-mortem Analysis
Imagine the project already failed. Why?

```
1. "It's 6 months from now. The project FAILED."
2. Write down WHY it failed (independently, without bias)
3. COLLECT all failure reasons
4. PRIORITIZE by likelihood x impact
5. CREATE mitigation plan for top risks
```

### 4. Second-Order Effects
Think beyond immediate consequences.

```
1. STATE the decision/action
2. FIRST ORDER — What happens immediately?
3. SECOND ORDER — What does that cause?
4. THIRD ORDER — And then what?
5. MAP positive and negative cascades
```

### 5. 5 Whys (Root Cause Analysis)
Dig to the real cause.

```
1. STATE the problem
2. WHY did this happen? -> Answer 1
3. WHY Answer 1? -> Answer 2
4. WHY Answer 2? -> Answer 3
5. WHY Answer 3? -> Answer 4
6. WHY Answer 4? -> ROOT CAUSE
7. FIX the root cause, not the symptoms
```

Расширенный шаблон + разобранный пример → `references/kaizen.md` (секция 5 Whys Analysis). Это единственный канон шагов; вторую версию не плодить.

### 6. Eisenhower Matrix
Prioritize by urgency x importance.

```
         | URGENT        | NOT URGENT     |
---------|---------------|----------------|
IMPORTANT| DO NOW        | SCHEDULE       |
         | (crisis,      | (planning,     |
         |  deadlines)   |  growth)       |
---------|---------------|----------------|
NOT      | DELEGATE      | ELIMINATE      |
IMPORTANT| (interrupts,  | (time wasters, |
         |  some emails) |  busywork)     |
```

### 7. Kaizen / PDCA (Continuous Improvement)
Маленькие инкрементальные улучшения процесса: PLAN → DO → CHECK → ACT; устранение 7 типов waste (muda); Gemba — наблюдай процесс на месте; закрепляй успех стандартизацией.
Полное тело (Kaizen Event, Value Stream Mapping, Gemba Walk, A3 Report, Daily Kaizen, метрики) → `references/kaizen.md`.

## How to Use

1. User describes a problem or decision
2. Select 1-2 most relevant frameworks
3. Walk through the framework step by step
4. Deliver structured analysis with clear conclusions
5. Optionally save insights via vector_memory

## Combination Guide

- **Strategic decisions**: First Principles + Second-Order Effects
- **Risk assessment**: Pre-mortem + Inversion
- **Debugging**: 5 Whys + First Principles
- **Task management**: Eisenhower + Second-Order Effects
