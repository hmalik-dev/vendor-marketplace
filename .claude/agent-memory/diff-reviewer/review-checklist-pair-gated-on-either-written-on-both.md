---
name: review-checklist-pair-gated-on-either-written-on-both
description: A gate that fills each half of a field pair from input ?? stored, in front of a write that only runs when both halves are sent, passes on a lone half the write then discards
metadata:
  type: feedback
---

Compare a gate's predicate with the write that makes it true. In VEN-642, `hasPersonalName = isCompleteName(input.firstName ?? owner.firstName, input.lastName ?? owner.lastName)`, but `updateUserById` runs only `if (firstName !== undefined && lastName !== undefined)`. Because the schema is `.partial()`, `{lastName:'x', isPublished:true}` from a vendor stored as `ada`/`''` passes the publish gate, and `lastName` is never written.

**Why:** fixtures seeded both halves blank (`''`/`''`), so the realistic state (placeholder first name, empty last name) was never exercised.

**How to apply:** for a paired field, send one half against a stored state where the other half is filled. Then check the row, not the response.
