---
name: review-profanity-filter-is-a-hard-reject-floor
description: The reviews blocked-word regex rejects the submission outright by design (no moderation queue until #15) — do not re-litigate the failure mode, but its \w* suffix has confirmed false positives on "spicy", "spice", "retardant"
metadata:
  type: project
---

`BLOCKED_PATTERN` in `apps/api/src/modules/reviews/reviews.service.ts` refuses
the whole write with a 400 rather than publishing-then-flagging.

**Why:** #12 was asked for "profanity filtered" reviews and there is nowhere to
queue to — admin/moderation is #15. Rejecting at the boundary was the only
behaviour available, and the module documents it as "a floor, not a moderation
system". Trivially bypassable (`f u c k`, homoglyphs, misspellings) **on
purpose**; that is not a finding.

**Confirmed defect, separate from the design:** the pattern is
`\b(?:word|…)\w*\b`, and the `\w*` suffix over-matches short stems. Verified:
`spic` matches "spicy" / "spice" / "spices", `retard` matches "retardant",
`shit` matches "shitake". On a marketplace whose categories include caterers
and florists, that rejects a genuine review with an accusation and no appeal
path. The fix is the suffix, not the word list.

**How to apply:** when a later audit touches this filter, report only the
over-match, and treat the hard-reject failure mode and the easy bypasses as
settled until #15 lands a queue. Related:
[[error-handler-4xx-passthrough-leaks-sdk-messages]].
