/* Floor · page-backlog.js, the Backlog board (route /backlog)
   ---------------------------------------------------------------------
   Rebuilt 2026-08-09. The old page grouped cards into columns by area
   and printed the status as a small mark on each card, so the columns
   were a taxonomy, the status was a label, and nothing ever moved. A
   backlog whose columns are areas is a filing cabinet.

   The columns are now the three stages a build actually passes through,
   idea, building, live, and the area demotes to a property of the card:
   an eyebrow on its face and a filter above the board. Cards cross the
   board by drag, by keyboard, or from their own menu, and the move is
   optimistic, confirmed with a flash and a toast, and rolled back
   visibly when the API refuses it.

   Designed for a sparse board first. There are five cards and one of
   them is live, so a stage with nothing in it is the normal case, not a
   rendering failure: every empty stage renders the dashed deliberate-
   absence zone with the sentence that says what lands there and the one
   action that puts something there. The same layout holds at fifty
   because the columns are fluid and the cards are fixed-shape.

   Per DESIGN-SPEC §4.9 this is the one page where a card is a legitimate
   container, so the card is defined once, here, scoped to this page.
   §4.9 asks for a 2px left rule per status and names accent for
   "building"; §3.3 rule 1 reserves accent for "you can act here" and
   forbids it encoding a domain state, so the rule runs line-2 / ink-1 /
   ok instead. Same ladder, no overloaded accent.

   Data: render() receives GET /api/backlog with includeArchived: true,
   so byArea carries archived cards too and `total`/`live` count them.
   The page recomputes both from what an operator can actually see.
   --------------------------------------------------------------------- */

import { esc, host, mark, rowMenu, field, dialog } from "./kit.js";

export const meta = { route: "/backlog", nav: "/backlog", titleKey: "nav.backlog" };

const STAGES = ["idea", "building", "live"];
const STAGE_MARK = { idea: "hollow", building: "half", live: "filled" };
const STAGE_TONE = { idea: "mute", building: "ink", live: "ok" };

/* ============================== copy ================================ */
/* Reused from i18n.js as-is: nav.backlog, bl.gap, bl.moves, bl.st.*,
   bl.unassigned, bl.newCard, bl.dlgTitle, bl.addCard, bl.phTitle,
   bl.phGap, bl.phMetric, bl.phOwner, action.save, common.notSaved,
   kit.menu.aria. Everything below is new to this page. */

export const keys = {
  "bl.header": {
    en: "{total} cards · {live} live",
    es: "{total} tarjetas · {live} en producción",
  },

  /* stages: the columns */
  "bl.col.idea":     { en: "Idea", es: "Idea" },
  "bl.col.building": { en: "Building", es: "En construcción" },
  "bl.col.live":     { en: "Live", es: "En producción" },
  "bl.note.idea":     { en: "named, not started", es: "nombrada, sin empezar" },
  "bl.note.building": { en: "in flight now", es: "en marcha ahora" },
  "bl.note.live":     { en: "shipped and running", es: "entregada y corriendo" },
  "bl.cardsAria":     { en: "{n} cards", es: "{n} tarjetas" },

  /* empty stages: a waiting state, not a void */
  "bl.empty.idea":     { en: "Nothing waiting.", es: "Nada en espera." },
  "bl.empty.building": { en: "Nothing under construction.", es: "Nada en construcción." },
  "bl.empty.live":     { en: "Nothing shipped yet.", es: "Nada entregado todavía." },
  "bl.emptyFiltered": {
    en: "No {area} cards at this stage.",
    es: "No hay tarjetas de {area} en esta etapa.",
  },
  "bl.addHere": { en: "Add a card here", es: "Agrega una tarjeta aquí" },
  "bl.dropTo":  { en: "Move to {stage}", es: "Mover a {stage}" },

  /* filter + keyboard */
  "bl.areaAll":   { en: "All areas", es: "Todas las áreas" },
  "bl.filterAria": { en: "Filter by area", es: "Filtrar por área" },
  "bl.kbd": {
    en: "Focus a card, then {lr} moves it between stages, {ud} moves between cards, and {enter} expands it.",
    es: "Enfoca una tarjeta: {lr} la mueve entre etapas, {ud} cambia de tarjeta y {enter} la expande.",
  },
  "bl.kbd.enter": { en: "Enter", es: "Intro" },

  /* card face */
  "bl.openLink":    { en: "Open", es: "Abrir" },
  "bl.details":     { en: "Details", es: "Detalles" },
  "bl.detailsHide": { en: "Hide", es: "Ocultar" },
  "bl.notStated":   { en: "not stated", es: "sin indicar" },
  "bl.needsBoth":   { en: "gap or metric missing", es: "falta la brecha o la métrica" },
  "bl.archivedWord": { en: "archived", es: "archivada" },
  "bl.showArchived": { en: "Show archived", es: "Mostrar archivadas" },
  "bl.hideArchived": { en: "Hide archived", es: "Ocultar archivadas" },

  /* menu */
  "bl.action.to.idea":     { en: "Move to idea", es: "Mover a idea" },
  "bl.action.to.building": { en: "Move to building", es: "Pasar a en construcción" },
  "bl.action.to.live":     { en: "Move to live", es: "Marcar como en producción" },
  "bl.action.edit":    { en: "Edit", es: "Editar" },
  "bl.action.archive": { en: "Archive", es: "Archivar" },
  "bl.action.restore": { en: "Restore", es: "Restaurar" },

  /* dialogs */
  "bl.f.area":     { en: "Area", es: "Área" },
  "bl.f.title":    { en: "Title", es: "Título" },
  "bl.f.gap":      { en: "Gap it closes", es: "Brecha que cierra" },
  "bl.f.metric":   { en: "Metric it moves", es: "Métrica que mueve" },
  "bl.f.owner":    { en: "Owner", es: "Responsable" },
  "bl.f.link":     { en: "Link", es: "Enlace" },
  "bl.f.linkHint": { en: "Where to see it or track it", es: "Dónde verlo o seguirlo" },
  "bl.f.stage":    { en: "Stage", es: "Etapa" },
  "bl.editTitle":  { en: "Edit card", es: "Editar tarjeta" },
  "bl.addHint": {
    en: "A card earns its place by answering both questions, so the gap and the metric are required.",
    es: "Una tarjeta se gana su lugar respondiendo las dos preguntas, así que la brecha y la métrica son obligatorias.",
  },

  /* errors + toasts */
  "bl.err.titleRequired":  { en: "A card needs a title.", es: "Una tarjeta necesita un título." },
  "bl.err.gapRequired":    { en: "Say which gap this closes.", es: "Indica qué brecha cierra." },
  "bl.err.metricRequired": { en: "Say which metric it moves.", es: "Indica qué métrica mueve." },
  "bl.err.generic":        { en: "Could not save. Try again.", es: "No se pudo guardar. Intenta de nuevo." },
  "bl.toast.added":    { en: "Card added to {area}.", es: "Tarjeta agregada a {area}." },
  "bl.toast.updated":  { en: "Card updated.", es: "Tarjeta actualizada." },
  "bl.toast.movedTo":  { en: "Moved to {stage}.", es: "Movida a {stage}." },
  "bl.toast.archived": { en: "Card archived.", es: "Tarjeta archivada." },
  "bl.toast.restored": { en: "Card restored.", es: "Tarjeta restaurada." },
  "bl.moveFailed": {
    en: "Not moved: {err}. The card went back.",
    es: "No se movió: {err}. La tarjeta volvió a su lugar.",
  },
};

/* ============================== helpers ============================== */

const GRIP_SVG = `<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true"><circle cx="2" cy="3" r="1.1"/><circle cx="8" cy="3" r="1.1"/><circle cx="2" cy="7" r="1.1"/><circle cx="8" cy="7" r="1.1"/><circle cx="2" cy="11" r="1.1"/><circle cx="8" cy="11" r="1.1"/></svg>`;

const DOTS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>`;

/** Every card in one list, archived included, in the order the board
 *  shows them: by area as the server groups them, newest first inside an
 *  area, archived last. Mirrored in script(); keep the two in lockstep. */
function flatten(data) {
  const areas = data.areas || [];
  const out = [];
  for (const a of areas) for (const c of data.byArea[a] || []) out.push(c);
  return out;
}

function sortCards(list, areas) {
  const rank = (c) => {
    const i = areas.indexOf(c.area);
    return i < 0 ? areas.length : i;
  };
  return list.slice().sort((a, b) => {
    const aa = a.archived_at ? 1 : 0, ba = b.archived_at ? 1 : 0;
    if (aa !== ba) return aa - ba;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    return Number(b.id) - Number(a.id);
  });
}

function menuItems(c, t) {
  if (c.archived_at) return [{ label: t("bl.action.restore"), action: "restore:archive" }];
  const items = [];
  for (const s of STAGES) if (s !== c.status) items.push({ label: t(`bl.action.to.${s}`), action: `move:${s}` });
  items.push("-");
  items.push({ label: t("bl.action.edit"), action: "edit" });
  items.push("-");
  items.push({ label: t("bl.action.archive"), action: "destroy:archive", danger: true });
  return items;
}

/** kit.js exports rowMenu() but not the host button, which only table()
 *  builds. Composed here from the exported contents plus the shared
 *  .menu-host / .btn-icon classes, the same way page-evals.js does. A
 *  small menuHost() export would remove both copies; see the report. */
const menuHost = (items, t) =>
  `<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t("kit.menu.aria"))}">${DOTS_SVG}</button>${rowMenu(items)}</div>`;

/* ============================ the card =============================== */

function cardHtml(c, t) {
  const archived = !!c.archived_at;
  const cls = `bl-card bl-s-${esc(c.status)}${archived ? " bl-arch" : ""}`;
  const detId = `bl-det-${esc(c.id)}`;
  const link = String(c.link || "").trim();
  const external = /^https?:\/\//i.test(link);
  // An internal path like "/" is not a name; the word is.
  const linkText = external ? `${host(link)} ↗` : `${t("bl.openLink")} ↗`;
  const missing = !c.gap || !c.metric;

  const line = (label, value, metric) =>
    `<p class="bl-l${metric ? " bl-l-m" : ""}"><span class="bl-k t-label">${esc(label)}</span><span class="bl-v t-body">${
      value ? esc(value) : `<span class="ink-4">${esc(t("bl.notStated"))}</span>`
    }</span></p>`;

  const marks = [
    archived ? mark("hatch", t("bl.archivedWord"), { tone: "held" }) : "",
    !archived && missing ? mark("half", t("bl.needsBoth"), { tone: "warn" }) : "",
  ].join("");

  return `<article class="${cls}" data-id="${esc(c.id)}" data-status="${esc(c.status)}" data-area="${esc(c.area)}" tabindex="0" aria-describedby="bl-kbd">
    <div class="bl-c-h">
      <span class="bl-grip" aria-hidden="true">${GRIP_SVG}</span>
      <span class="bl-area t-label">${esc(c.area)}</span>
      ${menuHost(menuItems(c, t), t)}
    </div>
    <h3 class="bl-t t-section">${esc(c.title)}</h3>
    <div class="bl-det" id="${detId}" inert>
      <div class="bl-det-in">
        ${line(t("bl.gap"), c.gap)}
        ${line(t("bl.moves"), c.metric, true)}
        <div class="bl-meta t-data">
          <span class="bl-own">${esc(c.owner || t("bl.unassigned"))}</span>
          ${link ? `<a class="bl-link" href="${esc(link)}"${external ? ` target="_blank" rel="noopener"` : ""}>${esc(linkText)}</a>` : ""}
        </div>
      </div>
    </div>
    <div class="bl-c-f">
      <button type="button" class="btn btn-text btn-sm bl-exp" aria-expanded="false" aria-controls="${detId}">${esc(t("bl.details"))}</button>
      ${marks}
    </div>
  </article>`;
}

/* =========================== the column ============================== */

function columnHtml(stage, cards, t, areaFilter) {
  const live = cards.filter((c) => !c.archived_at);
  const stageName = t(`bl.col.${stage}`);
  const body = cards.length
    ? cards.map((c) => cardHtml(c, t)).join("")
    : `<div class="f-empty bl-empty">
        <p>${esc(areaFilter ? t("bl.emptyFiltered", { area: areaFilter }) : t(`bl.empty.${stage}`))}</p>
        <button type="button" class="btn btn-text btn-sm bl-add-here" data-add-stage="${esc(stage)}">${esc(t("bl.addHere"))}</button>
      </div>`;

  return `<section class="bl-col" data-stage="${esc(stage)}" aria-labelledby="bl-h-${esc(stage)}">
    <header class="bl-col-h">
      <h2 class="bl-col-t" id="bl-h-${esc(stage)}">
        ${mark(STAGE_MARK[stage], stageName, { tone: STAGE_TONE[stage] })}
        <span class="bl-n mono" aria-label="${esc(t("bl.cardsAria", { n: live.length }))}">${live.length}</span>
      </h2>
      <p class="bl-col-n t-data ink-3">${esc(t(`bl.note.${stage}`))}</p>
    </header>
    <div class="bl-col-b">
      ${body}
      <div class="bl-drop t-data" aria-hidden="true">${esc(t("bl.dropTo", { stage: stageName }))}</div>
    </div>
  </section>`;
}

function boardHtml(cards, t, areaFilter) {
  return STAGES.map((s) => columnHtml(s, cards.filter((c) => c.status === s), t, areaFilter)).join("");
}

/* =========================== the dialogs ============================= */

function addDialogHtml(t, areas) {
  const body = `
    <p class="t-body ink-2">${esc(t("bl.addHint"))}</p>
    ${field({ id: "c-area", label: t("bl.f.area"), value: "Other", options: areas })}
    ${field({ id: "c-title", label: t("bl.f.title"), placeholder: t("bl.phTitle") })}
    ${field({ id: "c-gap", label: t("bl.f.gap"), type: "textarea", rows: 2, placeholder: t("bl.phGap") })}
    ${field({ id: "c-metric", label: t("bl.f.metric"), type: "textarea", rows: 2, placeholder: t("bl.phMetric") })}
    ${field({ id: "c-owner", label: t("bl.f.owner"), placeholder: t("bl.phOwner") })}
    ${field({ id: "c-link", label: t("bl.f.link"), hint: t("bl.f.linkHint") })}
    ${field({ id: "c-status", label: t("bl.f.stage"), value: "idea", options: STAGES.map((s) => ({ value: s, label: t(`bl.col.${s}`) })) })}
  `;
  return dialog({ id: "card-add", title: t("bl.dlgTitle"), body, confirm: t("bl.addCard") }, t);
}

function editDialogHtml(t, areas) {
  const body = `
    ${field({ id: "e-area", label: t("bl.f.area"), options: areas })}
    ${field({ id: "e-title", label: t("bl.f.title"), placeholder: t("bl.phTitle") })}
    ${field({ id: "e-gap", label: t("bl.f.gap"), type: "textarea", rows: 2, placeholder: t("bl.phGap") })}
    ${field({ id: "e-metric", label: t("bl.f.metric"), type: "textarea", rows: 2, placeholder: t("bl.phMetric") })}
    ${field({ id: "e-owner", label: t("bl.f.owner"), placeholder: t("bl.phOwner") })}
    ${field({ id: "e-link", label: t("bl.f.link"), hint: t("bl.f.linkHint") })}
  `;
  return dialog({ id: "card-edit", title: t("bl.editTitle"), body, confirm: t("action.save") }, t);
}

/* ============================== render =============================== */

export async function render(env, data, ctx) {
  const { t } = ctx;
  const areas = data.areas || [];
  const all = sortCards(flatten(data), areas);
  const visible = all.filter((c) => !c.archived_at);
  const total = visible.length;
  const live = visible.filter((c) => c.status === "live").length;
  const archivedCount = all.length - visible.length;

  const tabs = [{ area: "", label: t("bl.areaAll"), n: total }]
    .concat(areas.map((a) => ({ area: a, label: a, n: visible.filter((c) => c.area === a).length })))
    .map(({ area, label, n }) =>
      `<button type="button" class="tab${area === "" ? " on" : ""}" data-area="${esc(area)}" aria-pressed="${area === "" ? "true" : "false"}">${esc(label)}<span class="tab-n">${n}</span></button>`)
    .join("");

  /* One sentence, one key, with the key caps substituted after escaping.
     The sentinels are control characters, so esc() leaves them alone and
     no copy is assembled by concatenating keys (§3.11). */
  const kbdLine = esc(t("bl.kbd", { lr: "\u0001", ud: "\u0002", enter: "\u0003" }))
    .replace("\u0001", `<span class="kbd">\u2190 \u2192</span>`)
    .replace("\u0002", `<span class="kbd">\u2191 \u2193</span>`)
    .replace("\u0003", `<span class="kbd">${esc(t("bl.kbd.enter"))}</span>`);

  const state = JSON.stringify({ cards: all, areas }).replace(/</g, "\\u003c");

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.backlog"))}</h1>
        <span class="whead-meta" id="bl-header-count">${esc(t("bl.header", { total, live }))}</span>
      </div>
      <div class="whead-a">
        <button type="button" class="btn btn-quiet btn-sm" id="bl-arch-toggle" aria-pressed="false"${archivedCount ? "" : " disabled"}>${esc(t("bl.showArchived"))}</button>
        <button type="button" class="btn btn-primary" id="bl-add-open" data-open-dialog="card-add">${esc(t("bl.newCard"))}</button>
      </div>
    </div>

    <nav class="tabs bl-filter" id="bl-filter" aria-label="${esc(t("bl.filterAria"))}">${tabs}</nav>

    <div class="bl-board" id="bl-board">${boardHtml(visible, t, "")}</div>

    <p class="bl-kbd" id="bl-kbd">${kbdLine}</p>

    ${addDialogHtml(t, areas)}
    ${editDialogHtml(t, areas)}
    <script>window.__BACKLOG__=${state};</script>
  `;
}

/* =============================== css ================================== */

export function css() {
  return `
  .p-backlog .bl-filter { margin-top: 24px; }

  /* the board: three stages, hairline-separated, no boxes (§3.2) */
  .p-backlog .bl-board {
    margin-top: 24px;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: stretch;
  }
  .p-backlog .bl-col { min-width: 0; padding: 0 24px; border-left: 1px solid var(--line); }
  .p-backlog .bl-col:first-child { padding-left: 0; border-left: 0; }
  .p-backlog .bl-col:last-child { padding-right: 0; }

  .p-backlog .bl-col-h { padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .p-backlog .bl-col-t { font: inherit; display: flex; align-items: baseline; gap: 8px; }
  .p-backlog .bl-n { color: var(--ink-4); font-size: 12px; }
  .p-backlog .bl-col-n { margin-top: 4px; }

  .p-backlog .bl-col-b { padding-top: 16px; display: flex; flex-direction: column; gap: 12px; }
  .p-backlog .bl-empty { padding: 20px; }
  .p-backlog .bl-empty p { font-size: 13px; line-height: 1.5; }
  .p-backlog .bl-add-here { padding: 0; }

  /* the card: the one bordered content container in the product (§4.9),
     with the stage carried by a 2px left rule */
  .p-backlog .bl-card {
    position: relative;
    background: var(--paper);
    border: 1px solid var(--line);
    border-left: 2px solid var(--line-2);
    border-radius: 6px;
    padding: 10px 12px 10px 14px;
    cursor: grab;
    touch-action: pan-y;
    transition: border-color .12s var(--ease), box-shadow .12s var(--ease),
                transform .18s var(--ease), opacity .18s var(--ease);
  }
  .p-backlog .bl-card:hover { border-color: var(--line-2); }
  .p-backlog .bl-s-idea     { border-left-color: var(--line-2); }
  .p-backlog .bl-s-building { border-left-color: var(--ink-1); }
  .p-backlog .bl-s-live     { border-left-color: var(--ok); }
  .p-backlog .bl-arch { border-left-color: var(--held); opacity: .6; cursor: default; }

  .p-backlog .bl-c-h { display: flex; align-items: center; gap: 8px; }
  .p-backlog .bl-grip { color: var(--ink-4); flex: none; }
  .p-backlog .bl-area { color: var(--ink-3); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .p-backlog .bl-c-h .menu-host { margin-left: auto; flex: none; }

  .p-backlog .bl-t { margin-top: 4px; line-height: 1.35; }

  /* expand in place: a size transition off one class, dead under
     prefers-reduced-motion, and inert while closed so nothing inside it
     is tabbable behind a closed face */
  .p-backlog .bl-det { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .18s var(--ease); }
  .p-backlog .bl-card.is-open .bl-det { grid-template-rows: 1fr; }
  .p-backlog .bl-det-in { overflow: hidden; }
  .p-backlog .bl-l { display: flex; gap: 8px; margin-top: 12px; }
  .p-backlog .bl-k { color: var(--ink-3); flex: none; width: 72px; padding-top: 3px; }
  .p-backlog .bl-v { color: var(--ink-2); min-width: 0; }
  /* the number it moves is the payoff, so it carries the darker ink */
  .p-backlog .bl-l-m .bl-v { color: var(--ink-1); }
  .p-backlog .bl-meta { margin-top: 12px; display: flex; gap: 12px; flex-wrap: wrap; color: var(--ink-3); }
  .p-backlog .bl-own { min-width: 0; }
  .p-backlog .bl-link { white-space: nowrap; }

  .p-backlog .bl-c-f { margin-top: 8px; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .p-backlog .bl-exp { padding: 0; }
  .p-backlog .bl-c-f .mk { font-size: 12px; }

  /* drag: lifted to the overlay plane, and every stage says it can
     receive the card rather than lighting up only under the pointer */
  .p-backlog .bl-card.is-drag {
    position: fixed; z-index: 90; margin: 0;
    background: var(--white); box-shadow: var(--shadow);
    cursor: grabbing; transition: none;
  }
  .p-backlog .bl-board.is-dragging { user-select: none; -webkit-user-select: none; }
  .p-backlog .bl-board.is-dragging .bl-empty { display: none; }
  .p-backlog .bl-slot { border: 1px dashed var(--line-2); border-radius: 6px; }
  .p-backlog .bl-drop { display: none; }
  .p-backlog .bl-board.is-dragging .bl-drop {
    display: flex; align-items: center; justify-content: center;
    min-height: 44px; padding: 0 12px; text-align: center;
    border: 1px dashed var(--line-2); border-radius: 6px; color: var(--ink-3);
  }
  .p-backlog .bl-board.is-dragging .bl-col.is-over .bl-drop { border-color: var(--accent); color: var(--ink-1); }
  .p-backlog .bl-board.is-dragging .bl-col.is-over { background: color-mix(in srgb, var(--accent) 4%, transparent); }
  .p-backlog .bl-board.is-dragging .bl-card { cursor: grabbing; }

  /* optimistic state: held quiet until the API confirms */
  .p-backlog .bl-card.is-pending { opacity: .55; }
  .p-backlog .bl-card.is-settle { transform: translateY(-4px); opacity: .5; }

  .p-backlog .bl-kbd { margin-top: 24px; font-size: 12px; line-height: 1.6; color: var(--ink-4); }
  .p-backlog .bl-kbd .kbd { margin: 0 2px; }

  @media (max-width: 900px) {
    .p-backlog .bl-board { grid-template-columns: 1fr; }
    .p-backlog .bl-col { padding: 0; border-left: 0; margin-top: 32px; }
    .p-backlog .bl-col:first-child { margin-top: 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .p-backlog .bl-card, .p-backlog .bl-det { transition: none; }
    .p-backlog .bl-card.is-settle { transform: none; opacity: 1; }
  }
  `;
}

/* =============================== script ================================ */
/* The board repaints from in-memory state after every mutation, so the
   card, column and board builders below mirror the server ones field for
   field. Keep the two in lockstep. */

export function script() {
  return `(() => {
  "use strict";

  var STATE = window.__BACKLOG__ || { cards: [], areas: [] };
  var CARDS = STATE.cards || [];
  var AREAS = STATE.areas || [];
  var STAGES = ["idea", "building", "live"];
  var STAGE_MARK = { idea: "hollow", building: "half", live: "filled" };
  var STAGE_TONE = { idea: "mute", building: "ink", live: "ok" };

  var showArchived = false;
  var areaFilter = "";
  var openIds = {};
  var editingId = null;

  var board = document.getElementById("bl-board");
  var t = function (k, v) { return window.Floor ? window.Floor.t(k, v) : k; };

  /* ---- kit mirrors. A plain inline script cannot import an ES module,
     so the few builders this page repaints with are rebuilt here against
     the same classes kit.js emits. ---- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }
  function hostOf(u) { try { return new URL(u).host.replace(/^www\\./, ""); } catch (e) { return String(u || ""); } }

  var MARK_SVG = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    half: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/></svg>',
    hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>'
  };
  function mkHtml(kind, label, tone) {
    var cls = "mk tone-" + tone;
    return '<span class="' + cls + '">' + (MARK_SVG[kind] || "") + '<span class="mk-w">' + esc(label) + '</span></span>';
  }

  var GRIP_SVG = '<svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true"><circle cx="2" cy="3" r="1.1"/><circle cx="8" cy="3" r="1.1"/><circle cx="2" cy="7" r="1.1"/><circle cx="8" cy="7" r="1.1"/><circle cx="2" cy="11" r="1.1"/><circle cx="8" cy="11" r="1.1"/></svg>';
  var DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

  function menuItems(c) {
    if (c.archived_at) return [{ label: t("bl.action.restore"), action: "restore:archive" }];
    var items = [];
    STAGES.forEach(function (s) {
      if (s !== c.status) items.push({ label: t("bl.action.to." + s), action: "move:" + s });
    });
    items.push("-");
    items.push({ label: t("bl.action.edit"), action: "edit" });
    items.push("-");
    items.push({ label: t("bl.action.archive"), action: "destroy:archive", danger: true });
    return items;
  }
  function menuHost(c) {
    var rows = menuItems(c).map(function (it) {
      if (it === "-") return '<div class="menu-sep" role="separator"></div>';
      var cls = "menu-item" + (it.danger ? " danger" : "");
      return '<button type="button" class="' + cls + '" role="menuitem" data-action="' + esc(it.action) + '"' +
        (it.danger ? ' data-danger="1"' : "") + '>' + esc(it.label) + '</button>';
    }).join("");
    var btnCls = "btn-icon menu-btn";
    return '<div class="menu-host"><button type="button" class="' + btnCls + '" aria-haspopup="menu" aria-expanded="false" aria-label="' +
      esc(t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + '</div></div>';
  }

  /* ---- card, column, board ---- */

  function lineHtml(label, value, metric) {
    var v = value ? esc(value) : '<span class="ink-4">' + esc(t("bl.notStated")) + '</span>';
    var cls = metric ? "bl-l bl-l-m" : "bl-l";
    return '<p class="' + cls + '"><span class="bl-k t-label">' + esc(label) + '</span><span class="bl-v t-body">' + v + '</span></p>';
  }

  function cardHtml(c) {
    var archived = !!c.archived_at;
    var open = !!openIds[c.id];
    var cls = "bl-card bl-s-" + c.status + (archived ? " bl-arch" : "") + (open ? " is-open" : "") + (c._pending ? " is-pending" : "");
    var detId = "bl-det-" + c.id;
    var link = String(c.link || "").trim();
    var external = /^https?:\\/\\//i.test(link);
    var linkText = (external ? hostOf(link) : t("bl.openLink")) + " \\u2197";
    var missing = !c.gap || !c.metric;

    var marks = (archived ? mkHtml("hatch", t("bl.archivedWord"), "held") : "") +
      (!archived && missing ? mkHtml("half", t("bl.needsBoth"), "warn") : "");

    var out = '<article class="' + cls + '" data-id="' + esc(c.id) + '" data-status="' + esc(c.status) +
      '" data-area="' + esc(c.area) + '" tabindex="0" aria-describedby="bl-kbd">';
    out += '<div class="bl-c-h"><span class="bl-grip" aria-hidden="true">' + GRIP_SVG + '</span>' +
      '<span class="bl-area t-label">' + esc(c.area) + '</span>' + menuHost(c) + '</div>';
    out += '<h3 class="bl-t t-section">' + esc(c.title) + '</h3>';
    out += '<div class="bl-det" id="' + detId + '"' + (open ? "" : " inert") + '><div class="bl-det-in">';
    out += lineHtml(t("bl.gap"), c.gap);
    out += lineHtml(t("bl.moves"), c.metric, true);
    out += '<div class="bl-meta t-data"><span class="bl-own">' + esc(c.owner || t("bl.unassigned")) + '</span>';
    if (link) out += '<a class="bl-link" href="' + esc(link) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + '>' + esc(linkText) + '</a>';
    out += '</div></div></div>';
    var expCls = "btn btn-text btn-sm bl-exp";
    out += '<div class="bl-c-f"><button type="button" class="' + expCls + '" aria-expanded="' + (open ? "true" : "false") +
      '" aria-controls="' + detId + '">' + esc(open ? t("bl.detailsHide") : t("bl.details")) + '</button>' + marks + '</div>';
    out += '</article>';
    return out;
  }

  function columnHtml(stage, cards) {
    var live = cards.filter(function (c) { return !c.archived_at; });
    var stageName = t("bl.col." + stage);
    var body;
    if (cards.length) {
      body = cards.map(cardHtml).join("");
    } else {
      var msg = areaFilter ? t("bl.emptyFiltered", { area: areaFilter }) : t("bl.empty." + stage);
      var addCls = "btn btn-text btn-sm bl-add-here";
      body = '<div class="f-empty bl-empty"><p>' + esc(msg) + '</p>' +
        '<button type="button" class="' + addCls + '" data-add-stage="' + esc(stage) + '">' + esc(t("bl.addHere")) + '</button></div>';
    }
    return '<section class="bl-col" data-stage="' + esc(stage) + '" aria-labelledby="bl-h-' + esc(stage) + '">' +
      '<header class="bl-col-h"><h2 class="bl-col-t" id="bl-h-' + esc(stage) + '">' +
      mkHtml(STAGE_MARK[stage], stageName, STAGE_TONE[stage]) +
      '<span class="bl-n mono" aria-label="' + esc(t("bl.cardsAria", { n: live.length })) + '">' + live.length + '</span></h2>' +
      '<p class="bl-col-n t-data ink-3">' + esc(t("bl.note." + stage)) + '</p></header>' +
      '<div class="bl-col-b">' + body +
      '<div class="bl-drop t-data" aria-hidden="true">' + esc(t("bl.dropTo", { stage: stageName })) + '</div></div></section>';
  }

  function rank(c) { var i = AREAS.indexOf(c.area); return i < 0 ? AREAS.length : i; }
  function sortCards(list) {
    return list.slice().sort(function (a, b) {
      var aa = a.archived_at ? 1 : 0, ba = b.archived_at ? 1 : 0;
      if (aa !== ba) return aa - ba;
      if (rank(a) !== rank(b)) return rank(a) - rank(b);
      return Number(b.id) - Number(a.id);
    });
  }

  function shown() {
    return sortCards(CARDS.filter(function (c) {
      if (c.archived_at && !showArchived) return false;
      if (areaFilter && c.area !== areaFilter) return false;
      return true;
    }));
  }

  function paint(focusId) {
    if (!board) return;
    var list = shown();
    board.innerHTML = STAGES.map(function (s) {
      return columnHtml(s, list.filter(function (c) { return c.status === s; }));
    }).join("");
    refreshCounts();
    if (focusId != null) {
      var el = cardEl(focusId);
      if (el) el.focus();
    }
  }

  function refreshCounts() {
    var visible = CARDS.filter(function (c) { return !c.archived_at; });
    var head = document.getElementById("bl-header-count");
    if (head) head.textContent = t("bl.header", { total: visible.length, live: visible.filter(function (c) { return c.status === "live"; }).length });
    var filter = document.getElementById("bl-filter");
    if (filter) {
      Array.prototype.forEach.call(filter.querySelectorAll(".tab"), function (tab) {
        var a = tab.dataset.area || "";
        var n = a ? visible.filter(function (c) { return c.area === a; }).length : visible.length;
        var slot = tab.querySelector(".tab-n");
        if (slot) slot.textContent = n;
        var on = a === areaFilter;
        tab.classList.toggle("on", on);
        tab.setAttribute("aria-pressed", on ? "true" : "false");
      });
    }
    var arch = document.getElementById("bl-arch-toggle");
    if (arch) arch.disabled = !CARDS.some(function (c) { return c.archived_at; });
  }

  function byId(id) {
    for (var i = 0; i < CARDS.length; i++) if (String(CARDS[i].id) === String(id)) return CARDS[i];
    return null;
  }
  function cardEl(id) { return board ? board.querySelector('.bl-card[data-id="' + id + '"]') : null; }

  /* Motion in response to input: the card comes to rest from a 4px lift
     once, off a class removed on the next frame. Nothing loops. */
  function settle(el) {
    if (!el) return;
    el.classList.add("is-settle");
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.remove("is-settle"); });
    });
  }

  function postJson(path, body) {
    return fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          return { ok: r.ok && d && d.ok !== false, status: r.status, data: d || {} };
        });
      })
      .catch(function (err) { return { ok: false, status: 0, data: { error: String(err && err.message || err) } }; });
  }
  function errText(r) { return (r.data && (r.data.error || r.data.detail)) || t("bl.err.generic"); }

  function absorb(resp) {
    var kept = CARDS.filter(function (c) { return c.archived_at; });
    var fresh = [];
    (resp.areas || AREAS).forEach(function (a) {
      ((resp.byArea || {})[a] || []).forEach(function (c) { fresh.push(c); });
    });
    var seen = {};
    fresh.forEach(function (c) { seen[c.id] = 1; });
    CARDS = fresh.concat(kept.filter(function (c) { return !seen[c.id]; }));
  }
  function mergeCard(row) {
    if (!row) return;
    for (var i = 0; i < CARDS.length; i++) {
      if (String(CARDS[i].id) === String(row.id)) { CARDS[i] = row; return; }
    }
    CARDS.push(row);
  }

  /* ---- the move, shared by drag, keyboard and the card menu ---- */

  function moveCard(id, status, keepFocus) {
    var c = byId(id);
    if (!c || c.archived_at || c.status === status) return;
    var prev = c.status;
    c.status = status;
    c._pending = true;
    paint(keepFocus ? id : null);
    var moved = cardEl(id);
    if (moved) settle(moved);

    postJson("/api/backlog/" + id, { status: status }).then(function (r) {
      c._pending = false;
      if (!r.ok) {
        c.status = prev;
        paint(keepFocus ? id : null);
        var back = cardEl(id);
        if (back && window.Floor) { window.Floor.flash(back); settle(back); }
        if (window.Floor) window.Floor.toast(t("bl.moveFailed", { err: errText(r) }));
        return;
      }
      if (r.data && r.data.after) mergeCard(r.data.after);
      paint(keepFocus ? id : null);
      var el = cardEl(id);
      if (el && window.Floor) window.Floor.flash(el);
      if (window.Floor) window.Floor.toast(t("bl.toast.movedTo", { stage: t("bl.col." + status) }));
    });
  }

  /* ---- drag: pointer events, because there is no framework and the
     HTML5 drag API cannot draw this feedback. Threshold of 5px so a
     click on the card is still a click. ---- */

  var drag = null;

  function columnAt(x, y) {
    var cols = board.querySelectorAll(".bl-col");
    for (var i = 0; i < cols.length; i++) {
      var r = cols[i].getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return cols[i];
    }
    return null;
  }
  function armColumn(col) {
    var cols = board.querySelectorAll(".bl-col");
    for (var i = 0; i < cols.length; i++) cols[i].classList.toggle("is-over", cols[i] === col);
  }

  function beginDrag(e) {
    var card = drag.card;
    var r = card.getBoundingClientRect();
    drag.active = true;
    drag.rect = r;
    var slot = document.createElement("div");
    slot.className = "bl-slot";
    slot.style.height = r.height + "px";
    card.parentNode.insertBefore(slot, card);
    drag.slot = slot;
    card.style.width = r.width + "px";
    card.style.left = r.left + "px";
    card.style.top = r.top + "px";
    card.classList.add("is-drag");
    board.classList.add("is-dragging");
  }

  function endDrag() {
    if (!drag) return null;
    var card = drag.card;
    if (drag.active) {
      card.classList.remove("is-drag");
      card.style.width = card.style.left = card.style.top = card.style.transform = "";
      if (drag.slot && drag.slot.parentNode) drag.slot.parentNode.removeChild(drag.slot);
      board.classList.remove("is-dragging");
      armColumn(null);
    }
    var d = drag;
    drag = null;
    return d;
  }

  if (board) {
    board.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || drag) return;
      var card = e.target.closest ? e.target.closest(".bl-card") : null;
      if (!card || card.classList.contains("bl-arch")) return;
      if (e.target.closest("a, button, input, select, textarea, .menu")) return;
      drag = { card: card, id: card.dataset.id, from: card.dataset.status, x: e.clientX, y: e.clientY, active: false, pid: e.pointerId };
      try { card.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    });

    board.addEventListener("pointermove", function (e) {
      if (!drag || drag.pid !== e.pointerId) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.active) {
        if (Math.abs(dx) + Math.abs(dy) < 5) return;
        beginDrag(e);
      }
      e.preventDefault();
      drag.card.style.transform = "translate(" + dx + "px," + dy + "px)";
      var col = columnAt(e.clientX, e.clientY);
      drag.over = col;
      armColumn(col);
    });

    var finish = function (e) {
      if (!drag || drag.pid !== e.pointerId) return;
      var over = drag.over, was = drag.active, id = drag.id, from = drag.from;
      var card = drag.card;
      endDrag();
      if (!was) return;
      var stage = over ? over.dataset.stage : null;
      if (stage && stage !== from) moveCard(id, stage, false);
      else settle(card);
    };
    board.addEventListener("pointerup", finish);
    board.addEventListener("pointercancel", finish);

    /* ---- keyboard: the same three moves, without a mouse ---- */

    board.addEventListener("keydown", function (e) {
      var card = e.target.classList && e.target.classList.contains("bl-card") ? e.target : null;
      if (!card) return;
      var id = card.dataset.id;
      var c = byId(id);
      if (!c) return;

      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        if (c.archived_at) return;
        var i = STAGES.indexOf(c.status) + (e.key === "ArrowRight" ? 1 : -1);
        if (i < 0 || i >= STAGES.length) return;
        moveCard(id, STAGES[i], true);
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var col = card.closest(".bl-col");
        if (!col) return;
        var cards = Array.prototype.slice.call(col.querySelectorAll(".bl-card"));
        var at = cards.indexOf(card) + (e.key === "ArrowDown" ? 1 : -1);
        if (cards[at]) cards[at].focus();
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCard(card);
      }
    });

    /* ---- expand in place ---- */

    function toggleCard(card) {
      var id = card.dataset.id;
      var open = !openIds[id];
      if (open) openIds[id] = 1; else delete openIds[id];
      card.classList.toggle("is-open", open);
      var det = card.querySelector(".bl-det");
      if (det) { if (open) det.removeAttribute("inert"); else det.setAttribute("inert", ""); }
      var btn = card.querySelector(".bl-exp");
      if (btn) {
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        btn.textContent = open ? t("bl.detailsHide") : t("bl.details");
      }
    }

    board.addEventListener("click", function (e) {
      var exp = e.target.closest(".bl-exp");
      if (exp) { toggleCard(exp.closest(".bl-card")); return; }
      var add = e.target.closest("[data-add-stage]");
      if (add) { openAdd(add.dataset.addStage); return; }
    });
  }

  /* ---- area filter ---- */

  var filterNav = document.getElementById("bl-filter");
  if (filterNav) {
    filterNav.addEventListener("click", function (e) {
      var tab = e.target.closest(".tab");
      if (!tab) return;
      areaFilter = tab.dataset.area || "";
      paint(null);
    });
  }

  /* ---- archived ---- */

  var archToggle = document.getElementById("bl-arch-toggle");
  if (archToggle) {
    archToggle.addEventListener("click", function () {
      showArchived = !showArchived;
      archToggle.textContent = showArchived ? t("bl.hideArchived") : t("bl.showArchived");
      archToggle.setAttribute("aria-pressed", showArchived ? "true" : "false");
      paint(null);
    });
  }

  /* ---- dialogs ---- */

  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function setVal(id, v) { var el = document.getElementById(id); if (el) el.value = v == null ? "" : v; }
  function normEm(s) { return String(s == null ? "" : s).replace(/\\s*[\\u2014\\u2015]\\s*/g, ", "); }

  function setErr(id, msg) {
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
    if (!err) { err = document.createElement("p"); err.className = "fld-err"; wrap.appendChild(err); }
    err.textContent = msg;
    ctrl.setAttribute("aria-invalid", "true");
  }
  function clearErrs(ids) { ids.forEach(function (id) { setErr(id, null); }); }

  /* The API names the field it refused, so the message lands under that
     field rather than as a banner nobody can act on. */
  function applyServerError(prefix, r) {
    var f = (r.data && r.data.field) || "";
    var raw = (r.data && r.data.error) || "";
    var map = { title: prefix + "-title", area: prefix + "-area", status: prefix + "-status" };
    var id = map[f] || (prefix + "-title");
    var msg = (f === "title" || raw === "title_required") ? t("bl.err.titleRequired") : (raw || t("bl.err.generic"));
    setErr(id, msg);
  }

  var addDlg = document.getElementById("card-add");
  var editDlg = document.getElementById("card-edit");

  function resetAdd(stage) {
    clearErrs(["c-title", "c-gap", "c-metric"]);
    setVal("c-area", areaFilter || "Other");
    ["c-title", "c-gap", "c-metric", "c-owner", "c-link"].forEach(function (id) { setVal(id, ""); });
    setVal("c-status", stage || "idea");
  }
  function openAdd(stage) {
    if (!addDlg) return;
    resetAdd(stage);
    addDlg.showModal();
  }

  var addOpenBtn = document.getElementById("bl-add-open");
  /* floor.js opens the dialog from data-open-dialog on the document
     bubble phase, so this target-phase listener has already reset it. */
  if (addOpenBtn) addOpenBtn.addEventListener("click", function () { resetAdd("idea"); });

  var addForm = addDlg ? addDlg.querySelector("form") : null;
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      if (!e.submitter || e.submitter.value !== "confirm") return;
      e.preventDefault();
      var area = val("c-area"), title = val("c-title"), gap = val("c-gap"), metric = val("c-metric");
      clearErrs(["c-title", "c-gap", "c-metric"]);
      var ok = true;
      if (!title) { setErr("c-title", t("bl.err.titleRequired")); ok = false; }
      if (!gap) { setErr("c-gap", t("bl.err.gapRequired")); ok = false; }
      if (!metric) { setErr("c-metric", t("bl.err.metricRequired")); ok = false; }
      if (!ok) return;
      postJson("/api/backlog", {
        area: area, title: title, gap: gap, metric: metric,
        owner: val("c-owner"), link: val("c-link"), status: val("c-status")
      }).then(function (r) {
        if (!r.ok) { applyServerError("c", r); return; }
        absorb(r.data);
        addDlg.close();
        paint(null);
        if (window.Floor) window.Floor.toast(t("bl.toast.added", { area: area }));
      });
    });
  }

  function openEdit(id) {
    var c = byId(id);
    if (!c || !editDlg) return;
    editingId = id;
    clearErrs(["e-title", "e-gap", "e-metric"]);
    setVal("e-area", c.area);
    setVal("e-title", normEm(c.title));
    setVal("e-gap", normEm(c.gap));
    setVal("e-metric", normEm(c.metric));
    setVal("e-owner", normEm(c.owner));
    setVal("e-link", c.link || "");
    editDlg.showModal();
  }

  var editForm = editDlg ? editDlg.querySelector("form") : null;
  if (editForm) {
    editForm.addEventListener("submit", function (e) {
      if (!e.submitter || e.submitter.value !== "confirm") return;
      e.preventDefault();
      if (editingId == null) return;
      var title = val("e-title"), gap = val("e-gap"), metric = val("e-metric");
      clearErrs(["e-title", "e-gap", "e-metric"]);
      var ok = true;
      if (!title) { setErr("e-title", t("bl.err.titleRequired")); ok = false; }
      if (!gap) { setErr("e-gap", t("bl.err.gapRequired")); ok = false; }
      if (!metric) { setErr("e-metric", t("bl.err.metricRequired")); ok = false; }
      if (!ok) return;
      var id = editingId;
      postJson("/api/backlog/" + id, {
        area: val("e-area"), title: title, gap: gap, metric: metric,
        owner: val("e-owner"), link: val("e-link")
      }).then(function (r) {
        if (!r.ok) { applyServerError("e", r); return; }
        mergeCard(r.data.after);
        editDlg.close();
        editingId = null;
        paint(null);
        var el = cardEl(id);
        if (el && window.Floor) window.Floor.flash(el);
        if (window.Floor) window.Floor.toast(t("bl.toast.updated"));
      });
    });
  }

  /* ---- archive and restore, soft both ways ---- */

  function setArchived(id, on) {
    postJson("/api/backlog/" + id + "/archive", { on: on }).then(function (r) {
      if (!r.ok) {
        if (window.Floor) window.Floor.toast(t("common.notSaved", { err: errText(r) }));
        return;
      }
      mergeCard(r.data.card);
      paint(null);
      var el = cardEl(id);
      if (el && window.Floor) window.Floor.flash(el);
      if (window.Floor) {
        window.Floor.toast(t(on ? "bl.toast.archived" : "bl.toast.restored"), {
          undo: function () { setArchived(id, !on); }
        });
      }
    });
  }

  /* ---- menu actions. floor.js closes the menu synchronously after it
     dispatches, so the repaint waits a tick rather than pulling the
     menu's own DOM out from under it. ---- */

  document.addEventListener("floor:action", function (e) {
    var d = e.detail || {};
    var action = d.action || "";
    var id = d.id;
    if (id == null || !action) return;
    setTimeout(function () {
      if (action === "edit") return openEdit(id);
      if (action.indexOf("move:") === 0) return moveCard(id, action.slice(5), false);
      if (action === "destroy:archive") return setArchived(id, true);
      if (action === "restore:archive") return setArchived(id, false);
    }, 0);
  });
})();`;
}
