---
paths:
  - 'packages/db/**'
---

# Database and migrations

## The application database is a Neon branch

Local development must never point at `production`; `pnpm preflight` refuses to
start a ticket that does. The Postgres service in `docker-compose.yml` exists
only for offline work — it is not the app database, and the pre-#17 Docker data
was deleted in the rename.

## Changing the schema

Edit `packages/db/src/schema`, then generate the migration with `pnpm db:generate`
and commit the two together. **Never hand-edit a file in `packages/db/drizzle/`** —
it is generated output and the next generate will fight you.

Multi-statement mutations run in one transaction.

## Tests run against a real engine

The DB and API suites boot an in-process Postgres (PGlite) through
`@vendor-marketplace/db/testing`, so schema, seed and route behaviour are all
verified against real Postgres without Docker. `apps/api/src/testing/test-server.ts`
wraps it with the real Fastify instance and fakes only the two network
boundaries: Clerk token verification and svix signature verification.

Fake nothing else. A test that mocks a DAO is testing the mock.

**PGlite is one connection, so it cannot prove a lock.** Each `db.transaction`
callback runs to completion before the next begins, so two writes fired with
`Promise.all` never overlap and a `Promise.all` test passes with the lock
deleted (#399). A guard that only a second connection can hold to account —
`lockHeldDate`, a row predicate, a unique index under contention — belongs in a
`*.contention.test.ts`. Those run on the real server `DATABASE_URL` names,
through `@vendor-marketplace/db/testing/postgres`, which creates and drops a
database of its own per suite. They are excluded from `pnpm test` and run by
`pnpm test:contention`, which needs `docker compose up -d`.

## A corrected writer leaves a legacy — say what happens to it

When a writer starts producing a **better row** — a column it used to leave null,
a status it used to skip, a default it now derives — the rows it already wrote do
not change. State what happens to them: backfill, migrate, or say plainly why
neither is needed. Silence is the bug.

The trap is that the guard which makes a writer idempotent is exactly what skips
the repair:

```ts
const existing = await findLive(...);
if (existing) {
  return existing;          // never reaches the corrected insert below
}
```

So the more careful you were about not duplicating, the more certain you are to
strand. Two instances, a day apart, neither recognised as the same defect at the
time:

- **#317** — the E2E fixture learned to lock `finalPriceCents` and `expiresAt`.
  New inserts were correct; every database seeded beforehand kept rendering
  "quote needed" with no countdown, for ever, because re-seeding hit the early
  return. Fixed by filling the nulls on adoption.
- **#307** — `accept` started marking the date `booked`. Nothing revisited the
  rows already written as `pending`.

**This does not look like a migration problem to whoever writes it**, which is
why it needs saying here. If the corrected column is nullable and the old rows
are merely _worse_ rather than invalid, no constraint will fail and no test will
notice — the surface just renders the wrong thing indefinitely.
