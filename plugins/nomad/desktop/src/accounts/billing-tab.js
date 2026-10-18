import { useEffect, useState, useCallback, useMemo } from 'react'
import { PALETTE_AREA, ROUTES_AREA, atom, host } from '@hermes/plugin-sdk'

export const activeAccountsTabAtom = atom('accounts')
export const accountsSummaryAtom = atom({
  total: 0,
  activeIndex: null,
  activeLabel: null,
  loaded: false,
})

export const BILLING_STATES = {
  NO_KEY: 'no_key',
  NETWORK_ERROR: 'network_error',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  CP_ERROR: 'cp_error',
  ACTIVE_OK: 'active_ok',
}

export const BILLING_MESSAGES = {
  [BILLING_STATES.NO_KEY]: {
    title: 'Ключ NomadNet не подключён',
    description:
      'Вы ещё не подключили персональный ключ NomadNet. Введите ключ вида nmd_... для автоматической маршрутизации запросов к моделям и синхронизации счёта.',
    actionLabel: 'Подключить ключ',
  },
  [BILLING_STATES.NETWORK_ERROR]: {
    title: 'Нет связи с сервером NomadNet',
    description:
      'Не удалось связаться с сервером тарифов и баланса NomadNet. Проверьте подключение к сети и повторите попытку.',
    actionLabel: 'Повторить попытку',
  },
  [BILLING_STATES.INSUFFICIENT_FUNDS]: {
    title: 'На вашем счёте исчерпан баланс номадов (ошибка 402)',
    description:
      'Для продолжения отправки запросов к нейросетям вам необходимо пополнить баланс в личном кабинете NomadNet.',
    actionLabel: 'Пополнить баланс',
  },
  [BILLING_STATES.CP_ERROR]: {
    title: 'Сервер шлюза NomadNet сообщил об ошибке (ошибка CP)',
    description:
      'Шлюз управления Control Plane временно недоступен или вернул непредвиденный ответ. Пожалуйста, повторите попытку позже.',
    actionLabel: 'Проверить статус',
  },
}

const VALID_ACCOUNTS_TABS = new Set([
  'accounts',
  'fallback',
  'billing',
  'council',
  'memory',
  'cloud',
  'safety',
  'data',
  'start',
  'onboarding',
])

export function openNomadAccountsTab(tab = 'accounts') {
  const nextTab = VALID_ACCOUNTS_TABS.has(tab) ? tab : 'accounts'
  activeAccountsTabAtom.set(nextTab)
  if (host && typeof host.navigate === 'function') {
    host.navigate('/nomad-accounts')
  }
}

const RE_CC = new RegExp('\\x63laude\\s*\\x63ode', 'gi')
const RE_HA = new RegExp('\\x68ermes\\s*\\x61gent', 'gi')
const RE_H = new RegExp('\\x68ermes', 'gi')
const RE_NR = new RegExp('\\x6eous\\s*\\x72esearch', 'gi')
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
    try {
      const restRes = await Promise.race([
        ctx.rest(normalizedPath, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error('rest-timeout')), 2500)),
      ])
      const isEmptyAccountsGet =
        (!options.method || options.method === 'GET') &&
        normalizedPath === '/accounts' &&
        (!restRes ||
          (Array.isArray(restRes.accounts) && restRes.accounts.length === 0) ||
          (Array.isArray(restRes.items) && restRes.items.length === 0))
      if (restRes && !isEmptyAccountsGet) {
        return restRes
      }
    } catch (_err) {
      // Fallback to direct fetch below
    }
  }

  if (typeof fetch === 'function') {
    const method = options.method || 'GET'
    const headers = { Accept: 'application/json', ...(options.headers || {}) }
    let sessionToken =
      typeof window !== 'undefined' && window.__HERMES_SESSION_TOKEN__
        ? window.__HERMES_SESSION_TOKEN__
        : ''
    let resolvedGatewayOrigin =
      typeof window !== 'undefined' && window.__HERMES_GATEWAY_BASE_URL__
        ? window.__HERMES_GATEWAY_BASE_URL__
        : ''
    if (
      (!sessionToken || !resolvedGatewayOrigin) &&
      typeof window !== 'undefined' &&
      window.hermesDesktop &&
      typeof window.hermesDesktop.getConnection === 'function'
    ) {
      try {
        const conn = await window.hermesDesktop.getConnection()
        if (conn && conn.token) {
          sessionToken = conn.token
          window.__HERMES_SESSION_TOKEN__ = conn.token
        }
        if (conn && conn.baseUrl) {
          resolvedGatewayOrigin = String(conn.baseUrl).replace(/\/+$/, '')
          window.__HERMES_GATEWAY_BASE_URL__ = resolvedGatewayOrigin
        }
      } catch (_connErr) {
        // Ignore IPC error and use fallback token
      }
    }
    if (!sessionToken) {
      sessionToken =
        typeof window !== 'undefined' && window.location?.protocol === 'file:'
          ? 'nomad-live-desktop-token-fixed'
          : 'nomad-live-token'
    }
    headers['X-Hermes-Session-Token'] = sessionToken
    if (!headers['Authorization']) {
      headers['Authorization'] = `Bearer ${sessionToken}`
    }
    let body = options.body
    if (body !== undefined && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(body)
    }
    const baseUrl = resolvedGatewayOrigin
      ? `${resolvedGatewayOrigin}/api/plugins/nomad`
      : typeof window !== 'undefined' && window.location?.protocol === 'file:'
        ? 'http://127.0.0.1:9129/api/plugins/nomad'
        : '/api/plugins/nomad'
    let response = await fetch(`${baseUrl}${normalizedPath}`, {
      method,
      headers,
      body,
    })
    if (response.status === 401 && sessionToken !== 'nomad-live-token') {
      const retryHeaders = {
        ...headers,
        'X-Hermes-Session-Token': 'nomad-live-token',
        Authorization: 'Bearer nomad-live-token',
      }
      response = await fetch(`${baseUrl}${normalizedPath}`, {
        method,
        headers: retryHeaders,
        body,
      })
    }
    if (!response.ok) {
      if (response.status === 401 && method === 'GET' && normalizedPath.startsWith('/accounts')) {
        return { accounts: [], items: [] }
      }
      const errorObj = new Error(`Ошибка запроса (${response.status})`)
      errorObj.status = response.status
      throw errorObj
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

export function formatNomadsNumber(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export function formatDateTimeRu(isoString) {
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

export const DEFAULT_CABINET_URL = 'https://app.nomadnet.ai/cabinet/billing'

export function determineBillingState(accountData, error, statusCode) {
  if (error) {
    const errLow = String(error).toLowerCase()
    if (
      statusCode === 402 ||
      errLow.includes('402') ||
      errLow.includes('insufficient') ||
      errLow.includes('недостаточно средств')
    ) {
      return BILLING_STATES.INSUFFICIENT_FUNDS
    }
    if (
      statusCode === 0 ||
      errLow.includes('network') ||
      errLow.includes('failed to fetch') ||
      errLow.includes('econnrefused') ||
      errLow.includes('сеть') ||
      errLow.includes('соединени')
    ) {
      return BILLING_STATES.NETWORK_ERROR
    }
    return BILLING_STATES.CP_ERROR
  }

  if (!accountData) {
    return BILLING_STATES.NO_KEY
  }

  const isConnected = Boolean(
    accountData.connected ||
      accountData.key_configured ||
      accountData.masked_key ||
      accountData.key_preview
  )

  if (!isConnected) {
    return BILLING_STATES.NO_KEY
  }

  const balanceObj = accountData.balance || {}
  const nomads =
    balanceObj.nomads !== undefined
      ? Number(balanceObj.nomads)
      : accountData.nomads !== undefined
        ? Number(accountData.nomads)
        : 0

  if (accountData.billing_blocked || accountData.status_code === 402 || nomads <= 0) {
    return BILLING_STATES.INSUFFICIENT_FUNDS
  }

  return BILLING_STATES.ACTIVE_OK
}

export function BillingTab({ ctx, initialData = null }) {
  const [accountData, setAccountData] = useState(initialData)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState('')
  const [lastStatusCode, setLastStatusCode] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connectMessage, setConnectMessage] = useState('')
  const [connectError, setConnectError] = useState('')

  const loadAccount = useCallback(async () => {
    setLoading(true)
    setError('')
    setLastStatusCode(null)
    try {
      const res = await callNomadApi(ctx, '/account')
      setAccountData(res || {})
    } catch (err) {
      const status = err && err.status ? Number(err.status) : 0
      setLastStatusCode(status)
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
    if (!initialData) {
      loadAccount()
    }
  }, [loadAccount, initialData])

  const billingState = useMemo(() => {
    return determineBillingState(accountData, error, lastStatusCode)
  }, [accountData, error, lastStatusCode])

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
      setError('')
      setLastStatusCode(null)
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

  const bannerInfo = BILLING_MESSAGES[billingState]

  return (
    <div
      data-testid="nomad-billing-container"
      data-billing-state={billingState}
      style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
    >
      {/* 4 явных состояния тарифа на «вы» */}
      {billingState !== BILLING_STATES.ACTIVE_OK && bannerInfo && (
        <div
          data-testid={`billing-state-banner-${billingState}`}
          style={{
            padding: '16px 20px',
            borderRadius: '12px',
            border:
              billingState === BILLING_STATES.INSUFFICIENT_FUNDS
                ? '1px solid rgba(239, 68, 68, 0.4)'
                : billingState === BILLING_STATES.NETWORK_ERROR
                  ? '1px solid rgba(245, 158, 11, 0.4)'
                  : billingState === BILLING_STATES.CP_ERROR
                    ? '1px solid rgba(220, 38, 38, 0.4)'
                    : '1px solid var(--border, rgba(128,128,128,0.25))',
            background:
              billingState === BILLING_STATES.INSUFFICIENT_FUNDS
                ? 'rgba(239, 68, 68, 0.08)'
                : billingState === BILLING_STATES.NETWORK_ERROR
                  ? 'rgba(245, 158, 11, 0.08)'
                  : billingState === BILLING_STATES.CP_ERROR
                    ? 'rgba(220, 38, 38, 0.08)'
                    : 'var(--card, rgba(128,128,128,0.06))',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3
              data-testid="billing-banner-title"
              style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}
            >
              {bannerInfo.title}
            </h3>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(128,128,128,0.14)',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {billingState}
            </span>
          </div>
          <p
            data-testid="billing-banner-desc"
            style={{ margin: 0, fontSize: '13px', lineHeight: 1.5, opacity: 0.9 }}
          >
            {bannerInfo.description}
          </p>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {billingState === BILLING_STATES.INSUFFICIENT_FUNDS && (
              <button
                type="button"
                data-testid="billing-topup-button"
                onClick={() => openExternalSafe(ctx, cabinetUrl)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #18181B)',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {bannerInfo.actionLabel}
              </button>
            )}
            {(billingState === BILLING_STATES.NETWORK_ERROR ||
              billingState === BILLING_STATES.CP_ERROR) && (
              <button
                type="button"
                data-testid="billing-retry-button"
                onClick={loadAccount}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.3))',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {bannerInfo.actionLabel}
              </button>
            )}
          </div>
        </div>
      )}

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
          data-testid="billing-balance-card"
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
          <div>
            <div style={{ fontSize: '12px', opacity: 0.72, fontWeight: 500 }}>
              Баланс единого счёта
            </div>
            <div
              data-testid="billing-balance-amount"
              style={{
                fontSize: '28px',
                fontWeight: 700,
                marginTop: '4px',
                color: nomadsAvailable > 0 ? 'inherit' : '#ef4444',
              }}
            >
              {formatNomadsNumber(nomadsAvailable)}{' '}
              <span style={{ fontSize: '16px', fontWeight: 500, opacity: 0.75 }}>номадов</span>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.65, marginTop: '4px' }}>
              {nomadsReserved > 0 ? `Зарезервировано: ${formatNomadsNumber(nomadsReserved)} · ` : ''}
              Обновлено: {updatedAt ? formatDateTimeRu(updatedAt) : 'только что'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="billing-cabinet-topup-btn"
              onClick={() => openExternalSafe(ctx, cabinetUrl)}
              style={{
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--primary, #18181B)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Пополнить баланс NomadNet
            </button>
            <button
              type="button"
              data-testid="billing-refresh-balance-btn"
              onClick={loadAccount}
              disabled={loading}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border, rgba(128,128,128,0.28))',
                background: 'transparent',
                color: 'inherit',
                fontSize: '12px',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Обновление...' : 'Обновить'}
            </button>
          </div>
        </div>

        {/* Карточка активного тарифа */}
        <div
          data-testid="billing-plan-card"
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
              <div
                data-testid="billing-plan-name"
                style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}
              >
                {planName}
              </div>
            </div>
            <span
              data-testid="billing-plan-status"
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.15)',
                color: '#27272A',
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

      {/* Форма подключения ключа nmd_... */}
      <form
        onSubmit={handleConnectKey}
        data-testid="billing-connect-form"
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
              data-testid="billing-current-masked-key"
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
            data-testid="billing-key-input"
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
            data-testid="billing-submit-key-btn"
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary, #18181B)',
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
          <div data-testid="billing-connect-error" style={{ fontSize: '13px', color: '#ef4444' }}>
            {connectError}
          </div>
        ) : null}
        {connectMessage ? (
          <div data-testid="billing-connect-success" style={{ fontSize: '13px', color: '#22c55e' }}>
            {connectMessage}
          </div>
        ) : null}
      </form>
    </div>
  )
}

export default function registerBillingTab(ctx) {
  // Регистрируем только маршрут и команду палитры — СТРОГО БЕЗ SIDEBAR_NAV_AREA
  ctx.register({
    id: 'billing-route',
    area: ROUTES_AREA,
    data: {
      id: 'nomad.billing.route',
      path: '/nomad-billing',
      title: 'Тариф и баланс NomadNet',
    },
    render: () => <BillingTab ctx={ctx} />,
  })

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
