---
name: vendor-slug-aliases-reserve-slugs
description: VEN-648 vendor_slug_aliases — every rename permanently reserves the old slug against other vendors; successor endpoint and redirect audited clean
metadata:
  type: project
---

VEN-648 added `vendor_slug_aliases` (PK slug) and `GET /vendors/:slug/successor`.

Audited clean (2026-09-23): the successor read carries `VENDOR_VISIBLE` on the
joined (unaliased) `vendor_profiles`, so a hidden vendor's old slug 404s exactly
as its current one; the web redirect target is the API's `slugSchema`-validated
slug and the request page's query is rebuilt through `URLSearchParams` — no open
redirect or path injection. `slugExists` 409-ing on a hidden vendor's alias is the
same disclosure current slugs of hidden vendors already had.

**The open hazard is reservation, not disclosure.** An alias is taken for ever by
everyone else, `recordSlugChange` has no cap, and it also fires on an
**unpublished** draft's business-name rename (where the adjacent comment says
nobody has the link). `resolveSlug` tries `MAX_SLUG_ATTEMPTS = 50`
(`base`, `base-2`…`base-50`), so one vendor account can 409 every future vendor
of a common name — before, that took 50 accounts. Reported as a finding on the
VEN-648 audit; fix is record-only-when-published plus a per-vendor cap.

Minor: `slugExists` reads the two tables in `Promise.all` on separate pool
connections outside the renaming transaction, so a racing claim can land a slug
that is both another vendor's alias and a current slug (profile read wins).

**How to apply:** re-check the cap and the published-only condition if this code
moves; do not re-report the redirect or the visibility gate.
