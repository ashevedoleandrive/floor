/**
 * UK Companies House. The third source, and the first one that is not free text.
 *
 * Every UK limited company files annual accounts and they are public, which is
 * the only route to sizing a private British merchant that publishes nothing in
 * the American sense. ASOS is the obvious case: LSE-listed, so EDGAR has never
 * heard of it, and until now Floor could not establish truth for it at all.
 *
 * The constraint that shaped this file, checked rather than assumed: the
 * document API returns `application/pdf` and nothing else. Four companies were
 * sampled including Tesco and Dyson and not one offered a machine-readable
 * alternative. EDGAR hands over HTML a regex can reduce; Companies House hands
 * over a document. So the PDF goes to the model as a document block rather than
 * through a parser, which would mean a build step this product does not have.
 *
 * Everything downstream is unchanged: the model transcribes the figure, its
 * scale word and its period, and code does every piece of arithmetic under the
 * same defences that catch a quarterly figure recorded as monthly.
 */

const API = "https://api.company-information.service.gov.uk";
const DOC = "https://document-api.company-information.service.gov.uk";

const norm = (s) => String(s || "")
  .toLowerCase()
  .replace(/[.,]/g, "")
  .replace(/\b(plc|limited|ltd|holdings?|group|uk|inc|the)\b/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

/** Basic auth, key as the username, password deliberately blank. */
const auth = (key) => "Basic " + btoa(`${key}:`);

/**
 * A merchant to a UK company number.
 *
 * Name matching only, because Companies House has no domain field and filed
 * accounts rarely print a website. So the bar is exact after stripping legal
 * suffixes, and an active company outranks a dissolved one. The EDGAR resolver
 * learned this the hard way: a loose prefix match sent allegro.pl to a US
 * semiconductor company, and a wrong company number here would attribute one
 * business's accounts to another just as silently.
 */
export async function resolveCompany(env, { domain, name }) {
  const key = env?.COMPANIES_HOUSE_KEY;
  if (!key) return { ok: false, reason: "no Companies House credential" };

  const stem = norm(String(domain || "").split(".")[0]);
  const wanted = norm(name) || stem;
  const q = encodeURIComponent(name || stem);

  let items;
  try {
    const r = await fetch(`${API}/search/companies?q=${q}&items_per_page=20`, {
      headers: { authorization: auth(key) },
      cf: { cacheTtl: 86400, cacheEverything: true },
    });
    if (!r.ok) return { ok: false, reason: `search returned ${r.status}` };
    items = (await r.json()).items || [];
  } catch (e) { return { ok: false, reason: `search unreachable: ${e.message}` }; }

  const scored = items
    .map((it) => {
      const t = norm(it.title);
      const exact = t === wanted || t === stem;
      const squashed = t.replace(/ /g, "") === stem.replace(/ /g, "");
      if (!exact && !squashed) return null;
      return {
        number: it.company_number,
        title: it.title,
        status: it.company_status,
        rank: (exact ? 2 : 1) + (it.company_status === "active" ? 1 : 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.rank - a.rank);

  if (!scored.length) return { ok: false, reason: `no exact Companies House match for ${domain}` };
  return { ok: true, ...scored[0] };
}

/** The newest filed accounts, and the document behind it. */
export async function latestAccounts(env, companyNumber) {
  const key = env?.COMPANIES_HOUSE_KEY;
  if (!key) return { ok: false, reason: "no Companies House credential" };
  try {
    const r = await fetch(
      `${API}/company/${companyNumber}/filing-history?category=accounts&items_per_page=5`,
      { headers: { authorization: auth(key) }, cf: { cacheTtl: 3600, cacheEverything: true } });
    if (!r.ok) return { ok: false, reason: `filing history returned ${r.status}` };
    const items = (await r.json()).items || [];
    const withDocs = items.filter((it) => it.links?.document_metadata);
    if (!withDocs.length) return { ok: false, reason: "no accounts filing carries a document" };
    return {
      ok: true,
      // Every recent accounts filing, newest first. The caller picks the
      // smallest that fits rather than always taking the newest: a large PLC
      // files a 9MB annual report while last year's may be 6MB, and the figure
      // is in both.
      candidates: withDocs.slice(0, 4).map((it) => ({
        date: it.date,
        made_up_to: it.description_values?.made_up_date || null,
        metadata_url: it.links.document_metadata,
      })),
      date: withDocs[0].date,
      made_up_to: withDocs[0].description_values?.made_up_date || null,
      metadata_url: withDocs[0].links.document_metadata,
    };
  } catch (e) { return { ok: false, reason: `filing history unreachable: ${e.message}` }; }
}

/**
 * Fetch the accounts document as base64, ready for a document content block.
 *
 * Capped hard. A filed annual report can run to several megabytes, and a Worker
 * has neither the memory nor the patience for one; refusing a document that is
 * too large is a coverage fact, not a failure, and it says so.
 */
export async function accountsDocument(env, metadataUrl, { maxBytes = 10_000_000 } = {}) {
  const key = env?.COMPANIES_HOUSE_KEY;
  try {
    const m = await fetch(metadataUrl, { headers: { authorization: auth(key) }, cf: { cacheTtl: 86400 } });
    if (!m.ok) return { ok: false, reason: `document metadata returned ${m.status}` };
    const meta = await m.json();
    const formats = Object.keys(meta.resources || {});
    if (!formats.includes("application/pdf"))
      return { ok: false, reason: `no PDF available, formats were ${formats.join(", ") || "none"}` };

    const size = meta.resources["application/pdf"]?.content_length || 0;
    if (size > maxBytes)
      return { ok: false, reason: `filed accounts are ${(size / 1e6).toFixed(1)}MB, over the ${maxBytes / 1e6}MB ceiling` };

    const d = await fetch(`${metadataUrl}/content`, {
      headers: { authorization: auth(key), accept: "application/pdf" },
      redirect: "follow",
      cf: { cacheTtl: 86400 },
    });
    if (!d.ok) return { ok: false, reason: `document returned ${d.status}` };
    const buf = await d.arrayBuffer();
    if (buf.byteLength > maxBytes)
      return { ok: false, reason: `document is ${(buf.byteLength / 1e6).toFixed(1)}MB, over the ceiling` };

    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return { ok: true, base64: btoa(bin), bytes: buf.byteLength };
  } catch (e) { return { ok: false, reason: `document unreachable: ${e.message}` }; }
}

/** Everything needed to establish truth for a UK merchant, or the reason not. */
export async function ukPrimarySource(env, { domain, name }) {
  const co = await resolveCompany(env, { domain, name });
  if (!co.ok) return { ok: false, reason: co.reason };
  const acc = await latestAccounts(env, co.number);
  if (!acc.ok) return { ok: false, reason: acc.reason, company: co };
  return {
    ok: true,
    company: co,
    filing: acc,
    registry_url: `https://find-and-update.company-information.service.gov.uk/company/${co.number}/filing-history`,
  };
}
