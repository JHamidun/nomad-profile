---
name: export-pptx
description: "HTML-дек в PPTX: режим картинок (надёжный)."
user_description: "Переносит презентацию в PowerPoint — либо картинками (надёжно), либо редактируемым текстом. Нужен, когда файл придётся править в привычном редакторе."
user_description_i18n:
  ar: "ينقل العرض التقديمي إلى PowerPoint، إما كصور (طريقة موثوقة) أو كنص قابل للتحرير. مفيد عندما سيحتاج الملف إلى تعديل في المحرّر المعتاد."
  en: "Converts a presentation into a PowerPoint file, either as images (reliable) or as editable text. Useful when the file will need to be edited in the familiar PowerPoint editor."
  es: "Convierte una presentación a PowerPoint, ya sea como imágenes (fiable) o como texto editable. Útil cuando el archivo tendrá que editarse en el editor de siempre."
  fr: "Transfère une présentation dans PowerPoint, soit sous forme d'images (fiable), soit en texte modifiable. Utile quand le fichier devra être retouché dans l'éditeur habituel."
  ja: "プレゼンを PowerPoint ファイルに変換します。画像として（確実）か、編集可能なテキストとしてかを選べます。使い慣れたエディタでファイルを修正する必要があるときに役立ちます。"
  pt: "Converte uma apresentação para PowerPoint, seja como imagens (confiável) ou como texto editável. Útil quando o arquivo precisará ser editado no editor de costume."
  zh: "把演示文稿转换为 PowerPoint 文件：可以转成图片（稳妥），也可以转成可编辑的文字。适合之后还需要在熟悉的编辑器里修改文件的情况。"
  zh-hant: "把簡報轉換為 PowerPoint 檔案：可以轉成圖片（穩妥），也可以轉成可編輯的文字。適合之後還需要在熟悉的編輯器裡修改檔案的情況。"
version: 1.0.0
license: MIT
metadata:
  hermes:
    category: presentations
    tags: [export, pptx, playwright, python, node, image]
    source: claude-code-config-pack
requires_apps: [dormant]
---
## Когда применять

HTML-дек в PPTX: режим картинок (надёжный) или редактируемый (нативный текст, pptxgenjs). Триггеры: «html в pptx», «выгрузи в PowerPoint».

# Export PPTX

Два режима. Выбирай по запросу.

## Режим 1: screenshots (надёжно, не редактируется)

Каждый слайд → PNG → вставка в пустой PPTX. Pixel-perfect, но текст внутри картинки.

**Зависимости:** Node + Playwright + python-pptx + Pillow (или JS-аналог).

```bash
npm i -D playwright pptxgenjs
npx playwright install chromium
```

Скрипт `templates/pptx-screenshots.mjs` — рендерит слайды через тот же путь, что `export-png`, и собирает их через **pptxgenjs**:

```js
import pptxgen from 'pptxgenjs';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const [, , file, out = 'deck.pptx'] = process.argv;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }});
await page.goto(pathToFileURL(path.resolve(file)).href, { waitUntil: 'networkidle' });

const total = await page.evaluate(() => document.querySelector('deck-stage').total);
await page.evaluate(() => document.querySelector('deck-stage').setAttribute('noscale', ''));

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.33×7.5 inch ~ 1920×1080

for (let i = 0; i < total; i++) {
  await page.evaluate(idx => document.querySelector('deck-stage').go(idx), i);
  await page.waitForTimeout(600);
  const buf = await page.screenshot({ type: 'png' });
  const slide = pres.addSlide();
  slide.background = { data: 'data:image/png;base64,' + buf.toString('base64') };
}

await pres.writeFile({ fileName: out });
await browser.close();
console.log('✓', out);
```

## Режим 2: editable (текст и фигуры — нативные)

Сложнее. Идея: пройти по DOM каждого слайда, для каждого text-node создать `slide.addText(...)`, для прямоугольника — `slide.addShape(...)`, для картинки — `slide.addImage(...)`.

`pptxgenjs` это умеет. Но 1:1 не получится — отказывайся от градиентов, теней, нестандартных шрифтов. Хорошо работает для деков, где макет = заголовок + текст + 1–2 фигуры.

Алгоритм:

1. Запусти страницу в Playwright.
2. На каждом слайде через `page.evaluate` собери список объектов:
   ```js
   [
     { type: 'text', x, y, w, h, text, font, size, color, bold, align },
     { type: 'rect', x, y, w, h, fill, stroke },
     { type: 'image', x, y, w, h, src },
   ]
   ```
   Координаты — относительно слайда, в пикселях, потом конвертируй в дюймы (`px / 96`).
3. Для каждого объекта вызови соответствующий `slide.addX(...)`.
4. `pres.writeFile({ fileName })`.

Готовый экстрактор писать заново не нужно — он лежит в соседнем навыке:
`../pptx-editable-extractor/templates/extract.mjs` (Playwright, `node extract.mjs <html>
[--slide-selector "deck-stage > section"] [--width 1920] [--height 1080]` → `slides.json`),
а сборка из этого JSON — `../pptx-editable-extractor/templates/build_pptx.py`.
Это **черновик**: для сложных макетов потребуется ручная подкрутка.

## Что выбирать когда

| Ситуация | Режим |
|---|---|
| Дек уйдёт в PowerPoint, его будут править | editable (с компромиссами по визуалу) |
| Просто переслать как PPTX, без правок | screenshots |
| В деке много кастомных эффектов / SVG | screenshots, иначе сломается |
| Текст должен искаться / переводиться в PowerPoint | editable |

## Замечания

- Шрифты: PowerPoint использует системные шрифты получателя. Если в HTML Helvetica Neue, а у получателя Windows — он увидит fallback. Закладывай это в выбор шрифтов.
- 16:9 в PowerPoint — `LAYOUT_WIDE` (13.33×7.5 in). 4:3 — `LAYOUT_STANDARD` (10×7.5 in).
- Если используешь Google Fonts — заранее предупреди пользователя, что PPT не подтянет их и шрифт подменится.

## Legacy reference

Прежняя расширенная версия скилла (дерево @2026-04-30) сохранена целиком в `references/legacy-export-pptx.md`. Секции там: Зависимости, Каркас, Workflow целиком, PPTX размеры, Альтернативный путь: LibreOffice, Когда нужен **редактируемый** PPTX, Скрытые слайды, Speaker notes, Метаданные, Антипаттерны.
