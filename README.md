# Floor

**Which accounts, and when.**

Floor ranks a finite enterprise TAM so a small SDR team knows which merchants to
work this week and which to leave alone. It was built for the Yuno GTM Engineer
business case, against a payment orchestrator's real constraint: a finite set of
enterprise merchants worldwide, a 100,000 transactions per month qualification
floor, and five SDRs who cannot afford to spend thirty minutes researching an
account that was never winnable.

Live: https://floor.leandrive.workers.dev

---

## The problem it solves

Three of the gaps Yuno named are one failure:

- **Account prioritisation** is unsolved. Their words: "our #1 pain."
- **Research cannot be trusted.** AI-written briefs are unverified and reply
  rates are falling.
- **Nobody can see what is being built.**

Underneath all three: there is no verified, shared, dated view of the account
universe, so every SDR re-derives priority by hand each week and no two of them
agree.

And one gap they described but never named: across a finite TAM worked by five
people, there is **no suppression memory**. "The TAM is finite, so re-hitting the
same accounts hurts" was written as context for the prioritisation gap. It is a
gap in its own right, and it is the cheapest one on the board to close.

## What it does

Three dimensions, combined in code:

| Dimension | Question | Source |
|---|---|---|
| **Fit** | Does this merchant clear 100k transactions per month? | Public filings and disclosures |
| **Timing** | Is there a dated reason to contact them now? | Dated public events |
| **Cool-down** | Were they touched too recently to touch again? | Last-touch date, or CRM activity once wired |

The output is a ranked work queue, not a lookup. Paste a list of accounts with
their last-touched dates, get back an ordered queue with the reasoning on every
row and a Salesforce-shaped export.

## Why it can be trusted

This is the part that matters, and it is the part that does not change when the
data sources do.

**Every figure carries its source.** Value, source URL, method, and a
deterministic classification of what kind of source that is. A claim with no URL
is never emitted.

**A separate model tries to refute every claim.** The extractor produces claims;
a different, stronger model receives them alongside the raw research and is
instructed to disprove them. Anything it cannot tie back to the research is
dropped before it reaches the screen.

**It abstains out loud.** When the evidence will not carry an estimate, no
estimate is issued and the reason is stated. The abstain path is enforced in
code, not requested in a prompt, so it cannot be argued away by the thing being
checked.

**It grades itself against filings.** The eval runs against merchants whose
transaction or order volumes are **publicly disclosed**, so the accuracy claim is
checkable by anyone in the room rather than asserted at them. The answer key is
read out of the merchant's own filing: a narrow extractor transcribes one figure
from one named document, and the sentence it came from is stored and shown next
to the arithmetic that turned it into a monthly rate. Doubting a figure means
reading the quote and clicking through to the filing, which a human quietly
typing a number never allowed.

**The answer key is not allowed to convert.** A disclosure reading "776 million
Total Orders in Q3" recorded as monthly is wrong by exactly 3x, and a wrong
answer key is worse than none because it turns an honest "unmeasured" into a
confident lie. Five defences, four of them deterministic: the model reports the
figure, its scale word and its period as separate fields and converts nothing,
so code does every multiplication; the claimed period is checked against the
quote; the claimed scale word is checked against the quote, against the figure
being validated rather than the first number in the sentence; a quote naming no
period abstains, unless the document type establishes one, as annual filed
accounts do; and a disagreement with Floor's own estimate at almost exactly 3x,
4x or 12x is flagged as a suspected period confusion. Flagged, never rejected,
because discarding truth for disagreeing with the prediction is the circularity
the whole design exists to avoid.

**The arithmetic is not done by a model.** The model reads and cites. Scoring,
the floor comparison, the cool-down window and the ranking are plain code. Same
inputs, same answer, every time.

---

## Architecture

![Floor system map](docs/floor-system-map.png)

**Why three model calls instead of one prompt.** If one model did all of it, it
would be checking its own work and it would pass itself. Splitting them means the
thing doing the checking has no stake in the answer. This is not theoretical:
on the first production run every web search failed, the extractor reconstructed
seven confident claims from prior knowledge with fabricated URLs, and the critic
killed all seven and forced an abstain.

**Why a queue.** An assessment runs for minutes. A Cloudflare Worker request
will not hold a multi-minute model call open, and neither will `waitUntil`. The
fetch handler only enqueues; the consumer has room to run all three stages and
brings retries with it.

**Why streaming.** A non-streaming request that idles for minutes has its
connection dropped, and the job dies mid-stage with no error and no cost
recorded. Every model call streams, so bytes keep moving and the connection
stays alive.

### Stack

Cloudflare Workers, D1 (SQLite), Cloudflare Queues, Anthropic API. No frontend
framework, no build step, no external assets. The whole thing renders offline.

### Where the code lives

| File | What it holds |
|---|---|
| `src/index.js` | The router, the page registry, the API and the queue consumer |
| `src/lib/pipeline.js` | The three stages, and `finalise()`, where abstention is decided |
| `src/lib/scoring.js` | Fit, timing, cool-down, ranking. All of the arithmetic |
| `src/lib/edgar.js` | SEC EDGAR: CIK resolution and filing retrieval |
| `src/lib/companies_house.js` | UK Companies House: company resolution and the accounts PDF |
| `src/lib/truth.js` | Ground-truth extraction and the defences against the unit error |
| `src/lib/accuracy.js` | Eval segments, calibration, and what to verify next |
| `src/lib/sources.js` | The source registry, derived status, and URL classification |
| `src/lib/coverage.js` | Measured coverage per region |
| `src/lib/mutations.js` | Every operator write. Nothing here hard-deletes |
| `src/ui/` | One file per surface, plus the kit everything composes from |
| `migrations/` | `0001` through `0010_sec_cik.sql`, applied in order |

### How the interface is put together

One router, six surfaces, one shared vocabulary: Queue, Coverage, Accuracy,
Case, Backlog, Settings, plus the account detail page behind every row.

There were nine, eight of them in the nav. Sources folded into Coverage because
they answer one question, what this tool can see and how well, and the product
already argued in its own copy that coverage and measurability are one constraint
rather than two. Day one folded into Impact, which became Case, because both were
arguments about value split across two tabs, which is why neither felt essential.
A tab per capability for 38 accounts reads as over-built, and a tool earns trust
by being small and dense. `/sources` and `/wired` now 301 into the pages that
absorbed them, so shared links and bookmarks still land, and the QA gate checks
that they do.

Every page was then restructured to replace explanation with information. The
test applied to each removal was whether the page lost information or lost an
explanation of information already on screen, and where a paragraph came out a
real number usually went in. Settings went from 673 words to 313, one label, one
control and one consequence line per setting. The Queue's prose is now 6% of the
page and 93% of it is row data, which is what a work queue should be.

`src/index.js` holds a `PAGES` registry mapping each route to a page module and
that route's data loader, so **a page module never queries the database**. Every
surface is one file in `src/ui/`, owns its own CSS scoped to a page class, and
carries its own copy as an exported `keys` object the router merges before
rendering. Adding a page is one line in the registry and one new file.

Everything visual comes from a single kit (`src/ui/kit.js`) plus one stylesheet
and one client script (`public/static/floor.css`, `floor.js`). Pages compose kit
primitives and are not allowed to restyle them; a primitive that reads wrong is a
kit bug, not something to override locally. That constraint is what stops the
interface drifting back into a component-library texture, and it is enforced by
the QA gate rather than by good intentions.

Two rules the kit enforces in code rather than in review. `mark()` throws if
called without a label, so a state rendered in colour alone cannot ship. And no
mutation reloads the page: every write updates its region in place and confirms
with a row flash or a toast carrying its undo.

### Model routing

Deliberate, and stated on screen in the run trace:

| Stage | Model | Effort | Why |
|---|---|---|---|
| Research | Sonnet 5 | low | High-volume, mechanical gathering with web search |
| Extract | Sonnet 5 | low | Transcription with judgement, no lookups allowed |
| Critic | Opus 5 | high | Adversarial judgement on a small payload |
| Score | none | n/a | Arithmetic belongs in code |

Measured cost: **about $0.26 to $0.29 per account**, reported per stage in the
UI from real token counts rather than estimated.

---

## Operator-owned configuration

Everything an operator would want to change is changeable in the product,
because the people running this will not have access to whoever wrote it.

- **Qualification floor** (transactions per month)
- **Cool-down window** (days)
- **Source classification rules**, matched against the URL in order, first match
  wins. Add a registry, demote an aggregator, re-weight a tier, reorder them.
  Classification runs at render time, so editing a rule re-grades every claim
  already stored.
- **Model routing** per stage
- **Daily spend cap**, which degrades the app to cached results rather than
  erroring

Every change is recorded with its previous value, so "why did the queue change"
has an answer.

## Nothing here deletes

The governing rule, learned from a bug: **an action is only reversible if it is
reversible in the interface.** Disabling a classification rule used to make its
row vanish, which put the Enable button out of reach and turned a one-click
action into a permanent one. The data was intact in the database the whole time,
and that was worth nothing to the person clicking it.

So `src/lib/mutations.js` never hard-deletes. Archiving stamps a timestamp,
un-archiving clears it, and the row is whole throughout:

| Object | What you can do |
|---|---|
| Account | Edit name, region, owner and **last touched**; archive and restore |
| Assessment | Remove a bad run and the previous one takes over; restore it; read the full history |
| Gold-set row | Correct a figure, un-verify it, add a candidate, archive one, or establish it from the merchant's own filing |
| Backlog card | Move between idea, building and live; edit; archive |
| Classification rule | Edit, enable, disable, reorder, delete non-builtins |
| Setting | Change it, see what it was before, reset to default |

Two of those close gaps that were silently corrupting the product. `last_touched_at`
feeds the cool-down dimension of the score and could only ever be set at assess
time, so an account suppressed on a wrong date stayed wrongly suppressed. And a
mistyped gold-set figure was permanent, which quietly poisons the accuracy claim
the whole tool's credibility rests on. Verifying a gold row is now **refused**
unless both the figure and the source URL are present.

## Source strategy

Three sources are connected: web search with citations, SEC EDGAR, and UK
Companies House.

**SEC EDGAR, in two roles.** In an assessment it resolves a merchant to its CIK,
fetches the newest 10-Q, 10-K or 8-K, reduces it in code to the passages that
mention volume, and hands those to research as primary evidence before any search
runs. Research then spends its five searches on dated events instead of hunting
for a figure that was addressable all along. In accuracy it supplies the document
ground truth is extracted from. Order and transaction counts are not in XBRL,
which was checked rather than assumed, so what EDGAR contributes is authoritative
**documents** rather than structured numbers, and reading them is a separate job
under its own constraints.

**The resolver matches on the domain, not the name.** Names only shortlist; a
candidate is accepted once its own filing prints the domain. This exists because
"allegro.pl" prefix-matched ALLEGRO MICROSYSTEMS, a US semiconductor company, and
Floor would have read a chip maker's 10-Q as ground truth for a Polish
marketplace. Demanding an exact name instead lost Lululemon and Peloton, whose
legal names carry extra words, so names are wrong in both directions. Where no
filing prints a domain, which happens with foreign private issuers, an exact
legal name is still accepted at lower confidence and the weaker basis is reported
rather than hidden.

**UK Companies House reads filed accounts, which are PDF only.** Every UK limited
company files annual accounts publicly, and that is the only route to sizing a
private British merchant. The document API returns `application/pdf` and nothing
else, verified across four companies, so the PDF goes to the model as a document
block rather than through a parser, which would mean a build step this product
does not have. Everything downstream is identical. It establishes ASOS, which is
LSE-listed and therefore invisible to EDGAR.

**Source status is derived, not declared.** It used to be a constant typed into
the registry, so adding a credential changed nothing on screen. Status is now
computed from two things that are genuinely different: whether the credential
exists, and whether an adapter exists that reads the source. That gives three
states, `connected`, `key_held` and `available`, because holding a key with
nothing to call it is not connection.

The registry lives on Coverage now. It lists ten sources worth wiring, what each
unlocks, and per-region coverage. The largest remaining gain is the rest of the
**EU statutory registries** (Bundesanzeiger, KvK, and the others), which reach
private European merchants that publish nothing in the American sense. That is
one integration per country rather than one API, which is why Companies House
went first.

The point of that page is the durable claim: **provenance, adversarial checking,
abstention and a measured accuracy score make any source safe to sell on.** The
trust layer does not change when the sources improve.

---

## Running it

```bash
npm install
npx wrangler d1 create floor-db          # then put the id in wrangler.toml
npx wrangler d1 migrations apply floor-db --remote
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put COMPANIES_HOUSE_KEY  # optional, unlocks UK filed accounts
npx wrangler queues create floor-assess
npx wrangler deploy
```

EDGAR needs no credential. Companies House does, and the registry reports itself
as `available` rather than `connected` until the key is present, because status
is derived from what is actually reachable.

### Scripts

```bash
node scripts/qa.mjs                       # QA gate: API shapes, rendered pages,
                                          # client bindings, links, hygiene
node scripts/batch.mjs --limit 15         # batch-assess accounts via the live API
node scripts/batch.mjs --concurrency 3
```

**157 checks, currently 0 failing.** Every one of them exists because something
specific went wrong and a human found it rather than the gate.

It started as a binding check: the client looks up elements by id, the server
renders them from a different file, and renaming one side errors nothing, 404s
nothing, looks perfect, and silently kills a button. It now also checks:

- **Every class the markup repeats is defined in some stylesheet.** The Settings
  page once shipped with its entire layout class family undefined, so every
  label and hint collapsed into run-on text. The gate read 120 green at the time,
  because it was never fetching that page. Generalised, this check immediately
  found the same defect on four more pages.
- **Every page renders in both languages**, with untranslated keys detected
  against the real dictionary rather than by shape, since `doordash.com` and
  `nav.queue` look identical to a regex.
- **Nothing animates at rest**, `prefers-reduced-motion` is honoured, no page
  reloads on a mutation, and page CSS is scoped so one surface cannot restyle
  another.
- **The gauge accommodates the largest account.** It used to clamp at 100M
  against a real maximum of 288.9M, so the most impressive number in the dataset
  rendered as a clipped sliver with its marker off the bar.
- **Demo invariants**: the handful of facts a live demo stands on, including how
  many accounts exist, how many are assessed, how many abstained, and that no
  archived row leaks back into the gold set. This one has already earned itself
  twice, catching a test that left two merchants archived and another that
  stamped the top account as touched, dropping it from rank 1 to rank 17. Neither
  looked broken on screen, which is the entire point.
- **Retired tabs still resolve.** `/sources` and `/wired` must return a redirect,
  not a 404, because a link someone already shared has to keep landing.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Mode, budget, model routing, floor, cool-down |
| `GET /api/queue` | The ranked queue with scoring and cost |
| `POST /api/assess` | Enqueue an assessment, returns a job id |
| `GET /api/job/:id` | Job status and stage, plus the result when done |
| `POST /api/import` | Add accounts, bare domains or CSV |
| `GET /api/sources` | Source registry and per-region coverage |
| `GET /api/source-rules` | Classification rules and how many claims each matched |
| `POST /api/source-rules` | Add, edit, toggle or delete a rule |
| `POST /api/source-rules/reorder` | New order, first match wins so order decides the tier |
| `GET /api/coverage` | Measured coverage per region, and what wiring a source would reach |
| `GET /api/evals` · `POST /api/evals/run` | Accuracy against the gold set |
| `GET /api/gold` · `POST /api/gold` | Gold-set candidates and verification |
| `POST /api/gold/add` · `POST /api/gold/:id` | Add a candidate; correct or un-verify one |
| `GET /api/gold/suggest` | What to verify next, and allowed to return nothing |
| `GET /api/gold/sources/:domain` | The documents Floor already found for that row |
| `GET /api/edgar/:domain` | CIK, how it was confirmed, and the newest filings |
| `POST /api/truth/:domain` | Establish ground truth for a gold row from its filings |
| `POST /api/edgar-scan` | Resolve every unchecked gold-set merchant against EDGAR |
| `GET /api/backlog` · `POST /api/backlog` | The GTM Engineering backlog |
| `POST /api/backlog/:id` | Move a card between idea, building and live; edit it |
| `POST /api/account/:domain` | Edit name, region, owner or last touched |
| `POST /api/account/:domain/archive` · `/unarchive` | Archive and its undo |
| `POST /api/account/:domain/history` | Every run for an account, including removed ones |
| `POST /api/assessment/:id` · `/restore` | Remove a bad run, and put it back |
| `GET /api/settings/history` | Who changed a setting, when, and what it was |
| `POST /api/ingest` | Accept an assessment run outside the Worker |
| `GET /api/export.csv` | Salesforce-shaped export |

Reads are `GET`, anything that changes state is a `POST` with the action in the
path, so a mutation can never be triggered by following a link or by a crawler.
Validation failures return `400` as `{ok:false, field, error}` so the interface
can render the message under the field it names.

## Honest limits

- **Coverage is the real constraint, not accuracy.** Public filers are well
  served, and a private UK company is now reachable through its filed accounts.
  Everywhere else, private companies abstain, and that is most of the mid-market.
  The fix is the rest of the EU registries, not prompt tuning.
- **Floor scores an account universe. It does not build one.** Hand it a list and
  it ranks it. Discovering which merchants belong on the list is a different
  product, and it is where Apollo and Sales Navigator actually belong.
- **Cool-down reads an uploaded date.** Wired to CRM activity history it would
  read the truth.
- **The gold set is small, and the eval is a demonstration rather than a rate.**
  22 merchants were seeded. Eleven were archived because nothing had assessed
  them, and a row with no prediction to compare against is a note that a company
  discloses, not an answer-key entry. Of the eleven that remain, six have a figure
  established from a filing. The first eval scored the four that had both a truth
  and a prediction: floor call correct on all four, truth inside the predicted
  range on two, with Coupang the interesting miss. Four rows prove the loop
  closes. They do not support a published accuracy percentage, and the page
  withholds a rate for any segment below its sample floor rather than printing
  one small.
- **Ground truth is only as good as the company resolution behind it.** EDGAR is
  settled by the domain the filing itself prints. Companies House has no domain
  field and filed accounts rarely carry a website, so it resolves on an exact
  name after stripping legal suffixes, which can reach a namesake or a local
  subsidiary instead of the merchant. That is the weakest link in the answer key,
  it has already produced two wrongly attributed rows, and it is a resolver
  problem rather than an extraction one. Written up in
  [`LEARNINGS.md`](docs/LEARNINGS.md) §26.
- **No write path into any external system.** The Salesforce-shaped export and
  the write-back adapter exist and are deliberately unwired.

## Documentation

- [`docs/DECISIONS.md`](docs/DECISIONS.md), every significant decision and what
  forced it
- [`docs/LEARNINGS.md`](docs/LEARNINGS.md), what broke, why, and what it cost
- [`docs/COMPLETENESS.md`](docs/COMPLETENESS.md), every operation an operator
  can perform, and what was missing before the rebuild
- [`docs/DESIGN-SPEC.md`](docs/DESIGN-SPEC.md), the design system, page by page,
  and the research behind it
- [`src/ui/CONTRACT.md`](src/ui/CONTRACT.md), how a page module is built, and
  the real shape of the data each route receives

---

Built by Bryan Acevedo, August 2026.
