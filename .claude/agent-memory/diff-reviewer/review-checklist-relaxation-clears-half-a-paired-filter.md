---
name: review-checklist-relaxation-clears-half-a-paired-filter
description: `city` and `state` travel as a pair everywhere except relaxations.ts, whose Anywhere patch clears only `city` — run the patch through toSearchQuery and re-run noResultsHeadline
metadata:
  type: feedback
---

`relaxations(state, slugs)` returns `{ label: 'Anywhere', patch: { city: '' } }`
and `setState` merges the patch, so `state.state` survives. `toSearchQuery` then
still emits `state=IL`.

**Why:** the whole search surface treats `(city, state)` as one value —
`CitySelect` commits both halves together and calls the split state
"unrepresentable" — but the relaxation patch clears one. Verified 2026-09-05 on
#384: `Springfield, IL` → "No vendors match that filter" + `[Anywhere]`; clicking
it re-queries `state=IL&sort=…`, still filtered to Illinois, and because
`state.city` is now `''` the relaxation list is empty and the headline falls
through to **"No vendors listed yet"** — a false claim about the marketplace with
no way back, which is the exact dead end `relaxations.ts`'s own docstring exists
to prevent. Latent before #384 (unreachable cities were unpickable); the ticket
put it on the headline path.

**How to apply:** for any diff that widens what a paired filter can hold, apply
each relaxation's `patch` to the state by hand, feed the result to
`toSearchQuery`, and re-run `noResultsHeadline` / `relaxations` on it. A
relaxation that leaves a filter set, or that empties the escape list, is a dead
end. Neither `relaxations.test.ts` nor `search-shell.test.tsx` drives the second
hop.

Related: [[review-checklist-status-filter-vs-webhook-idempotency]].
