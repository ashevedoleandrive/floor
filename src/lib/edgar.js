/**
 * SEC EDGAR. The second source, and the one that makes accuracy measurable.
 *
 * Until now Floor had exactly one connected source: open web search. That meant
 * any automated check on its own output would be reading the same web through
 * the same eyes, which is circular, which is why the first design reached for a
 * human to supply ground truth instead. The human was standing in for a second
 * source that had not been wired.
 *
 * EDGAR is that second source. It is free, it is a regulator's own document
 * store, and reaching it is a direct lookup rather than a search. Predictions
 * come from open research; truth comes from a filing. Different source,
 * different access path, different failure modes, and none of it depends on
 * somebody remembering to open a PDF.
 *
 * What it does NOT give us, checked rather than assumed: order and transaction
 * counts are not in XBRL. The structured facts carry standard accounting tags
 * only, so the figures Floor cares about live in prose inside 10-Qs, 10-Ks and
 * the press releases attached to 8-Ks. EDGAR's contribution is therefore
 * authoritative *documents*, not structured numbers, and reading them is
 * handled in truth.js under its own constraints.
 *
 * SEC access rules, which are not optional: a User-Agent identifying the caller,
 * and courtesy on request rate. Both are honoured here.
 */

const UA = "Floor account qualification (bryan@leandrive.io)";
const HEADERS = { "user-agent": UA, accept: "application/json" };

/** Filings that actually carry disclosed volume figures. */
export const VOLUME_FORMS = ["10-Q", "10-K", "8-K", "20-F", "6-K", "40-F"];

const norm = (s) => String(s || "")
  .toLowerCase()
  .replace(/[.,]/g, "")
  .replace(/\b(inc|corp|corporation|company|co|plc|ltd|limited|holdings?|group|sa|nv|ag|se)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

/**
 * Company name and domain to CIK.
 *
 * The ticker index is ~800KB and changes rarely, so it is fetched through
 * Cloudflare's cache with a long TTL rather than on every call.
 */
export async function resolveCik(env, { domain, name }) {
  let index;
  try {
    const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: HEADERS,
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!r.ok) return { ok: false, reason: `ticker index returned ${r.status}` };
    index = await r.json();
  } catch (e) {
    return { ok: false, reason: `ticker index unreachable: ${e.message}` };
  }

  const rows = Object.values(index || {});
  if (!rows.length) return { ok: false, reason: "ticker index was empty" };

  const host = String(domain || "").toLowerCase().replace(/^www\./, "");
  const stem = norm(host.split(".")[0]);
  const wanted = norm(name) || stem;

  // Names shortlist. Domains decide.
  //
  // Matching on the name alone is wrong in both directions. "allegro.pl" is a
  // Polish marketplace and "allegro" prefixes "ALLEGRO MICROSYSTEMS, INC.", a US
  // semiconductor company, so a prefix rule returned the wrong CIK with high
  // confidence and would have read a chip maker's 10-Q as ground truth. Demanding
  // an exact name instead then lost Lululemon and Peloton, whose legal names
  // carry extra words.
  //
  // The domain settles it, because a company states its own website on the cover
  // of its filings. DoorDash's 10-Q contains "doordash.com". Allegro
  // MicroSystems' 10-Q contains "allegromicro.com" and never "allegro.pl". So
  // names only shortlist, and a candidate is accepted only once its own filing
  // says the domain out loud.
  const shortlist = [];
  for (const row of rows) {
    const t = norm(row.title);
    if (!t) continue;
    const squash = (x) => x.replace(/ /g, "");
    let rank = 0;
    if (t === wanted || t === stem) rank = 100;
    else if (squash(t) === squash(stem) || squash(t) === squash(wanted)) rank = 95;
    else if (stem && (t.startsWith(stem + " ") || squash(t).startsWith(squash(stem)))) rank = 60;
    else if (wanted && t.startsWith(wanted + " ")) rank = 55;
    if (rank) shortlist.push({ rank, row });
  }
  if (!shortlist.length) return { ok: false, reason: `no candidate named like ${domain}` };
  shortlist.sort((a, b) => b.rank - a.rank);

  for (const cand of shortlist.slice(0, 4)) {
    const cik = String(cand.row.cik_str).padStart(10, "0");
    const confirmed = await filingMentionsDomain(env, cik, host);
    if (confirmed) {
      return {
        ok: true, cik, name: cand.row.title, ticker: cand.row.ticker,
        confidence: 100, confirmed_by: "domain in filing",
      };
    }
  }

  // Nothing confirmed by domain. Fall back to an EXACT name, which is still a
  // defensible identification: a foreign private issuer's 20-F may simply not
  // print its consumer domain, and MercadoLibre, Grab, Trip.com and Jumia were
  // all lost this way before this branch existed. The bar stays exact, so
  // "allegro" never reaches "allegro microsystems", and the weaker basis is
  // reported rather than hidden.
  const exact = shortlist.find((c) => c.rank === 100);
  if (exact) {
    return {
      ok: true,
      cik: String(exact.row.cik_str).padStart(10, "0"),
      name: exact.row.title,
      ticker: exact.row.ticker,
      confidence: 80,
      confirmed_by: "exact company name, domain not printed in the filing",
    };
  }
  return { ok: false, reason: `no filing for a company named like ${domain} states that domain` };
}

/** Does this filer's own newest filing mention the domain. */
async function filingMentionsDomain(env, cik, host) {
  try {
    const f = await recentFilings(env, cik, { forms: ["10-K", "10-Q", "20-F"], limit: 1 });
    if (!f.ok || !f.filings.length) return false;
    const r = await fetch(f.filings[0].url, { headers: { "user-agent": UA }, cf: { cacheTtl: 86400, cacheEverything: true } });
    if (!r.ok) return false;
    return (await r.text()).toLowerCase().includes(host);
  } catch { return false; }
}

/** Recent filings for a CIK, newest first, restricted to forms worth reading. */
export async function recentFilings(env, cik, { forms = VOLUME_FORMS, limit = 8 } = {}) {
  let sub;
  try {
    const r = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
      headers: HEADERS,
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (!r.ok) return { ok: false, reason: `submissions returned ${r.status}`, filings: [] };
    sub = await r.json();
  } catch (e) {
    return { ok: false, reason: `submissions unreachable: ${e.message}`, filings: [] };
  }

  const rec = sub?.filings?.recent;
  if (!rec?.form) return { ok: false, reason: "no recent filings", filings: [] };

  const bare = String(Number(cik));
  const out = [];
  for (let i = 0; i < rec.form.length && out.length < limit; i++) {
    if (!forms.includes(rec.form[i])) continue;
    const acc = String(rec.accessionNumber[i]).replace(/-/g, "");
    const doc = rec.primaryDocument[i];
    if (!doc) continue;
    out.push({
      form: rec.form[i],
      filed: rec.filingDate[i],
      period: rec.reportDate?.[i] || null,
      description: rec.primaryDocDescription?.[i] || null,
      url: `https://www.sec.gov/Archives/edgar/data/${bare}/${acc}/${doc}`,
      index_url: `https://www.sec.gov/Archives/edgar/data/${bare}/${acc}/`,
    });
  }
  return { ok: true, company: sub.name, tickers: sub.tickers || [], filings: out };
}

/**
 * Primary documents for a merchant, ready to hand to the truth extractor.
 *
 * Returns an empty list rather than throwing when a company is not an SEC
 * filer, which is most of the world. That is a coverage fact, not an error, and
 * it is exactly what the coverage map is for.
 */
export async function primarySources(env, { domain, name }) {
  const id = await resolveCik(env, { domain, name });
  if (!id.ok) return { ok: false, reason: id.reason, cik: null, filings: [] };
  const f = await recentFilings(env, id.cik);
  if (!f.ok) return { ok: false, reason: f.reason, cik: id.cik, filings: [] };
  return {
    ok: true,
    cik: id.cik,
    name: f.company || id.name,
    ticker: id.ticker,
    match_confidence: id.confidence,
    confirmed_by: id.confirmed_by || null,
    filings: f.filings,
  };
}
