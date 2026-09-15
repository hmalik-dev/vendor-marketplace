---
name: revalidatetag-categories-does-not-bust-public-cache
description: VEN-401 category deactivate/reorder writes revalidateTag('categories') but landing/header/search kept serving the stale list for 10+ minutes
metadata:
  type: project
---

On VEN-401 (admin category deactivate/reorder), `apps/web/src/app/admin/tags/actions.ts`
calls `revalidateTag(CATEGORIES_CACHE_TAG)` after every write and the client
awaits it before `router.refresh()` — confirmed firing with a 200 (Next
`Next-Action` POST) on every Deactivate/Reactivate/Up/Down click, and the DB
(`admin_actions` rows) and the Fastify public API (`GET /categories`, no
caching, reads live) update correctly and instantly every time.

**But** the web app's own cached read of that same endpoint
(`apps/web/src/lib/vendor-data.ts` `getCategories()`, tagged `categories`,
1h `revalidate`) stayed stale on `/` (landing pills + hero jump row) and on
`site-header.tsx`'s vendor-type dropdown (shared by every route including
`/search`) for over ten real minutes and dozens of intervening requests —
confirmed via raw `curl` (no HTTP cache involved; `Cache-Control: no-store`
on the response) against a `next start` production build, single Node
process (verified via `lsof -iTCP:3021`, no clustering). This is not the
documented "one more stale hit while ISR regenerates in the background"
window — it did not clear on its own within the observation period.

**Why this matters:** the ticket's own acceptance walk says "a server action
expires the tag on each write — confirm it updates without waiting." That
specific sub-check is the one that fails; the DB write, the audit row, and
the raw API are all correct.

**How to apply:** if a future pass touches `CATEGORIES_CACHE_TAG` /
`expirePublicCategories` / anything using Next's `revalidateTag` against a
`next start` build in a lane, verify the _rendered HTML_ of a consuming page
via `curl` (not just the admin table's own no-store re-render, and not just
`document.body.innerText` at a narrow default viewport — a hidden mobile/desktop
duplicate nav can silently pass an `innerText` check that a raw-HTML `grep`
would catch, see [[search-bar-has-hidden-duplicate-inputs]]). Don't accept
"the admin UI shows the new state" as proof the public cache actually
invalidated — the admin read is uncached by design and proves nothing about it.
