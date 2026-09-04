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

## Phase 1 — sweep (in progress)

`/hunt-bugs` failed twice before it ran: the Workflow sandbox has no
`process`, and the script read `process.env` at load. Fixed in `f49a36c`
(origins from args first; the lane-ports test still passes; a new case covers
the args channel). The named workflow is served from a cache, so it was
relaunched by `scriptPath` against the repo file. Running as `wf_fe833cfc-171`.

Ran in parallel with it (read-only): an accessibility `bug-hunter` (report
saved in the run scratchpad and summarised under Findings below), an `Explore`
audit of `docs/pre-launch.md` against the tree, and an `Explore` brief of every
open ticket with its real file set.

### Landed during the sweep (code the browser drive then exercises)

| Commit | What | Tickets | Reviews |
| --- | --- | --- | --- |
| `1908064` | Stripe hosts on the CSP and Permissions-Policy; `CSP_ENFORCE` registered and hashed; `shouldEnforceCsp` pinned; occasion label on the confirmation screen; webhook acknowledges foreign succeeded intents | #396, #394 (In Progress — browser pass pending), #397 (filed and closed) | diff-reviewer REQUEST-CHANGES → 4 items applied; security-auditor PASS-WITH-NOTES → 3 notes applied |

### Pre-launch checklist audit — what the tree says

Machine-doable and open: #396 (done above). Everything else the checklist
lists as a code item is already landed (security headers, robots/sitemap/
manifest/opengraph-image, soft 404, upload limits 12 MB / 1200px / 20 files,
seed guard on production, #47 key-based image URLs) or is a human action
already consolidated into #362 / #374 / #370. Two small guards remain
unowned and are candidates for filing after the sweep: a check that a
configured webhook target is a real API origin (§2.3), and preflight refusing
a non-production Neon branch when `NODE_ENV=production` (§3.2 — today only the
opposite direction is enforced).

### Lane 371 closed out

An `Explore` triage of `worktree-371` against main, confirmed with a per-file
`git diff origin/main worktree-371`, found every app change on the branch
already on `main` byte-identical and its seed changes superseded by #387. The
lane database, worktree and branch were removed. #371 stays in Backlog with
only its #385-blocked remainder.

### #394 and #396 verified and closed (2026-09-04)

`browser-verifier` drove checkout with `CSP_ENFORCE=1`: enforced header
confirmed, eight `js.stripe.com` frames, every Stripe host 200, Payment
Request allowed for Stripe's origin, card 4242 paid $1,450 and landed on
`/confirmed` with zero CSP violations. The one violation it found elsewhere —
Clerk's telemetry POST to `clerk-telemetry.com` on every signed-in page — is
fixed in `58722a2` by switching the SDK's telemetry off (a source guard pins
it). The confirmation screen reads `Wedding · Barr Mansion, Austin TX`, no
console errors, signed-out redirect carries `returnTo`. Both rows moved to the
archive. Out-of-scope observations from that pass are held for filing:
checkout renders two headers (#395 owns it), frame `06` does not fill the
viewport because `BookingConfirmed` nests a second `<main>` (goes with the
accessibility nested-landmark finding), and the pass consumed the E2E
vendor's only pending request (re-seed before the next money-path pass).

### Sweep status

The first `/hunt-bugs` pass (`wf_fe833cfc-171`) ran 417 agents and produced
131 candidate findings with 219 skeptic verdicts before the account's session
limit stopped it at 07:10 local; the report stage never ran. It was resumed at
10:29 with the cache warm so only the missing verdicts and the report re-run.
The journal summary is in the run scratchpad (`hunt-summary.md`).

## Phase 1 — sweep results (2026-09-04)

`/hunt-bugs` completed on its second resume. It spent 417 agents and ~30.6M
subagent tokens across two runs: eleven read-only hunters over the codebase,
seven adversarial browser flows driven one at a time, then three skeptics per
candidate, each prompted to refute. **131 candidates, 92 upheld** — 5 high, 44
medium, 43 low. Both interruptions were account limits, not failures; the cache
made each resume replay the completed agents and run only what was missing.

Filed as fifteen grouped tickets, **#398–#412** (`759dbde`), by the file set one
lane would open. The five high-severity ones:

| Ticket | Finding |
| --- | --- |
| #398 | Stored XSS — vendor bio and business name go into the public page's JSON-LD through `JSON.stringify` + `dangerouslySetInnerHTML` with no escaping |
| #399 | `createRefund` carries no idempotency key, so two concurrent cancels refund twice; two accepts on one vendor date both win (reproduced against the real harness with `Promise.all`) |
| #400 | Cancelling frees the date but leaves the request `accepted`, and every read still reports the booking as paid |
| #402 | Message threads page from the oldest message, so everything past the fiftieth is invisible after a reload |

The static accessibility hunt ran alongside it and is filed as **#411**, minus
what #383 (focus rings) and #388 (silent submits) already own.

### Landed since the sweep

| Commit | What | Ticket |
| --- | --- | --- |
| `7fc4469` | Every form answers its first submit: counted summary in a `role="alert"`, `aria-invalid` + `aria-describedby` per blocking field, focus moved to the first blocker (including the four `role="group"` targets), the Price filter says when it could not read a bound | #388 (browser pass outstanding) |
| `58722a2` | Clerk telemetry off, so the enforced CSP has nothing to block | follow-up to #396 |
| `759dbde` | #398–#412 filed | — |

`worktree-388` is merged and its lane is gone. `worktree-386` is squash-merged
into the index and **not yet committed**: its one conflict (`design-tokens.test.ts`)
resolved to an empty `KNOWN_UNDEFINED_STEPS`, because #387 fixed the two
`bg-sage-500` sites and #386 fixes the other two, so the ratchet reaches zero.
It waits on its `diff-reviewer` verdict.
