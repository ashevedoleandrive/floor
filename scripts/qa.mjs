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

import { readFileSync } from "node:fs";

const BASE = process.argv.includes("--url")
  ? process.argv[process.argv.indexOf("--url") + 1]
  : "https://floor.leandrive.workers.dev";

const PAGES = ["/", "/sources", "/evals", "/model", "/backlog", "/wired", "/account/zalando.com"];

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
  "/": [
    "#qbody", "#assess-form", "#assess-domain", "#assess-out",
    "#add-dlg", "#add-text", "#add-go", "#cooldown",
    "[data-f]", "tr.r", "a[href='/api/export.csv']",
  ],
  "/backlog": ["#card-dlg", "#c-area", "#c-title", "#c-gap", "#c-metric", "#c-owner", "#c-status", "#c-save"],
  "/evals": ["#run-eval", "#gold-dlg", "#g-domain", "#g-value", "#g-url", "#g-save"],
  "/model": [
    "#m-sdrs", "#m-worked", "#m-mins", "#m-mins2", "#m-conv", "#m-conv2",
    "#m-win", "#m-win2", "#m-acv", "#m-cost",
    "#o-hours", "#o-extra", "#o-opps", "#o-cost", "#o-value", "#o-ratio",
  ],
};

const results = { pass: 0, fail: 0, warn: 0, notes: [] };
const ok = (m) => { results.pass++; console.log(`  \x1b[32mPASS\x1b[0m ${m}`); };
const bad = (m) => { results.fail++; console.log(`  \x1b[31mFAIL\x1b[0m ${m}`); results.notes.push(m); };
const warn = (m) => { results.warn++; console.log(`  \x1b[33mWARN\x1b[0m ${m}`); };

async function get(path) {
  const r = await fetch(BASE + path, { redirect: "manual" });
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
  const out = new Set();
  for (const m of html.matchAll(/href=["'](\/[^"'#?]*)["']/g)) out.add(m[1]);
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
  try {
    const js = readFileSync(new URL("../public/static/app.js", import.meta.url), "utf8");
    const ids = new Set();
    for (const m of js.matchAll(/\$\(["']#([a-zA-Z0-9_-]+)["']\)/g)) ids.add(m[1]);
    const declared = new Set(Object.values(REQUIRED).flat().filter((s) => s.startsWith("#")).map((s) => s.slice(1)));
    const anywhere = Object.values(html).join("\n");
    for (const id of ids) {
      if (declared.has(id)) continue;
      if (new RegExp(`id=["']${id}["']`).test(anywhere)) ok(`#${id} bound and present`);
      else warn(`#${id} is looked up by the client but never rendered on any page`);
    }
  } catch (e) { warn(`could not read app.js: ${e.message}`); }

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
