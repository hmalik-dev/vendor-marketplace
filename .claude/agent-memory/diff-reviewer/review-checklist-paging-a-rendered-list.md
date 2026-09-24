---
name: review-checklist-paging-a-rendered-list
description: Converting a whole-list read to keyset pages — check the tiebreak column's default, the refresh that replaces page 1, and every other consumer of the list
metadata:
  type: feedback
---

When a diff pages a list that used to render whole (VEN-611, `/conversations`):

- **Tiebreak swap.** `ORDER BY key, created_at` became `ORDER BY key, id` for a two-part cursor. `id` is `gen_random_uuid()`, so rows sharing the key (all never-used threads at `epoch`) now sort randomly. Grep the id column's default before accepting "tiebreak id desc".
- **Refresh replaces page 1.** A refetch that `set`s page 1 when "nothing older was loaded" evicts the _open_ row the moment new activity pushes it to position N+1; the pane blanks and reloads. Ask: what if the selected row is the last on page 1?
- **Other consumers.** Every caller of the loader (rails, "has unread" dots) silently narrows to page 1. Grep the loader, not the route.
- **Constant unpinned.** A test that sets the interval option proves the option, not the default; flip the default and see if anything reds.

**Why:** all four shapes were in one diff and none was covered by its tests.
**How to apply:** any `cursorPageSchema`/`pageOf` adoption on a list the UI previously held entirely. See [[review-checklist-limit-added-under-a-post-fetch-filter]], [[review-checklist-unpinned-safety-constants]].
