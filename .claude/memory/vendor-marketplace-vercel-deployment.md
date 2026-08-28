---
name: vendor-marketplace-vercel-deployment
description: The Vercel deployment for the web app is web-gules-eta-41.vercel.app
metadata:
  type: reference
---

The vendor-marketplace web app deploys to **https://web-gules-eta-41.vercel.app**.

Use this URL for the localhost-vs-Vercel parity gate at the end of every ticket
run — the user requires that the deployed site matches localhost after each push.

**Why:** the Vercel MCP connector is unauthenticated in non-interactive sessions,
so parity has to be checked by driving this URL directly over HTTP/Playwright
rather than through the connector.

**How to apply:** after pushing to `main`, wait for the redeploy, then compare
the deployed screens against localhost at 1440x900 before calling a ticket Done.
Images missing on Vercel but present locally usually means untracked assets —
see [[vendor-marketplace-local-ticket-tracker]] ticket #32, which is exactly this
bug: `apps/web/.gitignore` ignores `public/marketing/`, so every seeded vendor
cover 404s off the machine the files were downloaded on.

Related: [[vendor-marketplace-playwright-verification]],
[[playwright-parity-gate-every-fe-ticket]]
