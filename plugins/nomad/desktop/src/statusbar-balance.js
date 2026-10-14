import { STATUSBAR_AREAS } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'

export function formatBalanceValue(account) {
  if (!account || typeof account !== 'object') return null
  if (typeof account.formatted_balance === 'string' && account.formatted_balance.trim() !== '') {
    return account.formatted_balance.trim()
  }
  const raw = account.balance
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Number.isInteger(raw) ? String(raw) : String(raw)
  }
  if (typeof raw === 'string' && raw.trim() !== '') {
    const num = Number(raw.trim())
    if (Number.isFinite(num)) {
      return Number.isInteger(num) ? String(num) : String(num)
    }
    return raw.trim()
  }
  return null
}

export function StatusbarBalance({ ctx, host }) {
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  useEffect(() => {
    let cancelled = false
    if (!ctx || typeof ctx.rest !== 'function') {
      setState({ status: 'error', data: null, error: 'rest unavailable' })
      return () => {}
    }
    Promise.resolve()
      .then(() => ctx.rest('/account'))
      .then((data) => {
        if (!cancelled) {
          setState({ status: 'ready', data: data || {}, error: null })
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({ status: 'error', data: null, error: String(err?.message || err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [ctx])

  const data = state.data
  const balanceText = formatBalanceValue(data)
  const currency = typeof data?.currency === 'string' && data.currency.trim() ? data.currency.trim() : null
  const code = data?.code || data?.status || (state.status === 'error' ? 'unreachable' : null)

  const handleClick = () => {
    if (host && typeof host.navigate === 'function') {
      host.navigate('/nomad-accounts')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="nomad-statusbar-balance"
      title={balanceText !== null ? `NomadNet balance: ${balanceText}${currency ? ' ' + currency : ''}` : `NomadNet: ${code || 'loading'}`}
      className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
    >
      <span className="font-medium">NomadNet</span>
      {state.status === 'loading' && (
        <span data-testid="nomad-balance-loading">…</span>
      )}
      {state.status !== 'loading' && balanceText !== null && (
        <span data-testid="nomad-balance-value" className="font-mono font-semibold text-foreground">
          {balanceText}
        </span>
      )}
      {state.status !== 'loading' && balanceText !== null && currency && (
        <span data-testid="nomad-balance-currency" className="text-[10px] opacity-80">
          {currency}
        </span>
      )}
      {state.status !== 'loading' && balanceText === null && (
        <span data-testid="nomad-balance-status" className="font-mono text-[10px] opacity-75">
          {code || 'disconnected'}
        </span>
      )}
    </button>
  )
}

export default function registerStatusbarBalance(ctx) {
  ctx.register({
    id: 'balance',
    area: STATUSBAR_AREAS.right,
    order: 35,
    data: { label: 'NomadNet Balance' },
    render: (host) => <StatusbarBalance ctx={ctx} host={host} />,
  })
}
