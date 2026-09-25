---
name: signup-role-is-confirmed-not-narrowed
description: users.role is written once by acceptTerms; since VEN-662 the role comes from sign_up_roles (recorded by the auth proxy against the provider's sign-up user.id, first write wins) and beats the body; normalizeRole refuses anything outside customer|vendor
metadata:
  type: project
---

`normalizeRole` (`apps/api/src/modules/users/users.service.ts`) **throws** on
anything outside `customer|vendor` (VEN-507) and sits inside `syncUserFromAuth`,
the single writer of `users.role`. `admin` is unreachable from the wire: Zod
`signUpRoleSchema` on both `/legal/terms/accept` and `/internal/sign-up-role`,
a CHECK on `sign_up_roles.role`, and `findSignUpRole` re-narrows on read.
Promotion is `/admin` only. The role is ignored once a `users` row exists
(write-once column) — any new path setting `role` on an existing row breaks it.

**VEN-662 (audited 2026-09-23):** the browser hint (`signup-role.ts`) is gone.
The proxy's `sign-up/email` branch (inside `forwardBudgeted`, so throttled and
400 on an unparseable body) strips `role`, forwards, and on a 2xx POSTs
`{user.id from the provider's answer, role}` to `/v1/internal/sign-up-role`
(`requireWebTierKey` in `onRequest`, 404 when the key is unset). Insert is
`ON CONFLICT DO NOTHING`; `acceptTerms` prefers the recorded role over the body
and deletes it in the creating transaction. The invite gate (`admitVendor`)
still runs on the inserted row, so no gate bypass; an identity created straight
at Neon Auth (no record) falls back to the body role as before.

**Residual, reported Low:** the record belongs to whoever created the identity.
An attacker who signs up a victim's address (pre-account squat) fixes its role
for 7 days; the victim, after reset + verify, sees it stated with no picker.
Fix offered: drop the record on a successful `email-otp/reset-password`.
Re-open if the internal route ever takes an id from anything but the provider's
answer, or if the key reaches a client bundle.

**VEN-663 (audited 2026-09-25):** the proxy's `endEverySession` (after a 2xx
`email-otp/reset-password` + sign-in with the new password) DELETEs the record
at `/v1/internal/sign-up-role` (same key guard/bodyLimit/rateLimit-off as the
POST). Trust boundary clean: the id is the provider's sign-in answer, a reset
needs the OTP, and better-auth's reset marks the address verified (routes.mjs
`resetPasswordEmailOTP`), so the sign-in succeeds for a squatted identity. An
attacker cannot re-record: ids come only from a sign-up answer, which for an
existing address is 422 or a synthetic id. **Finding raised:** with no record,
`accept-terms-screen.tsx` shows a support-only dead end ("never a picker"), so
every pre-Terms reset, legitimate or squatted, is locked out of onboarding,
though `acceptTerms` already falls back to the body role. Caller decides.

**VEN-678 (audited 2026-09-23, PASS):** `signUpWithEmail` reads the relayed
sign-up body only to derive `codeSent = token === null` and keeps nothing else.
The proxy already hands the provider's body to the browser unchanged, so that
read adds no exposure. Skipping the form's own send only lowers mail volume, and
`sendOutcome` defaults to `'ok'`, so the resend offer still shows. Re-open if the
body or the token is stored, logged or put in state.

Related: [[terms-gate-is-a-five-state-session]], [[auth-proxy-parser-differential]],
[[vendor-invite-gate-checks-before-the-row-it-creates]].
