---
name: categories-cascade-is-single-edged
description: The seed's category fold hard-deletes a categories row; today only vendor_categories cascades off it, so the fold is safe — re-check the edge list before trusting that again
metadata:
  type: project
---

`applyCategorySuccessors` in `packages/db/src/seed.ts` **hard-deletes** the
retired `categories` row (`tx.delete(categories)`) after copying its
`vendor_categories` links onto the survivor. Everything else in `seedCategories`
deliberately deactivates rather than deletes; this one path does not.

That is safe only because `categories.id` currently has **one** inbound FK:
`vendor_categories.category_id ON DELETE CASCADE`, which the fold has already
copied. There used to be a second — `tags.vendor_category_id ON DELETE CASCADE`,
added in `0015_simple_johnny_blaze.sql` — and a fold run while that column
existed would have silently deleted every tag scoped to the retired category.
`0017_same_khan.sql` (#329) dropped it, which is the only reason the #419
`florals -> decor` fold does not lose data.

**Why:** the fold runs against production reference data on every `pnpm db:seed`,
inside one transaction, with no dry run and no confirmation. A new cascading FK
onto `categories` turns an ordinary schema addition into silent data loss on the
next seed, and nothing in the seed would report it.

**How to apply:** any diff that adds a column referencing `categories.id`, or
adds an entry to `CATEGORY_SLUG_SUCCESSORS`, must be checked against the inbound
FK list:
`grep -rn 'REFERENCES "public"."categories"' packages/db/drizzle/*.sql`.
If the new edge cascades, the fold must move those rows before the delete, or
the FK must be `set null` / `restrict`. See
[[search-retired-category-redirect]] for the map's other invariant.
