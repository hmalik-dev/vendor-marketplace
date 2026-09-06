---
name: public-vendor-card-is-the-widest-anonymous-projection
description: vendorCardSchema is served to anonymous callers by GET /vendors and /vendors/availability/nearby; the Zod serializer strips unmapped columns and 500s on a missing required field, so the risk is the DAO's map, not the select
metadata:
  type: project
---

`vendorCardSchema` (`packages/shared/src/schemas/index.ts`) is the widest shape
this product hands an unauthenticated caller. Two DAOs produce it —
`vendor-search.dao.ts` and `nearby-availability.dao.ts` — behind two routes in
`apps/api/src/modules/vendors/vendors.routes.ts` that carry no `preHandler` by
design (discovery is the front door).

**Why:** `fastify-type-provider-zod`'s `serializerCompiler` parses the handler's
return against the response schema, so unknown keys are stripped and a missing
required key is a 500, not a partial body. Selecting a sensitive column into a
DAO row is therefore _not_ disclosure on its own — `vendor_profiles.created_at`
is selected by both DAOs and never leaves the process, because the returned
object maps it to a boolean. The disclosure decision lives in the object
literal the DAO returns and in the schema, nowhere else.

**How to apply:** when a diff adds a column to either select, check the returned
literal and the schema, not the select. Adding a _required_ field to
`vendorCardSchema` is safe to verify with `pnpm typecheck` alone: every producer
is a typed literal and there are no JSON fixtures of this shape anywhere in the
repo. Web-side skew fails closed — `getFeaturedVendors` degrades to empty,
`search-shell.tsx` sets `hasFailed`, `nearby-dates-band.tsx` empties the band.

Settled as a product decision (#417, 2026-09-06): the `isNew` boolean publishes
30-day-coarse profile recency to anonymous callers. `created_at` was already the
search's ORDER BY tiebreaker, the badge is the feature, and no filter or sort
accepts recency — so there is no recency oracle. Do not re-open it.
See [[response-schemas-are-a-second-write-boundary]] and
[[search-price-filter-is-a-pricing-oracle]].
