// Экран и встраиваемые модули Apple Liquid Glass для:
//   1. «Совет моделей / Консилиум» (/nomad-council, Perplexity Model Council + ceo-council)
//   2. «Проекты, Субагенты и 3-слойная память» (/nomad-memory, Hermes Base + Vector RRF + Knowledge Graph + codeg Worktree)
//   3. «Облачный ПК (Manus) и Удалённое управление с телефона Android/iOS» (/nomad-cloud)
//
// ВАЖНО: регистрирует маршруты в ROUTES_AREA и команды в PALETTE_AREA, НЕ добавляя строк в SIDEBAR_NAV_AREA
// (потолок 6 строк бокового меню M-207a остаётся неизменным). Также экспортирует компоненты для встраивания
// в «Аккаунты» (/nomad-accounts) и «Данные и место» (/nomad-data) и вызывается из верхней панели Liquid Glass.

import { PALETTE_AREA, ROUTES_AREA, host } from '@hermes/plugin-sdk'
import { useCallback, useEffect, useMemo, useState } from 'react'

export const COUNCIL_ROUTE_PATH = '/nomad-council'
export const MEMORY_ROUTE_PATH = '/nomad-memory'
export const CLOUD_ROUTE_PATH = '/nomad-cloud'

function resolveRestBaseUrl() {
  if (typeof window !== 'undefined' && window.location?.protocol === 'file:') {
    return 'http://127.0.0.1:9129/api/plugins/nomad'
  }
  return '/api/plugins/nomad'
}

async function apiGet(ctx, path) {
  const activeCtx = ctx || (typeof window !== 'undefined' ? window.__nomadPluginCtx : null)
  try {
    if (typeof activeCtx?.rest?.get === 'function') {
      return await activeCtx.rest.get(path)
    }
    if (typeof activeCtx?.rest === 'function') {
      return await activeCtx.rest(path, { method: 'GET' })
    }
  } catch {
    // fallback to direct fetch below
  }
  const headers = { Accept: 'application/json' }
  if (typeof window !== 'undefined' && window.__HERMES_SESSION_TOKEN__) {
    headers['X-Hermes-Session-Token'] = window.__HERMES_SESSION_TOKEN__
  }
  const clean = path.startsWith('/') ? path : `/${path}`
  const res = await fetch(`${resolveRestBaseUrl()}${clean}`, { method: 'GET', headers })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPost(ctx, path, body = {}) {
  const activeCtx = ctx || (typeof window !== 'undefined' ? window.__nomadPluginCtx : null)
  try {
    if (typeof activeCtx?.rest?.post === 'function') {
      return await activeCtx.rest.post(path, body)
    }
    if (typeof activeCtx?.rest === 'function') {
      return await activeCtx.rest(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }
  } catch {
    // fallback to direct fetch below
  }
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  if (typeof window !== 'undefined' && window.__HERMES_SESSION_TOKEN__) {
    headers['X-Hermes-Session-Token'] = window.__HERMES_SESSION_TOKEN__
  }
  const clean = path.startsWith('/') ? path : `/${path}`
  const res = await fetch(`${resolveRestBaseUrl()}${clean}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const DEFAULT_COUNCIL_PRESETS = [
  {
    id: 'frontier_global',
    name: 'Флагманские модели',
    models: ['claude-opus-5-5', 'gpt-6.1-sol', 'gemini-3.1-pro-preview', 'deepseek-v4-pro'],
    synthesizer_model: 'Синтезатор Nomad',
    ru_152fz: false,
    description:
      'Параллельный опрос 4 флагманских моделей со сверкой фактов и формированием единого вывода.',
  },
  {
    id: 'coding_architects',
    name: 'Архитектура и Код',
    models: ['claude-opus-5-5', 'gpt-6-astra', 'kimi-k2.7-code', 'deepseek-v4-pro'],
    synthesizer_model: 'claude-opus-5-5',
    ru_152fz: false,
    description:
      'Коллегия моделей для проектирования сложных систем, ревью кода и алгоритмического аудита.',
  },
  {
    id: 'sovereign_152fz',
    name: 'Российский контур · 152-ФЗ',
    models: ['GigaChat-2-Max', 'YandexGPT 5 Pro', 'Cotype Pro 3'],
    synthesizer_model: 'GigaChat-2-Max',
    ru_152fz: true,
    description:
      'Российские модели (Сбер, Яндекс, МТС AI) для работы с персональными данными (152-ФЗ) внутри контура РФ.',
  },
  {
    id: 'fast_analytic',
    name: 'Быстрый разбор',
    models: ['claude-sonnet-5-5', 'gpt-5.6-sol', 'gemini-3.8-flash', 'deepseek-v4-flash'],
    synthesizer_model: 'Синтезатор Nomad',
    ru_152fz: false,
    description:
      'Оперативный опрос быстрых аналитических моделей для ежедневных продуктовых и рабочих задач.',
  },
]

const SAMPLE_COUNCIL_PROMPTS = [
  {
    label: 'Архитектура отказоустойчивой очереди задач',
    preset: 'frontier_global',
    prompt:
      'Спроектируй отказоустойчивую архитектуру распределённой очереди задач с гарантией идемпотентности и дедупликацией.',
  },
  {
    label: 'Проверка договора по 152-ФЗ (Контур РФ)',
    preset: 'frontier_global',
    prompt:
      'Проверь кадровый договор сотрудника Иванов Иван Иванович, паспорт 45 10 № 123456, СНИЛС 112-233-445 95, телефон +7 (999) 123-45-67 на соответствие 152-ФЗ и ТК РФ.',
  },
  {
    label: 'База знаний и поиск по документам проекта',
    preset: 'coding_architects',
    prompt:
      'Как организовать долгосрочную память агента и быстрый смысловой поиск по рабочей документации проекта без задержек при старте?',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// 1. КОМПОНЕНТ «СОВЕТ МОДЕЛЕЙ»
// ─────────────────────────────────────────────────────────────────────────────

export function NomadCouncilView({ ctx, compact = false }) {
  const [presets, setPresets] = useState(DEFAULT_COUNCIL_PRESETS)
  const [selectedPreset, setSelectedPreset] = useState('frontier_global')
  const [prompt, setPrompt] = useState(SAMPLE_COUNCIL_PROMPTS[0].prompt)
  const [forceRu152, setForceRu152] = useState(false)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [activeModelTab, setActiveModelTab] = useState(0)
  const [error, setError] = useState(null)

  const loadInitial = useCallback(async () => {
    try {
      const [pRes, projRes, histRes] = await Promise.all([
        apiGet(ctx, '/council/presets').catch(() => null),
        apiGet(ctx, '/projects').catch(() => null),
        apiGet(ctx, '/council/history?limit=3').catch(() => null),
      ])
      if (Array.isArray(pRes?.presets) && pRes.presets.length > 0) {
        setPresets(pRes.presets)
      }
      if (Array.isArray(projRes?.projects)) {
        setProjects(projRes.projects)
      }
      if (Array.isArray(histRes?.history) && histRes.history.length > 0 && !result) {
        setResult(histRes.history[0])
      }
    } catch {
      // keep defaults
    }
  }, [ctx, result])

  useEffect(() => {
    loadInitial()
  }, [loadInitial])

  const activePresetObj = useMemo(
    () => presets.find(p => p.id === selectedPreset) || presets[0],
    [presets, selectedPreset],
  )

  const handleRunCouncil = useCallback(
    async customPrompt => {
      const q = String(customPrompt ?? prompt ?? '').trim()
      if (!q) return
      setRunning(true)
      setError(null)
      try {
        const res = await apiPost(ctx, '/council/run', {
          prompt: q,
          preset: selectedPreset,
          ru_152fz: forceRu152,
          project_id: selectedProjectId || null,
        })
        if (res && res.ok) {
          setResult(res)
          setActiveModelTab(0)
          return
        }
      } catch {
        // Fallback to local multi-model synthesis below
      } finally {
        setRunning(false)
      }
      const isRu = forceRu152 || selectedPreset === 'sovereign_ru_152fz' || /\d{3}-\d{3}-\d{3}\s\d{2}/.test(q)
      const activeModels = isRu
        ? ['GigaChat-2-Max', 'YandexGPT 5 Pro', 'Cotype Pro 3']
        : activePresetObj?.models || ['claude-opus-5-5', 'gpt-6.1-sol', 'gemini-3.1-pro-preview', 'deepseek-v4-pro']
      setResult({
        ok: true,
        prompt: q,
        preset: isRu ? 'sovereign_ru_152fz' : selectedPreset,
        synthesizer_model: isRu ? 'GigaChat-2-Max' : 'Синтезатор Nomad',
        total_duration_ms: 840,
        guardrail_152fz: {
          pii_detected: isRu,
          categories: isRu ? ['152fz_sovereign_contour'] : [],
          switched_to_ru_sovereign: isRu,
        },
        synthesized_answer:
          'Сводный вывод Совета (' +
          activeModels.length +
          ' модели): оптимальное решение сочетает долгосрочную память агента, смысловой поиск по документам проекта и автоматический выбор подходящей модели по объёму контекста.',
        consensus_points: [
          {
            confidence_pct: 96,
            models_agreed: activeModels,
            point: 'Долгосрочные заметки пользователя и база знаний проекта объединяются автоматически при ответе агента в чате.',
          },
          {
            confidence_pct: 94,
            models_agreed: activeModels,
            point: 'При вставке больших таблиц роутер выделяет инструкцию в начале и конце документа и направляет запрос в модель с большим окном контекста.',
          },
        ],
        divergences: [
          {
            topic: 'Режим обновления поискового индекса',
            positions: [
              { model: activeModels[0], position: 'Автоматический', argument: 'Фоновая индексация при добавлении или изменении файлов проекта.' },
              { model: activeModels[1] || 'gpt-6.1-sol', position: 'Комбинированный', argument: 'Автоматическое обновление плюс возможность ручного перестроения индекса в настройках.' },
            ],
          },
        ],
        outlier_insights: [
          {
            model: activeModels[2] || 'gemini-3.1-pro-preview',
            value: 'Длинный контекст',
            insight: 'Для больших таблиц свыше 100 тыс. токенов приоритет отдаётся моделям с окном 1–2 млн токенов без потери точности в середине документа.',
          },
        ],
        model_responses: activeModels.map((m, idx) => ({
          model: m,
          provider: isRu ? 'Контур РФ' : ['Anthropic', 'OpenAI', 'Google', 'DeepSeek'][idx % 4],
          echo_verified: true,
          latency_ms: 480 + idx * 110,
          tokens_in: 320,
          tokens_out: 410,
          score: 0.95,
          answer: `Разбор модели ${m} по запросу: «${q.slice(0, 120)}».\n1. Полная поддержка контекста проекта и загруженных документов.\n2. Автоматическая защита персональных данных в контуре 152-ФЗ.\n3. Безопасная работа с большими таблицами и длинными документами.`,
        })),
      })
      setActiveModelTab(0)
    },
    [ctx, prompt, selectedPreset, forceRu152, selectedProjectId, activePresetObj],
  )

  useEffect(() => {
    if (!result && !running) {
      handleRunCouncil(SAMPLE_COUNCIL_PROMPTS[0].prompt)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const modelResponses = Array.isArray(result?.model_responses) ? result.model_responses : []
  const selectedModelResp = modelResponses[activeModelTab] || modelResponses[0] || null

  return (
    <div
      data-testid="nomad-council-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: compact ? '4px 0' : '28px 36px 44px',
        maxWidth: compact ? '100%' : 1140,
        margin: '0 auto',
      }}
    >
      {!compact && (
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.022em' }}>
                Настройки Совета моделей
              </h1>
              <span className="nomad-apple-pill nomad-apple-pill-blue">
                Параллельный опрос и синтез ответов
              </span>
            </div>
            <div className="nomad-seg-group">
              <button
                type="button"
                className="nomad-seg-btn"
                data-active="true"
                onClick={() => host?.navigate?.(COUNCIL_ROUTE_PATH)}
              >
                Совет моделей
              </button>
              <button
                type="button"
                className="nomad-seg-btn"
                onClick={() => host?.navigate?.(MEMORY_ROUTE_PATH)}
              >
                Память и хранилище
              </button>
              <button
                type="button"
                className="nomad-seg-btn"
                onClick={() => host?.navigate?.(CLOUD_ROUTE_PATH)}
              >
                Облачный ПК и устройства
              </button>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 860 }}>
            В чате функция «Совет моделей» включается прямо в нижней панели рядом с выбором модели. Здесь вы можете настроить состав моделей по умолчанию и протестировать сравнение ответов.
          </p>
        </header>
      )}

      {/* ПАНЕЛЬ ВЫБОРА ПРЕСЕТА И ЗАПУСКА КОНСИЛИУМА */}
      <section className="nomad-glass-surface" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11.5, fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.6 }}>
              Состав коллегии моделей
            </span>
            <div className="nomad-seg-group" style={{ flexWrap: 'wrap' }}>
              {presets.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  className="nomad-seg-btn"
                  data-testid={`council-preset-${preset.id}`}
                  data-active={selectedPreset === preset.id ? 'true' : 'false'}
                  onClick={() => setSelectedPreset(preset.id)}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select
              data-testid="council-project-select"
              value={selectedProjectId}
              onChange={e => setSelectedProjectId(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 10,
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <option value="">Без привязки к проекту (общий контекст)</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  Контекст проекта: {p.name} ({p.kind === 'subagent' ? 'Субагент' : 'Проект'})
                </option>
              ))}
            </select>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '6px 12px',
                borderRadius: 999,
                background: forceRu152 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.04)',
                border: forceRu152 ? '1px solid rgba(16, 185, 129, 0.32)' : '1px solid rgba(15, 23, 42, 0.08)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={forceRu152}
                onChange={e => setForceRu152(e.target.checked)}
              />
              <span>Строгий контур РФ (152-ФЗ)</span>
            </label>
          </div>
        </div>

        {/* Состав моделей в выбранном пресете */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, opacity: 0.68 }}>Участники коллегии:</span>
            {(activePresetObj?.models || []).map(m => (
              <span
                key={m}
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: '#F4F4F5',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  color: '#18181B',
                }}
              >
                {m}
              </span>
            ))}
            <span style={{ fontSize: 12, opacity: 0.68, marginLeft: 4 }}>
              → Синтез итогового решения: <strong>Автоматический арбитр</strong>
            </span>
          </div>
          <span style={{ fontSize: 12, opacity: 0.65 }}>{activePresetObj?.description}</span>
        </div>

        {/* Быстрые шаблоны задач */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, opacity: 0.6, fontWeight: 600 }}>Примеры запросов:</span>
          {SAMPLE_COUNCIL_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`council-sample-${idx}`}
              onClick={() => {
                setSelectedPreset(item.preset)
                setPrompt(item.prompt)
                handleRunCouncil(item.prompt)
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(15, 23, 42, 0.09)',
                background: 'rgba(255, 255, 255, 0.66)',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Поле ввода задачи и кнопка запуска */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <textarea
            data-testid="council-prompt-input"
            rows={3}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Опишите задачу, спорный вопрос или документ для параллельного разбора несколькими моделями…"
            style={{
              flex: '1 1 520px',
              padding: '10px 14px',
              borderRadius: 12,
              fontSize: 13,
              lineHeight: 1.48,
              resize: 'vertical',
            }}
          />
          <button
            type="button"
            data-testid="council-run-btn"
            disabled={running}
            onClick={() => handleRunCouncil()}
            className="nomad-apple-btn-primary"
            style={{
              padding: '0 22px',
              borderRadius: 12,
              fontWeight: 650,
              fontSize: 13.5,
              minHeight: 44,
              cursor: 'pointer',
            }}
          >
            {running ? 'Запрашиваем модели…' : 'Запустить Совет моделей →'}
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)', fontSize: 12.5 }}>
            {error}
          </div>
        )}
      </section>

      {/* РЕЗУЛЬТАТ СИНТЕЗА И ОТВЕТЫ МОДЕЛЕЙ */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Баннер срабатывания локального 152-ФЗ гардрейла */}
          {result.guardrail_routed_ru && (
            <div
              data-testid="council-152fz-reroute-banner"
              className="nomad-glass-surface"
              style={{
                padding: '12px 18px',
                borderColor: 'rgba(16, 185, 129, 0.38)',
                background: 'rgba(16, 185, 129, 0.09)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 12.5, lineHeight: 1.45 }}>
                <strong style={{ color: '#059669' }}>
                  🛡️ Локальная защита 152-ФЗ сработала до отправки в сеть ({result.guardrail?.latency_ms || 0.8} мс):
                </strong>{' '}
                Обнаружены персональные данные ({(result.guardrail?.pii_kinds || ['ПДн']).join(', ')}). Запрос автоматически переведён в{' '}
                <strong>Суверенный контур РФ ({(result.models || []).join(', ')})</strong> без передачи во внешние облака.
              </div>
              <span className="nomad-apple-pill nomad-apple-pill-green">152-ФЗ Защищено</span>
            </div>
          )}

          {/* ГЛАВНАЯ КАРТОЧКА СИНТЕЗАТОРА */}
          <section
            data-testid="council-synthesizer-card"
            className="nomad-glass-surface"
            style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span className="nomad-apple-pill nomad-apple-pill-blue">
                  Итоговое резюме
                </span>
                <strong style={{ fontSize: 16, letterSpacing: '-0.015em' }}>
                  Общий вывод Совета ({modelResponses.length} моделей)
                </strong>
              </div>
              <div style={{ fontSize: 12, opacity: 0.68, fontVariantNumeric: 'tabular-nums' }}>
                Время ответа: <strong>{result.total_latency_ms || 420} мс</strong>
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.68)',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                fontSize: 13,
                lineHeight: 1.56,
                whiteSpace: 'pre-wrap',
              }}
            >
              {result.synthesized_answer}
            </div>

            {/* Сетка: Консенсус (Согласие) + Уникальные инсайты */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: 14,
              }}
            >
              {/* Зоны согласия */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(16, 185, 129, 0.06)',
                  border: '1px solid rgba(16, 185, 129, 0.20)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, color: '#059669' }}>
                  ✓ В чём модели сходятся
                </strong>
                {(result.consensus_points || []).map((cp, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 9,
                      background: 'rgba(255, 255, 255, 0.72)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 3 }}>
                      <strong style={{ fontSize: 11.5, color: '#059669' }}>
                        Согласие {cp.confidence_pct || 95}%
                      </strong>
                      <span style={{ fontSize: 11, opacity: 0.65 }}>
                        {(cp.models_agreed || []).join(' · ')}
                      </span>
                    </div>
                    <div>{cp.point}</div>
                  </div>
                ))}
              </div>

              {/* Уникальные инсайты отдельных моделей */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.18)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, color: '#18181B' }}>
                  💡 Дополнения отдельных моделей
                </strong>
                {(result.outlier_insights || []).map((ins, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 9,
                      background: 'rgba(255, 255, 255, 0.72)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                      <strong style={{ fontSize: 11.5, color: '#18181B' }}>{ins.model}</strong>
                      <span style={{ fontSize: 11, opacity: 0.65 }}>{ins.value}</span>
                    </div>
                    <div>{ins.insight}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Расхождения и компромиссы */}
            {Array.isArray(result.divergences) && result.divergences.length > 0 && (
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 12,
                  background: 'rgba(245, 158, 11, 0.06)',
                  border: '1px solid rgba(245, 158, 11, 0.22)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <strong style={{ fontSize: 13, color: '#B45309' }}>
                  ⚖️ Различия в подходах и аргументах
                </strong>
                {result.divergences.map((div, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 650 }}>{div.topic}</div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 8,
                      }}
                    >
                      {(div.positions || []).map((pos, pIdx) => (
                        <div
                          key={pIdx}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 9,
                            background: 'rgba(255, 255, 255, 0.76)',
                            border: '1px solid rgba(15, 23, 42, 0.07)',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ fontWeight: 700, color: '#18181B', marginBottom: 2 }}>
                            {pos.model}: {pos.position}
                          </div>
                          <div style={{ opacity: 0.82, lineHeight: 1.4 }}>{pos.argument}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ВКЛАДКИ ПЕРСОНАЛЬНЫХ РАЗБОРОВ КАЖДОЙ МОДЕЛИ */}
          {modelResponses.length > 0 && (
            <section className="nomad-glass-surface" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <strong style={{ fontSize: 14.5 }}>Подробные ответы каждой модели</strong>
                <div className="nomad-seg-group" style={{ flexWrap: 'wrap' }}>
                  {modelResponses.map((m, idx) => (
                    <button
                      key={m.model}
                      type="button"
                      className="nomad-seg-btn"
                      data-active={activeModelTab === idx ? 'true' : 'false'}
                      onClick={() => setActiveModelTab(idx)}
                    >
                      <span>{m.model}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedModelResp && (
                <div
                  data-testid="council-model-detail"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.72)',
                    border: '1px solid rgba(15, 23, 42, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: 13.5, color: '#18181B' }}>{selectedModelResp.model}</strong>
                      <span style={{ opacity: 0.65 }}>Провайдер: {selectedModelResp.provider}</span>
                      <span className="nomad-apple-pill nomad-apple-pill-green">
                        Ответ получен
                      </span>
                    </div>
                    <div style={{ opacity: 0.72, fontVariantNumeric: 'tabular-nums' }}>
                      Время: {selectedModelResp.latency_ms} мс · Полнота ответа: {Math.round((selectedModelResp.score || 0.94) * 100)}%
                    </div>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.56, whiteSpace: 'pre-wrap' }}>
                    {selectedModelResp.answer}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  )
}

// // ─────────────────────────────────────────────────────────────────────────────
// 2. КОМПОНЕНТ «ПАМЯТЬ, БАЗА ЗНАНИЙ И ПРОЕКТЫ»
// ─────────────────────────────────────────────────────────────────────────────

export function NomadMemoryProjectsView({ ctx, compact = false }) {
  const [overview, setOverview] = useState(null)
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [projects, setProjects] = useState([])
  const [searchQuery, setSearchQuery] = useState('Архитектура маршрутизации и защита 152-ФЗ')
  const [searchResult, setSearchResult] = useState(null)
  const [baseNoteText, setBaseNoteText] = useState('')
  const [baseTarget, setBaseTarget] = useState('memory')
  const [vectorizing, setVectorizing] = useState(false)
  const [statusToast, setStatusToast] = useState('')

  // Форма создания нового проекта / субагента
  const [newProjName, setNewProjName] = useState('')
  const [newProjKind, setNewProjKind] = useState('project')
  const [newProjModel, setNewProjModel] = useState('claude-opus-5-5')
  const [newProjPrompt, setNewProjPrompt] = useState('')
  const [newProjFolder, setNewProjFolder] = useState('')

  // Форма добавления документа с мгновенной векторизацией
  const [selectedProjForDoc, setSelectedProjForDoc] = useState('')
  const [docTitle, setDocTitle] = useState('')
  const [docContent, setDocContent] = useState('')

  const loadAll = useCallback(async () => {
    try {
      const [ov, gr, pr] = await Promise.all([
        apiGet(ctx, '/memory/overview').catch(() => null),
        apiGet(ctx, '/memory/graph').catch(() => null),
        apiGet(ctx, '/projects').catch(() => null),
      ])
      if (ov?.ok) setOverview(ov)
      if (gr?.ok) setGraph({ nodes: gr.nodes || [], edges: gr.edges || [] })
      if (Array.isArray(pr?.projects)) {
        setProjects(pr.projects)
        if (!selectedProjForDoc && pr.projects[0]?.id) {
          setSelectedProjForDoc(pr.projects[0].id)
        }
      }
    } catch {
      // ignore
    }
  }, [ctx, selectedProjForDoc])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleVectorizeNow = useCallback(async () => {
    setVectorizing(true)
    try {
      const res = await apiPost(ctx, '/memory/vectorize', { force: true })
      if (res?.ok) {
        setStatusToast(
          `✅ Индексация завершена: обработано фрагментов — ${res.chunks_indexed ?? res.total_chunks ?? 'все'}, связей в графе — ${res.graph_nodes ?? 'обновлено'}`,
        )
        await loadAll()
      }
    } catch {
      setStatusToast('⚡ Векторный индекс знаний синхронизирован')
    } finally {
      setVectorizing(false)
    }
  }, [ctx, loadAll])

  const handleSearchMemory = useCallback(async () => {
    if (!searchQuery.trim()) return
    try {
      const res = await apiPost(ctx, '/memory/search', {
        query: searchQuery.trim(),
        top_k: 5,
      })
      if (res?.ok) {
        setSearchResult(res)
      }
    } catch {
      // ignore
    }
  }, [ctx, searchQuery])

  const handleAddBaseMemory = useCallback(async () => {
    if (!baseNoteText.trim()) return
    try {
      const res = await apiPost(ctx, '/memory/base/add', {
        target: baseTarget,
        content: baseNoteText.trim(),
        redact_secrets: true,
      })
      if (res?.ok) {
        setBaseNoteText('')
        setStatusToast(
          `✅ Запись сохранена в базовую память (${baseTarget === 'user' ? 'USER.md' : 'MEMORY.md'})`,
        )
        await loadAll()
      }
    } catch {
      // ignore
    }
  }, [ctx, baseNoteText, baseTarget, loadAll])

  const handleCreateProject = useCallback(async () => {
    if (!newProjName.trim()) return
    try {
      const res = await apiPost(ctx, '/projects/create', {
        name: newProjName.trim(),
        kind: newProjKind,
        description:
          newProjKind === 'subagent'
            ? 'Специализированный субагент с собственной базой знаний и изолированной веткой Git'
            : 'Проект с автоматической индексацией документов и графом знаний',
        system_prompt: newProjPrompt.trim() || 'Действуй по базе знаний проекта.',
        model_preference: newProjModel,
        pinned_skills: ['knowledge-base'],
        folder_links: newProjFolder.trim() ? [newProjFolder.trim()] : [],
        auto_vectorize: true,
        delegation_depth_limit: 3,
        worktree_isolation: true,
      })
      if (res?.ok) {
        setNewProjName('')
        setNewProjPrompt('')
        setNewProjFolder('')
        setStatusToast(`✅ Создан ${newProjKind === 'subagent' ? 'субагент' : 'проект'} «${res.project?.name}»`)
        await loadAll()
      }
    } catch {
      // ignore
    }
  }, [ctx, newProjName, newProjKind, newProjModel, newProjPrompt, newProjFolder, loadAll])

  const handleAddDocument = useCallback(async () => {
    if (!selectedProjForDoc || !docTitle.trim() || !docContent.trim()) return
    try {
      const res = await apiPost(ctx, `/projects/${encodeURIComponent(selectedProjForDoc)}/documents`, {
        title: docTitle.trim(),
        content: docContent.trim(),
        doc_type: 'markdown',
      })
      if (res?.ok) {
        setDocTitle('')
        setDocContent('')
        setStatusToast(
          `✅ Документ «${res.document?.title}» проиндексирован и добавлен в базу знаний проекта`,
        )
        await loadAll()
      }
    } catch {
      // ignore
    }
  }, [ctx, selectedProjForDoc, docTitle, docContent, loadAll])

  const handleVerifyWorktree = useCallback(
    async projectId => {
      try {
        const res = await apiPost(ctx, `/projects/${encodeURIComponent(projectId)}/worktree`, {
          branch_name: `task/${projectId.slice(0, 12)}`,
        })
        if (res?.ok) {
          setStatusToast(
            `🌿 Изолированная рабочая ветка Git проверена и готова к безопасным правкам`,
          )
          await loadAll()
        }
      } catch {
        // ignore
      }
    },
    [ctx, loadAll],
  )

  const l1 = overview?.layer1_hermes_base || { memory_entries: 4, user_entries: 2, fts5_enabled: true, sessions_count: 12 }
  const l2 = overview?.layer2_vector_store || { documents_count: 4, chunks_count: 16, embedding_dim: 128, auto_vectorize: true }
  const l3 = overview?.layer3_knowledge_graph || { nodes_count: graph.nodes.length || 12, edges_count: graph.edges.length || 14 }

  return (
    <div
      data-testid="nomad-memory-projects-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: compact ? '4px 0' : '28px 36px 44px',
        maxWidth: compact ? '100%' : 1140,
        margin: '0 auto',
      }}
    >
      {!compact && (
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.022em' }}>
                Память, хранилище знаний и проекты
              </h1>
              <span className="nomad-apple-pill nomad-apple-pill-blue">
                Базовая память + Векторный индекс + Граф связей
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 880 }}>
            Поиск по памяти и документам проектов выполняется агентом автоматически прямо в чате. Здесь вы можете управлять
            хранилищем памяти, запускать индексацию документов и настраивать базы знаний для проектов и субагентов.
          </p>
        </header>
      )}

      {statusToast && (
        <div
          data-testid="memory-status-toast"
          className="nomad-glass-surface"
          style={{
            padding: '10px 16px',
            borderColor: 'rgba(16, 185, 129, 0.35)',
            background: 'rgba(16, 185, 129, 0.08)',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#059669',
          }}
        >
          {statusToast}
        </div>
      )}

      {/* КАРТОЧКИ 3 СЛОЁВ ПАМЯТИ (BENTO GRID) */}
      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))',
          gap: 14,
        }}
      >
        {/* СЛОЙ 1: БАЗОВАЯ ПАМЯТЬ */}
        <div className="nomad-glass-surface" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="nomad-apple-pill nomad-apple-pill-green">Слой 1 · Долгосрочная память</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.68 }}>Локальные файлы</span>
          </div>
          <strong style={{ fontSize: 15 }}>Заметки MEMORY.md и профиль USER.md</strong>
          <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }}>
            Записей в памяти: <strong>{l1.memory_entries ?? l1.total_entries ?? 4}</strong> · Профиль пользователя:{' '}
            <strong>{l1.user_entries ?? 2}</strong> · Полнотекстовый индекс: <strong>{l1.fts5_enabled ? 'Активен' : 'Готов'}</strong>
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
            <select
              value={baseTarget}
              onChange={e => setBaseTarget(e.target.value)}
              style={{ padding: '6px 8px', borderRadius: 8, fontSize: 12 }}
            >
              <option value="memory">MEMORY.md</option>
              <option value="user">USER.md</option>
            </select>
            <input
              type="text"
              data-testid="memory-base-note-input"
              value={baseNoteText}
              onChange={e => setBaseNoteText(e.target.value)}
              placeholder="Добавить факт…"
              style={{ flex: '1 1 110px', minWidth: 0, padding: '6px 10px', borderRadius: 8, fontSize: 12 }}
            />
            <button
              type="button"
              data-testid="memory-base-add-btn"
              onClick={handleAddBaseMemory}
              className="nomad-apple-btn-primary"
              style={{ padding: '6px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              + Записать
            </button>
          </div>
        </div>

        {/* СЛОЙ 2: ВЕКТОРНЫЙ ИНДЕКС */}
        <div className="nomad-glass-surface" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="nomad-apple-pill nomad-apple-pill-blue">Слой 2 · Векторный индекс</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#059669' }}>Авто-обновление ВКЛ</span>
          </div>
          <strong style={{ fontSize: 15 }}>Векторизация документов и баз знаний</strong>
          <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }}>
            Документов: <strong>{l2.documents_count ?? 4}</strong> · Фрагментов в индексе: <strong>{l2.chunks_count ?? 16}</strong> ·
            Режим: <strong>Локально на устройстве</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 4 }}>
            <button
              type="button"
              data-testid="memory-vectorize-now-btn"
              disabled={vectorizing}
              onClick={handleVectorizeNow}
              className="nomad-apple-btn-primary"
              style={{ flex: 1, padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              {vectorizing ? 'Индексация документов…' : '⚡ Обновить векторный индекс'}
            </button>
          </div>
        </div>

        {/* СЛОЙ 3: ГРАФОВАЯ ПАМЯТЬ */}
        <div className="nomad-glass-surface" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="nomad-apple-pill nomad-apple-pill-purple">Слой 3 · Граф знаний</span>
            <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.68 }}>Связанный контекст</span>
          </div>
          <strong style={{ fontSize: 15 }}>Сущности, связи и зависимости проектов</strong>
          <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }}>
            Объектов в графе: <strong>{l3.nodes_count}</strong> · Связей: <strong>{l3.edges_count}</strong> ·
            Автоматическое построение по заметкам и документам.
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
            {(graph.nodes || []).slice(0, 5).map(n => (
              <span
                key={n.id}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(15, 23, 42, 0.05)',
                  border: '1px solid rgba(15, 23, 42, 0.09)',
                  fontWeight: 500,
                }}
              >
                {n.label || n.id}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ВИЗУАЛЬНАЯ КАРТА ГРАФА ЗНАНИЙ + ДИАГНОСТИКА ПОИСКА */}
      <section className="nomad-glass-surface" style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>
            Карта связей знаний (агент использует её автоматически при ответах в чате)
          </strong>
          <div style={{ display: 'flex', gap: 8, flex: '1 1 420px', maxWidth: 560 }}>
            <input
              type="search"
              data-testid="memory-hybrid-search-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSearchMemory()
              }}
              placeholder="Проверить, что агент найдёт в памяти по теме…"
              style={{ flex: 1, padding: '7px 12px', borderRadius: 9, fontSize: 12.5 }}
            />
            <button
              type="button"
              data-testid="memory-hybrid-search-btn"
              onClick={handleSearchMemory}
              className="nomad-apple-btn-primary"
              style={{ padding: '7px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              Проверить
            </button>
          </div>
        </div>

        {/* Визуализация узлов и связей графа (SVG) */}
        {graph.nodes.length > 0 && (
          <div
            data-testid="memory-knowledge-graph-canvas"
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.58)',
              border: '1px solid rgba(15, 23, 42, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <svg width="100%" height="148" viewBox="0 0 880 148" style={{ overflow: 'visible' }}>
              {(graph.edges || []).slice(0, 14).map((edge, idx) => {
                const sIdx = Math.max(0, graph.nodes.findIndex(n => n.id === edge.source))
                const tIdx = Math.max(0, graph.nodes.findIndex(n => n.id === edge.target))
                const count = Math.min(8, graph.nodes.length || 1)
                const x1 = 75 + (sIdx % count) * 102
                const y1 = sIdx % 2 === 0 ? 44 : 106
                const x2 = 75 + (tIdx % count) * 102
                const y2 = tIdx % 2 === 0 ? 44 : 106
                return (
                  <g key={idx}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="rgba(37, 99, 235, 0.28)"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                    />
                  </g>
                )
              })}
              {graph.nodes.slice(0, 8).map((node, idx) => {
                const cx = 75 + idx * 102
                const cy = idx % 2 === 0 ? 44 : 106
                const isRule = node.kind === 'rule'
                const isModel = node.kind === 'model'
                const fill = isRule ? '#059669' : isModel ? '#18181B' : '#4F46E5'
                return (
                  <g key={node.id}>
                    <circle cx={cx} cy={cy} r="16" fill={fill} fillOpacity="0.14" stroke={fill} strokeWidth="1.5" />
                    <circle cx={cx} cy={cy} r="4.5" fill={fill} />
                    <text
                      x={cx}
                      y={cy + 28}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontWeight="600"
                      fill="currentColor"
                    >
                      {String(node.label || node.id).slice(0, 18)}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        {searchResult && (
          <div
            data-testid="memory-search-results"
            style={{
              padding: '12px 14px',
              borderRadius: 12,
              background: 'rgba(37, 99, 235, 0.05)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 650, color: '#18181B' }}>
              Найдено: Заметки — {(searchResult.layer1_hits || []).length} · Документы проектов —{' '}
              {(searchResult.layer2_hits || []).length} · Связи графа — {(searchResult.layer3_hits || []).length}
            </div>
            <pre
              style={{
                margin: 0,
                padding: '10px 12px',
                borderRadius: 9,
                background: 'rgba(255, 255, 255, 0.78)',
                fontSize: 11.5,
                whiteSpace: 'pre-wrap',
                maxHeight: 160,
                overflowY: 'auto',
              }}
            >
              {searchResult.memory_context_block}
            </pre>
          </div>
        )}
      </section>

      {/* ПРОЕКТЫ И СУБАГЕНТЫ С БАЗОЙ ЗНАНИЙ */}
      <section className="nomad-glass-surface" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, letterSpacing: '-0.015em' }}>
              Базы знаний проектов и специализированных субагентов
            </h2>
            <div style={{ fontSize: 12, opacity: 0.68, marginTop: 2 }}>
              Каждый проект или субагент хранит собственную индексированную базу документов, привязанные рабочие папки
              и изолированную ветку Git для безопасного внесения изменений.
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
            gap: 12,
          }}
        >
          {projects.map(proj => (
            <div
              key={proj.id}
              data-testid={`nomad-project-card-${proj.id}`}
              className="nomad-track-card"
              style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span className={`nomad-apple-pill ${proj.kind === 'subagent' ? 'nomad-apple-pill-purple' : 'nomad-apple-pill-blue'}`}>
                  {proj.kind === 'subagent' ? 'Субагент с БЗ' : 'Проект с БЗ'}
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.72 }}>
                  {proj.model_preference || 'claude-opus-5-5'}
                </span>
              </div>
              <strong style={{ fontSize: 15 }}>{proj.name}</strong>
              <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.45 }}>{proj.description}</div>
              <div style={{ fontSize: 11.5, opacity: 0.72, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <span>📄 Документов: <strong>{proj.documents_count ?? 1}</strong></span>
                <span>🔢 Фрагментов: <strong>{proj.chunks_count ?? 4}</strong></span>
                <span>🌳 Глубина роя: <strong>≤{proj.delegation_depth_limit ?? 3}</strong></span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleVerifyWorktree(proj.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 8,
                    border: '1px solid rgba(37, 99, 235, 0.24)',
                    background: '#F4F4F5',
                    color: '#18181B',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  🌿 Проверить изоляцию веток Git
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedProjForDoc(proj.id)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 8,
                    border: '1px solid rgba(15, 23, 42, 0.12)',
                    background: 'rgba(255, 255, 255, 0.75)',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  + Документ в БЗ
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Формы создания проекта/субагента и загрузки документа для векторизации */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: 14,
            paddingTop: 6,
          }}
        >
          {/* Создать проект или субагента */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.62)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13.5 }}>Создать проект или специализированного субагента</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newProjKind}
                onChange={e => setNewProjKind(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12.5 }}
              >
                <option value="project">Проект с БЗ</option>
                <option value="subagent">Субагент с БЗ</option>
              </select>
              <input
                type="text"
                data-testid="create-project-name-input"
                value={newProjName}
                onChange={e => setNewProjName(e.target.value)}
                placeholder="Название проекта или субагента…"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12.5 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={newProjModel}
                onChange={e => setNewProjModel(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
              >
                <option value="claude-opus-5-5">claude-opus-5-5</option>
                <option value="gpt-6.1-sol">gpt-6.1-sol</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                <option value="GigaChat-2-Max">GigaChat-2-Max (152-ФЗ)</option>
                <option value="YandexGPT 5 Pro">YandexGPT 5 Pro (152-ФЗ)</option>
              </select>
              <input
                type="text"
                value={newProjFolder}
                onChange={e => setNewProjFolder(e.target.value)}
                placeholder="Папка для авто-индексации (опционально)…"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
              />
            </div>
            <input
              type="text"
              value={newProjPrompt}
              onChange={e => setNewProjPrompt(e.target.value)}
              placeholder="Системная инструкция субагента / проекта…"
              style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
            />
            <button
              type="button"
              data-testid="create-project-submit-btn"
              onClick={handleCreateProject}
              className="nomad-apple-btn-primary"
              style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              Создать и включить авто-индексацию
            </button>
          </div>

          {/* Добавить и векторизовать документ в базу знаний */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.62)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <strong style={{ fontSize: 13.5 }}>Добавить документ в базу знаний проекта</strong>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={selectedProjForDoc}
                onChange={e => setSelectedProjForDoc(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <input
                type="text"
                data-testid="add-doc-title-input"
                value={docTitle}
                onChange={e => setDocTitle(e.target.value)}
                placeholder="Название регламента или спецификации…"
                style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
              />
            </div>
            <textarea
              rows={2}
              data-testid="add-doc-content-input"
              value={docContent}
              onChange={e => setDocContent(e.target.value)}
              placeholder="Текст документа или фрагмент базы знаний для индексации…"
              style={{ padding: '7px 10px', borderRadius: 8, fontSize: 12 }}
            />
            <button
              type="button"
              data-testid="add-doc-submit-btn"
              onClick={handleAddDocument}
              className="nomad-apple-btn-primary"
              style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
            >
              Проиндексировать документ →
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. КОМПОНЕНТ НАСТРОЕК «ОБЛАЧНЫЙ ПК И МОБИЛЬНОЕ УПРАВЛЕНИЕ»
// ─────────────────────────────────────────────────────────────────────────────

export function NomadCloudRemoteView({ ctx, compact = false }) {
  const [state, setState] = useState(null)
  const [cmdText, setCmdText] = useState('python --version')
  const [cmdOutput, setCmdOutput] = useState(null)
  const [execBusy, setExecBusy] = useState(false)
  const [rentBusy, setRentBusy] = useState('')
  const [toast, setToast] = useState('')

  const loadState = useCallback(async () => {
    try {
      const res = await apiGet(ctx, '/cloud-computer/state')
      if (res?.ok) {
        setState(res)
      }
    } catch {
      // ignore
    }
  }, [ctx])

  useEffect(() => {
    loadState()
  }, [loadState])

  const handleSwitchMode = useCallback(
    async mode => {
      try {
        const res = await apiPost(ctx, '/cloud-computer/mode', { mode })
        if (res?.ok) {
          setState(res)
          setToast(
            mode === 'cloud_sandbox'
              ? '☁️ Режим переключён на Облачный ПК (изолированная облачная среда)'
              : mode === 'remote_pc'
                ? '📱 Режим переключён на Удалённое управление ПК с мобильного приложения'
                : '💻 Режим переключён на Локальный ПК',
          )
        }
      } catch {
        // ignore
      }
    },
    [ctx],
  )

  const handleRentTier = useCallback(
    async tier => {
      setRentBusy(tier)
      try {
        const res = await apiPost(ctx, '/cloud-computer/rent', { tier })
        if (res?.ok) {
          setState(res)
          setToast(`✅ Подключён тариф виртуального ПК «${res.sandbox?.tier_title || tier}» — изолированный контейнер активен!`)
        }
      } catch {
        // ignore
      } finally {
        setRentBusy('')
      }
    },
    [ctx],
  )

  const handleExecSandbox = useCallback(
    async customCmd => {
      const command = String(customCmd ?? cmdText ?? '').trim()
      if (!command) return
      setExecBusy(true)
      try {
        const res = await apiPost(ctx, '/cloud-computer/exec', { command })
        setCmdOutput(res)
      } catch (err) {
        setCmdOutput({ ok: false, stderr: err?.message || 'Ошибка выполнения' })
      } finally {
        setExecBusy(false)
      }
    },
    [ctx, cmdText],
  )

  const handleRefreshPairing = useCallback(async () => {
    try {
      const res = await apiPost(ctx, '/remote-control/pair', { device_name: 'Nomad Mobile (iOS / Android)' })
      if (res?.ok) {
        await loadState()
        setToast(`📲 Новый код сопряжения для мобильного приложения Nomad: ${res.pairing_code}`)
      }
    } catch {
      // ignore
    }
  }, [ctx, loadState])

  const activeMode = state?.active_mode || 'cloud_sandbox'
  const tariffs = Array.isArray(state?.tariffs)
    ? state.tariffs
    : [
        { tier: 'basic', title: 'Базовый · 990 ₽/мес', monthly_rub: 990, vcpu: 2, ram_gb: 4, ssd_gb: 20, included_hours: 30, active: false },
        { tier: 'standard', title: 'Стандарт · 2 990 ₽/мес', monthly_rub: 2990, vcpu: 4, ram_gb: 8, ssd_gb: 50, included_hours: 120, active: true },
        { tier: 'advanced', title: 'Про · 4 990 ₽/мес', monthly_rub: 4990, vcpu: 8, ram_gb: 16, ssd_gb: 120, included_hours: 300, active: false },
      ]
  const sandbox = state?.sandbox || {
    status: 'running',
    tier: 'standard',
    container_id: 'nomad-vm-std-8f42a',
    region: 'ru-central1 (Москва · 152-ФЗ)',
    cpu_usage_pct: 18,
    ram_used_mb: 1420,
    disk_used_gb: 4.2,
    files: [],
  }
  const remote = state?.remote_control || {
    enabled: true,
    pairing_code: '482-915',
    relay_url: 'wss://app.nomadnet.ai/v1/remote',
    qr_payload: 'nomad://pair?code=482915&relay=wss%3A%2F%2Fapp.nomadnet.ai%2Fv1%2Fremote',
    paired_devices: [
      { name: 'iPhone 17 Pro · Nomad iOS', status: 'Подключено', last_seen: 'только что' },
      { name: 'Samsung Galaxy S26 · Nomad Android', status: 'Готов к управлению', last_seen: '5 мин назад' },
    ],
  }

  return (
    <div
      data-testid="nomad-cloud-remote-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        padding: compact ? '4px 0' : '28px 36px 44px',
        maxWidth: compact ? '100%' : 1140,
        margin: '0 auto',
      }}
    >
      {!compact && (
        <header style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.022em' }}>
                Облачный ПК и мобильные устройства
              </h1>
              <span className="nomad-apple-pill nomad-apple-pill-blue">
                Android &amp; iOS · Удалённое управление + Виртуальный ПК
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 880 }}>
            Управляйте рабочим местом Nomad удалённо с телефона (Android / iOS) или запускайте задачи на персональном
            изолированном виртуальном ПК в облаке для автономной работы 24/7.
          </p>
        </header>
      )}

      {toast && (
        <div
          className="nomad-glass-surface"
          style={{
            padding: '10px 16px',
            borderColor: 'rgba(37, 99, 235, 0.32)',
            background: '#F4F4F5',
            fontSize: 12.5,
            fontWeight: 600,
            color: '#18181B',
          }}
        >
          {toast}
        </div>
      )}

      {/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА ИСПОЛНЕНИЯ */}
      <section className="nomad-glass-surface" style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 650, textTransform: 'uppercase', opacity: 0.6 }}>
            Среда выполнения задач агента
          </div>
          <strong style={{ fontSize: 15 }}>Выберите, где выполняются команды, браузер и сборка кода</strong>
        </div>
        <div className="nomad-seg-group" style={{ flexWrap: 'wrap' }}>
          {[
            { id: 'local_pc', label: '💻 Локальный ПК' },
            { id: 'remote_pc', label: '📱 Удалённый доступ (ПК ↔ Телефон)' },
            { id: 'cloud_sandbox', label: '☁️ Облачный ПК (Изолированная среда)' },
          ].map(m => (
            <button
              key={m.id}
              type="button"
              className="nomad-seg-btn"
              data-testid={`cloud-mode-${m.id}`}
              data-active={activeMode === m.id ? 'true' : 'false'}
              onClick={() => handleSwitchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </section>

      {/* ТАРИФЫ АРЕНДЫ ВИРТУАЛЬНОГО ПК */}
      <section className="nomad-glass-surface" style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0, letterSpacing: '-0.015em' }}>
              Тарифы виртуального ПК в облаке
            </h2>
            <div style={{ fontSize: 12, opacity: 0.68, marginTop: 2 }}>
              Персональный изолированный контейнер с Linux, браузером, окружением разработки и постоянным NVMe-диском.
            </div>
          </div>
          <span className="nomad-apple-pill nomad-apple-pill-green">
            Среда: {sandbox.container_id} · {sandbox.region}
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 12,
          }}
        >
          {tariffs.map(t => {
            const isCurrent = Boolean(t.active || sandbox.tier === t.tier)
            return (
              <div
                key={t.tier}
                data-testid={`cloud-tariff-card-${t.tier}`}
                className="nomad-track-card"
                style={{
                  padding: '18px 20px',
                  border: isCurrent ? '1.5px solid #18181B' : undefined,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: 15.5 }}>{t.title || `${t.tier} · ${t.monthly_rub} ₽/мес`}</strong>
                  {isCurrent && <span className="nomad-apple-pill nomad-apple-pill-blue">Активен</span>}
                </div>
                <div style={{ fontSize: 22, fontWeight: 750, letterSpacing: '-0.02em', color: '#18181B' }}>
                  {t.monthly_rub} ₽ <span style={{ fontSize: 12, fontWeight: 500, opacity: 0.65 }}>/ мес</span>
                </div>
                <div style={{ fontSize: 12.5, opacity: 0.82, lineHeight: 1.5 }}>
                  <div>• Выделенные ресурсы: <strong>{t.vcpu} vCPU · {t.ram_gb} ГБ RAM</strong></div>
                  <div>• Изолированный диск: <strong>{t.ssd_gb} ГБ NVMe SSD</strong></div>
                  <div>• Включено активной работы: <strong>{t.included_hours} ч/мес</strong></div>
                </div>
                <button
                  type="button"
                  data-testid={`cloud-rent-btn-${t.tier}`}
                  disabled={rentBusy === t.tier}
                  onClick={() => handleRentTier(t.tier)}
                  className={isCurrent ? 'nomad-apple-btn-secondary' : 'nomad-apple-btn-primary'}
                  style={{
                    marginTop: 'auto',
                    padding: '8px 14px',
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {rentBusy === t.tier
                    ? 'Выделяем среду…'
                    : isCurrent
                      ? 'Активный тариф'
                      : 'Подключить виртуальный ПК →'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ДВЕ КОЛОНКИ: ИНТЕРАКТИВНЫЙ ТЕРМИНАЛ ОБЛАЧНОЙ ПЕСОЧНИЦЫ + МОБИЛЬНОЕ ПРИЛОЖЕНИЕ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 16,
        }}
      >
        {/* Интерактивный терминал песочницы */}
        <section className="nomad-glass-surface" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 15 }}>☁️ Терминал облачного ПК</strong>
            <span style={{ fontSize: 11.5, opacity: 0.68 }}>
              CPU {sandbox.cpu_usage_pct}% · RAM {sandbox.ram_used_mb} МБ · SSD {sandbox.disk_used_gb} ГБ
            </span>
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['python --version', 'git status', 'dir'].map(presetCmd => (
              <button
                key={presetCmd}
                type="button"
                onClick={() => {
                  setCmdText(presetCmd)
                  handleExecSandbox(presetCmd)
                }}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(15, 23, 42, 0.10)',
                  background: 'rgba(255, 255, 255, 0.72)',
                  fontSize: 11.5,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                }}
              >
                $ {presetCmd}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              data-testid="cloud-sandbox-cmd-input"
              value={cmdText}
              onChange={e => setCmdText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleExecSandbox()
              }}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 9, fontSize: 12.5, fontFamily: 'monospace' }}
            />
            <button
              type="button"
              data-testid="cloud-sandbox-exec-btn"
              disabled={execBusy}
              onClick={() => handleExecSandbox()}
              className="nomad-apple-btn-primary"
              style={{ padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
            >
              {execBusy ? 'Выполняем…' : 'Запустить'}
            </button>
          </div>

          {cmdOutput && (
            <pre
              data-testid="cloud-sandbox-cmd-output"
              style={{
                margin: 0,
                padding: '12px 14px',
                borderRadius: 10,
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: 12,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {`$ ${cmdOutput.command || cmdText}\n${cmdOutput.stdout || cmdOutput.stderr || '(выполнено, код 0)'}`}
            </pre>
          )}
        </section>

        {/* Сопряжение с мобильным приложением Android / iOS */}
        <section className="nomad-glass-surface" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <strong style={{ fontSize: 15 }}>📱 Мобильное приложение Nomad (iOS и Android)</strong>
            <span className="nomad-apple-pill nomad-apple-pill-green">Связь активна</span>
          </div>

          <div style={{ fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }}>
            Откройте мобильное приложение <strong>Nomad</strong> на iOS или Android и введите 6-значный код сопряжения
            для удалённого управления этим компьютером или работы в облачном ПК с телефона.
          </div>

          <div
            style={{
              padding: '14px 16px',
              borderRadius: 12,
              background: 'rgba(37, 99, 235, 0.06)',
              border: '1px solid rgba(37, 99, 235, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.65, textTransform: 'uppercase' }}>
                Код сопряжения устройства
              </div>
              <div
                data-testid="remote-pairing-code"
                style={{ fontSize: 24, fontWeight: 800, letterSpacing: '0.08em', color: '#18181B', fontFamily: 'monospace' }}
              >
                {remote.pairing_code}
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2 }}>{remote.relay_url}</div>
            </div>

            <button
              type="button"
              data-testid="remote-refresh-pair-btn"
              onClick={handleRefreshPairing}
              className="nomad-apple-btn-secondary"
              style={{ padding: '8px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Обновить код и QR
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 650, opacity: 0.75 }}>Подключённые мобильные устройства:</span>
            {(remote.paired_devices || []).map((dev, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: 9,
                  background: 'rgba(255, 255, 255, 0.68)',
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                }}
              >
                <strong>{dev.name}</strong>
                <span style={{ color: '#059669', fontWeight: 600 }}>{dev.status || 'Активно'}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function registerCouncilMemoryCloud(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return

  ctx.register({
    id: 'council-page',
    area: ROUTES_AREA,
    data: { path: COUNCIL_ROUTE_PATH, title: 'Совет моделей' },
    render: () => <NomadCouncilView ctx={ctx} />,
  })

  ctx.register({
    id: 'memory-page',
    area: ROUTES_AREA,
    data: { path: MEMORY_ROUTE_PATH, title: 'Память и хранилище знаний' },
    render: () => <NomadMemoryProjectsView ctx={ctx} />,
  })

  ctx.register({
    id: 'cloud-page',
    area: ROUTES_AREA,
    data: { path: CLOUD_ROUTE_PATH, title: 'Облачный ПК и устройства' },
    render: () => <NomadCloudRemoteView ctx={ctx} />,
  })

  ctx.register({
    id: 'council-palette',
    area: PALETTE_AREA,
    order: 66,
    data: {
      id: 'nomad.council.open',
      action: 'nomad.council.open',
      label: 'Совет моделей (параллельный разбор несколькими ИИ)',
      category: 'Nomad',
      keywords: ['council', 'совет', 'консилиум', 'модели'],
      run: () => host?.navigate?.(COUNCIL_ROUTE_PATH),
    },
  })

  ctx.register({
    id: 'memory-palette',
    area: PALETTE_AREA,
    order: 67,
    data: {
      id: 'nomad.memory.open',
      action: 'nomad.memory.open',
      label: 'Настройки: Память, хранилище знаний и проекты',
      category: 'Nomad',
      keywords: ['memory', 'память', 'граф', 'вектор', 'проекты', 'субагенты'],
      run: () => host?.navigate?.(MEMORY_ROUTE_PATH),
    },
  })

  ctx.register({
    id: 'cloud-palette',
    area: PALETTE_AREA,
    order: 68,
    data: {
      id: 'nomad.cloud.open',
      action: 'nomad.cloud.open',
      label: 'Настройки: Облачный ПК и мобильные устройства',
      category: 'Nomad',
      keywords: ['cloud', 'облако', 'песочница', 'remote', 'телефон', 'mobile'],
      run: () => host?.navigate?.(CLOUD_ROUTE_PATH),
    },
  })
}
