// М-138 + М-139: Экран десктопа «Навыки Nomad» (/nomad-skills, K11).
// Вкладки:
//   - «Каталог» (список навыков профиля с русскими описаниями из descriptions.ru.yaml);
//   - «Наборы» (управление наборами навыков skill-bundles: создание и удаление);
//   - «Архив» (куратор навыков: просмотр архивных навыков, восстановление, закрепление pin/unpin; БЕЗ кнопки purge).

import {
  PALETTE_AREA,
  ROUTES_AREA,
  SIDEBAR_NAV_AREA,
} from '@hermes/plugin-sdk';
import { createElement, useCallback, useEffect, useState } from 'react';

export const SKILLS_ROUTE_PATH = '/nomad-skills';
export const SKILLS_NAV_ID = 'skills';
export const SKILLS_NAV_LABEL = 'Навыки Nomad';
export const SKILLS_NAV_ORDER = 61;
export const SKILLS_UNTRANSLATED_BADGE = 'На английском (без перевода)';
export const SKILLS_TRANSLATED_BADGE = 'Русское описание';

const h = createElement;

export function formatSkillDisplay(skill) {
  if (!skill || typeof skill !== 'object') {
    return {
      title: '',
      description: '',
      badge: SKILLS_UNTRANSLATED_BADGE,
      hasRuTranslation: false,
      languageNote: 'Описание на английском (русский перевод пока не добавлен)',
    };
  }
  const hasRu = Boolean(skill.has_ru_translation && skill.description_ru);
  const title = skill.title || skill.name || '';
  if (hasRu) {
    return {
      title,
      description: skill.description_ru || skill.user_description || skill.description || '',
      badge: skill.badge || SKILLS_TRANSLATED_BADGE,
      hasRuTranslation: true,
      languageNote: null,
    };
  }
  const enText = skill.description_en || skill.description || 'Описание отсутствует';
  const note = skill.language_note || 'Описание на английском (русский перевод пока не добавлен)';
  return {
    title,
    description: enText,
    badge: skill.badge || SKILLS_UNTRANSLATED_BADGE,
    hasRuTranslation: false,
    languageNote: note,
  };
}

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

function restDelete(ctx, path) {
  if (typeof ctx?.rest?.delete === 'function') {
    return Promise.resolve(ctx.rest.delete(path));
  }
  if (typeof ctx?.rest === 'function') {
    return Promise.resolve(ctx.rest(path, { method: 'DELETE' }));
  }
  return Promise.resolve(null);
}

export function NomadSkillsPage({ ctx }) {
  const [activeTab, setActiveTab] = useState('catalog');
  const [state, setState] = useState({
    loading: true,
    error: null,
    skills: [],
    categories: [],
    total: 0,
    translatedCount: 0,
    untranslatedCount: 0,
    enabledCount: 0,
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyTranslated, setOnlyTranslated] = useState(false);
  const [onlyEnabled, setOnlyEnabled] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [busyName, setBusyName] = useState(null);

  // Состояние вкладки «Наборы» (bundles)
  const [bundles, setBundles] = useState([]);
  const [bundleName, setBundleName] = useState('');
  const [bundleDesc, setBundleDesc] = useState('');
  const [bundleSkillsInput, setBundleSkillsInput] = useState('');
  const [bundleBusy, setBundleBusy] = useState(false);
  const [bundleNotice, setBundleNotice] = useState('');

  // Состояние вкладки «Архив» (curator)
  const [archivedSkills, setArchivedSkills] = useState([]);
  const [pinnedSkills, setPinnedSkills] = useState([]);
  const [curatorActiveSkills, setCuratorActiveSkills] = useState([]);
  const [curatorBusy, setCuratorBusy] = useState(false);
  const [curatorNotice, setCuratorNotice] = useState('');

  const loadSkills = useCallback(() => {
    if (!ctx?.rest) {
      setState((prev) => ({ ...prev, loading: false }));
      return Promise.resolve(null);
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (category && category !== 'all') params.set('category', category);
    if (onlyTranslated) params.set('only_translated', 'true');
    if (onlyEnabled) params.set('only_enabled', 'true');
    const qs = params.toString();
    const path = qs ? `/skills?${qs}` : '/skills';
    return restGet(ctx, path)
      .then((res) => {
        if (!res || typeof res !== 'object') return null;
        setState({
          loading: false,
          error: null,
          skills: Array.isArray(res.skills) ? res.skills : [],
          categories: Array.isArray(res.categories) ? res.categories : [],
          total: Number(res.total || 0),
          translatedCount: Number(res.translated_count || 0),
          untranslatedCount: Number(res.untranslated_count || 0),
          enabledCount: Number(res.enabled_count || 0),
        });
        return res;
      })
      .catch((err) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err?.message || 'Не удалось загрузить каталог навыков',
        }));
        return null;
      });
  }, [ctx, query, category, onlyTranslated, onlyEnabled]);

  const loadBundles = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet(ctx, '/skills/bundles')
      .then((res) => {
        if (res && Array.isArray(res.bundles)) {
          setBundles(res.bundles);
        }
        return res;
      })
      .catch(() => null);
  }, [ctx]);

  const loadCurator = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet(ctx, '/skills/curator')
      .then((res) => {
        if (!res || typeof res !== 'object') return null;
        setArchivedSkills(Array.isArray(res.archived) ? res.archived : []);
        setPinnedSkills(Array.isArray(res.pinned_skills) ? res.pinned_skills : []);
        setCuratorActiveSkills(Array.isArray(res.active_skills) ? res.active_skills : []);
        return res;
      })
      .catch(() => null);
  }, [ctx]);

  useEffect(() => {
    loadSkills();
    loadBundles();
    loadCurator();
  }, [loadSkills, loadBundles, loadCurator]);

  const handleToggleSkill = useCallback(
    (skill) => {
      if (!ctx?.rest || !skill?.name) return Promise.resolve(null);
      const nextEnabled = !skill.enabled;
      setBusyName(skill.name);
      return restPost(ctx, '/skills/toggle', {
        name: skill.name,
        enabled: nextEnabled,
      })
        .then(() => loadSkills())
        .catch((err) => {
          ctx?.host?.toast?.error?.(err?.message || 'Не удалось переключить навык');
        })
        .finally(() => {
          setBusyName(null);
        });
    },
    [ctx, loadSkills],
  );

  const handlePinSkill = useCallback(
    (skillName, nextPinned) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice('');
      return restPost(ctx, '/skills/curator/pin', {
        name: skillName,
        pinned: Boolean(nextPinned),
      })
        .then((res) => {
          setCuratorNotice(
            nextPinned
              ? `Навык «${skillName}» закреплён от автоматической архивации.`
              : `С навыка «${skillName}» снято закрепление.`,
          );
          loadSkills();
          loadCurator();
          return res;
        })
        .catch((err) => {
          ctx?.host?.toast?.error?.(err?.message || 'Не удалось изменить закрепление навыка');
        })
        .finally(() => {
          setCuratorBusy(false);
        });
    },
    [ctx, loadSkills, loadCurator],
  );

  const handleRestoreArchived = useCallback(
    (skillName) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice('');
      return restPost(ctx, '/skills/curator/restore', { name: skillName })
        .then((res) => {
          setCuratorNotice(`Навык «${skillName}» восстановлен из архива в рабочий каталог.`);
          loadSkills();
          loadCurator();
          return res;
        })
        .catch((err) => {
          ctx?.host?.toast?.error?.(err?.message || 'Не удалось восстановить навык из архива');
        })
        .finally(() => {
          setCuratorBusy(false);
        });
    },
    [ctx, loadSkills, loadCurator],
  );

  const handleCreateBundle = useCallback(
    (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!ctx?.rest) return Promise.resolve(null);
      const name = bundleName.trim();
      const skillsList = bundleSkillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!name || skillsList.length === 0) {
        setBundleNotice('Укажите название набора и хотя бы один навык через запятую.');
        return Promise.resolve(null);
      }
      setBundleBusy(true);
      setBundleNotice('');
      return restPost(ctx, '/skills/bundles', {
        name,
        skills: skillsList,
        description: bundleDesc.trim(),
        overwrite: true,
      })
        .then((res) => {
          if (res?.bundles) setBundles(res.bundles);
          else loadBundles();
          setBundleName('');
          setBundleDesc('');
          setBundleSkillsInput('');
          setBundleNotice(`Набор «${name}» сохранён.`);
          return res;
        })
        .catch((err) => {
          setBundleNotice(err?.message || 'Не удалось сохранить набор навыков.');
        })
        .finally(() => {
          setBundleBusy(false);
        });
    },
    [ctx, bundleName, bundleDesc, bundleSkillsInput, loadBundles],
  );

  const handleDeleteBundle = useCallback(
    (slugOrName) => {
      if (!ctx?.rest || !slugOrName) return Promise.resolve(null);
      setBundleBusy(true);
      setBundleNotice('');
      return restDelete(ctx, `/skills/bundles/${encodeURIComponent(slugOrName)}`)
        .then((res) => {
          if (res?.bundles) setBundles(res.bundles);
          else loadBundles();
          setBundleNotice(`Набор «${slugOrName}» удалён.`);
          return res;
        })
        .catch((err) => {
          setBundleNotice(err?.message || 'Не удалось удалить набор навыков.');
        })
        .finally(() => {
          setBundleBusy(false);
        });
    },
    [ctx, loadBundles],
  );

  const handleInspectSkill = useCallback(
    (skill) => {
      if (!ctx?.rest || !skill?.name) {
        setSelectedSkill(skill || null);
        return Promise.resolve(null);
      }
      return restGet(ctx, `/skills/${encodeURIComponent(skill.name)}`)
        .then((res) => {
          setSelectedSkill(res?.skill || skill);
          return res?.skill || skill;
        })
        .catch(() => {
          setSelectedSkill(skill);
          return skill;
        });
    },
    [ctx],
  );

  return h(
    'div',
    {
      className: 'nomad-skills-page',
      style: { padding: '24px', maxWidth: '1120px', margin: '0 auto' },
    },
    h(
      'header',
      { style: { marginBottom: '20px' } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
          },
        },
        h(
          'div',
          null,
          h(
            'h1',
            { style: { fontSize: '22px', fontWeight: 600, margin: '0 0 6px 0' } },
            'Навыки Nomad',
          ),
          h(
            'p',
            { style: { margin: 0, opacity: 0.78, fontSize: '13px' } },
            'Каталог установленных навыков агента с русскими пользовательскими описаниями, наборами и архивом.',
          ),
        ),
        h(
          'div',
          { style: { display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12px' } },
          h(
            'span',
            {
              className: 'nomad-skills-stat-total',
              style: {
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(128,128,128,0.14)',
              },
            },
            `Всего: ${state.total}`,
          ),
          h(
            'span',
            {
              className: 'nomad-skills-stat-ru',
              style: {
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(46,160,67,0.16)',
              },
            },
            `На русском: ${state.translatedCount}`,
          ),
          h(
            'span',
            {
              className: 'nomad-skills-stat-en',
              style: {
                padding: '4px 10px',
                borderRadius: '999px',
                background: 'rgba(210,153,34,0.18)',
              },
            },
            `Без перевода: ${state.untranslatedCount}`,
          ),
        ),
      ),
      h(
        'div',
        {
          role: 'tablist',
          className: 'nomad-skills-tabs',
          style: {
            display: 'flex',
            gap: '8px',
            marginTop: '16px',
            borderBottom: '1px solid rgba(128,128,128,0.24)',
            paddingBottom: '8px',
          },
        },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': activeTab === 'catalog',
            title: 'Каталог навыков профиля с русскими описаниями',
            'data-tooltip': 'Каталог навыков профиля с русскими описаниями',
            onClick: () => setActiveTab('catalog'),
            style: {
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'catalog' ? '#2563eb' : 'rgba(128,128,128,0.12)',
              color: activeTab === 'catalog' ? '#ffffff' : 'inherit',
            },
          },
          `Каталог (${state.total})`,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': activeTab === 'bundles',
            title: 'Управление наборами навыков (skill-bundles)',
            'data-tooltip': 'Управление наборами навыков (skill-bundles)',
            onClick: () => setActiveTab('bundles'),
            style: {
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'bundles' ? '#2563eb' : 'rgba(128,128,128,0.12)',
              color: activeTab === 'bundles' ? '#ffffff' : 'inherit',
            },
          },
          `Наборы (${bundles.length})`,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': activeTab === 'curator',
            title: 'Архив и куратор отключённых навыков',
            'data-tooltip': 'Архив и куратор отключённых навыков',
            onClick: () => setActiveTab('curator'),
            style: {
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeTab === 'curator' ? '#2563eb' : 'rgba(128,128,128,0.12)',
              color: activeTab === 'curator' ? '#ffffff' : 'inherit',
            },
          },
          `Архив (${archivedSkills.length})`,
        ),
      ),
    ),
    activeTab === 'bundles'
      ? h(
          'section',
          {
            className: 'nomad-skills-bundles-tab',
            style: { display: 'flex', flexDirection: 'column', gap: '16px' },
          },
          h(
            'form',
            {
              onSubmit: handleCreateBundle,
              style: {
                padding: '16px',
                borderRadius: '10px',
                border: '1px solid rgba(128,128,128,0.24)',
                display: 'grid',
                gap: '10px',
              },
            },
            h('h3', { style: { margin: 0, fontSize: '16px' } }, 'Создать набор навыков'),
            h(
              'p',
              { style: { margin: 0, fontSize: '13px', opacity: 0.78 } },
              'Набор объединяет несколько навыков под одной быстрой командой в чате.',
            ),
            bundleNotice
              ? h('div', { style: { fontSize: '13px', color: '#2563eb' } }, bundleNotice)
              : null,
            h('input', {
              type: 'text',
              value: bundleName,
              onChange: (e) => setBundleName(e?.target?.value ?? ''),
              placeholder: 'Название набора (например, backend-review)',
              style: {
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(128,128,128,0.3)',
                background: 'transparent',
                color: 'inherit',
              },
            }),
            h('input', {
              type: 'text',
              value: bundleSkillsInput,
              onChange: (e) => setBundleSkillsInput(e?.target?.value ?? ''),
              placeholder: 'Навыки через запятую (например: github, docx)',
              style: {
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(128,128,128,0.3)',
                background: 'transparent',
                color: 'inherit',
              },
            }),
            h('input', {
              type: 'text',
              value: bundleDesc,
              onChange: (e) => setBundleDesc(e?.target?.value ?? ''),
              placeholder: 'Краткое описание набора (необязательно)',
              style: {
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(128,128,128,0.3)',
                background: 'transparent',
                color: 'inherit',
              },
            }),
            h(
              'div',
              null,
              h(
                'button',
                {
                  type: 'submit',
                  disabled: bundleBusy,
                  style: {
                    padding: '8px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#2563eb',
                    color: '#ffffff',
                    fontWeight: 600,
                    cursor: 'pointer',
                  },
                },
                'Сохранить набор',
              ),
            ),
          ),
          h(
            'div',
            {
              className: 'nomad-bundles-list',
              style: { display: 'grid', gap: '10px' },
            },
            bundles.length === 0
              ? h(
                  'div',
                  {
                    style: {
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px dashed rgba(128,128,128,0.3)',
                      fontSize: '13px',
                      opacity: 0.78,
                    },
                  },
                  'У вас пока нет сохранённых наборов навыков.',
                )
              : bundles.map((b) =>
                  h(
                    'div',
                    {
                      key: b.slug || b.name,
                      className: 'nomad-bundle-card',
                      style: {
                        padding: '14px 16px',
                        borderRadius: '10px',
                        border: '1px solid rgba(128,128,128,0.24)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                      },
                    },
                    h(
                      'div',
                      null,
                      h(
                        'div',
                        { style: { fontWeight: 600, fontSize: '15px' } },
                        `${b.name} (${b.command || '/' + b.slug})`,
                      ),
                      h(
                        'div',
                        { style: { fontSize: '12px', opacity: 0.78, marginTop: '2px' } },
                        b.description || '',
                      ),
                      h(
                        'div',
                        { style: { fontSize: '12px', opacity: 0.85, marginTop: '4px' } },
                        `Навыки: ${(b.skills || []).join(', ')}`,
                      ),
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: bundleBusy,
                        onClick: () => handleDeleteBundle(b.slug || b.name),
                        style: {
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(248,81,73,0.4)',
                          background: 'rgba(248,81,73,0.12)',
                          color: 'inherit',
                          cursor: 'pointer',
                        },
                      },
                      'Удалить набор',
                    ),
                  ),
                ),
          ),
        )
      : activeTab === 'curator'
        ? h(
            'section',
            {
              className: 'nomad-skills-curator-tab',
              style: { display: 'flex', flexDirection: 'column', gap: '16px' },
            },
            curatorNotice
              ? h(
                  'div',
                  {
                    style: {
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'rgba(46,160,67,0.16)',
                      fontSize: '13px',
                    },
                  },
                  curatorNotice,
                )
              : null,
            h(
              'div',
              {
                style: {
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(128,128,128,0.24)',
                },
              },
              h('h3', { style: { margin: '0 0 6px 0', fontSize: '16px' } }, 'Архивные навыки'),
              h(
                'p',
                { style: { margin: '0 0 12px 0', fontSize: '13px', opacity: 0.78 } },
                'Навыки, перемещённые куратором в архив из-за неактивности. Вы можете в любой момент вернуть любой навык обратно в рабочий каталог.',
              ),
              archivedSkills.length === 0
                ? h(
                    'div',
                    { style: { fontSize: '13px', opacity: 0.72 } },
                    'В архиве сейчас нет ни одного навыка.',
                  )
                : h(
                    'div',
                    { style: { display: 'grid', gap: '10px' } },
                    ...archivedSkills.map((arch) =>
                      h(
                        'div',
                        {
                          key: arch.name,
                          className: 'nomad-archived-skill-card',
                          style: {
                            padding: '12px 14px',
                            borderRadius: '8px',
                            border: '1px solid rgba(128,128,128,0.24)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '12px',
                          },
                        },
                        h(
                          'div',
                          null,
                          h('div', { style: { fontWeight: 600, fontSize: '14px' } }, arch.title || arch.name),
                          h('div', { style: { fontSize: '12px', opacity: 0.75 } }, arch.description || ''),
                        ),
                        h(
                          'button',
                          {
                            type: 'button',
                            disabled: curatorBusy,
                            onClick: () => handleRestoreArchived(arch.name),
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
                          'Восстановить',
                        ),
                      ),
                    ),
                  ),
            ),
            h(
              'div',
              {
                style: {
                  padding: '16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(128,128,128,0.24)',
                },
              },
              h(
                'h3',
                { style: { margin: '0 0 6px 0', fontSize: '16px' } },
                'Закрепление навыков от автоархивации',
              ),
              h(
                'p',
                { style: { margin: '0 0 12px 0', fontSize: '13px', opacity: 0.78 } },
                'Закреплённые навыки никогда не переносятся куратором в архив автоматически.',
              ),
              h(
                'div',
                { style: { display: 'grid', gap: '8px' } },
                ...(curatorActiveSkills.length > 0 ? curatorActiveSkills : state.skills).map((sk) => {
                  const isPinned = Boolean(sk.pinned || pinnedSkills.includes(sk.name));
                  return h(
                    'div',
                    {
                      key: sk.name,
                      style: {
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(128,128,128,0.2)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      },
                    },
                    h(
                      'span',
                      { style: { fontSize: '13px', fontWeight: 500 } },
                      `${sk.title || sk.name} (${sk.name})`,
                    ),
                    h(
                      'button',
                      {
                        type: 'button',
                        disabled: curatorBusy,
                        onClick: () => handlePinSkill(sk.name, !isPinned),
                        style: {
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid rgba(128,128,128,0.3)',
                          background: isPinned ? 'rgba(46,160,67,0.16)' : 'transparent',
                          color: 'inherit',
                          fontSize: '12px',
                          cursor: 'pointer',
                        },
                      },
                      isPinned ? 'Закреплён (Открепить)' : 'Закрепить',
                    ),
                  );
                }),
              ),
            ),
          )
        : null,
    h(
      'section',
      {
        className: 'nomad-skills-filters',
        style: {
          display: activeTab === 'catalog' ? 'flex' : 'none',
          gap: '12px',
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: '18px',
        },
      },
      h('input', {
        type: 'search',
        value: query,
        onChange: (e) => setQuery(e?.target?.value ?? ''),
        placeholder: 'Поиск по названию, тегам или описанию навыка…',
        style: {
          flex: '1 1 260px',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid rgba(128,128,128,0.3)',
          background: 'transparent',
          color: 'inherit',
        },
      }),
      h(
        'select',
        {
          value: category,
          onChange: (e) => setCategory(e?.target?.value ?? 'all'),
          style: {
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid rgba(128,128,128,0.3)',
            background: 'transparent',
            color: 'inherit',
          },
        },
        h('option', { value: 'all' }, 'Все категории'),
        ...(state.categories || []).map((cat) =>
          h(
            'option',
            { key: cat.id, value: cat.id },
            `${cat.label} (${cat.count})`,
          ),
        ),
      ),
      h(
        'label',
        { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
        h('input', {
          type: 'checkbox',
          checked: onlyTranslated,
          onChange: (e) => setOnlyTranslated(Boolean(e?.target?.checked)),
        }),
        'Только с русским описанием',
      ),
      h(
        'label',
        { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' } },
        h('input', {
          type: 'checkbox',
          checked: onlyEnabled,
          onChange: (e) => setOnlyEnabled(Boolean(e?.target?.checked)),
        }),
        'Только включённые',
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
      'div',
      {
        className: 'nomad-skills-list',
        style: {
          display: activeTab === 'catalog' ? 'grid' : 'none',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '12px',
        },
      },
      ...(state.skills || []).map((skill) => {
        const display = formatSkillDisplay(skill);
        return h(
          'article',
          {
            key: skill.name,
            className: `nomad-skill-card ${display.hasRuTranslation ? 'is-ru' : 'is-en-fallback'}`,
            'data-skill-name': skill.name,
            'data-has-ru': display.hasRuTranslation ? 'true' : 'false',
            style: {
              padding: '14px 16px',
              borderRadius: '10px',
              border: '1px solid rgba(128,128,128,0.24)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '10px',
              opacity: skill.enabled ? 1 : 0.65,
            },
          },
          h(
            'div',
            null,
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '6px',
                },
              },
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { fontWeight: 600, fontSize: '15px' } },
                  display.title,
                ),
                h(
                  'div',
                  { style: { fontSize: '11px', opacity: 0.65 } },
                  `${skill.name} · ${skill.category_ru || skill.category || 'Общие навыки'}`,
                ),
              ),
              h(
                'span',
                {
                  className: 'nomad-skill-lang-badge',
                  style: {
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                    background: display.hasRuTranslation
                      ? 'rgba(46,160,67,0.16)'
                      : 'rgba(210,153,34,0.20)',
                  },
                },
                display.badge,
              ),
            ),
            h(
              'p',
              {
                className: 'nomad-skill-description',
                style: { margin: '6px 0 0 0', fontSize: '13px', lineHeight: 1.45 },
              },
              display.description,
            ),
            display.languageNote
              ? h(
                  'div',
                  {
                    className: 'nomad-skill-untranslated-note',
                    style: {
                      marginTop: '6px',
                      fontSize: '11px',
                      opacity: 0.8,
                      fontStyle: 'italic',
                    },
                  },
                  display.languageNote,
                )
              : null,
          ),
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '8px',
                marginTop: '6px',
              },
            },
            h(
              'button',
              {
                type: 'button',
                onClick: () => handleInspectSkill(skill),
                style: {
                  padding: '4px 10px',
                  fontSize: '12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(128,128,128,0.3)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                },
              },
              'Подробнее',
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '6px' } },
              h(
                'button',
                {
                  type: 'button',
                  disabled: curatorBusy,
                  onClick: () => handlePinSkill(skill.name, !skill.pinned),
                  style: {
                    padding: '4px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.3)',
                    background: skill.pinned ? 'rgba(37,99,235,0.16)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                skill.pinned ? 'Закреплён' : 'Закрепить',
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: busyName === skill.name,
                  onClick: () => handleToggleSkill(skill),
                  style: {
                    padding: '4px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid rgba(128,128,128,0.3)',
                    background: skill.enabled ? 'rgba(46,160,67,0.16)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                  },
                },
                skill.enabled ? 'Включён' : 'Выключен',
              ),
            ),
          ),
        );
      }),
    ),
    selectedSkill
      ? h(
          'aside',
          {
            className: 'nomad-skill-detail-modal',
            style: {
              marginTop: '20px',
              padding: '16px',
              borderRadius: '10px',
              border: '1px solid rgba(128,128,128,0.3)',
            },
          },
          h(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            h('strong', null, `${selectedSkill.title || selectedSkill.name} (${selectedSkill.name})`),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setSelectedSkill(null),
                style: { cursor: 'pointer', background: 'transparent', border: 'none', color: 'inherit' },
              },
              'Закрыть',
            ),
          ),
          h('p', { style: { fontSize: '13px' } }, selectedSkill.user_description || selectedSkill.description),
          selectedSkill.description_en && selectedSkill.has_ru_translation
            ? h(
                'p',
                { style: { fontSize: '12px', opacity: 0.7 } },
                `Оригинальное описание (EN): ${selectedSkill.description_en}`,
              )
            : null,
        )
      : null,
  );
}

export default function registerSkills(ctx) {
  if (!ctx || typeof ctx.register !== 'function') return;

  const renderPage = (props) => createElement(NomadSkillsPage, { ctx, ...(props || {}) });

  ctx.register({
    id: 'page',
    area: ROUTES_AREA,
    path: SKILLS_ROUTE_PATH,
    title: SKILLS_NAV_LABEL,
    data: {
      path: SKILLS_ROUTE_PATH,
      title: SKILLS_NAV_LABEL,
    },
    render: renderPage,
    component: renderPage,
  });

  ctx.register({
    id: SKILLS_NAV_ID,
    area: SIDEBAR_NAV_AREA,
    order: SKILLS_NAV_ORDER,
    label: SKILLS_NAV_LABEL,
    path: SKILLS_ROUTE_PATH,
    codicon: 'extensions',
    data: {
      id: 'nomad.skills.nav',
      codicon: 'extensions',
      label: SKILLS_NAV_LABEL,
      path: SKILLS_ROUTE_PATH,
      order: SKILLS_NAV_ORDER,
    },
  });

  ctx.register({
    id: 'palette',
    area: PALETTE_AREA,
    order: SKILLS_NAV_ORDER,
    data: {
      id: 'nomad.skills.open',
      action: 'nomad.skills.open',
      label: 'Навыки Nomad — каталог и русские описания',
      category: 'Nomad',
      codicon: 'extensions',
      keywords: ['skills', 'навыки', 'русские описания', 'каталог', 'наборы', 'архив'],
      run: () => ctx?.host?.navigate?.(SKILLS_ROUTE_PATH),
    },
  });
}
