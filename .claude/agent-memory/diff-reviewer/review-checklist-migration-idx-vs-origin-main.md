---
name: review-checklist-migration-idx-vs-origin-main
description: A diff adding packages/db/drizzle/00NN_*.sql may collide with an NN already landed on origin/main; the snapshot filename is the same path, and snapshot-parity reads the lexicographically last one
metadata:
  type: feedback
---

Any diff that adds a drizzle migration is a claim about a number that another
lane may already have taken. Before passing it, run:

```
git show origin/main:packages/db/drizzle/meta/_journal.json | tail -12
git ls-tree --name-only origin/main packages/db/drizzle/
```

**Why:** on #436 the branch added `0035_nosy_vulture` while `origin/main`
already carried `0035_familiar_vector` (landed by a sibling lane). The `.sql`
files have different names so they look mergeable, but
`packages/db/drizzle/meta/0035_snapshot.json` is **the same path in both** and
`_journal.json` gets two `idx: 35` entries. `snapshot-parity.test.ts` picks the
lexicographically last `*_snapshot.json`, so whichever copy survives the merge
is missing the other lane's enum values and the test fails naming an enum
nobody in this diff touched — and the next `pnpm db:generate` diffs against the
wrong snapshot and re-emits columns that already exist.

**How to apply:** check the number against `origin/main`, not against the
branch's own base — the base being an ancestor of main proves nothing, main
moves. Also `ls` the working tree's drizzle dir: an untracked `00NN+1_*.sql`
means the next number is claimed by a lane that has not committed yet. The fix
is always regenerate against the landed snapshot, never rename the file.

Related: [[review-checklist-dirty-tree-vs-reviewed-commit]].
