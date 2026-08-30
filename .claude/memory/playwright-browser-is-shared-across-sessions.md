---
name: playwright-browser-is-shared-across-sessions
description: Parallel sessions share one Playwright browser; read a tab's viewport before resizing it, and never "restore" to a default
metadata:
  type: feedback
---

The Playwright MCP browser is **shared across all concurrent sessions and their
subagents**, not per-worktree. Another lane's tab sits in the same browser as
yours, and `browser_resize` on it silently invalidates whatever that lane is
measuring.

Work in your own new context/tab and close it when done. If you must touch an
existing tab, **read its viewport first and restore that exact value**.

**Restoring to a repo default is a guess dressed as a repair.** On 2026-08-30 a
parity-checker resized another lane's tab, then set it to 1440x900 — this repo's
reference viewport — because it could not know the original. If that tab had
been at 390 deliberately, the next measurement off it would have looked
perfectly valid and been wrong. "Restored" and "restored to what it was" are
different claims; only make the second one when it is true.

**Why:** a viewport is invisible state. A wrong one produces confident,
plausible, wrong numbers rather than an error — the same failure shape the
`web-design-parity` rule warns about: an automated check reporting something it
never established.

**How to apply:** before spawning `parity-checker`, `browser-verifier` or
`unhappy-path-hunter`, tell it the browser is shared and to read-before-resize.
Announce to peers when you take and release the browser — see
[[main-pushes-dequeue-parallel-lane-prs]] for the same courtesy on merges.
Prefer sequencing browser work between lanes over racing for it.
