---
name: vendor-selection-writes-are-transaction-only
description: replaceVendorTags/replaceVendorCategories stopped self-transacting in #405 and are now only correct inside the profile save's transaction; PUT /vendor/tags was deleted and must not come back
metadata:
  type: project
---

`replaceVendorTags` (`apps/api/src/modules/tags/tags.dao.ts`) and
`replaceVendorCategories` (`apps/api/src/modules/vendors/vendors.dao.ts`) each
issue a `DELETE` then an `INSERT` and **no longer open a transaction of their
own** (#405). They are atomic only because their two callers —
`createVendorProfile` and `updateVendorProfile` — pass a `tx`.

**Why:** a vendor's tag selection now travels on the body of
`POST`/`PUT /vendor/profile` (`tagIds`, bounded by
`vendorTagIdsSchema` = `TAG_CATEGORIES.length * MAX_TAGS_PER_CATEGORY` = 15
uuids). `PUT /vendor/tags` was deleted precisely so there is one write path to
that state; a second endpoint would necessarily be the non-transactional one.
Validation (`resolveVendorTagSelection`) runs _before_ the transaction opens so
a refused list cannot leave a profile row behind that the retry then 409s on.

**How to apply:** on any diff that adds a caller of either helper, confirm the
first argument is a `tx` — a plain `db` silently reintroduces the window where a
failed insert leaves a vendor with no tags and no categories. The vendor id is
always `existing.id`/`inserted.id` derived from `findVendorProfileByUserId(auth.id)`,
never client-supplied; a diff that starts accepting a vendor id on that body is
a cross-tenant write. Known residual, accepted as low: the active-tag check runs
outside the transaction, so an admin deactivating a tag in that window still
gets it written.

Related: [[idempotency-guards-orphan-side-effects]],
[[response-schemas-are-a-second-write-boundary]].
