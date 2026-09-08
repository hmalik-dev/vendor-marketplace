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

**The lane database has to be recreated, not re-migrated.** `__drizzle_migrations`
records the tag you originally applied, and after regenerating, that tag no longer
exists in the journal — so `pnpm db:migrate` tries to apply the landed lane's
migration _and_ yours on a database that already has yours under a dead name.
Drop and recreate the lane database, then `db:migrate`, `db:seed`, `db:seed:e2e`.
Confirmed 2026-09-07 on #429 after #434 took `0030`; regenerated as `0031`.

Related: [[ticket-worktree-merge-immediately]], [[main-pushes-dequeue-parallel-lane-prs]].

## The collision does not present in the `.sql` file — it presents in the snapshot

Two lanes both numbered a migration `0040`. The `.sql` files collided add/add,
which is loud and obvious. **The dangerous conflict was in
`0040_snapshot.json` and `_journal.json`**, and it was silent:

- The `users.ts` conflict fell on the very line #451 had rewritten. Taking
  "ours" would have **dropped `.where(deleted_at is null)`** and silently
  re-locked a closed account's address.
- **No test would have failed** — the DAO tests only need an index to exist
  under that name, not to be partial.
- The damage stays invisible **until somebody's next `db:generate` re-emits the
  reverted index** from the bad snapshot.

**How to apply.** When a migration number collides: keep the landed migration's
`.sql`, restore **main's snapshot and `_journal.json` byte-for-byte** rather than
merging them, and regenerate your own against that landed snapshot to take the
next number. Then read the schema source conflict on its own terms — a snapshot
merge that looks clean can still carry a reverted predicate.

Recorded 2026-09-08, lane #462.

## Regenerating is not enough — undo the old one in the lane database first

If you generated a migration **before** rebasing, your lane database already
holds a `__drizzle_migrations` row for a file that no longer exists. Deleting the
file and regenerating leaves that row behind, and **the real landed migrations
then silently never apply** — `db:migrate` believes it is already past them.

**Drop the columns your migration added, delete that one row, then migrate.** It
is a five-line script and far cheaper than `lane:down`, which drops the whole
lane database.

The tell is a `db:migrate` that reports nothing to do on a tree that visibly has
new migrations in it. Recorded 2026-09-08, lane #457.

## Renumber immediately before pushing, not before the gate

Lane #457 renumbered **three times in one session**: generated `0039`, rebased to
`0041`, and by the time the gate finished `main` had landed its own `0041`, so it
became `0042`. **Each renumber before a gate costs the whole gate again.**

**Do the renumber as the last step before pushing.** The number is only a fact
about the moment it lands.

**And make the undo script idempotent.** The lane re-ran its own undo to check its
work and it cheerfully undid the migration a second time — dropping columns that
were no longer there to drop, or deleting a `__drizzle_migrations` row that
belonged to something else.
