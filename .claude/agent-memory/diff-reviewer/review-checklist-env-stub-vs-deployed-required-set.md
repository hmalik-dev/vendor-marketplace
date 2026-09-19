---
name: review-checklist-env-stub-vs-deployed-required-set
description: A test that stubs a deployed environment and calls parseEnv/bootEnv is green only because the untracked repo .env fills the rows the stub forgot — recompute the required set from the registry
metadata:
  type: feedback
---

A new API test that builds a "deployed" env (`vi.stubEnv` + `NODE_ENV=production`) and
then calls something that runs `loadEnv()` + `parseEnv()` is **not self-contained**:
`loadEnv()` dotenv-loads the untracked repo-root `.env`, which silently supplies every
row the stub omitted. CI has no `.env`, so the parse throws a _different_ error and
every `toThrow(<the guard message>)` in the file goes red.

**Why:** VEN-438's `apps/api/src/config/boot.test.ts` stubbed 18 rows and missed
`SUPPORT_EMAIL_TO` — `environments: 'per-environment'` **with** a `defaultValue`, which
`requiresExplicitValue` makes required under the `deployed` target. Local `.env` had it,
`.github/workflows/ci.yml` does not.

**How to apply:** don't eyeball the stub. Recompute the required set from
`packages/shared/src/env/registry.ts`: for consumer `api` and the capabilities in
`API_CAPABILITIES`, a row is required under `deployed` when
`optionalFor` excludes it AND (`defaultValue === undefined` OR
`environments === 'per-environment'`). A default is _not_ a fallback on a deployment.
Then diff that set against the stub, and against the workflow-level `env:` block —
`grep '^KEY=' .env` returning 1 while `grep KEY .github/workflows/ci.yml` returns
nothing is the tell. Related: [[review-checklist-repo-wide-source-guards-fire-on-new-files]].
