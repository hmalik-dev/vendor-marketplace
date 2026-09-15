---
name: hero-jump-row-is-hardcoded-not-live-categories
description: Landing hero "Or jump straight to" row and footer Browse column never reflect category deactivation, by design
metadata:
  type: project
---

`LANDING_JUMP_CATEGORY_SLUGS` (`packages/shared/src/constants/index.ts`) is a
compile-time `as const` list of 4 slugs (photography, catering, entertainment,
beauty), ruled by the account holder 2026-09-06 (#419). `apps/web/src/app/page.tsx`'s
hero "Or jump straight to" row and `site-footer.tsx`'s Browse column both read
this constant directly — never `getCategories()` — so deactivating one of those
4 categories from `/admin/tags` will **never** remove it from either surface, no
matter how long you wait. This is separate from, and not fixed by,
[[revalidatetag-categories-does-not-bust-public-cache]]'s 60s-revalidate fix.

**Why:** the constant is a deliberately fixed "4 popular categories" shortcut
list, intentionally decoupled from live taxonomy state — not a caching bug.

**How to apply:** when a ticket's AC says "a deactivated category leaves the
landing category pills," test the "Browse by category" grid (driven by
`getCategories()`, correctly updates within ~60-90s) separately from the hero
jump row and footer Browse column (hardcoded, structurally cannot update).
Report the hardcoded ones as a scope gap/FAILED against such an AC rather than
waiting longer — no amount of waiting will change them.
