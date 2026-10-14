/**
 * Десктопная половина плагина Nomad — точка входа сборки (M-127).
 *
 * Как это доезжает до покупателя. `hermes profile install` кладёт пакет в
 * `<home>/profiles/nomad/plugins/nomad/`; Electron копирует отсюда `desktop/` в
 * `<home>/desktop-plugins/nomad/` с маркером `.hermes-package.json`
 * (apps/desktop/electron/desktop-plugins-root.ts) и грузит `plugin.js` из blob URL
 * (src/contrib/runtime-loader.ts). Половина единого пакета включается пользователем
 * (opt-in) — так же, как агентская половина через plugins.enabled.
 *
 * `plugin.js` не пишется руками: его собирает `python tools/build_desktop_plugin.py` из
 * этого файла и ВСЕХ `*.js` под `desktop/src/**` (глоб, сортированный путь; файл страницы с
 * другим расширением — `.jsx`, `.ts`, `.mjs` — ошибка сборки, JSX пишется прямо в `.js`).
 * Импортировать можно только `@hermes/plugin-sdk`, `react`, `react/jsx-runtime` и свои
 * относительные модули — остальное загрузчик десктопа отвергнет, поэтому сборка отвергает раньше.
 * Загрузчик ищет импорты регуляркой по всему тексту, поэтому строка интерфейса вида
 * `Import settings from "backup.json"` для него тоже импорт — сборка откажет, текст надо
 * перефразировать. URL и пути (`from "https://…"`, `from "./x"`) он пропускает, сборка тоже.
 * `require()` — даже разрешённых модулей — и `import './x.css'` тоже ошибка сборки: в окне
 * десктопа нет require, а доставляется один `plugin.js` (стили задаются в самом JS). Пространство
 * имён (`import * as React from 'react'`) можно: заглушка загрузчика отдаёт все члены модуля.
 *
 * Контракт страницы (экраны правят только свои файлы, этот — никто, кроме M-127):
 *
 *   // desktop/src/accounts/page.js
 *   import { ROUTES_AREA, SIDEBAR_NAV_AREA } from '@hermes/plugin-sdk'
 *   export default function register(ctx) {
 *     ctx.register({ id: 'page', area: ROUTES_AREA, data: { path: '/nomad-accounts' }, render })
 *     ctx.register({ id: 'nav', area: SIDEBAR_NAV_AREA, order: 60,
 *                    data: { codicon: 'account', label: 'Аккаунты', path: '/nomad-accounts' } })
 *   }
 *
 * - `ctx` — обычный PluginContext десктопа (rest ходит в /api/plugins/nomad/*), но id вкладов
 *   получают префикс пути страницы (`accounts.page:page`): две страницы с одинаковым id не
 *   перетрут друг друга молча.
 * - Модуль без default-экспорта — помощник: он в сборке, но register у него не зовут.
 * - Упавший register страницы не валит соседей: ошибка уходит в console.error и на страницу
 *   состояния `/nomad`. Туда же — экраны бэкенда, которые не смонтировались: `/health` отвечает
 *   200 со `status: 'degraded'` и их списком (ответ >= 400 `ctx.rest` превратил бы в исключение
 *   без тела, и покупатель прочёл бы «сервер не отвечает»).
 * - Пока ни одна страница не объявила строку бокового меню, каркас держит свою строку «Nomad»
 *   на страницу состояния; первая же строка экрана её убирает (правило ui-parity §1а: строк
 *   плагина в меню не больше шести).
 */

import { ROUTES_AREA, SIDEBAR_NAV_AREA, usePluginI18n } from '@hermes/plugin-sdk'
import { useEffect, useState } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'

export const PLUGIN_ID = 'nomad'
export const STATUS_PATH = '/nomad'

const LOCALES = {
  en: {
    status: {
      nav: 'Nomad',
      title: 'Nomad',
      checking: 'Checking the plugin backend…',
      ok: version => `Plugin backend is up · version ${version}`,
      degraded: version => `Plugin backend is up, but not all screens are connected · version ${version}`,
      down: 'Plugin backend is not answering',
      hint: 'Make sure the nomad profile is open and the Nomad plugin is enabled under Plugins, then restart the app.',
      screens: 'Screens',
      none: 'No screens yet',
      problems: 'Problems'
    }
  },
  ru: {
    status: {
      nav: 'Nomad',
      title: 'Nomad',
      checking: 'Проверяем сервер плагина…',
      ok: version => `Сервер плагина отвечает · версия ${version}`,
      degraded: version => `Сервер плагина отвечает, но не все экраны подключились · версия ${version}`,
      down: 'Сервер плагина не отвечает',
      hint: 'Проверьте, что открыт профиль nomad и плагин Nomad включён в разделе «Плагины», затем перезапустите приложение.',
      screens: 'Экраны',
      none: 'Экранов пока нет',
      problems: 'Неполадки'
    }
  }
}

function pageKey(file) {
  return file.replace(/\.js$/, '').split('/').join('.')
}

function errorText(error) {
  return error && error.message ? error.message : String(error)
}

function scopedContext(ctx, key, onNavRow) {
  const scope = contribution => {
    if (contribution.area === SIDEBAR_NAV_AREA) {
      onNavRow()
    }

    return { ...contribution, id: `${key}:${contribution.id}` }
  }

  return {
    ...ctx,
    register: contribution => ctx.register(scope(contribution)),
    registerMany: contributions => ctx.registerMany(contributions.map(scope))
  }
}

function StatusPage({ ctx, problems }) {
  const t = usePluginI18n(PLUGIN_ID)
  const [health, setHealth] = useState({ phase: 'loading' })

  useEffect(() => {
    let alive = true

    ctx.rest('/health').then(
      body => alive && setHealth({ phase: 'ok', body }),
      error => alive && setHealth({ phase: 'down', message: errorText(error) })
    )

    return () => {
      alive = false
    }
  }, [ctx])

  const body = health.phase === 'ok' ? health.body : null
  const screens = body && Array.isArray(body.screens) ? body.screens : []
  const backendErrors = body && body.errors ? Object.entries(body.errors) : []
  const allProblems = [...problems.map(p => [p.file, p.message]), ...backendErrors]

  const healthy = body && body.status === 'ok' && backendErrors.length === 0

  const line =
    health.phase === 'loading'
      ? t('status.checking')
      : !body
        ? t('status.down')
        : healthy
          ? t('status.ok', body.version)
          : t('status.degraded', body.version)

  return jsxs('div', {
    style: { padding: '24px 32px', maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 12 },
    children: [
      jsx('h1', { style: { fontSize: 20, fontWeight: 600, margin: 0 }, children: t('status.title') }),
      jsx('p', { style: { margin: 0 }, children: line }),
      health.phase === 'down' &&
        jsx('p', { style: { margin: 0, opacity: 0.7 }, children: `${health.message}. ${t('status.hint')}` }),
      jsx('h2', { style: { fontSize: 14, fontWeight: 600, margin: '8px 0 0' }, children: t('status.screens') }),
      jsx('p', { style: { margin: 0, opacity: 0.8 }, children: screens.length ? screens.join(', ') : t('status.none') }),
      allProblems.length > 0 &&
        jsx('h2', { style: { fontSize: 14, fontWeight: 600, margin: '8px 0 0' }, children: t('status.problems') }),
      allProblems.length > 0 &&
        jsx('ul', {
          style: { margin: 0, paddingLeft: 18 },
          children: allProblems.map(([where, message]) => jsx('li', { children: `${where}: ${message}` }, where))
        })
    ]
  })
}

/** Собирает HermesPlugin из страниц; `pages` — пары [путь от src/, модуль], их генерирует сборка. */
export function createNomadPlugin(pages) {
  return {
    id: PLUGIN_ID,
    name: 'Nomad',
    description: 'Nomad layer screens and the plugin status page.',
    register(ctx) {
      ctx.i18n.register(LOCALES)
      const problems = []
      let navRows = 0

      for (const [file, mod] of pages) {
        const register = mod.default

        if (register === undefined) {
          continue
        }

        if (typeof register !== 'function') {
          problems.push({ file, message: 'default export is not a register(ctx) function' })
          console.error(`[nomad] ${file}: default export is not a register(ctx) function`)

          continue
        }

        try {
          register(scopedContext(ctx, pageKey(file), () => (navRows += 1)))
        } catch (error) {
          problems.push({ file, message: errorText(error) })
          console.error(`[nomad] ${file} failed to register: ${errorText(error)}`)
        }
      }

      ctx.register({
        id: 'status',
        area: ROUTES_AREA,
        data: { path: STATUS_PATH },
        render: () => jsx(StatusPage, { ctx, problems })
      })

      if (navRows === 0) {
        ctx.register({
          id: 'status-nav',
          area: SIDEBAR_NAV_AREA,
          order: 60,
          data: { codicon: 'pulse', label: ctx.i18n.t('status.nav'), path: STATUS_PATH }
        })
      }
    }
  }
}
