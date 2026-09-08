---
name: review-checklist-onconflict-target-vs-other-unique-indexes
description: Review checklist — an upsert's onConflict target only absorbs ONE constraint; list every unique index on the table (including partial ones) and ask which other one the row can hit
metadata:
  type: feedback
---

When a diff calls an "idempotent" upsert — `onConflictDoUpdate({ target: X })` or
a select-then-insert — open the table's schema file and read **every**
`uniqueIndex`, partial ones included. The target absorbs one of them; a row that
violates any other one throws 23505 and the whole "safe to re-run" claim is
false.

**Why:** #317's `seedE2eFixtures` upserted `vendor_profiles` on `slug`, but the
table also has `vendor_profiles_user_id_key`. The E2E vendor already owned a
profile under a different slug (the live dev database had `probe-test-studio`),
so the seed threw before writing the package, the request or `stripe_onboarded`
— and `lane:up` swallowed the failure while preflight's own check, which only
asked "does a profile exist", passed. The same file's `upsertBookingRequest`
searched for `status = 'pending'` while the unique index is partial on
`status in ('pending','quoted')`, so a re-run after a quote threw on
`booking_requests_live_package_key`.

**How to apply:** cheap to prove — a throwaway `*.test.ts` in `packages/db`
using `createTestDatabase()` + `runMigrations()` + `seedReferenceData()`, put
the table into the pre-existing state the upsert claims to adopt (row under a
different value of the non-targeted unique column, or under a status the
partial index still covers), call the function and assert it resolves. Then
`rm` the file. Also check `.claude/rules/db-schema.md`: multi-statement
mutations must run in one transaction, so an unwrapped sequence leaves the
half-written state the failure above produces.

**Under concurrency the arbiter is chosen by timing, so the same statement is
right three runs in four (#442).** `insertUserIfAbsent` was
`onConflictDoNothing({ target: users.clerkUserId })`; `users` also has
`users_email_key`, and one identity signing in twice at once carries the same
value for both. Postgres pre-checks only the _arbiter_ index: if it finds the
conflict there it absorbs it silently, but if the peer's row is not visible yet
the insert proceeds speculatively and the unique violation surfaces from
`users_email_key` during index insertion — which **raises**, because that index
is not the arbiter. Eight concurrent first-sign-in acceptances 500'd about one
run in four. Consequences for review:

- A targeted `DO NOTHING` on a table with two unique indexes over the _same_
  logical identity is a race, not a bug you can see in a single-threaded test.
- Two targets are not available: `ON CONFLICT (a, b)` names one index over both
  columns, and there usually is not one. Catching the 23505 is also unavailable
  when the caller runs inside `db.transaction` — the raise aborts it and every
  later statement fails 25P02. Dropping the target is the only shape that works,
  and then the _fallback read_ is what has to tell "this identity met itself"
  from "some other index arbitrated".
- **The regression guard is then probabilistic.** Restoring the target leaves a
  1-in-4 race test green three runs in four, and the red run reads as flake. Ask
  for a deterministic pin (assert the emitted SQL has no `ON CONFLICT (...)`, or
  repeat the race inside the case) before accepting the coverage.

Related: [[review-checklist-read-time-overlay-vs-sibling-write]] — same family,
the rule that governs the row lives in a file the diff never touches. And
[[review-checklist-pglite-serialises-transactions]] — the arbiter race is
invisible to `pnpm test` for the same reason a lock is.
