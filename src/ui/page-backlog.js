/* Floor · page-backlog.js, the Backlog page (route /backlog)
   ---------------------------------------------------------------------
   The GTM Engineering backlog: what would get built next, by area, and
   what gap each item closes. Per DESIGN-SPEC §4.9 this is the one page
   where a card is allowed (discrete work items are genuinely discrete
   objects), so the card is defined once, here, and scoped to this page.

   Data: render() receives GET /api/backlog synchronously as `data`:
   { areas[5], byArea{...}, total, live }. listBacklog() in src/index.js
   does not exclude archived rows from that total/live count, so this
   page computes its own visible total/live by filtering archived_at
   itself rather than trusting the server's aggregate fields — see the
   comment at computeCounts() below.

   Completeness gaps closed here (previously true of the legacy page):
   a card could not move between statuses, could not be edited, and
   could not be removed. All three are now first-class: status change
   and archive live directly in the row menu (never buried in the edit
   dialog), edit is a dialog, archive is soft and undoable via toast.
   A "Show archived" toggle keeps the undo doctrine honest past the
   8-second toast window (§5.4: no action may remove its own reversal
   from the interface).
   --------------------------------------------------------------------- */

import { esc, mark, field, dialog } from "./kit.js";

export const meta = { route: "/backlog", nav: "/backlog", titleKey: "nav.backlog" };

const STATUSES = ["idea", "building", "live"];
const STATUS_MARK = { idea: "hollow", building: "half", live: "filled" };
const STATUS_TONE = { idea: "mute", building: "ink", live: "ok" };

/* ============================== copy ================================ */
/* bl.gap, bl.moves, bl.unassigned, bl.st.*, bl.dlgTitle, bl.addCard,
   bl.phTitle/phGap/phMetric/phOwner and nav.backlog already exist in
   i18n.js and are reused as-is, per the contract's "reuse an existing
   key" rule. Everything below is genuinely new to this page. */

export const keys = {
  "bl.header": {
    en: "{total} cards · {live} live",
    es: "{total} tarjetas · {live} en producción",
  },
  "bl.showArchived": { en: "Show archived", es: "Mostrar archivadas" },
  "bl.hideArchived": { en: "Hide archived", es: "Ocultar archivadas" },
  "bl.emptyArea": {
    en: "No cards in {area} yet. Add one.",
    es: "Todavía no hay tarjetas en {area}. Agrega una.",
  },
  "bl.archivedWord": { en: "archived", es: "archivada" },

  "bl.action.to.idea":     { en: "Move to idea", es: "Mover a idea" },
  "bl.action.to.building": { en: "Move to building", es: "Pasar a en construcción" },
  "bl.action.to.live":     { en: "Move to live", es: "Marcar como en producción" },
  "bl.action.edit":    { en: "Edit", es: "Editar" },
  "bl.action.archive": { en: "Archive", es: "Archivar" },
  "bl.action.restore": { en: "Restore", es: "Restaurar" },

  "bl.f.area":     { en: "Area", es: "Área" },
  "bl.f.title":    { en: "Title", es: "Título" },
  "bl.f.gap":      { en: "Gap it closes", es: "Brecha que cierra" },
  "bl.f.metric":   { en: "Metric it moves", es: "Métrica que mueve" },
  "bl.f.owner":    { en: "Owner", es: "Responsable" },
  "bl.f.link":     { en: "Link", es: "Enlace" },
  "bl.f.linkHint": { en: "Where to see it or track it", es: "Dónde verlo o seguirlo" },
  "bl.f.status":   { en: "Status", es: "Estado" },
  "bl.editTitle":  { en: "Edit card", es: "Editar tarjeta" },

  "bl.err.titleRequired":  { en: "A card needs a title.", es: "Una tarjeta necesita un título." },
  "bl.err.gapRequired":    { en: "Say which gap this closes.", es: "Indica qué brecha cierra." },
  "bl.err.metricRequired": { en: "Say which metric it moves.", es: "Indica qué métrica mueve." },

  "bl.toast.added":    { en: "Card added to {area}.", es: "Tarjeta agregada a {area}." },
  "bl.toast.updated":  { en: "Card updated.", es: "Tarjeta actualizada." },
  "bl.toast.moved":    { en: "Status changed to {status}.", es: "Estado cambiado a {status}." },
  "bl.toast.archived": { en: "Card archived.", es: "Tarjeta archivada." },
  "bl.toast.restored": { en: "Card restored.", es: "Tarjeta restaurada." },
  "bl.loadFail":       { en: "Could not refresh the backlog.", es: "No se pudo actualizar el backlog." },
};

/* ============================ SSR pieces ============================= */

/** listBacklog() counts every row including archived ones, so the page
 *  recomputes what an operator should actually see: visible cards only. */
function computeCounts(data) {
  let total = 0, live = 0;
  for (const area of data.areas) {
    for (const c of data.byArea[area] || []) {
      if (c.archived_at) continue;
      total++;
      if (c.status === "live") live++;
    }
  }
  return { total, live };
}

function cardMenuItems(c, t) {
  if (c.archived_at) return [{ label: t("bl.action.restore"), action: "restore:archive" }];
  const items = [];
  for (const s of STATUSES) if (s !== c.status) items.push({ label: t(`bl.action.to.${s}`), action: `move:${s}` });
  items.push("-");
  items.push({ label: t("bl.action.edit"), action: "edit" });
  items.push("-");
  items.push({ label: t("bl.action.archive"), action: "destroy:archive", danger: true });
  return items;
}

const DOTS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>`;

/** kit.js has no exported menu-button primitive for pages that are not
 *  built on table(); this composes one from the exported rowMenu()
 *  contents plus the already-shared .menu-host/.btn-icon classes. See
 *  the report for why this is a candidate for a small kit.js addition. */
function cardMenu(items, t) {
  const rows = items.map((it) => {
    if (it === "-") return `<div class="menu-sep" role="separator"></div>`;
    const danger = it.danger ? " danger" : "";
    return `<button type="button" class="menu-item${danger}" role="menuitem" data-action="${esc(it.action || "")}"${it.danger ? ` data-danger="1"` : ""}>${esc(it.label)}</button>`;
  }).join("");
  return `<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t("kit.menu.aria"))}">${DOTS_SVG}</button><div class="menu" role="menu" hidden>${rows}</div></div>`;
}

function cardHtml(c, t) {
  const archived = !!c.archived_at;
  const menu = cardMenu(cardMenuItems(c, t), t);
  const stateMark = archived
    ? mark("hatch", t("bl.archivedWord"), { tone: "held" })
    : mark(STATUS_MARK[c.status], t(`bl.st.${c.status}`), { tone: STATUS_TONE[c.status] });
  const external = c.link && /^https?:\/\//i.test(c.link);
  const titleHtml = c.link
    ? `<a href="${esc(c.link)}"${external ? ` target="_blank" rel="noopener"` : ""}>${esc(c.title)}</a>`
    : esc(c.title);
  return `<article class="bl-card st-${esc(c.status)}${archived ? " bl-arch" : ""}" data-id="${esc(c.id)}" data-status="${esc(c.status)}">
    <div class="bl-card-h">${stateMark}${menu}</div>
    <h4 class="t-section bl-card-t">${titleHtml}</h4>
    ${c.gap ? `<p class="t-body bl-card-l"><b>${esc(t("bl.gap"))}</b> ${esc(c.gap)}</p>` : ""}
    ${c.metric ? `<p class="t-body bl-card-l"><b>${esc(t("bl.moves"))}</b> ${esc(c.metric)}</p>` : ""}
    <div class="bl-card-f t-data ink-3">${esc(c.owner || t("bl.unassigned"))}</div>
  </article>`;
}

function zoneHtml(area, cards, t) {
  const visible = cards.filter((c) => !c.archived_at);
  const body = visible.length
    ? `<div class="bl-cards">${visible.map((c) => cardHtml(c, t)).join("")}</div>`
    : `<div class="well well-dashed bl-empty">${esc(t("bl.emptyArea", { area }))}</div>`;
  return `<div class="bl-zone${visible.length ? "" : " bl-zone-empty"}" data-area="${esc(area)}">
    <h3 class="t-label bl-zone-h">${esc(area)} <span class="bl-zone-n mono">${visible.length}</span></h3>
    ${body}
  </div>`;
}

function addDialogHtml(t, areas) {
  const body = `
    ${field({ id: "c-area", label: t("bl.f.area"), value: "Other", options: areas })}
    ${field({ id: "c-title", label: t("bl.f.title"), placeholder: t("bl.phTitle") })}
    ${field({ id: "c-gap", label: t("bl.f.gap"), type: "textarea", rows: 2, placeholder: t("bl.phGap") })}
    ${field({ id: "c-metric", label: t("bl.f.metric"), type: "textarea", rows: 2, placeholder: t("bl.phMetric") })}
    ${field({ id: "c-owner", label: t("bl.f.owner"), placeholder: t("bl.phOwner") })}
    ${field({ id: "c-link", label: t("bl.f.link"), hint: t("bl.f.linkHint") })}
    ${field({ id: "c-status", label: t("bl.f.status"), value: "idea", options: STATUSES.map((s) => ({ value: s, label: t(`bl.st.${s}`) })) })}
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
  const { total, live } = computeCounts(data);
  const zones = data.areas.map((a) => zoneHtml(a, data.byArea[a] || [], t)).join("");

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.backlog"))}</h1>
        <span class="whead-meta" id="bl-header-count">${esc(t("bl.header", { total, live }))}</span>
      </div>
      <div class="whead-a">
        <button type="button" class="btn btn-quiet btn-sm" id="bl-arch-toggle" aria-pressed="false">${esc(t("bl.showArchived"))}</button>
        <button type="button" class="btn btn-primary" id="bl-add-open" data-open-dialog="card-add">${esc(t("bl.newCard"))}</button>
      </div>
    </div>

    <div id="bl-board" class="bl-board">${zones}</div>

    ${addDialogHtml(t, data.areas)}
    ${editDialogHtml(t, data.areas)}
  `;
}

/* =============================== css ================================== */

export function css() {
  return `
.p-backlog .bl-board {
  margin-top: 32px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 24px;
  align-items: start;
}
.p-backlog .bl-zone { min-width: 0; }
.p-backlog .bl-zone-empty { grid-column: 1 / -1; }

.p-backlog .bl-zone-h { display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; }
.p-backlog .bl-zone-n { color: var(--ink-4); }

.p-backlog .bl-cards { display: flex; flex-direction: column; gap: 12px; }
.p-backlog .bl-empty { margin: 0; }

.p-backlog .bl-card {
  position: relative;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 14px 16px;
  background: var(--paper);
}
.p-backlog .bl-card.st-idea     { box-shadow: inset 2px 0 0 var(--ink-4); }
.p-backlog .bl-card.st-building { box-shadow: inset 2px 0 0 var(--accent); }
.p-backlog .bl-card.st-live     { box-shadow: inset 2px 0 0 var(--ok); }
.p-backlog .bl-card.bl-arch     { box-shadow: inset 2px 0 0 var(--held); opacity: .6; }

.p-backlog .bl-card-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.p-backlog .bl-card-t { margin-top: 10px; line-height: 1.35; }
.p-backlog .bl-card-l { margin-top: 8px; color: var(--ink-2); }
.p-backlog .bl-card-l b { font-weight: 600; color: var(--ink-1); }
.p-backlog .bl-card-f { margin-top: 12px; }
`;
}

/* =============================== script ================================ */

export function script() {
  return `(() => {
  "use strict";

  var CARDS = {};
  var showArchived = false;
  var editingId = null;

  /* ---- hand-built equivalents of kit.js primitives. A plain inline
     <script> cannot import an ES module, and this page repaints its
     board after every mutation, so its markup is built here to match
     kit.js's classes exactly (same convention as page-sources.js). ---- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }
  var MARK_SVG = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    half: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/></svg>',
    hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
    hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>',
  };
  function mkHtml(kind, label, tone) {
    var cls = "mk tone-" + tone;
    return '<span class="' + cls + '">' + (MARK_SVG[kind] || "") + '<span class="mk-w">' + esc(label) + "</span></span>";
  }
  var DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';
  var STATUS_MARK = { idea: "hollow", building: "half", live: "filled" };
  var STATUS_TONE = { idea: "mute", building: "ink", live: "ok" };

  function menuHtml(items) {
    var rows = items.map(function (it) {
      if (it === "-") return '<div class="menu-sep" role="separator"></div>';
      var danger = it.danger ? " danger" : "";
      return '<button type="button" class="menu-item' + danger + '" role="menuitem" data-action="' + esc(it.action || "") + '"' + (it.danger ? ' data-danger="1"' : "") + '>' + esc(it.label) + "</button>";
    }).join("");
    return '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(Floor.t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + "</div></div>";
  }

  function cardMenuItems(c) {
    if (c.archived_at) return [{ label: Floor.t("bl.action.restore"), action: "restore:archive" }];
    var items = [];
    ["idea", "building", "live"].forEach(function (s) {
      if (s !== c.status) items.push({ label: Floor.t("bl.action.to." + s), action: "move:" + s });
    });
    items.push("-");
    items.push({ label: Floor.t("bl.action.edit"), action: "edit" });
    items.push("-");
    items.push({ label: Floor.t("bl.action.archive"), action: "destroy:archive", danger: true });
    return items;
  }

  function cardHtml(c) {
    var archived = !!c.archived_at;
    var stateMark = archived
      ? mkHtml("hatch", Floor.t("bl.archivedWord"), "held")
      : mkHtml(STATUS_MARK[c.status], Floor.t("bl.st." + c.status), STATUS_TONE[c.status]);
    var external = c.link && /^https?:\\/\\//i.test(c.link);
    var titleHtml = c.link
      ? '<a href="' + esc(c.link) + '"' + (external ? ' target="_blank" rel="noopener"' : "") + '>' + esc(c.title) + "</a>"
      : esc(c.title);
    var artCls = "bl-card st-" + c.status + (archived ? " bl-arch" : "");
    var out = '<article class="' + esc(artCls) + '" data-id="' + esc(c.id) + '" data-status="' + esc(c.status) + '">';
    out += '<div class="bl-card-h">' + stateMark + menuHtml(cardMenuItems(c)) + "</div>";
    out += '<h4 class="t-section bl-card-t">' + titleHtml + "</h4>";
    if (c.gap) out += '<p class="t-body bl-card-l"><b>' + esc(Floor.t("bl.gap")) + "</b> " + esc(c.gap) + "</p>";
    if (c.metric) out += '<p class="t-body bl-card-l"><b>' + esc(Floor.t("bl.moves")) + "</b> " + esc(c.metric) + "</p>";
    out += '<div class="bl-card-f t-data ink-3">' + esc(c.owner || Floor.t("bl.unassigned")) + "</div>";
    out += "</article>";
    return out;
  }

  function zoneHtml(area, cards) {
    var body = cards.length
      ? '<div class="bl-cards">' + cards.map(cardHtml).join("") + "</div>"
      : '<div class="well well-dashed bl-empty">' + esc(Floor.t("bl.emptyArea", { area: area })) + "</div>";
    var zoneCls = "bl-zone" + (cards.length ? "" : " bl-zone-empty");
    return '<div class="' + esc(zoneCls) + '" data-area="' + esc(area) + '"><h3 class="t-label bl-zone-h">' + esc(area) + ' <span class="bl-zone-n mono">' + cards.length + "</span></h3>" + body + "</div>";
  }

  function indexCards(d) {
    var map = {};
    d.areas.forEach(function (a) { (d.byArea[a] || []).forEach(function (c) { map[c.id] = c; }); });
    return map;
  }

  function paintBoard(d) {
    CARDS = indexCards(d);
    var total = 0, live = 0;
    var zonesHtml = d.areas.map(function (a) {
      var all = d.byArea[a] || [];
      all.forEach(function (c) { if (!c.archived_at) { total++; if (c.status === "live") live++; } });
      var cards = all.filter(function (c) { return showArchived || !c.archived_at; });
      return zoneHtml(a, cards);
    }).join("");
    Floor.replace("#bl-board", '<div id="bl-board" class="bl-board">' + zonesHtml + "</div>");
    var headerEl = document.getElementById("bl-header-count");
    if (headerEl) headerEl.textContent = Floor.t("bl.header", { total: total, live: live });
  }

  function fetchBoard() {
    return fetch("/api/backlog").then(function (r) { return r.json(); }).then(function (d) {
      CARDS = indexCards(d);
      return d;
    });
  }

  function refresh() {
    return fetchBoard().then(paintBoard).catch(function () { Floor.toast(Floor.t("bl.loadFail")); });
  }

  /* silent hydrate on load: seeds CARDS for the edit dialog without
     repainting a board that server-rendered correctly already */
  fetchBoard().catch(function () {});

  /* ---- field errors, plain DOM, matches .fld / .fld-err from floor.css ---- */

  function val(id) {
    var el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }
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

  function friendlyErr(msg) {
    if (msg === "title_required") return Floor.t("bl.err.titleRequired");
    return msg || Floor.t("bl.loadFail");
  }

  /* ---- show archived toggle ---- */

  var archToggle = document.getElementById("bl-arch-toggle");
  if (archToggle) {
    archToggle.addEventListener("click", function () {
      showArchived = !showArchived;
      archToggle.textContent = showArchived ? Floor.t("bl.hideArchived") : Floor.t("bl.showArchived");
      archToggle.setAttribute("aria-pressed", String(showArchived));
      refresh();
    });
  }

  /* ---- add dialog ---- */

  var addOpenBtn = document.getElementById("bl-add-open");
  if (addOpenBtn) {
    addOpenBtn.addEventListener("click", function () {
      clearErrs(["c-title", "c-gap", "c-metric"]);
      var areaEl = document.getElementById("c-area");
      if (areaEl) areaEl.value = "Other";
      ["c-title", "c-gap", "c-metric", "c-owner", "c-link"].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = "";
      });
      var statusEl = document.getElementById("c-status");
      if (statusEl) statusEl.value = "idea";
    });
  }

  var addDlg = document.getElementById("card-add");
  var addForm = addDlg ? addDlg.querySelector("form") : null;
  if (addForm) {
    addForm.addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (!submitter || submitter.value !== "confirm") return;
      e.preventDefault();
      var area = val("c-area"), title = val("c-title"), gap = val("c-gap"), metric = val("c-metric"),
          owner = val("c-owner"), link = val("c-link"), status = val("c-status");
      clearErrs(["c-title", "c-gap", "c-metric"]);
      var ok = true;
      if (!title) { setErr("c-title", Floor.t("bl.err.titleRequired")); ok = false; }
      if (!gap) { setErr("c-gap", Floor.t("bl.err.gapRequired")); ok = false; }
      if (!metric) { setErr("c-metric", Floor.t("bl.err.metricRequired")); ok = false; }
      if (!ok) return;
      Floor.post("/api/backlog", { area: area, title: title, gap: gap, metric: metric, owner: owner, link: link, status: status })
        .then(function () {
          addDlg.close();
          Floor.toast(Floor.t("bl.toast.added", { area: area }));
          refresh();
        })
        .catch(function (err) { setErr("c-title", friendlyErr(err && err.message)); });
    });
  }

  /* ---- edit dialog (single shared instance, populated on open) ---- */

  var editDlg = document.getElementById("card-edit");
  var editForm = editDlg ? editDlg.querySelector("form") : null;

  /* Em dashes never reach the screen (product-wide rule). esc() also
     HTML-escapes, which is wrong for a DOM .value assignment (it is not
     HTML), so this does the dash-to-comma normalisation only. */
  function normEm(s) {
    return String(s == null ? "" : s).replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ");
  }

  function openEdit(id) {
    var c = CARDS[id];
    if (!c || !editDlg) return;
    editingId = id;
    clearErrs(["e-title", "e-gap", "e-metric"]);
    document.getElementById("e-area").value = c.area;
    document.getElementById("e-title").value = normEm(c.title);
    document.getElementById("e-gap").value = normEm(c.gap);
    document.getElementById("e-metric").value = normEm(c.metric);
    document.getElementById("e-owner").value = normEm(c.owner);
    document.getElementById("e-link").value = c.link || "";
    editDlg.showModal();
  }

  if (editForm) {
    editForm.addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (!submitter || submitter.value !== "confirm") return;
      e.preventDefault();
      if (editingId == null) return;
      var area = val("e-area"), title = val("e-title"), gap = val("e-gap"), metric = val("e-metric"),
          owner = val("e-owner"), link = val("e-link");
      clearErrs(["e-title", "e-gap", "e-metric"]);
      var ok = true;
      if (!title) { setErr("e-title", Floor.t("bl.err.titleRequired")); ok = false; }
      if (!gap) { setErr("e-gap", Floor.t("bl.err.gapRequired")); ok = false; }
      if (!metric) { setErr("e-metric", Floor.t("bl.err.metricRequired")); ok = false; }
      if (!ok) return;
      var id = editingId;
      Floor.post("/api/backlog/" + id, { area: area, title: title, gap: gap, metric: metric, owner: owner, link: link })
        .then(function () {
          editDlg.close();
          editingId = null;
          Floor.toast(Floor.t("bl.toast.updated"));
          refresh();
        })
        .catch(function (err) { setErr("e-title", friendlyErr(err && err.message)); });
    });
  }

  /* ---- row-menu actions, dispatched by floor.js as floor:action ---- */

  document.addEventListener("floor:action", function (e) {
    var detail = e.detail || {};
    var action = detail.action || "";
    var id = detail.id != null ? Number(detail.id) : null;
    if (id == null) return;

    if (action === "edit") { openEdit(id); return; }

    if (action.indexOf("move:") === 0) {
      var status = action.slice(5);
      Floor.post("/api/backlog/" + id, { status: status })
        .then(function () {
          Floor.toast(Floor.t("bl.toast.moved", { status: Floor.t("bl.st." + status) }));
          refresh();
        })
        .catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "destroy:archive") {
      Floor.post("/api/backlog/" + id + "/archive", { on: true })
        .then(function () {
          Floor.toast(Floor.t("bl.toast.archived"), {
            undo: function () { Floor.post("/api/backlog/" + id + "/archive", { on: false }).then(refresh); },
          });
          refresh();
        })
        .catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "restore:archive") {
      Floor.post("/api/backlog/" + id + "/archive", { on: false })
        .then(function () {
          Floor.toast(Floor.t("bl.toast.restored"));
          refresh();
        })
        .catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }
  });
})();`;
}
