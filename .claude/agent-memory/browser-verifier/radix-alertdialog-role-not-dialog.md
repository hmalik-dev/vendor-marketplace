---
name: radix-alertdialog-role-not-dialog
description: Scratch-script confirm-dialog flows must query [role="dialog"], [role="alertdialog"] together, not just role=dialog, or the confirm click silently no-ops
metadata:
  type: feedback
---

Driving a destructive-action confirm flow (e.g. admin "Release payout hold",
"Publish profile") from a throwaway Playwright script, `page.locator('[role="dialog"]')`
matched **zero** elements even though a confirm modal was visibly open on
screen (`getByRole('button').allInnerTexts()` on the whole page showed
`["Cancel", "Release hold"]`). The app's confirm modals are Radix
`AlertDialog`, which renders `role="alertdialog"`, not `role="dialog"`. The
script's `dialog.count() > 0` guard silently skipped the confirm click, the
action never completed, and the DB state was left half-migrated (payout hold
set but never released, package deactivated but vendor left unpublished)
until a second pass fixed the selector and explicitly restored state.

**Why:** an admin action screen documents its confirm copy but not the ARIA
role backing it, and Playwright's `getByRole('dialog')` does not implicitly
include `alertdialog` even though both are exposed identically by most
screen readers.

**How to apply:** when scripting a confirm-then-verify flow against this
app's admin actions, always scope confirm-button lookups to
`page.locator('[role="dialog"], [role="alertdialog"]')` (or just query
`page.getByRole('button', { name: <exact confirm label> })` unscoped once you
know the exact label — e.g. "Release hold", "Deactivate package", "Publish
profile" — the button's own label differs from the trigger's label and is
worth printing/dumping once per new action before trusting a regex match).
After any interrupted mutation-driving script, always re-query the DB state
before declaring done; a half-completed round-trip is a real defect if it
ships, and a false one if it's just your own script's dangling click.
