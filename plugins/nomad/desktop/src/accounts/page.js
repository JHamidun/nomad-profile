import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  STATUSBAR_AREAS,
  PALETTE_AREA,
  KEYBINDS_AREA,
  atom,
  useValue,
  host,
} from '@hermes/plugin-sdk'
import {
  BillingTab,
  activeAccountsTabAtom,
  accountsSummaryAtom,
  openNomadAccountsTab,
  callNomadApi,
  openExternalSafe,
  sanitizeWhiteLabelText,
} from './billing-tab.js'

export const accountsModalAtom = atom(null)

const PROVIDERS = [
  {
    id: 'openai-codex',
    label: 'OpenAI (ChatGPT Plus / Pro)',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'sk-proj-...',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Подписка / Ключ)',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'sk-ant-...',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'AIzaSy...',
  },
  {
    id: 'nomad',
    label: 'NomadNet (Единый счёт)',
    supportsOAuth: false,
    supportsKey: true,
    placeholder: 'nmd_live_...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    supportsOAuth: false,
    supportsKey: true,
    placeholder: 'sk-or-v1-...',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    supportsOAuth: false,
    supportsKey: true,
    placeholder: 'sk-...',
  },
  {
    id: 'qwen',
    label: 'Qwen (Alibaba Cloud)',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'sk-...',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'eyJ...',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    supportsOAuth: true,
    supportsKey: true,
    placeholder: 'sk-...',
  },
]

function formatProviderLabel(providerId, rawLabel) {
  if (rawLabel) {
    return sanitizeWhiteLabelText(rawLabel)
  }
  const found = PROVIDERS.find((p) => p.id === providerId)
  if (found) return found.label
  return sanitizeWhiteLabelText(providerId || 'Универсальный провайдер')
}

function normalizeAccountsList(payload) {
  const rawList = Array.isArray(payload)
    ? payload
    : Array.isArray(payload && payload.accounts)
      ? payload.accounts
      : Array.isArray(payload && payload.items)
        ? payload.items
        : []

  const mapped = rawList.map((item, idx) => {
    const id = String(item.id || item.account_id || `${item.provider || 'acc'}-${idx + 1}`)
    const priority =
      typeof item.priority === 'number' && Number.isFinite(item.priority)
        ? item.priority
        : idx + 1
    const statusRaw = String(item.status || (item.cooldown_until ? 'cooldown' : 'ready')).toLowerCase()
    const isActive = Boolean(
      item.active || item.is_active || statusRaw === 'active' || (idx === 0 && statusRaw === 'ready')
    )
    return {
      id,
      label: sanitizeWhiteLabelText(item.label || item.name || `Аккаунт #${idx + 1}`),
      provider: String(item.provider || 'openai-codex'),
      providerLabel: formatProviderLabel(item.provider, item.provider_label),
      authType:
        item.auth_type === 'oauth' || item.kind === 'oauth' || item.type === 'subscription'
          ? 'oauth'
          : 'api_key',
      maskedKey: sanitizeWhiteLabelText(
        item.masked_key || item.key_preview || item.email || 'Подключено'
      ),
      priority,
      status: statusRaw,
      isActive,
      cooldownUntil: item.cooldown_until || null,
      cooldownSeconds: Number(item.cooldown_remaining_sec || item.cooldown_seconds || 0),
      lastError: sanitizeWhiteLabelText(item.last_error || item.error_reason || ''),
      requestsCount: Number(item.requests_count || item.usage_requests || 0),
    }
  })

  mapped.sort((a, b) => a.priority - b.priority)
  return mapped
}

function computeSummary(accounts) {
  const total = accounts.length
  if (total === 0) {
    return { total: 0, activeIndex: null, activeLabel: null, loaded: true }
  }
  const explicitIdx = accounts.findIndex((a) => a.isActive && a.status !== 'cooldown' && a.status !== 'error')
  const fallbackIdx = accounts.findIndex((a) => a.status !== 'cooldown' && a.status !== 'error')
  const chosenIdx = explicitIdx >= 0 ? explicitIdx : fallbackIdx >= 0 ? fallbackIdx : 0
  return {
    total,
    activeIndex: chosenIdx + 1,
    activeLabel: accounts[chosenIdx] ? accounts[chosenIdx].label : null,
    loaded: true,
  }
}

export function formatAccountsStatusbarLabel(summary) {
  const total = summary && typeof summary.total === 'number' ? summary.total : 0
  const activeIdx = summary && summary.activeIndex ? summary.activeIndex : 1
  if (total <= 0) {
    return 'Аккаунты: 0 · активен #—'
  }
  return `Аккаунты: ${total} · активен #${activeIdx}`
}

function getStatusBadge(account) {
  const st = account.status
  if (st === 'cooldown' || account.cooldownSeconds > 0) {
    const mins = account.cooldownSeconds > 0 ? Math.ceil(account.cooldownSeconds / 60) : null
    return {
      text: mins ? `Пауза (${mins} мин)` : 'Временная пауза',
      bg: 'rgba(245, 158, 11, 0.16)',
      color: '#f59e0b',
    }
  }
  if (st === 'expired' || st === 'reauth' || st === 'unauthorized') {
    return {
      text: 'Нужен повторный вход',
      bg: 'rgba(239, 68, 68, 0.16)',
      color: '#ef4444',
    }
  }
  if (st === 'error' || st === 'invalid') {
    return {
      text: 'Ошибка доступа',
      bg: 'rgba(239, 68, 68, 0.16)',
      color: '#ef4444',
    }
  }
  if (account.isActive) {
    return {
      text: 'Активен',
      bg: 'rgba(34, 197, 94, 0.16)',
      color: '#22c55e',
    }
  }
  return {
    text: 'В резерве',
    bg: 'rgba(148, 163, 184, 0.16)',
    color: 'inherit',
  }
}

export function AccountsStatusbarPill({ ctx }) {
  const summary = useValue(accountsSummaryAtom)

  useEffect(() => {
    let mounted = true
    if (!summary.loaded) {
      callNomadApi(ctx, '/accounts')
        .then((res) => {
          if (!mounted) return
          const list = normalizeAccountsList(res)
          accountsSummaryAtom.set(computeSummary(list))
        })
        .catch(() => {
          if (!mounted) return
          accountsSummaryAtom.set({ total: 0, activeIndex: null, activeLabel: null, loaded: true })
        })
    }
    return () => {
      mounted = false
    }
  }, [ctx, summary.loaded])

  const labelText = formatAccountsStatusbarLabel(summary)

  return (
    <button
      type="button"
      onClick={() => openNomadAccountsTab('accounts')}
      title="Открыть пул аккаунтов и тариф Nomad (Ctrl+Alt+A)"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '2px 8px',
        borderRadius: '6px',
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '999px',
          background: summary.total > 0 ? '#22c55e' : 'rgba(148, 163, 184, 0.7)',
        }}
      />
      <span>{labelText}</span>
    </button>
  )
}

export function AccountsPage({ ctx }) {
  const activeTab = useValue(activeAccountsTabAtom)
  const modalMode = useValue(accountsModalAtom)

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [providerFilter, setProviderFilter] = useState('all')
  const [draggedId, setDraggedId] = useState(null)
  const [busyAccountId, setBusyAccountId] = useState(null)

  // Поля формы «Добавить ключ»
  const [keyProvider, setKeyProvider] = useState('openai-codex')
  const [keyLabel, setKeyLabel] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [keyPriority, setKeyPriority] = useState(1)
  const [keyBaseUrl, setKeyBaseUrl] = useState('')
  const [keySubmitting, setKeySubmitting] = useState(false)
  const [keyFormError, setKeyFormError] = useState('')

  // Поля модалки «Войти подпиской» (device-code OAuth)
  const [oauthProvider, setOauthProvider] = useState('openai-codex')
  const [oauthLabel, setOauthLabel] = useState('')
  const [oauthSession, setOauthSession] = useState(null)
  const [oauthLoading, setOauthLoading] = useState(false)
  const [oauthError, setOauthError] = useState('')

  const syncAccounts = useCallback((list) => {
    setAccounts(list)
    accountsSummaryAtom.set(computeSummary(list))
  }, [])

  const loadAccounts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await callNomadApi(ctx, '/accounts')
      const list = normalizeAccountsList(res)
      syncAccounts(list)
      setKeyPriority(list.length + 1)
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          (err && err.message) || 'Не удалось загрузить пул аккаунтов.'
        )
      )
    } finally {
      setLoading(false)
    }
  }, [ctx, syncAccounts])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await callNomadApi(ctx, '/accounts')
        if (active) {
          const list = normalizeAccountsList(res)
          syncAccounts(list)
          setKeyPriority(list.length + 1)
          setError('')
        }
      } catch (err) {
        if (active) {
          setError(
            sanitizeWhiteLabelText(
              (err && err.message) || 'Служба управления аккаунтами сейчас недоступна.'
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
  }, [ctx, syncAccounts])

  const handleResetCooldown = async (account) => {
    setBusyAccountId(account ? account.id : 'all')
    setActionNotice('')
    setError('')
    try {
      const targetPath = account
        ? `/accounts/${encodeURIComponent(account.id)}/reset`
        : '/accounts/reset'
      await callNomadApi(ctx, targetPath, {
        method: 'POST',
        body: account ? { id: account.id } : { all: true },
      })
      const updated = accounts.map((item) =>
        !account || item.id === account.id
          ? { ...item, status: 'ready', cooldownSeconds: 0, cooldownUntil: null, lastError: '' }
          : item
      )
      syncAccounts(updated)
      setActionNotice(
        account
          ? `Пометка исчерпания снята для аккаунта «${account.label}».`
          : 'Пометки исчерпания сняты для всех аккаунтов.'
      )
    } catch (err) {
      await loadAccounts()
    } finally {
      setBusyAccountId(null)
    }
  }

  const handleRefreshLogin = async (account) => {
    setBusyAccountId(account.id)
    setActionNotice('')
    setError('')
    try {
      const res = await callNomadApi(
        ctx,
        `/accounts/${encodeURIComponent(account.id)}/refresh`,
        {
          method: 'POST',
          body: { id: account.id, provider: account.provider },
        }
      )
      if (res && (res.verification_uri || res.user_code || res.auth_url)) {
        setOauthProvider(account.provider)
        setOauthLabel(account.label)
        setOauthSession({
          sessionId: res.session_id || account.id,
          userCode: res.user_code || '',
          verificationUri: res.verification_uri || res.auth_url || '',
          commandHint: sanitizeWhiteLabelText(res.command || `nomad auth add ${account.provider}`),
        })
        accountsModalAtom.set('oauth')
      } else {
        setActionNotice(`Вход для аккаунта «${account.label}» успешно обновлён.`)
        await loadAccounts()
      }
    } catch (err) {
      // Открываем модалку повторного входа по подписке для выбранного провайдера
      setOauthProvider(account.provider)
      setOauthLabel(account.label)
      setOauthSession(null)
      accountsModalAtom.set('oauth')
    } finally {
      setBusyAccountId(null)
    }
  }

  const handleDeleteAccount = async (account) => {
    setBusyAccountId(account.id)
    setActionNotice('')
    setError('')
    try {
      await callNomadApi(ctx, `/accounts/${encodeURIComponent(account.id)}`, {
        method: 'DELETE',
        body: { id: account.id },
      })
      const remaining = accounts
        .filter((item) => item.id !== account.id)
        .map((item, idx) => ({ ...item, priority: idx + 1, isActive: idx === 0 }))
      syncAccounts(remaining)
      setActionNotice(`Аккаунт «${account.label}» удалён из пула.`)
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          (err && err.message) || `Не удалось удалить аккаунт «${account.label}».`
        )
      )
    } finally {
      setBusyAccountId(null)
    }
  }

  const applyNewPriorityOrder = async (reorderedList, movedAccount, newPriorityIndex) => {
    const normalized = reorderedList.map((item, idx) => ({
      ...item,
      priority: idx + 1,
      isActive: idx === 0,
    }))
    syncAccounts(normalized)
    try {
      await callNomadApi(ctx, '/accounts/priority', {
        method: 'POST',
        body: {
          id: movedAccount.id,
          priority: newPriorityIndex + 1,
          order: normalized.map((item) => item.id),
        },
      })
      setActionNotice(`Приоритет аккаунта «${movedAccount.label}» обновлён (#${newPriorityIndex + 1}).`)
    } catch (err) {
      // Сохраняем локальный порядок в интерфейсе, если сервер в режиме оффлайн
    }
  }

  const handleMovePriority = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= accounts.length) return
    const copy = [...accounts]
    const [moved] = copy.splice(index, 1)
    copy.splice(targetIndex, 0, moved)
    await applyNewPriorityOrder(copy, moved, targetIndex)
  }

  const handleDragStart = (accountId) => {
    setDraggedId(accountId)
  }

  const handleDragOver = (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
  }

  const handleDrop = async (targetAccountId) => {
    if (!draggedId || draggedId === targetAccountId) {
      setDraggedId(null)
      return
    }
    const sourceIndex = accounts.findIndex((item) => item.id === draggedId)
    const targetIndex = accounts.findIndex((item) => item.id === targetAccountId)
    setDraggedId(null)
    if (sourceIndex < 0 || targetIndex < 0) return

    const copy = [...accounts]
    const [moved] = copy.splice(sourceIndex, 1)
    copy.splice(targetIndex, 0, moved)
    await applyNewPriorityOrder(copy, moved, targetIndex)
  }

  const handleAddKeySubmit = async (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    setKeyFormError('')
    const trimmedKey = keyValue.trim()
    if (!trimmedKey) {
      setKeyFormError('Введите секретный ключ провайдера.')
      return
    }
    const providerMeta = PROVIDERS.find((p) => p.id === keyProvider)
    const resolvedLabel =
      keyLabel.trim() || `${providerMeta ? providerMeta.label : keyProvider} #${accounts.length + 1}`

    setKeySubmitting(true)
    try {
      await callNomadApi(ctx, '/accounts/key', {
        method: 'POST',
        body: {
          provider: keyProvider,
          label: resolvedLabel,
          api_key: trimmedKey,
          key: trimmedKey,
          priority: Number(keyPriority) || accounts.length + 1,
          base_url: keyBaseUrl.trim() || undefined,
        },
      })
      setKeyValue('')
      setKeyLabel('')
      setKeyBaseUrl('')
      accountsModalAtom.set(null)
      setActionNotice(`Ключ «${resolvedLabel}» добавлен в пул аккаунтов.`)
      await loadAccounts()
    } catch (err) {
      setKeyFormError(
        sanitizeWhiteLabelText(
          (err && err.message) || 'Не удалось сохранить ключ. Проверьте корректность данных.'
        )
      )
    } finally {
      setKeySubmitting(false)
    }
  }

  const handleStartOAuth = async (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    setOauthLoading(true)
    setOauthError('')
    try {
      const res = await callNomadApi(ctx, '/accounts/oauth/start', {
        method: 'POST',
        body: {
          provider: oauthProvider,
          label: oauthLabel.trim() || undefined,
        },
      })
      setOauthSession({
        sessionId: (res && res.session_id) || 'oauth-session',
        userCode: (res && res.user_code) || '',
        verificationUri: (res && (res.verification_uri || res.auth_url)) || '',
        commandHint: sanitizeWhiteLabelText(
          (res && res.command) || `nomad auth add ${oauthProvider}`
        ),
      })
    } catch (err) {
      setOauthSession({
        sessionId: 'cli-fallback',
        userCode: '',
        verificationUri: '',
        commandHint: `nomad auth add ${oauthProvider}`,
      })
    } finally {
      setOauthLoading(false)
    }
  }

  const handlePollOAuth = async () => {
    setOauthLoading(true)
    setOauthError('')
    try {
      if (oauthSession && oauthSession.sessionId && oauthSession.sessionId !== 'cli-fallback') {
        await callNomadApi(ctx, '/accounts/oauth/poll', {
          method: 'POST',
          body: {
            session_id: oauthSession.sessionId,
            provider: oauthProvider,
          },
        })
      }
      accountsModalAtom.set(null)
      setOauthSession(null)
      setActionNotice('Подписка синхронизирована с пулом аккаунтов.')
      await loadAccounts()
    } catch (err) {
      setOauthError(
        sanitizeWhiteLabelText(
          (err && err.message) || 'Авторизация ещё не завершена. Подтвердите вход в браузере и повторите.'
        )
      )
    } finally {
      setOauthLoading(false)
    }
  }

  const summary = useMemo(() => computeSummary(accounts), [accounts])
  const filteredAccounts = useMemo(() => {
    if (providerFilter === 'all') return accounts
    return accounts.filter((item) => item.provider === providerFilter)
  }, [accounts, providerFilter])

  const uniqueProviders = useMemo(() => {
    const set = new Set(accounts.map((a) => a.provider))
    return Array.from(set)
  }, [accounts])

  return (
    <div
      style={{
        padding: '24px 28px',
        maxWidth: '1160px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Шапка экрана «Аккаунты» */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Аккаунты</h1>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 600,
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(59, 130, 246, 0.14)',
                color: '#3b82f6',
              }}
            >
              {formatAccountsStatusbarLabel(summary)}
            </span>
          </div>
          <p style={{ fontSize: '13px', opacity: 0.74, margin: '6px 0 0 0', maxWidth: '680px' }}>
            Управляйте вашими подписками и API-ключами. При исчерпании квоты или временном ограничении Nomad автоматически переключается на следующий по приоритету аккаунт без обрыва диалога.
          </p>
        </div>

        {/* Переключатель вкладок: «Пул аккаунтов» / «Тариф» */}
        <div
          role="tablist"
          aria-label="Разделы экрана аккаунтов"
          style={{
            display: 'inline-flex',
            padding: '4px',
            borderRadius: '10px',
            background: 'rgba(128,128,128,0.12)',
            gap: '4px',
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab !== 'billing'}
            onClick={() => activeAccountsTabAtom.set('accounts')}
            style={{
              padding: '7px 14px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab !== 'billing' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab !== 'billing' ? '#ffffff' : 'inherit',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Пул аккаунтов ({accounts.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'billing'}
            onClick={() => activeAccountsTabAtom.set('billing')}
            style={{
              padding: '7px 14px',
              borderRadius: '7px',
              border: 'none',
              background: activeTab === 'billing' ? 'var(--primary, #2563eb)' : 'transparent',
              color: activeTab === 'billing' ? '#ffffff' : 'inherit',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Тариф
          </button>
        </div>
      </div>

      {/* Вкладка «Тариф» (M-102) */}
      {activeTab === 'billing' ? (
        <BillingTab ctx={ctx} />
      ) : (
        /* Вкладка «Пул аккаунтов» (M-132) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Панель действий */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border, rgba(128,128,128,0.22))',
              background: 'var(--card, rgba(128,128,128,0.05))',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  setOauthSession(null)
                  setOauthError('')
                  accountsModalAtom.set(modalMode === 'oauth' ? null : 'oauth')
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Войти подпиской
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeyFormError('')
                  accountsModalAtom.set(modalMode === 'key' ? null : 'key')
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.3))',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Добавить ключ
              </button>
              <button
                type="button"
                onClick={() => handleResetCooldown(null)}
                disabled={busyAccountId === 'all' || accounts.length === 0}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.28))',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '13px',
                  cursor: accounts.length === 0 ? 'default' : 'pointer',
                  opacity: accounts.length === 0 ? 0.55 : 1,
                }}
              >
                Снять пометку
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <select
                value={providerFilter}
                onChange={(e) => setProviderFilter(e.target.value)}
                aria-label="Фильтр по провайдеру"
                style={{
                  padding: '7px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.28))',
                  background: 'var(--background, rgba(0,0,0,0.1))',
                  color: 'inherit',
                  fontSize: '12px',
                }}
              >
                <option value="all">Все провайдеры ({accounts.length})</option>
                {uniqueProviders.map((prov) => (
                  <option key={prov} value={prov}>
                    {formatProviderLabel(prov)}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={loadAccounts}
                disabled={loading}
                style={{
                  padding: '7px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(128,128,128,0.28))',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '12px',
                  cursor: loading ? 'default' : 'pointer',
                }}
              >
                {loading ? 'Загрузка...' : 'Обновить'}
              </button>
            </div>
          </div>

          {/* Уведомления о действиях и ошибках */}
          {actionNotice ? (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#22c55e',
                fontSize: '13px',
              }}
            >
              {actionNotice}
            </div>
          ) : null}

          {error ? (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: '13px',
              }}
            >
              {error}
            </div>
          ) : null}

          {/* Панель «Войти подпиской» (device-code OAuth) */}
          {modalMode === 'oauth' ? (
            <div
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid rgba(59, 130, 246, 0.38)',
                background: 'var(--card, rgba(59, 130, 246, 0.05))',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    Вход по подписке (OAuth / код устройства)
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.75, marginTop: '2px' }}>
                    Подключите вашу личную подписку ChatGPT Plus/Pro, Anthropic, Google Gemini или Qwen в общий пул ротации.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => accountsModalAtom.set(null)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border, rgba(128,128,128,0.28))',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </div>

              <form
                onSubmit={handleStartOAuth}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                  alignItems: 'end',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Провайдер подписки</span>
                  <select
                    value={oauthProvider}
                    onChange={(e) => setOauthProvider(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  >
                    {PROVIDERS.filter((p) => p.supportsOAuth).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Название аккаунта в пуле</span>
                  <input
                    type="text"
                    value={oauthLabel}
                    onChange={(e) => setOauthLabel(e.target.value)}
                    placeholder="Например: Рабочая подписка"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={oauthLoading}
                  style={{
                    padding: '9px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #2563eb)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: oauthLoading ? 'default' : 'pointer',
                  }}
                >
                  {oauthLoading ? 'Запрос кода...' : 'Получить код входа'}
                </button>
              </form>

              {oauthSession ? (
                <div
                  style={{
                    padding: '14px',
                    borderRadius: '10px',
                    background: 'rgba(0,0,0,0.14)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    fontSize: '13px',
                  }}
                >
                  {oauthSession.userCode ? (
                    <div>
                      Ваш одноразовый код подтверждения:{' '}
                      <strong
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '15px',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(59, 130, 246, 0.2)',
                        }}
                      >
                        {oauthSession.userCode}
                      </strong>
                    </div>
                  ) : null}

                  <div>
                    Вы также можете выполнить вход через терминал командой:{' '}
                    <code
                      style={{
                        fontFamily: 'monospace',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(128,128,128,0.16)',
                      }}
                    >
                      {oauthSession.commandHint}
                    </code>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {oauthSession.verificationUri ? (
                      <button
                        type="button"
                        onClick={() => openExternalSafe(ctx, oauthSession.verificationUri)}
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
                        Открыть страницу подтверждения
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handlePollOAuth}
                      disabled={oauthLoading}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid var(--border, rgba(128,128,128,0.3))',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Проверить подтверждение и обновить пул
                    </button>
                  </div>
                </div>
              ) : null}

              {oauthError ? (
                <div style={{ fontSize: '13px', color: '#ef4444' }}>{oauthError}</div>
              ) : null}
            </div>
          ) : null}

          {/* Панель «Добавить ключ» (POST /accounts/key) */}
          {modalMode === 'key' ? (
            <form
              onSubmit={handleAddKeySubmit}
              style={{
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid var(--border, rgba(128,128,128,0.28))',
                background: 'var(--card, rgba(128,128,128,0.05))',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 700 }}>
                    Добавление API-ключа в пул
                  </div>
                  <div style={{ fontSize: '13px', opacity: 0.75, marginTop: '2px' }}>
                    Ключ будет сохранён в защищённом хранилище и включён в автоматическую ротацию по приоритету.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => accountsModalAtom.set(null)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border, rgba(128,128,128,0.28))',
                    background: 'transparent',
                    color: 'inherit',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Закрыть
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                }}
              >
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Провайдер</span>
                  <select
                    value={keyProvider}
                    onChange={(e) => setKeyProvider(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  >
                    {PROVIDERS.filter((p) => p.supportsKey).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Название в списке</span>
                  <input
                    type="text"
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    placeholder="Например: Резервный ключ"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>API-ключ</span>
                  <input
                    type="password"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    placeholder={
                      (PROVIDERS.find((p) => p.id === keyProvider) || {}).placeholder || 'sk-...'
                    }
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                    }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Приоритет (1 — наивысший)</span>
                  <input
                    type="number"
                    min="1"
                    value={keyPriority}
                    onChange={(e) => setKeyPriority(e.target.value)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border, rgba(128,128,128,0.3))',
                      background: 'var(--background, rgba(0,0,0,0.14))',
                      color: 'inherit',
                      fontSize: '13px',
                    }}
                  />
                </label>
              </div>

              {keyFormError ? (
                <div style={{ fontSize: '13px', color: '#ef4444' }}>{keyFormError}</div>
              ) : null}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="submit"
                  disabled={keySubmitting}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--primary, #2563eb)',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: keySubmitting ? 'default' : 'pointer',
                  }}
                >
                  {keySubmitting ? 'Сохранение...' : 'Сохранить в пул'}
                </button>
              </div>
            </form>
          ) : null}

          {/* Таблица аккаунтов */}
          <div
            style={{
              borderRadius: '12px',
              border: '1px solid var(--border, rgba(128,128,128,0.22))',
              background: 'var(--card, rgba(128,128,128,0.04))',
              overflowX: 'auto',
            }}
          >
            {filteredAccounts.length === 0 ? (
              <div
                style={{
                  padding: '36px 24px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ fontSize: '16px', fontWeight: 600 }}>
                  {loading
                    ? 'Загрузка пула аккаунтов...'
                    : 'В пуле пока нет подключённых подписок или ключей'}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.72, maxWidth: '520px' }}>
                  Добавьте одну или несколько подписок («Войти подпиской») либо API-ключей («Добавить ключ»), чтобы настроить бесшовную ротацию без простоев на лимитах.
                </div>
              </div>
            ) : (
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--border, rgba(128,128,128,0.2))',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      opacity: 0.72,
                    }}
                  >
                    <th style={{ padding: '12px 14px' }}>Приоритет</th>
                    <th style={{ padding: '12px 14px' }}>Аккаунт</th>
                    <th style={{ padding: '12px 14px' }}>Провайдер</th>
                    <th style={{ padding: '12px 14px' }}>Способ входа</th>
                    <th style={{ padding: '12px 14px' }}>Статус</th>
                    <th style={{ padding: '12px 14px', textAlign: 'right' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc, index) => {
                    const badge = getStatusBadge(acc)
                    const isBusy = busyAccountId === acc.id
                    return (
                      <tr
                        key={acc.id}
                        draggable
                        onDragStart={() => handleDragStart(acc.id)}
                        onDragOver={handleDragOver}
                        onDrop={() => handleDrop(acc.id)}
                        style={{
                          borderBottom: '1px solid var(--border, rgba(128,128,128,0.12))',
                          background:
                            draggedId === acc.id
                              ? 'rgba(59, 130, 246, 0.1)'
                              : acc.isActive
                                ? 'rgba(34, 197, 94, 0.04)'
                                : 'transparent',
                          cursor: 'grab',
                        }}
                      >
                        {/* Приоритет + перетаскивание / стрелки */}
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              title="Перетащите строку для смены приоритета"
                              style={{ opacity: 0.5, fontSize: '14px', userSelect: 'none' }}
                            >
                              ⋮⋮
                            </span>
                            <span style={{ fontWeight: 700 }}>#{acc.priority}</span>
                            <div style={{ display: 'inline-flex', gap: '2px', marginLeft: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleMovePriority(index, -1)}
                                disabled={index === 0}
                                title="Повысить приоритет"
                                style={{
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border, rgba(128,128,128,0.25))',
                                  background: 'transparent',
                                  color: 'inherit',
                                  fontSize: '11px',
                                  cursor: index === 0 ? 'default' : 'pointer',
                                  opacity: index === 0 ? 0.35 : 0.85,
                                }}
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMovePriority(index, 1)}
                                disabled={index === filteredAccounts.length - 1}
                                title="Понизить приоритет"
                                style={{
                                  padding: '2px 5px',
                                  borderRadius: '4px',
                                  border: '1px solid var(--border, rgba(128,128,128,0.25))',
                                  background: 'transparent',
                                  color: 'inherit',
                                  fontSize: '11px',
                                  cursor:
                                    index === filteredAccounts.length - 1 ? 'default' : 'pointer',
                                  opacity: index === filteredAccounts.length - 1 ? 0.35 : 0.85,
                                }}
                              >
                                ↓
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* Имя аккаунта и маска ключа */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600 }}>{acc.label}</div>
                          <div
                            style={{
                              fontSize: '11px',
                              opacity: 0.65,
                              fontFamily: 'monospace',
                              marginTop: '2px',
                            }}
                          >
                            {acc.maskedKey}
                          </div>
                        </td>

                        {/* Провайдер */}
                        <td style={{ padding: '12px 14px' }}>{acc.providerLabel}</td>

                        {/* Тип входа */}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              background: 'rgba(128,128,128,0.12)',
                            }}
                          >
                            {acc.authType === 'oauth' ? 'Подписка OAuth' : 'API-ключ'}
                          </span>
                        </td>

                        {/* Статус */}
                        <td style={{ padding: '12px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '3px 9px',
                              borderRadius: '999px',
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.text}
                          </span>
                          {acc.lastError ? (
                            <div
                              style={{
                                fontSize: '11px',
                                color: '#f59e0b',
                                marginTop: '4px',
                                maxWidth: '240px',
                              }}
                            >
                              {acc.lastError}
                            </div>
                          ) : null}
                        </td>

                        {/* Действия по строке: Снять пометку (reset), Обновить вход (refresh), Удалить (DELETE) */}
                        <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div
                            style={{
                              display: 'inline-flex',
                              gap: '6px',
                              justifyContent: 'flex-end',
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleResetCooldown(acc)}
                              disabled={isBusy}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid var(--border, rgba(128,128,128,0.28))',
                                background: 'transparent',
                                color: 'inherit',
                                fontSize: '12px',
                                cursor: isBusy ? 'default' : 'pointer',
                              }}
                            >
                              Снять пометку
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRefreshLogin(acc)}
                              disabled={isBusy}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid var(--border, rgba(128,128,128,0.28))',
                                background: 'transparent',
                                color: 'inherit',
                                fontSize: '12px',
                                cursor: isBusy ? 'default' : 'pointer',
                              }}
                            >
                              Обновить вход
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAccount(acc)}
                              disabled={isBusy}
                              style={{
                                padding: '5px 9px',
                                borderRadius: '6px',
                                border: '1px solid rgba(239, 68, 68, 0.35)',
                                background: 'rgba(239, 68, 68, 0.08)',
                                color: '#ef4444',
                                fontSize: '12px',
                                cursor: isBusy ? 'default' : 'pointer',
                              }}
                            >
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function registerAccountsPage(ctx) {
  // 1. Маршрут /nomad-accounts
  ctx.register({
    id: 'page',
    area: ROUTES_AREA,
    order: 60,
    data: {
      id: 'nomad.accounts.route',
      path: '/nomad-accounts',
      title: 'Аккаунты',
      render: () => <AccountsPage ctx={ctx} />,
    },
    render: () => <AccountsPage ctx={ctx} />,
  })

  // 2. Пункт боковой панели (ровно 1 строка на весь раздел Аккаунты + Тариф)
  ctx.register({
    id: 'nav',
    area: SIDEBAR_NAV_AREA,
    order: 60,
    data: {
      id: 'nomad.accounts.nav',
      label: 'Аккаунты',
      path: '/nomad-accounts',
      codicon: 'account',
      order: 60,
    },
  })

  // 3. Строка состояния: «Аккаунты: N · активен #k»
  ctx.register({
    id: 'statusbar',
    area: STATUSBAR_AREAS.right,
    order: 60,
    data: {
      id: 'nomad.accounts.status',
      label: 'Аккаунты: 0 · активен #—',
      to: '/nomad-accounts',
      render: () => <AccountsStatusbarPill ctx={ctx} />,
    },
    render: () => <AccountsStatusbarPill ctx={ctx} />,
  })

  // 4. Горячая клавиша Ctrl+Alt+A
  ctx.register({
    id: 'hotkey',
    area: KEYBINDS_AREA,
    order: 60,
    data: {
      id: 'nomad.accounts.open',
      category: 'navigation',
      defaults: ['ctrl+alt+a', 'mod+alt+a'],
      label: 'Аккаунты',
      run: () => openNomadAccountsTab('accounts'),
    },
  })

  // 5. Команды палитры (Ctrl+K)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 60,
    data: {
      id: 'nomad.accounts.open',
      action: 'nomad.accounts.open',
      label: 'Аккаунты',
      category: 'Nomad',
      keywords: ['аккаунты', 'подписки', 'ключи', 'пул', 'ротация', 'accounts'],
      run: () => openNomadAccountsTab('accounts'),
    },
  })

  ctx.register({
    id: 'palette-add-subscription',
    area: PALETTE_AREA,
    order: 61,
    data: {
      id: 'nomad.accounts.addSubscription',
      label: 'Добавить подписку',
      category: 'Nomad',
      keywords: ['добавить', 'подписка', 'войти', 'oauth', 'аккаунт'],
      run: () => {
        openNomadAccountsTab('accounts')
        accountsModalAtom.set('oauth')
      },
    },
  })

  ctx.register({
    id: 'palette-reset-cooldowns',
    area: PALETTE_AREA,
    order: 62,
    data: {
      id: 'nomad.accounts.resetCooldowns',
      label: 'Снять пометку исчерпания',
      category: 'Nomad',
      keywords: ['снять', 'пометка', 'исчерпание', 'сброс', 'лимит', 'пауза'],
      run: () => {
        openNomadAccountsTab('accounts')
        callNomadApi(ctx, '/accounts/reset', {
          method: 'POST',
          body: { all: true },
        }).catch(() => {})
      },
    },
  })
}
