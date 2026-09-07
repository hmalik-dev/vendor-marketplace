---
name: review-checklist-build-time-output-keyed-on-passthrough-env
description: A diff that makes next.config headers()/build output depend on WEB_URL moves it off turbo's cache key — same hash, FULL TURBO replays the stale artifact
metadata:
  type: feedback
---

When a diff makes **build-time-baked output** depend on a new environment
variable, check which turbo list that variable is in before anything else.

`next.config.ts`'s `headers()` runs at build time and is frozen into
`apps/web/.next/routes-manifest.json`. `turbo.json` has two lists and they are
not interchangeable:

- `globalEnv` — part of the cache key. `NODE_ENV`, `CSP_ENFORCE`, and every
  `PLATFORM_ENV_KEYS` entry (`VERCEL*`, `RENDER*`, `RAILWAY*`,
  `DEPLOYMENT_PLATFORM`, `DEPLOYMENT_ORIGIN`) are here.
- `globalPassThroughEnv` — **generated from `packages/shared/src/env/registry.ts`**
  by `pnpm env:example`, passed to the task but _excluded_ from the hash.
  `WEB_URL`, `API_URL`, every `NEXT_PUBLIC_*` row is here.

**Why:** #452 replaced `https: NODE_ENV === 'production'` with a flag derived
from `WEB_URL`/the platform origin. That moved HSTS and
`upgrade-insecure-requests` from a cache-keyed input to a non-keyed one. The
build output genuinely changes with the value and the hash does not, so a warm
cache replays the wrong headers in both directions — including re-shipping the
very bug the ticket fixed.

**How to apply:** two cheap commands, no full build needed first.

1. `WEB_URL=<a> npx turbo run build --filter=<pkg> --dry=json` and again with
   `<b>`; compare `tasks[].hash`. Identical hash + different intended output =
   finding. `globalCacheInputs.passthrough` lists the variable with a hash
   beside it, which _looks_ like keying and is not.
2. Prove it end to end: build with `<a>`, read the artifact
   (`routes-manifest.json` for headers), build with `<b>` — look for `FULL
TURBO` — read the artifact again, then `--force` to show the value really
   does change it.

The generated-ness matters for the fix: you cannot just hand-edit `turbo.json`,
a drift test in `packages/shared` fails. Say so rather than proposing the edit.

Related: [[review-checklist-unpinned-safety-constants]] (mutate the inputs of a
derived value, not the value).
