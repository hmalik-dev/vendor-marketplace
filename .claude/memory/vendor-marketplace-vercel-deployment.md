---
name: vendor-marketplace-vercel-deployment
description: web-gules-eta-41.vercel.app follows the `production` branch, not `main` — and localhost is the parity target for now
metadata:
  type: reference
---

The web app deploys to **https://web-gules-eta-41.vercel.app**, which since
2026-08-29 follows the **`production`** branch, not `main`.

**Parity is checked against localhost, not against a deployed URL.** User ruling,
2026-08-29. Local development is a complete stack — Docker Postgres 18 and MinIO
per [[vendor-marketplace-no-docker]] — so a screen can be driven and compared at
1440x900 without any deployment.

**Why the old instruction no longer works.** This memory used to say "after
pushing to `main`, wait for the redeploy, then compare the deployed screens
against localhost." Both halves broke:

- `main` no longer reaches that URL. Vercel's Production Branch is `production`,
  which advances only by deliberate fast-forward, so a push to `main` produces a
  **preview**, and the live site stays where it was.
- Preview deployments are behind Vercel Authentication
  (`ssoProtection.deploymentType: all_except_custom_domains`), so a preview URL
  answers **302 to vercel.com/sso-api**, not the app. Playwright cannot drive one
  without a `VERCEL_AUTOMATION_BYPASS_SECRET`, which is not configured.

The old note also claimed the Vercel MCP connector is unauthenticated in
non-interactive sessions. That was wrong on 2026-08-29: the connector answered
`list_projects`, `get_project`, `list_deployments` and
`get_deployment_build_logs` fine, and the `vercel` CLI is logged in as
`hmalikdev-5297`.

**How to apply:** verify against `localhost:3000` at 1440x900. Only check the
deployed site when the question is specifically about production — a release, or
a bug that does not reproduce locally. To verify a preview URL you must first
generate the bypass secret (`vercel project protection enable
vendor-marketplace-web --protection-bypass`) and send it as
`x-vercel-protection-bypass`.

Images present locally but missing when deployed usually means untracked assets —
ticket #32: `apps/web/.gitignore` ignores `public/marketing/`, so every seeded
vendor cover 404s off the machine the files were downloaded on.

Related: [[vendor-marketplace-playwright-verification]],
[[playwright-parity-gate-every-fe-ticket]], [[vendor-marketplace-no-docker]]
