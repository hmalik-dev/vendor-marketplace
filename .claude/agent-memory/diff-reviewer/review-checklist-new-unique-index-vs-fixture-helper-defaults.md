---
name: review-checklist-new-unique-index-vs-fixture-helper-defaults
description: A new partial unique index reds existing suites through fixture-helper defaults, and reds deploy through rows already written; grep helper defaults and look for the repo's dedupe-migration precedent
metadata:
  type: feedback
---

A diff that adds a partial `uniqueIndex` has two blast radii the diff itself
cannot show you.

**1. Existing fixtures, via defaults nobody passes.** A test helper like
`booking(requestId, values)` that hardcodes `eventDate: '2026-10-01'` and lets
`status` fall to its column default (`bookings.status` defaults to
`'confirmed'`) produces two rows inside the index's predicate the moment it is
called twice — and the call sites look different because each passes different
money fields. VEN-482: `operator-digest.test.ts` called it three times, only the
third overrode `status`, so `seedActivity()` raised 23505 and the whole suite
died at setup.

**How to apply:** for each column the new index covers, grep every
`insert(<table>)` call site _and_ the helper above it. Read the helper's own
defaults and the schema's `.default(...)`, not just the arguments at the call
site. Two calls that omit the same field are one duplicate.

**2. Rows already written.** The index is a claim that the duplicate cannot
exist, which is false for every database that ran the app before the guard the
index replaces. `CREATE UNIQUE INDEX` then aborts with "could not create unique
index … is duplicated", and it fails in the deploy's migrate step, never in CI —
lane and PGlite databases are always fresh.

**Why:** this repo has the precedent written down —
`packages/db/drizzle/0008_dedupe_live_booking_requests.sql` and
`0023_dedupe_pending_tag_suggestions.sql` are hand-written dedupes placed
immediately before the migration that adds the index, and 0008 says plainly
"those indexes cannot be created while the duplicates they forbid are still in
the table". `.claude/rules/db-schema.md` requires the diff to say what happens
to the legacy rows: backfill, migrate, or why neither is needed.

**How to apply:** if the generated migration is the only new .sql file, ask for
the dedupe or for the evidence that no pair exists. See also
[[review-checklist-onconflict-target-vs-other-unique-indexes]] — an
`onConflictDoNothing({ target })` absorbs its own target only, so the new index
still raises through it.
