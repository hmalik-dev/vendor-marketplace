---
name: failure-reason-columns-rest-on-a-status-only-gateway
description: Two durable columns store the mail gateway's Error.message verbatim and one is shown to admins; their PII safety is the single `Resend refused the send (status)` string in lib/email.ts
metadata:
  type: project
---

`vendor_invites.email_failure_reason` (VEN-465) and `email_deliveries.failure_reason`
(#439) both store `error.message` from `EmailGateway.send` verbatim, and the
invite one is returned to operators by `GET/POST /admin/vendor-invites*` and
rendered as a `title` tooltip. Nothing sanitises it.

**Why:** `createResendGateway` throws `Resend refused the send (${status})` —
status only — precisely because a Resend error body echoes the recipient
address. That one line is the whole guarantee. Anyone who "improves" the error
by appending `await response.text()` puts customer and invitee addresses into
two permanent columns, the admin console and (via `log.error({err})` in
`vendor-invites.service.ts`) the log stream, all at once.

**How to apply:** treat any edit to the `!response.ok` branch of
`apps/api/src/lib/email.ts` as a PII change. Related: the retry sweep
re-derives the recipient and the audience from `users` at send time
(`findNotificationForRetry` + `findNotificationRecipient`), never from the
stored attempt row — see [[background-work-queue-carries-no-session]] — and the
two truncation helpers disagree: `truncateFailureReason` cuts by code point,
`recordInviteEmailAttempt` by `slice`. [[err-serializer-is-the-log-sink]],
[[sentry-is-a-second-log-sink]].
