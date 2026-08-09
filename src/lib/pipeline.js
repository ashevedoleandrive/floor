import { Model } from "./anthropic.js";
import { primarySources } from "./edgar.js";
import { relevantWindows } from "./truth.js";

/**
 * Three stages, three different jobs, deliberately not one prompt:
 *
 *   research  Sonnet 5 + web_search   gather cited public evidence
 *   extract   Sonnet 5 + json_schema  turn prose into claims, each with a URL
 *   critic    Opus 5   + json_schema  try to REFUTE each claim; drop the weak
 *
 * The scorer that follows is plain code (scoring.js). The model reads and
 * cites; the arithmetic stays in code. That split is the whole answer to
 * "we built something and the numbers are off sometimes".
 */

const CLAIM_FIELDS = [
  "txn_volume", "gmv", "orders", "revenue", "customers",
  "psp", "apm", "market", "employees", "traffic", "other",
];

const REGIONS = ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA", "UNKNOWN"];

// Every field required + sentinels for "unknown". Optional fields are where
// structured-output schemas quietly fail; this shape has no optionality.
const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["company_name", "region", "estimate", "claims", "psps", "apms", "markets", "signals"],
  properties: {
    company_name: { type: "string" },
    region: { type: "string", enum: REGIONS },
    estimate: {
      type: "object",
      additionalProperties: false,
      required: ["abstain", "abstain_reason", "derivation", "txn_min", "txn_mid", "txn_max",
                 "gmv_annual_usd", "aov_low", "aov_high", "aov_basis", "method", "reasoning"],
      properties: {
        abstain: { type: "boolean" },
        abstain_reason: { type: "string" },
        // How the number was arrived at. The floor question is answerable from
        // dollar volume plus a plausible order-value band, even when a merchant
        // never publishes an order count, which most do not.
        derivation: { type: "string", enum: ["direct_count", "from_gmv_with_aov", "none"] },
        txn_min: { type: "integer" },   // -1 when abstaining or deriving from GMV
        txn_mid: { type: "integer" },
        txn_max: { type: "integer" },
        gmv_annual_usd: { type: "integer" },  // -1 when unavailable
        aov_low: { type: "number" },          // -1 when unavailable
        aov_high: { type: "number" },
        aov_basis: { type: "string" },
        method: { type: "string" },
        reasoning: { type: "string" },
      },
    },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["field", "value", "source_url", "source_title", "method", "confidence"],
        properties: {
          field: { type: "string", enum: CLAIM_FIELDS },
          value: { type: "string" },
          source_url: { type: "string" },
          source_title: { type: "string" },
          method: { type: "string" },
          confidence: { type: "number" },
        },
      },
    },
    psps: { type: "array", items: { type: "string" } },
    apms: { type: "array", items: { type: "string" } },
    markets: { type: "array", items: { type: "string" } },
    signals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "description", "observed_at", "url", "weight"],
        properties: {
          kind: { type: "string", enum: ["expansion", "funding", "psp_change", "leadership", "outage", "product", "other"] },
          description: { type: "string" },
          observed_at: { type: "string" },   // "" when undated
          url: { type: "string" },
          weight: { type: "number" },
        },
      },
    },
  },
};

const CRITIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts", "estimate_verdict", "revised_min", "revised_mid", "revised_max",
             "confidence", "force_abstain", "abstain_reason", "notes"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "verdict", "note"],
        properties: {
          index: { type: "integer" },
          verdict: { type: "string", enum: ["supported", "unsupported", "uncertain"] },
          note: { type: "string" },
        },
      },
    },
    estimate_verdict: { type: "string", enum: ["accept", "widen", "reject"] },
    revised_min: { type: "integer" },
    revised_mid: { type: "integer" },
    revised_max: { type: "integer" },
    confidence: { type: "number" },
    force_abstain: { type: "boolean" },
    abstain_reason: { type: "string" },
    notes: { type: "string" },
  },
};

const RESEARCH_SYSTEM = `You research enterprise merchants to help a payments-orchestration sales team decide which accounts are worth working this week.

Your only job in this step is to gather PUBLIC, CITABLE evidence. You are not estimating anything yet and you are not writing a pitch.

**Go straight to the disclosure. Do not browse.** For a listed company the volume figure is almost always in one of a small number of documents, and searching around them wastes time and finds worse numbers. Your first search should target the document, not the topic: the latest 10-Q, 10-K, 20-F, annual report, interim report, quarterly shareholder letter, earnings release, or investor-relations fact sheet. Search the company name together with the document type and the metric, for example "Etsy 10-Q GMS transactions" or "Zalando annual report number of orders". Only widen to general search if the filings genuinely do not carry the figure.

Spend your searches deliberately. Two or three well-aimed searches at the right document beat a dozen broad ones, and a dozen broad ones is a failure mode, not thoroughness.

Search for, and report only what you actually find:
1. Scale of payment activity. In priority order: disclosed transactions or payments per period; disclosed orders or bookings per period; disclosed GMV, TPV or gross bookings; revenue with an average order value that lets order count be derived; active customers or users with a stated purchase frequency. Annual-report, investor-deck, earnings-release, press-release and regulatory-filing figures are the strongest sources.
2. Checkout and payments footprint. Which payment service providers, gateways, processors or orchestration layers are visible or publicly stated. Which local payment methods and wallets are offered, and in which markets.
3. Geographic footprint. Which countries or regions the merchant actually sells into, and where it is expanding.
4. Dated events from roughly the last 18 months that would make this account worth contacting NOW: market entry or expansion, a payments or checkout migration, a funding round, a new head of payments or e-commerce, a public outage or payments failure, a new subscription or marketplace line.

Rules that matter more than completeness:
- Report the number as the source states it, with the period and the currency. Do not annualise, convert or extrapolate in this step.
- Every figure you report must be attached to the specific page you saw it on.
- If you cannot find scale evidence, say so plainly. "No disclosed volume figure found" is a correct and useful answer. Do not substitute an impression of size for a number.
- Distinguish a disclosed figure from a third-party estimate, and label which you have.
- Ignore marketing superlatives entirely.

Write a compact, factual brief. Lead with scale evidence, then payments footprint, then geography, then dated events. Attribute every claim inline.`;

const EXTRACT_SYSTEM = `You convert a research brief about an enterprise merchant into structured claims for a payments-orchestration sales team.

You may only report what the brief supports. You are a transcriber with judgment, not a researcher, and you have no ability to look anything up. If the brief does not contain it, it does not exist for your purposes.

For each claim you emit:
- value: state the figure or fact with its unit and period exactly as the brief has it.
- source_url: the specific page the brief attributes it to. A claim with no URL must not be emitted at all. Never invent, guess, complete or "clean up" a URL.
- method: how the brief knows this — "disclosed in FY2025 annual report", "stated in company press release", "third-party estimate", "observed at checkout".
- confidence: 0 to 1. Disclosed primary-source figures are high. Third-party estimates are middling. Inference from adjacent numbers is low.

The question you are serving is NOT "exactly how many transactions does this merchant process". It is "is this merchant above or below 100,000 transactions per month". Those need very different amounts of precision, and confusing them makes the tool useless.

Pick the derivation that matches the evidence:

**direct_count** when the merchant discloses a count of orders, transactions, trips, bookings or payments. Convert to monthly and put the range in txn_min/txn_mid/txn_max. Set gmv_annual_usd, aov_low and aov_high to -1.

**from_gmv_with_aov** when the merchant discloses dollar volume (GMS, GMV, TPV, gross bookings, or revenue that is substantially transactional) but no count. Most large merchants are in this category, so this is the common case and it is not a fallback.
- Put the annual dollar figure in gmv_annual_usd, in whole US dollars.
- Give a PLAUSIBLE RANGE for the average order value in aov_low and aov_high. Make the band genuinely wide: it must comfortably contain the truth rather than express your best guess. A marketplace for handmade goods might be 20 to 120 dollars; a grocery delivery service 30 to 200; a luxury retailer 200 to 2000; a ride-hailing trip 5 to 60.
- Explain in aov_basis what anchors the band. Any disclosed figure that constrains it (orders per active buyer, revenue take-rate, a stated basket size, a category benchmark you actually saw) belongs here. If nothing anchors it beyond the nature of the business, say exactly that.
- Leave txn_min/txn_mid/txn_max at -1. The conversion is done in code, not by you, so that the arithmetic is reproducible.

**none** only when there is no dollar volume AND no count: the evidence is about headcount, funding or web traffic alone, or it is older than roughly three years with nothing newer, or nothing usable was found. Set abstain true, derivation "none", and every numeric field to -1.

A wide honest band is far more useful than a refusal. If the merchant is plainly enormous, a band spanning an order of magnitude still answers the floor question decisively, and the code will say so. Reserve abstaining for when you genuinely have nothing to work with, because it is a strong signal and it stops being meaningful if you use it as a default.

For signals, only include dated events. An undated event gets observed_at "" and weight below 0.5. Weight is 0 to 1: a payments or checkout migration and a new market entry are the strongest; a funding round or leadership change is moderate; a general product launch is weak.

Region: pick the single region where the merchant's primary revenue base sits. UNKNOWN is acceptable and is better than a guess.`;

const CRITIC_SYSTEM = `You are an adversarial reviewer. Your job is to REFUTE, not to agree.

You will receive a set of claims extracted about an enterprise merchant, along with the source URLs the extractor attributed them to and the raw research brief those came from. Assume the extractor was careless until each claim proves otherwise.

For every claim, return a verdict:
- supported: the research brief plainly states this, and the attributed URL is the source that stated it.
- uncertain: the brief gestures at this but the figure, the period, the unit or the attribution is loose.
- unsupported: the brief does not actually say this; the number was inferred, transformed, annualised or rounded without warrant; the URL does not correspond to the claim; the source is a marketing page or an aggregator presenting an estimate as fact; or the figure measures something other than what the claim says it measures.

Default to unsupported when you are unsure. It is much cheaper for this team to re-check a real account than to open a conversation on a fabricated number.

Then judge the transaction estimate itself.

If the estimate was derived from dollar volume using an assumed average order value, judge TWO things separately: whether the dollar figure is real and correctly attributed, and whether the assumed order-value band is honestly wide for this kind of business. A band that is too narrow is the failure to catch here, because it manufactures false precision. Widen it rather than rejecting whenever the underlying dollar figure is sound. Remember the question is which side of 100,000 transactions per month the merchant sits on, so a band spanning an order of magnitude is perfectly acceptable when it still answers that decisively.

- accept: the conversion from the underlying evidence to monthly transactions is sound and the range honestly covers the uncertainty.
- widen: the direction is right but the range is too tight for the quality of the evidence. Return a wider revised range.
- reject: the estimate does not follow from the evidence at all.

Set force_abstain to true when the estimate rests on any claim you marked unsupported, or when no surviving claim measures either a transaction count or a dollar volume. Do NOT force abstain merely because an average order value had to be assumed: an assumption that is stated, bounded and visible is not the same as a fabrication, and the code checks whether the resulting range is decisive. Say why in abstain_reason, in one plain sentence a salesperson would understand.

confidence is your calibrated belief, 0 to 1, that the surviving estimate is within its own stated range. Be harsh. A confidently wrong number here would discredit the whole tool.

When you force abstain, set revised_min, revised_mid and revised_max to -1.`;


/* ===========================================================================
 * Stages.
 *
 * Each stage is exactly one model call and is safe to run in its own Worker
 * invocation. This is not tidiness: a single invocation cannot hold a
 * three-minute call open, and the first async attempt was killed mid-research
 * with the job orphaned and no cost recorded. The job row carries state between
 * stages so every invocation is short.
 * ======================================================================== */

/**
 * Passages from the merchant's own filings, when it is an SEC filer.
 *
 * This is the difference between searching for commentary about a disclosure
 * and reading the disclosure. Web search finds a document only if it happens to
 * be indexed and only if the query happens to match; EDGAR is a direct lookup
 * against the regulator's own store. Handing the research stage the actual text
 * means it spends its five searches on timing signals rather than on hunting
 * for a figure that was addressable all along.
 *
 * Returns null for the majority of the world, which is not an error. Most
 * merchants are not SEC filers, and that is what the coverage map is for.
 */
async function edgarBrief(env, { domain, name }) {
  try {
    const src = await primarySources(env, { domain, name });
    // Remember the answer either way. Whether a merchant is reachable in EDGAR
    // is a durable fact about the merchant, and the interface needs it to avoid
    // offering an action that cannot succeed.
    try {
      await env.DB.prepare("UPDATE accounts SET sec_cik=?, sec_checked_at=datetime('now') WHERE domain=?")
        .bind(src.ok ? src.cik : null, domain).run();
    } catch { /* never let bookkeeping break a run */ }
    if (!src.ok || !src.filings.length) return null;

    for (const filing of src.filings.slice(0, 2)) {
      const r = await fetch(filing.url, {
        headers: { "user-agent": "Floor account qualification (bryan@leandrive.io)" },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (!r.ok) continue;
      const windows = relevantWindows(await r.text(), "orders transactions volume", { max: 8 });
      if (!windows.length) continue;
      return {
        url: filing.url,
        form: filing.form,
        filed: filing.filed,
        cik: src.cik,
        text: windows.join("\n\n"),
      };
    }
  } catch { /* a source that fails is a coverage fact, never a broken run */ }
  return null;
}

export async function stageResearch({ env, budget, domain, account, settings }) {
  const model = new Model(env, budget);

  // Primary first. If the regulator has it, start there rather than searching.
  const edgar = await edgarBrief(env, { domain, name: account?.name });
  const primaryBlock = edgar ? `

=== PRIMARY FILING, RETRIEVED DIRECTLY FROM SEC EDGAR ===
${edgar.form} filed ${edgar.filed}
Source URL, cite this exactly: ${edgar.url}

${edgar.text}

Treat the passages above as the strongest evidence available. They came from the regulator's own filing store, not from a search. If they state the volume figure, use them and cite that URL, and spend your searches on dated events instead.` : "";

  const r = await model.call({
    step: "research",
    model: settings.model_research || env.MODEL_RESEARCH || "claude-sonnet-5",
    system: RESEARCH_SYSTEM,
    user: `Merchant domain: ${domain}${account?.name ? `\nKnown as: ${account.name}` : ""}

Find this merchant's disclosed payment or order volume, then its payments footprint, geography and recent dated events.

Start by going directly at the primary disclosure: search the company name with the document type and the metric. If the company is listed, its filings are the answer and general web search usually is not. If no disclosed scale figure exists, say so plainly rather than substituting an impression of size.${primaryBlock}`,
    // Dynamic-filtering web search. Do NOT also declare code_execution here —
    // the _20260209 variant runs it internally and a second execution
    // environment confuses the model. max_uses is kept tight because research
    // is the long pole and every extra search is wall-clock the invocation
    // does not have.
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    effort: "low",
    maxTokens: 8000,
  });

  if (!r.ok) return { ok: false, reason: r.reason, detail: r.detail, traces: model.traces, edgar };

  // Hard stop when search produced nothing usable.
  //
  // The most important guard here, written after watching it fail live: when
  // every search failed, the extractor produced seven confident claims from
  // prior knowledge with fabricated URLs. The critic caught them, but relying
  // on the critic to catch a whole run is not a design. No evidence, no
  // estimate, and it costs two fewer calls to say so.
  if (r.searchFailed) {
    return {
      ok: false, reason: "search_returned_nothing", traces: model.traces,
      detail: r.searchErrors?.length
        ? `web search failed (${r.searchErrors.join(", ")}), no sources retrieved, so no estimate was attempted`
        : "web search returned no usable sources, so no estimate was attempted",
    };
  }

  return { ok: true, text: r.text, sources: r.sources, traces: model.traces };
}

export async function stageExtract({ env, budget, domain, researchText, sources, settings }) {
  const model = new Model(env, budget);
  const sourceList = (sources || [])
    .map((s, i) => `[${i + 1}] ${s.url}${s.title ? ` — ${s.title}` : ""}`).join("\n");
  const r = await model.call({
    step: "extract",
    model: settings.model_extract || env.MODEL_EXTRACT || "claude-sonnet-5",
    system: EXTRACT_SYSTEM,
    user: `Merchant domain: ${domain}

=== RESEARCH BRIEF ===
${researchText}

=== SOURCES SEEN ===
${sourceList || "(none returned)"}

Extract structured claims. Emit no claim you cannot attribute to one of the sources above.`,
    schema: EXTRACT_SCHEMA,
    effort: "low",
    maxTokens: 8000,
  });
  if (!r.ok || !r.json) {
    return { ok: false, reason: r.reason || "extract_parse_failed", detail: r.detail, traces: model.traces };
  }
  return { ok: true, json: r.json, traces: model.traces };
}

export async function stageCritic({ env, budget, domain, extractJson, researchText, settings }) {
  const model = new Model(env, budget);
  const claims = Array.isArray(extractJson?.claims) ? extractJson.claims : [];
  const claimList = claims.map((c, i) =>
    `[${i}] field=${c.field} value=${JSON.stringify(c.value)} url=${c.source_url} method=${JSON.stringify(c.method)} extractor_confidence=${c.confidence}`
  ).join("\n") || "(no claims emitted)";
  const est = extractJson?.estimate || {};

  const r = await model.call({
    step: "critic",
    model: settings.model_critic || env.MODEL_CRITIC || "claude-opus-5",
    system: CRITIC_SYSTEM,
    user: `Merchant domain: ${domain}

=== CLAIMS TO REFUTE ===
${claimList}

=== ESTIMATE TO JUDGE ===
abstain=${est.abstain} min=${est.txn_min} mid=${est.txn_mid} max=${est.txn_max}
method=${JSON.stringify(est.method || "")}
reasoning=${JSON.stringify(est.reasoning || "")}

=== RAW RESEARCH BRIEF (the ground truth for what was actually found) ===
${researchText}

Return a verdict for every claim index above, then judge the estimate.`,
    schema: CRITIC_SCHEMA,
    effort: "high",
    // Raised from 8000 after Chewy. Thinking and output share this budget, and
    // a merchant with eleven claims exhausted it before the critic finished
    // issuing verdicts.
    maxTokens: 16000,
  });

  // A truncated critic is not a quiet critic.
  //
  // finalise() defaults any claim with no verdict to "uncertain", which is the
  // right reading when the critic considered a claim and hedged. It is the
  // wrong reading when the critic never reached the claim at all: every verdict
  // goes missing, everything reads as doubted, and the account abstains for
  // "no surviving claim measures purchase volume" while its SEC filing sits
  // right there in the evidence. Chewy failed exactly this way. Silence from a
  // truncated call is absence of judgement, not judgement.
  const truncated = (model.traces || []).some((t) => t.step === "critic" && t.stop_reason === "max_tokens");
  return {
    ok: r.ok, json: r.ok ? r.json : null, reason: r.reason, detail: r.detail,
    truncated, traces: model.traces,
  };
}

/**
 * Deterministic reconciliation. No model runs here.
 *
 * The abstain path lives in code so it cannot be prompted away. A confidently
 * wrong number is the one failure mode that would discredit the whole tool, so
 * the decision to emit one is not delegated to the thing being checked.
 */
export function finalise({ extractJson, criticJson, allTraces, startedAt, criticTruncated = false }) {
  const ex = extractJson || {};
  const claims = Array.isArray(ex.claims) ? ex.claims : [];
  const cr = criticJson || null;

  const verdicts = new Map();
  for (const v of cr?.verdicts || []) verdicts.set(v.index, v);

  const surviving = claims
    .map((c, i) => ({
      ...c, index: i,
      verdict: verdicts.get(i)?.verdict || "uncertain",
      critic_note: verdicts.get(i)?.note || "",
    }))
    .filter((c) => c.verdict !== "unsupported");

  const hasVolumeEvidence = surviving.some(
    (c) => ["txn_volume", "gmv", "orders", "revenue"].includes(c.field) && c.verdict === "supported"
  );

  let est = { ...(ex.estimate || {}) };
  if (cr) {
    if (cr.estimate_verdict === "widen" && cr.revised_min > 0) {
      est.txn_min = cr.revised_min; est.txn_mid = cr.revised_mid; est.txn_max = cr.revised_max;
      est.method = `${est.method || ""} (range widened by critic)`.trim();
    } else if (cr.estimate_verdict === "reject") {
      est.abstain = true;
      est.abstain_reason = cr.abstain_reason || "critic rejected the estimate as unsupported by the evidence";
    }
    if (cr.force_abstain) {
      est.abstain = true;
      est.abstain_reason = cr.abstain_reason || est.abstain_reason || "critic forced abstain";
    }
  }

  // Derive transactions from dollar volume when no count is published.
  //
  // Most large merchants disclose money, not order counts, so refusing to
  // convert meant abstaining on companies whose scale is not remotely in doubt.
  // The question being served is which side of the floor a merchant sits on,
  // and a deliberately wide order-value band usually answers that decisively
  // even though it would be useless for pinning an exact number.
  //
  // The arithmetic happens here rather than in the model so the same inputs
  // always produce the same range, and so the assumption is on the record.
  let derivedNote = null;
  if (!est.abstain && est.derivation === "from_gmv_with_aov"
      && est.gmv_annual_usd > 0 && est.aov_low > 0 && est.aov_high >= est.aov_low) {
    const monthlyGmv = est.gmv_annual_usd / 12;
    est.txn_min = Math.round(monthlyGmv / est.aov_high);  // dearer basket, fewer orders
    est.txn_max = Math.round(monthlyGmv / est.aov_low);
    est.txn_mid = Math.round(Math.sqrt(est.txn_min * est.txn_max)); // geometric: the band is multiplicative
    derivedNote = `derived from $${(est.gmv_annual_usd / 1e9).toFixed(2)}B annual volume at an assumed $${est.aov_low}–$${est.aov_high} average order value`;
    est.method = `${derivedNote}. ${est.aov_basis || ""}`.trim();
  }

  const reasons = [];
  // Say what actually happened. "No surviving claim measures volume" is true
  // but it describes a consequence, and the cause was that the check never
  // finished. An operator reading the first sentence would go looking for
  // better sources for a merchant whose sources were already excellent.
  if (criticTruncated && !verdicts.size)
    reasons.push("the adversarial check did not finish, so no claim was judged and none can be trusted yet. Re-run to get a verdict");
  if (est.abstain) reasons.push(est.abstain_reason || "extractor abstained");
  if (!hasVolumeEvidence) {
    // Two very different situations wore the same sentence.
    //
    // "Nothing measures volume" sends an operator looking for better sources.
    // That is right when the research genuinely found none, and actively
    // misleading when a 10-Q net-sales figure is sitting in the evidence table
    // and the critic simply could not confirm its attribution. The second case
    // is a re-run or a human glance, not a sourcing problem, and Chewy spent
    // two runs looking like the first when it was the second.
    //
    // The gate itself is deliberately unchanged: a figure the critic would not
    // support does not become an estimate. Only the account of why changes.
    const loose = surviving.filter(
      (c) => ["txn_volume", "gmv", "orders", "revenue"].includes(c.field) && c.verdict === "uncertain"
    );
    reasons.push(loose.length
      ? `${loose.length} volume figure${loose.length > 1 ? "s were" : " was"} found but the critic could not confirm ${loose.length > 1 ? "their" : "its"} attribution, so none can carry an estimate yet`
      : "no surviving claim measures purchase or transaction volume");
  }
  if (!est.abstain && (est.txn_mid == null || est.txn_mid <= 0)) reasons.push("no usable volume figure");
  // A range spanning more than two orders of magnitude is only fatal for a
  // DIRECT count, where it means the underlying figures disagree wildly. A
  // derived range is wide by construction and is still decisive whenever both
  // ends land on the same side of the floor, which scoreFit already checks.
  if (!est.abstain && est.derivation === "direct_count"
      && est.txn_min > 0 && est.txn_max > 0 && est.txn_max / est.txn_min > 100) {
    reasons.push("disclosed figures disagree by more than two orders of magnitude");
  }
  const abstained = reasons.length > 0;

  let confidence = cr?.confidence ?? 0.4;
  if (abstained) confidence = 0;
  const dropped = claims.length - surviving.length;
  if (!abstained && dropped > 0) confidence = Math.max(0.05, confidence - 0.1 * dropped);

  const traces = allTraces || [];
  const cost = traces.reduce((a, t) => a + (t.cost_usd || 0), 0);

  return {
    ok: true,
    company_name: ex.company_name || null,
    region: (ex.region || "UNKNOWN").toUpperCase(),
    assessment: {
      status: abstained ? "abstained" : "ok",
      txn_min: abstained ? null : est.txn_min,
      txn_mid: abstained ? null : est.txn_mid,
      txn_max: abstained ? null : est.txn_max,
      confidence: Number(confidence.toFixed(3)),
      abstained: abstained ? 1 : 0,
      abstain_reason: abstained ? reasons.join("; ") : null,
      method: est.method || null,
      // Carried through so accuracy can be reported per reliability class. A
      // count read off a filing and a count derived from dollar volume through
      // an assumed order-value band are not the same kind of number, and one
      // blended percentage hides which of the two is actually failing.
      derivation: abstained ? null : (est.derivation || null),
      cost_usd: cost,
      latency_ms: startedAt ? Date.now() - startedAt : 0,
    },
    evidence: surviving.map((c) => ({
      field: c.field, value: c.value, source_url: c.source_url,
      source_title: c.source_title || null, method: c.method,
      confidence: c.confidence, verdict: c.verdict, critic_note: c.critic_note,
    })),
    dropped,
    psps: ex.psps || [], apms: ex.apms || [], markets: ex.markets || [],
    signals: (ex.signals || []).filter((s) => s.description),
    critic_notes: cr?.notes || null,
    traces,
  };
}

/** Failure shaped like a finished assessment, so callers have one code path. */
export function failedAssessment({ reason, detail, traces = [], startedAt }) {
  return {
    ok: false, reason, detail: detail || null,
    assessment: {
      status: "error", abstained: 1,
      abstain_reason: detail || `pipeline stopped: ${reason}`,
      confidence: 0,
      cost_usd: traces.reduce((a, t) => a + (t.cost_usd || 0), 0),
      latency_ms: startedAt ? Date.now() - startedAt : 0,
    },
    evidence: [], signals: [], psps: [], apms: [], markets: [], traces,
  };
}

/** All three stages in one call. Used by the local batch script, which has no
 *  invocation limit. The Worker uses the stages individually. */
export async function assessAccount({ env, budget, domain, account, settings, onStage }) {
  const startedAt = Date.now();
  const stage = async (n) => { try { await onStage?.(n); } catch { /* best effort */ } };
  const traces = [];

  await stage("research");
  const r = await stageResearch({ env, budget, domain, account, settings });
  traces.push(...r.traces);
  if (!r.ok) return failedAssessment({ reason: r.reason, detail: r.detail, traces, startedAt });

  await stage("extract");
  const e = await stageExtract({ env, budget, domain, researchText: r.text, sources: r.sources, settings });
  traces.push(...e.traces);
  if (!e.ok) return failedAssessment({ reason: e.reason, detail: e.detail, traces, startedAt });

  await stage("critic");
  const c = await stageCritic({ env, budget, domain, extractJson: e.json, researchText: r.text, settings });
  traces.push(...c.traces);

  return finalise({ extractJson: e.json, criticJson: c.json, allTraces: traces, startedAt });
}
