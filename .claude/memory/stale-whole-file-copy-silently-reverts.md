---
name: stale-whole-file-copy-silently-reverts
description: "A code PR carrying a stale copy of the tracker or ticket registry silently reverts other lanes' filings — git sees no overlap, and the reverted state passes the contiguity guard"
metadata:
  type: project
---

A lane branched before a tracker commit carries a **stale whole-file copy** of
`.claude/plans/vendor-marketplace-tickets.md` and
`packages/shared/src/env/tickets.ts`. Merging that PR **reverts** whatever landed
in between.

On 2026-09-07, PR #135 (lane 434) did exactly this: it resurrected #430's closed
board row and its entire detail section, and **erased #441 completely** — board
row, detail section, its `441:` entry in `tickets.ts`, and the
`HIGHEST_REGISTERED_TICKET` assertion in `registry.test.ts`.

**Why nothing caught it, which is the whole lesson:**

1. **A stale whole-file copy is not an overlap.** There was no conflict, because
   git had no two-sided edit to reconcile — one side simply carried older
   content, and it took it as an ordinary change.
2. **The reverted state was internally consistent.** `HIGHEST_REGISTERED_TICKET`
   went back to 440 with the registry still contiguous from 0, so
   `registers a contiguous ticket range with no gaps` — the guard that exists to
   catch exactly this — was *satisfied* by the damage. A green from it meant
   nothing.

It was found by accident: a session went to delete #429's row and saw #430 back
on the board. Nothing would have reported it.

**Why:** this is the same hazard as
[[the-done-row-cannot-ride-in-the-code-pr]] from the other direction. That one is
about a row that cannot exist yet (the squash SHA); this one is about rows that
**already** exist and get overwritten. Both resolve to the same rule.

**How to apply:**

- **The tracker and `tickets.ts` must not ride in a code PR.** Board transitions
  and filings go in their own commit, made after the merge, from a checkout that
  is current.
- Before any lane merges, check whether its branch carries a tracker or registry
  diff: `git -C <worktree> diff --name-only origin/main...HEAD | grep -E
  'plans/|env/tickets.ts|registry.test.ts'`. If it does, rebase onto current
  `origin/main` and **re-read that file's diff** — confirm it contains only the
  lane's own additions and no copy of anything else.
- **Additive-only is the safe shape and it is checkable**: `git diff --stat HEAD
  -- .claude/plans/` reading *N insertions, 0 deletions* proves the diff replays
  onto whatever the file has become. A deletion count above zero on a file
  another lane owns is the tell.
- Do not trust the contiguity guard to protect this. Ask instead what state would
  make it fail — see [[verify-with-a-differently-shaped-check]].

Related: [[filing-a-ticket-is-a-three-file-change]],
[[shared-checkout-working-tree-is-a-tripwire]].

## The check must run against the MERGE BASE, not `origin/main` — 2026-09-07

The obvious form of this check is wrong, and I gave it to several lanes before
436 caught it:

    git diff origin/main --stat -- .claude/plans/ packages/shared/src/env/   # WRONG

Against `origin/main` that is non-empty for an **innocent** reason — it shows
every tracker commit that landed *after* the branch was cut, which is somebody
else's work, not the lane's. A reader who takes non-empty as "my branch carries
a tracker diff" then goes hunting for something that is not there; worse, a
reader who learns to expect noise stops reading it at all.

**Run it against the merge base:**

    git diff $(git merge-base origin/main HEAD) --stat -- .claude/plans/ packages/shared/src/env/

Empty there means *this branch* introduced no tracker or registry change, which
is the actual question.

**This is the same trap as the scoped teardown diff** in
[[diverged-lane-branch-needs-a-new-name]] — an unscoped or wrongly-based diff
against `origin/main` answers a different question than the one being asked, and
answers it confidently. Two different commands, one mistake.

## The Status Board conflict: resolve by id, not by side

Recorded 2026-09-07, when a lane rebased and found a peer's freshly filed row on
the line directly after its own. **Naive resolution in either direction loses a
row** — take yours and the peer's filing vanishes; take theirs and your own
transition does.

It arrives disguised as an ordinary two-line conflict, with nothing to say that
one side is a **filing nobody else has a copy of**. No test catches the loss: the
contiguity guard passes because ids stay contiguous either way.

**How to apply:** resolve the Status Board **by id**. Take main's rows in main's
order, let only your own row win, and **assert every id present on either side
survives** before writing the file.
