---
name: away-summary
description: "Пересказывает, на чём вы остановились."
user_description: "Пересказывает, на чём вы остановились: что сделано, что осталось, где именно прервались. Нужен, когда вернулись к работе после перерыва и не помните, чем закончили."
user_description_i18n:
  ar: "يلخّص أين توقفت: ما أُنجز، وما بقي، وعند أي نقطة بالضبط انقطع العمل. مفيد عندما تعود إلى العمل بعد استراحة ولا تتذكر كيف انتهت الجلسة."
  en: "Recaps where you left off: what has been done, what is still open, and exactly where the work was interrupted. Useful when you come back after a break and cannot remember how things ended."
  es: "Resume dónde se quedó: qué se ha hecho, qué falta y en qué punto exacto se interrumpió el trabajo. Útil cuando vuelve tras una pausa y no recuerda cómo terminó la sesión."
  fr: "Résume où vous vous êtes arrêté : ce qui a été fait, ce qui reste à faire et à quel endroit précis le travail a été interrompu. Utile quand vous reprenez après une pause et ne vous souvenez plus de la dernière étape."
  ja: "作業をどこで止めたかを振り返ります。何が終わり、何が残っていて、どの時点で中断したのかをまとめます。休憩を挟んで作業に戻り、前回どこまで進めたか思い出せないときに役立ちます。"
  pt: "Resume onde você parou: o que já foi feito, o que ainda falta e em que ponto exato o trabalho foi interrompido. Útil quando você volta depois de uma pausa e não lembra como a sessão terminou."
  zh: "回顾你停在了哪里：已经完成了什么、还剩下什么、工作在哪一步被打断。适用于休息后回到工作却想不起上次做到哪儿的情况。"
  zh-hant: "回顧你停在了哪裡：已經完成了什麼、還剩下什麼、工作在哪一步被打斷。適用於休息後回到工作卻想不起上次做到哪裡的情況。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: memory-and-knowledge
    tags: [away, summary]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Пересказ «пока тебя не было»: на чём остановились и что сделано в сессии. Триггеры: «где остановился», «recap», «while you were away».

# Away Summary

Generate a short session recap for returning after a break.

## Rules

1. Write exactly 1-3 short sentences
2. Start by stating the **high-level task** — what was being built or debugged, not implementation details
3. Then: the **concrete next step**
4. Skip status reports and commit recaps
5. Use only the last ~30 messages for context

## Example Output

> Building the admin panel with AI chat integration. Next: test the briefing cron job and verify collector scheduling.

## How to Generate

1. Look at the recent conversation context
2. Identify the main task/goal
3. Identify where work left off
4. Write 1-3 sentences following the rules above
