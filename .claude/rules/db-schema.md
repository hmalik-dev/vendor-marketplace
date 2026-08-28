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
