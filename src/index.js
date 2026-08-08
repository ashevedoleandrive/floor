import { stageResearch, stageExtract, stageCritic, finalise, failedAssessment } from "./lib/pipeline.js";
import { scoreAccount, rankQueue, normaliseDomain, formatCount } from "./lib/scoring.js";
import {
  getSettings, setSetting, makeBudget, upsertAccount, saveAssessment,
  latestAssessment, getSignals, getEvidence, getTraces, queueRows, allSignals,
} from "./lib/db.js";
import { renderQueue, renderAccount, renderEvals, renderBacklog, renderModel, renderWired, renderSources, shell } from "./lib/views.js";
import { pickLang, langCookie, t as makeT, LANGS } from "./lib/i18n.js";
import { renderSettings, settingsScript } from "./lib/views-settings.js";
import { sourceSummary, loadSourceRules, loadAllSourceRules, classifyEvidence, classifySource, ruleUsage, TIERS } from "./lib/sources.js";
import { computeCoverage } from "./lib/coverage.js";
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
      if (p === "/api/sources")  return json(sourceSummary());
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

      if (p === "/")            return html(await renderQueue(env, await buildQueue(env), { lang, t }));
      if (p === "/evals")       return html(await renderEvals(env, await listEvals(env), await listGold(env), { lang, t }));
      if (p === "/backlog")     return html(await renderBacklog(env, await listBacklog(env), { lang, t }));
      if (p === "/model")       return html(await renderModel(env, await buildQueue(env), { lang, t }));
      if (p === "/settings")    return html(await settingsPage(env, { lang, t }));
      if (p === "/sources")     return html(await renderSources(env, sourceSummary(), { lang, t }));
      if (p === "/wired")       return html(await renderWired(env, { lang, t }));
      if (p.startsWith("/account/")) {
        const d = normaliseDomain(decodeURIComponent(p.slice(9)));
        const detail = d ? await accountDetail(env, d) : null;
        if (!detail?.account) return new Response("Not found", { status: 404 });
        return html(await renderAccount(env, detail, { lang, t }));
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


/** The settings screen. Every knob that changes behaviour, in one place. */
async function settingsPage(env, ctx) {
  const settings = await getSettings(env);
  const budget = await makeBudget(env);
  const q = await buildQueue(env);
  const { body } = await renderSettings(env, {
    settings,
    budget: { spent: budget.spent(), cap: budget.cap },
    assessed: q.cost.assessed,
    total_accounts: q.cost.total_accounts,
    cost_per_account: q.cost.per_account,
  }, ctx);
  // Reuses the shared chrome from views.js so the settings screen never drifts
  // from the rest of the product.
  return shell({
    title: "Settings", nav: "/settings", mode: q.mode, budget: q.budget,
    body, script: settingsScript(), lang: ctx.lang, t: ctx.t,
  });
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

async function listBacklog(env) {
  const { results } = await env.DB.prepare("SELECT * FROM backlog ORDER BY area, id DESC").all();
  const areas = ["SDR", "Marketing", "Learning Ops", "Key Account Mgmt", "Other"];
  const byArea = Object.fromEntries(areas.map((a) => [a, []]));
  for (const c of results || []) (byArea[c.area] || byArea.Other).push(c);
  const live = (results || []).filter((c) => c.status === "live").length;
  return { areas, byArea, total: (results || []).length, live };
}

async function addCard(env, request) {
  const b = await request.json().catch(() => ({}));
  if (!b.title) return { ok: false, error: "title_required" };
  await env.DB.prepare(
    "INSERT INTO backlog(area, title, owner, status, gap, metric, link) VALUES(?,?,?,?,?,?,?)"
  ).bind(b.area || "Other", b.title, b.owner || null, b.status || "idea", b.gap || null, b.metric || null, b.link || null).run();
  return { ok: true, ...(await listBacklog(env)) };
}

async function listGold(env) {
  const { results } = await env.DB.prepare("SELECT * FROM gold_set ORDER BY verified DESC, domain").all();
  const verified = (results || []).filter((g) => g.verified).length;
  return { rows: results || [], total: (results || []).length, verified };
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
    `INSERT INTO eval_items(eval_id, domain, truth, pred_min, pred_mid, pred_max, in_band, order_correct, floor_correct, abstained, source_url)
     VALUES(?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(evalId, i.domain, i.truth, i.pred_min, i.pred_mid, i.pred_max, i.in_band, i.order_correct, i.floor_correct, i.abstained, i.source_url)));

  return { ok: true, eval_id: evalId, ...row, items };
}

async function listEvals(env) {
  const latest = await env.DB.prepare("SELECT * FROM evals ORDER BY id DESC LIMIT 1").first();
  if (!latest) return { latest: null, items: [] };
  const { results } = await env.DB.prepare("SELECT * FROM eval_items WHERE eval_id=? ORDER BY domain").bind(latest.id).all();
  return { latest, items: results || [] };
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
