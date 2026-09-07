---
name: an-idempotence-check-must-compare-everything-it-writes
description: A "does it already agree?" guard that compares fewer fields than the writer writes silently stops repairing the omitted ones, and reports success over the damage
metadata:
  type: feedback
---

When a function writes a file (or a row, or a config) and a companion predicate
decides whether it *already agrees* and can be skipped, **the predicate must
compare every field the writer writes.** Comparing a subset is not a cheaper
version of the same check — it is a check that cannot fail for the state it
exists to detect.

Found 2026-09-07 in #448. `renderLaneEnv` writes six values into `.env.lane`;
`laneEnvAgreesWith` compared three. When `API_URL` was added to the writer
(`1e899ae1`), every lane whose file predated it still *agreed* with its manifest,
so `ensureLaneEnv` never rewrote it. Long-running lanes resumed onto the stale
file for ever, kept rendering server-side against whatever answered `:4000` —
and `lane:up` printed `✓ Lane <n> up` over it every time.

**Why:** the failure is invisible in both directions. Nothing errors, because
the omitted field falls back to an inherited value that is present and wrong.
And the guard's own success message is what stops anyone looking — the fix
"landed" weeks before it reached a single running lane, and two sessions
independently re-diagnosed the original symptom in the meantime.

**How to apply:** when you add a field to a writer, grep for the predicate that
guards it and add the field there in the same commit. When you *find* such a
pair, the test to write is the stale-file one: write the file as the previous
version would have, run the resume, and assert the new field appears. That test
goes red on exactly the state the guard was blind to and on nothing else.

The same shape as [[verify-with-a-differently-shaped-check]] and
[[source-grep-guards-match-their-own-comment]]: a guard whose passing condition
is entailed by its own inputs. See
[[a-lane-web-build-must-be-made-under-the-lane-env]] for the instance.
