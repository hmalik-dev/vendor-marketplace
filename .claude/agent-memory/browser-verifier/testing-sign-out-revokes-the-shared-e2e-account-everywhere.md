---
name: testing-sign-out-revokes-the-shared-e2e-account-everywhere
description: driving the sign-out flow for the E2E customer/vendor invalidates that account's session in every lane, not just this one
metadata:
  type: project
---

VEN-628 made sign-out revoke every session the account holds at Neon Auth, not
just the current cookie. The E2E customer/vendor identities are shared Neon
Auth accounts across all lanes (`e2e-auth.md`), so actually clicking "Sign
out" in a browser pass invalidates `.auth/customer.json` (or `vendor.json`)
for **every other lane** using that account, not just the one under test.

**Why:** confirmed live — after driving Sign out once, `.auth/customer.json`
in the same lane was already dead for a fresh `newContext({storageState})`
read; had to `pnpm lane:exec <id> -- pnpm e2e:auth customer` again before and
after the sign-out assertion.

**How to apply:** when a ticket requires actually exercising sign-out (not
just navigating past it), expect to re-run `pnpm e2e:auth <role>` for your own
lane afterward, and flag in the report that concurrent lanes' stored sessions
for that role may need the same refresh — this is a real side effect of the
feature, not a bug to route around.
