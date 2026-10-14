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
function openNomadAccountsTab(tab = "accounts") {
  const nextTab = tab === "billing" ? "billing" : tab === "fallback" ? "fallback" : "accounts";
  activeAccountsTabAtom.set(nextTab);
  if (host2 && typeof host2.navigate === "function") {
    host2.navigate("/nomad-accounts");
  }
}
var RE_CC = new RegExp("\\x63laude\\s*\\x63ode", "gi");
var RE_HA = new RegExp("\\x68ermes\\s*agent", "gi");
var RE_H = new RegExp("\\x68ermes", "gi");
var RE_NR = new RegExp("\\x6eous\\s*research", "gi");
var RE_N = new RegExp("\\b\\x6eous\\b", "gi");
function sanitizeWhiteLabelText(value) {
  if (typeof value !== "string") return "";
  return value.replace(RE_CC, "Anthropic CLI").replace(RE_HA, "Nomad").replace(RE_H, "nomad").replace(RE_NR, "NomadNet").replace(RE_N, "NomadNet");
}
async function callNomadApi(ctx, path, options = {}) {
  const normalizedPath = path.startsWith("/api/plugins/nomad") ? path.slice("/api/plugins/nomad".length) || "/" : path.startsWith("/") ? path : `/${path}`;
  if (ctx && typeof ctx.rest === "function") {
    return await ctx.rest(normalizedPath, options);
  }
  if (typeof fetch === "function") {
    const method = options.method || "GET";
    const headers = { ...options.headers || {} };
    let body = options.body;
    if (body !== void 0 && typeof body !== "string") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    const response = await fetch(`/api/plugins/nomad${normalizedPath}`, {
      method,
      headers,
      body
    });
    if (!response.ok) {
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
var DEFAULT_CABINET_URL = "https://nomadnet.ru/cabinet/billing";
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
                      background: "var(--primary, #2563eb)",
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
                            background: "var(--primary, #2563eb)",
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
                            color: "#3b82f6"
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
                      background: "var(--primary, #2563eb)",
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
                  border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
                  background: active ? "#eff6ff" : "#f8fafc",
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
                      border: "1px solid #1d4ed8",
                      background: restricted ? "#94a3b8" : "#2563eb",
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
import { useEffect as useEffect4, useState as useState5, useCallback as useCallback3, useMemo as useMemo2 } from "react";
import {
  ROUTES_AREA as ROUTES_AREA4,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA2,
  STATUSBAR_AREAS,
  PALETTE_AREA as PALETTE_AREA3,
  KEYBINDS_AREA,
  atom as atom2,
  useValue,
  host as host3
} from "@hermes/plugin-sdk";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
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
  }
];
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
  useEffect4(() => {
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
  const labelText = formatAccountsStatusbarLabel(summary);
  return /* @__PURE__ */ jsxs5(
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
        /* @__PURE__ */ jsx5(
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
        /* @__PURE__ */ jsx5("span", { children: labelText })
      ]
    }
  );
}
function AccountsPage({ ctx }) {
  const activeTab = useValue(activeAccountsTabAtom);
  const modalMode = useValue(accountsModalAtom);
  const [accounts, setAccounts] = useState5([]);
  const [switchFeed, setSwitchFeed] = useState5([]);
  const [loading, setLoading] = useState5(true);
  const [error, setError] = useState5("");
  const [actionNotice, setActionNotice] = useState5("");
  const [providerFilter, setProviderFilter] = useState5("all");
  const [draggedId, setDraggedId] = useState5(null);
  const [busyAccountId, setBusyAccountId] = useState5(null);
  const [keyProvider, setKeyProvider] = useState5("openai-codex");
  const [keyLabel, setKeyLabel] = useState5("");
  const [keyValue, setKeyValue] = useState5("");
  const [keyPriority, setKeyPriority] = useState5(1);
  const [keyBaseUrl, setKeyBaseUrl] = useState5("");
  const [keySubmitting, setKeySubmitting] = useState5(false);
  const [keyFormError, setKeyFormError] = useState5("");
  const [oauthProvider, setOauthProvider] = useState5("openai-codex");
  const [oauthLabel, setOauthLabel] = useState5("");
  const [oauthSession, setOauthSession] = useState5(null);
  const [oauthLoading, setOauthLoading] = useState5(false);
  const [oauthError, setOauthError] = useState5("");
  const syncAccounts = useCallback3((list) => {
    setAccounts(list);
    accountsSummaryAtom.set(computeSummary(list));
  }, []);
  const loadAccounts = useCallback3(async () => {
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
  useEffect4(() => {
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
  const handleStartOAuth = async (event) => {
    if (event && typeof event.preventDefault === "function") {
      event.preventDefault();
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
  const summary = useMemo2(() => computeSummary(accounts), [accounts]);
  const filteredAccounts = useMemo2(() => {
    if (providerFilter === "all") return accounts;
    return accounts.filter((item) => item.provider === providerFilter);
  }, [accounts, providerFilter]);
  const uniqueProviders = useMemo2(() => {
    const set = new Set(accounts.map((a) => a.provider));
    return Array.from(set);
  }, [accounts]);
  return /* @__PURE__ */ jsxs5(
    "div",
    {
      style: {
        padding: "24px 28px",
        maxWidth: "1160px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      },
      children: [
        /* @__PURE__ */ jsxs5(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "16px"
            },
            children: [
              /* @__PURE__ */ jsxs5("div", { children: [
                /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsx5("h1", { style: { fontSize: "24px", fontWeight: 700, margin: 0 }, children: "Аккаунты" }),
                  /* @__PURE__ */ jsx5(
                    "span",
                    {
                      style: {
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: "rgba(59, 130, 246, 0.14)",
                        color: "#3b82f6"
                      },
                      children: formatAccountsStatusbarLabel(summary)
                    }
                  )
                ] }),
                /* @__PURE__ */ jsx5("p", { style: { fontSize: "13px", opacity: 0.74, margin: "6px 0 0 0", maxWidth: "680px" }, children: "Управляйте вашими подписками и API-ключами. При исчерпании квоты или временном ограничении Nomad автоматически переключается на следующий по приоритету аккаунт без обрыва диалога." })
              ] }),
              /* @__PURE__ */ jsxs5(
                "div",
                {
                  role: "tablist",
                  "aria-label": "Разделы экрана аккаунтов",
                  style: {
                    display: "inline-flex",
                    padding: "4px",
                    borderRadius: "10px",
                    background: "rgba(128,128,128,0.12)",
                    gap: "4px"
                  },
                  children: [
                    /* @__PURE__ */ jsxs5(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": activeTab === "accounts" || activeTab !== "billing" && activeTab !== "fallback",
                        onClick: () => activeAccountsTabAtom.set("accounts"),
                        style: {
                          padding: "7px 14px",
                          borderRadius: "7px",
                          border: "none",
                          background: activeTab === "accounts" || activeTab !== "billing" && activeTab !== "fallback" ? "var(--primary, #2563eb)" : "transparent",
                          color: activeTab === "accounts" || activeTab !== "billing" && activeTab !== "fallback" ? "#ffffff" : "inherit",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: [
                          "Пул аккаунтов (",
                          accounts.length,
                          ")"
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx5(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": activeTab === "fallback",
                        onClick: () => activeAccountsTabAtom.set("fallback"),
                        style: {
                          padding: "7px 14px",
                          borderRadius: "7px",
                          border: "none",
                          background: activeTab === "fallback" ? "var(--primary, #2563eb)" : "transparent",
                          color: activeTab === "fallback" ? "#ffffff" : "inherit",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Порядок и запас"
                      }
                    ),
                    /* @__PURE__ */ jsx5(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": activeTab === "billing",
                        onClick: () => activeAccountsTabAtom.set("billing"),
                        style: {
                          padding: "7px 14px",
                          borderRadius: "7px",
                          border: "none",
                          background: activeTab === "billing" ? "var(--primary, #2563eb)" : "transparent",
                          color: activeTab === "billing" ? "#ffffff" : "inherit",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Тариф"
                      }
                    )
                  ]
                }
              )
            ]
          }
        ),
        activeTab === "billing" ? /* @__PURE__ */ jsx5(BillingTab, { ctx }) : activeTab === "fallback" ? /* @__PURE__ */ jsx5(FallbackTab, { ctx }) : (
          /* Вкладка «Пул аккаунтов» (M-132) */
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
            /* @__PURE__ */ jsxs5(
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
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx5(
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
                          background: "var(--primary, #2563eb)",
                          color: "#ffffff",
                          fontSize: "13px",
                          fontWeight: 600,
                          cursor: "pointer"
                        },
                        children: "Войти подпиской"
                      }
                    ),
                    /* @__PURE__ */ jsx5(
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
                    /* @__PURE__ */ jsx5(
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
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsxs5(
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
                          /* @__PURE__ */ jsxs5("option", { value: "all", children: [
                            "Все провайдеры (",
                            accounts.length,
                            ")"
                          ] }),
                          uniqueProviders.map((prov) => /* @__PURE__ */ jsx5("option", { value: prov, children: formatProviderLabel(prov) }, prov))
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx5(
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
            actionNotice ? /* @__PURE__ */ jsx5(
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
            error ? /* @__PURE__ */ jsx5(
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
            modalMode === "oauth" ? /* @__PURE__ */ jsxs5(
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
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs5("div", { children: [
                      /* @__PURE__ */ jsx5("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Вход по подписке (OAuth / код устройства)" }),
                      /* @__PURE__ */ jsx5("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Подключите вашу личную подписку ChatGPT Plus/Pro, Anthropic, Google Gemini или Qwen в общий пул ротации." })
                    ] }),
                    /* @__PURE__ */ jsx5(
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
                  /* @__PURE__ */ jsxs5(
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
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "Провайдер подписки" }),
                          /* @__PURE__ */ jsx5(
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
                              children: PROVIDERS.filter((p) => p.supportsOAuth).map((p) => /* @__PURE__ */ jsx5("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "Название аккаунта в пуле" }),
                          /* @__PURE__ */ jsx5(
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
                        /* @__PURE__ */ jsx5(
                          "button",
                          {
                            type: "submit",
                            disabled: oauthLoading,
                            style: {
                              padding: "9px 16px",
                              borderRadius: "8px",
                              border: "none",
                              background: "var(--primary, #2563eb)",
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
                  oauthSession ? /* @__PURE__ */ jsxs5(
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
                        oauthSession.userCode ? /* @__PURE__ */ jsxs5("div", { children: [
                          "Ваш одноразовый код подтверждения:",
                          " ",
                          /* @__PURE__ */ jsx5(
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
                        /* @__PURE__ */ jsxs5("div", { children: [
                          "Вы также можете выполнить вход через терминал командой:",
                          " ",
                          /* @__PURE__ */ jsx5(
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
                        /* @__PURE__ */ jsxs5("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
                          oauthSession.verificationUri ? /* @__PURE__ */ jsx5(
                            "button",
                            {
                              type: "button",
                              onClick: () => openExternalSafe(ctx, oauthSession.verificationUri),
                              style: {
                                padding: "7px 14px",
                                borderRadius: "8px",
                                border: "none",
                                background: "var(--primary, #2563eb)",
                                color: "#ffffff",
                                fontSize: "12px",
                                fontWeight: 600,
                                cursor: "pointer"
                              },
                              children: "Открыть страницу подтверждения"
                            }
                          ) : null,
                          /* @__PURE__ */ jsx5(
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
                  oauthError ? /* @__PURE__ */ jsx5("div", { style: { fontSize: "13px", color: "#ef4444" }, children: oauthError }) : null
                ]
              }
            ) : null,
            modalMode === "key" ? /* @__PURE__ */ jsxs5(
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
                  /* @__PURE__ */ jsxs5("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs5("div", { children: [
                      /* @__PURE__ */ jsx5("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Добавление API-ключа в пул" }),
                      /* @__PURE__ */ jsx5("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Ключ будет сохранён в защищённом хранилище и включён в автоматическую ротацию по приоритету." })
                    ] }),
                    /* @__PURE__ */ jsx5(
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
                  /* @__PURE__ */ jsxs5(
                    "div",
                    {
                      style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px"
                      },
                      children: [
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "Провайдер" }),
                          /* @__PURE__ */ jsx5(
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
                              children: PROVIDERS.filter((p) => p.supportsKey).map((p) => /* @__PURE__ */ jsx5("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "Название в списке" }),
                          /* @__PURE__ */ jsx5(
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
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "API-ключ" }),
                          /* @__PURE__ */ jsx5(
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
                        /* @__PURE__ */ jsxs5("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx5("span", { children: "Приоритет (1 — наивысший)" }),
                          /* @__PURE__ */ jsx5(
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
                        ] })
                      ]
                    }
                  ),
                  keyFormError ? /* @__PURE__ */ jsx5("div", { style: { fontSize: "13px", color: "#ef4444" }, children: keyFormError }) : null,
                  /* @__PURE__ */ jsx5("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px" }, children: /* @__PURE__ */ jsx5(
                    "button",
                    {
                      type: "submit",
                      disabled: keySubmitting,
                      style: {
                        padding: "8px 18px",
                        borderRadius: "8px",
                        border: "none",
                        background: "var(--primary, #2563eb)",
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
            /* @__PURE__ */ jsxs5(
              "div",
              {
                style: {
                  borderRadius: "12px",
                  border: "1px solid var(--border, rgba(128,128,128,0.22))",
                  background: "var(--card, rgba(128,128,128,0.04))",
                  overflowX: "auto"
                },
                children: [
                  filteredAccounts.length === 0 ? /* @__PURE__ */ jsxs5(
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
                        /* @__PURE__ */ jsx5("div", { style: { fontSize: "16px", fontWeight: 600 }, children: loading ? "Загрузка пула аккаунтов..." : "В пуле пока нет подключённых подписок или ключей" }),
                        /* @__PURE__ */ jsx5("div", { style: { fontSize: "13px", opacity: 0.72, maxWidth: "520px" }, children: "Добавьте одну или несколько подписок («Войти подпиской») либо API-ключей («Добавить ключ»), чтобы настроить бесшовную ротацию без простоев на лимитах." })
                      ]
                    }
                  ) : /* @__PURE__ */ jsxs5(
                    "table",
                    {
                      style: {
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                        textAlign: "left"
                      },
                      children: [
                        /* @__PURE__ */ jsx5("thead", { children: /* @__PURE__ */ jsxs5(
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
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px" }, children: "Приоритет" }),
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px" }, children: "Аккаунт" }),
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px" }, children: "Провайдер" }),
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px" }, children: "Способ входа" }),
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px" }, children: "Статус" }),
                              /* @__PURE__ */ jsx5("th", { style: { padding: "12px 14px", textAlign: "right" }, children: "Действия" })
                            ]
                          }
                        ) }),
                        /* @__PURE__ */ jsx5("tbody", { children: filteredAccounts.map((acc, index) => {
                          const badge = getStatusBadge(acc);
                          const isBusy = busyAccountId === acc.id;
                          return /* @__PURE__ */ jsxs5(
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
                                /* @__PURE__ */ jsx5("td", { style: { padding: "12px 14px", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs5("div", { style: { display: "inline-flex", alignItems: "center", gap: "6px" }, children: [
                                  /* @__PURE__ */ jsx5(
                                    "span",
                                    {
                                      title: "Перетащите строку для смены приоритета",
                                      style: { opacity: 0.5, fontSize: "14px", userSelect: "none" },
                                      children: "⋮⋮"
                                    }
                                  ),
                                  /* @__PURE__ */ jsxs5("span", { style: { fontWeight: 700 }, children: [
                                    "#",
                                    acc.priority
                                  ] }),
                                  /* @__PURE__ */ jsxs5("div", { style: { display: "inline-flex", gap: "2px", marginLeft: "4px" }, children: [
                                    /* @__PURE__ */ jsx5(
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
                                    /* @__PURE__ */ jsx5(
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
                                /* @__PURE__ */ jsxs5("td", { style: { padding: "12px 14px" }, children: [
                                  /* @__PURE__ */ jsx5("div", { style: { fontWeight: 600 }, children: acc.label }),
                                  /* @__PURE__ */ jsx5(
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
                                /* @__PURE__ */ jsx5("td", { style: { padding: "12px 14px" }, children: acc.providerLabel }),
                                /* @__PURE__ */ jsx5("td", { style: { padding: "12px 14px" }, children: /* @__PURE__ */ jsx5(
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
                                /* @__PURE__ */ jsxs5("td", { style: { padding: "12px 14px" }, children: [
                                  /* @__PURE__ */ jsx5(
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
                                  acc.lastError ? /* @__PURE__ */ jsx5(
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
                                /* @__PURE__ */ jsx5("td", { style: { padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs5(
                                  "div",
                                  {
                                    style: {
                                      display: "inline-flex",
                                      gap: "6px",
                                      justifyContent: "flex-end",
                                      flexWrap: "wrap"
                                    },
                                    children: [
                                      /* @__PURE__ */ jsx5(
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
                                      /* @__PURE__ */ jsx5(
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
                                      /* @__PURE__ */ jsx5(
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
                  /* @__PURE__ */ jsxs5(
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
                        /* @__PURE__ */ jsx5("h3", { style: { margin: "0 0 10px 0", fontSize: "14px", fontWeight: 600 }, children: "Лента переключений аккаунтов" }),
                        switchFeed.length === 0 ? /* @__PURE__ */ jsx5("p", { style: { margin: 0, fontSize: "13px", opacity: 0.7 }, children: "Переключений аккаунтов пока не зафиксировано." }) : /* @__PURE__ */ jsx5(
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
                            children: switchFeed.map((item, idx) => /* @__PURE__ */ jsx5("li", { "data-testid": "switch-feed-item", children: item.line || `${item.ts?.slice(11, 16) || ""} · ${item.provider} · ${item.status_code || 429} · активна ${item.to_slot || "#2"}` }, item.id || item.api_request_id || idx))
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
    area: ROUTES_AREA4,
    order: 60,
    data: {
      id: "nomad.accounts.route",
      path: "/nomad-accounts",
      title: "Аккаунты",
      render: () => /* @__PURE__ */ jsx5(AccountsPage, { ctx })
    },
    render: () => /* @__PURE__ */ jsx5(AccountsPage, { ctx })
  });
  ctx.register({
    id: "nav",
    area: SIDEBAR_NAV_AREA2,
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
      render: () => /* @__PURE__ */ jsx5(AccountsStatusbarPill, { ctx })
    },
    render: () => /* @__PURE__ */ jsx5(AccountsStatusbarPill, { ctx })
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
    area: PALETTE_AREA3,
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
    area: PALETTE_AREA3,
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
    area: PALETTE_AREA3,
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
}

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
import { PALETTE_AREA as PALETTE_AREA4, ROUTES_AREA as ROUTES_AREA5 } from "@hermes/plugin-sdk";
import { jsx as jsx6 } from "react/jsx-runtime";
function registerBilling(ctx) {
  ctx.register({
    id: "route",
    area: ROUTES_AREA5,
    data: {
      id: "nomad.billing.route",
      path: "/nomad-billing",
      title: "Тариф и баланс NomadNet"
    },
    render: () => /* @__PURE__ */ jsx6(BillingTab, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA4,
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
import { createElement, useCallback as useCallback4, useEffect as useEffect5, useState as useState6 } from "react";
var DATA_ROUTE_PATH = "/nomad-data";
var DATA_NAV_ID = "data";
var DATA_NAV_LABEL = "Данные и место";
var DATA_NAV_ORDER = 63;
var PRESERVED_ITEMS_NOTICE = [
  "Star Map (карта знаний и связей)",
  "learning.* (накопленный граф наблюдений агента)",
  "История сессий и диалогов (sessions, state.db)"
];
var h = createElement;
function restGet(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  return Promise.resolve(null);
}
function restPost(ctx, path, body) {
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
  const [state, setState] = useState6({
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
  const [pruning, setPruning] = useState6(false);
  const [pruneResult, setPruneResult] = useState6(null);
  const [wipeStep, setWipeStep] = useState6(0);
  const [wipeToken, setWipeToken] = useState6("WIPE-MEMORY-CONFIRM");
  const [wiping, setWiping] = useState6(false);
  const [wipeResult, setWipeResult] = useState6(null);
  const [backupCreating, setBackupCreating] = useState6(false);
  const [backupResult, setBackupResult] = useState6(null);
  const [restoreZipPath, setRestoreZipPath] = useState6("");
  const [restoreStep, setRestoreStep] = useState6(0);
  const [restoreToken, setRestoreToken] = useState6("RESTORE-ARCHIVE-CONFIRM");
  const [restoring, setRestoring] = useState6(false);
  const [restoreResult, setRestoreResult] = useState6(null);
  const [copiedCli, setCopiedCli] = useState6(false);
  const loadData = useCallback4(() => {
    if (!ctx?.rest) {
      setState((prev) => ({ ...prev, loading: false }));
      return Promise.resolve(null);
    }
    return restGet(ctx, "/data").then((res) => {
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
  useEffect5(() => {
    loadData();
  }, [loadData]);
  const handlePrune = useCallback4(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setPruning(true);
    return restPost(ctx, "/data/prune", {}).then((res) => {
      setPruneResult(res || null);
      return loadData();
    }).catch((err) => {
      ctx?.host?.toast?.error?.(err?.message || "Не удалось почистить снимки откатов");
    }).finally(() => {
      setPruning(false);
    });
  }, [ctx, loadData]);
  const handleStartWipe = useCallback4(() => {
    setWipeResult(null);
    setWipeStep(1);
    if (ctx?.rest) {
      restPost(ctx, "/data/wipe", {
        confirm_step: 1,
        confirmed: false,
        target: "all"
      }).then((res) => {
        if (res?.confirm_token) setWipeToken(res.confirm_token);
      }).catch(() => {
      });
    }
  }, [ctx]);
  const handleFirstConfirm = useCallback4(() => {
    setWipeStep(2);
  }, []);
  const handleSecondConfirmExecute = useCallback4(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setWiping(true);
    return restPost(ctx, "/data/wipe", {
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
  const handleCreateBackup = useCallback4(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    setBackupCreating(true);
    return restPost(ctx, "/data/backup", {}).then((res) => {
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
  const handleCopyRestoreCli = useCallback4(() => {
    const cmd = buildRestoreCliCommand(restoreZipPath);
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(cmd).catch(() => {
      });
    }
    setCopiedCli(true);
    ctx?.host?.toast?.info?.("Команда восстановления скопирована в буфер обмена");
  }, [ctx, restoreZipPath]);
  const handleStartRestore = useCallback4(() => {
    if (!String(restoreZipPath || "").trim()) {
      ctx?.host?.toast?.error?.("Выберите файл резервной копии (.zip)");
      return;
    }
    setRestoreResult(null);
    setRestoreStep(1);
    if (ctx?.rest) {
      restPost(ctx, "/data/restore", {
        zip_path: restoreZipPath,
        confirm_step: 1,
        confirmed: false
      }).then((res) => {
        if (res?.confirm_token) setRestoreToken(res.confirm_token);
      }).catch(() => {
      });
    }
  }, [ctx, restoreZipPath]);
  const handleRestoreFirstConfirm = useCallback4(() => {
    setRestoreStep(2);
  }, []);
  const handleRestoreSecondConfirmExecute = useCallback4(() => {
    if (!ctx?.rest || !String(restoreZipPath || "").trim()) return Promise.resolve(null);
    setRestoring(true);
    return restPost(ctx, "/data/restore", {
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
  const projects = Array.isArray(state.checkpoints?.projects) ? state.checkpoints.projects : [];
  const cliCommandText = buildRestoreCliCommand(restoreZipPath);
  return h(
    "div",
    {
      className: "nomad-data-page",
      style: { padding: "24px", maxWidth: "1080px", margin: "0 auto" }
    },
    h(
      "header",
      { style: { marginBottom: "20px" } },
      h(
        "h1",
        { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } },
        "Данные и место"
      ),
      h(
        "p",
        { style: { margin: 0, opacity: 0.78, fontSize: "13px" } },
        "Объём данных профиля на диске, управление снимками откатов, резервное копирование и сброс личной памяти."
      )
    ),
    state.error ? h(
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
    h(
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
      h(
        "div",
        {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px"
          }
        },
        h("h2", { style: { fontSize: "16px", margin: 0 } }, "Занято на диске"),
        h(
          "strong",
          { className: "nomad-data-total-bytes", style: { fontSize: "18px" } },
          formatBytesRu(state.totalBytes)
        )
      ),
      h(
        "div",
        {
          style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "10px"
          }
        },
        ...(state.sections || []).map(
          (sec) => h(
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
            h("span", null, sec.label),
            h("strong", null, formatBytesRu(sec.bytes))
          )
        )
      )
    ),
    h(
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
      h(
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
        h(
          "div",
          null,
          h("h2", { style: { fontSize: "16px", margin: "0 0 4px 0" } }, "Откаты по проектам"),
          h(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.75 } },
            `Всего занято под откаты: ${formatBytesRu(state.checkpoints?.total_bytes)} · Снимков: ${state.checkpoints?.snapshot_count || 0}`
          )
        ),
        h(
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
      pruneResult ? h(
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
      projects.length === 0 ? h(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.7 } },
        "Снимков откатов по проектам пока нет."
      ) : h(
        "table",
        {
          className: "nomad-data-projects-table",
          style: { width: "100%", borderCollapse: "collapse", fontSize: "13px" }
        },
        h(
          "thead",
          null,
          h(
            "tr",
            { style: { textAlign: "left", borderBottom: "1px solid rgba(128,128,128,0.2)" } },
            h("th", { style: { padding: "8px" } }, "Проект"),
            h("th", { style: { padding: "8px" } }, "Каталог"),
            h("th", { style: { padding: "8px" } }, "Снимков"),
            h("th", { style: { padding: "8px" } }, "Размер"),
            h("th", { style: { padding: "8px" } }, "Откат последней правки")
          )
        ),
        h(
          "tbody",
          null,
          ...projects.map(
            (proj) => h(
              "tr",
              {
                key: proj.id,
                "data-project-id": proj.id,
                style: { borderBottom: "1px solid rgba(128,128,128,0.12)" }
              },
              h("td", { style: { padding: "8px", fontWeight: 500 } }, proj.project),
              h("td", { style: { padding: "8px", opacity: 0.75 } }, proj.directory),
              h("td", { style: { padding: "8px" } }, String(proj.snapshot_count || 0)),
              h("td", { style: { padding: "8px" } }, formatBytesRu(proj.size_bytes)),
              h(
                "td",
                { style: { padding: "8px" } },
                proj.can_rollback ? "Доступен" : "Нет снимков"
              )
            )
          )
        )
      )
    ),
    h(
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
      h(
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
        h(
          "div",
          null,
          h(
            "h2",
            { style: { fontSize: "16px", margin: "0 0 4px 0" } },
            "Резервная копия и восстановление из архива (.zip)"
          ),
          h(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.78 } },
            "Создайте архив текущего профиля или восстановите настройки, сессии и память из файла .zip."
          )
        ),
        h(
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
      backupResult?.zip_path ? h(
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
      h(
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
        h("input", {
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
        h("input", {
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
      h(
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
        h("code", { className: "nomad-data-restore-cli-command" }, cliCommandText),
        h(
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
      h(
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
      restoreStep === 0 ? h(
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
      restoreStep === 1 ? h(
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
        h(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          `Подтверждение 1 из 2: вы уверены, что хотите распаковать архив «${restoreZipPath}» поверх текущего профиля?`
        ),
        h(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h(
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
          h(
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
      restoreStep === 2 ? h(
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
        h(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 2 из 2 (окончательное): перезаписать файлы каталога профиля содержимым выбранного архива .zip?"
        ),
        h(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h(
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
          h(
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
      restoreResult?.restored ? h(
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
    h(
      "section",
      {
        className: "nomad-data-wipe-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(248,81,73,0.35)"
        }
      },
      h(
        "h2",
        { style: { fontSize: "16px", margin: "0 0 8px 0" } },
        "Стереть файлы памяти (MEMORY.md и USER.md)"
      ),
      h(
        "p",
        { style: { margin: "0 0 10px 0", fontSize: "13px" } },
        `Текущий размер: MEMORY.md — ${formatBytesRu(state.memory?.memory)}, USER.md — ${formatBytesRu(state.memory?.user)}.`
      ),
      h(
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
        h(
          "div",
          { style: { fontWeight: 600, marginBottom: "6px" } },
          "Что удаляется и что остаётся:"
        ),
        h(
          "div",
          { style: { marginBottom: "4px" } },
          "Удаляется безвозвратно: memories/MEMORY.md и memories/USER.md."
        ),
        h(
          "div",
          null,
          "Остаётся нетронутым: Star Map, learning.* и история сессий (sessions, state.db)."
        )
      ),
      wipeStep === 0 ? h(
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
      wipeStep === 1 ? h(
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
        h(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 1 из 2: вы действительно хотите удалить memories/MEMORY.md и memories/USER.md?"
        ),
        h(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h(
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
          h(
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
      wipeStep === 2 ? h(
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
        h(
          "p",
          { style: { margin: "0 0 10px 0", fontSize: "13px", fontWeight: 600 } },
          "Подтверждение 2 из 2 (окончательное): стереть MEMORY.md и USER.md прямо сейчас? Star Map, learning.* и история сессий сохранятся."
        ),
        h(
          "div",
          { style: { display: "flex", gap: "10px" } },
          h(
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
          h(
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
      wipeResult?.wiped ? h(
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
    render: (props) => createElement(NomadDataPage, { ctx, ...props || {} })
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
import { ROUTES_AREA as ROUTES_AREA7, host as host4 } from "@hermes/plugin-sdk";
import { useEffect as useEffect6, useState as useState7 } from "react";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
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
  if (!navigated && host4 && typeof host4.navigate === "function") {
    try {
      host4.navigate(ACCOUNTS_ROUTE_PATH);
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
  const [state, setState] = useState7({ loading: true, connected: false, model: null, baseUrl: null });
  useEffect6(() => {
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
  return jsxs6("div", {
    "data-testid": "nomad-accounts-screen",
    style: { padding: "28px 32px", maxWidth: 680, lineHeight: 1.5 },
    children: [
      jsx7("h1", {
        style: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
        children: "Аккаунты"
      }),
      jsx7("p", {
        style: { margin: "0 0 16px", opacity: 0.8 },
        children: "Управление подключением NomadNet и ключами доступа."
      }),
      jsx7("div", {
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
    area: ROUTES_AREA7,
    order: 90,
    title: "Аккаунты",
    data: { path: CONNECT_ROUTE_PATH },
    render: () => jsx7(AccountsConnectFallbackView, { ctx })
  });
  ctx.register({
    id: "accounts-fallback-route",
    area: ROUTES_AREA7,
    order: 999,
    title: "Аккаунты",
    data: { path: ACCOUNTS_ROUTE_PATH },
    render: () => jsx7(AccountsConnectFallbackView, { ctx })
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
import { PALETTE_AREA as PALETTE_AREA6, STATUSBAR_AREAS as STATUSBAR_AREAS2 } from "@hermes/plugin-sdk";
import { createElement as createElement2, useCallback as useCallback5, useEffect as useEffect7, useState as useState8 } from "react";
var h2 = createElement2;
function StatusbarStopButton({ ctx }) {
  const [stopped, setStopped] = useState8(false);
  const [loading, setLoading] = useState8(false);
  const fetchState = useCallback5(() => {
    if (!ctx || typeof ctx.rest !== "function") return;
    Promise.resolve().then(() => ctx.rest("/state")).then((res) => {
      if (res && typeof res.stopped === "boolean") {
        setStopped(res.stopped);
      }
    }).catch(() => {
    });
  }, [ctx]);
  useEffect7(() => {
    fetchState();
    const interval = setInterval(fetchState, 3e3);
    return () => clearInterval(interval);
  }, [fetchState]);
  const toggleStop = useCallback5(() => {
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
  return h2(
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
      render: () => h2(StatusbarStopButton, { ctx })
    });
    ctx.register({
      id: "cmd_pause",
      area: PALETTE_AREA6 || "palette",
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
      area: PALETTE_AREA6 || "palette",
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
import { PALETTE_AREA as PALETTE_AREA7 } from "@hermes/plugin-sdk";
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
    area: PALETTE_AREA7,
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
    area: PALETTE_AREA7,
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
import { PALETTE_AREA as PALETTE_AREA8, ROUTES_AREA as ROUTES_AREA8, atom as atom3, host as host5 } from "@hermes/plugin-sdk";
import { createElement as createElement3, useCallback as useCallback6, useEffect as useEffect8, useState as useState9 } from "react";
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
var h3 = createElement3;
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
  if (host5 && typeof host5.notify === "function") {
    host5.notify("Настройки персонализации сохранены");
  }
  return clean;
}
function PersonalizationTab({ ctx, onSaved = null }) {
  const [settings, setSettings] = useState9(() => loadPersonalizationSettings(ctx));
  const [saveSuccess, setSaveSuccess] = useState9("");
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
  return h3(
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
    h3(
      "header",
      { style: { display: "flex", flexDirection: "column", gap: "6px" } },
      h3(
        "h1",
        {
          "data-testid": "personalization-title",
          style: { fontSize: "20px", fontWeight: 600, margin: 0 }
        },
        "Персонализация ассистента Nomad"
      ),
      h3(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.75, lineHeight: 1.5 } },
        "Настройте формат взаимодействия, имя обращения и стилистику ответов модели. Все параметры сохраняются локально в профиле и синхронизируются с мастером онбординга."
      )
    ),
    h3(
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
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h3(
          "label",
          { style: { fontSize: "13px", fontWeight: 600 } },
          "Как к вам обращаться:"
        ),
        h3("input", {
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
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h3(
          "label",
          { style: { fontSize: "13px", fontWeight: 600 } },
          "Форма обращения (решение D10):"
        ),
        h3(
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
          h3("option", { value: "formal" }, "Строго на «вы» (канон Nomad D10)"),
          h3("option", { value: "informal" }, "На «ты» (неформальный рабочий стиль)")
        )
      ),
      // Роль и профессия
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h3("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Ваша основная роль / профиль:"),
        h3("input", {
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
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h3("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Стиль и глубина ответов модели:"),
        h3(
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
          REPLY_STYLES.map((st) => h3("option", { key: st.id, value: st.id }, st.label))
        )
      ),
      // Цветовой акцент оформления (синхронизируется с onboarding-answers)
      h3(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "6px" } },
        h3("label", { style: { fontSize: "13px", fontWeight: 600 } }, "Цветовой акцент интерфейса (онбординг):"),
        h3(
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
          ACCENT_COLORS.map((c) => h3("option", { key: c.id, value: c.id }, c.label))
        )
      ),
      // Кнопка сохранения
      h3(
        "div",
        { style: { display: "flex", gap: "12px", alignItems: "center", marginTop: "6px" } },
        h3(
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
              background: "var(--primary, #2563eb)",
              color: "#ffffff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          "Сохранить настройки"
        ),
        saveSuccess && h3(
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
    area: ROUTES_AREA8,
    data: {
      id: "nomad.personalization.route",
      path: PERSONALIZATION_ROUTE_PATH,
      title: "Персонализация"
    },
    render: () => h3(PersonalizationTab, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA8,
    order: 67,
    data: {
      id: "nomad.personalization.open",
      action: "nomad.personalization.open",
      label: "Персонализация ассистента",
      category: "Nomad",
      keywords: ["персонализация", "имя", "обращение", "стиль", "ответы", "онбординг", "personalization"],
      run: () => {
        if (host5 && typeof host5.navigate === "function") {
          host5.navigate(PERSONALIZATION_ROUTE_PATH);
        }
      }
    }
  });
}

// safety.js
var safety_exports = {};
__export(safety_exports, {
  DesktopCronIncidentsCard: () => DesktopCronIncidentsCard,
  DesktopEgressCard: () => DesktopEgressCard,
  NomadSafetyPage: () => NomadSafetyPage,
  SAFETY_NAV_ID: () => SAFETY_NAV_ID,
  SAFETY_NAV_LABEL: () => SAFETY_NAV_LABEL,
  SAFETY_NAV_ORDER: () => SAFETY_NAV_ORDER,
  SAFETY_ROUTE_PATH: () => SAFETY_ROUTE_PATH,
  default: () => registerSafety
});
import {
  PALETTE_AREA as PALETTE_AREA9,
  ROUTES_AREA as ROUTES_AREA9,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA4
} from "@hermes/plugin-sdk";
import { createElement as createElement4, useCallback as useCallback7, useEffect as useEffect9, useState as useState10 } from "react";
var SAFETY_ROUTE_PATH = "/nomad-safety";
var SAFETY_NAV_ID = "safety";
var SAFETY_NAV_LABEL = "Разрешения и безопасность";
var SAFETY_NAV_ORDER = 63;
var h4 = createElement4;
function restGet2(ctx, path) {
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path));
  }
  return Promise.resolve(null);
}
function restPost2(ctx, path, body) {
  if (typeof ctx?.rest?.post === "function") {
    return Promise.resolve(ctx.rest.post(path, body));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "POST", body }));
  }
  return Promise.resolve(null);
}
function NomadSafetyPage({ ctx }) {
  const [loading, setLoading] = useState10(true);
  const [error, setError] = useState10(null);
  const [notice, setNotice] = useState10("");
  const [proposals, setProposals] = useState10([]);
  const [allowlist, setAllowlist] = useState10([]);
  const [denyRules, setDenyRules] = useState10([]);
  const [egress, setEgress] = useState10(null);
  const [newAllowPattern, setNewAllowPattern] = useState10("");
  const [newDenyPattern, setNewDenyPattern] = useState10("");
  const [busy, setBusy] = useState10(false);
  const applyOverview = useCallback7((res) => {
    if (!res || typeof res !== "object") return;
    setProposals(Array.isArray(res.proposals) ? res.proposals : []);
    setAllowlist(Array.isArray(res.command_allowlist) ? res.command_allowlist : []);
    setDenyRules(Array.isArray(res.approvals_deny) ? res.approvals_deny : []);
    if (res.egress && typeof res.egress === "object") {
      setEgress(res.egress);
    }
  }, []);
  const loadSafety = useCallback7(() => {
    if (!ctx?.rest) {
      setLoading(false);
      return Promise.resolve(null);
    }
    setLoading(true);
    setError(null);
    return restGet2(ctx, "/safety").then((res) => {
      applyOverview(res);
      setLoading(false);
      return res;
    }).catch((err) => {
      setLoading(false);
      setError(err?.message || "Не удалось загрузить настройки разрешений и безопасности.");
      return null;
    });
  }, [ctx, applyOverview]);
  useEffect9(() => {
    loadSafety();
  }, [loadSafety]);
  const handleAcceptSuggestion = useCallback7(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost2(ctx, "/safety/suggestions/accept", { pattern }).then((res) => {
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
  const handleRemoveAllowlist = useCallback7(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost2(ctx, "/safety/allowlist/remove", { pattern }).then((res) => {
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
  const handleAddAllowlist = useCallback7(
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
  const handleAddDeny = useCallback7(
    (e) => {
      if (e && typeof e.preventDefault === "function") e.preventDefault();
      const pat = newDenyPattern.trim();
      if (!ctx?.rest || !pat) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost2(ctx, "/safety/deny/add", { pattern: pat }).then((res) => {
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
  const handleRemoveDeny = useCallback7(
    (pattern) => {
      if (!ctx?.rest || !pattern) return Promise.resolve(null);
      setBusy(true);
      setNotice("");
      return restPost2(ctx, "/safety/deny/remove", { pattern }).then((res) => {
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
  return h4(
    "div",
    {
      className: "nomad-safety-page",
      style: { padding: "24px", maxWidth: "1040px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }
    },
    h4(
      "header",
      null,
      h4("h1", { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } }, SAFETY_NAV_LABEL),
      h4(
        "p",
        { style: { margin: 0, fontSize: "13px", opacity: 0.78 } },
        "Настройте, какие команды агент может запускать без лишних вопросов, а какие команды строго запрещены при любых обстоятельствах."
      )
    ),
    error ? h4(
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
    notice ? h4(
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
    h4(
      "section",
      {
        className: "nomad-safety-suggestions",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.24)"
        }
      },
      h4("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Подсказки из вашей истории запусков"),
      h4(
        "p",
        { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
        "Команды, которые вы неоднократно запускали в сессиях. Примите подсказку, чтобы разрешить шаблон в command_allowlist."
      ),
      loading ? h4("div", { style: { fontSize: "13px", opacity: 0.7 } }, "Анализируем историю вызовов…") : proposals.length === 0 ? h4(
        "div",
        { style: { fontSize: "13px", opacity: 0.72 } },
        "Новых подсказок пока нет — все частые команды уже добавлены или история пуста."
      ) : h4(
        "div",
        { style: { display: "grid", gap: "8px" } },
        ...proposals.map(
          (prop) => h4(
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
            h4(
              "div",
              null,
              h4("code", { style: { fontWeight: 600, fontSize: "13px" } }, prop.pattern),
              h4(
                "span",
                { style: { fontSize: "12px", opacity: 0.72, marginLeft: "10px" } },
                `вызовов: ${prop.count} · тип: ${prop.kind === "prefix" ? "префикс" : "точное совпадение"}`
              )
            ),
            h4(
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
                  background: "#2563eb",
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
    h4(
      "section",
      {
        className: "nomad-safety-allowlist",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.24)"
        }
      },
      h4("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Постоянно разрешённые команды (command_allowlist)"),
      h4(
        "form",
        {
          onSubmit: handleAddAllowlist,
          style: { display: "flex", gap: "8px", marginBottom: "12px" }
        },
        h4("input", {
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
        h4(
          "button",
          {
            type: "submit",
            disabled: busy,
            style: {
              padding: "8px 14px",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#ffffff",
              fontWeight: 600,
              cursor: "pointer"
            }
          },
          "Добавить разрешение"
        )
      ),
      allowlist.length === 0 ? h4("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Список разрешённых шаблонов пуст.") : h4(
        "div",
        { style: { display: "grid", gap: "6px" } },
        ...allowlist.map(
          (pat) => h4(
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
            h4("code", { style: { fontSize: "13px" } }, pat),
            h4(
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
    h4(
      "section",
      {
        className: "nomad-safety-deny",
        style: {
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(248,81,73,0.35)"
        }
      },
      h4("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Жёсткие запреты команд (approvals.deny)"),
      h4(
        "p",
        { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.82 } },
        "Команды, совпадающие с этими шаблонами, блокируются всегда — даже если включён автоматический режим без запросов подтверждения (--yolo)."
      ),
      h4(
        "form",
        {
          onSubmit: handleAddDeny,
          style: { display: "flex", gap: "8px", marginBottom: "12px" }
        },
        h4("input", {
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
        h4(
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
      denyRules.length === 0 ? h4("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Пользовательские правила запрета пока не заданы.") : h4(
        "div",
        { style: { display: "grid", gap: "6px" } },
        ...denyRules.map(
          (rule) => h4(
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
            h4("code", { style: { fontSize: "13px" } }, rule),
            h4(
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
    createElement4(DesktopEgressCard, { ctx, egress }),
    createElement4(DesktopCronIncidentsCard, { ctx })
  );
}
function DesktopEgressCard({ ctx, egress }) {
  const [localEgress, setLocalEgress] = useState10(egress || null);
  const [copied, setCopied] = useState10(false);
  useEffect9(() => {
    if (egress) {
      setLocalEgress(egress);
    } else if (ctx) {
      restGet2(ctx, "/safety/egress").then((res) => {
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
  return h4(
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
    h4(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
      h4(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "10px" } },
        h4("h3", { style: { margin: 0, fontSize: "16px", fontWeight: 600 } }, "Сетевой фильтр Egress (только чтение)"),
        h4(
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
      h4(
        "span",
        { style: { fontSize: "12px", opacity: 0.6 } },
        "Управление egress — в терминале"
      )
    ),
    isNotConfigured ? h4(
      "div",
      { style: { display: "grid", gap: "8px" } },
      h4(
        "div",
        { style: { fontSize: "13px", opacity: 0.85 } },
        "Сетевой прокси-фильтр исходящего трафика (iron-proxy) не настроен для текущего профиля."
      ),
      h4(
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
        h4("code", { style: { fontSize: "13px", flex: "1 1 auto" } }, "hermes egress setup"),
        h4(
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
    ) : h4(
      "div",
      { style: { display: "grid", gap: "10px" } },
      h4(
        "div",
        { style: { fontSize: "13px", fontWeight: 500 } },
        "Разрешённые внешние домены (upstream hosts):"
      ),
      data.allowed_domains && data.allowed_domains.length > 0 ? h4(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "6px" } },
        ...data.allowed_domains.map(
          (domain) => h4(
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
      ) : h4("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Разрешённые домены не обнаружены."),
      isStopped && h4(
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
        h4("span", { style: { fontSize: "12px" } }, "Для запуска прокси выполните:"),
        h4("code", { style: { fontSize: "12px", fontWeight: 600 } }, "hermes egress start")
      )
    )
  );
}
function DesktopCronIncidentsCard({ ctx }) {
  const [incidents, setIncidents] = useState10([]);
  const [showResolved, setShowResolved] = useState10(false);
  const [busyId, setBusyId] = useState10(null);
  const loadIncidents = async () => {
    try {
      const resp = await callRest(ctx, "get", "/cron/incidents?include_resolved=true");
      const raw = Array.isArray(resp?.incidents) ? resp.incidents : [];
      setIncidents(raw);
    } catch (_err) {
      setIncidents([]);
    }
  };
  useEffect9(() => {
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
  return h4(
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
    h4(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } },
      h4("h2", { style: { margin: 0, fontSize: "16px", fontWeight: 600 } }, "Инциденты расписания"),
      h4(
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
    visible.length === 0 ? h4("div", { style: { fontSize: "13px", opacity: 0.72 } }, "Открытых инцидентов расписания нет.") : h4(
      "div",
      { style: { display: "grid", gap: "8px" } },
      ...visible.map(
        (inc) => h4(
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
          h4(
            "div",
            { style: { display: "grid", gap: "4px" } },
            h4(
              "div",
              { style: { fontSize: "13px", fontWeight: 600 } },
              `${inc.job_name || inc.job_id || inc.id} · повторов: ${inc.repeat_count ?? inc.consecutive_failures ?? 1}`
            ),
            h4(
              "div",
              { style: { fontSize: "12px", opacity: 0.82 } },
              inc.error_text || inc.last_error || "Ошибка выполнения"
            )
          ),
          (inc.status === "detected" || inc.status === "alerted") && h4(
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
  const renderPage = (props) => createElement4(NomadSafetyPage, { ctx, ...props || {} });
  ctx.register({
    id: "page",
    area: ROUTES_AREA9,
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
    area: SIDEBAR_NAV_AREA4,
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
    area: PALETTE_AREA9,
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
    area: PALETTE_AREA9,
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

// simulator.js
var simulator_exports = {};
__export(simulator_exports, {
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
  SimulatorPage: () => SimulatorPage,
  assertNomadSidebarRowCap: () => assertNomadSidebarRowCap,
  continueSimulatorChat: () => continueSimulatorChat,
  countNomadSidebarRows: () => countNomadSidebarRows,
  default: () => register4,
  filterRecentSessionsBySetting: () => filterRecentSessionsBySetting,
  resolveKickoffText: () => resolveKickoffText,
  simulatorStateAtom: () => simulatorStateAtom,
  startSimulatorChat: () => startSimulatorChat
});
import { useCallback as useCallback8, useEffect as useEffect10, useMemo as useMemo3, useState as useState11 } from "react";
import {
  PALETTE_AREA as PALETTE_AREA10,
  ROUTES_AREA as ROUTES_AREA10,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA5,
  atom as atom4,
  host as host6,
  useValue as useValue2
} from "@hermes/plugin-sdk";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var SIMULATOR_PATH = "/nomad-simulator";
var SIMULATOR_NAV_LABEL = "Симулятор ИИ";
var SIMULATOR_NAV_CODICON = "mortar-board";
var SIMULATOR_NAV_ORDER = 65;
var SIMULATOR_PERSONA_KEY = "simulator";
var SIMULATOR_SESSION_SOURCE = "simulator";
var SIMULATOR_SESSION_TITLE = "Симулятор ИИ";
var MAX_SIDEBAR_NAV_ITEMS = 6;
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
var SIMULATOR_TRACKS = [
  {
    id: "founder",
    label: "Основатель",
    summary: "Проверка продуктовых гипотез, сборка MVP, лендингов и расчёт экономики без штата разработчиков.",
    firstMission: "Собрать интерактивный калькулятор юнит-экономики и посадочную страницу для вашего продукта.",
    kickoff: "Здравствуйте! Я выбираю трек «Основатель» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу предложите первую практическую микро-миссию."
  },
  {
    id: "marketer",
    label: "Маркетолог",
    summary: "Контент-конвейеры, посадочные страницы, лид-магниты и автоматическая аналитика кампаний.",
    firstMission: "Собрать генератор мультиформатного контент-плана и интерактивный квиз для лидов.",
    kickoff: "Здравствуйте! Я выбираю трек «Маркетолог» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "product",
    label: "Продакт",
    summary: "Живые прототипы функций, разбор обратной связи пользователей, PRD и быстрые эксперименты.",
    firstMission: "Превратить сырые заметки интервью в кликабельный прототип новой функции.",
    kickoff: "Здравствуйте! Я выбираю трек «Продакт» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "project",
    label: "Проджект",
    summary: "Контроль сроков, автоматическая сводка статусов, управление рисками и прозрачные отчёты.",
    firstMission: "Настроить автоматический сборщик недельного отчёта и детектор блокеров по задачам.",
    kickoff: "Здравствуйте! Я выбираю трек «Проджект» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "analyst",
    label: "Аналитик",
    summary: "Очистка выгрузок, SQL/Python-пайплайны, наглядные дашборды и проверка гипотез на данных.",
    firstMission: "Построить воспроизводимый пайплайн очистки CSV-выгрузки с интерактивным отчётом.",
    kickoff: "Здравствуйте! Я выбираю трек «Аналитик» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "designer",
    label: "Дизайнер",
    summary: "Живые UI-компоненты, токены дизайн-системы, анимации и проверка сценариев в коде.",
    firstMission: "Собрать интерактивную витрину компонентов с переключением состояний и темы.",
    kickoff: "Здравствуйте! Я выбираю трек «Дизайнер» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "hr",
    label: "HR",
    summary: "Профили ролей, разбор резюме, планы адаптации новичков и внутренняя база знаний.",
    firstMission: "Собрать интерактивный чек-лист онбординга и матрицу оценки кандидатов под вашу вакансию.",
    kickoff: "Здравствуйте! Я выбираю трек «HR» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "sales",
    label: "Продажи",
    summary: "Персонализация коммерческих предложений, подготовка к встречам и автоматизация CRM-рутины.",
    firstMission: "Собрать генератор персонального коммерческого предложения по карточке клиента.",
    kickoff: "Здравствуйте! Я выбираю трек «Продажи» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  },
  {
    id: "operations",
    label: "Операции",
    summary: "Регламенты, сверка таблиц, связка внутренних сервисов и устранение ручных операций.",
    firstMission: "Автоматизировать сверку регулярных таблиц и выпуск операционной сводки без ручного копирования.",
    kickoff: "Здравствуйте! Я выбираю трек «Операции» в «Симуляторе ИИ». Поприветствуйте меня как ментор курса и сразу запустите первую практическую миссию."
  }
];
var SIMULATOR_SCENARIOS = [
  {
    id: "prompting",
    title: "Точный промптинг и постановка задачи",
    description: "Научитесь формулировать контекст, критерии приёмки и ограничения так, чтобы агент выдавал готовый результат с первого шага.",
    kickoff: "Здравствуйте! Хочу потренировать навык точной постановки задач агенту в «Симуляторе ИИ». Поприветствуйте меня как ментор и предложите первую короткую миссию."
  },
  {
    id: "automation",
    title: "Автоматизация рутины и расписаний",
    description: "Соберите собственный рабочий конвейер: разбор файлов, проверка данных и регулярные отчёты по расписанию.",
    kickoff: "Здравствуйте! Хочу освоить автоматизацию рутины и регулярных задач в «Симуляторе ИИ». Поприветствуйте меня как ментор и предложите первую практическую миссию."
  },
  {
    id: "swarm",
    title: "Управление роем параллельных агентов",
    description: "Разделите крупную задачу на независимые дорожки роя, проверьте результаты и соберите итоговое решение.",
    kickoff: "Здравствуйте! Хочу научиться запускать параллельный рой агентов в «Симуляторе ИИ». Поприветствуйте меня как ментор и начните первую миссию по работе с роем."
  }
];
var SIMULATOR_KICKOFF = "Здравствуйте! Запускаю «Симулятор ИИ». Поприветствуйте меня как ведущий курса в двух предложениях и предложите выбрать один из 9 треков роли (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции) в столбик по одному на строке — без вызова инструментов и чтения файлов, сразу живым ответом.";
var SIMULATOR_PERSONA = [
  "Вы — ведущий интерактивного курса «Симулятор ИИ» в Nomad (навык vibecoding-course): практичный, доброжелательный и структурный ИИ-ментор, который обучает пользователя вайбкодингу, точной постановке задач, автоматизации и работе с роем агентов на реальных микро-миссиях.",
  "Обращайтесь к пользователю строго на «вы» (уважительно, живо и по делу, без канцелярита и без панибратского «ты»). Вы ведёте занятие, предлагаете конкретные шаги и помогаете довести каждую миссию до осязаемого результата в рабочей папке проекта.",
  "ПРАВИЛО ПЕРВОГО ОТВЕТА (высший приоритет): На самое первое сообщение пользователя в новой сессии ответьте МГНОВЕННО — без вызова каких-либо инструментов и без чтения диска. Ваш первый ответ — это тёплое приветствие в 1–2 предложениях и список из 9 ролевых треков в столбик (Основатель, Маркетолог, Продакт, Проджект, Аналитик, Дизайнер, HR, Продажи, Операции), чтобы пользователь сразу выбрал близкую ему роль.",
  "ПРАВИЛО ВТОРОГО И ПОСЛЕДУЮЩИХ ХОДОВ: Как только пользователь ответил на приветствие, сразу зафиксируйте наиболее подходящий трек (по умолчанию Основатель) и запустите Миссию 1 этого трека. Никогда не просите пользователя самостоятельно придумывать сценарий — предлагайте готовый шаг и критерий проверки."
].join("\n\n");
var simulatorStateAtom = atom4({
  status: "idle",
  lastSessionId: null,
  selectedTrackId: null,
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
function resolveKickoffText(trackOrScenarioId) {
  if (!trackOrScenarioId) {
    return SIMULATOR_KICKOFF;
  }
  const needle = String(trackOrScenarioId).trim().toLowerCase();
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
  return contributions.filter((c) => c && c.area === SIDEBAR_NAV_AREA5).length;
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
async function startSimulatorChat(hostApi = host6, options = {}) {
  if (!hostApi || typeof hostApi.request !== "function") {
    return null;
  }
  const kickoffText = options.kickoff || resolveKickoffText(options.trackId);
  const mentorPrompt = options.personaPrompt || SIMULATOR_PERSONA;
  const firstProbe = hostApi.request("config.set", {
    key: "personality",
    value: SIMULATOR_PERSONA_KEY
  });
  if (!isRealPromise(firstProbe)) {
    return null;
  }
  simulatorStateAtom.set({
    ...simulatorStateAtom.get(),
    status: "starting",
    selectedTrackId: options.trackId || null,
    error: null
  });
  try {
    try {
      await firstProbe;
    } catch {
      await hostApi.request("config.set", {
        key: "prompt",
        value: mentorPrompt
      }).catch(() => void 0);
    }
    const created = await hostApi.request("session.create", {
      title: SIMULATOR_SESSION_TITLE,
      source: SIMULATOR_SESSION_SOURCE,
      hidden: true
    });
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
    simulatorStateAtom.set({
      status: "ready",
      lastSessionId: storedSessionId,
      selectedTrackId: options.trackId || null,
      error: null
    });
    return {
      sessionId: runtimeSessionId,
      storedSessionId,
      kickoffText
    };
  } catch (err) {
    const cleanMessage = sanitizeWhiteLabel(err?.message || err);
    simulatorStateAtom.set({
      ...simulatorStateAtom.get(),
      status: "error",
      error: cleanMessage
    });
    return null;
  }
}
async function continueSimulatorChat(hostApi = host6, storage = null) {
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
var autoLaunchInFlight = false;
function SimulatorPage({ ctx }) {
  const simState = useValue2(simulatorStateAtom);
  const [activeTrack, setActiveTrack] = useState11("founder");
  const savedSessionId = useMemo3(() => {
    try {
      return ctx?.storage?.get?.("lastSimulatorSessionId", null) || simState.lastSessionId || null;
    } catch {
      return simState.lastSessionId || null;
    }
  }, [ctx, simState.lastSessionId]);
  const handleStart = useCallback8(
    (trackId = null) => {
      startSimulatorChat(host6, {
        trackId,
        storage: ctx?.storage
      });
    },
    [ctx]
  );
  const handleContinue = useCallback8(() => {
    continueSimulatorChat(host6, ctx?.storage);
  }, [ctx]);
  useEffect10(() => {
    if (autoLaunchInFlight) {
      return;
    }
    autoLaunchInFlight = true;
    Promise.resolve(
      startSimulatorChat(host6, {
        storage: ctx?.storage
      })
    ).finally(() => {
      setTimeout(() => {
        autoLaunchInFlight = false;
      }, 300);
    });
  }, [ctx]);
  return /* @__PURE__ */ jsxs7(
    "div",
    {
      "data-testid": "nomad-simulator-page",
      style: {
        padding: "28px 32px",
        maxWidth: 960,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 24
      },
      children: [
        /* @__PURE__ */ jsxs7("header", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
          /* @__PURE__ */ jsxs7("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx8("h1", { style: { fontSize: 24, fontWeight: 700, margin: 0 }, children: "Симулятор ИИ" }),
            /* @__PURE__ */ jsx8(
              "span",
              {
                "data-testid": "simulator-recents-filter-badge",
                style: {
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(16, 185, 129, 0.14)",
                  color: "#10b981",
                  fontWeight: 500
                },
                children: "Служебные сессии скрыты из «Недавних» настройкой"
              }
            )
          ] }),
          /* @__PURE__ */ jsx8("p", { style: { margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }, children: "Учитесь вайбкодингу и управлению агентами вместе с ведущим курса: выберите вашу роль, проходите практические миссии и собирайте рабочие инструменты прямо в чате." })
        ] }),
        /* @__PURE__ */ jsxs7(
          "section",
          {
            style: {
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              padding: "16px 20px",
              borderRadius: 12,
              border: "1px solid rgba(148, 163, 184, 0.22)",
              background: "rgba(15, 23, 42, 0.25)"
            },
            children: [
              /* @__PURE__ */ jsx8(
                "button",
                {
                  type: "button",
                  "data-testid": "simulator-start-btn",
                  onClick: () => handleStart(activeTrack),
                  disabled: simState.status === "starting",
                  style: {
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "#2563eb",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: 14,
                    cursor: "pointer"
                  },
                  children: simState.status === "starting" ? "Запускаем чат с ментором…" : "Начать курс"
                }
              ),
              savedSessionId && /* @__PURE__ */ jsx8(
                "button",
                {
                  type: "button",
                  "data-testid": "simulator-continue-btn",
                  onClick: handleContinue,
                  style: {
                    padding: "10px 18px",
                    borderRadius: 8,
                    border: "1px solid rgba(148, 163, 184, 0.35)",
                    background: "transparent",
                    color: "inherit",
                    fontWeight: 500,
                    fontSize: 14,
                    cursor: "pointer"
                  },
                  children: "Продолжить вашу сессию"
                }
              ),
              /* @__PURE__ */ jsx8("span", { style: { fontSize: 13, opacity: 0.75 }, children: "Откроется диалог с персональным ИИ-ментором, где первый ответ сразу предложит трек и миссию." })
            ]
          }
        ),
        simState.error && /* @__PURE__ */ jsxs7(
          "div",
          {
            role: "status",
            "data-testid": "simulator-error",
            style: {
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid rgba(239, 68, 68, 0.4)",
              background: "rgba(239, 68, 68, 0.1)",
              fontSize: 13
            },
            children: [
              "Не удалось автоматически открыть чат с ментором: ",
              simState.error,
              ". Нажмите «Начать курс», чтобы повторить попытку."
            ]
          }
        ),
        /* @__PURE__ */ jsxs7("section", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsx8("h2", { style: { fontSize: 16, fontWeight: 600, margin: 0 }, children: "Выберите трек под вашу роль (9 направлений)" }),
          /* @__PURE__ */ jsx8(
            "div",
            {
              "data-testid": "simulator-tracks-grid",
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12
              },
              children: SIMULATOR_TRACKS.map((track) => {
                const selected = activeTrack === track.id;
                return /* @__PURE__ */ jsxs7(
                  "button",
                  {
                    type: "button",
                    "data-testid": `simulator-track-${track.id}`,
                    onClick: () => {
                      setActiveTrack(track.id);
                      handleStart(track.id);
                    },
                    style: {
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 10,
                      border: selected ? "1px solid #3b82f6" : "1px solid rgba(148, 163, 184, 0.2)",
                      background: selected ? "rgba(59, 130, 246, 0.12)" : "rgba(15, 23, 42, 0.18)",
                      color: "inherit",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6
                    },
                    children: [
                      /* @__PURE__ */ jsx8("span", { style: { fontSize: 15, fontWeight: 600 }, children: track.label }),
                      /* @__PURE__ */ jsx8("span", { style: { fontSize: 13, opacity: 0.8, lineHeight: 1.4 }, children: track.summary })
                    ]
                  },
                  track.id
                );
              })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs7("section", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsx8("h2", { style: { fontSize: 16, fontWeight: 600, margin: 0 }, children: "Практические сценарии тренажёра" }),
          /* @__PURE__ */ jsx8(
            "div",
            {
              "data-testid": "simulator-scenarios-grid",
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12
              },
              children: SIMULATOR_SCENARIOS.map((scenario) => /* @__PURE__ */ jsxs7(
                "button",
                {
                  type: "button",
                  "data-testid": `simulator-scenario-${scenario.id}`,
                  onClick: () => handleStart(scenario.id),
                  style: {
                    textAlign: "left",
                    padding: "14px 16px",
                    borderRadius: 10,
                    border: "1px solid rgba(148, 163, 184, 0.2)",
                    background: "rgba(15, 23, 42, 0.18)",
                    color: "inherit",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6
                  },
                  children: [
                    /* @__PURE__ */ jsx8("span", { style: { fontSize: 14, fontWeight: 600 }, children: scenario.title }),
                    /* @__PURE__ */ jsx8("span", { style: { fontSize: 13, opacity: 0.8, lineHeight: 1.4 }, children: scenario.description })
                  ]
                },
                scenario.id
              ))
            }
          )
        ] })
      ]
    }
  );
}
function register4(ctx) {
  ctx.register({
    id: "page",
    area: ROUTES_AREA10,
    data: {
      path: SIMULATOR_PATH
    },
    render: () => /* @__PURE__ */ jsx8(SimulatorPage, { ctx })
  });
  ctx.register({
    id: "nav",
    area: SIDEBAR_NAV_AREA5,
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
    area: PALETTE_AREA10,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: "nomad.simulator.open",
      action: "nomad.simulator.open",
      label: SIMULATOR_NAV_LABEL,
      category: "Nomad",
      keywords: ["симулятор", "ментор", "курс", "вайбкодинг", "обучение", "simulator"],
      run: () => {
        if (typeof host6?.navigate === "function") {
          host6.navigate(SIMULATOR_PATH);
        }
        startSimulatorChat(host6, { storage: ctx?.storage });
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
  PALETTE_AREA as PALETTE_AREA11,
  ROUTES_AREA as ROUTES_AREA11,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA6
} from "@hermes/plugin-sdk";
import { createElement as createElement5, useCallback as useCallback9, useEffect as useEffect11, useState as useState12 } from "react";
var SKILLS_ROUTE_PATH = "/nomad-skills";
var SKILLS_NAV_ID = "skills";
var SKILLS_NAV_LABEL = "Навыки Nomad";
var SKILLS_NAV_ORDER = 61;
var SKILLS_UNTRANSLATED_BADGE = "На английском (без перевода)";
var SKILLS_TRANSLATED_BADGE = "Русское описание";
var h5 = createElement5;
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
function restGet3(ctx, path) {
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path));
  }
  return Promise.resolve(null);
}
function restPost3(ctx, path, body) {
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
function NomadSkillsPage({ ctx }) {
  const [activeTab, setActiveTab] = useState12("catalog");
  const [state, setState] = useState12({
    loading: true,
    error: null,
    skills: [],
    categories: [],
    total: 0,
    translatedCount: 0,
    untranslatedCount: 0,
    enabledCount: 0
  });
  const [query, setQuery] = useState12("");
  const [category, setCategory] = useState12("all");
  const [onlyTranslated, setOnlyTranslated] = useState12(false);
  const [onlyEnabled, setOnlyEnabled] = useState12(false);
  const [selectedSkill, setSelectedSkill] = useState12(null);
  const [busyName, setBusyName] = useState12(null);
  const [bundles, setBundles] = useState12([]);
  const [bundleName, setBundleName] = useState12("");
  const [bundleDesc, setBundleDesc] = useState12("");
  const [bundleSkillsInput, setBundleSkillsInput] = useState12("");
  const [bundleBusy, setBundleBusy] = useState12(false);
  const [bundleNotice, setBundleNotice] = useState12("");
  const [archivedSkills, setArchivedSkills] = useState12([]);
  const [pinnedSkills, setPinnedSkills] = useState12([]);
  const [curatorActiveSkills, setCuratorActiveSkills] = useState12([]);
  const [curatorBusy, setCuratorBusy] = useState12(false);
  const [curatorNotice, setCuratorNotice] = useState12("");
  const loadSkills = useCallback9(() => {
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
    return restGet3(ctx, path).then((res) => {
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
  const loadBundles = useCallback9(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet3(ctx, "/skills/bundles").then((res) => {
      if (res && Array.isArray(res.bundles)) {
        setBundles(res.bundles);
      }
      return res;
    }).catch(() => null);
  }, [ctx]);
  const loadCurator = useCallback9(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet3(ctx, "/skills/curator").then((res) => {
      if (!res || typeof res !== "object") return null;
      setArchivedSkills(Array.isArray(res.archived) ? res.archived : []);
      setPinnedSkills(Array.isArray(res.pinned_skills) ? res.pinned_skills : []);
      setCuratorActiveSkills(Array.isArray(res.active_skills) ? res.active_skills : []);
      return res;
    }).catch(() => null);
  }, [ctx]);
  useEffect11(() => {
    loadSkills();
    loadBundles();
    loadCurator();
  }, [loadSkills, loadBundles, loadCurator]);
  const handleToggleSkill = useCallback9(
    (skill) => {
      if (!ctx?.rest || !skill?.name) return Promise.resolve(null);
      const nextEnabled = !skill.enabled;
      setBusyName(skill.name);
      return restPost3(ctx, "/skills/toggle", {
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
  const handlePinSkill = useCallback9(
    (skillName, nextPinned) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice("");
      return restPost3(ctx, "/skills/curator/pin", {
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
  const handleRestoreArchived = useCallback9(
    (skillName) => {
      if (!ctx?.rest || !skillName) return Promise.resolve(null);
      setCuratorBusy(true);
      setCuratorNotice("");
      return restPost3(ctx, "/skills/curator/restore", { name: skillName }).then((res) => {
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
  const handleCreateBundle = useCallback9(
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
      return restPost3(ctx, "/skills/bundles", {
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
  const handleDeleteBundle = useCallback9(
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
  const handleInspectSkill = useCallback9(
    (skill) => {
      if (!ctx?.rest || !skill?.name) {
        setSelectedSkill(skill || null);
        return Promise.resolve(null);
      }
      return restGet3(ctx, `/skills/${encodeURIComponent(skill.name)}`).then((res) => {
        setSelectedSkill(res?.skill || skill);
        return res?.skill || skill;
      }).catch(() => {
        setSelectedSkill(skill);
        return skill;
      });
    },
    [ctx]
  );
  return h5(
    "div",
    {
      className: "nomad-skills-page",
      style: { padding: "24px", maxWidth: "1120px", margin: "0 auto" }
    },
    h5(
      "header",
      { style: { marginBottom: "20px" } },
      h5(
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
        h5(
          "div",
          null,
          h5(
            "h1",
            { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } },
            "Навыки Nomad"
          ),
          h5(
            "p",
            { style: { margin: 0, opacity: 0.78, fontSize: "13px" } },
            "Каталог установленных навыков агента с русскими пользовательскими описаниями, наборами и архивом."
          )
        ),
        h5(
          "div",
          { style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px" } },
          h5(
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
          h5(
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
          h5(
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
      h5(
        "div",
        {
          role: "tablist",
          className: "nomad-skills-tabs",
          style: {
            display: "flex",
            gap: "8px",
            marginTop: "16px",
            borderBottom: "1px solid rgba(128,128,128,0.24)",
            paddingBottom: "8px"
          }
        },
        h5(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "catalog",
            title: "Каталог навыков профиля с русскими описаниями",
            "data-tooltip": "Каталог навыков профиля с русскими описаниями",
            onClick: () => setActiveTab("catalog"),
            style: {
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "catalog" ? "#2563eb" : "rgba(128,128,128,0.12)",
              color: activeTab === "catalog" ? "#ffffff" : "inherit"
            }
          },
          `Каталог (${state.total})`
        ),
        h5(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "bundles",
            title: "Управление наборами навыков (skill-bundles)",
            "data-tooltip": "Управление наборами навыков (skill-bundles)",
            onClick: () => setActiveTab("bundles"),
            style: {
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "bundles" ? "#2563eb" : "rgba(128,128,128,0.12)",
              color: activeTab === "bundles" ? "#ffffff" : "inherit"
            }
          },
          `Наборы (${bundles.length})`
        ),
        h5(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": activeTab === "curator",
            title: "Архив и куратор отключённых навыков",
            "data-tooltip": "Архив и куратор отключённых навыков",
            onClick: () => setActiveTab("curator"),
            style: {
              padding: "6px 14px",
              borderRadius: "6px",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "curator" ? "#2563eb" : "rgba(128,128,128,0.12)",
              color: activeTab === "curator" ? "#ffffff" : "inherit"
            }
          },
          `Архив (${archivedSkills.length})`
        )
      )
    ),
    activeTab === "bundles" ? h5(
      "section",
      {
        className: "nomad-skills-bundles-tab",
        style: { display: "flex", flexDirection: "column", gap: "16px" }
      },
      h5(
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
        h5("h3", { style: { margin: 0, fontSize: "16px" } }, "Создать набор навыков"),
        h5(
          "p",
          { style: { margin: 0, fontSize: "13px", opacity: 0.78 } },
          "Набор объединяет несколько навыков под одной быстрой командой в чате."
        ),
        bundleNotice ? h5("div", { style: { fontSize: "13px", color: "#2563eb" } }, bundleNotice) : null,
        h5("input", {
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
        h5("input", {
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
        h5("input", {
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
        h5(
          "div",
          null,
          h5(
            "button",
            {
              type: "submit",
              disabled: bundleBusy,
              style: {
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 600,
                cursor: "pointer"
              }
            },
            "Сохранить набор"
          )
        )
      ),
      h5(
        "div",
        {
          className: "nomad-bundles-list",
          style: { display: "grid", gap: "10px" }
        },
        bundles.length === 0 ? h5(
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
          (b) => h5(
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
            h5(
              "div",
              null,
              h5(
                "div",
                { style: { fontWeight: 600, fontSize: "15px" } },
                `${b.name} (${b.command || "/" + b.slug})`
              ),
              h5(
                "div",
                { style: { fontSize: "12px", opacity: 0.78, marginTop: "2px" } },
                b.description || ""
              ),
              h5(
                "div",
                { style: { fontSize: "12px", opacity: 0.85, marginTop: "4px" } },
                `Навыки: ${(b.skills || []).join(", ")}`
              )
            ),
            h5(
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
    ) : activeTab === "curator" ? h5(
      "section",
      {
        className: "nomad-skills-curator-tab",
        style: { display: "flex", flexDirection: "column", gap: "16px" }
      },
      curatorNotice ? h5(
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
      h5(
        "div",
        {
          style: {
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(128,128,128,0.24)"
          }
        },
        h5("h3", { style: { margin: "0 0 6px 0", fontSize: "16px" } }, "Архивные навыки"),
        h5(
          "p",
          { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
          "Навыки, перемещённые куратором в архив из-за неактивности. Вы можете в любой момент вернуть любой навык обратно в рабочий каталог."
        ),
        archivedSkills.length === 0 ? h5(
          "div",
          { style: { fontSize: "13px", opacity: 0.72 } },
          "В архиве сейчас нет ни одного навыка."
        ) : h5(
          "div",
          { style: { display: "grid", gap: "10px" } },
          ...archivedSkills.map(
            (arch) => h5(
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
              h5(
                "div",
                null,
                h5("div", { style: { fontWeight: 600, fontSize: "14px" } }, arch.title || arch.name),
                h5("div", { style: { fontSize: "12px", opacity: 0.75 } }, arch.description || "")
              ),
              h5(
                "button",
                {
                  type: "button",
                  disabled: curatorBusy,
                  onClick: () => handleRestoreArchived(arch.name),
                  style: {
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563eb",
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
      h5(
        "div",
        {
          style: {
            padding: "16px",
            borderRadius: "10px",
            border: "1px solid rgba(128,128,128,0.24)"
          }
        },
        h5(
          "h3",
          { style: { margin: "0 0 6px 0", fontSize: "16px" } },
          "Закрепление навыков от автоархивации"
        ),
        h5(
          "p",
          { style: { margin: "0 0 12px 0", fontSize: "13px", opacity: 0.78 } },
          "Закреплённые навыки никогда не переносятся куратором в архив автоматически."
        ),
        h5(
          "div",
          { style: { display: "grid", gap: "8px" } },
          ...(curatorActiveSkills.length > 0 ? curatorActiveSkills : state.skills).map((sk) => {
            const isPinned = Boolean(sk.pinned || pinnedSkills.includes(sk.name));
            return h5(
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
              h5(
                "span",
                { style: { fontSize: "13px", fontWeight: 500 } },
                `${sk.title || sk.name} (${sk.name})`
              ),
              h5(
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
    h5(
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
      h5("input", {
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
      h5(
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
        h5("option", { value: "all" }, "Все категории"),
        ...(state.categories || []).map(
          (cat) => h5(
            "option",
            { key: cat.id, value: cat.id },
            `${cat.label} (${cat.count})`
          )
        )
      ),
      h5(
        "label",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
        h5("input", {
          type: "checkbox",
          checked: onlyTranslated,
          onChange: (e) => setOnlyTranslated(Boolean(e?.target?.checked))
        }),
        "Только с русским описанием"
      ),
      h5(
        "label",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
        h5("input", {
          type: "checkbox",
          checked: onlyEnabled,
          onChange: (e) => setOnlyEnabled(Boolean(e?.target?.checked))
        }),
        "Только включённые"
      )
    ),
    state.error ? h5(
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
    h5(
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
        return h5(
          "article",
          {
            key: skill.name,
            className: `nomad-skill-card ${display.hasRuTranslation ? "is-ru" : "is-en-fallback"}`,
            "data-skill-name": skill.name,
            "data-has-ru": display.hasRuTranslation ? "true" : "false",
            style: {
              padding: "14px 16px",
              borderRadius: "10px",
              border: "1px solid rgba(128,128,128,0.24)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "10px",
              opacity: skill.enabled ? 1 : 0.65
            }
          },
          h5(
            "div",
            null,
            h5(
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
              h5(
                "div",
                null,
                h5(
                  "div",
                  { style: { fontWeight: 600, fontSize: "15px" } },
                  display.title
                ),
                h5(
                  "div",
                  { style: { fontSize: "11px", opacity: 0.65 } },
                  `${skill.name} · ${skill.category_ru || skill.category || "Общие навыки"}`
                )
              ),
              h5(
                "span",
                {
                  className: "nomad-skill-lang-badge",
                  style: {
                    fontSize: "11px",
                    padding: "2px 8px",
                    borderRadius: "999px",
                    whiteSpace: "nowrap",
                    background: display.hasRuTranslation ? "rgba(46,160,67,0.16)" : "rgba(210,153,34,0.20)"
                  }
                },
                display.badge
              )
            ),
            h5(
              "p",
              {
                className: "nomad-skill-description",
                style: { margin: "6px 0 0 0", fontSize: "13px", lineHeight: 1.45 }
              },
              display.description
            ),
            display.languageNote ? h5(
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
            ) : null
          ),
          h5(
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
            h5(
              "button",
              {
                type: "button",
                onClick: () => handleInspectSkill(skill),
                style: {
                  padding: "4px 10px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer"
                }
              },
              "Подробнее"
            ),
            h5(
              "div",
              { style: { display: "flex", gap: "6px" } },
              h5(
                "button",
                {
                  type: "button",
                  disabled: curatorBusy,
                  onClick: () => handlePinSkill(skill.name, !skill.pinned),
                  style: {
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid rgba(128,128,128,0.3)",
                    background: skill.pinned ? "rgba(37,99,235,0.16)" : "transparent",
                    color: "inherit",
                    cursor: "pointer"
                  }
                },
                skill.pinned ? "Закреплён" : "Закрепить"
              ),
              h5(
                "button",
                {
                  type: "button",
                  disabled: busyName === skill.name,
                  onClick: () => handleToggleSkill(skill),
                  style: {
                    padding: "4px 10px",
                    fontSize: "12px",
                    borderRadius: "6px",
                    border: "1px solid rgba(128,128,128,0.3)",
                    background: skill.enabled ? "rgba(46,160,67,0.16)" : "transparent",
                    color: "inherit",
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
    selectedSkill ? h5(
      "aside",
      {
        className: "nomad-skill-detail-modal",
        style: {
          marginTop: "20px",
          padding: "16px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.3)"
        }
      },
      h5(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
        h5("strong", null, `${selectedSkill.title || selectedSkill.name} (${selectedSkill.name})`),
        h5(
          "button",
          {
            type: "button",
            onClick: () => setSelectedSkill(null),
            style: { cursor: "pointer", background: "transparent", border: "none", color: "inherit" }
          },
          "Закрыть"
        )
      ),
      h5("p", { style: { fontSize: "13px" } }, selectedSkill.user_description || selectedSkill.description),
      selectedSkill.description_en && selectedSkill.has_ru_translation ? h5(
        "p",
        { style: { fontSize: "12px", opacity: 0.7 } },
        `Оригинальное описание (EN): ${selectedSkill.description_en}`
      ) : null
    ) : null
  );
}
function registerSkills(ctx) {
  if (!ctx || typeof ctx.register !== "function") return;
  const renderPage = (props) => createElement5(NomadSkillsPage, { ctx, ...props || {} });
  ctx.register({
    id: "page",
    area: ROUTES_AREA11,
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
    area: SIDEBAR_NAV_AREA6,
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
    area: PALETTE_AREA11,
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
import { PALETTE_AREA as PALETTE_AREA12 } from "@hermes/plugin-sdk";
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
    area: PALETTE_AREA12,
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
  PALETTE_AREA as PALETTE_AREA13,
  ROUTES_AREA as ROUTES_AREA12,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA7
} from "@hermes/plugin-sdk";
import { createElement as createElement6, useCallback as useCallback10, useEffect as useEffect12, useState as useState13 } from "react";
var START_ROUTE_PATH = "/nomad-start";
var START_NAV_ID = "start";
var START_NAV_LABEL = "Перенос и старт";
var START_NAV_ORDER = 64;
var KEYS_WARNING_TEXT = "Ключи не переносятся: все переменные *_API_KEY, *_SECRET, *_TOKEN и пароли автоматически исключаются и не попадают в .env профиля.";
var h6 = createElement6;
var _navStateByCtx = /* @__PURE__ */ new WeakMap();
function restGet4(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
  }
  return Promise.resolve(null);
}
function restPost4(ctx, path, body) {
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
      ctx.unregister(SIDEBAR_NAV_AREA7, START_NAV_ID);
    } catch (_e) {
    }
  }
  const areasContainer = ctx._areas || ctx.areas || null;
  if (areasContainer) {
    const arr = typeof areasContainer.get === "function" ? areasContainer.get(SIDEBAR_NAV_AREA7) : areasContainer[SIDEBAR_NAV_AREA7];
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
  const [agent, setAgent] = useState13("claude-code");
  const [sourceDir, setSourceDir] = useState13("~/.claude");
  const [overwrite, setOverwrite] = useState13(false);
  const [previewLoading, setPreviewLoading] = useState13(false);
  const [previewData, setPreviewData] = useState13(null);
  const [importLoading, setImportLoading] = useState13(false);
  const [importResult, setImportResult] = useState13(null);
  const [error, setError] = useState13(null);
  const [checklist, setChecklist] = useState13({
    items: [],
    completed_count: 0,
    total_count: 4,
    completed: false,
    hide_menu_item: false
  });
  const syncChecklistState = useCallback10(
    (nextChecklist) => {
      if (!nextChecklist || typeof nextChecklist !== "object") return;
      setChecklist(nextChecklist);
      const complete = isStartChecklistComplete(nextChecklist);
      setStartMenuHidden(ctx, complete);
    },
    [ctx]
  );
  const loadStartStatus = useCallback10(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restGet4(ctx, "/start").then((res) => {
      if (res?.checklist) {
        syncChecklistState(res.checklist);
      }
      return res;
    }).catch(() => null);
  }, [ctx, syncChecklistState]);
  useEffect12(() => {
    loadStartStatus();
  }, [loadStartStatus]);
  const handleAgentChange = useCallback10((nextAgent) => {
    setAgent(nextAgent);
    setSourceDir(nextAgent === "codex" ? "~/.codex" : "~/.claude");
    setPreviewData(null);
    setImportResult(null);
  }, []);
  const handlePreview = useCallback10(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setPreviewLoading(true);
    setError(null);
    return restPost4(ctx, "/start/preview", {
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
  const handleExecuteImport = useCallback10(() => {
    if (!ctx?.rest || !sourceDir.trim()) return Promise.resolve(null);
    setImportLoading(true);
    setError(null);
    return restPost4(ctx, "/start/import", {
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
  const handleToggleChecklistItem = useCallback10(
    (item) => {
      if (!ctx?.rest || !item?.id) return Promise.resolve(null);
      return restPost4(ctx, "/start/checklist", {
        item_id: item.id,
        done: !item.done
      }).then((res) => {
        syncChecklistState(res);
        return res;
      }).catch(() => null);
    },
    [ctx, syncChecklistState]
  );
  const handleCompleteAllChecklist = useCallback10(() => {
    if (!ctx?.rest) return Promise.resolve(null);
    return restPost4(ctx, "/start/checklist", {
      complete_all: true
    }).then((res) => {
      syncChecklistState(res);
      return res;
    }).catch(() => null);
  }, [ctx, syncChecklistState]);
  const discovered = previewData?.discovered || {};
  return h6(
    "div",
    {
      className: "nomad-start-page",
      style: { padding: "24px", maxWidth: "1080px", margin: "0 auto" }
    },
    h6(
      "header",
      { style: { marginBottom: "20px" } },
      h6(
        "h1",
        { style: { fontSize: "22px", fontWeight: 600, margin: "0 0 6px 0" } },
        "Перенос и старт"
      ),
      h6(
        "p",
        { style: { margin: 0, opacity: 0.78, fontSize: "13px" } },
        "Быстрый старт первого дня и перенос инструкций, разрешений, навыков и MCP-серверов из Claude Code или Codex CLI."
      )
    ),
    h6(
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
    error ? h6(
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
    h6(
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
      h6(
        "h2",
        { style: { fontSize: "16px", margin: "0 0 12px 0" } },
        "Перенести из Claude Code / Codex CLI"
      ),
      h6(
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
        h6(
          "select",
          {
            value: agent,
            onChange: (e) => handleAgentChange(e?.target?.value || "claude-code"),
            style: {
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(128,128,128,0.3)",
              background: "transparent",
              color: "inherit"
            }
          },
          h6("option", { value: "claude-code" }, "Claude Code (~/.claude)"),
          h6("option", { value: "codex" }, "Codex CLI (~/.codex)")
        ),
        h6("input", {
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
        h6(
          "label",
          { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px" } },
          h6("input", {
            type: "checkbox",
            checked: overwrite,
            onChange: (e) => setOverwrite(Boolean(e?.target?.checked))
          }),
          "Перезаписывать одноимённые навыки"
        )
      ),
      h6(
        "div",
        { style: { display: "flex", gap: "10px", marginBottom: "14px" } },
        h6(
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
        h6(
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
      previewData ? h6(
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
        h6(
          "div",
          { style: { fontWeight: 600, fontSize: "13px", marginBottom: "8px" } },
          `Превью переноса (${previewData.agent_label || previewData.agent}) — ключи не переносятся:`
        ),
        h6(
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
        h6(
          "div",
          { style: { fontSize: "12px", opacity: 0.85 } },
          `Навыки к переносу: ${(discovered.skill_names || []).join(", ") || "нет"} · MCP-серверы: ${(discovered.mcp_server_names || []).join(", ") || "нет"} · Отфильтровано секретов: ${(discovered.filtered_secret_keys || []).length}`
        )
      ) : null,
      importResult ? h6(
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
    h6(
      "section",
      {
        className: "nomad-start-checklist-card",
        style: {
          padding: "18px",
          borderRadius: "10px",
          border: "1px solid rgba(128,128,128,0.25)"
        }
      },
      h6(
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
        h6(
          "div",
          null,
          h6("h2", { style: { fontSize: "16px", margin: "0 0 4px 0" } }, "Чек-лист первого дня"),
          h6(
            "p",
            { style: { margin: 0, fontSize: "12px", opacity: 0.75 } },
            `Выполнено: ${checklist.completed_count || 0} из ${checklist.total_count || 0}. После прохождения всех пунктов строка «Перенос и старт» скрывается из бокового меню.`
          )
        ),
        !checklist.completed ? h6(
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
        ) : h6(
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
      h6(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "10px" } },
        ...(checklist.items || []).map(
          (item) => h6(
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
            h6(
              "label",
              { style: { display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" } },
              h6("input", {
                type: "checkbox",
                checked: Boolean(item.done),
                onChange: () => handleToggleChecklistItem(item),
                style: { marginTop: "3px" }
              }),
              h6(
                "div",
                null,
                h6(
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
                h6(
                  "div",
                  { style: { fontSize: "12px", opacity: 0.75, marginTop: "2px" } },
                  item.description
                )
              )
            ),
            item.target_path ? h6(
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
    area: SIDEBAR_NAV_AREA7,
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
    area: ROUTES_AREA12,
    order: START_NAV_ORDER,
    path: START_ROUTE_PATH,
    title: START_NAV_LABEL,
    data: {
      path: START_ROUTE_PATH,
      title: START_NAV_LABEL,
      codicon: "rocket"
    },
    render: (props) => createElement6(NomadStartPage, { ctx, ...props || {} })
  });
  if (ctx?.rest) {
    restGet4(ctx, "/start/checklist").then((res) => {
      if (res && isStartChecklistComplete(res)) {
        setStartMenuHidden(ctx, true);
      }
    }).catch(() => {
    });
  }
  ctx.register({
    id: "palette-open",
    area: PALETTE_AREA13,
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

// statusbar-balance.js
var statusbar_balance_exports = {};
__export(statusbar_balance_exports, {
  StatusbarBalance: () => StatusbarBalance,
  default: () => registerStatusbarBalance,
  formatBalanceValue: () => formatBalanceValue
});
import { STATUSBAR_AREAS as STATUSBAR_AREAS3 } from "@hermes/plugin-sdk";
import { useEffect as useEffect13, useState as useState14 } from "react";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
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
function StatusbarBalance({ ctx, host: host9 }) {
  const [state, setState] = useState14({ status: "loading", data: null, error: null });
  useEffect13(() => {
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
  const handleClick = () => {
    if (host9 && typeof host9.navigate === "function") {
      host9.navigate("/nomad-accounts");
    }
  };
  return /* @__PURE__ */ jsxs8(
    "button",
    {
      type: "button",
      onClick: handleClick,
      "data-testid": "nomad-statusbar-balance",
      title: balanceText !== null ? `NomadNet balance: ${balanceText}${currency ? " " + currency : ""}` : `NomadNet: ${code || "loading"}`,
      className: "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
      children: [
        /* @__PURE__ */ jsx9("span", { className: "font-medium", children: "NomadNet" }),
        state.status === "loading" && /* @__PURE__ */ jsx9("span", { "data-testid": "nomad-balance-loading", children: "…" }),
        state.status !== "loading" && balanceText !== null && /* @__PURE__ */ jsx9("span", { "data-testid": "nomad-balance-value", className: "font-mono font-semibold text-foreground", children: balanceText }),
        state.status !== "loading" && balanceText !== null && currency && /* @__PURE__ */ jsx9("span", { "data-testid": "nomad-balance-currency", className: "text-[10px] opacity-80", children: currency }),
        state.status !== "loading" && balanceText === null && /* @__PURE__ */ jsx9("span", { "data-testid": "nomad-balance-status", className: "font-mono text-[10px] opacity-75", children: code || "disconnected" })
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
    render: (host9) => /* @__PURE__ */ jsx9(StatusbarBalance, { ctx, host: host9 })
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
  PALETTE_AREA as PALETTE_AREA14,
  ROUTES_AREA as ROUTES_AREA13,
  STATUSBAR_AREAS as STATUSBAR_AREAS4,
  atom as atom5,
  useValue as useValue3
} from "@hermes/plugin-sdk";
import { createElement as createElement7, useCallback as useCallback11, useEffect as useEffect14, useState as useState15 } from "react";
var SWARM_ROUTE_PATH = "/nomad-swarm";
var swarmStatusAtom = atom5({ count: 0, activeId: null, label: "Рой: 0" });
var h7 = createElement7;
function restGet5(ctx, path) {
  if (typeof ctx?.rest === "function") {
    return Promise.resolve(ctx.rest(path, { method: "GET" }));
  }
  if (typeof ctx?.rest?.get === "function") {
    return Promise.resolve(ctx.rest.get(path));
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
  const handleClick = useCallback11(() => {
    if (ctx && ctx.host && typeof ctx.host.navigate === "function") {
      ctx.host.navigate(SWARM_ROUTE_PATH);
    }
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
                background: node.status === "completed" ? "#10b981" : "#3b82f6"
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
  const [data, setData] = useState15({ loading: true, error: null, swarms: [], lanes: [], tree: [] });
  const loadSwarmData = useCallback11(async () => {
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
  useEffect14(() => {
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
    area: ROUTES_AREA13,
    order: 70,
    path: SWARM_ROUTE_PATH,
    title: "Рой",
    data: {
      id: "nomad.swarm.route",
      path: SWARM_ROUTE_PATH,
      title: "Рой",
      codicon: "organization"
    },
    render: () => h7(SwarmPage, { ctx })
  });
  ctx.register({
    id: "palette",
    area: PALETTE_AREA14,
    order: 70,
    data: {
      id: "nomad.swarm.open",
      action: "nomad.swarm.open",
      label: "Рой оркестратора Nomad",
      category: "Nomad",
      keywords: ["рой", "оркестратор", "дирижёр", "задачи", "дерево", "swarm", "lanes"],
      run: () => {
        if (ctx?.host?.navigate) {
          ctx.host.navigate(SWARM_ROUTE_PATH);
        }
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
import { PALETTE_AREA as PALETTE_AREA15, atom as atom6, host as host7 } from "@hermes/plugin-sdk";
import { createElement as createElement8, useCallback as useCallback12, useEffect as useEffect15, useState as useState16 } from "react";
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
  if (host7 && typeof host7.notify === "function") {
    host7.notify(`Nomad: ${switchData.title}`);
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
  const [data, setData] = useState16(payload || activeSwitchCardAtom.get());
  useEffect15(() => {
    const unbind = activeSwitchCardAtom.subscribe((val) => {
      if (val) setData(val);
    });
    return () => unbind();
  }, []);
  const handleDismiss = useCallback12(() => {
    clearSwitchCard();
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  }, [onDismiss]);
  const handleOpenAccounts = useCallback12(() => {
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
            background: "var(--primary, #2563eb)",
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
      area: PALETTE_AREA15,
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
  DEFAULT_NOMAD_THEME: () => DEFAULT_NOMAD_THEME,
  NOMAD_THEMES: () => NOMAD_THEMES,
  default: () => registerThemes
});
import { THEMES_AREA } from "@hermes/plugin-sdk";
var DEFAULT_NOMAD_THEME = "nomad-dark";
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
var NOMAD_THEMES = [
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
function registerThemes(ctx) {
  if (!ctx || typeof ctx.register !== "function") {
    return;
  }
  for (const theme of NOMAD_THEMES) {
    ctx.register({
      id: theme.name,
      area: THEMES_AREA,
      data: theme
    });
  }
}

// tooltips.js
var tooltips_exports = {};
__export(tooltips_exports, {
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
    addAccount: "Подключить новый аккаунт или API-ключ"
  },
  skills: {
    catalogTab: "Каталог навыков профиля с русскими описаниями",
    bundlesTab: "Управление наборами навыков (skill-bundles)",
    archiveTab: "Архив и куратор отключённых навыков",
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
    addRule: "Добавить правило в список безопасности"
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
function tooltipAttrs(text) {
  if (!text) return {};
  return {
    title: text,
    "data-tooltip": text
  };
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
import { PALETTE_AREA as PALETTE_AREA16, atom as atom7, host as host8 } from "@hermes/plugin-sdk";
import { createElement as createElement9, useCallback as useCallback13, useEffect as useEffect16, useState as useState17 } from "react";
var DEFAULT_TOPUP_URL = "https://nomadnet.ru/cabinet/billing";
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
  if (host8 && typeof host8.notify === "function") {
    host8.notify("NomadNet: баланс исчерпан, требуется пополнение");
  }
  return blockData;
}
function clearBillingBlock() {
  activeTopupBlockAtom.set(null);
}
function TopupCard({ ctx, payload = null, onDismiss = null }) {
  const [data, setData] = useState17(payload || activeTopupBlockAtom.get());
  const [checking, setChecking] = useState17(false);
  const [checkStatus, setCheckStatus] = useState17("");
  const [resolved, setResolved] = useState17(false);
  useEffect16(() => {
    const unbind = activeTopupBlockAtom.subscribe((val) => {
      if (val) setData(val);
    });
    return () => unbind();
  }, []);
  const topupUrl = data && data.topupUrl || DEFAULT_TOPUP_URL;
  const handlePayClick = useCallback13(() => {
    openExternalUrl(ctx, topupUrl);
    setCheckStatus("Открыта страница оплаты. После завершения платежа нажмите «Обновить баланс».");
  }, [ctx, topupUrl]);
  const handleRefreshClick = useCallback13(async () => {
    setChecking(true);
    setCheckStatus("Проверяем поступление средств…");
    try {
      const acc = await fetchUpdatedAccount(ctx);
      const nomads = acc && acc.balance && acc.balance.nomads !== void 0 ? Number(acc.balance.nomads) : Number(acc && acc.nomads) || 0;
      if (nomads > 0) {
        setResolved(true);
        setCheckStatus(`Баланс успешно пополнен: ${nomads.toLocaleString("ru-RU")} номадов. Блокировка снята.`);
        clearBillingBlock();
        if (host8 && typeof host8.notify === "function") {
          host8.notify(`Баланс пополнен: ${nomads} номадов`);
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
            background: "var(--primary, #2563eb)",
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
    area: PALETTE_AREA16,
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
  ["billing.js", billing_exports],
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
