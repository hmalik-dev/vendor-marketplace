---
name: fabricating-seeds-share-one-declared-branch-guard
description: Every seed that fabricates rows must call assertSafeTarget; the guard trusts a declared branch name (NEON_BRANCH/.neon), not the connection string, which is a repo-wide accepted limit
metadata:
  type: project
---

`packages/db/src/scripts/safe-target.ts` holds `assertSafeTarget(what)` — the one
control keeping a fabricating seed off a real database. `seed-marketing.ts` and
`seed-e2e.ts` both call it; anything new under `packages/db/src/scripts/` that
writes invented rows and does **not** call it is a finding.

It refuses `NODE_ENV=production`, an unparseable `DATABASE_URL`, a Neon host with
no recorded branch, and the `production|main|master` branches. Everything not
matching `*.neon.tech` passes unconditionally — that is deliberate, because the
Docker local Postgres is the dev database.

**The branch is declared, not derived.** It comes from `NEON_BRANCH` or the
`.neon` state file, never from the connection string itself, so a stale `.neon`
saying `dev` while `DATABASE_URL` was hand-repointed at the production endpoint
passes the guard. `packages/preflight/src/checks/database.ts` resolves it the
same way, so this is a repo-wide pattern, not a one-off — treat it as an accepted
limit and do not re-file it. `staging` is likewise unprotected by name.

**Why:** the e2e fixture forces `users.role` to `vendor`, clears `deleted_at`,
publishes a storefront and sets `stripe_onboarded`. None of that is additive-only,
so the target check has to run before Clerk is even asked.

**How to apply:** on any diff adding or changing a `packages/db` seed script,
check the `assertSafeTarget` call exists and is the first thing after `loadEnv()`.
Related: [[e2e-fixture-forges-stripe-onboarded]].
