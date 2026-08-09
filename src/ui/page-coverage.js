/* Floor · page-coverage.js — the Coverage world map (/coverage)
   ---------------------------------------------------------------------
   DESIGN-SPEC §4.4. The investment argument drawn as geography: lit
   means Floor can qualify accounts there, dark means blind, and the
   Today / Wired toggle shows what the unwired registry would light up.

   Laws carried in this file:
   - Regions, never countries. Five, matched to the API's region codes.
   - sample_too_small is authoritative: a hatched region can never
     receive a fill, whatever its rate. Its label leads with the count.
   - The sample size is always printed on the field, in both modes.
   - Projected renders dashed and grained, never solid. Solid ink is a
     promise a human can click through to a source.
   - This is the product's single dark surface. The three dark tokens
     (--field, --lit, --proj) live here and nowhere else.
   - Inline SVG only. No tiles, no library, no remote asset.
   - Nothing animates at rest; the only motion is the 240ms crossfade
     between modes (40ms stagger west to east) and the 180ms dim on
     selection, both state changes. Reduced motion collapses them.
   --------------------------------------------------------------------- */

import { esc, mark, level, statRow, btn } from "./kit.js";
import { coverageByRegion } from "../lib/sources.js";

export const meta = {
  route: "/coverage",
  nav: "/coverage",
  titleKey: "nav.coverage",
};

/* ============================== copy =============================== */

export const keys = {
  "cvg.metaLine": {
    en: "{assessed} of {total} accounts assessed · {estimated} produced an estimate · {abstained} abstained",
    es: "{assessed} de {total} cuentas analizadas · {estimated} con estimación · {abstained} abstenciones",
  },
  "cvg.sourcesBtn": { en: "Source registry", es: "Registro de fuentes" },

  // region names (the API label is English only)
  "cvg.r.NORTHAMERICA": { en: "North America", es: "Norteamérica" },
  "cvg.r.EUROPE": { en: "Europe", es: "Europa" },
  "cvg.r.APAC": { en: "APAC", es: "APAC" },
  "cvg.r.LATAM": { en: "LATAM", es: "LATAM" },
  "cvg.r.AMEA": { en: "AMEA", es: "AMEA" },

  // the field
  "cvg.mapAria": {
    en: "World map of qualification coverage by region. Five regions; press Tab to move between them and Enter to inspect one.",
    es: "Mapa mundial de cobertura de calificación por región. Cinco regiones; usa Tab para moverte entre ellas y Enter para inspeccionar una.",
  },
  "cvg.modeCaption": {
    en: "Today is measured from stored assessments. Wired is a projection from the source registry, not a measurement.",
    es: "Hoy se mide desde los análisis almacenados. Conectado es una proyección del registro de fuentes, no una medición.",
  },
  "cvg.modeCaptionEmpty": {
    en: "Nothing is lit yet: lighting is earned by assessments. The projection still works because the registry is editorial.",
    es: "Nada está iluminado aún: la luz se gana con análisis. La proyección funciona igual porque el registro es editorial.",
  },
  "cvg.territories": { en: "Territories", es: "Territorios" },
  "cvg.accts": { en: "accts", es: "ctas" },
  "cvg.unassigned": { en: "unassigned", es: "sin asignar" },

  // printed label blocks on the field
  "cvg.lblAssessed": { en: "{a} of {t} assessed", es: "{a} de {t} analizadas" },
  "cvg.lblRate": { en: "{rate}% estimate rate", es: "{rate}% con estimación" },
  "cvg.lblN": { en: "n = {a} of {t}", es: "n = {a} de {t}" },
  "cvg.lblFloor": { en: "sample under {min}", es: "muestra menor a {min}" },
  "cvg.lblProjected": { en: "projected: {level}", es: "proyección: {level}" },

  // accessible names, coverage stated in words
  "cvg.ariaFull": {
    en: "{name}: {assessed} of {total} accounts assessed, {estimated} produced an estimate, estimate rate {rate} percent, median confidence {conf}. {proj} Press Enter for detail.",
    es: "{name}: {assessed} de {total} cuentas analizadas, {estimated} con estimación, tasa de estimación {rate} por ciento, confianza mediana {conf}. {proj} Pulsa Enter para el detalle.",
  },
  "cvg.ariaSmall": {
    en: "{name}: {assessed} of {total} accounts assessed, below the sample floor of {min}. Floor makes no coverage claim here. {proj} Press Enter for detail.",
    es: "{name}: {assessed} de {total} cuentas analizadas, bajo el piso muestral de {min}. Floor no afirma cobertura aquí. {proj} Pulsa Enter para el detalle.",
  },
  "cvg.ariaProjected": {
    en: "Projected once wired: {level}.",
    es: "Proyección una vez conectado: {level}.",
  },

  // legend (color is never the only carrier)
  "cvg.legendFill": {
    en: "Fill brightness: measured ability to qualify accounts",
    es: "Brillo del relleno: capacidad medida de calificar cuentas",
  },
  "cvg.legendHatch": {
    en: "Hatched: under {min} assessed, no claim made",
    es: "Rayado: menos de {min} analizadas, sin afirmación",
  },
  "cvg.legendDash": {
    en: "Dashed: projected from the registry, not measured",
    es: "Discontinuo: proyección del registro, no medido",
  },

  // rail
  "cvg.railAll": { en: "All regions", es: "Todas las regiones" },
  "cvg.railRegion": { en: "Region", es: "Región" },
  "cvg.railHint": {
    en: "Select a region on the map to see what is measured, what is missing, and what would close the gap.",
    es: "Selecciona una región del mapa para ver qué está medido, qué falta y qué cerraría la brecha.",
  },
  "cvg.overallSentence": {
    en: "{estimated} of {assessed} assessed accounts produced an estimate. {abstained} abstained, out loud, rather than guess.",
    es: "{estimated} de {assessed} cuentas analizadas produjeron una estimación. {abstained} se abstuvieron, en voz alta, en lugar de adivinar.",
  },
  "cvg.latamLine": {
    en: "Yuno operates in all five regions and LATAM is its home market. Floor is blind there today: {a} of {t} accounts assessed.",
    es: "Yuno opera en las cinco regiones y LATAM es su mercado principal. Floor está ciego allí hoy: {a} de {t} cuentas analizadas.",
  },
  "cvg.argument": {
    en: "A measured gap is an argument for investment. An unmeasured one is only a weakness. Wiring sources turns the assumption into a measurement.",
    es: "Una brecha medida es un argumento para invertir. Una sin medir es solo una debilidad. Conectar fuentes convierte la suposición en medición.",
  },
  "cvg.unassignedRegion": {
    en: "{n} account(s) have no region and appear nowhere on this map.",
    es: "{n} cuenta(s) no tienen región y no aparecen en este mapa.",
  },

  "cvg.stAssessed": { en: "Assessed", es: "Analizadas" },
  "cvg.stEstimates": { en: "Estimates", es: "Estimaciones" },
  "cvg.stAbstained": { en: "Abstained", es: "Abstenciones" },
  "cvg.stRate": { en: "Estimate rate", es: "Tasa de estimación" },
  "cvg.stConf": { en: "Median confidence", es: "Confianza mediana" },
  "cvg.noteSmall": { en: "below the sample floor of {min}", es: "bajo el piso muestral de {min}" },
  "cvg.noteNoRuns": { en: "no assessments yet", es: "aún sin análisis" },
  "cvg.noteSmallConf": { en: "withheld under the sample floor", es: "retenida bajo el piso muestral" },

  "cvg.mkMeasured": { en: "measured", es: "medido" },
  "cvg.mkBelowFloor": { en: "below the sample floor of {min}", es: "bajo el piso muestral de {min}" },

  "cvg.absTitle": { en: "Why it abstained", es: "Por qué se abstuvo" },
  "cvg.cause.pipeline_failure": {
    en: "Research or extraction itself failed",
    es: "La investigación o la extracción fallaron",
  },
  "cvg.cause.no_evidence_at_all": {
    en: "No disclosed volume evidence found",
    es: "No se encontró evidencia de volumen divulgada",
  },
  "cvg.cause.evidence_dropped_by_critic": {
    en: "Evidence existed but the critic would not let it stand",
    es: "Hubo evidencia, pero el crítico no la dejó en pie",
  },
  "cvg.cause.estimate_rejected_despite_evidence": {
    en: "Evidence survived, but the estimate built on it was rejected",
    es: "La evidencia sobrevivió, pero la estimación construida sobre ella fue rechazada",
  },
  "cvg.cause.range_too_wide": {
    en: "Disclosed figures disagreed too widely to resolve",
    es: "Las cifras divulgadas discrepaban demasiado para resolverse",
  },
  "cvg.cause.no_usable_number": {
    en: "No usable number came out of an attempted estimate",
    es: "El intento de estimación no produjo un número utilizable",
  },
  "cvg.cause.other": {
    en: "Abstained for an uncategorised reason",
    es: "Abstención por una razón sin categorizar",
  },

  "cvg.liftTitle": { en: "What would light it up", es: "Qué lo iluminaría" },
  "cvg.liftMove": {
    en: "would plausibly move {n} of {m} abstains",
    es: "movería plausiblemente {n} de {m} abstenciones",
  },
  "cvg.liftFirst": {
    en: "Unmeasured today. Assessing accounts comes first; these sources would then carry it:",
    es: "Sin medir hoy. Analizar cuentas va primero; estas fuentes lo sostendrían después:",
  },
  "cvg.liftNone": {
    en: "No unwired volume source rates better than weak here. That gap is the finding.",
    es: "Ninguna fuente de volumen sin conectar supera el nivel débil aquí. Esa brecha es el hallazgo.",
  },
  "cvg.cost.free": { en: "free", es: "gratis" },
  "cvg.cost.low": { en: "low cost", es: "bajo costo" },
  "cvg.cost.paid": { en: "paid", es: "de pago" },
  "cvg.cost.enterprise": { en: "enterprise", es: "enterprise" },
  "cvg.cost.included": { en: "included", es: "incluida" },
  "cvg.cost.owned": { en: "owned", es: "propia" },

  "cvg.viewAccounts": { en: "View these accounts", es: "Ver estas cuentas" },
  "cvg.clear": { en: "Back to all regions", es: "Volver a todas las regiones" },

  "cvg.emptyBody": {
    en: "Nothing is assessed anywhere yet, so the whole map withholds judgement. Lighting is earned one assessment at a time, from the queue.",
    es: "Aún no hay ninguna cuenta analizada, así que todo el mapa retiene el juicio. La luz se gana análisis a análisis, desde la cola.",
  },
  "cvg.openQueue": { en: "Open the queue", es: "Abrir la cola" },
  "cvg.errBody": {
    en: "Coverage data did not load. The map below shows geography only and makes no coverage claim.",
    es: "Los datos de cobertura no cargaron. El mapa de abajo muestra solo geografía y no afirma cobertura.",
  },
  "cvg.retry": { en: "Retry", es: "Reintentar" },
};

/* ======================= geometry (inline SVG) ====================== */
/* Hand-simplified low-poly landmasses on an equirectangular 960x470
   frame: x = (lon+180) * 960/360, y = (90-lat) * 470/180, rounded.
   Shapes are merged per region (subpaths per landmass / island).
   Greenland and Antarctica are omitted; Russia east of the Urals is
   drawn but unassigned, per spec. */

const SHAPES = {
  NORTHAMERICA:
    "M64,50 L139,52 L200,50 L253,57 L232,78 L250,90 L270,72 L296,66 L309,78 " +
    "L331,97 L339,111 L320,116 L301,118 L283,129 L279,143 L265,170 L240,159 " +
    "L221,167 L168,150 L155,138 L149,110 L125,86 L75,84 L32,63 L37,55 Z",
  LATAM:
    "M168,150 L221,167 L219,177 L224,185 L239,180 L248,179 L250,190 L257,196 " +
    "L269,209 L280,206 L309,207 L341,222 L347,235 L387,256 L365,295 L341,319 " +
    "L324,325 L306,347 L298,378 L283,366 L292,322 L293,282 L275,266 L264,238 " +
    "L274,224 L267,212 L248,202 L238,199 L227,193 L214,191 L192,172 Z " +
    "M256,178 L272,174 L284,180 L268,184 Z " +
    "M289,186 L299,184 L301,189 L291,191 Z",
  EUROPE:
    "M492,98 L501,91 L508,84 L509,93 L530,93 L544,86 L560,78 L547,78 L536,65 " +
    "L528,80 L519,90 L509,79 L498,84 L493,73 L520,57 L547,50 L568,55 L604,52 " +
    "L640,55 L634,102 L617,112 L605,115 L584,112 L571,118 L562,114 L557,128 " +
    "L549,129 L541,140 L531,125 L529,131 L523,136 L518,128 L504,119 L491,122 " +
    "L480,134 L466,141 L455,138 L454,128 L455,121 L476,121 L468,109 L480,105 Z " +
    "M472,82 L478,90 L484,97 L480,101 L465,104 L468,100 L466,89 Z " +
    "M453,96 L464,91 L464,99 L456,101 Z " +
    "M421,66 L440,62 L443,67 L424,70 Z",
  AMEA:
    "M464,142 L507,138 L533,149 L563,153 L575,147 L577,139 L562,141 L550,135 " +
    "L558,129 L591,127 L611,131 L624,139 L643,140 L644,169 L632,163 L609,157 " +
    "L615,166 L629,170 L639,176 L624,191 L600,202 L596,202 L584,180 L573,159 " +
    "L571,163 L567,157 L579,185 L595,204 L617,204 L601,230 L586,245 L588,275 " +
    "L587,292 L563,313 L548,324 L529,325 L519,295 L512,259 L505,240 L496,224 " +
    "L480,220 L460,224 L433,197 L435,180 L454,152 Z " +
    "M597,266 L615,276 L606,300 L597,291 Z",
  APAC:
    "M644,169 L659,170 L674,185 L687,214 L694,201 L707,185 L717,177 L731,193 " +
    "L743,214 L757,231 L748,200 L765,208 L769,193 L762,183 L785,177 L797,167 " +
    "L804,154 L794,133 L818,137 L824,143 L825,125 L832,122 L787,104 L715,107 " +
    "L667,94 L640,102 L618,112 L622,125 L624,138 L643,140 Z " +
    "M859,115 L868,122 L852,144 L829,156 L825,151 L847,136 Z " +
    "M801,170 L807,168 L808,177 L802,178 Z " +
    "M800,188 L805,186 L806,199 L801,197 Z " +
    "M806,207 L812,205 L813,213 L806,212 Z " +
    "M734,220 L740,219 L764,248 L759,252 Z " +
    "M761,252 L786,257 L785,261 L762,256 Z " +
    "M792,217 L799,231 L786,245 L770,235 L773,224 Z " +
    "M829,240 L857,243 L882,262 L876,268 L840,256 Z " +
    "M784,292 L829,267 L851,281 L860,263 L888,307 L883,323 L867,334 L829,317 L787,325 L789,318 Z " +
    "M868,340 L875,338 L874,347 L867,346 Z " +
    "M946,331 L953,334 L948,342 L942,338 Z " +
    "M938,344 L945,348 L936,357 L931,352 Z " +
    "M692,209 L698,208 L699,217 L693,218 Z",
};

/* Russia east of the Urals: drawn so the world stays recognisable,
   assigned to nobody, non-interactive. */
const SIBERIA =
  "M640,55 L747,37 L853,47 L933,52 L960,63 L950,75 L925,80 L907,97 L840,91 " +
  "L832,122 L787,104 L715,107 L667,94 L640,102 Z";

/* Label anchors sit on ocean so the print stays legible over any fill,
   in both modes. West to east order drives the crossfade stagger. */
const LABELS = {
  NORTHAMERICA: { x: 52, y: 150 },
  LATAM: { x: 398, y: 306 },
  EUROPE: { x: 330, y: 80 },
  AMEA: { x: 632, y: 236 },
  APAC: { x: 856, y: 170 },
};
const ORDER = ["NORTHAMERICA", "LATAM", "EUROPE", "AMEA", "APAC"];

/* Dotted land borders between regions, for the territory overlay. */
const BORDERS = [
  "M168,150 L221,167",        // NA / LATAM
  "M640,55 L640,102 L618,112", // Europe / unassigned Siberia + APAC (Urals)
  "M643,140 L644,169",        // AMEA / APAC
];

/* ========================= fill computation ======================== */

const FIELD = "#0F1116";
const RAMP_LO = [26, 29, 38];    // #1A1D26, blind
const RAMP_HI = [239, 231, 207]; // --lit #EFE7CF, confident

function measuredFill(m) {
  if (!m || m.sample_too_small || m.estimate_rate_pct == null) return null;
  const conf = m.median_confidence == null ? 0 : Number(m.median_confidence);
  const v = Math.max(0, Math.min(1, (Number(m.estimate_rate_pct) / 100) * conf));
  const c = RAMP_LO.map((lo, i) => Math.round(lo + (RAMP_HI[i] - lo) * v));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const COST_RANK = { free: 0, low: 1, included: 2, owned: 2, paid: 3, enterprise: 4 };
const LEVEL_N = { strong: 3, partial: 2, weak: 1, none: 0 };

/* ============================= helpers ============================= */

function ownersFor(env) {
  // The territory overlay reads owners from the accounts table (the
  // queue's own source). If the read fails the overlay is omitted
  // rather than invented.
  return env?.DB?.prepare(
    "SELECT region, owner, COUNT(*) AS n FROM accounts WHERE archived_at IS NULL GROUP BY region, owner ORDER BY n DESC"
  ).all()
    .then(({ results }) => {
      const map = {};
      for (const r of results || []) {
        if (!r.region) continue;
        (map[r.region] = map[r.region] || []).push({ owner: r.owner || null, n: r.n });
      }
      return map;
    })
    .catch(() => null);
}

function causeLabel(T, key, fallback) {
  const k = `cvg.cause.${key}`;
  const s = T(k);
  return s === k ? (fallback || key) : s;
}

function costWord(T, cost) {
  const k = `cvg.cost.${cost}`;
  const s = T(k);
  return s === k ? String(cost || "") : s;
}

function fmtPct(n) {
  if (n == null) return null;
  const v = Number(n);
  return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}

function fmtConf(n) {
  if (n == null) return null;
  return String(Number(n).toFixed(2));
}

/* ======================== the field (SVG) ========================== */

function labelBlock(region, r, T, wiredLevel, owners) {
  const { x, y } = LABELS[region];
  const m = r.measured;
  const name = T(`cvg.r.${region}`);
  const line2 = m.sample_too_small
    ? T("cvg.lblN", { a: m.assessed, t: m.total_accounts })
    : T("cvg.lblAssessed", { a: m.assessed, t: m.total_accounts });
  const line3t = m.sample_too_small
    ? T("cvg.lblFloor", { min: r.minSample })
    : T("cvg.lblRate", { rate: fmtPct(m.estimate_rate_pct) ?? "" });
  const line3w = T("cvg.lblProjected", { level: T(`cov.${wiredLevel}`) });

  const terr = (owners || []).slice(0, 3).map((o, i) =>
    `<text class="cm-terr terr" x="${x}" y="${y + 42 + i * 12}">${esc(
      `${o.owner ?? T("cvg.unassigned")} · ${o.n} ${T("cvg.accts")}`
    )}</text>`
  ).join("");
  const more = (owners || []).length > 3
    ? `<text class="cm-terr terr" x="${x}" y="${y + 42 + 36}">${esc(T("src.nMore", { n: owners.length - 3 }))}</text>`
    : "";

  return `<g class="cm-lbl" data-region="${region}" aria-hidden="true">
    <text class="cm-name" x="${x}" y="${y}">${esc(name)}</text>
    <text class="cm-n" x="${x}" y="${y + 14}">${esc(line2)}</text>
    <text class="cm-l3 l3t" x="${x}" y="${y + 28}">${esc(line3t)}</text>
    <text class="cm-l3 l3w" x="${x}" y="${y + 28}">${esc(line3w)}</text>
    ${terr}${more}
  </g>`;
}

function regionGroup(region, r, T, wired, delayMs, outlineOnly) {
  const shape = SHAPES[region];
  if (!shape) return "";
  const id = `cvs-${region}`;
  if (outlineOnly) {
    return `<path d="${shape}" class="cm-outline" aria-hidden="true"/>`;
  }
  const m = r.measured;
  const fill = measuredFill(m);
  const wiredLevel = wired[region] || "none";
  const projText = T("cvg.ariaProjected", { level: T(`cov.${wiredLevel}`) });
  const aria = m.sample_too_small
    ? T("cvg.ariaSmall", {
        name: T(`cvg.r.${region}`), assessed: m.assessed, total: m.total_accounts,
        min: r.minSample, proj: projText,
      })
    : T("cvg.ariaFull", {
        name: T(`cvg.r.${region}`), assessed: m.assessed, total: m.total_accounts,
        estimated: m.estimated, rate: String(m.estimate_rate_pct ?? ""),
        conf: fmtConf(m.median_confidence) ?? "", proj: projText,
      });

  const today = fill
    ? `<use href="#${id}" class="cm-ly ly-t cm-fill" style="fill:${fill}"/>`
    : `<use href="#${id}" class="cm-ly ly-t cm-hatch"/>`;
  const wiredUse = `<use href="#${id}" class="cm-ly ly-w cm-proj cm-proj-${LEVEL_N[wiredLevel] ?? 0}"/>`;

  return `<g class="rgn" data-region="${region}" style="--d:${delayMs}ms">
    <defs><path id="${id}" d="${shape}"/></defs>
    ${today}
    ${wiredUse}
    <use href="#${id}" class="hit" data-region="${region}" tabindex="0" role="button"
      aria-pressed="false" aria-label="${esc(aria)}"/>
  </g>`;
}

function fieldSvg(data, T, wired, ownersMap, outlineOnly) {
  const defs = `<defs>
    <pattern id="cv-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="7" height="7" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="7" stroke="#2A2E3A" stroke-width="1.4"/>
    </pattern>
    <pattern id="cv-pj3" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="rgba(139,147,184,.66)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(211,217,238,.30)" stroke-width="1"/>
    </pattern>
    <pattern id="cv-pj2" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="rgba(139,147,184,.36)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(211,217,238,.20)" stroke-width="1"/>
    </pattern>
    <pattern id="cv-pj1" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="rgba(139,147,184,.16)"/>
      <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(211,217,238,.12)" stroke-width="1"/>
    </pattern>
    <pattern id="cv-pj0" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="rgba(139,147,184,.05)"/>
    </pattern>
  </defs>`;

  const byRegion = new Map((data?.regions || []).map((r) => [r.region, r]));
  const minSample = data?.min_sample ?? 5;

  const groups = ORDER.map((region, i) => {
    const r = byRegion.get(region);
    if (!r) return `<path d="${SHAPES[region]}" class="cm-outline" aria-hidden="true"/>`;
    return regionGroup(region, { ...r, minSample }, T, wired, i * 40, outlineOnly);
  }).join("\n");

  const labels = outlineOnly ? "" : ORDER.map((region) => {
    const r = byRegion.get(region);
    if (!r) return "";
    return labelBlock(region, { ...r, minSample }, T, wired[region] || "none", ownersMap?.[region]);
  }).join("\n");

  const borders = ownersMap
    ? BORDERS.map((d) => `<path d="${d}" class="cm-border terr" aria-hidden="true"/>`).join("")
    : "";

  return `<svg class="cov-map" viewBox="0 0 960 470" role="group" aria-label="${esc(T("cvg.mapAria"))}" preserveAspectRatio="xMidYMid meet">
    ${defs}
    <path d="${SIBERIA}" class="cm-outline" aria-hidden="true"/>
    ${groups}
    ${borders}
    ${labels}
  </svg>`;
}

/* ============================ the rail ============================= */

function causesList(T, measured) {
  const entries = Object.entries(measured.abstain_causes || {})
    .sort((a, b) => b[1].count - a[1].count);
  if (!entries.length || !measured.abstained) return "";
  const rows = entries.map(([key, c]) => {
    const w = Math.round((c.count / measured.abstained) * 100);
    return `<li class="cv-cause">
      <span class="cv-cause-l">${esc(causeLabel(T, key, c.label))}</span>
      <span class="cv-cause-n mono">${c.count}</span>
      <span class="cv-cause-bar" aria-hidden="true"><i style="width:${w}%"></i></span>
    </li>`;
  }).join("");
  return `<div class="cv-block">
    <span class="t-label cv-block-l">${esc(T("cvg.absTitle"))}</span>
    <ul class="cv-causes">${rows}</ul>
  </div>`;
}

function liftList(T, r) {
  const sources = (r.projected?.volume_sources || []).slice()
    .sort((a, b) =>
      (b.addressable_count - a.addressable_count) ||
      ((COST_RANK[a.cost] ?? 9) - (COST_RANK[b.cost] ?? 9)) ||
      ((LEVEL_N[b.coverage_level] ?? 0) - (LEVEL_N[a.coverage_level] ?? 0)));

  const m = r.measured;
  const intro = m.sample_too_small && sources.length
    ? `<p class="cv-lift-intro">${esc(T("cvg.liftFirst"))}</p>` : "";

  const items = sources.length ? sources.map((s) => {
    const lvl = level(LEVEL_N[s.coverage_level] ?? 0, 3, T(`cov.${s.coverage_level}`), { tone: "mute" });
    const move = !m.sample_too_small && s.addressable_count > 0
      ? `<span class="cv-lift-move">${esc(T("cvg.liftMove", { n: s.addressable_count, m: m.abstained }))}</span>`
      : "";
    return `<li class="cv-lift">
      <span class="cv-lift-top"><span class="cv-lift-name">${esc(s.source_name)}</span>
      <span class="cv-lift-cost">${esc(costWord(T, s.cost))}</span></span>
      <span class="cv-lift-sub">${lvl}${move}</span>
    </li>`;
  }).join("") : "";

  const body = sources.length
    ? `<ul class="cv-lifts">${items}</ul>`
    : `<p class="cv-lift-intro">${esc(T("cvg.liftNone"))}</p>`;

  return `<div class="cv-block">
    <span class="t-label cv-block-l">${esc(T("cvg.liftTitle"))}</span>
    ${intro}${body}
  </div>`;
}

function regionPanel(T, r, minSample) {
  const m = r.measured;
  const small = m.sample_too_small;
  const stateMark = small
    ? mark("hatch", T("cvg.mkBelowFloor", { min: minSample }), { tone: "held" })
    : mark("filled", T("cvg.mkMeasured"), { tone: "ink" });

  const stats = statRow([
    { label: T("cvg.stAssessed"), value: `${m.assessed}<span class="u"> / ${m.total_accounts}</span>` },
    { label: T("cvg.stEstimates"), value: String(m.estimated) },
    {
      label: T("cvg.stRate"),
      value: small ? null : esc(fmtPct(m.estimate_rate_pct) ?? ""),
      note: small
        ? (m.assessed === 0 ? T("cvg.noteNoRuns") : T("cvg.noteSmall", { min: minSample }))
        : undefined,
    },
    {
      label: T("cvg.stConf"),
      value: small ? null : esc(fmtConf(m.median_confidence) ?? ""),
      note: small
        ? (m.assessed === 0 ? T("cvg.noteNoRuns") : T("cvg.noteSmallConf"))
        : undefined,
    },
  ]);

  return `<section class="cov-panel" data-panel="${esc(r.region)}" hidden>
    <header class="cv-head">
      <div>
        <span class="t-label cv-eyebrow">${esc(T("cvg.railRegion"))}</span>
        <h2 class="t-section">${esc(T(`cvg.r.${r.region}`))}</h2>
      </div>
      ${btn(T("cvg.clear"), { kind: "text", action: "cov:clear", size: "sm" })}
    </header>
    <div class="cv-mark">${stateMark}</div>
    ${stats}
    ${causesList(T, m)}
    ${liftList(T, r)}
    <div class="cv-foot">
      ${btn(T("cvg.viewAccounts"), { kind: "text", href: `/?region=${esc(r.region)}` })}
    </div>
  </section>`;
}

function overallPanel(T, data, dayOneEmpty) {
  const m = data.overall.measured;
  const latam = (data.regions || []).find((r) => r.region === "LATAM");
  const unassigned = data.overall.accounts_with_unassigned_region;

  const stats = statRow([
    { label: T("cvg.stAssessed"), value: `${m.assessed}<span class="u"> / ${m.total_accounts}</span>` },
    { label: T("cvg.stEstimates"), value: String(m.estimated) },
    { label: T("cvg.stAbstained"), value: String(m.abstained) },
    {
      label: T("cvg.stRate"),
      value: m.sample_too_small ? null : esc(fmtPct(m.estimate_rate_pct) ?? ""),
      note: m.sample_too_small ? T("cvg.noteSmall", { min: data.min_sample }) : undefined,
    },
  ]);

  const empty = dayOneEmpty
    ? `<div class="f-empty"><p>${esc(T("cvg.emptyBody"))}</p>${btn(T("cvg.openQueue"), { kind: "text", href: "/" })}</div>`
    : "";

  const body = dayOneEmpty ? "" : `
    <p class="cv-sentence">${esc(T("cvg.overallSentence", {
      estimated: m.estimated, assessed: m.assessed, abstained: m.abstained,
    }))}</p>
    ${causesList(T, m)}
    ${latam ? `<p class="cv-latam">${esc(T("cvg.latamLine", {
      a: latam.measured.assessed, t: latam.measured.total_accounts,
    }))}</p>` : ""}
    ${unassigned > 0 ? `<p class="cv-unassigned">${esc(T("cvg.unassignedRegion", { n: unassigned }))}</p>` : ""}
    <p class="cv-argument">${esc(T("cvg.argument"))}</p>
    <p class="cv-hint">${esc(T("cvg.railHint"))}</p>`;

  return `<section class="cov-panel" data-panel="ALL">
    <header class="cv-head">
      <div>
        <span class="t-label cv-eyebrow">${esc(T("nav.coverage"))}</span>
        <h2 class="t-section">${esc(T("cvg.railAll"))}</h2>
      </div>
    </header>
    ${stats}
    ${empty}${body}
  </section>`;
}

/* ============================= render ============================== */

export async function render(env, data, ctx) {
  const T = ctx.t;
  const valid = data && Array.isArray(data.regions) && data.overall?.measured;
  const wired = {};
  for (const c of coverageByRegion(false)) wired[c.region] = c.level;

  if (!valid) {
    // Endpoint failure: outline-only geography, the error in words, a
    // retry. Never a blank dark rectangle, never a pretend fill.
    return `
    <div class="whead">
      <div class="whead-t"><h1 class="t-title">${esc(T("nav.coverage"))}</h1></div>
      <div class="whead-a">${btn(T("cvg.sourcesBtn"), { kind: "quiet", href: "/sources" })}</div>
    </div>
    <div class="cov-wrap">
      <p class="f-error">${esc(T("cvg.errBody"))} ${btn(T("cvg.retry"), { kind: "text", href: "/coverage" })}</p>
      <div class="cov-field cov-field-err">
        ${fieldSvg(null, T, wired, null, true)}
      </div>
    </div>`;
  }

  const ownersMap = await ownersFor(env);
  const om = data.overall.measured;
  const dayOneEmpty = om.assessed === 0;
  const minSample = data.min_sample ?? 5;

  const caption = esc(T("cvg.modeCaption")) +
    (dayOneEmpty ? " " + esc(T("cvg.modeCaptionEmpty")) : "");

  const panels = [
    overallPanel(T, data, dayOneEmpty),
    ...ORDER.map((code) => {
      const r = (data.regions || []).find((x) => x.region === code);
      return r ? regionPanel(T, r, minSample) : "";
    }),
  ].join("\n");

  return `
  <div class="whead">
    <div class="whead-t">
      <h1 class="t-title">${esc(T("nav.coverage"))}</h1>
      <span class="whead-meta">${esc(T("cvg.metaLine", {
        assessed: om.assessed, total: om.total_accounts,
        estimated: om.estimated, abstained: om.abstained,
      }))}</span>
    </div>
    <div class="whead-a">${btn(T("cvg.sourcesBtn"), { kind: "quiet", href: "/sources" })}</div>
  </div>

  <div class="cov-wrap">
    <div class="cov-grid">
      <div class="cov-main">
        <div class="cov-field">
          <div class="cov-ctl">
            <div class="cov-modes" role="group">
              <button type="button" class="cov-tab on" data-mode="today" aria-pressed="true">${esc(T("w.today"))}</button>
              <button type="button" class="cov-tab" data-mode="wired" aria-pressed="false">${esc(T("w.wired"))}</button>
            </div>
            ${ownersMap ? `<button type="button" class="cov-terr-btn" aria-pressed="false">${esc(T("cvg.territories"))}</button>` : ""}
          </div>
          <p class="cov-caption">${caption}</p>
          ${fieldSvg(data, T, wired, ownersMap, false)}
        </div>
        <div class="cov-legend">
          ${mark("filled", T("cvg.legendFill"), { tone: "ink" })}
          ${mark("hatch", T("cvg.legendHatch", { min: minSample }), { tone: "held" })}
          ${mark("dashed", T("cvg.legendDash"), { tone: "mute" })}
        </div>
      </div>
      <aside class="cov-rail">${panels}</aside>
    </div>
  </div>`;
}

/* =============================== css =============================== */

export function css() {
  return `
.p-coverage .cov-wrap { margin-top: 24px; }
.p-coverage .cov-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; }
.p-coverage .cov-main { min-width: 0; }

/* ---- the field: the product's one dark surface ---- */
.p-coverage .cov-field {
  --field: #0F1116; --lit: #EFE7CF; --proj: #8B93B8;
  background: var(--field); border-radius: 6px; padding: 16px 20px 12px;
}
.p-coverage .cov-ctl { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.p-coverage .cov-modes { display: flex; gap: 16px; }
.p-coverage .cov-tab {
  background: none; border: none; padding: 4px 2px 6px; cursor: pointer;
  font: 600 13px/1.3 var(--sans); color: #8B90A3;
}
.p-coverage .cov-tab:hover { color: #D6D9E4; }
.p-coverage .cov-tab.on { color: var(--lit); box-shadow: inset 0 -2px 0 var(--lit); }
.p-coverage .cov-tab:focus-visible { outline-color: var(--lit); }
.p-coverage .cov-terr-btn {
  background: none; cursor: pointer; height: 28px; padding: 0 10px;
  border: 1px solid #2A2E3A; border-radius: 6px;
  font: 500 12px/1 var(--sans); color: #8B90A3;
  transition: color .12s var(--ease), border-color .12s var(--ease);
}
.p-coverage .cov-terr-btn:hover { color: #D6D9E4; border-color: #454B5E; }
.p-coverage .cov-terr-btn[aria-pressed="true"] { color: var(--lit); border-color: #454B5E; }
.p-coverage .cov-terr-btn:focus-visible { outline-color: var(--lit); }
.p-coverage .cov-caption { margin: 4px 0 8px; font: 400 12px/1.5 var(--sans); color: #6E7488; max-width: 72ch; }

.p-coverage .cov-map { width: 100%; height: auto; display: block; }

/* region layers: today and wired stacked, crossfaded 240ms with the
   west-to-east stagger (--d per region). Reduced motion kills the
   transition globally in the foundation sheet. */
.p-coverage .cm-ly { transition: opacity .24s var(--ease); transition-delay: var(--d, 0ms); }
.p-coverage .ly-w { opacity: 0; }
.p-coverage .cov-field.mode-wired .ly-w { opacity: 1; }
.p-coverage .cov-field.mode-wired .ly-t { opacity: 0; }

.p-coverage .cm-fill { stroke: rgba(239,231,207,.14); stroke-width: 1; }
.p-coverage .cm-hatch {
  fill: url(#cv-hatch);
  stroke: #3A3F4E; stroke-width: 1; stroke-dasharray: 3 3;
}
.p-coverage .cm-proj { stroke: var(--proj); stroke-width: 1; stroke-dasharray: 4 3; }
.p-coverage .cm-proj-3 { fill: url(#cv-pj3); }
.p-coverage .cm-proj-2 { fill: url(#cv-pj2); }
.p-coverage .cm-proj-1 { fill: url(#cv-pj1); }
.p-coverage .cm-proj-0 { fill: url(#cv-pj0); }
.p-coverage .cm-outline { fill: none; stroke: #232733; stroke-width: 1; }

/* the interactive skin: hover rim at 40 percent, selection at full,
   everything else dims 20 percent while one region is selected */
.p-coverage .hit { fill: none; stroke: transparent; stroke-width: 1; pointer-events: all; cursor: pointer; }
.p-coverage .hit:hover { stroke: rgba(239,231,207,.4); }
.p-coverage .hit:focus-visible { outline: none; stroke: var(--lit); stroke-width: 1.2; }
.p-coverage .rgn.sel .hit { stroke: var(--lit); stroke-width: 1.2; }
.p-coverage .rgn { transition: opacity .18s var(--ease); }
.p-coverage .cov-map.has-sel .rgn:not(.sel) { opacity: .8; }
.p-coverage .cm-lbl { cursor: pointer; }

/* printed label blocks: the anti-area device. Always on the field. */
.p-coverage .cm-name {
  font: 600 10px var(--mono); letter-spacing: .08em; text-transform: uppercase;
  fill: #C7CCDA;
}
.p-coverage .cm-n { font: 400 10px var(--mono); fill: #8B90A3; }
.p-coverage .cm-l3 { font: 400 10px var(--mono); fill: #7E8598; transition: opacity .24s var(--ease); }
.p-coverage .l3w { opacity: 0; }
.p-coverage .cov-field.mode-wired .l3w { opacity: 1; }
.p-coverage .cov-field.mode-wired .l3t { opacity: 0; }

/* territory overlay: static show/hide, no motion */
.p-coverage .terr { visibility: hidden; }
.p-coverage .cov-field.terr-on .terr { visibility: visible; }
.p-coverage .cm-terr { font: 400 9px var(--mono); fill: #6E7488; }
.p-coverage .cm-border { fill: none; stroke: #454B5E; stroke-width: 1; stroke-dasharray: 1 3; }

.p-coverage .cov-legend {
  display: flex; gap: 24px; flex-wrap: wrap; margin-top: 12px;
  padding-top: 12px; border-top: 1px solid var(--line);
}
.p-coverage .cov-legend .mk { font-size: 12px; white-space: normal; }

/* ---- the rail, on paper ---- */
.p-coverage .cov-rail { min-width: 0; }
.p-coverage .cov-panel { border-top: 1px solid var(--line); padding-top: 12px; }
.p-coverage .cv-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.p-coverage .cv-eyebrow { display: block; color: var(--ink-3); margin-bottom: 4px; }
.p-coverage .cv-mark { margin-top: 8px; }
.p-coverage .cov-panel .statrow { margin-top: 16px; flex-wrap: wrap; row-gap: 16px; }
.p-coverage .cov-panel .stat { flex: 1 1 40%; padding: 0 16px; }
.p-coverage .cov-panel .stat:nth-child(odd) { padding-left: 0; border-left: 0; }
.p-coverage .cov-panel .stat-v { font-size: 20px; }

.p-coverage .cv-sentence { margin-top: 16px; font: 400 14px/1.55 var(--sans); color: var(--ink-1); }
.p-coverage .cv-latam { margin-top: 12px; font: 400 13px/1.55 var(--sans); color: var(--ink-2); }
.p-coverage .cv-unassigned { margin-top: 8px; font: 400 12px/1.5 var(--sans); color: var(--ink-3); }
.p-coverage .cv-argument { margin-top: 12px; font: 500 13px/1.55 var(--sans); color: var(--ink-1); }
.p-coverage .cv-hint { margin-top: 12px; font: 400 12px/1.5 var(--sans); color: var(--ink-3); }
.p-coverage .cov-panel .f-empty { margin-top: 16px; }

.p-coverage .cv-block { margin-top: 20px; }
.p-coverage .cv-block-l { display: block; color: var(--ink-3); margin-bottom: 8px; }
.p-coverage .cv-causes { list-style: none; margin: 0; padding: 0; }
.p-coverage .cv-cause {
  display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px 10px;
  padding: 6px 0; border-bottom: 1px solid var(--line);
}
.p-coverage .cv-cause-l { font: 400 12px/1.45 var(--sans); color: var(--ink-2); }
.p-coverage .cv-cause-n { font-size: 12px; color: var(--ink-1); text-align: right; align-self: start; }
.p-coverage .cv-cause-bar { grid-column: 1 / -1; height: 3px; background: var(--well); border-radius: 1px; }
.p-coverage .cv-cause-bar i { display: block; height: 100%; border-radius: 1px; background: color-mix(in srgb, var(--held) 45%, transparent); }

.p-coverage .cv-lift-intro { font: 400 12px/1.5 var(--sans); color: var(--ink-2); margin-bottom: 8px; max-width: 44ch; }
.p-coverage .cv-lifts { list-style: none; margin: 0; padding: 0; }
.p-coverage .cv-lift { padding: 8px 0; border-bottom: 1px solid var(--line); }
.p-coverage .cv-lift-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.p-coverage .cv-lift-name { font: 500 13px/1.45 var(--sans); color: var(--ink-1); }
.p-coverage .cv-lift-cost { font: 400 11px/1.3 var(--mono); color: var(--ink-3); flex: none; }
.p-coverage .cv-lift-sub { display: flex; align-items: center; gap: 12px; margin-top: 2px; flex-wrap: wrap; }
.p-coverage .cv-lift-sub .mk { font-size: 12px; }
.p-coverage .cv-lift-move { font: 400 12px/1.45 var(--sans); color: var(--ink-2); }

.p-coverage .cv-foot { margin-top: 16px; }
.p-coverage .f-error { margin-bottom: 16px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.p-coverage .cov-field-err { padding: 20px; }

@media (max-width: 1000px) {
  .p-coverage .cov-grid { grid-template-columns: minmax(0, 1fr); }
  .p-coverage .cov-rail { border-top: 1px solid var(--line); padding-top: 24px; }
  .p-coverage .cov-panel { border-top: none; padding-top: 0; }
}
@media (max-width: 720px) {
  .p-coverage .cov-field { padding: 12px 12px 8px; }
  .p-coverage .cov-legend { gap: 12px; }
}
`;
}

/* ============================== script ============================= */

export function script() {
  return `(() => {
  "use strict";
  const init = () => {
    const root = document.querySelector("main.p-coverage");
    if (!root) return;
    const field = root.querySelector(".cov-field");
    const svg = root.querySelector(".cov-map");
    if (!field || !svg) return;
    const panels = Array.from(root.querySelectorAll(".cov-panel"));
    const hits = Array.from(svg.querySelectorAll(".hit"));
    const rgns = Array.from(svg.querySelectorAll(".rgn"));
    const codes = rgns.map((g) => g.dataset.region);
    let sel = null;

    const setMode = (m) => {
      field.classList.toggle("mode-wired", m === "wired");
      root.querySelectorAll(".cov-tab").forEach((b) => {
        const on = b.dataset.mode === m;
        b.classList.toggle("on", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    };

    const select = (code) => {
      sel = code && codes.includes(code) ? code : null;
      svg.classList.toggle("has-sel", !!sel);
      rgns.forEach((g) => g.classList.toggle("sel", g.dataset.region === sel));
      hits.forEach((h) => h.setAttribute("aria-pressed", h.dataset.region === sel ? "true" : "false"));
      panels.forEach((p) => { p.hidden = p.dataset.panel !== (sel || "ALL"); });
    };

    root.addEventListener("click", (e) => {
      const tab = e.target.closest(".cov-tab");
      if (tab) { setMode(tab.dataset.mode); return; }
      const terr = e.target.closest(".cov-terr-btn");
      if (terr) {
        const on = terr.getAttribute("aria-pressed") !== "true";
        terr.setAttribute("aria-pressed", on ? "true" : "false");
        field.classList.toggle("terr-on", on);
        return;
      }
      const region = e.target.closest("[data-region]");
      if (region && svg.contains(region)) {
        const code = region.dataset.region;
        select(code === sel ? null : code);
      }
    });

    svg.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = e.target.closest ? e.target.closest(".hit") : null;
      if (!hit) return;
      e.preventDefault();
      const code = hit.dataset.region;
      select(code === sel ? null : code);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !sel) return;
      if (document.querySelector("dialog[open]") || document.querySelector(".menu:not([hidden])")) return;
      e.preventDefault();
      select(null);
    });

    document.addEventListener("floor:action", (e) => {
      if (e.detail && e.detail.action === "cov:clear") select(null);
    });

    const q = new URLSearchParams(location.search).get("region");
    if (q) select(q.toUpperCase());
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();`;
}
