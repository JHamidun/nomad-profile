/**
 * Регистрация 5 фирменных тем Nomad для десктопа через `THEMES_AREA` (M-152, U1).
 *
 * Темы:
 *   1. `nomad-dark`          — графитово-угольная по умолчанию (`#0B0E14` / `#E6EDF3` / `#FF6B35`)
 *   2. `nomad-light`         — светлая дневная палитра с терракотовым акцентом
 *   3. `nomad-Steppe`        — песочно-тёплая степная палитра
 *   4. `nomad-midnight`      — глубокий полуночный синий
 *   5. `nomad-high-contrast` — высококонтрастная палитра для максимальной читаемости
 */

import { THEMES_AREA, host } from '@hermes/plugin-sdk'

import { NOMAD_DUNES_SRC } from './assets/nomad-dunes.js'

if (typeof Node !== 'undefined' && !Node.prototype.__nomadSafeDOMPatched) {
  Node.prototype.__nomadSafeDOMPatched = true
  const origRemoveChild = Node.prototype.removeChild
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (child.parentNode) return origRemoveChild.call(child.parentNode, child)
      return child
    }
    return origRemoveChild.apply(this, arguments)
  }
  const origInsertBefore = Node.prototype.insertBefore
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return this.appendChild(newNode)
    }
    return origInsertBefore.apply(this, arguments)
  }
}

export const DEFAULT_NOMAD_THEME = 'nomad-dark'

function navigateNomad(path) {
  if (host && typeof host.navigate === 'function') {
    host.navigate(path)
    return
  }
  const sdk = typeof window !== 'undefined' ? window.__HERMES_PLUGIN_SDK__ : null
  if (typeof sdk?.host?.navigate === 'function') {
    sdk.host.navigate(path)
    return
  }
  if (typeof window !== 'undefined' && window.location?.protocol !== 'file:') {
    window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
}

function buildTheme({
  name,
  label,
  description,
  isDefault = false,
  mode = 'dark',
  bg,
  fg,
  primary,
  primaryFg = '#FFFFFF',
  card,
  muted,
  mutedFg,
  secondary,
  secondaryFg,
  border,
  sidebarBg,
  destructive = '#EF4444'
}) {
  const colors = {
    background: bg,
    foreground: fg,
    card,
    cardForeground: fg,
    muted,
    mutedForeground: mutedFg,
    popover: card,
    popoverForeground: fg,
    primary,
    primaryForeground: primaryFg,
    secondary,
    secondaryForeground: secondaryFg,
    accent: primary,
    accentForeground: primaryFg,
    border,
    input: border,
    ring: primary,
    midground: primary,
    midgroundForeground: primaryFg,
    composerRing: primary,
    destructive,
    destructiveForeground: '#FFFFFF',
    sidebarBackground: sidebarBg,
    sidebarBorder: border,
    userBubble: secondary,
    userBubbleBorder: border
  }

  const tokens = {
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': fg,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--popover': card,
    '--popover-foreground': fg,
    '--primary': primary,
    '--primary-foreground': primaryFg,
    '--secondary': secondary,
    '--secondary-foreground': secondaryFg,
    '--accent': primary,
    '--accent-foreground': primaryFg,
    '--border': border,
    '--input': border,
    '--ring': primary,
    '--midground': primary,
    '--destructive': destructive,
    '--sidebar-background': sidebarBg,
    '--sidebar-border': border,
    '--bg-primary': bg,
    '--text-primary': fg,
    '--accent-primary': primary
  }

  return {
    id: name,
    name,
    label,
    description,
    mode,
    default: isDefault,
    isDefault,
    colors,
    darkColors: mode === 'dark' ? colors : undefined,
    tokens,
    variables: tokens
  }
}

export const ACADEMY_THEME = {
  id: 'nomad-academy',
  name: 'nomad-academy',
  label: 'Nomad Academy (Фирменная)',
  description: 'Фирменная дизайн-система Nomad Academy (Apple Liquid Glass): тёплый крем днём, глубокий индиго ночью и единый акцент #007AFF.',
  mode: 'system',
  default: true,
  isDefault: true,
  colors: {
    background: '#F6F4EF',
    foreground: '#14151C',
    card: '#FFFFFF',
    cardForeground: '#14151C',
    muted: '#ECEAE3',
    mutedForeground: '#5A5C68',
    popover: '#FFFFFF',
    popoverForeground: '#14151C',
    primary: '#007AFF',
    primaryForeground: '#FFFFFF',
    secondary: '#FBFAF6',
    secondaryForeground: '#3A3C48',
    accent: '#EEF4FF',
    accentForeground: '#14151C',
    border: 'rgba(20, 21, 28, 0.1)',
    input: 'rgba(20, 21, 28, 0.14)',
    ring: '#007AFF',
    midground: '#007AFF',
    midgroundForeground: '#FFFFFF',
    composerRing: '#007AFF',
    destructive: '#D9534F',
    destructiveForeground: '#FFFFFF',
    sidebarBackground: '#F0EDE6',
    sidebarBorder: 'rgba(20, 21, 28, 0.1)',
    userBubble: 'color-mix(in srgb, #007AFF 8%, #FFFFFF)',
    userBubbleBorder: 'color-mix(in srgb, #007AFF 24%, transparent)'
  },
  darkColors: {
    background: '#0A0A12',
    foreground: '#EEF1FB',
    card: '#14121E',
    cardForeground: '#EEF1FB',
    muted: '#1A1E38',
    mutedForeground: '#A6AAC6',
    popover: '#1B1926',
    popoverForeground: '#EEF1FB',
    primary: '#007AFF',
    primaryForeground: '#FFFFFF',
    secondary: '#1F2350',
    secondaryForeground: '#DDE4FF',
    accent: '#1F2350',
    accentForeground: '#EEF1FB',
    border: '#262A3A',
    input: '#0D0F1C',
    ring: '#29A9FF',
    midground: '#29A9FF',
    midgroundForeground: '#0A0A12',
    composerRing: '#29A9FF',
    destructive: '#D9534F',
    destructiveForeground: '#FFF5F5',
    sidebarBackground: '#05071C',
    sidebarBorder: '#23273B',
    userBubble: '#1B2044',
    userBubbleBorder: '#2E3560'
  }
}

export const NOMAD_THEMES = [
  ACADEMY_THEME,
  buildTheme({
    name: 'nomad-dark',
    label: 'Nomad Тёмная (по умолчанию)',
    description: 'Фирменная графитово-угольная палитра Nomad с тёплым терракотовым акцентом для комфортной работы.',
    isDefault: true,
    mode: 'dark',
    bg: '#0B0E14',
    fg: '#E6EDF3',
    primary: '#FF6B35',
    card: '#11161F',
    muted: '#161C28',
    mutedFg: '#9BA7B4',
    secondary: '#1B2230',
    secondaryFg: '#E6EDF3',
    border: '#263042',
    sidebarBg: '#080B10'
  }),
  buildTheme({
    name: 'nomad-light',
    label: 'Nomad Светлая',
    description: 'Чистая дневная палитра с мягким бумажным фоном и контрастными элементами управления.',
    isDefault: false,
    mode: 'light',
    bg: '#F8FAFC',
    fg: '#0F172A',
    primary: '#EA580C',
    card: '#FFFFFF',
    muted: '#F1F5F9',
    mutedFg: '#475569',
    secondary: '#E2E8F0',
    secondaryFg: '#0F172A',
    border: '#CBD5E1',
    sidebarBg: '#F1F5F9'
  }),
  buildTheme({
    name: 'nomad-Steppe',
    label: 'Nomad Степь',
    description: 'Песочно-тёплая степная палитра с приглушённым контрастом для длительного чтения и письма.',
    isDefault: false,
    mode: 'dark',
    bg: '#1C1814',
    fg: '#F3EAD8',
    primary: '#E07A3F',
    card: '#25201A',
    muted: '#2E2720',
    mutedFg: '#B8AA96',
    secondary: '#352D24',
    secondaryFg: '#F3EAD8',
    border: '#463B2F',
    sidebarBg: '#16130F'
  }),
  buildTheme({
    name: 'nomad-midnight',
    label: 'Nomad Полночь',
    description: 'Глубокая полуночно-синяя палитра с янтарным акцентом для ночных рабочих сессий.',
    isDefault: false,
    mode: 'dark',
    bg: '#070B16',
    fg: '#E2E8F0',
    primary: '#F97316',
    card: '#0D1324',
    muted: '#131C33',
    mutedFg: '#94A3B8',
    secondary: '#192440',
    secondaryFg: '#E2E8F0',
    border: '#233256',
    sidebarBg: '#050811'
  }),
  buildTheme({
    name: 'nomad-high-contrast',
    label: 'Nomad Высокий контраст',
    description: 'Максимально контрастная палитра с чёткими границами для повышенной читаемости текста и кода.',
    isDefault: false,
    mode: 'dark',
    bg: '#000000',
    fg: '#FFFFFF',
    primary: '#FF7A45',
    primaryFg: '#000000',
    card: '#0A0A0A',
    muted: '#141414',
    mutedFg: '#D4D4D8',
    secondary: '#1F1F23',
    secondaryFg: '#FFFFFF',
    border: '#52525B',
    sidebarBg: '#000000'
  })
]

import { HELP_BADGE_DESCRIPTIONS } from './tooltips.js'

const NOMAD_TOOLTIPS_BY_TEXT = {
  'Новый чат': 'Создать чистый диалог с Nomad (Ctrl+N)',
  'Чаты': 'Список недавних рабочих диалогов (служебные сессии скрыты)',
  'Задачи по расписанию': 'Автономные фоновые задачи и cron-расписания агента',
  'Рабочие области': 'Привязанные папки проектов и репозитории',
  'Навыки': 'Каталог установленных навыков (SKILL.md) и подключение новых инструментов',
  'Настройки': 'Параметры внешнего вида, питомца, моделей, памяти и интеграций',
  'Аккаунты': 'Подключение подписок, российских суверенных моделей и API-ключей без перезапуска',
  'Аккаунты и ключи': 'Подключение подписок и API-ключей без перезапуска (Горячая замена)',
  'Цепочка фолбэков': 'Порядок автоматического переключения моделей при лимитах или сбоях',
  'Биллинг и лимиты': 'Контроль расходов, дневных бюджетов и остатка квот по провайдерам',
  'Навыки Nomad': 'Категории навыков, корпоративные коннекторы РФ (1С, Битрикс24, Диадок) и установка в 1 клик',
  'Витрина навыков': 'Категории навыков, проверка целостности (SHA-256) и установка в 1 клик',
  'Данные и место': 'Папка профиля Nomad, импорт/экспорт памяти и резервные копии',
  'Данные и память': 'Папка профиля Nomad, импорт/экспорт памяти и резервные копии',
  'Безопасность': 'Песочница команд, гардрейлы 152-ФЗ, DLP-маскирование ПДн и сетевой экран Egress',
  'Перенос и старт': 'Мастер переноса из Claude Code / Codex CLI и автообновление поверх Hermes',
  'Симулятор ИИ': 'Интерактивный тренажёр вайбкодинга: 9 ролевых треков, сценарии, Академия и Бадди Ника/Сократ',
  'Рой и граф': 'Визуальный граф параллельных субагентов и оркестрация роя',
  'О программе': 'Версия ядра Hermes, надстройки Nomad и проверка обновлений',
  'Персонализация': 'Стиль общения, тон ответов и постоянные инструкции для агента',
  'Внешний вид': 'Тема оформления (Nomad Academy), масштаб интерфейса, фон с караваном и питомец',
  'Питомец': 'Анимированный питомец-компаньон на экране (караванный верблюд Nomad и коллекция Скрепка)',
  'Шлюзы': 'Локальный сервер Nomad (127.0.0.1:9129) и подключение корпоративных контуров',
  'Локальные модели': 'Запуск локальных GGUF/Ollama/LM Studio моделей прямо на вашем компьютере',
  'Начать курс': 'Открыть диалог с ИИ-ментором и приступить к выбранному треку',
  'Продолжить вашу сессию': 'Вернуться к активному диалогу тренажёра с сохранением прогресса',
}

const ENGLISH_TO_RUSSIAN_TEXT_MAP = {
  'NEW SESSION': 'НОВЫЙ СЕАНС',
  'What are we building?': 'Опишите задачу, прикрепите файл или задайте вопрос…',
  "Drop the task here. I'll keep the work grounded in the repo.":
    'Опиши задачу, кинь файл или идею — изучу проект и доведу решение до результата.',
  'Drop the task here. I’ll keep the work grounded in the repo.':
    'Опиши задачу, кинь файл или идею — изучу проект и доведу решение до результата.',
  "Send the task, file, or rough idea. I'll use your configured voice and keep the work grounded in this repo.":
    'Опиши задачу, файл или черновую идею — разберусь в коде и предложу конкретный шаг.',
  "Bring the context or the stuck part. I'll adapt to your configured personality.":
    'Пришли контекст или проблемное место — подстроюсь под твой стиль и помогу разобраться.',
  "Give me the context and I'll answer in Simulator mode.":
    'Опиши задачу или выбери карточку ниже — помогу решить её шаг за шагом.',
  "Send the problem, file, or idea. I'll follow the personality you've configured.":
    'Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.',
  'Send the problem, file, or idea. I’ll follow the personality you’ve configured.':
    'Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.',
  'Ask me to open a repo, explain an error, or automate a chore. I can read code, run tools, and follow through.':
    'Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.',
  'Paste a stack trace, drop a screenshot, or describe what looks wrong. We can untangle it together.':
    'Вставь стектрейс, кинь скриншот или опиши симптомы — разберёмся вместе.',
  'Point me at a folder or a file. I’ll read before I write and show you what changed.':
    'Покажи папку или файл — сначала прочитаю, потом аккуратно поправлю и покажу дифф.',
  'Got a repetitive task? Tell me how you do it once and we can turn it into a reusable skill or schedule.':
    'Есть рутина? Расскажи один раз, как ты её делаешь — превратим в навык или расписание.',
  'Draft a spec, summarize a thread, or compare approaches. I’ll keep the receipts and cite the files.':
    'Набросать спек, сжать переписку, сравнить подходы — сохраню пруфы и сошлюсь на файлы.',
  'Encrypt saved secrets with the OS keychain':
    'Шифровать сохранённые секреты и API-ключи в системном хранилище ОС (Windows Credential Manager)',
  'Protects saved gateway tokens using the operating system keychain when available.':
    'Защищает токены шлюза и API-ключи аппаратным шифрованием учётной записи Windows (DPAPI).',
  'Gateway connection is locked by environment variables.':
    'Локальный шлюз Nomad подключён автоматически.',
  'Ask anything, @ to mention, / for actions':
    'Спросите что угодно, @ для упоминания, / для команд',
  'Ask anything…': 'Спросите что угодно…',
  'The AI service is busy': 'Сервис ИИ временно перегружен',
  'ChatGPT or Codex Subscription is limiting requests right now. Wait a minute, then retry.':
    'Лимит запросов текущей подписки временно исчерпан. Подождите минуту или переключите провайдера.',
  'Your request was not processed. Send it again if you still want me to carry it out.':
    'Запрос не был обработан. Отправьте его повторно или выберите другую модель.',
  'Retry': 'Повторить',
  'Switch provider': 'Сменить провайдера',
  'Open Desktop logs': 'Открыть журнал',
  'Send diagnostics': 'Отправить диагностику',
  'Copy error details': 'Скопировать детали',
  'Details': 'Подробности',
  'model changed': 'модель изменена',
  "Describe the task in your own words. I'll pick the right tools, explain my plan, and check in before risky steps.":
    'Опиши задачу своими словами — подберу инструменты, согласую план и спрошу подтверждение перед важными шагами.',
  'Describe the task in your own words. I’ll pick the right tools, explain my plan, and check in before risky steps.':
    'Опиши задачу своими словами — подберу инструменты, согласую план и спрошу подтверждение перед важными шагами.',
  Default: 'Стандартная',
  Basic: 'Базовая',
  Focus: 'Фокус',
  'Terminal deck': 'Терминальная дека',
  Quad: 'Квадро (4 панели)',
  Browser: 'Браузер',
  'Passwords & Logins': 'Пароли и входы',
  'Everything—indexed in one place': 'Все файлы и медиа — в одном месте',
  'Everything — indexed in one place': 'Все файлы и медиа — в одном месте',
  'Images, files, and links from every session show up here automatically.':
    'Изображения, файлы и ссылки из всех сессий собираются здесь автоматически.',
  'In-App Tips': 'Подсказки в интерфейсе',
  'Show contextual tips across the interface. Dismissed tips stay hidden.':
    'Показывать контекстные подсказки в интерфейсе. Закрытые подсказки больше не отображаются.',
  'Occasional hints from the app and Nomad. Each tip appears once. Turns off automatically after your first 30 days; you can turn it back on.':
    'Ненавязчивые подсказки по функциям интерфейса. Каждая подсказка показывается один раз и может быть включена повторно в любой момент.',
  'Occasional hints from the app and Hermes. Each tip appears once. Turns off automatically after your first 30 days; you can turn it back on.':
    'Ненавязчивые подсказки по функциям интерфейса. Каждая подсказка показывается один раз и может быть включена повторно в любой момент.',
  'Guided Tours': 'Пошаговый тур по интерфейсу',
  'Interactive walkthroughs that introduce parts of the interface. Turn off to disable all tours.':
    'Интерактивный обзор разделов и кнопок приложения с подсветкой элементов.',
  'Let Nomad spotlight each step as it guides you through the app. Turns off automatically after your first 30 days; you can turn it back on.':
    'Интерактивный обзор ключевых разделов приложения с подсветкой элементов (Spotlight-онбординг) на выбранном языке.',
  'Let Hermes spotlight each step as it guides you through the app. Turns off automatically after your first 30 days; you can turn it back on.':
    'Интерактивный обзор ключевых разделов приложения с подсветкой элементов (Spotlight-онбординг) на выбранном языке.',
  'Restart tours': 'Перезапустить обзор',
  'All tips are visible': 'Все подсказки включены',
  'Local Models': 'Локальные модели',
  'Still trying to reconnect...': 'Продолжаем переподключение...',
  'Still trying to reconnect…': 'Продолжаем переподключение…',
  'Reconnect now': 'Переподключить сейчас',
  'Open Gateways': 'Открыть шлюзы',
  'Gateway connection lost': 'Соединение со шлюзом потеряно',
  'Backend unavailable': 'Бэкенд недоступен',
}

export function applyNomadVisualIdentityAndTooltips() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }
  try {
    // Фон «караван и барханы» рисует сам плагин (enhanceDom). Штатный фон ядра (статуя донора)
    // держим выключенным, чтобы не было двойного фона и чужого бренда на чистом апстриме.
    window.localStorage?.setItem('hermes.desktop.backdrop.v1', 'false')
  } catch {
    // ignore storage errors
  }

  // Инжектируем оптический SVG-фильтр Apple Liquid Glass (закон Снеллиуса, выпуклая фаска + specular rim)
  const ensureAppleLiquidGlassFilter = () => {
    if (typeof document === 'undefined' || document.getElementById('nomad-liquid-glass-svg-defs')) return
    try {
      const size = 96
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (ctx) {
        const img = ctx.createImageData(size, size)
        const d = img.data
        const bezel = 0.22
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const nx = (x / (size - 1)) * 2 - 1
            const ny = (y / (size - 1)) * 2 - 1
            const dist = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 0.25)
            let dx = 0
            let dy = 0
            if (dist > 1 - bezel && dist <= 1) {
              const t = (dist - (1 - bezel)) / bezel
              const s = Math.sin(t * Math.PI * 0.5)
              const mag = s * 0.45
              const len = Math.hypot(nx, ny) || 1
              dx = (-nx / len) * mag
              dy = (-ny / len) * mag
            }
            const idx = (y * size + x) * 4
            d[idx] = Math.round(Math.max(0, Math.min(255, 128 + dx * 127)))
            d[idx + 1] = Math.round(Math.max(0, Math.min(255, 128 + dy * 127)))
            d[idx + 2] = 128
            d[idx + 3] = 255
          }
        }
        ctx.putImageData(img, 0, 0)
        const dataUrl = canvas.toDataURL()
        const svgNS = 'http://www.w3.org/2000/svg'
        const svg = document.createElementNS(svgNS, 'svg')
        svg.id = 'nomad-liquid-glass-svg-defs'
        svg.setAttribute('width', '0')
        svg.setAttribute('height', '0')
        svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;'
        svg.innerHTML = `<defs><filter id="nomad-liquid-glass-refract" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${dataUrl}" x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="dispMap"/><feDisplacementMap in="SourceGraphic" in2="dispMap" scale="14" xChannelSelector="R" yChannelSelector="G" result="displaced"/><feGaussianBlur in="displaced" stdDeviation="6" result="blurred"/><feComposite in="blurred" in2="SourceGraphic" operator="atop"/></filter></defs>`
        document.body?.appendChild(svg)
      }
    } catch {}
  }
  ensureAppleLiquidGlassFilter()

  const styleId = 'nomad-academy-brand-enhancements'
  let style = document.getElementById(styleId)
  if (!style) {
    style = document.createElement('style')
    style.id = styleId
    document.head?.appendChild(style)
  }
  {
    style.textContent = `
      :root, html, body {
        --radius: 8px !important;
        --radius-xs: 4px !important;
        --radius-sm: 6px !important;
        --radius-md: 8px !important;
        --radius-lg: 10px !important;
        --radius-xl: 12px !important;
        --radius-2xl: 12px !important;
        --primary: #18181B !important;
        --primary-foreground: #FFFFFF !important;
        --color-primary: #18181B !important;
        --color-primary-foreground: #FFFFFF !important;
        --ring: rgba(24, 24, 27, 0.16) !important;
        --composer-ring: rgba(24, 24, 27, 0.16) !important;
        --ui-stroke-primary: #D4D4D8 !important;
        --ui-stroke-secondary: #E4E4E7 !important;
        --ui-stroke-tertiary: #E4E4E7 !important;
        --ui-stroke-quaternary: #E4E4E7 !important;
        --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
        --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
        --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
        --nomad-apple-blue: #18181B;
        --nomad-apple-indigo: #27272A;
        --nomad-apple-green: #10B981;
        --nomad-accent: #18181B;
        --nomad-glass-bg: #FFFFFF;
        --nomad-glass-bg-strong: #FFFFFF;
        --nomad-glass-border: #E4E4E7;
        --nomad-glass-outline: transparent;
        --nomad-glass-border-hover: #A1A1AA;
        --nomad-glass-specular: 0 0 0 transparent;
        --nomad-glass-shadow: 0 1px 2px rgba(9, 9, 11, 0.04);
        --nomad-glass-shadow-hover: 0 2px 6px rgba(9, 9, 11, 0.06);
        --nomad-seg-bg: #F4F4F5;
        --nomad-seg-active-bg: #FFFFFF;
        --nomad-seg-active-shadow: 0 1px 2px rgba(9, 9, 11, 0.06);
      }
      .dark {
        --radius: 8px !important;
        --radius-xs: 4px !important;
        --radius-sm: 6px !important;
        --radius-md: 8px !important;
        --radius-lg: 10px !important;
        --radius-xl: 12px !important;
        --radius-2xl: 12px !important;
        --primary: #F4F4F5 !important;
        --primary-foreground: #09090B !important;
        --color-primary: #F4F4F5 !important;
        --ring: rgba(244, 244, 245, 0.25) !important;
        --composer-ring: rgba(244, 244, 245, 0.25) !important;
        --nomad-glass-bg: #18181B;
        --nomad-glass-bg-strong: #18181B;
        --nomad-glass-border: #27272A;
        --nomad-glass-outline: transparent;
        --nomad-glass-border-hover: #52525B;
        --nomad-glass-specular: 0 0 0 transparent;
        --nomad-glass-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        --nomad-glass-shadow-hover: 0 4px 10px rgba(0, 0, 0, 0.4);
        --nomad-seg-bg: #27272A;
        --nomad-seg-active-bg: #3F3F46;
        --nomad-seg-active-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }

      /* Скрываем старые оранжевые подсказки донора, барханы и мультяшного верблюда (Codeg Light Minimalist) */
      [data-slot="tip-bubble"],
      img[data-nomad-dunes-backdrop="true"],
      img[src*="nomad-dunes"],
      canvas[aria-label*="pet" i],
      div:has(> canvas[aria-label*="pet" i]),
      [data-nomad-pet-controls="true"] {
        display: none !important;
      }
      [data-tip-target] {
        outline: none !important;
        box-shadow: none !important;
        animation: none !important;
      }

      /* Единая геометрия скруглений Codeg Light Minimalist (6px–10px) */
      .rounded-xs { border-radius: 4px !important; }
      .rounded-sm { border-radius: 6px !important; }
      .rounded-md, .rounded { border-radius: 8px !important; }
      .rounded-lg { border-radius: 10px !important; }
      .rounded-xl { border-radius: 10px !important; }
      [data-slot="popover-content"],
      [data-slot="dropdown-menu-content"],
      [data-slot="dialog-content"],
      [data-slot="sheet-content"],
      [role="dialog"]:not(#nomad-onboarding-tour-root) {
        border-radius: 10px !important;
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 8px 24px -4px rgba(9, 9, 11, 0.08), 0 2px 6px rgba(9, 9, 11, 0.04) !important;
      }
      .dark [data-slot="popover-content"],
      .dark [data-slot="dropdown-menu-content"],
      .dark [data-slot="dialog-content"],
      .dark [data-slot="sheet-content"],
      .dark [role="dialog"]:not(#nomad-onboarding-tour-root) {
        background: #18181B !important;
        border-color: #27272A !important;
      }
      [data-slot="popover-content"] button,
      [data-slot="dropdown-menu-content"] [role="menuitem"],
      [data-slot="dropdown-menu-item"] {
        border-radius: 6px !important;
      }
      [role="combobox"],
      [data-slot="select-trigger"],
      [data-slot="input"],
      [data-slot="textarea"] {
        border-radius: 6px !important;
        border: 1px solid #E4E4E7 !important;
        background-color: #FFFFFF !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.02) !important;
      }
      kbd {
        border-radius: 4px !important;
        padding: 1px 5px !important;
        font-size: 10.5px !important;
        background: #F4F4F5 !important;
        border: 1px solid #E4E4E7 !important;
        color: #52525B !important;
      }

      /* Чистая светлая поверхность Codeg v0.32.4 без цветных пятен и градиентов */
      [data-testid="nomad-accounts-page"],
      [data-testid="nomad-simulator-page"],
      [data-testid="nomad-council-view"],
      [data-testid="nomad-memory-projects-view"],
      [data-testid="nomad-cloud-remote-view"],
      [data-testid="nomad-swarm-page"],
      .nomad-skills-page,
      .nomad-safety-page,
      .nomad-data-page,
      .nomad-start-page,
      .nomad-personalization-page,
      .nomad-about-page {
        position: relative;
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
        background-image: none !important;
        background-color: transparent !important;
      }

      /* Глобальный фикс склеенных flex-column карточек и кнопок */
      button[style*="flex-direction: column"],
      button[style*="flex-direction:column"],
      .nomad-track-card,
      .nomad-glass-card-btn {
        align-items: stretch !important;
        text-align: left !important;
      }
      button[style*="flex-direction: column"] > div,
      button[style*="flex-direction:column"] > div,
      .nomad-track-card > div,
      .nomad-glass-card-btn > div {
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* Универсальные карточки Codeg Light Minimalist во ВСЕХ разделах Nomad */
      .nomad-glass-surface,
      .nomad-glass-card,
      .nomad-data-volume-card,
      .nomad-data-checkpoints-card,
      .nomad-data-restore-card,
      .nomad-start-import-card,
      .nomad-start-checklist-card,
      .nomad-start-overlay-sync-card,
      [data-testid="nomad-accounts-page"] section,
      [data-testid="nomad-accounts-page"] [data-testid="ru-sovereign-models-panel"],
      [data-testid="nomad-accounts-page"] [data-testid="accounts-switch-feed"],
      [data-testid="billing-tab"] > div,
      [data-testid="fallback-tab"] > div,
      [data-testid="nomad-swarm-page"] section,
      .nomad-skills-page section,
      .nomad-skills-page [class*="-card"],
      .nomad-safety-page section,
      .nomad-safety-page [class*="-card"],
      .nomad-data-page section,
      .nomad-start-page section,
      .nomad-personalization-page section,
      .nomad-about-page section {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 10px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
      }

      /* Поля ввода, селекты и текстовые области во всех разделах Nomad — Codeg Controls */
      [data-testid="nomad-accounts-page"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-accounts-page"] select,
      [data-testid="nomad-accounts-page"] textarea,
      [data-testid="nomad-simulator-page"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-simulator-page"] select,
      [data-testid="nomad-simulator-page"] textarea,
      [data-testid="nomad-council-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-council-view"] select,
      [data-testid="nomad-council-view"] textarea,
      [data-testid="nomad-memory-projects-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-memory-projects-view"] select,
      [data-testid="nomad-memory-projects-view"] textarea,
      [data-testid="nomad-cloud-remote-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-cloud-remote-view"] select,
      [data-testid="nomad-cloud-remote-view"] textarea,
      .nomad-skills-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-skills-page select,
      .nomad-safety-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-safety-page select,
      .nomad-safety-page textarea,
      .nomad-data-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-data-page select,
      .nomad-start-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-personalization-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-personalization-page select,
      .nomad-personalization-page textarea {
        background: #FFFFFF !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.02) !important;
        border-radius: 6px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      [data-testid="nomad-accounts-page"] input:focus,
      [data-testid="nomad-simulator-page"] input:focus,
      [data-testid="nomad-council-view"] textarea:focus,
      [data-testid="nomad-memory-projects-view"] input:focus,
      [data-testid="nomad-cloud-remote-view"] input:focus,
      .nomad-skills-page input:focus,
      .nomad-safety-page input:focus,
      .nomad-data-page input:focus {
        border-color: #18181B !important;
        box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.10) !important;
        outline: none !important;
      }

      .nomad-track-card,
      .nomad-glass-card-interactive {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 8px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
      }
      .nomad-track-card:hover,
      .nomad-glass-card-interactive:hover {
        background: #FAFAFA !important;
        border-color: #D4D4D8 !important;
        box-shadow: 0 2px 6px rgba(9, 9, 11, 0.05) !important;
      }

      /* Скелетоны загрузки Codeg Zinc Shimmer */
      @keyframes nomadSkeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      html:not(.dark) [data-slot="skeleton"],
      html:not(.dark) [data-slot="count-skeleton"],
      html:not(.dark) [data-slot="model-settings-skeleton"] .animate-pulse {
        background: linear-gradient(
          90deg,
          #F4F4F5 20%,
          #E4E4E7 50%,
          #F4F4F5 80%
        ) !important;
        background-size: 200% 100% !important;
        animation: nomadSkeletonShimmer 1.75s ease-in-out infinite !important;
        border: 1px solid #E4E4E7 !important;
        border-radius: 6px !important;
      }
      .dark [data-slot="skeleton"],
      .dark [data-slot="count-skeleton"],
      .dark [data-slot="model-settings-skeleton"] .animate-pulse {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.045) 20%,
          rgba(255, 255, 255, 0.105) 50%,
          rgba(255, 255, 255, 0.045) 80%
        ) !important;
        background-size: 200% 100% !important;
        animation: nomadSkeletonShimmer 1.75s ease-in-out infinite !important;
        border: 1px solid rgba(255, 255, 255, 0.075) !important;
        border-radius: 6px !important;
      }

      /* Полировка режима HUD */
      html[data-hud-window],
      html[data-hud-window] body,
      html[data-hud-window] #root,
      [data-hud-shell],
      [data-hud-shell] [data-chat-surface] {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      /* Скрываем виджет Советника и пульт питомца в окне HUD и если нет верхней шапки */
      #nomad-buddy-fab:not(.nomad-in-titlebar),
      html[data-hud-window] #nomad-buddy-fab,
      html[data-hud-window] #nomad-buddy-drawer,
      [data-hud-shell] #nomad-buddy-fab,
      [data-hud-shell] #nomad-buddy-drawer {
        display: none !important;
      }
      [data-hud-shell]:is([data-hud-recent], [data-hud-held], [data-hud-typing], :hover, :focus-within) [data-hud-glass] {
        opacity: 1 !important;
        translate: none !important;
        background: #18181B !important;
        border: 1px solid #27272A !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28) !important;
        border-radius: 10px !important;
      }
      [data-hud-shell] [data-slot="composer-surface"] {
        border-radius: 10px !important;
        background: #FFFFFF !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 8px 24px rgba(9, 9, 11, 0.12) !important;
      }
      html[data-hud-window] [data-slot="dropdown-menu-content"],
      html[data-hud-window] [data-slot="popover-content"],
      [data-hud-shell] [data-slot="dropdown-menu-content"] {
        max-height: min(310px, calc(100vh - 68px)) !important;
        overflow-y: auto !important;
        padding: 6px !important;
        border-radius: 8px !important;
      }

      /* Переключатель «Совет моделей» в нижней панели ввода чата (Codeg Pill) */
      #nomad-composer-council-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 26px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid #E4E4E7;
        background: #FAFAFA;
        color: #52525B;
        font-size: 11.5px;
        font-weight: 500;
        letter-spacing: -0.01em;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      #nomad-composer-council-toggle:hover {
        background: #F4F4F5;
        color: #09090B;
        border-color: #D4D4D8;
      }
      #nomad-composer-council-toggle[data-active="true"] {
        background: #18181B;
        color: #FFFFFF;
        border-color: #18181B;
      }

      /* Поповер выбора моделей для «Совета моделей» над полем ввода чата */
      #nomad-composer-council-popover {
        position: fixed;
        z-index: 9992;
        width: 380px;
        padding: 14px 16px;
        border-radius: 10px;
        background: #FFFFFF;
        color: #09090B;
        border: 1px solid #E4E4E7;
        box-shadow: 0 12px 32px -4px rgba(9, 9, 11, 0.12), 0 2px 6px rgba(9, 9, 11, 0.04);
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      #nomad-composer-council-popover.hidden {
        display: none !important;
      }

      /* Интерактивный пошаговый Spotlight-онбординг */
      #nomad-onboarding-tour-root {
        position: fixed;
        inset: 0;
        z-index: 10080;
        pointer-events: auto;
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      .nomad-tour-backdrop-pane {
        position: fixed;
        background: rgba(9, 9, 11, 0.32);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        transition: all 0.24s ease;
        pointer-events: auto;
      }
      .nomad-tour-spotlight-ring {
        position: fixed;
        z-index: 10082;
        border-radius: 8px;
        border: 2px solid #18181B;
        box-shadow: 0 0 0 4px rgba(24, 24, 27, 0.16);
        pointer-events: none;
        transition: all 0.24s ease;
      }
      .nomad-tour-card {
        position: fixed;
        z-index: 10085;
        width: 392px;
        max-width: calc(100vw - 32px);
        padding: 18px 20px;
        border-radius: 10px;
        background: #FFFFFF;
        color: #09090B;
        border: 1px solid #E4E4E7;
        box-shadow: 0 16px 40px -8px rgba(9, 9, 11, 0.18);
        transition: top 0.24s ease, left 0.24s ease, transform 0.24s ease;
      }

      /* Codeg Segmented Control */
      .nomad-seg-group {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 8px;
        background: #F4F4F5;
        border: 1px solid #E4E4E7;
      }
      .nomad-seg-btn {
        appearance: none;
        border: none;
        background: transparent;
        color: #52525B;
        font-size: 12.5px;
        font-weight: 500;
        letter-spacing: -0.01em;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
      }
      .nomad-seg-btn:hover {
        color: #09090B;
      }
      .nomad-seg-btn[data-active="true"] {
        background: #FFFFFF;
        color: #09090B;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.06);
      }

      /* Монохромная типографика заголовка NOMAD в стиле Codeg (#09090B) */
      .wordmark > span > span,
      [data-slot="aui_intro"] .fit-text > span > span {
        background-image: none !important;
        color: #09090B !important;
        -webkit-text-fill-color: #09090B !important;
        font-weight: 700 !important;
        letter-spacing: -0.03em !important;
        display: inline-block !important;
      }
      .dark .wordmark > span > span,
      .dark [data-slot="aui_intro"] .fit-text > span > span {
        color: #FAFAFA !important;
        -webkit-text-fill-color: #FAFAFA !important;
      }

      /* Карточки быстрых действий на стартовом экране — Codeg Crisp Cards */
      button.card-in.hover-lift {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 8px !important;
        transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      button.card-in.hover-lift:hover {
        background: #FAFAFA !important;
        border-color: #D4D4D8 !important;
        box-shadow: 0 2px 6px rgba(9, 9, 11, 0.05) !important;
      }

      /* Пульт питомца (#nomad-pet-context-menu) в стиле Apple macOS Sequoia/Tahoe Liquid Glass */
      #nomad-pet-context-menu {
        position: fixed;
        z-index: 9999;
        width: 336px;
        max-height: calc(100vh - 84px);
        overflow-y: auto;
        border-radius: 18px;
        background: rgba(250, 249, 246, 0.86);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(28px) saturate(190%);
        -webkit-backdrop-filter: blur(28px) saturate(190%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 24px 56px -8px rgba(15, 23, 42, 0.20), 0 4px 12px rgba(15, 23, 42, 0.06);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif);
        font-size: 12px;
        padding: 15px;
        user-select: none;
      }
      .dark #nomad-pet-context-menu {
        background: rgba(20, 24, 36, 0.88);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px rgba(0, 0, 0, 0.60);
      }
      #nomad-pet-context-menu.hidden {
        display: none !important;
      }
      #nomad-pet-context-menu .np-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 10px;
        margin-bottom: 8px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }
      .dark #nomad-pet-context-menu .np-header {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      #nomad-pet-context-menu .np-title {
        font-weight: 700;
        font-size: 13px;
        letter-spacing: -0.01em;
        color: inherit;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #nomad-pet-context-menu .np-mood {
        font-size: 10.5px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.10);
        color: #2563EB;
        font-weight: 600;
      }
      .dark #nomad-pet-context-menu .np-mood {
        background: rgba(59, 130, 246, 0.22);
        color: #93C5FD;
      }
      #nomad-pet-context-menu .np-close {
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.75);
        color: inherit;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s var(--ease-out);
      }
      #nomad-pet-context-menu .np-close:hover {
        background: rgba(15, 23, 42, 0.08);
      }
      #nomad-pet-context-menu .np-section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted-foreground, #64748B);
        margin: 10px 0 5px;
      }
      #nomad-pet-context-menu .np-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
      }
      #nomad-pet-context-menu .np-label {
        color: inherit;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #nomad-pet-context-menu select,
      #nomad-pet-context-menu .np-btn {
        background: rgba(255, 255, 255, 0.72);
        color: var(--foreground, #0f172a);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
        border-radius: 9px;
        padding: 5px 9px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s var(--ease-out);
      }
      .dark #nomad-pet-context-menu select,
      .dark #nomad-pet-context-menu .np-btn {
        background: rgba(30, 41, 59, 0.78);
        color: #F8FAFC;
        border-color: rgba(255, 255, 255, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      #nomad-pet-context-menu select:hover,
      #nomad-pet-context-menu .np-btn:hover {
        border-color: rgba(37, 99, 235, 0.35);
        background: rgba(255, 255, 255, 0.94);
      }
      .dark #nomad-pet-context-menu select:hover,
      .dark #nomad-pet-context-menu .np-btn:hover {
        background: rgba(40, 52, 74, 0.92);
        border-color: rgba(96, 165, 250, 0.45);
      }
      #nomad-pet-context-menu .np-pos-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        margin-top: 4px;
      }
      #nomad-pet-context-menu .np-pos-btn {
        background: rgba(255, 255, 255, 0.66);
        color: var(--foreground, #0f172a);
        border: 1px solid rgba(15, 23, 42, 0.09);
        border-radius: 8px;
        padding: 5px 6px;
        font-size: 10.5px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s var(--ease-out);
      }
      .dark #nomad-pet-context-menu .np-pos-btn {
        background: rgba(30, 41, 59, 0.72);
        color: #CBD5E1;
        border-color: rgba(255, 255, 255, 0.09);
      }
      #nomad-pet-context-menu .np-pos-btn.active,
      #nomad-pet-context-menu .np-pos-btn:hover {
        background: rgba(37, 99, 235, 0.12);
        color: #1D4ED8;
        border-color: rgba(37, 99, 235, 0.38);
        font-weight: 700;
      }
      .dark #nomad-pet-context-menu .np-pos-btn.active,
      .dark #nomad-pet-context-menu .np-pos-btn:hover {
        background: rgba(59, 130, 246, 0.28);
        color: #FFFFFF;
      }
      #nomad-pet-context-menu .np-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
      }
      #nomad-pet-context-menu .np-stats-box {
        margin-top: 8px;
        padding: 9px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.65);
        border: 1px solid rgba(37, 99, 235, 0.18);
        font-size: 11px;
      }

      /* Значки подсказок «?» (Help Badges) и всплывающий поповер описания опций */
      .nomad-help-q {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 15px;
        height: 15px;
        margin-left: 6px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(15, 23, 42, 0.14);
        color: var(--muted-foreground, #475569);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        cursor: help;
        vertical-align: middle;
        user-select: none;
        transition: all 0.15s var(--ease-out);
      }
      .nomad-help-q:hover {
        background: #2563EB;
        color: #FFFFFF;
        border-color: #2563EB;
        transform: scale(1.06);
      }
      .dark .nomad-help-q {
        background: rgba(255, 255, 255, 0.08);
        color: #94A3B8;
        border-color: rgba(255, 255, 255, 0.16);
      }

      /* В едином всплывающем окне Настроек (SettingsView) скрываем технический блок Плагины: все настройки встроены прямо внутрь родных разделов */
      aside[data-tour="overlay-nav"] button[data-tour="nav-plugins"],
      aside[data-tour="overlay-nav"] > div:has(> button[data-tour="nav-plugins"]),
      aside[data-tour="overlay-nav"] > [id$="-plugins"] {
        display: none !important;
      }
      #nomad-native-inline-slot {
        width: 100%;
        box-sizing: border-box;
        font-variant-numeric: tabular-nums;
      }
      #nomad-native-inline-slot[data-nomad-inline-section="accounts"] {
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08));
      }
      #nomad-native-inline-slot:not([data-nomad-inline-section="accounts"]) {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08));
      }
      /* Органичная нормализация встроенных блоков под родные строки Настроек (design-guardrails + design-guide + ai-studio-ui-polish) */
      #nomad-native-inline-slot .nomad-safety-page,
      #nomad-native-inline-slot .nomad-start-page,
      #nomad-native-inline-slot .nomad-data-page,
      #nomad-native-inline-slot [data-testid="nomad-accounts-page"] {
        padding: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
      }
      #nomad-native-inline-slot .nomad-safety-page > header,
      #nomad-native-inline-slot .nomad-start-page > header,
      #nomad-native-inline-slot .nomad-data-page > header > div:first-child > h1 {
        display: none !important;
      }
      #nomad-native-inline-slot .nomad-pill-badge {
        display: none !important;
      }
      #nomad-native-inline-slot .nomad-glass-surface,
      #nomad-native-inline-slot .nomad-glass-card,
      #nomad-native-inline-slot section {
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        outline: none !important;
        border-radius: 10px !important;
        border: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08)) !important;
      }
      .dark #nomad-native-inline-slot .nomad-glass-surface,
      .dark #nomad-native-inline-slot .nomad-glass-card,
      .dark #nomad-native-inline-slot section {
        border-color: rgba(255, 255, 255, 0.08) !important;
      }
      #nomad-native-inline-slot .nomad-glass-card[data-active="true"],
      #nomad-native-inline-slot button[data-active="true"] {
        border-color: var(--nomad-accent, #2563EB) !important;
        background: rgba(37, 99, 235, 0.06) !important;
      }
      #nomad-native-inline-slot h2 {
        font-size: 13.5px !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
        line-height: 1.35 !important;
      }
      #nomad-native-inline-slot h3 {
        font-size: 13px !important;
        font-weight: 500 !important;
        letter-spacing: -0.008em !important;
        line-height: 1.35 !important;
      }

      #nomad-rich-tooltip-popover {
        position: fixed;
        z-index: 10050;
        max-width: 310px;
        padding: 9px 12px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.90);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 28px -4px rgba(15, 23, 42, 0.14);
        font-size: 11.5px;
        line-height: 1.45;
        font-weight: 500;
        pointer-events: none;
        transition: opacity 0.14s var(--ease-out);
      }
      .dark #nomad-rich-tooltip-popover {
        background: rgba(20, 25, 38, 0.92);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 14px 34px rgba(0, 0, 0, 0.55);
      }
      #nomad-rich-tooltip-popover.hidden {
        display: none !important;
      }

      /* Кнопка открытия правой боковой панели Советника в тулбаре шапки */
      #nomad-buddy-fab {
        height: 24px;
        z-index: 65;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.72);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(18px) saturate(180%);
        -webkit-backdrop-filter: blur(18px) saturate(180%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88), 0 1px 3px rgba(15, 23, 42, 0.05);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: -0.01em;
        cursor: pointer;
        -webkit-app-region: no-drag;
        white-space: nowrap;
        transition: background-color 0.16s var(--ease-out), border-color 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out), transform 0.12s var(--ease-out);
      }
      #nomad-buddy-fab.nomad-in-titlebar {
        position: relative !important;
        right: auto !important;
        top: auto !important;
        margin-right: 6px !important;
      }
      #nomad-buddy-fab:hover {
        background: rgba(255, 255, 255, 0.94);
        border-color: rgba(37, 99, 235, 0.35);
        box-shadow: inset 0 1px 0 #FFFFFF, 0 3px 10px rgba(37, 99, 235, 0.12);
      }
      #nomad-buddy-fab:active {
        transform: scale(0.97);
      }
      .dark #nomad-buddy-fab {
        background: rgba(24, 30, 46, 0.76);
        color: #E2E8F0;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 6px rgba(0, 0, 0, 0.3);
      }
      .dark #nomad-buddy-fab:hover {
        background: rgba(32, 40, 60, 0.92);
        border-color: rgba(96, 165, 250, 0.45);
      }

      /* Подсвечиваем штатную кнопку «Открыть настройки» в шапке в едином стиле капсулы, чтобы её всегда было видно */
      button[title="Открыть настройки"],
      button[aria-label="Открыть настройки"] {
        border-radius: 999px !important;
        transition: background-color 0.15s var(--ease-out), color 0.15s var(--ease-out) !important;
      }
      button[title="Открыть настройки"]:hover,
      button[aria-label="Открыть настройки"]:hover {
        background: rgba(37, 99, 235, 0.10) !important;
        color: #2563EB !important;
      }

      /* Правая боковая панель чата с Советником (#nomad-buddy-drawer) во всю высоту рабочего окна */
      #nomad-buddy-drawer {
        position: fixed;
        right: 0;
        top: 32px;
        bottom: 22px;
        width: 368px;
        max-height: none;
        z-index: 9990;
        display: flex;
        flex-direction: column;
        border-radius: 14px 0 0 14px;
        background: rgba(248, 246, 241, 0.94);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(32px) saturate(195%);
        -webkit-backdrop-filter: blur(32px) saturate(195%);
        border-left: 1px solid rgba(15, 23, 42, 0.10);
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.92), -16px 0 40px -8px rgba(15, 23, 42, 0.14);
        overflow: hidden;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif);
      }
      .dark #nomad-buddy-drawer {
        background: rgba(16, 20, 32, 0.94);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.12), -20px 0 48px rgba(0, 0, 0, 0.58);
      }
      #nomad-buddy-drawer.hidden {
        display: none !important;
      }
    `
  }

  // Настройки маскота с жёсткой фиксацией позиции по умолчанию (randomWalk: false, position: 'bottom-right')
  const MASCOT_SETTINGS_KEY = 'nomad.mascot.settings.v1'
  const DEFAULT_MASCOT_SETTINGS = {
    mascotId: 'camel',
    size: 0.45,
    position: 'bottom-right',
    lockedX: null,
    lockedY: null,
    soundEnabled: true,
    soundVolume: 0.5,
    randomWalk: false,
    autoApproveSafe: true,
    smartApprove: false,
    focusMode: false,
    batterySaveMode: false,
    pomodoroEnabled: false,
  }

  const loadMascotSettings = () => {
    try {
      const raw = localStorage.getItem(MASCOT_SETTINGS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        return { ...DEFAULT_MASCOT_SETTINGS, ...parsed }
      }
    } catch {}
    return { ...DEFAULT_MASCOT_SETTINGS }
  }

  const saveMascotSettings = next => {
    try {
      localStorage.setItem(MASCOT_SETTINGS_KEY, JSON.stringify(next))
      localStorage.setItem('hermes.desktop.pet-roam.v1', next.randomWalk ? 'true' : 'false')
      localStorage.setItem('hermes.desktop.pet.roam', next.randomWalk ? 'true' : 'false')
    } catch {}
  }

  // Синхронизируем запрет самопроизвольного перемещения при старте
  try {
    const initialSt = loadMascotSettings()
    if (!initialSt.randomWalk) {
      localStorage.setItem('hermes.desktop.pet-roam.v1', 'false')
      localStorage.setItem('hermes.desktop.pet.roam', 'false')
    }
  } catch {}

  const playMascotTone = (freq = 587.33, dur = 0.09) => {
    try {
      const s = loadMascotSettings()
      if (!s.soundEnabled || s.soundVolume <= 0) return
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(Math.min(1, s.soundVolume * 0.25), ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + dur)
    } catch {}
  }

  const MASCOT_CATALOG = [
    { slug: 'camel', label: 'Караванный верблюд', group: 'Караван Nomad', greeting: 'Караван готов к маршруту.' },
    { slug: 'skrepka', label: 'Скрепка (классическая)', group: 'Коллекция «Скрепка»', greeting: 'Похоже, ты пишешь код. Чем помочь?' },
    { slug: 'skrepka-steel', label: 'Скрепка стальная', group: 'Коллекция «Скрепка»', greeting: 'Стальная Скрепка на связи.' },
    { slug: 'ogryzok', label: 'Огрызок (яблоко)', group: 'Коллекция «Скрепка»', greeting: 'На связи — готов к работе.' },
    { slug: 'omleton', label: 'Омлетон (ИИшница)', group: 'Коллекция «Скрепка»', greeting: 'Готовим рабочий прототип.' },
    { slug: 'kot', label: 'Кот в наушниках', group: 'Коллекция «Скрепка»', greeting: 'Фокус-режим активирован.' },
    { slug: 'kapibara', label: 'Капибара (спокойствие)', group: 'Коллекция «Скрепка»', greeting: 'Спокойствие и чистая архитектура.' },
    { slug: 'pelmen', label: 'Пельмень с укропом', group: 'Коллекция «Скрепка»', greeting: 'На посту, проверяю сборку.' },
    { slug: 'robo', label: 'Робот (жестяной)', group: 'Коллекция «Скрепка»', greeting: 'Системы в норме.' },
    { slug: 'prizrak', label: 'Призрак', group: 'Коллекция «Скрепка»', greeting: 'Работаю в фоновом режиме.' },
    { slug: 'terminal', label: 'Терминал (ретро-CRT)', group: 'Коллекция «Скрепка»', greeting: 'READY > Жду команду в терминале.' },
    { slug: 'boba', label: 'Боба (бабл-ти)', group: 'Караван Nomad', greeting: 'Готов к следующей задаче.' },
    { slug: 'lulu-capybara-2', label: 'Капибара Лулу', group: 'Караван Nomad', greeting: 'Привет от капибары Лулу.' },
  ]

  // Глобальный поповер для значков «?» и богатых тултипов
  const ensureRichTooltipPopover = () => {
    let pop = document.getElementById('nomad-rich-tooltip-popover')
    if (!pop) {
      pop = document.createElement('div')
      pop.id = 'nomad-rich-tooltip-popover'
      pop.setAttribute('data-testid', 'nomad-rich-tooltip-popover')
      pop.className = 'hidden'
      document.body.appendChild(pop)
    }
    if (!window.__nomadRichTooltipBound) {
      window.__nomadRichTooltipBound = true
      const showTip = (targetEl, text) => {
        if (!text || !pop) return
        pop.textContent = text
        pop.classList.remove('hidden')
        const rect = targetEl.getBoundingClientRect()
        const popW = Math.min(310, pop.offsetWidth || 260)
        const popH = pop.offsetHeight || 58
        const left = Math.max(12, Math.min((window.innerWidth || 1200) - popW - 16, rect.left - 8))
        const top = rect.top > popH + 20 ? rect.top - popH - 8 : rect.bottom + 8
        pop.style.left = `${Math.round(left)}px`
        pop.style.top = `${Math.round(top)}px`
      }
      const hideTip = () => {
        pop?.classList.add('hidden')
      }
      document.addEventListener(
        'pointerover',
        e => {
          const badge = e.target?.closest?.('[data-nomad-tooltip]')
          if (badge) {
            showTip(badge, badge.getAttribute('data-nomad-tooltip'))
          }
        },
        true,
      )
      document.addEventListener(
        'pointerout',
        e => {
          const badge = e.target?.closest?.('[data-nomad-tooltip]')
          if (badge) {
            hideTip()
          }
        },
        true,
      )
    }
  }

  // Правая боковая панель чата с Советником (Ника & Сократ): кнопка в тулбаре шапки открывает полноценный правый сайдбар-чат
  const ensureBuddyAdvisorWidget = () => {
    // Никогда не монтируем Советника в компактном окне HUD
    if (
      document.documentElement.hasAttribute('data-hud-window') ||
      document.querySelector('[data-hud-shell]')
    ) {
      document.getElementById('nomad-buddy-fab')?.remove()
      document.getElementById('nomad-buddy-drawer')?.remove()
      return
    }

    // Удаляем старые капсулы из верхней шапки, если они остались
    document.getElementById('nomad-quick-hub-bar')?.remove()

    const settingsBtn = document.querySelector(
      'button[title="Открыть настройки"], button[aria-label="Открыть настройки"], button[title="Open settings"]',
    )
    const titlebarTools = settingsBtn?.parentElement
    if (!titlebarTools) {
      return
    }

    let fab = document.getElementById('nomad-buddy-fab')
    let drawer = document.getElementById('nomad-buddy-drawer')

    if (!fab) {
      fab = document.createElement('button')
      fab.id = 'nomad-buddy-fab'
      fab.type = 'button'
      fab.className = 'nomad-in-titlebar'
      fab.setAttribute('data-testid', 'nomad-buddy-fab')
      fab.setAttribute(
        'title',
        'Открыть правую боковую панель чата с Советником (Ника и Сократ)',
      )
      fab.innerHTML = `<span style="width:6px;height:6px;border-radius:999px;background:#007AFF;display:inline-block;box-shadow:0 0 0 2px rgba(0,122,255,0.18);"></span><span>Советник</span>`
    }

    if (fab.parentElement !== titlebarTools) {
      fab.classList.add('nomad-in-titlebar')
      titlebarTools.insertBefore(fab, titlebarTools.firstChild)
    }

    if (!drawer) {
      drawer = document.createElement('aside')
      drawer.id = 'nomad-buddy-drawer'
      drawer.setAttribute('data-testid', 'nomad-buddy-drawer')
      drawer.className = 'hidden'
      document.body.appendChild(drawer)

      window.__nomadBuddyPersona = window.__nomadBuddyPersona || 'nika'
      window.__nomadBuddyHistory = window.__nomadBuddyHistory || {
        nika: [
          {
            role: 'assistant',
            text: 'Привет! Я Ника — помощник по продукту Nomad. Помогу настроить модели, подключить облачный ПК, разобраться с памятью проектов или запустить нужный навык. О чём расскажем?',
          },
        ],
        sokrat: [
          {
            role: 'assistant',
            text: 'Приветствую. Я Сократ — ментор и архитектурный оппонент. Можем разобрать выбор моделей под задачу, защиту данных 152-ФЗ, корпоративные коннекторы или сценарии тренажёра.',
          },
        ],
      }

      const renderBuddyDrawer = () => {
        const persona = window.__nomadBuddyPersona || 'nika'
        const isNika = persona === 'nika'
        const historyList = window.__nomadBuddyHistory[persona] || []

        drawer.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(15,23,42,0.08);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="width:28px;height:28px;border-radius:9px;background:${isNika ? 'linear-gradient(135deg,#007AFF,#3B82F6)' : 'linear-gradient(135deg,#334155,#0F172A)'};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:-0.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35);">
                ${isNika ? 'Н' : 'С'}
              </span>
              <div>
                <div style="font-size:13px;font-weight:700;letter-spacing:-0.01em;">Советник · ${isNika ? 'Ника' : 'Сократ'}</div>
                <div style="font-size:11px;opacity:0.65;">${isNika ? 'Чат с помощником по системе' : 'Архитектурный ментор и ревью'}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" data-buddy-clear="1" title="Очистить историю чата" style="border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.65);color:inherit;padding:0 8px;height:24px;border-radius:999px;cursor:pointer;font-size:10.5px;font-weight:600;">Очистить</button>
              <button type="button" data-buddy-close="1" title="Скрыть боковую панель Советника" style="border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.65);color:inherit;width:24px;height:24px;border-radius:999px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">×</button>
            </div>
          </div>

          <div style="padding:10px 16px 6px;">
            <div class="nomad-seg-group" style="width:100%;display:grid;grid-template-columns:1fr 1fr;">
              <button type="button" class="nomad-seg-btn" data-buddy-persona="nika" data-active="${isNika ? 'true' : 'false'}" style="justify-content:center;padding:5px 10px;font-size:11.5px;">
                Ника · Помощник
              </button>
              <button type="button" class="nomad-seg-btn" data-buddy-persona="sokrat" data-active="${!isNika ? 'true' : 'false'}" style="justify-content:center;padding:5px 10px;font-size:11.5px;">
                Сократ · Ментор
              </button>
            </div>
          </div>

          <div data-testid="nomad-buddy-chat-scroll" style="flex:1;padding:10px 16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;">
            ${historyList
              .map((msg, idx) => {
                const isLastAssistant =
                  msg.role === 'assistant' &&
                  idx ===
                    historyList
                      .map((m, i) => (m.role === 'assistant' ? i : -1))
                      .filter(i => i >= 0)
                      .pop()
                if (msg.role === 'user') {
                  return `<div style="align-self:flex-end;max-width:86%;padding:9px 12px;border-radius:14px 14px 4px 14px;background:#007AFF;color:#FFFFFF;font-size:12px;line-height:1.48;box-shadow:0 2px 8px rgba(0,122,255,0.18);white-space:pre-wrap;">${msg.text}</div>`
                }
                return `<div ${isLastAssistant ? 'data-testid="nomad-buddy-answer"' : ''} style="align-self:flex-start;max-width:94%;padding:11px 13px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,0.78);border:1px solid rgba(15,23,42,0.08);box-shadow:inset 0 1px 0 rgba(255,255,255,0.9);font-size:12px;line-height:1.54;white-space:pre-wrap;">${msg.text}</div>`
              })
              .join('')}

            <div style="margin-top:auto;padding-top:8px;">
              <div style="font-size:10px;font-weight:700;opacity:0.55;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Быстрые вопросы</div>
              <div style="display:flex;flex-direction:column;gap:5px;">
                ${[
                  'Как включить Совет моделей в поле ввода чата?',
                  'Как подключить GigaChat, YandexGPT и МТС Cotype?',
                  'Как подключить коннекторы 1С, Битрикс24 и Диадок?',
                  'Как настроить безопасность 152-ФЗ и защиту ПДн?',
                  'С чего начать практику в Симуляторе ИИ?',
                ]
                  .map(
                    q =>
                      `<button type="button" data-buddy-chip="${q.replace(/"/g, '&quot;')}" style="text-align:left;padding:6px 10px;border-radius:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.58);color:inherit;font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background-color 0.15s ease;"><span>${q}</span><span style="opacity:0.45;font-size:11px;">→</span></button>`,
                  )
                  .join('')}
              </div>
            </div>
          </div>

          <div style="padding:10px 14px 14px;border-top:1px solid rgba(15,23,42,0.08);display:flex;gap:8px;background:rgba(255,255,255,0.55);">
            <input type="text" data-testid="nomad-buddy-drawer-input" placeholder="Напишите ${isNika ? 'Нике' : 'Сократу'}…" style="flex:1;padding:8px 11px;border-radius:10px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.88);color:inherit;font-size:12px;outline:none;" />
            <button type="button" data-testid="nomad-buddy-drawer-send" style="padding:8px 14px;border-radius:10px;border:none;background:#007AFF;color:#fff;font-size:12px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);">Отправить</button>
          </div>
        `

        const scrollBox = drawer.querySelector('[data-testid="nomad-buddy-chat-scroll"]')
        if (scrollBox) {
          scrollBox.scrollTop = scrollBox.scrollHeight
        }

        const askBackend = async questionText => {
          const q = (questionText || '').trim()
          if (!q) return
          const p = window.__nomadBuddyPersona || 'nika'
          window.__nomadBuddyHistory[p] = window.__nomadBuddyHistory[p] || []
          window.__nomadBuddyHistory[p].push({ role: 'user', text: q })
          window.__nomadBuddyHistory[p].push({ role: 'assistant', text: 'Формирую ответ…' })
          renderBuddyDrawer()

          try {
            const headers = { 'Content-Type': 'application/json' }
            if (window.__HERMES_SESSION_TOKEN__) {
              headers['X-Hermes-Session-Token'] = window.__HERMES_SESSION_TOKEN__
            }
            const res = await fetch('/api/plugins/nomad/buddy/ask', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                persona: p,
                question: q,
                page: window.location.hash || window.location.pathname || '/',
              }),
            })
            if (res.ok) {
              const data = await res.json()
              const list = window.__nomadBuddyHistory[p]
              if (list && list.length > 0 && data?.answer) {
                list[list.length - 1] = { role: 'assistant', text: data.answer }
                renderBuddyDrawer()
              }
            }
          } catch {
            const list = window.__nomadBuddyHistory[p]
            if (list && list.length > 0) {
              list[list.length - 1] = {
                role: 'assistant',
                text: 'Откройте интересующий раздел настроек или выберите тему выше — подскажу оптимальную конфигурацию.',
              }
              renderBuddyDrawer()
            }
          }
        }

        drawer.querySelector('[data-buddy-close]')?.addEventListener('click', () => {
          drawer.classList.add('hidden')
        })
        drawer.querySelector('[data-buddy-clear]')?.addEventListener('click', () => {
          const p = window.__nomadBuddyPersona || 'nika'
          window.__nomadBuddyHistory[p] = [window.__nomadBuddyHistory[p][0]]
          renderBuddyDrawer()
        })
        drawer.querySelectorAll('[data-buddy-persona]').forEach(btn => {
          btn.addEventListener('click', () => {
            window.__nomadBuddyPersona = btn.getAttribute('data-buddy-persona') || 'nika'
            renderBuddyDrawer()
          })
        })
        drawer.querySelectorAll('[data-buddy-chip]').forEach(chip => {
          chip.addEventListener('click', () => {
            askBackend(chip.getAttribute('data-buddy-chip'))
          })
        })
        const inp = drawer.querySelector('[data-testid="nomad-buddy-drawer-input"]')
        const sendBtn = drawer.querySelector('[data-testid="nomad-buddy-drawer-send"]')
        sendBtn?.addEventListener('click', () => askBackend(inp?.value || ''))
        inp?.addEventListener('keydown', e => {
          if (e.key === 'Enter') askBackend(inp.value || '')
        })
      }

      window.openNomadBuddy = (persona = 'nika', initialQuestion = '') => {
        window.__nomadBuddyPersona = persona === 'socrates' ? 'sokrat' : persona
        drawer.classList.remove('hidden')
        renderBuddyDrawer()
        if (initialQuestion) {
          const chipBtn = drawer.querySelector('[data-testid="nomad-buddy-drawer-send"]')
          const inp = drawer.querySelector('[data-testid="nomad-buddy-drawer-input"]')
          if (inp) inp.value = initialQuestion
          chipBtn?.click()
        }
      }

      fab.addEventListener('click', () => {
        if (drawer.classList.contains('hidden')) {
          drawer.classList.remove('hidden')
          renderBuddyDrawer()
        } else {
          drawer.classList.add('hidden')
        }
      })
    }
  }

  // Вычисляем фиксированные координаты маскота относительно его offsetParent (<main> или viewport)
  const computePinnedPetCoords = (petContainer, st) => {
    const rect = petContainer.getBoundingClientRect()
    const parentEl = petContainer.offsetParent || document.documentElement
    const w = rect.width || 110
    const h = rect.height || 110
    const vw = parentEl.clientWidth || window.innerWidth || 1280
    const vh = parentEl.clientHeight || window.innerHeight || 820
    const marginX = 34
    const marginBottom = 114 // выше поля ввода чата и нижней строки статуса

    if (st.position === 'bottom-left') {
      return { x: marginX, y: Math.max(48, vh - h - marginBottom) }
    }
    if (st.position === 'top-left') {
      return { x: marginX, y: 56 }
    }
    if (st.position === 'top-right') {
      return { x: Math.max(24, vw - w - marginX), y: 56 }
    }
    if (st.position === 'bottom-right') {
      return { x: Math.max(24, vw - w - marginX), y: Math.max(48, vh - h - marginBottom) }
    }
    // Если 'free', но randomWalk === false — держим сохранённую точку lockedX/lockedY внутри родителя
    if (typeof st.lockedX === 'number' && typeof st.lockedY === 'number') {
      return {
        x: Math.max(12, Math.min(vw - w - 16, st.lockedX)),
        y: Math.max(12, Math.min(vh - h - 48, st.lockedY)),
      }
    }
    return { x: Math.max(24, vw - w - marginX), y: Math.max(48, vh - h - marginBottom) }
  }

  const enforcePetPositionLock = petContainer => {
    if (!petContainer || window.__nomadPetDragging) return
    const st = loadMascotSettings()
    if (st.randomWalk && st.position === 'free') return
    const target = computePinnedPetCoords(petContainer, st)
    const wantLeft = `${Math.round(target.x)}px`
    const wantTop = `${Math.round(target.y)}px`
    if (petContainer.style.left !== wantLeft) {
      petContainer.style.setProperty('left', wantLeft, 'important')
    }
    if (petContainer.style.top !== wantTop) {
      petContainer.style.setProperty('top', wantTop, 'important')
    }
    if (petContainer.style.right && petContainer.style.right !== 'auto') {
      petContainer.style.setProperty('right', 'auto', 'important')
    }
    if (petContainer.style.bottom && petContainer.style.bottom !== 'auto') {
      petContainer.style.setProperty('bottom', 'auto', 'important')
    }
    if (petContainer.style.transform && petContainer.style.transform !== 'none') {
      petContainer.style.setProperty('transform', 'none', 'important')
    }
  }

  const enhanceDom = () => {
    try {
      const isHudWindow =
        typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('win') === 'hud' ||
          Boolean(document.querySelector('[data-hud-shell]')))
      ensureRichTooltipPopover()
      ensureBuddyAdvisorWidget()

      // 1. В светлом минимализме Codeg убираем иллюстрацию с барханами и мультяшного маскота
      document.querySelectorAll('img[data-nomad-dunes-backdrop="true"], img[src*="nomad-dunes"]').forEach(el => {
        el.remove()
      })

      // 2. Скрываем мультяшного питомца поверх интерфейса
      const petCanvas = document.querySelector('canvas[aria-label*="pet"]')
      const petContainer = petCanvas?.parentElement?.parentElement
      if (petContainer) {
        petContainer.style.setProperty('display', 'none', 'important')
        enforcePetPositionLock(petContainer)

        if (!petContainer.hasAttribute('data-nomad-pos-lock-bound')) {
          petContainer.setAttribute('data-nomad-pos-lock-bound', 'true')
          petContainer.addEventListener(
            'pointerdown',
            e => {
              if (e.button === 0) {
                window.__nomadPetDragging = true
              }
            },
            true,
          )
          window.addEventListener(
            'pointerup',
            () => {
              if (window.__nomadPetDragging) {
                window.__nomadPetDragging = false
                const rect = petContainer.getBoundingClientRect()
                const parentRect = (petContainer.offsetParent || document.documentElement).getBoundingClientRect()
                const cur = loadMascotSettings()
                cur.lockedX = Math.round(rect.left - parentRect.left)
                cur.lockedY = Math.round(rect.top - parentRect.top)
                saveMascotSettings(cur)
              }
            },
            true,
          )
          const styleLockObserver = new MutationObserver(() => {
            enforcePetPositionLock(petContainer)
          })
          styleLockObserver.observe(petContainer, { attributes: true, attributeFilter: ['style'] })
        }
      }

      if (petContainer && !petContainer.querySelector('[data-testid="nomad-pet-zoom-controls-v3"]')) {
        petContainer.querySelectorAll('[data-nomad-pet-controls="true"]').forEach(el => el.remove())
        petContainer.setAttribute('data-nomad-pet-enhanced', 'true')
        petContainer.setAttribute('data-slot', 'context-menu-trigger')
        petContainer.setAttribute(
          'title',
          'Питомец Nomad · ПКМ — пульт настроек, скины Petdex, апрувы и Бадди Ника/Сократ · Колесо мыши — размер',
        )

        let hoverLeaveTimer = null
        const setHovered = on => {
          if (hoverLeaveTimer) {
            clearTimeout(hoverLeaveTimer)
            hoverLeaveTimer = null
          }
          if (on) {
            petContainer.setAttribute('data-nomad-pet-hovered', 'true')
          } else {
            hoverLeaveTimer = setTimeout(() => {
              petContainer.removeAttribute('data-nomad-pet-hovered')
            }, 220)
          }
        }

        petContainer.addEventListener('pointerenter', () => setHovered(true))
        petContainer.addEventListener('pointerleave', () => setHovered(false))

        let statusOrb = petContainer.querySelector('[data-nomad-status-orb="true"]')
        if (!statusOrb) {
          statusOrb = document.createElement('div')
          statusOrb.setAttribute('data-nomad-status-orb', 'true')
          statusOrb.setAttribute('data-testid', 'nomad-pet-status-orb')
          statusOrb.style.cssText =
            'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;padding:5px 10px;border-radius:12px;background:var(--card,#ffffff);border:1.5px solid #4C6EF5;color:var(--foreground,#14151C);font-size:11px;font-weight:700;white-space:nowrap;display:none;align-items:center;gap:6px;z-index:8;box-shadow:0 6px 18px rgba(20,21,28,0.16);pointer-events:auto;'
          statusOrb.addEventListener('pointerdown', e => e.stopPropagation())
          petContainer.appendChild(statusOrb)
        }

        const triggerVoiceCommandToSession = targetSessionId => {
          playMascotTone(659.25, 0.08)
          window.dispatchEvent(new CustomEvent('hermes:composer-dictation', { detail: { target: 'main' } }))
          statusOrb.style.display = 'inline-flex'
          statusOrb.innerHTML = `
            <span style="color:#4C6EF5;">🎙️ Слушаю команду…</span>
            <button type="button" data-orb-stop="1" style="border:none;background:rgba(239,68,68,0.15);color:#dc2626;border-radius:6px;padding:1px 6px;font-size:10px;cursor:pointer;font-weight:700;">Стоп</button>
          `
          statusOrb.querySelector('[data-orb-stop]')?.addEventListener('click', e => {
            e.stopPropagation()
            if (window.__nomadSpeechRec) {
              try { window.__nomadSpeechRec.stop() } catch {}
            }
            statusOrb.style.display = 'none'
          })

          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
          if (SpeechRec) {
            try {
              if (window.__nomadSpeechRec) {
                try { window.__nomadSpeechRec.abort() } catch {}
              }
              const rec = new SpeechRec()
              window.__nomadSpeechRec = rec
              rec.lang = 'ru-RU'
              rec.interimResults = true
              rec.continuous = false
              rec.onresult = ev => {
                let txt = ''
                for (let i = ev.resultIndex; i < ev.results.length; i++) {
                  txt += ev.results[i][0].transcript
                }
                if (txt.trim()) {
                  statusOrb.innerHTML = `<span style="color:#4C6EF5;">🎙️ «${txt.trim().slice(0, 38)}»</span>`
                }
                if (ev.results[ev.results.length - 1]?.isFinal && txt.trim()) {
                  const finalCmd = txt.trim()
                  const sdk = window.__HERMES_PLUGIN_SDK__
                  const sid = targetSessionId || null
                  const submitted = sdk?.host?.composer?.submit?.(sid, finalCmd)
                  if (!submitted) {
                    sdk?.host?.composer?.insertText?.(sid, finalCmd)
                  }
                  window.__nomadPluginCtx?.pet?.say?.(`Отправил в сессию: «${finalCmd.slice(0, 45)}»`, {
                    id: 'voice-cmd',
                    ttlMs: 4000,
                  })
                  setTimeout(() => {
                    if (!window.__nomadLiveVoiceActive) statusOrb.style.display = 'none'
                  }, 1800)
                }
              }
              rec.onerror = () => {
                setTimeout(() => {
                  if (!window.__nomadLiveVoiceActive) statusOrb.style.display = 'none'
                }, 2200)
              }
              rec.start()
            } catch {}
          } else {
            window.__nomadPluginCtx?.pet?.say?.('🎙️ Голосовая диктовка активна в поле ввода чата!', {
              id: 'voice-cmd',
              ttlMs: 3500,
            })
            setTimeout(() => {
              if (!window.__nomadLiveVoiceActive) statusOrb.style.display = 'none'
            }, 3000)
          }
        }

        const toggleRealtimeVoiceWithMascot = () => {
          window.__nomadLiveVoiceActive = !window.__nomadLiveVoiceActive
          playMascotTone(window.__nomadLiveVoiceActive ? 783.99 : 440, 0.1)
          window.dispatchEvent(new CustomEvent('hermes:composer-voice-toggle', { detail: { target: 'main' } }))
          try {
            localStorage.setItem('hermes.desktop.voice.autoSpeakReplies', window.__nomadLiveVoiceActive ? 'true' : 'false')
          } catch {}

          if (window.__nomadLiveVoiceActive) {
            statusOrb.style.display = 'inline-flex'
            statusOrb.innerHTML = `
              <span style="color:#059669;">🗣️ Live-голос в реалтайме</span>
              <button type="button" data-orb-live-stop="1" style="border:none;background:rgba(239,68,68,0.16);color:#dc2626;border-radius:6px;padding:1px 6px;font-size:10px;cursor:pointer;font-weight:700;">Выкл</button>
            `
            statusOrb.querySelector('[data-orb-live-stop]')?.addEventListener('click', e => {
              e.stopPropagation()
              toggleRealtimeVoiceWithMascot()
            })
            window.__nomadPluginCtx?.pet?.say?.('🗣️ Реалтайм-голос включён! Говори со мной свободно.', {
              id: 'voice-live',
              ttlMs: 5000,
            })
          } else {
            statusOrb.style.display = 'none'
            window.__nomadPluginCtx?.pet?.say?.('Реалтайм-голос остановлен.', {
              id: 'voice-live',
              ttlMs: 2500,
            })
          }
        }

        const resolveSessionApproval = async (sessionId, decision = 'once') => {
          playMascotTone(decision === 'deny' ? 349.23 : 698.46, 0.08)
          const sdk = window.__HERMES_PLUGIN_SDK__
          let handled = false

          const selector = decision === 'deny' ? '[data-approval-deny]' : '[data-approval-run]'
          const domBtn = document.querySelector(selector)
          if (domBtn && !domBtn.disabled) {
            domBtn.click()
            handled = true
          }

          if (!handled && sdk?.host?.request) {
            try {
              const pending = await sdk.host.request('approval.pending', {
                ...(sessionId ? { session_id: sessionId } : {}),
                profile: 'nomad',
              })
              const reqId = pending?.request_id || pending?.requestId
              if (reqId) {
                await sdk.host.request('approval.respond', {
                  request_id: reqId,
                  choice: decision,
                  ...(sessionId ? { session_id: sessionId } : {}),
                  profile: 'nomad',
                })
                handled = true
              }
            } catch {}
          }

          if (!handled && sdk?.host?.composer) {
            const msg = decision === 'deny' ? 'Отклоняю, не выполняй этот шаг.' : 'Одобряю, подтверждаю выполнение — продолжай!'
            handled = Boolean(sdk.host.composer.submit(sessionId || null, msg))
          }

          window.__nomadPluginCtx?.pet?.say?.(
            decision === 'deny'
              ? '✗ Запрос в сессии отклонён'
              : '✓ Одобрено! Сессия продолжает работу',
            { id: 'mascot-approval', ttlMs: 4000 },
          )
          return handled
        }

        const ctrlBar = document.createElement('div')
        ctrlBar.setAttribute('data-nomad-pet-controls', 'true')
        ctrlBar.setAttribute('data-testid', 'nomad-pet-zoom-controls-v3')
        ctrlBar.style.cssText =
          'position:absolute;top:100%;left:50%;margin-top:4px;display:inline-flex;align-items:center;gap:2px;padding:2px 7px;border-radius:999px;background:var(--card,#ffffff);border:1px solid rgba(76,110,245,0.35);color:var(--foreground,#14151C);font-size:11px;font-weight:700;z-index:5;box-shadow:0 4px 12px rgba(20,21,28,0.16);'
        ctrlBar.addEventListener('pointerenter', () => setHovered(true))
        ctrlBar.addEventListener('pointerleave', () => setHovered(false))

        const sizeLabel = document.createElement('span')
        const getScaleMultiplier = () => {
          const w = petCanvas?.getBoundingClientRect().width || 86
          return Math.max(0.3, Math.min(2.5, w / 86))
        }
        const updateScaleText = () => {
          sizeLabel.textContent = `${getScaleMultiplier().toFixed(1)}×`
        }
        updateScaleText()
        sizeLabel.style.cssText = 'font-size:9.5px;opacity:0.9;padding:0 2px;font-weight:700;min-width:24px;text-align:center;'

        const triggerResize = deltaY => {
          const rect = petContainer.getBoundingClientRect()
          const evt = new WheelEvent('wheel', {
            deltaY,
            altKey: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true,
          })
          petContainer.dispatchEvent(evt)
          setTimeout(updateScaleText, 40)
        }

        const btnMinus = document.createElement('button')
        btnMinus.type = 'button'
        btnMinus.textContent = '−'
        btnMinus.title = 'Уменьшить размер питомца'
        btnMinus.style.cssText =
          'border:none;background:transparent;color:inherit;cursor:pointer;padding:0 4px;font-size:13px;font-weight:800;line-height:1.2;'
        btnMinus.addEventListener('pointerdown', e => e.stopPropagation())
        btnMinus.addEventListener('click', e => {
          e.stopPropagation()
          triggerResize(120)
          playMascotTone(440, 0.06)
        })

        const btnPlus = document.createElement('button')
        btnPlus.type = 'button'
        btnPlus.textContent = '+'
        btnPlus.title = 'Увеличить размер питомца'
        btnPlus.style.cssText =
          'border:none;background:transparent;color:inherit;cursor:pointer;padding:0 4px;font-size:13px;font-weight:800;line-height:1.2;'
        btnPlus.addEventListener('pointerdown', e => e.stopPropagation())
        btnPlus.addEventListener('click', e => {
          e.stopPropagation()
          triggerResize(-120)
          playMascotTone(660, 0.06)
        })

        const btnMic = document.createElement('button')
        btnMic.type = 'button'
        btnMic.textContent = '🎙️'
        btnMic.title = 'Ввести команду голосом в активную сессию'
        btnMic.style.cssText =
          'border:none;background:transparent;color:inherit;cursor:pointer;padding:0 3px;font-size:11px;line-height:1.2;'
        btnMic.addEventListener('pointerdown', e => e.stopPropagation())
        btnMic.addEventListener('click', e => {
          e.stopPropagation()
          triggerVoiceCommandToSession(null)
        })

        const btnLive = document.createElement('button')
        btnLive.type = 'button'
        btnLive.textContent = '🗣️'
        btnLive.title = 'Общаться голосом в реалтайме'
        btnLive.style.cssText =
          'border:none;background:transparent;color:inherit;cursor:pointer;padding:0 3px;font-size:11px;line-height:1.2;'
        btnLive.addEventListener('pointerdown', e => e.stopPropagation())
        btnLive.addEventListener('click', e => {
          e.stopPropagation()
          toggleRealtimeVoiceWithMascot()
        })

        ctrlBar.appendChild(btnMinus)
        ctrlBar.appendChild(sizeLabel)
        ctrlBar.appendChild(btnPlus)
        ctrlBar.appendChild(btnMic)
        ctrlBar.appendChild(btnLive)
        petContainer.appendChild(ctrlBar)

        let pomoBadge = petContainer.querySelector('[data-nomad-pomodoro="true"]')
        if (!pomoBadge) {
          pomoBadge = document.createElement('div')
          pomoBadge.setAttribute('data-nomad-pomodoro', 'true')
          pomoBadge.style.cssText =
            'position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;padding:3px 9px;border-radius:999px;background:var(--card,#ffffff);border:1.5px solid #4C6EF5;color:var(--foreground,#14151C);font-size:10.5px;font-weight:700;white-space:nowrap;display:none;align-items:center;gap:5px;z-index:6;box-shadow:0 4px 12px rgba(20,21,28,0.16);'
          petContainer.appendChild(pomoBadge)
        }

        const syncPomodoroBadge = () => {
          const st = loadMascotSettings()
          if (!st.pomodoroEnabled) {
            pomoBadge.style.display = 'none'
            if (window.__nomadPomoInterval) {
              clearInterval(window.__nomadPomoInterval)
              window.__nomadPomoInterval = null
            }
            return
          }
          pomoBadge.style.display = 'inline-flex'
          if (typeof window.__nomadPomoSeconds !== 'number') {
            window.__nomadPomoSeconds = 25 * 60
            window.__nomadPomoRunning = true
          }
          const renderTime = () => {
            const sec = window.__nomadPomoSeconds
            const mm = String(Math.floor(sec / 60)).padStart(2, '0')
            const ss = String(sec % 60).padStart(2, '0')
            pomoBadge.textContent = `🍅 ${mm}:${ss} ${window.__nomadPomoRunning ? '⏸' : '▶'}`
          }
          renderTime()
          pomoBadge.onclick = e => {
            e.stopPropagation()
            window.__nomadPomoRunning = !window.__nomadPomoRunning
            renderTime()
          }
          if (!window.__nomadPomoInterval) {
            window.__nomadPomoInterval = setInterval(() => {
              if (window.__nomadPomoRunning && window.__nomadPomoSeconds > 0) {
                window.__nomadPomoSeconds -= 1
                renderTime()
              }
            }, 1000)
          }
        }
        syncPomodoroBadge()

        let menuEl = document.getElementById('nomad-pet-context-menu')
        if (!menuEl) {
          menuEl = document.createElement('div')
          menuEl.id = 'nomad-pet-context-menu'
          menuEl.setAttribute('data-testid', 'nomad-pet-context-menu')
          menuEl.className = 'hidden'
          document.body.appendChild(menuEl)

          document.addEventListener('pointerdown', e => {
            if (menuEl && !menuEl.classList.contains('hidden') && !menuEl.contains(e.target)) {
              menuEl.classList.add('hidden')
            }
          })
        }

        const switchMascotLive = async (slug, displayName = '') => {
          const item = MASCOT_CATALOG.find(m => m.slug === slug)
          const st = loadMascotSettings()
          st.mascotId = slug
          saveMascotSettings(st)
          playMascotTone(659.25, 0.09)
          try {
            const sdk = window.__HERMES_PLUGIN_SDK__
            if (sdk?.host?.request) {
              try {
                await sdk.host.request('pet.select', { slug, profile: 'nomad' })
              } catch {
                await sdk.host.request('pet.install', { slug, profile: 'nomad' })
                await sdk.host.request('pet.select', { slug, profile: 'nomad' })
              }
              window.dispatchEvent(new Event('focus'))
            }
            if (window.__nomadPluginCtx?.pet?.say) {
              const greet = item?.greeting || `Скин «${displayName || slug}» из маркетплейса Petdex активирован! ✨`
              window.__nomadPluginCtx.pet.say(greet, { id: 'mascot-greet', ttlMs: 4500 })
            }
          } catch {}
        }

        const applyCornerPosition = pos => {
          const st = loadMascotSettings()
          st.position = pos
          if (pos !== 'free') {
            st.randomWalk = false
          }
          const coords = computePinnedPetCoords(petContainer, st)
          st.lockedX = Math.round(coords.x)
          st.lockedY = Math.round(coords.y)
          saveMascotSettings(st)
          enforcePetPositionLock(petContainer)
          try {
            localStorage.setItem(
              'hermes.desktop.pet-position.v2',
              JSON.stringify({ x: Math.round(coords.x), y: Math.round(coords.y) }),
            )
          } catch {}
          playMascotTone(523.25, 0.07)
        }

        const renderContextMenu = (clientX, clientY) => {
          const st = loadMascotSettings()
          const currentMult = getScaleMultiplier()
          const currentMascot = MASCOT_CATALOG.find(m => m.slug === st.mascotId) || {
            slug: st.mascotId,
            label: `🐾 ${st.mascotId}`,
            greeting: 'На связи!',
          }
          const sdk = window.__HERMES_PLUGIN_SDK__
          const rawSessions = sdk?.host?.state?.sessions?.get?.() || []
          const sessionList = rawSessions.slice(0, 8)
          const hasDomPendingApproval = Boolean(document.querySelector('[data-approval-run]'))

          menuEl.innerHTML = `
            <div class="np-header">
              <div class="np-title">
                <span>Пульт помощника Nomad</span>
              </div>
              <span class="np-mood">${hasDomPendingApproval ? 'Ожидает подтверждения' : window.__nomadLiveVoiceActive ? 'В эфире' : 'Активен'}</span>
              <button type="button" class="np-close" data-np-action="close" title="Закрыть">×</button>
            </div>

            <div class="np-section-title">Советник Бадди (Обучение и техпомощь)</div>
            <div class="nomad-seg-group" style="display:grid;grid-template-columns:1fr 1fr;width:100%;margin-bottom:4px;">
              <button type="button" class="nomad-seg-btn" data-active="true" data-np-action="buddy-nika">
                Спросить Нику
              </button>
              <button type="button" class="nomad-seg-btn" data-np-action="buddy-sokrat">
                Спросить Сократа
              </button>
            </div>

            <div class="np-section-title">Голос и реалтайм-общение</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;">
              <button type="button" class="np-btn" data-np-action="voice-cmd" style="font-weight:600;padding:6px 8px;">
                Команда голосом
              </button>
              <button type="button" class="np-btn" data-np-action="voice-live" style="font-weight:600;padding:6px 8px;">
                ${window.__nomadLiveVoiceActive ? 'Live-голос: ВКЛ' : 'Голос в реалтайме'}
              </button>
            </div>

            <div class="np-section-title">Апрув и управление сессиями</div>
            <div class="np-row">
              <select data-testid="nomad-pet-select-session" style="flex:1;">
                <option value="">Текущая активная сессия</option>
                ${sessionList
                  .map(
                    s =>
                      `<option value="${s.id}">${(s.title || s.id || 'Сессия').slice(0, 28)}</option>`,
                  )
                  .join('')}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:3px;">
              <button type="button" class="np-btn" data-np-action="approve-once" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.35);color:#059669;font-weight:600;">
                ✓ Разрешить
              </button>
              <button type="button" class="np-btn" data-np-action="approve-session" title="Разрешить на всю сессию">
                ✓ На сессию
              </button>
              <button type="button" class="np-btn" data-np-action="deny-once" style="color:#dc2626;">
                × Отклонить
              </button>
            </div>

            <div class="np-section-title">Персонаж (Караван и коллекция «Скрепка»)</div>
            <div class="np-row">
              <select data-testid="nomad-pet-select-mascot" style="flex:1;">
                <optgroup label="Караван Nomad">
                  ${MASCOT_CATALOG.filter(m => m.group === 'Караван Nomad')
                    .map(m => `<option value="${m.slug}" ${m.slug === st.mascotId ? 'selected' : ''}>${m.label}</option>`)
                    .join('')}
                </optgroup>
                <optgroup label="Коллекция «Скрепка» (свои 3D-маскоты)">
                  ${MASCOT_CATALOG.filter(m => m.group !== 'Караван Nomad')
                    .map(m => `<option value="${m.slug}" ${m.slug === st.mascotId ? 'selected' : ''}>${m.label}</option>`)
                    .join('')}
                </optgroup>
              </select>
              <button type="button" class="np-btn" data-np-action="cycle-mascot" title="Переключить на следующего маскота">След. →</button>
            </div>

            <div class="np-section-title" style="display:flex;align-items:center;justify-content:space-between;">
              <span>Каталог скинов Petdex</span>
              <span data-np-id="petdex-count" style="color:var(--nomad-accent,#007AFF);font-weight:600;">5 090+ скинов</span>
            </div>
            <div class="np-row" style="padding:2px 0;">
              <input
                type="search"
                data-testid="nomad-petdex-search"
                placeholder="Поиск скина (cat, dragon, pikachu, mecha, boba…)"
                style="width:100%;background:rgba(255,255,255,0.75);color:inherit;border:1px solid rgba(15,23,42,0.12);border-radius:8px;padding:6px 10px;font-size:11.5px;outline:none;"
              />
            </div>
            <div
              data-testid="nomad-petdex-grid"
              style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-height:132px;overflow-y:auto;margin-top:4px;padding:2px;"
            >
              <div style="grid-column:1/-1;text-align:center;opacity:0.7;padding:10px 4px;font-size:11px;">Загружаем каталог скинов Petdex…</div>
            </div>

            <div class="np-section-title">Размер и фиксация позиции внутри окна</div>
            <div class="np-row">
              <span class="np-label">Масштаб</span>
              <div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end;">
                <input type="range" data-np-input="size" min="0.20" max="1.20" step="0.04" value="${Math.min(1.2, Math.max(0.2, currentMult * 0.38)).toFixed(2)}" style="width:110px;accent-color:#007AFF;cursor:pointer;" />
                <span data-np-id="size-val" style="min-width:34px;text-align:right;font-weight:600;color:var(--nomad-accent,#007AFF);">${currentMult.toFixed(1)}×</span>
              </div>
            </div>

            <div class="np-pos-grid">
              <button type="button" class="np-pos-btn ${st.position === 'bottom-left' ? 'active' : ''}" data-np-pos="bottom-left">Слева внизу</button>
              <button type="button" class="np-pos-btn ${st.position === 'bottom-right' ? 'active' : ''}" data-np-pos="bottom-right">Справа внизу</button>
              <button type="button" class="np-pos-btn ${st.position === 'free' ? 'active' : ''}" data-np-pos="free">Свободно</button>
              <button type="button" class="np-pos-btn ${st.position === 'top-left' ? 'active' : ''}" data-np-pos="top-left">Слева вверху</button>
              <button type="button" class="np-pos-btn ${st.position === 'top-right' ? 'active' : ''}" data-np-pos="top-right">Справа вверху</button>
              <button type="button" class="np-pos-btn" data-np-action="greet">Реплика</button>
            </div>

            <div class="np-section-title">Поведение и режимы</div>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Случайные прогулки по окну <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS['Случайные прогулки по окну']}">?</span></span>
              <input type="checkbox" data-np-toggle="randomWalk" ${st.randomWalk ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Авто-одобрение безопасных <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS['Авто-одобрение безопасных']}">?</span></span>
              <input type="checkbox" data-np-toggle="autoApproveSafe" ${st.autoApproveSafe ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Помодоро-таймер (25/5 мин) <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS['Помодоро-таймер (25/5 мин)']}">?</span></span>
              <input type="checkbox" data-np-toggle="pomodoroEnabled" ${st.pomodoroEnabled ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Звуковые эффекты <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS['Звуковые эффекты']}">?</span></span>
              <input type="checkbox" data-np-toggle="soundEnabled" ${st.soundEnabled ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
            </label>

            <div class="np-stats-box hidden" data-np-id="stats-box">
              <div style="font-weight:600;color:var(--nomad-accent,#007AFF);margin-bottom:4px;">Активность в продукте</div>
              <div class="np-row"><span>Маскот:</span><strong>${currentMascot.label}</strong></div>
              <div class="np-row"><span>Активных сессий:</span><strong>${rawSessions.length}</strong></div>
              <div class="np-row"><span>Режим апрувов:</span><strong>${st.autoApproveSafe ? 'Умный (smart)' : 'Ручной'}</strong></div>
            </div>

            <div class="np-actions">
              <button type="button" class="np-btn" data-np-action="open-settings" style="background:rgba(0,122,255,0.08);border-color:rgba(0,122,255,0.25);color:var(--nomad-accent,#007AFF);font-weight:600;">Весь маркетплейс →</button>
              <button type="button" class="np-btn" data-np-action="stats">Статистика дня</button>
            </div>
          `

          menuEl.classList.remove('hidden')
          const menuW = 332
          const bottomSafeMargin = 52 // гарантированный отступ от нижнего края >= 52px
          const topSafeMargin = 28
          const vh = window.innerHeight || 800
          const maxAllowedH = Math.min(690, vh - topSafeMargin - bottomSafeMargin)
          menuEl.style.maxHeight = `${Math.max(360, maxAllowedH)}px`
          const left = Math.max(16, Math.min((window.innerWidth || 1200) - menuW - 20, clientX - 120))
          menuEl.style.left = `${Math.round(left)}px`
          if (clientY > vh * 0.35) {
            menuEl.style.top = 'auto'
            menuEl.style.bottom = `${bottomSafeMargin}px`
          } else {
            menuEl.style.bottom = 'auto'
            menuEl.style.top = `${Math.max(topSafeMargin, Math.round(clientY - 24))}px`
          }

          // Подгружаем и рендерим живой каталог скинов Petdex в едином светлом/тёмном стиле Academy
          const petdexGrid = menuEl.querySelector('[data-testid="nomad-petdex-grid"]')
          const petdexSearch = menuEl.querySelector('[data-testid="nomad-petdex-search"]')
          const petdexCount = menuEl.querySelector('[data-np-id="petdex-count"]')
          window.__nomadThumbCache = window.__nomadThumbCache || new Map()

          const renderPetdexSkins = (query = '') => {
            if (!petdexGrid) return
            const gallery = window.__nomadPetdexGallery
            if (!gallery || !Array.isArray(gallery.pets)) return
            if (petdexCount) {
              petdexCount.textContent = `${gallery.pets.length} скинов`
            }
            const q = query.trim().toLowerCase()
            const filtered = gallery.pets
              .filter(p => !p.slug.startsWith('clawd'))
              .filter(p => !q || p.slug.toLowerCase().includes(q) || (p.displayName || '').toLowerCase().includes(q))
              .slice(0, 18)

            if (!filtered.length) {
              petdexGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;opacity:0.7;padding:8px;font-size:11px;">Скины по запросу «${query}» не найдены</div>`
              return
            }

            petdexGrid.innerHTML = filtered
              .map(
                p => `
                <button
                  type="button"
                  data-petdex-slug="${p.slug}"
                  data-petdex-name="${(p.displayName || p.slug).replace(/"/g, '&quot;')}"
                  title="Установить и выбрать скин: ${p.displayName || p.slug} (${p.slug})"
                  style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 4px;border-radius:9px;background:${p.slug === gallery.active ? 'rgba(76,110,245,0.14)' : 'var(--background,#F6F4EF)'};border:1px solid ${p.slug === gallery.active ? '#4C6EF5' : p.installed ? 'rgba(16,185,129,0.45)' : 'var(--border,rgba(20,21,28,0.14))'};color:inherit;cursor:pointer;text-align:center;overflow:hidden;"
                >
                  <div style="width:34px;height:34px;border-radius:7px;background:var(--card,#ffffff);border:1px solid var(--border,rgba(20,21,28,0.08));display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    <img data-petdex-thumb="${p.slug}" alt="" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated;display:none;" />
                    <span data-petdex-fallback="${p.slug}" style="font-size:14px;">🐾</span>
                  </div>
                  <span style="font-size:10px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(p.displayName || p.slug).slice(0, 12)}</span>
                </button>
              `,
              )
              .join('')

            filtered.forEach(p => {
              const imgEl = petdexGrid.querySelector(`img[data-petdex-thumb="${p.slug}"]`)
              const fbEl = petdexGrid.querySelector(`span[data-petdex-fallback="${p.slug}"]`)
              const applyUri = uri => {
                if (uri && imgEl) {
                  imgEl.src = uri
                  imgEl.style.display = 'block'
                  if (fbEl) fbEl.style.display = 'none'
                }
              }
              if (window.__nomadThumbCache.has(p.slug)) {
                applyUri(window.__nomadThumbCache.get(p.slug))
              } else if (sdk?.host?.request) {
                sdk.host
                  .request('pet.thumb', { slug: p.slug, url: p.spritesheetUrl || '', profile: 'nomad' })
                  .then(res => {
                    if (res?.ok && res.dataUri) {
                      window.__nomadThumbCache.set(p.slug, res.dataUri)
                      applyUri(res.dataUri)
                    }
                  })
                  .catch(() => {})
              }
            })

            petdexGrid.querySelectorAll('button[data-petdex-slug]').forEach(cardBtn => {
              cardBtn.addEventListener('click', async () => {
                const slug = cardBtn.getAttribute('data-petdex-slug')
                const name = cardBtn.getAttribute('data-petdex-name') || slug
                cardBtn.style.opacity = '0.6'
                await switchMascotLive(slug, name)
                if (window.__nomadPetdexGallery) {
                  window.__nomadPetdexGallery.active = slug
                }
                renderPetdexSkins(petdexSearch?.value || '')
              })
            })
          }

          if (window.__nomadPetdexGallery) {
            renderPetdexSkins('')
          } else if (sdk?.host?.request) {
            sdk.host
              .request('pet.gallery', { profile: 'nomad' })
              .then(gal => {
                if (gal && Array.isArray(gal.pets)) {
                  window.__nomadPetdexGallery = gal
                  renderPetdexSkins(petdexSearch?.value || '')
                }
              })
              .catch(() => {})
          }

          petdexSearch?.addEventListener('input', e => {
            renderPetdexSkins(e.target.value || '')
          })

          const sel = menuEl.querySelector('[data-testid="nomad-pet-select-mascot"]')
          sel?.addEventListener('change', e => {
            switchMascotLive(e.target.value)
          })

          const sessionSel = menuEl.querySelector('[data-testid="nomad-pet-select-session"]')

          const sizeInput = menuEl.querySelector('[data-np-input="size"]')
          const sizeVal = menuEl.querySelector('[data-np-id="size-val"]')
          sizeInput?.addEventListener('input', async e => {
            const rawScale = parseFloat(e.target.value)
            const displayMult = Math.max(0.3, rawScale / 0.38)
            if (sizeVal) sizeVal.textContent = `${displayMult.toFixed(1)}×`
            sizeLabel.textContent = `${displayMult.toFixed(1)}×`
            try {
              if (sdk?.host?.request) {
                await sdk.host.request('pet.scale', { scale: rawScale, profile: 'nomad' })
                window.dispatchEvent(new Event('focus'))
              }
            } catch {}
          })

          menuEl.querySelectorAll('[data-np-pos]').forEach(btn => {
            btn.addEventListener('click', () => {
              menuEl.querySelectorAll('[data-np-pos]').forEach(b => b.classList.remove('active'))
              btn.classList.add('active')
              applyCornerPosition(btn.getAttribute('data-np-pos'))
            })
          })

          menuEl.querySelectorAll('[data-np-toggle]').forEach(chk => {
            chk.addEventListener('change', async () => {
              const key = chk.getAttribute('data-np-toggle')
              const cur = loadMascotSettings()
              cur[key] = chk.checked
              if (key === 'randomWalk' && !chk.checked) {
                const rect = petContainer.getBoundingClientRect()
                cur.lockedX = Math.round(rect.left)
                cur.lockedY = Math.round(rect.top)
              }
              saveMascotSettings(cur)
              enforcePetPositionLock(petContainer)
              playMascotTone(chk.checked ? 659.25 : 440, 0.06)
              if (key === 'autoApproveSafe') {
                try {
                  await sdk?.host?.request?.('config.set', {
                    key: 'approvals.mode',
                    value: chk.checked ? 'smart' : 'manual',
                    profile: 'nomad',
                  })
                } catch {}
              }
              if (key === 'pomodoroEnabled') {
                syncPomodoroBadge()
              }
            })
          })

          menuEl.querySelectorAll('[data-np-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const act = btn.getAttribute('data-np-action')
              const chosenSessionId = sessionSel?.value || null
              if (act === 'close') {
                menuEl.classList.add('hidden')
              } else if (act === 'buddy-nika') {
                menuEl.classList.add('hidden')
                window.openNomadBuddy?.('nika')
              } else if (act === 'buddy-sokrat') {
                menuEl.classList.add('hidden')
                window.openNomadBuddy?.('sokrat')
              } else if (act === 'voice-cmd') {
                menuEl.classList.add('hidden')
                triggerVoiceCommandToSession(chosenSessionId)
              } else if (act === 'voice-live') {
                menuEl.classList.add('hidden')
                toggleRealtimeVoiceWithMascot()
              } else if (act === 'approve-once') {
                menuEl.classList.add('hidden')
                await resolveSessionApproval(chosenSessionId, 'once')
              } else if (act === 'approve-session') {
                menuEl.classList.add('hidden')
                await resolveSessionApproval(chosenSessionId, 'session')
              } else if (act === 'deny-once') {
                menuEl.classList.add('hidden')
                await resolveSessionApproval(chosenSessionId, 'deny')
              } else if (act === 'cycle-mascot') {
                const cur = loadMascotSettings()
                const idx = MASCOT_CATALOG.findIndex(m => m.slug === cur.mascotId)
                const next = MASCOT_CATALOG[(idx + 1) % MASCOT_CATALOG.length]
                if (sel) sel.value = next.slug
                await switchMascotLive(next.slug)
              } else if (act === 'greet') {
                const cur = loadMascotSettings()
                const item = MASCOT_CATALOG.find(m => m.slug === cur.mascotId) || MASCOT_CATALOG[0]
                playMascotTone(698.46, 0.08)
                window.__nomadPluginCtx?.pet?.say?.(item.greeting, { id: 'mascot-greet', ttlMs: 5000 })
              } else if (act === 'stats') {
                const box = menuEl.querySelector('[data-np-id="stats-box"]')
                box?.classList.toggle('hidden')
              } else if (act === 'open-settings') {
                menuEl.classList.add('hidden')
                window.location.hash = '#/settings?tab=config:appearance&page=pet'
              }
            })
          })
        }

        petContainer.addEventListener(
          'pointerdown',
          e => {
            if (e.button === 2) {
              e.stopPropagation()
            }
          },
          true,
        )
        petContainer.addEventListener(
          'contextmenu',
          e => {
            e.preventDefault()
            e.stopPropagation()
            playMascotTone(523.25, 0.05)
            renderContextMenu(e.clientX, e.clientY)
          },
          true,
        )
      }

      // 3. Нейтрализуем пугающую красную плашку HERMES_DESKTOP_REMOTE_URL в Настройки > Шлюзы > Это окно
      document.querySelectorAll('div').forEach(box => {
        if (box.id === 'root' || box.hasAttribute('data-nomad-gateway-banner-fixed')) return
        const txt = (box.textContent || '').trim()
        if (
          txt.length > 35 &&
          txt.length < 500 &&
          (txt.startsWith('Переменные окружения управляют этой сессией приложения') ||
            txt.startsWith('Подключение шлюза зафиксировано переменными окружения')) &&
          !box.querySelector('button, input, select, [role="tab"], [role="dialog"], main, aside, nav')
        ) {
          box.setAttribute('data-nomad-gateway-banner-fixed', 'true')
          box.style.cssText =
            'padding:14px 16px;border-radius:12px;border:1px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.08);color:var(--foreground,#14151C);font-size:12.5px;line-height:1.5;margin:8px 0;display:block;'
          box.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <strong style="color:#059669;font-size:13px;">✅ Локальный шлюз Nomad активен и защищён (127.0.0.1:9129)</strong>
              <span class="nomad-help-q" data-nomad-tooltip="Локальный сервер Nomad запущен автоматически для этого рабочего окна и защищён сессионным токеном. Если вы хотите подключить внешний корпоративный сервер, добавьте его ниже в блок «Сохранённые шлюзы».">?</span>
            </div>
            <div style="opacity:0.84;margin-top:4px;">
              Автоматическое подключение рабочего места настроено и работает без ручного ввода портов. Для добавления внешнего корпоративного контура используйте раздел «Сохранённые шлюзы» ниже.
            </div>
          `
        }
      })

      // 3b. Автоматически закрываем ложное модальное окно «Nomad couldn't start / Could not connect to Nomad gateway»,
      // которое перекрывает интерфейс при переключении локального REST/Web-контура.
      document.querySelectorAll('[role="dialog"]').forEach(dlg => {
        if (dlg.hasAttribute('data-nomad-gateway-modal-dismissed')) return
        const txt = (dlg.textContent || '').trim()
        if (
          txt.includes("Nomad couldn't start") ||
          txt.includes('Не удалось запустить Nomad') ||
          txt.includes('Could not connect to Nomad gateway')
        ) {
          dlg.setAttribute('data-nomad-gateway-modal-dismissed', 'true')
          const closeBtn = Array.from(dlg.querySelectorAll('button')).find(b => {
            const label = (b.textContent || '').trim()
            const aria = (b.getAttribute('aria-label') || '').toLowerCase()
            return (
              label === '×' ||
              label === '✕' ||
              aria.includes('close') ||
              aria.includes('закрыть') ||
              b.querySelector('.codicon-close, svg')
            )
          })
          if (closeBtn) {
            try {
              closeBtn.click()
            } catch {
              // ignore click error
            }
          }
          dlg.style.setProperty('display', 'none', 'important')
          dlg.style.setProperty('pointer-events', 'none', 'important')
        }
      })

      // 4. Переводим оставшиеся английские строки и плейсхолдеры (включая окно HUD) и гарантируем единый Codeg #18181B / 8px radius
      if (document.documentElement?.style) {
        document.documentElement.style.setProperty('--primary', '#18181B', 'important')
        document.documentElement.style.setProperty('--primary-foreground', '#FFFFFF', 'important')
        document.documentElement.style.setProperty('--ring', 'rgba(24, 24, 27, 0.16)', 'important')
        document.documentElement.style.setProperty('--composer-ring', 'rgba(24, 24, 27, 0.16)', 'important')
        document.documentElement.style.setProperty('--radius', '8px', 'important')
      }
      const textContainers = document.querySelectorAll(
        '[data-slot="aui_intro"] p, [role="tab"], button, span, div, label, p, summary, strong, h3, h4',
      )
      for (const el of textContainers) {
        const raw = (el.textContent || '').trim()
        if (el.childElementCount === 0 && ENGLISH_TO_RUSSIAN_TEXT_MAP[raw]) {
          el.textContent = ENGLISH_TO_RUSSIAN_TEXT_MAP[raw]
        } else if (el.childElementCount === 0 && /^Used \d+ tools?$/i.test(raw)) {
          const num = raw.match(/\d+/)?.[0] || '1'
          el.textContent = `Использовано инструментов: ${num}`
        } else if (el.childElementCount === 0 && /^Show \d+ tips? again$/i.test(raw)) {
          const num = raw.match(/\d+/)?.[0] || '1'
          el.textContent = `Показать скрытые подсказки (${num})`
        } else if (el.childElementCount === 0 && /^Limit resets at /i.test(raw)) {
          el.textContent = raw
            .replace(/^Limit resets at /i, 'Сброс лимита в ')
            .replace(/\(in /i, '(через ')
        } else if (
          el.childElementCount <= 2 &&
          !el.querySelector('button, input, select') &&
          raw.startsWith('Off by default. When on, gateway tokens')
        ) {
          el.textContent =
            'По умолчанию выключено. При включении токены шлюза и API-ключи шифруются в системном хранилище ОС (Windows DPAPI / Credential Manager или macOS Keychain).'
        } else if (el.tagName === 'BUTTON' || el.tagName === 'SPAN' || el.tagName === 'DIV') {
          el.childNodes.forEach(node => {
            if (node.nodeType === 3) {
              const t = (node.nodeValue || '').trim()
              if (ENGLISH_TO_RUSSIAN_TEXT_MAP[t]) {
                node.nodeValue = node.nodeValue.replace(t, ENGLISH_TO_RUSSIAN_TEXT_MAP[t])
              }
            }
          })
        }
      }
      document.querySelectorAll('textarea, input, [data-placeholder]').forEach(el => {
        const ph = (el.getAttribute('placeholder') || '').trim()
        if (ph && ENGLISH_TO_RUSSIAN_TEXT_MAP[ph]) {
          el.setAttribute('placeholder', ENGLISH_TO_RUSSIAN_TEXT_MAP[ph])
        }
        const dph = (el.getAttribute('data-placeholder') || '').trim()
        if (dph && ENGLISH_TO_RUSSIAN_TEXT_MAP[dph]) {
          el.setAttribute('data-placeholder', ENGLISH_TO_RUSSIAN_TEXT_MAP[dph])
        }
      })

      // 4b. Разгружаем левое боковое меню: убираем технические разделы настроек из главного меню в раздел «Настройки»
      if (!isHudWindow) {
        const settingsOnlyNavLabels = new Set([
          'Аккаунты',
          'Данные и место',
          'Разрешения и безопасность',
          'Перенос и старт',
          'Сообщения',
          'Возможности',
        ])
        window.__nomadHiddenSidebarLinks = window.__nomadHiddenSidebarLinks || {}
        let lastVisibleNavParent = null
        document.querySelectorAll('a, button, [role="button"]').forEach(navEl => {
          if (
            navEl.id === 'nomad-sidebar-settings-entry' ||
            navEl.closest(
              'main, [data-testid="nomad-accounts-page"], [role="tablist"], .nomad-seg-group, #nomad-settings-hub-bar, #nomad-buddy-drawer, #nomad-composer-council-popover',
            )
          ) {
            return
          }
          const label = (navEl.textContent || '').replace(/\?$/, '').trim()
          if (settingsOnlyNavLabels.has(label)) {
            window.__nomadHiddenSidebarLinks[label] = navEl
            const rowItem = navEl.closest('li, [data-slot="sidebar-menu-item"]') || navEl
            rowItem.style.setProperty('display', 'none', 'important')
          } else if (
            label === 'Симулятор ИИ' ||
            label === 'Навыки Nomad' ||
            label === 'Запланированные задачи'
          ) {
            const rowItem = navEl.closest('li, [data-slot="sidebar-menu-item"]') || navEl
            lastVisibleNavParent = rowItem.parentElement
          }
        })

        // Открытие единого всплывающего окна Настроек (SettingsView)
        const openUnifiedSettingsModal = () => {
          const gearBtn = document.querySelector(
            'button[title="Открыть настройки"], button[aria-label="Открыть настройки"], button[title="Open settings"], button[aria-label="Open settings"]',
          )
          if (gearBtn && !document.querySelector('aside[data-tour="overlay-nav"]')) {
            gearBtn.click()
            return
          }
          navigateNomad('/settings')
        }
        window.openNativeAppSettingsModal = openUnifiedSettingsModal

        // Удаляем старую панель #nomad-settings-hub-bar, если она осталась в DOM
        document.getElementById('nomad-settings-hub-bar')?.remove()

        // Добавляем единый лаконичный пункт «Настройки» в нижнюю часть списка навигации левого меню (вне React-списка ul)
        if (lastVisibleNavParent && !document.getElementById('nomad-sidebar-settings-entry')) {
          const wrap = document.createElement('div')
          wrap.id = 'nomad-sidebar-settings-wrap'
          wrap.style.cssText = 'padding:0;margin-top:2px;'
          const settingsItem = document.createElement('button')
          settingsItem.id = 'nomad-sidebar-settings-entry'
          settingsItem.type = 'button'
          settingsItem.setAttribute('data-testid', 'nomad-sidebar-settings-entry')
          settingsItem.setAttribute(
            'title',
            'Настройки приложения: модель, чат, внешний вид, провайдеры, безопасность и память',
          )
          settingsItem.style.cssText =
            'width:100%;display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:10px;border:none;background:transparent;color:var(--foreground,#14151C);font-size:13px;font-weight:500;cursor:pointer;text-align:left;transition:background-color 0.15s ease;'
          settingsItem.innerHTML = `<span style="font-size:14px;opacity:0.75;width:16px;text-align:center;">⚙</span><span>Настройки</span>`
          settingsItem.addEventListener('mouseenter', () => {
            settingsItem.style.background = 'rgba(15, 23, 42, 0.06)'
          })
          settingsItem.addEventListener('mouseleave', () => {
            settingsItem.style.background = 'transparent'
          })
          settingsItem.addEventListener('click', () => {
            openUnifiedSettingsModal()
          })
          wrap.appendChild(settingsItem)
          lastVisibleNavParent.insertAdjacentElement('afterend', wrap)
        }

        // 4b-1. Гарантируем видимость поля ввода и скрываем техническую панель профилей внизу слева
        const composerDockEl = document.querySelector('[data-slot="composer-dock"]')
        if (composerDockEl && composerDockEl.style.display === 'none') {
          composerDockEl.style.removeProperty('display')
        }
        document.querySelectorAll('button').forEach(btn => {
          const txt = (btn.textContent || '').trim()
          if (txt === 'Бэкендпроверка' || txt === 'Бэкенд проверка') {
            btn.style.setProperty('color', '#059669', 'important')
            btn.querySelectorAll('span').forEach(sp => {
              if ((sp.textContent || '').trim() === 'проверка') {
                sp.textContent = 'готов'
                sp.style.setProperty('color', '#059669', 'important')
              }
            })
          }
        })
        document.querySelectorAll('[data-slot="profile-rail"]').forEach(el => {
          el.style.setProperty('display', 'none', 'important')
          if (el.parentElement && el.parentElement.children.length === 1) {
            el.parentElement.style.setProperty('display', 'none', 'important')
          }
        })


        // 4b-2. Чистая органичная интеграция внутри родных страниц всплывающего окна Настроек (без чужеродных подпунктов в левом меню)
        const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]')
        if (overlayNav) {
          document.getElementById('nomad-onboarding-tour-root')?.remove()
          overlayNav.querySelectorAll('.nomad-semantic-sublist').forEach(el => el.remove())
          document.getElementById('nomad-semantic-section-card')?.remove()

          // В разделе «Внешний вид ▸ Общие» добавляем в штатную строку Guided Tours («Пошаговый тур по интерфейсу») родную кнопку запуска тура
          const overlayMain = overlayNav.parentElement?.querySelector('main')
          if (overlayMain && !overlayMain.querySelector('#nomad-launch-native-tour-btn')) {
            const titleEl = Array.from(overlayMain.querySelectorAll('div, span, label')).find(el => {
              if (el.childElementCount !== 0) return false
              const t = (el.textContent || '').trim()
              return t === 'Пошаговый тур по интерфейсу' || t === 'Guided Tours'
            })
            const rowCard = titleEl?.parentElement?.parentElement || titleEl?.parentElement
            if (rowCard) {
              const sampleLink = Array.from(overlayMain.querySelectorAll('button:not([role="switch"])')).find(b =>
                /Показать скрытые подсказки|Show .* tip|Restart tours|Перезапустить/i.test(b.textContent || ''),
              )
              const launchBtn = document.createElement('button')
              launchBtn.id = 'nomad-launch-native-tour-btn'
              launchBtn.type = 'button'
              launchBtn.setAttribute('data-testid', 'launch-native-guided-tour-btn')
              if (sampleLink?.className) {
                launchBtn.className = sampleLink.className
              }
              launchBtn.style.cssText =
                'display:block;margin-top:8px;padding:0;border:none;background:transparent;color:var(--ui-text-secondary, rgba(15,23,42,0.68));font-size:12px;font-weight:500;cursor:pointer;text-align:left;width:fit-content;'
              launchBtn.textContent = 'Запустить пошаговый тур по интерфейсу →'
              launchBtn.addEventListener('click', ev => {
                ev.preventDefault()
                ev.stopPropagation()
                if (typeof window.startNomadOnboardingTour === 'function') {
                  window.startNomadOnboardingTour()
                }
              })
              rowCard.appendChild(launchBtn)
            }
          }
        }

        // 4c. Мультиязычный интерактивный Spotlight-онбординг (RU / EN с автоопределением языка ОС и размытием экрана)
        if (!window.getNomadLocale) {
          window.getNomadLocale = () => {
            try {
              const saved = window.localStorage?.getItem('nomad.locale') || 'auto'
              if (saved === 'ru' || saved === 'en') return saved
            } catch {}
            const sys = (typeof navigator !== 'undefined' ? navigator.language || 'ru' : 'ru').toLowerCase()
            return sys.startsWith('ru') ? 'ru' : 'en'
          }
          window.setNomadLocale = mode => {
            try {
              window.localStorage?.setItem('nomad.locale', mode || 'auto')
              const resolved = window.getNomadLocale()
              window.localStorage?.setItem('hermes.locale', resolved)
              window.localStorage?.setItem('i18nextLng', resolved)
              document.documentElement.setAttribute('lang', resolved)
            } catch {}
          }
        }

        const TOUR_STEPS = {
          ru: [
            {
              selector: '[data-slot="composer-surface"]',
              title: '1. Поле задачи и умный выбор модели',
              desc: 'Пишите задачу своими словами, прикрепляйте файлы или код. Автороутер Nomad сам подберёт оптимальную модель или переключит запрос в контур 152-ФЗ при обнаружении ПДн.',
            },
            {
              selector: '#nomad-composer-council-toggle, [data-testid="composer-council-toggle"]',
              title: '2. Совет моделей (как в Perplexity)',
              desc: 'Включается прямо внутри поля ввода рядом с моделью: параллельно опрашивает пул флагманов (или суверенный пул РФ) и синтезирует единый проверенный ответ.',
            },
            {
              selector: '__SIDEBAR_MENU__',
              title: '3. Рабочая навигация и проекты',
              desc: 'Слева собраны только ежедневные рабочие разделы: Сеансы чата, Поиск, Артефакты, Запланированные задачи, Навыки Nomad и Симулятор ИИ.',
            },
            {
              selector: '#nomad-buddy-fab',
              title: '4. Правая боковая панель «Советник»',
              desc: 'Ваш ИИ-помощник и наставник (Ника / Сократ) открывается в правом боковом меню: помогает формулировать промпты, разбирать архитектуру и учиться вайбкодингу.',
            },
            {
              selector: '#nomad-sidebar-settings-entry, button[title="Открыть настройки"], button[aria-label="Открыть настройки"]',
              title: '5. Единое окно всех настроек и вход в РФ-модели в 1 клик',
              desc: 'По нажатию на «Настройки» или шестерёнку открывается единое всплывающее окно, где рядом со штатными параметрами собраны подписки РФ в 1 клик (Сбер ID, Яндекс ID, МТС ID, T-ID, Cloud.ru), Облачный ПК, Память и 152-ФЗ.',
            },
            {
              selector: '[data-nomad-pet-hovered], [class*="pet"]',
              title: '6. Караванный питомец-компаньон',
              desc: 'Нажмите правой кнопкой мыши по питомцу, чтобы открыть стеклянный пульт управления: выбор персонажа (Караванный верблюд / Скрепка), масштаб и фиксация позиции.',
            },
          ],
          en: [
            {
              selector: '[data-slot="composer-surface"]',
              title: '1. Smart Composer & Auto-Router',
              desc: 'Describe your task, attach files, or drop a screenshot. Nomad automatically routes requests across frontier models or keeps sensitive data inside your sovereign contour.',
            },
            {
              selector: '#nomad-composer-council-toggle, [data-testid="composer-council-toggle"]',
              title: '2. Model Council (Perplexity-style)',
              desc: 'Toggle Model Council right inside the composer bar next to the model selector to query multiple frontier models in parallel and synthesize a verified consensus.',
            },
            {
              selector: '__SIDEBAR_MENU__',
              title: '3. Clean Workspace Navigation',
              desc: 'The left sidebar keeps only your daily essentials: Sessions, Search, Artifacts, Scheduled Tasks, Nomad Skills, and AI Simulator.',
            },
            {
              selector: '#nomad-buddy-fab',
              title: '4. Right-Side AI Advisor Drawer',
              desc: 'Open the AI Advisor on the right side of the screen at any time for interactive prompt coaching, architecture review, and guided vibecoding tracks.',
            },
            {
              selector: '#nomad-sidebar-settings-entry, button[title="Открыть настройки"], button[aria-label="Открыть настройки"]',
              title: '5. Unified Settings Popup & 1-Click SSO Subscriptions',
              desc: 'Click Settings or the top-right gear to open the single unified Settings popup with all system preferences plus 1-click Russian & global SSO subscriptions, Cloud PC, 3-tier Memory, and 152-FZ.',
            },
            {
              selector: '[data-nomad-pet-hovered], [class*="pet"]',
              title: '6. Interactive Desktop Companion',
              desc: 'Right-click the companion mascot on screen to open its Liquid Glass control pad: switch between the Caravan Camel and Clippy, adjust scale, or lock position.',
            },
          ],
        }

        window.startNomadOnboardingTour = langOverride => {
          let activeLang =
            langOverride === 'ru' || langOverride === 'en' ? langOverride : window.getNomadLocale()

          const isComposerVisible = () => {
            if (document.querySelector('aside[data-tour="overlay-nav"]')) return false
            const el = document.querySelector('[data-slot="composer-surface"]')
            if (!el) return false
            const r = el.getBoundingClientRect()
            return r.width > 80 && r.height > 24
          }

          const ensureMainChatWorkspace = onReady => {
            if (isComposerVisible()) {
              onReady()
              return
            }
            // 1. Закрываем всплывающее окно Настроек, если оно открыто
            const closeSettingsBtn = document.querySelector(
              'button[aria-label="Закрыть настройки"], button[aria-label="Close settings"]',
            )
            if (closeSettingsBtn) {
              try {
                closeSettingsBtn.click()
              } catch {}
            }
            // 2. Переходим на главный экран чата (Новый сеанс / #/)
            const newSessionBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
              const t = (el.textContent || '').trim()
              return t === 'Новый сеанс' || t === 'New session' || t === 'New chat'
            })
            if (newSessionBtn && (window.location.hash.includes('/nomad-') || window.location.hash.includes('/settings'))) {
              try {
                newSessionBtn.click()
              } catch {}
            }
            navigateNomad('/')

            let attempts = 0
            const timer = setInterval(() => {
              attempts += 1
              try {
                enhanceDom()
              } catch {}
              if (isComposerVisible() || attempts >= 25) {
                clearInterval(timer)
                setTimeout(() => {
                  try {
                    enhanceDom()
                  } catch {}
                  onReady()
                }, 80)
              }
            }, 60)
          }

          ensureMainChatWorkspace(() => {
            let stepIdx = 0

            document.getElementById('nomad-onboarding-tour-root')?.remove()
            const root = document.createElement('div')
            root.id = 'nomad-onboarding-tour-root'
            root.setAttribute('data-testid', 'nomad-onboarding-tour-root')

            // 4 backdrop panes surrounding the spotlight cutout so the target button remains crisp and unblurred!
            const paneTop = document.createElement('div')
            const paneBottom = document.createElement('div')
            const paneLeft = document.createElement('div')
            const paneRight = document.createElement('div')
            ;[paneTop, paneBottom, paneLeft, paneRight].forEach(p => {
              p.className = 'nomad-tour-backdrop-pane'
              root.appendChild(p)
            })

            const ring = document.createElement('div')
            ring.className = 'nomad-tour-spotlight-ring'
            ring.setAttribute('data-testid', 'nomad-tour-spotlight-ring')
            root.appendChild(ring)

            const card = document.createElement('div')
            card.className = 'nomad-tour-card'
            card.setAttribute('data-testid', 'nomad-tour-card')
            root.appendChild(card)

            document.body.appendChild(root)

            const closeTour = () => {
              window.removeEventListener('keydown', onKeyDown)
              window.removeEventListener('resize', renderStep)
              root.remove()
              try {
                window.localStorage?.setItem('nomad.onboarding.completed.v2', 'true')
              } catch {}
            }

            const onKeyDown = e => {
              if (e.key === 'Escape') closeTour()
              else if (e.key === 'ArrowRight') {
                const steps = TOUR_STEPS[activeLang] || TOUR_STEPS.ru
                if (stepIdx < steps.length - 1) {
                  stepIdx++
                  renderStep()
                } else {
                  closeTour()
                }
              } else if (e.key === 'ArrowLeft' && stepIdx > 0) {
                stepIdx--
                renderStep()
              }
            }
            window.addEventListener('keydown', onKeyDown)
            window.addEventListener('resize', renderStep)

            function resolveStepTargetRect(step, vw, vh) {
              const pad = 8
              if (step.selector === '__SIDEBAR_MENU__') {
                const settingsBtn = document.getElementById('nomad-sidebar-settings-entry')
                const menuContainer = settingsBtn?.parentElement || document.querySelector('[data-slot="sidebar-header"]')?.parentElement
                if (menuContainer) {
                  const r = menuContainer.getBoundingClientRect()
                  if (r.width > 20 && r.height > 20) {
                    return {
                      left: Math.max(6, Math.round(r.left - 4)),
                      top: Math.max(6, Math.round(r.top - 4)),
                      width: Math.min(vw - 12, Math.round(r.width + 8)),
                      height: Math.min(vh - 12, Math.round(Math.min(r.height + 8, 340))),
                    }
                  }
                }
              }

              const candidates = Array.from(document.querySelectorAll(step.selector))
              const target =
                candidates.find(el => {
                  const r = el.getBoundingClientRect()
                  return r.width > 10 && r.height > 10
                }) || null

              if (target) {
                const r = target.getBoundingClientRect()
                return {
                  left: Math.max(6, Math.round(r.left - pad)),
                  top: Math.max(6, Math.round(r.top - pad)),
                  width: Math.min(vw - 12, Math.round(r.width + pad * 2)),
                  height: Math.min(vh - 12, Math.round(r.height + pad * 2)),
                }
              }

              return {
                left: Math.round(vw / 2 - 140),
                top: Math.round(vh - 140),
                width: 280,
                height: 72,
              }
            }

            function renderStep() {
              const steps = TOUR_STEPS[activeLang] || TOUR_STEPS.ru
              const step = steps[stepIdx] || steps[0]
              const vw = window.innerWidth || 1280
              const vh = window.innerHeight || 820

              const rect = resolveStepTargetRect(step, vw, vh)
              const rightEdge = rect.left + rect.width
              const bottomEdge = rect.top + rect.height

              // Position 4 blur panes around the cutout
              paneTop.style.cssText = `left:0;top:0;width:${vw}px;height:${rect.top}px;`
              paneBottom.style.cssText = `left:0;top:${bottomEdge}px;width:${vw}px;height:${Math.max(0, vh - bottomEdge)}px;`
              paneLeft.style.cssText = `left:0;top:${rect.top}px;width:${rect.left}px;height:${rect.height}px;`
              paneRight.style.cssText = `left:${rightEdge}px;top:${rect.top}px;width:${Math.max(0, vw - rightEdge)}px;height:${rect.height}px;`

              ring.style.left = `${rect.left}px`
              ring.style.top = `${rect.top}px`
              ring.style.width = `${rect.width}px`
              ring.style.height = `${rect.height}px`

              const isRu = activeLang === 'ru'
              card.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="padding:3px 9px;border-radius:999px;background:rgba(0,122,255,0.12);color:#007AFF;font-size:11px;font-weight:700;">
                      ${isRu ? `Шаг ${stepIdx + 1} из ${steps.length}` : `Step ${stepIdx + 1} of ${steps.length}`}
                    </span>
                    <div class="nomad-seg-group" style="padding:2px;">
                      <button type="button" data-tour-lang="ru" class="nomad-seg-btn" data-active="${isRu ? 'true' : 'false'}" style="padding:2px 8px;font-size:11px;">RU</button>
                      <button type="button" data-tour-lang="en" class="nomad-seg-btn" data-active="${!isRu ? 'true' : 'false'}" style="padding:2px 8px;font-size:11px;">EN</button>
                    </div>
                  </div>
                  <button type="button" data-tour-close="1" style="border:none;background:rgba(15,23,42,0.06);width:26px;height:26px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:700;color:inherit;">✕</button>
                </div>
                <div style="font-size:15px;font-weight:700;letter-spacing:-0.015em;margin-bottom:6px;">${step.title}</div>
                <div style="font-size:12.5px;line-height:1.55;opacity:0.82;margin-bottom:14px;">${step.desc}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid rgba(15,23,42,0.08);">
                  <div style="display:flex;gap:5px;">
                    ${steps
                      .map(
                        (_, idx) =>
                          `<span style="width:${idx === stepIdx ? '18px' : '6px'};height:6px;border-radius:999px;background:${idx === stepIdx ? '#007AFF' : 'rgba(15,23,42,0.18)'};transition:all 0.2s ease;"></span>`,
                      )
                      .join('')}
                  </div>
                  <div style="display:flex;gap:6px;">
                    ${
                      stepIdx > 0
                        ? `<button type="button" data-tour-prev="1" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.8);color:inherit;font-size:12px;font-weight:600;cursor:pointer;">${isRu ? '← Назад' : '← Back'}</button>`
                        : `<button type="button" data-tour-close="1" style="padding:6px 11px;border-radius:10px;border:1px solid rgba(15,23,42,0.10);background:transparent;color:inherit;opacity:0.75;font-size:12px;font-weight:600;cursor:pointer;">${isRu ? 'Пропустить' : 'Skip'}</button>`
                    }
                    <button type="button" data-tour-next="1" style="padding:6px 14px;border-radius:10px;border:none;background:#007AFF;color:#FFFFFF;font-size:12px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),0 4px 12px rgba(0,122,255,0.25);">
                      ${stepIdx < steps.length - 1 ? (isRu ? 'Далее →' : 'Next →') : isRu ? 'Готово ✓' : 'Finish ✓'}
                    </button>
                  </div>
                </div>
              `

              // Smart position card near spotlight without overlapping it
              const cardW = 392
              const cardH = 215
              let cardLeft = Math.max(16, Math.min(vw - cardW - 16, rect.left))
              let cardTop = bottomEdge + 16
              if (cardTop + cardH > vh - 16) {
                cardTop = Math.max(16, rect.top - cardH - 16)
              }
              if (rect.width > vw * 0.55 && rect.top > vh * 0.35) {
                cardLeft = Math.round(rect.left + (rect.width - cardW) / 2)
                cardTop = Math.max(24, rect.top - cardH - 18)
              }
              card.style.left = `${Math.round(cardLeft)}px`
              card.style.top = `${Math.round(cardTop)}px`

              card.querySelectorAll('[data-tour-lang]').forEach(b => {
                b.addEventListener('click', () => {
                  const nextLang = b.getAttribute('data-tour-lang') || 'ru'
                  activeLang = nextLang
                  window.setNomadLocale?.(nextLang)
                  renderStep()
                })
              })
              card.querySelectorAll('[data-tour-close]').forEach(b => {
                b.addEventListener('click', closeTour)
              })
              card.querySelector('[data-tour-prev]')?.addEventListener('click', () => {
                if (stepIdx > 0) {
                  stepIdx--
                  renderStep()
                }
              })
              card.querySelector('[data-tour-next]')?.addEventListener('click', () => {
                if (stepIdx < steps.length - 1) {
                  stepIdx++
                  renderStep()
                } else {
                  closeTour()
                }
              })
            }

            renderStep()
          })
        }

        // 4d. Кнопка «⚖ Совет моделей» и поповер выбора моделей в нижней панели ввода чата (рядом с селектором модели, как в Perplexity)
        const composerSurface = document.querySelector(
          'main:not([data-hud-shell]) [data-slot="composer-surface"], [data-chat-surface] [data-slot="composer-surface"]',
        )
        if (composerSurface && !composerSurface.querySelector('#nomad-composer-council-toggle')) {
          const allComposerBtns = Array.from(composerSurface.querySelectorAll('button'))
          const modelBtn = allComposerBtns.find(b => {
            const t = (b.textContent || '').trim().toLowerCase()
            return (
              t.includes('gpt-') ||
              t.includes('claude-') ||
              t.includes('gemini-') ||
              t.includes('deepseek') ||
              t.includes('kimi') ||
              t.includes('yandex') ||
              t.includes('gigachat') ||
              t.includes('nomad') ||
              t.includes('модель')
            )
          })
          const toolbarRow = modelBtn?.parentElement
          if (toolbarRow) {
            window.__nomadComposerCouncilState = window.__nomadComposerCouncilState || {
              enabled: false,
              preset: 'frontier',
              models: ['gpt-6.1-sol', 'claude-opus-5-5', 'gemini-3.1-pro-preview'],
              ru152fz: false,
            }

            const councilBtn = document.createElement('button')
            councilBtn.id = 'nomad-composer-council-toggle'
            councilBtn.type = 'button'
            councilBtn.setAttribute('data-testid', 'composer-council-toggle')
            councilBtn.setAttribute(
              'title',
              'Совет моделей — параллельное сравнение ответов нескольких моделей с синтезом итогового вывода',
            )

            const syncCouncilBtnUI = () => {
              const st = window.__nomadComposerCouncilState
              councilBtn.setAttribute('data-active', st.enabled ? 'true' : 'false')
              councilBtn.innerHTML = `<span style="font-size:12px;">⚖</span><span>Совет моделей${st.enabled ? ` · ${st.models.length}` : ''}</span>`
            }
            syncCouncilBtnUI()

            if (modelBtn.nextSibling) {
              toolbarRow.insertBefore(councilBtn, modelBtn.nextSibling)
            } else {
              toolbarRow.appendChild(councilBtn)
            }

            let pop = document.getElementById('nomad-composer-council-popover')
            if (!pop) {
              pop = document.createElement('div')
              pop.id = 'nomad-composer-council-popover'
              pop.setAttribute('data-testid', 'composer-council-popover')
              pop.className = 'hidden'
              document.body.appendChild(pop)

              document.addEventListener('pointerdown', ev => {
                if (
                  pop &&
                  !pop.classList.contains('hidden') &&
                  !pop.contains(ev.target) &&
                  ev.target !== councilBtn &&
                  !councilBtn.contains(ev.target)
                ) {
                  pop.classList.add('hidden')
                }
              })
            }

            const AVAILABLE_COUNCIL_MODELS = [
              { id: 'gpt-6.1-sol', label: 'GPT-6.1-sol', tag: 'Флагман' },
              { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', tag: 'Глубокий анализ' },
              { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', tag: '2M контекст' },
              { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', tag: 'Код и инженерия' },
              { id: 'yandexgpt/latest', label: 'YandexGPT 5 Pro', tag: '152-ФЗ · РФ' },
              { id: 'GigaChat-2-Max', label: 'GigaChat 2 Max', tag: '152-ФЗ · РФ' },
              { id: 'cotype-pro-3', label: 'МТС Cotype Pro 3', tag: '152-ФЗ · РФ' },
            ]

            const renderCouncilPopover = () => {
              const st = window.__nomadComposerCouncilState
              pop.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid rgba(15,23,42,0.08);">
                  <div>
                    <div style="font-size:13px;font-weight:700;letter-spacing:-0.01em;">Совет моделей</div>
                    <div style="font-size:11px;opacity:0.68;">Параллельный опрос нескольких моделей и сводный вывод</div>
                  </div>
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:11.5px;font-weight:600;color:#007AFF;">
                    <input type="checkbox" data-council-enable="1" ${st.enabled ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
                    <span>${st.enabled ? 'Включён' : 'Выкл'}</span>
                  </label>
                </div>

                <div style="margin-top:10px;">
                  <div style="font-size:10px;font-weight:700;opacity:0.58;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Быстрые наборы</div>
                  <div class="nomad-seg-group" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;">
                    <button type="button" class="nomad-seg-btn" data-council-preset="frontier" data-active="${st.preset === 'frontier' ? 'true' : 'false'}" style="justify-content:center;padding:5px 6px;font-size:11px;">Фронтир</button>
                    <button type="button" class="nomad-seg-btn" data-council-preset="code" data-active="${st.preset === 'code' ? 'true' : 'false'}" style="justify-content:center;padding:5px 6px;font-size:11px;">Код и ревью</button>
                    <button type="button" class="nomad-seg-btn" data-council-preset="ru" data-active="${st.preset === 'ru' ? 'true' : 'false'}" style="justify-content:center;padding:5px 6px;font-size:11px;">Контур РФ</button>
                  </div>
                </div>

                <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;max-height:190px;overflow-y:auto;">
                  ${AVAILABLE_COUNCIL_MODELS.map(m => {
                    const checked = st.models.includes(m.id)
                    return `
                      <label style="display:flex;align-items:center;justify-content:space-between;padding:6px 9px;border-radius:9px;background:${checked ? 'rgba(0,122,255,0.08)' : 'rgba(255,255,255,0.55)'};border:1px solid ${checked ? 'rgba(0,122,255,0.28)' : 'rgba(15,23,42,0.07)'};cursor:pointer;font-size:12px;">
                        <span style="display:flex;align-items:center;gap:7px;font-weight:${checked ? '600' : '500'};">
                          <input type="checkbox" data-council-model="${m.id}" ${checked ? 'checked' : ''} style="accent-color:#007AFF;cursor:pointer;" />
                          <span>${m.label}</span>
                        </span>
                        <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(15,23,42,0.06);opacity:0.75;">${m.tag}</span>
                      </label>
                    `
                  }).join('')}
                </div>

                <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(15,23,42,0.08);display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <button type="button" data-council-open-full="1" style="padding:7px 11px;border-radius:9px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.75);color:inherit;font-size:11.5px;font-weight:600;cursor:pointer;">Развёрнутое сравнение →</button>
                  <button type="button" data-council-apply="1" style="padding:7px 14px;border-radius:9px;border:none;background:#007AFF;color:#fff;font-size:11.5px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);">Готово (${st.models.length})</button>
                </div>
              `

              pop.querySelector('[data-council-enable]')?.addEventListener('change', e => {
                st.enabled = Boolean(e.target.checked)
                syncCouncilBtnUI()
                renderCouncilPopover()
              })
              pop.querySelectorAll('[data-council-preset]').forEach(b => {
                b.addEventListener('click', () => {
                  const pr = b.getAttribute('data-council-preset')
                  st.preset = pr
                  st.enabled = true
                  if (pr === 'frontier') {
                    st.models = ['gpt-6.1-sol', 'claude-opus-5-5', 'gemini-3.1-pro-preview']
                    st.ru152fz = false
                  } else if (pr === 'code') {
                    st.models = ['gpt-6.1-sol', 'claude-opus-5-5', 'kimi-k2.7-code']
                    st.ru152fz = false
                  } else if (pr === 'ru') {
                    st.models = ['yandexgpt/latest', 'GigaChat-2-Max', 'cotype-pro-3']
                    st.ru152fz = true
                  }
                  syncCouncilBtnUI()
                  renderCouncilPopover()
                })
              })
              pop.querySelectorAll('[data-council-model]').forEach(chk => {
                chk.addEventListener('change', () => {
                  const mid = chk.getAttribute('data-council-model')
                  if (chk.checked) {
                    if (!st.models.includes(mid)) st.models.push(mid)
                    st.enabled = true
                  } else if (st.models.length > 1) {
                    st.models = st.models.filter(x => x !== mid)
                  }
                  syncCouncilBtnUI()
                  renderCouncilPopover()
                })
              })
              pop.querySelector('[data-council-open-full]')?.addEventListener('click', () => {
                pop.classList.add('hidden')
                navigateNomad('/nomad-council')
              })
              pop.querySelector('[data-council-apply]')?.addEventListener('click', () => {
                pop.classList.add('hidden')
              })
            }

            const positionCouncilPopover = () => {
              const rect = councilBtn.getBoundingClientRect()
              const popW = 380
              const buddyDrawer = document.getElementById('nomad-buddy-drawer')
              const rightOffset =
                buddyDrawer && !buddyDrawer.classList.contains('hidden')
                  ? Math.round(buddyDrawer.getBoundingClientRect().width) + 12
                  : 16
              const maxLeft = (window.innerWidth || 1200) - popW - rightOffset
              const left = Math.max(14, Math.min(maxLeft, rect.left - 40))
              const bottom = Math.max(64, (window.innerHeight || 820) - rect.top + 10)
              pop.style.left = `${Math.round(left)}px`
              pop.style.top = 'auto'
              pop.style.bottom = `${Math.round(bottom)}px`
            }

            councilBtn.addEventListener('click', e => {
              e.stopPropagation()
              if (pop.classList.contains('hidden')) {
                renderCouncilPopover()
                pop.classList.remove('hidden')
                positionCouncilPopover()
              } else {
                pop.classList.add('hidden')
              }
            })
          }
        }
      }

      // 5. Инжектируем интерактивные значки «?» (Help Badges) с русским описанием опций при наведении
      const candidateLabels = document.querySelectorAll('h1, h2, h3, label, span, div')
      for (const el of candidateLabels) {
        if (el.hasAttribute('data-nomad-q-checked')) continue
        if (el.childElementCount > 1) continue
        if (el.closest('aside, nav, [role="navigation"], [data-sidebar], button, a, #nomad-buddy-drawer, #nomad-buddy-fab')) continue
        const rawText = (el.textContent || '').replace(/\?$/, '').trim()
        const desc = HELP_BADGE_DESCRIPTIONS[rawText]
        if (desc && !el.querySelector('.nomad-help-q')) {
          el.setAttribute('data-nomad-q-checked', 'true')
          const qBadge = document.createElement('span')
          qBadge.className = 'nomad-help-q'
          qBadge.setAttribute('data-nomad-help-q', rawText)
          qBadge.setAttribute('data-nomad-tooltip', desc)
          qBadge.textContent = '?'
          el.appendChild(qBadge)
        }
      }

      // 6. Синхронизируем чекбокс «Случайные прогулки по экрану» на странице Настройки > Питомец с жёстким локом позиции
      document.querySelectorAll('label, div').forEach(row => {
        const t = (row.textContent || '').trim()
        if (t.startsWith('Случайные прогулки по экрану')) {
          const chk = row.parentElement?.querySelector('input[type="checkbox"], button[role="switch"]')
          if (chk && !chk.hasAttribute('data-nomad-roam-synced')) {
            chk.setAttribute('data-nomad-roam-synced', 'true')
            chk.addEventListener('click', () => {
              setTimeout(() => {
                const isChecked =
                  chk.checked === true || chk.getAttribute('aria-checked') === 'true'
                const cur = loadMascotSettings()
                cur.randomWalk = isChecked
                if (!isChecked && petContainer) {
                  const r = petContainer.getBoundingClientRect()
                  cur.lockedX = Math.round(r.left)
                  cur.lockedY = Math.round(r.top)
                }
                saveMascotSettings(cur)
                if (petContainer) enforcePetPositionLock(petContainer)
              }, 50)
            })
          }
        }
      })

      // 7. Добавляем подробные русские тултипы к навигации и кнопкам
      const interactiveEls = document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]')
      for (const el of interactiveEls) {
        if (el.getAttribute('title')) continue
        const label = (el.textContent || '').replace(/\?$/, '').trim()
        const tip = NOMAD_TOOLTIPS_BY_TEXT[label] || HELP_BADGE_DESCRIPTIONS[label]
        if (tip) {
          el.setAttribute('title', tip)
          el.setAttribute('data-nomad-tooltip', tip)
        }
      }

      // 8. Краткие описания и стоимость моделей ($вход / $выход за 1М токенов) в селекторе моделей композера
      const MODEL_DROPDOWN_META = {
        'NomadNet Auto': { desc: 'Умный Fugu/Jev роутер по сложности задачи', price: 'Авто · -68%' },
        'nomadnet-auto': { desc: 'Умный Fugu/Jev роутер по сложности задачи', price: 'Авто · -68%' },
        'Fable 5.1': { desc: 'Агентский флагман · сложный код и тулы · 1M', price: '$6 / $30' },
        'Fable 5': { desc: 'Агентская разработка и оркестрация · 1M', price: '$5 / $25' },
        'Opus 5.5': { desc: 'Максимум рассуждений и архитектуры · 1M', price: '$5 / $25' },
        'Opus 5': { desc: 'Глубокая аналитика и рефакторинг · 1M', price: '$5 / $25' },
        'Sonnet 5.5': { desc: 'Оптимальный баланс скорости и кода · 1M', price: '$3 / $15' },
        'Sonnet 5': { desc: 'Быстрый продакшн-код и диалоги · 1M', price: '$3 / $15' },
        'Haiku 5.5': { desc: 'Мгновенные ответы и лёгкие правки · 200K', price: '$0.8 / $4' },
        'Opus 4.8': { desc: 'Тяжёлый анализ и архитектура · 1M', price: '$5 / $25' },
        'Opus 4.7': { desc: 'Глубокий анализ и код · 1M', price: '$5 / $25' },
        'Opus 4.6': { desc: 'Аналитика и проектирование (пред. поколение)', price: '$5 / $25' },
        'Sonnet 4.6': { desc: 'Универсальная кодовая модель · 1M', price: '$3 / $15' },
        'Opus 4.5': { desc: 'Сложные задачи (пред. поколение)', price: '$5 / $25' },
        'Sonnet 4.5': { desc: 'Кодинг и работа с текстом (пред. поколение)', price: '$3 / $15' },
        'Opus 4': { desc: 'Базовый Opus 4 · глубокий разбор', price: '$5 / $25' },
        'Sonnet 4': { desc: 'Базовый Sonnet 4 · повседневный код', price: '$3 / $15' },
        'Haiku 4.5': { desc: 'Быстрая компактная модель · 200K', price: '$0.8 / $4' },
        'GPT-6.1-sol': { desc: 'Флагман кода и агентики · 400K контекст', price: '$2.5 / $10' },
        'GPT-6.1-sol-900k': { desc: 'Флагман кода · длинный контекст 900K', price: '$2.5 / $10' },
        'GPT-6-astra': { desc: 'Глубокий исследовательский разум · 400K', price: '$5 / $20' },
        'GPT-6-astra-900k': { desc: 'Глубокий разум · весь репозиторий 900K', price: '$5 / $20' },
        'GPT-6-sol': { desc: 'Универсальный флагман инженерии · 400K', price: '$2 / $8' },
        'GPT-6-sol-900k': { desc: 'Инженерный флагман · контекст 900K', price: '$2 / $8' },
        'GPT-6-luna': { desc: 'Быстрая и экономная для рутины · 200K', price: '$0.4 / $1.6' },
        'GPT-6-luna-900k': { desc: 'Быстрая модель · длинный контекст 900K', price: '$0.4 / $1.6' },
        'GPT-5.6-sol': { desc: 'Надёжный кодинг (режим Pro) · 400K', price: '$1.75 / $7' },
        'GPT-5.6-sol-900k': { desc: 'Надёжный кодинг · контекст 900K', price: '$1.75 / $7' },
        'GPT-5.6-terra': { desc: 'Быстрая математика, логика и алгоритмы', price: '$1.25 / $5' },
        'GPT-5.6-terra-900k': { desc: 'Математика и алгоритмы · контекст 900K', price: '$1.25 / $5' },
        'GPT-5.6-luna': { desc: 'Ультра-эконом для частых задач · 200K', price: '$0.25 / $1' },
        'GPT-5.6-luna-900k': { desc: 'Ультра-эконом · длинный контекст 900K', price: '$0.25 / $1' },
        'DeepSeek V4 Pro': { desc: 'Сильный кодинг и рассуждения · 128K', price: '$0.55 / $2.2' },
        'DeepSeek': { desc: 'Супер-эконом Flash для быстрых задач · 128K', price: '$0.14 / $0.28' },
        'Gemini 3.1 Pro': { desc: 'Мультимодальный флагман · 2M контекст', price: '$1.25 / $10' },
        'Gemini 3.8 Flash': { desc: 'Новейший быстрый Flash · 1M контекст', price: '$0.3 / $2.4' },
        'Gemini 3.7 Flash': { desc: 'Быстрый код и агентика · 1M контекст', price: '$0.15 / $0.6' },
        'Kimi K3': { desc: 'Глубокий анализ и длинный контекст · 256K', price: '$1 / $4' },
        'Kimi K2.7 Code': { desc: 'Специалист по коду и патчам · 256K', price: '$0.6 / $2.5' },
        'YandexGPT 5 Pro': { desc: 'Суверенный контур РФ · 152-ФЗ · 32K', price: '1 200 ₽ / 1M' },
        'GigaChat 2 Max': { desc: 'Флагман Сбера · 152-ФЗ · 128K', price: '1 500 ₽ / 1M' }
      }
      document.querySelectorAll('[data-slot="dropdown-menu-content"]').forEach(menu => {
        const searchWrap = menu.querySelector('[data-slot="dropdown-menu-search"]')
        if (!searchWrap) return
        const searchInp = searchWrap.querySelector('input')
        if (searchInp && searchInp.getAttribute('placeholder') !== 'Поиск модели (тариф: вход / выход за 1М токенов)…') {
          searchInp.setAttribute('placeholder', 'Поиск модели (тариф: вход / выход за 1М токенов)…')
        }
        menu.querySelectorAll('[data-slot="dropdown-menu-sub-trigger"], [data-slot="dropdown-menu-item"]').forEach(item => {
          const flexWrap = item.querySelector('span.flex-1')
          const nameSpan = flexWrap ? flexWrap.querySelector('span.truncate') : item.querySelector('span.truncate')
          if (!nameSpan) return
          const rawName = (nameSpan.textContent || '').trim()
          const meta = MODEL_DROPDOWN_META[rawName]
          if (meta) {
            if (nameSpan.getAttribute('data-nomad-model-desc') !== meta.desc) {
              nameSpan.setAttribute('data-nomad-model-desc', meta.desc)
            }
            if (flexWrap && flexWrap.getAttribute('data-nomad-model-price') !== meta.price) {
              flexWrap.setAttribute('data-nomad-model-price', meta.price)
            }
            if (item.getAttribute('data-nomad-model-price') !== meta.price) {
              item.setAttribute('data-nomad-model-price', meta.price)
            }
          }
        })
      })
    } catch {
      // ignore DOM observer errors
    }
  }

  enhanceDom()
  if (typeof MutationObserver !== 'undefined' && document.body && !window.__nomadDomObserverActive) {
    window.__nomadDomObserverActive = true
    let enhanceScheduled = false
    let isEnhancing = false
    const observer = new MutationObserver(() => {
      if (isEnhancing || enhanceScheduled) return
      enhanceScheduled = true
      setTimeout(() => {
        enhanceScheduled = false
        isEnhancing = true
        try {
          enhanceDom()
        } finally {
          isEnhancing = false
        }
      }, 60)
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
}

export default function registerThemes(ctx) {
  if (!ctx || typeof ctx.register !== 'function') {
    return
  }

  if (typeof window !== 'undefined') {
    window.__nomadPluginCtx = ctx
  }

  for (const theme of NOMAD_THEMES) {
    ctx.register({
      id: theme.name,
      area: THEMES_AREA,
      data: theme
    })
  }

  applyNomadVisualIdentityAndTooltips()
}
