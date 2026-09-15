---
name: revalidatetag-categories-does-not-bust-public-cache
description: RESOLVED on main (VEN-401, fb696a1a) — on-demand revalidateTag was abandoned in favour of a 60s time-based revalidate window, which works
metadata:
  type: project
---

**Resolved 2026-09-15.** This memory previously reported that
`revalidateTag(CATEGORIES_CACHE_TAG)` fired correctly on every admin
deactivate/reorder but did not actually bust the web app's cached
`getCategories()` read under a `next start` production build in a lane, for
10+ real minutes.

The shipped fix (see the comment on `CATEGORIES_REVALIDATE_SECONDS` in
`apps/web/src/lib/vendor-data.ts`) abandoned on-demand `revalidateTag`
entirely: "On-demand `revalidateTag` from the console was tried first and did
not expire the entry under `next start` in a lane." Instead the taxonomy's
cache window was shortened from the shared 1h (`REFERENCE_DATA_REVALIDATE_SECONDS`)
to a dedicated 60s (`CATEGORIES_REVALIDATE_SECONDS`), covering the landing
pills, hero jump row, footer Browse column and the header/`/search` vendor-type
picker (all of which read `getCategories()`).

**Verified working, 2026-09-15, lane build (fresh `next start`):** raw API
(`GET /categories`) updates instantly on deactivate and reactivate, confirmed
via `curl` against the API port directly. The web surfaces above picked up a
deactivation within ~70s (one wait past the 60s window), and — this is the
part worth remembering — **reactivation needed one extra round-trip**: the
first page load after the 70s wait still served the previous (deactivated)
cached response, because Next's stale-while-revalidate serves the stale entry
on the request that crosses the window and regenerates in the background; a
_second_ load a few seconds later showed the fresh (reactivated) state. One
`curl`/one page load right at the boundary is not proof of failure — reload
once more before concluding the cache didn't bust.

**How to apply:** don't re-file "the public cache doesn't bust" against this
codebase — it's fixed, by design, with a known one-extra-request quirk right
at the revalidate boundary. If a future pass finds staleness that does _not_
clear on a second request several seconds later, that's a real regression.
