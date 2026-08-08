#!/usr/bin/env node
/**
 * Batch-assess accounts against the deployed Floor worker.
 *
 * The queue is the product, so it has to be populated before anyone opens it.
 * Assessing ~35 accounts one at a time from a browser tab is not a plan; this
 * drives the same public API the panel would use, with bounded concurrency and
 * a running cost tally.
 *
 *   node scripts/batch.mjs                 # every account with no assessment
 *   node scripts/batch.mjs --all           # re-assess everything
 *   node scripts/batch.mjs --limit 5       # cap how many
 *   node scripts/batch.mjs --concurrency 2
 *   node scripts/batch.mjs zalando.com asos.com
 *
 * Concurrency is deliberately low. Each assessment is three chained Worker
 * invocations and a handful of web searches; hammering it buys nothing and
 * risks tripping the daily spend cap mid-run.
 */

const BASE = process.env.FLOOR_URL || "https://floor.leandrive.workers.dev";
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(`--${name}`);
const CONCURRENCY = Number(flag("concurrency", 2));
const LIMIT = Number(flag("limit", 0));
const explicit = args.filter((a) => !a.startsWith("--") && a.includes("."));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (n) => `$${Number(n || 0).toFixed(5)}`;

async function api(path, init) {
  const r = await fetch(BASE + path, init);
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return r.json();
}

async function pickTargets() {
  if (explicit.length) return explicit;
  const q = await api("/api/queue");
  const rows = has("all") ? q.rows : q.rows.filter((r) => !r.assessment_id);
  const domains = rows.map((r) => r.domain);
  return LIMIT ? domains.slice(0, LIMIT) : domains;
}

async function assessOne(domain) {
  const start = await api("/api/assess", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (start.cached) return { domain, status: "cached", note: start.note };
  if (!start.job_id) return { domain, status: "error", note: start.error || "no job id" };

  const began = Date.now();
  // Ceiling raised from 8 to 20 minutes after four false "timeouts".
  //
  // A run is ~4 minutes alone, but the queue consumer caps concurrency, so
  // parallel submissions contend and a single account can legitimately take 8
  // to 14 minutes. All four accounts that "timed out" at the old ceiling had in
  // fact completed server-side. The script was reporting its own impatience as
  // a product failure, which is a worse bug than a slow run.
  while (Date.now() - began < 20 * 60 * 1000) {
    await sleep(5000);
    let j;
    try { j = await api(`/api/job/${start.job_id}`); } catch { continue; }
    const job = j.job || {};
    if (job.status === "done" || job.status === "error") {
      const a = j.detail?.assessment || {};
      const sc = j.detail?.scored || {};
      return {
        domain,
        status: job.status,
        abstained: !!a.abstained,
        verdict: sc.floor_verdict || null,
        mid: a.txn_mid ?? null,
        confidence: a.confidence ?? null,
        cost: job.cost_usd || 0,
        secs: Math.round((Date.now() - began) / 1000),
        note: job.detail || "",
      };
    }
  }
  return { domain, status: "timeout", note: "still running after 20 minutes, check /api/job for the real state before assuming failure" };
}

async function main() {
  const health = await api("/api/health");
  console.log(`Floor @ ${BASE}`);
  console.log(`mode=${health.mode}  budget remaining=$${health.budget.remaining}  cap=$${health.budget.cap}`);
  if (health.mode !== "live") {
    console.log("Spend cap reached for today. Nothing to do.");
    return;
  }

  const targets = await pickTargets();
  if (!targets.length) { console.log("Nothing to assess."); return; }
  console.log(`${targets.length} account(s), concurrency ${CONCURRENCY}\n`);

  const results = [];
  let spent = 0;
  const queue = [...targets];

  const worker = async () => {
    while (queue.length) {
      const d = queue.shift();
      process.stdout.write(`  → ${d} …\n`);
      let r;
      try { r = await assessOne(d); }
      catch (e) { r = { domain: d, status: "error", note: String(e.message) }; }
      results.push(r);
      spent += r.cost || 0;

      const label = r.status !== "done" ? r.status.toUpperCase()
        : r.abstained ? "abstained" : `${r.verdict} ${r.mid?.toLocaleString?.() ?? ""}`;
      console.log(`  ✓ ${d.padEnd(24)} ${String(label).padEnd(28)} ${money(r.cost)}  ${r.secs ?? "?"}s`);
      if (r.abstained && r.note) console.log(`      ${String(r.note).slice(0, 110)}`);

      // Stop early rather than run past the cap mid-batch.
      const h = await api("/api/health").catch(() => null);
      if (h && h.mode !== "live") { console.log("\nSpend cap reached, stopping."); queue.length = 0; }
    }
  };

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  const done = results.filter((r) => r.status === "done");
  const abst = done.filter((r) => r.abstained);
  console.log(`\n${done.length}/${results.length} completed`);
  console.log(`abstained: ${abst.length} (${done.length ? Math.round((abst.length / done.length) * 100) : 0}%)`);
  console.log(`total ${money(spent)}  ·  per account ${money(done.length ? spent / done.length : 0)}`);
  const bad = results.filter((r) => r.status !== "done");
  if (bad.length) {
    console.log("\nnot completed:");
    for (const b of bad) console.log(`  ${b.domain}: ${b.status} ${b.note || ""}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
