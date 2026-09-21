---
name: review-checklist-constant-branch-gains-an-upstream-await
description: A read branch that used to answer from a constant with zero I/O, rewritten to await an identity-provider call, turns a provider blip into the error boundary on the one screen that can unblock the account
metadata:
  type: feedback
---

When a diff enriches a GET response, diff the **branch that previously did no
work**. VEN-507's `readTermsStatus` answered every session with no `users` row
from `unacceptedTermsStatus()` — a pure constant, one line, no query. The new
version awaits `loadSnapshot()` (a Neon Auth REST call) to compute
`suggestedRole`, unconditionally and with no `try`.

**Why:** the web read (`getTermsStatus`) rethrows any non-401/403, so the page
goes to the error boundary. That branch is _every first sign-in_, and the screen
it renders is the only one that can create the account — so a transient upstream
makes the gate unrecoverable, where before the reader at least saw the screen and
failed on submit with retry copy.

**How to apply:**

- For each changed read, ask: did this branch do I/O before? A new `await` on a
  network dependency inside a previously-free branch is a new failure mode even
  when the sibling write already depends on it.
- Check what the caller does with the throw. An enrichment that is only a
  _preselection_ should be best-effort (`.catch(() => null)`), not load-bearing.
- The same question for a value a screen merely _suggests_: if losing it is
  cosmetic, losing the whole screen for it is the defect.

Related: [[review-checklist-viewer-anchor-vs-the-read-behind-it]],
[[review-checklist-widened-write-schema-vs-response-schemas]].
