---
name: review-checklist-single-url-validator-vs-list-shape
description: A new env validator that calls new URL(value) once is blind to every row whose registry shape is a comma-separated list — check each row's shape regex, not the example value
metadata:
  type: feedback
---

When a diff adds a value-level guard to the env registry (`packages/shared/src/env/schema.ts`),
read each affected row's `shape` regex before believing the guard covers it.

**Why:** #406 added `isLoopbackUrl(value)` — `new URL(value).hostname` against a
loopback set — to the new `deployed` `ShapeTarget`, and shipped tests that pass a
single-valued `WEB_URL=http://localhost:3000` and see it refused. But `WEB_URL`'s
shape is `HTTP_URL_LIST`: a comma-separated allow-list is a legal value, and
`allowedOrigins()`/`canonicalWebOrigin()` split it. `new URL('http://localhost:3000,https://orla.test')`
**throws** (`3000,https` is not a port), the `catch` answers `false`, and the API
boots in production with `canonicalWebOrigin === 'http://localhost:3000'` — the
exact finding the ticket existed to close, with the gate green. The reverse order
(`https://orla.test,http://localhost:3000`) parses to hostname `orla.test,http`,
also not loopback.

**How to apply:** for every row the new check touches, grep its `shape`/`productionShape`
constant. If it is a `*_LIST`, the check must split on the same delimiter the
consumer splits on. Then reproduce: build the deployed schema, feed a two-entry
value with the bad entry in _each_ position, and print what the consumer
(`allowedOrigins`, `canonicalWebOrigin`) derives — a single-value fixture proves
nothing about a list row. Same trap for any `String.includes('//localhost')`
substring guard: see [[review-checklist-verify-differently-shaped]] territory —
parse, do not substring.
