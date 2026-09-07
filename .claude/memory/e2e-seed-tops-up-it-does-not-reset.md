---
name: e2e-seed-tops-up-it-does-not-reset
description: "pnpm db:seed:e2e tops a lane database up rather than resetting it, so a lane that has driven a destructive pass cannot be returned to its starting state by re-seeding"
metadata:
  type: project
---

`pnpm db:seed:e2e` **tops the lane database up. It does not reset it.**

Measured by lane 438 on 2026-09-07, driving an account-closure pass. Re-seeding
afterwards:

- **did** clear the vendor's `deleted_at` and republish the storefront;
- **did not** un-cancel the booking its closure had cancelled;
- **did not** remove the three `admin_actions` rows, which kept their original
  timestamps;
- **grew** `booking_requests` from 2 to 3 rather than restoring it to 2.

So after one destructive pass, the fixture state the seed *describes* and the
state the database *holds* have diverged, and re-seeding does not close the gap.
In 438's case the "1 upcoming confirmed booking" branch became unreachable in
that lane without inserting a fresh row by hand.

**How to apply:** a lane planning **two** destructive passes — a ban, a closure,
an unwind, anything that cancels or retires — needs `pnpm lane:down <n>` then
`pnpm lane:up <n>` between them, **not** a re-seed. A re-seed is only a top-up
for missing reference data.

**Why it matters beyond the inconvenience:** a second pass run after a re-seed is
measuring a state nobody designed, and it will *look* like a valid fixture. Same
family as [[verify-with-a-differently-shaped-check]] — the run completes and
reports, and the thing it measured was not what the seed says it was.

Related: [[vendor-marketplace-e2e-credentials]], [[worktree-env-copies-drift]].
