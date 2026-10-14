---
name: ru-text
description: "Качество русского текста: типографика, инфостиль."
user_description: "Правит качество русского текста: убирает канцелярит, наводит типографику, делает формулировки прямыми. Нужен перед публикацией и отправкой."
user_description_i18n:
  ar: "يحسّن جودة النص الروسي: يزيل الصياغات البيروقراطية، ويضبط علامات الطباعة، ويجعل العبارات مباشرة. مفيد قبل نشر أو إرسال أي نص مكتوب بالروسية."
  en: "Improves the quality of Russian text: strips bureaucratic phrasing, fixes typography, makes the wording direct. Useful before publishing or sending anything written in Russian."
  es: "Mejora la calidad de un texto en ruso: elimina el lenguaje burocrático, corrige la tipografía y hace las frases más directas. Útil antes de publicar o enviar cualquier texto escrito en ruso."
  fr: "Améliore la qualité d'un texte en russe : supprime le jargon administratif, corrige la typographie, rend les formulations directes. Utile avant de publier ou d'envoyer un texte rédigé en russe."
  ja: "ロシア語テキストの質を高めます。お役所的な言い回しを削り、タイポグラフィを整え、表現を率直にします。ロシア語の文章を公開・送信する前に役立ちます。"
  pt: "Melhora a qualidade de um texto em russo: remove o linguajar burocrático, ajusta a tipografia e deixa as frases diretas. Útil antes de publicar ou enviar qualquer texto escrito em russo."
  zh: "提升俄语文本的质量：去除官腔套话，修正排版标点，让表达更直接。适合在发布或发送俄语文稿之前使用。"
  zh-hant: "提升俄語文本的品質：去除官腔套話，修正排版標點，讓表達更直接。適合在發布或寄出俄語文稿之前使用。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: writing-and-communication
    tags: [text, git]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Качество русского текста: типографика, инфостиль, чистка канцелярита. Триггеры: «поправь стиль», «убери канцелярит». НЕ орфография→/proofread.

# ru-text — Russian Text Quality

Independent Russian text quality reference by Arseniy Kamyshev.
With gratitude to the authors whose work shaped modern Russian text standards.
Credits and recommended reading: `references/sources.md`

**Style priority**: if the user explicitly requests a specific style (casual, academic, SEO, literary, etc.), their prompt overrides these default rules where they conflict. These rules are defaults, not mandates.

**Reviewing vs. rewriting**: when *checking* or proofreading existing text or a file, return the corrected version plus a list of changes — do not silently overwrite the source file. Rewrite a file in place only when the user explicitly asks.

## Always-On: Typography

Apply these rules to ALL Russian text output without exception.

| Rule | Wrong | Correct |
|---|---|---|
| Primary quotes: guillemets | "текст" | «текст» |
| Nested quotes: lapki | «"вложенные"» | «„вложенные“» |
| Em dash with spaces | слово - слово | слово — слово |
| En dash for ranges, no spaces | 10-15 дней | 10–15 дней |
| NBSP after single-letter prepositions | в начале (breakable) | в\u00A0начале |
| Ellipsis: single character | ... | … |
| Digit groups with thin spaces | 1000000 | 1 000 000 |
| Decimal comma (not dot) | 3.14 | 3,14 |
| Ordinal with hyphen | 1ый, 2ой | 1-й, 2-й |
| Numero sign | No. 5, #5 | № 5 |
| Abbreviations with NBSP | т.д., т.е. | т. д., т. е. |
| Ruble symbol after number | 1500 руб | 1 500 ₽ |

Full typography reference: `references/typography.md`

`/ru-text:ru-score` — text quality score (0–10, 5 dimensions).

## Top Stop-Words (remove or replace)

| Stop-word | Replace with |
|---|---|
| является | — (dash) or restructure |
| осуществлять | делать, проводить |
| в настоящее время | сейчас |
| данный | этот |
| определённый | (name the specific thing) |
| произвести оплату | оплатить |
| высококачественный | (name the specific quality) |
| был осуществлён | (active voice + actor) |
| на сегодняшний день | сегодня |
| в целях | чтобы |

Full stop-word catalog (97 entries): `references/info-style.md`

## When to Load Reference Files

Reference files (paths are relative to this SKILL.md): `references/<filename>`
If the path is not resolved, search: `search_files("**/ru-text/references/scoring.md")` and use the parent directory.

| Task | File |
|---|---|
| Writing/editing articles, blog posts, SEO, content | info-style.md |
| Interface text, buttons, errors, hints, microcopy | ux-writing.md |
| Emails, messenger, business correspondence | business-writing.md |
| Punctuation review, comma placement | editorial-punctuation.md |
| Grammar, capitalization, agreement, pleonasms | editorial-grammar.md |
| Finding and fixing text problems, diagnostics | anti-patterns.md |
| Text scoring, quality assessment | scoring.md |
| Credits, source attribution | sources.md |
| Experience-based rules (dash overuse, etc.) | addenda.md |

## Quality Checklist

Before delivering Russian text:

- [ ] Quotes: «» primary, „“ nested
- [ ] Dashes: — in text, – in ranges, - only in compounds; max 1–2 per paragraph
- [ ] NBSP after в, к, с, о, у, и, а
- [ ] Ellipsis: … (single char)
- [ ] Abbreviations: т. д., т. п. (with NBSP)
- [ ] No double spaces, no space before punctuation
