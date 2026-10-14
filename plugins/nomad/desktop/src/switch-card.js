// M-133: Карточка переключения аккаунтов в чате десктопа (слот composer.top).
// При ошибке 429 и ротации пула с #1 на #2 отображает карточку
// «Аккаунт #1 исчерпан, перешёл на #2».
// Повтор того же api_request_id не создаёт вторую карточку.

import { PALETTE_AREA, atom, host } from '@hermes/plugin-sdk'
import { createElement, useCallback, useEffect, useState } from 'react'

export const activeSwitchCardAtom = atom(null)

const h = createElement

const _SEEN_REQUEST_IDS = new Set()

export function handleAccountSwitchEvent(ctx, payload = {}) {
  const reqId = payload.api_request_id || payload.request_id || `req_${Date.now()}`
  if (_SEEN_REQUEST_IDS.has(reqId)) {
    return null
  }
  _SEEN_REQUEST_IDS.add(reqId)

  const fromSlot = payload.from_slot || '#1'
  const toSlot = payload.to_slot || '#2'
  const provider = payload.provider || 'провайдер'
  const statusCode = payload.status_code || 429
  const timeStr = payload.ts ? payload.ts.slice(11, 16) : new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

  const switchData = {
    apiRequestId: reqId,
    statusCode,
    provider,
    model: payload.model || '',
    fromSlot,
    toSlot,
    time: timeStr,
    title: `Аккаунт ${fromSlot} исчерпан, перешёл на ${toSlot}`,
    line: payload.line || `${timeStr} · ${provider} · ${statusCode} · активна ${toSlot}`,
    switchedAt: payload.ts || new Date().toISOString(),
  }

  activeSwitchCardAtom.set(switchData)

  if (host && typeof host.notify === 'function') {
    host.notify(`Nomad: ${switchData.title}`)
  }

  return switchData
}

export function clearSwitchCard() {
  activeSwitchCardAtom.set(null)
}

export function openAccountsPage(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === 'function') {
    return ctx.host.navigate('/nomad-accounts')
  }
  if (typeof window !== 'undefined' && window.location) {
    window.location.hash = '#/nomad-accounts'
    return Promise.resolve(true)
  }
  return Promise.resolve(false)
}

export function SwitchCard({ ctx, payload = null, onDismiss = null }) {
  const [data, setData] = useState(payload || activeSwitchCardAtom.get())

  useEffect(() => {
    const unbind = activeSwitchCardAtom.subscribe((val) => {
      if (val) setData(val)
    })
    return () => unbind()
  }, [])

  const handleDismiss = useCallback(() => {
    clearSwitchCard()
    if (typeof onDismiss === 'function') {
      onDismiss()
    }
  }, [onDismiss])

  const handleOpenAccounts = useCallback(() => {
    openAccountsPage(ctx)
  }, [ctx])

  if (!data) return null

  return h(
    'div',
    {
      'data-testid': 'nomad-switch-card',
      style: {
        margin: '10px 0',
        padding: '16px 20px',
        borderRadius: '12px',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        background: 'rgba(245, 158, 11, 0.08)',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        maxWidth: '720px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h('span', {
          style: {
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#f59e0b',
          },
        }),
        h(
          'strong',
          {
            'data-testid': 'switch-card-title',
            style: { fontSize: '14px', fontWeight: 600 },
          },
          data.title || `Аккаунт ${data.fromSlot} исчерпан, перешёл на ${data.toSlot}`,
        ),
      ),
      h(
        'span',
        {
          'data-testid': 'switch-card-status',
          style: {
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(245, 158, 11, 0.18)',
            color: '#d97706',
            fontWeight: 600,
          },
        },
        `429 · АКТИВЕН ${data.toSlot}`,
      ),
    ),
    h(
      'p',
      {
        'data-testid': 'switch-card-desc',
        style: { margin: 0, fontSize: '13px', lineHeight: 1.5, opacity: 0.9 },
      },
      `На вашей учётной записи ${data.fromSlot} исчерпан лимит запросов (код 429). Оркестратор автоматически переключил отправку на резервный слот ${data.toSlot}. Вы можете продолжить работу без прерывания.`,
    ),
    h(
      'div',
      { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginTop: '4px' } },
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'switch-card-open-accounts-btn',
          onClick: handleOpenAccounts,
          style: {
            padding: '7px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'var(--primary, #2563eb)',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          },
        },
        'Управление аккаунтами',
      ),
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'switch-card-dismiss-btn',
          onClick: handleDismiss,
          style: {
            padding: '7px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border, rgba(128,128,128,0.3))',
            background: 'transparent',
            color: 'inherit',
            fontSize: '13px',
            cursor: 'pointer',
          },
        },
        'Закрыть уведомление',
      ),
    ),
  )
}

export default function registerSwitchCardPlugin(ctx) {
  // Слушаем событие ротации аккаунтов
  if (ctx && typeof ctx.onEvent === 'function') {
    ctx.onEvent('account_switch', (payload) => {
      handleAccountSwitchEvent(ctx, payload)
    })
  }

  // Регистрация в слоте composer.top чата десктопа
  if (ctx && typeof ctx.register === 'function') {
    ctx.register({
      id: 'switch-card-composer',
      area: 'composer.top',
      order: 50,
      render: () => h(SwitchCard, { ctx }),
    })

    // Регистрация в палитре (Ctrl+K)
    ctx.register({
      id: 'palette',
      area: PALETTE_AREA,
      order: 67,
      data: {
        id: 'nomad.accounts.switch_feed',
        action: 'nomad.accounts.switch_feed',
        label: 'Лента переключений аккаунтов',
        category: 'Nomad',
        keywords: ['аккаунты', 'ротация', '429', 'слот', 'переключение', 'switch', 'feed'],
        run: () => openAccountsPage(ctx),
      },
    })
  }
}
