# Autonomous QA run — 2026-09-03

Log of the unattended run. Appended after every landing, deferral and phase
boundary so a resumed session continues from this file, the board and the lane
manifests alone. The board (`vendor-marketplace-tickets.md`) is the master list
of work; this file is the narrative and the counts.

**Operator override, received mid-run:** "work directly in main for this session
and directly push all the changes to main." Every change from that point commits
on `main` and pushes at once; no lanes, no PRs, no worktrees. Quality gates are
unchanged: failing test first, build/typecheck/lint/test, `diff-reviewer` on
every diff, `security-auditor` on every trust-boundary diff, browser
verification for anything user-reachable.

## Phase 0 — reconcile (done 2026-09-03 22:05 local)

Started from `c0be5ae`; `git pull --ff-only` brought `6f1f8b5` (PR #92, the
#387 review fix). Tree clean. No live peer sessions held work (`ListAgents`:
two idle cloud sessions, two offline Remote Control sessions).

Lane and worktree actions:

| Lane / worktree | Branch | Finding | Action |
| --- | --- | --- | --- |
| 387 (manifest `pending-merge`, PR #92) | `worktree-387` | PR #92 merged as `6f1f8b5` | `lane:down`, worktree removed, local and remote branch deleted |
| 383 (manifest `active`) | `worktree-383` | 0 commits ahead of main, clean | `lane:down`, worktree and branch removed |
| 310 | `verify-main` | 0 commits ahead, clean | worktree and branch removed |
| 322 | `land-322` | one docs commit correcting #322's SHA; the archive on main already carries `3478925` | worktree and branch removed as superseded |
| demo-url | `demo-url` | `render.yaml`, `docs/demo.md` and the pre-launch lines are all on main, in newer form | worktree and branch removed as superseded |
| 371 worktree (manifest `active`) | was checked out on `demo-deferred` | that branch's memory file and `docs/demo.md` are byte-identical on main; the real `worktree-371` branch holds 10 unpushed commits (`e908d1a`) | worktree re-pointed at `worktree-371`, `demo-deferred` deleted; lane kept |
| 386 (manifest `active`) | `worktree-386` | one commit plus 11 dirty files, no session | WIP committed as `4877d7a`; lane kept |
| 388 (manifest `active`) | `worktree-388` | 13 dirty files and 2 new, no session | WIP committed as `32b00b3`; lane kept |

Board: six `Done` rows (#363, #381, #387, #389, #390, #391) and their detail
sections moved to the archive; #371, #386, #388 returned to Backlog with the
branch named in the row. Committed `5e515f8` and pushed. Queue depth after
reconcile: **16 open — 14 Backlog, 2 Deferred — needs a human (#362, #374)**.
Of the 14: #313, #371 blocked on #385 (design ruling); #370 blocked on #362;
#372 blocked on #374; #385 is itself a design pass needing a human ruling.

Stack: Docker Postgres and MinIO up; API on 4000 (`RATE_LIMIT_MAX=100000`),
web on 3000, started separately. Stripe forwarder running in a restart loop
(`--forward-to`, `--forward-connect-to`, `--forward-thin-to`,
`--forward-thin-connect-to`, all at `localhost:4000/webhooks/stripe`). The
printed `whsec_` did **not** match `.env`; `.env` was updated and the API
restarted (the first restart left the old child holding 4000 — killed by pid).
`stripe trigger payment_intent.succeeded` produced `Applied a Stripe webhook`
for `payment_intent.created`, `charge.succeeded` and `charge.updated`.

`pnpm db:seed` (11 categories, 43 tags), `pnpm db:seed:e2e` reused
`acct_1UAigpFAZlq29PJi` (no "provisioned" line). `pnpm preflight` 24/24;
`pnpm preflight --ticket 395` (stripe capability) 30/30, Stripe confirms the
account is payment-capable. `stripe get /v1/accounts/<id>`: `charges_enabled`
true, `payouts_enabled` true, `details_submitted` true. `pnpm e2e:auth`
regenerated `.auth/customer.json` and `.auth/vendor.json`.

### Findings noted during Phase 0 (to be filed in Phase 1)

- The synthetic `payment_intent.succeeded` from `stripe trigger` answered
  **422** because the intent carries no `metadata.requestId`
  (`payments.service.ts` `recordSuccessfulPayment`). A non-2xx makes Stripe
  retry for three days and counts toward endpoint disablement; an intent the
  platform did not create should be acknowledged as `ignored`.

## Stripe test objects

| When | Object | Why | Outcome |
| --- | --- | --- | --- |
| 22:03, 22:04 | two PaymentIntents + charges from `stripe trigger payment_intent.succeeded` | prove webhook delivery | left in the sandbox (test data, not deletable objects) |

## Judgment calls

- Worked on `main` directly per the operator's mid-run instruction; the
  prompt's lane/PR flow is superseded for this session.
- Unlanded branches whose content was already on main in a newer form were
  deleted rather than PR'd; the diff against `origin/main` was read first in
  each case.
- The 10 commits on `worktree-371` were not blindly landed: they are partial
  work on a ticket blocked by a design ruling, and land only after the gate
  and a review, as part of the drain.
