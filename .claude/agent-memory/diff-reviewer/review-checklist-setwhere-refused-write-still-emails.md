---
name: review-checklist-setwhere-refused-write-still-emails
description: A new "first time?" email gate that falls back to the pre-read row id fires for an upsert whose setWhere refused the write, and the fake gateway's idempotency dedupe makes the "sends once" test unable to fail
metadata:
  type: feedback
---

When a diff adds a one-shot side effect (an email, a webhook) beside an
`onConflictDoUpdate` that carries a `setWhere`, ask two questions.

**Why:** VEN-516 gated a waitlist confirmation on
`(await upsertApplication(...)) ?? existing?.id` plus
`existing.confirmationEmailAttempts === 0`. The `?? existing?.id` fallback
makes the send fire on exactly the rows where `setWhere: status = 'new'`
_refused_ the write — a declined applicant resubmitting gets "We've saved your
details" for facts that were discarded. The fallback does not mask a missing
id; it manufactures a send for a write that did not happen.

**How to apply:**

1. Enumerate the statuses `setWhere` excludes and find the one with the
   side-effect counter still at 0. Decline/invite paths that skip the
   completeness check are where that row comes from.
2. A row lock taken in the gating transaction proves nothing when the column
   the gate reads is written _after_ commit (background send). Two serialised
   submits both read 0. Only a claim inside the transaction makes it once.
3. The "a resubmit sends nothing" test: `createFakeEmail` in
   `apps/api/src/testing/test-server.ts` pushes to `sent` **only for an unseen
   `idempotencyKey`**. A fixed key (`<kind>-<rowId>`) means deleting the gate
   entirely keeps `expect(sent).toHaveLength(1)` green. The tell is the DB
   counter after the second call, not `sent.length`.
4. Any DB read moved _inside_ the `try` that records `emailFailureReason`
   stores a database message in an operator-visible field, and on a `tx`
   handle aborts the transaction so the record write throws too.

See [[review-checklist-onconflict-target-vs-other-unique-indexes]] and
[[review-checklist-source-grep-substring-collisions]].
