---
name: url-params-validated-in-the-nuqs-hook
description: This project's URL-param trust boundary is the nuqs hook, not the page — nuqs parses types but never validates, and unvalidated params previously reached Intl formatters and int4 columns as a 500
metadata:
  type: project
---

`nuqs` (`useQueryStates` / `useQueryState`) coerces a param's _type_ and never
validates its _value_. In this repo the agreed boundary is therefore the hook
that owns the params, not the screen: `useSearchState` in
`apps/web/src/components/search/search-state.ts` runs `parseSearchState`
(a Zod object mirroring the API's own `vendorSearchQuerySchema` bounds), clears
each failing field to a fallback, and returns a `dropped` list the screen
announces with fixed labels — never echoing the attacker's own text.
Established by ticket #66 (2026-08-29). `.claude/rules/web-route-boundaries.md`
is the written form.

**Why:** before that boundary, `?date=not-a-date` reached
`Intl.DateTimeFormat.format(new Date(...))` and threw `RangeError: Invalid time
value` — a 500 from a URL anyone can paste — and `?minPriceCents=2147483648`
reached Postgres and overflowed `int4`.

Since #403 the hook has a **second** reader beside `parseSearchState`:
`unusableSearchParams(useSearchParams())` re-reads the raw `URLSearchParams`
so a param `nuqs` silently swallowed (`?page=abc`, `?sort=evil`) is announced
too. It returns **field names only** — every element of `dropped` is a key of
`searchParsers`, and `clearedParamsLine` renders through the fixed
`DROPPED_FIELD_LABELS` record. That is the invariant that keeps the notice
free of attacker text: no URL _value_ may ever enter `dropped`, and no label
may ever be derived from one. The same release stopped sending a stale `date`
at all — the shell withholds the request until the viewer's clock lands — so
the API's `isUniversallyPastDate` 400 is now a backstop rather than a routine
answer to a shared link.

**How to apply:** any new `useQueryState`/`useQueryStates` call site is a
finding unless its value passes a schema before it can reach a formatter, a
query string sent to the API, or the DOM. `apps/web/src/components/vendors/
profile/profile-tabs.tsx` reads `?tab` this way — check it validates before
recommending it as a model. When comparing the web schema to the API's,
remember the two are allowed to differ where the server cannot know the
viewer's local day: the past-date rule lives in a client effect, deliberately,
so the API's `isUniversallyPastDate` 400 is reachable from a shared link.
