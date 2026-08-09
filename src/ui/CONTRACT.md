# The page-module contract

Read `docs/DESIGN-SPEC.md` first. This file says only how the code is arranged so
that pages can be rebuilt independently without two authors ever editing the same
file.

There are six surfaces: Queue (`/`), Coverage, Accuracy (`/evals`), Case
(`/model`), Backlog and Settings, plus the account detail page at
`/account/:domain`. There were nine. Sources folded into Coverage and Day one
folded into Case, and `/sources` and `/wired` are 301s handled by the router, not
page modules. `page-sources.js` and `page-wired.js` are deleted; do not resurrect
either to reach content that now lives inside another page.

## Ownership, absolutely

| File | Owner | Anyone else |
|---|---|---|
| `src/index.js` | the router author only | never edit, never import into |
| `src/ui/kit.js` | the foundation author only | import freely, never edit |
| `public/static/floor.css` | the foundation author only | never edit |
| `public/static/floor.js` | the foundation author only | never edit |
| `src/ui/page-*.js` | one author each | never edit another page |
| `src/lib/i18n.js` | the router author only | **do not edit.** Export your copy from your own page module instead, see below |
| `src/lib/*.js` (db, scoring, pipeline, sources, coverage, edgar, companies_house, truth, accuracy, mutations) | nobody, a page rebuild is presentation only | read to understand, do not change |

If your page needs something from `kit.js` that does not exist, do **not** define a
local copy and do **not** edit the kit. Say so in your report. A second gauge
implementation is the thing this rebuild exists to remove.

**Your copy lives in your own file.** Export a `keys` object from your page module
and the router merges it into the dictionary before rendering:

```js
export const keys = {
  "queue.title":  { en: "Work queue", es: "Cola de trabajo" },
  "queue.empty":  { en: "No accounts yet.", es: "Aun no hay cuentas." },
};
```

This exists so several page authors can work at the same time without two of them
writing to `i18n.js` at once and silently dropping each other's keys. Every string
a user can read is a key, in both languages, with no literal copy anywhere in a
page module. Reuse an existing key from `i18n.js` when one already says what you
mean; only add what is genuinely new to your page.

## What a page module exports

```js
export const meta = {
  route: "/coverage",        // path the router binds
  nav:   "/coverage",        // which nav item lights up
  titleKey: "nav.coverage",  // i18n key for <title>
};

/** Page-scoped CSS, inlined into <head> after the foundation stylesheet.
 *  Every selector MUST be prefixed with the page's scope class (see below). */
export function css(): string;

/** Page-scoped JS, inlined before /static/floor.js loads.
 *  Wrap in an IIFE. Never rely on load order beyond that. */
export function script(): string;

/** Return the <main> body only. The router wraps it in the shell.
 *  env   Worker env, for D1 reads if the router did not pre-fetch
 *  data  whatever the router passes for this route (see below)
 *  ctx   { lang, t }  always present, never optional */
export async function render(env, data, ctx): Promise<string>;
```

The router already fetches page data and hands it in. Do not query D1 from a page
module when `data` already carries what you need; the router's shape is listed per
route in `src/index.js`.

## CSS scoping, which is what keeps pages from fighting

The shell sets `<main class="p-coverage">` from the first path segment of
`meta.route`, and `p-queue` for `/`. Every rule in your `css()` starts with that
class:

```css
.p-coverage .registry { ... }       /* yes */
.registry { ... }                   /* no, leaks into every page */
```

Only the foundation stylesheet may define unprefixed rules. If you find yourself
wanting to restyle a kit primitive, that is a signal the primitive is wrong: report
it rather than override it locally.

## What `kit.js` provides

Import what you need. These are the only shared primitives; there are no others.

**Escaping and format.** Everything user-visible goes through `esc`. It also
normalises em dashes to commas, which is a hard rule of this product.

```js
esc(s)                       // escape + em-dash normalise. Use on EVERYTHING.
num(n)                       // 1234567 -> "1,234,567"
count(n)                     // 1234567 -> "1.2M"  (re-export of formatCount)
money(n, dp = 2)             // 0.2617 -> "$0.26"
pct(n)                       // 0.83 -> "83%"
dateISO(s)                   // safe YYYY-MM-DD, "" when absent
host(url)                    // "www.sec.gov/x" -> "sec.gov"
```

**Shell.** The router calls this, not you. Listed so you know what wraps your body.

```js
shell({ title, nav, path, mode, budget, body, css, script, lang, t })
```

**Layout, per §3.5. Three containers, and the default is no container.**

```js
section({ label, title, sub, actions, body })   // C0, the default. Hairline, no box.
well(bodyHtml, { tone })                        // C1, recessed. Inputs, verbatim payloads.
// C2 (overlay) is never built by hand: use dialog(), menu(), toast() below.
```

**Instruments.** The measurement vocabulary. Never re-implement these.

```js
gauge({ min, mid, max, floor, verdict, confidence, abstained }, t, { size })
// Log track. `size` is "row" (default) or "hero".
// Confidence drives bar solidity per spec 3.7 rule 1.
// abstained:true renders the dashed hollow slot, per rule 2. Pass it, do not fake it.

mark(kind, label, { tone })
// The ONLY way to render state. kind is one of:
//   "filled" | "half" | "hollow" | "hatch" | "level" | "dashed"
// A bare mark with no label is not allowed: a state is a mark plus a word.

level(n, of = 3, label)      // the bar-pair graded mark
statRow([{ label, value, note, mono }])   // §3.6 meter row, replaces the stat card
```

**Tables and rows.**

```js
table({ cols, rows, selectable, empty })
// cols: [{ key, label, align, width, mono }]
// rows: [{ id, href, cells: [...], accent, menu: [...] }]
// Emits the fixed 28px row menu button when `menu` is present, always rendered,
// never hover-only. Emits the checkbox column when selectable is true, and the
// bulk bar wires itself from /static/floor.js.

rowMenu([{ label, action, danger, href }])   // the C2 menu contents
```

**Controls, per §3.8. Three buttons, no fourth.**

```js
btn(label, { kind, action, href, size, danger })  // kind: "primary" | "quiet" | "text"
field({ id, label, value, hint, effect, type, suffix, options, error })
dialog({ id, title, body, confirm, danger })
tabs([{ href, label, count, on }])            // real text tabs, underline active
```

**Client helpers, available as globals from `/static/floor.js`.** Your `script()`
may call these; do not redefine them.

```js
Floor.post(path, body)         // fetch wrapper, returns parsed JSON, throws on !ok
Floor.toast(msg, { undo })     // bottom-left, 8s, carries an undo when given
Floor.flash(rowEl)             // 300ms accent hairline confirm
Floor.confirm({ title, body, danger })  // returns a promise<boolean>
Floor.replace(selector, html)  // in-place region swap
Floor.t(key, vars)             // resolved copy, from window.FLOOR_I18N
```

## Rules that are not negotiable

1. **No `location.reload()`.** Six of them are why the product feels dead. Every
   mutation updates its region in place and confirms with a flash or a toast.
2. **No hover-only control.** If it can be clicked it is visible at rest.
3. **Every object gets create, read, update, delete** before the page is done. The
   completeness matrix in `DESIGN-SPEC.md` §5.1 is the checklist for your page.
4. **Every destructive action confirms and, where the data allows, offers undo.**
5. **Both languages, always.** Render your page in `es` before you call it done.
   A layout that only works in English is not done; Spanish runs 15 to 25 percent
   longer.
6. **Nothing animates at rest.** The only loop permitted is the stage sweep while a
   job is genuinely running.
7. **No em dashes reach the screen.** `esc()` handles stored text; you are
   responsible for the copy you author.
8. **Every figure is deterministic or labelled a judgement.** If a number on your
   page is an assumption, the page says so.

## Done means

`node scripts/qa.mjs` passes, your page renders in both languages, every control in
it has been clicked, and every row in your slice of the §5.1 matrix is either built
or reported as deliberately deferred. A page that looks finished and has an
unreachable Edit is not finished; that exact bug is why this rebuild exists.

---

# Appendix: what `data` actually contains, per route

Captured from the live API on 2026-08-09, not inferred from the code. Build against
these shapes. Where a field can be `null`, it is `null` in production right now, so
render the absent case rather than assuming it away.

What a page receives is what its entry in the `PAGES` registry returns, which is
not always one bare API response. Coverage and Accuracy both compose several.
Read the registry in `src/index.js` before assuming an endpoint's shape is yours.

## `/` queue → `data` is `GET /api/queue`

```
settings { floor_txn, cooldown_days, search_usd, model_research, model_extract,
           model_critic, acv_usd }        // acv_usd is "" until an operator sets it
mode     "live" | "cached"
budget   { cap, spent, remaining }
counts   { work, soon, needs_evidence, suppressed, unscored }   // band -> count
cost     { total, per_account, assessed, total_accounts }
rows[]   38 today, already ranked and banded
```

A row, every field:

```
id, domain, name, region, owner            // region: NORTHAMERICA|EUROPE|APAC|LATAM|AMEA
last_touched_at                            // null on every row today. Cool-down input.
assessment_id, run_at, status              // status: "ok" | "abstained" | null
txn_min, txn_mid, txn_max                  // null when abstained
confidence                                 // 0..1. 0 when abstained.
abstained (0|1), abstain_reason            // reason is model-written, carries em dashes
method                                     // free text, how the figure was derived
cost_usd, latency_ms
fit_score, timing_score                    // null fit when abstained
cooldown_state                             // "never_touched" | ...
cooldown_until, cooldown_days_since        // null when never touched
floor_verdict                              // "clears" | "borderline" | "below" | "unknown"
total_score, band, band_label, band_order, rank
rank_reason                                // pre-composed sentence, carries em dashes
region_weight
signals[] { id, kind, description, url, observed_at, weight }
```

Real values to design against, not invented: 38 accounts, 19 assessed, 5
abstained. DoorDash `txn_mid` 258,700,000 with confidence 0.96, which the gauge
now accommodates and the QA gate asserts it still does; Allegro abstained with
`txn_*` all null, confidence 0, and a three-line `abstain_reason`; `observed_at`
on signals is sometimes a full date
(`2025-10-06`), sometimes a month (`2025-03`), sometimes a quarter (`2025-Q4`),
sometimes a bare year (`2022`), and sometimes `null`. Handle all five.

## `/account/:domain` → `data` is `GET /api/account/:domain`

`{ account, assessment, scored, evidence[], signals[], traces[], settings }`.
Traces are the per-stage record (model, tokens, cost, latency, stop reason) and
are the audit trail the trust argument rests on. `account.sec_cik` is the CIK when
the merchant resolved in EDGAR and `null` when it did not, with
`account.sec_checked_at` recording that the question was asked. A null CIK on a
checked account is a fact about the merchant, so do not offer an action that can
only fail on it.

Evidence rows arrive already classified: each carries `source_class { tier, label,
weight, matched, note }`, computed at render time from the operator's rules, so
editing a rule re-grades stored claims without a re-run.

## `/coverage` → `GET /api/coverage`, plus the source registry

```
generated_at, min_sample (5), note
overall  { label, measured{...}, headline, accounts_with_unassigned_region }
regions[5] { region, label, measured{...}, projected{...}, headline }
measured { total_accounts, assessed, sample_too_small, estimated, abstained,
           abstain_rate_pct, estimate_rate_pct, abstain_causes{}, derivation_mix{},
           median_confidence, evidence_quality{}, claims_surviving }
```

`sample_too_small` is authoritative: when true the region renders hatched outline
only and can never receive a fill, whatever its rate. LATAM and AMEA are still 0,
so the honest map is mostly dark. That is the argument, not a failure to hide.

The registry arrives on the same payload as `sourceRegistry`, because Coverage
absorbed the Sources page:

```
sourceRegistry.sources[10] { id, name, kind, cost, what, unlocks, limits,
                             coverage{}, status, holds_key, has_adapter,
                             needs_secret }
sourceRegistry { regions[5], connected (3), total (10), free_and_unwired,
                 coverage_now[5], coverage_wired[5], note }
```

`status` is **derived**, never read off the literal in `RAW_SOURCES`: it is
`connected` when the credential and an adapter both exist, `key_held` when only
the credential does, `available` otherwise. Render `status`, not `cost`, to say
whether something is wired. Classification rules still come separately from
`GET /api/source-rules`.

## `/evals` accuracy → several payloads at once

```
evals   { latest { id, run_at, n, n_scored, in_band, order_correct,
                   floor_correct, abstained }, items[], segments{} }
gold    { rows[11], total, verified, archived }
sources { [domain]: [{ url, host, title, field, primary, answers }] }  // unverified rows only
sec     { [domain]: { cik, checked } }
suggest { suggestions[], saturated, blind[] }
cost_per_account
```

`segments` carries `by_derivation`, `by_region`, `by_magnitude` and
`calibration`, each row `{ key, label, n, scored, abstained, sample_too_small,
need, floor_correct, in_band }`. Where `sample_too_small` is true, `floor_correct`
and `in_band` are `null` on purpose. Say what is needed (`need`), never print a
rate small.

A gold row now carries its provenance: `established_by` is `extraction` or
`human`, with `verbatim`, `raw_value`, `raw_period`, `period` and `truth_flags`
alongside. Flags are advisory and are shown, not swallowed; the commonest reads
"the period came from the filing type, not from the quoted sentence".

Current state, which is the state to design for: eleven gradable rows, six
established, one eval run scoring four merchants. Eleven further seeded rows are
archived and must never appear.

## `/backlog` → `GET /api/backlog`, with archived cards included

`{ areas[5], byArea{ SDR, Marketing, "Learning Ops", "Key Account Mgmt", Other },
total, live, archived[] }`. The page loader passes `includeArchived: true` so an
archived card can be restored from the interface, which means `byArea`, `total`
and `live` all count archived cards on this route and the page has to exclude
them itself. `GET /api/backlog` excludes them. Two callers, two answers, and the
one that matters is the one your page asked for.

## `/settings` → settings plus the cost context its consequence lines refer to

`{ settings, budget { spent, cap }, assessed, total_accounts, cost_per_account }`.
`settings` is the flat object, same keys as `queue.settings`, and `acv_usd` is
`""` until an operator sets it. `GET /api/settings` returns the flat object
alone; the page gets the rest so a consequence line can quote a real number
instead of a general claim.

## `/model` case

Consumes the queue payload plus authored argument copy. No separate endpoint. It
absorbed the old `/wired` day-one page, so the wired-state argument is a section
here rather than a route, and `/wired` 301s to `/model#wired`.
