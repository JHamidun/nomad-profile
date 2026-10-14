// М-143: Вкладка U6 «Персонализация» ассистента без седьмой строки меню.
// Настройки обращения, роли, стиля ответов и синхронизация с onboarding-answers.
// СТРОГО БЕЗ добавления строки в боковое меню (число строк плагина в навигации <= 6).

import { PALETTE_AREA, ROUTES_AREA, atom, host } from '@hermes/plugin-sdk'
import { createElement, useCallback, useEffect, useState } from 'react'

export const ONBOARDING_ANSWERS_STORAGE_KEY = 'hermes-onboarding-wizard-answers-v1'
export const PERSONALIZATION_STORAGE_KEY = 'nomad.personalization.settings'
export const PERSONALIZATION_ROUTE_PATH = '/nomad-personalization'

export const DEFAULT_PERSONALIZATION_SETTINGS = {
  userName: '',
  honorific: 'formal', // 'formal' = обращение строго на «вы» (решение D10)
  role: 'Инженер / Разработчик',
  replyStyle: 'technical', // 'technical', 'concise', 'detailed', 'mentor'
  accent: 'nomad',
}

export const REPLY_STYLES = [
  { id: 'technical', label: 'Технический и прямой (без воды)' },
  { id: 'concise', label: 'Краткий (сжатые выводы)' },
  { id: 'detailed', label: 'Подробный (с пояснениями архитектуры)' },
  { id: 'mentor', label: 'Менторский (с вопросами и проверкой)' },
]

export const ACCENT_COLORS = [
  { id: 'nomad', label: 'Nomad Blue (канонический)' },
  { id: 'emerald', label: 'Emerald Green (изумруд)' },
  { id: 'ocean', label: 'Deep Ocean (морской)' },
  { id: 'amber', label: 'Amber (тёплый янтарь)' },
]

const h = createElement
export const personalizationStateAtom = atom({ ...DEFAULT_PERSONALIZATION_SETTINGS })

export function readStorageSafe(ctx, key, fallback = null) {
  if (ctx && ctx.storage && typeof ctx.storage.get === 'function') {
    return ctx.storage.get(key, fallback)
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw)
    } catch {
      return fallback
    }
  }
  return fallback
}

export function writeStorageSafe(ctx, key, value) {
  if (ctx && ctx.storage && typeof ctx.storage.set === 'function') {
    ctx.storage.set(key, value)
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Игнорируем ошибки квоты
    }
  }
}

export function loadPersonalizationSettings(ctx) {
  const saved = readStorageSafe(ctx, PERSONALIZATION_STORAGE_KEY, null)
  const onboarding = readStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, null)

  const merged = {
    ...DEFAULT_PERSONALIZATION_SETTINGS,
    ...(saved || {}),
  }

  if (onboarding && onboarding.accent) {
    merged.accent = onboarding.accent
  }

  personalizationStateAtom.set(merged)
  return merged
}

export function savePersonalizationSettings(ctx, newSettings) {
  const clean = {
    ...DEFAULT_PERSONALIZATION_SETTINGS,
    ...(newSettings || {}),
  }

  // 1. Сохраняем настройки плагина Nomad
  writeStorageSafe(ctx, PERSONALIZATION_STORAGE_KEY, clean)
  personalizationStateAtom.set(clean)

  // 2. Сверка и синхронизация с onboarding-answers апстрима
  const currentOnboarding = readStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, {}) || {}
  const nextOnboarding = {
    ...currentOnboarding,
    accent: clean.accent || null,
    userName: clean.userName || currentOnboarding.userName || null,
  }
  writeStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, nextOnboarding)

  if (host && typeof host.notify === 'function') {
    host.notify('Настройки персонализации сохранены')
  }

  return clean
}

export function PersonalizationTab({ ctx, onSaved = null }) {
  const [settings, setSettings] = useState(() => loadPersonalizationSettings(ctx))
  const [saveSuccess, setSaveSuccess] = useState('')

  const handleFieldChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }))
    setSaveSuccess('')
  }

  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault()
    }
    const saved = savePersonalizationSettings(ctx, settings)
    setSaveSuccess('Настройки персонализации успешно сохранены и вступят в силу для всех новых сессий.')
    if (typeof onSaved === 'function') {
      onSaved(saved)
    }
  }

  return h(
    'div',
    {
      'data-testid': 'nomad-personalization-container',
      style: {
        padding: '24px 32px',
        maxWidth: '720px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      },
    },
    h(
      'header',
      { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      h(
        'h1',
        {
          'data-testid': 'personalization-title',
          style: { fontSize: '20px', fontWeight: 600, margin: 0 },
        },
        'Персонализация ассистента Nomad',
      ),
      h(
        'p',
        { style: { margin: 0, fontSize: '13px', opacity: 0.75, lineHeight: 1.5 } },
        'Настройте формат взаимодействия, имя обращения и стилистику ответов модели. Все параметры сохраняются локально в профиле и синхронизируются с мастером онбординга.',
      ),
    ),
    h(
      'form',
      {
        onSubmit: handleSubmit,
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          background: 'var(--card, rgba(128,128,128,0.05))',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--border, rgba(128,128,128,0.22))',
        },
      },
      // Имя пользователя
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h(
          'label',
          { style: { fontSize: '13px', fontWeight: 600 } },
          'Как к вам обращаться:',
        ),
        h('input', {
          type: 'text',
          'data-testid': 'personalization-username-input',
          value: settings.userName,
          onChange: (e) => handleFieldChange('userName', e.target.value),
          placeholder: 'Например: Жемал',
          style: {
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border, rgba(128,128,128,0.3))',
            background: 'var(--background, rgba(0,0,0,0.12))',
            color: 'inherit',
            fontSize: '13px',
          },
        }),
      ),
      // Форма обращения (D10: на вы)
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h(
          'label',
          { style: { fontSize: '13px', fontWeight: 600 } },
          'Форма обращения (решение D10):',
        ),
        h(
          'select',
          {
            'data-testid': 'personalization-honorific-select',
            title: 'Форма обращения: строго на «вы» (канон Nomad D10)',
            'data-tooltip': 'Форма обращения: строго на «вы» (канон Nomad D10)',
            value: settings.honorific,
            onChange: (e) => handleFieldChange('honorific', e.target.value),
            style: {
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(128,128,128,0.3))',
              background: 'var(--background, rgba(0,0,0,0.12))',
              color: 'inherit',
              fontSize: '13px',
            },
          },
          h('option', { value: 'formal' }, 'Строго на «вы» (канон Nomad D10)'),
          h('option', { value: 'informal' }, 'На «ты» (неформальный рабочий стиль)'),
        ),
      ),
      // Роль и профессия
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('label', { style: { fontSize: '13px', fontWeight: 600 } }, 'Ваша основная роль / профиль:'),
        h('input', {
          type: 'text',
          'data-testid': 'personalization-role-input',
          title: 'Роль и специализация ассистента',
          'data-tooltip': 'Роль и специализация ассистента',
          value: settings.role,
          onChange: (e) => handleFieldChange('role', e.target.value),
          placeholder: 'Например: CPO / Разработчик',
          style: {
            padding: '8px 12px',
            borderRadius: '8px',
            border: '1px solid var(--border, rgba(128,128,128,0.3))',
            background: 'var(--background, rgba(0,0,0,0.12))',
            color: 'inherit',
            fontSize: '13px',
          },
        }),
      ),
      // Стиль ответов модели
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('label', { style: { fontSize: '13px', fontWeight: 600 } }, 'Стиль и глубина ответов модели:'),
        h(
          'select',
          {
            'data-testid': 'personalization-style-select',
            title: 'Стиль ответов: технический, краткий или менторский',
            'data-tooltip': 'Стиль ответов: технический, краткий или менторский',
            value: settings.replyStyle,
            onChange: (e) => handleFieldChange('replyStyle', e.target.value),
            style: {
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(128,128,128,0.3))',
              background: 'var(--background, rgba(0,0,0,0.12))',
              color: 'inherit',
              fontSize: '13px',
            },
          },
          REPLY_STYLES.map((st) => h('option', { key: st.id, value: st.id }, st.label)),
        ),
      ),
      // Цветовой акцент оформления (синхронизируется с onboarding-answers)
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
        h('label', { style: { fontSize: '13px', fontWeight: 600 } }, 'Цветовой акцент интерфейса (онбординг):'),
        h(
          'select',
          {
            'data-testid': 'personalization-accent-select',
            title: 'Цветовой акцент оформления интерфейса',
            'data-tooltip': 'Цветовой акцент оформления интерфейса',
            value: settings.accent,
            onChange: (e) => handleFieldChange('accent', e.target.value),
            style: {
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(128,128,128,0.3))',
              background: 'var(--background, rgba(0,0,0,0.12))',
              color: 'inherit',
              fontSize: '13px',
            },
          },
          ACCENT_COLORS.map((c) => h('option', { key: c.id, value: c.id }, c.label)),
        ),
      ),
      // Кнопка сохранения
      h(
        'div',
        { style: { display: 'flex', gap: '12px', alignItems: 'center', marginTop: '6px' } },
        h(
          'button',
          {
            type: 'submit',
            'data-testid': 'personalization-save-btn',
            title: 'Сохранить настройки персонализации',
            'data-tooltip': 'Сохранить настройки персонализации',
            style: {
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary, #2563eb)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            },
          },
          'Сохранить настройки',
        ),
        saveSuccess &&
          h(
            'span',
            {
              'data-testid': 'personalization-save-success',
              style: { fontSize: '13px', color: '#10b981' },
            },
            saveSuccess,
          ),
      ),
    ),
  )
}

export default function registerPersonalizationPlugin(ctx) {
  // 1. Маршрут /nomad-personalization
  ctx.register({
    id: 'route',
    area: ROUTES_AREA,
    data: {
      id: 'nomad.personalization.route',
      path: PERSONALIZATION_ROUTE_PATH,
      title: 'Персонализация',
    },
    render: () => h(PersonalizationTab, { ctx }),
  })

  // 2. Команды палитры (Ctrl+K) — СТРОГО БЕЗ добавления в боковое меню (число строк <= 6)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 67,
    data: {
      id: 'nomad.personalization.open',
      action: 'nomad.personalization.open',
      label: 'Персонализация ассистента',
      category: 'Nomad',
      keywords: ['персонализация', 'имя', 'обращение', 'стиль', 'ответы', 'онбординг', 'personalization'],
      run: () => {
        if (host && typeof host.navigate === 'function') {
          host.navigate(PERSONALIZATION_ROUTE_PATH)
        }
      },
    },
  })
}
