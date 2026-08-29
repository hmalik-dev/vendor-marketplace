---
name: vendor-marketplace-no-docker
description: "Docker IS available; the compose Postgres holds no app data and PGlite in tests is a choice, not a workaround"
metadata:
  node_type: memory
  type: project
  originSessionId: b1069b8f-eb56-4bcc-ae39-04751cc2fd20
  modified: 2026-08-29T00:00:00.000Z
---

Docker is installed and working on this machine (verified 2026-08-26 during
ticket #2 browser verification — an earlier note claiming otherwise was wrong).
`docker compose up -d` brings up `vendor-marketplace-postgres`
(postgres:16-alpine, port 5432) and `vendor-marketplace-storage` (MinIO, 9000/9001).

**The compose Postgres holds no application data.** `pnpm db:migrate` and
`pnpm db:seed` resolve their connection through
`packages/db/src/migration-url.ts` → `DATABASE_URL_UNPOOLED` → the Neon `dev`
branch. Nothing outside test fixtures references `localhost:5432`. Verified
2026-08-29. The container exists only for fully-offline work, where you point
`DATABASE_URL` at it and leave `DATABASE_URL_UNPOOLED` unset. MinIO, by
contrast, IS used on every run as the local stand-in for Cloudflare R2.

`pnpm start` still runs `docker compose up -d --wait postgres storage`, so it
blocks on a database the run will not query.

The test suite uses in-process PGlite via `@vendor-marketplace/db/testing`, a
deliberate choice: it keeps `pnpm test` runnable with nothing else started and
makes each suite hermetic. Not a workaround for missing Docker.

**Why:** a session that assumes the container is the app database will inspect
an empty Postgres on localhost:5432 and conclude the data is missing or the
seed failed.

**How to apply:** Use `createTestDatabase()` for anything in `pnpm test`. For
browser verification per [[vendor-marketplace-playwright-verification]], the
dev servers read the Neon `dev` branch — see [[vendor-marketplace-neon-dev-branch]].
Only MinIO needs to be up locally.

Related: [[vendor-marketplace-local-ticket-tracker]]
