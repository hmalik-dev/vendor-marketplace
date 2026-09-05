---
name: deployment-gate-detects-by-marker-and-fails-open
description: The 'am I deployed?' gate in packages/shared/src/env/deployment.ts decides by platform marker or NODE_ENV, degrades silently on an unknown host, and its markers are unhashed pass-through env
metadata:
  type: project
---

`packages/shared/src/env/deployment.ts` is the single answer to "am I deployed?"
for both apps (added with the `deployed` `ShapeTarget`, 2026-09-04). Audit it as
a gate that can be _absent_, not one that can be wrong:

- `isDeployedBuild` = a named platform marker only (`VERCEL*`, `RENDER*`,
  `RAILWAY_*`, or the escape hatch `DEPLOYMENT_PLATFORM`). `isDeployedRuntime`
  adds `NODE_ENV === 'production'`. On a host nobody has named that also does
  not set `NODE_ENV`, both answer **false**, the app silently takes the laptop
  value set, and nothing fails loudly. Today `apps/api/Dockerfile` and
  `render.yaml` both set `NODE_ENV=production`, which is the only reason the
  deployed paths are covered — check that first when either changes.
- `deploymentPlatform().origin` is `null` for a marker that announces no host
  (`DEPLOYMENT_PLATFORM` with no `DEPLOYMENT_ORIGIN`, `NODE_ENV` alone). Every
  check that compares against an origin is then skipped rather than failed —
  the Clerk webhook guard is the live example. See
  [[webhook-endpoint-guard-string-matches-localhost]].
- The markers live in `turbo.json`'s `globalPassThroughEnv` (generated from
  `PLATFORM_ENV_KEYS` via `passThroughKeys()`), which Turborepo **excludes from
  the task hash**. A build's strictness is now env-dependent while its cache key
  is not, so a laptop-produced `web#build` can in principle be restored on a
  platform with the localhost defaults already inlined. `globalEnv`
  (`TURBO_GLOBAL_ENV_KEYS` in `generate.ts`, currently `NODE_ENV` and
  `CSP_ENFORCE`) is the hashed list and the correct home for anything the gate
  branches on.

**How to apply:** on any diff that adds a platform, moves a check behind
`isDeployed*`, or changes what a value set requires, ask what happens on a host
that matches nothing — the answer must be "throws", not "behaves like a laptop".
Related: [[env-target-live-key-trap]].
