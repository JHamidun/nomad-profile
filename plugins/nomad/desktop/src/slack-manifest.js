/**
 * Команда палитры десктопа «Сгенерировать манифест Slack» (M-146).
 *
 * Запрашивает `GET /api/plugins/nomad/slack/manifest` через `ctx.rest('/slack/manifest')`,
 * копирует полученный JSON-манифест в `navigator.clipboard.writeText` и показывает уведомление:
 * «Манифест скопирован — вставьте в api.slack.com/apps → Create from manifest».
 */

import { PALETTE_AREA } from '@hermes/plugin-sdk'

export const SLACK_MANIFEST_PALETTE_ID = 'nomad.slack.manifest'
export const SLACK_MANIFEST_LABEL = 'Сгенерировать манифест Slack'
export const SLACK_MANIFEST_TOAST =
  'Манифест скопирован — вставьте в api.slack.com/apps → Create from manifest'

function fetchSlackManifest(ctx) {
  if (ctx && ctx.rest && typeof ctx.rest.get === 'function') {
    return Promise.resolve(ctx.rest.get('/slack/manifest'))
  }
  if (ctx && typeof ctx.rest === 'function') {
    return Promise.resolve(ctx.rest('/slack/manifest'))
  }
  return Promise.reject(new Error('Сервер плагина недоступен.'))
}

function showToast(ctx, message, kind = 'info') {
  if (ctx && ctx.toast && typeof ctx.toast[kind] === 'function') {
    ctx.toast[kind](message)
    return
  }
  if (ctx && typeof ctx.toast === 'function') {
    ctx.toast(message, { type: kind })
    return
  }
  if (ctx && ctx.ui && typeof ctx.ui.toast === 'function') {
    ctx.ui.toast({ message, type: kind })
    return
  }
  if (ctx && ctx.host && typeof ctx.host.toast === 'function') {
    ctx.host.toast(message, kind)
  }
}

export async function copySlackManifestToClipboard(ctx) {
  const payload = await fetchSlackManifest(ctx)
  const manifestObj =
    payload && typeof payload === 'object' && payload.manifest && typeof payload.manifest === 'object'
      ? payload.manifest
      : payload
  const jsonText =
    typeof manifestObj === 'string'
      ? manifestObj
      : `${JSON.stringify(manifestObj, null, 2)}\n`

  if (
    typeof globalThis !== 'undefined' &&
    globalThis.navigator &&
    globalThis.navigator.clipboard &&
    typeof globalThis.navigator.clipboard.writeText === 'function'
  ) {
    await globalThis.navigator.clipboard.writeText(jsonText)
  } else if (ctx && ctx.clipboard && typeof ctx.clipboard.writeText === 'function') {
    await ctx.clipboard.writeText(jsonText)
  }

  showToast(ctx, SLACK_MANIFEST_TOAST, 'info')
  return jsonText
}

export default function registerSlackManifest(ctx) {
  if (!ctx || typeof ctx.register !== 'function') {
    return
  }

  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 85,
    label: SLACK_MANIFEST_LABEL,
    data: {
      id: SLACK_MANIFEST_PALETTE_ID,
      action: SLACK_MANIFEST_PALETTE_ID,
      title: SLACK_MANIFEST_LABEL,
      label: SLACK_MANIFEST_LABEL,
      category: 'Nomad',
      codicon: 'comment-discussion',
      keywords: ['slack', 'manifest', 'манифест', 'бот', 'интеграция'],
      run: () => copySlackManifestToClipboard(ctx),
      onSelect: () => copySlackManifestToClipboard(ctx)
    }
  })
}
