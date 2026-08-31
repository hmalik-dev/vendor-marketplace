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

**How to apply:**

- Land work on the strength of the **local** gate, which is the real evidence
  here: `pnpm test --force` (`--force` because tracker markdown is not in the
  turbo hash and a cached green is not a green), `pnpm typecheck`, `pnpm lint`,
  `pnpm format`, plus the browser pass.
- Do not hold a merge, a report, or a session waiting for a remote check.
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
