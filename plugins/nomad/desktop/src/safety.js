/**
 * М-140: Экран десктопа «Разрешения и безопасность» (/nomad-safety).
 *
 * Показывает подсказки для постоянного белого списка команд (`command_allowlist`)
 * на основе истории вызовов в `state.db`, позволяет принимать или отключать правила,
 * а также управлять списком жёстких запретов `approvals.deny` (действующих даже в режиме --yolo).
 */
import {
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
} from '@hermes/plugin-sdk';
import { createElement, useCallback, useEffect, useState } from 'react';

export const SAFETY_ROUTE_PATH = '/nomad-safety';
export const SAFETY_NAV_ID = 'safety';
export const SAFETY_NAV_LABEL = 'Разрешения и безопасность';
export const SAFETY_NAV_ORDER = 63;

const h = createElement;

function restGet(ctx, path) {
  if (typeof ctx?.rest?.get === 'function') {
    return Promise.resolve(ctx.rest.get(path));
  }
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(ctx.rest(path));
  }
  return Promise.resolve(null);
}

function restPost(ctx, path, body) {
  if (typeof ctx?.rest?.post === 'function') {
    return Promise.resolve(ctx.rest.post(path, body));
  }
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(ctx.rest(path, { method: 'POST', body }));
  }
  return Promise.resolve(null);
}

export function NomadSafetyPage({ ctx }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [proposals, setProposals] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [denyRules, setDenyRules] = useState([]);
  const [egress, setEgress] = useState(null);
  const [newAllowPattern, setNewAllowPattern] = useState('');
  const [newDenyPattern, setNewDenyPattern] = useState('');
  const [busy, setBusy] = useState(false);

  const applyOverview = useCallback((res) => {
    if (!res || typeof res !== 'object') return;
    setProposals(Array.isArray(res.proposals) ? res.proposals : []);
    setAllowlist(Array.isArray(res.command_allowlist) ? res.command_allowlist : []);
    setDenyRules(Array.isArray(res.approvals_deny) ? res.approvals_deny : []);
    if (res.egress && typeof res.egress === 'object') {
      setEgress(res.egress);
    }
  }, []);

  const loadSafety = useCallback(() => {
    if (!ctx?.rest) {
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    setError(null);
    return restGet(ctx, '/safety')
      .then((res) => {
        applyOverview(res);
        setLoading(false);
        return res;
      })
      .catch((err) => {
        setLoading(false);
        setError(err?.message || 'Не удалось загрузить настройки разрешений и безопасности.');
        return null;
      });
  }, [ctx, applyOverview]);

  useEffect(() => {
    loadSafety();
  }, [loadSafety]);

  const handleAcceptSuggestion = useCallback(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice('');
      return restPost(ctx, '/safety/suggestions/accept', { pattern })
        .then((res) => {
          applyOverview(res);
          setNotice(`Шаблон «${pattern}» добавлен в список разрешённых команд.`);
          return res;
        })
        .catch((err) => {
          setError(err?.message || 'Не удалось принять подсказку.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [ctx, applyOverview],
  );

  const handleRemoveAllowlist = useCallback(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice('');
      return restPost(ctx, '/safety/allowlist/remove', { pattern })
        .then((res) => {
          applyOverview(res);
          setNotice(`Шаблон «${pattern}» удалён из разрешённых команд.`);
          return res;
        })
        .catch((err) => {
          setError(err?.message || 'Не удалось отключить правило.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [ctx, applyOverview],
  );

  const handleAddAllowlist = useCallback(
    (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const pat = newAllowPattern.trim();
      if (!pat) return Promise.resolve(null);
      return handleAcceptSuggestion(pat).then((res) => {
        setNewAllowPattern('');
        return res;
      });
    },
    [newAllowPattern, handleAcceptSuggestion],
  );

  const handleAddDeny = useCallback(
    (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const pat = newDenyPattern.trim();
      if (!ctx?.rest || !pat) return Promise.resolve(null);
      setBusy(true);
      setNotice('');
      return restPost(ctx, '/safety/deny/add', { pattern: pat })
        .then((res) => {
          applyOverview(res);
          setNewDenyPattern('');
          setNotice(`Правило запрета «${pat}» сохранено в approvals.deny.`);
          return res;
        })
        .catch((err) => {
          setError(err?.message || 'Не удалось добавить правило запрета.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [ctx, newDenyPattern, applyOverview],
  );

  const handleRemoveDeny = useCallback(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice('');
      return restPost(ctx, '/safety/deny/remove', { pattern })
        .then((res) => {
          applyOverview(res);
          setNotice(`Правило запрета «${pattern}» удалено.`);
          return res;
        })
        .catch((err) => {
          setError(err?.message || 'Не удалось удалить правило запрета.');
        })
        .finally(() => {
          setBusy(false);
        });
    },
    [ctx, applyOverview],
  );

  return h(
    'div',
    {
      className: 'nomad-safety-page',
      style: { padding: '24px', maxWidth: '1040px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
    },
    h(
      'header',
      null,
      h('h1', { style: { fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' } }, SAFETY_NAV_LABEL),
      h(
        'p',
        { style: { margin: 0, fontSize: '13px', opacity: 0.78 } },
        'Настройте, какие команды агент может запускать без лишних вопросов, а какие команды строго запрещены при любых обстоятельствах.',
      ),
    ),
    error
      ? h(
          'div',
          {
            role: 'alert',
            style: {
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(248,81,73,0.14)',
              border: '1px solid rgba(248,81,73,0.4)',
            },
          },
          error,
        )
      : null,
    notice
      ? h(
          'div',
          {
            style: {
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(46,160,67,0.14)',
              border: '1px solid rgba(46,160,67,0.4)',
              fontSize: '13px',
            },
          },
          notice,
        )
      : null,
    h(
      'section',
      {
        className: 'nomad-safety-suggestions',
        style: {
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.24)',
        },
      },
      h('h3', { style: { margin: '0 0 6px 0', fontSize: '16px' } }, 'Подсказки из вашей истории запусков'),
      h(
        'p',
        { style: { margin: '0 0 12px 0', fontSize: '13px', opacity: 0.78 } },
        'Команды, которые вы неоднократно запускали в сессиях. Примите подсказку, чтобы разрешить шаблон в command_allowlist.',
      ),
      loading
        ? h('div', { style: { fontSize: '13px', opacity: 0.7 } }, 'Анализируем историю вызовов…')
        : proposals.length === 0
          ? h(
              'div',
              { style: { fontSize: '13px', opacity: 0.72 } },
              'Новых подсказок пока нет — все частые команды уже добавлены или история пуста.',
            )
          : h(
              'div',
              { style: { display: 'grid', gap: '8px' } },
              ...proposals.map((prop) =>
                h(
                  'div',
                  {
                    key: prop.pattern,
                    className: 'nomad-safety-proposal-row',
                    style: {
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(128,128,128,0.22)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    },
                  },
                  h(
                    'div',
                    null,
                    h('code', { style: { fontWeight: 600, fontSize: '13px' } }, prop.pattern),
                    h(
                      'span',
                      { style: { fontSize: '12px', opacity: 0.72, marginLeft: '10px' } },
                      `вызовов: ${prop.count} · тип: ${prop.kind === 'prefix' ? 'префикс' : 'точное совпадение'}`,
                    ),
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      disabled: busy,
                      title: 'Принять подсказку и добавить команду в разрешённые',
                      'data-tooltip': 'Принять подсказку и добавить команду в разрешённые',
                      onClick: () => handleAcceptSuggestion(prop.pattern),
                      style: {
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontWeight: 600,
                        cursor: 'pointer',
                      },
                    },
                    'Разрешить',
                  ),
                ),
              ),
            ),
    ),
    h(
      'section',
      {
        className: 'nomad-safety-allowlist',
        style: {
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.24)',
        },
      },
      h('h3', { style: { margin: '0 0 6px 0', fontSize: '16px' } }, 'Постоянно разрешённые команды (command_allowlist)'),
      h(
        'form',
        {
          onSubmit: handleAddAllowlist,
          style: { display: 'flex', gap: '8px', marginBottom: '12px' },
        },
        h('input', {
          type: 'text',
          value: newAllowPattern,
          title: 'Шаблон разрешённой команды для белого списка',
          'data-tooltip': 'Шаблон разрешённой команды для белого списка',
          onChange: (e) => setNewAllowPattern(e?.target?.value ?? ''),
          placeholder: 'Например: git status или pytest *',
          style: {
            flex: '1 1 auto',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(128,128,128,0.3)',
            background: 'transparent',
            color: 'inherit',
          },
        }),
        h(
          'button',
          {
            type: 'submit',
            disabled: busy,
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
            },
          },
          'Добавить разрешение',
        ),
      ),
      allowlist.length === 0
        ? h('div', { style: { fontSize: '13px', opacity: 0.72 } }, 'Список разрешённых шаблонов пуст.')
        : h(
            'div',
            { style: { display: 'grid', gap: '6px' } },
            ...allowlist.map((pat) =>
              h(
                'div',
                {
                  key: pat,
                  style: {
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  },
                },
                h('code', { style: { fontSize: '13px' } }, pat),
                h(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: () => handleRemoveAllowlist(pat),
                    style: {
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(248,81,73,0.4)',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: '12px',
                      cursor: 'pointer',
                    },
                  },
                  'Отключить',
                ),
              ),
            ),
          ),
    ),
    h(
      'section',
      {
        className: 'nomad-safety-deny',
        style: {
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid rgba(248,81,73,0.35)',
        },
      },
      h('h3', { style: { margin: '0 0 6px 0', fontSize: '16px' } }, 'Жёсткие запреты команд (approvals.deny)'),
      h(
        'p',
        { style: { margin: '0 0 12px 0', fontSize: '13px', opacity: 0.82 } },
        'Команды, совпадающие с этими шаблонами, блокируются всегда — даже если включён автоматический режим без запросов подтверждения (--yolo).',
      ),
      h(
        'form',
        {
          onSubmit: handleAddDeny,
          style: { display: 'flex', gap: '8px', marginBottom: '12px' },
        },
        h('input', {
          type: 'text',
          value: newDenyPattern,
          onChange: (e) => setNewDenyPattern(e?.target?.value ?? ''),
          placeholder: 'Например: git push --force* или rm -rf *',
          style: {
            flex: '1 1 auto',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(128,128,128,0.3)',
            background: 'transparent',
            color: 'inherit',
          },
        }),
        h(
          'button',
          {
            type: 'submit',
            disabled: busy,
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: 'none',
              background: '#dc2626',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
            },
          },
          'Запретить шаблон',
        ),
      ),
      denyRules.length === 0
        ? h('div', { style: { fontSize: '13px', opacity: 0.72 } }, 'Пользовательские правила запрета пока не заданы.')
        : h(
            'div',
            { style: { display: 'grid', gap: '6px' } },
            ...denyRules.map((rule) =>
              h(
                'div',
                {
                  key: rule,
                  style: {
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(248,81,73,0.3)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  },
                },
                h('code', { style: { fontSize: '13px' } }, rule),
                h(
                  'button',
                  {
                    type: 'button',
                    disabled: busy,
                    onClick: () => handleRemoveDeny(rule),
                    style: {
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(248,81,73,0.4)',
                      background: 'transparent',
                      color: 'inherit',
                      fontSize: '12px',
                      cursor: 'pointer',
                    },
                  },
                  'Удалить запрет',
                ),
              ),
            ),
          ),
    ),

    createElement(DesktopEgressCard, { ctx, egress }),
    createElement(DesktopCronIncidentsCard, { ctx }),
  );
}

export function DesktopEgressCard({ ctx, egress }) {
  const [localEgress, setLocalEgress] = useState(egress || null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (egress) {
      setLocalEgress(egress);
    } else if (ctx) {
      restGet(ctx, '/safety/egress')
        .then((res) => {
          if (res && typeof res === 'object') setLocalEgress(res);
        })
        .catch(() => {});
    }
  }, [egress, ctx]);

  const data = localEgress || {
    configured: false,
    status: 'not_configured',
    status_text: 'Прокси не настроен',
    allowed_domains: [],
    remediation_cmd: 'hermes egress setup',
    remediation_text: 'Запустите в терминале: hermes egress setup',
  };

  const isRunning = data.status === 'running';
  const isStopped = data.status === 'stopped';
  const isNotConfigured = !data.configured || data.status === 'not_configured';

  const badgeColor = isRunning ? '#10b981' : isStopped ? '#f59e0b' : '#6b7280';
  const badgeBg = isRunning
    ? 'rgba(16, 185, 129, 0.15)'
    : isStopped
    ? 'rgba(245, 158, 11, 0.15)'
    : 'rgba(107, 114, 128, 0.15)';

  const handleCopy = (text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return h(
    'section',
    {
      className: 'nomad-safety-egress',
      style: {
        padding: '16px',
        borderRadius: '10px',
        border: '1px solid rgba(128,128,128,0.24)',
        background: 'var(--surface-card, rgba(255,255,255,0.03))',
        display: 'grid',
        gap: '12px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, 'Сетевой фильтр Egress (только чтение)'),
        h(
          'span',
          {
            style: {
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 500,
              color: badgeColor,
              background: badgeBg,
              border: `1px solid ${badgeColor}`,
            },
          },
          data.status_text || (isRunning ? 'Работает' : isStopped ? 'Остановлен' : 'Прокси не настроен'),
        ),
      ),
      h(
        'span',
        { style: { fontSize: '12px', opacity: 0.6 } },
        'Управление egress — в терминале',
      ),
    ),
    isNotConfigured
      ? h(
          'div',
          { style: { display: 'grid', gap: '8px' } },
          h(
            'div',
            { style: { fontSize: '13px', opacity: 0.85 } },
            'Сетевой прокси-фильтр исходящего трафика (iron-proxy) не настроен для текущего профиля.',
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(128,128,128,0.2)',
              },
            },
            h('code', { style: { fontSize: '13px', flex: '1 1 auto' } }, 'hermes egress setup'),
            h(
              'button',
              {
                type: 'button',
                onClick: () => handleCopy('hermes egress setup'),
                style: {
                  padding: '4px 10px',
                  borderRadius: '4px',
                  border: '1px solid rgba(128,128,128,0.3)',
                  background: 'transparent',
                  color: 'inherit',
                  fontSize: '12px',
                  cursor: 'pointer',
                },
              },
              copied ? 'Скопировано!' : 'Копировать',
            ),
          ),
        )
      : h(
          'div',
          { style: { display: 'grid', gap: '10px' } },
          h(
            'div',
            { style: { fontSize: '13px', fontWeight: 500 } },
            'Разрешённые внешние домены (upstream hosts):',
          ),
          data.allowed_domains && data.allowed_domains.length > 0
            ? h(
                'div',
                { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                ...data.allowed_domains.map((domain) =>
                  h(
                    'span',
                    {
                      key: domain,
                      style: {
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        background: 'rgba(128,128,128,0.15)',
                        border: '1px solid rgba(128,128,128,0.25)',
                        fontFamily: 'monospace',
                      },
                    },
                    domain,
                  ),
                ),
              )
            : h('div', { style: { fontSize: '13px', opacity: 0.72 } }, 'Разрешённые домены не обнаружены.'),
          isStopped &&
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                },
              },
              h('span', { style: { fontSize: '12px' } }, 'Для запуска прокси выполните:'),
              h('code', { style: { fontSize: '12px', fontWeight: 600 } }, 'hermes egress start'),
            ),
        ),
  );
}

export function DesktopCronIncidentsCard({ ctx }) {
  const [incidents, setIncidents] = useState([]);
  const [showResolved, setShowResolved] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadIncidents = async () => {
    try {
      const resp = await callRest(ctx, 'get', '/cron/incidents?include_resolved=true');
      const raw = Array.isArray(resp?.incidents) ? resp.incidents : [];
      setIncidents(raw);
    } catch (_err) {
      setIncidents([]);
    }
  };

  useEffect(() => {
    loadIncidents();
  }, []);

  const handleAck = async (inc) => {
    if (!inc?.id) return;
    setBusyId(inc.id);
    try {
      await callRest(ctx, 'post', `/cron/incidents/${encodeURIComponent(inc.id)}/ack`, { id: inc.id });
      setIncidents((prev) =>
        prev.map((item) => (item.id === inc.id ? { ...item, status: 'resolved' } : item)),
      );
      notify(ctx, `Инцидент «${inc.job_name || inc.id}» отмечен как принятый.`, 'info');
    } catch (err) {
      notify(ctx, err?.message || 'Не удалось подтвердить инцидент.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const visible = showResolved
    ? incidents
    : incidents.filter((item) => item.status === 'detected' || item.status === 'alerted');

  return h(
    'section',
    {
      className: 'nomad-cron-incidents-card',
      style: {
        padding: '16px',
        borderRadius: '10px',
        border: '1px solid var(--border-subtle, rgba(255,255,255,0.12))',
        background: 'var(--surface-card, rgba(255,255,255,0.03))',
        display: 'grid',
        gap: '10px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
      h('h2', { style: { margin: 0, fontSize: '16px', fontWeight: 600 } }, 'Инциденты расписания'),
      h(
        'button',
        {
          type: 'button',
          onClick: () => setShowResolved(!showResolved),
          style: {
            padding: '5px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'transparent',
            color: 'inherit',
            fontSize: '12px',
            cursor: 'pointer',
          },
        },
        'Показать закрытые',
      ),
    ),
    visible.length === 0
      ? h('div', { style: { fontSize: '13px', opacity: 0.72 } }, 'Открытых инцидентов расписания нет.')
      : h(
          'div',
          { style: { display: 'grid', gap: '8px' } },
          ...visible.map((inc) =>
            h(
              'div',
              {
                key: inc.id,
                style: {
                  padding: '10px 12px',
                  borderRadius: '8px',
                  border: '1px solid rgba(248,81,73,0.3)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                },
              },
              h(
                'div',
                { style: { display: 'grid', gap: '4px' } },
                h(
                  'div',
                  { style: { fontSize: '13px', fontWeight: 600 } },
                  `${inc.job_name || inc.job_id || inc.id} · повторов: ${inc.repeat_count ?? inc.consecutive_failures ?? 1}`,
                ),
                h(
                  'div',
                  { style: { fontSize: '12px', opacity: 0.82 } },
                  inc.error_text || inc.last_error || 'Ошибка выполнения',
                ),
              ),
              (inc.status === 'detected' || inc.status === 'alerted') &&
                h(
                  'button',
                  {
                    type: 'button',
                    disabled: busyId === inc.id,
                    onClick: () => handleAck(inc),
                    style: {
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--accent-primary, #ff6b35)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    },
                  },
                  'Принято',
                ),
            ),
          ),
        ),
  );
}

export default function registerSafety(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return;

  const renderPage = (props) => createElement(NomadSafetyPage, { ctx, ...(props || {}) });

  ctx.register({
    id: 'page',
    area: ROUTES_AREA,
    path: SAFETY_ROUTE_PATH,
    title: SAFETY_NAV_LABEL,
    data: {
      path: SAFETY_ROUTE_PATH,
      title: SAFETY_NAV_LABEL,
    },
    render: renderPage,
    component: renderPage,
  });

  ctx.register({
    id: SAFETY_NAV_ID,
    area: SIDEBAR_NAV_AREA,
    order: SAFETY_NAV_ORDER,
    label: SAFETY_NAV_LABEL,
    path: SAFETY_ROUTE_PATH,
    codicon: 'shield',
    data: {
      id: 'nomad.safety.nav',
      codicon: 'shield',
      label: SAFETY_NAV_LABEL,
      path: SAFETY_ROUTE_PATH,
      order: SAFETY_NAV_ORDER,
    },
  });

  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: SAFETY_NAV_ORDER,
    data: {
      id: 'nomad.safety.open',
      action: 'nomad.safety.open',
      label: 'Разрешения и безопасность — белый список и запреты команд',
      category: 'Nomad',
      codicon: 'shield',
      keywords: ['safety', 'approvals', 'разрешения', 'безопасность', 'запреты', 'allowlist', 'deny'],
      run: () => ctx?.host?.navigate?.(SAFETY_ROUTE_PATH),
    },
  });

  ctx.register({
    id: 'palette-cron-incidents',
    area: PALETTE_AREA,
    order: SAFETY_NAV_ORDER + 1,
    data: {
      id: 'nomad.cron.incidents',
      action: 'nomad.cron.incidents',
      label: 'Инциденты расписания — список сбоев и кнопка «Принято»',
      category: 'Nomad',
      codicon: 'bell',
      keywords: ['cron', 'incidents', 'инциденты', 'расписание', 'сбои', 'принято'],
      run: () => ctx?.host?.navigate?.(SAFETY_ROUTE_PATH),
    },
  });
}

