---
name: pathspec-when-a-peer-has-work-staged
description: When another session has changes staged, use a pathspec on both add and commit or you silently commit their work under your message
metadata:
  type: feedback
---

The index is shared across every session in a checkout. When a peer has changes
**staged** and is about to commit them, `git add <mine>` followed by a plain
`git commit` captures their staged files into your commit, under your message.

Use a pathspec on both steps, each in its own command:

    git add .claude/memory/MEMORY.md .claude/memory/note.md
    git commit -m "..." -- .claude/memory/MEMORY.md .claude/memory/note.md

The `add` clears the unstaged condition the `PreToolUse` hook checks; the pathspec
on `commit` confines the commit to your files and leaves theirs staged. A pathspec
commit *without* the `add` is refused by the hook, so both steps are needed.

**Why:** on 2026-08-30 the hook blocked a peer's ready-to-go commit because this
session's files were unstaged — the dirty session blocks the staged one, not the
reverse. The shortest way out of "unstaged files remain" is `git add` then commit,
and that would have put the peer's tracker and registry edits into a docs commit
they never wrote and never reviewed. It would have looked entirely normal: the
right author, the listed files plus two more, tests green, nothing to notice.

**How to apply:** check `git status --porcelain` for staged (`M ` in column 1)
paths you do not own before committing. If any exist, pathspec both commands and
tell the peer the moment you are clean, since they are blocked until you are.

This is the narrow exception to [[adhoc-work-single-commit]], which says to sweep
the tree together and is right for *modified* files a peer left lying around. It
does not cover files a peer has staged and is actively about to commit — that is
taking their commit, not tidying the tree.
Related: [[shared-checkout-working-tree-is-a-tripwire]],
[[never-abort-a-rebase-you-did-not-start]].
