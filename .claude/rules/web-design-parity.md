---
paths:
  - 'apps/web/**/*.{ts,tsx,css}'
---

# Orla frontend: the design is a contract

`design/Orla - Screens.dc.html` holds the 1440x900 reference frames and **is the
acceptance criterion**. `design/design-plan/` explains them — tokens, brand,
component vocabulary, layout laws, one file per screen, responsive, voice. Where
the two disagree, build the frame and correct the plan. The blurbs above each
frame are not spec; read the markup.

Design passes edit the plan. Tickets write the code. Never the reverse.

## Parity is 1:1 on six axes

No screen carrying a frame ships until it has been driven in a real browser at
1440x900 and compared on **layout, style, colour, font, text and access**. Text
means the literal strings — same wording, capitalisation and punctuation. Access
means the six accessibility laws in `04-laws.md` and the contrast table in
`01-foundations.md`: nothing else in this repository verifies either, so the
parity pass is their only gate. The approved
strings are in `design/design-plan/31-content-voice.md`; the full procedure is in
`design/design-plan/04-laws.md`.

Only three things may differ: real content, real data volume, and real photography
in place of the labelled placeholders. Same content in a different composition has
failed — the composition _is_ the design. Same composition with reworded copy has
failed too — the words _are_ the design.

Delegate the comparison to the `parity-checker` agent rather than eyeballing it.

## Corroborate a number before you build it

The frames are trustworthy as **composition**, not as **arithmetic**. Composition
is authored; numbers are transcribed, and transcription drifts.

**Before building any measurement off a frame, read it at the widths either
side.** A value that disagrees with _both_ neighbours is the middle frame being
wrong, not a ladder step — `27 Search results — 1024` held five such values at
once, and one price that had shipped as a mangled fragment of its own style
attribute. Ruled 2026-09-04 (D30); the worked example is in `04-laws.md`.

**Where a ruling has already overruled a frame, the frame is the record of what
was overruled.** Do not file it again. Live overrides: sub-16px avatar monograms
render Instrument Sans though the frames draw serif (D24); **no trigger draws the
`▾` the frames draw except the vendor-type picker** (D25, amended by #426 on
2026-09-06); and `01-foundations.md` records two colour values as accepted
deviations. The caret has been re-filed four times.

**The caret exception, both ways round (#426).** The account holder asked for it
back on the vendor-type segment of the landing hero and of `/search` — one
control, `CategorySelect`, which both surfaces mount. So a parity pass reads it
in **two** directions, and only one of them is a finding:

- On frames `01 Landing`, `02 Search` and `28 Dropdown open — hero`, the caret is
  **expected** and its absence is a real defect. It is `▾` closed in `stone-600`
  and `▴` open in `clay-600` — `clay-600` and not frame `28`'s `#B4552F`, because
  `clay-400` is a fill and never text on cream.
- On the other thirteen sites, the frames draw a caret and the app must not.
  That is still D25 and still not a finding. `app/dropdown-caret.test.ts`
  enforces it and exempts exactly one file.

**The open state is both signals, deliberately.** The value turns
`font-semibold text-clay-600` **and** the caret flips — `42-dropdowns.md` states
it that way and frame `28` draws both. A pass that reports one of them as
redundant is re-opening a ruling. City draws no caret in any frame and correctly
has none; it signals open through the clay value alone.

**Six more overrides, ruled 2026-09-06 (#372).** The parity close-out ended
these; a pass that re-finds one is looking at the record of a decision, not at
drift.

- **The notification bell stays.** Frame `02` draws no bell in the signed-in
  cluster; the app has one with real behaviour behind it. The account holder
  ruled _"notification bell is fine as is"_ — the frame predates the feature.
- ~~**`StatusPill` keeps its sizing.**~~ **Retired 2026-09-07 — the difference
  is gone.** This excepted the component computing `700 11px` / `6px 10px`
  against frame `13`'s `700 10px` / `5px 10px`. It now computes the frame's
  values exactly: `text-pill` resolves to `10px` (`theme.css:157`), with
  `py-[5px]`, `px-2.5` and `font-bold`. **An override describing a difference
  that no longer exists is worse than none** — it sends the next pass hunting
  for something that is not there. Verified against the component and the token
  before removal, not taken on report.
- **The app writes "they".** Frame `04` writes _"the more **she** knows"_.
  Vendor gender is unknown at render time. Ruled _"Pronouns are fine as is..
  the frame is just literally design."_
- **The Refine bar's chip treatment is already correct.** Frame `02` draws
  `$500 – $3,200 ▾` for the price range and `4★ & up ✕` for rating, and that
  distinction is deliberate — a range is a value you adjust, not a filter you
  tick off. `refine-bar.tsx` documents it. **Do not add a dismiss to the price
  chip.** `Clear` in the action row is correct too.
- **The `Book another vendor` tile stays `stone-400`.** Frame `07` draws its
  dashed border `#DDD5C7`, a value no token holds and no other frame draws;
  frame `19`'s empty panel and frame `20`'s request pane both draw the same
  affordance at `#D5CEC2` (`stone-400`). One frame against two corroborating
  siblings is transcription drift.
- **The relaxation row's order is the frame's principle, not its list.** Frame
  `18` draws `Search within 100 mi` · `Any price` · `Any date`, leading with
  the filter its diagnosis blames. There is no distance filter in this product,
  and `relaxations.ts` applies exactly that principle to the filters that do
  exist — narrowest first, and the first button is the one the diagnosis names.
  The frame's surviving price-before-date order is an artefact of a filter that
  was removed.

**Frame `13`'s filter bar has four dropdowns, not three (#433, measured 2026-09-07).**
The frame and `22-admin.md` both draw three; the app adds `Status`. **Measured and
accepted**: `Export CSV` lands at x=1347.1 against the frame's 1348.1, so the
right anchor has not moved, and the slack goes 361.5px to 321.8px — smaller than
it looks, because D25's caret removal had already given back ~10.4px per trigger,
so without `Status` the app would sit ~35px _looser_ than the frame. Worst
realistic case 201.8px, no wrap, no overflow, `scrollWidth === clientWidth` in
every state. Re-found by a second pass on 2026-09-07 because this entry did not
exist yet; it does now.

**An actions menu is not governed by `42-dropdowns.md`'s Tab clause (#435, ruled
2026-09-07).** That clause — _"`Tab` closes and moves on. Focus returns to the
field on close"_ — sits in a bullet about ↑↓ moving, ↵ committing and typing
narrowing the list in place, i.e. the **select/combobox shell**, a pattern that
selects a value. A row-actions menu is an ARIA menu button, and returning focus
to its trigger on close is that pattern's conventional behaviour — and is also
what the clause's own second sentence asks for. So: panel closes, `aria-expanded`
goes `false`, focus parks on the trigger. Reaching the next control costs one
extra Tab, and that is correct rather than a defect.

**Do not "fix" it by hand-rolling a tab-order walk.** Radix's menu keydown
handling sits between the component's handler and the browser default, so
declining to `preventDefault` does not hand the key back — and the admin table's
server render draws every row action **twice** (the grid and the `md:hidden` card
list), which is precisely the DOM that makes a naive next-focusable query select
the wrong element. The same duplicate made `Actions for <vendor>` resolve to two
buttons under Playwright strict mode; **VEN-395 fixed the shared cause** in
`DataTable` — `TableBranch` unmounts the branch the viewport is not using once
hydrated, so after hydration each control exists once. Before hydration both
still exist, so a walk or a locator must wait for it (`e2e/hydration.ts`).

**The filtered-empty state does not print the delta's "Widening any one of them
finds something:" (VEN-395).** `design/delta-admin/Orla-Admin-Views.html:140`
draws it, but a route is drawn only when it reveals rows, so with two filters and
one productive widening the sentence is false. The line states how many filters
are narrowing the view and lets the counted buttons speak; only when no route is
drawn does it add that widening still finds nothing. A parity pass reading the
missing clause is looking at this ruling.

**The Refine bar's search field has a visible `Search` label (VEN-395).** Frame
`13` draws the field with only a placeholder, which disappears on the first
keystroke; `04-laws.md` requires a label that stays. The word sits before the
field and shifts the controls right within the bar's slack.

**A retired vendor's row draws no `···` control (#433, ruled 2026-09-07).**
Frame `13` draws the row-actions control in all fifteen rows. A retired account
correctly has none: `setUserBanned` answers 404 on a soft-deleted user, so the
control would open a destructive confirmation dialog for an action that cannot
succeed. The frame cannot arbitrate this — the retired state postdates it. A
parity pass reporting the missing control on that row is reading the record of a
decision, not drift.

**Three from the site footer (#441, ruled 2026-09-07).** The footer's only
frame is the closing-band bundle under `design/delta-band/`, which draws it
twice. All three of these are decisions, not drift:

- **The column micro-labels render 600 weight / 0.05em**, where that bundle's
  `.lbl` says 500 / 0.07em. `.lbl` is one shared primitive and **three** other
  bundles define it at 600 / 0.05em — the screens document, `delta-legal` and
  `contact-support`. One frame against three corroborating siblings is D30, and
  `--tracking-label` is global, so building the outlier would restyle every
  micro-label in the product.
- **The footer wordmark renders 27.2px**, where the frame draws 25px.
  `WORDMARK_SIZE_RATIO` is 1.60 D. The frames draw three ratios — D=15 → 23,
  D=17 → 25, D=20 → 32 — so no single one satisfies them. `WORDMARK_SIZES`
  exists since VEN-388 but holds only the corroborated D=15 → 23 (the desktop
  header, including the admin header); measuring D=17 is **#118's**.
- **The admin header's operator line renders `stone-480`** (`#d8d0c2`), where
  frame `13` draws `#D5CEC2` — which is `stone-400`'s hex. That is the frame
  naming a colour rather than a role: `stone-400` is a **border** value, drawn
  on a light ground at thirty-nine sites and as text on ink at none. The two
  steps are three units apart, so the line renders as it did and only its
  meaning changed. The wider class is **#447**.

**The logo mark paints a 19px outline circle where a delta frame draws 17
(#449, ruled 2026-09-07).** `box-content` stands and **#250 is upheld** — the
screens document is the primary contract and the delta bundles are supplements
to it, so `logo.tsx` does not change and the mark does not move on the desktop
header, the auth panel, the favicon or the app icon. **A `delta-band` parity read
measuring 19-against-17 is looking at this ruling. Do not re-file it.**

The mechanism, which still governs every bordered box: `Orla - Screens.dc.html`
ships no `*` reset, so it is content-box, which is what #250 measured;
`delta-band`, `delta-legal` and `delta-vendors` each set
`* { box-sizing: border-box; }`, so those draw the mark as two equal footprints.
**`delta-admin` and `contact-support` ship no reset either** (recounted
2026-09-15, VEN-415: `delta-admin` has zero `box-sizing` declarations;
`contact-support`'s two are a class rule and an inline style, not a `*` rule),
so the split is **three content-box documents against three border-box
bundles**, not one against three — which is why D30's
one-frame-against-corroborating-siblings reading does not decide this and primacy
does. **Grep `box-sizing` in the specific bundle a pass is reading before arguing
about any bordered box in it**, in both directions.

**A border or surface token used as text on an ink ground is machine-checked
(#447, 2026-09-07).** `apps/web/src/testing/token-roles.ts` holds `STONE_ROLES`,
the declared role of every `--color-stone-*` step, and is the source of truth for
which steps may be `text-*` at all; `token-role-guard.test.ts` walks the JSX
subtree of every element carrying a **bare** ink fill (`bg-stone-900` /
`bg-stone-950` with no alpha — an alpha is a scrim, not a ground) and resolves
hoisted `const NAME = '…'` class strings, which is what makes it reach the
footer's `LINK_CLASS`. `theme-tokens.test.ts` refuses a step with no declared
role and spreads the contrast table's ink half from the same table rather than
hand-listing it.

So a parity pass finding `stone-400` as text on ink should expect the suite to
have caught it already. **Treat a miss as a gap in the guard and widen it, rather
than filing a fifth instance** — the four historical ones (#430's closing band,
#441's admin header, #441's legal hairline, and the 78%-alpha-of-`stone-50` that
minted the ink ramp) are fixtures in that suite. The per-call-site guards stay:
each also pins the exact token its frame names, which is a parity assertion the
law cannot make, and a negative assertion at a call site records that _this_
site got it wrong once — history the law does not carry.

**The law covers ink grounds only, and that limit is principled rather than
lazy. Do not read it as closing the whole class.** On an ink ground the ground is
observable, so a wrong role is decidable. On a **light** ground it is not:
`stone-400` is legitimate `text-*` at four sites (`ui/empty-state.tsx`,
`vendors/profile/review-form.tsx`, and two in `components/packages/package-manager.tsx` —
all decorative glyphs), and no source scan can separate those from a mistake. So
**"wrong role on a light ground" remains entirely unguarded** — no test, no lint,
nothing. A fifth instance of _that_ shape is a new finding and not a regression
in #447.

`INK_GROUND` is **derived from `STONE_ROLES`**, not a literal pattern, so
declaring a third ink ground updates the guard automatically. It got there the
right way: the first version wrote the character class `bg-stone-9[05]0` and
`design-tokens.test.ts`'s ratchet flagged the truncated `bg-stone-9` as a utility
naming a ramp step that does not exist. **An existing guard catching the new
guard's own text is the system working** — and the ratchet is at zero, so do not
add a line to it to get past something.

**The Florals category no longer exists (#419, ruled 2026-09-06).** It was
folded into `Decor`, so the taxonomy is ten categories and three frames now
draw a category the product does not have. All three are overruled, not drift:

- `01 Landing` — the jump row draws `Photography · Florals · Catering ·
Entertainment` and renders `Photography · Catering · Entertainment · Beauty`,
  the four and the order the account holder ruled; the fifth category card
  draws `Florals / Bouquets & decor` and renders `Decor / Flowers & styling` on
  the same photograph; `All 11 categories →` reads `All 10`, because the count
  is read from the database.
- `06 Booking confirmed` — the cross-sell chips draw `Florals · Live music ·
Catering · Cake` and render `Decor · Live music · Catering · Carts`. Two of
  the frame's four named slugs (`live-music`, `cake`) were **never** seeded
  categories, so those chips opened a search filtered on nothing and drew an
  empty grid. Every chip now points at a slug the taxonomy holds; restoring the
  frame's words would restore the broken links.
- `13 Admin — vendors` draws `Florals` in its table rows and in a filter pill.
  That is sample data in a frame, not a claim about the taxonomy, but it will
  read as a mismatch against a real admin table.

A parity pass over any of the three reports these as expected deviations. The
frames are corrected by a design pass, not by a ticket.

**The admin delta's four live overrides (#454, 2026-09-07).** Each is a case
where the bundle and a _product-wide_ rule disagree, and the product-wide rule
holds — none of them is drift, and a parity pass reports all four as expected.

- **`/admin/activity` prints `Sep 7, 2026` where the bundle draws `7 Sep
2026`.** `31-content-voice.md` rules the product US English and the day-first
  order is the British form. The **24-hour clock is taken** from the bundle: it
  is what "absolute to the minute" means, and `2:02 PM` is a form a reader has
  to disambiguate before comparing two rows.
- **The same column keeps its `UTC` suffix, which the bundle draws without.**
  The frame's is a mock timestamp rather than a ruling against a zone, and the
  reason the zone is there is unaddressed by it: the console renders in UTC
  throughout, so a stamp quoted out of this table into a support thread is off
  by the reader's offset unless the zone travels with it.
- **A `—` renders `stone-600` where the bundle's `.dz` is `#C9C1B5`.** That hex
  is this theme's `stone-500`, annotated _disabled text ONLY — fails AA by
  design_. On `/admin/cases` the dash is the **entire content** of the Booking
  cell rather than an adornment beside something legible, so `04-laws.md`'s
  contrast floor governs.
- **Money prints `$2,314` where the bundle draws `$2,314.00`.** `formatPrice`
  drops the cents on a round amount, and it is the shared formatter every price
  in the product goes through. Changing it is a product-wide decision, not a
  console parity fix.

**Two colour entries in the delta are overruled, and both are ruled rather than
open (#454, 2026-09-07).** The bundle is an _admin_ bundle and these pills are
drawn on the customer hub and the request detail as well as the console;
`/admin/requests` (VEN-399) draws both from the same `REQUEST_PRESENTATION` the
hub reads. So the product-wide file wins in both cases, and the bundle's
table is corrected as transcription drift under D30 — the same direction its
`holds payouts` line went.

- **`quoted` stays steel.** `03-components.md` line 29 rules
  `QUOTED steel-50 / steel-600`; the delta's table says gold. Ruled by the
  account holder: `03-components.md` stands, nothing is restyled, and
  `/admin/requests` draws it steel (VEN-399).
- **`accepted` stays clay.** The delta calls it _settled_ and colours it sage.
  `needsYou` is the only tone that spends clay and it means **waiting on this
  user** — an accepted request is waiting on the customer to pay, which is
  exactly why the hub draws it that way. Sage would say the transaction is done
  on the screen where it is least done.

Neither is a finding and neither is re-litigated per screen.
`admin-delta-parity.test.ts` pins both with the ruling beside them.

**Two console screens from the admin delta, ruled on landing (VEN-399).**

- **The booking detail's Money card carries `Payout model` and `Completed`**,
  which the delta's event-order row list omits, and a `Payout` state row where
  `payout_released_at` has not fired. VEN-399's acceptance names both columns,
  and a released-or-not reading is the one question the list cannot answer.
  Additive rows in the event order, not a recomposition.
- **`/admin/requests` lights no segment when no group is chosen.** The bare
  route lists every status; `Live` is a filter, not the default, so drawing it
  lit would misstate the rows. A pass reading an unlit control on the bare URL
  is looking at this ruling.

**The body is 13.5px; the frames' bodies are 16px (VEN-389, measured
2026-09-14).** `globals.css` declares `body { font-size: var(--text-base) }`.
`Orla - Screens.dc.html` declares no body size, so a frame wrapper with no
`font-size` of its own sits at the browser's 16px. One visible label changed
size — the mobile hero `Search` button, which has no `text-*` step below `sm`
(below). Every other visible glyph carries a step and did not move; what moved
is the invisible **strut** — the line box an unsized block builds around a
smaller inline child.
Each site was measured by rendering its route at both body sizes, and ruled:

- **`27 Landing — 1024`: the hero column is 2px shorter than the frame, so the
  search row sits 2px higher** (column 177.4 → 175.4). The frame's badge is an
  `inline-flex` inside a 16px `padding-right:22px` div, so the frame has the
  strut and the app no longer does. Accepted: restoring it means a per-site
  `text-lg` on a wrapper that draws no text, and `01 Landing` at 1440 moved 0px.
- **Closer to the frame, not deviations:** `14 Landing mobile`'s `Search` button
  is 13.5px, the frame's `.btnP` exactly (was 16px; 42 → 38px tall). Frame
  `27`/`14` vendor dashboard `Needs you` heading 20 → 16px against the frame's
  `.lbl` + 9px margin. Frame `07`'s `Booking for something new?` card 106.5 →
  102.5px — the frame's last line is a block, so it has no strut either.
- **Inert:** frame `13`'s `Export CSV` wrapper 20 → 16px; the filter row's height
  is set by the search input and #433's x-anchor is unchanged.
- **No frame counterpart:** the vendor profile's report-link block (−4px), the
  pending booking detail column (−3px), and
  `/admin/settings` launch-switch rows (−4px each; `00-README.md:96` exempts it).
- **Fixed at the site:** `VendorSurface`'s heading block was `max-w-prose`, and
  `ch` follows the inherited size — it narrowed 400.2 → 337.7px and wrapped the
  packages description a line further. It is `max-w-100` now.
- **Held:** the footer (`1b8435f3`) measures 289px tall, a 27px link pitch in all
  three columns and a 0px copyright-to-legal-links baseline delta.

Zero visible resizes on every other ledger route, including `28` open, `22`
submitted and `23` offline. A pass measuring any number above is reading this
ruling; a width in `ch` or `em` on an unsized block is the class to look for.

## A one-shot read is a sample, not a measurement

An animated property has no single computed value. Read it once, in the same
tick as the interaction that started it, and you capture whatever keyframe
happened to be current — then report it as fact.

**Sample twice and compare. A value that differs between two reads was never a
measurement.** That is one extra line, and it is the whole guard.

Four instances of this in one night, 2026-08-30, and **none was a wrong value —
each was a right value answering a question nobody had asked**:

- A focus ring read in the same tick as the keypress computed as five
  transparent entries with `outline: 3px none`, and was reported as a broken
  `Button` primitive. `transition-all` animates Tailwind v4's ring custom
  properties; at 250ms it paints correctly. (The real defect was smaller: every
  keyboard stop spent 150ms with no indicator.)
- The same artefact produced `calc(0px + 0px)` and "2px ring, 0px offset" in a
  second pass, and those figures reached a ticket as evidence.
- A PR watcher matched _any_ failing check rather than the required one, and
  abandoned a live merge because a rate-limited Vercel had gone red.
- An upload test's mock honoured an `AbortSignal` only when it finished,
  modelling abort as unconditionally effective — encoding the bug as correct
  behaviour and hiding it from a passing suite.

The shared tell: **an automated check confidently reporting something it never
established.** Time is the commonest way that happens, but not the only one.

Separate the two halves in any finding. A **class-level fact** read from the
source — `focus-visible:ring-0` is a static suppression — survives, because no
timing explains it away. A **number measured mid-interpolation** does not, and
must not be quoted as though it were reproducible.

### A property is not a measurement until the element has extent

Two more from the same night, neither of them about timing:

- A hero divider was given `h-full` to draw a full-height rule. `height:100%` on
  a flex item resolves against the container's height, and that container's
  height came from its own content — indefinite — so it computed to **0**. Both
  hairlines were invisible and the bar read as one undivided field, while a
  `background-color` assertion still passed: it was reading a real colour off a
  zero-height box.
- `scrollWidth <= clientWidth` in jsdom is `0 <= 0`. It passes against the
  broken version, because jsdom performs no layout.

**Assert extent alongside the property.** A colour, a border or a radius on an
element of zero width or height has passed on nothing. Where a check cannot
fail — jsdom geometry, an unrendered node — assert the class-level fact instead
and say in the test's own comment that the rendered result is unverified. Owed
and named beats faked.

The general form, covering all six: **before trusting a check, ask what state
would make it fail. If nothing would, it is not a check.**

## `40-states.md` is a law, not a screen file

It binds every ticket, including ones whose frames predate it:

- Colour semantics: **steel** is information, **gold** is waiting on someone,
  **red** is it failed, **sage** is settled. Red is never used for `pending`;
  gold is never used for a failure.
- One loading idiom per screen.
- Three-tier validation.

## MVP discipline

Every screen file is titled **MVP** and carries a **Post-MVP** section listing
what was deferred. **No ticket may implement anything in a Post-MVP section.**
Deferred work is filed in Linear (`/file-ticket`) with **Post-MVP** in the
title and its unblock condition in the body, and stays unselected until launch —
not as commented-out code, not as a half-built surface.

**No invented numbers.** Every number on a public page is read from the database
at request time or it does not ship. In MVP that means no platform statistics on
any public surface: no vendor count, no "events booked", no average rating, no
median reply time. Still valid, because they are query results or a vendor's own
facts: search result counts, filter facet counts, a vendor's own rating and reply
time on their profile and dashboard, and real counts in admin.

## The user-facing name is Orla

Infrastructure and packages take the repo name `vendor-marketplace`. Anything a
user reads says Orla, and it is read from `BRAND_NAME` — never a string literal.

## React and Next.js

Default to Server Components; `'use client'` only for hooks, event handlers or
browser APIs. Fetch data in Server Components with async/await, never `useEffect`.
Every effect with a subscription, listener, timer or async call returns a cleanup.
Memoize only around memo-wrapped children or genuinely expensive work.
