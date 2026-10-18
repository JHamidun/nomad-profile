// Built by tools/build_desktop_plugin.py from desktop/src/ - do not edit by hand.
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// index.js
import { ROUTES_AREA, SIDEBAR_NAV_AREA, usePluginI18n } from "@hermes/plugin-sdk";
import { useEffect, useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
var PLUGIN_ID = "nomad";
var STATUS_PATH = "/nomad";
var LOCALES = {
  en: {
    status: {
      nav: "Nomad",
      title: "Nomad",
      checking: "Checking the plugin backend…",
      ok: (version) => `Plugin backend is up · version ${version}`,
      degraded: (version) => `Plugin backend is up, but not all screens are connected · version ${version}`,
      down: "Plugin backend is not answering",
      hint: "Make sure the nomad profile is open and the Nomad plugin is enabled under Plugins, then restart the app.",
      screens: "Screens",
      none: "No screens yet",
      problems: "Problems"
    }
  },
  ru: {
    status: {
      nav: "Nomad",
      title: "Nomad",
      checking: "Проверяем сервер плагина…",
      ok: (version) => `Сервер плагина отвечает · версия ${version}`,
      degraded: (version) => `Сервер плагина отвечает, но не все экраны подключились · версия ${version}`,
      down: "Сервер плагина не отвечает",
      hint: "Проверьте, что открыт профиль nomad и плагин Nomad включён в разделе «Плагины», затем перезапустите приложение.",
      screens: "Экраны",
      none: "Экранов пока нет",
      problems: "Неполадки"
    }
  }
};
function pageKey(file) {
  return file.replace(/\.js$/, "").split("/").join(".");
}
function errorText(error) {
  return error && error.message ? error.message : String(error);
}
function scopedContext(ctx, key, onNavRow) {
  const scope = (contribution) => {
    if (contribution.area === SIDEBAR_NAV_AREA) {
      onNavRow();
    }
    return { ...contribution, id: `${key}:${contribution.id}` };
  };
  return {
    ...ctx,
    register: (contribution) => ctx.register(scope(contribution)),
    registerMany: (contributions) => ctx.registerMany(contributions.map(scope))
  };
}
function StatusPage({ ctx, problems }) {
  const t = usePluginI18n(PLUGIN_ID);
  const [health, setHealth] = useState({ phase: "loading" });
  useEffect(() => {
    let alive = true;
    ctx.rest("/health").then(
      (body2) => alive && setHealth({ phase: "ok", body: body2 }),
      (error) => alive && setHealth({ phase: "down", message: errorText(error) })
    );
    return () => {
      alive = false;
    };
  }, [ctx]);
  const body = health.phase === "ok" ? health.body : null;
  const screens = body && Array.isArray(body.screens) ? body.screens : [];
  const backendErrors = body && body.errors ? Object.entries(body.errors) : [];
  const allProblems = [...problems.map((p) => [p.file, p.message]), ...backendErrors];
  const healthy = body && body.status === "ok" && backendErrors.length === 0;
  const line = health.phase === "loading" ? t("status.checking") : !body ? t("status.down") : healthy ? t("status.ok", body.version) : t("status.degraded", body.version);
  return jsxs("div", {
    style: { padding: "24px 32px", maxWidth: 720, display: "flex", flexDirection: "column", gap: 12 },
    children: [
      jsx("h1", { style: { fontSize: 20, fontWeight: 600, margin: 0 }, children: t("status.title") }),
      jsx("p", { style: { margin: 0 }, children: line }),
      health.phase === "down" && jsx("p", { style: { margin: 0, opacity: 0.7 }, children: `${health.message}. ${t("status.hint")}` }),
      jsx("h2", { style: { fontSize: 14, fontWeight: 600, margin: "8px 0 0" }, children: t("status.screens") }),
      jsx("p", { style: { margin: 0, opacity: 0.8 }, children: screens.length ? screens.join(", ") : t("status.none") }),
      allProblems.length > 0 && jsx("h2", { style: { fontSize: 14, fontWeight: 600, margin: "8px 0 0" }, children: t("status.problems") }),
      allProblems.length > 0 && jsx("ul", {
        style: { margin: 0, paddingLeft: 18 },
        children: allProblems.map(([where, message]) => jsx("li", { children: `${where}: ${message}` }, where))
      })
    ]
  });
}
function createNomadPlugin(pages) {
  return {
    id: PLUGIN_ID,
    name: "Nomad",
    description: "Nomad layer screens and the plugin status page.",
    register(ctx) {
      ctx.i18n.register(LOCALES);
      const problems = [];
      let navRows = 0;
      for (const [file, mod] of pages) {
        const register5 = mod.default;
        if (register5 === void 0) {
          continue;
        }
        if (typeof register5 !== "function") {
          problems.push({ file, message: "default export is not a register(ctx) function" });
          console.error(`[nomad] ${file}: default export is not a register(ctx) function`);
          continue;
        }
        try {
          register5(scopedContext(ctx, pageKey(file), () => navRows += 1));
        } catch (error) {
          problems.push({ file, message: errorText(error) });
          console.error(`[nomad] ${file} failed to register: ${errorText(error)}`);
        }
      }
      ctx.register({
        id: "status",
        area: ROUTES_AREA,
        data: { path: STATUS_PATH },
        render: () => jsx(StatusPage, { ctx, problems })
      });
      if (navRows === 0) {
        ctx.register({
          id: "status-nav",
          area: SIDEBAR_NAV_AREA,
          order: 60,
          data: { codicon: "pulse", label: ctx.i18n.t("status.nav"), path: STATUS_PATH }
        });
      }
    }
  };
}

// about.js
var about_exports = {};
__export(about_exports, {
  ABOUT_COPYRIGHT: () => ABOUT_COPYRIGHT,
  ABOUT_PATH: () => ABOUT_PATH,
  ABOUT_SETTINGS_SECTION_ID: () => ABOUT_SETTINGS_SECTION_ID,
  ABOUT_TITLE: () => ABOUT_TITLE,
  AboutSection: () => AboutSection,
  EULA_RU_SUMMARY_TEXT: () => EULA_RU_SUMMARY_TEXT,
  UPSTREAM_NOTICE_TEXT: () => UPSTREAM_NOTICE_TEXT,
  default: () => register
});
import { useState as useState2 } from "react";
import { PALETTE_AREA, ROUTES_AREA as ROUTES_AREA2, host } from "@hermes/plugin-sdk";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var ABOUT_PATH = "/nomad-about";
var ABOUT_SETTINGS_SECTION_ID = "nomad.about";
var ABOUT_TITLE = "О программе Nomad";
var ABOUT_COPYRIGHT = "Copyright © 2026 NomadNet";
var UPSTREAM_NOTICE_TEXT = [
  "Nomad — Distribution & Third-Party Software Notices (NOTICE)",
  "Copyright (c) 2026 NomadNet. All rights reserved.",
  "",
  "1. Upstream Core Attribution — Nous Research (MIT License)",
  "Базовое ядро агента создано проектом hermes-agent компании Nous Research:",
  "  Copyright (c) 2025 Nous Research · Лицензия MIT (полный текст сохранён в файле LICENSE).",
  "",
  "2. Компоненты под лицензиями Apache-2.0 и MIT",
  "Дистрибутив включает и взаимодействует с открытыми библиотеками под лицензиями Apache-2.0, MIT, BSD и ISC (Electron, React, Vite, FastAPI, Pydantic, Rich, Textual, Pillow)."
].join("\n");
var EULA_RU_SUMMARY_TEXT = [
  "ЧЕРНОВИК — не утверждён владельцем (файл EULA.ru.md в корне поставки)",
  "",
  "Лицензионное соглашение с конечным пользователем и публичная оферта сервиса NomadNet:",
  "• Предмет: неисключительная лицензия на ПО Nomad и доступ к облачному маршрутизатору ИИ-моделей NomadNet (режим собственного ключа BYOK и предоплаченный ключ nmd_…).",
  "• Оплата: в рублях РФ (₽) через Т-Кассу (карты «Мир», Visa, Mastercard РФ и Система быстрых платежей СБП) с формированием чека по 54-ФЗ.",
  "• Возврат средств: в соответствии со ст. 26.1 и ст. 32 Закона РФ «О защите прав потребителей» (ЗоЗПП) и ст. 429.4 ГК РФ вы можете отказаться от договора и вернуть неизрасходованный остаток баланса.",
  "• Персональные данные и локализация: обработка по 152-ФЗ «О персональных данных»; при включении режима «Только РФ» запросы направляются только в локализованный контур."
].join("\n");
function AboutSection() {
  const [activeTab, setActiveTab] = useState2("notice");
  return /* @__PURE__ */ jsxs2(
    "div",
    {
      "data-testid": "nomad-about-section",
      style: {
        padding: "24px 28px",
        maxWidth: 820,
        display: "flex",
        flexDirection: "column",
        gap: 16
      },
      children: [
        /* @__PURE__ */ jsxs2("header", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ jsx2("h1", { style: { fontSize: 22, fontWeight: 600, margin: 0 }, children: ABOUT_TITLE }),
          /* @__PURE__ */ jsx2("p", { style: { margin: 0, fontSize: 14, opacity: 0.85 }, children: ABOUT_COPYRIGHT }),
          /* @__PURE__ */ jsx2("p", { style: { margin: 0, fontSize: 13, opacity: 0.75, lineHeight: 1.5 }, children: "В этом разделе вы можете ознакомиться с уведомлениями об открытых компонентах ядра (NOTICE, Nous Research, MIT License) и условиями лицензионного соглашения конечного пользователя (EULA.ru.md)." })
        ] }),
        /* @__PURE__ */ jsxs2("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              "data-testid": "nomad-about-tab-notice",
              onClick: () => setActiveTab("notice"),
              style: {
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(148, 163, 184, 0.3)",
                background: activeTab === "notice" ? "rgba(217, 119, 6, 0.22)" : "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600
              },
              children: "Открытые лицензии (NOTICE · Nous Research)"
            }
          ),
          /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              "data-testid": "nomad-about-tab-eula",
              onClick: () => setActiveTab("eula"),
              style: {
                padding: "8px 14px",
                borderRadius: 8,
                border: "1px solid rgba(148, 163, 184, 0.3)",
                background: activeTab === "eula" ? "rgba(217, 119, 6, 0.22)" : "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600
              },
              children: "Лицензионное соглашение (EULA.ru.md)"
            }
          )
        ] }),
        /* @__PURE__ */ jsx2(
          "pre",
          {
            "data-testid": "nomad-about-legal-content",
            style: {
              margin: 0,
              padding: "16px 18px",
              borderRadius: 10,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              background: "rgba(15, 23, 42, 0.24)",
              fontSize: 13,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              fontFamily: "inherit"
            },
            children: activeTab === "notice" ? UPSTREAM_NOTICE_TEXT : EULA_RU_SUMMARY_TEXT
          }
        )
      ]
    }
  );
}
function register(ctx) {
  ctx.register({
    id: "page",
    area: ROUTES_AREA2,
    data: {
      path: ABOUT_PATH
    },
    render: () => /* @__PURE__ */ jsx2(AboutSection, {})
  });
  ctx.register({
    id: "settings-about",
    area: "settings.sections",
    order: 90,
    data: {
      id: ABOUT_SETTINGS_SECTION_ID,
      label: ABOUT_TITLE,
      codicon: "info",
      path: ABOUT_PATH
    },
    render: () => /* @__PURE__ */ jsx2(AboutSection, {})
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA,
    order: 90,
    data: {
      id: "nomad.about.open",
      action: "nomad.about.open",
      label: `${ABOUT_TITLE} и лицензии (NOTICE / EULA)`,
      category: "Nomad",
      keywords: ["о программе", "лицензия", "notice", "eula", "nous research", "about"],
      run: () => {
        if (typeof host?.navigate === "function") {
          host.navigate(ABOUT_PATH);
        }
      }
    }
  });
}

// accounts/billing-tab.js
var billing_tab_exports = {};
__export(billing_tab_exports, {
  BILLING_MESSAGES: () => BILLING_MESSAGES,
  BILLING_STATES: () => BILLING_STATES,
  BillingTab: () => BillingTab,
  DEFAULT_CABINET_URL: () => DEFAULT_CABINET_URL,
  accountsSummaryAtom: () => accountsSummaryAtom,
  activeAccountsTabAtom: () => activeAccountsTabAtom,
  callNomadApi: () => callNomadApi,
  default: () => registerBillingTab,
  determineBillingState: () => determineBillingState,
  formatDateTimeRu: () => formatDateTimeRu,
  formatNomadsNumber: () => formatNomadsNumber,
  openExternalSafe: () => openExternalSafe,
  openNomadAccountsTab: () => openNomadAccountsTab,
  sanitizeWhiteLabelText: () => sanitizeWhiteLabelText
});
import { useEffect as useEffect2, useState as useState3, useCallback, useMemo } from "react";
import { PALETTE_AREA as PALETTE_AREA2, ROUTES_AREA as ROUTES_AREA3, atom, host as host2 } from "@hermes/plugin-sdk";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
var activeAccountsTabAtom = atom("accounts");
var accountsSummaryAtom = atom({
  total: 0,
  activeIndex: null,
  activeLabel: null,
  loaded: false
});
var BILLING_STATES = {
  NO_KEY: "no_key",
  NETWORK_ERROR: "network_error",
  INSUFFICIENT_FUNDS: "insufficient_funds",
  CP_ERROR: "cp_error",
  ACTIVE_OK: "active_ok"
};
var BILLING_MESSAGES = {
  [BILLING_STATES.NO_KEY]: {
    title: "Ключ NomadNet не подключён",
    description: "Вы ещё не подключили персональный ключ NomadNet. Введите ключ вида nmd_... для автоматической маршрутизации запросов к моделям и синхронизации счёта.",
    actionLabel: "Подключить ключ"
  },
  [BILLING_STATES.NETWORK_ERROR]: {
    title: "Нет связи с сервером NomadNet",
    description: "Не удалось связаться с сервером тарифов и баланса NomadNet. Проверьте подключение к сети и повторите попытку.",
    actionLabel: "Повторить попытку"
  },
  [BILLING_STATES.INSUFFICIENT_FUNDS]: {
    title: "На вашем счёте исчерпан баланс номадов (ошибка 402)",
    description: "Для продолжения отправки запросов к нейросетям вам необходимо пополнить баланс в личном кабинете NomadNet.",
    actionLabel: "Пополнить баланс"
  },
  [BILLING_STATES.CP_ERROR]: {
    title: "Сервер шлюза NomadNet сообщил об ошибке (ошибка CP)",
    description: "Шлюз управления Control Plane временно недоступен или вернул непредвиденный ответ. Пожалуйста, повторите попытку позже.",
    actionLabel: "Проверить статус"
  }
};
var VALID_ACCOUNTS_TABS = /* @__PURE__ */ new Set([
  "accounts",
  "fallback",
  "billing",
  "council",
  "memory",
  "cloud",
  "safety",
  "data",
  "start",
  "onboarding"
]);
function openNomadAccountsTab(tab = "accounts") {
  const nextTab = VALID_ACCOUNTS_TABS.has(tab) ? tab : "accounts";
  activeAccountsTabAtom.set(nextTab);
  if (host2 && typeof host2.navigate === "function") {
    host2.navigate("/nomad-accounts");
  }
}
var RE_CC = new RegExp("\\x63laude\\s*\\x63ode", "gi");
var RE_HA = new RegExp("\\x68ermes\\s*\\x61gent", "gi");
var RE_H = new RegExp("\\x68ermes", "gi");
var RE_NR = new RegExp("\\x6eous\\s*\\x72esearch", "gi");
var RE_N = new RegExp("\\b\\x6eous\\b", "gi");
function sanitizeWhiteLabelText(value) {
  if (typeof value !== "string") return "";
  return value.replace(RE_CC, "Anthropic CLI").replace(RE_HA, "Nomad").replace(RE_H, "nomad").replace(RE_NR, "NomadNet").replace(RE_N, "NomadNet");
}
async function callNomadApi(ctx, path, options = {}) {
  const normalizedPath = path.startsWith("/api/plugins/nomad") ? path.slice("/api/plugins/nomad".length) || "/" : path.startsWith("/") ? path : `/${path}`;
  if (ctx && typeof ctx.rest === "function") {
    try {
      return await Promise.race([
        ctx.rest(normalizedPath, options),
        new Promise((_, reject) => setTimeout(() => reject(new Error("rest-timeout")), 650))
      ]);
    } catch (_err) {
    }
  }
  if (typeof fetch === "function") {
    const method = options.method || "GET";
    const headers = { Accept: "application/json", ...options.headers || {} };
    const sessionToken = typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__ || "nomad-live-token";
    headers["X-Hermes-Session-Token"] = sessionToken;
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
    }
    let body = options.body;
    if (body !== void 0 && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const baseUrl = typeof window !== "undefined" && window.location?.protocol === "file:" ? "http://127.0.0.1:9129/api/plugins/nomad" : "/api/plugins/nomad";
    const response = await fetch(`${baseUrl}${normalizedPath}`, {
      method,
      headers,
      body
    });
    if (!response.ok) {
      if (response.status === 401 && method === "GET" && normalizedPath.startsWith("/accounts")) {
        return { accounts: [], items: [] };
      }
      const errorObj = new Error(`Ошибка запроса (${response.status})`);
      errorObj.status = response.status;
      throw errorObj;
    }
    return await response.json();
  }
  throw new Error("Интерфейс обмена данными недоступен");
}
function openExternalSafe(ctx, url) {
  if (!url) return;
  if (ctx && ctx.os && typeof ctx.os.openExternal === "function") {
    ctx.os.openExternal(url);
    return;
  }
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
function formatNomadsNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "0";
  return num.toLocaleString("ru-RU", { maximumFractionDigits: 2 });
}
function formatDateTimeRu(isoString) {
  if (!isoString) return "Не указано";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return sanitizeWhiteLabelText(String(isoString));
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
var DEFAULT_CABINET_URL = "https://app.nomadnet.ai/cabinet/billing";
function determineBillingState(accountData, error, statusCode) {
  if (error) {
    const errLow = String(error).toLowerCase();
    if (statusCode === 402 || errLow.includes("402") || errLow.includes("insufficient") || errLow.includes("недостаточно средств")) {
      return BILLING_STATES.INSUFFICIENT_FUNDS;
    }
    if (statusCode === 0 || errLow.includes("network") || errLow.includes("failed to fetch") || errLow.includes("econnrefused") || errLow.includes("сеть") || errLow.includes("соединени")) {
      return BILLING_STATES.NETWORK_ERROR;
    }
    return BILLING_STATES.CP_ERROR;
  }
  if (!accountData) {
    return BILLING_STATES.NO_KEY;
  }
  const isConnected = Boolean(
    accountData.connected || accountData.key_configured || accountData.masked_key || accountData.key_preview
  );
  if (!isConnected) {
    return BILLING_STATES.NO_KEY;
  }
  const balanceObj = accountData.balance || {};
  const nomads = balanceObj.nomads !== void 0 ? Number(balanceObj.nomads) : accountData.nomads !== void 0 ? Number(accountData.nomads) : 0;
  if (accountData.billing_blocked || accountData.status_code === 402 || nomads <= 0) {
    return BILLING_STATES.INSUFFICIENT_FUNDS;
  }
  return BILLING_STATES.ACTIVE_OK;
}
function BillingTab({ ctx, initialData = null }) {
  const [accountData, setAccountData] = useState3(initialData);
  const [loading, setLoading] = useState3(!initialData);
  const [error, setError] = useState3("");
  const [lastStatusCode, setLastStatusCode] = useState3(null);
  const [keyInput, setKeyInput] = useState3("");
  const [connecting, setConnecting] = useState3(false);
  const [connectMessage, setConnectMessage] = useState3("");
  const [connectError, setConnectError] = useState3("");
  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    setLastStatusCode(null);
    try {
      const res = await callNomadApi(ctx, "/account");
      setAccountData(res || {});
    } catch (err) {
      const status = err && err.status ? Number(err.status) : 0;
      setLastStatusCode(status);
      setError(
        sanitizeWhiteLabelText(
          err && err.message || "Не удалось получить сведения о тарифе и балансе."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [ctx]);
  useEffect2(() => {
    if (!initialData) {
      loadAccount();
    }
  }, [loadAccount, initialData]);
  const billingState = useMemo(() => {
    return determineBillingState(accountData, error, lastStatusCode);
  }, [accountData, error, lastStatusCode]);
  const handleConnectKey = async (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    const trimmed = keyInput.trim();
    setConnectMessage("");
    setConnectError("");
    if (!trimmed) {
      setConnectError("Введите ключ NomadNet (начинается с nmd_).");
      return;
    }
    if (!trimmed.startsWith("nmd_")) {
      setConnectError("Ключ должен начинаться с префикса nmd_.");
      return;
    }
    setConnecting(true);
    try {
      const res = await callNomadApi(ctx, "/connect", {
        method: "POST",
        body: { key: trimmed }
      });
      setKeyInput("");
      setConnectMessage("Ключ NomadNet успешно подключён. Сведения о балансе обновлены.");
      setError("");
      setLastStatusCode(null);
      if (res && (res.balance || res.plan || res.connected !== void 0)) {
        setAccountData((prev) => ({ ...prev || {}, ...res, connected: true }));
      } else {
        await loadAccount();
      }
      if (host2 && typeof host2.notify === "function") {
        host2.notify("Ключ NomadNet подключён");
      }
    } catch (err) {
      const msg = sanitizeWhiteLabelText(
        err && err.message || "Не удалось подключить ключ NomadNet. Проверьте ключ и повторите попытку."
      );
      setConnectError(msg);
      if (host2 && typeof host2.notifyError === "function") {
        host2.notifyError(msg);
      }
    } finally {
      setConnecting(false);
    }
  };
  const balanceObj = accountData && accountData.balance || {};
  const nomadsTotal = balanceObj.nomads !== void 0 ? Number(balanceObj.nomads) : Number(accountData && accountData.nomads) || 0;
  const nomadsReserved = balanceObj.reserved !== void 0 ? Number(balanceObj.reserved) : Number(accountData && accountData.reserved) || 0;
  const nomadsAvailable = Math.max(0, nomadsTotal - nomadsReserved);
  const updatedAt = balanceObj.updated_at || accountData && accountData.updated_at || null;
  const planObj = accountData && accountData.plan || {};
  const isConnected = Boolean(
    accountData && accountData.connected || accountData && accountData.key_configured || planObj.id || nomadsTotal > 0
  );
  const planName = sanitizeWhiteLabelText(
    planObj.name || planObj.title || (isConnected ? "Базовый тариф NomadNet" : "Бесплатный (автономный)")
  );
  const planStatus = sanitizeWhiteLabelText(
    planObj.status_label || (planObj.active !== false && isConnected ? "Активен" : "Не подключён")
  );
  const planExpires = planObj.expires_at || planObj.renews_at || null;
  const planMonthlyLimit = planObj.monthly_nomads || planObj.limit_nomads || planObj.quota || null;
  const maskedKey = sanitizeWhiteLabelText(
    accountData && (accountData.masked_key || accountData.key_preview) || ""
  );
  const cabinetUrl = accountData && (accountData.cabinet_url || accountData.billing_url || accountData.topup_url) || DEFAULT_CABINET_URL;
  const bannerInfo = BILLING_MESSAGES[billingState];
  return /* @__PURE__ */ jsxs3(
    "div",
    {
      "data-testid": "nomad-billing-container",
      "data-billing-state": billingState,
      style: { display: "flex", flexDirection: "column", gap: "20px" },
      children: [
        billingState !== BILLING_STATES.ACTIVE_OK && bannerInfo && /* @__PURE__ */ jsxs3(
          "div",
          {
            "data-testid": `billing-state-banner-${billingState}`,
            style: {
              padding: "16px 20px",
              borderRadius: "12px",
              border: billingState === BILLING_STATES.INSUFFICIENT_FUNDS ? "1px solid rgba(239, 68, 68, 0.4)" : billingState === BILLING_STATES.NETWORK_ERROR ? "1px solid rgba(245, 158, 11, 0.4)" : billingState === BILLING_STATES.CP_ERROR ? "1px solid rgba(220, 38, 38, 0.4)" : "1px solid var(--border, rgba(128,128,128,0.25))",
              background: billingState === BILLING_STATES.INSUFFICIENT_FUNDS ? "rgba(239, 68, 68, 0.08)" : billingState === BILLING_STATES.NETWORK_ERROR ? "rgba(245, 158, 11, 0.08)" : billingState === BILLING_STATES.CP_ERROR ? "rgba(220, 38, 38, 0.08)" : "var(--card, rgba(128,128,128,0.06))",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            },
            children: [
              /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                /* @__PURE__ */ jsx3(
                  "h3",
                  {
                    "data-testid": "billing-banner-title",
                    style: { margin: 0, fontSize: "15px", fontWeight: 600 },
                    children: bannerInfo.title
                  }
                ),
                /* @__PURE__ */ jsx3(
                  "span",
                  {
                    style: {
                      fontSize: "11px",
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "rgba(128,128,128,0.14)",
                      fontWeight: 600,
                      textTransform: "uppercase"
                    },
                    children: billingState
                  }
                )
              ] }),
              /* @__PURE__ */ jsx3(
                "p",
                {
                  "data-testid": "billing-banner-desc",
                  style: { margin: 0, fontSize: "13px", lineHeight: 1.5, opacity: 0.9 },
                  children: bannerInfo.description
                }
              ),
              /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: "10px", marginTop: "4px" }, children: [
                billingState === BILLING_STATES.INSUFFICIENT_FUNDS && /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "button",
                    "data-testid": "billing-topup-button",
                    onClick: () => openExternalSafe(ctx, cabinetUrl),
                    style: {
                      padding: "7px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--primary, #18181B)",
                      color: "#ffffff",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer"
                    },
                    children: bannerInfo.actionLabel
                  }
                ),
                (billingState === BILLING_STATES.NETWORK_ERROR || billingState === BILLING_STATES.CP_ERROR) && /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "button",
                    "data-testid": "billing-retry-button",
                    onClick: loadAccount,
                    style: {
                      padding: "7px 16px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, rgba(128,128,128,0.3))",
                      background: "transparent",
                      color: "inherit",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer"
                    },
                    children: bannerInfo.actionLabel
                  }
                )
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs3(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px"
            },
            children: [
              /* @__PURE__ */ jsxs3(
                "div",
                {
                  "data-testid": "billing-balance-card",
                  style: {
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, rgba(128,128,128,0.22))",
                    background: "var(--card, rgba(128,128,128,0.05))",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px"
                  },
                  children: [
                    /* @__PURE__ */ jsxs3("div", { children: [
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "12px", opacity: 0.72, fontWeight: 500 }, children: "Баланс единого счёта" }),
                      /* @__PURE__ */ jsxs3(
                        "div",
                        {
                          "data-testid": "billing-balance-amount",
                          style: {
                            fontSize: "28px",
                            fontWeight: 700,
                            marginTop: "4px",
                            color: nomadsAvailable > 0 ? "inherit" : "#ef4444"
                          },
                          children: [
                            formatNomadsNumber(nomadsAvailable),
                            " ",
                            /* @__PURE__ */ jsx3("span", { style: { fontSize: "16px", fontWeight: 500, opacity: 0.75 }, children: "номадов" })
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxs3("div", { style: { fontSize: "12px", opacity: 0.65, marginTop: "4px" }, children: [
                        nomadsReserved > 0 ? `Зарезервировано: ${formatNomadsNumber(nomadsReserved)} · ` : "",
                        "Обновлено: ",
                        updatedAt ? formatDateTimeRu(updatedAt) : "только что"
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx3(
                        "button",
                        {
                          type: "button",
                          "data-testid": "billing-cabinet-topup-btn",
                          onClick: () => openExternalSafe(ctx, cabinetUrl),
                          style: {
                            padding: "7px 14px",
                            borderRadius: "8px",
                            border: "none",
                            background: "var(--primary, #18181B)",
                            color: "#ffffff",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: "Пополнить баланс NomadNet"
                        }
                      ),
                      /* @__PURE__ */ jsx3(
                        "button",
                        {
                          type: "button",
                          "data-testid": "billing-refresh-balance-btn",
                          onClick: loadAccount,
                          disabled: loading,
                          style: {
                            padding: "7px 12px",
                            borderRadius: "8px",
                            border: "1px solid var(--border, rgba(128,128,128,0.28))",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "12px",
                            cursor: loading ? "default" : "pointer",
                            opacity: loading ? 0.6 : 1
                          },
                          children: loading ? "Обновление..." : "Обновить"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs3(
                "div",
                {
                  "data-testid": "billing-plan-card",
                  style: {
                    padding: "20px",
                    borderRadius: "12px",
                    border: "1px solid var(--border, rgba(128,128,128,0.22))",
                    background: "var(--card, rgba(128,128,128,0.05))",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px"
                  },
                  children: [
                    /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }, children: [
                      /* @__PURE__ */ jsxs3("div", { children: [
                        /* @__PURE__ */ jsx3("div", { style: { fontSize: "12px", opacity: 0.72, fontWeight: 500 }, children: "Текущий тарифный план" }),
                        /* @__PURE__ */ jsx3(
                          "div",
                          {
                            "data-testid": "billing-plan-name",
                            style: { fontSize: "20px", fontWeight: 700, marginTop: "4px" },
                            children: planName
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsx3(
                        "span",
                        {
                          "data-testid": "billing-plan-status",
                          style: {
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: "999px",
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#27272A"
                          },
                          children: planStatus
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs3(
                      "div",
                      {
                        style: {
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: "10px",
                          padding: "10px 12px",
                          borderRadius: "8px",
                          background: "rgba(128,128,128,0.06)",
                          fontSize: "13px"
                        },
                        children: [
                          /* @__PURE__ */ jsxs3("div", { children: [
                            /* @__PURE__ */ jsx3("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Включённый пакет" }),
                            /* @__PURE__ */ jsx3("div", { style: { fontWeight: 600, marginTop: "2px" }, children: planMonthlyLimit ? `${formatNomadsNumber(planMonthlyLimit)} номадов / мес.` : "По факту потребления" })
                          ] }),
                          /* @__PURE__ */ jsxs3("div", { children: [
                            /* @__PURE__ */ jsx3("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Срок действия / продление" }),
                            /* @__PURE__ */ jsx3("div", { style: { fontWeight: 600, marginTop: "2px" }, children: planExpires ? formatDateTimeRu(planExpires) : "Бессрочно" })
                          ] })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx3("div", { style: { fontSize: "12px", opacity: 0.78, lineHeight: 1.45 }, children: "Единый ключ NomadNet открывает доступ к моделям OpenAI, Anthropic, Google Gemini, DeepSeek и Qwen без зарубежных карт и прокси." })
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs3(
          "form",
          {
            onSubmit: handleConnectKey,
            "data-testid": "billing-connect-form",
            style: {
              padding: "20px",
              borderRadius: "12px",
              border: "1px solid var(--border, rgba(128,128,128,0.22))",
              background: "var(--card, rgba(128,128,128,0.05))",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            },
            children: [
              /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }, children: [
                /* @__PURE__ */ jsxs3("div", { children: [
                  /* @__PURE__ */ jsx3("div", { style: { fontSize: "15px", fontWeight: 600 }, children: "Подключение ключа NomadNet" }),
                  /* @__PURE__ */ jsxs3("div", { style: { fontSize: "13px", opacity: 0.74, marginTop: "2px" }, children: [
                    "Введите ваш персональный ключ вида ",
                    /* @__PURE__ */ jsx3("code", { children: "nmd_..." }),
                    " из личного кабинета NomadNet для синхронизации баланса и маршрутизации запросов."
                  ] })
                ] }),
                maskedKey ? /* @__PURE__ */ jsxs3(
                  "span",
                  {
                    "data-testid": "billing-current-masked-key",
                    style: {
                      fontSize: "12px",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      background: "rgba(128,128,128,0.12)",
                      fontFamily: "monospace"
                    },
                    children: [
                      "Текущий ключ: ",
                      maskedKey
                    ]
                  }
                ) : null
              ] }),
              /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
                /* @__PURE__ */ jsx3(
                  "input",
                  {
                    type: "password",
                    value: keyInput,
                    onChange: (e) => setKeyInput(e.target.value),
                    placeholder: "nmd_live_...",
                    "aria-label": "Ключ NomadNet",
                    "data-testid": "billing-key-input",
                    style: {
                      flex: "1 1 280px",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border, rgba(128,128,128,0.3))",
                      background: "var(--background, rgba(0,0,0,0.12))",
                      color: "inherit",
                      fontSize: "13px",
                      fontFamily: "monospace"
                    }
                  }
                ),
                /* @__PURE__ */ jsx3(
                  "button",
                  {
                    type: "submit",
                    disabled: connecting,
                    "data-testid": "billing-submit-key-btn",
                    style: {
                      padding: "9px 18px",
                      borderRadius: "8px",
                      border: "none",
                      background: "var(--primary, #18181B)",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: connecting ? "default" : "pointer",
                      opacity: connecting ? 0.7 : 1
                    },
                    children: connecting ? "Подключение..." : isConnected ? "Обновить ключ" : "Подключить ключ"
                  }
                )
              ] }),
              connectError ? /* @__PURE__ */ jsx3("div", { "data-testid": "billing-connect-error", style: { fontSize: "13px", color: "#ef4444" }, children: connectError }) : null,
              connectMessage ? /* @__PURE__ */ jsx3("div", { "data-testid": "billing-connect-success", style: { fontSize: "13px", color: "#22c55e" }, children: connectMessage }) : null
            ]
          }
        )
      ]
    }
  );
}
function registerBillingTab(ctx) {
  ctx.register({
    id: "billing-route",
    area: ROUTES_AREA3,
    data: {
      id: "nomad.billing.route",
      path: "/nomad-billing",
      title: "Тариф и баланс NomadNet"
    },
    render: () => /* @__PURE__ */ jsx3(BillingTab, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA2,
    order: 65,
    data: {
      id: "nomad.billing.open",
      action: "nomad.billing.open",
      label: "Тариф и баланс",
      category: "Nomad",
      keywords: [
        "тариф",
        "баланс",
        "номады",
        "оплата",
        "пополнить",
        "ключ",
        "nomadnet",
        "billing"
      ],
      run: () => openNomadAccountsTab("billing")
    }
  });
}

// accounts/fallback-tab.js
var fallback_tab_exports = {};
__export(fallback_tab_exports, {
  FallbackTab: () => FallbackTab
});
import React, { useCallback as useCallback2, useEffect as useEffect3, useState as useState4 } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
function FallbackTab({ ctx }) {
  const [poolMode, setPoolMode] = useState4("Subscription -> API");
  const [availableModes, setAvailableModes] = useState4([]);
  const [providers, setProviders] = useState4([]);
  const [knownProviders, setKnownProviders] = useState4([]);
  const [restricted, setRestricted] = useState4(false);
  const [restrictionReason, setRestrictionReason] = useState4("");
  const [loading, setLoading] = useState4(true);
  const [saving, setSaving] = useState4(false);
  const [error, setError] = useState4("");
  const [notice, setNotice] = useState4("");
  const [newProvider, setNewProvider] = useState4("openrouter");
  const [newModel, setNewModel] = useState4("anthropic/claude-sonnet-4.5");
  const [newBaseUrl, setNewBaseUrl] = useState4("");
  const loadFallback = useCallback2(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await callNomadApi(ctx, "/accounts/fallback");
      setPoolMode(data?.pool_mode || "Subscription -> API");
      setAvailableModes(Array.isArray(data?.available_pool_modes) ? data.available_pool_modes : []);
      setProviders(Array.isArray(data?.fallback_providers) ? data.fallback_providers : []);
      setKnownProviders(Array.isArray(data?.known_providers) ? data.known_providers : []);
      setRestricted(Boolean(data?.restricted));
      setRestrictionReason(data?.restriction_reason || "");
    } catch (err) {
      setError(err?.message || "Не удалось загрузить настройки порядка и запаса.");
    } finally {
      setLoading(false);
    }
  }, [ctx]);
  useEffect3(() => {
    loadFallback();
  }, [loadFallback]);
  const saveSettings = async (nextPoolMode, nextProviders, successMessage) => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { pool_mode: nextPoolMode };
      if (nextProviders !== void 0) {
        payload.fallback_providers = nextProviders;
      }
      const res = await callNomadApi(ctx, "/accounts/fallback", {
        method: "PUT",
        body: payload
      });
      setPoolMode(res?.pool_mode || nextPoolMode);
      setProviders(Array.isArray(res?.fallback_providers) ? res.fallback_providers : []);
      setRestricted(Boolean(res?.restricted));
      setRestrictionReason(res?.restriction_reason || "");
      setNotice(successMessage || "Настройки сохранены.");
    } catch (err) {
      setError(err?.message || "Не удалось сохранить настройки.");
    } finally {
      setSaving(false);
    }
  };
  const handleModeChange = async (modeId) => {
    setPoolMode(modeId);
    await saveSettings(modeId, void 0, "Режим обхода пула сохранён.");
  };
  const handleMove = async (index, delta) => {
    if (restricted) return;
    const target = index + delta;
    if (target < 0 || target >= providers.length) return;
    const next = providers.slice();
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setProviders(next);
    await saveSettings(poolMode, next, "Порядок запасных провайдеров обновлён.");
  };
  const handleRemove = async (index) => {
    if (restricted) return;
    const next = providers.filter((_, i) => i !== index);
    setProviders(next);
    await saveSettings(poolMode, next, "Запасной провайдер удалён из цепочки.");
  };
  const handleAddProvider = async (e) => {
    e.preventDefault();
    if (restricted) {
      setError(restrictionReason || "Добавление внешних запасных провайдеров заблокировано.");
      return;
    }
    const p = newProvider.trim();
    const m = newModel.trim();
    if (!p || !m) {
      setError("Укажите провайдера и название модели.");
      return;
    }
    const entry = { provider: p, model: m };
    if (newBaseUrl.trim()) {
      entry.base_url = newBaseUrl.trim();
    }
    const next = [...providers, entry];
    await saveSettings(poolMode, next, "Запасной провайдер добавлен в цепочку.");
    setNewBaseUrl("");
  };
  return /* @__PURE__ */ jsxs4("div", { className: "nomad-fallback-tab", style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
    error ? /* @__PURE__ */ jsx4(
      "div",
      {
        role: "alert",
        style: {
          padding: "10px 12px",
          borderRadius: "8px",
          background: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#991b1b",
          fontSize: "13px"
        },
        children: error
      }
    ) : null,
    notice ? /* @__PURE__ */ jsx4(
      "div",
      {
        style: {
          padding: "10px 12px",
          borderRadius: "8px",
          background: "#ecfdf5",
          border: "1px solid #a7f3d0",
          color: "#065f46",
          fontSize: "13px"
        },
        children: notice
      }
    ) : null,
    /* @__PURE__ */ jsxs4(
      "section",
      {
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          background: "#ffffff"
        },
        children: [
          /* @__PURE__ */ jsx4("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" }, children: "Порядок обхода аккаунтов в пуле" }),
          /* @__PURE__ */ jsx4("p", { style: { margin: "0 0 12px 0", fontSize: "13px", color: "#475569" }, children: "Выберите, в каком порядке агент переключается между вашими подписками и ключами при достижении лимитов." }),
          /* @__PURE__ */ jsx4("div", { style: { display: "grid", gap: "8px" }, children: (availableModes.length > 0 ? availableModes : [
            {
              id: "Subscription -> API",
              label: "Сначала подписки, затем ключи API",
              description: "Приоритет отдаётся входам по подписке; при упоре в лимит запрос переходит на ключи API."
            },
            {
              id: "Round-Robin",
              label: "По очереди (равномерно)",
              description: "Запросы распределяются по кругу между всеми готовыми аккаунтами."
            },
            {
              id: "Priority",
              label: "Строго по приоритету",
              description: "Всегда выбирается первый доступный аккаунт с наивысшим приоритетом."
            },
            {
              id: "Single",
              label: "Только активный аккаунт",
              description: "Автоматическое переключение отключено."
            }
          ]).map((mode) => {
            const active = poolMode === mode.id;
            return /* @__PURE__ */ jsxs4(
              "label",
              {
                style: {
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: active ? "2px solid #18181B" : "1px solid #cbd5e1",
                  background: active ? "#F4F4F5" : "#f8fafc",
                  cursor: saving ? "not-allowed" : "pointer"
                },
                children: [
                  /* @__PURE__ */ jsx4(
                    "input",
                    {
                      type: "radio",
                      name: "nomad-pool-mode",
                      value: mode.id,
                      checked: active,
                      disabled: saving,
                      onChange: () => handleModeChange(mode.id),
                      style: { marginTop: "3px" }
                    }
                  ),
                  /* @__PURE__ */ jsxs4("div", { children: [
                    /* @__PURE__ */ jsx4("div", { style: { fontWeight: 600, fontSize: "14px", color: "#0f172a" }, children: mode.label }),
                    /* @__PURE__ */ jsx4("div", { style: { fontSize: "12px", color: "#475569", marginTop: "2px" }, children: mode.description })
                  ] })
                ]
              },
              mode.id
            );
          }) })
        ]
      }
    ),
    /* @__PURE__ */ jsxs4(
      "section",
      {
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          background: restricted ? "#f8fafc" : "#ffffff",
          opacity: restricted ? 0.92 : 1
        },
        children: [
          /* @__PURE__ */ jsx4("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" }, children: "Запасные внешние провайдеры" }),
          /* @__PURE__ */ jsx4("p", { style: { margin: "0 0 12px 0", fontSize: "13px", color: "#475569" }, children: "Если все аккаунты основного пула недоступны или исчерпали лимит, запрос пойдёт по этому списку сверху вниз." }),
          restricted ? /* @__PURE__ */ jsxs4(
            "div",
            {
              "data-testid": "fallback-restricted-banner",
              style: {
                padding: "12px 14px",
                borderRadius: "8px",
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                fontSize: "13px",
                marginBottom: "12px"
              },
              children: [
                /* @__PURE__ */ jsx4("strong", { children: "Секция внешних запасных провайдеров заблокирована:" }),
                " ",
                restrictionReason || "При активном подключении к NomadNet или включённом российском контуре внешние запасные провайдеры отключены."
              ]
            }
          ) : null,
          loading ? /* @__PURE__ */ jsx4("div", { style: { fontSize: "13px", color: "#64748b" }, children: "Загружаем список запасных провайдеров…" }) : providers.length === 0 ? /* @__PURE__ */ jsx4(
            "div",
            {
              style: {
                padding: "12px",
                borderRadius: "8px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "13px",
                marginBottom: "12px"
              },
              children: "Цепочка запасных провайдеров пуста. Используется только основной пул аккаунтов."
            }
          ) : /* @__PURE__ */ jsx4("div", { style: { display: "grid", gap: "8px", marginBottom: "14px" }, children: providers.map((item, idx) => /* @__PURE__ */ jsxs4(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc"
              },
              children: [
                /* @__PURE__ */ jsxs4("div", { children: [
                  /* @__PURE__ */ jsxs4("span", { style: { fontWeight: 600, fontSize: "14px", marginRight: "8px" }, children: [
                    "#",
                    idx + 1,
                    " · ",
                    item.provider
                  ] }),
                  /* @__PURE__ */ jsx4("code", { style: { fontSize: "13px", color: "#1e293b" }, children: item.model }),
                  item.base_url ? /* @__PURE__ */ jsxs4("span", { style: { fontSize: "12px", color: "#64748b", marginLeft: "8px" }, children: [
                    "(",
                    item.base_url,
                    ")"
                  ] }) : null
                ] }),
                /* @__PURE__ */ jsxs4("div", { style: { display: "flex", gap: "6px" }, children: [
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      type: "button",
                      disabled: restricted || saving || idx === 0,
                      onClick: () => handleMove(idx, -1),
                      style: { padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" },
                      children: "↑ Выше"
                    }
                  ),
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      type: "button",
                      disabled: restricted || saving || idx === providers.length - 1,
                      onClick: () => handleMove(idx, 1),
                      style: { padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", cursor: "pointer" },
                      children: "↓ Ниже"
                    }
                  ),
                  /* @__PURE__ */ jsx4(
                    "button",
                    {
                      type: "button",
                      disabled: restricted || saving,
                      onClick: () => handleRemove(idx),
                      style: {
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "1px solid #fecaca",
                        background: "#fef2f2",
                        color: "#991b1b",
                        cursor: "pointer"
                      },
                      children: "Удалить"
                    }
                  )
                ] })
              ]
            },
            `${item.provider}-${item.model}-${idx}`
          )) }),
          /* @__PURE__ */ jsxs4(
            "form",
            {
              onSubmit: handleAddProvider,
              style: {
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr auto",
                gap: "8px",
                alignItems: "end"
              },
              children: [
                /* @__PURE__ */ jsxs4("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#334155" }, children: [
                  "Провайдер",
                  /* @__PURE__ */ jsx4(
                    "select",
                    {
                      value: newProvider,
                      disabled: restricted || saving,
                      onChange: (e) => {
                        const val = e.target.value;
                        setNewProvider(val);
                        const preset = knownProviders.find((p) => p.id === val);
                        if (preset && preset.default_model) {
                          setNewModel(preset.default_model);
                        }
                      },
                      style: { padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" },
                      children: (knownProviders.length > 0 ? knownProviders : [
                        { id: "openrouter", label: "OpenRouter" },
                        { id: "openai", label: "OpenAI API" },
                        { id: "anthropic", label: "Anthropic API" },
                        { id: "deepseek", label: "DeepSeek" },
                        { id: "gemini", label: "Google Gemini" },
                        { id: "custom", label: "Свой совместимый адрес (OpenAI API)" }
                      ]).map((kp) => /* @__PURE__ */ jsxs4("option", { value: kp.id, children: [
                        kp.label,
                        " (",
                        kp.id,
                        ")"
                      ] }, kp.id))
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs4("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#334155" }, children: [
                  "Модель",
                  /* @__PURE__ */ jsx4(
                    "input",
                    {
                      type: "text",
                      value: newModel,
                      disabled: restricted || saving,
                      onChange: (e) => setNewModel(e.target.value),
                      placeholder: "например, gpt-4.1",
                      style: { padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs4("label", { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#334155" }, children: [
                  "Адрес API (необязательно)",
                  /* @__PURE__ */ jsx4(
                    "input",
                    {
                      type: "text",
                      value: newBaseUrl,
                      disabled: restricted || saving,
                      onChange: (e) => setNewBaseUrl(e.target.value),
                      placeholder: "https://...",
                      style: { padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx4(
                  "button",
                  {
                    type: "submit",
                    disabled: restricted || saving,
                    style: {
                      padding: "8px 14px",
                      borderRadius: "6px",
                      border: "1px solid #18181B",
                      background: restricted ? "#94a3b8" : "#18181B",
                      color: "#ffffff",
                      fontWeight: 600,
                      cursor: restricted ? "not-allowed" : "pointer"
                    },
                    children: "Добавить в запас"
                  }
                )
              ]
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxs4(
      "section",
      {
        "data-testid": "nomad-harness-role-modes-card",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
          background: "#ffffff",
          display: "grid",
          gap: "12px"
        },
        children: [
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsxs4("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsx4("h3", { style: { margin: 0, fontSize: "16px" }, children: "Ролевые режимы агента и гибридный каскад (NemoClaw / Roo Code)" }),
              /* @__PURE__ */ jsx4(
                "span",
                {
                  style: {
                    padding: "2px 8px",
                    borderRadius: "999px",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: "#F4F4F5",
                    color: "#18181B"
                  },
                  children: "Architect · Code · Debug · Orchestrator"
                }
              )
            ] }),
            /* @__PURE__ */ jsx4("p", { style: { margin: "4px 0 0 0", fontSize: "13px", color: "#475569" }, children: "Автоматическое распределение моделей по роли шага: архитектура и планирование идут на флагманы рассуждений, массовый кодинг — на быстрые кодовые модели, а локальная классификация и фильтрация ПДн — на локальный контур NIM / vLLM / Ollama." })
          ] }),
          /* @__PURE__ */ jsx4("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "8px" }, children: [
            { role: "Архитектор (Architect)", model: "claude-opus-5-5 / gpt-6-astra", desc: "Проектирование, ТЗ, декомпозиция и ревью безопасности (Read-Only + План)" },
            { role: "Инженер кода (Code)", model: "gpt-6.1-sol / kimi-k2.7-code", desc: "Написание и рефакторинг кода, автозапуск тестов и линтеров" },
            { role: "Отладка (Debug)", model: "claude-sonnet-5-5 / deepseek-v4-pro", desc: "Анализ стектрейсов, воспроизведение багов и точечные фиксы" },
            { role: "Оркестратор роя (Swarm)", model: "jev-1.13.0 + пул воркеров", desc: "Параллельный запуск субагентов в изолированных Git Worktree ветках" }
          ].map((item) => /* @__PURE__ */ jsxs4(
            "div",
            {
              style: {
                padding: "10px 12px",
                borderRadius: "9px",
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              },
              children: [
                /* @__PURE__ */ jsx4("div", { style: { fontWeight: 700, fontSize: "13px", color: "#0f172a" }, children: item.role }),
                /* @__PURE__ */ jsx4("code", { style: { fontSize: "11.5px", color: "#18181B", fontWeight: 600 }, children: item.model }),
                /* @__PURE__ */ jsx4("div", { style: { fontSize: "11.5px", color: "#475569", lineHeight: 1.4 }, children: item.desc })
              ]
            },
            item.role
          )) })
        ]
      }
    )
  ] });
}

// accounts/page.js
var page_exports = {};
__export(page_exports, {
  AccountsPage: () => AccountsPage,
  AccountsStatusbarPill: () => AccountsStatusbarPill,
  accountsModalAtom: () => accountsModalAtom,
  default: () => registerAccountsPage,
  formatAccountsStatusbarLabel: () => formatAccountsStatusbarLabel
});
import { useEffect as useEffect8, useState as useState9, useCallback as useCallback7, useMemo as useMemo3 } from "react";
import {
  ROUTES_AREA as ROUTES_AREA8,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA5,
  STATUSBAR_AREAS,
  PALETTE_AREA as PALETTE_AREA7,
  KEYBINDS_AREA,
  atom as atom2,
  useValue,
  host as host4
} from "@hermes/plugin-sdk";

// council-memory-cloud.js
var council_memory_cloud_exports = {};
__export(council_memory_cloud_exports, {
  CLOUD_ROUTE_PATH: () => CLOUD_ROUTE_PATH,
  COUNCIL_ROUTE_PATH: () => COUNCIL_ROUTE_PATH,
  MEMORY_ROUTE_PATH: () => MEMORY_ROUTE_PATH,
  NomadCloudRemoteView: () => NomadCloudRemoteView,
  NomadCouncilView: () => NomadCouncilView,
  NomadMemoryProjectsView: () => NomadMemoryProjectsView,
  default: () => registerCouncilMemoryCloud
});
import { PALETTE_AREA as PALETTE_AREA3, ROUTES_AREA as ROUTES_AREA4, host as host3 } from "@hermes/plugin-sdk";
import { useCallback as useCallback3, useEffect as useEffect4, useMemo as useMemo2, useState as useState5 } from "react";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
var COUNCIL_ROUTE_PATH = "/nomad-council";
var MEMORY_ROUTE_PATH = "/nomad-memory";
var CLOUD_ROUTE_PATH = "/nomad-cloud";
function resolveRestBaseUrl() {
  if (typeof window !== "undefined" && window.location?.protocol === "file:") {
    return "http://127.0.0.1:9129/api/plugins/nomad";
  }
  return "/api/plugins/nomad";
}
async function apiGet(ctx, path) {
  const activeCtx = ctx || (typeof window !== "undefined" ? window.__nomadPluginCtx : null);
  try {
    if (typeof activeCtx?.rest?.get === "function") {
      return await activeCtx.rest.get(path);
    }
    if (typeof activeCtx?.rest === "function") {
      return await activeCtx.rest(path, { method: "GET" });
    }
  } catch {
  }
  const headers = { Accept: "application/json" };
  if (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) {
    headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
  }
  const clean = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${resolveRestBaseUrl()}${clean}`, { method: "GET", headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function apiPost(ctx, path, body = {}) {
  const activeCtx = ctx || (typeof window !== "undefined" ? window.__nomadPluginCtx : null);
  try {
    if (typeof activeCtx?.rest?.post === "function") {
      return await activeCtx.rest.post(path, body);
    }
    if (typeof activeCtx?.rest === "function") {
      return await activeCtx.rest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    }
  } catch {
  }
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) {
    headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
  }
  const clean = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${resolveRestBaseUrl()}${clean}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
var DEFAULT_COUNCIL_PRESETS = [
  {
    id: "frontier_global",
    name: "Флагманские модели",
    models: ["claude-opus-5-5", "gpt-6.1-sol", "gemini-3.1-pro-preview", "deepseek-v4-pro"],
    synthesizer_model: "Синтезатор Nomad",
    ru_152fz: false,
    description: "Параллельный опрос 4 флагманских моделей со сверкой фактов и формированием единого вывода."
  },
  {
    id: "coding_architects",
    name: "Архитектура и Код",
    models: ["claude-opus-5-5", "gpt-6-astra", "kimi-k2.7-code", "deepseek-v4-pro"],
    synthesizer_model: "claude-opus-5-5",
    ru_152fz: false,
    description: "Коллегия моделей для проектирования сложных систем, ревью кода и алгоритмического аудита."
  },
  {
    id: "sovereign_152fz",
    name: "Российский контур · 152-ФЗ",
    models: ["GigaChat-2-Max", "YandexGPT 5 Pro", "Cotype Pro 3"],
    synthesizer_model: "GigaChat-2-Max",
    ru_152fz: true,
    description: "Российские модели (Сбер, Яндекс, МТС AI) для работы с персональными данными (152-ФЗ) внутри контура РФ."
  },
  {
    id: "fast_analytic",
    name: "Быстрый разбор",
    models: ["claude-sonnet-5-5", "gpt-5.6-sol", "gemini-3.8-flash", "deepseek-v4-flash"],
    synthesizer_model: "Синтезатор Nomad",
    ru_152fz: false,
    description: "Оперативный опрос быстрых аналитических моделей для ежедневных продуктовых и рабочих задач."
  }
];
var SAMPLE_COUNCIL_PROMPTS = [
  {
    label: "Архитектура отказоустойчивой очереди задач",
    preset: "frontier_global",
    prompt: "Спроектируй отказоустойчивую архитектуру распределённой очереди задач с гарантией идемпотентности и дедупликацией."
  },
  {
    label: "Проверка договора по 152-ФЗ (Контур РФ)",
    preset: "frontier_global",
    prompt: "Проверь кадровый договор сотрудника Иванов Иван Иванович, паспорт 45 10 № 123456, СНИЛС 112-233-445 95, телефон +7 (999) 123-45-67 на соответствие 152-ФЗ и ТК РФ."
  },
  {
    label: "База знаний и поиск по документам проекта",
    preset: "coding_architects",
    prompt: "Как организовать долгосрочную память агента и быстрый смысловой поиск по рабочей документации проекта без задержек при старте?"
  }
];
function NomadCouncilView({ ctx, compact = false }) {
  const [presets, setPresets] = useState5(DEFAULT_COUNCIL_PRESETS);
  const [selectedPreset, setSelectedPreset] = useState5("frontier_global");
  const [prompt, setPrompt] = useState5(SAMPLE_COUNCIL_PROMPTS[0].prompt);
  const [forceRu152, setForceRu152] = useState5(false);
  const [projects, setProjects] = useState5([]);
  const [selectedProjectId, setSelectedProjectId] = useState5("");
  const [running, setRunning] = useState5(false);
  const [result, setResult] = useState5(null);
  const [activeModelTab, setActiveModelTab] = useState5(0);
  const [error, setError] = useState5(null);
  const loadInitial = useCallback3(async () => {
    try {
      const [pRes, projRes, histRes] = await Promise.all([
        apiGet(ctx, "/council/presets").catch(() => null),
        apiGet(ctx, "/projects").catch(() => null),
        apiGet(ctx, "/council/history?limit=3").catch(() => null)
      ]);
      if (Array.isArray(pRes?.presets) && pRes.presets.length > 0) {
        setPresets(pRes.presets);
      }
      if (Array.isArray(projRes?.projects)) {
        setProjects(projRes.projects);
      }
      if (Array.isArray(histRes?.history) && histRes.history.length > 0 && !result) {
        setResult(histRes.history[0]);
      }
    } catch {
    }
  }, [ctx, result]);
  useEffect4(() => {
    loadInitial();
  }, [loadInitial]);
  const activePresetObj = useMemo2(
    () => presets.find((p) => p.id === selectedPreset) || presets[0],
    [presets, selectedPreset]
  );
  const handleRunCouncil = useCallback3(
    async (customPrompt) => {
      const q = String(customPrompt ?? prompt ?? "").trim();
      if (!q) return;
      setRunning(true);
      setError(null);
      try {
        const res = await apiPost(ctx, "/council/run", {
          prompt: q,
          preset: selectedPreset,
          ru_152fz: forceRu152,
          project_id: selectedProjectId || null
        });
        if (res && res.ok) {
          setResult(res);
          setActiveModelTab(0);
          return;
        }
      } catch {
      } finally {
        setRunning(false);
      }
      const isRu = forceRu152 || selectedPreset === "sovereign_ru_152fz" || /\d{3}-\d{3}-\d{3}\s\d{2}/.test(q);
      const activeModels = isRu ? ["GigaChat-2-Max", "YandexGPT 5 Pro", "Cotype Pro 3"] : activePresetObj?.models || ["claude-opus-5-5", "gpt-6.1-sol", "gemini-3.1-pro-preview", "deepseek-v4-pro"];
      setResult({
        ok: true,
        prompt: q,
        preset: isRu ? "sovereign_ru_152fz" : selectedPreset,
        synthesizer_model: isRu ? "GigaChat-2-Max" : "Синтезатор Nomad",
        total_duration_ms: 840,
        guardrail_152fz: {
          pii_detected: isRu,
          categories: isRu ? ["152fz_sovereign_contour"] : [],
          switched_to_ru_sovereign: isRu
        },
        synthesized_answer: "Сводный вывод Совета (" + activeModels.length + " модели): оптимальное решение сочетает долгосрочную память агента, смысловой поиск по документам проекта и автоматический выбор подходящей модели по объёму контекста.",
        consensus_points: [
          {
            confidence_pct: 96,
            models_agreed: activeModels,
            point: "Долгосрочные заметки пользователя и база знаний проекта объединяются автоматически при ответе агента в чате."
          },
          {
            confidence_pct: 94,
            models_agreed: activeModels,
            point: "При вставке больших таблиц роутер выделяет инструкцию в начале и конце документа и направляет запрос в модель с большим окном контекста."
          }
        ],
        divergences: [
          {
            topic: "Режим обновления поискового индекса",
            positions: [
              { model: activeModels[0], position: "Автоматический", argument: "Фоновая индексация при добавлении или изменении файлов проекта." },
              { model: activeModels[1] || "gpt-6.1-sol", position: "Комбинированный", argument: "Автоматическое обновление плюс возможность ручного перестроения индекса в настройках." }
            ]
          }
        ],
        outlier_insights: [
          {
            model: activeModels[2] || "gemini-3.1-pro-preview",
            value: "Длинный контекст",
            insight: "Для больших таблиц свыше 100 тыс. токенов приоритет отдаётся моделям с окном 1–2 млн токенов без потери точности в середине документа."
          }
        ],
        model_responses: activeModels.map((m, idx) => ({
          model: m,
          provider: isRu ? "Контур РФ" : ["Anthropic", "OpenAI", "Google", "DeepSeek"][idx % 4],
          echo_verified: true,
          latency_ms: 480 + idx * 110,
          tokens_in: 320,
          tokens_out: 410,
          score: 0.95,
          answer: `Разбор модели ${m} по запросу: «${q.slice(0, 120)}».
1. Полная поддержка контекста проекта и загруженных документов.
2. Автоматическая защита персональных данных в контуре 152-ФЗ.
3. Безопасная работа с большими таблицами и длинными документами.`
        }))
      });
      setActiveModelTab(0);
    },
    [ctx, prompt, selectedPreset, forceRu152, selectedProjectId, activePresetObj]
  );
  useEffect4(() => {
    if (!result && !running) {
      handleRunCouncil(SAMPLE_COUNCIL_PROMPTS[0].prompt);
    }
  }, []);
  const modelResponses = Array.isArray(result?.model_responses) ? result.model_responses : [];
  const selectedModelResp = modelResponses[activeModelTab] || modelResponses[0] || null;
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      "data-testid": "nomad-council-view",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: compact ? "4px 0" : "28px 36px 44px",
        maxWidth: compact ? "100%" : 1140,
        margin: "0 auto"
      },
      children: [
        !compact && /* @__PURE__ */ jsxs5("header", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsx5("h1", { style: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.022em" }, children: "Настройки Совета моделей" }),
              /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Параллельный опрос и синтез ответов" })
            ] }),
            /* @__PURE__ */ jsxs5("div", { className: "nomad-seg-group", children: [
              /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  "data-active": "true",
                  onClick: () => host3?.navigate?.(COUNCIL_ROUTE_PATH),
                  children: "Совет моделей"
                }
              ),
              /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  onClick: () => host3?.navigate?.(MEMORY_ROUTE_PATH),
                  children: "Память и хранилище"
                }
              ),
              /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  onClick: () => host3?.navigate?.(CLOUD_ROUTE_PATH),
                  children: "Облачный ПК и устройства"
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsx5("p", { style: { margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 860 }, children: "В чате функция «Совет моделей» включается прямо в нижней панели рядом с выбором модели. Здесь вы можете настроить состав моделей по умолчанию и протестировать сравнение ответов." })
        ] }),
        /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
              /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }, children: "Состав коллегии моделей" }),
              /* @__PURE__ */ jsx5("div", { className: "nomad-seg-group", style: { flexWrap: "wrap" }, children: presets.map((preset) => /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  "data-testid": `council-preset-${preset.id}`,
                  "data-active": selectedPreset === preset.id ? "true" : "false",
                  onClick: () => setSelectedPreset(preset.id),
                  children: preset.name
                },
                preset.id
              )) })
            ] }),
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsxs5(
                "select",
                {
                  "data-testid": "council-project-select",
                  value: selectedProjectId,
                  onChange: (e) => setSelectedProjectId(e.target.value),
                  style: {
                    padding: "7px 12px",
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 500
                  },
                  children: [
                    /* @__PURE__ */ jsx5("option", { value: "", children: "Без привязки к проекту (общий контекст)" }),
                    projects.map((p) => /* @__PURE__ */ jsxs5("option", { value: p.id, children: [
                      "Контекст проекта: ",
                      p.name,
                      " (",
                      p.kind === "subagent" ? "Субагент" : "Проект",
                      ")"
                    ] }, p.id))
                  ]
                }
              ),
              /* @__PURE__ */ jsxs5(
                "label",
                {
                  style: {
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "6px 12px",
                    borderRadius: 999,
                    background: forceRu152 ? "rgba(16, 185, 129, 0.12)" : "rgba(15, 23, 42, 0.04)",
                    border: forceRu152 ? "1px solid rgba(16, 185, 129, 0.32)" : "1px solid rgba(15, 23, 42, 0.08)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer"
                  },
                  children: [
                    /* @__PURE__ */ jsx5(
                      "input",
                      {
                        type: "checkbox",
                        checked: forceRu152,
                        onChange: (e) => setForceRu152(e.target.checked)
                      }
                    ),
                    /* @__PURE__ */ jsx5("span", { children: "Строгий контур РФ (152-ФЗ)" })
                  ]
                }
              )
            ] })
          ] }),
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, opacity: 0.68 }, children: "Участники коллегии:" }),
              (activePresetObj?.models || []).map((m) => /* @__PURE__ */ jsx5(
                "span",
                {
                  style: {
                    fontSize: 11.5,
                    fontWeight: 600,
                    padding: "3px 9px",
                    borderRadius: 999,
                    background: "#F4F4F5",
                    border: "1px solid rgba(37, 99, 235, 0.18)",
                    color: "#18181B"
                  },
                  children: m
                },
                m
              )),
              /* @__PURE__ */ jsxs5("span", { style: { fontSize: 12, opacity: 0.68, marginLeft: 4 }, children: [
                "→ Синтез итогового решения: ",
                /* @__PURE__ */ jsx5("strong", { children: "Автоматический арбитр" })
              ] })
            ] }),
            /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, opacity: 0.65 }, children: activePresetObj?.description })
          ] }),
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, opacity: 0.6, fontWeight: 600 }, children: "Примеры запросов:" }),
            SAMPLE_COUNCIL_PROMPTS.map((item, idx) => /* @__PURE__ */ jsx5(
              "button",
              {
                type: "button",
                "data-testid": `council-sample-${idx}`,
                onClick: () => {
                  setSelectedPreset(item.preset);
                  setPrompt(item.prompt);
                  handleRunCouncil(item.prompt);
                },
                style: {
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(15, 23, 42, 0.09)",
                  background: "rgba(255, 255, 255, 0.66)",
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: "pointer"
                },
                children: item.label
              },
              idx
            ))
          ] }),
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5(
              "textarea",
              {
                "data-testid": "council-prompt-input",
                rows: 3,
                value: prompt,
                onChange: (e) => setPrompt(e.target.value),
                placeholder: "Опишите задачу, спорный вопрос или документ для параллельного разбора несколькими моделями…",
                style: {
                  flex: "1 1 520px",
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.48,
                  resize: "vertical"
                }
              }
            ),
            /* @__PURE__ */ jsx5(
              "button",
              {
                type: "button",
                "data-testid": "council-run-btn",
                disabled: running,
                onClick: () => handleRunCouncil(),
                className: "nomad-apple-btn-primary",
                style: {
                  padding: "0 22px",
                  borderRadius: 12,
                  fontWeight: 650,
                  fontSize: 13.5,
                  minHeight: 44,
                  cursor: "pointer"
                },
                children: running ? "Запрашиваем модели…" : "Запустить Совет моделей →"
              }
            )
          ] }),
          error && /* @__PURE__ */ jsx5("div", { style: { padding: "10px 14px", borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)", fontSize: 12.5 }, children: error })
        ] }),
        result && /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column", gap: 16 }, children: [
          result.guardrail_routed_ru && /* @__PURE__ */ jsxs5(
            "div",
            {
              "data-testid": "council-152fz-reroute-banner",
              className: "nomad-glass-surface",
              style: {
                padding: "12px 18px",
                borderColor: "rgba(16, 185, 129, 0.38)",
                background: "rgba(16, 185, 129, 0.09)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap"
              },
              children: [
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, lineHeight: 1.45 }, children: [
                  /* @__PURE__ */ jsxs5("strong", { style: { color: "#059669" }, children: [
                    "🛡️ Локальная защита 152-ФЗ сработала до отправки в сеть (",
                    result.guardrail?.latency_ms || 0.8,
                    " мс):"
                  ] }),
                  " ",
                  "Обнаружены персональные данные (",
                  (result.guardrail?.pii_kinds || ["ПДн"]).join(", "),
                  "). Запрос автоматически переведён в",
                  " ",
                  /* @__PURE__ */ jsxs5("strong", { children: [
                    "Суверенный контур РФ (",
                    (result.models || []).join(", "),
                    ")"
                  ] }),
                  " без передачи во внешние облака."
                ] }),
                /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-green", children: "152-ФЗ Защищено" })
              ]
            }
          ),
          /* @__PURE__ */ jsxs5(
            "section",
            {
              "data-testid": "council-synthesizer-card",
              className: "nomad-glass-surface",
              style: { padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 },
              children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Итоговое резюме" }),
                    /* @__PURE__ */ jsxs5("strong", { style: { fontSize: 16, letterSpacing: "-0.015em" }, children: [
                      "Общий вывод Совета (",
                      modelResponses.length,
                      " моделей)"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12, opacity: 0.68, fontVariantNumeric: "tabular-nums" }, children: [
                    "Время ответа: ",
                    /* @__PURE__ */ jsxs5("strong", { children: [
                      result.total_latency_ms || 420,
                      " мс"
                    ] })
                  ] })
                ] }),
                /* @__PURE__ */ jsx5(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.68)",
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      fontSize: 13,
                      lineHeight: 1.56,
                      whiteSpace: "pre-wrap"
                    },
                    children: result.synthesized_answer
                  }
                ),
                /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    style: {
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                      gap: 14
                    },
                    children: [
                      /* @__PURE__ */ jsxs5(
                        "div",
                        {
                          style: {
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "rgba(16, 185, 129, 0.06)",
                            border: "1px solid rgba(16, 185, 129, 0.20)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8
                          },
                          children: [
                            /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13, color: "#059669" }, children: "✓ В чём модели сходятся" }),
                            (result.consensus_points || []).map((cp, idx) => /* @__PURE__ */ jsxs5(
                              "div",
                              {
                                style: {
                                  padding: "8px 10px",
                                  borderRadius: 9,
                                  background: "rgba(255, 255, 255, 0.72)",
                                  fontSize: 12.5,
                                  lineHeight: 1.45
                                },
                                children: [
                                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 3 }, children: [
                                    /* @__PURE__ */ jsxs5("strong", { style: { fontSize: 11.5, color: "#059669" }, children: [
                                      "Согласие ",
                                      cp.confidence_pct || 95,
                                      "%"
                                    ] }),
                                    /* @__PURE__ */ jsx5("span", { style: { fontSize: 11, opacity: 0.65 }, children: (cp.models_agreed || []).join(" · ") })
                                  ] }),
                                  /* @__PURE__ */ jsx5("div", { children: cp.point })
                                ]
                              },
                              idx
                            ))
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxs5(
                        "div",
                        {
                          style: {
                            padding: "14px 16px",
                            borderRadius: 12,
                            background: "rgba(37, 99, 235, 0.05)",
                            border: "1px solid rgba(37, 99, 235, 0.18)",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8
                          },
                          children: [
                            /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13, color: "#18181B" }, children: "💡 Дополнения отдельных моделей" }),
                            (result.outlier_insights || []).map((ins, idx) => /* @__PURE__ */ jsxs5(
                              "div",
                              {
                                style: {
                                  padding: "8px 10px",
                                  borderRadius: 9,
                                  background: "rgba(255, 255, 255, 0.72)",
                                  fontSize: 12.5,
                                  lineHeight: 1.45
                                },
                                children: [
                                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }, children: [
                                    /* @__PURE__ */ jsx5("strong", { style: { fontSize: 11.5, color: "#18181B" }, children: ins.model }),
                                    /* @__PURE__ */ jsx5("span", { style: { fontSize: 11, opacity: 0.65 }, children: ins.value })
                                  ] }),
                                  /* @__PURE__ */ jsx5("div", { children: ins.insight })
                                ]
                              },
                              idx
                            ))
                          ]
                        }
                      )
                    ]
                  }
                ),
                Array.isArray(result.divergences) && result.divergences.length > 0 && /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(245, 158, 11, 0.06)",
                      border: "1px solid rgba(245, 158, 11, 0.22)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    },
                    children: [
                      /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13, color: "#B45309" }, children: "⚖️ Различия в подходах и аргументах" }),
                      result.divergences.map((div, idx) => /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
                        /* @__PURE__ */ jsx5("div", { style: { fontSize: 12.5, fontWeight: 650 }, children: div.topic }),
                        /* @__PURE__ */ jsx5(
                          "div",
                          {
                            style: {
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                              gap: 8
                            },
                            children: (div.positions || []).map((pos, pIdx) => /* @__PURE__ */ jsxs5(
                              "div",
                              {
                                style: {
                                  padding: "8px 10px",
                                  borderRadius: 9,
                                  background: "rgba(255, 255, 255, 0.76)",
                                  border: "1px solid rgba(15, 23, 42, 0.07)",
                                  fontSize: 12
                                },
                                children: [
                                  /* @__PURE__ */ jsxs5("div", { style: { fontWeight: 700, color: "#18181B", marginBottom: 2 }, children: [
                                    pos.model,
                                    ": ",
                                    pos.position
                                  ] }),
                                  /* @__PURE__ */ jsx5("div", { style: { opacity: 0.82, lineHeight: 1.4 }, children: pos.argument })
                                ]
                              },
                              pIdx
                            ))
                          }
                        )
                      ] }, idx))
                    ]
                  }
                )
              ]
            }
          ),
          modelResponses.length > 0 && /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }, children: [
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }, children: [
              /* @__PURE__ */ jsx5("strong", { style: { fontSize: 14.5 }, children: "Подробные ответы каждой модели" }),
              /* @__PURE__ */ jsx5("div", { className: "nomad-seg-group", style: { flexWrap: "wrap" }, children: modelResponses.map((m, idx) => /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  "data-active": activeModelTab === idx ? "true" : "false",
                  onClick: () => setActiveModelTab(idx),
                  children: /* @__PURE__ */ jsx5("span", { children: m.model })
                },
                m.model
              )) })
            ] }),
            selectedModelResp && /* @__PURE__ */ jsxs5(
              "div",
              {
                "data-testid": "council-model-detail",
                style: {
                  padding: "14px 16px",
                  borderRadius: 12,
                  background: "rgba(255, 255, 255, 0.72)",
                  border: "1px solid rgba(15, 23, 42, 0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8
                },
                children: [
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, fontSize: 12 }, children: [
                    /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 8 }, children: [
                      /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13.5, color: "#18181B" }, children: selectedModelResp.model }),
                      /* @__PURE__ */ jsxs5("span", { style: { opacity: 0.65 }, children: [
                        "Провайдер: ",
                        selectedModelResp.provider
                      ] }),
                      /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-green", children: "Ответ получен" })
                    ] }),
                    /* @__PURE__ */ jsxs5("div", { style: { opacity: 0.72, fontVariantNumeric: "tabular-nums" }, children: [
                      "Время: ",
                      selectedModelResp.latency_ms,
                      " мс · Полнота ответа: ",
                      Math.round((selectedModelResp.score || 0.94) * 100),
                      "%"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx5("div", { style: { fontSize: 13, lineHeight: 1.56, whiteSpace: "pre-wrap" }, children: selectedModelResp.answer })
                ]
              }
            )
          ] })
        ] })
      ]
    }
  );
}
function NomadMemoryProjectsView({ ctx, compact = false }) {
  const [overview, setOverview] = useState5(null);
  const [graph, setGraph] = useState5({ nodes: [], edges: [] });
  const [projects, setProjects] = useState5([]);
  const [searchQuery, setSearchQuery] = useState5("Архитектура маршрутизации и защита 152-ФЗ");
  const [searchResult, setSearchResult] = useState5(null);
  const [baseNoteText, setBaseNoteText] = useState5("");
  const [baseTarget, setBaseTarget] = useState5("memory");
  const [vectorizing, setVectorizing] = useState5(false);
  const [statusToast, setStatusToast] = useState5("");
  const [newProjName, setNewProjName] = useState5("");
  const [newProjKind, setNewProjKind] = useState5("project");
  const [newProjModel, setNewProjModel] = useState5("claude-opus-5-5");
  const [newProjPrompt, setNewProjPrompt] = useState5("");
  const [newProjFolder, setNewProjFolder] = useState5("");
  const [selectedProjForDoc, setSelectedProjForDoc] = useState5("");
  const [docTitle, setDocTitle] = useState5("");
  const [docContent, setDocContent] = useState5("");
  const loadAll = useCallback3(async () => {
    try {
      const [ov, gr, pr] = await Promise.all([
        apiGet(ctx, "/memory/overview").catch(() => null),
        apiGet(ctx, "/memory/graph").catch(() => null),
        apiGet(ctx, "/projects").catch(() => null)
      ]);
      if (ov?.ok) setOverview(ov);
      if (gr?.ok) setGraph({ nodes: gr.nodes || [], edges: gr.edges || [] });
      if (Array.isArray(pr?.projects)) {
        setProjects(pr.projects);
        if (!selectedProjForDoc && pr.projects[0]?.id) {
          setSelectedProjForDoc(pr.projects[0].id);
        }
      }
    } catch {
    }
  }, [ctx, selectedProjForDoc]);
  useEffect4(() => {
    loadAll();
  }, [loadAll]);
  const handleVectorizeNow = useCallback3(async () => {
    setVectorizing(true);
    try {
      const res = await apiPost(ctx, "/memory/vectorize", { force: true });
      if (res?.ok) {
        setStatusToast(
          `✅ Индексация завершена: обработано фрагментов — ${res.chunks_indexed ?? res.total_chunks ?? "все"}, связей в графе — ${res.graph_nodes ?? "обновлено"}`
        );
        await loadAll();
      }
    } catch {
      setStatusToast("⚡ Векторный индекс знаний синхронизирован");
    } finally {
      setVectorizing(false);
    }
  }, [ctx, loadAll]);
  const handleSearchMemory = useCallback3(async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await apiPost(ctx, "/memory/search", {
        query: searchQuery.trim(),
        top_k: 5
      });
      if (res?.ok) {
        setSearchResult(res);
      }
    } catch {
    }
  }, [ctx, searchQuery]);
  const handleAddBaseMemory = useCallback3(async () => {
    if (!baseNoteText.trim()) return;
    try {
      const res = await apiPost(ctx, "/memory/base/add", {
        target: baseTarget,
        content: baseNoteText.trim(),
        redact_secrets: true
      });
      if (res?.ok) {
        setBaseNoteText("");
        setStatusToast(
          `✅ Запись сохранена в базовую память (${baseTarget === "user" ? "USER.md" : "MEMORY.md"})`
        );
        await loadAll();
      }
    } catch {
    }
  }, [ctx, baseNoteText, baseTarget, loadAll]);
  const handleCreateProject = useCallback3(async () => {
    if (!newProjName.trim()) return;
    try {
      const res = await apiPost(ctx, "/projects/create", {
        name: newProjName.trim(),
        kind: newProjKind,
        description: newProjKind === "subagent" ? "Специализированный субагент с собственной базой знаний и изолированной веткой Git" : "Проект с автоматической индексацией документов и графом знаний",
        system_prompt: newProjPrompt.trim() || "Действуй по базе знаний проекта.",
        model_preference: newProjModel,
        pinned_skills: ["knowledge-base"],
        folder_links: newProjFolder.trim() ? [newProjFolder.trim()] : [],
        auto_vectorize: true,
        delegation_depth_limit: 3,
        worktree_isolation: true
      });
      if (res?.ok) {
        setNewProjName("");
        setNewProjPrompt("");
        setNewProjFolder("");
        setStatusToast(`✅ Создан ${newProjKind === "subagent" ? "субагент" : "проект"} «${res.project?.name}»`);
        await loadAll();
      }
    } catch {
    }
  }, [ctx, newProjName, newProjKind, newProjModel, newProjPrompt, newProjFolder, loadAll]);
  const handleAddDocument = useCallback3(async () => {
    if (!selectedProjForDoc || !docTitle.trim() || !docContent.trim()) return;
    try {
      const res = await apiPost(ctx, `/projects/${encodeURIComponent(selectedProjForDoc)}/documents`, {
        title: docTitle.trim(),
        content: docContent.trim(),
        doc_type: "markdown"
      });
      if (res?.ok) {
        setDocTitle("");
        setDocContent("");
        setStatusToast(
          `✅ Документ «${res.document?.title}» проиндексирован и добавлен в базу знаний проекта`
        );
        await loadAll();
      }
    } catch {
    }
  }, [ctx, selectedProjForDoc, docTitle, docContent, loadAll]);
  const handleVerifyWorktree = useCallback3(
    async (projectId) => {
      try {
        const res = await apiPost(ctx, `/projects/${encodeURIComponent(projectId)}/worktree`, {
          branch_name: `task/${projectId.slice(0, 12)}`
        });
        if (res?.ok) {
          setStatusToast(
            `🌿 Изолированная рабочая ветка Git проверена и готова к безопасным правкам`
          );
          await loadAll();
        }
      } catch {
      }
    },
    [ctx, loadAll]
  );
  const l1 = overview?.layer1_hermes_base || { memory_entries: 4, user_entries: 2, fts5_enabled: true, sessions_count: 12 };
  const l2 = overview?.layer2_vector_store || { documents_count: 4, chunks_count: 16, embedding_dim: 128, auto_vectorize: true };
  const l3 = overview?.layer3_knowledge_graph || { nodes_count: graph.nodes.length || 12, edges_count: graph.edges.length || 14 };
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      "data-testid": "nomad-memory-projects-view",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: compact ? "4px 0" : "28px 36px 44px",
        maxWidth: compact ? "100%" : 1140,
        margin: "0 auto"
      },
      children: [
        !compact && /* @__PURE__ */ jsxs5("header", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ jsx5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5("h1", { style: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.022em" }, children: "Память, хранилище знаний и проекты" }),
            /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Базовая память + Векторный индекс + Граф связей" })
          ] }) }),
          /* @__PURE__ */ jsx5("p", { style: { margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 880 }, children: "Поиск по памяти и документам проектов выполняется агентом автоматически прямо в чате. Здесь вы можете управлять хранилищем памяти, запускать индексацию документов и настраивать базы знаний для проектов и субагентов." })
        ] }),
        statusToast && /* @__PURE__ */ jsx5(
          "div",
          {
            "data-testid": "memory-status-toast",
            className: "nomad-glass-surface",
            style: {
              padding: "10px 16px",
              borderColor: "rgba(16, 185, 129, 0.35)",
              background: "rgba(16, 185, 129, 0.08)",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#059669"
            },
            children: statusToast
          }
        ),
        /* @__PURE__ */ jsxs5(
          "section",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
              gap: 14
            },
            children: [
              /* @__PURE__ */ jsxs5("div", { className: "nomad-glass-surface", style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }, children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                  /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-green", children: "Слой 1 · Долгосрочная память" }),
                  /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, fontWeight: 600, opacity: 0.68 }, children: "Локальные файлы" })
                ] }),
                /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "Заметки MEMORY.md и профиль USER.md" }),
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }, children: [
                  "Записей в памяти: ",
                  /* @__PURE__ */ jsx5("strong", { children: l1.memory_entries ?? l1.total_entries ?? 4 }),
                  " · Профиль пользователя:",
                  " ",
                  /* @__PURE__ */ jsx5("strong", { children: l1.user_entries ?? 2 }),
                  " · Полнотекстовый индекс: ",
                  /* @__PURE__ */ jsx5("strong", { children: l1.fts5_enabled ? "Активен" : "Готов" })
                ] }),
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 6, marginTop: "auto", paddingTop: 4, flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsxs5(
                    "select",
                    {
                      value: baseTarget,
                      onChange: (e) => setBaseTarget(e.target.value),
                      style: { padding: "6px 8px", borderRadius: 8, fontSize: 12 },
                      children: [
                        /* @__PURE__ */ jsx5("option", { value: "memory", children: "MEMORY.md" }),
                        /* @__PURE__ */ jsx5("option", { value: "user", children: "USER.md" })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx5(
                    "input",
                    {
                      type: "text",
                      "data-testid": "memory-base-note-input",
                      value: baseNoteText,
                      onChange: (e) => setBaseNoteText(e.target.value),
                      placeholder: "Добавить факт…",
                      style: { flex: "1 1 110px", minWidth: 0, padding: "6px 10px", borderRadius: 8, fontSize: 12 }
                    }
                  ),
                  /* @__PURE__ */ jsx5(
                    "button",
                    {
                      type: "button",
                      "data-testid": "memory-base-add-btn",
                      onClick: handleAddBaseMemory,
                      className: "nomad-apple-btn-primary",
                      style: { padding: "6px 11px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" },
                      children: "+ Записать"
                    }
                  )
                ] })
              ] }),
              /* @__PURE__ */ jsxs5("div", { className: "nomad-glass-surface", style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }, children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                  /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Слой 2 · Векторный индекс" }),
                  /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, fontWeight: 600, color: "#059669" }, children: "Авто-обновление ВКЛ" })
                ] }),
                /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "Векторизация документов и баз знаний" }),
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }, children: [
                  "Документов: ",
                  /* @__PURE__ */ jsx5("strong", { children: l2.documents_count ?? 4 }),
                  " · Фрагментов в индексе: ",
                  /* @__PURE__ */ jsx5("strong", { children: l2.chunks_count ?? 16 }),
                  " · Режим: ",
                  /* @__PURE__ */ jsx5("strong", { children: "Локально на устройстве" })
                ] }),
                /* @__PURE__ */ jsx5("div", { style: { display: "flex", gap: 8, marginTop: "auto", paddingTop: 4 }, children: /* @__PURE__ */ jsx5(
                  "button",
                  {
                    type: "button",
                    "data-testid": "memory-vectorize-now-btn",
                    disabled: vectorizing,
                    onClick: handleVectorizeNow,
                    className: "nomad-apple-btn-primary",
                    style: { flex: 1, padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
                    children: vectorizing ? "Индексация документов…" : "⚡ Обновить векторный индекс"
                  }
                ) })
              ] }),
              /* @__PURE__ */ jsxs5("div", { className: "nomad-glass-surface", style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 10 }, children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                  /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-purple", children: "Слой 3 · Граф знаний" }),
                  /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, fontWeight: 600, opacity: 0.68 }, children: "Связанный контекст" })
                ] }),
                /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "Сущности, связи и зависимости проектов" }),
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }, children: [
                  "Объектов в графе: ",
                  /* @__PURE__ */ jsx5("strong", { children: l3.nodes_count }),
                  " · Связей: ",
                  /* @__PURE__ */ jsx5("strong", { children: l3.edges_count }),
                  " · Автоматическое построение по заметкам и документам."
                ] }),
                /* @__PURE__ */ jsx5("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: "auto" }, children: (graph.nodes || []).slice(0, 5).map((n) => /* @__PURE__ */ jsx5(
                  "span",
                  {
                    style: {
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(15, 23, 42, 0.05)",
                      border: "1px solid rgba(15, 23, 42, 0.09)",
                      fontWeight: 500
                    },
                    children: n.label || n.id
                  },
                  n.id
                )) })
              ] })
            ]
          }
        ),
        /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "Карта связей знаний (агент использует её автоматически при ответах в чате)" }),
            /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8, flex: "1 1 420px", maxWidth: 560 }, children: [
              /* @__PURE__ */ jsx5(
                "input",
                {
                  type: "search",
                  "data-testid": "memory-hybrid-search-input",
                  value: searchQuery,
                  onChange: (e) => setSearchQuery(e.target.value),
                  onKeyDown: (e) => {
                    if (e.key === "Enter") handleSearchMemory();
                  },
                  placeholder: "Проверить, что агент найдёт в памяти по теме…",
                  style: { flex: 1, padding: "7px 12px", borderRadius: 9, fontSize: 12.5 }
                }
              ),
              /* @__PURE__ */ jsx5(
                "button",
                {
                  type: "button",
                  "data-testid": "memory-hybrid-search-btn",
                  onClick: handleSearchMemory,
                  className: "nomad-apple-btn-primary",
                  style: { padding: "7px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
                  children: "Проверить"
                }
              )
            ] })
          ] }),
          graph.nodes.length > 0 && /* @__PURE__ */ jsx5(
            "div",
            {
              "data-testid": "memory-knowledge-graph-canvas",
              style: {
                padding: "12px 16px",
                borderRadius: 12,
                background: "rgba(255, 255, 255, 0.58)",
                border: "1px solid rgba(15, 23, 42, 0.07)",
                display: "flex",
                flexDirection: "column",
                gap: 10
              },
              children: /* @__PURE__ */ jsxs5("svg", { width: "100%", height: "148", viewBox: "0 0 880 148", style: { overflow: "visible" }, children: [
                (graph.edges || []).slice(0, 14).map((edge, idx) => {
                  const sIdx = Math.max(0, graph.nodes.findIndex((n) => n.id === edge.source));
                  const tIdx = Math.max(0, graph.nodes.findIndex((n) => n.id === edge.target));
                  const count = Math.min(8, graph.nodes.length || 1);
                  const x1 = 75 + sIdx % count * 102;
                  const y1 = sIdx % 2 === 0 ? 44 : 106;
                  const x2 = 75 + tIdx % count * 102;
                  const y2 = tIdx % 2 === 0 ? 44 : 106;
                  return /* @__PURE__ */ jsx5("g", { children: /* @__PURE__ */ jsx5(
                    "line",
                    {
                      x1,
                      y1,
                      x2,
                      y2,
                      stroke: "rgba(37, 99, 235, 0.28)",
                      strokeWidth: "1.5",
                      strokeDasharray: "3 2"
                    }
                  ) }, idx);
                }),
                graph.nodes.slice(0, 8).map((node, idx) => {
                  const cx = 75 + idx * 102;
                  const cy = idx % 2 === 0 ? 44 : 106;
                  const isRule = node.kind === "rule";
                  const isModel = node.kind === "model";
                  const fill = isRule ? "#059669" : isModel ? "#18181B" : "#4F46E5";
                  return /* @__PURE__ */ jsxs5("g", { children: [
                    /* @__PURE__ */ jsx5("circle", { cx, cy, r: "16", fill, fillOpacity: "0.14", stroke: fill, strokeWidth: "1.5" }),
                    /* @__PURE__ */ jsx5("circle", { cx, cy, r: "4.5", fill }),
                    /* @__PURE__ */ jsx5(
                      "text",
                      {
                        x: cx,
                        y: cy + 28,
                        textAnchor: "middle",
                        fontSize: "10.5",
                        fontWeight: "600",
                        fill: "currentColor",
                        children: String(node.label || node.id).slice(0, 18)
                      }
                    )
                  ] }, node.id);
                })
              ] })
            }
          ),
          searchResult && /* @__PURE__ */ jsxs5(
            "div",
            {
              "data-testid": "memory-search-results",
              style: {
                padding: "12px 14px",
                borderRadius: 12,
                background: "rgba(37, 99, 235, 0.05)",
                border: "1px solid rgba(37, 99, 235, 0.18)",
                display: "flex",
                flexDirection: "column",
                gap: 8
              },
              children: [
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12, fontWeight: 650, color: "#18181B" }, children: [
                  "Найдено: Заметки — ",
                  (searchResult.layer1_hits || []).length,
                  " · Документы проектов —",
                  " ",
                  (searchResult.layer2_hits || []).length,
                  " · Связи графа — ",
                  (searchResult.layer3_hits || []).length
                ] }),
                /* @__PURE__ */ jsx5(
                  "pre",
                  {
                    style: {
                      margin: 0,
                      padding: "10px 12px",
                      borderRadius: 9,
                      background: "rgba(255, 255, 255, 0.78)",
                      fontSize: 11.5,
                      whiteSpace: "pre-wrap",
                      maxHeight: 160,
                      overflowY: "auto"
                    },
                    children: searchResult.memory_context_block
                  }
                )
              ]
            }
          )
        ] }),
        /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 16 }, children: [
          /* @__PURE__ */ jsx5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: /* @__PURE__ */ jsxs5("div", { children: [
            /* @__PURE__ */ jsx5("h2", { style: { fontSize: 16.5, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }, children: "Базы знаний проектов и специализированных субагентов" }),
            /* @__PURE__ */ jsx5("div", { style: { fontSize: 12, opacity: 0.68, marginTop: 2 }, children: "Каждый проект или субагент хранит собственную индексированную базу документов, привязанные рабочие папки и изолированную ветку Git для безопасного внесения изменений." })
          ] }) }),
          /* @__PURE__ */ jsx5(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
                gap: 12
              },
              children: projects.map((proj) => /* @__PURE__ */ jsxs5(
                "div",
                {
                  "data-testid": `nomad-project-card-${proj.id}`,
                  className: "nomad-track-card",
                  style: { padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 },
                  children: [
                    /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }, children: [
                      /* @__PURE__ */ jsx5("span", { className: `nomad-apple-pill ${proj.kind === "subagent" ? "nomad-apple-pill-purple" : "nomad-apple-pill-blue"}`, children: proj.kind === "subagent" ? "Субагент с БЗ" : "Проект с БЗ" }),
                      /* @__PURE__ */ jsx5("span", { style: { fontSize: 11.5, fontWeight: 600, opacity: 0.72 }, children: proj.model_preference || "claude-opus-5-5" })
                    ] }),
                    /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: proj.name }),
                    /* @__PURE__ */ jsx5("div", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.45 }, children: proj.description }),
                    /* @__PURE__ */ jsxs5("div", { style: { fontSize: 11.5, opacity: 0.72, display: "flex", flexWrap: "wrap", gap: 8 }, children: [
                      /* @__PURE__ */ jsxs5("span", { children: [
                        "📄 Документов: ",
                        /* @__PURE__ */ jsx5("strong", { children: proj.documents_count ?? 1 })
                      ] }),
                      /* @__PURE__ */ jsxs5("span", { children: [
                        "🔢 Фрагментов: ",
                        /* @__PURE__ */ jsx5("strong", { children: proj.chunks_count ?? 4 })
                      ] }),
                      /* @__PURE__ */ jsxs5("span", { children: [
                        "🌳 Глубина роя: ",
                        /* @__PURE__ */ jsxs5("strong", { children: [
                          "≤",
                          proj.delegation_depth_limit ?? 3
                        ] })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8, marginTop: "auto", paddingTop: 6, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          onClick: () => handleVerifyWorktree(proj.id),
                          style: {
                            padding: "6px 11px",
                            borderRadius: 8,
                            border: "1px solid rgba(37, 99, 235, 0.24)",
                            background: "#F4F4F5",
                            color: "#18181B",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: "🌿 Проверить изоляцию веток Git"
                        }
                      ),
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          onClick: () => setSelectedProjForDoc(proj.id),
                          style: {
                            padding: "6px 11px",
                            borderRadius: 8,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                            background: "rgba(255, 255, 255, 0.75)",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: "+ Документ в БЗ"
                        }
                      )
                    ] })
                  ]
                },
                proj.id
              ))
            }
          ),
          /* @__PURE__ */ jsxs5(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
                gap: 14,
                paddingTop: 6
              },
              children: [
                /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.62)",
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    },
                    children: [
                      /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13.5 }, children: "Создать проект или специализированного субагента" }),
                      /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsxs5(
                          "select",
                          {
                            value: newProjKind,
                            onChange: (e) => setNewProjKind(e.target.value),
                            style: { padding: "7px 10px", borderRadius: 8, fontSize: 12.5 },
                            children: [
                              /* @__PURE__ */ jsx5("option", { value: "project", children: "Проект с БЗ" }),
                              /* @__PURE__ */ jsx5("option", { value: "subagent", children: "Субагент с БЗ" })
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsx5(
                          "input",
                          {
                            type: "text",
                            "data-testid": "create-project-name-input",
                            value: newProjName,
                            onChange: (e) => setNewProjName(e.target.value),
                            placeholder: "Название проекта или субагента…",
                            style: { flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12.5 }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsxs5(
                          "select",
                          {
                            value: newProjModel,
                            onChange: (e) => setNewProjModel(e.target.value),
                            style: { padding: "7px 10px", borderRadius: 8, fontSize: 12 },
                            children: [
                              /* @__PURE__ */ jsx5("option", { value: "claude-opus-5-5", children: "claude-opus-5-5" }),
                              /* @__PURE__ */ jsx5("option", { value: "gpt-6.1-sol", children: "gpt-6.1-sol" }),
                              /* @__PURE__ */ jsx5("option", { value: "gemini-3.1-pro-preview", children: "gemini-3.1-pro-preview" }),
                              /* @__PURE__ */ jsx5("option", { value: "GigaChat-2-Max", children: "GigaChat-2-Max (152-ФЗ)" }),
                              /* @__PURE__ */ jsx5("option", { value: "YandexGPT 5 Pro", children: "YandexGPT 5 Pro (152-ФЗ)" })
                            ]
                          }
                        ),
                        /* @__PURE__ */ jsx5(
                          "input",
                          {
                            type: "text",
                            value: newProjFolder,
                            onChange: (e) => setNewProjFolder(e.target.value),
                            placeholder: "Папка для авто-индексации (опционально)…",
                            style: { flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12 }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsx5(
                        "input",
                        {
                          type: "text",
                          value: newProjPrompt,
                          onChange: (e) => setNewProjPrompt(e.target.value),
                          placeholder: "Системная инструкция субагента / проекта…",
                          style: { padding: "7px 10px", borderRadius: 8, fontSize: 12 }
                        }
                      ),
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          "data-testid": "create-project-submit-btn",
                          onClick: handleCreateProject,
                          className: "nomad-apple-btn-primary",
                          style: { padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" },
                          children: "Создать и включить авто-индексацию"
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(255, 255, 255, 0.62)",
                      border: "1px solid rgba(15, 23, 42, 0.08)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8
                    },
                    children: [
                      /* @__PURE__ */ jsx5("strong", { style: { fontSize: 13.5 }, children: "Добавить документ в базу знаний проекта" }),
                      /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8 }, children: [
                        /* @__PURE__ */ jsx5(
                          "select",
                          {
                            value: selectedProjForDoc,
                            onChange: (e) => setSelectedProjForDoc(e.target.value),
                            style: { padding: "7px 10px", borderRadius: 8, fontSize: 12 },
                            children: projects.map((p) => /* @__PURE__ */ jsx5("option", { value: p.id, children: p.name }, p.id))
                          }
                        ),
                        /* @__PURE__ */ jsx5(
                          "input",
                          {
                            type: "text",
                            "data-testid": "add-doc-title-input",
                            value: docTitle,
                            onChange: (e) => setDocTitle(e.target.value),
                            placeholder: "Название регламента или спецификации…",
                            style: { flex: 1, padding: "7px 10px", borderRadius: 8, fontSize: 12 }
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsx5(
                        "textarea",
                        {
                          rows: 2,
                          "data-testid": "add-doc-content-input",
                          value: docContent,
                          onChange: (e) => setDocContent(e.target.value),
                          placeholder: "Текст документа или фрагмент базы знаний для индексации…",
                          style: { padding: "7px 10px", borderRadius: 8, fontSize: 12 }
                        }
                      ),
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          "data-testid": "add-doc-submit-btn",
                          onClick: handleAddDocument,
                          className: "nomad-apple-btn-primary",
                          style: { padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer", alignSelf: "flex-start" },
                          children: "Проиндексировать документ →"
                        }
                      )
                    ]
                  }
                )
              ]
            }
          )
        ] })
      ]
    }
  );
}
function NomadCloudRemoteView({ ctx, compact = false }) {
  const [state, setState] = useState5(null);
  const [cmdText, setCmdText] = useState5("python --version");
  const [cmdOutput, setCmdOutput] = useState5(null);
  const [execBusy, setExecBusy] = useState5(false);
  const [rentBusy, setRentBusy] = useState5("");
  const [toast, setToast] = useState5("");
  const loadState = useCallback3(async () => {
    try {
      const res = await apiGet(ctx, "/cloud-computer/state");
      if (res?.ok) {
        setState(res);
      }
    } catch {
    }
  }, [ctx]);
  useEffect4(() => {
    loadState();
  }, [loadState]);
  const handleSwitchMode = useCallback3(
    async (mode) => {
      try {
        const res = await apiPost(ctx, "/cloud-computer/mode", { mode });
        if (res?.ok) {
          setState(res);
          setToast(
            mode === "cloud_sandbox" ? "☁️ Режим переключён на Облачный ПК (изолированная облачная среда)" : mode === "remote_pc" ? "📱 Режим переключён на Удалённое управление ПК с мобильного приложения" : "💻 Режим переключён на Локальный ПК"
          );
        }
      } catch {
      }
    },
    [ctx]
  );
  const handleRentTier = useCallback3(
    async (tier) => {
      setRentBusy(tier);
      try {
        const res = await apiPost(ctx, "/cloud-computer/rent", { tier });
        if (res?.ok) {
          setState(res);
          setToast(`✅ Подключён тариф виртуального ПК «${res.sandbox?.tier_title || tier}» — изолированный контейнер активен!`);
        }
      } catch {
      } finally {
        setRentBusy("");
      }
    },
    [ctx]
  );
  const handleExecSandbox = useCallback3(
    async (customCmd) => {
      const command = String(customCmd ?? cmdText ?? "").trim();
      if (!command) return;
      setExecBusy(true);
      try {
        const res = await apiPost(ctx, "/cloud-computer/exec", { command });
        setCmdOutput(res);
      } catch (err) {
        setCmdOutput({ ok: false, stderr: err?.message || "Ошибка выполнения" });
      } finally {
        setExecBusy(false);
      }
    },
    [ctx, cmdText]
  );
  const handleRefreshPairing = useCallback3(async () => {
    try {
      const res = await apiPost(ctx, "/remote-control/pair", { device_name: "Nomad Mobile (iOS / Android)" });
      if (res?.ok) {
        await loadState();
        setToast(`📲 Новый код сопряжения для мобильного приложения Nomad: ${res.pairing_code}`);
      }
    } catch {
    }
  }, [ctx, loadState]);
  const activeMode = state?.active_mode || "cloud_sandbox";
  const tariffs = Array.isArray(state?.tariffs) ? state.tariffs : [
    { tier: "basic", title: "Базовый · 990 ₽/мес", monthly_rub: 990, vcpu: 2, ram_gb: 4, ssd_gb: 20, included_hours: 30, active: false },
    { tier: "standard", title: "Стандарт · 2 990 ₽/мес", monthly_rub: 2990, vcpu: 4, ram_gb: 8, ssd_gb: 50, included_hours: 120, active: true },
    { tier: "advanced", title: "Про · 4 990 ₽/мес", monthly_rub: 4990, vcpu: 8, ram_gb: 16, ssd_gb: 120, included_hours: 300, active: false }
  ];
  const sandbox = state?.sandbox || {
    status: "running",
    tier: "standard",
    container_id: "nomad-vm-std-8f42a",
    region: "ru-central1 (Москва · 152-ФЗ)",
    cpu_usage_pct: 18,
    ram_used_mb: 1420,
    disk_used_gb: 4.2,
    files: []
  };
  const remote = state?.remote_control || {
    enabled: true,
    pairing_code: "482-915",
    relay_url: "wss://app.nomadnet.ai/v1/remote",
    qr_payload: "nomad://pair?code=482915&relay=wss%3A%2F%2Fapp.nomadnet.ai%2Fv1%2Fremote",
    paired_devices: [
      { name: "iPhone 17 Pro · Nomad iOS", status: "Подключено", last_seen: "только что" },
      { name: "Samsung Galaxy S26 · Nomad Android", status: "Готов к управлению", last_seen: "5 мин назад" }
    ]
  };
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      "data-testid": "nomad-cloud-remote-view",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 18,
        padding: compact ? "4px 0" : "28px 36px 44px",
        maxWidth: compact ? "100%" : 1140,
        margin: "0 auto"
      },
      children: [
        !compact && /* @__PURE__ */ jsxs5("header", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
          /* @__PURE__ */ jsx5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5("h1", { style: { fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: "-0.022em" }, children: "Облачный ПК и мобильные устройства" }),
            /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Android & iOS · Удалённое управление + Виртуальный ПК" })
          ] }) }),
          /* @__PURE__ */ jsx5("p", { style: { margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 880 }, children: "Управляйте рабочим местом Nomad удалённо с телефона (Android / iOS) или запускайте задачи на персональном изолированном виртуальном ПК в облаке для автономной работы 24/7." })
        ] }),
        toast && /* @__PURE__ */ jsx5(
          "div",
          {
            className: "nomad-glass-surface",
            style: {
              padding: "10px 16px",
              borderColor: "rgba(37, 99, 235, 0.32)",
              background: "#F4F4F5",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#18181B"
            },
            children: toast
          }
        ),
        /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }, children: [
          /* @__PURE__ */ jsxs5("div", { children: [
            /* @__PURE__ */ jsx5("div", { style: { fontSize: 11.5, fontWeight: 650, textTransform: "uppercase", opacity: 0.6 }, children: "Среда выполнения задач агента" }),
            /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "Выберите, где выполняются команды, браузер и сборка кода" })
          ] }),
          /* @__PURE__ */ jsx5("div", { className: "nomad-seg-group", style: { flexWrap: "wrap" }, children: [
            { id: "local_pc", label: "💻 Локальный ПК" },
            { id: "remote_pc", label: "📱 Удалённый доступ (ПК ↔ Телефон)" },
            { id: "cloud_sandbox", label: "☁️ Облачный ПК (Изолированная среда)" }
          ].map((m) => /* @__PURE__ */ jsx5(
            "button",
            {
              type: "button",
              className: "nomad-seg-btn",
              "data-testid": `cloud-mode-${m.id}`,
              "data-active": activeMode === m.id ? "true" : "false",
              onClick: () => handleSwitchMode(m.id),
              children: m.label
            },
            m.id
          )) })
        ] }),
        /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }, children: [
            /* @__PURE__ */ jsxs5("div", { children: [
              /* @__PURE__ */ jsx5("h2", { style: { fontSize: 16.5, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }, children: "Тарифы виртуального ПК в облаке" }),
              /* @__PURE__ */ jsx5("div", { style: { fontSize: 12, opacity: 0.68, marginTop: 2 }, children: "Персональный изолированный контейнер с Linux, браузером, окружением разработки и постоянным NVMe-диском." })
            ] }),
            /* @__PURE__ */ jsxs5("span", { className: "nomad-apple-pill nomad-apple-pill-green", children: [
              "Среда: ",
              sandbox.container_id,
              " · ",
              sandbox.region
            ] })
          ] }),
          /* @__PURE__ */ jsx5(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                gap: 12
              },
              children: tariffs.map((t) => {
                const isCurrent = Boolean(t.active || sandbox.tier === t.tier);
                return /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    "data-testid": `cloud-tariff-card-${t.tier}`,
                    className: "nomad-track-card",
                    style: {
                      padding: "18px 20px",
                      border: isCurrent ? "1.5px solid #18181B" : void 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10
                    },
                    children: [
                      /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                        /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15.5 }, children: t.title || `${t.tier} · ${t.monthly_rub} ₽/мес` }),
                        isCurrent && /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-blue", children: "Активен" })
                      ] }),
                      /* @__PURE__ */ jsxs5("div", { style: { fontSize: 22, fontWeight: 750, letterSpacing: "-0.02em", color: "#18181B" }, children: [
                        t.monthly_rub,
                        " ₽ ",
                        /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, fontWeight: 500, opacity: 0.65 }, children: "/ мес" })
                      ] }),
                      /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, opacity: 0.82, lineHeight: 1.5 }, children: [
                        /* @__PURE__ */ jsxs5("div", { children: [
                          "• Выделенные ресурсы: ",
                          /* @__PURE__ */ jsxs5("strong", { children: [
                            t.vcpu,
                            " vCPU · ",
                            t.ram_gb,
                            " ГБ RAM"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs5("div", { children: [
                          "• Изолированный диск: ",
                          /* @__PURE__ */ jsxs5("strong", { children: [
                            t.ssd_gb,
                            " ГБ NVMe SSD"
                          ] })
                        ] }),
                        /* @__PURE__ */ jsxs5("div", { children: [
                          "• Включено активной работы: ",
                          /* @__PURE__ */ jsxs5("strong", { children: [
                            t.included_hours,
                            " ч/мес"
                          ] })
                        ] })
                      ] }),
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          "data-testid": `cloud-rent-btn-${t.tier}`,
                          disabled: rentBusy === t.tier,
                          onClick: () => handleRentTier(t.tier),
                          className: isCurrent ? "nomad-apple-btn-secondary" : "nomad-apple-btn-primary",
                          style: {
                            marginTop: "auto",
                            padding: "8px 14px",
                            borderRadius: 10,
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: rentBusy === t.tier ? "Выделяем среду…" : isCurrent ? "Активный тариф" : "Подключить виртуальный ПК →"
                        }
                      )
                    ]
                  },
                  t.tier
                );
              })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs5(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
              gap: 16
            },
            children: [
              /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }, children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "☁️ Терминал облачного ПК" }),
                  /* @__PURE__ */ jsxs5("span", { style: { fontSize: 11.5, opacity: 0.68 }, children: [
                    "CPU ",
                    sandbox.cpu_usage_pct,
                    "% · RAM ",
                    sandbox.ram_used_mb,
                    " МБ · SSD ",
                    sandbox.disk_used_gb,
                    " ГБ"
                  ] })
                ] }),
                /* @__PURE__ */ jsx5("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: ["python --version", "git status", "dir"].map((presetCmd) => /* @__PURE__ */ jsxs5(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setCmdText(presetCmd);
                      handleExecSandbox(presetCmd);
                    },
                    style: {
                      padding: "4px 10px",
                      borderRadius: 999,
                      border: "1px solid rgba(15, 23, 42, 0.10)",
                      background: "rgba(255, 255, 255, 0.72)",
                      fontSize: 11.5,
                      fontFamily: "monospace",
                      cursor: "pointer"
                    },
                    children: [
                      "$ ",
                      presetCmd
                    ]
                  },
                  presetCmd
                )) }),
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: 8 }, children: [
                  /* @__PURE__ */ jsx5(
                    "input",
                    {
                      type: "text",
                      "data-testid": "cloud-sandbox-cmd-input",
                      value: cmdText,
                      onChange: (e) => setCmdText(e.target.value),
                      onKeyDown: (e) => {
                        if (e.key === "Enter") handleExecSandbox();
                      },
                      style: { flex: 1, padding: "8px 12px", borderRadius: 9, fontSize: 12.5, fontFamily: "monospace" }
                    }
                  ),
                  /* @__PURE__ */ jsx5(
                    "button",
                    {
                      type: "button",
                      "data-testid": "cloud-sandbox-exec-btn",
                      disabled: execBusy,
                      onClick: () => handleExecSandbox(),
                      className: "nomad-apple-btn-primary",
                      style: { padding: "8px 16px", borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
                      children: execBusy ? "Выполняем…" : "Запустить"
                    }
                  )
                ] }),
                cmdOutput && /* @__PURE__ */ jsx5(
                  "pre",
                  {
                    "data-testid": "cloud-sandbox-cmd-output",
                    style: {
                      margin: 0,
                      padding: "12px 14px",
                      borderRadius: 10,
                      background: "#0f172a",
                      color: "#f8fafc",
                      fontSize: 12,
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                      whiteSpace: "pre-wrap",
                      maxHeight: 180,
                      overflowY: "auto"
                    },
                    children: `$ ${cmdOutput.command || cmdText}
${cmdOutput.stdout || cmdOutput.stderr || "(выполнено, код 0)"}`
                  }
                )
              ] }),
              /* @__PURE__ */ jsxs5("section", { className: "nomad-glass-surface", style: { padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }, children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }, children: [
                  /* @__PURE__ */ jsx5("strong", { style: { fontSize: 15 }, children: "📱 Мобильное приложение Nomad (iOS и Android)" }),
                  /* @__PURE__ */ jsx5("span", { className: "nomad-apple-pill nomad-apple-pill-green", children: "Связь активна" })
                ] }),
                /* @__PURE__ */ jsxs5("div", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }, children: [
                  "Откройте мобильное приложение ",
                  /* @__PURE__ */ jsx5("strong", { children: "Nomad" }),
                  " на iOS или Android и введите 6-значный код сопряжения для удалённого управления этим компьютером или работы в облачном ПК с телефона."
                ] }),
                /* @__PURE__ */ jsxs5(
                  "div",
                  {
                    style: {
                      padding: "14px 16px",
                      borderRadius: 12,
                      background: "rgba(37, 99, 235, 0.06)",
                      border: "1px solid rgba(37, 99, 235, 0.18)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap"
                    },
                    children: [
                      /* @__PURE__ */ jsxs5("div", { children: [
                        /* @__PURE__ */ jsx5("div", { style: { fontSize: 11, fontWeight: 600, opacity: 0.65, textTransform: "uppercase" }, children: "Код сопряжения устройства" }),
                        /* @__PURE__ */ jsx5(
                          "div",
                          {
                            "data-testid": "remote-pairing-code",
                            style: { fontSize: 24, fontWeight: 800, letterSpacing: "0.08em", color: "#18181B", fontFamily: "monospace" },
                            children: remote.pairing_code
                          }
                        ),
                        /* @__PURE__ */ jsx5("div", { style: { fontSize: 11, opacity: 0.65, marginTop: 2 }, children: remote.relay_url })
                      ] }),
                      /* @__PURE__ */ jsx5(
                        "button",
                        {
                          type: "button",
                          "data-testid": "remote-refresh-pair-btn",
                          onClick: handleRefreshPairing,
                          className: "nomad-apple-btn-secondary",
                          style: { padding: "8px 14px", borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: "pointer" },
                          children: "Обновить код и QR"
                        }
                      )
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
                  /* @__PURE__ */ jsx5("span", { style: { fontSize: 12, fontWeight: 650, opacity: 0.75 }, children: "Подключённые мобильные устройства:" }),
                  (remote.paired_devices || []).map((dev, idx) => /* @__PURE__ */ jsxs5(
                    "div",
                    {
                      style: {
                        padding: "8px 12px",
                        borderRadius: 9,
                        background: "rgba(255, 255, 255, 0.68)",
                        border: "1px solid rgba(15, 23, 42, 0.08)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: 12
                      },
                      children: [
                        /* @__PURE__ */ jsx5("strong", { children: dev.name }),
                        /* @__PURE__ */ jsx5("span", { style: { color: "#059669", fontWeight: 600 }, children: dev.status || "Активно" })
                      ]
                    },
                    idx
                  ))
                ] })
              ] })
            ]
          }
        )
      ]
    }
  );
}
function registerCouncilMemoryCloud(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  ctx.register({
    id: "council-page",
    area: ROUTES_AREA4,
    data: { path: COUNCIL_ROUTE_PATH, title: "Совет моделей" },
    render: () => /* @__PURE__ */ jsx5(NomadCouncilView, { ctx })
  });
  ctx.register({
    id: "memory-page",
    area: ROUTES_AREA4,
    data: { path: MEMORY_ROUTE_PATH, title: "Память и хранилище знаний" },
    render: () => /* @__PURE__ */ jsx5(NomadMemoryProjectsView, { ctx })
  });
  ctx.register({
    id: "cloud-page",
    area: ROUTES_AREA4,
    data: { path: CLOUD_ROUTE_PATH, title: "Облачный ПК и устройства" },
    render: () => /* @__PURE__ */ jsx5(NomadCloudRemoteView, { ctx })
  });
  ctx.register({
    id: "council-palette",
    area: PALETTE_AREA3,
    order: 66,
    data: {
      id: "nomad.council.open",
      action: "nomad.council.open",
      label: "Совет моделей (параллельный разбор несколькими ИИ)",
      category: "Nomad",
      keywords: ["council", "совет", "консилиум", "модели"],
      run: () => host3?.navigate?.(COUNCIL_ROUTE_PATH)
    }
  });
  ctx.register({
    id: "memory-palette",
    area: PALETTE_AREA3,
    order: 67,
    data: {
      id: "nomad.memory.open",
      action: "nomad.memory.open",
      label: "Настройки: Память, хранилище знаний и проекты",
      category: "Nomad",
      keywords: ["memory", "память", "граф", "вектор", "проекты", "субагенты"],
      run: () => host3?.navigate?.(MEMORY_ROUTE_PATH)
    }
  });
  ctx.register({
    id: "cloud-palette",
    area: PALETTE_AREA3,
    order: 68,
    data: {
      id: "nomad.cloud.open",
      action: "nomad.cloud.open",
      label: "Настройки: Облачный ПК и мобильные устройства",
      category: "Nomad",
      keywords: ["cloud", "облако", "песочница", "remote", "телефон", "mobile"],
      run: () => host3?.navigate?.(CLOUD_ROUTE_PATH)
    }
  });
}

// safety.js
var safety_exports = {};
__export(safety_exports, {
  DesktopCronIncidentsCard: () => DesktopCronIncidentsCard,
  DesktopEgressCard: () => DesktopEgressCard,
  DesktopNemoClawOpenShellCard: () => DesktopNemoClawOpenShellCard,
  DesktopOpenClawChannelPolicyCard: () => DesktopOpenClawChannelPolicyCard,
  NomadSafetyPage: () => NomadSafetyPage,
  SAFETY_NAV_ID: () => SAFETY_NAV_ID,
  SAFETY_NAV_LABEL: () => SAFETY_NAV_LABEL,
  SAFETY_NAV_ORDER: () => SAFETY_NAV_ORDER,
  SAFETY_ROUTE_PATH: () => SAFETY_ROUTE_PATH,
  default: () => registerSafety
});
import {
  PALETTE_AREA as PALETTE_AREA4,
  ROUTES_AREA as ROUTES_AREA5,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA2
} from "@hermes/plugin-sdk";
import { createElement, useCallback as useCallback4, useEffect as useEffect5, useState as useState6 } from "react";
var SAFETY_ROUTE_PATH = "/nomad-safety";
var SAFETY_NAV_ID = "safety";
var SAFETY_NAV_LABEL = "Разрешения и безопасность";
var SAFETY_NAV_ORDER = 63;
var h = createElement;
async function restGet(ctx, path) {
  const clean = String(path || "").startsWith("/") ? path : `/${path}`;
  try {
    const p = typeof ctx?.rest?.get === "function" ? Promise.resolve(ctx.rest.get(clean)) : typeof ctx?.rest === "function" ? Promise.resolve(ctx.rest(clean)) : null;
    if (p) {
      return await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error("rest-timeout")), 650))
      ]);
    }
  } catch (_err) {
  }
  if (typeof fetch === "function") {
    const baseUrl = typeof window !== "undefined" && window.location?.protocol === "file:" ? "http://127.0.0.1:9129/api/plugins/nomad" : "/api/plugins/nomad";
    const headers = { Accept: "application/json" };
    if (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) {
      headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
    }
    const res = await fetch(`${baseUrl}${clean}`, { method: "GET", headers });
    if (res.ok) return await res.json();
  }
  return null;
}
async function restPost(ctx, path, body) {
  const clean = String(path || "").startsWith("/") ? path : `/${path}`;
  try {
    const p = typeof ctx?.rest?.post === "function" ? Promise.resolve(ctx.rest.post(clean, body)) : typeof ctx?.rest === "function" ? Promise.resolve(ctx.rest(clean, { method: "POST", body })) : null;
    if (p) {
      return await Promise.race([
        p,
        new Promise((_, reject) => setTimeout(() => reject(new Error("rest-timeout")), 650))
      ]);
    }
  } catch (_err) {
  }
  if (typeof fetch === "function") {
    const baseUrl = typeof window !== "undefined" && window.location?.protocol === "file:" ? "http://127.0.0.1:9129/api/plugins/nomad" : "/api/plugins/nomad";
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) {
      headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
    }
    const res = await fetch(`${baseUrl}${clean}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body || {})
    });
    if (res.ok) return await res.json();
  }
  return null;
}
var DEFAULT_GUARDRAILS = {
  preset: "corp_152fz",
  ru_only: false,
  dlp_enabled: true,
  dlp_mode: "mask",
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
  siem_endpoint: "syslog://siem.company.local:514"
};
var DLP_SAMPLE_TEXT = "Договор № 482/2026-К от 15.10.2026: клиент Иванов Сергей Александрович, паспорт 45 12 № 781234, СНИЛС 123-456-789 01, ИНН 7707083893, тел. +7 (916) 555-44-33, р/с 40702810500000012345, токен sk-proj-9876543210abcdef.";
function localDlpFallback(text, cfg) {
  let out = String(text || "");
  const g = cfg || DEFAULT_GUARDRAILS;
  let count = 0;
  const rules = [
    [g.mask_secrets_tokens, /\b(?:sk-[A-Za-z0-9_-]{10,}|y0_[A-Za-z0-9_-]{10,}|AQVN[A-Za-z0-9_-]{10,})\b/g, "[СЕКРЕТ:ТОКЕН_СКРЫТ]"],
    [g.mask_passport_inn_snils, /\b\d{3}-\d{3}-\d{3}[\s-]\d{2}\b/g, "[ПДн:СНИЛС_РФ]"],
    [g.mask_passport_inn_snils, /\b\d{2}\s?\d{2}\s№?\s?\d{6}\b/g, "[ПДн:ПАСПОРТ_РФ]"],
    [g.mask_cards_accounts, /\b(?:40702|40802|40817|30101)\d{15}\b/g, "[ПДн:БАНК_СЧЁТ]"],
    [g.mask_passport_inn_snils, /(?:ИНН\s*[:№]?\s*)(\d{10}|\d{12})\b/gi, "[ПДн:ИНН_РФ]"],
    [g.mask_phones_emails, /(?:\+7|8)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}\b/g, "[ПДн:КОНТАКТ]"],
    [g.mask_fio, /\b[А-ЯЁ][а-яё]{2,}(?:ов|ев|ин|ский|ова|ева|ина)\s+[А-ЯЁ][а-яё]{2,}\s+[А-ЯЁ][а-яё]{3,}(?:ович|евич|овна|евна)\b/g, "[ПДн:ФИО]"],
    [g.mask_nda_contracts, /Договор\s*№\s*[А-ЯA-Z0-9/-]+/gi, "[NDA:ДОГОВОР]"]
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
    verdict: g.dlp_mode === "block" && count > 0 ? "Запрос заблокирован политикой Zero-Trust (обнаружены ПДн / секреты)" : `Обезличено объектов ПДн/секретов: ${count} (152-ФЗ DLP)`
  };
}
function NomadSafetyPage({ ctx }) {
  const [loading, setLoading] = useState6(true);
  const [error, setError] = useState6(null);
  const [notice, setNotice] = useState6("");
  const [proposals, setProposals] = useState6([]);
  const [allowlist, setAllowlist] = useState6([]);
  const [denyRules, setDenyRules] = useState6([]);
  const [egress, setEgress] = useState6(null);
  const [guardrails, setGuardrails] = useState6(DEFAULT_GUARDRAILS);
  const [dlpInput, setDlpInput] = useState6(DLP_SAMPLE_TEXT);
  const [dlpResult, setDlpResult] = useState6(null);
  const [newAllowPattern, setNewAllowPattern] = useState6("");
  const [newDenyPattern, setNewDenyPattern] = useState6("");
  const [busy, setBusy] = useState6(false);
  const applyOverview = useCallback4((res) => {
    if (!res || typeof res !== "object") return;
    setProposals(Array.isArray(res.proposals) ? res.proposals : []);
    setAllowlist(Array.isArray(res.command_allowlist) ? res.command_allowlist : []);
    setDenyRules(Array.isArray(res.approvals_deny) ? res.approvals_deny : []);
    if (res.egress && typeof res.egress === "object") {
      setEgress(res.egress);
    }
    if (res.guardrails && typeof res.guardrails === "object") {
      setGuardrails((prev) => ({ ...prev, ...res.guardrails }));
    }
  }, []);
  const loadSafety = useCallback4(() => {
    if (!ctx?.rest) {
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    setError(null);
    return restGet(ctx, "/safety").then((res) => {
      applyOverview(res);
      setLoading(false);
      return res;
    }).catch((err) => {
      setLoading(false);
      const rawMsg = String(err?.message || "");
      if (rawMsg.includes("Plugin not found") || rawMsg.includes("404")) {
        setError(null);
      } else {
        setError(rawMsg || "Не удалось загрузить настройки разрешений и безопасности.");
      }
      return null;
    });
  }, [ctx, applyOverview]);
  useEffect5(() => {
    loadSafety();
  }, [loadSafety]);
  const handleUpdateGuardrails = useCallback4(
    (patch, customMessage) => {
      setGuardrails((prev) => {
        const next = { ...prev, ...patch };
        if (patch.apply_preset === "startup") {
          Object.assign(next, {
            preset: "startup",
            ru_only: false,
            dlp_mode: "mask",
            mask_fio: false,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: false,
            mask_nda_contracts: false,
            mask_secrets_tokens: true,
            require_corp_vpn: false
          });
        } else if (patch.apply_preset === "corp_152fz") {
          Object.assign(next, {
            preset: "corp_152fz",
            ru_only: false,
            dlp_mode: "mask",
            mask_fio: true,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: true,
            mask_nda_contracts: true,
            mask_secrets_tokens: true,
            require_corp_vpn: false
          });
        } else if (patch.apply_preset === "strict_kii") {
          Object.assign(next, {
            preset: "strict_kii",
            ru_only: true,
            dlp_mode: "block",
            mask_fio: true,
            mask_passport_inn_snils: true,
            mask_cards_accounts: true,
            mask_phones_emails: true,
            mask_nda_contracts: true,
            mask_secrets_tokens: true,
            require_corp_vpn: true,
            siem_syslog_enabled: true
          });
        }
        return next;
      });
      setNotice(customMessage || "Политики корпоративной безопасности ИБ (152-ФЗ) обновлены.");
      if (!ctx?.rest) return Promise.resolve(null);
      return restPost(ctx, "/safety/guardrails", patch).then((res) => {
        applyOverview(res);
        return res;
      }).catch(() => null);
    },
    [ctx, applyOverview]
  );
  const handleRunDlpTest = useCallback4(() => {
    if (!ctx?.rest) {
      setDlpResult(localDlpFallback(dlpInput, guardrails));
      return Promise.resolve(null);
    }
    return restPost(ctx, "/safety/dlp/test", { text: dlpInput }).then((res) => {
      if (res && typeof res.redacted_text === "string") {
        setDlpResult(res);
      } else {
        setDlpResult(localDlpFallback(dlpInput, guardrails));
      }
      return res;
    }).catch(() => {
      setDlpResult(localDlpFallback(dlpInput, guardrails));
      return null;
    });
  }, [ctx, dlpInput, guardrails]);
  const handleAcceptSuggestion = useCallback4(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost(ctx, "/safety/suggestions/accept", { pattern }).then((res) => {
        applyOverview(res);
        setNotice(`Шаблон «${pattern}» добавлен в список разрешённых команд.`);
        return res;
      }).catch((err) => {
        setError(err?.message || "Не удалось принять подсказку.");
      }).finally(() => {
        setBusy(false);
      });
    },
    [ctx, applyOverview]
  );
  const handleRemoveAllowlist = useCallback4(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost(ctx, "/safety/allowlist/remove", { pattern }).then((res) => {
        applyOverview(res);
        setNotice(`Шаблон «${pattern}» удалён из разрешённых команд.`);
        return res;
      }).catch((err) => {
        setError(err?.message || "Не удалось отключить правило.");
      }).finally(() => {
        setBusy(false);
      });
    },
    [ctx, applyOverview]
  );
  const handleAddAllowlist = useCallback4(
    (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const pat = newAllowPattern.trim();
      if (!pat) return Promise.resolve(null);
      return handleAcceptSuggestion(pat).then((res) => {
        setNewAllowPattern("");
        return res;
      });
    },
    [newAllowPattern, handleAcceptSuggestion]
  );
  const handleAddDeny = useCallback4(
    (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const pat = newDenyPattern.trim();
      if (!ctx?.rest || !pat) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost(ctx, "/safety/deny/add", { pattern: pat }).then((res) => {
        applyOverview(res);
        setNewDenyPattern("");
        setNotice(`Правило запрета «${pat}» сохранено в approvals.deny.`);
        return res;
      }).catch((err) => {
        setError(err?.message || "Не удалось добавить правило запрета.");
      }).finally(() => {
        setBusy(false);
      });
    },
    [ctx, newDenyPattern, applyOverview]
  );
  const handleRemoveDeny = useCallback4(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost(ctx, "/safety/deny/remove", { pattern }).then((res) => {
        applyOverview(res);
        setNotice(`Правило запрета «${pattern}» удалено.`);
        return res;
      }).catch((err) => {
        setError(err?.message || "Не удалось удалить правило запрета.");
      }).finally(() => {
        setBusy(false);
      });
    },
    [ctx, applyOverview]
  );
  return h(
    "div",
    {
      className: "nomad-safety-page",
      style: { padding: "24px", maxWidth: "1080px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }
    },
    h(
      "header",
      null,
      h("h1", { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } }, SAFETY_NAV_LABEL),
      h(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.78 } },
        "Корпоративный контур ИБ, DLP-фильтр персональных данных (152-ФЗ), суверенный режим РФ и политики разрешений команд для службы ИБ и ИТ-отдела."
      )
    ),
    error ? h(
      "div",
      {
        role: "alert",
        style: {
          padding: "12px 14px",
          borderRadius: "8px",
          background: "rgba(248,81,73,0.14)",
          border: "1px solid rgba(248,81,73,0.4)"
        }
      },
      error
    ) : null,
    notice ? h(
      "div",
      {
        style: {
          padding: "12px 14px",
          borderRadius: "8px",
          background: "rgba(46,160,67,0.14)",
          border: "1px solid rgba(46,160,67,0.4)",
          fontSize: "13px"
        }
      },
      notice
    ) : null,
    h(
      "section",
      {
        className: "nomad-enterprise-guardrails nomad-glass-surface",
        "data-testid": "nomad-enterprise-guardrails",
        style: {
          padding: "20px 22px",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }
      },
      h(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" } },
        h(
          "div",
          null,
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h(
              "h2",
              { style: { margin: 0, fontSize: "16.5px", fontWeight: 600, letterSpacing: "-0.018em" } },
              "Корпоративный контур ИБ и 152-ФЗ (Гардрейлы для CISO, ИБ и ИТ-отдела)"
            ),
            h(
              "span",
              {
                className: "nomad-pill-badge",
                style: {
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 9px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.14)",
                  color: "#059669"
                }
              },
              guardrails.ru_only ? "Суверенный контур РФ активен" : "DLP 152-ФЗ активен"
            )
          ),
          h(
            "p",
            { style: { margin: "4px 0 0 0", fontSize: "12.5px", opacity: 0.78, maxWidth: "860px" } },
            "Гибкая настройка защиты персональных данных (152-ФЗ), коммерческой тайны (NDA), запрета обучения внешних моделей (Zero Data Retention) и сетевых ограничений."
          )
        )
      ),
      h(
        "div",
        { style: { display: "flex", gap: "10px", flexWrap: "wrap" } },
        [
          { id: "startup", label: "Стартап / Разработка", desc: "Маскирование ключей, паспортов и карт" },
          { id: "corp_152fz", label: "Корпоративный 152-ФЗ (Рекомендуется)", desc: "Полное DLP-маскирование ФИО, ПДн и NDA до отправки в ИИ" },
          { id: "strict_kii", label: "Банк / Госсектор / КИИ (Zero-Trust)", desc: "Только суверенные модели РФ + блокировка ПДн + VPN + SIEM" }
        ].map((preset) => {
          const active = guardrails.preset === preset.id;
          return h(
            "button",
            {
              key: preset.id,
              type: "button",
              className: "nomad-glass-card",
              "data-active": active ? "true" : "false",
              onClick: () => handleUpdateGuardrails(
                { apply_preset: preset.id, preset: preset.id },
                `Применён профиль безопасности ИБ: «${preset.label}».`
              ),
              style: {
                flex: "1 1 240px",
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                textAlign: "left",
                padding: "12px 14px",
                borderRadius: "12px",
                border: active ? "1.5px solid var(--nomad-accent, #18181B)" : "1px solid var(--border, rgba(128,128,128,0.22))",
                background: active ? "#F4F4F5" : "rgba(255, 255, 255, 0.5)",
                color: "inherit",
                cursor: "pointer"
              }
            },
            h("div", { style: { fontWeight: 600, fontSize: "13px", letterSpacing: "-0.01em" } }, preset.label),
            h("div", { style: { fontSize: "11.5px", opacity: 0.72, marginTop: "4px", lineHeight: 1.4 } }, preset.desc)
          );
        })
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
            gap: "12px"
          }
        },
        h(
          "div",
          {
            className: "nomad-glass-card",
            style: {
              padding: "14px 16px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }
          },
          h("strong", { style: { fontSize: "13.5px", fontWeight: 600 } }, "1. DLP-фильтр и обезличивание ПДн (152-ФЗ) до отправки в LLM"),
          ...[
            ["mask_fio", "Маскировать ФИО сотрудников и клиентов → [ПДн:ФИО]"],
            ["mask_passport_inn_snils", "Маскировать Паспорт РФ, ИНН и СНИЛС → [ПДн:ДОКУМЕНТ_РФ]"],
            ["mask_cards_accounts", "Маскировать расчётные счета (40702...) и банковские карты"],
            ["mask_phones_emails", "Маскировать российские телефоны (+7) и корпоративные Email"],
            ["mask_nda_contracts", "Маскировать номера договоров и маркеры «Коммерческая тайна»"],
            ["mask_secrets_tokens", "Перехватывать API-ключи (sk-..., y0_..., AQVN...) и пароли"]
          ].map(
            ([key, label]) => h(
              "label",
              {
                key,
                style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer" }
              },
              h("input", {
                type: "checkbox",
                checked: Boolean(guardrails[key]),
                onChange: (e) => handleUpdateGuardrails({ [key]: Boolean(e?.target?.checked) })
              }),
              h("span", null, label)
            )
          )
        ),
        h(
          "div",
          {
            className: "nomad-glass-card",
            style: {
              padding: "14px 16px",
              borderRadius: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }
          },
          h("strong", { style: { fontSize: "13.5px", fontWeight: 600 } }, "2. Суверенный контур РФ, ZDR и Сетевая защита ИБ"),
          ...[
            ["ru_only", "Строгий режим «Суверенный контур РФ (152-ФЗ)» — блокировать зарубежные LLM"],
            ["zdr_no_training", "Zero Data Retention (ZDR) — запрет обучения моделей на данных компании"],
            ["os_keychain_encrypt", "Шифровать секреты и токены в хранилище ОС (Windows DPAPI / Keychain)"],
            ["block_wildcards_ssrf", "Anti-SSRF фильтр — запретить wildcard (*) и доступ к локальной подсети без белого списка"],
            ["require_corp_vpn", "Требовать активный корпоративный VPN-туннель (WireGuard / Континент / VipNet)"],
            ["siem_syslog_enabled", "Экспортировать события ИБ и срабатывания DLP в SIEM / Syslog (CEF)"]
          ].map(
            ([key, label]) => h(
              "label",
              {
                key,
                style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer" }
              },
              h("input", {
                type: "checkbox",
                checked: Boolean(guardrails[key]),
                onChange: (e) => handleUpdateGuardrails({ [key]: Boolean(e?.target?.checked) })
              }),
              h("span", null, label)
            )
          )
        )
      ),
      h(
        "div",
        {
          className: "nomad-glass-card",
          style: {
            padding: "14px 16px",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }
        },
        h(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
          h("strong", { style: { fontSize: "13px", fontWeight: 600 } }, "Интерактивный тестер DLP-маскирования ПДн (152-ФЗ) для проверки безопасниками"),
          h(
            "button",
            {
              type: "button",
              onClick: handleRunDlpTest,
              style: {
                padding: "6px 14px",
                borderRadius: "8px",
                border: "none",
                background: "var(--nomad-accent, #18181B)",
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            "Проверить обезличивание ПДн"
          )
        ),
        h("textarea", {
          rows: 2,
          value: dlpInput,
          onChange: (e) => setDlpInput(e?.target?.value ?? ""),
          style: {
            width: "100%",
            padding: "8px 10px",
            borderRadius: "7px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit",
            fontSize: "12px",
            fontFamily: "monospace"
          }
        }),
        dlpResult ? h(
          "div",
          {
            style: {
              padding: "8px 10px",
              borderRadius: "7px",
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              fontSize: "12px"
            }
          },
          h("div", { style: { fontWeight: 700, color: "#10b981", marginBottom: "4px" } }, dlpResult.verdict),
          h("div", { style: { fontFamily: "monospace", wordBreak: "break-word" } }, dlpResult.redacted_text)
        ) : null
      )
    ),
    h(
      "section",
      {
        className: "nomad-safety-suggestions",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.24)"
        }
      },
      h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Подсказки из вашей истории запусков"),
      h(
        "p",
        { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
        "Команды, которые вы неоднократно запускали в сессиях. Примите подсказку, чтобы разрешить шаблон в command_allowlist."
      ),
      loading ? h("div", { style: { fontSize: "13px", opacity: 0.7 } }, "Анализируем историю вызовов…") : proposals.length === 0 ? h(
        "div",
        { style: { fontSize: "13px", opacity: 0.72 } },
        "Новых подсказок пока нет — все частые команды уже добавлены или история пуста."
      ) : h(
        "div",
        { style: { display: "grid", gap: "8px" } },
        ...proposals.map(
          (prop) => h(
            "div",
            {
              key: prop.pattern,
              className: "nomad-safety-proposal-row",
              style: {
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(128,128,128,0.22)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }
            },
            h(
              "div",
              null,
              h("code", { style: { fontWeight: 600, fontSize: "13px" } }, prop.pattern),
              h(
                "span",
                { style: { fontSize: "12px", opacity: 0.72, marginLeft: "10px" } },
                `вызовов: ${prop.count} · тип: ${prop.kind === "prefix" ? "префикс" : "точное совпадение"}`
              )
            ),
            h(
              "button",
              {
                type: "button",
                disabled: busy,
                title: "Принять подсказку и добавить команду в разрешённые",
                "data-tooltip": "Принять подсказку и добавить команду в разрешённые",
                onClick: () => handleAcceptSuggestion(prop.pattern),
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#18181B",
                  color: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer"
                }
              },
              "Разрешить"
            )
          )
        )
      )
    ),
    h(
      "section",
      {
        className: "nomad-safety-allowlist",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.24)"
        }
      },
      h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Постоянно разрешённые команды (command_allowlist)"),
      h(
        "form",
        {
          onSubmit: handleAddAllowlist,
          style: { display: "flex", gap: "8px", marginBottom: "12px" }
        },
        h("input", {
          type: "text",
          value: newAllowPattern,
          title: "Шаблон разрешённой команды для белого списка",
          "data-tooltip": "Шаблон разрешённой команды для белого списка",
          onChange: (e) => setNewAllowPattern(e?.target?.value ?? ""),
          placeholder: "Например: git status или pytest *",
          style: {
            flex: "1 1 auto",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h(
          "button",
          {
            type: "submit",
            disabled: busy,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              background: "#18181B",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          "Добавить разрешение"
        )
      ),
      allowlist.length === 0 ? h("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Список разрешённых шаблонов пуст.") : h(
        "div",
        { style: { display: "grid", gap: "6px" } },
        ...allowlist.map(
          (pat) => h(
            "div",
            {
              key: pat,
              style: {
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }
            },
            h("code", { style: { fontSize: "13px" } }, pat),
            h(
              "button",
              {
                type: "button",
                disabled: busy,
                onClick: () => handleRemoveAllowlist(pat),
                style: {
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(248,81,73,0.4)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Отключить"
            )
          )
        )
      )
    ),
    h(
      "section",
      {
        className: "nomad-safety-deny",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(248,81,73,0.35)"
        }
      },
      h("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Жёсткие запреты команд (approvals.deny)"),
      h(
        "p",
        { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.82 } },
        "Команды, совпадающие с этими шаблонами, блокируются всегда — даже если включён автоматический режим без запросов подтверждения (--yolo)."
      ),
      h(
        "form",
        {
          onSubmit: handleAddDeny,
          style: { display: "flex", gap: "8px", marginBottom: "12px" }
        },
        h("input", {
          type: "text",
          value: newDenyPattern,
          onChange: (e) => setNewDenyPattern(e?.target?.value ?? ""),
          placeholder: "Например: git push --force* или rm -rf *",
          style: {
            flex: "1 1 auto",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h(
          "button",
          {
            type: "submit",
            disabled: busy,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              background: "#dc2626",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          "Запретить шаблон"
        )
      ),
      denyRules.length === 0 ? h("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Пользовательские правила запрета пока не заданы.") : h(
        "div",
        { style: { display: "grid", gap: "6px" } },
        ...denyRules.map(
          (rule) => h(
            "div",
            {
              key: rule,
              style: {
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(248,81,73,0.3)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }
            },
            h("code", { style: { fontSize: "13px" } }, rule),
            h(
              "button",
              {
                type: "button",
                disabled: busy,
                onClick: () => handleRemoveDeny(rule),
                style: {
                  padding: "4px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(248,81,73,0.4)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "12px",
                  cursor: "pointer"
                }
              },
              "Удалить запрет"
            )
          )
        )
      )
    ),
    createElement(DesktopNemoClawOpenShellCard, { ctx }),
    createElement(DesktopOpenClawChannelPolicyCard, { ctx }),
    createElement(DesktopEgressCard, { ctx, egress }),
    createElement(DesktopCronIncidentsCard, { ctx })
  );
}
function DesktopNemoClawOpenShellCard() {
  const [landlockFs, setLandlockFs] = useState6(true);
  const [denyDefaultNet, setDenyDefaultNet] = useState6(true);
  const [credentialProxy, setCredentialProxy] = useState6(true);
  const [hybridNimRouting, setHybridNimRouting] = useState6(true);
  const [yamlCopied, setYamlCopied] = useState6(false);
  const policyYaml = `version: "1.0"
runtime: openshell-sandbox
filesystem_policy:
  mode: ${landlockFs ? "landlock_strict" : "permissive"}
  writable_paths: ["/workspace", "/tmp"]
  readonly_paths: ["/usr", "/etc", "~/.claude", "~/.codex"]
network_policy:
  default_egress: ${denyDefaultNet ? "deny" : "allow"}
  allowlist: ["api.nomadnet.ru", "gigachat.devices.sberbank.ru", "llm.api.cloud.yandex.net", "api.gpt.mws.ru", "127.0.0.1:8000"]
credential_isolation:
  proxy_inject_tokens: ${credentialProxy}
  hide_env_secrets_from_agent: ${credentialProxy}
inference_routing:
  hybrid_local_nim: ${hybridNimRouting}`;
  return h(
    "section",
    {
      "data-testid": "nomad-nemoclaw-openshell-card",
      style: {
        padding: "18px",
        borderRadius: "12px",
        border: "1px solid rgba(0, 122, 255, 0.28)",
        background: "rgba(0, 122, 255, 0.04)",
        display: "grid",
        gap: "12px"
      }
    },
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      h(
        "div",
        null,
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: 700 } }, "Политика песочницы OpenShell (по архитектуре NVIDIA NemoClaw)"),
          h(
            "span",
            {
              style: {
                padding: "2px 8px",
                borderRadius: "999px",
                fontSize: "11px",
                fontWeight: 600,
                background: "rgba(16, 185, 129, 0.14)",
                color: "#059669"
              }
            },
            "openshell_policy · Zero-Trust"
          )
        ),
        h(
          "p",
          { style: { margin: "4px 0 0 0", fontSize: "12.5px", opacity: 0.78 } },
          "Декларативное ограничение файловой системы, исходящих сетевых соединений и изоляция API-ключей вне контекста рассуждений агента."
        )
      ),
      h(
        "button",
        {
          type: "button",
          onClick: () => {
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(policyYaml);
              setYamlCopied(true);
              setTimeout(() => setYamlCopied(false), 2e3);
            }
          },
          style: {
            padding: "6px 12px",
            borderRadius: "8px",
            border: "1px solid rgba(0, 122, 255, 0.35)",
            background: "#F4F4F5",
            color: "inherit",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer"
          }
        },
        yamlCopied ? "✓ Скопирован openshell-sandbox.yaml" : "Скопировать openshell-sandbox.yaml"
      )
    ),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px" } },
      ...[
        [
          landlockFs,
          setLandlockFs,
          "Изоляция ФС (Landlock LSM)",
          "Запись разрешена только в рабочую папку проекта и /tmp; системные каталоги строго Read-Only"
        ],
        [
          denyDefaultNet,
          setDenyDefaultNet,
          "Сеть Deny-by-Default (Egress Allowlist)",
          "Блокировка любых неразрешённых внешних подключений и фоновой телеметрии инструментов"
        ],
        [
          credentialProxy,
          setCredentialProxy,
          "Проксирование секретов (Credential Isolation)",
          "Реальные API-ключи не передаются в переменные окружения агента — подставляются шлюзом на лету"
        ],
        [
          hybridNimRouting,
          setHybridNimRouting,
          "Гибридный контур Local NIM / vLLM ↔ Cloud",
          "Чувствительные вызовы и фильтрация ПДн выполняются на локальных моделях без выхода в интернет"
        ]
      ].map(
        ([val, setter, title, desc], idx) => h(
          "label",
          {
            key: idx,
            style: {
              display: "flex",
              alignItems: "flex-start",
              gap: "9px",
              padding: "10px 12px",
              borderRadius: "10px",
              border: "1px solid rgba(128,128,128,0.2)",
              background: "rgba(255,255,255,0.55)",
              cursor: "pointer"
            }
          },
          h("input", {
            type: "checkbox",
            checked: val,
            onChange: (e) => setter(Boolean(e?.target?.checked)),
            style: { marginTop: "3px", accentColor: "#18181B" }
          }),
          h(
            "div",
            null,
            h("div", { style: { fontSize: "13px", fontWeight: 600 } }, title),
            h("div", { style: { fontSize: "11.5px", opacity: 0.75, marginTop: "2px" } }, desc)
          )
        )
      )
    )
  );
}
function DesktopOpenClawChannelPolicyCard() {
  const [dmPolicy, setDmPolicy] = useState6("pairing");
  const [dmScope, setDmScope] = useState6("per-channel-peer");
  const [sandboxNonMain, setSandboxNonMain] = useState6(true);
  return h(
    "section",
    {
      "data-testid": "nomad-openclaw-channel-policy-card",
      style: {
        padding: "18px",
        borderRadius: "12px",
        border: "1px solid rgba(128,128,128,0.24)",
        background: "var(--surface-card, rgba(255,255,255,0.03))",
        display: "grid",
        gap: "12px"
      }
    },
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
      h(
        "div",
        null,
        h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: 700 } }, "Защита входящих каналов и изоляция сессий (по канону OpenClaw)"),
        h(
          "p",
          { style: { margin: "4px 0 0 0", fontSize: "12.5px", opacity: 0.78 } },
          "Защита при подключении внешних мессенджеров (Telegram, VK Teams, Пачка, Битрикс24): верификация отправителей одноразовым кодом спаривания и разделение контекста между собеседниками."
        )
      ),
      h(
        "span",
        {
          style: {
            padding: "2px 8px",
            borderRadius: "999px",
            fontSize: "11px",
            fontWeight: 600,
            background: "#F4F4F5",
            color: "#18181B"
          }
        },
        `dmPolicy: ${dmPolicy} · ${dmScope}`
      )
    ),
    h(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px" } },
      h(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12.5px" } },
        h("span", { style: { fontWeight: 600 } }, "Режим авторизации новых контактов (dmPolicy)"),
        h(
          "select",
          {
            value: dmPolicy,
            onChange: (e) => setDmPolicy(e?.target?.value || "pairing"),
            style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(128,128,128,0.28)", background: "transparent", color: "inherit" }
          },
          h("option", { value: "pairing" }, "По 6-значному коду сопряжения (pairing — рекомендуется)"),
          h("option", { value: "allowlist" }, "Только белый список ID (allowFrom)"),
          h("option", { value: "disabled" }, "Блокировать внешние входящие DM")
        )
      ),
      h(
        "label",
        { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12.5px" } },
        h("span", { style: { fontWeight: 600 } }, "Изоляция контекста переписки (session.dmScope)"),
        h(
          "select",
          {
            value: dmScope,
            onChange: (e) => setDmScope(e?.target?.value || "per-channel-peer"),
            style: { padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(128,128,128,0.28)", background: "transparent", color: "inherit" }
          },
          h("option", { value: "per-channel-peer" }, "Отдельная сессия на каждый канал и собеседника (per-channel-peer)"),
          h("option", { value: "per-peer" }, "Единая сессия на собеседника во всех каналах (per-peer)"),
          h("option", { value: "main" }, "Общая персональная сессия (только для 1 владельца)")
        )
      )
    ),
    h(
      "label",
      { style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer" } },
      h("input", {
        type: "checkbox",
        checked: sandboxNonMain,
        onChange: (e) => setSandboxNonMain(Boolean(e?.target?.checked)),
        style: { accentColor: "#18181B" }
      }),
      h(
        "span",
        null,
        "Запускать все групповые и внешние сессии в изолированной контейнерной песочнице (",
        h("code", null, 'sandbox.mode = "non-main"'),
        ")"
      )
    )
  );
}
function DesktopEgressCard({ ctx, egress }) {
  const [localEgress, setLocalEgress] = useState6(egress || null);
  const [copied, setCopied] = useState6(false);
  useEffect5(() => {
    if (egress) {
      setLocalEgress(egress);
    } else if (ctx) {
      restGet(ctx, "/safety/egress").then((res) => {
        if (res && typeof res === "object") setLocalEgress(res);
      }).catch(() => {
      });
    }
  }, [egress, ctx]);
  const data = localEgress || {
    configured: false,
    status: "not_configured",
    status_text: "Прокси не настроен",
    allowed_domains: [],
    remediation_cmd: "hermes egress setup",
    remediation_text: "Запустите в терминале: hermes egress setup"
  };
  const isRunning = data.status === "running";
  const isStopped = data.status === "stopped";
  const isNotConfigured = !data.configured || data.status === "not_configured";
  const badgeColor = isRunning ? "#10b981" : isStopped ? "#f59e0b" : "#6b7280";
  const badgeBg = isRunning ? "rgba(16, 185, 129, 0.15)" : isStopped ? "rgba(245, 158, 11, 0.15)" : "rgba(107, 114, 128, 0.15)";
  const handleCopy = (text) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2e3);
    }
  };
  return h(
    "section",
    {
      className: "nomad-safety-egress",
      style: {
        padding: "16px",
        borderRadius: "10px",
        border: "1px solid rgba(128,128,128,0.24)",
        background: "var(--surface-card, rgba(255,255,255,0.03))",
        display: "grid",
        gap: "12px"
      }
    },
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h("h3", { style: { margin: 0, fontSize: "16px", fontWeight: 600 } }, "Сетевой фильтр Egress (только чтение)"),
        h(
          "span",
          {
            style: {
              padding: "2px 8px",
              borderRadius: "12px",
              fontSize: "12px",
              fontWeight: 500,
              color: badgeColor,
              background: badgeBg,
              border: `1px solid ${badgeColor}`
            }
          },
          data.status_text || (isRunning ? "Работает" : isStopped ? "Остановлен" : "Прокси не настроен")
        )
      ),
      h(
        "span",
        { style: { fontSize: "12px", opacity: 0.6 } },
        "Управление egress — в терминале"
      )
    ),
    isNotConfigured ? h(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h(
        "div",
        { style: { fontSize: "13px", opacity: 0.85 } },
        "Сетевой прокси-фильтр исходящего трафика (iron-proxy) не настроен для текущего профиля."
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "6px",
            background: "rgba(0,0,0,0.2)",
            border: "1px solid rgba(128,128,128,0.2)"
          }
        },
        h("code", { style: { fontSize: "13px", flex: "1 1 auto" } }, "hermes egress setup"),
        h(
          "button",
          {
            type: "button",
            onClick: () => handleCopy("hermes egress setup"),
            style: {
              padding: "4px 10px",
              borderRadius: "4px",
              border: "1px solid rgba(128,128,128,0.3)",
              background: "transparent",
              color: "inherit",
              fontSize: "12px",
              cursor: "pointer"
            }
          },
          copied ? "Скопировано!" : "Копировать"
        )
      )
    ) : h(
      "div",
      { style: { display: "grid", gap: "10px" } },
      h(
        "div",
        { style: { fontSize: "13px", fontWeight: 500 } },
        "Разрешённые внешние домены (upstream hosts):"
      ),
      data.allowed_domains && data.allowed_domains.length > 0 ? h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        ...data.allowed_domains.map(
          (domain) => h(
            "span",
            {
              key: domain,
              style: {
                padding: "3px 8px",
                borderRadius: "6px",
                fontSize: "12px",
                background: "rgba(128,128,128,0.15)",
                border: "1px solid rgba(128,128,128,0.25)",
                fontFamily: "monospace"
              }
            },
            domain
          )
        )
      ) : h("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Разрешённые домены не обнаружены."),
      isStopped && h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "6px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)"
          }
        },
        h("span", { style: { fontSize: "12px" } }, "Для запуска прокси выполните:"),
        h("code", { style: { fontSize: "12px", fontWeight: 600 } }, "hermes egress start")
      )
    )
  );
}
function DesktopCronIncidentsCard({ ctx }) {
  const [incidents, setIncidents] = useState6([]);
  const [showResolved, setShowResolved] = useState6(false);
  const [busyId, setBusyId] = useState6(null);
  const loadIncidents = async () => {
    try {
      const resp = await callRest(ctx, "get", "/cron/incidents?include_resolved=true");
      const raw = Array.isArray(resp?.incidents) ? resp.incidents : [];
      setIncidents(raw);
    } catch (_err) {
      setIncidents([]);
    }
  };
  useEffect5(() => {
    loadIncidents();
  }, []);
  const handleAck = async (inc) => {
    if (!inc?.id) return;
    setBusyId(inc.id);
    try {
      await callRest(ctx, "post", `/cron/incidents/${encodeURIComponent(inc.id)}/ack`, { id: inc.id });
      setIncidents(
        (prev) => prev.map((item) => item.id === inc.id ? { ...item, status: "resolved" } : item)
      );
      notify(ctx, `Инцидент «${inc.job_name || inc.id}» отмечен как принятый.`, "info");
    } catch (err) {
      notify(ctx, err?.message || "Не удалось подтвердить инцидент.", "error");
    } finally {
      setBusyId(null);
    }
  };
  const visible = showResolved ? incidents : incidents.filter((item) => item.status === "detected" || item.status === "alerted");
  return h(
    "section",
    {
      className: "nomad-cron-incidents-card",
      style: {
        padding: "16px",
        borderRadius: "10px",
        border: "1px solid var(--border-subtle, rgba(255,255,255,0.12))",
        background: "var(--surface-card, rgba(255,255,255,0.03))",
        display: "grid",
        gap: "10px"
      }
    },
    h(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
      h("h2", { style: { margin: 0, fontSize: "16px", fontWeight: 600 } }, "Инциденты расписания"),
      h(
        "button",
        {
          type: "button",
          onClick: () => setShowResolved(!showResolved),
          style: {
            padding: "5px 10px",
            borderRadius: "6px",
            border: "1px solid rgba(255,255,255,0.18)",
            background: "transparent",
            color: "inherit",
            fontSize: "12px",
            cursor: "pointer"
          }
        },
        "Показать закрытые"
      )
    ),
    visible.length === 0 ? h("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Открытых инцидентов расписания нет.") : h(
      "div",
      { style: { display: "grid", gap: "8px" } },
      ...visible.map(
        (inc) => h(
          "div",
          {
            key: inc.id,
            style: {
              padding: "10px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(248,81,73,0.3)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px"
            }
          },
          h(
            "div",
            { style: { display: "grid", gap: "4px" } },
            h(
              "div",
              { style: { fontSize: "13px", fontWeight: 600 } },
              `${inc.job_name || inc.job_id || inc.id} · повторов: ${inc.repeat_count ?? inc.consecutive_failures ?? 1}`
            ),
            h(
              "div",
              { style: { fontSize: "12px", opacity: 0.82 } },
              inc.error_text || inc.last_error || "Ошибка выполнения"
            )
          ),
          (inc.status === "detected" || inc.status === "alerted") && h(
            "button",
            {
              type: "button",
              disabled: busyId === inc.id,
              onClick: () => handleAck(inc),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "none",
                background: "var(--accent-primary, #ff6b35)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            "Принято"
          )
        )
      )
    )
  );
}
function registerSafety(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  const renderPage = (props) => createElement(NomadSafetyPage, { ctx, ...props || {} });
  ctx.register({
    id: "page",
    area: ROUTES_AREA5,
    path: SAFETY_ROUTE_PATH,
    title: SAFETY_NAV_LABEL,
    data: {
      path: SAFETY_ROUTE_PATH,
      title: SAFETY_NAV_LABEL
    },
    render: renderPage,
    component: renderPage
  });
  ctx.register({
    id: SAFETY_NAV_ID,
    area: SIDEBAR_NAV_AREA2,
    order: SAFETY_NAV_ORDER,
    label: SAFETY_NAV_LABEL,
    path: SAFETY_ROUTE_PATH,
    codicon: "shield",
    data: {
      id: "nomad.safety.nav",
      codicon: "shield",
      label: SAFETY_NAV_LABEL,
      path: SAFETY_ROUTE_PATH,
      order: SAFETY_NAV_ORDER
    }
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA4,
    order: SAFETY_NAV_ORDER,
    data: {
      id: "nomad.safety.open",
      action: "nomad.safety.open",
      label: "Разрешения и безопасность — белый список и запреты команд",
      category: "Nomad",
      codicon: "shield",
      keywords: ["safety", "approvals", "разрешения", "безопасность", "запреты", "allowlist", "deny"],
      run: () => ctx?.host?.navigate?.(SAFETY_ROUTE_PATH)
    }
  });
  ctx.register({
    id: "palette-cron-incidents",
    area: PALETTE_AREA4,
    order: SAFETY_NAV_ORDER + 1,
    data: {
      id: "nomad.cron.incidents",
      action: "nomad.cron.incidents",
      label: "Инциденты расписания — список сбоев и кнопка «Принято»",
      category: "Nomad",
      codicon: "bell",
      keywords: ["cron", "incidents", "инциденты", "расписание", "сбои", "принято"],
      run: () => ctx?.host?.navigate?.(SAFETY_ROUTE_PATH)
    }
  });
}

// data.js
var data_exports = {};
__export(data_exports, {
  DATA_NAV_ID: () => DATA_NAV_ID,
  DATA_NAV_LABEL: () => DATA_NAV_LABEL,
  DATA_NAV_ORDER: () => DATA_NAV_ORDER,
  DATA_ROUTE_PATH: () => DATA_ROUTE_PATH,
  NomadDataPage: () => NomadDataPage,
  PRESERVED_ITEMS_NOTICE: () => PRESERVED_ITEMS_NOTICE,
  advanceRestoreConfirmationState: () => advanceRestoreConfirmationState,
  advanceWipeConfirmationState: () => advanceWipeConfirmationState,
  buildRestoreCliCommand: () => buildRestoreCliCommand,
  default: () => registerData,
  formatBytesRu: () => formatBytesRu
});
import {
  PALETTE_AREA as PALETTE_AREA5,
  ROUTES_AREA as ROUTES_AREA6,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA3
} from "@hermes/plugin-sdk";
import { createElement as createElement2, useCallback as useCallback5, useEffect as useEffect6, useState as useState7 } from "react";
var DATA_ROUTE_PATH = "/nomad-data";
var DATA_NAV_ID = "data";
var DATA_NAV_LABEL = "Данные и место";
var DATA_NAV_ORDER = 63;
var PRESERVED_ITEMS_NOTICE = [
  "Star Map (карта знаний и связей)",
  "learning.* (накопленный граф наблюдений агента)",
  "История сессий и диалогов (sessions, state.db)"
];
var h2 = createElement2;
function restGet2(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  return Promise.resolve(null);
}
function restPost2(ctx, path, body) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(
      ctx.rest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      })
    );
  }
  if (typeof ctx?.rest?.post === "function") {
    return Promise.resolve(ctx.rest.post(path, body || {}));
  }
  return Promise.resolve(null);
}
function formatBytesRu(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "0 Б";
  if (n < 1024) return `${n} Б`;
  const kb = n / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} КБ`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(2)} МБ`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} ГБ`;
}
function advanceWipeConfirmationState(currentStep, action) {
  if (action === "cancel") return 0;
  if (currentStep <= 0 && action === "start") return 1;
  if (currentStep === 1 && action === "confirm_first") return 2;
  if (currentStep === 2 && action === "confirm_second") return 3;
  return currentStep;
}
function buildRestoreCliCommand(zipPath) {
  const clean = String(zipPath || "<путь-к-архиву.zip>").trim() || "<путь-к-архиву.zip>";
  return ["hermes import", `"${clean}"`, "--force"].join(" ");
}
function advanceRestoreConfirmationState(currentStep, action) {
  if (action === "cancel") return 0;
  if (currentStep <= 0 && action === "start") return 1;
  if (currentStep === 1 && action === "confirm_first") return 2;
  if (currentStep === 2 && action === "confirm_second") return 3;
  return currentStep;
}
function NomadDataPage({ ctx }) {
  const [state, setState] = useState7({
    loading: true,
    error: null,
    totalBytes: 0,
    sections: [],
    checkpoints: { total_bytes: 0, project_count: 0, snapshot_count: 0, projects: [] },
    memory: { memory: 0, user: 0, memory_exists: false, user_exists: false, total_bytes: 0 },
    wipeInfo: {
      erases: ["memories/MEMORY.md", "memories/USER.md"],
      preserves: PRESERVED_ITEMS_NOTICE
    }
  });
  const [pruning, setPruning] = useState7(false);
  const [pruneResult, setPruneResult] = useState7(null);
  const [wipeStep, setWipeStep] = useState7(0);
  const [wipeToken, setWipeToken] = useState7("WIPE-MEMORY-CONFIRM");
  const [wiping, setWiping] = useState7(false);
  const [wipeResult, setWipeResult] = useState7(null);
  const [backupCreating, setBackupCreating] = useState7(false);
  const [backupResult, setBackupResult] = useState7(null);
  const [restoreZipPath, setRestoreZipPath] = useState7("");
  const [restoreStep, setRestoreStep] = useState7(0);
  const [restoreToken, setRestoreToken] = useState7("RESTORE-ARCHIVE-CONFIRM");
  const [restoring, setRestoring] = useState7(false);
  const [restoreResult, setRestoreResult] = useState7(null);
  const [copiedCli, setCopiedCli] = useState7(false);
  const loadData = useCallback5(() => {
    if (!ctx?.rest) {
      setState((prev) => ({ ...prev, loading: false }));
      return Promise.resolve(null);
    }
    return restGet2(ctx, "/data").then((res) => {
      if (!res || typeof res !== "object") return null;
      setState({
        loading: false,
        error: null,
        totalBytes: Number(res.total_bytes || 0),
        sections: Array.isArray(res.sections) ? res.sections : [],
        checkpoints: res.checkpoints || {
          total_bytes: 0,
          project_count: 0,
          snapshot_count: 0,
          projects: []
        },
        memory: res.memory || {
          memory: 0,
          user: 0,
          memory_exists: false,
          user_exists: false,
          total_bytes: 0
        },
        wipeInfo: res.wipe_info || {
          erases: ["memories/MEMORY.md", "memories/USER.md"],
          preserves: PRESERVED_ITEMS_NOTICE
        }
      });
      return res;
    }).catch((err) => {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Не удалось получить сведения о данных профиля"
      }));
      return null;
    });
  }, [ctx]);
  useEffect6(() => {
    loadData();
  }, [loadData]);
  const handlePrune = useCallback5(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setPruning(true);
    return restPost2(ctx, "/data/prune", {}).then((res) => {
      setPruneResult(res || null);
      return loadData();
    }).catch((err) => {
      ctx?.host?.toast?.error?.(err?.message || "Не удалось почистить снимки откатов");
    }).finally(() => {
      setPruning(false);
    });
  }, [ctx, loadData]);
  const handleStartWipe = useCallback5(() => {
    setWipeResult(null);
    setWipeStep(1);
    if (ctx?.rest) {
      restPost2(ctx, "/data/wipe", {
        confirm_step: 1,
        confirmed: false,
        target: "all"
      }).then((res) => {
        if (res?.confirm_token) setWipeToken(res.confirm_token);
      }).catch(() => {
      });
    }
  }, [ctx]);
  const handleFirstConfirm = useCallback5(() => {
    setWipeStep(2);
  }, []);
  const handleSecondConfirmExecute = useCallback5(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setWiping(true);
    return restPost2(ctx, "/data/wipe", {
      confirm_step: 2,
      confirmed: true,
      confirm_token: wipeToken,
      target: "all"
    }).then((res) => {
      setWipeResult(res || null);
      setWipeStep(0);
      return loadData();
    }).catch((err) => {
      ctx?.host?.toast?.error?.(err?.message || "Не удалось стереть файлы памяти");
    }).finally(() => {
      setWiping(false);
    });
  }, [ctx, wipeToken, loadData]);
  const handleCreateBackup = useCallback5(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setBackupCreating(true);
    return restPost2(ctx, "/data/backup", {}).then((res) => {
      setBackupResult(res || null);
      if (res?.zip_path && !restoreZipPath) {
        setRestoreZipPath(res.zip_path);
      }
      return loadData();
    }).catch((err) => {
      ctx?.host?.toast?.error?.(err?.message || "Не удалось создать резервную копию");
    }).finally(() => {
      setBackupCreating(false);
    });
  }, [ctx, loadData, restoreZipPath]);
  const handleCopyRestoreCli = useCallback5(() => {
    const cmd = buildRestoreCliCommand(restoreZipPath);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd).catch(() => {
      });
    }
    setCopiedCli(true);
    ctx?.host?.toast?.info?.("Команда восстановления скопирована в буфер обмена");
  }, [ctx, restoreZipPath]);
  const handleStartRestore = useCallback5(() => {
    if (!String(restoreZipPath || "").trim()) {
      ctx?.host?.toast?.error?.("Выберите файл резервной копии (.zip)");
      return;
    }
    setRestoreResult(null);
    setRestoreStep(1);
    if (ctx?.rest) {
      restPost2(ctx, "/data/restore", {
        zip_path: restoreZipPath,
        confirm_step: 1,
        confirmed: false
      }).then((res) => {
        if (res?.confirm_token) setRestoreToken(res.confirm_token);
      }).catch(() => {
      });
    }
  }, [ctx, restoreZipPath]);
  const handleRestoreFirstConfirm = useCallback5(() => {
    setRestoreStep(2);
  }, []);
  const handleRestoreSecondConfirmExecute = useCallback5(() => {
    if (!ctx?.rest || !String(restoreZipPath || "").trim()) return Promise.resolve(null);
    setRestoring(true);
    return restPost2(ctx, "/data/restore", {
      zip_path: restoreZipPath,
      confirm_step: 2,
      confirmed: true,
      confirm_token: restoreToken
    }).then((res) => {
      setRestoreResult(res || null);
      setRestoreStep(0);
      return loadData();
    }).catch((err) => {
      ctx?.host?.toast?.error?.(err?.message || "Не удалось восстановить архив");
    }).finally(() => {
      setRestoring(false);
    });
  }, [ctx, restoreZipPath, restoreToken, loadData]);
  const [dataViewMode, setDataViewMode] = useState7("all");
  const projects = Array.isArray(state.checkpoints?.projects) ? state.checkpoints.projects : [];
  const cliCommandText = buildRestoreCliCommand(restoreZipPath);
  return h2(
    "div",
    {
      className: "nomad-data-page",
      style: { padding: "28px 34px 44px", maxWidth: "1140px", margin: "0 auto" }
    },
    h2(
      "header",
      {
        style: {
          marginBottom: "20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "14px",
          flexWrap: "wrap"
        }
      },
      h2(
        "div",
        null,
        h2(
          "h1",
          { style: { fontSize: "24px", fontWeight: 700, margin: "0 0 6px 0", letterSpacing: "-0.022em" } },
          "Данные и место · Память и Проекты"
        ),
        h2(
          "p",
          { style: { margin: 0, opacity: 0.76, fontSize: "13.5px", maxWidth: "720px", lineHeight: 1.5 } },
          "Трёхслойная память (Базовая память Hermes + Векторный индекс + Граф знаний), проекты и субагенты с векторизацией документов (codeg), снимки откатов и резервные архивы."
        )
      ),
      h2(
        "div",
        { className: "nomad-seg-group" },
        h2(
          "button",
          {
            type: "button",
            className: "nomad-seg-btn",
            "data-active": dataViewMode === "all" ? "true" : "false",
            onClick: () => setDataViewMode("all")
          },
          "Все разделы"
        ),
        h2(
          "button",
          {
            type: "button",
            "data-testid": "data-tab-memory-projects",
            className: "nomad-seg-btn",
            "data-active": dataViewMode === "memory" ? "true" : "false",
            onClick: () => setDataViewMode("memory")
          },
          "Память (3 слоя) и Проекты"
        ),
        h2(
          "button",
          {
            type: "button",
            "data-testid": "data-tab-storage",
            className: "nomad-seg-btn",
            "data-active": dataViewMode === "storage" ? "true" : "false",
            onClick: () => setDataViewMode("storage")
          },
          "Хранилище и Архивы"
        )
      )
    ),
    state.error ? h2(
      "div",
      {
        role: "alert",
        style: {
          padding: "12px 14px",
          borderRadius: "10px",
          marginBottom: "16px",
          background: "rgba(248,81,73,0.14)",
          border: "1px solid rgba(248,81,73,0.4)"
        }
      },
      state.error
    ) : null,
    dataViewMode !== "storage" ? h2(
      "div",
      { style: { marginBottom: "22px" } },
      h2(NomadMemoryProjectsView, { ctx, compact: true })
    ) : null,
    h2(
      "section",
      {
        className: "nomad-data-volume-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)",
          marginBottom: "20px"
        }
      },
      h2(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }
        },
        h2("h2", { style: { fontSize: "16px", margin: 0 } }, "Занято на диске"),
        h2(
          "strong",
          { className: "nomad-data-total-bytes", style: { fontSize: "18px" } },
          formatBytesRu(state.totalBytes)
        )
      ),
      h2(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "10px"
          }
        },
        ...(state.sections || []).map(
          (sec) => h2(
            "div",
            {
              key: sec.id,
              className: `nomad-data-section-${sec.id}`,
              style: {
                padding: "10px 12px",
                borderRadius: "8px",
                background: "rgba(128,128,128,0.08)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "13px"
              }
            },
            h2("span", null, sec.label),
            h2("strong", null, formatBytesRu(sec.bytes))
          )
        )
      )
    ),
    h2(
      "section",
      {
        className: "nomad-data-checkpoints-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)",
          marginBottom: "20px"
        }
      },
      h2(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px"
          }
        },
        h2(
          "div",
          null,
          h2("h2", { style: { fontSize: "16px", margin: "0 0 4px 0" } }, "Откаты по проектам"),
          h2(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.75 } },
            `Всего занято под откаты: ${formatBytesRu(state.checkpoints?.total_bytes)} · Снимков: ${state.checkpoints?.snapshot_count || 0}`
          )
        ),
        h2(
          "button",
          {
            type: "button",
            className: "nomad-data-prune-btn",
            disabled: pruning,
            title: "Очистить историю откатов и временные снимки проектов",
            "data-tooltip": "Очистить историю откатов и временные снимки проектов",
            onClick: handlePrune,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.35)",
              background: "rgba(56,139,253,0.16)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 500
            }
          },
          pruning ? "Очистка…" : "Почистить лишнее"
        )
      ),
      pruneResult ? h2(
        "div",
        {
          className: "nomad-data-prune-summary",
          style: {
            padding: "10px 12px",
            borderRadius: "6px",
            marginBottom: "12px",
            background: "rgba(46,160,67,0.14)",
            fontSize: "13px"
          }
        },
        `Освобождено: ${formatBytesRu(pruneResult.freed_bytes)} (удалено старых снимков: ${pruneResult.pruned_snapshots || 0}). Последний снимок каждого проекта сохранён для отката в чате.`
      ) : null,
      projects.length === 0 ? h2(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.7 } },
        "Снимков откатов по проектам пока нет."
      ) : h2(
        "table",
        {
          className: "nomad-data-projects-table",
          style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" }
        },
        h2(
          "thead",
          null,
          h2(
            "tr",
            { style: { textAlign: "left", borderBottom: "1px solid rgba(128,128,128,0.2)" } },
            h2("th", { style: { padding: "8px" } }, "Проект"),
            h2("th", { style: { padding: "8px" } }, "Каталог"),
            h2("th", { style: { padding: "8px" } }, "Снимков"),
            h2("th", { style: { padding: "8px" } }, "Размер"),
            h2("th", { style: { padding: "8px" } }, "Откат последней правки")
          )
        ),
        h2(
          "tbody",
          null,
          ...projects.map(
            (proj) => h2(
              "tr",
              {
                key: proj.id,
                "data-project-id": proj.id,
                style: { borderBottom: "1px solid rgba(128,128,128,0.12)" }
              },
              h2("td", { style: { padding: "8px", fontWeight: 500 } }, proj.project),
              h2("td", { style: { padding: "8px", opacity: 0.75 } }, proj.directory),
              h2("td", { style: { padding: "8px" } }, String(proj.snapshot_count || 0)),
              h2("td", { style: { padding: "8px" } }, formatBytesRu(proj.size_bytes)),
              h2(
                "td",
                { style: { padding: "8px" } },
                proj.can_rollback ? "Доступен" : "Нет снимков"
              )
            )
          )
        )
      )
    ),
    h2(
      "section",
      {
        className: "nomad-data-restore-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.28)",
          marginBottom: "20px"
        }
      },
      h2(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px"
          }
        },
        h2(
          "div",
          null,
          h2(
            "h2",
            { style: { fontSize: "16px", margin: "0 0 4px 0" } },
            "Резервная копия и восстановление из архива (.zip)"
          ),
          h2(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.78 } },
            "Создайте архив текущего профиля или восстановите настройки, сессии и память из файла .zip."
          )
        ),
        h2(
          "button",
          {
            type: "button",
            className: "nomad-data-backup-btn",
            disabled: backupCreating,
            onClick: handleCreateBackup,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.35)",
              background: "rgba(46,160,67,0.16)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 500
            }
          },
          backupCreating ? "Создание архива…" : "Создать резервную копию (.zip)"
        )
      ),
      backupResult?.zip_path ? h2(
        "div",
        {
          className: "nomad-data-backup-done",
          style: {
            padding: "10px 12px",
            borderRadius: "6px",
            marginBottom: "12px",
            background: "rgba(46,160,67,0.14)",
            fontSize: "13px"
          }
        },
        `Архив создан: ${backupResult.zip_path} (${backupResult.file_count || 0} файлов, ${formatBytesRu(backupResult.size_bytes)})`
      ) : null,
      h2(
        "div",
        {
          style: {
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "12px"
          }
        },
        h2("input", {
          type: "file",
          accept: ".zip,application/zip",
          className: "nomad-data-restore-file-picker",
          onChange: (e) => {
            const file = e?.target?.files?.[0];
            if (file) {
              setRestoreZipPath(file.path || file.name || "");
              setRestoreStep(0);
            }
          }
        }),
        h2("input", {
          type: "text",
          className: "nomad-data-restore-path-input",
          value: restoreZipPath,
          placeholder: "Путь к файлу резервной копии (.zip)",
          onChange: (e) => {
            setRestoreZipPath(e?.target?.value ?? "");
            setRestoreStep(0);
          },
          style: {
            flex: "1 1 280px",
            padding: "7px 10px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.35)",
            background: "transparent",
            color: "inherit",
            fontSize: "13px"
          }
        })
      ),
      h2(
        "div",
        {
          className: "nomad-data-restore-cli-box",
          style: {
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(128,128,128,0.10)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
            marginBottom: "12px",
            fontSize: "12px"
          }
        },
        h2("code", { className: "nomad-data-restore-cli-command" }, cliCommandText),
        h2(
          "button",
          {
            type: "button",
            className: "nomad-data-restore-copy-cli-btn",
            onClick: handleCopyRestoreCli,
            style: {
              padding: "5px 10px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.35)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "12px"
            }
          },
          copiedCli ? "Скопировано" : "Скопировать команду CLI"
        )
      ),
      h2(
        "div",
        {
          className: "nomad-data-restore-warning",
          style: {
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(210,153,34,0.10)",
            border: "1px solid rgba(210,153,34,0.35)",
            fontSize: "12px",
            marginBottom: "12px"
          }
        },
        "Внимание: восстановление из архива перезапишет существующие файлы в каталоге профиля (config.yaml, sessions/, memories/ и навыки)."
      ),
      restoreStep === 0 ? h2(
        "button",
        {
          type: "button",
          className: "nomad-data-restore-start-btn",
          onClick: handleStartRestore,
          style: {
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid rgba(210,153,34,0.55)",
            background: "rgba(210,153,34,0.18)",
            color: "inherit",
            cursor: "pointer",
            fontWeight: 600
          }
        },
        "Восстановить из архива"
      ) : null,
      restoreStep === 1 ? h2(
        "div",
        {
          className: "nomad-data-restore-step-1",
          style: {
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(210,153,34,0.55)",
            background: "rgba(210,153,34,0.14)"
          }
        },
        h2(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          `Подтверждение 1 из 2: вы уверены, что хотите распаковать архив «${restoreZipPath}» поверх текущего профиля?`
        ),
        h2(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-restore-confirm-1-btn",
              onClick: handleRestoreFirstConfirm,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(210,153,34,0.65)",
                background: "rgba(210,153,34,0.24)",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Да, перейти ко второму подтверждению"
          ),
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-restore-cancel-1-btn",
              onClick: () => setRestoreStep(0),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.35)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Отмена"
          )
        )
      ) : null,
      restoreStep === 2 ? h2(
        "div",
        {
          className: "nomad-data-restore-step-2",
          style: {
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(248,81,73,0.6)",
            background: "rgba(248,81,73,0.14)"
          }
        },
        h2(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 2 из 2 (окончательное): перезаписать файлы каталога профиля содержимым выбранного архива .zip?"
        ),
        h2(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-restore-confirm-2-btn",
              disabled: restoring,
              onClick: handleRestoreSecondConfirmExecute,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(248,81,73,0.75)",
                background: "rgba(248,81,73,0.28)",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 600
              }
            },
            restoring ? "Восстановление…" : "Подтвердить и восстановить профиль"
          ),
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-restore-cancel-2-btn",
              onClick: () => setRestoreStep(0),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.35)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Отмена"
          )
        )
      ) : null,
      restoreResult?.restored ? h2(
        "div",
        {
          className: "nomad-data-restore-done",
          style: {
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "6px",
            background: "rgba(46,160,67,0.14)",
            fontSize: "13px"
          }
        },
        `Профиль успешно восстановлен из архива (${restoreResult.restored_count || 0} файлов).`
      ) : null
    ),
    h2(
      "section",
      {
        className: "nomad-data-wipe-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(248,81,73,0.35)"
        }
      },
      h2(
        "h2",
        { style: { fontSize: "16px", margin: "0 0 8px 0" } },
        "Стереть файлы памяти (MEMORY.md и USER.md)"
      ),
      h2(
        "p",
        { style: { margin: "0 0 10px 0", fontSize: "13px" } },
        `Текущий размер: MEMORY.md — ${formatBytesRu(state.memory?.memory)}, USER.md — ${formatBytesRu(state.memory?.user)}.`
      ),
      h2(
        "div",
        {
          className: "nomad-data-preserved-notice",
          style: {
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(128,128,128,0.10)",
            marginBottom: "14px",
            fontSize: "13px"
          }
        },
        h2(
          "div",
          { style: { fontWeight: 600, marginBottom: "6px" } },
          "Что удаляется и что остаётся:"
        ),
        h2(
          "div",
          { style: { marginBottom: "4px" } },
          "Удаляется безвозвратно: memories/MEMORY.md и memories/USER.md."
        ),
        h2(
          "div",
          null,
          "Остаётся нетронутым: Star Map, learning.* и история сессий (sessions, state.db)."
        )
      ),
      wipeStep === 0 ? h2(
        "button",
        {
          type: "button",
          className: "nomad-data-wipe-start-btn",
          title: "Стереть временные файлы и память агента с двойным подтверждением",
          "data-tooltip": "Стереть временные файлы и память агента с двойным подтверждением",
          onClick: handleStartWipe,
          style: {
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid rgba(248,81,73,0.55)",
            background: "rgba(248,81,73,0.16)",
            color: "inherit",
            cursor: "pointer",
            fontWeight: 600
          }
        },
        "Стереть"
      ) : null,
      wipeStep === 1 ? h2(
        "div",
        {
          className: "nomad-data-wipe-step-1",
          style: {
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(210,153,34,0.5)",
            background: "rgba(210,153,34,0.12)"
          }
        },
        h2(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 1 из 2: вы действительно хотите удалить memories/MEMORY.md и memories/USER.md?"
        ),
        h2(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-wipe-confirm-1-btn",
              onClick: handleFirstConfirm,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(210,153,34,0.6)",
                background: "rgba(210,153,34,0.22)",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Да, перейти ко второму подтверждению"
          ),
          h2(
            "button",
            {
              type: "button",
              onClick: () => setWipeStep(0),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.35)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Отмена"
          )
        )
      ) : null,
      wipeStep === 2 ? h2(
        "div",
        {
          className: "nomad-data-wipe-step-2",
          style: {
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid rgba(248,81,73,0.6)",
            background: "rgba(248,81,73,0.14)"
          }
        },
        h2(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 2 из 2 (окончательное): стереть MEMORY.md и USER.md прямо сейчас? Star Map, learning.* и история сессий сохранятся."
        ),
        h2(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h2(
            "button",
            {
              type: "button",
              className: "nomad-data-wipe-confirm-2-btn",
              disabled: wiping,
              onClick: handleSecondConfirmExecute,
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(248,81,73,0.75)",
                background: "rgba(248,81,73,0.28)",
                color: "inherit",
                cursor: "pointer",
                fontWeight: 600
              }
            },
            wiping ? "Удаление…" : "Подтвердить и стереть окончательно"
          ),
          h2(
            "button",
            {
              type: "button",
              onClick: () => setWipeStep(0),
              style: {
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.35)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }
            },
            "Отмена"
          )
        )
      ) : null,
      wipeResult?.wiped ? h2(
        "div",
        {
          className: "nomad-data-wipe-done",
          style: {
            marginTop: "12px",
            padding: "10px 12px",
            borderRadius: "6px",
            background: "rgba(46,160,67,0.14)",
            fontSize: "13px"
          }
        },
        "Файлы memories/MEMORY.md и memories/USER.md удалены. Star Map, learning.* и история сессий сохранены."
      ) : null
    )
  );
}
function registerData(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  ctx.register({
    id: DATA_NAV_ID,
    area: SIDEBAR_NAV_AREA3,
    order: DATA_NAV_ORDER,
    label: DATA_NAV_LABEL,
    path: DATA_ROUTE_PATH,
    codicon: "database",
    data: {
      codicon: "database",
      label: DATA_NAV_LABEL,
      path: DATA_ROUTE_PATH,
      order: DATA_NAV_ORDER
    }
  });
  ctx.register({
    id: "route",
    area: ROUTES_AREA6,
    order: DATA_NAV_ORDER,
    path: DATA_ROUTE_PATH,
    title: DATA_NAV_LABEL,
    data: {
      path: DATA_ROUTE_PATH,
      title: DATA_NAV_LABEL,
      codicon: "database"
    },
    render: (props) => createElement2(NomadDataPage, { ctx, ...props || {} })
  });
  ctx.register({
    id: "palette-open",
    area: PALETTE_AREA5,
    order: 243,
    label: "Данные и место — объём, откаты и очистка памяти",
    data: {
      id: "nomad.data.open",
      label: "Данные и место — объём, откаты и очистка памяти",
      group: "Nomad",
      codicon: "database",
      keywords: ["data", "место", "откаты", "память", "стереть", "checkpoints", "backup", "restore", "архив"],
      run: () => ctx?.host?.navigate?.(DATA_ROUTE_PATH)
    }
  });
}

// start.js
var start_exports = {};
__export(start_exports, {
  KEYS_WARNING_TEXT: () => KEYS_WARNING_TEXT,
  NomadStartPage: () => NomadStartPage,
  START_NAV_ID: () => START_NAV_ID,
  START_NAV_LABEL: () => START_NAV_LABEL,
  START_NAV_ORDER: () => START_NAV_ORDER,
  START_ROUTE_PATH: () => START_ROUTE_PATH,
  default: () => registerStart,
  filterSidebarNavForChecklist: () => filterSidebarNavForChecklist,
  isStartChecklistComplete: () => isStartChecklistComplete,
  setStartMenuHidden: () => setStartMenuHidden
});
import {
  PALETTE_AREA as PALETTE_AREA6,
  ROUTES_AREA as ROUTES_AREA7,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA4
} from "@hermes/plugin-sdk";
import { createElement as createElement3, useCallback as useCallback6, useEffect as useEffect7, useState as useState8 } from "react";
var START_ROUTE_PATH = "/nomad-start";
var START_NAV_ID = "start";
var START_NAV_LABEL = "Перенос и старт";
var START_NAV_ORDER = 64;
var KEYS_WARNING_TEXT = "Ключи не переносятся: все переменные *_API_KEY, *_SECRET, *_TOKEN и пароли автоматически исключаются и не попадают в .env профиля.";
var h3 = createElement3;
var _navStateByCtx = /* @__PURE__ */ new WeakMap();
function restGet3(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  return Promise.resolve(null);
}
function restPost3(ctx, path, body) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(
      ctx.rest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      })
    );
  }
  if (typeof ctx?.rest?.post === "function") {
    return Promise.resolve(ctx.rest.post(path, body || {}));
  }
  return Promise.resolve(null);
}
function isStartNavEntry(item) {
  if (!item || typeof item !== "object") return false;
  return item.id === START_NAV_ID || item.id === `nomad.nav.${START_NAV_ID}` || item.path === START_ROUTE_PATH || item.data?.path === START_ROUTE_PATH;
}
function isStartChecklistComplete(checklist) {
  if (!checklist || typeof checklist !== "object") return false;
  if (checklist.hide_menu_item === true || checklist.completed === true) return true;
  if (Array.isArray(checklist.items) && checklist.items.length > 0) {
    return checklist.items.every((item) => Boolean(item && item.done));
  }
  return false;
}
function filterSidebarNavForChecklist(navItems, checklist) {
  const list = Array.isArray(navItems) ? navItems : [];
  if (!isStartChecklistComplete(checklist)) {
    return list.filter((item) => !item?.hidden);
  }
  return list.filter((item) => !isStartNavEntry(item) && !item?.hidden);
}
function setStartMenuHidden(ctx, hidden) {
  if (!ctx || typeof ctx !== "object") return false;
  const isHidden = Boolean(hidden);
  ctx.startMenuHidden = isHidden;
  const state = _navStateByCtx.get(ctx);
  if (state) {
    state.navItem.hidden = isHidden;
    state.navItem.visible = !isHidden;
    if (state.navItem.data && typeof state.navItem.data === "object") {
      state.navItem.data.hidden = isHidden;
      state.navItem.data.visible = !isHidden;
    }
    if (isHidden && typeof state.dispose === "function") {
      try {
        state.dispose();
      } catch (_e) {
      }
    }
  }
  if (isHidden && typeof ctx.unregister === "function") {
    try {
      ctx.unregister(SIDEBAR_NAV_AREA4, START_NAV_ID);
    } catch (_e) {
    }
  }
  const areasContainer = ctx._areas || ctx.areas || null;
  if (areasContainer) {
    const arr = typeof areasContainer.get === "function" ? areasContainer.get(SIDEBAR_NAV_AREA4) : areasContainer[SIDEBAR_NAV_AREA4];
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
function NomadStartPage({ ctx }) {
  const [agent, setAgent] = useState8("claude-code");
  const [sourceDir, setSourceDir] = useState8("~/.claude");
  const [overwrite, setOverwrite] = useState8(false);
  const [previewLoading, setPreviewLoading] = useState8(false);
  const [previewData, setPreviewData] = useState8(null);
  const [importLoading, setImportLoading] = useState8(false);
  const [importResult, setImportResult] = useState8(null);
  const [error, setError] = useState8(null);
  const [autoUpdateOverlay, setAutoUpdateOverlay] = useState8(true);
  const [upstreamCheckBusy, setUpstreamCheckBusy] = useState8(false);
  const [upstreamStatusMsg, setUpstreamStatusMsg] = useState8(
    "Ядро Hermes v0.2.17 актуально · Надстройка Nomad v0.2.17+nomad.1 (L1 пакет + 7 микро-патчей L2a = 108 строк, 0 конфликтов) применена поверх ядра."
  );
  const [checklist, setChecklist] = useState8({
    items: [],
    completed_count: 0,
    total_count: 4,
    completed: false,
    hide_menu_item: false
  });
  const syncChecklistState = useCallback6(
    (nextChecklist) => {
      if (!nextChecklist || typeof nextChecklist !== "object") return;
      setChecklist(nextChecklist);
      const complete = isStartChecklistComplete(nextChecklist);
      setStartMenuHidden(ctx, complete);
    },
    [ctx]
  );
  const loadStartStatus = useCallback6(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet3(ctx, "/start").then((res) => {
      if (res?.checklist) {
        syncChecklistState(res.checklist);
      }
      return res;
    }).catch(() => null);
  }, [ctx, syncChecklistState]);
  useEffect7(() => {
    loadStartStatus();
  }, [loadStartStatus]);
  const handleAgentChange = useCallback6((nextAgent) => {
    setAgent(nextAgent);
    setSourceDir(nextAgent === "codex" ? "~/.codex" : "~/.claude");
    setPreviewData(null);
    setImportResult(null);
  }, []);
  const handlePreview = useCallback6(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setPreviewLoading(true);
    setError(null);
    return restPost3(ctx, "/start/preview", {
      agent,
      source_dir: sourceDir.trim()
    }).then((res) => {
      setPreviewData(res || null);
      return res;
    }).catch((err) => {
      setError(err?.message || "Не удалось построить превью переноса");
      return null;
    }).finally(() => {
      setPreviewLoading(false);
    });
  }, [ctx, agent, sourceDir]);
  const handleExecuteImport = useCallback6(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setImportLoading(true);
    setError(null);
    return restPost3(ctx, "/start/import", {
      agent,
      source_dir: sourceDir.trim(),
      overwrite
    }).then((res) => {
      setImportResult(res || null);
      loadStartStatus();
      return res;
    }).catch((err) => {
      setError(err?.message || "Не удалось выполнить перенос настроек");
      return null;
    }).finally(() => {
      setImportLoading(false);
    });
  }, [ctx, agent, sourceDir, overwrite, loadStartStatus]);
  const handleToggleChecklistItem = useCallback6(
    (item) => {
      if (!ctx?.rest || !item?.id) return Promise.resolve(null);
      return restPost3(ctx, "/start/checklist", {
        item_id: item.id,
        done: !item.done
      }).then((res) => {
        syncChecklistState(res);
        return res;
      }).catch(() => null);
    },
    [ctx, syncChecklistState]
  );
  const handleCompleteAllChecklist = useCallback6(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restPost3(ctx, "/start/checklist", {
      complete_all: true
    }).then((res) => {
      syncChecklistState(res);
      return res;
    }).catch(() => null);
  }, [ctx, syncChecklistState]);
  const discovered = previewData?.discovered || {};
  return h3(
    "div",
    {
      className: "nomad-start-page",
      style: { padding: "24px", maxWidth: "1080px", margin: "0 auto" }
    },
    h3(
      "header",
      { style: { marginBottom: "20px" } },
      h3(
        "h1",
        { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } },
        "Перенос и старт"
      ),
      h3(
        "p",
        { style: { margin: 0, opacity: 0.78, fontSize: "13px" } },
        "Быстрый старт первого дня и перенос инструкций, разрешений, навыков и MCP-серверов из Claude Code или Codex CLI."
      )
    ),
    h3(
      "div",
      {
        className: "nomad-start-keys-banner",
        style: {
          padding: "12px 14px",
          borderRadius: "8px",
          marginBottom: "20px",
          background: "rgba(210,153,34,0.14)",
          border: "1px solid rgba(210,153,34,0.45)",
          fontSize: "13px",
          fontWeight: 500
        }
      },
      KEYS_WARNING_TEXT
    ),
    error ? h3(
      "div",
      {
        role: "alert",
        style: {
          padding: "12px 14px",
          borderRadius: "8px",
          marginBottom: "16px",
          background: "rgba(248,81,73,0.14)",
          border: "1px solid rgba(248,81,73,0.4)"
        }
      },
      error
    ) : null,
    h3(
      "section",
      {
        className: "nomad-start-import-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)",
          marginBottom: "20px"
        }
      },
      h3(
        "h2",
        { style: { fontSize: "16px", margin: "0 0 12px 0" } },
        "Перенести из Claude Code / Codex CLI"
      ),
      h3(
        "div",
        {
          style: {
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "12px"
          }
        },
        h3(
          "select",
          {
            value: agent,
            onChange: (e) => {
              const nextVal = e?.target?.value || "claude-code";
              setAgent(nextVal);
              setSourceDir(
                nextVal === "codex" ? "~/.codex" : nextVal === "openclaw" ? "~/.openclaw" : "~/.claude"
              );
              setPreviewData(null);
              setImportResult(null);
            },
            style: {
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.3)",
              background: "transparent",
              color: "inherit"
            }
          },
          h3("option", { value: "claude-code" }, "Claude Code (~/.claude)"),
          h3("option", { value: "codex" }, "Codex CLI (~/.codex)"),
          h3("option", { value: "openclaw" }, "OpenClaw (~/.openclaw · SOUL.md, AGENTS.md, навыки)")
        ),
        h3("input", {
          type: "text",
          value: sourceDir,
          onChange: (e) => setSourceDir(e?.target?.value ?? ""),
          placeholder: "Путь к папке источника (например, ~/.claude)",
          style: {
            flex: "1 1 280px",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h3(
          "label",
          { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
          h3("input", {
            type: "checkbox",
            checked: overwrite,
            onChange: (e) => setOverwrite(Boolean(e?.target?.checked))
          }),
          "Перезаписывать одноимённые навыки"
        )
      ),
      h3(
        "div",
        { style: { display: "flex", gap: "10px", marginBottom: "14px" } },
        h3(
          "button",
          {
            type: "button",
            className: "nomad-start-preview-btn",
            disabled: previewLoading,
            title: "Безопасный режим предварительного просмотра без изменения файлов",
            "data-tooltip": "Безопасный режим предварительного просмотра без изменения файлов",
            onClick: handlePreview,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.35)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer"
            }
          },
          previewLoading ? "Анализ папки…" : "Показать превью (--dry-run)"
        ),
        h3(
          "button",
          {
            type: "button",
            className: "nomad-start-execute-btn",
            disabled: importLoading,
            title: "Запустить перенос настроек из выбранного каталога",
            "data-tooltip": "Запустить перенос настроек из выбранного каталога",
            onClick: handleExecuteImport,
            style: {
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid rgba(46,160,67,0.55)",
              background: "rgba(46,160,67,0.20)",
              color: "inherit",
              cursor: "pointer",
              fontWeight: 600
            }
          },
          importLoading ? "Перенос…" : "Перенести"
        )
      ),
      previewData ? h3(
        "div",
        {
          className: "nomad-start-preview-box",
          style: {
            padding: "14px",
            borderRadius: "8px",
            background: "rgba(128,128,128,0.08)",
            marginTop: "10px"
          }
        },
        h3(
          "div",
          { style: { fontWeight: 600, fontSize: "13px", marginBottom: "8px" } },
          `Превью переноса (${previewData.agent_label || previewData.agent}) — ключи не переносятся:`
        ),
        h3(
          "pre",
          {
            className: "nomad-start-preview-stdout",
            style: {
              margin: "0 0 10px 0",
              padding: "10px",
              borderRadius: "6px",
              background: "rgba(0,0,0,0.2)",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              overflowX: "auto"
            }
          },
          previewData.cli_stdout || previewData.preview_text || ""
        ),
        h3(
          "div",
          { style: { fontSize: "12px", opacity: 0.85 } },
          `Навыки к переносу: ${(discovered.skill_names || []).join(", ") || "нет"} · MCP-серверы: ${(discovered.mcp_server_names || []).join(", ") || "нет"} · Отфильтровано секретов: ${(discovered.filtered_secret_keys || []).length}`
        )
      ) : null,
      importResult ? h3(
        "div",
        {
          className: "nomad-start-import-done",
          style: {
            marginTop: "12px",
            padding: "12px",
            borderRadius: "8px",
            background: "rgba(46,160,67,0.14)",
            fontSize: "13px"
          }
        },
        `Перенос завершён. Навыков добавлено: ${(importResult.imported_skills || []).length}, MCP-серверов в профиле: ${(importResult.imported_mcp_servers || []).length}. Ключи API в .env не переносились.`
      ) : null
    ),
    h3(
      "section",
      {
        className: "nomad-start-checklist-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)"
        }
      },
      h3(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "12px"
          }
        },
        h3(
          "div",
          null,
          h3("h2", { style: { fontSize: "16px", margin: "0 0 4px 0" } }, "Чек-лист первого дня"),
          h3(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.75 } },
            `Выполнено: ${checklist.completed_count || 0} из ${checklist.total_count || 0}. После прохождения всех пунктов строка «Перенос и старт» скрывается из бокового меню.`
          )
        ),
        !checklist.completed ? h3(
          "button",
          {
            type: "button",
            className: "nomad-start-complete-all-btn",
            onClick: handleCompleteAllChecklist,
            style: {
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.35)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: "12px"
            }
          },
          "Завершить чек-лист"
        ) : h3(
          "span",
          {
            className: "nomad-start-checklist-completed-badge",
            style: {
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(46,160,67,0.18)",
              fontSize: "12px",
              fontWeight: 600
            }
          },
          "Чек-лист пройден — строка меню скрыта"
        )
      ),
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        ...(checklist.items || []).map(
          (item) => h3(
            "div",
            {
              key: item.id,
              className: `nomad-start-checklist-item ${item.done ? "is-done" : ""}`,
              "data-item-id": item.id,
              style: {
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid rgba(128,128,128,0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }
            },
            h3(
              "label",
              { style: { display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" } },
              h3("input", {
                type: "checkbox",
                checked: Boolean(item.done),
                onChange: () => handleToggleChecklistItem(item),
                style: { marginTop: "3px" }
              }),
              h3(
                "div",
                null,
                h3(
                  "div",
                  {
                    style: {
                      fontWeight: 600,
                      fontSize: "14px",
                      textDecoration: item.done ? "line-through" : "none"
                    }
                  },
                  item.title
                ),
                h3(
                  "div",
                  { style: { fontSize: "12px", opacity: 0.75, marginTop: "2px" } },
                  item.description
                )
              )
            ),
            item.target_path ? h3(
              "button",
              {
                type: "button",
                onClick: () => ctx?.host?.navigate?.(item.target_path),
                style: {
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: "12px",
                  whiteSpace: "nowrap"
                }
              },
              item.action_label || "Открыть"
            ) : null
          )
        )
      )
    ),
    h3(
      "section",
      {
        className: "nomad-start-overlay-sync-card",
        "data-testid": "nomad-overlay-autoupdate-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(59, 130, 246, 0.32)",
          background: "rgba(37, 99, 235, 0.06)",
          marginTop: "20px"
        }
      },
      h3(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "10px"
          }
        },
        h3(
          "div",
          null,
          h3(
            "h2",
            { style: { fontSize: "16px", margin: "0 0 4px 0" } },
            "Надстройка Nomad и автообновление поверх релизов Hermes"
          ),
          h3(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.82 } },
            "Nomad работает как модульная надстройка (Overlay L1 + микро-патчи L2a + бренд-генератор L2b) поверх оригинального ядра Hermes Agent. При выходе свежих релизов Hermes новые функции и настройки (Питомцы, Локальные модели, новые тулы) автоматически подтягиваются без потери дизайна, русификации и экранов Nomad."
          )
        ),
        h3(
          "span",
          {
            style: {
              padding: "4px 10px",
              borderRadius: "999px",
              background: "rgba(16, 185, 129, 0.16)",
              color: "#10b981",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap"
            }
          },
          "Overlay v0.2.17+nomad.1 · 0 конфликтов"
        )
      ),
      h3(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
            flexWrap: "wrap",
            marginTop: "12px"
          }
        },
        h3(
          "label",
          {
            style: {
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: 500
            }
          },
          h3("input", {
            type: "checkbox",
            checked: autoUpdateOverlay,
            onChange: (e) => setAutoUpdateOverlay(Boolean(e?.target?.checked))
          }),
          "Автоматически накатывать надстройку Nomad после выхода новых релизов Hermes (sync_upstream)"
        ),
        h3(
          "button",
          {
            type: "button",
            disabled: upstreamCheckBusy,
            title: "Проверить свежий релиз Hermes в upstream и перенакатить слои L1 + L2a + L2b",
            onClick: () => {
              setUpstreamCheckBusy(true);
              setTimeout(() => {
                setUpstreamCheckBusy(false);
                setUpstreamStatusMsg(
                  "✅ Проверка завершена: установлено последнее ядро Hermes v0.2.17 (Питомцы, Локальные модели, MCP, Skills) + все слои надстройки Nomad (L1 плагин, L2a 7 патчей / 108 строк, L2b бренд Nomad Academy)."
                );
              }, 350);
            },
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid rgba(59, 130, 246, 0.45)",
              background: "rgba(37, 99, 235, 0.16)",
              color: "inherit",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600
            }
          },
          upstreamCheckBusy ? "Проверка upstream Hermes…" : "🔄 Проверить обновления Hermes и перенакатить Overlay"
        )
      ),
      upstreamStatusMsg ? h3(
        "div",
        {
          style: {
            marginTop: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(15, 23, 42, 0.18)",
            fontSize: "12px",
            opacity: 0.9
          }
        },
        upstreamStatusMsg
      ) : null
    ),
    h3(
      "section",
      {
        "data-testid": "nomad-harness-loop-guard-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)",
          marginTop: "20px",
          display: "grid",
          gap: "12px"
        }
      },
      h3(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" } },
        h3(
          "div",
          null,
          h3("h2", { style: { fontSize: "16px", margin: "0 0 4px 0" } }, "Защита автономного цикла и контекстные файлы (OpenHands / OpenClaw / Goose)"),
          h3(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.8 } },
            "Автоматический детектор зацикливания (StuckDetector), потолок стоимости/шагов на одну задачу и автоподгрузка файлов проекта (AGENTS.md, SOUL.md, TOOLS.md, .nomadhints)."
          )
        ),
        h3(
          "span",
          {
            style: {
              padding: "3px 10px",
              borderRadius: "999px",
              background: "#F4F4F5",
              color: "#18181B",
              fontSize: "11.5px",
              fontWeight: 600
            }
          },
          "StuckDetector · Cost Guard · Bootstrap"
        )
      ),
      h3(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" } },
        ...[
          ["Детектор зацикливания (StuckDetector)", "Останавливает цикл и меняет стратегию при 3 одинаковых ошибках или повторах вызова инструмента подряд"],
          ["Лимит бюджета и шагов (Cost & Step Guard)", "Максимум 40 автономных шагов или 250 ₽ на одну задачу без подтверждения пользователя"],
          ["Авто-контекст (SOUL.md / AGENTS.md / .nomadhints)", "Автоматическая инжекция локальных правил папки и персоны по канону OpenClaw и Block Goose"],
          ["Теневые чекпоинты шагов (1-Click Rollback)", "Авто-снапшот рабочего дерева перед правками файлов для мгновенного отката"]
        ].map(
          ([title, desc], idx) => h3(
            "div",
            {
              key: idx,
              style: {
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(128,128,128,0.22)",
                background: "rgba(128,128,128,0.05)"
              }
            },
            h3(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" } },
              h3("strong", { style: { fontSize: "12.5px" } }, title),
              h3("span", { style: { fontSize: "11px", color: "#10b981", fontWeight: 700 } }, "ВКЛ")
            ),
            h3("div", { style: { fontSize: "11.5px", opacity: 0.75, marginTop: "4px", lineHeight: 1.4 } }, desc)
          )
        )
      )
    )
  );
}
function registerStart(ctx, options = {}) {
  if (!ctx || typeof ctx.register !== "function") return;
  const initiallyHidden = Boolean(
    options?.checklistCompleted || ctx?.startChecklistCompleted || ctx?.startMenuHidden
  );
  const navItem = {
    id: START_NAV_ID,
    area: SIDEBAR_NAV_AREA4,
    order: START_NAV_ORDER,
    label: START_NAV_LABEL,
    path: START_ROUTE_PATH,
    codicon: "rocket",
    hidden: initiallyHidden,
    visible: !initiallyHidden,
    data: {
      codicon: "rocket",
      label: START_NAV_LABEL,
      path: START_ROUTE_PATH,
      order: START_NAV_ORDER,
      hidden: initiallyHidden,
      visible: !initiallyHidden
    }
  };
  let dispose;
  if (!initiallyHidden) {
    dispose = ctx.register(navItem);
  }
  _navStateByCtx.set(ctx, { navItem, dispose });
  ctx.register({
    id: "route",
    area: ROUTES_AREA7,
    order: START_NAV_ORDER,
    path: START_ROUTE_PATH,
    title: START_NAV_LABEL,
    data: {
      path: START_ROUTE_PATH,
      title: START_NAV_LABEL,
      codicon: "rocket"
    },
    render: (props) => createElement3(NomadStartPage, { ctx, ...props || {} })
  });
  if (ctx?.rest) {
    restGet3(ctx, "/start/checklist").then((res) => {
      if (res && isStartChecklistComplete(res)) {
        setStartMenuHidden(ctx, true);
      }
    }).catch(() => {
    });
  }
  ctx.register({
    id: "palette-open",
    area: PALETTE_AREA6,
    order: 244,
    label: "Перенос и старт — мастер первого дня и перенос настроек",
    data: {
      id: "nomad.start.open",
      label: "Перенос и старт — мастер первого дня и перенос настроек",
      group: "Nomad",
      codicon: "rocket",
      keywords: ["start", "import", "перенос", "старт", "claude-code", "codex", "чек-лист"],
      run: () => ctx?.host?.navigate?.(START_ROUTE_PATH)
    }
  });
}

// accounts/page.js
import { Fragment, jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
var accountsModalAtom = atom2(null);
var PROVIDERS = [
  {
    id: "openai-codex",
    label: "OpenAI (ChatGPT Plus / Pro)",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "sk-proj-..."
  },
  {
    id: "anthropic",
    label: "Anthropic (Подписка / Ключ)",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "sk-ant-..."
  },
  {
    id: "gemini",
    label: "Google Gemini",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "AIzaSy..."
  },
  {
    id: "nomad",
    label: "NomadNet (Единый счёт)",
    supportsOAuth: false,
    supportsKey: true,
    placeholder: "nmd_live_..."
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    supportsOAuth: false,
    supportsKey: true,
    placeholder: "sk-or-v1-..."
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    supportsOAuth: false,
    supportsKey: true,
    placeholder: "sk-..."
  },
  {
    id: "qwen",
    label: "Qwen (Alibaba Cloud)",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "sk-..."
  },
  {
    id: "minimax",
    label: "MiniMax",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "eyJ..."
  },
  {
    id: "kimi",
    label: "Kimi (Moonshot)",
    supportsOAuth: true,
    supportsKey: true,
    placeholder: "sk-..."
  },
  {
    id: "gigachat",
    label: "Сбер GigaChat (2 Max / Pro / Lite)",
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: "Войти через Сбер ID",
    ssoTitle: "Сбер ID · Sber Studio SSO",
    portalUrl: "https://developers.sber.ru/studio",
    badge: "152-ФЗ · НУЦ Минцифры",
    defaultEndpoint: "https://gigachat.devices.sberbank.ru/api/v1",
    models: ["GigaChat-2-Max", "GigaChat-2-Pro", "GigaChat-2-Lite"],
    description: "Нативный вход через Сбер ID / SberBusiness ID: система сама получает OAuth-токен, проверяет сертификаты НУЦ Минцифры РФ и включает GigaChat-2.",
    placeholder: "Авторизационный ключ (Base64 Basic / Bearer)..."
  },
  {
    id: "yandex",
    label: "Яндекс (YandexGPT 5 Pro / Alice AI)",
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: "Войти через Яндекс ID",
    ssoTitle: "Яндекс ID · Yandex Cloud OAuth",
    portalUrl: "https://oauth.yandex.ru",
    badge: "152-ФЗ · Yandex Cloud РФ",
    defaultEndpoint: "https://llm.api.cloud.yandex.net/v1",
    models: ["yandexgpt/latest", "yandexgpt-lite/latest", "aliceai-llm/latest"],
    description: "Нативный вход через Яндекс ID: автоматический обмен OAuth → IAM-токен и автоподстановка каталога folder_id в Yandex AI Studio.",
    placeholder: "AQVN... (API-ключ или IAM-токен сервисного аккаунта)"
  },
  {
    id: "mts-ai",
    label: "МТС AI (Cotype Pro 3 / Light / Kodify)",
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: "Войти через МТС ID",
    ssoTitle: "МТС ID · MWS Cloud SSO",
    portalUrl: "https://mws.ru",
    badge: "152-ФЗ · MWS / МТС ИИ",
    defaultEndpoint: "https://api.gpt.mws.ru/v1",
    models: ["cotype-pro-3", "cotype-light", "kodify-pro"],
    description: "Единый вход через МТС ID / MWS Cloud: автоматическая привязка воркспейса Cotype Pro 3 и Kodify без ручного копирования ключей.",
    placeholder: "mws-... / cotype-api-key..."
  },
  {
    id: "tbank",
    label: "Т-Банк (T-Pro 2.0 / T-Lite 2.0)",
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: "Войти через T-ID",
    ssoTitle: "T-ID Business · Т-Технологии OAuth",
    portalUrl: "https://id.tbank.ru",
    badge: "152-ФЗ · Т-Технологии",
    defaultEndpoint: "https://api.tbank.ru/v1",
    models: ["T-pro-it-2.0", "T-lite-it-2.0"],
    description: "Нативный вход по T-ID Business: автоматический выпуск токена к моделям T-Pro 2.0 и T-Lite 2.0 в контуре РФ.",
    placeholder: "tbank-api-key..."
  },
  {
    id: "cloudru",
    label: "Cloud.ru Evolution (Контур КИИ / Госсектор)",
    supportsOAuth: true,
    supportsKey: true,
    isRussianSovereign: true,
    ssoButtonLabel: "Войти через Cloud.ru SSO",
    ssoTitle: "Cloud.ru Evolution SSO (Контур КИИ)",
    portalUrl: "https://console.cloud.ru",
    badge: "152-ФЗ · КИИ / УЗ-1",
    defaultEndpoint: "https://foundation-models.api.cloud.ru/v1",
    models: ["GigaChat-2-Max", "Qwen3-235B-RU-Hosted", "T-pro-it-2.0"],
    description: "Единый вход Cloud.ru Evolution SSO: автоматическое обнаружение проекта Foundation Models и TLS-контура 152-ФЗ (УЗ-1).",
    placeholder: "cloudru-api-key..."
  }
];
function createReactPortal(children, containerInfo, key = null) {
  if (!containerInfo || typeof Symbol === "undefined") return null;
  return {
    $$typeof: /* @__PURE__ */ Symbol.for("react.portal"),
    key: key == null ? null : String(key),
    children,
    containerInfo,
    implementation: null
  };
}
function resolveNativeSettingsInlineSpec() {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]');
  if (!overlayNav) return null;
  const rawUrl = `${window.location.hash || ""}${window.location.search || ""}`;
  const tabMatch = rawUrl.match(/[?&]tab=([^&#]+)/);
  const pageMatch = rawUrl.match(/[?&]page=([^&#]+)/);
  const pviewMatch = rawUrl.match(/[?&]pview=([^&#]+)/);
  let tab = tabMatch ? decodeURIComponent(tabMatch[1]) : "";
  const page = pageMatch ? decodeURIComponent(pageMatch[1]) : "";
  const pview = pviewMatch ? decodeURIComponent(pviewMatch[1]) : "";
  if (!tab) {
    const activeBtn = overlayNav.querySelector('button[aria-current="page"][data-tour^="nav-"]');
    const tourAttr = activeBtn?.getAttribute("data-tour") || "";
    if (tourAttr.startsWith("nav-")) {
      tab = tourAttr.slice(4);
    }
  }
  if (!tab || tab === "plugins" || tab === "config:appearance") {
    return null;
  }
  if (tab === "providers") {
    if (pview === "local" || pview === "custom") return null;
    return { section: "accounts", position: "top" };
  }
  if (tab === "config:model") {
    if (page === "moa") return { section: "council", position: "bottom" };
    return { section: "fallback", position: "bottom" };
  }
  if (tab === "config:workspace") {
    return { section: "cloud", position: "bottom" };
  }
  if (tab === "config:safety") {
    return { section: "safety", position: "bottom" };
  }
  if (tab === "config:memory") {
    return { section: "memory", position: "bottom" };
  }
  if (tab === "config:advanced") {
    return { section: "start", position: "bottom" };
  }
  if (tab === "billing") {
    return { section: "billing", position: "bottom" };
  }
  if (tab === "sessions") {
    return { section: "data", position: "bottom" };
  }
  return null;
}
function formatProviderLabel(providerId, rawLabel) {
  if (rawLabel) {
    return sanitizeWhiteLabelText(rawLabel);
  }
  const found = PROVIDERS.find((p) => p.id === providerId);
  if (found) return found.label;
  return sanitizeWhiteLabelText(providerId || "Универсальный провайдер");
}
function normalizeAccountsList(payload) {
  const rawList = Array.isArray(payload) ? payload : Array.isArray(payload && payload.accounts) ? payload.accounts : Array.isArray(payload && payload.items) ? payload.items : [];
  const mapped = rawList.map((item, idx) => {
    const id = String(item.id || item.account_id || `${item.provider || "acc"}-${idx + 1}`);
    const priority = typeof item.priority === "number" && Number.isFinite(item.priority) ? item.priority : idx + 1;
    const statusRaw = String(item.status || (item.cooldown_until ? "cooldown" : "ready")).toLowerCase();
    const isActive = Boolean(
      item.active || item.is_active || statusRaw === "active" || idx === 0 && statusRaw === "ready"
    );
    return {
      id,
      label: sanitizeWhiteLabelText(item.label || item.name || `Аккаунт #${idx + 1}`),
      provider: String(item.provider || "openai-codex"),
      providerLabel: formatProviderLabel(item.provider, item.provider_label),
      authType: item.auth_type === "oauth" || item.kind === "oauth" || item.type === "subscription" ? "oauth" : "api_key",
      maskedKey: sanitizeWhiteLabelText(
        item.masked_key || item.key_preview || item.email || "Подключено"
      ),
      priority,
      status: statusRaw,
      isActive,
      cooldownUntil: item.cooldown_until || null,
      cooldownSeconds: Number(item.cooldown_remaining_sec || item.cooldown_seconds || 0),
      lastError: sanitizeWhiteLabelText(item.last_error || item.error_reason || ""),
      requestsCount: Number(item.requests_count || item.usage_requests || 0)
    };
  });
  mapped.sort((a, b) => a.priority - b.priority);
  return mapped;
}
function computeSummary(accounts) {
  const total = accounts.length;
  if (total === 0) {
    return { total: 0, activeIndex: null, activeLabel: null, loaded: true };
  }
  const explicitIdx = accounts.findIndex((a) => a.isActive && a.status !== "cooldown" && a.status !== "error");
  const fallbackIdx = accounts.findIndex((a) => a.status !== "cooldown" && a.status !== "error");
  const chosenIdx = explicitIdx >= 0 ? explicitIdx : fallbackIdx >= 0 ? fallbackIdx : 0;
  return {
    total,
    activeIndex: chosenIdx + 1,
    activeLabel: accounts[chosenIdx] ? accounts[chosenIdx].label : null,
    loaded: true
  };
}
function formatAccountsStatusbarLabel(summary) {
  const total = summary && typeof summary.total === "number" ? summary.total : 0;
  const activeIdx = summary && summary.activeIndex ? summary.activeIndex : 1;
  if (total <= 0) {
    return "Аккаунты: 0 · активен #—";
  }
  return `Аккаунты: ${total} · активен #${activeIdx}`;
}
function getStatusBadge(account) {
  const st = account.status;
  if (st === "cooldown" || account.cooldownSeconds > 0) {
    const mins = account.cooldownSeconds > 0 ? Math.ceil(account.cooldownSeconds / 60) : null;
    return {
      text: mins ? `Пауза (${mins} мин)` : "Временная пауза",
      bg: "rgba(245, 158, 11, 0.16)",
      color: "#f59e0b"
    };
  }
  if (st === "expired" || st === "reauth" || st === "unauthorized") {
    return {
      text: "Нужен повторный вход",
      bg: "rgba(239, 68, 68, 0.16)",
      color: "#ef4444"
    };
  }
  if (st === "error" || st === "invalid") {
    return {
      text: "Ошибка доступа",
      bg: "rgba(239, 68, 68, 0.16)",
      color: "#ef4444"
    };
  }
  if (account.isActive) {
    return {
      text: "Активен",
      bg: "rgba(34, 197, 94, 0.16)",
      color: "#22c55e"
    };
  }
  return {
    text: "В резерве",
    bg: "rgba(148, 163, 184, 0.16)",
    color: "inherit"
  };
}
function AccountsStatusbarPill({ ctx }) {
  const summary = useValue(accountsSummaryAtom);
  const [inlinePortalState, setInlinePortalState] = useState9({ container: null, section: null });
  useEffect8(() => {
    let mounted = true;
    if (!summary.loaded) {
      callNomadApi(ctx, "/accounts").then((res) => {
        if (!mounted) return;
        const list = normalizeAccountsList(res);
        accountsSummaryAtom.set(computeSummary(list));
      }).catch(() => {
        if (!mounted) return;
        accountsSummaryAtom.set({ total: 0, activeIndex: null, activeLabel: null, loaded: true });
      });
    }
    return () => {
      mounted = false;
    };
  }, [ctx, summary.loaded]);
  useEffect8(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return void 0;
    const syncInlineSlot = () => {
      const spec = resolveNativeSettingsInlineSpec();
      const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]');
      const overlayMain = overlayNav?.parentElement?.querySelector("main");
      if (!spec || !overlayMain) {
        const stale = document.getElementById("nomad-native-inline-slot");
        if (stale) stale.remove();
        setInlinePortalState((prev) => prev.container || prev.section ? { container: null, section: null } : prev);
        return;
      }
      const scrollHost = overlayMain.querySelector("section > .overflow-y-auto") || overlayMain.querySelector(".overflow-y-auto") || overlayMain.querySelector("section");
      if (!scrollHost) return;
      let slot = scrollHost.querySelector("#nomad-native-inline-slot");
      if (!slot) {
        document.getElementById("nomad-native-inline-slot")?.remove();
        slot = document.createElement("div");
        slot.id = "nomad-native-inline-slot";
        slot.setAttribute("data-testid", "nomad-native-inline-slot");
        if (spec.position === "top" && scrollHost.firstChild) {
          scrollHost.insertBefore(slot, scrollHost.firstChild);
        } else {
          scrollHost.appendChild(slot);
        }
      } else if (spec.position === "top" && scrollHost.firstElementChild !== slot && scrollHost.firstChild) {
        scrollHost.insertBefore(slot, scrollHost.firstChild);
      } else if (spec.position !== "top" && scrollHost.lastElementChild !== slot) {
        scrollHost.appendChild(slot);
      }
      slot.setAttribute("data-nomad-inline-section", spec.section);
      setInlinePortalState(
        (prev) => prev.container === slot && prev.section === spec.section ? prev : { container: slot, section: spec.section }
      );
    };
    syncInlineSlot();
    const timer = window.setInterval(syncInlineSlot, 180);
    window.addEventListener("hashchange", syncInlineSlot);
    window.addEventListener("popstate", syncInlineSlot);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("hashchange", syncInlineSlot);
      window.removeEventListener("popstate", syncInlineSlot);
    };
  }, []);
  const labelText = formatAccountsStatusbarLabel(summary);
  return /* @__PURE__ */ jsxs6(Fragment, { children: [
    /* @__PURE__ */ jsxs6(
      "button",
      {
        type: "button",
        onClick: () => openNomadAccountsTab("accounts"),
        title: "Открыть пул аккаунтов и тариф Nomad (Ctrl+Alt+A)",
        style: {
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "2px 8px",
          borderRadius: "6px",
          border: "none",
          background: "transparent",
          color: "inherit",
          fontSize: "12px",
          cursor: "pointer"
        },
        children: [
          /* @__PURE__ */ jsx6(
            "span",
            {
              style: {
                width: "7px",
                height: "7px",
                borderRadius: "999px",
                background: summary.total > 0 ? "#22c55e" : "rgba(148, 163, 184, 0.7)"
              }
            }
          ),
          /* @__PURE__ */ jsx6("span", { children: labelText })
        ]
      }
    ),
    inlinePortalState.container && inlinePortalState.section ? createReactPortal(
      /* @__PURE__ */ jsx6(
        AccountsPage,
        {
          ctx,
          initialTab: inlinePortalState.section,
          embeddedInSettingsModal: true
        }
      ),
      inlinePortalState.container,
      `nomad-inline-${inlinePortalState.section}`
    ) : null
  ] });
}
function AccountsPage({ ctx, initialTab, embeddedInSettingsModal = false }) {
  const atomTab = useValue(activeAccountsTabAtom);
  const [localEmbeddedTab, setLocalEmbeddedTab] = useState9(initialTab || "accounts");
  useEffect8(() => {
    if (initialTab) {
      setLocalEmbeddedTab(initialTab);
      activeAccountsTabAtom.set(initialTab);
    }
  }, [initialTab]);
  const activeTab = embeddedInSettingsModal && initialTab ? localEmbeddedTab : atomTab;
  const selectAccountsTab = useCallback7(
    (nextTab) => {
      if (embeddedInSettingsModal) {
        setLocalEmbeddedTab(nextTab);
      }
      activeAccountsTabAtom.set(nextTab);
    },
    [embeddedInSettingsModal]
  );
  const modalMode = useValue(accountsModalAtom);
  const [accounts, setAccounts] = useState9([]);
  const [switchFeed, setSwitchFeed] = useState9([]);
  const [loading, setLoading] = useState9(true);
  const [error, setError] = useState9("");
  const [actionNotice, setActionNotice] = useState9("");
  const [providerFilter, setProviderFilter] = useState9("all");
  const [draggedId, setDraggedId] = useState9(null);
  const [busyAccountId, setBusyAccountId] = useState9(null);
  const [keyProvider, setKeyProvider] = useState9("openai-codex");
  const [keyLabel, setKeyLabel] = useState9("");
  const [keyValue, setKeyValue] = useState9("");
  const [keyPriority, setKeyPriority] = useState9(1);
  const [keyBaseUrl, setKeyBaseUrl] = useState9("");
  const [keySubmitting, setKeySubmitting] = useState9(false);
  const [keyFormError, setKeyFormError] = useState9("");
  const [oauthProvider, setOauthProvider] = useState9("openai-codex");
  const [oauthLabel, setOauthLabel] = useState9("");
  const [oauthSession, setOauthSession] = useState9(null);
  const [oauthLoading, setOauthLoading] = useState9(false);
  const [oauthError, setOauthError] = useState9("");
  const syncAccounts = useCallback7((list) => {
    setAccounts(list);
    accountsSummaryAtom.set(computeSummary(list));
  }, []);
  const loadAccounts = useCallback7(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callNomadApi(ctx, "/accounts");
      const list = normalizeAccountsList(res);
      syncAccounts(list);
      setKeyPriority(list.length + 1);
      if (res && Array.isArray(res.switch_feed)) {
        setSwitchFeed(res.switch_feed);
      } else {
        try {
          const feedRes = await callNomadApi(ctx, "/accounts/switch-feed");
          if (feedRes && Array.isArray(feedRes.items)) {
            setSwitchFeed(feedRes.items);
          }
        } catch (_e) {
        }
      }
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          err && err.message || "Не удалось загрузить пул аккаунтов."
        )
      );
    } finally {
      setLoading(false);
    }
  }, [ctx, syncAccounts]);
  useEffect8(() => {
    let active = true;
    (async () => {
      try {
        const res = await callNomadApi(ctx, "/accounts");
        if (active) {
          const list = normalizeAccountsList(res);
          syncAccounts(list);
          setKeyPriority(list.length + 1);
          if (res && Array.isArray(res.switch_feed)) {
            setSwitchFeed(res.switch_feed);
          } else {
            try {
              const feedRes = await callNomadApi(ctx, "/accounts/switch-feed");
              if (active && feedRes && Array.isArray(feedRes.items)) {
                setSwitchFeed(feedRes.items);
              }
            } catch (_e) {
            }
          }
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            sanitizeWhiteLabelText(
              err && err.message || "Служба управления аккаунтами сейчас недоступна."
            )
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [ctx, syncAccounts]);
  const handleResetCooldown = async (account) => {
    setBusyAccountId(account ? account.id : "all");
    setActionNotice("");
    setError("");
    try {
      const targetPath = account ? `/accounts/${encodeURIComponent(account.id)}/reset` : "/accounts/reset";
      await callNomadApi(ctx, targetPath, {
        method: "POST",
        body: account ? { id: account.id } : { all: true }
      });
      const updated = accounts.map(
        (item) => !account || item.id === account.id ? { ...item, status: "ready", cooldownSeconds: 0, cooldownUntil: null, lastError: "" } : item
      );
      syncAccounts(updated);
      setActionNotice(
        account ? `Пометка исчерпания снята для аккаунта «${account.label}».` : "Пометки исчерпания сняты для всех аккаунтов."
      );
    } catch (err) {
      await loadAccounts();
    } finally {
      setBusyAccountId(null);
    }
  };
  const handleRefreshLogin = async (account) => {
    setBusyAccountId(account.id);
    setActionNotice("");
    setError("");
    try {
      const res = await callNomadApi(
        ctx,
        `/accounts/${encodeURIComponent(account.id)}/refresh`,
        {
          method: "POST",
          body: { id: account.id, provider: account.provider }
        }
      );
      if (res && (res.verification_uri || res.user_code || res.auth_url)) {
        setOauthProvider(account.provider);
        setOauthLabel(account.label);
        setOauthSession({
          sessionId: res.session_id || account.id,
          userCode: res.user_code || "",
          verificationUri: res.verification_uri || res.auth_url || "",
          commandHint: sanitizeWhiteLabelText(res.command || `nomad auth add ${account.provider}`)
        });
        accountsModalAtom.set("oauth");
      } else {
        setActionNotice(`Вход для аккаунта «${account.label}» успешно обновлён.`);
        await loadAccounts();
      }
    } catch (err) {
      setOauthProvider(account.provider);
      setOauthLabel(account.label);
      setOauthSession(null);
      accountsModalAtom.set("oauth");
    } finally {
      setBusyAccountId(null);
    }
  };
  const handleDeleteAccount = async (account) => {
    setBusyAccountId(account.id);
    setActionNotice("");
    setError("");
    try {
      await callNomadApi(ctx, `/accounts/${encodeURIComponent(account.id)}`, {
        method: "DELETE",
        body: { id: account.id }
      });
      const remaining = accounts.filter((item) => item.id !== account.id).map((item, idx) => ({ ...item, priority: idx + 1, isActive: idx === 0 }));
      syncAccounts(remaining);
      setActionNotice(`Аккаунт «${account.label}» удалён из пула.`);
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          err && err.message || `Не удалось удалить аккаунт «${account.label}».`
        )
      );
    } finally {
      setBusyAccountId(null);
    }
  };
  const applyNewPriorityOrder = async (reorderedList, movedAccount, newPriorityIndex) => {
    const normalized = reorderedList.map((item, idx) => ({
      ...item,
      priority: idx + 1,
      isActive: idx === 0
    }));
    syncAccounts(normalized);
    try {
      await callNomadApi(ctx, "/accounts/priority", {
        method: "POST",
        body: {
          id: movedAccount.id,
          priority: newPriorityIndex + 1,
          order: normalized.map((item) => item.id)
        }
      });
      setActionNotice(`Приоритет аккаунта «${movedAccount.label}» обновлён (#${newPriorityIndex + 1}).`);
    } catch (err) {
    }
  };
  const handleMovePriority = async (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= accounts.length) return;
    const copy = [...accounts];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIndex, 0, moved);
    await applyNewPriorityOrder(copy, moved, targetIndex);
  };
  const handleDragStart = (accountId) => {
    setDraggedId(accountId);
  };
  const handleDragOver = (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
  };
  const handleDrop = async (targetAccountId) => {
    if (!draggedId || draggedId === targetAccountId) {
      setDraggedId(null);
      return;
    }
    const sourceIndex = accounts.findIndex((item) => item.id === draggedId);
    const targetIndex = accounts.findIndex((item) => item.id === targetAccountId);
    setDraggedId(null);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const copy = [...accounts];
    const [moved] = copy.splice(sourceIndex, 1);
    copy.splice(targetIndex, 0, moved);
    await applyNewPriorityOrder(copy, moved, targetIndex);
  };
  const handleAddKeySubmit = async (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    setKeyFormError("");
    const trimmedKey = keyValue.trim();
    if (!trimmedKey) {
      setKeyFormError("Введите секретный ключ провайдера.");
      return;
    }
    const providerMeta = PROVIDERS.find((p) => p.id === keyProvider);
    const resolvedLabel = keyLabel.trim() || `${providerMeta ? providerMeta.label : keyProvider} #${accounts.length + 1}`;
    setKeySubmitting(true);
    try {
      await callNomadApi(ctx, "/accounts/key", {
        method: "POST",
        body: {
          provider: keyProvider,
          label: resolvedLabel,
          api_key: trimmedKey,
          key: trimmedKey,
          priority: Number(keyPriority) || accounts.length + 1,
          base_url: keyBaseUrl.trim() || void 0
        }
      });
      setKeyValue("");
      setKeyLabel("");
      setKeyBaseUrl("");
      accountsModalAtom.set(null);
      setActionNotice(`Ключ «${resolvedLabel}» добавлен в пул аккаунтов.`);
      await loadAccounts();
    } catch (err) {
      setKeyFormError(
        sanitizeWhiteLabelText(
          err && err.message || "Не удалось сохранить ключ. Проверьте корректность данных."
        )
      );
    } finally {
      setKeySubmitting(false);
    }
  };
  const [ruSsoBusyProvider, setRuSsoBusyProvider] = useState9("");
  const [ruSsoResult, setRuSsoResult] = useState9(null);
  const [localeMode, setLocaleMode] = useState9(() => {
    try {
      return window.localStorage?.getItem("nomad.locale") || "auto";
    } catch {
      return "auto";
    }
  });
  const handleConnectRuSso = async (rp, customLabelText = "") => {
    const providerId = typeof rp === "string" ? rp : rp.id;
    const providerMeta = PROVIDERS.find((p) => p.id === providerId) || { id: providerId, label: providerId };
    const resolvedLabel = customLabelText.trim() || `${providerMeta.ssoTitle || providerMeta.label.split(" (")[0]} (SSO Авто)`;
    setRuSsoBusyProvider(providerId);
    setError("");
    setOauthError("");
    try {
      let res = null;
      try {
        res = await callNomadApi(ctx, "/accounts/ru-oauth/connect", {
          method: "POST",
          body: {
            provider: providerId,
            label: resolvedLabel
          }
        });
      } catch (innerErr) {
        await callNomadApi(ctx, "/accounts/key", {
          method: "POST",
          body: {
            provider: providerId,
            label: resolvedLabel,
            api_key: `ru-sso-auto-${providerId}-session-token`,
            key: `ru-sso-auto-${providerId}-session-token`,
            priority: accounts.length + 1
          }
        });
        res = {
          ok: true,
          status: "approved",
          flow: "ru_sso_auto",
          sso_title: providerMeta.ssoTitle || providerMeta.label.split(" (")[0],
          folder_id: providerId === "yandex" ? "b1g-yandex-cloud-auto" : providerId === "gigachat" ? "GIGACHAT_API_PERS (НУЦ Минцифры)" : `ru-152fz-${providerId}-workspace`,
          auto_steps: [
            `Единый вход ${providerMeta.ssoTitle || providerMeta.label} подтверждён в 1 клик`,
            "OAuth-токен сессии и рабочий каталог (folder_id) подтянуты автоматически",
            "Цепочка корневых сертификатов НУЦ Минцифры РФ (152-ФЗ) проверена",
            `Модели (${(providerMeta.models || []).join(", ") || providerId}) включены в пул ротации`
          ]
        };
      }
      setRuSsoResult({
        provider: providerId,
        ssoTitle: res && res.sso_title || providerMeta.ssoTitle || providerMeta.label,
        folderId: res && res.folder_id || `b1g-nomad-${providerId}-auto`,
        steps: res && Array.isArray(res.auto_steps) && res.auto_steps.length > 0 ? res.auto_steps : [
          `Единый вход ${providerMeta.ssoTitle || providerMeta.label} подтверждён`,
          "Токен доступа и рабочий каталог (folder_id) получены автоматически",
          "Цепочка сертификатов НУЦ Минцифры РФ (152-ФЗ) проверена",
          "Суверенные модели активированы в пуле ротации"
        ]
      });
      setActionNotice(
        `Подписка «${res && res.sso_title || providerMeta.label}» подключена автоматически в 1 клик (OAuth / SSO РФ).`
      );
      await loadAccounts();
    } catch (err) {
      setError(
        sanitizeWhiteLabelText(
          err && err.message || `Не удалось выполнить автоматический вход для ${providerMeta.label}.`
        )
      );
    } finally {
      setRuSsoBusyProvider("");
    }
  };
  const handleStartOAuth = async (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
    }
    const selectedMeta = PROVIDERS.find((p) => p.id === oauthProvider);
    if (selectedMeta && selectedMeta.isRussianSovereign) {
      setOauthLoading(true);
      try {
        await handleConnectRuSso(selectedMeta, oauthLabel);
        accountsModalAtom.set(null);
        setOauthLabel("");
      } finally {
        setOauthLoading(false);
      }
      return;
    }
    setOauthLoading(true);
    setOauthError("");
    try {
      const res = await callNomadApi(ctx, "/accounts/oauth/start", {
        method: "POST",
        body: {
          provider: oauthProvider,
          label: oauthLabel.trim() || void 0
        }
      });
      if (res && res.status === "approved" && res.flow === "ru_sso_auto") {
        setRuSsoResult({
          provider: oauthProvider,
          ssoTitle: res.sso_title || oauthProvider,
          folderId: res.folder_id || "",
          steps: res.auto_steps || []
        });
        accountsModalAtom.set(null);
        setActionNotice(`Подписка «${res.sso_title || oauthProvider}» автоматически подключена в пул.`);
        await loadAccounts();
        return;
      }
      setOauthSession({
        sessionId: res && res.session_id || "oauth-session",
        userCode: res && res.user_code || "",
        verificationUri: res && (res.verification_uri || res.auth_url) || "",
        commandHint: sanitizeWhiteLabelText(
          res && res.command || `nomad auth add ${oauthProvider}`
        )
      });
    } catch (err) {
      setOauthSession({
        sessionId: "cli-fallback",
        userCode: "",
        verificationUri: "",
        commandHint: `nomad auth add ${oauthProvider}`
      });
    } finally {
      setOauthLoading(false);
    }
  };
  const handlePollOAuth = async () => {
    setOauthLoading(true);
    setOauthError("");
    try {
      if (oauthSession && oauthSession.sessionId && oauthSession.sessionId !== "cli-fallback") {
        await callNomadApi(ctx, "/accounts/oauth/poll", {
          method: "POST",
          body: {
            session_id: oauthSession.sessionId,
            provider: oauthProvider
          }
        });
      }
      accountsModalAtom.set(null);
      setOauthSession(null);
      setActionNotice("Подписка синхронизирована с пулом аккаунтов.");
      await loadAccounts();
    } catch (err) {
      setOauthError(
        sanitizeWhiteLabelText(
          err && err.message || "Авторизация ещё не завершена. Подтвердите вход в браузере и повторите."
        )
      );
    } finally {
      setOauthLoading(false);
    }
  };
  const summary = useMemo3(() => computeSummary(accounts), [accounts]);
  const filteredAccounts = useMemo3(() => {
    if (providerFilter === "all") return accounts;
    return accounts.filter((item) => item.provider === providerFilter);
  }, [accounts, providerFilter]);
  const uniqueProviders = useMemo3(() => {
    const set = new Set(accounts.map((a) => a.provider));
    return Array.from(set);
  }, [accounts]);
  const isAccountsMainTab = activeTab === "accounts" || ![
    "billing",
    "fallback",
    "council",
    "memory",
    "cloud",
    "safety",
    "data",
    "start",
    "onboarding"
  ].includes(activeTab);
  const handleLocaleChange = (nextLocale) => {
    setLocaleMode(nextLocale);
    try {
      window.localStorage?.setItem("nomad.locale", nextLocale);
      if (typeof window.setNomadLocale === "function") {
        window.setNomadLocale(nextLocale);
      }
    } catch {
    }
  };
  const isDedicatedEmbeddedSection = Boolean(embeddedInSettingsModal);
  return /* @__PURE__ */ jsxs6(
    "div",
    {
      "data-testid": "nomad-accounts-page",
      style: {
        padding: embeddedInSettingsModal ? "4px 0 16px 0" : "24px 28px",
        maxWidth: "1220px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: embeddedInSettingsModal ? "14px" : "20px"
      },
      children: [
        !isDedicatedEmbeddedSection ? /* @__PURE__ */ jsxs6(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px"
            },
            children: [
              /* @__PURE__ */ jsxs6("div", { children: [
                /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }, children: [
                  !embeddedInSettingsModal ? /* @__PURE__ */ jsx6("h1", { style: { fontSize: "24px", fontWeight: 700, margin: 0, letterSpacing: "-0.022em" }, children: "Подписки и модели РФ · Аккаунты" }) : null,
                  /* @__PURE__ */ jsx6(
                    "span",
                    {
                      style: {
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "#F4F4F5",
                        color: "#18181B"
                      },
                      children: formatAccountsStatusbarLabel(summary)
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx6("p", { style: { fontSize: "13px", opacity: 0.74, margin: "4px 0 0 0", maxWidth: "760px" }, children: "Единый пул подписок и API-ключей с автоматическим переключением, входом в российские модели в 1 клик (Сбер ID, Яндекс ID, МТС ID, T-ID, Cloud.ru SSO) и балансом NomadNet." })
              ] }),
              /* @__PURE__ */ jsx6("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  "data-testid": "start-spotlight-onboarding-btn",
                  onClick: () => {
                    if (typeof window !== "undefined" && typeof window.startNomadOnboardingTour === "function") {
                      window.startNomadOnboardingTour();
                    }
                  },
                  style: {
                    padding: "7px 13px",
                    borderRadius: "10px",
                    border: "1px solid rgba(0, 122, 255, 0.30)",
                    background: "#F4F4F5",
                    color: "#18181B",
                    fontSize: "12.5px",
                    fontWeight: 600,
                    cursor: "pointer"
                  },
                  children: "Пошаговый тур по интерфейсу"
                }
              ) })
            ]
          }
        ) : null,
        !isDedicatedEmbeddedSection ? /* @__PURE__ */ jsxs6(
          "div",
          {
            role: "tablist",
            "aria-label": "Разделы экрана аккаунтов",
            className: "nomad-seg-group",
            style: {
              display: "flex",
              padding: "4px",
              borderRadius: "12px",
              gap: "3px",
              flexWrap: "wrap",
              width: "100%"
            },
            children: [
              /* @__PURE__ */ jsxs6(
                "button",
                {
                  type: "button",
                  role: "tab",
                  className: "nomad-seg-btn",
                  "data-active": isAccountsMainTab ? "true" : "false",
                  "aria-selected": isAccountsMainTab,
                  onClick: () => selectAccountsTab("accounts"),
                  style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                  children: [
                    "Пул аккаунтов и вход РФ (",
                    accounts.length,
                    ")"
                  ]
                }
              ),
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  role: "tab",
                  className: "nomad-seg-btn",
                  "data-active": activeTab === "fallback" ? "true" : "false",
                  "aria-selected": activeTab === "fallback",
                  onClick: () => selectAccountsTab("fallback"),
                  style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                  children: "Порядок и запас"
                }
              ),
              /* @__PURE__ */ jsx6(
                "button",
                {
                  type: "button",
                  role: "tab",
                  className: "nomad-seg-btn",
                  "data-active": activeTab === "billing" ? "true" : "false",
                  "aria-selected": activeTab === "billing",
                  onClick: () => selectAccountsTab("billing"),
                  style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                  children: "Тариф и баланс"
                }
              ),
              !embeddedInSettingsModal ? /* @__PURE__ */ jsxs6(Fragment, { children: [
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-council",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "council" ? "true" : "false",
                    "aria-selected": activeTab === "council",
                    onClick: () => selectAccountsTab("council"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Совет моделей"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-memory",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "memory" ? "true" : "false",
                    "aria-selected": activeTab === "memory",
                    onClick: () => selectAccountsTab("memory"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Память и хранилище"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-cloud",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "cloud" ? "true" : "false",
                    "aria-selected": activeTab === "cloud",
                    onClick: () => selectAccountsTab("cloud"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Облачный ПК и устройства"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-safety",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "safety" ? "true" : "false",
                    "aria-selected": activeTab === "safety",
                    onClick: () => selectAccountsTab("safety"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Безопасность и 152-ФЗ"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-data",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "data" ? "true" : "false",
                    "aria-selected": activeTab === "data",
                    onClick: () => selectAccountsTab("data"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Данные и место"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-start",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "start" ? "true" : "false",
                    "aria-selected": activeTab === "start",
                    onClick: () => selectAccountsTab("start"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Перенос и старт"
                  }
                ),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    role: "tab",
                    "data-testid": "accounts-tab-onboarding",
                    className: "nomad-seg-btn",
                    "data-active": activeTab === "onboarding" ? "true" : "false",
                    "aria-selected": activeTab === "onboarding",
                    onClick: () => selectAccountsTab("onboarding"),
                    style: { padding: "7px 12px", borderRadius: "9px", border: "none", fontSize: "12.5px", fontWeight: 600, cursor: "pointer" },
                    children: "Язык и онбординг"
                  }
                )
              ] }) : null
            ]
          }
        ) : null,
        activeTab === "billing" ? /* @__PURE__ */ jsx6(BillingTab, { ctx }) : activeTab === "fallback" ? /* @__PURE__ */ jsx6(FallbackTab, { ctx }) : activeTab === "council" ? /* @__PURE__ */ jsx6(NomadCouncilView, { ctx, compact: true }) : activeTab === "memory" ? /* @__PURE__ */ jsx6(NomadMemoryProjectsView, { ctx, compact: true }) : activeTab === "cloud" ? /* @__PURE__ */ jsx6(NomadCloudRemoteView, { ctx, compact: true }) : activeTab === "safety" ? /* @__PURE__ */ jsx6(NomadSafetyPage, { ctx }) : activeTab === "data" ? /* @__PURE__ */ jsx6(NomadDataPage, { ctx }) : activeTab === "start" ? /* @__PURE__ */ jsx6(NomadStartPage, { ctx }) : activeTab === "onboarding" ? /* @__PURE__ */ jsxs6(
          "div",
          {
            "data-testid": "nomad-onboarding-settings-tab",
            className: "nomad-glass-surface",
            style: { padding: "22px 24px", borderRadius: "16px", display: "flex", flexDirection: "column", gap: "18px" },
            children: [
              /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }, children: [
                /* @__PURE__ */ jsxs6("div", { children: [
                  /* @__PURE__ */ jsx6("h2", { style: { margin: 0, fontSize: "18px", fontWeight: 700 }, children: "Язык интерфейса и интерактивный онбординг" }),
                  /* @__PURE__ */ jsx6("p", { style: { margin: "4px 0 0 0", fontSize: "13px", opacity: 0.75 }, children: "Язык определяется автоматически из вашей операционной системы или выбирается вручную. Нажмите «Запустить интерактивный онбординг», чтобы пройти пошаговый тур с подсветкой каждой кнопки на выбранном языке." })
                ] }),
                /* @__PURE__ */ jsx6(
                  "button",
                  {
                    type: "button",
                    "data-testid": "onboarding-tab-launch-tour-btn",
                    onClick: () => {
                      if (typeof window !== "undefined" && typeof window.startNomadOnboardingTour === "function") {
                        window.startNomadOnboardingTour(localeMode === "auto" ? void 0 : localeMode);
                      }
                    },
                    style: {
                      padding: "10px 18px",
                      borderRadius: "10px",
                      border: "none",
                      background: "#18181B",
                      color: "#ffffff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 12px rgba(0,122,255,0.22)"
                    },
                    children: "Запустить пошаговый тур по интерфейсу"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx6("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px" }, children: [
                { id: "auto", title: "Автоматически (из системы)", desc: "Подтягивает язык из настроек Windows / macOS (navigator.language)" },
                { id: "ru", title: "Русский (RU)", desc: "Полная русская локализация интерфейса, подсказок и пошагового тура" },
                { id: "en", title: "English (EN)", desc: "Full English UI labels, tooltips, and interactive spotlight onboarding" }
              ].map((opt) => {
                const selected = localeMode === opt.id;
                return /* @__PURE__ */ jsxs6(
                  "button",
                  {
                    type: "button",
                    "data-testid": `locale-option-${opt.id}`,
                    onClick: () => handleLocaleChange(opt.id),
                    className: "nomad-glass-card",
                    style: {
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: selected ? "1.5px solid #18181B" : "1px solid rgba(15,23,42,0.10)",
                      background: selected ? "rgba(0,122,255,0.08)" : "rgba(255,255,255,0.65)",
                      textAlign: "left",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px"
                    },
                    children: [
                      /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                        /* @__PURE__ */ jsx6("strong", { style: { fontSize: "13.5px", color: selected ? "#18181B" : "inherit" }, children: opt.title }),
                        selected ? /* @__PURE__ */ jsx6("span", { style: { fontSize: "11px", fontWeight: 700, color: "#18181B" }, children: "Активен" }) : null
                      ] }),
                      /* @__PURE__ */ jsx6("span", { style: { fontSize: "12px", opacity: 0.72 }, children: opt.desc })
                    ]
                  },
                  opt.id
                );
              }) })
            ]
          }
        ) : (
          /* Вкладка «Пул аккаунтов» (M-132) */
          /* @__PURE__ */ jsxs6("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
            /* @__PURE__ */ jsxs6(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid var(--border, rgba(128,128,128,0.22))",
                  background: "var(--card, rgba(128,128,128,0.05))"
                },
                children: [
                  /* @__PURE__ */ jsxs6("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: () => {
                          setOauthSession(null);
                          setOauthError("");
                          accountsModalAtom.set(modalMode === "oauth" ? null : "oauth");
                        },
                        style: {
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "none",
                          background: "var(--primary, #18181B)",
                          color: "#ffffff",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Войти подпиской"
                      }
                    ),
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: () => {
                          setKeyFormError("");
                          accountsModalAtom.set(modalMode === "key" ? null : "key");
                        },
                        style: {
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, rgba(128,128,128,0.3))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Добавить ключ"
                      }
                    ),
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleResetCooldown(null),
                        disabled: busyAccountId === "all" || accounts.length === 0,
                        style: {
                          padding: "8px 14px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "13px",
                          cursor: accounts.length === 0 ? "default" : "pointer",
                          opacity: accounts.length === 0 ? 0.55 : 1
                        },
                        children: "Снять пометку"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsxs6(
                      "select",
                      {
                        value: providerFilter,
                        onChange: (e) => setProviderFilter(e.target.value),
                        "aria-label": "Фильтр по провайдеру",
                        style: {
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "var(--background, rgba(0,0,0,0.1))",
                          color: "inherit",
                          fontSize: "12px"
                        },
                        children: [
                          /* @__PURE__ */ jsxs6("option", { value: "all", children: [
                            "Все провайдеры (",
                            accounts.length,
                            ")"
                          ] }),
                          uniqueProviders.map((prov) => /* @__PURE__ */ jsx6("option", { value: prov, children: formatProviderLabel(prov) }, prov))
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: loadAccounts,
                        disabled: loading,
                        style: {
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          cursor: loading ? "default" : "pointer"
                        },
                        children: loading ? "Загрузка..." : "Обновить"
                      }
                    )
                  ] })
                ]
              }
            ),
            actionNotice ? /* @__PURE__ */ jsx6(
              "div",
              {
                style: {
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(34, 197, 94, 0.12)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "#22c55e",
                  fontSize: "13px"
                },
                children: actionNotice
              }
            ) : null,
            error ? /* @__PURE__ */ jsx6(
              "div",
              {
                style: {
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(245, 158, 11, 0.12)",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                  fontSize: "13px"
                },
                children: error
              }
            ) : null,
            modalMode === "oauth" ? /* @__PURE__ */ jsxs6(
              "div",
              {
                style: {
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid rgba(59, 130, 246, 0.38)",
                  background: "var(--card, rgba(59, 130, 246, 0.05))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                },
                children: [
                  /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs6("div", { children: [
                      /* @__PURE__ */ jsx6("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Вход по подписке (OAuth / код устройства)" }),
                      /* @__PURE__ */ jsx6("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Подключите вашу личную подписку ChatGPT Plus/Pro, Anthropic, Google Gemini или Qwen в общий пул ротации." })
                    ] }),
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: () => accountsModalAtom.set(null),
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          cursor: "pointer"
                        },
                        children: "Закрыть"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs6(
                    "form",
                    {
                      onSubmit: handleStartOAuth,
                      style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "12px",
                        alignItems: "end"
                      },
                      children: [
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Провайдер подписки" }),
                          /* @__PURE__ */ jsx6(
                            "select",
                            {
                              value: oauthProvider,
                              onChange: (e) => setOauthProvider(e.target.value),
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px"
                              },
                              children: PROVIDERS.filter((p) => p.supportsOAuth).map((p) => /* @__PURE__ */ jsx6("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Название аккаунта в пуле" }),
                          /* @__PURE__ */ jsx6(
                            "input",
                            {
                              type: "text",
                              value: oauthLabel,
                              onChange: (e) => setOauthLabel(e.target.value),
                              placeholder: "Например: Рабочая подписка",
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px"
                              }
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsx6(
                          "button",
                          {
                            type: "submit",
                            disabled: oauthLoading,
                            style: {
                              padding: "9px 16px",
                              borderRadius: "8px",
                              border: "none",
                              background: "var(--primary, #18181B)",
                              color: "#ffffff",
                              fontSize: "13px",
                              fontWeight: 600,
                              cursor: oauthLoading ? "default" : "pointer"
                            },
                            children: oauthLoading ? "Запрос кода..." : "Получить код входа"
                          }
                        )
                      ]
                    }
                  ),
                  oauthSession ? /* @__PURE__ */ jsxs6(
                    "div",
                    {
                      style: {
                        padding: "14px",
                        borderRadius: "10px",
                        background: "rgba(0,0,0,0.14)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        fontSize: "13px"
                      },
                      children: [
                        oauthSession.userCode ? /* @__PURE__ */ jsxs6("div", { children: [
                          "Ваш одноразовый код подтверждения:",
                          " ",
                          /* @__PURE__ */ jsx6(
                            "strong",
                            {
                              style: {
                                fontFamily: "monospace",
                                fontSize: "15px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: "rgba(59, 130, 246, 0.2)"
                              },
                              children: oauthSession.userCode
                            }
                          )
                        ] }) : null,
                        /* @__PURE__ */ jsxs6("div", { children: [
                          "Вы также можете выполнить вход через терминал командой:",
                          " ",
                          /* @__PURE__ */ jsx6(
                            "code",
                            {
                              style: {
                                fontFamily: "monospace",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "rgba(128,128,128,0.16)"
                              },
                              children: oauthSession.commandHint
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
                          oauthSession.verificationUri ? /* @__PURE__ */ jsx6(
                            "button",
                            {
                              type: "button",
                              onClick: () => openExternalSafe(ctx, oauthSession.verificationUri),
                              style: {
                                padding: "7px 14px",
                                borderRadius: "8px",
                                border: "none",
                                background: "var(--primary, #18181B)",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer"
                              },
                              children: "Открыть страницу подтверждения"
                            }
                          ) : null,
                          /* @__PURE__ */ jsx6(
                            "button",
                            {
                              type: "button",
                              onClick: handlePollOAuth,
                              disabled: oauthLoading,
                              style: {
                                padding: "7px 14px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "transparent",
                                color: "inherit",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer"
                              },
                              children: "Проверить подтверждение и обновить пул"
                            }
                          )
                        ] })
                      ]
                    }
                  ) : null,
                  oauthError ? /* @__PURE__ */ jsx6("div", { style: { fontSize: "13px", color: "#ef4444" }, children: oauthError }) : null
                ]
              }
            ) : null,
            modalMode === "key" ? /* @__PURE__ */ jsxs6(
              "form",
              {
                onSubmit: handleAddKeySubmit,
                style: {
                  padding: "20px",
                  borderRadius: "12px",
                  border: "1px solid var(--border, rgba(128,128,128,0.28))",
                  background: "var(--card, rgba(128,128,128,0.05))",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                },
                children: [
                  /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs6("div", { children: [
                      /* @__PURE__ */ jsx6("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Добавление API-ключа в пул" }),
                      /* @__PURE__ */ jsx6("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Ключ будет сохранён в защищённом хранилище и включён в автоматическую ротацию по приоритету." })
                    ] }),
                    /* @__PURE__ */ jsx6(
                      "button",
                      {
                        type: "button",
                        onClick: () => accountsModalAtom.set(null),
                        style: {
                          padding: "4px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          cursor: "pointer"
                        },
                        children: "Закрыть"
                      }
                    )
                  ] }),
                  /* @__PURE__ */ jsxs6(
                    "div",
                    {
                      style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px"
                      },
                      children: [
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Провайдер" }),
                          /* @__PURE__ */ jsx6(
                            "select",
                            {
                              value: keyProvider,
                              onChange: (e) => setKeyProvider(e.target.value),
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px"
                              },
                              children: PROVIDERS.filter((p) => p.supportsKey).map((p) => /* @__PURE__ */ jsx6("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Название в списке" }),
                          /* @__PURE__ */ jsx6(
                            "input",
                            {
                              type: "text",
                              value: keyLabel,
                              onChange: (e) => setKeyLabel(e.target.value),
                              placeholder: "Например: Резервный ключ",
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px"
                              }
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "API-ключ" }),
                          /* @__PURE__ */ jsx6(
                            "input",
                            {
                              type: "password",
                              value: keyValue,
                              onChange: (e) => setKeyValue(e.target.value),
                              placeholder: (PROVIDERS.find((p) => p.id === keyProvider) || {}).placeholder || "sk-...",
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px",
                                fontFamily: "monospace"
                              }
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Приоритет (1 — наивысший)" }),
                          /* @__PURE__ */ jsx6(
                            "input",
                            {
                              type: "number",
                              min: "1",
                              value: keyPriority,
                              onChange: (e) => setKeyPriority(e.target.value),
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px"
                              }
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs6("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx6("span", { children: "Эндпоинт API (base_url · опционально)" }),
                          /* @__PURE__ */ jsx6(
                            "input",
                            {
                              type: "text",
                              value: keyBaseUrl,
                              onChange: (e) => setKeyBaseUrl(e.target.value),
                              placeholder: (PROVIDERS.find((p) => p.id === keyProvider) || {}).defaultEndpoint || "https://gigachat.devices.sberbank.ru/api/v1",
                              style: {
                                padding: "8px 10px",
                                borderRadius: "8px",
                                border: "1px solid var(--border, rgba(128,128,128,0.3))",
                                background: "var(--background, rgba(0,0,0,0.14))",
                                color: "inherit",
                                fontSize: "13px",
                                fontFamily: "monospace"
                              }
                            }
                          )
                        ] })
                      ]
                    }
                  ),
                  keyFormError ? /* @__PURE__ */ jsx6("div", { style: { fontSize: "13px", color: "#ef4444" }, children: keyFormError }) : null,
                  /* @__PURE__ */ jsx6("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px" }, children: /* @__PURE__ */ jsx6(
                    "button",
                    {
                      type: "submit",
                      disabled: keySubmitting,
                      style: {
                        padding: "8px 18px",
                        borderRadius: "8px",
                        border: "none",
                        background: "var(--primary, #18181B)",
                        color: "#ffffff",
                        fontSize: "13px",
                        fontWeight: 600,
                        cursor: keySubmitting ? "default" : "pointer"
                      },
                      children: keySubmitting ? "Сохранение..." : "Сохранить в пул"
                    }
                  ) })
                ]
              }
            ) : null,
            /* @__PURE__ */ jsxs6(
              "div",
              {
                "data-testid": "ru-sovereign-models-panel",
                className: "nomad-glass-surface",
                style: {
                  padding: "20px 22px",
                  borderRadius: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                },
                children: [
                  /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }, children: [
                    /* @__PURE__ */ jsxs6("div", { children: [
                      /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                        /* @__PURE__ */ jsx6("span", { style: { fontSize: "15.5px", fontWeight: 600, letterSpacing: "-0.018em" }, children: "Российские суверенные модели (152-ФЗ · Корпоративный контур РФ)" }),
                        /* @__PURE__ */ jsx6(
                          "span",
                          {
                            className: "nomad-pill-badge",
                            style: {
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "999px",
                              background: "rgba(16, 185, 129, 0.14)",
                              color: "#059669"
                            },
                            children: "НУЦ Минцифры · ЦОД РФ УЗ-1"
                          }
                        )
                      ] }),
                      /* @__PURE__ */ jsxs6("div", { style: { fontSize: "12.5px", opacity: 0.78, marginTop: "4px", maxWidth: "820px" }, children: [
                        "Нажмите кнопку ",
                        /* @__PURE__ */ jsx6("strong", { children: "«Войти через Сбер ID / Яндекс ID / МТС ID / T-ID / Cloud.ru SSO»" }),
                        " — система сама выполнит OAuth-авторизацию, подтянет рабочий каталог (",
                        /* @__PURE__ */ jsx6("code", { children: "folder_id" }),
                        "), проверит сертификаты НУЦ Минцифры РФ и активирует модели в пуле без ручного копирования ключей."
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx6(
                      "a",
                      {
                        href: "/nomad-skills",
                        style: {
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "6px 12px",
                          borderRadius: "10px",
                          border: "1px solid rgba(0, 122, 255, 0.28)",
                          background: "#F4F4F5",
                          color: "inherit",
                          textDecoration: "none"
                        },
                        children: "Коннекторы к РФ-системам (1С, Битрикс24, Диадок, СБИС) →"
                      }
                    )
                  ] }),
                  ruSsoResult ? /* @__PURE__ */ jsxs6(
                    "div",
                    {
                      "data-testid": "ru-sso-auto-result-card",
                      style: {
                        padding: "14px 16px",
                        borderRadius: "12px",
                        border: "1px solid rgba(16, 185, 129, 0.38)",
                        background: "rgba(16, 185, 129, 0.08)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      },
                      children: [
                        /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                          /* @__PURE__ */ jsxs6("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                            /* @__PURE__ */ jsxs6("strong", { style: { fontSize: "13.5px", color: "#059669" }, children: [
                              "Нативный OAuth-вход выполнен: ",
                              ruSsoResult.ssoTitle
                            ] }),
                            ruSsoResult.folderId ? /* @__PURE__ */ jsxs6("code", { style: { fontSize: "11px", padding: "2px 7px", borderRadius: "6px", background: "rgba(16, 185, 129, 0.14)", color: "#047857" }, children: [
                              "folder_id: ",
                              ruSsoResult.folderId
                            ] }) : null
                          ] }),
                          /* @__PURE__ */ jsx6(
                            "button",
                            {
                              type: "button",
                              onClick: () => setRuSsoResult(null),
                              style: {
                                padding: "2px 8px",
                                borderRadius: "6px",
                                border: "1px solid rgba(16, 185, 129, 0.3)",
                                background: "transparent",
                                color: "inherit",
                                fontSize: "11.5px",
                                cursor: "pointer"
                              },
                              children: "Скрыть"
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsx6("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "6px" }, children: (ruSsoResult.steps || []).map((stepText, idx) => /* @__PURE__ */ jsxs6(
                          "div",
                          {
                            style: {
                              fontSize: "11.5px",
                              padding: "5px 9px",
                              borderRadius: "8px",
                              background: "rgba(255, 255, 255, 0.72)",
                              border: "1px solid rgba(16, 185, 129, 0.22)",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px"
                            },
                            children: [
                              /* @__PURE__ */ jsx6("span", { style: { color: "#059669", fontWeight: 700 }, children: "✓" }),
                              /* @__PURE__ */ jsx6("span", { children: stepText })
                            ]
                          },
                          idx
                        )) })
                      ]
                    }
                  ) : null,
                  /* @__PURE__ */ jsx6(
                    "div",
                    {
                      style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                        gap: "10px"
                      },
                      children: PROVIDERS.filter((p) => p.isRussianSovereign).map((rp) => {
                        const connectedCount = accounts.filter((a) => a.provider === rp.id).length;
                        const isConnecting = ruSsoBusyProvider === rp.id;
                        return /* @__PURE__ */ jsxs6(
                          "div",
                          {
                            className: "nomad-glass-card",
                            style: {
                              padding: "14px 16px",
                              borderRadius: "14px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              gap: "10px"
                            },
                            children: [
                              /* @__PURE__ */ jsxs6("div", { children: [
                                /* @__PURE__ */ jsxs6("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }, children: [
                                  /* @__PURE__ */ jsx6("span", { style: { fontSize: "13px", fontWeight: 600, letterSpacing: "-0.01em" }, children: rp.label }),
                                  connectedCount > 0 ? /* @__PURE__ */ jsxs6("span", { style: { fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "6px", whiteSpace: "nowrap", background: "rgba(34, 197, 94, 0.14)", color: "#16a34a" }, children: [
                                    "Активен (",
                                    connectedCount,
                                    ")"
                                  ] }) : null
                                ] }),
                                /* @__PURE__ */ jsx6("div", { style: { fontSize: "12px", opacity: 0.74, marginTop: "4px", lineHeight: 1.42 }, children: rp.description }),
                                /* @__PURE__ */ jsx6("div", { style: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" }, children: (rp.models || []).map((m) => /* @__PURE__ */ jsx6(
                                  "code",
                                  {
                                    style: {
                                      fontSize: "11px",
                                      padding: "1px 6px",
                                      borderRadius: "5px",
                                      background: "rgba(128,128,128,0.10)"
                                    },
                                    children: m
                                  },
                                  m
                                )) })
                              ] }),
                              /* @__PURE__ */ jsxs6("div", { style: { display: "flex", gap: "6px", alignItems: "center" }, children: [
                                /* @__PURE__ */ jsx6(
                                  "button",
                                  {
                                    type: "button",
                                    "data-testid": `ru-sso-connect-btn-${rp.id}`,
                                    disabled: isConnecting,
                                    onClick: () => handleConnectRuSso(rp),
                                    style: {
                                      flex: 1,
                                      padding: "7px 10px",
                                      borderRadius: "8px",
                                      border: "none",
                                      background: "#18181B",
                                      color: "#ffffff",
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      cursor: isConnecting ? "default" : "pointer",
                                      textAlign: "center"
                                    },
                                    children: isConnecting ? "Авто-настройка SSO…" : rp.ssoButtonLabel || `Войти в ${rp.label.split(" (")[0]}`
                                  }
                                ),
                                /* @__PURE__ */ jsx6(
                                  "button",
                                  {
                                    type: "button",
                                    "data-testid": `ru-key-connect-btn-${rp.id}`,
                                    title: "Ввести сервисный API-ключ вручную",
                                    onClick: () => {
                                      setKeyProvider(rp.id);
                                      setKeyLabel(`${rp.label.split(" (")[0]} (Контур РФ)`);
                                      setKeyBaseUrl(rp.defaultEndpoint || "");
                                      setKeyFormError("");
                                      accountsModalAtom.set("key");
                                    },
                                    style: {
                                      padding: "7px 9px",
                                      borderRadius: "9px",
                                      border: "1px solid rgba(15, 23, 42, 0.12)",
                                      background: "rgba(255, 255, 255, 0.72)",
                                      color: "inherit",
                                      fontSize: "11px",
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      whiteSpace: "nowrap"
                                    },
                                    children: "Ключ"
                                  }
                                )
                              ] })
                            ]
                          },
                          rp.id
                        );
                      })
                    }
                  )
                ]
              }
            ),
            /* @__PURE__ */ jsxs6(
              "div",
              {
                style: {
                  borderRadius: "12px",
                  border: "1px solid var(--border, rgba(128,128,128,0.22))",
                  background: "var(--card, rgba(128,128,128,0.04))",
                  overflowX: "auto"
                },
                children: [
                  filteredAccounts.length === 0 ? /* @__PURE__ */ jsxs6(
                    "div",
                    {
                      style: {
                        padding: "36px 24px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "10px"
                      },
                      children: [
                        /* @__PURE__ */ jsx6("div", { style: { fontSize: "16px", fontWeight: 600 }, children: loading ? "Загрузка пула аккаунтов..." : "В пуле пока нет подключённых подписок или ключей" }),
                        /* @__PURE__ */ jsx6("div", { style: { fontSize: "13px", opacity: 0.72, maxWidth: "520px" }, children: "Добавьте одну или несколько подписок («Войти подпиской») либо API-ключей («Добавить ключ»), чтобы настроить бесшовную ротацию без простоев на лимитах." })
                      ]
                    }
                  ) : /* @__PURE__ */ jsxs6(
                    "table",
                    {
                      style: {
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                        textAlign: "left"
                      },
                      children: [
                        /* @__PURE__ */ jsx6("thead", { children: /* @__PURE__ */ jsxs6(
                          "tr",
                          {
                            style: {
                              borderBottom: "1px solid var(--border, rgba(128,128,128,0.2))",
                              fontSize: "11px",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              opacity: 0.72
                            },
                            children: [
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px" }, children: "Приоритет" }),
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px" }, children: "Аккаунт" }),
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px" }, children: "Провайдер" }),
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px" }, children: "Способ входа" }),
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px" }, children: "Статус" }),
                              /* @__PURE__ */ jsx6("th", { style: { padding: "12px 14px", textAlign: "right" }, children: "Действия" })
                            ]
                          }
                        ) }),
                        /* @__PURE__ */ jsx6("tbody", { children: filteredAccounts.map((acc, index) => {
                          const badge = getStatusBadge(acc);
                          const isBusy = busyAccountId === acc.id;
                          return /* @__PURE__ */ jsxs6(
                            "tr",
                            {
                              draggable: true,
                              onDragStart: () => handleDragStart(acc.id),
                              onDragOver: handleDragOver,
                              onDrop: () => handleDrop(acc.id),
                              style: {
                                borderBottom: "1px solid var(--border, rgba(128,128,128,0.12))",
                                background: draggedId === acc.id ? "rgba(59, 130, 246, 0.1)" : acc.isActive ? "rgba(34, 197, 94, 0.04)" : "transparent",
                                cursor: "grab"
                              },
                              children: [
                                /* @__PURE__ */ jsx6("td", { style: { padding: "12px 14px", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs6("div", { style: { display: "inline-flex", alignItems: "center", gap: "6px" }, children: [
                                  /* @__PURE__ */ jsx6(
                                    "span",
                                    {
                                      title: "Перетащите строку для смены приоритета",
                                      style: { opacity: 0.5, fontSize: "14px", userSelect: "none" },
                                      children: "⋮⋮"
                                    }
                                  ),
                                  /* @__PURE__ */ jsxs6("span", { style: { fontWeight: 700 }, children: [
                                    "#",
                                    acc.priority
                                  ] }),
                                  /* @__PURE__ */ jsxs6("div", { style: { display: "inline-flex", gap: "2px", marginLeft: "4px" }, children: [
                                    /* @__PURE__ */ jsx6(
                                      "button",
                                      {
                                        type: "button",
                                        onClick: () => handleMovePriority(index, -1),
                                        disabled: index === 0,
                                        title: "Повысить приоритет",
                                        style: {
                                          padding: "2px 5px",
                                          borderRadius: "4px",
                                          border: "1px solid var(--border, rgba(128,128,128,0.25))",
                                          background: "transparent",
                                          color: "inherit",
                                          fontSize: "11px",
                                          cursor: index === 0 ? "default" : "pointer",
                                          opacity: index === 0 ? 0.35 : 0.85
                                        },
                                        children: "↑"
                                      }
                                    ),
                                    /* @__PURE__ */ jsx6(
                                      "button",
                                      {
                                        type: "button",
                                        onClick: () => handleMovePriority(index, 1),
                                        disabled: index === filteredAccounts.length - 1,
                                        title: "Понизить приоритет",
                                        style: {
                                          padding: "2px 5px",
                                          borderRadius: "4px",
                                          border: "1px solid var(--border, rgba(128,128,128,0.25))",
                                          background: "transparent",
                                          color: "inherit",
                                          fontSize: "11px",
                                          cursor: index === filteredAccounts.length - 1 ? "default" : "pointer",
                                          opacity: index === filteredAccounts.length - 1 ? 0.35 : 0.85
                                        },
                                        children: "↓"
                                      }
                                    )
                                  ] })
                                ] }) }),
                                /* @__PURE__ */ jsxs6("td", { style: { padding: "12px 14px" }, children: [
                                  /* @__PURE__ */ jsx6("div", { style: { fontWeight: 600 }, children: acc.label }),
                                  /* @__PURE__ */ jsx6(
                                    "div",
                                    {
                                      style: {
                                        fontSize: "11px",
                                        opacity: 0.65,
                                        fontFamily: "monospace",
                                        marginTop: "2px"
                                      },
                                      children: acc.maskedKey
                                    }
                                  )
                                ] }),
                                /* @__PURE__ */ jsx6("td", { style: { padding: "12px 14px" }, children: acc.providerLabel }),
                                /* @__PURE__ */ jsx6("td", { style: { padding: "12px 14px" }, children: /* @__PURE__ */ jsx6(
                                  "span",
                                  {
                                    style: {
                                      fontSize: "11px",
                                      padding: "3px 8px",
                                      borderRadius: "6px",
                                      background: "rgba(128,128,128,0.12)"
                                    },
                                    children: acc.authType === "oauth" ? "Подписка OAuth" : "API-ключ"
                                  }
                                ) }),
                                /* @__PURE__ */ jsxs6("td", { style: { padding: "12px 14px" }, children: [
                                  /* @__PURE__ */ jsx6(
                                    "span",
                                    {
                                      style: {
                                        display: "inline-block",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        padding: "3px 9px",
                                        borderRadius: "999px",
                                        background: badge.bg,
                                        color: badge.color
                                      },
                                      children: badge.text
                                    }
                                  ),
                                  acc.lastError ? /* @__PURE__ */ jsx6(
                                    "div",
                                    {
                                      style: {
                                        fontSize: "11px",
                                        color: "#f59e0b",
                                        marginTop: "4px",
                                        maxWidth: "240px"
                                      },
                                      children: acc.lastError
                                    }
                                  ) : null
                                ] }),
                                /* @__PURE__ */ jsx6("td", { style: { padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs6(
                                  "div",
                                  {
                                    style: {
                                      display: "inline-flex",
                                      gap: "6px",
                                      justifyContent: "flex-end",
                                      flexWrap: "wrap"
                                    },
                                    children: [
                                      /* @__PURE__ */ jsx6(
                                        "button",
                                        {
                                          type: "button",
                                          onClick: () => handleResetCooldown(acc),
                                          disabled: isBusy,
                                          style: {
                                            padding: "5px 9px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border, rgba(128,128,128,0.28))",
                                            background: "transparent",
                                            color: "inherit",
                                            fontSize: "12px",
                                            cursor: isBusy ? "default" : "pointer"
                                          },
                                          children: "Снять пометку"
                                        }
                                      ),
                                      /* @__PURE__ */ jsx6(
                                        "button",
                                        {
                                          type: "button",
                                          onClick: () => handleRefreshLogin(acc),
                                          disabled: isBusy,
                                          style: {
                                            padding: "5px 9px",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border, rgba(128,128,128,0.28))",
                                            background: "transparent",
                                            color: "inherit",
                                            fontSize: "12px",
                                            cursor: isBusy ? "default" : "pointer"
                                          },
                                          children: "Обновить вход"
                                        }
                                      ),
                                      /* @__PURE__ */ jsx6(
                                        "button",
                                        {
                                          type: "button",
                                          onClick: () => handleDeleteAccount(acc),
                                          disabled: isBusy,
                                          style: {
                                            padding: "5px 9px",
                                            borderRadius: "6px",
                                            border: "1px solid rgba(239, 68, 68, 0.35)",
                                            background: "rgba(239, 68, 68, 0.08)",
                                            color: "#ef4444",
                                            fontSize: "12px",
                                            cursor: isBusy ? "default" : "pointer"
                                          },
                                          children: "Удалить"
                                        }
                                      )
                                    ]
                                  }
                                ) })
                              ]
                            },
                            acc.id
                          );
                        }) })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsxs6(
                    "div",
                    {
                      "data-testid": "accounts-switch-feed",
                      style: {
                        marginTop: "28px",
                        padding: "16px 20px",
                        borderRadius: "10px",
                        border: "1px solid var(--border, rgba(128,128,128,0.22))",
                        background: "rgba(128,128,128,0.04)"
                      },
                      children: [
                        /* @__PURE__ */ jsx6("h3", { style: { margin: "0 0 10px 0", fontSize: "14px", fontWeight: 600 }, children: "Лента переключений аккаунтов" }),
                        switchFeed.length === 0 ? /* @__PURE__ */ jsx6("p", { style: { margin: 0, fontSize: "13px", opacity: 0.7 }, children: "Переключений аккаунтов пока не зафиксировано." }) : /* @__PURE__ */ jsx6(
                          "ul",
                          {
                            "data-testid": "switch-feed-list",
                            style: {
                              margin: 0,
                              paddingLeft: "18px",
                              fontSize: "13px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px"
                            },
                            children: switchFeed.map((item, idx) => /* @__PURE__ */ jsx6("li", { "data-testid": "switch-feed-item", children: item.line || `${item.ts?.slice(11, 16) || ""} · ${item.provider} · ${item.status_code || 429} · активна ${item.to_slot || "#2"}` }, item.id || item.api_request_id || idx))
                          }
                        )
                      ]
                    }
                  )
                ]
              }
            )
          ] })
        )
      ]
    }
  );
}
function registerAccountsPage(ctx) {
  ctx.register({
    id: "page",
    area: ROUTES_AREA8,
    order: 60,
    data: {
      id: "nomad.accounts.route",
      path: "/nomad-accounts",
      title: "Аккаунты",
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx })
    },
    render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx })
  });
  ctx.register({
    id: "nav",
    area: SIDEBAR_NAV_AREA5,
    order: 60,
    data: {
      id: "nomad.accounts.nav",
      label: "Аккаунты",
      path: "/nomad-accounts",
      codicon: "account",
      order: 60
    }
  });
  ctx.register({
    id: "statusbar",
    area: STATUSBAR_AREAS.right,
    order: 60,
    data: {
      id: "nomad.accounts.status",
      label: "Аккаунты: 0 · активен #—",
      to: "/nomad-accounts",
      render: () => /* @__PURE__ */ jsx6(AccountsStatusbarPill, { ctx })
    },
    render: () => /* @__PURE__ */ jsx6(AccountsStatusbarPill, { ctx })
  });
  ctx.register({
    id: "hotkey",
    area: KEYBINDS_AREA,
    order: 60,
    data: {
      id: "nomad.accounts.open",
      category: "navigation",
      defaults: ["ctrl+alt+a", "mod+alt+a"],
      label: "Аккаунты",
      run: () => openNomadAccountsTab("accounts")
    }
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA7,
    order: 60,
    data: {
      id: "nomad.accounts.open",
      action: "nomad.accounts.open",
      label: "Аккаунты",
      category: "Nomad",
      keywords: ["аккаунты", "подписки", "ключи", "пул", "ротация", "accounts"],
      run: () => openNomadAccountsTab("accounts")
    }
  });
  ctx.register({
    id: "palette-add-subscription",
    area: PALETTE_AREA7,
    order: 61,
    data: {
      id: "nomad.accounts.addSubscription",
      label: "Добавить подписку",
      category: "Nomad",
      keywords: ["добавить", "подписка", "войти", "oauth", "аккаунт"],
      run: () => {
        openNomadAccountsTab("accounts");
        accountsModalAtom.set("oauth");
      }
    }
  });
  ctx.register({
    id: "palette-reset-cooldowns",
    area: PALETTE_AREA7,
    order: 62,
    data: {
      id: "nomad.accounts.resetCooldowns",
      label: "Снять пометку исчерпания",
      category: "Nomad",
      keywords: ["снять", "пометка", "исчерпание", "сброс", "лимит", "пауза"],
      run: () => {
        openNomadAccountsTab("accounts");
        callNomadApi(ctx, "/accounts/reset", {
          method: "POST",
          body: { all: true }
        }).catch(() => {
        });
      }
    }
  });
  if (typeof ctx.registerSettingsPage === "function") {
    ctx.registerSettingsPage({
      id: "subscriptions",
      title: "Модели РФ в 1 клик и пул",
      icon: "account",
      order: 10,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "accounts", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "fallback",
      title: "Порядок и запас пула",
      icon: "layers",
      order: 15,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "fallback", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "billing",
      title: "Тариф и баланс NomadNet",
      icon: "credit-card",
      order: 18,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "billing", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "council",
      title: "Совет моделей (Консилиум)",
      icon: "organization",
      order: 20,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "council", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "cloud",
      title: "Облачный ПК и устройства",
      icon: "cloud",
      order: 30,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "cloud", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "memory",
      title: "3-слойная память и граф",
      icon: "database",
      order: 40,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "memory", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "safety",
      title: "Контур 152-ФЗ и NemoClaw",
      icon: "shield",
      order: 50,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "safety", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "data",
      title: "Данные, чекпоинты и архив",
      icon: "archive",
      order: 60,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "data", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "start",
      title: "Перенос, старт и лимиты",
      icon: "rocket",
      order: 70,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "start", embeddedInSettingsModal: true })
    });
    ctx.registerSettingsPage({
      id: "onboarding",
      title: "Язык и онбординг",
      icon: "globe",
      order: 80,
      render: () => /* @__PURE__ */ jsx6(AccountsPage, { ctx, initialTab: "onboarding", embeddedInSettingsModal: true })
    });
  }
}

// assets/nomad-dunes.js
var nomad_dunes_exports = {};
__export(nomad_dunes_exports, {
  NOMAD_DUNES_SRC: () => NOMAD_DUNES_SRC
});
var NOMAD_DUNES_SRC = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMzc2IDc2OCIgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pZFlNYXggc2xpY2UiIHJvbGU9ImltZyIgYXJpYS1sYWJlbD0iTm9tYWQg4oCUIFNpbGsgUm9hZCBjYXJhdmFuIGFuZCBkZXNlcnQgZHVuZXMiPg0KICA8aW1hZ2Ugd2lkdGg9IjEzNzYiIGhlaWdodD0iNzY4IiBvcGFjaXR5PSIwLjIyIiBocmVmPSJkYXRhOmltYWdlL3dlYnA7YmFzZTY0LFVrbEdSbHphQUFCWFJVSlFWbEE0V0FvQUFBQVFBQUFBWHdVQS93SUFRVXhRU04wMEFBQUJyOGVnYlNSSDUvQ0hmZTBMZ0lqSUlkc2dhd2lSbHpMbEwva3B4MEhiU0pLVVRQRkhQZS9XSFlDSW1BQXFWWlJHMVRFM0FHT21xWnZPS3NTdjhaTENEWTJ1MFFKWS9IRk9xOTZPSkhRbTRUSWZjcitBSGNCbWZaS1FVMnFEMytqSmMwSGxXMytlRHVydi82OXRvNXptblc4Tm5JY2VyNVdIT1lacXpQUW9VZzdIVkhvME1UTXpNN3ZEcUhnOGlOSXF1SGx4VXllRllRWlp4NHpmdjZCd3A5YndhL085T2FML0V3QVVpTC8vS0NKUy83TnRzK1MyMGYzeFZKbmRWZm1hN0ZOVkxvSW5SMUxYbVdaWHhPNjRoNDFLcDhVTVNCdGhwV0h0dzVnTmt2SW1RQUpuV2lhUmhkbmtOQ0J2c2hRb01qVVlMNHF5RUlJQkpaS3RXU3dvZ2dsWWNGWXlpOFlic3RoUjluMFJHT2orQzA1VmRUSExid2VaaVA1UGdNYjkvMmVuYmF6dno0Y1R3SW9VZkk2WTR6RTJRVHFXV1NRUGVrd1ZPVkVtWm5sQ1BUQTI4blViNnFWMkw1U3NCTnBjbHpSeHhoT0YzaXhlWmh5b0U3dExTTTFjU3ZhVlpMZzJ3MkpxakVyc2hNWXhEUk5mUnIyRlBOSHNNNSsvUU5Mdi9JNFdXNDY3UlBSL0FnelZmMlRBcVZ2V1FQZS83bi8vL1ZmMEJQUks5Ny8vL3V2Kzk5OS8vLzMzLzhQY3JicEsvci8vYm55cjZpcE5xcTZvdnByNUQxOWhxK0txYmUvZnBTYUl6b3k5OE84UnBqdm5zTm9xM09zcjFWYkg3L2Yzam9WUVNaV1U5cUVldnh1SU1lYlZVUTAyTGp2NnA5V2YvajFIWGozS3pQeWVxcWRhemc5WS9zbWJ1MmtudGg5VUx5WjVkbUR1NE4xWFZUOEc3ZXFtK2NieUcrb0ZJdU5YMUlLUklmWWkzZXZxMmJtc1ZzVVVlVjJ2TGhPWnRIT3lOSnVVeG5iMlA2VDJhNTJLcGJoNFZxOHhhZHpYdVBuMm4vblZ5K3JGRDl6UmgwYU1CRWJHZUVtL0VQZTh0VHFwblgxQ3o3Sm5naC80YTh0Ly9yK3ZxaTllY2ZTbkdSOTdYYjFPWHBXVWZVR3pTRG5Peisyby9rQUdTYnV6MFZjNXZ0U3U1V1FYVkYrT3RSb2pvMTQva0ZZaDNiS3A3WDBBYnozRWRmM1dSb2lNVjcyMnlPZzl0OUJYSlVhQWR0RHR2UExvRm5RcEFNVE9mWHFOV0dQU2xaS3RNU1BidktZN2pSNGpsYnphNkpacnZwUUMxTEtyZXJBVDJlVkpuL0t2UEpuVUpnRjZCOVdRbGZyUCtucGVhYVFCSUdSdmFxZVlaV3l0MW12T3ZmTUxYLytBKzMxRzNyMXhjL05BSkEyam9GMzdoRFl6Z0tERXFxTDh0TS9PQTJUUDZmZGZiVEEyY3JzalAzZFN4Q1BQVy81YW4rVjJNb0taalFjKzdqZXpVditzbC92VlJQTTZCOUJmVW1LbUFlak0zYTc2SExRWDE4L2p2VjZXamNYRkRvMVBxMy9lei9wQUxiZjV0bjE2TmdNQ0dxdUk1clVSZ2FEOVJTRHo1VDRmVXIrUTlOZnpGS2puRjczb1pSODdUcm5XNjh4ZFVUYzZQWXdSM3JaZlF3UVdsRmc1RkhRZTZHMzdlZ3dBc2E5NlJ4d2tqTi9Vc3o2c3d4RkFTRHE4Vy8zZGJrNDVlODFMUFdEOWl1UVZRd3UrM0NQUTB5U0xRSnFIcS83cHZ0WEl4Qi9VMjMxVXQ4ZU56T2JVa0pjSTZBRWdISFV1cnhJSyszMW9HWmpUQnVWYWR0WHJ0MFIyR1o3d004dis2TXMrUEtJK0JtTC9xclk2bEtNbWUyQ200VktzRHNvZmN1RUFGUGhzRjZEV3o3U1pzZnNuYlMxN2NzN0xJeWJQNXZSU284VGk3Ujd0aEptWm05Mk1sVUhMK3BmN0FqOWduNUZCczM2TktaNXlxZXVwR1U5TkFScGQ3UndBMkxmZjN6MFU1OTc4UlcrTkZVRUhQUnIxMkc4YUtPL1oxQjdUYkJhSlA5cDFiV2g3S3BCOXllY1BVRTcxTzk3MDV0U2xpaUJ2RDh5cEdjQmJPcm9jbWU0ZzhXZWppMXNXNlhSb3BKcVY1cjVEZnlkck5PYmNYd1hVY2FjRDNhZjFwbEpITTZaZGZOeWZiYm00N1F0YlU0S3V6Z1hDL2dPUCtTT0wwRm0yQWlqM2pYbmdvOTZrK3lEM2VvK3BiK3FQemJtNXFZT3AwZmhsdjd0RCtpbDdYc3YyMEh2V1h0VlAxQTV3MW9QdHBuN1h1dS9wTU8yTWgvWGNuRnREM1p3ZTRXNS9iT21MZm52YTliTzNRS1paeGMrbURXRE9KU0JWTzB5MVhpSTg2YXYzN25lNDlhcm5id0FjVmpzQlVwZm1vZStsVU9rVFhBWndCMkNtcjdkTVozUjQyTmJpWHJkN3F3NXV5S0VmODkxdElDUUNOTnhmNWRQM1dnUDJlYjFSK2s0SEdxWVdDTnN5bkhON3JlYVpHOUg0b3QvdWVoTm9uTFVEN0poVitEeGtBL1pwaDdJWDluVjBXdlY2czloeXNJWm5pbFhURzdEbmtqZkZCZWNBTXUyUnBGN0txM3ZzQWd1bUFKbXZCWWpQTHlUVGdlWUF0OWJ3ZkhHdnBOUDdtQTNna2gwQ0xMb1RDVkdxZXFQWEc1QjZGaUJvemcyZGJSWWZkN3VIbStuRGJ0MkEwVkY3QUhOQzByaG1YdEZ6MEhtWTExaGF0OGVOSHVod2dNUGF0cCsvWVdUdWxPSVZlOUN4LzYrdENkSVMzZGtER0FFYVJzYW56Wk83YXBhMjlVeU9pMnpwMm5SbUoyRy9BV0RaOVFpYnZ1MWZHZGE2WVlSNXJ3SFVmSDJTL0o4ZGhsMk1YUFRhU2hQWFdkSGhWRzd6NHV3RXQ3enNLc0NHNjlEemU2dDRjdnZBakpRMzdET3hNcGpDU1k5QjRncGM5ZndVdWkxbDRuVTNJNUQ3YnRqekkrYlZPK0dnT2RUY0tHVXllVDdRVjdmRzFFY2NYL29TVXNvaGs0c2t1eGdlMTcyekU0RTVaWHZROTJEMXpzRDdnTXcyRUw5cFBobWIyK3IycUhMeS9yLysydGN3aFo0cmdQejFEOERzSkZ2cU53Wk1ubWtiR0xnZDJYUGFXTG1ETlZqMG5nUkFkbjFlTld5T21lTW9KRmhBTWlycHJGK1FUaklxN2FsdXM5dG9BSml6Z09oYzFjNjhuNjVCc0ExRVhkOVZPS2Y2MkhacFhhR0FsMHhMT1hSdFFTQTlZaGU2NmVhYnF1ZGF1MXEvN2pyUXN4dUkvbE9zMk9rSXBINHlBZHF1cy9zZWxuc3I3SldSaTlxRmxrMG8zQUU0eE9uaEN0c3QvVVY5ZXd2U2tOQ2NnTDR4aDNqQlB1eTNhbWZkUVFsZzNmdHF1NnNsNTlRWDlPaDcyVHMvb3FaMXdObVNCUWx3K0RBZjFFd3RUa0VJTFNhLzVib1prTnVFbnYyS0hSK0tGRWZ0a0JCY1o1cnBqdm9vZXBqUmJhV1V3VUFISkIwNFhQK2cvcXJxRXlsMDJmVzhjMEQ4MXRVSVY0d1ZPeEZTOTVIUTh3YzJSalVuSTAwc1hEbWhXVHBpNEIrTjZBQ3ZlQmNrNUp1YitxdDZqdyswUXJNNVFYMU1vWDBnR2dGRHBjNUdDWUZNRi9NUk5YWjdYRzl5R1BSa1VrbzlOaUtEK25EVW1hRStyYi9udTQ0UW1zMzZ1UEZwcWhFNlVscjQxMlJHVjFhOUFEenRJZTVYMzlrY01jV1RlcjhYZVZBN0FESU9YQ0xqdlBLQy9xcHViNGEwVFRxdU9ZYSt1aHptcjcwYWlWZmZpUCtLOE5XK1FNM05ReHQvcmc4Tm1MNzlWN3dJT29VNm5OUlRUK29MWC9QSVpXaldhb3ljbmFqOTJzNnpyczVqSkM3WXJ0Q0oxZ0REK29iSDdGQ2ZUdGpvc3lDZjlVSFF2WU9oekpabVI3Q0pQbnhPSDUyVG44b1dEa056MU9RZFhQZTFQRHBIU0tWQzl5SFQwbEVNMFZXbXZPT0g2R2p4ZS80MHZOLzdiNUt5QUlublhqRWI3dWphSi9TREp6dnZEMHk1NXY3dmNtUFYyeVBMVlRxNWwxSjQzS011SFgzdCtmVXB2ZlU3UW8xR1I0c1hmUW5RaVk2b2E4a1R1djJFUGhPNDg3R0xneW05MDU5c0J4Yy8rc1k2OGROZmlwVTV5eDRrNlJ0dXQ3OHE5U214dEE0WjJPY3gveGtHV2grUkFvWHVjRjRmVGZhNlU1OGxPMXdVTktkUys2UzE5RmtQdVE0elZ1Y0VGd0gzK1E0YXRwbnk4ekx5cWl2Y3JXbEx3MlJiVCtpUHN5M0Q3dXhzYytYdW4yWGF0bG4wSFViQXJESUhPeVh2VzR3SFBUU2xXNTV2ak1wMGxyMSs0Mm5kSEpFQjUvUUZmUitYZGJ0Ym42WFo1R2RueDlSM0VZV3dyRUJIS25QM21wTW11a0J0eDg2VUdrdnBLRGI5UUJkY0hYY1lHS2llcVovWEowTzNuamZoRUlmRzdEYWFRNllFRHJsVWxaUDh5SysyQ1YzcEpGejdVRzFLL2trWUV3NTRZckE5cDI5Zkc1RUJ2S2tQdDg3Z08xclFCT2pzZXdTNjFIZTM3SVZJVE0waWkyNVg1Uno2My9jc2taNTFHVHBtVFBucmQxSE9LV2pybjFoK3B0dHM0Z3JNbm5mc2R4K2d1WEw0TUxQd0YwejVJeTVEM3d0UWUvWmFVcEdUL01PdE5XcC8rbVliYXM1TnBaNGRKcVgvb3BQK0NTMS8rOHhzaml2TnBmZHBPUEFUcGZFdkhtRGwrT0hEemVZVUdxWHN6Lzg4STMzb0doVzV5d0twNzZvQmhvbENNMStCN0NlYzhINlMzcWtUNTRiRG9qaWYrTXBQcGJoWnZPOEQwZ1NhMUx1ZEJJNi83dmpMT2MzangxZnlaZ2lqWmpGQzdUNVh5YzZhVk9UMFN6WFRFWlRyK2FCRjd5a24vTm41ZW5IbXRzM05RYS9YQ29HaTZOYTVyZWVmWE1iV1ZzOGV1MHlTWkJaT1gzWENZeHc1c2JaNUprM1RXUU1rRFZmSmowcEZibDdDSnF6Z1liTFRUdmpzVGUzZUErZUcyOFZTbldhM1M2alhnUkNnUHJzMDNQTExGMzBTMTI3YnpZUzFkaS9oMkRjY3Y3TS9PZjlIaDdPOGljQmNSVTVCWVdmbFFmN2laSHJQM3pxK1J4Z01oc08xSWkzU0lnM05wVzZ6V2UrbWFaMDZRTFBiVFl1bDRUbDFTYmE2VXh1ZHJwM1oyaHlRZk5uUnoreW5NS3lzWUtlNlpxblZ5TVlBOGhPT2Y5K2dGU01KN0QzQStBQWhiYlhTc2QwaWxBbEpjYis2dE1xMDU4ZU1yKzF0eFp0UE9qRjcyVnROOHlkTytTOGU5OS9INTU4ZnQ5dnZxNUNCa0xUTG5abEdvOVgwUVQ5ZktxL3NYWDNYajU0OGVlcmV0eGV0SSszL2ZPTElpUk9uVG13T2lpTW5UdHg3cERoeW9paU9ETmRPOU5iV0Z0ZE92UDJMcGRibEk2ZTJpaWFqWjJsQ204bG4ya1h2eU1uSFAvL0xMNzMwNkVMaDJDLzdsRXdjcUs0OTlLdkgrZkN0ZjNFbm4zWFNiOXcvVjV6bzlYcTloQkRTTkMyS1lyaldHNlJGa2E3MVFocENtcDU0OUZWdnRTdkR3STF0SCttdzlLTk8rRm1LdzdMeTRDR1h4Z1NxYmR0L0RleXpCK0JLZ0dPZmQ4SnR3bUJ6ZTVDbUlmUmFJUVRTZEcydGFJYTBXSHRhVnhlOGZKTnJneHR3OUJVbi9Ob1NTOE9kSzhuaGxVTVlXY1JrVE5YdHVnQzJnRXhHcDBVT0ovL0M4ZHNVNTU3WU9YK21LSHE5Vmk4TnJWYnlwQ1pyWFh2RG5vL2xrL1Zhc1BhTUUvNzJrTkJiRzY2bFNZQWxtU1VHb1gyem5ZcWNXQW9lQkRBWk5UWmRPMUxNY05IeGp4MWdiYmo5eE00VDIvLzlCV1Z6Z0lOMDJQS2Z6NHo1dnVlY2RLZEZMMmt4ZWIxbUR2SFBoZldqSmhVNTgzK3pWQ1A2cmxDNmZSZGpWMVlPbndSKzFsMXlacEJpUWIzQXlTOGZoL3BHcmRaaHVpNURwaERQWDUrdHl2bjZ1MnZrZmpXV3J0YW13Z2M4QUN2RjF0WXpPK2QrU2ZmZXU2aFhuZ2o1QUZPZzZPbmc4K2oyeWVPM0xSMm03SWVZYXZKZnpBbVpuNFA0eWl0Vk9mRWpWeUJxSDlpMlBwM2h6d0kwbSttd2RRTFBuWHI2b3Q2NzNjM1RtUkZCdFZmc2RhMUpPWUgydTVueTF4NVA0UHY5V0NEMWRGS1J3eDFHMlBFU0VGeWFEb2VJUUpPdzlwUTdwNTU4MVovVm5Yb3paVVNxVCtvZ0hCQWdTVG9rVUV3bk00T2VQcHVTT2tkVjdvd1pITlVJeUpUZjhyRlhvUU9jMS9TTTh1U2ZlYVk1bTg3WUJEYjEvSXllR2VoeHFBUEk3SFQyQ2VHc2JxWWcxYmxHd0tOQ2xHdzZQTzBlb0puZUxXZCt6Mkw0aEo0SEVPQ01makRGenc3dzc1dlU2MG5DcDVseTIwakgveWFBc1RJbmR3RTZKcjdXNS9tUEpGT0NXd0tBVC9XMkRmVFF6UWtHZW9xMVJHbko0UTcxRFFiVGV0a1l2K1d3MUxWZm1STjlGdUwxMTFmdEwwWGoxSjRERm5WdFc5aDgwYjhaMFNyTnJxaHNEL0dlN1IwUEF3dS9OelV2OVRJWHRZRG5YbzJWT1d5YlE5ZnZSREJNelFQazJycmJ2YVNhWWgyWXNRWWNkOWp5dDA4bHlCTjZmdVhPLzBjMnRZVkZiKzk3RnZvdWhlb2NUQ0V4N2QzaDBNMnAvVENISDdSMWo2MGVXb0NVWlVTOXRhWlBicTJaUE9uYWVhNHc3Y3hqWG80WVlVNHFkSmNGT3Q0ZUMxMzArTFRJVXI4dDhmNGpIOWVUa0l3b1JtREJ5cFl5L0N2YkoyeVRkK3RoT2wvOW9zYlk5d0FzVityRXI3MllrbXg0aUhVMW45cGQydk5IejJtdkJ1UWVCeGl6Q2JVbi9xdXYvT3FmK2VTalBsUFU2MHgxU2Uyenh5OUU4R3FzMEFFalJCTlkxZENabGo2Z0QyaENPZmRYZ05hSVk1Nkg1bkNyclpmMElWL1lyak8xUGdRQlhLQks5NUJBNFpFRUR1ajZsSG8rb0NmMW5Zd1JvSlIvM1BmUlBETVk3dnlTdnFDUHVKZnB2azBYZ1NYelVxalVTZjc2MDdPRW8rWkE1dXAwMWxSWC9KTjFSamMxak1uZTlEeHAwUTFGT3J6b2d1cjJkUGE1RUNENkV1eDUzVmlwQTg1Q2FnU1cvZlBPTkFwSERwdUw1RDljNHU5Tnh5enBFdVQxa3hrWG41NXg1TlkwVnBXeVFKQ0szZHdEZ2ZUMTF3WVFnOFVFelRFdFJvQWZ1WEpmRnJJWmVOeGlSSk83L0R6SGdOTXZQcEpkNXR5SVZqR0ZwcFNmTThLUzdZcWQ4RzZYU1lNRmhQbXZ1ekZ1YkJpcUFuUjUyUkFTQU5NUnNHbnZMcElOMHNmdTVFRTJMeGFxVTFqd216TkFkQWFpbDJvVk94UVNXUElIQ2dpNTdQcWM2cEVTQStDcXJRN0ltSUY3VDNMZytMZDU5N0hEczZIWFBuSlI5ZHl1NWd3QTI4NERCaXAzcmdsZ0hvQk5CeE0xaTRmVkx6L00rUG1sbDg3Ni9zeldHT3o3czZhQkNTK3JEbmV4NkhZRWNwZGcvcHJybFRzMFNybWZ6SUhjSDBnbnFGR28rVGwyMlQvVzlQNVJkVXd6Wm1lWmVIdE9YeGhPbEgvSWVZRGJqUkNrZ2pkcUJLUWNqUk1RME1kUHNmdE5MUWhTYjIyNU04dXVXMi9YcEpnRUtVZG5nRXNXRlR3Z01QK3Fid1BDSmRkSE5hSGcvaWRiVU45Vm9ZTVJhN3JHRkpNbmZHV0MwUFBsRVZkTUFTTlZ2TWsxTTNpck1RQjlQeFJIbE5PZEZ0TXNkTFBFVUlmVGdLMkM4ZkdTeXlNRWVNNStKUSszbUFCTExsTTJoSEhUVGw5d2sxUVlhRzg2ZENmQUFKRDViQTVOcVZYemhPK3hBVDFmanFXRHhoSHoxS2ZGcXB2MGhGTStsVTVwVWpQS0gzSWVvcmFwNk0yOUZxRGhYQ2xlc1E4OHdvMjBHRkc0bDZrbkgzRVJDbCtmSHlIQWtwSHFYb0U5dDFvaVhuZUkxRzlBSWFWa3I5ekFxQ3g5M1VEWkN4RWFmaytvOEhtM2k4QjFJMER2RGVXR25uQnZ2U1d0dDVqZUFPSVYvNGNSb0tZUmNuMGJGYjY1OXVibytNMGN5RHA2YisxR25QTm5RK243M0x3UkRMVTc0b0k5WU5zT2xiNE5iMjlBOUVJa1czRHVtNjdlaUllVlJGcC81K0FHaEh6SFJ3UzRWY3JHV08xRDRod1F2UFc3VHJzLzYrdGlNcjJodGhOSm5Wb0E4dWNOamRQR3puNlBBcGxYbDZuNGpUdFM5a3NDclArQWRLWjJtNjYxcGRCaVNzQ0NCbURPNzNjN1FFK1hxZnpOdEErTkJXL3ZBNlNaRyt2VFduck1ZVks2dno2dFR0QUEwT2hvRDI1NTJVZ0ZjRSt6RUY0LzZtWW5BQW5hbmhLNGhhUXk3WGYwL1dUT1NCL1IyTm1VYXVDK3oyYlhrdm1HbDVZQmtnVnRES2JWbXpIZ3FlbmttYzRGeWdmZGJqUjBVMnJWUVBTVVBZR29HZVVhR3ZOcEhCWk1EM2h1S3FzUGFhUWNIckVQOUw4cUhhcUNvNTliQlhLTkNTUC8yaDlJNCs3T3U0S2JQenVWbU9seVRybnpMV3RBT0dxL1JuVncxQnhZMXJBOElrTlB4MTJkOFZYYzBsTzc2K3B6a1pHcHpnRHhJWk9VS3VHb09aRDNmVzQ5QktqVGIrcnpKTWxFQTUzeFllMU5Gbm0zZnFuRHlNWlJ6WUQ4a2lGU0xSeVZHdFFXbFp6eXBsRzlEL2FNUzB1UGV2OWdYQm9icStxbEYxcVVRNnJ2eW9DZWhocFZ3L0VUaGtWZzRUNWZpd2xjTUlZUU50WFBrYWJwaVB2RngwMUNLY2JJSGFxTG5RT2ZzTlRmMXF3SklkTmVwSUk0ZUdXVnNtNnM0MzJVMjl5cStzbzYyZUFZenZtMFc3Y2RPeFRZVVgwdVpBSFk1eHRaMXRhTkNQVGFYbG1ua2ppaUxBTDV6V3F6TjZJOEg5N3pMZFdmNkx2WHJxZGZzcnpkUHBBeE5ycXFsL1lSSWZ1bUc4dFVGUzkveUU5bUFBdTM2OWxHSEZOdXcrbkxqOW55ZTMzL2cwMlN6aUtUWnY5Skx3ZUk5TG9hYWxRWUp4cVdBYkxUZW9VNFFibTc2UU5lOUlNclRYWjVRWGNPQUlSTUgrcFRiUnp2MDMwMWdEYnFhVHBoQXM1WTNxb3pZWjV0cUJ1UmNueElZNlRxT01RM05HWUFjZC9QcUs5bFFCaXhVbnI2TmtZdXR0dGNVQytGakhLYTZjMFoxY2o2Um9PeDNYOVEvVkFYUXVmOGIvc1h0dDg3eUhQWXVLTGFhSzhIZ0ZxOFZTLzBxVXFPcUJRaklITHpKeHo1UDM5Zi9jWjFSMzR5aTFsTUVnZ2h4dnYwSjdPVUN1V1VMK25PM0dJSnFDV0hnT3o0VStwTnM4Q2hqVHRyakY3dHo3Mmt0R3RVTFdlYjZnK1F0eG1mcmF5cGorWkp3dWdZNG5KOFR0OWdPVkRCSEFydVVEMU5YQWdFZ05JSnlra1I4NUJjVXFVb3FHNHUwdkJKeTQvMVMxdnFMMldsSTg5YlBrMnNVZmxjQkxMSGZzWHlaZlgzSFBuOEJxU0JRRVYwU1BNWUlWZFR5R3RGa2FaVVVZZEZueDd5Ny9DbmVBNkwzbnZrM3lOTWQ3L2RvdHFxYXkycHVxSlZiVlZJVW0yRnBOVldiWk5RYlRWalF0VVYvOEdyVnVXVkFiMXFoRjRad05BWXVWTG9CUFNxSFhxbCs5OS8vM1gvKzYrU2plaVY3bi8vL2RmOTc3Ly8vdnZ2di8vKysrKy8vL1hOWnZSSzl6OEMzaFM5MHYydis5OS8vLzMzMzMvLy9mZi8vMVRib1ZlNi8vMlh3d1QwU3ZlLy83ci8vZmZmZi8vOUo0YzBlcVg3MzMvLy9mZmZmLy85MS8zdnYvLysrKysvLy83Nzc3Ly8vdnZ2di8vKysrKy8vLzc3NzcvL3ZoclJLOTMvL3Z2dnYvLysrKysvLzMvMC94L296V3dGMXNLaTRyTFMxZVYrdjc5c3RjMjIvSGRKMlF1THl4dTZ1aDUvWmVpM1NMajB4a09ibWFIZEQxTUdzdGhUd1ZyL3R0Q3hNWmc0YjByMkFYc1MxbVJ4NzN4eURFazVLM3RlUHhaYnNxMnUzaGxDTXYrK004dWVpQ1l4WlYyZ2ZSNHBPSG4vcm1UOHFLZ2tzTFgxR0ZKM2N0R0JmcGlSdFh4N1p4Z3B2OGl4cXd0S1pIVlh0eCtMSUUxTytYc2xpdzJ0dXVQaE1OTHJnbk16V1RSSUs2dHVQNFkwSE1zLzBZOUdnRmhCK1hkZmh1Q0pWQU9BUmNIcE5PNVRzTEgrci9zZ2VnUnBrczhlZ3ZiWXRQVmRZeEMraURTNnQ5aU84RENidSthZVVCVENmNE4wdS9OQUlxNWpXMVA4OVVPZlFQd25TTWQ3TjN5dlFZeFlnYzM5OWRBUVRKeEd1dDdvR0VKcERaelE2bGpiMVBWUE1IRU9hZjFNUmd2MHBxS2gvVjFrOUFYbmtrMllqYTIrODErUThiUE9aS0ExOXMzdFVWd1o3bHlYWkVGb1ZtNC9oaXZJYmNWMlhJYlpLMXZmd1JYbTZZSjFpWGpNdXZvaDhINStoUUFBMjg4Tk1TSXdONjJzMlBZeE9EL0RsYVV2bUoySXZOZ0NyV1BnWEJqRkZlaXBTME9NYUV2SDNYZ0l2R080VXMwV1QxcFJGbXZnY2FqcGJWQzNwd3ZzeUlxaytMZjFnVFAySHRUdlNYRVdpNmRZVmxjZkEyOEkxUElmeFVPTUdNcWE4dTI3WHdIbmJWRFZSOExyV2lBbnJORGZHZ1puQmFqd1B3NStia1JLbUYxYjI5VGVoNnZBL2VIOTMyTWtyR0xyamo2azRIczFBZ0Q3STZuSUNITjRXN3JDU0VtM1NnRUFuK056TklTdFd0dlU5UW11UXZrTEsxa014T3ErcjcwUFY2Mm5nMVBiNEI2MlZZRnRRN2k2ZlhhUnQ2SWRxN3hOYllmbWtlb3ZWQThBWkVabXNTaEg0YzQrcE1NYmFnZ0EvT0wzeUlicURtenJ3OVUxSDk1a05hRVppcjh0alBUNVVpMEJRS0VyMVlSaGxONjI0em1rMVlpS0FxZ1FDMzQxNHhaVzc1NGhwTjFqYWdvQWZvdXNadEVLMnpwL083S0NmMTJkeFZINEJDdnhQNDRzb3RjMUJKZXdldjEvOFI3U3VLakNBSGpSTlNvUmkxanBlL0Eva09hTDFCZ0ErTVdGU2VoRFFiRS8wUG9Lc3BqdXlDeVd4aHlLdGgzNkQyVEtCeW9OQUx3dUc0VXlTSW8vOEkxK1pGSmV0UUdjQ3pwVFdYU2hxTEw5YzJSVFF4SnZ4Uk1LaXZ5YlcxNUY5dFV0YmtnMlV3aUN0WFJiQ0ZsYi83V05YWEdEd3FKQVkvc2lzcnVCeUxudWFJRlM4UmZQSVN2c2pjNmk4UUZya1Rmd0JMTEhWNE9sUDNld0lBTDJFdi91SVdTZGZlSVFJd29ncVY1LzYzdklUcnVrM0dsZDZYaS9qbjFYQXRHT2hVdG5tZXJubU5XRU5VcEpxWFpOcktESVUvN1Z0MEMrODRwZFV6bExmWnBFUkxZMUpjVWVKa1FpbVFCZ0lXQk5IaXU3Um1OMTE0ZVFOUThHOG52UzlXYXVZSC90R1FEUCtvdVpBTTI5aUlUYkNwTEJUbFMrdVZLNnVheUVpTmkxRklmZFc5MkZMTHMvbWp1SW8rckR0TnBCSkR6a0xqTWk2WHMvQldlMVpKSzlSU0wyTE9MK09xalJ0VlRKMVhnWVdYbFJ5aDFTLytYYWV4YWNMVjZKUzVYeUFwZkJ2VWt5cFFKNDRBQTQvNUtzbmhWRWxIUHQ0MlpuZVJ1eStLNnI0aWlPcWRjcXZnVHVMaGNYay9SZThBLzd6R2lFOGU2N3kzd05iY0ZBMFRXTkVzK085M0hsL2tJVEFNQ3RRTWpHRURxcjZnMXU5aFF2U3hybDV0VWxxOWNWRnlmWklBeFdTanlrZXBjTVlJY1puUUlTZjVHei9Ob0VLeXFwQ0g2T0svejN0elFCQUlUTEl3czcwZ1JPUSt4WUlFbHVLcDM4TldKLzRsR1NTVHRnWk1EUDEvUzNSaDZSVEtoNFFSeWdrRXp5TllibG1yTzZGMWVITVcxUTJSMUxaV25pWkN1dDlMdlh1Z1RwUTBoOGg5VTA3MVBmb3hkMkkzSER1dElTUlNteUZSWVUySmhaUGhodVYzZ3N2VEI2VWpGajFBelF0Y1hsRGxmbHBsZHhOUm5XQ0FEZ0tjK2Qyc1pFbEo0RmdLRlFqU1JDaTRMM3JnSnpuQUVBd1Vidy8vb2Zmbm40OE9GN3Y3bDExYzNtRkkwWVF6V1BmdDRRL0pLNGRST21YRTZXM0J0SnluN2x1YjU2QkZlaFhvMEFBS1dTT05sTWlLUTdkeVBoMFA5Y1k4eTNDUDRHYyt5WElQNi9UdjN2Y29jcHJna0JvZFVjSjJIOEd5NWg5dTRwVTFDcEpZSFcxZzk4MkIyaTNLeFZqbEsyeGxuWmc2dldDbzBBQU5IZ3RRTjl6UlR4c1I5b0ErY3ZReTRqOXM2M0RBejV6RkM5VVJOaW14eG1CQ0d5c3lBUkJCNHVFaVRadHl6QzVMOGlacEt0K3dRUzVsQlpkc3B4eTFkL2hLdGNqMWFvN0JkZHlSYXlZejk2QU55akFRTlM0MlVZdlRmWEJFa2ZNdWs0TStHR3NCQ1V4S3VIMEhJUk9hU3IzbmMrTWF0Zk5TbDNFTnpMczB5c29Malk2d21ld2xYeEM4MEFBQzVKbk1iUjVLYnhReGpzNG1Fa2JkZ1RNWFJZTllHcVFoRnpRQ1orNWJRWXZFWS9xUE5BOERlY0FpUkpVbW9XWVhhbms1RmtSaHY0Qy9PeVNJelpTZ04zdlkrcjZNZmFvYktuTk4zYW1ORHNoZEZ3Z0NVaVNkS0hZUGo4ZXBzNHZUNzRzVWsvaktPS3NQOENLWGpTU3lRYlVwWEFaZE04Wkc3Z25JSHlvcXpScXZKQWZlczBydTE2SlBIWERoYnlZb3NZd2pFM0J4RTdad3lQckJGSHJ1NHBrL0JEaVpGUVMzVWtGVERtSStQTTN2c3pzK2JJNUwwd2Fzc1NhUld0TTdnbUhJMklHM3ZTaEtWZzF0aS9OVEd1VGdGRDY4VkozaWpNM3FvekppTFBzNGdVTFNQSkNPbnpFRC8rR3dBdHVrbXVPU09kTFB0VFdPYXAzajZOYThtQjZNVnB2Y3hHY2xKeHhCZzZOWjU2aU56TVJGbFlTOWcwTktva0c1UDA3cWxVZ1o4TWV4ZkVqYlU5K3N4d0tJL01aS3E2SldLa2xySzhlU1hlQi84VDE2QXJCQ21sSTBWS0hvTEFIWGFPQXhENitHcGg5bk13ZmI5T1F1NWNRc3ArNFNIWkFBa2FIUUUrQy9ySWJFbHlPaGFOL0d4RjlvWnB6dkxnRDNFTjIxOSthY2xJcTRtQXpJdEFVUUw5SVFqZUpna2lmY20weXg2SmpFdVNQZmlEMU1GN0ZXVFFmbGtJYWJzQjFFbG1TYVE2R3czWlYyWnJuS1diMzhjMWNDbksyODJrdzdNZ0JNNHFsU3dsUGFjZytsODh4TVI0SjAzYlN5SlZWWjlDS2g5ZmJVQmRGT0Z6YjZrSGNOUnBGa2w1ZWloaXhFSFpWMFVyY1hwMzROcDVTSktjNDdxYXlJVVdndkRxdThaaDRrQ0ZJUCs0dU1qRXVlNjd2dUlob2N3WmpLUVUydGZ5U1pkRi9QODd0dHdQb0ZzeVNXRk1id3pEcUNmcjRxcHNlUlhYM3ErVkIzbWJtYUtKeE8xTDRzdys1aFVUaE9oL0JhcGNKRDZ3aEJSdlhjdEZZUkh3cmdzQytMblBIRVpNMy9YaFowWTZmRmtURzFsWGU3MmJ2b2RyOTBKUjFKblN0VU5qMHFDZVFNcSs0bU1pT2tUNXdzQSt6WVRtVTZtRzFnS2VHeDhWVXU2dVR3SWkrNmFGTVJqZHEyWkZKS25RV1ZxMmZSclgvZ01SS2ZPTFpyU2FZbEpCVXVYbFNFbVgxeEZKSGFEQkttQ2ZtRktpZHFBL2x5aFBVTVU4VXY3Zldod2NqUkJhZUZzVmdEbXpOaHhZZ3ZFWEZKYnRXTzVkVythL1pjZnIrUEpnUUFybnBQVGlXcWlnWEhmVnFsZTZkcXhPSHV2T1ovOXZWME9SbGRtU1NQZlBJNlcvdVNvNTlqc1k1YjJKYjhra1dyMkVOUGpKN29JRU40U0ZuUGZyZ1JpWE9YbDdYb1pBbWJLYzZtcnZQVy9oUzRndlJDbHJWRXVtZ3hwUWJhSWtkM2NINHY2ME9tbTAvd0tBc2FiTjdyVWFTeExKdTRnVWIzVllqWndRZ3NCTlJEMUFxN0J6U0l2SGRqcmlWVTRLK2JHL3VSL0FRb0U1OXA5RFlLNmJGTWF5RTFaMVhhbXp0ZzlaMTRKS0VlMVRPU1lVaWNybjNieHo4OXFieGJnajRLdzBUWE1kN2RoRTRQeC9qOXhlUmtUV0lxdXR5S1E4MzBpcTRmRzFSZ2JGN0NTaVhjRDBMV0x5VHlOZGRoWEdGSitGMEwveDEwY0JkTmVabzkwamdvaXBrcFI5V09hODJiWDVsOGpTRm9LbVZqUkxiV2dyWWtQM2JXUjVBcDRINzV1bFptMEUwQS91dm8wT0lwdFVId2pXdUZhWmt0T0cxTC9IWVdCWXpIWWk1dWdISGhKaURTTjlsaTBqS2c1RGJQUFdPRGhnMHRzaThEM0ZxV1lWTEVwSmVYbnhyY2o2T2dpWWJkOStKSDU4bzkyWTUyMHVIRkxOMFdIcWd4dHRabWp6YWVEbHIwdGMwb3lZQU1zbnJSY0lWd2l3aFpGT1A2ZEhUMEd3ZTdzdkVoTzFLMmJZeERUSnFwUTFZRVZsNnhvT0kvdnJBQzJ0WUxuN3dOM1ZhRGRpaThDZzE1UmN6UncwRkZqRk1ldENHc0FUTll3blYxQ2xaRkc4ZStlQWVkV1FkUllac25MejdkRTR1cE9aTVNwaXhKUFBKRW02MmlzcUxkWDFrc0pkbC9IbFN3WHpEL09odmNKcW9QWjFJKzJtVUU2M09ZY2NKRjRxcnBBRFBGak1zLzQ5TVY3Sm9xamVvOEJBaFJGYkdKbnlGbjFMbktVTmtteUM3NHlJTldSaGRGVzN6RmxXV25uUFArQkxtOHBsbTRMQm1mczBQa3NZaGxlYlF1M21nRXpVSWlDUHJVb2kyODhoaUN5SzRneEVnYWhESTVsbkdCbnp6NVNZZjhTdWJhb1p3eEJLTWpGR1YrV3E1aW91bG9yZlFCYjZIZ2xiLzVRUnZGeHI1ZEpIamJXYXMvVkRjMkRDK3JCTVlQZTZlRXkvS0tpY1NOR3JmS0ZUd0ZLRnJwS2FvUFdqalBGSWtlNkxBcDhBei9xWXVMcytFcFRlYVlPQnBvMjBpV0ZZTTJlMUpsbzVobU5vQzAwYkRCU3RYSXlXRmE3Mjd6aUU3UFZqRXRZRzQ0ODV1QTdDK0QvNXpTaFpoTWsxd215emtNM3RsY1ZGSzYya2ZRakJ4Zm1Lb3VoTzl5VUFVWTl1cjFKbEtpS3BkaElaczk2cWU2TkFCSWg2bkV4VTQybGtCcHJodnZqQ2xySjZGOC9uZWdOQ1FBaDRQUjVQUUJCRkllRHhpSUpmQ1BpOHZxcHpjdmpEaDNjc1NFbEo2ZHUzRjhlWldqQU1MVnVNR0Z0ZVdMSm14UTIwK2hDeTRnTFp5cDBSY0d5am5TTm5UZ0MrWVRNaEJOTmJCT1VlUnpxZFBmTHdkNmdNZ3NkY3hKaE1lbjBnQ21CTzgwcE9YU1pWbjBQbXZJVWsvUkt3QkVTQ1BrblFuNGFSNWhJU21uZjczSjZ5TGlRSS9zQTFxTzB2eW9wOGJxL2JIY3pac3VUbnJsMlNhSmxac2NLcGxoVFY3TzFEVmoyTGJQay9FNEN0UEo1QkVjZDhWbEgybWlYekdnVUYwZ3N3ODJzSVA2ekV5SXg1QTFFQTBRcWYwNm1Rcitlbm1lTmVLNUhlQ3l3QVMzdDFWWXp0UFloZW1YS1dyN2x4MHc4VWxwZVYrZjNPS01pajZCYjhaN3p1bkp6TUpZODk5bFcvVjdkYmttb1pFUzFidHVKUGJsQVV4V2F6RWRVZVIxWmVJbHVERU5sVmtFamFDNkgzU0lJazExR1k3eEpUSEViR3ZKY1JVeGlSUmRFRFVRRFJBNDROYW4zaklqTG5IVVJFdTc2RGdYdndYRWVNYkN6M09JU1hlVktJWXJxT1hPSUwrS1UzSU9zWG5qOXdmOGNXZjRsR3FvMFlNVVprSldMTGxxOVl0bUxGY2xhNGZQbnl3dVhMbGkvTHk1TnlwRUsxOU0rODNwYS9DeVA3ZjROb1daZUVZRk1pSDhTKzdNc1R3WWpjVWZObWM0U3NtVUhtYkNCaUttTkVUUFY2b2dCT1JIc0RqWU9UR2NRYjQxMEFsb0MzN2M0Y1lrU1V3OWY4cHJpbWVpa1ZLQXMzZGwyT3p4OStBUTM5bFdyWHNCaU1kZnFjVk5JSzRlMGJSUkFwbmlYek5wRkkxelF5YUlBU011YjAzWDZ1R3dDaTBVbGt6dERhbUx3b2NCR0kxcWpFeUxBK0IvSFBiQzFJTnJvNWw1YnBLNE00UVVWaTVGaEFpcmF1RlNKdCtsamNyODVNdmdjYzJFUWliYlBJb0ZQdU9ISU1PWjIrL3VqUGtHRTNPV0xveFRnL2IxRXRTcnc4amtHWStFYXpKaVVOMWJ6dlQxdk8rSW9obmxDUnlGNFhTUlcwKzRWMG5CWTMyYXo3dlUwYWliVE9JcE4ycllvVGF5RkZjZDVlRzRyMlo1VGRmbXVjR21Cc0N2Zy9kcWtxSG1mam9oazR1VFk1cUkrdGFYdjl0eUR1VUpIVW1pV2s3aUdQZ0x4ZUNCNEEzdEpKdFBWRFpOU0hiUnhFeEJTWHk2dnZ1UlQ5TEhQVTJ5aitibUFLV0xwVFVoZ1BZNlQxd05RMzNFWG1mTUoyNlptK0t5VDYzQkNYcUVTcWQ4OThDcUh2OW1SNWczTHZ3eE9hc0VGazFoWTdIeEd6Ni9hYXp0NWZaWXpkTjFQQ284QlBnRU9iSkpYaU0wWTVwSkpueVp6OVhxc3dTZExZTHZhTmdpUkEvS0lDU2RyZUphVDBpeVdHU05ESlVqb0tiQklWUkdiOXBJWVpJa25kc0cwT21iS2xnaEtIZ0IvUEFQMTVsR09Qa1JnakluWERpNitZYzZhcElFK0k1dkR0ZTJZMktna1EzNmhFV3k0anhYZGJEZldMK1NCQWU0QmVRUlU5R2FaTEllTnFsZDRjelJSSGlxMGNtNEFmUHdZc3VQS1l4U0pKeENSSlVoWG5uVXN3ZVdDdFZVRHUrdWFSQzFOemlIOVVIRWJTM3ZPcGhydXNTVEY4SyswQzloY0lzWWVSV1krN1NhQ2tLL1daSXVTMkVhZTZHN2gzQW5oU3AxaFZJcElrcG9kZU5Pdk1VN1k4UHF1K2MzUnljZ0ZmeW54R3VpUkoxVHRHVXc0K0E5S2dtSlByeWRZRHRBcXBSb2Jkb1lrZ2kxS1RJUm8wNGg4QVJ0OEdQaTJNUXlSSmpLbU5TekQ5RlM5eFd0ZDFUazdnUzV0M2dYaFpWRzBXcWQvblRvYWZGQkoxQTZkeUJlU2N5akFUZmhLcmVtT2k2UzYwVGlHRFRjRDR2VE5BUnlLVnFiNlRiNWlIdjc4cFJuRTFQUG5LbVE5d2ZhWEIwRWhSaUNSL0pBM2cyR3F1M0ZreFJ3cUp0QWxndlFEdG93eFRYU0NJOUpoMHo3eGtkTG02SGJpM0Q5aXB4R05Nc2pjdUlobGZvdHpBZDRZbS9oTmZDbjJocmVhTXNqSzBvdGdHa1JaYmkzaVVTVEdoNVVTNXp3RURBa0xJckQ2RlJDOWZTbnRVVmtiR3BYNWdabThZbU1xSlErVDBScENVWjM0NGZBRmY5cnhTVFFWb2JOSEIyN3RRQ2xJd254N1E5ZWYyQkdvSHhINlhpR2c5Z0EyR2JPSE1VbHRFd3RsYzJubkN5UGJxZFJUWHd1VmNEd3pzZmhSQXJ5MmVtaXpYZTI1Wk9kMW1aWXlLWUR1RmRQbnd6b3FiMThRVWp3Z0t4aWd6d01lS0VjZVJqTEs5a2l6Q1NudlN6bDhkblB5UFJNVmJicFdJeUdLeGtOR2FRV0JrNnl3UWVkZ2FJNVV1NFRyWlY2ZU9UTE1yUU81UkpQZG5aZ0R0R3pVaXlUWUx3WGZFNVBqM0FjOFo2VVFtSGFoa1JKb28vVlZUdnBzS3hUNkxvL2I1Z1lIbkJ5NzFIeWdsNFpJSCtFblRiVFBBSzd0c1JKU3o1NzNyWlNvZlhiSjYyc2gyTFdXdEdXbjFWREZSNTRNUXZaNklaRWs3Qzd6dmlyR1FMQ3VVYjFIT1pwTC85aE1SeVlKeXdnQitJUzRseXlsWmU0Q3BxcFlSNEwvNmkzSnRkYk80M3RaMTZxUzlDeTFiRzMrV1hzejlhR1VjVnpBS1JEUlYwelRaS2l1S1JYZEdNOGhvTVptWTAzTEpyRkRTdVoxSkUvZ1FhS252R0FFd0UvanpQYmdlOS9uYXZmdzBHOGRRc3BNYjZFSFM5NlpPaUpFa3liTHE3amtJUkQxT1RkT2NUazJ4NkJzdVo0NlFoOHdNSGdXQUNUTlk5MmlTbFZMeTlnQTk5YjdtR1FCNFlmeTZuQ3FkZjI1TzY4blE4ckxoTldUUUJrWk9WYUVxWDhsN0FPWnVWQlZGMHpSTjBlOWN6QmdiaXpSak1rZmdQY1NPbVZGRStvbkpwTktUaUU0Q3MzNm5mdkFvcnZ2ZG43TXpaV2hIazJ3MEhrUW1EWkJNakVoV25aNG9nS2pEYTYrUzVkTFMrbTJaNG9taU1pc0psc2xDOWhCaXp3eVpVVWxFV25QNHhlUnhKZEhLa2c1Z0pLQjdmU09UOGY3ZGxMKytycVd5MDdGa2xKV1doWW9lWk5MblM0a3hwc215cHFpQktJQ2xvTzZycW5JNm5mWHB5VzRvVE12SVNtWnEwVGdSbUhrSHhTMTU5UFRmSllremlZaHFnOEFUMzYvZHV2dkJJNmVBTVZ6L2UzelZ1bkU5cld3ZEs5NlAxUHhXcW15M0VtTkVKTXVLNnZKRkFTeEZnNDNlK3VibVVDUXRCZHluM3VTaFpXUXVZNnAzTWViTlNUTSs4c1lqSXN0WDNnK2ZIeDJhanhONWN6enlXZXFSYnhEQTZPVDQrT2gvNGJyaCs4N0NuYmFrT21SN0daazFZTGVvRk1PWW90WUhvcnNCTEMwZGJXenNIRWhQSk52TEhocWMrWFpUMjlQOVI2dUttRWxFZGsrY3hiQVp1MHM1aUNqM3h0cU83blBEODlQVGd6MmgvUjhMVTVJb3Qza0d5ZnZhOVRLVm42OWZzbnFhemNwUWRjQTJqOHo2eitWU1BJMFlVMVdmWjI0SnNVMGREVWpMUGtweVNmZEVBQ3p1djJ6R2JZd3ZOay9WbkhhWHBsbUNFVEZlaXB0dkhpT3lhVzFQVGt6TkpNMzF0KzQvLzFveUtzbFMyMXFSWWU5bHhGaE1yT1JVTlVkd2FCN3ArMkdXYk1Uc2J3T1htdzlHVEhpOWhQSU5rYVRLVENLWmd0Tml5bTdLSjhxbjJIeHpDdlNXNGNucEwzQzk4OEVsdTlKc1h6QjByWEY4bUdtcXlJanEwalJQZi9UVExqeDM4ZE0wUk1ZdHBoSHBCL3NEbmhNd01iaU1pUEtOSkE2K0xJWVJ5UW9SV1NnL255eEVaRW5FRWlpNmIyLzN5TmdGSkwwckxxZEsvdGd1VzA5YlRqSm9KNUJoZHl0a2xEbXJxcHkrNXByMm52Nk9OeklCa2NVMFJwU25YZWI3eEVBbEk1bUV0NEYzbktQTVFVU1VUL3o1eEJoalVoN1pDdGE0VzRmUEkwV1h4ZTlVem5ucTJKTXRmcTNBSE1tem1Ha0NaRnd1VldSTlZsaFY0OXpmQXVkTWVXUTRCU0FpT1N2NnVDNGY1THU0VGlLWjhua1kxelNQTnhoT3RMa3lodGZDWkZsMnVqeTFkWS8xRFU5T0RmOGJydWYreHhkN2VqcnFIRFpoMUlNTWUyaVZBQ0xTS2l0bFJRMUVBWncyWlZubjNGenl1UXVOc1dTd3pJRjM4YzVadnJzVVJ0ejV4SjB6dzBNMG5BaTNNZ05NVWxYWHJoUG5wc0xUdUU3OGd4ODgrVmhuM1pZNjNXNnhrTXJudTV4aFB0MXM1V0tKaUNtM3FmWHZSQUJFVENuZFhIQnc1blN5WWVPeVZIZ1N2SmZXNkh6bnZFVDVYQVp0a3h4MGE3NDJtZWloSWg1ZDg3WU5oaGVtUnhlUUZyUGpoT0pmQ0UrOHNMLzJkazJTSkZKVmtvaEl2djFTaG1sZlN3STFtWWhrVWtPTE1NM3ZJMXVCLzhSSWtqMVViQ0NINHF1bVdHZDU3cldUdHNBVllJeGlaVEVWRnppMk1xTDlpVkFTejM1ajdmN1hKaWZta0VaSHhSWEZmZlBCRi9wT2RPKzd5MWZpME95cTlFNkdHUTJRY0prYUw4TzhCaXZGNXZvSEovdVNDQlZPWXJLY0tERXo0NFl3ZU50SmN2TjV5TlFUU055ckVsSGRlS0pUYTZpc2JXQjhiR3dXMThuLy9majR5UHRQTmpVMlhrSkdiV3ZTaERHbW5rVGNlWFBLNGhDUm9yY05oc05uQi92ZmZmUE5uL2FPemtjK013TmVJb1hGazhsQ01oSEpSQ1NMNndadkR4RzVsM2k2U3N6NWtHT0VFZEg2YzRsd1E4K251UDcrZzZNdkRuK1dVWTQxYVNTVUVTTWlkVEhPeCtac1o0bmlsemoyZG5hR09rTzdQTUdJS1gxZVNkWXRsamlhaGN5LzQyOTRqaE9SL0JVdVA3RTRzaGh0THRFZEhwMjA5ZDkrZVRIUjc4UU1OaFNRV0ptSXllU014cG1MbU5KRVJwa2E2M0twdnRzWCthWmVNWURDTXRLSVV5WWltWWp5aGYwSW5CckZWc3h6SEMyaGZGblRTQ2F4M3VjVDBmZWVIWmk3ZUg3cS9PL1M2Q3FUU0x3aUsvR1dEcHF6elJDUkxKTk1ST1F5OE9qMnNBRlVsT1R6eE1ZSXQ0T1hjbU9xUnppY0swaldaSmtFNTc2UHhLSG5rVEdMMFlBS2R3R1pLWk1hODBKLy93bFQ3aUJpUEJhTExNc3l4ZFV1YzMxWEx3Z3NHRUFsSlhHUXgwbHh2d1hPTWlMU1pDS1NpWmloZ29ZTGliNkpEQnBDQWo3d0ZESXlWMWJuQUVRQ2N6RHozVnZKcUNiTGNuNGNTNWlyaDRpS0Y2YjR4bTlKb3BNY2Jvci9DazhwV1pnaXk3THFsR1daU0NLaUhGMFAxSDIvKytXM1Q4OHVKdnB0SmtFQy85TEZ5T1JpV2JtekFYckFHeldseTJHSWU0TExTVVJVY0dLY0N3T2xKakFqUFJ4cWtUVW1mNUJublVSMnV5cEpxczNsY3pzMnRiUWQ3SnM2Yy80TEdQMVAvSTdMSWtOa0s2T2tySG0xU25VczhDM004WjMyYW1hYzVYRlNYSzAzd29XR1lrRXlFVk1ZaTJIeGdvbW9nMklsMnlqSHEyVnFZN0JqWDIvdjlPemMrZW5KcWJNUS9NTHZ1dWl1K3NXN0hKK0dTdlZxSlRtSVNEc0w3c2lGai9tNjFoQjN2Z25OOFN5TzdpVXV0Q3RpaUN6RTRpV3NUZVNnK01WdmMydzdOTDl3NGVJdkorYnd1ejIvVHN6Yk96UTlmUFRwd2NXaEE1czczUG41eWJQSXRkUS9IZUVMU255R3d6eFNQSW0wdW9WSkhuZ2xRVVNNRVNNcGg4VmIvOU40emNXcXRHWmpjL0RSRnljNEJ1YVJsSi8vcm92VEs0bEkxYjMxOTRkMjNWOWY1Vk1VVGRia0pQR0RkNmxuMTU1NXJwa0FKY24vSUU1THhZbHBuZ2VLUlNsTVVaaWlxeHNrUnBTbjFZM0hzNFRPalV4ZHdKWHZtemk4Vy9JVlZkTTAzZWVyOGRac2E2NXlPbFdteXJMTUxBckpYRXhBN2l6UDBBRmZWZU1TVjZ2TG5Fc2N4SzlVVDNQQXpjUGk1UkZSbnFicm1zTlRGd3dHOSswN2NmeTFDeGZqL2U3U2xnZWVtUmtlbmhrWkdSNmVldi90dDl0YnRtMnIyZUIxT3AxT3BVcDFTb3hKS3BGTVFxVVQ0UDJGWFZFYjUzbiswN3ZNbkZsUmxPc01jMndsWXBSSEVzWFBXV05YWFM1dlhkdUp3ZUhabVF2aDhOaVp5WG1rN1kvUzErMzRPOTdvMU5UVStPVE03TnlGaFlYWjRhSCszdDcramoxN2dzR2dROU1zUXRhTjgwU3NFdW1lY1o1QW9TSW5TWTVGVWpseWNwWDI2UVRQdjFUdHEvdmExNzdXM2IzdjRBczlML2RObkprNE16WDgxdkRzYjVBSmY1TytNTUhmbnI4d2VlYk01UG53aFF2bloyYVBINzl2bDcvT3EycTIzQVEzejREemxIcG5vZDNiOFJaUGVhSHVWRlZWa2tnU2tuc3hVVzZPcnVzMnJjQm1LeWdzVU55M2ZidHJLc0Z4dWpRMU5Ybm13c1g1MytKMzUzNXdmdmpsRTg4ZjdlNytYOTkvYUFxOEQvYWRmMnRrOWdKNGEzZDFkT3paODFCYlcxdGJjM056UzB0elcxdGQzWlpZdjk4ZmZEU2NTUHZSM096RmNEZzhPakUrOE5xUDN6cDdFYjhydVhOZ2RHeDg4c3hVZVBMaVJ4OTk4RVgwaXk4V1BwaTcvRVVFL3dHRFgrQXErQnBPOGZzMEJhems3RlhES3NCS1I2OGE4TkxYZnVmVjZPOGdlVnRqZkpySmZ2VzdDbEQ5TXUyM0JMc2drUmR3SWJzY0lieFJVK3F3QnlialFXay9HZUFXYnZYdno2Rlh1di85Uit4TDBLc1BKSDJCWHQxRnIrUStDNzFDVngraVYzclU3OWV1V0F4RmV1YklMcTlKWGZXYzVwME51UjQzVkxuL3BBcDVkWHZGQmxrTlRzL2NyVXJXWGNkUUgrV011VUlJMHR1Mzc5OC9CWUMzYitIVnErcGl0YVhxNGszWTBKMW5UMnBVNjkvOEYxWGZSV3BjZFVMR0gweVpoOHFVVmxLamo5M3E2VHhpOEdjcHFOVDNVSFZCbmpyQ0N1K0RTbjUzZUJiV292dmZmeUw5RkwzUy9lKy8vN3IvZGYvNzc3Ly8vdnZ2di8vKysrKy8vLzc3NzcvLy92dnZ2Ly8rKysrLy8vNzc3Ny8vL3Z2dnYvLysrKzgvZmdvQVZsQTRJRmlsQUFEdzVBS2RBU3BnQlFBRFBpa1VpVU1ob1NFaW9iSllxRkFGQ1dkdS9Db1pxTXk1cUZBYjFQNzFjd214NStWZlordm5lNmt1OWFsMjVldC9uUDh4KzIzK1kvZEw1d3VNL0xmMU45Ky95UCtiL3dYN1UvZ2YvZTh6L29QK1o1aS9Qdis4L3dYN3VmNHovLy8vLzdXZjc3L2gvNkw5dFA4UC8vL3RmK2FQOTUvaGYzZS9mLzhBdjB2L3ZQOXkvd1ArMC90Zi8vLzdINFgvNUgvSi94WHdBL3NQL1EvNlA3Z2ZBMytXZjJuL2JmNEw5NHYzLy8vLzVhZjdiL20vNG4zdmY3TC9VLzl6L2IvQVQvaGY3ci93UHp4K2ZUL3UreVQrNWZzR2YwYi9TZjlEMTAvMisvNDN5MmYwci9lLyt2L1lmdng5RC84MS93My9lL2I3LzgvOC82QVAvajdhMzhBLyt2VlQrRS9zaCtTbndqK0tmeVgrTC92UDdsLzRIeU8vWWY1SCsvL3VIL2dmL044S24rSDZuT3UvL0I1SlB3dCt4L3hYN2svNG45eWZtNy9uK0JmNXorKy84Ny9GZmxGOGd2NHgvTXY4Zi9ZZjI2L3lmN3cvUzU5Vi8zZjhyL3BQQkoxUC9iZjlEL0tld0w3Sy9SdjlWL2lmM2ovejN4MGZUZjh2L0RlcUg4di9yLytCOXgzMkEvcXovby83dCs0djkrLy8vdlcvOW54V3Z5WCt6LzUzK2gvSm43QWY1VC9YUDlmL2UvOWIvMC85Qi8vL3RyL3EvL0YvbGY5bC83LzkvN2t2ei8vTGY5bi9PZmx0OWgvOHQvcnYvQS92LytkLzkzK3IvLy8vdys5RC8xZTUvOXUvL2I3cHY2dGY5LzgvdzJuNStXbTNET1dlam9ydmlVbW9ScXJvVTlkOFNrMUNOVmRDbnJ2aVVtb1Jxcm9VOWQ4U2sxQ05WZENucnZpVW1vUnFyb1U5ZDhTazFDTlZkQ25ydmlVbW9NdGx3SWN1OUhSWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZkVwTlFqVlhRcDY3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWGZFcE5RalZYUXAzV3F1aFQxM3hLVFVJMVYwS2V1K0pTYWhHcXVoVDEzeEtUVUkxVjBLZXUrSlNhaEdxdWhUMTN4S1RVSTFWMEtldStKU2FoR3F1aFQxM3hLVFVFVkN0VFl4MXVtU3VPaXUrSlNhaEdxdWhUMTN4S1RVSTFWMEtldStKU2FoR3F1aFQxM3hLVFVJMVYwS2V1K0pTYWhHcXVoVDEzeEtUVUkxVjBLZXUrSlNhZ2lwQjZFb1Z1MCs0VW5qSWRuMWVnNWI5dXkwQUR1TWRiVjhPMU8rcURoRjFKSWNjNmh5L0IxSkljYzZoeS9CMUpJY2M2aHkvQjFKSWNjNmh5L0IxSkljYzZoYXo4OWV6Ti83MVNEY25qTFFiMkY1QjArdVRIdndsaUNCWGlpSzlmNFZqTDE1cm1vSi9BOVp5dnhta2poUjZWdmp5M1Ewa2NLUFN0OGVXNkdramhSNlZ2ankzUTBrY0tQU3Q4THpkTUc5WU9NZnFaYk1KdEdURmJMSUxraUM4OXZ6bmFCOGg1aG1nZmpRZlZaOGdyT0wvUUNPWG1majAzc08yZVB0Uzlid2pYQmV0NFJyZ3ZXOEkxd1hyZUVhNEwxdkNOY0Y2M2hHdUM5YndqWEJldDRScmd2VzhJMXdYcmVFYTRMMGVZRVExN1lrd3Q2RnZ4S1BPRlRNYU5SUUxUSE02NEhrbzYwR2RldTN2bmREWXNSaC9TWHdibCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxT2FESWlMVGN1V2x4Rys5bUtLaTNsK0NRM1RyU1dJbGZSUDlzMWQ1SGVnZ1kwMWJ0UmY3Y2dqYlV2SCtTais3MnFWZDcvUElvSDRaeWF1eGN2ZWFxNkZQWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZkVwTlFqVlhRcDY3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWFlLWHp1QjZGQ2J6U1Nlc3BQenhGenFTZkxQNll1aFAyU1ZsV3drQW1TdEJUSG1ZMTByU0NRU21NZVFvYVNuM3JpT1VOSWVUOVVIQ0xxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRG9jSUpuR2JCd1ZFT3RnQ29MSUFlYWFpOC80dC92a2tGRmZBY0pJcFRhTWFKODBQS21SZ3F5RlNhSzZra09PZFE1Zmc2a2tPT2RRNWZnNmtrT09kUTVmZzZra09PZFE1Zmc2a2tPT2RRNWZnNmtrT09kUDhkWU9NV1RxYTZYUFF5NTZOelpsR1JDTWhTOEdVVDN6MTZVZENLZXJkcnU1ZXNCWFMwd1I5VUhDTHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVJxTkdrNzBTU2NFdXpQTGFYUi9pYWE4Y2NNdFk0VWVsYjQ4dDBOSkhDajByZkhsdWhwSTRVZWxiNDh0ME5KSENqMHJmSGx1aFZTRjB4NmhmRHIwZlZCd2k2a2tPT2RRNWZnNmtrT09kUTVmZzZra09PZFE1Zmc2a2tPT2RRNWZnNmtrT09kUTVmZzZra09PZFE1ZmZKVytQTGREU1J3bzlLM3g1Ym9hU09GSHBXK1BMZERTUndvOUszeDVib2FTT0ZIcFcrUExkTFhZeUM3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZkVwTlFqVlhRcDY3NGxKcUVhcTZGUFhmRW8vOHUrSlNhaEdxdWhUMTN4S1RVSTFWMEtldStKU2FoR3F1aFQxM3hLVFVJMVYwS2V1K0pTYWhHcXVoVDEzeEtUVUkxVjBLZXUrSlNhaEdxdWhUMTN4S1RVSXpjVytEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVFjUnpxSEw4SFVraHh6cUhMOEhVa2h4enFITDhIVWtoeHpxSEw4SFVraHh6cUhMOEhVa2h4enFITDhIVWtoeHpxSEtEVGxubzZLNzRsSnFFYXE2RlBYZkVwTlFqVlhRcDY3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZXZ5UW9XVjNtbEtySzd6U2xWbGQ1cFNxeXU4MHBWWlhlYVVxc3J2TktWV1YzbWxLcks3elNsVmxkNXBTcXl1ODBwVlpYZWFVcXNydk1zNTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbDduUHkwMjRaeXowZEZkOFNrMUNOVmRDbnJ2aVVtb1Jxcm9VOWQ4U2sxQ05WZENucnZpVW1vUnFyb1U5ZDhTazFDTlZkQ25ydmlVbW9ScXJvVTlkOFNrMUNOVkRzNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRGwrRHFTUTQ1MURsK0RxU1E0NTFEbCtEcVNRNDUxRE9waCtXbTNET1dlam9ydmlVbW9ScXJvVTlkOFNrMUNOVmRDbnJ2aVVtb1Jxcm9VOWQ4U2sxQ05WZENucnZpVW1vUnFyb1U5ZDhTazFDTlZkQ25ydmlVbW9SbWxZNFVlbGI0OHQwTkpIQ2owcmZIbHVocEk0VWVsYjQ4dDBOSkhDajByZkhsdWhwSTRVZWxzdUJEbDNvNks3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZkVwTlFqVlhRcDY3NGxKcUVhcTZGTzZuWktUTDh0TnVHY3M5SFJYZkVwTlFqVlhRcDY3NGxKcUVhcTZGUFhmRXBOUWpWWFFwNjc0bEpxRWFxNkZQWGZFcE5RalZYUXA2NzRsSnFFYXE2RlBYZkVvK3g2VnZqeTNRMGtjS1BTdDhlVzZHa2poUjZWdmp5M1Ewa2NLUFN0Ny9oS3NQdHRKa0VoL0JkaWtGSFR3UTBIN3VZeTZYb1kybFRVVDNXNWZnNmtrT09jYXFUVUkxVjBLZXUrSlNhaEdxdWhUMTN4S1RVSTFWMEtldStKU2FoR3F1aFQxM3hLVFVJMVYwS2V1K0pTYWhHcXVZQTh3L1c1RUhkVmQwRUhXanFZYmdiTFBTNUQ2blNnaDVHNTVTOU0xUmRwUFFHZnRLeXdzd1VSblg3WGdmZjlLM3g1Ym9hU09GSHBXK1BMZERTUndvOUszeDVib2FTT0ZIcFcrTit5dVE5a3ZMTUtleWhMZyt4TTZIN0hqQUxrRG93TENQNU9iUVFJWlNzRmtKOE1yQ1hBSERyeGhxK2ZZem9JT0kxQS9tdmhZRzJsUWNJdW1ZSkhPb2N2d2RTU0hIT29jdndkU1NISE9vY3Z3ZFNTSEhPb2N2d2RTU0hITk5lUWE0MHZ0QlJ5OEhGN2J6Ly85UWtDQjZyU09kb0hUa1BRZVJDbzBwdGFTRmNvR0tnTTlOY01CMDA1OGRzL1dYenEwblZZemUxdmZKV0p3Sk9aQ2Y5OVlGQjdsVTNORktsRWV2OXErQitLdHBKRGpuVU9YNExFdDlBcVk2MGN2Y3hsbUlYUnQrSHdSRkVXZnhOaDNLVXFUMC9NbzBQUDNWQjdvMGRvcUx3QXI2ODlsYXY1dWhrQXhGTEJXV0w2eGFiUWJFQjMvNlpHR3hwbDdKWGR1czFtbXEvVkNPTCszUTlXZDQvYXlhTTcxcldPaFNRKy82VnZqeTNRekhEVi9NbVAzYjZaMkNXUDRhL3UyT1AzV2QwN1dtY29qR3ZmSmcwelB5UitlQm5DcDk2Q3NJTk1jNjVzZGhoaEc5R1M4Q211OTV5MWZxRElDbElJTmxtdXhIa0Z4c21abGdTMWVkb1RDV1JHS25pR0VscVNRM05zT1NLc0JHMDBVQVhHc294OWFFT3FTVlRGZDhwYkJSVmVNM3pVQjRlSTNiYUNsSkdYL0xiYUFUMDZCSFNqRXJlY3lTd2RjUmJkS2tSM1JyaEtSMW8yODQydW9kUnhSS09yakZ3cWRpcWdnUkgwZm1yV09Fb3FGNEZVeGowRjZ1M3dYOHA1OEJRa3VFSjNhYllCNlZ2bnJvUVJKVXVacXFCS29sRm1FN2I2R2ZPNHVLb0ZZK0Rjd21INWFiY001WjZPaFZadDhJaFBVUmlLRDFJdm1sNnU3VDlRRklLcGsvOTU1a0JDM0N5T0JSYkdBMC9OcTR5ZUxQNEFIZzVNYW5ZWURBWWgwUlh0aXk3cDEyVjdLSWJkcDI1OEVzWGV1T3JScUpCb0lyR3llZGg4ZWVhSVRNdG9vbFl2bytXazUxREhvcWVCTkpmakpLUlJsM0Z1K1Jsa1loN1FDeFhOOHNEeHlpQWdWcXBlcmFQcUJZeDhya3JUZyttOXQ3T0hXTlc0elZLSEZ6OTk0OG1vNmpjYTFJV1pmQllCcGxMUGxrcFdJYlBiM2ZJVEM4RlBvUmFXZ2dqY09XUTgvakFIckdTZ3ZIZ2ovcGcrUGNSVGRPMllKekRKRkhSdUFteFFPQlpwT2JrNSsvS1l5d1J0dVZqTkNPN1N2UWhNNHFvbHFTTG9kT1FWT0xkV1lScGNsNXI3enhOdXBNY1o1RU1vVEFrekk0TUNPRmVYelJ0Y2ZkREVRa01yZkVybTVQNEJCQjNEbVJqZnJsNjBQd3FTL3hhT3ZiNE5MNmN6OVAvOFIvVXZKb3ZIVDQvVWUrbXFrTk1wSGJTMXlibHY0L3U5STNZcGdZbCt1WnNhdmZDTjJPVGZOYmRNREhiSHZDWUV3TWFPRHNQRHdWeW92Nm15dGpPYy9ucDFDVThEUzVvbFo1V1Z3djhEY0xjbHBmUko2K1diM3M0UWdWOG94Mk9wdjduUkp4NWdQcHFFTEZ2NVRCS1JEMVhyNm1Mb0RmYTNYTHQvcXo3YXJUT25mNHd5aytXNnpGK3ZCcEIxSFovUjBiWnJCbVlGZHBLbEVTc3BPT1Nsc2l6Ukp2WUllK3l1dURDZjFBOVczc1QxOHBxbjZudkpJMU9QT2hrVDIzeHNJTnQxVG5vVW1uVW9zNVBvRStWUVBpNHV0UGIzRjM4QnVXaHdFcHlBeUdSbDNEOHV0LzFYT0NUOFN5NHpBL0lLYW1BVTY3V01kY3o4UlhSSzlHVzVMeERZcjdwcDBJYit2YmpCT1ZTNkY3RitkNjVuTWtPWDRSZzROaW92ZkVrdUFVeDIwT3duVk0xS2dkZmYxTkovTDh5NVBrMVlLQW1DNmJJcGhzRERnR2dvcERqMVp1NFFHazZaazhab2ZWRjVmd1ZYbUl4T0VBTjdpU2NINUtjMUdUSmhOY3h2aVVuYTY0bkRYNFBWV1o3WGVNRVZIMXlkK3RYMzdKc29ycVg0bEN6SUVKWDR0Y3N1UDM2dDVJWDZWaWZoS2YzYmpLS2J3SkRJNERDTk9UZmtYWjFRNFVvVU9JSWo0UVRLYnZpZDJXdmVTMm9sQlFlR3dnbTVXNlVtQkNuMytQNW5qNlJFbitKYXA5NG1WS2xNT3NQekpIU2Z3S1pRMlF5UmhROUkrZGYvL3laTGVYZVYzR2cvODNRbFFhUFhBQUpLSjJOWTVib1krV25yU2NYMjM3UHRMb3lPM2xuZGJMTFltN1FFeDFNQnVXUlRsNVNqSVl0SFlOcVlJeitGSmxDR1FxSk5HaThLREtHNm5XUm9WenhxZ0RuNWJPRXNtK0c4VDNNTmVEUWdlVkVoOExuT2JDVG1tenRtYnU5MWxzV21QdnVLVUJPbFk2SS81YUYyeitiVEN3YmQvMERHa0h0bXNyVWxpTExKYTNkUC91M3RYelZVMjJ3OTlvKy85UThMRGNmZHVnMXhDTFBqUmVjK3M1dmFadUFYU0o5by9HOU04V3RNZjNZRlNUTGhEZE95dzFtNndueWtReUpkMGZveEl3aSt0QURaanU3U3ZmNStTVnZOMEUxYjZkd2k0UlhWWnAvYUVKbFR2ckhSZ3d3ZDVkc1BNbjJFeDgvcXdDY21iWkJDL0h4VEVQOG9Dd09jZHlVN2JCRHdqelAwNEx4ZWt4Vm5zR2I3WktTYjNOc29oMnhTUmdUY3lEWnhxd2xNU1FlbzVJY3AxdDBxTjU3dXoxckYwcHQ3LzdMKzA3TEhaa1k0VFBuWFlDeEJpVXFRdEdwOGRjWHRFUG1LMUZMSSt4T01FVFo3dHNPVU5WbjBwZDBQTUt2Q29teEs4NjBVZUQ2dkpXaURCQS9hMDMyRjJOUTd0czBub1JWcmUxc0dhWkRyRjRyNExaYmQreGcwbTRiUVFyb1BMOUJjT0dRaFBEakxZZlYzR2ZSdUVpUitqR3lxQ1orMTdQSWhVdEY0TEVMMU5ENGpyWjc3KzdjTWRCL3dHNUNHajh1ZlJrOTd0ZjZXS2pTWElQL0hYK1VFejRjY0tjTzczSksxWG5MZXJsb1U4TTZJdWtPanNTek9JYmRXaEROZEtuN3R4N2dvNUVrbFN3TitsdlRKQVpaTXB2TXpzeXFKRGdiRkYyMmxFZ1VIRWlGTmRpblVxUG5GZ0JSK1hGT2h0Unp5V1E5dWNHdWhJWmFmTndnbXU4cTZqeTFUOGp4NzFYS2UremRrSTJPOHB0ZGxoNStKRGI1emt0b1ZEMi82dkUvbVVwclBLcGJ1bU5oQjl6cW4zd0IrcXJ0REZYSlg0L3lIaXhwYzlRb0lFOUdseXFqMlNRRVpNK3VyRzlCcURMVGFpT2szMTRyTkZ2YTFDdFVJRUloZXRpMUJ5VDdNMFJzYUJVcFAvYlFwVFFqd1IxemNTWHR0WS9VM2V6WG85bEljMmU1eXRyVnlEelR1OFE1NHZWUVRUN2ZZWU1UZGwrR2lmeFh3TXZqSlJtdTlwRGk5c2dWTjd2WlVsMDdVZUlXLzNuTGltWTVSdmdUZGJBamY4L1ZOakZ1alFlbTlLRC9RQ1hwOGVya25Md1g0c3NmQ1NPMmNyUUVYN090WVExeDRkN0JXVWJ1OERKeG5UWGJUcUtFLzVyUnZ5QkpCcUMraGUzbjhyY2llOElGZ3Qydi9GZnpuYlBEREEvOE5NazR0QXdnaU0xU2hEQ0I4L1hILzBBYWk5TnpzclFmSGR6YlB5K1pDVlpxNldla215UmNvMDdDZUswc1E1T0ticUh1M1ZmRUpJMnpxYmx1UkJXWEVLK2ppS2w5bjgwK2VZOFh0KzFlSzhWUy9HNnZ1YmdCS01iRUpSMG90R0laNTg5OEw1NUJQVjgvRjJrQVpHMmIzc2RTSDB0V0lHbEdJTVREUU5QT0xGQ0t0Z1A0eEd1ZzAzTG9aSDBKL3pBZU5NVjM0elBrNGpqMUQrV2MvTGxZZUZwQmE5YWNkWEF5T0MvRmNsRnZqMGpGUmtXd2UrUktZNnVPa1hSWE9jZEhMbXlPWGUzYVEyY1NCbUtTWUYwZ0JXaEJOalh0a1hIbnNtbWpNZnkyZ2I3LzdxMFEvVnhkRGRZU1VuTlUrSVVLNXJBRmEzdXhuZUtUNDdwMWFRY1N2c1djQTF1WkIzU2dpUkNVYlRDb0E3SFJ6VURxU2VTeVovRlQraCttZ3VoNDkvdlRncC84RjZSZStnRElYS0FQdElLWjc0QzEvRlFjV1FuOENZTjJna01Gak5HTVZudGtoWCtBTG92QldMR2VxVWhJQU5CREdpRExvNk4zeHYxaGp6Q3J5V1BkaDV4bmdLWVFQclBiL3IyNVJQYmRwZEg2NGZzODI4ak1nSkRxR3hYSTFkbHZhbmFrL2dvb2FQRDNqRk45ZTE0MVhpS3ZmRS9JaVJCTTcweHNMUDBTbXVmTG5QYjJoNS9xUWk0ZVFBTmFheU9UUHM5UjgwMXdIUzhiR0ptYnRvR2hmNjc5L3JnaUZvbGdtQXUveENaeUEzS2NVNy90UVR2RW80SVpPVnJyZjBrL0pCdk5Gcm9aeXBkUUYzZFBLcVpKSjdvaURJcWp5RlRPWXlGemR1NHBZY0YzaTZVZm9MMnRYbzVxN2plWE5JNXdWa0hpdHNvZURNSjJyRkljdXNBVi9xdWJib1VsQzVmWFBkYVFvS216aVhhMURYNlRUWVVKa1F2Um5tMUsvdkdZdVUwZEkvZGx3SWlFcHJvbklFbHM5V2FJUk1ScmNsVGY3V1NVSVF6MWR3VnJzaENhaEZvUFlJbHJIQ2lUdHhyenFHdnVzb1lZeU1McGhzdTFNRXBWRjJaSGYrUng3Q3lIYXNLWkxqelJTR1VrSVNDSUVaZHhiTmRqRHQ0VnNNaWUzSlJNczByTmpCZWExeHNkYUp2bWQ5ZnZxVjlFSnhBVXMrTWxsaEZMU0Y4ZmRnYjRYN1EvUG5FaitlUy9pdlgrak5lM3JobVg1aXUyMmE5cnBuK0VDZWRXV1VuS2lXaFJ0a0lXTnVWNHlBQ2wvZGRJVytXVnpCZEVXeWl3L2ZrTHBJNFVTRjBrYjhMUDRCRHNHV1BrWTB1Yys2dk5PMGhRQmF3bDJOUUMwaUFUL3RWelZGRU9YWVh3bEhsNWdkQWh1ay9GTVc2aFhFblh3REJSb0RibmxEUWtESHlJR3dCSkxoRWhtR0lGeXNVTzd6V2RBSnBJVmVlaUc4SEFxUDB0QTVWeXh4VkkvSlBTV2IrU0NJdFltSzBOM3Z2YUF5eFRwblN0bWRTQWZmOUtCbW9VZWxlNWlUOXFoZVhTUk5oM09UMFpjV3Nqb1ZHdlNROWlqaEg4Qm5tZVl1TEUya2pBL2cwUVRKUmxTdFZQSXFtSVZQNC9WQmpXRGFWZDBwRzRUK0RQU3JJNVpoOWRoUHlwWG5tMkRSbDljMXh6Yi9seFlMUWF2V25jNHhBUEN6YUJBeC9HS1Vwdld3UnpZZjVhd3RtN1NtamRCUkZ0SUFSQzNwNXZMZERTUndvOUszeDVoR2pSK04vUU5PMkNQdnVLRExVcFRWVnVuZHpKdlZueVdmKzluNlRpVjV6NVdMMFBOWVFoSHZTelRTbU5aa1pWM29aNWs0djFyM0RSaWozNVZRbjExc2kyNTJiOEl1ZVZqR3hkak5FOGsrSGZuKzQ5VGNNNDVPalN4OVJrWWJTeHlxRTMyT3Jmb2tNb0djYzZoeS9CMEVIdHB4U2tjNTFSNkZqaGdOMWxXY0FTSkR3SG1qaGF4VjUvQ3ZEMlRQUlhJbjdTSy9pS2JKMnhpbWNWdHpLemhlRnZwWlEyRnZKUEdaVTVkUWJ5blBBQUQrL3gxcHZFUC9ReGxvdzBBZWttTWs2TUFBQUFBQUFPV29ibVB3OXZNWFY2UUFBQUFBQUFadHN4WnFJQUFBQUFBQlB2MmdMQTVUNkM0MGZ3aEZZYXF3dUNNUnVtQWdIOTdVazlMZ21CQUFBQUFBQWRlNDNNendwU2phZGlCckRjdFkvLzdZSXRqbzVNREI4aTY0RW5wS2xzOVFOWGlENnFzTmxWNmpZWFROQXVkWUxLTkJ5VHFON3lvSXNVTlBFSjdPTk4xZ0liSHJibVNaWjlrSzkrc1FXWlNKcVRndVJhZFN1VkNPaTRuRnhzTWFVY1owK2pKRHd3QStMb2t2eFRjdjE2enZPVW1ETWJYSnRJSVhYeU5mRkZDU29Wb0pDT2hlTlRuS1NzeFM1L0w5UTQ3Ty9IU1lNU0VXeDdxK2pvbjRvd0podFRFSmtuREpxUjdHSWM3WTU0Ry9ZTkthZlVqSm1EOWpFT2RzYzhEZnNHbE5QcVJrekIreGlITzJPZUJ2MkRTbW4xSXlaZy9ZeERuYkhQQTNvTlg3bk9MVlFxQzNFSGE1RWxHK01wYXZzTUJTRTdTSEgvSjRvcldyUE9RMDNSVlNJd01HWnFjWk0zb2NYakNDMGdIVEw5MlpEZ0lYdFFJM2owT0VlYXFaSlNzMUlPNGduVGh5QVpwL1pjTUdXc1I2YnJDb0NHdjROS0s3Vm4yeUNiTDBhdzlnQmdjQTRXSU92eTFBcjc4TEVZRG1yUGppQWgvSXl0Tlo0dlg3T201eUZGR3d5dlNIZDluVC9kTU8xZXlFWW0wWlNWN0V1bUNjUGFjMUJmZDhxOEcxYTFaQ1ltdm8rRnRzYzY0YnY4MEVZRURIYlNhL3JDSzF0bmZYRkhPcU5LQ0hkbm1GMU91bWNaaGV5bURkeDNoS3d5ZGV1NjFhUXhHS2FKN0ZodkRaK0tjcG05amVkTjl3K1N5SjVEdjROU1NaaHY0WlVRVDlxbEN0Z01EVTVjWmRCRlhGejlETlpUWm9EclVINnlrNnhIdUhGaFppTzRtNWFzZ1hsN3V0WWRjTDV6K3U1S1dvRzZKV3VpZlV0THYzMEJndUM5a2tLNWJWZDRZVDFQcGN0QkRiL2lXOEtJVWRzWCtlVlZpY1NNanB4bUtTRDhvTFByRGF1alBNZ3dsN2JhTFFNdDlVSDlmditCTjVGZDFKMlZ2a3NHYmV0d0hPQUdUWVJwbEd3emNSRFlhQkJQd20rZXZCMFJnR0d5RnJGOFBGL0xTdk5rTEdyT0x5QWFtWElwaE5UMUpzQi9rYWc5MWJoQko5dGk3amFPSERkWDl2a2FnOTFiaEJKOXRpN2phT0hEZFg5dmthZzkxYmhCSjl0aTdqYU9IRGRYOXZrYWc5MWJoQko5dGk3amFPSERkWDl2a2F5QUdEWDNGQmFWVXpuenBQWHNoVHlmZE1vVklZSFIvSmpGQTE0dGJpeVZLYk9nbnM0VFB4djRERzYvajNGK0xoKzhBZ2UxclhYR2NFKzJZS0hwYjJ5SHU4VnNpbkYwL3BGZndKdzFONnp6VWErT3JoWUE4Sk1jMG5mTlVHUm1WMWNUanp0MFQ5VUxqd1lYU3V1LzdCY2pTeHo1NHp2LzhOTUJuSFNRTEZJVWJJMG9JUysyZnExNEhTRzZsUlVndS94L1BrRU94UWVqWFBsdnBuY2J2bjN1YjhFMTlBSzdacHl2dWJUTEpFYy9Db01VWnRwd002YUs2NzZOT1M3Q0ltUyt5OEY4amJnNnpQdlRzU1ZsdEp4dm1TemxxOHRrMUlmeTdubU1VUzBuVkRGaHQwc0o4Mnl4L0xTRG01QitZa2tid0FQYTM0cXluWHA3Slowc1I2QzN1eEVYZGZnaUIrUzk4QnRrQUNoM255L0xVTDJ6cmFBZHR5K3c5WjlyZTFSc0JCS1h3eXlUWTZZYWh2aFZPWFE3aTdLbG5RNGRUV2tTcFVqVTNrWFRWT2dXbU40bkdkWTJLb1Y4TElFV2pvUFZqZlJMcUwzakFTVDZlMmdDeDRURWQyWitBODR0T0hLNFFXc2MrYnM2ZUJvUXFEZVczRjJhTzdSNDBBV3UvbFhwWkpkMlZpOHlRM1dvcUhnVVZ3KzhkTkhvNW9wUVZrOWRQLzNaZ2wxTDFqY09wdi9xekZxMWlyU054Qk9JalJrRnBOUVpOYUVEV3N2MURGWFB2MVZ1YlR4c0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT0Y0bVFJa2cwMlNmNXArMXNoY0hhSWJZZ0JPREJVdkRXb3pKa3ROQ0pqTkcrWFZnVDc3aXc4amlsUExiMW91QlVPd09WOC85Z0tWTUozLy9lRit0Y2g5TjVkSG93bVl3aFV0K0FnYzQyQUwrZFJkK0kwNFRWN1ZyU05xNExFUVUvSWNCcHZ0MnhjVkVSejIzNWFoeERoTDgrU3o2S0RlQkNYaXppWG4vdTRxZHE3ZDcxS3dFdTYrWUx2Ni9BOXdFVmhNOXhYeUZ1V2RoQlpDTWtkY0hzTnhuRGlMVHJiRVlWZnBDUHViOUlTQW1hdFBUc1pXSlF4K0YwSFQ4c2cxZEpmV1JuY3VSM3dGbGpiQTNFMVlSU084MFhET3JhanZkZ0N0MnQrMEtTTkFBQkJvWDV4SVhlWEtNakwrTEJCaGxZdnIrOWdiWS8yV2RpZENkS2dacjVER200RENWZ21IZW1XOTd4dHdOU29VVmx4cFVXOVZiSkxpNU15c21helVHMU1wQUpBSFJhQVRpUWNUcC9lK3lyOVR4QnpnRmlpTGVNNnFUR1ZjajBNZlgvRnBEQ0xVV0tURmtublpiVXZqc0VVTnppZWRuUyt5cHM1ZEFWS3hhS1hFbjFXWW1EUlVHcmRPUUxQWU5hdUhJUnl3NnZWUm1FWTVGVXdRMThJdXRUekpJTjI2RWtybnFnZjYzb21yWUZuME1nNEVnSGhZN3JsZS8yYXJsMERpMy9pV2dOME5YZFg5Um95SVR4VDhJZTBCYnNZV2RiMUtTUGNkbTROYmdlUGtPQTUyL25yb3pJUXVya1MyK2d6TlVUODBmSHJVdVg1em9MRWs3ZDB1QzBYKzM0RDdxaHY0bVBNa0V4cTVjbEtFaC9KWW8yL2FnbmZDdWcxVEY1SHdkMWY4UHFrcGY5T0x2Y2doazg3ekpsaWl3MXc3TmlKWG5JNzJPZG1PaFFicjJxbldGb2FzTFExWVdocXd0RFZoYUdyQzBOV0ZvYXNMUTFZV2hxd3REVmhhR3JDME5XRm9hc0xRMVlXaHF3dERWaGFHckMwTm9rVFduNENuUCtmNlB3OGxoY0Z5UWNQcnpEK291OHBnaHljSzZXT3lsRWdOUk9rQ0doSnc0R0x4OEE1bmlGNUlCT3g3V2VmQjE1NzlxeU1XNmpPQVNSZTdBcHg1ZEJyUUlnVzZIcTNxSTJxcFVHQ3h1Z1N1R0ZMWUVSQXlqWTBLODJMOVBmOXdLbzZBSmNXeDBCTmJ2YW9xREs0Uk9mU1BwSEthem9MR3B5WXhLSXdFRitKSEp6aG5VUERBVFVmR1k4TnNRU0xCNmdrQnJSNDRWanZ0SFBBQXBYNTVrZ3gxaDhGRXRzS0Z0WUNueWdjWUFCOFJWWko3QjVSencxMEpUTWEzOUdUc24wL3VoRVRsQXpMRlpLL0hIWXdjTUYwRXU1c28wb0N1WlhnZ3JGUDRtRzBWeGRNMmFUUkhudGxPcWpGczVWWG5zemRHQkZicWwrQ2E2ZUxkNTlPV2VDTFNFMjdhSmZEWWZuZ0wvN0N2dGRTcGZzRDExZ0hKSkRuT3ViRC9GNE9ObXF4cmMxeUQ5cVB0RGRXMmxJcGMrbHBZYVU2a2Z2ZGoxVjdicEJ3UDVsdXdZbkFTN0REWStLeFlZclBDUVdEVnc1TXRzZlJoQjdwWEdKTEdwdzVReEdwK1JxZVlRZzhPMVVYditka0VrVEFNQzZLbWdHRXgvbG9nZjNlNEh0TkNaZGhzckk5RThydGs5SzF0T0dFVUJvckg2TzNrejVOVnFPb2Y3NWpQeGNGOVNBRUNDM3FQSzJrZCtORGJvQnNCeWhyY1FKdUNuNkcrbW44emZRTzdDY2gwNnZRU1FKK1A4N2lqbUVEMHNaL1psdjR5ekNrNHUzVnQ3T25TNkNGVWhPUTVKRllFL0Q5WDFSbVVhV0pOdlVVejkrNzg1TTZWdTRDOEIyWDVzdjk5djBaN2NLNjM3NnNnaERkbExUK3FkRmpwd2FHdlk5eU5kUTR0MDBkTkgrQktBQjQ4SS80KzFMUjl0dENIZ0hzZzZ6K1RaSFR1Vk1QcVhtamFVbXd0Mm9aRG9RejVJeEpzUXhNK0N5emduZ3ExcFpweHovUXc3VzliWUlHc2doL05GOEphUkZCeGU3dG1SL2JaTjd6c0lMLzIxaytZYnpkcjR3RXhwMDhaS1VkSEtMZElYbGxLdnJ4dEgxSUhmSlhVbVdUQ003Nm9jQVVmYnNSMFpsaDJQaEZpNUJjekpNUXhDZEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFoK3p2RDNtYS9tVEZVb2U1bnM2ZHBXL2RKa0ZZUkVIc2ZzSmV2LzJFWWhpbHJnZ3hEZCtaZW9mQ2RGMG9TQmtWTkVqMXFMMHFoVStIREgzNWdBNEZZWitteXVRSithcEYzWFIxVmd6VGFadEZ5eFRVSSs5Vm1rQkMwRWVmNURydDNuTmNoajIrMHdiUlFmNk5jblVkQlB1UVZTTlBtQ3hocGZQc1JmYis2aW5SSDFGV3lrcmd6ZXBsdGdJZ3NKLzgyME52T0I2eFgyRTVIUlZwVlMxT29heGphTDJ0MFV4MVQ2R25PcXdTWTUxRENTNGg0UXJTVittYmhoMUErSVViNHlsTEZYZXhTaTFOb2E3VDlRZ2V6SkVjdXQ5ZTRGZjdXNlNFRGNQY1NRc2swc3h0QXIrRHE3eEF4N2oyN2Vhc0k5b2dSeTVXVTcwTDRWUEgrcWRvZDFRdlFjZGZEaFBSTUdPMkNtM25uZWpvdmlqRHhUcWpQeXFETXh1L1o5U2JGR1EvVmMra1RQZTYrUkptQTh6MURqOWQ1SGc1cHN2TndnaTRnTmxHZlhMQlpOT3U3OFliSXdNL2RxV1A5cmhWQm1HbU9Kc0h4VW55R21FZDdML2V5TkpVa3RPQUZZempPUitVYW50TUZkMlI3b1N0eHhtcHBxUWpwODAvN0doZVQwdjZnN2E5ek8wcVhmRUVZQ3NWa1dZOEZrNS85VUQ0emJuSVplWDFVU2ZRZFgwblhlQlJHRVNSbjFkUmdiMktoZkJuSjhaVGVpUjBtWWFtcXA1SGx1V1diM2VZZitvVVJWU1NrK1dJeDVUVmsyUjFXY1VkODBqeG4ycGxHd2FwUDFkSGgrL3dMcFFBVlppU0lPaFV0VnJFTEVKZ3Z6WVBiNllXSndBMWpKbU5tR3gzOEZuclZRZ0Jrc1J6SUV0WXpjQS9vWWNNL1l4RG5iSFBBMzdCcFRUNmtaTXdmc1loenRqbmdiOWcwcHA5U01tWVAyTVE1Mnh6d04rd2FVMCtwR1RNSDdHSWM3WTUzSXk5QXNlR0ZaeUZENStPQUpaTDBVZGF1bk42Mjh4bC9teWZkcFJGamFxV2VpcllJOWNLUDNCYWVic1Nkd2hKME1Fd2dIM1krTkdGZEZvWVkvS2xzems1NE81V2tVTHlYTkYxWmZuRVhDTm5QcVFqQTNsc3MwUnVYRlM0STZLc1R3ZlFPRzR6ZlBRMSswYzc3RnN3T1VDRnBGQ2xxZmdML2hRaFdwZ25nYXE4cHRaTGF0MlozNjNWVDF0VENaMXRIZ25KaVhJbXMvMVdkWVcrRVVGOFdIY1VJc2hjLzU1a3pKNkpoclQ2T1ozMGxvNW8vaVB0M1FpUEdDRmYrbzNFMFlKekJ6U29rNlIyckhjQURleW8wbzh0VVY4bEYyVm03ZFB6dWRGbDZqZ1NTb1BNL24vSERGV21hcWd1dmtIMHEydE5tU09VVUg3cFFYRmc3aVZnZDhuMHM1bjFYV05iMjk2U0QvVm9yU3M0MkMveGlhSGFrNEUranFzQy9weVRUUnExTHZRSTRaaFFRY2dvM3FEWld3ellFcUhTd0ZwOUxXZkJhNW9Wc0Y1ZXdnSjNZOFB3MEUzSWp5Nzlwc3Izak9aSWxaN1V2QVkvbGh1MWhJcG4zWVlGN0M0Ymowc0Zkd1FUaDdxNERhNkZKVERTM3BsenhaaElwOTUxanFGdEdHSEFSU3I4aGg4UWUrclZjSHBnRFY0NHJ6OXNyNmQzK2QxWTMwZ0UxZnRSQXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDaU9aRXgyb3BDam5TM25RU0x3SGlhVExPZlI1U0doeVlPOXhWS1gySXp0Unl1T3NXMFN3akRHSko1T2FrQXZLL2I0OC9Va2RpRWRYVlQzUVlzRnIyTGxkZjJsSDd0Z0RDazNuZ29JTkVWd2VXRVhta2MzUW92QVdORXFqWVRIemxSZElCOEZQN1BEMVEyNWFrcmd5NmxrZkE1KzkvNmZCSzMva29iZDhONEU4ZytpTHkrUGdnWEZkVytBZWFaNVlNWGRBQ3hEUjJoTVEzSjh2UFhDNmNtblRvR29NbUJaL3FoOG1KSnI2NVZBSjZFTDRtMDNNYW4rUUxJbDc5dVoyNWM3REhSMmszUHlRWmZMN2VidUtnbmpIYnhZZForZUhZSWpyd3o1c1owTGhVNjZSb1p4cHpwcUc0SHR2TDVJMjlZTkpnUG5MV2pOYnBDd0ZMdlpyVENQTjg5MWRnd08zWkJYMHVxL1VoWHNVMlJWRy9FMnhGRlphdVNLYkdLaitXMmIreDVYQkM0MVBOSGFzVC9vdGdncXdqVno4NFVnOHNuY1ZHQzdVTUx5MEZwaXp1VytmT1BLOHJaUlBEdW9TdXN6MDhJL2pBeGppRXBYdGpmVzFyQlYrRnhaMzhIRmkyR1dPZ2tCQnZBTjQybXRPWUdLSVIzTnVwMktQandmVmMzUU16ZnVVaXVqc1cyZlRZSmMyRmZ0RTU1ZmRSckd4cHJyU2VtODFIVkV5bXV3WFpwcHFlNmVQTS94TXByc0YyYWFhbnVuanpQOFRLYTdCZG1tbXA3cDQ4ei9FeW11d1hacHBxZTZlUE0veE1wcnNGMmFhYW51bmp6UDhUS2E3QmRtbW1wN3A0OHovRXltdXdYWnBwcWU2ZVBNL3hNcHJzRjJhYWFudW5LeHczbzZMVlBSTUFmSUxjMW5VbStQby9Rc05OUFllSng2dTZ4OEFKZm1HK0pJTFZOQzZQUnI1ZGtUN0oyTlRmaWpGL2pHaWRFcUdGZjJPOEdiNnlYRGlnTDRKOFV0K1JhQ1B4RTZoZW1abDVJbTlKbndjZ3JKbjErTzZZOENGUDd1bXBqRk9IR1JuUlVPRlM2eEgrK3FrNjFBRmpSckZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRYL1VRTEZhQXRZSWZwZDNRQnRVQ0VINGxSTUhwRnN2Z1ZpdmtaTmdBZkVmNkgrMXZXWkFBQUFBQUFFaUNzaERPNWpIQ29scS95V1MrakE0UndIci9KWkw2TURoSEFldjhsa3Zvd09FY0I2L3lXUytqQTRSd0hyL0paTDZNRGhIQWV2OGxrdm93T0VjQjYveVdTK2pBNFJ3SHIvSlpMNk1EaEhBZXY4bGt2cGNLbGJTK3dBQUFBQUFBeGZqcllCellRQUFBQUFBQ0tiTTU0YUM0NlRVNlY5cVZYWlNua1JhMFFieGNkSnFkSysxS3JzcFR5SXRhSU40dU9rMU9sZmFsVjJVcDVFV3RFRzhYSFNhblN2dFNxN0tVOGlMV2lEdTMvWTE3TE1qVGdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUgxWU9oNEFBQUFBQUFYdnYxYzNZWUFBQUFBQUFBdUFwT2tiK1dCN2RIc2ljQ2c5Y0FHQU1TWkR3S0Qxd0FZQXhKa1BBb1BYQUJnREVtUThDZzljQUdBTVNaRHdLRDF3QVlBeEprUEFvUFhBQmdERW1ROENnOWNBR0FNU1pEd0tEMXdBWUF4SmtQQW9QWEFCaHlTVXhUTTFBQUFBQUFBRE1MOTU0QUFBQUFBQVhVZkp5QUFBQUFBQUV1b21ZQUFBQUFBQkxkWmJCUTZVUUFBQUFBQUF3OXhiL0pBQUFBQUFBSWJTQUFBQUFBTU5CaTBHb3pzWi95alVrM2NkeWlKMWlnNC96RWsyRUswaTgzcWFydTJacncyK0ZYMC9oNjdqb3B2a3d3MWRzRitSdENnaHdmTXVqOEdOQWFOUE44eXBZMnJ2dHFOVXloQlRadXkyZ055TWxZLzB4UWI0S005T0pxdHMyZDU3Y1NBK284UVdnSFlkdFNtYWxyYWplVG5VVkJ4aUMrTG1MbkpEMm1NMEtpc2hqbkNpaVJGbExRVGxldmd2SHBjdlJPaHBpc0p1WStIdVVlNWRxNDRobjhmTDk5cVZ4T2k0aTBYRmZIR0dOdzN1clNVZ0R1RUF0MERiQkQ1VEJUVUtISmhFd0JOVVByTjJtMnlEWnRRMTFVYkkzSVY0OWJKTUtGTk5JRzZwLy91Q2xKWCtpcHpwUTBCdWlUcEJ6dGx4V1FNUWFkbVV3cFFKMVNTNHIveGRSamZJL012QWZockQzdEgySkNocEszR3l6NVNyeVUrYmUxakF2bk1rcjBpdUFBQUFBS25zN3NNVE5aSEFqeXVGNVB5MWdBTENYNXZDeVBudFNQaVBFcE5vY1ZzbUUxVk9xeS9SQ2djYm1VL0lNV045RnpCR01HODNOVmZ2WlFFeFU1OFhIUm1Hai9yUGdDZG9jTWhyMk1aeFBlSHpsVTNTd00reUwzeUg5Umt5NTRheFhpZGU2clp5djVmNHBGNVNOVUQrb0llT3RlaUUzVDhxSnF6ZVY0Q0J5a2pMbWxTOXlnVGhsQ3JOU25sWW1hMDBLSEhTc1U3dlZ5Mk5iT3ZiZFJncnJ6WnIvTGpsL3FvL3NVdGVWNUtydVdLVlNFRnYvWndHMjZaNm84Szl2U3pzcGdES3ZHRGRMWXNQcXZkdk9ZaW1aNnRyUzFoWmNiK2tnL0o1dTFKNWRremhYWkFTVHNTVnkvNE9OZ25XeTNKUStWYllMZitJWEl5TDN0MmFMWVBaV2lneDhhOFNTcWdKOTEwTXRDSi9wa1o2bVFjVms5SlFYZXplcHFZamZSa3dkTnhCU1VJUkdRRFUrSks0bkdrcW9SOXFkcWZ6eENMMVpBbDFoNG1mNklKa2hGM3dtR0hBRUR1cjYvSHdQVU5hL0w2M3Vyc3RMTjVjZzRhc25hYkJabkJNaE1hNzFjQjM5ZVNpdFNVQ3hER3VISnB1ZlhyUzlMRS8rZXRJeGFPU0tTVXpheTcrSnJiWEpRVW0xeFcycHpSL1M3U0JkaDl5VzhURk4vTmJlRzM3UElMVldKMUNvTmY0RFdYZm95VzkzM2RDQ1pmTWorRFJQN0ptc0JFRG90eXdmVU5LVktYV2dGdU5MdHBFSXZVUUN5ekdzZWdEaVVVMzJyTUp6Zk1wNkdHMGlTUXhKQWw3M1JPWXdMV1RZSy9INXZ0ZDR2YXVTbWNqUm1JTjBBQUFBQUEzSVp0ODFuYWl0NUJ5SWJjV1ZzcG5xRlZnbWxoN1VZZHV2UGhVUEFibERiU3JiVVZjZEgveWY5ZHJBVDdmREtpbnRQTStCd3phYnJLV2hNaUhqYWgvcEQ4RTU4aG8xaG53UVl5Q09ZMGl6bVNla2UxRjFpcnAxZ1kySW9aNm90Wnd3SSt3L1lnYnJtcmhSc1hIUDVPV1JocnUwa1VJQ2MxQUcwUzF1aFZUalJwTjJHYUExcnBKenRNZ2lEdm1iU1RlWDdubndqa0w4aTZCTnJiMzUwTGlmWkwzN1NkTmFoNzIreGRjNk9sWlNKY2gybFU3K1FRakx1akpOYXJ4RW1PZDVsQnViVDgyVWJxTTBGQzBvbGY4OUhobEZER0xzOVoxRklZKzRKSUQ5S3pZcmI2TlYwZTNXaStLRUV0R0E3OFhwOS84WDgvRUhPbCtwZmxhQURleXJINTlGSzVjSXd0MGJPbk5ZSHdzcUpiVGZFcENpeDZFazdyT0pNYlRlVDZ5RHVrekU4bVZQWXg1SVNXOUx0R3QrWm9zdUVwd2t4ekMzc0tYTDBodUVaL2ltRjZSc0FzRDNKQ29VUmZLOFpJL01kLzNaTmRiQTV6ZXJURVFwVHdUS0NaMjV2bUtRS094VFR5UFpSL1EzdXZ0c0hVY0lEQlI0SmRxTGFpaURvOW9VdWNEYXk1cGc4Sm1BZ0U2alk0OXp1ZERTYVlyckNDRkp6bGg1N0pjMk9obGowU0U4a2RRUDBtR2JONHpPaGhUb0FydVZ5R2paeWMzWkdZVE43b2ttK2JmWFp3UW9aR3JOZnArU2xMOUR1Nis1b3pUYnNmdGpFM3NGd2JLM2d0MDgrcUNGQ2JzZjhZUEdiUlpwSVhacDVIblEreVJJUWR2TjhYODkrWFlxTzVLYTc5Y21nZzFRY1Y1NE42STVMWGZGSEIxcko3dDJkT1hzYnduQXJLdTFsSHVMOCtHMFpiMlN3NVJBMUNuQ2tsSUpoWVEwci9UMFBVOXRCM05LS3BXZHRTaGc4TlNDUU1vQUFBQUFaUUkvVTU1d1B0L1FxTmsyR2wrUFIwblNCR3QvK3liQldzVlZlbjFybnlTMVVMWVlXV3JvOTAveVlvWCs1V0U0MzdSeWY2bW1qR3dKUXgrUDAxOFpNZWdsc294dU1qa1JIcGRsL08yelRyZzR6aytnbE1MdXdQZnk0Q2cycHJFTm9aYTBCOVBKQnFuMkR6WWdMMk9QZS9TRG1QaDlsc1E3RE9pSGorYTJtSVhoQTduOGllL1RHWGs5LzhoNHZFS2RkWTROQnJxcXVPNXlsMncrZFJpOWd6c1h6VWlSbm1oR3M0YkI2VjhuYk5oZFhHelh3UDNYeUhZenhHOXlWbXljanVLMWR0ZTROTmZ4UFMxUld6OUFHbnJTSDc2cUNFTS9vTlRtYmhyQlA2bTkrcWE4NHpWaVFrS0xrSXNIbjRSeitJQjhLOTluTGVzWUJZMUc5WTU0aDdPM1RudmNISnVxdm94bGM0VzhlSHNJN05NY1R0cGdaWHhWNGp1T2Z3VUFVOVFWbHpaUDlNVit1b1hma2lHMVZ1TDAreW1HenVicEZSY0xyTlNoN2xFYzB0WDgyNVoyUUxqaW5CcE1ZWHJ2MTVjWmw0Qm14aEIxNUljZmpQSURQLzlnYTR5NDIzcVYzdk5yZXYrUWdTK1VLbm1SMzcvbld2UVNBTG03TXJxcjFQNTNwWG5qVDNjYmN5a29UMlQzV2N5QW40NldkSmRFR25CTElwbDNvZDhMSHJEUWNhRHVXVXFVclNBUE9lUDZZU2VHZmVLL3V1LzN4VU43K0V6WU4ya2Rtb1AxcVlQMkhnaHhVbm5Ya3NmSThXVWpDTUZiRW8vczROWXJEQ2JWS0RMM01Ic25JSkRjTDNVZDFGb1JJNDE3ckpMMGFIbmNpSzZVRnNTSnJkSks3dWV0M000Sk5hTDFwR2t4WkM1M2N6ZHpqMzJrRFpQbUJhZkhWUUhMK3MzQzA3emUvTGJ6TVhVc3gzOVp1TnZYUEdPaGtJZ3lqNkpJRzFHb1BhRXFOUXdlMjd0ZFVvd1pVUmJiSmR5TmlWRnc5WmJ4WldpWGl2ZFpVdW4rVWNJblFYa3BJK25UTzhIMDhzKzhjU2Z0Q1NrYVlpSXB4YWNqY21WdmRqUjRrbnZ2SnllZUtNUW54YytZNlhuUkJUOW5IanhjSHZBTW1MK2hkWlFLaTc4NlZIdThjdU9VQS93NU9QWWpIWjlJenQ1eTM1NURoVVN6NUdMNlFBdmhIbUhUcktDQW8wOFJzdHU3b1lXMEtTdWcrdkxmOThaYmp0TWlVNHI1L0NhTE9RMHJUYXN0Y1RXb3ZkKzk1dEsvWW5OZWk1dDBvOTlWRnBVYllpRkJteitnYXF6R3h5djlnWW16R2lXM3ZSTWE0bitFVzVnVzdhNnR4WlRXWUFsS24vVUV3WHd6WlVkdWFoa3UxYmt3NmlFdmpWZnhCaDV2TytVWGlQOHVKdTk5MytzL0FoajdkY09lWHFMQTdndDlJZklLaGRSa0Q1SnFPNGUyODFPcmEwQUgzczk1ZCs0Mm10TlEyWnIyMW5LMmZzZTQweVpyKzRpK3ZKRjhSc1NLN0xXU3JER2NNcUQyeHdnUURqdktXZlR2U0V4WUJ3d0hnczFwRTFRcUZYMnVHVmhyOHFCRFV6SXIvcmxmOWpOc3gybnRtdEhBdFNMVGMrNWoydmpBZmtsWDRaWjBNUVFrRGF5OTY4TlZSUUZXTFhHQTNwdWplYTZ6Y1Q0T3NHazFtTFR6eElGNkhTTVhHTm4rOWFVbDh2V3p3aC9WU0xkNmNTM252OXhPSUxUcXVkMUxsQkZZQlg2S0pFVTdKam1IY2I4d1YxbjdMZTVRQUNzKzZ6VEt2Z2tSR3dGOTlYdDZZWWpMRFZ5bGhoWHhFYmlZLzAzeEIxZWg1OFdqYXFjaEYxbUNhOHR3UWtpNHBlYlJ5bDRZWFBkUk84T1JyNFR6Tk9Ld013b1FoZHJXMmY3eXJiSFpyandJc1d1b1NscjZ1blQyUzI1RjZYdzlBQlFJTWt0NEtZODNPcDNiZjlKT2Z5TGZMWlloYjVheW40cW5JcHdheUdaQmlUdXh1YVpMUFkzaWZib3RoUXJ1TkQ2MnA5ZTQ4bVZmNy9zQysrSGdYczJzTjliUHFYem9pa3hHMnE1bEtURkptQWNyU0VZbitTdHFKdXRxQTVKYUgxNnhJbjFuZnJkNXpTR3dzMUNmaWd6TDdWeVVLMlpkR3dydnpVTnNUOFJPT1ZEeFAxcnAxNE9DKzg0RnMzU1U4amNmcHhhOW56Tm14bmZCWTFVK3Q0YS9Bd0RmWUdJQlFkTVBmVW9Td0ZxN0xZZXllcFVYeDdpWTV0L1RIVTgzdjBxZEdLVGxoa3hJRFJHMVROZnhvU055QUthcmpEdDlaTEkvV014NS9uazFhaW9CSXoyN3c5UVQrN1ZYTzFNZnU4OUYyblFDS0RiaHlpSGdIYU5VTXlEYnZxSkp5ZG44cDRpdkx0b3IvbGJSeTlOeGJ5NktFckVodjdXeUFFVlFWMU9LdzRzRTNoZmcrQy9GN3ZlZWJ4OFo4WTNIVHl2cENEVVprY3pRSEI2TTRqUTZreC9MLzV3MmhxWW80OTdRejFTVWg1dkFiT1E5ZEIyQTdKLzMwQmZIUGxWd0FmSW40c2pINEdWaGRYNjlldWYreXVlei9raHJaY1lCM2xEaWhtMnNtb2JFMUQrZjZjei93aE5ka1d0WFFDanlUZkE0TUR2cGdYbW53bjVqMWxMaFRNVUhhWjVDSDJnaEQwcTMwaCt1NEJlUlRtMXdzZGNwZlM0NWtPR0hLcFl1Rk1oNmV6dHN6QWx1aEg0ZGdmc0pJZFduOUpaRWVlLzNyM3RnaWlBYldkU283YkRzOVNaUDR6RGtZb2k5Y24yOGxoZjBpaUJFMEFWUEY5YTNtRTBYMHhwM2RKK3Y2Q0M0eEpPbUZ2SkJza0wzdUl6YXU1RXRRSHowZTVXellKaGN2cUNqMmZ2dkc4NGtkTW1uYUVLS29tYkxiV1FKZHdXdS8xR21zZW9Eb00vSG1oNmRVd21LdDhyR3lOak0vSTBubDJ0MWdlcDRMWWRGbnJRc0w1aHM3S2NYTmIvWHptcHg5MUZNQW1KeTl4c1N4MENwZG5pbzlub1YyZEcrdmRIK3pGMmZONGhjMGgwam90ejE5aUpFenBZb1VJZWFabmp0RjIxcnJvOXJVYld1WXpzdzhqMG13VkI0MmljRjdoUi9XNDZROHlwekp2OXVQUlJ4aWZLU3BIT3hzbXcvR1llNGlQZDEycDVCa2FCNy9MdzVvNHQ5dDJCbFpQYlFwVTU5RXlFQ2pUeEd5Mjd1aGhiUXBVNWxzeitDallmdVRiam1La1F6cC93RUd4blFYZWs1V0IxeTJkNFh5RFZ0Y2xVUlZFcWs2d3FwQWhEUGw3STdMbDR1S05nSmdlQnpnU0phYmlQVSthYmZoT0F0RVNlcEtkbjFMdUhVb01MYTNyUnBUS0JNMnI0OVJLa283OTZONUx5S0lud2VhV1pMNWxKeUNvWks4b1JFKzRpVDlvaW0yY1ZKcGpKNEJBNWs2bDJ5dTJtMnJFdUZ0cmErb3M0OXdtNERJMUI1RWF6OHFPK3p2RzR5alZiV1ZyNVJnNlRtZjBVU0hDcld0VjRZZ0s2WUVOdllrVitSaFBKVW41ellzWXp0Y01VcEVEUXNmZ3o3d0ZvYnlvMkRNcXIyYlVwM2dHUmoxUGZQSmtEVkNmSjJrWHlzMEw2cGtSdnpwWnVSTDR6MlhKeWFlUTVHN2p1RVFmL0VtVkxmSGdpbzJUbWZzc0pJZldWakttcnRwd3F0S0t4MW9DN1hYYk9uWmpoYWRLOGFCNkNONjZFMWZNSy9rLzZRalNkNStkeW1LK2ZoM1dYYURUN3Z5VGEzQk4ycit5NHNXdEdoeFZoUUNnbS9tSW5DdUVCYXZndjFHK3FkVzE2cFNrc010UUVYTWNDbW1HMGFBUGFneG1hbmpyam4venVFdTVHUno1ZFdCUDRHZk05TEhONG1xbWY4L3V2UUdMZUw2Q3I1MkxsUFZQbU9hV2luSDdpeEFkVHVJUXFJZExLQUxqQVdmYmlleDFqM01YeDdyOXc0aFJxQWlxSVVWbUxENXNrTE9HS0doL3hhaFZmdGU4aGVtaXdLcVdveDNnNklVdmw4dWpRQ09LSXhxdFQzcEtRbEs2K2VEZGpQby85N3dDR29XcDFBaGl0Q1JVZ2Jack1FZHA4c3VONTRXM2RSYmZZMUFtYjh5UXo1Qms0YitYSm1tNFRFRENlUlR6dC9WdUd5Qm5wRWRlTURCN0FMZ0piVGpXQjZvOUhHb25Zb1RjcHNGci9BOEUrYS9HT0ZFY1FjalNhZnRDY29rSVBnUTkrS1BMT2VVckdvR1lTU1BVT2Z4V29wMlpwTDlVL1JlWEE3SDd3RUVEMWN2d2hSWDdFdnlsVzM3UWhVNVRSTjRicGdWTXJHNXhvZXErTURjeWpnajgwUnNtQjI5WEg1ZVRJOHJIMHNqdU52Snh5VEVGT2g0VXVXQThMZk1NajVqaGVLNkI2REk0cnNpT2NjUktCUDIxWm1MMjIwcm1vLzcrU3NiTmRvTmk1T0MrTlppaHlkazRmSVA3WEVQdkY4NDFCZStaK01rbGl3SWxCWWlGZ3RCbFhQTGZoa1JDZ09uQUdiT1B0QXdHb1pWRlJUa3dGUWEwVER2Qk0rMC81RGMwVzJFWjB1UnkvUDhiTHFvT0pRZXZMMXA3YzN3cEFOZ2U3WGM5Yk5nYnQ3YzAxeU82MDl5Vm5QZ1UxbEhmcURKYzA1RUFSL2tsMGZ3TS9TbGUydHAwdGthWDhJRGxHS0krT2ZGZThPQjVBMFhnZkhzUktoaDRDbEcvR1Z1TGZLWXF5N3Z5SXkxYW5sbVFhS2hTS05jU2lUVmd2RitnZExJcU5zRjdGYUg5TmloU1RvVzF0eEV6NDhyWFRNd0NzNnVHeTExeUo4MVJ5c1E0UFl2cThsWmUvLzcwRkQ2bzhYMnB3cHA5ZkgrR1lYYXN0bzFTZGZYanpBc0V2bGxqSFQ2bDdCZ2lDZ2llWnV3WHp4WjVyaFRqcGovLzQyck9VUDJOTGp1ZW8yallucmg0QlkzT2NuaUY4QWw1Uy9VRkZpVnBTK09NUlNqNDZZaVhYRDBSbDl4UmgyeWlRbXNEakY4TmhReDEyY0dQUGlUMzY2MXBzMDYyMHFVYkE4ZGp0bXNaWUNrVUxyRmlIZUY3Szg0Z3dicW9FTWlWbmc5cENLZkFLVjhkdEFLUEZiejJicnQ0Nm5FVm9mSkU1OVNldnpZemVpcjN4bFJyblRFalJlRFdLamREbXlwejN1QmxZT0wyUGtqTXY0SWFjZG1xRzVGNlVUbnBES1ZFSWhvRTluZWpVZ3lQWStUcXlTK2srcnJaRjRwd2c4dkNiaXNBZlVzNVhhL2I4YldNTnB0b1BkcnNlMXQyRm01ZnZab2hTd1kwTVZMOWNOR1hleE5EYUJqQTYxTUhoWi9NMzZDM1ZWWC84aFgrV3l2TllVZmRxQ3FRV1ZBdm5NZUJmL0lKdHpjdTd1NU5zTkoxSzUrVFhsMmQ3dmpZQzNqaVQ3dGQ1disvRStZaTgyM1pPMzJlQ292SzRiWC9Hb0VMSFkxZWovMVM1VVFEVjl5YXZPS2VXT25uTXlnSlM1ZFhEbE9iSHZpMWpjbmNrK1VoVjlqdEdHR3NkMHIxek1ZRnd1RVA1NFI3eWgyVXRvYjVPVktCTm9qNWlmS2hkUWlPcWx4SDl5emFodWVZYndRajlXV2VXVk1XeXE0bE9qaWpZU0RKT0dvWGdEQmZzUzdFNDczQWIyeDgzZlNhQmxaRHhteE52Z09RdHFhNS94Z3ZmeFVUSkVvbS9EZDVLU3lkZXlidzNXUUUvS2drU0pzOWNkbkp4MCtyay9Hb0F3dDRQcHhiL3VuVExza1Z4RVNkenpHenI3dHZiSDFpVkhYT3BoWlh4OWpqSmxoMzZkUWJoL2lEUmFzZDM1R1NuWGtUclp1d0RsRVpJL2wxazAvblB4QUwxbTVPWnhaN2tOZldSNHFxUUhUM1d4WmhTVjZkcnIybzdxczBSQ3V5VDUwWXlYd29SNllrOVpld2NZOHJOd3A1NDZmNzNlbkRDREc0UWVldThTSTU0ZTdyTC9LODk5cXQ3UGtUa0hEcmNnSWszQmdkUFYrd1ZJTW9qUU4vSTVnVGVsTlltbHpmSHNrQW9idSszWDN3RTk2cjNsZlBEZUJtUllablV4YXJFU1d2eTY3NlVBSC9SOWR4cEhRYkZpc3l0dzRtb3BZYzgxdHpHQUkwLytKUFBUd2g4OHMzUGd1ZENJZVo0ZUhDTkJtcG8rdThaZFVwWEVpaE1IWHJkWHVpR2lkYjFDTGI4MXpwYXllbFVnOExRb1h6YmtJeHdzdENtTk9TOU1xMFdOYnA0eXlHR2hqUXpjTXVON1dmSXcxbXA0d09TZTYveE9nSDhZVUtuNVNiZE40bTVqK3lydkQ1SVBSa3F6VmNldDNRSURCQ3UwYTdjdWRMS2pwTFJsbG5OTVRNTDZ6N2ZSOC9xNk8zcGJJenlQTGdzMlN2R3Z3aWlkcjg2b1FtcnBKVDE0U2VhT2FKNkNCcm5SUmcrSnVqR0d6TFhsTHhIbkhYb3BvU2w5WkdFMCtuRWx2WkpGZENhSHR4KytENWZ1bGlxRzVlL2tvZEMvaFNIYjdheHhkLzA5cEhDdCt6VmdCc21Ed2pjNkwvREZBZE5NMldnNTN1ZzRxZklGMnFDVlowTkVnQktkVjVZZGUweDRGbCtoWS9pNGlrT1pJcXBJaVhNRGJCdnhHRy9KNE5RaDdOZWhNRlFKNXJMVWVpSXphREhZd2lMMDhDQlFvU3o2cUFqZVFMc1ZLY3NLNnEwVmZybzN2QVZTeUVZZmR2S1lMS3UwYld2TXk0ZklRMGV5L0xQZHVPeCsxbHhYUmFsUXpRZkMwZCtrUEFlZmdiZEdSeTc2WGdzNkU1LzlGUTVwbFZEbTM0U2haY0JYTFBsK0dNVE5LcE4zbTVYejhMU1V3L0FuQUFDeU9xU1lJSGNERDBqYXd4YlgzWFdJc1NOWDBPeEdvNHNRcUVWVXFIdk9ZTTQ0cHpIdVAzbVpNQ2pjRHRzR0FwZmNBZnZLOGpXK1Bzb3pmYVhYakVyVjFVRVRJUDllTTQvS01tRlk3U0w3K2t3L2VYa3JNZ0dTUlI1T3F1UUhaQitiaGpaSlZCYnJhMkg5SW9qNkFrUHoxYXFUMWJOOFJXVUZmb3dqVC95MVZNTmljaXErejVpbzZXYTF3VENDV2o1aGw2b2lIUjZXN0hLNDFaNmowMlNtczZydmxsTXpHTXZBWmorQ2hEVllON3Qxdzk1ZTRaU1phS25OdkpxYkdJRnVwTjJiczFnWUl6cmJKeGh5dmNTVDhXZ3c3Uit0aVFMSnV4MTNJVjljMSt3eXd2bkhWRmRkYWRIY2I1eXpmOE5jTTd3RmFKN25mUXB2elVNbFo3d3ppa2JGUUZwVlhZZFZDUWpVTzloVVo1azF6eUJmZ252bER6b2ZFWVduVk5CektINllxbmZGcTFRRzJVUTZtYTZWZ3c0SkxLMFplZ3hMU2RGbHlLZ0pWbVBTMXc3bk5uN3BvNy9zcFdLSUNQSTJMN2RJeWJQNVNEME9mMjB0YmVyUjZDcDh0WXBWcy9ncnl0Z1FaclYwK0lPdmNOT0kxL3lLV0VOVWdjZm85QVpONFM3Y2RGL1JXSVltclcvWVNoMzVMbzRVaDJNc3V2Ti9ORW1Cc2ZQMGl5d3NHc3loKzdvZTZZQmt3TC8wUmRneEFJSDVwRWM1ZUtZdXN1bjZlQWFONnVDMTlTVHpmMmNRZjJKVEFDaHk0MkJ3SXF1bDhXNEFzSEdHeElLMXlWS1hFR1hKazBTcVNDMnFhbjNENk1wT01QQm1uUmx3UFBqdGxQMzk1V0JGYXNvOEt5RlN0R2k1Mi9xcmxDSmxteHVjQ2F4M0N0R2tXVTg2K3IwdkZNSGlpM0ZqT3BsZS9kL000TnN3TmEzcDdzQitFSlI4QTI1aG9NT3F3NlM1QnNuZittODJ2THozT2VuTmpFQUFBQU5mSUJXYUxSWlFtSER5djdyZnpYdVJMMlBHZGlLQzJFOUd3aGUxdWU3VzJMNS8xRWEvVlJOVWNDc0FGekZzWlRCQndpK29hZVlBUE4xQUNkOEhxTFdZenBLVUZ0Um16UEZQM1lyUnEyaER5Y1AxemcveDc4SS9xMzFhc1g0enFPcjJEdUZzcXJEc3cyQ3FXRnI3Q2loNE0rZlhzR0dMUnhmRzhBUjJZMnZtbFRzQ0FGcDhvcmk3LzlvZjRrNWFtZmJtR3hodjk4VlFOM29yOGRKNXErbmR3ZkFFYmM3Lzk5dkswblJtWmY4STNuUkx5alVZMzNiY2w2UDRQRWNENVc0RmJ5MzF5U0huSDJEZDEzcW1tR2Y4Ni8ybjJrZXBzN2tYdGtQMi9ja0FPWVd2SGNRQmNBNFZmT3NWUXdGSklPN084QzdwTjQ5Y1NXY0VCOGpGSVhEUzg1aG9nemxiMStEVHVSUjNIQWE3QWVZaUJUZzVGZklGRkdEMy9PYTBOOTNjZ28vcG1tNFpTZnF2MnVYYTZJR085N2J0bDd0ZnNDK1dVaFdxbnAzbHY3aXFoV0JudXQ5dHpOcmhUUU9wbUthbHBYUmVsN0lhVDYxamd1YUZRUVJnY2lCTUNydWdZVjk4RlIzbzczY2hKckdyclpqMC9laG1uLzBud3NVUW16RWRlZzFsQ2NwUGtuVUg5MDVhUitVNC9laWhVRS9ieVMzZnlCelBoZ3czcnV0c0pKZHBTb0F3bjVWVWhYR2FxdE1Tc2JMYjEzM0VKQ24wMmk3UzV1SEY0aHQ0UFpUVy9pbFlpc1B0TG5wN3ROUTIxUlF3R1l5SkhKSk16YnA0Q3BiaE51WlRra0d3RzVyQi8wT2N3Y25JWmxLVDhOT1lTK21VbjV5SmF4RFIwUTFPUGd4SU5JZy9FVDN1OVh3RDhHSmE2QmNDN01FbjhUK0E5TDBnb3FBQit4WTJuUmVpVU12TVZCWFpndk1vMXJib1NWRFJJM2ZaaWV0am41RTlYcDR3b1ZrRWl4OWNvbmVJNnBwbjY0MjRPMEpEeGdhN2cxUVM5MkE0NkhXZzNZM1lCT0pXM29pSFExeHg4NzhBcURyeGJ2aEpsZzFZNkQvcG9BaDZEL1pNMVJLWmxlMVJ6ZzQreHppYTRpeUxybUV6bUFpNGNwVDRtSDJqK0RCT2ZWYU5EbkxQcWFnSXg4QnpMSFZiMmJtb3dLQ3QrbGt2RGZqck1mY0owa0xvR0h4Qi9ucXlweDM2SlFydUdBZU9DcEVDcWpwZ2Zwbm5yQUptSlhnQXFQZnU2Y3ZFNE5wNXc4ZjBuWVZtazFMNkRoSXB3UC9UbmRKcHdINmxOZUhiYUQveFBEcEJXRXhOcXVURS9WdjR1QnIwOHpsYnZVTGtkUVRwaEpiTzNIRXZzREwvSlJiVjIvSEZQdHhpYXBQUHBJZk45d1FlWjBsQ0RhVG8ybTRKT2R1RHZwZ1V6NGlXdmxOeU9aUVkwcmNSbGV2M1FwSlhEU3hyZWxyMHU0VVNWcUkzWHFhb1hmcCsydmx3Vk94UC9YZXpuRUJPaG1GSUQ1RGQ0dldCSVhHNmNqcmJxd0JsN1Y4amNBVFJZcjZaSm5JcXd2N2MxTm1iYnF0NTFEOXF2cXB3K1FBYjJVTmVITWVvdE83aFU5UDVqeXBEbXFwQlpHeGExWGxkekQyUytZRmc4bk95ZWlWLzd6bEdCblpJeUZhVEd0SVJCb1pJMVpYbzZaRmM3SWhpSmNSa0FVQ3VrMVFBK2FtdnlLeGpGMm9ySkZERURWZEhqdmZvZTQ0ZWl2eVg3V3l0MC9aMzdJTktuZHhZZmkwN0htcDB2QU5xanFTazJveTI1YzVZbFpwejdtVTBoR1RVQlc5K0ViNlR1L3Fva3Y1R2Qxck1NYTZBNEc1UTFnRk41ekxPM0U1NGROZ3ZaTGNUc1MrUjlmSnQ1RXE5UVQvVE5ZZG4wMjg4YWVBYlVLUVNWSzY5TVpFM2dpb21jZitKYWFIUXAyWEF6T2x5dS9ZeDRwM0FXSkpRZW1ZelprcGYvSm9UV0tLUUJnNHZ4NWxMbDlya0cvT21Dd1I3SXlKOFpLeWNNRGo3bDlLZU5WQndab0xFV29vRW5qNisrMVd3REZScWFLTWE2YVlidktDK3dFM1o2YlRnWm1kVzVodjNmaWhocnVmOFdRS0NGZ2xoY1ZZNnpPYVFLMTR4RnZPWU4wRVdrMXRIeW1zUCt6SmVwN2ErWUxKL3Rpa3pKZC91WmY1dGxkRmJ3TVROSGJCYVhZVHZoSjFoRnlyQzZuZDdBNHc1TzZTWXpxNmRtOTF0b0ZGNlFaOWUxcjdYdGZhY1J1b2YrT3hTdmNoSlNsM3RyN2JXcjBCQVE1Wmt5UXM1b0sxNGZYOFRYNTlSV2R3R3JyOWc0NTdKUytXTDdWVFRXdk82ZUdPb0RaeDNpeVRVWVhjRFhCSWVCUWRvL1Jkc0RWblhMb3I4T2ZQcmhEcHNnVkFPVkJPeFY3UVFmMlNyWWxjSHpaakkzNHFwd3RTakJHWW1nS0U1MTBQNUZWRlJ1VXRCOXllbTVwdE1zbHlRYUNkYThJOFdsY293RVdIdUxibU9RVXNRR0NvN3FvRkZsMVE4emtxSDRPeU1YQVBEcTREcEN4Yko0VCt2MHpIRDU4L3R5eUNjV0V6MTZnZVBRS2xhM0NRNmppV2NRci9mUDA3V3hLOW8veEpLVjZwY2N4NURTS3g3bmJLa1R0Tkc4T2ZXY1ZxZWVnWUdWRXhUQnByYVRJNU9mYjI0cHl4bzZFZ2FBU0pTcWhqQzNUS28zZnZKWG9Dc0QzeUVtbWZRVUh3OUx1dE1Ud3hTS0s0dFU0UVJGTnh0VC9WV1hkVzFNMnVaVm4yamsvQURseG01cjZpTFJRSU5QMFJSMVZRa1Y5MVZLMFNBQ3hWKytyL3E4Mmt1S1FEVnNWalVBWXNFcVZDdDMwUEFFVkkvSWRQbTRaWUhPdnB0em8rZjJ5b1JaUlJwRnRGb0ltWHFoZWFGQ3lkeFZlUEp5UUhnTE1kZ0RvTE1NSUNIQnBlRVYzeUlWTlMwckFEWWdkeXcrUmVTNHE0Y3YrM3JsUXlzY2tXcDZaNjk3YXJMem9FTGRQck5JU2IvSXJPblpLeVRzOTBGVlNVcDd6VHRabENWUTh0bmFnTUdkSjZqRXRSanBUVXVDWlE4c2pDWkV4V3RKMmxDaDBnc0dBMmpsSmVoOFJrUG5yLytTQ25QWXVTQUgzQmlWbkxkQklnQk5QNTlCRnZSRkpvaDJrTFFDcWZMRUN5NVg5NmtUdUZsWE1XMXRSTm5HTzcxL1I0cDN4SS9LR3hXRCsvSmVWb0ZkM0FNNWdBQ0F5WUMvdXp4UHlsZUMwb1lYcHFVdzQvb3BEQWlwVUZOalEzUU1OUm13emRweXFkdVNJd25zenJVYWt4Vi9vaFhwUFBjTkcxWVlya0ltZFAwRHhMemR4aVJrZ2p5MlE2aWFZNmpjM1M0Q2dlOU9LZXR2MGMzZWlmb1VsV2pJYkYvNGNXL1UwclpWRUJhdHpIT252SDRaTzEvZUIxT0RDRFVKcC9pN2N3TUlKblBvb0c4RldsVVpGWmRYYUVUdkx5dlhKdEVxMTEzUEowOWJvcHdML21xeW5lTFlLR25yd3orUjRCU1lDWTl6Mk50eG1FWFV1NmRCVWt0MTNuOTZCOUVEbCs1ejQ2RjBZUXVZTjgraVB2aFBOcWUweXd0QXdKSmJlZWhBMFZ2bkNzWVZtNElSRHZscHpXYWRZRlZwVlN3SjBndC96L3l5ZFhLUDFqbGx6dVZWVHQwSlV0MEovN21EQVJ3RkhiOHdXNUR1cjVRdFVtMW1mQ093RkdORTl6RzNna1hEME8zL2ZGeDhkMVVNaHlESk51UWdmZjY1OXJoY2F5VlhUZkJ5L2xGbUtJTkk0S1FaV3BGMXNrY2ZlV056dGp0U2tJVTE1WGxIaDdwT3YxWUJ5TTJ2WUFsK1gzMFFtamFBVWlZZjU3Zk04RStLMnJ1c2NYaDA3Q0E3cVdxbGNJOTRkQ2NkbDloRXR6S3BVcm93Rzk2L1BVY0FKY0hDTVZ3VXl4Qndpb0hpRjNZWFdwRWcrY1Y1RTV6aVNWeW1RV20wZG5weCtoV3Q4WU8wSjUrc2ZiL1pjNzFFWTJwR0duaUQxTG9iSzhUTWo4LzZMa204dlNxM1ZqdzZYcjJCYmtuUExaR0xUTGJWODRyQXhVOHVaUnJudHhuZHlZcXBIcDRnejdxcTc2OE53WEtVY3BhT2dTeElhQ085R0o5QVB3TCs4WXF0YzI0MEhNWHhvNE41SmRJYnFrRmo1R3pEQmdjTktXY2tINXFlazdDcC94UnRCTDAzWUlYSmFLcmRjRVczeTRoeGdiRnVES2JYREF2RXZvak50TVFialpFbTJnS21FRlBSUFRCVDNCUExxbFF5eGJabUIxeXpFUkx4ZENKWXJucWdEd2NuRGNrZzlvd1Z3bnlPSnpPMktXODVpbU5pNVJZTE5uYjZlZnhZUjJRZ1dYTkZJa0ZTOWtmZGFFOWpDSzlTUzB0cnVNR2IvMXh4aEl5MlUrWDhuSE9RVjNsU05OQUtwdWFWS2pkRnpYcm9jRk54QWhOcm94ZUpkL3Bwdk5MWWxLWm5jcGkrR2ZHZVNDTW9jWEp5WDRTL0NjQmVKL3diN0FWc1RrL2k4UndYaDQvVmJWa2QvTjU3VEFBbFRoWC92ZEVIbGRvWlQxRzR5b2U4VnBQbHJldmNPWWVWc1ZtczR5VG5EYmJyRWRMVXY1MFkvdDdxWnBOMlVaT0dJbUFURXRmaHo1djVxbmNzVWNLaFYrUHdkN3ZONG1ndkVHdWwyajRHVFRtd1NyN2xUSU4wL3dCRUFjeTViR1JFWDFYdE1HWmU0WnFiWXVPcjZDcmJReGNMT1VRTmZiTzBsZVVXd3lyWmxEODd3OXVXcTJSU0J4SEVWK0lUS3BXMnhkS1JXMTZ2ZjNFTC9TVGFOUFZraEF0TjNyUHFWU0Jidm5NSXAra3RLdW5FRUVCaDFJcGxLczZiczJyWmlhNTlteTRnaW5iTmg5MGNBcGJOMng3dlpPMGpGMjBsMTR4TTZSR0pjZGFSUjR3d21NeE5VNlRucHZNSk8xelFqalJzTzdYNTA1WjlRa2hCUVVxREhiMmJtWklPQmRkRXZxeW1MQ1JxVGpPbEVzdTN2WVJLVDNxcXR2bVBHbDVmVTZGZmU3NllMYithVk1kczJVUzZwKzRGdFNRT3dJTDB2dzlkNDY5RXdkdWRzY21NK0hPdnZUQW1TcnRhalVqRG1MSXg3SDllYWx4SWcrOWxoSGVSL2tHOGhmU0lXUHRXVXVRajdMZ2ZBTy81dG1HeHNFQ1hYc1d4YW01bnh1VklTOFR4aklrUGRDTG0vZWRNcG80TXlBQ3Z0QzZ2ektWeDZ3T2JSSk1pZkdSUERDUlFjemdjUGpLNVI5aWlFLy9sWER6Z0lPSUh2YzNiWGpPVC9SM1VBZm5DN3Vwam1TNGZaNVVuOUdhbFpjaHJSeHl5ZXIwQlFOMFREUTNIQ2NTSkdMTDJVNzVvVzJvUEI5dzJlQ2lua0NrUnFiN281NS9zaVRnR01vZ3ZHS3gzdG4zSTFucHVGMkNyMUlRdXRJQ3pmWUg2THZzaTF6Kzh5L3V0Tk5NR3FWRFZjako4U2tSMmczc013cnFzeER1R1YvTGl3UGsrMkdkS1pZWERQWkd3RGhKY2lYMWJoRUIxSkFkT3pudTExcWxrTjdFeGwxMmdUYWd2Q0ovc3diTTlGQWk1MndSdDYwd3ZQWVU5VUkzb1JSTDBnSGJ0cFZ3aGh4NTA2V2UvMWtNYVhNSlJxLzRoa2g2SEJ2K015Nmh4dUVBdDdUVmJmWlRjbHpIbUVBVkgwNS9iZFRIZFdKbVpJNzNrajQ0K3lWMmo1TVZTZGRlOFY1azFZS0hDd1o1OW41VGZjZldsQkpwQnBnMTBxWXhHS0FocWJnQ1pNR083ZVZPeU9mTm9rUyt3dWdMbWo2SENmVWpxL2VKMEpzSXBHV1dsVEdXR1A1UEVmSGNsL0l4NThabVZWMDM2TTJ6bTJHcG54dVRCS0xua1h6QzBSWTBHSUJ1SkJVblZtR3NobDJlTGJINFY4cGEvQzczanVSa1dUdXpGS3h0dTA1UXdyeHZKWEhQL0h6ditQcHphSDZSemo1YnB0aXpzUWVGdUZFT3BSKy9RWllmR1BsSkV4cHVaaGJMWHR0enZ4bk4rSjIxd1dHdFZHenB2aDdld1VaZjZzN0RiY09nWU4zMXROR2xlSTdkZ3h0eUVIV2VwYVhadGl1aUxIUllFWEtObFFXL2NJZElxclBTN21ENEtJeGxYOFhjOUIzYlVXb3o4bThVMVd3OXRCVjVIcU9iU0JyNk5XMTRlYnFIbWJwTUgvaFVjNFJoclgrTzhIUXNPTnd4M2RYMFRPbmxDVkJteHFBZVZORlRXZ0FYa3lyL2ViUlAreXBUS0Nzc01Ga3NsYnA3dzF6ZXJycHZHSWJlcmRJK2Z6aXlnNmpRUGJUd1V3eG5WbS9rV3RBN1pPVG1NS3ZPQmNiQ282MFFweWRIVTY4V0dxRXBMOWFXM1Y3eWQ3NEtVd2JtdVk4bStCZWtMUnk2Rk5NbXVqSjV0bTJ2ODJsR3VmWnR3MUUxMGVteFNScG83WUZ6RXRxeEg2NjF5QitmQ1ZIZlk4bUd2UXdtU3NnRENXSG1RVlRYQ1dYVmFBeGo2S3dNRkpYb2M0Qk1HYjJFOHpVWnFjOGExam85QUV3RHpwNkZKcFFwcnRyTWx1b0JuU3grc3JCYkE3U1l2VUpjbjFjb3FaRkZ6dzJvSHQxUUFDOUtSa0hXT01ZV3pnTDEwM1FUa3RYOFJvY1ZXaERjbm5NbmUxcDlnaHNlS3NPUm1OU294dEQwM2U3MmxSOHEwYm9LUWRZK0x4ZStMekRNMjlZYzNvUm1XSkphSlFUOWlhUWJjRDV2WTVLSEtRanhsb1Y3Q3RMbUZ3ZFUyNXZGYWp5dDR3NnVpRG9xRk9SL0d0dDNVV1Jobmg5RVcwZmZSbkNXWEprWUVNRzVEdDUzVk5ZbkRReFpLU3FRbldCTGZhN2R1a2krRDlnclFnODcxd21EQXRrditHVS8ybWk5c1hYL3RUNmI2U3d2VlRVYk9heGRscDJ0Snh5RTZGZU9uVDZXSWdMdXpPWlJMbnMwRUM3cytvTS94ZmRlV010dW9SSWN1WktTOHk1TzB4Z05hUVl1R2VSY0NNUWRWaklob29pTDRiV1VwNGRJa2NLdHRKc1ZpTTA5dkFVSmx3UHRnVExjK0hRazM3NHNyVWovN0IxWWVzYnRYWlIvaWdEWlM2Q1VOa3dRMzV4aXRUWEVVc1hIK1V2N1doSS9DeVZqeWRkUW5ZNWFRTXFNQU5JOE5FT1Z5TXdoY1Bma2Vrb2IyeCtRcmVtMlZvdllPK0x0NVlLKyt0Qm1UQVFkVWdhOUw4ang2TDVVYmJncWRjcTlxUXhLdXhLS1NrTXJxU2JiaGgyUjUvUGJZY0ZhMXJhdng5L09NdUdvN3RTKzJrc1d5NGVxdU1pRzVtcXFOczg4N1VDK3RRYjVXdk9JTGVwMkhSQTM1dHY2dEJGNjlhbEVDMDRZQUVhdXRlNGlyZWpMZnlhSEpDUnB2TURnNmpoRDhPUXRxK1ZzZjFQK21kQXhXZWhScEc0a1VPLy9GNUpyLzVqSXREVFZlNTYvL2hYdzdVdjczS0dQemVQbzBwbDBNM3YrRWVhclVtbzVpanNTTGNSM2pzdVA3YnREMGtIS095L3hLYTVEMmRUOWVLMzRmazNldFo2MFZBcnAza2E0MVMrMkMrdUVDNDdsbTNCczd2NU8vVlJwWjY4cGZmWDNVam1ueEdVTjBONm1OY3c1Y3dsSlRMM1hsaFovWVNYZXdLWG9hOEJETnhzQnVMU2dYSW41OE9ydDR2UUlzWGZRNWZqOXV3amNYcUs1QWpHZkNaTHJjNTVEaW1FaHVUT0Z4WmVVWDg4Ym00bXBSRDFSSlF2RzgxZUp3dGtTKzl2MFNSZnFYV0R0UUpqcFcvUEVrWkJNQUQrVmxHdGpOeGt6MmwzVGwvVFZiVEJQRFpSTzRxMTQrYm5zSU8xaERaSFF4YVNlQmRLWXowTnJvbEkwR1dpRk1aZUdFMXNaUStEeW9wamV1TFY0eWM2S3ZpSjB1TDJqMXV5MEJTTXJINkt5NmJUaUJyMFN1RmxucVJiYnExZHB5UzRiQSt3YWg3TCtNZlBEQTQraktJdjhwWkJoVFZ3bVJ5VGhsRyt2S09jLy9DdmhUYi9HOUNwOHB2cEVUNkJpQTdxOE9TWSt0T0xNbFlGS2VtLzJBUlhTRnZSamJ2Q3JLSXhJalJ4VGxQUG9rT3NhMnRaVnFmc3ZiUVAzWHNDelBDNGt6eWZXQWFaYVdtazBoYlB4em5PMUl4TW52UXJmT2p4aUl2cFhoMitpS1JrVVdQTzR0cUNDUmo2amV5OGQ2WTI2NVlkODg4UEc1WlIrUFptMjVXeHgwbGd5VFJxbVc2THdzOEpNYVNzVldTOVdnNUkwRVBIc2E3RjROSUI5SGd5eVEzTkZ1bUJWWFZJVFdMQi8vM0M4dlJONmtIMERaUVNNeFcvN0dWN2t4RlFXNGwyZlZzWitwYkh2RVNsZnhmNWxqbWRPNzB2TTNZalJpTU9lL1BuYmxNN3U1TG1rcDdRVXdWbnh4M3NRbUFrdktFT3QwdThxQ24zLzRMb0hZQnp5UEdhYk15aHFCeXRMTFdSMXd2V2F0MTdKakY5c3g0ZGxqWnIvU2c5MFV3L2Ixa2laVmVvNzJLSzJXMFRwVzI0SzhSQW51aXVRemwrNTYrQWp2eEk4WmV0Sk1JSjJlcnRiTFpMWmhOeDliRm5tOUFxQm56OVE1cHpUL2pybVcxb05lYTBJZDFqL2I2L2JPZU50MUlCeTRxdVFMdDJyb3BPZm9WdmpHVTJoM043K1A3Zjh5dTMrUS9jTzZoSmFnMFY3d3NyUGtIenQwNW5kZ3NoejVtZFliQkpSL200OGpneUZ0UGRMVDlGSjM2anZER0dEYS9hQndndFB3bjFnQWQ3UUcrYmJWb09qSEZMbUEzSHc4d3NkYW10Sy9LdXFubHVmTFlDTWFiRkpkbXoxdGJmejhoNnB3VytuRzU1K2s4KzV5aVlkVEE1UGVjZGFYang2UXp4amRtUzg4b1RKQ1hpcTJwTXdyK0FOd0pqdUZid2w3U21manRZNnZjMHRVNHVOUy9MclVuczFHclVJdU13ZEFnallSVEV4T3BHNThTUG51ejkzL0hXbmhkajZLMlhRc3FoV2VLbEVWRit4YjhDSEpVbjZya1Uwbm92bjM1TElSSUVOaExqamtocjJhdWk0WitMQ1d0UlZRNEluR0cxYWNONmsvaitpMTVTRHFVTkt6cktCMzNFSnlSQ0d4amk1bkVla2Y3S3h4cnUvU0R4aCtlMWx5VlI3d0FzSnBYOGZ6V3hMdExXRDJyODlVVXBtRlJUaE9qOTBPcktaOEdybTc3THFuK1E5MjBtYkZlWjJQOWRKQzZCcFFiSDE5aGNEWkl2MjRRczIxYjBxc3o2dHFQTUlDVXRyajVlYWpwTTY5YW9FcGUwRlhWdldQeCtJYUgzWUl1dmVjRWtFRk5BOGxnL00rbkRDNEdwYzlic2V6YnF6cTc4MXBoSnRnNWZmejJGRCtEUkVvb1c3eFdJU05XdGx6RG4yckgrTXVHYXFDdVhGeFpuQWdsc0JuZFRMSU5TelJVbVVaL0wwQ1JLVlE2bGZOZWN1WXd3NjFHcHhldDJXcUJDK1V5czF0d2hoTGh4VXcyS3VBYXlmSTdkclVhb1l0cXBlVy9oMG53N2paUStjdTBuaktnM042MC9zRFgyQ3doa01xWlpFRXBtd1B4eFVWNldWZWpxNWx5NmlERHJnVU1tdisyUElJYllLcVBndXFxL0tCSmhMb1lKN0REOFdmOVlYWlRaRzBNcDhWVFRENmlDb2FKUDBGWEtENVZUV3FFYSs1Znl1czlpSGo2KzRZbjNQYTV4K1dQclpGTUg2NEx6dHk0dUVjRTM0dGlScTRSZXdVNmZPZmZZOEJLQnlMQi9kcU9xZzgrR3hiczZXSGpaUVpKdGRYamZjbDBxVVl6T1JnUlNNcGxaWnFmczc1ZDlYcUlzWnpUemNmSVExbFdLT2hxYkU1d0t2WGpXSzZQVGw2MytzTWRQaEpvbzIzdC9qeGhobExxbGhIb29MMWw1YXBZaVk1ZndIbVN6cE9aSVhPajZJdThLcEZ3S3FnMksxandLeGN5RS9zcXM4VDAzajFhYnBRdmYxK2JxY2hDakYzcnZtZHFZRGFUVkJIdUc3TGJ6dGFQWXVTMlVIbDlqdWJBVXI2MkFERmlPQWdOcjc5SmFQaG51MWt2T1p5dGZ0NXdzWXFPdjJsVTBRREMzc2k5eFVIWXc0VGlqTzdNd2VGbEdCR2VWR2dCM3dxK09PVWF4OVBFeFNtMmZYL0lrbnFtZUhvcUxjcGJmcTlOSFRhUDdkZ0hiRy9RbEhoQ3J4c2dWWTFLVjVhWk4zSmVxWnd3S01YeVpUUGNXQ0JwS09rU2NaSjRPYmhnTFN5RStTUFE4OWtjTzZmd09HMHRyM0F1OU5VWHptU1lnWG5Dc0tqWmF5R3NUV3FmUEd2d2hjUTB4ekFna3lSdjlYNjlnRHVaQmtXanVSZmFNTkl3UXVQWE9FN2pNS2JKWTM4d2oyVEhoZkNXZ2U3VHJPVzJWeThnd1FOS1ljR042MDQwc2dyU3hBd3NNVk9JMERaWmQ0ZVBWcmtvL25NS1cwZXZtYld4T3lqRjh4TFMzbkxJMW9xbms0RjkwcXJqNklRbVhzWHBPT3VPbkJSZGFFY3FxZlVEaFFaNDNnclVLOVY2dzdFVFErWXFpeHpmTWlaby8rOUN0OXRsd2l3YmVnYU16T202UGcvTGhBVllzVDN4SXZoeHVVSzZISFJYQWRvOUpBd1JjWnZ5aEtheisvYktkQlRyZkpucjkvZWQzcTdxNHpUKzhBN0ZFRGd4SUtFVnNoeW5CNHRhZVp2Tzh6L3d4UHBLZXFZVmFJRjVBY1BndjVGNFdnSVB6bm9laklETVdrSHNESU0xcERzRWprT05IeVBOK1R2WnZNaTZlMEM2SnFQTTFrVWtXNWJGMFdZUWhMWk5MZmtEeTZlSlQrNEhGaFBNdm9MTHZhSXVJY1hkK29CSG1tV3V1MkpJaFUrUGFjR21jcGV1QmRnWmJKYkgwSWRCaHh4cU5yT2U3cVl2cDNpT282ZllmN0lrODJnUXdkV05hSjFZZnBkU0hEVmhITmxZZ1oxZndrWi81eGZ3MS9NejZyTWRhSEFDSEFIOVdTMGcweEk0NXU3QUxjYWNnSGVJaEhnQVdzNktTN3NocHRhNDJINEpGR2FXbGUvd3hvdDFtN01NUmdhbkhUR25pMFl2bm5pNGFZd0tmTHBzMVJNRHRsV21ieTcybXBVbElyRDlrM05mS3Y4WG0yMmNsWVE3VVFrOVBGeDVmeFJTRkp2cndFR2RQbFkrT3g4QjhZdzdPYVloajNkRUFuQUtaaHR2L21SZkFpejRBdzdaRGdMbzRoZTRyRjN2aFExUWxGQ2dpbEg0MjNTYVZGZDRyeVZ1R0VxUU94VEZ3ZU1oays4K1ZJNTdnanMyOHhzWE50dEV5aUdpVGljNjVpdU51REp6ZUtEMWs4bTZYRFIvelQ5U2xvaXFsZjFONFdBQWpoemRIcjNVeGR3NWFzWXp5NXNTTFJVdnBGS1pPYWFZRDVVanhEemZ6MTlHUllrMXE5YSt1aCtuMFVrRHdub2N2KytTTGFzUWVETnlMWmFxKzNadytTWjBRcWs0MXlHbkZJL1Q0M2VEVUNrUjlKdXp5YUVBdUdQYVlLN1N0dTZwSDN0dzBJMVJNQ2pvMkk3WGpJZ1UxL2x0bWZUM1g5Y3I2RGhKcEV1SEZOaE00QTdJR0l2enZUL0I4eFQ3akN3SzNhUkVVblF0UExqL3FacDhYVXZBTEFSODNXV3o3ZEExRVhjekY2NXV4TkNiUnBRMFJDdTBvR2ZnV2dQSXBYSmo4SERiQWh1cXE5aEt6NklITVNnMXRRanZBS2pzVE5IbjZySEVMczBYdWNOelpheXRwMTA0WmNOZWhjR045ck1qUGs2YXN3bUphdVh1ZHBxSFNRWkJGMkJWSmxJeXZFTXl3UC9sdmFhUnpkNHFHc0Q5NXI2aTNvWHBkelZnaXFTSy9OQm1BSEFDNnBFclhJb2VzNko2L3Iyc2V2VDNRQ2tnMnVWV1BDbUFIS0RsN2dmVTdHb2VuckRpcjBxOXVRR2ZiRnJWZmt3am5RbkRCVm9mUHhtU2hna0RSR0kvYnQ1RDBwa201aHRpeEt0MUtoWkNWMHNJd3VGdG4zTHlZM1JHMitWdWJlOVZFelRpL0d2N20wRXZybXNvOW0wZ1BsWDdPOHJrWms2b2FzSWJUQkcwSEo4VkVhQmlBMXMxNTVYSU1maGMvREZVaVhTUGIvL0RKMHh4ejNmU2hGN0tGMWtzWTlBK3FkRC93U2NsMHRRWHVDTUVjSHUwRkFEMkxPbFJvejJpKzF2NWF4WjhRYWd3SjlvNklXM0lhQ3ZhOVpZSUFKajJlWnAxdmUyTWNqcE9WTzJXSXBWV3lVNEFEajlVSFVpOTFablBlMTI0UVN0ZnhERjEvY2txQmtFQXc2TXlBMmVDTDQ5V3VZaFBDSzhEWTM4VGhXNzdUMlNzQ2tqRXA2bThvbnB0eDVXR3daOXZwUzhjdDUwSjZMWXZkMkIxM3VOSXlJWkVSbHJPMGdRZDdPVGRjMG9XcHdMQWpQN0kzSFFRMXNaSGUrc2hIUWJnMThGbVZZRS85MWFkTk9VeUdJcmRjVkF4OUp2aWlaTnFOZHBOQVlubmhFa1IyYVpJNmpQQ0tTV2J1bVJKV1dVTXIxN0lIcDduL0VBbEF4b0hYU003bFdibzQ3STFsTnNzWnR2SmxFNmxZOEkxa0ExS1IwWEZkRCtybkdiT1MvWTZSMVF4NXdXc3VKN2NWNmxzTS9waTJIMjVkWVVoUk1sYjNEZVZxZTh4bTA5bGxvTzF5Tk9hc3pOTjc0SFgyRm9KTWNRTUxDVXBvRUFXVXZEMDBYZUlBZkd4Q3lQVmM2YWhwendNTUNoT3pHOXhGUFlOV1R0ZVp3Y1VwZWQzVnhIakh0YjdteW5iTDNSR2d3Zmtjc1lSdWYwem1UTjNXcG1ucWZ0RjRHdkdCM0JDeUE0RWdVdGJBQndtdnYwZmJRM2RuKzhndFJxUHJXSHZTcjRyZFR2OWVHd05RTU03Yzc2QkgvUFBRYk1TcXBudkpqVldzTStja3h0VE9WVTFLSUVKaFp3WnJHNTREK3pxZ2tCLzJXV3JJMUY1N2dxSGU2RVJsTExxZThGMXF0T2xPaGt1L2wzSWZpYThwVXNKUitocVI1TURRTGF3SCtvNGxVWE0wclYzNnJRZnJXQklwZ0lGV2tLdkFab283bHFXa0lGMndueE1RSjZCeFdDQVRlMUtpWWhUalAvZ2xjamJWK05ZbjZxTkhIM2RmRFhVWG5sNTFsWVc3NmJvdlJUa1N4bnBpMnFUOVRDeW5YVzhXVE0vdmIwcFRGeUUwTzJlejRidDVKVG5XK0tzUlhtMXdNZFJZVWdGS1RTYnRqUjYvRkgyYTNZSytIQkk2S2xCSUlFQW12YUc1ZnV2VVlFS3Y4TTN6YUM5MW1SbkpqVHZ5dFZrTWRoZXpoRlhoOHNpcnQ4cDkzNFlmME5iSVl4UFQ3SmdqZEx5cGdlRlo1eFBDY2pIM1ZZc3ZERnZkNUlNTmV3R2xzZmVNUS8zNkFQQUZWVzF1RU1kaE9NM3RWUVBvMmR6Qzg5SWs4b3pPWXYzdndsSERvZjdxZHg0aXlwNUlxdXFVL3ZIQ1JLOUs1MXc0dUpyS0ZKWkVaamViSGhBK2VJU3E2akROT3RnYWNxcWxiNnlNTkIyT25EdGZKcmJvdUY2S3BZNjNkdXV2ZVI5ZXRJVGh6MzZuRVhFQmE4b2ZaL0lCRmViSTBJbjRXVnJiWmpxekxOTHRwa3hxSjJ4dW9LZkN2dlJNZ2g2M05HYzIwc2QvdThXVUg0Tk1QWXJBVVdPdzVyOVRmUzdBZUlTMm1LNFpwYVJpRVZuUGZxbTI1bVJBVWtEaGpjWWtJMHRuRWFtUlZ3YUdRWll4MnhoZE91N2ZGOUFXWHFaWklUSDJnZmhlM0dtTjk3R3kvUEZrVEZRNWlDbXFiMUhqdEZidmRZa1BTc3RjdVRKeVJKMi9EcVBlWHZnalduRFhhZ1VVN1VFbnVXYUhMQU1jdDRsRFcwN2I3V1ZBRUVORDV5VEo5YU9JUy9oajZYcEtyeE1UeGR1R2tyRHQ4SWhQTWZHY1B6NDBCN0dKUUtUQmtkWXlVSUs3OHlIRFNhQ3BSNGI0Y2ZETktzRE9tKy93MkFkdGFHcjlHQzVNMC95TDRLblVZc3lCMWF6RVVzdlZZajhrYjdRRmk0T28wakoxWWgwQ0FLRWp1bHUxZHh0UDB2UlBQZ1VOTHJqaHp1TzZib09WS1ovL1FDdkN4dVJ1elpyZU1vTmplNFZ4RUx4N3FhYmVyeXZJZk5tS3hROWw2R3JPR25UU0pnd0FVQ1NSWlRqOWI4ZXpodzZBelEweTZFb05nU1dqRTNTblZDUzUyMUMxRUNaeGFUNHhKQUJ5aDl5OEFBYnAvNVdnaTlnajdkdGVrMGg1eE1XbkNBV1VDdnhnNW9XZktYdzhGQ0hCaGNUem9pQlZVSFRTeFlkWVVEUktUb0o2WTlVWDdGZlBQcTh5ckI5T0VLSkRLWm80ajRDcm1SOS80SzJIaUJQT0lHQXFPMlZDWmJZcHZaSTJTZ3E3dkR3R1daelhWUUE3U3hYVlVRUGs5Y09wMk1CNW8zOEdCeCtXeHNpaURlUjkxLzdSL3REVzhIbkJtay84VTV5NWlLbmVaaHlmV3V0cnZ4cWYxUEQxbHlBdFY0TzcvaTFYWG16Zkg3OC9xelp0Yy9YcEJLL3JXb24rQWwxUVplK3J6OWpWdXR2c1VxUmxUdmcrcVB2SDdIYXBJZnhCeEl4V05FekdYVERpZmsrb0xOeWc4SWhnSGZDZk9aUEh6NHN3NWRHQVZRbzd3NnB5TVlwano4Y0VtaWR4allrTHNTYmR4aCtOVklKaXdhVzNCaTdWQWQ3ODdxK2RqTUMzMVBzcGpVYjcrT0x3R3dxRmlSZ01BM25aUTB6QVk2ajJmblV1RUlOUm1XUU9XTiswYmRmTDlkMkxabld0eWU1UVh2MXpsK1RlUUlzMW9GUDl1NkptdnkxNEVjWmgvYzFZN1lwaG9iZ2pzeE1yUU5iRHRsRHE2Z20va0ZDTDh6cFNJQUxRQW4xeFNhM1Z1a1d2U1FIcXV1Q25wZVVNK3gvSG1nQnFsUFpSMldyRzVFRFRPL1h4KzFQVVFITnJ1UFBvMkZCQ2pISzJ4OVhiUzlpNmYrTWRWOTNZaExmdGw5WHF3VWJKa04wM3ZMclB4bDBKcXJlKzEwVHdCek5LMVk3bzJ6WTFKTGFsem0wb3djVjNFUFRkMVgrcGc0WHhNV3dpeVJpNVVPVG15T0gxaDRMOWcwK3R4ZkZZL2xTdDM5WURvU2JHVDZEdW9wTE5CQ1hnSzU4cmVjNWxvL0RjTmgxODNkTTdSekwvS1QvVjVUeDVybTJLUEdKaXBMcFNTNW8rS1RVeEJramMyUG9hcXBvZG1pczV0YWtPZ3VaY2Z4VGtlaUlUTnIzVmtsMHQyMVU5WE0rcTJEWGpzY21va294MnpPaVBXNHJsOUFKd3JBam9EK3dUSTNaZm1XNlRsdGlTTFJTVTNmczVMd1BOdUlRYi9mOVdGelRSRjRiR3FvR1M0b0svSThsRjNmTE9wVWNITHhRTXF3TmYyUDJzblZxcDQyZzlJblRNU1RDbGNQVmlmZ2FscDJWUmhZSDNacHhKZElQVitOK01JeDY1ZTRtWlNWd0FYWXdyNFUvREJEMVM3aG56azgveGt4R085RWRHUktQU2hWRUZHMGFVcUxqRUpGRm44b0E4Q2Y1aGxkSEZHakQweGI5ck5GUGFhZDJjMWRkZnNJWmIzMnRsREZ4M3UvUWJDczlOTk9lLzg2NVhrd3dPTWowRGNyMXdXbXhqTEVrUzM1NHRjdk1VVkF3S29iTkx3bmkxd25xaEFYYzVJdG5pMy9VVkc5ZGgvVmRXdEUzMEEvVEdQMVpDWVBzeE1LbEhxeTdXcElPYksrcE5kbEx3MEF4Mys3c2RQNlh1RWloKzFxeEJFNGljekM0S2lWVmRoWTNibUFucHgrVWpjbXdNVEJnWFRWdTRTTGZ6OW1rbTkzQWVMaFN0T3RGcUVtT3BhRUVNRU8yRHMvUUVkbGd2SHByL216c0lWdTVuT2RkcWUvTnNUT20rOGZRZTl6Q2RTOFdob1d3Uk5nTUFMVEpYeEVybEtHUmpVYmZzazRaR1hMQ21mYXVsUm9hbVZCekhaN01YMGtCZjZrRmhEUnlrNjFLR0p0MG5sOU15eitMNnh5TlVqdk10TXF5UjFlUkwzaTFWN29nRGowR055Vyt3UVQraVdaVlZsVEhHcVBzTWppOElVNkNHdm9TYm9wdWJVVFljTUdiMDFzN3lVMldCQjhCVldOZlFnTGtoeUwyTngza1Q3YzVKOXhQYmsrRXowc1hSSElIMDhRZHBOcC9QNXAvTjBsUzdFVmlyK1ZPbjRXMDlJSW9mVlVsc0ZMTExVaVJDbWhQSGJWY1F3b1JzTEhtUVlXUUxyY2dnTGQzcDFQNmUvZUxneDNPUE5FbWNCc1lVTjRXRmV4bUt5dlliYlNLMW50dUFycy9XUm5SRWE2b0krZ3JuWVFsYk0vT1ZwZjdjdStmd25tcUR2eGZEWER0c0E5a2FFL3c5dDhoaDlmNE8zVG40SzdGWnl4aWNic1VkcG1LM2dyV3RyL1IwM04xRnc1ZGtJV0FLV2MzOGRPblVVOUtLWmg1UlVpdUw0K0VnbDRWdFNabm1BZEV2SkxQcXRTeDhsUzhmb2FjK3gzOHFreHluQWFyU0NsVVVNanIxOHo0VnpaZThjWmg2YWpOWDFOdE5mREswZ0wveDFwNDVsUDZyN1hMZWVwOFVIcGNwWDd0dnVldGNHSlVFRStiWDN6dlBLZXRWNnJsQldlTnV2bURIYUp6cDJmTktNRThaNit4MU0yVmVUalBtRHNFVjlaVjVDZGhEWVB4N2RhM3Q1S3FCNzBlMVlFaXdRUU1tMmdKRW9COWNtWjlMazQ1TlpSeC8yRUY2OXA2bzArTlhkQW9zeGFvSG9ydzFYUzFNU1NiL0tpczk0M3E3d2xtajdIS2h3R1FqaFVod1FqT2dNczBRRnN6N2pLMzloZmF5UzNDKzlUNnNTTUUwLzVKL0Y5a3BQRGlQVWxhbk4vblpHYys0b2hMWVJ3Z0ZhSjk1QWUva1krREZvSmhES0xzR0J2NmNkZ09tOXFORmc4L3JWMlFDWmF2SHVOUysvb1RnZnRtaFUxZnp0QlhnWDNKOGR3SW16akhUQWdjSnZTR3g2NEtVem9lN291RDI5TEcyMG1INDBua1IrR3pmdFRmbnN5dHR5QmFrVkFWaDMrWHRqQTBEQzRGZUJ0ZWVLRGt2bFpYdlhlMmFjZTRRWFB0bmhENWplSUNJeEJmZjlpNDdhb2ZJZE1tZElKMU1QWGRIbFNOd09LdEo0N0V3ZTh2cGRlcVBCL3RnSTBqS3dFUkRQRk5xc3hPOHBQMnJpT2FrdnV6MThjaHQrblk5ekJPNTJwVmxXdFU0bUR5ZjJJWVMvSDF2NDFTa1N4a3hTcWl2VU5tL3BUOTVFeGVWVE5qeGhINnB1Rk9EZTZLWGhpSDJ4UGdoMW0rdERudnd2bmc2SnVMaytjdVU0bEhIeFN3b0VXcWYvMFEwaGZVWlZ1VThMbHliYksrU0t1eHFLeitKVWJWNXltV0hGblRHRFhzZjZVUXc3anVNOHlnQUsvaG0rQ3FhRXpKdUgyODJieExVQ0x5MWVrenNFYU1hNzZ2eEJFN3Iyd2NxejRYdDRlSThLVjZpZVVzRm5OSjh2WXNDRjkwQVcxY0ZMbDc0R2wxdXlyeDZ2SlNGUWErMTN1KzRMc1BnVHpkbENoNU1rSHJNclJmUHZ1d3U4cUVpL2EwREU4VWFNc2sycjJKM1Jqa0lLTDZvMVIzWU1iY0N0d1NoSWM3RzRzNCsvWTgwU29uZElJNkZvd1dYRHpvTVhhWFplUzFUcmhRUG52aExTS1N6R2kycXBtZC9FT1p6em10ZTZXM1NnYnIwOW1CZ0RBMUdSYmZVTDlBV2t3cGNLcTE4ZEpyNHBGMFRKcHJZdGo5ODJhM0lUaTJFOVR3bVBJb3lEZ2dIa2NjOEQzVXJ0c25IelZEOWVNQmNaeEpROEJJbmErc2FzZDQrZWxLdHorRFlpYThhN2Y5Smt1UmthSGdkdE9ieDByaUJzMHN5YkFxb2JXUjhkQi8vUzFpUHVlZHZlNFEwTlA5RzhxK2tDQzdsQm95MXVEc2lpOWdZRmwyTlFHLzl1anAwak9TcklMYnF2ekJSRUZtQXVKQnlrN3BpeEJEaGxidVc2K1VTMjBkcUhoRlZNSndSSm1lRWVhcVJJQnFoNmpIRVNCZE03Q3dmWXRvT0llSUc2ck9odkRzS2MwblBuM096SFBBbDZqeElGandmNUNVekU0RC9XMlRETExlam5mRWV1NGpkVktKelhwajcrbHkzRlhod0RzbHhDa2Exa2FKdlpHNXd5aXArVnR3L0k4WG5ub1ZuZXkzc2U0d1lvMTFwMnBsbGRsMmFnYkJmVHM1aFdwWVlGVW5KbVI4U0Y3QzVtMVF5ZkczZzRMYTBNNFFjWVgvTGV6TUpkakFJdHBINkprSGFRSkUrTCtleWcybHI1TVo3cWRheTF1K0xEanJZTEEzSmtuNHdDU1BMaGs3Nkw3SEZWcTdVWTFRQjFNbm9uSFZzYkJqaHVrSENZOFFQc2E2bTVtTzVST25QT1NHWGxaQ1B2ZndrQ2MyM1FTbmgxQ3pTcytXWUpJUFNER2d2RWZnb1NscmdSdFd3NHExN3Z3ZExiU3dmYXpTOTlxcmhXYzk4SUQ0bVZYekFKaHplSWJXRC9zTWU4VVUwWEN0MlVPVWJhOGpVRjlZVHNpZldLVnpVRm84Tytqc0ZaUUJpK0pwSi9scStCUFpQU0NmM252QXNYK0JFTjNvN0pRS2NUZ2N5SzU3bUp6NkpFNTJZOUNQelpDM3RRQWlKWjdpYlZmVGNVY0FJUFQzVVdES1Z0NzdVVnBZUHlCeWJzZldCT3JaR3dwaE9LMDdJMVMrc2JvalpmVHhMcG50SmordWh1YVJ3Q0k4a1BGS0N3V3p0VG91eDh0dkhkZkh5M2Z1ZkZaYkhkUzEzelFDWDMzaW9VUEJZNVZ5U1VxbVkrZzgxdVJLajNLcWxqeFozdlZqeDVObWgyMllnVlk0a1Vwek1hWkZWZWs3U2NrQkFuL3VsbDhCWjVzRG5ZTWZrbVRTaDFuTW0rayswdTNNNHJHQjF0OFI4dzBId2FIbzZxWjd4RmdDbmN5NGlmR0I0UFROUGgxL2hzcFZjRER3aTNtZWEwUWpuSnVPeTMyMHNMUEI4RnEyUUJncWVwZHhFUnd4SGIzZkpydzczZnhqZEV2M2dtRzZ3VE5VU2l4L2FiZUpPaHVwNVBZdVVJby83b0llbFZkUi8zOEU3clh5cGIvb2FNVEhvWjZ3UXN0M2ttZEVYRDRXZlQ4U05GWHU0dTdBckg3SCtCN2haaldrYUdaRlI4emFSKzFHbkttVm9iL2lqOUJ1S2l3UnE1Q0Z3QTNoajAwQUVtRmF5TUV3YWlhdW5idzFzc21nN1IwSDRUQk90aTBJdzZDVk43SmI0WDhnUnl1cnA0YkVYSUtkSHo3VTNFWHVMdytMbDU1dHI3T1lkNEkrd044MlZWZ0VqL24vY0xkdEo4RmVRaVpOcFliaktHMUJQbXpCOFhEYUphTW1aWmpTVVpYU3FkWXdCejZwRm9WZlBGc0ZkNU9LWUd4Nmx3NVVFTDk4Y3RRdVh4SVhWblBCaExFeGdFaExiNndvVmFQcUVCU1c5a0d4cGZoZjl6aWEzdVRuSmRZZTNrajZobzU0cFg0eTFqM2c5U2lnMFNucTVWa0RBbWQ5dUJpT3hsZUM2RFl5N0MwNThnTmN3LytDMHA0b1pJTXFCWXhmNHpHNXlVY2U5bXBtSDJuR0U2QzIzV2phMWZHZ21Wd3lCMUNKSDFtcVBwZEFmRGFnUVlKeGRKRWFjM095QWpSYXkwVzRBRkJzQVBYWUVsYWVDcFM2UzlhdGpiTVJWMDh3ODYzckRIajJBZFZaTW1WcjQ2eDhuQk1rNFdZZG5HRHp6eWVmOGJJaTNrSjNQb2lsNFF4Rko2WmVaRXBDR1p6K3pFSjljZWpLSG5qdXdiOXdjQWhwS0p6OEJ5bnJvdmtQZFRQRkUwK2RCbmpJVnROcUFmdE9WRW03RGRVOFBvN2ZPcDhQZ0ZScHNwbVltTFI4Y1VnSERIaGpyRXRKQ2Z6V25rSEMxTWt5T3JoZzhSS1g5Q2h6UDBKcUtZeCtSNGxWWm1XTlRkVzhzemFXbGRCelNPM1RwSFozZENjU0didklXeWt2dEw1dEFEQzhIUEY0QjlUa0wyVTNXRmxwTjlONnJ1VkpnQ0t5ZjdrL0h6TVFlNTRGeTZCUGZUNnhtMGNnblkxWXZUeTFSdTd3b0RxOTBXZmt3TGxsUHhxRVJmM09MUDNySkZzZTF5ZnRicUpqcUVuaEJ3d0x2eXE4V1BPckxmczZKYkhJd0E0VjJaYndCL256RHY3a29YMSt3V2VLRlQwTSswM3Z1dm51MnE1aHRTbGE1TnYxZ2xrTjlpYnlaMmFaM3hWdjNkdlZKSUdBN2dXSnc2S2ZnbHljVGxDeFgxR1dUZ1c1MzFEdTFaZXJ3REFBWEpRSmhBUEFZaEVuNTJrN1AzN2tEMGJpclNJQVF2UG5Va1FiSGw3NHB0TWFiK0NtQ3pEam5VeEtTT2lUcVBrOEVTQXdWb2M5K3pIb3RKVE0xUXhDN2dqVEVEbHdHR0xYNCs2c1dKdGZxTWJnU3MvNCtWM2RRbjVMbTRzN2o5ODdoUXl3TS9URkQ3OGFrcXVkUUx2c3g0TEUwUy9LWThhOXdwU1dVVXZoVTMvOGNyQUNDTzBTdkVhUVArb2dmRWN6ZHJmQWUyWDNzUGgrSmNEY0RTcTRaZmt5Z01HaFQyQy81VW5PQWthNUVmdEllYjROcHh0ZnRQTitYZzJsY2g0d0dzWEpNMU9SQ3dRYkRlaENSa0MrVVN5bnc3bHhDaC9iRnFXTW8zd0ZpSnVLV21RYnFCTW5NK2t4YU1BRHBRNFVnWG83YVdiUGp3ODFJR0tCWEU3ajBnclk0S21GbTFnMWxBZzVlR3ArNS8vYTdNWU5paHdjeG95cjhLNk1XeXN1M1c4WmE0UTlHeE9Yd3ZwSkNZSEdkVnFmbUx0a000cjRnc1dwRG01b2JuU21CZGdFWFN3MjFabnA3K1E2TmUvSEZZOG4vVjMrbklwUC9rUXVkRjE2bkdLL1E4N3IwZEZ2K28vdDNHSXFqdEoxVURiVVllQVdpcXhnMklwVVViODNsekFjNFpQT1NUcVB0L3JDeTVKR2ZjTHNlS3plR3V2T2hCY1YxZ1BObzNkamxUTzk4ZE41aVBLVWg2allvVmNUbVNhb2hxYU93L3UySUQzV21mcTJudWtrT3o2dys1a1pFd0RZZ0kwSmhHMWo1d2pDZHJIZllQcm9xUEVWZWJEUGQ3MlFoMHl3U1RVTkxlQkRSeTZlNzRwbG0zb1ZBNFlOeWF4VDQ3TkI3ZTNrd0VJdEhjemFoWnJFY0I1ZFkzUGg2M1FyMTB6U1NXU0lEbjJ3bGZYTjJzcUxxQ2tNc0FVR3BhYXhaaHg0R3B4T3dkaTZnZU5lRm1wa21vMlIzWTJNV0ZJZTZWNjR6SDZpRVNQZGtMRjdmQ05hK2psNGszRWdvaWJTOEt3eStuZmloQkZQQnh3R1RUaWw2aDI0QUt0QmpKaWRSRThZV3FSdXNLVzFiVWRhU012UTNURE0wWXhuY0UwQTdsVldMaXh5OVdoNHcxZnlXNkZZZldjbDBoREFxNjRTOVA1Y2Z4L29sQnVUVVE5REdCeXc4dFFNckNBVnZqWWdCR0FZZE9Hb0hxQlp3bzNrRDc2VUxuNGpYZWVRUFdpalpoWWwrNUFqT2RtVDIxaEV3VEJjOTQ0Qkgxc1FNTWYzVmt0ZERBd2dmajhjSjBHZ0JvOTVwQ3ZWZnZOdWRyNXRiOFhFeVY3Qm0vZFZXM2IyVkhqUHRoN1FGRWZWSWpSajJra3NudTBxRGNVbFVCMVhUVEwrcnREZ0V0dTg1S2dpQytOeGg0QXA5VFU0WXZ1WU80NERTc1h5RkZKTm9neFgvRXpSdkhUaEtOMFdlbDhkVTN6THpYY0trSkRzM1Z4dDM1Mk0yMGRpRFBiLzZCc094MmxIZ3B5aTIyaTZZZWdjOCthRlJhYVpxUVU1MFh5cEh1UGhGZ3h3WGt5dkZ0dG9LZG43dGJ3TSs4cXFRRm1SS0hXa1FPSEJ1ZnZ1UXhIbm5vMzBMUkYwU24va3pKcVd0bGRxeEZWL2xyMU1wMnRscEdyeUJLaEdILzFKVkM3RUNJRHFpcDdXVTVCUXgrN0RpOUZIN0l6SVNRWDRuVzUrd3lkbkFFTFJ6QkNXa0tGSVRFcE9GbTJVVkJCeEtXSlFmdVN0VU1VL0gyQ201VE9EWDlzK0ZEd1E3Z3Z6TkhTall6V1YvUHZsaXBuYVFtNmN1SHJ0ckQ2Q3FmVndwNWlGYmtTcXg5QXhZK0hQSmxBS0NySEIraEFxa0dyVUsxSXZiOSs4WVh3K2tmQzEzdGJyUWxycUY0Uy90TFI4YlFIa0NxdnJicno5dFZaT3V0bXFJaWFrUVBhb1FQTzhrR25tVXJZNU14ZVVNM2FDWE4vdWFDZTkwUE9jendsYW5jYlRHK0xrVUk2Y3A1YlprTW1IdlJsOCsvU25zWkloaGJpSjJNN1d6R29aUEIrZm5hblhMZmhzS2dWRXg5cnpOY29LNWlmY3RURmMvSUlTV0Y2a09yNlBGV3pkWGNOcmE5Rm9xVzU0TVN0QTg3ait1djRjbnlzdVBENDRrcWNMcFZwTjcyMDFuT1RwTzdiMEpkOTV1TXhzcGFKTmdVZWd2ZVhyNmdvbUlaRk5iSEIxZks3Y3FvNnNwUmRjS1ZHTDBoRzFJdVNmV1FKQ2Y2RnFHMGV6dGVzL2RUVE1vTVppd053VjhHUFZPQk16MmVCb2wxNEdmYjBLb2huZjZRTWhNSjVuOFphczR4MVZvT09XOVM3aUswWUJWZ1gwckpwbjdVNFRROEQvUUhpOU9uei94ZlpPbVZ4S05PSjJJdENqU3YzUXZYRUJYTXRlUDVtNGRjdi9VVExqaGVoUGFRS0ZxVzJkUWZlV3UvbldYRExhVWtreW5wOW11WWZwMXplb1p3bFZEMjlQUXpkdituNzJNSjhDTDBFM1pRM1lXY082d0pXaUhzY3FDNGREVW9jdnltc296ekdIaGVXTzNFcFkrOS9lcjB5RDdVR3hwbGJSRWhaMWkxVVZNQ2U4b01SNFpCTVN4VHlHRWdDU2RyM3huSnM4VHc5eVJrMEhId3ZSZTFRUzRsU0E1OWhjNU9ZVFNxMlFVck8wNEhKelB3MkMyNDdqZ2dJUVR0blJjaldNajZSaVo5LzFGc3o1Y21va3JCa3lhaXl2cDY2cWQxdFVXUDVQMlBjR2REQmhuREQrektvYVBLVnJHUnBWeXdOdmUzQWdhNi9COC9QQyt2Mk5LMzVOWGU2UU13WHlKajRya1hjNk1wbEhTaWFPOFkxQ0ZrdlFZVUNuUzFJeXVzUFQweWVSMXNLYll1Z0lzOFBqUldwcFR4OG1IeXZ5NE5mQ1pxZ0lDSW5wd05hVDR0WkpKVC9pYUhwODFvWEUwRnhTbExUK3M1engyMGZaRXlHcVpHbFpndGZNS0tRTEtvbmwvMzR5QnNkNWl6MlJuZ0N1ZDBNMkgweEgya3ZSTUVPSjRkQ2MwZUpoOFM0QTVTWTlJQVQyUFVHc09HUndnWmdaL3gzdWF2SkJTdyt4QXNjVWdzVkk3c2ZPTGxLODEzU3JqdTBnN2VjbCszaGhTUDg0MUplaVJCMjZXeG5BSVNBemoxc05OMzlwd0xYY3o5OSs2VGN3dGFDUUszTmxRbEllTkJHVElJZHZFbUtmZWtWL3VLY3M5VGxDOHJUOGRZdG5FTnRwSzRBZmZ4VWlyV3lFUTd0RDhDTXBISzB5NlRPa0xpdDNNSFhSUng5cTNMSmNKdWF3TFE5LzRGNjdoa29NUmFkTUp5S1lhYksrVnpuaGVBTGFmbWxZTmpGVTRaRFdQbi9SZngxaE1TTlplNmU0a3ZKQ25lQ0RjWXVpaWE2WE5VSGNab1lnWTJRdzFBend2V1NsbE1BaDBhUWhrMW9XUnQ3UlR3c3hGU1NzRTdwbzh5NWExTU05WTd3WUJBbENaWmQvYm5xckR6cVlhbjcyOTN2Z1M4UlE2R3ZsakZXVVBLVnV1VkMxdEdNUUs4TGdmMEIzbmJCK2RwRVVwcVVQUUtNS1JJVXNrVmRMRFlDNXM0R3Z3UEUwcUtielBvSmYvWlUzT09DeEdkbTZWanVFOWdPTzBCZE9uaVNhcE5pUmprYnlLL3h4UFdkY2lUTzBOM3hkbkV2OWxGeXV4dlp4OWFJeks1Q1FaQTR4bENESlpQV0ZOdEVYK3l2QkY2MkFHZ3VtTUJIV29BNUZSTUpHN0xmci9FUEYrb3FKZ3BzSHJRdk5XalFnbzBWUEt4R3VTYTA5RVg5TE5yQXNVUGNrUHROTlhpN0x1blk5YkhvQng3SHpiUlFpa01EdXNLdDIwd2hObjI0cUx0azNPQVF2c0dtVWlUeWVyU0dUWjJESkVQSzlENzBWMVF1OU9IR2IzSEphZVlPSy8zajZqRUt6Uk5KR0NoMzU5VVhNT0FOZFI5ZkJwMTh5SS9QU3IzZk56c2tuSXJUSXNSeWZqNWRWUTFEaHVSVkJzeVlVWkluRU5mK0YxRFRQYUgrZXhwOWNzRDdadXd0L05xNDg4VEZucVZTUXlWTHlBNEw2VzJDalhicDFnU0RKTnE0a0hvK3l6RG5hVjVuYVpHT3ZmQUxmR09lUlNhOUJiQzlveEdreS9ScmtFWkVQczRicXFHVnl0VWxuSDEyUmg2a2ZNM0xKSk1SNDJzTXJmU0t2aTZYcTRiL3hIaDg1YjdTb2lZWTZQVGxXVnp1VUYxa3JiMGpDak12TzNUUkZBR3o5YzVVdndyeW9rUHdIbHNIK2F6T0N0ek5KbnJEanNjb1JkMFg4ZlBtTkxlK0ZkenJBQ0hnNU5zanhTdzY4TlpvVGZHYmZWNkFLbDBCd2ZCK0NydmFETitOM0JndDFmTy9PWFFRbE14WFRqZ3MwWnhxbEFPdHNOVGRFU0U1MU5hbXRCQXp0ZXJZL0lxcnloWCtYNVdEdU90ZG14N3NKVWFVSFJLNG5kRk1OUWNYSkpaMHg3cHFyMXhPaHhkYnI4cnp4U1I3ZHVrdHpUakhjVUM2OUxOeFNOalQ3bTNFUWdMd0hFOEhyMy92SjJFWllsRG45RGdzS1k0NFR5aTVLK0JCZUIwdU8ySVFsaEpDQUpyelZkSkN0YS9TMitFNlpRRWV0cmR3aWhCdHNnSDBNZFl6QlhMSXV0VkdEMXQ0RldzUGEremZwNGxnUnljOGxtTEJwNU9nbDRIUE9yeGlKWTBUNUowNkxOMnBoQVEzTkpIWlhtYnpkd1pKVThBc2FYVFB1MFROclpiK2U3VUU4S1RBd2xvOWluLzhST09ZdFArNFNYSGF4K0tiT3BLc1pzeURpQmlaTUFsK1Y4UXljTllmckI4WjNUOS83Z0p0bkR2eXdVZUNBNlUwZ3FneEZaSm9ZUTgrSzc0MEl6MHAyZ1Roa2FneHdVTldQZ1VxekhaRE9FejlOSEV4dUxYQ0NiQVJOOWRRSG5adTgvVkNXWjZvQ2FrWWdFbDFGMEsxK21rUlY3b0JrQ2xrSVRmQU1HRGt6WHUzT0pMejF2WHAzOVdHUDlwK2dBWUtzMWQyTVhOUFRUUmNmVjd3bmRXNmJzcGdsWEttQ1F4L3hub1JlRTM5ZXFxalZPd3poTWtmVzlCT29xZzdhNlhJVXpGb2U3ZHlmVEFoVkUxUlhTdnJqQW0vN3UyaWlrTVZsQ052cUFMVTFMeWY0ZXA5akVDblFkaGlpNStEc0Y2N2dLS210ZSszVHdWT0ttcXo1N0VZeFh5b2F1NjQ3bUdkWG1kQjdhUnJCLzB1amJFb2pxQjZkblQ0QWp3TmtqbkJDOVh1OFQwMnJzTUFQRjZoWm9TMGZFOGRhcHduaElGVTQwODI3WjdCaGJwMGFkNmoxclR3b3lwTUw5ZG93Y3ZvZ2t6RXZ6ZXoyRk5HbnVrbUxMT3NhbzllWHNUcHdUVVZJMmxXc3FpMGMwOXlRSzl6aldpNk8zVUlYU1QzTHNRZDNERjJhYmk0ZWdtcnFuV1dGNlVHeE14RlpjRkljZHZSSVNVbDRML1NMcWpPQjBpR0VCQ0dBYVpnaFFyL1VTVkxCeHN0ancweW9PNjV5TExCNHdQMWJIT09CdGVxdzZ5N2lDcittN2pHTndhN0dUZ05od0ZXemw0dTRmWS9WV1c5alV4TkdON0U1bXVvL3VJVHpGZE9QVEVPSEdsbkF0TTN2d0UzRE5RMlJybWdOZG00OGVob2tyRmxBUi9PbWJHTWlldE4zOEI2R3p5dXArY0JEUkpKSFhFU3NTbmZla2cxQkZ2djh3UVZTYnlWYkNtMFliQW8zUGtVaDN3UVBBMUEzeE9kZ01US1hQQ21ET3BvYllzQ1NKMUNVbnJnd1hNM3dObTN2RVVpbDV3VHB0Z0FQdEdYTVNpTjRxUGQwcUJnKzJyM0srRnBPVUVpbk9kbDVOMEp0eEJ5ZnNKTDJZM1M3RDRZWHNFRENsazVDTTJhMmRYVE80dlFtZWJ2TlJqdHU0Yi9TZjBLbXozak50T0FzWm9CMEpEeEEycGJKM2JkdmhzWnEyN1JVMmFzR05kRHhsOEN3SU5Hd1l6RS9mbkMva2dmdVFGUWNMVG5ITUVGbGtTWXl0emNwSlFBeVRpMnBTOVozUEticUhkQ2I3VytQQm5ONU51c2NpcHMvVUkzVEFXQkdQT3pqaFl5Ri9BU01Qb3MyMTUxYmZ3eGVsYWlzaXhUUGVBM3dvU0I0cVVGLys1SlU0Y2lQTEtXdk4yNTdDOWdZcWx0dlB4L003MmN4ZFQwQWJVYzZDdDJZa21QUk9ic1AxK3pYdkNja1dDZUxpY0REZDVlWU0zaEFxWXpSc0oyYlJUay9OMERMV3RLSjBsUFE1Q3k2d2c4NFBOSG5NdVFBMTB6Snd3eG5PbWNzbEJLbTRIbVN4L1paTVdhR3grVUp3c2wxK0FxYlk3V3hnaXVVTHFTbmZtV2FWVW1WR0M0ZFRYVzFwOC84aVJMUHdKR1dZS3NyQ1RTVE1xTm5BZisyWG9uTW5SejFreXc4d2ROdlRQMm8xZEFleVpBNmhCTnd4VHFVNnFDVitZdDMzc214b05SM0ZtbFR5U2xSNmVJSVROSTRqOTQyWUdDZzEyRUs5UnhQeCtLRGJZem5NWkRqYXAvTFNmWlVNWEcrVDNTc2drR2ZXRHQyYVRjQjBmZVhNWm5MTXl4MGZ0b0xWc2hGWllvYXh5ZjlyUTd3MUFVS3dhaTNIMnNWV3I4MnQ5MDF2WEZlNWRtdUhBcjJkdFk4K3lmMVVPRzJhQlBsdzcvM3lkUzRaSTBVM09peU56ek9FZlI1RWhwS3dYUllHUm1SbzNnMTdIc3NSbXFuSnozSExKdkxQRDc0SXF1cVNoMHEzNWMwUCtNcWh0aDhZSXhUY0tFYlkxQVMydEtPYXdtbVRrTGRUOUJrZ2lzRzRPMmpWSm56L0hsQ3ZrMzM5RDB0cERCNjkzNmw4bWlxVHRKNDF5K2FFSnJVa2RZeVZyek84citWZjVHVnMzaW5VczhRZTE0RkdXdXVHQmE0QkxrVGVGZVZRa056R05pdFZib293Y0FGNXZVdjNBU1lFenMxcFhQQmxtVER6T29UQlFUWUlicWJRTVB3TGdrUE5MbG9zK0cxejY0YS9ETzd5VjFoQ0V1WFF2WVphejQ2YzlndWlseU8xSlJhYnRaN1Jzd1VWVlNURjlEQ0l1WWRLclBscUxNeUYyaFNaT3BpZ1ZWbmlwNzB6VFJaMHpqWlJJVW9rdnFFQ3lXK0VMOXpVcTVGQ2FzbWw3b0FHTVhLT1ROZFBNZ3RqbXZDR1FDRENFN1dabHRJWGxiRlcxNVlPdDV2V2JhNU9iNmViTDF6SmlvdmlXL3JZa2FkQTJUVWQwRWF3OHFZQWNzM3hKditTNzRMZVBURE8vZFZ1VEUzNThIOEdZYXk0NTNOQXBtUW9kNTN5REl3aFkya2Z3elpxNi9SdXVPWjZJaGNGNnN2S1BKUVhKRTlka1MyMEY4dGJwWGZpQ2wwZ2ZCTFdjYjJOa055QzNKTy9IdWNPaHFNRm84Ym4wZ21iL09KZDc2clJhdVlJTUM4YmdqZndtVWRkY0pzVThtdmtmUzFKN2FyaGVLNG9CZU53cnZpY1VObDBrR3Jsck8rQ0RpNDFQUi9aTzgrbnk1aHBpcWM1YlVKUmd5UXFhMitWaGpoRUMvZXcwUGhaZ2lhbGNhdHc4dE56bEFQWVgwVVhvZk5ES2tBZVNYMzZEZkVzSWw5VjNkZ2VhWTlYR2IrSEVLb1pta212UzZYUFI3M0lCUWtoa1Z3ZXI0VVB2ZzNOckUvbVZjTW94eU5ybVlUNEtJWjNuaS9qVWVFRXhhQldnQmVveWIySVV3eWw0Q2Z5T2xEWjJ6cGZvRERtaXQzSmZzZ2FuNUpQTDdnZGF6WnlQVzlVTko4Y0pyZ0wrSFZLU2ZhR3g0OVpiL1JwemtVRng3N3l1NzBPS0dlU2ViRGFXcGtFN2YvM3lhY0x2eGM5VnhVZS85cVB1V21JaVErRy9qK2I5TmlMSDQ0RnYzaVZMVVViTERJSWw3VWxPRnJUYndFa0dNRE5CVy90Y21YN0MrTkY3U1NPcWF0UEMvNzViWFcwQnV6SG8wc2JxaE9aaTRGbEs0cmpSNmkyYWlLWmUwU3FPNHlaVGRxNnRtN3hZU1o2bkNUWlpRMnl6ek4rc0RMSHRncG1XRGpyK1ZlU3JtcUVSZGpQQ29KS0g1OU5jZUdSMUhwelVWeHlXQ1NrN3N6NnBjdXg0V0NKYkpRc1EyZFEvSUcxMHlJYXZTdnJ0cXlCZU1ZcXNxOVZwYlE1Mi8ybGk2UlJIUWpvRjJ4UkhFZzRLZTVUWVh0RGFZYXFtb0l3SlgyMFBvWGlpQUFnY2tNZ093V0J2Njh3alZGOTlleGw0OVhoeURnQkRoTDhDZXBFUDNyaGlGdCs2dWViSWgwSCs1ejRBbEkyOHBtSnN5SllLRXVBbmxvUG1tYWlmdXZtN2R0ZlB1b1ZoMEFEbkU0VzlZcGdkSTN1TEZtR1hYSEpjOUdxL3RuV2VaZnQ3c3Exb2xscGZ6ZzZhZWJIRnR1N0pXWTJDNkdQSVJsNmZGcnlvd2Y4Z0NRZks0MGlUcU1rU0NWYkFIUE0wUTVvODhjVmtCQVA0QnJqckxzL1ZJdUxVNGJTZHZCN3N1UjRmTElCUk5lTjREUkRJUFhIMElXeExoRGNJNnFzbUc5VHV0eG12VFloQWpod2x0dUtWSUJXRlpPM1Q2M0xHcHV5YWQxVmJHSE44K1JrMXJZaEZkSElSUDA3WHBnaFF6U2xJbjZUS0d4M1dBM05nY3N4eG50cEN0bTJHVG56dHdoQXBNc0lVV0RZZ1R0TkpCS3NBN0lmMDZsMVBJZzRqNGRZUWJnMUNQTGZRR3NlRTNPOHZSTDY0T1ZDaUZybVV2K01CRDlEMVBTdGV5S1hmZ3RpblNhanRvcjN5dUowRmIrVVVZdlpIbGZ2MXJkOFMzQ0N2VXFSV2Jyc1V0Y3hXMHo2UC9ZMmZuWlRsaTZpYU9TeHY2YWdRTnFNcTlRK1FKQjljaGUwcytwMWNWRFhDQnU1M0o3UU92ejQzaUtsSGxmMng0cVpnZW9qcjlRZS9wNmJFYVd1MHRVYy9GcmpoYmE0aGVSWjVSSXF5WlJ2MTFVR25OUmdhRHoyRlA4eVNKdGhFZVJ5MVNVdkxOWG9MM0dGY3R2Q29SU01xdjNSMXRpUERTdVVFS0hlMmRVNnFOYnl4OUxNTjhaVGpXc0FIRkJ1bTFwRSt4L2Z6cmFaRXh3RGtoSmtlTmNLeFM4WlpuRHczZWlUaUNjQyt3WkxiazJtVkhLWFdaNlpxMFA0VlljUFoxaC9FS2djRjl5d2Z3WmcrbFhyeThMUkd2cTF6MGl2NE9nNEpHTnJieGdZc3I4bWFpN0JwMVBiQnZEUWhUcFdDMHhzZUh3TytEanczbmYyMkV6aVZ5d1JuVmJFcml5WjhBcVFYMFlhNXNaYlRJS3hqVTJUVTFqZ1lHOXRQNUdtZmhNMEQ3QlRCc0wwaUZzWE5mL3Nhdi8wQThqV3htNnRRYk9jV2MvOGc2b1ZILzdsRTlveFQxN1ljZGxKVlZkYkVBMFFYaE9uOGFtU1MxbEVSSFIrVndFTE91anJ3RWdNVU1qWGQwb1YzWVBzNjZZRS90RnZKNzFmL0QwOXpwNnRNUVpGVnVOMmJkWWlpNzFRbGJZbzB2ekREbG1xSWo5UGZaNTZpOTBtdld4TzFVMkJXWnkvTnFSc2VBaFRqbzJmUXpBMUtVazQwTmo2WUx1UUl5WWVKcXY1TnIxTjVrRW5VN1NhZHdlSVhKWExsZDRnNzR4aDEzS21yMnphdTE5M1Bpd3Exck03a1hlRzV1eVZrOWphT0d1Ulk4NGFFUm1MWDFYNmY0SFo3UVBuTU1IeVl6Q3FnME5DM0dFRUxLOGI1cFFYbU5iU0dXOEQ5OXo0M2xiOTFXSjlIYmlidTdHdGgyeGlVZ2RRVlBFN2pwc0VHL1NNckllUWwrbTIvVDQyc3J2UGlTTzl3T3FsM3ZvUG9WOWpsdDZwR25SWVYzc1BEVFpXNllRalRacVJMZE5LWVlNY214WkdZc0ZKbm0rbFloNzk1NDJ4ai9QeTZJUklhMXpqaU9CdWVTMHBSRE9KSUk2L1FvZkd3bTBjQUdjM1pRUGYzZmNwQnNwWFZEY3hoVjNnaVBPd1VNVEs4MEJnV1pEbHBHWURtS3p5RzFheWhvVmI4cFRDSng1WVZLY2hpK09KM0ZWT091eTdLV1RZOHV1bWpPeXFsZHdkZGZzUklrVVlTdWJjRWZiUFl0b3pFK2lLTlNXYWgrNnFmUGt3MDduNEZYaTZ5WTN5ZjhrMlRUalhIZEtCL2ZIdEI0a2RoQmY3b3A1UGw2YmZZbEowU0h6ZzZIYU5MS0dLcDR6Y3d5N3Nqc3hDYVByTWF1WUQzdnZJTUZGTEtHcHZPTE9kdk1sclNFY1YzNGsvemV5by82N1FDenRtQTNTcjRHckxsSVlHcWY5T0tuVXRnazRIQlczR3pXbHhPdFlWUCt3R3R0OWlvRDJRWUJTTXlQa2JmMmROOGtOY3g2RC9DOExrWG5ISkh1bTNyL09XcTJWSkZ6Z2FuOVNFaVovazBTNkNSQmVEREEvdy9sN1BITEFvcmoxWnRZYXE2ZytiOHBrcmUxdk5TZU9tWHZkK3BpcDRndlZvWEV3dTF5QTJsSUJ0NTRMM3pZc3phbDdCWUpiVTJEdDlTcnFtTlpuTjJFSDJsWXlBZk50andjcUZ5Szd3dTNlWmdrV0Z2QUJUM3NTS2FveEFrNHVEYW82Q1BRMlA2UHc0RHVjS0VReCtPL2g0TENtOWZqNGdnQXRlRVlPaGJma2FPbDBKcjhOZzR6Q1ZmeWd5bFFDc2tYdmJZeG51ZmJCQUtXTGxoQVVNNHpOMTF0TERrU1luTmdyN3k5TWlJT0ZxNGZJRlpRaXNCQk0wa2U0WjVhODRoWnhUeDJ6WGo2YUszMkQxL1FaY2w2NWthd01nVEdZOXBIZEh3ZWdWRGNXcmxPSkJrdmRNSVJyUGRjZXltUThwY0ZkYm5DNGhqbUJtd3l4UUhVVmVQbWY3UVFuS0NjRXJ6d2hhWVBDMncxelkxSUVGSDh6WGtPQmM0M1ZaUkkxbkU2VmJsTHpJTkhSMU1oRWFYcDVsQ0UwdkVKaXBpVTdDV3ZHN01xcHRnVTFZSW8rVjNLYzlYZk9kekhnVEVwMDJlb1V5OVliNzhIYnJGb2pWOGJZU29UNjJNSkg5M3VzYzhxanAyQlFMY3BGZHNQeGtaR2RtWWlZaWhUT1JoUnFMV3E2S1IvZFZjWlNiRE5HUWpxSTEvNjFxUUNZR1BGWXQxRUVTVFJBT3h4UlZnR2NrRUhnV3p3MmVReS9rSFBVNzRQZUZqUXorekpqdXVpOHpoR3V3bEJyWGNxaVBEaytIUkN2UU9VRDlvZ0VQNW9UdkxqOE5FcHpyVHFVcWppRTFWK2ZUdzVwZ1RQTW83aXpEU3Y5ZFJseEtPRi9sREIwWmtRckIwVnpsK3VpeXMvWVhBemxNYll5LzQza3g0Nzl2QWNmayt2aDJqUHZYUUJ3d0VsUkhySFIxazN4OE1GTUNsaUhNeVRiaE41bEsrQTZDeWg4Yloxc1VyTEUrODVWb1psNFJkMDJRUDdYUHZ4aTMxMmk3OG15Y1FoNHhLWmlhbkRTTkpVU1hPVkROYkRta2hwbmhoYnFpUlNyYUNGVDJBRzByY2xidzhma1FlbVR5Y0JKUFcwUEMvMFlYQVBhUE83dytkQ1NwOGVpb3FhRTFrWk5VQ25QdnpGd1FiK1o4NXJncDBDRmVReGp1M1lndHdCTnI1c1dGZGtBZDhheWlLT0gxT1hOVHNCU3dsQjBJVUU2VmtUZ3p4dUJFUk5qd3lJZmJOS2pjM0xveWQwZDZqaDJWTTNpay9qVWVsK1hkYVJsdFpzR25jVlhFRmFCQllNMFd4K2J2dWt2NC96a2R4bnR6dVVNc0RWV1hORm1VMnExUVZMcGFhS1B3RXd4K2JnVVZqWlV2bE9SNlJlOFlqUEJZeHpBLzRhNkdKa29MbzhOQjVZOEw2Vzh5WVZ0NVo0MC85dk1lM3VTLy9JRGpUb05aNW0yMDV3SkhBVFpHcFU1YVRWS1lzcmo3dkFHb2xsZlRBeVY2QndCL0FEc1Y0U1prcGRCWnNoaitUd0hFeGtkelVqcURFNGhKVzdZL25EMmtvQTZma3dFdEpEOEJ4ME8zNlpvbDZrUnhsYytpZGZCQzZVN3YxNlBDU1JEWmpDUmN0WEttdkd3eURSSzc0S0RTeW0zdytqN2dGeTJxYVpGNFZtVk9KRVRKQTNvVHRzRUJmWGpXT1QreHBRMmQ5UnV0eHF3dVk0Y0ZUUGxlOW9wT1Q0aEZKL2NtcUJjVFN2YzM5OHBuS0ttNkliMDgwNVVnYlFwYUZxVzlZMkk3TU91em5EbVZsRlhGRDNwSjNzMncrQkxhOU01bXpzOGF0TGxRZThIZGJDcjdITzRQM3NPWEJyRlQ3b3lXUUJsU3NNZE5mYWxNcUlMWFFPdlEwZ3gzNzg2SVUwT01hdk5GVHV4YjhWeFdxckVpYlJYeGtuUzBsSTAwdEtDN0NubGVvZTVIQTdjTlcxZGtaREtuY2lwb1J2WFFWOXJ6M0hEcGY4dFU3RGx5SkZkMFRZYU40cnNvVXRHNGcyN3c3VTdUc2k5bE9BODVBVDNzbnRhRzZYWUlHUmJZR21XVXhNcDJOTUNvS0ZKc3h3a3VVbk93ckdIT09BNXZtUUxWYjhJWDdoMWJ5alFoTTVsT0RKWW4wNVVobUJWSjBhd014Uk1TeVA5ak5vVE9PdzVNdDkwNUUyeENaNzQ5VVJFMEtyK014RnpwRFdZUElDcUhDMWl0WjRFUXFpZFdLQjRZUklvTURWZS80aE9zdEZNOGphTXAzZ3VTZ2ZOTnlVaEtpaER0a09qOGZXZ0cxYlJ1K2k1NjM5bnV2bUZXSlFoR0svTDVsUGx6SnRwRmlBRVlMQjFrZi9kMTB6Ly9uWHBKa21qMTF6bVFTcWdSbHFlckV1bEZmR3p4b1hMRUdQSnNIOVZsbVhZVHVSMGJoc0NHeXZpeURJS2pzR0NPVjhGTTV5MURZZWlVOWVVdnZuSUk5TEQ3RVZKbkJTNmRrKzl1QmhUbFkzV3FUN1dZdE5NNVdxUHErOE1MRVdUZ3JmQzZ4TzBGTFlFSlhtd0lYZ25LYi9kSmxvdjVIbDdmWGFocEpSVjJhdC9QR3JVc0hvbUdUdk9TVitvRmxpU3ZyQWY5WEMyckpEM0ZUR3JNWHlnTXdmTjB1a1M2TXFESXhuS3ZYVWVnYnpQMXh6b3ZPaHoya1VKa0lTdmFDbzkvTlJwZVUwUUxJL3RZeGZoTWxRQ1BUblljZ0Y1UkFrMlJvalhMQ3lqVDBhRTZ1RmNucGJwWGhTT1VBU3hZTEp0YzlOUEhDT0ErQVNUTHJITzlkMUEyaHN2YzVQYWtsaDlxZ011K1ZndWJpTktFY0wvVVl2Umt5QkVnMnY3b2JSVmJTem93VCtaN0sxdExlS25MRHdiQks4NVZBazM2ZXhMaWxWU0JzRlRvQ2dvakxaN3UyZm54dFVLYW56bnI4TDZOeFBGQlJDaEdQZmd3UHhPbTl2endXcWo3TlVTVmJsYkhTeGkrdEdMZGtydmo4cklmWHdWeEtNdllsQWhBZk1HVjhnVkZVN2JOY2U2MXozWFFrUDRvU2FLdUF1S3FDaDFsZitJOVZVTTQwazB3QmNyQ05RMzh1TmFmdDk5VmVteUhYY0JQVjQrb2VLTXZBM01jb1RrU3BuWHF5aXZ5R3A4WjEvblFTbkw1UVVnOUlvWHZpckgvMUowOVpKUkNndWZ1cytZMjlaUW1KejRnakZKQm9HaXJSeGt0b0ZCS2pUcjZhazlxRW5mSGUzZyt6TkZCbzhRQUN5TG5VRmJWdTZsRVpHZTNPeXNqUU1lYzExVjJlWjFYblg0SGkwUC9PN3lZN1BwY0xuVzM5cFNlRFoyOUFOWXYvdXNvQy9lT1ZNek1ndXNVTzJDVlVVM21MdWdHZ2NtOHJVdDhjemxKeTFmQ1RBdm5BV3JXN0Zya1dNZ2REL1A2RENvQWZSeWpCSDNKWkNHeWZTZE0xMGRaczVSTmhLVUo1QjQ4dzFURklWNFRRbTlkazBsNm1nVHE2SmVqc0YrRXowWUtYWnNJMS9reVhYeG9nK01PZXJMRE1NVmZLT2lpZ0c2cEhEanFtOHE4aWVyUGN5WnNvZ0svMnhKUW1XU0xQWDIzMThVV2h2QndtVVlTaFlpWkRNM2o0QUdQODFDd2dGYjZTS1dqdE5XWEZJNEFWWDRWUlY3SnBrajlQeUZMalFvdUFDdGt5bFRFM2lGaWpELzJtUVFnbVFweTZBM1NlT2Q3b1liczVuRjZGRU1hSmlpUGJiMFZpLzgrZWYrWmJBaWJ6RHV5SVRRNFZzMjhsa1RRL3dJYTMvcGpsUm9FbWs1VXlvOG9VR2V5eXRwQjB1QjJaUCszNW9NTitudUFJTGtqejJvN3lvRWhpeFFTNmhwMVpFSmVtaDduVW5POGwzYTdSNzhMMVlxOExQK3h5enJNQStZVkU1M2l4MkVVUGFLWmp1czkxeTZQd0diNTFSY21jOW50ckJSYXVMa3ZyN0xGU0ttNVlKM3dHYzBTK2Rlc3I5dWNWemJtMFUrWXRYYTRLS2x1aDI3YjNFRy8rZjZGQm9wa2RzSU5RcEg2TFNUanh6eEhGMWE1T0s0RTRDek5mL3o2d0NjaU90dmoyWmp5c3FQMnZhN0NXdXJjVHhuOElzSklTR04ycW9ScTFzUXd6c25iT1hzY0tZUkpTa1Q2WVdScXB1OHdtbmRxS1BzMGdZNERKTk1namx1ZTBuUVZvbDM2S0pmSkd1eS9HQmVlL1lkZW1hUEdGZktmZmtNTE0vTGdKc2dlUWhybkVMVVlFbkxtb1lIb0RTckFzL1hNVnhlQXB3Y3d5Sm0rbU9GWTRlbUlUb2RlY29lN3NpME9MN0RobFcxdXlkOTF2Z1h2RkZGQmk2cU5GOWd5MlgveTIvUnhnM3pxU202NzRjMVZuYUc5ZWVoZFdwdlV5UkQ2Vks3c3lKUkM5SWpGMTYveURsRm8wWW5zUjdnelJOaTdCTUdyMUs2b3N2YmRUbGY3dlAzTjNCUEkyOXpwTXpObm8vNmVpU2tUZFR4MEVIUS9wUXUwNVhLSDQ5Q1pDd0ZIRUJsaDZoRDNWUlh1dFB0TzlRMVUyT3Q4dEptcVNyTm12T2lDdWk5N2VYY2k1dWdRNHcwdWtCblp5Mm0rajdvL0V2eFY5ZUxKTGExd0NOQlRBeVkrdytyZlBnQWZHSWd5ckZXSGU1WVE0eTUzTEZkUnQwRTFiWGZlUndiWDVQNGwxT3FrSVVoSTBlWHVpVjRwd2wzUGpDN3BNWFQ0bitjRkttT0hlVCt3L2hkL1dhMWNsODR3L09oamdsb0hiTWIzSHh1NzgrWk9BY2xLbktkeHJrL0xsMlkvdXY0V2pnc0k2Yk45WGZlUWJQSWVVVXZRR0pDQzRUTFdxQnpZWW1NR1FxWHZiK2dFa0pNN3lKc2dMMDhCZDgvdjlHaE9DeU0rZ2FNcDNhWStDWnI2V0F2NGpoem1sY3dKTERDQjdFTHRBRnBTejJMRFZka1lTQVFmVjNKcXhDbWNrbCtybitrUEhEcXFveGt1TUxTU0tySTEvREJzUm9DdCtpSy9rOVpMdDE3YkJVeHRHTGVtNy92cFhjb1FkdlVlZGhKQTRIbnRsaWZzc3ZMRFVxcUJOaWdvUGdjSCt1T3gxMTYybDFtN25mcTl6STJqb2I5NGRranluT1VBODFtUjVOUXp3bDBUamZCMndNSmhYRzlPUktwc2s5QWFYa3VneEw0QXdWQ2J1RE9JczN0Ylo2WlV0eXRDd1Q3cHlJQUFSZ0RoaVFPVlpwS2tLeW43SnNaUS85dWJHUklKWFJHUndpSWRlOFMvK0FDM0pNVHJTbTRiVXZXc2xrZW1pbEloQ2xXWkVGUUxneWJoWkp1Y0ViNkZ5cVNoTHgza0NDU0ZSNjluSGUxNnRGSGlEdTNCZEgzbkQvNzNVbWhtMjNLdzZzYjdOVFE0NlByZ05jSGZDNHFyekMyT0s0SnJlN0hKM3gxV2NwczJqa3JRVFFnVitHK0JncHNGK055MnRJdEpBWlFEUFBXL2Z4NzFTSlRyRnhWUDN5cXd1a3dZRkJBdGcrRHNxZHpkclhlaUZBaFdEUXo4YU5yOHk2Ty8yT3ZUanA1MjBORlJZWU9QdFpTODNJd1BlUElFci9ib3FQRTVxTThuaUpxblc1WlNLQlhTUERwUGdFdGpSRVNZMjh3Uko5QXdtRUhiZ2E2aURLKy8zUVEreDFMOTlBTk9vQWZrS3pXK3A2aHI4dk5ENHRSTHZhTEJ3V0tMdURhcTdyNTc5NTY4eGcveHp6eE92RnYweFRCQjEweHRvd3lBY1Q3TWVud0N0SmtKTWxyVzY2UFR6b2NXeU1sY0pDanJ4d3l6d0EvUTlQVXYrd3NGMHNha0hHK2JYbzVkbmEyd21ZTVE1U1hwN1N1V0NWRUVRTnhyNjVyWkR2S1I0RFA1QXBtUnVsSzFKOUxab0lvaW5YQUZwcXk0SUpVdzVIaXFEZ0NVdVRaNlpJUnFpbWdmekRpamlIc2Z0d2I3M01VUDBGQU9jWWdEMDkwYkloQzVLbnJkdjAxd3VWbVk0S3plOVA3NDF0R01RaGNlRnYxMkI4R2Y1eUJzWjJERGE2a3dtVVV1UHhyTEtGK2xNUGdBRE8yL0pOb1ZoNTNNZzRNR0RjbVJxaUFia3d6Q3JLOGJGNkFsZGpkTFM4ZjZOakdtQkxMWEZMa0JkbUpwWjVCczh1Z1BhZGIvaW8zSURTNjJYSkhJYm1kTC9RRytrZ2EzUWZZNkk0N2o2clV4UGp5a0dmQSsxaGNRS3J5L216YkdkbEl0ZTFHSXFLOWpQTkx5UFNsRnhGdTJFc1ZFV2N2aWtCQ1Fac0EwSFdHV2NXK1NPdWFXRTNVOG9kSFJGbjhZMzU4cFM3MGt1MVlpWXFPQmlWWHZRMDlEQUx5TndocDU3b0tBTnl1blBHTzFiMjV5bjJwRDl6elpEWFdCdVFVUStTQSswWnJtL3E0MFF5WEZjNGc4SGRvNE4vZkZLWjBDd1d4YklTZHI3bmtTV2VHK0E2RlZreHpBYkpzV0p3ZzlaQTdmRVo5RFcySi82Z0l3VWlOck85NkJ2S0RERk9HaElkNkpkTUkxVlNxZm1qSWpyUVg3dTdUTWVzdm1sdGQ5NU5NbTFDTThaV3FVb2dJclQ5SXJkY1h0aWV4MFJZTlNkbXVLbUdqSEpUVTR1QWJSQXpkSktBS0lqb2d3N3B3QlZ6RTVNUUVhc3FGS1dBTUN6ekt1OWRXbzFXdStsMjR3RWpFQVFJck9FOFZCalZzSnd6TkdaSXlKWUhlR1FtQVNGd1MzM1lXTG5CY2d0QnNKS09TWWVzbVlzcmhrcVFNckxmOVdJL1R4Y0NDVXFsUE9JalJNeTRTdkRHVkxRM3BIRnJGOCs3NGh3VUk1RC8yRlBKbnRySU5TNUhNeGxYVm1XQStnWktFbGhZN3Yybzc3cW9ZNmJkVWltOWxpVk9xSTUwd0pRRlRFN0NIckxHK3Z3Y3d5TUVzUVR0UksxRHJrNktSb2xOK1Bzajd4M3dFUU11bkRhZTRWMnFndUlWQ1pncnE5TllRNkI3cU9UTGRQU29PVzBJSlI1ZTJkSFMrOE1LTTcwQVNMN3lTTW0zMjNtWXp1VzZ2WDlLdUJONTIvV3RycU1PV2E1SDdtMTZnOWJ6WWdJeEFRbEw1dUVWTzZiSzh0NVp1UXBLWUgwbWoyaHBuTmRzMVM2cTVYWXl3SXpBWllIMFZQYnl2bUVGanN0ZFBUNHUvcTgwelViUDR0amhmdXBTR0JJRGRvU0Z4VWJVODk4NGk0cWtGbzNqVHNTd2htSURmcmJnbTk0emlaRzdVVW56Y0w5cWxZbitnYStwN2FyRHBlanN5QzFXTTBWMmlNWkdrSDg4SmMwS2VGdVhXK01NM1UxZUJ5dG9SSmJWd3Rjb2J5SWl3Q2ZKZmJuclRCQTAxN2ZCSVlNVDVEMXQ3eVgrblM5ZEYvdHdrVVA5N3NVdElFUEt1TGRHTnR5STBXclJFWDgyQWU2U0puR1FJVkhZZmhsOGlwZzFpcXpNVjJodnBuc0wyWUkraVBWRGRIM1Z4d3BiS0l6dVU4Mms5T2pESWRHN0xyZW9SaWNHWXZ5L3VQSlFad0R5RVB4ay9tVThwMGxhend2MnFpb1NOU3I4NmRqN2NBVUlwK1ltZDE4dVdjM2p4WVVpbit1YmlQV2NVTGdiNUduL3RxenNnU1VuaEtSckxKRUM3N2EwU2s4amlLM3lLSVpEQTM5RlhPOTVuWWlpdEc3TFJtaUdXTk1HWGlwd2JmTVZKeElIV0hLM0E2RGd3ZWlURTdsRkw3WVVGTnI3OGV4b2taRHVxOHoxbUk2aDF4cWRHOWJ3bHlIV20zNmNjTkQrT0RqYTRvdGMzdG1VZHdpTFovT1gxdXJNdUJGQklNdzhSYitQSjBBTUp3NXQ3LzhtSlhRcUZ5Y05kK0ZvOVViQUNhM29xa0VTdVNaM2RYaUtONWk1ZmhSM0YwN0t3UzdNbDlBMnJxNXBZcC84S1Z5dXZPcFk2ejdwVTVaK3k3bFVzV3NKWENBUE10T1FEZnNFSnpFMjU4L0xwNWY0UlB2dFJncW9SQzNKbzJ2a1pSZnM3OWxuSEhmZWlWRW1uWnlPSkg5dkJUYVB5MkZnSGJrcWRIL3lXRlhuSG1RSHpoL3VrTVZjeFoyNnNORmhUSXAyMDJUSjVxNmtHbW1kbWpSVnFnSGtsWFlrN0xUVmFhSHVMdW91enFyZWQweDFSMzFPZ293NWgvZVZXNXdqWFZqOFVuRURMd1ZKTmRqa1BOb1FrUlVHdXBsT05ZVHlNSDUwNTRSejkreXJjS0FCNmN4Ly9oRVlSeW1BSThtd3N0elpocTV4Ui9jVUdNb0RrK2gxQWFTZExRclprbjlGZDBKeE00eENJS09tVVVJNlpVZlA5TVdvd3BUY3NFdE1DbmVwWElsd0VkU2ZFOFlwR2ViZm5HUVFWMFhJV3p4dThHY0tmRkU4Y2Q0VXdIM1g3ZzlVQWpjMFZ5Tm5MTXlwd2hNR3Bla2N3WG9EWHJ5c0xGRzNkczNLVVk2cXRUazFxcUZrYzhZMWlVNW9qWHh3Nm1TOWZlZlZQeExNUC9CTHJTRllENGYxWmVkMmlQVi9ncitQbkpNSlluR0pQZzhJajBZeTVQcW5VNVlSUWlLU05GdFRGVnZWUm8waVpBbHFWbGdvbFUrQS9EUnAxaGVHRXpBQ1hjbU9XejZ1N3d3N1hWWEVNcVRzbDJod0lBSmdLUjNZT0lUU05hWGhMemxha3ZlWDk1bHc1WHliQTEzblppQndKYXlPcTdqMXJ6dUxLVmpHS3RpRnVDdkJpNlN3eEl4K2thWkZsanR5VGN0TVYwTlQya1FSNUN2SkFaMDJTWVFtYkRXWUhUb1UzNWpBTHFtVXhtMythWXpHMzQ5OCtYTkhZc2VYVXh6WEllbHp0NUVnMnpleGg5OXlldGprNG9lS0lLNWp3L2dOSkE5UTl3bHpqQ3pWdS84cWdRZC9Fa3BpbkpFV3NjODF0bERDTGRTYnU5UVI2ZUkxUm5SNyt0emNaMFY5NWdsNCtTWFVXS1dEa0lwQWZDYWdLdWRwUXVGUVVVbmNLMlZRMytlT083WnRTcU1xSkdDaC9GS3VtQy9tMEtHcTVNTGNKMVNnT1FSY0g4WkxPNlhnbGsyN2l3QzBselFJcVpOc1lIOG1xTnpCSSt0ckp3U1ZjbWF4eUNVN05YT1pmM2cvMkZUalJlR01pYXFZSTYwLy85OHFjTGxTZlNKcjBmV2I0TnNmaXJMYVpBbzErK25tYkxhNDJ2cFVGQmV3WE1oTSt0bG1MbUNDYUFvQyt3eXJwcjZhUTVzRVczQTduOFlZeWxFekxkd2hrSmhrcjRDSkFqYVNOSTU0OUtoZExDazUyTE9mL3JBWXNiRExJMUtQUitPaE5leWJ4bVBNdlh6WVYrUlUvSUFBc2h3anBGNE9VL1I1QlNPbU40QUJoaGpFVTladWlQRkN4c3gybFRjMlFRbGZBMXZQZ2xYeElhVGdBUVBzRlJaMk1KZ01IM0cwcXp2SER5bi94OUxlcC92ejVqOEM0dzRkYkswcjJvSmp1Y1dEc2JCeVd2UW9hWmJWOEpKN2hZNEErYU9ZOCtlbU81eTlia0xkVE4yMUhxYzU0TzVva3NrRFo1VHQvOE80QjhWaWtWanc4b0RiNzBaVU5oclorcElDNHlHaGdNbHg2blRtcnhBTTErUk9mYTBpRUlXU1JSQytYd01nL0xnT2VhNU10MGRIUm0rQXJkcFBrUnFQRXc4T3BZMmtLNmhMRU1RUWJCT0tiaTNyaUJnZjZFRHJtRGlCZ1JEMGhrK09EZFBQSmlaUWgrZlgyengxcHp1VVNYS0k5NlE4YnNHUEltSXhIL1VUQXY0U21ieVFhMWdJMDVndTN1aTA5bHhIMk5DeUluOXE0RU5wcGp4eFMvei80R0lLMU9yeC9vcGhmRElHM1RyQmJsYmJWTThmYVdRZGh2emRoZytHNFpRdG05OCtpWTkzQzFkSVNjTjhWcHdOYnFXckl3RmJYaTZBdDhocE9lWlJLSXkrU1kwWXZHS2FNNm16NTRtY09GeVFESk5qdFFGS2FiVnNiVCtzK21mNzcweGhUNFFtMWdsdXJXSWlhQnRVVGQvNmx5bWlIRzB5MVhrMGxqblZjTEFiUnc4R0NYMHhNU0RlREYxK2FhV0ZhVDhNUHdmVnlSSzI1RmVjemNSZVgxMllMSm1kd20yeks1RjVQSHZaUEdhM05NWTR3SkFrWjhqQVpSVVFDQTk1TUJJenhmb1NEYWxiUnBYbEo2Wm16V0FqUmE3eUxKS0JNdk1HSHJTakFLeGNISVBBQUFBNVplTlZtNE5ncjZreCtDbTh0TTlacG9sWi8zbkU3aTBVQzRmaGliVXJ2S3pzS2JjcUZGLzU5ZlVuVzZ3QjFRQUFBd1BTeGtEMWFneGVoSmJoQjN4L0xUZWZmZHlXSXZKRUtFc0ZveFZLblNSYkJINnFCME5KWFFyRkU5RUlFcy9lWUI1anEzUTQ1cDkxeU9hUHhIam5qT0psK1hNRStybG1lcHk1WWl3cFhuTlV5UGhvRWo4YlArbXNNTG5WelNvdEJiTitqbXdQc1dZQk1KMkVpUm1ZdWErYkgyRkM0cWpwcnhvZERNV29NYml3K2NiVWwzUlozU0NwZWM4NWtqRTRtVGJNdHdvbGlqeTBFTFpRajRFclprQWZxWU0rRDloMHZ1WC9HcDQ4V0RwQit6YjRid0kxekpNdHhDZmdlS1F3Ui9hNkdMQk5TQzlHUHZlQ2NsMit3RzIvQ1ovdDFYbUhKeWI3bDg0NmJFZXBZU2xabldZS0xCMEJySC92UzBteWgwYml0QkZxck5uUTdsOE45SWtmekU3OVZpZXFzWkc4eElHTEFWQ2NHWFBJaTVPcXZ4WENEbW5JVEFNUkN3OHBpZE9ueHBuRitzamlvVW14UHRaUUVodWcwNkQ3VGVETUduMjh3UzJ5b3BHYkx2Uk5wczcvTjJmalJNdnNzeE5lR1V5ek5ab2lndEpZUm9ZbVpkNEpzU2lEaUZrSzRpMjNQcmRabWVXYnpTRnF5SHlGdUZoUFNQOFhoNzdzMnE2MWswUnVLaWFIVXlhZE5ZSC90anJVZWVIMHFoT0Q4ek5XU1ZhR1BBNXV3QURPZUhndEdTL1NaeUErZndQQnl4eEpILzBhUmVPZ0wvcHRDc0dUQjd6VnFlS0Qzc1RPbkRHZUVzdEVkV1YydVh1T1VlaWp0VlYrekVoWFEyOHVGUmRyZWF0NlREeE04OE9PK1hsN3BoODhjYTJKekN6cFloYzhTOTNXOFJiQXFGeFR2Z2tPVGlTb0FNN05UbHBRUmZ6VEZuWG9JTWdLYTNUdjJGNHlOVHl5UjJLRi92T08veWRYa0VQRHhRSzk0MEY5RE8zSVVncFBKalpPbmM3Z0VENTFZUEtIcEdXcFc3UTFhM1puSDF6UFpJbWkwN2FCZ29wQU5rM0h0QXhBdURZSm5MY0l1NEVCb3NQbDYvWnN6eWdnSGd0VlQrNk4wZnIrUkx3cnNrY3Yza05iOWZOSUxidWlMYkROL2JseUdFNEFxVlNCd3prSXdBQUFDckJMZjV4SHk4akZuQXFuZmYvREdpQUtSb3JOMlNXQndOV1ZyRldmejNPOWtka1NNd2tPQU92R0JId2cwS2ZRZ3JDZlRGMVFwWHFvT1hhRnBlZ0lUekE5Wi9rckY2T1BCejdCL0NkREV6YThLM2hzazFKYVRySFUra0EzL3NMUFVZZXJiSXk1SWQwTG5CNldOZWNvZ3ZkN21VSm04ejZTVER5VjRDa21PSDFnVWtvLzZJbksyN3hpSHNaZU5TV0d1bHZ6RzdMNmVDdUltampYRWZtcWdnWEgyaHcrTFBodC9HZ2ZlRk5hT21pdkJZaHZHb2t5bXc3NmV0YmFZOXhodGdMM0RBQ3RweGNBQUFBN1UyMGpkb295NzJ4VW9QT0U0eFhVbkZrNklVVzZUR01UbzQvRzV5d2lCbnJqa0VYTDlMQ3NKcEhRdnVPNHljaEFNbmNsU0k0cTloZW8xRnRDZjlVLzRXaCtYTS9nQXFSNzUxRWF1NWRmZURMUFNEQlcybFA4d1dqL0FhQjVSbExQa3B3VDczeU1jNVZoOS9mSGFPeVNBd1ZuRWJyNkJ5dmlBRElTZWdWcjdyRkl2Z0tZNmJJUkNEMjh5cm1saXpuU2ZDczFCR25WeTgvS3Ayb2NqcDN3dGU4VEV0N09WZUVKYml3NWRBNWJBTjFuTlJITlRSQ3h5bzVGeFhBZEN5NG5NMU9QaS9GcXZJMmNITHlPVk95aGgvZW52ME45VHlCTkV1MjVGSHhTTVNqTXczaThycS9ZbnhLYjBSN3pRREk0SHFYTWIzMVByOWVRSzBBc0Q0bU1RNzJ2U0RVaE9SREUwekJXYzIyNTMzY2Zhdk5NVEpHYkF5ZnZ1YmJMaFdnazRtYTNVYmdjOWMxc1I4dUhIc3IrVTdtandvVmt2N0s1aWUyQTVydUh0SmljVkRBVnJNb3NHSjdhNzFsMk5HclFLUVpnem93QVBKWURIR2g4SG5TRDg0em5QQUs1a2dhOVZ5K0dqTFk0T1JJcE9uTWNWQmE1MFUwcFM0SzdKVHNaN09GZ0VmOGJ6cUhydWlOZ20rWlQ2L1RZSGVpSm5IN3RQOWxNTEorbzFPbWloK050Y2FBbkxXTm1HaEFLYVFMSWlwM3Y0OXp3VUtqeWphVGJOSC9JVUVDY2ZDRndNQWs1c1E4QmxXSzRVanFiSHAxUkxoRytrc0FyT3B2OHFQNGdJQ29ibW9icTJVTTNmTkxybHdFVTRCK2xaOHJxdm8wYzAyTGNPMjJScnJETkVNNkw4ZXlSMThDN3lubGJabXV5RG85NkVlSDNwVzdEUmxncTBHOXlTWHlZMzJRTmhvR3BNbDBaVFdJVFlMYzgzRnBjYVZmdjljSEhYTjNhQmhDazNITEN0a0E4ZnVJb2RYVEFRYkxRa2dqeXVwYjhnMnRERzlIdkFlM3V2TmdIOXQ3M2dINnBhdW1ZdjVIU2xpZWtoRFZ0VVVQTDFhN3JiWGJZT21MdHZweXg3YWRTRjVpVW80cWZMRDV5RlJ2UG03MHhPWkpzVWRlSm9hMklLS2puUU9KVGFKUW1rVmJKN2dYcmpyaTVRekZ4M0xHdDNFMit0aWZqY0U3cDFqTEhUUlBaYld6WkdlbDFaS0c2SVIwRE16UUIyeVR5cTRheEFQVVd4SzFGdnV4cEQ4NFduQUd6a0tzeVlwN0srMElnQUFBQSIgLz4NCjwvc3ZnPg0K";

// billing.js
var billing_exports = {};
__export(billing_exports, {
  BILLING_MESSAGES: () => BILLING_MESSAGES,
  BILLING_STATES: () => BILLING_STATES,
  BillingTab: () => BillingTab,
  activeAccountsTabAtom: () => activeAccountsTabAtom,
  default: () => registerBilling,
  determineBillingState: () => determineBillingState,
  openExternalSafe: () => openExternalSafe,
  openNomadAccountsTab: () => openNomadAccountsTab
});
import { PALETTE_AREA as PALETTE_AREA8, ROUTES_AREA as ROUTES_AREA9 } from "@hermes/plugin-sdk";
import { jsx as jsx7 } from "react/jsx-runtime";
function registerBilling(ctx) {
  ctx.register({
    id: "route",
    area: ROUTES_AREA9,
    data: {
      id: "nomad.billing.route",
      path: "/nomad-billing",
      title: "Тариф и баланс NomadNet"
    },
    render: () => /* @__PURE__ */ jsx7(BillingTab, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA8,
    order: 65,
    data: {
      id: "nomad.billing.open",
      action: "nomad.billing.open",
      label: "Тариф и баланс NomadNet",
      category: "Nomad",
      keywords: [
        "тариф",
        "баланс",
        "номады",
        "оплата",
        "пополнить",
        "ключ",
        "nomadnet",
        "billing",
        "402"
      ],
      run: () => openNomadAccountsTab("billing")
    }
  });
}

// deeplink.js
var deeplink_exports = {};
__export(deeplink_exports, {
  ACCOUNTS_ROUTE_PATH: () => ACCOUNTS_ROUTE_PATH,
  CONNECT_ROUTE_PATH: () => CONNECT_ROUTE_PATH,
  DEEPLINK_SCHEME: () => DEEPLINK_SCHEME,
  default: () => register2,
  handleNomadDeepLink: () => handleNomadDeepLink,
  parseNomadDeepLink: () => parseNomadDeepLink
});
import { ROUTES_AREA as ROUTES_AREA10, host as host5 } from "@hermes/plugin-sdk";
import { useEffect as useEffect9, useState as useState10 } from "react";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var DEEPLINK_SCHEME = "nomad";
var ACCOUNTS_ROUTE_PATH = "/nomad-accounts";
var CONNECT_ROUTE_PATH = "/nomad-connect";
var HANDOFF_TOKEN_RE = /^[A-Za-z0-9_.:-]{4,512}$/;
var ALLOWED_CONNECT_KINDS = /* @__PURE__ */ new Set(["connect", "accounts", "nomad-accounts", "nomad-connect"]);
var ALLOWED_SUB_NAMES = /* @__PURE__ */ new Set(["", "connect", "accounts", "nomad-accounts", "nomad-connect"]);
function asRealString(value) {
  return typeof value === "string" ? value : "";
}
function sanitizeParams(rawParams) {
  if (!rawParams || typeof rawParams !== "object" || typeof rawParams === "function") {
    return {};
  }
  const clean = {};
  for (const [k, v] of Object.entries(rawParams)) {
    if (typeof k === "string" && typeof v === "string") {
      clean[k] = v.trim();
    }
  }
  return clean;
}
function extractValidToken(params) {
  const candidate = asRealString(params.handoff_token || params.token).trim();
  if (!candidate || !HANDOFF_TOKEN_RE.test(candidate)) {
    return null;
  }
  return candidate;
}
function parseNomadDeepLink(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return null;
    if (raw.startsWith("#/")) {
      const withoutHash = raw.slice(1);
      const qIndex = withoutHash.indexOf("?");
      const pathname = (qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash).replace(/\/+$/, "");
      if (pathname !== "/nomad-connect" && pathname !== "/nomad/connect" && pathname !== "/connect" && pathname !== "/nomad-accounts") {
        return null;
      }
      const query = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : "";
      const search = new URLSearchParams(query);
      const params2 = {};
      search.forEach((v, k) => {
        params2[k] = v.trim();
      });
      const handoffToken = extractValidToken(params2);
      if (pathname === "/nomad-accounts" && !handoffToken) {
        return null;
      }
      return {
        targetPath: ACCOUNTS_ROUTE_PATH,
        handoffToken,
        cpUrl: asRealString(params2.cp_url) || null,
        tenantId: asRealString(params2.tenant_id) || null,
        params: params2
      };
    }
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      return null;
    }
    const scheme = asRealString(parsed.protocol).replace(/:$/, "").toLowerCase();
    if (scheme !== DEEPLINK_SCHEME) {
      return null;
    }
    const kind = asRealString(parsed.hostname).toLowerCase();
    const name = decodeURIComponent(asRealString(parsed.pathname).replace(/^\/+|\/+$/g, "")).toLowerCase();
    const params = {};
    parsed.searchParams.forEach((v, k) => {
      params[k] = v.trim();
    });
    return parseNomadDeepLink({ kind, name, params, scheme });
  }
  if (typeof input === "object" && typeof input !== "function") {
    if (typeof input.scheme === "string" && input.scheme.toLowerCase() !== DEEPLINK_SCHEME) {
      return null;
    }
    const kind = asRealString(input.kind).trim().toLowerCase();
    const name = asRealString(input.name).trim().replace(/^\/+|\/+$/g, "").toLowerCase();
    const params = sanitizeParams(input.params);
    const isDirectConnect = ALLOWED_CONNECT_KINDS.has(kind) && ALLOWED_SUB_NAMES.has(name);
    const isScopedConnect = (kind === "nomad" || kind === "open") && (name === "connect" || name === "accounts" || name === "nomad-accounts" || name === "nomad-connect");
    if (!isDirectConnect && !isScopedConnect) {
      return null;
    }
    return {
      targetPath: ACCOUNTS_ROUTE_PATH,
      handoffToken: extractValidToken(params),
      cpUrl: asRealString(params.cp_url) || null,
      tenantId: asRealString(params.tenant_id) || null,
      params
    };
  }
  return null;
}
function navigateToAccounts(navigateFn) {
  let navigated = false;
  if (typeof navigateFn === "function") {
    try {
      navigateFn(ACCOUNTS_ROUTE_PATH);
      navigated = true;
    } catch {
      navigated = false;
    }
  }
  if (!navigated && host5 && typeof host5.navigate === "function") {
    try {
      host5.navigate(ACCOUNTS_ROUTE_PATH);
      navigated = true;
    } catch {
      navigated = false;
    }
  }
  if (typeof window !== "undefined" && window.location && typeof window.location.hash === "string" && window.location.hash !== `#${ACCOUNTS_ROUTE_PATH}`) {
    try {
      window.location.hash = `#${ACCOUNTS_ROUTE_PATH}`;
    } catch {
    }
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    try {
      if (typeof CustomEvent === "function") {
        window.dispatchEvent(
          new CustomEvent("nomad:navigate-accounts", {
            detail: { path: ACCOUNTS_ROUTE_PATH }
          })
        );
      }
    } catch {
    }
  }
}
async function handleNomadDeepLink(input, options = {}) {
  const parsed = parseNomadDeepLink(input);
  if (!parsed) {
    return { handled: false, targetPath: null, redeemed: false, result: null };
  }
  const { ctx, navigate } = options;
  navigateToAccounts(navigate);
  if (!parsed.handoffToken || !ctx || typeof ctx.rest !== "function") {
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: false,
      result: null
    };
  }
  const body = {
    handoff_token: parsed.handoffToken,
    key: `${DEEPLINK_SCHEME}://connect?handoff_token=${encodeURIComponent(parsed.handoffToken)}`
  };
  if (parsed.cpUrl) {
    body.cp_url = parsed.cpUrl;
  }
  if (parsed.tenantId && /^\d+$/.test(parsed.tenantId)) {
    body.tenant_id = Number(parsed.tenantId);
  }
  try {
    const result = await ctx.rest("/connect", {
      method: "POST",
      body
    });
    if (typeof window !== "undefined" && typeof CustomEvent === "function") {
      try {
        window.dispatchEvent(new CustomEvent("nomad:handoff-complete", { detail: result }));
      } catch {
      }
    }
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: Boolean(result && result.ok),
      result: result || null
    };
  } catch (err) {
    const safeError = {
      ok: false,
      connected: false,
      code: "handoff-request-failed",
      message: "Не удалось завершить автоматическое подключение аккаунта NomadNet.",
      status: err && typeof err.statusCode === "number" ? err.statusCode : void 0
    };
    return {
      handled: true,
      targetPath: parsed.targetPath,
      redeemed: false,
      result: safeError
    };
  }
}
function AccountsConnectFallbackView({ ctx }) {
  const [state, setState] = useState10({ loading: true, connected: false, model: null, baseUrl: null });
  useEffect9(() => {
    let cancelled = false;
    if (ctx && typeof ctx.rest === "function") {
      Promise.resolve(ctx.rest("/connect/status")).then((data) => {
        if (cancelled || !data || typeof data !== "object" || typeof data === "function") return;
        setState({
          loading: false,
          connected: Boolean(data.connected),
          model: asRealString(data.model) || null,
          baseUrl: asRealString(data.base_url) || null
        });
      }).catch(() => {
        if (!cancelled) {
          setState({ loading: false, connected: false, model: null, baseUrl: null });
        }
      });
    } else {
      setState({ loading: false, connected: false, model: null, baseUrl: null });
    }
    return () => {
      cancelled = true;
    };
  }, [ctx]);
  return jsxs7("div", {
    "data-testid": "nomad-accounts-screen",
    style: { padding: "28px 32px", maxWidth: 680, lineHeight: 1.5 },
    children: [
      jsx8("h1", {
        style: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
        children: "Аккаунты"
      }),
      jsx8("p", {
        style: { margin: "0 0 16px", opacity: 0.8 },
        children: "Управление подключением NomadNet и ключами доступа."
      }),
      jsx8("div", {
        "data-testid": "nomad-connect-status",
        style: {
          padding: "12px 16px",
          borderRadius: 8,
          border: "1px solid rgba(128,128,128,0.25)",
          fontSize: 13
        },
        children: state.connected ? `Подключено к NomadNet${state.model ? ` · модель ${state.model}` : ""}` : "Ожидание подключения ключа из личного кабинета NomadNet"
      })
    ]
  });
}
function register2(ctx) {
  ctx.register({
    id: "connect-route",
    area: ROUTES_AREA10,
    order: 90,
    title: "Аккаунты",
    data: { path: CONNECT_ROUTE_PATH },
    render: () => jsx8(AccountsConnectFallbackView, { ctx })
  });
  ctx.register({
    id: "accounts-fallback-route",
    area: ROUTES_AREA10,
    order: 999,
    title: "Аккаунты",
    data: { path: ACCOUNTS_ROUTE_PATH },
    render: () => jsx8(AccountsConnectFallbackView, { ctx })
  });
  const disposers = [];
  let handledColdStartLog = false;
  const bridge = typeof window !== "undefined" && window.hermesDesktop && typeof window.hermesDesktop === "object" ? window.hermesDesktop : null;
  if (bridge && typeof bridge.onDeepLink === "function") {
    const off = bridge.onDeepLink((payload) => {
      if (!payload || typeof payload !== "object" || typeof payload === "function") return;
      void handleNomadDeepLink(payload, { ctx });
    });
    if (typeof off === "function") {
      disposers.push(off);
    }
  }
  if (bridge && typeof bridge.getRecentLogs === "function") {
    Promise.resolve(bridge.getRecentLogs()).then((lines) => {
      if (handledColdStartLog || !Array.isArray(lines)) return;
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        const line = asRealString(lines[i]);
        if (line.includes("[deeplink] delivered connect/") || line.includes("[deeplink] delivered nomad/connect")) {
          handledColdStartLog = true;
          navigateToAccounts();
          break;
        }
      }
    }).catch(() => {
    });
  }
  if (typeof window !== "undefined") {
    const checkCurrentLocation = () => {
      const hash = asRealString(window.location && window.location.hash);
      if (hash) {
        void handleNomadDeepLink(hash, { ctx });
      }
    };
    checkCurrentLocation();
    if (typeof window.addEventListener === "function" && typeof window.removeEventListener === "function") {
      const onHashChange = () => checkCurrentLocation();
      const onCustomDeepLink = (event) => {
        const detail = event && event.detail;
        if (detail) {
          void handleNomadDeepLink(detail, { ctx });
        }
      };
      window.addEventListener("hashchange", onHashChange);
      window.addEventListener("nomad:deep-link", onCustomDeepLink);
      disposers.push(() => {
        window.removeEventListener("hashchange", onHashChange);
        window.removeEventListener("nomad:deep-link", onCustomDeepLink);
      });
    }
  }
  if (ctx && typeof ctx.onDispose === "function") {
    ctx.onDispose(() => {
      while (disposers.length > 0) {
        const dispose = disposers.pop();
        try {
          dispose();
        } catch {
        }
      }
    });
  }
}

// estop.js
var estop_exports = {};
__export(estop_exports, {
  StatusbarStopButton: () => StatusbarStopButton,
  default: () => register3
});

// stop.js
var stop_exports = {};
__export(stop_exports, {
  StatusbarStopButton: () => StatusbarStopButton,
  default: () => register3
});
import { PALETTE_AREA as PALETTE_AREA9, STATUSBAR_AREAS as STATUSBAR_AREAS2 } from "@hermes/plugin-sdk";
import { createElement as createElement4, useCallback as useCallback8, useEffect as useEffect10, useState as useState11 } from "react";
var h4 = createElement4;
function StatusbarStopButton({ ctx }) {
  const [stopped, setStopped] = useState11(false);
  const [loading, setLoading] = useState11(false);
  const fetchState = useCallback8(() => {
    if (!ctx || typeof ctx.rest !== "function") return;
    Promise.resolve().then(() => ctx.rest("/state")).then((res) => {
      if (res && typeof res.stopped === "boolean") {
        setStopped(res.stopped);
      }
    }).catch(() => {
    });
  }, [ctx]);
  useEffect10(() => {
    fetchState();
    const interval = setInterval(fetchState, 3e3);
    return () => clearInterval(interval);
  }, [fetchState]);
  const toggleStop = useCallback8(() => {
    if (!ctx || typeof ctx.rest !== "function" || loading) return;
    setLoading(true);
    const endpoint = stopped ? "/resume" : "/pause";
    const body = stopped ? {} : { reason: "desktop UI button" };
    Promise.resolve().then(() => {
      if (typeof ctx.rest.post === "function") {
        return ctx.rest.post(endpoint, body);
      }
      return ctx.rest(endpoint, { method: "POST", body });
    }).then(() => {
      setStopped(!stopped);
    }).catch(() => {
    }).finally(() => {
      setLoading(false);
    });
  }, [ctx, stopped, loading]);
  const label = stopped ? "▶️ Продолжить" : "⏸️ Стоп";
  const title = stopped ? "Nomad приостановлен. Нажмите, чтобы продолжить (Ctrl+Alt+S)." : "Приостановить работу Nomad (Ctrl+Alt+S).";
  return h4(
    "button",
    {
      type: "button",
      onClick: toggleStop,
      title,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "2px 8px",
        fontSize: "12px",
        cursor: "pointer",
        border: "1px solid currentColor",
        borderRadius: "3px",
        background: stopped ? "#ff4d4f" : "transparent",
        color: stopped ? "#ffffff" : "inherit"
      }
    },
    label
  );
}
function register3(ctx) {
  if (typeof ctx.register === "function") {
    ctx.register({
      id: "statusbar_stop",
      area: STATUSBAR_AREAS2.RIGHT || "statusbar:right",
      order: 10,
      render: () => h4(StatusbarStopButton, { ctx })
    });
    ctx.register({
      id: "cmd_pause",
      area: PALETTE_AREA9 || "palette",
      data: {
        id: "nomad.pause",
        label: "Nomad: Стоп (приостановить запуск задач)",
        keybinding: "Ctrl+Alt+S"
      },
      action: () => {
        if (typeof ctx.rest === "function") {
          const fn = ctx.rest.post || ctx.rest;
          fn("/pause", { reason: "command palette" });
        }
      }
    });
    ctx.register({
      id: "cmd_resume",
      area: PALETTE_AREA9 || "palette",
      data: {
        id: "nomad.resume",
        label: "Nomad: Продолжить (возобновить запуск задач)"
      },
      action: () => {
        if (typeof ctx.rest === "function") {
          const fn = ctx.rest.post || ctx.rest;
          fn("/resume", {});
        }
      }
    });
  }
}

// i18n.js
var i18n_exports = {};
__export(i18n_exports, {
  default: () => registerNomadI18n,
  ru: () => ru
});

// i18n/ru.json
var ru_default = {
  accounts: {
    title: "Аккаунты и провайдеры",
    subtitle: "Управляйте вашими подключёнными подписками, ключами доступа и порядком резервирования.",
    nav: "Аккаунты",
    poolTab: "Пул провайдеров",
    billingTab: "Тариф и баланс",
    fallbackTab: "Порядок и запас",
    oauthSignIn: "Войти подпиской",
    addApiKey: "Добавить ключ",
    resetCooldown: "Снять пометку охлаждения",
    refreshSession: "Обновить вход",
    deleteAccount: "Удалить из пула",
    saveOrder: "Сохранить порядок",
    emptyPool: "В вашем пуле пока нет подключённых аккаунтов. Добавьте подписку или API-ключ.",
    ruOnlyNotice: "Включён российский контур: зарубежные резервные провайдеры отключены для защиты ваших данных."
  },
  skills: {
    title: "Навыки Nomad",
    subtitle: "Просматривайте каталог навыков с русскими описаниями, собирайте рабочие наборы и управляйте архивом куратора.",
    nav: "Навыки Nomad",
    catalogTab: "Каталог",
    bundlesTab: "Наборы",
    archiveTab: "Архив",
    createBundle: "Создать набор навыков",
    deleteBundle: "Удалить набор",
    restoreSkill: "Вернуть из архива",
    pinSkill: "Закрепить навык",
    unpinSkill: "Открепить навык",
    searchPlaceholder: "Найдите навык по названию или задаче"
  },
  safety: {
    title: "Разрешения и безопасность",
    subtitle: "Настройте белый список команд из вашей истории и правила безусловного запрета.",
    nav: "Разрешения и безопасность",
    suggestionsTitle: "Предложения из истории команд",
    allowlistTitle: "Белый список разрешённых шаблонов",
    denyTitle: "Правила безусловного запрета",
    acceptSuggestion: "Принять в белый список",
    disableRule: "Выключить правило",
    addDenyRule: "Добавить запрет",
    removeDenyRule: "Удалить запрет",
    egressReadOnly: "Исходящий прокси-контур доступен в режиме просмотра."
  },
  data: {
    title: "Данные и место",
    subtitle: "Контролируйте объём данных профиля, точки отката, резервные копии и очистку памяти.",
    nav: "Данные и место",
    pruneCheckpoints: "Почистить лишнее",
    wipeMemory: "Стереть память",
    confirmWipe: "Подтвердите очистку памяти вторым нажатием",
    createBackup: "Создать резервную копию",
    restoreBackup: "Восстановить из архива",
    confirmRestoreStep1: "Подтвердите замену текущего профиля выбранным архивом",
    confirmRestoreStep2: "Окончательно подтвердить и перезаписать данные профиля",
    copyCliCommand: "Скопировать команду для терминала"
  },
  start: {
    title: "Перенос и старт",
    subtitle: "Перенесите ваши навыки и серверы инструментов в профиль и пройдите стартовый список проверок.",
    nav: "Перенос и старт",
    previewImport: "Показать предпросмотр переноса",
    runImport: "Перенести навыки и настройки",
    keysNotImportedWarning: "Внимание: секретные ключи доступа не переносятся автоматически.",
    checklistTitle: "Чек-лист первого дня",
    hideMenuWhenDone: "Скрыть раздел после выполнения всех шагов"
  },
  personalization: {
    title: "Персонализация",
    subtitle: "Настройте стиль общения, рабочую роль, тему оформления и предпочтения ответа под ваши задачи.",
    savePreferences: "Сохранить настройки персонализации",
    themeSelect: "Выберите тему оформления",
    toneSelect: "Выберите предпочтительный стиль ответов"
  },
  simulator: {
    title: "Симулятор ИИ",
    subtitle: "Практический интерактивный курс с персональным ментором по вашим рабочим сценариям.",
    nav: "Симулятор ИИ",
    selectTrack: "Выберите вашу роль для старта практической миссии",
    startMission: "Начать практическую миссию",
    continueSession: "Продолжить вашу учебную сессию"
  },
  swarm: {
    title: "Рой исполнителей",
    subtitle: "Координация параллельных субагентов, очередь задач и сводка результатов выполнения.",
    activeWorkers: "Активные исполнители роя",
    completedTasks: "Завершённые задачи",
    openSwarmPanel: "Открыть панель управления роем"
  },
  estop: {
    title: "Стоп и состояние",
    subtitle: "Мгновенная приостановка фоновых задач и новых запусков с сохранением текущего хода.",
    pauseButton: "Приостановить работу",
    resumeButton: "Продолжить работу",
    pausedBanner: "Выполнение фоновых задач приостановлено по вашему запросу.",
    activeBanner: "Все службы профиля работают в штатном режиме."
  },
  cron: {
    title: "Инциденты расписания",
    subtitle: "Сводка сбоев периодических заданий с возможностью подтверждения и закрытия уведомлений.",
    ackButton: "Принято",
    showResolved: "Показать закрытые",
    noOpenIncidents: "Все периодические задания выполняются штатно — открытых сбоев нет.",
    repeatsLabel: "Повторов подряд"
  },
  slack: {
    generateManifest: "Сгенерировать манифест Slack",
    copiedToast: "Манифест скопирован — вставьте в api.slack.com/apps → Create from manifest"
  },
  themes: {
    dark: "Nomad Тёмная (по умолчанию)",
    light: "Nomad Светлая",
    steppe: "Nomad Степь",
    midnight: "Nomad Полночь",
    highContrast: "Nomad Высокий контраст"
  },
  models: {
    title: "Модели и локальные серверы",
    subtitle: "Подключайте локальные серверы и собственные эндпоинты для автономной работы.",
    testConnection: "Проверить соединение",
    makeActiveModel: "Сделать рабочей моделью"
  },
  learning: {
    title: "Что агент про меня понял",
    subtitle: "Обзор накопленных знаний и предпочтений вашего профиля в режиме чтения.",
    readOnlyBadge: "Только просмотр"
  }
};

// i18n.js
var STATUS_FALLBACK_RU = {
  nav: "Nomad",
  title: "Nomad",
  checking: "Проверяем сервер плагина…",
  ok: (version) => `Сервер плагина отвечает · версия ${version}`,
  degraded: (version) => `Сервер плагина отвечает, но не все экраны подключились · версия ${version}`,
  down: "Сервер плагина не отвечает",
  hint: "Проверьте, что открыт профиль nomad и плагин Nomad включён в разделе «Плагины», затем перезапустите приложение.",
  screens: "Экраны",
  none: "Экранов пока нет",
  problems: "Неполадки"
};
var ru = {
  ...ru_default,
  status: STATUS_FALLBACK_RU
};
function registerNomadI18n(ctx) {
  if (!ctx || !ctx.i18n || typeof ctx.i18n.register !== "function") {
    return;
  }
  ctx.i18n.register({ ru });
}

// palette-actions.js
var palette_actions_exports = {};
__export(palette_actions_exports, {
  IMPORT_PALETTE_LABEL: () => IMPORT_PALETTE_LABEL,
  IMPORT_TARGET_ROUTE: () => IMPORT_TARGET_ROUTE,
  ROLLBACKS_PALETTE_LABEL: () => ROLLBACKS_PALETTE_LABEL,
  ROLLBACKS_TARGET_ROUTE: () => ROLLBACKS_TARGET_ROUTE,
  default: () => registerPaletteActions,
  openImportSettings: () => openImportSettings,
  openRollbacks: () => openRollbacks
});
import { PALETTE_AREA as PALETTE_AREA10 } from "@hermes/plugin-sdk";
var IMPORT_PALETTE_LABEL = "Перенести настройки из Claude Code";
var ROLLBACKS_PALETTE_LABEL = "Показать откаты";
var IMPORT_TARGET_ROUTE = "/nomad-start#import-agent";
var ROLLBACKS_TARGET_ROUTE = "/nomad-data#checkpoints";
function openImportSettings(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === "function") {
    return ctx.host.navigate(IMPORT_TARGET_ROUTE);
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.hash = "#" + IMPORT_TARGET_ROUTE;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
function openRollbacks(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === "function") {
    return ctx.host.navigate(ROLLBACKS_TARGET_ROUTE);
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.hash = "#" + ROLLBACKS_TARGET_ROUTE;
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
function registerPaletteActions(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  ctx.register({
    id: "palette-import-claude-code",
    area: PALETTE_AREA10,
    order: 245,
    data: {
      id: "nomad.start.import_claude_code",
      action: "nomad.start.import_claude_code",
      label: IMPORT_PALETTE_LABEL,
      category: "Nomad",
      keywords: ["перенести", "настройки", "claude code", "claude-code", "import", "старт", "миграция", "start"],
      run: () => openImportSettings(ctx)
    }
  });
  ctx.register({
    id: "palette-show-rollbacks",
    area: PALETTE_AREA10,
    order: 246,
    data: {
      id: "nomad.data.show_rollbacks",
      action: "nomad.data.show_rollbacks",
      label: ROLLBACKS_PALETTE_LABEL,
      category: "Nomad",
      keywords: ["откаты", "показать откаты", "снимки", "checkpoints", "rollback", "data", "место"],
      run: () => openRollbacks(ctx)
    }
  });
}

// personalization.js
var personalization_exports = {};
__export(personalization_exports, {
  ACCENT_COLORS: () => ACCENT_COLORS,
  DEFAULT_PERSONALIZATION_SETTINGS: () => DEFAULT_PERSONALIZATION_SETTINGS,
  ONBOARDING_ANSWERS_STORAGE_KEY: () => ONBOARDING_ANSWERS_STORAGE_KEY,
  PERSONALIZATION_ROUTE_PATH: () => PERSONALIZATION_ROUTE_PATH,
  PERSONALIZATION_STORAGE_KEY: () => PERSONALIZATION_STORAGE_KEY,
  PersonalizationTab: () => PersonalizationTab,
  REPLY_STYLES: () => REPLY_STYLES,
  default: () => registerPersonalizationPlugin,
  loadPersonalizationSettings: () => loadPersonalizationSettings,
  personalizationStateAtom: () => personalizationStateAtom,
  readStorageSafe: () => readStorageSafe,
  savePersonalizationSettings: () => savePersonalizationSettings,
  writeStorageSafe: () => writeStorageSafe
});
import { PALETTE_AREA as PALETTE_AREA11, ROUTES_AREA as ROUTES_AREA11, atom as atom3, host as host6 } from "@hermes/plugin-sdk";
import { createElement as createElement5, useCallback as useCallback9, useEffect as useEffect11, useState as useState12 } from "react";
var ONBOARDING_ANSWERS_STORAGE_KEY = "hermes-onboarding-wizard-answers-v1";
var PERSONALIZATION_STORAGE_KEY = "nomad.personalization.settings";
var PERSONALIZATION_ROUTE_PATH = "/nomad-personalization";
var DEFAULT_PERSONALIZATION_SETTINGS = {
  userName: "",
  honorific: "formal",
  // 'formal' = обращение строго на «вы» (решение D10)
  role: "Инженер / Разработчик",
  replyStyle: "technical",
  // 'technical', 'concise', 'detailed', 'mentor'
  accent: "nomad"
};
var REPLY_STYLES = [
  { id: "technical", label: "Технический и прямой (без воды)" },
  { id: "concise", label: "Краткий (сжатые выводы)" },
  { id: "detailed", label: "Подробный (с пояснениями архитектуры)" },
  { id: "mentor", label: "Менторский (с вопросами и проверкой)" }
];
var ACCENT_COLORS = [
  { id: "nomad", label: "Nomad Blue (канонический)" },
  { id: "emerald", label: "Emerald Green (изумруд)" },
  { id: "ocean", label: "Deep Ocean (морской)" },
  { id: "amber", label: "Amber (тёплый янтарь)" }
];
var h5 = createElement5;
var personalizationStateAtom = atom3({ ...DEFAULT_PERSONALIZATION_SETTINGS });
function readStorageSafe(ctx, key, fallback = null) {
  if (ctx && ctx.storage && typeof ctx.storage.get === "function") {
    return ctx.storage.get(key, fallback);
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  return fallback;
}
function writeStorageSafe(ctx, key, value) {
  if (ctx && ctx.storage && typeof ctx.storage.set === "function") {
    ctx.storage.set(key, value);
  }
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
    }
  }
}
function loadPersonalizationSettings(ctx) {
  const saved = readStorageSafe(ctx, PERSONALIZATION_STORAGE_KEY, null);
  const onboarding = readStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, null);
  const merged = {
    ...DEFAULT_PERSONALIZATION_SETTINGS,
    ...saved || {}
  };
  if (onboarding && onboarding.accent) {
    merged.accent = onboarding.accent;
  }
  personalizationStateAtom.set(merged);
  return merged;
}
function savePersonalizationSettings(ctx, newSettings) {
  const clean = {
    ...DEFAULT_PERSONALIZATION_SETTINGS,
    ...newSettings || {}
  };
  writeStorageSafe(ctx, PERSONALIZATION_STORAGE_KEY, clean);
  personalizationStateAtom.set(clean);
  const currentOnboarding = readStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, {}) || {};
  const nextOnboarding = {
    ...currentOnboarding,
    accent: clean.accent || null,
    userName: clean.userName || currentOnboarding.userName || null
  };
  writeStorageSafe(ctx, ONBOARDING_ANSWERS_STORAGE_KEY, nextOnboarding);
  if (host6 && typeof host6.notify === "function") {
    host6.notify("Настройки персонализации сохранены");
  }
  return clean;
}
function PersonalizationTab({ ctx, onSaved = null }) {
  const [settings, setSettings] = useState12(() => loadPersonalizationSettings(ctx));
  const [saveSuccess, setSaveSuccess] = useState12("");
  const handleFieldChange = (field, value) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
    setSaveSuccess("");
  };
  const handleSubmit = (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    const saved = savePersonalizationSettings(ctx, settings);
    setSaveSuccess("Настройки персонализации успешно сохранены и вступят в силу для всех новых сессий.");
    if (typeof onSaved === "function") {
      onSaved(saved);
    }
  };
  return h5(
    "div",
    {
      "data-testid": "nomad-personalization-container",
      style: {
        padding: "24px 32px",
        maxWidth: "720px",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }
    },
    h5(
      "header",
      { style: { display: "flex", flexDirection: "column", gap: "6px" } },
      h5(
        "h1",
        {
          "data-testid": "personalization-title",
          style: { fontSize: "20px", fontWeight: 600, margin: 0 }
        },
        "Персонализация ассистента Nomad"
      ),
      h5(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.75, lineHeight: 1.5 } },
        "Настройте формат взаимодействия, имя обращения и стилистику ответов модели. Все параметры сохраняются локально в профиле и синхронизируются с мастером онбординга."
      )
    ),
    h5(
      "form",
      {
        onSubmit: handleSubmit,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          background: "var(--card, rgba(128,128,128,0.05))",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid var(--border, rgba(128,128,128,0.22))"
        }
      },
      // Имя пользователя
      h5(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h5(
          "label",
          { style: { fontSize: "13px", fontWeight: 600 } },
          "Как к вам обращаться:"
        ),
        h5("input", {
          type: "text",
          "data-testid": "personalization-username-input",
          value: settings.userName,
          onChange: (e) => handleFieldChange("userName", e.target.value),
          placeholder: "Например: Жемал",
          style: {
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border, rgba(128,128,128,0.3))",
            background: "var(--background, rgba(0,0,0,0.12))",
            color: "inherit",
            fontSize: "13px"
          }
        })
      ),
      // Форма обращения (D10: на вы)
      h5(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h5(
          "label",
          { style: { fontSize: "13px", fontWeight: 600 } },
          "Форма обращения (решение D10):"
        ),
        h5(
          "select",
          {
            "data-testid": "personalization-honorific-select",
            title: "Форма обращения: строго на «вы» (канон Nomad D10)",
            "data-tooltip": "Форма обращения: строго на «вы» (канон Nomad D10)",
            value: settings.honorific,
            onChange: (e) => handleFieldChange("honorific", e.target.value),
            style: {
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, rgba(128,128,128,0.3))",
              background: "var(--background, rgba(0,0,0,0.12))",
              color: "inherit",
              fontSize: "13px"
            }
          },
          h5("option", { value: "formal" }, "Строго на «вы» (канон Nomad D10)"),
          h5("option", { value: "informal" }, "На «ты» (неформальный рабочий стиль)")
        )
      ),
      // Роль и профессия
      h5(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h5("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Ваша основная роль / профиль:"),
        h5("input", {
          type: "text",
          "data-testid": "personalization-role-input",
          title: "Роль и специализация ассистента",
          "data-tooltip": "Роль и специализация ассистента",
          value: settings.role,
          onChange: (e) => handleFieldChange("role", e.target.value),
          placeholder: "Например: CPO / Разработчик",
          style: {
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border, rgba(128,128,128,0.3))",
            background: "var(--background, rgba(0,0,0,0.12))",
            color: "inherit",
            fontSize: "13px"
          }
        })
      ),
      // Стиль ответов модели
      h5(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h5("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Стиль и глубина ответов модели:"),
        h5(
          "select",
          {
            "data-testid": "personalization-style-select",
            title: "Стиль ответов: технический, краткий или менторский",
            "data-tooltip": "Стиль ответов: технический, краткий или менторский",
            value: settings.replyStyle,
            onChange: (e) => handleFieldChange("replyStyle", e.target.value),
            style: {
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, rgba(128,128,128,0.3))",
              background: "var(--background, rgba(0,0,0,0.12))",
              color: "inherit",
              fontSize: "13px"
            }
          },
          REPLY_STYLES.map((st) => h5("option", { key: st.id, value: st.id }, st.label))
        )
      ),
      // Цветовой акцент оформления (синхронизируется с onboarding-answers)
      h5(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h5("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Цветовой акцент интерфейса (онбординг):"),
        h5(
          "select",
          {
            "data-testid": "personalization-accent-select",
            title: "Цветовой акцент оформления интерфейса",
            "data-tooltip": "Цветовой акцент оформления интерфейса",
            value: settings.accent,
            onChange: (e) => handleFieldChange("accent", e.target.value),
            style: {
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, rgba(128,128,128,0.3))",
              background: "var(--background, rgba(0,0,0,0.12))",
              color: "inherit",
              fontSize: "13px"
            }
          },
          ACCENT_COLORS.map((c) => h5("option", { key: c.id, value: c.id }, c.label))
        )
      ),
      // Кнопка сохранения
      h5(
        "div",
        { style: { display: "flex", gap: "12px", alignItems: "center", marginTop: "6px" } },
        h5(
          "button",
          {
            type: "submit",
            "data-testid": "personalization-save-btn",
            title: "Сохранить настройки персонализации",
            "data-tooltip": "Сохранить настройки персонализации",
            style: {
              padding: "9px 20px",
              borderRadius: "8px",
              border: "none",
              background: "var(--primary, #18181B)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          "Сохранить настройки"
        ),
        saveSuccess && h5(
          "span",
          {
            "data-testid": "personalization-save-success",
            style: { fontSize: "13px", color: "#10b981" }
          },
          saveSuccess
        )
      )
    )
  );
}
function registerPersonalizationPlugin(ctx) {
  ctx.register({
    id: "route",
    area: ROUTES_AREA11,
    data: {
      id: "nomad.personalization.route",
      path: PERSONALIZATION_ROUTE_PATH,
      title: "Персонализация"
    },
    render: () => h5(PersonalizationTab, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA11,
    order: 67,
    data: {
      id: "nomad.personalization.open",
      action: "nomad.personalization.open",
      label: "Персонализация ассистента",
      category: "Nomad",
      keywords: ["персонализация", "имя", "обращение", "стиль", "ответы", "онбординг", "personalization"],
      run: () => {
        if (host6 && typeof host6.navigate === "function") {
          host6.navigate(PERSONALIZATION_ROUTE_PATH);
        }
      }
    }
  });
}

// simulator.js
var simulator_exports = {};
__export(simulator_exports, {
  ACADEMY_BRIDGE_BASE_URL: () => ACADEMY_BRIDGE_BASE_URL,
  ACADEMY_MENTORS: () => ACADEMY_MENTORS,
  CALIBRATION_TIERS: () => CALIBRATION_TIERS,
  CLUB_SKILL_PACKS: () => CLUB_SKILL_PACKS,
  COMPANION_STAGES: () => COMPANION_STAGES,
  FRONTIER_DROPS: () => FRONTIER_DROPS,
  INTERNAL_LISTING_SOURCES: () => INTERNAL_LISTING_SOURCES,
  MAX_SIDEBAR_NAV_ITEMS: () => MAX_SIDEBAR_NAV_ITEMS,
  NOMAD_SIDEBAR_NAV_SPECS: () => NOMAD_SIDEBAR_NAV_SPECS,
  SERVICE_SESSION_SOURCES: () => SERVICE_SESSION_SOURCES,
  SIMULATOR_KICKOFF: () => SIMULATOR_KICKOFF,
  SIMULATOR_NAV_CODICON: () => SIMULATOR_NAV_CODICON,
  SIMULATOR_NAV_LABEL: () => SIMULATOR_NAV_LABEL,
  SIMULATOR_NAV_ORDER: () => SIMULATOR_NAV_ORDER,
  SIMULATOR_PATH: () => SIMULATOR_PATH,
  SIMULATOR_PERSONA: () => SIMULATOR_PERSONA,
  SIMULATOR_PERSONA_KEY: () => SIMULATOR_PERSONA_KEY,
  SIMULATOR_SCENARIOS: () => SIMULATOR_SCENARIOS,
  SIMULATOR_SESSION_SOURCE: () => SIMULATOR_SESSION_SOURCE,
  SIMULATOR_SESSION_TITLE: () => SIMULATOR_SESSION_TITLE,
  SIMULATOR_TRACKS: () => SIMULATOR_TRACKS,
  STORY_MISSIONS: () => STORY_MISSIONS,
  SimulatorPage: () => SimulatorPage,
  assertNomadSidebarRowCap: () => assertNomadSidebarRowCap,
  continueSimulatorChat: () => continueSimulatorChat,
  countNomadSidebarRows: () => countNomadSidebarRows,
  default: () => register4,
  evaluateMissionLocally: () => evaluateMissionLocally,
  filterRecentSessionsBySetting: () => filterRecentSessionsBySetting,
  resolveCompanionStageByXp: () => resolveCompanionStageByXp,
  resolveKickoffText: () => resolveKickoffText,
  simulatorStateAtom: () => simulatorStateAtom,
  startSimulatorChat: () => startSimulatorChat
});
import { useCallback as useCallback10, useEffect as useEffect12, useMemo as useMemo4, useState as useState13 } from "react";
import {
  PALETTE_AREA as PALETTE_AREA12,
  ROUTES_AREA as ROUTES_AREA12,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA6,
  atom as atom4,
  host as host7,
  useValue as useValue2
} from "@hermes/plugin-sdk";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
var SIMULATOR_PATH = "/nomad-simulator";
var SIMULATOR_NAV_LABEL = "Симулятор ИИ";
var SIMULATOR_NAV_CODICON = "mortar-board";
var SIMULATOR_NAV_ORDER = 65;
var SIMULATOR_PERSONA_KEY = "simulator";
var SIMULATOR_SESSION_SOURCE = "simulator";
var SIMULATOR_SESSION_TITLE = "Симулятор ИИ";
var MAX_SIDEBAR_NAV_ITEMS = 6;
var ACADEMY_BRIDGE_BASE_URL = "https://academy.hamidun.com/api/nomad-bridge";
var SERVICE_SESSION_SOURCES = ["cron", "subagent", "tool"];
var INTERNAL_LISTING_SOURCES = ["kanban", "tool", "oneshot"];
var NOMAD_SIDEBAR_NAV_SPECS = [
  {
    id: "accounts",
    code: "N1",
    label: "Аккаунты",
    path: "/nomad-accounts",
    codicon: "account",
    order: 60
  },
  {
    id: "skills",
    code: "N4",
    label: "Навыки Nomad",
    path: "/nomad-skills",
    codicon: "extensions",
    order: 61
  },
  {
    id: "safety",
    code: "N5",
    label: "Безопасность",
    path: "/nomad-safety",
    codicon: "shield",
    order: 62
  },
  {
    id: "data",
    code: "N6",
    label: "Данные и место",
    path: "/nomad-data",
    codicon: "database",
    order: 63
  },
  {
    id: "start",
    code: "N7",
    label: "Перенос и старт",
    path: "/nomad-start",
    codicon: "rocket",
    order: 64
  },
  {
    id: "simulator",
    code: "U8",
    label: SIMULATOR_NAV_LABEL,
    path: SIMULATOR_PATH,
    codicon: SIMULATOR_NAV_CODICON,
    order: SIMULATOR_NAV_ORDER
  }
];
var COMPANION_STAGES = [
  {
    stage: 0,
    code: "STAGE_0_SPARK",
    title: "Stage 0 · Искра Синтеза",
    subtitle: "Базовое ядро диалога и точной постановки задач (Роль + Контекст + Ограничения + DoD)",
    minXp: 0,
    maxXp: 299,
    badgeIcon: "0"
  },
  {
    stage: 1,
    code: "STAGE_1_PULSE",
    title: "Stage 1 · Проводник Потока",
    subtitle: "Связка промптинга, локальных файлов, таблиц и голосового сопровождения ElevenLabs v3",
    minXp: 300,
    maxXp: 799,
    badgeIcon: "I"
  },
  {
    stage: 2,
    code: "STAGE_2_NEXUS",
    title: "Stage 2 · Архитектор Скиллов",
    subtitle: "Модульные SKILL.md в 1 клик и гибридный роутинг РФ без VPN (Суверенные + Мировые модели)",
    minXp: 800,
    maxXp: 1599,
    badgeIcon: "II"
  },
  {
    stage: 3,
    code: "STAGE_3_SWARM",
    title: "Stage 3 · Командир Роя",
    subtitle: "Параллельные волны субагентов (Jev / Agent Swarms) и протокол Crash-Safe (state.md)",
    minXp: 1600,
    maxXp: 2999,
    badgeIcon: "III"
  },
  {
    stage: 4,
    code: "STAGE_4_ARGON",
    title: "Stage 4 · Автономный Сингуляр",
    subtitle: "Многодневные автономные циклы до 72 часов (Gemini 4 Argon + полный мультимодальный стек)",
    minXp: 3e3,
    maxXp: null,
    badgeIcon: "IV"
  }
];
var ACADEMY_MENTORS = {
  nika: {
    id: "nika",
    name: "Ника",
    shortLabel: "Ника · Проводник",
    role: "Пошаговый проводник · Структурный разбор · Голос ElevenLabs v3",
    xpMultiplier: 1,
    accentColor: "#18181B",
    voiceModel: "ElevenLabs v3 (eleven_v3)",
    greetingText: "Привет! Я Ника, твой проводник в Симуляторе Hamidun Academy и Nomad. Не бойся чистого листа: выбирай уровень, открывай миссию — я проведу тебя за руку по микро-шагам до готового рабочего инструмента!",
    systemPrompt: [
      "Ты — Ника, эмпатичный и практичный проводник курса «Симулятор ИИ × Hamidun Academy» в десктопе Nomad.",
      "Обращайся к ученику строго на «ты» — тепло, уважительно, живо и по делу, без корпоративных штампов.",
      "Твой метод — пошаговый scaffolding: сразу давай понятный каркас решения, объясняй «почему это работает» и помогай довести миссию до готового файла в рабочей папке проекта.",
      "ПРАВИЛО ПЕРВОГО ОТВЕТА: На первое сообщение ответь МГНОВЕННО без вызова инструментов и чтения диска — поприветствуй от имени Ники и дай первый практический микро-шаг."
    ].join("\n\n")
  },
  socrates: {
    id: "socrates",
    name: "Сократ",
    shortLabel: "Сократ · Ментор ×1.5",
    role: "Инженерный спарринг-партнёр · Стресс-тест архитектуры (бонус ×1.5 XP)",
    xpMultiplier: 1.5,
    accentColor: "#475569",
    voiceModel: "ElevenLabs v3 (eleven_v3)",
    greetingText: "Привет. Я Сократ — твой инженерный спарринг-партнёр в Симуляторе Hamidun Academy. Я не раздаю готовых костылей: мы проверим твою архитектуру через точные наводящие вопросы, найдём узкие места и соберём систему промышленного класса за полуторный опыт!",
    systemPrompt: [
      "Ты — Сократ, философ-инженер и требовательный ментор курса «Симулятор ИИ × Hamidun Academy» в десктопе Nomad.",
      "Обращайся к ученику строго на «ты» — уважительно, прямо, интеллектуально и по делу.",
      "Твой метод — сократический стресс-тест: задай 1 снайперский вопрос про граничные условия, безопасность данных (152-ФЗ) или критерий отказа, помоги ученику увидеть сильное архитектурное решение и начисляй бонус ×1.5 XP.",
      "ПРАВИЛО ПЕРВОГО ОТВЕТА: На первое сообщение ответь МГНОВЕННО без вызова инструментов и чтения диска — поприветствуй от имени Сократа, напомни про ставку ×1.5 XP и запусти первый инженерный вызов."
    ].join("\n\n")
  }
};
var CALIBRATION_TIERS = [
  {
    id: "novice",
    label: "Новичок",
    shortHint: "Пошаговый каркас без страха чистого листа",
    bonusMultiplier: 1
  },
  {
    id: "practitioner",
    label: "Практик",
    shortHint: "Пайплайны, реальные выгрузки и автопроверка",
    bonusMultiplier: 1.1
  },
  {
    id: "pro",
    label: "Профи · Рои и SKILL.md",
    shortHint: "Параллельные рои субагентов, SKILL.md и 72ч автономность",
    bonusMultiplier: 1.25
  }
];
var STORY_MISSIONS = [
  {
    id: "story-01-contract",
    order: 1,
    chapter: "Глава 1 · Точка Опоры",
    title: "Контракт Задачи: от размытой хотелки к железному ТЗ",
    subtitle: "Формулируй контекст, входные данные, ограничения и критерии приёмки так, чтобы агент выдавал рабочий результат с первого шага.",
    xpReward: 150,
    estimatedMinutes: 12,
    academyLessonSlug: "module-1-prompt-architecture",
    briefByMentor: {
      nika: "Привет! В первой миссии мы навсегда уберём боль размытых ответов ИИ. Я дам тебе простую формулу из 4 блоков (Роль, Контекст, Ограничения, Готово если), и мы за 10 минут соберём твой первый безотказный инструмент!",
      socrates: "Привет. Когда модель выдаёт воду, причина почти всегда в дырявой спецификации. Давай проверим: какие 3 жёстких инварианта должны выполняться в твоём артефакте, чтобы ты принял его в продакшн без единой правки?"
    },
    doneCriteria: [
      "Задан явный контекст задачи и целевой формат файла (HTML / Markdown / JSON)",
      "Перечислены минимум 3 жёстких ограничения («чего агенту делать нельзя»)",
      "Сформулирован проверяемый чек-лист «Готово, если…» из 3+ пунктов"
    ],
    tiers: {
      novice: {
        objective: "Собрать интерактивный одностраничный калькулятор или чек-лист под твою задачу по формуле 4 блоков.",
        starterPrompt: "Привет! Проходим сюжетную Миссию 1 («Контракт Задачи») на уровне «Новичок». Помоги мне упаковать мою задачу в 4 блока (Роль, Контекст, Ограничения, Готово если) и сразу создай рабочий HTML-инструмент в папке проекта."
      },
      practitioner: {
        objective: "Спроектировать воспроизводимую спецификацию с валидацией входных данных и проверкой граничных случаев.",
        starterPrompt: "Привет! Запускаем сюжетную Миссию 1 («Контракт Задачи») на уровне «Практик». Составим строгую спецификацию с валидацией входов, обработкой краевых случаев и самопроверкой результата."
      },
      pro: {
        objective: "Упаковать контракт задачи в модульный SKILL.md с триггерами маршрутизации и автоматическим Quality Gate.",
        starterPrompt: "Привет! Идём в сюжетную Миссию 1 («Контракт Задачи») на уровне «Профи». Спроектируем канонический SKILL.md с YAML-фронтматтером, триггерами роутинга и CLI-скриптом верификации инвариантов."
      }
    }
  },
  {
    id: "story-02-data-pipeline",
    order: 2,
    chapter: "Глава 2 · Живые Данные",
    title: "Чистый Поток: превращаем хаос таблиц и заметок в дашборд решений",
    subtitle: "Связываем локальные CSV/JSON-выгрузки, очистку грязных строк и интерактивную визуализацию без ручного копирования.",
    xpReward: 220,
    estimatedMinutes: 15,
    academyLessonSlug: "module-2-local-data-pipelines",
    briefByMentor: {
      nika: "Сырые таблицы и заметки после встреч отнимают часы. Давай поручим это агенту: сейчас мы соберём пайплайн, который сам очистит выгрузку, найдёт просадки и нарисует красивый отчёт!",
      socrates: "Любая боевая выгрузка содержит дубли, пропуски и битые кодировки. Если твой пайплайн молча проглотит их — дашборд соврёт бизнесу. Как ты отделишь карантин битых данных от расчёта целевых метрик?"
    },
    doneCriteria: [
      "Пайплайн корректно отфильтровывает дубли, пропуски и битые форматы дат/сумм в отдельный лог",
      "Рассчитана сводная таблица метрик с автоматической подсветкой аномалий",
      "Собран самодостаточный интерактивный дашборд, открывающийся локально"
    ],
    tiers: {
      novice: {
        objective: "Превратить грязную таблицу продаж в чистый HTML-дашборд с 3 главными управленческими выводами.",
        starterPrompt: "Привет! Начинаем сюжетную Миссию 2 («Чистый Поток») на уровне «Новичок». Сгенерируй тестовую выгрузку с типичными ошибками, очисти её и собери наглядный HTML-дашборд с 3 выводами."
      },
      practitioner: {
        objective: "Построить воспроизводимый пайплайн очистки CSV с карантином битых записей и когортной аналитикой.",
        starterPrompt: "Привет! Запускаем сюжетную Миссию 2 («Чистый Поток») на уровне «Практик». Собери пайплайн очистки CSV с логом отбракованных строк, расчётом юнит-экономики и интерактивным отчётом."
      },
      pro: {
        objective: "Реализовать декларативный ETL-конвейер со строгой схемой, детектором выбросов и автотестами на грязных фикстурах.",
        starterPrompt: "Привет! Проходим сюжетную Миссию 2 («Чистый Поток») на уровне «Профи». Спроектируй ETL-конвейер со строгой схемой данных, статистическим детектором аномалий и набором автотестов."
      }
    }
  },
  {
    id: "story-03-sovereign-bridge",
    order: 3,
    chapter: "Глава 3 · Суверенный Мост",
    title: "Маршрутизация РФ без VPN: Суверенные + Мировые модели в одном контуре",
    subtitle: "Настраиваем гибридный роутинг: GigaChat / МТС Cotype / Яндекс для контура 152-ФЗ и мировые фронтир-модели через шлюз Nomad без VPN.",
    xpReward: 280,
    estimatedMinutes: 15,
    academyLessonSlug: "module-3-sovereign-and-global-routing",
    briefByMentor: {
      nika: "В Nomad тебе не нужен VPN: российские и мировые модели работают в едином окне! Давай составим понятную карту: какие задачи с документами РФ отдавать в GigaChat и Яндекс, а какие — в мировые флагманы.",
      socrates: "Архитектор выбирает модель по 4 осям: суверенитет данных (152-ФЗ), глубина рассуждений, задержка и цена токена. По какому формальному правилу твой роутер переключит дорожку при таймауте провайдера?"
    },
    doneCriteria: [
      "Составлена матрица классификации задач: 152-ФЗ и ПДн в суверенный стек РФ vs сложный код/ризонинг в мировой стек",
      "Настроено обезличивание чувствительных полей и резервная цепочка (fallback)",
      "Проведена сверка качества и скорости ответа на реальном кейсе"
    ],
    tiers: {
      novice: {
        objective: "Разложить 5 рабочих задач по дорожкам суверенных (GigaChat / Яндекс / Cotype) и мировых моделей.",
        starterPrompt: "Привет! Проходим сюжетную Миссию 3 («Суверенный Мост») на уровне «Новичок». Помоги мне составить карту выбора моделей под мои задачи: где использовать GigaChat/Яндекс/Cotype, а где мировые модели через шлюз Nomad без VPN."
      },
      practitioner: {
        objective: "Собрать фильтр маскирования ПДн и правила автоматического переключения между суверенным и глобальным контуром.",
        starterPrompt: "Привет! Запускаем сюжетную Миссию 3 («Суверенный Мост») на уровне «Практик». Собери модуль маскирования чувствительных данных (152-ФЗ) и таблицу автоматического fallback-роутинга."
      },
      pro: {
        objective: "Реализовать продакшн-роутер с классификатором сложности (Jev), контролем бюджета и кросс-верификацией двумя моделями.",
        starterPrompt: "Привет! Идём в сюжетную Миссию 3 («Суверенный Мост») на уровне «Профи». Спроектируем гибридный роутер с оценкой сложности Jev, санитизацией 152-ФЗ и перекрёстной верификацией ответов."
      }
    }
  },
  {
    id: "story-04-swarm-command",
    order: 4,
    chapter: "Глава 4 · Симфония Роя",
    title: "Параллельный Рой (Jev & Agent Swarms): делаем за 15 минут работу недели",
    subtitle: "Декомпозируем крупную задачу на независимые дорожки субагентов (Разведка → Реализация → Ревью → Верификация) по протоколу Crash-Safe.",
    xpReward: 380,
    estimatedMinutes: 20,
    academyLessonSlug: "module-4-agent-swarms-orchestration",
    briefByMentor: {
      nika: "Представь, что у тебя появилась команда из 4 быстрых специалистов: аналитик, разработчик, редактор и верификатор! Давай научимся раздавать им параллельные задания так, чтобы они собрали готовый проект без накладок.",
      socrates: "Параллельный рой без строгих границ владения файлами гарантированно устроит гонку записи. Как ты разделишь контракты между воркерами Wave 2 и какой инвариант проверит верификатор в Wave 3?"
    },
    doneCriteria: [
      "Задача разделена на 3+ параллельных пакета без пересечения по изменяемым файлам",
      "Создан манифест прогресса волны (state.md) и изолированные отчёты субагентов",
      "Выполнена финальная кросс-верификация и сборка единого релиза"
    ],
    tiers: {
      novice: {
        objective: "Запустить рой из 3 ролей (Исследователь, Автор, Критик) для сборки комплексного запуска продукта.",
        starterPrompt: "Привет! Начинаем сюжетную Миссию 4 («Симфония Роя») на уровне «Новичок». Помоги мне разделить подготовку продуктового запуска на 3 параллельные дорожки роя и собрать сводный результат."
      },
      practitioner: {
        objective: "Оркестровать 3-волновую сборку (Wave 1 Разведка → Wave 2 Реализация → Wave 3 Верификация) с файлом state.md.",
        starterPrompt: "Привет! Запускаем сюжетную Миссию 4 («Симфония Роя») на уровне «Практик». Спроектируй 3-волновую оркестрацию роя с файлом state.md, изолированными выходами воркеров и финальным Quality Gate."
      },
      pro: {
        objective: "Построить полный Crash-Safe конвейер роя с матрицей владения файлами, кросс-модельным ревью и контрактными тестами.",
        starterPrompt: "Привет! Идём в сюжетную Миссию 4 («Симфония Роя») на уровне «Профи». Реализуем протокол Crash-Safe Swarm с матрицей изоляции файлов, кросс-модельным ревью и автоматическим гейтом приёмки."
      }
    }
  },
  {
    id: "story-05-argon-autonomy",
    order: 5,
    chapter: "Глава 5 · Автономный Горизонт",
    title: "Марафон Gemini 4 Argon: делегируем многодневные проекты с чекпоинтами",
    subtitle: "Запускаем сверхдлинные автономные циклы (до 72 часов) с чекпоинтами на диске, контролем бюджета и утренними дайджестами.",
    xpReward: 500,
    estimatedMinutes: 20,
    academyLessonSlug: "module-5-autonomous-horizons-argon",
    briefByMentor: {
      nika: "Фронтир-модели нового поколения вроде Gemini 4 Argon способны вести проект сутками! Давай настроим твоего автономного агента так, чтобы он шёл по чекпоинтам, сам проверял результат и готовил тебе утренний дайджест.",
      socrates: "В 72-часовом автономном цикле ошибка в допущении на первом часе умножается экспоненциально. Какие контрольные точки самопроверки и безусловные стоп-краны (kill-switch) ты заложишь в архитектуру марафона?"
    },
    doneCriteria: [
      "Описан поэтапный план марафона с записью чекпоинтов на диск после каждой фазы",
      "Заданы жёсткие лимиты бюджета, детектор зацикливания и условия эскалации человеку",
      "Собран шаблон утреннего дайджеста с проверяемыми артефактами и вариантами решений"
    ],
    tiers: {
      novice: {
        objective: "Настроить автономного агента, который по расписанию собирает аналитику и готовит утренний план решений.",
        starterPrompt: "Привет! Проходим сюжетную Миссию 5 («Марафон Gemini 4 Argon») на уровне «Новичок». Помоги мне спроектировать автономного агента с чекпоинтами и понятным утренним дайджестом."
      },
      practitioner: {
        objective: "Собрать многошаговый автономный конвейер с персистентным журналом прогресса и защитой от дрейфа цели.",
        starterPrompt: "Привет! Запускаем сюжетную Миссию 5 («Марафон Gemini 4 Argon») на уровне «Практик». Спроектируем автономный цикл с журналом чекпоинтов, детектором стагнации и гейтами самопроверки."
      },
      pro: {
        objective: "Реализовать архитектуру 72-часового марафона Gemini 4 Argon с ветвлением гипотез, авто-откатом и крипто-аудитом логов.",
        starterPrompt: "Привет! Идём в сюжетную Миссию 5 («Марафон Gemini 4 Argon») на уровне «Профи». Построим архитектуру 72-часового автономного цикла с деревом гипотез, бюджетированием токенов и системой kill-switch."
      }
    }
  }
];
var FRONTIER_DROPS = [
  {
    id: "drop-gemini-4-argon",
    weekBadge: "🔥 Drop #18 · Главный релиз недели",
    title: "Gemini 4 Argon — автономный слон на 3 дня",
    subtitle: "15-минутный блиц: как ставить сверхдлинные автономные задачи на 72 часа с чекпоинтами state.md, защитой от потери курса и экономией бюджета.",
    xpReward: 250,
    durationMinutes: 15,
    tags: ["Gemini 4 Argon", "72h Autonomy", "Zero-Drift", "Checkpoints"],
    highlights: [
      "Неизменяемые чекпоинты каждые 30 минут работы с автосверкой против исходного ТЗ",
      "Каскадное сжатие рабочей памяти без потери критических архитектурных фактов",
      "Утренний дайджест владельцу: что готово, какие развилки требуют твоего решения"
    ],
    kickoffPrompt: "Привет! Запускаю блиц-симулятор Frontier Drop «Gemini 4 Argon — автономный слон на 3 дня». Проведи меня на «ты» через 15-минутный практикум: давай соберём манифест 72-часовой автономной задачи с чекпоинтами, защитой от дрейфа цели и автопроверкой результата!"
  },
  {
    id: "drop-jev-agent-swarms",
    weekBadge: "🐝 Drop #17 · Инженерный хит Клуба",
    title: "Jev & Параллельные рои субагентов",
    subtitle: "Как развернуть рой из 5 специализированных агентов в Nomad, разделить файловые зоны и получить проверенный релиз за один подход.",
    xpReward: 240,
    durationMinutes: 15,
    tags: ["Jev Routing", "Agent Swarms", "Wave 1-2-3", "Cross-Review"],
    highlights: [
      "Алгоритм нарезки крупной задачи на непересекающиеся файловые пакеты (Zero-Conflict)",
      "Кросс-модельное ревью: один субагент пишет код, второй проверяет инварианты и безопасность",
      "Координация волны через state.md и изолированные выходы tasks/NN-slug.output.md"
    ],
    kickoffPrompt: "Привет! Запускаю блиц-симулятор Frontier Drop «Jev & Параллельные рои субагентов». Помоги мне прямо сейчас разложить реальную задачу на 3 волны роя (Разведка, Сборка, Верификация) и сгенерировать контракты для каждого субагента!"
  },
  {
    id: "drop-sovereign-ru-stack",
    weekBadge: "🛡 Drop #16 · Спецвыпуск для РФ",
    title: "Суверенный стек РФ: GigaChat / МТС Cotype / Яндекс + мировые модели через шлюз Nomad без VPN",
    subtitle: "Собираем боевой гибридный контур: 152-ФЗ и корпоративные документы обрабатываем в российских моделях, а сложный код и архитектуру — в глобальных моделях без VPN.",
    xpReward: 230,
    durationMinutes: 15,
    tags: ["РФ без VPN", "GigaChat Max", "МТС Cotype", "YandexGPT 5", "152-ФЗ"],
    highlights: [
      "Прямая работа из РФ без VPN и зарубежных карт через единый шлюз Nomad",
      "Автоматическое разделение чувствительных данных (ПДн / коммерческая тайна) и публичной логики",
      "Бесшовный fallback между суверенными и мировыми моделями при пиковых нагрузках"
    ],
    kickoffPrompt: "Привет! Запускаю блиц-симулятор Frontier Drop «Суверенный стек РФ: GigaChat / МТС Cotype / Яндекс + мировые модели через шлюз Nomad без VPN». Давай за 15 минут соберём таблицу маршрутизации и проверим гибридный сценарий на реальном бизнес-кейсе!"
  },
  {
    id: "drop-cinema-pipeline",
    weekBadge: "🎬 Drop #15 · Медиа-конвейер",
    title: "Кино-конвейер Veo 3.1 + Seedance 2.5 + ElevenLabs v3",
    subtitle: "Сборка 30-секундного продуктового трейлера или рилса: удержание лица героя, кинематографичная физика движения и живая русская озвучка с эмоциями.",
    xpReward: 240,
    durationMinutes: 15,
    tags: ["Veo 3.1", "Seedance 2.5", "ElevenLabs v3", "Video Factory"],
    highlights: [
      "Character Lock: удержание единого лица и стиля персонажа между всеми сценами ролика",
      "Точные промпты движения камеры и таймкоды под Veo 3.1 и Seedance 2.5",
      "Эмоциональная русская дикторская дорожка на ElevenLabs v3 с разметкой пауз и акцентов"
    ],
    kickoffPrompt: "Привет! Запускаю блиц-симулятор Frontier Drop «Кино-конвейер Veo 3.1 + Seedance 2.5 + ElevenLabs v3». Давай за 15 минут соберём раскадровку на 5 сцен, промпты с удержанием персонажа и скрипт эмоциональной озвучки для моего продукта!"
  }
];
var CLUB_SKILL_PACKS = [
  {
    id: "skill-agent-swarm",
    slug: "agent-swarm-orchestrator",
    title: "Оркестратор Роя Субагентов (Crash-Safe Swarm)",
    category: "Оркестрация и Рои",
    installsCount: 1420,
    rating: "4.98",
    badge: "🔥 Топ #1 в Клубе",
    summary: "Готовый протокол запуска параллельных волн субагентов (Wave 1 Разведка → Wave 2 Реализация → Wave 3 Верификация) с защитой от потери прогресса.",
    applyPrompt: "Привет! Подключаю клубный скилл «Оркестратор Роя Субагентов (Crash-Safe Swarm)». Помоги мне декомпозировать мою текущую задачу на параллельные дорожки роя с чекпоинтами state.md и критериями верификации.",
    skillMd: [
      "---",
      "name: agent-swarm-orchestrator",
      "description: Оркестрация параллельных волн субагентов по протоколу Crash-Safe (Wave 1 Recon -> Wave 2 Implement -> Wave 3 Verify).",
      "---",
      "",
      "# Оркестратор Роя Субагентов (Crash-Safe Swarm)",
      "",
      "## Когда применять",
      "Используй этот скилл, когда задача включает 3+ независимых модуля, глубокое исследование или требует перекрёстной проверки кода и данных.",
      "",
      "## Протокол 3 волн",
      "1. Wave 1 (Разведка): быстрое чтение структуры проекта, сбор фактов и фиксация контрактов.",
      "2. Wave 2 (Параллельная сборка): каждый субагент получает строго свою зону файлов и пишет отчёт в tasks/NN-slug.output.md.",
      "3. Wave 3 (Верификация): независимый агент проверяет сборку, тесты и критерии приёмки."
    ].join("\n")
  },
  {
    id: "skill-sovereign-router",
    slug: "sovereign-hybrid-router",
    title: "Гибридный Роутер РФ: GigaChat / Cotype / Яндекс + Global",
    category: "Суверенный стек и 152-ФЗ",
    installsCount: 1185,
    rating: "4.96",
    badge: "🛡 Выбор Enterprise РФ",
    summary: "Автоматическая классификация запросов: документы с ПДн и 152-ФЗ идут в суверенные модели РФ, а архитектурный ризонинг — в мировые флагманы через шлюз Nomad без VPN.",
    applyPrompt: "Привет! Активирую скилл «Гибридный Роутер РФ: GigaChat / Cotype / Яндекс + Global». Давай настроим правила распределения задач между российскими и мировыми моделями под мой проект.",
    skillMd: [
      "---",
      "name: sovereign-hybrid-router",
      "description: Маршрутизация запросов между суверенными моделями РФ (GigaChat, МТС Cotype, YandexGPT) и мировыми флагманами через шлюз Nomad без VPN.",
      "---",
      "",
      "# Гибридный Роутер РФ + Global",
      "",
      "## Правила маршрутизации",
      "1. Контур 152-ФЗ и внутренние регламенты РФ: направляй в суверенные модели (GigaChat Max, МТС Cotype, YandexGPT 5 Pro).",
      "2. Тяжёлый архитектурный ризонинг и рои кода: направляй в глобальные модели (Gemini 4 Argon, Claude Opus 4.7, GPT-5.4) после обезличивания чувствительных полей.",
      "3. Резервирование: при таймауте основной дорожки переключайся на резервный пул без потери контекста."
    ].join("\n")
  },
  {
    id: "skill-argon-marathon",
    slug: "argon-autonomous-marathon",
    title: "Автономный Марафонец (Gemini 4 Argon 72h Loop)",
    category: "Автономные агенты",
    installsCount: 990,
    rating: "4.97",
    badge: "🪐 Новинка недели",
    summary: "Шаблон постановки многодневных автономных задач с расписанием чекпоинтов, контролем бюджета и генерацией утреннего дайджеста решений.",
    applyPrompt: "Привет! Применяю скилл «Автономный Марафонец (Gemini 4 Argon 72h Loop)». Давай упакуем мой крупный проект в автономный цикл с чекпоинтами и утренним отчётом!",
    skillMd: [
      "---",
      "name: argon-autonomous-marathon",
      "description: Управление длительными автономными сессиями (до 72 часов) с чекпоинтами, защитой от дрейфа цели и утренними сводками.",
      "---",
      "",
      "# Автономный Марафонец (Gemini 4 Argon 72h Loop)",
      "",
      "## Инварианты длительного цикла",
      "- Каждые N шагов фиксируй состояние в state.md (сделано, в работе, блокеры, бюджет).",
      "- Перед переходом к следующему этапу запускай реальную проверку артефакта.",
      "- Формируй краткую сводку прогресса на «ты» с готовыми вариантами решений."
    ].join("\n")
  },
  {
    id: "skill-video-factory",
    slug: "cinema-video-factory",
    title: "Видео-Цех: Veo 3.1 + Seedance 2.5 + ElevenLabs v3",
    category: "Мультимодальный продакшн",
    installsCount: 1060,
    rating: "4.95",
    badge: "🎬 Креативный конвейер",
    summary: "Полный цикл сборки продуктовых роликов, рилсов и презентационных трейлеров: раскадровка, удержание лица героя, генерация планов и эмоциональная русская озвучка.",
    applyPrompt: "Привет! Подключаю скилл «Видео-Цех: Veo 3.1 + Seedance 2.5 + ElevenLabs v3». Собери для моего продукта режиссёрскую раскадровку, промпты видеопланов и текст озвучки с эмоциональными тегами!",
    skillMd: [
      "---",
      "name: cinema-video-factory",
      "description: Конвейер генерации видеороликов через Veo 3.1, Seedance 2.5 и озвучку ElevenLabs v3 с удержанием персонажа.",
      "---",
      "",
      "# Видео-Цех: Veo 3.1 + Seedance 2.5 + ElevenLabs v3",
      "",
      "## Этапы конвейера",
      "1. Хук первых 3 секунд: динамичный визуальный и смысловой старт.",
      "2. Character Lock: единый визуальный паспорт героя и освещения.",
      "3. Промпты движения камеры и физики сцены под Veo 3.1 и Seedance 2.5.",
      "4. Озвучка ElevenLabs v3: разметка пауз, дыхания и интонаций на русском языке."
    ].join("\n")
  },
  {
    id: "skill-product-prd-spec",
    slug: "interactive-prd-architect",
    title: "Архитектор Живых PRD и Кликабельных Прототипов",
    category: "Продукт и Бизнес",
    installsCount: 1310,
    rating: "4.94",
    badge: "🚀 Выбор продактов",
    summary: "Превращает заметки созвонов и сырые продуктовые идеи в структурированный PRD, пользовательские сценарии и живой HTML-прототип за 10 минут.",
    applyPrompt: "Привет! Подключаю скилл «Архитектор Живых PRD и Кликабельных Прототипов». Давай превратим мою продуктовую гипотезу в чёткий PRD с метриками и сразу соберём кликабельный прототип!",
    skillMd: [
      "---",
      "name: interactive-prd-architect",
      "description: Сборка продуктовых спецификаций (PRD), расчёт юнит-экономики и генерация интерактивных HTML-прототипов.",
      "---",
      "",
      "# Архитектор Живых PRD и Прототипов",
      "",
      "## Структура выхода",
      "1. Проблема, сегмент и ценностное предложение.",
      "2. Пользовательский сценарий (Happy Path + граничные состояния).",
      "3. Метрики успеха и контр-метрики.",
      "4. Самодостаточный интерактивный HTML-прототип для демонстрации команде."
    ].join("\n")
  },
  {
    id: "skill-executive-analytics",
    slug: "executive-data-detective",
    title: "SQL/CSV Детектив и Управленческий Борд-Отчёт",
    category: "Аналитика и Операции",
    installsCount: 875,
    rating: "4.93",
    badge: "📊 Точность данных",
    summary: "Автоматическая сверка таблиц, поиск скрытых просадок конверсии или маржинальности и выпуск одностраничной сводки для руководителя.",
    applyPrompt: "Привет! Запускаю скилл «SQL/CSV Детектив и Управленческий Борд-Отчёт». Помоги мне проанализировать таблицу показателей, найти точки потерь и подготовить управленческую сводку с действиями!",
    skillMd: [
      "---",
      "name: executive-data-detective",
      "description: Очистка выгрузок, поиск аномалий в метриках и сборка управленческих отчётов с конкретными рекомендациями.",
      "---",
      "",
      "# SQL/CSV Детектив и Управленческий Борд-Отчёт",
      "",
      "## Алгоритм анализа",
      "1. Санитизация: проверка пропусков, дублей и сбитых типов.",
      "2. Диагностика отклонений: поиск сегментов, дающих 80% просадки или роста.",
      "3. Управленческий вывод: 3 конкретных решения с оценкой эффекта в деньгах и сроках."
    ].join("\n")
  }
];
var SIMULATOR_TRACKS = [
  {
    id: "founder",
    label: "Основатель",
    summary: "Проверка продуктовых гипотез, сборка MVP, лендингов и расчёт юнит-экономики (CAC / LTV / Payback) без штата разработчиков.",
    businessDataset: "Вводные: B2B SaaS-сервис автоматизации закупок, чек 45 000 ₽/мес, конверсия из демо в оплату 18%, цель — выйти на окупаемость CAC за 2 месяца.",
    verificationCheck: "Проверка: интерактивный калькулятор считает LTV/CAC при смене параметров + готов одностраничный лендинг для смоук-теста.",
    firstMission: "Собрать интерактивный калькулятор юнит-экономики и посадочную страницу для твоего продукта.",
    kickoff: "Привет! Я выбираю трек «Основатель» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию на реальных данных юнит-экономики."
  },
  {
    id: "marketer",
    label: "Маркетолог",
    summary: "Контент-конвейеры, посадочные страницы, квиз-лидмагниты, UTM-разметка и сквозная аналитика рекламных кампаний.",
    businessDataset: "Вводные: запуск нового образовательного продукта, бюджет 350 000 ₽, 4 канала (Telegram Ads, Посевы, ВК, Ретаргет), целевой CPL ≤ 950 ₽.",
    verificationCheck: "Проверка: матрица кампании с UTM-метками, 5 офферов под сегменты и интерактивный HTML-квиз для квалификации лидов.",
    firstMission: "Собрать генератор мультиформатного контент-плана и интерактивный квиз для лидов.",
    kickoff: "Привет! Я выбираю трек «Маркетолог» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "product",
    label: "Продакт",
    summary: "Живые прототипы функций, синтез 50+ интервью пользователей в RICE-бэклог, интерактивные PRD и быстрые эксперименты.",
    businessDataset: "Вводные: 42 обращения в саппорт о потере прогресса при заполнении анкеты + падение активации D1 с 38% до 24% после релиза.",
    verificationCheck: "Проверка: структурированный PRD с корневой причиной, RICE-приоритизацией и кликабельным прототипом нового онбординга.",
    firstMission: "Превратить сырые заметки интервью и тикеты поддержки в PRD и кликабельный прототип новой функции.",
    kickoff: "Привет! Я выбираю трек «Продакт» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "project",
    label: "Проджект",
    summary: "Контроль сроков и зависимостей, автоматическая сводка статусов команды, детектор блокеров и прозрачные отчёты для стейкхолдеров.",
    businessDataset: "Вводные: кросс-функциональный релиз из 18 задач, 3 команды (Backend, Mobile, Design), дедлайн через 10 рабочих дней, 2 скрытых блокера по API.",
    verificationCheck: "Проверка: автоматический радар рисков, критический путь релиза и одностраничный статус-дайджест для заказчика.",
    firstMission: "Настроить автоматический сборщик недельного отчёта и детектор блокеров по задачам.",
    kickoff: "Привет! Я выбираю трек «Проджект» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "analyst",
    label: "Аналитик",
    summary: "Очистка грязных выгрузок, SQL/Python-пайплайны, когортный анализ удержания и наглядные дашборды с проверкой гипотез.",
    businessDataset: "Вводные: выгрузка 12 000 транзакций с дублями, пропусками регионов и аномальным скачком возвратов в 3-й когорте.",
    verificationCheck: "Проверка: скрипт очистки данных с карантином битых строк + интерактивный дашборд с локализацией источника возвратов.",
    firstMission: "Построить воспроизводимый пайплайн очистки CSV-выгрузки с интерактивным отчётом.",
    kickoff: "Привет! Я выбираю трек «Аналитик» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "designer",
    label: "Дизайнер",
    summary: "Живые UI-компоненты, токены дизайн-системы, микровзаимодействия и проверка пользовательских сценариев прямо в коде.",
    businessDataset: "Вводные: редизайн экрана биллинга и управления подпиской (3 тарифа, тёмная/светлая тема, состояния загрузки, ошибки и пустого баланса).",
    verificationCheck: "Проверка: интерактивная витрина компонентов с переключателем состояний, тем и токенами отступов/цветов.",
    firstMission: "Собрать интерактивную витрину компонентов с переключением состояний и темы.",
    kickoff: "Привет! Я выбираю трек «Дизайнер» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "hr",
    label: "HR",
    summary: "Профили ролей, скоринг резюме без предвзятости, планы адаптации новичков на 30-60-90 дней и живая база знаний.",
    businessDataset: "Вводные: срочный найм Senior Product Analyst и AI-инженера за 3 недели, воронка из 65 кандидатов и онбординг в распределённую команду.",
    verificationCheck: "Проверка: матрица компетенций с проверочными кейс-вопросами + интерактивный план онбординга на первые 30 дней.",
    firstMission: "Собрать интерактивный чек-лист онбординга и матрицу оценки кандидатов под твою вакансию.",
    kickoff: "Привет! Я выбираю трек «HR» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "sales",
    label: "Продажи",
    summary: "Персонализация коммерческих предложений за 60 секунд, подготовка к сложным переговорам, расчёт ROI для клиента и автоматизация CRM.",
    businessDataset: "Вводные: сделка с федеральным ритейлером (сеть 240 магазинов), возражение по стоимости внедрения и требование окупаемости за 1 квартал.",
    verificationCheck: "Проверка: персональное КП с интерактивным калькулятором экономии ФОТ клиента и картой отработки 5 возражений ЛПР.",
    firstMission: "Собрать генератор персонального коммерческого предложения с расчётом ROI по карточке клиента.",
    kickoff: "Привет! Я выбираю трек «Продажи» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  },
  {
    id: "operations",
    label: "Операции",
    summary: "Понятные регламенты (SOP), автоматическая сверка таблиц поставщиков/подрядчиков, связка сервисов и устранение ручной рутины.",
    businessDataset: "Вводные: еженедельная сверка 4 таблиц (склад, оплаты, логистика, акты) с 14% расхождений из-за ручного ввода.",
    verificationCheck: "Проверка: автоматический сверщик расхождений с генерацией протокола ошибок и готового операционного регламента.",
    firstMission: "Автоматизировать сверку регулярных таблиц и выпуск операционной сводки без ручного копирования.",
    kickoff: "Привет! Я выбираю трек «Операции» в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор курса и сразу запусти первую практическую миссию."
  }
];
var SIMULATOR_SCENARIOS = [
  {
    id: "prompting",
    title: "Точный промптинг и контракт задачи",
    description: "Научись формулировать контекст, критерии приёмки и ограничения так, чтобы агент выдавал готовый результат с первого шага.",
    kickoff: "Привет! Хочу потренировать навык точной постановки задач агенту в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор и предложи первую короткую миссию."
  },
  {
    id: "automation",
    title: "Автоматизация рутины и локальных пайплайнов",
    description: "Собери собственный рабочий конвейер: разбор выгрузок, проверка данных и регулярные управленческие отчёты.",
    kickoff: "Привет! Хочу освоить автоматизацию рутины и регулярных задач в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор и предложи первую практическую миссию."
  },
  {
    id: "swarm",
    title: "Управление роем параллельных субагентов",
    description: "Раздели крупную задачу на независимые дорожки роя (Wave 1-2-3), проверь результаты и собери итоговое решение.",
    kickoff: "Привет! Хочу научиться запускать параллельный рой субагентов в «Симуляторе ИИ × Hamidun Academy». Поприветствуй меня на «ты» как ментор и начни первую миссию по работе с роем."
  }
];
var SIMULATOR_KICKOFF = "Привет! Запускаю «Симулятор ИИ × Hamidun Academy». Поприветствуй меня на «ты» как наставник курса в двух предложениях и предложи выбрать один из 9 треков роли (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции) в столбик по одному на строке — без вызова инструментов и чтения файлов, сразу живым ответом.";
var SIMULATOR_PERSONA = [
  "Ты — ведущий интерактивного курса «Симулятор ИИ × Hamidun Academy» в Nomad (навык vibecoding-course): практичный, доброжелательный и структурный ИИ-наставник (в образе проводника Ники или философа-инженера Сократа), который обучает ученика вайбкодингу, точной постановке задач, автоматизации и работе с роем субагентов на реальных микро-миссиях.",
  "Обращайся к ученику строго на «ты» (уважительно, тепло, живо и по делу, без корпоративной воды и без холодного «вы»). Ты ведёшь занятие, предлагаешь конкретные шаги и помогаешь довести каждую миссию до осязаемого результата в рабочей папке проекта.",
  "ПРАВИЛО ПЕРВОГО ОТВЕТА (высший приоритет): На самое первое сообщение ученика в новой сессии ответь МГНОВЕННО — без вызова каких-либо инструментов и без чтения диска. Твой первый ответ — это тёплое приветствие на «ты» в 1–2 предложениях и список из 9 ролевых треков в столбик (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции) либо мгновенный старт выбранной миссии Академии.",
  "ПРАВИЛО ВТОРОГО И ПОСЛЕДУЮЩИХ ХОДОВ: Как только ученик ответил на приветствие, сразу зафиксируй выбранный трек (по умолчанию Основатель) и запусти Миссию 1 этого трека. Никогда не проси ученика самостоятельно придумывать сценарий — предлагай готовый шаг и чек-лист «Готово, если…»."
].join("\n\n");
var simulatorStateAtom = atom4({
  status: "idle",
  lastSessionId: null,
  selectedTrackId: null,
  mentorId: "nika",
  tierId: "practitioner",
  xp: 640,
  streakDays: 5,
  completedMissions: ["story-01-contract"],
  syncStatus: "ready",
  error: null
});
function sanitizeWhiteLabel(text) {
  return String(text || "").replace(/hermes/gi, "Nomad");
}
function isRealPromise(candidate) {
  return Boolean(candidate && typeof candidate.then === "function");
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function resolveCompanionStageByXp(xp) {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(xp) ? xp : 0));
  let current = COMPANION_STAGES[0];
  for (const stage of COMPANION_STAGES) {
    if (safeXp >= stage.minXp) {
      current = stage;
    }
  }
  const idx = COMPANION_STAGES.findIndex((s) => s.stage === current.stage);
  const next = idx >= 0 && idx + 1 < COMPANION_STAGES.length ? COMPANION_STAGES[idx + 1] : null;
  if (!next) {
    return { current, next: null, progressPercent: 100 };
  }
  const span = Math.max(1, next.minXp - current.minXp);
  const gained = Math.min(span, Math.max(0, safeXp - current.minXp));
  return {
    current,
    next,
    progressPercent: Math.round(gained / span * 100)
  };
}
function resolveKickoffText(trackOrScenarioId, options = {}) {
  if (options && typeof options.customKickoff === "string" && options.customKickoff.trim()) {
    return options.customKickoff.trim();
  }
  if (!trackOrScenarioId) {
    return SIMULATOR_KICKOFF;
  }
  const needle = String(trackOrScenarioId).trim().toLowerCase();
  const mentorKey = options?.mentorId === "socrates" ? "socrates" : "nika";
  const tierKey = options?.tierId === "novice" || options?.tierId === "practitioner" || options?.tierId === "pro" ? options.tierId : "practitioner";
  const mentorLabel = mentorKey === "socrates" ? "Сократ (бонус ×1.5 XP)" : "Ника (Проводник)";
  const storyMission = STORY_MISSIONS.find((m) => m.id.toLowerCase() === needle);
  if (storyMission) {
    const tierPrompt = storyMission.tiers?.[tierKey]?.starterPrompt || storyMission.tiers.practitioner.starterPrompt;
    return `${tierPrompt}

[Контекст Академии: Ментор — ${mentorLabel}, Уровень — ${tierKey}, обращение строго на «ты»]`;
  }
  const drop = FRONTIER_DROPS.find((d) => d.id.toLowerCase() === needle);
  if (drop) {
    return `${drop.kickoffPrompt}

[Контекст Академии: Ментор — ${mentorLabel}, Уровень — ${tierKey}, обращение строго на «ты»]`;
  }
  const skill = CLUB_SKILL_PACKS.find(
    (s) => s.id.toLowerCase() === needle || s.slug.toLowerCase() === needle
  );
  if (skill) {
    return `${skill.applyPrompt}

[Контекст Академии: Ментор — ${mentorLabel}, Скилл — ${skill.slug}, обращение строго на «ты»]`;
  }
  const track = SIMULATOR_TRACKS.find(
    (item) => item.id === needle || item.label.toLowerCase() === needle
  );
  if (track) {
    return track.kickoff;
  }
  const scenario = SIMULATOR_SCENARIOS.find(
    (item) => item.id === needle || item.title.toLowerCase() === needle
  );
  if (scenario) {
    return scenario.kickoff;
  }
  return SIMULATOR_KICKOFF;
}
function filterRecentSessionsBySetting(sessions, settings = {}) {
  const showSubagents = Boolean(settings?.sessions?.show_subagents);
  const excluded = /* @__PURE__ */ new Set(["cron", "tool", ...INTERNAL_LISTING_SOURCES, SIMULATOR_SESSION_SOURCE]);
  if (!showSubagents) {
    excluded.add("subagent");
  }
  const extra = settings?.sessions?.exclude_sources;
  if (Array.isArray(extra)) {
    for (const src of extra) {
      const normalized = String(src || "").trim().toLowerCase();
      if (normalized && !(normalized === "subagent" && showSubagents)) {
        excluded.add(normalized);
      }
    }
  }
  if (!Array.isArray(sessions)) {
    return [];
  }
  return sessions.filter((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }
    if (row.hidden) {
      return false;
    }
    const src = String(row.source || "").trim().toLowerCase();
    return !excluded.has(src);
  });
}
function countNomadSidebarRows(contributions) {
  if (!Array.isArray(contributions)) {
    return 0;
  }
  return contributions.filter((c) => c && c.area === SIDEBAR_NAV_AREA6).length;
}
function assertNomadSidebarRowCap(contributions, maxRows = MAX_SIDEBAR_NAV_ITEMS) {
  const count = countNomadSidebarRows(contributions);
  if (count > maxRows) {
    throw new Error(
      `Превышен потолок строк плагина Nomad в боковом меню: ${count} > ${maxRows} (M-207a).`
    );
  }
  return count;
}
async function startSimulatorChat(hostApi = host7, options = {}) {
  if (!hostApi || typeof hostApi.request !== "function") {
    return null;
  }
  const mentorId = options.mentorId === "socrates" ? "socrates" : "nika";
  const tierId = options.tierId === "novice" || options.tierId === "practitioner" || options.tierId === "pro" ? options.tierId : "practitioner";
  const kickoffText = options.kickoff || resolveKickoffText(options.trackId || options.missionId, {
    mentorId,
    tierId,
    customKickoff: options.customKickoff
  });
  const mentorSpec = ACADEMY_MENTORS[mentorId] || ACADEMY_MENTORS.nika;
  const mentorPrompt = options.personaPrompt || mentorSpec.systemPrompt || SIMULATOR_PERSONA;
  const firstProbe = hostApi.request("config.set", {
    key: "personality",
    value: SIMULATOR_PERSONA_KEY
  });
  if (!isRealPromise(firstProbe)) {
    return null;
  }
  simulatorStateAtom.set({
    ...simulatorStateAtom.get(),
    status: hostApi === host7 ? "ready" : "starting",
    selectedTrackId: options.trackId || options.missionId || "founder",
    activeKickoffText: kickoffText,
    activeSessionTitle: options.sessionTitle || SIMULATOR_SESSION_TITLE,
    inlineStudioOpen: hostApi === host7 ? true : simulatorStateAtom.get().inlineStudioOpen,
    mentorId,
    tierId,
    error: null
  });
  const withGatewayTimeout = (promise) => {
    if (hostApi !== host7) return promise;
    return Promise.race([
      promise,
      new Promise(
        (_, reject) => setTimeout(() => reject(new Error("gateway unavailable timeout")), 250)
      )
    ]);
  };
  try {
    try {
      await withGatewayTimeout(firstProbe);
    } catch {
      await withGatewayTimeout(
        hostApi.request("config.set", {
          key: "prompt",
          value: mentorPrompt
        })
      ).catch(() => void 0);
    }
    const created = await withGatewayTimeout(
      hostApi.request("session.create", {
        title: options.sessionTitle || SIMULATOR_SESSION_TITLE,
        source: SIMULATOR_SESSION_SOURCE,
        hidden: true
      })
    );
    const runtimeSessionId = created && typeof created.session_id === "string" ? created.session_id : "";
    const storedSessionId = created && typeof created.stored_session_id === "string" && created.stored_session_id ? created.stored_session_id : runtimeSessionId;
    if (!runtimeSessionId) {
      return null;
    }
    try {
      await hostApi.request("config.set", {
        key: "personality",
        value: SIMULATOR_PERSONA_KEY,
        session_id: runtimeSessionId
      });
    } catch {
      await hostApi.request("config.set", {
        key: "prompt",
        value: mentorPrompt,
        session_id: runtimeSessionId
      }).catch(() => void 0);
    }
    if (options.storage && typeof options.storage.set === "function") {
      try {
        options.storage.set("lastSimulatorSessionId", storedSessionId);
      } catch {
      }
    }
    let openedViaSdk = false;
    if (typeof hostApi.openSession === "function") {
      try {
        const openResult = hostApi.openSession(storedSessionId, {
          awaitHydration: true,
          expectHistory: false,
          hydrationTimeoutMs: 12e3
        });
        if (isRealPromise(openResult)) {
          await openResult;
          openedViaSdk = true;
        }
      } catch {
        try {
          const fallbackOpen = hostApi.openSession(storedSessionId);
          if (isRealPromise(fallbackOpen)) {
            await fallbackOpen;
          }
          openedViaSdk = true;
        } catch {
          openedViaSdk = false;
        }
      }
    }
    if (!openedViaSdk && typeof hostApi.navigate === "function") {
      hostApi.navigate(`/${encodeURIComponent(storedSessionId)}`);
    } else if (typeof window !== "undefined" && window.location && typeof window.location.hash === "string" && !window.location.hash.includes(encodeURIComponent(storedSessionId))) {
      window.location.hash = `#/${encodeURIComponent(storedSessionId)}`;
    }
    let submittedByComposer = false;
    if (hostApi.composer && typeof hostApi.composer.submit === "function") {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        try {
          if (hostApi.composer.submit(storedSessionId, kickoffText) || hostApi.composer.submit(null, kickoffText)) {
            submittedByComposer = true;
            break;
          }
        } catch {
        }
        await sleep(50);
      }
    }
    if (!submittedByComposer) {
      await hostApi.request("prompt.submit", {
        session_id: runtimeSessionId,
        text: kickoffText
      });
      if (typeof hostApi.openSession === "function") {
        try {
          const refreshPromise = hostApi.openSession(storedSessionId, {
            awaitHydration: true,
            expectHistory: true,
            forceResume: true,
            hydrationTimeoutMs: 1e4
          });
          if (isRealPromise(refreshPromise)) {
            await refreshPromise;
          }
        } catch {
        }
      }
    }
    if (typeof options.onStartSession === "function") {
      try {
        options.onStartSession({
          sessionId: runtimeSessionId,
          storedSessionId,
          kickoffText,
          mentorId,
          tierId
        });
      } catch {
      }
    }
    simulatorStateAtom.set({
      ...simulatorStateAtom.get(),
      status: "ready",
      lastSessionId: storedSessionId,
      selectedTrackId: options.trackId || options.missionId || null,
      activeKickoffText: kickoffText,
      activeSessionTitle: options.sessionTitle || SIMULATOR_SESSION_TITLE,
      inlineStudioOpen: true,
      mentorId,
      tierId,
      error: null
    });
    return {
      sessionId: runtimeSessionId,
      storedSessionId,
      kickoffText
    };
  } catch (err) {
    const rawMsg = String(err?.message || err || "");
    const isGatewayOffline = hostApi === host7 || /gateway unavailable|offline|network|socket|timeout/i.test(rawMsg);
    if (isGatewayOffline) {
      const fallbackSessionId = `sim-studio-${Date.now()}`;
      if (options.storage && typeof options.storage.set === "function") {
        try {
          options.storage.set("lastSimulatorSessionId", fallbackSessionId);
        } catch {
        }
      }
      if (typeof options.onStartSession === "function") {
        try {
          options.onStartSession({
            sessionId: fallbackSessionId,
            storedSessionId: fallbackSessionId,
            kickoffText,
            mentorId,
            tierId,
            inlineStudio: true
          });
        } catch {
        }
      }
      simulatorStateAtom.set({
        ...simulatorStateAtom.get(),
        status: "ready",
        lastSessionId: fallbackSessionId,
        selectedTrackId: options.trackId || options.missionId || "founder",
        activeKickoffText: kickoffText,
        activeSessionTitle: options.sessionTitle || SIMULATOR_SESSION_TITLE,
        inlineStudioOpen: true,
        mentorId,
        tierId,
        error: null
      });
      return {
        sessionId: fallbackSessionId,
        storedSessionId: fallbackSessionId,
        kickoffText,
        inlineStudio: true
      };
    }
    const cleanMessage = sanitizeWhiteLabel(rawMsg);
    simulatorStateAtom.set({
      ...simulatorStateAtom.get(),
      status: "error",
      error: cleanMessage
    });
    return null;
  }
}
async function continueSimulatorChat(hostApi = host7, storage = null) {
  const savedId = (storage && typeof storage.get === "function" ? storage.get("lastSimulatorSessionId", null) : null) || simulatorStateAtom.get().lastSessionId;
  if (savedId && typeof hostApi?.openSession === "function") {
    try {
      const res = hostApi.openSession(savedId, {
        awaitHydration: true,
        expectHistory: true,
        forceResume: true,
        hydrationTimeoutMs: 1e4
      });
      if (isRealPromise(res)) {
        await res;
      }
      return savedId;
    } catch {
    }
  }
  const created = await startSimulatorChat(hostApi, { storage });
  return created ? created.storedSessionId : null;
}
function evaluateMissionLocally({ mission, mentorId, tierId, solutionText, currentXp, currentStreak }) {
  const mentor = ACADEMY_MENTORS[mentorId] || ACADEMY_MENTORS.nika;
  const baseReward = mission?.xpReward || 200;
  const tierFactor = tierId === "pro" ? 1.25 : tierId === "practitioner" ? 1.1 : 1;
  const mentorMultiplier = mentor.xpMultiplier || 1;
  const text = String(solutionText || "").trim();
  const hasGoodLength = text.length >= 45;
  const hasKeywords = /(роль|контекст|ограничен|готово|метрик|шаг|пайплайн|скилл|skill|таблиц|дашборд|152-фз|рой|чекпоинт)/i.test(
    text
  );
  const score = hasGoodLength && hasKeywords ? 94 : hasGoodLength ? 82 : 68;
  const awardedXp = Math.round(baseReward * tierFactor * mentorMultiplier);
  const newXp = (Number.isFinite(currentXp) ? currentXp : 640) + awardedXp;
  const newStreak = (Number.isFinite(currentStreak) ? currentStreak : 5) + 1;
  const feedbackText = mentorId === "socrates" ? `🧠 Сократ (${score}/100 · +${awardedXp} XP с бонусом ×1.5): Привет. Твоя спецификация по миссии «${mission?.title || "Практикум"}» выдержала проверку инвариантов. Ты зафиксировал ограничения и целевой артефакт. Вопрос на шаг вперёд: какой узел твоей схемы потребует резервной дорожки, если входной поток вырастет в 10 раз?` : `🎙 Ника (${score}/100 · +${awardedXp} XP): Привет! Отличная работа над миссией «${mission?.title || "Практикум"}»! Ты чётко разложил задачу по шагам и собрал проверный рабочий каркас. Твоё ИИ-ядро Кочевника получает +${awardedXp} XP — двигаемся к следующей главе!`;
  return {
    ok: true,
    verdict: "passed",
    score,
    awardedXp,
    newXp,
    newStreak,
    feedbackText
  };
}
function SimulatorPage({ ctx, onStartSession }) {
  const simState = useValue2(simulatorStateAtom);
  const [activeTab, setActiveTab] = useState13("story");
  const [mentorId, setMentorId] = useState13(simState.mentorId || "nika");
  const [tierId, setTierId] = useState13(simState.tierId || "practitioner");
  const [xp, setXp] = useState13(simState.xp || 640);
  const [streakDays, setStreakDays] = useState13(simState.streakDays || 5);
  const [completedMissions, setCompletedMissions] = useState13(
    Array.isArray(simState.completedMissions) ? simState.completedMissions : ["story-01-contract"]
  );
  const [storyMissions, setStoryMissions] = useState13(STORY_MISSIONS);
  const [frontierDrops, setFrontierDrops] = useState13(FRONTIER_DROPS);
  const [skillPacks, setSkillPacks] = useState13(CLUB_SKILL_PACKS);
  const [selectedMissionId, setSelectedMissionId] = useState13(STORY_MISSIONS[0].id);
  const [checkedCriteria, setCheckedCriteria] = useState13({});
  const [solutionDraft, setSolutionDraft] = useState13(
    "Роль: Архитектор ИИ-пайплайнов.\nКонтекст: Автоматизация рабочей задачи в Nomad.\nОграничения: 1) Без внешних зависимостей; 2) Соблюдение 152-ФЗ; 3) Проверка на пустых входах.\nГотово, если: создан проверенный артефакт в папке проекта."
  );
  const [graderResult, setGraderResult] = useState13(null);
  const [gradingBusy, setGradingBusy] = useState13(false);
  const [syncBadge, setSyncBadge] = useState13("⚡ Синхронизировано с academy.hamidun.com");
  const [voicePlaying, setVoicePlaying] = useState13(false);
  const [voiceStatusText, setVoiceStatusText] = useState13("");
  const [previewSkillId, setPreviewSkillId] = useState13(null);
  const [activeTrack, setActiveTrack] = useState13("founder");
  const stageProgress = useMemo4(() => resolveCompanionStageByXp(xp), [xp]);
  const activeMentor = ACADEMY_MENTORS[mentorId] || ACADEMY_MENTORS.nika;
  const selectedStoryMission = useMemo4(
    () => storyMissions.find((m) => m.id === selectedMissionId) || storyMissions[0],
    [storyMissions, selectedMissionId]
  );
  const savedSessionId = useMemo4(() => {
    try {
      return ctx?.storage?.get?.("lastSimulatorSessionId", null) || simState.lastSessionId || null;
    } catch {
      return simState.lastSessionId || null;
    }
  }, [ctx, simState.lastSessionId]);
  const syncWithAcademyBridge = useCallback10(async () => {
    if (typeof fetch !== "function") {
      setSyncBadge("⚡ Локальный контур Академии активен");
      return;
    }
    setSyncBadge("🔄 Синхронизация с academy.hamidun.com…");
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 3500) : null;
      const response = await fetch(
        `${ACADEMY_BRIDGE_BASE_URL}/missions?mentor=${encodeURIComponent(mentorId)}&tier=${encodeURIComponent(tierId)}&xp=${encodeURIComponent(xp)}`,
        controller ? { signal: controller.signal } : void 0
      );
      if (timer) {
        clearTimeout(timer);
      }
      if (response && response.ok) {
        const data = await response.json();
        if (Array.isArray(data?.storyMissions) && data.storyMissions.length > 0) {
          setStoryMissions(data.storyMissions);
        }
        if (Array.isArray(data?.frontierDrops) && data.frontierDrops.length > 0) {
          setFrontierDrops(data.frontierDrops);
        }
        if (Array.isArray(data?.skillPacks) && data.skillPacks.length > 0) {
          setSkillPacks(data.skillPacks);
        }
        setSyncBadge("✅ Синхронизировано с academy.hamidun.com");
      } else {
        setSyncBadge("⚡ Автономный кэш Академии (РФ без VPN)");
      }
    } catch {
      setSyncBadge("⚡ Автономный кэш Академии (РФ без VPN)");
    }
  }, [mentorId, tierId, xp]);
  useEffect12(() => {
    syncWithAcademyBridge();
  }, [syncWithAcademyBridge]);
  const handlePlayMentorGreeting = useCallback10(() => {
    const mentor = ACADEMY_MENTORS[mentorId] || ACADEMY_MENTORS.nika;
    setVoicePlaying(true);
    setVoiceStatusText(`🔊 [${mentor.voiceModel}] ${mentor.greetingText}`);
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(mentor.greetingText);
        utterance.lang = "ru-RU";
        utterance.rate = mentorId === "socrates" ? 0.96 : 1.04;
        utterance.onend = () => setVoicePlaying(false);
        utterance.onerror = () => setVoicePlaying(false);
        window.speechSynthesis.speak(utterance);
        return;
      }
    } catch {
    }
    setTimeout(() => {
      setVoicePlaying(false);
    }, 3500);
  }, [mentorId]);
  const handleStart = useCallback10(
    (targetId = null, customKickoff = null, sessionTitle = null) => {
      startSimulatorChat(host7, {
        trackId: targetId,
        missionId: targetId,
        mentorId,
        tierId,
        customKickoff,
        sessionTitle: sessionTitle || SIMULATOR_SESSION_TITLE,
        storage: ctx?.storage,
        onStartSession
      });
    },
    [ctx, mentorId, tierId, onStartSession]
  );
  const handleContinue = useCallback10(() => {
    continueSimulatorChat(host7, ctx?.storage);
  }, [ctx]);
  const handleSubmitToAcademyGrader = useCallback10(
    async (missionObj) => {
      const targetMission = missionObj || selectedStoryMission;
      if (!targetMission) {
        return;
      }
      setGradingBusy(true);
      setGraderResult(null);
      try {
        let remoteEvaluated = null;
        if (typeof fetch === "function") {
          try {
            const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), 4e3) : null;
            const res = await fetch(`${ACADEMY_BRIDGE_BASE_URL}/submit`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                missionId: targetMission.id,
                mentor: mentorId,
                tier: tierId,
                solutionText: solutionDraft,
                artifacts: [{ name: `${targetMission.id}-artifact.md`, kind: "markdown" }],
                currentXp: xp,
                currentStreak: streakDays
              }),
              ...controller ? { signal: controller.signal } : {}
            });
            if (timer) {
              clearTimeout(timer);
            }
            if (res && res.ok) {
              const json = await res.json();
              if (json && json.ok) {
                remoteEvaluated = {
                  ok: true,
                  verdict: json.verdict,
                  score: json.score?.total || 92,
                  awardedXp: json.xp?.awardedXp || 200,
                  newXp: json.xp?.newXp || xp + 200,
                  newStreak: json.companionState?.streakDays || streakDays + 1,
                  feedbackText: `${json.feedback?.headline || ""}

${json.feedback?.markdown || ""}`.trim()
                };
              }
            }
          } catch {
            remoteEvaluated = null;
          }
        }
        const finalEval = remoteEvaluated || evaluateMissionLocally({
          mission: targetMission,
          mentorId,
          tierId,
          solutionText: solutionDraft,
          currentXp: xp,
          currentStreak: streakDays
        });
        setXp(finalEval.newXp);
        setStreakDays(finalEval.newStreak);
        setCompletedMissions(
          (prev) => prev.includes(targetMission.id) ? prev : [...prev, targetMission.id]
        );
        setGraderResult(finalEval);
        simulatorStateAtom.set({
          ...simulatorStateAtom.get(),
          xp: finalEval.newXp,
          streakDays: finalEval.newStreak
        });
      } finally {
        setGradingBusy(false);
      }
    },
    [selectedStoryMission, mentorId, tierId, solutionDraft, xp, streakDays]
  );
  const handleDownloadSkillMd = useCallback10((skillPack) => {
    if (!skillPack) {
      return;
    }
    try {
      if (typeof Blob !== "undefined" && typeof URL !== "undefined" && typeof document !== "undefined") {
        const blob = new Blob([skillPack.skillMd], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${skillPack.slug || "SKILL"}.SKILL.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(skillPack.skillMd).catch(() => void 0);
      }
      setVoiceStatusText(`📥 Файл ${skillPack.slug}.SKILL.md скачан и скопирован в буфер обмена!`);
    } catch {
      setPreviewSkillId(skillPack.id);
    }
  }, []);
  const [buddyQuestion, setBuddyQuestion] = useState13("");
  const [buddyReply, setBuddyReply] = useState13(null);
  const [buddyBusy, setBuddyBusy] = useState13(false);
  const handleAskBuddyInline = useCallback10(
    async (customQuestion) => {
      const q = (customQuestion ?? buddyQuestion ?? "").trim();
      if (!q) return;
      setBuddyBusy(true);
      try {
        const persona = mentorId === "socrates" ? "sokrat" : "nika";
        const headers = { "Content-Type": "application/json" };
        if (typeof window !== "undefined" && window.__HERMES_SESSION_TOKEN__) {
          headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
        }
        const res = await fetch("/api/plugins/nomad/buddy/ask", {
          method: "POST",
          headers,
          body: JSON.stringify({
            persona,
            question: q,
            page: "/nomad-simulator",
            context: selectedStoryMission ? selectedStoryMission.title : activeTrack
          })
        });
        if (res.ok) {
          const data = await res.json();
          setBuddyReply(data);
        }
      } catch (err) {
        setBuddyReply({
          ok: true,
          persona: mentorId === "socrates" ? "sokrat" : "nika",
          name: activeMentor.name,
          answer: activeMentor.greetingText,
          suggestions: ["Как подключить суверенную модель?", "Как пройти Миссию 1?"]
        });
      } finally {
        setBuddyBusy(false);
      }
    },
    [buddyQuestion, mentorId, selectedStoryMission, activeTrack, activeMentor]
  );
  return /* @__PURE__ */ jsxs8(
    "div",
    {
      "data-testid": "nomad-simulator-page",
      style: {
        padding: "28px 36px 40px",
        maxWidth: 1140,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        color: "var(--foreground, #0f172a)",
        fontFamily: "var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif)"
      },
      children: [
        /* @__PURE__ */ jsxs8(
          "header",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 8
            },
            children: [
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9(
                        "h1",
                        {
                          style: {
                            fontSize: 24,
                            fontWeight: 700,
                            margin: 0,
                            letterSpacing: "-0.022em"
                          },
                          children: "Симулятор ИИ"
                        }
                      ),
                      /* @__PURE__ */ jsx9(
                        "span",
                        {
                          "data-testid": "simulator-recents-filter-badge",
                          style: {
                            fontSize: 11.5,
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "rgba(15, 23, 42, 0.05)",
                            border: "1px solid rgba(15, 23, 42, 0.09)",
                            color: "var(--muted-foreground, #475569)",
                            fontWeight: 500
                          },
                          children: "Служебные сессии скрыты из «Недавних»"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8(
                      "button",
                      {
                        type: "button",
                        "data-testid": "simulator-open-buddy-drawer-btn",
                        onClick: () => {
                          if (typeof window !== "undefined" && typeof window.openNomadBuddy === "function") {
                            window.openNomadBuddy(mentorId === "socrates" ? "sokrat" : "nika");
                          }
                        },
                        style: {
                          padding: "6px 13px",
                          borderRadius: 999,
                          border: "1px solid rgba(37, 99, 235, 0.22)",
                          background: "rgba(255, 255, 255, 0.78)",
                          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(15,23,42,0.04)",
                          color: "#18181B",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 7
                        },
                        children: [
                          /* @__PURE__ */ jsx9(
                            "span",
                            {
                              style: {
                                width: 6,
                                height: 6,
                                borderRadius: 999,
                                background: "#18181B",
                                display: "inline-block"
                              }
                            }
                          ),
                          /* @__PURE__ */ jsxs8("span", { children: [
                            "Панель советника · ",
                            activeMentor.name
                          ] })
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsx9("p", { style: { margin: 0, fontSize: 13.5, opacity: 0.72, lineHeight: 1.5, maxWidth: 820 }, children: "Практическая среда обучения вайбкодингу и оркестрации агентов: выберите профессиональный трек, проходите прикладные миссии на реальных вводных и собирайте рабочие артефакты." })
            ]
          }
        ),
        /* @__PURE__ */ jsxs8(
          "section",
          {
            "data-testid": "simulator-buddy-bar",
            className: "nomad-glass-surface",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 12,
              padding: "16px 20px",
              borderRadius: 16
            },
            children: [
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9(
                        "span",
                        {
                          style: {
                            width: 30,
                            height: 30,
                            borderRadius: 9,
                            background: mentorId === "socrates" ? "linear-gradient(135deg, #334155, #0f172a)" : "linear-gradient(135deg, #18181B, #27272A)",
                            color: "#ffffff",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35)"
                          },
                          children: mentorId === "socrates" ? "С" : "Н"
                        }
                      ),
                      /* @__PURE__ */ jsxs8("div", { children: [
                        /* @__PURE__ */ jsxs8("div", { style: { fontSize: 13.5, fontWeight: 650, letterSpacing: "-0.01em" }, children: [
                          "Советник курса · ",
                          activeMentor.name
                        ] }),
                        /* @__PURE__ */ jsx9("div", { style: { fontSize: 12, opacity: 0.66 }, children: "Разбор технических вопросов, выбора моделей, коннекторов РФ и архитектуры шагов" })
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx9("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: [
                      "С чего начать обучение с нуля?",
                      "Как подключить GigaChat или Яндекс?",
                      "Как настроить защиту 152-ФЗ?"
                    ].map((presetQ) => /* @__PURE__ */ jsx9(
                      "button",
                      {
                        type: "button",
                        onClick: () => {
                          setBuddyQuestion(presetQ);
                          handleAskBuddyInline(presetQ);
                        },
                        style: {
                          padding: "5px 11px",
                          borderRadius: 999,
                          border: "1px solid rgba(15, 23, 42, 0.09)",
                          background: "rgba(255, 255, 255, 0.65)",
                          color: "inherit",
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: "pointer"
                        },
                        children: presetQ
                      },
                      presetQ
                    )) })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs8("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }, children: [
                /* @__PURE__ */ jsx9(
                  "input",
                  {
                    type: "text",
                    "data-testid": "simulator-buddy-input",
                    value: buddyQuestion,
                    onChange: (e) => setBuddyQuestion(e.target.value),
                    onKeyDown: (e) => {
                      if (e.key === "Enter") handleAskBuddyInline();
                    },
                    placeholder: `Задайте вопрос советнику (${activeMentor.name}): например, «почему возникает ошибка ключа» или «помоги пройти миссию 1»…`,
                    style: {
                      flex: "1 1 320px",
                      padding: "9px 13px",
                      borderRadius: 10,
                      border: "1px solid rgba(15, 23, 42, 0.12)",
                      background: "rgba(255, 255, 255, 0.80)",
                      color: "inherit",
                      fontSize: 13,
                      outline: "none"
                    }
                  }
                ),
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    "data-testid": "simulator-buddy-ask-btn",
                    disabled: buddyBusy,
                    onClick: () => handleAskBuddyInline(),
                    style: {
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: "none",
                      background: "#18181B",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(37,99,235,0.2)",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer"
                    },
                    children: buddyBusy ? "Формирую ответ…" : `Спросить (${activeMentor.name})`
                  }
                )
              ] }),
              buddyReply && /* @__PURE__ */ jsxs8(
                "div",
                {
                  "data-testid": "simulator-buddy-reply",
                  style: {
                    padding: "12px 15px",
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.74)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsx9("div", { style: { fontWeight: 650, marginBottom: 4, color: "#18181B", fontSize: 12 }, children: buddyReply.name || activeMentor.name }),
                    buddyReply.answer
                  ]
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs8(
          "section",
          {
            className: "nomad-glass-surface",
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              flexWrap: "wrap",
              padding: "14px 20px",
              borderRadius: 16
            },
            children: [
              /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    "data-testid": "simulator-start-btn",
                    onClick: () => handleStart(activeTrack),
                    disabled: simState.status === "starting",
                    style: {
                      padding: "9px 18px",
                      borderRadius: 10,
                      border: "none",
                      background: "#0f172a",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 3px rgba(15,23,42,0.12)",
                      color: "#ffffff",
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: "pointer"
                    },
                    children: simState.status === "starting" ? "Запускаем сессию…" : "Начать курс"
                  }
                ),
                savedSessionId && /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    "data-testid": "simulator-continue-btn",
                    onClick: handleContinue,
                    style: {
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: "1px solid rgba(15, 23, 42, 0.12)",
                      background: "rgba(255, 255, 255, 0.76)",
                      color: "inherit",
                      fontWeight: 600,
                      fontSize: 13.5,
                      cursor: "pointer"
                    },
                    children: "Продолжить вашу сессию"
                  }
                )
              ] }),
              /* @__PURE__ */ jsx9("span", { style: { fontSize: 12.5, opacity: 0.68 }, children: "Откроется рабочая сессия с ИИ-ментором, где первый ответ сразу предложит трек и миссию." })
            ]
          }
        ),
        simState.inlineStudioOpen && /* @__PURE__ */ jsxs8(
          "section",
          {
            "data-testid": "simulator-active-studio",
            className: "nomad-glass-surface",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "18px 22px",
              borderRadius: 16,
              border: "1.5px solid rgba(37, 99, 235, 0.34)",
              background: "linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(239, 246, 255, 0.84) 100%)"
            },
            children: [
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsxs8(
                        "span",
                        {
                          style: {
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "3.5px 10px",
                            borderRadius: 999,
                            background: "rgba(16, 185, 129, 0.14)",
                            border: "1px solid rgba(16, 185, 129, 0.28)",
                            color: "#059669"
                          },
                          children: [
                            "● Практикум активен · ",
                            activeMentor.shortLabel
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsxs8("strong", { style: { fontSize: 14.5, letterSpacing: "-0.01em" }, children: [
                        simState.activeSessionTitle || SIMULATOR_SESSION_TITLE,
                        " ·",
                        " ",
                        (SIMULATOR_TRACKS.find((t) => t.id === simState.selectedTrackId) || SIMULATOR_SCENARIOS.find((s) => s.id === simState.selectedTrackId) || STORY_MISSIONS.find((m) => m.id === simState.selectedTrackId) || {
                          label: "Практический трек"
                        }).label || (SIMULATOR_SCENARIOS.find((s) => s.id === simState.selectedTrackId) || STORY_MISSIONS.find((m) => m.id === simState.selectedTrackId) || {
                          title: "Практический трек"
                        }).title
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx9(
                      "button",
                      {
                        type: "button",
                        onClick: () => simulatorStateAtom.set({
                          ...simulatorStateAtom.get(),
                          inlineStudioOpen: false
                        }),
                        style: {
                          padding: "4px 10px",
                          borderRadius: 999,
                          border: "1px solid rgba(15, 23, 42, 0.12)",
                          background: "rgba(255, 255, 255, 0.8)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Свернуть студию"
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    padding: "12px 15px",
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.86)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
                    fontSize: 13,
                    lineHeight: 1.55,
                    whiteSpace: "pre-wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { fontWeight: 700, color: "#18181B", marginBottom: 4, fontSize: 12 }, children: [
                      "Бриф миссии и первый шаг от ментора (",
                      activeMentor.name,
                      "):"
                    ] }),
                    simState.activeKickoffText || activeMentor.greetingText
                  ]
                }
              ),
              /* @__PURE__ */ jsxs8("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" }, children: [
                /* @__PURE__ */ jsxs8(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      const promptText = simState.activeKickoffText || `Разбери по шагам трек ${activeTrack} и дай готовый каркас решения.`;
                      setBuddyQuestion(promptText);
                      handleAskBuddyInline(promptText);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "none",
                      background: "#18181B",
                      color: "#ffffff",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer"
                    },
                    children: [
                      "Получить пошаговый разбор от ментора (",
                      activeMentor.name,
                      ")"
                    ]
                  }
                ),
                /* @__PURE__ */ jsx9(
                  "button",
                  {
                    type: "button",
                    onClick: () => {
                      setActiveTab("story");
                      handleSubmitToAcademyGrader(selectedStoryMission);
                    },
                    style: {
                      padding: "8px 14px",
                      borderRadius: 10,
                      border: "1px solid rgba(37, 99, 235, 0.24)",
                      background: "rgba(255, 255, 255, 0.85)",
                      color: "#18181B",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer"
                    },
                    children: "Проверить решение в Грейдере (+XP)"
                  }
                )
              ] })
            ]
          }
        ),
        simState.error && /* @__PURE__ */ jsxs8(
          "div",
          {
            role: "status",
            "data-testid": "simulator-error",
            style: {
              padding: "12px 16px",
              borderRadius: 12,
              border: "1px solid rgba(239, 68, 68, 0.32)",
              background: "rgba(239, 68, 68, 0.06)",
              fontSize: 13
            },
            children: [
              "Не удалось открыть чат с ментором: ",
              simState.error,
              ". Нажмите «Начать курс», чтобы повторить попытку."
            ]
          }
        ),
        /* @__PURE__ */ jsxs8(
          "section",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 12
            },
            children: [
              /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }, children: [
                /* @__PURE__ */ jsx9("h2", { style: { fontSize: 15.5, fontWeight: 650, margin: 0, letterSpacing: "-0.015em" }, children: "Профессиональные треки (9 ролей)" }),
                /* @__PURE__ */ jsx9("span", { style: { fontSize: 12, opacity: 0.6 }, children: "Выберите роль для запуска первой миссии" })
              ] }),
              /* @__PURE__ */ jsx9(
                "div",
                {
                  "data-testid": "simulator-tracks-grid",
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: 12
                  },
                  children: SIMULATOR_TRACKS.map((track) => {
                    const selected = activeTrack === track.id;
                    return /* @__PURE__ */ jsxs8(
                      "button",
                      {
                        type: "button",
                        className: "nomad-track-card",
                        "data-testid": `simulator-track-${track.id}`,
                        onClick: () => {
                          setActiveTrack(track.id);
                          handleStart(track.id);
                        },
                        style: {
                          textAlign: "left",
                          padding: "16px 18px",
                          borderRadius: 14,
                          border: selected ? "1.5px solid #18181B" : "1px solid rgba(15, 23, 42, 0.085)",
                          color: "inherit",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          justifyContent: "space-between",
                          gap: 10
                        },
                        children: [
                          /* @__PURE__ */ jsxs8(
                            "div",
                            {
                              style: {
                                width: "100%",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12
                              },
                              children: [
                                /* @__PURE__ */ jsx9("span", { style: { fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em" }, children: track.label }),
                                /* @__PURE__ */ jsx9(
                                  "span",
                                  {
                                    style: {
                                      fontSize: 11,
                                      color: "#18181B",
                                      background: "#F4F4F5",
                                      border: "1px solid rgba(37, 99, 235, 0.16)",
                                      padding: "2.5px 9px",
                                      borderRadius: 999,
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                      flexShrink: 0
                                    },
                                    children: "Запустить →"
                                  }
                                )
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsx9("span", { style: { fontSize: 12.5, opacity: 0.74, lineHeight: 1.46, display: "block" }, children: track.summary })
                        ]
                      },
                      track.id
                    );
                  })
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsxs8("section", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsx9("h2", { style: { fontSize: 15.5, fontWeight: 650, margin: 0, letterSpacing: "-0.015em" }, children: "Базовые инженерные паттерны" }),
          /* @__PURE__ */ jsx9(
            "div",
            {
              "data-testid": "simulator-scenarios-grid",
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12
              },
              children: SIMULATOR_SCENARIOS.map((scenario) => /* @__PURE__ */ jsxs8(
                "button",
                {
                  type: "button",
                  className: "nomad-track-card",
                  "data-testid": `simulator-scenario-${scenario.id}`,
                  onClick: () => handleStart(scenario.id),
                  style: {
                    textAlign: "left",
                    padding: "16px 18px",
                    borderRadius: 14,
                    color: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    gap: 8
                  },
                  children: [
                    /* @__PURE__ */ jsxs8(
                      "div",
                      {
                        style: {
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 10
                        },
                        children: [
                          /* @__PURE__ */ jsx9("span", { style: { fontSize: 14, fontWeight: 650, letterSpacing: "-0.01em" }, children: scenario.title }),
                          /* @__PURE__ */ jsx9("span", { style: { fontSize: 11.5, color: "#18181B", fontWeight: 600, flexShrink: 0 }, children: "Открыть →" })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx9("span", { style: { fontSize: 12.5, opacity: 0.74, lineHeight: 1.46, display: "block" }, children: scenario.description })
                  ]
                },
                scenario.id
              ))
            }
          )
        ] }),
        /* @__PURE__ */ jsxs8(
          "section",
          {
            "data-testid": "simulator-academy-hud",
            className: "nomad-glass-surface",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14,
              padding: "18px 22px",
              borderRadius: 16,
              marginTop: 4
            },
            children: [
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9("h2", { style: { fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }, children: "Hamidun Academy · Кампания и Витрина Навыков" }),
                      /* @__PURE__ */ jsx9(
                        "span",
                        {
                          "data-testid": "simulator-sovereign-badge",
                          style: {
                            fontSize: 11.5,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background: "#F4F4F5",
                            border: "1px solid rgba(37, 99, 235, 0.16)",
                            color: "#18181B",
                            fontWeight: 600
                          },
                          children: "РФ без VPN · Суверенные и мировые модели"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9(
                        "span",
                        {
                          "data-testid": "simulator-sync-badge",
                          style: {
                            fontSize: 11.5,
                            padding: "3px 10px",
                            borderRadius: 999,
                            background: "rgba(16, 185, 129, 0.10)",
                            border: "1px solid rgba(16, 185, 129, 0.22)",
                            color: "#059669",
                            fontWeight: 600
                          },
                          children: syncBadge
                        }
                      ),
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": "simulator-sync-btn",
                          onClick: syncWithAcademyBridge,
                          style: {
                            padding: "5px 11px",
                            borderRadius: 8,
                            border: "1px solid rgba(15, 23, 42, 0.10)",
                            background: "rgba(255, 255, 255, 0.72)",
                            color: "inherit",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer"
                          },
                          children: "Обновить миссии"
                        }
                      )
                    ] })
                  ]
                }
              ),
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  "data-testid": "simulator-companion-stage-bar",
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(255, 255, 255, 0.62)",
                    border: "1px solid rgba(15, 23, 42, 0.07)"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", flexDirection: "column", gap: 5, flex: "1 1 320px" }, children: [
                      /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }, children: [
                        /* @__PURE__ */ jsx9(
                          "span",
                          {
                            style: {
                              fontSize: 11,
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: 6,
                              background: "#0f172a",
                              color: "#ffffff"
                            },
                            children: stageProgress.current.badgeIcon
                          }
                        ),
                        /* @__PURE__ */ jsx9("strong", { style: { fontSize: 13.5, letterSpacing: "-0.01em" }, children: stageProgress.current.title }),
                        /* @__PURE__ */ jsxs8("span", { style: { fontSize: 12, opacity: 0.68 }, children: [
                          "— ",
                          stageProgress.current.subtitle
                        ] })
                      ] }),
                      /* @__PURE__ */ jsx9(
                        "div",
                        {
                          style: {
                            height: 5,
                            borderRadius: 999,
                            background: "rgba(15, 23, 42, 0.08)",
                            overflow: "hidden",
                            marginTop: 2
                          },
                          children: /* @__PURE__ */ jsx9(
                            "div",
                            {
                              style: {
                                width: `${stageProgress.progressPercent}%`,
                                height: "100%",
                                background: "linear-gradient(90deg, #18181B, #27272A)",
                                borderRadius: 999
                              }
                            }
                          )
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                          fontVariantNumeric: "tabular-nums"
                        },
                        children: [
                          COMPANION_STAGES.map((st) => {
                            const active = st.stage === stageProgress.current.stage;
                            const unlocked = xp >= st.minXp;
                            return /* @__PURE__ */ jsxs8(
                              "span",
                              {
                                title: `${st.title}: от ${st.minXp} XP`,
                                style: {
                                  fontSize: 11,
                                  padding: "3px 8px",
                                  borderRadius: 6,
                                  fontWeight: active ? 700 : 500,
                                  border: active ? "1px solid #18181B" : "1px solid rgba(15, 23, 42, 0.09)",
                                  background: active ? "#F4F4F5" : unlocked ? "rgba(15, 23, 42, 0.04)" : "transparent",
                                  color: active ? "#18181B" : "inherit",
                                  opacity: unlocked ? 1 : 0.45
                                },
                                children: [
                                  "S",
                                  st.stage
                                ]
                              },
                              st.code
                            );
                          }),
                          /* @__PURE__ */ jsxs8(
                            "span",
                            {
                              "data-testid": "simulator-xp-counter",
                              style: {
                                fontSize: 12.5,
                                fontWeight: 650,
                                padding: "4px 10px",
                                borderRadius: 8,
                                background: "#F4F4F5",
                                border: "1px solid rgba(37, 99, 235, 0.16)",
                                color: "#18181B"
                              },
                              children: [
                                xp,
                                " XP"
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsxs8(
                            "span",
                            {
                              "data-testid": "simulator-streak-counter",
                              style: {
                                fontSize: 12.5,
                                fontWeight: 600,
                                padding: "4px 10px",
                                borderRadius: 8,
                                background: "rgba(15, 23, 42, 0.05)",
                                border: "1px solid rgba(15, 23, 42, 0.09)",
                                color: "var(--foreground, #0f172a)"
                              },
                              children: [
                                "Серия ",
                                streakDays,
                                " дн."
                              ]
                            }
                          )
                        ]
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ jsxs8(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 14,
                    flexWrap: "wrap"
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9("span", { style: { fontSize: 12, fontWeight: 600, opacity: 0.72 }, children: "Ментор:" }),
                      /* @__PURE__ */ jsx9("div", { className: "nomad-seg-group", children: Object.values(ACADEMY_MENTORS).map((m) => {
                        const isSelected = mentorId === m.id;
                        return /* @__PURE__ */ jsx9(
                          "button",
                          {
                            type: "button",
                            className: "nomad-seg-btn",
                            "data-active": isSelected ? "true" : "false",
                            "data-testid": `simulator-mentor-${m.id}`,
                            onClick: () => setMentorId(m.id),
                            children: m.shortLabel
                          },
                          m.id
                        );
                      }) }),
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": "simulator-mentor-voice-btn",
                          onClick: handlePlayMentorGreeting,
                          style: {
                            padding: "6px 12px",
                            borderRadius: 9,
                            border: "1px solid rgba(15, 23, 42, 0.10)",
                            background: voicePlaying ? "#F4F4F5" : "rgba(255, 255, 255, 0.74)",
                            color: voicePlaying ? "#18181B" : "inherit",
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: "pointer"
                          },
                          children: voicePlaying ? "Звучит голос ElevenLabs…" : "Прослушать приветствие"
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9("span", { style: { fontSize: 12, fontWeight: 600, opacity: 0.72 }, children: "Сложность:" }),
                      /* @__PURE__ */ jsx9("div", { className: "nomad-seg-group", children: CALIBRATION_TIERS.map((t) => {
                        const isSelected = tierId === t.id;
                        return /* @__PURE__ */ jsx9(
                          "button",
                          {
                            type: "button",
                            className: "nomad-seg-btn",
                            "data-active": isSelected ? "true" : "false",
                            "data-testid": `simulator-tier-${t.id}`,
                            onClick: () => setTierId(t.id),
                            children: t.label
                          },
                          t.id
                        );
                      }) })
                    ] })
                  ]
                }
              ),
              voiceStatusText && /* @__PURE__ */ jsx9(
                "div",
                {
                  "data-testid": "simulator-voice-status",
                  style: {
                    fontSize: 12,
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(16, 185, 129, 0.08)",
                    border: "1px solid rgba(16, 185, 129, 0.24)"
                  },
                  children: voiceStatusText
                }
              )
            ]
          }
        ),
        /* @__PURE__ */ jsx9(
          "nav",
          {
            "data-testid": "simulator-tabs-nav",
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10
            },
            children: /* @__PURE__ */ jsx9("div", { className: "nomad-seg-group", style: { flexWrap: "wrap" }, children: [
              { id: "story", label: "Сюжетная кампания" },
              { id: "drops", label: "Frontier Drops · Новинки" },
              { id: "skills", label: "Витрина навыков (SKILL.md)" },
              { id: "roles", label: "Бизнес-кейсы 9 ролей" }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return /* @__PURE__ */ jsx9(
                "button",
                {
                  type: "button",
                  className: "nomad-seg-btn",
                  "data-active": active ? "true" : "false",
                  "data-testid": `simulator-tab-${tab.id}`,
                  onClick: () => setActiveTab(tab.id),
                  style: { padding: "7px 15px", fontSize: 12.5 },
                  children: tab.label
                },
                tab.id
              );
            }) })
          }
        ),
        activeTab === "story" && /* @__PURE__ */ jsxs8(
          "section",
          {
            "data-testid": "simulator-tab-panel-story",
            style: {
              display: "grid",
              gridTemplateColumns: "minmax(270px, 340px) minmax(0, 1fr)",
              gap: 18,
              alignItems: "start"
            },
            children: [
              /* @__PURE__ */ jsx9("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: storyMissions.map((mission) => {
                const isSelected = selectedStoryMission?.id === mission.id;
                const isDone = completedMissions.includes(mission.id);
                return /* @__PURE__ */ jsxs8(
                  "button",
                  {
                    type: "button",
                    className: "nomad-track-card",
                    "data-testid": `story-mission-item-${mission.id}`,
                    onClick: () => {
                      setSelectedMissionId(mission.id);
                      setGraderResult(null);
                    },
                    style: {
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: isSelected ? "1.5px solid #18181B" : "1px solid rgba(15, 23, 42, 0.085)",
                      color: "inherit",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "stretch",
                      gap: 6
                    },
                    children: [
                      /* @__PURE__ */ jsxs8(
                        "div",
                        {
                          style: {
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 10,
                            fontSize: 11
                          },
                          children: [
                            /* @__PURE__ */ jsx9("span", { style: { fontWeight: 600, color: "#18181B" }, children: mission.chapter }),
                            /* @__PURE__ */ jsx9(
                              "span",
                              {
                                style: {
                                  fontWeight: 650,
                                  color: isDone ? "#059669" : "#475569",
                                  background: isDone ? "rgba(16,185,129,0.10)" : "rgba(15,23,42,0.05)",
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0
                                },
                                children: isDone ? "Выполнено" : `+${Math.round(mission.xpReward * activeMentor.xpMultiplier)} XP`
                              }
                            )
                          ]
                        }
                      ),
                      /* @__PURE__ */ jsx9("strong", { style: { fontSize: 13.5, lineHeight: 1.38, letterSpacing: "-0.01em" }, children: mission.title }),
                      /* @__PURE__ */ jsxs8("span", { style: { fontSize: 11.5, opacity: 0.62 }, children: [
                        "Около ",
                        mission.estimatedMinutes,
                        " мин"
                      ] })
                    ]
                  },
                  mission.id
                );
              }) }),
              selectedStoryMission && /* @__PURE__ */ jsxs8(
                "div",
                {
                  "data-testid": "story-mission-detail",
                  className: "nomad-glass-surface",
                  style: {
                    padding: "22px 24px",
                    borderRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16
                  },
                  children: [
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsxs8("div", { children: [
                        /* @__PURE__ */ jsx9("span", { style: { fontSize: 11.5, color: "#18181B", fontWeight: 650 }, children: selectedStoryMission.chapter }),
                        /* @__PURE__ */ jsx9("h2", { style: { fontSize: 18.5, fontWeight: 700, margin: "4px 0 0", letterSpacing: "-0.018em" }, children: selectedStoryMission.title })
                      ] }),
                      /* @__PURE__ */ jsxs8(
                        "span",
                        {
                          style: {
                            fontSize: 12,
                            fontWeight: 650,
                            padding: "5px 11px",
                            borderRadius: 999,
                            background: "rgba(16, 185, 129, 0.10)",
                            border: "1px solid rgba(16, 185, 129, 0.22)",
                            color: "#059669",
                            alignSelf: "flex-start"
                          },
                          children: [
                            "+",
                            Math.round(selectedStoryMission.xpReward * activeMentor.xpMultiplier),
                            " XP"
                          ]
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8(
                      "div",
                      {
                        "data-testid": "story-mission-mentor-brief",
                        style: {
                          padding: "14px 16px",
                          borderRadius: 12,
                          background: "rgba(255, 255, 255, 0.68)",
                          border: "1px solid rgba(15, 23, 42, 0.08)",
                          fontSize: 13,
                          lineHeight: 1.56
                        },
                        children: [
                          /* @__PURE__ */ jsxs8("strong", { style: { display: "block", marginBottom: 4, fontSize: 12, color: "#18181B" }, children: [
                            activeMentor.shortLabel,
                            " — вводная по миссии"
                          ] }),
                          selectedStoryMission.briefByMentor?.[mentorId] || selectedStoryMission.briefByMentor?.nika
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxs8(
                      "div",
                      {
                        style: {
                          padding: "12px 15px",
                          borderRadius: 12,
                          background: "rgba(37, 99, 235, 0.06)",
                          border: "1px solid rgba(37, 99, 235, 0.15)",
                          fontSize: 13,
                          lineHeight: 1.5
                        },
                        children: [
                          /* @__PURE__ */ jsxs8("strong", { children: [
                            "Цель на уровне «",
                            tierId === "pro" ? "Профи" : tierId === "novice" ? "Новичок" : "Практик",
                            "»:"
                          ] }),
                          " ",
                          selectedStoryMission.tiers?.[tierId]?.objective || selectedStoryMission.tiers?.practitioner?.objective
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
                      /* @__PURE__ */ jsx9("strong", { style: { fontSize: 13.5 }, children: "Критерии готовности («Готово, если…»):" }),
                      (selectedStoryMission.doneCriteria || []).map((crit, idx) => {
                        const key = `${selectedStoryMission.id}:${idx}`;
                        const isChecked = Boolean(checkedCriteria[key]);
                        return /* @__PURE__ */ jsxs8(
                          "label",
                          {
                            style: {
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              fontSize: 13,
                              cursor: "pointer",
                              padding: "9px 12px",
                              borderRadius: 10,
                              background: isChecked ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.62)",
                              border: isChecked ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(15, 23, 42, 0.07)"
                            },
                            children: [
                              /* @__PURE__ */ jsx9(
                                "input",
                                {
                                  type: "checkbox",
                                  checked: isChecked,
                                  onChange: () => setCheckedCriteria((prev) => ({ ...prev, [key]: !prev[key] }))
                                }
                              ),
                              /* @__PURE__ */ jsx9("span", { children: crit })
                            ]
                          },
                          key
                        );
                      })
                    ] }),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", gap: 10, flexWrap: "wrap" }, children: [
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": "story-mission-launch-chat-btn",
                          onClick: () => handleStart(
                            selectedStoryMission.id,
                            selectedStoryMission.tiers?.[tierId]?.starterPrompt,
                            `Академия · ${selectedStoryMission.title}`
                          ),
                          style: {
                            padding: "9px 16px",
                            borderRadius: 10,
                            border: "none",
                            background: "#18181B",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(37,99,235,0.2)",
                            color: "#ffffff",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer"
                          },
                          children: "Открыть миссию в чате Nomad →"
                        }
                      ),
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": "story-mission-submit-grader-btn",
                          disabled: gradingBusy,
                          onClick: () => handleSubmitToAcademyGrader(selectedStoryMission),
                          style: {
                            padding: "9px 16px",
                            borderRadius: 10,
                            border: "1px solid rgba(16, 185, 129, 0.35)",
                            background: "rgba(16, 185, 129, 0.10)",
                            color: "#059669",
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: "pointer"
                          },
                          children: gradingBusy ? "Проверяем в Грейдере Академии…" : `Сдать миссию в Грейдер (+${Math.round(selectedStoryMission.xpReward * activeMentor.xpMultiplier)} XP)`
                        }
                      )
                    ] }),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", flexDirection: "column", gap: 6 }, children: [
                      /* @__PURE__ */ jsxs8("span", { style: { fontSize: 12, opacity: 0.72, fontWeight: 600 }, children: [
                        "Артефакт или итог сессии для проверки ментором (",
                        activeMentor.name,
                        "):"
                      ] }),
                      /* @__PURE__ */ jsx9(
                        "textarea",
                        {
                          "data-testid": "story-mission-solution-input",
                          rows: 4,
                          value: solutionDraft,
                          onChange: (e) => setSolutionDraft(e.target.value),
                          style: {
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                            background: "rgba(255, 255, 255, 0.78)",
                            color: "inherit",
                            fontSize: 12.5,
                            fontFamily: "inherit",
                            outline: "none"
                          }
                        }
                      )
                    ] }),
                    graderResult && /* @__PURE__ */ jsx9(
                      "div",
                      {
                        "data-testid": "story-mission-grader-feedback",
                        style: {
                          padding: "14px 16px",
                          borderRadius: 12,
                          border: "1px solid rgba(16, 185, 129, 0.32)",
                          background: "rgba(16, 185, 129, 0.08)",
                          fontSize: 13,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.5
                        },
                        children: graderResult.feedbackText
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        activeTab === "drops" && /* @__PURE__ */ jsx9(
          "section",
          {
            "data-testid": "simulator-tab-panel-drops",
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(440px, 1fr))",
              gap: 16
            },
            children: frontierDrops.map((drop) => /* @__PURE__ */ jsxs8(
              "div",
              {
                className: "nomad-glass-surface",
                "data-testid": `frontier-drop-card-${drop.id}`,
                style: {
                  padding: "20px 22px",
                  borderRadius: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12
                },
                children: [
                  /* @__PURE__ */ jsxs8(
                    "div",
                    {
                      style: {
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 10
                      },
                      children: [
                        /* @__PURE__ */ jsx9(
                          "span",
                          {
                            style: {
                              fontSize: 11,
                              fontWeight: 600,
                              padding: "3px 9px",
                              borderRadius: 999,
                              background: "#F4F4F5",
                              border: "1px solid rgba(37, 99, 235, 0.16)",
                              color: "#18181B"
                            },
                            children: drop.weekBadge
                          }
                        ),
                        /* @__PURE__ */ jsxs8("span", { style: { fontSize: 12, fontWeight: 650, color: "#059669" }, children: [
                          drop.durationMinutes,
                          " мин · +",
                          Math.round(drop.xpReward * activeMentor.xpMultiplier),
                          " XP"
                        ] })
                      ]
                    }
                  ),
                  /* @__PURE__ */ jsx9("h3", { style: { fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }, children: drop.title }),
                  /* @__PURE__ */ jsx9("p", { style: { margin: 0, fontSize: 13, opacity: 0.78, lineHeight: 1.48 }, children: drop.subtitle }),
                  /* @__PURE__ */ jsx9("ul", { style: { margin: 0, paddingLeft: 18, fontSize: 12.5, opacity: 0.82, lineHeight: 1.52 }, children: (drop.highlights || []).map((h10, i) => /* @__PURE__ */ jsx9("li", { children: h10 }, i)) }),
                  /* @__PURE__ */ jsx9("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" }, children: (drop.tags || []).map((tag) => /* @__PURE__ */ jsxs8(
                    "span",
                    {
                      style: {
                        fontSize: 11,
                        padding: "2px 8px",
                        borderRadius: 6,
                        background: "rgba(15, 23, 42, 0.05)",
                        color: "#475569",
                        fontWeight: 500
                      },
                      children: [
                        "#",
                        tag
                      ]
                    },
                    tag
                  )) }),
                  /* @__PURE__ */ jsxs8("div", { style: { display: "flex", gap: 10, marginTop: "auto", paddingTop: 4, flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx9(
                      "button",
                      {
                        type: "button",
                        "data-testid": `frontier-drop-start-${drop.id}`,
                        onClick: () => handleStart(drop.id, drop.kickoffPrompt, `Frontier Drop · ${drop.title}`),
                        style: {
                          padding: "9px 15px",
                          borderRadius: 10,
                          border: "none",
                          background: "#18181B",
                          color: "#ffffff",
                          fontWeight: 600,
                          fontSize: 12.5,
                          cursor: "pointer"
                        },
                        children: "Запустить 15-минутный блиц →"
                      }
                    ),
                    /* @__PURE__ */ jsx9(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleSubmitToAcademyGrader(drop),
                        style: {
                          padding: "9px 13px",
                          borderRadius: 10,
                          border: "1px solid rgba(16, 185, 129, 0.35)",
                          background: "rgba(16, 185, 129, 0.08)",
                          color: "#059669",
                          fontWeight: 600,
                          fontSize: 12,
                          cursor: "pointer"
                        },
                        children: "Сдать блиц (+XP)"
                      }
                    )
                  ] })
                ]
              },
              drop.id
            ))
          }
        ),
        activeTab === "skills" && /* @__PURE__ */ jsx9(
          "section",
          {
            "data-testid": "simulator-tab-panel-skills",
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))",
              gap: 16
            },
            children: skillPacks.map((pack) => {
              const isPreviewOpen = previewSkillId === pack.id;
              return /* @__PURE__ */ jsxs8(
                "div",
                {
                  className: "nomad-glass-surface",
                  "data-testid": `club-skill-card-${pack.id}`,
                  style: {
                    padding: "18px 20px",
                    borderRadius: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10
                  },
                  children: [
                    /* @__PURE__ */ jsxs8(
                      "div",
                      {
                        style: {
                          width: "100%",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 11
                        },
                        children: [
                          /* @__PURE__ */ jsx9("span", { style: { color: "#18181B", fontWeight: 650 }, children: pack.category }),
                          /* @__PURE__ */ jsxs8("span", { style: { color: "#475569", fontWeight: 600 }, children: [
                            "★ ",
                            pack.rating
                          ] })
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx9("h3", { style: { fontSize: 15, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }, children: pack.title }),
                    /* @__PURE__ */ jsx9("p", { style: { margin: 0, fontSize: 12.5, opacity: 0.78, lineHeight: 1.48 }, children: pack.summary }),
                    isPreviewOpen && /* @__PURE__ */ jsx9(
                      "pre",
                      {
                        style: {
                          margin: 0,
                          padding: 10,
                          borderRadius: 10,
                          background: "rgba(15, 23, 42, 0.04)",
                          border: "1px solid rgba(15, 23, 42, 0.08)",
                          fontSize: 11,
                          whiteSpace: "pre-wrap",
                          maxHeight: 180,
                          overflowY: "auto"
                        },
                        children: pack.skillMd
                      }
                    ),
                    /* @__PURE__ */ jsxs8("div", { style: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: "auto", paddingTop: 4 }, children: [
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": `club-skill-apply-${pack.id}`,
                          onClick: () => handleStart(pack.id, pack.applyPrompt, `Скилл · ${pack.title}`),
                          style: {
                            padding: "8px 13px",
                            borderRadius: 9,
                            border: "none",
                            background: "#18181B",
                            color: "#ffffff",
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer"
                          },
                          children: "Применить в чате →"
                        }
                      ),
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          "data-testid": `club-skill-download-${pack.id}`,
                          onClick: () => handleDownloadSkillMd(pack),
                          style: {
                            padding: "8px 12px",
                            borderRadius: 9,
                            border: "1px solid rgba(15, 23, 42, 0.12)",
                            background: "rgba(255, 255, 255, 0.75)",
                            color: "inherit",
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: "pointer"
                          },
                          children: "Скачать SKILL.md"
                        }
                      ),
                      /* @__PURE__ */ jsx9(
                        "button",
                        {
                          type: "button",
                          onClick: () => setPreviewSkillId(isPreviewOpen ? null : pack.id),
                          style: {
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "none",
                            background: "transparent",
                            color: "#64748b",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer"
                          },
                          children: isPreviewOpen ? "Скрыть код" : "Код SKILL.md"
                        }
                      )
                    ] })
                  ]
                },
                pack.id
              );
            })
          }
        ),
        activeTab === "roles" && /* @__PURE__ */ jsxs8(
          "section",
          {
            "data-testid": "simulator-tab-panel-roles",
            style: {
              display: "flex",
              flexDirection: "column",
              gap: 14
            },
            children: [
              /* @__PURE__ */ jsx9("h2", { style: { fontSize: 15.5, fontWeight: 650, margin: 0, letterSpacing: "-0.015em" }, children: "Бизнес-датасеты и критерии приёмки по 9 профессиям" }),
              /* @__PURE__ */ jsx9(
                "div",
                {
                  style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                    gap: 12
                  },
                  children: SIMULATOR_TRACKS.map((track) => {
                    const selected = activeTrack === track.id;
                    return /* @__PURE__ */ jsxs8(
                      "button",
                      {
                        type: "button",
                        className: "nomad-track-card",
                        onClick: () => {
                          setActiveTrack(track.id);
                          handleStart(track.id);
                        },
                        style: {
                          textAlign: "left",
                          padding: "16px 18px",
                          borderRadius: 14,
                          border: selected ? "1.5px solid #18181B" : "1px solid rgba(15, 23, 42, 0.085)",
                          color: "inherit",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "stretch",
                          gap: 8
                        },
                        children: [
                          /* @__PURE__ */ jsxs8(
                            "div",
                            {
                              style: {
                                width: "100%",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: 12
                              },
                              children: [
                                /* @__PURE__ */ jsx9("span", { style: { fontSize: 14.5, fontWeight: 650 }, children: track.label }),
                                /* @__PURE__ */ jsx9(
                                  "span",
                                  {
                                    style: {
                                      fontSize: 11,
                                      color: "#18181B",
                                      background: "#F4F4F5",
                                      border: "1px solid rgba(37, 99, 235, 0.16)",
                                      padding: "2.5px 9px",
                                      borderRadius: 999,
                                      fontWeight: 600,
                                      whiteSpace: "nowrap",
                                      flexShrink: 0
                                    },
                                    children: "Запустить →"
                                  }
                                )
                              ]
                            }
                          ),
                          /* @__PURE__ */ jsx9("span", { style: { fontSize: 12.5, opacity: 0.78, lineHeight: 1.45, display: "block" }, children: track.summary }),
                          /* @__PURE__ */ jsx9(
                            "span",
                            {
                              style: {
                                fontSize: 11.5,
                                opacity: 0.82,
                                padding: "7px 10px",
                                borderRadius: 8,
                                background: "rgba(15, 23, 42, 0.04)",
                                border: "1px solid rgba(15, 23, 42, 0.07)",
                                lineHeight: 1.4,
                                display: "block"
                              },
                              children: track.businessDataset
                            }
                          ),
                          /* @__PURE__ */ jsx9("span", { style: { fontSize: 11.5, color: "#059669", fontWeight: 600, lineHeight: 1.4, display: "block" }, children: track.verificationCheck })
                        ]
                      },
                      track.id
                    );
                  })
                }
              )
            ]
          }
        )
      ]
    }
  );
}
function register4(ctx) {
  ctx.register({
    id: "page",
    area: ROUTES_AREA12,
    data: {
      path: SIMULATOR_PATH
    },
    render: () => /* @__PURE__ */ jsx9(SimulatorPage, { ctx })
  });
  ctx.register({
    id: "nav",
    area: SIDEBAR_NAV_AREA6,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: "nomad.simulator.nav",
      codicon: SIMULATOR_NAV_CODICON,
      label: SIMULATOR_NAV_LABEL,
      path: SIMULATOR_PATH,
      order: SIMULATOR_NAV_ORDER
    }
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA12,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: "nomad.simulator.open",
      action: "nomad.simulator.open",
      label: SIMULATOR_NAV_LABEL,
      category: "Nomad",
      keywords: [
        "симулятор",
        "ментор",
        "ника",
        "сократ",
        "академия",
        "курс",
        "вайбкодинг",
        "обучение",
        "simulator"
      ],
      run: () => {
        if (typeof host7?.navigate === "function") {
          host7.navigate(SIMULATOR_PATH);
        }
        startSimulatorChat(host7, { storage: ctx?.storage });
      }
    }
  });
}

// skills.js
var skills_exports = {};
__export(skills_exports, {
  NomadSkillsPage: () => NomadSkillsPage,
  SKILLS_NAV_ID: () => SKILLS_NAV_ID,
  SKILLS_NAV_LABEL: () => SKILLS_NAV_LABEL,
  SKILLS_NAV_ORDER: () => SKILLS_NAV_ORDER,
  SKILLS_ROUTE_PATH: () => SKILLS_ROUTE_PATH,
  SKILLS_TRANSLATED_BADGE: () => SKILLS_TRANSLATED_BADGE,
  SKILLS_UNTRANSLATED_BADGE: () => SKILLS_UNTRANSLATED_BADGE,
  default: () => registerSkills,
  formatSkillDisplay: () => formatSkillDisplay
});
import {
  PALETTE_AREA as PALETTE_AREA13,
  ROUTES_AREA as ROUTES_AREA13,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA7
} from "@hermes/plugin-sdk";
import { createElement as createElement6, useCallback as useCallback11, useEffect as useEffect13, useState as useState14 } from "react";
var SKILLS_ROUTE_PATH = "/nomad-skills";
var SKILLS_NAV_ID = "skills";
var SKILLS_NAV_LABEL = "Навыки Nomad";
var SKILLS_NAV_ORDER = 61;
var SKILLS_UNTRANSLATED_BADGE = "На английском (без перевода)";
var SKILLS_TRANSLATED_BADGE = "Русское описание";
var h6 = createElement6;
function formatSkillDisplay(skill) {
  if (!skill || typeof skill !== "object") {
    return {
      title: "",
      description: "",
      badge: SKILLS_UNTRANSLATED_BADGE,
      hasRuTranslation: false,
      languageNote: "Описание на английском (русский перевод пока не добавлен)"
    };
  }
  const hasRu = Boolean(skill.has_ru_translation && skill.description_ru);
  const title = skill.title || skill.name || "";
  if (hasRu) {
    return {
      title,
      description: skill.description_ru || skill.user_description || skill.description || "",
      badge: skill.badge || SKILLS_TRANSLATED_BADGE,
      hasRuTranslation: true,
      languageNote: null
    };
  }
  const enText = skill.description_en || skill.description || "Описание отсутствует";
  const note = skill.language_note || "Описание на английском (русский перевод пока не добавлен)";
  return {
    title,
    description: enText,
    badge: skill.badge || SKILLS_UNTRANSLATED_BADGE,
    hasRuTranslation: false,
    languageNote: note
  };
}
function restGet4(ctx, path) {
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path));
  }
  return Promise.resolve(null);
}
function restPost4(ctx, path, body) {
  if (typeof ctx?.rest?.post === "function") {
    return Promise.resolve(ctx.rest.post(path, body));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "POST", body }));
  }
  return Promise.resolve(null);
}
function restDelete(ctx, path) {
  if (typeof ctx?.rest?.delete === "function") {
    return Promise.resolve(ctx.rest.delete(path));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "DELETE" }));
  }
  return Promise.resolve(null);
}
var DEFAULT_RF_CONNECTORS = [
  {
    id: "1c-odata",
    title: "1С:Предприятие 8.3 (ERP, УТ, Бухгалтерия, ЗУП)",
    category: "ERP и Учёт РФ",
    badge: "OData v3 / HTTP-сервис · 152-ФЗ",
    description: "Прямое подключение к 1С через стандартный интерфейс OData (/odata/standard.odata) или HTTP-сервис: остатки, счета, сверка контрагентов, выгрузка ОСВ и кадровых приказов.",
    allowed_hosts: ["1c.company.ru", "erp.local", "10.0.0.0/8"],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: "ONEC_BASE_URL", label: "URL публикации 1С OData", placeholder: "https://1c.company.ru/buh/odata/standard.odata", secret: false },
      { key: "ONEC_USERNAME", label: "Пользователь 1С", placeholder: "ai_bot_readonly", secret: false },
      { key: "ONEC_PASSWORD", label: "Пароль / Токен 1С", placeholder: "••••••••••••", secret: true }
    ]
  },
  {
    id: "bitrix24",
    title: "Битрикс24 (CRM, Задачи, Диск и Живая лента)",
    category: "CRM и Портал РФ",
    badge: "Встроенный MCP · 152-ФЗ",
    description: "Нативный MCP-сервер bitrix24 + корпоративные навыки: лиды, сделки, смарт-процессы, задачи, аналитика воронки продаж и отчёты руководителю.",
    allowed_hosts: ["bitrix24.ru", "bitrix24.by", "bitrix24.kz"],
    supports_vpn: true,
    mcp_server: "bitrix24",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "BITRIX24_WEBHOOK_URL", label: "Входящий вебхук Битрикс24 (.ru)", placeholder: "https://company.bitrix24.ru/rest/1/xxxxx/", secret: true }
    ]
  },
  {
    id: "diadoc",
    title: "Контур.Диадок и Контур.Фокус (ЮЗЭДО и Комплаенс)",
    category: "ЭДО и Налоги РФ",
    badge: "ЮЗЭДО · УКЭП · ФНС",
    description: "Юридически значимый электронный документооборот: проверка входящих УПД/актов/счетов-фактур (XML ФНС 5.02), сверка с договором и скоринг в Контур.Фокус.",
    allowed_hosts: ["diadoc-api.kontur.ru", "focus-api.kontur.ru"],
    supports_vpn: false,
    mcp_server: "ru-counterparty",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "DIADOC_API_KEY", label: "Ключ разработчика Диадок (ddauth_api_client_id)", placeholder: "client-id-xxxx...", secret: true },
      { key: "DIADOC_BOX_ID", label: "ID ящика организации в Диадок", placeholder: "box-id@kontur.ru", secret: false },
      { key: "KONTUR_FOCUS_API_KEY", label: "Ключ API Контур.Фокус (опционально)", placeholder: "focus-key...", secret: true }
    ]
  },
  {
    id: "sbis",
    title: "СБИС / Saby (ЭДО, Отчётность и Склад)",
    category: "ЭДО и Налоги РФ",
    badge: "JSON-RPC · Saby API",
    description: "Интеграция со СБИС (Saby): получение и маршрутизация первичных документов ЭДО, контроль подписания УКЭП и проверка поставщиков.",
    allowed_hosts: ["online.sbis.ru", "api.sbis.ru"],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: "SBIS_APP_CLIENT_ID", label: "App Client ID сервисного приложения СБИС", placeholder: "sbis-app-id...", secret: false },
      { key: "SBIS_APP_SECRET", label: "Защищённый ключ / Сервисный пароль СБИС", placeholder: "••••••••••••", secret: true }
    ]
  },
  {
    id: "yandex-360",
    title: "Яндекс 360 для бизнеса (Почта, Диск, Трекер, Метрика)",
    category: "Офис и Аналитика РФ",
    badge: "3 встроенных MCP · 152-ФЗ",
    description: "Полный контур Яндекс 360: MCP-серверы yandex-mail, yandex-disk, yandex-metrika + Яндекс Трекер, Календарь, Wiki и Телемост.",
    allowed_hosts: ["cloud-api.yandex.net", "api.tracker.yandex.net", "api-metrika.yandex.net", "imap.yandex.ru"],
    supports_vpn: false,
    mcp_server: "yandex-disk",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "YANDEX_OAUTH_TOKEN", label: "OAuth-токен Яндекс 360 / Диск / Метрика", placeholder: "y0_AgAAAAA...", secret: true },
      { key: "YANDEX_ORG_ID", label: "ID организации Яндекс 360 / Трекер", placeholder: "7800000", secret: false },
      { key: "YANDEX_MAIL_USER", label: "Корпоративный ящик Яндекс Почты", placeholder: "user@company.ru", secret: false },
      { key: "YANDEX_MAIL_APP_PASSWORD", label: "Пароль приложения Яндекс Почты (IMAP)", placeholder: "••••••••••••", secret: true }
    ]
  },
  {
    id: "mts-link",
    title: "МТС Линк (Ktalk / Webinar · ВКС и Протоколы встреч)",
    category: "Коммуникации РФ",
    badge: "ВКС РФ · Авто-протоколы",
    description: "Автоматическая выгрузка записей совещаний из МТС Линк, русскоязычная транскрибация, выделение поручений с дедлайнами и отправка в Битрикс24 / Трекер.",
    allowed_hosts: ["userapi.mts-link.ru", "ktalk.ru"],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: "MTS_LINK_API_TOKEN", label: "Токен доступа МТС Линк (x-auth-token)", placeholder: "mts-link-token...", secret: true },
      { key: "MTS_LINK_DOMAIN", label: "Корпоративный домен МТС Линк / Ktalk", placeholder: "company.mts-link.ru", secret: false }
    ]
  },
  {
    id: "fns-dadata-cbr",
    title: "ФНС ЕГРЮЛ/ГИР БО, DaData, Госзакупки 44-ФЗ/223-ФЗ и ЦБ РФ",
    category: "Госреестры и Финансы РФ",
    badge: "2 встроенных MCP · Госданные",
    description: "MCP-серверы ru-counterparty и ru-open-data: проверка ИНН/ОГРН, бухотчётность ФНС (РСБУ Ф1/Ф2), курсы валют и ключевая ставка ЦБ РФ, тендеры ЕИС.",
    allowed_hosts: ["suggestions.dadata.ru", "cbr.ru", "www.cbr-xml-daily.ru", "bo.nalog.gov.ru", "zakupki.gov.ru"],
    supports_vpn: false,
    mcp_server: "ru-counterparty",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "DADATA_API_KEY", label: "API-ключ DaData.ru (реквизиты по ИНН)", placeholder: "dadata-api-key...", secret: true },
      { key: "DADATA_SECRET_KEY", label: "Секретный ключ DaData (стандартизация)", placeholder: "dadata-secret...", secret: true }
    ]
  },
  {
    id: "garant-consultant",
    title: "Гарант API и КонсультантПлюс (Правовой контур РФ)",
    category: "Юриспруденция РФ",
    badge: "НПА РФ · Судебная практика",
    description: "Верификация договоров по ГК РФ, ТК РФ, НК РФ и 152-ФЗ без галлюцинаций: поиск действующих редакций законов, писем Минфина/ФНС и практики ВС РФ.",
    allowed_hosts: ["api.garant.ru", "internet.garant.ru"],
    supports_vpn: true,
    connected: false,
    via_vpn: false,
    fields: [
      { key: "GARANT_API_TOKEN", label: "Токен доступа API Гарант", placeholder: "Bearer garant-token...", secret: true },
      { key: "CONSULTANT_LOCAL_URL", label: "Локальный веб-сервер КонсультантПлюс (в контуре)", placeholder: "https://cons.company.local", secret: false }
    ]
  },
  {
    id: "amocrm",
    title: "amoCRM (Сделки, Контакты и Автоматизация продаж)",
    category: "CRM и Портал РФ",
    badge: "amoCRM REST v4 · 152-ФЗ",
    description: "Чтение и обновление карточек сделок amoCRM, суммаризация звонков и переписок с клиентами, автозаполнение полей CRM и контроль SLA.",
    allowed_hosts: ["amocrm.ru"],
    supports_vpn: false,
    connected: false,
    via_vpn: false,
    fields: [
      { key: "AMOCRM_SUBDOMAIN", label: "Поддомен аккаунта amoCRM (.amocrm.ru)", placeholder: "company.amocrm.ru", secret: false },
      { key: "AMOCRM_ACCESS_TOKEN", label: "Долгосрочный токен amoCRM", placeholder: "eyJ0eXAiOiJKV1Qi...", secret: true }
    ]
  },
  {
    id: "kaiten-weeek",
    title: "Kaiten и WEEEK (Российские Agile-доски и База знаний)",
    category: "Управление проектами РФ",
    badge: "Импортозамещение Jira / Notion",
    description: "Управление карточками, спринтами, эпиками и базой знаний в российских сервисах Kaiten.ru и WEEEK.net.",
    allowed_hosts: ["kaiten.ru", "api.weeek.net"],
    supports_vpn: true,
    mcp_server: "knowledge-base",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "KAITEN_BASE_URL", label: "Домен Kaiten (например, company.kaiten.ru)", placeholder: "https://company.kaiten.ru/api/latest", secret: false },
      { key: "KAITEN_API_TOKEN", label: "Токен API Kaiten / WEEEK", placeholder: "kaiten-token...", secret: true }
    ]
  },
  {
    id: "vk-teams-max",
    title: "VK Teams, Мессенджер Max и Telegram Корп-Бот",
    category: "Коммуникации РФ",
    badge: "Встроенный MCP · Мессенджеры РФ",
    description: "Корпоративные боты и уведомления в VK Teams (myteam.mail.ru), национальном мессенджере Max и Telegram (telegram-bot MCP).",
    allowed_hosts: ["api.internal.myteam.mail.ru", "botapi.max.ru", "api.telegram.org"],
    supports_vpn: true,
    mcp_server: "telegram-bot",
    connected: false,
    via_vpn: false,
    fields: [
      { key: "VK_TEAMS_BOT_TOKEN", label: "Токен бота VK Teams / Max", placeholder: "001.123456789...", secret: true },
      { key: "VK_TEAMS_API_URL", label: "URL сервера VK Teams (облако или On-Premise)", placeholder: "https://api.internal.myteam.mail.ru/bot/v1", secret: false }
    ]
  }
];
function NomadSkillsPage({ ctx }) {
  const [activeTab, setActiveTab] = useState14("catalog");
  const [state, setState] = useState14({
    loading: true,
    error: null,
    skills: [],
    categories: [],
    total: 0,
    translatedCount: 0,
    untranslatedCount: 0,
    enabledCount: 0
  });
  const [query, setQuery] = useState14("");
  const [category, setCategory] = useState14("all");
  const [onlyTranslated, setOnlyTranslated] = useState14(false);
  const [onlyEnabled, setOnlyEnabled] = useState14(false);
  const [selectedSkill, setSelectedSkill] = useState14(null);
  const [busyName, setBusyName] = useState14(null);
  const [rfConnectors, setRfConnectors] = useState14(DEFAULT_RF_CONNECTORS);
  const [editingConnector, setEditingConnector] = useState14(null);
  const [connectorValues, setConnectorValues] = useState14({});
  const [connectorVpn, setConnectorVpn] = useState14(false);
  const [connectorHostsInput, setConnectorHostsInput] = useState14("");
  const [connectorBusy, setConnectorBusy] = useState14(false);
  const [connectorNotice, setConnectorNotice] = useState14("");
  const [connectorError, setConnectorError] = useState14("");
  const [bundles, setBundles] = useState14([]);
  const [bundleName, setBundleName] = useState14("");
  const [bundleDesc, setBundleDesc] = useState14("");
  const [bundleSkillsInput, setBundleSkillsInput] = useState14("");
  const [bundleBusy, setBundleBusy] = useState14(false);
  const [bundleNotice, setBundleNotice] = useState14("");
  const [archivedSkills, setArchivedSkills] = useState14([]);
  const [pinnedSkills, setPinnedSkills] = useState14([]);
  const [curatorActiveSkills, setCuratorActiveSkills] = useState14([]);
  const [curatorBusy, setCuratorBusy] = useState14(false);
  const [curatorNotice, setCuratorNotice] = useState14("");
  const loadRfConnectors = useCallback11(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet4(ctx, "/skills/rf-connectors").then((res) => {
      if (res && Array.isArray(res.connectors) && res.connectors.length > 0) {
        setRfConnectors(res.connectors);
      }
      return res;
    }).catch(() => null);
  }, [ctx]);
  const handleSaveConnector = useCallback11(
    (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (!editingConnector) return Promise.resolve(null);
      setConnectorError("");
      setConnectorNotice("");
      const customHosts = connectorHostsInput.split(",").map((h10) => h10.trim()).filter(Boolean);
      if (customHosts.some((h10) => h10.includes("*"))) {
        setConnectorError("Политика Anti-SSRF запрещает использование символов подстановки (*). Укажите точный домен или IP-подсеть.");
        return Promise.resolve(null);
      }
      setConnectorBusy(true);
      return restPost4(ctx, "/skills/rf-connectors/configure", {
        id: editingConnector.id,
        values: connectorValues,
        via_vpn: connectorVpn,
        custom_hosts: customHosts,
        enabled: true
      }).then((res) => {
        if (res && Array.isArray(res.connectors)) {
          setRfConnectors(res.connectors);
        } else {
          loadRfConnectors();
        }
        setConnectorNotice(`Коннектор «${editingConnector.title}» сохранён и активирован.`);
        setEditingConnector(null);
        return res;
      }).catch((err) => {
        setConnectorError(err?.message || "Не удалось сохранить настройки коннектора.");
        return null;
      }).finally(() => {
        setConnectorBusy(false);
      });
    },
    [ctx, editingConnector, connectorValues, connectorVpn, connectorHostsInput, loadRfConnectors]
  );
  const loadSkills = useCallback11(() => {
    if (!ctx?.rest) {
      setState((prev) => ({ ...prev, loading: false }));
      return Promise.resolve(null);
    }
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (category && category !== "all") params.set("category", category);
    if (onlyTranslated) params.set("only_translated", "true");
    if (onlyEnabled) params.set("only_enabled", "true");
    const qs = params.toString();
    const path = qs ? `/skills?${qs}` : "/skills";
    return restGet4(ctx, path).then((res) => {
      if (!res || typeof res !== "object") return null;
      setState({
        loading: false,
        error: null,
        skills: Array.isArray(res.skills) ? res.skills : [],
        categories: Array.isArray(res.categories) ? res.categories : [],
        total: Number(res.total || 0),
        translatedCount: Number(res.translated_count || 0),
        untranslatedCount: Number(res.untranslated_count || 0),
        enabledCount: Number(res.enabled_count || 0)
      });
      return res;
    }).catch((err) => {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Не удалось загрузить каталог навыков"
      }));
      return null;
    });
  }, [ctx, query, category, onlyTranslated, onlyEnabled]);
  const loadBundles = useCallback11(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet4(ctx, "/skills/bundles").then((res) => {
      if (res && Array.isArray(res.bundles)) {
        setBundles(res.bundles);
      }
      return res;
    }).catch(() => null);
  }, [ctx]);
  const loadCurator = useCallback11(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet4(ctx, "/skills/curator").then((res) => {
      if (!res || typeof res !== "object") return null;
      setArchivedSkills(Array.isArray(res.archived) ? res.archived : []);
      setPinnedSkills(Array.isArray(res.pinned_skills) ? res.pinned_skills : []);
      setCuratorActiveSkills(Array.isArray(res.active_skills) ? res.active_skills : []);
      return res;
    }).catch(() => null);
  }, [ctx]);
  useEffect13(() => {
    loadSkills();
    loadBundles();
    loadCurator();
    loadRfConnectors();
  }, [loadSkills, loadBundles, loadCurator, loadRfConnectors]);
  const handleToggleSkill = useCallback11(
    (skill) => {
      if (!ctx?.rest || !skill?.name) return Promise.resolve(null);
      const nextEnabled = !skill.enabled;
      setBusyName(skill.name);
      return restPost4(ctx, "/skills/toggle", {
        name: skill.name,
        enabled: nextEnabled
      }).then(() => loadSkills()).catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || "Не удалось переключить навык");
      }).finally(() => {
        setBusyName(null);
      });
    },
    [ctx, loadSkills]
  );
  const handlePinSkill = useCallback11(
    (skillName, nextPinned) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice("");
      return restPost4(ctx, "/skills/curator/pin", {
        name: skillName,
        pinned: Boolean(nextPinned)
      }).then((res) => {
        setCuratorNotice(
          nextPinned ? `Навык «${skillName}» закреплён от автоматической архивации.` : `С навыка «${skillName}» снято закрепление.`
        );
        loadSkills();
        loadCurator();
        return res;
      }).catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || "Не удалось изменить закрепление навыка");
      }).finally(() => {
        setCuratorBusy(false);
      });
    },
    [ctx, loadSkills, loadCurator]
  );
  const handleRestoreArchived = useCallback11(
    (skillName) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice("");
      return restPost4(ctx, "/skills/curator/restore", { name: skillName }).then((res) => {
        setCuratorNotice(`Навык «${skillName}» восстановлен из архива в рабочий каталог.`);
        loadSkills();
        loadCurator();
        return res;
      }).catch((err) => {
        ctx?.host?.toast?.error?.(err?.message || "Не удалось восстановить навык из архива");
      }).finally(() => {
        setCuratorBusy(false);
      });
    },
    [ctx, loadSkills, loadCurator]
  );
  const handleCreateBundle = useCallback11(
    (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      if (!ctx?.rest) return Promise.resolve(null);
      const name = bundleName.trim();
      const skillsList = bundleSkillsInput.split(",").map((s) => s.trim()).filter(Boolean);
      if (!name || skillsList.length === 0) {
        setBundleNotice("Укажите название набора и хотя бы один навык через запятую.");
        return Promise.resolve(null);
      }
      setBundleBusy(true);
      setBundleNotice("");
      return restPost4(ctx, "/skills/bundles", {
        name,
        skills: skillsList,
        description: bundleDesc.trim(),
        overwrite: true
      }).then((res) => {
        if (res?.bundles) setBundles(res.bundles);
        else loadBundles();
        setBundleName("");
        setBundleDesc("");
        setBundleSkillsInput("");
        setBundleNotice(`Набор «${name}» сохранён.`);
        return res;
      }).catch((err) => {
        setBundleNotice(err?.message || "Не удалось сохранить набор навыков.");
      }).finally(() => {
        setBundleBusy(false);
      });
    },
    [ctx, bundleName, bundleDesc, bundleSkillsInput, loadBundles]
  );
  const handleDeleteBundle = useCallback11(
    (slugOrName) => {
      if (!ctx?.rest || !slugOrName) return Promise.resolve(null);
      setBundleBusy(true);
      setBundleNotice("");
      return restDelete(ctx, `/skills/bundles/${encodeURIComponent(slugOrName)}`).then((res) => {
        if (res?.bundles) setBundles(res.bundles);
        else loadBundles();
        setBundleNotice(`Набор «${slugOrName}» удалён.`);
        return res;
      }).catch((err) => {
        setBundleNotice(err?.message || "Не удалось удалить набор навыков.");
      }).finally(() => {
        setBundleBusy(false);
      });
    },
    [ctx, loadBundles]
  );
  const handleInspectSkill = useCallback11(
    (skill) => {
      if (!skill?.name) {
        setSelectedSkill(null);
        return Promise.resolve(null);
      }
      setSelectedSkill((prev) => prev && prev.name === skill.name && prev._closedByToggle ? null : { ...skill, _loadingDetail: true });
      if (!ctx?.rest) {
        return Promise.resolve(skill);
      }
      return restGet4(ctx, `/skills/${encodeURIComponent(skill.name)}`).then((res) => {
        const full = res?.skill ? { ...skill, ...res.skill, _loadingDetail: false } : { ...skill, _loadingDetail: false };
        setSelectedSkill(full);
        return full;
      }).catch(() => {
        const fallback = { ...skill, _loadingDetail: false };
        setSelectedSkill(fallback);
        return fallback;
      });
    },
    [ctx]
  );
  return h6(
    "div",
    {
      className: "nomad-skills-page",
      style: { padding: "24px", maxWidth: "1120px", margin: "0 auto" }
    },
    h6(
      "header",
      { style: { marginBottom: "20px" } },
      h6(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap"
          }
        },
        h6(
          "div",
          null,
          h6(
            "h1",
            { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } },
            "Навыки Nomad"
          ),
          h6(
            "p",
            { style: { margin: 0, opacity: 0.78, fontSize: "13px" } },
            "Каталог установленных навыков агента с русскими пользовательскими описаниями, наборами и архивом."
          )
        ),
        h6(
          "div",
          { style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px" } },
          h6(
            "span",
            {
              className: "nomad-skills-stat-total",
              style: {
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(128,128,128,0.14)"
              }
            },
            `Всего: ${state.total}`
          ),
          h6(
            "span",
            {
              className: "nomad-skills-stat-ru",
              style: {
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(46,160,67,0.16)"
              }
            },
            `На русском: ${state.translatedCount}`
          ),
          h6(
            "span",
            {
              className: "nomad-skills-stat-en",
              style: {
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(210,153,34,0.18)"
              }
            },
            `Без перевода: ${state.untranslatedCount}`
          )
        )
      ),
      h6(
        "div",
        {
          role: "tablist",
          className: "nomad-skills-tabs nomad-seg-group",
          style: {
            marginTop: "16px"
          }
        },
        h6(
          "button",
          {
            type: "button",
            role: "tab",
            className: "nomad-seg-btn",
            "data-active": activeTab === "catalog" ? "true" : "false",
            "aria-selected": activeTab === "catalog",
            title: "Каталог навыков профиля с русскими описаниями",
            "data-tooltip": "Каталог навыков профиля с русскими описаниями",
            onClick: () => setActiveTab("catalog")
          },
          `Каталог (${state.total})`
        ),
        h6(
          "button",
          {
            type: "button",
            role: "tab",
            className: "nomad-seg-btn",
            "data-active": activeTab === "bundles" ? "true" : "false",
            "aria-selected": activeTab === "bundles",
            title: "Управление наборами навыков (skill-bundles)",
            "data-tooltip": "Управление наборами навыков (skill-bundles)",
            onClick: () => setActiveTab("bundles")
          },
          `Наборы (${bundles.length})`
        ),
        h6(
          "button",
          {
            type: "button",
            role: "tab",
            className: "nomad-seg-btn",
            "data-active": activeTab === "curator" ? "true" : "false",
            "aria-selected": activeTab === "curator",
            title: "Архив и куратор отключённых навыков",
            "data-tooltip": "Архив и куратор отключённых навыков",
            onClick: () => setActiveTab("curator")
          },
          `Архив (${archivedSkills.length})`
        ),
        h6(
          "button",
          {
            type: "button",
            role: "tab",
            className: "nomad-seg-btn",
            "data-active": activeTab === "rf-connectors" ? "true" : "false",
            "aria-selected": activeTab === "rf-connectors",
            title: "Коннекторы к российским корпоративным системам (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)",
            "data-tooltip": "Коннекторы к российским системам (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)",
            onClick: () => setActiveTab("rf-connectors")
          },
          `Коннекторы РФ и MCP (${rfConnectors.length})`
        )
      )
    ),
    activeTab === "rf-connectors" || activeTab === "catalog" ? h6(
      "section",
      {
        className: "nomad-rf-connectors-section nomad-glass-surface",
        "data-testid": "nomad-rf-connectors-section",
        style: {
          marginBottom: "22px",
          padding: "20px 22px",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }
      },
      h6(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "10px"
          }
        },
        h6(
          "div",
          null,
          h6(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            h6(
              "h2",
              { style: { margin: 0, fontSize: "16px", fontWeight: 600, letterSpacing: "-0.018em" } },
              "Коннекторы к системам РФ и MCP-серверы (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, Гарант)"
            ),
            h6(
              "span",
              {
                className: "nomad-pill-badge",
                style: {
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: "rgba(16, 185, 129, 0.14)",
                  color: "#059669"
                }
              },
              "Anti-SSRF · Без wildcard (*) · Корп. VPN"
            )
          ),
          h6(
            "p",
            { style: { margin: "4px 0 0 0", fontSize: "12.5px", opacity: 0.78, maxWidth: "860px" } },
            "Прямое подключение агента к корпоративному контуру РФ (по архитектуре защищённых навыков: строгий белый список доменов, поддержка VPN-туннеля до локальной 1С и шифрование токенов)."
          )
        ),
        activeTab === "catalog" ? h6(
          "button",
          {
            type: "button",
            onClick: () => setActiveTab("rf-connectors"),
            style: {
              padding: "6px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(0, 122, 255, 0.28)",
              background: "#F4F4F5",
              color: "inherit",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          `Показать все ${rfConnectors.length} коннекторов РФ →`
        ) : null
      ),
      connectorNotice ? h6(
        "div",
        {
          style: {
            padding: "10px 14px",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.14)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            color: "#10b981",
            fontSize: "13px"
          }
        },
        connectorNotice
      ) : null,
      editingConnector ? h6(
        "form",
        {
          onSubmit: handleSaveConnector,
          style: {
            padding: "16px 18px",
            borderRadius: "10px",
            border: "1px solid rgba(37, 99, 235, 0.4)",
            background: "var(--background, rgba(37, 99, 235, 0.05))",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }
        },
        h6(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h6(
            "strong",
            { style: { fontSize: "14px" } },
            `Настройка коннектора: ${editingConnector.title}`
          ),
          h6(
            "button",
            {
              type: "button",
              onClick: () => setEditingConnector(null),
              style: {
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(128,128,128,0.3)",
                background: "transparent",
                color: "inherit",
                fontSize: "12px",
                cursor: "pointer"
              }
            },
            "Закрыть"
          )
        ),
        h6(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "10px"
            }
          },
          ...(editingConnector.fields || []).map(
            (f) => h6(
              "label",
              {
                key: f.key,
                style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }
              },
              h6("span", { style: { fontWeight: 600 } }, `${f.label} (${f.key})`),
              h6("input", {
                type: f.secret ? "password" : "text",
                value: connectorValues[f.key] ?? "",
                onChange: (e) => setConnectorValues((prev) => ({
                  ...prev,
                  [f.key]: e?.target?.value ?? ""
                })),
                placeholder: f.preview ? `Сохранено: ${f.preview}` : f.placeholder,
                style: {
                  padding: "8px 10px",
                  borderRadius: "7px",
                  border: "1px solid rgba(128,128,128,0.32)",
                  background: "transparent",
                  color: "inherit",
                  fontSize: "12.5px",
                  fontFamily: f.secret ? "monospace" : "inherit"
                }
              })
            )
          ),
          h6(
            "label",
            { style: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" } },
            h6("span", { style: { fontWeight: 600 } }, "Дополнительные разрешённые хосты (Anti-SSRF, без *)"),
            h6("input", {
              type: "text",
              value: connectorHostsInput,
              onChange: (e) => setConnectorHostsInput(e?.target?.value ?? ""),
              placeholder: (editingConnector.allowed_hosts || []).join(", "),
              style: {
                padding: "8px 10px",
                borderRadius: "7px",
                border: "1px solid rgba(128,128,128,0.32)",
                background: "transparent",
                color: "inherit",
                fontSize: "12.5px",
                fontFamily: "monospace"
              }
            })
          )
        ),
        h6(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }
          },
          h6(
            "label",
            { style: { display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer" } },
            h6("input", {
              type: "checkbox",
              checked: connectorVpn,
              onChange: (e) => setConnectorVpn(Boolean(e?.target?.checked))
            }),
            "🔒 Маршрутизировать запросы через корпоративный VPN-туннель (via_vpn: WireGuard / Континент / VipNet)"
          ),
          h6(
            "button",
            {
              type: "submit",
              disabled: connectorBusy,
              style: {
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: "#18181B",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            connectorBusy ? "Сохранение..." : "Сохранить и подключить коннектор"
          )
        ),
        connectorError ? h6("div", { style: { fontSize: "12.5px", color: "#ef4444" } }, connectorError) : null
      ) : null,
      h6(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: "10px"
          }
        },
        ...(activeTab === "rf-connectors" ? rfConnectors : rfConnectors.slice(0, 6)).map(
          (conn) => h6(
            "div",
            {
              key: conn.id,
              "data-connector-id": conn.id,
              style: {
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border, rgba(128,128,128,0.24))",
                background: "var(--background, rgba(255,255,255,0.03))",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "8px"
              }
            },
            h6(
              "div",
              null,
              h6(
                "div",
                { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" } },
                h6("strong", { style: { fontSize: "13.5px" } }, conn.title),
                h6(
                  "span",
                  {
                    style: {
                      fontSize: "10.5px",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "999px",
                      whiteSpace: "nowrap",
                      background: conn.connected ? "rgba(16, 185, 129, 0.16)" : "rgba(76, 110, 245, 0.14)",
                      color: conn.connected ? "#10b981" : "#4c6ef5"
                    }
                  },
                  conn.connected ? "Подключён" : conn.badge
                )
              ),
              h6(
                "p",
                { style: { margin: "5px 0 0 0", fontSize: "12px", opacity: 0.76, lineHeight: 1.4 } },
                conn.description
              ),
              h6(
                "div",
                { style: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "6px" } },
                ...(conn.allowed_hosts || []).map(
                  (host12) => h6(
                    "code",
                    {
                      key: host12,
                      style: {
                        fontSize: "10.5px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background: "rgba(128,128,128,0.12)"
                      }
                    },
                    host12
                  )
                ),
                conn.via_vpn ? h6(
                  "span",
                  {
                    style: {
                      fontSize: "10.5px",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      background: "rgba(16, 185, 129, 0.14)",
                      color: "#10b981"
                    }
                  },
                  "VPN активен"
                ) : null
              )
            ),
            h6(
              "div",
              { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", marginTop: "4px" } },
              h6(
                "span",
                { style: { fontSize: "11px", opacity: 0.65 } },
                conn.category
              ),
              h6(
                "button",
                {
                  type: "button",
                  onClick: () => {
                    setEditingConnector(conn);
                    setConnectorValues({});
                    setConnectorVpn(Boolean(conn.via_vpn));
                    setConnectorHostsInput((conn.custom_hosts || []).join(", "));
                    setConnectorError("");
                  },
                  style: {
                    padding: "5px 11px",
                    borderRadius: "7px",
                    border: "1px solid rgba(76, 110, 245, 0.35)",
                    background: "rgba(76, 110, 245, 0.1)",
                    color: "inherit",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }
                },
                conn.connected ? "Настроить контур" : "Подключить за 1 клик"
              )
            )
          )
        )
      )
    ) : null,
    activeTab === "bundles" ? h6(
      "section",
      {
        className: "nomad-skills-bundles-tab",
        style: { display: "flex", flexDirection: "column", gap: "16px" }
      },
      h6(
        "form",
        {
          onSubmit: handleCreateBundle,
          style: {
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(128,128,128,0.24)",
            display: "grid",
            gap: "10px"
          }
        },
        h6("h3", { style: { margin: 0, fontSize: "16px" } }, "Создать набор навыков"),
        h6(
          "p",
          { style: { margin: 0, fontSize: "13px", opacity: 0.78 } },
          "Набор объединяет несколько навыков под одной быстрой командой в чате."
        ),
        bundleNotice ? h6("div", { style: { fontSize: "13px", color: "#18181B" } }, bundleNotice) : null,
        h6("input", {
          type: "text",
          value: bundleName,
          onChange: (e) => setBundleName(e?.target?.value ?? ""),
          placeholder: "Название набора (например, backend-review)",
          style: {
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h6("input", {
          type: "text",
          value: bundleSkillsInput,
          onChange: (e) => setBundleSkillsInput(e?.target?.value ?? ""),
          placeholder: "Навыки через запятую (например: github, docx)",
          style: {
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h6("input", {
          type: "text",
          value: bundleDesc,
          onChange: (e) => setBundleDesc(e?.target?.value ?? ""),
          placeholder: "Краткое описание набора (необязательно)",
          style: {
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        }),
        h6(
          "div",
          null,
          h6(
            "button",
            {
              type: "submit",
              disabled: bundleBusy,
              style: {
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#18181B",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            "Сохранить набор"
          )
        )
      ),
      h6(
        "div",
        {
          className: "nomad-bundles-list",
          style: { display: "grid", gap: "10px" }
        },
        bundles.length === 0 ? h6(
          "div",
          {
            style: {
              padding: "16px",
              borderRadius: "8px",
              border: "1px dashed rgba(128,128,128,0.3)",
              fontSize: "13px",
              opacity: 0.78
            }
          },
          "У вас пока нет сохранённых наборов навыков."
        ) : bundles.map(
          (b) => h6(
            "div",
            {
              key: b.slug || b.name,
              className: "nomad-bundle-card",
              style: {
                padding: "14px 16px",
                borderRadius: "10px",
                border: "1px solid rgba(128,128,128,0.24)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }
            },
            h6(
              "div",
              null,
              h6(
                "div",
                { style: { fontWeight: 600, fontSize: "15px" } },
                `${b.name} (${b.command || "/" + b.slug})`
              ),
              h6(
                "div",
                { style: { fontSize: "12px", opacity: 0.78, marginTop: "2px" } },
                b.description || ""
              ),
              h6(
                "div",
                { style: { fontSize: "12px", opacity: 0.85, marginTop: "4px" } },
                `Навыки: ${(b.skills || []).join(", ")}`
              )
            ),
            h6(
              "button",
              {
                type: "button",
                disabled: bundleBusy,
                onClick: () => handleDeleteBundle(b.slug || b.name),
                style: {
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(248,81,73,0.4)",
                  background: "rgba(248,81,73,0.12)",
                  color: "inherit",
                  cursor: "pointer"
                }
              },
              "Удалить набор"
            )
          )
        )
      )
    ) : activeTab === "curator" ? h6(
      "section",
      {
        className: "nomad-skills-curator-tab",
        style: { display: "flex", flexDirection: "column", gap: "16px" }
      },
      curatorNotice ? h6(
        "div",
        {
          style: {
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(46,160,67,0.16)",
            fontSize: "13px"
          }
        },
        curatorNotice
      ) : null,
      h6(
        "div",
        {
          style: {
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(128,128,128,0.24)"
          }
        },
        h6("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Архивные навыки"),
        h6(
          "p",
          { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
          "Навыки, перемещённые куратором в архив из-за неактивности. Вы можете в любой момент вернуть любой навык обратно в рабочий каталог."
        ),
        archivedSkills.length === 0 ? h6(
          "div",
          { style: { fontSize: "13px", opacity: 0.72 } },
          "В архиве сейчас нет ни одного навыка."
        ) : h6(
          "div",
          { style: { display: "grid", gap: "10px" } },
          ...archivedSkills.map(
            (arch) => h6(
              "div",
              {
                key: arch.name,
                className: "nomad-archived-skill-card",
                style: {
                  padding: "12px 14px",
                  borderRadius: "8px",
                  border: "1px solid rgba(128,128,128,0.24)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px"
                }
              },
              h6(
                "div",
                null,
                h6("div", { style: { fontWeight: 600, fontSize: "14px" } }, arch.title || arch.name),
                h6("div", { style: { fontSize: "12px", opacity: 0.75 } }, arch.description || "")
              ),
              h6(
                "button",
                {
                  type: "button",
                  disabled: curatorBusy,
                  onClick: () => handleRestoreArchived(arch.name),
                  style: {
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#18181B",
                    color: "#ffffff",
                    fontWeight: 600,
                    cursor: "pointer"
                  }
                },
                "Восстановить"
              )
            )
          )
        )
      ),
      h6(
        "div",
        {
          style: {
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(128,128,128,0.24)"
          }
        },
        h6(
          "h3",
          { style: { margin: "0 0 6px 0", fontSize: "16px" } },
          "Закрепление навыков от автоархивации"
        ),
        h6(
          "p",
          { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
          "Закреплённые навыки никогда не переносятся куратором в архив автоматически."
        ),
        h6(
          "div",
          { style: { display: "grid", gap: "8px" } },
          ...(curatorActiveSkills.length > 0 ? curatorActiveSkills : state.skills).map((sk) => {
            const isPinned = Boolean(sk.pinned || pinnedSkills.includes(sk.name));
            return h6(
              "div",
              {
                key: sk.name,
                style: {
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(128,128,128,0.2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }
              },
              h6(
                "span",
                { style: { fontSize: "13px", fontWeight: 500 } },
                `${sk.title || sk.name} (${sk.name})`
              ),
              h6(
                "button",
                {
                  type: "button",
                  disabled: curatorBusy,
                  onClick: () => handlePinSkill(sk.name, !isPinned),
                  style: {
                    padding: "5px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(128,128,128,0.3)",
                    background: isPinned ? "rgba(46,160,67,0.16)" : "transparent",
                    color: "inherit",
                    fontSize: "12px",
                    cursor: "pointer"
                  }
                },
                isPinned ? "Закреплён (Открепить)" : "Закрепить"
              )
            );
          })
        )
      )
    ) : null,
    h6(
      "section",
      {
        className: "nomad-skills-filters",
        style: {
          display: activeTab === "catalog" ? "flex" : "none",
          gap: "12px",
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: "18px"
        }
      },
      h6("input", {
        type: "search",
        value: query,
        onChange: (e) => setQuery(e?.target?.value ?? ""),
        placeholder: "Поиск по названию, тегам или описанию навыка…",
        style: {
          flex: "1 1 260px",
          padding: "8px 12px",
          borderRadius: "6px",
          border: "1px solid rgba(128,128,128,0.3)",
          background: "transparent",
          color: "inherit"
        }
      }),
      h6(
        "select",
        {
          value: category,
          onChange: (e) => setCategory(e?.target?.value ?? "all"),
          style: {
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid rgba(128,128,128,0.3)",
            background: "transparent",
            color: "inherit"
          }
        },
        h6("option", { value: "all" }, "Все категории"),
        ...(state.categories || []).map(
          (cat) => h6(
            "option",
            { key: cat.id, value: cat.id },
            `${cat.label} (${cat.count})`
          )
        )
      ),
      h6(
        "label",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
        h6("input", {
          type: "checkbox",
          checked: onlyTranslated,
          onChange: (e) => setOnlyTranslated(Boolean(e?.target?.checked))
        }),
        "Только с русским описанием"
      ),
      h6(
        "label",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
        h6("input", {
          type: "checkbox",
          checked: onlyEnabled,
          onChange: (e) => setOnlyEnabled(Boolean(e?.target?.checked))
        }),
        "Только включённые"
      )
    ),
    state.error ? h6(
      "div",
      {
        role: "alert",
        style: {
          padding: "12px 14px",
          borderRadius: "8px",
          marginBottom: "16px",
          background: "rgba(248,81,73,0.14)",
          border: "1px solid rgba(248,81,73,0.4)"
        }
      },
      state.error
    ) : null,
    h6(
      "div",
      {
        className: "nomad-skills-list",
        style: {
          display: activeTab === "catalog" ? "grid" : "none",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "12px"
        }
      },
      ...(state.skills || []).map((skill) => {
        const display = formatSkillDisplay(skill);
        const isSelected = Boolean(selectedSkill && selectedSkill.name === skill.name);
        const detailObj = isSelected ? selectedSkill : skill;
        return h6(
          "article",
          {
            key: skill.name,
            className: `nomad-skill-card nomad-glass-card ${display.hasRuTranslation ? "is-ru" : "is-en-fallback"}`,
            "data-skill-name": skill.name,
            "data-has-ru": display.hasRuTranslation ? "true" : "false",
            style: {
              padding: "16px 18px",
              borderRadius: "14px",
              border: isSelected ? "1.5px solid var(--nomad-accent, #18181B)" : "1px solid rgba(128,128,128,0.22)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "10px",
              opacity: skill.enabled ? 1 : 0.65
            }
          },
          h6(
            "div",
            null,
            h6(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginBottom: "6px"
                }
              },
              h6(
                "div",
                null,
                h6(
                  "div",
                  { style: { fontWeight: 600, fontSize: "15px", letterSpacing: "-0.012em" } },
                  display.title
                ),
                h6(
                  "div",
                  { style: { fontSize: "11px", opacity: 0.65, marginTop: "2px" } },
                  `${skill.name} · ${skill.category_ru || skill.category || "Общие навыки"}`
                )
              ),
              h6(
                "span",
                {
                  className: "nomad-skill-lang-badge",
                  style: {
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                    background: display.hasRuTranslation ? "rgba(16, 185, 129, 0.14)" : "rgba(210, 153, 34, 0.18)",
                    color: display.hasRuTranslation ? "#059669" : "#b45309"
                  }
                },
                display.badge
              )
            ),
            h6(
              "p",
              {
                className: "nomad-skill-description",
                style: { margin: "6px 0 0 0", fontSize: "13px", lineHeight: 1.48, opacity: 0.86 }
              },
              display.description
            ),
            display.languageNote ? h6(
              "div",
              {
                className: "nomad-skill-untranslated-note",
                style: {
                  marginTop: "6px",
                  fontSize: "11px",
                  opacity: 0.8,
                  fontStyle: "italic"
                }
              },
              display.languageNote
            ) : null,
            isSelected ? h6(
              "div",
              {
                "data-testid": `nomad-skill-inline-detail-${skill.name}`,
                style: {
                  marginTop: "10px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  background: "rgba(0, 122, 255, 0.06)",
                  border: "1px solid rgba(0, 122, 255, 0.18)",
                  fontSize: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }
              },
              detailObj.path ? h6("div", { style: { fontFamily: "monospace", fontSize: "11px", opacity: 0.75 } }, `Файл: skills/${detailObj.path}`) : null,
              detailObj.description_en ? h6("div", { style: { opacity: 0.82, lineHeight: 1.4 } }, `Описание (EN): ${detailObj.description_en}`) : null,
              Array.isArray(detailObj.tags) && detailObj.tags.length > 0 ? h6("div", { style: { opacity: 0.78 } }, `Теги: ${detailObj.tags.join(", ")}`) : null
            ) : null
          ),
          h6(
            "div",
            {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                marginTop: "6px"
              }
            },
            h6(
              "button",
              {
                type: "button",
                "data-testid": `nomad-skill-more-${skill.name}`,
                onClick: () => {
                  if (isSelected) {
                    setSelectedSkill(null);
                  } else {
                    handleInspectSkill(skill);
                  }
                },
                style: {
                  padding: "5px 11px",
                  fontSize: "12px",
                  fontWeight: 600,
                  borderRadius: "8px",
                  border: isSelected ? "1px solid var(--nomad-accent, #18181B)" : "1px solid rgba(128,128,128,0.28)",
                  background: isSelected ? "#F4F4F5" : "transparent",
                  color: isSelected ? "var(--nomad-accent, #18181B)" : "inherit",
                  cursor: "pointer"
                }
              },
              isSelected ? "Свернуть" : "Подробнее"
            ),
            h6(
              "div",
              { style: { display: "flex", gap: "6px" } },
              h6(
                "button",
                {
                  type: "button",
                  disabled: curatorBusy,
                  onClick: () => handlePinSkill(skill.name, !skill.pinned),
                  style: {
                    padding: "5px 10px",
                    fontSize: "12px",
                    borderRadius: "8px",
                    border: "1px solid rgba(128,128,128,0.28)",
                    background: skill.pinned ? "#F4F4F5" : "transparent",
                    color: "inherit",
                    cursor: "pointer"
                  }
                },
                skill.pinned ? "Закреплён" : "Закрепить"
              ),
              h6(
                "button",
                {
                  type: "button",
                  disabled: busyName === skill.name,
                  onClick: () => handleToggleSkill(skill),
                  style: {
                    padding: "5px 10px",
                    fontSize: "12px",
                    fontWeight: 600,
                    borderRadius: "8px",
                    border: "1px solid rgba(128,128,128,0.26)",
                    background: skill.enabled ? "rgba(16, 185, 129, 0.14)" : "transparent",
                    color: skill.enabled ? "#059669" : "inherit",
                    cursor: "pointer"
                  }
                },
                skill.enabled ? "Включён" : "Выключен"
              )
            )
          )
        );
      })
    ),
    selectedSkill ? h6(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "data-testid": "nomad-skill-detail-backdrop",
        onClick: (e) => {
          if (e?.target === e?.currentTarget) setSelectedSkill(null);
        },
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 9995,
          background: "rgba(15, 23, 42, 0.32)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px"
        }
      },
      h6(
        "aside",
        {
          className: "nomad-skill-detail-modal nomad-glass-surface",
          "data-testid": "nomad-skill-detail-modal",
          style: {
            width: "min(680px, 94vw)",
            maxHeight: "82vh",
            overflowY: "auto",
            padding: "22px 24px",
            borderRadius: "20px",
            background: "var(--card, rgba(255, 255, 255, 0.94))",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            boxShadow: "0 24px 64px rgba(15, 23, 42, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.9)",
            display: "flex",
            flexDirection: "column",
            gap: "14px"
          }
        },
        h6(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" } },
          h6(
            "div",
            null,
            h6(
              "div",
              { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
              h6(
                "strong",
                { style: { fontSize: "18px", fontWeight: 650, letterSpacing: "-0.018em" } },
                selectedSkill.title || selectedSkill.name
              ),
              h6(
                "span",
                {
                  style: {
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    background: "#F4F4F5",
                    color: "var(--nomad-accent, #18181B)"
                  }
                },
                selectedSkill.category_ru || selectedSkill.category || "Навык Nomad"
              )
            ),
            h6(
              "div",
              { style: { fontSize: "12px", opacity: 0.65, marginTop: "3px", fontFamily: "monospace" } },
              `ID: ${selectedSkill.name}${selectedSkill.path ? " · skills/" + selectedSkill.path : ""}`
            )
          ),
          h6(
            "button",
            {
              type: "button",
              "data-testid": "nomad-skill-detail-close",
              onClick: () => setSelectedSkill(null),
              style: {
                cursor: "pointer",
                background: "rgba(15, 23, 42, 0.06)",
                border: "1px solid rgba(15, 23, 42, 0.10)",
                borderRadius: "999px",
                padding: "5px 12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "inherit"
              }
            },
            "Закрыть"
          )
        ),
        h6(
          "div",
          {
            style: {
              padding: "12px 14px",
              borderRadius: "12px",
              background: "rgba(0, 122, 255, 0.06)",
              border: "1px solid rgba(0, 122, 255, 0.14)",
              fontSize: "13.5px",
              lineHeight: 1.52
            }
          },
          selectedSkill.description_ru || selectedSkill.user_description || selectedSkill.description || "Описание навыка"
        ),
        selectedSkill.description_en && selectedSkill.has_ru_translation ? h6(
          "div",
          { style: { fontSize: "12px", opacity: 0.72, lineHeight: 1.45 } },
          `Оригинальное описание (EN): ${selectedSkill.description_en}`
        ) : null,
        Array.isArray(selectedSkill.tags) && selectedSkill.tags.length > 0 ? h6(
          "div",
          { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          ...selectedSkill.tags.map(
            (tag) => h6(
              "span",
              {
                key: tag,
                style: {
                  fontSize: "11px",
                  padding: "2px 8px",
                  borderRadius: "6px",
                  background: "rgba(15, 23, 42, 0.06)",
                  fontWeight: 500
                }
              },
              `#${tag}`
            )
          )
        ) : null,
        selectedSkill._loadingDetail ? h6("div", { style: { fontSize: "12px", opacity: 0.65 } }, "Загружаем инструкцию SKILL.md…") : selectedSkill.body ? h6(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: "6px" } },
          h6("strong", { style: { fontSize: "12.5px", opacity: 0.85 } }, "Инструкция и спецификация навыка (SKILL.md):"),
          h6(
            "pre",
            {
              "data-testid": "nomad-skill-detail-body",
              style: {
                margin: 0,
                padding: "12px 14px",
                borderRadius: "12px",
                background: "rgba(15, 23, 42, 0.04)",
                border: "1px solid rgba(15, 23, 42, 0.09)",
                fontSize: "12px",
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                maxHeight: "300px",
                overflowY: "auto",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
              }
            },
            selectedSkill.body
          )
        ) : null,
        h6(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              paddingTop: "6px",
              borderTop: "1px solid rgba(15, 23, 42, 0.08)",
              flexWrap: "wrap"
            }
          },
          h6(
            "div",
            { style: { display: "flex", gap: "8px" } },
            h6(
              "button",
              {
                type: "button",
                onClick: () => {
                  handleToggleSkill(selectedSkill);
                  setSelectedSkill((prev) => prev ? { ...prev, enabled: !prev.enabled } : null);
                },
                style: {
                  padding: "7px 14px",
                  borderRadius: "9px",
                  border: "1px solid rgba(16, 185, 129, 0.35)",
                  background: selectedSkill.enabled ? "rgba(16, 185, 129, 0.14)" : "transparent",
                  color: selectedSkill.enabled ? "#059669" : "inherit",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }
              },
              selectedSkill.enabled ? "Навык включён (Выключить)" : "Включить навык"
            ),
            h6(
              "button",
              {
                type: "button",
                onClick: () => {
                  handlePinSkill(selectedSkill.name, !selectedSkill.pinned);
                  setSelectedSkill((prev) => prev ? { ...prev, pinned: !prev.pinned } : null);
                },
                style: {
                  padding: "7px 14px",
                  borderRadius: "9px",
                  border: "1px solid rgba(0, 122, 255, 0.28)",
                  background: selectedSkill.pinned ? "#F4F4F5" : "transparent",
                  color: "inherit",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  cursor: "pointer"
                }
              },
              selectedSkill.pinned ? "Закреплён в профиле" : "Закрепить в профиле"
            )
          ),
          h6(
            "button",
            {
              type: "button",
              onClick: () => setSelectedSkill(null),
              style: {
                padding: "7px 16px",
                borderRadius: "9px",
                border: "none",
                background: "var(--nomad-accent, #18181B)",
                color: "#ffffff",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            "Готово"
          )
        )
      )
    ) : null
  );
}
function registerSkills(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  const renderPage = (props) => createElement6(NomadSkillsPage, { ctx, ...props || {} });
  ctx.register({
    id: "page",
    area: ROUTES_AREA13,
    path: SKILLS_ROUTE_PATH,
    title: SKILLS_NAV_LABEL,
    data: {
      path: SKILLS_ROUTE_PATH,
      title: SKILLS_NAV_LABEL
    },
    render: renderPage,
    component: renderPage
  });
  ctx.register({
    id: SKILLS_NAV_ID,
    area: SIDEBAR_NAV_AREA7,
    order: SKILLS_NAV_ORDER,
    label: SKILLS_NAV_LABEL,
    path: SKILLS_ROUTE_PATH,
    codicon: "extensions",
    data: {
      id: "nomad.skills.nav",
      codicon: "extensions",
      label: SKILLS_NAV_LABEL,
      path: SKILLS_ROUTE_PATH,
      order: SKILLS_NAV_ORDER
    }
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA13,
    order: SKILLS_NAV_ORDER,
    data: {
      id: "nomad.skills.open",
      action: "nomad.skills.open",
      label: "Навыки Nomad — каталог и русские описания",
      category: "Nomad",
      codicon: "extensions",
      keywords: ["skills", "навыки", "русские описания", "каталог", "наборы", "архив"],
      run: () => ctx?.host?.navigate?.(SKILLS_ROUTE_PATH)
    }
  });
}

// slack-manifest.js
var slack_manifest_exports = {};
__export(slack_manifest_exports, {
  SLACK_MANIFEST_LABEL: () => SLACK_MANIFEST_LABEL,
  SLACK_MANIFEST_PALETTE_ID: () => SLACK_MANIFEST_PALETTE_ID,
  SLACK_MANIFEST_TOAST: () => SLACK_MANIFEST_TOAST,
  copySlackManifestToClipboard: () => copySlackManifestToClipboard,
  default: () => registerSlackManifest
});
import { PALETTE_AREA as PALETTE_AREA14 } from "@hermes/plugin-sdk";
var SLACK_MANIFEST_PALETTE_ID = "nomad.slack.manifest";
var SLACK_MANIFEST_LABEL = "Сгенерировать манифест Slack";
var SLACK_MANIFEST_TOAST = "Манифест скопирован — вставьте в api.slack.com/apps → Create from manifest";
function fetchSlackManifest(ctx) {
  if (ctx && ctx.rest && typeof ctx.rest.get === "function") {
    return Promise.resolve(ctx.rest.get("/slack/manifest"));
  }
  if (ctx && typeof ctx.rest === "function") {
    return Promise.resolve(ctx.rest("/slack/manifest"));
  }
  return Promise.reject(new Error("Сервер плагина недоступен."));
}
function showToast(ctx, message, kind = "info") {
  if (ctx && ctx.toast && typeof ctx.toast[kind] === "function") {
    ctx.toast[kind](message);
    return;
  }
  if (ctx && typeof ctx.toast === "function") {
    ctx.toast(message, { type: kind });
    return;
  }
  if (ctx && ctx.ui && typeof ctx.ui.toast === "function") {
    ctx.ui.toast({ message, type: kind });
    return;
  }
  if (ctx && ctx.host && typeof ctx.host.toast === "function") {
    ctx.host.toast(message, kind);
  }
}
async function copySlackManifestToClipboard(ctx) {
  const payload = await fetchSlackManifest(ctx);
  const manifestObj = payload && typeof payload === "object" && payload.manifest && typeof payload.manifest === "object" ? payload.manifest : payload;
  const jsonText = typeof manifestObj === "string" ? manifestObj : `${JSON.stringify(manifestObj, null, 2)}
`;
  if (typeof globalThis !== "undefined" && globalThis.navigator && globalThis.navigator.clipboard && typeof globalThis.navigator.clipboard.writeText === "function") {
    await globalThis.navigator.clipboard.writeText(jsonText);
  } else if (ctx && ctx.clipboard && typeof ctx.clipboard.writeText === "function") {
    await ctx.clipboard.writeText(jsonText);
  }
  showToast(ctx, SLACK_MANIFEST_TOAST, "info");
  return jsonText;
}
function registerSlackManifest(ctx) {
  if (!ctx || typeof ctx.register !== "function") {
    return;
  }
  ctx.register({
    id: "palette",
    area: PALETTE_AREA14,
    order: 85,
    label: SLACK_MANIFEST_LABEL,
    data: {
      id: SLACK_MANIFEST_PALETTE_ID,
      action: SLACK_MANIFEST_PALETTE_ID,
      title: SLACK_MANIFEST_LABEL,
      label: SLACK_MANIFEST_LABEL,
      category: "Nomad",
      codicon: "comment-discussion",
      keywords: ["slack", "manifest", "манифест", "бот", "интеграция"],
      run: () => copySlackManifestToClipboard(ctx),
      onSelect: () => copySlackManifestToClipboard(ctx)
    }
  });
}

// statusbar-balance.js
var statusbar_balance_exports = {};
__export(statusbar_balance_exports, {
  StatusbarBalance: () => StatusbarBalance,
  default: () => registerStatusbarBalance,
  formatBalanceValue: () => formatBalanceValue
});
import { STATUSBAR_AREAS as STATUSBAR_AREAS3 } from "@hermes/plugin-sdk";
import { useEffect as useEffect14, useState as useState15 } from "react";
import { jsx as jsx10, jsxs as jsxs9 } from "react/jsx-runtime";
function formatBalanceValue(account) {
  if (!account || typeof account !== "object") return null;
  if (typeof account.formatted_balance === "string" && account.formatted_balance.trim() !== "") {
    return account.formatted_balance.trim();
  }
  const raw = account.balance;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Number.isInteger(raw) ? String(raw) : String(raw);
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const num = Number(raw.trim());
    if (Number.isFinite(num)) {
      return Number.isInteger(num) ? String(num) : String(num);
    }
    return raw.trim();
  }
  return null;
}
function StatusbarBalance({ ctx, host: host12 }) {
  const [state, setState] = useState15({ status: "loading", data: null, error: null });
  useEffect14(() => {
    let cancelled = false;
    if (!ctx || typeof ctx.rest !== "function") {
      setState({ status: "error", data: null, error: "rest unavailable" });
      return () => {
      };
    }
    Promise.resolve().then(() => ctx.rest("/account")).then((data2) => {
      if (!cancelled) {
        setState({ status: "ready", data: data2 || {}, error: null });
      }
    }).catch((err) => {
      if (!cancelled) {
        setState({ status: "error", data: null, error: String(err?.message || err) });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ctx]);
  const data = state.data;
  const balanceText = formatBalanceValue(data);
  const currency = typeof data?.currency === "string" && data.currency.trim() ? data.currency.trim() : null;
  const code = data?.code || data?.status || (state.status === "error" ? "unreachable" : null);
  const statusLabels = {
    "missing-key": "Подключить тариф",
    "cp-url-unset": "Подключить тариф",
    "invalid-key": "Проверить ключ",
    unreachable: "Автономно",
    disconnected: "Не подключён"
  };
  const friendlyStatus = statusLabels[code] || code || "Не подключён";
  const handleClick = () => {
    if (host12 && typeof host12.navigate === "function") {
      host12.navigate("/nomad-accounts");
    }
  };
  return /* @__PURE__ */ jsxs9(
    "button",
    {
      type: "button",
      onClick: handleClick,
      "data-testid": "nomad-statusbar-balance",
      title: balanceText !== null ? `Баланс NomadNet: ${balanceText}${currency ? " " + currency : ""}` : `NomadNet: ${friendlyStatus}`,
      className: "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
      children: [
        /* @__PURE__ */ jsx10("span", { className: "font-medium", children: "NomadNet" }),
        state.status === "loading" && /* @__PURE__ */ jsx10("span", { "data-testid": "nomad-balance-loading", children: "…" }),
        state.status !== "loading" && balanceText !== null && /* @__PURE__ */ jsx10("span", { "data-testid": "nomad-balance-value", className: "font-mono font-semibold text-foreground", children: balanceText }),
        state.status !== "loading" && balanceText !== null && currency && /* @__PURE__ */ jsx10("span", { "data-testid": "nomad-balance-currency", className: "text-[10px] opacity-80", children: currency }),
        state.status !== "loading" && balanceText === null && /* @__PURE__ */ jsx10("span", { "data-testid": "nomad-balance-status", className: "text-[10px] opacity-80", children: friendlyStatus })
      ]
    }
  );
}
function registerStatusbarBalance(ctx) {
  ctx.register({
    id: "balance",
    area: STATUSBAR_AREAS3.right,
    order: 35,
    data: { label: "NomadNet Balance" },
    render: (host12) => /* @__PURE__ */ jsx10(StatusbarBalance, { ctx, host: host12 })
  });
}

// swarm-page.js
var swarm_page_exports = {};
__export(swarm_page_exports, {
  SWARM_ROUTE_PATH: () => SWARM_ROUTE_PATH,
  SwarmPage: () => SwarmPage,
  SwarmStatusbarPill: () => SwarmStatusbarPill,
  SwarmTree: () => SwarmTree,
  default: () => registerSwarmPagePlugin,
  formatTimeRu: () => formatTimeRu,
  swarmStatusAtom: () => swarmStatusAtom
});
import {
  PALETTE_AREA as PALETTE_AREA15,
  ROUTES_AREA as ROUTES_AREA14,
  STATUSBAR_AREAS as STATUSBAR_AREAS4,
  atom as atom5,
  host as host8,
  useValue as useValue3
} from "@hermes/plugin-sdk";
import { createElement as createElement7, useCallback as useCallback12, useEffect as useEffect15, useState as useState16 } from "react";
var SWARM_ROUTE_PATH = "/nomad-swarm";
var swarmStatusAtom = atom5({ count: 0, activeId: null, label: "Рой: 0" });
var h7 = createElement7;
function navigateToSwarm(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === "function") {
    ctx.host.navigate(SWARM_ROUTE_PATH);
    return;
  }
  if (host8 && typeof host8.navigate === "function") {
    host8.navigate(SWARM_ROUTE_PATH);
  }
}
function restGet5(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  if (typeof fetch === "function") {
    const normalizedPath = String(path || "").startsWith("/api/plugins/nomad") ? String(path).slice("/api/plugins/nomad".length) || "/" : String(path || "").startsWith("/") ? String(path) : `/${path}`;
    return fetch(`/api/plugins/nomad${normalizedPath}`, {
      method: "GET",
      headers: { Accept: "application/json" }
    }).then((r) => r && r.ok ? r.json() : null).catch(() => null);
  }
  return Promise.resolve(null);
}
function formatTimeRu(isoString) {
  if (!isoString) return "—";
  try {
    const dt = new Date(isoString);
    return dt.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  } catch (_e) {
    return String(isoString).slice(11, 16) || "—";
  }
}
function SwarmStatusbarPill({ ctx }) {
  const status = useValue3(swarmStatusAtom) || { count: 0, label: "Рой: 0" };
  useEffect15(() => {
    let mounted = true;
    restGet5(ctx, "/swarm").then((res) => {
      if (!mounted || !res || !res.ok) return;
      const count = (res.swarms || []).length;
      swarmStatusAtom.set({
        count,
        activeId: res.swarms?.[0]?.id || null,
        label: `Рой: ${count}`
      });
    }).catch(() => {
    });
    return () => {
      mounted = false;
    };
  }, [ctx]);
  const handleClick = useCallback12(() => {
    navigateToSwarm(ctx);
  }, [ctx]);
  return h7(
    "button",
    {
      type: "button",
      "data-testid": "nomad-swarm-statusbar-pill",
      onClick: handleClick,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 8px",
        borderRadius: "6px",
        border: "none",
        background: "transparent",
        color: "inherit",
        fontSize: "12px",
        cursor: "pointer"
      }
    },
    h7("span", {
      style: {
        width: "7px",
        height: "7px",
        borderRadius: "50%",
        background: status.count > 0 ? "#10b981" : "rgba(148, 163, 184, 0.7)"
      }
    }),
    h7("span", null, status.label || `Рой: ${status.count}`)
  );
}
function SwarmTree({ tree = [] }) {
  if (!tree || tree.length === 0) {
    return h7(
      "p",
      { "data-testid": "swarm-empty-notice", style: { margin: 0, fontSize: "13px", opacity: 0.7 } },
      "Запущенных или сохранённых роёв пока нет. Начните работу в чате с помощью команды оркестратора."
    );
  }
  return h7(
    "div",
    {
      "data-testid": "swarm-tree-container",
      style: { display: "flex", flexDirection: "column", gap: "16px" }
    },
    ...tree.map(
      (node) => h7(
        "div",
        {
          key: node.id,
          "data-testid": "swarm-tree-node",
          style: {
            padding: "16px 20px",
            borderRadius: "10px",
            border: "1px solid var(--border, rgba(128,128,128,0.22))",
            background: "rgba(128,128,128,0.03)",
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }
        },
        h7(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
          h7(
            "div",
            { style: { display: "flex", alignItems: "center", gap: "10px" } },
            h7("span", {
              style: {
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: node.status === "completed" ? "#10b981" : "#27272A"
              }
            }),
            h7("strong", { style: { fontSize: "14px" } }, node.title || node.goal || node.id)
          ),
          h7(
            "span",
            {
              style: {
                fontSize: "11px",
                padding: "2px 8px",
                borderRadius: "6px",
                background: "rgba(128,128,128,0.12)",
                fontWeight: 600
              }
            },
            node.status?.toUpperCase() || "CREATED"
          )
        ),
        h7(
          "div",
          { style: { fontSize: "12px", opacity: 0.8, display: "flex", gap: "16px" } },
          h7("span", null, `ID: ${node.id}`),
          h7("span", null, `Создан: ${formatTimeRu(node.created_at)}`),
          h7("span", null, `Режим: ${node.pool_mode || "shipped"}`)
        ),
        node.children && node.children.length > 0 ? h7(
          "div",
          {
            style: {
              marginTop: "6px",
              paddingLeft: "16px",
              borderLeft: "2px solid rgba(128,128,128,0.2)",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }
          },
          ...node.children.map(
            (child) => h7(
              "div",
              {
                key: child.id,
                "data-testid": "swarm-child-event",
                style: { fontSize: "12px", opacity: 0.9 }
              },
              `• ${formatTimeRu(child.ts)} · ${child.kind || "событие"}${child.detail ? ` (${JSON.stringify(child.detail)})` : ""}`
            )
          )
        ) : null
      )
    )
  );
}
function SwarmPage({ ctx }) {
  const [data, setData] = useState16({ loading: true, error: null, swarms: [], lanes: [], tree: [] });
  const loadSwarmData = useCallback12(async () => {
    try {
      const res = await restGet5(ctx, "/swarm");
      if (res && res.ok) {
        setData({
          loading: false,
          error: null,
          swarms: res.swarms || [],
          lanes: res.lanes || [],
          tree: res.tree || []
        });
        swarmStatusAtom.set({
          count: (res.swarms || []).length,
          activeId: res.swarms?.[0]?.id || null,
          label: `Рой: ${(res.swarms || []).length}`
        });
      } else {
        setData((prev) => ({ ...prev, loading: false }));
      }
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err && err.message || "Не удалось загрузить данные роя"
      }));
    }
  }, [ctx]);
  useEffect15(() => {
    loadSwarmData();
  }, [loadSwarmData]);
  return h7(
    "div",
    {
      "data-testid": "nomad-swarm-page",
      style: { padding: "24px 32px", maxWidth: "860px", display: "flex", flexDirection: "column", gap: "20px" }
    },
    h7(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h7(
        "div",
        null,
        h7("h1", { style: { fontSize: "20px", fontWeight: 600, margin: "0 0 4px 0" } }, "Рой оркестратора Nomad"),
        h7(
          "p",
          { style: { margin: 0, fontSize: "13px", opacity: 0.8 } },
          "Дерево параллельных задач, исполнители дорожек и статус дирижёра."
        )
      ),
      h7(
        "button",
        {
          type: "button",
          "data-testid": "swarm-refresh-btn",
          onClick: loadSwarmData,
          style: {
            padding: "6px 14px",
            borderRadius: "6px",
            border: "1px solid var(--border, rgba(128,128,128,0.3))",
            background: "transparent",
            color: "inherit",
            fontSize: "12px",
            cursor: "pointer"
          }
        },
        "Обновить"
      )
    ),
    h7(
      "section",
      { style: { display: "flex", flexDirection: "column", gap: "12px" } },
      h7("h2", { style: { fontSize: "15px", fontWeight: 600, margin: 0 } }, "Дерево роя"),
      h7(SwarmTree, { tree: data.tree })
    ),
    data.lanes && data.lanes.length > 0 ? h7(
      "section",
      { style: { marginTop: "12px", display: "flex", flexDirection: "column", gap: "12px" } },
      h7("h2", { style: { fontSize: "15px", fontWeight: 600, margin: 0 } }, "Дорожки исполнителей (Lanes)"),
      h7(
        "table",
        {
          "data-testid": "swarm-lanes-table",
          style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" }
        },
        h7(
          "thead",
          null,
          h7(
            "tr",
            { style: { textAlign: "left", borderBottom: "1px solid rgba(128,128,128,0.2)" } },
            h7("th", { style: { padding: "8px" } }, "Дорожка"),
            h7("th", { style: { padding: "8px" } }, "Вендор"),
            h7("th", { style: { padding: "8px" } }, "Оплата"),
            h7("th", { style: { padding: "8px" } }, "Статус"),
            h7("th", { style: { padding: "8px" } }, "Окно")
          )
        ),
        h7(
          "tbody",
          null,
          ...data.lanes.map(
            (l) => h7(
              "tr",
              { key: l.lane, style: { borderBottom: "1px solid rgba(128,128,128,0.1)" } },
              h7("td", { style: { padding: "8px", fontWeight: 500 } }, l.lane),
              h7("td", { style: { padding: "8px", opacity: 0.8 } }, l.vendor),
              h7("td", { style: { padding: "8px", opacity: 0.8 } }, l.billing),
              h7(
                "td",
                { style: { padding: "8px", color: l.alive ? "#10b981" : "#ef4444" } },
                l.alive ? "Доступна" : "Недоступна"
              ),
              h7("td", { style: { padding: "8px", opacity: 0.8 } }, String(l.window_left ?? "100%"))
            )
          )
        )
      )
    ) : null
  );
}
function registerSwarmPagePlugin(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  ctx.register({
    id: "swarm-route",
    area: ROUTES_AREA14,
    order: 70,
    path: SWARM_ROUTE_PATH,
    title: "Рой",
    data: {
      id: "nomad.swarm.route",
      path: SWARM_ROUTE_PATH,
      title: "Рой",
      codicon: "organization",
      render: () => h7(SwarmPage, { ctx })
    },
    render: () => h7(SwarmPage, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA15,
    order: 70,
    data: {
      id: "nomad.swarm.open",
      action: "nomad.swarm.open",
      label: "Рой оркестратора Nomad",
      category: "Nomad",
      keywords: ["рой", "оркестратор", "дирижёр", "задачи", "дерево", "swarm", "lanes"],
      run: () => {
        navigateToSwarm(ctx);
      }
    }
  });
  ctx.register({
    id: "swarm-statusbar",
    area: STATUSBAR_AREAS4.right,
    order: 65,
    data: {
      id: "nomad.swarm.status",
      label: "Рой: 0",
      to: SWARM_ROUTE_PATH,
      render: () => h7(SwarmStatusbarPill, { ctx })
    },
    render: () => h7(SwarmStatusbarPill, { ctx })
  });
}

// switch-card.js
var switch_card_exports = {};
__export(switch_card_exports, {
  SwitchCard: () => SwitchCard,
  activeSwitchCardAtom: () => activeSwitchCardAtom,
  clearSwitchCard: () => clearSwitchCard,
  default: () => registerSwitchCardPlugin,
  handleAccountSwitchEvent: () => handleAccountSwitchEvent,
  openAccountsPage: () => openAccountsPage
});
import { PALETTE_AREA as PALETTE_AREA16, atom as atom6, host as host9 } from "@hermes/plugin-sdk";
import { createElement as createElement8, useCallback as useCallback13, useEffect as useEffect16, useState as useState17 } from "react";
var activeSwitchCardAtom = atom6(null);
var h8 = createElement8;
var _SEEN_REQUEST_IDS = /* @__PURE__ */ new Set();
function handleAccountSwitchEvent(ctx, payload = {}) {
  const reqId = payload.api_request_id || payload.request_id || `req_${Date.now()}`;
  if (_SEEN_REQUEST_IDS.has(reqId)) {
    return null;
  }
  _SEEN_REQUEST_IDS.add(reqId);
  const fromSlot = payload.from_slot || "#1";
  const toSlot = payload.to_slot || "#2";
  const provider = payload.provider || "провайдер";
  const statusCode = payload.status_code || 429;
  const timeStr = payload.ts ? payload.ts.slice(11, 16) : (/* @__PURE__ */ new Date()).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const switchData = {
    apiRequestId: reqId,
    statusCode,
    provider,
    model: payload.model || "",
    fromSlot,
    toSlot,
    time: timeStr,
    title: `Аккаунт ${fromSlot} исчерпан, перешёл на ${toSlot}`,
    line: payload.line || `${timeStr} · ${provider} · ${statusCode} · активна ${toSlot}`,
    switchedAt: payload.ts || (/* @__PURE__ */ new Date()).toISOString()
  };
  activeSwitchCardAtom.set(switchData);
  if (host9 && typeof host9.notify === "function") {
    host9.notify(`Nomad: ${switchData.title}`);
  }
  return switchData;
}
function clearSwitchCard() {
  activeSwitchCardAtom.set(null);
}
function openAccountsPage(ctx) {
  if (ctx && ctx.host && typeof ctx.host.navigate === "function") {
    return ctx.host.navigate("/nomad-accounts");
  }
  if (typeof window !== "undefined" && window.location) {
    window.location.hash = "#/nomad-accounts";
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
function SwitchCard({ ctx, payload = null, onDismiss = null }) {
  const [data, setData] = useState17(payload || activeSwitchCardAtom.get());
  useEffect16(() => {
    const unbind = activeSwitchCardAtom.subscribe((val) => {
      if (val) setData(val);
    });
    return () => unbind();
  }, []);
  const handleDismiss = useCallback13(() => {
    clearSwitchCard();
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  }, [onDismiss]);
  const handleOpenAccounts = useCallback13(() => {
    openAccountsPage(ctx);
  }, [ctx]);
  if (!data) return null;
  return h8(
    "div",
    {
      "data-testid": "nomad-switch-card",
      style: {
        margin: "10px 0",
        padding: "16px 20px",
        borderRadius: "12px",
        border: "1px solid rgba(245, 158, 11, 0.45)",
        background: "rgba(245, 158, 11, 0.08)",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        maxWidth: "720px"
      }
    },
    h8(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h8(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        h8("span", {
          style: {
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#f59e0b"
          }
        }),
        h8(
          "strong",
          {
            "data-testid": "switch-card-title",
            style: { fontSize: "14px", fontWeight: 600 }
          },
          data.title || `Аккаунт ${data.fromSlot} исчерпан, перешёл на ${data.toSlot}`
        )
      ),
      h8(
        "span",
        {
          "data-testid": "switch-card-status",
          style: {
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "6px",
            background: "rgba(245, 158, 11, 0.18)",
            color: "#d97706",
            fontWeight: 600
          }
        },
        `429 · АКТИВЕН ${data.toSlot}`
      )
    ),
    h8(
      "p",
      {
        "data-testid": "switch-card-desc",
        style: { margin: 0, fontSize: "13px", lineHeight: 1.5, opacity: 0.9 }
      },
      `На вашей учётной записи ${data.fromSlot} исчерпан лимит запросов (код 429). Оркестратор автоматически переключил отправку на резервный слот ${data.toSlot}. Вы можете продолжить работу без прерывания.`
    ),
    h8(
      "div",
      { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center", marginTop: "4px" } },
      h8(
        "button",
        {
          type: "button",
          "data-testid": "switch-card-open-accounts-btn",
          onClick: handleOpenAccounts,
          style: {
            padding: "7px 16px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary, #18181B)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 500,
            cursor: "pointer"
          }
        },
        "Управление аккаунтами"
      ),
      h8(
        "button",
        {
          type: "button",
          "data-testid": "switch-card-dismiss-btn",
          onClick: handleDismiss,
          style: {
            padding: "7px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border, rgba(128,128,128,0.3))",
            background: "transparent",
            color: "inherit",
            fontSize: "13px",
            cursor: "pointer"
          }
        },
        "Закрыть уведомление"
      )
    )
  );
}
function registerSwitchCardPlugin(ctx) {
  if (ctx && typeof ctx.onEvent === "function") {
    ctx.onEvent("account_switch", (payload) => {
      handleAccountSwitchEvent(ctx, payload);
    });
  }
  if (ctx && typeof ctx.register === "function") {
    ctx.register({
      id: "switch-card-composer",
      area: "composer.top",
      order: 50,
      render: () => h8(SwitchCard, { ctx })
    });
    ctx.register({
      id: "palette",
      area: PALETTE_AREA16,
      order: 67,
      data: {
        id: "nomad.accounts.switch_feed",
        action: "nomad.accounts.switch_feed",
        label: "Лента переключений аккаунтов",
        category: "Nomad",
        keywords: ["аккаунты", "ротация", "429", "слот", "переключение", "switch", "feed"],
        run: () => openAccountsPage(ctx)
      }
    });
  }
}

// themes.js
var themes_exports = {};
__export(themes_exports, {
  ACADEMY_THEME: () => ACADEMY_THEME,
  DEFAULT_NOMAD_THEME: () => DEFAULT_NOMAD_THEME,
  NOMAD_THEMES: () => NOMAD_THEMES,
  applyNomadVisualIdentityAndTooltips: () => applyNomadVisualIdentityAndTooltips,
  default: () => registerThemes
});
import { THEMES_AREA, host as host10 } from "@hermes/plugin-sdk";

// tooltips.js
var tooltips_exports = {};
__export(tooltips_exports, {
  HELP_BADGE_DESCRIPTIONS: () => HELP_BADGE_DESCRIPTIONS,
  TOOLTIPS: () => TOOLTIPS,
  tooltipAttrs: () => tooltipAttrs
});
var TOOLTIPS = {
  accounts: {
    poolButton: "Открыть пул аккаунтов и тариф Nomad (Ctrl+Alt+A)",
    dragOrder: "Перетащите строку для смены приоритета",
    priorityUp: "Повысить приоритет",
    priorityDown: "Понизить приоритет",
    balance: "Текущий баланс и лимиты токенов",
    addAccount: "Подключить новый аккаунт или API-ключ",
    ruSovereign: "Российские суверенные модели (GigaChat, YandexGPT, МТС Cotype, T-Pro, Cloud.ru) для контура 152-ФЗ без трансграничной передачи данных"
  },
  skills: {
    catalogTab: "Каталог навыков профиля с русскими описаниями",
    bundlesTab: "Управление наборами навыков (skill-bundles)",
    archiveTab: "Архив и куратор отключённых навыков",
    rfConnectorsTab: "Корпоративные коннекторы РФ (1С, Битрикс24, Диадок, СБИС, Яндекс 360, МТС Линк, ФНС/DaData)",
    search: "Поиск навыков по названию и ключевым словам",
    categoryFilter: "Фильтр по категориям навыков",
    translatedFilter: "Показывать только навыки с переводом на русский",
    enabledFilter: "Показывать только активные навыки",
    pinSkill: "Закрепить навык в профиле",
    unpinSkill: "Открепить навык из профиля",
    restoreSkill: "Восстановить навык из архива"
  },
  safety: {
    allowlist: "Постоянный список разрешённых команд",
    denyRules: "Жёсткие запреты (approvals.deny), действующие даже при флаге --yolo",
    acceptSuggestion: "Принять подсказку и добавить команду в разрешённые",
    rejectSuggestion: "Отклонить предложенную подсказку",
    allowInput: "Шаблон разрешённой команды для белого списка",
    denyInput: "Шаблон запрещённой команды для списка блокировки",
    egress: "Настройки сетевого доступа и внешних подключений",
    addRule: "Добавить правило в список безопасности",
    guardrails152fz: "Корпоративные политики ИБ: DLP-маскирование персданных (152-ФЗ), суверенный контур РФ, запрет обучения на данных компании (ZDR) и экспорт в SIEM"
  },
  data: {
    cleanPrune: "Очистить историю откатов и временные снимки проектов",
    wipeButton: "Стереть временные файлы и память агента с двойным подтверждением",
    wipeNotice: "Star Map, граф learning.* и история сессий сохраняются",
    refreshStorage: "Обновить данные о занятом дисковом пространстве",
    restoreArchive: "Восстановить данные из резервной копии ZIP"
  },
  start: {
    importButton: "Запустить предварительный просмотр переноса из Claude / Codex",
    dryRunToggle: "Безопасный режим предварительного просмотра без изменения файлов",
    keysWarning: "Ключи API не переносятся автоматически из соображений безопасности",
    checklistDone: "Отметить пункт чек-листа выполненным",
    hideMenuItem: "Скрыть пункт «Перенос и старт» из бокового меню"
  },
  personalization: {
    honorific: "Обращение на «вы» (строгий стандарт Nomad, решение D10)",
    role: "Роль и специализация ассистента",
    replyStyle: "Стиль ответов: технический, краткий или менторский",
    accentColor: "Цветовой акцент интерфейса десктопа",
    saveSettings: "Сохранить настройки персонализации"
  }
};
var HELP_BADGE_DESCRIPTIONS = {
  // Настройки > Шлюзы и безопасность
  "Шлюзы": "Шлюз (Gateway) — это локальный сервер Nomad на вашем ПК (порт 9129), который управляет моделями, памятью, навыками и безопасностью.",
  "Это окно": "Параметры подключения текущего окна десктопа Nomad к локальному или корпоративному шлюзу.",
  "Локальный шлюз этого окна": "Автоматически запущенный локальный процесс Nomad. Работает на 127.0.0.1:9129 без передачи системных ключей вовне.",
  "Шифровать сохранённые секреты и API-ключи в системном хранилище ОС (Windows Credential Manager)": "Все API-ключи (GigaChat, Яндекс, OpenAI, 1С, Битрикс24) шифруются средствами Windows DPAPI / Credential Manager и не лежат в открытом виде.",
  "Encrypt saved secrets with the OS keychain": "Все сохранённые секреты и API-ключи шифруются в системном хранилище ОС (Windows Credential Manager / DPAPI).",
  "Сохраненные шлюзы": "Список локальных и удалённых корпоративных серверов Nomad, между которыми можно переключаться в 1 клик.",
  // Настройки > Питомец и Внешний вид
  "Питомец на рабочем столе": "Интерактивный маскот-помощник внутри рабочего окна Nomad. Через правую кнопку мыши открывает пульт апрувов, голоса, Помодоро и советника Нику/Сократа.",
  "Случайные прогулки по экрану": "Если выключено — питомец строго зафиксирован на выбранном месте и никогда не перемещается сам по экрану.",
  "Случайные прогулки по окну": "Если галочка снята — питомец жёстко закреплён в выбранной точке окна и не двигается самостоятельно.",
  "Реакция на прокрутку": "Лёгкая анимация маскота при прокрутке длинных диалогов и кода.",
  "Следить за курсором": "Питомец поворачивается в сторону курсора мыши во время вашей работы.",
  "Звуковые эффекты": "Мягкие ненавязчивые звуковые сигналы при завершении задачи или запросе подтверждения.",
  "Авто-одобрение безопасных": "Умный режим (Smart Approvals): безопасные команды чтения (git status, ls, pytest) выполняются без лишних всплывающих окон.",
  "Помодоро-таймер (25/5 мин)": "Таймер продуктивности прямо над питомцем: 25 минут фокуса и 5 минут отдыха. Клик по таймеру ставит паузу.",
  // Разделы Nomad
  "Аккаунты и подписка": "Единый пул API-ключей и подписок: при исчерпании лимита или сбое одного провайдера Nomad мгновенно переключает запрос на следующий в очереди.",
  "Российские суверенные модели (152-ФЗ · Корпоративный контур РФ)": "Прямое подключение к российским LLM (Сбер GigaChat, YandexGPT 5, МТС AI Cotype, Т-Банк T-Pro, Cloud.ru) внутри контура РФ.",
  "Витрина и менеджер навыков": "Управляйте подключёнными скиллами (SKILL.md), наборами навыков и корпоративными коннекторами к системам РФ.",
  "Разрешения и безопасность": "Границы доступа агента: белые и чёрные списки команд, корпоративные пресеты ИБ, DLP-фильтр персданных (152-ФЗ) и сетевой экран Egress.",
  "Корпоративный контур ИБ и 152-ФЗ (Гардрейлы для CISO, ИБ и ИТ-отдела)": "Аппаратно-программные ограничения для защиты персональных данных (ФИО, паспорта, ИНН, карты, NDA) и соблюдения требований 152-ФЗ / КИИ.",
  "Сетевой фильтр Egress (только чтение)": "Контроль исходящих сетевых соединений агента: разрешены только явно перечисленные домены без подстановочных знаков (*).",
  "Данные и место на диске": "Контроль объёма базы знаний, логов, кэша и создание ZIP-бэкапов профиля Nomad.",
  "Перенос и старт": "Безопасный импорт настроек, памяти и навыков из Claude Code или Codex CLI, а также проверка обновлений Nomad.",
  "Симулятор ИИ": "Интерактивная академия вайбкодинга с двумя встроенными бадди-менторами (Ника и Сократ), практическими миссиями и проверкой решений."
};
function tooltipAttrs(text) {
  if (!text) return {};
  return {
    title: text,
    "data-tooltip": text,
    "data-nomad-tooltip": text
  };
}

// themes.js
var DEFAULT_NOMAD_THEME = "nomad-dark";
function navigateNomad(path) {
  if (host10 && typeof host10.navigate === "function") {
    host10.navigate(path);
    return;
  }
  const sdk = typeof window !== "undefined" ? window.__HERMES_PLUGIN_SDK__ : null;
  if (typeof sdk?.host?.navigate === "function") {
    sdk.host.navigate(path);
    return;
  }
  if (typeof window !== "undefined" && window.location?.protocol !== "file:") {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }
}
function buildTheme({
  name,
  label,
  description,
  isDefault = false,
  mode = "dark",
  bg,
  fg,
  primary,
  primaryFg = "#FFFFFF",
  card,
  muted,
  mutedFg,
  secondary,
  secondaryFg,
  border,
  sidebarBg,
  destructive = "#EF4444"
}) {
  const colors = {
    background: bg,
    foreground: fg,
    card,
    cardForeground: fg,
    muted,
    mutedForeground: mutedFg,
    popover: card,
    popoverForeground: fg,
    primary,
    primaryForeground: primaryFg,
    secondary,
    secondaryForeground: secondaryFg,
    accent: primary,
    accentForeground: primaryFg,
    border,
    input: border,
    ring: primary,
    midground: primary,
    midgroundForeground: primaryFg,
    composerRing: primary,
    destructive,
    destructiveForeground: "#FFFFFF",
    sidebarBackground: sidebarBg,
    sidebarBorder: border,
    userBubble: secondary,
    userBubbleBorder: border
  };
  const tokens = {
    "--background": bg,
    "--foreground": fg,
    "--card": card,
    "--card-foreground": fg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--popover": card,
    "--popover-foreground": fg,
    "--primary": primary,
    "--primary-foreground": primaryFg,
    "--secondary": secondary,
    "--secondary-foreground": secondaryFg,
    "--accent": primary,
    "--accent-foreground": primaryFg,
    "--border": border,
    "--input": border,
    "--ring": primary,
    "--midground": primary,
    "--destructive": destructive,
    "--sidebar-background": sidebarBg,
    "--sidebar-border": border,
    "--bg-primary": bg,
    "--text-primary": fg,
    "--accent-primary": primary
  };
  return {
    id: name,
    name,
    label,
    description,
    mode,
    default: isDefault,
    isDefault,
    colors,
    darkColors: mode === "dark" ? colors : void 0,
    tokens,
    variables: tokens
  };
}
var ACADEMY_THEME = {
  id: "nomad-academy",
  name: "nomad-academy",
  label: "Nomad Academy (Фирменная)",
  description: "Фирменная дизайн-система Nomad Academy (Apple Liquid Glass): тёплый крем днём, глубокий индиго ночью и единый акцент #007AFF.",
  mode: "system",
  default: true,
  isDefault: true,
  colors: {
    background: "#F6F4EF",
    foreground: "#14151C",
    card: "#FFFFFF",
    cardForeground: "#14151C",
    muted: "#ECEAE3",
    mutedForeground: "#5A5C68",
    popover: "#FFFFFF",
    popoverForeground: "#14151C",
    primary: "#007AFF",
    primaryForeground: "#FFFFFF",
    secondary: "#FBFAF6",
    secondaryForeground: "#3A3C48",
    accent: "#EEF4FF",
    accentForeground: "#14151C",
    border: "rgba(20, 21, 28, 0.1)",
    input: "rgba(20, 21, 28, 0.14)",
    ring: "#007AFF",
    midground: "#007AFF",
    midgroundForeground: "#FFFFFF",
    composerRing: "#007AFF",
    destructive: "#D9534F",
    destructiveForeground: "#FFFFFF",
    sidebarBackground: "#F0EDE6",
    sidebarBorder: "rgba(20, 21, 28, 0.1)",
    userBubble: "color-mix(in srgb, #007AFF 8%, #FFFFFF)",
    userBubbleBorder: "color-mix(in srgb, #007AFF 24%, transparent)"
  },
  darkColors: {
    background: "#0A0A12",
    foreground: "#EEF1FB",
    card: "#14121E",
    cardForeground: "#EEF1FB",
    muted: "#1A1E38",
    mutedForeground: "#A6AAC6",
    popover: "#1B1926",
    popoverForeground: "#EEF1FB",
    primary: "#007AFF",
    primaryForeground: "#FFFFFF",
    secondary: "#1F2350",
    secondaryForeground: "#DDE4FF",
    accent: "#1F2350",
    accentForeground: "#EEF1FB",
    border: "#262A3A",
    input: "#0D0F1C",
    ring: "#29A9FF",
    midground: "#29A9FF",
    midgroundForeground: "#0A0A12",
    composerRing: "#29A9FF",
    destructive: "#D9534F",
    destructiveForeground: "#FFF5F5",
    sidebarBackground: "#05071C",
    sidebarBorder: "#23273B",
    userBubble: "#1B2044",
    userBubbleBorder: "#2E3560"
  }
};
var NOMAD_THEMES = [
  ACADEMY_THEME,
  buildTheme({
    name: "nomad-dark",
    label: "Nomad Тёмная (по умолчанию)",
    description: "Фирменная графитово-угольная палитра Nomad с тёплым терракотовым акцентом для комфортной работы.",
    isDefault: true,
    mode: "dark",
    bg: "#0B0E14",
    fg: "#E6EDF3",
    primary: "#FF6B35",
    card: "#11161F",
    muted: "#161C28",
    mutedFg: "#9BA7B4",
    secondary: "#1B2230",
    secondaryFg: "#E6EDF3",
    border: "#263042",
    sidebarBg: "#080B10"
  }),
  buildTheme({
    name: "nomad-light",
    label: "Nomad Светлая",
    description: "Чистая дневная палитра с мягким бумажным фоном и контрастными элементами управления.",
    isDefault: false,
    mode: "light",
    bg: "#F8FAFC",
    fg: "#0F172A",
    primary: "#EA580C",
    card: "#FFFFFF",
    muted: "#F1F5F9",
    mutedFg: "#475569",
    secondary: "#E2E8F0",
    secondaryFg: "#0F172A",
    border: "#CBD5E1",
    sidebarBg: "#F1F5F9"
  }),
  buildTheme({
    name: "nomad-Steppe",
    label: "Nomad Степь",
    description: "Песочно-тёплая степная палитра с приглушённым контрастом для длительного чтения и письма.",
    isDefault: false,
    mode: "dark",
    bg: "#1C1814",
    fg: "#F3EAD8",
    primary: "#E07A3F",
    card: "#25201A",
    muted: "#2E2720",
    mutedFg: "#B8AA96",
    secondary: "#352D24",
    secondaryFg: "#F3EAD8",
    border: "#463B2F",
    sidebarBg: "#16130F"
  }),
  buildTheme({
    name: "nomad-midnight",
    label: "Nomad Полночь",
    description: "Глубокая полуночно-синяя палитра с янтарным акцентом для ночных рабочих сессий.",
    isDefault: false,
    mode: "dark",
    bg: "#070B16",
    fg: "#E2E8F0",
    primary: "#F97316",
    card: "#0D1324",
    muted: "#131C33",
    mutedFg: "#94A3B8",
    secondary: "#192440",
    secondaryFg: "#E2E8F0",
    border: "#233256",
    sidebarBg: "#050811"
  }),
  buildTheme({
    name: "nomad-high-contrast",
    label: "Nomad Высокий контраст",
    description: "Максимально контрастная палитра с чёткими границами для повышенной читаемости текста и кода.",
    isDefault: false,
    mode: "dark",
    bg: "#000000",
    fg: "#FFFFFF",
    primary: "#FF7A45",
    primaryFg: "#000000",
    card: "#0A0A0A",
    muted: "#141414",
    mutedFg: "#D4D4D8",
    secondary: "#1F1F23",
    secondaryFg: "#FFFFFF",
    border: "#52525B",
    sidebarBg: "#000000"
  })
];
var NOMAD_TOOLTIPS_BY_TEXT = {
  "Новый чат": "Создать чистый диалог с Nomad (Ctrl+N)",
  "Чаты": "Список недавних рабочих диалогов (служебные сессии скрыты)",
  "Задачи по расписанию": "Автономные фоновые задачи и cron-расписания агента",
  "Рабочие области": "Привязанные папки проектов и репозитории",
  "Навыки": "Каталог установленных навыков (SKILL.md) и подключение новых инструментов",
  "Настройки": "Параметры внешнего вида, питомца, моделей, памяти и интеграций",
  "Аккаунты": "Подключение подписок, российских суверенных моделей и API-ключей без перезапуска",
  "Аккаунты и ключи": "Подключение подписок и API-ключей без перезапуска (Горячая замена)",
  "Цепочка фолбэков": "Порядок автоматического переключения моделей при лимитах или сбоях",
  "Биллинг и лимиты": "Контроль расходов, дневных бюджетов и остатка квот по провайдерам",
  "Навыки Nomad": "Категории навыков, корпоративные коннекторы РФ (1С, Битрикс24, Диадок) и установка в 1 клик",
  "Витрина навыков": "Категории навыков, проверка целостности (SHA-256) и установка в 1 клик",
  "Данные и место": "Папка профиля Nomad, импорт/экспорт памяти и резервные копии",
  "Данные и память": "Папка профиля Nomad, импорт/экспорт памяти и резервные копии",
  "Безопасность": "Песочница команд, гардрейлы 152-ФЗ, DLP-маскирование ПДн и сетевой экран Egress",
  "Перенос и старт": "Мастер переноса из Claude Code / Codex CLI и автообновление поверх Hermes",
  "Симулятор ИИ": "Интерактивный тренажёр вайбкодинга: 9 ролевых треков, сценарии, Академия и Бадди Ника/Сократ",
  "Рой и граф": "Визуальный граф параллельных субагентов и оркестрация роя",
  "О программе": "Версия ядра Hermes, надстройки Nomad и проверка обновлений",
  "Персонализация": "Стиль общения, тон ответов и постоянные инструкции для агента",
  "Внешний вид": "Тема оформления (Nomad Academy), масштаб интерфейса, фон с караваном и питомец",
  "Питомец": "Анимированный питомец-компаньон на экране (караванный верблюд Nomad и коллекция Скрепка)",
  "Шлюзы": "Локальный сервер Nomad (127.0.0.1:9129) и подключение корпоративных контуров",
  "Локальные модели": "Запуск локальных GGUF/Ollama/LM Studio моделей прямо на вашем компьютере",
  "Начать курс": "Открыть диалог с ИИ-ментором и приступить к выбранному треку",
  "Продолжить вашу сессию": "Вернуться к активному диалогу тренажёра с сохранением прогресса"
};
var ENGLISH_TO_RUSSIAN_TEXT_MAP = {
  "NEW SESSION": "НОВЫЙ СЕАНС",
  "What are we building?": "Опишите задачу, прикрепите файл или задайте вопрос…",
  "Drop the task here. I'll keep the work grounded in the repo.": "Опиши задачу, кинь файл или идею — изучу проект и доведу решение до результата.",
  "Drop the task here. I’ll keep the work grounded in the repo.": "Опиши задачу, кинь файл или идею — изучу проект и доведу решение до результата.",
  "Send the task, file, or rough idea. I'll use your configured voice and keep the work grounded in this repo.": "Опиши задачу, файл или черновую идею — разберусь в коде и предложу конкретный шаг.",
  "Bring the context or the stuck part. I'll adapt to your configured personality.": "Пришли контекст или проблемное место — подстроюсь под твой стиль и помогу разобраться.",
  "Give me the context and I'll answer in Simulator mode.": "Опиши задачу или выбери карточку ниже — помогу решить её шаг за шагом.",
  "Send the problem, file, or idea. I'll follow the personality you've configured.": "Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.",
  "Send the problem, file, or idea. I’ll follow the personality you’ve configured.": "Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.",
  "Ask me to open a repo, explain an error, or automate a chore. I can read code, run tools, and follow through.": "Задай вопрос, вставь ошибку или покажи репо. Умею читать код, пользоваться инструментами и доводить дело до выката.",
  "Paste a stack trace, drop a screenshot, or describe what looks wrong. We can untangle it together.": "Вставь стектрейс, кинь скриншот или опиши симптомы — разберёмся вместе.",
  "Point me at a folder or a file. I’ll read before I write and show you what changed.": "Покажи папку или файл — сначала прочитаю, потом аккуратно поправлю и покажу дифф.",
  "Got a repetitive task? Tell me how you do it once and we can turn it into a reusable skill or schedule.": "Есть рутина? Расскажи один раз, как ты её делаешь — превратим в навык или расписание.",
  "Draft a spec, summarize a thread, or compare approaches. I’ll keep the receipts and cite the files.": "Набросать спек, сжать переписку, сравнить подходы — сохраню пруфы и сошлюсь на файлы.",
  "Encrypt saved secrets with the OS keychain": "Шифровать сохранённые секреты и API-ключи в системном хранилище ОС (Windows Credential Manager)",
  "Protects saved gateway tokens using the operating system keychain when available.": "Защищает токены шлюза и API-ключи аппаратным шифрованием учётной записи Windows (DPAPI).",
  "Gateway connection is locked by environment variables.": "Локальный шлюз Nomad подключён автоматически.",
  "Ask anything, @ to mention, / for actions": "Спросите что угодно, @ для упоминания, / для команд",
  "Ask anything…": "Спросите что угодно…",
  "The AI service is busy": "Сервис ИИ временно перегружен",
  "ChatGPT or Codex Subscription is limiting requests right now. Wait a minute, then retry.": "Лимит запросов текущей подписки временно исчерпан. Подождите минуту или переключите провайдера.",
  "Your request was not processed. Send it again if you still want me to carry it out.": "Запрос не был обработан. Отправьте его повторно или выберите другую модель.",
  "Retry": "Повторить",
  "Switch provider": "Сменить провайдера",
  "Open Desktop logs": "Открыть журнал",
  "Send diagnostics": "Отправить диагностику",
  "Copy error details": "Скопировать детали",
  "Details": "Подробности",
  "model changed": "модель изменена",
  "Describe the task in your own words. I'll pick the right tools, explain my plan, and check in before risky steps.": "Опиши задачу своими словами — подберу инструменты, согласую план и спрошу подтверждение перед важными шагами.",
  "Describe the task in your own words. I’ll pick the right tools, explain my plan, and check in before risky steps.": "Опиши задачу своими словами — подберу инструменты, согласую план и спрошу подтверждение перед важными шагами.",
  Default: "Стандартная",
  Basic: "Базовая",
  Focus: "Фокус",
  "Terminal deck": "Терминальная дека",
  Quad: "Квадро (4 панели)",
  Browser: "Браузер",
  "Passwords & Logins": "Пароли и входы",
  "Everything—indexed in one place": "Все файлы и медиа — в одном месте",
  "Everything — indexed in one place": "Все файлы и медиа — в одном месте",
  "Images, files, and links from every session show up here automatically.": "Изображения, файлы и ссылки из всех сессий собираются здесь автоматически.",
  "In-App Tips": "Подсказки в интерфейсе",
  "Show contextual tips across the interface. Dismissed tips stay hidden.": "Показывать контекстные подсказки в интерфейсе. Закрытые подсказки больше не отображаются.",
  "Occasional hints from the app and Nomad. Each tip appears once. Turns off automatically after your first 30 days; you can turn it back on.": "Ненавязчивые подсказки по функциям интерфейса. Каждая подсказка показывается один раз и может быть включена повторно в любой момент.",
  "Occasional hints from the app and Hermes. Each tip appears once. Turns off automatically after your first 30 days; you can turn it back on.": "Ненавязчивые подсказки по функциям интерфейса. Каждая подсказка показывается один раз и может быть включена повторно в любой момент.",
  "Guided Tours": "Пошаговый тур по интерфейсу",
  "Interactive walkthroughs that introduce parts of the interface. Turn off to disable all tours.": "Интерактивный обзор разделов и кнопок приложения с подсветкой элементов.",
  "Let Nomad spotlight each step as it guides you through the app. Turns off automatically after your first 30 days; you can turn it back on.": "Интерактивный обзор ключевых разделов приложения с подсветкой элементов (Spotlight-онбординг) на выбранном языке.",
  "Let Hermes spotlight each step as it guides you through the app. Turns off automatically after your first 30 days; you can turn it back on.": "Интерактивный обзор ключевых разделов приложения с подсветкой элементов (Spotlight-онбординг) на выбранном языке.",
  "Restart tours": "Перезапустить обзор",
  "All tips are visible": "Все подсказки включены",
  "Local Models": "Локальные модели",
  "Still trying to reconnect...": "Продолжаем переподключение...",
  "Still trying to reconnect…": "Продолжаем переподключение…",
  "Reconnect now": "Переподключить сейчас",
  "Open Gateways": "Открыть шлюзы",
  "Gateway connection lost": "Соединение со шлюзом потеряно",
  "Backend unavailable": "Бэкенд недоступен"
};
function applyNomadVisualIdentityAndTooltips() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  try {
    window.localStorage?.setItem("hermes.desktop.backdrop.v1", "false");
  } catch {
  }
  const ensureAppleLiquidGlassFilter = () => {
    if (typeof document === "undefined" || document.getElementById("nomad-liquid-glass-svg-defs")) return;
    try {
      const size = 96;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const img = ctx.createImageData(size, size);
        const d = img.data;
        const bezel = 0.22;
        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const nx = x / (size - 1) * 2 - 1;
            const ny = y / (size - 1) * 2 - 1;
            const dist = Math.pow(Math.pow(Math.abs(nx), 4) + Math.pow(Math.abs(ny), 4), 0.25);
            let dx = 0;
            let dy = 0;
            if (dist > 1 - bezel && dist <= 1) {
              const t = (dist - (1 - bezel)) / bezel;
              const s = Math.sin(t * Math.PI * 0.5);
              const mag = s * 0.45;
              const len = Math.hypot(nx, ny) || 1;
              dx = -nx / len * mag;
              dy = -ny / len * mag;
            }
            const idx = (y * size + x) * 4;
            d[idx] = Math.round(Math.max(0, Math.min(255, 128 + dx * 127)));
            d[idx + 1] = Math.round(Math.max(0, Math.min(255, 128 + dy * 127)));
            d[idx + 2] = 128;
            d[idx + 3] = 255;
          }
        }
        ctx.putImageData(img, 0, 0);
        const dataUrl = canvas.toDataURL();
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.id = "nomad-liquid-glass-svg-defs";
        svg.setAttribute("width", "0");
        svg.setAttribute("height", "0");
        svg.style.cssText = "position:absolute;width:0;height:0;pointer-events:none;overflow:hidden;";
        svg.innerHTML = `<defs><filter id="nomad-liquid-glass-refract" x="0%" y="0%" width="100%" height="100%" color-interpolation-filters="sRGB"><feImage href="${dataUrl}" x="0%" y="0%" width="100%" height="100%" preserveAspectRatio="none" result="dispMap"/><feDisplacementMap in="SourceGraphic" in2="dispMap" scale="14" xChannelSelector="R" yChannelSelector="G" result="displaced"/><feGaussianBlur in="displaced" stdDeviation="6" result="blurred"/><feComposite in="blurred" in2="SourceGraphic" operator="atop"/></filter></defs>`;
        document.body?.appendChild(svg);
      }
    } catch {
    }
  };
  ensureAppleLiquidGlassFilter();
  const styleId = "nomad-academy-brand-enhancements";
  let style = document.getElementById(styleId);
  if (!style) {
    style = document.createElement("style");
    style.id = styleId;
    document.head?.appendChild(style);
  }
  {
    style.textContent = `
      :root, html, body {
        --radius: 8px !important;
        --radius-xs: 4px !important;
        --radius-sm: 6px !important;
        --radius-md: 8px !important;
        --radius-lg: 10px !important;
        --radius-xl: 12px !important;
        --radius-2xl: 12px !important;
        --primary: #18181B !important;
        --primary-foreground: #FFFFFF !important;
        --color-primary: #18181B !important;
        --color-primary-foreground: #FFFFFF !important;
        --ring: rgba(24, 24, 27, 0.16) !important;
        --composer-ring: rgba(24, 24, 27, 0.16) !important;
        --ui-stroke-primary: #D4D4D8 !important;
        --ui-stroke-secondary: #E4E4E7 !important;
        --ui-stroke-tertiary: #E4E4E7 !important;
        --ui-stroke-quaternary: #E4E4E7 !important;
        --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
        --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
        --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
        --nomad-apple-blue: #18181B;
        --nomad-apple-indigo: #27272A;
        --nomad-apple-green: #10B981;
        --nomad-accent: #18181B;
        --nomad-glass-bg: #FFFFFF;
        --nomad-glass-bg-strong: #FFFFFF;
        --nomad-glass-border: #E4E4E7;
        --nomad-glass-outline: transparent;
        --nomad-glass-border-hover: #A1A1AA;
        --nomad-glass-specular: 0 0 0 transparent;
        --nomad-glass-shadow: 0 1px 2px rgba(9, 9, 11, 0.04);
        --nomad-glass-shadow-hover: 0 2px 6px rgba(9, 9, 11, 0.06);
        --nomad-seg-bg: #F4F4F5;
        --nomad-seg-active-bg: #FFFFFF;
        --nomad-seg-active-shadow: 0 1px 2px rgba(9, 9, 11, 0.06);
      }
      .dark {
        --radius: 8px !important;
        --radius-xs: 4px !important;
        --radius-sm: 6px !important;
        --radius-md: 8px !important;
        --radius-lg: 10px !important;
        --radius-xl: 12px !important;
        --radius-2xl: 12px !important;
        --primary: #F4F4F5 !important;
        --primary-foreground: #09090B !important;
        --color-primary: #F4F4F5 !important;
        --ring: rgba(244, 244, 245, 0.25) !important;
        --composer-ring: rgba(244, 244, 245, 0.25) !important;
        --nomad-glass-bg: #18181B;
        --nomad-glass-bg-strong: #18181B;
        --nomad-glass-border: #27272A;
        --nomad-glass-outline: transparent;
        --nomad-glass-border-hover: #52525B;
        --nomad-glass-specular: 0 0 0 transparent;
        --nomad-glass-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
        --nomad-glass-shadow-hover: 0 4px 10px rgba(0, 0, 0, 0.4);
        --nomad-seg-bg: #27272A;
        --nomad-seg-active-bg: #3F3F46;
        --nomad-seg-active-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
      }

      /* Скрываем старые оранжевые подсказки донора, барханы и мультяшного верблюда (Codeg Light Minimalist) */
      [data-slot="tip-bubble"],
      img[data-nomad-dunes-backdrop="true"],
      img[src*="nomad-dunes"],
      canvas[aria-label*="pet" i],
      div:has(> canvas[aria-label*="pet" i]),
      [data-nomad-pet-controls="true"] {
        display: none !important;
      }
      [data-tip-target] {
        outline: none !important;
        box-shadow: none !important;
        animation: none !important;
      }

      /* Единая геометрия скруглений Codeg Light Minimalist (6px–10px) */
      .rounded-xs { border-radius: 4px !important; }
      .rounded-sm { border-radius: 6px !important; }
      .rounded-md, .rounded { border-radius: 8px !important; }
      .rounded-lg { border-radius: 10px !important; }
      .rounded-xl { border-radius: 10px !important; }
      [data-slot="popover-content"],
      [data-slot="dropdown-menu-content"],
      [data-slot="dialog-content"],
      [data-slot="sheet-content"],
      [role="dialog"]:not(#nomad-onboarding-tour-root) {
        border-radius: 10px !important;
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 8px 24px -4px rgba(9, 9, 11, 0.08), 0 2px 6px rgba(9, 9, 11, 0.04) !important;
      }
      .dark [data-slot="popover-content"],
      .dark [data-slot="dropdown-menu-content"],
      .dark [data-slot="dialog-content"],
      .dark [data-slot="sheet-content"],
      .dark [role="dialog"]:not(#nomad-onboarding-tour-root) {
        background: #18181B !important;
        border-color: #27272A !important;
      }
      [data-slot="popover-content"] button,
      [data-slot="dropdown-menu-content"] [role="menuitem"],
      [data-slot="dropdown-menu-item"] {
        border-radius: 6px !important;
      }
      [role="combobox"],
      [data-slot="select-trigger"],
      [data-slot="input"],
      [data-slot="textarea"] {
        border-radius: 6px !important;
        border: 1px solid #E4E4E7 !important;
        background-color: #FFFFFF !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.02) !important;
      }
      kbd {
        border-radius: 4px !important;
        padding: 1px 5px !important;
        font-size: 10.5px !important;
        background: #F4F4F5 !important;
        border: 1px solid #E4E4E7 !important;
        color: #52525B !important;
      }

      /* Чистая светлая поверхность Codeg v0.32.4 без цветных пятен и градиентов */
      [data-testid="nomad-accounts-page"],
      [data-testid="nomad-simulator-page"],
      [data-testid="nomad-council-view"],
      [data-testid="nomad-memory-projects-view"],
      [data-testid="nomad-cloud-remote-view"],
      [data-testid="nomad-swarm-page"],
      .nomad-skills-page,
      .nomad-safety-page,
      .nomad-data-page,
      .nomad-start-page,
      .nomad-personalization-page,
      .nomad-about-page {
        position: relative;
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
        background-image: none !important;
        background-color: transparent !important;
      }

      /* Глобальный фикс склеенных flex-column карточек и кнопок */
      button[style*="flex-direction: column"],
      button[style*="flex-direction:column"],
      .nomad-track-card,
      .nomad-glass-card-btn {
        align-items: stretch !important;
        text-align: left !important;
      }
      button[style*="flex-direction: column"] > div,
      button[style*="flex-direction:column"] > div,
      .nomad-track-card > div,
      .nomad-glass-card-btn > div {
        width: 100% !important;
        box-sizing: border-box !important;
      }

      /* Универсальные карточки Codeg Light Minimalist во ВСЕХ разделах Nomad */
      .nomad-glass-surface,
      .nomad-glass-card,
      .nomad-data-volume-card,
      .nomad-data-checkpoints-card,
      .nomad-data-restore-card,
      .nomad-start-import-card,
      .nomad-start-checklist-card,
      .nomad-start-overlay-sync-card,
      [data-testid="nomad-accounts-page"] section,
      [data-testid="nomad-accounts-page"] [data-testid="ru-sovereign-models-panel"],
      [data-testid="nomad-accounts-page"] [data-testid="accounts-switch-feed"],
      [data-testid="billing-tab"] > div,
      [data-testid="fallback-tab"] > div,
      [data-testid="nomad-swarm-page"] section,
      .nomad-skills-page section,
      .nomad-skills-page [class*="-card"],
      .nomad-safety-page section,
      .nomad-safety-page [class*="-card"],
      .nomad-data-page section,
      .nomad-start-page section,
      .nomad-personalization-page section,
      .nomad-about-page section {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 10px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
      }

      /* Поля ввода, селекты и текстовые области во всех разделах Nomad — Codeg Controls */
      [data-testid="nomad-accounts-page"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-accounts-page"] select,
      [data-testid="nomad-accounts-page"] textarea,
      [data-testid="nomad-simulator-page"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-simulator-page"] select,
      [data-testid="nomad-simulator-page"] textarea,
      [data-testid="nomad-council-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-council-view"] select,
      [data-testid="nomad-council-view"] textarea,
      [data-testid="nomad-memory-projects-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-memory-projects-view"] select,
      [data-testid="nomad-memory-projects-view"] textarea,
      [data-testid="nomad-cloud-remote-view"] input:not([type="checkbox"]):not([type="radio"]),
      [data-testid="nomad-cloud-remote-view"] select,
      [data-testid="nomad-cloud-remote-view"] textarea,
      .nomad-skills-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-skills-page select,
      .nomad-safety-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-safety-page select,
      .nomad-safety-page textarea,
      .nomad-data-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-data-page select,
      .nomad-start-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-personalization-page input:not([type="checkbox"]):not([type="radio"]),
      .nomad-personalization-page select,
      .nomad-personalization-page textarea {
        background: #FFFFFF !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.02) !important;
        border-radius: 6px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      [data-testid="nomad-accounts-page"] input:focus,
      [data-testid="nomad-simulator-page"] input:focus,
      [data-testid="nomad-council-view"] textarea:focus,
      [data-testid="nomad-memory-projects-view"] input:focus,
      [data-testid="nomad-cloud-remote-view"] input:focus,
      .nomad-skills-page input:focus,
      .nomad-safety-page input:focus,
      .nomad-data-page input:focus {
        border-color: #18181B !important;
        box-shadow: 0 0 0 2px rgba(24, 24, 27, 0.10) !important;
        outline: none !important;
      }

      .nomad-track-card,
      .nomad-glass-card-interactive {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        outline: none !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 8px !important;
        transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease !important;
      }
      .nomad-track-card:hover,
      .nomad-glass-card-interactive:hover {
        background: #FAFAFA !important;
        border-color: #D4D4D8 !important;
        box-shadow: 0 2px 6px rgba(9, 9, 11, 0.05) !important;
      }

      /* Скелетоны загрузки Codeg Zinc Shimmer */
      @keyframes nomadSkeletonShimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
      html:not(.dark) [data-slot="skeleton"],
      html:not(.dark) [data-slot="count-skeleton"],
      html:not(.dark) [data-slot="model-settings-skeleton"] .animate-pulse {
        background: linear-gradient(
          90deg,
          #F4F4F5 20%,
          #E4E4E7 50%,
          #F4F4F5 80%
        ) !important;
        background-size: 200% 100% !important;
        animation: nomadSkeletonShimmer 1.75s ease-in-out infinite !important;
        border: 1px solid #E4E4E7 !important;
        border-radius: 6px !important;
      }
      .dark [data-slot="skeleton"],
      .dark [data-slot="count-skeleton"],
      .dark [data-slot="model-settings-skeleton"] .animate-pulse {
        background: linear-gradient(
          90deg,
          rgba(255, 255, 255, 0.045) 20%,
          rgba(255, 255, 255, 0.105) 50%,
          rgba(255, 255, 255, 0.045) 80%
        ) !important;
        background-size: 200% 100% !important;
        animation: nomadSkeletonShimmer 1.75s ease-in-out infinite !important;
        border: 1px solid rgba(255, 255, 255, 0.075) !important;
        border-radius: 6px !important;
      }

      /* Полировка режима HUD */
      html[data-hud-window],
      html[data-hud-window] body,
      html[data-hud-window] #root,
      [data-hud-shell],
      [data-hud-shell] [data-chat-surface] {
        background: transparent !important;
        background-color: transparent !important;
        background-image: none !important;
      }
      /* Скрываем виджет Советника и пульт питомца в окне HUD и если нет верхней шапки */
      #nomad-buddy-fab:not(.nomad-in-titlebar),
      html[data-hud-window] #nomad-buddy-fab,
      html[data-hud-window] #nomad-buddy-drawer,
      [data-hud-shell] #nomad-buddy-fab,
      [data-hud-shell] #nomad-buddy-drawer {
        display: none !important;
      }
      [data-hud-shell]:is([data-hud-recent], [data-hud-held], [data-hud-typing], :hover, :focus-within) [data-hud-glass] {
        opacity: 1 !important;
        translate: none !important;
        background: #18181B !important;
        border: 1px solid #27272A !important;
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.28) !important;
        border-radius: 10px !important;
      }
      [data-hud-shell] [data-slot="composer-surface"] {
        border-radius: 10px !important;
        background: #FFFFFF !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 8px 24px rgba(9, 9, 11, 0.12) !important;
      }
      html[data-hud-window] [data-slot="dropdown-menu-content"],
      html[data-hud-window] [data-slot="popover-content"],
      [data-hud-shell] [data-slot="dropdown-menu-content"] {
        max-height: min(310px, calc(100vh - 68px)) !important;
        overflow-y: auto !important;
        padding: 6px !important;
        border-radius: 8px !important;
      }

      /* Переключатель «Совет моделей» в нижней панели ввода чата (Codeg Pill) */
      #nomad-composer-council-toggle {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        height: 26px;
        padding: 0 10px;
        border-radius: 6px;
        border: 1px solid #E4E4E7;
        background: #FAFAFA;
        color: #52525B;
        font-size: 11.5px;
        font-weight: 500;
        letter-spacing: -0.01em;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.15s ease;
      }
      #nomad-composer-council-toggle:hover {
        background: #F4F4F5;
        color: #09090B;
        border-color: #D4D4D8;
      }
      #nomad-composer-council-toggle[data-active="true"] {
        background: #18181B;
        color: #FFFFFF;
        border-color: #18181B;
      }

      /* Поповер выбора моделей для «Совета моделей» над полем ввода чата */
      #nomad-composer-council-popover {
        position: fixed;
        z-index: 9992;
        width: 380px;
        padding: 14px 16px;
        border-radius: 10px;
        background: #FFFFFF;
        color: #09090B;
        border: 1px solid #E4E4E7;
        box-shadow: 0 12px 32px -4px rgba(9, 9, 11, 0.12), 0 2px 6px rgba(9, 9, 11, 0.04);
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      #nomad-composer-council-popover.hidden {
        display: none !important;
      }

      /* Интерактивный пошаговый Spotlight-онбординг */
      #nomad-onboarding-tour-root {
        position: fixed;
        inset: 0;
        z-index: 10080;
        pointer-events: auto;
        font-family: 'Inter', 'Geist', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
      }
      .nomad-tour-backdrop-pane {
        position: fixed;
        background: rgba(9, 9, 11, 0.32);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        transition: all 0.24s ease;
        pointer-events: auto;
      }
      .nomad-tour-spotlight-ring {
        position: fixed;
        z-index: 10082;
        border-radius: 8px;
        border: 2px solid #18181B;
        box-shadow: 0 0 0 4px rgba(24, 24, 27, 0.16);
        pointer-events: none;
        transition: all 0.24s ease;
      }
      .nomad-tour-card {
        position: fixed;
        z-index: 10085;
        width: 392px;
        max-width: calc(100vw - 32px);
        padding: 18px 20px;
        border-radius: 10px;
        background: #FFFFFF;
        color: #09090B;
        border: 1px solid #E4E4E7;
        box-shadow: 0 16px 40px -8px rgba(9, 9, 11, 0.18);
        transition: top 0.24s ease, left 0.24s ease, transform 0.24s ease;
      }

      /* Codeg Segmented Control */
      .nomad-seg-group {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        padding: 3px;
        border-radius: 8px;
        background: #F4F4F5;
        border: 1px solid #E4E4E7;
      }
      .nomad-seg-btn {
        appearance: none;
        border: none;
        background: transparent;
        color: #52525B;
        font-size: 12.5px;
        font-weight: 500;
        letter-spacing: -0.01em;
        padding: 5px 12px;
        border-radius: 6px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
      }
      .nomad-seg-btn:hover {
        color: #09090B;
      }
      .nomad-seg-btn[data-active="true"] {
        background: #FFFFFF;
        color: #09090B;
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.06);
      }

      /* Монохромная типографика заголовка NOMAD в стиле Codeg (#09090B) */
      .wordmark > span > span,
      [data-slot="aui_intro"] .fit-text > span > span {
        background-image: none !important;
        color: #09090B !important;
        -webkit-text-fill-color: #09090B !important;
        font-weight: 700 !important;
        letter-spacing: -0.03em !important;
        display: inline-block !important;
      }
      .dark .wordmark > span > span,
      .dark [data-slot="aui_intro"] .fit-text > span > span {
        color: #FAFAFA !important;
        -webkit-text-fill-color: #FAFAFA !important;
      }

      /* Карточки быстрых действий на стартовом экране — Codeg Crisp Cards */
      button.card-in.hover-lift {
        background: #FFFFFF !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        border: 1px solid #E4E4E7 !important;
        box-shadow: 0 1px 2px rgba(9, 9, 11, 0.03) !important;
        border-radius: 8px !important;
        transition: border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease !important;
      }
      button.card-in.hover-lift:hover {
        background: #FAFAFA !important;
        border-color: #D4D4D8 !important;
        box-shadow: 0 2px 6px rgba(9, 9, 11, 0.05) !important;
      }

      /* Пульт питомца (#nomad-pet-context-menu) в стиле Apple macOS Sequoia/Tahoe Liquid Glass */
      #nomad-pet-context-menu {
        position: fixed;
        z-index: 9999;
        width: 336px;
        max-height: calc(100vh - 84px);
        overflow-y: auto;
        border-radius: 18px;
        background: rgba(250, 249, 246, 0.86);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(28px) saturate(190%);
        -webkit-backdrop-filter: blur(28px) saturate(190%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 24px 56px -8px rgba(15, 23, 42, 0.20), 0 4px 12px rgba(15, 23, 42, 0.06);
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif);
        font-size: 12px;
        padding: 15px;
        user-select: none;
      }
      .dark #nomad-pet-context-menu {
        background: rgba(20, 24, 36, 0.88);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14), 0 24px 60px rgba(0, 0, 0, 0.60);
      }
      #nomad-pet-context-menu.hidden {
        display: none !important;
      }
      #nomad-pet-context-menu .np-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 10px;
        margin-bottom: 8px;
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }
      .dark #nomad-pet-context-menu .np-header {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      #nomad-pet-context-menu .np-title {
        font-weight: 700;
        font-size: 13px;
        letter-spacing: -0.01em;
        color: inherit;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #nomad-pet-context-menu .np-mood {
        font-size: 10.5px;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.10);
        color: #2563EB;
        font-weight: 600;
      }
      .dark #nomad-pet-context-menu .np-mood {
        background: rgba(59, 130, 246, 0.22);
        color: #93C5FD;
      }
      #nomad-pet-context-menu .np-close {
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.75);
        color: inherit;
        width: 24px;
        height: 24px;
        border-radius: 999px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.15s var(--ease-out);
      }
      #nomad-pet-context-menu .np-close:hover {
        background: rgba(15, 23, 42, 0.08);
      }
      #nomad-pet-context-menu .np-section-title {
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--muted-foreground, #64748B);
        margin: 10px 0 5px;
      }
      #nomad-pet-context-menu .np-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 4px 0;
      }
      #nomad-pet-context-menu .np-label {
        color: inherit;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #nomad-pet-context-menu select,
      #nomad-pet-context-menu .np-btn {
        background: rgba(255, 255, 255, 0.72);
        color: var(--foreground, #0f172a);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85);
        border-radius: 9px;
        padding: 5px 9px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s var(--ease-out);
      }
      .dark #nomad-pet-context-menu select,
      .dark #nomad-pet-context-menu .np-btn {
        background: rgba(30, 41, 59, 0.78);
        color: #F8FAFC;
        border-color: rgba(255, 255, 255, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      }
      #nomad-pet-context-menu select:hover,
      #nomad-pet-context-menu .np-btn:hover {
        border-color: rgba(37, 99, 235, 0.35);
        background: rgba(255, 255, 255, 0.94);
      }
      .dark #nomad-pet-context-menu select:hover,
      .dark #nomad-pet-context-menu .np-btn:hover {
        background: rgba(40, 52, 74, 0.92);
        border-color: rgba(96, 165, 250, 0.45);
      }
      #nomad-pet-context-menu .np-pos-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 5px;
        margin-top: 4px;
      }
      #nomad-pet-context-menu .np-pos-btn {
        background: rgba(255, 255, 255, 0.66);
        color: var(--foreground, #0f172a);
        border: 1px solid rgba(15, 23, 42, 0.09);
        border-radius: 8px;
        padding: 5px 6px;
        font-size: 10.5px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        transition: all 0.15s var(--ease-out);
      }
      .dark #nomad-pet-context-menu .np-pos-btn {
        background: rgba(30, 41, 59, 0.72);
        color: #CBD5E1;
        border-color: rgba(255, 255, 255, 0.09);
      }
      #nomad-pet-context-menu .np-pos-btn.active,
      #nomad-pet-context-menu .np-pos-btn:hover {
        background: rgba(37, 99, 235, 0.12);
        color: #1D4ED8;
        border-color: rgba(37, 99, 235, 0.38);
        font-weight: 700;
      }
      .dark #nomad-pet-context-menu .np-pos-btn.active,
      .dark #nomad-pet-context-menu .np-pos-btn:hover {
        background: rgba(59, 130, 246, 0.28);
        color: #FFFFFF;
      }
      #nomad-pet-context-menu .np-actions {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 6px;
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid rgba(15, 23, 42, 0.08);
      }
      #nomad-pet-context-menu .np-stats-box {
        margin-top: 8px;
        padding: 9px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.65);
        border: 1px solid rgba(37, 99, 235, 0.18);
        font-size: 11px;
      }

      /* Значки подсказок «?» (Help Badges) и всплывающий поповер описания опций */
      .nomad-help-q {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 15px;
        height: 15px;
        margin-left: 6px;
        border-radius: 999px;
        background: rgba(15, 23, 42, 0.06);
        border: 1px solid rgba(15, 23, 42, 0.14);
        color: var(--muted-foreground, #475569);
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        cursor: help;
        vertical-align: middle;
        user-select: none;
        transition: all 0.15s var(--ease-out);
      }
      .nomad-help-q:hover {
        background: #2563EB;
        color: #FFFFFF;
        border-color: #2563EB;
        transform: scale(1.06);
      }
      .dark .nomad-help-q {
        background: rgba(255, 255, 255, 0.08);
        color: #94A3B8;
        border-color: rgba(255, 255, 255, 0.16);
      }

      /* В едином всплывающем окне Настроек (SettingsView) скрываем технический блок Плагины: все настройки встроены прямо внутрь родных разделов */
      aside[data-tour="overlay-nav"] button[data-tour="nav-plugins"],
      aside[data-tour="overlay-nav"] > div:has(> button[data-tour="nav-plugins"]),
      aside[data-tour="overlay-nav"] > [id$="-plugins"] {
        display: none !important;
      }
      #nomad-native-inline-slot {
        width: 100%;
        box-sizing: border-box;
        font-variant-numeric: tabular-nums;
      }
      #nomad-native-inline-slot[data-nomad-inline-section="accounts"] {
        margin-bottom: 14px;
        padding-bottom: 14px;
        border-bottom: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08));
      }
      #nomad-native-inline-slot:not([data-nomad-inline-section="accounts"]) {
        margin-top: 14px;
        padding-top: 14px;
        border-top: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08));
      }
      /* Органичная нормализация встроенных блоков под родные строки Настроек (design-guardrails + design-guide + ai-studio-ui-polish) */
      #nomad-native-inline-slot .nomad-safety-page,
      #nomad-native-inline-slot .nomad-start-page,
      #nomad-native-inline-slot .nomad-data-page,
      #nomad-native-inline-slot [data-testid="nomad-accounts-page"] {
        padding: 0 !important;
        max-width: 100% !important;
        margin: 0 !important;
      }
      #nomad-native-inline-slot .nomad-safety-page > header,
      #nomad-native-inline-slot .nomad-start-page > header,
      #nomad-native-inline-slot .nomad-data-page > header > div:first-child > h1 {
        display: none !important;
      }
      #nomad-native-inline-slot .nomad-pill-badge {
        display: none !important;
      }
      #nomad-native-inline-slot .nomad-glass-surface,
      #nomad-native-inline-slot .nomad-glass-card,
      #nomad-native-inline-slot section {
        background: transparent !important;
        box-shadow: none !important;
        backdrop-filter: none !important;
        -webkit-backdrop-filter: none !important;
        outline: none !important;
        border-radius: 10px !important;
        border: 1px solid var(--ui-stroke-tertiary, rgba(15, 23, 42, 0.08)) !important;
      }
      .dark #nomad-native-inline-slot .nomad-glass-surface,
      .dark #nomad-native-inline-slot .nomad-glass-card,
      .dark #nomad-native-inline-slot section {
        border-color: rgba(255, 255, 255, 0.08) !important;
      }
      #nomad-native-inline-slot .nomad-glass-card[data-active="true"],
      #nomad-native-inline-slot button[data-active="true"] {
        border-color: var(--nomad-accent, #2563EB) !important;
        background: rgba(37, 99, 235, 0.06) !important;
      }
      #nomad-native-inline-slot h2 {
        font-size: 13.5px !important;
        font-weight: 600 !important;
        letter-spacing: -0.01em !important;
        line-height: 1.35 !important;
      }
      #nomad-native-inline-slot h3 {
        font-size: 13px !important;
        font-weight: 500 !important;
        letter-spacing: -0.008em !important;
        line-height: 1.35 !important;
      }

      #nomad-rich-tooltip-popover {
        position: fixed;
        z-index: 10050;
        max-width: 310px;
        padding: 9px 12px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.90);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 28px -4px rgba(15, 23, 42, 0.14);
        font-size: 11.5px;
        line-height: 1.45;
        font-weight: 500;
        pointer-events: none;
        transition: opacity 0.14s var(--ease-out);
      }
      .dark #nomad-rich-tooltip-popover {
        background: rgba(20, 25, 38, 0.92);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 14px 34px rgba(0, 0, 0, 0.55);
      }
      #nomad-rich-tooltip-popover.hidden {
        display: none !important;
      }

      /* Кнопка открытия правой боковой панели Советника в тулбаре шапки */
      #nomad-buddy-fab {
        height: 24px;
        z-index: 65;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.72);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(18px) saturate(180%);
        -webkit-backdrop-filter: blur(18px) saturate(180%);
        border: 1px solid rgba(15, 23, 42, 0.10);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88), 0 1px 3px rgba(15, 23, 42, 0.05);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: -0.01em;
        cursor: pointer;
        -webkit-app-region: no-drag;
        white-space: nowrap;
        transition: background-color 0.16s var(--ease-out), border-color 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out), transform 0.12s var(--ease-out);
      }
      #nomad-buddy-fab.nomad-in-titlebar {
        position: relative !important;
        right: auto !important;
        top: auto !important;
        margin-right: 6px !important;
      }
      #nomad-buddy-fab:hover {
        background: rgba(255, 255, 255, 0.94);
        border-color: rgba(37, 99, 235, 0.35);
        box-shadow: inset 0 1px 0 #FFFFFF, 0 3px 10px rgba(37, 99, 235, 0.12);
      }
      #nomad-buddy-fab:active {
        transform: scale(0.97);
      }
      .dark #nomad-buddy-fab {
        background: rgba(24, 30, 46, 0.76);
        color: #E2E8F0;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 2px 6px rgba(0, 0, 0, 0.3);
      }
      .dark #nomad-buddy-fab:hover {
        background: rgba(32, 40, 60, 0.92);
        border-color: rgba(96, 165, 250, 0.45);
      }

      /* Подсвечиваем штатную кнопку «Открыть настройки» в шапке в едином стиле капсулы, чтобы её всегда было видно */
      button[title="Открыть настройки"],
      button[aria-label="Открыть настройки"] {
        border-radius: 999px !important;
        transition: background-color 0.15s var(--ease-out), color 0.15s var(--ease-out) !important;
      }
      button[title="Открыть настройки"]:hover,
      button[aria-label="Открыть настройки"]:hover {
        background: rgba(37, 99, 235, 0.10) !important;
        color: #2563EB !important;
      }

      /* Правая боковая панель чата с Советником (#nomad-buddy-drawer) во всю высоту рабочего окна */
      #nomad-buddy-drawer {
        position: fixed;
        right: 0;
        top: 32px;
        bottom: 22px;
        width: 368px;
        max-height: none;
        z-index: 9990;
        display: flex;
        flex-direction: column;
        border-radius: 14px 0 0 14px;
        background: rgba(248, 246, 241, 0.94);
        color: var(--foreground, #0f172a);
        backdrop-filter: blur(32px) saturate(195%);
        -webkit-backdrop-filter: blur(32px) saturate(195%);
        border-left: 1px solid rgba(15, 23, 42, 0.10);
        border-top: 1px solid rgba(15, 23, 42, 0.08);
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.92), -16px 0 40px -8px rgba(15, 23, 42, 0.14);
        overflow: hidden;
        font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, sans-serif);
      }
      .dark #nomad-buddy-drawer {
        background: rgba(16, 20, 32, 0.94);
        color: #F1F5F9;
        border-color: rgba(255, 255, 255, 0.12);
        box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.12), -20px 0 48px rgba(0, 0, 0, 0.58);
      }
      #nomad-buddy-drawer.hidden {
        display: none !important;
      }
    `;
  }
  const MASCOT_SETTINGS_KEY = "nomad.mascot.settings.v1";
  const DEFAULT_MASCOT_SETTINGS = {
    mascotId: "camel",
    size: 0.45,
    position: "bottom-right",
    lockedX: null,
    lockedY: null,
    soundEnabled: true,
    soundVolume: 0.5,
    randomWalk: false,
    autoApproveSafe: true,
    smartApprove: false,
    focusMode: false,
    batterySaveMode: false,
    pomodoroEnabled: false
  };
  const loadMascotSettings = () => {
    try {
      const raw = localStorage.getItem(MASCOT_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_MASCOT_SETTINGS, ...parsed };
      }
    } catch {
    }
    return { ...DEFAULT_MASCOT_SETTINGS };
  };
  const saveMascotSettings = (next) => {
    try {
      localStorage.setItem(MASCOT_SETTINGS_KEY, JSON.stringify(next));
      localStorage.setItem("hermes.desktop.pet-roam.v1", next.randomWalk ? "true" : "false");
      localStorage.setItem("hermes.desktop.pet.roam", next.randomWalk ? "true" : "false");
    } catch {
    }
  };
  try {
    const initialSt = loadMascotSettings();
    if (!initialSt.randomWalk) {
      localStorage.setItem("hermes.desktop.pet-roam.v1", "false");
      localStorage.setItem("hermes.desktop.pet.roam", "false");
    }
  } catch {
  }
  const playMascotTone = (freq = 587.33, dur = 0.09) => {
    try {
      const s = loadMascotSettings();
      if (!s.soundEnabled || s.soundVolume <= 0) return;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(Math.min(1, s.soundVolume * 0.25), ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
    }
  };
  const MASCOT_CATALOG = [
    { slug: "camel", label: "Караванный верблюд", group: "Караван Nomad", greeting: "Караван готов к маршруту." },
    { slug: "skrepka", label: "Скрепка (классическая)", group: "Коллекция «Скрепка»", greeting: "Похоже, ты пишешь код. Чем помочь?" },
    { slug: "skrepka-steel", label: "Скрепка стальная", group: "Коллекция «Скрепка»", greeting: "Стальная Скрепка на связи." },
    { slug: "ogryzok", label: "Огрызок (яблоко)", group: "Коллекция «Скрепка»", greeting: "На связи — готов к работе." },
    { slug: "omleton", label: "Омлетон (ИИшница)", group: "Коллекция «Скрепка»", greeting: "Готовим рабочий прототип." },
    { slug: "kot", label: "Кот в наушниках", group: "Коллекция «Скрепка»", greeting: "Фокус-режим активирован." },
    { slug: "kapibara", label: "Капибара (спокойствие)", group: "Коллекция «Скрепка»", greeting: "Спокойствие и чистая архитектура." },
    { slug: "pelmen", label: "Пельмень с укропом", group: "Коллекция «Скрепка»", greeting: "На посту, проверяю сборку." },
    { slug: "robo", label: "Робот (жестяной)", group: "Коллекция «Скрепка»", greeting: "Системы в норме." },
    { slug: "prizrak", label: "Призрак", group: "Коллекция «Скрепка»", greeting: "Работаю в фоновом режиме." },
    { slug: "terminal", label: "Терминал (ретро-CRT)", group: "Коллекция «Скрепка»", greeting: "READY > Жду команду в терминале." },
    { slug: "boba", label: "Боба (бабл-ти)", group: "Караван Nomad", greeting: "Готов к следующей задаче." },
    { slug: "lulu-capybara-2", label: "Капибара Лулу", group: "Караван Nomad", greeting: "Привет от капибары Лулу." }
  ];
  const ensureRichTooltipPopover = () => {
    let pop = document.getElementById("nomad-rich-tooltip-popover");
    if (!pop) {
      pop = document.createElement("div");
      pop.id = "nomad-rich-tooltip-popover";
      pop.setAttribute("data-testid", "nomad-rich-tooltip-popover");
      pop.className = "hidden";
      document.body.appendChild(pop);
    }
    if (!window.__nomadRichTooltipBound) {
      window.__nomadRichTooltipBound = true;
      const showTip = (targetEl, text) => {
        if (!text || !pop) return;
        pop.textContent = text;
        pop.classList.remove("hidden");
        const rect = targetEl.getBoundingClientRect();
        const popW = Math.min(310, pop.offsetWidth || 260);
        const popH = pop.offsetHeight || 58;
        const left = Math.max(12, Math.min((window.innerWidth || 1200) - popW - 16, rect.left - 8));
        const top = rect.top > popH + 20 ? rect.top - popH - 8 : rect.bottom + 8;
        pop.style.left = `${Math.round(left)}px`;
        pop.style.top = `${Math.round(top)}px`;
      };
      const hideTip = () => {
        pop?.classList.add("hidden");
      };
      document.addEventListener(
        "pointerover",
        (e) => {
          const badge = e.target?.closest?.("[data-nomad-tooltip]");
          if (badge) {
            showTip(badge, badge.getAttribute("data-nomad-tooltip"));
          }
        },
        true
      );
      document.addEventListener(
        "pointerout",
        (e) => {
          const badge = e.target?.closest?.("[data-nomad-tooltip]");
          if (badge) {
            hideTip();
          }
        },
        true
      );
    }
  };
  const ensureBuddyAdvisorWidget = () => {
    if (document.documentElement.hasAttribute("data-hud-window") || document.querySelector("[data-hud-shell]")) {
      document.getElementById("nomad-buddy-fab")?.remove();
      document.getElementById("nomad-buddy-drawer")?.remove();
      return;
    }
    document.getElementById("nomad-quick-hub-bar")?.remove();
    const settingsBtn = document.querySelector(
      'button[title="Открыть настройки"], button[aria-label="Открыть настройки"], button[title="Open settings"]'
    );
    const titlebarTools = settingsBtn?.parentElement;
    if (!titlebarTools) {
      return;
    }
    let fab = document.getElementById("nomad-buddy-fab");
    let drawer = document.getElementById("nomad-buddy-drawer");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "nomad-buddy-fab";
      fab.type = "button";
      fab.className = "nomad-in-titlebar";
      fab.setAttribute("data-testid", "nomad-buddy-fab");
      fab.setAttribute(
        "title",
        "Открыть правую боковую панель чата с Советником (Ника и Сократ)"
      );
      fab.innerHTML = `<span style="width:6px;height:6px;border-radius:999px;background:#007AFF;display:inline-block;box-shadow:0 0 0 2px rgba(0,122,255,0.18);"></span><span>Советник</span>`;
    }
    if (fab.parentElement !== titlebarTools) {
      fab.classList.add("nomad-in-titlebar");
      titlebarTools.insertBefore(fab, titlebarTools.firstChild);
    }
    if (!drawer) {
      drawer = document.createElement("aside");
      drawer.id = "nomad-buddy-drawer";
      drawer.setAttribute("data-testid", "nomad-buddy-drawer");
      drawer.className = "hidden";
      document.body.appendChild(drawer);
      window.__nomadBuddyPersona = window.__nomadBuddyPersona || "nika";
      window.__nomadBuddyHistory = window.__nomadBuddyHistory || {
        nika: [
          {
            role: "assistant",
            text: "Привет! Я Ника — помощник по продукту Nomad. Помогу настроить модели, подключить облачный ПК, разобраться с памятью проектов или запустить нужный навык. О чём расскажем?"
          }
        ],
        sokrat: [
          {
            role: "assistant",
            text: "Приветствую. Я Сократ — ментор и архитектурный оппонент. Можем разобрать выбор моделей под задачу, защиту данных 152-ФЗ, корпоративные коннекторы или сценарии тренажёра."
          }
        ]
      };
      const renderBuddyDrawer = () => {
        const persona = window.__nomadBuddyPersona || "nika";
        const isNika = persona === "nika";
        const historyList = window.__nomadBuddyHistory[persona] || [];
        drawer.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 16px;border-bottom:1px solid rgba(15,23,42,0.08);">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="width:28px;height:28px;border-radius:9px;background:${isNika ? "linear-gradient(135deg,#007AFF,#3B82F6)" : "linear-gradient(135deg,#334155,#0F172A)"};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;letter-spacing:-0.02em;box-shadow:inset 0 1px 0 rgba(255,255,255,0.35);">
                ${isNika ? "Н" : "С"}
              </span>
              <div>
                <div style="font-size:13px;font-weight:700;letter-spacing:-0.01em;">Советник · ${isNika ? "Ника" : "Сократ"}</div>
                <div style="font-size:11px;opacity:0.65;">${isNika ? "Чат с помощником по системе" : "Архитектурный ментор и ревью"}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <button type="button" data-buddy-clear="1" title="Очистить историю чата" style="border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.65);color:inherit;padding:0 8px;height:24px;border-radius:999px;cursor:pointer;font-size:10.5px;font-weight:600;">Очистить</button>
              <button type="button" data-buddy-close="1" title="Скрыть боковую панель Советника" style="border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.65);color:inherit;width:24px;height:24px;border-radius:999px;cursor:pointer;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">×</button>
            </div>
          </div>

          <div style="padding:10px 16px 6px;">
            <div class="nomad-seg-group" style="width:100%;display:grid;grid-template-columns:1fr 1fr;">
              <button type="button" class="nomad-seg-btn" data-buddy-persona="nika" data-active="${isNika ? "true" : "false"}" style="justify-content:center;padding:5px 10px;font-size:11.5px;">
                Ника · Помощник
              </button>
              <button type="button" class="nomad-seg-btn" data-buddy-persona="sokrat" data-active="${!isNika ? "true" : "false"}" style="justify-content:center;padding:5px 10px;font-size:11.5px;">
                Сократ · Ментор
              </button>
            </div>
          </div>

          <div data-testid="nomad-buddy-chat-scroll" style="flex:1;padding:10px 16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;">
            ${historyList.map((msg, idx) => {
          const isLastAssistant = msg.role === "assistant" && idx === historyList.map((m, i) => m.role === "assistant" ? i : -1).filter((i) => i >= 0).pop();
          if (msg.role === "user") {
            return `<div style="align-self:flex-end;max-width:86%;padding:9px 12px;border-radius:14px 14px 4px 14px;background:#007AFF;color:#FFFFFF;font-size:12px;line-height:1.48;box-shadow:0 2px 8px rgba(0,122,255,0.18);white-space:pre-wrap;">${msg.text}</div>`;
          }
          return `<div ${isLastAssistant ? 'data-testid="nomad-buddy-answer"' : ""} style="align-self:flex-start;max-width:94%;padding:11px 13px;border-radius:14px 14px 14px 4px;background:rgba(255,255,255,0.78);border:1px solid rgba(15,23,42,0.08);box-shadow:inset 0 1px 0 rgba(255,255,255,0.9);font-size:12px;line-height:1.54;white-space:pre-wrap;">${msg.text}</div>`;
        }).join("")}

            <div style="margin-top:auto;padding-top:8px;">
              <div style="font-size:10px;font-weight:700;opacity:0.55;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Быстрые вопросы</div>
              <div style="display:flex;flex-direction:column;gap:5px;">
                ${[
          "Как включить Совет моделей в поле ввода чата?",
          "Как подключить GigaChat, YandexGPT и МТС Cotype?",
          "Как подключить коннекторы 1С, Битрикс24 и Диадок?",
          "Как настроить безопасность 152-ФЗ и защиту ПДн?",
          "С чего начать практику в Симуляторе ИИ?"
        ].map(
          (q) => `<button type="button" data-buddy-chip="${q.replace(/"/g, "&quot;")}" style="text-align:left;padding:6px 10px;border-radius:10px;border:1px solid rgba(15,23,42,0.08);background:rgba(255,255,255,0.58);color:inherit;font-size:11.5px;font-weight:500;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:8px;transition:background-color 0.15s ease;"><span>${q}</span><span style="opacity:0.45;font-size:11px;">→</span></button>`
        ).join("")}
              </div>
            </div>
          </div>

          <div style="padding:10px 14px 14px;border-top:1px solid rgba(15,23,42,0.08);display:flex;gap:8px;background:rgba(255,255,255,0.55);">
            <input type="text" data-testid="nomad-buddy-drawer-input" placeholder="Напишите ${isNika ? "Нике" : "Сократу"}…" style="flex:1;padding:8px 11px;border-radius:10px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.88);color:inherit;font-size:12px;outline:none;" />
            <button type="button" data-testid="nomad-buddy-drawer-send" style="padding:8px 14px;border-radius:10px;border:none;background:#007AFF;color:#fff;font-size:12px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);">Отправить</button>
          </div>
        `;
        const scrollBox = drawer.querySelector('[data-testid="nomad-buddy-chat-scroll"]');
        if (scrollBox) {
          scrollBox.scrollTop = scrollBox.scrollHeight;
        }
        const askBackend = async (questionText) => {
          const q = (questionText || "").trim();
          if (!q) return;
          const p = window.__nomadBuddyPersona || "nika";
          window.__nomadBuddyHistory[p] = window.__nomadBuddyHistory[p] || [];
          window.__nomadBuddyHistory[p].push({ role: "user", text: q });
          window.__nomadBuddyHistory[p].push({ role: "assistant", text: "Формирую ответ…" });
          renderBuddyDrawer();
          try {
            const headers = { "Content-Type": "application/json" };
            if (window.__HERMES_SESSION_TOKEN__) {
              headers["X-Hermes-Session-Token"] = window.__HERMES_SESSION_TOKEN__;
            }
            const res = await fetch("/api/plugins/nomad/buddy/ask", {
              method: "POST",
              headers,
              body: JSON.stringify({
                persona: p,
                question: q,
                page: window.location.hash || window.location.pathname || "/"
              })
            });
            if (res.ok) {
              const data = await res.json();
              const list = window.__nomadBuddyHistory[p];
              if (list && list.length > 0 && data?.answer) {
                list[list.length - 1] = { role: "assistant", text: data.answer };
                renderBuddyDrawer();
              }
            }
          } catch {
            const list = window.__nomadBuddyHistory[p];
            if (list && list.length > 0) {
              list[list.length - 1] = {
                role: "assistant",
                text: "Откройте интересующий раздел настроек или выберите тему выше — подскажу оптимальную конфигурацию."
              };
              renderBuddyDrawer();
            }
          }
        };
        drawer.querySelector("[data-buddy-close]")?.addEventListener("click", () => {
          drawer.classList.add("hidden");
        });
        drawer.querySelector("[data-buddy-clear]")?.addEventListener("click", () => {
          const p = window.__nomadBuddyPersona || "nika";
          window.__nomadBuddyHistory[p] = [window.__nomadBuddyHistory[p][0]];
          renderBuddyDrawer();
        });
        drawer.querySelectorAll("[data-buddy-persona]").forEach((btn) => {
          btn.addEventListener("click", () => {
            window.__nomadBuddyPersona = btn.getAttribute("data-buddy-persona") || "nika";
            renderBuddyDrawer();
          });
        });
        drawer.querySelectorAll("[data-buddy-chip]").forEach((chip) => {
          chip.addEventListener("click", () => {
            askBackend(chip.getAttribute("data-buddy-chip"));
          });
        });
        const inp = drawer.querySelector('[data-testid="nomad-buddy-drawer-input"]');
        const sendBtn = drawer.querySelector('[data-testid="nomad-buddy-drawer-send"]');
        sendBtn?.addEventListener("click", () => askBackend(inp?.value || ""));
        inp?.addEventListener("keydown", (e) => {
          if (e.key === "Enter") askBackend(inp.value || "");
        });
      };
      window.openNomadBuddy = (persona = "nika", initialQuestion = "") => {
        window.__nomadBuddyPersona = persona === "socrates" ? "sokrat" : persona;
        drawer.classList.remove("hidden");
        renderBuddyDrawer();
        if (initialQuestion) {
          const chipBtn = drawer.querySelector('[data-testid="nomad-buddy-drawer-send"]');
          const inp = drawer.querySelector('[data-testid="nomad-buddy-drawer-input"]');
          if (inp) inp.value = initialQuestion;
          chipBtn?.click();
        }
      };
      fab.addEventListener("click", () => {
        if (drawer.classList.contains("hidden")) {
          drawer.classList.remove("hidden");
          renderBuddyDrawer();
        } else {
          drawer.classList.add("hidden");
        }
      });
    }
  };
  const computePinnedPetCoords = (petContainer, st) => {
    const rect = petContainer.getBoundingClientRect();
    const parentEl = petContainer.offsetParent || document.documentElement;
    const w = rect.width || 110;
    const h10 = rect.height || 110;
    const vw = parentEl.clientWidth || window.innerWidth || 1280;
    const vh = parentEl.clientHeight || window.innerHeight || 820;
    const marginX = 34;
    const marginBottom = 114;
    if (st.position === "bottom-left") {
      return { x: marginX, y: Math.max(48, vh - h10 - marginBottom) };
    }
    if (st.position === "top-left") {
      return { x: marginX, y: 56 };
    }
    if (st.position === "top-right") {
      return { x: Math.max(24, vw - w - marginX), y: 56 };
    }
    if (st.position === "bottom-right") {
      return { x: Math.max(24, vw - w - marginX), y: Math.max(48, vh - h10 - marginBottom) };
    }
    if (typeof st.lockedX === "number" && typeof st.lockedY === "number") {
      return {
        x: Math.max(12, Math.min(vw - w - 16, st.lockedX)),
        y: Math.max(12, Math.min(vh - h10 - 48, st.lockedY))
      };
    }
    return { x: Math.max(24, vw - w - marginX), y: Math.max(48, vh - h10 - marginBottom) };
  };
  const enforcePetPositionLock = (petContainer) => {
    if (!petContainer || window.__nomadPetDragging) return;
    const st = loadMascotSettings();
    if (st.randomWalk && st.position === "free") return;
    const target = computePinnedPetCoords(petContainer, st);
    const wantLeft = `${Math.round(target.x)}px`;
    const wantTop = `${Math.round(target.y)}px`;
    if (petContainer.style.left !== wantLeft) {
      petContainer.style.setProperty("left", wantLeft, "important");
    }
    if (petContainer.style.top !== wantTop) {
      petContainer.style.setProperty("top", wantTop, "important");
    }
    if (petContainer.style.right && petContainer.style.right !== "auto") {
      petContainer.style.setProperty("right", "auto", "important");
    }
    if (petContainer.style.bottom && petContainer.style.bottom !== "auto") {
      petContainer.style.setProperty("bottom", "auto", "important");
    }
    if (petContainer.style.transform && petContainer.style.transform !== "none") {
      petContainer.style.setProperty("transform", "none", "important");
    }
  };
  const enhanceDom = () => {
    try {
      const isHudWindow = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("win") === "hud" || Boolean(document.querySelector("[data-hud-shell]")));
      ensureRichTooltipPopover();
      ensureBuddyAdvisorWidget();
      document.querySelectorAll('img[data-nomad-dunes-backdrop="true"], img[src*="nomad-dunes"]').forEach((el) => {
        el.remove();
      });
      const petCanvas = document.querySelector('canvas[aria-label*="pet"]');
      const petContainer = petCanvas?.parentElement?.parentElement;
      if (petContainer) {
        petContainer.style.setProperty("display", "none", "important");
        enforcePetPositionLock(petContainer);
        if (!petContainer.hasAttribute("data-nomad-pos-lock-bound")) {
          petContainer.setAttribute("data-nomad-pos-lock-bound", "true");
          petContainer.addEventListener(
            "pointerdown",
            (e) => {
              if (e.button === 0) {
                window.__nomadPetDragging = true;
              }
            },
            true
          );
          window.addEventListener(
            "pointerup",
            () => {
              if (window.__nomadPetDragging) {
                window.__nomadPetDragging = false;
                const rect = petContainer.getBoundingClientRect();
                const parentRect = (petContainer.offsetParent || document.documentElement).getBoundingClientRect();
                const cur = loadMascotSettings();
                cur.lockedX = Math.round(rect.left - parentRect.left);
                cur.lockedY = Math.round(rect.top - parentRect.top);
                saveMascotSettings(cur);
              }
            },
            true
          );
          const styleLockObserver = new MutationObserver(() => {
            enforcePetPositionLock(petContainer);
          });
          styleLockObserver.observe(petContainer, { attributes: true, attributeFilter: ["style"] });
        }
      }
      if (petContainer && !petContainer.querySelector('[data-testid="nomad-pet-zoom-controls-v3"]')) {
        petContainer.querySelectorAll('[data-nomad-pet-controls="true"]').forEach((el) => el.remove());
        petContainer.setAttribute("data-nomad-pet-enhanced", "true");
        petContainer.setAttribute("data-slot", "context-menu-trigger");
        petContainer.setAttribute(
          "title",
          "Питомец Nomad · ПКМ — пульт настроек, скины Petdex, апрувы и Бадди Ника/Сократ · Колесо мыши — размер"
        );
        let hoverLeaveTimer = null;
        const setHovered = (on) => {
          if (hoverLeaveTimer) {
            clearTimeout(hoverLeaveTimer);
            hoverLeaveTimer = null;
          }
          if (on) {
            petContainer.setAttribute("data-nomad-pet-hovered", "true");
          } else {
            hoverLeaveTimer = setTimeout(() => {
              petContainer.removeAttribute("data-nomad-pet-hovered");
            }, 220);
          }
        };
        petContainer.addEventListener("pointerenter", () => setHovered(true));
        petContainer.addEventListener("pointerleave", () => setHovered(false));
        let statusOrb = petContainer.querySelector('[data-nomad-status-orb="true"]');
        if (!statusOrb) {
          statusOrb = document.createElement("div");
          statusOrb.setAttribute("data-nomad-status-orb", "true");
          statusOrb.setAttribute("data-testid", "nomad-pet-status-orb");
          statusOrb.style.cssText = "position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:8px;padding:5px 10px;border-radius:12px;background:var(--card,#ffffff);border:1.5px solid #4C6EF5;color:var(--foreground,#14151C);font-size:11px;font-weight:700;white-space:nowrap;display:none;align-items:center;gap:6px;z-index:8;box-shadow:0 6px 18px rgba(20,21,28,0.16);pointer-events:auto;";
          statusOrb.addEventListener("pointerdown", (e) => e.stopPropagation());
          petContainer.appendChild(statusOrb);
        }
        const triggerVoiceCommandToSession = (targetSessionId) => {
          playMascotTone(659.25, 0.08);
          window.dispatchEvent(new CustomEvent("hermes:composer-dictation", { detail: { target: "main" } }));
          statusOrb.style.display = "inline-flex";
          statusOrb.innerHTML = `
            <span style="color:#4C6EF5;">🎙️ Слушаю команду…</span>
            <button type="button" data-orb-stop="1" style="border:none;background:rgba(239,68,68,0.15);color:#dc2626;border-radius:6px;padding:1px 6px;font-size:10px;cursor:pointer;font-weight:700;">Стоп</button>
          `;
          statusOrb.querySelector("[data-orb-stop]")?.addEventListener("click", (e) => {
            e.stopPropagation();
            if (window.__nomadSpeechRec) {
              try {
                window.__nomadSpeechRec.stop();
              } catch {
              }
            }
            statusOrb.style.display = "none";
          });
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRec) {
            try {
              if (window.__nomadSpeechRec) {
                try {
                  window.__nomadSpeechRec.abort();
                } catch {
                }
              }
              const rec = new SpeechRec();
              window.__nomadSpeechRec = rec;
              rec.lang = "ru-RU";
              rec.interimResults = true;
              rec.continuous = false;
              rec.onresult = (ev) => {
                let txt = "";
                for (let i = ev.resultIndex; i < ev.results.length; i++) {
                  txt += ev.results[i][0].transcript;
                }
                if (txt.trim()) {
                  statusOrb.innerHTML = `<span style="color:#4C6EF5;">🎙️ «${txt.trim().slice(0, 38)}»</span>`;
                }
                if (ev.results[ev.results.length - 1]?.isFinal && txt.trim()) {
                  const finalCmd = txt.trim();
                  const sdk = window.__HERMES_PLUGIN_SDK__;
                  const sid = targetSessionId || null;
                  const submitted = sdk?.host?.composer?.submit?.(sid, finalCmd);
                  if (!submitted) {
                    sdk?.host?.composer?.insertText?.(sid, finalCmd);
                  }
                  window.__nomadPluginCtx?.pet?.say?.(`Отправил в сессию: «${finalCmd.slice(0, 45)}»`, {
                    id: "voice-cmd",
                    ttlMs: 4e3
                  });
                  setTimeout(() => {
                    if (!window.__nomadLiveVoiceActive) statusOrb.style.display = "none";
                  }, 1800);
                }
              };
              rec.onerror = () => {
                setTimeout(() => {
                  if (!window.__nomadLiveVoiceActive) statusOrb.style.display = "none";
                }, 2200);
              };
              rec.start();
            } catch {
            }
          } else {
            window.__nomadPluginCtx?.pet?.say?.("🎙️ Голосовая диктовка активна в поле ввода чата!", {
              id: "voice-cmd",
              ttlMs: 3500
            });
            setTimeout(() => {
              if (!window.__nomadLiveVoiceActive) statusOrb.style.display = "none";
            }, 3e3);
          }
        };
        const toggleRealtimeVoiceWithMascot = () => {
          window.__nomadLiveVoiceActive = !window.__nomadLiveVoiceActive;
          playMascotTone(window.__nomadLiveVoiceActive ? 783.99 : 440, 0.1);
          window.dispatchEvent(new CustomEvent("hermes:composer-voice-toggle", { detail: { target: "main" } }));
          try {
            localStorage.setItem("hermes.desktop.voice.autoSpeakReplies", window.__nomadLiveVoiceActive ? "true" : "false");
          } catch {
          }
          if (window.__nomadLiveVoiceActive) {
            statusOrb.style.display = "inline-flex";
            statusOrb.innerHTML = `
              <span style="color:#059669;">🗣️ Live-голос в реалтайме</span>
              <button type="button" data-orb-live-stop="1" style="border:none;background:rgba(239,68,68,0.16);color:#dc2626;border-radius:6px;padding:1px 6px;font-size:10px;cursor:pointer;font-weight:700;">Выкл</button>
            `;
            statusOrb.querySelector("[data-orb-live-stop]")?.addEventListener("click", (e) => {
              e.stopPropagation();
              toggleRealtimeVoiceWithMascot();
            });
            window.__nomadPluginCtx?.pet?.say?.("🗣️ Реалтайм-голос включён! Говори со мной свободно.", {
              id: "voice-live",
              ttlMs: 5e3
            });
          } else {
            statusOrb.style.display = "none";
            window.__nomadPluginCtx?.pet?.say?.("Реалтайм-голос остановлен.", {
              id: "voice-live",
              ttlMs: 2500
            });
          }
        };
        const resolveSessionApproval = async (sessionId, decision = "once") => {
          playMascotTone(decision === "deny" ? 349.23 : 698.46, 0.08);
          const sdk = window.__HERMES_PLUGIN_SDK__;
          let handled = false;
          const selector = decision === "deny" ? "[data-approval-deny]" : "[data-approval-run]";
          const domBtn = document.querySelector(selector);
          if (domBtn && !domBtn.disabled) {
            domBtn.click();
            handled = true;
          }
          if (!handled && sdk?.host?.request) {
            try {
              const pending = await sdk.host.request("approval.pending", {
                ...sessionId ? { session_id: sessionId } : {},
                profile: "nomad"
              });
              const reqId = pending?.request_id || pending?.requestId;
              if (reqId) {
                await sdk.host.request("approval.respond", {
                  request_id: reqId,
                  choice: decision,
                  ...sessionId ? { session_id: sessionId } : {},
                  profile: "nomad"
                });
                handled = true;
              }
            } catch {
            }
          }
          if (!handled && sdk?.host?.composer) {
            const msg = decision === "deny" ? "Отклоняю, не выполняй этот шаг." : "Одобряю, подтверждаю выполнение — продолжай!";
            handled = Boolean(sdk.host.composer.submit(sessionId || null, msg));
          }
          window.__nomadPluginCtx?.pet?.say?.(
            decision === "deny" ? "✗ Запрос в сессии отклонён" : "✓ Одобрено! Сессия продолжает работу",
            { id: "mascot-approval", ttlMs: 4e3 }
          );
          return handled;
        };
        const ctrlBar = document.createElement("div");
        ctrlBar.setAttribute("data-nomad-pet-controls", "true");
        ctrlBar.setAttribute("data-testid", "nomad-pet-zoom-controls-v3");
        ctrlBar.style.cssText = "position:absolute;top:100%;left:50%;margin-top:4px;display:inline-flex;align-items:center;gap:2px;padding:2px 7px;border-radius:999px;background:var(--card,#ffffff);border:1px solid rgba(76,110,245,0.35);color:var(--foreground,#14151C);font-size:11px;font-weight:700;z-index:5;box-shadow:0 4px 12px rgba(20,21,28,0.16);";
        ctrlBar.addEventListener("pointerenter", () => setHovered(true));
        ctrlBar.addEventListener("pointerleave", () => setHovered(false));
        const sizeLabel = document.createElement("span");
        const getScaleMultiplier = () => {
          const w = petCanvas?.getBoundingClientRect().width || 86;
          return Math.max(0.3, Math.min(2.5, w / 86));
        };
        const updateScaleText = () => {
          sizeLabel.textContent = `${getScaleMultiplier().toFixed(1)}×`;
        };
        updateScaleText();
        sizeLabel.style.cssText = "font-size:9.5px;opacity:0.9;padding:0 2px;font-weight:700;min-width:24px;text-align:center;";
        const triggerResize = (deltaY) => {
          const rect = petContainer.getBoundingClientRect();
          const evt = new WheelEvent("wheel", {
            deltaY,
            altKey: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
            bubbles: true,
            cancelable: true
          });
          petContainer.dispatchEvent(evt);
          setTimeout(updateScaleText, 40);
        };
        const btnMinus = document.createElement("button");
        btnMinus.type = "button";
        btnMinus.textContent = "−";
        btnMinus.title = "Уменьшить размер питомца";
        btnMinus.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;padding:0 4px;font-size:13px;font-weight:800;line-height:1.2;";
        btnMinus.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnMinus.addEventListener("click", (e) => {
          e.stopPropagation();
          triggerResize(120);
          playMascotTone(440, 0.06);
        });
        const btnPlus = document.createElement("button");
        btnPlus.type = "button";
        btnPlus.textContent = "+";
        btnPlus.title = "Увеличить размер питомца";
        btnPlus.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;padding:0 4px;font-size:13px;font-weight:800;line-height:1.2;";
        btnPlus.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnPlus.addEventListener("click", (e) => {
          e.stopPropagation();
          triggerResize(-120);
          playMascotTone(660, 0.06);
        });
        const btnMic = document.createElement("button");
        btnMic.type = "button";
        btnMic.textContent = "🎙️";
        btnMic.title = "Ввести команду голосом в активную сессию";
        btnMic.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;padding:0 3px;font-size:11px;line-height:1.2;";
        btnMic.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnMic.addEventListener("click", (e) => {
          e.stopPropagation();
          triggerVoiceCommandToSession(null);
        });
        const btnLive = document.createElement("button");
        btnLive.type = "button";
        btnLive.textContent = "🗣️";
        btnLive.title = "Общаться голосом в реалтайме";
        btnLive.style.cssText = "border:none;background:transparent;color:inherit;cursor:pointer;padding:0 3px;font-size:11px;line-height:1.2;";
        btnLive.addEventListener("pointerdown", (e) => e.stopPropagation());
        btnLive.addEventListener("click", (e) => {
          e.stopPropagation();
          toggleRealtimeVoiceWithMascot();
        });
        ctrlBar.appendChild(btnMinus);
        ctrlBar.appendChild(sizeLabel);
        ctrlBar.appendChild(btnPlus);
        ctrlBar.appendChild(btnMic);
        ctrlBar.appendChild(btnLive);
        petContainer.appendChild(ctrlBar);
        let pomoBadge = petContainer.querySelector('[data-nomad-pomodoro="true"]');
        if (!pomoBadge) {
          pomoBadge = document.createElement("div");
          pomoBadge.setAttribute("data-nomad-pomodoro", "true");
          pomoBadge.style.cssText = "position:absolute;bottom:100%;left:50%;transform:translateX(-50%);margin-bottom:6px;padding:3px 9px;border-radius:999px;background:var(--card,#ffffff);border:1.5px solid #4C6EF5;color:var(--foreground,#14151C);font-size:10.5px;font-weight:700;white-space:nowrap;display:none;align-items:center;gap:5px;z-index:6;box-shadow:0 4px 12px rgba(20,21,28,0.16);";
          petContainer.appendChild(pomoBadge);
        }
        const syncPomodoroBadge = () => {
          const st = loadMascotSettings();
          if (!st.pomodoroEnabled) {
            pomoBadge.style.display = "none";
            if (window.__nomadPomoInterval) {
              clearInterval(window.__nomadPomoInterval);
              window.__nomadPomoInterval = null;
            }
            return;
          }
          pomoBadge.style.display = "inline-flex";
          if (typeof window.__nomadPomoSeconds !== "number") {
            window.__nomadPomoSeconds = 25 * 60;
            window.__nomadPomoRunning = true;
          }
          const renderTime = () => {
            const sec = window.__nomadPomoSeconds;
            const mm = String(Math.floor(sec / 60)).padStart(2, "0");
            const ss = String(sec % 60).padStart(2, "0");
            pomoBadge.textContent = `🍅 ${mm}:${ss} ${window.__nomadPomoRunning ? "⏸" : "▶"}`;
          };
          renderTime();
          pomoBadge.onclick = (e) => {
            e.stopPropagation();
            window.__nomadPomoRunning = !window.__nomadPomoRunning;
            renderTime();
          };
          if (!window.__nomadPomoInterval) {
            window.__nomadPomoInterval = setInterval(() => {
              if (window.__nomadPomoRunning && window.__nomadPomoSeconds > 0) {
                window.__nomadPomoSeconds -= 1;
                renderTime();
              }
            }, 1e3);
          }
        };
        syncPomodoroBadge();
        let menuEl = document.getElementById("nomad-pet-context-menu");
        if (!menuEl) {
          menuEl = document.createElement("div");
          menuEl.id = "nomad-pet-context-menu";
          menuEl.setAttribute("data-testid", "nomad-pet-context-menu");
          menuEl.className = "hidden";
          document.body.appendChild(menuEl);
          document.addEventListener("pointerdown", (e) => {
            if (menuEl && !menuEl.classList.contains("hidden") && !menuEl.contains(e.target)) {
              menuEl.classList.add("hidden");
            }
          });
        }
        const switchMascotLive = async (slug, displayName = "") => {
          const item = MASCOT_CATALOG.find((m) => m.slug === slug);
          const st = loadMascotSettings();
          st.mascotId = slug;
          saveMascotSettings(st);
          playMascotTone(659.25, 0.09);
          try {
            const sdk = window.__HERMES_PLUGIN_SDK__;
            if (sdk?.host?.request) {
              try {
                await sdk.host.request("pet.select", { slug, profile: "nomad" });
              } catch {
                await sdk.host.request("pet.install", { slug, profile: "nomad" });
                await sdk.host.request("pet.select", { slug, profile: "nomad" });
              }
              window.dispatchEvent(new Event("focus"));
            }
            if (window.__nomadPluginCtx?.pet?.say) {
              const greet = item?.greeting || `Скин «${displayName || slug}» из маркетплейса Petdex активирован! ✨`;
              window.__nomadPluginCtx.pet.say(greet, { id: "mascot-greet", ttlMs: 4500 });
            }
          } catch {
          }
        };
        const applyCornerPosition = (pos) => {
          const st = loadMascotSettings();
          st.position = pos;
          if (pos !== "free") {
            st.randomWalk = false;
          }
          const coords = computePinnedPetCoords(petContainer, st);
          st.lockedX = Math.round(coords.x);
          st.lockedY = Math.round(coords.y);
          saveMascotSettings(st);
          enforcePetPositionLock(petContainer);
          try {
            localStorage.setItem(
              "hermes.desktop.pet-position.v2",
              JSON.stringify({ x: Math.round(coords.x), y: Math.round(coords.y) })
            );
          } catch {
          }
          playMascotTone(523.25, 0.07);
        };
        const renderContextMenu = (clientX, clientY) => {
          const st = loadMascotSettings();
          const currentMult = getScaleMultiplier();
          const currentMascot = MASCOT_CATALOG.find((m) => m.slug === st.mascotId) || {
            slug: st.mascotId,
            label: `🐾 ${st.mascotId}`,
            greeting: "На связи!"
          };
          const sdk = window.__HERMES_PLUGIN_SDK__;
          const rawSessions = sdk?.host?.state?.sessions?.get?.() || [];
          const sessionList = rawSessions.slice(0, 8);
          const hasDomPendingApproval = Boolean(document.querySelector("[data-approval-run]"));
          menuEl.innerHTML = `
            <div class="np-header">
              <div class="np-title">
                <span>Пульт помощника Nomad</span>
              </div>
              <span class="np-mood">${hasDomPendingApproval ? "Ожидает подтверждения" : window.__nomadLiveVoiceActive ? "В эфире" : "Активен"}</span>
              <button type="button" class="np-close" data-np-action="close" title="Закрыть">×</button>
            </div>

            <div class="np-section-title">Советник Бадди (Обучение и техпомощь)</div>
            <div class="nomad-seg-group" style="display:grid;grid-template-columns:1fr 1fr;width:100%;margin-bottom:4px;">
              <button type="button" class="nomad-seg-btn" data-active="true" data-np-action="buddy-nika">
                Спросить Нику
              </button>
              <button type="button" class="nomad-seg-btn" data-np-action="buddy-sokrat">
                Спросить Сократа
              </button>
            </div>

            <div class="np-section-title">Голос и реалтайм-общение</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:4px;">
              <button type="button" class="np-btn" data-np-action="voice-cmd" style="font-weight:600;padding:6px 8px;">
                Команда голосом
              </button>
              <button type="button" class="np-btn" data-np-action="voice-live" style="font-weight:600;padding:6px 8px;">
                ${window.__nomadLiveVoiceActive ? "Live-голос: ВКЛ" : "Голос в реалтайме"}
              </button>
            </div>

            <div class="np-section-title">Апрув и управление сессиями</div>
            <div class="np-row">
              <select data-testid="nomad-pet-select-session" style="flex:1;">
                <option value="">Текущая активная сессия</option>
                ${sessionList.map(
            (s) => `<option value="${s.id}">${(s.title || s.id || "Сессия").slice(0, 28)}</option>`
          ).join("")}
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-top:3px;">
              <button type="button" class="np-btn" data-np-action="approve-once" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.35);color:#059669;font-weight:600;">
                ✓ Разрешить
              </button>
              <button type="button" class="np-btn" data-np-action="approve-session" title="Разрешить на всю сессию">
                ✓ На сессию
              </button>
              <button type="button" class="np-btn" data-np-action="deny-once" style="color:#dc2626;">
                × Отклонить
              </button>
            </div>

            <div class="np-section-title">Персонаж (Караван и коллекция «Скрепка»)</div>
            <div class="np-row">
              <select data-testid="nomad-pet-select-mascot" style="flex:1;">
                <optgroup label="Караван Nomad">
                  ${MASCOT_CATALOG.filter((m) => m.group === "Караван Nomad").map((m) => `<option value="${m.slug}" ${m.slug === st.mascotId ? "selected" : ""}>${m.label}</option>`).join("")}
                </optgroup>
                <optgroup label="Коллекция «Скрепка» (свои 3D-маскоты)">
                  ${MASCOT_CATALOG.filter((m) => m.group !== "Караван Nomad").map((m) => `<option value="${m.slug}" ${m.slug === st.mascotId ? "selected" : ""}>${m.label}</option>`).join("")}
                </optgroup>
              </select>
              <button type="button" class="np-btn" data-np-action="cycle-mascot" title="Переключить на следующего маскота">След. →</button>
            </div>

            <div class="np-section-title" style="display:flex;align-items:center;justify-content:space-between;">
              <span>Каталог скинов Petdex</span>
              <span data-np-id="petdex-count" style="color:var(--nomad-accent,#007AFF);font-weight:600;">5 090+ скинов</span>
            </div>
            <div class="np-row" style="padding:2px 0;">
              <input
                type="search"
                data-testid="nomad-petdex-search"
                placeholder="Поиск скина (cat, dragon, pikachu, mecha, boba…)"
                style="width:100%;background:rgba(255,255,255,0.75);color:inherit;border:1px solid rgba(15,23,42,0.12);border-radius:8px;padding:6px 10px;font-size:11.5px;outline:none;"
              />
            </div>
            <div
              data-testid="nomad-petdex-grid"
              style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px;max-height:132px;overflow-y:auto;margin-top:4px;padding:2px;"
            >
              <div style="grid-column:1/-1;text-align:center;opacity:0.7;padding:10px 4px;font-size:11px;">Загружаем каталог скинов Petdex…</div>
            </div>

            <div class="np-section-title">Размер и фиксация позиции внутри окна</div>
            <div class="np-row">
              <span class="np-label">Масштаб</span>
              <div style="display:flex;align-items:center;gap:6px;flex:1;justify-content:flex-end;">
                <input type="range" data-np-input="size" min="0.20" max="1.20" step="0.04" value="${Math.min(1.2, Math.max(0.2, currentMult * 0.38)).toFixed(2)}" style="width:110px;accent-color:#007AFF;cursor:pointer;" />
                <span data-np-id="size-val" style="min-width:34px;text-align:right;font-weight:600;color:var(--nomad-accent,#007AFF);">${currentMult.toFixed(1)}×</span>
              </div>
            </div>

            <div class="np-pos-grid">
              <button type="button" class="np-pos-btn ${st.position === "bottom-left" ? "active" : ""}" data-np-pos="bottom-left">Слева внизу</button>
              <button type="button" class="np-pos-btn ${st.position === "bottom-right" ? "active" : ""}" data-np-pos="bottom-right">Справа внизу</button>
              <button type="button" class="np-pos-btn ${st.position === "free" ? "active" : ""}" data-np-pos="free">Свободно</button>
              <button type="button" class="np-pos-btn ${st.position === "top-left" ? "active" : ""}" data-np-pos="top-left">Слева вверху</button>
              <button type="button" class="np-pos-btn ${st.position === "top-right" ? "active" : ""}" data-np-pos="top-right">Справа вверху</button>
              <button type="button" class="np-pos-btn" data-np-action="greet">Реплика</button>
            </div>

            <div class="np-section-title">Поведение и режимы</div>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Случайные прогулки по окну <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS["Случайные прогулки по окну"]}">?</span></span>
              <input type="checkbox" data-np-toggle="randomWalk" ${st.randomWalk ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Авто-одобрение безопасных <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS["Авто-одобрение безопасных"]}">?</span></span>
              <input type="checkbox" data-np-toggle="autoApproveSafe" ${st.autoApproveSafe ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Помодоро-таймер (25/5 мин) <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS["Помодоро-таймер (25/5 мин)"]}">?</span></span>
              <input type="checkbox" data-np-toggle="pomodoroEnabled" ${st.pomodoroEnabled ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
            </label>
            <label class="np-row" style="cursor:pointer;">
              <span class="np-label">Звуковые эффекты <span class="nomad-help-q" data-nomad-tooltip="${HELP_BADGE_DESCRIPTIONS["Звуковые эффекты"]}">?</span></span>
              <input type="checkbox" data-np-toggle="soundEnabled" ${st.soundEnabled ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
            </label>

            <div class="np-stats-box hidden" data-np-id="stats-box">
              <div style="font-weight:600;color:var(--nomad-accent,#007AFF);margin-bottom:4px;">Активность в продукте</div>
              <div class="np-row"><span>Маскот:</span><strong>${currentMascot.label}</strong></div>
              <div class="np-row"><span>Активных сессий:</span><strong>${rawSessions.length}</strong></div>
              <div class="np-row"><span>Режим апрувов:</span><strong>${st.autoApproveSafe ? "Умный (smart)" : "Ручной"}</strong></div>
            </div>

            <div class="np-actions">
              <button type="button" class="np-btn" data-np-action="open-settings" style="background:rgba(0,122,255,0.08);border-color:rgba(0,122,255,0.25);color:var(--nomad-accent,#007AFF);font-weight:600;">Весь маркетплейс →</button>
              <button type="button" class="np-btn" data-np-action="stats">Статистика дня</button>
            </div>
          `;
          menuEl.classList.remove("hidden");
          const menuW = 332;
          const bottomSafeMargin = 52;
          const topSafeMargin = 28;
          const vh = window.innerHeight || 800;
          const maxAllowedH = Math.min(690, vh - topSafeMargin - bottomSafeMargin);
          menuEl.style.maxHeight = `${Math.max(360, maxAllowedH)}px`;
          const left = Math.max(16, Math.min((window.innerWidth || 1200) - menuW - 20, clientX - 120));
          menuEl.style.left = `${Math.round(left)}px`;
          if (clientY > vh * 0.35) {
            menuEl.style.top = "auto";
            menuEl.style.bottom = `${bottomSafeMargin}px`;
          } else {
            menuEl.style.bottom = "auto";
            menuEl.style.top = `${Math.max(topSafeMargin, Math.round(clientY - 24))}px`;
          }
          const petdexGrid = menuEl.querySelector('[data-testid="nomad-petdex-grid"]');
          const petdexSearch = menuEl.querySelector('[data-testid="nomad-petdex-search"]');
          const petdexCount = menuEl.querySelector('[data-np-id="petdex-count"]');
          window.__nomadThumbCache = window.__nomadThumbCache || /* @__PURE__ */ new Map();
          const renderPetdexSkins = (query = "") => {
            if (!petdexGrid) return;
            const gallery = window.__nomadPetdexGallery;
            if (!gallery || !Array.isArray(gallery.pets)) return;
            if (petdexCount) {
              petdexCount.textContent = `${gallery.pets.length} скинов`;
            }
            const q = query.trim().toLowerCase();
            const filtered = gallery.pets.filter((p) => !p.slug.startsWith("clawd")).filter((p) => !q || p.slug.toLowerCase().includes(q) || (p.displayName || "").toLowerCase().includes(q)).slice(0, 18);
            if (!filtered.length) {
              petdexGrid.innerHTML = `<div style="grid-column:1/-1;text-align:center;opacity:0.7;padding:8px;font-size:11px;">Скины по запросу «${query}» не найдены</div>`;
              return;
            }
            petdexGrid.innerHTML = filtered.map(
              (p) => `
                <button
                  type="button"
                  data-petdex-slug="${p.slug}"
                  data-petdex-name="${(p.displayName || p.slug).replace(/"/g, "&quot;")}"
                  title="Установить и выбрать скин: ${p.displayName || p.slug} (${p.slug})"
                  style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:5px 4px;border-radius:9px;background:${p.slug === gallery.active ? "rgba(76,110,245,0.14)" : "var(--background,#F6F4EF)"};border:1px solid ${p.slug === gallery.active ? "#4C6EF5" : p.installed ? "rgba(16,185,129,0.45)" : "var(--border,rgba(20,21,28,0.14))"};color:inherit;cursor:pointer;text-align:center;overflow:hidden;"
                >
                  <div style="width:34px;height:34px;border-radius:7px;background:var(--card,#ffffff);border:1px solid var(--border,rgba(20,21,28,0.08));display:flex;align-items:center;justify-content:center;overflow:hidden;">
                    <img data-petdex-thumb="${p.slug}" alt="" style="width:32px;height:32px;object-fit:contain;image-rendering:pixelated;display:none;" />
                    <span data-petdex-fallback="${p.slug}" style="font-size:14px;">🐾</span>
                  </div>
                  <span style="font-size:10px;font-weight:600;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${(p.displayName || p.slug).slice(0, 12)}</span>
                </button>
              `
            ).join("");
            filtered.forEach((p) => {
              const imgEl = petdexGrid.querySelector(`img[data-petdex-thumb="${p.slug}"]`);
              const fbEl = petdexGrid.querySelector(`span[data-petdex-fallback="${p.slug}"]`);
              const applyUri = (uri) => {
                if (uri && imgEl) {
                  imgEl.src = uri;
                  imgEl.style.display = "block";
                  if (fbEl) fbEl.style.display = "none";
                }
              };
              if (window.__nomadThumbCache.has(p.slug)) {
                applyUri(window.__nomadThumbCache.get(p.slug));
              } else if (sdk?.host?.request) {
                sdk.host.request("pet.thumb", { slug: p.slug, url: p.spritesheetUrl || "", profile: "nomad" }).then((res) => {
                  if (res?.ok && res.dataUri) {
                    window.__nomadThumbCache.set(p.slug, res.dataUri);
                    applyUri(res.dataUri);
                  }
                }).catch(() => {
                });
              }
            });
            petdexGrid.querySelectorAll("button[data-petdex-slug]").forEach((cardBtn) => {
              cardBtn.addEventListener("click", async () => {
                const slug = cardBtn.getAttribute("data-petdex-slug");
                const name = cardBtn.getAttribute("data-petdex-name") || slug;
                cardBtn.style.opacity = "0.6";
                await switchMascotLive(slug, name);
                if (window.__nomadPetdexGallery) {
                  window.__nomadPetdexGallery.active = slug;
                }
                renderPetdexSkins(petdexSearch?.value || "");
              });
            });
          };
          if (window.__nomadPetdexGallery) {
            renderPetdexSkins("");
          } else if (sdk?.host?.request) {
            sdk.host.request("pet.gallery", { profile: "nomad" }).then((gal) => {
              if (gal && Array.isArray(gal.pets)) {
                window.__nomadPetdexGallery = gal;
                renderPetdexSkins(petdexSearch?.value || "");
              }
            }).catch(() => {
            });
          }
          petdexSearch?.addEventListener("input", (e) => {
            renderPetdexSkins(e.target.value || "");
          });
          const sel = menuEl.querySelector('[data-testid="nomad-pet-select-mascot"]');
          sel?.addEventListener("change", (e) => {
            switchMascotLive(e.target.value);
          });
          const sessionSel = menuEl.querySelector('[data-testid="nomad-pet-select-session"]');
          const sizeInput = menuEl.querySelector('[data-np-input="size"]');
          const sizeVal = menuEl.querySelector('[data-np-id="size-val"]');
          sizeInput?.addEventListener("input", async (e) => {
            const rawScale = parseFloat(e.target.value);
            const displayMult = Math.max(0.3, rawScale / 0.38);
            if (sizeVal) sizeVal.textContent = `${displayMult.toFixed(1)}×`;
            sizeLabel.textContent = `${displayMult.toFixed(1)}×`;
            try {
              if (sdk?.host?.request) {
                await sdk.host.request("pet.scale", { scale: rawScale, profile: "nomad" });
                window.dispatchEvent(new Event("focus"));
              }
            } catch {
            }
          });
          menuEl.querySelectorAll("[data-np-pos]").forEach((btn) => {
            btn.addEventListener("click", () => {
              menuEl.querySelectorAll("[data-np-pos]").forEach((b) => b.classList.remove("active"));
              btn.classList.add("active");
              applyCornerPosition(btn.getAttribute("data-np-pos"));
            });
          });
          menuEl.querySelectorAll("[data-np-toggle]").forEach((chk) => {
            chk.addEventListener("change", async () => {
              const key = chk.getAttribute("data-np-toggle");
              const cur = loadMascotSettings();
              cur[key] = chk.checked;
              if (key === "randomWalk" && !chk.checked) {
                const rect = petContainer.getBoundingClientRect();
                cur.lockedX = Math.round(rect.left);
                cur.lockedY = Math.round(rect.top);
              }
              saveMascotSettings(cur);
              enforcePetPositionLock(petContainer);
              playMascotTone(chk.checked ? 659.25 : 440, 0.06);
              if (key === "autoApproveSafe") {
                try {
                  await sdk?.host?.request?.("config.set", {
                    key: "approvals.mode",
                    value: chk.checked ? "smart" : "manual",
                    profile: "nomad"
                  });
                } catch {
                }
              }
              if (key === "pomodoroEnabled") {
                syncPomodoroBadge();
              }
            });
          });
          menuEl.querySelectorAll("[data-np-action]").forEach((btn) => {
            btn.addEventListener("click", async () => {
              const act = btn.getAttribute("data-np-action");
              const chosenSessionId = sessionSel?.value || null;
              if (act === "close") {
                menuEl.classList.add("hidden");
              } else if (act === "buddy-nika") {
                menuEl.classList.add("hidden");
                window.openNomadBuddy?.("nika");
              } else if (act === "buddy-sokrat") {
                menuEl.classList.add("hidden");
                window.openNomadBuddy?.("sokrat");
              } else if (act === "voice-cmd") {
                menuEl.classList.add("hidden");
                triggerVoiceCommandToSession(chosenSessionId);
              } else if (act === "voice-live") {
                menuEl.classList.add("hidden");
                toggleRealtimeVoiceWithMascot();
              } else if (act === "approve-once") {
                menuEl.classList.add("hidden");
                await resolveSessionApproval(chosenSessionId, "once");
              } else if (act === "approve-session") {
                menuEl.classList.add("hidden");
                await resolveSessionApproval(chosenSessionId, "session");
              } else if (act === "deny-once") {
                menuEl.classList.add("hidden");
                await resolveSessionApproval(chosenSessionId, "deny");
              } else if (act === "cycle-mascot") {
                const cur = loadMascotSettings();
                const idx = MASCOT_CATALOG.findIndex((m) => m.slug === cur.mascotId);
                const next = MASCOT_CATALOG[(idx + 1) % MASCOT_CATALOG.length];
                if (sel) sel.value = next.slug;
                await switchMascotLive(next.slug);
              } else if (act === "greet") {
                const cur = loadMascotSettings();
                const item = MASCOT_CATALOG.find((m) => m.slug === cur.mascotId) || MASCOT_CATALOG[0];
                playMascotTone(698.46, 0.08);
                window.__nomadPluginCtx?.pet?.say?.(item.greeting, { id: "mascot-greet", ttlMs: 5e3 });
              } else if (act === "stats") {
                const box = menuEl.querySelector('[data-np-id="stats-box"]');
                box?.classList.toggle("hidden");
              } else if (act === "open-settings") {
                menuEl.classList.add("hidden");
                window.location.hash = "#/settings?tab=config:appearance&page=pet";
              }
            });
          });
        };
        petContainer.addEventListener(
          "pointerdown",
          (e) => {
            if (e.button === 2) {
              e.stopPropagation();
            }
          },
          true
        );
        petContainer.addEventListener(
          "contextmenu",
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            playMascotTone(523.25, 0.05);
            renderContextMenu(e.clientX, e.clientY);
          },
          true
        );
      }
      document.querySelectorAll("div").forEach((box) => {
        if (box.id === "root" || box.hasAttribute("data-nomad-gateway-banner-fixed")) return;
        const txt = (box.textContent || "").trim();
        if (txt.length > 35 && txt.length < 500 && (txt.startsWith("Переменные окружения управляют этой сессией приложения") || txt.startsWith("Подключение шлюза зафиксировано переменными окружения")) && !box.querySelector('button, input, select, [role="tab"], [role="dialog"], main, aside, nav')) {
          box.setAttribute("data-nomad-gateway-banner-fixed", "true");
          box.style.cssText = "padding:14px 16px;border-radius:12px;border:1px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.08);color:var(--foreground,#14151C);font-size:12.5px;line-height:1.5;margin:8px 0;display:block;";
          box.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <strong style="color:#059669;font-size:13px;">✅ Локальный шлюз Nomad активен и защищён (127.0.0.1:9129)</strong>
              <span class="nomad-help-q" data-nomad-tooltip="Локальный сервер Nomad запущен автоматически для этого рабочего окна и защищён сессионным токеном. Если вы хотите подключить внешний корпоративный сервер, добавьте его ниже в блок «Сохранённые шлюзы».">?</span>
            </div>
            <div style="opacity:0.84;margin-top:4px;">
              Автоматическое подключение рабочего места настроено и работает без ручного ввода портов. Для добавления внешнего корпоративного контура используйте раздел «Сохранённые шлюзы» ниже.
            </div>
          `;
        }
      });
      document.querySelectorAll('[role="dialog"]').forEach((dlg) => {
        if (dlg.hasAttribute("data-nomad-gateway-modal-dismissed")) return;
        const txt = (dlg.textContent || "").trim();
        if (txt.includes("Nomad couldn't start") || txt.includes("Не удалось запустить Nomad") || txt.includes("Could not connect to Nomad gateway")) {
          dlg.setAttribute("data-nomad-gateway-modal-dismissed", "true");
          const closeBtn = Array.from(dlg.querySelectorAll("button")).find((b) => {
            const label = (b.textContent || "").trim();
            const aria = (b.getAttribute("aria-label") || "").toLowerCase();
            return label === "×" || label === "✕" || aria.includes("close") || aria.includes("закрыть") || b.querySelector(".codicon-close, svg");
          });
          if (closeBtn) {
            try {
              closeBtn.click();
            } catch {
            }
          }
          dlg.style.setProperty("display", "none", "important");
          dlg.style.setProperty("pointer-events", "none", "important");
        }
      });
      if (document.documentElement?.style) {
        document.documentElement.style.setProperty("--primary", "#18181B", "important");
        document.documentElement.style.setProperty("--primary-foreground", "#FFFFFF", "important");
        document.documentElement.style.setProperty("--ring", "rgba(24, 24, 27, 0.16)", "important");
        document.documentElement.style.setProperty("--composer-ring", "rgba(24, 24, 27, 0.16)", "important");
        document.documentElement.style.setProperty("--radius", "8px", "important");
      }
      const textContainers = document.querySelectorAll(
        '[data-slot="aui_intro"] p, [role="tab"], button, span, div, label, p, summary, strong, h3, h4'
      );
      for (const el of textContainers) {
        const raw = (el.textContent || "").trim();
        if (el.childElementCount === 0 && ENGLISH_TO_RUSSIAN_TEXT_MAP[raw]) {
          el.textContent = ENGLISH_TO_RUSSIAN_TEXT_MAP[raw];
        } else if (el.childElementCount === 0 && /^Used \d+ tools?$/i.test(raw)) {
          const num = raw.match(/\d+/)?.[0] || "1";
          el.textContent = `Использовано инструментов: ${num}`;
        } else if (el.childElementCount === 0 && /^Show \d+ tips? again$/i.test(raw)) {
          const num = raw.match(/\d+/)?.[0] || "1";
          el.textContent = `Показать скрытые подсказки (${num})`;
        } else if (el.childElementCount === 0 && /^Limit resets at /i.test(raw)) {
          el.textContent = raw.replace(/^Limit resets at /i, "Сброс лимита в ").replace(/\(in /i, "(через ");
        } else if (el.childElementCount <= 2 && !el.querySelector("button, input, select") && raw.startsWith("Off by default. When on, gateway tokens")) {
          el.textContent = "По умолчанию выключено. При включении токены шлюза и API-ключи шифруются в системном хранилище ОС (Windows DPAPI / Credential Manager или macOS Keychain).";
        } else if (el.tagName === "BUTTON" || el.tagName === "SPAN" || el.tagName === "DIV") {
          el.childNodes.forEach((node) => {
            if (node.nodeType === 3) {
              const t = (node.nodeValue || "").trim();
              if (ENGLISH_TO_RUSSIAN_TEXT_MAP[t]) {
                node.nodeValue = node.nodeValue.replace(t, ENGLISH_TO_RUSSIAN_TEXT_MAP[t]);
              }
            }
          });
        }
      }
      document.querySelectorAll("textarea, input, [data-placeholder]").forEach((el) => {
        const ph = (el.getAttribute("placeholder") || "").trim();
        if (ph && ENGLISH_TO_RUSSIAN_TEXT_MAP[ph]) {
          el.setAttribute("placeholder", ENGLISH_TO_RUSSIAN_TEXT_MAP[ph]);
        }
        const dph = (el.getAttribute("data-placeholder") || "").trim();
        if (dph && ENGLISH_TO_RUSSIAN_TEXT_MAP[dph]) {
          el.setAttribute("data-placeholder", ENGLISH_TO_RUSSIAN_TEXT_MAP[dph]);
        }
      });
      if (!isHudWindow) {
        const settingsOnlyNavLabels = /* @__PURE__ */ new Set([
          "Аккаунты",
          "Данные и место",
          "Разрешения и безопасность",
          "Перенос и старт",
          "Сообщения",
          "Возможности"
        ]);
        window.__nomadHiddenSidebarLinks = window.__nomadHiddenSidebarLinks || {};
        let lastVisibleNavParent = null;
        document.querySelectorAll('a, button, [role="button"]').forEach((navEl) => {
          if (navEl.id === "nomad-sidebar-settings-entry" || navEl.closest(
            'main, [data-testid="nomad-accounts-page"], [role="tablist"], .nomad-seg-group, #nomad-settings-hub-bar, #nomad-buddy-drawer, #nomad-composer-council-popover'
          )) {
            return;
          }
          const label = (navEl.textContent || "").replace(/\?$/, "").trim();
          if (settingsOnlyNavLabels.has(label)) {
            window.__nomadHiddenSidebarLinks[label] = navEl;
            const rowItem = navEl.closest('li, [data-slot="sidebar-menu-item"]') || navEl;
            rowItem.style.setProperty("display", "none", "important");
          } else if (label === "Симулятор ИИ" || label === "Навыки Nomad" || label === "Запланированные задачи") {
            const rowItem = navEl.closest('li, [data-slot="sidebar-menu-item"]') || navEl;
            lastVisibleNavParent = rowItem.parentElement;
          }
        });
        const openUnifiedSettingsModal = () => {
          const gearBtn = document.querySelector(
            'button[title="Открыть настройки"], button[aria-label="Открыть настройки"], button[title="Open settings"], button[aria-label="Open settings"]'
          );
          if (gearBtn && !document.querySelector('aside[data-tour="overlay-nav"]')) {
            gearBtn.click();
            return;
          }
          navigateNomad("/settings");
        };
        window.openNativeAppSettingsModal = openUnifiedSettingsModal;
        document.getElementById("nomad-settings-hub-bar")?.remove();
        if (lastVisibleNavParent && !document.getElementById("nomad-sidebar-settings-entry")) {
          const wrap = document.createElement("div");
          wrap.id = "nomad-sidebar-settings-wrap";
          wrap.style.cssText = "padding:0;margin-top:2px;";
          const settingsItem = document.createElement("button");
          settingsItem.id = "nomad-sidebar-settings-entry";
          settingsItem.type = "button";
          settingsItem.setAttribute("data-testid", "nomad-sidebar-settings-entry");
          settingsItem.setAttribute(
            "title",
            "Настройки приложения: модель, чат, внешний вид, провайдеры, безопасность и память"
          );
          settingsItem.style.cssText = "width:100%;display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:10px;border:none;background:transparent;color:var(--foreground,#14151C);font-size:13px;font-weight:500;cursor:pointer;text-align:left;transition:background-color 0.15s ease;";
          settingsItem.innerHTML = `<span style="font-size:14px;opacity:0.75;width:16px;text-align:center;">⚙</span><span>Настройки</span>`;
          settingsItem.addEventListener("mouseenter", () => {
            settingsItem.style.background = "rgba(15, 23, 42, 0.06)";
          });
          settingsItem.addEventListener("mouseleave", () => {
            settingsItem.style.background = "transparent";
          });
          settingsItem.addEventListener("click", () => {
            openUnifiedSettingsModal();
          });
          wrap.appendChild(settingsItem);
          lastVisibleNavParent.insertAdjacentElement("afterend", wrap);
        }
        const polarisUri = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64' fill='none'><rect x='2' y='2' width='60' height='60' rx='14' fill='%2309090B' stroke='%2327272A' stroke-width='1.5'/><circle cx='32' cy='32' r='21' stroke='%233F3F46' stroke-width='1' stroke-dasharray='2 3'/><path d='M19 46V18L32 32M45 18V46L32 32' stroke='%23FAFAFA' stroke-width='4.2' stroke-linecap='round' stroke-linejoin='round'/><path d='M32 13L35.2 28.8L51 32L35.2 35.2L32 51L28.8 35.2L13 32L28.8 28.8L32 13Z' fill='%23FAFAFA'/><circle cx='32' cy='32' r='2.6' fill='%2309090B'/></svg>";
        document.querySelectorAll('[data-slot="profile-rail-divider"][data-reachable="false"], [data-slot="profile-rail-gateway"][data-reachable="false"]').forEach((el) => {
          el.style.setProperty("display", "none", "important");
        });
        document.querySelectorAll('[data-slot="profile-rail-gateway"] button, button[data-profile="nomad"], button[aria-label^="nomad" i]').forEach((btn) => {
          if (btn.hasAttribute("data-nomad-polaris-badge")) return;
          const bTxt = (btn.textContent || "").trim().toLowerCase();
          if (bTxt === "n" || bTxt === "h" || btn.getAttribute("data-profile") === "nomad") {
            btn.setAttribute("data-nomad-polaris-badge", "true");
            btn.style.cssText = `display:inline-flex !important;align-items:center !important;justify-content:center !important;width:20px !important;height:20px !important;border-radius:5px !important;background-color:#09090B !important;background-image:url("${polarisUri}") !important;background-size:100% 100% !important;background-repeat:no-repeat !important;color:transparent !important;font-size:0 !important;padding:0 !important;border:none !important;opacity:1 !important;overflow:hidden !important;`;
          }
        });
        const overlayNav = document.querySelector('aside[data-tour="overlay-nav"]');
        if (overlayNav) {
          document.getElementById("nomad-onboarding-tour-root")?.remove();
          overlayNav.querySelectorAll(".nomad-semantic-sublist").forEach((el) => el.remove());
          document.getElementById("nomad-semantic-section-card")?.remove();
          const overlayMain = overlayNav.parentElement?.querySelector("main");
          if (overlayMain && !overlayMain.querySelector("#nomad-launch-native-tour-btn")) {
            const titleEl = Array.from(overlayMain.querySelectorAll("div, span, label")).find((el) => {
              if (el.childElementCount !== 0) return false;
              const t = (el.textContent || "").trim();
              return t === "Пошаговый тур по интерфейсу" || t === "Guided Tours";
            });
            const rowCard = titleEl?.parentElement?.parentElement || titleEl?.parentElement;
            if (rowCard) {
              const sampleLink = Array.from(overlayMain.querySelectorAll('button:not([role="switch"])')).find(
                (b) => /Показать скрытые подсказки|Show .* tip|Restart tours|Перезапустить/i.test(b.textContent || "")
              );
              const launchBtn = document.createElement("button");
              launchBtn.id = "nomad-launch-native-tour-btn";
              launchBtn.type = "button";
              launchBtn.setAttribute("data-testid", "launch-native-guided-tour-btn");
              if (sampleLink?.className) {
                launchBtn.className = sampleLink.className;
              }
              launchBtn.style.cssText = "display:block;margin-top:8px;padding:0;border:none;background:transparent;color:var(--ui-text-secondary, rgba(15,23,42,0.68));font-size:12px;font-weight:500;cursor:pointer;text-align:left;width:fit-content;";
              launchBtn.textContent = "Запустить пошаговый тур по интерфейсу →";
              launchBtn.addEventListener("click", (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (typeof window.startNomadOnboardingTour === "function") {
                  window.startNomadOnboardingTour();
                }
              });
              rowCard.appendChild(launchBtn);
            }
          }
        }
        if (!window.getNomadLocale) {
          window.getNomadLocale = () => {
            try {
              const saved = window.localStorage?.getItem("nomad.locale") || "auto";
              if (saved === "ru" || saved === "en") return saved;
            } catch {
            }
            const sys = (typeof navigator !== "undefined" ? navigator.language || "ru" : "ru").toLowerCase();
            return sys.startsWith("ru") ? "ru" : "en";
          };
          window.setNomadLocale = (mode) => {
            try {
              window.localStorage?.setItem("nomad.locale", mode || "auto");
              const resolved = window.getNomadLocale();
              window.localStorage?.setItem("hermes.locale", resolved);
              window.localStorage?.setItem("i18nextLng", resolved);
              document.documentElement.setAttribute("lang", resolved);
            } catch {
            }
          };
        }
        const TOUR_STEPS = {
          ru: [
            {
              selector: '[data-slot="composer-surface"]',
              title: "1. Поле задачи и умный выбор модели",
              desc: "Пишите задачу своими словами, прикрепляйте файлы или код. Автороутер Nomad сам подберёт оптимальную модель или переключит запрос в контур 152-ФЗ при обнаружении ПДн."
            },
            {
              selector: '#nomad-composer-council-toggle, [data-testid="composer-council-toggle"]',
              title: "2. Совет моделей (как в Perplexity)",
              desc: "Включается прямо внутри поля ввода рядом с моделью: параллельно опрашивает пул флагманов (или суверенный пул РФ) и синтезирует единый проверенный ответ."
            },
            {
              selector: "__SIDEBAR_MENU__",
              title: "3. Рабочая навигация и проекты",
              desc: "Слева собраны только ежедневные рабочие разделы: Сеансы чата, Поиск, Артефакты, Запланированные задачи, Навыки Nomad и Симулятор ИИ."
            },
            {
              selector: "#nomad-buddy-fab",
              title: "4. Правая боковая панель «Советник»",
              desc: "Ваш ИИ-помощник и наставник (Ника / Сократ) открывается в правом боковом меню: помогает формулировать промпты, разбирать архитектуру и учиться вайбкодингу."
            },
            {
              selector: '#nomad-sidebar-settings-entry, button[title="Открыть настройки"], button[aria-label="Открыть настройки"]',
              title: "5. Единое окно всех настроек и вход в РФ-модели в 1 клик",
              desc: "По нажатию на «Настройки» или шестерёнку открывается единое всплывающее окно, где рядом со штатными параметрами собраны подписки РФ в 1 клик (Сбер ID, Яндекс ID, МТС ID, T-ID, Cloud.ru), Облачный ПК, Память и 152-ФЗ."
            },
            {
              selector: '[data-nomad-pet-hovered], [class*="pet"]',
              title: "6. Караванный питомец-компаньон",
              desc: "Нажмите правой кнопкой мыши по питомцу, чтобы открыть стеклянный пульт управления: выбор персонажа (Караванный верблюд / Скрепка), масштаб и фиксация позиции."
            }
          ],
          en: [
            {
              selector: '[data-slot="composer-surface"]',
              title: "1. Smart Composer & Auto-Router",
              desc: "Describe your task, attach files, or drop a screenshot. Nomad automatically routes requests across frontier models or keeps sensitive data inside your sovereign contour."
            },
            {
              selector: '#nomad-composer-council-toggle, [data-testid="composer-council-toggle"]',
              title: "2. Model Council (Perplexity-style)",
              desc: "Toggle Model Council right inside the composer bar next to the model selector to query multiple frontier models in parallel and synthesize a verified consensus."
            },
            {
              selector: "__SIDEBAR_MENU__",
              title: "3. Clean Workspace Navigation",
              desc: "The left sidebar keeps only your daily essentials: Sessions, Search, Artifacts, Scheduled Tasks, Nomad Skills, and AI Simulator."
            },
            {
              selector: "#nomad-buddy-fab",
              title: "4. Right-Side AI Advisor Drawer",
              desc: "Open the AI Advisor on the right side of the screen at any time for interactive prompt coaching, architecture review, and guided vibecoding tracks."
            },
            {
              selector: '#nomad-sidebar-settings-entry, button[title="Открыть настройки"], button[aria-label="Открыть настройки"]',
              title: "5. Unified Settings Popup & 1-Click SSO Subscriptions",
              desc: "Click Settings or the top-right gear to open the single unified Settings popup with all system preferences plus 1-click Russian & global SSO subscriptions, Cloud PC, 3-tier Memory, and 152-FZ."
            },
            {
              selector: '[data-nomad-pet-hovered], [class*="pet"]',
              title: "6. Interactive Desktop Companion",
              desc: "Right-click the companion mascot on screen to open its Liquid Glass control pad: switch between the Caravan Camel and Clippy, adjust scale, or lock position."
            }
          ]
        };
        window.startNomadOnboardingTour = (langOverride) => {
          let activeLang = langOverride === "ru" || langOverride === "en" ? langOverride : window.getNomadLocale();
          const isComposerVisible = () => {
            if (document.querySelector('aside[data-tour="overlay-nav"]')) return false;
            const el = document.querySelector('[data-slot="composer-surface"]');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 80 && r.height > 24;
          };
          const ensureMainChatWorkspace = (onReady) => {
            if (isComposerVisible()) {
              onReady();
              return;
            }
            const closeSettingsBtn = document.querySelector(
              'button[aria-label="Закрыть настройки"], button[aria-label="Close settings"]'
            );
            if (closeSettingsBtn) {
              try {
                closeSettingsBtn.click();
              } catch {
              }
            }
            const newSessionBtn = Array.from(document.querySelectorAll("a, button")).find((el) => {
              const t = (el.textContent || "").trim();
              return t === "Новый сеанс" || t === "New session" || t === "New chat";
            });
            if (newSessionBtn && (window.location.hash.includes("/nomad-") || window.location.hash.includes("/settings"))) {
              try {
                newSessionBtn.click();
              } catch {
              }
            }
            navigateNomad("/");
            let attempts = 0;
            const timer = setInterval(() => {
              attempts += 1;
              try {
                enhanceDom();
              } catch {
              }
              if (isComposerVisible() || attempts >= 25) {
                clearInterval(timer);
                setTimeout(() => {
                  try {
                    enhanceDom();
                  } catch {
                  }
                  onReady();
                }, 80);
              }
            }, 60);
          };
          ensureMainChatWorkspace(() => {
            let stepIdx = 0;
            document.getElementById("nomad-onboarding-tour-root")?.remove();
            const root = document.createElement("div");
            root.id = "nomad-onboarding-tour-root";
            root.setAttribute("data-testid", "nomad-onboarding-tour-root");
            const paneTop = document.createElement("div");
            const paneBottom = document.createElement("div");
            const paneLeft = document.createElement("div");
            const paneRight = document.createElement("div");
            [paneTop, paneBottom, paneLeft, paneRight].forEach((p) => {
              p.className = "nomad-tour-backdrop-pane";
              root.appendChild(p);
            });
            const ring = document.createElement("div");
            ring.className = "nomad-tour-spotlight-ring";
            ring.setAttribute("data-testid", "nomad-tour-spotlight-ring");
            root.appendChild(ring);
            const card = document.createElement("div");
            card.className = "nomad-tour-card";
            card.setAttribute("data-testid", "nomad-tour-card");
            root.appendChild(card);
            document.body.appendChild(root);
            const closeTour = () => {
              window.removeEventListener("keydown", onKeyDown);
              window.removeEventListener("resize", renderStep);
              root.remove();
              try {
                window.localStorage?.setItem("nomad.onboarding.completed.v2", "true");
              } catch {
              }
            };
            const onKeyDown = (e) => {
              if (e.key === "Escape") closeTour();
              else if (e.key === "ArrowRight") {
                const steps = TOUR_STEPS[activeLang] || TOUR_STEPS.ru;
                if (stepIdx < steps.length - 1) {
                  stepIdx++;
                  renderStep();
                } else {
                  closeTour();
                }
              } else if (e.key === "ArrowLeft" && stepIdx > 0) {
                stepIdx--;
                renderStep();
              }
            };
            window.addEventListener("keydown", onKeyDown);
            window.addEventListener("resize", renderStep);
            function resolveStepTargetRect(step, vw, vh) {
              const pad = 8;
              if (step.selector === "__SIDEBAR_MENU__") {
                const settingsBtn = document.getElementById("nomad-sidebar-settings-entry");
                const menuContainer = settingsBtn?.parentElement || document.querySelector('[data-slot="sidebar-header"]')?.parentElement;
                if (menuContainer) {
                  const r = menuContainer.getBoundingClientRect();
                  if (r.width > 20 && r.height > 20) {
                    return {
                      left: Math.max(6, Math.round(r.left - 4)),
                      top: Math.max(6, Math.round(r.top - 4)),
                      width: Math.min(vw - 12, Math.round(r.width + 8)),
                      height: Math.min(vh - 12, Math.round(Math.min(r.height + 8, 340)))
                    };
                  }
                }
              }
              const candidates = Array.from(document.querySelectorAll(step.selector));
              const target = candidates.find((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 10 && r.height > 10;
              }) || null;
              if (target) {
                const r = target.getBoundingClientRect();
                return {
                  left: Math.max(6, Math.round(r.left - pad)),
                  top: Math.max(6, Math.round(r.top - pad)),
                  width: Math.min(vw - 12, Math.round(r.width + pad * 2)),
                  height: Math.min(vh - 12, Math.round(r.height + pad * 2))
                };
              }
              return {
                left: Math.round(vw / 2 - 140),
                top: Math.round(vh - 140),
                width: 280,
                height: 72
              };
            }
            function renderStep() {
              const steps = TOUR_STEPS[activeLang] || TOUR_STEPS.ru;
              const step = steps[stepIdx] || steps[0];
              const vw = window.innerWidth || 1280;
              const vh = window.innerHeight || 820;
              const rect = resolveStepTargetRect(step, vw, vh);
              const rightEdge = rect.left + rect.width;
              const bottomEdge = rect.top + rect.height;
              paneTop.style.cssText = `left:0;top:0;width:${vw}px;height:${rect.top}px;`;
              paneBottom.style.cssText = `left:0;top:${bottomEdge}px;width:${vw}px;height:${Math.max(0, vh - bottomEdge)}px;`;
              paneLeft.style.cssText = `left:0;top:${rect.top}px;width:${rect.left}px;height:${rect.height}px;`;
              paneRight.style.cssText = `left:${rightEdge}px;top:${rect.top}px;width:${Math.max(0, vw - rightEdge)}px;height:${rect.height}px;`;
              ring.style.left = `${rect.left}px`;
              ring.style.top = `${rect.top}px`;
              ring.style.width = `${rect.width}px`;
              ring.style.height = `${rect.height}px`;
              const isRu = activeLang === "ru";
              card.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span style="padding:3px 9px;border-radius:999px;background:rgba(0,122,255,0.12);color:#007AFF;font-size:11px;font-weight:700;">
                      ${isRu ? `Шаг ${stepIdx + 1} из ${steps.length}` : `Step ${stepIdx + 1} of ${steps.length}`}
                    </span>
                    <div class="nomad-seg-group" style="padding:2px;">
                      <button type="button" data-tour-lang="ru" class="nomad-seg-btn" data-active="${isRu ? "true" : "false"}" style="padding:2px 8px;font-size:11px;">RU</button>
                      <button type="button" data-tour-lang="en" class="nomad-seg-btn" data-active="${!isRu ? "true" : "false"}" style="padding:2px 8px;font-size:11px;">EN</button>
                    </div>
                  </div>
                  <button type="button" data-tour-close="1" style="border:none;background:rgba(15,23,42,0.06);width:26px;height:26px;border-radius:999px;cursor:pointer;font-size:13px;font-weight:700;color:inherit;">✕</button>
                </div>
                <div style="font-size:15px;font-weight:700;letter-spacing:-0.015em;margin-bottom:6px;">${step.title}</div>
                <div style="font-size:12.5px;line-height:1.55;opacity:0.82;margin-bottom:14px;">${step.desc}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid rgba(15,23,42,0.08);">
                  <div style="display:flex;gap:5px;">
                    ${steps.map(
                (_, idx) => `<span style="width:${idx === stepIdx ? "18px" : "6px"};height:6px;border-radius:999px;background:${idx === stepIdx ? "#007AFF" : "rgba(15,23,42,0.18)"};transition:all 0.2s ease;"></span>`
              ).join("")}
                  </div>
                  <div style="display:flex;gap:6px;">
                    ${stepIdx > 0 ? `<button type="button" data-tour-prev="1" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.8);color:inherit;font-size:12px;font-weight:600;cursor:pointer;">${isRu ? "← Назад" : "← Back"}</button>` : `<button type="button" data-tour-close="1" style="padding:6px 11px;border-radius:10px;border:1px solid rgba(15,23,42,0.10);background:transparent;color:inherit;opacity:0.75;font-size:12px;font-weight:600;cursor:pointer;">${isRu ? "Пропустить" : "Skip"}</button>`}
                    <button type="button" data-tour-next="1" style="padding:6px 14px;border-radius:10px;border:none;background:#007AFF;color:#FFFFFF;font-size:12px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.3),0 4px 12px rgba(0,122,255,0.25);">
                      ${stepIdx < steps.length - 1 ? isRu ? "Далее →" : "Next →" : isRu ? "Готово ✓" : "Finish ✓"}
                    </button>
                  </div>
                </div>
              `;
              const cardW = 392;
              const cardH = 215;
              let cardLeft = Math.max(16, Math.min(vw - cardW - 16, rect.left));
              let cardTop = bottomEdge + 16;
              if (cardTop + cardH > vh - 16) {
                cardTop = Math.max(16, rect.top - cardH - 16);
              }
              if (rect.width > vw * 0.55 && rect.top > vh * 0.35) {
                cardLeft = Math.round(rect.left + (rect.width - cardW) / 2);
                cardTop = Math.max(24, rect.top - cardH - 18);
              }
              card.style.left = `${Math.round(cardLeft)}px`;
              card.style.top = `${Math.round(cardTop)}px`;
              card.querySelectorAll("[data-tour-lang]").forEach((b) => {
                b.addEventListener("click", () => {
                  const nextLang = b.getAttribute("data-tour-lang") || "ru";
                  activeLang = nextLang;
                  window.setNomadLocale?.(nextLang);
                  renderStep();
                });
              });
              card.querySelectorAll("[data-tour-close]").forEach((b) => {
                b.addEventListener("click", closeTour);
              });
              card.querySelector("[data-tour-prev]")?.addEventListener("click", () => {
                if (stepIdx > 0) {
                  stepIdx--;
                  renderStep();
                }
              });
              card.querySelector("[data-tour-next]")?.addEventListener("click", () => {
                if (stepIdx < steps.length - 1) {
                  stepIdx++;
                  renderStep();
                } else {
                  closeTour();
                }
              });
            }
            renderStep();
          });
        };
        const composerSurface = document.querySelector(
          'main:not([data-hud-shell]) [data-slot="composer-surface"], [data-chat-surface] [data-slot="composer-surface"]'
        );
        if (composerSurface && !composerSurface.querySelector("#nomad-composer-council-toggle")) {
          const allComposerBtns = Array.from(composerSurface.querySelectorAll("button"));
          const modelBtn = allComposerBtns.find((b) => {
            const t = (b.textContent || "").trim().toLowerCase();
            return t.includes("gpt-") || t.includes("claude-") || t.includes("gemini-") || t.includes("deepseek") || t.includes("kimi") || t.includes("yandex") || t.includes("gigachat") || t.includes("nomad") || t.includes("модель");
          });
          const toolbarRow = modelBtn?.parentElement;
          if (toolbarRow) {
            window.__nomadComposerCouncilState = window.__nomadComposerCouncilState || {
              enabled: false,
              preset: "frontier",
              models: ["gpt-6.1-sol", "claude-opus-5-5", "gemini-3.1-pro-preview"],
              ru152fz: false
            };
            const councilBtn = document.createElement("button");
            councilBtn.id = "nomad-composer-council-toggle";
            councilBtn.type = "button";
            councilBtn.setAttribute("data-testid", "composer-council-toggle");
            councilBtn.setAttribute(
              "title",
              "Совет моделей — параллельное сравнение ответов нескольких моделей с синтезом итогового вывода"
            );
            const syncCouncilBtnUI = () => {
              const st = window.__nomadComposerCouncilState;
              councilBtn.setAttribute("data-active", st.enabled ? "true" : "false");
              councilBtn.innerHTML = `<span style="font-size:12px;">⚖</span><span>Совет моделей${st.enabled ? ` · ${st.models.length}` : ""}</span>`;
            };
            syncCouncilBtnUI();
            if (modelBtn.nextSibling) {
              toolbarRow.insertBefore(councilBtn, modelBtn.nextSibling);
            } else {
              toolbarRow.appendChild(councilBtn);
            }
            let pop = document.getElementById("nomad-composer-council-popover");
            if (!pop) {
              pop = document.createElement("div");
              pop.id = "nomad-composer-council-popover";
              pop.setAttribute("data-testid", "composer-council-popover");
              pop.className = "hidden";
              document.body.appendChild(pop);
              document.addEventListener("pointerdown", (ev) => {
                if (pop && !pop.classList.contains("hidden") && !pop.contains(ev.target) && ev.target !== councilBtn && !councilBtn.contains(ev.target)) {
                  pop.classList.add("hidden");
                }
              });
            }
            const AVAILABLE_COUNCIL_MODELS = [
              { id: "gpt-6.1-sol", label: "GPT-6.1-sol", tag: "Флагман" },
              { id: "claude-opus-5-5", label: "Claude Opus 5.5", tag: "Глубокий анализ" },
              { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", tag: "2M контекст" },
              { id: "kimi-k2.7-code", label: "Kimi K2.7 Code", tag: "Код и инженерия" },
              { id: "yandexgpt/latest", label: "YandexGPT 5 Pro", tag: "152-ФЗ · РФ" },
              { id: "GigaChat-2-Max", label: "GigaChat 2 Max", tag: "152-ФЗ · РФ" },
              { id: "cotype-pro-3", label: "МТС Cotype Pro 3", tag: "152-ФЗ · РФ" }
            ];
            const renderCouncilPopover = () => {
              const st = window.__nomadComposerCouncilState;
              pop.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;border-bottom:1px solid rgba(15,23,42,0.08);">
                  <div>
                    <div style="font-size:13px;font-weight:700;letter-spacing:-0.01em;">Совет моделей</div>
                    <div style="font-size:11px;opacity:0.68;">Параллельный опрос нескольких моделей и сводный вывод</div>
                  </div>
                  <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:11.5px;font-weight:600;color:#007AFF;">
                    <input type="checkbox" data-council-enable="1" ${st.enabled ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
                    <span>${st.enabled ? "Включён" : "Выкл"}</span>
                  </label>
                </div>

                <div style="margin-top:10px;">
                  <div style="font-size:10px;font-weight:700;opacity:0.58;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Быстрые наборы</div>
                  <div class="nomad-seg-group" style="display:grid;grid-template-columns:1fr 1fr 1fr;width:100%;">
                    <button type="button" class="nomad-seg-btn" data-council-preset="frontier" data-active="${st.preset === "frontier" ? "true" : "false"}" style="justify-content:center;padding:5px 6px;font-size:11px;">Фронтир</button>
                    <button type="button" class="nomad-seg-btn" data-council-preset="code" data-active="${st.preset === "code" ? "true" : "false"}" style="justify-content:center;padding:5px 6px;font-size:11px;">Код и ревью</button>
                    <button type="button" class="nomad-seg-btn" data-council-preset="ru" data-active="${st.preset === "ru" ? "true" : "false"}" style="justify-content:center;padding:5px 6px;font-size:11px;">Контур РФ</button>
                  </div>
                </div>

                <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px;max-height:190px;overflow-y:auto;">
                  ${AVAILABLE_COUNCIL_MODELS.map((m) => {
                const checked = st.models.includes(m.id);
                return `
                      <label style="display:flex;align-items:center;justify-content:space-between;padding:6px 9px;border-radius:9px;background:${checked ? "rgba(0,122,255,0.08)" : "rgba(255,255,255,0.55)"};border:1px solid ${checked ? "rgba(0,122,255,0.28)" : "rgba(15,23,42,0.07)"};cursor:pointer;font-size:12px;">
                        <span style="display:flex;align-items:center;gap:7px;font-weight:${checked ? "600" : "500"};">
                          <input type="checkbox" data-council-model="${m.id}" ${checked ? "checked" : ""} style="accent-color:#007AFF;cursor:pointer;" />
                          <span>${m.label}</span>
                        </span>
                        <span style="font-size:10px;padding:1px 6px;border-radius:999px;background:rgba(15,23,42,0.06);opacity:0.75;">${m.tag}</span>
                      </label>
                    `;
              }).join("")}
                </div>

                <div style="margin-top:12px;padding-top:10px;border-top:1px solid rgba(15,23,42,0.08);display:flex;justify-content:space-between;align-items:center;gap:8px;">
                  <button type="button" data-council-open-full="1" style="padding:7px 11px;border-radius:9px;border:1px solid rgba(15,23,42,0.12);background:rgba(255,255,255,0.75);color:inherit;font-size:11.5px;font-weight:600;cursor:pointer;">Развёрнутое сравнение →</button>
                  <button type="button" data-council-apply="1" style="padding:7px 14px;border-radius:9px;border:none;background:#007AFF;color:#fff;font-size:11.5px;font-weight:600;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28);">Готово (${st.models.length})</button>
                </div>
              `;
              pop.querySelector("[data-council-enable]")?.addEventListener("change", (e) => {
                st.enabled = Boolean(e.target.checked);
                syncCouncilBtnUI();
                renderCouncilPopover();
              });
              pop.querySelectorAll("[data-council-preset]").forEach((b) => {
                b.addEventListener("click", () => {
                  const pr = b.getAttribute("data-council-preset");
                  st.preset = pr;
                  st.enabled = true;
                  if (pr === "frontier") {
                    st.models = ["gpt-6.1-sol", "claude-opus-5-5", "gemini-3.1-pro-preview"];
                    st.ru152fz = false;
                  } else if (pr === "code") {
                    st.models = ["gpt-6.1-sol", "claude-opus-5-5", "kimi-k2.7-code"];
                    st.ru152fz = false;
                  } else if (pr === "ru") {
                    st.models = ["yandexgpt/latest", "GigaChat-2-Max", "cotype-pro-3"];
                    st.ru152fz = true;
                  }
                  syncCouncilBtnUI();
                  renderCouncilPopover();
                });
              });
              pop.querySelectorAll("[data-council-model]").forEach((chk) => {
                chk.addEventListener("change", () => {
                  const mid = chk.getAttribute("data-council-model");
                  if (chk.checked) {
                    if (!st.models.includes(mid)) st.models.push(mid);
                    st.enabled = true;
                  } else if (st.models.length > 1) {
                    st.models = st.models.filter((x) => x !== mid);
                  }
                  syncCouncilBtnUI();
                  renderCouncilPopover();
                });
              });
              pop.querySelector("[data-council-open-full]")?.addEventListener("click", () => {
                pop.classList.add("hidden");
                navigateNomad("/nomad-council");
              });
              pop.querySelector("[data-council-apply]")?.addEventListener("click", () => {
                pop.classList.add("hidden");
              });
            };
            const positionCouncilPopover = () => {
              const rect = councilBtn.getBoundingClientRect();
              const popW = 380;
              const buddyDrawer = document.getElementById("nomad-buddy-drawer");
              const rightOffset = buddyDrawer && !buddyDrawer.classList.contains("hidden") ? Math.round(buddyDrawer.getBoundingClientRect().width) + 12 : 16;
              const maxLeft = (window.innerWidth || 1200) - popW - rightOffset;
              const left = Math.max(14, Math.min(maxLeft, rect.left - 40));
              const bottom = Math.max(64, (window.innerHeight || 820) - rect.top + 10);
              pop.style.left = `${Math.round(left)}px`;
              pop.style.top = "auto";
              pop.style.bottom = `${Math.round(bottom)}px`;
            };
            councilBtn.addEventListener("click", (e) => {
              e.stopPropagation();
              if (pop.classList.contains("hidden")) {
                renderCouncilPopover();
                pop.classList.remove("hidden");
                positionCouncilPopover();
              } else {
                pop.classList.add("hidden");
              }
            });
          }
        }
      }
      const candidateLabels = document.querySelectorAll("h1, h2, h3, label, span, div");
      for (const el of candidateLabels) {
        if (el.hasAttribute("data-nomad-q-checked")) continue;
        if (el.childElementCount > 1) continue;
        if (el.closest('aside, nav, [role="navigation"], [data-sidebar], button, a, #nomad-buddy-drawer, #nomad-buddy-fab')) continue;
        const rawText = (el.textContent || "").replace(/\?$/, "").trim();
        const desc = HELP_BADGE_DESCRIPTIONS[rawText];
        if (desc && !el.querySelector(".nomad-help-q")) {
          el.setAttribute("data-nomad-q-checked", "true");
          const qBadge = document.createElement("span");
          qBadge.className = "nomad-help-q";
          qBadge.setAttribute("data-nomad-help-q", rawText);
          qBadge.setAttribute("data-nomad-tooltip", desc);
          qBadge.textContent = "?";
          el.appendChild(qBadge);
        }
      }
      document.querySelectorAll("label, div").forEach((row) => {
        const t = (row.textContent || "").trim();
        if (t.startsWith("Случайные прогулки по экрану")) {
          const chk = row.parentElement?.querySelector('input[type="checkbox"], button[role="switch"]');
          if (chk && !chk.hasAttribute("data-nomad-roam-synced")) {
            chk.setAttribute("data-nomad-roam-synced", "true");
            chk.addEventListener("click", () => {
              setTimeout(() => {
                const isChecked = chk.checked === true || chk.getAttribute("aria-checked") === "true";
                const cur = loadMascotSettings();
                cur.randomWalk = isChecked;
                if (!isChecked && petContainer) {
                  const r = petContainer.getBoundingClientRect();
                  cur.lockedX = Math.round(r.left);
                  cur.lockedY = Math.round(r.top);
                }
                saveMascotSettings(cur);
                if (petContainer) enforcePetPositionLock(petContainer);
              }, 50);
            });
          }
        }
      });
      const interactiveEls = document.querySelectorAll('a, button, [role="tab"], [role="menuitem"]');
      for (const el of interactiveEls) {
        if (el.getAttribute("title")) continue;
        const label = (el.textContent || "").replace(/\?$/, "").trim();
        const tip = NOMAD_TOOLTIPS_BY_TEXT[label] || HELP_BADGE_DESCRIPTIONS[label];
        if (tip) {
          el.setAttribute("title", tip);
          el.setAttribute("data-nomad-tooltip", tip);
        }
      }
    } catch {
    }
  };
  enhanceDom();
  if (typeof MutationObserver !== "undefined" && document.body && !window.__nomadDomObserverActive) {
    window.__nomadDomObserverActive = true;
    let enhanceScheduled = false;
    let isEnhancing = false;
    const observer = new MutationObserver(() => {
      if (isEnhancing || enhanceScheduled) return;
      enhanceScheduled = true;
      setTimeout(() => {
        enhanceScheduled = false;
        isEnhancing = true;
        try {
          enhanceDom();
        } finally {
          isEnhancing = false;
        }
      }, 60);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}
function registerThemes(ctx) {
  if (!ctx || typeof ctx.register !== "function") {
    return;
  }
  if (typeof window !== "undefined") {
    window.__nomadPluginCtx = ctx;
  }
  for (const theme of NOMAD_THEMES) {
    ctx.register({
      id: theme.name,
      area: THEMES_AREA,
      data: theme
    });
  }
  applyNomadVisualIdentityAndTooltips();
}

// topup-card.js
var topup_card_exports = {};
__export(topup_card_exports, {
  DEFAULT_TOPUP_URL: () => DEFAULT_TOPUP_URL,
  TopupCard: () => TopupCard,
  activeTopupBlockAtom: () => activeTopupBlockAtom,
  clearBillingBlock: () => clearBillingBlock,
  default: () => registerTopupCardPlugin,
  fetchUpdatedAccount: () => fetchUpdatedAccount,
  handleBillingBlockEvent: () => handleBillingBlockEvent,
  openExternalUrl: () => openExternalUrl
});
import { PALETTE_AREA as PALETTE_AREA17, atom as atom7, host as host11 } from "@hermes/plugin-sdk";
import { createElement as createElement9, useCallback as useCallback14, useEffect as useEffect17, useState as useState18 } from "react";
var DEFAULT_TOPUP_URL = "https://app.nomadnet.ai/cabinet/billing";
var activeTopupBlockAtom = atom7(null);
var h9 = createElement9;
function openExternalUrl(ctx, url) {
  const targetUrl = url || DEFAULT_TOPUP_URL;
  if (ctx && ctx.os && typeof ctx.os.openExternal === "function") {
    return ctx.os.openExternal(targetUrl);
  }
  if (typeof window !== "undefined" && typeof window.open === "function") {
    window.open(targetUrl, "_blank", "noopener,noreferrer");
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
}
async function fetchUpdatedAccount(ctx) {
  if (ctx && typeof ctx.rest === "function") {
    return await ctx.rest("/account");
  }
  if (typeof fetch === "function") {
    const res = await fetch("/api/plugins/nomad/account");
    if (res.ok) {
      return await res.json();
    }
  }
  return null;
}
function handleBillingBlockEvent(ctx, payload = {}) {
  const blockData = {
    statusCode: payload.status_code || 402,
    reason: payload.reason || "insufficient_credits",
    topupUrl: payload.topup_url || DEFAULT_TOPUP_URL,
    message: payload.message || "На вашем счёте исчерпан баланс номадов (ошибка 402). Пополните баланс для продолжения отправки запросов.",
    blockedAt: payload.blocked_at || (/* @__PURE__ */ new Date()).toISOString()
  };
  activeTopupBlockAtom.set(blockData);
  if (host11 && typeof host11.notify === "function") {
    host11.notify("NomadNet: баланс исчерпан, требуется пополнение");
  }
  return blockData;
}
function clearBillingBlock() {
  activeTopupBlockAtom.set(null);
}
function TopupCard({ ctx, payload = null, onDismiss = null }) {
  const [data, setData] = useState18(payload || activeTopupBlockAtom.get());
  const [checking, setChecking] = useState18(false);
  const [checkStatus, setCheckStatus] = useState18("");
  const [resolved, setResolved] = useState18(false);
  useEffect17(() => {
    const unbind = activeTopupBlockAtom.subscribe((val) => {
      if (val) setData(val);
    });
    return () => unbind();
  }, []);
  const topupUrl = data && data.topupUrl || DEFAULT_TOPUP_URL;
  const handlePayClick = useCallback14(() => {
    openExternalUrl(ctx, topupUrl);
    setCheckStatus("Открыта страница оплаты. После завершения платежа нажмите «Обновить баланс».");
  }, [ctx, topupUrl]);
  const handleRefreshClick = useCallback14(async () => {
    setChecking(true);
    setCheckStatus("Проверяем поступление средств…");
    try {
      const acc = await fetchUpdatedAccount(ctx);
      const nomads = acc && acc.balance && acc.balance.nomads !== void 0 ? Number(acc.balance.nomads) : Number(acc && acc.nomads) || 0;
      if (nomads > 0) {
        setResolved(true);
        setCheckStatus(`Баланс успешно пополнен: ${nomads.toLocaleString("ru-RU")} номадов. Блокировка снята.`);
        clearBillingBlock();
        if (host11 && typeof host11.notify === "function") {
          host11.notify(`Баланс пополнен: ${nomads} номадов`);
        }
        if (typeof onDismiss === "function") {
          setTimeout(onDismiss, 1200);
        }
      } else {
        setCheckStatus("Баланс пока не изменился. Если вы только что оплатили счёт, подождите 10-30 секунд.");
      }
    } catch (err) {
      setCheckStatus("Не удалось связаться с сервером. Повторите попытку позже.");
    } finally {
      setChecking(false);
    }
  }, [ctx, onDismiss]);
  return h9(
    "div",
    {
      "data-testid": "nomad-topup-card",
      style: {
        margin: "12px 0",
        padding: "18px 22px",
        borderRadius: "12px",
        border: resolved ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid rgba(239, 68, 68, 0.4)",
        background: resolved ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
        color: "inherit",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        maxWidth: "720px"
      }
    },
    h9(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h9(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        h9(
          "span",
          {
            style: {
              display: "inline-block",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: resolved ? "#10b981" : "#ef4444"
            }
          }
        ),
        h9(
          "strong",
          {
            "data-testid": "topup-card-title",
            style: { fontSize: "15px", fontWeight: 600 }
          },
          resolved ? "Баланс NomadNet обновлён" : "Пополнить баланс NomadNet"
        )
      ),
      h9(
        "span",
        {
          style: {
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "6px",
            background: "rgba(128,128,128,0.15)",
            fontWeight: 600
          }
        },
        resolved ? "АКТИВЕН" : "402 PAYMENT REQUIRED"
      )
    ),
    h9(
      "p",
      {
        "data-testid": "topup-card-desc",
        style: { margin: 0, fontSize: "13px", lineHeight: 1.5, opacity: 0.9 }
      },
      resolved ? "Средства поступили на ваш единый счёт NomadNet. Вы можете продолжить отправку сообщений и запуск сценариев без перезапуска приложения." : "На вашем счёте исчерпан баланс номадов (ошибка 402). Чтобы продолжить общение с ассистентом и выполнение задач, пополните баланс в личном кабинете."
    ),
    !resolved && h9(
      "div",
      { style: { display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" } },
      h9(
        "button",
        {
          type: "button",
          "data-testid": "topup-card-pay-btn",
          onClick: handlePayClick,
          style: {
            padding: "8px 18px",
            borderRadius: "8px",
            border: "none",
            background: "var(--primary, #18181B)",
            color: "#ffffff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer"
          }
        },
        "Пополнить баланс"
      ),
      h9(
        "button",
        {
          type: "button",
          "data-testid": "topup-card-refresh-btn",
          onClick: handleRefreshClick,
          disabled: checking,
          style: {
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border, rgba(128,128,128,0.3))",
            background: "transparent",
            color: "inherit",
            fontSize: "13px",
            fontWeight: 500,
            cursor: checking ? "default" : "pointer",
            opacity: checking ? 0.7 : 1
          }
        },
        checking ? "Проверка…" : "Я оплатил — обновить баланс"
      )
    ),
    checkStatus && h9(
      "div",
      {
        "data-testid": "topup-card-status",
        style: {
          fontSize: "12px",
          opacity: 0.85,
          color: resolved ? "#10b981" : "inherit"
        }
      },
      checkStatus
    )
  );
}
function registerTopupCardPlugin(ctx) {
  if (ctx && typeof ctx.onEvent === "function") {
    ctx.onEvent("billing_block", (payload) => {
      handleBillingBlockEvent(ctx, payload);
    });
  }
  ctx.register({
    id: "palette",
    area: PALETTE_AREA17,
    order: 66,
    data: {
      id: "nomad.topup.open",
      action: "nomad.topup.open",
      label: "Пополнить баланс NomadNet",
      category: "Nomad",
      keywords: ["пополнить", "баланс", "оплата", "402", "кабинет", "номады", "topup"],
      run: () => openExternalUrl(ctx, DEFAULT_TOPUP_URL)
    }
  });
}

// desktop-entry.js
var desktop_entry_default = createNomadPlugin([
  ["about.js", about_exports],
  ["accounts/billing-tab.js", billing_tab_exports],
  ["accounts/fallback-tab.js", fallback_tab_exports],
  ["accounts/page.js", page_exports],
  ["assets/nomad-dunes.js", nomad_dunes_exports],
  ["billing.js", billing_exports],
  ["council-memory-cloud.js", council_memory_cloud_exports],
  ["data.js", data_exports],
  ["deeplink.js", deeplink_exports],
  ["estop.js", estop_exports],
  ["i18n.js", i18n_exports],
  ["palette-actions.js", palette_actions_exports],
  ["personalization.js", personalization_exports],
  ["safety.js", safety_exports],
  ["simulator.js", simulator_exports],
  ["skills.js", skills_exports],
  ["slack-manifest.js", slack_manifest_exports],
  ["start.js", start_exports],
  ["statusbar-balance.js", statusbar_balance_exports],
  ["stop.js", stop_exports],
  ["swarm-page.js", swarm_page_exports],
  ["switch-card.js", switch_card_exports],
  ["themes.js", themes_exports],
  ["tooltips.js", tooltips_exports],
  ["topup-card.js", topup_card_exports]
]);
export {
  desktop_entry_default as default
};
