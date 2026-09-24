---
name: failed-lane-seed-leaves-admin-without-users-row
description: A lane whose db:seed:e2e hit a Neon Auth 429 has no admin users row; admin sign-in lands on /accept-terms ("couldn't find how you're joining") until the seed is re-run
metadata:
  type: project
---

VEN-704 lane: seed failed with a Neon Auth 429, so `.auth/admin.json` (even after `node scripts/e2e-auth.mjs admin`) landed on `/accept-terms?returnTo=/admin/cases` with "We couldn't find how you're joining". Re-running `pnpm lane:exec <id> -- pnpm db:seed:e2e` once succeeded (the 429 was transient), then re-running `e2e-auth.mjs admin` landed on `/admin`.

**Why:** the seed is what gives the admin `users.role = 'admin'`; without it /admin is unreachable.
**How to apply:** if admin reads as role-less, retry the seed (tops up, non-destructive) before reporting the admin role BLOCKED. `.auth/*` from the lane also reads signed-out until regenerated in-lane. See [[lane-auth-state-arrives-expired]].
