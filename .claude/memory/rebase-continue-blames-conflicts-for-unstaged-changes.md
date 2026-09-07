---
name: rebase-continue-blames-conflicts-for-unstaged-changes
description: git rebase --continue refuses over UNSTAGED changes anywhere in the tree, but reports it as unresolved merge conflicts
metadata:
  type: project
---

`git rebase --continue` prints

> You must edit all merge conflicts and then mark them as resolved using git add

when the working tree has **unstaged changes anywhere**, not only when conflicts
remain. It checks `has_unstaged_changes` and reuses the conflict message for it.

Hit on 2026-09-07 in lane 432 with a provably clean index: `git ls-files -u`
empty, `git ls-files -s | awk '$3 != 0'` empty, and `git status` itself saying
*"all conflicts fixed: run git rebase --continue"* — while `--continue` refused
on every attempt. It survived clearing `AUTO_MERGE`, disabling hooks with
`-c core.hooksPath=/dev/null`, and running `.githooks/pre-commit` by hand to a
clean exit.

**The dirty files were `.claude/agent-memory/`.** `diff-reviewer` and
`security-auditor` carry `memory: project` and write their findings there, and
both were running while the rebase was paused mid-conflict. Any lane that
launches a review agent and then rebases will reproduce this.

The fix is three steps and no data loss: copy `.claude/agent-memory/` to a
scratch directory outside the repo, `git checkout -- .claude/agent-memory`,
`git rebase --continue`, then copy it back and commit it. Do **not** reach for
`git stash` here — the stash stack is shared across every worktree in this repo.

The general rule this is an instance of: when `--continue` refuses, read
`git status --porcelain` for a leading space in column one (unstaged) before
believing anything the error says about conflicts.
