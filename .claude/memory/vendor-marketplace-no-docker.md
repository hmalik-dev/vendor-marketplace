---
name: vendor-marketplace-no-docker
description: "The compose Postgres 18 IS the local application database; migrate and seed go there, not Neon. PGlite in tests is a choice, not a workaround"
metadata:
  node_type: memory
  type: project
---

> The slug is a historical artifact — it once recorded "Docker is unavailable",
> which was wrong, and then "Docker is available but unused", which is also now
> wrong. Four memories link to it, so the name stays. Read the content.

**The Docker Postgres is the local application database.** `docker compose up -d`
brings up `vendor-marketplace-postgres` (**postgres:18-alpine**, port 5432,
user/db `vendor_marketplace`) and `vendor-marketplace-storage` (MinIO, 9000/9001).
Both matter on every run.

**Migrations and seeds go to that container, not to Neon.** Verified against the
repository 2026-08-29:

- `.env` sets **only** `DATABASE_URL`, pointing at `localhost:5432/vendor_marketplace`.
- `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` are **unset, by design**. The env
  registry marks both `optionalFor: ['baseline', 'local']`; setting them on a
  laptop fails `pnpm preflight` on a correct configuration.
- `packages/db/src/migration-url.ts` prefers `DATABASE_URL_UNPOOLED` and falls
  back to `DATABASE_URL`. With unpooled unset, that fallback is the local
  container.

**Why it moved off Neon** (`5ca9a5f`, 2026-08-28): `pnpm dev` holds a pool open,
so the Neon compute never scaled to zero — 103,692s active over 2.4 days, pacing
~375h/month against a **100 CU-hour per-project cap**. The allowance is per
project and `dev` shared one with `production`, so exhausting it would suspend
production's compute. Local work could have caused a production outage.

**Neon still backs staging and production.** Only local development moved.

**PG18 moved the data mount.** Images 18+ abort when the volume is at
`/var/lib/postgresql/data`, so it is now `/var/lib/postgresql`. **A compose
recreate therefore wipes local data.** Restore with `pnpm db:migrate` then
`pnpm db:seed:marketing`; the reference seed alone leaves zero vendors and a 404
on every profile.

**There is no `psql` on this machine's PATH.** Query through the container:
`docker exec vendor-marketplace-postgres psql -U vendor_marketplace -d
vendor_marketplace -Atc "<sql>"`. The role is `vendor_marketplace`, **not**
`postgres` — a `-U postgres` connection fails with `role "postgres" does not
exist`, which reads like a broken container rather than a wrong flag.

This matters most at lane teardown, where the question is "is the lane database
gone?" and a wrong answer is invisible. A host `psql -l | grep -i lane` fails
`command not found`, prints nothing, and looks exactly like "no lane databases
left". A `|| echo "(none)"` fallback does not save it either: attached to a
pipeline, `||` reads the **last** command's status, so neither the missing
binary nor grep's no-match ever reaches it. **Print `select datname from
pg_database` and read the list** rather than counting matches — see
[[a-failed-command-reads-as-a-passing-check]]. Orphan `vendor_marketplace_lane_*`
databases outlive their sessions and nothing reclaims them, so the printed list
is also how you find them.

The test suite uses in-process PGlite via `@vendor-marketplace/db/testing`, a
deliberate choice: it keeps `pnpm test` runnable with nothing started and makes
each suite hermetic. Not a workaround for missing Docker.

**Why:** a session carrying the old note will look for application data on Neon,
find a `dev` branch nothing writes to any more, and conclude the seed failed —
or worse, point local work at Neon and restart the compute burn.

**How to apply:** bring both containers up before browser verification. Treat the
local data as disposable and seed it. Use `createTestDatabase()` for anything in
`pnpm test`. Parallel lanes take their own database on this same container — see
[[worktree-env-copies-drift]]. Related: [[vendor-marketplace-neon-dev-branch]],
[[vendor-marketplace-local-ticket-tracker]],
[[vendor-marketplace-playwright-verification]].
