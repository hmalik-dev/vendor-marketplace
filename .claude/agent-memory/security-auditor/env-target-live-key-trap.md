---
name: env-target-live-key-trap
description: Confirmed recurring defect — the app env schemas' ShapeTarget argument is uncovered by any test, and picking 'local' there bricks the production build
metadata:
  type: project
---

The `target` argument passed to `registrySchemaShape` in `apps/api/src/config/env.ts`
and `apps/web/src/config/env.ts` must be `baseline`, never `local`. Established
2026-08-28 in ticket #61, which introduced `baseline` precisely because `local`
had become the wrong answer for these two call sites.

**Why:** `local` resolves to `localShape`, which requires `pk_test_` / `sk_test_`.
`next.config.ts` calls `assertWebEnv()` on every `next build` and the API calls
`parseEnv()` at boot, so a `local` target throws on the live Clerk/Stripe keys
that are correct in production — Vercel build fails, API will not bind. The
cheapest way out for an operator under pressure is to put a `pk_test_` key into
production, which is a development credential reaching production and means the
deployed app authenticates against Clerk's dev instance and transacts in Stripe
test mode. Only `pnpm preflight --env local|production` knows which environment
it is in; the apps cannot, because `next build` and `tsc` both set
`NODE_ENV=production`.

**How to apply:** on any diff touching either app's `config/env.ts`, or
`shapeFor` / `ShapeTarget` in `packages/shared/src/env/registry.ts`, grep the two
call sites for the literal target.

**Corrected 2026-08-28, after ticket #61 landed.** The "no test covers this"
claim above was true when the audit ran and is now false — #61 closed it. Both
call sites are pinned by a behavioural live-key test:
`apps/web/src/config/env.test.ts` "accepts a live-mode Clerk key, because this
runs on Vercel too", and `apps/api/src/config/env.test.ts` "accepts a live-mode
Clerk key, because this is how it boots in production". Each swaps `_test_` for
`_live_` in the fixture and asserts the parse does not throw, so flipping either
target to `local` fails that package's suite. Verify those two tests still exist
before treating this as an open gap; do not add a third. Related:
[[credential-fixtures-assembled-at-runtime]].
