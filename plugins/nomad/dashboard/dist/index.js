// Built by tools/build_desktop_plugin.py from dashboard/src/ - do not edit by hand.
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // index.js
  var PLUGIN = "nomad";
  var HEALTH_URL = "/api/plugins/nomad/health";
  var HINT = "Проверьте, что открыт профиль nomad и плагин Nomad включён в разделе «Плагины», затем перезапустите приложение.";
  function errorText(error) {
    return error && error.message ? error.message : String(error);
  }
  function startNomadDashboard(modules) {
    const SDK = window.__HERMES_PLUGIN_SDK__;
    const PLUGINS = window.__HERMES_PLUGINS__;
    if (!SDK || !PLUGINS) {
      console.error("[nomad] dashboard plugin SDK is not available");
      return;
    }
    const h = SDK.React.createElement;
    const { useEffect, useState } = SDK.hooks;
    const sections = [];
    const problems = [];
    const api = { sdk: SDK, plugins: PLUGINS, addSection: (section) => sections.push(section) };
    for (const [file, mod] of modules) {
      const register5 = mod.default;
      if (register5 === void 0) {
        continue;
      }
      if (typeof register5 !== "function") {
        problems.push([file, "default export is not a register(api) function"]);
        console.error(`[nomad] ${file}: default export is not a register(api) function`);
        continue;
      }
      try {
        register5(api);
      } catch (error) {
        problems.push([file, errorText(error)]);
        console.error(`[nomad] ${file} failed to register: ${errorText(error)}`);
      }
    }
    sections.sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    function Status() {
      const [health, setHealth] = useState({ phase: "loading" });
      useEffect(() => {
        let alive = true;
        SDK.fetchJSON(HEALTH_URL).then(
          (body2) => alive && setHealth({ phase: "ok", body: body2 }),
          (error) => alive && setHealth({ phase: "down", message: errorText(error) })
        );
        return () => {
          alive = false;
        };
      }, []);
      const body = health.phase === "ok" ? health.body : null;
      const errors = body && body.errors ? Object.entries(body.errors) : [];
      const line = health.phase === "loading" ? "Проверяем сервер плагина…" : !body ? `Сервер плагина не отвечает: ${health.message}. ${HINT}` : body.status === "ok" && errors.length === 0 ? `Сервер плагина отвечает · версия ${body.version}` : `Сервер плагина отвечает, но не все экраны подключились · версия ${body.version}`;
      return h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, h("p", null, line), problemList(errors));
    }
    function problemList(items) {
      return items.length > 0 && h("ul", null, ...items.map(([where, message]) => h("li", { key: where }, `${where}: ${message}`)));
    }
    function NomadPage() {
      const [active, setActive] = useState(0);
      const current = sections[Math.min(active, sections.length - 1)];
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 16, padding: 16 } },
        h("h1", { style: { fontSize: 20, fontWeight: 600 } }, "Nomad"),
        problemList(problems),
        sections.length > 0 && h(
          "div",
          { role: "tablist", style: { display: "flex", gap: 8 } },
          ...sections.map(
            (section, i) => h(
              "button",
              {
                key: section.id,
                role: "tab",
                "aria-selected": section === current,
                onClick: () => setActive(i),
                style: { fontWeight: section === current ? 600 : 400 }
              },
              section.title
            )
          )
        ),
        current ? h(current.component) : h(Status)
      );
    }
    PLUGINS.register(PLUGIN, NomadPage);
  }

  // accounts-tab.js
  var accounts_tab_exports = {};
  __export(accounts_tab_exports, {
    createAccountsSection: () => createAccountsSection,
    createPreMainBanner: () => createPreMainBanner,
    default: () => register,
    formatPoolSummary: () => formatPoolSummary,
    normalizeAccounts: () => normalizeAccounts
  });
  var PLUGIN_NAME = "nomad";
  var SLOT_NAME = "pre-main";
  var API_BASE = "/api/plugins/nomad/accounts";
  var NOMAD_ACCOUNT_URL = "/api/plugins/nomad/account";
  var NOMAD_CONNECT_URL = "/api/plugins/nomad/connect";
  var BILLING_RENEW_URL = "https://nomad.ugs.ru/billing";
  var PROVIDERS = [
    { id: "anthropic", label: "Anthropic" },
    { id: "openai-codex", label: "OpenAI Codex" },
    { id: "openrouter", label: "OpenRouter" },
    { id: "gemini", label: "Google Gemini" },
    { id: "custom", label: "Свой провайдер (OpenAI-совместимый)" }
  ];
  var STATUS_LABELS = {
    active: "Активен",
    ready: "Готов",
    cooldown: "Охлаждение (лимит)",
    expired: "Сессия истекла",
    exhausted: "Квота исчерпана",
    disabled: "Отключён",
    error: "Ошибка входа"
  };
  var PLAN_LABELS = {
    free: "Бесплатный",
    trial: "Пробный",
    starter: "Стартовый",
    pro: "Профессиональный",
    team: "Командный",
    enterprise: "Корпоративный"
  };
  var BILLING_STATUS_LABELS = {
    active: "Активен",
    trialing: "Пробный период",
    past_due: "Ожидает оплаты",
    canceled: "Отменён",
    expired: "Истёк",
    unlinked: "Не привязан"
  };
  function normalizeAccounts(payload) {
    const raw = Array.isArray(payload) ? payload : payload && Array.isArray(payload.accounts) ? payload.accounts : [];
    return raw.map((item, idx) => ({
      id: String(item.id || item.account_id || `acc-${idx + 1}`),
      provider: String(item.provider || "anthropic"),
      label: String(item.label || item.name || item.id || `Аккаунт #${idx + 1}`),
      kind: String(item.kind || item.auth_type || (item.has_oauth ? "oauth" : "api_key")),
      status: String(item.status || (item.cooldown_until ? "cooldown" : "ready")),
      priority: typeof item.priority === "number" ? item.priority : idx + 1,
      active: Boolean(item.active || item.is_active || idx === 0),
      cooldownUntil: item.cooldown_until || item.cooldownUntil || null,
      maskedKey: item.masked_key || item.maskedKey || null
    })).sort((a, b) => a.priority - b.priority);
  }
  function formatPoolSummary(accounts) {
    const list = Array.isArray(accounts) ? accounts : [];
    const total = list.length;
    if (total === 0) {
      return "Аккаунтов: 0 · активен #—";
    }
    const activeIdx = list.findIndex(
      (a) => a.active || a.status === "active" || a.status === "ready"
    );
    const activeRank = activeIdx >= 0 ? activeIdx + 1 : 1;
    return `Аккаунтов: ${total} · активен #${activeRank}`;
  }
  function formatDate(value) {
    if (!value) {
      return "—";
    }
    const date = typeof value === "number" ? new Date(value * 1e3) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }
  function createPreMainBanner(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    return function PreMainAccountsBanner() {
      const [accounts, setAccounts] = useState([]);
      const [loaded, setLoaded] = useState(false);
      useEffect(() => {
        let alive = true;
        sdk.fetchJSON(API_BASE).then(
          (data) => {
            if (alive) {
              setAccounts(normalizeAccounts(data));
              setLoaded(true);
            }
          },
          () => {
            if (alive) {
              setAccounts([]);
              setLoaded(true);
            }
          }
        );
        return () => {
          alive = false;
        };
      }, []);
      const summaryText = formatPoolSummary(accounts);
      return h(
        "div",
        {
          "data-testid": "nomad-pre-main-banner",
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "8px 14px",
            marginBottom: 12,
            borderRadius: 8,
            border: "1px solid rgba(128,128,128,0.22)",
            background: "rgba(128,128,128,0.06)",
            fontSize: 13
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 10 } },
          h("span", { style: { fontWeight: 600 } }, summaryText),
          !loaded && h("span", { style: { opacity: 0.65, fontSize: 12 } }, "обновление…")
        ),
        h(
          "a",
          {
            href: "/nomad-accounts",
            style: {
              fontSize: 12,
              fontWeight: 500,
              textDecoration: "none",
              color: "inherit",
              opacity: 0.85
            }
          },
          "Управление пулом →"
        )
      );
    };
  }
  function createBillingSubTab(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    return function BillingSubTab() {
      const [account, setAccount] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [code, setCode] = useState("");
      const [connecting, setConnecting] = useState(false);
      const [notice, setNotice] = useState(null);
      function loadAccount() {
        setLoading(true);
        setError(null);
        sdk.fetchJSON(NOMAD_ACCOUNT_URL).then(
          (data) => {
            setAccount(data || {});
            setLoading(false);
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось загрузить сведения о тарифе.");
            setLoading(false);
          }
        );
      }
      useEffect(() => {
        loadAccount();
      }, []);
      function handleConnect(e) {
        if (e && typeof e.preventDefault === "function") {
          e.preventDefault();
        }
        const trimmed = code.trim();
        if (!trimmed) {
          setError("Введите код привязки из личного кабинета.");
          return;
        }
        setConnecting(true);
        setError(null);
        setNotice(null);
        sdk.fetchJSON(NOMAD_CONNECT_URL, {
          method: "POST",
          body: JSON.stringify({ code: trimmed })
        }).then(
          (data) => {
            setAccount(data && data.account ? data.account : data);
            setCode("");
            setNotice("Аккаунт успешно привязан к вашему профилю.");
            setConnecting(false);
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось привязать аккаунт.");
            setConnecting(false);
          }
        );
      }
      const planKey = account && account.plan ? String(account.plan).toLowerCase() : "free";
      const statusKey = account && account.status ? String(account.status).toLowerCase() : "unlinked";
      const planLabel = PLAN_LABELS[planKey] || account && account.plan_label || "Базовый";
      const statusLabel = BILLING_STATUS_LABELS[statusKey] || "Активен";
      const used = Number(account && (account.used ?? account.requests_used) || 0);
      const limit = Number(account && (account.limit ?? account.requests_limit) || 0);
      const percent = limit > 0 ? Math.min(100, Math.round(used / limit * 100)) : 0;
      const renewUrl = account && account.renew_url || BILLING_RENEW_URL;
      return h(
        "div",
        {
          "data-testid": "nomad-billing-tab",
          style: { display: "flex", flexDirection: "column", gap: 16 }
        },
        h(
          "div",
          {
            style: {
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }
          },
          h(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            h(
              "div",
              null,
              h("h3", { style: { margin: 0, fontSize: 16, fontWeight: 600 } }, "Ваш тариф Nomad"),
              h(
                "p",
                { style: { margin: "4px 0 0", fontSize: 13, opacity: 0.75 } },
                "Сведения о вашей подписке, остатке квоты и привязке рабочего места."
              )
            ),
            h(
              "a",
              {
                href: renewUrl,
                target: "_blank",
                rel: "noopener noreferrer",
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  background: "#2563eb",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 500
                }
              },
              "Продлить подписку"
            )
          ),
          loading && h("div", { style: { fontSize: 13, opacity: 0.75 } }, "Загрузка данных о тарифе…"),
          error && h(
            "div",
            {
              role: "alert",
              style: {
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(220,38,38,0.12)",
                color: "#dc2626",
                fontSize: 13
              }
            },
            error
          ),
          notice && h(
            "div",
            {
              role: "status",
              style: {
                padding: "8px 12px",
                borderRadius: 6,
                background: "rgba(22,163,74,0.12)",
                color: "#16a34a",
                fontSize: 13
              }
            },
            notice
          ),
          !loading && h(
            "div",
            {
              style: {
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12
              }
            },
            h(
              "div",
              { style: { padding: 10, borderRadius: 8, background: "rgba(128,128,128,0.08)" } },
              h("div", { style: { fontSize: 12, opacity: 0.7 } }, "Тариф"),
              h("div", { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } }, planLabel)
            ),
            h(
              "div",
              { style: { padding: 10, borderRadius: 8, background: "rgba(128,128,128,0.08)" } },
              h("div", { style: { fontSize: 12, opacity: 0.7 } }, "Статус"),
              h("div", { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } }, statusLabel)
            ),
            h(
              "div",
              { style: { padding: 10, borderRadius: 8, background: "rgba(128,128,128,0.08)" } },
              h("div", { style: { fontSize: 12, opacity: 0.7 } }, "Период до"),
              h(
                "div",
                { style: { fontSize: 15, fontWeight: 600, marginTop: 4 } },
                formatDate(account && (account.expires_at || account.period_end))
              )
            )
          ),
          !loading && h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 6 } },
            h(
              "div",
              { style: { display: "flex", justifyContent: "space-between", fontSize: 13 } },
              h("span", null, "Использование за период"),
              h(
                "span",
                { style: { fontWeight: 600 } },
                limit > 0 ? `${used} из ${limit} (${percent}%)` : `${used} запросов`
              )
            ),
            h(
              "div",
              {
                style: {
                  height: 8,
                  borderRadius: 999,
                  background: "rgba(128,128,128,0.2)",
                  overflow: "hidden"
                }
              },
              h("div", {
                style: {
                  width: `${percent}%`,
                  height: "100%",
                  background: percent > 90 ? "#dc2626" : "#2563eb"
                }
              })
            )
          )
        ),
        h(
          "form",
          {
            onSubmit: handleConnect,
            style: {
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10
            }
          },
          h("div", { style: { fontSize: 14, fontWeight: 600 } }, "Привязка аккаунта Nomad по коду"),
          h(
            "p",
            { style: { margin: 0, fontSize: 13, opacity: 0.75 } },
            "Если вы получили одноразовый код в личном кабинете, укажите его ниже для активации тарифа."
          ),
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h("input", {
              type: "text",
              value: code,
              onChange: (e) => setCode(e && e.target ? e.target.value : ""),
              placeholder: "Код привязки (например, NMD-XXXX-XXXX)",
              "aria-label": "Код привязки",
              style: {
                flex: "1 1 240px",
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.35)",
                fontSize: 13
              }
            }),
            h(
              "button",
              {
                type: "submit",
                disabled: connecting,
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: connecting ? "default" : "pointer",
                  fontSize: 13,
                  fontWeight: 500
                }
              },
              connecting ? "Проверка…" : "Подключить"
            )
          )
        )
      );
    };
  }
  function createAccountsSection(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    const BillingSubTab = createBillingSubTab(sdk);
    return function AccountsSection() {
      const [activeSubTab, setActiveSubTab] = useState("pool");
      const [accounts, setAccounts] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const [showAddKey, setShowAddKey] = useState(false);
      const [keyProvider, setKeyProvider] = useState("anthropic");
      const [keyLabel, setKeyLabel] = useState("");
      const [apiKeyValue, setApiKeyValue] = useState("");
      const [savingKey, setSavingKey] = useState(false);
      const [oauthFlow, setOauthFlow] = useState(null);
      const [oauthProvider, setOauthProvider] = useState("anthropic");
      const [dragIndex, setDragIndex] = useState(null);
      function loadPool() {
        setLoading(true);
        setError(null);
        sdk.fetchJSON(API_BASE).then(
          (data) => {
            setAccounts(normalizeAccounts(data));
            setLoading(false);
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось загрузить пул аккаунтов.");
            setLoading(false);
          }
        );
      }
      useEffect(() => {
        loadPool();
      }, []);
      function handleAddKeySubmit(e) {
        if (e && typeof e.preventDefault === "function") {
          e.preventDefault();
        }
        const trimmedKey = apiKeyValue.trim();
        if (!trimmedKey) {
          setError("Пожалуйста, укажите API-ключ провайдера.");
          return;
        }
        setSavingKey(true);
        setError(null);
        setNotice(null);
        sdk.fetchJSON(`${API_BASE}/key`, {
          method: "POST",
          body: JSON.stringify({
            provider: keyProvider,
            label: keyLabel.trim() || `${keyProvider}-key`,
            api_key: trimmedKey
          })
        }).then(
          (data) => {
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data));
            } else {
              loadPool();
            }
            setApiKeyValue("");
            setKeyLabel("");
            setShowAddKey(false);
            setSavingKey(false);
            setNotice("API-ключ добавлен в пул провайдеров.");
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось сохранить API-ключ.");
            setSavingKey(false);
          }
        );
      }
      function handleStartOAuth(providerId) {
        const targetProvider = providerId || oauthProvider || "anthropic";
        setError(null);
        setNotice(null);
        setOauthFlow({
          status: "starting",
          provider: targetProvider,
          userCode: null,
          verificationUri: null,
          sessionId: null
        });
        sdk.fetchJSON(`${API_BASE}/oauth/start`, {
          method: "POST",
          body: JSON.stringify({ provider: targetProvider })
        }).then(
          (data) => {
            setOauthFlow({
              status: "pending",
              provider: targetProvider,
              userCode: data && (data.user_code || data.userCode) || "XXXX-XXXX",
              verificationUri: data && (data.verification_uri || data.verificationUri || data.url) || "",
              sessionId: data && (data.session_id || data.sessionId || data.state) || "default"
            });
          },
          (err) => {
            setOauthFlow(null);
            setError(err && err.message ? err.message : "Не удалось запустить вход подпиской.");
          }
        );
      }
      function handlePollOAuth() {
        if (!oauthFlow) {
          return;
        }
        setError(null);
        const sessionId = encodeURIComponent(oauthFlow.sessionId || "default");
        sdk.fetchJSON(`${API_BASE}/oauth/poll/${sessionId}`, {
          method: "POST",
          body: JSON.stringify({
            provider: oauthFlow.provider,
            session_id: oauthFlow.sessionId
          })
        }).then(
          (data) => {
            const st = data && data.status ? String(data.status) : "completed";
            if (st === "pending" || st === "authorization_pending") {
              setNotice("Ожидаем подтверждения входа в браузере…");
              return;
            }
            setOauthFlow(null);
            setNotice("Вход по подписке успешно подтверждён.");
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data));
            } else {
              loadPool();
            }
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось завершить вход подпиской.");
          }
        );
      }
      function handleResetCooldown(acc) {
        setError(null);
        setNotice(null);
        sdk.fetchJSON(`${API_BASE}/reset`, {
          method: "POST",
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        }).then(
          (data) => {
            setNotice(`Пометка охлаждения снята для «${acc.label}».`);
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data));
            } else {
              setAccounts(
                (prev) => prev.map(
                  (item) => item.id === acc.id ? { ...item, status: "ready", cooldownUntil: null } : item
                )
              );
            }
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось снять пометку охлаждения.");
          }
        );
      }
      function handleRefreshLogin(acc) {
        setError(null);
        setNotice(null);
        const url = `${API_BASE}/${encodeURIComponent(acc.provider)}/${encodeURIComponent(acc.id)}/refresh`;
        sdk.fetchJSON(url, {
          method: "POST",
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        }).then(
          (data) => {
            setNotice(`Токен входа обновлён для «${acc.label}».`);
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data));
            } else {
              loadPool();
            }
          },
          (err) => {
            if (err && /expired|reauth|401/i.test(String(err.message))) {
              handleStartOAuth(acc.provider);
              return;
            }
            setError(err && err.message ? err.message : "Не удалось обновить сессию входа.");
          }
        );
      }
      function handleDeleteAccount(acc) {
        setError(null);
        setNotice(null);
        const url = `${API_BASE}/${encodeURIComponent(acc.provider)}/${encodeURIComponent(acc.id)}`;
        sdk.fetchJSON(url, {
          method: "DELETE",
          body: JSON.stringify({ id: acc.id, provider: acc.provider })
        }).then(
          (data) => {
            setNotice(`Аккаунт «${acc.label}» удалён из пула.`);
            if (data && Array.isArray(data.accounts)) {
              setAccounts(normalizeAccounts(data));
            } else {
              setAccounts((prev) => prev.filter((item) => item.id !== acc.id));
            }
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось удалить аккаунт.");
          }
        );
      }
      function applyReorder(fromIdx, toIdx) {
        if (fromIdx === null || toIdx === null || fromIdx === toIdx) {
          return;
        }
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= accounts.length || toIdx >= accounts.length) {
          return;
        }
        const next = accounts.slice();
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        const reindexed = next.map((item, idx) => ({
          ...item,
          priority: idx + 1,
          active: idx === 0
        }));
        setAccounts(reindexed);
        const provider = moved ? moved.provider : "anthropic";
        const order = reindexed.map((item) => item.id);
        sdk.fetchJSON(`${API_BASE}/priority`, {
          method: "POST",
          body: JSON.stringify({ provider, order, accounts: order })
        }).then(
          () => {
            setNotice("Порядок приоритетов сохранён.");
          },
          (err) => {
            setError(err && err.message ? err.message : "Не удалось сохранить порядок приоритетов.");
          }
        );
      }
      const summaryText = formatPoolSummary(accounts);
      return h(
        "div",
        {
          "data-testid": "nomad-dashboard-accounts",
          style: { display: "flex", flexDirection: "column", gap: 16 }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12
            }
          },
          h(
            "div",
            null,
            h("h2", { style: { margin: 0, fontSize: 18, fontWeight: 600 } }, "Аккаунты и провайдеры"),
            h(
              "p",
              { style: { margin: "4px 0 0", fontSize: 13, opacity: 0.75 } },
              "Управляйте вашими подключёнными провайдерами, порядком приоритетов и ключами доступа."
            )
          ),
          h(
            "div",
            {
              "data-testid": "accounts-summary-badge",
              style: {
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.1)",
                fontSize: 13,
                fontWeight: 600
              }
            },
            summaryText
          )
        ),
        h(
          "div",
          {
            role: "tablist",
            "aria-label": "Разделы управления аккаунтами",
            style: {
              display: "flex",
              gap: 8,
              borderBottom: "1px solid rgba(128,128,128,0.2)",
              paddingBottom: 8
            }
          },
          h(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": activeSubTab === "pool",
              onClick: () => setActiveSubTab("pool"),
              style: {
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.25)",
                background: activeSubTab === "pool" ? "#2563eb" : "transparent",
                color: activeSubTab === "pool" ? "#fff" : "inherit",
                fontWeight: activeSubTab === "pool" ? 600 : 400,
                cursor: "pointer",
                fontSize: 13
              }
            },
            "Пул провайдеров"
          ),
          h(
            "button",
            {
              type: "button",
              role: "tab",
              "aria-selected": activeSubTab === "billing",
              onClick: () => setActiveSubTab("billing"),
              style: {
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.25)",
                background: activeSubTab === "billing" ? "#2563eb" : "transparent",
                color: activeSubTab === "billing" ? "#fff" : "inherit",
                fontWeight: activeSubTab === "billing" ? 600 : 400,
                cursor: "pointer",
                fontSize: 13
              }
            },
            "Тариф"
          )
        ),
        error && h(
          "div",
          {
            role: "alert",
            style: {
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(220,38,38,0.12)",
              color: "#dc2626",
              fontSize: 13
            }
          },
          error
        ),
        notice && h(
          "div",
          {
            role: "status",
            style: {
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(22,163,74,0.12)",
              color: "#16a34a",
              fontSize: 13
            }
          },
          notice
        ),
        activeSubTab === "billing" ? h(BillingSubTab) : h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 14 } },
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
            h(
              "select",
              {
                value: oauthProvider,
                onChange: (e) => setOauthProvider(e && e.target ? e.target.value : "anthropic"),
                "aria-label": "Провайдер для входа подпиской",
                style: {
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  fontSize: 13
                }
              },
              ...PROVIDERS.map((p) => h("option", { key: p.id, value: p.id }, p.label))
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => handleStartOAuth(oauthProvider),
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500
                }
              },
              "Войти подпиской"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => setShowAddKey(!showAddKey),
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500
                }
              },
              "Добавить ключ"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: loadPool,
                style: {
                  padding: "7px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.25)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 13
                }
              },
              "Обновить список"
            )
          ),
          oauthFlow && h(
            "div",
            {
              "data-testid": "oauth-device-flow-box",
              style: {
                border: "1px solid rgba(37,99,235,0.4)",
                borderRadius: 10,
                padding: 14,
                background: "rgba(37,99,235,0.06)",
                display: "flex",
                flexDirection: "column",
                gap: 8
              }
            },
            h(
              "div",
              { style: { fontWeight: 600, fontSize: 14 } },
              `Вход по подписке (${oauthFlow.provider})`
            ),
            oauthFlow.status === "starting" ? h("div", { style: { fontSize: 13 } }, "Запрашиваем одноразовый код устройства…") : h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13 } },
              h(
                "div",
                null,
                "Откройте страницу авторизации и введите код устройства: ",
                h(
                  "code",
                  {
                    style: {
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "rgba(128,128,128,0.18)",
                      fontWeight: 700
                    }
                  },
                  oauthFlow.userCode
                )
              ),
              oauthFlow.verificationUri && h(
                "a",
                {
                  href: oauthFlow.verificationUri,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  style: { color: "#2563eb", fontWeight: 500 }
                },
                "Открыть страницу подтверждения →"
              ),
              h(
                "div",
                { style: { display: "flex", gap: 8 } },
                h(
                  "button",
                  {
                    type: "button",
                    onClick: handlePollOAuth,
                    style: {
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "none",
                      background: "#16a34a",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 500
                    }
                  },
                  "Проверить вход"
                ),
                h(
                  "button",
                  {
                    type: "button",
                    onClick: () => setOauthFlow(null),
                    style: {
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(128,128,128,0.3)",
                      background: "transparent",
                      color: "inherit",
                      cursor: "pointer",
                      fontSize: 12
                    }
                  },
                  "Отмена"
                )
              )
            )
          ),
          showAddKey && h(
            "form",
            {
              onSubmit: handleAddKeySubmit,
              "data-testid": "add-key-form",
              style: {
                border: "1px solid rgba(128,128,128,0.25)",
                borderRadius: 10,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10
              }
            },
            h(
              "div",
              { style: { fontWeight: 600, fontSize: 14 } },
              "Добавление API-ключа провайдера"
            ),
            h(
              "div",
              { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
              h(
                "select",
                {
                  value: keyProvider,
                  onChange: (e) => setKeyProvider(e && e.target ? e.target.value : "anthropic"),
                  "aria-label": "Провайдер ключа",
                  style: {
                    padding: "7px 10px",
                    borderRadius: 6,
                    border: "1px solid rgba(128,128,128,0.35)",
                    fontSize: 13
                  }
                },
                ...PROVIDERS.map((p) => h("option", { key: p.id, value: p.id }, p.label))
              ),
              h("input", {
                type: "text",
                value: keyLabel,
                onChange: (e) => setKeyLabel(e && e.target ? e.target.value : ""),
                placeholder: "Метка (например, Рабочий ключ)",
                "aria-label": "Метка аккаунта",
                style: {
                  flex: "1 1 180px",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  fontSize: 13
                }
              }),
              h("input", {
                type: "password",
                value: apiKeyValue,
                onChange: (e) => setApiKeyValue(e && e.target ? e.target.value : ""),
                placeholder: "sk-...",
                "aria-label": "API-ключ",
                style: {
                  flex: "2 1 240px",
                  padding: "7px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  fontSize: 13
                }
              }),
              h(
                "button",
                {
                  type: "submit",
                  disabled: savingKey,
                  style: {
                    padding: "7px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    cursor: savingKey ? "default" : "pointer",
                    fontSize: 13,
                    fontWeight: 500
                  }
                },
                savingKey ? "Сохранение…" : "Сохранить ключ"
              )
            )
          ),
          loading ? h("div", { style: { fontSize: 13, opacity: 0.75 } }, "Загрузка пула аккаунтов…") : accounts.length === 0 ? h(
            "div",
            {
              style: {
                padding: 20,
                borderRadius: 10,
                border: "1px dashed rgba(128,128,128,0.35)",
                textAlign: "center",
                fontSize: 13,
                opacity: 0.8
              }
            },
            "В вашем пуле пока нет подключённых аккаунтов. Нажмите «Войти подпиской» или «Добавить ключ», чтобы подключить первый провайдер."
          ) : h(
            "table",
            {
              role: "table",
              style: {
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13
              }
            },
            h(
              "thead",
              null,
              h(
                "tr",
                {
                  style: {
                    textAlign: "left",
                    borderBottom: "1px solid rgba(128,128,128,0.25)"
                  }
                },
                h("th", { style: { padding: "8px 6px" } }, "#"),
                h("th", { style: { padding: "8px 6px" } }, "Провайдер"),
                h("th", { style: { padding: "8px 6px" } }, "Метка"),
                h("th", { style: { padding: "8px 6px" } }, "Тип входа"),
                h("th", { style: { padding: "8px 6px" } }, "Статус"),
                h("th", { style: { padding: "8px 6px" } }, "Действия")
              )
            ),
            h(
              "tbody",
              null,
              ...accounts.map(
                (acc, idx) => h(
                  "tr",
                  {
                    key: `${acc.provider}:${acc.id}`,
                    draggable: true,
                    onDragStart: () => setDragIndex(idx),
                    onDragOver: (e) => {
                      if (e && typeof e.preventDefault === "function") {
                        e.preventDefault();
                      }
                    },
                    onDrop: () => {
                      applyReorder(dragIndex, idx);
                      setDragIndex(null);
                    },
                    style: {
                      borderBottom: "1px solid rgba(128,128,128,0.15)",
                      background: idx === 0 ? "rgba(37,99,235,0.04)" : "transparent"
                    }
                  },
                  h(
                    "td",
                    { style: { padding: "8px 6px", fontWeight: 600 } },
                    `#${idx + 1}`
                  ),
                  h("td", { style: { padding: "8px 6px" } }, acc.provider),
                  h("td", { style: { padding: "8px 6px" } }, acc.label),
                  h(
                    "td",
                    { style: { padding: "8px 6px" } },
                    acc.kind === "oauth" ? "Подписка (OAuth)" : "API-ключ"
                  ),
                  h(
                    "td",
                    { style: { padding: "8px 6px" } },
                    STATUS_LABELS[acc.status] || acc.status
                  ),
                  h(
                    "td",
                    {
                      style: {
                        padding: "8px 6px",
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap"
                      }
                    },
                    h(
                      "button",
                      {
                        type: "button",
                        disabled: idx === 0,
                        onClick: () => applyReorder(idx, idx - 1),
                        title: "Повысить приоритет",
                        style: {
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(128,128,128,0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: idx === 0 ? "default" : "pointer",
                          fontSize: 12
                        }
                      },
                      "↑"
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        disabled: idx === accounts.length - 1,
                        onClick: () => applyReorder(idx, idx + 1),
                        title: "Понизить приоритет",
                        style: {
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(128,128,128,0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: idx === accounts.length - 1 ? "default" : "pointer",
                          fontSize: 12
                        }
                      },
                      "↓"
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleResetCooldown(acc),
                        style: {
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(128,128,128,0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          fontSize: 12
                        }
                      },
                      "Снять пометку"
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleRefreshLogin(acc),
                        style: {
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(128,128,128,0.3)",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          fontSize: 12
                        }
                      },
                      "Обновить вход"
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        onClick: () => handleDeleteAccount(acc),
                        style: {
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid rgba(220,38,38,0.4)",
                          background: "transparent",
                          color: "#dc2626",
                          cursor: "pointer",
                          fontSize: 12
                        }
                      },
                      "Удалить"
                    )
                  )
                )
              )
            )
          )
        )
      );
    };
  }
  function register({ sdk, plugins, addSection }) {
    if (!sdk || !sdk.React || !sdk.hooks) {
      return;
    }
    const AccountsSection = createAccountsSection(sdk);
    const PreMainBanner = createPreMainBanner(sdk);
    if (typeof addSection === "function") {
      addSection({
        id: "accounts",
        title: "Аккаунты",
        order: 10,
        component: AccountsSection
      });
    }
    if (plugins && typeof plugins.registerSlot === "function") {
      plugins.registerSlot(PLUGIN_NAME, SLOT_NAME, PreMainBanner);
    }
  }

  // cron-incidents.js
  var cron_incidents_exports = {};
  __export(cron_incidents_exports, {
    createCronIncidentsCard: () => createCronIncidentsCard,
    default: () => register2,
    filterIncidentsByToggle: () => filterIncidentsByToggle,
    normalizeIncidents: () => normalizeIncidents
  });
  var PLUGIN_NAME2 = "nomad";
  var SLOT_NAME2 = "cron:top";
  var INCIDENTS_URL = "/api/plugins/nomad/cron/incidents";
  var STATUS_LABELS2 = {
    detected: "Обнаружен",
    alerted: "Уведомление отправлено",
    resolved: "Принято (закрыт)"
  };
  function normalizeIncidents(payload) {
    const raw = Array.isArray(payload) ? payload : payload && Array.isArray(payload.incidents) ? payload.incidents : [];
    return raw.map((item, idx) => ({
      id: String(item.id || `inc-${idx + 1}`),
      jobId: String(item.job_id || item.jobId || ""),
      jobName: String(item.job_name || item.jobName || item.job_id || `Задача #${idx + 1}`),
      status: String(item.status || "detected"),
      consecutiveFailures: Number(
        item.consecutive_failures ?? item.consecutiveFailures ?? item.repeat_count ?? 1
      ),
      repeatCount: Number(
        item.repeat_count ?? item.consecutive_failures ?? item.consecutiveFailures ?? 1
      ),
      lastError: String(item.last_error || item.error_text || item.lastError || "Ошибка выполнения"),
      errorText: String(item.error_text || item.last_error || item.errorText || "Ошибка выполнения"),
      firstFailedAt: item.first_failed_at || item.firstFailedAt || null,
      lastFailedAt: item.last_failed_at || item.lastFailedAt || null,
      resolvedAt: item.resolved_at || item.resolvedAt || null
    }));
  }
  function filterIncidentsByToggle(incidents, showResolved) {
    const list = Array.isArray(incidents) ? incidents : [];
    if (showResolved) {
      return list;
    }
    return list.filter((item) => item.status === "detected" || item.status === "alerted");
  }
  function createCronIncidentsCard(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    return function CronIncidentsCard() {
      const [incidents, setIncidents] = useState([]);
      const [showResolved, setShowResolved] = useState(false);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      const [ackingId, setAckingId] = useState(null);
      function loadIncidents(includeResolvedFlag) {
        const withResolved = typeof includeResolvedFlag === "boolean" ? includeResolvedFlag : showResolved;
        setLoading(true);
        setError(null);
        const query = withResolved ? "?include_resolved=true" : "?include_resolved=true";
        sdk.fetchJSON(`${INCIDENTS_URL}${query}`).then(
          (data) => {
            setIncidents(normalizeIncidents(data));
            setLoading(false);
          },
          (err) => {
            setError(
              err && err.message ? err.message : "Не удалось загрузить инциденты расписания."
            );
            setLoading(false);
          }
        );
      }
      useEffect(() => {
        let alive = true;
        sdk.fetchJSON(`${INCIDENTS_URL}?include_resolved=true`).then(
          (data) => {
            if (alive) {
              setIncidents(normalizeIncidents(data));
              setLoading(false);
            }
          },
          (err) => {
            if (alive) {
              setError(
                err && err.message ? err.message : "Не удалось загрузить инциденты расписания."
              );
              setLoading(false);
            }
          }
        );
        return () => {
          alive = false;
        };
      }, []);
      function handleAck(incident) {
        if (!incident || !incident.id) {
          return;
        }
        setAckingId(incident.id);
        setError(null);
        setNotice(null);
        const ackUrl = `${INCIDENTS_URL}/${encodeURIComponent(incident.id)}/ack`;
        sdk.fetchJSON(ackUrl, {
          method: "POST",
          body: JSON.stringify({ id: incident.id })
        }).then(
          () => {
            setIncidents(
              (prev) => prev.map(
                (item) => item.id === incident.id ? { ...item, status: "resolved", resolvedAt: (/* @__PURE__ */ new Date()).toISOString() } : item
              )
            );
            setAckingId(null);
            setNotice(`Инцидент задачи «${incident.jobName}» отмечен как принятый.`);
          },
          (err) => {
            setAckingId(null);
            setError(err && err.message ? err.message : "Не удалось подтвердить инцидент.");
          }
        );
      }
      function handleToggleResolved() {
        const next = !showResolved;
        setShowResolved(next);
        loadIncidents(next);
      }
      const visible = filterIncidentsByToggle(incidents, showResolved);
      const openCount = incidents.filter(
        (item) => item.status === "detected" || item.status === "alerted"
      ).length;
      return h(
        "div",
        {
          "data-testid": "nomad-cron-incidents-card",
          style: {
            border: "1px solid rgba(128,128,128,0.25)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            background: openCount > 0 ? "rgba(220,38,38,0.04)" : "rgba(128,128,128,0.04)"
          }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10
            }
          },
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 10 } },
            h(
              "h3",
              { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
              "Инциденты расписания"
            ),
            h(
              "span",
              {
                "data-testid": "cron-incidents-open-badge",
                style: {
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 600,
                  background: openCount > 0 ? "rgba(220,38,38,0.15)" : "rgba(22,163,74,0.14)",
                  color: openCount > 0 ? "#dc2626" : "#16a34a"
                }
              },
              openCount > 0 ? `Открытых: ${openCount}` : "Нет открытых сбоев"
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(
              "button",
              {
                type: "button",
                "data-testid": "cron-incidents-toggle-resolved",
                "aria-pressed": showResolved,
                onClick: handleToggleResolved,
                style: {
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: showResolved ? "rgba(37,99,235,0.12)" : "transparent",
                  fontSize: 12,
                  cursor: "pointer"
                }
              },
              "Показать закрытые"
            ),
            h(
              "button",
              {
                type: "button",
                onClick: () => loadIncidents(showResolved),
                style: {
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: "transparent",
                  fontSize: 12,
                  cursor: "pointer"
                }
              },
              "Обновить"
            )
          )
        ),
        error && h(
          "div",
          {
            role: "alert",
            style: {
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(220,38,38,0.12)",
              color: "#dc2626",
              fontSize: 13
            }
          },
          error
        ),
        notice && h(
          "div",
          {
            role: "status",
            style: {
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(22,163,74,0.12)",
              color: "#16a34a",
              fontSize: 13
            }
          },
          notice
        ),
        loading && h("div", { style: { fontSize: 13, opacity: 0.75 } }, "Загрузка инцидентов расписания…"),
        !loading && visible.length === 0 && h(
          "div",
          { style: { fontSize: 13, opacity: 0.75 } },
          showResolved ? "Журнал инцидентов расписания пуст." : "Все задачи по расписанию выполняются штатно — открытых инцидентов нет."
        ),
        !loading && visible.length > 0 && h(
          "div",
          { style: { display: "flex", flexDirection: "column", gap: 8 } },
          ...visible.map((inc) => {
            const isOpen = inc.status === "detected" || inc.status === "alerted";
            const statusLabel = STATUS_LABELS2[inc.status] || inc.status;
            return h(
              "div",
              {
                key: inc.id,
                "data-testid": `cron-incident-row-${inc.id}`,
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid rgba(128,128,128,0.2)",
                  background: "rgba(128,128,128,0.05)"
                }
              },
              h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 4, flex: "1 1 auto" } },
                h(
                  "div",
                  { style: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
                  h("span", { style: { fontWeight: 600, fontSize: 14 } }, inc.jobName),
                  h(
                    "span",
                    {
                      style: {
                        padding: "2px 7px",
                        borderRadius: 999,
                        fontSize: 11,
                        background: isOpen ? "rgba(220,38,38,0.15)" : "rgba(128,128,128,0.18)",
                        color: isOpen ? "#dc2626" : "inherit"
                      }
                    },
                    statusLabel
                  ),
                  h(
                    "span",
                    {
                      "data-testid": `cron-incident-repeats-${inc.id}`,
                      style: { fontSize: 12, opacity: 0.8 }
                    },
                    `Повторов подряд: ${inc.repeatCount}`
                  )
                ),
                h(
                  "div",
                  {
                    "data-testid": `cron-incident-error-${inc.id}`,
                    style: {
                      fontSize: 12,
                      fontFamily: "monospace",
                      opacity: 0.85,
                      wordBreak: "break-word"
                    }
                  },
                  inc.errorText
                )
              ),
              isOpen && h(
                "button",
                {
                  type: "button",
                  "data-testid": `cron-incident-ack-${inc.id}`,
                  disabled: ackingId === inc.id,
                  onClick: () => handleAck(inc),
                  style: {
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: ackingId === inc.id ? "default" : "pointer",
                    flexShrink: 0
                  }
                },
                ackingId === inc.id ? "Сохранение…" : "Принято"
              )
            );
          })
        )
      );
    };
  }
  function register2({ sdk, plugins }) {
    if (!sdk || !sdk.React || !sdk.hooks) {
      return;
    }
    const CronIncidentsCard = createCronIncidentsCard(sdk);
    if (plugins && typeof plugins.registerSlot === "function") {
      plugins.registerSlot(PLUGIN_NAME2, SLOT_NAME2, CronIncidentsCard);
    }
  }

  // learning-tab.js
  var learning_tab_exports = {};
  __export(learning_tab_exports, {
    createLearningSection: () => createLearningSection,
    default: () => register3,
    filterLearningNodes: () => filterLearningNodes,
    normalizeLearningGraph: () => normalizeLearningGraph
  });
  var LEARNING_GRAPH_URL = "/api/learning/graph";
  var LEARNING_NODE_URL = "/api/learning/node";
  var KIND_LABELS = {
    all: "Все типы",
    skill: "Навык",
    memory: "Заметка памяти",
    preference: "Предпочтение",
    fact: "Факт профиля",
    topic: "Тема",
    project: "Проект"
  };
  function normalizeLearningGraph(payload) {
    const rawNodes = payload && Array.isArray(payload.nodes) ? payload.nodes : Array.isArray(payload) ? payload : [];
    const rawEdges = payload && Array.isArray(payload.edges) ? payload.edges : [];
    const nodes = rawNodes.map((n, idx) => ({
      id: String(n.id || n.node_id || `node-${idx + 1}`),
      label: String(n.label || n.title || n.name || n.id || `Узел #${idx + 1}`),
      kind: String(n.kind || n.type || "memory"),
      domain: String(n.domain || n.category || "general"),
      confidence: typeof n.confidence === "number" ? n.confidence : typeof n.score === "number" ? n.score : 1,
      summary: String(n.summary || n.description || n.snippet || ""),
      updatedAt: n.updated_at || n.updatedAt || null
    }));
    const edges = rawEdges.map((e, idx) => ({
      id: String(e.id || `edge-${idx + 1}`),
      source: String(e.source || e.from || ""),
      target: String(e.target || e.to || ""),
      relation: String(e.relation || e.label || e.type || "связан с")
    }));
    return { nodes, edges };
  }
  function filterLearningNodes(nodes, filters) {
    const list = Array.isArray(nodes) ? nodes : [];
    const f = filters || {};
    const kindFilter = f.kind && f.kind !== "all" ? String(f.kind) : null;
    const domainFilter = f.domain && f.domain !== "all" ? String(f.domain) : null;
    const minConfidence = typeof f.minConfidence === "number" ? f.minConfidence : 0;
    return list.filter((node) => {
      if (kindFilter && node.kind !== kindFilter) {
        return false;
      }
      if (domainFilter && node.domain !== domainFilter) {
        return false;
      }
      if (node.confidence < minConfidence) {
        return false;
      }
      return true;
    });
  }
  function createLearningSection(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    return function LearningSection() {
      const [graph, setGraph] = useState({ nodes: [], edges: [] });
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [kindFilter, setKindFilter] = useState("all");
      const [domainFilter, setDomainFilter] = useState("all");
      const [minConfidence, setMinConfidence] = useState(0);
      const [selectedNode, setSelectedNode] = useState(null);
      const [nodeDetail, setNodeDetail] = useState(null);
      const [loadingDetail, setLoadingDetail] = useState(false);
      function loadGraph() {
        setLoading(true);
        setError(null);
        sdk.fetchJSON(LEARNING_GRAPH_URL).then(
          (data) => {
            setGraph(normalizeLearningGraph(data));
            setLoading(false);
          },
          (err) => {
            setError(
              err && err.message ? err.message : "Не удалось загрузить карту знаний вашего профиля."
            );
            setLoading(false);
          }
        );
      }
      useEffect(() => {
        loadGraph();
      }, []);
      function handleSelectNode(node) {
        if (!node || !node.id) {
          return;
        }
        setSelectedNode(node);
        setLoadingDetail(true);
        setNodeDetail(null);
        const url = `${LEARNING_NODE_URL}?id=${encodeURIComponent(node.id)}`;
        sdk.fetchJSON(url).then(
          (detail) => {
            setNodeDetail(detail || node);
            setLoadingDetail(false);
          },
          () => {
            setNodeDetail(node);
            setLoadingDetail(false);
          }
        );
      }
      const availableKinds = ["all", ...Array.from(new Set(graph.nodes.map((n) => n.kind)))];
      const availableDomains = ["all", ...Array.from(new Set(graph.nodes.map((n) => n.domain)))];
      const filteredNodes = filterLearningNodes(graph.nodes, {
        kind: kindFilter,
        domain: domainFilter,
        minConfidence
      });
      const relatedEdges = selectedNode ? graph.edges.filter(
        (e) => e.source === selectedNode.id || e.target === selectedNode.id
      ) : [];
      return h(
        "div",
        {
          "data-testid": "nomad-dashboard-learning",
          style: { display: "flex", flexDirection: "column", gap: 16 }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12
            }
          },
          h(
            "div",
            null,
            h(
              "h2",
              { style: { margin: 0, fontSize: 18, fontWeight: 600 } },
              "Что агент про меня понял"
            ),
            h(
              "p",
              { style: { margin: "4px 0 0", fontSize: 13, opacity: 0.75 } },
              "Обзор накопленных знаний, навыков и предпочтений вашего профиля (режим только для чтения)."
            )
          ),
          h(
            "div",
            { style: { display: "flex", alignItems: "center", gap: 8 } },
            h(
              "span",
              {
                "data-testid": "learning-summary-badge",
                style: {
                  padding: "5px 10px",
                  borderRadius: 999,
                  background: "rgba(37,99,235,0.1)",
                  fontSize: 12,
                  fontWeight: 600
                }
              },
              `Узлов: ${filteredNodes.length} из ${graph.nodes.length} · Связей: ${graph.edges.length}`
            ),
            h(
              "button",
              {
                type: "button",
                onClick: loadGraph,
                style: {
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.3)",
                  background: "transparent",
                  fontSize: 12,
                  cursor: "pointer"
                }
              },
              "Обновить"
            )
          )
        ),
        h(
          "div",
          {
            "data-testid": "learning-filters-bar",
            style: {
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
              padding: 12,
              borderRadius: 8,
              border: "1px solid rgba(128,128,128,0.2)",
              background: "rgba(128,128,128,0.04)"
            }
          },
          h(
            "label",
            { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 } },
            h("span", null, "Тип (`kind`):"),
            h(
              "select",
              {
                "data-testid": "learning-filter-kind",
                value: kindFilter,
                onChange: (e) => setKindFilter(e && e.target ? e.target.value : "all"),
                style: {
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  fontSize: 13
                }
              },
              ...availableKinds.map(
                (k) => h("option", { key: k, value: k }, KIND_LABELS[k] || k)
              )
            )
          ),
          h(
            "label",
            { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 } },
            h("span", null, "Домен (`domain`):"),
            h(
              "select",
              {
                "data-testid": "learning-filter-domain",
                value: domainFilter,
                onChange: (e) => setDomainFilter(e && e.target ? e.target.value : "all"),
                style: {
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  fontSize: 13
                }
              },
              ...availableDomains.map(
                (d) => h("option", { key: d, value: d }, d === "all" ? "Все домены" : d)
              )
            )
          ),
          h(
            "label",
            { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 13 } },
            h("span", null, `Уверенность от ${Math.round(minConfidence * 100)}%:`),
            h("input", {
              type: "range",
              "data-testid": "learning-filter-confidence",
              min: 0,
              max: 1,
              step: 0.1,
              value: minConfidence,
              onChange: (e) => setMinConfidence(e && e.target ? Number(e.target.value) || 0 : 0)
            })
          )
        ),
        error && h(
          "div",
          {
            role: "alert",
            style: {
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(220,38,38,0.12)",
              color: "#dc2626",
              fontSize: 13
            }
          },
          error
        ),
        loading && h("div", { style: { fontSize: 13, opacity: 0.75 } }, "Загрузка графа знаний…"),
        !loading && filteredNodes.length === 0 && h(
          "div",
          { style: { fontSize: 13, opacity: 0.75 } },
          "По выбранным фильтрам узлы не найдены."
        ),
        !loading && filteredNodes.length > 0 && h(
          "div",
          {
            style: {
              display: "grid",
              gridTemplateColumns: selectedNode ? "1fr 1fr" : "1fr",
              gap: 16
            }
          },
          h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 8 } },
            ...filteredNodes.map(
              (node) => h(
                "button",
                {
                  key: node.id,
                  type: "button",
                  "data-testid": `learning-node-item-${node.id}`,
                  onClick: () => handleSelectNode(node),
                  style: {
                    textAlign: "left",
                    padding: 12,
                    borderRadius: 8,
                    border: selectedNode && selectedNode.id === node.id ? "1px solid #2563eb" : "1px solid rgba(128,128,128,0.25)",
                    background: selectedNode && selectedNode.id === node.id ? "rgba(37,99,235,0.08)" : "rgba(128,128,128,0.04)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4
                  }
                },
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8
                    }
                  },
                  h("span", { style: { fontWeight: 600, fontSize: 14 } }, node.label),
                  h(
                    "span",
                    { style: { fontSize: 11, opacity: 0.75 } },
                    `${KIND_LABELS[node.kind] || node.kind} · ${node.domain} · ${Math.round(
                      node.confidence * 100
                    )}%`
                  )
                ),
                node.summary && h("div", { style: { fontSize: 12, opacity: 0.8 } }, node.summary)
              )
            )
          ),
          selectedNode && h(
            "div",
            {
              "data-testid": "learning-node-detail-card",
              style: {
                border: "1px solid rgba(128,128,128,0.25)",
                borderRadius: 10,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10
              }
            },
            h(
              "div",
              {
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }
              },
              h(
                "h3",
                { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
                selectedNode.label
              ),
              h(
                "span",
                { style: { fontSize: 11, opacity: 0.7 } },
                "Только просмотр"
              )
            ),
            loadingDetail && h("div", { style: { fontSize: 12, opacity: 0.75 } }, "Загрузка содержимого узла…"),
            !loadingDetail && h(
              "pre",
              {
                "data-testid": "learning-node-content",
                style: {
                  margin: 0,
                  padding: 10,
                  borderRadius: 6,
                  background: "rgba(128,128,128,0.08)",
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word"
                }
              },
              String(
                nodeDetail && (nodeDetail.content || nodeDetail.summary || nodeDetail.text) || selectedNode.summary || "Подробное описание узла отсутствует."
              )
            ),
            relatedEdges.length > 0 && h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 4 } },
              h("div", { style: { fontSize: 12, fontWeight: 600 } }, "Связанные узлы:"),
              ...relatedEdges.map(
                (edge) => h(
                  "div",
                  { key: edge.id, style: { fontSize: 12, opacity: 0.8 } },
                  `${edge.source} → ${edge.relation} → ${edge.target}`
                )
              )
            )
          )
        )
      );
    };
  }
  function register3({ sdk, addSection }) {
    if (!sdk || !sdk.React || !sdk.hooks) {
      return;
    }
    const LearningSection = createLearningSection(sdk);
    if (typeof addSection === "function") {
      addSection({
        id: "learning",
        title: "Что агент про меня понял",
        order: 30,
        component: LearningSection
      });
    }
  }

  // models-tab.js
  var models_tab_exports = {};
  __export(models_tab_exports, {
    LOCAL_SERVER_PRESETS: () => LOCAL_SERVER_PRESETS,
    createModelsSection: () => createModelsSection,
    default: () => register4,
    extractModelIdsFromProbe: () => extractModelIdsFromProbe
  });
  var LOCAL_MODELS_API = "/api/plugins/nomad/models/local";
  var LOCAL_MODELS_TEST_API = "/api/plugins/nomad/models/local/test";
  var LOCAL_MODELS_ACTIVATE_API = "/api/plugins/nomad/models/local/activate";
  var UPSTREAM_LOCAL_CATALOG_API = "/api/local-models/catalog";
  var UPSTREAM_LOCAL_DOWNLOAD_API = "/api/local-models/download";
  var UPSTREAM_LOCAL_ACTIVATE_API = "/api/local-models/activate";
  var LOCAL_SERVER_PRESETS = [
    {
      id: "ollama",
      label: "Ollama",
      defaultBaseUrl: "http://127.0.0.1:11434",
      probePath: "/api/tags",
      openaiBaseUrl: "http://127.0.0.1:11434/v1",
      description: "Локальный сервер Ollama (проверка через /api/tags)."
    },
    {
      id: "lmstudio",
      label: "LM Studio",
      defaultBaseUrl: "http://127.0.0.1:1234",
      probePath: "/api/v1/models",
      openaiBaseUrl: "http://127.0.0.1:1234/v1",
      description: "Локальный сервер LM Studio (проверка через /api/v1/models)."
    },
    {
      id: "vllm",
      label: "vLLM",
      defaultBaseUrl: "http://127.0.0.1:8000",
      probePath: "/v1/models",
      openaiBaseUrl: "http://127.0.0.1:8000/v1",
      description: "Высокопроизводительный сервер vLLM (проверка через /v1/models)."
    }
  ];
  function extractModelIdsFromProbe(payload) {
    if (!payload || typeof payload !== "object") {
      return [];
    }
    if (Array.isArray(payload.models)) {
      return payload.models.map(
        (item) => typeof item === "string" ? item : String(item && (item.id || item.name || item.model || item.key) || "")
      ).filter(Boolean);
    }
    if (Array.isArray(payload.data)) {
      return payload.data.map(
        (item) => typeof item === "string" ? item : String(item && (item.id || item.name || item.model) || "")
      ).filter(Boolean);
    }
    return [];
  }
  function createModelsSection(sdk) {
    const h = sdk.React.createElement;
    const { useState, useEffect } = sdk.hooks;
    return function ModelsSection() {
      const [activePreset, setActivePreset] = useState("ollama");
      const [serverBaseUrl, setServerBaseUrl] = useState("http://127.0.0.1:11434");
      const [discoveredModels, setDiscoveredModels] = useState([]);
      const [selectedModel, setSelectedModel] = useState("");
      const [currentModel, setCurrentModel] = useState({ model: "", provider: "", baseUrl: "" });
      const [customBaseUrl, setCustomBaseUrl] = useState("");
      const [customApiKey, setCustomApiKey] = useState("");
      const [customModelsText, setCustomModelsText] = useState("");
      const [customDiscovered, setCustomDiscovered] = useState([]);
      const [catalogModels, setCatalogModels] = useState([]);
      const [testing, setTesting] = useState(false);
      const [activating, setActivating] = useState(false);
      const [downloadingId, setDownloadingId] = useState(null);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [notice, setNotice] = useState(null);
      function loadState() {
        setLoading(true);
        setError(null);
        sdk.fetchJSON(LOCAL_MODELS_API).then(
          (data) => {
            if (data && typeof data === "object") {
              setCurrentModel({
                model: String(data.model || ""),
                provider: String(data.provider || ""),
                baseUrl: String(data.base_url || data.baseUrl || "")
              });
              if (Array.isArray(data.models) && data.models.length > 0) {
                setDiscoveredModels(data.models.map(String));
                setSelectedModel(String(data.models[0]));
              }
              if (data.custom_base_url) {
                setCustomBaseUrl(String(data.custom_base_url));
              }
              if (Array.isArray(data.custom_models) && data.custom_models.length > 0) {
                setCustomModelsText(data.custom_models.join(", "));
                setCustomDiscovered(data.custom_models.map(String));
              }
            }
            setLoading(false);
          },
          () => {
            setLoading(false);
          }
        );
        sdk.fetchJSON(UPSTREAM_LOCAL_CATALOG_API).then(
          (cat) => {
            const list = Array.isArray(cat) ? cat : cat && Array.isArray(cat.models) ? cat.models : [];
            setCatalogModels(list);
          },
          () => {
          }
        );
      }
      useEffect(() => {
        loadState();
      }, []);
      function handleSelectPreset(presetId) {
        const preset = LOCAL_SERVER_PRESETS.find((p) => p.id === presetId) || LOCAL_SERVER_PRESETS[0];
        setActivePreset(preset.id);
        setServerBaseUrl(preset.defaultBaseUrl);
        setError(null);
        setNotice(null);
      }
      function handleTestConnection(targetKind) {
        const isCustom = targetKind === "custom";
        const preset = LOCAL_SERVER_PRESETS.find((p) => p.id === activePreset) || LOCAL_SERVER_PRESETS[0];
        const baseUrl = (isCustom ? customBaseUrl : serverBaseUrl).trim();
        if (!baseUrl) {
          setError("Пожалуйста, укажите адрес сервера (base_url).");
          return;
        }
        setTesting(true);
        setError(null);
        setNotice(null);
        const manualModels = isCustom ? customModelsText.split(",").map((s) => s.trim()).filter(Boolean) : [];
        sdk.fetchJSON(LOCAL_MODELS_TEST_API, {
          method: "POST",
          body: JSON.stringify({
            kind: isCustom ? "custom" : preset.id,
            base_url: baseUrl,
            probe_path: isCustom ? "/v1/models" : preset.probePath,
            api_key: isCustom ? customApiKey.trim() : "",
            models: manualModels
          })
        }).then(
          (data) => {
            setTesting(false);
            const models = extractModelIdsFromProbe(data);
            if (isCustom) {
              const merged = models.length > 0 ? models : manualModels;
              setCustomDiscovered(merged);
              if (merged.length > 0 && !selectedModel) {
                setSelectedModel(merged[0]);
              }
            } else {
              setDiscoveredModels(models);
              if (models.length > 0) {
                setSelectedModel(models[0]);
              }
            }
            if (data && data.reachable === false) {
              setError(
                data.message || "Сервер не ответил на запрос проверки. Проверьте, что локальный сервер запущен."
              );
            } else {
              setNotice(
                data && data.message || `Соединение проверено успешно. Найдено моделей: ${models.length}.`
              );
            }
          },
          (err) => {
            setTesting(false);
            setError(err && err.message ? err.message : "Не удалось проверить соединение.");
          }
        );
      }
      function handleActivateModel(modelName, options) {
        const opts = options || {};
        const targetModel = String(modelName || selectedModel || "").trim();
        if (!targetModel) {
          setError("Выберите или укажите идентификатор модели для активации.");
          return;
        }
        setActivating(true);
        setError(null);
        setNotice(null);
        const preset = LOCAL_SERVER_PRESETS.find((p) => p.id === activePreset) || LOCAL_SERVER_PRESETS[0];
        const isCustom = Boolean(opts.isCustom);
        const baseUrl = isCustom ? customBaseUrl.trim() : (opts.baseUrl || serverBaseUrl || preset.openaiBaseUrl).trim();
        sdk.fetchJSON(LOCAL_MODELS_ACTIVATE_API, {
          method: "POST",
          body: JSON.stringify({
            model: targetModel,
            provider: isCustom ? "custom" : preset.id,
            base_url: baseUrl,
            api_key: isCustom ? customApiKey.trim() : "",
            models: isCustom ? customModelsText.split(",").map((s) => s.trim()).filter(Boolean) : discoveredModels
          })
        }).then(
          (data) => {
            setActivating(false);
            setCurrentModel({
              model: data && data.model || targetModel,
              provider: data && data.provider || (isCustom ? "custom" : preset.id),
              baseUrl: data && data.base_url || baseUrl
            });
            setNotice(`Модель «${targetModel}» назначена вашей рабочей моделью.`);
          },
          (err) => {
            setActivating(false);
            setError(err && err.message ? err.message : "Не удалось активировать выбранную модель.");
          }
        );
      }
      function handleDownloadAndActivateCatalogModel(item) {
        const modelId = String(item && (item.id || item.model_id || item.name) || "");
        if (!modelId) {
          return;
        }
        setDownloadingId(modelId);
        setError(null);
        setNotice(null);
        sdk.fetchJSON(UPSTREAM_LOCAL_DOWNLOAD_API, {
          method: "POST",
          body: JSON.stringify({ model_id: modelId })
        }).then(
          () => sdk.fetchJSON(UPSTREAM_LOCAL_ACTIVATE_API, {
            method: "POST",
            body: JSON.stringify({ model_id: modelId })
          }),
          () => sdk.fetchJSON(LOCAL_MODELS_ACTIVATE_API, {
            method: "POST",
            body: JSON.stringify({
              model: modelId,
              provider: "llamacpp",
              base_url: "http://127.0.0.1:8080/v1"
            })
          })
        ).then(
          () => {
            setDownloadingId(null);
            setCurrentModel({
              model: modelId,
              provider: "llamacpp",
              baseUrl: "http://127.0.0.1:8080/v1"
            });
            setNotice(`Локальная модель «${modelId}» подготовлена и назначена рабочей моделью.`);
          },
          (err) => {
            setDownloadingId(null);
            setError(err && err.message ? err.message : "Не удалось подготовить локальную модель.");
          }
        );
      }
      const currentPreset = LOCAL_SERVER_PRESETS.find((p) => p.id === activePreset) || LOCAL_SERVER_PRESETS[0];
      return h(
        "div",
        {
          "data-testid": "nomad-dashboard-models",
          style: { display: "flex", flexDirection: "column", gap: 16 }
        },
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12
            }
          },
          h(
            "div",
            null,
            h(
              "h2",
              { style: { margin: 0, fontSize: 18, fontWeight: 600 } },
              "Модели и локальные серверы"
            ),
            h(
              "p",
              { style: { margin: "4px 0 0", fontSize: 13, opacity: 0.75 } },
              "Подключайте локальные серверы (Ollama, LM Studio, vLLM) или собственные OpenAI-совместимые эндпоинты для работы без внешних ключей."
            )
          ),
          currentModel.model && h(
            "div",
            {
              "data-testid": "active-model-badge",
              style: {
                padding: "6px 12px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.12)",
                fontSize: 13,
                fontWeight: 600
              }
            },
            `Рабочая модель: ${currentModel.model}`
          )
        ),
        error && h(
          "div",
          {
            role: "alert",
            style: {
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(220,38,38,0.12)",
              color: "#dc2626",
              fontSize: 13
            }
          },
          error
        ),
        notice && h(
          "div",
          {
            role: "status",
            style: {
              padding: "8px 12px",
              borderRadius: 6,
              background: "rgba(22,163,74,0.12)",
              color: "#16a34a",
              fontSize: 13
            }
          },
          notice
        ),
        loading && h("div", { style: { fontSize: 13, opacity: 0.75 } }, "Загрузка настроек моделей…"),
        h(
          "div",
          {
            "data-testid": "local-servers-card",
            style: {
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }
          },
          h("h3", { style: { margin: 0, fontSize: 15, fontWeight: 600 } }, "Локальные серверы ИИ"),
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            ...LOCAL_SERVER_PRESETS.map(
              (preset) => h(
                "button",
                {
                  key: preset.id,
                  type: "button",
                  "data-testid": `preset-btn-${preset.id}`,
                  onClick: () => handleSelectPreset(preset.id),
                  style: {
                    padding: "6px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(128,128,128,0.3)",
                    background: activePreset === preset.id ? "#2563eb" : "transparent",
                    color: activePreset === preset.id ? "#fff" : "inherit",
                    fontSize: 13,
                    fontWeight: activePreset === preset.id ? 600 : 400,
                    cursor: "pointer"
                  }
                },
                preset.label
              )
            )
          ),
          h(
            "div",
            { style: { fontSize: 12, opacity: 0.75 } },
            `${currentPreset.description} Маршрут проверки: ${currentPreset.probePath}`
          ),
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
            h("input", {
              type: "text",
              "data-testid": "local-server-url-input",
              value: serverBaseUrl,
              onChange: (e) => setServerBaseUrl(e && e.target ? e.target.value : ""),
              placeholder: currentPreset.defaultBaseUrl,
              "aria-label": "Адрес локального сервера",
              style: {
                flex: "1 1 260px",
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.35)",
                fontSize: 13
              }
            }),
            h(
              "button",
              {
                type: "button",
                "data-testid": "test-local-connection-btn",
                disabled: testing,
                onClick: () => handleTestConnection("local"),
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  background: "transparent",
                  fontSize: 13,
                  cursor: testing ? "default" : "pointer"
                }
              },
              testing ? "Проверка…" : "Проверить соединение"
            )
          ),
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" } },
            h("input", {
              type: "text",
              "data-testid": "local-model-name-input",
              value: selectedModel,
              onChange: (e) => setSelectedModel(e && e.target ? e.target.value : ""),
              placeholder: "Имя локальной модели (например, qwen2.5-coder:7b)",
              "aria-label": "Имя локальной модели",
              style: {
                flex: "1 1 260px",
                padding: "7px 10px",
                borderRadius: 6,
                border: "1px solid rgba(128,128,128,0.35)",
                fontSize: 13
              }
            }),
            h(
              "button",
              {
                type: "button",
                "data-testid": "activate-local-model-btn",
                disabled: activating,
                onClick: () => handleActivateModel(selectedModel, { isCustom: false }),
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: activating ? "default" : "pointer"
                }
              },
              "Сделать рабочей моделью"
            )
          ),
          discoveredModels.length > 0 && h(
            "div",
            { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
            ...discoveredModels.map(
              (m) => h(
                "button",
                {
                  key: m,
                  type: "button",
                  onClick: () => setSelectedModel(m),
                  style: {
                    padding: "4px 10px",
                    borderRadius: 999,
                    border: "1px solid rgba(128,128,128,0.3)",
                    background: selectedModel === m ? "rgba(37,99,235,0.15)" : "transparent",
                    fontSize: 12,
                    cursor: "pointer"
                  }
                },
                m
              )
            )
          )
        ),
        h(
          "div",
          {
            "data-testid": "custom-endpoint-card",
            style: {
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12
            }
          },
          h(
            "h3",
            { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
            "Свой OpenAI-совместимый эндпоинт"
          ),
          h(
            "p",
            { style: { margin: 0, fontSize: 12, opacity: 0.75 } },
            "Укажите базовый URL (base_url), необязательный API-ключ и список моделей через запятую."
          ),
          h("input", {
            type: "text",
            "data-testid": "custom-base-url-input",
            value: customBaseUrl,
            onChange: (e) => setCustomBaseUrl(e && e.target ? e.target.value : ""),
            placeholder: "https://llm.internal.example/v1",
            "aria-label": "Базовый URL (base_url)",
            style: {
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid rgba(128,128,128,0.35)",
              fontSize: 13
            }
          }),
          h("input", {
            type: "password",
            "data-testid": "custom-api-key-input",
            value: customApiKey,
            onChange: (e) => setCustomApiKey(e && e.target ? e.target.value : ""),
            placeholder: "API-ключ (необязательно для локальных прокси)",
            "aria-label": "API-ключ (api_key)",
            style: {
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid rgba(128,128,128,0.35)",
              fontSize: 13
            }
          }),
          h("input", {
            type: "text",
            "data-testid": "custom-models-input",
            value: customModelsText,
            onChange: (e) => setCustomModelsText(e && e.target ? e.target.value : ""),
            placeholder: "Список моделей через запятую (например, deepseek-r1, qwen-2.5-72b)",
            "aria-label": "Список моделей",
            style: {
              padding: "7px 10px",
              borderRadius: 6,
              border: "1px solid rgba(128,128,128,0.35)",
              fontSize: 13
            }
          }),
          h(
            "div",
            { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
            h(
              "button",
              {
                type: "button",
                "data-testid": "test-custom-connection-btn",
                disabled: testing,
                onClick: () => handleTestConnection("custom"),
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "1px solid rgba(128,128,128,0.35)",
                  background: "transparent",
                  fontSize: 13,
                  cursor: testing ? "default" : "pointer"
                }
              },
              "Проверить соединение"
            ),
            h(
              "button",
              {
                type: "button",
                "data-testid": "activate-custom-model-btn",
                disabled: activating,
                onClick: () => {
                  const firstCustom = customDiscovered[0] || customModelsText.split(",").map((s) => s.trim()).filter(Boolean)[0] || selectedModel;
                  handleActivateModel(firstCustom, { isCustom: true });
                },
                style: {
                  padding: "7px 14px",
                  borderRadius: 6,
                  border: "none",
                  background: "#2563eb",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: activating ? "default" : "pointer"
                }
              },
              "Сделать рабочей моделью"
            )
          )
        ),
        catalogModels.length > 0 && h(
          "div",
          {
            "data-testid": "catalog-models-card",
            style: {
              border: "1px solid rgba(128,128,128,0.25)",
              borderRadius: 10,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10
            }
          },
          h(
            "h3",
            { style: { margin: 0, fontSize: 15, fontWeight: 600 } },
            "Каталог автономных GGUF-моделей"
          ),
          ...catalogModels.map((item, idx) => {
            const mId = String(item.id || item.model_id || item.name || `model-${idx + 1}`);
            return h(
              "div",
              {
                key: mId,
                style: {
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  background: "rgba(128,128,128,0.06)"
                }
              },
              h("span", { style: { fontSize: 13, fontWeight: 500 } }, item.label || mId),
              h(
                "button",
                {
                  type: "button",
                  disabled: downloadingId === mId,
                  onClick: () => handleDownloadAndActivateCatalogModel(item),
                  style: {
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    fontSize: 12,
                    cursor: "pointer"
                  }
                },
                downloadingId === mId ? "Загрузка…" : "Скачать и сделать рабочей моделью"
              )
            );
          })
        )
      );
    };
  }
  function register4({ sdk, addSection }) {
    if (!sdk || !sdk.React || !sdk.hooks) {
      return;
    }
    const ModelsSection = createModelsSection(sdk);
    if (typeof addSection === "function") {
      addSection({
        id: "models",
        title: "Модели и локальные серверы",
        order: 20,
        component: ModelsSection
      });
    }
  }

  // dashboard-entry.js
  startNomadDashboard([
    ["accounts-tab.js", accounts_tab_exports],
    ["cron-incidents.js", cron_incidents_exports],
    ["learning-tab.js", learning_tab_exports],
    ["models-tab.js", models_tab_exports]
  ]);
})();
