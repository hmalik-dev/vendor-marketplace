---
name: mcp-playwright-cannot-load-storage-state
description: The Playwright MCP browser has no storageState, so signed-in browser verification needs a local Playwright script run through lane:exec
metadata:
  type: project
---

The Playwright **MCP** server drives one browser you cannot hand
`storageState` to — there is no navigate-with-a-session option. So it can only
ever verify **signed-out** surfaces directly. Everything behind auth needs a
short `playwright` script doing
`browser.newContext({ storageState: '.auth/<role>.json' })`, run with
`pnpm lane:exec <n> -- node <script>.mjs`.

**Why:** driving the signed-in half yourself is often mandatory — a nested
agent hitting a permission prompt is unanswerable from a background session and
deadlocks the lane — and "use the Playwright MCP" reads like it covers both
halves until you try it. Writing the script is five minutes; discovering the
gap mid-pass is not.

**How to apply.** Three things that bite in that script, all measured on lane
411 (2026-09-05):

- **Never `waitUntil: 'networkidle'`.** The app holds an SSE stream open for
  notifications, so the network never goes idle and every navigation times out
  at 30s. Use `'domcontentloaded'`, then `waitForLoadState('load')`.
- **A context's _first_ page still lands on `/sign-in`** even with the single
  warm-up reload `.claude/rules/e2e-auth.md` prescribes — the Clerk handshake
  can outlast it. Loop the navigation until `new URL(page.url()).pathname` is
  the path you asked for; two of my three roles needed the third attempt.
- **Put the script inside a workspace package** (`apps/web/`, `packages/db/`)
  so its imports resolve — a scratch file outside the tree cannot find
  `playwright` or `postgres`. Delete it before staging; the commit hook refuses
  a dirty tree.

Related: [[lane-auth-state-arrives-expired]],
[[playwright-browser-is-shared-across-sessions]],
[[vendor-marketplace-playwright-verification]].
