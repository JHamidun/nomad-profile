/**
 * Регистрация русского словаря локализации плагина Nomad через `ctx.i18n.register({ ru })` (M-153, U2).
 *
 * Все строки оформлены с вежливым обращением на «вы» (D10) и заскоуплены внутри пространства
 * плагина `nomad` (`usePluginI18n('nomad')`).
 */

import ruCatalog from './i18n/ru.json'

const STATUS_FALLBACK_RU = {
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

export const ru = {
  ...ruCatalog,
  status: STATUS_FALLBACK_RU
}

export default function registerNomadI18n(ctx) {
  if (!ctx || !ctx.i18n || typeof ctx.i18n.register !== 'function') {
    return
  }

  ctx.i18n.register({ ru })
}
