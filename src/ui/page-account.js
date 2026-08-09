/* Floor · page-account.js — the account detail page (DESIGN-SPEC §4.2)
   ---------------------------------------------------------------------
   The trust surface. A sceptic opens this page to decide whether to
   believe a number the tool produced, so the page is an argument made
   in a fixed order: the estimate and how sure we are; every claim it
   rests on with its clickable source; what a second model tried to
   disprove and what survived; what it cost and which model did which
   stage. Abstention renders as the product working, never as an error.

   Owns exactly this file. Imports the kit, never restyles it. Copy is
   exported as `keys` and merged by the router; CSS is scoped to
   .p-account; the client script wires the operator writes:

     POST /api/account/:domain              edit in place (T14 inline)
     POST /api/account/:domain/archive      + /unarchive (the undo)
     POST /api/account/:domain/history      every past run
     POST /api/assessment/:id               remove a bad run (+ /restore)
     POST /api/assess                       re-assess

   No location.reload(). Every mutation updates its region and confirms
   with a flash or a toast, and every destructive action carries undo.
   --------------------------------------------------------------------- */

import {
  esc, num, count, money, pct, dateISO, host,
  section, well, gauge, mark, statRow, table, btn, rowMenu,
} from "./kit.js";

/* ============================== copy =============================== */
/* Only what is genuinely new to this page. Everything else reuses the
   shared dictionary (verdict.*, band.*, ev.*, trace.*, dim.*, cool.*). */

export const keys = {
  "a.title": { en: "Account", es: "Cuenta" },

  // identity line + inline editing
  "a.owner":        { en: "Owner", es: "Responsable" },
  "a.lastTouched":  { en: "Last touched", es: "Último contacto" },
  "a.editHint": {
    en: "Click a value to edit it. Region and last touched feed the score; the queue re-ranks on the next load.",
    es: "Haz clic en un valor para editarlo. La región y el último contacto alimentan el puntaje; la cola se reordena en la próxima carga.",
  },

  // page menu
  "a.reassess":    { en: "Re-assess", es: "Reanalizar" },
  "a.markTouched": { en: "Mark touched today", es: "Marcar contacto hoy" },
  "a.editName":    { en: "Edit name", es: "Editar nombre" },
  "a.archive":     { en: "Archive", es: "Archivar" },
  "a.restore":     { en: "Restore", es: "Restaurar" },
  "a.history":     { en: "View prior runs", es: "Ver análisis anteriores" },

  // archive / touch / edit feedback
  "a.archivedNote": {
    en: "This account is archived. It stays out of the queue until it is restored.",
    es: "Esta cuenta está archivada. Queda fuera de la cola hasta que se restaure.",
  },
  "a.archivedToast": { en: "Account archived", es: "Cuenta archivada" },
  "a.restoredToast": { en: "Account restored", es: "Cuenta restaurada" },
  "a.touchedToast": {
    en: "Marked as touched today. Cool-down starts now.",
    es: "Marcada como contactada hoy. El enfriamiento empieza ahora.",
  },

  // the reading
  "a.assessedOn":  { en: "assessed {date}", es: "analizada el {date}" },
  "a.whyAbstained": { en: "Why it abstained", es: "Por qué se abstuvo" },
  "a.verbatimTag": { en: "verbatim EN", es: "textual EN" },
  "a.noFitNote": {
    en: "abstained, nothing to grade",
    es: "se abstuvo, no hay nada que calificar",
  },

  // evidence
  "a.claims": { en: "{n} claims", es: "{n} afirmaciones" },
  "a.readonlyClaims": {
    en: "Claims are written by the pipeline and are read-only by design. Correcting one means re-running the assessment.",
    es: "Las afirmaciones las escribe el sistema y son de solo lectura a propósito. Corregir una significa volver a correr el análisis.",
  },
  "a.evFilteredEmpty": {
    en: "No claims with this verdict.",
    es: "No hay afirmaciones con este veredicto.",
  },

  // signal kinds (t-label datelines; enum from the pipeline)
  "a.k.expansion":  { en: "Expansion", es: "Expansión" },
  "a.k.product":    { en: "Product", es: "Producto" },
  "a.k.psp_change": { en: "PSP change", es: "Cambio de PSP" },
  "a.k.funding":    { en: "Funding", es: "Financiación" },
  "a.k.hiring":     { en: "Hiring", es: "Contratación" },
  "a.k.leadership": { en: "Leadership", es: "Liderazgo" },
  "a.k.other":      { en: "Signal", es: "Señal" },

  // run trace
  "a.stage":   { en: "Stage", es: "Etapa" },
  "a.model":   { en: "Model", es: "Modelo" },
  "a.latency": { en: "Latency", es: "Latencia" },
  "a.cost":    { en: "Cost", es: "Costo" },
  "a.tokens":  { en: "Tokens", es: "Tokens" },
  "a.expand":  { en: "Details", es: "Detalles" },

  // run history
  "a.historyTitle": { en: "Run history", es: "Historial de análisis" },
  "a.historySub": {
    en: "every run kept, including removed ones; removing a run never destroys its trace",
    es: "se conserva cada análisis, incluidos los eliminados; eliminar un análisis nunca destruye su traza",
  },
  "a.historyEmpty":    { en: "No runs on record yet.", es: "Todavía no hay análisis registrados." },
  "a.historyLoadFail": { en: "Could not load the history.", es: "No se pudo cargar el historial." },
  "a.run":       { en: "Run", es: "Análisis" },
  "a.result":    { en: "Result", es: "Resultado" },
  "a.current":   { en: "current", es: "vigente" },
  "a.removed":   { en: "removed", es: "eliminado" },
  "a.removeRun": { en: "Remove this run", es: "Eliminar este análisis" },
  "a.runRemoved": {
    en: "Run removed. The previous run takes over.",
    es: "Análisis eliminado. El anterior toma su lugar.",
  },
  "a.runRestored": { en: "Run restored", es: "Análisis restaurado" },
  "a.staleNote": {
    en: "The run shown on this page was removed.",
    es: "El análisis que se muestra en esta página fue eliminado.",
  },
  "a.viewUpdated": {
    en: "See the account as it stands now",
    es: "Ver la cuenta como queda ahora",
  },

  // re-assess flow
  "a.queued": {
    en: "Queued as job #{id}. Two to four minutes; this page follows the stages.",
    es: "En cola como trabajo #{id}. De dos a cuatro minutos; esta página va siguiendo las etapas.",
  },
  "a.elapsed":    { en: "{s}s elapsed", es: "{s}s transcurridos" },
  "a.runDone":    { en: "Run finished.", es: "Análisis terminado." },
  "a.viewNewRun": { en: "Open the new run", es: "Abrir el nuevo análisis" },
  "a.retry":      { en: "Retry", es: "Reintentar" },

  // deep link to a domain with no account
  "a.nfTitle": { en: "No account here yet", es: "Aquí no hay ninguna cuenta todavía" },
  "a.nfBody": {
    en: "Nothing is stored for this domain. Add it and run the first assessment in one step.",
    es: "No hay nada guardado para este dominio. Agrégala y corre el primer análisis en un solo paso.",
  },
  "a.nfGo": { en: "Add and assess", es: "Agregar y analizar" },
};

export const meta = {
  route: "/account/:domain",
  nav: "/",
  titleKey: "a.title",
};

/* ======================= shared vocabularies ======================= */
/* State is always a mark plus a word (§3.7). These maps are the page's
   entire use of colour, and every tone comes from the closed set. */

const BAND = {
  work:           { mark: "filled", tone: "ok",   key: "band.work" },
  soon:           { mark: "half",   tone: "ink",  key: "band.soon" },
  needs_evidence: { mark: "hatch",  tone: "held", key: "band.abstained" },
  suppressed:     { mark: "half",   tone: "warn", key: "band.suppressed" },
  below:          { mark: "filled", tone: "bad",  key: "band.below" },
  unscored:       { mark: "hollow", tone: "ghost", key: "band.unscored" },
};

const FLOOR_VERDICT = {
  clears:     { mark: "filled", tone: "ok",   key: "verdict.clears" },
  borderline: { mark: "half",   tone: "warn", key: "verdict.borderline" },
  below:      { mark: "filled", tone: "bad",  key: "verdict.below" },
  unknown:    { mark: "hollow", tone: "mute", key: "common.unknown" },
};

const EV_VERDICT = {
  supported:   { mark: "filled", tone: "ok",   key: "ev.supported" },
  uncertain:   { mark: "half",   tone: "warn", key: "ev.uncertain" },
  unsupported: { mark: "hollow", tone: "bad",  key: "ev.unsupported", dim: true },
};

const TIER_KEY = {
  primary_filing: "tier.primary",
  self_published: "tier.self",
  documentation:  "tier.doc",
  third_party:    "tier.third",
  unclassified:   "tier.unclassified",
};

const SIGNAL_KINDS = new Set(["expansion", "product", "psp_change", "funding", "hiring", "leadership"]);

const DOTS_SVG = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>`;
const CHEV_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M3.2 1.5 7 5 3.2 8.5"/></svg>`;

/* The row-menu host, same markup vocabulary floor.js dispatches on. */
const menuHost = (items, T) =>
  `<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="${esc(T("kit.menu.aria"))}">${DOTS_SVG}</button>${rowMenu(items)}</div>`;

/* Verbatim-English tag, rendered only on the Spanish surface (§3.11). */
const verbatim = (T, lang) =>
  lang === "es" ? ` <span class="verbatim" title="${esc(T("ev.verbatim"))}">${esc(T("a.verbatimTag"))}</span>` : "";

const signalDateline = (s, T) => {
  const kindKey = SIGNAL_KINDS.has(s.kind) ? `a.k.${s.kind}` : "a.k.other";
  const when = s.observed_at ? dateISO(s.observed_at) : T("common.undated");
  return `${esc(T(kindKey))} · ${esc(when)}`;
};

/* ============================== render ============================= */

export async function render(env, data, ctx) {
  const T = ctx.t;
  const lang = ctx.lang;
  const account = data?.account || null;
  const path = ctx.path || (account ? `/account/${account.domain}` : "/");

  if (!account) return renderNotFound(data, ctx, T);

  const { assessment, scored, settings } = data;
  const evidence = data.evidence || [];
  const signals = data.signals || [];
  const traces = data.traces || [];
  const domain = account.domain;
  const floor = Number(settings?.floor_txn ?? 100000);

  /* ---- header: breadcrumb, identity, score + band, page menu ---- */

  const crumbs = `<nav class="crumbs" aria-label="breadcrumb">
    <a href="/">${esc(T("nav.queue"))}</a><span class="sep">▸</span><span>${esc(account.name || domain)}</span>
  </nav>`;

  const archived = !!account.archived_at;
  const archBanner = `<div id="a-arch" class="a-arch"${archived ? "" : " hidden"}>
    <div class="well well-held a-arch-in">
      ${mark("hatch", T("a.archive"), { tone: "held" })}
      <span class="a-arch-t">${esc(T("a.archivedNote"))}</span>
      ${btn(T("a.restore"), { kind: "text", action: "restore:account" })}
    </div>
  </div>`;

  const ident = (f, label, value, display, ghost) => `<span class="ie" data-f="${f}" data-v="${esc(value ?? "")}">
    <span class="ie-l t-label">${esc(label)}</span>
    <button type="button" class="ie-v${ghost ? " none" : ""}${f === "region" ? " mono" : ""}" data-action="edit:${f}">${esc(display)}</button>
    <span class="ie-err" role="alert"></span>
  </span>`;

  const menuItems = [
    { label: T("a.reassess"), action: "acct:reassess" },
    { label: T("a.history"), action: "acct:history" },
    { label: T("a.markTouched"), action: "acct:touch" },
    { label: T("a.editName"), action: "edit:name" },
    "-",
    archived
      ? { label: T("a.restore"), action: "restore:account" }
      : { label: T("a.archive"), action: "destroy:account", danger: true },
  ];

  const band = BAND[scored?.band || "unscored"] || BAND.unscored;
  const scoreV = scored && assessment ? Number(scored.total_score || 0).toFixed(2) : "–";

  const head = `<header class="a-head">
    <div class="a-left">
      <h1 class="a-name"><span class="ie" data-f="name" data-v="${esc(account.name ?? "")}">
        <button type="button" class="ie-v t-title" data-action="edit:name">${esc(account.name || domain)}</button>
        <span class="ie-err" role="alert"></span>
      </span></h1>
      <a class="a-dom mono" href="https://${esc(domain)}" target="_blank" rel="noopener">${esc(domain)} ↗</a>
      <div class="a-ident">
        ${ident("region", T("dim.region"), account.region, account.region || T("acct.regionUnknown"), !account.region)}
        ${ident("owner", T("a.owner"), account.owner, account.owner || T("bl.unassigned"), !account.owner)}
        ${ident("last_touched_at", T("a.lastTouched"), account.last_touched_at, account.last_touched_at || T("cool.neverTouched"), !account.last_touched_at)}
      </div>
      <p class="a-hint">${esc(T("a.editHint"))}</p>
    </div>
    <div class="a-right">
      <div class="a-score">
        <span class="a-score-l t-label">${esc(T("dim.score"))}</span>
        <span class="a-score-v">${esc(scoreV)}</span>
        <span class="a-band">${mark(band.mark, T(band.key), { tone: band.tone })}</span>
      </div>
      ${menuHost(menuItems, T)}
    </div>
  </header>`;

  const stale = `<p id="a-stale" class="a-stale" hidden>
    ${esc(T("a.staleNote"))} <a href="${esc(path)}">${esc(T("a.viewUpdated"))} →</a>
  </p>`;

  /* Re-assess strip: hidden at rest; the sweep runs only while a job
     genuinely runs (§3.9). */
  const runStrip = `<div id="a-run" class="a-run" hidden>
    <div class="a-run-h">
      <span id="a-run-word" class="a-run-w"></span>
      <span id="a-run-el" class="mono a-run-e"></span>
    </div>
    <div class="prog" id="a-run-prog" hidden><i></i></div>
    <p id="a-run-msg" class="a-run-m"></p>
  </div>`;

  /* ------------------------- the reading ------------------------- */

  let reading;
  if (!assessment) {
    reading = `<section class="reading">${well(`<div class="a-norun">
      ${mark("hollow", T("acct.noRun"), { tone: "mute" })}
      <p class="t-body">${esc(T("acct.noRunBody"))}</p>
      ${btn(T("action.assess"), { kind: "primary", action: "acct:reassess" })}
    </div>`, { tone: "dashed" })}</section>`;
  } else if (assessment.abstained) {
    reading = `<section class="reading">
      <div class="r-verdict">
        ${mark("hatch", T("verdict.abstained"), { tone: "held" })}
        <span class="r-noest">${esc(T("verdict.noEstimate"))}</span>
        <span class="r-when mono">${esc(T("a.assessedOn", { date: dateISO(assessment.run_at) }))}</span>
      </div>
      ${gauge({ abstained: true }, T, { size: "hero" })}
      <div class="r-abstain">
        <span class="t-label r-abs-l">${esc(T("a.whyAbstained"))}${verbatim(T, lang)}</span>
        <p class="t-body">${esc(assessment.abstain_reason || "")}</p>
      </div>
      <p class="r-code">${esc(T("verdict.abstainNote"))}</p>
    </section>`;
  } else {
    const fv = FLOOR_VERDICT[scored?.floor_verdict || assessment.floor_verdict] || FLOOR_VERDICT.unknown;
    const range = T("acct.rangeConf", {
      min: count(assessment.txn_min ?? assessment.txn_mid),
      max: count(assessment.txn_max ?? assessment.txn_mid),
      conf: pct(assessment.confidence),
    });
    reading = `<section class="reading">
      <div class="r-verdict">
        ${mark(fv.mark, T(fv.key), { tone: fv.tone })}
        <span class="r-when mono">${esc(T("a.assessedOn", { date: dateISO(assessment.run_at) }))}</span>
      </div>
      <div class="r-fig">
        <span class="t-display">${esc(count(assessment.txn_mid))}</span>
        <span class="r-unit">${esc(T("unit.txnMo"))}</span>
        <span class="r-range mono">${range}</span>
      </div>
      ${gauge({
        min: assessment.txn_min, mid: assessment.txn_mid, max: assessment.txn_max,
        floor, verdict: scored?.floor_verdict || assessment.floor_verdict,
        confidence: assessment.confidence,
      }, T, { size: "hero" })}
      ${assessment.method ? `<p class="r-method">${esc(assessment.method)}${verbatim(T, lang)}</p>` : ""}
    </section>`;
  }

  /* --------------------- the dimension row ----------------------- */

  let dims = "";
  if (assessment && scored) {
    const nSig = signals.length;
    const coolState = scored.cooldown_state || "never_touched";
    const coolWord =
      coolState === "suppressed" ? T("cool.word.held")
      : coolState === "eligible" ? T("cool.eligible")
      : T("cool.neverTouched");
    const coolNote =
      coolState === "suppressed" ? T("cool.held", { date: scored.cooldown_until || "" })
      : account.last_touched_at ? T("cool.lastTouched", { date: account.last_touched_at })
      : T("field.touchedTip");
    dims = `<div class="a-dims">${statRow([
      {
        label: T("dim.fit"),
        value: scored.fit_score == null ? null : esc(Number(scored.fit_score).toFixed(2)),
        note: scored.fit_score == null ? T("a.noFitNote") : T("dim.vsFloorLong", { floor: count(floor) }),
      },
      {
        label: T("dim.timing"),
        value: esc(Number(scored.timing_score || 0).toFixed(2)),
        note: nSig ? T("dim.signalsDecay", { n: nSig }) : T("dim.noDatedReason"),
      },
      { label: T("col.cooldown"), value: esc(coolWord), note: coolNote, mono: false },
      {
        label: T("dim.confidence"),
        value: esc(pct(assessment.confidence)),
        note: T("dim.dampensLong"),
      },
    ])}</div>`;
  }

  /* ----------------------- evidence table ------------------------ */

  let evidenceSection = "";
  if (assessment) {
    const counts = { supported: 0, uncertain: 0, unsupported: 0 };
    for (const e of evidence) if (counts[e.verdict] != null) counts[e.verdict]++;

    const tab = (id, label, n) =>
      `<button type="button" class="tab${id === "all" ? " on" : ""}" data-evf="${id}" data-l="${esc(label)}">${esc(label)}<span class="tab-n">${n}</span></button>`;
    const evTabs = `<nav class="tabs ev-tabs">
      ${tab("all", T("action.all"), evidence.length)}
      ${tab("supported", T("ev.supported"), counts.supported)}
      ${tab("uncertain", T("ev.uncertain"), counts.uncertain)}
      ${tab("unsupported", T("ev.unsupported"), counts.unsupported)}
    </nav>`;

    const bodies = evidence.map((e) => {
      const v = EV_VERDICT[e.verdict] || { mark: "hollow", tone: "mute", key: null };
      const cls = `row-acc-${v.tone === "mute" ? "held" : v.tone}${v.dim ? " row-dim" : ""}`;
      const tierKey = TIER_KEY[e.source_class?.tier] || "tier.unclassified";
      const src = e.source_url
        ? `<a href="${esc(e.source_url)}" target="_blank" rel="noopener">${esc(host(e.source_url))} ↗</a>`
        : `<span class="ink-4">${esc(T("ev.noSource"))}</span>`;
      return `<tbody class="ev-i" data-v="${esc(e.verdict || "")}">
        <tr class="${cls}">
          <td class="mono ev-f">${esc(e.field)}</td>
          <td class="ev-v">${esc(e.value)}</td>
          <td class="ev-m">${esc(e.method || "")}</td>
          <td class="ev-t2">${esc(T(tierKey))}</td>
          <td class="ev-c">${mark(v.mark, v.key ? T(v.key) : (e.verdict || "?"), { tone: v.tone })}</td>
          <td class="ev-s mono">${src}</td>
        </tr>
        ${e.critic_note ? `<tr class="ev-n ${cls}"><td colspan="6">${esc(e.critic_note)}</td></tr>` : ""}
      </tbody>`;
    }).join("");

    const evTable = evidence.length
      ? `<div class="tbl-wrap"><table class="tbl tbl-ruled ev-tbl">
          <thead><tr>
            <th>${esc(T("ev.field"))}</th><th>${esc(T("ev.value"))}</th><th>${esc(T("ev.method"))}</th>
            <th>${esc(T("ev.sourceType"))}</th><th>${esc(T("ev.critic"))}</th><th>${esc(T("ev.source"))}</th>
          </tr></thead>
          ${bodies}
          <tbody class="ev-none" hidden><tr><td colspan="6"><div class="f-empty"><p>${esc(T("a.evFilteredEmpty"))}</p></div></td></tr></tbody>
        </table></div>`
      : `<div class="f-empty"><p>${esc(T("ev.empty"))}</p></div>`;

    evidenceSection = section({
      label: T("ev.title"),
      title: T("a.claims", { n: evidence.length }),
      sub: T("ev.sub"),
      body: `${evidence.length ? evTabs : ""}${evTable}
        <p class="ev-foot">${esc(T("a.readonlyClaims"))}${lang === "es" ? ` ${esc(T("ev.langNote"))}` : ""}</p>`,
    });
  }

  /* -------------------------- signals ---------------------------- */

  const sigBody = signals.length
    ? `<ul class="sigs">${signals.map((s) => `<li class="sig">
        <span class="sig-h t-label">${signalDateline(s, T)}</span>
        <p class="sig-d t-body">${esc(s.description)}</p>
        <span class="sig-meta mono">${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(host(s.url))} ↗</a> · ` : ""}${esc(T("acct.weight"))} ${esc(Number(s.weight ?? 0).toFixed(2))}</span>
      </li>`).join("")}</ul>`
    : `<div class="f-empty"><p>${esc(T("sig.none"))}</p></div>`;

  const signalsSection = section({ title: T("sig.title"), body: sigBody });

  /* ------------------------- run trace --------------------------- */

  let traceSection = "";
  if (assessment) {
    const totalMs = traces.reduce((a, tr) => a + (tr.latency_ms || 0), 0);
    const maxMs = Math.max(1, ...traces.map((tr) => tr.latency_ms || 0));
    const stageKey = { research: "stage.research", extract: "stage.extract", critic: "stage.critic" };
    const blurbKey = { research: "trace.research", extract: "trace.extract", critic: "trace.critic" };
    const fmtMs = (ms) => (ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${num(ms)}ms`);

    const rows = traces.map((tr) => ({
      id: `t${tr.id}`,
      cells: [
        esc(T(stageKey[tr.step] || tr.step)),
        `<span class="mono">${esc(tr.model)}</span><span class="trc-eff"> · ${esc(tr.effort || "")}</span>`,
        `<span class="lat"><i style="width:${Math.max(3, Math.round(((tr.latency_ms || 0) / maxMs) * 100))}%"></i></span><span class="mono">${esc(fmtMs(tr.latency_ms || 0))}</span>`,
        esc(money(tr.cost_usd, 4)),
        esc(num((tr.input_tokens || 0) + (tr.output_tokens || 0))),
        `<button type="button" class="btn-icon chev" data-action="trace:toggle" aria-expanded="false" aria-label="${esc(T("a.expand"))}">${CHEV_SVG}</button>`,
      ],
      inset: `<div class="trc-x">
        <p class="trc-b">${esc(T(blurbKey[tr.step] || ""))}</p>
        <dl class="trc-g">
          <div><dt>${esc(T("trace.input"))}</dt><dd>${esc(num(tr.input_tokens))}</dd></div>
          <div><dt>${esc(T("trace.output"))}</dt><dd>${esc(num(tr.output_tokens))}</dd></div>
          <div><dt>${esc(T("trace.cacheRead"))}</dt><dd>${esc(num(tr.cache_read))}</dd></div>
          <div><dt>${esc(T("trace.searches"))}</dt><dd>${esc(num(tr.searches || 0))}</dd></div>
          <div><dt>${esc(T("trace.stop"))}</dt><dd>${esc(tr.stop_reason || "")}</dd></div>
        </dl>
      </div>`,
    }));

    // The scorer row: deterministic code, no model call. The $0.00000 is
    // the argument that the arithmetic is reproducible.
    rows.push({
      id: "tscore",
      cells: [
        esc(T("trace.scorerName")),
        `<span class="trc-code">${esc(T("trace.scorerDesc"))}</span>`,
        `<span class="lat"><i style="width:0%"></i></span><span class="mono">0ms</span>`,
        esc(money(0, 5)),
        `<span class="ink-4">–</span>`,
        "",
      ],
    });

    traceSection = section({
      title: T("trace.title"),
      sub: esc(T("trace.sub", {
        cost: money(assessment.cost_usd, 4),
        sec: Math.round(totalMs / 1000),
        n: traces.length,
      })),
      actions: btn(T("a.history"), { kind: "text", action: "acct:history" }),
      body: `<div class="trc">${table({
        cols: [
          { label: T("a.stage") },
          { label: T("a.model") },
          { label: T("a.latency"), width: 170 },
          { label: T("a.cost"), align: "right", mono: true, width: 90 },
          { label: T("a.tokens"), align: "right", mono: true, width: 90 },
          { label: "", width: 44 },
        ],
        rows,
        size: "dense",
        empty: esc(T("common.empty")),
      }, T)}</div>
      <p class="trc-foot">${esc(T("trace.foot"))}</p>`,
    });
  }

  /* ------------------------ run history -------------------------- */

  const historySection = section({
    title: T("a.historyTitle"),
    sub: esc(T("a.historySub")),
    body: `<div id="hist">${btn(T("a.history"), { kind: "quiet", action: "acct:history" })}</div>`,
  });

  /* ------------------------------ page --------------------------- */

  return `<div class="acct" data-domain="${esc(domain)}" data-aid="${esc(assessment?.id ?? "")}" data-path="${esc(path)}">
    ${crumbs}
    ${archBanner}
    ${head}
    ${stale}
    ${runStrip}
    ${reading}
    ${dims}
    ${evidenceSection}
    ${signalsSection}
    ${traceSection}
    ${historySection}
  </div>`;
}

/* Deep link to a domain with no stored account: a found-nothing page
   that offers to add and assess it in one step (§4.2 states). */
function renderNotFound(data, ctx, T) {
  const domain = data?.domain || decodeURIComponent((ctx.path || "").split("/")[2] || "");
  return `<div class="acct" data-domain="${esc(domain)}" data-aid="" data-path="${esc(ctx.path || "/")}">
    <nav class="crumbs" aria-label="breadcrumb">
      <a href="/">${esc(T("nav.queue"))}</a><span class="sep">▸</span><span class="mono">${esc(domain)}</span>
    </nav>
    <div id="a-run" class="a-run" hidden>
      <div class="a-run-h"><span id="a-run-word" class="a-run-w"></span><span id="a-run-el" class="mono a-run-e"></span></div>
      <div class="prog" id="a-run-prog" hidden><i></i></div>
      <p id="a-run-msg" class="a-run-m"></p>
    </div>
    <section class="a-nf"><div class="f-empty">
      <h1 class="t-section">${esc(T("a.nfTitle"))}</h1>
      <p>${esc(T("a.nfBody"))}</p>
      <span class="mono a-nf-d">${esc(domain)}</span>
      ${btn(T("a.nfGo"), { kind: "primary", action: "acct:reassess" })}
    </div></section>
  </div>`;
}

/* =============================== css =============================== */
/* Scoped to .p-account, single-line rules, spacing on the 4px scale. */

export function css() {
  return `
.p-account .acct { display: block; }
.p-account .ev-none td { height: auto; padding: 16px 0; border-bottom: 0; }
.p-account .a-arch { margin-top: 16px; }
.p-account .a-arch-in { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.p-account .a-arch-in .mk { align-self: center; flex: none; }
.p-account .a-arch-t { font-size: 13px; }
.p-account .a-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; padding-top: 24px; }
.p-account .a-left { min-width: 0; max-width: 72ch; }
.p-account .a-name { display: inline; }
.p-account .a-dom { margin-left: 12px; font-size: 13px; }
.p-account .a-ident { display: flex; gap: 32px; flex-wrap: wrap; margin-top: 16px; }
.p-account .ie { display: inline-flex; flex-direction: column; gap: 4px; vertical-align: baseline; }
.p-account .a-name .ie { display: inline-flex; }
.p-account .ie-l { color: var(--ink-3); }
.p-account .ie-v { background: none; border: none; padding: 0 0 1px; cursor: pointer; text-align: left; font: 400 13px/1.45 var(--sans); color: var(--ink-1); border-bottom: 1px dotted var(--ink-4); align-self: flex-start; }
.p-account .ie-v.mono { font-family: var(--mono); }
.p-account .ie-v:hover { border-bottom-color: var(--ink-2); }
.p-account .ie-v.none { color: var(--ink-4); }
.p-account .ie-v.t-title { font: 650 21px/1.2 var(--sans); letter-spacing: -.02em; }
.p-account .ie-in { min-width: 160px; }
.p-account .ie-in.t-title { height: 36px; font: 650 18px/1.2 var(--sans); }
.p-account .ie-err { color: var(--bad); font-size: 12px; line-height: 1.5; max-width: 36ch; }
.p-account .ie-err:empty { display: none; }
.p-account .a-hint { margin-top: 12px; color: var(--ink-3); font-size: 12px; line-height: 1.5; }
.p-account .a-right { display: flex; align-items: flex-start; gap: 12px; flex: none; padding-top: 4px; }
.p-account .a-score { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; text-align: right; }
.p-account .a-score-l { color: var(--ink-3); }
.p-account .a-score-v { font: 650 24px/1.1 var(--mono); letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.p-account .a-band { margin-top: 2px; }
.p-account .a-stale { margin-top: 16px; color: var(--held); font-size: 13px; }
.p-account .a-run { margin-top: 24px; background: var(--well); border-radius: 6px; padding: 12px 16px; }
.p-account .a-run-h { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 8px; }
.p-account .a-run-w { font-size: 13px; font-weight: 600; }
.p-account .a-run-e { font-size: 11px; color: var(--ink-3); }
.p-account .a-run-m { margin-top: 8px; font-size: 13px; color: var(--ink-2); }
.p-account .a-run-m .f-error { margin-top: 4px; }
.p-account .reading { margin-top: 32px; }
.p-account .r-verdict { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.p-account .r-verdict .mk { font-weight: 600; }
.p-account .r-when { color: var(--ink-4); font-size: 11px; }
.p-account .r-noest { color: var(--held); font-size: 13px; }
.p-account .r-fig { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
.p-account .r-unit { color: var(--ink-3); font-size: 14px; }
.p-account .r-range { color: var(--ink-3); font-size: 13px; }
.p-account .r-method { margin-top: 16px; max-width: 72ch; font: 400 14px/1.55 var(--sans); color: var(--ink-2); }
.p-account .r-abstain { margin-top: 24px; max-width: 72ch; }
.p-account .r-abs-l { color: var(--held); display: block; margin-bottom: 6px; }
.p-account .r-abstain p { color: var(--ink-1); }
.p-account .r-code { margin-top: 12px; max-width: 72ch; font-size: 13px; line-height: 1.5; color: var(--ink-3); }
.p-account .a-norun { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
.p-account .a-norun p { max-width: 64ch; }
.p-account .a-dims { margin-top: 32px; }
.p-account .a-dims .stat-v { font-size: 21px; }
.p-account .ev-tabs { margin-bottom: 12px; }
.p-account .ev-tbl td { height: auto; }
.p-account .ev-i > tr:first-child td { border-bottom: 0; padding-top: 10px; padding-bottom: 2px; vertical-align: top; }
.p-account .ev-i .ev-n td { padding-top: 0; padding-bottom: 10px; color: var(--ink-2); font-size: 13px; line-height: 1.5; }
.p-account .ev-i .ev-n td { max-width: 0; }
.p-account .ev-f { white-space: nowrap; }
.p-account .ev-v { min-width: 220px; }
.p-account .ev-m { color: var(--ink-3); min-width: 140px; }
.p-account .ev-t2 { white-space: nowrap; color: var(--ink-2); }
.p-account .ev-c { white-space: nowrap; }
.p-account .ev-s { white-space: nowrap; }
.p-account .ev-i:hover td { background: color-mix(in srgb, var(--ink-1) 3%, transparent); }
.p-account .ev-foot { margin-top: 16px; font-size: 12px; line-height: 1.5; color: var(--ink-3); max-width: 88ch; }
.p-account .sigs { list-style: none; padding: 0; display: flex; flex-direction: column; }
.p-account .sig { padding: 12px 0; border-bottom: 1px solid var(--line); }
.p-account .sig-h { color: var(--ink-3); display: block; }
.p-account .sig-d { margin-top: 4px; max-width: 80ch; }
.p-account .sig-meta { display: block; margin-top: 4px; font-size: 11px; color: var(--ink-3); }
.p-account .trc-eff { color: var(--ink-3); font-size: 12px; }
.p-account .trc-code { color: var(--ink-2); font-size: 13px; }
.p-account .lat { display: inline-block; vertical-align: middle; width: 72px; height: 4px; background: var(--well); border-radius: 2px; overflow: hidden; margin-right: 8px; }
.p-account .lat i { display: block; height: 100%; background: var(--line-2); }
.p-account .chev svg { transition: transform .18s var(--ease); }
.p-account .chev[aria-expanded="true"] svg { transform: rotate(90deg); }
.p-account .trc tr[data-id] { cursor: pointer; }
.p-account .trc-x { max-width: 80ch; }
.p-account .trc-b { color: var(--ink-2); font-size: 13px; line-height: 1.5; }
.p-account .trc-g { display: flex; gap: 32px; flex-wrap: wrap; margin: 12px 0 0; }
.p-account .trc-g dt { font: 600 11px/1.3 var(--sans); letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3); }
.p-account .trc-g dd { margin: 4px 0 0; font-family: var(--mono); font-size: 13px; font-variant-numeric: tabular-nums; }
.p-account .trc-foot { margin-top: 16px; font-size: 12px; line-height: 1.5; color: var(--ink-3); max-width: 88ch; }
.p-account .hist-err { color: var(--bad); font-size: 13px; }
.p-account .a-nf { margin-top: 32px; }
.p-account .a-nf .f-empty { padding: 48px 24px; }
.p-account .a-nf-d { color: var(--ink-2); }
@media (max-width: 720px) { .p-account .a-right { width: 100%; flex-direction: row-reverse; justify-content: space-between; } .p-account .a-score { align-items: flex-start; text-align: left; } .p-account .a-ident { gap: 16px; } }
`;
}

/* ============================== script ============================= */
/* An IIFE with no template literals, so it nests inside the module's
   own template safely. Reaches Floor.* only inside event handlers,
   because this script loads before /static/floor.js. */

export function script() {
  return `(function () {
  "use strict";

  var REGIONS = ["", "NORTHAMERICA", "EUROPE", "APAC", "LATAM", "AMEA"];
  var MK = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    hatch: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/><path d="M1 6.6 3.4 9M1 3.2 6.8 9M2.8 1 9 7.2M6.4 1 9 3.6" stroke="currentColor" stroke-width="1"/></svg>',
    dashed: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2 1.7"/></svg>'
  };
  var DOTS = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

  function q(s, r) { return (r || document).querySelector(s); }
  function root() { return q(".p-account .acct"); }
  function D() { var r = root(); return r ? r.dataset : {}; }
  function t(k, v) { return window.Floor ? Floor.t(k, v) : k; }
  function esc(s) {
    s = String(s == null ? "" : s).replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ");
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmtN(n) {
    if (n == null) return "";
    n = Number(n);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\\.0$/, "") + "B";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\\.0$/, "") + "M";
    if (n >= 1e3) return Math.round(n / 1e3) + "k";
    return String(n);
  }
  function mkWord(kind, tone, word) {
    return '<span class="mk tone-' + tone + '">' + MK[kind] + '<span class="mk-w">' + esc(word) + "</span></span>";
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  /* ------------------------- inline editing ------------------------ */
  /* T14: click the value, it becomes the input. Enter saves, Esc
     cancels, a 400 renders its message under the field it names. */

  var FIELD_TYPES = { region: "select", owner: "text", last_touched_at: "date", name: "text" };

  function displayFor(f, v) {
    if (v) return v;
    if (f === "region") return t("acct.regionUnknown");
    if (f === "owner") return t("bl.unassigned");
    if (f === "last_touched_at") return t("cool.neverTouched");
    return D().domain || "";
  }

  function beginEdit(f) {
    var hosts = document.querySelectorAll('.p-account .ie[data-f="' + f + '"]');
    var h = hosts.length ? hosts[0] : null;
    if (!h || h.querySelector("input,select")) return;
    var btnEl = h.querySelector(".ie-v");
    var errEl = h.querySelector(".ie-err");
    var cur = h.getAttribute("data-v") || "";
    var kind = FIELD_TYPES[f] || "text";
    var ctl;
    if (kind === "select") {
      ctl = document.createElement("select");
      for (var i = 0; i < REGIONS.length; i++) {
        var o = document.createElement("option");
        o.value = REGIONS[i];
        o.textContent = REGIONS[i] || t("acct.regionUnknown");
        if (REGIONS[i] === cur) o.selected = true;
        ctl.appendChild(o);
      }
    } else {
      ctl = document.createElement("input");
      ctl.type = kind === "date" ? "date" : "text";
      ctl.value = cur;
    }
    ctl.className = "input ie-in" + (f === "name" ? " t-title" : "") + (f === "region" ? " mono" : "");
    btnEl.hidden = true;
    if (errEl) errEl.textContent = "";
    h.insertBefore(ctl, errEl);
    ctl.focus();
    if (ctl.select) ctl.select();

    var busy = false;
    function close() { ctl.remove(); btnEl.hidden = false; btnEl.focus(); }
    function save() {
      if (busy) return;
      busy = true;
      var val = ctl.value;
      var body = {};
      body[f] = val;
      Floor.post("/api/account/" + encodeURIComponent(D().domain), body)
        .then(function (r) {
          applyField(f, r.after ? r.after[f] : val);
          close();
          Floor.flash(h);
        })
        .catch(function (e) {
          busy = false;
          if (errEl) errEl.textContent = e.message;
          ctl.focus();
        });
    }
    ctl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); save(); }
      else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    });
    if (kind === "select") ctl.addEventListener("change", save);
    ctl.addEventListener("blur", function () {
      setTimeout(function () { if (!busy && ctl.parentNode) close(); }, 120);
    });
  }

  function applyField(f, v) {
    v = v == null ? "" : String(v);
    var hosts = document.querySelectorAll('.p-account .ie[data-f="' + f + '"]');
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      h.setAttribute("data-v", v);
      var b = h.querySelector(".ie-v");
      if (b) { b.textContent = displayFor(f, v); b.classList.toggle("none", !v && f !== "name"); }
      var err = h.querySelector(".ie-err");
      if (err) err.textContent = "";
    }
    // The breadcrumb repeats the name; keep it honest without a reload.
    if (f === "name") {
      var crumb = document.querySelector(".p-account .crumbs span:not(.sep)");
      if (crumb) crumb.textContent = v || (D().domain || "");
    }
  }

  /* --------------------------- mark touched ------------------------ */

  function markTouched() {
    var before = null;
    var h = q('.p-account .ie[data-f="last_touched_at"]');
    if (h) before = h.getAttribute("data-v") || "";
    Floor.post("/api/account/" + encodeURIComponent(D().domain), { last_touched_at: today() })
      .then(function () {
        applyField("last_touched_at", today());
        if (h) Floor.flash(h);
        Floor.toast(t("a.touchedToast"), { undo: function () {
          Floor.post("/api/account/" + encodeURIComponent(D().domain), { last_touched_at: before || "" })
            .then(function () { applyField("last_touched_at", before || ""); });
        } });
      })
      .catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }

  /* ------------------------ archive + restore ---------------------- */

  function setArchived(on) {
    var b = q("#a-arch");
    if (b) b.hidden = !on;
  }
  function archive() {
    Floor.post("/api/account/" + encodeURIComponent(D().domain) + "/archive")
      .then(function () {
        setArchived(true);
        Floor.toast(t("a.archivedToast"), { undo: unarchive });
      })
      .catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }
  function unarchive() {
    Floor.post("/api/account/" + encodeURIComponent(D().domain) + "/unarchive")
      .then(function () {
        setArchived(false);
        Floor.toast(t("a.restoredToast"));
      })
      .catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }

  /* --------------------------- run history ------------------------- */

  function histHost() { return q("#hist"); }

  function loadHistory(scroll) {
    var hostEl = histHost();
    if (!hostEl) return;
    hostEl.setAttribute("aria-busy", "true");
    Floor.post("/api/account/" + encodeURIComponent(D().domain) + "/history")
      .then(function (r) {
        hostEl.removeAttribute("aria-busy");
        renderHistory(r.history || []);
        if (scroll) hostEl.scrollIntoView({ block: "center" });
      })
      .catch(function (e) {
        hostEl.removeAttribute("aria-busy");
        hostEl.innerHTML = '<p class="hist-err">' + esc(t("a.historyLoadFail")) + " " + esc(e.message) +
          '</p><button type="button" class="btn btn-text" data-action="acct:history">' + esc(t("a.retry")) + "</button>";
      });
  }

  function renderHistory(rows) {
    var hostEl = histHost();
    if (!hostEl) return;
    if (!rows.length) {
      hostEl.innerHTML = '<div class="f-empty"><p>' + esc(t("a.historyEmpty")) + "</p></div>";
      return;
    }
    var currentId = null;
    for (var i = 0; i < rows.length; i++) { if (!rows[i].deleted_at) { currentId = rows[i].id; break; } }
    var out = '<div class="tbl-wrap"><table class="tbl tbl-dense"><thead><tr>' +
      "<th>" + esc(t("a.run")) + "</th><th>" + esc(t("a.result")) + "</th>" +
      '<th class="num">' + esc(t("col.conf")) + '</th><th class="num">' + esc(t("a.cost")) + "</th>" +
      "<th></th><th class=\\"col-menu\\"></th></tr></thead><tbody>";
    for (var j = 0; j < rows.length; j++) {
      var r = rows[j];
      var removed = !!r.deleted_at;
      var result = r.abstained
        ? mkWord("hatch", "held", t("verdict.abstained"))
        : '<span class="mono">' + esc(fmtN(r.txn_mid)) + '</span> <span class="ink-3 mono">' + esc(fmtN(r.txn_min)) + "\\u2013" + esc(fmtN(r.txn_max)) + "</span>";
      var state = removed
        ? mkWord("dashed", "ghost", t("a.removed"))
        : (r.id === currentId ? mkWord("filled", "ink", t("a.current")) : "");
      var menu = '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(t("kit.menu.aria")) + '">' + DOTS +
        '</button><div class="menu" role="menu" hidden>' +
        (removed
          ? '<button type="button" class="menu-item" role="menuitem" data-action="restore:assessment">' + esc(t("a.restore")) + "</button>"
          : '<button type="button" class="menu-item danger" role="menuitem" data-action="destroy:assessment" data-danger="1">' + esc(t("a.removeRun")) + "</button>") +
        "</div></div>";
      out += '<tr data-id="' + r.id + '"' + (removed ? ' class="row-dim"' : "") + ">" +
        '<td class="mono">' + esc(String(r.run_at || "").slice(0, 16)) + "</td>" +
        "<td>" + result + "</td>" +
        '<td class="num mono">' + Math.round((r.confidence || 0) * 100) + "%</td>" +
        '<td class="num mono">$' + Number(r.cost_usd || 0).toFixed(4) + "</td>" +
        "<td>" + state + "</td>" +
        '<td class="col-menu">' + menu + "</td></tr>";
    }
    out += "</tbody></table></div>";
    hostEl.innerHTML = out;
  }

  function removeRun(id) {
    if (!id) return;
    Floor.post("/api/assessment/" + id, {})
      .then(function () {
        loadHistory(false);
        if (String(id) === String(D().aid)) { var s = q("#a-stale"); if (s) s.hidden = false; }
        Floor.toast(t("a.runRemoved"), { undo: function () { restoreRun(id, true); } });
      })
      .catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }
  function restoreRun(id, silent) {
    if (!id) return;
    Floor.post("/api/assessment/" + id + "/restore", {})
      .then(function () {
        loadHistory(false);
        if (String(id) === String(D().aid)) { var s = q("#a-stale"); if (s) s.hidden = true; }
        if (!silent) Floor.toast(t("a.runRestored"));
      })
      .catch(function (e) { Floor.toast(t("common.notSaved", { err: e.message })); });
  }

  /* ----------------------------- re-assess ------------------------- */
  /* POST /api/assess, then poll the job. The sweep runs only while the
     job is genuinely running; errors persist inline with a retry. */

  var pollTimer = null;
  var startedAt = 0;

  function runEls() {
    return { box: q("#a-run"), word: q("#a-run-word"), el: q("#a-run-el"), prog: q("#a-run-prog"), msg: q("#a-run-msg") };
  }
  function setRunning(on) {
    var e = runEls();
    if (e.prog) {
      e.prog.classList.toggle("is-running", !!on);
      // The sweep exists only while work genuinely runs; at rest the bar
      // itself leaves, so no accent line ever sits idle on the page.
      e.prog.hidden = !on;
    }
  }
  function runFail(err) {
    var e = runEls();
    setRunning(false);
    if (e.word) e.word.textContent = "";
    if (e.msg) e.msg.innerHTML = '<span class="f-error">' + esc(t("run.error", { err: err })) +
      '</span> <button type="button" class="btn btn-text btn-sm" data-action="acct:retry">' + esc(t("a.retry")) + "</button>";
  }

  function assess() {
    var e = runEls();
    if (!e.box) return;
    e.box.hidden = false;
    if (e.msg) e.msg.textContent = "";
    if (e.word) e.word.textContent = t("run.assessing") + "\\u2026";
    if (e.el) e.el.textContent = "";
    setRunning(true);
    Floor.post("/api/assess", { domain: D().domain })
      .then(function (r) {
        if (r.cached) {
          setRunning(false);
          if (e.word) e.word.textContent = t("run.cachedMode");
          if (e.msg) e.msg.textContent = r.note || "";
          return;
        }
        startedAt = Date.now();
        if (e.msg) e.msg.textContent = t("a.queued", { id: r.job_id });
        poll(r.job_id);
      })
      .catch(function (err) { runFail(err.message); });
  }

  function stageWord(stage) {
    var map = { research: "stage.research", extract: "stage.extract", critic: "stage.critic", scoring: "stage.score" };
    return t(map[stage] || "run.assessing");
  }

  function poll(jobId) {
    clearTimeout(pollTimer);
    fetch("/api/job/" + jobId)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var e = runEls();
        if (!d.ok || !d.job) { runFail(d.error || "job"); return; }
        var j = d.job;
        if (e.el && startedAt) e.el.textContent = t("a.elapsed", { s: Math.round((Date.now() - startedAt) / 1000) });
        if (j.status === "running") {
          if (e.word) e.word.textContent = t("run.assessing") + " \\u00b7 " + stageWord(j.stage);
          pollTimer = setTimeout(function () { poll(jobId); }, 4000);
          return;
        }
        if (j.status === "done") {
          setRunning(false);
          if (e.word) e.word.textContent = t("a.runDone");
          var fig = "";
          var a2 = d.detail && d.detail.assessment;
          if (a2) fig = a2.abstained ? esc(t("verdict.abstained")) : esc(fmtN(a2.txn_mid)) + " " + esc(t("unit.txnMo"));
          if (e.msg) e.msg.innerHTML = (fig ? fig + " \\u00b7 " : "") +
            '<a href="' + esc(D().path || location.pathname) + '">' + esc(t("a.viewNewRun")) + " \\u2192</a>";
          return;
        }
        runFail(j.detail || j.status);
      })
      .catch(function (err) { runFail(err.message); });
  }

  /* -------------------------- trace expand ------------------------- */

  function toggleTrace(tr) {
    if (!tr) return;
    var id = tr.getAttribute("data-id");
    var inset = q('.p-account .trc tr[data-inset-for="' + id + '"]');
    if (!inset) return;
    inset.hidden = !inset.hidden;
    var chev = tr.querySelector(".chev");
    if (chev) chev.setAttribute("aria-expanded", inset.hidden ? "false" : "true");
  }

  document.addEventListener("click", function (e) {
    // evidence filter tabs
    var tab = e.target.closest(".p-account .ev-tabs .tab");
    if (tab) {
      var f = tab.getAttribute("data-evf");
      var tabsEl = tab.parentElement.querySelectorAll(".tab");
      for (var i = 0; i < tabsEl.length; i++) tabsEl[i].classList.toggle("on", tabsEl[i] === tab);
      var shown = 0;
      var groups = document.querySelectorAll(".p-account .ev-i");
      for (var k = 0; k < groups.length; k++) {
        var on = f === "all" || groups[k].getAttribute("data-v") === f;
        groups[k].hidden = !on;
        if (on) shown++;
      }
      var none = q(".p-account .ev-none");
      if (none) none.hidden = shown > 0;
      return;
    }
    // trace rows expand on click anywhere that is not a control
    var tr = e.target.closest(".p-account .trc tr[data-id]");
    if (tr && !e.target.closest("button, a, .menu")) toggleTrace(tr);
  });

  /* --------------------------- action bus -------------------------- */

  document.addEventListener("floor:action", function (e) {
    var a = e.detail.action || "";
    if (a.slice(0, 5) === "edit:") { beginEdit(a.slice(5)); return; }
    if (a === "acct:reassess" || a === "acct:retry") { assess(); return; }
    if (a === "acct:touch") { markTouched(); return; }
    if (a === "destroy:account") { archive(); return; }
    if (a === "restore:account") { unarchive(); return; }
    if (a === "acct:history") { loadHistory(true); return; }
    if (a === "destroy:assessment") { removeRun(e.detail.id); return; }
    if (a === "restore:assessment") { restoreRun(e.detail.id); return; }
    if (a === "trace:toggle") { toggleTrace(e.detail.el && e.detail.el.closest("tr[data-id]")); return; }
  });
})();`;
}
