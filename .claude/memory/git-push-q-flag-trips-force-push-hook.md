---
name: git-push-q-flag-trips-force-push-hook
description: `git push -q` is rejected by the force-push hook; push with no short flags
metadata:
  type: project
---

In this repo's direct-to-main workflow, `git push -q origin main` is refused
with "Force-pushing is prohibited in this direct-to-main workflow." The hook
reads the command string, not git's actual intent, and `-q` matches its
force-push pattern. Plain `git push origin main` succeeds.

**Why:** the rejection names force-pushing, which sends you looking for a
force flag you never passed — the cost is a wasted cycle re-reading the
command. It also aborts the whole compound command, so a chained
`git commit … && git push -q …` leaves the commit unmade, not half-applied.

**How to apply:** push with no short flags. Keep commit and push as separate
Bash calls so a hook rejection on one cannot silently swallow the other.
Related: [[adhoc-work-single-commit]], [[commit-ticket-changes-immediately]].
