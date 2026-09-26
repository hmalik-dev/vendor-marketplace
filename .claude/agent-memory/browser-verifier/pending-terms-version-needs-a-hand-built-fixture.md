---
name: pending-terms-version-needs-a-hand-built-fixture
description: how to reach /accept-terms tick mode (explicitTickRequired) without touching any persistent account
metadata:
  type: feedback
---

`explicitTickRequired` is true only when a `users` row exists with **no**
`legal_acceptances` row at `CURRENT_TERMS_VERSION` but at least one row for an
older version. Every real signup path writes the current version into the same
transaction that creates the account, so no ordinary flow ever produces this
state, and every seeded fixture (`ensureAcceptance` in `seed-e2e.ts`) always
accepts the current version too — the persistent E2E accounts can never be in
tick mode.

**How to apply:** sign up a brand-new Mailosaur identity, verify the code, but
stop **before** clicking Continue on the first-run accept-terms screen (that
click is what writes the current-version row). Decode the `sub` claim off the
`__Secure-neon-auth.local.session_data` cookie (JWT, base64url — no
`atob`/`Buffer` inside `browser_run_code_unsafe`, hand-roll the decode) to get
the real `authUserId`, then insert a `users` row plus one `legal_acceptances`
row at an old version (`method: 'seed_fixture'`, mirroring the seed's own
pattern) via the `postgres` driver — resolve its module by absolute path into
`node_modules/.pnpm/postgres@<version>/node_modules/postgres/src/index.js`
rather than importing it from outside `packages/db` ([[lane-db-reads-need-the-postgres-driver-not-psql]]).
Reloading `/accept-terms` then renders tick mode. This is a disposable,
newly-created row, not a shared-state mutation.
