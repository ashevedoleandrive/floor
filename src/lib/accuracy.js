/**
 * Accuracy: what the tool knows about its own error rate, and what it would
 * have to check next to know more.
 *
 * Three things live here.
 *
 * 1. SEGMENTS. A single accuracy percentage is not actionable. "85% accurate"
 *    tells an operator nothing they can spend money on. "94% on directly
 *    disclosed counts, 71% on estimates derived from dollar volume, and never
 *    measured in LATAM" tells them exactly where the next investment goes.
 *
 * 2. CALIBRATION. Confidence is a claim the tool makes about itself, and an
 *    unchecked claim is decoration. Calibration asks: when it said 90%, how
 *    often was the truth actually inside its range? Until that is measured, the
 *    confidence number is an opinion.
 *
 * 3. WHAT TO CHECK NEXT. Verification is human work, so a suggester that always
 *    has something to suggest is a chore generator. This one is allowed to
 *    return nothing, and usually should. A candidate only surfaces when checking
 *    it would change what is known: it must already have a prediction to grade,
 *    and it must cover a dimension the verified set is currently blind to.
 */

const REGION_LABEL = {
  NORTHAMERICA: "North America", EUROPE: "Europe", APAC: "APAC",
  LATAM: "LATAM", AMEA: "AMEA", UNKNOWN: "Unassigned",
};

/** Magnitude bucket, so the gold set is not all giants or all long tail. */
function band(n) {
  if (!n || n <= 0) return null;
  if (n >= 50e6) return "over_50m";
  if (n >= 5e6) return "5m_to_50m";
  if (n >= 5e5) return "500k_to_5m";
  return "under_500k";
}
const BAND_LABEL = {
  over_50m: "above 50M/mo", "5m_to_50m": "5M to 50M/mo",
  "500k_to_5m": "500k to 5M/mo", under_500k: "under 500k/mo",
};
const DERIV_LABEL = {
  direct_count: "Read off a disclosure",
  from_gmv_with_aov: "Derived from dollar volume",
};

/** Group eval items and report a rate per group, refusing to rate tiny samples. */
function segment(items, keyFn, labelFn, minSample = 2) {
  const groups = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(it);
  }
  return [...groups].map(([k, rows]) => {
    const scored = rows.filter((r) => !r.abstained);
    const enough = scored.length >= minSample;
    return {
      key: k,
      label: labelFn(k),
      n: rows.length,
      scored: scored.length,
      abstained: rows.filter((r) => r.abstained).length,
      // Below the sample floor a rate is noise wearing a percentage sign, so it
      // is withheld rather than printed small. Same rule the coverage map uses.
      sample_too_small: !enough,
      floor_correct: enough ? scored.filter((r) => r.floor_correct).length : null,
      in_band: enough ? scored.filter((r) => r.in_band).length : null,
    };
  }).sort((a, b) => b.n - a.n);
}

/**
 * Calibration. Buckets predictions by the confidence claimed at the time and
 * reports how often the truth actually landed inside the range.
 *
 * A well-calibrated tool sits near the diagonal: 90% confidence should be right
 * about 90% of the time. Above it, the tool is underselling itself. Below it,
 * every score on every page is overstated and should be discounted.
 */
export function calibration(items) {
  const buckets = [
    { key: "high", label: "0.85 and above", lo: 0.85, hi: 1.01 },
    { key: "mid", label: "0.70 to 0.85", lo: 0.70, hi: 0.85 },
    { key: "low", label: "below 0.70", lo: 0, hi: 0.70 },
  ];
  const scored = items.filter((i) => !i.abstained && i.confidence != null);
  return buckets.map((b) => {
    const rows = scored.filter((i) => i.confidence >= b.lo && i.confidence < b.hi);
    return {
      ...b,
      n: rows.length,
      in_band: rows.length ? rows.filter((r) => r.in_band).length : null,
      claimed: rows.length ? rows.reduce((a, r) => a + r.confidence, 0) / rows.length : null,
      sample_too_small: rows.length < 3,
    };
  });
}

/** Every breakdown of one eval run. */
export function segmentEval(items) {
  return {
    by_derivation: segment(items, (i) => i.derivation, (k) => DERIV_LABEL[k] || k),
    by_region: segment(items, (i) => i.region, (k) => REGION_LABEL[k] || k),
    by_magnitude: segment(items, (i) => band(i.truth), (k) => BAND_LABEL[k] || k),
    calibration: calibration(items),
  };
}

/**
 * What to verify next, and why.
 *
 * The rule that keeps this from becoming busywork: **a candidate must add a
 * dimension the verified set does not already cover.** A ninth North American
 * direct-count filer when eight are already verified teaches nothing, so it
 * never appears. When the set is saturated this returns an empty list and the
 * page says so, which is the honest outcome and the whole point.
 *
 * @returns {{suggestions: Array, saturated: boolean, blind: Array}}
 */
export function suggestGold({ goldRows, queueRows, limit = 3 }) {
  const byDomain = new Map(queueRows.map((r) => [r.domain, r]));

  // What the verified set already covers.
  const covered = { region: new Set(), derivation: new Set(), magnitude: new Set() };
  for (const g of goldRows) {
    if (!g.verified) continue;
    const a = byDomain.get(g.domain);
    if (!a) continue;
    if (a.region) covered.region.add(a.region);
    if (a.derivation) covered.derivation.add(a.derivation);
    const b = band(g.disclosed_value);
    if (b) covered.magnitude.add(b);
  }

  const candidates = [];
  for (const g of goldRows) {
    if (g.verified || g.archived_at) continue;
    const a = byDomain.get(g.domain);
    // No prediction means nothing to grade, so verifying it buys nothing today.
    if (!a || !a.assessment_id || a.abstained) continue;

    const gains = [];
    if (a.region && !covered.region.has(a.region))
      gains.push(`first ${REGION_LABEL[a.region] || a.region} row in the gold set`);
    if (a.derivation && !covered.derivation.has(a.derivation))
      gains.push(`first check of a figure ${a.derivation === "direct_count" ? "read off a disclosure" : "derived from dollar volume"}`);
    const b = band(a.txn_mid);
    if (b && !covered.magnitude.has(b))
      gains.push(`first row ${BAND_LABEL[b]}`);

    if (!gains.length) continue;   // adds nothing, so it is never shown
    candidates.push({
      domain: g.domain,
      name: a.name || g.domain,
      gold_id: g.id,
      predicted: a.txn_mid,
      confidence: a.confidence,
      disclosed_metric: g.disclosed_metric,
      source_note: g.source_note,
      gains,
      // More dimensions unlocked is a better use of the next five minutes.
      score: gains.length,
    });
  }

  candidates.sort((a, b) => b.score - a.score || b.predicted - a.predicted);

  // Dimensions nothing in the candidate pool can reach. Naming these is more
  // useful than silence: it says the gap is in the data, not in the effort.
  const reachable = new Set(candidates.flatMap((c) => c.gains));
  const blind = [];
  for (const r of ["LATAM", "AMEA", "APAC", "EUROPE", "NORTHAMERICA"]) {
    if (covered.region.has(r)) continue;
    if ([...reachable].some((g) => g.includes(REGION_LABEL[r]))) continue;
    blind.push(REGION_LABEL[r]);
  }

  return {
    suggestions: candidates.slice(0, limit),
    saturated: candidates.length === 0,
    blind,
  };
}

/**
 * Source links for a gold-set row, pulled from evidence Floor already found.
 *
 * The distinction that keeps this honest: **handing over the link is navigation,
 * pre-filling the figure would be verification.** A human still opens the
 * primary document and reads the number with their own eyes, which is the only
 * step the tool cannot legitimately perform on its own behalf. Removing the
 * hunt for the filing costs nothing epistemically and is the difference between
 * five minutes a row and forty.
 *
 * Primary filings sort first, because that is where the disclosed figure lives.
 */
export async function goldSources(env, domain, disclosedMetric = "") {
  const { results } = await env.DB.prepare(`
    SELECT e.source_url, e.source_title, e.field, e.value
    FROM evidence e
    JOIN assessments s ON s.id = e.assessment_id
    JOIN accounts a    ON a.id = s.account_id
    WHERE a.domain = ? AND s.deleted_at IS NULL AND e.source_url IS NOT NULL
    ORDER BY e.id
  `).bind(domain).all();

  // Which stored field answers the metric this row is asking for. The gold row
  // says what to look for ("total orders / quarter"); the evidence is tagged
  // with what it measures. Matching the two picks the one document worth
  // opening first, instead of handing over every link Floor ever followed.
  const want = String(disclosedMetric || "").toLowerCase();
  const wanted = new Set();
  if (/order|transaction|room night|trip|booking/.test(want)) { wanted.add("orders"); wanted.add("txn_volume"); }
  if (/gmv|gms|volume|sales|revenue|net sales/.test(want)) { wanted.add("gmv"); wanted.add("revenue"); }
  if (/customer|buyer|user|member/.test(want)) wanted.add("customers");

  const seen = new Set();
  const out = [];
  for (const r of results || []) {
    let host = "";
    try { host = new URL(r.source_url).host.replace(/^www\./, ""); } catch { continue; }
    if (seen.has(r.source_url)) continue;
    seen.add(r.source_url);
    const primary = /(^|\.)investors?\./.test(host) || /sec\.gov|companieshouse|bundesanzeiger|\.kvk\./.test(host)
      || /(^|\.)ir\./.test(host) || /(^|\.)about\./.test(host);
    out.push({
      url: r.source_url, host, title: r.source_title || null, field: r.field, primary,
      // Does this document measure the thing being verified.
      answers: wanted.has(r.field),
    });
  }

  // Best first: the document that measures the right thing and is a primary
  // source. Everything else stays available but quiet.
  out.sort((a, b) =>
    Number(b.answers) - Number(a.answers) ||
    Number(b.primary) - Number(a.primary));
  return out.slice(0, 4);
}
