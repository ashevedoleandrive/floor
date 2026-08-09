# Decisions

Why Floor is built the way it is. Each entry states the decision, what forced it,
and what it costs. Where a decision was reversed, the reversal is recorded rather
than the history rewritten.

---

## D1 · Pick the gap that is three gaps

**Decision.** Build account prioritisation fused with evidence verification,
rather than one of the five gaps Yuno listed.

**Why.** Prioritisation is their stated number one pain. Separately they said
they wanted a transaction-volume estimator and could not build it. Separately
again, their existing business-case tool works but "the numbers are off
sometimes" and they cannot trust it. Those are one problem: nobody can sequence
the work because nothing the machine says is checkable.

**Also.** Their brief invites picking "one we did not list." Across a finite TAM
worked by five people there is **no suppression memory**. They wrote "re-hitting
the same accounts hurts" as context for the prioritisation gap. It is a gap in
its own right and the cheapest one to close.

**Cost.** Higher build risk than the plumbing option (Sales Nav → Apollo →
Salesforce → Gong), which would have been easier but demos as mocks, since the
challenge forbids production credentials.

---

## D2 · A ranked queue, not a domain lookup

**Decision.** The primary surface takes a list and returns an ordered work queue.

**Why.** Their brief closes with "build something we'd use on Monday." Their
reality is 500 accounts booked per SDR and 60 to 70 worked a month. A form that
scores one domain is a demo. Also, "which accounts to prioritise **and when**" is
their own wording, and a per-domain lookup cannot answer the second half.

**Cost.** More build. Populating the queue needs a batch runner and real spend.

---

## D3 · Three model calls, not one prompt

**Decision.** Research (Sonnet 5 + web search) → Extract (Sonnet 5, no tools) →
Critic (Opus 5, no tools) → Score (plain code).

**Why.** A single model doing all of it grades its own homework and passes.
Separating them means the checker has no stake in the answer. Extract is
deliberately denied tools so it physically cannot add facts research did not
find.

**Validated in production.** First real run: every search failed, extract
invented seven claims with fabricated URLs, critic killed all seven.

**Cost.** Three calls instead of one, roughly $0.26 to $0.29 per account, and
about four minutes.

---

## D4 · The arithmetic never runs in a model

**Decision.** Scoring, floor comparison, cool-down, ranking and the GMV-to-
transactions conversion are plain JavaScript.

**Why.** It is the direct answer to "our numbers are off sometimes." Same inputs
produce the same output forever, and it is auditable by reading one file.

**Cost.** Some judgement that a model would handle gracefully has to be encoded
explicitly.

---

## D5 · Abstention enforced in code

**Decision.** The decision to withhold an estimate lives in `finalise()`, not in
a prompt.

**Why.** A confidently wrong number is the single failure that would discredit
the tool. Delegating that decision to the thing being checked is not a control.

Code forces abstention when no surviving claim measures purchase volume, when
the critic drops the claims the estimate rested on, or when disclosed figures
disagree by more than two orders of magnitude.

---

## D6 · Derive from dollar volume, decisively rather than precisely

**Decision.** When a merchant discloses money but not order counts, derive
transactions using a deliberately wide average-order-value band, in code, and
report whether the floor verdict holds across the whole band.

**Why.** Most large merchants disclose GMV, not counts. Refusing to convert meant
abstaining on companies whose scale is not in doubt. The question is which side
of 100,000 a merchant sits on, and a band spanning an order of magnitude usually
answers that decisively.

**Reversal.** The original design abstained in this case. That was precision
where decisiveness was needed.

**Guard.** The assumption is printed on screen, and if the band straddles the
floor the row is marked borderline rather than resolved.

---

## D7 · Queue for execution, streaming for survival

**Decision.** `POST /api/assess` enqueues and returns in under a second. A
Cloudflare Queue consumer runs all three stages. Every model call streams.

**Why.** A request handler cannot hold a multi-minute call, and neither can
`waitUntil`. Streaming prevents an idle connection being dropped, which was the
actual cause of jobs dying (see LEARNINGS §3).

**Note.** The queue did not fix the dying jobs; streaming did. The queue stays
because retries and bounded concurrency are worth having and long work does not
belong in a request.

---

## D8 · Source classification is deterministic and operator-owned

**Decision.** Source type is decided by rules matched against the URL, stored in
the database, editable in the UI. Classification runs at render time.

**Why.** The model-judged version drifted badly: one Etsy 10-K produced six
different scores across ten claims. And the people running this will not have
access to whoever wrote it, so rules that need a deploy are not rules they own.

**Consequence, unplanned and good.** Editing a rule re-grades every stored claim
immediately, because classification is not baked in at write time.

---

## D9 · Gold set ships empty

**Decision.** 22 candidate merchants with the metric and where to find it, and no
figures. A row does not count until a human opens the source and enters it.

**Why.** Pre-filling from memory would reproduce exactly the failure the tool
exists to prevent. The candidates are chosen because their volumes are
**publicly disclosed**, so the accuracy claim is checkable by anyone in the room
rather than asserted at them.

**Cost.** Real manual work before the accuracy page shows anything.

---

## D10 · Salesforce seam built, deliberately unwired

**Decision.** A Salesforce-shaped CSV export and a documented, unwired write-back
adapter.

**Why.** Their stack is measured 100% in Salesforce, and the rules forbid
production access. This shows the seam without asking for credentials. A
candidate who quietly requests production access is telling you something.

---

## D11 · Public URL, hard spend cap, graceful degradation

**Decision.** No auth wall. A hard daily spend cap. Exceeding it degrades to
cached results with a visible banner rather than erroring.

**Why.** The brief says "a URL we can click, or a workflow we can trigger
ourselves. If we cannot run it, it does not count." So it must work unattended,
for people who are not the author, days later. Without a cap, one curious visitor
looping a large list is the author's bill.

---

## D12 · Bilingual interface, monolingual reasoning

**Decision.** UI copy authored in English and Spanish. The pipeline is not
language-aware.

**Why.** The interface toggle is free: static text, no model call. Making the
models reason natively in Spanish is the more honest version of bilingual, but it
costs 5 to 8 percent more per run and nothing needs it.

**Reversal.** The pipeline half was built, then cut. Shipping it switched off
would have left dead config, which is worse than an absent feature.

**Honesty.** Evidence renders in the language it was reasoned in, always English
today, and the UI does not pretend otherwise.

---

## D13 · A QA gate that reads client bindings

**Decision.** `scripts/qa.mjs` extracts every selector the client depends on and
verifies it exists in the rendered page.

**Why.** The client looks up elements by id and the server renders them from a
different file. Rename one side: nothing errors, nothing 404s, the page looks
perfect, a button silently does nothing. Status-code checks cannot see it.

**Also covers.** API response shapes, real content per page, every internal link
including all account pages, and hygiene (em dashes, `undefined`, `NaN`, remote
assets).

---

## D14 · One kit, and pages may not restyle it

Every surface is one file that composes shared primitives and owns only CSS
scoped to its own page class. A page that wants a primitive to look different
reports a kit bug rather than overriding it locally.

The alternative, letting each page style what it needs, is how the first build
ended up with nine species of status pill and fourteen classes emitted into the
markup that no stylesheet defined. Those were invisible to the browser and to
every check we had. The constraint is what stops the interface drifting back
into a component-library texture, and the QA gate enforces it rather than
review discipline.

**Cost:** a page author occasionally needs a primitive that does not exist and
has to stop and say so. That is the intended friction.

## D15 · State is a mark plus a word, enforced by throwing

`mark()` raises an error when called without a label. A state rendered in colour
alone cannot reach production, because the check runs at render time rather than
in a review comment.

This is the same move as D5. Abstention is enforced in code rather than
requested in a prompt; colour-blind-safe state is enforced in code rather than
requested in a design doc. Anything that depends on a human remembering will
eventually meet a human who does not.

## D16 · Uncertainty is a shape, not a label

Confidence is the solidity of the range bar. An abstain is a dashed hollow slot
where the gauge would be. A region below the sample floor renders hatched and can
never receive a fill, whatever its rate. Anything projected rather than measured
renders dashed, because solid ink is a promise that a human can click through to
a source.

The test this has to pass: **delete all the text, and you can still see which
numbers are solid, which are shaky, and which are refusals.** Before the rebuild
the answer was no, because every state was written in a coloured capsule. Both
encodings existed and neither was legible at a glance.

## D17 · Nothing hard-deletes

Archiving stamps a timestamp, un-archiving clears it. No operator action
destroys a row.

Forced by a bug worth stating plainly: disabling a classification rule filtered
it out of the list the operator was reading, which put the Enable button out of
reach. The data was intact in the database the entire time, and that was worth
nothing to the person clicking it. **An action is only reversible if it is
reversible in the interface.**

The rule generalises past that one bug. `last_touched_at` feeds cool-down scoring
and could only be set at assess time, so an account suppressed on a wrong date
stayed wrongly suppressed. A mistyped gold-set figure was permanent, silently
poisoning the one claim the tool makes about itself.

**Cost:** every list query has to exclude archived rows, and we got that wrong
twice, in the backlog and gold-set loaders, where archived rows kept counting
toward totals. Two page authors found it independently, which is what a shared
defect looks like when nobody owns the file it lives in.

## D18 · The demo dataset has invariants, and they are checked

The QA gate asserts the handful of facts a live demo stands on: which account
ranks first and at what volume, how many accounts exist, how many are assessed,
how many abstained, where the floor and cool-down sit.

Added after a verification run stamped the top account as touched. Nothing
errored, and the tool was behaving correctly, because a touched account is
suppressed by design. But the most impressive number in the dataset silently
dropped from rank 1 to rank 17 and read as cooling down, and the process that
did it reported the dataset had been left exactly as found.

Self-reported cleanup is not a check. Anything that would be embarrassing on a
shared screen and looks completely normal in the interface needs an assertion
somewhere that fails loudly.

## D19 · Ground truth is extracted from filings, not typed by a human

**Decision.** The answer key is established by reading the merchant's own filing.
A narrow extractor transcribes one figure from one named document, the verbatim
sentence is stored and shown, and code performs every conversion. Provenance is
recorded as `extraction` or `human`, because the two are different kinds of
evidence and the page says which it holds.

**Why.** D9 shipped the gold set empty and made a human the only way to fill it.
That was right when Floor had exactly one source, because any automated check
would have been reading the same web through the same eyes. The human was
standing in for a second source that had not been wired. EDGAR is that source: a
regulator's own document store, reached by direct lookup rather than by search,
so predictions and truth stop sharing a pipe.

**What makes it trustworthy is not that a model did it.** It is that the sentence
and the arithmetic are both on screen. A sceptic checks the figure by reading;
a human quietly typing a number was never checkable at all.

**Cost.** A new failure mode, the unit error, which is what D20 and the five
defences in `src/lib/truth.js` exist for.

**Reversal.** D9's rule that a row does not count until a human types the figure
is retired. Its reason, that seeding from memory reproduces the failure the tool
exists to prevent, is intact: nothing is established from memory, only from a
named document.

---

## D20 · The model reports, code converts, and five defences sit in between

**Decision.** The extractor reports the figure, its scale word and its period as
separate fields and converts nothing. Code multiplies, and refuses in five ways.

1. The claimed period is checked against the quoted sentence.
2. The claimed scale word is checked against the quoted sentence, matched to the
   figure being validated rather than to the first number in the line.
3. A quote naming no period abstains, unless the document type establishes one,
   as annual filed accounts do. That substitution is recorded as a flag.
4. All arithmetic is deterministic.
5. A disagreement with Floor's own estimate at almost exactly 3x, 4x or 12x is
   flagged as a suspected period confusion.

**Why.** "776 million Total Orders in Q3" stored as monthly is wrong by exactly
3x, and the eval would then reward a badly wrong prediction and penalise the
correct one while reporting nothing. A wrong answer key is worse than no answer
key, because it converts an honest "unmeasured" into a confident lie.

**Not theoretical.** The first live extraction read "970 million Total Orders"
and reported 970. The scale check caught it.

**Flagged, never rejected, on the fifth.** Discarding truth for disagreeing with
the prediction is the circularity the whole design exists to avoid.

---

## D21 · A filer is identified by the domain it prints, not by its name

**Decision.** Names shortlist. A candidate CIK is accepted once the filer's own
newest filing prints the merchant's domain. Where no filing prints a domain, an
exact legal name is accepted at lower confidence and the weaker basis is
reported rather than hidden.

**Why.** "allegro" prefixes ALLEGRO MICROSYSTEMS, a US semiconductor company, so
a name rule returned its CIK for allegro.pl at 80% confidence and Floor would
have stored a chip maker's 10-Q as ground truth for a Polish marketplace, with a
verbatim quote and a source link making it look impeccable. Demanding an exact
name instead lost Lululemon and Peloton. Names are wrong in both directions; a
company states its own website on the cover of its filings.

**Cost.** One extra fetch per candidate, and a lower-confidence branch that has
to be labelled everywhere it appears.

**Limit, stated because it is load-bearing.** Companies House has no domain field
and filed accounts rarely print a website, so the UK resolver still matches on an
exact name. The rule is applied where the data allows it, not everywhere.

---

## D22 · A PDF is a document, not a parsing problem

**Decision.** Companies House accounts go to the model as a document block. No
PDF parser, no build step.

**Why.** Checked rather than assumed across four companies including Tesco and
Dyson: the document API returns `application/pdf` and nothing else. EDGAR hands
over HTML that a regex can reduce; Companies House hands over a document. A
parser would mean a toolchain this product deliberately does not have.

**Guard.** Documents are capped, and the smallest recent filing that fits is
chosen rather than the newest, because a large PLC files a 9MB annual report
while last year's is 6MB and carries the same headline figure. A document over
the ceiling is a coverage fact and says so.

**Cost.** The UK path yields revenue rather than order counts, so it establishes
the dollar volume a size is derived from rather than a transaction count. That is
the honest ceiling of the source and it is stated rather than papered over.

---

## D23 · Source status is derived from what is reachable

**Decision.** A source's status is computed from two separate facts: whether the
credential exists, and whether an adapter exists that reads it. Three states,
`connected`, `key_held` and `available`.

**Why.** Status was a constant typed into the registry, so adding the Companies
House key changed nothing on screen and the page sat there calling a source
unwired while its key was in the vault. Bryan: "isn't this shit supposed to be
dynamic, or do you expect me to tell you every time I add a source?"

**Why two facts and not one.** Holding a key with nothing to call it is not
connection, and reporting it as connected would be the same overclaim in a new
place. The coverage map and its rail read the derived registry, so wiring a
source lights its regions without anyone editing a file.

---

## D24 · Six surfaces, and the retired routes still resolve

**Decision.** Queue, Coverage, Accuracy, Case, Backlog, Settings. Sources folded
into Coverage, Day one folded into Impact, which became Case. `/sources` and
`/wired` return 301s into the pages that absorbed them.

**Why.** Sources and Coverage answered one question, what this tool can see and
how well, and the Coverage page argued in its own copy that coverage and
measurability are one constraint rather than two. Two tabs contradicted the
sentence on the screen. Impact and Day one were both arguments about value split
across two tabs, which is why neither felt essential. Eight tabs for 38 accounts
is homework logic: a page per capability so each one looks justified. A tool
earns trust by being small and dense.

**Kept separate on purpose.** Accuracy, because it is the whole trust argument.
Backlog, because "what would you build next" is a question the room will ask.

**Consequence.** Both merged pages are smaller than the two they replace, and the
QA gate now asserts the redirects, because a link someone already shared has to
keep landing.

---

## D25 · An abstain names its cause, not its consequence

**Decision.** The abstain path is unchanged, and the account of it is not. A
figure the critic will not support still cannot carry an estimate. But "no
surviving claim measures purchase volume" is now reserved for the case where
research genuinely found nothing, and a separate sentence covers the case where a
figure was found and its attribution could not be confirmed. A critic that ran
out of tokens says so.

**Why.** The two situations wore the same sentence and demand opposite responses.
The first sends an operator hunting for better sources. The second needs a re-run
or a human glance, and Chewy spent two runs looking like the first when it was
the second, with a direct SEC net-sales quote sitting in its evidence table.

**Cost.** None to the guarantee. The gate is deliberately untouched; only the
explanation changed.

---

## Open, and honestly so

- **Coverage, not accuracy, is the constraint.** Public filers are well served,
  and a private UK company is now reachable through its filed accounts.
  Everywhere else, private companies abstain. The remaining free fix is the rest
  of the EU registries, not prompt tuning.
- **The UK resolver is the weakest link in the answer key.** It matches on an
  exact name because Companies House has no domain to match on, so a namesake or
  a local subsidiary can be reached instead of the merchant. Every other source
  is settled by the domain.
- **The eval is four rows.** Enough to prove the loop closes, not enough to
  publish a rate, which is why every segment below the sample floor withholds one
  rather than printing it small.
- **Floor scores a universe, it does not build one.** Discovering which merchants
  belong on the list is a different product, and where Apollo and Sales Navigator
  actually belong.
- **Cool-down reads an uploaded date.** CRM activity history would make it true.
- **Queue sorting is exercised but ungraded.** Nineteen assessed accounts sort
  the way the rules say they should. Whether that order is the *right* order is a
  question only closed-won outcomes answer, which is the Salesforce loop.
