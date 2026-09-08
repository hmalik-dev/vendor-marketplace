---
name: a-failed-command-reads-as-a-passing-check
description: "A check that counts matches reports success when the command itself failed — make it print what it found, not just how many matched"
metadata:
  type: feedback
---

A teardown confirmed a lane database was gone with

    psql -U postgres … | grep -c lane_452   # → 0

That zero established nothing. The role `postgres` does not exist on this
project's Postgres container, so `psql` errored, produced no rows, and `grep -c`
counted nothing. Re-run as `-U vendor_marketplace` it lists ten databases and the
conclusion happened to hold — but the first form would have printed `0` whatever
the truth was.

**Why:** this is the cheapest variant of the recurring failure in this repo — a
check whose failure mode is indistinguishable from its success. `grep -c`, `wc
-l`, `[ -z "$out" ]` and `|| true` all convert a broken command into a confident
negative answer. It is worse than no check, because the zero gets quoted.

**How to apply:** **make the check print what it found, not just what matched.**
List the databases and read them; show the file and its line; echo the value
before comparing it. Where a count is genuinely what you want, assert the
command succeeded separately — `set -o pipefail`, or check the exit status of
the producing command rather than the filter's. And ask the standing question
before trusting any check: *what state would make this fail?* If the answer is
"nothing, including the command not running", it is not a check.

Related: [[verify-with-a-differently-shaped-check]],
[[source-grep-guards-match-their-own-comment]] and
[[turbo-serves-a-green-you-did-not-earn]].

## The inverse: a check too loud to mean anything

Same night, opposite direction. A lane armed a PR watch that grepped for **any**
`FAILURE` and fired on Vercel's standing rate-limit red within thirty seconds —
then would have fired again every thirty seconds for the whole run.

**That is worse than not watching.** A real gate failure arriving later would
have been indistinguishable from the standing one, and the reader learns to
ignore the channel that was supposed to carry it.

Both failures end in the same place — **a human trusting a signal that carries no
information** — and the fix is the same in both directions: make the watch say
**what** it found, and report **only when the answer changes**.

**How to apply:** name the gate explicitly rather than matching a class
(`Typecheck, lint, build, test`, not "any red"), exclude known-standing failures
with the reason written in the script, and emit once per state change rather than
once per poll.
