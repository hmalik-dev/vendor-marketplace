---
name: review-checklist-ceiling-counted-over-a-stale-lookup
description: A client-side per-category limit that counts by resolving each selected id against a page-load list undercounts anything the selection outran — fix the add side and the count side together
metadata:
  type: feedback
---

When a diff hardens a client-side ceiling by passing the _category of the item
being added_ instead of deriving it, check the **counting** side too. Both halves
read the same stale lookup table.

**Why:** #405's `tag-picker.tsx` changed `add(tagId, category)` so a tag missing
from `allTags` could not land in a `categoryOf(...) === undefined` bucket. But
`const inCategory = selectedTagIds.filter((id) => categoryOf(id) === category)
.length` (tag-picker.tsx:51) and `const selected = options.filter(...)` /
`atLimit` (tag-category-section.tsx:50-51) still resolve _already-held_ ids
through `allTags`. A tag the server matched with `status:'exists'` but that the
page never loaded is therefore invisible, uncounted, and unremovable — and the
same ticket had just made the tag list gate the whole profile transaction, so
the resulting over-limit selection 400s the entire save with nothing on screen
to fix.

**How to apply:**

- Ask: can `selectedIds` contain an id absent from the lookup list? Any
  "the server told us about a row we don't have" path (suggestion resolvers,
  optimistic appends, SSE) says yes.
- Probe it: render with `selectedTagIds={['<id not in allTags>']}` and fill the
  category from the visible options. Assert `.toHaveLength(MAX)`, not `MAX + 1`.
- Also assert the held item is _removable_ — `queryByLabelText(/^Remove /)`.
  Uncounted usually means unrendered, which means the user cannot undo it.
- A server-side ceiling that refuses the whole write turns a cosmetic client
  undercount into a hard lockout. Check what the refusal now costs.

Related: [[review-checklist-relaxation-clears-half-a-paired-filter]],
[[review-checklist-async-options-vs-controlled-active-index]].
