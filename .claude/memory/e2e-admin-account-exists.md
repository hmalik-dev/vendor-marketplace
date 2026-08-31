---
name: e2e-admin-account-exists
description: A persistent E2E admin account exists so /admin can be driven; it is human-provisioned and deliberately outside preflight
metadata: 
  node_type: memory
  type: project
  originSessionId: b3e295a3-6b8d-480d-974e-440616ebf2eb
  modified: 2026-08-31T20:03:47.259Z
---

`E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` live in the gitignored `.env.e2e.local`
alongside the customer and vendor accounts. Created 2026-08-31. **Persistent by
intent — never delete it.** `pnpm db:seed:e2e` upserts its `users` row at
`role = 'admin'` in the same transaction as the other two; the env key is
optional, so a checkout without it still seeds.

**Why:** `role = 'admin'` cannot be reached from inside the product — it is read
from Clerk's `unsafeMetadata` at first sign-in, falls back to `customer`, and is
immutable afterwards. `seed-demo.ts` gives its admin a synthetic `clerk_user_id`
that cannot authenticate. Before this account, the only route to `/admin` was
promoting a customer in the database by hand, which the permission classifier
refused as an unreviewed privileged write.

**How to apply:** to drive any `/admin` surface, sign in through the live UI with
those credentials like any other role. Do **not** add an admin check to
`pnpm preflight` — D27 rules it out: the account is *provisioned* by the account
holder, not *fixture* the repo controls, and gating every ticket on it would put
a human-minted credential in the critical path. Preflight's "customer and vendor"
wording is correct, not stale.

Related: [[vendor-marketplace-e2e-credentials]], [[credentials-env-files-only]].
