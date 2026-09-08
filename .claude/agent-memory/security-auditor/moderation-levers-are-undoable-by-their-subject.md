---
name: moderation-levers-are-undoable-by-their-subject
description: #457's moderation_hold makes an operator's takedown outlive the vendor's disagreement — the two ways the subject could still win were found on its own lane and both were closed before it shipped
metadata:
  type: project
---

`vendor_profiles.moderation_hold` and `service_packages.moderation_hold` landed
in #457 (branch `worktree-457`, migration `0039_polite_owl.sql`). The steady
state is now correct: `PUT /admin/vendors/:id/publish` and `PUT
/admin/packages/:id/active` are the **only** writers of either column — verified
by grep across `apps` and `packages`, no seed, webhook, sweep, ban, closure or
E2E-fixture writer — and `updateVendorProfile` / `updatePackage` refuse the
re-publish and the re-activation with a 403. Neither column reaches any response
schema (every one is a strict `z.object`), so there is no disclosure.

Two ways the subject still wins, both reported on that branch:

- **The hold can only be set on a row that is live right now.**
  `admin.service.ts:917` (`vendor.isPublished === isPublished` → 409) and
  `:1124` for the package. A vendor who is unpublished when the operator acts —
  including one who pauses themselves on being contacted — cannot be held at
  all, and `vendor-table.tsx:473` (`const published = row.status === 'live'`)
  offers a non-live row only "Publish profile". `0039` has no backfill either,
  so every storefront #435's lever had already taken down migrates in unheld.
- **The vendor's write is a lost update.** `vendors.service.ts:375` reads the
  row outside any transaction, `:456` checks the hold, `:492` writes predicated
  on `id` alone; the admin side holds `for no key update` (`admin.dao.ts:618`)
  but the vendor side takes no lock and never re-reads, so a publish in flight
  queues behind the operator's commit and sets `is_published = true` under a
  standing hold. `packages.service.ts:84/131` is the same shape. The resulting
  row is live on search and reads `Held` in the console — and `Held` is not
  `live`, so the only button offered is Publish, which 409s.

**Why:** the fix's whole claim is that an operator's takedown outlives the
vendor's disagreement. Both holes leave that claim resting on the vendor not
being unpublished and not retrying at the wrong moment.

**How to apply:** any state meant to survive its subject needs the guard in the
`WHERE` of the write, not in a service-level read — and needs a way to be
recorded on a row that is _already_ in the target state. Related:
[[admin-action-log-is-trigger-immutable]],
[[response-schemas-are-a-second-write-boundary]].

**Both were fixed on the same lane, before #457 shipped — do not re-report them
as open.** The no-op check now compares **both** columns the route writes, so
taking down an already-unpublished storefront is a real action that sets the
hold, and `vendor-table.tsx` offers Publish and Unpublish as two items rather
than one that flips on `status === 'live'`. The vendor's publishing write
carries `moderation_hold = false` in its own `WHERE` through
`updateVendorProfileById`'s `requireUnheld` option, with the same for
`updatePackageById`; the service-level check is kept as a fast refusal so the
403 still beats the publish-blocker 400, and is no longer what guarantees
anything. `vendor-publish.contention.test.ts` holds the invariant on a real
two-connection Postgres — measured failing three runs out of three with
`requireUnheld` removed. The absent backfill is now a stated decision in the
column's own docstring rather than a silence: `admin_actions` cannot say whether
a takedown still stands, because a vendor republishing writes no row, and the
widened lever sets the hold on those rows in one press.

**The check to carry forward is the shape, not this instance:** when a guard
reads a row and a later statement writes it, ask what commits in between — and
when an idempotence check refuses a no-op, ask whether it compares everything
the call would write.
