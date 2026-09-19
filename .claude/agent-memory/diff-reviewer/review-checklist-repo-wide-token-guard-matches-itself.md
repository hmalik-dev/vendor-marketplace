---
name: review-checklist-repo-wide-token-guard-matches-itself
description: A new repo-wide forbidden-token scan over `git ls-files` matches its own docstring and its own allow-list reasons; re-run its predicate over the tree in node before trusting the lane
metadata:
  type: feedback
---

A "this word may not come back" guard that scans every tracked file **includes
its own source**. Its docstring names the word it forbids ("the identity
provider (Clerk) was replaced…") and every allow-list entry whose _reason_
spells the word (`'sends the `svix-*` headers'`) is another self-match. Building
the needles from fragments (`['cl','erk'].join('')`) protects the needle array
and nothing else, and the file's comment will claim otherwise.

**Why:** VEN-449 shipped `packages/shared/src/repo-guard.test.ts` with `(Clerk)`
on line 8 and literal `svix` in ~14 allow-list reasons. The scan lowercases
`path + text`, so two of its five cases were red — `finds nothing outside the
allow-list` and `flags a forbidden token added under apps/`, because the real
violation rides along in the array the planted file is appended to. The ticket's
acceptance criterion was "the guard test passes".

**How to apply:** never eyeball the allow-list. Reimplement the predicate in one
node call — `git ls-files > /tmp/f` as a plain command first, then read each
path, lowercase `path+"\n"+text`, apply the same prefix/file exemptions — and
print the violation array. Same call, check every `ALLOWED_FILES` key still
exists **and** still matches, since a stale key is its own failing case. Related:
[[review-checklist-source-grep-substring-collisions]],
[[review-checklist-repo-wide-source-guards-fire-on-new-files]].
