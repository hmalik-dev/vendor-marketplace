---
name: mcp-tabs-new-shares-the-default-cookie-jar
description: browser_tabs "new" opens a tab in the same context as every other session's tabs, not an isolated one; a concurrent session's sign-in can overwrite your cookies and vice versa
metadata:
  type: feedback
---

`browser_tabs({action: 'new'})` creates a new **tab**, not a new browsing
context — it shares the one cookie jar every concurrent session's tabs already
share. On a busy shared Playwright server this caused a real collision: my own
fresh-account sign-up and another session's real E2E-vendor sign-in raced in
the same jar, so `document.cookie` flipped between identities mid-pass, and an
untargeted `browser_snapshot` (no `target`) returned that other session's
**real password in plaintext**, autofilled into its own sign-in form, inside my
tool output. Also: `browser_navigate`/`browser_click`/`browser_snapshot` with no
target act on a **global "current page" pointer** shared server-wide, not on
"the tab I last selected" — `browser_tabs select` does not pin it durably
against another session's concurrent activity.

**Why:** [[playwright-mcp-single-context-scratch-script]] already knew tabs
share one jar; this adds that even URL-level tab identity is unstable under
concurrency, and that the blast radius includes credential exposure, not just
wrong-page reads.

**How to apply:** Never use `browser_tabs new` for a role/identity that needs
isolation from other concurrent sessions (a fresh sign-up, a second role). Go
straight to `browser.newContext()` inside `browser_run_code_unsafe` for every
identity, from the very first action — re-locate it each call via
`browser.contexts()[i]`, never via the plain tab tools. If a snapshot without a
target ever surfaces a credential, do not repeat it in any output; say only
that it happened and that the account's credential needs rotating.
