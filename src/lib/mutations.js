/**
 * Every write an operator can perform.
 *
 * This file exists because of one bug and the audit it triggered. Disabling a
 * source rule made its row vanish, which turned a one-click action into a
 * permanent one, and the data was intact in the database the entire time. That
 * was worth nothing to the person clicking it.
 *
 * The audit that followed found twelve more of the same shape. Accounts could be
 * created and never corrected, so a wrong region silently distorted fifteen
 * percent of the score forever. `last_touched_at` fed the cool-down dimension and
 * was unreachable after creation. A mistyped gold-set figure was permanent and
 * silently corrupted the accuracy claim the whole tool's credibility rests on.
 *
 * Three rules hold here:
 *
 * 1. Nothing hard-deletes. Archiving stamps a timestamp and un-archiving clears
 *    it, so every destructive action can be undone from the interface.
 * 2. Every function returns enough to undo itself. The caller does not need to
 *    have read the row first.
 * 3. Validation refuses bad input rather than storing it. A region that is not a
 *    region, a date that is not a date, and a figure that is not a number are all
 *    rejected with a reason the screen can show.
 */

const REGIONS = ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"];
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && !Number.isNaN(Date.parse(s));

/** Thrown for anything the operator can fix by typing something else. */
export class InvalidInput extends Error {
  constructor(field, message) { super(message); this.field = field; this.invalid = true; }
}

/* ------------------------------- accounts -------------------------------- */

const ACCOUNT_FIELDS = {
  name: (v) => {
    const s = String(v ?? "").trim();
    if (s.length > 120) throw new InvalidInput("name", "Name is longer than 120 characters.");
    return s || null;
  },
  region: (v) => {
    if (v === "" || v == null) return null;
    const s = String(v).toUpperCase().replace(/[^A-Z]/g, "");
    if (!REGIONS.includes(s)) throw new InvalidInput("region", `Region must be one of ${REGIONS.join(", ")}.`);
    return s;
  },
  owner: (v) => {
    const s = String(v ?? "").trim();
    if (s.length > 60) throw new InvalidInput("owner", "Owner is longer than 60 characters.");
    return s || null;
  },
  last_touched_at: (v) => {
    if (v === "" || v == null) return null;
    const s = String(v).slice(0, 10);
    if (!isDate(s)) throw new InvalidInput("last_touched_at", "Use a date in YYYY-MM-DD form.");
    if (s > new Date().toISOString().slice(0, 10))
      throw new InvalidInput("last_touched_at", "A last-touched date cannot be in the future.");
    return s;
  },
};

/**
 * Correct an account. Returns { before, after } so the caller can offer undo by
 * simply sending `before` back.
 *
 * `region` and `last_touched_at` both feed scoring, so an edit here re-ranks the
 * queue on the next render. That consequence is stated on screen; it is not a
 * side effect the operator has to discover.
 */
export async function updateAccount(env, domain, patch) {
  const before = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  if (!before) throw new InvalidInput("domain", `No account with the domain ${domain}.`);

  const sets = [], binds = [], after = {};
  for (const [k, coerce] of Object.entries(ACCOUNT_FIELDS)) {
    if (!(k in patch)) continue;
    const v = coerce(patch[k]);
    if (v === before[k]) continue;          // no-op edits do not write, so undo stays truthful
    sets.push(`${k}=?`); binds.push(v); after[k] = v;
  }
  if (!sets.length) return { before, after: before, changed: [] };

  await env.DB.prepare(`UPDATE accounts SET ${sets.join(", ")} WHERE domain=?`).bind(...binds, domain).run();
  const row = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  return { before, after: row, changed: Object.keys(after) };
}

/** Archive, which is what "delete" means here. Reversible by unarchiveAccount. */
export async function archiveAccount(env, domain) {
  const row = await env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
  if (!row) throw new InvalidInput("domain", `No account with the domain ${domain}.`);
  if (row.archived_at) return { row, already: true };
  await env.DB.prepare("UPDATE accounts SET archived_at=? WHERE domain=?").bind(now(), domain).run();
  return { row, already: false };
}

export async function unarchiveAccount(env, domain) {
  await env.DB.prepare("UPDATE accounts SET archived_at=NULL WHERE domain=?").bind(domain).run();
  return env.DB.prepare("SELECT * FROM accounts WHERE domain=?").bind(domain).first();
}

/* ------------------------------ assessments ------------------------------ */

/**
 * Remove an assessment from scoring without destroying its trace.
 *
 * A bad run currently keeps scoring the account forever. Marking it deleted drops
 * it out of the queue's "latest assessment" join, and the previous run, if there
 * is one, takes over. The evidence and per-stage traces stay on disk, because
 * they are the audit trail and a deleted row is exactly the one somebody will
 * want to look at later.
 */
export async function deleteAssessment(env, id) {
  const row = await env.DB.prepare("SELECT * FROM assessments WHERE id=?").bind(id).first();
  if (!row) throw new InvalidInput("id", `No assessment with id ${id}.`);
  await env.DB.prepare("UPDATE assessments SET deleted_at=? WHERE id=?").bind(now(), id).run();
  const prior = await env.DB.prepare(
    "SELECT id, run_at FROM assessments WHERE account_id=? AND deleted_at IS NULL ORDER BY run_at DESC, id DESC LIMIT 1"
  ).bind(row.account_id).first();
  return { row, fellBackTo: prior || null };
}

export async function restoreAssessment(env, id) {
  await env.DB.prepare("UPDATE assessments SET deleted_at=NULL WHERE id=?").bind(id).run();
  return env.DB.prepare("SELECT * FROM assessments WHERE id=?").bind(id).first();
}

/** Every run for an account, newest first, including deleted ones. */
export async function assessmentHistory(env, accountId) {
  const { results } = await env.DB.prepare(
    `SELECT id, run_at, status, txn_min, txn_mid, txn_max, confidence, abstained,
            cost_usd, deleted_at
     FROM assessments WHERE account_id=? ORDER BY run_at DESC, id DESC`
  ).bind(accountId).all();
  return results || [];
}

/* -------------------------------- gold set -------------------------------- */

/**
 * The most dangerous object in the product.
 *
 * The accuracy number is the trust argument, so a mistyped figure does not just
 * sit there being wrong, it silently corrupts the one claim the tool makes about
 * itself. Correction and un-verification both have to exist, and both are here.
 */
export async function updateGold(env, id, patch) {
  const before = await env.DB.prepare("SELECT * FROM gold_set WHERE id=?").bind(id).first();
  if (!before) throw new InvalidInput("id", `No gold-set row with id ${id}.`);

  const sets = [], binds = [];
  if ("disclosed_value" in patch) {
    const raw = patch.disclosed_value;
    if (raw === "" || raw == null) { sets.push("disclosed_value=?"); binds.push(null); }
    else {
      const n = Number(String(raw).replace(/[,\s]/g, ""));
      if (!Number.isFinite(n) || n <= 0) throw new InvalidInput("disclosed_value", "Enter a positive number of transactions per month.");
      sets.push("disclosed_value=?"); binds.push(Math.round(n));
    }
  }
  for (const k of ["disclosed_metric", "period", "source_url", "source_note", "name"]) {
    if (!(k in patch)) continue;
    sets.push(`${k}=?`); binds.push(String(patch[k] ?? "").trim() || null);
  }
  if ("verified" in patch) {
    const on = patch.verified === true || patch.verified === 1 || patch.verified === "1";
    // Verifying without a figure and a source is how a fabricated accuracy score
    // gets built, so it is refused rather than warned about.
    if (on) {
      const value = "disclosed_value" in patch ? binds[sets.indexOf("disclosed_value=?")] : before.disclosed_value;
      const url = "source_url" in patch ? patch.source_url : before.source_url;
      if (!value) throw new InvalidInput("disclosed_value", "A row cannot be verified without a disclosed figure.");
      if (!url) throw new InvalidInput("source_url", "A row cannot be verified without the source you read it in.");
    }
    sets.push("verified=?", "verified_at=?");
    binds.push(on ? 1 : 0, on ? now() : null);
  }
  if (!sets.length) return { before, after: before, changed: [] };

  await env.DB.prepare(`UPDATE gold_set SET ${sets.join(", ")} WHERE id=?`).bind(...binds, id).run();
  const after = await env.DB.prepare("SELECT * FROM gold_set WHERE id=?").bind(id).first();
  return { before, after, changed: sets.map((s) => s.split("=")[0]) };
}

export async function addGold(env, { domain, name, disclosed_metric, source_note }) {
  const d = String(domain || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  if (!d || !d.includes(".")) throw new InvalidInput("domain", "Enter a domain, for example asos.com.");
  const dupe = await env.DB.prepare("SELECT id FROM gold_set WHERE domain=?").bind(d).first();
  if (dupe) throw new InvalidInput("domain", `${d} is already a gold-set candidate.`);
  const r = await env.DB.prepare(
    `INSERT INTO gold_set(domain, name, disclosed_metric, source_note, verified) VALUES(?,?,?,?,0)`
  ).bind(d, name || null, disclosed_metric || null, source_note || null).run();
  return env.DB.prepare("SELECT * FROM gold_set WHERE id=?").bind(r.meta.last_row_id).first();
}

export async function archiveGold(env, id, on = true) {
  await env.DB.prepare("UPDATE gold_set SET archived_at=? WHERE id=?").bind(on ? now() : null, id).run();
  return env.DB.prepare("SELECT * FROM gold_set WHERE id=?").bind(id).first();
}

/* -------------------------------- backlog --------------------------------- */

const BACKLOG_STATUS = ["idea", "building", "live"];

/** Moving a card between statuses is the entire point of a backlog, and it did
 *  not exist. */
export async function updateCard(env, id, patch) {
  const before = await env.DB.prepare("SELECT * FROM backlog WHERE id=?").bind(id).first();
  if (!before) throw new InvalidInput("id", `No backlog card with id ${id}.`);

  const sets = [], binds = [];
  if ("status" in patch) {
    const s = String(patch.status || "").toLowerCase();
    if (!BACKLOG_STATUS.includes(s)) throw new InvalidInput("status", `Status must be one of ${BACKLOG_STATUS.join(", ")}.`);
    sets.push("status=?"); binds.push(s);
  }
  for (const k of ["area", "title", "owner", "gap", "metric", "link"]) {
    if (!(k in patch)) continue;
    const v = String(patch[k] ?? "").trim();
    if (k === "title" && !v) throw new InvalidInput("title", "A card needs a title.");
    sets.push(`${k}=?`); binds.push(v || null);
  }
  if (!sets.length) return { before, after: before, changed: [] };
  sets.push("updated_at=?"); binds.push(now());

  await env.DB.prepare(`UPDATE backlog SET ${sets.join(", ")} WHERE id=?`).bind(...binds, id).run();
  const after = await env.DB.prepare("SELECT * FROM backlog WHERE id=?").bind(id).first();
  return { before, after, changed: sets.map((s) => s.split("=")[0]).filter((k) => k !== "updated_at") };
}

export async function archiveCard(env, id, on = true) {
  await env.DB.prepare("UPDATE backlog SET archived_at=? WHERE id=?").bind(on ? now() : null, id).run();
  return env.DB.prepare("SELECT * FROM backlog WHERE id=?").bind(id).first();
}

/* ----------------------------- source rules ------------------------------- */

/**
 * Rules are matched in order and the first match wins, so order is not cosmetic:
 * it decides which tier a claim is graded at. It could only be set at creation,
 * which meant a rule in the wrong place could only be fixed by deleting and
 * recreating it.
 */
export async function reorderRules(env, ids) {
  if (!Array.isArray(ids) || !ids.length) throw new InvalidInput("order", "Send the rule ids in their new order.");
  const stmts = ids.map((id, i) =>
    env.DB.prepare("UPDATE source_rules SET position=?, updated_at=? WHERE id=?").bind((i + 1) * 10, now(), Number(id)));
  await env.DB.batch(stmts);
  const { results } = await env.DB.prepare("SELECT id, position FROM source_rules ORDER BY position").all();
  return results || [];
}

/* -------------------------------- settings -------------------------------- */

/**
 * Settings re-grade stored work on the next render, so every change is recorded
 * with what it was before. Without that, "why did the queue change" has no
 * answer, and the operator is left doubting the tool rather than the setting.
 */
export async function setSettingLogged(env, key, value) {
  const cur = await env.DB.prepare("SELECT value FROM settings WHERE key=?").bind(key).first();
  const old = cur?.value ?? null;
  if (String(old) === String(value)) return { key, old, value, changed: false };
  await env.DB.prepare(
    "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value"
  ).bind(key, String(value)).run();
  await env.DB.prepare("INSERT INTO settings_log(key, old_value, new_value) VALUES(?,?,?)")
    .bind(key, old, String(value)).run();
  return { key, old, value, changed: true };
}

export async function settingsHistory(env, limit = 30) {
  const { results } = await env.DB.prepare(
    "SELECT key, old_value, new_value, changed_at FROM settings_log ORDER BY id DESC LIMIT ?"
  ).bind(limit).all();
  return results || [];
}
