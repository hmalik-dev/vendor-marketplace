---
name: vercel-deploy-check-always-fails
description: CI and the Vercel deploy check are pre-launch work — never wait on them or read their red as a finding
metadata:
  type: project
---

**Do not wait on CI or the Vercel deploy check, and do not treat their red as a
finding.** Confirmed by the user 2026-08-31: **CI is part of pre-launch**, and
the deploy check will keep failing until the project is actually on production.

Observed on 2026-08-30/31: `Deployment rate limited — retry in 24 hours`,
account-wide. It hit PRs #72, #73 and #74 identically, across three different
lanes' diffs — which is the tell that it is environmental rather than anyone's
change.

**Why this matters:** waiting burns a whole session for no signal, and reporting
it as a failed check sends the next reader hunting a defect in a diff that does
not have one. Three sessions independently flagged it as a possible regression
on one night.

**The two checks are not interchangeable, corrected 2026-09-07 (#434).** This
memory said "CI and the deploy check" in one breath, and acting on that costs a
round trip: **branch protection gates the merge on the `Typecheck, lint, build,
test` check, so that one has to be waited on.** `gh pr merge --squash` is
refused outright while it is pending — "the base branch policy prohibits the
merge" — and goes through on its own the moment it reports SUCCESS, **with the
Vercel check still red**. So Vercel is ignorable exactly as described below;
the CI job is not, because it is the thing standing between a green branch and
a merged one.

**`--admin` is not the way round it.** It is what `gh` suggests and it is
blocked by the permission classifier, correctly — it bypasses branch protection
rather than satisfying it. Wait for the one check, then merge plainly.

**How to apply:**

- Land work on the strength of the **local** gate, which is the real evidence
  here: `pnpm test --force` (`--force` because tracker markdown is not in the
  turbo hash and a cached green is not a green), `pnpm typecheck`, `pnpm lint`,
  `pnpm format`, plus the browser pass.
- Then wait for `Typecheck, lint, build, test` **by name** and merge when it is
  SUCCESS. Never wait on Vercel, and never read its red as a finding.
- Do not hold a report or a session waiting for the deploy check.
- If a watcher is armed at all, match the **specific** required check by name
  rather than "any failing check" — a watcher matching any red abandons a
  healthy merge the moment the deploy check goes down. That exact mistake is
  already recorded in `web-design-parity.md`'s list of checks that confidently
  report what they never established.

Revisit when the project is genuinely deployed and CI is stood up as part of
pre-launch; at that point these become real signal and this memory should be
deleted.

Related: [[main-pushes-dequeue-parallel-lane-prs]],
[[ticket-worktree-merge-immediately]].

## A squash commit on `main` often has no green run of its own — and that is fine

Three lanes hit this on 2026-09-08. The CI run for a squash SHA reads
**`cancelled`**, because the lane's close-out push lands seconds later and
`cancel-in-progress` kills the run for the commit underneath it.

**Nothing is red.** What actually gated the merge is the **PR's** required
`Typecheck, lint, build, test`, which passed on exactly the tree that was
squashed — auto-merge could not have fired otherwise.

**Why it matters:** somebody auditing `main` by commit will find several
`cancelled` runs against real landings and can reasonably read that as a history
of broken merges. It is the opposite: it means the close-out followed the merge
promptly.

**How to apply:** when reporting a landing, cite **the PR's check on the merge
candidate**, not the run on the squash commit. And when reading history, treat
`cancelled` on a squash as "superseded", never as a failure — check the PR.
