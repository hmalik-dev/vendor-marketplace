---
name: playwright-mcp-single-context-scratch-script
description: The playwright MCP server drives one persistent browser context (one cookie jar); there is no tool to load a second .auth/*.json identity mid-session — use a throwaway Node+Playwright script instead
metadata:
  type: project
---

The `mcp__plugin_playwright_playwright__*` tools all operate on a single
browser context that appears to arrive pre-authenticated (e.g. `vendor.json`
already loaded before the first `browser_navigate` call). New tabs opened via
`browser_tabs` share that same context/cookie jar — they do **not** give a
second, independently authenticated identity. There is no MCP tool to call
`browser.newContext({ storageState: ... })` for a second `.auth/*.json` role.
Reading `document.cookie` via `browser_evaluate` to hand-copy the session is
also blocked by the auto-mode permission classifier (consistent with
[[clerk-handshake-urls-leak-session-tokens]] — it would surface a live session
token in the transcript).

**Why:** verifying a negative-permission criterion (e.g. "customer.json must
not reach `/vendor/bookings`") needs a second, isolated identity, and the MCP
tool surface doesn't expose one.

**How to apply:** for a second role's check, write a small throwaway script
into `scripts/_tmp-*.mjs` (repo root, so `import { chromium } from 'playwright'`
resolves — ESM ignores `NODE_PATH`), point `storageState` at the target
`.auth/<role>.json`, drive just the one assertion headless via Bash, print only
booleans/status codes/sanitized paths (strip query strings — they can carry
Clerk handshake tokens), then delete the script immediately after. This is
report-only tooling, not a code change to the app. For the anonymous
(signed-out) state, the same pattern works with no `storageState` at all.
