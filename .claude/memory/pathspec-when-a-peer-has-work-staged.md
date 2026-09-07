---
name: pathspec-when-a-peer-has-work-staged
description: In a shared checkout pathspec both add and commit unconditionally — a clean git status does not mean a peer will not stage before your commit
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

**How to apply: pathspec the commit unconditionally in a shared checkout.** Do
not make it conditional on what `git status` showed, because that check does not
close the window — it is a read, and the peer stages after it.

Second instance, 2026-09-07, landing #431: `git status --short` in the shared
checkout was **clean**, so nothing suggested a peer was mid-commit. Between that
read and `git commit -F <message>` moments later, the orchestrating session
staged a `.claude/memory/` file it had just written, and the plain commit swept
it in. It surfaced only because the commit reported "2 files changed" where one
was staged, and that number was the *only* tell — the tree was clean, the hook
was satisfied, formatting passed, and the file was a plausible neighbour of the
one being committed.

So the check is still worth doing, but as information rather than as the guard:
if it shows staged paths you do not own, tell the peer the moment you are clean,
since they are blocked until you are. The pathspec on `commit` is what actually
holds, and it costs nothing when there is no peer.

This is the narrow exception to [[adhoc-work-single-commit]], which says to sweep
the tree together and is right for *modified* files a peer left lying around. It
does not cover files a peer has staged and is actively about to commit — that is
taking their commit, not tidying the tree.
Related: [[shared-checkout-working-tree-is-a-tripwire]],
[[never-abort-a-rebase-you-did-not-start]].
