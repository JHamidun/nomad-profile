// М-103: Интерфейс вкладки тарифа и баланса NomadNet (/nomad-billing).
// Обеспечивает отображение 4 состояний на «вы» (D10): нет ключа, нет сети, 402, ошибка CP.
// СТРОГО БЕЗ добавления новой строки в боковое меню (число строк плагина в навигации <= 6).

import { PALETTE_AREA, ROUTES_AREA } from '@hermes/plugin-sdk'
import {
  BillingTab,
  openNomadAccountsTab,
  activeAccountsTabAtom,
  BILLING_STATES,
  BILLING_MESSAGES,
  determineBillingState,
  openExternalSafe,
} from './accounts/billing-tab.js'

export {
  BillingTab,
  openNomadAccountsTab,
  activeAccountsTabAtom,
  BILLING_STATES,
  BILLING_MESSAGES,
  determineBillingState,
  openExternalSafe,
}

export default function registerBilling(ctx) {
  // 1. Маршрут /nomad-billing
  ctx.register({
    id: 'route',
    area: ROUTES_AREA,
    data: {
      id: 'nomad.billing.route',
      path: '/nomad-billing',
      title: 'Тариф и баланс NomadNet',
    },
    render: () => <BillingTab ctx={ctx} />,
  })

  // 2. Команда в палитре (Ctrl+K)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 65,
    data: {
      id: 'nomad.billing.open',
      action: 'nomad.billing.open',
      label: 'Тариф и баланс NomadNet',
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
        '402',
      ],
      run: () => openNomadAccountsTab('billing'),
    },
  })
}
