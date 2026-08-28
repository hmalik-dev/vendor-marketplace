---
name: open-playwright-before-frontend-work
description: Open a live Playwright browser session before starting frontend implementation so the user can watch changes happen
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ec256595-5603-49d1-bf97-42354cc51c10
  modified: 2026-08-26T15:58:35.805Z
---

Before writing any frontend code in a ticket — at the moment backend work ends and FE implementation begins, not at the later verification step — open a Playwright MCP browser session and navigate it to the page being built, so the user can watch the UI change live as it is implemented.

**Why:** The user wants to observe frontend work as it happens rather than only seeing the finished result during the mandatory end-of-ticket browser verification pass.

**How to apply:** In the ticket workflow, insert this right before the first FE edit: bring up the dev servers, call `browser_navigate` to the relevant route, and keep the session open through implementation, re-snapshotting as pages change. This is in addition to — not a replacement for — the full end-to-end browser verification required by [[vendor-marketplace-playwright-verification]] before a ticket is Done.
