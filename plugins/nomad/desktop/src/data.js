// М-142: Экран десктопа «Данные и место» (/nomad-data, U4 / UI-N6 / E1 / E4).
// Показывает объём данных профиля, размер откатов по проектам с кнопкой «Почистить лишнее»
// и блок «Стереть» с двойным подтверждением и явным перечнем того, что остаётся
// (Star Map, learning.*, история сессий).

import {
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
} from '@hermes/plugin-sdk';
import { createElement, useCallback, useEffect, useState } from 'react';

export const DATA_ROUTE_PATH = '/nomad-data';
export const DATA_NAV_ID = 'data';
export const DATA_NAV_LABEL = 'Данные и место';
export const DATA_NAV_ORDER = 63;

export const PRESERVED_ITEMS_NOTICE = [
  'Star Map (карта знаний и связей)',
  'learning.* (накопленный граф наблюдений агента)',
  'История сессий и диалогов (sessions, state.db)',
];

const h = createElement;

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

export function formatBytesRu(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '0 Б';
  if (n < 1024) return `${n} Б`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} КБ`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} МБ`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} ГБ`;
}

export function advanceWipeConfirmationState(currentStep, action) {
  if (action === 'cancel') return 0;
  if (currentStep <= 0 && action === 'start') return 1;
  if (currentStep === 1 && action === 'confirm_first') return 2;
  if (currentStep === 2 && action === 'confirm_second') return 3;
  return currentStep;
}

export function buildRestoreCliCommand(zipPath) {
  const clean = String(zipPath || '<путь-к-архиву.zip>').trim() || '<путь-к-архиву.zip>';
  return ['hermes import', `"${clean}"`, '--force'].join(' ');
}

export function advanceRestoreConfirmationState(currentStep, action) {
  if (action === 'cancel') return 0;
  if (currentStep <= 0 && action === 'start') return 1;
  if (currentStep === 1 && action === 'confirm_first') return 2;
  if (currentStep === 2 && action === 'confirm_second') return 3;
  return currentStep;
}

export function NomadDataPage({ ctx }) {
  const [state, setState] = useState({
    loading: true,
    error: null,
    totalBytes: 0,
    sections: [],
    checkpoints: { total_bytes: 0, project_count: 0, snapshot_count: 0, projects: [] },
    memory: { memory: 0, user: 0, memory_exists: false, user_exists: false, total_bytes: 0 },
    wipeInfo: {
      erases: ['memories/MEMORY.md', 'memories/USER.md'],
      preserves: PRESERVED_ITEMS_NOTICE,
    },
  });
  const [pruning, setPruning] = useState(false);
  const [pruneResult, setPruneResult] = useState(null);
  const [wipeStep, setWipeStep] = useState(0);
  const [wipeToken, setWipeToken] = useState('WIPE-MEMORY-CONFIRM');
  const [wiping, setWiping] = useState(false);
  const [wipeResult, setWipeResult] = useState(null);

  // М-234: Резервная копия и восстановление из архива (.zip) с двойным подтверждением
  const [backupCreating, setBackupCreating] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [restoreZipPath, setRestoreZipPath] = useState('');
  const [restoreStep, setRestoreStep] = useState(0);
  const [restoreToken, setRestoreToken] = useState('RESTORE-ARCHIVE-CONFIRM');
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState(null);
  const [copiedCli, setCopiedCli] = useState(false);

  const loadData = useCallback(() => {
    if (!ctx?.rest) {
      setState((prev) => ({ ...prev, loading: false }));
      return Promise.resolve(null);
    }
    return restGet(ctx, '/data')
      .then((res) => {
        if (!res || typeof res !== 'object') return null;
        setState({
          loading: false,
          error: null,
          totalBytes: Number(res.total_bytes || 0),
          sections: Array.isArray(res.sections) ? res.sections : [],
          checkpoints: res.checkpoints || {
            total_bytes: 0,
            project_count: 0,
            snapshot_count: 0,
            projects: [],
          },
          memory: res.memory || {
            memory: 0,
            user: 0,
            memory_exists: false,
            user_exists: false,
            total_bytes: 0,
          },
          wipeInfo: res.wipe_info || {
            erases: ['memories/MEMORY.md', 'memories/USER.md'],
            preserves: PRESERVED_ITEMS_NOTICE,
          },
        });
        return res;
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Не удалось получить сведения о данных профиля',
        }));
        return null;
      });
  }, [ctx]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrune = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setPruning(true);
    return restPost(ctx, '/data/prune', {})
      .then((res) => {
        setPruneResult(res || null);
        return loadData();
      })
      .catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || 'Не удалось почистить снимки откатов');
      })
      .finally(() => {
        setPruning(false);
      });
  }, [ctx, loadData]);

  const handleStartWipe = useCallback(() => {
    setWipeResult(null);
    setWipeStep(1);
    if (ctx?.rest) {
      restPost(ctx, '/data/wipe', {
        confirm_step: 1,
        confirmed: false,
        target: 'all',
      })
        .then((res) => {
          if (res?.confirm_token) setWipeToken(res.confirm_token);
        })
        .catch(() => {});
    }
  }, [ctx]);

  const handleFirstConfirm = useCallback(() => {
    setWipeStep(2);
  }, []);

  const handleSecondConfirmExecute = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setWiping(true);
    return restPost(ctx, '/data/wipe', {
      confirm_step: 2,
      confirmed: true,
      confirm_token: wipeToken,
      target: 'all',
    })
      .then((res) => {
        setWipeResult(res || null);
        setWipeStep(0);
        return loadData();
      })
      .catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || 'Не удалось стереть файлы памяти');
      })
      .finally(() => {
        setWiping(false);
      });
  }, [ctx, wipeToken, loadData]);

  const handleCreateBackup = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setBackupCreating(true);
    return restPost(ctx, '/data/backup', {})
      .then((res) => {
        setBackupResult(res || null);
        if (res?.zip_path && !restoreZipPath) {
          setRestoreZipPath(res.zip_path);
        }
        return loadData();
      })
      .catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || 'Не удалось создать резервную копию');
      })
      .finally(() => {
        setBackupCreating(false);
      });
  }, [ctx, loadData, restoreZipPath]);

  const handleCopyRestoreCli = useCallback(() => {
    const cmd = buildRestoreCliCommand(restoreZipPath);
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd).catch(() => {});
    }
    setCopiedCli(true);
    ctx?.host?.toast?.info?.('Команда восстановления скопирована в буфер обмена');
  }, [ctx, restoreZipPath]);

  const handleStartRestore = useCallback(() => {
    if (!String(restoreZipPath || '').trim()) {
      ctx?.host?.toast?.error?.('Выберите файл резервной копии (.zip)');
      return;
    }
    setRestoreResult(null);
    setRestoreStep(1);
    if (ctx?.rest) {
      restPost(ctx, '/data/restore', {
        zip_path: restoreZipPath,
        confirm_step: 1,
        confirmed: false,
      })
        .then((res) => {
          if (res?.confirm_token) setRestoreToken(res.confirm_token);
        })
        .catch(() => {});
    }
  }, [ctx, restoreZipPath]);

  const handleRestoreFirstConfirm = useCallback(() => {
    setRestoreStep(2);
  }, []);

  const handleRestoreSecondConfirmExecute = useCallback(() => {
    if (!ctx?.rest || !String(restoreZipPath || '').trim()) return Promise.resolve(null);
    setRestoring(true);
    return restPost(ctx, '/data/restore', {
      zip_path: restoreZipPath,
      confirm_step: 2,
      confirmed: true,
      confirm_token: restoreToken,
    })
      .then((res) => {
        setRestoreResult(res || null);
        setRestoreStep(0);
        return loadData();
      })
      .catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || 'Не удалось восстановить архив');
      })
      .finally(() => {
        setRestoring(false);
      });
  }, [ctx, restoreZipPath, restoreToken, loadData]);

  const projects = Array.isArray(state.checkpoints?.projects) ? state.checkpoints.projects : [];
  const cliCommandText = buildRestoreCliCommand(restoreZipPath);

  return h(
    'div',
    {
      className: 'nomad-data-page',
      style: { padding: '24px', maxWidth: '1080px', margin: '0 auto' },
    },
    h(
      'header',
      { style: { marginBottom: '20px' } },
      h(
        'h1',
        { style: { fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' } },
        'Данные и место',
      ),
      h(
        'p',
        { style: { margin: 0, opacity: 0.78, fontSize: '13px' } },
        'Объём данных профиля на диске, управление снимками откатов, резервное копирование и сброс личной памяти.',
      ),
    ),
    state.error
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
          state.error,
        )
      : null,
    h(
      'section',
      {
        className: 'nomad-data-volume-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.25)',
          marginBottom: '20px',
        },
      },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          },
        },
        h('h2', { style: { fontSize: '16px', margin: 0 } }, 'Занято на диске'),
        h(
          'strong',
          { className: 'nomad-data-total-bytes', style: { fontSize: '18px' } },
          formatBytesRu(state.totalBytes),
        ),
      ),
      h(
        'div',
        {
          style: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px',
          },
        },
        ...(state.sections || []).map((sec) =>
          h(
            'div',
            {
              key: sec.id,
              className: `nomad-data-section-${sec.id}`,
              style: {
                padding: '10px 12px',
                borderRadius: '8px',
                background: 'rgba(128,128,128,0.08)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '13px',
              },
            },
            h('span', null, sec.label),
            h('strong', null, formatBytesRu(sec.bytes)),
          ),
        ),
      ),
    ),
    h(
      'section',
      {
        className: 'nomad-data-checkpoints-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.25)',
          marginBottom: '20px',
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
          h('h2', { style: { fontSize: '16px', margin: '0 0 4px 0' } }, 'Откаты по проектам'),
          h(
            'p',
            { style: { margin: 0, fontSize: '12px', opacity: 0.75 } },
            `Всего занято под откаты: ${formatBytesRu(state.checkpoints?.total_bytes)} · Снимков: ${state.checkpoints?.snapshot_count || 0}`,
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'nomad-data-prune-btn',
            disabled: pruning,
            title: 'Очистить историю откатов и временные снимки проектов',
            'data-tooltip': 'Очистить историю откатов и временные снимки проектов',
            onClick: handlePrune,
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(128,128,128,0.35)',
              background: 'rgba(56,139,253,0.16)',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
            },
          },
          pruning ? 'Очистка…' : 'Почистить лишнее',
        ),
      ),
      pruneResult
        ? h(
            'div',
            {
              className: 'nomad-data-prune-summary',
              style: {
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '12px',
                background: 'rgba(46,160,67,0.14)',
                fontSize: '13px',
              },
            },
            `Освобождено: ${formatBytesRu(pruneResult.freed_bytes)} (удалено старых снимков: ${pruneResult.pruned_snapshots || 0}). Последний снимок каждого проекта сохранён для отката в чате.`,
          )
        : null,
      projects.length === 0
        ? h(
            'p',
            { style: { margin: 0, fontSize: '13px', opacity: 0.7 } },
            'Снимков откатов по проектам пока нет.',
          )
        : h(
            'table',
            {
              className: 'nomad-data-projects-table',
              style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
            },
            h(
              'thead',
              null,
              h(
                'tr',
                { style: { textAlign: 'left', borderBottom: '1px solid rgba(128,128,128,0.2)' } },
                h('th', { style: { padding: '8px' } }, 'Проект'),
                h('th', { style: { padding: '8px' } }, 'Каталог'),
                h('th', { style: { padding: '8px' } }, 'Снимков'),
                h('th', { style: { padding: '8px' } }, 'Размер'),
                h('th', { style: { padding: '8px' } }, 'Откат последней правки'),
              ),
            ),
            h(
              'tbody',
              null,
              ...projects.map((proj) =>
                h(
                  'tr',
                  {
                    key: proj.id,
                    'data-project-id': proj.id,
                    style: { borderBottom: '1px solid rgba(128,128,128,0.12)' },
                  },
                  h('td', { style: { padding: '8px', fontWeight: 500 } }, proj.project),
                  h('td', { style: { padding: '8px', opacity: 0.75 } }, proj.directory),
                  h('td', { style: { padding: '8px' } }, String(proj.snapshot_count || 0)),
                  h('td', { style: { padding: '8px' } }, formatBytesRu(proj.size_bytes)),
                  h(
                    'td',
                    { style: { padding: '8px' } },
                    proj.can_rollback ? 'Доступен' : 'Нет снимков',
                  ),
                ),
              ),
            ),
          ),
    ),
    h(
      'section',
      {
        className: 'nomad-data-restore-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(128,128,128,0.28)',
          marginBottom: '20px',
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
          h(
            'h2',
            { style: { fontSize: '16px', margin: '0 0 4px 0' } },
            'Резервная копия и восстановление из архива (.zip)',
          ),
          h(
            'p',
            { style: { margin: 0, fontSize: '12px', opacity: 0.78 } },
            'Создайте архив текущего профиля или восстановите настройки, сессии и память из файла .zip.',
          ),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'nomad-data-backup-btn',
            disabled: backupCreating,
            onClick: handleCreateBackup,
            style: {
              padding: '8px 14px',
              borderRadius: '6px',
              border: '1px solid rgba(128,128,128,0.35)',
              background: 'rgba(46,160,67,0.16)',
              color: 'inherit',
              cursor: 'pointer',
              fontWeight: 500,
            },
          },
          backupCreating ? 'Создание архива…' : 'Создать резервную копию (.zip)',
        ),
      ),
      backupResult?.zip_path
        ? h(
            'div',
            {
              className: 'nomad-data-backup-done',
              style: {
                padding: '10px 12px',
                borderRadius: '6px',
                marginBottom: '12px',
                background: 'rgba(46,160,67,0.14)',
                fontSize: '13px',
              },
            },
            `Архив создан: ${backupResult.zip_path} (${backupResult.file_count || 0} файлов, ${formatBytesRu(backupResult.size_bytes)})`,
          )
        : null,
      h(
        'div',
        {
          style: {
            display: 'flex',
            gap: '10px',
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: '12px',
          },
        },
        h('input', {
          type: 'file',
          accept: '.zip,application/zip',
          className: 'nomad-data-restore-file-picker',
          onChange: (e) => {
            const file = e?.target?.files?.[0];
            if (file) {
              setRestoreZipPath(file.path || file.name || '');
              setRestoreStep(0);
            }
          },
        }),
        h('input', {
          type: 'text',
          className: 'nomad-data-restore-path-input',
          value: restoreZipPath,
          placeholder: 'Путь к файлу резервной копии (.zip)',
          onChange: (e) => {
            setRestoreZipPath(e?.target?.value ?? '');
            setRestoreStep(0);
          },
          style: {
            flex: '1 1 280px',
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid rgba(128,128,128,0.35)',
            background: 'transparent',
            color: 'inherit',
            fontSize: '13px',
          },
        }),
      ),
      h(
        'div',
        {
          className: 'nomad-data-restore-cli-box',
          style: {
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(128,128,128,0.10)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            marginBottom: '12px',
            fontSize: '12px',
          },
        },
        h('code', { className: 'nomad-data-restore-cli-command' }, cliCommandText),
        h(
          'button',
          {
            type: 'button',
            className: 'nomad-data-restore-copy-cli-btn',
            onClick: handleCopyRestoreCli,
            style: {
              padding: '5px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(128,128,128,0.35)',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: '12px',
            },
          },
          copiedCli ? 'Скопировано' : 'Скопировать команду CLI',
        ),
      ),
      h(
        'div',
        {
          className: 'nomad-data-restore-warning',
          style: {
            padding: '10px 12px',
            borderRadius: '8px',
            background: 'rgba(210,153,34,0.10)',
            border: '1px solid rgba(210,153,34,0.35)',
            fontSize: '12px',
            marginBottom: '12px',
          },
        },
        'Внимание: восстановление из архива перезапишет существующие файлы в каталоге профиля (config.yaml, sessions/, memories/ и навыки).',
      ),
      restoreStep === 0
        ? h(
            'button',
            {
              type: 'button',
              className: 'nomad-data-restore-start-btn',
              onClick: handleStartRestore,
              style: {
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(210,153,34,0.55)',
                background: 'rgba(210,153,34,0.18)',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 600,
              },
            },
            'Восстановить из архива',
          )
        : null,
      restoreStep === 1
        ? h(
            'div',
            {
              className: 'nomad-data-restore-step-1',
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(210,153,34,0.55)',
                background: 'rgba(210,153,34,0.14)',
              },
            },
            h(
              'p',
              { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 } },
              `Подтверждение 1 из 2: вы уверены, что хотите распаковать архив «${restoreZipPath}» поверх текущего профиля?`,
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '10px' } },
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-restore-confirm-1-btn',
                  onClick: handleRestoreFirstConfirm,
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(210,153,34,0.65)',
                    background: 'rgba(210,153,34,0.24)',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Да, перейти ко второму подтверждению',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-restore-cancel-1-btn',
                  onClick: () => setRestoreStep(0),
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.35)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Отмена',
              ),
            ),
          )
        : null,
      restoreStep === 2
        ? h(
            'div',
            {
              className: 'nomad-data-restore-step-2',
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(248,81,73,0.6)',
                background: 'rgba(248,81,73,0.14)',
              },
            },
            h(
              'p',
              { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 } },
              'Подтверждение 2 из 2 (окончательное): перезаписать файлы каталога профиля содержимым выбранного архива .zip?',
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '10px' } },
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-restore-confirm-2-btn',
                  disabled: restoring,
                  onClick: handleRestoreSecondConfirmExecute,
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(248,81,73,0.75)',
                    background: 'rgba(248,81,73,0.28)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontWeight: 600,
                  },
                },
                restoring ? 'Восстановление…' : 'Подтвердить и восстановить профиль',
              ),
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-restore-cancel-2-btn',
                  onClick: () => setRestoreStep(0),
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.35)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Отмена',
              ),
            ),
          )
        : null,
      restoreResult?.restored
        ? h(
            'div',
            {
              className: 'nomad-data-restore-done',
              style: {
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'rgba(46,160,67,0.14)',
                fontSize: '13px',
              },
            },
            `Профиль успешно восстановлен из архива (${restoreResult.restored_count || 0} файлов).`,
          )
        : null,
    ),
    h(
      'section',
      {
        className: 'nomad-data-wipe-card',
        style: {
          padding: '18px',
          borderRadius: '10px',
          border: '1px solid rgba(248,81,73,0.35)',
        },
      },
      h(
        'h2',
        { style: { fontSize: '16px', margin: '0 0 8px 0' } },
        'Стереть файлы памяти (MEMORY.md и USER.md)',
      ),
      h(
        'p',
        { style: { margin: '0 0 10px 0', fontSize: '13px' } },
        `Текущий размер: MEMORY.md — ${formatBytesRu(state.memory?.memory)}, USER.md — ${formatBytesRu(state.memory?.user)}.`,
      ),
      h(
        'div',
        {
          className: 'nomad-data-preserved-notice',
          style: {
            padding: '12px',
            borderRadius: '8px',
            background: 'rgba(128,128,128,0.10)',
            marginBottom: '14px',
            fontSize: '13px',
          },
        },
        h(
          'div',
          { style: { fontWeight: 600, marginBottom: '6px' } },
          'Что удаляется и что остаётся:',
        ),
        h(
          'div',
          { style: { marginBottom: '4px' } },
          'Удаляется безвозвратно: memories/MEMORY.md и memories/USER.md.',
        ),
        h(
          'div',
          null,
          'Остаётся нетронутым: Star Map, learning.* и история сессий (sessions, state.db).',
        ),
      ),
      wipeStep === 0
        ? h(
            'button',
            {
              type: 'button',
              className: 'nomad-data-wipe-start-btn',
              title: 'Стереть временные файлы и память агента с двойным подтверждением',
              'data-tooltip': 'Стереть временные файлы и память агента с двойным подтверждением',
              onClick: handleStartWipe,
              style: {
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid rgba(248,81,73,0.55)',
                background: 'rgba(248,81,73,0.16)',
                color: 'inherit',
                cursor: 'pointer',
                fontWeight: 600,
              },
            },
            'Стереть',
          )
        : null,
      wipeStep === 1
        ? h(
            'div',
            {
              className: 'nomad-data-wipe-step-1',
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(210,153,34,0.5)',
                background: 'rgba(210,153,34,0.12)',
              },
            },
            h(
              'p',
              { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 } },
              'Подтверждение 1 из 2: вы действительно хотите удалить memories/MEMORY.md и memories/USER.md?',
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '10px' } },
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-wipe-confirm-1-btn',
                  onClick: handleFirstConfirm,
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(210,153,34,0.6)',
                    background: 'rgba(210,153,34,0.22)',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Да, перейти ко второму подтверждению',
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setWipeStep(0),
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.35)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Отмена',
              ),
            ),
          )
        : null,
      wipeStep === 2
        ? h(
            'div',
            {
              className: 'nomad-data-wipe-step-2',
              style: {
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid rgba(248,81,73,0.6)',
                background: 'rgba(248,81,73,0.14)',
              },
            },
            h(
              'p',
              { style: { margin: '0 0 10px 0', fontSize: '13px', fontWeight: 600 } },
              'Подтверждение 2 из 2 (окончательное): стереть MEMORY.md и USER.md прямо сейчас? Star Map, learning.* и история сессий сохранятся.',
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '10px' } },
              h(
                'button',
                {
                  type: 'button',
                  className: 'nomad-data-wipe-confirm-2-btn',
                  disabled: wiping,
                  onClick: handleSecondConfirmExecute,
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(248,81,73,0.75)',
                    background: 'rgba(248,81,73,0.28)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontWeight: 600,
                  },
                },
                wiping ? 'Удаление…' : 'Подтвердить и стереть окончательно',
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setWipeStep(0),
                  style: {
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.35)',
                    background: 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                'Отмена',
              ),
            ),
          )
        : null,
      wipeResult?.wiped
        ? h(
            'div',
            {
              className: 'nomad-data-wipe-done',
              style: {
                marginTop: '12px',
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'rgba(46,160,67,0.14)',
                fontSize: '13px',
              },
            },
            'Файлы memories/MEMORY.md и memories/USER.md удалены. Star Map, learning.* и история сессий сохранены.',
          )
        : null,
    ),
  );
}

export default function registerData(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return;

  ctx.register({
    id: DATA_NAV_ID,
    area: SIDEBAR_NAV_AREA,
    order: DATA_NAV_ORDER,
    label: DATA_NAV_LABEL,
    path: DATA_ROUTE_PATH,
    codicon: 'database',
    data: {
      codicon: 'database',
      label: DATA_NAV_LABEL,
      path: DATA_ROUTE_PATH,
      order: DATA_NAV_ORDER,
    },
  });

  ctx.register({
    id: 'route',
    area: ROUTES_AREA,
    order: DATA_NAV_ORDER,
    path: DATA_ROUTE_PATH,
    title: DATA_NAV_LABEL,
    data: {
      path: DATA_ROUTE_PATH,
      title: DATA_NAV_LABEL,
      codicon: 'database',
    },
    render: (props) => createElement(NomadDataPage, { ctx, ...(props || {}) }),
  });

  ctx.register({
    id: 'palette-open',
    area: PALETTE_AREA,
    order: 243,
    label: 'Данные и место — объём, откаты и очистка памяти',
    data: {
      id: 'nomad.data.open',
      label: 'Данные и место — объём, откаты и очистка памяти',
      group: 'Nomad',
      codicon: 'database',
      keywords: ['data', 'место', 'откаты', 'память', 'стереть', 'checkpoints', 'backup', 'restore', 'архив'],
      run: () => ctx?.host?.navigate?.(DATA_ROUTE_PATH),
    },
  });
}

