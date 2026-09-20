---
name: edit-version-precondition-is-not-a-gate
description: VEN-481's optional updatedAt precondition on vendor profile / package PUTs — audited clean; what would make it a finding later
metadata:
  type: project
---

`editVersionSchema` (`z.coerce.date().optional()`) lets a form send the
`updated_at` it opened on; `updatedAtIs()` in `apps/api/src/lib/edit-version.ts`
compares `date_trunc('milliseconds', col)` to a **bound** param. Audited 2026-09-20: no
injection, no cross-tenant read, no new projection.

**Why:** the 409's `details.current` is the _same_ projection as the endpoint's
200 (`toServicePackage`, `loadDetail`), read owner-scoped
(`findPackageById(db, vendor.id, …)`, `findVendorProfileByUserId(db, userId)`),
and `apiErrorSchema.details` is `z.unknown()`, so nothing is stripped or added.
The `FOR NO KEY UPDATE` sits where the publish lock already sat — after the
child writes — so no new lock-order cycle.

**How to apply:**

- It is **concurrency control, not authorization**. It is optional on every
  writer, so never cite it as a guard; the ban/hold/ownership predicates in
  `updateVendorProfileById` / `updatePackageById` remain the only gates.
- Widening `loadDetail` or `VendorProfileDetail` widens the 409 body too — but
  only as far as the 200 already goes. Check the 200 first.
- `z.coerce.date().optional()` turns an explicit `updatedAt: null` into the
  **epoch**, not absent: a null-sending client 409s forever rather than 400s.
- The stale check runs _after_ `replaceVendorCategories`/`Tags` in the tx, so a
  deliberately stale save still does the child DELETE/INSERT then rolls back,
  plus `loadDetail`'s three reads. Self-scoped amplification; rate-limit bound.

Related: [[response-schemas-are-a-second-write-boundary]],
[[vendor-selection-writes-are-transaction-only]].
