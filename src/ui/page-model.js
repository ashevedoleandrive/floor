/* Floor · page-model.js — Impact, /model
   ---------------------------------------------------------------------
   The operator-driven model of what the tool is worth. Two rules matter
   more than the arithmetic:

   1. ACV is blank until someone types it. Nothing downstream of a blank
      ACV invents a number; it prints the statRow ghost dash and says why
      in words (m.noInvent), per DESIGN-SPEC §3.6.
   2. Every figure is either measured or a judgement, and the page says
      which. Cost per account is pulled straight from data.cost (real
      token counts from real runs). Minutes saved and both conversion
      rates are the operator's assumptions, named as such.

   Calculator logic is carried over unchanged from the pre-rebuild
   src/lib/views.js + public/static/app.js (recompute()): same formula,
   same defaults, same "extra accounts the freed hours buy" argument.
   It is duplicated once here for the server-rendered first paint
   (computeImpact) and once in script() for the live client recompute,
   because a Worker-side function and a string of inlined client JS
   cannot share one implementation. Keep the two in step.

   Kit gaps found while building this page (reported, not worked around
   by re-implementing kit.js):
   - statRow() has no per-item `id`, so a figure that a client script
     must update in place has to carry its own <span id> inside the raw
     `value` HTML. Works, but every recompute page will hit this.
   - statRow() has no "wide" cell for a figure whose explanatory note
     runs long (the annual-value ratio sentence). Solved here by giving
     that figure its own single-item statRow rather than cramming a
     multi-line note into a nowrap/ellipsis cell, but a real wide variant
     would be cleaner for any future page with the same shape.
   --------------------------------------------------------------------- */

import { esc, num, money, well, field, statRow, section } from "./kit.js";

export const meta = {
  route: "/model",
  nav: "/model",
  titleKey: "nav.case",
};

export const keys = {
  /* one hero for both halves of the case, where there used to be two
     40px heroes on two tabs saying the same beat twice */
  "cs.title": {
    en: "What it is worth now, and wired.",
    es: "Lo que vale ahora, y conectado.",
  },
  "cs.lede": {
    en: "Change any input and every output recomputes. Average contract value stays blank until you type it.",
    es: "Cambia cualquier entrada y todas las salidas se recalculan. El valor promedio de contrato queda en blanco hasta que lo escribas.",
  },
  /* measured against assumed, carried on the group labels it describes */
  "m.measureVsAssume": {
    en: "One number here is measured: cost per account, from real token counts across every run. Minutes saved and both conversion rates are judgement calls you are choosing to test.",
    es: "Un número aquí es medido: el costo por cuenta, de conteos reales de tokens en cada análisis. Los minutos ahorrados y ambas tasas de conversión son juicios que tú eliges poner a prueba.",
  },
  "m.measuredNote": {
    en: "Measured from {n} of {of} accounts Floor has actually assessed, {total} spent in total. Override it if your real cost differs.",
    es: "Medido de {n} de {of} cuentas que Floor ya evaluó, {total} gastados en total. Cámbialo si tu costo real es distinto.",
  },
  "m.outputsLabel": {
    en: "What it is worth",
    es: "Lo que vale",
  },
  /* the page's one authored argument, where the value figure lands */
  "cs.lever": {
    en: "The floor filter is the win-rate lever: a merchant under the floor cannot become a customer, so every hour spent on one is a hole in the win rate by construction.",
    es: "El filtro del umbral es la palanca de la tasa de cierre: un comercio bajo el umbral no puede volverse cliente, así que cada hora invertida en uno es un hueco en la tasa de cierre por construcción.",
  },
  /* absorbed from Day one, which was the same argument on a second tab */
  "cs.wiredSub": {
    en: "public sources, free tiers, no access to your production systems",
    es: "fuentes públicas, planes gratuitos, sin acceso a tus sistemas de producción",
  },
  "w.sysLabel": { en: "System by system", es: "Sistema por sistema" },
  "w.honestLabel": { en: "Scope and limits", es: "Alcance y límites" },
  "w.regs.name": {
    en: "SEC EDGAR, UK Companies House & the EU statutory registries",
    es: "SEC EDGAR, el registro mercantil británico y los registros estatutarios de la UE",
  },
  "w.regs.now": {
    en: "Two are connected. SEC EDGAR resolves US filers from a filed figure before any search runs. Companies House reads UK filed accounts, published only as PDF, and established ASOS, a merchant no US regulator has heard of. The EU registries are not wired.",
    es: "Dos están conectados. SEC EDGAR resuelve a los emisores de EE. UU. con una cifra presentada antes de cualquier búsqueda. Companies House lee las cuentas presentadas en el Reino Unido, publicadas solo en PDF, y estableció ASOS, un comercio que ningún regulador de EE. UU. conoce. Los registros de la UE no están conectados.",
  },
  "w.regs.later": {
    en: "In Europe the EU Accounting Directive puts filed accounts behind a public registry per country (Germany's Bundesanzeiger, the Dutch Chamber of Commerce, France's Commercial Court): the single biggest coverage gain available in this system, for free. Neither reaches a private US company or fills LATAM, APAC or AMEA.",
    es: "En Europa la Directiva de Contabilidad de la UE pone las cuentas presentadas detrás de un registro público por país (el Bundesanzeiger en Alemania, la Cámara de Comercio en Holanda, el Tribunal de Comercio en Francia): la mayor ganancia de cobertura disponible en este sistema, y gratis. Ninguno llega a una empresa privada de EE. UU. ni llena LATAM, APAC o AMEA.",
  },
  "w.h0": {
    en: "Floor ranks the account universe you give it. It does not build one: today's {n} accounts were seeded by hand, and Apollo or Sales Navigator is what would generate that universe at Yuno's real scale.",
    es: "Floor clasifica el universo de cuentas que le das. No construye uno: las {n} cuentas de hoy se sembraron a mano, y Apollo o Sales Navigator serían lo que genere ese universo a la escala real de Yuno.",
  },
};

/** The formula. Mirrors script()'s client-side recompute exactly; see the
 *  header note on why this cannot be one shared function. `win` (today's
 *  win rate) is deliberately unused: it is display-only context for the
 *  reader, same as the original implementation. */
function computeImpact({ sdrs, worked, mins, mins2, conv, conv2, win2, cost, acv }) {
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const accountsNow = Math.max(0, n(sdrs)) * Math.max(0, n(worked));
  const hoursNow = (accountsNow * n(mins)) / 60;
  const hoursNew = (accountsNow * n(mins2)) / 60;
  const freed = hoursNow - hoursNew;
  // Stay in minutes. Dividing into hours and multiplying back out lands a
  // hair under the integer often enough to matter: across a sweep of ordinary
  // inputs it printed 999 for 1000 and 1,299 for 1,300, always low and always
  // on exactly the round figures somebody reads out loud.
  const freedMinutes = accountsNow * (n(mins) - n(mins2));
  const extra = n(mins2) > 0 ? Math.floor(freedMinutes / n(mins2)) : 0;
  const opps = accountsNow * (n(conv2) / 100 - n(conv) / 100);
  const monthlyCost = (accountsNow + extra) * n(cost);
  const acvN = Math.max(0, n(acv));
  const annual = acvN > 0 ? opps * 12 * acvN * (n(win2) / 100) : 0;
  const ratio = acvN > 0 && monthlyCost !== 0 ? annual / (monthlyCost * 12) : 0;
  return { freed, extra, opps, monthlyCost, annual, ratio };
}

const signedInt = (n) => `${n < 0 ? "-" : "+"}${num(Math.abs(Math.round(n)))}`;
const signedDec1 = (n) => `${n < 0 ? "-" : "+"}${Math.abs(n).toFixed(1)}`;

export async function render(env, data, ctx) {
  const { t } = ctx;
  const q = data || {};
  const totalAccounts = q.cost?.total_accounts ?? q.rows?.length ?? 0;
  const cost = q.cost || { per_account: 0, assessed: 0, total_accounts: 0, total: 0 };
  const acvRaw = q.settings?.acv_usd;
  const acv0 = acvRaw !== "" && acvRaw != null && !Number.isNaN(Number(acvRaw)) ? Number(acvRaw) : 0;

  // Defaults identical to the client's own defaults, so first paint is a
  // real reading rather than a blank one (§3.10: server-rendered pages
  // arrive complete).
  const D = {
    sdrs: 5, worked: 65, mins: 30, mins2: 5,
    conv: 7, conv2: 10.5, win: 4.6, win2: 11.5,
    cost: Number(cost.per_account || 0),
    acv: acv0,
  };
  const r = computeImpact(D);
  const acvOn = D.acv > 0;

  const hoursTxt = `${Math.round(r.freed)} h`;
  const extraTxt = signedInt(r.extra);
  const oppsTxt = signedDec1(r.opps);
  const costTxt = money(r.monthlyCost);
  const valueTxt = acvOn ? `$${num(Math.round(r.annual))}` : "–";
  const ratioTxt = acvOn
    ? t("m.ratio", { w: D.win2, r: num(Math.round(r.ratio)) })
    : t("m.noInvent");

  /* the measured-against-assumed distinction rides on the group labels
     it describes, instead of standing above them as a paragraph */
  const groupTip = esc(t("m.measureVsAssume"));

  const inputsWell = well(`
    <span class="m-grp t-label" title="${groupTip}">${esc(t("m.grpToday"))}</span>
    ${field({ id: "m-sdrs", label: t("m.sdrs"), value: D.sdrs, type: "number", min: 0, step: 1, mono: true })}
    ${field({ id: "m-worked", label: t("m.worked"), value: D.worked, type: "number", min: 0, step: 1, mono: true })}
    ${field({ id: "m-mins", label: t("m.mins"), value: D.mins, type: "number", min: 0, step: 1, mono: true })}
    ${field({ id: "m-conv", label: t("m.conv"), value: D.conv, type: "number", min: 0, step: 0.1, suffix: "%", mono: true })}
    ${field({ id: "m-win", label: t("m.win"), value: D.win, type: "number", min: 0, step: 0.1, suffix: "%", mono: true })}
    <span class="m-grp t-label" title="${groupTip}">${esc(t("m.grpFloor"))}</span>
    ${field({ id: "m-mins2", label: t("m.mins"), value: D.mins2, type: "number", min: 0, step: 1, mono: true })}
    ${field({ id: "m-conv2", label: t("m.conv"), value: D.conv2, type: "number", min: 0, step: 0.1, suffix: "%", mono: true })}
    ${field({ id: "m-win2", label: t("m.winTarget"), value: D.win2, type: "number", min: 0, step: 0.1, suffix: "%", mono: true })}
    ${field({
      id: "m-cost", label: t("m.costPer"), value: D.cost, type: "number", min: 0, step: 0.0001,
      suffix: "USD", mono: true,
      hint: t("m.measuredNote", {
        n: num(cost.assessed || 0), of: num(cost.total_accounts || 0), total: money(cost.total || 0),
      }),
    })}
  `);

  const acvWell = well(
    field({
      id: "m-acv", label: t("m.acv"), value: acvOn ? String(D.acv) : "", type: "number", min: 0, step: 1,
      mono: true, placeholder: t("m.acvPh"), hint: t("m.acvNote"),
    }),
    { tone: "held" },
  );

  const outRow1 = statRow([
    { label: t("m.oHours"), value: `<span id="o-hours">${esc(hoursTxt)}</span>`, note: t("m.oHoursD") },
    { label: t("m.oExtra"), value: `<span id="o-extra">${esc(extraTxt)}</span>`, note: t("m.oExtraD") },
    { label: t("m.oOpps"), value: `<span id="o-opps">${esc(oppsTxt)}</span>`, note: t("m.oOppsD") },
    { label: t("m.oCost"), value: `<span id="o-cost">${esc(costTxt)}</span>`, note: t("m.oCostD") },
  ]);
  const outRow2 = statRow([
    {
      label: t("m.oValue"),
      value: `<span id="o-value"${acvOn ? "" : ' class="oval-empty"'}>${esc(valueTxt)}</span>`,
    },
  ]);

  /* Day one, absorbed: the same argument one beat later. Six systems as
     one aligned Today / Wired list, then what the 48 hours did not buy. */
  const systems = [
    { name: "Salesforce", now: t("w.sf.now"), later: t("w.sf.later") },
    { name: "Apollo", now: t("w.apollo.now"), later: t("w.apollo.later") },
    { name: "Sales Navigator", now: t("w.notUsed"), later: t("w.nav.later") },
    { name: "Gong Engage", now: t("w.notUsed"), later: t("w.gong.later") },
    { name: t("w.bc.name"), now: t("w.bc.now"), later: t("w.bc.later") },
    { name: t("w.regs.name"), now: t("w.regs.now"), later: t("w.regs.later") },
  ];

  const list = systems.map((s) => `
    <div class="w-sys">
      <h3 class="w-name t-section">${esc(s.name)}</h3>
      <div class="w-row">
        <span class="w-lbl t-label">${esc(t("w.today"))}</span>
        <p class="w-txt t-body">${esc(s.now)}</p>
      </div>
      <div class="w-row w-wired">
        <span class="w-lbl t-label">${esc(t("w.wired"))}</span>
        <p class="w-txt t-body">${esc(s.later)}</p>
      </div>
    </div>`).join("");

  const honest = [
    t("w.h0", { n: num(totalAccounts) }),
    t("w.h1"),
    t("w.h2"),
    t("w.h3"),
    t("w.h4"),
  ].map((line) => `<li>${esc(line)}</li>`).join("");

  const body = `
  <section class="m-hero">
    <span class="m-eyebrow t-label">${esc(t("m.eyebrow"))}</span>
    <h1 class="m-h1">${esc(t("cs.title"))}</h1>
    <p class="m-lede t-body">${esc(t("cs.lede"))}</p>
  </section>

  <div class="m-grid">
    <div class="m-in">
      ${inputsWell}
      ${acvWell}
    </div>
    <div class="m-out">
      <span class="m-grp t-label">${esc(t("m.outputsLabel"))}</span>
      <div class="m-out-row1">${outRow1}</div>
      <div class="m-out-row2">${outRow2}</div>
      <p id="o-ratio" class="t-body m-ratio">${esc(ratioTxt)}</p>
      <p class="m-lever t-body">${esc(t("cs.lever"))}</p>
    </div>
  </div>

  ${section({
    label: t("w.sysLabel"),
    title: t("w.title"),
    sub: esc(t("cs.wiredSub")),
    body: `<div class="w-list">${list}</div>`,
  })}

  ${section({
    label: t("w.honestLabel"),
    title: t("w.honestTitle"),
    body: `<ul class="w-honest">${honest}</ul>`,
  })}
  `;

  return body;
}

export function css() {
  return `
    .p-model .m-hero { padding: 8px 0 0; max-width: 760px; }
    .p-model .m-eyebrow { color: var(--ink-3); display: block; margin-bottom: 12px; }
    .p-model .m-h1 { font: 650 40px/1.08 var(--sans); letter-spacing: -.02em; margin: 0 0 16px; color: var(--ink-1); }
    .p-model .m-lede { max-width: 68ch; color: var(--ink-2); }
    .p-model .m-lede b { color: var(--ink-1); }

    .p-model .m-grid {
      display: grid; grid-template-columns: minmax(0,5fr) minmax(0,7fr);
      gap: 48px; margin-top: 48px; align-items: start;
    }
    .p-model .m-in { display: flex; flex-direction: column; gap: 16px; }
    .p-model .m-grp { display: block; color: var(--ink-3); }
    .p-model .m-in .well .m-grp:not(:first-child) { margin-top: 4px; }
    .p-model .well .fld { margin: 0; }
    .p-model .well .fld + .fld { margin-top: 16px; }
    .p-model .well .m-grp + .fld { margin-top: 8px; }
    .p-model .well .fld + .m-grp { margin-top: 20px; }

    .p-model .m-out { display: block; }
    .p-model .m-out .m-grp { display: block; margin-bottom: 8px; }
    .p-model .m-out-row1 { display: block; }
    .p-model .m-out-row2 {
      display: block; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--line);
    }
    .p-model .m-ratio {
      margin: 8px 0 0; max-width: 56ch; color: var(--ink-2); font-size: 13px; line-height: 1.5;
    }
    .p-model .m-lever {
      margin: 24px 0 0; padding-top: 16px; border-top: 1px solid var(--line);
      max-width: 56ch; color: var(--ink-1);
    }

    /* the wired comparison, absorbed from Day one */
    .p-model .w-list { display: flex; flex-direction: column; gap: 32px; }
    .p-model .w-sys { padding-top: 4px; }
    .p-model .w-name { margin: 0 0 4px; color: var(--ink-1); }
    .p-model .w-row {
      display: grid; grid-template-columns: 96px 1fr; column-gap: 16px;
      padding: 10px 0; border-top: 1px solid var(--line);
    }
    .p-model .w-lbl { color: var(--ink-3); padding-top: 2px; }
    .p-model .w-txt { margin: 0; max-width: 68ch; color: var(--ink-2); }
    .p-model .w-wired .w-txt {
      border-left: 2px dashed var(--line-2); padding-left: 12px; color: var(--ink-1);
    }
    .p-model .w-honest { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .p-model .w-honest li {
      position: relative; padding-left: 18px; max-width: 64ch;
      color: var(--ink-2); font-size: 14px; line-height: 1.55;
    }
    .p-model .w-honest li::before {
      content: ""; position: absolute; left: 0; top: 7px; width: 6px; height: 6px; background: var(--ink-3);
    }

    /* the recompute pulse: a colour transition, not a loop. A recomputed
       figure is a state change, and DESIGN-SPEC §4.7 keeps the 300ms
       colour pulse on this page as the one named exception to the
       transform/opacity-only rule in §3.9. */
    .p-model .stat-v { transition: color .28s var(--ease); }
    .p-model .stat.tick .stat-v { color: var(--accent); }
    .p-model .m-ratio.tick { color: var(--accent); }
    .p-model .oval-empty { color: var(--ink-4); font-weight: 400; }

    @media (max-width: 860px) {
      .p-model .m-grid { grid-template-columns: 1fr; gap: 32px; }
    }
    @media (max-width: 640px) {
      .p-model .w-row { grid-template-columns: 72px 1fr; }
    }
    @media (prefers-reduced-motion: reduce) {
      .p-model .stat-v, .p-model .m-ratio { transition: none; }
    }
  `;
}

export function script() {
  return `(() => {
    "use strict";
    var ids = ["m-sdrs","m-worked","m-mins","m-mins2","m-conv","m-conv2","m-win","m-win2","m-acv","m-cost"];
    var inputs = ids.map(function (id) { return document.getElementById(id); }).filter(Boolean);
    var cells = document.querySelectorAll(".p-model .m-out-row1 .stat");
    var valCell = document.querySelector(".p-model .m-out-row2 .stat");
    var ratioEl = document.getElementById("o-ratio");
    if (!inputs.length || cells.length < 4 || !valCell || !ratioEl) return;

    var num0 = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
    var val = function (id) { var el = document.getElementById(id); return num0(el && el.value); };
    var signed = function (n, dp) {
      var s = dp ? Math.abs(n).toFixed(dp) : Math.abs(Math.round(n)).toLocaleString("en-US");
      return (n < 0 ? "-" : "+") + s;
    };
    var money2 = function (n) { return "$" + Number(n || 0).toFixed(2); };
    var moneyInt = function (n) { return "$" + Math.round(n || 0).toLocaleString("en-US"); };

    var pulse = function (el) {
      el.classList.remove("tick");
      void el.offsetWidth;
      el.classList.add("tick");
      setTimeout(function () { el.classList.remove("tick"); }, 320);
    };
    var setVal = function (cell, text) {
      var v = cell.querySelector(".stat-v");
      if (v) v.textContent = text;
      pulse(cell);
    };

    function recompute() {
      var sdrs = val("m-sdrs"), worked = val("m-worked");
      var mins = val("m-mins"), mins2 = val("m-mins2");
      var conv = val("m-conv") / 100, conv2 = val("m-conv2") / 100;
      var win2 = val("m-win2"), cost = val("m-cost"), acv = Math.max(0, val("m-acv"));

      var accountsNow = Math.max(0, sdrs) * Math.max(0, worked);
      var hoursNow = (accountsNow * mins) / 60;
      var hoursNew = (accountsNow * mins2) / 60;
      var freed = hoursNow - hoursNew;
      // Minutes throughout; see the note on computeImpact. The client and the
      // server must agree exactly, or the number changes when you touch a field.
      var freedMinutes = accountsNow * (mins - mins2);
      var extra = mins2 > 0 ? Math.floor(freedMinutes / mins2) : 0;
      var opps = accountsNow * (conv2 - conv);
      var monthlyCost = (accountsNow + extra) * cost;

      setVal(cells[0], Math.round(freed) + " h");
      setVal(cells[1], signed(extra, 0));
      setVal(cells[2], signed(opps, 1));
      setVal(cells[3], money2(monthlyCost));

      var vEl = valCell.querySelector(".stat-v");
      if (acv > 0) {
        var annual = opps * 12 * acv * (win2 / 100);
        var ratio = monthlyCost !== 0 ? annual / (monthlyCost * 12) : 0;
        if (vEl) { vEl.textContent = moneyInt(annual); vEl.classList.remove("oval-empty"); }
        if (window.Floor) {
          ratioEl.textContent = window.Floor.t("m.ratio", { w: win2, r: Math.round(ratio).toLocaleString("en-US") });
        }
      } else {
        if (vEl) { vEl.textContent = "–"; vEl.classList.add("oval-empty"); }
        if (window.Floor) ratioEl.textContent = window.Floor.t("m.noInvent");
      }
      pulse(valCell);
      pulse(ratioEl);
    }

    inputs.forEach(function (el) { el.addEventListener("input", recompute); });
  })();`;
}
