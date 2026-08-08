/* Floor · kit.js — the shared primitives (foundation author only)
   ---------------------------------------------------------------------
   Every primitive named in src/ui/CONTRACT.md, and nothing else. Pages
   import from here and never restyle; if a primitive reads wrong, the
   fix happens here once.

   Conventions a page author must know:
   - Everything user-visible goes through esc(). It also normalises em
     dashes to commas (hard product rule; stored model text carries them).
   - `body`, `actions`, `sub`, table `cells` and dialog `body` are raw
     HTML: the caller escapes the data inside them. `label` and `title`
     params are plain text and escaped here.
   - Primitives that render copy of their own (table, dialog, gauge,
     shell) take `t`. Never call them without it in product code; the
     English fallback exists so a harness cannot crash, not as a licence.
   - State marks: a state is a mark plus a word. mark() throws without a
     label, deliberately, so a colour-only state cannot ship.
   - Actions: interactive primitives carry data-action; /static/floor.js
     dispatches them as "floor:action" / "floor:bulk" CustomEvents. Name
     destructive actions "destroy:*" and their inverses "restore:*"; the
     QA gate audits the pairing (§5.4).
   --------------------------------------------------------------------- */

import { formatCount } from "../lib/scoring.js";
import { COPY, DEFAULT_LANG, t as makeT } from "../lib/i18n.js";

/* ========================= escape + format ========================= */

export const esc = (s) => String(s ?? "")
  .replace(/\s*[\u2014\u2015]\s*/g, ", ")
  .replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const num = (n) => (n == null || isNaN(Number(n)) ? "" : Number(n).toLocaleString("en-US"));
export const count = formatCount;
export const money = (n, dp = 2) => `$${Number(n || 0).toFixed(dp)}`;
export const pct = (n) => `${Math.round((n || 0) * 100)}%`;

/** Safe printable date. Full dates come back YYYY-MM-DD; the partial
 *  forms that exist in production signals (2022, 2025-03, 2025-Q4) pass
 *  through untouched rather than being erased; garbage becomes "". */
export const dateISO = (s) => {
  if (s == null || s === "") return "";
  const v = String(s).trim();
  const full = v.match(/^\d{4}-\d{2}-\d{2}/);
  if (full) return full[0];
  if (/^\d{4}(-\d{2}|-Q[1-4])?$/i.test(v)) return v;
  const d = new Date(v);
  return isNaN(d) ? "" : d.toISOString().slice(0, 10);
};

export const host = (u) => {
  try { return new URL(u).host.replace(/^www\./, ""); } catch { return String(u ?? ""); }
};

const T_OF = (t) => t || makeT(DEFAULT_LANG);

/* ============================== marks ============================== */
/* §3.7. The closed set. 10px geometry drawn with currentColor; the
   tone class colours mark and word together. */

const MARK_SVG = {
  filled: `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>`,
  half: `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/></svg>`,
  hollow: `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>`,
  hatch: `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>`,
  dashed: `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.7"/></svg>`,
};
const TONES = new Set(["ok", "warn", "bad", "held", "ink", "mute", "ghost"]);

/** The ONLY way to render state. A bare mark with no word is a colour-only
 *  state, which this product bans, so the missing label throws. */
export function mark(kind, label, { tone = "ink", n, of } = {}) {
  if (!label) throw new Error(`kit.mark("${kind}") called without a label; a state is a mark plus a word`);
  const tn = TONES.has(tone) ? tone : "ink";
  const svg = kind === "level" ? levelSvg(n ?? 0, of ?? 3) : MARK_SVG[kind];
  if (!svg) throw new Error(`kit.mark: unknown kind "${kind}"`);
  return `<span class="mk tone-${tn}">${svg}<span class="mk-w">${esc(label)}</span></span>`;
}

function levelSvg(n, of) {
  const W = 3, GAP = 2, H = 10;
  const width = of * W + (of - 1) * GAP;
  const bars = Array.from({ length: of }, (_, i) => {
    const x = i * (W + GAP);
    return i < n
      ? `<rect x="${x}" y="0" width="${W}" height="${H}" rx="1" fill="currentColor"/>`
      : `<rect x="${x + 0.5}" y="0.5" width="${W - 1}" height="${H - 1}" rx="1" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"/>`;
  }).join("");
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" aria-hidden="true">${bars}</svg>`;
}

/** The bar-pair graded mark: n of `of` bars filled, plus the word. */
export function level(n, of = 3, label, { tone = "ink" } = {}) {
  return mark("level", label, { tone, n, of });
}

/* ========================== the floor gauge ======================== */
/* Log track, 10k to 1B. Six decades, fixed scale everywhere so every
   gauge in the product is comparable. Values above 1B keep their clamp
   visible: a right-edge double chevron says "beyond scale" out loud
   instead of quietly crushing the bar (the DoorDash bug). */

const G_LO = 4, G_HI = 9;
const gpos = (v) => {
  const c = Math.max(10 ** G_LO, Math.min(10 ** G_HI, Number(v) || 10 ** G_LO));
  return ((Math.log10(c) - G_LO) / (G_HI - G_LO)) * 100;
};
const OVER_SVG = `<svg width="9" height="10" viewBox="0 0 9 10" aria-hidden="true"><path d="M1 1l3.2 4L1 9M4.6 1l3.2 4-3.2 4" stroke="currentColor" stroke-width="1.4" fill="none"/></svg>`;

export function gauge({ min, mid, max, floor, verdict, confidence, abstained } = {}, t, { size = "row" } = {}) {
  const T = T_OF(t);
  const hero = size === "hero";
  const scaleRow = hero
    ? `<div class="g-scale">${[4, 5, 6, 7, 8, 9].map((d) => `<span>${esc(count(10 ** d))}</span>`).join("")}</div>`
    : "";

  if (abstained) {
    const g = `<span class="gauge g-abstain${hero ? " g-hero" : ""} tone-held" role="img" aria-label="${esc(T("kit.gauge.abstainAria"))}"><span class="g-slot"></span></span>`;
    return hero ? `<div class="g-wrap">${g}${scaleRow}</div>` : g;
  }

  const fl = gpos(floor);
  const a = gpos(min ?? mid), b = gpos(max ?? mid), m = gpos(mid);
  const left = Math.min(a, b);
  const width = Math.max(Math.abs(b - a), 1.2);
  const beyond = Number(max ?? mid) > 10 ** G_HI;

  const conf = confidence == null ? null : Number(confidence);
  const confCls = conf == null || conf >= 0.75 ? "" : conf >= 0.5 ? " g-c-soft" : " g-c-hollow";

  let aria = T("kit.gauge.aria", {
    mid: count(mid), min: count(min ?? mid), max: count(max ?? mid), floor: count(floor),
  });
  if (conf != null) aria += `, ${T("meter.title", { pct: pct(conf) })}`;
  if (beyond) aria += `, ${T("kit.gauge.beyond")}`;

  const flag = hero
    ? `<span class="g-flag t-label">${esc(T("kit.gauge.floor", { floor: count(floor) }))}</span>`
    : "";
  const over = beyond
    ? `<span class="g-over" title="${esc(T("kit.gauge.beyond"))}">${OVER_SVG}</span>`
    : "";

  const g = `<span class="gauge${hero ? " g-hero" : ""} g-v-${esc(verdict || "unknown")}${confCls}" role="img" aria-label="${esc(aria)}">
    <span class="g-trk"></span>
    <span class="g-fl" style="left:${fl.toFixed(1)}%">${flag}</span>
    <span class="g-bar" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span>
    <span class="g-mid" style="left:${m.toFixed(1)}%"></span>
    ${over}
  </span>`;
  return hero ? `<div class="g-wrap">${g}${scaleRow}</div>` : g;
}

/* ===================== §3.6 · the stat / meter row ================== */
/* Replaces the stat card. An absent figure prints a ghost en dash and
   the note says why, in words. */

export function statRow(items = []) {
  const cells = items.map(({ label, value, note, mono = true }) => {
    const empty = value == null || value === "";
    const v = empty
      ? `<span class="stat-v none">–</span>`
      : `<span class="stat-v${mono ? "" : " word"}">${value}</span>`;
    return `<div class="stat">
      <span class="stat-l t-label">${esc(label)}</span>
      ${v}
      ${note ? `<span class="stat-n">${esc(note)}</span>` : ""}
    </div>`;
  }).join("");
  return `<div class="statrow">${cells}</div>`;
}

/* ===================== §3.5 · the three containers ================== */

/** C0, the default: eyebrow, optional head, hairline, content on paper.
 *  `sub` and `actions` and `body` are raw HTML; `label`/`title` are text. */
export function section({ label, title, sub, actions, body } = {}) {
  const head = (label || title || actions) ? `<header class="c0-h">
    <div>
      ${label ? `<span class="c0-l t-label">${esc(label)}</span>` : ""}
      ${title ? `<h2 class="c0-title t-section">${esc(title)}${sub ? ` <span class="c0-sub">${sub}</span>` : ""}</h2>` : ""}
    </div>
    ${actions ? `<div class="c0-a">${actions}</div>` : ""}
  </header>` : "";
  return `<section class="c0">${head}<div class="c0-b">${body || ""}</div></section>`;
}

/** C1, the recessed well. tone: "" | "dashed" (deliberate absence) |
 *  "held" (abstain / operator-must-supply). A well never nests. */
export function well(bodyHtml, { tone = "" } = {}) {
  const cls = tone === "dashed" ? "well well-dashed" : tone === "held" ? "well well-held" : "well";
  return `<div class="${cls}">${bodyHtml || ""}</div>`;
}

/* ======================== tables and rows ========================== */

const DOTS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>`;

/** The C2 row-menu contents. Items: { label, action, danger, href } or
 *  the string "-" for a separator. Destructive items (danger) get the
 *  in-menu confirm swap from /static/floor.js automatically. */
export function rowMenu(items = []) {
  const rows = items.map((it) => {
    if (it === "-") return `<div class="menu-sep" role="separator"></div>`;
    const danger = it.danger ? " danger" : "";
    if (it.href) return `<a class="menu-item${danger}" role="menuitem" href="${esc(it.href)}">${esc(it.label)}</a>`;
    return `<button type="button" class="menu-item${danger}" role="menuitem" data-action="${esc(it.action || "")}"${it.danger ? ` data-danger="1"` : ""}>${esc(it.label)}</button>`;
  }).join("");
  return `<div class="menu" role="menu" hidden>${rows}</div>`;
}

const menuHost = (items, T) =>
  `<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(T("kit.menu.aria"))}">${DOTS_SVG}</button>${rowMenu(items)}</div>`;

/**
 * The list primitive. cols: [{ key, label, align, width, mono }].
 * rows: [{ id, href, cells: [...], accent, menu: [...], dim, inset }].
 *  - `accent` ("ok"|"warn"|"bad"|"held") draws the 2px left verdict rule.
 *  - `menu` renders the fixed ⋯ button, always visible, last column.
 *  - `href` makes the row navigable (click + Enter), wired in floor.js.
 *  - `inset` is a raw-HTML expansion row rendered hidden under the row;
 *    pages toggle it (hidden attr) however they choose.
 *  - `empty` (raw HTML or text) renders the §3.10 dashed empty zone.
 *  - opts.size: "dense" (36px) | "tall" (56px) | default 44px rows.
 */
export function table({ cols = [], rows = [], selectable, empty, size } = {}, t) {
  const T = T_OF(t);
  const hasMenu = rows.some((r) => r.menu && r.menu.length);
  const ruled = rows.some((r) => r.accent);
  const nCols = cols.length + (selectable ? 1 : 0) + (hasMenu ? 1 : 0);

  const head = `<tr>
    ${selectable ? `<th class="col-sel"><input type="checkbox" class="sel-all" aria-label="${esc(T("kit.select.all"))}"></th>` : ""}
    ${cols.map((c) => `<th${c.align === "right" ? ` class="num"` : ""}${c.width ? ` style="width:${Number(c.width)}px"` : ""}>${esc(c.label ?? "")}</th>`).join("")}
    ${hasMenu ? `<th class="col-menu"></th>` : ""}
  </tr>`;

  const bodyRows = rows.length ? rows.map((r) => {
    const cls = [
      r.accent ? `row-acc-${esc(r.accent)}` : "",
      r.dim ? "row-dim" : "",
    ].filter(Boolean).join(" ");
    const tds = cols.map((c, i) => {
      const t2 = [c.align === "right" ? "num" : "", c.mono ? "mono" : ""].filter(Boolean).join(" ");
      return `<td${t2 ? ` class="${t2}"` : ""}>${r.cells?.[i] ?? ""}</td>`;
    }).join("");
    const main = `<tr${r.id != null ? ` data-id="${esc(r.id)}"` : ""}${r.href ? ` data-href="${esc(r.href)}" tabindex="0"` : ""}${cls ? ` class="${cls}"` : ""}>
      ${selectable ? `<td class="col-sel"><input type="checkbox" class="row-sel" data-id="${esc(r.id ?? "")}" aria-label="${esc(T("kit.select.row"))}"></td>` : ""}
      ${tds}
      ${hasMenu ? `<td class="col-menu">${r.menu?.length ? menuHost(r.menu, T) : ""}</td>` : ""}
    </tr>`;
    const inset = r.inset
      ? `<tr class="tbl-inset" hidden${r.id != null ? ` data-inset-for="${esc(r.id)}"` : ""}><td colspan="${nCols}"><div class="tbl-inset-in">${r.inset}</div></td></tr>`
      : "";
    return main + inset;
  }).join("")
    : `<tr><td colspan="${nCols}" style="height:auto;border-bottom:0;padding:16px 0"><div class="f-empty"><p>${empty || ""}</p></div></td></tr>`;

  const cls = ["tbl", size === "dense" ? "tbl-dense" : "", size === "tall" ? "tbl-tall" : "", ruled ? "tbl-ruled" : ""]
    .filter(Boolean).join(" ");
  return `<div class="tbl-wrap"><table class="${cls}"><thead>${head}</thead><tbody>${bodyRows}</tbody></table></div>`;
}

/* ==================== §3.8 · controls and forms ==================== */

/** Three buttons, no fourth. kind: "primary" | "quiet" | "text".
 *  Destructive = text + danger. size: "sm" for the 28px compact. */
export function btn(label, { kind = "quiet", action, href, size, danger, id, type = "button", title, disabled } = {}) {
  const cls = [
    "btn", `btn-${kind}`,
    size === "sm" || size === "compact" ? "btn-sm" : "",
    danger ? "btn-danger" : "",
  ].filter(Boolean).join(" ");
  const attrs = [
    id ? `id="${esc(id)}"` : "",
    action ? `data-action="${esc(action)}"` : "",
    title ? `title="${esc(title)}"` : "",
  ].filter(Boolean).join(" ");
  if (href) return `<a class="${cls}" href="${esc(href)}" ${attrs}${disabled ? ` aria-disabled="true"` : ""}>${esc(label)}</a>`;
  return `<button type="${esc(type)}" class="${cls}" ${attrs}${disabled ? " disabled" : ""}>${esc(label)}</button>`;
}

/** Label above, hint below, consequence line in ink-2, error in words.
 *  `options` (array of "v" or { value, label }) renders a select. */
export function field({ id, label, value, hint, effect, type = "text", suffix, options, error, placeholder, min, max, step, rows, mono } = {}) {
  const did = (sfx) => `${id}-${sfx}`;
  const describedBy = [error ? did("err") : "", hint ? did("hint") : ""].filter(Boolean).join(" ");
  const shared = [
    `id="${esc(id)}"`,
    describedBy ? `aria-describedby="${describedBy}"` : "",
    error ? `aria-invalid="true"` : "",
    mono ? `class="mono"` : "",
  ].filter(Boolean).join(" ");

  let control;
  if (options) {
    const opts = options.map((o) => {
      const v = typeof o === "object" ? o.value : o;
      const l = typeof o === "object" ? o.label : o;
      return `<option value="${esc(v)}"${String(v) === String(value ?? "") ? " selected" : ""}>${esc(l)}</option>`;
    }).join("");
    control = `<select ${shared}>${opts}</select>`;
  } else if (type === "textarea") {
    control = `<textarea ${shared} rows="${Number(rows) || 4}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}>${esc(value ?? "")}</textarea>`;
  } else {
    const extras = [
      placeholder ? `placeholder="${esc(placeholder)}"` : "",
      min != null ? `min="${esc(min)}"` : "",
      max != null ? `max="${esc(max)}"` : "",
      step != null ? `step="${esc(step)}"` : "",
    ].filter(Boolean).join(" ");
    control = `<input type="${esc(type)}" ${shared} value="${esc(value ?? "")}" ${extras}>`;
  }

  return `<div class="fld">
    <label class="fld-l t-label" for="${esc(id)}">${esc(label)}</label>
    <div class="fld-c">${control}${suffix ? `<span class="fld-suffix">${esc(suffix)}</span>` : ""}</div>
    ${error ? `<p class="fld-err" id="${did("err")}">${esc(error)}</p>` : ""}
    ${hint ? `<p class="fld-hint" id="${did("hint")}">${esc(hint)}</p>` : ""}
    ${effect ? `<p class="fld-effect">${esc(effect)}</p>` : ""}
  </div>`;
}

/** C2 dialog for multi-field creation and verification. `confirm` is a
 *  label string or { label, action }. Open with a [data-open-dialog=id]
 *  control; floor.js handles show, backdrop, Esc, and dispatches the
 *  confirm action as "floor:action". */
export function dialog({ id, title, body, confirm, danger } = {}, t) {
  const T = T_OF(t);
  const c = typeof confirm === "object" ? confirm : { label: confirm };
  const confirmCls = danger ? "btn btn-text btn-danger" : "btn btn-primary";
  return `<dialog class="dlg" id="${esc(id)}" aria-labelledby="${esc(id)}-t">
    <form method="dialog" class="dlg-f">
      <h2 class="dlg-t" id="${esc(id)}-t">${esc(title)}</h2>
      <div class="dlg-b">${body || ""}</div>
      <div class="dlg-a">
        <button type="submit" value="cancel" class="btn btn-quiet" formnovalidate>${esc(T("kit.cancel"))}</button>
        ${c.label ? `<button type="submit" value="confirm" class="${confirmCls}"${c.action ? ` data-action="${esc(c.action)}"` : ""}>${esc(c.label)}</button>` : ""}
      </div>
    </form>
  </dialog>`;
}

/** Real text tabs with counts; underline marks the active one. Items:
 *  { href, label, count, on }. */
export function tabs(items = []) {
  const links = items.map(({ href, label, count: n, on }) =>
    `<a class="tab${on ? " on" : ""}" href="${esc(href)}"${on ? ` aria-current="true"` : ""} data-l="${esc(label)}">${esc(label)}${n != null ? `<span class="tab-n">${esc(String(n))}</span>` : ""}</a>`
  ).join("");
  return `<nav class="tabs">${links}</nav>`;
}

/* ============================ the shell ============================ */

const MARK_SVG_BRAND = `<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 11V1h9M2 6h7" stroke="white" stroke-width="2" fill="none" stroke-linecap="square"/></svg>`;
const GEAR_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg>`;
const FAVICON = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%2317171B'/><path d='M10 22V10h10M10 16h8' stroke='white' stroke-width='2.6' fill='none' stroke-linecap='square'/></svg>`;

/* Nav: three clusters divided by hairlines (§4.0). Settings lives in
   the identity cluster on the right, beside the language switch. */
const NAV_CLUSTERS = [
  [["/", "nav.queue"], ["/coverage", "nav.coverage"]],
  [["/sources", "nav.sources"], ["/evals", "nav.accuracy"]],
  [["/model", "nav.impact"], ["/backlog", "nav.backlog"], ["/wired", "nav.dayone"]],
];

const scopeOf = (path, nav) => {
  const seg = String(path || nav || "/").split("/")[1] || "";
  const clean = seg.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `p-${clean || "queue"}`;
};

/**
 * The document. The router calls this; page modules only produce `body`,
 * `css` and `script`. Page css lands after the foundation stylesheet;
 * page script lands after FLOOR_I18N and before /static/floor.js, so a
 * page script must reach Floor.* only from event handlers or after
 * DOMContentLoaded (floor.js runs synchronously before either fires).
 */
export function shell({ title, nav, path, mode, budget, body, css = "", script = "", lang = DEFAULT_LANG, t }) {
  const T = t || makeT(lang);
  const from = encodeURIComponent(path || nav || "/");

  // The full dictionary, resolved server-side to one language, so Floor.t
  // can serve any key a page's client code asks for. No second fetch.
  const copy = {};
  for (const k of Object.keys(COPY)) copy[k] = T(k);
  const clientCopy = JSON.stringify({ lang, copy }).replace(/</g, "\\u003c");

  const navHtml = NAV_CLUSTERS.map((cluster) =>
    cluster.map(([href, key]) => {
      const label = T(key);
      return `<a href="${href}"${nav === href ? ` class="on" aria-current="page"` : ""} data-l="${esc(label)}">${esc(label)}</a>`;
    }).join("")
  ).join(`<span class="hd-sep" aria-hidden="true"></span>`);

  const status = mode ? `<div class="hd-status${mode === "cached" ? " cached" : ""}">
      <span class="dot" aria-hidden="true"></span>
      <span>${mode === "live" ? esc(T("chrome.live")) : esc(T("chrome.cached"))}</span>
      ${budget ? `<span class="bud" title="${esc(T("chrome.budgetTip"))}">${money(budget.remaining, 2)} ${esc(T("chrome.leftToday"))}</span>` : ""}
    </div>` : "";

  const langSw = `<div class="hd-lang" aria-label="${esc(T("lang.label"))}">
      <a href="/lang?to=en&amp;from=${from}"${lang === "en" ? ` class="on" aria-current="true"` : ""}>EN</a>
      <a href="/lang?to=es&amp;from=${from}"${lang === "es" ? ` class="on" aria-current="true"` : ""}>ES</a>
    </div>`;

  const banner = mode === "cached" ? `<div class="hd-banner"><div class="hd-banner-in">
      ${mark("half", T("chrome.capReached"), { tone: "warn" })}
      <span>${esc(T("chrome.capBody"))}</span>
    </div></div>` : "";

  return `<!DOCTYPE html><html lang="${esc(lang)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Floor</title>
<link rel="stylesheet" href="/static/floor.css">
<link rel="icon" href="${FAVICON}">
${css ? `<style>${css}</style>` : ""}
</head><body>
<a class="skip" href="#main">${esc(T("kit.skip"))}</a>
<header class="hd"><div class="hd-in">
  <a class="hd-brand" href="/"><span class="hd-mark">${MARK_SVG_BRAND}</span><b>Floor</b></a>
  <span class="hd-ctx t-label">${esc(T("kit.context"))}</span>
  <nav class="hd-nav">${navHtml}</nav>
  <div class="hd-r">
    ${status}
    ${langSw}
    <a class="hd-set" href="/settings"${nav === "/settings" ? ` aria-current="page"` : ""}>${GEAR_SVG}<span>${esc(T("nav.settings"))}</span></a>
  </div>
</div></header>
${banner}
<main id="main" class="${scopeOf(path, nav)}">${body}</main>
<footer class="ft">
  <span>${esc(T("chrome.footer"))}</span>
  <span><a href="https://github.com/ashevedoleandrive/floor/blob/main/docs/floor-system-map.png" target="_blank" rel="noopener">${esc(T("chrome.howItWorks"))}</a> · Bryan Acevedo · ${new Date().toISOString().slice(0, 10)}</span>
</footer>
<script>window.FLOOR_I18N=${clientCopy}</script>
${script ? `<script>${script}</script>` : ""}
<script src="/static/floor.js"></script>
</body></html>`;
}
