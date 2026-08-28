---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'apps/api/src/testing/**'
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

Forbidden in committed code: `.skip`, `.only`, `xit`, `xdescribe`, commented-out
tests, and `console.*`.

A flaky test is a defect with a root cause, not a retry budget. Do not add sleeps,
blanket retries or larger timeouts as the correction — use `/debug-flaky-test`.
