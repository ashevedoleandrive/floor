/* Floor · page-wired.js — Day one, /wired
   ---------------------------------------------------------------------
   Static argument content: what changes when Floor is wired to a real
   stack instead of running on public web search alone. Per DESIGN-SPEC
   §4.8, the six systems render as one comparison list (system name,
   then an aligned Today / Wired pair sharing one label column), not six
   cards. Wired rows carry the projected dashed left rule (§3.7 rule 4:
   projected, not measured, renders dashed).

   Copy is carried over from the pre-rebuild src/lib/views.js for five of
   the six systems (Salesforce, Apollo, Sales Navigator, Gong Engage, the
   business-case tool). The sixth system is rebuilt: the old "paid
   traffic or volume provider" row is replaced with SEC EDGAR and the EU
   statutory registries, the two sources named explicitly in the brief as
   the free unwired sources that would close the most coverage. Facts for
   that row (free, US filers only / EU Accounting Directive, per-country
   integration) are pulled from the existing src/lib/sources.js registry
   entries (sec_edgar, eu_registries), not invented.

   No interactive controls on this page; script() is intentionally empty.
   --------------------------------------------------------------------- */

import { esc, num, section } from "./kit.js";

export const meta = {
  route: "/wired",
  nav: "/wired",
  titleKey: "nav.dayone",
};

export const keys = {
  "w.sysLabel": { en: "System by system", es: "Sistema por sistema" },
  "w.honestLabel": { en: "Scope and limits", es: "Alcance y límites" },
  "w.regs.name": {
    en: "SEC EDGAR & the EU statutory registries",
    es: "SEC EDGAR y los registros estatutarios de la UE",
  },
  "w.regs.now": {
    en: "Not connected. Both are free and public; wiring them is a couple of days of integration work, not a procurement cycle.",
    es: "No conectados. Ambos son gratis y públicos, conectarlos es un par de días de integración, no un ciclo de compras.",
  },
  "w.regs.later": {
    en: "US-listed merchants resolve from an exact filed figure instead of a search. In Europe, Yuno's second priority region, the EU Accounting Directive puts filed accounts behind a public registry per country (Germany's Bundesanzeiger, the Dutch Chamber of Commerce, France's Commercial Court), the single biggest coverage gain available anywhere in this system, for free. Neither reaches a private US company or fills LATAM, APAC or AMEA.",
    es: "Los comercios que cotizan en EE. UU. se resuelven con una cifra exacta presentada en lugar de una búsqueda. En Europa, la segunda región prioritaria de Yuno, la Directiva de Contabilidad de la UE pone las cuentas presentadas detrás de un registro público por país (el Bundesanzeiger en Alemania, la Cámara de Comercio en Holanda, el Tribunal de Comercio en Francia), la ganancia de cobertura más grande disponible en todo este sistema, y gratis. Ninguno de los dos llega a una empresa privada de EE. UU. ni llena LATAM, APAC o AMEA.",
  },
  "w.h0": {
    en: "Floor ranks the account universe you give it. It does not build one: today's {n} accounts were seeded by hand, and Apollo or Sales Navigator is what would generate that universe at Yuno's real scale.",
    es: "Floor clasifica el universo de cuentas que le das. No construye uno: las {n} cuentas de hoy se sembraron a mano, y Apollo o Sales Navigator serían lo que genere ese universo a la escala real de Yuno.",
  },
};

export async function render(env, data, ctx) {
  const { t } = ctx;
  const totalAccounts = data?.cost?.total_accounts ?? data?.rows?.length ?? 0;

  const systems = [
    { name: "Salesforce", now: t("w.sf.now"), later: t("w.sf.later") },
    { name: "Apollo", now: t("w.apollo.now"), later: t("w.apollo.later") },
    { name: "Sales Navigator", now: t("w.notUsed"), later: t("w.nav.later") },
    { name: "Gong Engage", now: t("w.notUsed"), later: t("w.gong.later") },
    { name: t("w.bc.name"), now: t("w.bc.now"), later: t("w.bc.later") },
    { name: t("w.regs.name"), now: t("w.regs.now"), later: t("w.regs.later") },
  ];

  const list = systems.map((s) => `
    <div class="w-sys">
      <h3 class="w-name t-section">${esc(s.name)}</h3>
      <div class="w-row">
        <span class="w-lbl t-label">${esc(t("w.today"))}</span>
        <p class="w-txt t-body">${esc(s.now)}</p>
      </div>
      <div class="w-row w-wired">
        <span class="w-lbl t-label">${esc(t("w.wired"))}</span>
        <p class="w-txt t-body">${esc(s.later)}</p>
      </div>
    </div>`).join("");

  const honest = [
    t("w.h0", { n: num(totalAccounts) }),
    t("w.h1"),
    t("w.h2"),
    t("w.h3"),
    t("w.h4"),
  ].map((line) => `<li>${esc(line)}</li>`).join("");

  const body = `
  <section class="w-hero">
    <span class="w-eyebrow t-label">${esc(t("w.eyebrow"))}</span>
    <h1 class="w-h1">${esc(t("w.title"))}</h1>
    <p class="w-lede t-body">${esc(t("w.lede"))}</p>
  </section>

  ${section({ label: t("w.sysLabel"), body: `<div class="w-list">${list}</div>` })}

  ${section({ label: t("w.honestLabel"), title: t("w.honestTitle"), body: `<ul class="w-honest">${honest}</ul>` })}
  `;

  return body;
}

export function css() {
  return `
    .p-wired .w-hero { padding: 8px 0 0; max-width: 760px; }
    .p-wired .w-eyebrow { color: var(--ink-3); display: block; margin-bottom: 12px; }
    .p-wired .w-h1 { font: 650 40px/1.08 var(--sans); letter-spacing: -.02em; margin: 0 0 16px; color: var(--ink-1); }
    .p-wired .w-lede { max-width: 68ch; color: var(--ink-2); }

    .p-wired .w-list { display: flex; flex-direction: column; gap: 32px; }
    .p-wired .w-sys { padding-top: 4px; }
    .p-wired .w-name { margin: 0 0 4px; color: var(--ink-1); }
    .p-wired .w-row {
      display: grid; grid-template-columns: 96px 1fr; column-gap: 16px;
      padding: 10px 0; border-top: 1px solid var(--line);
    }
    .p-wired .w-lbl { color: var(--ink-3); padding-top: 2px; }
    .p-wired .w-txt { margin: 0; max-width: 68ch; color: var(--ink-2); }
    .p-wired .w-wired .w-txt {
      border-left: 2px dashed var(--line-2); padding-left: 12px; color: var(--ink-1);
    }

    .p-wired .w-honest { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
    .p-wired .w-honest li {
      position: relative; padding-left: 18px; max-width: 64ch;
      color: var(--ink-2); font-size: 14px; line-height: 1.55;
    }
    .p-wired .w-honest li::before {
      content: ""; position: absolute; left: 0; top: 7px; width: 6px; height: 6px; background: var(--ink-3);
    }

    @media (max-width: 640px) {
      .p-wired .w-row { grid-template-columns: 72px 1fr; }
    }
  `;
}

export function script() {
  return "";
}
