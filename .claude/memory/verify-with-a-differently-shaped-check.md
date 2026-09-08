---
name: verify-with-a-differently-shaped-check
description: A grep that silently over- or under-matches returns a confident wrong answer; re-run differently rather than re-reading the pattern
metadata:
  type: feedback
---

A verification pattern that matches more or fewer lines than intended looks identical to
one that worked — it returns a clean, confident, wrong answer. Re-reading the pattern does
not catch it. Only re-running the check in a differently shaped way does.

Two real cases, same night, opposite directions:

- `grep -E '^| 12 |'` — unescaped `|` is ERE alternation, so it matched all 3301 lines of
  the file and reported a confident `DIFFERS`. Escaped to `^\| 12 \|` the answer flipped to
  `IDENTICAL`.
- `grep -noE '.{24}\b(35[4-9])\b.{14}'` — fixed context padding silently required 24 chars
  before and 14 after the match, so hits near a line boundary never matched. Reported a
  confident three; the real count was six.

**Why:** neither was found by inspection. Each was found by another session running the
same question with a different command.

**How to apply:** when a grep result is load-bearing, confirm it with a check that does not
share the first one's failure mode — count with a second pattern, diff whole files instead
of matching lines, or assert a post-condition on the result. Prefer guards that do not
depend on any pattern being right: for a find-and-replace sweep, diff the file before and
after and confirm only the intended lines changed.
**Corroboration requires independent preconditions, not just different commands.**
2026-08-30, four sessions on one board produced four confidently-wrong greps in a night.
The worst one: a peer reported `scripts/` and `pnpm e2e:auth` absent from `origin/main`,
confirmed by `git ls-tree`, `find` and `ls` all agreeing, and was about to file a ticket
telling the next lane to rebuild files that already existed.

The cause was not any pattern. **`git ls-tree -r <ref>` is scoped to the current working
directory unless you pass `--full-tree`** — and the Bash cwd had persisted from an earlier
`cd apps/web`, where `scripts/` genuinely does not exist. All three checks shared that one
hidden precondition, so their agreement carried no information.

**How to apply:** three checks agreeing is not evidence when they share a precondition
(cwd, ref, env, a stale build). Prefer *behavioural* evidence over listings — running the
thing beats looking for the thing. What settled this was a session that had actually
executed `pnpm e2e:auth` successfully, plus a preflight check asserting reachability, both
of which were impossible if the file were missing. When a listing surprises you, re-run it
from a known-absolute position (`--full-tree`, an absolute path, a fresh shell).

Related: [[never-abort-a-rebase-you-did-not-start]], [[lead-dont-narrate]].

## The environment variant: assert something only true when the environment is right

Generalised by lane 441 on 2026-09-07 after three near-misses in one lane, all
the same shape — **a check that could not fail**, where the pass completes, the
silence is the environment rather than the app, and nothing says so.

- **Expired `.auth/`.** A customer navigation landed on `/sign-in` and the
  signed-in footer rendered its signed-out variant. Nothing errored. Caught only
  by asserting the Account column's **contents**, not that the page loaded.
- **A watcher matching any failing check.** It abandoned a live merge because a
  rate-limited Vercel had gone red. The fix is to watch the required check **by
  name** (`Typecheck, lint, build, test`), never "any red".
- **A web server on the wrong port.** `lane:exec` exports the API's `PORT` to
  every child, so `next start` binds the API port and serves the app there. A
  pass pointed at the lane's *web* port gets connection-refused and reads as
  "the app is broken"; one pointed at the *API* port renders the app and looks
  correct. Both wrong, neither says so. (`next dev` escapes only because
  Turborepo's dev task passes `--port` explicitly — an accident of one task
  definition, not a property of the lane.)

**The rule:** a browser or parity pass must assert something that is **only true
when the environment is right** — the rendered contents of a signed-in-only
element, the named check, a port that answers with the app you meant. Liveness,
a 200, or "the page loaded" are all satisfied by the broken case.

Same principle `web-design-parity.md` states as: *before trusting a check, ask
what state would make it fail. If nothing would, it is not a check.* This is that
principle applied to the lane's environment rather than to the assertion.

Related: [[lane-auth-state-arrives-expired]],
[[guard-a-delegated-browser-pass-with-a-liveness-watch]],
[[vercel-deploy-check-always-fails]].

## The data variant: an empty state compares nothing

Lane 435, 2026-09-07. Frame `13` is drawn with the **saved filter on**, so
`00-README.md` records `/admin/vendors?status=review` as the comparable route.
That lane's database had **zero vendors in `review`**, so the route rendered the
filtered empty state — and a parity pass against it *would have completed and
reported*, having compared nothing at all.

It seeded six vendors into `review` first, and reverted the fixture with a reseed
before committing.

**So a parity or browser pass needs its data precondition checked as
deliberately as its environment.** "The page rendered" and "the page rendered the
state the frame draws" are different claims, and only the second is a
measurement. Before comparing, confirm the surface is showing rows rather than an
empty state — an empty table matches an empty table on all six axes.

## Block on the condition, never on arithmetic about time

A lane reported CI elapsed times that were wrong **in both directions** — once
polling flat out while believing it was sleeping, once reading a job as 45
minutes old when it had restarted and was 4 minutes in.

The mechanism: **`wait` in a shell that never started the job has no child to
wait for, so it returns immediately.** In this harness shell state does not
persist between Bash calls, so a job started in one call is unreachable by `wait`
in the next **by construction**. Every "elapsed" figure derived from that loop is
arithmetic on an assumption, and the tell is that the call never blocks.

Neither error reached a diff. Both reached the supervisor, who was ordering lanes
partly on how long work appeared to be taking — a healthy lane reading as
45-minutes-stalled is how a good session gets replaced.

**How to apply:** wait on the **real condition**, not on a timer or a timestamp
difference — an `until` loop testing the thing itself (`until gh pr checks … |
grep -q …; do sleep 30; done`), or a Monitor whose script exits when the state
flips. And treat any duration you did not observe a process block for as a guess.

## A severity is only as good as the trace behind it

A `security-auditor` graded a finding **LOW**: an unhandled 23505 on
`updateUserByClerkId` leaves `users.email` stale. The lane relayed the rating and
so did its report.

The rating was for the **failed request**. What made it P1 lives one hop
downstream: `notification-email.dao.ts` reads the recipient from that column, so
a permanently stale value means every later notification — counterparty names,
event dates, booking details — goes to an address the person no longer controls,
indefinitely, with nothing retrying. **A failed request is an incident; mail to a
relinquished address is a continuing disclosure.**

**Why:** an agent scoped to a diff cannot grade a consequence that lives outside
it, and it was never asked to. The severity looks like the agent's judgement and
is actually the judgement of whoever chose the scope.

**How to apply:** before accepting a severity on a data-integrity finding, ask
**what reads this value afterwards** and follow it one hop. Where the answer is
"something that sends, publishes or bills", the rating from a diff-scoped pass is
a floor, not the number.

## Wait on the thing itself, never on a promise to signal

Eighteen `until [ -f <sentinel> ]; do sleep N; done` loops from one job were
found still running **two days** after its session ended — each waiting on a file
that session was going to write by hand and never did. The shells outlived the
promise.

**Why it is not just untidiness:** they consume memory, and the OS kills
background work **by pressure, not relevance**. It had already reaped two live
tasks on the night they were found, and a browser pass or a `test:contention` run
killed partway **reports nothing and looks like a clean run**.

**How to apply:** a `run_in_background` wait must end on something a **real
process produces** — a file a build writes, a PR state, a log line, an exit code.
A loop waiting on a flag *you* intend to set later is a leak by construction,
because your session can end first. And when clearing someone else's: confirm the
owning job is absent from the live-session list, **list the PIDs and read them**,
then kill scoped to that job's own path — never an unscoped `pkill`.

## A review agent can confirm coverage that does not exist

Lane #444 threaded a list of cancelled booking ids into a predicate so it could
decline a request only when *this* unwind had ended the booking behind it. The
quality agent read the diff and reported a test shape as **covering** that arm.

**The arm was dead.** `cancelBookingAndFreeDate` already moves the request
`accepted -> cancelled` in the same transaction as the cancellation — and has
since #400, deliberately, so `syncHeldDate` cannot read an accepted request off a
date whose booking is gone and mark the day permanently unsellable. The unwind
runs that cancellation **before** `declineOpenRequests`, so the ids could never
match anything.

**The agent read the intent; only driving the row read the data.** It was found
by adding the third fixture shape to close an untested branch, not by review.

**How to apply:** a reviewer's "this test covers that branch" is a claim about
what the code *means*. Ask instead what state reaches the branch, and build a
fixture that arrives there through the product's own path — here, an accepted,
paid, **future** booking that the ban actually cancels. If nothing can reach it,
the branch is dead and the coverage was imaginary.

**And the product may already have decided.** #444 was about to write *"declined
is the least wrong word we have"*; the answer was `cancelled`, chosen by #400 for
a different reason. Look for the existing decision before inventing one.
