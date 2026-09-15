---
name: admin-category-writes
description: VEN-401 admin category toggle/reorder routes and the expirePublicCategories server action — audited PASS, with one low duplicate-audit note
metadata:
  type: project
---

VEN-401 (2026-09-15) audited PASS: `admin-categories.routes.ts` uses `requireRoleBeforeValidation('admin')` on `onRequest` like `admin.routes.ts`; reorder body is uuid array, 1..100, duplicate-refined, and the service refuses a list that is not exactly the locked set (409). Audit `detail` holds only booleans/ints. The web server action `expirePublicCategories` takes no args and calls `requireRole('admin')` (local role via API) before `revalidateTag`.

Low, not blocking: `setCategoryActive` reads state outside the transaction and the UPDATE has no `is_active <> $new` predicate, so two concurrent identical toggles both write an audit row.

**Why:** records what was checked so a re-audit does not relitigate it.
**How to apply:** reopen if a category route gains a text field written by an operator (bidi/free-text guard), if the action accepts a tag argument, or if the seed regains the `is_active` overwrite.
