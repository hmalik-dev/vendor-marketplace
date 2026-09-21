---
name: violates-constraint-matches-bound-parameters
description: FIXED in VEN-385 — the message-substring constraint reader is gone; violatesUniqueConstraint reads SQLSTATE 23505 + constraint/constraint_name only. Do not re-report.
metadata:
  type: project
---

> **The auth provider is retired** (VEN-447/448/449 moved auth to Neon Auth). The auth provider names below describe the pre-cutover code and are historical; do not act on them as live.

**Status: FIXED (VEN-385, audited 2026-09-14).** `violatesConstraint` was deleted.
`apps/api/src/lib/constraint-violation.ts` now exports only
`violatesUniqueConstraint`: `code === '23505'` AND `named(link) === constraint`,
where `named()` reads `constraint` (PGlite) or `constraint_name` (postgres.js).
No message text anywhere. Both spellings are pinned by a real violation through
each driver (`constraint-violation.test.ts`, `constraint-violation.contention.test.ts`).

The original hole: drizzle 0.45.2 builds `DrizzleQueryError.message` as
`Failed query: ${query}\nparams: ${params}`, so a bound value (the auth provider name, review
text) containing the index name turned any failure of that statement (40P01,
57014, connection loss) into a match. The dead `constraint` read under
postgres.js made the substring the only arm that fired. An intermediate repair
read `constraintName`, which no driver writes.

**Why:** callers were `users.dao.ts` (the auth provider webhook swallow, answered 200) and
`reviews.service.ts` createReview (409 "already reviewed", nothing logged).

**How to apply:** a new constraint-classification call must use
`violatesUniqueConstraint` (or pin SQLSTATE + driver field). The backstop is
`error-message-control-flow-guard.test.ts`, a regex source scan of
`apps/api/src` for `.message` comparisons; it does not catch `String(err)`,
`` `${err}` ``, a destructured `message`, or `.detail`, and its `/* */` strip
can swallow code after a string containing `/*` — see
[[a-guard-reads-a-smaller-region-than-you-think]]. Treat it as a tripwire, not
proof. Related: [[err-serializer-is-the-log-sink]].
