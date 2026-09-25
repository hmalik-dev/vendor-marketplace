---
name: grant-admin-access-click-denied-by-classifier
description: Auto-mode's permission classifier blocks any run_code_unsafe script that clicks the "Grant admin access" button, even when the script's own intent is to open the dialog and Cancel it
metadata:
  type: project
---

On VEN-737 (2026-09-25), a read-only verification pass tried to open the
"Grant admin access" confirmation dialog on `/admin/admins` (fill the email
input to enable the button, click it, screenshot the dialog, click Cancel —
never confirm) inside one `browser_run_code_unsafe` call. The whole call was
denied before running: "Permission for this action was denied by the Claude
Code auto mode classifier. Reason: [Permission Grant]." Checked immediately
after: no dialog open, admin count unchanged (still "1 of 1 able to sign in")
— so nothing executed, the denial is pre-execution, not a rollback.

**Why:** the classifier reads the _button text/outcome_ ("Grant admin
access") as a permission-grant action regardless of the surrounding code
intending to cancel. It doesn't parse as far as "this script clicks Cancel
next."

**How to apply:** don't retry with different phrasing, a separate call that
splits click-then-cancel, or another tool — that's pursuing the same denied
outcome. Report the Grant admin access dialog (and any Revoke admin dialog,
which needs a second admin row to exist anyway) as BLOCKED by the permission
system, with the reason, and move on. This is consistent with [[testing-sign-out-revokes-the-shared-e2e-account-everywhere]]-style guardrails: destructive-_sounding_ admin actions get blocked even under an explicit cancel-only instruction from the calling agent.
