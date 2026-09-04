---
name: review-checklist-pglite-serialises-transactions
description: A `Promise.all` concurrency test in the API suite is vacuous once the code under test opens a transaction — drizzle's PGlite session routes db.transaction through PGlite.transaction, which holds the single connection exclusively, so two transactions never overlap
metadata:
  type: feedback
---

When a diff adds a **row lock** (`select … for update`, `insert … on conflict do
update` taken purely for its lock) and ships a `Promise.all` test against the API
harness, ask: _can this test fail if the lock statement is deleted?_

**Why:** the API harness is PGlite, and
`drizzle-orm/pglite/session.cjs:139` implements `transaction()` as
`this.client.transaction(cb)`. PGlite's `transaction` takes the one connection
exclusively for the whole callback, so transaction B does not even `BEGIN` until
A has committed. Every lock inside is therefore uncontended, and the test passes
on the transaction boundary alone — i.e. on an implementation that still loses
the race in production. Reviewing #399 on 2026-09-04: the shipped test asserted
`[200, 409]`, and the same two accepts without the lock produced `accepted=2`
on real Postgres.

**How to apply:** two probes, both cheap, neither touching the repo.

- PGlite serialisation, ~10 lines in the scratchpad: `new PGlite()`, two
  `pg.transaction()` callbacks that log begin/commit around a `setTimeout`,
  `Promise.all` them. The log reads `A:begin A:commit B:begin B:commit`.
- The real behaviour: docker `postgres:18-alpine` is already up. Import
  `node_modules/.pnpm/postgres@3.4.9/…/src/index.js` by absolute path, build the
  URL from `DATABASE_URL` in `./.env` (`set -a; . ./.env; set +a; node script` —
  never inline it), `create database` a throwaway, two clients at `max: 1`, and
  replay the service's statement sequence with a hold in the middle. Run it once
  with the lock and once without; drop the database after.

`INSERT … ON CONFLICT DO UPDATE SET col = table.col` **is** a real lock — the
second inserter blocks both when the row is fresh (speculative insertion) and
when it pre-exists (row lock), and its next statement gets a new READ COMMITTED
snapshot, so the re-read after the lock does see the winner's commit.

Related: [[review-checklist-recompute-in-set-clause-races]] — same rule, that a
concurrency claim needs a second real connection behind it.
