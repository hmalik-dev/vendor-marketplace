---
name: neon-auth-e2e-accounts-on-dev
description: E2E customer, vendor and no-row "newcomer" accounts are persistent Neon Auth identities on the dev branch; where their credentials live and what never to do to them
metadata:
  type: project
---

Since VEN-447 (2026-09-19) sign-in is Neon Managed Better Auth, not Clerk. The E2E customer and vendor
are **Neon Auth users on the `dev` branch** (`br-silent-queen-ax78ksii`, project `dark-surf-79137727`),
addresses `orla-e2e-{customer,vendor,newcomer}@example.invalid`, `emailVerified` set by SQL (no inbox).
Credentials are `E2E_{CUSTOMER,VENDOR,NEWCOMER}_EMAIL/PASSWORD` in the gitignored `.env.e2e.local` only.

**Why:** sign-up needs an emailed OTP and `require_email_verification` is on, so an account made per run is
impossible headlessly; persistent ones are the only option. The `newcomer` has **no `users` row on purpose**
(the Terms-gate persona, `e2e/no-row-account.ts`); ticking the Terms box for it destroys the fixture.

**How to apply:**
- Never delete these three from Neon Auth, never accept Terms as the newcomer, never put their passwords in
  Linear, a PR or `.claude/`.
- The main checkout's `.env.e2e.local` must carry the same values or every new lane's `db:seed:e2e` fails at
  the Neon sign-in; the admin account moved off Clerk with VEN-448 (retired).
- Neon connection strings: `neon connection-string dev`, **positional**, and assert the host contains the dev
  endpoint `ep-billowing-dream-ax8jhr9i` before any SQL ([[neon-dev-and-staging-are-safe-production-is-not]]).
- Throwaway sign-ups on dev must be deleted via `neon api /projects/<p>/branches/<b>/auth/users/<id> -X DELETE`.

Related: [[e2e-admin-account-exists]], [[vendor-marketplace-e2e-credentials]].
