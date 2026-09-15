---
name: run-code-unsafe-has-no-require-use-storagestate-option
description: browser_run_code_unsafe runs as an ES module with no require/dynamic import — load a stored identity via browser.newContext({ storageState: <path> }), not fs.readFileSync
metadata:
  type: feedback
---

Inside `browser_run_code_unsafe`, `require('fs')` throws `require is not defined`,
and `await import('node:fs')` throws `ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING` — the
sandbox has no module loader. Reading a `.auth/*.json` file's cookies/localStorage
by hand is not an option.

**Why:** the code runs inside the Playwright server process as a bare async
function, not a Node script with module resolution wired up.

**How to apply:** call `const context = await page.context().browser().newContext({ storageState: '<abs path to .auth/*.json>' })`
then `const p = await context.newPage()` and drive `p` for the rest of the
script — Playwright reads and applies the storage state file itself. Do the
mandated warm-up navigation and delay (see [[warmup-navigations-need-a-real-delay-not-just-a-second-hit]])
on `p`, not on the original `page`. Each `newContext` call leaks a context if
the script errors before closing it — see
[[browser-run-code-unsafe-hang-leaks-contexts]] and close extras via
`browser.contexts()` at the end of a multi-call pass.
