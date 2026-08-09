import { stageResearch, stageExtract, stageCritic, finalise, failedAssessment } from "./lib/pipeline.js";
import { scoreAccount, rankQueue, normaliseDomain, formatCount } from "./lib/scoring.js";
import {
  getSettings, setSetting, makeBudget, upsertAccount, saveAssessment,
  latestAssessment, getSignals, getEvidence, getTraces, queueRows, allSignals,
} from "./lib/db.js";
import { pickLang, langCookie, t as makeT, LANGS, COPY } from "./lib/i18n.js";
import { sourceSummary, loadSourceRules, loadAllSourceRules, classifyEvidence, classifySource, ruleUsage, TIERS } from "./lib/sources.js";
import { computeCoverage } from "./lib/coverage.js";
import { segmentEval, suggestGold, goldSources } from "./lib/accuracy.js";
import { primarySources } from "./lib/edgar.js";
import { extractTruth, extractTruthUK } from "./lib/truth.js";
import { shell as kitShell } from "./ui/kit.js";
import * as pageAccount  from "./ui/page-account.js";
import * as pageCoverage from "./ui/page-coverage.js";
import * as pageEvals    from "./ui/page-evals.js";
import * as pageModel    from "./ui/page-model.js";
import * as pageSettings from "./ui/page-settings.js";
import * as pageSources  from "./ui/page-sources.js";
import * as pageWired    from "./ui/page-wired.js";
import * as pageBacklog  from "./ui/page-backlog.js";
import * as pageQueue    from "./ui/page-queue.js";
import {
  updateAccount, archiveAccount, unarchiveAccount, assessmentHistory,
  deleteAssessment, restoreAssessment, updateGold, addGold, archiveGold,
  updateCard, archiveCard, reorderRules, setSettingLogged, settingsHistory,
} from "./lib/mutations.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const html = (body) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });

/**
 * The rebuilt pages, and the data each one needs.
 *
 * One entry per migrated surface. The `data` function is the only place a page's
 * queries live, so a page module never touches D1 and two page authors can never
 * collide over a shared loader. Adding a page is one line here and one new file.
 */
const PAGES = {
  "/":         { mod: pageQueue,    data: (env) => buildQueue(env) },
  "/coverage": { mod: pageCoverage, data: async (env) => ({
    ...(await computeCoverage(env)),
    // The registry, with status derived from what is actually wired, so the map
    // and its rail stop reading a hand-typed constant.
    sourceRegistry: sourceSummary(env),
  }) },
  "/settings": { mod: pageSettings, data: (env) => settingsData(env) },
  "/sources":  { mod: pageSources,  data: (env) => sourceSummary(env) },
  "/evals":    { mod: pageEvals,    data: async (env) => {
    const [evals, gold, q] = [await listEvals(env), await listGold(env), await buildQueue(env)];
    // Every unverified row carries the links Floor already found, so verifying
    // is reading a filing rather than hunting for one. Links only, never the
    // figure: handing over the source is navigation, filling in the number
    // would be the verification itself.
    const sources = {};
    const { results: filers } = await env.DB.prepare(
      "SELECT domain, sec_cik, sec_checked_at FROM accounts"
    ).all();
    const sec = Object.fromEntries((filers || []).map((r) => [r.domain, { cik: r.sec_cik, checked: !!r.sec_checked_at }]));
    for (const row of gold.rows) {
      if (row.verified) continue;
      const found = await goldSources(env, row.domain, row.disclosed_metric);
      if (found.length) sources[row.domain] = found;
    }
    return { evals, gold, sources, sec, cost_per_account: q.cost.per_account,
             suggest: suggestGold({ goldRows: gold.rows, queueRows: q.rows }) };
  } },
  "/model":    { mod: pageModel,    data: (env) => buildQueue(env) },
  "/wired":    { mod: pageWired,    data: (env) => buildQueue(env) },
  "/backlog":  { mod: pageBacklog,  data: (env) => listBacklog(env, { includeArchived: true }) },
};

/** Settings needs its own payload: the settings themselves plus the cost context
 *  each field's consequence line refers to. */
async function settingsData(env) {
  const settings = await getSettings(env);
  const budget = await makeBudget(env);
  const q = await buildQueue(env);
  return {
    settings,
    budget: { spent: budget.spent(), cap: budget.cap },
    assessed: q.cost.assessed,
    total_accounts: q.cost.total_accounts,
    cost_per_account: q.cost.per_account,
  };
}

/** Render a rebuilt page: fetch its data, get the body, wrap it in the shell. */
async function renderPage(entry, env, ctx) {
  const { mod, data } = entry;
  // A page carries its own copy rather than editing the shared dictionary, so
  // two page authors working at once can never clobber each other's keys.
  if (mod.keys) Object.assign(COPY, mod.keys);
  const payload = data ? await data(env, ctx) : null;
  const q = payload?.mode ? payload : await buildQueue(env);
  const body = await mod.render(env, payload, ctx);
  return kitShell({
    title: ctx.t(mod.meta.titleKey),
    nav: mod.meta.nav,
    path: ctx.path,
    mode: q.mode,
    budget: q.budget,
    body,
    css: mod.css ? mod.css() : "",
    script: mod.script ? mod.script() : "",
    lang: ctx.lang,
    t: ctx.t,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const p = url.pathname;
    const lang = pickLang(request);
    const t = makeT(lang);

    // Static assets (css/js) are delegated straight through.
    if (p.startsWith("/static/") || p === "/favicon.ico") {
      return env.ASSETS.fetch(request);
    }

    try {
      if (p === "/lang") {
        // An explicit choice, remembered. Returns to the page you were on so
        // switching language never costs you your place.
        const to = LANGS.includes(url.searchParams.get("to")) ? url.searchParams.get("to") : "en";
        const back = url.searchParams.get("from") || "/";
        return new Response(null, {
          status: 302,
          headers: { location: back.startsWith("/") ? back : "/", "set-cookie": langCookie(to) },
        });
      }
      if (p === "/api/health")   return json(await health(env));
      if (p === "/api/queue")    return json(await buildQueue(env));
      if (p === "/api/settings" && request.method === "POST") return json(await saveSettings(env, request));
      if (p === "/api/settings") return json(await getSettings(env));
      if (p === "/api/assess" && request.method === "POST")   return json(await startAssess(env, request, ctx));
      if (p.startsWith("/api/job/")) return json(await jobStatus(env, Number(p.slice(9))));
      if (p === "/api/step" && request.method === "POST") return json(await stepEntry(env, request, ctx, url.origin));
      if (p === "/api/ingest" && request.method === "POST") return json(await ingest(env, request));
      if (p === "/api/import" && request.method === "POST")   return json(await runImport(env, request));
      if (p === "/api/backlog" && request.method === "POST")  return json(await addCard(env, request));
      if (p === "/api/backlog")  return json(await listBacklog(env));
      if (p === "/api/gold" && request.method === "POST")     return json(await saveGold(env, request));
      if (p === "/api/gold")     return json(await listGold(env));
      if (p === "/api/evals/run" && request.method === "POST") return json(await runEval(env));
      if (p === "/api/evals")    return json(await listEvals(env));
      if (p === "/api/sources")  return json(sourceSummary(env));
      if (p === "/api/coverage") return json(await computeCoverage(env));
      if (p === "/api/source-rules" && request.method === "POST") return json(await saveRule(env, request));
      if (p === "/api/source-rules") return json(await listRules(env));
      if (p === "/api/export.csv") return exportCsv(env);
      if (p === "/api/settings/history") return json({ ok: true, history: await settingsHistory(env) });

      // Operator writes. Reads stay on GET; anything that changes state is a POST
      // with the action in the path, so a mutation can never be triggered by
      // following a link or by a crawler.
      if (p.startsWith("/api/account/")) {
        const rest = decodeURIComponent(p.slice(13)).split("/");
        const domain = normaliseDomain(rest[0]);
        const action = rest[1] || null;
        if (action === "history") return accountWrite(env, request, domain, "history");
        if (request.method === "POST") return accountWrite(env, request, domain, action);
        return json(await accountDetail(env, domain));
      }
      if (p.startsWith("/api/assessment/") && request.method === "POST") {
        const [idStr, action] = p.slice(16).split("/");
        const id = Number(idStr);
        if (action === "restore") return written(() => restoreAssessment(env, id).then((assessment) => ({ assessment })));
        return written(() => deleteAssessment(env, id));
      }
      if (p.startsWith("/api/edgar/")) {
        const d = normaliseDomain(decodeURIComponent(p.slice(11)));
        const acct = await env.DB.prepare("SELECT name FROM accounts WHERE domain=?").bind(d).first();
        return json(await primarySources(env, { domain: d, name: acct?.name }));
      }
      if (p.startsWith("/api/truth/") && request.method === "POST")
        return json(await establishTruth(env, normaliseDomain(decodeURIComponent(p.slice(11)))));
      if (p === "/api/edgar-scan" && request.method === "POST") {
        const { results } = await env.DB.prepare(
          "SELECT a.domain, a.name FROM accounts a JOIN gold_set g ON g.domain=a.domain WHERE a.sec_checked_at IS NULL"
        ).all();
        const out = [];
        for (const r of results || []) {
          const src = await primarySources(env, { domain: r.domain, name: r.name });
          await env.DB.prepare("UPDATE accounts SET sec_cik=?, sec_checked_at=datetime('now') WHERE domain=?")
            .bind(src.ok ? src.cik : null, r.domain).run();
          out.push({ domain: r.domain, cik: src.ok ? src.cik : null });
        }
        return json({ ok: true, checked: out.length, results: out });
      }
      if (p === "/api/gold/suggest") {
        const [gold, q] = [await listGold(env), await buildQueue(env)];
        return json({ ok: true, ...suggestGold({ goldRows: gold.rows, queueRows: q.rows }) });
      }
      if (p.startsWith("/api/gold/sources/"))
        return json({ ok: true, sources: await goldSources(env, normaliseDomain(decodeURIComponent(p.slice(18))), url.searchParams.get("metric") || "") });
      if (p === "/api/gold/add" && request.method === "POST")
        return written(async () => ({ row: await addGold(env, await request.json().catch(() => ({}))) }));
      if (p.startsWith("/api/gold/") && request.method === "POST") {
        const [idStr, action] = p.slice(10).split("/");
        const id = Number(idStr);
        if (action === "archive") {
          const b = await request.json().catch(() => ({}));
          return written(async () => ({ row: await archiveGold(env, id, b.on !== false) }));
        }
        return written(async () => updateGold(env, id, await request.json().catch(() => ({}))));
      }
      if (p === "/api/source-rules/reorder" && request.method === "POST")
        return written(async () => ({ order: await reorderRules(env, (await request.json().catch(() => ({}))).ids) }));
      if (p.startsWith("/api/backlog/") && request.method === "POST") {
        const [idStr, action] = p.slice(13).split("/");
        const id = Number(idStr);
        if (action === "archive") {
          const b = await request.json().catch(() => ({}));
          return written(async () => ({ card: await archiveCard(env, id, b.on !== false) }));
        }
        return written(async () => updateCard(env, id, await request.json().catch(() => ({}))));
      }

      // Retired tabs keep resolving so shared links and bookmarks never 404.
      // Sources lives inside Coverage now, Day one inside Case.
      if (p === "/sources") return new Response(null, { status: 301, headers: { location: "/coverage#registry" } });
      if (p === "/wired")   return new Response(null, { status: 301, headers: { location: "/model#wired" } });

      // Rebuilt pages, served from src/ui/. The migration runs page by page:
      // anything registered here uses the new foundation, anything absent falls
      // through to the legacy renderer below and keeps working untouched.
      const rebuilt = PAGES[p];
      if (rebuilt) return html(await renderPage(rebuilt, env, { lang, t, path: p }));

      if (p.startsWith("/account/")) {
        const d = normaliseDomain(decodeURIComponent(p.slice(9)));
        const detail = d ? await accountDetail(env, d) : null;
        if (!detail?.account) return new Response("Not found", { status: 404 });
        return html(await renderPage(
          { mod: pageAccount, data: () => detail },
          env,
          { lang, t, path: p }
        ));
      }
      return new Response("Not found", { status: 404 });
    } catch (err) {
      // Never 500 into a blank page — a panel is invited to run this unattended.
      return json({ error: "unhandled", detail: String(err?.message || err) }, 500);
    }
  },

  /**
   * Queue consumer. This is where an assessment actually runs.
   *
   * A request invocation cannot hold a multi-minute model call, so the fetch
   * handler only enqueues. Here there is room to run all three stages in
   * sequence, updating the job row between them so the UI can show progress.
   */
  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      const { jobId, domain } = msg.body || {};
      try {
        await runJobToCompletion(env, jobId, domain);
        msg.ack();
      } catch (err) {
        await failJob(env, jobId, String(err?.message || err).slice(0, 400));
        // Retry is worth one attempt for a transient API error, but not more:
        // every retry is real spend against the daily cap.
        if (msg.attempts >= 2) msg.ack(); else msg.retry();
      }
    }
  },
};

/** Run every stage of a job in one consumer invocation. */
async function runJobToCompletion(env, jobId, domain) {
  for (let i = 0; i < 5; i++) {
    const job = await env.DB.prepare("SELECT status FROM jobs WHERE id=?").bind(jobId).first();
    if (!job || job.status === "done" || job.status === "error") return;
    await runStage(env, null, jobId, null);
  }
}



async function health(env) {
  const budget = await makeBudget(env);
  const settings = await getSettings(env);
  return {
    ok: true,
    build: "map-v18",
    mode: budget.live() ? "live" : "cached",
    budget: { cap: budget.cap, spent: Number(budget.spent().toFixed(4)), remaining: Number(budget.remaining().toFixed(4)), day: budget.day },
    models: { research: settings.model_research, extract: settings.model_extract, critic: settings.model_critic },
    floor_txn: Number(settings.floor_txn),
    cooldown_days: Number(settings.cooldown_days),
  };
}

/** The queue is the product. Everything else is a detail view of one row. */
async function buildQueue(env) {
  const settings = await getSettings(env);
  const rows = await queueRows(env);
  const signalMap = await allSignals(env);
  const budget = await makeBudget(env);

  const scored = rows.map((r) => {
    const account = { last_touched_at: r.last_touched_at, region: r.region, domain: r.domain };
    if (!r.assessment_id) {
      return {
        ...r, band: "unscored", band_label: "Not yet assessed", band_order: 5,
        total_score: 0, rank_reason: "No assessment run yet",
        fit_score: null, timing_score: 0, cooldown_state: r.last_touched_at ? "eligible" : "never_touched",
        floor_verdict: "unknown", signals: [],
      };
    }
    const assessment = {
      txn_min: r.txn_min, txn_mid: r.txn_mid, txn_max: r.txn_max,
      confidence: r.confidence, abstained: r.abstained, abstain_reason: r.abstain_reason,
    };
    const signals = signalMap.get(r.id) || [];
    const s = scoreAccount({ assessment, signals, account, settings });
    return { ...r, ...s, signals };
  });

  const ranked = rankQueue(scored).map((r, i) => ({ ...r, rank: i + 1 }));
  const costed = ranked.filter((r) => r.assessment_id);
  const totalCost = costed.reduce((a, r) => a + (r.cost_usd || 0), 0);

  return {
    settings,
    mode: budget.live() ? "live" : "cached",
    budget: { cap: budget.cap, spent: Number(budget.spent().toFixed(4)), remaining: Number(budget.remaining().toFixed(4)) },
    counts: ranked.reduce((acc, r) => { acc[r.band] = (acc[r.band] || 0) + 1; return acc; }, {}),
    cost: {
      total: Number(totalCost.toFixed(4)),
      per_account: costed.length ? Number((totalCost / costed.length).toFixed(4)) : 0,
      assessed: costed.length,
      total_accounts: ranked.length,
    },
    rows: ranked,
  };
}

/**
 * Kick off an assessment and return immediately.
 *
 * The work continues in ctx.waitUntil after the response is sent, writing
 * progress to the jobs table. The client polls /api/job/:id. This is not a
 * nicety — a run is two to four minutes and no edge will hold a request open
 * that long, which the first production run demonstrated by dying mid-pipeline.
 */
async function startAssess(env, request, ctx) {
  const body = await request.json().catch(() => ({}));
  const domain = normaliseDomain(body.domain);
  if (!domain) return { ok: false, error: "invalid_domain" };

  const budget = await makeBudget(env);
  if (!budget.live()) {
    const acct = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
    const cached = acct ? await latestAssessment(env, acct.id) : null;
    return {
      ok: true, mode: "cached", cached: true, domain,
      note: `Daily spend cap of $${budget.cap} reached. Showing the last stored assessment; live runs resume tomorrow.`,
      assessment: cached || null,
    };
  }

  let account = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  if (!account) {
    account = await upsertAccount(env, {
      domain, name: body.name, region: body.region,
      last_touched_at: body.last_touched_at, source: "api",
    });
  } else if (body.last_touched_at) {
    await env.DB.prepare("UPDATE accounts SET last_touched_at=? WHERE id=?")
      .bind(body.last_touched_at, account.id).run();
  }

  const jr = await env.DB.prepare(
    "INSERT INTO jobs(domain, status, stage, payload, lang) VALUES(?, 'running', 'research', '{}', ?)"
  ).bind(domain, pickLang(request)).run();
  const jobId = jr.meta.last_row_id;

  await env.ASSESS_Q.send({ jobId, domain });
  return { ok: true, mode: "live", job_id: jobId, domain, note: "Queued. Poll /api/job/" + jobId };
}

/**
 * Internal continuation endpoint.
 *
 * Responds immediately and does the actual work in waitUntil, so the caller's
 * invocation is never held open waiting for ours. That is the whole point of
 * the chain: each Worker invocation owns exactly one model call.
 */
async function stepEntry(env, request, ctx, origin) {
  const b = await request.json().catch(() => ({}));
  const jobId = Number(b.job);
  if (!Number.isFinite(jobId)) return { ok: false, error: "bad_job" };
  ctx.waitUntil(runStage(env, ctx, jobId, origin));
  return { ok: true, accepted: true, job_id: jobId };
}

/**
 * Run ONE stage of a job, persist the result, and hand off to the next.
 *
 * A full assessment is three model calls totalling two to four minutes.
 * Cloudflare terminated the first attempt mid-research with the job orphaned
 * and no cost recorded, so the pipeline is now chained: each invocation makes
 * one call, writes what it learned into jobs.payload, then fires the next
 * invocation and exits. State lives in the row, not in memory.
 */
async function runStage(env, ctx, jobId, origin) {
  const job = await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(jobId).first();
  if (!job || job.status === "done" || job.status === "error") return;

  const settings = await getSettings(env);
  const budget = await makeBudget(env);
  const payload = safeParse(job.payload) || {};
  const traces = payload.traces || [];
  const account = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(job.domain).first();

  // A stage that starts twice would double-bill, so attempts are counted and
  // capped rather than retried blindly.
  if ((job.attempts || 0) > 6) {
    await failJob(env, jobId, "too many stage attempts");
    return;
  }
  await env.DB.prepare("UPDATE jobs SET attempts=attempts+1, updated_at=datetime('now') WHERE id=?")
    .bind(jobId).run();

  try {
    if (job.stage === "research") {
      const r = await stageResearch({ env, budget, domain: job.domain, account, settings });
      traces.push(...(r.traces || []));
      if (!r.ok) {
        await finishJob(env, jobId, job.domain, account, settings,
          failedAssessment({ reason: r.reason, detail: r.detail, traces, startedAt: null }));
        return;
      }
      await saveStage(env, jobId, "extract", { ...payload, traces, research: r.text, sources: r.sources });
      return;
    }

    if (job.stage === "extract") {
      const e = await stageExtract({
        env, budget, domain: job.domain,
        researchText: payload.research, sources: payload.sources, settings,
      });
      traces.push(...(e.traces || []));
      if (!e.ok) {
        await finishJob(env, jobId, job.domain, account, settings,
          failedAssessment({ reason: e.reason, detail: e.detail, traces, startedAt: null }));
        return;
      }
      await saveStage(env, jobId, "critic", { ...payload, traces, extract: e.json });
      return;
    }

    if (job.stage === "critic") {
      const c = await stageCritic({
        env, budget, domain: job.domain,
        extractJson: payload.extract, researchText: payload.research, settings,
      });
      traces.push(...(c.traces || []));
      const result = finalise({
        extractJson: payload.extract, criticJson: c.json,
        allTraces: traces, startedAt: null,
        criticTruncated: !!c.truncated,
      });
      await finishJob(env, jobId, job.domain, account, settings, result);
      return;
    }

    await failJob(env, jobId, `unknown stage: ${job.stage}`);
  } catch (err) {
    await failJob(env, jobId, String(err?.message || err).slice(0, 400));
  }
}

const safeParse = (s) => { try { return JSON.parse(s || "{}"); } catch { return null; } };

async function saveStage(env, jobId, nextStage, payload) {
  await env.DB.prepare(
    "UPDATE jobs SET stage=?, payload=?, updated_at=datetime('now') WHERE id=?"
  ).bind(nextStage, JSON.stringify(payload), jobId).run();
}

/** Fire the next invocation. Its response returns instantly; the work is in
 *  its own waitUntil, so this fetch does not hold us open. */
function nextStep(origin, jobId) {
  return fetch(`${origin}/api/step`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ job: jobId }),
  }).catch(() => {});
}

async function failJob(env, jobId, detail) {
  await env.DB.prepare(
    "UPDATE jobs SET status='error', detail=?, updated_at=datetime('now') WHERE id=?"
  ).bind(String(detail).slice(0, 400), jobId).run();
}

async function finishJob(env, jobId, domain, account, settings, result) {
  const acct = account || await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  const assessmentId = await saveAssessment(env, acct.id, result);
  const fresh = await env.DB.prepare("SELECT * FROM accounts WHERE id=?").bind(acct.id).first();
  const signals = await getSignals(env, acct.id);
  const scored = scoreAccount({ assessment: result.assessment, signals, account: fresh, settings });

  await env.DB.prepare("UPDATE assessments SET floor_verdict=? WHERE id=?")
    .bind(scored.floor_verdict, assessmentId).run();

  await env.DB.prepare(
    `UPDATE jobs SET status='done', stage='scoring', assessment_id=?, cost_usd=?, payload=NULL,
       detail=?, updated_at=datetime('now') WHERE id=?`
  ).bind(
    assessmentId, result.assessment.cost_usd || 0,
    result.assessment.abstained
      ? (result.assessment.abstain_reason || "abstained").slice(0, 300)
      : `${scored.floor_verdict} · ${result.assessment.txn_mid} txn/mo`,
    jobId
  ).run();
}

/**
 * Accept a completed assessment produced outside the Worker.
 *
 * A Worker invocation will not hold a three-minute model call open, so the
 * queue is populated from a Node process where no such limit exists. The
 * pipeline code is identical either way; only the host differs. This endpoint
 * is the seam, and it is the same one a Queue consumer or a cron would use.
 *
 * Write-protected by a shared secret: the rest of the app is deliberately
 * open so the panel can run it themselves, but nothing anonymous should be
 * able to inject an assessment.
 */
async function ingest(env, request) {
  const secret = request.headers.get("x-floor-secret");
  if (!env.INGEST_SECRET || secret !== env.INGEST_SECRET) {
    return { ok: false, error: "unauthorized" };
  }
  const body = await request.json().catch(() => ({}));
  const domain = normaliseDomain(body.domain);
  if (!domain || !body.result?.assessment) return { ok: false, error: "bad_payload" };

  const settings = await getSettings(env);
  let account = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  if (!account) account = await upsertAccount(env, { domain, source: "batch" });

  const assessmentId = await saveAssessment(env, account.id, body.result);
  const fresh = await env.DB.prepare("SELECT * FROM accounts WHERE id=?").bind(account.id).first();
  const signals = await getSignals(env, account.id);
  const scored = scoreAccount({ assessment: body.result.assessment, signals, account: fresh, settings });
  await env.DB.prepare("UPDATE assessments SET floor_verdict=? WHERE id=?")
    .bind(scored.floor_verdict, assessmentId).run();

  // Spend still lands on the shared daily ledger, wherever it was incurred.
  const cost = body.result.assessment.cost_usd || 0;
  if (cost > 0) {
    const budget = await makeBudget(env);
    await budget.charge(cost, body.searches || 0);
  }

  return { ok: true, domain, assessment_id: assessmentId, scored };
}

async function jobStatus(env, id) {
  if (!Number.isFinite(id)) return { ok: false, error: "bad_job_id" };
  const j = await env.DB.prepare("SELECT * FROM jobs WHERE id=?").bind(id).first();
  if (!j) return { ok: false, error: "not_found" };
  if (j.status !== "done") return { ok: true, job: j };
  const detail = await accountDetail(env, j.domain);
  return { ok: true, job: j, detail };
}

/** Batch ingest. This is what makes it a tool rather than a lookup. */
async function runImport(env, request) {
  const body = await request.json().catch(() => ({}));
  const raw = body.rows || body.text || "";
  const parsed = typeof raw === "string" ? parseList(raw) : raw;
  const added = [];
  for (const r of parsed.slice(0, 500)) {
    const d = normaliseDomain(r.domain || r);
    if (!d) continue;
    await upsertAccount(env, {
      domain: d, name: r.name, region: (r.region || "").toUpperCase() || null,
      last_touched_at: r.last_touched_at || null, owner: r.owner || null, source: "upload",
    });
    added.push(d);
  }
  return { ok: true, added: added.length, domains: added };
}

/** Accepts a bare domain per line, or CSV: domain,name,region,last_touched_at,owner */
function parseList(text) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    .filter((l) => !/^domain\s*,/i.test(l))
    .map((line) => {
      const [domain, name, region, last_touched_at, owner] = line.split(",").map((x) => (x || "").trim());
      return { domain, name: name || null, region: region || null, last_touched_at: last_touched_at || null, owner: owner || null };
    });
}

async function accountDetail(env, domainRaw) {
  const domain = normaliseDomain(domainRaw);
  if (!domain) return { account: null };
  const account = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  if (!account) return { account: null };
  const settings = await getSettings(env);
  const assessment = await latestAssessment(env, account.id);
  const signals = await getSignals(env, account.id);
  const rawEvidence = assessment ? await getEvidence(env, assessment.id) : [];
  const rules = await loadSourceRules(env);
  const evidence = classifyEvidence(rawEvidence, rules, settings.tier_unclassified_weight ?? 0.35);
  const traces = assessment ? await getTraces(env, assessment.id) : [];
  const scored = assessment ? scoreAccount({ assessment, signals, account, settings }) : null;
  return { account, assessment, evidence, traces, signals, scored, settings };
}


/**
 * Source rules: read and write from the UI.
 *
 * These deliberately live in the database rather than in code. The people
 * running this will not have access to whoever wrote it, so adding a registry,
 * demoting an aggregator or re-weighting a tier has to be an operation someone
 * performs in the product. A rule that requires a deploy is not a rule they own.
 */
async function listRules(env) {
  const settings = await getSettings(env);
  const active = await loadSourceRules(env);
  const all = await loadAllSourceRules(env);
  const usage = await ruleUsage(env, active, all, Number(settings.tier_unclassified_weight ?? 0.35));
  return {
    ...usage,
    tiers: TIERS,
    fallback_weight: Number(settings.tier_unclassified_weight ?? 0.35),
    note: "Matched in order against the source URL, first match wins. Changing a rule re-grades every claim already stored, because classification runs when the page renders rather than when the claim was written.",
  };
}

async function saveRule(env, request) {
  const b = await request.json().catch(() => ({}));

  if (b.delete_id) {
    await env.DB.prepare("DELETE FROM source_rules WHERE id=? AND builtin=0").bind(b.delete_id).run();
    return { ok: true, ...(await listRules(env)) };
  }
  if (b.toggle_id != null) {
    await env.DB.prepare(
      "UPDATE source_rules SET enabled = CASE enabled WHEN 1 THEN 0 ELSE 1 END, updated_at=datetime('now') WHERE id=?"
    ).bind(b.toggle_id).run();
    return { ok: true, ...(await listRules(env)) };
  }
  if (b.fallback_weight != null) {
    await setSetting(env, "tier_unclassified_weight", String(b.fallback_weight));
    return { ok: true, ...(await listRules(env)) };
  }

  if (b.id) {
    await env.DB.prepare(
      "UPDATE source_rules SET pattern=?, tier=?, weight=?, label=?, note=?, position=?, updated_at=datetime('now') WHERE id=?"
    ).bind(b.pattern, b.tier, Number(b.weight), b.label, b.note || null, Number(b.position ?? 999), b.id).run();
    return { ok: true, ...(await listRules(env)) };
  }

  if (!b.pattern || !b.tier) return { ok: false, error: "pattern_and_tier_required" };
  if (!TIERS[b.tier]) return { ok: false, error: "unknown_tier" };
  // First match wins, so a duplicate pattern lower in the order would never
  // fire. Silently dead config is worse than a rejected edit.
  const clash = await env.DB.prepare(
    "SELECT id, position, label FROM source_rules WHERE lower(pattern)=lower(?)"
  ).bind(b.pattern).first();
  if (clash) {
    return {
      ok: false, error: "duplicate_pattern",
      detail: `A rule for "${b.pattern}" already exists at order ${clash.position} (${clash.label}). Edit that one instead, or it would never match.`,
    };
  }
  await env.DB.prepare(
    "INSERT INTO source_rules(position, pattern, tier, weight, label, note, builtin) VALUES(?,?,?,?,?,?,0)"
  ).bind(Number(b.position ?? 500), b.pattern, b.tier, Number(b.weight ?? 0.5),
         b.label || TIERS[b.tier].label, b.note || null).run();
  return { ok: true, ...(await listRules(env)) };
}

async function listBacklog(env, { includeArchived = false } = {}) {
  // Archived cards were counted in total and live, so archiving a card changed
  // nothing the operator could see and the header sentence quietly lied. The
  // page had to recompute its own counts to work around it, which is the tell
  // that the fix belonged here. Found by the backlog page author.
  const { results } = await env.DB.prepare(
    "SELECT * FROM backlog ORDER BY area, id DESC"
  ).all();
  const all = results || [];
  const rows = includeArchived ? all : all.filter((c) => !c.archived_at);
  const areas = ["SDR", "Marketing", "Learning Ops", "Key Account Mgmt", "Other"];
  const byArea = Object.fromEntries(areas.map((a) => [a, []]));
  for (const c of rows) (byArea[c.area] || byArea.Other).push(c);
  return {
    areas, byArea,
    total: rows.length,
    live: rows.filter((c) => c.status === "live").length,
    archived: all.filter((c) => c.archived_at),
  };
}

async function addCard(env, request) {
  const b = await request.json().catch(() => ({}));
  if (!b.title) return { ok: false, error: "title_required" };
  await env.DB.prepare(
    "INSERT INTO backlog(area, title, owner, status, gap, metric, link) VALUES(?,?,?,?,?,?,?)"
  ).bind(b.area || "Other", b.title, b.owner || null, b.status || "idea", b.gap || null, b.metric || null, b.link || null).run();
  return { ok: true, ...(await listBacklog(env)) };
}


/**
 * Establish ground truth for one gold-set row from its own filings.
 *
 * Writes the figure, the sentence it came from, the period as printed and the
 * conversion, so the accuracy claim can be audited by reading rather than
 * trusted. Provenance is recorded as `extraction` rather than `human`, because
 * the two are different kinds of evidence and the page should say which it has.
 */
async function establishTruth(env, domain) {
  const row = await env.DB.prepare("SELECT * FROM gold_set WHERE domain=?").bind(domain).first();
  if (!row) return { ok: false, error: "not_a_candidate", note: `${domain} is not in the gold set.` };
  if (row.established_by === "human")
    return { ok: false, error: "human_established", note: "A person already established this figure. Un-verify it first if it needs replacing." };

  const settings = await getSettings(env);
  const budget = await makeBudget(env);
  if (!budget.live()) return { ok: false, error: "budget", note: "Daily spend cap reached." };

  const acct = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  const prior = acct ? await latestAssessment(env, acct.id) : null;

  // EDGAR first, because a US filing states order counts in prose and Companies
  // House states revenue in a PDF. Fall through to the UK registry when the
  // merchant files nowhere near the SEC, which is what ASOS, Zalando and every
  // private British retailer have in common.
  let r = await extractTruth(env, budget, {
    domain,
    name: acct?.name || row.name,
    metric: row.disclosed_metric,
    settings,
    // Only used to flag a disagreement whose ratio looks like a unit error.
    predictedMonthly: prior?.abstained ? null : prior?.txn_mid ?? null,
  });
  if (!r.ok && env.COMPANIES_HOUSE_KEY) {
    const uk = await extractTruthUK(env, budget, {
      domain, name: acct?.name || row.name, metric: row.disclosed_metric, settings,
    });
    if (uk.ok) r = uk;
    else r = { ...r, reason: `SEC: ${r.reason} · UK: ${uk.reason}` };
  }

  const cost = (r.traces || []).reduce((a, t) => a + (t.cost_usd || 0), 0);
  if (!r.ok) return { ok: false, error: r.stage || "failed", note: r.reason, cost_usd: cost };

  await env.DB.prepare(
    `UPDATE gold_set SET disclosed_value=?, source_url=?, period=?, verbatim=?,
       raw_value=?, raw_period=?, established_by='extraction', established_at=datetime('now'),
       truth_flags=?, verified=1, verified_at=datetime('now')
     WHERE domain=?`
  ).bind(
    r.monthly, r.source_url, r.period_label || r.raw_period, r.verbatim,
    r.raw_value, r.raw_period, (r.flags || []).join(" · ") || null, domain
  ).run();

  return {
    ok: true, domain, monthly: r.monthly,
    raw_value: r.raw_value, raw_period: r.raw_period,
    verbatim: r.verbatim, source_url: r.source_url,
    form: r.form, filed: r.filed, flags: r.flags, cost_usd: cost,
  };
}

async function listGold(env) {
  // Archived candidates were counted in total forever, with no hard delete to
  // undo an accidental add, so the denominator of the accuracy claim could only
  // ever grow. Same defect as listBacklog, found independently by the accuracy
  // page author. The denominator of a trust argument has to be correctable.
  const { results } = await env.DB.prepare(
    "SELECT * FROM gold_set ORDER BY verified DESC, domain"
  ).all();
  const all = results || [];
  const rows = all.filter((g) => !g.archived_at);
  return {
    rows,
    total: rows.length,
    verified: rows.filter((g) => g.verified).length,
    archived: all.filter((g) => g.archived_at).length,
  };
}

async function saveGold(env, request) {
  const b = await request.json().catch(() => ({}));
  const domain = normaliseDomain(b.domain);
  if (!domain) return { ok: false, error: "invalid_domain" };
  const value = Number(b.disclosed_value);
  if (!Number.isFinite(value) || value <= 0) return { ok: false, error: "value_required" };
  if (!b.source_url) return { ok: false, error: "source_url_required" };
  await env.DB.prepare(
    `INSERT INTO gold_set(domain, name, disclosed_metric, disclosed_value, period, source_url, source_note, verified, verified_at)
     VALUES(?,?,?,?,?,?,?,1,datetime('now'))
     ON CONFLICT(domain) DO UPDATE SET
       disclosed_metric=excluded.disclosed_metric, disclosed_value=excluded.disclosed_value,
       period=excluded.period, source_url=excluded.source_url, source_note=excluded.source_note,
       verified=1, verified_at=datetime('now')`
  ).bind(domain, b.name || null, b.disclosed_metric || null, Math.round(value),
         b.period || null, b.source_url, b.source_note || null).run();
  return { ok: true, ...(await listGold(env)) };
}

/**
 * The eval. Scores the tool against merchants whose volume is publicly
 * disclosed, so the accuracy number can be checked by anyone in the room.
 * Unverified gold rows are skipped, not guessed at.
 */
async function runEval(env) {
  const settings = await getSettings(env);
  const floor = Number(settings.floor_txn);
  const { results: gold } = await env.DB.prepare("SELECT * FROM gold_set WHERE verified=1").all();
  if (!gold?.length) {
    return { ok: false, error: "no_verified_gold", note: "Verify at least one gold-set row before running the eval." };
  }

  const items = [];
  for (const g of gold) {
    const acct = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(g.domain).first();
    const a = acct ? await latestAssessment(env, acct.id) : null;
    if (!a) continue;
    const abstained = !!a.abstained;
    const inBand = !abstained && a.txn_min != null && a.txn_max != null &&
      g.disclosed_value >= a.txn_min && g.disclosed_value <= a.txn_max;
    const orderOk = !abstained && a.txn_mid > 0 &&
      Math.abs(Math.log10(a.txn_mid / g.disclosed_value)) <= 1;
    const floorOk = !abstained && ((a.txn_mid >= floor) === (g.disclosed_value >= floor));
    items.push({
      domain: g.domain, truth: g.disclosed_value,
      pred_min: a.txn_min, pred_mid: a.txn_mid, pred_max: a.txn_max,
      in_band: inBand ? 1 : 0, order_correct: orderOk ? 1 : 0,
      floor_correct: floorOk ? 1 : 0, abstained: abstained ? 1 : 0,
      source_url: g.source_url,
      // Carried so accuracy can be reported per reliability class and per
      // region rather than as one blended percentage nobody can act on.
      region: acct?.region || null,
      derivation: a.derivation || null,
      confidence: a.confidence ?? null,
    });
  }
  if (!items.length) return { ok: false, error: "no_assessments", note: "Assess the verified gold-set accounts first." };

  const scoredItems = items.filter((i) => !i.abstained);
  const row = {
    n: items.length,
    n_scored: scoredItems.length,
    in_band: scoredItems.filter((i) => i.in_band).length,
    order_correct: scoredItems.filter((i) => i.order_correct).length,
    floor_correct: scoredItems.filter((i) => i.floor_correct).length,
    abstained: items.filter((i) => i.abstained).length,
  };
  const res = await env.DB.prepare(
    "INSERT INTO evals(n, n_scored, in_band, order_correct, abstained, floor_correct) VALUES(?,?,?,?,?,?)"
  ).bind(row.n, row.n_scored, row.in_band, row.order_correct, row.abstained, row.floor_correct).run();
  const evalId = res.meta.last_row_id;
  await env.DB.batch(items.map((i) => env.DB.prepare(
    `INSERT INTO eval_items(eval_id, domain, truth, pred_min, pred_mid, pred_max, in_band, order_correct, floor_correct, abstained, source_url, region, derivation, confidence)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(evalId, i.domain, i.truth, i.pred_min, i.pred_mid, i.pred_max, i.in_band, i.order_correct, i.floor_correct, i.abstained, i.source_url, i.region, i.derivation, i.confidence)));

  return { ok: true, eval_id: evalId, ...row, items, segments: segmentEval(items) };
}

async function listEvals(env) {
  const latest = await env.DB.prepare("SELECT * FROM evals ORDER BY id DESC LIMIT 1").first();
  if (!latest) return { latest: null, items: [] };
  const { results } = await env.DB.prepare("SELECT * FROM eval_items WHERE eval_id=? ORDER BY domain").bind(latest.id).all();
  const items = results || [];
  return { latest, items, segments: segmentEval(items) };
}

async function saveSettings(env, request) {
  const b = await request.json().catch(() => ({}));
  const allowed = ["floor_txn", "cooldown_days", "search_usd", "acv_usd",
                   "model_research", "model_extract", "model_critic",
                   "daily_cap_usd", "tier_unclassified_weight"];
  // Logged rather than silently set: a setting change re-grades every stored
  // assessment on the next render, so "why did the queue change" needs an answer.
  const changed = [];
  for (const k of allowed) {
    if (b[k] === undefined) continue;
    const r = await setSettingLogged(env, k, b[k]);
    if (r.changed) changed.push(r);
  }
  return { ok: true, changed, settings: await getSettings(env) };
}

/* ------------------------------------------------------------------ *
 * Operator writes.
 *
 * Everything below exists because of the completeness audit: thirteen
 * operations an operator would obviously want, that the product could not
 * perform at all. The governing rule is that an action is only reversible if
 * it is reversible in the interface, so every response carries what the caller
 * needs to undo it without having read the row first.
 * ------------------------------------------------------------------ */

/** Turn an InvalidInput into a 400 the screen can render under the right field. */
const written = async (fn) => {
  try { return json({ ok: true, ...(await fn()) }); }
  catch (e) {
    if (e?.invalid) return json({ ok: false, field: e.field, error: e.message }, 400);
    throw e;
  }
};

async function accountWrite(env, request, domain, action) {
  const b = await request.json().catch(() => ({}));
  if (action === "archive")   return written(() => archiveAccount(env, domain));
  if (action === "unarchive")  return written(() => unarchiveAccount(env, domain).then((account) => ({ account })));
  if (action === "history") {
    const a = await env.DB.prepare("SELECT id FROM accounts WHERE domain=?").bind(domain).first();
    return json({ ok: true, history: a ? await assessmentHistory(env, a.id) : [] });
  }
  return written(() => updateAccount(env, domain, b));
}

/**
 * Salesforce-shaped export. Their stack is measured 100% in Salesforce, so the
 * seam is built even though it is deliberately not wired — the challenge rules
 * say no production access, and this respects that while showing where it goes.
 */
async function exportCsv(env) {
  const q = await buildQueue(env);
  const head = [
    "Account_Domain__c", "Account_Name", "BillingCountryRegion",
    "Floor_Rank__c", "Floor_Score__c", "Floor_Band__c", "Floor_Verdict__c",
    "Est_Monthly_Txn_Min__c", "Est_Monthly_Txn_Mid__c", "Est_Monthly_Txn_Max__c",
    "Floor_Confidence__c", "Cooldown_State__c", "Cooldown_Until__c",
    "Last_Touched__c", "Floor_Reason__c", "Floor_Assessed_At__c",
  ];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.join(",")];
  for (const r of q.rows) {
    lines.push([
      r.domain, r.name, r.region, r.rank, r.total_score, r.band_label ?? r.band, r.floor_verdict,
      r.txn_min, r.txn_mid, r.txn_max, r.confidence, r.cooldown_state, r.cooldown_until,
      r.last_touched_at, r.rank_reason, r.run_at,
    ].map(esc).join(","));
  }
  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="floor-queue-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

export { formatCount };
