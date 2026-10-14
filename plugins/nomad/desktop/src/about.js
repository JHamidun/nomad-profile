import { useState } from 'react'
import { PALETTE_AREA, ROUTES_AREA, host } from '@hermes/plugin-sdk'

export const ABOUT_PATH = '/nomad-about'
export const ABOUT_SETTINGS_SECTION_ID = 'nomad.about'
export const ABOUT_TITLE = 'О программе Nomad'
export const ABOUT_COPYRIGHT = 'Copyright © 2026 NomadNet'

export const UPSTREAM_NOTICE_TEXT = [
  'Nomad — Distribution & Third-Party Software Notices (NOTICE)',
  'Copyright (c) 2026 NomadNet. All rights reserved.',
  '',
  '1. Upstream Core Attribution — Nous Research (MIT License)',
  'Базовое ядро агента создано проектом hermes-agent компании Nous Research:',
  '  Copyright (c) 2025 Nous Research · Лицензия MIT (полный текст сохранён в файле LICENSE).',
  '',
  '2. Компоненты под лицензиями Apache-2.0 и MIT',
  'Дистрибутив включает и взаимодействует с открытыми библиотеками под лицензиями Apache-2.0, MIT, BSD и ISC (Electron, React, Vite, FastAPI, Pydantic, Rich, Textual, Pillow).',
].join('\n')

export const EULA_RU_SUMMARY_TEXT = [
  'ЧЕРНОВИК — не утверждён владельцем (файл EULA.ru.md в корне поставки)',
  '',
  'Лицензионное соглашение с конечным пользователем и публичная оферта сервиса NomadNet:',
  '• Предмет: неисключительная лицензия на ПО Nomad и доступ к облачному маршрутизатору ИИ-моделей NomadNet (режим собственного ключа BYOK и предоплаченный ключ nmd_…).',
  '• Оплата: в рублях РФ (₽) через Т-Кассу (карты «Мир», Visa, Mastercard РФ и Система быстрых платежей СБП) с формированием чека по 54-ФЗ.',
  '• Возврат средств: в соответствии со ст. 26.1 и ст. 32 Закона РФ «О защите прав потребителей» (ЗоЗПП) и ст. 429.4 ГК РФ вы можете отказаться от договора и вернуть неизрасходованный остаток баланса.',
  '• Персональные данные и локализация: обработка по 152-ФЗ «О персональных данных»; при включении режима «Только РФ» запросы направляются только в локализованный контур.',
].join('\n')

export function AboutSection() {
  const [activeTab, setActiveTab] = useState('notice')

  return (
    <div
      data-testid="nomad-about-section"
      style={{
        padding: '24px 28px',
        maxWidth: 820,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>{ABOUT_TITLE}</h1>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85 }}>{ABOUT_COPYRIGHT}</p>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }}>
          В этом разделе вы можете ознакомиться с уведомлениями об открытых компонентах ядра
          (NOTICE, Nous Research, MIT License) и условиями лицензионного соглашения конечного
          пользователя (EULA.ru.md).
        </p>
      </header>

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          data-testid="nomad-about-tab-notice"
          onClick={() => setActiveTab('notice')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: activeTab === 'notice' ? 'rgba(217, 119, 6, 0.22)' : 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Открытые лицензии (NOTICE · Nous Research)
        </button>
        <button
          type="button"
          data-testid="nomad-about-tab-eula"
          onClick={() => setActiveTab('eula')}
          style={{
            padding: '8px 14px',
            borderRadius: 8,
            border: '1px solid rgba(148, 163, 184, 0.3)',
            background: activeTab === 'eula' ? 'rgba(217, 119, 6, 0.22)' : 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Лицензионное соглашение (EULA.ru.md)
        </button>
      </div>

      <pre
        data-testid="nomad-about-legal-content"
        style={{
          margin: 0,
          padding: '16px 18px',
          borderRadius: 10,
          border: '1px solid rgba(148, 163, 184, 0.2)',
          background: 'rgba(15, 23, 42, 0.24)',
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
        }}
      >
        {activeTab === 'notice' ? UPSTREAM_NOTICE_TEXT : EULA_RU_SUMMARY_TEXT}
      </pre>
    </div>
  )
}

export default function register(ctx) {
  ctx.register({
    id: 'page',
    area: ROUTES_AREA,
    data: {
      path: ABOUT_PATH,
    },
    render: () => <AboutSection />,
  })

  ctx.register({
    id: 'settings-about',
    area: 'settings.sections',
    order: 90,
    data: {
      id: ABOUT_SETTINGS_SECTION_ID,
      label: ABOUT_TITLE,
      codicon: 'info',
      path: ABOUT_PATH,
    },
    render: () => <AboutSection />,
  })

  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 90,
    data: {
      id: 'nomad.about.open',
      action: 'nomad.about.open',
      label: `${ABOUT_TITLE} и лицензии (NOTICE / EULA)`,
      category: 'Nomad',
      keywords: ['о программе', 'лицензия', 'notice', 'eula', 'nous research', 'about'],
      run: () => {
        if (typeof host?.navigate === 'function') {
          host.navigate(ABOUT_PATH)
        }
      },
    },
  })
}
