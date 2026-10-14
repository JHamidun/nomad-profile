---
name: powerpoint
description: "Презентации PowerPoint (.pptx) на python-pptx: сборка слайд-деков с нуля, редактирование существующих презентаций, сетка и вёрстка слайдов, таблицы, диаграммы, фигуры, иллюстрации и заметки спикера. Триггеры: «pptx», «powerpoint», «презентация», «слайды», «собери слайд-дек»."
metadata:
  version: 1.0.0
  updated: "2026-09-20"
  license: MIT
---

# PowerPoint (PPTX)

Навык для программной сборки и редактирования презентаций `.pptx` через библиотеку `python-pptx`.

```bash
pip install python-pptx Pillow
```

---

## 1. Создание презентации 16:9

По умолчанию `Presentation()` создаёт слайд 4:3 (`10 × 7.5` дюймов). Для современных экранов всегда явно задавай широкоэкранный формат 16:9 (`13.333 × 7.5` дюймов):

```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN

prs = Presentation()
prs.slide_width = Inches(13.333)
prs.slide_height = Inches(7.5)

# Макет 6 (Blank) даёт чистый холст без рамок-плейсхолдеров
blank_layout = prs.slide_layouts[6]
slide = prs.slides.add_slide(blank_layout)

# Заголовок слайда
title_box = slide.shapes.add_textbox(Inches(0.8), Inches(0.6), Inches(11.7), Inches(1.0))
tf = title_box.text_frame
tf.word_wrap = True
p = tf.paragraphs[0]
p.text = "Итоги квартала: рост ключевых метрик"
p.font.name = "Calibri"
p.font.size = Pt(28)
p.font.bold = True
p.font.color.rgb = RGBColor(0x05, 0x07, 0x1C)

prs.save("deck.pptx")
```

---

## 2. Таблицы и карточки показателей

```python
rows, cols = 4, 3
left, top, width, height = Inches(0.8), Inches(2.0), Inches(11.7), Inches(3.2)
table_shape = slide.shapes.add_table(rows, cols, left, top, width, height)
table = table_shape.table

headers = ["Сегмент", "Выручка", "Динамика"]
for col_idx, text in enumerate(headers):
    cell = table.cell(0, col_idx)
    cell.text = text
```

---

## 3. Чтение и разбор чужой презентации

При разборе существующего `.pptx` обходи не только текстовые рамки, но и таблицы, и групповые фигуры (`MSO_SHAPE_TYPE.GROUP`):

```python
from pptx import Presentation

prs = Presentation("input.pptx")
for idx, slide in enumerate(prs.slides, 1):
    print(f"=== Слайд {idx} ===")
    for shape in slide.shapes:
        if shape.has_text_frame:
            for p in shape.text_frame.paragraphs:
                if p.text.strip():
                    print(" ", p.text.strip())
        if shape.has_table:
            for row in shape.table.rows:
                print("  |", " | ".join(c.text.strip() for c in row.cells))
```

---

## 4. Заметки спикера

```python
notes_slide = slide.notes_slide
notes_tf = notes_slide.notes_text_frame
notes_tf.text = "Ключевой акцент на слайде: рост удержания в корпоративном сегменте."
```
