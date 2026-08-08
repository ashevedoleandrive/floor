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
