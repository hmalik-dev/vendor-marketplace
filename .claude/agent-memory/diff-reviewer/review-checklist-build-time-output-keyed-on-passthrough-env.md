---
name: review-checklist-build-time-output-keyed-on-passthrough-env
description: Before accepting or filing a turbo globalEnv/passThrough cache-key finding, check framework inference and the dotenv file next.config loads — both decide the hash independently of the two lists
metadata:
  type: feedback
---

When a diff makes **build-time-baked output** depend on an env var, check three
things, not one. `globalEnv` is hashed; `globalPassThroughEnv` (generated from
`packages/shared/src/env/registry.ts`) reaches the task unhashed.

1. **Framework inference.** turbo 2 infers `NEXT_PUBLIC_*` into
   `web#build`'s hash because `apps/web` is Next.js, **even for keys sitting in
   `globalPassThroughEnv`** — measured 2026-09-19 (VEN-468): a dry run with
   `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SENTRY_DSN` set lists both under
   `tasks[].environmentVariables.inferred`. So "a pass-through `NEXT_PUBLIC_*`
   replays from cache" is false for `web#build`, and moving one to `globalEnv`
   buys nothing there while busting **every** package's hash on each change.
   Non-`NEXT_PUBLIC_` keys (`WEB_URL`, #452's HSTS) are the real shape.
2. **The dotenv file.** `apps/web/next.config.ts:21` loads the repo-root `.env`
   itself. It is gitignored, turbo 2 hashes no dotenv (`globalCacheInputs.files`
   is empty), and neither list sees a value that never enters `process.env` — so
   editing `.env` and rebuilding still hits the cache. `lane:exec` injects
   `.env.lane` into the child env, so lanes and CI are keyed; a laptop is not.
3. **The drift test.** `globalEnv` is hand-maintained in `turbo.json` and
   `generate.test.ts` compares it **sorted** to `TURBO_GLOBAL_ENV_KEYS`, so
   order is free; the pass-through block is generated — never hand-edit it.

**How to apply:** two dry runs
(`NEXT_PUBLIC_X=<a|b> npx turbo run build --filter=./apps/web --dry=json`),
compare `tasks[].hash` _and_ read `inferred`. A list-membership test
(`expect(TURBO_GLOBAL_ENV_KEYS).toContain(...)`) proves nothing about the hash.

Related: [[review-checklist-unpinned-safety-constants]].
