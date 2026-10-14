/**
 * Карточка инцидентов расписания в слоте `cron:top` веб-дашборда (M-147).
 *
 * Показывает открытые инциденты (`detected` / `alerted`) из `<HERMES_HOME>/cron/executions.db`,
 * текст последней ошибки, число повторов, кнопку «Принято» (`POST /api/plugins/nomad/cron/incidents/<id>/ack`)
 * и переключатель «Показать закрытые».
 */

const PLUGIN_NAME = 'nomad'
const SLOT_NAME = 'cron:top'
const INCIDENTS_URL = '/api/plugins/nomad/cron/incidents'

const STATUS_LABELS = {
  detected: 'Обнаружен',
  alerted: 'Уведомление отправлено',
  resolved: 'Принято (закрыт)'
}

export function normalizeIncidents(payload) {
  const raw = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.incidents)
      ? payload.incidents
      : []

  return raw.map((item, idx) => ({
    id: String(item.id || `inc-${idx + 1}`),
    jobId: String(item.job_id || item.jobId || ''),
    jobName: String(item.job_name || item.jobName || item.job_id || `Задача #${idx + 1}`),
    status: String(item.status || 'detected'),
    consecutiveFailures: Number(
      item.consecutive_failures ?? item.consecutiveFailures ?? item.repeat_count ?? 1
    ),
    repeatCount: Number(
      item.repeat_count ?? item.consecutive_failures ?? item.consecutiveFailures ?? 1
    ),
    lastError: String(item.last_error || item.error_text || item.lastError || 'Ошибка выполнения'),
    errorText: String(item.error_text || item.last_error || item.errorText || 'Ошибка выполнения'),
    firstFailedAt: item.first_failed_at || item.firstFailedAt || null,
    lastFailedAt: item.last_failed_at || item.lastFailedAt || null,
    resolvedAt: item.resolved_at || item.resolvedAt || null
  }))
}

export function filterIncidentsByToggle(incidents, showResolved) {
  const list = Array.isArray(incidents) ? incidents : []
  if (showResolved) {
    return list
  }
  return list.filter(item => item.status === 'detected' || item.status === 'alerted')
}

export function createCronIncidentsCard(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks

  return function CronIncidentsCard() {
    const [incidents, setIncidents] = useState([])
    const [showResolved, setShowResolved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState(null)
    const [ackingId, setAckingId] = useState(null)

    function loadIncidents(includeResolvedFlag) {
      const withResolved =
        typeof includeResolvedFlag === 'boolean' ? includeResolvedFlag : showResolved
      setLoading(true)
      setError(null)
      const query = withResolved ? '?include_resolved=true' : '?include_resolved=true'
      sdk.fetchJSON(`${INCIDENTS_URL}${query}`).then(
        data => {
          setIncidents(normalizeIncidents(data))
          setLoading(false)
        },
        err => {
          setError(
            err && err.message ? err.message : 'Не удалось загрузить инциденты расписания.'
          )
          setLoading(false)
        }
      )
    }

    useEffect(() => {
      let alive = true
      sdk.fetchJSON(`${INCIDENTS_URL}?include_resolved=true`).then(
        data => {
          if (alive) {
            setIncidents(normalizeIncidents(data))
            setLoading(false)
          }
        },
        err => {
          if (alive) {
            setError(
              err && err.message ? err.message : 'Не удалось загрузить инциденты расписания.'
            )
            setLoading(false)
          }
        }
      )
      return () => {
        alive = false
      }
    }, [])

    function handleAck(incident) {
      if (!incident || !incident.id) {
        return
      }
      setAckingId(incident.id)
      setError(null)
      setNotice(null)
      const ackUrl = `${INCIDENTS_URL}/${encodeURIComponent(incident.id)}/ack`
      sdk
        .fetchJSON(ackUrl, {
          method: 'POST',
          body: JSON.stringify({ id: incident.id })
        })
        .then(
          () => {
            setIncidents(prev =>
              prev.map(item =>
                item.id === incident.id
                  ? { ...item, status: 'resolved', resolvedAt: new Date().toISOString() }
                  : item
              )
            )
            setAckingId(null)
            setNotice(`Инцидент задачи «${incident.jobName}» отмечен как принятый.`)
          },
          err => {
            setAckingId(null)
            setError(err && err.message ? err.message : 'Не удалось подтвердить инцидент.')
          }
        )
    }

    function handleToggleResolved() {
      const next = !showResolved
      setShowResolved(next)
      loadIncidents(next)
    }

    const visible = filterIncidentsByToggle(incidents, showResolved)
    const openCount = incidents.filter(
      item => item.status === 'detected' || item.status === 'alerted'
    ).length

    return h(
      'div',
      {
        'data-testid': 'nomad-cron-incidents-card',
        style: {
          border: '1px solid rgba(128,128,128,0.25)',
          borderRadius: 10,
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          background: openCount > 0 ? 'rgba(220,38,38,0.04)' : 'rgba(128,128,128,0.04)'
        }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10
          }
        },
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          h(
            'h3',
            { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
            'Инциденты расписания'
          ),
          h(
            'span',
            {
              'data-testid': 'cron-incidents-open-badge',
              style: {
                padding: '2px 8px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: openCount > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.14)',
                color: openCount > 0 ? '#dc2626' : '#16a34a'
              }
            },
            openCount > 0 ? `Открытых: ${openCount}` : 'Нет открытых сбоев'
          )
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'cron-incidents-toggle-resolved',
              'aria-pressed': showResolved,
              onClick: handleToggleResolved,
              style: {
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.3)',
                background: showResolved ? 'rgba(37,99,235,0.12)' : 'transparent',
                fontSize: 12,
                cursor: 'pointer'
              }
            },
            'Показать закрытые'
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: () => loadIncidents(showResolved),
              style: {
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.3)',
                background: 'transparent',
                fontSize: 12,
                cursor: 'pointer'
              }
            },
            'Обновить'
          )
        )
      ),
      error &&
        h(
          'div',
          {
            role: 'alert',
            style: {
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(220,38,38,0.12)',
              color: '#dc2626',
              fontSize: 13
            }
          },
          error
        ),
      notice &&
        h(
          'div',
          {
            role: 'status',
            style: {
              padding: '8px 12px',
              borderRadius: 6,
              background: 'rgba(22,163,74,0.12)',
              color: '#16a34a',
              fontSize: 13
            }
          },
          notice
        ),
      loading &&
        h('div', { style: { fontSize: 13, opacity: 0.75 } }, 'Загрузка инцидентов расписания…'),
      !loading &&
        visible.length === 0 &&
        h(
          'div',
          { style: { fontSize: 13, opacity: 0.75 } },
          showResolved
            ? 'Журнал инцидентов расписания пуст.'
            : 'Все задачи по расписанию выполняются штатно — открытых инцидентов нет.'
        ),
      !loading &&
        visible.length > 0 &&
        h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          ...visible.map(inc => {
            const isOpen = inc.status === 'detected' || inc.status === 'alerted'
            const statusLabel = STATUS_LABELS[inc.status] || inc.status
            return h(
              'div',
              {
                key: inc.id,
                'data-testid': `cron-incident-row-${inc.id}`,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid rgba(128,128,128,0.2)',
                  background: 'rgba(128,128,128,0.05)'
                }
              },
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 auto' } },
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
                  h('span', { style: { fontWeight: 600, fontSize: 14 } }, inc.jobName),
                  h(
                    'span',
                    {
                      style: {
                        padding: '2px 7px',
                        borderRadius: 999,
                        fontSize: 11,
                        background: isOpen ? 'rgba(220,38,38,0.15)' : 'rgba(128,128,128,0.18)',
                        color: isOpen ? '#dc2626' : 'inherit'
                      }
                    },
                    statusLabel
                  ),
                  h(
                    'span',
                    {
                      'data-testid': `cron-incident-repeats-${inc.id}`,
                      style: { fontSize: 12, opacity: 0.8 }
                    },
                    `Повторов подряд: ${inc.repeatCount}`
                  )
                ),
                h(
                  'div',
                  {
                    'data-testid': `cron-incident-error-${inc.id}`,
                    style: {
                      fontSize: 12,
                      fontFamily: 'monospace',
                      opacity: 0.85,
                      wordBreak: 'break-word'
                    }
                  },
                  inc.errorText
                )
              ),
              isOpen &&
                h(
                  'button',
                  {
                    type: 'button',
                    'data-testid': `cron-incident-ack-${inc.id}`,
                    disabled: ackingId === inc.id,
                    onClick: () => handleAck(inc),
                    style: {
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: 'none',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: ackingId === inc.id ? 'default' : 'pointer',
                      flexShrink: 0
                    }
                  },
                  ackingId === inc.id ? 'Сохранение…' : 'Принято'
                )
            )
          })
        )
    )
  }
}

export default function register({ sdk, plugins }) {
  if (!sdk || !sdk.React || !sdk.hooks) {
    return
  }

  const CronIncidentsCard = createCronIncidentsCard(sdk)

  if (plugins && typeof plugins.registerSlot === 'function') {
    plugins.registerSlot(PLUGIN_NAME, SLOT_NAME, CronIncidentsCard)
  }
}
