# Floor · Design Specification for the interface rebuild

**Status: DRAFT, awaiting operator approval. Nothing in this document is built until it is approved.**

Scope: every rendered surface of Floor (queue, account detail, sources, accuracy, impact,
backlog, day one, settings), one new surface (the coverage world map), the design system
they all draw from, and a completeness audit of every object and operation the product
should expose. The pipeline, scoring, API and data model are out of scope except where a
missing interaction implies a missing endpoint, which is flagged as such.

Hard constraints carried through every section:

- Self-contained. No CDN, no external fonts, no remote assets. Renders on a plane.
- No em dashes in any copy, in either language.
- Bilingual. Every authored string exists in English and Spanish, and Spanish runs 15 to
  25 percent longer. Every fixed-width element is sized for the Spanish string.
- Never invent data. Several states are genuinely empty on day one and stay honest.
- Server-rendered HTML, small vanilla client, no framework, no build step.

---

## 0 · The stance

Floor is an instrument. It measures something (can this merchant clear 100k transactions
a month), states how sure it is, and refuses to answer when it cannot. The current
interface presents that instrument inside the visual vocabulary of a template: a hero
headline, a stat card, a stack of rounded panels, a pill for every state. That vocabulary
is what the operator is calling "AI did it," and he is right, because it is the vocabulary
that falls out of a component library rather than out of the content.

The rebuild inverts the priority. The data decides the layout. The queue is a worklist,
so it looks like a ledger, not a landing page. The verdict is a measurement, so it looks
like a reading on a scale, not a card with a badge. Uncertainty is the product's core
honesty, so uncertainty gets a physical form (width, hollowness, hatching, dimness)
instead of a labelled chip. Chrome exists only where it does work.

One sentence to test every screen against: **if you deleted all the text, could you still
see which numbers are solid, which are shaky, and which are refusals?** Today the answer
is no, because the states are written in pills. After the rebuild the answer must be yes.

---

## 1 · Research: what the high-craft products actually do

Observations below are specific and reusable. Each ends with the technique Floor takes.

### 1.1 Linear

- Status is never a pill. It is a 12 to 14px geometric glyph plus a plain word: hollow
  circle for todo, a disc filling by quarters for in progress, a filled disc with a check
  for done. Shape carries the state; color assists; text confirms. You can read a list
  with your eyes defocused.
  → **T4: status = glyph + word. Shape first, color second, never a tinted capsule.**
- Issue lists have no container per row and no visible card. Rows are separated by
  spacing and a hover wash. The list sits directly on the page surface. Density comes
  from row discipline (uniform 36 to 40px rows, single-line cells) rather than from
  smaller type.
  → **T5: density through uniform row height and single-line cells, not smaller fonts.**
- One accent color in the whole application. Everything that is not interactive is a
  grayscale ladder. Selection is the accent; meaning is never the accent.
  → **T1: one accent, reserved for interaction and selection only.**
- Typography per screen: roughly four sizes. Titles are barely larger than body (15 vs
  13) but heavier and darker. Hierarchy is mostly weight and ink, not size.
  → **T11: max four type sizes per screen; differentiate with weight and ink value.**
- Nothing on a resting screen moves. Motion happens only on state change, 100 to 200ms,
  ease-out, and progress indicators exist only while work is genuinely running.
  → **T6: no idle motion. A pulsing dot on a healthy system is a lie about activity.**

### 1.2 Stripe (dashboard)

- Tables: no zebra striping, no vertical cell borders, one hairline under each row,
  headers in small quiet type, numeric columns right-aligned in tabular figures, units
  and currency symbols set in muted ink so the digits carry the weight. A Stripe payments
  table is legible at 50 rows because the digits form perfect vertical columns.
  → **T10: all numerics tabular, right-aligned, unit muted. Alignment is the aesthetic.**
- Stat headers ("Gross volume", "Net volume") are not boxed cards. They are columns of
  type separated by hairlines: a 13px muted label, a 24 to 28px figure, a small delta.
  The container is whitespace.
  → **T3: a border must earn its ink. Sibling stats are separated by rules, not boxes.**
- Stripe does use small tinted badges ("Succeeded"), but exactly one per row, one shape,
  one size, and the badge never appears outside tables. The discipline is a closed
  vocabulary: a component exists in one form or not at all.
  → **T13: closed component vocabulary. Nothing gets a new variant per page.**

### 1.3 Vercel (Geist system)

- A ten-step gray ladder does nearly all the work; semantic colors (success, warning,
  error) appear in tiny doses on marks and text, never as page-scale washes.
  → reinforces **T1** and the ink ladder in §3.3.
- Flat by default. Shadows exist only on layers that are literally above the page
  (menus, dialogs, toasts). Everything in the page plane is separated by hairlines.
  → **T7: elevation encodes literal z-order, nothing else. One shadow token.**
- Empty and placeholder zones use dashed borders: dashed reads instantly as "nothing is
  here yet, and that is expected."
  → matches Floor's existing held/abstain language. Kept and generalised: **dashed =
  deliberate absence** everywhere in the product.

### 1.4 Attio

- Records are objects: a full page per record with a left rail of editable attributes
  and the evidence/activity on the right. Attributes edit inline (click the value,
  it becomes an input); there is no separate "edit mode."
  → **T14: object pages edit inline, field by field. No modal for changing one value.**
- Multi-select summons a floating action bar at the bottom edge: "3 selected · Assign ·
  Export · Delete." Bulk operations live in one place, appear only with a selection, and
  name the count.
  → **T8: bulk actions via selection + floating count bar.**

### 1.5 Raycast, Things, Superhuman

- Raycast: strict 8px rhythm, 40px list rows, right-aligned muted metadata, and a
  persistent footer showing the available actions with their keys. Affordances are
  always visible somewhere deterministic, never only on hover.
  → **T9: keyboard layer with visible hints; actions live in a deterministic place.**
- Things: the entire app is one paper surface. Groups are made by headers and space.
  The only chrome is the checkbox. Restraint as identity.
  → reinforces **T3**. Floor's page is one surface; boxes are exceptions.
- Superhuman: state changes respond under 100ms even when the network is slow, by
  acknowledging optimistically and reconciling. The feeling of quality is latency.
  → **T15: no full-page reload as a state update. Mutate in place, confirm quietly.**

### 1.6 Bloomberg Terminal (density reference)

- The terminal renders more data per square inch than anything else in finance and
  remains readable for eight hours a day because everything sits on a character grid,
  color is a strict semantic code (amber = editable, white = data, green/red =
  direction), and there is zero decoration. Nothing is rounded, shadowed, or tinted for
  taste.
  → **T2: alignment as system. Columns of a page align across sections, not only within
  a table. Color is a code you could write on an index card.**

### 1.7 The distilled technique set

T1 one accent · T2 cross-section column alignment · T3 borders must earn their ink ·
T4 status as glyph + word · T5 density via row discipline · T6 no idle motion ·
T7 one shadow, literal z-order · T8 bulk bar on selection · T9 visible keyboard layer ·
T10 tabular right-aligned numerics with muted units · T11 four sizes per screen ·
T13 closed vocabulary · T14 inline field editing · T15 no reload on mutation.

(T12 was hover-revealed row actions, used by Linear and Attio. Deliberately rejected for
Floor: the operator has named "intermittent buttons" as a failure, and hover-only
affordances also fail keyboard and touch. Floor's row actions are always present and
quiet. See §3.8.)

---

## 2 · Diagnosis of the current build

Screenshotted every page live on 2026-08-08 (build map-v18) and read the full CSS,
views and client. What follows is unsparing where it needs to be and names what
survives.

### 2.1 The global tells

**G1 · One hero template stamped on eight pages.** Every page opens with the same
eyebrow + display headline + lede paragraph + stat card block. It is a marketing
rhythm on working surfaces, and repeating it eight times is exactly the machine-made
texture the operator flagged: a template with the nouns swapped. A queue an SDR opens
every morning does not need to re-sell itself with "Which accounts, and when." in 40px
each time. Verdict: the narrative header survives only on the two case-making pages
(Impact, Day one). Working pages get a compact working header (§4).

**G2 · Card-and-panel as universal container.** `.panel` wraps everything: tables,
traces, footers, the impact model, even single paragraphs. Rounded corner + border +
shadow, boxes inside boxes (a stat card floating next to a hero, above three more
boxes). Per T3 and the Things/Vercel observations, containers this frequent stop
meaning anything. Verdict: the panel dies. §3.6 defines the three containers that
remain, and the default is none.

**G3 · Pills.** Nine chip species live in the CSS today: `.pill` bands, `.vd` verdict
chips, `.sig .kind` signal chips, `.src-kind`, the "connected" chip, `.verbatim`,
`.held`, `.grp-n` counters, and the filter buttons styled as a segmented pill tray.
Five different border radii, four font sizes between 9.5 and 12px, uppercase in some,
sentence case in others. This is the single strongest "AI did it" texture. Verdict:
the pill as a species is banned (§3.7). Every current pill has a named replacement.

**G4 · Approximate alignment.** Concrete instances found:
- Queue fit column stacks number + range + gauge; row heights vary by content, so the
  rank column's numerals do not sit on an even rhythm.
- The fit gauge clamps at 100M: DoorDash (258.7M mid) renders as a sliver crushed
  against the right edge with its mid tick outside the bar. The reading lies at exactly
  the moment the number is most impressive.
- The stat block's 26px figures and 10px captions share no baseline logic with the
  hero text beside them; the hero uses `align-items:flex-end` so the lockup's optical
  edge wanders with copy length (visibly different in Spanish).
- The trace grid (110/1fr/150/74/62/20) shares no columns with the evidence table
  above it; sections on the same page have unrelated internal grids (violates T2).
- Settings is shipped broken: the entire `.set-row / .set-label / .set-hint /
  .set-effect / .set-bar` family has no CSS at all, so labels, hints and effect lines
  collapse into run-on paragraphs with a stray "transactions / month" suffix and a raw
  save bar. This is the "still a lot broken" verdict made visible on one page.

**G5 · Motion without cause.** The live status dot glows with a halo at rest; the
connected source dot glows; the "next step" number glows. Per T6 these are decorative
claims of liveness. The only thing that ever actually happens on a resting page is
nothing. Verdict: at rest, nothing moves or glows, ever. Motion is reserved for
running work and state transitions (§3.9).

**G6 · Intermittent and shape-shifting controls.** "Assess now" exists only inside an
expanded unscored row; seventeen "Disable" buttons form a lawn down the rules table;
"Run eval" morphs its own label while running; the cool-down input silently POSTs and
reloads the whole page 700ms after you stop typing, yanking scroll position. Verdict:
actions live in deterministic places (row menu, page command bar), buttons never
change identity, and no input triggers navigation as a side effect.

**G7 · `location.reload()` as the state model.** Six mutations reload the entire page.
Filters, scroll position and in-progress reading are lost; the app feels like a
website. Verdict: T15. Mutations update the affected region and confirm inline.

**G8 · Truncation as layout.** "Why it sits here" ellipses mid-sentence with the full
text hidden in a title attribute (invisible on touch, invisible to most people);
signal descriptions are server-sliced at 64 characters. The product's best content,
its reasoning, is the thing being cut. Verdict: the queue row carries a one-line
reason sized to survive Spanish; the full reasoning lives one deterministic gesture
away (row expand), never in a tooltip.

**G9 · Navigation at its limit.** Eight top items plus status plus language switch in
one row; the active underline is drawn 15px below its own box, which breaks the moment
the header wraps (already close in Spanish). A ninth item (the map) does not fit this
scheme. Rebuilt in §4.1.

### 2.2 What is right and survives

- **The floor gauge.** Min-to-max range drawn against the qualification floor on a log
  track is the correct object for the product's central question. It survives with a
  fixed scale bug, a single row height, and promotion to the queue's visual spine.
- **Abstention has its own language** (graphite, dashed, never red). This is exactly
  "make the state a shape" and becomes a global law (§3.7).
- **Band as structure.** Group headers with the rule sentence inline, and sorting that
  reorders only inside a band, respect the ranking as the product's opinion. Keep.
- **The run trace.** Real tokens, cost, latency, stop reason, and a $0.00000 scorer row
  that lands the "arithmetic is code" argument. Keep, re-aligned to the page grid.
- **Honest empty states** (the eval three-step). Keep the honesty; restyle per §3.10.
- **Verbatim tagging** of stored English model output on the Spanish surface. Keep.
- **Server-resolved i18n with client fallbacks; the QA gate reading client bindings.**
  Keep both; the gate grows new checks (§6).
- **Disabled rules stay visible.** The L-10 lesson is already encoded; it becomes the
  general undo doctrine (§5.4).

### 2.3 Page notes beyond the global tells

- **Queue.** The strongest page conceptually and it still buries its spine: rank,
  name, gauge and reason compete with six other columns. Cool-down column spends 150px
  on a three-state word. Region and owner are 9.5px annotations. The row's expansion
  is good; its trigger (click anywhere) collides with text selection.
- **Account.** The verdict block is the right instinct trapped in a card; the four
  side stats (fit/timing/cool-down/confidence) are a second statgrid with different
  proportions; evidence table is solid but chips carry the verdicts; the critic's
  disagreement (the product's differentiator) reads as body text inside a cell.
- **Sources.** Three unrelated grids on one page (comparison rows, registry rows, rules
  table), none sharing columns. The registry's three-tick coverage meters are a decent
  compact encoding and survive restyled. The rules table is operationally excellent
  and visually a button lawn.
- **Accuracy.** Honest and clear. The gold table's repeated "Enter figure" ghost
  buttons are the same lawn pattern; the stat row prints em-width dashes as "no data"
  which reads fine but is styled as if it were data.
- **Impact.** The two-zone layout (inputs left, outputs right) is right. The output
  figures are boxed twice. The ACV refusal well is good product thinking and keeps its
  dashed treatment under the new system.
- **Backlog.** True cards are almost justified here (cards represent discrete work
  items) but five columns for five items produces two "Nothing here yet." zones on the
  demo day. Layout must collapse to populated columns.
- **Day one.** Six boxed articles with TODAY/WIRED rows; reads as a slide. The content
  is a comparison table wearing card costumes.
- **Settings.** Broken as shipped (G4). Also the only page with a save-bar pattern;
  everywhere else saves instantly. One doctrine must win (§4.8).

---

## 3 · The design system

Built once, enforced everywhere. Anything not in this section does not exist in the
product. (T13: closed vocabulary.)

### 3.1 Type

One text family, one mono family, both system, zero downloads:

```
--sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, system-ui, sans-serif;
--mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
```

The scale. Six sizes exist; no screen uses more than four (T11):

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `t-display` | 32 / 1.05, mono, -0.03em | 650 | Verdict figures, map headline numbers. Data only, never headings. |
| `t-title` | 21 / 1.2, -0.02em | 650 | Page title in the working header; account name. |
| `t-section` | 15 / 1.3, -0.01em | 600 | Section heads. |
| `t-body` | 14 / 1.55 | 400 | Prose, reasons, evidence values. |
| `t-data` | 13 / 1.45 | 400 | Table cells, list rows. Numerals mono. |
| `t-label` | 11 / 1.3, +0.08em, uppercase | 600 | Column headers, section eyebrows, axis labels. The only uppercase in the product. |

Rules:
- Weights: 400, 500, 600, 650. Nothing else.
- Every numeral in the product is tabular (`font-variant-numeric: tabular-nums`);
  every data numeral is mono. Units and currency symbols render in `--ink-3` at 0.85em
  so digits carry the line (T10).
- Hierarchy inside a level is weight and ink, never size. Two sizes never differ by
  less than 2px (kills today's 9.5/10/10.5/11/11.5/12/12.5 dust).
- The display hero (40px marketing headline) exists only on Impact and Day one, where
  the page genuinely is an argument.

### 3.2 Space and grid

- Base unit 4px. Scale: 4, 8, 12, 16, 24, 32, 48, 64. No other values. (Today's CSS
  contains 9, 11, 13, 14, 15, 17, 18, 22, 26px paddings; all die.)
- Page: max-width 1200px, 24px page gutters, centered. One content column; a 12-column
  mental grid governs where secondary rails split (rails are 4 or 5 of 12).
- **The shared-edge law (T2):** on any page, all full-width sections share the same
  left and right content edges. A table's first column text, a section head, and a
  paragraph all start at x=0 of the content box. No section indents itself because it
  happens to be in a different component. This single law does more against
  "not perfect alignment" than any other rule here.
- Rows: 44px standard data row (two-line rows in the queue are exactly 56), 36px dense
  row (rules, evidence), 32px control height, 28px compact control.
- Vertical rhythm between sections: 48. Between a section head and its content: 16.

### 3.3 Color

Paper and ink, one accent, three verdict hues, one held tone. Light theme only (the
product is used in daylight by a sales team; a second theme is scope without an
argument).

```
--paper:   #F6F6F4   the page
--well:    #EFEFEC   recessed zones (input clusters, code, rails)
--white:   #FFFFFF   overlay surfaces only (menus, dialogs, toasts)
--ink-1:   #17171B   primary text, filled marks
--ink-2:   #4C4C56   secondary text
--ink-3:   #80808C   captions, units, muted labels
--ink-4:   #ABABB6   disabled text, ghost marks
--line:    #E4E4E1   hairlines (1px, never 2)
--line-2:  #CFCFCC   control borders, dashed strokes
--accent:      #4B4EE0   interactive: links, focus, primary button, selection
--accent-down: #3639C4   hover/active of the above
--ok:      #1E7A5A   clears the floor, supported, eligible
--warn:    #96660A   borderline, cooling down, uncertain
--bad:     #AF2239   below the floor, unsupported, error
--held:    #3D3D52   abstained, unverified, operator-must-supply
```

Role laws, each one a sentence an implementer can check:

1. `--accent` means "you can act here" and nothing else. It never encodes a domain
   state. (Today indigo also means the "soon" band and the signal chips; that ends.)
2. `--ok / --warn / --bad` appear only in marks (gauge bars, verdict rules, status
   glyphs) and in the one-word status text they accompany. **Never as background
   tints, never as borders of containers, never on more than ~2 percent of a screen.**
   The current pastel chip backgrounds (`--pos-bg` etc.) are deleted.
3. `--held` is a first-class state, always paired with a dashed stroke, never red.
4. Grayscale carries everything else. If a screen looks wrong in a grayscale
   screenshot, it is wrong.
5. The coverage map is the single sanctioned dark surface (§4.4) with its own three
   tokens (`--field #0F1116`, `--lit #EFE7CF`, `--proj #8B93B8`). They exist nowhere
   else.

### 3.4 Elevation

Two planes. The page (flat, hairline-separated) and the overlay (menus, dialogs,
toasts) with the single shadow `0 12px 40px rgba(23,23,27,.16), 0 2px 8px
rgba(23,23,27,.08)` and radius 10. Nothing in the page plane has a shadow or a radius
larger than 6 (controls). The current `--sh-1` on every panel dies with the panel.

### 3.5 Containers: which exist at all

Exactly three, and the default is the first:

- **C0 · The section (default, no box).** A `t-label` eyebrow, an optional `t-section`
  head with an inline muted subtitle, a hairline beneath, content directly on the
  paper. Tables, lists, prose, stat rows all live this way.
- **C1 · The well.** A recessed `--well` area, radius 6, no border, no shadow. Only
  for: input clusters (the assess bar, impact inputs), verbatim/code payloads (trace
  detail), and rails that must read as "apparatus" beside content. A well never
  contains another well.
- **C2 · The overlay.** White, radius 10, the one shadow. Dialogs, the row action
  menu, toasts, the bulk bar. The only container allowed to float.

Boxes-with-borders as content framing are gone. The eight-page audit in §4 names what
replaces each current panel.

### 3.6 Stat rows (replacing the stat card)

The statgrid card becomes a **meter row**: figures set directly on the paper,
separated by hairlines, Stripe-style. `t-label` caption, `t-display`-or-smaller mono
figure, one-line `--ink-3` note. Baseline-aligned across the row by construction
(single flex row, `align-items: baseline`). No container. Where a figure is absent it
prints an `--ink-4` en dash and the note says why ("no eval run yet"), in words, not
in a quieter shade of pretend data.

### 3.7 State expression (the pill replacement table)

The law: **a state is a mark plus a word.** Marks are 10px geometric glyphs drawn with
currentColor; the word is `t-data` sentence case. Marks are the closed set:

| Mark | Meaning | Where |
|---|---|---|
| filled disc | positive/active: eligible, connected, live, supported | cool-down eligible, source connected, critic supported |
| half disc | partial: borderline, cooling down, partial coverage | borderline verdicts, suppressed rows, coverage partial |
| hollow disc | pending: not assessed, queued, unverified | unscored rows, gold candidates |
| hatched square (45° lines) | held: abstained, insufficient sample, operator must supply | abstain, map small-n, ACV blank |
| bar-pair (two short vertical bars, 1 to 3 filled) | graded level | coverage strong/partial/weak, confidence band |
| dashed ring | projected, not measured | wired-mode map, projected coverage |

Replacements, explicitly:
- Band pill → band header keeps its small square mark + name + count as plain text.
  On the account page the band renders as mark + word beside the score, no capsule.
- Verdict chip (`supported / uncertain / unsupported`) → mark + word in the verdict
  color, and the row's left 2px rule keeps the color coding for scanning.
- Signal kind chip → the kind becomes a `t-label` prefix in `--ink-3`
  ("EXPANSION · 2025-10-06") with no background. Dated signals read as datelines,
  which is what they are.
- "connected" chip → filled disc + "Connected" text.
- Counter chips (`.grp-n`) → plain mono count in `--ink-3`.
- Filter tray → real text tabs with counts, underline for the active one (same
  vocabulary as top nav), not a shadowed segmented pill.
- `verbatim` tag → keeps a bordered treatment (it genuinely labels foreign matter)
  but squared (radius 3), `t-label`, `--ink-3`; the one bordered inline label in the
  product, reserved for verbatim-English content on the Spanish surface.

**Uncertainty as shape (the star-luminosity principle, translated).** The reference
insight: a domain that only looks alive reads as a wide halo around a dark core; the
pathology is legible as a shape with no legend. Floor's equivalents, enforced:

1. A transaction estimate is drawn as its range bar on the log gauge. Confidence is
   the bar's solidity: ≥0.75 solid; 0.5 to 0.75 the bar renders at 60 percent ink;
   under 0.5 the mid tick goes hollow. A shaky number literally looks thinner.
2. An abstain is a dashed hollow slot where the gauge would be, in `--held`. The eye
   learns "dashes = the machine declined" in one session.
3. On the map, a small sample can never look confident: below `min_sample` the region
   renders hatched outline only, whatever its rate (§4.4).
4. Anything projected rather than measured renders dashed or outlined, never solid.
   Solid ink is a promise that a human can click through to a source.

The five-tick confidence meter dies: it is a second encoding of a number the gauge
already carries, and its 4px ticks are exactly the "component library texture" being
purged. Confidence prints as a plain mono percentage next to the range, and as bar
solidity per rule 1.

### 3.8 Controls and actions

- **Buttons.** Three, total: `primary` (accent fill, white text; at most one per
  view), `quiet` (transparent, 1px `--line-2`, ink text), `text` (accent text, no
  box). Destructive actions are `text` in `--bad` and always confirm (§5.4). Heights
  32 / compact 28, radius 6. No black button and indigo button competing (today's
  "Add accounts" black vs "Run assessment" indigo).
- **Row actions.** Every actionable row ends in a fixed 28px `⋯` quiet button, always
  rendered, opening a C2 menu (Open, Re-assess, Edit, Mark touched, Archive...).
  Deterministic position, keyboard reachable, no hover-only anything (rejects T12,
  answers "intermittent buttons" and "not know how to edit stuff").
- **Selection.** Checkbox column appears on the left of bulk-capable tables
  (accounts, gold, rules). Any checked count summons the C2 bulk bar bottom-center:
  "3 selected · Assess · Set owner · Export · Archive". Esc clears.
- **Inline editing (T14).** Single-value edits happen in place: click the value or
  choose Edit from the row menu, the cell becomes an input, Enter saves, Esc cancels,
  the row flashes its hairline in accent for 300ms on success. Dialogs are reserved
  for multi-field creation (add accounts, add rule, verify gold figure).
- **Forms.** Label above, `t-label`; input 32px; hint below in `--ink-3`; the
  consequence line ("re-grades every stored assessment on next load") in `--ink-2`.
  Focus: 2px accent ring at 2px offset. Errors: `--bad` text under the field, never
  only a red border.
- **No mutation reloads the page (T15).** Every POST updates the affected region and
  confirms with either the row flash or a C2 toast. Toasts appear bottom-left, hold
  8 seconds, and carry the undo when one exists (§5.4).

### 3.9 Motion

- Durations: 120ms hover/press, 180ms expand/collapse and menu, 240ms map crossfade.
  Easing `cubic-bezier(0.2, 0, 0, 1)`. Transform and opacity only.
- The only permitted looping animation is the stage progress sweep while a job is
  genuinely running, and it stops the moment the stage ends.
- At rest, nothing moves, pulses, glows, or shimmers. The live dot is a static filled
  disc; "live" is a state, and states hold still.
- `prefers-reduced-motion` collapses everything to instant with the progress sweep
  replaced by a static fill percentage.

### 3.10 Empty, loading, error (page-level doctrine)

- **Empty**: a short factual sentence plus the single next action, set in `t-body` at
  the position the content will occupy, inside a dashed `--line-2` outline (the
  deliberate-absence language). Never an illustration, never an apology. Copy states
  what will appear here and what makes it appear.
- **Loading**: server-rendered pages arrive complete, so page-level loading barely
  exists. Client-fetched regions (rules table) render their final layout with `--ink-4`
  placeholder rules of the correct row height (no shimmer), replaced in one pass.
- **Error**: inline where the action happened, `--bad` text, the failing detail
  verbatim, and a retry control. Errors never vanish on their own and never take the
  page down with them.

### 3.11 Bilingual layout rules

- Every fixed-width element is dimensioned against its Spanish string plus 10 percent.
  The QA gate enforces a rendered-width check on nav, buttons, and `t-label` rows in
  both languages (§6).
- No string concatenation across i18n keys; every sentence is one key. Counts and
  dates interpolate.
- The language switch moves into the identity cluster of the header as a two-state
  `EN / ES` text control, underline on the active one, adjacent to settings rather
  than floating at the far edge.
- Verbatim-English evidence on the Spanish surface keeps its label (§3.7); the rule
  extends to any stored model output rendered anywhere.

### 3.12 Keyboard

`/` focuses the queue filter; `j / k` move row focus; `Enter` expands; `e` opens the
row menu; `Esc` closes/clears; `1..6` switch band tabs on the queue. Hints render in
the control's title and a one-line footer legend on the queue (`t-label`, `--ink-4`).
No command palette in this rebuild; it is scope without a proven need. (Open item
§7.4.)

---

## 4 · Page by page

Build order and the reason for it. Each page is finished, in both languages, with all
states and its QA checks, before the next begins.

| # | Surface | Why this position |
|---|---|---|
| 0 | Foundation + shell | Tokens, header, table/list primitives, menus, toasts. Everything else consumes it. |
| 1 | Queue | The product. Daily surface, most rows, hardest alignment problems; proves the system or breaks it early. |
| 2 | Account detail | The trust surface; deepest content; consumes the queue's marks and gauge at large size. |
| 3 | Settings | Shipped broken today; small surface; forces the form primitives that Sources and Accuracy reuse. |
| 4 | Coverage map | The new argument. Needs only foundation plus the region panel patterns; early enough to demo, late enough to inherit stable primitives. |
| 5 | Sources | Registry + comparison + rules; reuses forms, tables, marks, and links to the map. |
| 6 | Accuracy | Reuses tables and empty-state doctrine; gold-set flows need the dialog and inline-edit patterns matured above. |
| 7 | Impact | Argument page; needs stat rows and wells. |
| 8 | Day one | Static argument content into the comparison-list pattern. |
| 9 | Backlog | Lowest operational stakes, only true-card candidate; last. |

### 4.0 Shell

- **Header, 52px, sticky.** Left: the Floor mark (kept) + wordmark + `t-label` context
  "Yuno SDR" separated by a hairline. Center-left: primary nav as text links in three
  clusters divided by 16px gaps and 1px hairlines: `Queue · Coverage` | `Sources ·
  Accuracy` | `Impact · Backlog · Day one`. Active page: 600 weight ink + 2px underline
  sitting on the header's own bottom border (not floating 15px below its box). Right
  cluster: budget/status, language `EN/ES`, Settings (gear glyph + word).
- **Status.** Static filled disc (`--ok` live / `--warn` cached) + word + mono
  remaining budget. No halo. Clicking it opens the Runs panel (§5.3).
- **Cached banner** survives as a full-width `--well` strip under the header with a
  half-disc mark, no yellow wash.
- **Footer**: unchanged content, `t-label` sizing, mono, quiet.
- Spanish nav fits by measurement (Cola, Cobertura, Fuentes, Precisión, Impacto,
  Backlog, Día uno, Ajustes); the QA width check guards it. Below 900px the nav
  scrolls horizontally with edge fades; nothing wraps, the underline cannot detach.

### 4.1 Queue `/`

**Purpose**: the Monday-morning worklist. Everything else on the page serves "which
row do I work next and why."

**Working header** (replaces the hero): one 44px row. Left: `t-title` "Queue" +
`--ink-3` inline count sentence ("38 accounts · 18 assessed · $0.2549 measured cost
per account", each figure sourced live). Right: the page's actions: quiet `Export
CSV`, primary `Add accounts`. The lede sentence about the three dimensions moves to a
one-time dismissible `--well` strip for first-run (state in localStorage), because the
person on visit forty does not need the pitch.

**Assess bar**: a C1 well directly under the header. Domain input (grows), last-touched
date, primary `Run assessment`. The three-sentence explainer compresses to one
`--ink-3` line: "Research, extract, adversarial critic. Two to four minutes, about
$0.29." While a run is active the well extends downward with the stage tracker (kept
as-is functionally: four stages, elapsed clock, per-stage times, sweep while running).
Result card and abstain card render in the same well using verdict/held vocabulary.
Errors persist inline with a `Retry` text button (G7 fix).

**Band tabs**: text tabs with counts (All 38 · Work now 9 · Queue next 2 · Abstained
6 · Cooling down 1 · Not assessed 20), active underline. Right of tabs: the filter
input (`/` focuses) and a quiet region select (feeds from map clicks via
`?region=EUROPE`). The cool-down tunable leaves this row; it belongs to Settings and
appears here only as a static annotation on the Cooling down band header ("45-day
window · change in Settings"), killing the silent-POST-and-reload input (G6).

**The table.** Full-width on the paper, no container. Columns, left to right:

| Col | Width | Content |
|---|---|---|
| select | 28 | checkbox (bulk bar per §3.8) |
| rank | 40 | mono, `--ink-3` |
| account | fluid min 220 | 500-weight name; second line `t-data mono --ink-3`: domain · region code · owner |
| fit | 260 fixed | the gauge as the row's spine (below) |
| timing | 200 | dateline signal: `t-label` kind + mono date, one line of description, single line, CSS-ellipsis with the full text in the expansion |
| cool-down | 120 | mark + word only (eligible / held until 2026-09-13 / fresh) |
| score | 64 | mono right |
| menu | 44 | the `⋯` row menu |

The "why it sits here" prose column is cut from the collapsed row (G8): its first
clause was always redundant with the gauge and band, and its truncation was the tell.
The full reasoning owns the expansion.

**Row heights are uniform 56px.** The fit cell renders one line: `21.4M` (mono, 600)
+ thin-space + `8.8M–52.5M` (`--ink-3`) above a 6px gauge. Gauge scale becomes 10k to
1B with labeled stops (10k, 100k, 1M, 10M, 100M, 1B); values above scale compress into
the final decade with a right-edge chevron on the bar meaning "beyond scale," so
DoorDash reads as huge instead of clipped (G4). Abstained rows render the dashed
hollow slot + "abstained, no estimate" in `--held`; not-assessed rows render a hollow
disc + "not assessed" in `--ink-4`; below-floor rows render their bar in `--bad` left
of the floor tick. The band never needs to be re-read from a chip: the gauge shape
already shows it.

**Expansion** (click row body, Enter, or the chevron; text selection no longer
triggers it: require click on non-text zones or the chevron): a full-width inset in
`--well` with the shared page columns:
- Left: "Why it sits at #4" `t-label`, full rank_reason `t-body`, then the five
  scoring dimensions as one hairline-separated meter row (fit, timing, confidence,
  region weight, total), each with its one-line explanation.
- Right rail (4 of 12): all timing signals as datelines with source links.
- Action row: `Open full evidence` (text button), plus the row menu's actions
  repeated as text buttons (Assess now / Re-assess, Mark touched, Edit, Archive).

**States.** Empty universe: dashed outline zone, "No accounts yet. Add accounts as
bare domains or CSV." + primary button. Empty band under filter: band header +
"none match the filter." Cached mode: assess controls disabled with the reason
inline, browsing and export untouched. Failed assessment: persistent inline error
with Retry. Import result: toast "12 accounts added, 2 duplicates skipped · View"
instead of a blind reload.

### 4.2 Account `/account/:domain`

**Purpose**: the evidence room. An SDR or a skeptic opens this to see whether the
number deserves belief.

- **Header**: breadcrumb "Queue ▸ Etsy". Then `t-title` name, inline mono domain link,
  then the identity line as inline editable fields (T14): region, owner, last touched.
  Right-aligned: score (mono `t-display` at 24) + band mark + word, and the page menu
  (`⋯`: Re-assess, View run history, Mark touched, Archive, Export row).
- **The reading** (replaces the verdict card): no box. A full-width band on the paper:
  verdict word in its color with its mark (`t-label`), the figure at `t-display`
  ("21.4M" + muted "txn / mo"), range + confidence in mono `--ink-3`, then the large
  gauge (kept, with the fixed 1B scale and floor flag) spanning the content width,
  scale labels beneath. The method sentence follows as `t-body` with its "derived from
  GMV at an assumed $20 to $120 AOV" assumption visible, not tucked in a card corner.
  - Abstained: the dashed hollow slot at the same scale position, `--held` word
    "Abstained, no estimate issued", the stored reason verbatim (tagged on ES), and
    the "this is enforced in code" note in one quiet line. Never red (kept law).
  - Never assessed: hollow disc + "Not assessed yet" + primary `Run assessment`
    inline.
- **Dimension row**: fit / timing / cool-down / confidence as one hairline meter row
  (§3.6) directly under the reading, each with its one-line consequence text. This
  kills the second statgrid look-alike.
- **Evidence table**: C0 section "Evidence · 13 claims · two independent judgements,
  allowed to disagree." Filter tabs (All / Supported 9 / Uncertain 4 / Unsupported).
  Columns: field (mono), value, method, source type (word only; its rule name on the
  row expansion), critic verdict (mark + word in verdict color; the critic note
  renders as a full-width second line in `--ink-2`, not a squeezed cell, because the
  critic's dissent is the product), source (host + ↗). Row keeps the 2px left rule in
  verdict color. Unsupported rows at 60 percent opacity (kept).
- **Signals**: dateline list, each with source link, plus `Add signal` (text button →
  dialog: kind, description, date, URL; §5 gap S1). Row menu per signal: edit,
  delete (with undo toast).
- **Run trace**: C0 section, rows aligned to the page grid (stage / model+effort /
  latency with inline bar / cost / tokens / chevron). Expansion in `--well` with the
  token grid and stop reason. The scorer row stays. New: link "View prior runs"
  opening run history (§5 gap A3).
- **States**: every section owns an honest empty (no signals: "No dated reasons found.
  Add one if you know something the research does not."). Deep-link to a domain with
  no account: a found-nothing page offering to add + assess it.

### 4.3 Settings `/settings`

Broken today; becomes the reference form page.

- Working header: "Settings" + the three measured figures inline (assessed, spent
  today vs cap, cost per account).
- Five C0 sections (Qualification, Model routing, Cost controls, Evidence
  classification, Impact model), each field on the §3.8 form pattern: label,
  control + suffix, hint, and the consequence line in `--ink-2` ("Re-grades every
  stored assessment on next page load, no re-run needed"), which is this page's best
  existing content, finally laid out.
- Save model: keep the explicit save bar (these knobs re-grade the world; deliberate
  commit is right) but as a sticky bottom C2 bar that appears only when dirty:
  "2 unsaved changes · Discard · Save changes", per-field changed markers (2px accent
  left rule on the row). Everywhere else in the product saves instantly; this page is
  the sanctioned exception and says so once at the top.
- Each numeric field validates inline (floor ≥ 1000, cap ≥ 0, weight 0 to 1) with
  `--bad` text under the field.
- New rows surfaced by the audit: reset-per-field ("↺ default" text button when value
  differs from shipped default), and a read-only "Changed 2026-08-02" annotation per
  field if/when the settings history lands (§5 gap SET2, needs API).

### 4.4 Coverage map `/coverage` (new)

**Purpose**: show in one look where Floor can qualify confidently today, where it is
blind, and what wiring specific sources would light up. This page is the investment
argument drawn as geography.

**Settled decisions honored**: recognisable world geography; five regions as the unit,
never countries; lit = can qualify confidently, dark = blind; a Today vs Wired toggle
that shows which regions light as unconnected sources are added; an SDR territory
overlay; sample size visible in the encoding so one assessment can never look
confident. Inline SVG, no tiles, no CDN. Data: `/api/coverage` (measured + projected)
and `/api/sources` (registry, coverage_now, coverage_wired).

**The field.** The map sits in a full-width C1 well painted `--field #0F1116`, the
product's single dark surface, because lit-versus-dark is the encoding and it needs a
night ground to be legible. Inside it, an inline SVG (`viewBox 0 0 960 470`,
hand-simplified low-poly landmasses, total path budget under 30KB) whose shapes are
merged per region:

- NORTHAMERICA: US + Canada
- LATAM: Mexico southward + Caribbean
- EUROPE: Europe to the Urals, including UK and Nordics
- AMEA: Africa + Middle East + Turkey
- APAC: the rest of Asia + Oceania
- Non-territory landmass (Greenland, Antarctica omitted; Russia east of the Urals
  drawn but unassigned): 1px `#232733` outline, non-interactive, so the world stays
  recognisable without implying coverage where no accounts exist.

**Encoding, Today mode (measured only):**

- Region fill lightness = measured qualification confidence, computed as
  `estimate_rate_pct` scaled by `median_confidence` from `/api/coverage`. Ramp from
  `#1A1D26` (0, blind) to `--lit #EFE7CF` (1, confident). North America today (67
  percent estimate rate, 0.78 median confidence) renders clearly lit; Europe slightly
  brighter on confidence, dimmer on rate; the difference is visible without a legend.
- **The sample-size law**: if `sample_too_small` (assessed < min_sample, today n<5),
  the region gets no luminance claim at all: hatched 45° strokes in `#2A2E3A` on the
  dark base, 1px dashed rim, and its printed label leads with the count. APAC today
  renders hatched with "n = 1 of 7". LATAM and AMEA hatch with "0 of 2". A region
  with one assessment cannot look confident because it never receives a fill.
- Each region carries a printed label block (SVG text, mono): region code, "9 of 16
  assessed", and its estimate rate when the sample is sufficient. Numbers printed on
  the field are the anti-area device: the region's area never encodes anything, and
  the label says what does.
- Region hover: 1px `--lit` rim at 40 percent. Selected: full rim + others dim 20
  percent.

**Wired mode.** The toggle (text tabs top-left of the field: "Today · Wired") swaps
the fill source to the projected coverage level per region (`coverage_wired` from the
registry: strong / partial / weak / none mapped to four lightness stops), rendered
with a **dashed rim and a subtle diagonal light-grain**, the global "projected, not
measured" treatment (§3.7 rule 4), in the cooler `--proj` tint rather than the warm
`--lit`. A fixed caption under the toggle states: "Wired is a projection from the
source registry, not a measurement." Flipping crossfades each region over 240ms with
a 40ms stagger west to east; reduced-motion swaps instantly. The point lands by
itself: flip to Wired and Europe and APAC go from dim or hatched to bright, and the
right rail lists exactly which sources did the lifting.

**SDR overlay.** A quiet toggle ("Territories") draws each region's owner set from
the queue data (owner field): a `t-label` tag pinned to the region ("SDR 1 · 14
accts"), plus 1px dotted boundaries between regions. Overlay works in both modes.
Regions with no owner print "unassigned" in `--ink-4`; never invented.

**The rail** (right, 4 of 12, on paper, outside the dark field on wide screens;
below it under 1000px). Content follows the selected region; before any selection it
shows the overall block ("12 of 18 assessed produced an estimate, 6 abstained").
Per region:
- Measured: accounts, assessed, estimate rate, median confidence, abstain causes as
  a small horizontal bar list with counts ("estimate rejected despite evidence · 3").
- What lights it up (Wired-mode data, always visible): top `volume_sources` with
  coverage mark, cost word, and `addressable_count` ("SEC EDGAR · free · would
  plausibly move 2 of 3 abstains"). Free sources sort first, matching the registry's
  order-of-attack argument.
- `View these accounts` → `/?region=EUROPE`.

**States.** Day-one empty (no assessments anywhere): the entire field hatches, the
rail explains that lighting is earned by assessments and links the queue; Wired mode
still works, because the registry is editorial, and the caption gets one extra
sentence making that explicit. Coverage endpoint failure: the field renders
outline-only with an inline error + retry; never a blank dark rectangle.

**QA hooks**: region paths carry `data-region` ids matched against the API's region
list; the gate fails if a region in the data has no shape or vice versa; both
language labels width-checked inside their label blocks.

### 4.5 Sources `/sources`

- Working header + the three counts inline (connected 1 of 10, free and unwired 2,
  regions 5).
- **Coverage comparison** section: now-vs-wired per region. Rebuilt on the shared
  column grid: region / Now (bar-pair mark + word) / arrow / Wired (dashed-ring mark +
  word, projected treatment) / "what does the lifting" contributor list. The arrow in
  accent only when the level rises. First line links "See it as a map ▸ /coverage".
- **Registry**: rows on paper, 44px: status mark + name + one-line "what" + kind as
  `t-label` text (no chip) + cost word + the five-region bar-pair strip (kept, it is
  a good compact encoding) + chevron. Expansion in `--well`: unlocks / limits / the
  per-region list, same grid as the comparison section above (T2).
- **Classification rules**: the operational core, de-lawned. Columns: order (mono),
  pattern (mono), classifies-as (word), weight (mono), claims matched (mono, right),
  why (`--ink-3`), and one `⋯` menu per row (Edit inline, Move up/down, Disable /
  Enable, Delete for non-builtin). The seventeen Disable buttons collapse into the
  menu; the primary action `Add rule` sits in the section head. Disabled rows: 50
  percent ink, "off" as mark + word, still present (kept law), menu offers Enable.
  - New: **duplicate guard** surfaced in the UI: entering a pattern that already
    exists shows "this pattern exists at order 30; with first match wins, this rule
    would never fire" and blocks save (LEARNINGS §10).
  - New: **rule tester**: a one-line input in the section head, "Test a URL"; typing
    a URL prints which rule matches and the resulting tier, live, read-only. Cheap,
    and it converts the rules table from faith to instrument.
  - The footer line (161 claims classified, 107 unmatched) is kept verbatim; it is
    good copy, now `t-body` on paper.

### 4.6 Accuracy `/evals`

- Meter row: floor calls correct, truth inside range, abstain rate, gold verified
  (0/22 with the en-dash-plus-reason treatment while empty).
- Latest eval section: the three-step honest empty survives restyled (numbered hollow
  discs, done steps filled); with data, the results table per current columns, marks
  replacing chips. `Run eval` is the page's one primary button; while running it gets
  the standard sweep, not a morphing label; on failure the error persists inline.
- Gold set: progress as a plain 4px bar + mono fraction on paper. Table rows carry
  one `Enter figure` text button each (not ghost-button lawn) and a `⋯` menu
  (Edit figure, Un-verify, View account, Remove candidate). New: `Add candidate`
  (dialog: domain, metric, where-to-find note) in the section head (§5 gap G2).
- Cross-link law: a gold row whose merchant has no assessment yet shows "not yet
  assessed · assess from the queue" inline, because eval needs both truth and
  prediction, and the current page makes the user discover that dependency by
  failure.
- Eval history (once >1 run): quiet list under Latest (date, n, floor-correct rate),
  each opening its full table read-only (§5 gap E2).

### 4.7 Impact `/model`

- Keeps its hero (it is an argument page) with the display headline and lede.
- Inputs stay in a left C1 well, outputs become a meter row grid on paper (no double
  boxing). Output figures `t-display` mono; recompute tick animation kept at 300ms
  color pulse (state change, so it earns motion).
- The ACV field keeps the dashed held treatment and its refusal copy verbatim: it is
  the product thesis in one form control. When ACV is set (here or in Settings), the
  annual-value figure renders solid; the ratio line cites the win-rate input it used.
- The closing paragraph ("the floor filter is the win-rate lever") survives as the
  page's last section, `t-body`, max 64ch.

### 4.8 Day one `/wired`

- Keeps a hero (case page). The six systems become one comparison list, not six
  cards: system name as `t-section` row, then two aligned rows Today / Wired sharing
  the global label column (T2), Wired rows carrying the projected dashed left rule.
  Scans as one table of promises instead of six boxes.
- "Honest constraints" list survives as a C0 section with square markers.

### 4.9 Backlog `/backlog`

- The one surface where cards are legitimate (discrete work items), so cards get
  defined here once: white on paper is wrong (paper is the page), so backlog cards
  are hairline-bordered, radius 6, no shadow, with status as a 2px left rule (idea
  gray / building accent / live ok) and mark + word inside. This is the only bordered
  content container in the product and it is scoped to this page.
- Columns render only when populated; empty areas collapse to a single dashed "no
  cards in Marketing yet · add one" strip, killing the two dead "Nothing here yet"
  columns.
- Cards get a `⋯` menu: Edit, Move status, Delete (undo toast). New card dialog kept,
  with gap and metric required (existing rule, now enforced with inline validation).

---

## 5 · Completeness audit

Every object a user can act on, every operation that should exist, where it lives,
and whether it exists today. "Missing (API)" flags operations that also need an
endpoint; everything else is interface work over existing routes.

### 5.1 The matrix

| Object | Operation | Today | Spec home | Notes |
|---|---|---|---|---|
| Account | add (bulk paste/CSV) | yes | queue `Add accounts` dialog | keep; result toast with counts, no reload |
| Account | add (single) | implicit via assess | assess bar creates + assesses | make explicit in copy |
| Account | edit name / region / owner / last-touched | **no** | inline on account header; row menu Edit on queue | Missing (API: PATCH /api/account) |
| Account | archive (soft remove) | **no** | row menu + bulk bar; Archived filter view on queue | Missing (API). Archive, never hard delete; undo toast + restore from Archived view |
| Account | bulk select: assess, set owner, export, archive | **no** | checkbox column + bulk bar | Missing (API for bulk where needed) |
| Account | mark touched today | **no** | row menu + account page | the core SDR loop: working an account must start its cool-down; one click, undo toast. Missing (API) |
| Account | re-assess | only unscored rows | row menu + account page menu, always | exists (POST /api/assess); UI must expose it for assessed accounts too |
| Account | export CSV | yes (global) | keep; bulk bar exports selection; export honors active filters | filter-scoped export Missing (API param) |
| Assessment run | view latest | yes | account page | keep |
| Assessment run | view history of runs | **no** (A3) | account page "View prior runs" list, read-only diff of figures | Missing (API list) |
| Assessment run | delete a bad run | **no** | run history row menu; latest falls back to prior | Missing (API). Confirm + undo window |
| Assessment run | cancel in-flight | **no** | stage tracker gets quiet Cancel; Runs panel | Missing (API) |
| Job | see queued/running/failed | only while watching | **Runs panel** (§5.3) | Missing (API list) |
| Job | retry failed | **no** | Runs panel row | re-enqueue via existing assess route |
| Evidence claim | inspect, follow source | yes | keep | claims are pipeline-owned: no editing, by design; state that on the page |
| Signal | add manual (S1) | **no** | account page `Add signal` dialog | SDRs know dated facts the research cannot see. Missing (API) |
| Signal | edit / delete manual | **no** | signal row menu | model-derived signals read-only, labelled; manual ones editable |
| Source rule | add | yes | keep + duplicate guard | |
| Source rule | edit pattern/tier/weight/order/note | **no** | row menu Edit, inline | Missing (API: PATCH; POST exists for add/toggle/delete) |
| Source rule | enable/disable | yes | row menu | disabled stays visible (kept law) |
| Source rule | delete (non-builtin) | yes | row menu, confirm + undo toast | |
| Source rule | reorder | numeric position only | Move up/down in menu; position editable inline | |
| Source rule | test a URL | **no** | rule tester (§4.5) | pure client + existing classify logic exposed read-only. Missing (API: GET classify?url=) |
| Registry source | read, expand | yes | keep | registry is editorial config in code; changing it is a deploy, and the page says so |
| Gold candidate | verify (enter figure) | yes | keep dialog; validate URL + number | |
| Gold candidate | edit / un-verify | **no** | row menu | wrong entry currently permanent. Missing (API) |
| Gold candidate | add / remove candidate | **no** | section head `Add candidate`; row menu Remove | Missing (API) |
| Eval run | run | yes | keep | |
| Eval run | view history / open old run | **no** | history list (§4.6) | Missing (API list) |
| Backlog card | add | yes | keep + validation | |
| Backlog card | edit / move status / delete | **no** | card menu | Missing (API) |
| Setting | edit + save | yes (page broken) | §4.3 | |
| Setting | reset to default | **no** | per-field ↺ | defaults shipped in code; UI-only |
| Setting | change history | **no** | per-field annotation | Missing (API); lowest priority, listed for honesty |
| Budget | see spend today | yes (header) | keep; Runs panel shows per-run cost list | per-day log Missing (API) |
| Language | switch, persist | yes | header EN/ES | keep |
| Navigation | global account search | filter on queue only | header search on every page (jumps to account) | client-side over /api/queue |

### 5.2 Interaction placement rules

So nobody ever again "doesn't know how to add accounts, or remove them, or edit
stuff": every object obeys the same grammar. **Create** lives in the section head of
the object's list. **Edit** is inline on the object's own field or in its row menu.
**Destroy** is only in the row menu, always confirmed, always undoable. **Bulk** is
the checkbox + bottom bar. The row menu is always rendered, always in the last
column, always `⋯`. One grammar, learned once.

### 5.3 The Runs panel

A C2 slide-over from the header status cluster (badge with count when anything is
queued or running): every job with domain, stage, elapsed, cost so far; failed jobs
persist with the error verbatim and `Retry` / `Dismiss`; completed jobs from today
with cost. This surface fixes three audit rows at once (visibility, retry, cancel)
and gives spend a face. Errors no longer evaporate on reload (G7).

### 5.4 The undo doctrine

- Every destructive action confirms in place (menu item → "Delete rule? · Delete /
  Cancel" swap inside the menu, not a browser confirm()).
- Every completed destructive action posts a toast with `Undo` for 8 seconds.
- Soft-destroy is the default: accounts archive, rules disable, gold rows un-verify.
  Hard delete exists only where the object is trivially recreatable (a backlog card,
  a rule) and even then goes through the toast.
- **No action may remove its own reversal from the interface** (LEARNINGS §10, now a
  design law): disabled rules stay listed with Enable; archived accounts stay
  reachable through the Archived view with Restore; an un-verified gold row returns
  to the pending list, not to nowhere.
- The QA gate grows a check: for every mutating control in the client, an inverse
  control must exist in the rendered page or its menu template (§6).

---

## 6 · QA gate extensions

`scripts/qa.mjs` already reads client bindings, shapes, links and hygiene. The
rebuild adds, per page and per language:

1. **i18n parity**: every key referenced in views and client exists in both `en` and
   `es`; fail on fallback-to-English of an authored key.
2. **Width guard**: rendered pixel width of nav items, buttons, tab labels and
   `t-label` strings measured in both languages against their container budget.
3. **Vocabulary lint**: fail on any class outside the closed set (no `.pill`, no new
   chip species), on any border-radius > 10, on any box-shadow that is not the one
   token, on any animation not in the sanctioned list.
4. **Alignment probe**: for each page, assert the left x of the first content node of
   every section is identical (the shared-edge law, checkable in jsdom via computed
   layout of the fixed-width shell).
5. **Undo audit** (§5.4): every `data-action="destroy:*"` control has a matching
   `data-action="restore:*"` or undo template in the page.
6. Existing em-dash, `undefined`, `NaN`, and remote-asset scans continue, both
   languages, every page, including the new map SVG (no external refs).

---

## 7 · Left open for the operator

Recommendations are made through the document; these are the calls that are genuinely
his:

1. **Accent**: the spec keeps Yuno indigo `#4B4EE0` as the single interactive accent
   (it is the client's color and it reads as intentional). Alternative: all-ink
   interaction (Vercel-style) with indigo removed entirely. Recommendation: keep
   indigo. Decide before Phase 0.
2. **The dark map field**: §4.4 makes the coverage map the product's only dark
   surface because lit-versus-dark needs a night ground. If a single dark inset in a
   paper product feels wrong to him, the fallback is a light field with luminance
   inverted into ink density (dark = confident), which is honest but loses the
   literal "lit means live" reading. Recommendation: the dark field.
3. **Nav shape**: flat eight items in three clusters (spec) versus demoting Backlog
   and Day one into a single "Case" page with internal tabs. Flat is specced;
   demotion saves 160px of header at the cost of one more click on demo day.
4. **Command palette**: excluded from this rebuild (§3.12). Say the word and it slots
   in after Phase 2 without touching the system.
5. **Assessment history retention**: keep every run forever (spec assumes yes; D1
   rows are cheap and the trace is the audit trail) or cap at last N per account.
6. **Mark touched semantics**: writing `last_touched_at` from the row menu makes
   Floor a co-source of touch truth before the CRM wiring lands. Useful on Monday,
   arguably a fork of the truth. Spec includes it; he may want it held until
   Salesforce activity is wired.
