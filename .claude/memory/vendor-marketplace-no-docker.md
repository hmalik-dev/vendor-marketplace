---
name: vendor-marketplace-no-docker
description: "Docker IS available for this project; PGlite is used for the test suite by choice, not necessity"
metadata:
  node_type: memory
  type: project
  originSessionId: b1069b8f-eb56-4bcc-ae39-04751cc2fd20
  modified: 2026-08-26T15:17:28.777Z
---

Docker is installed and working on this machine (verified 2026-08-26 during ticket #2 browser verification — an earlier note claiming otherwise was wrong). `docker compose up -d` brings up the `vendor-marketplace-postgres` container (postgres:16-alpine, port 5432), and `pnpm db:migrate` / `pnpm db:seed` run against it. Check `docker ps` before assuming the container needs starting; it is often already up.

The test suite still uses in-process PGlite via `@vendor-marketplace/db/testing`, but that is a deliberate choice — it keeps `pnpm test` runnable with nothing else started and makes each suite hermetic. It is not a workaround for a missing Docker.

**How to apply:** Use `createTestDatabase()` for anything in `pnpm test`. Use the real Docker Postgres for the browser verification pass required by [[vendor-marketplace-playwright-verification]], since the dev servers need a live database.

Related: [[vendor-marketplace-local-ticket-tracker]]

**Update 2026-08-26 (#17):** the app database is now a Neon `dev` branch; the compose Postgres is for offline work only. See [[vendor-marketplace-neon-dev-branch]].
