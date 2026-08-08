/**
 * Deterministic scoring. No model runs in this file, on purpose.
 *
 * The line to say out loud: the model reads and cites, the arithmetic stays in
 * code. Every number below is reproducible from the same inputs, so "the
 * numbers are off sometimes" cannot be true of the ranking itself — only of the
 * evidence feeding it, which is exactly what the critic and the eval measure.
 */

// Yuno's stated regional priority: North America, then Europe, then APAC.
// LATAM is described as saturated and commercially limited.
export const REGION_WEIGHT = {
  NORTHAMERICA: 1.00,
  EUROPE:       0.80,
  APAC:         0.65,
  AMEA:         0.50,
  LATAM:        0.35,
  UNKNOWN:      0.55,
};

export const BANDS = {
  WORK:           { key: "work",           label: "Work now",        order: 0 },
  SOON:           { key: "soon",           label: "Queue next",      order: 1 },
  NEEDS_EVIDENCE: { key: "needs_evidence", label: "Needs evidence",  order: 2 },
  SUPPRESSED:     { key: "suppressed",     label: "Cooling down",    order: 3 },
  BELOW:          { key: "below",          label: "Below floor",     order: 4 },
};

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function normaliseDomain(raw) {
  if (!raw) return null;
  let d = String(raw).trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d) ? d : null;
}

/** Fit: does the merchant clear the transactions-per-month floor? */
export function scoreFit({ txn_min, txn_mid, txn_max, abstained }, floor) {
  if (abstained || txn_mid == null) {
    return { verdict: "unknown", fit: null };
  }
  if (txn_min != null && txn_min >= floor) {
    // Comfortably above. Reward scale, but with diminishing returns: a merchant
    // at 50x the floor is not 50x more valuable than one at 5x.
    const ratio = Math.max(txn_mid / floor, 1);
    return { verdict: "clears", fit: clamp(0.70 + 0.30 * (Math.log10(ratio) / 1.5), 0.70, 1) };
  }
  if (txn_max != null && txn_max >= floor) {
    // The range straddles the floor. Real, but unresolved — worth a cheap
    // human check before it eats 30 minutes of research.
    const ratio = clamp(txn_mid / floor, 0, 1);
    return { verdict: "borderline", fit: clamp(0.30 + 0.35 * ratio, 0.30, 0.65) };
  }
  return { verdict: "below", fit: 0 };
}

/**
 * Timing: is there a dated reason to touch this account NOW?
 * Signals decay — a PSP migration announced 14 months ago is not a trigger.
 */
export function scoreTiming(signals, now = new Date()) {
  if (!signals?.length) return { timing: 0, driver: null };
  let total = 0, best = null, bestVal = 0;
  for (const s of signals) {
    const when = s.observed_at ? new Date(s.observed_at) : null;
    const ageDays = when && !isNaN(when) ? (now - when) / 86400000 : 365;
    const decay = Math.exp(-Math.max(ageDays, 0) / 120); // ~4 month half-life-ish
    const v = (s.weight ?? 1) * decay;
    total += v;
    if (v > bestVal) { bestVal = v; best = s; }
  }
  return { timing: clamp(total / 2.0, 0, 1), driver: best };
}

/**
 * Cool-down. Their words: "the TAM is finite, so re-hitting the same accounts
 * hurts." This is the half of gap 01 that a pure fit scorer ignores.
 * The window is a tunable, not a hardcoded policy — theirs to set, not ours.
 */
export function scoreCooldown(lastTouchedAt, cooldownDays, now = new Date()) {
  if (!lastTouchedAt) {
    return { state: "never_touched", daysSince: null, until: null, penalty: 0 };
  }
  const last = new Date(lastTouchedAt);
  if (isNaN(last)) return { state: "never_touched", daysSince: null, until: null, penalty: 0 };
  const daysSince = Math.floor((now - last) / 86400000);
  if (daysSince < cooldownDays) {
    const until = new Date(last.getTime() + cooldownDays * 86400000);
    return { state: "suppressed", daysSince, until: until.toISOString().slice(0, 10), penalty: 1 };
  }
  return { state: "eligible", daysSince, until: null, penalty: 0 };
}

/** Compose the three dimensions into one ranked row. */
export function scoreAccount({ assessment, signals, account, settings }) {
  const floor = Number(settings.floor_txn ?? 100000);
  const cooldownDays = Number(settings.cooldown_days ?? 45);
  const now = new Date();

  const { verdict, fit } = scoreFit(assessment, floor);
  const { timing, driver } = scoreTiming(signals, now);
  const cool = scoreCooldown(account.last_touched_at, cooldownDays, now);
  const regionW = REGION_WEIGHT[(account.region || "UNKNOWN").toUpperCase()] ?? REGION_WEIGHT.UNKNOWN;
  const conf = assessment.confidence ?? 0.5;

  // Confidence dampens, it does not decide. A high-fit account we are unsure
  // about still outranks a low-fit account we are certain about.
  const base = fit == null ? 0 : (0.55 * fit + 0.30 * timing + 0.15 * regionW);
  const total = fit == null ? 0 : base * (0.6 + 0.4 * conf);

  let band;
  if (assessment.abstained || fit == null)      band = BANDS.NEEDS_EVIDENCE;
  else if (verdict === "below")                 band = BANDS.BELOW;
  else if (cool.state === "suppressed")         band = BANDS.SUPPRESSED;
  else if (verdict === "clears" && total >= 0.55) band = BANDS.WORK;
  else                                          band = BANDS.SOON;

  const reason = buildReason({ verdict, fit, timing, driver, cool, regionW, account, assessment, conf });

  return {
    fit_score: fit,
    timing_score: timing,
    cooldown_state: cool.state,
    cooldown_until: cool.until,
    cooldown_days_since: cool.daysSince,
    floor_verdict: verdict,
    total_score: Number(total.toFixed(4)),
    band: band.key,
    band_label: band.label,
    band_order: band.order,
    rank_reason: reason,
    region_weight: regionW,
  };
}

function fmt(n) {
  if (n == null) return "unknown";
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "k";
  return String(n);
}

function buildReason({ verdict, timing, driver, cool, account, assessment, conf }) {
  const bits = [];
  if (assessment.abstained) {
    bits.push(`Abstained: ${assessment.abstain_reason || "evidence too thin to estimate"}`);
    return bits.join(" · ");
  }
  if (verdict === "clears")      bits.push(`Clears floor (~${fmt(assessment.txn_mid)} txn/mo)`);
  else if (verdict === "borderline") bits.push(`Straddles floor (${fmt(assessment.txn_min)}–${fmt(assessment.txn_max)})`);
  else if (verdict === "below")  bits.push(`Below floor (~${fmt(assessment.txn_mid)} txn/mo)`);

  if (cool.state === "suppressed") {
    bits.push(`touched ${cool.daysSince}d ago, eligible ${cool.until}`);
  } else if (cool.state === "never_touched") {
    bits.push("never touched");
  }
  if (driver) bits.push(`signal: ${driver.description}`.slice(0, 90));
  else if (timing === 0) bits.push("no dated trigger");

  if (account.region) bits.push(account.region);
  bits.push(`confidence ${(conf * 100).toFixed(0)}%`);
  return bits.join(" · ");
}

export function rankQueue(rows) {
  return [...rows].sort((a, b) =>
    a.band_order - b.band_order ||
    (b.total_score ?? 0) - (a.total_score ?? 0) ||
    String(a.domain).localeCompare(String(b.domain))
  );
}

export { fmt as formatCount };
