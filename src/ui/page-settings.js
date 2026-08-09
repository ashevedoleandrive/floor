/* Floor · Settings (src/ui/page-settings.js)
   ---------------------------------------------------------------------
   Every knob that changes how Floor behaves, in one place, editable
   without a terminal. This replaces the page that shipped broken in
   production: it emitted `.set-row / .set-label / .set-hint / .set-effect
   / .set-control / .set-input / .set-effect` and no stylesheet defined
   any of them, so every label, hint and consequence line collapsed into
   run-on text (docs/DESIGN-SPEC.md §2.1 G4, §4.3).

   What this file adds over the page it replaces:
   - Reset-to-default per field (client-only; nothing is written until
     Save is pressed).
   - A visible change history, read straight from `settings_log` via
     `settingsHistory()` in src/lib/mutations.js. `env` is passed to
     `render()` explicitly for D1 reads the router does not pre-fetch
     (CONTRACT.md), and this route's data shape has never carried
     history, so that is the sanctioned path rather than a client fetch.
   - Save no longer reloads the page. It POSTs the dirty fields, applies
     the response in place, and confirms with a toast.

   Known gap, discovered while wiring this, not introduced by it:
   `getSettings()` in src/lib/db.js returns exactly seven keys and does
   not surface `daily_cap_usd` or `tier_unclassified_weight`, even though
   `saveSettings()` accepts both and logs them to `settings_log`. Saving
   either field here is durable and shows up in the history below, but it
   currently has no live effect: `makeBudget()` reads the cap from
   `env.DAILY_USD_CAP` only, and `ruleUsage()` reads the fallback `0.35`
   only, never the stored row. Flagged in the build report; not a page
   module fix, since src/lib/*.js is out of scope for this rebuild.

   Data assumption: `render(env, data, ctx)` expects `data` shaped like
   the router's current `settingsPage()` assembly, i.e.
   `{ settings, budget: { spent, cap }, assessed, total_accounts,
   cost_per_account }`. If `data` arrives as the bare flat object the
   CONTRACT appendix describes for `GET /api/settings`, `data.settings`
   is absent and the code falls back to treating `data` itself as the
   settings object; the three header figures are then omitted rather
   than invented, per §3.6 (an absent figure prints nothing, not a
   fabricated one, when there is no note to explain it).
   --------------------------------------------------------------------- */

import { esc, num, money, section, table, field } from "./kit.js";
import { settingsHistory } from "../lib/mutations.js";

export const meta = {
  route: "/settings",
  nav: "/settings",
  titleKey: "nav.settings",
};

/* Model ids are data; the display name and the one-line "why" (already
   authored copy in i18n.js) are not re-typed here. */
const MODELS = [
  ["claude-opus-5", "Opus 5", "set.modelOpus"],
  ["claude-sonnet-5", "Sonnet 5", "set.modelSonnet"],
  ["claude-haiku-4-5", "Haiku 4.5", "set.modelHaiku"],
];
const MODEL_NAME = new Map(MODELS.map(([id, label]) => [id, label]));

/* Shipped defaults, mirrored from src/lib/db.js `getSettings()` fallbacks
   and wrangler.toml. This rebuild does not touch src/lib/*.js, so the
   reset button's "default" is a UI-only constant, not a read of the
   server's fallback chain. daily_cap_usd has no such fallback in
   getSettings() at all (see the gap noted above), so its default is
   `data.budget.cap`, computed once render() has that value. */
const STATIC_DEFAULTS = {
  floor_txn: "100000",
  cooldown_days: "45",
  search_usd: "0",
  model_research: "claude-sonnet-5",
  model_extract: "claude-sonnet-5",
  model_critic: "claude-opus-5",
  tier_unclassified_weight: "0.35",
  acv_usd: "",
};

const KEY_LABEL = {
  floor_txn: "set.floorLabel",
  cooldown_days: "set.cdLabel",
  model_research: "stage.research",
  model_extract: "stage.extract",
  model_critic: "stage.critic",
  daily_cap_usd: "set.capLabel",
  search_usd: "set.searchLabel",
  tier_unclassified_weight: "set.uwLabel",
  acv_usd: "set.acvLabel",
};

/* Two authored effect strings (`set.floorEffect`, `set.capEffect`) carry
   a <b> for emphasis, written for the old page's unescaped `.set-effect`
   div. kit.field() escapes `effect` (correctly: every other page's copy
   is plain text), so the tags are stripped here rather than rendered as
   literal angle brackets. */
const plain = (s) => String(s ?? "").replace(/<\/?b>/g, "");

function fmtValue(key, v) {
  if (v == null || v === "") return null;
  if (key === "floor_txn" || key === "cooldown_days") return num(v);
  if (key === "daily_cap_usd" || key === "search_usd" || key === "acv_usd") {
    return money(Number(v), key === "search_usd" ? 4 : 2);
  }
  if (key === "tier_unclassified_weight") return Number(v).toFixed(2);
  if (key.startsWith("model_")) return MODEL_NAME.get(v) || v;
  return String(v);
}

export const keys = {
  "set.resetDefault": { en: "↺ default", es: "↺ por defecto" },
  "set.changedOn":    { en: "Changed {date}", es: "Cambiado el {date}" },
  "set.discard":      { en: "Discard", es: "Descartar" },
  "set.saveException": {
    en: "Every other change in Floor saves at once. This page batches edits and commits them together, because a wrong floor or a bad cool-down should be a deliberate act, not a keystroke.",
    es: "Todo lo demas en Floor guarda de inmediato. Esta pagina agrupa los cambios y los aplica juntos, porque un umbral equivocado o un enfriamiento mal puesto debe ser un acto deliberado, no una tecla.",
  },
  "set.historyTitle": { en: "Change history", es: "Historial de cambios" },
  "set.historySub": {
    en: "What changed here, and when. This tool has no login, so no operator identity is recorded, only the values.",
    es: "Que cambio aqui, y cuando. Esta herramienta no tiene inicio de sesion, asi que no se registra la identidad de quien cambia, solo los valores.",
  },
  "set.historyEmpty": {
    en: "No changes recorded yet. Every save from here on is logged with its previous value.",
    es: "Todavia no hay cambios registrados. Cada guardado a partir de ahora queda registrado con su valor anterior.",
  },
  "set.histWhen":    { en: "When", es: "Cuando" },
  "set.histSetting": { en: "Setting", es: "Ajuste" },
  "set.histFrom":    { en: "From", es: "De" },
  "set.histTo":      { en: "To", es: "A" },
  "set.headerAssessed": { en: "{a} of {n} accounts assessed", es: "{a} de {n} cuentas analizadas" },
  "set.headerSpent":    { en: "{spent} of {cap} spent today", es: "{spent} de {cap} gastado hoy" },
  "set.headerCost":     { en: "{cost} measured cost per account", es: "{cost} de costo medido por cuenta" },
  "set.errFloor":        { en: "Must be at least 1,000 transactions per month.", es: "Debe ser de al menos 1,000 transacciones por mes." },
  "set.errNonNegative":  { en: "Must be zero or more.", es: "Debe ser cero o mas." },
  "set.errWeight":       { en: "Must be between 0 and 1.", es: "Debe estar entre 0 y 1." },
  "set.errAcv":          { en: "Must be greater than zero, or left blank.", es: "Debe ser mayor que cero, o dejarse en blanco." },
  "set.savedToastOne":   { en: "Saved. 1 setting changed.", es: "Guardado. 1 ajuste cambio." },
  "set.savedToastMany":  { en: "Saved. {n} settings changed.", es: "Guardado. {n} ajustes cambiaron." },
  "set.savedNoChange":   { en: "Saved. Nothing actually changed.", es: "Guardado. Nada cambio en realidad." },
};

export function css() {
  return `
.p-settings .whead { padding-top: 32px; }
.p-settings .save-note {
  margin-top: 12px; max-width: 64ch;
  font-size: 13px; line-height: 1.55; color: var(--ink-3);
}

.p-settings .fld-row {
  max-width: 640px;
  border-left: 2px solid transparent;
  padding-left: 10px; margin-left: -12px;
}
.p-settings .fld-row + .fld-row { margin-top: 28px; }
.p-settings .fld-row.changed { border-left-color: var(--accent); }

.p-settings .fld-tools {
  display: flex; align-items: center; gap: 12px;
  margin-top: 4px; min-height: 24px;
}
.p-settings .fld-tools .btn { padding-left: 0; padding-right: 0; }
.p-settings .fld-changed { font-size: 12px; color: var(--ink-3); }

.p-settings .model-legend {
  display: flex; flex-wrap: wrap; gap: 24px; max-width: 640px;
  margin-top: 20px; padding-top: 12px; border-top: 1px solid var(--line);
}
.p-settings .model-legend-item { flex: 1 1 200px; font-size: 12px; line-height: 1.5; color: var(--ink-3); }
.p-settings .model-legend-item b { color: var(--ink-1); font-weight: 600; }

.p-settings .rules-link { margin-top: 24px; font-size: 13px; line-height: 1.55; }
.p-settings .rules-link .ink-3 { margin-left: 6px; }

.p-settings .save-bar {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  z-index: 85; display: flex; align-items: center; gap: 12px;
  background: var(--white); border-radius: 10px; box-shadow: var(--shadow);
  padding: 8px 8px 8px 16px; white-space: nowrap;
  transition: opacity .18s var(--ease), transform .18s var(--ease);
}
.p-settings .save-bar.enter { opacity: 0; transform: translate(-50%, 8px); }
.p-settings .save-bar-n { font-size: 13px; color: var(--ink-1); }
.p-settings .save-bar-n.err { color: var(--bad); }
.p-settings .save-bar-sep { width: 1px; height: 16px; background: var(--line); flex: none; }

@media (max-width: 720px) {
  .p-settings .fld-row, .p-settings .model-legend { max-width: none; }
  .p-settings .save-bar { max-width: calc(100vw - 32px); overflow-x: auto; }
}
`;
}

export async function render(env, data, ctx) {
  const T = ctx.t;
  const settings = (data && data.settings) || data || {};
  const budget = (data && data.budget) || {};
  const assessed = data && data.assessed != null ? data.assessed : null;
  const totalAccounts = data && data.total_accounts != null ? data.total_accounts : null;
  const costPerAccount = data && data.cost_per_account != null ? data.cost_per_account : null;

  const defaults = { ...STATIC_DEFAULTS, daily_cap_usd: String(budget.cap ?? "8") };

  let history = [];
  try { history = await settingsHistory(env, 40); } catch { history = []; }
  const lastChange = new Map();
  for (const h of history) if (!lastChange.has(h.key)) lastChange.set(h.key, h);

  /** One field, wrapped with the reset-to-default control and the
   *  read-only "Changed {date}" annotation §4.3 asks for. Neither exists
   *  in kit.field(), so both live in this page's own markup rather than
   *  as a second field() implementation. */
  const row = (id, opts) => {
    const value = String(opts.value ?? "");
    const def = String(defaults[id] ?? "");
    const isDefault = value === def;
    const changedEntry = lastChange.get(id);
    const f = field({ ...opts, id, value });
    const resetLabel = T("set.resetDefault");
    return `<div class="fld-row" data-key="${esc(id)}" data-default="${esc(def)}">
      ${f}
      <p class="fld-err" data-err-for="${esc(id)}" hidden></p>
      <div class="fld-tools">
        <button type="button" class="btn btn-text btn-sm" data-reset-for="${esc(id)}" aria-label="${esc(opts.label)}, ${esc(resetLabel)}"${isDefault ? " hidden" : ""}>${esc(resetLabel)}</button>
        <span class="fld-changed" data-changed-for="${esc(id)}"${changedEntry ? "" : " hidden"}>${changedEntry ? esc(T("set.changedOn", { date: changedEntry.changed_at.slice(0, 10) })) : ""}</span>
      </div>
    </div>`;
  };

  /* ---- working header: title + the three measured figures, no hero. */
  const metaParts = [];
  if (assessed != null && totalAccounts != null) {
    metaParts.push(esc(T("set.headerAssessed", { a: num(assessed), n: num(totalAccounts) })));
  }
  if (budget.spent != null && budget.cap != null) {
    metaParts.push(esc(T("set.headerSpent", { spent: money(budget.spent), cap: money(budget.cap) })));
  }
  if (costPerAccount != null) {
    metaParts.push(esc(T("set.headerCost", { cost: money(costPerAccount, 4) })));
  }
  const header = `<div class="whead">
    <div class="whead-t">
      <h1 class="t-title">${esc(T("nav.settings"))}</h1>
      ${metaParts.length ? `<span class="whead-meta">${metaParts.join(" · ")}</span>` : ""}
    </div>
  </div>
  <p class="save-note">${esc(plain(T("set.saveException")))}</p>`;

  /* ---- qualification: the two numbers the whole queue turns on. */
  const qual = section({
    title: T("set.qualTitle"), sub: esc(T("set.qualSub")),
    body: `
      ${row("floor_txn", {
        label: T("set.floorLabel"), value: settings.floor_txn, type: "number", min: 1000,
        suffix: T("set.floorSuffix"), hint: T("set.floorHint"), effect: plain(T("set.floorEffect")),
      })}
      ${row("cooldown_days", {
        label: T("set.cdLabel"), value: settings.cooldown_days, type: "number", min: 0, step: 1,
        suffix: T("field.days"), hint: T("set.cdHint"), effect: T("set.cdEffect"),
      })}`,
  });

  /* ---- model routing: which model runs which stage. */
  const modelOpts = MODELS.map(([v, l]) => ({ value: v, label: l }));
  const modelLegend = `<div class="model-legend">${MODELS.map(([, label, whyKey]) =>
    `<div class="model-legend-item"><b>${esc(label)}</b> ${esc(T(whyKey))}</div>`).join("")}</div>`;
  const routing = section({
    title: T("set.routeTitle"), sub: esc(T("set.routeSub")),
    body: `
      ${row("model_research", {
        label: T("stage.research"), value: settings.model_research, options: modelOpts,
        hint: T("set.researchHint"), effect: T("set.futureOnlyEvidence"),
      })}
      ${row("model_extract", {
        label: T("stage.extract"), value: settings.model_extract, options: modelOpts,
        hint: T("set.extractHint"), effect: T("set.futureOnly"),
      })}
      ${row("model_critic", {
        label: T("stage.critic"), value: settings.model_critic, options: modelOpts,
        hint: T("set.criticHint"), effect: T("set.criticEffect"),
      })}
      ${modelLegend}`,
  });

  /* ---- cost controls: this runs behind a public URL. */
  const cost = section({
    title: T("set.costTitle"), sub: esc(T("set.costSub")),
    body: `
      ${row("daily_cap_usd", {
        label: T("set.capLabel"), value: settings.daily_cap_usd ?? budget.cap, type: "number", min: 0, step: 0.01,
        suffix: T("set.capSuffix"), hint: T("set.capHint"), effect: plain(T("set.capEffect")),
      })}
      ${row("search_usd", {
        label: T("set.searchLabel"), value: settings.search_usd, type: "number", min: 0, step: 0.0001,
        hint: T("set.searchHint"), effect: T("set.searchEffect"),
      })}`,
  });

  /* ---- evidence classification: how a source gets rated. */
  const rulesLink = `<p class="rules-link"><a href="/sources#rules-panel">${esc(T("set.rulesLink"))}</a> <span class="ink-3">${esc(T("set.rulesLinkNote"))}</span></p>`;
  const evidence = section({
    title: T("set.evTitle"), sub: esc(T("set.evSub")),
    body: `
      ${row("tier_unclassified_weight", {
        label: T("set.uwLabel"), value: settings.tier_unclassified_weight ?? "0.35", type: "number", min: 0, max: 1, step: 0.05,
        hint: T("set.uwHint"), effect: T("set.uwEffect"),
      })}
      ${rulesLink}`,
  });

  /* ---- impact model: theirs to type, never invented. */
  const impact = section({
    title: T("set.impactTitle"), sub: esc(T("set.impactSub")),
    body: `
      ${row("acv_usd", {
        label: T("set.acvLabel"), value: settings.acv_usd || "", type: "number", min: 0, suffix: "USD",
        hint: T("set.acvHint"), effect: T("set.acvEffect"),
      })}`,
  });

  /* ---- change history: read straight from settings_log. "Who" is not
     answerable, by design of this single-operator tool with no login;
     "what" and "when" are, which is what the table states. */
  const histCols = [
    { key: "when", label: T("set.histWhen"), mono: true, width: 150 },
    { key: "setting", label: T("set.histSetting") },
    { key: "from", label: T("set.histFrom"), align: "right", mono: true },
    { key: "to", label: T("set.histTo"), align: "right", mono: true },
  ];
  const histRows = history.map((h, i) => {
    const labelKey = KEY_LABEL[h.key];
    const label = labelKey ? esc(T(labelKey)) : esc(h.key);
    const from = fmtValue(h.key, h.old_value);
    const to = fmtValue(h.key, h.new_value);
    return {
      id: `h${i}`,
      cells: [
        esc(String(h.changed_at || "").slice(0, 16)),
        label,
        from == null ? `<span class="ink-4">–</span>` : esc(from),
        to == null ? `<span class="ink-4">–</span>` : esc(to),
      ],
    };
  });
  // `id`, not a class: this is a one-off structural hook for the script's
  // history-table query, not a reusable style, so it owes no CSS rule and
  // cannot trip the "class emitted with no stylesheet entry" gate.
  const historySection = `<div id="hist-sec">${section({
    title: T("set.historyTitle"), sub: esc(T("set.historySub")),
    body: table({ cols: histCols, rows: histRows, size: "dense", empty: esc(T("set.historyEmpty")) }, T),
  })}</div>`;

  const saveBar = `<div class="save-bar" id="set-bar" role="status" aria-live="polite" hidden>
    <span class="save-bar-n" id="set-status"></span>
    <span class="save-bar-sep"></span>
    <button type="button" class="btn btn-text btn-sm" id="set-discard">${esc(T("set.discard"))}</button>
    <button type="button" class="btn btn-primary btn-sm" id="set-save" disabled>${esc(T("set.save"))}</button>
  </div>`;

  return `${header}${qual}${routing}${cost}${evidence}${impact}${historySection}${saveBar}`;
}

export function script() {
  return `
(function(){
  var scope = document.querySelector('.p-settings');
  if (!scope) return;
  var rows = Array.prototype.slice.call(scope.querySelectorAll('.fld-row'));
  var bar = document.getElementById('set-bar');
  var status = document.getElementById('set-status');
  var saveBtn = document.getElementById('set-save');
  var discardBtn = document.getElementById('set-discard');
  if (!rows.length || !bar || !saveBtn || !discardBtn) return;

  var initial = {};
  var errors = {};
  var dirty = {};
  var barShown = false;

  function ctrl(row){ return row.querySelector('input, select'); }
  function T(key, vars){
    var C = (window.FLOOR_I18N && window.FLOOR_I18N.copy) || {};
    var s = C[key] || key;
    if (vars) for (var k in vars) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  rows.forEach(function(row){
    var el = ctrl(row);
    if (el) initial[row.dataset.key] = el.value;
  });

  function limits(id, v){
    var n = Number(v);
    if (id === 'floor_txn') return (v !== '' && isFinite(n) && n >= 1000) ? '' : 'set.errFloor';
    if (id === 'cooldown_days' || id === 'daily_cap_usd' || id === 'search_usd')
      return (v !== '' && isFinite(n) && n >= 0) ? '' : 'set.errNonNegative';
    if (id === 'tier_unclassified_weight')
      return (v !== '' && isFinite(n) && n >= 0 && n <= 1) ? '' : 'set.errWeight';
    if (id === 'acv_usd')
      return (v === '' || (isFinite(n) && n > 0)) ? '' : 'set.errAcv';
    return '';
  }

  function setBarVisible(show){
    if (show === barShown) return;
    barShown = show;
    if (show) {
      bar.hidden = false;
      bar.classList.add('enter');
      requestAnimationFrame(function(){ requestAnimationFrame(function(){ bar.classList.remove('enter'); }); });
    } else {
      bar.hidden = true;
    }
  }

  function refreshBar(){
    var ids = Object.keys(dirty);
    var n = ids.length;
    var hasErr = Object.keys(errors).some(function(k){ return !!errors[k]; });
    saveBtn.disabled = (n === 0 || hasErr);
    status.classList.remove('err');
    status.textContent = n === 0 ? T('set.noUnsaved')
      : n === 1 ? T('set.unsavedOne')
      : T('set.unsavedMany', { n: n });
    setBarVisible(n > 0);
  }

  function updateRow(row){
    var id = row.dataset.key;
    var el = ctrl(row);
    if (!el) return;
    var v = el.value;
    var errKey = limits(id, v);
    errors[id] = errKey;
    var errEl = row.querySelector('[data-err-for="' + id + '"]');
    if (errEl) {
      if (errKey) { errEl.hidden = false; errEl.textContent = T(errKey); el.setAttribute('aria-invalid', 'true'); }
      else { errEl.hidden = true; errEl.textContent = ''; el.removeAttribute('aria-invalid'); }
    }
    if (v !== initial[id]) dirty[id] = v; else delete dirty[id];
    row.classList.toggle('changed', v !== initial[id]);
    var resetBtn = row.querySelector('[data-reset-for="' + id + '"]');
    if (resetBtn) resetBtn.hidden = (v === row.dataset.default);
    refreshBar();
  }

  rows.forEach(function(row){
    var el = ctrl(row);
    if (!el) return;
    el.addEventListener('input', function(){ updateRow(row); });
    el.addEventListener('change', function(){ updateRow(row); });
    updateRow(row);  // surfaces a pre-existing out-of-range value on load
  });

  scope.querySelectorAll('[data-reset-for]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var row = btn.closest('.fld-row');
      var el = row && ctrl(row);
      if (!el) return;
      el.value = row.dataset.default;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.focus();
    });
  });

  discardBtn.addEventListener('click', function(){
    rows.forEach(function(row){
      var id = row.dataset.key;
      if (!(id in dirty)) return;
      var el = ctrl(row);
      if (!el) return;
      el.value = initial[id];
      updateRow(row);
    });
  });

  var MODEL_NAME = { 'claude-opus-5': 'Opus 5', 'claude-sonnet-5': 'Sonnet 5', 'claude-haiku-4-5': 'Haiku 4.5' };
  var KEY_LABEL_K = {
    floor_txn: 'set.floorLabel', cooldown_days: 'set.cdLabel',
    model_research: 'stage.research', model_extract: 'stage.extract', model_critic: 'stage.critic',
    daily_cap_usd: 'set.capLabel', search_usd: 'set.searchLabel',
    tier_unclassified_weight: 'set.uwLabel', acv_usd: 'set.acvLabel',
  };
  function fmtValue(key, v){
    if (v === null || v === undefined || v === '') return null;
    if (key === 'floor_txn' || key === 'cooldown_days') return Number(v).toLocaleString('en-US');
    if (key === 'daily_cap_usd' || key === 'search_usd' || key === 'acv_usd')
      return '$' + Number(v).toFixed(key === 'search_usd' ? 4 : 2);
    if (key === 'tier_unclassified_weight') return Number(v).toFixed(2);
    if (key.indexOf('model_') === 0) return MODEL_NAME[v] || v;
    return String(v);
  }

  function prependHistoryRows(entries, whenStr){
    var body = scope.querySelector('#hist-sec .tbl tbody');
    if (!body) return;
    var emptyRow = body.querySelector('.f-empty');
    if (emptyRow) emptyRow.closest('tr').remove();
    entries.slice().reverse().forEach(function(e){
      var from = fmtValue(e.key, e.old);
      var to = fmtValue(e.key, e.value);
      var label = T(KEY_LABEL_K[e.key] || e.key);
      var tr = document.createElement('tr');
      var tdWhen = document.createElement('td'); tdWhen.className = 'mono'; tdWhen.textContent = whenStr;
      var tdLabel = document.createElement('td'); tdLabel.textContent = label;
      var tdFrom = document.createElement('td'); tdFrom.className = 'num mono';
      var tdTo = document.createElement('td'); tdTo.className = 'num mono';
      if (from == null) { var s1 = document.createElement('span'); s1.className = 'ink-4'; s1.textContent = '–'; tdFrom.appendChild(s1); }
      else tdFrom.textContent = from;
      if (to == null) { var s2 = document.createElement('span'); s2.className = 'ink-4'; s2.textContent = '–'; tdTo.appendChild(s2); }
      else tdTo.textContent = to;
      tr.appendChild(tdWhen); tr.appendChild(tdLabel); tr.appendChild(tdFrom); tr.appendChild(tdTo);
      body.insertBefore(tr, body.firstChild);
    });
  }

  saveBtn.addEventListener('click', function(){
    var ids = Object.keys(dirty);
    if (!ids.length) return;
    saveBtn.disabled = true;
    discardBtn.disabled = true;
    status.classList.remove('err');
    status.textContent = T('set.saving');
    var payload = {};
    ids.forEach(function(id){ payload[id] = dirty[id]; });
    Floor.post('/api/settings', payload).then(function(r){
      var changed = (r && r.changed) || [];
      var now = new Date();
      var today = now.toISOString().slice(0, 10);
      var whenStr = today + ' ' + now.toISOString().slice(11, 16);
      changed.forEach(function(c){
        var row = scope.querySelector('.fld-row[data-key="' + c.key + '"]');
        var newVal = (r.settings && r.settings[c.key] != null) ? String(r.settings[c.key]) : String(c.value);
        initial[c.key] = newVal;
        delete dirty[c.key];
        delete errors[c.key];
        if (!row) return;
        row.classList.remove('changed');
        var el = ctrl(row);
        if (el) el.value = newVal;
        var resetBtn = row.querySelector('[data-reset-for="' + c.key + '"]');
        if (resetBtn) resetBtn.hidden = (newVal === row.dataset.default);
        var changedEl = row.querySelector('[data-changed-for="' + c.key + '"]');
        if (changedEl) { changedEl.hidden = false; changedEl.textContent = T('set.changedOn', { date: today }); }
      });
      if (changed.length) prependHistoryRows(changed, whenStr);
      discardBtn.disabled = false;
      refreshBar();
      if (!changed.length) Floor.toast(T('set.savedNoChange'));
      else if (changed.length === 1) Floor.toast(T('set.savedToastOne'));
      else Floor.toast(T('set.savedToastMany', { n: changed.length }));
    }).catch(function(e){
      discardBtn.disabled = false;
      saveBtn.disabled = false;
      status.classList.add('err');
      status.textContent = T('set.saveFail', { err: e.message });
    });
  });
})();`;
}
