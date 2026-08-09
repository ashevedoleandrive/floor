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
export function reconcileTruth(x, predictedMonthly = null) {
  const flags = [];
  const value = Number(x?.value);
  const period = String(x?.period || "").toLowerCase();
  const quote = String(x?.verbatim || "");

  if (!Number.isFinite(value) || value <= 0)
    return { ok: false, reason: "no usable figure was reported", flags };
  if (!PER_MONTH[period])
    return { ok: false, reason: `unrecognised period "${x?.period}"`, flags };
  if (quote.length < 12)
    return { ok: false, reason: "no verbatim sentence, so nothing can be checked", flags };

  // Defence 3: a sentence that names no period cannot establish one.
  const implied = periodsInText(quote);
  if (!implied.size)
    return {
      ok: false,
      reason: "the quoted sentence names no period, so the figure cannot be placed in time",
      flags,
    };

  // Defence 2: the claimed period must be one the sentence actually supports.
  if (!implied.has(period))
    return {
      ok: false,
      reason: `claimed a ${period} figure, but the quoted sentence reads as ${[...implied].join(" or ")}`,
      flags,
    };

  // Defence 1: the conversion happens here, never in a model.
  const monthly = Math.round(value * PER_MONTH[period]);

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

  return { ok: true, monthly, period, value, quote, flags };
}

/** The contract the extractor must satisfy. Conversion is deliberately absent. */
export const TRUTH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "value", "unit", "period", "period_label", "verbatim", "source_url"],
  properties: {
    found: { type: "boolean", description: "false when the document does not state the figure" },
    value: { type: "number", description: "the number exactly as printed, not converted" },
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
- Report the number as written. If the document says "776 million", report 776000000 with unit "orders". Never divide, multiply or annualise anything. Conversion happens elsewhere.
- Report the period the document states, not the period anyone wants. A quarterly figure is "quarter" even when a monthly number would be more useful.
- The verbatim field must contain the sentence you took the figure from, copied exactly, and it must include the words that establish the period. If the only sentence with the number does not say what period it covers, set found to false.
- Set found to false when the document does not state this metric. An absent figure is a normal outcome, not a failure. Do not substitute a related metric, a segment figure, or a figure for a different period.
- Prefer the most recent complete period the document reports.`;
