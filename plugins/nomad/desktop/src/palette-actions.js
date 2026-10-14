// M-237: Строки палитры ⌘K «Показать откаты» и «Перенести настройки из Claude Code».
// Строка палитры «Перенести настройки из Claude Code» открывает /nomad-start с превью import-agent.
// Строка палитры «Показать откаты» открывает /nomad-data на блоке откатов.
// Строк плагина в боковом меню по-прежнему строго 6 (нет регистрации в боковом меню).

import { PALETTE_AREA } from '@hermes/plugin-sdk'

export const IMPORT_PALETTE_LABEL = 'Перенести настройки из Claude Code'
export const ROLLBACKS_PALETTE_LABEL = 'Показать откаты'

export const IMPORT_TARGET_ROUTE = '/nomad-start#import-agent'
export const ROLLBACKS_TARGET_ROUTE = '/nomad-data#checkpoints'

export function openImportSettings(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === 'function') {
    return ctx.host.navigate(IMPORT_TARGET_ROUTE)
  }
  if (typeof window !== 'undefined' && window.location) {
    window.location.hash = '#' + IMPORT_TARGET_ROUTE
    return Promise.resolve(true)
  }
  return Promise.resolve(false)
}

export function openRollbacks(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === 'function') {
    return ctx.host.navigate(ROLLBACKS_TARGET_ROUTE)
  }
  if (typeof window !== 'undefined' && window.location) {
    window.location.hash = '#' + ROLLBACKS_TARGET_ROUTE
    return Promise.resolve(true)
  }
  return Promise.resolve(false)
}

export default function registerPaletteActions(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return

  // 1. Строка палитры «Перенести настройки из Claude Code»
  ctx.register({
    id: 'palette-import-claude-code',
    area: PALETTE_AREA,
    order: 245,
    data: {
      id: 'nomad.start.import_claude_code',
      action: 'nomad.start.import_claude_code',
      label: IMPORT_PALETTE_LABEL,
      category: 'Nomad',
      keywords: ['перенести', 'настройки', 'claude code', 'claude-code', 'import', 'старт', 'миграция', 'start'],
      run: () => openImportSettings(ctx),
    },
  })

  // 2. Строка палитры «Показать откаты»
  ctx.register({
    id: 'palette-show-rollbacks',
    area: PALETTE_AREA,
    order: 246,
    data: {
      id: 'nomad.data.show_rollbacks',
      action: 'nomad.data.show_rollbacks',
      label: ROLLBACKS_PALETTE_LABEL,
      category: 'Nomad',
      keywords: ['откаты', 'показать откаты', 'снимки', 'checkpoints', 'rollback', 'data', 'место'],
      run: () => openRollbacks(ctx),
    },
  })
}
