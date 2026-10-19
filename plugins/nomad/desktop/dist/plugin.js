// package/plugins/nomad/desktop/src/index.js
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
      checking: "Checking the plugin backend\u2026",
      ok: (version) => `Plugin backend is up \xB7 version ${version}`,
      degraded: (version) => `Plugin backend is up, but not all screens are connected \xB7 version ${version}`,
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
      checking: "\u041F\u0440\u043E\u0432\u0435\u0440\u044F\u0435\u043C \u0441\u0435\u0440\u0432\u0435\u0440 \u043F\u043B\u0430\u0433\u0438\u043D\u0430\u2026",
      ok: (version) => `\u0421\u0435\u0440\u0432\u0435\u0440 \u043F\u043B\u0430\u0433\u0438\u043D\u0430 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \xB7 \u0432\u0435\u0440\u0441\u0438\u044F ${version}`,
      degraded: (version) => `\u0421\u0435\u0440\u0432\u0435\u0440 \u043F\u043B\u0430\u0433\u0438\u043D\u0430 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442, \u043D\u043E \u043D\u0435 \u0432\u0441\u0435 \u044D\u043A\u0440\u0430\u043D\u044B \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u043B\u0438\u0441\u044C \xB7 \u0432\u0435\u0440\u0441\u0438\u044F ${version}`,
      down: "\u0421\u0435\u0440\u0432\u0435\u0440 \u043F\u043B\u0430\u0433\u0438\u043D\u0430 \u043D\u0435 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442",
      hint: "\u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435, \u0447\u0442\u043E \u043E\u0442\u043A\u0440\u044B\u0442 \u043F\u0440\u043E\u0444\u0438\u043B\u044C nomad \u0438 \u043F\u043B\u0430\u0433\u0438\u043D Nomad \u0432\u043A\u043B\u044E\u0447\u0451\u043D \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \xAB\u041F\u043B\u0430\u0433\u0438\u043D\u044B\xBB, \u0437\u0430\u0442\u0435\u043C \u043F\u0435\u0440\u0435\u0437\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435.",
      screens: "\u042D\u043A\u0440\u0430\u043D\u044B",
      none: "\u042D\u043A\u0440\u0430\u043D\u043E\u0432 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442",
      problems: "\u041D\u0435\u043F\u043E\u043B\u0430\u0434\u043A\u0438"
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
        const register = mod.default;
        if (register === void 0) {
          continue;
        }
        if (typeof register !== "function") {
          problems.push({ file, message: "default export is not a register(ctx) function" });
          console.error(`[nomad] ${file}: default export is not a register(ctx) function`);
          continue;
        }
        try {
          register(scopedContext(ctx, pageKey(file), () => navRows += 1));
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
export {
  PLUGIN_ID,
  STATUS_PATH,
  createNomadPlugin
};
