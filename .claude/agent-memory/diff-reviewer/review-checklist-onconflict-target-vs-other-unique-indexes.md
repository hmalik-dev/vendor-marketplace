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

Related: [[review-checklist-read-time-overlay-vs-sibling-write]] — same family,
the rule that governs the row lives in a file the diff never touches.
