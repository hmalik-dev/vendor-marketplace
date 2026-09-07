---
name: moderation-levers-are-undoable-by-their-subject
description: #435's admin unpublish and package-deactivate write the same columns the vendor's own editor writes, with no hold flag, so the moderated vendor undoes them from their dashboard; ban is still the only sticky lever
metadata:
  type: project
---

`PUT /admin/vendors/:vendorId/publish` and `PUT /admin/packages/:packageId/active`
(#435, `apps/api/src/modules/admin/admin.service.ts:688` and `:804`) write
`vendor_profiles.is_published` and `service_packages.is_active` — **the same two
columns the vendor writes for themselves**:

- `apps/api/src/modules/vendors/vendors.service.ts:423-440` accepts
  `isPublished: true` on `PUT /vendor/profile` from the profile's owner and
  checks only `publishBlockers`.
- `packages.service.ts:104` accepts `isActive` on `PUT /vendor/packages/:id`
  (`updateServicePackageSchema`, `packages/shared/src/schemas/index.ts:683`).

Neither consults a moderation flag, because there is no such column on
`vendor_profiles` (checked 2026-09-07). So an operator's unpublish survives only
until the vendor toggles it back, and the `admin_actions` row is the only trace.
Hiding a review and removing a portfolio photo are **not** in this class — no
non-admin route writes `reviews.is_public`, and the photo is gone from R2.

Two related shapes in the same code, both narrow:

- `setVendorPublished` republishes on `owner?.isBanned` (`admin.service.ts:712`)
  and `findUserById` excludes soft-deleted users, so a storefront whose Clerk
  account was deleted (`clerk.service.ts:64` soft-deletes the user and leaves the
  profile published) reads as "not banned". Missing owner means unverifiable, not
  unbanned.
- The vendor row is read without `FOR UPDATE` in both new transactions, while the
  review path in the same diff added one. Publish racing the deactivation of the
  last package leaves a published storefront with zero bookable packages.

**Why:** ban is still the only enforcing action, and ban is the nuclear one #435
exists to avoid — so the console's graduated options are advisory against a
vendor who does not want to comply.

**How to apply:** on any later ticket that adds a moderation state (#436's
reports, #437's detail views), ask which route the _subject_ can use to write the
same column before accepting the lever as enforcement. Related:
[[route-handlers-do-not-inherit-layout-gates]].
