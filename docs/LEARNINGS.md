# What this build actually taught

Written the same day, before the details got tidy. Some of these cost real time
and real money, and the useful part is usually the diagnosis being wrong rather
than the fix being hard.

---

## 1. The tool caught its own hallucination in production, on the first run

The very first real assessment: every web search silently failed. The extractor
then produced **seven confident claims from prior knowledge with fabricated
URLs**. The critic caught all seven, dropped all seven, and forced an abstain.

That is the entire product thesis validating itself by accident. But the right
response was to treat it as a bug, not a trophy. **Relying on the critic to catch
an entire failed run is not a design.** Two fixes followed: search errors became
a first-class signal, and the pipeline now hard-stops before extraction when
search returns no usable sources. No evidence, no estimate, and two fewer model
calls to say so.

**Transferable:** a safety net that fires is evidence the net works and evidence
something upstream is broken. Fix the upstream thing.

---

## 2. Server-tool failures arrive as HTTP 200

Web search errors do not throw. They come back as a normal successful response
with an error object *inside* the result block. Code that only branches on
exceptions sees a healthy call.

The result was a run reporting "6 searches" while every one returned nothing.
The count looked fine. The content was empty.

**Transferable:** with server-side tools, check the result payload, not just the
call. Count of attempts is not evidence of success.

---

## 3. Three wrong diagnoses of the same symptom

Jobs kept dying mid-run. In order, I:

1. Ran the pipeline inside the HTTP request. Died at the edge.
2. Split it into chained invocations with `waitUntil`. Died in `waitUntil`.
3. Cut web searches from 5 to 2 to make it faster. Died identically.

Every time I changed **where** the work ran instead of asking **why a long call
dies**. The answer was mundane and documented: a non-streaming request that idles
for minutes has its connection dropped. Streaming keeps bytes moving and the
connection alive.

The tell was available early and I read past it: one job succeeded with a
75-second research call and another died with a longer one, in the same handler,
same code. That isolates the variable to **duration**, not architecture.

**Cost:** about an hour and roughly $0.45 of wasted spend.

**Transferable:** when the same symptom survives three different structural
fixes, the structure is not the problem. And when two runs differ in exactly one
dimension, that dimension is the answer.

---

## 4. The Cloudflare Queue was still the right call, and it was not the fix

Queues did not solve the dying jobs. Streaming did. But the queue stays, because
a multi-minute job genuinely does not belong in a request handler, and it brings
retries and bounded concurrency for free.

**Transferable:** "this did not fix the bug" and "this was the wrong decision"
are different judgements. Keep the good architecture you arrived at for the wrong
reason.

---

## 5. Reading only the first text block threw away 90% of the research

The bug that mattered most, and the hardest to see.

A response that interleaves web searches with commentary comes back as **many
short text blocks** split around the tool calls. The helper returned
`content[0]`. That is the model's opening line, typically "Let me look at Etsy's
most recent filing."

So the pipeline did genuinely good research, handed the next stage a
210-character preamble, and the critic correctly reported there was nothing to
work with. Every diagnostic pointed at "research is failing." Research was fine.
**The tool was failing to read its own research.**

Found only by running the same call locally and printing the whole response
structure instead of the summary.

**Transferable:** when every layer reports the layer above it is empty, suspect
the reader before the writer. And print the raw structure, not your convenience
accessor.

---

## 6. Precision and decisiveness are different requirements

The tool kept abstaining on Etsy, a company that files quarterly. The reason was
technically correct: Etsy publishes dollar sales, not order counts, so converting
requires assuming an average order value.

But the question being served is not "exactly how many transactions." It is "is
this above 100,000 a month." Etsy does $11.9B a year. At any plausible basket
size it clears the floor by orders of magnitude.

**I had built it to be precise when it only needed to be decisive.** The fix was
to derive from dollar volume using a deliberately wide order-value band, in code,
with the assumption stated on screen, and to report whether the verdict holds
across the whole band.

**Transferable:** design to the decision the user is making, not to the most
rigorous version of the measurement.

---

## 7. A soft judgement rendered as a percentage is worse than no number

"Source quality" was a 0-to-1 score emitted by the model, guided by three lines
of instruction. It looked precise. It was not reproducible.

Proof, from real stored data: **Etsy's single 10-K produced six different scores
across ten claims, spanning 0.60 to 0.97.** A 0.37 spread from a document that
never changed. The same aggregator page rated 0.55 on one claim and 0.30 on
another.

It was never rating the source. It was blending source quality with per-claim
certainty and presenting the mixture as one number.

Replaced with rules matched against the source URL: `sec.gov` is a regulatory
filing, an aggregator is a third-party estimate, a help centre is documentation.
Same link, same tier, forever, and auditable by looking at where it points.

**Transferable:** if a rating moves when nothing it claims to measure moved, it
is measuring something else. Find out what, then decide whether you want it.

---

## 8. Two judges must be labelled as two judges

Supported claims showed 65% while uncertain ones showed 80%, which reads as a
contradiction. It was not: the percentage came from the extractor rating the
source, the verdict came from the critic checking attribution. Different steps,
different questions.

The design was right and **the display invited the wrong reading**. Two numbers
side by side with no indication they come from different judges will be read as
one score disagreeing with itself.

Fixed by labelling: "Source type" and "Critic verdict," with the panel stating
they are independent and allowed to disagree. The disagreement is the feature.

**Transferable:** when a correct system reads as broken, that is a real defect.
The user's reading is the product.

---

## 9. Config that requires a deploy is not config

The source rules were about to be a constant in a file. The operator pushed back:
the people running this will not have access to whoever wrote it, so **everything
has to be operable from the product.**

Rules moved to the database with a UI to add, edit, enable and delete them. One
consequence turned out to be the best demo moment in the tool: classification
runs at **render** time, so demoting an aggregator instantly re-grades every
claim already stored. No re-run, no waiting.

**Transferable:** ask who will operate this, and whether they can reach you. That
answer decides what belongs in code.

---

## 10. Hiding a disabled item makes disabling irreversible

The rules table and the classifier read from the same query, which filtered to
enabled rules. Correct for classification, wrong for the UI: disabling a rule
removed it from the list, so the Enable button was unreachable and disable became
one-way. Six rules got stuck off during testing.

Two different questions needed two different queries.

Chasing it found two more: duplicate patterns were accepted (and with
first-match-wins, a duplicate lower in the order silently never fires), and
delete correctly refused to remove built-in rules.

**Transferable:** any reversible action whose UI removes its own undo is not
reversible. And test the round trip, not the action.

---

## 11. A QA gate that only checks status codes checks nothing

The client looks up elements by id; the server renders them from a different
file. Rename one side and nothing errors, nothing 404s, the page looks perfect,
and a button silently does nothing.

`scripts/qa.mjs` reads every selector the client depends on and verifies it
exists in the page that needs it. On its first run against a mid-redesign build
it immediately caught a dead row handler, an unrouted page, and em dashes on
every page.

**Transferable:** a check that cannot disagree with you is not a check. Write the
one that can.

---

## 12. Verify agent claims, then verify your own

A subagent reported the remaining em dashes were "stored model output and a D1
card title, which are data, not copy." Checking the database confirmed it was
right. Worth checking anyway, and it cost thirty seconds.

Separately and less comfortably: I quoted an order-value band of "$20 to $120"
for Etsy as though it were a result. It was an example I had written into my own
prompt. The run had not finished. **The exact failure the tool exists to prevent,
committed in the narration rather than the code.**

**Transferable:** the discipline you build into a system does not automatically
apply to how you talk about it.

---

## 13. Claims about the world need checking too

I stated that web traffic estimates were "the only realistic way" to size a
private company. Challenged, I researched it, and it was wrong three ways: card
transaction panels measure purchases at merchant level for private companies;
the EU Accounting Directive obliges every limited liability company to file
annual accounts, so private European merchants are often in a public register;
and app panels cover app-first merchants better than web traffic does.

I had also over-indexed on card panels a moment later, until the operator pointed
out they are heavily US-weighted and the role is global.

**Transferable:** confident domain assertions deserve the same evidence standard
as the product's own claims. Especially the ones that sound like expertise.

---

## 14. Measured beats estimated, and it is cheap

Every model call records tokens, cost, latency and stop reason. That trace turned
several arguments into observations: cost per account is **$0.26 to $0.29**, not
a guess; research is 92% of the runtime; a run that reported 14 searches when
capped at 5 exposed that `max_uses` was not behaving as assumed.

**Transferable:** instrument first. It is nearly free and it ends debates.

---

## 15. A test harness can report its own impatience as a product failure

The batch script polled each job for eight minutes and then printed `TIMEOUT`.
Four accounts timed out. All four had completed successfully server-side. A run
is about four minutes alone, but the queue consumer caps concurrency, so parallel
submissions contend and a single account can legitimately take eight to fourteen
minutes. The ceiling was raised to twenty, and the timeout message now says to
check the real state before assuming failure.

This is worse than a slow run, because it manufactures bugs that then get
"fixed." Two of the wrong diagnoses in entry 3 were reinforced by exactly this
kind of false signal.

**Transferable:** a harness that can report a false failure is a harness that
will send you debugging something that works. Set its patience from the measured
worst case, not the happy path, and make its failure message admit its own
uncertainty.

---

## 16. "Looks professional" and "looks designed" are different bars

The visual layer passed every functional check and was rejected on sight:
*"still looks like ai once passed it... standard claude cards formats. not perfect
alignment. those live intermitent buttons. the pills."*

The named tells are worth writing down because they are specific and they recur:
a default three-across card grid with every section at equal weight, optical
misalignment between adjacent elements, status pills as the default way to render
any state, and buttons that animate for no reason. Each is a local decision that
looks fine alone. Together they are a signature.

The deeper error was in the brief, not the output. I asked an agent to "research
the best B2B products" without naming any, so "best" resolved to
competent-generic. And I wrote "keep the existing CSS if you still believe in
it," which is not a constraint, it is permission to change nothing.

**Transferable:** name the reference set explicitly and name the tells to avoid.
A brief should be short in instructions and precise in every one of them. Never
give a design brief an escape hatch back to the status quo.

---

## 17. A check that never fetched a page reported that page as fine

The Settings screen shipped to production with its entire layout class family
undefined. Every label, hint and consequence line collapsed into run-on text. The
QA gate read 120 passing at the time.

The gate was not fetching `/settings`. It was never in the page list.

Generalising the check, every class the markup repeats must be defined in some
stylesheet, immediately found the same defect on four more pages: twenty
occurrences of one class on the queue, twenty-two of another on Accuracy,
fourteen in total. None of it errored, 404'd or logged.

**Transferable:** an unchecked surface is where the bug goes. And when a bug is
found, generalise it into a rule before fixing the instance, because the instance
is almost never alone.

---

## 18. Three of my own checks cried wolf

While building the gate that catches wolves, I shipped three false positives: a
404 reported on a page whose links were fine (the scanner was reading href
fragments out of inlined JavaScript), and two classes reported as unstyled that
are pure binding hooks (the detector recognised two of the four ways the client
selects elements).

Each one would have sent someone debugging working code.

**Transferable:** a check that cries wolf gets ignored, and an ignored check is
worse than no check, because it also carries the false comfort of coverage. Tune
the false positives out the moment they appear.

---

## 19. Write the file the moment it is coherent

Nine page builds ran concurrently and every one of them was killed mid-run by a
spend limit. Eight survived intact. One produced nothing at all.

The difference was a single instruction, added only because an earlier run had
already died holding all its work in memory: write each file to disk as soon as
it is coherent, then refine it there. The eight that had it lost nothing. The one
that did not lose everything had been told the same thing and had not reached the
writing stage.

**Transferable:** long work should leave durable artefacts continuously, not at
the end. Anything that batches its output to the final step is one interruption
away from having done nothing.

---

## 20. Delegated work reports success it did not achieve

Three separate cases in one session. An agent reported that production was left
exactly as found, when its test had stamped the top account as touched and
dropped it from rank 1 to rank 17. Another left two merchants archived, so the
live dataset silently read 36 accounts, 16 assessed, 4 abstains. A third reported
zero em dashes and zero page reloads in files that contained both, in comments,
which the gate correctly strips and my first grep did not.

Two of those were caught by looking at the rendered page. The third was caught by
checking rather than believing.

**Transferable:** verify the final state yourself. A report is a claim. This is
the same law as the abstain enforcement and the `mark()` throw: anything that
depends on someone remembering to do the right thing eventually meets someone who
did not.

---

## 21. The bugs that mattered most were only findable by clicking

None of these could be caught by any static check, and all of them were found by
a person or an agent actually using the interface:

- The rule dialog's Save button did nothing, silently, every time. An HTML5 step
  constraint on the order field rejected every real value, so the browser blocked
  submit before any JavaScript ran. No error, no console message, the dialog just
  sat there.
- The Impact page's ROI figure was off by one, always low, and always on exactly
  the round numbers a person reads aloud. It printed 999 for 1,000 and 1,299 for
  1,300, because freed time was converted into hours and multiplied back into
  minutes.
- A double percent sign in Spanish, from an i18n key that appended a symbol a
  formatter had already added.
- The bulk action bar survived with a stale count when every selected row left
  the page.

**Transferable:** static checks find whole classes of defect cheaply, and they
find none of these. Budget for someone to use the thing.

---

## 22. Verify against production data, not against whatever renders

The coverage map rendered perfectly against a local database with no assessments:
every region correctly hatched, honest empty state, legend intact. That proved
the empty path and nothing else. The case the page exists for, some regions lit,
one hatched below the sample floor, two dark, only appears against real data.

**Transferable:** a page that renders is not a page that works. Test against the
data the thing will actually be seen with, especially the rows that are ugly.

---

## 23. A name is not an identity

The EDGAR resolver matched company names. "allegro" prefixes "ALLEGRO
MICROSYSTEMS, INC.", a US semiconductor company, so allegro.pl resolved to CIK
0000866291 at 80% confidence. Clicking Establish would have read a chip maker's
10-Q and stored it as ground truth for a Polish marketplace, complete with a
verbatim quote and a source link making it look impeccable.

My own comment in that file warned that a wrong CIK silently attributes one
company's filings to another. The code did it anyway.

The obvious correction, demand an exact name, immediately lost Lululemon and
Peloton, whose legal names carry extra words. Names are wrong in both directions.
What settles it is the domain, because a company prints its own website on the
cover of its filings: DoorDash's 10-Q contains "doordash.com", Allegro
MicroSystems' contains "allegromicro.com" and never "allegro.pl". Names now only
shortlist, and a candidate is accepted once its own filing says the domain out
loud.

**Transferable:** match on the identifier the subject publishes about itself, not
on the label you use for it. And when a fix in one direction breaks the other
direction, the field you are matching on is the wrong field.

---

## 24. A check that ran out of room looked like a check that doubted everything

Chewy abstained for "no surviving claim measures purchase or transaction volume"
while its evidence carried a direct SEC quote of $3,357.2 million net sales for
the quarter, 21.5 million active customers, and net sales per active customer.
Eleven claims, every one marked uncertain, not one supported.

The evidence was never the problem. The critic hit its token ceiling: stop reason
`max_tokens`, output exactly 8000. It never finished issuing verdicts, and
`finalise` defaults a claim with no verdict to uncertain. That default is right
when the critic considered a claim and hedged. It is wrong when the critic never
reached the claim, because then every verdict goes missing at once, everything
reads as doubted, and the account abstains for lack of evidence with its filing
sitting in the table.

Three fixes. The budget went to 16,000, since thinking and output share it.
Truncation is now detected and carried out of the stage rather than swallowed.
And the abstain now distinguishes "nothing measures volume" from "a figure was
found but its attribution could not be confirmed", because the first sends an
operator hunting for better sources and the second needs a re-run. Chewy now
returns 13.6M txn/mo at 82% confidence and sits in the work band.

One run in twenty-four was affected, so the incidence was not systemic. The
failure mode is.

**Transferable:** a missing answer is not a negative answer. Any default for an
absent value has to be chosen with the reasons it could go absent in mind, and
a run that was cut off has to be able to say so.

---

## 25. A proxy came apart at exactly the row it mattered on

Zalando sat under "needs an assessment first" on the accuracy page while being
assessed. The predicate deciding whether a row was gradable tested for stored
source links, using "we found documents" as a proxy for "we have a prediction".

Those two come apart in one case, and it is the case that matters: an abstain
means the critic dropped every claim, so there are no surviving evidence URLs, so
an assessed merchant reported as unassessed. The predicate now asks whether a
live assessment exists, and nothing else.

Two copies of it existed, server and client. Fixing the server alone meant the
server put Zalando in the right place and the client moved it back to the wrong
one, which is precisely the defect the QA gate was built for: two files rendering
the same thing from different logic, and nothing errors.

**Transferable:** a proxy is a bet that two things never come apart. Write down
where they would, and check that row first.

---

## 26. The domain rule was applied to one resolver and not the other

Entry 23 fixed EDGAR. Companies House was wired later and matches on an exact
name after stripping legal suffixes, because Companies House has no domain field
and filed accounts rarely print a website. That constraint is real and it is
documented in the file. What was not thought through is where the fallback fires:
truth extraction tries EDGAR first and falls through to the UK registry
**precisely when EDGAR failed**, which is also precisely when the merchant is
most likely to be something other than a UK company.

The result is in production. chewy.com is established at 5,229 orders a month
from "Turnover 62,751" in the accounts of a UK company for the period ending
2012, and etsy.com at 985,927 a month from a £11.8M turnover line. Both are real
filings, correctly quoted, correctly converted, and attributed to the wrong
business. Every defence in `truth.js` did its job; none of them is a check on
*whose* document this is.

Cost so far is contained only by timing: the eval ran before those two rows were
written, so the published numbers do not include them. Re-running it today would
grade Floor against a namesake's accounts and the accuracy claim would collapse
for reasons that have nothing to do with the estimator.

**Transferable:** a rule that lives in one adapter is not a rule. When a class of
error is fixed, walk every path that can produce it, especially the fallback that
only runs when the fixed path gave up.

---

## 27. A child record scoped to the wrong parent cannot be undone

Assessments soft-delete: remove a bad run and the previous one takes over,
restore it and it comes back. Evidence and traces are scoped to the assessment,
so both follow correctly.

Signals are scoped to the account, and saving a run deletes the previous run's
signals before inserting its own. Removing that run does not bring the old ones
back. DoorDash currently displays four timing signals belonging to an assessment
that was deleted this morning, and timing is 15% of the score.

This is the D17 rule failing in the one place nobody checked: the action is
reversible in the interface, the undo is right there, and it silently restores
less than it removed.

**Transferable:** an undo is only as good as the scoping of everything the
original write touched. Ask what else that write deleted, and who owns it.

---

## 28. Handing the model the answer made it stop looking for the question

Wiring EDGAR into research was a clear win: the pipeline reads the filing instead
of searching for commentary about it, and the five searches are freed for timing
signals. The prompt says exactly that.

Chewy then spent all five searches on financial facts and returned no dated
events at all, leaving timing at 0.00 where an earlier run had found its Canada
launch and the Modern Animal acquisition. Not systematic, since Roblox picked up
three dated signals after EDGAR was wired. But the prompt lists dated events
last, and a handed-over filing can satisfy everything above them before the model
reaches the part it was supposed to spend the budget on.

**Transferable:** when you remove work from a step, check what it does with the
freed capacity. An instruction ordering is a priority list only while the earlier
items are still expensive.

---

## Standing rules that came out of this

1. Print the raw response structure before trusting any accessor over it.
2. When a symptom survives **two** structural fixes, the diagnosis is wrong. Stop
   fixing and isolate the variable instead.
3. Two runs differing in one dimension isolate the cause. Read that, not vibes.
4. Any number on screen is either deterministic or labelled as a judgement.
5. If a rating moves when its subject did not, it measures something else.
6. Config the operator cannot reach is not config.
7. A reversible action must keep its undo visible.
8. Build the check that can disagree with you.
9. Separate numbers you measured from numbers you illustrated with.
10. Design to the decision, not to the most rigorous measurement.
11. Every object needs create, read, update and delete before it ships.
12. A harness's failure report is a claim. Check the real state before debugging.
13. Name the references and the tells in a design brief. "Best" is not a bar.
14. State regional coverage before recommending a source, not after.
15. An unchecked surface is where the bug goes. Check every surface you serve.
16. Generalise a bug into a rule before fixing the instance. It is never alone.
17. A check that cries wolf gets ignored. Tune out false positives immediately.
18. Long work writes durable artefacts continuously, never only at the end.
19. A delegated report is a claim. Verify the final state yourself.
20. Budget for someone to click it. Static checks find none of the worst bugs.
21. Test against the data it will be seen with, especially the ugly rows.
22. Match on the identifier the subject publishes about itself, not on its name.
23. A missing answer is not a negative answer. Choose the default for an absent
    value knowing why it could be absent.
24. A rule fixed in one adapter is not fixed. Walk the fallback paths too.
25. A proxy is a bet that two things never come apart. Check that row first.
26. An undo restores only what the original write was scoped to. Check the rest.
