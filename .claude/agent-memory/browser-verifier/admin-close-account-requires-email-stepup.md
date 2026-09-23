---
name: admin-close-account-requires-email-stepup
description: POST /admin/users/:id/close (and /ban) answers 403 STEP_UP_REQUIRED on the first press even with a fresh admin session; a lane has no real inbox, so the code is read from GET /__lane/mailbox/latest
metadata:
  type: project
---

On VEN-614 (2026-09-23), clicking "Close account" in the admin console's
`ConfirmAction` dialog and then its confirm button does **not** close the
account on the first press, even immediately after `pnpm e2e:auth admin`. The
API's `onRequest: irreversible` hook (`admin.routes.ts`) requires a step-up:
`POST .../close` 403s with `ERROR_CODES.STEP_UP_REQUIRED`, `ConfirmAction`
catches exactly that code and grows a `StepUpPanel` inside the same
`role=alertdialog` (`components/admin/confirm-action.tsx`,
`components/admin/step-up-panel.tsx`) — it does not close the dialog or show a
generic error, so a script that only waits for the dialog to disappear after
one click will hang or misread "still LIVE" as a failure.

**The real flow, driven end-to-end:**

1. Click the trigger button, then the dialog's own `Close account` confirm
   button.
2. A "Email me a code" button appears in the same dialog — click it.
3. A lane has no real mailbox, so the code never reaches an inbox. Read it
   from `GET http://localhost:<api-port>/__lane/mailbox/latest` (registered
   only when `DEPLOY_ENV=local`, see `apps/api/src/plugins/email.ts`), which
   returns `{ to, subject, text }` for the last email sent; the six-digit code
   is in `text` as `"...confirmation code is 123456."`.
4. Fill the "Six-digit code" input and click "Confirm code" — this retries the
   original close via `onVerified`.

**Why:** VEN-500's destructive-action step-up applies to every `irreversible`
admin route (ban and close both), not just closures with money attached, and
it fires on a per-press basis rather than being satisfied once per session in
any way the UI signals up front.

**How to apply:** any browser pass that closes/bans an account through the
admin console needs this two-round-trip dance, not a single confirm click.
`p.request.get()` (Playwright's own request context, not global `fetch`,
which is undefined in the `browser_run_code_unsafe` Node process) is what
reads the mailbox endpoint from a run_code_unsafe script.
