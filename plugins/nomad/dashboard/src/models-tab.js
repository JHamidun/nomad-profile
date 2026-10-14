/**
 * Раздел «Модели и локальные серверы» (`/nomad-models`) для веб-дашборда (M-145).
 *
 * Позволяет:
 * 1. Подключать и проверять локальные серверы моделей:
 *    - Ollama (`http://127.0.0.1:11434`, `/api/tags`),
 *    - LM Studio (`http://127.0.0.1:1234`, `/api/v1/models`),
 *    - vLLM (`http://127.0.0.1:8000`, `/v1/models`),
 *    а также скачивать и активировать локальные модели из встроенного каталога (`/api/local-models/*`).
 * 2. Добавлять свой OpenAI-совместимый эндпоинт (`base_url`, `api_key`, список моделей).
 * 3. Проверять доступность кнопкой «Проверить соединение» и назначать выбранную модель основной
 *    кнопкой «Сделать рабочей моделью».
 */

const LOCAL_MODELS_API = '/api/plugins/nomad/models/local'
const LOCAL_MODELS_TEST_API = '/api/plugins/nomad/models/local/test'
const LOCAL_MODELS_ACTIVATE_API = '/api/plugins/nomad/models/local/activate'
const UPSTREAM_LOCAL_CATALOG_API = '/api/local-models/catalog'
const UPSTREAM_LOCAL_DOWNLOAD_API = '/api/local-models/download'
const UPSTREAM_LOCAL_ACTIVATE_API = '/api/local-models/activate'

export const LOCAL_SERVER_PRESETS = [
  {
    id: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    probePath: '/api/tags',
    openaiBaseUrl: 'http://127.0.0.1:11434/v1',
    description: 'Локальный сервер Ollama (проверка через /api/tags).'
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    defaultBaseUrl: 'http://127.0.0.1:1234',
    probePath: '/api/v1/models',
    openaiBaseUrl: 'http://127.0.0.1:1234/v1',
    description: 'Локальный сервер LM Studio (проверка через /api/v1/models).'
  },
  {
    id: 'vllm',
    label: 'vLLM',
    defaultBaseUrl: 'http://127.0.0.1:8000',
    probePath: '/v1/models',
    openaiBaseUrl: 'http://127.0.0.1:8000/v1',
    description: 'Высокопроизводительный сервер vLLM (проверка через /v1/models).'
  }
]

export function extractModelIdsFromProbe(payload) {
  if (!payload || typeof payload !== 'object') {
    return []
  }
  if (Array.isArray(payload.models)) {
    return payload.models
      .map(item =>
        typeof item === 'string'
          ? item
          : String((item && (item.id || item.name || item.model || item.key)) || '')
      )
      .filter(Boolean)
  }
  if (Array.isArray(payload.data)) {
    return payload.data
      .map(item =>
        typeof item === 'string' ? item : String((item && (item.id || item.name || item.model)) || '')
      )
      .filter(Boolean)
  }
  return []
}

export function createModelsSection(sdk) {
  const h = sdk.React.createElement
  const { useState, useEffect } = sdk.hooks

  return function ModelsSection() {
    const [activePreset, setActivePreset] = useState('ollama')
    const [serverBaseUrl, setServerBaseUrl] = useState('http://127.0.0.1:11434')
    const [discoveredModels, setDiscoveredModels] = useState([])
    const [selectedModel, setSelectedModel] = useState('')
    const [currentModel, setCurrentModel] = useState({ model: '', provider: '', baseUrl: '' })

    const [customBaseUrl, setCustomBaseUrl] = useState('')
    const [customApiKey, setCustomApiKey] = useState('')
    const [customModelsText, setCustomModelsText] = useState('')
    const [customDiscovered, setCustomDiscovered] = useState([])

    const [catalogModels, setCatalogModels] = useState([])
    const [testing, setTesting] = useState(false)
    const [activating, setActivating] = useState(false)
    const [downloadingId, setDownloadingId] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [notice, setNotice] = useState(null)

    function loadState() {
      setLoading(true)
      setError(null)
      sdk.fetchJSON(LOCAL_MODELS_API).then(
        data => {
          if (data && typeof data === 'object') {
            setCurrentModel({
              model: String(data.model || ''),
              provider: String(data.provider || ''),
              baseUrl: String(data.base_url || data.baseUrl || '')
            })
            if (Array.isArray(data.models) && data.models.length > 0) {
              setDiscoveredModels(data.models.map(String))
              setSelectedModel(String(data.models[0]))
            }
            if (data.custom_base_url) {
              setCustomBaseUrl(String(data.custom_base_url))
            }
            if (Array.isArray(data.custom_models) && data.custom_models.length > 0) {
              setCustomModelsText(data.custom_models.join(', '))
              setCustomDiscovered(data.custom_models.map(String))
            }
          }
          setLoading(false)
        },
        () => {
          setLoading(false)
        }
      )

      sdk.fetchJSON(UPSTREAM_LOCAL_CATALOG_API).then(
        cat => {
          const list = Array.isArray(cat)
            ? cat
            : cat && Array.isArray(cat.models)
              ? cat.models
              : []
          setCatalogModels(list)
        },
        () => {}
      )
    }

    useEffect(() => {
      loadState()
    }, [])

    function handleSelectPreset(presetId) {
      const preset = LOCAL_SERVER_PRESETS.find(p => p.id === presetId) || LOCAL_SERVER_PRESETS[0]
      setActivePreset(preset.id)
      setServerBaseUrl(preset.defaultBaseUrl)
      setError(null)
      setNotice(null)
    }

    function handleTestConnection(targetKind) {
      const isCustom = targetKind === 'custom'
      const preset = LOCAL_SERVER_PRESETS.find(p => p.id === activePreset) || LOCAL_SERVER_PRESETS[0]
      const baseUrl = (isCustom ? customBaseUrl : serverBaseUrl).trim()
      if (!baseUrl) {
        setError('Пожалуйста, укажите адрес сервера (base_url).')
        return
      }
      setTesting(true)
      setError(null)
      setNotice(null)

      const manualModels = isCustom
        ? customModelsText
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
        : []

      sdk
        .fetchJSON(LOCAL_MODELS_TEST_API, {
          method: 'POST',
          body: JSON.stringify({
            kind: isCustom ? 'custom' : preset.id,
            base_url: baseUrl,
            probe_path: isCustom ? '/v1/models' : preset.probePath,
            api_key: isCustom ? customApiKey.trim() : '',
            models: manualModels
          })
        })
        .then(
          data => {
            setTesting(false)
            const models = extractModelIdsFromProbe(data)
            if (isCustom) {
              const merged = models.length > 0 ? models : manualModels
              setCustomDiscovered(merged)
              if (merged.length > 0 && !selectedModel) {
                setSelectedModel(merged[0])
              }
            } else {
              setDiscoveredModels(models)
              if (models.length > 0) {
                setSelectedModel(models[0])
              }
            }
            if (data && data.reachable === false) {
              setError(
                data.message ||
                  'Сервер не ответил на запрос проверки. Проверьте, что локальный сервер запущен.'
              )
            } else {
              setNotice(
                (data && data.message) ||
                  `Соединение проверено успешно. Найдено моделей: ${models.length}.`
              )
            }
          },
          err => {
            setTesting(false)
            setError(err && err.message ? err.message : 'Не удалось проверить соединение.')
          }
        )
    }

    function handleActivateModel(modelName, options) {
      const opts = options || {}
      const targetModel = String(modelName || selectedModel || '').trim()
      if (!targetModel) {
        setError('Выберите или укажите идентификатор модели для активации.')
        return
      }
      setActivating(true)
      setError(null)
      setNotice(null)
      const preset = LOCAL_SERVER_PRESETS.find(p => p.id === activePreset) || LOCAL_SERVER_PRESETS[0]
      const isCustom = Boolean(opts.isCustom)
      const baseUrl = isCustom
        ? customBaseUrl.trim()
        : (opts.baseUrl || serverBaseUrl || preset.openaiBaseUrl).trim()

      sdk
        .fetchJSON(LOCAL_MODELS_ACTIVATE_API, {
          method: 'POST',
          body: JSON.stringify({
            model: targetModel,
            provider: isCustom ? 'custom' : preset.id,
            base_url: baseUrl,
            api_key: isCustom ? customApiKey.trim() : '',
            models: isCustom
              ? customModelsText
                  .split(',')
                  .map(s => s.trim())
                  .filter(Boolean)
              : discoveredModels
          })
        })
        .then(
          data => {
            setActivating(false)
            setCurrentModel({
              model: (data && data.model) || targetModel,
              provider: (data && data.provider) || (isCustom ? 'custom' : preset.id),
              baseUrl: (data && data.base_url) || baseUrl
            })
            setNotice(`Модель «${targetModel}» назначена вашей рабочей моделью.`)
          },
          err => {
            setActivating(false)
            setError(err && err.message ? err.message : 'Не удалось активировать выбранную модель.')
          }
        )
    }

    function handleDownloadAndActivateCatalogModel(item) {
      const modelId = String((item && (item.id || item.model_id || item.name)) || '')
      if (!modelId) {
        return
      }
      setDownloadingId(modelId)
      setError(null)
      setNotice(null)
      sdk
        .fetchJSON(UPSTREAM_LOCAL_DOWNLOAD_API, {
          method: 'POST',
          body: JSON.stringify({ model_id: modelId })
        })
        .then(
          () =>
            sdk.fetchJSON(UPSTREAM_LOCAL_ACTIVATE_API, {
              method: 'POST',
              body: JSON.stringify({ model_id: modelId })
            }),
          () =>
            sdk.fetchJSON(LOCAL_MODELS_ACTIVATE_API, {
              method: 'POST',
              body: JSON.stringify({
                model: modelId,
                provider: 'llamacpp',
                base_url: 'http://127.0.0.1:8080/v1'
              })
            })
        )
        .then(
          () => {
            setDownloadingId(null)
            setCurrentModel({
              model: modelId,
              provider: 'llamacpp',
              baseUrl: 'http://127.0.0.1:8080/v1'
            })
            setNotice(`Локальная модель «${modelId}» подготовлена и назначена рабочей моделью.`)
          },
          err => {
            setDownloadingId(null)
            setError(err && err.message ? err.message : 'Не удалось подготовить локальную модель.')
          }
        )
    }

    const currentPreset =
      LOCAL_SERVER_PRESETS.find(p => p.id === activePreset) || LOCAL_SERVER_PRESETS[0]

    return h(
      'div',
      {
        'data-testid': 'nomad-dashboard-models',
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
            'Модели и локальные серверы'
          ),
          h(
            'p',
            { style: { margin: '4px 0 0', fontSize: 13, opacity: 0.75 } },
            'Подключайте локальные серверы (Ollama, LM Studio, vLLM) или собственные OpenAI-совместимые эндпоинты для работы без внешних ключей.'
          )
        ),
        currentModel.model &&
          h(
            'div',
            {
              'data-testid': 'active-model-badge',
              style: {
                padding: '6px 12px',
                borderRadius: 999,
                background: 'rgba(37,99,235,0.12)',
                fontSize: 13,
                fontWeight: 600
              }
            },
            `Рабочая модель: ${currentModel.model}`
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
      loading && h('div', { style: { fontSize: 13, opacity: 0.75 } }, 'Загрузка настроек моделей…'),
      h(
        'div',
        {
          'data-testid': 'local-servers-card',
          style: {
            border: '1px solid rgba(128,128,128,0.25)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }
        },
        h('h3', { style: { margin: 0, fontSize: 15, fontWeight: 600 } }, 'Локальные серверы ИИ'),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          ...LOCAL_SERVER_PRESETS.map(preset =>
            h(
              'button',
              {
                key: preset.id,
                type: 'button',
                'data-testid': `preset-btn-${preset.id}`,
                onClick: () => handleSelectPreset(preset.id),
                style: {
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: '1px solid rgba(128,128,128,0.3)',
                  background: activePreset === preset.id ? '#2563eb' : 'transparent',
                  color: activePreset === preset.id ? '#fff' : 'inherit',
                  fontSize: 13,
                  fontWeight: activePreset === preset.id ? 600 : 400,
                  cursor: 'pointer'
                }
              },
              preset.label
            )
          )
        ),
        h(
          'div',
          { style: { fontSize: 12, opacity: 0.75 } },
          `${currentPreset.description} Маршрут проверки: ${currentPreset.probePath}`
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
          h('input', {
            type: 'text',
            'data-testid': 'local-server-url-input',
            value: serverBaseUrl,
            onChange: e => setServerBaseUrl(e && e.target ? e.target.value : ''),
            placeholder: currentPreset.defaultBaseUrl,
            'aria-label': 'Адрес локального сервера',
            style: {
              flex: '1 1 260px',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.35)',
              fontSize: 13
            }
          }),
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'test-local-connection-btn',
              disabled: testing,
              onClick: () => handleTestConnection('local'),
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.35)',
                background: 'transparent',
                fontSize: 13,
                cursor: testing ? 'default' : 'pointer'
              }
            },
            testing ? 'Проверка…' : 'Проверить соединение'
          )
        ),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' } },
          h('input', {
            type: 'text',
            'data-testid': 'local-model-name-input',
            value: selectedModel,
            onChange: e => setSelectedModel(e && e.target ? e.target.value : ''),
            placeholder: 'Имя локальной модели (например, qwen2.5-coder:7b)',
            'aria-label': 'Имя локальной модели',
            style: {
              flex: '1 1 260px',
              padding: '7px 10px',
              borderRadius: 6,
              border: '1px solid rgba(128,128,128,0.35)',
              fontSize: 13
            }
          }),
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'activate-local-model-btn',
              disabled: activating,
              onClick: () => handleActivateModel(selectedModel, { isCustom: false }),
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: activating ? 'default' : 'pointer'
              }
            },
            'Сделать рабочей моделью'
          )
        ),
        discoveredModels.length > 0 &&
          h(
            'div',
            { style: { display: 'flex', gap: 6, flexWrap: 'wrap' } },
            ...discoveredModels.map(m =>
              h(
                'button',
                {
                  key: m,
                  type: 'button',
                  onClick: () => setSelectedModel(m),
                  style: {
                    padding: '4px 10px',
                    borderRadius: 999,
                    border: '1px solid rgba(128,128,128,0.3)',
                    background: selectedModel === m ? 'rgba(37,99,235,0.15)' : 'transparent',
                    fontSize: 12,
                    cursor: 'pointer'
                  }
                },
                m
              )
            )
          )
      ),
      h(
        'div',
        {
          'data-testid': 'custom-endpoint-card',
          style: {
            border: '1px solid rgba(128,128,128,0.25)',
            borderRadius: 10,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }
        },
        h(
          'h3',
          { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
          'Свой OpenAI-совместимый эндпоинт'
        ),
        h(
          'p',
          { style: { margin: 0, fontSize: 12, opacity: 0.75 } },
          'Укажите базовый URL (base_url), необязательный API-ключ и список моделей через запятую.'
        ),
        h('input', {
          type: 'text',
          'data-testid': 'custom-base-url-input',
          value: customBaseUrl,
          onChange: e => setCustomBaseUrl(e && e.target ? e.target.value : ''),
          placeholder: 'https://llm.internal.example/v1',
          'aria-label': 'Базовый URL (base_url)',
          style: {
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.35)',
            fontSize: 13
          }
        }),
        h('input', {
          type: 'password',
          'data-testid': 'custom-api-key-input',
          value: customApiKey,
          onChange: e => setCustomApiKey(e && e.target ? e.target.value : ''),
          placeholder: 'API-ключ (необязательно для локальных прокси)',
          'aria-label': 'API-ключ (api_key)',
          style: {
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.35)',
            fontSize: 13
          }
        }),
        h('input', {
          type: 'text',
          'data-testid': 'custom-models-input',
          value: customModelsText,
          onChange: e => setCustomModelsText(e && e.target ? e.target.value : ''),
          placeholder: 'Список моделей через запятую (например, deepseek-r1, qwen-2.5-72b)',
          'aria-label': 'Список моделей',
          style: {
            padding: '7px 10px',
            borderRadius: 6,
            border: '1px solid rgba(128,128,128,0.35)',
            fontSize: 13
          }
        }),
        h(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'test-custom-connection-btn',
              disabled: testing,
              onClick: () => handleTestConnection('custom'),
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                border: '1px solid rgba(128,128,128,0.35)',
                background: 'transparent',
                fontSize: 13,
                cursor: testing ? 'default' : 'pointer'
              }
            },
            'Проверить соединение'
          ),
          h(
            'button',
            {
              type: 'button',
              'data-testid': 'activate-custom-model-btn',
              disabled: activating,
              onClick: () => {
                const firstCustom =
                  customDiscovered[0] ||
                  customModelsText
                    .split(',')
                    .map(s => s.trim())
                    .filter(Boolean)[0] ||
                  selectedModel
                handleActivateModel(firstCustom, { isCustom: true })
              },
              style: {
                padding: '7px 14px',
                borderRadius: 6,
                border: 'none',
                background: '#2563eb',
                color: '#fff',
                fontSize: 13,
                fontWeight: 500,
                cursor: activating ? 'default' : 'pointer'
              }
            },
            'Сделать рабочей моделью'
          )
        )
      ),
      catalogModels.length > 0 &&
        h(
          'div',
          {
            'data-testid': 'catalog-models-card',
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
            'h3',
            { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
            'Каталог автономных GGUF-моделей'
          ),
          ...catalogModels.map((item, idx) => {
            const mId = String(item.id || item.model_id || item.name || `model-${idx + 1}`)
            return h(
              'div',
              {
                key: mId,
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: 'rgba(128,128,128,0.06)'
                }
              },
              h('span', { style: { fontSize: 13, fontWeight: 500 } }, item.label || mId),
              h(
                'button',
                {
                  type: 'button',
                  disabled: downloadingId === mId,
                  onClick: () => handleDownloadAndActivateCatalogModel(item),
                  style: {
                    padding: '5px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#2563eb',
                    color: '#fff',
                    fontSize: 12,
                    cursor: 'pointer'
                  }
                },
                downloadingId === mId ? 'Загрузка…' : 'Скачать и сделать рабочей моделью'
              )
            )
          })
        )
    )
  }
}

export default function register({ sdk, addSection }) {
  if (!sdk || !sdk.React || !sdk.hooks) {
    return
  }

  const ModelsSection = createModelsSection(sdk)

  if (typeof addSection === 'function') {
    addSection({
      id: 'models',
      title: 'Модели и локальные серверы',
      order: 20,
      component: ModelsSection
    })
  }
}
