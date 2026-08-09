/* Floor · page-queue.js — the queue, rebuilt (page author: queue only)
   ---------------------------------------------------------------------
   DESIGN-SPEC §4.1. The Monday-morning worklist: every account, ranked,
   banded, each row carrying its estimate as a range on the shared log
   gauge, its confidence as bar solidity, and its reason one deterministic
   gesture away (row expansion, never a tooltip).

   State model (T15): no mutation reloads the page. Every write POSTs,
   confirms with a toast or row flash, and the affected region re-renders
   in place via resync(), which re-fetches this same route and swaps
   #q-main — so the server stays the only renderer of rows and gauges,
   and no gauge or mark logic is ever duplicated client-side.

   Completeness (§5.1 slice owned here): add (bulk paste/CSV), edit
   (name / region / owner / last_touched_at, with per-field 400s rendered
   under the field), archive + unarchive (the Archived section keeps the
   undo reachable after the toast dies), mark touched, re-assess, run
   history with remove/restore, bulk assess / set owner / export /
   archive, filter + band + region + sort deep-linked through the URL.
   --------------------------------------------------------------------- */

import {
  esc, count, money, pct, dateISO, host,
  mark, gauge, statRow, section, well, table, btn, field, dialog, tabs,
} from "./kit.js";
import { scoreTiming } from "../lib/scoring.js";

export const meta = {
  route: "/",
  nav: "/",
  titleKey: "nav.queue",
};

/* ------------------------------ copy -------------------------------- */
/* Only what is new to this page. Everything already in i18n.js (bands,
   rules, columns, verdicts, stages, dims, run states) is reused. */

export const keys = {
  "q.meta": {
    en: "{n} accounts · {a} assessed · {ab} abstained ({r}) · {c} per assessment",
    es: "{n} cuentas · {a} analizadas · {ab} sin estimación ({r}) · {c} por análisis",
  },
  "q.metaNone": {
    en: "{n} accounts · none assessed yet",
    es: "{n} cuentas · ninguna analizada todavía",
  },
  "q.how": { en: "How this ranks", es: "Cómo se ordena" },
  "q.assessMeta": {
    en: "Research, extract, critic · 2 to 4 minutes · {cost} measured average",
    es: "Investigación, extracción, crítico · 2 a 4 minutos · {cost} promedio medido",
  },
  "q.cachedShort": {
    en: "Live runs resume tomorrow.",
    es: "Los análisis en vivo vuelven mañana.",
  },
  "q.colEst": {
    en: "Est. txn / mo vs {floor} floor",
    es: "Trx / mes est. vs umbral {floor}",
  },
  "q.bandMed": {
    en: "median {mid} · {conf} confidence",
    es: "mediana {mid} · {conf} de confianza",
  },
  "q.bandCost": {
    en: "{n} × {per} = {total} to assess all",
    es: "{n} × {per} = {total} para analizarlas todas",
  },
  "q.windowDays": { en: "{days}-day window", es: "ventana de {days} días" },
  "q.rangeNote":  { en: "range {lo} to {hi}", es: "rango {lo} a {hi}" },
  "q.sigNone":    { en: "No dated trigger on file.", es: "Sin señal con fecha registrada." },
  "q.filterEmpty": {
    en: "No rows match the filter in this band.",
    es: "Ninguna fila coincide con el filtro en esta banda.",
  },
  "q.emptyAll": {
    en: "No accounts yet. Add them as bare domains, one per line, or CSV.",
    es: "Aún no hay cuentas. Agrégalas como dominios sueltos, uno por línea, o CSV.",
  },
  "q.sortAria":  { en: "Sort within each band", es: "Ordenar dentro de cada banda" },
  "q.sort.rank": { en: "Sort: rank", es: "Orden: puesto" },
  "q.sort.est":  { en: "Sort: estimate", es: "Orden: estimación" },
  "q.sort.conf": { en: "Sort: confidence", es: "Orden: confianza" },
  "q.sort.name": { en: "Sort: name", es: "Orden: nombre" },
  "q.regionAll": { en: "All regions", es: "Todas las regiones" },

  "q.open":     { en: "Open", es: "Abrir" },
  "q.reassess": { en: "Re-assess", es: "Reanalizar" },
  "q.edit":     { en: "Edit", es: "Editar" },
  "q.touch":    { en: "Mark touched today", es: "Marcar contacto hoy" },
  "q.history":  { en: "Run history", es: "Historial de análisis" },
  "q.archive":  { en: "Archive", es: "Archivar" },
  "q.restore":  { en: "Restore", es: "Restaurar" },

  "q.archived": { en: "Archived", es: "Archivadas" },
  "q.archivedOn": { en: "Archived", es: "Archivada" },

  "q.editTitle": { en: "Edit {name}", es: "Editar {name}" },
  "q.fName":   { en: "Name", es: "Nombre" },
  "q.fRegion": { en: "Region", es: "Región" },
  "q.fOwner":  { en: "Owner", es: "Responsable" },
  "q.fTouched": { en: "Last touched", es: "Último contacto" },
  "q.fTouchedHint": { en: "YYYY-MM-DD", es: "AAAA-MM-DD" },
  "q.editEffect": {
    en: "Region and last touched feed the score, so the queue re-ranks when you save.",
    es: "La región y el último contacto alimentan el puntaje, así que la cola se reordena al guardar.",
  },
  "q.savedRerank": {
    en: "Saved. The queue re-ranked with the new values.",
    es: "Guardado. La cola se reordenó con los nuevos valores.",
  },
  "q.touched": {
    en: "Marked touched today. Cool-down starts now.",
    es: "Contacto marcado hoy. El enfriamiento empieza ahora.",
  },
  "q.confirmArchiveT": { en: "Archive {name}?", es: "¿Archivar {name}?" },
  "q.archiveB": {
    en: "It leaves the queue but stays under Archived at the bottom of this page, restorable any time.",
    es: "Sale de la cola pero queda en Archivadas, al final de esta página, restaurable en cualquier momento.",
  },
  "q.archivedToast": {
    en: "{name} archived. Find it under Archived, below the queue.",
    es: "{name} archivada. Está en Archivadas, debajo de la cola.",
  },
  "q.restoredToast": { en: "{name} is back in the queue.", es: "{name} volvió a la cola." },
  "q.added":     { en: "{n} accounts added.", es: "{n} cuentas agregadas." },
  "q.addedNone": { en: "Nothing added. Check the format.", es: "No se agregó nada. Revisa el formato." },

  "q.histTitle": { en: "Runs for {name}", es: "Análisis de {name}" },
  "q.histEmpty": { en: "No runs stored.", es: "Sin análisis guardados." },
  "q.histLatest":  { en: "latest", es: "vigente" },
  "q.histRemoved": {
    en: "Run removed. The previous run, if any, takes over.",
    es: "Análisis quitado. El anterior, si existe, toma su lugar.",
  },
  "q.histRestored": { en: "Run restored.", es: "Análisis restaurado." },
  "q.histRemovedTag": { en: "removed", es: "quitado" },
  "q.histRemove": { en: "Remove", es: "Quitar" },
  "q.histConfirmT": { en: "Remove this run?", es: "¿Quitar este análisis?" },
  "q.histConfirmB": {
    en: "It stops scoring the account. The trace stays stored and you can restore it from this list.",
    es: "Deja de puntuar la cuenta. La traza queda guardada y puedes restaurarlo desde esta lista.",
  },

  "q.bulkAssess":  { en: "Assess", es: "Analizar" },
  "q.bulkOwner":   { en: "Set owner", es: "Asignar responsable" },
  "q.bulkExport":  { en: "Export", es: "Exportar" },
  "q.bulkArchive": { en: "Archive", es: "Archivar" },
  "q.bulkAssessT": { en: "Assess {n} accounts?", es: "¿Analizar {n} cuentas?" },
  "q.bulkAssessB": {
    en: "About {cost} of measured spend, two to four minutes per account, all against the daily cap.",
    es: "Unos {cost} de gasto medido, de dos a cuatro minutos por cuenta, todo contra el tope diario.",
  },
  "q.bulkQueued": {
    en: "{n} assessments queued. Rows update as each run finishes.",
    es: "{n} análisis en cola. Las filas se actualizan al terminar cada corrida.",
  },
  "q.bulkDone": { en: "Assessments finished: {a} ok, {b} failed.", es: "Análisis terminados: {a} bien, {b} fallidos." },
  "q.bulkArchiveT": { en: "Archive {n} accounts?", es: "¿Archivar {n} cuentas?" },
  "q.bulkArchiveB": {
    en: "They leave the queue but stay under Archived, restorable any time.",
    es: "Salen de la cola pero quedan en Archivadas, restaurables en cualquier momento.",
  },
  "q.bulkArchived":  { en: "{n} archived.", es: "{n} archivadas." },
  "q.bulkOwnerDone": { en: "Owner set on {n} accounts.", es: "Responsable asignado a {n} cuentas." },
  "q.ownerTitle": { en: "Set owner for {n} accounts", es: "Asignar responsable a {n} cuentas" },
  "q.busy": {
    en: "A run is already in progress. It finishes in the bar above.",
    es: "Ya hay un análisis en curso. Termina en la barra de arriba.",
  },
  "q.retry": { en: "Retry", es: "Reintentar" },
  "q.kbd": {
    en: "j / k rows · Enter expand · e menu · / filter · 1-6 bands · Esc clear",
    es: "j / k filas · Enter expandir · e menú · / filtrar · 1-6 bandas · Esc limpiar",
  },

  // signal-kind datelines (enum from the pipeline)
  "q.k.expansion":  { en: "Expansion", es: "Expansión" },
  "q.k.product":    { en: "Product", es: "Producto" },
  "q.k.psp_change": { en: "PSP change", es: "Cambio de PSP" },
  "q.k.funding":    { en: "Funding", es: "Financiación" },
  "q.k.hiring":     { en: "Hiring", es: "Contratación" },
  "q.k.leadership": { en: "Leadership", es: "Liderazgo" },
  "q.k.other":      { en: "Signal", es: "Señal" },
  "q.verbatimTag":  { en: "verbatim EN", es: "textual EN" },
};

/* ------------------------------- css --------------------------------- */
/* Scoped to .p-queue, layout only. Kit primitives are consumed, never
   restyled; the two necessary exceptions are flagged in comments. */

export function css() {
  return `
  /* working header */
  .p-queue .whead-t { flex-wrap: wrap; }

  /* the argument, folded away: opened from the header, never at rest */
  .p-queue .q-intro { margin-top: 16px; }
  .p-queue .q-intro p { max-width: 72ch; font-size: 13px; color: var(--ink-2); }
  .p-queue .q-intro p + p { margin-top: 8px; color: var(--ink-3); }
  .p-queue .q-assess { margin-top: 16px; }
  .p-queue .q-assess-f { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .p-queue .q-assess-f .q-dom { flex: 1 1 220px; min-width: 180px; }
  .p-queue .q-assess-note { margin-top: 8px; font-size: 12px; color: var(--ink-3); max-width: 80ch; }
  .p-queue .q-assess-cached { margin-top: 8px; display: flex; gap: 8px; align-items: baseline; font-size: 12px; color: var(--ink-2); }
  .p-queue #assess-out { margin-top: 16px; border-top: 1px solid var(--line-2); padding-top: 12px; }

  /* the run tracker (transient, only while a job is genuinely running) */
  .p-queue .q-run-h { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; margin-bottom: 8px; }
  .p-queue .q-run-h b { font-weight: 600; }
  .p-queue .q-stg { display: grid; grid-template-columns: 14px 1fr 56px; gap: 8px; align-items: center; padding: 4px 0; font-size: 13px; color: var(--ink-3); }
  .p-queue .q-stg b { font-weight: 600; color: inherit; }
  .p-queue .q-stg.on { color: var(--ink-1); }
  .p-queue .q-stg.done { color: var(--ink-2); }
  .p-queue .q-stg-m { width: 10px; height: 10px; border-radius: 50%; border: 1.3px solid currentColor; justify-self: center; }
  .p-queue .q-stg.done .q-stg-m { background: currentColor; }
  .p-queue .q-stg-t { font-family: var(--mono); font-size: 11px; text-align: right; }
  .p-queue .q-stg .prog { grid-column: 2 / 4; margin: 2px 0 4px; }

  /* result / abstain / error cards inside the well */
  .p-queue .q-res { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; }
  .p-queue .q-res-fig { display: block; font: 650 24px/1.2 var(--mono); letter-spacing: -.02em; margin-top: 4px; }
  .p-queue .q-res-held .q-res-fig { font-family: var(--sans); font-size: 18px; color: var(--held); }
  .p-queue .q-res-sub { margin-top: 4px; font-size: 13px; color: var(--ink-2); max-width: 64ch; white-space: pre-line; }
  .p-queue .q-res-r { text-align: right; font-size: 12px; color: var(--ink-3); flex: none; }
  .p-queue .q-err { display: flex; gap: 12px; align-items: baseline; }

  /* toolbar: band tabs + filter + region + sort on one rule */
  .p-queue .q-toolbar { display: flex; gap: 12px; align-items: center; margin-top: 32px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .p-queue .q-toolbar .tabs { flex: 1 1 auto; border-bottom: 0; min-width: 0; } /* the toolbar carries the rule the tabs normally draw */
  .p-queue .q-toolbar .q-ctl { height: 28px; padding: 0 8px; font-size: 12px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--paper); color: var(--ink-1); margin-bottom: 8px; }
  .p-queue .q-toolbar #q-filter { width: 180px; font-family: var(--mono); }

  /* bands */
  .p-queue .q-band { margin-top: 24px; }
  .p-queue .q-bandh { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; flex-wrap: wrap; }
  .p-queue .q-bandh h2 { flex: none; }
  .p-queue .q-sq { width: 8px; height: 8px; flex: none; align-self: center; }
  .p-queue .q-sq-work { background: var(--ok); }
  .p-queue .q-sq-soon { background: var(--ink-2); }
  .p-queue .q-sq-needs_evidence { background: transparent; border: 1.3px dashed var(--held); }
  .p-queue .q-sq-suppressed { background: var(--warn); }
  .p-queue .q-sq-below { background: var(--bad); }
  .p-queue .q-sq-unscored { background: transparent; border: 1px solid var(--ink-4); }
  .p-queue .q-bandn { font-family: var(--mono); font-size: 12px; color: var(--ink-3); flex: none; }
  /* the band's own measurement, not a sentence about the band */
  .p-queue .q-bandm { margin-left: auto; font-family: var(--mono); font-size: 12px; color: var(--ink-3); flex: none; white-space: nowrap; }
  .p-queue .q-bandm a { color: var(--accent); }
  .p-queue .q-bandempty { margin-top: 8px; }

  /* column alignment across the band tables: fixed layout so every band
     shares identical column x-positions (shared-edge law, §3.2), and the
     repeated column headers collapse to zero height everywhere but the
     first visible band — kept in the tree so each table stays labelled
     for assistive tech and keeps its width source of truth. */
  .p-queue .q-band .tbl { table-layout: fixed; min-width: 1020px; }
  .p-queue .q-band:not(.q-first) thead th { padding: 0; border-bottom: 0; font-size: 0; line-height: 0; height: 0; overflow: hidden; }
  .p-queue .q-band:not(.q-first) thead input { position: absolute; width: 0; height: 0; opacity: 0; pointer-events: none; }
  .p-queue .q-band tbody tr[data-id] { cursor: pointer; }
  .p-queue .q-band td { overflow: hidden; }

  /* cells */
  .p-queue .q-rank { color: var(--ink-3); font-size: 12px; }
  .p-queue .q-acct b { display: block; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p-queue .q-acct-sub { display: block; font-family: var(--mono); font-size: 11px; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
  .p-queue .q-fit-l { display: flex; gap: 8px; align-items: baseline; font-size: 12px; font-family: var(--mono); margin-bottom: 2px; white-space: nowrap; overflow: hidden; }
  .p-queue .q-fit-l b { font-size: 13px; font-weight: 600; }
  .p-queue .q-fit-l .q-fit-r { color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; }
  .p-queue .q-fit .gauge { min-width: 0; height: 10px; }
  .p-queue .q-fit .gauge .g-trk { top: 4px; }
  .p-queue .q-fit .gauge .g-bar { top: 2px; }
  .p-queue .q-fit .gauge .g-mid { top: 0; height: 10px; }
  .p-queue .q-fit .gauge .g-fl { top: 0; bottom: 0; }
  .p-queue .q-fit .gauge .g-slot { top: 0; }
  .p-queue .q-fit .gauge .g-over { top: 0; }
  .p-queue .q-fit-none { display: flex; align-items: center; min-height: 26px; }
  .p-queue .q-fit-word { font-size: 12px; color: var(--held); margin-bottom: 2px; display: block; }
  .p-queue .q-t { min-width: 0; }
  .p-queue .q-t-k { display: block; color: var(--ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p-queue .q-t-d { display: block; font-size: 12px; color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }
  .p-queue .q-cd .mk { font-size: 12px; }
  .p-queue .q-cd-until { display: block; font-family: var(--mono); font-size: 11px; color: var(--ink-3); margin-top: 1px; padding-left: 16px; }
  .p-queue .q-none { color: var(--ink-4); }

  /* expansion inset */
  .p-queue .q-x { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 8px 32px; }
  .p-queue .q-x-main p { max-width: 72ch; margin-top: 8px; font-size: 14px; line-height: 1.55; white-space: pre-line; }
  .p-queue .q-x-main .statrow { margin-top: 16px; }
  .p-queue .q-x-main .stat-v { font-size: 18px; }
  .p-queue .q-x-rail ul { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .p-queue .q-x-rail p { font-size: 12px; line-height: 1.5; color: var(--ink-2); margin-top: 2px; }
  .p-queue .q-x-act { grid-column: 1 / -1; display: flex; gap: 16px; align-items: center; flex-wrap: wrap; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 8px; }

  /* archived section */
  .p-queue .q-arch .q-acct b { font-weight: 400; }

  /* run history dialog */
  .p-queue .q-hrow { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
  .p-queue .q-hrow:last-child { border-bottom: 0; }
  .p-queue .q-hrow-del { opacity: .55; }
  .p-queue .q-h-date { font-family: var(--mono); font-size: 12px; color: var(--ink-3); }
  .p-queue .q-h-fig { font-family: var(--mono); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p-queue .q-h-tag { font: 600 10px/1.3 var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-4); margin-left: 8px; }
  .p-queue .q-h-cost { font-family: var(--mono); font-size: 11px; color: var(--ink-3); display: block; }

  /* keyboard legend */
  .p-queue .q-kbd { margin-top: 24px; color: var(--ink-4); font-family: var(--mono); font-size: 11px; }

  @media (max-width: 900px) {
    .p-queue .q-x { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .p-queue .q-toolbar #q-filter { width: 120px; }
    .p-queue .q-res { flex-direction: column; }
    .p-queue .q-res-r { text-align: left; }
  }
  `;
}

/* ------------------------------ script ------------------------------- */
/* Inlined before /static/floor.js. Floor.* is reached only from event
   handlers, which cannot fire before floor.js has run. State model:
   filters, band, region and sort live in the URL; every mutation POSTs
   and then resync() re-fetches this route and swaps #q-main in place,
   so the server remains the only renderer of rows, gauges and marks. */

export function script() {
  return `(function () {
  "use strict";

  /* the §3.7 marks the run/result cards need client-side; same svg
     vocabulary as the kit, colours via the shared tone-* classes */
  var MK = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    half: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/></svg>',
    hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>'
  };
  var STAGES = [
    ["research", "stage.research", "stage.research.blurb"],
    ["extract", "stage.extract", "stage.extract.blurb"],
    ["critic", "stage.critic", "stage.critic.blurb"],
    ["scoring", "stage.score", "stage.score.blurb"]
  ];

  var state = { band: "", q: "", region: "", sort: "rank" };
  var QD = { rows: {}, arch: {}, per: 0, lang: "en" };
  var busyRun = false;
  var lastRun = null;
  var bulkOwnerIds = [];
  var histDomain = "";
  var deb = null;

  /* ----------------------------- helpers ---------------------------- */

  function q(s, r) { return (r || document).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function t(k, v) { return window.Floor ? Floor.t(k, v) : k; }
  function esc(s) {
    s = String(s == null ? "" : s).replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ");
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtN(n) {
    if (n == null || isNaN(Number(n))) return "";
    n = Number(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\\.0$/, "") + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "k";
    return String(n);
  }
  function clock(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function mkWord(kind, tone, word) {
    return '<span class="mk tone-' + tone + '">' + MK[kind] + '<span class="mk-w">' + esc(word) + "</span></span>";
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s); }
  /* raw fetch rather than Floor.post: a 400 carries { field, error } and
     the field name must survive so the message lands under the field */
  function postJson(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; });
    });
  }
  function rowName(d) {
    var r = QD.rows[d] || QD.arch[d] || {};
    return r.n || d;
  }

  /* ------------------------- URL <-> state -------------------------- */

  function readQD() {
    var el = document.getElementById("q-data");
    if (!el) return;
    try { QD = JSON.parse(el.textContent) || QD; } catch (e) {}
    QD.rows = QD.rows || {};
    QD.arch = QD.arch || {};
  }
  function readURL() {
    var p = new URLSearchParams(location.search);
    state = {
      band: p.get("band") || "",
      q: p.get("q") || "",
      region: p.get("region") || "",
      sort: p.get("sort") || "rank"
    };
  }
  function writeURL() {
    var p = new URLSearchParams();
    if (state.band) p.set("band", state.band);
    if (state.q) p.set("q", state.q);
    if (state.region) p.set("region", state.region);
    if (state.sort !== "rank") p.set("sort", state.sort);
    var qs = p.toString();
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
  }
  function bandOf(a) {
    var href = a.getAttribute("href") || "/";
    var m = href.indexOf("band=");
    if (m < 0) return "";
    var v = href.slice(m + 5);
    var amp = v.indexOf("&");
    return amp >= 0 ? v.slice(0, amp) : v;
  }

  /* ------------------- filter · sort · band tabs -------------------- */

  function insetOf(tr) {
    var id = tr.getAttribute("data-id");
    if (id == null || !tr.parentNode) return null;
    return tr.parentNode.querySelector('tr.tbl-inset[data-inset-for="' + cssEsc(id) + '"]');
  }
  var CMP = {
    rank: function (a, b) { return (a.k || 0) - (b.k || 0); },
    est: function (a, b) { return (b.m == null ? -1 : b.m) - (a.m == null ? -1 : a.m); },
    conf: function (a, b) { return (b.c == null ? -1 : b.c) - (a.c == null ? -1 : a.c); },
    name: function (a, b) { return String(a.n || "").localeCompare(String(b.n || "")); }
  };
  function sortBand(sec) {
    var tb = sec.querySelector("tbody");
    if (!tb) return;
    var cmp = CMP[state.sort] || CMP.rank;
    var trs = qa("tr[data-id]", tb);
    trs.sort(function (x, y) {
      return cmp(QD.rows[x.getAttribute("data-id")] || {}, QD.rows[y.getAttribute("data-id")] || {});
    });
    trs.forEach(function (tr) {
      var ins = insetOf(tr);
      tb.appendChild(tr);
      if (ins) tb.appendChild(ins);
    });
  }
  function apply() {
    qa("#q-main .tabs .tab").forEach(function (a, i) {
      var on = bandOf(a) === state.band;
      a.classList.toggle("on", on);
      if (on) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current");
      if (i < 9) a.setAttribute("data-hotkey", String(i + 1));
    });
    var f = q("#q-filter"); if (f && f.value !== state.q) f.value = state.q;
    var rg = q("#q-region"); if (rg) rg.value = state.region;
    var so = q("#q-sort"); if (so) so.value = state.sort;
    var first = true;
    qa("#q-main .q-band").forEach(function (sec) {
      var show = !state.band || state.band === sec.getAttribute("data-band");
      sec.hidden = !show;
      sec.classList.remove("q-first");
      if (!show) return;
      sortBand(sec);
      var vis = 0;
      qa("tbody tr[data-id]", sec).forEach(function (tr) {
        var d = tr.getAttribute("data-id");
        var r = QD.rows[d] || {};
        var hay = (String(r.n || "") + " " + d).toLowerCase();
        var okRow = (!state.q || hay.indexOf(state.q.toLowerCase()) >= 0) &&
                    (!state.region || r.r === state.region);
        tr.hidden = !okRow;
        tr.tabIndex = 0;
        var ins = insetOf(tr);
        if (ins && !okRow) { ins.hidden = true; tr.setAttribute("aria-expanded", "false"); }
        if (okRow) vis++;
      });
      var emp = sec.querySelector(".q-bandempty");
      if (emp) emp.hidden = vis > 0;
      if (first) { sec.classList.add("q-first"); first = false; }
      qa(".sel-all", sec).forEach(function (c) {
        c.tabIndex = sec.classList.contains("q-first") ? 0 : -1;
      });
    });
  }
  function toggleRow(tr) {
    var ins = insetOf(tr);
    if (!ins) return;
    ins.hidden = !ins.hidden;
    tr.setAttribute("aria-expanded", ins.hidden ? "false" : "true");
  }
  function moveFocus(delta) {
    var rows = qa("#q-main .q-band:not([hidden]) tbody tr[data-id]:not([hidden])");
    if (!rows.length) return;
    var i = rows.indexOf(document.activeElement);
    var n = i < 0 ? (delta > 0 ? 0 : rows.length - 1) : Math.min(rows.length - 1, Math.max(0, i + delta));
    rows[n].focus();
  }

  /* ------------------------------ resync ---------------------------- */
  /* Re-fetch this route, swap #q-main and #q-meta from the fresh render,
     re-apply URL state and selection. The server stays the only renderer
     of rows, gauges and marks; nothing is rebuilt by hand here. */

  function resync() {
    return fetch(location.pathname + location.search)
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        var doc = new DOMParser().parseFromString(txt, "text/html");
        var fresh = doc.querySelector("#q-main");
        if (!fresh) return;
        var checked = qa(".row-sel:checked").map(function (c) { return c.dataset.id; });
        Floor.replace("#q-main", fresh.outerHTML);
        var m = doc.querySelector("#q-meta");
        if (m && q("#q-meta")) Floor.replace("#q-meta", m.outerHTML);
        readQD();
        apply();
        var last = null;
        checked.forEach(function (id) {
          var c = q('.row-sel[data-id="' + cssEsc(id) + '"]');
          if (c) { c.checked = true; last = c; }
        });
        if (last) {
          last.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          /* every selected row left the fresh render (archived, filtered
             out server-side): the bulk bar must die with the selection */
          var bar = q("#bulkbar");
          if (bar) bar.remove();
        }
      })
      .catch(function () {});
  }

  /* --------------------------- the live run ------------------------- */

  function tracker(domain, stageKey, ms, starts) {
    var idx = 0, i;
    for (i = 0; i < STAGES.length; i++) if (STAGES[i][0] === stageKey) idx = i;
    var rows = "";
    for (i = 0; i < STAGES.length; i++) {
      var st = i < idx ? "done" : i === idx ? "on" : "";
      var took = "";
      var next = STAGES[i + 1] ? STAGES[i + 1][0] : "";
      if (i < idx && starts[STAGES[i][0]] != null && starts[next] != null)
        took = clock(starts[next] - starts[STAGES[i][0]]);
      if (i === idx) took = clock(ms - (starts[stageKey] || 0));
      rows += '<div class="q-stg ' + st + '"><span class="q-stg-m"></span><span><b>' +
        esc(t(STAGES[i][1])) + "</b> · " + esc(t(STAGES[i][2])) +
        '</span><span class="q-stg-t">' + took + "</span>" +
        (i === idx ? '<span class="prog is-running"><i></i></span>' : "") + "</div>";
    }
    return '<div class="q-run"><div class="q-run-h"><span>' + esc(t("run.assessing")) +
      ' <b class="mono">' + esc(domain) + '</b></span><span class="mono">' + clock(ms) +
      "</span></div>" + rows + "</div>";
  }

  function resultCard(domain, job, detail, ms) {
    var a = (detail && detail.assessment) || {};
    var sc = (detail && detail.scored) || {};
    var meta = '<div class="q-res-r mono">' + esc("$" + Number(job.cost_usd || 0).toFixed(5) + " · " + clock(ms)) +
      '<br><a href="/account/' + encodeURIComponent(domain) + '">' + esc(t("run.openFull")) + "</a></div>";
    if (a.abstained) {
      var vb = QD.lang === "es" && a.abstain_reason
        ? ' <span class="verbatim" title="' + esc(t("ev.verbatim")) + '">' + esc(t("q.verbatimTag")) + "</span>" : "";
      return '<div class="q-res q-res-held"><div>' + mkWord("hatch", "held", t("verdict.abstained")) +
        '<span class="q-res-fig">' + esc(t("verdict.noEstimate")) + '</span><p class="q-res-sub">' +
        esc(a.abstain_reason || t("run.noCarry")) + vb + "</p></div>" + meta + "</div>";
    }
    var v = sc.floor_verdict === "clears" ? ["filled", "ok", t("verdict.clears")]
      : sc.floor_verdict === "below" ? ["filled", "bad", t("verdict.below")]
      : ["half", "warn", t("verdict.borderline")];
    return '<div class="q-res"><div>' + mkWord(v[0], v[1], v[2]) +
      '<span class="q-res-fig mono">' + esc(fmtN(a.txn_mid)) + ' <span class="u">' + esc(t("unit.txnMo")) + "</span></span>" +
      '<p class="q-res-sub mono">' + esc(fmtN(a.txn_min) + "–" + fmtN(a.txn_max) + " · " + Math.round((a.confidence || 0) * 100) + "%") +
      "</p></div>" + meta + "</div>";
  }

  function runError(msg) {
    var out = q("#assess-out");
    if (!out) return;
    out.hidden = false;
    out.innerHTML = '<div class="q-err"><span class="f-error">' + esc(msg) +
      '</span><button type="button" class="btn btn-text btn-sm" data-action="assess-retry">' +
      esc(t("q.retry")) + "</button></div>";
  }

  function assessStart(domain, touched) {
    if (busyRun) { Floor.toast(t("q.busy")); return; }
    var out = q("#assess-out");
    if (!out) return;
    lastRun = { domain: domain, touched: touched || null };
    busyRun = true;
    out.hidden = false;
    var goBtn = q("#assess-go");
    if (goBtn) goBtn.disabled = true;
    var t0 = Date.now();
    var starts = { research: 0 };
    var cur = "research";
    var ticker = null, poll = null;
    function stop() {
      clearInterval(ticker); clearInterval(poll);
      busyRun = false;
      if (goBtn) goBtn.disabled = false;
    }
    out.innerHTML = tracker(domain, cur, 0, starts);
    out.scrollIntoView({ block: "nearest" });

    postJson("/api/assess", { domain: domain, last_touched_at: touched || null }).then(function (s) {
      if (!s || s.ok === false) { stop(); runError((s && s.error) || "error"); return; }
      if (s.cached) {
        stop();
        out.innerHTML = '<div class="q-res q-res-held"><div>' + mkWord("half", "warn", t("run.cachedMode")) +
          '<p class="q-res-sub">' + esc(s.note || "") + "</p></div></div>";
        return;
      }
      if (!s.job_id) { stop(); runError(s.error || "error"); return; }
      ticker = setInterval(function () {
        out.innerHTML = tracker(domain, cur, Date.now() - t0, starts);
      }, 1000);
      poll = setInterval(function () {
        fetch("/api/job/" + s.job_id).then(function (r) { return r.json(); }).then(function (j) {
          var job = (j && j.job) || {};
          if (job.status === "running" || job.status === "queued") {
            if (job.stage && job.stage !== cur) {
              cur = job.stage;
              if (starts[cur] == null) starts[cur] = Date.now() - t0;
            }
            return;
          }
          stop();
          var ms = Date.now() - t0;
          if (job.status === "error") { runError(t("run.stoppedAfter", { t: clock(ms), err: job.detail || "error" })); return; }
          out.innerHTML = resultCard(domain, job, j.detail, ms);
          resync();
        }).catch(function () {});
      }, 2500);
    }).catch(function (e) { stop(); runError(t("run.error", { err: e.message })); });
  }

  /* --------------------------- edit dialog -------------------------- */

  var FIELD_IDS = { name: "q-e-name", region: "q-e-region", owner: "q-e-owner", last_touched_at: "q-e-touched", domain: "" };

  function clearErrs() {
    var dlg = q("#dlg-edit");
    if (!dlg) return;
    qa(".fld-err", dlg).forEach(function (p) { p.remove(); });
    qa("[aria-invalid]", dlg).forEach(function (i) { i.removeAttribute("aria-invalid"); });
  }
  function showFieldError(fieldName, msg) {
    var id = FIELD_IDS[fieldName];
    var input = id && q("#" + id);
    if (!input) { Floor.toast(t("common.notSaved", { err: msg })); return; }
    input.setAttribute("aria-invalid", "true");
    var fld = input.closest(".fld");
    if (!fld) return;
    var p = fld.querySelector(".fld-err");
    if (!p) {
      p = document.createElement("p");
      p.className = "fld-err";
      var c = fld.querySelector(".fld-c");
      if (c) c.after(p); else fld.appendChild(p);
    }
    p.textContent = msg;
    input.focus();
  }
  function openEdit(domain) {
    var dlg = q("#dlg-edit");
    if (!dlg) return;
    var r = QD.rows[domain] || {};
    dlg.dataset.domain = domain;
    var tt = q("#dlg-edit-t");
    if (tt) tt.textContent = t("q.editTitle", { name: r.n || domain });
    q("#q-e-name").value = r.n || "";
    q("#q-e-region").value = r.r || "";
    q("#q-e-owner").value = r.o || "";
    q("#q-e-touched").value = r.t || "";
    clearErrs();
    dlg.showModal();
  }
  function saveEdit() {
    var dlg = q("#dlg-edit");
    if (!dlg) return;
    var domain = dlg.dataset.domain || "";
    var body = {
      name: q("#q-e-name").value.trim(),
      region: q("#q-e-region").value,
      owner: q("#q-e-owner").value.trim(),
      last_touched_at: q("#q-e-touched").value
    };
    postJson("/api/account/" + encodeURIComponent(domain), body).then(function (r) {
      if (!r || r.ok === false) {
        clearErrs();
        dlg.showModal();
        showFieldError((r && r.field) || "", (r && r.error) || "error");
        return;
      }
      clearErrs();
      var changed = (r.changed || []).slice();
      var before = r.before || {};
      if (changed.length) {
        Floor.toast(t("q.savedRerank"), { undo: function () {
          var back = {};
          for (var i = 0; i < changed.length; i++) back[changed[i]] = before[changed[i]];
          postJson("/api/account/" + encodeURIComponent(domain), back).then(resync);
        } });
      }
      resync();
    }).catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }

  /* ---------------- touch · archive · restore · history ------------- */

  function touch(domain) {
    var before = (QD.rows[domain] || {}).t || "";
    postJson("/api/account/" + encodeURIComponent(domain), { last_touched_at: today() }).then(function (r) {
      if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
      Floor.toast(t("q.touched"), { undo: function () {
        postJson("/api/account/" + encodeURIComponent(domain), { last_touched_at: before }).then(resync);
      } });
      resync();
    });
  }
  function archive(domain, el) {
    var name = rowName(domain);
    function go() {
      postJson("/api/account/" + encodeURIComponent(domain) + "/archive", {}).then(function (r) {
        if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
        Floor.toast(t("q.archivedToast", { name: name }), { undo: function () { unarchive(domain); } });
        resync();
      });
    }
    /* menu items arrive pre-confirmed by the in-menu swap; buttons in the
       row expansion have not confirmed yet, so ask here (§5.4) */
    if (el && el.closest(".menu-confirm")) { go(); return; }
    Floor.confirm({ title: t("q.confirmArchiveT", { name: name }), body: t("q.archiveB"), danger: true })
      .then(function (ok) { if (ok) go(); });
  }
  function unarchive(domain) {
    postJson("/api/account/" + encodeURIComponent(domain) + "/unarchive", {}).then(function (r) {
      if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
      Floor.toast(t("q.restoredToast", { name: rowName(domain) }));
      resync();
    });
  }

  function openHistory(domain) {
    histDomain = domain;
    var dlg = q("#dlg-history");
    if (!dlg) return;
    var tt = q("#dlg-history-t");
    if (tt) tt.textContent = t("q.histTitle", { name: rowName(domain) });
    var body = q("#q-hist-body");
    if (body) body.innerHTML = '<p class="q-none">' + esc(t("common.loading")) + "…</p>";
    dlg.showModal();
    loadHist();
  }
  function loadHist() {
    postJson("/api/account/" + encodeURIComponent(histDomain) + "/history", {}).then(function (r) {
      renderHist((r && r.history) || []);
    });
  }
  function renderHist(list) {
    var body = q("#q-hist-body");
    if (!body) return;
    if (!list.length) {
      body.innerHTML = '<div class="f-empty"><p>' + esc(t("q.histEmpty")) + "</p></div>";
      return;
    }
    var latestSeen = false, html = "", i;
    for (i = 0; i < list.length; i++) {
      var run = list[i];
      var del = !!run.deleted_at;
      var tag = "";
      if (del) tag = '<span class="q-h-tag">' + esc(t("q.histRemovedTag")) + "</span>";
      else if (!latestSeen) { latestSeen = true; tag = '<span class="q-h-tag">' + esc(t("q.histLatest")) + "</span>"; }
      var fig = run.abstained
        ? esc(t("verdict.abstained"))
        : esc(fmtN(run.txn_mid) + " (" + fmtN(run.txn_min) + "–" + fmtN(run.txn_max) + ") · " +
              Math.round((run.confidence || 0) * 100) + "%");
      var act = del
        ? '<button type="button" class="btn btn-text btn-sm" data-action="restore:run">' + esc(t("q.restore")) + "</button>"
        : '<button type="button" class="btn btn-text btn-sm btn-danger" data-action="destroy:run">' + esc(t("q.histRemove")) + "</button>";
      html += '<div class="q-hrow' + (del ? " q-hrow-del" : "") + '" data-id="' + run.id +
        '"><span class="q-h-date">' + esc(String(run.run_at || "").slice(0, 10)) +
        '<span class="q-h-cost">$' + Number(run.cost_usd || 0).toFixed(4) + "</span></span>" +
        '<span class="q-h-fig">' + fig + tag + "</span><span>" + act + "</span></div>";
    }
    body.innerHTML = html;
  }
  function removeRun(id) {
    Floor.confirm({ title: t("q.histConfirmT"), body: t("q.histConfirmB"), danger: true }).then(function (ok) {
      if (!ok) return;
      postJson("/api/assessment/" + id, {}).then(function (r) {
        if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
        Floor.toast(t("q.histRemoved"), { undo: function () { restoreRun(id, true); } });
        loadHist();
        resync();
      });
    });
  }
  function restoreRun(id, silent) {
    postJson("/api/assessment/" + id + "/restore", {}).then(function (r) {
      if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
      if (!silent) Floor.toast(t("q.histRestored"));
      loadHist();
      resync();
    });
  }

  /* ------------------------------ import ---------------------------- */

  function importAccounts() {
    var ta = q("#q-add-text");
    var text = ta ? ta.value.trim() : "";
    if (!text) return;
    postJson("/api/import", { text: text }).then(function (r) {
      if (!r || r.ok === false) { Floor.toast(t("common.notSaved", { err: (r && r.error) || "error" })); return; }
      Floor.toast(r.added ? t("q.added", { n: r.added }) : t("q.addedNone"));
      if (ta && r.added) ta.value = "";
      resync();
    });
  }

  /* ------------------------------- bulk ------------------------------ */

  function bulkAssess(ids) {
    var cost = "$" + (ids.length * (QD.per || 0.29)).toFixed(2);
    Floor.confirm({ title: t("q.bulkAssessT", { n: ids.length }), body: t("q.bulkAssessB", { cost: cost }) })
      .then(function (ok) {
        if (!ok) return;
        var jobs = [];
        var cachedNote = null;
        var chain = Promise.resolve();
        ids.forEach(function (d) {
          chain = chain.then(function () {
            if (cachedNote) return;
            return postJson("/api/assess", { domain: d }).then(function (s) {
              if (s && s.cached) { cachedNote = s.note || t("run.cachedMode"); return; }
              if (s && s.job_id) jobs.push(s.job_id);
            });
          });
        });
        chain.then(function () {
          if (cachedNote) Floor.toast(String(cachedNote));
          if (jobs.length) { Floor.toast(t("q.bulkQueued", { n: jobs.length })); watchJobs(jobs); }
        });
      });
  }
  function watchJobs(jobs) {
    var pending = jobs.slice(), okN = 0, badN = 0, ticks = 0;
    var iv = setInterval(function () {
      ticks++;
      if (ticks > 360 || !pending.length) { clearInterval(iv); return; }
      pending.slice().forEach(function (id) {
        fetch("/api/job/" + id).then(function (r) { return r.json(); }).then(function (j) {
          var st = j && j.job && j.job.status;
          if (st !== "done" && st !== "error") return;
          var ix = pending.indexOf(id);
          if (ix >= 0) pending.splice(ix, 1);
          if (st === "done") okN++; else badN++;
          if (!pending.length) {
            clearInterval(iv);
            Floor.toast(t("q.bulkDone", { a: okN, b: badN }));
            resync();
          }
        }).catch(function () {});
      });
    }, 5000);
  }
  function bulkArchive(ids) {
    Floor.confirm({ title: t("q.bulkArchiveT", { n: ids.length }), body: t("q.bulkArchiveB"), danger: true })
      .then(function (ok) {
        if (!ok) return;
        Promise.all(ids.map(function (d) {
          return postJson("/api/account/" + encodeURIComponent(d) + "/archive", {});
        })).then(function () {
          Floor.toast(t("q.bulkArchived", { n: ids.length }), { undo: function () {
            Promise.all(ids.map(function (d) {
              return postJson("/api/account/" + encodeURIComponent(d) + "/unarchive", {});
            })).then(resync);
          } });
          resync();
        });
      });
  }
  function bulkOwnerGo() {
    var input = q("#q-o-owner");
    var owner = input ? input.value.trim() : "";
    var ids = bulkOwnerIds.slice();
    if (!ids.length) return;
    var befores = {};
    Promise.all(ids.map(function (d) {
      return postJson("/api/account/" + encodeURIComponent(d), { owner: owner }).then(function (r) {
        if (r && r.before) befores[d] = r.before.owner || "";
      });
    })).then(function () {
      Floor.toast(t("q.bulkOwnerDone", { n: ids.length }), { undo: function () {
        Promise.all(Object.keys(befores).map(function (d) {
          return postJson("/api/account/" + encodeURIComponent(d), { owner: befores[d] });
        })).then(resync);
      } });
      resync();
    });
  }
  function csvExport(ids) {
    var head = ["domain", "name", "region", "owner", "last_touched_at", "band", "rank", "score", "txn_min", "txn_mid", "txn_max", "confidence"];
    var lines = [head.join(",")];
    var cell = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    ids.forEach(function (d) {
      var r = QD.rows[d];
      if (!r) return;
      lines.push([d, r.n, r.r, r.o, r.t, r.b, r.k, r.s, r.mn, r.m, r.mx, r.c].map(cell).join(","));
    });
    var blob = new Blob([lines.join("\\n")], { type: "text/csv" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "floor-queue-selection-" + today() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ----------------------------- listeners --------------------------- */

  /* band tabs never navigate: the band becomes URL state and the rows
     filter in place. Registered before floor.js, so preventDefault wins. */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("#q-main .tabs a.tab");
    if (!a) return;
    e.preventDefault();
    state.band = bandOf(a);
    writeURL();
    apply();
  });

  /* row expansion: click on non-control, non-selected-text zones */
  document.addEventListener("click", function (e) {
    var tr = e.target.closest("#q-main .q-band tbody tr[data-id]");
    if (!tr) return;
    if (e.target.closest("a, button, input, select, textarea, label, .menu, .tbl-inset, dialog")) return;
    var sel = window.getSelection && window.getSelection();
    if (sel && String(sel).length) return;
    toggleRow(tr);
  });

  document.addEventListener("input", function (e) {
    if (!e.target || e.target.id !== "q-filter") return;
    clearTimeout(deb);
    deb = setTimeout(function () {
      state.q = q("#q-filter") ? q("#q-filter").value.trim() : "";
      writeURL();
      apply();
    }, 150);
  });
  document.addEventListener("change", function (e) {
    if (!e.target) return;
    if (e.target.id === "q-region") { state.region = e.target.value; writeURL(); apply(); }
    else if (e.target.id === "q-sort") { state.sort = e.target.value; writeURL(); apply(); }
  });

  document.addEventListener("submit", function (e) {
    if (!e.target || e.target.id !== "assess-form") return;
    e.preventDefault();
    var d = q("#assess-domain") ? q("#assess-domain").value.trim() : "";
    if (!d) return;
    assessStart(d, q("#assess-touched") ? q("#assess-touched").value : null);
  });

  /* j / k / Enter / e; digits ride the shared data-hotkey layer */
  document.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var el = e.target;
    var typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
    if (typing || document.querySelector("dialog[open]")) return;
    if (e.key === "j" || e.key === "k") { e.preventDefault(); moveFocus(e.key === "j" ? 1 : -1); return; }
    var tr = el && el.closest ? el.closest("#q-main .q-band tbody tr[data-id]") : null;
    if (!tr) return;
    if (e.key === "Enter") { e.preventDefault(); toggleRow(tr); }
    else if (e.key === "e") {
      e.preventDefault();
      var mb = tr.querySelector(".menu-btn");
      if (mb) mb.click();
    }
  });

  document.addEventListener("floor:action", function (e) {
    var a = e.detail.action, id = e.detail.id, el = e.detail.el;
    if (a === "toggle-intro") {
      var s = q("#q-intro");
      if (!s) return;
      s.hidden = !s.hidden;
      if (el) el.setAttribute("aria-expanded", s.hidden ? "false" : "true");
      if (!s.hidden) s.scrollIntoView({ block: "nearest" });
    }
    else if (a === "open-add") { var d1 = q("#dlg-add"); if (d1) d1.showModal(); }
    else if (a === "import") importAccounts();
    else if (a === "assess-row") { if (id) assessStart(id, null); }
    else if (a === "assess-retry") { if (lastRun) assessStart(lastRun.domain, lastRun.touched); }
    else if (a === "edit") { if (id) openEdit(id); }
    else if (a === "save-edit") saveEdit();
    else if (a === "touch") { if (id) touch(id); }
    else if (a === "destroy:archive") { if (id) archive(id, el); }
    else if (a === "restore:unarchive") { if (id) unarchive(id); }
    else if (a === "history") { if (id) openHistory(id); }
    else if (a === "destroy:run") { if (id) removeRun(id); }
    else if (a === "restore:run") { if (id) restoreRun(id); }
    else if (a === "bulk-owner-go") bulkOwnerGo();
  });

  document.addEventListener("floor:bulk", function (e) {
    var a = e.detail.action, ids = e.detail.ids || [];
    if (!ids.length) return;
    if (a === "bulk:assess") bulkAssess(ids);
    else if (a === "bulk:owner") {
      bulkOwnerIds = ids;
      var tt = q("#dlg-owner-t");
      if (tt) tt.textContent = t("q.ownerTitle", { n: ids.length });
      var input = q("#q-o-owner");
      if (input) input.value = "";
      var d2 = q("#dlg-owner");
      if (d2) d2.showModal();
    }
    else if (a === "bulk:export") csvExport(ids);
    else if (a === "bulk:archive") bulkArchive(ids);
  });

  window.addEventListener("popstate", function () { readURL(); apply(); });

  /* ------------------------------- init ------------------------------ */

  readQD();
  readURL();
  apply();
})();`;
}

/* ------------------------------ render ------------------------------- */

const BAND_ORDER = ["work", "soon", "needs_evidence", "suppressed", "below", "unscored"];
const BAND_KEY = {
  work: "band.work",
  soon: "band.soon",
  needs_evidence: "band.abstained",
  suppressed: "band.suppressed",
  below: "band.below",
  unscored: "band.unscored",
};
const BAND_RULE = {
  work: "rule.work",
  soon: "rule.soon",
  needs_evidence: "rule.abstained",
  suppressed: "rule.suppressed",
  below: "rule.below",
  unscored: "rule.unscored",
};
const REGIONS = ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"];
const REGION_SHORT = { NORTHAMERICA: "NA", EUROPE: "EU", APAC: "APAC", LATAM: "LATAM", AMEA: "AMEA" };
const SIGNAL_KINDS = new Set(["expansion", "product", "psp_change", "funding", "hiring", "leadership"]);

/* Verbatim-English tag beside stored model text, Spanish surface only. */
const verbatim = (T, lang) =>
  lang === "es"
    ? ` <span class="verbatim" title="${esc(T("ev.verbatim"))}">${esc(T("q.verbatimTag"))}</span>`
    : "";

export async function render(env, data, ctx) {
  const T = ctx.t;
  const lang = ctx.lang;
  const payload = data || {};
  const rows = payload.rows || [];
  const settings = payload.settings || {};
  const floor = Number(settings.floor_txn ?? 100000);
  const days = Number(settings.cooldown_days ?? 45);
  const per = Number(payload.cost?.per_account || 0);
  const assessed = Number(payload.cost?.assessed || 0);
  const cached = payload.mode === "cached";
  const perLabel = money(per > 0 ? per : 0.29, 2);

  /* Archived accounts, read directly: the queue payload deliberately
     excludes them, and the Archived section is what keeps every archive
     reversible after its toast dies (§5.4, LEARNINGS §10). */
  let archived = [];
  try {
    if (env?.DB) {
      const { results } = await env.DB.prepare(
        "SELECT domain, name, region, owner, archived_at FROM accounts WHERE archived_at IS NOT NULL ORDER BY archived_at DESC"
      ).all();
      archived = results || [];
    }
  } catch { archived = []; }

  /* ------------------------- cell builders ------------------------- */

  const acctCell = (r) => {
    const bits = [r.domain];
    if (r.region) bits.push(REGION_SHORT[r.region] || r.region);
    if (r.owner) bits.push(r.owner);
    return `<div class="q-acct"><b>${esc(r.name || r.domain)}</b><span class="q-acct-sub">${esc(bits.join(" · "))}</span></div>`;
  };

  const fitCell = (r) => {
    if (!r.assessment_id) {
      return `<div class="q-fit q-fit-none">${mark("hollow", T("queue.notAssessed"), { tone: "ghost" })}</div>`;
    }
    if (r.abstained) {
      return `<div class="q-fit"><span class="q-fit-word">${esc(T("queue.abstainedShort"))}</span>${gauge({ abstained: true }, T)}</div>`;
    }
    const lo = r.txn_min ?? r.txn_mid;
    const hi = r.txn_max ?? r.txn_mid;
    return `<div class="q-fit">
      <div class="q-fit-l"><b>${esc(count(r.txn_mid))}</b><span class="q-fit-r">${esc(count(lo))}–${esc(count(hi))} · ${esc(pct(r.confidence))}</span></div>
      ${gauge({ min: lo, mid: r.txn_mid, max: hi, floor, verdict: r.floor_verdict, confidence: r.confidence }, T)}
    </div>`;
  };

  const timingCell = (r) => {
    const { driver } = scoreTiming(r.signals || []);
    if (!driver) return `<span class="q-none">${esc(T("queue.noTrigger"))}</span>`;
    const kindKey = SIGNAL_KINDS.has(driver.kind) ? `q.k.${driver.kind}` : "q.k.other";
    const when = dateISO(driver.observed_at) || T("common.undated");
    return `<div class="q-t">
      <span class="q-t-k t-label">${esc(T(kindKey))} · ${esc(when)}</span>
      <span class="q-t-d">${esc(driver.description || "")}</span>
    </div>`;
  };

  /* mark plus word, and the word carries the date the state turns on.
     "never touched" is the honest word for a null, not "fresh". */
  const coolCell = (r) => {
    if (r.cooldown_state === "suppressed") {
      return `<div class="q-cd">${mark("half", T("cool.held", { date: dateISO(r.cooldown_until) }), { tone: "warn" })}</div>`;
    }
    if (r.cooldown_state === "eligible") {
      const when = dateISO(r.last_touched_at);
      return `<div class="q-cd">${mark("filled", T("cool.eligible"), { tone: "ok" })}${
        when ? `<span class="q-cd-until">${esc(T("cool.lastTouched", { date: when }))}</span>` : ""}</div>`;
    }
    return `<div class="q-cd">${mark("hollow", T("cool.neverTouched"), { tone: "mute" })}</div>`;
  };

  const scoreCell = (r) =>
    r.assessment_id && !r.abstained
      ? `<span class="mono">${Number(r.total_score || 0).toFixed(2)}</span>`
      : `<span class="q-none mono">–</span>`;

  /* ------------------------- row expansion ------------------------- */

  const insetHtml = (r) => {
    const acctHref = `/account/${encodeURIComponent(r.domain)}`;
    const hasRun = !!r.assessment_id;

    let main;
    if (!hasRun) {
      main = `<span class="t-label">${esc(T(BAND_KEY.unscored))}</span>
        <p class="t-body">${esc(T("xp.noRun"))}</p>`;
    } else {
      const nSig = (r.signals || []).length;
      const dims = statRow([
        {
          label: T("dim.fit"),
          value: r.fit_score == null ? null : Number(r.fit_score).toFixed(2),
          note: r.fit_score == null ? T("queue.abstainedShort") : T("dim.vsFloorLong", { floor: count(floor) }),
        },
        {
          label: T("dim.timing"),
          value: Number(r.timing_score || 0).toFixed(2),
          note: nSig ? T("dim.signalsDecay", { n: nSig }) : T("dim.noDatedReason"),
        },
        {
          label: T("dim.confidence"),
          value: r.confidence == null ? null : pct(r.confidence),
          note: T("dim.dampensLong"),
        },
        {
          label: T("dim.region"),
          value: r.region_weight == null ? null : Number(r.region_weight).toFixed(2),
          note: r.region || T("acct.regionUnknown"),
        },
        {
          label: T("dim.score"),
          value: r.abstained ? null : Number(r.total_score || 0).toFixed(2),
          note: r.abstained ? T("verdict.noEstimate") : T("dim.formula"),
        },
      ]);
      main = `<span class="t-label">${esc(T("xp.whyRank", { rank: r.rank }))}</span>
        <p class="t-body">${esc(r.rank_reason || "")}${verbatim(T, lang)}</p>
        ${dims}`;
    }

    const sigs = (r.signals || []).map((s) => {
      const kindKey = SIGNAL_KINDS.has(s.kind) ? `q.k.${s.kind}` : "q.k.other";
      const when = dateISO(s.observed_at) || T("common.undated");
      const link = s.url
        ? ` <a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(host(s.url))} ↗</a>`
        : "";
      return `<li><span class="t-label">${esc(T(kindKey))} · ${esc(when)}</span><p>${esc(s.description || "")}${link}</p></li>`;
    }).join("");
    const rail = `<span class="t-label">${esc(T("sig.title"))}</span>
      ${sigs ? `<ul>${sigs}</ul>` : `<p class="q-none t-data">${esc(T("sig.none"))}</p>`}`;

    const actions = [
      btn(T("xp.openEvidence"), { kind: "text", href: acctHref }),
      btn(hasRun ? T("q.reassess") : T("xp.assessNow"), { kind: "text", action: "assess-row" }),
      btn(T("q.touch"), { kind: "text", action: "touch" }),
      btn(T("q.edit"), { kind: "text", action: "edit" }),
      btn(T("q.archive"), { kind: "text", action: "destroy:archive", danger: true }),
    ].join("");

    return `<div class="q-x" data-id="${esc(r.domain)}">
      <div class="q-x-main">${main}</div>
      <aside class="q-x-rail">${rail}</aside>
      <div class="q-x-act">${actions}</div>
    </div>`;
  };

  const rowMenuItems = (r) => [
    { label: T("q.open"), href: `/account/${encodeURIComponent(r.domain)}` },
    { label: r.assessment_id ? T("q.reassess") : T("xp.assessNow"), action: "assess-row" },
    { label: T("q.edit"), action: "edit" },
    { label: T("q.touch"), action: "touch" },
    ...(r.assessment_id ? [{ label: T("q.history"), action: "history" }] : []),
    "-",
    { label: T("q.archive"), action: "destroy:archive", danger: true },
  ];

  /* --------------------------- the bands --------------------------- */

  const cols = [
    { label: "#", width: 40, align: "right" },
    { label: T("col.account") },
    { label: T("col.estTxn"), width: 260 },
    { label: T("col.timing"), width: 200 },
    { label: T("col.cooldown"), width: 132 },
    { label: T("col.score"), width: 64, align: "right" },
  ];

  const bandCounts = {};
  for (const r of rows) bandCounts[r.band] = (bandCounts[r.band] || 0) + 1;

  const bandSection = (band, isFirst) => {
    const bandRows = rows.filter((r) => r.band === band);
    if (!bandRows.length) return "";
    let rule = band === "unscored" && per > 0
      ? T("rule.unscoredCost", { cost: perLabel })
      : T(BAND_RULE[band], { floor: count(floor), days });
    let ruleHtml = esc(rule);
    if (band === "suppressed") ruleHtml += ` · <a href="/settings">${esc(T("q.window"))}</a>`;
    const tbl = table({
      cols,
      rows: bandRows.map((r) => ({
        id: r.domain,
        cells: [
          `<span class="q-rank mono">${r.rank}</span>`,
          acctCell(r),
          fitCell(r),
          timingCell(r),
          coolCell(r),
          scoreCell(r),
        ],
        menu: rowMenuItems(r),
        inset: insetHtml(r),
      })),
      selectable: true,
      size: "tall",
    }, T);
    return `<section class="q-band${isFirst ? " q-first" : ""}" data-band="${esc(band)}">
      <header class="q-bandh">
        <span class="q-sq q-sq-${esc(band)}" aria-hidden="true"></span>
        <h2 class="t-section">${esc(T(BAND_KEY[band]))}</h2>
        <span class="q-bandn">${bandRows.length}</span>
        <span class="q-bandr">${ruleHtml}</span>
      </header>
      ${tbl}
      <div class="q-bandempty f-empty" hidden><p>${esc(T("q.filterEmpty"))}</p></div>
    </section>`;
  };

  let seenFirst = false;
  const bandsHtml = BAND_ORDER.map((b) => {
    const html = bandSection(b, !seenFirst && !!bandCounts[b]);
    if (html && !seenFirst) seenFirst = true;
    return html;
  }).join("");

  /* --------------------------- the chrome -------------------------- */

  const whead = `<div class="whead">
    <div class="whead-t">
      <h1 class="t-title">${esc(T("nav.queue"))}</h1>
      <span class="whead-meta" id="q-meta">${esc(T("q.meta", { n: rows.length, a: assessed, c: money(per, 4) }))}</span>
    </div>
    <div class="whead-a">
      ${btn(T("action.export"), { kind: "quiet", href: "/api/export.csv" })}
      ${btn(T("action.addAccounts"), { kind: "primary", action: "open-add" })}
    </div>
  </div>`;

  /* first-run strip: server renders it hidden; the client shows it until
     it is dismissed once (localStorage), so visit forty skips the pitch */
  const intro = `<div id="q-intro" class="q-intro well" hidden>
    <p>${T("queue.lede")}</p>
    ${btn(T("q.introDismiss"), { kind: "text", action: "dismiss-intro" })}
  </div>`;

  const assessBar = `<div class="q-assess well">
    <form id="assess-form" class="q-assess-f">
      <input id="assess-domain" class="input mono q-dom" type="text"
        placeholder="${esc(T("field.domainPh"))}" aria-label="${esc(T("field.assessOne"))}"${cached ? " disabled" : ""}>
      <input id="assess-touched" class="input" type="date"
        aria-label="${esc(T("field.lastTouched"))}" title="${esc(T("field.touchedTip"))}"${cached ? " disabled" : ""}>
      ${btn(T("action.assess"), { kind: "primary", id: "assess-go", type: "submit", disabled: cached })}
    </form>
    ${cached
      ? `<div class="q-assess-cached">${mark("half", T("chrome.capReached"), { tone: "warn" })}<span>${esc(T("q.cachedNote"))}</span></div>`
      : `<p class="q-assess-note">${esc(per > 0 ? T("q.assessNote", { cost: perLabel }) : T("queue.runNote"))}</p>`}
    <div id="assess-out" hidden></div>
  </div>`;

  const tabItems = [
    { href: "/", label: T("action.all"), count: rows.length, on: true },
    ...BAND_ORDER.filter((b) => bandCounts[b]).map((b) => ({
      href: `/?band=${b}`,
      label: T(BAND_KEY[b]),
      count: bandCounts[b],
    })),
  ];
  const toolbar = `<div class="q-toolbar">
    ${tabs(tabItems)}
    <input id="q-filter" class="q-ctl mono" type="search" placeholder="${esc(T("action.filter"))}"
      aria-label="${esc(T("action.filter"))}" data-hotkey="/">
    <select id="q-region" class="q-ctl" aria-label="${esc(T("dim.region"))}">
      <option value="">${esc(T("q.regionAll"))}</option>
      ${REGIONS.map((x) => `<option value="${x}">${x}</option>`).join("")}
    </select>
    <select id="q-sort" class="q-ctl" aria-label="${esc(T("q.sortAria"))}">
      ${["rank", "est", "conf", "name"].map((s) => `<option value="${s}">${esc(T("q.sort." + s))}</option>`).join("")}
    </select>
  </div>`;

  const emptyUniverse = `<div class="f-empty">
    <p>${esc(T("q.emptyAll"))}</p>
    ${btn(T("action.addAccounts"), { kind: "primary", action: "open-add" })}
  </div>`;

  const archSection = archived.length
    ? section({
        title: T("q.archived"),
        sub: `${archived.length} · ${esc(T("q.archivedSub"))}`,
        body: `<div class="q-arch">${table({
          cols: [
            { label: T("col.account") },
            { label: T("dim.region"), width: 160 },
            { label: T("q.archivedOn"), width: 160 },
          ],
          rows: archived.map((a) => ({
            id: a.domain,
            dim: true,
            cells: [
              `<div class="q-acct"><b>${esc(a.name || a.domain)}</b><span class="q-acct-sub">${esc(a.domain)}</span></div>`,
              `<span class="mono ink-3">${esc(a.region || "")}</span>`,
              `<span class="mono ink-3">${esc(dateISO(a.archived_at))}</span>`,
            ],
            menu: [
              { label: T("q.open"), href: `/account/${encodeURIComponent(a.domain)}` },
              { label: T("q.restore"), action: "restore:unarchive" },
            ],
          })),
          size: "dense",
        }, T)}</div>`,
      })
    : "";

  /* -------------------- client data + dialogs ---------------------- */

  const qmap = {};
  for (const r of rows) {
    qmap[r.domain] = {
      n: r.name || "", r: r.region || "", o: r.owner || "", t: r.last_touched_at || "",
      b: r.band, k: r.rank, s: r.total_score ?? 0,
      m: r.txn_mid, mn: r.txn_min, mx: r.txn_max, c: r.confidence,
      a: r.abstained ? 1 : 0, ai: r.assessment_id || null,
    };
  }
  const amap = {};
  for (const a of archived) amap[a.domain] = { n: a.name || "" };
  const qdataJson = JSON.stringify({ lang, floor, days, per, rows: qmap, arch: amap })
    .replace(/</g, "\\u003c");

  const dlgAdd = dialog({
    id: "dlg-add",
    title: T("action.addAccounts"),
    body: `${field({ id: "q-add-text", label: T("action.addAccounts"), type: "textarea", rows: 6, mono: true })}
      <p class="fld-hint">${T("queue.addHint")}</p>`,
    confirm: { label: T("action.add"), action: "import" },
  }, T);

  const dlgEdit = dialog({
    id: "dlg-edit",
    title: T("q.edit"),
    body: [
      field({ id: "q-e-name", label: T("q.fName") }),
      field({
        id: "q-e-region", label: T("q.fRegion"),
        options: [{ value: "", label: T("acct.regionUnknown") }, ...REGIONS],
      }),
      field({ id: "q-e-owner", label: T("q.fOwner") }),
      field({ id: "q-e-touched", label: T("q.fTouched"), type: "date", hint: T("q.fTouchedHint") }),
      `<p class="fld-effect">${esc(T("q.editEffect"))}</p>`,
    ].join(""),
    confirm: { label: T("action.save"), action: "save-edit" },
  }, T);

  const dlgOwner = dialog({
    id: "dlg-owner",
    title: T("q.bulkOwner"),
    body: field({ id: "q-o-owner", label: T("q.fOwner") }),
    confirm: { label: T("action.save"), action: "bulk-owner-go" },
  }, T);

  const dlgHistory = dialog({
    id: "dlg-history",
    title: T("q.history"),
    body: `<div id="q-hist-body"></div>`,
  }, T);

  const bulkTemplate = `<template data-bulk>
    ${btn(T("q.bulkAssess"), { kind: "quiet", size: "sm", action: "bulk:assess" })}
    ${btn(T("q.bulkOwner"), { kind: "quiet", size: "sm", action: "bulk:owner" })}
    ${btn(T("q.bulkExport"), { kind: "quiet", size: "sm", action: "bulk:export" })}
    ${btn(T("q.bulkArchive"), { kind: "text", size: "sm", danger: true, action: "bulk:archive" })}
  </template>`;

  /* ----------------------------- assembly -------------------------- */

  return `${whead}
${intro}
${assessBar}
<div id="q-main">
  ${rows.length ? toolbar + bandsHtml : emptyUniverse}
  ${archSection}
  <script type="application/json" id="q-data">${qdataJson}</script>
</div>
<p class="q-kbd">${esc(T("q.kbd"))}</p>
${dlgAdd}
${dlgEdit}
${dlgOwner}
${dlgHistory}
${bulkTemplate}`;
}
