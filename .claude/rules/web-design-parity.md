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
render Instrument Sans though the frames draw serif (D24); no trigger draws the
`▾` the frames draw (D25); and `01-foundations.md` records two colour values as
accepted deviations. The caret has been re-filed four times.

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
Deferred work lives in the Post-MVP Backlog in the tracker with its unblock
condition — not as commented-out code, not as a half-built surface.

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
