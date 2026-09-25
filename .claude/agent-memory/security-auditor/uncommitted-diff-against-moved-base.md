---
name: uncommitted-diff-against-moved-base
description: Two-dot `git diff origin/main` on an uncommitted lane shows every commit landed on main since the fork as a reversal; scope with `git diff HEAD`
metadata:
  type: feedback
---

When the caller says "review `git diff origin/main`" for uncommitted work, check
`git merge-base HEAD origin/main` against `origin/main` first. If main moved, the
two-dot diff shows the newer commits (VEN-747's review window, 2026-09-25) as
deletions the lane never made.

**Why:** VEN-749 looked like it ripped out the review-window check; it was just
behind main by one commit.

**How to apply:** audit `git diff HEAD` (plus untracked files) when HEAD is the
merge-base; never report a "removed guard" that `git log HEAD..origin/main` explains.
