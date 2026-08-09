#!/usr/bin/env node
/**
 * Floor QA gate.
 *
 * The failure this exists to catch: the client JS looks up elements by id and
 * class, the server renders those elements, and the two live in different
 * files. Rename one side and nothing errors, nothing 404s, the page looks
 * perfect, and a button silently does nothing. Checking that a page returns
 * 200 would not notice. Checking that a string appears somewhere in the HTML
 * would not notice either.
 *
 * So this reads every selector the client actually depends on, then verifies
 * each one exists in the rendered HTML of the page that needs it.
 *
 *   node scripts/qa.mjs
 *   node scripts/qa.mjs --url http://localhost:8787
 */

import { readFileSync, readdirSync } from "node:fs";

const BASE = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "https://floor.leandrive.workers.dev";

// /settings was absent from this list until 2026-08-08, which is the whole reason
// the gate read 120 passing while the Settings page shipped with no stylesheet at
// all. A page that is not fetched is not checked, and an unchecked page is where
// the bug goes. Every route the router serves belongs here.
const PAGES = ["/", "/sources", "/evals", "/model", "/backlog", "/wired", "/settings", "/account/zalando.com"];

const API = [
  ["/api/health", (d) => d.ok === true && typeof d.mode === "string"],
  ["/api/queue", (d) => Array.isArray(d.rows) && d.rows.length > 0 && d.settings],
  ["/api/sources", (d) => Array.isArray(d.sources) && d.sources.length > 0],
  ["/api/backlog", (d) => Array.isArray(d.areas) && d.byArea],
  ["/api/evals", (d) => "latest" in d],
  ["/api/gold", (d) => Array.isArray(d.rows)],
  ["/api/settings", (d) => d.floor_txn != null],
  ["/api/account/zalando.com", (d) => d.account && d.account.domain === "zalando.com"],
];

/**
 * Which page must contain which selectors. Derived from what the client binds,
 * kept explicit rather than inferred so a deleted binding shows up as a
 * deliberate edit here rather than silently reducing coverage.
 */
const REQUIRED = {
  // Every id the queue's client binds. Checking three of twenty-three was
  // coverage theatre: a renamed dialog would have passed the gate and shipped a
  // dead button, which is the exact failure this file exists to catch.
  "/": [
    "#q-main", "#q-meta", "#q-data", "#q-intro", "#q-filter", "#q-region", "#q-sort",
    "#assess-form", "#assess-domain", "#assess-touched", "#assess-go", "#assess-out",
    "#dlg-add", "#q-add-text", "#dlg-edit", "#q-e-name", "#q-e-region", "#q-e-owner",
    "#q-e-touched", "#dlg-owner", "#q-o-owner", "#dlg-history", "#q-hist-body",
    "a[href='/api/export.csv']",
  ],
  "/backlog": ["#card-add", "#card-edit", "#bl-add-open", "#bl-arch-toggle", "#bl-header-count", "#c-area", "#c-status"],
  // Rebuilt pages bind different elements than the ones they replaced. Leaving
  // the old ids here would fail forever on a page that is working correctly,
  // and a check that cries wolf gets ignored, which is worse than no check.
  "/evals": ["#eval-body", "#eval-error", "#eval-prog", "#gold-add-dlg", "#gold-edit-dlg", "#gold-verify-dlg"],
  "/model": [
    "#m-sdrs", "#m-worked", "#m-mins", "#m-conv", "#m-win", "#m-acv", "#m-cost",
    "#o-hours", "#o-opps", "#o-cost", "#o-value", "#o-ratio",
  ],
};

const results = { pass: 0, fail: 0, warn: 0, notes: [] };
const ok = (m) => { results.pass++; console.log(`  \x1b[32mPASS\x1b[0m ${m}`); };
const bad = (m) => { results.fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); results.notes.push(m); };
const warn = (m) => { results.warn++; console.log(`  \x1b[33mWARN\x1b[0m ${m}`); };

async function get(path, init = {}) {
  const r = await fetch(BASE + path, { redirect: "manual", ...init });
  const body = await r.text();
  return { status: r.status, body, type: r.headers.get("content-type") || "" };
}

/** Crude but effective selector presence check against raw HTML. */
function hasSelector(html, sel) {
  if (sel.startsWith("#")) {
    const id = sel.slice(1);
    return new RegExp(`id=["']${id}["']`).test(html);
  }
  if (sel.startsWith("[")) {
    const attr = sel.slice(1, -1).split("=")[0];
    return new RegExp(`${attr}[=\\s>]`).test(html);
  }
  if (sel.includes("[href=")) {
    const m = sel.match(/href='([^']+)'/);
    return m ? html.includes(`href="${m[1]}"`) || html.includes(`href='${m[1]}'`) : false;
  }
  if (sel.startsWith("tr.")) return new RegExp(`class=["'][^"']*\\b${sel.slice(3)}\\b`).test(html);
  if (sel.startsWith(".")) return new RegExp(`class=["'][^"']*\\b${sel.slice(1)}\\b`).test(html);
  return html.includes(sel);
}

function internalLinks(html) {
  // Strip scripts first. A page's client code builds hrefs by concatenation, so
  // the raw source contains fragments like href="/account/ that are never a real
  // link. Scanning them reported a 404 on a page whose links were all fine.
  const markup = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const out = new Set();
  for (const m of markup.matchAll(/href=["'](\/[^"'#?]*)["']/g)) out.add(m[1]);
  return [...out];
}

async function main() {
  console.log(`\nFloor QA · ${BASE}\n${"=".repeat(60)}`);

  console.log("\nAPI contracts");
  for (const [path, check] of API) {
    try {
      const r = await get(path);
      if (r.status !== 200) { bad(`${path} returned ${r.status}`); continue; }
      let d;
      try { d = JSON.parse(r.body); } catch { bad(`${path} did not return JSON`); continue; }
      check(d) ? ok(`${path}`) : bad(`${path} returned 200 but the shape is wrong`);
    } catch (e) { bad(`${path} threw: ${e.message}`); }
  }

  console.log("\nPages render real content");
  const html = {};
  for (const p of PAGES) {
    try {
      const r = await get(p);
      html[p] = r.body;
      if (r.status !== 200) { bad(`${p} returned ${r.status}`); continue; }
      if (!/text\/html/.test(r.type)) { bad(`${p} is not HTML`); continue; }
      if (r.body.length < 1500) { bad(`${p} rendered only ${r.body.length} bytes, likely an error page`); continue; }
      if (!/<h1[^>]*>/.test(r.body)) warn(`${p} has no h1`);
      ok(`${p} (${(r.body.length / 1024).toFixed(1)}kb)`);
    } catch (e) { bad(`${p} threw: ${e.message}`); }
  }

  console.log("\nClient bindings exist in the markup");
  for (const [page, sels] of Object.entries(REQUIRED)) {
    const h = html[page];
    if (!h) { bad(`${page} did not render, cannot check its bindings`); continue; }
    for (const sel of sels) {
      hasSelector(h, sel) ? ok(`${page} ${sel}`) : bad(`${page} is MISSING ${sel} — the click handler for it is dead`);
    }
  }

  console.log("\nEvery client selector is accounted for");
  // Reads the foundation client now that the legacy one is deleted. Every id it
  // looks up must exist on some page, or the handler bound to it is dead.
  try {
    const js = readFileSync(new URL("../public/static/floor.js", import.meta.url), "utf8");
    const ids = new Set();
    for (const m2 of js.matchAll(/(?:getElementById|\$\$?)\(\s*["'`]#?([a-zA-Z][\w-]*)["'`]/g)) ids.add(m2[1]);
    const declared = new Set(Object.values(REQUIRED).flat().filter((x) => x.startsWith("#")).map((x) => x.slice(1)));
    // Some elements the client looks up, it also creates when absent (the toast
    // stack, the bulk bar). Those are not missing, so warning about them trains
    // people to ignore the warnings that matter.
    for (const m2 of js.matchAll(/\.id\s*=\s*["']([\w-]+)["']/g)) declared.add(m2[1]);
    const anywhere = Object.values(html).join("\n");
    for (const id of ids) {
      if (declared.has(id)) continue;
      if (new RegExp(`id=["']${id}["']`).test(anywhere)) ok(`#${id} bound and present`);
      else warn(`#${id} is looked up by the client but never rendered on any page`);
    }
  } catch (e) { warn(`could not read floor.js: ${e.message}`); }

  console.log("\nInternal links resolve");
  const seen = new Set();
  for (const [page, h] of Object.entries(html)) {
    if (!h) continue;
    for (const href of internalLinks(h)) {
      if (seen.has(href) || href.startsWith("/static/")) continue;
      seen.add(href);
      try {
        const r = await get(href);
        r.status === 200 ? ok(`${href}`) : bad(`${href} returns ${r.status} (linked from ${page})`);
      } catch (e) { bad(`${href} threw: ${e.message}`); }
    }
  }

  console.log("\nContent hygiene");
  for (const [page, h] of Object.entries(html)) {
    if (!h) continue;
    const visible = h.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
    if (visible.includes("—")) bad(`${page} contains an em dash in user-facing copy`);
    if (/\bundefined\b/.test(visible)) bad(`${page} renders the literal string "undefined"`);
    if (/\bNaN\b/.test(visible)) bad(`${page} renders NaN`);
    if (/\[object Object\]/.test(visible)) bad(`${page} renders [object Object]`);
    if (/href=["']https?:\/\/(cdn|fonts|unpkg|cdnjs)/.test(h)) bad(`${page} loads a remote asset, which breaks offline`);
  }
  if (results.notes.length === 0) ok("no em dashes, undefined, NaN or remote assets on any page");

  /* ------------------------------------------------------------------ *
   * Checks added for the 2026-08-08 rebuild.
   *
   * Each one exists because a specific failure shipped to production and was
   * found by a human rather than by this gate.
   * ------------------------------------------------------------------ */

  // Classes the client binds to but never styles. Read from the client source
  // rather than hard-coded, so adding a hook does not require editing the gate.
  const JS_HOOKS = new Set();
  try {
    const fjs = readFileSync(new URL("../public/static/floor.js", import.meta.url), "utf8");
    // Every way floor.js reaches for a class: closest, querySelector(All), its
    // own $/$$ helpers, matches, and classList. Catching only two of them
    // reported the selection checkboxes as unstyled when they are pure hooks.
    for (const m of fjs.matchAll(
      /(?:closest|querySelectorAll?|matches|\$\$?)\(\s*["'`]([^"'`]*?)["'`]/g
    )) for (const cls of (m[1].match(/\.([\w-]+)/g) || [])) JS_HOOKS.add(cls.slice(1));
    for (const m of fjs.matchAll(/classList\.(?:add|remove|toggle|contains)\(\s*["']([\w-]+)["']/g))
      JS_HOOKS.add(m[1]);
  } catch { /* foundation not built yet */ }

  console.log("\nEvery class in the markup is actually styled");
  // The Settings bug: `.set-row`, `.set-label`, `.set-hint` and seven siblings
  // were emitted into the page and defined in no stylesheet, so the screen
  // collapsed into run-on text. Nothing errored, nothing 404'd, and the gate was
  // green. A class family with no CSS is the signature of a whole screen that was
  // never rendered by whoever wrote it.
  const styleSources = [];
  for (const f of ["app.css", "floor.css"]) {
    try { styleSources.push(readFileSync(new URL(`../public/static/${f}`, import.meta.url), "utf8")); }
    catch { /* floor.css does not exist until the foundation lands */ }
  }
  for (const [page, h] of Object.entries(html)) {
    if (!h) continue;
    const inline = [...h.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
    const css = styleSources.join("\n") + "\n" + inline;
    const defined = new Set();
    for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);
    const used = new Map();
    for (const m of h.matchAll(/\sclass=["']([^"']+)["']/g))
      for (const c of m[1].split(/\s+/).filter(Boolean)) used.set(c, (used.get(c) || 0) + 1);
    // A class can legitimately carry no style: floor.js uses some purely as
    // binding hooks, styled through a sibling class. Exempt anything the client
    // actually selects on, and nothing else.
    const orphans = [...used]
      .filter(([c, n]) => !defined.has(c) && n >= 3 && !JS_HOOKS.has(c))
      .sort((a, b) => b[1] - a[1]);
    if (orphans.length) {
      bad(`${page} emits ${orphans.length} class(es) that no stylesheet defines: ${
        orphans.slice(0, 6).map(([c, n]) => `.${c}(x${n})`).join(" ")}`);
    } else ok(`${page} every repeated class has CSS`);
  }

  // The authored key list, read from the dictionary itself so this can never
  // drift from what the product actually defines.
  let I18N_KEYS = new Set();
  try {
    const src = readFileSync(new URL("../src/lib/i18n.js", import.meta.url), "utf8");
    for (const m of src.matchAll(/["']([a-z][\w]*(?:\.[\w]+)+)["']\s*:/g)) I18N_KEYS.add(m[1]);
  } catch { warn("could not read i18n.js, untranslated-key check is inert"); }

  console.log("\nBoth languages render");
  // A layout that only holds in English is not done. Spanish runs 15 to 25 percent
  // longer, and an untranslated key renders as its own dotted name, which is the
  // tell this looks for.
  for (const p of PAGES) {
    try {
      const r = await get(p, { headers: { cookie: "floor_lang=es" } });
      if (r.status !== 200) { bad(`${p} in Spanish returned ${r.status}`); continue; }
      const visible = r.body.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "");
      // Compare against the real dictionary rather than guessing by shape: a
      // domain like "doordash.com" has the same shape as a key like "nav.queue",
      // and only the dictionary can tell them apart.
      const raw = [...visible.matchAll(/>\s*([a-z]+(?:\.[a-zA-Z][\w.]*){1,})\s*</g)]
        .map((m) => m[1]).filter((k) => I18N_KEYS.has(k));
      if (raw.length) bad(`${p} in Spanish renders ${raw.length} untranslated key(s): ${[...new Set(raw)].slice(0, 4).join(", ")}`);
      else if (r.body === html[p]) bad(`${p} is byte-identical in Spanish, so nothing translated`);
      else ok(`${p} in Spanish`);
    } catch (e) { bad(`${p} in Spanish threw: ${e.message}`); }
  }

  console.log("\nRebuild rules hold in the new source");
  // The migration is complete and the legacy view layer is deleted, so these
  // now cover every file that renders anything.
  const newFiles = [];
  for (const rel of ["../public/static/floor.js", "../public/static/floor.css", "../src/ui/kit.js"]) {
    try { newFiles.push([rel.split("/").pop(), readFileSync(new URL(rel, import.meta.url), "utf8")]); } catch { /* not yet built */ }
  }
  try {
    const dir = new URL("../src/ui/", import.meta.url);
    for (const f of readdirSync(dir).filter((f) => f.startsWith("page-") && f.endsWith(".js")))
      newFiles.push([f, readFileSync(new URL(f, dir), "utf8")]);
  } catch { /* src/ui may not exist yet */ }

  if (!newFiles.length) warn("no rebuilt files on disk yet, rebuild rules not exercised");
  for (const [name, src] of newFiles) {
    const strip = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    if (/location\.reload\s*\(/.test(strip)) bad(`${name} calls location.reload(), which is the dead-feeling state model the rebuild removes`);
    else ok(`${name} has no page reloads`);
    if (/—/.test(strip)) bad(`${name} contains an em dash in source`);
  }
  for (const [name, src] of newFiles.filter(([n]) => n.endsWith(".css"))) {
    // Motion at rest. An `animation:` outside a running-state or reduced-motion
    // scope is the glowing status dot the operator called out by name.
    const blocks = [...src.matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const offenders = blocks.filter(([, sel, body]) =>
      /animation\s*:/.test(body) && !/none/.test(body) &&
      !/\[data-running\]|\.is-running|@keyframes|prefers-reduced-motion/.test(sel));
    offenders.length
      ? bad(`${name} animates ${offenders.length} selector(s) at rest: ${offenders.slice(0, 3).map((o) => o[1].trim().slice(0, 30)).join(" · ")}`)
      : ok(`${name} nothing animates at rest`);
    /prefers-reduced-motion/.test(src) ? ok(`${name} honours prefers-reduced-motion`) : bad(`${name} has no prefers-reduced-motion block`);
  }
  for (const [name, src] of newFiles.filter(([n]) => n.startsWith("page-"))) {
    // Page CSS must be scoped, or one page restyles every other page.
    const cssFn = src.match(/export function css\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
    if (!cssFn) { warn(`${name} exports no css()`); continue; }
    const scope = (src.match(/route:\s*["']([^"']+)["']/) || [])[1];
    const cls = scope === "/" ? "p-queue" : `p-${(scope || "").replace(/^\//, "").split("/")[0]}`;
    const sels = [...cssFn[1].matchAll(/(^|\n)\s*([.#][^{\n]+)\{/g)].map((m) => m[2].trim());
    const leaks = sels.filter((s) => !s.includes(`.${cls}`));
    leaks.length
      ? bad(`${name} has ${leaks.length} unscoped selector(s) that leak into other pages: ${leaks.slice(0, 3).join(" · ")}`)
      : ok(`${name} css is scoped to .${cls}`);
  }

  console.log("\nThe gauge tells the truth at the top of the range");
  // DoorDash is 258.7M against a track that clamped at 100M, so the product's most
  // impressive number rendered as a clipped sliver with its tick off the bar.
  try {
    const q = JSON.parse((await get("/api/queue")).body);
    const top = Math.max(...q.rows.map((r) => Number(r.txn_max || r.txn_mid || 0)));
    const home = html["/"] || "";
    // Matches both vocabularies: `bar` is the legacy markup, `g-bar` the kit's.
    // Without this the check goes quiet the moment the queue migrates, which is
    // exactly when it stops being able to catch the regression it exists for.
    const widths = [...home.matchAll(/class="g?-?bar"[^>]*style="left:([\d.]+)%;\s*width:([\d.]+)%/g)]
      .map((m) => Number(m[1]) + Number(m[2]));
    const pinned = widths.filter((w) => w >= 99.9).length;
    if (!widths.length) warn("no gauge bars found on the queue, cannot check the ceiling");
    else if (pinned) bad(`${pinned} gauge bar(s) run to the end of the track, so the scale clamps below the real maximum (${top.toLocaleString()} txn/mo)`);
    else ok(`gauge accommodates the largest account (${top.toLocaleString()} txn/mo)`);
  } catch (e) { warn(`gauge ceiling check failed: ${e.message}`); }

  console.log("\nDemo invariants");
  // Added 2026-08-09 after a verification run left DoorDash stamped with a
  // last-touched date of today. Nothing errored. The tool was correct: a touched
  // account IS suppressed. But the single most impressive number in the dataset,
  // 258.7M txn/mo, silently dropped to rank 17 and read as suppressed, and the
  // agent that did it reported production left exactly as found.
  //
  // So this asserts the handful of facts the demo actually stands on. If a test
  // or a stray click moves them, this says so out loud rather than leaving it to
  // be discovered on a shared screen.
  try {
    const q = JSON.parse((await get("/api/queue")).body);
    const by = (d) => q.rows.find((r) => r.domain === d);
    const dd = by("doordash.com");
    const checks = [
      // Not "rank 1". Rank legitimately moves as accounts are assessed: both
      // Roblox and DoorDash clear the floor, so fresher dated signals win, which
      // is the whole point of ranking by when rather than only by size. An
      // invariant that fails when the product works correctly trains people to
      // ignore it. What must hold is that the account is present, qualified and
      // near the top.
      [dd && dd.rank <= 3, `doordash is in the top 3 (is ${dd?.rank})`],
      [dd && Math.abs((dd.txn_mid || 0) - 258700000) < 1e6, `doordash estimate is 258.7M (is ${dd?.txn_mid})`],
      [dd && dd.band === "work", `doordash is in the work band (is ${dd?.band})`],
      [dd && !dd.last_touched_at, `doordash has no last-touched date (is ${dd?.last_touched_at})`],
      [q.rows.length === 38, `38 accounts (is ${q.rows.length})`],
      [q.rows.filter((r) => r.assessment_id).length === 19, `19 assessed (is ${q.rows.filter((r) => r.assessment_id).length})`],
      [q.counts.needs_evidence === 6, `6 abstained (is ${q.counts.needs_evidence})`],
      [Number(q.settings.floor_txn) === 100000, `floor is 100k (is ${q.settings.floor_txn})`],
      [Number(q.settings.cooldown_days) === 45, `cool-down is 45 days (is ${q.settings.cooldown_days})`],
    ];
    for (const [pass, label] of checks) pass ? ok(label) : bad(`demo invariant broken: ${label}`);
    const gold = JSON.parse((await get("/api/gold")).body);
    gold.total === 22 ? ok(`gold set has 22 candidates`) : bad(`gold set has ${gold.total}, expected 22`);
  } catch (e) { warn(`demo invariants could not be checked: ${e.message}`); }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${results.pass} passed · ${results.fail} failed · ${results.warn} warnings`);
  if (results.fail) {
    console.log("\nFailures:");
    for (const n of results.notes) console.log(`  · ${n}`);
    process.exit(1);
  }
  console.log("\nAutomated layer clean. Interactions still need a real browser pass.");
}

main().catch((e) => { console.error(e); process.exit(1); });
