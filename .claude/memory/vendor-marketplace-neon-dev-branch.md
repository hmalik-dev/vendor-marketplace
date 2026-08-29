---
name: vendor-marketplace-neon-dev-branch
description: 'Local dev runs on Docker Postgres 18 to stop Neon burning CU-hours; Neon holds production and the dev/staging/prod split is in progress'
metadata:
  node_type: memory
  type: project
  originSessionId: f28db367-56b4-4c7c-8109-9f5fab513cb3
  modified: 2026-08-29T00:00:00.000Z
---

**Local development runs on the Docker Postgres, `postgres:18-alpine`, port 5432.**
Confirmed by the user 2026-08-28 and implemented in platform ticket #200.

**Why it moved off Neon.** `pnpm dev` holds a connection pool open, so the Neon
`dev` branch never scaled to zero: it logged **103,692s active over 2.4 days**,
pacing ~375h/month against a **100 CU-hour** free cap. Exhausting that allowance
suspends the compute until the next billing period — local work causing a
production outage. The allowance is **per project**, and `dev` and `production`
shared one.

**PG18 moved the data mount.** Images 18+ abort when the volume is at
`/var/lib/postgresql/data`, so it is now `/var/lib/postgresql`
(docker-library/postgres#1259). The old volume was recreated. **A compose
recreate therefore wipes local data** — that is how the dev database was emptied
mid-sweep on 2026-08-28. Restore with `pnpm db:migrate` (schema + reference
data) then `pnpm db:seed:marketing` (16 vendors, 48 packages, 918 bookings, 918
reviews). Reference seed alone leaves zero vendors and a 404 on every profile.

**Neon still holds production**, project `dark-surf-79137727`. `pnpm preflight`
still fails if `DATABASE_URL` resolves to `production` while `NODE_ENV` is not.
The environment split into **dev / staging / production** is in progress —
platform tickets #201-#206 own it. Do not re-derive that plan; read those tickets.

**How to apply:** for local work assume Docker Postgres and that its data is
disposable. Never assume vendor or user fixtures exist — seed them. The E2E
vendor account's own profile is **not** in the marketing seed, so it must be
recreated through the app after any wipe. Related: [[vendor-marketplace-no-docker]],
[[vendor-marketplace-e2e-credentials]], [[credentials-env-files-only]].
