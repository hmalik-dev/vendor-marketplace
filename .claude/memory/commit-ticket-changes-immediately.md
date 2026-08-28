---
name: commit-ticket-changes-immediately
description: "Every edit to the ticket tracker is committed straight away, never left in the working tree"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b7ac7aa-67aa-4bc5-b30a-4e3f4d606c43
  modified: 2026-08-28T22:17:59.631Z
---

Any change to `.claude/plans/vendor-marketplace-tickets.md` — filing a ticket,
a status transition, a Notes update — gets committed immediately, in the same
turn, without asking first. Stated by the user on 2026-08-28 after I filed #65
and offered to leave it uncommitted.

**Why:** the tracker is the durable queue ([[record-findings-in-backlog]]), and
an uncommitted board is a queue only this session can see. It also blocks the
next commit, because the staging hook refuses a dirty tree
([[adhoc-work-single-commit]]).

**How to apply:** `docs:` commit, tracker file alone, straight onto `main` —
that is what the repo's own history does for board and plan changes, so do not
branch first here. Run `pnpm secrets:scan` and commit; the testing requirement
does not apply to a `.md`-only diff. Do not push unless asked.
Tracker location and conventions: [[vendor-marketplace-local-ticket-tracker]].
