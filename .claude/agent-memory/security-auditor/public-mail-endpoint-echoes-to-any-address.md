---
name: public-mail-endpoint-echoes-to-any-address
description: POST /support/messages is the only unauthenticated route that makes the server send mail, and its confirmation goes to a caller-named address carrying the caller's own text
metadata:
  type: project
---

`POST /support/messages` (#421) is the product's only public, unauthenticated
route that causes an outbound email. One call produces **two** sends: a report
to `SUPPORT_EMAIL_TO`, and a confirmation to whatever address a signed-out
caller puts in `email`. `renderSupportConfirmation` briefly echoed the caller's
4 000-character `message` back into that mail, under the brand template and the
verified sending domain. **Fixed in #421 before it landed**: the echo is gated
on `fields.signedIn`, so only an address resolved from a `users` row ever gets
the message back.

**Why:** the design (`design/contact-support/`) only requires the confirmation
to repeat the _reference_. The message echo was an implementation choice, and it
is what turns "we mail a stranger a receipt" into "an attacker chooses both the
recipient and the body of branded, DKIM-signed mail". Neither the ticket nor the
frame asked for it, so withholding it for `signedIn === false` costs nothing
that was specified.

**How to apply:** the confirmation to an unverified address must stay
content-free — reference and standing copy only. Two tests pin it, in
`support.routes.test.ts`: the signed-out case asserts the message is absent from
both parts, the signed-in case asserts it is present. Any later change to
`support-email.ts` or `support.service.ts` has to answer for the
unverified-recipient path separately from the report path.
The signed-in half is sound and settled — `resolveReplyTo` reads the address off
the `users` row, ignores a supplied `email`, and 401s a soft-deleted account, and
there is a test pinning each. Do not re-audit that half; audit what reaches an
address nobody verified. Related: [[rate-limit-key-is-the-proxy-not-the-caller]],
[[log-redaction-covers-query-not-path]].
