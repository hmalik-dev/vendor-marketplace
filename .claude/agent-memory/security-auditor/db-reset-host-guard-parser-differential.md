---
name: db-reset-host-guard-parser-differential
description: VEN-751 `pnpm db:reset` tier guard parses the host with WHATWG URL while postgres.js 3.4.9 connects to a different host on userinfo/comma URLs; confirm name is `neondb` on both Neon tiers
metadata:
  type: project
---

`assertTierMatchesHost` (packages/db/src/scripts/reset.ts) reads `new URL(url).hostname`
(last `@`, opaque host keeps `%2C`), but postgres.js `parseUrl` takes the host after the
**first** `@` and splits on `,` (decoded) into a multi-host list, connecting to entry 0.
Probed offline (no connect) on 2026-09-24: `u:p@<prod>,x@<staging>` → guard sees staging,
driver dials prod first; same with `x@localhost` for `--tier local`; `<staging>%2C<prod>`
fails over to prod. `--confirm` is `current_database()` = `neondb` on both tiers, and the
refusal prints it, so the host check is the only tier discriminator.

**Why:** Low only — the crafted URL must already hold that tier's credentials; it is a
mistake guard, not an attack surface. Reported, not a blocker.

**How to apply:** any future host-pinning guard in this repo must hand the driver the
same parsed host (explicit `host`/`port` options) or refuse `,`/`%`/extra `@` in the
authority. The VEN-751 runbook's `db:seed`/`db:seed:demo` read `DATABASE_URL`
(client.ts default), not the exported `DATABASE_URL_UNPOOLED`. Probe technique: build
URLs by string concat in a /tmp script (the credential hook blocks `://u:p@` literals)
and read `postgres(url).options.host`. See [[deploy-pipeline-secret-handling]],
[[fabricating-seeds-share-one-declared-branch-guard]].
