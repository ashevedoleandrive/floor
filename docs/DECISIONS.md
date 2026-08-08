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

## Open, and honestly so

- **Coverage, not accuracy, is the constraint.** Public filers are well served;
  private companies abstain. The fix is sources (SEC EDGAR and EU registries are
  free), not prompt tuning.
- **Floor scores a universe, it does not build one.** Discovering which merchants
  belong on the list is a different product, and where Apollo and Sales Navigator
  actually belong.
- **Cool-down reads an uploaded date.** CRM activity history would make it true.
- **Queue sorting is unverified** until enough accounts carry real data to sort.
