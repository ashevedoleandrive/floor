/* Floor · page-evals.js — the Accuracy page, route /evals
   ---------------------------------------------------------------------
   Rebuilt 2026-08-09 from what the page now actually does, not from the
   order its pieces were bolted on.

   The argument this page makes changed underneath its old copy. Truth
   used to be a human typing a figure; it is now extracted from the
   merchant's own regulator filing, with the verbatim sentence stored and
   shown and the conversion to a monthly rate run in code. So the page is
   built around three kinds of content and nothing else:

   - MEASUREMENTS: the latest eval, and its accuracy split by derivation,
     region, size band and claimed confidence (all of which the API
     already returned and none of which was rendered anywhere).
   - REFUSALS: a rate on a sample too small to mean anything is withheld
     rather than printed small, exactly as the coverage map does; slices
     never measured say so; merchants with no prediction are ungradeable,
     not unverified.
   - PROVENANCE: every established truth shows the sentence it came from,
     the arithmetic that converted it, and the filing it lives in.

   Five row states exist in production today and all five are designed:
   established by extraction (quote + arithmetic + link), established by
   a person, establishable now (assessed, filings found), not assessable
   (no estimate to grade against, so the action is assess), and archived.

   Data: `data` is { evals: {latest, items, segments}, gold: {rows},
   sources: {domain: [links]}, suggest, cost_per_account } per the router.
   One guarded read-only D1 query (assessedDomains) tells apart "never
   assessed" from "assessed, but its filings gave no links".
   --------------------------------------------------------------------- */

import {
  esc, num, count, pct, dateISO, host,
  mark, statRow, section, table, rowMenu, btn, field, dialog,
} from "./kit.js";

/* ============================== copy ================================ */
/* Reuse first: nav.accuracy, eval.*, gold.*, ev.source, unit.txnMo,
   action.*, common.notSaved, queue.notAssessed already say most of it.
   Everything below is genuinely new to this page. */

export const keys = {
  /* header + meter */
  "evals.headMeta": {
    en: "{a} of {b} established · {w} more need an assessment first",
    es: "{a} de {b} establecidas · {w} más necesitan primero un análisis",
  },
  "evals.headMetaAll": { en: "{a} of {b} established", es: "{a} de {b} establecidas" },
  "evals.truthBase":   { en: "Truth established", es: "Verdades establecidas" },
  "evals.rateWithheld": { en: "{n} checked so far, too few for a rate", es: "{n} verificadas hasta ahora, muy pocas para una tasa" },
  // Spanish agrees in number, so one is not "1 verificadas".
  "evals.rateWithheldOne": { en: "1 checked so far, too few for a rate", es: "1 verificada hasta ahora, muy pocas para una tasa" },
  "evals.reachNote": { en: "{w} more need an assessment first", es: "{w} más necesitan primero un análisis" },
  "evals.reachAll":  { en: "every candidate is gradeable", es: "todos los candidatos son calificables" },

  /* latest eval */
  "evals.emptyBody": {
    en: "No eval has run. Establish truth for at least one assessed merchant below, then run it: stored predictions are graded against the filings, and nothing is re-run to look better.",
    es: "No se ha corrido ninguna evaluación. Establece la verdad de al menos un comercio ya analizado aquí abajo y córrela: las predicciones guardadas se califican contra los informes, y nada se vuelve a correr para verse mejor.",
  },
  "evals.missAbove": {
    en: "{d}: the disclosed truth of {t} sits {p} above the predicted midpoint of {m}.",
    es: "{d}: la verdad publicada de {t} queda {p} por encima del punto medio predicho de {m}.",
  },
  "evals.missBelow": {
    en: "{d}: the disclosed truth of {t} sits {p} below the predicted midpoint of {m}.",
    es: "{d}: la verdad publicada de {t} queda {p} por debajo del punto medio predicho de {m}.",
  },
  "evals.missFloorOk": {
    en: "The floor call was still right, and the floor call is what the queue runs on.",
    es: "El veredicto de umbral siguió siendo correcto, y ese veredicto es lo que mueve la cola.",
  },
  "evals.missFloorBad": {
    en: "The floor call was wrong here too.",
    es: "El veredicto de umbral también falló aquí.",
  },
  "evals.missWhy": {
    en: "A truth carries its date; an estimate assembled from older filings will trail a growing merchant. The gap is reported at full size rather than smoothed, because an eval that only ever agrees is not a check.",
    es: "La verdad lleva su fecha; una estimación armada con informes anteriores queda detrás de un comercio que crece. La brecha se reporta a tamaño completo en lugar de suavizarse, porque una evaluación que siempre está de acuerdo no es un control.",
  },

  /* reliability by slice */
  "evals.segLabel": { en: "Reliability by slice", es: "Fiabilidad por segmento" },
  "evals.segTitle": { en: "Where the accuracy holds", es: "Dónde se sostiene la precisión" },
  "evals.segSub": {
    en: "one blended percentage hides which class is failing, so the rate reports per slice, and a slice says how many more it needs rather than printing a rate it has not earned",
    es: "un porcentaje mezclado esconde cuál clase está fallando, así que la tasa se reporta por segmento, y un segmento demasiado pequeño para significar algo se retiene en lugar de imprimirse pequeño",
  },
  "evals.dim.derivation": { en: "How derived", es: "Cómo se derivó" },
  "evals.dim.region":     { en: "Region", es: "Región" },
  "evals.dim.magnitude":  { en: "Size band", es: "Rango de tamaño" },
  "evals.dim.calibration": { en: "Calibration", es: "Calibración" },
  "evals.colSlice":    { en: "Slice", es: "Segmento" },
  "evals.colScored":   { en: "Scored", es: "Calificadas" },
  "evals.colAbst":     { en: "Abstained", es: "Abstenciones" },
  "evals.colClaimed":  { en: "Claimed avg", es: "Promedio declarado" },
  "evals.colObserved": { en: "Observed in range", es: "Observado en rango" },
  "evals.calBucket":   { en: "Confidence claimed", es: "Confianza declarada" },
  "evals.seg.direct_count":     { en: "Read off a disclosure", es: "Leída de un informe" },
  "evals.seg.from_gmv_with_aov": { en: "Derived from dollar volume", es: "Derivada del volumen en dólares" },
  "evals.r.NORTHAMERICA": { en: "North America", es: "Norteamérica" },
  "evals.r.EUROPE": { en: "Europe", es: "Europa" },
  "evals.r.APAC":   { en: "APAC", es: "APAC" },
  "evals.r.LATAM":  { en: "LATAM", es: "LATAM" },
  "evals.r.AMEA":   { en: "AMEA", es: "AMEA" },
  "evals.band.over_50m":    { en: "above 50M/mo", es: "más de 50M/mes" },
  "evals.band.5m_to_50m":   { en: "5M to 50M/mo", es: "5M a 50M/mes" },
  "evals.band.500k_to_5m":  { en: "500k to 5M/mo", es: "500k a 5M/mes" },
  "evals.band.under_500k":  { en: "under 500k/mo", es: "menos de 500k/mes" },
  "evals.cal.high": { en: "0.85 and above", es: "0.85 o más" },
  "evals.cal.mid":  { en: "0.70 to 0.85", es: "0.70 a 0.85" },
  "evals.cal.low":  { en: "below 0.70", es: "menos de 0.70" },
  "evals.withheld": { en: "{k} more to rate", es: "faltan {k} para calificar" },
  "evals.withheldOne": { en: "1 more to rate", es: "falta 1 para calificar" },
  "evals.neverMeasured": { en: "never measured", es: "sin medir" },
  "evals.calNote": {
    en: "When Floor claims 0.90, the truth should land inside its range about nine times in ten. Until that is measured, the confidence number is an opinion.",
    es: "Cuando Floor declara 0.90, la verdad debería caer dentro de su rango unas nueve de cada diez veces. Hasta que eso se mida, el número de confianza es una opinión.",
  },
  "evals.blindNote": {
    en: "{r}: nothing assessed there discloses a figure to check against, so the gap is in the data, not in the effort.",
    es: "{r}: nada de lo analizado allí publica una cifra comprobable, así que la brecha está en los datos, no en el esfuerzo.",
  },

  /* the truth base */
  "evals.truthTitle": { en: "Truth comes from the filings", es: "La verdad sale de los informes" },
  "evals.truthSub": {
    en: "the merchant's own regulator filing is read, the sentence is stored verbatim, and the conversion to a monthly rate runs in code. A person typing a figure is the exception, kept for what an extractor cannot read",
    es: "se lee el informe regulatorio del propio comercio, la oración se guarda textual y la conversión a tasa mensual corre en código. Una persona escribiendo la cifra es la excepción, reservada para lo que un extractor no puede leer",
  },
  "evals.checkFirst": {
    en: "Establish {names} first: each covers a slice the measured set is blind to.",
    es: "Establece primero {names}: cada uno cubre un segmento que el conjunto medido no alcanza.",
  },
  "evals.rowGain": { en: "would newly measure: {g}", es: "mediría por primera vez: {g}" },
  "evals.colEst":  { en: "Established", es: "Establecida" },
  "evals.byExtraction":   { en: "from the filing", es: "del informe" },
  "evals.byHuman":        { en: "read by a person", es: "leída por una persona" },
  "evals.notEstablished": { en: "not established", es: "sin establecer" },
  "evals.perMonth": { en: "month", es: "mes" },
  "evals.establish": { en: "Establish from filings", es: "Establecer desde informes" },
  "evals.enterByHand": { en: "Enter figure by hand", es: "Ingresar la cifra a mano" },
  "evals.verbatimSrc": {
    en: "filing text, quoted in its original English",
    es: "texto del informe, citado en su inglés original",
  },
  "evals.flagWord": { en: "reconciliation flag", es: "alerta de conciliación" },
  "evals.metricNote": {
    en: "On rows not yet established, the metric is an expectation seeded from prior knowledge. Establishing the row confirms it, because the filing was opened.",
    es: "En las filas aún sin establecer, la métrica es una expectativa sembrada desde conocimiento previo. Establecer la fila la confirma, porque se abrió el informe.",
  },
  "evals.establishOk":   { en: "{d} established at {n} per month", es: "{d} establecido en {n} por mes" },
  "evals.establishFail": { en: "No figure found: {n}", es: "No se encontró la cifra: {n}" },

  /* not yet gradeable */
  "evals.pendingLabel": { en: "Not yet gradeable", es: "Aún no calificables" },
  "evals.pendingTitle": {
    en: "{n} disclose a figure but have no estimate to grade against",
    es: "{n} publican una cifra pero no tienen estimación que calificar",
  },
  "evals.pendingBody": {
    en: "Until Floor has assessed a merchant there is no prediction to compare a filing against, so the action here is assess, not verify. Assessing all of them costs about {c} at the measured rate.",
    es: "Hasta que Floor analice un comercio no hay predicción que comparar contra un informe, así que la acción aquí es analizar, no verificar. Analizarlos todos cuesta unos {c} al costo medido.",
  },
  "evals.assessFromQueue": { en: "assess from the queue", es: "analizar desde la cola" },
  "evals.noLinks": { en: "assessed, no filing links found", es: "analizada, sin enlaces a informes" },

  /* dialogs (create / verify-by-hand / correct) */
  "evals.addCandidate": { en: "Add candidate", es: "Agregar candidato" },
  "evals.addDlgTitle":  { en: "Add a gold-set candidate", es: "Agrega un candidato al set de referencia" },
  "evals.addDlgHint": {
    en: "A candidate does not count toward accuracy until its figure is established from a filing or entered by a person with the source.",
    es: "Un candidato no cuenta para la precisión hasta que su cifra se establece desde un informe o la ingresa una persona con la fuente.",
  },
  "evals.domain":     { en: "Domain",   es: "Dominio" },
  "evals.name":       { en: "Name",     es: "Nombre" },
  "evals.period":     { en: "Period",   es: "Período" },
  "evals.sourceUrl":  { en: "Source URL", es: "URL de la fuente" },
  "evals.sourceNote": { en: "Where to find it", es: "Dónde encontrarla" },
  "evals.phDomain":   { en: "Domain, for example asos.com", es: "Dominio, por ejemplo asos.com" },
  "evals.phName":     { en: "Name (optional)", es: "Nombre (opcional)" },
  "evals.phNote":     { en: "Note for whoever verifies it (optional)", es: "Nota para quien la verifique (opcional)" },
  "evals.editTitle": { en: "Edit a gold-set figure", es: "Edita una cifra del set de referencia" },
  "evals.editHint": {
    en: "Correct the figure or the source. This does not change whether the row is established.",
    es: "Corrige la cifra o la fuente. Esto no cambia si la fila está establecida.",
  },
  "evals.verifyConfirm": { en: "Verify", es: "Verificar" },
  "evals.verifyEffect": {
    en: "A figure and a source are both required. That is the product refusing to fabricate trust, not a bug.",
    es: "Se requieren la cifra y la fuente. Así la herramienta se niega a fabricar confianza, no es un error.",
  },

  /* row menus */
  "evals.menuEdit":     { en: "Edit figure",       es: "Editar cifra" },
  "evals.menuUnverify": { en: "Un-verify",         es: "Quitar verificación" },
  "evals.menuView":     { en: "View account",      es: "Ver cuenta" },
  "evals.menuRemove":   { en: "Remove candidate",  es: "Quitar candidato" },
  "evals.menuRestore":  { en: "Restore",           es: "Restaurar" },

  /* toasts + field errors */
  "evals.toastVerified":   { en: "{domain} verified",                  es: "{domain} verificado" },
  "evals.toastUnverified": { en: "Verification removed from {domain}", es: "Se quitó la verificación de {domain}" },
  "evals.toastCorrected":  { en: "{domain} corrected",                 es: "{domain} corregido" },
  "evals.toastAdded":      { en: "{domain} added to the gold set",     es: "{domain} se agregó al set de referencia" },
  "evals.toastRemoved":    { en: "{domain} removed",                   es: "{domain} eliminado" },
  "evals.toastRestored":   { en: "{domain} restored",                  es: "{domain} restaurado" },
  "evals.toastEvalRun":    { en: "Eval run, {n} scored",               es: "Evaluación corrida, {n} calificadas" },
  "evals.errNeedValue":  { en: "A row cannot be verified without a disclosed figure.", es: "Una fila no se puede verificar sin una cifra publicada." },
  "evals.errNeedSource": { en: "A row cannot be verified without the source you read it in.", es: "Una fila no se puede verificar sin la fuente donde la leíste." },
  "evals.errBadValue":   { en: "Enter a positive number of transactions per month.", es: "Ingresa un número positivo de transacciones por mes." },
  "evals.errBadDomain":  { en: "Enter a domain, for example asos.com.", es: "Ingresa un dominio, por ejemplo asos.com." },
  "evals.errDuplicate":  { en: "This domain is already a candidate.", es: "Este dominio ya es un candidato." },
  "evals.errGeneric":    { en: "Could not save. Try again.", es: "No se pudo guardar. Intenta de nuevo." },
  "evals.errNoVerified": { en: "Establish at least one gold-set figure before running the eval.", es: "Establece al menos una cifra del set de referencia antes de correr la evaluación." },
  "evals.errNoAssessments": { en: "Assess the established gold-set accounts from the queue first.", es: "Primero analiza desde la cola las cuentas establecidas del set de referencia." },
  "evals.retry": { en: "Retry", es: "Reintentar" },
};

/* ============================== route ================================ */

export const meta = {
  route: "/evals",
  nav: "/evals",
  titleKey: "nav.accuracy",
};

/* ======================= shared constants =========================== */

/** Below this the headline meter prints counts instead of a rate. The
 *  per-slice floors live in src/lib/accuracy.js and arrive as
 *  `sample_too_small`, which is honored as authoritative. */
const MIN_HEADLINE_N = 5;

const GHOST = `<span class="ink-4">&ndash;</span>`;

const DOTS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>`;

/* The known slice vocabulary, enumerated so the grid can say "never
   measured" about a slice the data has never seen. Anything the API
   returns outside this list still renders, under its own label. */
const SLICES = {
  by_derivation: ["direct_count", "from_gmv_with_aov"],
  by_region: ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"],
  by_magnitude: ["over_50m", "5m_to_50m", "500k_to_5m", "under_500k"],
};
const SLICE_KEY = {
  by_derivation: (k) => `evals.seg.${k}`,
  by_region: (k) => `evals.r.${k}`,
  by_magnitude: (k) => `evals.band.${k}`,
};

/* suggestGold() composes its gain sentences in English; these maps parse
   them back to slice keys so the annotation renders in both languages.
   A phrase that stops parsing simply drops out, it never renders raw. */
const GAIN_REGION = { "North America": "NORTHAMERICA", "Europe": "EUROPE", "APAC": "APAC", "LATAM": "LATAM", "AMEA": "AMEA" };
const GAIN_BAND = { "above 50M/mo": "over_50m", "5M to 50M/mo": "5m_to_50m", "500k to 5M/mo": "500k_to_5m", "under 500k/mo": "under_500k" };

function gainSlices(gains, t) {
  const out = [];
  for (const g of gains || []) {
    let m;
    if ((m = /^first (.+) row in the gold set$/.exec(g)) && GAIN_REGION[m[1]]) out.push(t(`evals.r.${GAIN_REGION[m[1]]}`));
    else if (/read off a disclosure/.test(g)) out.push(t("evals.seg.direct_count"));
    else if (/derived from dollar volume/.test(g)) out.push(t("evals.seg.from_gmv_with_aov"));
    else if ((m = /^first row (.+)$/.exec(g)) && GAIN_BAND[m[1]]) out.push(t(`evals.band.${GAIN_BAND[m[1]]}`));
  }
  return out;
}

/* ==================== truth arithmetic, displayed ==================== */
/* "970M / quarter (Q2 2026) → 323.3M / month". The magnitude word is not
   stored on the row, so it is recovered from the stored numbers: if
   disclosed × months ÷ raw lands exactly on a power of a thousand, the
   suffix is printed; otherwise the raw figure prints as stored. Code
   only, no judgement. */
const MONTHS_PER = { month: 1, quarter: 3, year: 12 };

function arithParts(g) {
  if (g.raw_value == null || g.disclosed_value == null) return null;
  const months = MONTHS_PER[String(g.raw_period || "").toLowerCase().trim()];
  let raw = Number(g.raw_value).toLocaleString("en-US");
  if (months) {
    const mag = (g.disclosed_value * months) / g.raw_value;
    for (const [v, sfx] of [[1e9, "B"], [1e6, "M"], [1e3, "k"]]) {
      if (Math.abs(mag - v) / v < 0.02) { raw = Number(g.raw_value).toLocaleString("en-US") + sfx; break; }
    }
  }
  const per = String(g.period || "").split(" (")[0];
  return { raw, rawPeriod: String(g.raw_period || ""), per };
}

/* ======================= server cell builders ======================== */
/* Mirrored, field for field, in script()'s client JS so mutations can
   rebuild the region without a reload. Keep the two in lockstep. */

const merchantCellHtml = (g, gains, t) =>
  `<b class="t-body">${esc(g.name || g.domain)}</b>` +
  `<div class="mono ink-3 ev-dom">${esc(g.domain)}</div>` +
  (gains && gains.length
    ? `<div class="ev-gain">${esc(t("evals.rowGain", { g: gains.join(" · ") }))}</div>` : "");

const metricCellHtml = (g) => {
  if (!g.disclosed_metric) return GHOST;
  return g.verified ? esc(g.disclosed_metric) : `<span class="ink-3">${esc(g.disclosed_metric)}</span>`;
};

const monthlyCellHtml = (g) =>
  g.disclosed_value != null
    ? `<span class="mono${g.verified ? "" : " ink-3"}">${esc(count(g.disclosed_value))}</span>`
    : GHOST;

const establishedCellHtml = (g, t) => {
  if (!g.verified) return mark("hollow", t("evals.notEstablished"), { tone: "mute" });
  const word = g.established_by === "human" ? t("evals.byHuman") : t("evals.byExtraction");
  const when = dateISO(g.verified_at);
  return mark("filled", word, { tone: "ok" }) +
    (when ? `<div class="ev-sub mono ink-4">${esc(when)}</div>` : "");
};

const sourceCellHtml = (g, found) => {
  if (g.source_url) {
    return `<a class="mono ev-filed" href="${esc(g.source_url)}" target="_blank" rel="noopener">${esc(host(g.source_url))} &#8599;</a>`;
  }
  // The arrowed link is the document that measures the metric this row
  // asks for; the rest are fallbacks and stay quiet.
  const links = (found || []).slice(0, 3).map((s, i) =>
    `<a class="ev-src${i === 0 && s.answers ? " is-best" : ""}${s.primary ? " is-primary" : ""}" href="${esc(s.url)}" target="_blank" rel="noopener" title="${esc(s.title || s.url)}">${esc(s.host)} &#8599;</a>`).join("");
  if (!links) return g.source_note ? `<span class="ink-3">${esc(g.source_note)}</span>` : GHOST;
  return `<div class="ev-srcs">${links}</div>` +
    (g.source_note ? `<div class="ev-sub ink-3">${esc(g.source_note)}</div>` : "");
};

/* One action per row, and it is the normal path. The escape hatch,
   entering a figure by hand, lives in the row menu where exceptions
   belong. */
const actionCellHtml = (g, canExtract, t) =>
  (!g.verified && !g.archived_at && canExtract)
    ? `<button type="button" class="btn btn-text" data-action="gold:extract">${esc(t("evals.establish"))}</button><span class="prog ev-rowprog" hidden><i></i></span>`
    : "";

const goldMenuItems = (g, t) => {
  const items = [];
  if (!g.verified && !g.archived_at) items.push({ label: t("evals.enterByHand"), action: "gold:openVerify" });
  items.push({ label: t("evals.menuEdit"), action: "gold:openEdit" });
  if (g.verified) items.push({ label: t("evals.menuUnverify"), action: "gold:unverify" });
  items.push("-", { label: t("evals.menuView"), href: `/account/${encodeURIComponent(g.domain)}` });
  if (g.archived_at) items.push({ label: t("evals.menuRestore"), action: "gold:restore" });
  else items.push({ label: t("evals.menuRemove"), action: "gold:archive", danger: true });
  return items;
};

const menuHostHtml = (items, t) =>
  `<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(t("kit.menu.aria"))}">${DOTS_SVG}</button>${rowMenu(items)}</div>`;

/**
 * The provenance row: what makes an established figure checkable by
 * someone who does not trust the tool. Rendered full-width under the
 * row, at rest, because the verbatim sentence is the page's argument.
 * On the Spanish surface the quote carries the verbatim label, since
 * filing text is stored in its original English.
 */
function provenanceRowHtml(g, t, lang, nCols) {
  if (!g.verified) return "";
  const a = arithParts(g);
  const quote = g.verbatim
    ? `<blockquote class="ev-quote">${esc(g.verbatim)}${lang === "es" ? `<span class="verbatim">${esc(t("evals.verbatimSrc"))}</span>` : ""}</blockquote>` : "";
  const arith = a
    ? `<div class="ev-arith mono">${esc(a.raw)} / ${esc(a.rawPeriod)}${a.per ? ` (${esc(a.per)})` : ""} &rarr; ${esc(count(g.disclosed_value))} / ${esc(t("evals.perMonth"))}</div>` : "";
  const flags = g.truth_flags
    ? `<div class="ev-flag">${mark("half", t("evals.flagWord"), { tone: "warn" })}<span class="ink-2">${esc(g.truth_flags)}</span></div>` : "";
  if (!quote && !arith && !flags) return "";
  return `<tr class="ev-truth"><td colspan="${nCols}"><div class="ev-truth-in">${quote}${arith}${flags}</div></td></tr>`;
}

function truthRowHtml(g, ctx) {
  const { t, lang, sources, gains } = ctx;
  const canExtract = (sources[g.domain] || []).length > 0;
  const main = `<tr data-id="${esc(g.id)}" class="${[g.verified ? "ev-vrow" : "", g.archived_at ? "row-dim" : ""].filter(Boolean).join(" ")}">
    <td>${merchantCellHtml(g, gains[g.domain], t)}</td>
    <td>${metricCellHtml(g)}</td>
    <td class="num">${monthlyCellHtml(g)}</td>
    <td>${establishedCellHtml(g, t)}</td>
    <td>${sourceCellHtml(g, sources[g.domain])}</td>
    <td>${actionCellHtml(g, canExtract, t)}</td>
    <td class="col-menu">${menuHostHtml(goldMenuItems(g, t), t)}</td>
  </tr>`;
  return main + provenanceRowHtml(g, t, lang, 7);
}

function pendingRowHtml(g, ctx) {
  const { t, assessed } = ctx;
  const state = assessed.has(g.domain)
    ? mark("hatch", t("evals.noLinks"), { tone: "mute" })
    : mark("hollow", t("queue.notAssessed"), { tone: "ghost" });
  return `<div class="ev-pend-row" data-id="${esc(g.id)}">
    <span class="nm">${esc(g.name || g.domain)}</span>
    <span class="dom mono ink-3">${esc(g.domain)}</span>
    <span class="st">${state}</span>
    <a class="ev-pend-go" href="/?q=${encodeURIComponent(g.domain)}">${esc(t("evals.assessFromQueue"))}</a>
    ${menuHostHtml(goldMenuItems(g, t), t)}
  </div>`;
}

/* ====================== eval results + readings ====================== */

const evalCols = (t) => [
  { key: "merchant",  label: t("eval.merchant") },
  { key: "disclosed", label: t("eval.disclosed"), align: "right" },
  { key: "predicted", label: t("eval.predicted"), align: "right", mono: true },
  { key: "inband",    label: t("eval.inBandCol") },
  { key: "floorcall", label: t("eval.floorCall") },
  { key: "source",    label: t("eval.checkIt") },
];

function evalItemCells(i, t, goldBy) {
  const g = goldBy[i.domain];
  const per = g && g.period ? String(g.period).split(" (")[0] : "";
  const abst = !!i.abstained;
  const inBand = abst ? mark("hatch", t("eval.vAbstained"), { tone: "held" })
    : i.in_band ? mark("filled", t("eval.vInBand"), { tone: "ok" }) : mark("hollow", t("eval.vOutside"), { tone: "bad" });
  const floorCall = abst ? mark("hatch", t("eval.vAbstained"), { tone: "held" })
    : i.floor_correct ? mark("filled", t("eval.vCorrect"), { tone: "ok" }) : mark("hollow", t("eval.vWrong"), { tone: "bad" });
  return [
    esc((g && g.name) || i.domain),
    `<span class="mono">${esc(count(i.truth))}</span>${per ? `<div class="ev-per mono ink-4">${esc(per)}</div>` : ""}`,
    abst ? GHOST : `<span class="mono">${esc(count(i.pred_min))}&ndash;${esc(count(i.pred_max))}</span>`,
    inBand,
    floorCall,
    i.source_url ? `<a class="mono" href="${esc(i.source_url)}" target="_blank" rel="noopener">${esc(host(i.source_url))} &#8599;</a>` : GHOST,
  ];
}

/** One legible sentence per disagreement, computed, never smoothed. */
function readingsHtml(items, t, goldBy) {
  const misses = (items || []).filter((i) => !i.abstained && !i.in_band && i.truth != null);
  if (!misses.length) return "";
  const lines = misses.map((i) => {
    const mid = i.pred_mid != null ? i.pred_mid : ((Number(i.pred_min) + Number(i.pred_max)) / 2);
    const p = mid > 0 ? `${Math.round(Math.abs(i.truth / mid - 1) * 100)}%` : "";
    const key = i.truth > mid ? "evals.missAbove" : "evals.missBelow";
    const g = goldBy[i.domain];
    const sentence = t(key, { d: (g && g.name) || i.domain, t: count(i.truth), p, m: count(mid) });
    const floorLine = t(i.floor_correct ? "evals.missFloorOk" : "evals.missFloorBad");
    return `<p class="ev-read"><b>${esc(sentence)}</b> ${esc(floorLine)}</p>`;
  }).join("");
  return `<div class="ev-reads">${lines}<p class="ev-read ink-3">${esc(t("evals.missWhy"))}</p></div>`;
}

/* =================== reliability by slice (the grid) ================= */

function segRows(segments, t) {
  const dims = [
    ["by_derivation", t("evals.dim.derivation")],
    ["by_region", t("evals.dim.region")],
    ["by_magnitude", t("evals.dim.magnitude")],
  ];
  const out = [];
  for (const [dim, dimLabel] of dims) {
    const present = new Map((segments && segments[dim] ? segments[dim] : []).map((s) => [s.key, s]));
    const known = SLICES[dim];
    const all = [...known, ...[...present.keys()].filter((k) => !known.includes(k))];
    all.forEach((k, idx) => {
      const s = present.get(k);
      const name = known.includes(k) ? esc(t(SLICE_KEY[dim](k))) : esc((s && s.label) || k);
      let cells;
      if (!s) {
        cells = `<td class="num mono ink-4">&ndash;</td><td class="num mono ink-4">&ndash;</td>` +
          `<td colspan="2">${mark("dashed", t("evals.neverMeasured"), { tone: "ghost" })}</td>`;
      } else if (s.sample_too_small) {
        cells = `<td class="num mono">${Number(s.scored) || 0}</td><td class="num mono">${Number(s.abstained) || 0}</td>` +
          `<td colspan="2">${mark("hatch", (s.need === 1 ? t("evals.withheldOne") : t("evals.withheld", { k: s.need || 1 })), { tone: "held" })}</td>`;
      } else {
        cells = `<td class="num mono">${Number(s.scored)}</td><td class="num mono">${Number(s.abstained) || 0}</td>` +
          `<td><span class="mono">${esc(pct(s.floor_correct / s.scored))}</span></td>` +
          `<td><span class="mono">${esc(pct(s.in_band / s.scored))}</span></td>`;
      }
      out.push(`<tr${idx === 0 ? ` class="ev-grp"` : ""}><td class="ev-dimlbl t-label">${idx === 0 ? esc(dimLabel) : ""}</td><td>${name}</td>${cells}</tr>`);
    });
  }
  return out.join("");
}

function calRows(calibration, t) {
  return (calibration || []).map((b) => {
    const name = ["high", "mid", "low"].includes(b.key) ? esc(t(`evals.cal.${b.key}`)) : esc(b.label || b.key);
    let obs;
    if (!b.n) obs = mark("dashed", t("evals.neverMeasured"), { tone: "ghost" });
    else if (b.sample_too_small) obs = mark("hatch", (b.need === 1 ? t("evals.withheldOne") : t("evals.withheld", { k: b.need || 1 })), { tone: "held" });
    else obs = `<span class="mono">${esc(pct(b.in_band / b.n))}</span>`;
    const claimed = b.claimed != null ? `<span class="mono">${Number(b.claimed).toFixed(2)}</span>` : GHOST;
    return `<tr><td>${name}</td><td class="num mono">${Number(b.n) || 0}</td><td class="num">${claimed}</td><td>${obs}</td></tr>`;
  }).join("");
}

function segBodyHtml(segments, blindNames, t) {
  const blind = blindNames.length
    ? `<p class="ev-note" id="ev-blind">${esc(t("evals.blindNote", { r: blindNames.join(", ") }))}</p>`
    : `<p class="ev-note" id="ev-blind" hidden></p>`;
  return `<div class="tbl-wrap"><table class="tbl tbl-dense ev-segtbl">
    <thead><tr><th></th><th>${esc(t("evals.colSlice"))}</th><th class="num">${esc(t("evals.colScored"))}</th><th class="num">${esc(t("evals.colAbst"))}</th><th>${esc(t("eval.floorCall"))}</th><th>${esc(t("eval.inBandCol"))}</th></tr></thead>
    <tbody>${segRows(segments, t)}</tbody>
  </table></div>
  ${blind}
  <h3 class="t-label ev-cal-h">${esc(t("evals.dim.calibration"))}</h3>
  <div class="tbl-wrap"><table class="tbl tbl-dense ev-caltbl">
    <thead><tr><th>${esc(t("evals.calBucket"))}</th><th class="num">${esc(t("evals.colScored"))}</th><th class="num">${esc(t("evals.colClaimed"))}</th><th>${esc(t("evals.colObserved"))}</th></tr></thead>
    <tbody>${calRows(segments && segments.calibration, t)}</tbody>
  </table></div>
  <p class="ev-note">${esc(t("evals.calNote"))}</p>`;
}

/* ============================== render ================================ */

export async function render(env, data, ctx) {
  const { lang, t } = ctx;

  const evalsRaw = data?.evals ?? { latest: data?.latest ?? null, items: data?.items ?? [] };
  const goldRaw = data?.gold ?? { rows: data?.rows ?? [] };
  const l = evalsRaw.latest || null;
  const items = evalsRaw.items || [];
  const segments = evalsRaw.segments || { by_derivation: [], by_region: [], by_magnitude: [], calibration: [] };
  const rows = goldRaw.rows || [];
  const sources = data?.sources || {};
  const suggest = data?.suggest || { suggestions: [], blind: [] };
  const perAcct = Number(data?.cost_per_account) || 0.2549;

  // Which gold domains have a live assessment: tells "never assessed"
  // apart from "assessed, but its filings gave no links". Read-only and
  // guarded; a missing DB binding degrades to the second wording never
  // being used, not to a crash.
  const assessed = await assessedDomains(env, rows.map((g) => g.domain));

  /* ---- the four populations. A row with no prediction is not
     unverified, it is ungradeable, and it never shares a table with the
     answer key. ---- */
  const active = rows.filter((g) => !g.archived_at);
  const archived = rows.filter((g) => g.archived_at);
  /**
   * Can this row be graded.
   *
   * The question is whether Floor has produced a prediction for the merchant,
   * which means whether it has a live assessment. Nothing else.
   *
   * This previously tested for source links, using "we found documents" as a
   * proxy for "we have a prediction". The two come apart exactly where it
   * matters: Zalando is assessed and Floor abstained on it, so the critic
   * dropped every claim and there are no surviving evidence URLs. The proxy
   * then reported an assessed merchant as needing an assessment, which is
   * false, and hid the fact that an abstain is itself a measurement. Abstains
   * are graded, they land in the abstain rate, and that rate is reported rather
   * than hidden.
   */
  const gradable = (g) => !!g.verified || assessed.has(g.domain);
  const mainRows = [...active.filter(gradable), ...archived];
  const pendingRows = active.filter((g) => !gradable(g));
  const verified = active.filter((g) => g.verified).length;
  const establishable = active.filter((g) => !g.verified && gradable(g)).length;
  const reach = verified + establishable;
  const waiting = pendingRows.length;
  const pendingCost = "$" + (pendingRows.length * perAcct).toFixed(2);

  const goldBy = {};
  for (const g of rows) goldBy[g.domain] = g;

  const gains = {};
  for (const s of suggest.suggestions || []) {
    const parsed = gainSlices(s.gains, t);
    if (parsed.length) gains[s.domain] = parsed;
  }
  const suggestNames = (suggest.suggestions || []).map((s) => s.name || s.domain).join(", ");
  const blindNames = (suggest.blind || []).map((b) => (GAIN_REGION[b] ? t(`evals.r.${GAIN_REGION[b]}`) : b));

  /* ---- headline meter. Below MIN_HEADLINE_N a percentage would be
     noise wearing a percentage sign, so the counts print instead and the
     note says why. ---- */
  const headStat = (numer, denom) =>
    denom >= MIN_HEADLINE_N ? pct(numer / denom) : `${numer}/${denom}`;
  const headNote = (numer, denom, bigNote) =>
    denom >= MIN_HEADLINE_N ? bigNote : ((denom) === 1 ? t("evals.rateWithheldOne") : t("evals.rateWithheld", { n: denom }));

  const meter = statRow([
    { label: t("eval.floorCorrect"),
      value: l ? headStat(l.floor_correct, l.n_scored) : null,
      note: l ? headNote(l.floor_correct, l.n_scored, t("eval.ofScored", { a: l.floor_correct, b: l.n_scored })) : t("eval.noRunYet") },
    { label: t("eval.inBand"),
      value: l ? headStat(l.in_band, l.n_scored) : null,
      note: l ? headNote(l.in_band, l.n_scored, t("eval.ofN", { a: l.in_band, b: l.n_scored })) : t("eval.noRunYet") },
    { label: t("eval.abstainRate"),
      value: l ? headStat(l.abstained, l.n) : null,
      note: t("eval.reported") },
    { label: t("evals.truthBase"),
      value: reach ? `${verified}/${reach}` : null,
      note: waiting ? t("evals.reachNote", { w: waiting }) : t("evals.reachAll") },
  ]);

  /* ---- latest eval ---- */
  const evalBody = l && items.length
    ? table({ cols: evalCols(t), rows: items.map((i) => ({
        id: i.domain,
        accent: i.abstained ? "held" : (i.floor_correct ? "ok" : "bad"),
        cells: evalItemCells(i, t, goldBy),
      })) }, t) + readingsHtml(items, t, goldBy)
    : `<div class="f-empty"><p>${esc(t("evals.emptyBody"))}</p></div>`;

  const evalSection = section({
    label: t("eval.eyebrow"),
    title: t("eval.latest"),
    sub: `<span id="eval-sub">${l ? esc(t("eval.runMeta", { n: l.n, date: dateISO(l.run_at) })) : esc(t("eval.notRun"))}</span>`,
    actions: `<div class="prog" id="eval-prog" hidden><i></i></div>${btn(t("eval.run"), { kind: "primary", id: "run-eval", action: "eval:run" })}`,
    body: `<div id="eval-body">${evalBody}</div>
      <p class="f-error" id="eval-error" hidden><span class="msg"></span> ${btn(t("evals.retry"), { kind: "text", action: "eval:run" })}</p>
      <p class="t-body ink-3 ev-foot">${esc(t("eval.foot"))}</p>`,
  });

  /* ---- reliability by slice: the part that was computed, returned,
     and never rendered anywhere. ---- */
  const segSection = section({
    label: t("evals.segLabel"),
    title: t("evals.segTitle"),
    sub: esc(t("evals.segSub")),
    body: `<div id="ev-seg">${segBodyHtml(segments, blindNames, t)}</div>`,
  });

  /* ---- the truth base ---- */
  const rowCtx = { t, lang, sources, gains, assessed };
  const progPct = reach ? Math.round((verified / reach) * 100) : 0;

  const tbody = mainRows.length
    ? mainRows.map((g) => truthRowHtml(g, rowCtx)).join("")
    : `<tr><td colspan="7" style="height:auto;border-bottom:0;padding:16px 0"><div class="f-empty"><p>${esc(t("evals.addDlgHint"))}</p></div></td></tr>`;

  const goldTable = `<div class="tbl-wrap"><table class="tbl ev-gold">
    <thead><tr>
      <th>${esc(t("eval.merchant"))}</th>
      <th>${esc(t("gold.metric"))}</th>
      <th class="num">${esc(t("gold.monthly"))}</th>
      <th>${esc(t("evals.colEst"))}</th>
      <th>${esc(t("ev.source"))}</th>
      <th></th>
      <th class="col-menu"></th>
    </tr></thead>
    <tbody id="ev-gold-tbody">${tbody}</tbody>
  </table></div>`;

  const pendZone = `<div class="ev-pend" id="ev-pend"${pendingRows.length ? "" : " hidden"}>
    <div class="ev-pend-h">
      <span class="t-label">${esc(t("evals.pendingLabel"))}</span>
      <span class="ev-pend-t t-body" id="ev-pend-t">${esc(t("evals.pendingTitle", { n: pendingRows.length }))}</span>
    </div>
    <p class="t-body ev-pend-b" id="ev-pend-b">${esc(t("evals.pendingBody", { c: pendingCost }))}</p>
    <div id="ev-pend-list">${pendingRows.map((g) => pendingRowHtml(g, rowCtx)).join("")}</div>
  </div>`;

  const goldSection = section({
    label: t("gold.title"),
    title: t("evals.truthTitle"),
    sub: esc(t("evals.truthSub")),
    actions: btn(t("evals.addCandidate"), { kind: "quiet", action: "gold:openAdd" }),
    body: `<div class="ev-prog-row">
        <div class="prog" id="ev-gold-prog"><i style="width:${progPct}%"></i></div>
        <span class="mono ink-3 ev-prog-n" id="ev-gold-prog-n">${esc(t("evals.headMetaAll", { a: verified, b: reach }))}</span>
      </div>
      <p class="ev-note" id="ev-first"${suggestNames ? "" : " hidden"}>${suggestNames ? esc(t("evals.checkFirst", { names: suggestNames })) : ""}</p>
      ${goldTable}
      <p class="ev-note" id="ev-metric-note">${esc(t("evals.metricNote"))}</p>
      ${pendZone}`,
  });

  /* ---- dialogs. Verify-by-hand is the escape hatch and says so in its
     own copy; its refusal without figure + source renders under the
     field the API names, never as a banner. ---- */
  const verifyDlg = dialog({
    id: "gold-verify-dlg",
    title: t("gold.dlgTitle"),
    body: `<p class="t-body">${t("gold.dlgHint")}</p>
      <p class="t-body"><b id="gv-domain" class="mono"></b></p>
      <input type="hidden" id="gv-id">
      ${field({ id: "gv-metric", label: t("gold.metric"), placeholder: t("gold.phMetric") })}
      ${field({ id: "gv-value", label: t("gold.monthly"), type: "number", min: 1, suffix: t("unit.txnMo"), placeholder: t("gold.phValue") })}
      ${field({ id: "gv-period", label: t("evals.period"), placeholder: t("gold.phPeriod") })}
      ${field({ id: "gv-url", label: t("evals.sourceUrl"), placeholder: t("gold.phUrl") })}
      ${field({ id: "gv-note", label: t("evals.sourceNote"), placeholder: t("evals.phNote") })}
      <p class="fld-effect">${esc(t("evals.verifyEffect"))}</p>`,
    confirm: { label: t("evals.verifyConfirm"), action: "gold:verify" },
  }, t);

  const editDlg = dialog({
    id: "gold-edit-dlg",
    title: t("evals.editTitle"),
    body: `<p class="t-body ink-2">${esc(t("evals.editHint"))}</p>
      <p class="t-body"><b id="ge-domain" class="mono"></b></p>
      <input type="hidden" id="ge-id">
      ${field({ id: "ge-metric", label: t("gold.metric"), placeholder: t("gold.phMetric") })}
      ${field({ id: "ge-value", label: t("gold.monthly"), type: "number", min: 1, suffix: t("unit.txnMo"), placeholder: t("gold.phValue") })}
      ${field({ id: "ge-period", label: t("evals.period"), placeholder: t("gold.phPeriod") })}
      ${field({ id: "ge-url", label: t("evals.sourceUrl"), placeholder: t("gold.phUrl") })}
      ${field({ id: "ge-note", label: t("evals.sourceNote"), placeholder: t("evals.phNote") })}`,
    confirm: { label: t("action.save"), action: "gold:correct" },
  }, t);

  const addDlg = dialog({
    id: "gold-add-dlg",
    title: t("evals.addDlgTitle"),
    body: `<p class="t-body ink-2">${esc(t("evals.addDlgHint"))}</p>
      ${field({ id: "ga-domain", label: t("evals.domain"), placeholder: t("evals.phDomain") })}
      ${field({ id: "ga-name", label: t("evals.name"), placeholder: t("evals.phName") })}
      ${field({ id: "ga-metric", label: t("gold.metric"), placeholder: t("gold.phMetric") })}
      ${field({ id: "ga-note", label: t("evals.sourceNote"), placeholder: t("evals.phNote") })}`,
    confirm: { label: t("action.add"), action: "gold:add" },
  }, t);

  const state = JSON.stringify({
    gold: rows,
    sources,
    assessed: [...assessed],
    gains,
    segments,
    blind: suggest.blind || [],
    costPer: perAcct,
    lang,
  }).replace(/</g, "\\u003c");

  const headMeta = waiting
    ? t("evals.headMeta", { a: verified, b: reach, w: waiting })
    : t("evals.headMetaAll", { a: verified, b: reach });

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.accuracy"))}</h1>
        <span class="whead-meta" id="ev-verified-meta">${esc(headMeta)}</span>
      </div>
    </div>
    <div class="ev-meter" id="ev-meter">${meter}</div>
    ${evalSection}
    ${segSection}
    ${goldSection}
    ${verifyDlg}
    ${editDlg}
    ${addDlg}
    <script>window.__EVALS_STATE__=${state};</script>
  `;
}

/**
 * Which of these domains have at least one live (non-deleted) assessment.
 * Read-only, guarded: a Node preview without a DB binding degrades to
 * "unknown for everyone" rather than throwing.
 */
async function assessedDomains(env, domains) {
  const set = new Set();
  const clean = [...new Set((domains || []).filter(Boolean))];
  if (!env?.DB || !clean.length) return set;
  try {
    const placeholders = clean.map(() => "?").join(",");
    const { results } = await env.DB.prepare(
      `SELECT DISTINCT a.domain AS domain FROM accounts a
       JOIN assessments s ON s.account_id = a.id AND s.deleted_at IS NULL
       WHERE a.domain IN (${placeholders})`
    ).bind(...clean).all();
    for (const r of results || []) set.add(r.domain);
  } catch {
    // Enhancement only: an unreachable DB never takes the page down.
  }
  return set;
}

/* ================================ css ================================= */

export function css() {
  return `
  .p-evals .ev-meter { margin-top: 32px; }
  .p-evals #eval-prog { width: 96px; }
  .p-evals .f-error { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
  .p-evals .ev-foot { margin-top: 16px; max-width: 64ch; }

  /* readings: a disagreement is rendered legible, not embarrassing */
  .p-evals .ev-reads { margin-top: 16px; display: grid; gap: 8px; }
  .p-evals .ev-read { font: 400 14px/1.55 var(--sans); color: var(--ink-2); max-width: 74ch; }
  .p-evals .ev-read b { color: var(--ink-1); font-weight: 600; }
  .p-evals .ev-per { font-size: 11px; margin-top: 2px; }

  /* reliability by slice */
  .p-evals .ev-segtbl .ev-dimlbl { color: var(--ink-3); width: 132px; white-space: nowrap; }
  .p-evals .ev-segtbl tr.ev-grp:not(:first-child) td { padding-top: 12px; }
  .p-evals .ev-cal-h { margin: 24px 0 4px; color: var(--ink-3); }
  .p-evals .ev-caltbl { max-width: 720px; }
  .p-evals .ev-note { margin-top: 12px; font-size: 13px; line-height: 1.5; color: var(--ink-3); max-width: 74ch; }

  /* the truth base */
  .p-evals .ev-dom { font-size: 12px; margin-top: 2px; }
  .p-evals .ev-gain { font-size: 12px; line-height: 1.4; color: var(--ink-3); margin-top: 4px; max-width: 44ch; white-space: normal; }
  .p-evals .ev-sub { font-size: 11px; line-height: 1.4; margin-top: 3px; }
  .p-evals tr.ev-vrow td { border-bottom: 0; }
  .p-evals tr.ev-truth td { height: auto; padding: 0 12px 14px 0; }
  .p-evals .ev-truth-in { display: grid; gap: 6px; max-width: 78ch; }
  .p-evals .ev-quote {
    margin: 0; padding: 2px 0 2px 12px; border-left: 2px solid var(--line-2);
    font-size: 13px; line-height: 1.55; color: var(--ink-2);
  }
  .p-evals .ev-quote .verbatim { margin-left: 8px; }
  .p-evals .ev-arith { font: 500 12px/1.5 var(--mono); color: var(--ink-2); }
  .p-evals .ev-flag { font-size: 12px; line-height: 1.5; display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .p-evals .ev-filed { white-space: nowrap; }

  /* offered filings on establishable rows: the arrowed one measures the
     metric this row asks for, the rest stay quiet */
  .p-evals .ev-srcs { display: flex; flex-wrap: wrap; gap: 4px 10px; }
  .p-evals .ev-src {
    font: 500 12px/1.5 var(--mono); color: var(--ink-3);
    text-decoration: none; white-space: nowrap;
  }
  .p-evals .ev-src:hover { color: var(--ink-1); text-decoration: underline; }
  .p-evals .ev-src.is-primary { color: var(--ink-2); }
  .p-evals .ev-src.is-best { color: var(--ink-1); font-weight: 560; }
  .p-evals .ev-src.is-best::before { content: "\\2192\\00a0"; color: var(--accent); }

  .p-evals .ev-rowprog { display: inline-block; width: 56px; margin-left: 10px; vertical-align: middle; }

  .p-evals .ev-prog-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .p-evals .ev-prog-row .prog { flex: 1; }
  .p-evals .ev-prog-n { flex: none; white-space: nowrap; font-size: 12px; }
  .p-evals #ev-first { margin: 0 0 16px; }

  /* not yet gradeable: deliberate absence, dashed, action is assess */
  .p-evals .ev-pend { margin-top: 24px; border: 1px dashed var(--line-2); border-radius: 6px; padding: 16px 20px 8px; }
  .p-evals .ev-pend-h { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .p-evals .ev-pend-h .t-label { color: var(--ink-3); }
  .p-evals .ev-pend-t { color: var(--ink-1); font-weight: 500; }
  .p-evals .ev-pend-b { margin: 8px 0 4px; color: var(--ink-2); max-width: 74ch; }
  .p-evals #ev-pend-list { margin-top: 8px; overflow-x: auto; }
  .p-evals .ev-pend-row {
    display: grid; grid-template-columns: minmax(130px, 1fr) minmax(150px, 1fr) minmax(190px, 1.3fr) auto 28px;
    gap: 12px; align-items: center; padding: 8px 0; min-width: 560px;
    border-top: 1px solid var(--line);
  }
  .p-evals .ev-pend-row .nm { font-weight: 500; }
  .p-evals .ev-pend-row .dom { font-size: 12px; }
  .p-evals .ev-pend-row .st { min-width: 0; }
  .p-evals .ev-pend-go { font-size: 13px; white-space: nowrap; justify-self: end; }
  `;
}

/* =============================== script ================================ */
/* Client mirrors of the builders above, kept field for field in lockstep,
   so every mutation rebuilds its region in place. No reload, ever. */

export function script() {
  return `(() => {
    "use strict";
    const $ = (s, r) => (r || document).querySelector(s);
    const STATE = window.__EVALS_STATE__ || {};
    const GOLD = STATE.gold || [];
    const SOURCES = STATE.sources || {};
    const ASSESSED = new Set(STATE.assessed || []);
    let GAINS = STATE.gains || {};
    let BLIND = STATE.blind || [];
    let LAST_SEG = STATE.segments || null;
    const COSTPER = Number(STATE.costPer) || 0.2549;
    const LANG = STATE.lang || "en";
    const MIN_HEADLINE_N = 5;

    const t = (key, vars) => (window.Floor ? window.Floor.t(key, vars) : key);
    const esc = (s) => String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
    const fmtCount = (n) => {
      if (n == null) return "";
      const v = Number(n);
      if (v >= 1e9) return (v/1e9).toFixed(1).replace(/\\.0$/, "") + "B";
      if (v >= 1e6) return (v/1e6).toFixed(1).replace(/\\.0$/, "") + "M";
      if (v >= 1e3) return Math.round(v/1e3) + "k";
      return String(v);
    };
    const num = (n) => Number(n).toLocaleString("en-US");
    const pctOf = (n) => Math.round((n || 0) * 100) + "%";
    const hostOf = (u) => { try { return new URL(u).host.replace(/^www\\./, ""); } catch { return String(u || ""); } };
    const dateISO = (s) => { const m = String(s || "").match(/^\\d{4}-\\d{2}-\\d{2}/); return m ? m[0] : ""; };
    const GHOST = '<span class="ink-4">&ndash;</span>';

    /* marks: same closed set the kit draws */
    const MK = {
      filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
      half: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 1.2a3.8 3.8 0 0 1 0 7.6Z" fill="currentColor"/></svg>',
      hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
      hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>',
      dashed: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.7"/></svg>',
    };
    const mk = (kind, label, tone) => '<span class="mk tone-' + tone + '">' + MK[kind] + '<span class="mk-w">' + esc(label) + '</span></span>';
    const DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

    /* ---- truth-base builders, mirroring render() ---- */
    // Mirrors render() exactly. Two copies of this predicate exist, server and
    // client, and they drifted: the client kept the old source-links proxy
    // after the server moved to asking whether an assessment exists. The server
    // then put Zalando in the right place and the client put it back in the
    // wrong one. If these two ever disagree again, this is the pair to check.
    const gradable = (g) => !!g.verified || ASSESSED.has(g.domain);

    const merchantCell = (g) => {
      const gains = GAINS[g.domain];
      return '<b class="t-body">' + esc(g.name || g.domain) + '</b>' +
        '<div class="mono ink-3 ev-dom">' + esc(g.domain) + '</div>' +
        (gains && gains.length ? '<div class="ev-gain">' + esc(t("evals.rowGain", { g: gains.join(" \\u00b7 ") })) + '</div>' : '');
    };
    const metricCell = (g) => !g.disclosed_metric ? GHOST
      : (g.verified ? esc(g.disclosed_metric) : '<span class="ink-3">' + esc(g.disclosed_metric) + '</span>');
    const monthlyCell = (g) => g.disclosed_value != null
      ? '<span class="mono' + (g.verified ? '' : ' ink-3') + '">' + esc(fmtCount(g.disclosed_value)) + '</span>' : GHOST;
    const establishedCell = (g) => {
      if (!g.verified) return mk("hollow", t("evals.notEstablished"), "mute");
      const word = g.established_by === "human" ? t("evals.byHuman") : t("evals.byExtraction");
      const when = dateISO(g.verified_at);
      return mk("filled", word, "ok") + (when ? '<div class="ev-sub mono ink-4">' + esc(when) + '</div>' : '');
    };
    const sourceCell = (g) => {
      if (g.source_url) return '<a class="mono ev-filed" href="' + esc(g.source_url) + '" target="_blank" rel="noopener">' + esc(hostOf(g.source_url)) + ' &#8599;</a>';
      const links = (SOURCES[g.domain] || []).slice(0, 3).map((s, i) =>
        '<a class="ev-src' + (i === 0 && s.answers ? ' is-best' : '') + (s.primary ? ' is-primary' : '') +
        '" href="' + esc(s.url) + '" target="_blank" rel="noopener" title="' + esc(s.title || s.url) + '">' + esc(s.host) + ' &#8599;</a>').join('');
      if (!links) return g.source_note ? '<span class="ink-3">' + esc(g.source_note) + '</span>' : GHOST;
      return '<div class="ev-srcs">' + links + '</div>' +
        (g.source_note ? '<div class="ev-sub ink-3">' + esc(g.source_note) + '</div>' : '');
    };
    const actionCell = (g) => (!g.verified && !g.archived_at && (SOURCES[g.domain] || []).length)
      ? '<button type="button" class="btn btn-text" data-action="gold:extract">' + esc(t("evals.establish")) + '</button><span class="prog ev-rowprog" hidden><i></i></span>'
      : '';

    const menuItems = (g) => {
      const items = [];
      if (!g.verified && !g.archived_at) items.push({ label: t("evals.enterByHand"), action: "gold:openVerify" });
      items.push({ label: t("evals.menuEdit"), action: "gold:openEdit" });
      if (g.verified) items.push({ label: t("evals.menuUnverify"), action: "gold:unverify" });
      items.push("-", { label: t("evals.menuView"), href: "/account/" + encodeURIComponent(g.domain) });
      if (g.archived_at) items.push({ label: t("evals.menuRestore"), action: "gold:restore" });
      else items.push({ label: t("evals.menuRemove"), action: "gold:archive", danger: true });
      return items;
    };
    const menuHost = (g) => {
      const rows = menuItems(g).map((it) => it === "-" ? '<div class="menu-sep" role="separator"></div>' :
        (it.href ? '<a class="menu-item" role="menuitem" href="' + esc(it.href) + '">' + esc(it.label) + '</a>'
          : '<button type="button" class="menu-item' + (it.danger ? ' danger' : '') + '" role="menuitem" data-action="' + esc(it.action) + '"' + (it.danger ? ' data-danger="1"' : '') + '>' + esc(it.label) + '</button>')
      ).join("");
      return '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + '</div></div>';
    };

    const MONTHS_PER = { month: 1, quarter: 3, year: 12 };
    const arith = (g) => {
      if (g.raw_value == null || g.disclosed_value == null) return "";
      const months = MONTHS_PER[String(g.raw_period || "").toLowerCase().trim()];
      let raw = num(g.raw_value);
      if (months) {
        const mag = (g.disclosed_value * months) / g.raw_value;
        const stops = [[1e9, "B"], [1e6, "M"], [1e3, "k"]];
        for (let i = 0; i < stops.length; i++) {
          if (Math.abs(mag - stops[i][0]) / stops[i][0] < 0.02) { raw = num(g.raw_value) + stops[i][1]; break; }
        }
      }
      const per = String(g.period || "").split(" (")[0];
      return esc(raw) + ' / ' + esc(g.raw_period || '') + (per ? ' (' + esc(per) + ')' : '') +
        ' &rarr; ' + esc(fmtCount(g.disclosed_value)) + ' / ' + esc(t("evals.perMonth"));
    };

    const provRow = (g) => {
      if (!g.verified) return "";
      const quote = g.verbatim
        ? '<blockquote class="ev-quote">' + esc(g.verbatim) +
          (LANG === "es" ? '<span class="verbatim">' + esc(t("evals.verbatimSrc")) + '</span>' : '') + '</blockquote>' : '';
      const a = arith(g);
      const arithH = a ? '<div class="ev-arith mono">' + a + '</div>' : '';
      const flags = g.truth_flags
        ? '<div class="ev-flag">' + mk("half", t("evals.flagWord"), "warn") + '<span class="ink-2">' + esc(g.truth_flags) + '</span></div>' : '';
      if (!quote && !arithH && !flags) return "";
      return '<tr class="ev-truth"><td colspan="7"><div class="ev-truth-in">' + quote + arithH + flags + '</div></td></tr>';
    };

    const truthRow = (g) => {
      const cls = [g.verified ? "ev-vrow" : "", g.archived_at ? "row-dim" : ""].filter(Boolean).join(" ");
      return '<tr data-id="' + esc(g.id) + '"' + (cls ? ' class="' + cls + '"' : '') + '>' +
        '<td>' + merchantCell(g) + '</td>' +
        '<td>' + metricCell(g) + '</td>' +
        '<td class="num">' + monthlyCell(g) + '</td>' +
        '<td>' + establishedCell(g) + '</td>' +
        '<td>' + sourceCell(g) + '</td>' +
        '<td>' + actionCell(g) + '</td>' +
        '<td class="col-menu">' + menuHost(g) + '</td>' +
        '</tr>' + provRow(g);
    };

    const pendRow = (g) => {
      const state = ASSESSED.has(g.domain)
        ? mk("hatch", t("evals.noLinks"), "mute")
        : mk("hollow", t("queue.notAssessed"), "ghost");
      return '<div class="ev-pend-row" data-id="' + esc(g.id) + '">' +
        '<span class="nm">' + esc(g.name || g.domain) + '</span>' +
        '<span class="dom mono ink-3">' + esc(g.domain) + '</span>' +
        '<span class="st">' + state + '</span>' +
        '<a class="ev-pend-go" href="/?q=' + encodeURIComponent(g.domain) + '">' + esc(t("evals.assessFromQueue")) + '</a>' +
        menuHost(g) + '</div>';
    };

    /* ---- region rebuilds. A mutation that patched one row would leave
       the header, meter, progress and pending zone lying, so the whole
       gold region rebuilds from the in-memory state every time. ---- */
    function goldById(id) { return GOLD.find((x) => String(x.id) === String(id)) || null; }
    function mergeGold(row) {
      const i = GOLD.findIndex((x) => String(x.id) === String(row.id));
      if (i >= 0) GOLD[i] = row; else GOLD.push(row);
    }

    function rebuildGold(flashId) {
      const active = GOLD.filter((g) => !g.archived_at);
      const archived = GOLD.filter((g) => g.archived_at);
      const main = [...active.filter(gradable), ...archived];
      const pending = active.filter((g) => !gradable(g));

      const tbody = document.getElementById("ev-gold-tbody");
      if (tbody) {
        tbody.innerHTML = main.length ? main.map(truthRow).join("")
          : '<tr><td colspan="7" style="height:auto;border-bottom:0;padding:16px 0"><div class="f-empty"><p>' + esc(t("evals.addDlgHint")) + '</p></div></td></tr>';
      }
      const list = document.getElementById("ev-pend-list");
      if (list) list.innerHTML = pending.map(pendRow).join("");
      const zone = document.getElementById("ev-pend");
      if (zone) zone.hidden = !pending.length;
      const pt = document.getElementById("ev-pend-t");
      if (pt) pt.textContent = t("evals.pendingTitle", { n: pending.length });
      const pb = document.getElementById("ev-pend-b");
      if (pb) pb.textContent = t("evals.pendingBody", { c: "$" + (pending.length * COSTPER).toFixed(2) });

      refreshAggregates();
      if (flashId != null && window.Floor) {
        const tr = document.querySelector('#ev-gold-tbody tr[data-id="' + flashId + '"]') ||
          document.querySelector('#ev-pend-list [data-id="' + flashId + '"]');
        if (tr) window.Floor.flash(tr);
      }
    }

    function setStat(i, value, note) {
      const st = document.querySelectorAll("#ev-meter .stat")[i];
      if (!st) return;
      const v = st.querySelector(".stat-v"), n = st.querySelector(".stat-n");
      if (v) { v.classList.toggle("none", value == null); v.textContent = value == null ? "\\u2013" : value; }
      if (n && note != null) n.textContent = note;
    }

    function refreshAggregates() {
      const active = GOLD.filter((g) => !g.archived_at);
      const verified = active.filter((g) => g.verified).length;
      const reach = verified + active.filter((g) => !g.verified && gradable(g)).length;
      const waiting = active.filter((g) => !gradable(g)).length;

      const meta = document.getElementById("ev-verified-meta");
      if (meta) meta.textContent = waiting
        ? t("evals.headMeta", { a: verified, b: reach, w: waiting })
        : t("evals.headMetaAll", { a: verified, b: reach });
      setStat(3, reach ? verified + "/" + reach : null,
        waiting ? t("evals.reachNote", { w: waiting }) : t("evals.reachAll"));
      const prog = document.getElementById("ev-gold-prog");
      if (prog) { const bar = prog.querySelector("i"); if (bar) bar.style.width = (reach ? Math.round((verified / reach) * 100) : 0) + "%"; }
      const progN = document.getElementById("ev-gold-prog-n");
      if (progN) progN.textContent = t("evals.headMetaAll", { a: verified, b: reach });
    }

    /* ---- what to establish first: recomputed after any truth change ---- */
    const REG = { "North America": "NORTHAMERICA", "Europe": "EUROPE", "APAC": "APAC", "LATAM": "LATAM", "AMEA": "AMEA" };
    const BAND = { "above 50M/mo": "over_50m", "5M to 50M/mo": "5m_to_50m", "500k to 5M/mo": "500k_to_5m", "under 500k/mo": "under_500k" };
    function parseGains(gains) {
      const out = [];
      for (const g of gains || []) {
        let m;
        if ((m = /^first (.+) row in the gold set$/.exec(g)) && REG[m[1]]) out.push(t("evals.r." + REG[m[1]]));
        else if (/read off a disclosure/.test(g)) out.push(t("evals.seg.direct_count"));
        else if (/derived from dollar volume/.test(g)) out.push(t("evals.seg.from_gmv_with_aov"));
        else if ((m = /^first row (.+)$/.exec(g)) && BAND[m[1]]) out.push(t("evals.band." + BAND[m[1]]));
      }
      return out;
    }
    async function refreshSuggest() {
      try {
        const r = await fetch("/api/gold/suggest").then((x) => x.json());
        if (!r || r.ok === false) return;
        GAINS = {};
        for (const s of r.suggestions || []) {
          const parsed = parseGains(s.gains);
          if (parsed.length) GAINS[s.domain] = parsed;
        }
        BLIND = r.blind || [];
        const first = document.getElementById("ev-first");
        if (first) {
          const names = (r.suggestions || []).map((s) => s.name || s.domain).join(", ");
          first.hidden = !names;
          first.textContent = names ? t("evals.checkFirst", { names }) : "";
        }
        renderBlind();
        rebuildGold();
      } catch { /* advisory only */ }
    }
    function renderBlind() {
      const el = document.getElementById("ev-blind");
      if (!el) return;
      const names = BLIND.map((b) => (REG[b] ? t("evals.r." + REG[b]) : b)).join(", ");
      el.hidden = !names;
      el.textContent = names ? t("evals.blindNote", { r: names }) : "";
    }

    /* ---- reliability by slice, rebuilt after an eval run ---- */
    const SLICES = {
      by_derivation: ["direct_count", "from_gmv_with_aov"],
      by_region: ["NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"],
      by_magnitude: ["over_50m", "5m_to_50m", "500k_to_5m", "under_500k"],
    };
    const SLICE_KEY = {
      by_derivation: (k) => "evals.seg." + k,
      by_region: (k) => "evals.r." + k,
      by_magnitude: (k) => "evals.band." + k,
    };
    function segTable(seg) {
      const dims = [
        ["by_derivation", t("evals.dim.derivation")],
        ["by_region", t("evals.dim.region")],
        ["by_magnitude", t("evals.dim.magnitude")],
      ];
      let rows = "";
      for (const [dim, dimLabel] of dims) {
        const present = new Map(((seg && seg[dim]) || []).map((s) => [s.key, s]));
        const known = SLICES[dim];
        const all = known.concat([...present.keys()].filter((k) => known.indexOf(k) < 0));
        all.forEach((k, idx) => {
          const s = present.get(k);
          const name = known.indexOf(k) >= 0 ? esc(t(SLICE_KEY[dim](k))) : esc((s && s.label) || k);
          let cells;
          if (!s) cells = '<td class="num mono ink-4">&ndash;</td><td class="num mono ink-4">&ndash;</td><td colspan="2">' + mk("dashed", t("evals.neverMeasured"), "ghost") + '</td>';
          else if (s.sample_too_small) cells = '<td class="num mono">' + (Number(s.scored) || 0) + '</td><td class="num mono">' + (Number(s.abstained) || 0) + '</td><td colspan="2">' + mk("hatch", (s.need === 1 ? t("evals.withheldOne") : t("evals.withheld", { k: s.need || 1 })), "held") + '</td>';
          else cells = '<td class="num mono">' + Number(s.scored) + '</td><td class="num mono">' + (Number(s.abstained) || 0) + '</td><td><span class="mono">' + pctOf(s.floor_correct / s.scored) + '</span></td><td><span class="mono">' + pctOf(s.in_band / s.scored) + '</span></td>';
          rows += '<tr' + (idx === 0 ? ' class="ev-grp"' : '') + '><td class="ev-dimlbl t-label">' + (idx === 0 ? esc(dimLabel) : '') + '</td><td>' + name + '</td>' + cells + '</tr>';
        });
      }
      return rows;
    }
    function calTable(cal) {
      return (cal || []).map((b) => {
        const name = ["high", "mid", "low"].indexOf(b.key) >= 0 ? esc(t("evals.cal." + b.key)) : esc(b.label || b.key);
        let obs;
        if (!b.n) obs = mk("dashed", t("evals.neverMeasured"), "ghost");
        else if (b.sample_too_small) obs = mk("hatch", (b.need === 1 ? t("evals.withheldOne") : t("evals.withheld", { k: b.need || 1 })), "held");
        else obs = '<span class="mono">' + pctOf(b.in_band / b.n) + '</span>';
        const claimed = b.claimed != null ? '<span class="mono">' + Number(b.claimed).toFixed(2) + '</span>' : GHOST;
        return '<tr><td>' + name + '</td><td class="num mono">' + (Number(b.n) || 0) + '</td><td class="num">' + claimed + '</td><td>' + obs + '</td></tr>';
      }).join("");
    }
    function rebuildSeg(seg) {
      LAST_SEG = seg || LAST_SEG;
      const host = document.getElementById("ev-seg");
      if (!host) return;
      host.innerHTML =
        '<div class="tbl-wrap"><table class="tbl tbl-dense ev-segtbl"><thead><tr><th></th><th>' + esc(t("evals.colSlice")) + '</th><th class="num">' + esc(t("evals.colScored")) + '</th><th class="num">' + esc(t("evals.colAbst")) + '</th><th>' + esc(t("eval.floorCall")) + '</th><th>' + esc(t("eval.inBandCol")) + '</th></tr></thead><tbody>' + segTable(LAST_SEG) + '</tbody></table></div>' +
        '<p class="ev-note" id="ev-blind" hidden></p>' +
        '<h3 class="t-label ev-cal-h">' + esc(t("evals.dim.calibration")) + '</h3>' +
        '<div class="tbl-wrap"><table class="tbl tbl-dense ev-caltbl"><thead><tr><th>' + esc(t("evals.calBucket")) + '</th><th class="num">' + esc(t("evals.colScored")) + '</th><th class="num">' + esc(t("evals.colClaimed")) + '</th><th>' + esc(t("evals.colObserved")) + '</th></tr></thead><tbody>' + calTable(LAST_SEG && LAST_SEG.calibration) + '</tbody></table></div>' +
        '<p class="ev-note">' + esc(t("evals.calNote")) + '</p>';
      renderBlind();
    }

    /* ---- latest eval, rebuilt after a run ---- */
    function goldByDomain(d) { return GOLD.find((x) => x.domain === d) || null; }
    function evalTable(items) {
      const cols = [t("eval.merchant"), t("eval.disclosed"), t("eval.predicted"), t("eval.inBandCol"), t("eval.floorCall"), t("eval.checkIt")];
      const rows = (items || []).map((i) => {
        const g = goldByDomain(i.domain);
        const per = g && g.period ? String(g.period).split(" (")[0] : "";
        const abst = !!i.abstained;
        const inBand = abst ? mk("hatch", t("eval.vAbstained"), "held")
          : i.in_band ? mk("filled", t("eval.vInBand"), "ok") : mk("hollow", t("eval.vOutside"), "bad");
        const floorCall = abst ? mk("hatch", t("eval.vAbstained"), "held")
          : i.floor_correct ? mk("filled", t("eval.vCorrect"), "ok") : mk("hollow", t("eval.vWrong"), "bad");
        const acc = abst ? "held" : (i.floor_correct ? "ok" : "bad");
        return '<tr class="row-acc-' + acc + '" data-id="' + esc(i.domain) + '">' +
          '<td>' + esc((g && g.name) || i.domain) + '</td>' +
          '<td class="num"><span class="mono">' + esc(fmtCount(i.truth)) + '</span>' + (per ? '<div class="ev-per mono ink-4">' + esc(per) + '</div>' : '') + '</td>' +
          '<td class="num mono">' + (abst ? GHOST : '<span class="mono">' + esc(fmtCount(i.pred_min)) + '&ndash;' + esc(fmtCount(i.pred_max)) + '</span>') + '</td>' +
          '<td>' + inBand + '</td><td>' + floorCall + '</td>' +
          '<td>' + (i.source_url ? '<a class="mono" href="' + esc(i.source_url) + '" target="_blank" rel="noopener">' + esc(hostOf(i.source_url)) + ' &#8599;</a>' : GHOST) + '</td></tr>';
      }).join("");
      return '<div class="tbl-wrap"><table class="tbl tbl-ruled"><thead><tr>' +
        cols.map((c, i) => '<th' + (i === 1 || i === 2 ? ' class="num"' : '') + '>' + esc(c) + '</th>').join("") +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function readings(items) {
      const misses = (items || []).filter((i) => !i.abstained && !i.in_band && i.truth != null);
      if (!misses.length) return "";
      const lines = misses.map((i) => {
        const mid = i.pred_mid != null ? i.pred_mid : ((Number(i.pred_min) + Number(i.pred_max)) / 2);
        const p = mid > 0 ? Math.round(Math.abs(i.truth / mid - 1) * 100) + "%" : "";
        const key = i.truth > mid ? "evals.missAbove" : "evals.missBelow";
        const g = goldByDomain(i.domain);
        const sentence = t(key, { d: (g && g.name) || i.domain, t: fmtCount(i.truth), p: p, m: fmtCount(mid) });
        return '<p class="ev-read"><b>' + esc(sentence) + '</b> ' + esc(t(i.floor_correct ? "evals.missFloorOk" : "evals.missFloorBad")) + '</p>';
      }).join("");
      return '<div class="ev-reads">' + lines + '<p class="ev-read ink-3">' + esc(t("evals.missWhy")) + '</p></div>';
    }
    function renderLatestEval(res) {
      const body = document.getElementById("eval-body");
      if (body) body.innerHTML = evalTable(res.items) + readings(res.items);
      const sub = document.getElementById("eval-sub");
      if (sub) sub.textContent = t("eval.runMeta", { n: res.n, date: new Date().toISOString().slice(0, 10) });
      const headStat = (a, b) => b >= MIN_HEADLINE_N ? pctOf(a / b) : a + "/" + b;
      setStat(0, res.n_scored != null ? headStat(res.floor_correct, res.n_scored) : null,
        res.n_scored >= MIN_HEADLINE_N ? t("eval.ofScored", { a: res.floor_correct, b: res.n_scored }) : ((res.n_scored) === 1 ? t("evals.rateWithheldOne") : ((res.n_scored) === 1 ? t("evals.rateWithheldOne") : t("evals.rateWithheld", { n: res.n_scored }))));
      setStat(1, res.n_scored != null ? headStat(res.in_band, res.n_scored) : null,
        res.n_scored >= MIN_HEADLINE_N ? t("eval.ofN", { a: res.in_band, b: res.n_scored }) : ((res.n_scored) === 1 ? t("evals.rateWithheldOne") : ((res.n_scored) === 1 ? t("evals.rateWithheldOne") : t("evals.rateWithheld", { n: res.n_scored }))));
      setStat(2, res.n != null ? headStat(res.abstained, res.n) : null, t("eval.reported"));
      if (res.segments) rebuildSeg(res.segments);
    }

    /* ---- field errors, rendered under the field the API named ---- */
    function clearFieldError(inputId) {
      const input = document.getElementById(inputId);
      if (!input) return;
      input.removeAttribute("aria-invalid");
      const wrap = input.closest(".fld");
      if (wrap) wrap.querySelectorAll('[data-err-for="' + inputId + '"]').forEach((n) => n.remove());
    }
    function setFieldError(inputId, msg) {
      const input = document.getElementById(inputId);
      if (!input) return;
      clearFieldError(inputId);
      input.setAttribute("aria-invalid", "true");
      const wrap = input.closest(".fld");
      if (!wrap) return;
      const p = document.createElement("p");
      p.className = "fld-err";
      p.setAttribute("data-err-for", inputId);
      p.textContent = msg;
      const c = wrap.querySelector(".fld-c");
      (c || wrap).after(p);
    }
    function mapServerMessage(field, raw) {
      if (field === "disclosed_value") return /positive number/i.test(raw || "") ? t("evals.errBadValue") : t("evals.errNeedValue");
      if (field === "source_url") return t("evals.errNeedSource");
      if (field === "domain") return /already a gold-set candidate/i.test(raw || "") ? t("evals.errDuplicate") : t("evals.errBadDomain");
      return raw || t("evals.errGeneric");
    }
    function applyServerError(prefix, data) {
      const map = { disclosed_value: "value", source_url: "url", domain: "domain" };
      setFieldError(prefix + "-" + (map[data.field] || "value"), mapServerMessage(data.field, data.error));
    }

    async function postJson(path, body) {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      let data = null;
      try { data = await r.json(); } catch { /* ignore */ }
      return { ok: r.ok && data && data.ok !== false, status: r.status, data: data || {} };
    }

    /* ---- dialogs, prefilled ---- */
    function openVerify(id) {
      const g = goldById(id);
      if (!g) return;
      ["gv-value", "gv-url"].forEach(clearFieldError);
      $("#gv-domain").textContent = g.domain;
      $("#gv-id").value = g.id;
      $("#gv-metric").value = g.disclosed_metric || "";
      $("#gv-value").value = g.disclosed_value != null ? g.disclosed_value : "";
      $("#gv-period").value = g.period || "";
      $("#gv-url").value = g.source_url || "";
      $("#gv-note").value = g.source_note || "";
      document.getElementById("gold-verify-dlg").showModal();
    }
    function openEdit(id) {
      const g = goldById(id);
      if (!g) return;
      ["ge-value", "ge-url"].forEach(clearFieldError);
      $("#ge-domain").textContent = g.domain;
      $("#ge-id").value = g.id;
      $("#ge-metric").value = g.disclosed_metric || "";
      $("#ge-value").value = g.disclosed_value != null ? g.disclosed_value : "";
      $("#ge-period").value = g.period || "";
      $("#ge-url").value = g.source_url || "";
      $("#ge-note").value = g.source_note || "";
      document.getElementById("gold-edit-dlg").showModal();
    }
    function openAdd() {
      clearFieldError("ga-domain");
      $("#ga-domain").value = ""; $("#ga-name").value = ""; $("#ga-metric").value = ""; $("#ga-note").value = "";
      document.getElementById("gold-add-dlg").showModal();
    }

    /* ---- submits: preventDefault so a refused verify keeps the dialog open ---- */
    async function submitVerify(e) {
      e.preventDefault();
      const id = $("#gv-id").value;
      const domain = $("#gv-domain").textContent;
      ["gv-value", "gv-url"].forEach(clearFieldError);
      const value = $("#gv-value").value.trim();
      const url = $("#gv-url").value.trim();
      let bad = false;
      if (!value) { setFieldError("gv-value", t("evals.errNeedValue")); bad = true; }
      if (!url) { setFieldError("gv-url", t("evals.errNeedSource")); bad = true; }
      if (bad) return;
      const { ok, data } = await postJson("/api/gold/" + id, {
        disclosed_metric: $("#gv-metric").value.trim() || null,
        disclosed_value: value,
        period: $("#gv-period").value.trim() || null,
        source_url: url,
        source_note: $("#gv-note").value.trim() || null,
        verified: true,
      });
      if (!ok) { applyServerError("gv", data); return; }
      mergeGold(data.after);
      rebuildGold(data.after.id);
      refreshSuggest();
      document.getElementById("gold-verify-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastVerified", { domain }), {
        undo: () => postJson("/api/gold/" + id, { verified: false }).then(({ data: d }) => { if (d.after) { mergeGold(d.after); rebuildGold(d.after.id); refreshSuggest(); } }),
      });
    }
    async function submitEdit(e) {
      e.preventDefault();
      const id = $("#ge-id").value;
      const domain = $("#ge-domain").textContent;
      clearFieldError("ge-value");
      const { ok, data } = await postJson("/api/gold/" + id, {
        disclosed_metric: $("#ge-metric").value.trim() || null,
        disclosed_value: $("#ge-value").value.trim(),
        period: $("#ge-period").value.trim() || null,
        source_url: $("#ge-url").value.trim() || null,
        source_note: $("#ge-note").value.trim() || null,
      });
      if (!ok) { applyServerError("ge", data); return; }
      mergeGold(data.after);
      rebuildGold(data.after.id);
      document.getElementById("gold-edit-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastCorrected", { domain }));
    }
    async function submitAdd(e) {
      e.preventDefault();
      clearFieldError("ga-domain");
      const domain = $("#ga-domain").value.trim();
      if (!domain.includes(".")) { setFieldError("ga-domain", t("evals.errBadDomain")); return; }
      const { ok, data } = await postJson("/api/gold/add", {
        domain,
        name: $("#ga-name").value.trim() || null,
        disclosed_metric: $("#ga-metric").value.trim() || null,
        source_note: $("#ga-note").value.trim() || null,
      });
      if (!ok) { applyServerError("ga", data); return; }
      mergeGold(data.row);
      rebuildGold(data.row.id);
      refreshSuggest();
      document.getElementById("gold-add-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastAdded", { domain: data.row.domain }));
    }

    const gvBtn = document.querySelector('[data-action="gold:verify"]');
    if (gvBtn) gvBtn.addEventListener("click", submitVerify);
    const geBtn = document.querySelector('[data-action="gold:correct"]');
    if (geBtn) geBtn.addEventListener("click", submitEdit);
    const gaBtn = document.querySelector('[data-action="gold:add"]');
    if (gaBtn) gaBtn.addEventListener("click", submitAdd);

    /* ---- establish from filings: the normal path. Costs a fraction of
       a cent and reads a public document, so it runs without a confirm
       and reports its result in place. ---- */
    async function establish(id, el) {
      const g = goldById(id);
      if (!g) return;
      const prog = el && el.parentElement ? el.parentElement.querySelector(".ev-rowprog") : null;
      if (el) { el.disabled = true; el.setAttribute("aria-busy", "true"); }
      if (prog) { prog.hidden = false; prog.classList.add("is-running"); }
      try {
        const r = await fetch("/api/truth/" + encodeURIComponent(g.domain), { method: "POST" }).then((x) => x.json());
        if (!r.ok) {
          if (window.Floor) window.Floor.toast(t("evals.establishFail", { n: String(r.note || r.error || "").slice(0, 140) }));
          return;
        }
        if (window.Floor) window.Floor.toast(t("evals.establishOk", { d: g.domain, n: num(r.monthly) }));
        const fresh = await fetch("/api/gold").then((x) => x.json());
        const row = (fresh.rows || []).find((x) => x.domain === g.domain);
        if (row) { mergeGold(row); rebuildGold(row.id); }
        refreshSuggest();
      } catch (err) {
        if (window.Floor) window.Floor.toast(t("common.notSaved", { err: err.message }));
      } finally {
        // on success the region was rebuilt and these nodes are gone;
        // on failure they are still here and come back to rest
        if (el && el.isConnected) { el.disabled = false; el.removeAttribute("aria-busy"); }
        if (prog && prog.isConnected) { prog.classList.remove("is-running"); prog.hidden = true; }
      }
    }

    document.addEventListener("floor:action", async (e) => {
      const { action, id, el } = e.detail || {};
      if (!action) return;
      if (action === "gold:extract") return establish(id, el);
      if (action === "gold:openVerify") return openVerify(id);
      if (action === "gold:openEdit") return openEdit(id);
      if (action === "gold:openAdd") return openAdd();
      if (action === "gold:unverify") {
        const g = goldById(id);
        const { ok, data } = await postJson("/api/gold/" + id, { verified: false });
        if (!ok) { if (window.Floor) window.Floor.toast(data.error || t("evals.errGeneric")); return; }
        mergeGold(data.after);
        rebuildGold(data.after.id);
        refreshSuggest();
        if (window.Floor) window.Floor.toast(t("evals.toastUnverified", { domain: g ? g.domain : "" }), {
          undo: () => postJson("/api/gold/" + id, { verified: true }).then(({ data: d }) => { if (d.after) { mergeGold(d.after); rebuildGold(d.after.id); refreshSuggest(); } }),
        });
        return;
      }
      if (action === "gold:archive" || action === "gold:restore") {
        const on = action === "gold:archive";
        const g = goldById(id);
        const { ok, data } = await postJson("/api/gold/" + id + "/archive", { on });
        if (!ok) { if (window.Floor) window.Floor.toast(data.error || t("evals.errGeneric")); return; }
        mergeGold(data.row);
        rebuildGold(data.row.id);
        if (window.Floor) window.Floor.toast(t(on ? "evals.toastRemoved" : "evals.toastRestored", { domain: g ? g.domain : "" }), {
          undo: () => postJson("/api/gold/" + id + "/archive", { on: !on }).then(({ data: d }) => { if (d.row) { mergeGold(d.row); rebuildGold(d.row.id); } }),
        });
        return;
      }
      if (action === "eval:run") return runEval();
    });

    async function runEval() {
      const prog = document.getElementById("eval-prog");
      const errBox = document.getElementById("eval-error");
      errBox.hidden = true;
      if (prog) { prog.hidden = false; prog.classList.add("is-running"); }
      try {
        const { ok, data } = await postJson("/api/evals/run", {});
        if (!ok) {
          const msg = data.error === "no_verified_gold" ? t("evals.errNoVerified")
            : data.error === "no_assessments" ? t("evals.errNoAssessments")
            : (data.error || t("evals.errGeneric"));
          errBox.querySelector(".msg").textContent = msg;
          errBox.hidden = false;
          return;
        }
        if (window.Floor) window.Floor.toast(t("evals.toastEvalRun", { n: data.n_scored }));
        renderLatestEval(data);
      } catch (err) {
        errBox.querySelector(".msg").textContent = String((err && err.message) || err);
        errBox.hidden = false;
      } finally {
        if (prog) { prog.classList.remove("is-running"); prog.hidden = true; }
      }
    }
  })();`;
}
