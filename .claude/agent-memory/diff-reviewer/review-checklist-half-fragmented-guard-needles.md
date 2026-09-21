---
name: review-checklist-half-fragmented-guard-needles
description: A file that claims it builds a banned token "from fragments" often splits only part of it, so the repo-wide no-trace guard flags the very test that removes the token
metadata:
  type: feedback
---

When a repo-wide no-trace guard bans a token, every file naming it must build it
from fragments (`['cl','erk'].join('')`). A new file's docstring saying "built
from fragments so this does not trip the guard" is a **claim**, not a fact: the
common shape is `['legacy', '<token>'].join('_')`, where only the prefix was
split and the banned word sits whole in the source.

**Why:** VEN-503 added `packages/db/src/auth-provider-enum-migration.test.ts`
with exactly that line; the file was outside the guard's allow-list, so
`repo-guard.test.ts`'s whole-tree scan flagged it and the ticket's own "grep
prints nothing" criterion failed. The scrub diff was 150KB of prose, so the one
live literal read as more scrubbed prose.

**How to apply:** don't eyeball the fragments. Run the guard's own grep
(`git grep -il <token>`) over the tree and diff the result against the
allow-list keys — count must match exactly. Then check the two allow-lists are
distinct: a path allowed for one needle set is not automatically allowed for a
newly added, stricter one.

Second half of the same diff shape: **allow-list entries deleted alongside the
scrub**. `.gitleaks.toml` entries exist for values _older commits_ carry, and
CI runs `gitleaks git .` over the whole history — deleting them turns the
secret-scan job red for ever, no matter how clean the working tree is.
`git log -S '<value>'` proves whether the value is still reachable.

Related: [[review-checklist-repo-wide-token-guard-matches-itself]],
[[review-checklist-source-grep-substring-collisions]].
