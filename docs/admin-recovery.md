# Admin access, step-up and recovery

What stands between a stolen admin session and every vendor's bookings, and
how the sole admin gets back in. Decision record: D40 in
`.claude/plans/vendor-marketplace-decisions.md`.

## Two controls on irreversible actions (VEN-500)

Neon Auth has no second factor, so the controls are the API's own.

**Step-up.** These routes refuse an admin who has not confirmed in the last
10 minutes, with `403` and error `STEP_UP_REQUIRED`, before any state changes:

- `PUT /admin/users/:userId/ban`
- `POST /admin/users/:userId/close`
- `PUT /admin/bookings/:bookingId/dispute`
- `DELETE /admin/reviews/:reviewId`
- `DELETE /admin/portfolio-items/:itemId`

To confirm: `POST /admin/step-up/challenge` emails a six-digit code to the
address **on the admin's own account** (never one the request names), then
`POST /admin/step-up/verify` with `{ "code": "123456" }`. The code lasts 10
minutes and dies after five wrong tries. A stolen session token cannot mint it
without the mailbox. **The grant belongs to the admin, not to the session that
earned it**: while it is live, a stolen token used at the same time also passes,
which is why the ceiling exists and why a suspected theft is answered by signing
the admin out, not by waiting for the grant to lapse. It is not bound to the
session because the browser's token is refreshed every few minutes, and a
token-bound grant would ask for a code each time. The grant is held in memory, per instance: a restart or a
second replica costs the admin one re-prompt, never an open door.

**Ceiling.** One admin can complete 10 bans and closures per rolling hour
(`ADMIN_DESTRUCTIVE_ACTIONS_PER_HOUR`). The 11th is refused with `429` and error
`ADMIN_CEILING_REACHED`, before any refund is asked of Stripe, and the admin
address is emailed once per six hours per admin. Raise the constant in a
reviewed change, not at 2 a.m.

New irreversible routes must join the list above: put
`onRequest: [adminOnly, requireStepUp]` on them. VEN-506 (admin grant and
revoke) uses the same guard.

## Password reset does not exempt admins

Self-service reset (VEN-470) applies to every account, admins included, and
that is deliberate. An admin signs in with an emailed code, so their mailbox
is already the credential: excluding them from reset would remove no attack
path and would lock out a sole admin who forgot a password. What a reset
cannot do is act: every irreversible route still needs the step-up above and
counts against the ceiling.

## Sole admin locked out

1. **Forgot the password, still have the mailbox:** `/forgot-password`, reset,
   sign in, confirm the step-up when a route asks.
2. **Lost the mailbox, or the account is banned or closed:** only the account
   holder can recover, from outside the app. In the Neon Auth console for the
   branch, change the identity's email to a mailbox they control, or create a new
   identity and sign up with it; then grant `admin` to the new account with the
   transaction under _First admin grant_ in [pre-launch.md](pre-launch.md).
   `app.operator_role_grant` is reserved for that transaction and for VEN-506.
3. **Session believed stolen:** reset the password (ends the other sessions once
   VEN-518 lands; until then sign out and revoke sessions in the Neon Auth
   console), and read `/admin/activity` filtered to the admin for bans and
   closures since the theft. The ceiling bounds the damage to ten an hour.
