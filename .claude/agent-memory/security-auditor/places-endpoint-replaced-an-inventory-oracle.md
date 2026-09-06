---
name: places-endpoint-replaced-an-inventory-oracle
description: GET /places (#384) is public reference data over us_cities and touches no vendor row; it replaced /vendors/cities, which leaked per-city published-vendor counts unauthenticated and into every page's RSC payload. The missing ESCAPE clause on its LIKE is correct on Postgres — do not re-report.
metadata:
  type: project
---

`apps/api/src/modules/places/places.dao.ts` answers `GET /places?q=` from
`us_cities` — a committed 35,618-row Census/GeoNames dataset with **no foreign
key to anything**. Nothing on this route reads `vendor_profiles`.

**It is strictly less disclosure than what it replaced.** `GET /vendors/cities`
returned `{city, state, vendorCount}` for every published city, unauthenticated,
and the web app fetched it in `SiteHeader` and passed it as a prop to the
client-side `CitySelect` — so the count of published vendors per city was
serialised into the RSC payload of **every page**, signed-in or not. See
[[client-component-props-are-public-html]]. `/places` returns `{city, state}`
and nothing else; `population` is the ORDER BY key only, and it is public data
committed to the repo in `packages/db/src/us-cities-data.ts` anyway.

**Why:** the ticket's motive was the user's "do not preload and indicate how
many vendors are in each city" instruction, not security, so nothing in the code
says the removal was a disclosure fix. A later change that re-adds a count, a
join to `vendor_profiles`, or an "only cities we serve" filter re-opens the
inventory oracle. Sibling of [[search-price-filter-is-a-pricing-oracle]].

**Two settled points, so a later audit does not relitigate them:**

- The `LIKE` predicates carry **no `ESCAPE '\'` clause** and that is correct.
  The needle is `normaliseForMatch` then `escapeLikePattern` (which doubles
  `\`, `%`, `_` in one pass), and Postgres's _default_ LIKE escape is already
  backslash. Verified live against the lane on 2026-09-05: `q=%`, `q=\`, `q=\%`
  and `q=austi_` all answer `[]`. It reads as a gap next to
  `containsInsensitive` in the same `like-pattern.ts`, which declares `ESCAPE`
  explicitly — it is a consistency nit, not injection. Both patterns are bound
  parameters; the only interpolations are Drizzle `Column` objects.
- The tier-2 `search_name || ', ' || lower(state) LIKE '%…%'` is an
  **unindexable sequential scan and it is the common path** — it runs whenever
  fewer than 8 cities prefix-match, which is most of a typed word. Measured with
  `EXPLAIN ANALYZE` on the full dataset: ~13ms warm, ~50ms cold, and _flat in
  needle length_ (a 100-char repeated-character needle costs the same as a
  6-char one, because every `%`/`_` is escaped so there are exactly two live
  wildcards and no backtracking). Against the committed `RATE_LIMIT_MAX=120`
  per IP per minute that is ~2.6% of a core per attacking IP — accepted as not
  a DoS. Re-open only if the table grows, the needle stops being escaped, or a
  route-level budget is removed.

**How to apply:** treat this route as public-by-design (it sits beside
`/categories` and `/tags`, which are also unauthenticated and unguarded — the
app has **no** route-level rate limits anywhere). The thing to audit on any
future change is not auth, it is whether the query still reads only `us_cities`
and whether the response schema still carries only `city` and `state`.
