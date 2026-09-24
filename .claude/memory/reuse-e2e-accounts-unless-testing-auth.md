---
name: reuse-e2e-accounts-unless-testing-auth
description: "Don't mint a fresh test account/sign-up for every pass — reuse the existing E2E accounts unless the auth/sign-up flow itself is what's under test"
metadata:
  node_type: memory
  type: feedback
  originSessionId: c0e45c7c-a7ec-4b03-b082-2a2e0842bdb3
  modified: 2026-09-23T02:08:13.647Z
---

Default to the existing persistent E2E accounts (customer/vendor/admin, see
[[vendor-marketplace-e2e-credentials]] and [[neon-auth-e2e-accounts-on-dev]])
for browser-verifier passes, parity checks, and general lane verification.
Only mint a fresh account/address when the thing being verified **is** sign-up,
verification-code delivery, role selection at sign-up, or another step that
requires an account that doesn't exist yet.

**Why:** the user flagged this directly (2026-09-23) — repeatedly creating new
accounts for tests that don't need them is unnecessary churn (real Neon Auth
sign-ups, real verification emails, more accounts to ever clean up). This
matches what [[vendor-marketplace-e2e-credentials]] already says for the
Playwright pass ("use the saved accounts for sign-in and returning-user
flows") — the user's note broadens it to lane verification generally, not
just that one pass.

**How to apply:** when a ticket's verification surface is "signed in as
customer/vendor/admin", reach for the saved `.env.e2e.local` credentials
first. Reserve fresh addresses/accounts for tickets whose acceptance criteria
are actually about the sign-up/verification/invite path itself (e.g. VEN-574,
VEN-406-style gate tests), or where the ticket text explicitly requires a
disposable account (e.g. VEN-621's ban/close tests, which must never touch
the persistent accounts).
