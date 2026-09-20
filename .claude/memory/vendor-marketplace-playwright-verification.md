---
name: vendor-marketplace-playwright-verification
description: Every ticket must be verified end-to-end in a real browser with Playwright before it can be marked Done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8313b59-6214-4b3d-a8e0-2bed9f92a143
  modified: 2026-08-26T15:16:58.266Z
---

Every ticket in `vendor-marketplace` must be driven through its **full user flow in a real browser via the Playwright MCP tools** before it is marked Done. The browser run has to cover the ticket's entire scope — every behavioral requirement in the Linear issue for that ticket, not a spot check of the happy path.

Unit tests, route suites against PGlite, and HTTP smoke tests do **not** substitute for this. They are still required; the browser pass is additional and comes last, after `verify-and-ship`-style checks pass.

**Why:** The user called this out after ticket #2 shipped having been verified only by Vitest suites and a curl smoke test. Route-level tests fake the network boundaries (auth token verification, webhook signatures; Clerk and svix are retired, VEN-449), so they cannot catch a broken real sign-up, a misconfigured auth redirect, a middleware matcher that does not fire, or a role guard that never runs in a real navigation.

**How to apply:** Bring up the real stack (see [[vendor-marketplace-no-docker]] for the database — PGlite over a socket stands in for Postgres), start the API and web dev servers, then drive the flow with `mcp__plugin_playwright_playwright__browser_*` tools. Sign-in uses the persistent Neon Auth E2E accounts ([[neon-auth-e2e-accounts-on-dev]]); Clerk and its `+clerk_test`/`424242` shortcut are retired (VEN-447). Report what was actually observed in the browser, and treat a flow that cannot be reached as a ticket failure, not a caveat.

Related: [[vendor-marketplace-linear-tracker]]
