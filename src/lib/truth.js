/**
 * Ground truth extraction, and the unit error it is built to survive.
 *
 * THE FAILURE THIS FILE EXISTS FOR
 *
 * A disclosure says "776 million Total Orders in Q3 2025". If that is recorded
 * as a monthly figure, the stored truth is 776M/mo instead of 258.7M/mo, wrong
 * by exactly 3x. The eval then rewards a prediction that is badly wrong and
 * penalises the correct one, and nothing anywhere reports an error. A wrong
 * answer key is worse than no answer key, because it converts an honest
 * "unmeasured" into a confident lie.
 *
 * FOUR DEFENCES, LAYERED, THREE OF THEM DETERMINISTIC
 *
 * 1. The model never converts. It reports what the document literally says as
 *    structured fields: the number, the unit, the period, the exact sentence.
 *    Code does the arithmetic to monthly. Same rule as the rest of Floor: the
 *    model reads and cites, code computes.
 *
 * 2. The claimed period is checked against the quote, in code. If the sentence
 *    says "Q3" or "three months ended" and the model claimed a monthly figure,
 *    that is a contradiction and the extraction is rejected. This is the defence
 *    that catches the exact failure above, and it needs no second model.
 *
 * 3. A quote carrying no period marker at all cannot establish a period, so it
 *    abstains rather than guessing. Silence is not evidence of "monthly".
 *
 * 4. Where the resulting truth disagrees with Floor's own prediction by almost
 *    exactly 3x, 4x or 12x, that is the arithmetic signature of a period
 *    confusion, and it is flagged for a human rather than accepted. Note it is
 *    flagged, never rejected: rejecting truth for disagreeing with the
 *    prediction would be circular, which is the whole thing we are avoiding.
 */

import { Model } from "./anthropic.js";
import { primarySources } from "./edgar.js";
import { ukPrimarySource, accountsDocument } from "./companies_house.js";

/**
 * Scale words, applied in code.
 *
 * The sibling of the period error and just as quiet: a filing reads "970
 * million Total Orders" and the figure is stored as 970. Off by a factor of a
 * million, and the eval would then treat a correct prediction as catastrophically
 * wrong. Same remedy as the period: the model reports the word it saw, code does
 * the multiplication, and the quote is checked against both.
 */
const MAGNITUDE = { "": 1, none: 1, hundred: 1e2, thousand: 1e3, million: 1e6, billion: 1e9, trillion: 1e12 };

/** Everything that reduces a disclosed figure to a monthly rate. Code only. */
const PER_MONTH = {
  day: 30.437,
  week: 4.348,
  month: 1,
  quarter: 1 / 3,
  half: 1 / 6,
  year: 1 / 12,
};

/**
 * Period markers, matched against the verbatim sentence.
 *
 * Deliberately generous on quarter and year, because those are the two that
 * actually appear in filings and the two whose confusion with "month" does the
 * damage.
 */
const PERIOD_MARKERS = [
  ["quarter", /\bQ[1-4]\b|\bquarter|quarterly|three months ended|3 months ended|first quarter|second quarter|third quarter|fourth quarter|\b[1-4]Q\d{2}\b/i],
  ["year",    /\bFY\s?\d{2,4}|full[- ]year|fiscal year|twelve months ended|12 months ended|annual(?:ly)?|for the year ended|per year|a year\b|\bin \d{4}\b/i],
  ["half",    /six months ended|6 months ended|half[- ]year|\bH[12]\b|first half|second half/i],
  ["month",   /\bper month\b|\bmonthly\b|\bmonth ended\b|\ba month\b|\bMAU\b/i],
  ["week",    /\bper week\b|\bweekly\b|\ba week\b/i],
  ["day",     /\bper day\b|\bdaily\b|\ba day\b|\bDAU\b/i],
];

/** Which periods the sentence itself implies. */
export function periodsInText(text) {
  const s = String(text || "");
  const found = new Set();
  for (const [period, re] of PERIOD_MARKERS) if (re.test(s)) found.add(period);
  return found;
}

/** Ratios that are the signature of a period mix-up rather than a real miss. */
const SUSPICIOUS = [
  [3, "quarterly figure treated as monthly, or the reverse"],
  [4, "quarters-per-year confusion"],
  [12, "annual figure treated as monthly, or the reverse"],
  [30.4, "daily figure treated as monthly, or the reverse"],
];

/**
 * Turn a raw extraction into a stored truth, or refuse to.
 *
 * @param {object} x       what the model reported, never converted by it
 * @param {number} [predictedMonthly] Floor's own estimate, used only to flag
 *                                    disagreements whose ratio looks like a
 *                                    unit error. Never used to reject.
 * @returns {{ok:boolean, monthly?:number, reason?:string, flags:string[]}}
 */
/**
 * @param {string|null} periodFromDocument  A period the DOCUMENT establishes,
 *   independent of the sentence. A set of annual filed accounts covers a year
 *   by definition of the filing, so a revenue figure lifted from its table is
 *   annual whether or not the surrounding words say so. This is external
 *   evidence, not a guess, and using it is recorded as a flag so the reading is
 *   auditable. It is only ever consulted when the sentence itself is silent; a
 *   sentence that names a period always wins, and a sentence that contradicts
 *   the document is still rejected.
 */
export function reconcileTruth(x, predictedMonthly = null, periodFromDocument = null) {
  const flags = [];
  const value = Number(x?.value);
  const period = String(x?.period || "").toLowerCase();
  const quote = String(x?.verbatim || "");

  const mag = String(x?.magnitude ?? "").toLowerCase().trim();
  if (!(mag in MAGNITUDE))
    return { ok: false, reason: `unrecognised scale word "${x?.magnitude}"`, flags };
  if (!Number.isFinite(value) || value <= 0)
    return { ok: false, reason: "no usable figure was reported", flags };
  if (!PER_MONTH[period])
    return { ok: false, reason: `unrecognised period "${x?.period}"`, flags };
  if (quote.length < 12)
    return { ok: false, reason: "no verbatim sentence, so nothing can be checked", flags };

  // Defence 3: a sentence that names no period cannot establish one, unless the
  // document itself does.
  const implied = periodsInText(quote);
  if (!implied.size) {
    if (periodFromDocument && PER_MONTH[periodFromDocument] && period === periodFromDocument) {
      flags.push(`the period came from the filing type, not from the quoted sentence`);
      implied.add(periodFromDocument);
    } else {
      return {
        ok: false,
        reason: "the quoted sentence names no period, so the figure cannot be placed in time",
        flags,
      };
    }
  }

  // Defence 2: the claimed period must be one the sentence actually supports.
  if (!implied.has(period))
    return {
      ok: false,
      reason: `claimed a ${period} figure, but the quoted sentence reads as ${[...implied].join(" or ")}`,
      flags,
    };

  // Defence 5: the scale word is checked against the sentence before it is
  // applied. If the quote reads "970 million" the magnitude must be million; a
  // figure reported bare when the document scaled it is off by a factor of a
  // million and would look like a catastrophic prediction miss.
  // Financial writing abbreviates: "68m", "1.2bn", "450k". Reading only the
  // spelled-out words meant a correctly scaled figure got flagged for a scale
  // the sentence had printed, just shorter. A check that cries wolf trains
  // people to ignore it.
  const ABBREV = { k: "thousand", m: "million", bn: "billion", b: "billion", tn: "trillion", t: "trillion" };
  // Find the figure being validated, not merely the first number in the
  // sentence. A table row reading "FY24: 68m 57m" carries two, and checking the
  // wrong one let a dropped scale word through: 68 did not match the reported
  // 57, so the guard skipped instead of firing.
  const scaleHits = [...quote.matchAll(/([\d][\d,.]*)\s*(hundred|thousand|million|billion|trillion|bn|tn|[kmbt])\b/gi)];
  const scaleInQuote = scaleHits.find(
    (m) => Math.abs(Number(m[1].replace(/,/g, "")) - value) < Math.max(1, value * 0.02)
  );
  if (scaleInQuote) {
    const rawWord = scaleInQuote[2].toLowerCase();
    const said = ABBREV[rawWord] || rawWord;
    if (said !== mag)
      return {
        ok: false,
        reason: `the sentence reads "${scaleInQuote[1]} ${rawWord}" but the figure was reported as ${mag || "a bare number"}`,
        flags,
      };
  } else if (scaleHits.length && mag && mag !== "none") {
    flags.push(`the sentence prints a scale word but not next to the figure that was reported`);
  } else if (mag && mag !== "none") {
    flags.push(`a "${mag}" scale was applied but the quoted sentence does not print that word`);
  }

  // Defence 1: all arithmetic happens here, never in a model.
  const scaled = value * MAGNITUDE[mag];
  const monthly = Math.round(scaled * PER_MONTH[period]);

  // Defence 4: flag, do not reject.
  if (predictedMonthly > 0 && monthly > 0) {
    const ratio = Math.max(monthly, predictedMonthly) / Math.min(monthly, predictedMonthly);
    for (const [r, why] of SUSPICIOUS) {
      if (Math.abs(ratio - r) / r < 0.08) {
        flags.push(`disagrees with the estimate by almost exactly ${r}x, the signature of a ${why}`);
        break;
      }
    }
  }
  if (implied.size > 1)
    flags.push(`the sentence mentions more than one period (${[...implied].join(", ")}), so the reading is less certain`);

  return { ok: true, monthly, period, value: scaled, raw_value: value, magnitude: mag, quote, flags };
}

/** The contract the extractor must satisfy. Conversion is deliberately absent. */
export const TRUTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "value", "magnitude", "unit", "period", "period_label", "verbatim", "source_url"],
  properties: {
    found: { type: "boolean", description: "false when the document does not state the figure" },
    value: { type: "number", description: "the bare number as printed, without applying any scale word. For \"970 million\" report 970." },
    magnitude: {
      type: "string",
      enum: ["", "hundred", "thousand", "million", "billion", "trillion"],
      description: "the scale word printed next to the number, or empty when the figure is written in full",
    },
    unit: { type: "string", description: "orders, transactions, room nights, bookings, trips" },
    period: {
      type: "string",
      enum: ["day", "week", "month", "quarter", "half", "year"],
      description: "the period the figure covers, as the document states it",
    },
    period_label: { type: "string", description: "as written, e.g. Q3 2025 or FY2024" },
    verbatim: {
      type: "string",
      description: "the sentence containing the figure, copied exactly, including its period words",
    },
    source_url: { type: "string" },
    note: { type: "string" },
  },
};

export const TRUTH_SYSTEM = `You transcribe one disclosed figure from one document. You do not research, you do not estimate, and you do not convert.

You will be given a single primary document, a regulator filing or an investor relations release, and the metric to find. Report the figure exactly as the document prints it.

Rules:
- Report the bare number and its scale word separately, exactly as printed. "776 million" is value 776 with magnitude "million". "1,240,000" is value 1240000 with magnitude "". Never multiply the two together, and never divide, annualise or convert anything. All arithmetic happens elsewhere.
- Report the period the document states, not the period anyone wants. A quarterly figure is "quarter" even when a monthly number would be more useful.
- The verbatim field must contain the sentence you took the figure from, copied exactly, and it must include the words that establish the period. If the only sentence with the number does not say what period it covers, set found to false.
- Set found to false when the document does not state this metric. An absent figure is a normal outcome, not a failure. Do not substitute a related metric, a segment figure, or a figure for a different period.
- Prefer the most recent complete period the document reports.`;

/* ==========================================================================
 * Extraction: from a filing to a stored truth.
 * ========================================================================== */


/**
 * Filings are large. A 10-Q is often a megabyte of markup, and feeding that to a
 * model is expensive, slow, and worse at the job than feeding it the paragraphs
 * that actually mention the metric. So the document is reduced to windows around
 * every plausible mention, in code, before any model sees it.
 */
export function relevantWindows(html, metric, { width = 900, max = 14 } = {}) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Words from the metric this row is actually asking for score highest; the
  // generic volume vocabulary is a fallback for when the row's wording and the
  // filing's wording differ.
  const specific = new Set(String(metric || "").toLowerCase().match(/[a-z]{4,}/g) || []);
  const generic = ["orders", "transactions", "bookings", "trips", "nights", "gmv", "gms", "volume", "deliveries", "purchases"];

  const hay = text.toLowerCase();
  const starts = new Set();
  for (const w of [...specific, ...generic]) {
    let i = -1;
    while ((i = hay.indexOf(w, i + 1)) !== -1) {
      starts.add(Math.max(0, Math.floor((i - width / 2) / 200) * 200));
      if (starts.size > 800) break;
    }
  }

  // Score every candidate window, then take the best. Taking the first N by
  // position was the bug: in a 2MB filing the figure sits deep in the MD&A,
  // and the opening windows are all cover page and statement tables.
  const scored = [];
  for (const start of starts) {
    const w = text.slice(start, start + width);
    const lw = w.toLowerCase();
    let score = 0;
    for (const t of specific) if (lw.includes(t)) score += 3;
    for (const t of generic) if (lw.includes(t)) score += 1;
    // A disclosed volume is a large number, usually written in words.
    if (/\b\d[\d,.]*\s*(million|billion)\b/i.test(w)) score += 4;
    else if (/\b\d{1,3}(,\d{3}){2,}\b/.test(w)) score += 2;
    // Without a period marker the passage cannot establish one anyway.
    if (periodsInText(w).size) score += 3;
    // Prose beats a column of figures: tables lose their headings when stripped.
    const digits = (w.match(/\d/g) || []).length;
    if (digits / w.length > 0.22) score -= 4;
    if (score > 0) scored.push({ start, w, score });
  }

  scored.sort((a, b) => b.score - a.score || a.start - b.start);
  const kept = [];
  for (const c of scored) {
    if (kept.some((k) => Math.abs(k.start - c.start) < width)) continue;
    kept.push(c);
    if (kept.length >= max) break;
  }
  // Reading order for the model, best-first having done its job in selection.
  return kept.sort((a, b) => a.start - b.start).map((k) => k.w);
}

/**
 * Establish the disclosed figure for one merchant from its own filings.
 *
 * Returns a result whether or not it succeeds, because "this company does not
 * state that figure" is a normal and useful outcome. It is the reason a row
 * stays ungradeable, and saying so beats an empty cell.
 */
export async function extractTruth(env, budget, { domain, name, metric, settings, predictedMonthly = null }) {
  const src = await primarySources(env, { domain, name });
  if (!src.ok || !src.filings.length)
    return { ok: false, stage: "source", reason: src.reason || "no primary filings found" };

  const model = new Model(env, budget);
  const tried = [];

  // Newest first. The most recent complete period is the one worth grading
  // against, and an older filing is only consulted if the newest is silent.
  for (const filing of src.filings.slice(0, 3)) {
    let html = "";
    try {
      const r = await fetch(filing.url, {
        headers: { "user-agent": "Floor account qualification (bryan@leandrive.io)" },
        cf: { cacheTtl: 86400, cacheEverything: true },
      });
      if (!r.ok) { tried.push(`${filing.form}: HTTP ${r.status}`); continue; }
      html = await r.text();
    } catch (e) { tried.push(`${filing.form}: ${e.message}`); continue; }

    const windows = relevantWindows(html, metric);
    if (!windows.length) { tried.push(`${filing.form}: no passage mentions a volume figure`); continue; }

    const r = await model.call({
      step: "truth",
      model: settings?.model_extract || env.MODEL_EXTRACT || "claude-sonnet-5",
      system: TRUTH_SYSTEM,
      user: `Merchant: ${name || domain}
Metric to find: ${metric || "transactions or orders per period"}
Document: ${filing.form} filed ${filing.filed}
Source URL: ${filing.url}

=== PASSAGES FROM THE FILING ===
${windows.map((w, i) => `[${i}] ${w}`).join("\n\n")}

Report the figure exactly as printed, with the period the document states. Do not convert anything.`,
      schema: TRUTH_SCHEMA,
      effort: "low",
      maxTokens: 3000,
    });

    if (!r.ok) { tried.push(`${filing.form}: ${r.reason}`); continue; }
    const x = r.json || {};
    if (!x.found) { tried.push(`${filing.form}: figure not stated`); continue; }

    const rec = reconcileTruth({ ...x, source_url: filing.url }, predictedMonthly);
    if (!rec.ok) {
      // A rejection here is the defences working, so it is reported rather than
      // retried on the same document with different wording.
      tried.push(`${filing.form}: ${rec.reason}`);
      continue;
    }

    return {
      ok: true,
      monthly: rec.monthly,
      raw_value: rec.raw_value,
      magnitude: rec.magnitude,
      value_scaled: rec.value,
      raw_period: rec.period,
      unit: x.unit || null,
      period_label: x.period_label || null,
      verbatim: rec.quote,
      source_url: filing.url,
      form: filing.form,
      filed: filing.filed,
      cik: src.cik,
      flags: rec.flags,
      traces: model.traces,
    };
  }

  return { ok: false, stage: "extract", reason: tried.join(" · ") || "no figure found", traces: model.traces };
}

/**
 * The same job against a UK filed accounts PDF.
 *
 * Companies House publishes accounts as PDF and nothing else, so the document
 * goes to the model as a document block rather than through a parser. Every
 * defence downstream is identical: the model transcribes the figure, its scale
 * word and its period, quotes the sentence, and code does the arithmetic and
 * the period and scale checks.
 *
 * What a UK filing gives is revenue, not order counts, so this establishes the
 * dollar volume a merchant's size can be derived from rather than a transaction
 * count directly. That is the honest ceiling of this source and it is stated
 * rather than papered over.
 */
export async function extractTruthUK(env, budget, { domain, name, metric, settings }) {
  const src = await ukPrimarySource(env, { domain, name });
  if (!src.ok) return { ok: false, stage: "source", reason: src.reason };

  // Smallest filing that fits, not simply the newest. A large PLC's annual
  // report can exceed what a model will accept, while an earlier year carries
  // the same headline figure in fewer pages.
  let doc = null, chosen = null, why = [];
  for (const cand of (src.filing.candidates || [src.filing])) {
    const d = await accountsDocument(env, cand.metadata_url);
    if (d.ok) { doc = d; chosen = cand; break; }
    why.push(`${cand.date}: ${d.reason}`);
  }
  if (!doc) return { ok: false, stage: "document", reason: why.join(" · "), company: src.company };
  src.filing = { ...src.filing, ...chosen };

  const model = new Model(env, budget);
  const r = await model.call({
    step: "truth",
    model: settings?.model_extract || env.MODEL_EXTRACT || "claude-sonnet-5",
    system: TRUTH_SYSTEM,
    user: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: doc.base64 } },
      { type: "text", text: `Merchant: ${name || domain}
Company: ${src.company.title} (${src.company.number}), filed accounts dated ${src.filing.date}${src.filing.made_up_to ? `, made up to ${src.filing.made_up_to}` : ""}
Metric to find: ${metric || "revenue or turnover for the period"}
Source URL, cite this exactly: ${src.registry_url}

These are UK filed accounts. Report the headline revenue or turnover figure for the period exactly as printed, with its scale word and the period the accounts cover. Do not convert anything. If the document states an order or transaction count, prefer that and say so in unit.` },
    ],
    schema: TRUTH_SCHEMA,
    effort: "low",
    maxTokens: 3000,
  });

  if (!r.ok) return { ok: false, stage: "extract", reason: r.reason, traces: model.traces };
  const x = r.json || {};
  if (!x.found)
    return { ok: false, stage: "extract", reason: "the filed accounts do not state that figure", traces: model.traces };

  // Annual filed accounts cover a year by the definition of the filing, so the
  // document can establish the period when the sentence does not.
  const rec = reconcileTruth({ ...x, source_url: src.registry_url }, null, "year");
  if (!rec.ok) return { ok: false, stage: "reconcile", reason: rec.reason, traces: model.traces };

  return {
    ok: true,
    monthly: rec.monthly,
    raw_value: rec.raw_value,
    // The EDGAR path returns this and the write needs it; omitting it here made
    // a successful extraction fail at the insert with a D1 type error, which
    // reads like the extraction broke when it had already worked.
    raw_period: rec.period,
    magnitude: rec.magnitude,
    unit: x.unit || null,
    period_label: x.period_label || null,
    verbatim: rec.quote,
    source_url: src.registry_url,
    form: "UK filed accounts",
    filed: src.filing.date,
    company_number: src.company.number,
    flags: rec.flags,
    traces: model.traces,
    bytes: doc.bytes,
  };
}
