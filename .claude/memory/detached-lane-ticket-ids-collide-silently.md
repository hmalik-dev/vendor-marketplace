---
name: detached-lane-ticket-ids-collide-silently
description: "Merging a detached lane's new tickets corrupts the board without ever raising a conflict"
metadata: 
  node_type: memory
  type: project
  originSessionId: a226589d-c388-4508-9d20-71739c6db253
  modified: 2026-08-29T22:44:03.046Z
---

A lane that runs detached files its new tickets starting at whatever id `main`
was on when it branched. When several lanes do this, they all pick the same
numbers — and the merge does **not** surface it as a conflict.

Two distinct silent failures, both hit while merging lanes 124/137/153 on
2026-08-29:

1. **`tickets.ts` rows auto-merge.** Nearly every new ticket declares `[]`, so
   two different tickets that both landed on `254: []` merge to one identical
   line with no conflict. One ticket vanishes from the registry.
2. **Board rows outside a conflict hunk merge at their original id.** Lane 153's
   17 rows were far enough from main's edits that git took them verbatim,
   duplicating #254–#261 on the board while the contiguity test still passed.

**Why:** the registry test asserts contiguity and `HIGHEST_REGISTERED_TICKET`,
neither of which notices a duplicate or a silently-collapsed row. Nothing in the
gate catches this.

**How to apply:** before merging a detached lane, list the ids it added
(`git diff main...<branch> -- packages/shared/src/env/tickets.ts`) and renumber
them onto the next free block. Afterwards, assert every id has exactly **one**
board row — that check is what catches case 2. Identify a lane's rows by
**title**, never by position: after renumbering, position no longer identifies
anything. Resolve status-board hunks **per id**, not per side — each lane carries
the others' rows as untouched `Backlog` stubs, so taking either side wholesale
reverts the other lane's work. See [[filing-a-ticket-is-a-three-file-change]] and
[[ticket-worktree-merge-immediately]].
