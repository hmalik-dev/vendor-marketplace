---
name: run-code-unsafe-globals-dont-persist
description: globalThis assignments in one browser_run_code_unsafe call are gone in the next, even though the underlying browser/contexts survive
metadata:
  type: feedback
---

Each `browser_run_code_unsafe` call runs in a fresh JS scope — a `globalThis.__foo = page` set in one call is `undefined` in the next (throws `Cannot read properties of undefined`). The remote browser process and its contexts/pages **do** persist between calls (confirmed via `browser.contexts().length`), only your local variables don't.

**Why:** each call appears to be a separate script execution attached to the same CDP browser, not a shared Node VM.

**How to apply:** re-derive the page you need every call via `page.context().browser().contexts()`, not a stashed reference. `browser.contexts()` preserves creation order, so when driving multiple roles (e.g. signed-out original + customer + vendor + admin, each added via `newContext({storageState})`), index them by creation order (`contexts[0]` = MCP's original page, `contexts[1..n]` = roles in the order you created them) rather than trying to match by URL, since two roles can land on the same URL (e.g. both sides of one conversation).

Related: [[playwright-mcp-single-context-scratch-script]], [[browser-run-code-unsafe-hang-leaks-contexts]]
