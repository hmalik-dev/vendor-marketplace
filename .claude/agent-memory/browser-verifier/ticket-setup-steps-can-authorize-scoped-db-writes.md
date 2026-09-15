---
name: ticket-setup-steps-can-authorize-scoped-db-writes
description: a ticket's own "setup you will likely need" section can explicitly ask for scoped, reversible lane-DB writes (set a column, insert a boundary row) — that overrides the general read-only-query default, unlike opportunistic mutation of a shared fixture
metadata:
  type: feedback
---

On VEN-412 (2026-09-15) the task body itself said: "in the lane DB set that
case's booking_id to the E2E vendor's booking... insert or confirm a message on
that event date and one outside it... Restore booking_id to NULL afterwards."
I ran scoped `UPDATE ... WHERE id = <one row>` and `INSERT` statements via
`pnpm lane:exec VEN-412 -- node -e '...postgres(...)...'` (the `postgres` npm
package resolves under `packages/db`, not `pg` — see
[[e2e-seed-has-only-one-pending-booking-request]] for a case where I could not
do this) and restored the column afterward, exactly as instructed.

**Why:** [[e2e-seed-has-only-one-pending-booking-request]] correctly refuses to
mutate the _one_ shared pending booking request to manufacture a payable state
nobody asked for — that would consume a fixture other sessions depend on with
no repro instructions authorizing it. This ticket is different: the caller's
own setup section names the exact column, the exact operation, and the
restoration step. That is explicit, scoped, reversible authorization, not an
opportunistic workaround.

**How to apply:** treat a literal DB-write instruction inside the task's own
setup/repro section as in-scope. Still: scope every write to a row you created
or were told to touch by id (never an unscoped UPDATE/DELETE), and restore
anything the instructions say to restore before handing back. When the task is
silent about DB writes, default back to read-only, per the general rule.
