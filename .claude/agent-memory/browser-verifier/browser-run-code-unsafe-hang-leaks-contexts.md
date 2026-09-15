---
name: browser-run-code-unsafe-hang-leaks-contexts
description: When a browser_run_code_unsafe script hangs (no response for the full ~1800s idle window), the browser.newContext() it created is never closed — check browser.contexts().length and close every context but the original before continuing
metadata:
  type: feedback
---

On lane ven-383, a `browser_run_code_unsafe` script that combined
`locator.click()` on a custom dropdown option with a follow-up
`keyboard.press('Enter')` form submit hung with no response until the tool's
own idle timeout fired (~1800s) and the call was aborted client-side. The
script's `await ctx.close()` at the end never ran, so the context (and its
page) stayed open in the shared Playwright server process. A follow-up call
showed `page.context().browser().contexts().length` at 4 instead of the
expected 1-2.

**Why:** unconfirmed which specific line hung (suspects: the dropdown's
click-triggered client navigation racing a `waitForTimeout`, or an
actionability wait on an element mid-transition), but the leak itself is
mechanical — an aborted tool call does not run the rest of the async function,
including any `finally`/cleanup at the end.

**How to apply:** after any `browser_run_code_unsafe` call that times out or is
aborted, run a small follow-up script that iterates
`page.context().browser().contexts()`, closes every context that is not the
original `page.context()`, and reports the count — don't just retry the same
script. Prefer direct `page.goto('<url with the filter already in the query
string>')` over clicking a custom dropdown option when the goal is only to
reach a filtered state (not to test the click interaction itself) — it is
faster and did not hang in the same session.
