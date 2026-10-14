/**
 * Обработка глубоких ссылок схемы `nomad://` в десктопном плагине Nomad (M-105, M-106).
 *
 * Отвечает за:
 * 1. Приём `nomad://connect` (и `nomad://connect?handoff_token=…`) из ОС через мост главного
 *    процесса (`window.hermesDesktop.onDeepLink`), журнал холодного старта или маршрутизатор окна.
 * 2. Переход на экран «Аккаунты» (`/nomad-accounts`) при открытии `nomad://connect`.
 * 3. Если в ссылке передан одноразовый `handoff_token` (60 с), отправку запроса на бэкенд плагина
 *    (`POST /api/plugins/nomad/connect` через `ctx.rest('/connect', …)`) для обмена токена в
 *    Control Plane (`POST /cabinet/sso/redeem`) без попадания токена и ключа в консоль и историю.
 */

import { ROUTES_AREA, host } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

export const DEEPLINK_SCHEME = 'nomad'
export const ACCOUNTS_ROUTE_PATH = '/nomad-accounts'
export const CONNECT_ROUTE_PATH = '/nomad-connect'

const HANDOFF_TOKEN_RE = /^[A-Za-z0-9_.:-]{4,512}$/
const ALLOWED_CONNECT_KINDS = new Set(['connect', 'accounts', 'nomad-accounts', 'nomad-connect'])
const ALLOWED_SUB_NAMES = new Set(['', 'connect', 'accounts', 'nomad-accounts', 'nomad-connect'])

function asRealString(value) {
  return typeof value === 'string' ? value : ''
}

function sanitizeParams(rawParams) {
  if (!rawParams || typeof rawParams !== 'object' || typeof rawParams === 'function') {
    return {}
  }
  const clean = {}
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof k === 'string' && typeof v === 'string') {
      clean[k] = v.trim()
    }
  }
  return clean
}

function extractValidToken(params) {
  const candidate = asRealString(params.handoff_token || params.token).trim()
  if (!candidate || !HANDOFF_TOKEN_RE.test(candidate)) {
    return null
  }
  return candidate
}

/**
 * Разобрать строку `nomad://connect?...` или IPC-пакет `{ kind, name, params }` от главного процесса.
 * Ссылки чужих схем (включая апстримную) отклоняются.
 */
export function parseNomadDeepLink(input) {
  if (!input) return null

  if (typeof input === 'string') {
    const raw = input.trim()
    if (!raw) return null

    if (raw.startsWith('#/')) {
      const withoutHash = raw.slice(1)
      const qIndex = withoutHash.indexOf('?')
      const pathname = (qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash).replace(/\/+$/, '')
      if (
        pathname !== '/nomad-connect' &&
        pathname !== '/nomad/connect' &&
        pathname !== '/connect' &&
        pathname !== '/nomad-accounts'
      ) {
        return null
      }
      const query = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : ''
      const search = new URLSearchParams(query)
      const params = {}
      search.forEach((v, k) => {
        params[k] = v.trim()
      })
      const handoffToken = extractValidToken(params)
      if (pathname === '/nomad-accounts' && !handoffToken) {
        return null
      }
      return {
        targetPath: ACCOUNTS_ROUTE_PATH,
        handoffToken,
        cpUrl: asRealString(params.cp_url) || null,
        tenantId: asRealString(params.tenant_id) || null,
        params,
      }
    }

    let parsed
    try {
      parsed = new URL(raw)
    } catch {
      return null
    }
    const scheme = asRealString(parsed.protocol).replace(/:$/, '').toLowerCase()
    if (scheme !== DEEPLINK_SCHEME) {
      return null
    }
    const kind = asRealString(parsed.hostname).toLowerCase()
    const name = decodeURIComponent(asRealString(parsed.pathname).replace(/^\/+|\/+$/g, '')).toLowerCase()
    const params = {}
    parsed.searchParams.forEach((v, k) => {
      params[k] = v.trim()
    })
    return parseNomadDeepLink({ kind, name, params, scheme })
  }

  if (typeof input === 'object' && typeof input !== 'function') {
    if (typeof input.scheme === 'string' && input.scheme.toLowerCase() !== DEEPLINK_SCHEME) {
      return null
    }
    const kind = asRealString(input.kind).trim().toLowerCase()
    const name = asRealString(input.name).trim().replace(/^\/+|\/+$/g, '').toLowerCase()
    const params = sanitizeParams(input.params)

    const isDirectConnect = ALLOWED_CONNECT_KINDS.has(kind) && ALLOWED_SUB_NAMES.has(name)
    const isScopedConnect =
      (kind === 'nomad' || kind === 'open') &&
      (name === 'connect' || name === 'accounts' || name === 'nomad-accounts' || name === 'nomad-connect')

    if (!isDirectConnect && !isScopedConnect) {
      return null
    }

    return {
      targetPath: ACCOUNTS_ROUTE_PATH,
      handoffToken: extractValidToken(params),
      cpUrl: asRealString(params.cp_url) || null,
      tenantId: asRealString(params.tenant_id) || null,
      params,
    }
  }

  return null
}

function navigateToAccounts(navigateFn) {
  let navigated = false
  if (typeof navigateFn === 'function') {
    try {
      navigateFn(ACCOUNTS_ROUTE_PATH)
      navigated = true
    } catch {
      navigated = false
    }
  }
  if (!navigated && host && typeof host.navigate === 'function') {
    try {
      host.navigate(ACCOUNTS_ROUTE_PATH)
      navigated = true
    } catch {
      navigated = false
    }
  }
  if (
    typeof window !== 'undefined' &&
    window.location &&
    typeof window.location.hash === 'string' &&
    window.location.hash !== `#${ACCOUNTS_ROUTE_PATH}`
  ) {
    try {
      window.location.hash = `#${ACCOUNTS_ROUTE_PATH}`
    } catch {
      // Игнорируем в окружении без DOM history/hash.
    }
  }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      if (typeof CustomEvent === 'function') {
        window.dispatchEvent(
          new CustomEvent('nomad:navigate-accounts', {
            detail: { path: ACCOUNTS_ROUTE_PATH },
          }),
        )
      }
    } catch {
      // В тестовой среде без CustomEvent пропускаем уведомление.
    }
  }
}

/**
 * Обработать входную ссылку `nomad://connect`: открыть экран «Аккаунты» и при наличии
 * `handoff_token` обменять его через бэкенд плагина.
 */
export async function handleNomadDeepLink(input, options = {}) {
  const parsed = parseNomadDeepLink(input)
  if (!parsed) {
    return { handled: false, targetPath: null, redeemed: false, result: null }
  }

  const { ctx, navigate } = options
  navigateToAccounts(navigate)

  if (!parsed.handoffToken || !ctx || typeof ctx.rest !== 'function') {
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: false,
      result: null,
    }
  }

  const body = {
    handoff_token: parsed.handoffToken,
    key: `${DEEPLINK_SCHEME}://connect?handoff_token=${encodeURIComponent(parsed.handoffToken)}`,
  }
  if (parsed.cpUrl) {
    body.cp_url = parsed.cpUrl
  }
  if (parsed.tenantId && /^\d+$/.test(parsed.tenantId)) {
    body.tenant_id = Number(parsed.tenantId)
  }

  try {
    const result = await ctx.rest('/connect', {
      method: 'POST',
      body,
    })
    if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent('nomad:handoff-complete', { detail: result }))
      } catch {
        // Игнорируем ошибку диспетчеризации в урезанном окружении.
      }
    }
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: Boolean(result && result.ok),
      result: result || null,
    }
  } catch (err) {
    const safeError = {
      ok: false,
      connected: false,
      code: 'handoff-request-failed',
      message: 'Не удалось завершить автоматическое подключение аккаунта NomadNet.',
      status: err && typeof err.statusCode === 'number' ? err.statusCode : undefined,
    }
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: false,
      result: safeError,
    }
  }
}

function AccountsConnectFallbackView({ ctx }) {
  const [state, setState] = useState({ loading: true, connected: false, model: null, baseUrl: null })

  useEffect(() => {
    let cancelled = false
    if (ctx && typeof ctx.rest === 'function') {
      Promise.resolve(ctx.rest('/connect/status'))
        .then(data => {
          if (cancelled || !data || typeof data !== 'object' || typeof data === 'function') return
          setState({
            loading: false,
            connected: Boolean(data.connected),
            model: asRealString(data.model) || null,
            baseUrl: asRealString(data.base_url) || null,
          })
        })
        .catch(() => {
          if (!cancelled) {
            setState({ loading: false, connected: false, model: null, baseUrl: null })
          }
        })
    } else {
      setState({ loading: false, connected: false, model: null, baseUrl: null })
    }
    return () => {
      cancelled = true
    }
  }, [ctx])

  return jsxs('div', {
    'data-testid': 'nomad-accounts-screen',
    style: { padding: '28px 32px', maxWidth: 680, lineHeight: 1.5 },
    children: [
      jsx('h1', {
        style: { fontSize: 18, fontWeight: 600, margin: '0 0 8px' },
        children: 'Аккаунты',
      }),
      jsx('p', {
        style: { margin: '0 0 16px', opacity: 0.8 },
        children: 'Управление подключением NomadNet и ключами доступа.',
      }),
      jsx('div', {
        'data-testid': 'nomad-connect-status',
        style: {
          padding: '12px 16px',
          borderRadius: 8,
          border: '1px solid rgba(128,128,128,0.25)',
          fontSize: 13,
        },
        children: state.connected
          ? `Подключено к NomadNet${state.model ? ` · модель ${state.model}` : ''}`
          : 'Ожидание подключения ключа из личного кабинета NomadNet',
      }),
    ],
  })
}

export default function register(ctx) {
  // Маршрут /nomad-connect всегда ведёт на экран «Аккаунты», а запасной маршрут /nomad-accounts
  // с низким приоритетом (order: 999) страхует переход, если основной экран «Аккаунты» (M-132)
  // ещё не смонтирован в текущем окружении.
  ctx.register({
    id: 'connect-route',
    area: ROUTES_AREA,
    order: 90,
    title: 'Аккаунты',
    data: { path: CONNECT_ROUTE_PATH },
    render: () => jsx(AccountsConnectFallbackView, { ctx }),
  })

  ctx.register({
    id: 'accounts-fallback-route',
    area: ROUTES_AREA,
    order: 999,
    title: 'Аккаунты',
    data: { path: ACCOUNTS_ROUTE_PATH },
    render: () => jsx(AccountsConnectFallbackView, { ctx }),
  })

  const disposers = []
  let handledColdStartLog = false

  const bridge =
    typeof window !== 'undefined' &&
    window.hermesDesktop &&
    typeof window.hermesDesktop === 'object'
      ? window.hermesDesktop
      : null

  if (bridge && typeof bridge.onDeepLink === 'function') {
    const off = bridge.onDeepLink(payload => {
      if (!payload || typeof payload !== 'object' || typeof payload === 'function') return
      void handleNomadDeepLink(payload, { ctx })
    })
    if (typeof off === 'function') {
      disposers.push(off)
    }
  }

  // Если холодный старт доставил ссылку `nomad://connect` на несколько миллисекунд раньше, чем
  // загрузчик плагинов вычислил plugin.js, проверим журнал главного процесса один раз.
  if (bridge && typeof bridge.getRecentLogs === 'function') {
    Promise.resolve(bridge.getRecentLogs())
      .then(lines => {
        if (handledColdStartLog || !Array.isArray(lines)) return
        for (let i = lines.length - 1; i >= 0; i -= 1) {
          const line = asRealString(lines[i])
          if (
            line.includes('[deeplink] delivered connect/') ||
            line.includes('[deeplink] delivered nomad/connect')
          ) {
            handledColdStartLog = true
            navigateToAccounts()
            break
          }
        }
      })
      .catch(() => {})
  }

  if (typeof window !== 'undefined') {
    const checkCurrentLocation = () => {
      const hash = asRealString(window.location && window.location.hash)
      if (hash) {
        void handleNomadDeepLink(hash, { ctx })
      }
    }
    checkCurrentLocation()

    if (typeof window.addEventListener === 'function' && typeof window.removeEventListener === 'function') {
      const onHashChange = () => checkCurrentLocation()
      const onCustomDeepLink = event => {
        const detail = event && event.detail
        if (detail) {
          void handleNomadDeepLink(detail, { ctx })
        }
      }
      window.addEventListener('hashchange', onHashChange)
      window.addEventListener('nomad:deep-link', onCustomDeepLink)
      disposers.push(() => {
        window.removeEventListener('hashchange', onHashChange)
        window.removeEventListener('nomad:deep-link', onCustomDeepLink)
      })
    }
  }

  if (ctx && typeof ctx.onDispose === 'function') {
    ctx.onDispose(() => {
      while (disposers.length > 0) {
        const dispose = disposers.pop()
        try {
          dispose()
        } catch {
          // Ошибки отписки не должны мешать выгрузке плагина.
        }
      }
    })
  }
}
