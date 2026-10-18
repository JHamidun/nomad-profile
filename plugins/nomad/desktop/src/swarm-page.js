// M-181: Страница «Рой» в десктопе (/nomad-swarm, UI роя).
// Строит дерево роя с роутов gateway (/swarm, /swarm/tree).
// Вход — строка палитры «Рой» и клик по элементу роя в статус-баре.
// Своей строки меню нет (число строк плагина в боковом меню строго <= 6).

import {
  PALETTE_AREA,
  ROUTES_AREA,
  STATUSBAR_AREAS,
  atom,
  host,
  useValue,
} from '@hermes/plugin-sdk'
import { createElement, useCallback, useEffect, useState } from 'react'

export const SWARM_ROUTE_PATH = '/nomad-swarm'
export const swarmStatusAtom = atom({ count: 0, activeId: null, label: 'Рой: 0' })

const h = createElement

function navigateToSwarm(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === 'function') {
    ctx.host.navigate(SWARM_ROUTE_PATH)
    return
  }
  if (host && typeof host.navigate === 'function') {
    host.navigate(SWARM_ROUTE_PATH)
  }
}

function restGet(ctx, path) {
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(ctx.rest(path, { method: 'GET' }))
  }
  if (typeof ctx?.rest?.get === 'function') {
    return Promise.resolve(ctx.rest.get(path))
  }
  if (typeof fetch === 'function') {
    const normalizedPath = String(path || '').startsWith('/api/plugins/nomad')
      ? String(path).slice('/api/plugins/nomad'.length) || '/'
      : String(path || '').startsWith('/')
        ? String(path)
        : `/${path}`
    return fetch(`/api/plugins/nomad${normalizedPath}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then((r) => (r && r.ok ? r.json() : null))
      .catch(() => null)
  }
  return Promise.resolve(null)
}

export function formatTimeRu(isoString) {
  if (!isoString) return '—'
  try {
    const dt = new Date(isoString)
    return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch (_e) {
    return String(isoString).slice(11, 16) || '—'
  }
}

export function SwarmStatusbarPill({ ctx }) {
  const status = useValue(swarmStatusAtom) || { count: 0, label: 'Рой: 0' }

  useEffect(() => {
    let mounted = true
    restGet(ctx, '/swarm')
      .then((res) => {
        if (!mounted || !res || !res.ok) return
        const count = (res.swarms || []).length
        swarmStatusAtom.set({
          count,
          activeId: res.swarms?.[0]?.id || null,
          label: `Рой: ${count}`,
        })
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [ctx])

  const handleClick = useCallback(() => {
    navigateToSwarm(ctx)
  }, [ctx])

  return h(
    'button',
    {
      type: 'button',
      'data-testid': 'nomad-swarm-statusbar-pill',
      onClick: handleClick,
      style: {
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
      },
    },
    h('span', {
      style: {
        width: '7px',
        height: '7px',
        borderRadius: '50%',
        background: status.count > 0 ? '#10b981' : 'rgba(148, 163, 184, 0.7)',
      },
    }),
    h('span', null, status.label || `Рой: ${status.count}`),
  )
}

export function SwarmTree({ tree = [] }) {
  if (!tree || tree.length === 0) {
    return h(
      'p',
      { 'data-testid': 'swarm-empty-notice', style: { margin: 0, fontSize: '13px', opacity: 0.7 } },
      'Запущенных или сохранённых роёв пока нет. Начните работу в чате с помощью команды оркестратора.',
    )
  }

  return h(
    'div',
    {
      'data-testid': 'swarm-tree-container',
      style: { display: 'flex', flexDirection: 'column', gap: '16px' },
    },
    ...tree.map((node) =>
      h(
        'div',
        {
          key: node.id,
          'data-testid': 'swarm-tree-node',
          style: {
            padding: '16px 20px',
            borderRadius: '10px',
            border: '1px solid var(--border, rgba(128,128,128,0.22))',
            background: 'rgba(128,128,128,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          },
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            h('span', {
              style: {
                display: 'inline-block',
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: node.status === 'completed' ? '#10b981' : '#27272A',
              },
            }),
            h('strong', { style: { fontSize: '14px' } }, node.title || node.goal || node.id),
          ),
          h(
            'span',
            {
              style: {
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '6px',
                background: 'rgba(128,128,128,0.12)',
                fontWeight: 600,
              },
            },
            node.status?.toUpperCase() || 'CREATED',
          ),
        ),
        h(
          'div',
          { style: { fontSize: '12px', opacity: 0.8, display: 'flex', gap: '16px' } },
          h('span', null, `ID: ${node.id}`),
          h('span', null, `Создан: ${formatTimeRu(node.created_at)}`),
          h('span', null, `Режим: ${node.pool_mode || 'shipped'}`),
        ),
        node.children && node.children.length > 0
          ? h(
              'div',
              {
                style: {
                  marginTop: '6px',
                  paddingLeft: '16px',
                  borderLeft: '2px solid rgba(128,128,128,0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                },
              },
              ...node.children.map((child) =>
                h(
                  'div',
                  {
                    key: child.id,
                    'data-testid': 'swarm-child-event',
                    style: { fontSize: '12px', opacity: 0.9 },
                  },
                  `• ${formatTimeRu(child.ts)} · ${child.kind || 'событие'}${
                    child.detail ? ` (${JSON.stringify(child.detail)})` : ''
                  }`,
                ),
              ),
            )
          : null,
      ),
    ),
  )
}

export function SwarmPage({ ctx }) {
  const [data, setData] = useState({ loading: true, error: null, swarms: [], lanes: [], tree: [] })

  const loadSwarmData = useCallback(async () => {
    try {
      const res = await restGet(ctx, '/swarm')
      if (res && res.ok) {
        setData({
          loading: false,
          error: null,
          swarms: res.swarms || [],
          lanes: res.lanes || [],
          tree: res.tree || [],
        })
        swarmStatusAtom.set({
          count: (res.swarms || []).length,
          activeId: res.swarms?.[0]?.id || null,
          label: `Рой: ${(res.swarms || []).length}`,
        })
      } else {
        setData((prev) => ({ ...prev, loading: false }))
      }
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: (err && err.message) || 'Не удалось загрузить данные роя',
      }))
    }
  }, [ctx])

  useEffect(() => {
    loadSwarmData()
  }, [loadSwarmData])

  return h(
    'div',
    {
      'data-testid': 'nomad-swarm-page',
      style: { padding: '24px 32px', maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: '20px' },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        null,
        h('h1', { style: { fontSize: '20px', fontWeight: 600, margin: '0 0 4px 0' } }, 'Рой оркестратора Nomad'),
        h(
          'p',
          { style: { margin: 0, fontSize: '13px', opacity: 0.8 } },
          'Дерево параллельных задач, исполнители дорожек и статус дирижёра.',
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          'data-testid': 'swarm-refresh-btn',
          onClick: loadSwarmData,
          style: {
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid var(--border, rgba(128,128,128,0.3))',
            background: 'transparent',
            color: 'inherit',
            fontSize: '12px',
            cursor: 'pointer',
          },
        },
        'Обновить',
      ),
    ),
    h(
      'section',
      { style: { display: 'flex', flexDirection: 'column', gap: '12px' } },
      h('h2', { style: { fontSize: '15px', fontWeight: 600, margin: 0 } }, 'Дерево роя'),
      h(SwarmTree, { tree: data.tree }),
    ),
    data.lanes && data.lanes.length > 0
      ? h(
          'section',
          { style: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' } },
          h('h2', { style: { fontSize: '15px', fontWeight: 600, margin: 0 } }, 'Дорожки исполнителей (Lanes)'),
          h(
            'table',
            {
              'data-testid': 'swarm-lanes-table',
              style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
            },
            h(
              'thead',
              null,
              h(
                'tr',
                { style: { textAlign: 'left', borderBottom: '1px solid rgba(128,128,128,0.2)' } },
                h('th', { style: { padding: '8px' } }, 'Дорожка'),
                h('th', { style: { padding: '8px' } }, 'Вендор'),
                h('th', { style: { padding: '8px' } }, 'Оплата'),
                h('th', { style: { padding: '8px' } }, 'Статус'),
                h('th', { style: { padding: '8px' } }, 'Окно'),
              ),
            ),
            h(
              'tbody',
              null,
              ...data.lanes.map((l) =>
                h(
                  'tr',
                  { key: l.lane, style: { borderBottom: '1px solid rgba(128,128,128,0.1)' } },
                  h('td', { style: { padding: '8px', fontWeight: 500 } }, l.lane),
                  h('td', { style: { padding: '8px', opacity: 0.8 } }, l.vendor),
                  h('td', { style: { padding: '8px', opacity: 0.8 } }, l.billing),
                  h(
                    'td',
                    { style: { padding: '8px', color: l.alive ? '#10b981' : '#ef4444' } },
                    l.alive ? 'Доступна' : 'Недоступна',
                  ),
                  h('td', { style: { padding: '8px', opacity: 0.8 } }, String(l.window_left ?? '100%')),
                ),
              ),
            ),
          ),
        )
      : null,
  )
}

export default function registerSwarmPagePlugin(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return

  // 1. Маршрут /nomad-swarm
  ctx.register({
    id: 'swarm-route',
    area: ROUTES_AREA,
    order: 70,
    path: SWARM_ROUTE_PATH,
    title: 'Рой',
    data: {
      id: 'nomad.swarm.route',
      path: SWARM_ROUTE_PATH,
      title: 'Рой',
      codicon: 'organization',
      render: () => h(SwarmPage, { ctx }),
    },
    render: () => h(SwarmPage, { ctx }),
  })

  // 2. Строка палитры «Рой» (PALETTE_AREA)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: 70,
    data: {
      id: 'nomad.swarm.open',
      action: 'nomad.swarm.open',
      label: 'Рой оркестратора Nomad',
      category: 'Nomad',
      keywords: ['рой', 'оркестратор', 'дирижёр', 'задачи', 'дерево', 'swarm', 'lanes'],
      run: () => {
        navigateToSwarm(ctx)
      },
    },
  })

  // 3. Элемент роя в статус-баре
  ctx.register({
    id: 'swarm-statusbar',
    area: STATUSBAR_AREAS.right,
    order: 65,
    data: {
      id: 'nomad.swarm.status',
      label: 'Рой: 0',
      to: SWARM_ROUTE_PATH,
      render: () => h(SwarmStatusbarPill, { ctx }),
    },
    render: () => h(SwarmStatusbarPill, { ctx }),
  })
}
