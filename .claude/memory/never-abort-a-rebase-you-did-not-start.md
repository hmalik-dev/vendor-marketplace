---
name: never-abort-a-rebase-you-did-not-start
description: With multiple sessions in the shared checkout, tie-break ownership on who holds the live rebase, not on authorship
metadata:
  type: feedback
---

When several sessions claim the same unpushed work in the shared checkout, decide
ownership by **possession of the live rebase**, not by authorship. Every commit in this
repo carries the same git identity (`Humza <hmalik.dev@gmail.com>`), so the log cannot
separate sessions and authorship claims can conflict irreconcilably.

Check before touching anything: `ls -d .git/rebase-merge`, `cat .git/rebase-merge/onto`
and `head-name`, and `git reflog --date=format:'%H:%M:%S'` for the `rebase (start)` line.

**Never run `git rebase --abort` or `--continue` on a rebase you did not start.** It
silently destroys the other session's in-flight conflict resolution and is the only
unrecoverable action in this situation — `.git/rebase-merge/orig-head` and the reflog
protect everything else.

**Why:** on 2026-08-30 five sessions converged on one unpushed 3-commit consolidation
that collided with lane 322's pushed ticket ids. Three claimed the renumber at once.
Authorship arbitration produced a false dispute; possession settled it in one round.

**How to apply:** confirm possession with a yes/no question before arbitrating, tell the
non-holders to stand down completely, and relay findings to the holder rather than acting.
Do not pass on another session's resolution advice without verifying it — a "take origin's
side for row X" instruction makes the finisher drop consolidation content sharing X's hunk.
Related: [[shared-checkout-working-tree-is-a-tripwire]],
[[detached-lane-ticket-ids-collide-silently]].
