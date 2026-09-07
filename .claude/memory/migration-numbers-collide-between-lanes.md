---
name: migration-numbers-collide-between-lanes
description: Two lanes that both run pnpm db:generate claim the same NNNN migration index; renaming is wrong, regenerate instead
metadata:
  type: project
---

Two lanes that each run `pnpm db:generate` both get the next free index, so both
write `0025_*.sql` and both add `"idx": 25` to `meta/_journal.json`. It surfaces
as a merge conflict in the journal plus an add/add on the snapshot — and it would
have failed at **apply** time, not in CI, because each branch's migration set is
internally consistent on its own.

**Do not resolve it by renaming your file to the next number.** A drizzle
snapshot is cumulative: yours was taken against a schema that does not contain
the other lane's columns, so a rename leaves `meta/NNNN_snapshot.json` silently
disagreeing with the schema, and the next `db:generate` after that emits a wrong
diff.

The resolution, done on 2026-09-05 when #408 and #415 both claimed 0025:

1. Take the landed lane's `.sql`, snapshot and journal entry wholesale.
2. Delete your own `.sql` and snapshot — but keep the body aside first. Prose
   and any hand-written data backfill in it are not regenerable.
3. Re-run `pnpm db:generate` on the merged tree. It diffs *their* snapshot
   against the merged schema and emits a correct next-numbered migration holding
   only your changes.
4. Rename it, fix its `tag` in `_journal.json`, paste your prose and backfill in.
5. Verify by **applying**: `pnpm db:migrate`, plus the `packages/db` suites,
   which replay the whole migration set against a fresh PGlite. Compiling proves
   nothing here.

**The number belongs to landing order, not to reservation (#434, 2026-09-07).**
An orchestrating session told me to take 0031 and leave 0030 for a lane that had
generated it but had not landed. That inverts the rule. Landed `main` was still
at `0029`, so `db:generate` against the landed snapshot emitted `0030` — and
taking anything else would have meant hand-authoring the number, which is the
one move this memory forbids. Drizzle numbers sequentially from the journal, so
there is no clean way to emit `0031` with `0030` absent anyway.

**Whoever lands first takes the next number; everyone behind them regenerates.**
A reserved-but-unlanded number is not taken. Say so rather than complying — the
instruction was a slip, and it was withdrawn once the arithmetic was laid out.

Related: [[ticket-worktree-merge-immediately]], [[main-pushes-dequeue-parallel-lane-prs]].
