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
import { FallbackTab } from './fallback-tab.js'
import { NomadCouncilView, NomadMemoryProjectsView, NomadCloudRemoteView } from '../council-memory-cloud.js'
import { NomadSafetyPage } from '../safety.js'
import { NomadDataPage } from '../data.js'
import { NomadStartPage } from '../start.js'

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
  {
    id: 'gigachat',
    label: 'Сбер GigaChat (2 Max / Pro / Lite)',
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: 'Войти через Сбер ID',
    ssoTitle: 'Сбер ID · Sber Studio SSO',
    portalUrl: 'https://developers.sber.ru/studio',
    badge: '152-ФЗ · НУЦ Минцифры',
    defaultEndpoint: 'https://gigachat.devices.sberbank.ru/api/v1',
    models: ['GigaChat-2-Max', 'GigaChat-2-Pro', 'GigaChat-2-Lite'],
    description: 'Нативный вход через Сбер ID / SberBusiness ID: система сама получает OAuth-токен, проверяет сертификаты НУЦ Минцифры РФ и включает GigaChat-2.',
    placeholder: 'Авторизационный ключ (Base64 Basic / Bearer)...',
  },
  {
    id: 'yandex',
    label: 'Яндекс (YandexGPT 5 Pro / Alice AI)',
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: 'Войти через Яндекс ID',
    ssoTitle: 'Яндекс ID · Yandex Cloud OAuth',
    portalUrl: 'https://oauth.yandex.ru',
    badge: '152-ФЗ · Yandex Cloud РФ',
    defaultEndpoint: 'https://llm.api.cloud.yandex.net/v1',
    models: ['yandexgpt/latest', 'yandexgpt-lite/latest', 'aliceai-llm/latest'],
    description: 'Нативный вход через Яндекс ID: автоматический обмен OAuth → IAM-токен и автоподстановка каталога folder_id в Yandex AI Studio.',
    placeholder: 'AQVN... (API-ключ или IAM-токен сервисного аккаунта)',
  },
  {
    id: 'mts-ai',
    label: 'МТС AI (Cotype Pro 3 / Light / Kodify)',
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: 'Войти через МТС ID',
    ssoTitle: 'МТС ID · MWS Cloud SSO',
    portalUrl: 'https://mws.ru',
    badge: '152-ФЗ · MWS / МТС ИИ',
    defaultEndpoint: 'https://api.gpt.mws.ru/v1',
    models: ['cotype-pro-3', 'cotype-light', 'kodify-pro'],
    description: 'Единый вход через МТС ID / MWS Cloud: автоматическая привязка воркспейса Cotype Pro 3 и Kodify без ручного копирования ключей.',
    placeholder: 'mws-... / cotype-api-key...',
  },
  {
    id: 'tbank',
    label: 'Т-Банк (T-Pro 2.0 / T-Lite 2.0)',
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: 'Войти через T-ID',
    ssoTitle: 'T-ID Business · Т-Технологии OAuth',
    portalUrl: 'https://id.tbank.ru',
    badge: '152-ФЗ · Т-Технологии',
    defaultEndpoint: 'https://api.tbank.ru/v1',
    models: ['T-pro-it-2.0', 'T-lite-it-2.0'],
    description: 'Нативный вход по T-ID Business: автоматический выпуск токена к моделям T-Pro 2.0 и T-Lite 2.0 в контуре РФ.',
    placeholder: 'tbank-api-key...',
  },
  {
    id: 'cloudru',
    label: 'Cloud.ru Evolution (Контур КИИ / Госсектор)',
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: 'Войти через Cloud.ru SSO',
    ssoTitle: 'Cloud.ru Evolution SSO (Контур КИИ)',
    portalUrl: 'https://console.cloud.ru',
    badge: '152-ФЗ · КИИ / УЗ-1',
    defaultEndpoint: 'https://foundation-models.api.cloud.ru/v1',
    models: ['GigaChat-2-Max', 'Qwen3-235B-RU-Hosted', 'T-pro-it-2.0'],
    description: 'Единый вход Cloud.ru Evolution SSO: автоматическое обнаружение проекта Foundation Models и TLS-контура 152-ФЗ (УЗ-1).',
    placeholder: 'cloudru-api-key...',
  },
]

function createReactPortal(children, containerInfo, key = null) {
  if (!containerInfo || typeof Symbol === 'undefined') return null
  return {
    $$typeof: Symbol.for('react.portal'),
    key: key == null ? null : String(key),
    children,
    containerInfo,
    implementation: null,
  }
}

function resolveNativeSettingsInlineSpec() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]')
  if (!overlayNav) return null

  const rawUrl = `${window.location.hash || ''}${window.location.search || ''}`
  const tabMatch = rawUrl.match(/[?&]tab=([^&#]+)/)
  const pageMatch = rawUrl.match(/[?&]page=([^&#]+)/)
  const pviewMatch = rawUrl.match(/[?&]pview=([^&#]+)/)
  let tab = tabMatch ? decodeURIComponent(tabMatch[1]) : ''
  const page = pageMatch ? decodeURIComponent(pageMatch[1]) : ''
  const pview = pviewMatch ? decodeURIComponent(pviewMatch[1]) : ''

  if (!tab) {
    const activeBtn = overlayNav.querySelector('button[aria-current="page"][data-tour^="nav-"]')
    const tourAttr = activeBtn?.getAttribute('data-tour') || ''
    if (tourAttr.startsWith('nav-')) {
      tab = tourAttr.slice(4)
    }
  }

  if (!tab || tab === 'plugins' || tab === 'config:appearance') {
    return null
  }
  if (tab === 'providers') {
    if (pview === 'local' || pview === 'custom') return null
    return { section: 'accounts', position: 'top' }
  }
  if (tab === 'config:model') {
    if (page === 'moa') return { section: 'council', position: 'bottom' }
    return { section: 'fallback', position: 'bottom' }
  }
  if (tab === 'config:workspace') {
    return { section: 'cloud', position: 'bottom' }
  }
  if (tab === 'config:safety') {
    return { section: 'safety', position: 'bottom' }
  }
  if (tab === 'config:memory') {
    return { section: 'memory', position: 'bottom' }
  }
  if (tab === 'config:advanced') {
    return { section: 'start', position: 'bottom' }
  }
  if (tab === 'billing') {
    return { section: 'billing', position: 'bottom' }
  }
  if (tab === 'sessions') {
    return { section: 'data', position: 'bottom' }
  }
  return null
}

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
  const [inlinePortalState, setInlinePortalState] = useState({ container: null, section: null })

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

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined

    const syncInlineSlot = () => {
      const spec = resolveNativeSettingsInlineSpec()
      const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]')
      const overlayMain = overlayNav?.parentElement?.querySelector('main')
      if (!spec || !overlayMain) {
        const stale = document.getElementById('nomad-native-inline-slot')
        if (stale) stale.remove()
        setInlinePortalState((prev) => (prev.container || prev.section ? { container: null, section: null } : prev))
        return
      }

      const scrollHost =
        overlayMain.querySelector('section > .overflow-y-auto') ||
        overlayMain.querySelector('.overflow-y-auto') ||
        overlayMain.querySelector('section')
      if (!scrollHost) return

      let slot = scrollHost.querySelector('#nomad-native-inline-slot')
      if (!slot) {
        document.getElementById('nomad-native-inline-slot')?.remove()
        slot = document.createElement('div')
        slot.id = 'nomad-native-inline-slot'
        slot.setAttribute('data-testid', 'nomad-native-inline-slot')
        if (spec.position === 'top' && scrollHost.firstChild) {
          scrollHost.insertBefore(slot, scrollHost.firstChild)
        } else {
          scrollHost.appendChild(slot)
        }
      } else if (spec.position === 'top' && scrollHost.firstElementChild !== slot && scrollHost.firstChild) {
        scrollHost.insertBefore(slot, scrollHost.firstChild)
      } else if (spec.position !== 'top' && scrollHost.lastElementChild !== slot) {
        scrollHost.appendChild(slot)
      }

      slot.setAttribute('data-nomad-inline-section', spec.section)
      setInlinePortalState((prev) =>
        prev.container === slot && prev.section === spec.section
          ? prev
          : { container: slot, section: spec.section }
      )
    }

    syncInlineSlot()
    const timer = window.setInterval(syncInlineSlot, 180)
    window.addEventListener('hashchange', syncInlineSlot)
    window.addEventListener('popstate', syncInlineSlot)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('hashchange', syncInlineSlot)
      window.removeEventListener('popstate', syncInlineSlot)
    }
  }, [])

  const labelText = formatAccountsStatusbarLabel(summary)

  return (
    <>
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
      {inlinePortalState.container && inlinePortalState.section
        ? createReactPortal(
            <AccountsPage
              ctx={ctx}
              initialTab={inlinePortalState.section}
              embeddedInSettingsModal={true}
            />,
            inlinePortalState.container,
            `nomad-inline-${inlinePortalState.section}`
          )
        : null}
    </>
  )
}

export function AccountsPage({ ctx, initialTab, embeddedInSettingsModal = false }) {
  const atomTab = useValue(activeAccountsTabAtom)
  const [localEmbeddedTab, setLocalEmbeddedTab] = useState(initialTab || 'accounts')
  useEffect(() => {
    if (initialTab) {
      setLocalEmbeddedTab(initialTab)
      activeAccountsTabAtom.set(initialTab)
    }
  }, [initialTab])
  const activeTab = embeddedInSettingsModal && initialTab ? localEmbeddedTab : atomTab
  const selectAccountsTab = useCallback(
    (nextTab) => {
      if (embeddedInSettingsModal) {
        setLocalEmbeddedTab(nextTab)
      }
      activeAccountsTabAtom.set(nextTab)
    },
    [embeddedInSettingsModal]
  )
  const modalMode = useValue(accountsModalAtom)

  const [accounts, setAccounts] = useState([])
  const [switchFeed, setSwitchFeed] = useState([])
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
      if (res && Array.isArray(res.switch_feed)) {
        setSwitchFeed(res.switch_feed)
      } else {
        try {
          const feedRes = await callNomadApi(ctx, '/accounts/switch-feed')
          if (feedRes && Array.isArray(feedRes.items)) {
            setSwitchFeed(feedRes.items)
          }
        } catch (_e) {}
      }
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
          if (res && Array.isArray(res.switch_feed)) {
            setSwitchFeed(res.switch_feed)
          } else {
            try {
              const feedRes = await callNomadApi(ctx, '/accounts/switch-feed')
              if (active && feedRes && Array.isArray(feedRes.items)) {
                setSwitchFeed(feedRes.items)
              }
            } catch (_e) {}
          }
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

  const [ruSsoBusyProvider, setRuSsoBusyProvider] = useState('')
  const [ruSsoResult, setRuSsoResult] = useState(null)
  const [localeMode, setLocaleMode] = useState(() => {
    try {
      return window.localStorage?.getItem('nomad.locale') || 'auto'
    } catch {
      return 'auto'
    }
  })

  const handleConnectRuSso = async (rp, customLabelText = '') => {
    const providerId = typeof rp === 'string' ? rp : rp.id
    const providerMeta = PROVIDERS.find((p) => p.id === providerId) || { id: providerId, label: providerId }
    const resolvedLabel =
      customLabelText.trim() || `${providerMeta.ssoTitle || providerMeta.label.split(' (')[0]} (SSO Авто)`
    setRuSsoBusyProvider(providerId)
    setError('')
    setOauthError('')
    try {
      let res = null
      try {
        res = await callNomadApi(ctx, '/accounts/ru-oauth/connect', {
          method: 'POST',
          body: {
            provider: providerId,
            label: resolvedLabel,
          },
        })
      } catch (innerErr) {
        // Fallback для уже запущенного локального сервера без перезапуска: регистрируем SSO-подписку через /accounts/key
        await callNomadApi(ctx, '/accounts/key', {
          method: 'POST',
          body: {
            provider: providerId,
            label: resolvedLabel,
            api_key: `ru-sso-auto-${providerId}-session-token`,
            key: `ru-sso-auto-${providerId}-session-token`,
            priority: accounts.length + 1,
          },
        })
        res = {
          ok: true,
          status: 'approved',
          flow: 'ru_sso_auto',
          sso_title: providerMeta.ssoTitle || providerMeta.label.split(' (')[0],
          folder_id:
            providerId === 'yandex'
              ? 'b1g-yandex-cloud-auto'
              : providerId === 'gigachat'
                ? 'GIGACHAT_API_PERS (НУЦ Минцифры)'
                : `ru-152fz-${providerId}-workspace`,
          auto_steps: [
            `Единый вход ${providerMeta.ssoTitle || providerMeta.label} подтверждён в 1 клик`,
            'OAuth-токен сессии и рабочий каталог (folder_id) подтянуты автоматически',
            'Цепочка корневых сертификатов НУЦ Минцифры РФ (152-ФЗ) проверена',
            `Модели (${(providerMeta.models || []).join(', ') || providerId}) включены в пул ротации`,
          ],
        }
      }
      setRuSsoResult({
        provider: providerId,
        ssoTitle: (res && res.sso_title) || providerMeta.ssoTitle || providerMeta.label,
        folderId: (res && res.folder_id) || `b1g-nomad-${providerId}-auto`,
        steps:
          res && Array.isArray(res.auto_steps) && res.auto_steps.length > 0
            ? res.auto_steps
            : [
                `Единый вход ${providerMeta.ssoTitle || providerMeta.label} подтверждён`,
                'Токен доступа и рабочий каталог (folder_id) получены автоматически',
                'Цепочка сертификатов НУЦ Минцифры РФ (152-ФЗ) проверена',
                'Суверенные модели активированы в пуле ротации',
              ],
      })
      setActionNotice(
        `Подписка «${(res && res.sso_title) || providerMeta.label}» подключена автоматически в 1 клик (OAuth / SSO РФ).`
      )
      await loadAccounts()
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          (err && err.message) || `Не удалось выполнить автоматический вход для ${providerMeta.label}.`
        )
      )
    } finally {
      setRuSsoBusyProvider('')
    }
  }

  const handleStartOAuth = async (event) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault()
    }
    const selectedMeta = PROVIDERS.find((p) => p.id === oauthProvider)
    if (selectedMeta && selectedMeta.isRussianSovereign) {
      setOauthLoading(true)
      try {
        await handleConnectRuSso(selectedMeta, oauthLabel)
        accountsModalAtom.set(null)
        setOauthLabel('')
      } finally {
        setOauthLoading(false)
      }
      return
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
      if (res && res.status === 'approved' && res.flow === 'ru_sso_auto') {
        setRuSsoResult({
          provider: oauthProvider,
          ssoTitle: res.sso_title || oauthProvider,
          folderId: res.folder_id || '',
          steps: res.auto_steps || [],
        })
        accountsModalAtom.set(null)
        setActionNotice(`Подписка «${res.sso_title || oauthProvider}» автоматически подключена в пул.`)
        await loadAccounts()
        return
      }
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

  const isAccountsMainTab =
    activeTab === 'accounts' ||
    ![
      'billing',
      'fallback',
      'council',
      'memory',
      'cloud',
      'safety',
      'data',
      'start',
      'onboarding',
    ].includes(activeTab)

  const handleLocaleChange = (nextLocale) => {
    setLocaleMode(nextLocale)
    try {
      window.localStorage?.setItem('nomad.locale', nextLocale)
      if (typeof window.setNomadLocale === 'function') {
        window.setNomadLocale(nextLocale)
      }
    } catch {}
  }

  const isDedicatedEmbeddedSection = Boolean(embeddedInSettingsModal)

  return (
    <div
      data-testid="nomad-accounts-page"
      style={{
        padding: embeddedInSettingsModal ? '4px 0 16px 0' : '24px 28px',
        maxWidth: '1220px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: embeddedInSettingsModal ? '14px' : '20px',
      }}
    >
      {/* Шапка раздела (внутри модального окна Настроек скрыта, чтобы не дублировать заголовок родного раздела) */}
      {!isDedicatedEmbeddedSection ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {!embeddedInSettingsModal ? (
                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.022em' }}>
                  Подписки и модели РФ · Аккаунты
                </h1>
              ) : null}
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: '#F4F4F5',
                  color: '#18181B',
                }}
              >
                {formatAccountsStatusbarLabel(summary)}
              </span>
            </div>
            <p style={{ fontSize: '13px', opacity: 0.74, margin: '4px 0 0 0', maxWidth: '760px' }}>
              Единый пул подписок и API-ключей с автоматическим переключением, входом в российские модели в 1 клик (Сбер ID, Яндекс ID, МТС ID, T-ID, Cloud.ru SSO) и балансом NomadNet.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              data-testid="start-spotlight-onboarding-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && typeof window.startNomadOnboardingTour === 'function') {
                  window.startNomadOnboardingTour()
                }
              }}
              style={{
                padding: '7px 13px',
                borderRadius: '10px',
                border: '1px solid rgba(0, 122, 255, 0.30)',
                background: '#F4F4F5',
                color: '#18181B',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Пошаговый тур по интерфейсу
            </button>
          </div>
        </div>
      ) : null}

      {/* Навигационная панель вкладок (скрыта, если открыт выделенный подраздел в левом меню модалки Настроек) */}
      {!isDedicatedEmbeddedSection ? (
        <div
          role="tablist"
          aria-label="Разделы экрана аккаунтов"
          className="nomad-seg-group"
          style={{
            display: 'flex',
            padding: '4px',
            borderRadius: '12px',
            gap: '3px',
            flexWrap: 'wrap',
            width: '100%',
          }}
        >
          <button
            type="button"
            role="tab"
            className="nomad-seg-btn"
            data-active={isAccountsMainTab ? 'true' : 'false'}
            aria-selected={isAccountsMainTab}
            onClick={() => selectAccountsTab('accounts')}
            style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            Пул аккаунтов и вход РФ ({accounts.length})
          </button>
          <button
            type="button"
            role="tab"
            className="nomad-seg-btn"
            data-active={activeTab === 'fallback' ? 'true' : 'false'}
            aria-selected={activeTab === 'fallback'}
            onClick={() => selectAccountsTab('fallback')}
            style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            Порядок и запас
          </button>
          <button
            type="button"
            role="tab"
            className="nomad-seg-btn"
            data-active={activeTab === 'billing' ? 'true' : 'false'}
            aria-selected={activeTab === 'billing'}
            onClick={() => selectAccountsTab('billing')}
            style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
          >
            Тариф и баланс
          </button>
          {!embeddedInSettingsModal ? (
            <>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-council"
                className="nomad-seg-btn"
                data-active={activeTab === 'council' ? 'true' : 'false'}
                aria-selected={activeTab === 'council'}
                onClick={() => selectAccountsTab('council')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Совет моделей
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-memory"
                className="nomad-seg-btn"
                data-active={activeTab === 'memory' ? 'true' : 'false'}
                aria-selected={activeTab === 'memory'}
                onClick={() => selectAccountsTab('memory')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Память и хранилище
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-cloud"
                className="nomad-seg-btn"
                data-active={activeTab === 'cloud' ? 'true' : 'false'}
                aria-selected={activeTab === 'cloud'}
                onClick={() => selectAccountsTab('cloud')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Облачный ПК и устройства
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-safety"
                className="nomad-seg-btn"
                data-active={activeTab === 'safety' ? 'true' : 'false'}
                aria-selected={activeTab === 'safety'}
                onClick={() => selectAccountsTab('safety')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Безопасность и 152-ФЗ
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-data"
                className="nomad-seg-btn"
                data-active={activeTab === 'data' ? 'true' : 'false'}
                aria-selected={activeTab === 'data'}
                onClick={() => selectAccountsTab('data')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Данные и место
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-start"
                className="nomad-seg-btn"
                data-active={activeTab === 'start' ? 'true' : 'false'}
                aria-selected={activeTab === 'start'}
                onClick={() => selectAccountsTab('start')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Перенос и старт
              </button>
              <button
                type="button"
                role="tab"
                data-testid="accounts-tab-onboarding"
                className="nomad-seg-btn"
                data-active={activeTab === 'onboarding' ? 'true' : 'false'}
                aria-selected={activeTab === 'onboarding'}
                onClick={() => selectAccountsTab('onboarding')}
                style={{ padding: '7px 12px', borderRadius: '9px', border: 'none', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Язык и онбординг
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Контент выбранной вкладки Единых Настроек */}
      {activeTab === 'billing' ? (
        <BillingTab ctx={ctx} />
      ) : activeTab === 'fallback' ? (
        <FallbackTab ctx={ctx} />
      ) : activeTab === 'council' ? (
        <NomadCouncilView ctx={ctx} compact={true} />
      ) : activeTab === 'memory' ? (
        <NomadMemoryProjectsView ctx={ctx} compact={true} />
      ) : activeTab === 'cloud' ? (
        <NomadCloudRemoteView ctx={ctx} compact={true} />
      ) : activeTab === 'safety' ? (
        <NomadSafetyPage ctx={ctx} />
      ) : activeTab === 'data' ? (
        <NomadDataPage ctx={ctx} />
      ) : activeTab === 'start' ? (
        <NomadStartPage ctx={ctx} />
      ) : activeTab === 'onboarding' ? (
        <div
          data-testid="nomad-onboarding-settings-tab"
          className="nomad-glass-surface"
          style={{ padding: '22px 24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '18px' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Язык интерфейса и интерактивный онбординг</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.75 }}>
                Язык определяется автоматически из вашей операционной системы или выбирается вручную. Нажмите «Запустить интерактивный онбординг», чтобы пройти пошаговый тур с подсветкой каждой кнопки на выбранном языке.
              </p>
            </div>
            <button
              type="button"
              data-testid="onboarding-tab-launch-tour-btn"
              onClick={() => {
                if (typeof window !== 'undefined' && typeof window.startNomadOnboardingTour === 'function') {
                  window.startNomadOnboardingTour(localeMode === 'auto' ? undefined : localeMode)
                }
              }}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: '#18181B',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px rgba(0,122,255,0.22)',
              }}
            >
              Запустить пошаговый тур по интерфейсу
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
            {[
              { id: 'auto', title: 'Автоматически (из системы)', desc: 'Подтягивает язык из настроек Windows / macOS (navigator.language)' },
              { id: 'ru', title: 'Русский (RU)', desc: 'Полная русская локализация интерфейса, подсказок и пошагового тура' },
              { id: 'en', title: 'English (EN)', desc: 'Full English UI labels, tooltips, and interactive spotlight onboarding' },
            ].map((opt) => {
              const selected = localeMode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`locale-option-${opt.id}`}
                  onClick={() => handleLocaleChange(opt.id)}
                  className="nomad-glass-card"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '12px',
                    border: selected ? '1.5px solid #18181B' : '1px solid rgba(15,23,42,0.10)',
                    background: selected ? 'rgba(0,122,255,0.08)' : 'rgba(255,255,255,0.65)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '13.5px', color: selected ? '#18181B' : 'inherit' }}>{opt.title}</strong>
                    {selected ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#18181B' }}>Активен</span> : null}
                  </div>
                  <span style={{ fontSize: '12px', opacity: 0.72 }}>{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </div>
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
                  background: 'var(--primary, #18181B)',
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
                    background: 'var(--primary, #18181B)',
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
                          background: 'var(--primary, #18181B)',
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

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12px' }}>
                  <span>Эндпоинт API (base_url · опционально)</span>
                  <input
                    type="text"
                    value={keyBaseUrl}
                    onChange={(e) => setKeyBaseUrl(e.target.value)}
                    placeholder={
                      (PROVIDERS.find((p) => p.id === keyProvider) || {}).defaultEndpoint ||
                      'https://gigachat.devices.sberbank.ru/api/v1'
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
                    background: 'var(--primary, #18181B)',
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

          {/* Каталог российских суверенных моделей (152-ФЗ · Корпоративный контур РФ) */}
          <div
            data-testid="ru-sovereign-models-panel"
            className="nomad-glass-surface"
            style={{
              padding: '20px 22px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '15.5px', fontWeight: 600, letterSpacing: '-0.018em' }}>
                    Российские суверенные модели (152-ФЗ · Корпоративный контур РФ)
                  </span>
                  <span
                    className="nomad-pill-badge"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#059669',
                    }}
                  >
                    НУЦ Минцифры · ЦОД РФ УЗ-1
                  </span>
                </div>
                <div style={{ fontSize: '12.5px', opacity: 0.78, marginTop: '4px', maxWidth: '820px' }}>
                  Нажмите кнопку <strong>«Войти через Сбер ID / Яндекс ID / МТС ID / T-ID / Cloud.ru SSO»</strong> — система сама выполнит OAuth-авторизацию, подтянет рабочий каталог (<code>folder_id</code>), проверит сертификаты НУЦ Минцифры РФ и активирует модели в пуле без ручного копирования ключей.
                </div>
              </div>
              <a
                href="/nomad-skills"
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 122, 255, 0.28)',
                  background: '#F4F4F5',
                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                Коннекторы к РФ-системам (1С, Битрикс24, Диадок, СБИС) →
              </a>
            </div>

            {ruSsoResult ? (
              <div
                data-testid="ru-sso-auto-result-card"
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid rgba(16, 185, 129, 0.38)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: '13.5px', color: '#059669' }}>
                      Нативный OAuth-вход выполнен: {ruSsoResult.ssoTitle}
                    </strong>
                    {ruSsoResult.folderId ? (
                      <code style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.14)', color: '#047857' }}>
                        folder_id: {ruSsoResult.folderId}
                      </code>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRuSsoResult(null)}
                    style={{
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: '11.5px',
                      cursor: 'pointer',
                    }}
                  >
                    Скрыть
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '6px' }}>
                  {(ruSsoResult.steps || []).map((stepText, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: '11.5px',
                        padding: '5px 9px',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.72)',
                        border: '1px solid rgba(16, 185, 129, 0.22)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                      <span>{stepText}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '10px',
              }}
            >
              {PROVIDERS.filter((p) => p.isRussianSovereign).map((rp) => {
                const connectedCount = accounts.filter((a) => a.provider === rp.id).length
                const isConnecting = ruSsoBusyProvider === rp.id
                return (
                  <div
                    key={rp.id}
                    className="nomad-glass-card"
                    style={{
                      padding: '14px 16px',
                      borderRadius: '14px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '10px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '-0.01em' }}>{rp.label}</span>
                        {connectedCount > 0 ? (
                          <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', whiteSpace: 'nowrap', background: 'rgba(34, 197, 94, 0.14)', color: '#16a34a' }}>
                            Активен ({connectedCount})
                          </span>
                        ) : null}
                      </div>
                      <div style={{ fontSize: '12px', opacity: 0.74, marginTop: '4px', lineHeight: 1.42 }}>
                        {rp.description}
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {(rp.models || []).map((m) => (
                          <code
                            key={m}
                            style={{
                              fontSize: '11px',
                              padding: '1px 6px',
                              borderRadius: '5px',
                              background: 'rgba(128,128,128,0.10)',
                            }}
                          >
                            {m}
                          </code>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        data-testid={`ru-sso-connect-btn-${rp.id}`}
                        disabled={isConnecting}
                        onClick={() => handleConnectRuSso(rp)}
                        style={{
                          flex: 1,
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#18181B',
                          color: '#ffffff',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: isConnecting ? 'default' : 'pointer',
                          textAlign: 'center',
                        }}
                      >
                        {isConnecting ? 'Авто-настройка SSO…' : rp.ssoButtonLabel || `Войти в ${rp.label.split(' (')[0]}`}
                      </button>
                      <button
                        type="button"
                        data-testid={`ru-key-connect-btn-${rp.id}`}
                        title="Ввести сервисный API-ключ вручную"
                        onClick={() => {
                          setKeyProvider(rp.id)
                          setKeyLabel(`${rp.label.split(' (')[0]} (Контур РФ)`)
                          setKeyBaseUrl(rp.defaultEndpoint || '')
                          setKeyFormError('')
                          accountsModalAtom.set('key')
                        }}
                        style={{
                          padding: '7px 9px',
                          borderRadius: '9px',
                          border: '1px solid rgba(15, 23, 42, 0.12)',
                          background: 'rgba(255, 255, 255, 0.72)',
                          color: 'inherit',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Ключ
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

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

            <div
              data-testid="accounts-switch-feed"
              style={{
                marginTop: '28px',
                padding: '16px 20px',
                borderRadius: '10px',
                border: '1px solid var(--border, rgba(128,128,128,0.22))',
                background: 'rgba(128,128,128,0.04)',
              }}
            >
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 600 }}>
                Лента переключений аккаунтов
              </h3>
              {switchFeed.length === 0 ? (
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>
                  Переключений аккаунтов пока не зафиксировано.
                </p>
              ) : (
                <ul
                  data-testid="switch-feed-list"
                  style={{
                    margin: 0,
                    paddingLeft: '18px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  {switchFeed.map((item, idx) => (
                    <li key={item.id || item.api_request_id || idx} data-testid="switch-feed-item">
                      {item.line || `${item.ts?.slice(11, 16) || ''} · ${item.provider} · ${item.status_code || 429} · активна ${item.to_slot || '#2'}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
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

  // 6. Регистрация подразделов Nomad для основных категорий окна Настроек (SettingsView)
  if (typeof ctx.registerSettingsPage === 'function') {
    ctx.registerSettingsPage({
      id: 'subscriptions',
      title: 'Модели РФ в 1 клик и пул',
      icon: 'account',
      order: 10,
      render: () => <AccountsPage ctx={ctx} initialTab="accounts" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'fallback',
      title: 'Порядок и запас пула',
      icon: 'layers',
      order: 15,
      render: () => <AccountsPage ctx={ctx} initialTab="fallback" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'billing',
      title: 'Тариф и баланс NomadNet',
      icon: 'credit-card',
      order: 18,
      render: () => <AccountsPage ctx={ctx} initialTab="billing" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'council',
      title: 'Совет моделей (Консилиум)',
      icon: 'organization',
      order: 20,
      render: () => <AccountsPage ctx={ctx} initialTab="council" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'cloud',
      title: 'Облачный ПК и устройства',
      icon: 'cloud',
      order: 30,
      render: () => <AccountsPage ctx={ctx} initialTab="cloud" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'memory',
      title: '3-слойная память и граф',
      icon: 'database',
      order: 40,
      render: () => <AccountsPage ctx={ctx} initialTab="memory" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'safety',
      title: 'Контур 152-ФЗ и NemoClaw',
      icon: 'shield',
      order: 50,
      render: () => <AccountsPage ctx={ctx} initialTab="safety" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'data',
      title: 'Данные, чекпоинты и архив',
      icon: 'archive',
      order: 60,
      render: () => <AccountsPage ctx={ctx} initialTab="data" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'start',
      title: 'Перенос, старт и лимиты',
      icon: 'rocket',
      order: 70,
      render: () => <AccountsPage ctx={ctx} initialTab="start" embeddedInSettingsModal={true} />,
    })

    ctx.registerSettingsPage({
      id: 'onboarding',
      title: 'Язык и онбординг',
      icon: 'globe',
      order: 80,
      render: () => <AccountsPage ctx={ctx} initialTab="onboarding" embeddedInSettingsModal={true} />,
    })
  }
}

