---
name: bringtofront-can-silently-hijack-mcp-current-page
description: calling page.bringToFront() on a scratch context inside browser_run_code_unsafe can make every later browser_navigate/browser_evaluate/browser_take_screenshot silently target that other context instead of the MCP-tracked page
metadata:
  type: feedback
---

Driving a second role via `browser.newContext({storageState: ...})` inside
`browser_run_code_unsafe` ([[playwright-mcp-single-context-scratch-script]]) is
safe on its own. But if that scratch script also calls
`somePage.bringToFront()` (used here to make Playwright click the right tab
before interacting with it), the _next_ plain MCP tool call —
`browser_navigate`, `browser_evaluate`, `browser_take_screenshot` — can target
that brought-forward page instead of the page the MCP server had been tracking
as "current." This happened mid-pass on VEN-401: after driving an admin
deactivation in a scratch admin context with `bringToFront()`, every
subsequent "signed-out" `browser_navigate('/')` and `browser_evaluate` actually
read the admin-authenticated page — silently, with no error, and with a URL
that still correctly read `/` and `/search`, so nothing about the tool output
flagged it. It only surfaced because a full-page screenshot happened to show
"Admin"/"Sign out" in the header.

**Why:** the MCP server appears to track "current page" as something closer
to "most recently focused page across the whole browser" rather than strictly
scoping to its own originally-opened context — `bringToFront()` moves that
needle even though it was called through raw Playwright, not through an MCP
tool.

**How to apply:** after any scratch script that calls `bringToFront()` on a
second-role page, don't trust the next `browser_navigate`/`browser_evaluate`
to be reading the role you started in. Before relying on a "signed out" (or
"signed in as X") read following such a script, verify the auth marker
explicitly (`text=Sign in` present / `text=Admin`+`text=Sign out` absent, or
the reverse) — cheaply, without touching cookies directly (that's denied by
the PII classifier anyway). If contaminated, don't try to recover the
original page: open a brand-new `browser.newContext()` with no storage state
inside `browser_run_code_unsafe` and do the remaining reads/screenshots
entirely inside that script (querying `browser.contexts()` for the fresh one
by its lack of a "Sign in" marker, since array position isn't reliable when
other sessions' orphaned contexts — [[browser-run-code-unsafe-hang-leaks-contexts]]
— are mixed into the same list). Close every scratch context you created when
done; never close a context you didn't create (other lanes' leftovers sit in
the same `browser.contexts()` list, e.g. port-3021 contexts from an unrelated
session, harmless to read but not yours to close).
