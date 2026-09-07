---
name: one-writer-per-worktree
description: "Only one agent may WRITE to a worktree at a time — a reviewer with Edit tools is a writer, and mutation testing under a running browser pass invalidates it silently"
metadata:
  type: feedback
---

The orchestration policy says **browser** agents run strictly serially. The real
constraint is broader: **only one agent may write to a worktree at a time.**

`diff-reviewer` carries `Write` and `Edit` and uses them for mutation testing —
deleting a guard to prove a test fails. That is correct practice, and it is how
it proved #435's rewritten vendor row control had no coverage at all. But run it
while a `browser-verifier` is driving the app and the dev server hot-reloads the
mutation: the browser agent is then measuring a deliberately broken build and
reporting the results as findings.

**Why:** it costs a whole browser pass, and the loss is silent. The pass does not
error — it produces plausible FAILED results for code that is fine, and there is
no way afterwards to tell which phases fell inside a mutation window. On
2026-09-07 phases A–C of a #435 pass had already completed before the collision
was noticed, and the only safe move was to discard the entire run.

The tell is in the dev server log, not the agent's output:

    [tsx] change in ./src/modules/reviews/reviews.dao.ts  Restarting...

A restart naming a file **you are not editing** means something else is writing.
Fifteen API restarts in a run that should have had none.

**How to apply:** never launch a tool-writing reviewer and a browser agent over
the same worktree at once. Sequence them, and before starting a browser pass
confirm the tree is clean *and* has been clean for a moment — a reviewer between
mutations looks exactly like one that has finished. Waiting for its completion
notification is the reliable signal; `git status` alone is not.

Related: [[guard-a-delegated-browser-pass-with-a-liveness-watch]] and
[[verify-with-a-differently-shaped-check]] — the same family, where a check
completes and reports having established nothing.
