---
name: review-checklist-mirrored-column-rewritten-by-reconcile
description: An app-side write to a users column that the Neon Auth reconcile mirrors (firstName, lastName, email, avatar) is reverted on the next timer tick in staging/prod; lanes never see it because NEON_AUTH_DATABASE_URL is unset there
metadata:
  type: feedback
---

When a diff makes the app the writer of a column on `users`, grep every other writer of that column, timers included: `auth-sync.reconcile.ts` `drifted()` and `applyAuthSyncEvent` patch `firstName`/`lastName`/`email`/`avatarUrl` from the Neon Auth identity whenever the identity's value is non-null and differs.

**Why:** VEN-642 let a customer set a real name via PUT /users/me without syncing the identity. The identity still says `ada` (the email-prefix placeholder), so the reconcile patches `firstName` back to `ada`. `lastName` survives, because an empty identity half is "no opinion". The gate still passes, but the name the user typed is gone. Lanes and suites never run the reconcile (the interval is 0 and the directory is null), so no local check can see it.

**How to apply:** for any write to a mirrored column, ask what `drifted()` returns for (identity unchanged, row changed). Also, "no server-side path to Neon Auth" is false: `NeonAuthDirectory` (`packages/db/src/neon-auth-directory.ts`) is SQL into `neon_auth."user"` over `NEON_AUTH_DATABASE_URL`, and it already does reads and deletes.
