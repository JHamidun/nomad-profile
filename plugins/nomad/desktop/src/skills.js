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

const DEFAULT_RF_CONNECTORS = [
  {
    id: '1c-odata',
    title: '1С:Предприятие 8.3 (ERP, УТ, Бухгалтерия, ЗУП)',
    category: 'ERP и Учёт РФ',
    badge: 'OData v3 / HTTP-сервис · 152-ФЗ',
    description: 'Прямое подключение к 1С через стандартный интерфейс OData (/odata/standard.odata) или HTTP-сервис: остатки, счета, сверка контрагентов, выгрузка ОСВ и кадровых приказов.',
    allowed_hosts: ['1c.company.ru', 'erp.local', '10.0.0.0/8'],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'ONEC_BASE_URL', label: 'URL публикации 1С OData', placeholder: 'https://1c.company.ru/buh/odata/standard.odata', secret: false },
      { key: 'ONEC_USERNAME', label: 'Пользователь 1С', placeholder: 'ai_bot_readonly', secret: false },
      { key: 'ONEC_PASSWORD', label: 'Пароль / Токен 1С', placeholder: '••••••••••••', secret: true },
    ],
  },
  {
    id: 'bitrix24',
    title: 'Битрикс24 (CRM, Задачи, Диск и Живая лента)',
    category: 'CRM и Портал РФ',
    badge: 'Встроенный MCP · 152-ФЗ',
    description: 'Нативный MCP-сервер bitrix24 + корпоративные навыки: лиды, сделки, смарт-процессы, задачи, аналитика воронки продаж и отчёты руководителю.',
    allowed_hosts: ['bitrix24.ru', 'bitrix24.by', 'bitrix24.kz'],
    supports_vpn: true,
    mcp_server: 'bitrix24',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'BITRIX24_WEBHOOK_URL', label: 'Входящий вебхук Битрикс24 (.ru)', placeholder: 'https://company.bitrix24.ru/rest/1/xxxxx/', secret: true },
    ],
  },
  {
    id: 'diadoc',
    title: 'Контур.Диадок и Контур.Фокус (ЮЗЭДО и Комплаенс)',
    category: 'ЭДО и Налоги РФ',
    badge: 'ЮЗЭДО · УКЭП · ФНС',
    description: 'Юридически значимый электронный документооборот: проверка входящих УПД/актов/счетов-фактур (XML ФНС 5.02), сверка с договором и скоринг в Контур.Фокус.',
    allowed_hosts: ['diadoc-api.kontur.ru', 'focus-api.kontur.ru'],
    supports_vpn: false,
    mcp_server: 'ru-counterparty',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'DIADOC_API_KEY', label: 'Ключ разработчика Диадок (ddauth_api_client_id)', placeholder: 'client-id-xxxx...', secret: true },
      { key: 'DIADOC_BOX_ID', label: 'ID ящика организации в Диадок', placeholder: 'box-id@kontur.ru', secret: false },
      { key: 'KONTUR_FOCUS_API_KEY', label: 'Ключ API Контур.Фокус (опционально)', placeholder: 'focus-key...', secret: true },
    ],
  },
  {
    id: 'sbis',
    title: 'СБИС / Saby (ЭДО, Отчётность и Склад)',
    category: 'ЭДО и Налоги РФ',
    badge: 'JSON-RPC · Saby API',
    description: 'Интеграция со СБИС (Saby): получение и маршрутизация первичных документов ЭДО, контроль подписания УКЭП и проверка поставщиков.',
    allowed_hosts: ['online.sbis.ru', 'api.sbis.ru'],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'SBIS_APP_CLIENT_ID', label: 'App Client ID сервисного приложения СБИС', placeholder: 'sbis-app-id...', secret: false },
      { key: 'SBIS_APP_SECRET', label: 'Защищённый ключ / Сервисный пароль СБИС', placeholder: '••••••••••••', secret: true },
    ],
  },
  {
    id: 'yandex-360',
    title: 'Яндекс 360 для бизнеса (Почта, Диск, Трекер, Метрика)',
    category: 'Офис и Аналитика РФ',
    badge: '3 встроенных MCP · 152-ФЗ',
    description: 'Полный контур Яндекс 360: MCP-серверы yandex-mail, yandex-disk, yandex-metrika + Яндекс Трекер, Календарь, Wiki и Телемост.',
    allowed_hosts: ['cloud-api.yandex.net', 'api.tracker.yandex.net', 'api-metrika.yandex.net', 'imap.yandex.ru'],
    supports_vpn: false,
    mcp_server: 'yandex-disk',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'YANDEX_OAUTH_TOKEN', label: 'OAuth-токен Яндекс 360 / Диск / Метрика', placeholder: 'y0_AgAAAAA...', secret: true },
      { key: 'YANDEX_ORG_ID', label: 'ID организации Яндекс 360 / Трекер', placeholder: '7800000', secret: false },
      { key: 'YANDEX_MAIL_USER', label: 'Корпоративный ящик Яндекс Почты', placeholder: 'user@company.ru', secret: false },
      { key: 'YANDEX_MAIL_APP_PASSWORD', label: 'Пароль приложения Яндекс Почты (IMAP)', placeholder: '••••••••••••', secret: true },
    ],
  },
  {
    id: 'mts-link',
    title: 'МТС Линк (Ktalk / Webinar · ВКС и Протоколы встреч)',
    category: 'Коммуникации РФ',
    badge: 'ВКС РФ · Авто-протоколы',
    description: 'Автоматическая выгрузка записей совещаний из МТС Линк, русскоязычная транскрибация, выделение поручений с дедлайнами и отправка в Битрикс24 / Трекер.',
    allowed_hosts: ['userapi.mts-link.ru', 'ktalk.ru'],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'MTS_LINK_API_TOKEN', label: 'Токен доступа МТС Линк (x-auth-token)', placeholder: 'mts-link-token...', secret: true },
      { key: 'MTS_LINK_DOMAIN', label: 'Корпоративный домен МТС Линк / Ktalk', placeholder: 'company.mts-link.ru', secret: false },
    ],
  },
  {
    id: 'fns-dadata-cbr',
    title: 'ФНС ЕГРЮЛ/ГИР БО, DaData, Госзакупки 44-ФЗ/223-ФЗ и ЦБ РФ',
    category: 'Госреестры и Финансы РФ',
    badge: '2 встроенных MCP · Госданные',
    description: 'MCP-серверы ru-counterparty и ru-open-data: проверка ИНН/ОГРН, бухотчётность ФНС (РСБУ Ф1/Ф2), курсы валют и ключевая ставка ЦБ РФ, тендеры ЕИС.',
    allowed_hosts: ['suggestions.dadata.ru', 'cbr.ru', 'www.cbr-xml-daily.ru', 'bo.nalog.gov.ru', 'zakupki.gov.ru'],
    supports_vpn: false,
    mcp_server: 'ru-counterparty',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'DADATA_API_KEY', label: 'API-ключ DaData.ru (реквизиты по ИНН)', placeholder: 'dadata-api-key...', secret: true },
      { key: 'DADATA_SECRET_KEY', label: 'Секретный ключ DaData (стандартизация)', placeholder: 'dadata-secret...', secret: true },
    ],
  },
  {
    id: 'garant-consultant',
    title: 'Гарант API и КонсультантПлюс (Правовой контур РФ)',
    category: 'Юриспруденция РФ',
    badge: 'НПА РФ · Судебная практика',
    description: 'Верификация договоров по ГК РФ, ТК РФ, НК РФ и 152-ФЗ без галлюцинаций: поиск действующих редакций законов, писем Минфина/ФНС и практики ВС РФ.',
    allowed_hosts: ['api.garant.ru', 'internet.garant.ru'],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'GARANT_API_TOKEN', label: 'Токен доступа API Гарант', placeholder: 'Bearer garant-token...', secret: true },
      { key: 'CONSULTANT_LOCAL_URL', label: 'Локальный веб-сервер КонсультантПлюс (в контуре)', placeholder: 'https://cons.company.local', secret: false },
    ],
  },
  {
    id: 'amocrm',
    title: 'amoCRM (Сделки, Контакты и Автоматизация продаж)',
    category: 'CRM и Портал РФ',
    badge: 'amoCRM REST v4 · 152-ФЗ',
    description: 'Чтение и обновление карточек сделок amoCRM, суммаризация звонков и переписок с клиентами, автозаполнение полей CRM и контроль SLA.',
    allowed_hosts: ['amocrm.ru'],
    supports_vpn: false,
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'AMOCRM_SUBDOMAIN', label: 'Поддомен аккаунта amoCRM (.amocrm.ru)', placeholder: 'company.amocrm.ru', secret: false },
      { key: 'AMOCRM_ACCESS_TOKEN', label: 'Долгосрочный токен amoCRM', placeholder: 'eyJ0eXAiOiJKV1Qi...', secret: true },
    ],
  },
  {
    id: 'kaiten-weeek',
    title: 'Kaiten и WEEEK (Российские Agile-доски и База знаний)',
    category: 'Управление проектами РФ',
    badge: 'Импортозамещение Jira / Notion',
    description: 'Управление карточками, спринтами, эпиками и базой знаний в российских сервисах Kaiten.ru и WEEEK.net.',
    allowed_hosts: ['kaiten.ru', 'api.weeek.net'],
    supports_vpn: true,
    mcp_server: 'knowledge-base',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'KAITEN_BASE_URL', label: 'Домен Kaiten (например, company.kaiten.ru)', placeholder: 'https://company.kaiten.ru/api/latest', secret: false },
      { key: 'KAITEN_API_TOKEN', label: 'Токен API Kaiten / WEEEK', placeholder: 'kaiten-token...', secret: true },
    ],
  },
  {
    id: 'vk-teams-max',
    title: 'VK Teams, Мессенджер Max и Telegram Корп-Бот',
    category: 'Коммуникации РФ',
    badge: 'Встроенный MCP · Мессенджеры РФ',
    description: 'Корпоративные боты и уведомления в VK Teams (myteam.mail.ru), национальном мессенджере Max и Telegram (telegram-bot MCP).',
    allowed_hosts: ['api.internal.myteam.mail.ru', 'botapi.max.ru', 'api.telegram.org'],
    supports_vpn: true,
    mcp_server: 'telegram-bot',
    connected: false,
    via_vpn: false,
    fields: [
      { key: 'VK_TEAMS_BOT_TOKEN', label: 'Токен бота VK Teams / Max', placeholder: '001.123456789...', secret: true },
      { key: 'VK_TEAMS_API_URL', label: 'URL сервера VK Teams (облако или On-Premise)', placeholder: 'https://api.internal.myteam.mail.ru/bot/v1', secret: false },
    ],
  },
];

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

  // Состояние вкладки «Коннекторы РФ и MCP»
  const [rfConnectors, setRfConnectors] = useState(DEFAULT_RF_CONNECTORS);
  const [editingConnector, setEditingConnector] = useState(null);
  const [connectorValues, setConnectorValues] = useState({});
  const [connectorVpn, setConnectorVpn] = useState(false);
  const [connectorHostsInput, setConnectorHostsInput] = useState('');
  const [connectorBusy, setConnectorBusy] = useState(false);
  const [connectorNotice, setConnectorNotice] = useState('');
  const [connectorError, setConnectorError] = useState('');

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

  const loadRfConnectors = useCallback(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet(ctx, '/skills/rf-connectors')
      .then((res) => {
        if (res && Array.isArray(res.connectors) && res.connectors.length > 0) {
          setRfConnectors(res.connectors);
        }
        return res;
      })
      .catch(() => null);
  }, [ctx]);

  const handleSaveConnector = useCallback(
    (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!editingConnector) return Promise.resolve(null);
      setConnectorError('');
      setConnectorNotice('');
      const customHosts = connectorHostsInput
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      if (customHosts.some((h) => h.includes('*'))) {
        setConnectorError('Политика Anti-SSRF запрещает использование символов подстановки (*). Укажите точный домен или IP-подсеть.');
        return Promise.resolve(null);
      }
      setConnectorBusy(true);
      return restPost(ctx, '/skills/rf-connectors/configure', {
        id: editingConnector.id,
        values: connectorValues,
        via_vpn: connectorVpn,
        custom_hosts: customHosts,
        enabled: true,
      })
        .then((res) => {
          if (res && Array.isArray(res.connectors)) {
            setRfConnectors(res.connectors);
          } else {
            loadRfConnectors();
          }
          setConnectorNotice(`Коннектор «${editingConnector.title}» сохранён и активирован.`);
          setEditingConnector(null);
          return res;
        })
        .catch((err) => {
          setConnectorError(err?.message || 'Не удалось сохранить настройки коннектора.');
          return null;
        })
        .finally(() => {
          setConnectorBusy(false);
        });
    },
    [ctx, editingConnector, connectorValues, connectorVpn, connectorHostsInput, loadRfConnectors],
  );

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
    loadRfConnectors();
  }, [loadSkills, loadBundles, loadCurator, loadRfConnectors]);

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
      if (!skill?.name) {
        setSelectedSkill(null);
        return Promise.resolve(null);
      }
      setSelectedSkill((prev) => (prev && prev.name === skill.name && prev._closedByToggle ? null : { ...skill, _loadingDetail: true }));
      if (!ctx?.rest) {
        return Promise.resolve(skill);
      }
      return restGet(ctx, `/skills/${encodeURIComponent(skill.name)}`)
        .then((res) => {
          const full = res?.skill ? { ...skill, ...res.skill, _loadingDetail: false } : { ...skill, _loadingDetail: false };
          setSelectedSkill(full);
          return full;
        })
        .catch(() => {
          const fallback = { ...skill, _loadingDetail: false };
          setSelectedSkill(fallback);
          return fallback;
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
          className: 'nomad-skills-tabs nomad-seg-group',
          style: {
            marginTop: '16px',
          },
        },
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            className: 'nomad-seg-btn',
            'data-active': activeTab === 'catalog' ? 'true' : 'false',
            'aria-selected': activeTab === 'catalog',
            title: 'Каталог навыков профиля с русскими описаниями',
            'data-tooltip': 'Каталог навыков профиля с русскими описаниями',
            onClick: () => setActiveTab('catalog'),
          },
          `Каталог (${state.total})`,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            className: 'nomad-seg-btn',
            'data-active': activeTab === 'bundles' ? 'true' : 'false',
            'aria-selected': activeTab === 'bundles',
            title: 'Управление наборами навыков (skill-bundles)',
            'data-tooltip': 'Управление наборами навыков (skill-bundles)',
            onClick: () => setActiveTab('bundles'),
          },
          `Наборы (${bundles.length})`,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            className: 'nomad-seg-btn',
            'data-active': activeTab === 'curator' ? 'true' : 'false',
            'aria-selected': activeTab === 'curator',
            title: 'Архив и куратор отключённых навыков',
            'data-tooltip': 'Архив и куратор отключённых навыков',
            onClick: () => setActiveTab('curator'),
          },
          `Архив (${archivedSkills.length})`,
        ),
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            className: 'nomad-seg-btn',
            'data-active': activeTab === 'rf-connectors' ? 'true' : 'false',
            'aria-selected': activeTab === 'rf-connectors',
            title: 'Коннекторы к российским корпоративным системам (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)',
            'data-tooltip': 'Коннекторы к российским системам (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)',
            onClick: () => setActiveTab('rf-connectors'),
          },
          `Коннекторы РФ и MCP (${rfConnectors.length})`,
        ),
      ),
    ),
    (activeTab === 'rf-connectors' || activeTab === 'catalog')
      ? h(
          'section',
          {
            className: 'nomad-rf-connectors-section nomad-glass-surface',
            'data-testid': 'nomad-rf-connectors-section',
            style: {
              marginBottom: '22px',
              padding: '20px 22px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                flexWrap: 'wrap',
                gap: '10px',
              },
            },
            h(
              'div',
              null,
              h(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                h(
                  'h2',
                  { style: { margin: 0, fontSize: '16px', fontWeight: 600, letterSpacing: '-0.018em' } },
                  'Коннекторы к системам РФ и MCP-серверы (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)',
                ),
                h(
                  'span',
                  {
                    className: 'nomad-pill-badge',
                    style: {
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: 'rgba(16, 185, 129, 0.14)',
                      color: '#059669',
                    },
                  },
                  'Anti-SSRF · Без wildcard (*) · Корп. VPN',
                ),
              ),
              h(
                'p',
                { style: { margin: '4px 0 0 0', fontSize: '12.5px', opacity: 0.78, maxWidth: '860px' } },
                'Прямое подключение агента к корпоративному контуру РФ (по архитектуре защищённых навыков: строгий белый список доменов, поддержка VPN-туннеля до локальной 1С и шифрование токенов).',
              ),
            ),
            activeTab === 'catalog'
              ? h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setActiveTab('rf-connectors'),
                    style: {
                      padding: '6px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(0, 122, 255, 0.28)',
                      background: '#F4F4F5',
                      color: 'inherit',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    },
                  },
                  `Показать все ${rfConnectors.length} коннекторов РФ →`,
                )
              : null,
          ),
          connectorNotice
            ? h(
                'div',
                {
                  style: {
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.14)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10b981',
                    fontSize: '13px',
                  },
                },
                connectorNotice,
              )
            : null,
          editingConnector
            ? h(
                'form',
                {
                  onSubmit: handleSaveConnector,
                  style: {
                    padding: '16px 18px',
                    borderRadius: '10px',
                    border: '1px solid rgba(37, 99, 235, 0.4)',
                    background: 'var(--background, rgba(37, 99, 235, 0.05))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  },
                },
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                  h(
                    'strong',
                    { style: { fontSize: '14px' } },
                    `Настройка коннектора: ${editingConnector.title}`,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => setEditingConnector(null),
                      style: {
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(128,128,128,0.3)',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: '12px',
                        cursor: 'pointer',
                      },
                    },
                    'Закрыть',
                  ),
                ),
                h(
                  'div',
                  {
                    style: {
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      gap: '10px',
                    },
                  },
                  ...(editingConnector.fields || []).map((f) =>
                    h(
                      'label',
                      {
                        key: f.key,
                        style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' },
                      },
                      h('span', { style: { fontWeight: 600 } }, `${f.label} (${f.key})`),
                      h('input', {
                        type: f.secret ? 'password' : 'text',
                        value: connectorValues[f.key] ?? '',
                        onChange: (e) =>
                          setConnectorValues((prev) => ({
                            ...prev,
                            [f.key]: e?.target?.value ?? '',
                          })),
                        placeholder: f.preview ? `Сохранено: ${f.preview}` : f.placeholder,
                        style: {
                          padding: '8px 10px',
                          borderRadius: '7px',
                          border: '1px solid rgba(128,128,128,0.32)',
                          background: 'transparent',
                          color: 'inherit',
                          fontSize: '12.5px',
                          fontFamily: f.secret ? 'monospace' : 'inherit',
                        },
                      }),
                    ),
                  ),
                  h(
                    'label',
                    { style: { display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' } },
                    h('span', { style: { fontWeight: 600 } }, 'Дополнительные разрешённые хосты (Anti-SSRF, без *)'),
                    h('input', {
                      type: 'text',
                      value: connectorHostsInput,
                      onChange: (e) => setConnectorHostsInput(e?.target?.value ?? ''),
                      placeholder: (editingConnector.allowed_hosts || []).join(', '),
                      style: {
                        padding: '8px 10px',
                        borderRadius: '7px',
                        border: '1px solid rgba(128,128,128,0.32)',
                        background: 'transparent',
                        color: 'inherit',
                        fontSize: '12.5px',
                        fontFamily: 'monospace',
                      },
                    }),
                  ),
                ),
                h(
                  'div',
                  {
                    style: {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                    },
                  },
                  h(
                    'label',
                    { style: { display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer' } },
                    h('input', {
                      type: 'checkbox',
                      checked: connectorVpn,
                      onChange: (e) => setConnectorVpn(Boolean(e?.target?.checked)),
                    }),
                    '🔒 Маршрутизировать запросы через корпоративный VPN-туннель (via_vpn: WireGuard / Континент / VipNet)',
                  ),
                  h(
                    'button',
                    {
                      type: 'submit',
                      disabled: connectorBusy,
                      style: {
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#18181B',
                        color: '#ffffff',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      },
                    },
                    connectorBusy ? 'Сохранение...' : 'Сохранить и подключить коннектор',
                  ),
                ),
                connectorError
                  ? h('div', { style: { fontSize: '12.5px', color: '#ef4444' } }, connectorError)
                  : null,
              )
            : null,
          h(
            'div',
            {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: '10px',
              },
            },
            ...(activeTab === 'rf-connectors' ? rfConnectors : rfConnectors.slice(0, 6)).map((conn) =>
              h(
                'div',
                {
                  key: conn.id,
                  'data-connector-id': conn.id,
                  style: {
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid var(--border, rgba(128,128,128,0.24))',
                    background: 'var(--background, rgba(255,255,255,0.03))',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  },
                },
                h(
                  'div',
                  null,
                  h(
                    'div',
                    { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' } },
                    h('strong', { style: { fontSize: '13.5px' } }, conn.title),
                    h(
                      'span',
                      {
                        style: {
                          fontSize: '10.5px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '999px',
                          whiteSpace: 'nowrap',
                          background: conn.connected ? 'rgba(16, 185, 129, 0.16)' : 'rgba(76, 110, 245, 0.14)',
                          color: conn.connected ? '#10b981' : '#4c6ef5',
                        },
                      },
                      conn.connected ? 'Подключён' : conn.badge,
                    ),
                  ),
                  h(
                    'p',
                    { style: { margin: '5px 0 0 0', fontSize: '12px', opacity: 0.76, lineHeight: 1.4 } },
                    conn.description,
                  ),
                  h(
                    'div',
                    { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' } },
                    ...(conn.allowed_hosts || []).map((host) =>
                      h(
                        'code',
                        {
                          key: host,
                          style: {
                            fontSize: '10.5px',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            background: 'rgba(128,128,128,0.12)',
                          },
                        },
                        host,
                      ),
                    ),
                    conn.via_vpn
                      ? h(
                          'span',
                          {
                            style: {
                              fontSize: '10.5px',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: 'rgba(16, 185, 129, 0.14)',
                              color: '#10b981',
                            },
                          },
                          'VPN активен',
                        )
                      : null,
                  ),
                ),
                h(
                  'div',
                  { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '4px' } },
                  h(
                    'span',
                    { style: { fontSize: '11px', opacity: 0.65 } },
                    conn.category,
                  ),
                  h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => {
                        setEditingConnector(conn);
                        setConnectorValues({});
                        setConnectorVpn(Boolean(conn.via_vpn));
                        setConnectorHostsInput((conn.custom_hosts || []).join(', '));
                        setConnectorError('');
                      },
                      style: {
                        padding: '5px 11px',
                        borderRadius: '7px',
                        border: '1px solid rgba(76, 110, 245, 0.35)',
                        background: 'rgba(76, 110, 245, 0.1)',
                        color: 'inherit',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      },
                    },
                    conn.connected ? 'Настроить контур' : 'Подключить за 1 клик',
                  ),
                ),
              ),
            ),
          ),
        )
      : null,
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
              ? h('div', { style: { fontSize: '13px', color: '#18181B' } }, bundleNotice)
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
                    background: '#18181B',
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
                              background: '#18181B',
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
        const isSelected = Boolean(selectedSkill && selectedSkill.name === skill.name);
        const detailObj = isSelected ? selectedSkill : skill;
        return h(
          'article',
          {
            key: skill.name,
            className: `nomad-skill-card nomad-glass-card ${display.hasRuTranslation ? 'is-ru' : 'is-en-fallback'}`,
            'data-skill-name': skill.name,
            'data-has-ru': display.hasRuTranslation ? 'true' : 'false',
            style: {
              padding: '16px 18px',
              borderRadius: '14px',
              border: isSelected
                ? '1.5px solid var(--nomad-accent, #18181B)'
                : '1px solid rgba(128,128,128,0.22)',
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
                  { style: { fontWeight: 600, fontSize: '15px', letterSpacing: '-0.012em' } },
                  display.title,
                ),
                h(
                  'div',
                  { style: { fontSize: '11px', opacity: 0.65, marginTop: '2px' } },
                  `${skill.name} · ${skill.category_ru || skill.category || 'Общие навыки'}`,
                ),
              ),
              h(
                'span',
                {
                  className: 'nomad-skill-lang-badge',
                  style: {
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: '999px',
                    whiteSpace: 'nowrap',
                    background: display.hasRuTranslation
                      ? 'rgba(16, 185, 129, 0.14)'
                      : 'rgba(210, 153, 34, 0.18)',
                    color: display.hasRuTranslation ? '#059669' : '#b45309',
                  },
                },
                display.badge,
              ),
            ),
            h(
              'p',
              {
                className: 'nomad-skill-description',
                style: { margin: '6px 0 0 0', fontSize: '13px', lineHeight: 1.48, opacity: 0.86 },
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
            isSelected
              ? h(
                  'div',
                  {
                    'data-testid': `nomad-skill-inline-detail-${skill.name}`,
                    style: {
                      marginTop: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      background: 'rgba(0, 122, 255, 0.06)',
                      border: '1px solid rgba(0, 122, 255, 0.18)',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    },
                  },
                  detailObj.path
                    ? h('div', { style: { fontFamily: 'monospace', fontSize: '11px', opacity: 0.75 } }, `Файл: skills/${detailObj.path}`)
                    : null,
                  detailObj.description_en
                    ? h('div', { style: { opacity: 0.82, lineHeight: 1.4 } }, `Описание (EN): ${detailObj.description_en}`)
                    : null,
                  Array.isArray(detailObj.tags) && detailObj.tags.length > 0
                    ? h('div', { style: { opacity: 0.78 } }, `Теги: ${detailObj.tags.join(', ')}`)
                    : null,
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
                'data-testid': `nomad-skill-more-${skill.name}`,
                onClick: () => {
                  if (isSelected) {
                    setSelectedSkill(null);
                  } else {
                    handleInspectSkill(skill);
                  }
                },
                style: {
                  padding: '5px 11px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  border: isSelected ? '1px solid var(--nomad-accent, #18181B)' : '1px solid rgba(128,128,128,0.28)',
                  background: isSelected ? '#F4F4F5' : 'transparent',
                  color: isSelected ? 'var(--nomad-accent, #18181B)' : 'inherit',
                  cursor: 'pointer',
                },
              },
              isSelected ? 'Свернуть' : 'Подробнее',
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
                    padding: '5px 10px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(128,128,128,0.28)',
                    background: skill.pinned ? '#F4F4F5' : 'transparent',
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
                    padding: '5px 10px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: '1px solid rgba(128,128,128,0.26)',
                    background: skill.enabled ? 'rgba(16, 185, 129, 0.14)' : 'transparent',
                    color: skill.enabled ? '#059669' : 'inherit',
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
          'div',
          {
            role: 'dialog',
            'aria-modal': 'true',
            'data-testid': 'nomad-skill-detail-backdrop',
            onClick: (e) => {
              if (e?.target === e?.currentTarget) setSelectedSkill(null);
            },
            style: {
              position: 'fixed',
              inset: 0,
              zIndex: 9995,
              background: 'rgba(15, 23, 42, 0.32)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            },
          },
          h(
            'aside',
            {
              className: 'nomad-skill-detail-modal nomad-glass-surface',
              'data-testid': 'nomad-skill-detail-modal',
              style: {
                width: 'min(680px, 94vw)',
                maxHeight: '82vh',
                overflowY: 'auto',
                padding: '22px 24px',
                borderRadius: '20px',
                background: 'var(--card, rgba(255, 255, 255, 0.94))',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                boxShadow: '0 24px 64px rgba(15, 23, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              },
            },
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' } },
              h(
                'div',
                null,
                h(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
                  h(
                    'strong',
                    { style: { fontSize: '18px', fontWeight: 650, letterSpacing: '-0.018em' } },
                    selectedSkill.title || selectedSkill.name,
                  ),
                  h(
                    'span',
                    {
                      style: {
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        background: '#F4F4F5',
                        color: 'var(--nomad-accent, #18181B)',
                      },
                    },
                    selectedSkill.category_ru || selectedSkill.category || 'Навык Nomad',
                  ),
                ),
                h(
                  'div',
                  { style: { fontSize: '12px', opacity: 0.65, marginTop: '3px', fontFamily: 'monospace' } },
                  `ID: ${selectedSkill.name}${selectedSkill.path ? ' · skills/' + selectedSkill.path : ''}`,
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  'data-testid': 'nomad-skill-detail-close',
                  onClick: () => setSelectedSkill(null),
                  style: {
                    cursor: 'pointer',
                    background: 'rgba(15, 23, 42, 0.06)',
                    border: '1px solid rgba(15, 23, 42, 0.10)',
                    borderRadius: '999px',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'inherit',
                  },
                },
                'Закрыть',
              ),
            ),
            h(
              'div',
              {
                style: {
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'rgba(0, 122, 255, 0.06)',
                  border: '1px solid rgba(0, 122, 255, 0.14)',
                  fontSize: '13.5px',
                  lineHeight: 1.52,
                },
              },
              selectedSkill.description_ru || selectedSkill.user_description || selectedSkill.description || 'Описание навыка',
            ),
            selectedSkill.description_en && selectedSkill.has_ru_translation
              ? h(
                  'div',
                  { style: { fontSize: '12px', opacity: 0.72, lineHeight: 1.45 } },
                  `Оригинальное описание (EN): ${selectedSkill.description_en}`,
                )
              : null,
            Array.isArray(selectedSkill.tags) && selectedSkill.tags.length > 0
              ? h(
                  'div',
                  { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
                  ...selectedSkill.tags.map((tag) =>
                    h(
                      'span',
                      {
                        key: tag,
                        style: {
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(15, 23, 42, 0.06)',
                          fontWeight: 500,
                        },
                      },
                      `#${tag}`,
                    ),
                  ),
                )
              : null,
            selectedSkill._loadingDetail
              ? h('div', { style: { fontSize: '12px', opacity: 0.65 } }, 'Загружаем инструкцию SKILL.md…')
              : selectedSkill.body
                ? h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                    h('strong', { style: { fontSize: '12.5px', opacity: 0.85 } }, 'Инструкция и спецификация навыка (SKILL.md):'),
                    h(
                      'pre',
                      {
                        'data-testid': 'nomad-skill-detail-body',
                        style: {
                          margin: 0,
                          padding: '12px 14px',
                          borderRadius: '12px',
                          background: 'rgba(15, 23, 42, 0.04)',
                          border: '1px solid rgba(15, 23, 42, 0.09)',
                          fontSize: '12px',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          maxHeight: '300px',
                          overflowY: 'auto',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                        },
                      },
                      selectedSkill.body,
                    ),
                  )
                : null,
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  paddingTop: '6px',
                  borderTop: '1px solid rgba(15, 23, 42, 0.08)',
                  flexWrap: 'wrap',
                },
              },
              h(
                'div',
                { style: { display: 'flex', gap: '8px' } },
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      handleToggleSkill(selectedSkill);
                      setSelectedSkill((prev) => (prev ? { ...prev, enabled: !prev.enabled } : null));
                    },
                    style: {
                      padding: '7px 14px',
                      borderRadius: '9px',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      background: selectedSkill.enabled ? 'rgba(16, 185, 129, 0.14)' : 'transparent',
                      color: selectedSkill.enabled ? '#059669' : 'inherit',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    },
                  },
                  selectedSkill.enabled ? 'Навык включён (Выключить)' : 'Включить навык',
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      handlePinSkill(selectedSkill.name, !selectedSkill.pinned);
                      setSelectedSkill((prev) => (prev ? { ...prev, pinned: !prev.pinned } : null));
                    },
                    style: {
                      padding: '7px 14px',
                      borderRadius: '9px',
                      border: '1px solid rgba(0, 122, 255, 0.28)',
                      background: selectedSkill.pinned ? '#F4F4F5' : 'transparent',
                      color: 'inherit',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    },
                  },
                  selectedSkill.pinned ? 'Закреплён в профиле' : 'Закрепить в профиле',
                ),
              ),
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => setSelectedSkill(null),
                  style: {
                    padding: '7px 16px',
                    borderRadius: '9px',
                    border: 'none',
                    background: 'var(--nomad-accent, #18181B)',
                    color: '#ffffff',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  },
                },
                'Готово',
              ),
            ),
          ),
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
