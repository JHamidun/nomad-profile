/**
 * Раздел «Аккаунты» (`/nomad-accounts`) и компактный слот `pre-main` для веб-дашборда (M-135).
 *
 * Работает поверх `/api/plugins/nomad/accounts*` (M-131) и `/api/plugins/nomad/account` (M-142).
 * Сборка дашборда (`tools/build_desktop_plugin.py`) не включает JSX-лоадер и внешние импорты,
 * поэтому используется чистый JS и `sdk.React.createElement` из `window.__HERMES_PLUGIN_SDK__`.
 */

const PLUGIN_NAME = 'nomad'
const SLOT_NAME = 'pre-main'

const API_BASE = '/api/plugins/nomad/accounts'
const NOMAD_ACCOUNT_URL = '/api/plugins/nomad/account'
const NOMAD_CONNECT_URL = '/api/plugins/nomad/connect'
const BILLING_RENEW_URL = 'https://nomad.ugs.ru/billing'

const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic' },
  { id: 'openai-codex', label: 'OpenAI Codex' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'gemini', label: 'Google Gemini' },
  { id: 'custom', label: 'Свой провайдер (OpenAI-совместимый)' }
]

const STATUS_LABELS = {
  active: 'Активен',
  ready: 'Готов',
  cooldown: 'Охлаждение (лимит)',
  expired: 'Сессия истекла',
  exhausted: 'Квота исчерпана',
  disabled: 'Отключён',
  error: 'Ошибка входа'
}

const PLAN_LABELS = {
  free: 'Бесплатный',
  trial: 'Пробный',
  starter: 'Стартовый',
  pro: 'Профессиональный',
  team: 'Командный',
  enterprise: 'Корпоративный'
}

const BILLING_STATUS_LABELS = {
  active: 'Активен',
  trialing: 'Пробный период',
  past_due: 'Ожидает оплаты',
  canceled: 'Отменён',
  expired: 'Истёк',
  unlinked: 'Не привязан'
}

export function normalizeAccounts(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.accounts)
      ? payload.accounts
      : []

  return raw
    .map((item, idx) => ({
      id: String(item.id || item.account_id || `acc-${idx + 1}`),
      provider: String(item.provider || 'anthropic'),
      label: String(item.label || item.name || item.id || `Аккаунт #${idx + 1}`),
      kind: String(item.kind || item.auth_type || (item.has_oauth ? 'oauth' : 'api_key')),
      status: String(item.status || (item.cooldown_until ? 'cooldown' : 'ready')),
      priority: typeof item.priority === 'number' ? item.priority : idx + 1,
      active: Boolean(item.active || item.is_active || idx === 0),
      cooldownUntil: item.cooldown_until || item.cooldownUntil || null,
      maskedKey: item.masked_key || item.maskedKey || null
    }))
    .sort((a, b) => a.priority - b.priority)
}

export function formatPoolSummary(accounts) {
  const list = Array.isArray(accounts) ? accounts : []
  const total = list.length

  if (total === 0) {
    return 'Аккаунтов: 0 · активен #—'
  }

  const activeIdx = list.findIndex(
    a => a.active || a.status === 'active' || a.status === 'ready'
  )
  const activeRank = activeIdx >= 0 ? activeIdx + 1 : 1

  return `Аккаунтов: ${total} · активен #${activeRank}`
}

function formatDate(value) {
  if (!value) {
    return '—'
  }
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }
  return date.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

export function createPreMainBanner(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks

  return function PreMainAccountsBanner() {
    const [accounts, setAccounts] = useState([])
    const [loaded, setLoaded] = useState(false)

    useEffect(() => {
      let alive = true
      sdk.fetchJSON(API_BASE).then(
        data => {
          if (alive) {
            setAccounts(normalizeAccounts(data))
            setLoaded(true)
          }
        },
        () => {
          if (alive) {
            setAccounts([])
            setLoaded(true)
          }
        }
      )
      return () => {
        alive = false
      }
    }, [])

    const summaryText = formatPoolSummary(accounts)

    return h(
      'div',
      {
        'data-testid': 'nomad-pre-main-banner',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '8px 14px',
          marginBottom: 12,
          borderRadius: 8,
          border: '1px solid rgba(128,128,128,0.22)',
          background: 'rgba(128,128,128,0.06)',
          fontSize: 13
        }
      },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: 10 } },
        h('span', { style: { fontWeight: 600 } }, summaryText),
        !loaded && h('span', { style: { opacity: 0.65, fontSize: 12 } }, 'обновление…')
      ),
      h(
        'a',
        {
          href: '/nomad-accounts',
          style: {
            fontSize: 12,
            fontWeight: 500,
            textDecoration: 'none',
            color: 'inherit',
            opacity: 0.85
          }
        },
        'Управление пулом →'
      )
    )
  }
}

function createBillingSubTab(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks

  return function BillingSubTab() {
    const [account, setAccount] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [code, setCode] = useState('')
    const [connecting, setConnecting] = useState(false)
    const [notice, setNotice] = useState(null)

    function loadAccount() {
      setLoading(true)
      setError(null)
      sdk.fetchJSON(NOMAD_ACCOUNT_URL).then(
        data => {
          setAccount(data || {})
          setLoading(false)
        },
        err => {
          setError(err && err.message ? err.message : 'Не удалось загрузить сведения о тарифе.')
          setLoading(false)
        }
      )
    }

    useEffect(() => {
      loadAccount()
    }, [])

    function handleConnect(e) {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault()
      }
      const trimmed = code.trim()
      if (!trimmed) {
        setError('Введите код привязки из личного кабинета.')
        return
      }
      setConnecting(true)
      setError(null)
      setNotice(null)
      sdk
        .fetchJSON(NOMAD_CONNECT_URL, {
          method: 'POST',
          body: JSON.stringify({ code: trimmed })
        })
        .then(
          data => {
            setAccount(data && data.account ? data.account : data)
            setCode('')
            setNotice('Аккаунт успешно привязан к вашему профилю.')
            setConnecting(false)
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось привязать аккаунт.')
            setConnecting(false)
          }
        )
    }

    const planKey = account && account.plan ? String(account.plan).toLowerCase() : 'free'
    const statusKey = account && account.status ? String(account.status).toLowerCase() : 'unlinked'
    const planLabel = PLAN_LABELS[planKey] || (account && account.plan_label) || 'Базовый'
    const statusLabel = BILLING_STATUS_LABELS[statusKey] || 'Активен'
    const used = Number((account && (account.used ?? account.requests_used)) || 0)
    const limit = Number((account && (account.limit ?? account.requests_limit)) || 0)
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
    const renewUrl = (account && account.renew_url) || BILLING_RENEW_URL

    return h(
      'div',
      {
        'data-testid': 'nomad-billing-tab',
        style: { display: 'flex', flexDirection: 'column', gap: 16 }
      },
      h(
        'div',
        {
          style: {
            border: '1px solid rgba(128,128,128,0.25)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h(
            'div',
            null,
            h('h3', { style: { margin: 0, fontSize: 16, fontWeight: 600 } }, 'Ваш тариф Nomad'),
            h(
              'p',
              { style: { margin: '4px 0 0', fontSize: 13, opacity: 0.75 } },
              'Сведения о вашей подписке, остатке квоты и привязке рабочего места.'
            )
          ),
          h(
            'a',
            {
              href: renewUrl,
              target: '_blank',
              rel: 'noopener noreferrer',
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                background: '#2563eb',
                color: '#fff',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500
              }
            },
            'Продлить подписку'
          )
        ),
        loading && h('div', { style: { fontSize: 13, opacity: 0.75 } }, 'Загрузка данных о тарифе…'),
        error &&
          h(
            'div',
            {
              role: 'alert',
              style: {
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(220,38,38,0.12)',
                color: '#dc2626',
                fontSize: 13
              }
            },
            error
          ),
        notice &&
          h(
            'div',
            {
              role: 'status',
              style: {
                padding: '8px 12px',
                borderRadius: 6,
                background: 'rgba(22,163,74,0.12)',
                color: '#16a34a',
                fontSize: 13
              }
            },
            notice
          ),
        !loading &&
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12
              }
            },
            h(
              'div',
              { style: { padding: 10, borderRadius: 8, background: 'rgba(128,128,128,0.08)' } },
              h('div', { style: { fontSize: 12, opacity: 0.7 } }, 'Тариф'),
              h('div', { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } }, planLabel)
            ),
            h(
              'div',
              { style: { padding: 10, borderRadius: 8, background: 'rgba(128,128,128,0.08)' } },
              h('div', { style: { fontSize: 12, opacity: 0.7 } }, 'Статус'),
              h('div', { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } }, statusLabel)
            ),
            h(
              'div',
              { style: { padding: 10, borderRadius: 8, background: 'rgba(128,128,128,0.08)' } },
              h('div', { style: { fontSize: 12, opacity: 0.7 } }, 'Период до'),
              h(
                'div',
                { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } },
                formatDate(account && (account.expires_at || account.period_end))
              )
            )
          ),
        !loading &&
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 } },
              h('span', null, 'Использование за период'),
              h(
                'span',
                { style: { fontWeight: 600 } },
                limit > 0 ? `${used} из ${limit} (${percent}%)` : `${used} запросов`
              )
            ),
            h(
              'div',
              {
                style: {
                  height: 8,
                  borderRadius: 999,
                  background: 'rgba(128,128,128,0.2)',
                  overflow: 'hidden'
                }
              },
              h('div', {
                style: {
                  width: `${percent}%`,
                  height: '100%',
                  background: percent > 90 ? '#dc2626' : '#2563eb'
                }
              })
            )
          )
      ),
      h(
        'form',
        {
          onSubmit: handleConnect,
          style: {
            border: '1px solid rgba(128,128,128,0.25)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 10
          }
        },
        h('div', { style: { fontSize: 14, fontWeight: 600 } }, 'Привязка аккаунта Nomad по коду'),
        h(
          'p',
          { style: { margin: 0, fontSize: 13, opacity: 0.75 } },
          'Если вы получили одноразовый код в личном кабинете, укажите его ниже для активации тарифа.'
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h('input', {
            type: 'text',
            value: code,
            onChange: e => setCode(e && e.target ? e.target.value : ''),
            placeholder: 'Код привязки (например, NMD-XXXX-XXXX)',
            'aria-label': 'Код привязки',
            style: {
              flex: '1 1 240px',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.35)',
              fontSize: 13
            }
          }),
          h(
            'button',
            {
              type: 'submit',
              disabled: connecting,
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                cursor: connecting ? 'default' : 'pointer',
                fontSize: 13,
                fontWeight: 500
              }
            },
            connecting ? 'Проверка…' : 'Подключить'
          )
        )
      )
    )
  }
}

export function createAccountsSection(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks
  const BillingSubTab = createBillingSubTab(sdk)

  return function AccountsSection() {
    const [activeSubTab, setActiveSubTab] = useState('pool')
    const [accounts, setAccounts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState(null)

    const [showAddKey, setShowAddKey] = useState(false)
    const [keyProvider, setKeyProvider] = useState('anthropic')
    const [keyLabel, setKeyLabel] = useState('')
    const [apiKeyValue, setApiKeyValue] = useState('')
    const [savingKey, setSavingKey] = useState(false)

    const [oauthFlow, setOauthFlow] = useState(null)
    const [oauthProvider, setOauthProvider] = useState('anthropic')
    const [dragIndex, setDragIndex] = useState(null)

    function loadPool() {
      setLoading(true)
      setError(null)
      sdk.fetchJSON(API_BASE).then(
        data => {
          setAccounts(normalizeAccounts(data))
          setLoading(false)
        },
        err => {
          setError(err && err.message ? err.message : 'Не удалось загрузить пул аккаунтов.')
          setLoading(false)
        }
      )
    }

    useEffect(() => {
      loadPool()
    }, [])

    function handleAddKeySubmit(e) {
      if (e && typeof e.preventDefault === 'function') {
        e.preventDefault()
      }
      const trimmedKey = apiKeyValue.trim()
      if (!trimmedKey) {
        setError('Пожалуйста, укажите API-ключ провайдера.')
        return
      }
      setSavingKey(true)
      setError(null)
      setNotice(null)
      sdk
        .fetchJSON(`${API_BASE}/key`, {
          method: 'POST',
          body: JSON.stringify({
            provider: keyProvider,
            label: keyLabel.trim() || `${keyProvider}-key`,
            api_key: trimmedKey
          })
        })
        .then(
          data => {
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data))
            } else {
              loadPool()
            }
            setApiKeyValue('')
            setKeyLabel('')
            setShowAddKey(false)
            setSavingKey(false)
            setNotice('API-ключ добавлен в пул провайдеров.')
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось сохранить API-ключ.')
            setSavingKey(false)
          }
        )
    }

    function handleStartOAuth(providerId) {
      const targetProvider = providerId || oauthProvider || 'anthropic'
      setError(null)
      setNotice(null)
      setOauthFlow({
        status: 'starting',
        provider: targetProvider,
        userCode: null,
        verificationUri: null,
        sessionId: null
      })
      sdk
        .fetchJSON(`${API_BASE}/oauth/start`, {
          method: 'POST',
          body: JSON.stringify({ provider: targetProvider })
        })
        .then(
          data => {
            setOauthFlow({
              status: 'pending',
              provider: targetProvider,
              userCode: (data && (data.user_code || data.userCode)) || 'XXXX-XXXX',
              verificationUri:
                (data && (data.verification_uri || data.verificationUri || data.url)) || '',
              sessionId: (data && (data.session_id || data.sessionId || data.state)) || 'default'
            })
          },
          err => {
            setOauthFlow(null)
            setError(err && err.message ? err.message : 'Не удалось запустить вход подпиской.')
          }
        )
    }

    function handlePollOAuth() {
      if (!oauthFlow) {
        return
      }
      setError(null)
      const sessionId = encodeURIComponent(oauthFlow.sessionId || 'default')
      sdk
        .fetchJSON(`${API_BASE}/oauth/poll/${sessionId}`, {
          method: 'POST',
          body: JSON.stringify({
            provider: oauthFlow.provider,
            session_id: oauthFlow.sessionId
          })
        })
        .then(
          data => {
            const st = data && data.status ? String(data.status) : 'completed'
            if (st === 'pending' || st === 'authorization_pending') {
              setNotice('Ожидаем подтверждения входа в браузере…')
              return
            }
            setOauthFlow(null)
            setNotice('Вход по подписке успешно подтверждён.')
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data))
            } else {
              loadPool()
            }
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось завершить вход подпиской.')
          }
        )
    }

    function handleResetCooldown(acc) {
      setError(null)
      setNotice(null)
      sdk
        .fetchJSON(`${API_BASE}/reset`, {
          method: 'POST',
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        })
        .then(
          data => {
            setNotice(`Пометка охлаждения снята для «${acc.label}».`)
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data))
            } else {
              setAccounts(prev =>
                prev.map(item =>
                  item.id === acc.id ? { ...item, status: 'ready', cooldownUntil: null } : item
                )
              )
            }
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось снять пометку охлаждения.')
          }
        )
    }

    function handleRefreshLogin(acc) {
      setError(null)
      setNotice(null)
      const url = `${API_BASE}/${encodeURIComponent(acc.provider)}/${encodeURIComponent(acc.id)}/refresh`
      sdk
        .fetchJSON(url, {
          method: 'POST',
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        })
        .then(
          data => {
            setNotice(`Токен входа обновлён для «${acc.label}».`)
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data))
            } else {
              loadPool()
            }
          },
          err => {
            if (err && /expired|reauth|401/i.test(String(err.message))) {
              handleStartOAuth(acc.provider)
              return
            }
            setError(err && err.message ? err.message : 'Не удалось обновить сессию входа.')
          }
        )
    }

    function handleDeleteAccount(acc) {
      setError(null)
      setNotice(null)
      const url = `${API_BASE}/${encodeURIComponent(acc.provider)}/${encodeURIComponent(acc.id)}`
      sdk
        .fetchJSON(url, {
          method: 'DELETE',
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        })
        .then(
          data => {
            setNotice(`Аккаунт «${acc.label}» удалён из пула.`)
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data))
            } else {
              setAccounts(prev => prev.filter(item => item.id !== acc.id))
            }
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось удалить аккаунт.')
          }
        )
    }

    function applyReorder(fromIdx, toIdx) {
      if (fromIdx === null || toIdx === null || fromIdx === toIdx) {
        return
      }
      if (fromIdx < 0 || toIdx < 0 || fromIdx >= accounts.length || toIdx >= accounts.length) {
        return
      }
      const next = accounts.slice()
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      const reindexed = next.map((item, idx) => ({
        ...item,
        priority: idx + 1,
        active: idx === 0
      }))
      setAccounts(reindexed)

      const provider = moved ? moved.provider : 'anthropic'
      const order = reindexed.map(item => item.id)
      sdk
        .fetchJSON(`${API_BASE}/priority`, {
          method: 'POST',
          body: JSON.stringify({ provider, order, accounts: order })
        })
        .then(
          () => {
            setNotice('Порядок приоритетов сохранён.')
          },
          err => {
            setError(err && err.message ? err.message : 'Не удалось сохранить порядок приоритетов.')
          }
        )
    }

    const summaryText = formatPoolSummary(accounts)

    return h(
      'div',
      {
        'data-testid': 'nomad-dashboard-accounts',
        style: { display: 'flex', flexDirection: 'column', gap: 16 }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }
        },
        h(
          'div',
          null,
          h('h2', { style: { margin: 0, fontSize: 18, fontWeight: 600 } }, 'Аккаунты и провайдеры'),
          h(
            'p',
            { style: { margin: '4px 0 0', fontSize: 13, opacity: 0.75 } },
            'Управляйте вашими подключёнными провайдерами, порядком приоритетов и ключами доступа.'
          )
        ),
        h(
          'div',
          {
            'data-testid': 'accounts-summary-badge',
            style: {
              padding: '6px 12px',
              borderRadius: 999,
              background: 'rgba(37,99,235,0.1)',
              fontSize: 13,
              fontWeight: 600
            }
          },
          summaryText
        )
      ),
      h(
        'div',
        {
          role: 'tablist',
          'aria-label': 'Разделы управления аккаунтами',
          style: {
            display: 'flex',
            gap: 8,
            borderBottom: '1px solid rgba(128,128,128,0.2)',
            paddingBottom: 8
          }
        },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': activeSubTab === 'pool',
            onClick: () => setActiveSubTab('pool'),
            style: {
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.25)',
              background: activeSubTab === 'pool' ? '#2563eb' : 'transparent',
              color: activeSubTab === 'pool' ? '#fff' : 'inherit',
              fontWeight: activeSubTab === 'pool' ? 600 : 400,
              cursor: 'pointer',
              fontSize: 13
            }
          },
          'Пул провайдеров'
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': activeSubTab === 'billing',
            onClick: () => setActiveSubTab('billing'),
            style: {
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.25)',
              background: activeSubTab === 'billing' ? '#2563eb' : 'transparent',
              color: activeSubTab === 'billing' ? '#fff' : 'inherit',
              fontWeight: activeSubTab === 'billing' ? 600 : 400,
              cursor: 'pointer',
              fontSize: 13
            }
          },
          'Тариф'
        )
      ),
      error &&
        h(
          'div',
          {
            role: 'alert',
            style: {
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(220,38,38,0.12)',
              color: '#dc2626',
              fontSize: 13
            }
          },
          error
        ),
      notice &&
        h(
          'div',
          {
            role: 'status',
            style: {
              padding: '10px 12px',
              borderRadius: 8,
              background: 'rgba(22,163,74,0.12)',
              color: '#16a34a',
              fontSize: 13
            }
          },
          notice
        ),
      activeSubTab === 'billing'
        ? h(BillingSubTab)
        : h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
              h(
                'select',
                {
                  value: oauthProvider,
                  onChange: e => setOauthProvider(e && e.target ? e.target.value : 'anthropic'),
                  'aria-label': 'Провайдер для входа подпиской',
                  style: {
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: '1px solid rgba(128,128,128,0.35)',
                    fontSize: 13
                  }
                },
                ...PROVIDERS.map(p => h('option', { key: p.id, value: p.id }, p.label))
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => handleStartOAuth(oauthProvider),
                  style: {
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }
                },
                'Войти подпиской'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setShowAddKey(!showAddKey),
                  style: {
                    padding: '7px 14px',
                    borderRadius: 6,
                    border: '1px solid rgba(128,128,128,0.35)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500
                  }
                },
                'Добавить ключ'
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: loadPool,
                  style: {
                    padding: '7px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(128,128,128,0.25)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 13
                  }
                },
                'Обновить список'
              )
            ),
            oauthFlow &&
              h(
                'div',
                {
                  'data-testid': 'oauth-device-flow-box',
                  style: {
                    border: '1px solid rgba(37,99,235,0.4)',
                    borderRadius: 10,
                    padding: 14,
                    background: 'rgba(37,99,235,0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8
                  }
                },
                h(
                  'div',
                  { style: { fontWeight: 600, fontSize: 14 } },
                  `Вход по подписке (${oauthFlow.provider})`
                ),
                oauthFlow.status === 'starting'
                  ? h('div', { style: { fontSize: 13 } }, 'Запрашиваем одноразовый код устройства…')
                  : h(
                      'div',
                      { style: { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 } },
                      h(
                        'div',
                        null,
                        'Откройте страницу авторизации и введите код устройства: ',
                        h(
                          'code',
                          {
                            style: {
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: 'rgba(128,128,128,0.18)',
                              fontWeight: 700
                            }
                          },
                          oauthFlow.userCode
                        )
                      ),
                      oauthFlow.verificationUri &&
                        h(
                          'a',
                          {
                            href: oauthFlow.verificationUri,
                            target: '_blank',
                            rel: 'noopener noreferrer',
                            style: { color: '#2563eb', fontWeight: 500 }
                          },
                          'Открыть страницу подтверждения →'
                        ),
                      h(
                        'div',
                        { style: { display: 'flex', gap: 8 } },
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: handlePollOAuth,
                            style: {
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: 'none',
                              background: '#16a34a',
                              color: '#fff',
                              cursor: 'pointer',
                              fontSize: 12,
                              fontWeight: 500
                            }
                          },
                          'Проверить вход'
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            onClick: () => setOauthFlow(null),
                            style: {
                              padding: '6px 12px',
                              borderRadius: 6,
                              border: '1px solid rgba(128,128,128,0.3)',
                              background: 'transparent',
                              color: 'inherit',
                              cursor: 'pointer',
                              fontSize: 12
                            }
                          },
                          'Отмена'
                        )
                      )
                    )
              ),
            showAddKey &&
              h(
                'form',
                {
                  onSubmit: handleAddKeySubmit,
                  'data-testid': 'add-key-form',
                  style: {
                    border: '1px solid rgba(128,128,128,0.25)',
                    borderRadius: 10,
                    padding: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10
                  }
                },
                h(
                  'div',
                  { style: { fontWeight: 600, fontSize: 14 } },
                  'Добавление API-ключа провайдера'
                ),
                h(
                  'div',
                  { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                  h(
                    'select',
                    {
                      value: keyProvider,
                      onChange: e => setKeyProvider(e && e.target ? e.target.value : 'anthropic'),
                      'aria-label': 'Провайдер ключа',
                      style: {
                        padding: '7px 10px',
                        borderRadius: 6,
                        border: '1px solid rgba(128,128,128,0.35)',
                        fontSize: 13
                      }
                    },
                    ...PROVIDERS.map(p => h('option', { key: p.id, value: p.id }, p.label))
                  ),
                  h('input', {
                    type: 'text',
                    value: keyLabel,
                    onChange: e => setKeyLabel(e && e.target ? e.target.value : ''),
                    placeholder: 'Метка (например, Рабочий ключ)',
                    'aria-label': 'Метка аккаунта',
                    style: {
                      flex: '1 1 180px',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(128,128,128,0.35)',
                      fontSize: 13
                    }
                  }),
                  h('input', {
                    type: 'password',
                    value: apiKeyValue,
                    onChange: e => setApiKeyValue(e && e.target ? e.target.value : ''),
                    placeholder: 'sk-...',
                    'aria-label': 'API-ключ',
                    style: {
                      flex: '2 1 240px',
                      padding: '7px 10px',
                      borderRadius: 6,
                      border: '1px solid rgba(128,128,128,0.35)',
                      fontSize: 13
                    }
                  }),
                  h(
                    'button',
                    {
                      type: 'submit',
                      disabled: savingKey,
                      style: {
                        padding: '7px 14px',
                        borderRadius: 6,
                        border: 'none',
                        background: '#2563eb',
                        color: '#fff',
                        cursor: savingKey ? 'default' : 'pointer',
                        fontSize: 13,
                        fontWeight: 500
                      }
                    },
                    savingKey ? 'Сохранение…' : 'Сохранить ключ'
                  )
                )
              ),
            loading
              ? h('div', { style: { fontSize: 13, opacity: 0.75 } }, 'Загрузка пула аккаунтов…')
              : accounts.length === 0
                ? h(
                    'div',
                    {
                      style: {
                        padding: 20,
                        borderRadius: 10,
                        border: '1px dashed rgba(128,128,128,0.35)',
                        textAlign: 'center',
                        fontSize: 13,
                        opacity: 0.8
                      }
                    },
                    'В вашем пуле пока нет подключённых аккаунтов. Нажмите «Войти подпиской» или «Добавить ключ», чтобы подключить первый провайдер.'
                  )
                : h(
                    'table',
                    {
                      role: 'table',
                      style: {
                        width: '100%',
                        borderCollapse: 'collapse',
                        fontSize: 13
                      }
                    },
                    h(
                      'thead',
                      null,
                      h(
                        'tr',
                        {
                          style: {
                            textAlign: 'left',
                            borderBottom: '1px solid rgba(128,128,128,0.25)'
                          }
                        },
                        h('th', { style: { padding: '8px 6px' } }, '#'),
                        h('th', { style: { padding: '8px 6px' } }, 'Провайдер'),
                        h('th', { style: { padding: '8px 6px' } }, 'Метка'),
                        h('th', { style: { padding: '8px 6px' } }, 'Тип входа'),
                        h('th', { style: { padding: '8px 6px' } }, 'Статус'),
                        h('th', { style: { padding: '8px 6px' } }, 'Действия')
                      )
                    ),
                    h(
                      'tbody',
                      null,
                      ...accounts.map((acc, idx) =>
                        h(
                          'tr',
                          {
                            key: `${acc.provider}:${acc.id}`,
                            draggable: true,
                            onDragStart: () => setDragIndex(idx),
                            onDragOver: e => {
                              if (e && typeof e.preventDefault === 'function') {
                                e.preventDefault()
                              }
                            },
                            onDrop: () => {
                              applyReorder(dragIndex, idx)
                              setDragIndex(null)
                            },
                            style: {
                              borderBottom: '1px solid rgba(128,128,128,0.15)',
                              background:
                                idx === 0 ? 'rgba(37,99,235,0.04)' : 'transparent'
                            }
                          },
                          h(
                            'td',
                            { style: { padding: '8px 6px', fontWeight: 600 } },
                            `#${idx + 1}`
                          ),
                          h('td', { style: { padding: '8px 6px' } }, acc.provider),
                          h('td', { style: { padding: '8px 6px' } }, acc.label),
                          h(
                            'td',
                            { style: { padding: '8px 6px' } },
                            acc.kind === 'oauth' ? 'Подписка (OAuth)' : 'API-ключ'
                          ),
                          h(
                            'td',
                            { style: { padding: '8px 6px' } },
                            STATUS_LABELS[acc.status] || acc.status
                          ),
                          h(
                            'td',
                            {
                              style: {
                                padding: '8px 6px',
                                display: 'flex',
                                gap: 6,
                                flexWrap: 'wrap'
                              }
                            },
                            h(
                              'button',
                              {
                                type: 'button',
                                disabled: idx === 0,
                                onClick: () => applyReorder(idx, idx - 1),
                                title: 'Повысить приоритет',
                                style: {
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(128,128,128,0.3)',
                                  background: 'transparent',
                                  color: 'inherit',
                                  cursor: idx === 0 ? 'default' : 'pointer',
                                  fontSize: 12
                                }
                              },
                              '↑'
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                disabled: idx === accounts.length - 1,
                                onClick: () => applyReorder(idx, idx + 1),
                                title: 'Понизить приоритет',
                                style: {
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(128,128,128,0.3)',
                                  background: 'transparent',
                                  color: 'inherit',
                                  cursor: idx === accounts.length - 1 ? 'default' : 'pointer',
                                  fontSize: 12
                                }
                              },
                              '↓'
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                onClick: () => handleResetCooldown(acc),
                                style: {
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(128,128,128,0.3)',
                                  background: 'transparent',
                                  color: 'inherit',
                                  cursor: 'pointer',
                                  fontSize: 12
                                }
                              },
                              'Снять пометку'
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                onClick: () => handleRefreshLogin(acc),
                                style: {
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(128,128,128,0.3)',
                                  background: 'transparent',
                                  color: 'inherit',
                                  cursor: 'pointer',
                                  fontSize: 12
                                }
                              },
                              'Обновить вход'
                            ),
                            h(
                              'button',
                              {
                                type: 'button',
                                onClick: () => handleDeleteAccount(acc),
                                style: {
                                  padding: '4px 8px',
                                  borderRadius: 4,
                                  border: '1px solid rgba(220,38,38,0.4)',
                                  background: 'transparent',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  fontSize: 12
                                }
                              },
                              'Удалить'
                            )
                          )
                        )
                      )
                    )
                  )
          )
    )
  }
}

export default function register({ sdk, plugins, addSection }) {
  if (!sdk || !sdk.React || !sdk.hooks) {
    return
  }

  const AccountsSection = createAccountsSection(sdk)
  const PreMainBanner = createPreMainBanner(sdk)

  if (typeof addSection === 'function') {
    addSection({
      id: 'accounts',
      title: 'Аккаунты',
      order: 10,
      component: AccountsSection
    })
  }

  if (plugins && typeof plugins.registerSlot === 'function') {
    plugins.registerSlot(PLUGIN_NAME, SLOT_NAME, PreMainBanner)
  }
}
