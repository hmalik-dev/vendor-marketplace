---
name: tls-headers-key-on-build-time-origin
description: HSTS and upgrade-insecure-requests now key on servesOverTls(), a build-time origin read; deploymentOrigin is NOT guaranteed https despite its docstring, and nothing fails loudly when the header vanishes
metadata:
  type: project
---

`apps/web/src/config/env.ts`'s `servesOverTls()` decides whether
`Strict-Transport-Security` and the CSP's `upgrade-insecure-requests` are sent
(#452). It replaced `NODE_ENV === 'production'`, which was unconditionally true
during any `next build`.

**Why:** `next start` sets `NODE_ENV=production` on a laptop, so a plain
`http://localhost:<port>` origin advertised `upgrade-insecure-requests` —
Chromium exempts the _initial_ request to a trustworthy host but upgrades a
**redirect target** regardless, so every role bounce cost a dead
`ERR_SSL_PROTOCOL_ERROR` round trip. The intent is right.

**How to apply — three things a later audit must not re-derive:**

1. `next.config.ts`'s `headers()` is evaluated by `next build` and serialized
   into `.next/routes-manifest.json`; the running server reads the manifest.
   So the **build** environment decides these headers, not the runtime one.
   Turbo caches `.next/**`, so a restored cache entry restores its manifest —
   and `WEB_URL` is `globalPassThroughEnv` (unhashed), while the `VERCEL_*` /
   `DEPLOYMENT_*` markers are `globalEnv` (hashed).

2. `deploymentOrigin()` is **not** always `https://`, whatever `servesOverTls`'s
   docstring says. `httpsOrigin` in `packages/shared/src/env/deployment.ts`
   only prepends a scheme to a bare host — `/^https?:\/\//` passes an explicit
   `http://` straight through. And `deploymentOrigin` unconditionally outranks
   `siteOrigin`, so `DEPLOYMENT_ORIGIN=http://x` silently beats a correct
   `WEB_URL=https://x` and drops HSTS.

3. The `deployed` schema target deliberately does not tighten shapes, so
   `WEB_URL=http://...` is accepted on a deployment. Only
   `pnpm preflight --env production` applies `productionShape` (HTTPS-only).

Nothing asserts the header after a deploy: `packages/preflight/src/smoke/`
checks that the deployment answers, not what it answers with. A silent loss
stays silent. See [[deployment-gate-detects-by-marker-and-fails-open]] — that
fail-open now costs HSTS too, not just a localhost API origin.
