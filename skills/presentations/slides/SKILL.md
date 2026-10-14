---
name: slides
description: "HTML-презентации: навигация, скейлинг под экран."
user_description: "Собирает презентацию как готовый файл: навигация, подгонка под экран, заметки докладчика, печать в PDF. Нужен, когда нужен именно рабочий дек, а не набросок."
user_description_i18n:
  ar: "يبني عرضًا تقديميًا كملف جاهز: التنقل بين الشرائح، الملاءمة مع الشاشة، ملاحظات المتحدث، الطباعة إلى PDF. مفيد عندما تحتاج إلى عرض يعمل فعلًا وليس مجرد مسودة."
  en: "Builds a presentation as a finished file: slide navigation, scaling to fit the screen, speaker notes, printing to PDF. Useful when you need a working deck rather than a rough draft."
  es: "Arma una presentación como archivo terminado: navegación entre diapositivas, ajuste a la pantalla, notas del ponente, impresión en PDF. Útil cuando necesitas un deck que funcione de verdad y no un borrador."
  fr: "Assemble une présentation sous forme de fichier prêt à l'emploi : navigation entre les diapositives, adaptation à la taille de l'écran, notes de l'orateur, impression en PDF. Utile quand il vous faut un vrai deck fonctionnel et non une ébauche."
  ja: "プレゼンを完成品のファイルとして組み立てます。スライド送り、画面へのフィット、発表者ノート、PDF 出力まで。下書きではなく、実際に使えるデッキが必要なときに役立ちます。"
  pt: "Monta uma apresentação como arquivo pronto: navegação entre slides, ajuste à tela, notas do apresentador, impressão em PDF. Útil quando você precisa de um deck que funcione de verdade, e não de um rascunho."
  zh: "把演示文稿做成一个可直接使用的文件：翻页导航、自适应屏幕、演讲者备注、打印成 PDF。适合需要一份真正能用的演示稿、而不是草稿的时候。"
  zh-hant: "把簡報做成一個可直接使用的檔案：翻頁導覽、自適應螢幕、講者備註、列印成 PDF。適合需要一份真正能用的簡報、而不是草稿的時候。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: presentations
    tags: [slides, python, git, pdf, pptx, image]
    source: claude-code-config-pack
---
## Когда применять

HTML-презентации: навигация, скейлинг под экран, спикер-ноты, печать в PDF. Триггеры: «сделай слайды», «дек», «питч», «1920x1080 дек». НЕ стили Manus→команда /slides.

# Slides

HTML-презентация на основе веб-компонента `<deck-stage>`. Один HTML-файл = одна презентация.

## Принципы

- Канвас фиксированного размера (по умолчанию 1920×1080), отмасштабированный под viewport через `transform: scale()`. Чёрные полосы по краям, если соотношения не совпадают.
- Каждый слайд — `<section>` внутри `<deck-stage>`.
- Навигация: ←/→, Space, клик по краям, цифры на клавиатуре.
- Печать в PDF: одна страница = один слайд (через `@page` + `@media print`).

## Как делать дек

1. Скопируй `templates/deck-stage.js` рядом с HTML-файлом.
2. Возьми `templates/deck-template.html` как стартовый каркас.
3. Сформулируй дизайн-систему ВСЛУХ перед слайдами:
   - Шрифтовая пара (заголовок + основной).
   - Базовая палитра: фон, текст, 0–2 акцента.
   - Сетка: колонки, базовый отступ.
   - Ритм слайдов: где full-bleed, где разделители-секции, где данные.
4. Каждый слайд — `<section>` со своим layout. Не используй один шаблон на всё.
5. На текстовых слайдах не больше ~30 слов. Остальное — в спикер-ноты.

## Размеры

| Формат | Размеры | Когда |
|---|---|---|
| 16:9 FullHD | 1920×1080 | Дефолт. Конференции, ревью. |
| 16:9 lite | 1280×720 | Если важна скорость рендера. |
| Square | 1080×1080 | Соцсети, карусели. |
| Vertical | 1080×1920 | Сторис, мобильные плееры. |

Указывается атрибутами на `<deck-stage>`:

```html
<deck-stage width="1920" height="1080">
  <section>...</section>
  <section>...</section>
</deck-stage>
```

## Спикер-ноты

Если нужны — добавь в `<head>`:

```html
<script type="application/json" id="speaker-notes">
[
  "Заметки к слайду 1",
  "Заметки к слайду 2"
]
</script>
```

Полные разговорные тексты, не тезисы. Это сценарий выступления.

## Типографические правила

- Минимальный размер на 1920×1080: **24px**, и то редко. Заголовки от 80px.
- Не больше 2 шрифтов в деке.
- Контраст текста к фону — минимум 4.5:1.
- Не центрируй длинные абзацы. Центрируй короткие — заголовки и манифесты.

## Композиция слайдов

Полезные архетипы (комбинируй):

- **Statement** — одна большая фраза, всё остальное минимум.
- **Title + supporting** — заголовок сверху, 1–3 пункта или картинка.
- **Two-column** — слева тезис, справа доказательство (картинка / данные).
- **Section divider** — контрастный фон, номер секции и название. Использовать для ритма каждые 4–6 слайдов.
- **Full-bleed image** — фото на весь экран, текст в углу с полупрозрачной плашкой.
- **Data slide** — один график крупно, один вывод текстом.
- **Quote** — большая цитата, мелкая атрибуция.

Не повторяй один и тот же шаблон 10 раз подряд.

## Изображения

Если нет реальных — рисуй плейсхолдер:

```html
<div class="placeholder">
  <span>product shot · 1200×800</span>
</div>
```

```css
.placeholder {
  background: repeating-linear-gradient(
    45deg, #1a1a1a, #1a1a1a 8px, #222 8px, #222 16px
  );
  display: grid; place-items: center;
  font-family: ui-monospace, monospace;
  color: #888; font-size: 14px;
}
```

## Метки для контекста

Поставь `data-screen-label` на каждом `<section>`, тогда при инспекции элементов видно, где какой слайд:

```html
<section data-screen-label="01 Title">...</section>
<section data-screen-label="02 Problem">...</section>
```

Нумерация с 1, как у пользователя в интерфейсе.

## Экспорты

Когда готово — пользователь может попросить:
- PDF → подключи скилл `export-pdf`.
- PNG-кадры → `export-png`.
- PPTX → `export-pptx`.
- Один HTML-файл → `standalone-html`.

## Проверка

Открой результат в браузере — команда своя на каждой ОС:

```bash
open deck.html            # macOS
xdg-open deck.html        # Linux
start deck.html           # Windows (cmd / PowerShell)
```

В Git Bash на Windows нет ни `open`, ни `xdg-open`, ни `start` как команды — там
`start` вызывается через `cmd`: `cmd //c start deck.html`. Кросс-платформенный
однострочник, если не хочется помнить: `python -c "import webbrowser,sys; webbrowser.open(sys.argv[1])" deck.html`.

Если есть скилл `verifier` — позови его проверить консоль и снять скриншоты.

## Legacy reference

Прежняя расширенная версия скилла целиком лежит в `references/legacy-slides.md`. Секции там: Каркас, Правила слайдов, Структура дека (типовая), Стек со связанными скиллами, URL-навигация, Антипаттерны.
