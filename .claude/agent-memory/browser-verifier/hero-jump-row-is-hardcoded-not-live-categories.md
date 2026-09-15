---
name: hero-jump-row-is-hardcoded-not-live-categories
description: SUPERSEDED — as of VEN-401 landing on main (fb696a1a), the hero jump row and footer Browse column now filter against live categories via offeredJumpCategories
metadata:
  type: project
---

**Superseded 2026-09-15.** This memory previously said the landing hero "Or
jump straight to" row and `site-footer.tsx`'s Browse column read
`LANDING_JUMP_CATEGORY_SLUGS` directly and could never reflect a deactivation.
That is no longer true: `apps/web/src/lib/jump-categories.ts` now exports
`offeredJumpCategories(categories)`, which both `page.tsx` and
`site-footer.tsx` call with the live `getCategories()` result — it filters the
ruled 4-slug list down to whichever of those are still active (an empty
`categories` array, meaning the taxonomy read degraded, keeps all four rather
than reading as "every category hidden").

**Verified live, signed-out, 1440x900, 2026-09-15:** deactivating Entertainment
from `/admin/tags` removed it from both the hero row (`Photography · Catering
· Beauty`) and the footer Browse column within the normal ~60-90s revalidate
window ([[revalidatetag-categories-does-not-bust-public-cache]], also updated);
reactivating restored it to its original third position in both. No further
waiting was needed once the cache window elapsed — this is fixed, not a
still-open gap.

**How to apply:** don't re-file "the hero row is hardcoded" against this
codebase. If a future pass finds it stale again, that's a regression against
`offeredJumpCategories`, worth naming as such, not a rediscovery of a known
limitation.
