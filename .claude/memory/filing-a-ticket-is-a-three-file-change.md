---
name: filing-a-ticket-is-a-three-file-change
description: "Filing is a four-file change; ids are contiguous so concurrent lanes collide — allocate the id last, and check a peer has not already filed the same defect. `pnpm test` caches a green over tracker edits, so only --force is evidence"
metadata:
  type: project
---

Filing a ticket in vendor-marketplace touches **four things in one commit**:

1. The Status Board row in `.claude/plans/vendor-marketplace-tickets.md`.
2. A `TICKET_CAPABILITIES` row in `packages/shared/src/env/tickets.ts`, carrying
   the board's `Capabilities` column verbatim (`234` is `['auth']`, not `[]`).
3. The hardcoded `expect(HIGHEST_REGISTERED_TICKET).toBe(N)` in
   `packages/shared/src/env/registry.test.ts`.
4. The `### #N:` **detail section** in the tracker, plus the programmatic
   recount line under the board — which says in the file itself not to
   hand-maintain it, so recount rather than adjust it.

**Ids must be contiguous from 0.** `registers a contiguous ticket range with no
gaps` fails on any skip, so you cannot pick a high number to dodge a concurrent
lane — take the next id in order. Concurrent lanes therefore cannot allocate ids
independently; what saves it is that two lanes adding rows collide on the *same
lines* of `tickets.ts` and fail loudly at merge.

**The id you choose is stale the moment you choose it.** On 2026-08-31 one lane
renumbered the same ticket **three times in under an hour** — 391 -> 392 -> 394 —
as two other lanes filed between its rebases. The collision is loud, but each
resolution is a four-file renumber plus every cross-reference in the prose.
**Allocate the id immediately before pushing, not when you start writing**, and
`git fetch` first. Worse than the churn: one of those filings was a *duplicate*
of a ticket another lane had **already filed and begun implementing** — filed an
hour earlier, from a different ticket's verification pass, and already on
`origin/main` when the second lane wrote its row. So the board held the answer
the whole time; nobody read it. The two rows shared no words — *"earnings month
is a local month with UTC edges"* against *"earnings read $0 around every month
boundary"* — so a title search finds nothing and a mechanism search finds it at
once. **Before filing, grep the board for the mechanism, not the title**, and if
a peer is already on it, drop the row rather than filing and superseding: a row
that exists only to be closed is worse than one that never existed.

**`pnpm test` will lie to you here.** The guards read the tracker markdown, which
is **not** an input to the turbo task hash, so editing the board does not
invalidate the cached test result. On 2026-08-29 this reported `shared 262/262`
locally while CI failed the same commit; lane 74 hit it independently the same
hour. **Once the tracker is touched, only `pnpm test --force` is evidence.**

**Why:** the failure produces a confident, specific green that CI contradicts, so
the first instinct is "CI is wrong" or "someone else broke main" — both sessions
reached for that before finding the cache.

**How to apply:** after any tracker edit, run `pnpm test --force` before claiming
a check passed. When filing, add all four pieces together, allocate the id last,
and ask the other live lanes what they have filed — they answer faster than a
rebase does. See
[[tracker-board-rows-are-bold]] for parsing the board and
[[vendor-marketplace-local-ticket-tracker]] for where the queue lives.
