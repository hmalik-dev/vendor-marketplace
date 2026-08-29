---
name: filing-a-ticket-is-a-three-file-change
description: "Ticket ids must be contiguous from 0 and need a tickets.ts row; `pnpm test` caches a green over tracker edits, so only --force is trustworthy"
metadata:
  type: project
---

Filing a ticket in vendor-marketplace touches **three files in one commit**:

1. The Status Board row in `.claude/plans/vendor-marketplace-tickets.md`.
2. A `TICKET_CAPABILITIES` row in `packages/shared/src/env/tickets.ts`, carrying
   the board's `Capabilities` column verbatim (`234` is `['auth']`, not `[]`).
3. The hardcoded `expect(HIGHEST_REGISTERED_TICKET).toBe(N)` in
   `packages/shared/src/env/registry.test.ts`.

**Ids must be contiguous from 0.** `registers a contiguous ticket range with no
gaps` fails on any skip, so you cannot pick a high number to dodge a concurrent
lane — take the next id in order. Concurrent lanes therefore cannot allocate ids
independently; what saves it is that two lanes adding rows collide on the *same
lines* of `tickets.ts` and fail loudly at merge.

**`pnpm test` will lie to you here.** The guards read the tracker markdown, which
is **not** an input to the turbo task hash, so editing the board does not
invalidate the cached test result. On 2026-08-29 this reported `shared 262/262`
locally while CI failed the same commit; lane 74 hit it independently the same
hour. **Once the tracker is touched, only `pnpm test --force` is evidence.**

**Why:** the failure produces a confident, specific green that CI contradicts, so
the first instinct is "CI is wrong" or "someone else broke main" — both sessions
reached for that before finding the cache.

**How to apply:** after any tracker edit, run `pnpm test --force` before claiming
a check passed. When filing, add all three pieces together. See
[[tracker-board-rows-are-bold]] for parsing the board and
[[vendor-marketplace-local-ticket-tracker]] for where the queue lives.
