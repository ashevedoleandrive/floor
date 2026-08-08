/**
 * Bilingual interface.
 *
 * The copy is authored in both languages, not run through a translator. Floor's
 * copy does persuasive work ("A number here would be fiction, so none was
 * issued"), and a literal rendering of that reads like a manual.
 *
 * Scope is deliberately the interface only. Making the models research and
 * reason natively in Spanish would be the complete version, and it is the more
 * honest one, but it costs roughly 5 to 8 percent more per run. That half was
 * cut rather than shipped switched off, because dead config is worse than an
 * absent feature. Evidence therefore renders in the language it was reasoned
 * in, which today is always English, and the UI does not pretend otherwise.
 */

export const LANGS = ["en", "es"];
export const DEFAULT_LANG = "en";

/** Cookie first (an explicit choice), then Accept-Language, then English. */
export function pickLang(request) {
  const cookie = request.headers.get("cookie") || "";
  const m = cookie.match(/(?:^|;\s*)floor_lang=(en|es)\b/);
  if (m) return m[1];

  const url = new URL(request.url);
  const q = url.searchParams.get("lang");
  if (LANGS.includes(q)) return q;

  const al = (request.headers.get("accept-language") || "").toLowerCase();
  if (/^es\b|[,\s]es[-;,]/.test(al)) return "es";
  return DEFAULT_LANG;
}

export function langCookie(lang) {
  return `floor_lang=${LANGS.includes(lang) ? lang : DEFAULT_LANG}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/*
 * Note: the pipeline deliberately does NOT take a language.
 *
 * Making the models research and reason in Spanish natively would be the
 * complete version of bilingual, but it costs roughly 5 to 8 percent more per
 * run and nothing about the demo needs it. The interface toggle below is free,
 * so it stays; the paid half was cut rather than left switched off, because
 * dead config is worse than an absent feature.
 */

/**
 * Interface copy.
 *
 * Keys are grouped by surface. Adding a key without both languages is a bug,
 * and `missingKeys()` below exists so that bug is visible rather than silent.
 */
export const COPY = {
  // ---- chrome -----------------------------------------------------------
  "nav.queue":     { en: "Queue",     es: "Cola" },
  "nav.sources":   { en: "Sources",   es: "Fuentes" },
  "nav.accuracy":  { en: "Accuracy",  es: "Precisión" },
  "nav.impact":    { en: "Impact",    es: "Impacto" },
  "nav.backlog":   { en: "Backlog",   es: "Backlog" },
  "nav.dayone":    { en: "Day one",   es: "Día uno" },
  "chrome.tagline":{ en: "account prioritisation · Yuno SDR", es: "priorización de cuentas · Yuno SDR" },
  "chrome.live":   { en: "Live",      es: "En vivo" },
  "chrome.cached": { en: "Cached",    es: "En caché" },
  "chrome.leftToday": { en: "left today", es: "disponible hoy" },
  "chrome.capReached": {
    en: "Daily spend cap reached.",
    es: "Se alcanzó el tope de gasto diario.",
  },
  "chrome.capBody": {
    en: "Every figure below is a real stored assessment, just not a fresh one. Live runs resume tomorrow; browsing, filtering and export all still work.",
    es: "Cada cifra aquí abajo es un análisis real ya almacenado, solo que no reciente. Los análisis en vivo se reanudan mañana; navegar, filtrar y exportar siguen funcionando.",
  },

  // ---- queue ------------------------------------------------------------
  "queue.eyebrow": { en: "The queue is the product", es: "La cola es el producto" },
  "queue.title":   { en: "Which accounts, and when.", es: "Qué cuentas, y cuándo." },
  "queue.lede": {
    en: "A finite enterprise TAM ranked on three things: whether the merchant clears <b>100k transactions a month</b>, whether something dated makes it worth touching now, and whether it was hit too recently to touch again. Click any row for the layer beneath it.",
    es: "Un universo finito de cuentas enterprise ordenado por tres cosas: si el comercio supera las <b>100 mil transacciones al mes</b>, si hay algo con fecha que justifique contactarlo ahora, y si se tocó hace demasiado poco como para volver a tocarlo. Haz clic en cualquier fila para ver la capa que hay debajo.",
  },
  "queue.workNow":   { en: "Work now",     es: "Trabajar ahora" },
  "queue.assessed":  { en: "Assessed",     es: "Analizadas" },
  "queue.abstained": { en: "Abstained",    es: "Sin estimación" },
  "queue.costPer":   { en: "Cost / account", es: "Costo / cuenta" },
  "queue.ofAccounts":{ en: "of {n} accounts", es: "de {n} cuentas" },
  "queue.withCited": { en: "with cited evidence", es: "con evidencia citada" },
  "queue.refused":   { en: "refused to guess", es: "se negó a adivinar" },
  "queue.measured":  { en: "measured, not estimated", es: "medido, no estimado" },

  "band.work":       { en: "Work now",      es: "Trabajar ahora" },
  "band.soon":       { en: "Queue next",    es: "Siguen en la cola" },
  "band.abstained":  { en: "Abstained",     es: "Sin estimación" },
  "band.suppressed": { en: "Cooling down",  es: "En enfriamiento" },
  "band.below":      { en: "Below floor",   es: "Bajo el umbral" },
  "band.unscored":   { en: "Not assessed",  es: "Sin analizar" },

  "rule.work": {
    en: "Clears the {floor} floor, out of cool-down, dated reason to touch. This is the week's work.",
    es: "Supera el umbral de {floor}, fuera de enfriamiento, y hay una razón con fecha para contactar. Esto es el trabajo de la semana.",
  },
  "rule.soon": {
    en: "Real fit, weaker timing or thinner confidence. Next in line when capacity frees up.",
    es: "Encaja de verdad, pero el momento es más débil o la confianza más delgada. Siguen cuando se libere capacidad.",
  },
  "rule.abstained": {
    en: "The pipeline abstained rather than guess. A number here would be fiction, so none was issued.",
    es: "El sistema prefirió no estimar antes que adivinar. Un número aquí sería ficción, así que no se emitió ninguno.",
  },
  "rule.suppressed": {
    en: "Touched inside the {days}-day window. The TAM is finite; re-hitting burns it.",
    es: "Contactadas dentro de la ventana de {days} días. El universo es finito; insistir lo quema.",
  },
  "rule.below": {
    en: "Under the qualification floor. Not winnable, so not workable.",
    es: "Por debajo del umbral de calificación. No se pueden ganar, así que no se trabajan.",
  },
  "rule.unscored": {
    en: "Never assessed. A run is three model calls and every claim is refuted before it is trusted.",
    es: "Nunca analizadas. Un análisis son tres llamadas al modelo y cada afirmación se intenta refutar antes de darla por buena.",
  },

  "col.account":  { en: "Account",   es: "Cuenta" },
  "col.estTxn":   { en: "Est. txn / mo", es: "Trx / mes est." },
  "col.conf":     { en: "Conf.",     es: "Conf." },
  "col.timing":   { en: "Timing",    es: "Momento" },
  "col.cooldown": { en: "Cool-down", es: "Enfriamiento" },
  "col.score":    { en: "Score",     es: "Puntaje" },
  "col.why":      { en: "Why it sits here", es: "Por qué está aquí" },

  "cool.held":         { en: "held until {date}", es: "retenida hasta {date}" },
  "cool.neverTouched": { en: "never touched", es: "nunca contactada" },
  "cool.eligible":     { en: "eligible", es: "disponible" },
  "queue.noTrigger":   { en: "no dated trigger", es: "sin señal con fecha" },
  "queue.abstainedShort": { en: "abstained, no estimate", es: "sin estimación" },
  "queue.notAssessed": { en: "not assessed", es: "sin analizar" },

  "action.assess":   { en: "Run assessment", es: "Analizar" },
  "action.export":   { en: "Export, Salesforce shape", es: "Exportar, formato Salesforce" },
  "action.addAccounts": { en: "Add accounts", es: "Agregar cuentas" },
  "action.filter":   { en: "Filter by name or domain", es: "Filtrar por nombre o dominio" },
  "action.all":      { en: "All", es: "Todas" },
  "field.assessOne": { en: "Assess a merchant", es: "Analizar un comercio" },
  "field.lastTouched": { en: "Last touched, optional", es: "Último contacto, opcional" },
  "field.cooldownDays": { en: "Cool-down", es: "Enfriamiento" },
  "field.days":      { en: "days", es: "días" },

  // ---- run stages -------------------------------------------------------
  "stage.research": { en: "Research", es: "Investigación" },
  "stage.extract":  { en: "Extract",  es: "Extracción" },
  "stage.critic":   { en: "Critic",   es: "Crítico" },
  "stage.score":    { en: "Score",    es: "Puntaje" },
  "stage.research.blurb": {
    en: "searching public sources, keeping the URLs it reads",
    es: "busca en fuentes públicas y guarda las URLs que lee",
  },
  "stage.extract.blurb": {
    en: "turning prose into typed, cited claims",
    es: "convierte el texto en afirmaciones tipadas y citadas",
  },
  "stage.critic.blurb": {
    en: "adversarial pass, trying to refute every claim",
    es: "pasada adversarial, intenta refutar cada afirmación",
  },
  "stage.score.blurb": {
    en: "deterministic arithmetic, no model",
    es: "aritmética determinista, sin modelo",
  },

  // ---- verdicts ---------------------------------------------------------
  "verdict.clears":     { en: "Clears the floor", es: "Supera el umbral" },
  "verdict.borderline": { en: "Straddles the floor", es: "Queda sobre el umbral" },
  "verdict.below":      { en: "Below the floor", es: "Bajo el umbral" },
  "verdict.abstained":  { en: "Abstained", es: "Sin estimación" },
  "verdict.noEstimate": { en: "No estimate issued", es: "No se emitió estimación" },
  "verdict.abstainNote": {
    en: "This is a designed outcome, not a failure. A confident wrong number is the one thing that would make this tool unusable, so the pipeline refuses to guess when the evidence will not carry an estimate.",
    es: "Este resultado es intencional, no una falla. Un número equivocado dicho con seguridad es lo único que volvería inservible esta herramienta, así que el sistema se niega a adivinar cuando la evidencia no sostiene una estimación.",
  },

  // ---- evidence ---------------------------------------------------------
  "ev.title":   { en: "Evidence", es: "Evidencia" },
  "ev.field":   { en: "Field", es: "Campo" },
  "ev.value":   { en: "Value", es: "Valor" },
  "ev.method":  { en: "Method", es: "Método" },
  "ev.sourceType": { en: "Source type", es: "Tipo de fuente" },
  "ev.critic":  { en: "Critic verdict", es: "Veredicto del crítico" },
  "ev.source":  { en: "Source", es: "Fuente" },
  "ev.supported":   { en: "supported", es: "respaldada" },
  "ev.uncertain":   { en: "uncertain", es: "incierta" },
  "ev.unsupported": { en: "dropped", es: "descartada" },
  "ev.noSource":    { en: "no source", es: "sin fuente" },
  "ev.sub": {
    en: "Two independent judgements, and they are allowed to disagree. <b>Source type</b> is decided by a rule matched against the URL, so the same link always rates the same way. <b>Critic verdict</b> is a separate model asking whether this exact claim traces back to what the research actually found.",
    es: "Dos juicios independientes, y pueden contradecirse. El <b>tipo de fuente</b> lo decide una regla que se compara contra la URL, así que el mismo enlace siempre se clasifica igual. El <b>veredicto del crítico</b> es otro modelo preguntando si esta afirmación exacta se rastrea hasta lo que la investigación realmente encontró.",
  },
  "ev.empty": {
    en: "No claim survived the critic. That is the trust layer working, not the pipeline failing: what you do not see here is exactly what you should not act on.",
    es: "Ninguna afirmación sobrevivió al crítico. Eso es la capa de confianza funcionando, no el sistema fallando: lo que no ves aquí es justamente sobre lo que no deberías actuar.",
  },

  // ---- misc -------------------------------------------------------------
  "common.loading": { en: "Loading", es: "Cargando" },
  "common.empty":   { en: "Nothing here yet.", es: "Todavía no hay nada aquí." },
  "lang.switchTo":  { en: "Español", es: "English" },
  "lang.label":     { en: "Language", es: "Idioma" },
};

/** Translator bound to a language. Interpolates {tokens}. */
export function t(lang) {
  const L = LANGS.includes(lang) ? lang : DEFAULT_LANG;
  return (key, vars) => {
    const entry = COPY[key];
    if (!entry) return key;                    // visible, not silent
    let s = entry[L] ?? entry[DEFAULT_LANG] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}

/** Any key missing a language is a bug. Surfaced, never defaulted over quietly. */
export function missingKeys() {
  const out = [];
  for (const [key, entry] of Object.entries(COPY)) {
    for (const l of LANGS) if (!entry[l]) out.push(`${key}:${l}`);
  }
  return out;
}
