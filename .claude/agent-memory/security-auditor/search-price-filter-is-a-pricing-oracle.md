---
name: search-price-filter-is-a-pricing-oracle
description: GET /vendors' price predicate is an unauthenticated oracle over service_packages — the any-package EXISTS form leaked a vendor's whole active price ladder; the MIN semi-join only exposes the already-public "From" price
metadata:
  type: project
---

`filters()` in `apps/api/src/modules/vendors/vendor-search.dao.ts` builds the
price predicate for a **public, unauthenticated** endpoint, and the shape of
that predicate decides how much of `service_packages` a stranger can read by
probing.

- Until #403 it was `EXISTS (… WHERE sp.price_cents >= $1 AND <= $2)` — true
  when **any** active package fell in the band. Twenty or thirty requests
  binary-search each of a vendor's tier prices, none of which the API returns:
  a card exposes only `startingPriceCents`.
- Since #403 it is `vendor_profiles.id IN (SELECT sp.vendor_id … GROUP BY
sp.vendor_id HAVING MIN(sp.price_cents) …)`. The only value that can be
  probed is `MIN`, which is the "From $X" already printed on the card. Strictly
  less disclosure than before.

**Why:** the ticket's motive was a label/result mismatch, not security, so the
privacy improvement is incidental and nothing in the code says it is
load-bearing.

**How to apply:** treat any rewrite of this predicate as a disclosure change,
not a query change. Reverting to "any package in range", widening the subquery
past `sp.is_active = true`, or adding a new bound over a column the card does
not print (duration, capacity, a package name `LIKE`) re-opens an oracle over
non-public rows. The `VISIBLE` fragment (`is_published`, `NOT is_deleted`) is
a sibling condition AND-ed in the same `WHERE`, so a price subquery cannot
resurface a hidden vendor — keep it that way rather than folding visibility
into the subquery. See also [[response-schemas-are-a-second-write-boundary]].

The file's header comment about Drizzle rendering unqualified columns applies
to the **correlated** subqueries (`startingPriceCents`, the date `NOT EXISTS`,
the tag count). The price one is uncorrelated and references
`vendor_profiles.id` from an unaliased `FROM`; if anyone ever wraps these
statements around `alias(vendorProfiles, …)`, that reference fails loudly with
"missing FROM-clause entry" rather than silently matching the inner table.
