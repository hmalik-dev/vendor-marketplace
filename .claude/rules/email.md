---
paths:
  - 'apps/api/src/lib/email*.ts'
  - 'apps/api/src/plugins/email*.ts'
  - 'apps/api/src/modules/notifications/**'
  - 'apps/api/src/modules/operator-alerts/**'
  - '.claude/agents/browser-verifier.md'
---

# Real email is spent only by a ticket that touches an email flow

Every send through Resend spends one account-wide quota that production shares
(VEN-661): a lane, staging and a user's booking confirmation draw on the same
100 a day. So **a ticket sends real email only when the flow it changes is an
email flow** — a notification, an invite, the support form, an operator alert,
step-up. Everything else verifies with the log-only gateway, which records
what would have been sent and delivers nothing.

That is the default, not a discipline: `EMAIL_DAILY_SEND_CAP` is unset on every
tier but production, and unset there means **0**, so no key and no sink can spend
quota by accident. A lane that needs real delivery sets the variable in its own
lane env for that pass, with the smallest number that covers it, and nowhere
else. A lane's E2E specs never need it: the lane mailbox
(`/__lane/mailbox/latest`) records every message, log-only included.

Production's cap is 80 a day, below the plan limit, and a day that hits it — or
that Resend refuses with a spent quota — closes: every later send that day is
refused without reaching Resend, the retry sweep waits for tomorrow, and Sentry
is paged once. Operator mail (step-up codes, alerts, the digest) is marked
`essential` and may spend 15 slots past the cap, so a flood of ordinary mail
never locks the operator out of the console. Raising the cap is an env change on
the API service, never a code change; the redeploy it takes reopens a day the
old cap closed. A spent Resend quota reopens only at the next UTC day.
