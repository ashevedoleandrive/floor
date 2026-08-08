const today = () => new Date().toISOString().slice(0, 10);

export async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const s = Object.fromEntries((results || []).map((r) => [r.key, r.value]));
  return {
    floor_txn:      s.floor_txn      ?? env.FLOOR_TXN_PER_MONTH ?? "100000",
    cooldown_days:  s.cooldown_days  ?? env.COOLDOWN_DAYS_DEFAULT ?? "45",
    search_usd:     s.search_usd     ?? "0",
    model_research: s.model_research ?? env.MODEL_RESEARCH ?? "claude-sonnet-5",
    model_extract:  s.model_extract  ?? env.MODEL_EXTRACT  ?? "claude-sonnet-5",
    model_critic:   s.model_critic   ?? env.MODEL_CRITIC   ?? "claude-opus-5",
    acv_usd:        s.acv_usd        ?? "",   // deliberately blank: theirs to type
  };
}

export async function setSetting(env, key, value) {
  await env.DB.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(key, String(value)).run();
}

/**
 * Daily spend ledger. Checked BEFORE every model call and charged after.
 * When the cap is hit the app degrades to cached mode with a visible banner —
 * it never errors, because a panel is explicitly invited to run this
 * themselves after the call and a dead URL reads as a broken build.
 */
export async function makeBudget(env) {
  const cap = Number(env.DAILY_USD_CAP || "5");
  const day = today();
  const settings = await getSettings(env);
  const row = await env.DB.prepare("SELECT spend_usd, calls, searches FROM budget WHERE day=?")
    .bind(day).first();
  let spend = row?.spend_usd ?? 0;

  return {
    cap,
    day,
    searchUsd: Number(settings.search_usd || 0),
    spent: () => spend,
    remaining: () => Math.max(0, cap - spend),
    live: () => spend < cap,
    async charge(usd, searches = 0) {
      spend += usd;
      await env.DB.prepare(
        `INSERT INTO budget(day, spend_usd, calls, searches) VALUES(?,?,1,?)
         ON CONFLICT(day) DO UPDATE SET
           spend_usd = spend_usd + excluded.spend_usd,
           calls     = calls + 1,
           searches  = searches + excluded.searches`
      ).bind(day, usd, searches).run();
    },
  };
}

export async function upsertAccount(env, { domain, name, region, last_touched_at, owner, source }) {
  await env.DB.prepare(
    `INSERT INTO accounts(domain, name, region, last_touched_at, owner, source)
     VALUES(?,?,?,?,?,?)
     ON CONFLICT(domain) DO UPDATE SET
       name            = COALESCE(excluded.name, accounts.name),
       region          = COALESCE(excluded.region, accounts.region),
       last_touched_at = COALESCE(excluded.last_touched_at, accounts.last_touched_at),
       owner           = COALESCE(excluded.owner, accounts.owner)`
  ).bind(domain, name || null, region || null, last_touched_at || null, owner || null, source || "upload").run();
  return env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
}

export async function latestAssessment(env, accountId) {
  return env.DB.prepare(
    "SELECT * FROM assessments WHERE account_id=? ORDER BY run_at DESC, id DESC LIMIT 1"
  ).bind(accountId).first();
}

export async function saveAssessment(env, accountId, result) {
  const a = result.assessment;
  const res = await env.DB.prepare(
    `INSERT INTO assessments
      (account_id, status, txn_min, txn_mid, txn_max, confidence, floor_verdict,
       abstained, abstain_reason, method, cost_usd, latency_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    accountId, a.status, a.txn_min ?? null, a.txn_mid ?? null, a.txn_max ?? null,
    a.confidence ?? null, null, a.abstained ?? 0, a.abstain_reason ?? null,
    a.method ?? null, a.cost_usd ?? 0, a.latency_ms ?? 0
  ).run();
  const assessmentId = res.meta.last_row_id;

  const stmts = [];
  for (const e of result.evidence || []) {
    stmts.push(env.DB.prepare(
      `INSERT INTO evidence(assessment_id, field, value, source_url, source_title, method, confidence, verdict, critic_note)
       VALUES(?,?,?,?,?,?,?,?,?)`
    ).bind(assessmentId, e.field, String(e.value).slice(0, 500), e.source_url || null,
           e.source_title || null, e.method || null, e.confidence ?? null,
           e.verdict || null, (e.critic_note || "").slice(0, 400)));
  }
  for (const t of result.traces || []) {
    stmts.push(env.DB.prepare(
      `INSERT INTO traces(assessment_id, step, model, effort, input_tokens, output_tokens,
        cache_read, cache_write, searches, cost_usd, latency_ms, stop_reason, note)
       VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(assessmentId, t.step, t.model, t.effort || null, t.input_tokens, t.output_tokens,
           t.cache_read, t.cache_write, t.searches, t.cost_usd, t.latency_ms,
           t.stop_reason || null, t.note || null));
  }
  // Signals are per-account, refreshed on each run.
  stmts.push(env.DB.prepare("DELETE FROM signals WHERE account_id=?").bind(accountId));
  for (const s of result.signals || []) {
    stmts.push(env.DB.prepare(
      `INSERT INTO signals(account_id, assessment_id, kind, description, url, observed_at, weight)
       VALUES(?,?,?,?,?,?,?)`
    ).bind(accountId, assessmentId, s.kind || "other", String(s.description).slice(0, 300),
           s.url || null, s.observed_at || null, s.weight ?? 0.5));
  }
  if (stmts.length) await env.DB.batch(stmts);

  if (result.company_name || result.region) {
    await env.DB.prepare(
      `UPDATE accounts SET name=COALESCE(name,?), region=COALESCE(region, NULLIF(?,'UNKNOWN')) WHERE id=?`
    ).bind(result.company_name || null, result.region || "UNKNOWN", accountId).run();
  }
  return assessmentId;
}

export async function getSignals(env, accountId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM signals WHERE account_id=? ORDER BY observed_at DESC"
  ).bind(accountId).all();
  return results || [];
}

export async function getEvidence(env, assessmentId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM evidence WHERE assessment_id=? ORDER BY id"
  ).bind(assessmentId).all();
  return results || [];
}

export async function getTraces(env, assessmentId) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM traces WHERE assessment_id=? ORDER BY id"
  ).bind(assessmentId).all();
  return results || [];
}

/** Every account with its most recent assessment, for the queue. */
export async function queueRows(env) {
  const { results } = await env.DB.prepare(`
    SELECT a.id, a.domain, a.name, a.region, a.last_touched_at, a.owner,
           s.id AS assessment_id, s.run_at, s.status, s.txn_min, s.txn_mid, s.txn_max,
           s.confidence, s.abstained, s.abstain_reason, s.method, s.cost_usd, s.latency_ms
    FROM accounts a
    LEFT JOIN assessments s ON s.id = (
      SELECT id FROM assessments WHERE account_id = a.id ORDER BY run_at DESC, id DESC LIMIT 1
    )
    ORDER BY a.domain
  `).all();
  return results || [];
}

export async function allSignals(env) {
  const { results } = await env.DB.prepare("SELECT * FROM signals").all();
  const map = new Map();
  for (const s of results || []) {
    if (!map.has(s.account_id)) map.set(s.account_id, []);
    map.get(s.account_id).push(s);
  }
  return map;
}
