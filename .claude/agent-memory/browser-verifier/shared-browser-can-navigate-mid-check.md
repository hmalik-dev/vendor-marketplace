---
name: shared-browser-can-navigate-mid-check
description: The shared Playwright browser can navigate to an unrelated URL between two of your own tool calls, because another session drives the same instance
metadata:
  type: feedback
---

`browser_navigate` to `/sign-in` returned page title "Sign in", but the very
next `browser_evaluate` in the same turn read `location.href` as
`/sign-up?role=vendor` — no click, no navigate call in between. A concurrent
session sharing the same MCP browser instance had driven it elsewhere.

**Why:** [[playwright-browser-is-shared-across-sessions]] already covers
viewport size; this is the same root cause (one shared browser, many
sessions) surfacing as a navigation race instead. Trusting the URL from the
last `browser_navigate` response is not enough — a later call can run against
a page that has since moved on.

**How to apply:** every `browser_evaluate` that asserts on page content should
itself read and return `location.href` alongside the assertion, not rely on
the prior navigate's reported URL. If the URL in the evaluate result doesn't
match what you expect, re-navigate and re-read rather than trusting the first
call — don't report findings from a read whose URL you didn't check.
