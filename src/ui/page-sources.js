/* Floor · page-sources.js — the Sources page (route /sources)
   ---------------------------------------------------------------------
   Rebuilt 2026-08-09, when the page stopped being true. It was written
   when exactly one source was connected and said so in four places. Two
   are connected now, and the second one, the SEC's own filing store,
   does two different jobs that the old page had no way to distinguish:

     in an assessment  the filing is fetched by CIK and reduced in code
                       before any search runs, so research starts from
                       primary text instead of hunting for a figure;
     in the accuracy   ground truth is extracted from those same filings,
       score           quoted verbatim, converted to a monthly rate in
                       code. That only counts because EDGAR is genuinely
                       independent of web search rather than the same
                       engine asked twice.

   So the page opens with a comparison of what is connected and what each
   one is for, then the registry, then the rules. The durable claim under
   all of it, which survives every source change: provenance, adversarial
   checking, abstention and a measured accuracy score make any source safe
   to build on. The plumbing is swappable, the trust is not. That sentence
   is src.lede + verdict.abstainNote, reused rather than rewritten.

   Retired copy. src.note ("One source is connected"), src.regSub ("One is
   live") and src.regFoot (still lists SEC EDGAR as unwired) describe an
   architecture that no longer exists. i18n.js is router-owned, so this
   page supersedes them with src.note2 / src.regSub2 / src.attackOrder
   from its own keys object rather than editing the shared dictionary.
   Nothing in this file names a source in prose: names, costs and counts
   come from the registry payload, which is what stopped the page being
   true the first time.

   Data: render() receives GET /api/sources synchronously (data param).
   Classification rules come from a separate client-side fetch of
   GET /api/source-rules, per the loading doctrine in DESIGN-SPEC §3.10:
   a client-fetched region renders placeholder rows first, then its real
   layout, and every mutation repaints the same region in place. Because
   that region is built and repainted entirely in the browser, script()
   below hand-builds the same markup kit.js would produce server-side
   (same classes, same structure) rather than importing kit.js into the
   browser, which is not possible for a plain inlined <script>.
   --------------------------------------------------------------------- */

import { esc, mark, level, section, table, btn, field, dialog } from "./kit.js";

export const meta = { route: "/sources", nav: "/sources", titleKey: "nav.sources" };

const REGION_SHORT = { NORTHAMERICA: "NA", EUROPE: "EU", APAC: "APAC", LATAM: "LATAM", AMEA: "AMEA" };
const REGION_KEY = {
  NORTHAMERICA: "src.region.NORTHAMERICA",
  EUROPE: "src.region.EUROPE",
  APAC: "src.region.APAC",
  LATAM: "src.region.LATAM",
  AMEA: "src.region.AMEA",
};
const LEVEL_RANK = { none: 0, weak: 1, partial: 2, strong: 3 };
const KIND_KEY = {
  evidence: "src.kind.evidence",
  volume: "src.kind.volume",
  footprint: "src.kind.footprint",
  timing: "dim.timing",
  truth: "src.kind.truth",
};
const COST_KEY = {
  included: "src.cost.included",
  free: "src.cost.free",
  low: "src.cost.low",
  paid: "src.cost.paid",
  enterprise: "src.cost.enterprise",
  owned: "src.cost.owned",
};

/* Costs cheap enough that wiring them is a decision about time, not
   budget. Drives the order-of-attack sentence and the "next up" tag, so
   neither can name a source the registry has moved on from. */
const CHEAP = new Set(["free", "low"]);

/* The roles a connected source plays, one entry per source that has
   authored role copy. `grades` is the claim that this source can serve
   as an answer key, which is only true when it is not the same channel
   the estimate came out of. A source connected without an entry here
   renders honestly as "no role written yet" rather than being given one
   it has not earned. */
const ROLES = {
  web_search: { grades: false },
  sec_edgar: { grades: true },
};

const CHEV_SVG = `<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.5 5 7l3-3.5" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/* ============================== copy ================================ */
/* Genuinely new to this page. Everything else (rules.*, src.covTitle,
   src.lede, tier.*, cov.*, dim.timing, action.save, common.notSaved, ...)
   already exists in i18n.js and is reused as-is. */

export const keys = {
  "src.headerMeta": {
    en: "{connected} of {total} connected · {free} free and unwired · {regions} regions",
    es: "{connected} de {total} conectadas · {free} gratis y sin conectar · {regions} regiones",
  },
  "src.note2": {
    en: "{connected} of {total} sources are connected. The rest are the upgrade path, and the trust layer above them does not change when they are added.",
    es: "{connected} de {total} fuentes están conectadas. El resto es la ruta de mejora, y la capa de confianza encima de ellas no cambia cuando se agregan.",
  },
  "src.status.available": { en: "Available", es: "Disponible" },
  "src.colRegion":   { en: "Region", es: "Región" },
  "src.colSource":   { en: "Source", es: "Fuente" },
  "src.colKind":     { en: "Kind", es: "Tipo" },
  "src.colCost":     { en: "Cost", es: "Costo" },
  "src.colCoverage": { en: "By region", es: "Por región" },
  "src.kind.evidence":  { en: "Evidence", es: "Evidencia" },
  "src.kind.volume":    { en: "Volume", es: "Volumen" },
  "src.kind.footprint": { en: "Footprint", es: "Huella" },
  "src.kind.truth":     { en: "Truth", es: "Verdad" },
  "src.cost.included":   { en: "Included", es: "Incluido" },
  "src.cost.free":       { en: "Free", es: "Gratis" },
  "src.cost.low":        { en: "Low cost", es: "Costo bajo" },
  "src.cost.paid":       { en: "Paid", es: "Pago" },
  "src.cost.enterprise": { en: "Enterprise", es: "Empresarial" },
  "src.cost.owned":      { en: "Already yours", es: "Ya es tuyo" },
  "src.region.NORTHAMERICA": { en: "North America", es: "Norteamérica" },
  "src.region.EUROPE":       { en: "Europe", es: "Europa" },
  "src.region.APAC":         { en: "APAC", es: "APAC" },
  "src.region.LATAM":        { en: "LATAM", es: "LATAM" },
  "src.region.AMEA":         { en: "AMEA", es: "AMEA" },
  "src.rowDetailsAria": { en: "Source details", es: "Detalles de la fuente" },
  "src.seeMap": { en: "See it as a map", es: "Verlo como mapa" },
  "src.enOnlyNote": {
    en: "Source and rule descriptions on this page are authored in English.",
    es: "Las descripciones de fuentes y reglas en esta página están escritas en inglés.",
  },

  /* ---- what is connected, and what each one is for ---- */
  "src.connLabel": { en: "Connected today", es: "Conectadas hoy" },
  "src.connTitle": {
    en: "What is connected, and what each one is for",
    es: "Qué está conectado y para qué sirve cada una",
  },
  "src.connSub": {
    en: "one finds what is public, the other is fetched straight from the regulator and read in code. The second does a second job as well, because an answer key has to come from somewhere the tool does not already depend on",
    es: "una encuentra lo que es público, la otra se trae directo del regulador y se lee en código. La segunda hace además un segundo trabajo, porque la clave de respuestas tiene que venir de un lugar del que la herramienta no dependa ya",
  },
  "src.colReads":      { en: "What it reads", es: "Qué lee" },
  "src.colInAssess":   { en: "In an assessment", es: "En un análisis" },
  "src.colInAccuracy": { en: "In the accuracy score", es: "En la calificación de precisión" },
  "src.gradesTool":  { en: "grades the tool", es: "califica la herramienta" },
  "src.cannotGrade": { en: "cannot grade itself", es: "no puede calificarse a sí misma" },

  "src.role.web_search.reads": {
    en: "Public pages a search index can reach: filings, investor pages, press releases.",
    es: "Páginas públicas que un índice de búsqueda alcanza: informes, páginas de inversores, notas de prensa.",
  },
  "src.role.web_search.assess": {
    en: "Finds dated events and figures wherever they were published, and returns the URL it read so every claim can be followed.",
    es: "Encuentra hechos fechados y cifras donde sea que se publicaron, y devuelve la URL que leyó para que cada afirmación se pueda seguir.",
  },
  "src.role.web_search.accuracy": {
    en: "Nothing. A search engine cannot be its own answer key, so a truth found by search grades nothing.",
    es: "Nada. Un buscador no puede ser su propia clave de respuestas, así que una verdad hallada por búsqueda no califica nada.",
  },
  "src.role.sec_edgar.reads": {
    en: "The US regulator's own filing store. The newest 10-Q, 10-K or 8-K, fetched by company identifier rather than searched for.",
    es: "El archivo de informes del propio regulador de EE. UU. El 10-Q, 10-K u 8-K más reciente, traído por identificador de empresa y no buscado.",
  },
  "src.role.sec_edgar.assess": {
    en: "Runs before any search. The filing is reduced in code to the passages that mention volume and handed to research as primary evidence, so the searches that follow go on dated events instead of hunting for a figure.",
    es: "Corre antes de cualquier búsqueda. El informe se reduce en código a los pasajes que mencionan volumen y se entrega a la investigación como evidencia primaria, así que las búsquedas siguientes van por hechos fechados en lugar de perseguir una cifra.",
  },
  "src.role.sec_edgar.accuracy": {
    en: "Ground truth is extracted from the same filings, quoted verbatim, and converted to a monthly rate in code. A person typing a figure becomes the exception.",
    es: "La verdad de referencia se extrae de esos mismos informes, se cita textual y se convierte a tasa mensual en código. Que una persona escriba la cifra pasa a ser la excepción.",
  },

  "src.independence": {
    en: "An accuracy score is worth something only if the answer key is independent of the thing being graded. The filing store is a different pipe: fetched by identifier, not searched for, so a filing is free to contradict a figure that search produced.",
    es: "Una calificación de precisión vale algo solo si la clave de respuestas es independiente de lo que se califica. El archivo de informes es otra tubería: se trae por identificador y no se busca, así que un informe puede contradecir una cifra que produjo la búsqueda.",
  },
  "src.edgarLimit": {
    en: "Order and transaction counts are not in the regulator's structured data. That was checked, not assumed. The figures sit in prose inside the filings and still have to be read, so this source hands over authoritative documents rather than a database of numbers.",
    es: "Los conteos de órdenes y transacciones no están en los datos estructurados del regulador. Eso se comprobó, no se supuso. Las cifras están en prosa dentro de los informes y todavía hay que leerlas, así que esta fuente entrega documentos autorizados y no una base de datos de números.",
  },
  "src.fallbackRole": {
    en: "Connected. No role has been written for this source yet, so the registry entry below is all this page can honestly say about it.",
    es: "Conectada. Todavía no se ha escrito su rol, así que la entrada del registro más abajo es todo lo que esta página puede afirmar con honestidad.",
  },

  /* ---- coverage comparison ---- */
  "src.nowStrong": {
    en: "{regions} already reads strong on what is connected, and it got there because a statutory filing registry is wired for it. Every other region is carried by general web search alone.",
    es: "{regions} ya lee como fuerte con lo que está conectado, y llegó ahí porque tiene conectado un registro estatutario de informes. Todas las demás regiones se sostienen solo con la búsqueda web general.",
  },

  /* ---- registry ---- */
  "src.regSub2": {
    en: "{total} sources worth wiring, {connected} of them live. Open any row for what it unlocks and where it stops.",
    es: "{total} fuentes que vale la pena conectar, {connected} de ellas vivas. Abre cualquier fila para ver qué desbloquea y dónde se queda corta.",
  },
  "src.nextUp": { en: "next up", es: "lo siguiente" },
  "src.attackOrder": {
    en: "Order of attack: {names}. Both are statutory filing registries, the same kind of source that is already connected, and that kind is the only one that lights a dark region and makes it gradeable in one move. Paid panels come after the eval harness can show they earn their price.",
    es: "Orden de ataque: {names}. Ambas son registros estatutarios de informes, el mismo tipo de fuente que ya está conectada, y ese tipo es el único que ilumina una región oscura y la vuelve calificable en un solo movimiento. Los paneles pagados vienen después, cuando el arnés de evaluación pueda demostrar que valen su precio.",
  },
  "src.attackNone": {
    en: "Everything still unwired carries a real price, so the next source is a budget decision rather than an afternoon.",
    es: "Todo lo que queda sin conectar tiene un precio real, así que la próxima fuente es una decisión de presupuesto y no una tarde de trabajo.",
  },
  "src.nameCost": { en: "{name} ({cost})", es: "{name} ({cost})" },

  /* ---- rules ---- */
  "rules.testLabel": { en: "Test a URL", es: "Probar una URL" },
  "rules.testPh": {
    en: "Paste a source URL to see which rule matches",
    es: "Pega una URL de fuente para ver qué regla coincide",
  },
  "rules.testEmpty": {
    en: "Type a URL to see which rule would match.",
    es: "Escribe una URL para ver qué regla coincidiría.",
  },
  "rules.testMatch": {
    en: "Matches the rule at order {order}: {tier}, weight {w}.",
    es: "Coincide con la regla de orden {order}: {tier}, peso {w}.",
  },
  "rules.testNoMatch": {
    en: "No rule matches. Falls through to {tier} at weight {w}.",
    es: "Ninguna regla coincide. Cae en {tier} con peso {w}.",
  },
  "rules.offLaw": {
    en: "A disabled rule stays in this table, visibly off, with Enable in its own menu. An action that removes its own reversal from the screen is the bug this table exists to make impossible.",
    es: "Una regla desactivada se queda en esta tabla, visiblemente apagada, con Activar en su propio menú. Una acción que borra de la pantalla su propia reversa es el error que esta tabla existe para volver imposible.",
  },
  "rules.patternHint": {
    en: "Matched as a case-insensitive substring of the source URL.",
    es: "Se compara como un fragmento de la URL, sin distinguir mayúsculas.",
  },
  "rules.weightHint": {
    en: "0 to 1. What this source is worth when a claim is scored.",
    es: "De 0 a 1. Cuánto vale esta fuente cuando se califica una afirmación.",
  },
  "rules.weightRange":    { en: "Weight must be between 0 and 1.", es: "El peso debe estar entre 0 y 1." },
  "rules.positionRange":  { en: "Order must be a positive number.", es: "El orden debe ser un número positivo." },
  "rules.patternRequired": {
    en: "Enter a URL fragment to match.",
    es: "Escribe un fragmento de URL para buscar coincidencias.",
  },
  "rules.dupBlock": {
    en: "A rule for this pattern already exists at order {order} ({label}). Edit that one instead, or it would never match.",
    es: "Ya existe una regla para este patrón en el orden {order} ({label}). Edita esa en su lugar, o esta nunca coincidiría.",
  },
  "rules.unknownTier": { en: "Choose a classification tier.", es: "Elige un nivel de clasificación." },
  "rules.edit":     { en: "Edit", es: "Editar" },
  "rules.fldLabel": { en: "Label shown on screen", es: "Etiqueta que se muestra" },
  "rules.fldNote":  { en: "Why this rule exists", es: "Por qué existe esta regla" },
  "rules.editTitle": { en: "Edit a classification rule", es: "Editar una regla de clasificación" },
  "rules.moveUp":   { en: "Move up", es: "Subir" },
  "rules.moveDown": { en: "Move down", es: "Bajar" },
  "rules.savedToast":     { en: "Rule saved.", es: "Regla guardada." },
  "rules.addedToast":     { en: "Rule added.", es: "Regla agregada." },
  "rules.deletedToast":   { en: "Rule deleted.", es: "Regla eliminada." },
  "rules.enabledToast":   { en: "Rule enabled.", es: "Regla activada." },
  "rules.disabledToast":  { en: "Rule disabled.", es: "Regla desactivada." },

  "action.retry": { en: "Retry", es: "Reintentar" },
};

/* ============================ SSR pieces ============================= */

function regionStrip(source) {
  const items = Object.keys(REGION_SHORT).map((r) => {
    const lvl = source.coverage?.[r] || "none";
    return `<span class="src-rs-i">${level(LEVEL_RANK[lvl] ?? 0, 3, REGION_SHORT[r])}</span>`;
  }).join("");
  return `<div class="src-rs">${items}</div>`;
}

function registryExpansion(source, t) {
  const rows = Object.keys(REGION_SHORT).map((r) => {
    const lvl = source.coverage?.[r] || "none";
    return `<div class="src-exp-row"><span class="t-data">${esc(t(REGION_KEY[r]))}</span>${level(LEVEL_RANK[lvl] ?? 0, 3, t(`cov.${lvl}`))}</div>`;
  }).join("");
  return `<div class="src-exp">
    <div><span class="t-label ink-3">${esc(t("src.unlocks"))}</span><p class="t-body">${esc(source.unlocks)}</p></div>
    <div><span class="t-label ink-3">${esc(t("src.limits"))}</span><p class="t-body">${esc(source.limits)}</p></div>
    <div><span class="t-label ink-3">${esc(t("src.covByRegion"))}</span>
      <div class="src-exp-grid">${rows}</div>
    </div>
  </div>`;
}

function registryRow(source, t, isNext) {
  const connected = source.status === "connected";
  const nameCell = `<div class="src-row-name">
    ${mark(connected ? "filled" : "hollow", connected ? t("src.connected") : t("src.status.available"), { tone: connected ? "ok" : "mute" })}
    <span class="src-row-txt">
      <b class="t-data">${esc(source.name)}${isNext ? `<span class="src-next t-label">${esc(t("src.nextUp"))}</span>` : ""}</b>
      <span class="src-what">${esc(source.what)}</span>
    </span>
  </div>`;
  const kindCell = `<span class="t-label ink-3">${esc(t(KIND_KEY[source.kind] || source.kind))}</span>`;
  const costCell = `<span class="t-data">${esc(t(COST_KEY[source.cost] || source.cost))}</span>`;
  const covCell = regionStrip(source);
  const chevCell = `<div class="chev-cell"><button type="button" class="btn-icon chev" data-action="src:expand" aria-expanded="false" aria-label="${esc(t("src.rowDetailsAria"))}">${CHEV_SVG}</button></div>`;
  return { id: source.id, cells: [nameCell, kindCell, costCell, covCell, chevCell], inset: registryExpansion(source, t) };
}

/** Two connected sources, four columns, and the second source's two
 *  distinct jobs sit side by side where the difference is legible. A
 *  source connected without authored role copy still renders, saying so,
 *  rather than printing an empty row or an English placeholder. */
function connectedRow(source, t) {
  const role = ROLES[source.id];
  const nameCell = `<div class="src-row-name">
    ${mark("filled", t("src.connected"), { tone: "ok" })}
    <span class="src-row-txt"><b class="t-data">${esc(source.name)}</b>
      <span class="src-what">${esc(t(COST_KEY[source.cost] || source.cost))}</span></span>
  </div>`;

  if (!role) {
    return {
      id: source.id,
      cells: [nameCell, `<p class="src-role-b">${esc(t("src.fallbackRole"))}</p>`, "", ""],
    };
  }

  const accuracyCell = `${mark(role.grades ? "filled" : "hatch", t(role.grades ? "src.gradesTool" : "src.cannotGrade"), { tone: role.grades ? "ok" : "held" })}
    <p class="src-role-b">${esc(t(`src.role.${source.id}.accuracy`))}</p>`;

  return {
    id: source.id,
    cells: [
      nameCell,
      `<p class="src-role-b">${esc(t(`src.role.${source.id}.reads`))}</p>`,
      `<p class="src-role-b">${esc(t(`src.role.${source.id}.assess`))}</p>`,
      accuracyCell,
    ],
  };
}

function comparisonRow(now, wired, t) {
  const nowRank = LEVEL_RANK[now.level] ?? 0;
  const wiredRank = LEVEL_RANK[wired.level] ?? 0;
  const rising = wiredRank > nowRank;
  const contributors = wired.contributors || [];
  const contribText = contributors.length
    ? esc(contributors.slice(0, 3).join(" · ")) + (contributors.length > 3 ? ` ${esc(t("src.nMore", { n: contributors.length - 3 }))}` : "")
    : esc(t("src.nothingWired"));
  return {
    id: now.region,
    cells: [
      `<span class="t-data">${esc(t(REGION_KEY[now.region] || now.region))}</span>`,
      level(nowRank, 3, t(`cov.${now.level}`)),
      `<span class="cmp-arrow${rising ? " up" : ""}" aria-hidden="true">&rarr;</span>`,
      mark("dashed", t(`cov.${wired.level}`), { tone: "mute" }),
      `<span class="t-data ink-3">${contribText}</span>`,
    ],
  };
}

function loadingRows() {
  return Array.from({ length: 5 }).map(() => `<div class="ph-row"></div>`).join("");
}

function ruleDialogBody(t) {
  return `
    ${field({ id: "rd-pattern", label: t("rules.pattern"), placeholder: t("rules.phPattern"), hint: t("rules.patternHint"), mono: true })}
    ${field({ id: "rd-tier", label: t("rules.tier"), options: [
      { value: "primary_filing", label: t("tier.primaryStrong") },
      { value: "self_published", label: t("tier.self") },
      { value: "documentation", label: t("tier.doc") },
      { value: "third_party", label: t("tier.third") },
    ] })}
    ${field({ id: "rd-label", label: t("rules.fldLabel"), placeholder: t("rules.phLabel") })}
    ${field({ id: "rd-weight", label: t("rules.weight"), type: "number", value: "0.8", step: "0.05", min: "0", max: "1", hint: t("rules.weightHint"), mono: true })}
    ${field({ id: "rd-position", label: t("rules.order"), type: "number", value: "500", step: "1", min: "1", hint: t("rules.dlgHint"), mono: true })}
    ${field({ id: "rd-note", label: t("rules.fldNote"), placeholder: t("rules.phNote") })}
  `;
}

/* ============================== render =============================== */

export async function render(env, data, ctx) {
  const { t, lang } = ctx;
  const all = data.sources || [];
  const regions = data.regions || Object.keys(REGION_SHORT);

  const connected = all.filter((s) => s.status === "connected");
  /* The obvious next work, derived rather than named: unwired sources
     that produce volume evidence and cost little or nothing. */
  const nextUp = all.filter((s) => s.status !== "connected" && s.kind === "volume" && CHEAP.has(s.cost));
  const nextIds = new Set(nextUp.map((s) => s.id));

  const headerMeta = t("src.headerMeta", {
    connected: data.connected, total: data.total, free: data.free_and_unwired, regions: regions.length,
  });

  const cmpRows = (data.coverage_now || []).map((now, i) => comparisonRow(now, data.coverage_wired[i], t));
  const registryRows = all.map((s) => registryRow(s, t, nextIds.has(s.id)));

  const enNote = lang === "es" ? `<p class="claim-en t-data ink-4">${esc(t("src.enOnlyNote"))}</p>` : "";

  /* ---- what is connected, and what each one is for ---- */
  const connectedSection = section({
    label: t("src.connLabel"),
    title: t("src.connTitle"),
    sub: esc(t("src.connSub")),
    body: `
      ${table({
        cols: [
          { key: "source", label: t("src.colSource"), width: 220 },
          { key: "reads", label: t("src.colReads") },
          { key: "assess", label: t("src.colInAssess") },
          { key: "accuracy", label: t("src.colInAccuracy") },
        ],
        rows: connected.map((s) => connectedRow(s, t)),
        size: "tall",
      }, t)}
      <p class="src-arg t-body">${esc(t("src.independence"))}</p>
      <p class="foot t-data ink-3">${esc(t("src.edgarLimit"))}</p>
    `,
  });

  /* ---- coverage now against wired ---- */
  // Only claim the filing-registry causation where it is true by
  // construction: the region reads strong today AND a connected source
  // that produces volume evidence rates strong there.
  const strongNow = (data.coverage_now || [])
    .filter((c) => c.level === "strong" &&
      connected.some((s) => s.kind === "volume" && s.coverage?.[c.region] === "strong"))
    .map((c) => t(REGION_KEY[c.region] || c.region));
  const strongLine = strongNow.length
    ? `<p class="src-arg t-body">${esc(t("src.nowStrong", { regions: strongNow.join(", ") }))}</p>`
    : "";

  const comparisonSection = section({
    label: t("src.eyebrow"),
    title: t("src.covTitle"),
    sub: esc(t("src.covSub")),
    body: `
      ${table({
        cols: [
          { key: "region", label: t("src.colRegion") },
          { key: "now", label: t("src.now") },
          { key: "arrow", label: "" },
          { key: "wired", label: t("src.wired") },
          { key: "lifts", label: t("src.whoLifts") },
        ],
        rows: cmpRows,
      }, t)}
      ${strongLine}
      <p class="foot t-data ink-3">${esc(t("src.covFoot"))}</p>
    `,
  });

  /* ---- the registry ---- */
  const attackNames = nextUp
    .map((s) => t("src.nameCost", { name: s.name, cost: t(COST_KEY[s.cost] || s.cost).toLowerCase() }))
    .join(", ");
  const attackLine = nextUp.length
    ? t("src.attackOrder", { names: attackNames })
    : t("src.attackNone");

  const registrySection = section({
    title: t("src.regTitle"),
    sub: esc(t("src.regSub2", { total: data.total, connected: data.connected })),
    body: `
      ${table({
        cols: [
          { key: "source", label: t("src.colSource") },
          { key: "kind", label: t("src.colKind"), width: 120 },
          { key: "cost", label: t("src.colCost"), width: 100 },
          { key: "cov", label: t("src.colCoverage"), width: 320 },
          { key: "chev", label: "", width: 36 },
        ],
        rows: registryRows,
        size: "tall",
      }, t)}
      <p class="foot t-body">${esc(attackLine)}</p>
    `,
  });

  /* ---- classification rules ---- */
  const rulesSection = section({
    title: t("rules.title"),
    sub: esc(t("rules.sub")),
    actions: `
      <input type="text" id="rule-test-url" class="input mono" placeholder="${esc(t("rules.testPh"))}" aria-label="${esc(t("rules.testLabel"))}" disabled>
      ${btn(t("rules.add"), { kind: "primary", id: "rule-add-btn" })}
    `,
    body: `
      <p class="t-data ink-3" id="rule-test-result">${esc(t("rules.testEmpty"))}</p>
      <div id="rules-slot">${loadingRows()}</div>
      <p class="foot t-data ink-3">${esc(t("rules.offLaw"))}</p>
    `,
  });

  return `
    <div class="whead">
      <div class="whead-t">
        <h1 class="t-title">${esc(t("nav.sources"))}</h1>
        <span class="whead-meta">${esc(headerMeta)}</span>
      </div>
      <div class="whead-a">${btn(t("src.seeMap"), { kind: "quiet", href: "/coverage" })}</div>
    </div>
    <p class="claim t-body">${esc(t("src.note2", { connected: data.connected, total: data.total }))} ${t("src.lede")}</p>
    <p class="claim-sub t-data ink-2">${esc(t("verdict.abstainNote"))}</p>
    ${enNote}

    ${connectedSection}
    ${comparisonSection}
    ${registrySection}
    ${rulesSection}

    ${dialog({ id: "rule-dlg", title: t("rules.dlgTitle"), body: ruleDialogBody(t), confirm: t("action.save") }, t)}
  `;
}

/* =============================== css ================================== */

export function css() {
  return `
.p-sources .claim { max-width: 72ch; margin-top: 16px; }
.p-sources .claim-sub { max-width: 72ch; margin-top: 8px; }
.p-sources .claim-en { max-width: 72ch; margin-top: 8px; }
.p-sources .foot { max-width: 78ch; margin-top: 12px; }
.p-sources .src-arg { max-width: 78ch; margin-top: 16px; color: var(--ink-2); }
.p-sources .see-map { margin-top: 8px; }

.p-sources .cmp-arrow { color: var(--ink-4); font-size: 14px; }
.p-sources .cmp-arrow.up { color: var(--accent); }

.p-sources .src-rs { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; }
.p-sources .src-rs-i .mk-w { font-size: 11px; }

.p-sources .src-row-name { display: flex; align-items: flex-start; gap: 8px; }
.p-sources .src-row-name .mk { margin-top: 3px; }
.p-sources .src-row-txt { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.p-sources .src-row-txt b { font-weight: 500; }
.p-sources .src-what {
  display: block; color: var(--ink-3); font-size: 12px; line-height: 1.4;
  max-width: 46ch;
}
/* the order-of-attack tag: a word, not a colour */
.p-sources .src-next { color: var(--ink-3); margin-left: 8px; white-space: nowrap; }

/* connected roles: prose cells, so the row grows with the copy and
   Spanish is not clipped */
.p-sources .src-role-b {
  font: 400 13px/1.5 var(--sans); color: var(--ink-2);
  max-width: 44ch; white-space: normal; margin: 0;
}
.p-sources .src-role-b + .src-role-b { margin-top: 6px; }
.p-sources td .mk + .src-role-b { margin-top: 4px; }

.p-sources .chev-cell { display: flex; justify-content: flex-end; }
.p-sources .chev svg { transition: transform .18s var(--ease); }
.p-sources .chev[aria-expanded="true"] svg { transform: rotate(180deg); }

.p-sources .src-exp { display: grid; grid-template-columns: 1fr 1fr 1.2fr; gap: 24px; }
.p-sources .src-exp p { margin-top: 4px; }
.p-sources .src-exp-grid { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; }
.p-sources .src-exp-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }

.p-sources .rule-tier { display: flex; flex-direction: column; gap: 3px; }

.p-sources #rule-test-url { width: 320px; max-width: 40vw; }
.p-sources #rule-test-result { margin-top: 0; min-height: 1.45em; }

@media (max-width: 900px) {
  .p-sources .src-exp { grid-template-columns: 1fr; }
  .p-sources #rule-test-url { width: 180px; }
}
`;
}

/* =============================== script ================================ */

export function script() {
  return `(() => {
  "use strict";

  var RULES = [];
  var TOTAL = 0;
  var UNMATCHED = 0;
  var FALLBACK_W = 0.35;
  var editingId = null;

  /* ---- hand-built equivalents of kit.js primitives, plain JS, no
     imports. A plain inline <script> cannot import an ES module, and
     this region is client-fetched by design (DESIGN-SPEC §3.10), so its
     markup is built here to match kit.js's classes exactly. ---- */

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/\\s*[\\u2014\\u2015]\\s*/g, ", ")
      .replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
  }
  function fmtNum(n) {
    return (n == null || isNaN(Number(n))) ? "" : Number(n).toLocaleString("en-US");
  }
  var MARK_SVG = {
    filled: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="currentColor"/></svg>',
    hollow: '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="3.4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>',
  };
  function mk(kind, label, tone) {
    return '<span class="mk tone-' + (tone || "ink") + '">' + (MARK_SVG[kind] || "") + '<span class="mk-w">' + esc(label) + "</span></span>";
  }
  var DOTS_SVG = '<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><circle cx="2.5" cy="7" r="1.3"/><circle cx="7" cy="7" r="1.3"/><circle cx="11.5" cy="7" r="1.3"/></svg>';

  function ruleMenuHtml(items) {
    var rows = items.map(function (it) {
      if (it === "-") return '<div class="menu-sep" role="separator"></div>';
      var danger = it.danger ? " danger" : "";
      return '<button type="button" class="menu-item' + danger + '" role="menuitem" data-action="' + esc(it.action || "") + '"' + (it.danger ? ' data-danger="1"' : "") + '>' + esc(it.label) + "</button>";
    }).join("");
    return '<div class="menu-host"><button type="button" class="btn-icon menu-btn" aria-haspopup="menu" aria-expanded="false" aria-label="' + esc(Floor.t("kit.menu.aria")) + '">' + DOTS_SVG + '</button><div class="menu" role="menu" hidden>' + rows + "</div></div>";
  }

  function ruleTableHead() {
    return "<tr>" +
      '<th class="num" style="width:56px">' + esc(Floor.t("rules.order")) + "</th>" +
      "<th>" + esc(Floor.t("rules.pattern")) + "</th>" +
      "<th>" + esc(Floor.t("rules.tier")) + "</th>" +
      '<th class="num" style="width:72px">' + esc(Floor.t("rules.weight")) + "</th>" +
      '<th class="num" style="width:96px">' + esc(Floor.t("rules.matches")) + "</th>" +
      "<th>" + esc(Floor.t("rules.why")) + "</th>" +
      '<th class="col-menu"></th>' +
    "</tr>";
  }

  /* A disabled rule keeps its row, its order, its pattern and its menu.
     It is dimmed and marked off, and the one thing its menu offers first
     is Enable. Nothing here may ever hide a rule that is off: that is
     how a rule once took its own undo off the screen with it. */
  function ruleRowHtml(r, idx, total) {
    var dim = !r.enabled;
    var tierLabel = r.label || r.tier;
    var tierCell = '<div class="rule-tier"><span class="t-data">' + esc(tierLabel) + "</span>" + (dim ? mk("hollow", Floor.t("rules.off"), "mute") : "") + "</div>";
    var matches = r.enabled ? fmtNum(r.matches || 0) : "\\u2013";
    var items = [];
    items.push({ label: r.enabled ? Floor.t("rules.disable") : Floor.t("rules.enable"), action: "rule:toggle" });
    items.push({ label: Floor.t("rules.edit"), action: "rule:edit" });
    if (idx > 0) items.push({ label: Floor.t("rules.moveUp"), action: "rule:moveup" });
    if (idx < total - 1) items.push({ label: Floor.t("rules.moveDown"), action: "rule:movedown" });
    if (!r.builtin) { items.push("-"); items.push({ label: Floor.t("rules.delete"), action: "rule:delete", danger: true }); }
    var cls = dim ? ' class="row-dim"' : "";
    return '<tr data-id="' + esc(r.id) + '"' + cls + ">" +
      '<td class="num mono">' + esc(r.position) + "</td>" +
      '<td class="mono">' + esc(r.pattern) + "</td>" +
      "<td>" + tierCell + "</td>" +
      '<td class="num mono">' + esc(Number(r.weight).toFixed(2)) + "</td>" +
      '<td class="num mono">' + matches + "</td>" +
      '<td class="ink-3">' + esc(r.note || "") + "</td>" +
      '<td class="col-menu">' + ruleMenuHtml(items) + "</td>" +
    "</tr>";
  }

  function sortedRules() {
    return RULES.slice().sort(function (a, b) { return a.position - b.position || a.id - b.id; });
  }

  function renderRulesSlot() {
    var sorted = sortedRules();
    var bodyHtml = sorted.length
      ? sorted.map(function (r, i) { return ruleRowHtml(r, i, sorted.length); }).join("")
      : '<tr><td colspan="7" style="height:auto;border-bottom:0;padding:16px 0"><div class="f-empty"><p>' + esc(Floor.t("rules.empty")) + "</p></div></td></tr>";
    var footText = Floor.t("rules.footA", { total: TOTAL, unmatched: UNMATCHED, w: FALLBACK_W }) + " " + (UNMATCHED ? Floor.t("rules.footB") : Floor.t("rules.footC"));
    return '<div id="rules-slot">' +
      '<div class="tbl-wrap"><table class="tbl tbl-dense"><thead>' + ruleTableHead() + "</thead><tbody>" + bodyHtml + "</tbody></table></div>" +
      '<p class="foot t-data ink-3">' + footText + "</p>" +
    "</div>";
  }

  function paintRules() {
    Floor.replace("#rules-slot", renderRulesSlot());
  }

  function fetchRules() {
    fetch("/api/source-rules").then(function (r) { return r.json(); }).then(function (d) {
      RULES = d.rules || [];
      TOTAL = d.total || 0;
      UNMATCHED = d.unmatched || 0;
      FALLBACK_W = d.fallback_weight != null ? d.fallback_weight : 0.35;
      var testInput = document.getElementById("rule-test-url");
      if (testInput) testInput.disabled = false;
      paintRules();
    }).catch(function () {
      var slot = document.getElementById("rules-slot");
      if (slot) slot.innerHTML =
        '<p class="f-error">' + esc(Floor.t("rules.loadFail")) +
        ' <button type="button" class="btn btn-text" id="rules-retry">' + esc(Floor.t("action.retry")) + "</button></p>";
    });
  }
  document.addEventListener("click", function (e) {
    if (e.target && e.target.id === "rules-retry") fetchRules();
  });

  /* ---- field errors, plain DOM, matches .fld / .fld-err from floor.css ---- */

  function setFieldError(id, msg) {
    var ctrl = document.getElementById(id);
    if (!ctrl) return;
    var wrap = ctrl.closest(".fld");
    if (!wrap) return;
    var err = wrap.querySelector(".fld-err");
    if (!msg) {
      if (err) err.remove();
      ctrl.removeAttribute("aria-invalid");
      return;
    }
    if (!err) {
      err = document.createElement("p");
      err.className = "fld-err";
      wrap.appendChild(err);
    }
    err.textContent = msg;
    ctrl.setAttribute("aria-invalid", "true");
  }
  function clearRuleFormErrors() {
    ["rd-pattern", "rd-weight", "rd-position"].forEach(function (id) { setFieldError(id, null); });
  }

  /* ---- add / edit dialog ---- */

  var ruleDlg = document.getElementById("rule-dlg");

  function nextPosition() {
    if (!RULES.length) return 500;
    var max = RULES.reduce(function (a, r) { return Math.max(a, r.position); }, 0);
    return max + 10;
  }

  function openRuleDialog(rule) {
    if (!ruleDlg) return;
    clearRuleFormErrors();
    editingId = rule ? rule.id : null;
    var titleEl = document.getElementById("rule-dlg-t");
    if (titleEl) titleEl.textContent = rule ? Floor.t("rules.editTitle") : Floor.t("rules.dlgTitle");
    document.getElementById("rd-pattern").value = rule ? rule.pattern : "";
    document.getElementById("rd-tier").value = rule ? rule.tier : "primary_filing";
    document.getElementById("rd-label").value = rule ? (rule.label || "") : "";
    document.getElementById("rd-weight").value = rule ? rule.weight : 0.8;
    document.getElementById("rd-position").value = rule ? rule.position : nextPosition();
    document.getElementById("rd-note").value = rule ? (rule.note || "") : "";
    ruleDlg.showModal();
  }

  var addBtn = document.getElementById("rule-add-btn");
  if (addBtn) addBtn.addEventListener("click", function () { openRuleDialog(null); });

  function findDuplicate(pattern, excludeId) {
    var p = pattern.trim().toLowerCase();
    return RULES.find(function (r) { return r.id !== excludeId && String(r.pattern).toLowerCase() === p; });
  }

  function validateAndCollect() {
    var pattern = document.getElementById("rd-pattern").value.trim();
    var tier = document.getElementById("rd-tier").value;
    var label = document.getElementById("rd-label").value.trim();
    var weight = Number(document.getElementById("rd-weight").value);
    var position = Number(document.getElementById("rd-position").value);
    var note = document.getElementById("rd-note").value.trim();
    var ok = true;
    clearRuleFormErrors();
    if (!pattern) { setFieldError("rd-pattern", Floor.t("rules.patternRequired")); ok = false; }
    else {
      var dup = findDuplicate(pattern, editingId);
      if (dup) { setFieldError("rd-pattern", Floor.t("rules.dupBlock", { order: dup.position, label: dup.label })); ok = false; }
    }
    if (isNaN(weight) || weight < 0 || weight > 1) { setFieldError("rd-weight", Floor.t("rules.weightRange")); ok = false; }
    if (isNaN(position) || position < 1) { setFieldError("rd-position", Floor.t("rules.positionRange")); ok = false; }
    if (!ok) return null;
    return { pattern: pattern, tier: tier, label: label || undefined, weight: weight, position: position, note: note || undefined };
  }

  function friendlyRuleError(msg) {
    if (msg === "pattern_and_tier_required") return Floor.t("rules.patternRequired");
    if (msg === "unknown_tier") return Floor.t("rules.unknownTier");
    return msg;
  }

  function applyRulesPayload(d) {
    RULES = d.rules || RULES;
    if (d.total != null) TOTAL = d.total;
    if (d.unmatched != null) UNMATCHED = d.unmatched;
    if (d.fallback_weight != null) FALLBACK_W = d.fallback_weight;
  }

  var ruleForm = ruleDlg ? ruleDlg.querySelector("form") : null;
  if (ruleForm) {
    ruleForm.addEventListener("submit", function (e) {
      var submitter = e.submitter;
      if (!submitter || submitter.value !== "confirm") return;
      e.preventDefault();
      var payload = validateAndCollect();
      if (!payload) return;
      var wasEdit = editingId != null;
      if (wasEdit) payload.id = editingId;
      Floor.post("/api/source-rules", payload).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        ruleDlg.close();
        editingId = null;
        Floor.toast(wasEdit ? Floor.t("rules.savedToast") : Floor.t("rules.addedToast"));
      }).catch(function (err) {
        setFieldError("rd-pattern", friendlyRuleError((err && err.message) || Floor.t("rules.loadFail")));
      });
    });
  }

  /* ---- row menu / expand actions, dispatched by floor.js as floor:action ---- */

  document.addEventListener("floor:action", function (e) {
    var detail = e.detail || {};
    var action = detail.action;

    if (action === "src:expand") {
      var elBtn = detail.el;
      var tr = elBtn && elBtn.closest("tr");
      var next = tr && tr.nextElementSibling;
      if (next && next.classList.contains("tbl-inset")) {
        var willOpen = next.hidden;
        next.hidden = !willOpen;
        elBtn.setAttribute("aria-expanded", String(willOpen));
      }
      return;
    }

    if (!action || action.indexOf("rule:") !== 0) return;
    var id = detail.id != null ? Number(detail.id) : null;
    var rule = RULES.find(function (r) { return r.id === id; });

    if (action === "rule:edit") {
      if (rule) openRuleDialog(rule);
      return;
    }

    if (action === "rule:toggle") {
      if (!rule) return;
      var wasEnabled = rule.enabled;
      Floor.post("/api/source-rules", { toggle_id: id }).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        Floor.toast(wasEnabled ? Floor.t("rules.disabledToast") : Floor.t("rules.enabledToast"), {
          undo: function () {
            Floor.post("/api/source-rules", { toggle_id: id }).then(function (d2) { applyRulesPayload(d2); paintRules(); });
          },
        });
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "rule:delete") {
      if (!rule) return;
      var snap = rule;
      Floor.post("/api/source-rules", { delete_id: id }).then(function (d) {
        applyRulesPayload(d);
        paintRules();
        Floor.toast(Floor.t("rules.deletedToast"), {
          undo: function () {
            Floor.post("/api/source-rules", {
              pattern: snap.pattern, tier: snap.tier, label: snap.label,
              weight: snap.weight, position: snap.position, note: snap.note,
            }).then(function (d2) { applyRulesPayload(d2); paintRules(); });
          },
        });
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }

    if (action === "rule:moveup" || action === "rule:movedown") {
      var sorted = sortedRules();
      var idx = sorted.findIndex(function (r) { return r.id === id; });
      var swapWith = action === "rule:moveup" ? idx - 1 : idx + 1;
      if (idx < 0 || swapWith < 0 || swapWith >= sorted.length) return;
      var tmp = sorted[idx]; sorted[idx] = sorted[swapWith]; sorted[swapWith] = tmp;
      var ids = sorted.map(function (r) { return r.id; });
      Floor.post("/api/source-rules/reorder", { ids: ids }).then(function (d) {
        var order = d.order || [];
        order.forEach(function (o) {
          var r = RULES.find(function (rr) { return rr.id === o.id; });
          if (r) r.position = o.position;
        });
        paintRules();
      }).catch(function (err) { Floor.toast(Floor.t("common.notSaved", { err: err.message })); });
      return;
    }
  });

  /* ---- the rule tester: pure client replica of the server's first-match-wins
     substring classifier (src/lib/sources.js classifySource). Read-only. ---- */

  function classifyClient(url) {
    if (!url) return null;
    var u = url.toLowerCase();
    var active = RULES.filter(function (r) { return r.enabled; }).sort(function (a, b) { return a.position - b.position; });
    for (var i = 0; i < active.length; i++) {
      if (u.indexOf(String(active[i].pattern).toLowerCase()) !== -1) return active[i];
    }
    return null;
  }

  var testInput = document.getElementById("rule-test-url");
  var testResult = document.getElementById("rule-test-result");
  if (testInput && testResult) {
    testInput.addEventListener("input", function () {
      var v = testInput.value.trim();
      if (!v) { testResult.textContent = Floor.t("rules.testEmpty"); return; }
      var match = classifyClient(v);
      testResult.textContent = match
        ? Floor.t("rules.testMatch", { order: match.position, tier: match.label || match.tier, w: Number(match.weight).toFixed(2) })
        : Floor.t("rules.testNoMatch", { tier: Floor.t("tier.unclassified"), w: FALLBACK_W });
    });
  }

  fetchRules();
})();`;
}
