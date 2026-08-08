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
  "chrome.howItWorks": { en: "How it works", es: "Cómo funciona" },
  "lang.switchTo":  { en: "Español", es: "English" },
  "lang.label":     { en: "Language", es: "Idioma" },
  "common.undated": { en: "undated", es: "sin fecha" },
  "common.unknown": { en: "unknown", es: "desconocida" },
  "common.notSaved":{ en: "Not saved: {err}", es: "No se guardó: {err}" },

  // ---- chrome, part two ---------------------------------------------------
  "chrome.footer": {
    en: "Floor · built for the Yuno GTM Engineer business case",
    es: "Floor · construido para el business case de GTM Engineer en Yuno",
  },
  "chrome.budgetTip": {
    en: "Hard daily spend cap. Reaching it degrades to cached results rather than erroring.",
    es: "Tope de gasto diario estricto. Al alcanzarlo se sirven resultados en caché en lugar de fallar.",
  },

  // ---- queue, part two ----------------------------------------------------
  "rule.unscoredCost": {
    en: "Never assessed. A run is three model calls, about {cost} of measured spend, and every claim is refuted before it is trusted.",
    es: "Nunca analizadas. Un análisis son tres llamadas al modelo, unos {cost} de gasto medido, y cada afirmación se intenta refutar antes de darla por buena.",
  },
  "gauge.aria": {
    en: "estimated {mid} transactions per month against a {floor} floor",
    es: "estimación de {mid} transacciones al mes frente a un umbral de {floor}",
  },
  "meter.title": { en: "confidence {pct}", es: "confianza {pct}" },
  "queue.runNote": {
    en: "Research with citations, extraction, then a critic that tries to refute every claim. Two to four minutes. When evidence will not carry a number, it abstains out loud.",
    es: "Investigación con citas, extracción, y un crítico que intenta refutar cada afirmación. Toma de dos a cuatro minutos. Cuando la evidencia no sostiene un número, se abstiene y lo dice.",
  },
  "queue.cooldownTip": {
    en: "Their re-touch policy is theirs to set. Default shown, not hardcoded.",
    es: "La política de recontacto la define el equipo. Se muestra el valor por defecto, no está fijado en el código.",
  },
  "queue.foot": {
    en: "Ranked in code, not by a model: same inputs, same order, every time. Confidence dampens a score; it never decides a band.",
    es: "El orden lo calcula el código, no un modelo: mismos datos, mismo orden, siempre. La confianza amortigua el puntaje; nunca decide la banda.",
  },
  "queue.addHint": {
    en: "One per line. Bare domain, or <code>domain,name,region,last_touched,owner</code>. Regions: NORTHAMERICA, EUROPE, APAC, LATAM, AMEA.",
    es: "Una por línea. Solo el dominio, o <code>dominio,nombre,región,último_contacto,responsable</code>. Regiones: NORTHAMERICA, EUROPE, APAC, LATAM, AMEA.",
  },
  "field.domainPh":  { en: "domain, e.g. zalando.com", es: "dominio, p. ej. zalando.com" },
  "field.touchedTip":{ en: "Drives cool-down", es: "Determina el enfriamiento" },
  "action.cancel":   { en: "Cancel", es: "Cancelar" },
  "action.add":      { en: "Add", es: "Agregar" },
  "action.save":     { en: "Save", es: "Guardar" },

  // ---- queue row drill-down -------------------------------------------------
  "xp.whyRank":      { en: "Why it sits at #{rank}", es: "Por qué está en el puesto {rank}" },
  "xp.noRun":        { en: "No assessment run yet.", es: "Todavía no se ha corrido un análisis." },
  "xp.openEvidence": { en: "Open the evidence", es: "Ver la evidencia" },
  "xp.assessNow":    { en: "Assess now", es: "Analizar ahora" },
  "sig.title":       { en: "Timing signals", es: "Señales de momento" },
  "sig.none": {
    en: "No dated trigger on file. Fit alone does not make an account this week's work.",
    es: "No hay ninguna señal con fecha registrada. El encaje por sí solo no convierte una cuenta en trabajo de esta semana.",
  },
  "dim.fit":        { en: "Fit", es: "Encaje" },
  "dim.timing":     { en: "Timing", es: "Momento" },
  "dim.confidence": { en: "Confidence", es: "Confianza" },
  "dim.region":     { en: "Region", es: "Región" },
  "dim.score":      { en: "Score", es: "Puntaje" },
  "dim.vsFloor":    { en: "vs {floor} floor", es: "vs umbral de {floor}" },
  "dim.signals":    { en: "dated signals: {n}", es: "señales con fecha: {n}" },
  "dim.dampens":    { en: "dampens, never decides", es: "amortigua, nunca decide" },
  "dim.formula":    { en: "0.55 fit + 0.30 timing + 0.15 region", es: "0.55 encaje + 0.30 momento + 0.15 región" },
  "dim.vsFloorLong":{ en: "against the {floor} txn/mo floor", es: "frente al umbral de {floor} trx/mes" },
  "dim.signalsDecay": {
    en: "dated signals: {n}, decaying over ~4 months",
    es: "señales con fecha: {n}, decaen en ~4 meses",
  },
  "dim.noDatedReason": { en: "no dated reason to touch now", es: "sin razón con fecha para contactar ahora" },
  "dim.dampensLong": {
    en: "dampens the score, never decides the band",
    es: "amortigua el puntaje, nunca decide la banda",
  },

  // ---- account page ---------------------------------------------------------
  "acct.floorMark":     { en: "floor {floor}", es: "umbral {floor}" },
  "acct.noRun":         { en: "No run on record", es: "Sin análisis registrado" },
  "acct.noRunBody": {
    en: "Run it from the queue. Three stages, two to four minutes, every claim cited and refuted before it is trusted.",
    es: "Córrelo desde la cola. Tres etapas, de dos a cuatro minutos, y cada afirmación llega citada y pasada por el crítico antes de darla por buena.",
  },
  "unit.txnMo":         { en: "txn / mo", es: "trx / mes" },
  "acct.rangeConf": {
    en: "range {min}&ndash;{max} · confidence {conf}",
    es: "rango {min}&ndash;{max} · confianza {conf}",
  },
  "acct.regionUnknown": { en: "region unknown", es: "región desconocida" },
  "acct.weight":        { en: "weight", es: "peso" },
  "acct.whyTitle":      { en: "Why it ranks here", es: "Por qué ocupa este lugar" },
  "acct.rankHint": {
    en: "Fit, timing and cool-down combine in code, not in a model. Same inputs, same rank, every time. The model reads and cites; the arithmetic stays reproducible.",
    es: "Encaje, momento y enfriamiento se combinan en código, no en un modelo. Mismos datos, mismo puesto, siempre. El modelo lee y cita; la aritmética se mantiene reproducible.",
  },
  "cool.word.held":  { en: "held", es: "retenida" },
  "cool.word.fresh": { en: "fresh", es: "nueva" },
  "cool.word.clear": { en: "clear", es: "libre" },
  "cool.touchedAgo": {
    en: "touched {d}d ago · eligible {date}",
    es: "contactada hace {d} días · disponible {date}",
  },
  "cool.lastTouched": { en: "last touched {date}", es: "último contacto {date}" },

  // ---- evidence, part two -----------------------------------------------------
  "ev.subMore": {
    en: `A regulatory filing can still fail attribution, and a help page can pass it. Anything the critic could not support at all was dropped before reaching this table. Rules are editable on <a href="/sources">Sources</a>.`,
    es: `Una presentación regulatoria puede fallar la atribución, y una página de ayuda puede pasarla. Todo lo que el crítico no pudo respaldar se descartó antes de llegar a esta tabla. Las reglas se editan en <a href="/sources">Fuentes</a>.`,
  },
  "ev.sourceTypeTip": {
    en: "Decided by a rule matched against the source URL, not by a model. Same link, same tier, every time. Editable on the Sources page.",
    es: "Lo decide una regla comparada contra la URL de la fuente, no un modelo. Mismo enlace, mismo nivel, siempre. Se edita en la página de Fuentes.",
  },
  "ev.criticTip": {
    en: "A separate model asking whether this exact claim traces back to what the research actually found. It can disagree with the source type, and when it does, that is the check earning its place.",
    es: "Otro modelo preguntando si esta afirmación exacta se rastrea hasta lo que la investigación realmente encontró. Puede contradecir al tipo de fuente, y cuando lo hace, ese es el control ganándose su lugar.",
  },
  "ev.verbatim": {
    en: "model output, stored verbatim in English",
    es: "salida del modelo, guardada textualmente en inglés",
  },
  "ev.langNote": {
    en: "Abstain reasons, critic notes and methods are shown exactly as the model wrote them, in English. Translating verbatim evidence would be editing it.",
    es: "Las razones de abstención, las notas del crítico y los métodos se muestran tal como el modelo los escribió, en inglés. Traducir evidencia textual sería editarla.",
  },
  "ev.rule": { en: "rule", es: "regla" },

  // ---- run trace ---------------------------------------------------------------
  "trace.title": { en: "Run trace", es: "Traza del análisis" },
  "trace.sub": {
    en: "{cost} · {sec}s of model time · {n} calls. Click a stage for its tokens and stop reason.",
    es: "{cost} · {sec}s de tiempo de modelo · {n} llamadas. Haz clic en una etapa para ver sus tokens y su razón de parada.",
  },
  "trace.research": {
    en: "Searches public sources and returns what it read, with the URLs.",
    es: "Busca en fuentes públicas y devuelve lo que leyó, con las URLs.",
  },
  "trace.extract": {
    en: "Turns prose into typed claims: field, value, method, source, confidence.",
    es: "Convierte el texto en afirmaciones tipadas: campo, valor, método, fuente, confianza.",
  },
  "trace.critic": {
    en: "Adversarial pass. Tries to refute each claim; what it cannot support is dropped.",
    es: "Pasada adversarial. Intenta refutar cada afirmación; lo que no puede respaldar se descarta.",
  },
  "trace.input":      { en: "Input", es: "Entrada" },
  "trace.output":     { en: "Output", es: "Salida" },
  "trace.cacheRead":  { en: "Cache read", es: "Lectura de caché" },
  "trace.searches":   { en: "Searches", es: "Búsquedas" },
  "trace.stop":       { en: "Stop", es: "Parada" },
  "trace.scorerName": { en: "scorer", es: "puntaje" },
  "trace.scorerDesc": { en: "deterministic code, no model call", es: "código determinista, sin llamada al modelo" },
  "trace.foot": {
    en: "Routing is deliberate: extraction is high-volume and mechanical, so it runs on Sonnet. The critic is adversarial judgment on a small payload, so it runs on Opus. The scorer is not a model at all.",
    es: "El enrutamiento es deliberado: la extracción es mecánica y de alto volumen, así que corre en Sonnet. El crítico es juicio adversarial sobre poco texto, así que corre en Opus. El puntaje ni siquiera es un modelo.",
  },

  // ---- live run (client) ---------------------------------------------------------
  "run.assessing":    { en: "Assessing", es: "Analizando" },
  "run.noCarry":      { en: "Evidence would not carry a number.", es: "La evidencia no sostenía un número." },
  "run.openFull":     { en: "Open the full evidence →", es: "Ver la evidencia completa →" },
  "run.cachedMode":   { en: "Cached mode", es: "Modo caché" },
  "run.stopped":      { en: "Stopped: {err}", es: "Se detuvo: {err}" },
  "run.stoppedAfter": { en: "Stopped after {t}: {err}", es: "Se detuvo a los {t}: {err}" },
  "run.error":        { en: "Error: {err}", es: "Error: {err}" },

  // ---- evals -----------------------------------------------------------------
  "eval.eyebrow": { en: "Scored against public disclosures", es: "Calificado contra cifras públicas" },
  "eval.title":   { en: "How much of this can you trust?", es: "¿Cuánto de esto puedes creer?" },
  "eval.lede": {
    en: "The gold set is built only from merchants that <b>publicly disclose</b> a volume figure, so every accuracy claim below can be checked by opening the source. Nothing here is asserted at you.",
    es: "El set de referencia se arma solo con comercios que <b>publican</b> su cifra de volumen, así que cada dato de precisión aquí abajo se puede verificar abriendo la fuente. Nada aquí se afirma sin respaldo.",
  },
  "eval.floorCorrect": { en: "Floor call correct", es: "Veredicto de umbral correcto" },
  "eval.ofScored":     { en: "{a} of {b} scored", es: "{a} de {b} calificados" },
  "eval.noRunYet":     { en: "no eval run yet", es: "sin evaluación todavía" },
  "eval.inBand":       { en: "Truth inside range", es: "Real dentro del rango" },
  "eval.ofN":          { en: "{a} of {b}", es: "{a} de {b}" },
  "eval.abstainRate":  { en: "Abstain rate", es: "Tasa de abstención" },
  "eval.reported":     { en: "reported, not hidden", es: "se reporta, no se esconde" },
  "eval.goldVerified": { en: "Gold set verified", es: "Set de referencia verificado" },
  "eval.humanChecked": { en: "human-checked figures", es: "cifras revisadas por una persona" },
  "eval.latest":       { en: "Latest eval", es: "Última evaluación" },
  "eval.runMeta":      { en: "{n} accounts · run {date}", es: "{n} cuentas · corrida {date}" },
  "eval.notRun": {
    en: "not run yet. The empty state is honest: an accuracy number will only ever appear here once there is something real to score.",
    es: "todavía no se corre. El estado vacío es honesto: aquí solo aparecerá un número de precisión cuando haya algo real que calificar.",
  },
  "eval.run":       { en: "Run eval", es: "Correr evaluación" },
  "eval.running":   { en: "running…", es: "corriendo…" },
  "eval.merchant":  { en: "Merchant", es: "Comercio" },
  "eval.disclosed": { en: "Disclosed", es: "Publicado" },
  "eval.predicted": { en: "Predicted range", es: "Rango predicho" },
  "eval.inBandCol": { en: "In band", es: "En rango" },
  "eval.floorCall": { en: "Floor call", es: "Veredicto de umbral" },
  "eval.checkIt":   { en: "Check it", es: "Verifícalo" },
  "eval.vAbstained":{ en: "abstained", es: "se abstuvo" },
  "eval.vInBand":   { en: "in band", es: "en rango" },
  "eval.vOutside":  { en: "outside", es: "fuera" },
  "eval.vCorrect":  { en: "correct", es: "correcto" },
  "eval.vWrong":    { en: "wrong", es: "errado" },
  "eval.foot": {
    en: "Abstentions are excluded from accuracy and reported separately. A tool that never abstains is not more accurate, it is less honest.",
    es: "Las abstenciones se excluyen de la precisión y se reportan aparte. Una herramienta que nunca se abstiene no es más precisa, es menos honesta.",
  },
  "eval.step1": {
    en: "Open a disclosure below, normalise it to transactions per month, type it in with the URL you read.",
    es: "Abre una de las fuentes de abajo, normaliza la cifra a transacciones por mes y escríbela junto con la URL que leíste.",
  },
  "eval.nDone":   { en: "{n} done.", es: "{n} listas." },
  "eval.noneYet": {
    en: "None verified yet, on purpose: seeding these from memory would reproduce exactly the failure this tool exists to fix.",
    es: "Ninguna verificada aún, a propósito: llenarlas de memoria reproduciría exactamente la falla que esta herramienta existe para corregir.",
  },
  "eval.step2t": { en: "Assess that merchant", es: "Analiza ese comercio" },
  "eval.step2": {
    en: "Run it from the queue so there is a prediction to grade.",
    es: "Córrelo desde la cola para que exista una predicción que calificar.",
  },
  "eval.step3t": { en: "Run the eval", es: "Corre la evaluación" },
  "eval.step3": {
    en: "The tool grades itself against the disclosed truth and reports the miss rate here, including its own abstentions.",
    es: "La herramienta se califica a sí misma contra la cifra publicada y reporta aquí su tasa de error, incluidas sus propias abstenciones.",
  },

  // ---- gold set -----------------------------------------------------------------
  "gold.title":    { en: "Gold set", es: "Set de referencia" },
  "gold.sub": {
    en: "a row does not count until a human opens the source and types the figure",
    es: "una fila no cuenta hasta que una persona abre la fuente y escribe la cifra",
  },
  "gold.progress":     { en: "{a} of {b} verified", es: "{a} de {b} verificadas" },
  "gold.metric":       { en: "Disclosed metric", es: "Métrica publicada" },
  "gold.monthly":      { en: "Monthly txn", es: "Trx mensuales" },
  "gold.verifiedChip": { en: "verified", es: "verificada" },
  "gold.enter":        { en: "Enter figure", es: "Ingresar cifra" },
  "gold.foot": {
    en: "These {n} merchants disclose volume somewhere public. They ship unverified because typing a number nobody opened would be inventing data in an accuracy harness.",
    es: "Estos {n} comercios publican su volumen en algún lugar público. Se entregan sin verificar porque escribir un número que nadie abrió sería inventar datos dentro de un arnés de precisión.",
  },
  "gold.dlgTitle": { en: "Verify a gold-set figure", es: "Verifica una cifra del set de referencia" },
  "gold.dlgHint": {
    en: "Open the source, find the disclosed figure, normalise it to <b>transactions per month</b>, and paste the URL you actually read.",
    es: "Abre la fuente, encuentra la cifra publicada, normalízala a <b>transacciones por mes</b> y pega la URL que realmente leíste.",
  },
  "gold.phMetric": { en: "Disclosed metric, e.g. orders / quarter", es: "Métrica publicada, p. ej. pedidos / trimestre" },
  "gold.phValue":  { en: "Monthly transactions, normalised", es: "Transacciones mensuales, normalizadas" },
  "gold.phPeriod": { en: "Period, e.g. Q2 2026", es: "Período, p. ej. Q2 2026" },
  "gold.phUrl":    { en: "Source URL you opened", es: "URL de la fuente que abriste" },

  // ---- sources --------------------------------------------------------------------
  "src.eyebrow": { en: "Source registry", es: "Registro de fuentes" },
  "src.title":   { en: "Better sources, same trust layer.", es: "Mejores fuentes, la misma capa de confianza." },
  "src.note": {
    en: "One source is connected. The rest are the upgrade path, and the trust layer above them does not change when they are added.",
    es: "Hay una fuente conectada. El resto es la ruta de mejora, y la capa de confianza encima de ellas no cambia cuando se agregan.",
  },
  "src.lede": {
    en: "Every claim, wherever it comes from, still carries a source, gets refuted by the critic, and lands on the accuracy page. That is the investment argument: <b>the plumbing is swappable, the trust is not.</b>",
    es: "Cada afirmación, venga de donde venga, sigue llevando su fuente, pasa por el crítico y aterriza en la página de precisión. Ese es el argumento de inversión: <b>la tubería se puede cambiar, la confianza no.</b>",
  },
  "src.connected":     { en: "Connected", es: "Conectadas" },
  "src.webSearch":     { en: "web search with citations", es: "búsqueda web con citas" },
  "src.freeUnwired":   { en: "Free and unwired", es: "Gratis y sin conectar" },
  "src.regulatorData": { en: "regulator data, zero spend", es: "datos de reguladores, costo cero" },
  "src.regions":       { en: "Regions", es: "Regiones" },
  "src.territory":     { en: "Yuno's territory", es: "el territorio de Yuno" },
  "src.covTitle": {
    en: "Qualification coverage, today against wired",
    es: "Cobertura de calificación, hoy contra conectado",
  },
  "src.covSub": {
    en: "how well Floor could size a merchant in each region: with only what is connected now, then with the registry wired.",
    es: "qué tan bien podría Floor dimensionar un comercio en cada región: solo con lo conectado hoy, y luego con el registro completo conectado.",
  },
  "src.now":          { en: "Now", es: "Hoy" },
  "src.wired":        { en: "Wired", es: "Conectado" },
  "src.whoLifts":     { en: "What does the lifting", es: "Qué hace el trabajo" },
  "src.nothingWired": { en: "nothing wired", es: "nada conectado" },
  "src.nMore":        { en: "+{n} more", es: "+{n} más" },
  "src.covFoot": {
    en: "Ratings are deliberate and conservative. Costs stay qualitative: vendor pricing changes quarterly and this tool does not assert figures it cannot source.",
    es: "Las calificaciones son deliberadas y conservadoras. Los costos se quedan en lo cualitativo: los precios de los proveedores cambian cada trimestre y esta herramienta no afirma cifras que no puede respaldar.",
  },
  "src.regTitle": { en: "The registry", es: "El registro" },
  "src.regSub": {
    en: "ten sources worth wiring. One is live. Click any row for what it unlocks and where it stops.",
    es: "diez fuentes que vale la pena conectar. Una está viva. Haz clic en cualquier fila para ver qué desbloquea y dónde se queda corta.",
  },
  "src.unlocks":     { en: "What it unlocks", es: "Qué desbloquea" },
  "src.limits":      { en: "Where it stops", es: "Dónde se queda corta" },
  "src.covByRegion": { en: "Coverage by region", es: "Cobertura por región" },
  "src.regFoot": {
    en: "Order of attack if this ships: the free regulator feeds first, because SEC EDGAR and the EU registries cover the top two priority regions for nothing. Paid panels only after the eval harness can prove they earn their price.",
    es: "Orden de ataque si esto se lanza: primero los datos gratuitos de reguladores, porque SEC EDGAR y los registros de la UE cubren las dos regiones prioritarias sin costo. Paneles pagados solo cuando el arnés de evaluación pueda demostrar que valen su precio.",
  },
  "cov.strong":  { en: "strong", es: "fuerte" },
  "cov.partial": { en: "partial", es: "parcial" },
  "cov.weak":    { en: "weak", es: "débil" },
  "cov.none":    { en: "none", es: "nula" },

  // ---- source classification rules ----------------------------------------------------
  "rules.title": { en: "Source classification rules", es: "Reglas de clasificación de fuentes" },
  "rules.sub": {
    en: "How every claim's source type is decided. Matched against the URL in order, first match wins, no model involved. Editing a rule re-grades every claim already stored, because classification runs when a page renders rather than when the claim was written.",
    es: "Así se decide el tipo de fuente de cada afirmación. Se compara contra la URL en orden, gana la primera coincidencia, sin ningún modelo. Editar una regla recalifica cada afirmación ya guardada, porque la clasificación corre cuando la página se muestra, no cuando la afirmación se escribió.",
  },
  "rules.add":      { en: "Add rule", es: "Agregar regla" },
  "rules.order":    { en: "Order", es: "Orden" },
  "rules.pattern":  { en: "URL contains", es: "La URL contiene" },
  "rules.tier":     { en: "Classifies as", es: "Clasifica como" },
  "rules.weight":   { en: "Weight", es: "Peso" },
  "rules.matches":  { en: "Claims matched", es: "Coincidencias" },
  "rules.why":      { en: "Why", es: "Por qué" },
  "rules.dlgTitle": { en: "Add a classification rule", es: "Agregar una regla de clasificación" },
  "rules.dlgHint": {
    en: "Rules match on a substring of the source URL. Put specific patterns above general ones: a lower order number wins.",
    es: "Las reglas coinciden con un fragmento de la URL de la fuente. Pon los patrones específicos encima de los generales: gana el número de orden más bajo.",
  },
  "rules.phPattern":  { en: "URL contains, e.g. companieshouse.gov.uk", es: "La URL contiene, p. ej. companieshouse.gov.uk" },
  "rules.phLabel":    { en: "Label shown on screen, e.g. Statutory filing", es: "Etiqueta que se muestra, p. ej. Registro estatutario" },
  "rules.phWeight":   { en: "Weight 0 to 1", es: "Peso de 0 a 1" },
  "rules.phPosition": { en: "Order, lower wins", es: "Orden, el menor gana" },
  "rules.phNote":     { en: "Why this rule exists, shown on hover", es: "Por qué existe esta regla, visible al pasar el cursor" },
  "rules.off":     { en: "off", es: "apagada" },
  "rules.enable":  { en: "Enable", es: "Activar" },
  "rules.disable": { en: "Disable", es: "Desactivar" },
  "rules.delete":  { en: "Delete", es: "Eliminar" },
  "rules.empty": {
    en: "No rules. Every source will fall through to unclassified.",
    es: "Sin reglas. Toda fuente caerá en sin clasificar.",
  },
  "rules.footA": {
    en: "{total} stored claims classified · <b>{unmatched}</b> matched no rule and fell through to unclassified at weight {w}.",
    es: "{total} afirmaciones guardadas clasificadas · <b>{unmatched}</b> no coincidieron con ninguna regla y cayeron en sin clasificar con peso {w}.",
  },
  "rules.footB": {
    en: "Those are the domains worth adding a rule for.",
    es: "Esos son los dominios para los que vale la pena agregar una regla.",
  },
  "rules.footC": {
    en: "Every source seen so far is classified.",
    es: "Todas las fuentes vistas hasta ahora están clasificadas.",
  },
  "rules.loadFail": { en: "Could not load rules.", es: "No se pudieron cargar las reglas." },
  "tier.primary":       { en: "Regulatory filing", es: "Presentación regulatoria" },
  "tier.primaryStrong": { en: "Regulatory filing, strongest", es: "Presentación regulatoria, la más fuerte" },
  "tier.self":          { en: "Company statement", es: "Declaración de la empresa" },
  "tier.doc":           { en: "Product documentation", es: "Documentación del producto" },
  "tier.third":         { en: "Third-party estimate", es: "Estimación de terceros" },
  "tier.unclassified":  { en: "Unclassified", es: "Sin clasificar" },

  // ---- backlog ---------------------------------------------------------------------------
  "bl.eyebrow": { en: "One board, every build", es: "Un solo tablero, cada build" },
  "bl.title":   { en: "GTM Engineering backlog.", es: "Backlog de GTM Engineering." },
  "bl.lede": {
    en: "One zone per area. Every card has to name the gap it closes and the number it moves, because a build that cannot answer both does not belong on this board.",
    es: "Una zona por área. Cada tarjeta tiene que nombrar la brecha que cierra y el número que mueve, porque un build que no puede responder ambas no pertenece a este tablero.",
  },
  "bl.live":         { en: "Live", es: "En producción" },
  "bl.shipped":      { en: "shipped and running", es: "entregados y corriendo" },
  "bl.total":        { en: "Total", es: "Total" },
  "bl.acrossAreas":  { en: "across {n} areas", es: "en {n} áreas" },
  "bl.addOne":       { en: "Add one", es: "Agrega uno" },
  "bl.newCard":      { en: "New card", es: "Nueva tarjeta" },
  "bl.gapMetricReq": { en: "gap and metric required", es: "brecha y métrica obligatorias" },
  "bl.gap":          { en: "Gap", es: "Brecha" },
  "bl.moves":        { en: "Moves", es: "Mueve" },
  "bl.unassigned":   { en: "unassigned", es: "sin responsable" },
  "bl.st.idea":      { en: "idea", es: "idea" },
  "bl.st.building":  { en: "building", es: "en construcción" },
  "bl.st.live":      { en: "live", es: "en producción" },
  "bl.dlgTitle":     { en: "New build", es: "Nuevo build" },
  "bl.phTitle":      { en: "What are we building?", es: "¿Qué vamos a construir?" },
  "bl.phGap":        { en: "Which gap does it close?", es: "¿Qué brecha cierra?" },
  "bl.phMetric":     { en: "Which number does it move?", es: "¿Qué número mueve?" },
  "bl.phOwner":      { en: "Owner", es: "Responsable" },
  "bl.addCard":      { en: "Add card", es: "Agregar tarjeta" },

  // ---- impact model -----------------------------------------------------------------------
  "m.eyebrow": { en: "Recomputes as you type", es: "Recalcula mientras escribes" },
  "m.title":   { en: "What it moves, and what it costs.", es: "Qué mueve, y qué cuesta." },
  "m.lede": {
    en: "These are <b>your</b> representative figures from the brief, run forward. Change any input and every output recomputes immediately. Average contract value is deliberately blank: inventing your ACV in a tool whose whole argument is that its numbers can be trusted would be self-defeating.",
    es: "Estas son <b>tus</b> cifras representativas del brief, proyectadas hacia adelante. Cambia cualquier entrada y cada salida se recalcula al instante. El valor promedio de contrato está en blanco a propósito: inventar tu ACV en una herramienta cuyo argumento entero es que sus números son confiables sería contradecirse.",
  },
  "m.grpToday":  { en: "The team today", es: "El equipo hoy" },
  "m.sdrs":      { en: "SDRs", es: "SDRs" },
  "m.worked":    { en: "Accounts worked / SDR / mo", es: "Cuentas trabajadas / SDR / mes" },
  "m.mins":      { en: "Research minutes per account", es: "Minutos de investigación por cuenta" },
  "m.conv":      { en: "Worked to opportunity", es: "De trabajada a oportunidad" },
  "m.win":       { en: "Outbound win rate", es: "Tasa de cierre outbound" },
  "m.grpFloor":  { en: "With Floor", es: "Con Floor" },
  "m.winTarget": { en: "Outbound win rate target", es: "Tasa de cierre outbound objetivo" },
  "m.costPer":   { en: "Cost per account, measured", es: "Costo por cuenta, medido" },
  "m.acv":       { en: "Your average contract value", es: "Tu valor promedio de contrato" },
  "m.acvPh":     { en: "type it, this tool will not guess", es: "escríbelo, esta herramienta no adivina" },
  "m.acvNote": {
    en: "The one figure Floor refuses to supply. Everything above it is yours from the brief or measured from the run trace; this one is commercial and only you know it.",
    es: "La única cifra que Floor se niega a poner. Todo lo de arriba es tuyo, del brief, o medido de la traza del análisis; esta es comercial y solo tú la conoces.",
  },
  "m.oHours":   { en: "Research hours freed / month", es: "Horas de investigación liberadas / mes" },
  "m.oHoursD":  { en: "at the same headcount", es: "con el mismo equipo" },
  "m.oExtra":   { en: "Extra accounts that buys", es: "Cuentas extra que eso compra" },
  "m.oExtraD":  { en: "per month, no new hires", es: "por mes, sin contratar a nadie" },
  "m.oOpps":    { en: "Additional opportunities / month", es: "Oportunidades adicionales / mes" },
  "m.oOppsD":   { en: "from prioritisation alone", es: "solo por priorizar" },
  "m.oCost":    { en: "Tool cost / month", es: "Costo de la herramienta / mes" },
  "m.oCostD":   { en: "measured from the run trace, not estimated", es: "medido de la traza del análisis, no estimado" },
  "m.oValue":   { en: "Annual value of those opportunities", es: "Valor anual de esas oportunidades" },
  "m.enterAcv": { en: "enter your ACV", es: "ingresa tu ACV" },
  "m.ratio": {
    en: "at your {w}% target win rate · {r}x the tool's annual run cost",
    es: "a tu tasa de cierre objetivo de {w}% · {r}x el costo anual de la herramienta",
  },
  "m.noInvent": {
    en: "This tool will not invent your average contract value. Its whole argument is that its numbers can be trusted.",
    es: "Esta herramienta no va a inventar tu valor promedio de contrato. Su argumento entero es que sus números son confiables.",
  },
  "m.argument": {
    en: "The sentence that carries this: <b>the floor filter is the win-rate lever.</b> A merchant under the floor cannot become a customer, so every hour spent on one is a hole in the win rate by construction. Floor is not promising better selling. It removes accounts that were never winnable from the queue, and stops the ones that were from being burned by a premature third touch.",
    es: "La frase que sostiene todo esto: <b>el filtro del umbral es la palanca de la tasa de cierre.</b> Un comercio por debajo del umbral no puede volverse cliente, así que cada hora invertida en uno es un hueco en la tasa de cierre por construcción. Floor no promete vender mejor. Saca de la cola las cuentas que nunca se podían ganar, y evita que las que sí podían se quemen con un tercer toque prematuro.",
  },

  // ---- day one / wired ------------------------------------------------------------------------
  "w.eyebrow": { en: "The first three weeks", es: "Las primeras tres semanas" },
  "w.title": {
    en: "What this becomes wired into your stack.",
    es: "En qué se convierte esto conectado a tu stack.",
  },
  "w.lede": {
    en: "Built under the challenge rules: public sources, free tiers, no access to your production systems. Everything below is the same engine with the seams connected.",
    es: "Construido bajo las reglas del reto: fuentes públicas, planes gratuitos, sin acceso a tus sistemas de producción. Todo lo de abajo es el mismo motor con las costuras conectadas.",
  },
  "w.today":   { en: "Today", es: "Hoy" },
  "w.wired":   { en: "Wired", es: "Conectado" },
  "w.notUsed": { en: "Not used.", es: "No se usa." },
  "w.sf.now": {
    en: "A CSV shaped for your objects, and a stubbed write-back adapter that is deliberately not wired.",
    es: "Un CSV con la forma de tus objetos, y un adaptador de escritura en borrador que a propósito no está conectado.",
  },
  "w.sf.later": {
    en: "Score, band, verdict, range, confidence and cool-down land as Account fields, so the queue lives where the team is already measured. Cool-down stops being an uploaded date and starts reading real Activity and CampaignMember history, which is the only way suppression is ever accurate. Every SQL and closed-won flows back as a labelled outcome, so the ranking gets graded against reality instead of against my gold set.",
    es: "Puntaje, banda, veredicto, rango, confianza y enfriamiento aterrizan como campos de la cuenta, así que la cola vive donde ya se mide al equipo. El enfriamiento deja de ser una fecha subida a mano y empieza a leer el historial real de Activities y CampaignMembers, que es la única forma de que la supresión sea precisa. Cada SQL y cada cierre ganado regresa como resultado etiquetado, así que el ranking se califica contra la realidad y no contra mi set de referencia.",
  },
  "w.apollo.now": {
    en: "Nothing. The account universe is a seeded list and public evidence.",
    es: "Nada. El universo de cuentas es una lista sembrada y evidencia pública.",
  },
  "w.apollo.later": {
    en: "Apollo becomes the roster and the contact layer, not the qualifier. Floor decides which of the ~6,000 accounts deserve enrichment credits at all, which inverts the usual order and is where the credit saving is. Buying-committee contacts get pulled only for accounts above the floor.",
    es: "Apollo se vuelve el roster y la capa de contactos, no el calificador. Floor decide cuáles de las ~6,000 cuentas merecen créditos de enriquecimiento, lo que invierte el orden usual y es donde está el ahorro de créditos. Los contactos del comité de compra se traen solo para cuentas por encima del umbral.",
  },
  "w.nav.later": {
    en: "Saved-search alerts become timing signals with real dates rather than whatever a web search surfaced. Job changes into head-of-payments and e-commerce roles are the single highest-value trigger in this motion and they are only visible here.",
    es: "Las alertas de búsquedas guardadas se vuelven señales de momento con fechas reales, en lugar de lo que una búsqueda web haya sacado. Los cambios de puesto hacia roles de head of payments y e-commerce son el disparador de mayor valor en esta motion y solo se ven aquí.",
  },
  "w.gong.later": {
    en: "The queue writes the work list. An account entering the Work-now band creates the touch sequence; an account entering cool-down suppresses it. That closes the loop the brief describes as manual, and it means nobody re-hits an account by accident rather than by policy.",
    es: "La cola escribe la lista de trabajo. Una cuenta que entra a la banda de Trabajar ahora crea la secuencia de contacto; una que entra en enfriamiento la suprime. Eso cierra el ciclo que el brief describe como manual, y significa que nadie recontacta una cuenta por accidente en lugar de por política.",
  },
  "w.bc.name": { en: "Your business-case tool", es: "Tu herramienta de business case" },
  "w.bc.now": {
    en: "Floor sits upstream of it and does not touch it.",
    es: "Floor se sienta aguas arriba y no la toca.",
  },
  "w.bc.later": {
    en: "Floor decides which accounts earn a business case, and hands over the checkout footprint it already found so the case starts half-built. Your tool answers how much a merchant is leaving on the table; Floor answers which merchants should be asked that question this week. They are different questions and the second one makes the first more valuable.",
    es: "Floor decide qué cuentas ameritan un business case, y entrega la huella de checkout que ya encontró para que el caso arranque a medio construir. Tu herramienta responde cuánto está dejando un comercio sobre la mesa; Floor responde a qué comercios hay que hacerles esa pregunta esta semana. Son preguntas distintas y la segunda hace más valiosa a la primera.",
  },
  "w.prov.name": { en: "A paid traffic or volume provider", es: "Un proveedor pago de tráfico o volumen" },
  "w.prov.now": {
    en: "Public disclosures only, which is why the abstain rate is honest and not low.",
    es: "Solo cifras públicas, y por eso la tasa de abstención es honesta y no baja.",
  },
  "w.prov.later": {
    en: "A licensed traffic or panel feed collapses most abstentions into real ranges. The architecture already expects this: providers sit behind a swappable adapter, and the eval harness is what tells you whether a paid feed actually earns its price rather than just filling cells.",
    es: "Un feed licenciado de tráfico o panel colapsa la mayoría de las abstenciones en rangos reales. La arquitectura ya lo espera: los proveedores viven detrás de un adaptador intercambiable, y el arnés de evaluación es lo que te dice si un feed pago realmente vale su precio o solo llena celdas.",
  },
  "w.honestTitle": { en: "What 48 hours did not buy", es: "Lo que 48 horas no compraron" },
  "w.h1": {
    en: "The estimator leans on public disclosures, so it abstains more often than a production version would. That is the correct trade at this stage, and the abstain rate is on the accuracy page rather than hidden.",
    es: "El estimador se apoya en cifras públicas, así que se abstiene más seguido de lo que lo haría una versión de producción. Es el intercambio correcto en esta etapa, y la tasa de abstención está en la página de precisión en lugar de escondida.",
  },
  "w.h2": {
    en: "Cool-down reads an uploaded date. Wired to Salesforce Activity history it would read the truth.",
    es: "El enfriamiento lee una fecha subida a mano. Conectado al historial de Activities de Salesforce leería la verdad.",
  },
  "w.h3": {
    en: "The gold set is small. It is checkable, which matters more right now than being large.",
    es: "El set de referencia es pequeño. Es verificable, que ahora mismo importa más que ser grande.",
  },
  "w.h4": {
    en: "No write path into any system of yours. The rules said no production access, and a candidate who quietly asks for credentials is telling you something.",
    es: "Sin ruta de escritura hacia ningún sistema tuyo. Las reglas decían sin acceso a producción, y un candidato que pide credenciales por lo bajo te está diciendo algo.",
  },

  // ---- settings ------------------------------------------------------------------------------
  "nav.settings": { en: "Settings", es: "Ajustes" },
  "set.eyebrow":  { en: "Configuration", es: "Configuración" },
  "set.title":    { en: "Every knob, in one place.", es: "Cada perilla, en un solo lugar." },
  "set.lede": {
    en: "Nothing here needs a deploy, a terminal, or the person who built it. Changes take effect on the next page load, and where a setting re-grades existing work rather than only affecting future runs, it says so.",
    es: "Nada aquí necesita un deploy, una terminal, ni a la persona que lo construyó. Los cambios aplican en la siguiente carga de página, y cuando un ajuste recalifica trabajo ya guardado en lugar de afectar solo los análisis futuros, lo dice.",
  },
  "set.spentToday": { en: "Spent today", es: "Gastado hoy" },
  "set.ofCap":      { en: "of {cap} cap", es: "de un tope de {cap}" },
  "set.measured":   { en: "measured", es: "medido" },
  "set.qualTitle":  { en: "Qualification", es: "Calificación" },
  "set.qualSub": {
    en: "What counts as a merchant worth working. These are the two numbers the whole queue turns on.",
    es: "Qué cuenta como un comercio que vale la pena trabajar. Estos son los dos números sobre los que gira toda la cola.",
  },
  "set.floorLabel":  { en: "Qualification floor", es: "Umbral de calificación" },
  "set.floorSuffix": { en: "transactions / month", es: "transacciones / mes" },
  "set.floorHint": {
    en: "Yuno's stated ICP threshold. A merchant below this cannot become a customer.",
    es: "El umbral de ICP declarado por Yuno. Un comercio por debajo no puede volverse cliente.",
  },
  "set.floorEffect": {
    en: "Re-grades <b>every stored assessment</b> immediately. Accounts move between bands on the next page load, no re-run needed.",
    es: "Recalifica <b>cada análisis guardado</b> de inmediato. Las cuentas cambian de banda en la siguiente carga de página, sin volver a correr nada.",
  },
  "set.cdLabel": { en: "Cool-down window", es: "Ventana de enfriamiento" },
  "set.cdHint": {
    en: "How long an account stays suppressed after it was last touched. This is your re-touch policy, and it is yours to set rather than ours to assume.",
    es: "Cuánto tiempo queda suprimida una cuenta después del último contacto. Esta es tu política de recontacto, y te toca definirla a ti, no a nosotros suponerla.",
  },
  "set.cdEffect": {
    en: "Re-computes suppression across the queue immediately. Widening it moves accounts into Cooling down; narrowing it releases them.",
    es: "Recalcula la supresión en toda la cola de inmediato. Ampliarla mueve cuentas a En enfriamiento; acortarla las libera.",
  },
  "set.routeTitle": { en: "Model routing", es: "Enrutamiento de modelos" },
  "set.routeSub": {
    en: "Which model runs which stage. Deliberate, and shown in every run trace so the choice is auditable rather than hidden.",
    es: "Qué modelo corre cada etapa. Deliberado, y visible en cada traza de análisis para que la elección sea auditable y no esté escondida.",
  },
  "set.researchHint": {
    en: "Gathers cited public evidence with web search. High volume, mechanical, and the slowest stage by far.",
    es: "Reúne evidencia pública citada con búsqueda web. Alto volumen, mecánica, y por mucho la etapa más lenta.",
  },
  "set.extractHint": {
    en: "Turns the research brief into typed, cited claims. Deliberately has no tools, so it cannot add facts research did not find.",
    es: "Convierte el informe de investigación en afirmaciones tipadas y citadas. A propósito no tiene herramientas, así que no puede agregar hechos que la investigación no encontró.",
  },
  "set.criticHint": {
    en: "Tries to refute every claim. This is the stage the trust argument rests on, so it runs on the strongest model even though its payload is small.",
    es: "Intenta refutar cada afirmación. Es la etapa sobre la que descansa el argumento de confianza, así que corre en el modelo más fuerte aunque su carga sea pequeña.",
  },
  "set.futureOnly":         { en: "Affects future runs only.", es: "Afecta solo los análisis futuros." },
  "set.futureOnlyEvidence": {
    en: "Affects future runs only. Stored evidence is unchanged.",
    es: "Afecta solo los análisis futuros. La evidencia guardada no cambia.",
  },
  "set.criticEffect": {
    en: "Affects future runs only. Downgrading this is the single riskiest change on this page.",
    es: "Afecta solo los análisis futuros. Bajarle el modelo es el cambio más riesgoso de toda esta página.",
  },
  "set.modelOpus": {
    en: "Deepest judgement. Right for adversarial work on a small payload.",
    es: "El juicio más profundo. Indicado para trabajo adversarial sobre poco texto.",
  },
  "set.modelSonnet": {
    en: "The workhorse. Right for high-volume gathering and transcription.",
    es: "El caballo de batalla. Indicado para recolección y transcripción de alto volumen.",
  },
  "set.modelHaiku": {
    en: "Fastest and cheapest. Only for genuinely mechanical steps.",
    es: "El más rápido y barato. Solo para pasos genuinamente mecánicos.",
  },
  "set.costTitle": { en: "Cost controls", es: "Controles de costo" },
  "set.costSub": {
    en: "This runs behind a public URL that people are invited to use unattended. Without a ceiling, one curious visitor looping a large list is your bill.",
    es: "Esto corre detrás de una URL pública que la gente está invitada a usar sin supervisión. Sin un techo, un visitante curioso corriendo una lista grande en bucle es tu factura.",
  },
  "set.capLabel":  { en: "Daily spend cap", es: "Tope de gasto diario" },
  "set.capSuffix": { en: "USD / day", es: "USD / día" },
  "set.capHint": {
    en: "A hard ceiling on model spend per calendar day, checked before every call.",
    es: "Un techo estricto de gasto en modelos por día calendario, verificado antes de cada llamada.",
  },
  "set.capEffect": {
    en: "On reaching it the app degrades to <b>cached results with a visible banner</b> rather than erroring. Browsing, filtering and export keep working.",
    es: "Al alcanzarlo, la app pasa a <b>resultados en caché con un aviso visible</b> en lugar de fallar. Navegar, filtrar y exportar siguen funcionando.",
  },
  "set.searchLabel": { en: "Cost per web search", es: "Costo por búsqueda web" },
  "set.searchHint": {
    en: "Web search bills per request on top of tokens. Left at zero because we will not assert a rate we have not verified; set it and cost-per-account includes it.",
    es: "La búsqueda web se cobra por solicitud además de los tokens. Se deja en cero porque no vamos a afirmar una tarifa que no hemos verificado; defínela y el costo por cuenta la incluye.",
  },
  "set.searchEffect": {
    en: "Changes the reported cost per account. Does not change what anything costs in reality.",
    es: "Cambia el costo por cuenta que se reporta. No cambia lo que nada cuesta en la realidad.",
  },
  "set.evTitle": { en: "Evidence classification", es: "Clasificación de evidencia" },
  "set.evSub": {
    en: "How a source gets rated. Deterministic, matched against the URL, and the rules themselves are editable.",
    es: "Cómo se califica una fuente. Determinista, comparada contra la URL, y las reglas mismas son editables.",
  },
  "set.uwLabel": { en: "Unclassified source weight", es: "Peso de fuente sin clasificar" },
  "set.uwHint": {
    en: "What a source is worth when no rule matches its domain. Deliberately low, so an unknown source never carries the weight of a filing.",
    es: "Lo que vale una fuente cuando ninguna regla coincide con su dominio. Deliberadamente bajo, para que una fuente desconocida nunca pese lo que pesa una presentación regulatoria.",
  },
  "set.uwEffect": {
    en: "Re-grades stored evidence immediately, because classification runs when a page renders rather than when a claim was written.",
    es: "Recalifica la evidencia guardada de inmediato, porque la clasificación corre cuando la página se muestra, no cuando la afirmación se escribió.",
  },
  "set.rulesLink": { en: "Edit the classification rules →", es: "Editar las reglas de clasificación →" },
  "set.rulesLinkNote": {
    en: "17 rules today. Add a registry, demote an aggregator, or disable one without a deploy.",
    es: "Hoy hay 17 reglas. Agrega un registro, degrada un agregador o desactiva una sin un deploy.",
  },
  "set.impactTitle": { en: "Impact model", es: "Modelo de impacto" },
  "set.impactSub":   { en: "Used only on the Impact page.", es: "Se usa solo en la página de Impacto." },
  "set.acvLabel":    { en: "Average contract value", es: "Valor promedio de contrato" },
  "set.acvHint": {
    en: "Deliberately blank. We will not invent your ACV in a tool whose argument is that its numbers can be trusted.",
    es: "En blanco a propósito. No vamos a inventar tu ACV en una herramienta cuyo argumento es que sus números son confiables.",
  },
  "set.acvEffect": {
    en: "Until you set it, the Impact page reports opportunities gained rather than dollars, and says why.",
    es: "Hasta que lo definas, la página de Impacto reporta oportunidades ganadas en lugar de dólares, y explica por qué.",
  },
  "set.noUnsaved":   { en: "No unsaved changes", es: "Sin cambios pendientes" },
  "set.save":        { en: "Save changes", es: "Guardar cambios" },
  "set.unsavedOne":  { en: "1 unsaved change", es: "1 cambio sin guardar" },
  "set.unsavedMany": { en: "{n} unsaved changes", es: "{n} cambios sin guardar" },
  "set.saving":      { en: "Saving…", es: "Guardando…" },
  "set.saved":       { en: "Saved. Reloading to re-grade…", es: "Guardado. Recargando para recalificar…" },
  "set.saveFail":    { en: "Could not save: {err}", es: "No se pudo guardar: {err}" },

  // ---- kit (foundation layer; appended by the foundation author) ----------
  "nav.coverage":         { en: "Coverage", es: "Cobertura" },
  "kit.context":          { en: "Yuno SDR", es: "Yuno SDR" },
  "kit.skip":             { en: "Skip to content", es: "Saltar al contenido" },
  "kit.gauge.aria": {
    en: "Estimate {mid} transactions per month, range {min} to {max}, floor {floor}",
    es: "Estimación de {mid} transacciones al mes, rango de {min} a {max}, umbral de {floor}",
  },
  "kit.gauge.abstainAria": { en: "Abstained, no estimate issued", es: "Se abstuvo, no se emitió una estimación" },
  "kit.gauge.beyond":     { en: "beyond scale", es: "fuera de escala" },
  "kit.gauge.floor":      { en: "floor {floor}", es: "umbral {floor}" },
  "kit.menu.aria":        { en: "Actions", es: "Acciones" },
  "kit.select.all":       { en: "Select all", es: "Seleccionar todas" },
  "kit.select.row":       { en: "Select row", es: "Seleccionar fila" },
  "kit.bulk.selected":    { en: "{n} selected", es: "{n} seleccionadas" },
  "kit.bulk.clear":       { en: "Clear", es: "Quitar" },
  "kit.undo":             { en: "Undo", es: "Deshacer" },
  "kit.cancel":           { en: "Cancel", es: "Cancelar" },
  "kit.confirm":          { en: "Confirm", es: "Confirmar" },
  "kit.close":            { en: "Close", es: "Cerrar" },
  "kit.level.aria":       { en: "{n} of {of}", es: "{n} de {of}" },
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
