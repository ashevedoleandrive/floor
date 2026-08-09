/**
 * The source registry.
 *
 * Floor's durable claim is not that web search is a good data source. It is
 * that provenance, adversarial checking, abstention and a measured accuracy
 * score make ANY source safe to sell on. Sources are meant to be swapped.
 *
 * This file makes that concrete rather than rhetorical: it lists every source
 * worth wiring, what it would unlock, and how well it covers each of Yuno's
 * regions. Two are connected today. The rest are the investment case,
 * and they are visible instead of promised.
 *
 * Coverage ratings are deliberate and conservative:
 *   strong   authoritative or near-direct measurement for most merchants
 *   partial  works for a meaningful subset, or needs modelling on top
 *   weak     thin, patchy, or heavily inferred
 *   none     effectively unavailable in this region
 *
 * Costs are qualitative. Pricing changes and is quoted by vendors per seat,
 * per call and per region, so a number here would be wrong within a quarter
 * and this tool does not assert figures it cannot source.
 */

export const REGIONS = ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"];

export const RAW_SOURCES = [
  {
    id: "web_search",
    name: "Web search with citations",
    kind: "evidence",
    status: "connected",
    cost: "included",
    what: "Reads public filings, investor pages and press releases, and returns the URL it read.",
    unlocks: "Everything Floor does today. Strong on listed merchants, silent on private ones.",
    limits: "Finds a document only if it is indexed and public. No structured guarantee, which is why every claim it produces is refuted before it is trusted.",
    coverage: { NORTHAMERICA: "partial", EUROPE: "partial", APAC: "partial", LATAM: "partial", AMEA: "partial" },
  },
  {
    id: "sec_edgar",
    name: "SEC EDGAR filings",
    kind: "volume",
    status: "connected",
    cost: "free",
    what: "The US regulator's own filing store. Floor resolves a merchant to its CIK, fetches the newest 10-Q, 10-K or 8-K, and reads the filing directly instead of searching for commentary about it.",
    unlocks: "Primary evidence for US filers without spending a search to find it, and a second source that is genuinely independent of web search, which is what makes the accuracy page able to grade the tool at all.",
    limits: "US filers only, so it says nothing about private companies or foreign listings. Order and transaction counts are not in XBRL, checked rather than assumed, so the figures still sit in prose and have to be read.",
    coverage: { NORTHAMERICA: "strong", EUROPE: "none", APAC: "none", LATAM: "none", AMEA: "none" },
  },
  {
    id: "companies_house",
    name: "UK Companies House",
    kind: "volume",
    status: "available",
    cost: "free",
    what: "Every UK limited company files annual accounts, and they are public with a free API.",
    unlocks: "Private UK merchants that publish nothing in the American sense still have real filed revenue.",
    limits: "Small companies file abbreviated accounts. Filings lag the period they cover.",
    coverage: { NORTHAMERICA: "none", EUROPE: "partial", APAC: "none", LATAM: "none", AMEA: "none" },
  },
  {
    id: "eu_registries",
    name: "EU statutory registries",
    kind: "volume",
    status: "available",
    cost: "low",
    what: "The EU Accounting Directive obliges limited liability companies to file annual accounts. Germany via the Bundesanzeiger, the Netherlands via the Chamber of Commerce, France via the Commercial Court, and so on.",
    unlocks: "The single biggest coverage gain in Europe, which is Yuno's second priority region. Private merchants become qualifiable.",
    limits: "One integration per country rather than one API. Filing thresholds exempt the smallest companies.",
    coverage: { NORTHAMERICA: "none", EUROPE: "strong", APAC: "none", LATAM: "none", AMEA: "none" },
  },
  {
    id: "card_panel",
    name: "Card transaction panel",
    kind: "volume",
    status: "available",
    cost: "enterprise",
    what: "Anonymised consumer card spend measured at merchant level. Measures purchases directly rather than inferring them from traffic.",
    unlocks: "The shortest inference chain to a transaction count, and it covers private companies.",
    limits: "Heavily US-weighted panels. Thin to absent outside North America, which matters for a global territory.",
    coverage: { NORTHAMERICA: "strong", EUROPE: "weak", APAC: "weak", LATAM: "none", AMEA: "none" },
  },
  {
    id: "traffic_panel",
    name: "Web traffic estimates",
    kind: "volume",
    status: "available",
    cost: "paid",
    what: "Modelled visits, geography and engagement for any domain.",
    unlocks: "A volume proxy where no filing and no panel exists. The approach Yuno already tried to build and could not.",
    limits: "Furthest instrument from an actual purchase. Needs a conversion rate and an order value on top, so it carries the widest band.",
    coverage: { NORTHAMERICA: "partial", EUROPE: "partial", APAC: "partial", LATAM: "partial", AMEA: "partial" },
  },
  {
    id: "app_panel",
    name: "App download and usage panel",
    kind: "volume",
    status: "available",
    cost: "paid",
    what: "Install and engagement estimates for mobile apps, from consumer panels.",
    unlocks: "The right instrument for app-first merchants, which is disproportionately APAC and LATAM.",
    limits: "Blind to web-only merchants. Downloads are a weak proxy for purchases without engagement data alongside.",
    coverage: { NORTHAMERICA: "partial", EUROPE: "partial", APAC: "strong", LATAM: "partial", AMEA: "weak" },
  },
  {
    id: "tech_detection",
    name: "Checkout technology detection",
    kind: "footprint",
    status: "available",
    cost: "paid",
    what: "Scans a merchant's checkout and reports which payment providers, gateways and wallets are actually live, by market.",
    unlocks: "The payments footprint, measured instead of read about. Turns checkout intelligence from a research task into a lookup.",
    limits: "Sees the storefront, not the routing behind it. Can miss providers used only in some markets or flows.",
    coverage: { NORTHAMERICA: "strong", EUROPE: "strong", APAC: "strong", LATAM: "partial", AMEA: "partial" },
  },
  {
    id: "sales_nav",
    name: "Sales Navigator alerts",
    kind: "timing",
    status: "available",
    cost: "paid",
    what: "Dated alerts on job changes and company events.",
    unlocks: "The timing half of the score. A new head of payments in their first ninety days is the highest-value trigger in this motion and it is invisible to web search.",
    limits: "People data, not volume data. Improves when to call, never whether to call.",
    coverage: { NORTHAMERICA: "strong", EUROPE: "strong", APAC: "partial", LATAM: "partial", AMEA: "partial" },
  },
  {
    id: "salesforce",
    name: "Salesforce (yours)",
    kind: "truth",
    status: "available",
    cost: "owned",
    what: "The system the SDR team is already measured in.",
    unlocks: "Two things nothing else can. Cool-down stops reading an uploaded date and starts reading real activity history. And every SQL and closed-won flows back as a labelled outcome, so the ranking gets graded against revenue instead of against a hand-built gold set.",
    limits: "Needs production access, which the challenge rules correctly forbid. The export and the write-back seam are built and deliberately unwired.",
    coverage: { NORTHAMERICA: "strong", EUROPE: "strong", APAC: "strong", LATAM: "strong", AMEA: "strong" },
  },
];

const REQUIREMENTS = {
  web_search:      { secret: null,                    adapter: true  },  // included with the model
  sec_edgar:       { secret: null,                    adapter: true  },  // public, no key needed
  companies_house: { secret: "COMPANIES_HOUSE_KEY",   adapter: false },  // key held, reader not built
  eu_registries:   { secret: null,                    adapter: false },
};

function deriveStatus(src, env) {
  const req = REQUIREMENTS[src.id];
  if (!req) return { status: src.status, holds_key: false, has_adapter: false };
  const holds_key = req.secret ? Boolean(env && env[req.secret]) : true;
  const has_adapter = !!req.adapter;
  // "key_held" means a credential was required and we have it, with no reader
  // built yet. A source that needs no credential can never be in that state, so
  // reporting it there would invent a distinction the operator cannot act on.
  const status = holds_key && has_adapter ? "connected"
    : req.secret && holds_key ? "key_held"
    : "available";
  return { status, holds_key, has_adapter, needs_secret: req.secret || null };
}

/** Per-region rollup: how well could Floor qualify a merchant here, and with what. */
export function coverageByRegion(onlyConnected = false, env = null) {
  // Reads the derived status too, so a newly wired source lights its regions
  // without anyone editing this file.
  const all = RAW_SOURCES.map((s) => ({ ...s, ...deriveStatus(s, env) }));
  const pool = onlyConnected ? all.filter((s) => s.status === "connected") : all;
  const rank = { strong: 3, partial: 2, weak: 1, none: 0 };
  return REGIONS.map((region) => {
    const volume = pool.filter((s) => s.kind === "volume" || s.kind === "evidence");
    const best = volume.reduce((a, s) => Math.max(a, rank[s.coverage[region]] ?? 0), 0);
    const contributors = pool
      .filter((s) => (rank[s.coverage[region]] ?? 0) >= 2)
      .map((s) => s.name);
    return {
      region,
      level: ["none", "weak", "partial", "strong"][best],
      contributors,
    };
  });
}

/**
 * What a source needs before it can honestly claim to be connected.
 *
 * Status used to be a hand-typed constant, so adding a credential changed
 * nothing on screen and the page could sit there claiming a source was unwired
 * while its key was in the vault. Bryan caught it: "isn't this shit supposed to
 * be dynamic, or do you expect me to tell you every time I add a source?"
 *
 * Two things have to be true, and they are different: the CREDENTIAL has to
 * exist, and an ADAPTER has to exist that actually reads the source. Holding a
 * key with nothing to call it is not connection, and saying so would be the
 * same overclaim in a new place. So each is reported separately and the status
 * is computed from both.
 */
export function sourceSummary(env) {
  const SOURCES = RAW_SOURCES.map((s) => ({ ...s, ...deriveStatus(s, env) }));
  const connected = SOURCES.filter((s) => s.status === "connected");
  return {
    sources: SOURCES,
    regions: REGIONS,
    connected: connected.length,
    total: SOURCES.length,
    free_and_unwired: SOURCES.filter((s) => s.status === "available" && s.cost === "free").length,
    coverage_now: coverageByRegion(true, env),
    coverage_wired: coverageByRegion(false, env),
    note: "Two sources are connected: open web search, and the SEC's own filing store. The rest are the upgrade path, and the trust layer above them does not change when they are added.",
  };
}

/* ===========================================================================
 * Source classification.
 *
 * Deterministic, and owned by the operator rather than by the code. Rules live
 * in the database and are matched against the source URL in order, first match
 * wins. Same link, same tier, every time.
 *
 * Classification runs at RENDER time, not at write time. That is deliberate:
 * editing a rule instantly re-grades every claim already stored, so an operator
 * can demote an aggregator and watch the existing evidence re-rate rather than
 * waiting for a re-run. Stored evidence stays verbatim; only the judgement of
 * it is recomputed.
 * ======================================================================== */

export const TIERS = {
  primary_filing: { label: "Regulatory filing",     rank: 4 },
  self_published: { label: "Company statement",     rank: 3 },
  documentation:  { label: "Product documentation", rank: 2 },
  third_party:    { label: "Third-party estimate",  rank: 1 },
  unclassified:   { label: "Unclassified source",   rank: 0 },
};

/**
 * Rules that actually classify. Disabled rules must never match, so they are
 * excluded here.
 */
export async function loadSourceRules(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM source_rules WHERE enabled=1 ORDER BY position, id"
  ).all();
  return results || [];
}

/**
 * Every rule, including disabled ones, for the operator's table.
 *
 * These are deliberately two different queries. Classification wants only the
 * live rules; the UI wants the whole set, because a disabled rule that vanishes
 * from the list cannot be re-enabled and disabling becomes a one-way door.
 */
export async function loadAllSourceRules(env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM source_rules ORDER BY position, id"
  ).all();
  return results || [];
}

/** Deterministic. No model involved, and no hidden ordering. */
export function classifySource(url, rules, fallbackWeight = 0.35) {
  if (!url) {
    return { tier: "unclassified", label: "No source", weight: 0, matched: null };
  }
  const u = String(url).toLowerCase();
  for (const r of rules) {
    if (u.includes(String(r.pattern).toLowerCase())) {
      return { tier: r.tier, label: r.label, weight: r.weight, matched: r.pattern, note: r.note };
    }
  }
  return {
    tier: "unclassified",
    label: TIERS.unclassified.label,
    weight: Number(fallbackWeight),
    matched: null,
    note: "No rule matched this domain. Add one to classify it.",
  };
}

/** Attach a classification to each evidence row, for rendering. */
export function classifyEvidence(evidence, rules, fallbackWeight) {
  return (evidence || []).map((e) => ({
    ...e,
    source_class: classifySource(e.source_url, rules, fallbackWeight),
  }));
}

/** Which rules are actually earning their place, for the operator's UI. */
export async function ruleUsage(env, activeRules, allRules, fallbackWeight) {
  const { results } = await env.DB.prepare(
    "SELECT source_url FROM evidence WHERE source_url IS NOT NULL"
  ).all();
  const counts = new Map();
  let unmatched = 0;
  for (const row of results || []) {
    // Counted against the ACTIVE rules, so a disabled rule correctly shows
    // zero matches rather than the matches it used to have.
    const c = classifySource(row.source_url, activeRules, fallbackWeight);
    if (!c.matched) { unmatched++; continue; }
    counts.set(c.matched, (counts.get(c.matched) || 0) + 1);
  }
  return {
    rules: (allRules || activeRules).map((r) => ({
      ...r,
      enabled: !!r.enabled,
      matches: r.enabled ? (counts.get(r.pattern) || 0) : 0,
    })),
    unmatched,
    total: (results || []).length,
  };
}
