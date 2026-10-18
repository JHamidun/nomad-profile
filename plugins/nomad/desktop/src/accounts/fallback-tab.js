/**
 * Вкладка «Порядок и запас» экрана «Аккаунты» (M-134).
 *
 * Позволяет выбрать режим обхода пула подписок и ключей (`nomad.pool_mode`),
 * а также настроить упорядоченный список запасных провайдеров (`fallback_providers`).
 * Если подключён NomadNet или включён российский контур (`nomad.ru_only: true`),
 * блок внешних запасных провайдеров отображается заблокированным с русским пояснением.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { callNomadApi } from './billing-tab.js';

export function FallbackTab({ ctx }) {
  const [poolMode, setPoolMode] = useState('Subscription -> API');
  const [availableModes, setAvailableModes] = useState([]);
  const [providers, setProviders] = useState([]);
  const [knownProviders, setKnownProviders] = useState([]);
  const [restricted, setRestricted] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [newProvider, setNewProvider] = useState('openrouter');
  const [newModel, setNewModel] = useState('anthropic/claude-sonnet-4.5');
  const [newBaseUrl, setNewBaseUrl] = useState('');

  const loadFallback = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callNomadApi(ctx, '/accounts/fallback');
      setPoolMode(data?.pool_mode || 'Subscription -> API');
      setAvailableModes(Array.isArray(data?.available_pool_modes) ? data.available_pool_modes : []);
      setProviders(Array.isArray(data?.fallback_providers) ? data.fallback_providers : []);
      setKnownProviders(Array.isArray(data?.known_providers) ? data.known_providers : []);
      setRestricted(Boolean(data?.restricted));
      setRestrictionReason(data?.restriction_reason || '');
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить настройки порядка и запаса.');
    } finally {
      setLoading(false);
    }
  }, [ctx]);

  useEffect(() => {
    loadFallback();
  }, [loadFallback]);

  const saveSettings = async (nextPoolMode, nextProviders, successMessage) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = { pool_mode: nextPoolMode };
      if (nextProviders !== undefined) {
        payload.fallback_providers = nextProviders;
      }
      const res = await callNomadApi(ctx, '/accounts/fallback', {
        method: 'PUT',
        body: payload,
      });
      setPoolMode(res?.pool_mode || nextPoolMode);
      setProviders(Array.isArray(res?.fallback_providers) ? res.fallback_providers : []);
      setRestricted(Boolean(res?.restricted));
      setRestrictionReason(res?.restriction_reason || '');
      setNotice(successMessage || 'Настройки сохранены.');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить настройки.');
    } finally {
      setSaving(false);
    }
  };

  const handleModeChange = async (modeId) => {
    setPoolMode(modeId);
    await saveSettings(modeId, undefined, 'Режим обхода пула сохранён.');
  };

  const handleMove = async (index, delta) => {
    if (restricted) return;
    const target = index + delta;
    if (target < 0 || target >= providers.length) return;
    const next = providers.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setProviders(next);
    await saveSettings(poolMode, next, 'Порядок запасных провайдеров обновлён.');
  };

  const handleRemove = async (index) => {
    if (restricted) return;
    const next = providers.filter((_, i) => i !== index);
    setProviders(next);
    await saveSettings(poolMode, next, 'Запасной провайдер удалён из цепочки.');
  };

  const handleAddProvider = async (e) => {
    e.preventDefault();
    if (restricted) {
      setError(restrictionReason || 'Добавление внешних запасных провайдеров заблокировано.');
      return;
    }
    const p = newProvider.trim();
    const m = newModel.trim();
    if (!p || !m) {
      setError('Укажите провайдера и название модели.');
      return;
    }
    const entry = { provider: p, model: m };
    if (newBaseUrl.trim()) {
      entry.base_url = newBaseUrl.trim();
    }
    const next = [...providers, entry];
    await saveSettings(poolMode, next, 'Запасной провайдер добавлен в цепочку.');
    setNewBaseUrl('');
  };

  return (
    <div className="nomad-fallback-tab" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {error ? (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#991b1b',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '13px',
          }}
        >
          {notice}
        </div>
      ) : null}

      <section
        style={{
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>Порядок обхода аккаунтов в пуле</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
          Выберите, в каком порядке агент переключается между вашими подписками и ключами при достижении лимитов.
        </p>

        <div style={{ display: 'grid', gap: '8px' }}>
          {(availableModes.length > 0
            ? availableModes
            : [
                {
                  id: 'Subscription -> API',
                  label: 'Сначала подписки, затем ключи API',
                  description: 'Приоритет отдаётся входам по подписке; при упоре в лимит запрос переходит на ключи API.',
                },
                {
                  id: 'Round-Robin',
                  label: 'По очереди (равномерно)',
                  description: 'Запросы распределяются по кругу между всеми готовыми аккаунтами.',
                },
                {
                  id: 'Priority',
                  label: 'Строго по приоритету',
                  description: 'Всегда выбирается первый доступный аккаунт с наивысшим приоритетом.',
                },
                {
                  id: 'Single',
                  label: 'Только активный аккаунт',
                  description: 'Автоматическое переключение отключено.',
                },
              ]
          ).map((mode) => {
            const active = poolMode === mode.id;
            return (
              <label
                key={mode.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: active ? '2px solid #18181B' : '1px solid #cbd5e1',
                  background: active ? '#F4F4F5' : '#f8fafc',
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="radio"
                  name="nomad-pool-mode"
                  value={mode.id}
                  checked={active}
                  disabled={saving}
                  onChange={() => handleModeChange(mode.id)}
                  style={{ marginTop: '3px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{mode.label}</div>
                  <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{mode.description}</div>
                </div>
              </label>
            );
          })}
        </div>
      </section>

      <section
        style={{
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: restricted ? '#f8fafc' : '#ffffff',
          opacity: restricted ? 0.92 : 1,
        }}
      >
        <h3 style={{ margin: '0 0 6px 0', fontSize: '16px' }}>Запасные внешние провайдеры</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569' }}>
          Если все аккаунты основного пула недоступны или исчерпали лимит, запрос пойдёт по этому списку сверху вниз.
        </p>

        {restricted ? (
          <div
            data-testid="fallback-restricted-banner"
            style={{
              padding: '12px 14px',
              borderRadius: '8px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              color: '#92400e',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            <strong>Секция внешних запасных провайдеров заблокирована:</strong>{' '}
            {restrictionReason ||
              'При активном подключении к NomadNet или включённом российском контуре внешние запасные провайдеры отключены.'}
          </div>
        ) : null}

        {loading ? (
          <div style={{ fontSize: '13px', color: '#64748b' }}>Загружаем список запасных провайдеров…</div>
        ) : providers.length === 0 ? (
          <div
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: '1px dashed #cbd5e1',
              color: '#64748b',
              fontSize: '13px',
              marginBottom: '12px',
            }}
          >
            Цепочка запасных провайдеров пуста. Используется только основной пул аккаунтов.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px', marginBottom: '14px' }}>
            {providers.map((item, idx) => (
              <div
                key={`${item.provider}-${item.model}-${idx}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, fontSize: '14px', marginRight: '8px' }}>
                    #{idx + 1} · {item.provider}
                  </span>
                  <code style={{ fontSize: '13px', color: '#1e293b' }}>{item.model}</code>
                  {item.base_url ? (
                    <span style={{ fontSize: '12px', color: '#64748b', marginLeft: '8px' }}>
                      ({item.base_url})
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    disabled={restricted || saving || idx === 0}
                    onClick={() => handleMove(idx, -1)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    ↑ Выше
                  </button>
                  <button
                    type="button"
                    disabled={restricted || saving || idx === providers.length - 1}
                    onClick={() => handleMove(idx, 1)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                  >
                    ↓ Ниже
                  </button>
                  <button
                    type="button"
                    disabled={restricted || saving}
                    onClick={() => handleRemove(idx)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '6px',
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#991b1b',
                      cursor: 'pointer',
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={handleAddProvider}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: '8px',
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#334155' }}>
            Провайдер
            <select
              value={newProvider}
              disabled={restricted || saving}
              onChange={(e) => {
                const val = e.target.value;
                setNewProvider(val);
                const preset = knownProviders.find((p) => p.id === val);
                if (preset && preset.default_model) {
                  setNewModel(preset.default_model);
                }
              }}
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            >
              {(knownProviders.length > 0
                ? knownProviders
                : [
                    { id: 'openrouter', label: 'OpenRouter' },
                    { id: 'openai', label: 'OpenAI API' },
                    { id: 'anthropic', label: 'Anthropic API' },
                    { id: 'deepseek', label: 'DeepSeek' },
                    { id: 'gemini', label: 'Google Gemini' },
                    { id: 'custom', label: 'Свой совместимый адрес (OpenAI API)' },
                  ]
              ).map((kp) => (
                <option key={kp.id} value={kp.id}>
                  {kp.label} ({kp.id})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#334155' }}>
            Модель
            <input
              type="text"
              value={newModel}
              disabled={restricted || saving}
              onChange={(e) => setNewModel(e.target.value)}
              placeholder="например, gpt-4.1"
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#334155' }}>
            Адрес API (необязательно)
            <input
              type="text"
              value={newBaseUrl}
              disabled={restricted || saving}
              onChange={(e) => setNewBaseUrl(e.target.value)}
              placeholder="https://..."
              style={{ padding: '7px 10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </label>

          <button
            type="submit"
            disabled={restricted || saving}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid #18181B',
              background: restricted ? '#94a3b8' : '#18181B',
              color: '#ffffff',
              fontWeight: 600,
              cursor: restricted ? 'not-allowed' : 'pointer',
            }}
          >
            Добавить в запас
          </button>
        </form>
      </section>

      <section
        data-testid="nomad-harness-role-modes-card"
        style={{
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'grid',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '16px' }}>Ролевые режимы агента и гибридный каскад (NemoClaw / Roo Code)</h3>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#F4F4F5',
                color: '#18181B',
              }}
            >
              Architect · Code · Debug · Orchestrator
            </span>
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#475569' }}>
            Автоматическое распределение моделей по роли шага: архитектура и планирование идут на флагманы рассуждений, массовый кодинг — на быстрые кодовые модели, а локальная классификация и фильтрация ПДн — на локальный контур NIM / vLLM / Ollama.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
          {[
            { role: 'Архитектор (Architect)', model: 'claude-opus-5-5 / gpt-6-astra', desc: 'Проектирование, ТЗ, декомпозиция и ревью безопасности (Read-Only + План)' },
            { role: 'Инженер кода (Code)', model: 'gpt-6.1-sol / kimi-k2.7-code', desc: 'Написание и рефакторинг кода, автозапуск тестов и линтеров' },
            { role: 'Отладка (Debug)', model: 'claude-sonnet-5-5 / deepseek-v4-pro', desc: 'Анализ стектрейсов, воспроизведение багов и точечные фиксы' },
            { role: 'Оркестратор роя (Swarm)', model: 'jev-1.13.0 + пул воркеров', desc: 'Параллельный запуск субагентов в изолированных Git Worktree ветках' },
          ].map((item) => (
            <div
              key={item.role}
              style={{
                padding: '10px 12px',
                borderRadius: '9px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{item.role}</div>
              <code style={{ fontSize: '11.5px', color: '#18181B', fontWeight: 600 }}>{item.model}</code>
              <div style={{ fontSize: '11.5px', color: '#475569', lineHeight: 1.4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
