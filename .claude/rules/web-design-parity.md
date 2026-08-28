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

## Parity is 1:1 on five axes

No screen carrying a frame ships until it has been driven in a real browser at
1440x900 and compared on **layout, style, colour, font and text**. Text means the
literal strings — same wording, capitalisation and punctuation. The approved
strings are in `design/design-plan/31-content-voice.md`; the full procedure is in
`design/design-plan/04-laws.md`.

Only three things may differ: real content, real data volume, and real photography
in place of the labelled placeholders. Same content in a different composition has
failed — the composition _is_ the design. Same composition with reworded copy has
failed too — the words _are_ the design.

Delegate the comparison to the `parity-checker` agent rather than eyeballing it.

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
