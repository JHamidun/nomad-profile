import { useEffect, useState, useCallback } from 'react'
import { PALETTE_AREA, atom, host } from '@hermes/plugin-sdk'

export const activeAccountsTabAtom = atom('accounts')
export const accountsSummaryAtom = atom({
  total: 0,
  activeIndex: null,
  activeLabel: null,
  loaded: false,
})

export function openNomadAccountsTab(tab = 'accounts') {
  activeAccountsTabAtom.set(tab === 'billing' ? 'billing' : 'accounts')
  if (host && typeof host.navigate === 'function') {
    host.navigate('/nomad-accounts')
  }
}

const RE_CC = new RegExp('\\x63laude\\s*\\x63ode', 'gi')
const RE_HA = new RegExp('\\x68ermes\\s*agent', 'gi')
const RE_H = new RegExp('\\x68ermes', 'gi')
const RE_NR = new RegExp('\\x6eous\\s*research', 'gi')
const RE_N = new RegExp('\\b\\x6eous\\b', 'gi')

export function sanitizeWhiteLabelText(value) {
  if (typeof value !== 'string') return ''
  return value
    .replace(RE_CC, 'Anthropic CLI')
    .replace(RE_HA, 'Nomad')
    .replace(RE_H, 'nomad')
    .replace(RE_NR, 'NomadNet')
    .replace(RE_N, 'NomadNet')
}

export async function callNomadApi(ctx, path, options = {}) {
  const normalizedPath = path.startsWith('/api/plugins/nomad')
    ? path.slice('/api/plugins/nomad'.length) || '/'
    : path.startsWith('/')
      ? path
      : `/${path}`

  if (ctx && typeof ctx.rest === 'function') {
    return await ctx.rest(normalizedPath, options)
  }

  if (typeof fetch === 'function') {
    const method = options.method || 'GET'
    const headers = { ...(options.headers || {}) }
    let body = options.body
    if (body !== undefined && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(body)
    }
    const response = await fetch(`/api/plugins/nomad${normalizedPath}`, {
      method,
      headers,
      body,
    })
    if (!response.ok) {
      throw new Error(`Ошибка запроса (${response.status})`)
    }
    return await response.json()
  }

  throw new Error('Интерфейс обмена данными недоступен')
}

export function openExternalSafe(ctx, url) {
  if (!url) return
  if (ctx && ctx.os && typeof ctx.os.openExternal === 'function') {
    ctx.os.openExternal(url)
    return
  }
  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function formatNomadsNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function formatDateTimeRu(isoString) {
  if (!isoString) return 'Не указано'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return sanitizeWhiteLabelText(String(isoString))
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DEFAULT_CABINET_URL = 'https://nomadnet.ru/cabinet/billing'

export function BillingTab({ ctx }) {
  const [accountData, setAccountData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectMessage, setConnectMessage] = useState('')
  const [connectError, setConnectError] = useState('')

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callNomadApi(ctx, '/account')
      setAccountData(res || {})
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          (err && err.message) || 'Не удалось получить сведения о тарифе и балансе.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [ctx])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await callNomadApi(ctx, '/account')
        if (active) {
          setAccountData(res || {})
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(
            sanitizeWhiteLabelText(
              (err && err.message) || 'Сервер NomadNet временно недоступен.'
            )
          )
        }
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [ctx])

  const handleConnectKey = async (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    const trimmed = keyInput.trim()
    setConnectMessage('')
    setConnectError('')

    if (!trimmed) {
      setConnectError('Введите ключ NomadNet (начинается с nmd_).')
      return
    }
    if (!trimmed.startsWith('nmd_')) {
      setConnectError('Ключ должен начинаться с префикса nmd_.')
      return
    }

    setConnecting(true)
    try {
      const res = await callNomadApi(ctx, '/connect', {
        method: 'POST',
        body: { key: trimmed },
      })
      setKeyInput('')
      setConnectMessage('Ключ NomadNet успешно подключён. Сведения о балансе обновлены.')
      if (res && (res.balance || res.plan || res.connected !== undefined)) {
        setAccountData((prev) => ({ ...(prev || {}), ...res, connected: true }))
      } else {
        await loadAccount()
      }
      if (host && typeof host.notify === 'function') {
        host.notify('Ключ NomadNet подключён')
      }
    } catch (err) {
      const msg = sanitizeWhiteLabelText(
        (err && err.message) || 'Не удалось подключить ключ NomadNet. Проверьте ключ и повторите попытку.'
      )
      setConnectError(msg)
      if (host && typeof host.notifyError === 'function') {
        host.notifyError(msg)
      }
    } finally {
      setConnecting(false)
    }
  }

  const balanceObj = (accountData && accountData.balance) || {}
  const nomadsTotal =
    balanceObj.nomads !== undefined
      ? Number(balanceObj.nomads)
      : Number(accountData && accountData.nomads) || 0
  const nomadsReserved =
    balanceObj.reserved !== undefined
      ? Number(balanceObj.reserved)
      : Number(accountData && accountData.reserved) || 0
  const nomadsAvailable = Math.max(0, nomadsTotal - nomadsReserved)
  const updatedAt = balanceObj.updated_at || (accountData && accountData.updated_at) || null

  const planObj = (accountData && accountData.plan) || {}
  const isConnected = Boolean(
    (accountData && accountData.connected) ||
      (accountData && accountData.key_configured) ||
      planObj.id ||
      nomadsTotal > 0
  )
  const planName = sanitizeWhiteLabelText(
    planObj.name || planObj.title || (isConnected ? 'Базовый тариф NomadNet' : 'Бесплатный (автономный)')
  )
  const planStatus = sanitizeWhiteLabelText(
    planObj.status_label || (planObj.active !== false && isConnected ? 'Активен' : 'Не подключён')
  )
  const planExpires = planObj.expires_at || planObj.renews_at || null
  const planMonthlyLimit =
    planObj.monthly_nomads || planObj.limit_nomads || planObj.quota || null
  const maskedKey = sanitizeWhiteLabelText(
    (accountData && (accountData.masked_key || accountData.key_preview)) || ''
  )
  const cabinetUrl =
    (accountData && (accountData.cabinet_url || accountData.billing_url || accountData.topup_url)) ||
    DEFAULT_CABINET_URL

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Верхняя панель состояния тарифа и баланса */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Карточка баланса номадов */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border, rgba(128,128,128,0.22))',
            background: 'var(--card, rgba(128,128,128,0.05))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.72, fontWeight: 500 }}>
                Баланс управляемой сети NomadNet
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, marginTop: '4px', letterSpacing: '-0.02em' }}>
                {loading ? '...' : `${formatNomadsNumber(nomadsAvailable)} номадов`}
              </div>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: isConnected ? 'rgba(34, 197, 94, 0.16)' : 'rgba(148, 163, 184, 0.18)',
                color: isConnected ? '#22c55e' : 'inherit',
              }}
            >
              {isConnected ? 'Номады подключены' : 'Ключ не подключён'}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(128,128,128,0.06)',
              fontSize: '13px',
            }}
          >
            <div>
              <div style={{ opacity: 0.68, fontSize: '11px' }}>Всего на счёте</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>
                {formatNomadsNumber(nomadsTotal)} номадов
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.68, fontSize: '11px' }}>Зарезервировано</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>
                {formatNomadsNumber(nomadsReserved)} номадов
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', opacity: 0.65 }}>
              Обновлено: {updatedAt ? formatDateTimeRu(updatedAt) : 'только что'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={loadAccount}
                disabled={loading}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.28))',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '12px',
                  fontWeight: 500,
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Обновление...' : 'Обновить'}
              </button>
              <button
                type="button"
                onClick={() => openExternalSafe(ctx, cabinetUrl)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Пополнить в личном кабинете
              </button>
            </div>
          </div>
        </div>

        {/* Карточка активного тарифа */}
        <div
          style={{
            padding: '20px',
            borderRadius: '12px',
            border: '1px solid var(--border, rgba(128,128,128,0.22))',
            background: 'var(--card, rgba(128,128,128,0.05))',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '12px', opacity: 0.72, fontWeight: 500 }}>
                Текущий тарифный план
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
                {planName}
              </div>
            </div>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
              }}
            >
              {planStatus}
            </span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(128,128,128,0.06)',
              fontSize: '13px',
            }}
          >
            <div>
              <div style={{ opacity: 0.68, fontSize: '11px' }}>Включённый пакет</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>
                {planMonthlyLimit ? `${formatNomadsNumber(planMonthlyLimit)} номадов / мес.` : 'По факту потребления'}
              </div>
            </div>
            <div>
              <div style={{ opacity: 0.68, fontSize: '11px' }}>Срок действия / продление</div>
              <div style={{ fontWeight: 600, marginTop: '2px' }}>
                {planExpires ? formatDateTimeRu(planExpires) : 'Бессрочно'}
              </div>
            </div>
          </div>

          <div style={{ fontSize: '12px', opacity: 0.78, lineHeight: 1.45 }}>
            Единый ключ NomadNet открывает доступ к моделям OpenAI, Anthropic, Google Gemini, DeepSeek и Qwen без зарубежных карт и прокси.
          </div>
        </div>
      </div>

      {/* Уведомление об ошибке чтения баланса, если есть */}
      {error ? (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '10px',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.1)',
            fontSize: '13px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <span>
            Сведения о балансе сейчас недоступны ({error}). Вы можете подключить или обновить ключ ниже.
          </span>
          <button
            type="button"
            onClick={loadAccount}
            style={{
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              background: 'transparent',
              color: 'inherit',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Повторить
          </button>
        </div>
      ) : null}

      {/* Форма подключения ключа nmd_... */}
      <form
        onSubmit={handleConnectKey}
        style={{
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border, rgba(128,128,128,0.22))',
          background: 'var(--card, rgba(128,128,128,0.05))',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600 }}>
              Подключение ключа NomadNet
            </div>
            <div style={{ fontSize: '13px', opacity: 0.74, marginTop: '2px' }}>
              Введите ваш персональный ключ вида <code>nmd_...</code> из личного кабинета NomadNet для синхронизации баланса и маршрутизации запросов.
            </div>
          </div>
          {maskedKey ? (
            <span
              style={{
                fontSize: '12px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(128,128,128,0.12)',
                fontFamily: 'monospace',
              }}
            >
              Текущий ключ: {maskedKey}
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="nmd_live_..."
            aria-label="Ключ NomadNet"
            style={{
              flex: '1 1 280px',
              padding: '9px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(128,128,128,0.3))',
              background: 'var(--background, rgba(0,0,0,0.12))',
              color: 'inherit',
              fontSize: '13px',
              fontFamily: 'monospace',
            }}
          />
          <button
            type="submit"
            disabled={connecting}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary, #2563eb)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: connecting ? 'default' : 'pointer',
              opacity: connecting ? 0.7 : 1,
            }}
          >
            {connecting ? 'Подключение...' : isConnected ? 'Обновить ключ' : 'Подключить ключ'}
          </button>
        </div>

        {connectError ? (
          <div style={{ fontSize: '13px', color: '#ef4444' }}>{connectError}</div>
        ) : null}
        {connectMessage ? (
          <div style={{ fontSize: '13px', color: '#22c55e' }}>{connectMessage}</div>
        ) : null}
      </form>
    </div>
  )
}

export default function registerBillingTab(ctx) {
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 65,
    data: {
      id: 'nomad.billing.open',
      action: 'nomad.billing.open',
      label: 'Тариф и баланс',
      category: 'Nomad',
      keywords: [
        'тариф',
        'баланс',
        'номады',
        'оплата',
        'пополнить',
        'ключ',
        'nomadnet',
        'billing',
      ],
      run: () => openNomadAccountsTab('billing'),
    },
  })
}
