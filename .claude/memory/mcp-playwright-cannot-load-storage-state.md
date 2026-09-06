---
name: mcp-playwright-cannot-load-storage-state
description: No MCP *tool* takes storageState — but browser_run_code_unsafe does, and that is the cheaper of the two routes to a signed-in pass
metadata:
  type: project
---

No Playwright **MCP tool** takes a `storageState`: there is no
navigate-with-a-session option, so the tool surface alone verifies only
**signed-out** surfaces. There are two ways past that, and the first one is
usually enough.

**1. `browser_run_code_unsafe`, inside the MCP session.** It hands you the
`page` object, and from there the browser, so the ordinary Playwright call
works:

```js
const context = await page.context().browser().newContext({
  storageState: '/abs/path/to/.auth/<role>.json',
  viewport: { width: 1440, height: 900 },
});
const p = await context.newPage();
// … drive p, collect what you need, then:
await context.close();
```

Measured on lane t403, 2026-09-05: both the customer and vendor accounts signed
in this way on the first attempt, each returning role-appropriate data with zero
console errors. It needs no scratch file, so nothing has to be deleted before
staging. Use an **absolute** path — the MCP server's cwd is not the worktree.

**2. A standalone `playwright` script** run with
`pnpm lane:exec <n> -- node <script>.mjs`. Still the right tool when the pass
needs the lane's *environment* (a `DATABASE_URL`, a seeded fixture) rather than
just a session, or when you want it re-runnable outside a Claude session.

**Why:** driving the signed-in half yourself is often mandatory — a nested
agent hitting a permission prompt is unanswerable from a background session and
deadlocks the lane — and "use the Playwright MCP" reads like it covers both
halves until you try it. This entry first recorded the gap as absolute; route 1
above is the correction, so reach for the script only when route 1 is genuinely
not enough.

**How to apply.** Three things that bite in the standalone script, all measured
on lane 411 (2026-09-05), and the first two apply to route 1 as well:

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
  a dirty tree. (Route 1 avoids this entirely, which is most of why it is
  cheaper.)

Related: [[lane-auth-state-arrives-expired]],
[[playwright-browser-is-shared-across-sessions]],
[[vendor-marketplace-playwright-verification]].
