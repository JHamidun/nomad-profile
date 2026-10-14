/**
 * M-137: "Стоп и состояние": кнопка в статус-баре, палитра, Ctrl+Alt+S, маршруты pause/resume.
 */
import { PALETTE_AREA, STATUSBAR_AREAS } from '@hermes/plugin-sdk';
import { createElement, useCallback, useEffect, useState } from 'react';

const h = createElement;

export function StatusbarStopButton({ ctx }) {
  const [stopped, setStopped] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchState = useCallback(() => {
    if (!ctx || typeof ctx.rest !== 'function') return;
    Promise.resolve()
      .then(() => ctx.rest('/state'))
      .then((res) => {
        if (res && typeof res.stopped === 'boolean') {
          setStopped(res.stopped);
        }
      })
      .catch(() => {});
  }, [ctx]);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 3000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const toggleStop = useCallback(() => {
    if (!ctx || typeof ctx.rest !== 'function' || loading) return;
    setLoading(true);
    const endpoint = stopped ? '/resume' : '/pause';
    const body = stopped ? {} : { reason: 'desktop UI button' };

    Promise.resolve()
      .then(() => {
        if (typeof ctx.rest.post === 'function') {
          return ctx.rest.post(endpoint, body);
        }
        return ctx.rest(endpoint, { method: 'POST', body });
      })
      .then(() => {
        setStopped(!stopped);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
  }, [ctx, stopped, loading]);

  const label = stopped ? '▶️ Продолжить' : '⏸️ Стоп';
  const title = stopped
    ? 'Nomad приостановлен. Нажмите, чтобы продолжить (Ctrl+Alt+S).'
    : 'Приостановить работу Nomad (Ctrl+Alt+S).';

  return h(
    'button',
    {
      type: 'button',
      onClick: toggleStop,
      title: title,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        fontSize: '12px',
        cursor: 'pointer',
        border: '1px solid currentColor',
        borderRadius: '3px',
        background: stopped ? '#ff4d4f' : 'transparent',
        color: stopped ? '#ffffff' : 'inherit',
      },
    },
    label
  );
}

export default function register(ctx) {
  // 1. Status bar button
  if (typeof ctx.register === 'function') {
    ctx.register({
      id: 'statusbar_stop',
      area: STATUSBAR_AREAS.RIGHT || 'statusbar:right',
      order: 10,
      render: () => h(StatusbarStopButton, { ctx }),
    });

    // 2. Command Palette actions
    ctx.register({
      id: 'cmd_pause',
      area: PALETTE_AREA || 'palette',
      data: {
        id: 'nomad.pause',
        label: 'Nomad: Стоп (приостановить запуск задач)',
        keybinding: 'Ctrl+Alt+S',
      },
      action: () => {
        if (typeof ctx.rest === 'function') {
          const fn = ctx.rest.post || ctx.rest;
          fn('/pause', { reason: 'command palette' });
        }
      },
    });

    ctx.register({
      id: 'cmd_resume',
      area: PALETTE_AREA || 'palette',
      data: {
        id: 'nomad.resume',
        label: 'Nomad: Продолжить (возобновить запуск задач)',
      },
      action: () => {
        if (typeof ctx.rest === 'function') {
          const fn = ctx.rest.post || ctx.rest;
          fn('/resume', {});
        }
      },
    });
  }
}
