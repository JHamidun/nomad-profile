import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
  atom,
  host,
  useValue,
} from '@hermes/plugin-sdk'

export const SIMULATOR_PATH = '/nomad-simulator'
export const SIMULATOR_NAV_LABEL = 'Симулятор ИИ'
export const SIMULATOR_NAV_CODICON = 'mortar-board'
export const SIMULATOR_NAV_ORDER = 65
export const SIMULATOR_PERSONA_KEY = 'simulator'
export const SIMULATOR_SESSION_SOURCE = 'simulator'
export const SIMULATOR_SESSION_TITLE = 'Симулятор ИИ'
export const MAX_SIDEBAR_NAV_ITEMS = 6

// Три служебные сессии, которые скрываются из раздела «Недавние» настройкой профиля (без патча ядра).
export const SERVICE_SESSION_SOURCES = ['cron', 'subagent', 'tool']
export const INTERNAL_LISTING_SOURCES = ['kanban', 'tool', 'oneshot']

// Шесть канонических строк плагина Nomad в боковом меню десктопа (M-207a, M-154, D09):
// N1 Аккаунты, N4 Навыки Nomad, N5 Безопасность, N6 Данные и место, N7 Перенос и старт, U8 Симулятор ИИ.
export const NOMAD_SIDEBAR_NAV_SPECS = [
  {
    id: 'accounts',
    code: 'N1',
    label: 'Аккаунты',
    path: '/nomad-accounts',
    codicon: 'account',
    order: 60,
  },
  {
    id: 'skills',
    code: 'N4',
    label: 'Навыки Nomad',
    path: '/nomad-skills',
    codicon: 'extensions',
    order: 61,
  },
  {
    id: 'safety',
    code: 'N5',
    label: 'Безопасность',
    path: '/nomad-safety',
    codicon: 'shield',
    order: 62,
  },
  {
    id: 'data',
    code: 'N6',
    label: 'Данные и место',
    path: '/nomad-data',
    codicon: 'database',
    order: 63,
  },
  {
    id: 'start',
    code: 'N7',
    label: 'Перенос и старт',
    path: '/nomad-start',
    codicon: 'rocket',
    order: 64,
  },
  {
    id: 'simulator',
    code: 'U8',
    label: SIMULATOR_NAV_LABEL,
    path: SIMULATOR_PATH,
    codicon: SIMULATOR_NAV_CODICON,
    order: SIMULATOR_NAV_ORDER,
  },
]

export const SIMULATOR_TRACKS = [
  {
    id: 'founder',
    label: 'Основатель',
    summary: 'Проверка продуктовых гипотез, сборка MVP, лендингов и расчёт экономики без штата разработчиков.',
    firstMission: 'Собрать интерактивный калькулятор юнит-экономики и посадочную страницу для вашего продукта.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Основатель» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу предложите первую практическую микро-миссию.',
  },
  {
    id: 'marketer',
    label: 'Маркетолог',
    summary: 'Контент-конвейеры, посадочные страницы, лид-магниты и автоматическая аналитика кампаний.',
    firstMission: 'Собрать генератор мультиформатного контент-плана и интерактивный квиз для лидов.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Маркетолог» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'product',
    label: 'Продакт',
    summary: 'Живые прототипы функций, разбор обратной связи пользователей, PRD и быстрые эксперименты.',
    firstMission: 'Превратить сырые заметки интервью в кликабельный прототип новой функции.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Продакт» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'project',
    label: 'Проджект',
    summary: 'Контроль сроков, автоматическая сводка статусов, управление рисками и прозрачные отчёты.',
    firstMission: 'Настроить автоматический сборщик недельного отчёта и детектор блокеров по задачам.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Проджект» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'analyst',
    label: 'Аналитик',
    summary: 'Очистка выгрузок, SQL/Python-пайплайны, наглядные дашборды и проверка гипотез на данных.',
    firstMission: 'Построить воспроизводимый пайплайн очистки CSV-выгрузки с интерактивным отчётом.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Аналитик» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'designer',
    label: 'Дизайнер',
    summary: 'Живые UI-компоненты, токены дизайн-системы, анимации и проверка сценариев в коде.',
    firstMission: 'Собрать интерактивную витрину компонентов с переключением состояний и темы.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Дизайнер» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'hr',
    label: 'HR',
    summary: 'Профили ролей, разбор резюме, планы адаптации новичков и внутренняя база знаний.',
    firstMission: 'Собрать интерактивный чек-лист онбординга и матрицу оценки кандидатов под вашу вакансию.',
    kickoff:
      'Здравствуйте! Я выбираю трек «HR» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'sales',
    label: 'Продажи',
    summary: 'Персонализация коммерческих предложений, подготовка к встречам и автоматизация CRM-рутины.',
    firstMission: 'Собрать генератор персонального коммерческого предложения по карточке клиента.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Продажи» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
  {
    id: 'operations',
    label: 'Операции',
    summary: 'Регламенты, сверка таблиц, связка внутренних сервисов и устранение ручных операций.',
    firstMission: 'Автоматизировать сверку регулярных таблиц и выпуск операционной сводки без ручного копирования.',
    kickoff:
      'Здравствуйте! Я выбираю трек «Операции» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию.',
  },
]

export const SIMULATOR_SCENARIOS = [
  {
    id: 'prompting',
    title: 'Точный промптинг и постановка задачи',
    description:
      'Научитесь формулировать контекст, критерии приёмки и ограничения так, чтобы агент выдавал готовый результат с первого шага.',
    kickoff:
      'Здравствуйте! Хочу потренировать навык точной постановки задач агенту в «Симуляторе ИИ». Поприветствуйте меня как ментор и предложите первую короткую миссию.',
  },
  {
    id: 'automation',
    title: 'Автоматизация рутины и расписаний',
    description:
      'Соберите собственный рабочий конвейер: разбор файлов, проверка данных и регулярные отчёты по расписанию.',
    kickoff:
      'Здравствуйте! Хочу освоить автоматизацию рутины и регулярных задач в «Симуляторе ИИ». Поприветствуйте меня как ментор и предложите первую практическую миссию.',
  },
  {
    id: 'swarm',
    title: 'Управление роем параллельных агентов',
    description:
      'Разделите крупную задачу на независимые дорожки роя, проверьте результаты и соберите итоговое решение.',
    kickoff:
      'Здравствуйте! Хочу научиться запускать параллельный рой агентов в «Симуляторе ИИ». Поприветствуйте меня как ментор и начните первую миссию по работе с роем.',
  },
]

export const SIMULATOR_KICKOFF =
  'Здравствуйте! Запускаю «Симулятор ИИ». Поприветствуйте меня как ведущий курса в двух предложениях и предложите выбрать один из 9 треков роли (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции) в столбик по одному на строке — без вызова инструментов и чтения файлов, сразу живым ответом.'

export const SIMULATOR_PERSONA = [
  'Вы — ведущий интерактивного курса «Симулятор ИИ» в Nomad (навык vibecoding-course): практичный, доброжелательный и структурный ИИ-ментор, который обучает пользователя вайбкодингу, точной постановке задач, автоматизации и работе с роем агентов на реальных микро-миссиях.',
  'Обращайтесь к пользователю строго на «вы» (уважительно, живо и по делу, без канцелярита и без панибратского «ты»). Вы ведёте занятие, предлагаете конкретные шаги и помогаете довести каждую миссию до осязаемого результата в рабочей папке проекта.',
  'ПРАВИЛО ПЕРВОГО ОТВЕТА (высший приоритет): На самое первое сообщение пользователя в новой сессии ответьте МГНОВЕННО — без вызова каких-либо инструментов и без чтения диска. Ваш первый ответ — это тёплое приветствие в 1–2 предложениях и список из 9 ролевых треков в столбик (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции), чтобы пользователь сразу выбрал близкую ему роль.',
  'ПРАВИЛО ВТОРОГО И ПОСЛЕДУЮЩИХ ХОДОВ: Как только пользователь ответил на приветствие, сразу зафиксируйте наиболее подходящий трек (по умолчанию Основатель) и запустите Миссию 1 этого трека. Никогда не просите пользователя самостоятельно придумывать сценарий — предлагайте готовый шаг и критерий проверки.',
].join('\n\n')

export const simulatorStateAtom = atom({
  status: 'idle',
  lastSessionId: null,
  selectedTrackId: null,
  error: null,
})

function sanitizeWhiteLabel(text) {
  return String(text || '').replace(/hermes/gi, 'Nomad')
}

function isRealPromise(candidate) {
  return Boolean(candidate && typeof candidate.then === 'function')
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function resolveKickoffText(trackOrScenarioId) {
  if (!trackOrScenarioId) {
    return SIMULATOR_KICKOFF
  }
  const needle = String(trackOrScenarioId).trim().toLowerCase()
  const track = SIMULATOR_TRACKS.find(
    item => item.id === needle || item.label.toLowerCase() === needle,
  )
  if (track) {
    return track.kickoff
  }
  const scenario = SIMULATOR_SCENARIOS.find(
    item => item.id === needle || item.title.toLowerCase() === needle,
  )
  if (scenario) {
    return scenario.kickoff
  }
  return SIMULATOR_KICKOFF
}

export function filterRecentSessionsBySetting(sessions, settings = {}) {
  const showSubagents = Boolean(settings?.sessions?.show_subagents)
  const excluded = new Set(['cron', 'tool', ...INTERNAL_LISTING_SOURCES, SIMULATOR_SESSION_SOURCE])
  if (!showSubagents) {
    excluded.add('subagent')
  }
  const extra = settings?.sessions?.exclude_sources
  if (Array.isArray(extra)) {
    for (const src of extra) {
      const normalized = String(src || '').trim().toLowerCase()
      if (normalized && !(normalized === 'subagent' && showSubagents)) {
        excluded.add(normalized)
      }
    }
  }
  if (!Array.isArray(sessions)) {
    return []
  }
  return sessions.filter(row => {
    if (!row || typeof row !== 'object') {
      return false
    }
    if (row.hidden) {
      return false
    }
    const src = String(row.source || '').trim().toLowerCase()
    return !excluded.has(src)
  })
}

export function countNomadSidebarRows(contributions) {
  if (!Array.isArray(contributions)) {
    return 0
  }
  return contributions.filter(c => c && c.area === SIDEBAR_NAV_AREA).length
}

export function assertNomadSidebarRowCap(contributions, maxRows = MAX_SIDEBAR_NAV_ITEMS) {
  const count = countNomadSidebarRows(contributions)
  if (count > maxRows) {
    throw new Error(
      `Превышен потолок строк плагина Nomad в боковом меню: ${count} > ${maxRows} (M-207a).`,
    )
  }
  return count
}

/**
 * Создаёт учебную сессию «Симулятора ИИ», устанавливает ей персону ментора
 * через штатный `config.set` и запускает первое сообщение курса.
 */
export async function startSimulatorChat(hostApi = host, options = {}) {
  if (!hostApi || typeof hostApi.request !== 'function') {
    return null
  }

  const kickoffText = options.kickoff || resolveKickoffText(options.trackId)
  const mentorPrompt = options.personaPrompt || SIMULATOR_PERSONA

  // Проверка на стаб-окружение (DESKTOP_HARNESS в test_ui_delivery.py возвращает Proxy без .then).
  const firstProbe = hostApi.request('config.set', {
    key: 'personality',
    value: SIMULATOR_PERSONA_KEY,
  })
  if (!isRealPromise(firstProbe)) {
    return null
  }

  simulatorStateAtom.set({
    ...simulatorStateAtom.get(),
    status: 'starting',
    selectedTrackId: options.trackId || null,
    error: null,
  })

  try {
    // 1. Активируем персону ментора из config.yaml (personalities.simulator) до создания агента;
    //    если профиль ещё не содержал записи personalities.simulator, ставим custom_prompt.
    try {
      await firstProbe
    } catch {
      await hostApi
        .request('config.set', {
          key: 'prompt',
          value: mentorPrompt,
        })
        .catch(() => undefined)
    }

    // 2. Создаём учебную сессию со служебным источником simulator и hidden: true,
    //    чтобы она не засоряла обычные «Недавние».
    const created = await hostApi.request('session.create', {
      title: SIMULATOR_SESSION_TITLE,
      source: SIMULATOR_SESSION_SOURCE,
      hidden: true,
    })

    const runtimeSessionId =
      created && typeof created.session_id === 'string' ? created.session_id : ''
    const storedSessionId =
      created && typeof created.stored_session_id === 'string' && created.stored_session_id
        ? created.stored_session_id
        : runtimeSessionId

    if (!runtimeSessionId) {
      return null
    }

    // 3. Привязываем персону ментора непосредственно к созданной сессии.
    try {
      await hostApi.request('config.set', {
        key: 'personality',
        value: SIMULATOR_PERSONA_KEY,
        session_id: runtimeSessionId,
      })
    } catch {
      await hostApi
        .request('config.set', {
          key: 'prompt',
          value: mentorPrompt,
          session_id: runtimeSessionId,
        })
        .catch(() => undefined)
    }

    if (options.storage && typeof options.storage.set === 'function') {
      try {
        options.storage.set('lastSimulatorSessionId', storedSessionId)
      } catch {
        // ignore storage errors
      }
    }

    // 4. Открываем сессию в основном окне чата десктопа.
    let openedViaSdk = false
    if (typeof hostApi.openSession === 'function') {
      try {
        const openResult = hostApi.openSession(storedSessionId, {
          awaitHydration: true,
          expectHistory: false,
          hydrationTimeoutMs: 12000,
        })
        if (isRealPromise(openResult)) {
          await openResult
          openedViaSdk = true
        }
      } catch {
        try {
          const fallbackOpen = hostApi.openSession(storedSessionId)
          if (isRealPromise(fallbackOpen)) {
            await fallbackOpen
          }
          openedViaSdk = true
        } catch {
          openedViaSdk = false
        }
      }
    }

    if (!openedViaSdk && typeof hostApi.navigate === 'function') {
      hostApi.navigate(`/${encodeURIComponent(storedSessionId)}`)
    } else if (
      typeof window !== 'undefined' &&
      window.location &&
      typeof window.location.hash === 'string' &&
      !window.location.hash.includes(encodeURIComponent(storedSessionId))
    ) {
      window.location.hash = `#/${encodeURIComponent(storedSessionId)}`
    }

    // 5. Отправляем стартовый запрос ментору через активный композер чата (чтобы стрим
    //    отображался в живом треде) с резервным вызовом prompt.submit по JSON-RPC.
    let submittedByComposer = false
    if (hostApi.composer && typeof hostApi.composer.submit === 'function') {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          if (
            hostApi.composer.submit(storedSessionId, kickoffText) ||
            hostApi.composer.submit(null, kickoffText)
          ) {
            submittedByComposer = true
            break
          }
        } catch {
          // wait for composer mount
        }
        await sleep(50)
      }
    }

    if (!submittedByComposer) {
      await hostApi.request('prompt.submit', {
        session_id: runtimeSessionId,
        text: kickoffText,
      })
      if (typeof hostApi.openSession === 'function') {
        try {
          const refreshPromise = hostApi.openSession(storedSessionId, {
            awaitHydration: true,
            expectHistory: true,
            forceResume: true,
            hydrationTimeoutMs: 10000,
          })
          if (isRealPromise(refreshPromise)) {
            await refreshPromise
          }
        } catch {
          // best-effort refresh
        }
      }
    }

    simulatorStateAtom.set({
      status: 'ready',
      lastSessionId: storedSessionId,
      selectedTrackId: options.trackId || null,
      error: null,
    })

    return {
      sessionId: runtimeSessionId,
      storedSessionId,
      kickoffText,
    }
  } catch (err) {
    const cleanMessage = sanitizeWhiteLabel(err?.message || err)
    simulatorStateAtom.set({
      ...simulatorStateAtom.get(),
      status: 'error',
      error: cleanMessage,
    })
    return null
  }
}

export async function continueSimulatorChat(hostApi = host, storage = null) {
  const savedId =
    (storage && typeof storage.get === 'function'
      ? storage.get('lastSimulatorSessionId', null)
      : null) || simulatorStateAtom.get().lastSessionId

  if (savedId && typeof hostApi?.openSession === 'function') {
    try {
      const res = hostApi.openSession(savedId, {
        awaitHydration: true,
        expectHistory: true,
        forceResume: true,
        hydrationTimeoutMs: 10000,
      })
      if (isRealPromise(res)) {
        await res
      }
      return savedId
    } catch {
      // fall through to new simulator chat
    }
  }
  const created = await startSimulatorChat(hostApi, { storage })
  return created ? created.storedSessionId : null
}

let autoLaunchInFlight = false

export function SimulatorPage({ ctx }) {
  const simState = useValue(simulatorStateAtom)
  const [activeTrack, setActiveTrack] = useState('founder')

  const savedSessionId = useMemo(() => {
    try {
      return (
        ctx?.storage?.get?.('lastSimulatorSessionId', null) ||
        simState.lastSessionId ||
        null
      )
    } catch {
      return simState.lastSessionId || null
    }
  }, [ctx, simState.lastSessionId])

  const handleStart = useCallback(
    (trackId = null) => {
      startSimulatorChat(host, {
        trackId,
        storage: ctx?.storage,
      })
    },
    [ctx],
  )

  const handleContinue = useCallback(() => {
    continueSimulatorChat(host, ctx?.storage)
  }, [ctx])

  // При переходе по пункту меню «Симулятор ИИ» сразу открываем чат с персоной ментора (M-154).
  useEffect(() => {
    if (autoLaunchInFlight) {
      return
    }
    autoLaunchInFlight = true
    Promise.resolve(
      startSimulatorChat(host, {
        storage: ctx?.storage,
      }),
    ).finally(() => {
      setTimeout(() => {
        autoLaunchInFlight = false
      }, 300)
    })
  }, [ctx])

  return (
    <div
      data-testid="nomad-simulator-page"
      style={{
        padding: '28px 32px',
        maxWidth: 960,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Симулятор ИИ</h1>
          <span
            data-testid="simulator-recents-filter-badge"
            style={{
              fontSize: 12,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#10b981',
              fontWeight: 500,
            }}
          >
            Служебные сессии скрыты из «Недавних» настройкой
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }}>
          Учитесь вайбкодингу и управлению агентами вместе с ведущим курса: выберите вашу роль,
          проходите практические миссии и собирайте рабочие инструменты прямо в чате.
        </p>
      </header>

      <section
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
          padding: '16px 20px',
          borderRadius: 12,
          border: '1px solid rgba(148, 163, 184, 0.22)',
          background: 'rgba(15, 23, 42, 0.25)',
        }}
      >
        <button
          type="button"
          data-testid="simulator-start-btn"
          onClick={() => handleStart(activeTrack)}
          disabled={simState.status === 'starting'}
          style={{
            padding: '10px 18px',
            borderRadius: 8,
            border: 'none',
            background: '#2563eb',
            color: '#ffffff',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          {simState.status === 'starting' ? 'Запускаем чат с ментором…' : 'Начать курс'}
        </button>

        {savedSessionId && (
          <button
            type="button"
            data-testid="simulator-continue-btn"
            onClick={handleContinue}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid rgba(148, 163, 184, 0.35)',
              background: 'transparent',
              color: 'inherit',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Продолжить вашу сессию
          </button>
        )}

        <span style={{ fontSize: 13, opacity: 0.75 }}>
          Откроется диалог с персональным ИИ-ментором, где первый ответ сразу предложит трек и миссию.
        </span>
      </section>

      {simState.error && (
        <div
          role="status"
          data-testid="simulator-error"
          style={{
            padding: '12px 16px',
            borderRadius: 8,
            border: '1px solid rgba(239, 68, 68, 0.4)',
            background: 'rgba(239, 68, 68, 0.1)',
            fontSize: 13,
          }}
        >
          Не удалось автоматически открыть чат с ментором: {simState.error}. Нажмите «Начать курс», чтобы повторить попытку.
        </div>
      )}

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Выберите трек под вашу роль (9 направлений)</h2>
        <div
          data-testid="simulator-tracks-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {SIMULATOR_TRACKS.map(track => {
            const selected = activeTrack === track.id
            return (
              <button
                key={track.id}
                type="button"
                data-testid={`simulator-track-${track.id}`}
                onClick={() => {
                  setActiveTrack(track.id)
                  handleStart(track.id)
                }}
                style={{
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: selected
                    ? '1px solid #3b82f6'
                    : '1px solid rgba(148, 163, 184, 0.2)',
                  background: selected
                    ? 'rgba(59, 130, 246, 0.12)'
                    : 'rgba(15, 23, 42, 0.18)',
                  color: 'inherit',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600 }}>{track.label}</span>
                <span style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.4 }}>{track.summary}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Практические сценарии тренажёра</h2>
        <div
          data-testid="simulator-scenarios-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 12,
          }}
        >
          {SIMULATOR_SCENARIOS.map(scenario => (
            <button
              key={scenario.id}
              type="button"
              data-testid={`simulator-scenario-${scenario.id}`}
              onClick={() => handleStart(scenario.id)}
              style={{
                textAlign: 'left',
                padding: '14px 16px',
                borderRadius: 10,
                border: '1px solid rgba(148, 163, 184, 0.2)',
                background: 'rgba(15, 23, 42, 0.18)',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600 }}>{scenario.title}</span>
              <span style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.4 }}>
                {scenario.description}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function register(ctx) {
  // 1. Страница «Симулятор ИИ» (/nomad-simulator)
  ctx.register({
    id: 'page',
    area: ROUTES_AREA,
    data: {
      path: SIMULATOR_PATH,
    },
    render: () => <SimulatorPage ctx={ctx} />,
  })

  // 2. Шестой пункт бокового меню «Симулятор ИИ» (U8, order: 65)
  ctx.register({
    id: 'nav',
    area: SIDEBAR_NAV_AREA,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: 'nomad.simulator.nav',
      codicon: SIMULATOR_NAV_CODICON,
      label: SIMULATOR_NAV_LABEL,
      path: SIMULATOR_PATH,
      order: SIMULATOR_NAV_ORDER,
    },
  })

  // 3. Команда палитры (Ctrl+K)
  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: 'nomad.simulator.open',
      action: 'nomad.simulator.open',
      label: SIMULATOR_NAV_LABEL,
      category: 'Nomad',
      keywords: ['симулятор', 'ментор', 'курс', 'вайбкодинг', 'обучение', 'simulator'],
      run: () => {
        if (typeof host?.navigate === 'function') {
          host.navigate(SIMULATOR_PATH)
        }
        startSimulatorChat(host, { storage: ctx?.storage })
      },
    },
  })
}
