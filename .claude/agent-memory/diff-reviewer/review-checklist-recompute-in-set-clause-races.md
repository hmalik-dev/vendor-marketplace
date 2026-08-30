---
name: review-checklist-recompute-in-set-clause-races
description: A derived column recomputed by an aggregate sub-SELECT inside an UPDATE's SET clause still loses rows under concurrency — READ COMMITTED re-evaluates the qual on the new tuple but keeps the statement's original snapshot for the subquery
metadata:
  type: feedback
---

`.claude/rules/api-layering.md` says derived columns are "recomputed from source
rows, never incremented". A diff that satisfies the letter of that rule can
still be wrong: **recompute-instead-of-increment is necessary, not sufficient.**

The shape to look for:

```ts
await tx
  .update(vendorProfiles)
  .set({
    reviewCount: sql`(select count(*) from ${reviews} where ${reviews.vendorId} = ${vendorId})`,
  })
  .where(eq(vendorProfiles.id, vendorId));
```

**Why it fails:** under READ COMMITTED, when transaction B's `UPDATE` blocks on
the row lock A holds and then unblocks, Postgres re-checks the qual against the
_new_ tuple version but evaluates the `SET` expressions' subplans against **B's
own statement snapshot**, taken before A committed. B therefore writes a count
that omits A's row, and nothing ever corrects it. Postgres documents this as
"an updating command can see the effects of concurrent updates on the rows it is
updating, but not on other rows".

**How to apply:** whenever a diff recomputes a denormalised column, ask _what
serialises the read against the write_. A `SELECT … FOR UPDATE` on the target
row first, computing the aggregate as a separate statement after the lock, or a
`REPEATABLE READ`/retry loop all work; a bare sub-SELECT in `SET` does not.

**How to prove it, in this repo, in about three minutes:**

- The API suites run on **PGlite, one connection** — they _cannot_ express this,
  so a green suite says nothing. Do not accept "the tests pass".
- `docker compose up -d` is already running `postgres:18-alpine`, and
  `node_modules/.pnpm/postgres@3.4.9/…/src/index.js` can be imported by absolute
  path from a scratchpad script. Build the URL from `DATABASE_URL` in `./.env`
  and swap the database name — never inline a connection string, the PreToolUse
  hook blocks it (see [[credentials-env-files-only]] in the project memory).
- Two connections, `max: 1` each: A inserts + updates and holds ~5 ms, B inserts
  and starts its update ~2 ms in. Reproduced 5/5 at that window on 2026-08-30
  reviewing #12 — the window is only "the statements between the UPDATE and the
  COMMIT", which here was a single notification insert.

Related: [[review-checklist-onconflict-target-vs-other-unique-indexes]] — same
lesson, that a claim about concurrency needs a real second connection behind it.
