/* Floor · page-evals.js — the Accuracy page, route /evals
   ---------------------------------------------------------------------
   §4.6 of DESIGN-SPEC.md. Read the whole spec before touching this file;
   §3.10 (empty-state doctrine) governs more of this page than any other,
   because no eval has ever run and every gold-set row is unverified. That
   is not a placeholder to design around, it is the state this page ships
   in, so the empty and unverified cases ARE the primary design, not a
   fallback.

   The single hardest law on this page: a gold-set row does not count
   toward accuracy until a human opens the source and types the figure.
   Verification is refused by the API when the figure or the source is
   missing (HTTP 400, {ok:false, field, error}), and that refusal is
   rendered as a normal path under the field it names, never as a generic
   error banner.

   Data shape this page expects (documented since the router wires this,
   not this file): `data` is either
     { evals: { latest, items }, gold: { rows, total, verified } }
   or the two shapes flattened onto one object (both are detected below),
   matching the two source endpoints named in CONTRACT.md's appendix:
   GET /api/evals and GET /api/gold.

   Two supplementary reads happen directly against `env.DB` inside
   render(), guarded so a missing binding degrades to "unknown" rather
   than throwing (CONTRACT.md: "env — Worker env, for D1 reads if the
   router did not pre-fetch data"). Neither endpoint exists yet to supply
   this, so a page-level read is the honest way to avoid inventing it:
     - which gold-set domains have at least one live assessment, so a row
       whose merchant was never assessed says so instead of silently
       looking wrong (the "cross-link law", §4.6).
     - none of this touches an endpoint this file does not own.
   --------------------------------------------------------------------- */

import {
  esc, num, count, money, pct, dateISO, host,
  mark, level, gauge, statRow, section, well,
  table, rowMenu, btn, field, dialog, tabs,
} from "./kit.js";

/* ============================== copy ================================ */
/* Reuse first: nav.accuracy, eval.*, gold.*, action.cancel/add/save,
   unit.txnMo, ev.source, kit.* already say most of this page. What
   follows is only what genuinely does not exist yet: the completeness
   gaps (add / edit / un-verify / archive / restore) and their copy. */

export const keys = {
  "evals.pendingUnconf": {
    en: "Their expected metrics are unconfirmed: they were seeded from prior knowledge and nothing here has opened a filing to check them.",
    es: "Sus métricas esperadas no están confirmadas: se sembraron desde conocimiento previo y nada aquí ha abierto un informe para comprobarlas.",
  },
  "evals.metricUnconfirmed": {
    en: "Metrics marked ? were seeded from prior knowledge, not read off a filing. Verifying a row confirms its metric as a side effect, because you opened the document.",
    es: "Las métricas marcadas con ? se sembraron desde conocimiento previo, no se leyeron de un informe. Verificar una fila confirma su métrica de paso, porque abriste el documento.",
  },

  "evals.pendingLabel": { en: "Not checkable yet", es: "Aún no verificables" },
  "evals.pendingTitle": {
    en: "{n} merchants that disclose, but have never been assessed",
    es: "{n} comercios que publican cifras, pero nunca se han analizado",
  },
  "evals.pendingSub": {
    en: "these are not unverified, they are ungradeable: there is no estimate to compare a disclosure against until Floor has run",
    es: "no están sin verificar, no se pueden calificar: no hay estimación con la cual comparar una cifra hasta que Floor los analice",
  },
  "evals.pendingFoot": {
    en: "Assessing all of them costs about {c} at the measured rate, and each one then becomes checkable.",
    es: "Analizarlos todos cuesta unos {c} al costo medido, y cada uno pasa a ser verificable.",
  },

  "evals.progressSplit": {
    en: "{a} of {b} verified, {w} more waiting on an assessment",
    es: "{a} de {b} verificadas, {w} más esperan un análisis",
  },
  "evals.waitingNote": {
    en: "{w} candidates have no prediction yet, so there is nothing to compare them against. Assess them from the queue and they become checkable.",
    es: "{w} candidatos aún no tienen estimación, así que no hay con qué compararlos. Analízalos desde la cola y pasan a ser verificables.",
  },

  "evals.nextLabel": { en: "What to check next", es: "Qué verificar ahora" },
  "evals.nextTitle": {
    en: "Three that would tell you something new",
    es: "Tres que dirían algo que aún no sabes",
  },
  "evals.nextSub": {
    en: "only merchants Floor has already assessed, and only where checking one covers a dimension the verified set is blind to",
    es: "solo comercios que Floor ya analizó, y solo cuando verificar uno cubre una dimensión que el conjunto verificado no alcanza",
  },
  "evals.floorSays": { en: "Floor says {n}/mo", es: "Floor estima {n}/mes" },
  "evals.saturated": {
    en: "Nothing left to check would tell you something new. Every region, reliability class and size band the gold set can reach is already covered.",
    es: "Verificar algo más no diría nada nuevo. Cada región, clase de fiabilidad y rango de tamaño que el conjunto puede alcanzar ya está cubierto.",
  },
  "evals.blindRegions": {
    en: "No candidate can measure {r}. That gap is in the data, not in the effort: nothing assessed there discloses a public figure to check against.",
    es: "Ningún candidato puede medir {r}. Esa brecha está en los datos, no en el esfuerzo: nada analizado allí publica una cifra comprobable.",
  },

  "evals.status":       { en: "Status",   es: "Estado" },
  "evals.verified":      { en: "Verified",     es: "Verificada" },
  "evals.unverified":    { en: "Unverified",   es: "Sin verificar" },
  "evals.notAssessed":   { en: "Not yet assessed", es: "Aún no evaluada" },
  "evals.assessFromQueue": { en: "assess from the queue", es: "evalúala desde la cola" },

  "evals.addCandidate": { en: "Add candidate", es: "Agregar candidato" },
  "evals.addDlgTitle":  { en: "Add a gold-set candidate", es: "Agrega un candidato al set de referencia" },
  "evals.addDlgHint": {
    en: "A candidate does not count toward accuracy until it is verified with a figure and a source.",
    es: "Un candidato no cuenta para la precisión hasta que se verifica con una cifra y una fuente.",
  },
  "evals.domain":     { en: "Domain",   es: "Dominio" },
  "evals.name":       { en: "Name",     es: "Nombre" },
  "evals.period":     { en: "Period",  es: "Período" },
  "evals.sourceUrl":  { en: "Source URL", es: "URL de la fuente" },
  "evals.sourceNote": { en: "Where to find it", es: "Dónde encontrarla" },
  "evals.phDomain":   { en: "Domain, for example asos.com", es: "Dominio, por ejemplo asos.com" },
  "evals.phName":     { en: "Name (optional)", es: "Nombre (opcional)" },
  "evals.phNote":     { en: "Note for whoever verifies it (optional)", es: "Nota para quien la verifique (opcional)" },

  "evals.editTitle": { en: "Edit a gold-set figure", es: "Edita una cifra del set de referencia" },
  "evals.editHint": {
    en: "Correct the figure or the source. This does not change whether the row is verified.",
    es: "Corrige la cifra o la fuente. Esto no cambia si la fila está verificada.",
  },
  "evals.verifyConfirm": { en: "Verify", es: "Verificar" },
  "evals.verifyEffect": {
    en: "A figure and a source are both required. That is the product refusing to fabricate trust, not a bug.",
    es: "Se requieren la cifra y la fuente. Así la herramienta se niega a fabricar confianza, no es un error.",
  },

  "evals.menuEdit":     { en: "Edit figure",       es: "Editar cifra" },
  "evals.menuUnverify": { en: "Un-verify",         es: "Quitar verificación" },
  "evals.menuView":     { en: "View account",      es: "Ver cuenta" },
  "evals.menuRemove":   { en: "Remove candidate",  es: "Quitar candidato" },
  "evals.menuRestore":  { en: "Restore",           es: "Restaurar" },

  "evals.toastVerified":   { en: "{domain} verified",              es: "{domain} verificado" },
  "evals.toastUnverified": { en: "Verification removed from {domain}", es: "Se quitó la verificación de {domain}" },
  "evals.toastCorrected":  { en: "{domain} corrected",             es: "{domain} corregido" },
  "evals.toastAdded":      { en: "{domain} added to the gold set", es: "{domain} se agregó al set de referencia" },
  "evals.toastRemoved":    { en: "{domain} removed",               es: "{domain} eliminado" },
  "evals.toastRestored":   { en: "{domain} restored",              es: "{domain} restaurado" },
  "evals.toastEvalRun":    { en: "Eval run, {n} scored",           es: "Evaluación corrida, {n} calificadas" },

  "evals.errNeedValue":   { en: "A row cannot be verified without a disclosed figure.", es: "Una fila no se puede verificar sin una cifra publicada." },
  "evals.errNeedSource":  { en: "A row cannot be verified without the source you read it in.", es: "Una fila no se puede verificar sin la fuente donde la leíste." },
  "evals.errBadValue":    { en: "Enter a positive number of transactions per month.", es: "Ingresa un número positivo de transacciones por mes." },
  "evals.errBadDomain":   { en: "Enter a domain, for example asos.com.", es: "Ingresa un dominio, por ejemplo asos.com." },
  "evals.errDuplicate":   { en: "This domain is already a candidate.", es: "Este dominio ya es un candidato." },
  "evals.errGeneric":     { en: "Could not save. Try again.", es: "No se pudo guardar. Intenta de nuevo." },
  "evals.errNoVerified":  { en: "Verify at least one gold-set row before running the eval.", es: "Verifica al menos una fila del set de referencia antes de correr la evaluación." },
  "evals.errNoAssessments": { en: "Assess the verified gold-set accounts from the queue first.", es: "Primero evalúa desde la cola las cuentas verificadas del set de referencia." },
  "evals.retry": { en: "Retry", es: "Reintentar" },

  "evals.goldNoneNote": { en: "0 of {b} verified, human sign-off pending", es: "0 de {b} verificadas, falta la firma humana" },
};

/* ============================== route ================================ */

export const meta = {
  route: "/evals",
  nav: "/evals",
  titleKey: "nav.accuracy",
};

/* ========================= shared cell builders ====================== */
/* Used by render() (server) and mirrored, field for field, in script()'s
   client JS (browser) so a mutation can patch or append a row without a
   reload. Keep the two in lockstep if either changes. */

const merchantCellHtml = (g) =>
  `<b class="t-body">${esc(g.name || g.domain)}</b>` +
  `<div class="mono ink-3 ev-dom">${esc(g.domain)}</div>`;

/**
 * What the merchant is expected to disclose.
 *
 * These strings were hand-seeded from prior knowledge, not read off a filing, so
 * on an unverified row this is an expectation and not a fact. Printing it under
 * a "disclosed metric" heading as though it were established would be an
 * unsourced claim inside the accuracy harness, which is the exact thing this
 * page exists to refuse. Once a human verifies the row they have opened the
 * source, so the expectation has been confirmed and the qualifier comes off.
 */
const metricCellHtml = (g) => {
  if (!g.disclosed_metric) return `<span class="ink-4">&ndash;</span>`;
  const text = esc(g.disclosed_metric);
  return g.verified ? text
    : `${text}<span class="ev-unconf" title="seeded from prior knowledge, not read off a filing"> ?</span>`;
};

const monthlyCellHtml = (g) =>
  g.disclosed_value != null ? `<span class="mono">${esc(count(g.disclosed_value))}</span>` : `<span class="ink-4">&ndash;</span>`;

const statusCellHtml = (g, t, assessed) => {
  const m = mark(g.verified ? "filled" : "hollow", g.verified ? t("evals.verified") : t("evals.unverified"), { tone: g.verified ? "ok" : "mute" });
  const notAssessed = assessed && assessed.has(g.domain) ? "" :
    `<div class="ev-sub ink-3">${esc(t("evals.notAssessed"))} &middot; <a href="/">${esc(t("evals.assessFromQueue"))}</a></div>`;
  return m + notAssessed;
};

/**
 * The source cell.
 *
 * Once verified, this is the URL the human actually read. Before that it offers
 * the disclosures Floor already found while assessing the merchant, so
 * verifying means opening a filing rather than hunting for one.
 *
 * The line that keeps this honest: handing over the link is navigation, filling
 * in the figure would be the verification itself. So links are offered and the
 * number never is.
 */
const sourceCellHtml = (g, t, found) => {
  if (g.source_url) {
    return `<a class="mono" href="${esc(g.source_url)}" target="_blank" rel="noopener">${esc(host(g.source_url))} &#8599;</a>`;
  }
  // The first link is the document that measures the metric this row asks for.
  // Open that one. The rest are fallbacks and stay quiet so they do not read as
  // four things to check.
  const list = found || [];
  const links = list.slice(0, 3).map((s, i) =>
    `<a class="ev-src${i === 0 && s.answers ? " is-best" : ""}${s.primary ? " is-primary" : ""}"
        href="${esc(s.url)}" target="_blank" rel="noopener"
        title="${esc(s.title || s.url)}">${esc(s.host)} &#8599;</a>`).join("");
  if (!links) {
    return g.source_note
      ? `<span class="ink-3">${esc(g.source_note)}</span>`
      : `<span class="ink-4">&ndash;</span>`;
  }
  return `<div class="ev-srcs">${links}</div>` +
    (g.source_note ? `<div class="ev-sub ink-3">${esc(g.source_note)}</div>` : "");
};

const actionCellHtml = (g, t) =>
  (!g.verified && !g.archived_at)
    ? `<button type="button" class="btn btn-text" data-action="gold:openVerify" data-id="${esc(g.id)}">${esc(t("gold.enter"))}</button>`
    : "";

const goldMenuItems = (g, t) => {
  const items = [{ label: t("evals.menuEdit"), action: "gold:openEdit" }];
  if (g.verified) items.push({ label: t("evals.menuUnverify"), action: "gold:unverify" });
  items.push("-", { label: t("evals.menuView"), href: `/account/${encodeURIComponent(g.domain)}` });
  if (g.archived_at) items.push({ label: t("evals.menuRestore"), action: "gold:restore" });
  else items.push({ label: t("evals.menuRemove"), action: "gold:archive", danger: true });
  return items;
};

/* ============================ eval items ============================= */

const evalItemCells = (i, t) => {
  const abstained = !!i.abstained;
  const inBandMark = abstained
    ? mark("hatch", t("eval.vAbstained"), { tone: "held" })
    : i.in_band ? mark("filled", t("eval.vInBand"), { tone: "ok" }) : mark("hollow", t("eval.vOutside"), { tone: "bad" });
  const floorMark = abstained
    ? mark("hatch", t("eval.vAbstained"), { tone: "held" })
    : i.floor_correct ? mark("filled", t("eval.vCorrect"), { tone: "ok" }) : mark("hollow", t("eval.vWrong"), { tone: "bad" });
  return [
    esc(i.domain),
    `<span class="mono">${esc(count(i.truth))}</span>`,
    abstained ? `<span class="ink-4">&ndash;</span>` : `<span class="mono">${esc(count(i.pred_min))}&ndash;${esc(count(i.pred_max))}</span>`,
    inBandMark,
    floorMark,
    i.source_url ? `<a class="mono" href="${esc(i.source_url)}" target="_blank" rel="noopener">${esc(host(i.source_url))} &#8599;</a>` : `<span class="ink-4">&ndash;</span>`,
  ];
};

const evalCols = (t) => [
  { key: "merchant",  label: t("eval.merchant") },
  { key: "disclosed", label: t("eval.disclosed"), align: "right", mono: true },
  { key: "predicted", label: t("eval.predicted"), align: "right", mono: true },
  { key: "inband",    label: t("eval.inBandCol") },
  { key: "floorcall", label: t("eval.floorCall") },
  { key: "source",    label: t("eval.checkIt") },
];

/* Numbered onboarding steps. Not a §3.7 state mark (those are a closed
   set for domain state); this is page chrome for a one-time setup flow,
   scoped to .p-evals, hollow until done, filled with a check once past. */
const CHECK_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 5.2 4 7.8 8.5 2" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const stepRow = (n, done, title, body) => `<div class="ev-step${done ? " done" : ""}">
  <span class="ev-step-n" aria-hidden="true">${done ? CHECK_SVG : n}</span>
  <div class="ev-step-b"><b class="t-body">${esc(title)}</b><p class="t-body ink-2">${body}</p></div>
</div>`;

/* ============================== render ================================ */

export async function render(env, data, ctx) {
  const { lang, t } = ctx;

  const evalsRaw = data?.evals ?? { latest: data?.latest ?? null, items: data?.items ?? [] };
  const goldRaw = data?.gold ?? { rows: data?.rows ?? [], total: data?.total ?? 0, verified: data?.verified ?? 0 };
  const l = evalsRaw.latest || null;
  const items = evalsRaw.items || [];
  const rows = goldRaw.rows || [];

  // Disclosures Floor already found, keyed by domain, so an unverified row can
  // link straight to the filing instead of sending someone to a search engine.
  const sources = data?.sources || {};
  const suggest = data?.suggest || null;

  const activeRows = rows.filter((g) => !g.archived_at);
  const archivedRows = rows.filter((g) => g.archived_at);
  const totalActive = activeRows.length;
  const verifiedActive = activeRows.filter((g) => g.verified).length;

  // How many rows can actually be verified right now.
  //
  // The gold set was seeded as a list of merchants known to disclose volume
  // publicly, chosen for that property alone and independently of what Floor
  // had assessed. So a row can sit here with no prediction to compare against,
  // which means it cannot be verified at any effort today.
  //
  // Counting those in the denominator made the header read "0 of 22" when only
  // a fraction were reachable. On the one page whose whole job is honest
  // numbers, a denominator that includes unavailable work is the wrong number.
  const verifiable = activeRows.filter((g) => !g.verified && (sources[g.domain] || []).length > 0).length;
  const waiting = activeRows.filter((g) => !g.verified && !(sources[g.domain] || []).length).length;
  // Archived rows never disappear (§5.4 undo doctrine); they stay in the
  // same table, dimmed, sorted after the active ones.
  // The gold set proper is only what can be graded: a row with no prediction
  // has nothing to compare against, so it is not an answer-key entry yet. It is
  // a note that a company discloses, and the action it deserves is "assess
  // this", not "verify this". Mixing the two framed an upstream blocker as work
  // the operator was failing to do.
  const perAcct = Number(data?.cost_per_account || 0.2549);
  const gradable = (g) => g.verified || (sources[g.domain] || []).length > 0;
  const goldRows = [...activeRows.filter(gradable), ...archivedRows];
  const pendingRows = activeRows.filter((g) => !gradable(g));
  const pendingCost = "$" + (pendingRows.length * perAcct).toFixed(2);
  const sortedRows = goldRows;

  // Cross-link law (§4.6): a gold row whose merchant has no live
  // assessment shows that plainly instead of silently looking wrong.
  // No endpoint supplies this, so it is one guarded, read-only query
  // against the domains actually on this page.
  const assessed = await assessedDomains(env, rows.map((g) => g.domain));

  const rate = (n, d) => (d ? `${Math.round((n / d) * 100)}%` : null);

  const meter = statRow([
    { label: t("eval.floorCorrect"), value: l ? rate(l.floor_correct, l.n_scored) : null, note: l ? t("eval.ofScored", { a: l.floor_correct, b: l.n_scored }) : t("eval.noRunYet") },
    { label: t("eval.inBand"),       value: l ? rate(l.in_band, l.n_scored) : null,       note: l ? t("eval.ofN", { a: l.in_band, b: l.n_scored }) : t("eval.noRunYet") },
    { label: t("eval.abstainRate"),  value: l ? rate(l.abstained, l.n) : null,            note: t("eval.reported") },
    { label: t("eval.goldVerified"), value: verifiedActive > 0 ? `${verifiedActive}/${totalActive}` : null,
      note: verifiedActive > 0 ? t("eval.humanChecked") : t("evals.goldNoneNote", { b: totalActive }) },
  ]);

  const evalBody = l && items.length
    ? `${table({ cols: evalCols(t), rows: items.map((i) => ({
        id: i.domain,
        accent: i.abstained ? "held" : (i.floor_correct ? "ok" : "bad"),
        cells: evalItemCells(i, t),
      })) }, t)}`
    : `<div class="ev-steps">
        ${stepRow(1, verifiedActive > 0, t("gold.dlgTitle"), `${esc(t("eval.step1"))} ${verifiedActive > 0 ? esc(t("eval.nDone", { n: verifiedActive })) : esc(t("eval.noneYet"))}`)}
        ${stepRow(2, false, t("eval.step2t"), esc(t("eval.step2")))}
        ${stepRow(3, false, t("eval.step3t"), esc(t("eval.step3")))}
      </div>`;

  const evalSection = section({
    label: t("eval.eyebrow"),
    title: t("eval.latest"),
    sub: l ? esc(t("eval.runMeta", { n: l.n, date: dateISO(l.run_at) })) : esc(t("eval.notRun")),
    actions: `<div class="prog" id="eval-prog" hidden><i></i></div>${btn(t("eval.run"), { kind: "primary", id: "run-eval", action: "eval:run" })}`,
    body: `<div id="eval-body">${evalBody}</div>
      <p class="f-error" id="eval-error" hidden><span class="msg"></span> ${btn(t("evals.retry"), { kind: "text", action: "eval:run" })}</p>
      <p class="t-body ink-3" style="margin-top:16px;max-width:64ch">${esc(t("eval.foot"))}</p>`,
  });

  const reachable = verifiedActive + verifiable;
  const progPct = reachable ? Math.round((verifiedActive / reachable) * 100) : 0;
  const goldTable = table({
    cols: [
      { key: "merchant", label: t("eval.merchant") },
      { key: "metric",   label: t("gold.metric") },
      { key: "monthly",  label: t("gold.monthly"), align: "right", mono: true },
      { key: "status",   label: t("evals.status") },
      { key: "source",   label: t("ev.source") },
      { key: "action",   label: "" },
    ],
    rows: sortedRows.map((g) => ({
      id: g.id,
      dim: !!g.archived_at,
      cells: [
        merchantCellHtml(g),
        metricCellHtml(g),
        monthlyCellHtml(g),
        statusCellHtml(g, t, assessed),
        sourceCellHtml(g, t, sources[g.domain]),
        actionCellHtml(g, t),
      ],
      menu: goldMenuItems(g, t),
    })),
    size: "dense",
    empty: esc(t("evals.addDlgHint")),
  }, t);

  const goldSection = section({
    label: t("gold.title"),
    sub: t("gold.sub"),
    actions: btn(t("evals.addCandidate"), { kind: "quiet", action: "gold:openAdd" }),
    body: `<div class="ev-prog-row">
        <div class="prog" id="ev-gold-prog"><i style="width:${progPct}%"></i></div>
        <span class="mono ink-3 ev-prog-n" id="ev-gold-prog-n">${esc(t("gold.progress", { a: verifiedActive, b: verifiedActive + verifiable }))}</span>
      </div>
      ${goldTable}
      <p class="t-body ink-3" id="ev-gold-foot" style="margin-top:16px;max-width:64ch">${esc(t("gold.foot", { n: reachable }))} ${esc(t("evals.metricUnconfirmed"))}</p>`,
  });

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
    assessed: [...assessed],
    lang,
  }).replace(/</g, "\\u003c");

  /* What to verify next.
   *
   * Deliberately absent when nothing would add information. Verification is
   * human work, so a suggester that always has something to suggest
   * manufactures chores. A candidate appears only when checking it would cover
   * a dimension the verified set is blind to, and only when the tool already
   * has a prediction to grade it against. */
  const nextSection = (() => {
    if (!suggest) return "";
    const { suggestions = [], saturated, blind = [] } = suggest;
    const blindLine = blind.length
      ? `<p class="ev-blind">${esc(t("evals.blindRegions", { r: blind.join(", ") }))}</p>` : "";

    if (saturated) {
      return section({
        label: t("evals.nextLabel"),
        title: t("evals.nextTitle"),
        body: `<p class="ev-sat">${esc(t("evals.saturated"))}</p>${blindLine}`,
      });
    }
    const list = suggestions.map((c) => `
      <div class="ev-next-row">
        <div>
          <div><span class="nm">${esc(c.name)}</span><span class="dom">${esc(c.domain)}</span></div>
          <div class="ev-next-gain">${c.gains.map((g) => `<b>${esc(g)}</b>`).join(" &middot; ")}</div>
        </div>
        <div class="ev-next-pred">${esc(t("evals.floorSays", { n: count(c.predicted) }))}</div>
      </div>`).join("");

    return section({
      label: t("evals.nextLabel"),
      title: t("evals.nextTitle"),
      sub: t("evals.nextSub"),
      body: `<div class="ev-next-list">${list}</div>${blindLine}`,
    });
  })();


  /* Merchants that disclose but have never been assessed.
   *
   * Kept out of the gold table on purpose. There is nothing to compare them
   * against, so calling them "unverified" would blame the operator for a step
   * that happens somewhere else. The action here is assess, not verify. */
  const pendingSection = pendingRows.length ? section({
    label: t("evals.pendingLabel"),
    title: t("evals.pendingTitle", { n: pendingRows.length }),
    sub: t("evals.pendingSub"),
    body: `<div class="ev-pend">${pendingRows.map((g) => `
        <a class="ev-pend-row" href="/?q=${encodeURIComponent(g.domain)}">
          <span class="nm">${esc(g.name || g.domain)}</span>
          <span class="dom">${esc(g.domain)}</span>
          <span class="met">${esc(g.disclosed_metric || "")}</span>
        </a>`).join("")}</div>
      <p class="ev-blind">${esc(t("evals.pendingFoot", { c: pendingCost }))} ${esc(t("evals.pendingUnconf"))}</p>`,
  }) : "";

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.accuracy"))}</h1>
        <span class="whead-meta" id="ev-verified-meta">${esc(
          waiting
            ? t("evals.progressSplit", { a: verifiedActive, b: verifiedActive + verifiable, w: waiting })
            : t("gold.progress", { a: verifiedActive, b: totalActive })
        )}</span>
      </div>
    </div>
    <div class="ev-meter" id="ev-meter">${meter}</div>
    ${evalSection}
    ${nextSection}
    ${goldSection}
    ${pendingSection}
    ${verifyDlg}
    ${editDlg}
    ${addDlg}
    <script>window.__EVALS_STATE__=${state};</script>
  `;
}

/**
 * Which of these domains have at least one live (non-deleted) assessment.
 *
 * Read-only, guarded: a Node preview or a stripped-down test env without a
 * DB binding degrades to "unknown for everyone" rather than throwing, so
 * this file never crashes the page over an enhancement.
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
    // Enhancement only: an unreachable or unmigrated DB should never take
    // the accuracy page down with it.
  }
  return set;
}

/* ================================ css ================================= */

export function css() {
  return `
  .p-evals .ev-meter { margin-top: 32px; }

  /* Disclosures Floor already found, offered as starting points. Primary
     filings carry ink; anything reporting on a filing stays quiet. */
  .p-evals .ev-srcs { display: flex; flex-wrap: wrap; gap: 4px 10px; }
  .p-evals .ev-src {
    font: 500 12px/1.5 var(--mono); color: var(--ink-3);
    text-decoration: none; white-space: nowrap;
  }
  .p-evals .ev-src:hover { color: var(--ink-1); text-decoration: underline; }
  .p-evals .ev-src.is-primary { color: var(--ink-2); }
  /* The one that measures what this row is asking for. Open this first. */
  .p-evals .ev-src.is-best { color: var(--ink-1); font-weight: 560; }
  .p-evals .ev-src.is-best::before { content: "\\2192\\00a0"; color: var(--accent); }

  /* What to check next. Absent entirely when nothing would add information,
     because a panel that always has work in it is a chore generator. */
  .p-evals .ev-next { margin: 28px 0 8px; }
  .p-evals .ev-next-list { display: grid; gap: 1px; background: var(--line-1); border-block: 1px solid var(--line-1); }
  .p-evals .ev-next-row {
    background: var(--bg); padding: 14px 0;
    display: grid; grid-template-columns: 1fr auto; align-items: start; gap: 16px;
  }
  .p-evals .ev-next-row .nm { font-weight: 560; }
  .p-evals .ev-next-row .dom { font: 500 12px/1.5 var(--mono); color: var(--ink-3); margin-left: 8px; }
  .p-evals .ev-next-gain { font-size: 13px; color: var(--ink-2); margin-top: 4px; }
  .p-evals .ev-next-gain b { font-weight: 560; color: var(--ink-1); }
  .p-evals .ev-next-pred { font: 500 13px/1.5 var(--mono); color: var(--ink-3); white-space: nowrap; }
  .p-evals .ev-blind { font-size: 13px; color: var(--ink-3); margin-top: 12px; }
  .p-evals .ev-sat { font-size: 14px; color: var(--ink-2); }
  /* The metric on an unverified row is an expectation, not a reading. */
  .p-evals .ev-unconf { color: var(--held); font-weight: 560; cursor: help; }
  .p-evals .ev-pend { display: grid; gap: 1px; background: var(--line-1); border-block: 1px solid var(--line-1); }
  .p-evals .ev-pend-row {
    background: var(--bg); padding: 11px 0; text-decoration: none; color: inherit;
    display: grid; grid-template-columns: minmax(150px,1fr) minmax(140px,1fr) 2fr; gap: 16px; align-items: baseline;
  }
  .p-evals .ev-pend-row:hover .nm { text-decoration: underline; }
  .p-evals .ev-pend-row .nm { font-weight: 560; }
  .p-evals .ev-pend-row .dom { font: 500 12px/1.5 var(--mono); color: var(--ink-3); }
  .p-evals .ev-pend-row .met { font-size: 13px; color: var(--ink-3); }

  .p-evals .ev-dom { font-size: 12px; margin-top: 2px; }
  .p-evals .ev-sub { font-size: 12px; line-height: 1.4; margin-top: 4px; }
  .p-evals .ev-sub a { color: var(--ink-3); }
  .p-evals .ev-sub a:hover { color: var(--ink-1); }

  .p-evals .ev-prog-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .p-evals .ev-prog-row .prog { flex: 1; }
  .p-evals .ev-prog-n { flex: none; white-space: nowrap; }

  .p-evals #eval-prog { width: 96px; }
  .p-evals .f-error { display: flex; align-items: center; gap: 8px; margin-top: 12px; }

  .p-evals .ev-steps { display: flex; flex-direction: column; gap: 20px; max-width: 64ch; }
  .p-evals .ev-step { display: flex; gap: 12px; align-items: flex-start; }
  .p-evals .ev-step-n {
    flex: none; width: 20px; height: 20px; margin-top: 2px;
    border-radius: 50%; border: 1px solid var(--line-2);
    display: grid; place-items: center;
    font: 600 11px/1 var(--mono); color: var(--ink-3);
  }
  .p-evals .ev-step.done .ev-step-n {
    background: var(--ink-1); border-color: var(--ink-1); color: #fff;
  }
  .p-evals .ev-step-b p { margin-top: 2px; }
  `;
}

/* =============================== script ================================ */
/* Client mirrors of the cell/menu builders above, so a mutation can patch
   or append a row without location.reload(). window.__EVALS_STATE__ is
   emitted inside render()'s own body (script() takes no arguments, per
   CONTRACT.md), so it is already on the page by the time this runs. */

export function script() {
  return `(() => {
    "use strict";
    const $ = (s, r) => (r || document).querySelector(s);
    const STATE = window.__EVALS_STATE__ || { gold: [], assessed: [] };
    const GOLD = STATE.gold;
    const ASSESSED = new Set(STATE.assessed);
    const T = window.Floor ? null : null; // placeholder, Floor attaches before this runs? see below

    const esc = (s) => String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

    const fmtCount = (n) => {
      if (n == null) return "unknown";
      const v = Number(n);
      if (v >= 1e9) return (v/1e9).toFixed(1).replace(/\\.0$/, "") + "B";
      if (v >= 1e6) return (v/1e6).toFixed(1).replace(/\\.0$/, "") + "M";
      if (v >= 1e3) return Math.round(v/1e3) + "k";
      return String(v);
    };

    const hostOf = (u) => { try { return new URL(u).host.replace(/^www\\./, ""); } catch { return String(u || ""); } };

    const MK = {
      filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
      hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
      hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>',
    };
    const mk = (kind, label, tone) => { const cls = "mk tone-" + tone; return '<span class="' + cls + '">' + MK[kind] + '<span class="mk-w">' + esc(label) + '</span></span>'; };
    const DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

    const t = (key, vars) => (window.Floor ? window.Floor.t(key, vars) : key);

    const merchantCell = (g) => '<b class="t-body">' + esc(g.name || g.domain) + '</b><div class="mono ink-3 ev-dom">' + esc(g.domain) + '</div>';
    const metricCell = (g) => g.disclosed_metric ? esc(g.disclosed_metric) : '<span class="ink-4">&ndash;</span>';
    const monthlyCell = (g) => g.disclosed_value != null ? '<span class="mono">' + esc(fmtCount(g.disclosed_value)) + '</span>' : '<span class="ink-4">&ndash;</span>';
    const statusCell = (g) => {
      const m = mk(g.verified ? "filled" : "hollow", g.verified ? t("evals.verified") : t("evals.unverified"), g.verified ? "ok" : "mute");
      const na = ASSESSED.has(g.domain) ? "" : '<div class="ev-sub ink-3">' + esc(t("evals.notAssessed")) + ' &middot; <a href="/">' + esc(t("evals.assessFromQueue")) + '</a></div>';
      return m + na;
    };
    const sourceCell = (g) => g.source_url ? '<a class="mono" href="' + esc(g.source_url) + '" target="_blank" rel="noopener">' + esc(hostOf(g.source_url)) + ' &#8599;</a>'
      : g.source_note ? '<span class="ink-3">' + esc(g.source_note) + '</span>' : '<span class="ink-4">&ndash;</span>';
    const actionCell = (g) => (!g.verified && !g.archived_at)
      ? '<button type="button" class="btn btn-text" data-action="gold:openVerify" data-id="' + esc(g.id) + '">' + esc(t("gold.enter")) + '</button>' : "";

    const menuItems = (g) => {
      const items = [{ label: t("evals.menuEdit"), action: "gold:openEdit" }];
      if (g.verified) items.push({ label: t("evals.menuUnverify"), action: "gold:unverify" });
      items.push("-", { label: t("evals.menuView"), href: "/account/" + encodeURIComponent(g.domain) });
      if (g.archived_at) items.push({ label: t("evals.menuRestore"), action: "gold:restore" });
      else items.push({ label: t("evals.menuRemove"), action: "gold:archive", danger: true });
      return items;
    };
    const menuHost = (g) => {
      const rows = menuItems(g).map((it) => it === "-" ? '<div class="menu-sep" role="separator"></div>' :
        (it.href ? '<a class="menu-item" role="menuitem" href="' + esc(it.href) + '">' + esc(it.label) + '</a>'
          : '<button type="button" class="menu-item' + (it.danger ? " danger" : "") + '" role="menuitem" data-action="' + esc(it.action) + '"' + (it.danger ? ' data-danger="1"' : "") + '>' + esc(it.label) + '</button>')
      ).join("");
      return '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + '</div></div>';
    };

    function buildRowHtml(g) {
      return '<tr data-id="' + esc(g.id) + '"' + (g.archived_at ? ' class="row-dim"' : '') + '>' +
        '<td>' + merchantCell(g) + '</td>' +
        '<td>' + metricCell(g) + '</td>' +
        '<td class="num mono">' + monthlyCell(g) + '</td>' +
        '<td>' + statusCell(g) + '</td>' +
        '<td>' + sourceCell(g) + '</td>' +
        '<td>' + actionCell(g) + '</td>' +
        '<td class="col-menu">' + menuHost(g) + '</td>' +
        '</tr>';
    }

    function patchRow(tr, g) {
      const tds = tr.querySelectorAll(":scope > td");
      if (tds.length < 7) return;
      tds[0].innerHTML = merchantCell(g);
      tds[1].innerHTML = metricCell(g);
      tds[2].innerHTML = monthlyCell(g);
      tds[3].innerHTML = statusCell(g);
      tds[4].innerHTML = sourceCell(g);
      tds[5].innerHTML = actionCell(g);
      tds[6].innerHTML = menuHost(g);
      tr.classList.toggle("row-dim", !!g.archived_at);
    }

    function updateGoldRow(g) {
      const i = GOLD.findIndex((x) => String(x.id) === String(g.id));
      if (i >= 0) GOLD[i] = g; else GOLD.push(g);
      const tr = document.querySelector('tr[data-id="' + g.id + '"]');
      if (tr) { patchRow(tr, g); if (window.Floor) window.Floor.flash(tr); }
      else {
        const tbody = goldTbody();
        if (tbody) {
          const wrap = document.createElement("tbody");
          wrap.innerHTML = buildRowHtml(g);
          const newTr = wrap.firstElementChild;
          const empty = tbody.querySelector("tr td .f-empty");
          if (empty) tbody.innerHTML = "";
          tbody.appendChild(newTr);
          if (window.Floor) window.Floor.flash(newTr);
        }
      }
      refreshAggregates();
    }
    function goldTbody() {
      // The gold table is the last table on this page (the eval results
      // table, when it exists, renders first).
      const tables = document.querySelectorAll(".p-evals table");
      const last = tables[tables.length - 1];
      return last ? last.tBodies[0] : null;
    }

    /* ---- page-level aggregates: header meta, the meter stat, the gold
       progress bar and its footer count. A mutation that only patched the
       row it touched would leave every one of these lying, so every gold
       mutation refreshes them from the in-memory GOLD state. */
    function activeStats() {
      const active = GOLD.filter((g) => !g.archived_at);
      return { total: active.length, verified: active.filter((g) => g.verified).length };
    }
    function refreshAggregates() {
      const { total, verified } = activeStats();
      const metaText = t("gold.progress", { a: verified, b: total });
      const meta = document.getElementById("ev-verified-meta");
      if (meta) meta.textContent = metaText;
      const statV = document.querySelector("#ev-meter .stat:last-child .stat-v");
      const statN = document.querySelector("#ev-meter .stat:last-child .stat-n");
      if (statV) {
        statV.classList.toggle("none", verified <= 0);
        statV.textContent = verified > 0 ? verified + "/" + total : "–";
      }
      if (statN) statN.textContent = verified > 0 ? t("eval.humanChecked") : t("evals.goldNoneNote", { b: total });
      const prog = document.getElementById("ev-gold-prog");
      if (prog) { const bar = prog.querySelector("i"); if (bar) bar.style.width = (total ? Math.round((verified / total) * 100) : 0) + "%"; }
      const progN = document.getElementById("ev-gold-prog-n");
      if (progN) progN.textContent = metaText;
      const foot = document.getElementById("ev-gold-foot");
      if (foot) foot.textContent = t("gold.foot", { n: total });
    }

    function goldById(id) { return GOLD.find((x) => String(x.id) === String(id)) || null; }

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
      const suf = map[data.field] || "value";
      setFieldError(prefix + "-" + suf, mapServerMessage(data.field, data.error));
    }

    async function postJson(path, body) {
      const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
      let data = null;
      try { data = await r.json(); } catch { /* ignore */ }
      return { ok: r.ok && data && data.ok !== false, status: r.status, data: data || {} };
    }

    /* ---- open dialogs, prefilled ---- */
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
      ["ga-domain"].forEach(clearFieldError);
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
      const body = {
        disclosed_metric: $("#gv-metric").value.trim() || null,
        disclosed_value: value,
        period: $("#gv-period").value.trim() || null,
        source_url: url,
        source_note: $("#gv-note").value.trim() || null,
        verified: true,
      };
      const { ok, data } = await postJson("/api/gold/" + id, body);
      if (!ok) { applyServerError("gv", data); return; }
      updateGoldRow(data.after);
      document.getElementById("gold-verify-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastVerified", { domain }), {
        undo: () => postJson("/api/gold/" + id, { verified: false }).then(({ data: d }) => d.after && updateGoldRow(d.after)),
      });
    }
    async function submitEdit(e) {
      e.preventDefault();
      const id = $("#ge-id").value;
      const domain = $("#ge-domain").textContent;
      ["ge-value"].forEach(clearFieldError);
      const body = {
        disclosed_metric: $("#ge-metric").value.trim() || null,
        disclosed_value: $("#ge-value").value.trim(),
        period: $("#ge-period").value.trim() || null,
        source_url: $("#ge-url").value.trim() || null,
        source_note: $("#ge-note").value.trim() || null,
      };
      const { ok, data } = await postJson("/api/gold/" + id, body);
      if (!ok) { applyServerError("ge", data); return; }
      updateGoldRow(data.after);
      document.getElementById("gold-edit-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastCorrected", { domain }));
    }
    async function submitAdd(e) {
      e.preventDefault();
      clearFieldError("ga-domain");
      const domain = $("#ga-domain").value.trim();
      if (!domain.includes(".")) { setFieldError("ga-domain", t("evals.errBadDomain")); return; }
      const body = {
        domain,
        name: $("#ga-name").value.trim() || null,
        disclosed_metric: $("#ga-metric").value.trim() || null,
        source_note: $("#ga-note").value.trim() || null,
      };
      const { ok, data } = await postJson("/api/gold/add", body);
      if (!ok) { applyServerError("ga", data); return; }
      updateGoldRow(data.row);
      document.getElementById("gold-add-dlg").close();
      if (window.Floor) window.Floor.toast(t("evals.toastAdded", { domain: data.row.domain }));
    }

    const gvBtn = document.querySelector('[data-action="gold:verify"]');
    if (gvBtn) gvBtn.addEventListener("click", submitVerify);
    const geBtn = document.querySelector('[data-action="gold:correct"]');
    if (geBtn) geBtn.addEventListener("click", submitEdit);
    const gaBtn = document.querySelector('[data-action="gold:add"]');
    if (gaBtn) gaBtn.addEventListener("click", submitAdd);

    document.addEventListener("floor:action", async (e) => {
      const { action, id } = e.detail || {};
      if (!action) return;
      if (action === "gold:openVerify") return openVerify(id);
      if (action === "gold:openEdit") return openEdit(id);
      if (action === "gold:openAdd") return openAdd();
      if (action === "gold:unverify") {
        const g = goldById(id);
        const { ok, data } = await postJson("/api/gold/" + id, { verified: false });
        if (!ok) { if (window.Floor) window.Floor.toast(data.error || t("evals.errGeneric")); return; }
        updateGoldRow(data.after);
        if (window.Floor) window.Floor.toast(t("evals.toastUnverified", { domain: g ? g.domain : "" }), {
          undo: () => postJson("/api/gold/" + id, { verified: true }).then(({ data: d }) => d.after && updateGoldRow(d.after)),
        });
        return;
      }
      if (action === "gold:archive" || action === "gold:restore") {
        const on = action === "gold:archive";
        const g = goldById(id);
        const { ok, data } = await postJson("/api/gold/" + id + "/archive", { on });
        if (!ok) { if (window.Floor) window.Floor.toast(data.error || t("evals.errGeneric")); return; }
        updateGoldRow(data.row);
        if (window.Floor) window.Floor.toast(t(on ? "evals.toastRemoved" : "evals.toastRestored", { domain: g ? g.domain : "" }), {
          undo: () => postJson("/api/gold/" + id + "/archive", { on: !on }).then(({ data: d }) => d.row && updateGoldRow(d.row)),
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

    function renderLatestEval(res) {
      const body = document.getElementById("eval-body");
      if (!body) return;
      const cols = [
        t("eval.merchant"), t("eval.disclosed"), t("eval.predicted"),
        t("eval.inBandCol"), t("eval.floorCall"), t("eval.checkIt"),
      ];
      const rows = (res.items || []).map((i) => {
        const abstained = !!i.abstained;
        const inBand = abstained ? mk("hatch", t("eval.vAbstained"), "held")
          : i.in_band ? mk("filled", t("eval.vInBand"), "ok") : mk("hollow", t("eval.vOutside"), "bad");
        const floorCall = abstained ? mk("hatch", t("eval.vAbstained"), "held")
          : i.floor_correct ? mk("filled", t("eval.vCorrect"), "ok") : mk("hollow", t("eval.vWrong"), "bad");
        const rowCls = "row-acc-" + (abstained ? "held" : (i.floor_correct ? "ok" : "bad"));
        return '<tr class="' + rowCls + '"><td>' + esc(i.domain) + '</td>' +
          '<td class="num mono">' + esc(fmtCount(i.truth)) + '</td>' +
          '<td class="num mono">' + (abstained ? '<span class="ink-4">&ndash;</span>' : esc(fmtCount(i.pred_min)) + '&ndash;' + esc(fmtCount(i.pred_max))) + '</td>' +
          '<td>' + inBand + '</td><td>' + floorCall + '</td>' +
          '<td>' + (i.source_url ? '<a class="mono" href="' + esc(i.source_url) + '" target="_blank" rel="noopener">' + esc(hostOf(i.source_url)) + ' &#8599;</a>' : '<span class="ink-4">&ndash;</span>') + '</td></tr>';
      }).join("");
      body.innerHTML = '<div class="tbl-wrap"><table class="tbl tbl-dense tbl-ruled"><thead><tr>' +
        cols.map((c, i) => '<th' + (i === 1 || i === 2 ? ' class="num"' : '') + '>' + esc(c) + '</th>').join("") +
        '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
  })();`;
}
