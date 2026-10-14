// М-104: Карточка «Пополнить» в чате десктопа по событию billing_block (402).
// При исчерпании средств или блокировке шлюза отображает в чате карточку с кнопкой
// пополнения, вызывающей ctx.os.openExternal(topup_url), и обновляет баланс без перезапуска.

import { PALETTE_AREA, atom, host } from '@hermes/plugin-sdk'
import { createElement, useCallback, useEffect, useState } from 'react'

export const DEFAULT_TOPUP_URL = 'https://nomadnet.ru/cabinet/billing'
export const activeTopupBlockAtom = atom(null)

const h = createElement

export function openExternalUrl(ctx, url) {
  const targetUrl = url || DEFAULT_TOPUP_URL
  if (ctx && ctx.os && typeof ctx.os.openExternal === 'function') {
    return ctx.os.openExternal(targetUrl)
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(targetUrl, '_blank', 'noopener,noreferrer')
    return Promise.resolve(true)
  }
  return Promise.resolve(false)
}

export async function fetchUpdatedAccount(ctx) {
  if (ctx && typeof ctx.rest === 'function') {
    return await ctx.rest('/account')
  }
  if (typeof fetch === 'function') {
    const res = await fetch('/api/plugins/nomad/account')
    if (res.ok) {
      return await res.json()
    }
  }
  return null
}

export function handleBillingBlockEvent(ctx, payload = {}) {
  const blockData = {
    statusCode: payload.status_code || 402,
    reason: payload.reason || 'insufficient_credits',
    topupUrl: payload.topup_url || DEFAULT_TOPUP_URL,
    message:
      payload.message ||
      'На вашем счёте исчерпан баланс номадов (ошибка 402). Пополните баланс для продолжения отправки запросов.',
    blockedAt: payload.blocked_at || new Date().toISOString(),
  }
  activeTopupBlockAtom.set(blockData)

  if (host && typeof host.notify === 'function') {
    host.notify('NomadNet: баланс исчерпан, требуется пополнение')
  }
  return blockData
}

export function clearBillingBlock() {
  activeTopupBlockAtom.set(null)
}

export function TopupCard({ ctx, payload = null, onDismiss = null }) {
  const [data, setData] = useState(payload || activeTopupBlockAtom.get())
  const [checking, setChecking] = useState(false)
  const [checkStatus, setCheckStatus] = useState('')
  const [resolved, setResolved] = useState(false)

  useEffect(() => {
    const unbind = activeTopupBlockAtom.subscribe((val) => {
      if (val) setData(val)
    })
    return () => unbind()
  }, [])

  const topupUrl = (data && data.topupUrl) || DEFAULT_TOPUP_URL

  const handlePayClick = useCallback(() => {
    openExternalUrl(ctx, topupUrl)
    setCheckStatus('Открыта страница оплаты. После завершения платежа нажмите «Обновить баланс».')
  }, [ctx, topupUrl])

  const handleRefreshClick = useCallback(async () => {
    setChecking(true)
    setCheckStatus('Проверяем поступление средств…')
    try {
      const acc = await fetchUpdatedAccount(ctx)
      const nomads =
        acc && acc.balance && acc.balance.nomads !== undefined
          ? Number(acc.balance.nomads)
          : Number(acc && acc.nomads) || 0

      if (nomads > 0) {
        setResolved(true)
        setCheckStatus(`Баланс успешно пополнен: ${nomads.toLocaleString('ru-RU')} номадов. Блокировка снята.`)
        clearBillingBlock()
        if (host && typeof host.notify === 'function') {
          host.notify(`Баланс пополнен: ${nomads} номадов`)
        }
        if (typeof onDismiss === 'function') {
          setTimeout(onDismiss, 1200)
        }
      } else {
        setCheckStatus('Баланс пока не изменился. Если вы только что оплатили счёт, подождите 10-30 секунд.')
      }
    } catch (err) {
      setCheckStatus('Не удалось связаться с сервером. Повторите попытку позже.')
    } finally {
      setChecking(false)
    }
  }, [ctx, onDismiss])

  return h(
    'div',
    {
      'data-testid': 'nomad-topup-card',
      style: {
        margin: '12px 0',
        padding: '18px 22px',
        borderRadius: '12px',
        border: resolved ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)',
        background: resolved ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        maxWidth: '720px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        h(
          'span',
          {
            style: {
              display: 'inline-block',
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: resolved ? '#10b981' : '#ef4444',
            },
          },
        ),
        h(
          'strong',
          {
            'data-testid': 'topup-card-title',
            style: { fontSize: '15px', fontWeight: 600 },
          },
          resolved ? 'Баланс NomadNet обновлён' : 'Пополнить баланс NomadNet',
        ),
      ),
      h(
        'span',
        {
          style: {
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '6px',
            background: 'rgba(128,128,128,0.15)',
            fontWeight: 600,
          },
        },
        resolved ? 'АКТИВЕН' : '402 PAYMENT REQUIRED',
      ),
    ),
    h(
      'p',
      {
        'data-testid': 'topup-card-desc',
        style: { margin: 0, fontSize: '13px', lineHeight: 1.5, opacity: 0.9 },
      },
      resolved
        ? 'Средства поступили на ваш единый счёт NomadNet. Вы можете продолжить отправку сообщений и запуск сценариев без перезапуска приложения.'
        : 'На вашем счёте исчерпан баланс номадов (ошибка 402). Чтобы продолжить общение с ассистентом и выполнение задач, пополните баланс в личном кабинете.',
    ),
    !resolved &&
      h(
        'div',
        { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'topup-card-pay-btn',
            onClick: handlePayClick,
            style: {
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary, #2563eb)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            },
          },
          'Пополнить баланс',
        ),
        h(
          'button',
          {
            type: 'button',
            'data-testid': 'topup-card-refresh-btn',
            onClick: handleRefreshClick,
            disabled: checking,
            style: {
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(128,128,128,0.3))',
              background: 'transparent',
              color: 'inherit',
              fontSize: '13px',
              fontWeight: 500,
              cursor: checking ? 'default' : 'pointer',
              opacity: checking ? 0.7 : 1,
            },
          },
          checking ? 'Проверка…' : 'Я оплатил — обновить баланс',
        ),
      ),
    checkStatus &&
      h(
        'div',
        {
          'data-testid': 'topup-card-status',
          style: {
            fontSize: '12px',
            opacity: 0.85,
            color: resolved ? '#10b981' : 'inherit',
          },
        },
        checkStatus,
      ),
  )
}

export default function registerTopupCardPlugin(ctx) {
  // Слушаем событие billing_block от шлюза
  if (ctx && typeof ctx.onEvent === 'function') {
    ctx.onEvent('billing_block', (payload) => {
      handleBillingBlockEvent(ctx, payload)
    })
  }

  // Регистрация в палитре (Ctrl+K)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 66,
    data: {
      id: 'nomad.topup.open',
      action: 'nomad.topup.open',
      label: 'Пополнить баланс NomadNet',
      category: 'Nomad',
      keywords: ['пополнить', 'баланс', 'оплата', '402', 'кабинет', 'номады', 'topup'],
      run: () => openExternalUrl(ctx, DEFAULT_TOPUP_URL),
    },
  })
}
