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

import { THEMES_AREA } from '@hermes/plugin-sdk'

export const DEFAULT_NOMAD_THEME = 'nomad-dark'

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

export const NOMAD_THEMES = [
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

export default function registerThemes(ctx) {
  if (!ctx || typeof ctx.register !== 'function') {
    return
  }

  for (const theme of NOMAD_THEMES) {
    ctx.register({
      id: theme.name,
      area: THEMES_AREA,
      data: theme
    })
  }
}
