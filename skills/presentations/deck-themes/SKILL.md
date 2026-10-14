---
name: deck-themes
description: "Готовые CSS-темы для slides без бренда."
user_description: "Готовые оформления для презентаций: минимализм, журнальный стиль, тёмная тема, акцент на данных. Нужен, когда содержание готово, а выглядит оно никак."
user_description_i18n:
  ar: "تصاميم جاهزة للعروض التقديمية: بسيطة، بأسلوب المجلات، بمظهر داكن، أو بتركيز على البيانات. مفيد عندما يكون المحتوى جاهزًا لكن شكل العرض لا يزال باهتًا."
  en: "Ready-made looks for presentations: minimalist, magazine-style, dark theme, data-focused. Useful when the content is done but the deck still looks like nothing."
  es: "Diseños listos para presentaciones: minimalista, estilo revista, tema oscuro, enfoque en datos. Útil cuando el contenido ya está listo pero la presentación no luce nada bien."
  fr: "Des habillages prêts à l'emploi pour vos présentations : minimaliste, style magazine, thème sombre, accent sur les données. Utile quand le contenu est prêt mais que la présentation n'a encore aucune allure."
  ja: "プレゼン用の既製デザインテーマ。ミニマル、雑誌風、ダークテーマ、データ重視から選べます。中身はできているのに見た目がぱっとしないときに役立ちます。"
  pt: "Visuais prontos para apresentações: minimalista, estilo revista, tema escuro, foco em dados. Útil quando o conteúdo está pronto, mas a apresentação ainda não tem cara de nada."
  zh: "为演示文稿提供现成的外观：极简、杂志风、深色主题、数据导向。适合内容已经完成、但看起来平淡无奇的时候。"
  zh-hant: "為簡報提供現成的外觀：極簡、雜誌風、深色主題、資料導向。適合內容已經完成、但看起來平淡無奇的時候。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: presentations
    tags: [deck, themes]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

Готовые CSS-темы для slides без бренда: минимал, editorial, dark, data, brutalist. Триггеры: «тема презентации», «оформление дека». Любой артефакт → theme-factory.

# Deck themes

Готовые CSS-темы для `<deck-stage>`. Каждая — один CSS-файл, который подключается рядом с `deck-stage.js`. Конкретный набор шрифтов, цветов, размеров.

## Файлы

- `templates/theme-minimal.css` — спокойный, для B2B и продуктовых ревью.
- `templates/theme-editorial.css` — антиква + воздух, для лонгридов и питчей.
- `templates/theme-dark.css` — тёмный фон, для конференций и кинематографичности.
- `templates/theme-data.css` — для отчётов с цифрами и таблицами.
- `templates/theme-brutalist.css` — моноширинная утилитарность, для девелопер-брендов.

## Использование

```html
<link rel="stylesheet" href="theme-editorial.css" />
<script src="deck-stage.js"></script>
<deck-stage width="1920" height="1080">
  <section>
    <h1>Заголовок</h1>
    <p>Текст</p>
  </section>
</deck-stage>
```

Темы не используют !important — переопределяй конкретные слайды inline-стилями.

## Что общего у всех тем

Каждая тема задаёт:
- `--bg`, `--fg`, `--muted`, `--accent`
- `--font-display`, `--font-body`, `--font-mono`
- размеры `h1`, `h2`, `h3`, `p`, `.eyebrow`
- `.statement`, `.two-col`, `.title-stack`, `.dark` (инвертированный режим)
- `.placeholder`

Слайды переносимы между темами — поменяй `<link>`, и тот же HTML выглядит иначе.

## Правила выбора

| Тема | Подходит | Не подходит |
|---|---|---|
| minimal | внутренние ревью, продукт | креатив-агентства |
| editorial | питчи, манифесты, бренды | data-репорты |
| dark | конференции, AI/tech | финансы, образование |
| data | отчёты, KPI, аналитика | креатив, маркетинг |
| brutalist | dev-tools, опен-сорс | продажи b2c |
