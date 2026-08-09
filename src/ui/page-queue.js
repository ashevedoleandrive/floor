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
    en: "{n} accounts · {a} assessed · {c} measured cost per account",
    es: "{n} cuentas · {a} analizadas · {c} de costo medido por cuenta",
  },
  "q.introDismiss": { en: "Got it", es: "Entendido" },
  "q.assessNote": {
    en: "Research, extraction, then an adversarial critic. Two to four minutes, about {cost} per account, and it abstains out loud when the evidence will not carry a number.",
    es: "Investigación, extracción y un crítico adversarial. De dos a cuatro minutos, unos {cost} por cuenta, y se abstiene en voz alta cuando la evidencia no sostiene un número.",
  },
  "q.cachedNote": {
    en: "Live runs resume tomorrow. Every stored assessment, filter and export below still works.",
    es: "Los análisis en vivo vuelven mañana. Cada análisis guardado, los filtros y la exportación siguen funcionando.",
  },
  "q.window": { en: "change it in Settings", es: "se cambia en Ajustes" },
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
  "q.archivedSub": {
    en: "out of the queue, never deleted. Restore returns a row ranked exactly where its data puts it.",
    es: "fuera de la cola, nunca eliminadas. Restaurar devuelve la fila al puesto exacto que sus datos le dan.",
  },
  "q.archivedOn": { en: "Archived", es: "Archivada" },

  "q.editTitle": { en: "Edit {name}", es: "Editar {name}" },
  "q.fName":   { en: "Name", es: "Nombre" },
  "q.fRegion": { en: "Region", es: "Región" },
  "q.fOwner":  { en: "Owner", es: "Responsable" },
  "q.fTouched": { en: "Last touched", es: "Último contacto" },
  "q.fTouchedHint": {
    en: "Feeds the cool-down score. YYYY-MM-DD, never in the future.",
    es: "Alimenta el enfriamiento. AAAA-MM-DD, nunca en el futuro.",
  },
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
};

/* ------------------------------- css --------------------------------- */
/* Scoped to .p-queue, layout only. Kit primitives are consumed, never
   restyled; the two necessary exceptions are flagged in comments. */

export function css() {
  return `
  /* working header */
  .p-queue .whead-t { flex-wrap: wrap; }

  /* first-run strip + assess bar */
  .p-queue .q-intro { margin-top: 16px; display: flex; gap: 16px; align-items: baseline; justify-content: space-between; }
  .p-queue .q-intro p { max-width: 72ch; font-size: 13px; color: var(--ink-2); }
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
  .p-queue .q-bandh { display: flex; align-items: baseline; gap: 10px; padding-bottom: 8px; }
  .p-queue .q-bandh h2 { flex: none; }
  .p-queue .q-sq { width: 8px; height: 8px; flex: none; align-self: center; }
  .p-queue .q-sq-work { background: var(--ok); }
  .p-queue .q-sq-soon { background: var(--ink-2); }
  .p-queue .q-sq-needs_evidence { background: transparent; border: 1.3px dashed var(--held); }
  .p-queue .q-sq-suppressed { background: var(--warn); }
  .p-queue .q-sq-below { background: var(--bad); }
  .p-queue .q-sq-unscored { background: transparent; border: 1px solid var(--ink-4); }
  .p-queue .q-bandn { font-family: var(--mono); font-size: 12px; color: var(--ink-3); flex: none; }
  .p-queue .q-bandr { font-size: 12px; color: var(--ink-3); min-width: 0; }
  .p-queue .q-bandempty { margin-top: 8px; }

  /* column alignment across the band tables: fixed layout so every band
     shares identical column x-positions (shared-edge law, §3.2), and the
     repeated column headers collapse to zero height everywhere but the
     first visible band — kept in the tree so each table stays labelled
     for assistive tech and keeps its width source of truth. */
  .p-queue .q-band .tbl { table-layout: fixed; }
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
  .p-queue .q-fit-word { font-size: 12px; color: var(--held); margin-bottom: 2px; display: block; }
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

/* placeholder: script() and render() appended below */
