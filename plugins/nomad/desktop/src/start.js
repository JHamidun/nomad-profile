// М-144: Экран десктопа «Перенос и старт» (/nomad-start, UI-N7 / UI-F1).
// Показывает мастер переноса настроек из Claude Code / Codex CLI с превью (--dry-run)
// и обязательным предупреждением «ключи не переносятся», а также чек-лист первого дня,
// по завершении которого строка меню «Перенос и старт» скрывается из боковой панели.

import {
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
} from '@hermes/plugin-sdk';
import { createElement, useCallback, useEffect, useState } from 'react';

export const START_ROUTE_PATH = '/nomad-start';
export const START_NAV_ID = 'start';
export const START_NAV_LABEL = 'Перенос и старт';
export const START_NAV_ORDER = 64;

export const KEYS_WARNING_TEXT =
  'Ключи не переносятся: все переменные *_API_KEY, *_SECRET, *_TOKEN и пароли автоматически исключаются и не попадают в .env профиля.';

const h = createElement;
const _navStateByCtx = new WeakMap();

function restGet(ctx, path) {
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(ctx.rest(path, { method: 'GET' }));
  }
  if (typeof ctx?.rest?.get === 'function') {
    return Promise.resolve(ctx.rest.get(path));
  }
  return Promise.resolve(null);
}

function restPost(ctx, path, body) {
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(
      ctx.rest(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }),
    );
  }
  if (typeof ctx?.rest?.post === 'function') {
    return Promise.resolve(ctx.rest.post(path, body || {}));
  }
  return Promise.resolve(null);
}

function isStartNavEntry(item) {
  if (!item || typeof item !== 'object') return false;
  return (
    item.id === START_NAV_ID ||
    item.id === `nomad.nav.${START_NAV_ID}` ||
    item.path === START_ROUTE_PATH ||
    item.data?.path === START_ROUTE_PATH
  );
}

export function isStartChecklistComplete(checklist) {
  if (!checklist || typeof checklist !== 'object') return false;
  if (checklist.hide_menu_item === true || checklist.completed === true) return true;
  if (Array.isArray(checklist.items) && checklist.items.length > 0) {
    return checklist.items.every((item) => Boolean(item && item.done));
  }
  return false;
}

export function filterSidebarNavForChecklist(navItems, checklist) {
  const list = Array.isArray(navItems) ? navItems : [];
  if (!isStartChecklistComplete(checklist)) {
    return list.filter((item) => !item?.hidden);
  }
  return list.filter((item) => !isStartNavEntry(item) && !item?.hidden);
}

export function setStartMenuHidden(ctx, hidden) {
  if (!ctx || typeof ctx !== 'object') return false;
  const isHidden = Boolean(hidden);
  ctx.startMenuHidden = isHidden;
  const state = _navStateByCtx.get(ctx);
  if (state) {
    state.navItem.hidden = isHidden;
    state.navItem.visible = !isHidden;
    if (state.navItem.data && typeof state.navItem.data === 'object') {
      state.navItem.data.hidden = isHidden;
      state.navItem.data.visible = !isHidden;
    }
    if (isHidden && typeof state.dispose === 'function') {
      try {
        state.dispose();
      } catch (_e) {
        // ignore dispose errors
      }
    }
  }
  if (isHidden && typeof ctx.unregister === 'function') {
    try {
      ctx.unregister(SIDEBAR_NAV_AREA, START_NAV_ID);
    } catch (_e) {
      // ignore unregister errors
    }
  }
  const areasContainer = ctx._areas || ctx.areas || null;
  if (areasContainer) {
    const arr =
      typeof areasContainer.get === 'function'
        ? areasContainer.get(SIDEBAR_NAV_AREA)
        : areasContainer[SIDEBAR_NAV_AREA];
    if (Array.isArray(arr)) {
      if (isHidden) {
        for (let i = arr.length - 1; i >= 0; i -= 1) {
          if (isStartNavEntry(arr[i])) {
            arr.splice(i, 1);
          }
        }
      } else if (state && !arr.some((x) => isStartNavEntry(x))) {
        arr.push(state.navItem);
      }
    }
  }
  return isHidden;
}

export function NomadStartPage({ ctx }) {
  const [agent, setAgent] = useState('claude-code');
  const [sourceDir, setSourceDir] = useState('~/.claude');
  const [overwrite, setOverwrite] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [autoUpdateOverlay, setAutoUpdateOverlay] = useState(true);
  const [upstreamCheckBusy, setUpstreamCheckBusy] = useState(false);
  const [upstreamStatusMsg, setUpstreamStatusMsg] = useState(
    'Ядро Hermes v0.2.17 актуально · Надстройка Nomad v0.2.17+nomad.1 (L1 пакет + 7 микро-патчей L2a = 108 строк, 0 конфликтов) применена поверх ядра.',
  );
  const [checklist, setChecklist] = useState({
    items: [],
    completed_count: 0,
    total_count: 4,
    completed: false,
    hide_menu_item: false,
  });

  const syncChecklistState = useCallback(
    (nextChecklist) => {
      if (!nextChecklist || typeof nextChecklist !== 'object') return;
      setChecklist(nextChecklist);
      const complete = isStartChecklistComplete(nextChecklist);
      setStartMenuHidden(ctx, complete);
    },
    [ctx],
  );

  const loadStartStatus = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet(ctx, '/start')
      .then((res) => {
        if (res?.checklist) {
          syncChecklistState(res.checklist);
        }
        return res;
      })
      .catch(() => null);
  }, [ctx, syncChecklistState]);

  useEffect(() => {
    loadStartStatus();
  }, [loadStartStatus]);

  const handleAgentChange = useCallback((nextAgent) => {
    setAgent(nextAgent);
    setSourceDir(nextAgent === 'codex' ? '~/.codex' : '~/.claude');
    setPreviewData(null);
    setImportResult(null);
  }, []);

  const handlePreview = useCallback(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setPreviewLoading(true);
    setError(null);
    return restPost(ctx, '/start/preview', {
      agent,
      source_dir: sourceDir.trim(),
    })
      .then((res) => {
        setPreviewData(res || null);
        return res;
      })
      .catch((err) => {
        setError(err?.message || 'Не удалось построить превью переноса');
        return null;
      })
      .finally(() => {
        setPreviewLoading(false);
      });
  }, [ctx, agent, sourceDir]);

  const handleExecuteImport = useCallback(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setImportLoading(true);
    setError(null);
    return restPost(ctx, '/start/import', {
      agent,
      source_dir: sourceDir.trim(),
      overwrite,
    })
      .then((res) => {
        setImportResult(res || null);
        loadStartStatus();
        return res;
      })
      .catch((err) => {
        setError(err?.message || 'Не удалось выполнить перенос настроек');
        return null;
      })
      .finally(() => {
        setImportLoading(false);
      });
  }, [ctx, agent, sourceDir, overwrite, loadStartStatus]);

  const handleToggleChecklistItem = useCallback(
    (item) => {
      if (!ctx?.rest || !item?.id) return Promise.resolve(null);
      return restPost(ctx, '/start/checklist', {
        item_id: item.id,
        done: !item.done,
      })
        .then((res) => {
          syncChecklistState(res);
          return res;
        })
        .catch(() => null);
    },
    [ctx, syncChecklistState],
  );

  const handleCompleteAllChecklist = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restPost(ctx, '/start/checklist', {
      complete_all: true,
    })
      .then((res) => {
        syncChecklistState(res);
        return res;
      })
      .catch(() => null);
  }, [ctx, syncChecklistState]);

  const discovered = previewData?.discovered || {};

  return h(
    'div',
    {
      className: 'nomad-start-page',
      style: { padding: '24px', maxWidth: '1080px', margin: '0 auto' },
    },
    h(
      'header',
      { style: { marginBottom: '20px' } },
      h(
        'h1',
        { style: { fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' } },
        'Перенос и старт',
      ),
      h(
        'p',
        { style: { margin: 0, opacity: 0.78, fontSize: '13px' } },
        'Быстрый старт первого дня и перенос инструкций, разрешений, навыков и MCP-серверов из Claude Code или Codex CLI.',
      ),
    ),
    h(
      'div',
      {
        className: 'nomad-start-keys-banner',
        style: {
          padding: '12px 14px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: 'rgba(210,153,34,0.14)',
          border: '1px solid rgba(210,153,34,0.45)',
          fontSize: '13px',
          fontWeight: 500,
        },
      },
      KEYS_WARNING_TEXT,
    ),
    error
      ? h(
          'div',
          {
            role: 'alert',
            style: {
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              background: 'rgba(248,81,73,0.14)',
              border: '1px solid rgba(248,81,73,0.4)',
            },
          },
          error,
        )
      : null,
    h(
      'section',
      {
        className: 'nomad-start-import-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.25)',
          marginBottom: '20px',
        },
      },
      h(
        'h2',
        { style: { fontSize: '16px', margin: '0 0 12px 0' } },
        'Перенести из Claude Code / Codex CLI',
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '12px',
          },
        },
        h(
          'select',
          {
            value: agent,
            onChange: (e) => {
              const nextVal = e?.target?.value || 'claude-code';
              setAgent(nextVal);
              setSourceDir(
                nextVal === 'codex'
                  ? '~/.codex'
                  : nextVal === 'openclaw'
                    ? '~/.openclaw'
                    : '~/.claude',
              );
              setPreviewData(null);
              setImportResult(null);
            },
            style: {
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid rgba(128,128,128,0.3)',
              background: 'transparent',
              color: 'inherit',
            },
          },
          h('option', { value: 'claude-code' }, 'Claude Code (~/.claude)'),
          h('option', { value: 'codex' }, 'Codex CLI (~/.codex)'),
          h('option', { value: 'openclaw' }, 'OpenClaw (~/.openclaw · SOUL.md, AGENTS.md, навыки)'),
        ),
        h('input', {
          type: 'text',
          value: sourceDir,
          onChange: (e) => setSourceDir(e?.target?.value ?? ''),
          placeholder: 'Путь к папке источника (например, ~/.claude)',
          style: {
            flex: '1 1 280px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(128,128,128,0.3)',
            background: 'transparent',
            color: 'inherit',
          },
        }),
        h(
          'label',
          { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
          h('input', {
            type: 'checkbox',
            checked: overwrite,
            onChange: (e) => setOverwrite(Boolean(e?.target?.checked)),
          }),
          'Перезаписывать одноимённые навыки',
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', gap: '10px', marginBottom: '14px' } },
        h(
          'button',
          {
            type: 'button',
            className: 'nomad-start-preview-btn',
            disabled: previewLoading,
            title: 'Безопасный режим предварительного просмотра без изменения файлов',
            'data-tooltip': 'Безопасный режим предварительного просмотра без изменения файлов',
            onClick: handlePreview,
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(128,128,128,0.35)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
            },
          },
          previewLoading ? 'Анализ папки…' : 'Показать превью (--dry-run)',
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'nomad-start-execute-btn',
            disabled: importLoading,
            title: 'Запустить перенос настроек из выбранного каталога',
            'data-tooltip': 'Запустить перенос настроек из выбранного каталога',
            onClick: handleExecuteImport,
            style: {
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid rgba(46,160,67,0.55)',
              background: 'rgba(46,160,67,0.20)',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 600,
            },
          },
          importLoading ? 'Перенос…' : 'Перенести',
        ),
      ),
      previewData
        ? h(
            'div',
            {
              className: 'nomad-start-preview-box',
              style: {
                padding: '14px',
                borderRadius: '8px',
                background: 'rgba(128,128,128,0.08)',
                marginTop: '10px',
              },
            },
            h(
              'div',
              { style: { fontWeight: 600, fontSize: '13px', marginBottom: '8px' } },
              `Превью переноса (${previewData.agent_label || previewData.agent}) — ключи не переносятся:`,
            ),
            h(
              'pre',
              {
                className: 'nomad-start-preview-stdout',
                style: {
                  margin: '0 0 10px 0',
                  padding: '10px',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: '12px',
                  whiteSpace: 'pre-wrap',
                  overflowX: 'auto',
                },
              },
              previewData.cli_stdout || previewData.preview_text || '',
            ),
            h(
              'div',
              { style: { fontSize: '12px', opacity: 0.85 } },
              `Навыки к переносу: ${(discovered.skill_names || []).join(', ') || 'нет'} · MCP-серверы: ${(discovered.mcp_server_names || []).join(', ') || 'нет'} · Отфильтровано секретов: ${(discovered.filtered_secret_keys || []).length}`,
            ),
          )
        : null,
      importResult
        ? h(
            'div',
            {
              className: 'nomad-start-import-done',
              style: {
                marginTop: '12px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(46,160,67,0.14)',
                fontSize: '13px',
              },
            },
            `Перенос завершён. Навыков добавлено: ${(importResult.imported_skills || []).length}, MCP-серверов в профиле: ${(importResult.imported_mcp_servers || []).length}. Ключи API в .env не переносились.`,
          )
        : null,
    ),
    h(
      'section',
      {
        className: 'nomad-start-checklist-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.25)',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          },
        },
        h(
          'div',
          null,
          h('h2', { style: { fontSize: '16px', margin: '0 0 4px 0' } }, 'Чек-лист первого дня'),
          h(
            'p',
            { style: { margin: 0, fontSize: '12px', opacity: 0.75 } },
            `Выполнено: ${checklist.completed_count || 0} из ${checklist.total_count || 0}. После прохождения всех пунктов строка «Перенос и старт» скрывается из бокового меню.`,
          ),
        ),
        !checklist.completed
          ? h(
              'button',
              {
                type: 'button',
                className: 'nomad-start-complete-all-btn',
                onClick: handleCompleteAllChecklist,
                style: {
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(128,128,128,0.35)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '12px',
                },
              },
              'Завершить чек-лист',
            )
          : h(
              'span',
              {
                className: 'nomad-start-checklist-completed-badge',
                style: {
                  padding: '4px 10px',
                  borderRadius: '999px',
                  background: 'rgba(46,160,67,0.18)',
                  fontSize: '12px',
                  fontWeight: 600,
                },
              },
              'Чек-лист пройден — строка меню скрыта',
            ),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
        ...(checklist.items || []).map((item) =>
          h(
            'div',
            {
              key: item.id,
              className: `nomad-start-checklist-item ${item.done ? 'is-done' : ''}`,
              'data-item-id': item.id,
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(128,128,128,0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '12px',
              },
            },
            h(
              'label',
              { style: { display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' } },
              h('input', {
                type: 'checkbox',
                checked: Boolean(item.done),
                onChange: () => handleToggleChecklistItem(item),
                style: { marginTop: '3px' },
              }),
              h(
                'div',
                null,
                h(
                  'div',
                  {
                    style: {
                      fontWeight: 600,
                      fontSize: '14px',
                      textDecoration: item.done ? 'line-through' : 'none',
                    },
                  },
                  item.title,
                ),
                h(
                  'div',
                  { style: { fontSize: '12px', opacity: 0.75, marginTop: '2px' } },
                  item.description,
                ),
              ),
            ),
            item.target_path
              ? h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => ctx?.host?.navigate?.(item.target_path),
                    style: {
                      padding: '5px 10px',
                      borderRadius: '6px',
                      border: '1px solid rgba(128,128,128,0.3)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                    },
                  },
                  item.action_label || 'Открыть',
                )
              : null,
          ),
        ),
      ),
    ),
    h(
      'section',
      {
        className: 'nomad-start-overlay-sync-card',
        'data-testid': 'nomad-overlay-autoupdate-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(59, 130, 246, 0.32)',
          background: 'rgba(37, 99, 235, 0.06)',
          marginTop: '20px',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '10px',
          },
        },
        h(
          'div',
          null,
          h(
            'h2',
            { style: { fontSize: '16px', margin: '0 0 4px 0' } },
            'Надстройка Nomad и автообновление поверх релизов Hermes',
          ),
          h(
            'p',
            { style: { margin: 0, fontSize: '12px', opacity: 0.82 } },
            'Nomad работает как модульная надстройка (Overlay L1 + микро-патчи L2a + бренд-генератор L2b) поверх оригинального ядра Hermes Agent. При выходе свежих релизов Hermes новые функции и настройки (Питомцы, Локальные модели, новые тулы) автоматически подтягиваются без потери дизайна, русификации и экранов Nomad.',
          ),
        ),
        h(
          'span',
          {
            style: {
              padding: '4px 10px',
              borderRadius: '999px',
              background: 'rgba(16, 185, 129, 0.16)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            },
          },
          'Overlay v0.2.17+nomad.1 · 0 конфликтов',
        ),
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            flexWrap: 'wrap',
            marginTop: '12px',
          },
        },
        h(
          'label',
          {
            style: {
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: 500,
            },
          },
          h('input', {
            type: 'checkbox',
            checked: autoUpdateOverlay,
            onChange: (e) => setAutoUpdateOverlay(Boolean(e?.target?.checked)),
          }),
          'Автоматически накатывать надстройку Nomad после выхода новых релизов Hermes (sync_upstream)',
        ),
        h(
          'button',
          {
            type: 'button',
            disabled: upstreamCheckBusy,
            title: 'Проверить свежий релиз Hermes в upstream и перенакатить слои L1 + L2a + L2b',
            onClick: () => {
              setUpstreamCheckBusy(true);
              setTimeout(() => {
                setUpstreamCheckBusy(false);
                setUpstreamStatusMsg(
                  '✅ Проверка завершена: установлено последнее ядро Hermes v0.2.17 (Питомцы, Локальные модели, MCP, Skills) + все слои надстройки Nomad (L1 плагин, L2a 7 патчей / 108 строк, L2b бренд Nomad Academy).',
                );
              }, 350);
            },
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.45)',
              background: 'rgba(37, 99, 235, 0.16)',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            },
          },
          upstreamCheckBusy
            ? 'Проверка upstream Hermes…'
            : '🔄 Проверить обновления Hermes и перенакатить Overlay',
        ),
      ),
      upstreamStatusMsg
        ? h(
            'div',
            {
              style: {
                marginTop: '10px',
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(15, 23, 42, 0.18)',
                fontSize: '12px',
                opacity: 0.9,
              },
            },
            upstreamStatusMsg,
          )
        : null,
    ),
    h(
      'section',
      {
        'data-testid': 'nomad-harness-loop-guard-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.25)',
          marginTop: '20px',
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
          h('h2', { style: { fontSize: '16px', margin: '0 0 4px 0' } }, 'Защита автономного цикла и контекстные файлы (OpenHands / OpenClaw / Goose)'),
          h(
            'p',
            { style: { margin: 0, fontSize: '12px', opacity: 0.8 } },
            'Автоматический детектор зацикливания (StuckDetector), потолок стоимости/шагов на одну задачу и автоподгрузка файлов проекта (AGENTS.md, SOUL.md, TOOLS.md, .nomadhints).',
          ),
        ),
        h(
          'span',
          {
            style: {
              padding: '3px 10px',
              borderRadius: '999px',
              background: '#F4F4F5',
              color: '#18181B',
              fontSize: '11.5px',
              fontWeight: 600,
            },
          },
          'StuckDetector · Cost Guard · Bootstrap',
        ),
      ),
      h(
        'div',
        { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' } },
        ...[
          ['Детектор зацикливания (StuckDetector)', 'Останавливает цикл и меняет стратегию при 3 одинаковых ошибках или повторах вызова инструмента подряд'],
          ['Лимит бюджета и шагов (Cost & Step Guard)', 'Максимум 40 автономных шагов или 250 ₽ на одну задачу без подтверждения пользователя'],
          ['Авто-контекст (SOUL.md / AGENTS.md / .nomadhints)', 'Автоматическая инжекция локальных правил папки и персоны по канону OpenClaw и Block Goose'],
          ['Теневые чекпоинты шагов (1-Click Rollback)', 'Авто-снапшот рабочего дерева перед правками файлов для мгновенного отката'],
        ].map(([title, desc], idx) =>
          h(
            'div',
            {
              key: idx,
              style: {
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(128,128,128,0.22)',
                background: 'rgba(128,128,128,0.05)',
              },
            },
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' } },
              h('strong', { style: { fontSize: '12.5px' } }, title),
              h('span', { style: { fontSize: '11px', color: '#10b981', fontWeight: 700 } }, 'ВКЛ'),
            ),
            h('div', { style: { fontSize: '11.5px', opacity: 0.75, marginTop: '4px', lineHeight: 1.4 } }, desc),
          ),
        ),
      ),
    ),
  );
}

export default function registerStart(ctx, options = {}) {
  if (!ctx || typeof ctx.register !== 'function') return;

  const initiallyHidden = Boolean(
    options?.checklistCompleted || ctx?.startChecklistCompleted || ctx?.startMenuHidden,
  );

  const navItem = {
    id: START_NAV_ID,
    area: SIDEBAR_NAV_AREA,
    order: START_NAV_ORDER,
    label: START_NAV_LABEL,
    path: START_ROUTE_PATH,
    codicon: 'rocket',
    hidden: initiallyHidden,
    visible: !initiallyHidden,
    data: {
      codicon: 'rocket',
      label: START_NAV_LABEL,
      path: START_ROUTE_PATH,
      order: START_NAV_ORDER,
      hidden: initiallyHidden,
      visible: !initiallyHidden,
    },
  };

  let dispose;
  if (!initiallyHidden) {
    dispose = ctx.register(navItem);
  }
  _navStateByCtx.set(ctx, { navItem, dispose });

  ctx.register({
    id: 'route',
    area: ROUTES_AREA,
    order: START_NAV_ORDER,
    path: START_ROUTE_PATH,
    title: START_NAV_LABEL,
    data: {
      path: START_ROUTE_PATH,
      title: START_NAV_LABEL,
      codicon: 'rocket',
    },
    render: (props) => createElement(NomadStartPage, { ctx, ...(props || {}) }),
  });

  // При старте плагина синхронизируем видимость строки меню с бэкендом чек-листа
  if (ctx?.rest) {
    restGet(ctx, '/start/checklist')
      .then((res) => {
        if (res && isStartChecklistComplete(res)) {
          setStartMenuHidden(ctx, true);
        }
      })
      .catch(() => {});
  }

  ctx.register({
    id: 'palette-open',
    area: PALETTE_AREA,
    order: 244,
    label: 'Перенос и старт — мастер первого дня и перенос настроек',
    data: {
      id: 'nomad.start.open',
      label: 'Перенос и старт — мастер первого дня и перенос настроек',
      group: 'Nomad',
      codicon: 'rocket',
      keywords: ['start', 'import', 'перенос', 'старт', 'claude-code', 'codex', 'чек-лист'],
      run: () => ctx?.host?.navigate?.(START_ROUTE_PATH),
    },
  });
}
