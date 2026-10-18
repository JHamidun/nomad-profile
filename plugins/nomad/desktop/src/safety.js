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

async function restGet(ctx, path) {
  const clean = String(path || '').startsWith('/') ? path : `/${path}`;
  try {
    const p =
      typeof ctx?.rest?.get === 'function'
        ? Promise.resolve(ctx.rest.get(clean))
        : typeof ctx?.rest === 'function'
          ? Promise.resolve(ctx.rest(clean))
          : null;
    if (p) {
      return await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('rest-timeout')), 650)),
      ]);
    }
  } catch (_err) {
    // fallback below
  }
  if (typeof fetch === 'function') {
    const baseUrl =
      typeof window !== 'undefined' && window.location?.protocol === 'file:'
        ? 'http://127.0.0.1:9129/api/plugins/nomad'
        : '/api/plugins/nomad';
    const headers = { Accept: 'application/json' };
    if (typeof window !== 'undefined' && window.__HERMES_SESSION_TOKEN__) {
      headers['X-Hermes-Session-Token'] = window.__HERMES_SESSION_TOKEN__;
    }
    const res = await fetch(`${baseUrl}${clean}`, { method: 'GET', headers });
    if (res.ok) return await res.json();
  }
  return null;
}

async function restPost(ctx, path, body) {
  const clean = String(path || '').startsWith('/') ? path : `/${path}`;
  try {
    const p =
      typeof ctx?.rest?.post === 'function'
        ? Promise.resolve(ctx.rest.post(clean, body))
        : typeof ctx?.rest === 'function'
          ? Promise.resolve(ctx.rest(clean, { method: 'POST', body }))
          : null;
    if (p) {
      return await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error('rest-timeout')), 650)),
      ]);
    }
  } catch (_err) {
    // fallback below
  }
  if (typeof fetch === 'function') {
    const baseUrl =
      typeof window !== 'undefined' && window.location?.protocol === 'file:'
        ? 'http://127.0.0.1:9129/api/plugins/nomad'
        : '/api/plugins/nomad';
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
    if (typeof window !== 'undefined' && window.__HERMES_SESSION_TOKEN__) {
      headers['X-Hermes-Session-Token'] = window.__HERMES_SESSION_TOKEN__;
    }
    const res = await fetch(`${baseUrl}${clean}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    });
    if (res.ok) return await res.json();
  }
  return null;
}

const DEFAULT_GUARDRAILS = {
  preset: 'corp_152fz',
  ru_only: false,
  dlp_enabled: true,
  dlp_mode: 'mask',
  mask_fio: true,
  mask_passport_inn_snils: true,
  mask_cards_accounts: true,
  mask_phones_emails: true,
  mask_nda_contracts: true,
  mask_secrets_tokens: true,
  zdr_no_training: true,
  os_keychain_encrypt: true,
  history_ttl_days: 30,
  block_wildcards_ssrf: true,
  require_corp_vpn: false,
  block_env_exfiltration: true,
  siem_syslog_enabled: false,
  siem_endpoint: 'syslog://siem.company.local:514',
};

const DLP_SAMPLE_TEXT =
  'Договор № 482/2026-К от 15.10.2026: клиент Иванов Сергей Александрович, паспорт 45 12 № 781234, СНИЛС 123-456-789 01, ИНН 7707083893, тел. +7 (916) 555-44-33, р/с 40702810500000012345, токен sk-proj-9876543210abcdef.';

function localDlpFallback(text, cfg) {
  let out = String(text || '');
  const g = cfg || DEFAULT_GUARDRAILS;
  let count = 0;
  const rules = [
    [g.mask_secrets_tokens, /\b(?:sk-[A-Za-z0-9_-]{10,}|y0_[A-Za-z0-9_-]{10,}|AQVN[A-Za-z0-9_-]{10,})\b/g, '[СЕКРЕТ:ТОКЕН_СКРЫТ]'],
    [g.mask_passport_inn_snils, /\b\d{3}-\d{3}-\d{3}[\s-]\d{2}\b/g, '[ПДн:СНИЛС_РФ]'],
    [g.mask_passport_inn_snils, /\b\d{2}\s?\d{2}\s№?\s?\d{6}\b/g, '[ПДн:ПАСПОРТ_РФ]'],
    [g.mask_cards_accounts, /\b(?:40702|40802|40817|30101)\d{15}\b/g, '[ПДн:БАНК_СЧЁТ]'],
    [g.mask_passport_inn_snils, /(?:ИНН\s*[:№]?\s*)(\d{10}|\d{12})\b/gi, '[ПДн:ИНН_РФ]'],
    [g.mask_phones_emails, /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/g, '[ПДн:КОНТАКТ]'],
    [g.mask_fio, /\b[А-ЯЁ][а-яё]{2,}(?:ов|ев|ин|ский|ова|ева|ина)\s+[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{3,}(?:ович|евич|овна|евна)\b/g, '[ПДн:ФИО]'],
    [g.mask_nda_contracts, /Договор\s*№\s*[А-ЯA-Z0-9/-]+/gi, '[NDA:ДОГОВОР]'],
  ];
  for (const [enabled, re, repl] of rules) {
    if (!enabled) continue;
    const matches = out.match(re);
    if (matches) {
      count += matches.length;
      out = out.replace(re, repl);
    }
  }
  return {
    redacted_text: out,
    findings_count: count,
    verdict:
      g.dlp_mode === 'block' && count > 0
        ? 'Запрос заблокирован политикой Zero-Trust (обнаружены ПДн / секреты)'
        : `Обезличено объектов ПДн/секретов: ${count} (152-ФЗ DLP)`,
  };
}

export function NomadSafetyPage({ ctx }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');
  const [proposals, setProposals] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [denyRules, setDenyRules] = useState([]);
  const [egress, setEgress] = useState(null);
  const [guardrails, setGuardrails] = useState(DEFAULT_GUARDRAILS);
  const [dlpInput, setDlpInput] = useState(DLP_SAMPLE_TEXT);
  const [dlpResult, setDlpResult] = useState(null);
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
    if (res.guardrails && typeof res.guardrails === 'object') {
      setGuardrails((prev) => ({ ...prev, ...res.guardrails }));
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
        const rawMsg = String(err?.message || '');
        if (rawMsg.includes('Plugin not found') || rawMsg.includes('404')) {
          setError(null);
        } else {
          setError(rawMsg || 'Не удалось загрузить настройки разрешений и безопасности.');
        }
        return null;
      });
  }, [ctx, applyOverview]);

  useEffect(() => {
    loadSafety();
  }, [loadSafety]);

  const handleUpdateGuardrails = useCallback(
    (patch, customMessage) => {
      setGuardrails((prev) => {
        const next = { ...prev, ...patch };
        if (patch.apply_preset === 'startup') {
          Object.assign(next, {
            preset: 'startup',
            ru_only: false,
            dlp_mode: 'mask',
            mask_fio: false,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: false,
            mask_nda_contracts: false,
            mask_secrets_tokens: true,
            require_corp_vpn: false,
          });
        } else if (patch.apply_preset === 'corp_152fz') {
          Object.assign(next, {
            preset: 'corp_152fz',
            ru_only: false,
            dlp_mode: 'mask',
            mask_fio: true,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: true,
            mask_nda_contracts: true,
            mask_secrets_tokens: true,
            require_corp_vpn: false,
          });
        } else if (patch.apply_preset === 'strict_kii') {
          Object.assign(next, {
            preset: 'strict_kii',
            ru_only: true,
            dlp_mode: 'block',
            mask_fio: true,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: true,
            mask_nda_contracts: true,
            mask_secrets_tokens: true,
            require_corp_vpn: true,
            siem_syslog_enabled: true,
          });
        }
        return next;
      });
      setNotice(customMessage || 'Политики корпоративной безопасности ИБ (152-ФЗ) обновлены.');
      if (!ctx?.rest) return Promise.resolve(null);
      return restPost(ctx, '/safety/guardrails', patch)
        .then((res) => {
          applyOverview(res);
          return res;
        })
        .catch(() => null);
    },
    [ctx, applyOverview],
  );

  const handleRunDlpTest = useCallback(() => {
    if (!ctx?.rest) {
      setDlpResult(localDlpFallback(dlpInput, guardrails));
      return Promise.resolve(null);
    }
    return restPost(ctx, '/safety/dlp/test', { text: dlpInput })
      .then((res) => {
        if (res && typeof res.redacted_text === 'string') {
          setDlpResult(res);
        } else {
          setDlpResult(localDlpFallback(dlpInput, guardrails));
        }
        return res;
      })
      .catch(() => {
        setDlpResult(localDlpFallback(dlpInput, guardrails));
        return null;
      });
  }, [ctx, dlpInput, guardrails]);

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
      style: { padding: '24px', maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' },
    },
    h(
      'header',
      null,
      h('h1', { style: { fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' } }, SAFETY_NAV_LABEL),
      h(
        'p',
        { style: { margin: 0, fontSize: '13px', opacity: 0.78 } },
        'Корпоративный контур ИБ, DLP-фильтр персональных данных (152-ФЗ), суверенный режим РФ и политики разрешений команд для службы ИБ и ИТ-отдела.',
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
        className: 'nomad-enterprise-guardrails nomad-glass-surface',
        'data-testid': 'nomad-enterprise-guardrails',
        style: {
          padding: '20px 22px',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' } },
        h(
          'div',
          null,
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            h(
              'h2',
              { style: { margin: 0, fontSize: '16.5px', fontWeight: 600, letterSpacing: '-0.018em' } },
              'Корпоративный контур ИБ и 152-ФЗ (Гардрейлы для CISO, ИБ и ИТ-отдела)',
            ),
            h(
              'span',
              {
                className: 'nomad-pill-badge',
                style: {
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '2px 9px',
                  borderRadius: '999px',
                  background: 'rgba(16, 185, 129, 0.14)',
                  color: '#059669',
                },
              },
              guardrails.ru_only ? 'Суверенный контур РФ активен' : 'DLP 152-ФЗ активен',
            ),
          ),
          h(
            'p',
            { style: { margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.78, maxWidth: '860px' } },
            'Гибкая настройка защиты персональных данных (152-ФЗ), коммерческой тайны (NDA), запрета обучения внешних моделей (Zero Data Retention) и сетевых ограничений.',
          ),
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
        [
          { id: 'startup', label: 'Стартап / Разработка', desc: 'Маскирование ключей, паспортов и карт' },
          { id: 'corp_152fz', label: 'Корпоративный 152-ФЗ (Рекомендуется)', desc: 'Полное DLP-маскирование ФИО, ПДн и NDA до отправки в ИИ' },
          { id: 'strict_kii', label: 'Банк / Госсектор / КИИ (Zero-Trust)', desc: 'Только суверенные модели РФ + блокировка ПДн + VPN + SIEM' },
        ].map((preset) => {
          const active = guardrails.preset === preset.id;
          return h(
            'button',
            {
              key: preset.id,
              type: 'button',
              className: 'nomad-glass-card',
              'data-active': active ? 'true' : 'false',
              onClick: () =>
                handleUpdateGuardrails(
                  { apply_preset: preset.id, preset: preset.id },
                  `Применён профиль безопасности ИБ: «${preset.label}».`,
                ),
              style: {
                flex: '1 1 240px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: '12px',
                border: active
                  ? '1.5px solid var(--nomad-accent, #18181B)'
                  : '1px solid var(--border, rgba(128,128,128,0.22))',
                background: active ? '#F4F4F5' : 'rgba(255, 255, 255, 0.5)',
                color: 'inherit',
                cursor: 'pointer',
              },
            },
            h('div', { style: { fontWeight: 600, fontSize: '13px', letterSpacing: '-0.01em' } }, preset.label),
            h('div', { style: { fontSize: '11.5px', opacity: 0.72, marginTop: '4px', lineHeight: 1.4 } }, preset.desc),
          );
        }),
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
            gap: '12px',
          },
        },
        h(
          'div',
          {
            className: 'nomad-glass-card',
            style: {
              padding: '14px 16px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            },
          },
          h('strong', { style: { fontSize: '13.5px', fontWeight: 600 } }, '1. DLP-фильтр и обезличивание ПДн (152-ФЗ) до отправки в LLM'),
          ...[
            ['mask_fio', 'Маскировать ФИО сотрудников и клиентов → [ПДн:ФИО]'],
            ['mask_passport_inn_snils', 'Маскировать Паспорт РФ, ИНН и СНИЛС → [ПДн:ДОКУМЕНТ_РФ]'],
            ['mask_cards_accounts', 'Маскировать расчётные счета (40702...) и банковские карты'],
            ['mask_phones_emails', 'Маскировать российские телефоны (+7) и корпоративные Email'],
            ['mask_nda_contracts', 'Маскировать номера договоров и маркеры «Коммерческая тайна»'],
            ['mask_secrets_tokens', 'Перехватывать API-ключи (sk-..., y0_..., AQVN...) и пароли'],
          ].map(([key, label]) =>
            h(
              'label',
              {
                key,
                style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' },
              },
              h('input', {
                type: 'checkbox',
                checked: Boolean(guardrails[key]),
                onChange: (e) => handleUpdateGuardrails({ [key]: Boolean(e?.target?.checked) }),
              }),
              h('span', null, label),
            ),
          ),
        ),
        h(
          'div',
          {
            className: 'nomad-glass-card',
            style: {
              padding: '14px 16px',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            },
          },
          h('strong', { style: { fontSize: '13.5px', fontWeight: 600 } }, '2. Суверенный контур РФ, ZDR и Сетевая защита ИБ'),
          ...[
            ['ru_only', 'Строгий режим «Суверенный контур РФ (152-ФЗ)» — блокировать зарубежные LLM'],
            ['zdr_no_training', 'Zero Data Retention (ZDR) — запрет обучения моделей на данных компании'],
            ['os_keychain_encrypt', 'Шифровать секреты и токены в хранилище ОС (Windows DPAPI / Keychain)'],
            ['block_wildcards_ssrf', 'Anti-SSRF фильтр — запретить wildcard (*) и доступ к локальной подсети без белого списка'],
            ['require_corp_vpn', 'Требовать активный корпоративный VPN-туннель (WireGuard / Континент / VipNet)'],
            ['siem_syslog_enabled', 'Экспортировать события ИБ и срабатывания DLP в SIEM / Syslog (CEF)'],
          ].map(([key, label]) =>
            h(
              'label',
              {
                key,
                style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' },
              },
              h('input', {
                type: 'checkbox',
                checked: Boolean(guardrails[key]),
                onChange: (e) => handleUpdateGuardrails({ [key]: Boolean(e?.target?.checked) }),
              }),
              h('span', null, label),
            ),
          ),
        ),
      ),
      h(
        'div',
        {
          className: 'nomad-glass-card',
          style: {
            padding: '14px 16px',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          },
        },
        h(
          'div',
          { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
          h('strong', { style: { fontSize: '13px', fontWeight: 600 } }, 'Интерактивный тестер DLP-маскирования ПДн (152-ФЗ) для проверки безопасниками'),
          h(
            'button',
            {
              type: 'button',
              onClick: handleRunDlpTest,
              style: {
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: 'var(--nomad-accent, #18181B)',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              },
            },
            'Проверить обезличивание ПДн',
          ),
        ),
        h('textarea', {
          rows: 2,
          value: dlpInput,
          onChange: (e) => setDlpInput(e?.target?.value ?? ''),
          style: {
            width: '100%',
            padding: '8px 10px',
            borderRadius: '7px',
            border: '1px solid rgba(128,128,128,0.3)',
            background: 'transparent',
            color: 'inherit',
            fontSize: '12px',
            fontFamily: 'monospace',
          },
        }),
        dlpResult
          ? h(
              'div',
              {
                style: {
                  padding: '8px 10px',
                  borderRadius: '7px',
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontSize: '12px',
                },
              },
              h('div', { style: { fontWeight: 700, color: '#10b981', marginBottom: '4px' } }, dlpResult.verdict),
              h('div', { style: { fontFamily: 'monospace', wordBreak: 'break-word' } }, dlpResult.redacted_text),
            )
          : null,
      ),
    ),
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
                        background: '#18181B',
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
              background: '#18181B',
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

    createElement(DesktopNemoClawOpenShellCard, { ctx }),
    createElement(DesktopOpenClawChannelPolicyCard, { ctx }),
    createElement(DesktopEgressCard, { ctx, egress }),
    createElement(DesktopCronIncidentsCard, { ctx }),
  );
}

export function DesktopNemoClawOpenShellCard() {
  const [landlockFs, setLandlockFs] = useState(true);
  const [denyDefaultNet, setDenyDefaultNet] = useState(true);
  const [credentialProxy, setCredentialProxy] = useState(true);
  const [hybridNimRouting, setHybridNimRouting] = useState(true);
  const [yamlCopied, setYamlCopied] = useState(false);

  const policyYaml = `version: "1.0"
runtime: openshell-sandbox
filesystem_policy:
  mode: ${landlockFs ? 'landlock_strict' : 'permissive'}
  writable_paths: ["/workspace", "/tmp"]
  readonly_paths: ["/usr", "/etc", "~/.claude", "~/.codex"]
network_policy:
  default_egress: ${denyDefaultNet ? 'deny' : 'allow'}
  allowlist: ["api.nomadnet.ru", "gigachat.devices.sberbank.ru", "llm.api.cloud.yandex.net", "api.gpt.mws.ru", "127.0.0.1:8000"]
credential_isolation:
  proxy_inject_tokens: ${credentialProxy}
  hide_env_secrets_from_agent: ${credentialProxy}
inference_routing:
  hybrid_local_nim: ${hybridNimRouting}`;

  return h(
    'section',
    {
      'data-testid': 'nomad-nemoclaw-openshell-card',
      style: {
        padding: '18px',
        borderRadius: '12px',
        border: '1px solid rgba(0, 122, 255, 0.28)',
        background: 'rgba(0, 122, 255, 0.04)',
        display: 'grid',
        gap: '12px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
      h(
        'div',
        null,
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
          h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 700 } }, 'Политика песочницы OpenShell (по архитектуре NVIDIA NemoClaw)'),
          h(
            'span',
            {
              style: {
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 600,
                background: 'rgba(16, 185, 129, 0.14)',
                color: '#059669',
              },
            },
            'openshell_policy · Zero-Trust',
          ),
        ),
        h(
          'p',
          { style: { margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.78 } },
          'Декларативное ограничение файловой системы, исходящих сетевых соединений и изоляция API-ключей вне контекста рассуждений агента.',
        ),
      ),
      h(
        'button',
        {
          type: 'button',
          onClick: () => {
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(policyYaml);
              setYamlCopied(true);
              setTimeout(() => setYamlCopied(false), 2000);
            }
          },
          style: {
            padding: '6px 12px',
            borderRadius: '8px',
            border: '1px solid rgba(0, 122, 255, 0.35)',
            background: '#F4F4F5',
            color: 'inherit',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
          },
        },
        yamlCopied ? '✓ Скопирован openshell-sandbox.yaml' : 'Скопировать openshell-sandbox.yaml',
      ),
    ),
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' } },
      ...[
        [
          landlockFs,
          setLandlockFs,
          'Изоляция ФС (Landlock LSM)',
          'Запись разрешена только в рабочую папку проекта и /tmp; системные каталоги строго Read-Only',
        ],
        [
          denyDefaultNet,
          setDenyDefaultNet,
          'Сеть Deny-by-Default (Egress Allowlist)',
          'Блокировка любых неразрешённых внешних подключений и фоновой телеметрии инструментов',
        ],
        [
          credentialProxy,
          setCredentialProxy,
          'Проксирование секретов (Credential Isolation)',
          'Реальные API-ключи не передаются в переменные окружения агента — подставляются шлюзом на лету',
        ],
        [
          hybridNimRouting,
          setHybridNimRouting,
          'Гибридный контур Local NIM / vLLM ↔ Cloud',
          'Чувствительные вызовы и фильтрация ПДн выполняются на локальных моделях без выхода в интернет',
        ],
      ].map(([val, setter, title, desc], idx) =>
        h(
          'label',
          {
            key: idx,
            style: {
              display: 'flex',
              alignItems: 'flex-start',
              gap: '9px',
              padding: '10px 12px',
              borderRadius: '10px',
              border: '1px solid rgba(128,128,128,0.2)',
              background: 'rgba(255,255,255,0.55)',
              cursor: 'pointer',
            },
          },
          h('input', {
            type: 'checkbox',
            checked: val,
            onChange: (e) => setter(Boolean(e?.target?.checked)),
            style: { marginTop: '3px', accentColor: '#18181B' },
          }),
          h(
            'div',
            null,
            h('div', { style: { fontSize: '13px', fontWeight: 600 } }, title),
            h('div', { style: { fontSize: '11.5px', opacity: 0.75, marginTop: '2px' } }, desc),
          ),
        ),
      ),
    ),
  );
}

export function DesktopOpenClawChannelPolicyCard() {
  const [dmPolicy, setDmPolicy] = useState('pairing');
  const [dmScope, setDmScope] = useState('per-channel-peer');
  const [sandboxNonMain, setSandboxNonMain] = useState(true);

  return h(
    'section',
    {
      'data-testid': 'nomad-openclaw-channel-policy-card',
      style: {
        padding: '18px',
        borderRadius: '12px',
        border: '1px solid rgba(128,128,128,0.24)',
        background: 'var(--surface-card, rgba(255,255,255,0.03))',
        display: 'grid',
        gap: '12px',
      },
    },
    h(
      'div',
      { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' } },
      h(
        'div',
        null,
        h('h3', { style: { margin: 0, fontSize: '16px', fontWeight: 700 } }, 'Защита входящих каналов и изоляция сессий (по канону OpenClaw)'),
        h(
          'p',
          { style: { margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.78 } },
          'Защита при подключении внешних мессенджеров (Telegram, VK Teams, Пачка, Битрикс24): верификация отправителей одноразовым кодом спаривания и разделение контекста между собеседниками.',
        ),
      ),
      h(
        'span',
        {
          style: {
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            background: '#F4F4F5',
            color: '#18181B',
          },
        },
        `dmPolicy: ${dmPolicy} · ${dmScope}`,
      ),
    ),
    h(
      'div',
      { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' } },
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px' } },
        h('span', { style: { fontWeight: 600 } }, 'Режим авторизации новых контактов (dmPolicy)'),
        h(
          'select',
          {
            value: dmPolicy,
            onChange: (e) => setDmPolicy(e?.target?.value || 'pairing'),
            style: { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.28)', background: 'transparent', color: 'inherit' },
          },
          h('option', { value: 'pairing' }, 'По 6-значному коду сопряжения (pairing — рекомендуется)'),
          h('option', { value: 'allowlist' }, 'Только белый список ID (allowFrom)'),
          h('option', { value: 'disabled' }, 'Блокировать внешние входящие DM'),
        ),
      ),
      h(
        'label',
        { style: { display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '12.5px' } },
        h('span', { style: { fontWeight: 600 } }, 'Изоляция контекста переписки (session.dmScope)'),
        h(
          'select',
          {
            value: dmScope,
            onChange: (e) => setDmScope(e?.target?.value || 'per-channel-peer'),
            style: { padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.28)', background: 'transparent', color: 'inherit' },
          },
          h('option', { value: 'per-channel-peer' }, 'Отдельная сессия на каждый канал и собеседника (per-channel-peer)'),
          h('option', { value: 'per-peer' }, 'Единая сессия на собеседника во всех каналах (per-peer)'),
          h('option', { value: 'main' }, 'Общая персональная сессия (только для 1 владельца)'),
        ),
      ),
    ),
    h(
      'label',
      { style: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' } },
      h('input', {
        type: 'checkbox',
        checked: sandboxNonMain,
        onChange: (e) => setSandboxNonMain(Boolean(e?.target?.checked)),
        style: { accentColor: '#18181B' },
      }),
      h(
        'span',
        null,
        'Запускать все групповые и внешние сессии в изолированной контейнерной песочнице (',
        h('code', null, 'sandbox.mode = "non-main"'),
        ')',
      ),
    ),
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

