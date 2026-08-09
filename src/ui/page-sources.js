/* Floor · page-sources.js — the Sources page (route /sources)
   ---------------------------------------------------------------------
   Two things on one page: the source registry (ten sources, one wired,
   what each unlocks and where it stops per region) and the classification
   rules that decide which tier every claim's source is graded at.

   The durable claim this page exists to make: provenance, adversarial
   checking, abstention and a measured accuracy score make any source safe
   to sell on. The trust layer does not change when the sources improve.
   That sentence is carried by existing authored copy (src.note + src.lede
   + verdict.abstainNote), reused rather than rewritten, per the contract's
   "reuse an existing key" rule.

   Data: render() receives GET /api/sources synchronously (data param).
   Classification rules come from a separate client-side fetch of
   GET /api/source-rules, per the loading doctrine in DESIGN-SPEC §3.10:
   a client-fetched region renders placeholder rows first, then its real
   layout, and every mutation repaints the same region in place. Because
   that region is built and repainted entirely in the browser, script()
   below hand-builds the same markup kit.js would produce server-side
   (same classes, same structure) rather than importing kit.js into the
   browser, which is not possible for a plain inlined <script>.
   --------------------------------------------------------------------- */

import { esc, mark, level, section, table, btn, field, dialog } from "./kit.js";

export const meta = { route: "/sources", nav: "/sources", titleKey: "nav.sources" };

const REGION_SHORT = { NORTHAMERICA: "NA", EUROPE: "EU", APAC: "APAC", LATAM: "LATAM", AMEA: "AMEA" };
const REGION_KEY = {
  NORTHAMERICA: "src.region.NORTHAMERICA",
  EUROPE: "src.region.EUROPE",
  APAC: "src.region.APAC",
  LATAM: "src.region.LATAM",
  AMEA: "src.region.AMEA",
};
const LEVEL_RANK = { none: 0, weak: 1, partial: 2, strong: 3 };
const KIND_KEY = {
  evidence: "src.kind.evidence",
  volume: "src.kind.volume",
  footprint: "src.kind.footprint",
  timing: "dim.timing",
  truth: "src.kind.truth",
};
const COST_KEY = {
  included: "src.cost.included",
  free: "src.cost.free",
  low: "src.cost.low",
  paid: "src.cost.paid",
  enterprise: "src.cost.enterprise",
  owned: "src.cost.owned",
};

const CHEV_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 7l3-3.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ============================== copy ================================ */
/* Genuinely new to this page. Everything else (rules.*, src.covTitle,
   tier.*, cov.*, dim.timing, action.save, common.notSaved, ...) already
   exists in i18n.js and is reused as-is. */

export const keys = {
  "src.headerMeta": {
    en: "{connected} of {total} connected · {free} free and unwired · {regions} regions",
    es: "{connected} de {total} conectadas · {free} gratis y sin conectar · {regions} regiones",
  },
  "src.status.available": { en: "Available", es: "Disponible" },
  "src.colRegion":   { en: "Region", es: "Región" },
  "src.colSource":   { en: "Source", es: "Fuente" },
  "src.colKind":     { en: "Kind", es: "Tipo" },
  "src.colCost":     { en: "Cost", es: "Costo" },
  "src.colCoverage": { en: "By region", es: "Por región" },
  "src.kind.evidence":  { en: "Evidence", es: "Evidencia" },
  "src.kind.volume":    { en: "Volume", es: "Volumen" },
  "src.kind.footprint": { en: "Footprint", es: "Huella" },
  "src.kind.truth":     { en: "Truth", es: "Verdad" },
  "src.cost.included":   { en: "Included", es: "Incluido" },
  "src.cost.free":       { en: "Free", es: "Gratis" },
  "src.cost.low":        { en: "Low cost", es: "Costo bajo" },
  "src.cost.paid":       { en: "Paid", es: "Pago" },
  "src.cost.enterprise": { en: "Enterprise", es: "Empresarial" },
  "src.cost.owned":      { en: "Already yours", es: "Ya es tuyo" },
  "src.region.NORTHAMERICA": { en: "North America", es: "Norteamérica" },
  "src.region.EUROPE":       { en: "Europe", es: "Europa" },
  "src.region.APAC":         { en: "APAC", es: "APAC" },
  "src.region.LATAM":        { en: "LATAM", es: "LATAM" },
  "src.region.AMEA":         { en: "AMEA", es: "AMEA" },
  "src.rowDetailsAria": { en: "Source details", es: "Detalles de la fuente" },
  "src.seeMap": { en: "See it as a map →", es: "Verlo como mapa →" },
  "src.enOnlyNote": {
    en: "Source and rule descriptions on this page are authored in English.",
    es: "Las descripciones de fuentes y reglas en esta página están escritas en inglés.",
  },

  "rules.testLabel": { en: "Test a URL", es: "Probar una URL" },
  "rules.testPh": {
    en: "Paste a source URL to see which rule matches",
    es: "Pega una URL de fuente para ver qué regla coincide",
  },
  "rules.testEmpty": {
    en: "Type a URL to see which rule would match.",
    es: "Escribe una URL para ver qué regla coincidiría.",
  },
  "rules.testMatch": {
    en: "Matches the rule at order {order}: {tier}, weight {w}.",
    es: "Coincide con la regla de orden {order}: {tier}, peso {w}.",
  },
  "rules.testNoMatch": {
    en: "No rule matches. Falls through to {tier} at weight {w}.",
    es: "Ninguna regla coincide. Cae en {tier} con peso {w}.",
  },
  "rules.patternHint": {
    en: "Matched as a case-insensitive substring of the source URL.",
    es: "Se compara como un fragmento de la URL, sin distinguir mayúsculas.",
  },
  "rules.weightHint": {
    en: "0 to 1. What this source is worth when a claim is scored.",
    es: "De 0 a 1. Cuánto vale esta fuente cuando se califica una afirmación.",
  },
  "rules.weightRange":    { en: "Weight must be between 0 and 1.", es: "El peso debe estar entre 0 y 1." },
  "rules.positionRange":  { en: "Order must be a positive number.", es: "El orden debe ser un número positivo." },
  "rules.patternRequired": {
    en: "Enter a URL fragment to match.",
    es: "Escribe un fragmento de URL para buscar coincidencias.",
  },
  "rules.dupBlock": {
    en: "A rule for this pattern already exists at order {order} ({label}). Edit that one instead, or it would never match.",
    es: "Ya existe una regla para este patrón en el orden {order} ({label}). Edita esa en su lugar, o esta nunca coincidiría.",
  },
  "rules.unknownTier": { en: "Choose a classification tier.", es: "Elige un nivel de clasificación." },
  "rules.edit":     { en: "Edit", es: "Editar" },
  "rules.fldLabel": { en: "Label shown on screen", es: "Etiqueta que se muestra" },
  "rules.fldNote":  { en: "Why this rule exists", es: "Por qué existe esta regla" },
  "rules.editTitle": { en: "Edit a classification rule", es: "Editar una regla de clasificación" },
  "rules.moveUp":   { en: "Move up", es: "Subir" },
  "rules.moveDown": { en: "Move down", es: "Bajar" },
  "rules.savedToast":     { en: "Rule saved.", es: "Regla guardada." },
  "rules.addedToast":     { en: "Rule added.", es: "Regla agregada." },
  "rules.deletedToast":   { en: "Rule deleted.", es: "Regla eliminada." },
  "rules.enabledToast":   { en: "Rule enabled.", es: "Regla activada." },
  "rules.disabledToast":  { en: "Rule disabled.", es: "Regla desactivada." },

  "action.retry": { en: "Retry", es: "Reintentar" },
};

/* ============================ SSR pieces ============================= */

function regionStrip(source) {
  const items = Object.keys(REGION_SHORT).map((r) => {
    const lvl = source.coverage?.[r] || "none";
    return `<span class="src-rs-i">${level(LEVEL_RANK[lvl] ?? 0, 3, REGION_SHORT[r])}</span>`;
  }).join("");
  return `<div class="src-rs">${items}</div>`;
}

function registryExpansion(source, t) {
  const rows = Object.keys(REGION_SHORT).map((r) => {
    const lvl = source.coverage?.[r] || "none";
    return `<div class="src-exp-row"><span class="t-data">${esc(t(REGION_KEY[r]))}</span>${level(LEVEL_RANK[lvl] ?? 0, 3, t(`cov.${lvl}`))}</div>`;
  }).join("");
  return `<div class="src-exp">
    <div><span class="t-label ink-3">${esc(t("src.unlocks"))}</span><p class="t-body">${esc(source.unlocks)}</p></div>
    <div><span class="t-label ink-3">${esc(t("src.limits"))}</span><p class="t-body">${esc(source.limits)}</p></div>
    <div><span class="t-label ink-3">${esc(t("src.covByRegion"))}</span>
      <div class="src-exp-grid">${rows}</div>
    </div>
  </div>`;
}

function registryRow(source, t) {
  const connected = source.status === "connected";
  const nameCell = `<div class="src-row-name">
    ${mark(connected ? "filled" : "hollow", connected ? t("src.connected") : t("src.status.available"), { tone: connected ? "ok" : "mute" })}
    <span class="src-row-txt"><b class="t-data">${esc(source.name)}</b><span class="src-what">${esc(source.what)}</span></span>
  </div>`;
  const kindCell = `<span class="t-label ink-3">${esc(t(KIND_KEY[source.kind] || source.kind))}</span>`;
  const costCell = `<span class="t-data">${esc(t(COST_KEY[source.cost] || source.cost))}</span>`;
  const covCell = regionStrip(source);
  const chevCell = `<div class="chev-cell"><button type="button" class="btn-icon chev" data-action="src:expand" aria-expanded="false" aria-label="${esc(t("src.rowDetailsAria"))}">${CHEV_SVG}</button></div>`;
  return { id: source.id, cells: [nameCell, kindCell, costCell, covCell, chevCell], inset: registryExpansion(source, t) };
}

function comparisonRow(now, wired, t) {
  const nowRank = LEVEL_RANK[now.level] ?? 0;
  const wiredRank = LEVEL_RANK[wired.level] ?? 0;
  const rising = wiredRank > nowRank;
  const contributors = wired.contributors || [];
  const contribText = contributors.length
    ? esc(contributors.slice(0, 3).join(" · ")) + (contributors.length > 3 ? ` ${esc(t("src.nMore", { n: contributors.length - 3 }))}` : "")
    : esc(t("src.nothingWired"));
  return {
    id: now.region,
    cells: [
      `<span class="t-data">${esc(t(REGION_KEY[now.region] || now.region))}</span>`,
      level(nowRank, 3, t(`cov.${now.level}`)),
      `<span class="cmp-arrow${rising ? " up" : ""}" aria-hidden="true">&rarr;</span>`,
      mark("dashed", t(`cov.${wired.level}`), { tone: "mute" }),
      `<span class="t-data ink-3">${contribText}</span>`,
    ],
  };
}

function loadingRows() {
  return Array.from({ length: 5 }).map(() => `<div class="ph-row"></div>`).join("");
}

function ruleDialogBody(t) {
  return `
    ${field({ id: "rd-pattern", label: t("rules.pattern"), placeholder: t("rules.phPattern"), hint: t("rules.patternHint"), mono: true })}
    ${field({ id: "rd-tier", label: t("rules.tier"), options: [
      { value: "primary_filing", label: t("tier.primaryStrong") },
      { value: "self_published", label: t("tier.self") },
      { value: "documentation", label: t("tier.doc") },
      { value: "third_party", label: t("tier.third") },
    ] })}
    ${field({ id: "rd-label", label: t("rules.fldLabel"), placeholder: t("rules.phLabel") })}
    ${field({ id: "rd-weight", label: t("rules.weight"), type: "number", value: "0.8", step: "0.05", min: "0", max: "1", hint: t("rules.weightHint"), mono: true })}
    ${field({ id: "rd-position", label: t("rules.order"), type: "number", value: "500", step: "1", min: "1", hint: t("rules.dlgHint"), mono: true })}
    ${field({ id: "rd-note", label: t("rules.fldNote"), placeholder: t("rules.phNote") })}
  `;
}

/* ============================== render =============================== */

export async function render(env, data, ctx) {
  const { t, lang } = ctx;
  const regions = data.regions || Object.keys(REGION_SHORT);

  const headerMeta = t("src.headerMeta", {
    connected: data.connected, total: data.total, free: data.free_and_unwired, regions: regions.length,
  });

  const cmpRows = (data.coverage_now || []).map((now, i) => comparisonRow(now, data.coverage_wired[i], t));
  const registryRows = (data.sources || []).map((s) => registryRow(s, t));

  const enNote = lang === "es" ? `<p class="claim-en t-data ink-4">${esc(t("src.enOnlyNote"))}</p>` : "";

  const comparisonSection = section({
    label: t("src.eyebrow"),
    title: t("src.covTitle"),
    sub: esc(t("src.covSub")),
    body: `
      <p class="t-body see-map"><a href="/coverage">${esc(t("src.seeMap"))}</a></p>
      ${table({
        cols: [
          { key: "region", label: t("src.colRegion") },
          { key: "now", label: t("src.now") },
          { key: "arrow", label: "" },
          { key: "wired", label: t("src.wired") },
          { key: "lifts", label: t("src.whoLifts") },
        ],
        rows: cmpRows,
      }, t)}
      <p class="foot t-data ink-3">${esc(t("src.covFoot"))}</p>
    `,
  });

  const registrySection = section({
    title: t("src.regTitle"),
    sub: esc(t("src.regSub")),
    body: `
      ${table({
        cols: [
          { key: "source", label: t("src.colSource") },
          { key: "kind", label: t("src.colKind"), width: 120 },
          { key: "cost", label: t("src.colCost"), width: 100 },
          { key: "cov", label: t("src.colCoverage"), width: 260 },
          { key: "chev", label: "", width: 36 },
        ],
        rows: registryRows,
        size: "tall",
      }, t)}
      <p class="foot t-data ink-3">${esc(t("src.regFoot"))}</p>
    `,
  });

  const rulesSection = section({
    title: t("rules.title"),
    sub: esc(t("rules.sub")),
    actions: `
      <input type="text" id="rule-test-url" class="input mono" style="width:220px" placeholder="${esc(t("rules.testPh"))}" aria-label="${esc(t("rules.testLabel"))}" disabled>
      ${btn(t("rules.add"), { kind: "primary", id: "rule-add-btn" })}
    `,
    body: `
      <p class="t-data ink-3" id="rule-test-result">${esc(t("rules.testEmpty"))}</p>
      <div id="rules-slot">${loadingRows()}</div>
    `,
  });

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.sources"))}</h1>
        <span class="whead-meta">${esc(headerMeta)}</span>
      </div>
    </div>
    <p class="claim t-body">${esc(t("src.note"))} ${t("src.lede")}</p>
    <p class="claim-sub t-data ink-2">${esc(t("verdict.abstainNote"))}</p>
    ${enNote}

    ${comparisonSection}
    ${registrySection}
    ${rulesSection}

    ${dialog({ id: "rule-dlg", title: t("rules.dlgTitle"), body: ruleDialogBody(t), confirm: t("action.save") }, t)}
  `;
}

/* =============================== css ================================== */

export function css() {
  return `
.p-sources .claim { max-width: 64ch; margin-top: 16px; }
.p-sources .claim-sub { max-width: 64ch; margin-top: 8px; }
.p-sources .claim-en { max-width: 64ch; margin-top: 8px; }
.p-sources .see-map { margin-top: 0; }
.p-sources .foot { max-width: 72ch; margin-top: 12px; }

.p-sources .cmp-arrow { color: var(--ink-4); font-size: 14px; }
.p-sources .cmp-arrow.up { color: var(--accent); }

.p-sources .src-rs { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.p-sources .src-rs-i .mk-w { font-size: 11px; }

.p-sources .src-row-name { display: flex; align-items: flex-start; gap: 8px; }
.p-sources .src-row-name .mk { margin-top: 3px; }
.p-sources .src-row-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.p-sources .src-row-txt b { font-weight: 500; }
.p-sources .src-what {
  display: block; color: var(--ink-3); font-size: 12px; line-height: 1.4;
  max-width: 46ch;
}

.p-sources .chev-cell { display: flex; justify-content: flex-end; }
.p-sources .chev svg { transition: transform .18s var(--ease); }
.p-sources .chev[aria-expanded="true"] svg { transform: rotate(180deg); }

.p-sources .src-exp { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 24px; }
.p-sources .src-exp p { margin-top: 4px; }
.p-sources .src-exp-grid { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.p-sources .src-exp-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }

.p-sources .rule-tier { display: flex; flex-direction: column; gap: 3px; }

.p-sources #rule-test-result { margin-top: 0; min-height: 1.45em; }

@media (max-width: 900px) {
  .p-sources .src-exp { grid-template-columns: 1fr; }
}
`;
}

/* =============================== script ================================ */

export function script() {
  return `(() => {
  "use strict";

  var RULES = [];
  var TOTAL = 0;
  var UNMATCHED = 0;
  var FALLBACK_W = 0.35;
  var editingId = null;

  /* ---- hand-built equivalents of kit.js primitives, plain JS, no
     imports. A plain inline <script> cannot import an ES module, and
     this region is client-fetched by design (DESIGN-SPEC §3.10), so its
     markup is built here to match kit.js's classes exactly. ---- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }
  function fmtNum(n) {
    return (n == null || isNaN(Number(n))) ? "" : Number(n).toLocaleString("en-US");
  }
  var MARK_SVG = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  };
  function mk(kind, label, tone) {
    return '<span class="mk tone-' + (tone || "ink") + '">' + (MARK_SVG[kind] || "") + '<span class="mk-w">' + esc(label) + "</span></span>";
  }
  var DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

  function ruleMenuHtml(items) {
    var rows = items.map(function (it) {
      if (it === "-") return '<div class="menu-sep" role="separator"></div>';
      var danger = it.danger ? " danger" : "";
      return '<button type="button" class="menu-item' + danger + '" role="menuitem" data-action="' + esc(it.action || "") + '"' + (it.danger ? ' data-danger="1"' : "") + '>' + esc(it.label) + "</button>";
    }).join("");
    return '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(Floor.t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + "</div></div>";
  }

  function ruleTableHead() {
    return "<tr>" +
      '<th class="num" style="width:56px">' + esc(Floor.t("rules.order")) + "</th>" +
      "<th>" + esc(Floor.t("rules.pattern")) + "</th>" +
      "<th>" + esc(Floor.t("rules.tier")) + "</th>" +
      '<th class="num" style="width:72px">' + esc(Floor.t("rules.weight")) + "</th>" +
      '<th class="num" style="width:96px">' + esc(Floor.t("rules.matches")) + "</th>" +
      "<th>" + esc(Floor.t("rules.why")) + "</th>" +
      '<th class="col-menu"></th>' +
    "</tr>";
  }

  function ruleRowHtml(r, idx, total) {
    var dim = !r.enabled;
    var tierLabel = r.label || r.tier;
    var tierCell = '<div class="rule-tier"><span class="t-data">' + esc(tierLabel) + "</span>" + (dim ? mk("hollow", Floor.t("rules.off"), "mute") : "") + "</div>";
    var matches = r.enabled ? fmtNum(r.matches || 0) : "\\u2013";
    var items = [];
    items.push({ label: Floor.t("rules.edit") || "Edit", action: "rule:edit" });
    items.push({ label: r.enabled ? Floor.t("rules.disable") : Floor.t("rules.enable"), action: "rule:toggle" });
    if (idx > 0) items.push({ label: Floor.t("rules.moveUp"), action: "rule:moveup" });
    if (idx < total - 1) items.push({ label: Floor.t("rules.moveDown"), action: "rule:movedown" });
    if (!r.builtin) { items.push("-"); items.push({ label: Floor.t("rules.delete"), action: "rule:delete", danger: true }); }
    var cls = dim ? ' class="row-dim"' : "";
    return '<tr data-id="' + esc(r.id) + '"' + cls + ">" +
      '<td class="num mono">' + esc(r.position) + "</td>" +
      '<td class="mono">' + esc(r.pattern) + "</td>" +
      "<td>" + tierCell + "</td>" +
      '<td class="num mono">' + esc(Number(r.weight).toFixed(2)) + "</td>" +
      '<td class="num mono">' + matches + "</td>" +
      '<td class="ink-3">' + esc(r.note || "") + "</td>" +
      '<td class="col-menu">' + ruleMenuHtml(items) + "</td>" +
    "</tr>";
  }

  function sortedRules() {
    return RULES.slice().sort(function (a, b) { return a.position - b.position || a.id - b.id; });
  }

  function renderRulesSlot() {
    var sorted = sortedRules();
    var bodyHtml = sorted.length
      ? sorted.map(function (r, i) { return ruleRowHtml(r, i, sorted.length); }).join("")
      : '<tr><td colspan="7" style="height:auto;border-bottom:0;padding:16px 0"><div class="f-empty"><p>' + esc(Floor.t("rules.empty")) + "</p></div></td></tr>";
    var footText = Floor.t("rules.footA", { total: TOTAL, unmatched: UNMATCHED, w: FALLBACK_W }) + " " + (UNMATCHED ? Floor.t("rules.footB") : Floor.t("rules.footC"));
    return '<div id="rules-slot">' +
      '<div class="tbl-wrap"><table class="tbl tbl-dense"><thead>' + ruleTableHead() + "</thead><tbody>" + bodyHtml + "</tbody></table></div>" +
      '<p class="foot t-data ink-3">' + footText + "</p>" +
    "</div>";
  }

  function paintRules() {
    Floor.replace("#rules-slot", renderRulesSlot());
  }

  function fetchRules() {
    fetch("/api/source-rules").then(function (r) { return r.json(); }).then(function (d) {
      RULES = d.rules || [];
      TOTAL = d.total || 0;
      UNMATCHED = d.unmatched || 0;
      FALLBACK_W = d.fallback_weight != null ? d.fallback_weight : 0.35;
      var testInput = document.getElementById("rule-test-url");
      if (testInput) testInput.disabled = false;
      paintRules();
    }).catch(function () {
      var slot = document.getElementById("rules-slot");
      if (slot) slot.innerHTML =
        '<p class="f-error">' + esc(Floor.t("rules.loadFail")) +
        ' <button type="button" class="btn btn-text" id="rules-retry">' + esc(Floor.t("action.retry")) + "</button></p>";
    });
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "rules-retry") fetchRules();
  });

  /* ---- field errors, plain DOM, matches .fld / .fld-err from floor.css ---- */

  function setFieldError(id, msg) {
    var ctrl = document.getElementById(id);
    if (!ctrl) return;
    var wrap = ctrl.closest(".fld");
    if (!wrap) return;
    var err = wrap.querySelector(".fld-err");
    if (!msg) {
      if (err) err.remove();
      ctrl.removeAttribute("aria-invalid");
      return;
    }
    if (!err) {
      err = document.createElement("p");
      err.className = "fld-err";
      wrap.appendChild(err);
    }
    err.textContent = msg;
    ctrl.setAttribute("aria-invalid", "true");
  }
  function clearRuleFormErrors() {
    ["rd-pattern", "rd-weight", "rd-position"].forEach(function (id) { setFieldError(id, null); });
  }

  /* ---- add / edit dialog ---- */

  var ruleDlg = document.getElementById("rule-dlg");

  function nextPosition() {
    if (!RULES.length) return 500;
    var max = RULES.reduce(function (a, r) { return Math.max(a, r.position); }, 0);
    return max + 10;
  }

  function openRuleDialog(rule) {
    if (!ruleDlg) return;
    clearRuleFormErrors();
    editingId = rule ? rule.id : null;
    var titleEl = document.getElementById("rule-dlg-t");
    if (titleEl) titleEl.textContent = rule ? Floor.t("rules.editTitle") : Floor.t("rules.dlgTitle");
    document.getElementById("rd-pattern").value = rule ? rule.pattern : "";
    document.getElementById("rd-tier").value = rule ? rule.tier : "primary_filing";
    document.getElementById("rd-label").value = rule ? (rule.label || "") : "";
    document.getElementById("rd-weight").value = rule ? rule.weight : 0.8;
    document.getElementById("rd-position").value = rule ? rule.position : nextPosition();
    document.getElementById("rd-note").value = rule ? (rule.note || "") : "";
    ruleDlg.showModal();
  }

  var addBtn = document.getElementById("rule-add-btn");
  if (addBtn) addBtn.addEventListener("click", function () { openRuleDialog(null); });

  function findDuplicate(pattern, excludeId) {
    var p = pattern.trim().toLowerCase();
    return RULES.find(function (r) { return r.id !== excludeId && String(r.pattern).toLowerCase() === p; });
  }

  function validateAndCollect() {
    var pattern = document.getElementById("rd-pattern").value.trim();
    var tier = document.getElementById("rd-tier").value;
    var label = document.getElementById("rd-label").value.trim();
    var weight = Number(document.getElementById("rd-weight").value);
    var position = Number(document.getElementById("rd-position").value);
    var note = document.getElementById("rd-note").value.trim();
    var ok = true;
    clearRuleFormErrors();
    if (!pattern) { setFieldError("rd-pattern", Floor.t("rules.patternRequired")); ok = false; }
    else {
      var dup = findDuplicate(pattern, editingId);
      if (dup) { setFieldError("rd-pattern", Floor.t("rules.dupBlock", { order: dup.position, label: dup.label })); ok = false; }
    }
    if (isNaN(weight) || weight < 0 || weight > 1) { setFieldError("rd-weight", Floor.t("rules.weightRange")); ok = false; }
    if (isNaN(position) || position < 1) { setFieldError("rd-position", Floor.t("rules.positionRange")); ok = false; }
    if (!ok) return null;
    return { pattern: pattern, tier: tier, label: label || undefined, weight: weight, position: position, note: note || undefined };
  }

  function friendlyRuleError(msg) {
    if (msg === "pattern_and_tier_required") return Floor.t("rules.patternRequired");
    if (msg === "unknown_tier") return Floor.t("rules.unknownTier");
    return msg;
  }

  function applyRulesPayload(d) {
    RULES = d.rules || RULES;
    if (d.total != null) TOTAL = d.total;
    if (d.unmatched != null) UNMATCHED = d.unmatched;
    if (d.fallback_weight != null) FALLBACK_W = d.fallback_weight;
  }

  var ruleForm = ruleDlg ? ruleDlg.querySelector("form") : null;
  if (ruleForm) {
    ruleForm.addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (!submitter || submitter.value !== "confirm") return;
      e.preventDefault();
      var payload = validateAndCollect();
      if (!payload) return;
      var wasEdit = editingId != null;
      if (wasEdit) payload.id = editingId;
      Floor.post("/api/source-rules", payload).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        ruleDlg.close();
        editingId = null;
        Floor.toast(wasEdit ? Floor.t("rules.savedToast") : Floor.t("rules.addedToast"));
      }).catch(function (err) {
        setFieldError("rd-pattern", friendlyRuleError((err && err.message) || Floor.t("rules.loadFail")));
      });
    });
  }

  /* ---- row menu / expand actions, dispatched by floor.js as floor:action ---- */

  document.addEventListener("floor:action", function (e) {
    var detail = e.detail || {};
    var action = detail.action;

    if (action === "src:expand") {
      var elBtn = detail.el;
      var tr = elBtn && elBtn.closest("tr");
      var next = tr && tr.nextElementSibling;
      if (next && next.classList.contains("tbl-inset")) {
        var willOpen = next.hidden;
        next.hidden = !willOpen;
        elBtn.setAttribute("aria-expanded", String(willOpen));
      }
      return;
    }

    if (!action || action.indexOf("rule:") !== 0) return;
    var id = detail.id != null ? Number(detail.id) : null;
    var rule = RULES.find(function (r) { return r.id === id; });

    if (action === "rule:edit") {
      if (rule) openRuleDialog(rule);
      return;
    }

    if (action === "rule:toggle") {
      if (!rule) return;
      var wasEnabled = rule.enabled;
      Floor.post("/api/source-rules", { toggle_id: id }).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        Floor.toast(wasEnabled ? Floor.t("rules.disabledToast") : Floor.t("rules.enabledToast"), {
          undo: function () {
            Floor.post("/api/source-rules", { toggle_id: id }).then(function (d2) { applyRulesPayload(d2); paintRules(); });
          },
        });
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "rule:delete") {
      if (!rule) return;
      var snap = rule;
      Floor.post("/api/source-rules", { delete_id: id }).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        Floor.toast(Floor.t("rules.deletedToast"), {
          undo: function () {
            Floor.post("/api/source-rules", {
              pattern: snap.pattern, tier: snap.tier, label: snap.label,
              weight: snap.weight, position: snap.position, note: snap.note,
            }).then(function (d2) { applyRulesPayload(d2); paintRules(); });
          },
        });
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "rule:moveup" || action === "rule:movedown") {
      var sorted = sortedRules();
      var idx = sorted.findIndex(function (r) { return r.id === id; });
      var swapWith = action === "rule:moveup" ? idx - 1 : idx + 1;
      if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;
      var tmp = sorted[idx]; sorted[idx] = sorted[swapWith]; sorted[swapWith] = tmp;
      var ids = sorted.map(function (r) { return r.id; });
      Floor.post("/api/source-rules/reorder", { ids: ids }).then(function (d) {
        var order = d.order || [];
        order.forEach(function (o) {
          var r = RULES.find(function (rr) { return rr.id === o.id; });
          if (r) r.position = o.position;
        });
        paintRules();
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }
  });

  /* ---- the rule tester: pure client replica of the server's first-match-wins
     substring classifier (src/lib/sources.js classifySource). Read-only. ---- */

  function classifyClient(url) {
    if (!url) return null;
    var u = url.toLowerCase();
    var active = RULES.filter(function (r) { return r.enabled; }).sort(function (a, b) { return a.position - b.position; });
    for (var i = 0; i < active.length; i++) {
      if (u.indexOf(String(active[i].pattern).toLowerCase()) !== -1) return active[i];
    }
    return null;
  }

  var testInput = document.getElementById("rule-test-url");
  var testResult = document.getElementById("rule-test-result");
  if (testInput && testResult) {
    testInput.addEventListener("input", function () {
      var v = testInput.value.trim();
      if (!v) { testResult.textContent = Floor.t("rules.testEmpty"); return; }
      var match = classifyClient(v);
      testResult.textContent = match
        ? Floor.t("rules.testMatch", { order: match.position, tier: match.label || match.tier, w: Number(match.weight).toFixed(2) })
        : Floor.t("rules.testNoMatch", { tier: Floor.t("tier.unclassified"), w: FALLBACK_W });
    });
  }

  fetchRules();
})();`;
}
