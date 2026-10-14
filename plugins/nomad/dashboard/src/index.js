/**
 * Половина плагина Nomad для веб-дашборда — точка входа сборки (M-127).
 *
 * Дашборд берёт `dashboard/manifest.json`, подключает `entry` (dist/index.js) тегом <script>
 * и ждёт, что скрипт вызовет `window.__HERMES_PLUGINS__.register('nomad', Component)` —
 * иначе плагин помечается NO_REGISTER (web/src/plugins/usePlugins.ts). React и помощники —
 * из `window.__HERMES_PLUGIN_SDK__`, импортов в собранном файле нет.
 *
 * `dist/index.js` не пишется руками: его собирает `python tools/build_desktop_plugin.py` из
 * этого файла и ВСЕХ `*.js` под `dashboard/src/**` (глоб, сортированный путь). Импортировать
 * можно только свои относительные модули; `import './x.css'` — ошибка сборки: доставляется один
 * `dist/index.js`, стили задаются в самом JS.
 *
 * Контракт раздела (экраны правят только свои файлы и manifest.json):
 *
 *   // dashboard/src/accounts-tab.js
 *   export default function register({ sdk, plugins, addSection }) {
 *     const h = sdk.React.createElement
 *     addSection({ id: 'accounts', title: 'Аккаунты', order: 10, component: () => h(AccountsTab) })
 *     plugins.registerSlot('pre-main', 'nomad', Banner)  // слоты — напрямую через реестр
 *   }
 *
 * Страница плагина одна (путь задаёт `tab.path` манифеста); разделы на ней — вкладки. Пока
 * разделов нет, страница показывает состояние бэкенда (/api/plugins/nomad/health), а вкладки
 * в навигации дашборда нет вовсе (`tab.hidden` в манифесте). `/health` отвечает 200 и при
 * несмонтированных экранах (`status: 'degraded'` и их список): `fetchJSON` превращает ответ
 * >= 400 в исключение без тела, и страница сказала бы «сервер не отвечает».
 */

const PLUGIN = 'nomad'
const HEALTH_URL = '/api/plugins/nomad/health'
const HINT = 'Проверьте, что открыт профиль nomad и плагин Nomad включён в разделе «Плагины», затем перезапустите приложение.'

function errorText(error) {
  return error && error.message ? error.message : String(error)
}

/** Регистрирует страницу плагина; `modules` — пары [путь от src/, модуль], их генерирует сборка. */
export function startNomadDashboard(modules) {
  const SDK = window.__HERMES_PLUGIN_SDK__
  const PLUGINS = window.__HERMES_PLUGINS__

  if (!SDK || !PLUGINS) {
    console.error('[nomad] dashboard plugin SDK is not available')

    return
  }

  const h = SDK.React.createElement
  const { useEffect, useState } = SDK.hooks
  const sections = []
  const problems = []
  const api = { sdk: SDK, plugins: PLUGINS, addSection: section => sections.push(section) }

  for (const [file, mod] of modules) {
    const register = mod.default

    if (register === undefined) {
      continue
    }

    if (typeof register !== 'function') {
      problems.push([file, 'default export is not a register(api) function'])
      console.error(`[nomad] ${file}: default export is not a register(api) function`)

      continue
    }

    try {
      register(api)
    } catch (error) {
      problems.push([file, errorText(error)])
      console.error(`[nomad] ${file} failed to register: ${errorText(error)}`)
    }
  }

  sections.sort((a, b) => (a.order ?? 100) - (b.order ?? 100))

  function Status() {
    const [health, setHealth] = useState({ phase: 'loading' })

    useEffect(() => {
      let alive = true

      SDK.fetchJSON(HEALTH_URL).then(
        body => alive && setHealth({ phase: 'ok', body }),
        error => alive && setHealth({ phase: 'down', message: errorText(error) })
      )

      return () => {
        alive = false
      }
    }, [])

    const body = health.phase === 'ok' ? health.body : null
    const errors = body && body.errors ? Object.entries(body.errors) : []
    const line =
      health.phase === 'loading'
        ? 'Проверяем сервер плагина…'
        : !body
          ? `Сервер плагина не отвечает: ${health.message}. ${HINT}`
          : body.status === 'ok' && errors.length === 0
            ? `Сервер плагина отвечает · версия ${body.version}`
            : `Сервер плагина отвечает, но не все экраны подключились · версия ${body.version}`

    return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } }, h('p', null, line), problemList(errors))
  }

  function problemList(items) {
    return items.length > 0 && h('ul', null, ...items.map(([where, message]) => h('li', { key: where }, `${where}: ${message}`)))
  }

  function NomadPage() {
    const [active, setActive] = useState(0)
    const current = sections[Math.min(active, sections.length - 1)]

    return h(
      'div',
      { style: { display: 'flex', flexDirection: 'column', gap: 16, padding: 16 } },
      h('h1', { style: { fontSize: 20, fontWeight: 600 } }, 'Nomad'),
      problemList(problems),
      sections.length > 0 &&
        h(
          'div',
          { role: 'tablist', style: { display: 'flex', gap: 8 } },
          ...sections.map((section, i) =>
            h(
              'button',
              {
                key: section.id,
                role: 'tab',
                'aria-selected': section === current,
                onClick: () => setActive(i),
                style: { fontWeight: section === current ? 600 : 400 }
              },
              section.title
            )
          )
        ),
      current ? h(current.component) : h(Status)
    )
  }

  PLUGINS.register(PLUGIN, NomadPage)
}
