---
name: neon-auth-codes-bypass-lane-mailbox
description: Sign-up verification and forgot-password codes come from Neon Auth directly, not the app's Resend gateway, so /__lane/mailbox/latest never has them
metadata:
  type: project
---

`/__lane/mailbox/latest` (the log-only lane mailbox described in `.claude/rules/email.md`)
only ever captures mail sent through the app's own `emailPlugin` (Resend-backed,
`apps/api/src/plugins/email.ts`). The six-digit sign-up **verification code** and
the forgot-password **reset code** are sent by Neon Auth itself — a separate
system — so they never reach that mailbox, real Mailosaur delivery or not. A
`curl /__lane/mailbox/latest?to=<addr>` right after signing up will 404 with "No
email has been sent" even though the code did go out.

**Why:** `packages/db/src/scripts/e2e-mail-code.ts`'s own doc comment says "the
six-digit code dev Neon Auth mails" — confirmed by testing VEN-733: a sign-up to
a non-Mailosaur throwaway address left the lane mailbox empty, but a real
`<local>@<E2E_MAIL_SERVER>.mailosaur.net` address plus `pnpm e2e:mail-code
<address>` (no `EMAIL_DAILY_SEND_CAP` needed — this bypasses that cap entirely)
returned the real code within a few seconds, both for sign-up and for a fresh
vendor sign-up.

**How to apply:** for a fresh-signup or password-reset flow, always use a real
`E2E_MAIL_SERVER`-domain address and `pnpm e2e:mail-code`, never the lane
mailbox — the lane mailbox is right for step-up/admin-alert/notification email
(anything the app's own gateway sends), wrong for anything Neon Auth sends. The
`E2E_MAIL_SERVER` value (a Mailosaur workspace id, e.g. read from
`.env.e2e.local`) is not treated as secret in this repo — `apps/web/e2e/staging-onboarding.ts`'s
`stagingAddress` helper takes it as a plain parameter and constructs addresses
with it in checked-in code; only `E2E_MAIL_API_KEY` is the credential the CLI
refuses to accept as an argument.
