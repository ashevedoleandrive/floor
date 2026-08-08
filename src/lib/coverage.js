/**
 * Coverage analysis.
 *
 * Floor's honest limitation is coverage, not accuracy: it answers confidently
 * for merchants that publish figures, and abstains for those that do not.
 * `sources.js` carries hand-authored coverage ratings (strong/partial/weak/
 * none) for the source registry, which is fine as editorial judgement about
 * sources that are not connected yet. It is not fine as a stand-in for what
 * Floor has actually measured, because everything else in this product
 * refuses to assert what it has not measured.
 *
 * This file computes MEASURED coverage from the assessments that actually ran
 * (query D1, nothing guessed), and separately reports PROJECTED coverage:
 * what an unconnected source in the SOURCES registry would plausibly move,
 * expressed against the measured abstain causes rather than as a generic
 * claim. The two are never mixed into one number.
 *
 * No model runs in this file. Same rule as scoring.js: the arithmetic that
 * decides what the data shows belongs in code, not in a prompt.
 */

import { REGIONS, SOURCES, loadSourceRules, classifySource, TIERS } from "./sources.js";
import { queueRows, getSettings } from "./db.js";

// Below this many assessed accounts, a percentage is noise dressed as a fact.
// Chosen deliberately conservative: the brief that forced this file named 2
// accounts as an example of "too few to say anything", and 5 is the next
// round number above that with headroom, not a statistically derived cutoff.
// Below it we report the raw counts and withhold the percentage.
const MIN_SAMPLE = 5;

const REGION_LABEL = {
  NORTHAMERICA: "North America",
  EUROPE: "Europe",
  APAC: "APAC",
  LATAM: "LATAM",
  AMEA: "AMEA",
};

/* ===========================================================================
 * Abstain-cause taxonomy.
 *
 * The pipeline does not store WHY it abstained as a structured column. It
 * stores one free-text `abstain_reason` string, which is the concatenation
 * (joined with "; ") of up to three sources, in this fixed order, from
 * pipeline.js `finalise()`:
 *
 *   1. the extractor's or critic's own free-text rationale (est.abstain_reason
 *      / cr.abstain_reason), present only when the extractor abstained itself
 *      or the critic rejected / force-abstained the whole estimate
 *   2. the LITERAL string "no surviving claim measures purchase or
 *      transaction volume", present whenever no claim of field txn_volume,
 *      gmv, orders or revenue survived critic review with verdict "supported"
 *   3. the LITERAL string "no usable volume figure", present when the
 *      extractor did not abstain but produced no usable number anyway
 *   4. the LITERAL string "disclosed figures disagree by more than two
 *      orders of magnitude", present only for a direct_count estimate whose
 *      min/max disagree wildly
 *
 * Those three literal strings are fixed by the code and never vary. That is
 * the only reason categorisation below is honest rather than guessed: we are
 * matching on code-emitted constants, not parsing model prose. The one piece
 * of real inference is distinguishing "the extractor itself had nothing" from
 * "the extractor had something and the critic took it away": when string #2
 * is present WITHOUT any leftover free text, est.abstain was false going in
 * (the extractor did not self-abstain), so the only way hasVolumeEvidence
 * still ended up false is that a volume claim existed and the critic marked
 * it unsupported, or downgraded it below "supported". Verified against
 * production data: assessment id 10 has this exact signature (abstain_reason
 * is the literal string alone, method still shows a computed GMV-derived
 * range because that derivation runs off the extractor's own estimate object,
 * not off the surviving-claims list) with 6 evidence rows still stored for
 * it, i.e. the critic did leave some claims standing, just not the ones that
 * would have counted as volume evidence.
 *
 * `pipeline_failure` is not a text match at all: it is assessments.status =
 * 'error', which pipeline.js sets only via failedAssessment() when the
 * research or extract model call itself failed (web search returned
 * nothing, or the extractor's structured output did not parse). That is a
 * clean, structured signal and is checked before any string matching.
 * ======================================================================== */

const FIXED_NO_VOLUME = "no surviving claim measures purchase or transaction volume";
const FIXED_WIDE_RANGE = "disclosed figures disagree by more than two orders of magnitude";
const FIXED_NO_NUMBER = "no usable volume figure";

export const ABSTAIN_CAUSES = {
  pipeline_failure: {
    label: "Research or extraction itself failed",
    phrase: "the research step itself failed (search or extraction), before there was anything to judge",
  },
  no_evidence_at_all: {
    label: "No disclosed volume evidence found",
    phrase: "no disclosed volume evidence was found at all",
  },
  evidence_dropped_by_critic: {
    label: "Evidence existed but the critic would not let it stand",
    phrase: "volume evidence was found but did not survive adversarial review",
  },
  estimate_rejected_despite_evidence: {
    label: "Evidence survived, but the estimate built on it was rejected",
    phrase: "supported volume evidence existed, but the estimate built from it was rejected",
  },
  range_too_wide: {
    label: "Disclosed figures disagreed too widely to resolve",
    phrase: "the disclosed figures disagreed by more than two orders of magnitude",
  },
  no_usable_number: {
    label: "No usable number came out of an attempted estimate",
    phrase: "an estimate was attempted but produced no usable number",
  },
  other: {
    label: "Abstained for an uncategorised reason",
    phrase: "abstained for a reason this analysis could not categorise",
  },
};

/** Classify one assessment row's abstain cause. Returns null if it did not abstain. */
export function classifyAbstainReason(row) {
  if (row.status === "error") return "pipeline_failure";
  if (!Number(row.abstained)) return null;

  const reason = row.abstain_reason || "";
  if (!reason) return "other";
  if (reason.includes(FIXED_WIDE_RANGE)) return "range_too_wide";

  if (reason.includes(FIXED_NO_VOLUME)) {
    const remainder = reason
      .replace(FIXED_NO_VOLUME, "")
      .replace(FIXED_NO_NUMBER, "")
      .replace(/^[;.\s]+|[;.\s]+$/g, "")
      .trim();
    return remainder ? "no_evidence_at_all" : "evidence_dropped_by_critic";
  }

  if (reason.includes(FIXED_NO_NUMBER)) return "no_usable_number";

  // Free text with no fixed marker at all means hasVolumeEvidence was TRUE:
  // a claim measuring volume survived critic review as "supported", yet the
  // estimate itself was still rejected, either by the critic's
  // estimate_verdict = "reject" path or because the extractor set
  // derivation = "none" on its own despite having evidence (observed live:
  // the Etsy row where GMS was found and survived, but the extractor
  // declined to convert it rather than deriving decisively as instructed).
  return "estimate_rejected_despite_evidence";
}

/**
 * Derivation mix. Like the abstain cause, this is not a stored column: it is
 * read off the `method` text via one fixed marker. `finalise()` in
 * pipeline.js writes "derived from $<gmv> ... average order value" ONLY on
 * the from_gmv_with_aov path (see the `derivedNote` template literal). No
 * other code path in the pipeline ever writes that substring, so its
 * presence is a reliable, deterministic signal rather than a guess. Its
 * absence on a non-abstained row means the estimate came from a disclosed
 * count instead.
 */
function classifyDerivation(method) {
  if (!method) return "unknown";
  return method.includes("derived from $") ? "from_gmv_with_aov" : "disclosed_count";
}

function median(nums) {
  const arr = nums.filter((n) => n != null && Number.isFinite(n)).slice().sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : Number(((arr[mid - 1] + arr[mid]) / 2).toFixed(3));
}

/** A percentage is only reported once the denominator clears MIN_SAMPLE.
 *  Below that, callers get null back and must show the raw counts instead. */
function pctOrNull(num, den, min = MIN_SAMPLE) {
  if (!den || den < min) return null;
  return Number(((num / den) * 100).toFixed(1));
}

function tallyBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (key == null) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

async function evidenceForAssessments(env, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT assessment_id, field, source_url FROM evidence WHERE assessment_id IN (${placeholders})`
  ).bind(...ids).all();
  return results || [];
}

/** Build the measured half for one set of account+assessment rows (one region, or all of them). */
function buildMeasured(rows, evidenceRows, rules, fallbackWeight) {
  const total = rows.length;
  const assessedRows = rows.filter((r) => r.assessment_id);
  const assessed = assessedRows.length;
  const abstainedRows = assessedRows.filter((r) => Number(r.abstained));
  const okRows = assessedRows.filter((r) => !Number(r.abstained));

  // --- abstain causes -------------------------------------------------
  const causeCounts = tallyBy(abstainedRows, classifyAbstainReason);
  const abstain_causes = {};
  for (const [key, count] of causeCounts) {
    abstain_causes[key] = {
      label: ABSTAIN_CAUSES[key]?.label || key,
      count,
      share_of_abstains: pctOrNull(count, abstainedRows.length, 3),
    };
  }

  // --- derivation mix, non-abstained only -----------------------------
  const derivCounts = tallyBy(okRows, (r) => classifyDerivation(r.method));
  const derivation_mix = {};
  for (const [key, count] of derivCounts) {
    derivation_mix[key] = { count, share_of_estimates: pctOrNull(count, okRows.length, 3) };
  }

  // --- evidence quality profile ---------------------------------------
  const tierCounts = tallyBy(
    evidenceRows,
    (e) => classifySource(e.source_url, rules, fallbackWeight).tier
  );
  const evidence_quality = {};
  for (const [tier, count] of tierCounts) {
    evidence_quality[tier] = {
      label: TIERS[tier]?.label || tier,
      count,
      share_of_claims: pctOrNull(count, evidenceRows.length, 3),
    };
  }

  return {
    total_accounts: total,
    assessed,
    sample_too_small: assessed < MIN_SAMPLE,
    estimated: okRows.length,
    abstained: abstainedRows.length,
    abstain_rate_pct: pctOrNull(abstainedRows.length, assessed),
    estimate_rate_pct: pctOrNull(okRows.length, assessed),
    abstain_causes,
    derivation_mix,
    median_confidence: median(okRows.map((r) => r.confidence)),
    evidence_quality,
    claims_surviving: evidenceRows.length,
  };
}

/**
 * Projected impact of each unconnected source, expressed against the measured
 * abstain causes for this region rather than as a generic claim.
 *
 * A source only counts as a plausible mover here if its own hand-authored
 * coverage.js rating for this region is "strong" or "partial". "weak" or
 * "none" is excluded deliberately: a source that is itself thin in a region
 * is not a credible fix for that region's coverage gap, and listing it would
 * be exactly the kind of unearned confidence this file exists to avoid.
 *
 * Only sources of kind "volume" can plausibly reduce a volume-abstain cause.
 * Sources of kind "timing" (Sales Navigator), "footprint" (checkout tech
 * detection) or "truth" (Salesforce) are real upgrades to other dimensions of
 * the product, but they do not supply volume evidence, so they are reported
 * separately with an explicit "does not address this" note rather than
 * folded into the same list. That distinction is the one the brief asked
 * for directly: a source that supplies disclosed volume addresses the
 * no-evidence bucket, one that supplies dated signals does not.
 */
function buildProjected(region, measured) {
  const candidates = SOURCES.filter((s) => s.status !== "connected");
  const volume_sources = [];
  const non_volume_sources = [];

  // These are the causes a fresh piece of disclosed volume evidence could
  // plausibly resolve: no evidence existed, or evidence existed but did not
  // survive review. A wide-disagreement abstain or a rejected-estimate
  // abstain is a judgement failure downstream of evidence that already
  // existed, not a coverage gap a new source closes, so those causes are
  // deliberately left out of "addressable".
  const addressableCauseKeys = ["no_evidence_at_all", "evidence_dropped_by_critic"];
  const addressableCount = addressableCauseKeys.reduce(
    (a, k) => a + (measured.abstain_causes[k]?.count || 0), 0
  );

  for (const source of candidates) {
    const level = source.coverage[region];
    if (level !== "strong" && level !== "partial") continue;

    if (source.kind === "volume") {
      volume_sources.push({
        source_id: source.id,
        source_name: source.name,
        coverage_level: level,
        cost: source.cost,
        addressable_count: addressableCount,
        addresses_causes: addressableCauseKeys.filter((k) => measured.abstain_causes[k]),
        note: `${source.name} supplies disclosed volume evidence (${level} coverage in ${REGION_LABEL[region] || region}). Against what was actually measured here, that would plausibly move ${addressableCount} of ${measured.abstained} abstained account${measured.abstained === 1 ? "" : "s"}.`,
      });
    } else {
      const why = {
        timing: "supplies dated signals, not volume evidence, so it would not move the abstain rate",
        footprint: "measures the payments footprint, not transaction volume, so it would not move the abstain rate",
        truth: "improves cool-down accuracy from real activity history, not volume evidence, so it would not move the abstain rate",
        evidence: "is a general evidence source, already reflected in what is connected today",
      }[source.kind] || "does not supply volume evidence";
      non_volume_sources.push({
        source_id: source.id,
        source_name: source.name,
        coverage_level: level,
        kind: source.kind,
        note: `${source.name} ${why}.`,
      });
    }
  }

  // Rank by how much of the region's abstain pile they would plausibly touch.
  // On a tie (common: several sources all address the same one or two
  // accounts), prefer the one whose OWN coverage rating for this region is
  // "strong" over "partial" before falling back to name order. Without that
  // tie-break, alphabetical order picked "App download and usage panel"
  // ahead of "EU statutory registries" for Europe purely because A sorts
  // before E, even though the registries are rated strong here and the app
  // panel only partial. Strength of coverage is a real, already-computed
  // signal; alphabetical order is not.
  const levelRank = { strong: 2, partial: 1 };
  volume_sources.sort((a, b) =>
    b.addressable_count - a.addressable_count ||
    (levelRank[b.coverage_level] || 0) - (levelRank[a.coverage_level] || 0) ||
    a.source_name.localeCompare(b.source_name)
  );

  return { volume_sources, non_volume_sources };
}

/**
 * The headline sentence. Composed from the numbers just computed, not from a
 * template string per region: the wording branches on what the data actually
 * shows (enough sample, dominant cause, whether a source addresses it) so it
 * cannot say something the numbers do not support.
 */
function buildHeadline(regionLabel, measured, projected) {
  if (measured.assessed === 0) {
    return `${regionLabel}: no accounts assessed yet, out of ${measured.total_accounts} in the universe. Nothing to report.`;
  }
  if (measured.sample_too_small) {
    return `${regionLabel}: only ${measured.assessed} of ${measured.total_accounts} accounts assessed so far, too few to characterise coverage.`;
  }

  let sentence = `${regionLabel}: ${measured.estimated} of ${measured.assessed} assessed produced an estimate`;

  if (measured.abstained > 0) {
    const causeEntries = Object.entries(measured.abstain_causes).sort((a, b) => b[1].count - a[1].count);
    const [topKey, topVal] = causeEntries[0];
    const allSameCause = causeEntries.length === 1;

    if (topKey === "no_evidence_at_all" && allSameCause) {
      sentence += `, ${measured.abstained} abstained for want of any disclosed volume`;
    } else if (allSameCause) {
      sentence += `, ${measured.abstained} abstained because ${ABSTAIN_CAUSES[topKey]?.phrase || topKey}`;
    } else {
      sentence += `, ${measured.abstained} abstained (mostly: ${ABSTAIN_CAUSES[topKey]?.label?.toLowerCase() || topKey}, ${topVal.count} of them)`;
    }

    const mover = projected.volume_sources.find((s) => s.addressable_count > 0);
    if (mover) {
      const phrase = mover.addressable_count >= measured.abstained
        ? `would address all ${measured.abstained}`
        : `would address ${mover.addressable_count} of them`;
      sentence += `, and ${mover.source_name} ${phrase}`;
    }
    sentence += ".";
  } else {
    sentence += ".";
  }

  return sentence;
}

/**
 * Compute the full coverage picture: measured per region and overall,
 * projected per region against the measured abstain causes, and a headline
 * sentence per region.
 *
 * Everything traces to a query against D1 run in this call. Nothing here is
 * cached, hand-authored or carried over from sources.js coverage ratings;
 * those ratings are read ONLY to build the projected half, which is clearly
 * labelled apart from measured.
 */
export async function computeCoverage(env) {
  const [rows, rules, settings] = await Promise.all([
    queueRows(env),
    loadSourceRules(env),
    getSettings(env),
  ]);
  const fallbackWeight = Number(settings.tier_unclassified_weight ?? 0.35);

  const assessedIds = rows.filter((r) => r.assessment_id).map((r) => r.assessment_id);
  const allEvidence = await evidenceForAssessments(env, assessedIds);
  const evidenceByAssessment = new Map();
  for (const e of allEvidence) {
    if (!evidenceByAssessment.has(e.assessment_id)) evidenceByAssessment.set(e.assessment_id, []);
    evidenceByAssessment.get(e.assessment_id).push(e);
  }
  const evidenceFor = (regionRows) => {
    const ids = new Set(regionRows.filter((r) => r.assessment_id).map((r) => r.assessment_id));
    const out = [];
    for (const id of ids) out.push(...(evidenceByAssessment.get(id) || []));
    return out;
  };

  const unassignedRegion = rows.filter((r) => !r.region || !REGIONS.includes(r.region));

  const regions = REGIONS.map((region) => {
    const regionRows = rows.filter((r) => r.region === region);
    const measured = buildMeasured(regionRows, evidenceFor(regionRows), rules, fallbackWeight);
    const projected = buildProjected(region, measured);
    const label = REGION_LABEL[region] || region;
    return {
      region,
      label,
      measured,
      projected,
      headline: buildHeadline(label, measured, projected),
    };
  });

  const overallMeasured = buildMeasured(rows, allEvidence, rules, fallbackWeight);
  const overallHeadline = buildHeadline("All regions", overallMeasured, {
    // Overall projection is not meaningful as a single "which source" claim
    // because coverage differs so sharply by region (SEC EDGAR helps North
    // America and nothing else, EU registries help Europe and nothing else).
    // Rather than collapse that into a misleading global recommendation, the
    // overall headline reports the measured split only and leaves sourcing
    // to the per-region sections where it is actually decidable.
    volume_sources: [],
  });

  return {
    generated_at: new Date().toISOString(),
    min_sample: MIN_SAMPLE,
    note: "measured is computed from stored assessments in D1. projected is read from the sources.js registry and is editorial judgement about unconnected sources, kept separate from measured throughout.",
    overall: {
      label: "All regions",
      measured: overallMeasured,
      headline: overallHeadline,
      accounts_with_unassigned_region: unassignedRegion.length,
    },
    regions,
  };
}
