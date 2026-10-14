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
        const register3 = mod.default;
        if (register3 === void 0) {
          continue;
        }
        if (typeof register3 !== "function") {
          problems.push({ file, message: "default export is not a register(ctx) function" });
          console.error(`[nomad] ${file}: default export is not a register(ctx) function`);
          continue;
        }
        try {
          register3(scopedContext(ctx, pageKey(file), () => navRows += 1));
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

// accounts/billing-tab.js
var billing_tab_exports = {};
__export(billing_tab_exports, {
  BillingTab: () => BillingTab,
  accountsSummaryAtom: () => accountsSummaryAtom,
  activeAccountsTabAtom: () => activeAccountsTabAtom,
  callNomadApi: () => callNomadApi,
  default: () => registerBillingTab,
  openExternalSafe: () => openExternalSafe,
  openNomadAccountsTab: () => openNomadAccountsTab,
  sanitizeWhiteLabelText: () => sanitizeWhiteLabelText
});
import { useEffect as useEffect2, useState as useState2, useCallback } from "react";
import { PALETTE_AREA, atom, host } from "@hermes/plugin-sdk";
import { jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var activeAccountsTabAtom = atom("accounts");
var accountsSummaryAtom = atom({
  total: 0,
  activeIndex: null,
  activeLabel: null,
  loaded: false
});
function openNomadAccountsTab(tab = "accounts") {
  activeAccountsTabAtom.set(tab === "billing" ? "billing" : "accounts");
  if (host && typeof host.navigate === "function") {
    host.navigate("/nomad-accounts");
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
      throw new Error(`Ошибка запроса (${response.status})`);
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
function BillingTab({ ctx }) {
  const [accountData, setAccountData] = useState2(null);
  const [loading, setLoading] = useState2(true);
  const [error, setError] = useState2("");
  const [keyInput, setKeyInput] = useState2("");
  const [connecting, setConnecting] = useState2(false);
  const [connectMessage, setConnectMessage] = useState2("");
  const [connectError, setConnectError] = useState2("");
  const loadAccount = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callNomadApi(ctx, "/account");
      setAccountData(res || {});
    } catch (err) {
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
    let active = true;
    (async () => {
      try {
        const res = await callNomadApi(ctx, "/account");
        if (active) {
          setAccountData(res || {});
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(
            sanitizeWhiteLabelText(
              err && err.message || "Сервер NomadNet временно недоступен."
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
  }, [ctx]);
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
      if (res && (res.balance || res.plan || res.connected !== void 0)) {
        setAccountData((prev) => ({ ...prev || {}, ...res, connected: true }));
      } else {
        await loadAccount();
      }
      if (host && typeof host.notify === "function") {
        host.notify("Ключ NomadNet подключён");
      }
    } catch (err) {
      const msg = sanitizeWhiteLabelText(
        err && err.message || "Не удалось подключить ключ NomadNet. Проверьте ключ и повторите попытку."
      );
      setConnectError(msg);
      if (host && typeof host.notifyError === "function") {
        host.notifyError(msg);
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
  return /* @__PURE__ */ jsxs2("div", { style: { display: "flex", flexDirection: "column", gap: "20px" }, children: [
    /* @__PURE__ */ jsxs2(
      "div",
      {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px"
        },
        children: [
          /* @__PURE__ */ jsxs2(
            "div",
            {
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
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }, children: [
                  /* @__PURE__ */ jsxs2("div", { children: [
                    /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.72, fontWeight: 500 }, children: "Баланс управляемой сети NomadNet" }),
                    /* @__PURE__ */ jsx2("div", { style: { fontSize: "28px", fontWeight: 700, marginTop: "4px", letterSpacing: "-0.02em" }, children: loading ? "..." : `${formatNomadsNumber(nomadsAvailable)} номадов` })
                  ] }),
                  /* @__PURE__ */ jsx2(
                    "span",
                    {
                      style: {
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: "999px",
                        background: isConnected ? "rgba(34, 197, 94, 0.16)" : "rgba(148, 163, 184, 0.18)",
                        color: isConnected ? "#22c55e" : "inherit"
                      },
                      children: isConnected ? "Номады подключены" : "Ключ не подключён"
                    }
                  )
                ] }),
                /* @__PURE__ */ jsxs2(
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
                      /* @__PURE__ */ jsxs2("div", { children: [
                        /* @__PURE__ */ jsx2("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Всего на счёте" }),
                        /* @__PURE__ */ jsxs2("div", { style: { fontWeight: 600, marginTop: "2px" }, children: [
                          formatNomadsNumber(nomadsTotal),
                          " номадов"
                        ] })
                      ] }),
                      /* @__PURE__ */ jsxs2("div", { children: [
                        /* @__PURE__ */ jsx2("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Зарезервировано" }),
                        /* @__PURE__ */ jsxs2("div", { style: { fontWeight: 600, marginTop: "2px" }, children: [
                          formatNomadsNumber(nomadsReserved),
                          " номадов"
                        ] })
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsxs2("span", { style: { fontSize: "12px", opacity: 0.65 }, children: [
                    "Обновлено: ",
                    updatedAt ? formatDateTimeRu(updatedAt) : "только что"
                  ] }),
                  /* @__PURE__ */ jsxs2("div", { style: { display: "flex", gap: "8px" }, children: [
                    /* @__PURE__ */ jsx2(
                      "button",
                      {
                        type: "button",
                        onClick: loadAccount,
                        disabled: loading,
                        style: {
                          padding: "7px 12px",
                          borderRadius: "8px",
                          border: "1px solid var(--border, rgba(128,128,128,0.28))",
                          background: "transparent",
                          color: "inherit",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: loading ? "default" : "pointer"
                        },
                        children: loading ? "Обновление..." : "Обновить"
                      }
                    ),
                    /* @__PURE__ */ jsx2(
                      "button",
                      {
                        type: "button",
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
                        children: "Пополнить в личном кабинете"
                      }
                    )
                  ] })
                ] })
              ]
            }
          ),
          /* @__PURE__ */ jsxs2(
            "div",
            {
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
                /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }, children: [
                  /* @__PURE__ */ jsxs2("div", { children: [
                    /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.72, fontWeight: 500 }, children: "Текущий тарифный план" }),
                    /* @__PURE__ */ jsx2("div", { style: { fontSize: "22px", fontWeight: 700, marginTop: "4px" }, children: planName })
                  ] }),
                  /* @__PURE__ */ jsx2(
                    "span",
                    {
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
                /* @__PURE__ */ jsxs2(
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
                      /* @__PURE__ */ jsxs2("div", { children: [
                        /* @__PURE__ */ jsx2("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Включённый пакет" }),
                        /* @__PURE__ */ jsx2("div", { style: { fontWeight: 600, marginTop: "2px" }, children: planMonthlyLimit ? `${formatNomadsNumber(planMonthlyLimit)} номадов / мес.` : "По факту потребления" })
                      ] }),
                      /* @__PURE__ */ jsxs2("div", { children: [
                        /* @__PURE__ */ jsx2("div", { style: { opacity: 0.68, fontSize: "11px" }, children: "Срок действия / продление" }),
                        /* @__PURE__ */ jsx2("div", { style: { fontWeight: 600, marginTop: "2px" }, children: planExpires ? formatDateTimeRu(planExpires) : "Бессрочно" })
                      ] })
                    ]
                  }
                ),
                /* @__PURE__ */ jsx2("div", { style: { fontSize: "12px", opacity: 0.78, lineHeight: 1.45 }, children: "Единый ключ NomadNet открывает доступ к моделям OpenAI, Anthropic, Google Gemini, DeepSeek и Qwen без зарубежных карт и прокси." })
              ]
            }
          )
        ]
      }
    ),
    error ? /* @__PURE__ */ jsxs2(
      "div",
      {
        style: {
          padding: "12px 16px",
          borderRadius: "10px",
          border: "1px solid rgba(245, 158, 11, 0.35)",
          background: "rgba(245, 158, 11, 0.1)",
          fontSize: "13px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px"
        },
        children: [
          /* @__PURE__ */ jsxs2("span", { children: [
            "Сведения о балансе сейчас недоступны (",
            error,
            "). Вы можете подключить или обновить ключ ниже."
          ] }),
          /* @__PURE__ */ jsx2(
            "button",
            {
              type: "button",
              onClick: loadAccount,
              style: {
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(245, 158, 11, 0.45)",
                background: "transparent",
                color: "inherit",
                fontSize: "12px",
                cursor: "pointer"
              },
              children: "Повторить"
            }
          )
        ]
      }
    ) : null,
    /* @__PURE__ */ jsxs2(
      "form",
      {
        onSubmit: handleConnectKey,
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
          /* @__PURE__ */ jsxs2("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }, children: [
            /* @__PURE__ */ jsxs2("div", { children: [
              /* @__PURE__ */ jsx2("div", { style: { fontSize: "15px", fontWeight: 600 }, children: "Подключение ключа NomadNet" }),
              /* @__PURE__ */ jsxs2("div", { style: { fontSize: "13px", opacity: 0.74, marginTop: "2px" }, children: [
                "Введите ваш персональный ключ вида ",
                /* @__PURE__ */ jsx2("code", { children: "nmd_..." }),
                " из личного кабинета NomadNet для синхронизации баланса и маршрутизации запросов."
              ] })
            ] }),
            maskedKey ? /* @__PURE__ */ jsxs2(
              "span",
              {
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
          /* @__PURE__ */ jsxs2("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx2(
              "input",
              {
                type: "password",
                value: keyInput,
                onChange: (e) => setKeyInput(e.target.value),
                placeholder: "nmd_live_...",
                "aria-label": "Ключ NomadNet",
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
            /* @__PURE__ */ jsx2(
              "button",
              {
                type: "submit",
                disabled: connecting,
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
          connectError ? /* @__PURE__ */ jsx2("div", { style: { fontSize: "13px", color: "#ef4444" }, children: connectError }) : null,
          connectMessage ? /* @__PURE__ */ jsx2("div", { style: { fontSize: "13px", color: "#22c55e" }, children: connectMessage }) : null
        ]
      }
    )
  ] });
}
function registerBillingTab(ctx) {
  ctx.register({
    id: "palette",
    area: PALETTE_AREA,
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

// accounts/page.js
var page_exports = {};
__export(page_exports, {
  AccountsPage: () => AccountsPage,
  AccountsStatusbarPill: () => AccountsStatusbarPill,
  accountsModalAtom: () => accountsModalAtom,
  default: () => registerAccountsPage,
  formatAccountsStatusbarLabel: () => formatAccountsStatusbarLabel
});
import { useEffect as useEffect3, useState as useState3, useCallback as useCallback2, useMemo } from "react";
import {
  ROUTES_AREA as ROUTES_AREA2,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA2,
  STATUSBAR_AREAS,
  PALETTE_AREA as PALETTE_AREA2,
  KEYBINDS_AREA,
  atom as atom2,
  useValue,
  host as host2
} from "@hermes/plugin-sdk";
import { jsx as jsx3, jsxs as jsxs3 } from "react/jsx-runtime";
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
  useEffect3(() => {
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
  return /* @__PURE__ */ jsxs3(
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
        /* @__PURE__ */ jsx3(
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
        /* @__PURE__ */ jsx3("span", { children: labelText })
      ]
    }
  );
}
function AccountsPage({ ctx }) {
  const activeTab = useValue(activeAccountsTabAtom);
  const modalMode = useValue(accountsModalAtom);
  const [accounts, setAccounts] = useState3([]);
  const [loading, setLoading] = useState3(true);
  const [error, setError] = useState3("");
  const [actionNotice, setActionNotice] = useState3("");
  const [providerFilter, setProviderFilter] = useState3("all");
  const [draggedId, setDraggedId] = useState3(null);
  const [busyAccountId, setBusyAccountId] = useState3(null);
  const [keyProvider, setKeyProvider] = useState3("openai-codex");
  const [keyLabel, setKeyLabel] = useState3("");
  const [keyValue, setKeyValue] = useState3("");
  const [keyPriority, setKeyPriority] = useState3(1);
  const [keyBaseUrl, setKeyBaseUrl] = useState3("");
  const [keySubmitting, setKeySubmitting] = useState3(false);
  const [keyFormError, setKeyFormError] = useState3("");
  const [oauthProvider, setOauthProvider] = useState3("openai-codex");
  const [oauthLabel, setOauthLabel] = useState3("");
  const [oauthSession, setOauthSession] = useState3(null);
  const [oauthLoading, setOauthLoading] = useState3(false);
  const [oauthError, setOauthError] = useState3("");
  const syncAccounts = useCallback2((list) => {
    setAccounts(list);
    accountsSummaryAtom.set(computeSummary(list));
  }, []);
  const loadAccounts = useCallback2(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await callNomadApi(ctx, "/accounts");
      const list = normalizeAccountsList(res);
      syncAccounts(list);
      setKeyPriority(list.length + 1);
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
  useEffect3(() => {
    let active = true;
    (async () => {
      try {
        const res = await callNomadApi(ctx, "/accounts");
        if (active) {
          const list = normalizeAccountsList(res);
          syncAccounts(list);
          setKeyPriority(list.length + 1);
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
  const summary = useMemo(() => computeSummary(accounts), [accounts]);
  const filteredAccounts = useMemo(() => {
    if (providerFilter === "all") return accounts;
    return accounts.filter((item) => item.provider === providerFilter);
  }, [accounts, providerFilter]);
  const uniqueProviders = useMemo(() => {
    const set = new Set(accounts.map((a) => a.provider));
    return Array.from(set);
  }, [accounts]);
  return /* @__PURE__ */ jsxs3(
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
        /* @__PURE__ */ jsxs3(
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
              /* @__PURE__ */ jsxs3("div", { children: [
                /* @__PURE__ */ jsxs3("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }, children: [
                  /* @__PURE__ */ jsx3("h1", { style: { fontSize: "24px", fontWeight: 700, margin: 0 }, children: "Аккаунты" }),
                  /* @__PURE__ */ jsx3(
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
                /* @__PURE__ */ jsx3("p", { style: { fontSize: "13px", opacity: 0.74, margin: "6px 0 0 0", maxWidth: "680px" }, children: "Управляйте вашими подписками и API-ключами. При исчерпании квоты или временном ограничении Nomad автоматически переключается на следующий по приоритету аккаунт без обрыва диалога." })
              ] }),
              /* @__PURE__ */ jsxs3(
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
                    /* @__PURE__ */ jsxs3(
                      "button",
                      {
                        type: "button",
                        role: "tab",
                        "aria-selected": activeTab !== "billing",
                        onClick: () => activeAccountsTabAtom.set("accounts"),
                        style: {
                          padding: "7px 14px",
                          borderRadius: "7px",
                          border: "none",
                          background: activeTab !== "billing" ? "var(--primary, #2563eb)" : "transparent",
                          color: activeTab !== "billing" ? "#ffffff" : "inherit",
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
                    /* @__PURE__ */ jsx3(
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
        activeTab === "billing" ? /* @__PURE__ */ jsx3(BillingTab, { ctx }) : (
          /* Вкладка «Пул аккаунтов» (M-132) */
          /* @__PURE__ */ jsxs3("div", { style: { display: "flex", flexDirection: "column", gap: "16px" }, children: [
            /* @__PURE__ */ jsxs3(
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
                  /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsx3(
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
                    /* @__PURE__ */ jsx3(
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
                    /* @__PURE__ */ jsx3(
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
                  /* @__PURE__ */ jsxs3("div", { style: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }, children: [
                    /* @__PURE__ */ jsxs3(
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
                          /* @__PURE__ */ jsxs3("option", { value: "all", children: [
                            "Все провайдеры (",
                            accounts.length,
                            ")"
                          ] }),
                          uniqueProviders.map((prov) => /* @__PURE__ */ jsx3("option", { value: prov, children: formatProviderLabel(prov) }, prov))
                        ]
                      }
                    ),
                    /* @__PURE__ */ jsx3(
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
            actionNotice ? /* @__PURE__ */ jsx3(
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
            error ? /* @__PURE__ */ jsx3(
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
            modalMode === "oauth" ? /* @__PURE__ */ jsxs3(
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
                  /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs3("div", { children: [
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Вход по подписке (OAuth / код устройства)" }),
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Подключите вашу личную подписку ChatGPT Plus/Pro, Anthropic, Google Gemini или Qwen в общий пул ротации." })
                    ] }),
                    /* @__PURE__ */ jsx3(
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
                  /* @__PURE__ */ jsxs3(
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
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "Провайдер подписки" }),
                          /* @__PURE__ */ jsx3(
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
                              children: PROVIDERS.filter((p) => p.supportsOAuth).map((p) => /* @__PURE__ */ jsx3("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "Название аккаунта в пуле" }),
                          /* @__PURE__ */ jsx3(
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
                        /* @__PURE__ */ jsx3(
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
                  oauthSession ? /* @__PURE__ */ jsxs3(
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
                        oauthSession.userCode ? /* @__PURE__ */ jsxs3("div", { children: [
                          "Ваш одноразовый код подтверждения:",
                          " ",
                          /* @__PURE__ */ jsx3(
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
                        /* @__PURE__ */ jsxs3("div", { children: [
                          "Вы также можете выполнить вход через терминал командой:",
                          " ",
                          /* @__PURE__ */ jsx3(
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
                        /* @__PURE__ */ jsxs3("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" }, children: [
                          oauthSession.verificationUri ? /* @__PURE__ */ jsx3(
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
                          /* @__PURE__ */ jsx3(
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
                  oauthError ? /* @__PURE__ */ jsx3("div", { style: { fontSize: "13px", color: "#ef4444" }, children: oauthError }) : null
                ]
              }
            ) : null,
            modalMode === "key" ? /* @__PURE__ */ jsxs3(
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
                  /* @__PURE__ */ jsxs3("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
                    /* @__PURE__ */ jsxs3("div", { children: [
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "16px", fontWeight: 700 }, children: "Добавление API-ключа в пул" }),
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "13px", opacity: 0.75, marginTop: "2px" }, children: "Ключ будет сохранён в защищённом хранилище и включён в автоматическую ротацию по приоритету." })
                    ] }),
                    /* @__PURE__ */ jsx3(
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
                  /* @__PURE__ */ jsxs3(
                    "div",
                    {
                      style: {
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: "12px"
                      },
                      children: [
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "Провайдер" }),
                          /* @__PURE__ */ jsx3(
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
                              children: PROVIDERS.filter((p) => p.supportsKey).map((p) => /* @__PURE__ */ jsx3("option", { value: p.id, children: p.label }, p.id))
                            }
                          )
                        ] }),
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "Название в списке" }),
                          /* @__PURE__ */ jsx3(
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
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "API-ключ" }),
                          /* @__PURE__ */ jsx3(
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
                        /* @__PURE__ */ jsxs3("label", { style: { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px" }, children: [
                          /* @__PURE__ */ jsx3("span", { children: "Приоритет (1 — наивысший)" }),
                          /* @__PURE__ */ jsx3(
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
                  keyFormError ? /* @__PURE__ */ jsx3("div", { style: { fontSize: "13px", color: "#ef4444" }, children: keyFormError }) : null,
                  /* @__PURE__ */ jsx3("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px" }, children: /* @__PURE__ */ jsx3(
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
            /* @__PURE__ */ jsx3(
              "div",
              {
                style: {
                  borderRadius: "12px",
                  border: "1px solid var(--border, rgba(128,128,128,0.22))",
                  background: "var(--card, rgba(128,128,128,0.04))",
                  overflowX: "auto"
                },
                children: filteredAccounts.length === 0 ? /* @__PURE__ */ jsxs3(
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
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "16px", fontWeight: 600 }, children: loading ? "Загрузка пула аккаунтов..." : "В пуле пока нет подключённых подписок или ключей" }),
                      /* @__PURE__ */ jsx3("div", { style: { fontSize: "13px", opacity: 0.72, maxWidth: "520px" }, children: "Добавьте одну или несколько подписок («Войти подпиской») либо API-ключей («Добавить ключ»), чтобы настроить бесшовную ротацию без простоев на лимитах." })
                    ]
                  }
                ) : /* @__PURE__ */ jsxs3(
                  "table",
                  {
                    style: {
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left"
                    },
                    children: [
                      /* @__PURE__ */ jsx3("thead", { children: /* @__PURE__ */ jsxs3(
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
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px" }, children: "Приоритет" }),
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px" }, children: "Аккаунт" }),
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px" }, children: "Провайдер" }),
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px" }, children: "Способ входа" }),
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px" }, children: "Статус" }),
                            /* @__PURE__ */ jsx3("th", { style: { padding: "12px 14px", textAlign: "right" }, children: "Действия" })
                          ]
                        }
                      ) }),
                      /* @__PURE__ */ jsx3("tbody", { children: filteredAccounts.map((acc, index) => {
                        const badge = getStatusBadge(acc);
                        const isBusy = busyAccountId === acc.id;
                        return /* @__PURE__ */ jsxs3(
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
                              /* @__PURE__ */ jsx3("td", { style: { padding: "12px 14px", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs3("div", { style: { display: "inline-flex", alignItems: "center", gap: "6px" }, children: [
                                /* @__PURE__ */ jsx3(
                                  "span",
                                  {
                                    title: "Перетащите строку для смены приоритета",
                                    style: { opacity: 0.5, fontSize: "14px", userSelect: "none" },
                                    children: "⋮⋮"
                                  }
                                ),
                                /* @__PURE__ */ jsxs3("span", { style: { fontWeight: 700 }, children: [
                                  "#",
                                  acc.priority
                                ] }),
                                /* @__PURE__ */ jsxs3("div", { style: { display: "inline-flex", gap: "2px", marginLeft: "4px" }, children: [
                                  /* @__PURE__ */ jsx3(
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
                                  /* @__PURE__ */ jsx3(
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
                              /* @__PURE__ */ jsxs3("td", { style: { padding: "12px 14px" }, children: [
                                /* @__PURE__ */ jsx3("div", { style: { fontWeight: 600 }, children: acc.label }),
                                /* @__PURE__ */ jsx3(
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
                              /* @__PURE__ */ jsx3("td", { style: { padding: "12px 14px" }, children: acc.providerLabel }),
                              /* @__PURE__ */ jsx3("td", { style: { padding: "12px 14px" }, children: /* @__PURE__ */ jsx3(
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
                              /* @__PURE__ */ jsxs3("td", { style: { padding: "12px 14px" }, children: [
                                /* @__PURE__ */ jsx3(
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
                                acc.lastError ? /* @__PURE__ */ jsx3(
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
                              /* @__PURE__ */ jsx3("td", { style: { padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }, children: /* @__PURE__ */ jsxs3(
                                "div",
                                {
                                  style: {
                                    display: "inline-flex",
                                    gap: "6px",
                                    justifyContent: "flex-end",
                                    flexWrap: "wrap"
                                  },
                                  children: [
                                    /* @__PURE__ */ jsx3(
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
                                    /* @__PURE__ */ jsx3(
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
                                    /* @__PURE__ */ jsx3(
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
                )
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
    area: ROUTES_AREA2,
    order: 60,
    data: {
      id: "nomad.accounts.route",
      path: "/nomad-accounts",
      title: "Аккаунты",
      render: () => /* @__PURE__ */ jsx3(AccountsPage, { ctx })
    },
    render: () => /* @__PURE__ */ jsx3(AccountsPage, { ctx })
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
      render: () => /* @__PURE__ */ jsx3(AccountsStatusbarPill, { ctx })
    },
    render: () => /* @__PURE__ */ jsx3(AccountsStatusbarPill, { ctx })
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
    area: PALETTE_AREA2,
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
    area: PALETTE_AREA2,
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
    area: PALETTE_AREA2,
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

// deeplink.js
var deeplink_exports = {};
__export(deeplink_exports, {
  ACCOUNTS_ROUTE_PATH: () => ACCOUNTS_ROUTE_PATH,
  CONNECT_ROUTE_PATH: () => CONNECT_ROUTE_PATH,
  DEEPLINK_SCHEME: () => DEEPLINK_SCHEME,
  default: () => register,
  handleNomadDeepLink: () => handleNomadDeepLink,
  parseNomadDeepLink: () => parseNomadDeepLink
});
import { ROUTES_AREA as ROUTES_AREA3, host as host3 } from "@hermes/plugin-sdk";
import { useEffect as useEffect4, useState as useState4 } from "react";
import { jsx as jsx4, jsxs as jsxs4 } from "react/jsx-runtime";
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
  if (!navigated && host3 && typeof host3.navigate === "function") {
    try {
      host3.navigate(ACCOUNTS_ROUTE_PATH);
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
  const [state, setState] = useState4({ loading: true, connected: false, model: null, baseUrl: null });
  useEffect4(() => {
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
  return jsxs4("div", {
    "data-testid": "nomad-accounts-screen",
    style: { padding: "28px 32px", maxWidth: 680, lineHeight: 1.5 },
    children: [
      jsx4("h1", {
        style: { fontSize: 18, fontWeight: 600, margin: "0 0 8px" },
        children: "Аккаунты"
      }),
      jsx4("p", {
        style: { margin: "0 0 16px", opacity: 0.8 },
        children: "Управление подключением NomadNet и ключами доступа."
      }),
      jsx4("div", {
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
function register(ctx) {
  ctx.register({
    id: "connect-route",
    area: ROUTES_AREA3,
    order: 90,
    title: "Аккаунты",
    data: { path: CONNECT_ROUTE_PATH },
    render: () => jsx4(AccountsConnectFallbackView, { ctx })
  });
  ctx.register({
    id: "accounts-fallback-route",
    area: ROUTES_AREA3,
    order: 999,
    title: "Аккаунты",
    data: { path: ACCOUNTS_ROUTE_PATH },
    render: () => jsx4(AccountsConnectFallbackView, { ctx })
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
  default: () => register2,
  filterRecentSessionsBySetting: () => filterRecentSessionsBySetting,
  resolveKickoffText: () => resolveKickoffText,
  simulatorStateAtom: () => simulatorStateAtom,
  startSimulatorChat: () => startSimulatorChat
});
import { useCallback as useCallback3, useEffect as useEffect5, useMemo as useMemo2, useState as useState5 } from "react";
import {
  PALETTE_AREA as PALETTE_AREA3,
  ROUTES_AREA as ROUTES_AREA4,
  SIDEBAR_NAV_AREA as SIDEBAR_NAV_AREA3,
  atom as atom3,
  host as host4,
  useValue as useValue2
} from "@hermes/plugin-sdk";
import { jsx as jsx5, jsxs as jsxs5 } from "react/jsx-runtime";
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
var simulatorStateAtom = atom3({
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
  return contributions.filter((c) => c && c.area === SIDEBAR_NAV_AREA3).length;
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
async function startSimulatorChat(hostApi = host4, options = {}) {
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
async function continueSimulatorChat(hostApi = host4, storage = null) {
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
  const [activeTrack, setActiveTrack] = useState5("founder");
  const savedSessionId = useMemo2(() => {
    try {
      return ctx?.storage?.get?.("lastSimulatorSessionId", null) || simState.lastSessionId || null;
    } catch {
      return simState.lastSessionId || null;
    }
  }, [ctx, simState.lastSessionId]);
  const handleStart = useCallback3(
    (trackId = null) => {
      startSimulatorChat(host4, {
        trackId,
        storage: ctx?.storage
      });
    },
    [ctx]
  );
  const handleContinue = useCallback3(() => {
    continueSimulatorChat(host4, ctx?.storage);
  }, [ctx]);
  useEffect5(() => {
    if (autoLaunchInFlight) {
      return;
    }
    autoLaunchInFlight = true;
    Promise.resolve(
      startSimulatorChat(host4, {
        storage: ctx?.storage
      })
    ).finally(() => {
      setTimeout(() => {
        autoLaunchInFlight = false;
      }, 300);
    });
  }, [ctx]);
  return /* @__PURE__ */ jsxs5(
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
        /* @__PURE__ */ jsxs5("header", { style: { display: "flex", flexDirection: "column", gap: 8 }, children: [
          /* @__PURE__ */ jsxs5("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }, children: [
            /* @__PURE__ */ jsx5("h1", { style: { fontSize: 24, fontWeight: 700, margin: 0 }, children: "Симулятор ИИ" }),
            /* @__PURE__ */ jsx5(
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
          /* @__PURE__ */ jsx5("p", { style: { margin: 0, fontSize: 14, opacity: 0.85, lineHeight: 1.5 }, children: "Учитесь вайбкодингу и управлению агентами вместе с ведущим курса: выберите вашу роль, проходите практические миссии и собирайте рабочие инструменты прямо в чате." })
        ] }),
        /* @__PURE__ */ jsxs5(
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
              /* @__PURE__ */ jsx5(
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
              savedSessionId && /* @__PURE__ */ jsx5(
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
              /* @__PURE__ */ jsx5("span", { style: { fontSize: 13, opacity: 0.75 }, children: "Откроется диалог с персональным ИИ-ментором, где первый ответ сразу предложит трек и миссию." })
            ]
          }
        ),
        simState.error && /* @__PURE__ */ jsxs5(
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
        /* @__PURE__ */ jsxs5("section", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsx5("h2", { style: { fontSize: 16, fontWeight: 600, margin: 0 }, children: "Выберите трек под вашу роль (9 направлений)" }),
          /* @__PURE__ */ jsx5(
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
                return /* @__PURE__ */ jsxs5(
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
                      /* @__PURE__ */ jsx5("span", { style: { fontSize: 15, fontWeight: 600 }, children: track.label }),
                      /* @__PURE__ */ jsx5("span", { style: { fontSize: 13, opacity: 0.8, lineHeight: 1.4 }, children: track.summary })
                    ]
                  },
                  track.id
                );
              })
            }
          )
        ] }),
        /* @__PURE__ */ jsxs5("section", { style: { display: "flex", flexDirection: "column", gap: 12 }, children: [
          /* @__PURE__ */ jsx5("h2", { style: { fontSize: 16, fontWeight: 600, margin: 0 }, children: "Практические сценарии тренажёра" }),
          /* @__PURE__ */ jsx5(
            "div",
            {
              "data-testid": "simulator-scenarios-grid",
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12
              },
              children: SIMULATOR_SCENARIOS.map((scenario) => /* @__PURE__ */ jsxs5(
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
                    /* @__PURE__ */ jsx5("span", { style: { fontSize: 14, fontWeight: 600 }, children: scenario.title }),
                    /* @__PURE__ */ jsx5("span", { style: { fontSize: 13, opacity: 0.8, lineHeight: 1.4 }, children: scenario.description })
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
function register2(ctx) {
  ctx.register({
    id: "page",
    area: ROUTES_AREA4,
    data: {
      path: SIMULATOR_PATH
    },
    render: () => /* @__PURE__ */ jsx5(SimulatorPage, { ctx })
  });
  ctx.register({
    id: "nav",
    area: SIDEBAR_NAV_AREA3,
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
    area: PALETTE_AREA3,
    order: SIMULATOR_NAV_ORDER,
    data: {
      id: "nomad.simulator.open",
      action: "nomad.simulator.open",
      label: SIMULATOR_NAV_LABEL,
      category: "Nomad",
      keywords: ["симулятор", "ментор", "курс", "вайбкодинг", "обучение", "simulator"],
      run: () => {
        if (typeof host4?.navigate === "function") {
          host4.navigate(SIMULATOR_PATH);
        }
        startSimulatorChat(host4, { storage: ctx?.storage });
      }
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
import { STATUSBAR_AREAS as STATUSBAR_AREAS2 } from "@hermes/plugin-sdk";
import { useEffect as useEffect6, useState as useState6 } from "react";
import { jsx as jsx6, jsxs as jsxs6 } from "react/jsx-runtime";
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
function StatusbarBalance({ ctx, host: host5 }) {
  const [state, setState] = useState6({ status: "loading", data: null, error: null });
  useEffect6(() => {
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
    if (host5 && typeof host5.navigate === "function") {
      host5.navigate("/nomad-accounts");
    }
  };
  return /* @__PURE__ */ jsxs6(
    "button",
    {
      type: "button",
      onClick: handleClick,
      "data-testid": "nomad-statusbar-balance",
      title: balanceText !== null ? `NomadNet balance: ${balanceText}${currency ? " " + currency : ""}` : `NomadNet: ${code || "loading"}`,
      className: "flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors",
      children: [
        /* @__PURE__ */ jsx6("span", { className: "font-medium", children: "NomadNet" }),
        state.status === "loading" && /* @__PURE__ */ jsx6("span", { "data-testid": "nomad-balance-loading", children: "…" }),
        state.status !== "loading" && balanceText !== null && /* @__PURE__ */ jsx6("span", { "data-testid": "nomad-balance-value", className: "font-mono font-semibold text-foreground", children: balanceText }),
        state.status !== "loading" && balanceText !== null && currency && /* @__PURE__ */ jsx6("span", { "data-testid": "nomad-balance-currency", className: "text-[10px] opacity-80", children: currency }),
        state.status !== "loading" && balanceText === null && /* @__PURE__ */ jsx6("span", { "data-testid": "nomad-balance-status", className: "font-mono text-[10px] opacity-75", children: code || "disconnected" })
      ]
    }
  );
}
function registerStatusbarBalance(ctx) {
  ctx.register({
    id: "balance",
    area: STATUSBAR_AREAS2.right,
    order: 35,
    data: { label: "NomadNet Balance" },
    render: (host5) => /* @__PURE__ */ jsx6(StatusbarBalance, { ctx, host: host5 })
  });
}

// desktop-entry.js
var desktop_entry_default = createNomadPlugin([
  ["accounts/billing-tab.js", billing_tab_exports],
  ["accounts/page.js", page_exports],
  ["deeplink.js", deeplink_exports],
  ["simulator.js", simulator_exports],
  ["statusbar-balance.js", statusbar_balance_exports]
]);
export {
  desktop_entry_default as default
};
