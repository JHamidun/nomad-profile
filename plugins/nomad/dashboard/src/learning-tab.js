/**
 * Раздел «Что агент про меня понял» (`/nomad-learning`) для веб-дашборда (M-148).
 *
 * Работает строго в режиме чтения поверх `GET /api/learning/graph` и `GET /api/learning/node?id=...`.
 * Показывает узлы (`nodes`) и связи (`edges`), фильтры по типу (`kind`), домену (`domain`)
 * и порогу уверенности (`confidence`), а также подробную карточку выбранного узла при клике.
 * Операции изменения или стирания узлов из этого раздела не предоставляются.
 */

const LEARNING_GRAPH_URL = '/api/learning/graph'
const LEARNING_NODE_URL = '/api/learning/node'

const KIND_LABELS = {
  all: 'Все типы',
  skill: 'Навык',
  memory: 'Заметка памяти',
  preference: 'Предпочтение',
  fact: 'Факт профиля',
  topic: 'Тема',
  project: 'Проект'
}

export function normalizeLearningGraph(payload) {
  const rawNodes =
    payload && Array.isArray(payload.nodes)
      ? payload.nodes
      : Array.isArray(payload)
        ? payload
        : []
  const rawEdges = payload && Array.isArray(payload.edges) ? payload.edges : []

  const nodes = rawNodes.map((n, idx) => ({
    id: String(n.id || n.node_id || `node-${idx + 1}`),
    label: String(n.label || n.title || n.name || n.id || `Узел #${idx + 1}`),
    kind: String(n.kind || n.type || 'memory'),
    domain: String(n.domain || n.category || 'general'),
    confidence:
      typeof n.confidence === 'number'
        ? n.confidence
        : typeof n.score === 'number'
          ? n.score
          : 1.0,
    summary: String(n.summary || n.description || n.snippet || ''),
    updatedAt: n.updated_at || n.updatedAt || null
  }))

  const edges = rawEdges.map((e, idx) => ({
    id: String(e.id || `edge-${idx + 1}`),
    source: String(e.source || e.from || ''),
    target: String(e.target || e.to || ''),
    relation: String(e.relation || e.label || e.type || 'связан с')
  }))

  return { nodes, edges }
}

export function filterLearningNodes(nodes, filters) {
  const list = Array.isArray(nodes) ? nodes : []
  const f = filters || {}
  const kindFilter = f.kind && f.kind !== 'all' ? String(f.kind) : null
  const domainFilter = f.domain && f.domain !== 'all' ? String(f.domain) : null
  const minConfidence = typeof f.minConfidence === 'number' ? f.minConfidence : 0

  return list.filter(node => {
    if (kindFilter && node.kind !== kindFilter) {
      return false
    }
    if (domainFilter && node.domain !== domainFilter) {
      return false
    }
    if (node.confidence < minConfidence) {
      return false
    }
    return true
  })
}

export function createLearningSection(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks

  return function LearningSection() {
    const [graph, setGraph] = useState({ nodes: [], edges: [] })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const [kindFilter, setKindFilter] = useState('all')
    const [domainFilter, setDomainFilter] = useState('all')
    const [minConfidence, setMinConfidence] = useState(0)

    const [selectedNode, setSelectedNode] = useState(null)
    const [nodeDetail, setNodeDetail] = useState(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    function loadGraph() {
      setLoading(true)
      setError(null)
      sdk.fetchJSON(LEARNING_GRAPH_URL).then(
        data => {
          setGraph(normalizeLearningGraph(data))
          setLoading(false)
        },
        err => {
          setError(
            err && err.message
              ? err.message
              : 'Не удалось загрузить карту знаний вашего профиля.'
          )
          setLoading(false)
        }
      )
    }

    useEffect(() => {
      loadGraph()
    }, [])

    function handleSelectNode(node) {
      if (!node || !node.id) {
        return
      }
      setSelectedNode(node)
      setLoadingDetail(true)
      setNodeDetail(null)
      const url = `${LEARNING_NODE_URL}?id=${encodeURIComponent(node.id)}`
      sdk.fetchJSON(url).then(
        detail => {
          setNodeDetail(detail || node)
          setLoadingDetail(false)
        },
        () => {
          setNodeDetail(node)
          setLoadingDetail(false)
        }
      )
    }

    const availableKinds = ['all', ...Array.from(new Set(graph.nodes.map(n => n.kind)))]
    const availableDomains = ['all', ...Array.from(new Set(graph.nodes.map(n => n.domain)))]
    const filteredNodes = filterLearningNodes(graph.nodes, {
      kind: kindFilter,
      domain: domainFilter,
      minConfidence
    })

    const relatedEdges = selectedNode
      ? graph.edges.filter(
          e => e.source === selectedNode.id || e.target === selectedNode.id
        )
      : []

    return h(
      'div',
      {
        'data-testid': 'nomad-dashboard-learning',
        style: { display: 'flex', flexDirection: 'column', gap: 16 }
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12
          }
        },
        h(
          'div',
          null,
          h(
            'h2',
            { style: { margin: 0, fontSize: 18, fontWeight: 600 } },
            'Что агент про меня понял'
          ),
          h(
            'p',
            { style: { margin: '4px 0 0', fontSize: 13, opacity: 0.75 } },
            'Обзор накопленных знаний, навыков и предпочтений вашего профиля (режим только для чтения).'
          )
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8 } },
          h(
            'span',
            {
              'data-testid': 'learning-summary-badge',
              style: {
                padding: '5px 10px',
                borderRadius: 999,
                background: 'rgba(37,99,235,0.1)',
                fontSize: 12,
                fontWeight: 600
              }
            },
            `Узлов: ${filteredNodes.length} из ${graph.nodes.length} · Связей: ${graph.edges.length}`
          ),
          h(
            'button',
            {
              type: 'button',
              onClick: loadGraph,
              style: {
                padding: '6px 12px',
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
      h(
        'div',
        {
          'data-testid': 'learning-filters-bar',
          style: {
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'center',
            padding: 12,
            borderRadius: 8,
            border: '1px solid rgba(128,128,128,0.2)',
            background: 'rgba(128,128,128,0.04)'
          }
        },
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } },
          h('span', null, 'Тип (`kind`):'),
          h(
            'select',
            {
              'data-testid': 'learning-filter-kind',
              value: kindFilter,
              onChange: e => setKindFilter(e && e.target ? e.target.value : 'all'),
              style: {
                padding: '5px 8px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.35)',
                fontSize: 13
              }
            },
            ...availableKinds.map(k =>
              h('option', { key: k, value: k }, KIND_LABELS[k] || k)
            )
          )
        ),
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } },
          h('span', null, 'Домен (`domain`):'),
          h(
            'select',
            {
              'data-testid': 'learning-filter-domain',
              value: domainFilter,
              onChange: e => setDomainFilter(e && e.target ? e.target.value : 'all'),
              style: {
                padding: '5px 8px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.35)',
                fontSize: 13
              }
            },
            ...availableDomains.map(d =>
              h('option', { key: d, value: d }, d === 'all' ? 'Все домены' : d)
            )
          )
        ),
        h(
          'label',
          { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 } },
          h('span', null, `Уверенность от ${Math.round(minConfidence * 100)}%:`),
          h('input', {
            type: 'range',
            'data-testid': 'learning-filter-confidence',
            min: 0,
            max: 1,
            step: 0.1,
            value: minConfidence,
            onChange: e =>
              setMinConfidence(e && e.target ? Number(e.target.value) || 0 : 0)
          })
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
      loading &&
        h('div', { style: { fontSize: 13, opacity: 0.75 } }, 'Загрузка графа знаний…'),
      !loading &&
        filteredNodes.length === 0 &&
        h(
          'div',
          { style: { fontSize: 13, opacity: 0.75 } },
          'По выбранным фильтрам узлы не найдены.'
        ),
      !loading &&
        filteredNodes.length > 0 &&
        h(
          'div',
          {
            style: {
              display: 'grid',
              gridTemplateColumns: selectedNode ? '1fr 1fr' : '1fr',
              gap: 16
            }
          },
          h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            ...filteredNodes.map(node =>
              h(
                'button',
                {
                  key: node.id,
                  type: 'button',
                  'data-testid': `learning-node-item-${node.id}`,
                  onClick: () => handleSelectNode(node),
                  style: {
                    textAlign: 'left',
                    padding: 12,
                    borderRadius: 8,
                    border:
                      selectedNode && selectedNode.id === node.id
                        ? '1px solid #2563eb'
                        : '1px solid rgba(128,128,128,0.25)',
                    background:
                      selectedNode && selectedNode.id === node.id
                        ? 'rgba(37,99,235,0.08)'
                        : 'rgba(128,128,128,0.04)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }
                },
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8
                    }
                  },
                  h('span', { style: { fontWeight: 600, fontSize: 14 } }, node.label),
                  h(
                    'span',
                    { style: { fontSize: 11, opacity: 0.75 } },
                    `${KIND_LABELS[node.kind] || node.kind} · ${node.domain} · ${Math.round(
                      node.confidence * 100
                    )}%`
                  )
                ),
                node.summary &&
                  h('div', { style: { fontSize: 12, opacity: 0.8 } }, node.summary)
              )
            )
          ),
          selectedNode &&
            h(
              'div',
              {
                'data-testid': 'learning-node-detail-card',
                style: {
                  border: '1px solid rgba(128,128,128,0.25)',
                  borderRadius: 10,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }
              },
              h(
                'div',
                {
                  style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }
                },
                h(
                  'h3',
                  { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
                  selectedNode.label
                ),
                h(
                  'span',
                  { style: { fontSize: 11, opacity: 0.7 } },
                  'Только просмотр'
                )
              ),
              loadingDetail &&
                h('div', { style: { fontSize: 12, opacity: 0.75 } }, 'Загрузка содержимого узла…'),
              !loadingDetail &&
                h(
                  'pre',
                  {
                    'data-testid': 'learning-node-content',
                    style: {
                      margin: 0,
                      padding: 10,
                      borderRadius: 6,
                      background: 'rgba(128,128,128,0.08)',
                      fontSize: 12,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }
                  },
                  String(
                    (nodeDetail && (nodeDetail.content || nodeDetail.summary || nodeDetail.text)) ||
                      selectedNode.summary ||
                      'Подробное описание узла отсутствует.'
                  )
                ),
              relatedEdges.length > 0 &&
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
                  h('div', { style: { fontSize: 12, fontWeight: 600 } }, 'Связанные узлы:'),
                  ...relatedEdges.map(edge =>
                    h(
                      'div',
                      { key: edge.id, style: { fontSize: 12, opacity: 0.8 } },
                      `${edge.source} → ${edge.relation} → ${edge.target}`
                    )
                  )
                )
            )
        )
    )
  }
}

export default function register({ sdk, addSection }) {
  if (!sdk || !sdk.React || !sdk.hooks) {
    return
  }

  const LearningSection = createLearningSection(sdk)

  if (typeof addSection === 'function') {
    addSection({
      id: 'learning',
      title: 'Что агент про меня понял',
      order: 30,
      component: LearningSection
    })
  }
}
