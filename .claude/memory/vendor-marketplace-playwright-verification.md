---
name: vendor-marketplace-playwright-verification
description: Every ticket must be verified end-to-end in a real browser with Playwright before it can be marked Done
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c8313b59-6214-4b3d-a8e0-2bed9f92a143
  modified: 2026-08-26T15:16:58.266Z
---

Every ticket in `vendor-marketplace` must be driven through its **full user flow in a real browser via the Playwright MCP tools** before it is marked Done. The browser run has to cover the ticket's entire scope — every behavioral requirement listed in `~/.claude/plans/vendor-marketplace-tickets.md` for that ticket, not a spot check of the happy path.

Unit tests, route suites against PGlite, and HTTP smoke tests do **not** substitute for this. They are still required; the browser pass is additional and comes last, after `verify-and-ship`-style checks pass.

**Why:** The user called this out after ticket #2 shipped having been verified only by Vitest suites and a curl smoke test. Route-level tests fake the network boundaries (Clerk token verification, svix signatures), so they cannot catch a broken real sign-up, a misconfigured Clerk redirect, a middleware matcher that does not fire, or a role guard that never runs in a real navigation.

**How to apply:** Bring up the real stack (see [[vendor-marketplace-no-docker]] for the database — PGlite over a socket stands in for Postgres), start the API and web dev servers, then drive the flow with `mcp__plugin_playwright_playwright__browser_*` tools. Clerk test instances accept `+clerk_test` email addresses with the fixed verification code `424242`, so real sign-up and sign-in can be exercised without a mail server. Report what was actually observed in the browser, and treat a flow that cannot be reached as a ticket failure, not a caveat.

Related: [[vendor-marketplace-local-ticket-tracker]]
