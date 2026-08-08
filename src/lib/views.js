import { formatCount, REGION_WEIGHT } from "./scoring.js";
import { t as makeT, DEFAULT_LANG } from "./i18n.js";

/**
 * Escape, and normalise punctuation on the way out.
 *
 * Abstain reasons and critic notes are written by a model and stored, so they
 * arrive here carrying em dashes. Nothing this product puts on screen uses
 * them, and "it came from the database, not from us" is a distinction the
 * person reading the screen cannot see. Converting at the render layer keeps
 * the rule absolute without rewriting stored evidence, which stays verbatim.
 */
const esc = (s) => String(s ?? "")
  .replace(/\s*—\s*/g, ", ")
  .replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const money = (n, d = 4) => `$${Number(n || 0).toFixed(d)}`;
const pct = (n) => `${Math.round((n || 0) * 100)}%`;

const REGION_SHORT = { NORTHAMERICA: "NA", EUROPE: "EU", APAC: "APAC", LATAM: "LATAM", AMEA: "AMEA" };
const regShort = (r) => REGION_SHORT[(r || "").toUpperCase()] || (r ? String(r).toUpperCase() : "");

/** Every render function receives { lang, t } from the router; this makes the
 *  contract forgiving rather than crashy if a caller ever forgets. */
const i18nCtx = (ctx) => {
  const lang = ctx?.lang || DEFAULT_LANG;
  return { lang, t: ctx?.t || makeT(lang) };
};

/** Bands are stored as keys; labels are a language concern, resolved here. */
const BAND_KEY = {
  work: "band.work", soon: "band.soon", needs_evidence: "band.abstained",
  suppressed: "band.suppressed", below: "band.below", unscored: "band.unscored",
};
const bandLabel = (t, band, fallback) => BAND_KEY[band] ? t(BAND_KEY[band]) : (fallback || band);

/* Log scale shared by every fit gauge: 10k to 100M txn/mo. */
const G_LO = 4, G_HI = 8;
const gpos = (v) => {
  const c = Math.max(10 ** G_LO, Math.min(10 ** G_HI, Number(v) || 10 ** G_LO));
  return ((Math.log10(c) - G_LO) / (G_HI - G_LO)) * 100;
};

/** The min-max range drawn against the qualification floor, on a log track. */
function gauge({ min, mid, max, floor, verdict }, t) {
  const fl = gpos(floor);
  const a = gpos(min ?? mid), b = gpos(max ?? mid), m = gpos(mid);
  const left = Math.min(a, b), width = Math.max(Math.abs(b - a), 1.5);
  return `<span class="gauge v-${esc(verdict)}" role="img" aria-label="${esc(t("gauge.aria", { mid: formatCount(mid), floor: formatCount(floor) }))}">
    <span class="trk"></span>
    <span class="fl" style="left:${fl.toFixed(1)}%"></span>
    <span class="bar" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%"></span>
    <span class="mid" style="left:${m.toFixed(1)}%"></span>
  </span>`;
}

function meter(conf, t) {
  const on = Math.round((conf || 0) * 5);
  const cls = conf >= 0.75 ? "hi" : conf < 0.5 ? "lo" : "";
  return `<span class="meter ${cls}" title="${esc(t("meter.title", { pct: pct(conf) }))}">${
    [1, 2, 3, 4, 5].map((i) => `<i class="${i <= on ? "on" : ""}"></i>`).join("")
  }</span><span class="cfv">${pct(conf)}</span>`;
}

const host = (u) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };

/**
 * The only strings the client authors itself. Resolved server-side into one
 * language and emitted as a small JSON object, so app.js never ships or
 * fetches a second dictionary.
 */
const CLIENT_KEYS = [
  "stage.research", "stage.extract", "stage.critic", "stage.score",
  "stage.research.blurb", "stage.extract.blurb", "stage.critic.blurb", "stage.score.blurb",
  "run.assessing", "run.noCarry", "run.openFull", "run.cachedMode",
  "run.stopped", "run.stoppedAfter", "run.error",
  "verdict.abstained", "verdict.noEstimate", "verdict.clears", "verdict.borderline", "verdict.below",
  "unit.txnMo", "acct.rangeConf", "ev.verbatim",
  "eval.run", "eval.running", "common.notSaved",
  "m.enterAcv", "m.ratio", "m.noInvent",
  "tier.primary", "tier.self", "tier.doc", "tier.third", "tier.unclassified",
  "rules.off", "rules.enable", "rules.disable", "rules.delete", "rules.empty",
  "rules.footA", "rules.footB", "rules.footC", "rules.loadFail",
  "set.noUnsaved", "set.unsavedOne", "set.unsavedMany", "set.saving", "set.saved", "set.saveFail",
];

export function shell({ title, nav, mode, budget, body, script = "", lang = DEFAULT_LANG, t, path }) {
  const T = t || makeT(lang);
  const other = lang === "es" ? "en" : "es";
  const from = encodeURIComponent(path || nav || "/");
  const clientCopy = JSON.stringify({
    lang,
    copy: Object.fromEntries(CLIENT_KEYS.map((k) => [k, T(k)])),
  }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html><html lang="${esc(lang)}"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Floor</title>
<link rel="stylesheet" href="/static/app.css">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%230C0C16'/><path d='M10 22V10h10M10 16h8' stroke='white' stroke-width='2.6' fill='none' stroke-linecap='square'/></svg>">
</head><body>
<header class="top">
  <a class="brand" href="/"><span class="mark"><svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 11V1h9M2 6h7" stroke="white" stroke-width="2" fill="none" stroke-linecap="square"/></svg></span><b>Floor</b><span class="sub">${esc(T("chrome.tagline"))}</span></a>
  <nav>
    ${[["/", T("nav.queue")], ["/sources", T("nav.sources")], ["/evals", T("nav.accuracy")], ["/model", T("nav.impact")], ["/backlog", T("nav.backlog")], ["/wired", T("nav.dayone")], ["/settings", T("nav.settings")]]
      .map(([href, label]) => `<a href="${href}" class="${nav === href ? "on" : ""}">${esc(label)}</a>`).join("")}
  </nav>
  ${budget ? `<div class="status ${mode === "live" ? "live" : "cached"}">
    <span class="dot"></span>${mode === "live" ? esc(T("chrome.live")) : esc(T("chrome.cached"))}
    <span class="bud" title="${esc(T("chrome.budgetTip"))}">${money(budget.remaining, 2)} ${esc(T("chrome.leftToday"))}</span>
  </div>` : ""}
  <a class="langsw" href="/lang?to=${other}&from=${from}" title="${esc(T("lang.label"))}" aria-label="${esc(T("lang.label"))}: ${esc(T("lang.switchTo"))}">${esc(T("lang.switchTo"))}</a>
</header>
${mode === "cached" ? `<div class="banner"><b>${esc(T("chrome.capReached"))}</b> ${esc(T("chrome.capBody"))}</div>` : ""}
<main>${body}</main>
<footer><span>${esc(T("chrome.footer"))}</span><span>Bryan Acevedo · ${new Date().toISOString().slice(0, 10)}</span></footer>
<script>window.FLOOR_I18N=${clientCopy}</script>
<script>${script}</script>
<script src="/static/app.js"></script>
</body></html>`;
}

/* ------------------------------- QUEUE ---------------------------------- */

const BAND_RULES = (settings, perAcct, t) => ({
  work: t("rule.work", { floor: formatCount(Number(settings.floor_txn)) }),
  soon: t("rule.soon"),
  needs_evidence: t("rule.abstained"),
  suppressed: t("rule.suppressed", { days: settings.cooldown_days }),
  below: t("rule.below"),
  unscored: perAcct
    ? t("rule.unscoredCost", { cost: money(perAcct, 2) })
    : t("rule.unscored"),
});

export async function renderQueue(env, q, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const floor = Number(q.settings.floor_txn);
  const rules = BAND_RULES(q.settings, q.cost.per_account, t);
  const bandsOrder = ["work", "soon", "needs_evidence", "suppressed", "below", "unscored"];

  // Rows arrive ranked; the band is the structure, so render group headers inline.
  let lastBand = null;
  const rowsHtml = q.rows.map((r) => {
    let out = "";
    if (r.band !== lastBand) {
      lastBand = r.band;
      out += `<tr class="grp b-${esc(r.band)}" data-band="${esc(r.band)}"><td colspan="9"><div class="grp-in">
        <span class="grp-name">${esc(bandLabel(t, r.band, r.band_label))}</span>
        <span class="grp-n">${q.counts[r.band] || 0}</span>
        <span class="grp-rule">${esc(rules[r.band] || "")}</span>
      </div></td></tr>`;
    }

    const assessed = !!r.assessment_id;
    const abstained = !!r.abstained;

    const fitCell = abstained
      ? `<span class="held" title="${esc(r.abstain_reason || "")}">${esc(t("queue.abstainedShort"))}</span>`
      : !assessed
      ? `<span class="held plain">${esc(t("queue.notAssessed"))}</span>`
      : `<div class="fitwrap">
          <span class="fitnum">${formatCount(r.txn_mid)}<span class="rng">${formatCount(r.txn_min)}&ndash;${formatCount(r.txn_max)}</span></span>
          ${gauge({ min: r.txn_min, mid: r.txn_mid, max: r.txn_max, floor, verdict: r.floor_verdict }, t)}
        </div>`;

    const confCell = assessed && !abstained ? meter(r.confidence, t) : "";

    // Mirror the scorer's driver pick: weight decayed by age, ~4 month half-life.
    const now = Date.now();
    const topSig = [...(r.signals || [])].sort((x, y) => {
      const decayed = (s) => {
        const ts = s.observed_at ? Date.parse(s.observed_at) : NaN;
        const age = isNaN(ts) ? 365 : Math.max((now - ts) / 86400000, 0);
        return (s.weight ?? 1) * Math.exp(-age / 120);
      };
      return decayed(y) - decayed(x);
    })[0];
    const tmCell = !assessed ? "" : topSig
      ? `<div class="sig"><span class="kind">${esc(topSig.kind)}</span><span class="when">${esc(topSig.observed_at || t("common.undated"))}</span></div>
         <div class="sig"><span class="none">${esc(String(topSig.description || "").slice(0, 64))}${(topSig.description || "").length > 64 ? "…" : ""}</span></div>`
      : `<span class="sig"><span class="none">${esc(t("queue.noTrigger"))}</span></span>`;

    const cdCell = r.cooldown_state === "suppressed"
      ? `<span class="cool sup">${esc(t("cool.held", { date: r.cooldown_until }))}</span>`
      : r.cooldown_state === "never_touched"
      ? `<span class="cool new">${esc(t("cool.neverTouched"))}</span>`
      : `<span class="cool ok">${esc(t("cool.eligible"))}</span>`;

    const search = `${r.name || ""} ${r.domain}`.toLowerCase();

    out += `<tr class="r${r.band === "below" ? " dim" : ""}" data-band="${esc(r.band)}" data-region="${esc(r.region || "UNKNOWN")}"
      data-name="${esc(search)}" data-rank="${r.rank}" data-txn="${r.txn_mid ?? -1}" data-conf="${r.confidence ?? -1}"
      data-timing="${r.timing_score ?? -1}" data-score="${r.total_score ?? 0}" aria-expanded="false" tabindex="0">
      <td class="rk">${r.rank}</td>
      <td class="acct">
        <a class="nm" href="/account/${encodeURIComponent(r.domain)}">${esc(r.name || r.domain)}</a>
        <span class="meta"><span>${esc(r.domain)}</span><span class="reg">${esc(regShort(r.region) || "?")}</span>${r.owner ? `<span>${esc(r.owner)}</span>` : ""}</span>
      </td>
      <td class="fit">${fitCell}</td>
      <td class="cf">${confCell}</td>
      <td class="tm">${tmCell}</td>
      <td class="cd">${cdCell}</td>
      <td class="sc">${assessed && !abstained ? r.total_score.toFixed(3) : ""}</td>
      <td class="why"><span title="${esc(r.rank_reason || "")}">${esc(r.rank_reason || "")}</span></td>
      <td class="chev"><span class="chev">›</span></td>
    </tr>`;

    // The layer beneath the row: full reason, dimensions, signals, actions.
    const dims = assessed && !abstained ? `
      <div class="xp-dims">
        <div><span class="dk">${esc(t("dim.fit"))}</span><span class="dv">${r.fit_score != null ? pct(r.fit_score) : "&ndash;"}</span><span class="dd">${esc(t("dim.vsFloor", { floor: formatCount(floor) }))}</span></div>
        <div><span class="dk">${esc(t("dim.timing"))}</span><span class="dv">${pct(r.timing_score)}</span><span class="dd">${esc(t("dim.signals", { n: (r.signals || []).length }))}</span></div>
        <div><span class="dk">${esc(t("dim.confidence"))}</span><span class="dv">${pct(r.confidence)}</span><span class="dd">${esc(t("dim.dampens"))}</span></div>
        <div><span class="dk">${esc(t("dim.region"))}</span><span class="dv">${(REGION_WEIGHT[(r.region || "UNKNOWN").toUpperCase()] ?? 0.55).toFixed(2)}</span><span class="dd">${r.region ? esc(r.region) : esc(t("common.unknown"))}</span></div>
        <div><span class="dk">${esc(t("dim.score"))}</span><span class="dv">${r.total_score.toFixed(3)}</span><span class="dd">${esc(t("dim.formula"))}</span></div>
      </div>` : "";

    const sigList = (r.signals || []).length
      ? `<ul class="xp-sigs">${r.signals.map((s) => `<li><span class="kind">${esc(s.kind)}</span><span class="desc">${esc(s.description)}</span><span class="when">${esc(s.observed_at || t("common.undated"))}</span></li>`).join("")}</ul>`
      : `<p class="xp-reason">${esc(t("sig.none"))}</p>`;

    out += `<tr class="xp" data-band="${esc(r.band)}"><td colspan="9"><div class="xp-in">
      <div class="xp-l">
        <div class="xp-k">${esc(t("xp.whyRank", { rank: r.rank }))}</div>
        <p class="xp-reason">${esc(r.rank_reason || t("xp.noRun"))}</p>
        ${dims}
        <div class="xp-actions">
          <a class="btn tiny" href="/account/${encodeURIComponent(r.domain)}">${esc(t("xp.openEvidence"))}</a>
          ${!assessed ? `<button class="btn tiny ghost assess-now" data-domain="${esc(r.domain)}">${esc(t("xp.assessNow"))}</button>` : ""}
        </div>
      </div>
      <div class="xp-r">
        <div class="xp-k">${esc(t("sig.title"))}</div>
        ${sigList}
      </div>
    </div></td></tr>`;
    return out;
  }).join("");

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("queue.eyebrow"))}</span>
      <h1>${esc(t("queue.title"))}</h1>
      <p>${t("queue.lede")}</p>
    </div>
    <div class="statgrid">
      <div><span class="k">${esc(t("queue.workNow"))}</span><span class="v">${q.counts.work || 0}</span><span class="d">${esc(t("queue.ofAccounts", { n: q.rows.length }))}</span></div>
      <div><span class="k">${esc(t("queue.assessed"))}</span><span class="v">${q.cost.assessed}</span><span class="d">${esc(t("queue.withCited"))}</span></div>
      <div><span class="k">${esc(t("queue.abstained"))}</span><span class="v">${q.counts.needs_evidence || 0}</span><span class="d">${esc(t("queue.refused"))}</span></div>
      <div><span class="k">${esc(t("queue.costPer"))}</span><span class="v mono">${q.cost.assessed ? money(q.cost.per_account) : "&ndash;"}</span><span class="d">${esc(t("queue.measured"))}</span></div>
    </div>
  </section>

  <section class="panel run">
    <div class="runbar">
      <form id="assess-form">
        <div class="field grow"><label for="assess-domain">${esc(t("field.assessOne"))}</label>
          <input id="assess-domain" placeholder="${esc(t("field.domainPh"))}" autocomplete="off" spellcheck="false"></div>
        <div class="field"><label for="assess-touched">${esc(t("field.lastTouched"))}</label>
          <input id="assess-touched" type="date" title="${esc(t("field.touchedTip"))}"></div>
        <div class="field"><label>&nbsp;</label><button class="btn primary" type="submit">${esc(t("action.assess"))}</button></div>
      </form>
      <p class="note">${esc(t("queue.runNote"))}</p>
    </div>
    <div id="assess-out" class="out"></div>
  </section>

  <section class="controls">
    <div class="filters">
      <button class="f on" data-f="all">${esc(t("action.all"))} <span class="n">${q.rows.length}</span></button>
      ${bandsOrder.map((k) => q.counts[k] ? `<button class="f" data-f="${k}">${esc(bandLabel(t, k))} <span class="n">${q.counts[k]}</span></button>` : "").join("")}
    </div>
    <div class="tools">
      <input id="qsearch" type="search" placeholder="${esc(t("action.filter"))}" autocomplete="off">
      <label class="tune" title="${esc(t("queue.cooldownTip"))}">
        ${esc(t("field.cooldownDays"))} <input id="cooldown" type="number" min="0" max="365" value="${esc(q.settings.cooldown_days)}"> ${esc(t("field.days"))}
      </label>
      <a class="btn ghost" href="/api/export.csv">${esc(t("action.export"))}</a>
      <button class="btn" id="add-open">${esc(t("action.addAccounts"))}</button>
    </div>
  </section>

  <section class="panel">
    <div class="tablewrap">
    <table class="queue">
      <thead><tr>
        <th>#</th><th>${esc(t("col.account"))}</th>
        <th class="sortable" data-sort="txn">${esc(t("col.estTxn"))} <span class="arr"></span></th>
        <th class="sortable" data-sort="conf">${esc(t("col.conf"))} <span class="arr"></span></th>
        <th class="sortable" data-sort="timing">${esc(t("col.timing"))} <span class="arr"></span></th>
        <th>${esc(t("col.cooldown"))}</th>
        <th class="num sortable" data-sort="score">${esc(t("col.score"))} <span class="arr"></span></th>
        <th class="why">${esc(t("col.why"))}</th><th></th>
      </tr></thead>
      <tbody id="qbody">${rowsHtml}</tbody>
    </table>
    </div>
    <div class="foot">${esc(t("queue.foot"))}</div>
  </section>

  <dialog id="add-dlg"><form method="dialog">
    <h3>${esc(t("action.addAccounts"))}</h3>
    <p class="hint">${t("queue.addHint")}</p>
    <textarea id="add-text" rows="9" placeholder="zalando.com&#10;asos.com,ASOS,EUROPE,2026-07-30,SDR AMEA"></textarea>
    <menu><button value="cancel" class="btn ghost">${esc(t("action.cancel"))}</button><button id="add-go" value="ok" class="btn primary">${esc(t("action.add"))}</button></menu>
  </form></dialog>`;

  return shell({ title: t("nav.queue"), nav: "/", mode: q.mode, budget: q.budget, body, lang, t, path: "/" });
}

/* ---------------------------- ACCOUNT DETAIL ----------------------------- */

export async function renderAccount(env, d, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const { account: a, assessment: s, evidence, traces, signals, scored } = d;
  const floor = Number(d.settings.floor_txn);
  const totalCost = traces.reduce((x, tr) => x + (tr.cost_usd || 0), 0);
  const totalLat = traces.reduce((x, tr) => x + (tr.latency_ms || 0), 0);
  const maxLat = Math.max(...traces.map((tr) => tr.latency_ms || 0), 1);

  // A Spanish reader must be able to tell that this specific text is verbatim
  // model output, kept in the language it was reasoned in. Label, never alter.
  const verbatimTag = lang === "es" ? ` <span class="verbatim">${esc(t("ev.verbatim"))}</span>` : "";

  const bigGauge = s && !s.abstained ? `
    <div class="bigauge">
      <span class="gauge v-${esc(scored.floor_verdict)}">
        <span class="trk"></span>
        <span class="fl" style="left:${gpos(floor).toFixed(1)}%"><span class="flmark" style="left:0">${esc(t("acct.floorMark", { floor: formatCount(floor) }))}</span></span>
        <span class="bar" style="left:${Math.min(gpos(s.txn_min), gpos(s.txn_max)).toFixed(1)}%;width:${Math.max(Math.abs(gpos(s.txn_max) - gpos(s.txn_min)), 1.5).toFixed(1)}%"></span>
        <span class="mid" style="left:${gpos(s.txn_mid).toFixed(1)}%"></span>
      </span>
      <div class="scale"><span>10k</span><span>100k</span><span>1M</span><span>10M</span><span>100M</span></div>
    </div>` : "";

  const verdictCard = !s ? `
      <div class="verdict none">
        <span class="lbl">${esc(t("band.unscored"))}</span>
        <h2>${esc(t("acct.noRun"))}</h2>
        <p>${esc(t("acct.noRunBody"))}</p>
      </div>`
    : s.abstained ? `
      <div class="verdict abstain">
        <span class="lbl">${esc(t("verdict.abstained"))}</span>
        <h2>${esc(t("verdict.noEstimate"))}</h2>
        <p class="why">${esc(s.abstain_reason || "")}${verbatimTag}</p>
        <p class="note">${esc(t("verdict.abstainNote"))}</p>
      </div>`
    : `
      <div class="verdict ${esc(scored.floor_verdict)}">
        <span class="lbl">${scored.floor_verdict === "clears" ? esc(t("verdict.clears")) : scored.floor_verdict === "borderline" ? esc(t("verdict.borderline")) : esc(t("verdict.below"))}</span>
        <h2>${formatCount(s.txn_mid)}<span class="unit">${esc(t("unit.txnMo"))}</span></h2>
        <p class="range">${t("acct.rangeConf", { min: formatCount(s.txn_min), max: formatCount(s.txn_max), conf: pct(s.confidence) })}</p>
        ${bigGauge}
        <p class="method">${esc(s.method || "")}</p>
      </div>`;

  const VD_WORD = { supported: t("ev.supported"), uncertain: t("ev.uncertain"), unsupported: t("ev.unsupported") };
  const evCounts = evidence.reduce((acc, e) => {
    const v = e.verdict || "uncertain"; acc[v] = (acc[v] || 0) + 1; return acc;
  }, {});
  const evRows = evidence.map((e) => `
    <tr class="v-${esc(e.verdict || "uncertain")}" data-ev="${esc(e.verdict || "uncertain")}">
      <td class="f">${esc(e.field)}</td>
      <td class="val">${esc(e.value)}</td>
      <td class="m">${esc(e.method || "")}</td>
      <td><span class="tier t-${esc(e.source_class?.tier || "unclassified")}" title="${esc(e.source_class?.note || "")}${e.source_class?.matched ? ` (${esc(t("ev.rule"))}: ${esc(e.source_class.matched)})` : ""}">${esc(e.source_class?.label || t("tier.unclassified"))}</span></td>
      <td><span class="vd ${esc(e.verdict)}">${esc(VD_WORD[e.verdict] || e.verdict || t("ev.uncertain"))}</span>${e.critic_note ? `<span class="cn" title="${esc(t("ev.verbatim"))}">${esc(e.critic_note)}</span>` : ""}</td>
      <td>${e.source_url
        ? `<a class="srclink" href="${esc(e.source_url)}" target="_blank" rel="noopener" title="${esc(e.source_title || e.source_url)}"><span class="host">${esc(host(e.source_url))}</span> ↗</a>`
        : `<span class="nosrc">${esc(t("ev.noSource"))}</span>`}</td>
    </tr>`).join("") || `<tr><td colspan="6"><p class="empty">${esc(t("ev.empty"))}</p></td></tr>`;

  const sigRows = signals.map((g) => `
    <li><span class="kind">${esc(g.kind)}</span>
      <span class="desc">${esc(g.description)}</span>
      <span class="when">${esc(g.observed_at || t("common.undated"))}</span>
      ${g.url ? `<a href="${esc(g.url)}" target="_blank" rel="noopener">↗</a>` : ""}</li>`).join("")
    || `<li class="empty">${esc(t("sig.none"))}</li>`;

  const STEP_BLURB = {
    research: t("trace.research"),
    extract: t("trace.extract"),
    critic: t("trace.critic"),
  };
  const traceRows = traces.map((tr, i) => `
    <div class="tr" data-open="false">
      <div class="tr-head" role="button" tabindex="0" aria-expanded="false">
        <span class="tr-step"><span class="i">${i + 1}</span>${esc(tr.step)}</span>
        <span class="tr-model">${esc(tr.model)}<span class="eff">${esc(tr.effort || "")}</span></span>
        <span class="tr-lat"><span class="t">${((tr.latency_ms || 0) / 1000).toFixed(1)}s</span><span class="b"><i style="width:${Math.max(((tr.latency_ms || 0) / maxLat) * 100, 2).toFixed(0)}%"></i></span></span>
        <span class="tr-cost">${money(tr.cost_usd, 5)}</span>
        <span class="tr-tok">${((tr.input_tokens || 0) + (tr.output_tokens || 0)).toLocaleString()} tok</span>
        <span class="chev">›</span>
      </div>
      <div class="tr-body" hidden>
        <div class="tr-grid">
          <div><span class="k">${esc(t("trace.input"))}</span><span class="v">${(tr.input_tokens || 0).toLocaleString()}</span></div>
          <div><span class="k">${esc(t("trace.output"))}</span><span class="v">${(tr.output_tokens || 0).toLocaleString()}</span></div>
          <div><span class="k">${esc(t("trace.cacheRead"))}</span><span class="v">${(tr.cache_read || 0).toLocaleString()}</span></div>
          <div><span class="k">${esc(t("trace.searches"))}</span><span class="v">${tr.searches || 0}</span></div>
          <div><span class="k">${esc(t("trace.stop"))}</span><span class="v">${esc(tr.stop_reason || "")}</span></div>
        </div>
        <p class="tr-note">${esc(STEP_BLURB[tr.step] || "")}${tr.note ? " " + esc(tr.note) : ""}</p>
      </div>
    </div>`).join("");

  const scorerRow = s ? `
    <div class="tr scorer">
      <div class="tr-head" style="cursor:default">
        <span class="tr-step"><span class="i">=</span>${esc(t("trace.scorerName"))}</span>
        <span class="tr-model">${esc(t("trace.scorerDesc"))}</span>
        <span class="tr-lat"><span class="t">&lt;1ms</span><span class="b"><i style="width:2%"></i></span></span>
        <span class="tr-cost">$0.00000</span>
        <span class="tr-tok"></span>
        <span></span>
      </div>
    </div>` : "";

  const body = `
  <section class="crumbs"><a href="/">← ${esc(t("nav.queue"))}</a></section>
  <section class="acct-head">
    <div>
      <h1>${esc(a.name || a.domain)}</h1>
      <p class="dom"><a href="https://${esc(a.domain)}" target="_blank" rel="noopener"><code>${esc(a.domain)}</code></a>
        <span class="sep">·</span> ${a.region ? esc(a.region) : esc(t("acct.regionUnknown"))} <span class="sep">·</span> ${esc(t("acct.weight"))} ${(REGION_WEIGHT[(a.region || "UNKNOWN").toUpperCase()] ?? 0.55).toFixed(2)}
        ${a.owner ? `<span class="sep">·</span> ${esc(a.owner)}` : ""}</p>
    </div>
    ${scored ? `<div class="acct-score"><div class="box"><span class="k">${esc(t("dim.score"))}</span><span class="v">${scored.total_score.toFixed(3)}</span></div><span class="pill ${esc(scored.band)}">${esc(bandLabel(t, scored.band, scored.band_label))}</span></div>` : ""}
  </section>

  <section class="split">
    ${verdictCard}
    <div class="dims">
      <div><span class="k">${esc(t("dim.fit"))}</span><div><span class="v">${scored?.fit_score != null ? pct(scored.fit_score) : "&ndash;"}</span><span class="d">${esc(t("dim.vsFloorLong", { floor: formatCount(floor) }))}</span></div></div>
      <div><span class="k">${esc(t("dim.timing"))}</span><div><span class="v">${scored ? pct(scored.timing_score) : "&ndash;"}</span><span class="d">${signals.length ? esc(t("dim.signalsDecay", { n: signals.length })) : esc(t("dim.noDatedReason"))}</span></div></div>
      <div><span class="k">${esc(t("col.cooldown"))}</span><div><span class="v word">${scored?.cooldown_state === "suppressed" ? esc(t("cool.word.held")) : scored?.cooldown_state === "never_touched" ? esc(t("cool.word.fresh")) : esc(t("cool.word.clear"))}</span>
        <span class="d">${scored?.cooldown_state === "suppressed" ? esc(t("cool.touchedAgo", { d: scored.cooldown_days_since, date: scored.cooldown_until })) : a.last_touched_at ? esc(t("cool.lastTouched", { date: a.last_touched_at })) : esc(t("cool.neverTouched"))}</span></div></div>
      <div><span class="k">${esc(t("dim.confidence"))}</span><div><span class="v">${s && !s.abstained ? pct(s.confidence) : "&ndash;"}</span><span class="d">${esc(t("dim.dampensLong"))}</span></div></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("ev.title"))} <span class="sub">${t("ev.sub")} ${t("ev.subMore")}${lang === "es" ? ` <span class="verbatim-note">${esc(t("ev.langNote"))}</span>` : ""}</span>
      ${evidence.length ? `<span class="filters small">
        <button class="f on" data-ef="all">${esc(t("action.all"))} <span class="n">${evidence.length}</span></button>
        ${["supported", "uncertain", "unsupported"].map((v) => evCounts[v] ? `<button class="f" data-ef="${v}">${esc(VD_WORD[v])} <span class="n">${evCounts[v]}</span></button>` : "").join("")}
      </span>` : ""}
    </div>
    <div class="tablewrap">
    <table class="ev"><thead><tr><th>${esc(t("ev.field"))}</th><th>${esc(t("ev.value"))}</th><th>${esc(t("ev.method"))}</th>
      <th title="${esc(t("ev.sourceTypeTip"))}">${esc(t("ev.sourceType"))}</th>
      <th title="${esc(t("ev.criticTip"))}">${esc(t("ev.critic"))}</th>
      <th>${esc(t("ev.source"))}</th></tr></thead>
    <tbody id="evbody">${evRows}</tbody></table>
    </div>
  </section>

  <section class="two">
    <div class="panel">
      <h3>${esc(t("sig.title"))}</h3>
      <ul class="signals">${sigRows}</ul>
    </div>
    <div class="panel">
      <h3>${esc(t("acct.whyTitle"))}</h3>
      <div class="pad">
        <p class="reason">${esc(scored?.rank_reason || t("xp.noRun"))}</p>
        <p class="hint">${esc(t("acct.rankHint"))}</p>
      </div>
    </div>
  </section>

  ${traces.length ? `
  <section class="panel">
    <h3>${esc(t("trace.title"))} <span class="sub">${esc(t("trace.sub", { cost: money(totalCost, 5), sec: (totalLat / 1000).toFixed(1), n: traces.length }))}</span></h3>
    <div class="trace-list">${traceRows}${scorerRow}</div>
    <div class="foot">${esc(t("trace.foot"))}</div>
  </section>` : ""}`;

  return shell({
    title: a.name || a.domain, nav: "/", mode: "live", budget: null, body,
    lang, t, path: `/account/${encodeURIComponent(a.domain)}`,
  });
}

/* ------------------------------- EVALS ---------------------------------- */

export async function renderEvals(env, ev, gold, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const l = ev.latest;
  const rate = (num, den) => (den ? `${Math.round((num / den) * 100)}%` : "&ndash;");
  const progPct = gold.total ? Math.round((gold.verified / gold.total) * 100) : 0;

  const goldRows = gold.rows.map((g) => `
    <tr class="${g.verified ? "ok" : "pending"}">
      <td>${esc(g.name || g.domain)}<span class="dom">${esc(g.domain)}</span></td>
      <td class="m">${esc(g.disclosed_metric || "")}</td>
      <td class="num mono">${g.verified ? formatCount(g.disclosed_value) : ""}</td>
      <td>${g.source_url
        ? `<a class="srclink" href="${esc(g.source_url)}" target="_blank" rel="noopener"><span class="host">${esc(host(g.source_url))}</span> ↗</a>`
        : `<span class="hintx">${esc(g.source_note || "")}</span>`}</td>
      <td>${g.verified ? `<span class="vd supported">${esc(t("gold.verifiedChip"))}</span>` : `<button class="btn tiny ghost verify" data-domain="${esc(g.domain)}" data-name="${esc(g.name || "")}" data-metric="${esc(g.disclosed_metric || "")}">${esc(t("gold.enter"))}</button>`}</td>
    </tr>`).join("");

  const itemRows = (ev.items || []).map((i) => `
    <tr>
      <td>${esc(i.domain)}</td>
      <td class="num mono">${formatCount(i.truth)}</td>
      <td class="num mono">${i.abstained ? "" : `${formatCount(i.pred_min)}&ndash;${formatCount(i.pred_max)}`}</td>
      <td>${i.abstained ? `<span class="vd held">${esc(t("eval.vAbstained"))}</span>`
        : i.in_band ? `<span class="vd supported">${esc(t("eval.vInBand"))}</span>` : `<span class="vd unsupported">${esc(t("eval.vOutside"))}</span>`}</td>
      <td>${i.abstained ? "" : i.floor_correct ? `<span class="vd supported">${esc(t("eval.vCorrect"))}</span>` : `<span class="vd unsupported">${esc(t("eval.vWrong"))}</span>`}</td>
      <td>${i.source_url ? `<a class="srclink" href="${esc(i.source_url)}" target="_blank" rel="noopener"><span class="host">${esc(host(i.source_url))}</span> ↗</a>` : ""}</td>
    </tr>`).join("");

  const emptyEval = `
    <div class="steps">
      <div class="step ${gold.verified ? "done" : "next"}">
        <span class="sn">1</span>
        <div><b>${esc(t("gold.dlgTitle"))}</b><p>${esc(t("eval.step1"))} ${gold.verified ? esc(t("eval.nDone", { n: gold.verified })) : esc(t("eval.noneYet"))}</p></div>
      </div>
      <div class="step"><span class="sn">2</span><div><b>${esc(t("eval.step2t"))}</b><p>${esc(t("eval.step2"))}</p></div></div>
      <div class="step"><span class="sn">3</span><div><b>${esc(t("eval.step3t"))}</b><p>${esc(t("eval.step3"))}</p></div></div>
    </div>`;

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("eval.eyebrow"))}</span>
      <h1>${esc(t("eval.title"))}</h1>
      <p>${t("eval.lede")}</p>
    </div>
    <div class="statgrid">
      <div><span class="k">${esc(t("eval.floorCorrect"))}</span><span class="v ${l ? "" : "quiet"}">${l ? rate(l.floor_correct, l.n_scored) : "&ndash;"}</span><span class="d">${l ? esc(t("eval.ofScored", { a: l.floor_correct, b: l.n_scored })) : esc(t("eval.noRunYet"))}</span></div>
      <div><span class="k">${esc(t("eval.inBand"))}</span><span class="v ${l ? "" : "quiet"}">${l ? rate(l.in_band, l.n_scored) : "&ndash;"}</span><span class="d">${l ? esc(t("eval.ofN", { a: l.in_band, b: l.n_scored })) : esc(t("eval.noRunYet"))}</span></div>
      <div><span class="k">${esc(t("eval.abstainRate"))}</span><span class="v ${l ? "" : "quiet"}">${l ? rate(l.abstained, l.n) : "&ndash;"}</span><span class="d">${esc(t("eval.reported"))}</span></div>
      <div><span class="k">${esc(t("eval.goldVerified"))}</span><span class="v">${gold.verified}<span style="color:var(--ink-4)">/${gold.total}</span></span><span class="d">${esc(t("eval.humanChecked"))}</span></div>
    </div>
  </section>

  <section class="panel">
    <div class="panel-head">${esc(t("eval.latest"))} <span class="sub">${l ? esc(t("eval.runMeta", { n: l.n, date: l.run_at || "" })) : esc(t("eval.notRun"))}</span>
      <button class="btn primary tiny" id="run-eval">${esc(t("eval.run"))}</button></div>
    ${l ? `<div class="tablewrap"><table class="ev"><thead><tr><th>${esc(t("eval.merchant"))}</th><th class="num">${esc(t("eval.disclosed"))}</th><th class="num">${esc(t("eval.predicted"))}</th><th>${esc(t("eval.inBandCol"))}</th><th>${esc(t("eval.floorCall"))}</th><th>${esc(t("eval.checkIt"))}</th></tr></thead><tbody>${itemRows}</tbody></table></div>`
        : emptyEval}
    <div class="foot">${esc(t("eval.foot"))}</div>
  </section>

  <section class="panel">
    <h3>${esc(t("gold.title"))} <span class="sub">${esc(t("gold.sub"))}</span></h3>
    <div class="goldbar">
      <div class="prog"><i style="width:${progPct}%"></i></div>
      <span class="lab">${esc(t("gold.progress", { a: gold.verified, b: gold.total }))}</span>
    </div>
    <div class="tablewrap">
    <table class="ev"><thead><tr><th>${esc(t("eval.merchant"))}</th><th>${esc(t("gold.metric"))}</th><th class="num">${esc(t("gold.monthly"))}</th><th>${esc(t("ev.source"))}</th><th></th></tr></thead>
      <tbody>${goldRows}</tbody></table>
    </div>
    <div class="foot">${esc(t("gold.foot", { n: gold.total }))}</div>
  </section>

  <dialog id="gold-dlg"><form method="dialog">
    <h3>${esc(t("gold.dlgTitle"))}</h3>
    <p class="hint">${t("gold.dlgHint")}</p>
    <input id="g-domain" readonly>
    <input id="g-metric" placeholder="${esc(t("gold.phMetric"))}">
    <input id="g-value" type="number" placeholder="${esc(t("gold.phValue"))}">
    <input id="g-period" placeholder="${esc(t("gold.phPeriod"))}">
    <input id="g-url" placeholder="${esc(t("gold.phUrl"))}">
    <menu><button value="cancel" class="btn ghost">${esc(t("action.cancel"))}</button><button id="g-save" value="ok" class="btn primary">${esc(t("action.save"))}</button></menu>
  </form></dialog>`;

  return shell({ title: t("nav.accuracy"), nav: "/evals", mode: "live", budget: null, body, lang, t, path: "/evals" });
}

/* ------------------------------- SOURCES --------------------------------- */

const covCell = (level, region, covWord) =>
  `<span class="cc c-${esc(level)}" title="${esc(region)}: ${esc(covWord[level] || level)}"><i></i><i></i><i></i></span>`;

export async function renderSources(env, s, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const regions = s.regions;
  const COV_WORD = { strong: t("cov.strong"), partial: t("cov.partial"), weak: t("cov.weak"), none: t("cov.none") };

  const srcRows = s.sources.map((src) => `
    <div class="src ${src.status === "connected" ? "live" : ""}" data-open="false">
      <div class="src-head" role="button" tabindex="0" aria-expanded="false">
        <span class="src-st ${esc(src.status)}" title="${esc(src.status)}"></span>
        <span class="src-name">${esc(src.name)}<span class="src-what">${esc(src.what)}</span></span>
        <span class="src-kind k-${esc(src.kind)}">${esc(src.kind)}</span>
        <span class="src-cost">${esc(src.cost)}</span>
        <span class="src-cov">${regions.map((r) => covCell(src.coverage[r], r, COV_WORD)).join("")}</span>
        <span class="chev">›</span>
      </div>
      <div class="src-body" hidden>
        <div class="src-grid">
          <div><span class="xp-k">${esc(t("src.unlocks"))}</span><p>${esc(src.unlocks)}</p></div>
          <div><span class="xp-k">${esc(t("src.limits"))}</span><p>${esc(src.limits)}</p></div>
          <div><span class="xp-k">${esc(t("src.covByRegion"))}</span>
            <ul class="src-regions">${regions.map((r) => `<li><span class="rn">${esc(regShort(r))}</span>${covCell(src.coverage[r], r, COV_WORD)}<span class="rw">${esc(COV_WORD[src.coverage[r]] || src.coverage[r])}</span></li>`).join("")}</ul>
          </div>
        </div>
      </div>
    </div>`).join("");

  const cmpRows = s.coverage_now.map((now, i) => {
    const wired = s.coverage_wired[i];
    const upgraded = now.level !== wired.level;
    return `<div class="cmp-row">
      <span class="cmp-reg">${esc(regShort(now.region))}${regShort(now.region) !== now.region ? `<span class="full">${esc(now.region)}</span>` : ""}</span>
      <span class="cmp-cell">${covCell(now.level, now.region, COV_WORD)}<span class="rw">${esc(COV_WORD[now.level] || now.level)}</span></span>
      <span class="cmp-arrow ${upgraded ? "up" : ""}">→</span>
      <span class="cmp-cell">${covCell(wired.level, wired.region, COV_WORD)}<span class="rw">${esc(COV_WORD[wired.level] || wired.level)}</span></span>
      <span class="cmp-who">${wired.contributors.length ? esc(wired.contributors.slice(0, 3).join(" · ")) + (wired.contributors.length > 3 ? ` ${esc(t("src.nMore", { n: wired.contributors.length - 3 }))}` : "") : esc(t("src.nothingWired"))}</span>
    </div>`;
  }).join("");

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("src.eyebrow"))}</span>
      <h1>${esc(t("src.title"))}</h1>
      <p>${esc(t("src.note"))} ${t("src.lede")}</p>
    </div>
    <div class="statgrid">
      <div><span class="k">${esc(t("src.connected"))}</span><span class="v">${s.connected}<span style="color:var(--ink-4)">/${s.total}</span></span><span class="d">${esc(t("src.webSearch"))}</span></div>
      <div><span class="k">${esc(t("src.freeUnwired"))}</span><span class="v">${s.free_and_unwired}</span><span class="d">${esc(t("src.regulatorData"))}</span></div>
      <div><span class="k">${esc(t("src.regions"))}</span><span class="v">${s.regions.length}</span><span class="d">${esc(t("src.territory"))}</span></div>
    </div>
  </section>

  <section class="panel">
    <h3>${esc(t("src.covTitle"))} <span class="sub">${esc(t("src.covSub"))}</span></h3>
    <div class="cmp">
      <div class="cmp-row head"><span class="cmp-reg"></span><span class="cmp-cell">${esc(t("src.now"))}</span><span class="cmp-arrow"></span><span class="cmp-cell">${esc(t("src.wired"))}</span><span class="cmp-who">${esc(t("src.whoLifts"))}</span></div>
      ${cmpRows}
    </div>
    <div class="foot">${esc(t("src.covFoot"))}</div>
  </section>

  <section class="panel">
    <h3>${esc(t("src.regTitle"))} <span class="sub">${esc(t("src.regSub"))}</span>
      <span class="cov-legend">${["strong", "partial", "weak", "none"].map((l) => `<span>${covCell(l, "", COV_WORD)}${esc(COV_WORD[l])}</span>`).join("")}</span></h3>
    <div class="src-cols"><span></span><span></span><span></span><span></span><span class="src-cov">${regions.map((r) => `<span class="rn" title="${esc(r)}">${esc({ NORTHAMERICA: "NA", EUROPE: "EU", APAC: "AP", LATAM: "LA", AMEA: "AM" }[r] || r.slice(0, 2))}</span>`).join("")}</span><span></span></div>
    <div class="src-list">${srcRows}</div>
    <div class="foot">${esc(t("src.regFoot"))}</div>
  </section>

  <section class="panel" id="rules-panel">
    <h3>${esc(t("rules.title"))}
      <span class="sub">${esc(t("rules.sub"))}</span>
      <button class="btn tiny primary right" id="rule-open">${esc(t("rules.add"))}</button></h3>
    <div class="tablewrap">
      <table class="ev" id="rules-table">
        <thead><tr><th class="num">${esc(t("rules.order"))}</th><th>${esc(t("rules.pattern"))}</th><th>${esc(t("rules.tier"))}</th><th class="num">${esc(t("rules.weight"))}</th><th class="num">${esc(t("rules.matches"))}</th><th>${esc(t("rules.why"))}</th><th></th></tr></thead>
        <tbody id="rulesbody"><tr><td colspan="7"><p class="empty">${esc(t("common.loading"))}…</p></td></tr></tbody>
      </table>
    </div>
    <div class="foot" id="rules-foot"></div>
  </section>

  <dialog id="rule-dlg"><form method="dialog">
    <h3>${esc(t("rules.dlgTitle"))}</h3>
    <p class="hint">${esc(t("rules.dlgHint"))}</p>
    <input id="r-pattern" placeholder="${esc(t("rules.phPattern"))}">
    <select id="r-tier">
      <option value="primary_filing">${esc(t("tier.primaryStrong"))}</option>
      <option value="self_published">${esc(t("tier.self"))}</option>
      <option value="documentation">${esc(t("tier.doc"))}</option>
      <option value="third_party">${esc(t("tier.third"))}</option>
    </select>
    <input id="r-label" placeholder="${esc(t("rules.phLabel"))}">
    <input id="r-weight" type="number" step="0.05" min="0" max="1" value="0.8" placeholder="${esc(t("rules.phWeight"))}">
    <input id="r-position" type="number" value="500" placeholder="${esc(t("rules.phPosition"))}">
    <input id="r-note" placeholder="${esc(t("rules.phNote"))}">
    <menu><button value="cancel" class="btn ghost">${esc(t("action.cancel"))}</button><button id="r-save" value="ok" class="btn primary">${esc(t("rules.add"))}</button></menu>
  </form></dialog>`;

  return shell({ title: t("nav.sources"), nav: "/sources", mode: "live", budget: null, body, lang, t, path: "/sources" });
}

/* ------------------------------- BACKLOG -------------------------------- */

export async function renderBacklog(env, b, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const ST_WORD = { idea: t("bl.st.idea"), building: t("bl.st.building"), live: t("bl.st.live") };
  const zones = b.areas.map((area) => `
    <div class="zone">
      <h3>${esc(area)} <span class="count">${b.byArea[area].length}</span></h3>
      <div class="cards">
        ${b.byArea[area].map((c) => `
          <article class="card ${esc(c.status)}">
            <span class="st">${esc(ST_WORD[c.status] || c.status)}</span>
            <h4>${c.link ? `<a href="${esc(c.link)}">${esc(c.title)}</a>` : esc(c.title)}</h4>
            ${c.gap ? `<p class="gap"><b>${esc(t("bl.gap"))}</b> ${esc(c.gap)}</p>` : ""}
            ${c.metric ? `<p class="met"><b>${esc(t("bl.moves"))}</b> ${esc(c.metric)}</p>` : ""}
            <span class="own">${esc(c.owner || t("bl.unassigned"))}</span>
          </article>`).join("") || `<p class="empty">${esc(t("common.empty"))}</p>`}
      </div>
    </div>`).join("");

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("bl.eyebrow"))}</span>
      <h1>${esc(t("bl.title"))}</h1>
      <p>${esc(t("bl.lede"))}</p>
    </div>
    <div class="statgrid">
      <div><span class="k">${esc(t("bl.live"))}</span><span class="v">${b.live}</span><span class="d">${esc(t("bl.shipped"))}</span></div>
      <div><span class="k">${esc(t("bl.total"))}</span><span class="v">${b.total}</span><span class="d">${esc(t("bl.acrossAreas", { n: b.areas.length }))}</span></div>
      <div><span class="k">${esc(t("bl.addOne"))}</span><span class="v"><button class="btn tiny primary" id="card-open">${esc(t("bl.newCard"))}</button></span><span class="d">${esc(t("bl.gapMetricReq"))}</span></div>
    </div>
  </section>
  <section class="zones">${zones}</section>

  <dialog id="card-dlg"><form method="dialog">
    <h3>${esc(t("bl.dlgTitle"))}</h3>
    <select id="c-area">${b.areas.map((a) => `<option>${esc(a)}</option>`).join("")}</select>
    <input id="c-title" placeholder="${esc(t("bl.phTitle"))}">
    <input id="c-gap" placeholder="${esc(t("bl.phGap"))}">
    <input id="c-metric" placeholder="${esc(t("bl.phMetric"))}">
    <input id="c-owner" placeholder="${esc(t("bl.phOwner"))}">
    <select id="c-status"><option value="idea">${esc(t("bl.st.idea"))}</option><option value="building">${esc(t("bl.st.building"))}</option><option value="live">${esc(t("bl.st.live"))}</option></select>
    <menu><button value="cancel" class="btn ghost">${esc(t("action.cancel"))}</button><button id="c-save" value="ok" class="btn primary">${esc(t("bl.addCard"))}</button></menu>
  </form></dialog>`;

  return shell({ title: t("nav.backlog"), nav: "/backlog", mode: "live", budget: null, body, lang, t, path: "/backlog" });
}

/* -------------------------------- MODEL --------------------------------- */

export async function renderModel(env, q, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const perAcct = q.cost.per_account;

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("m.eyebrow"))}</span>
      <h1>${esc(t("m.title"))}</h1>
      <p>${t("m.lede")}</p>
    </div>
  </section>

  <section class="panel model">
    <div class="inputs">
      <span class="grp-t">${esc(t("m.grpToday"))}</span>
      <label>${esc(t("m.sdrs"))} <input id="m-sdrs" type="number" value="5"></label>
      <label>${esc(t("m.worked"))} <input id="m-worked" type="number" value="65"></label>
      <label>${esc(t("m.mins"))} <input id="m-mins" type="number" value="30"></label>
      <label>${esc(t("m.conv"))} <input id="m-conv" type="number" step="0.1" value="7"><span class="u">%</span></label>
      <label>${esc(t("m.win"))} <input id="m-win" type="number" step="0.1" value="4.6"><span class="u">%</span></label>
      <span class="grp-t">${esc(t("m.grpFloor"))}</span>
      <label>${esc(t("m.mins"))} <input id="m-mins2" type="number" value="5"></label>
      <label>${esc(t("m.conv"))} <input id="m-conv2" type="number" step="0.1" value="10.5"><span class="u">%</span></label>
      <label>${esc(t("m.winTarget"))} <input id="m-win2" type="number" step="0.1" value="11.5"><span class="u">%</span></label>
      <label>${esc(t("m.costPer"))} <input id="m-cost" type="number" step="0.0001" value="${perAcct}"><span class="u">USD</span></label>
      <label class="acv"><span class="t">${esc(t("m.acv"))}</span>
        <input id="m-acv" type="number" placeholder="${esc(t("m.acvPh"))}">
        <span class="n">${esc(t("m.acvNote"))}</span></label>
    </div>

    <div class="outs">
      <div><span class="k">${esc(t("m.oHours"))}</span><span class="v" id="o-hours">&ndash;</span><span class="d">${esc(t("m.oHoursD"))}</span></div>
      <div><span class="k">${esc(t("m.oExtra"))}</span><span class="v" id="o-extra">&ndash;</span><span class="d">${esc(t("m.oExtraD"))}</span></div>
      <div><span class="k">${esc(t("m.oOpps"))}</span><span class="v" id="o-opps">&ndash;</span><span class="d">${esc(t("m.oOppsD"))}</span></div>
      <div><span class="k">${esc(t("m.oCost"))}</span><span class="v" id="o-cost">&ndash;</span><span class="d">${esc(t("m.oCostD"))}</span></div>
      <div class="wide"><span class="k">${esc(t("m.oValue"))}</span><span class="v held-v" id="o-value">${esc(t("m.enterAcv"))}</span><span class="d" id="o-ratio"></span></div>
    </div>

    <p class="argument">${t("m.argument")}</p>
  </section>`;

  return shell({ title: t("nav.impact"), nav: "/model", mode: q.mode, budget: q.budget, body, lang, t, path: "/model" });
}

/* --------------------------- DAY ONE / WIRED ----------------------------- */

export async function renderWired(env, ctx = {}) {
  const { lang, t } = i18nCtx(ctx);
  const systems = [
    ["Salesforce", t("w.sf.now"), t("w.sf.later")],
    ["Apollo", t("w.apollo.now"), t("w.apollo.later")],
    ["Sales Navigator", t("w.notUsed"), t("w.nav.later")],
    ["Gong Engage", t("w.notUsed"), t("w.gong.later")],
    [t("w.bc.name"), t("w.bc.now"), t("w.bc.later")],
    [t("w.prov.name"), t("w.prov.now"), t("w.prov.later")],
  ];

  const body = `
  <section class="hero">
    <div class="lede">
      <span class="eyebrow">${esc(t("w.eyebrow"))}</span>
      <h1>${esc(t("w.title"))}</h1>
      <p>${esc(t("w.lede"))}</p>
    </div>
  </section>

  <section class="wired">
    ${systems.map(([name, now, later], i) => `
      <article>
        <h3><span class="n">0${i + 1}</span>${esc(name)}</h3>
        <div class="row"><span class="t">${esc(t("w.today"))}</span><span>${esc(now)}</span></div>
        <div class="row later"><span class="t">${esc(t("w.wired"))}</span><span>${esc(later)}</span></div>
      </article>`).join("")}
  </section>

  <section class="panel honest">
    <h3>${esc(t("w.honestTitle"))}</h3>
    <div class="pad"><ul>
      <li>${esc(t("w.h1"))}</li>
      <li>${esc(t("w.h2"))}</li>
      <li>${esc(t("w.h3"))}</li>
      <li>${esc(t("w.h4"))}</li>
    </ul></div>
  </section>`;

  return shell({ title: t("nav.dayone"), nav: "/wired", mode: "live", budget: null, body, lang, t, path: "/wired" });
}
