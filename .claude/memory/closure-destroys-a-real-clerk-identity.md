---
name: closure-destroys-a-real-clerk-identity
description: "Admin account closure now deletes the Clerk user for real — closing a seeded E2E account destroys the fixtures for every lane and needs a human to rebuild"
metadata:
  type: project
---

`closeAccount` retires the local row **and deletes the Clerk identity**, ruled
2026-09-07 (#451): the unique index on `users.email` is now partial
(`WHERE deleted_at IS NULL`), so the address is released, and leaving the Clerk
user alive would hold it at Clerk's end while ours had let it go.

**So closing an account is irreversible against a real identity provider.**

**Never close a seeded E2E account.** `E2E_CUSTOMER`, `E2E_VENDOR` and
`E2E_ADMIN` live in `.env.e2e.local` and are **persistent by intent**.
`pnpm db:seed:e2e` *resolves* their existing Clerk ids rather than creating them
— deliberately, because a `users` row carrying an E2E email under an invented id
locks that account out on its next sign-in. So once the Clerk user is gone the
seed cannot rebuild it: **every lane on the box loses its fixtures, and only a
human with the Clerk dashboard can restore them.** The admin account is worst —
it is the only route to `/admin` at all, and `role = 'admin'` is unreachable from
inside the product.

**How to apply.** To drive closure in a browser pass, **sign up a throwaway
account and close that.** The Clerk instance is `pk_test`, so a `+clerk_test`
address works and costs nothing. Never point the closure flow at a fixture, and
never "just try it" against the admin account to see the 409.

Note that the *refusal* path is safe and is the one most passes actually want:
D39 makes closure answer 409 while the account holds a future confirmed booking,
and #454 draws that as a **disabled button with a gold panel** — prevention
before the press. Verifying the refusal never reaches the delete.

Related: [[e2e-admin-account-exists]] and [[vendor-marketplace-e2e-credentials]].
