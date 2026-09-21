---
name: tear-down-lane-neon-branch-after-pr
description: "Delete a lane's Neon branch as soon as its PR is created and verified, at the latest at merge; the project hit its branch ceiling with six stale lane branches"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 92ff5dfd-2c93-437c-ab92-fa23c08f447e
  modified: 2026-09-21T16:26:27.012Z
---

Once a lane's PR is created and its verification passes are done (at the latest when it merges), tear down that lane's Neon branch with `pnpm lane:down <id>`. Never leave a merged lane's branch behind.

**Why:** on 2026-09-21 `pnpm lane:up` failed with `branches limit exceeded` because six stale `lane-ven-*` branches (merged PRs) filled the plan's ceiling. It held VEN-542, VEN-506, VEN-553 and VEN-554 for hours, and the permission classifier refuses a bulk `neon branches delete`, so only the account holder could clear it. The account holder then said: "delete the branch on neon after each PR is created/merge to cleanup."

**How to apply:**
- Use the repo's teardown, `pnpm lane:down <id>`, one lane at a time; it worked where a four-branch `neon branches delete` was denied ([[neon-dev-and-staging-are-safe-production-is-not]]).
- Only your own lane's branch. Never dev, staging, production or `backup-*`, and not a lane whose draft PR is still open and blocked (`lane-ven-507`, `lane-ven-478`) without being asked.
- The desk (orchestrate) puts this line in every lane brief and, on each merge event, checks `neon branches list` for a leftover `lane-*` of a merged PR.
