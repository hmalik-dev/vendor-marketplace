---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'apps/api/src/testing/**'
  - 'apps/web/e2e/**'
---

# Tests

Every code change ships with tests in the same commit. Exempt only: `.md`,
`.json`, `.yaml`, whitespace, and CSS with no logic.

A bug fix means a test that **fails before and passes after**. Write it, watch it
fail, then implement. Test the actual modified unit, not a proxy for it. Cover the
bug and its immediate edges.

Assert specific values. A bare `toBeTruthy()` asserts almost nothing. API tests
assert status **and** response shape.

Deterministic: no real clock, no real network, no unseeded random. The DB and API
suites use the in-process PGlite engine, so a database test is a real database
test — do not mock a DAO to avoid it.

**`pnpm test` is not the whole gate.** PGlite is a single connection, so it
cannot tell a row lock from its absence: the `*.contention.test.ts` suites run
on a real Postgres and are excluded from `pnpm test`. Run **`pnpm
test:contention`** alongside it — CI does — whenever a change touches a booking
request transition, the availability calendar, or any other write guarded by a
lock, a predicate or a unique index. Deleting `lockHeldDate` leaves the rest of
the local gate green.

Forbidden in committed code: `.skip`, `.only`, `xit`, `xdescribe`, commented-out
tests, and `console.*`.

A flaky test is a defect with a root cause, not a retry budget. Do not add sleeps,
blanket retries or larger timeouts as the correction — use `/debug-flaky-test`.

## An App Router route is not interactive when `goto` returns

`page.goto` resolves when the shell has loaded. The rest of the route streams in
and React renders it on the client afterwards, so a Playwright spec that acts in
that window acts on markup React does not own yet, and the result is thrown
away. All three faces of this have been observed on this app and **none of them
looks like a race** (#471):

- `setInputFiles` fires `change` at an input whose `onChange` is not attached.
  No request reaches the API — two uploads lost in three runs on
  `/vendor/portfolio` — and the red reads as missing seed data.
- `focus()` is dropped when the node is replaced, and the style read next is the
  _unfocused_ one. It is stable, so sampling twice agrees with itself and
  reports `--tw-ring-shadow: 0 0 #0000` as a field that paints no focus ring.
- Both copies of a control exist at once mid-swap, and a locator that resolved
  one of them fails with `strict mode violation: …resolved to 2 elements`.

`waitForHydration(page, selector)` in `apps/web/e2e/fixtures.ts` is the wait:
it holds until **every** node matching the selector carries React's own
`__reactFiber$…`/`__reactProps$…` bookkeeping. Pass a selector inside the
boundary being driven — the header is interactive long before the route's
content is. Where the interaction is idempotent, re-applying it until it takes
(`focusUntilVisible` in `focus-indicator.spec.ts`) is better still.

And assert the precondition alongside the value: a read that can only be right
when the element is focused carries `focused: element.matches(':focus-visible')`
so a lost focus fails saying so rather than impersonating a missing indicator.
