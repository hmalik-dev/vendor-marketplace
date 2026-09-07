---
name: lane-auth-state-arrives-expired
description: .worktreeinclude copies .auth/ into every lane, minted against port 3000 and usually expired
metadata:
  type: project
---

`.worktreeinclude` copies `.auth/` into every new worktree from the main checkout, where it
was minted against **port 3000** and has usually expired. A fresh lane therefore drives
**signed out while looking clean** — the files are present, so nothing reports a problem.

Regenerate in-lane before driving anything: `pnpm lane:exec <n> -- pnpm e2e:auth`.

**`resolveBaseUrl` in `scripts/e2e-base-url.mjs` is NOT at fault** — verified 2026-08-31 by
reading it: `E2E_BASE_URL` -> `WEB_URL` -> `WEB_PORT` -> 3000, and regenerating in-lane
rewrote the stored origins to the lane's port. A session reported it as "pinned to 3000"
and nearly filed a ticket against working code. **Naming the innocent party matters as much
as naming the guilty one.**

**Why:** measured 2026-08-31 by a peer session. Sharing `.auth/` across lanes is deliberate
(a Clerk session per role, while each lane's data is its own), so the file being there is
not evidence it works.

**It expires again mid-pass, and that reads as a clean run — 2026-09-07.** Lane
441 regenerated on arrival, then had the state expire **a second time about 20
minutes later**: a customer navigation landed on `/sign-in` and the signed-in
footer silently rendered its signed-out variant. Nothing errored. It was caught
only because the Account column's *contents* were wrong for the state being
measured — that is, by asserting on content rather than on the page loading.

So regeneration is not a one-off setup step on a long lane. **A parity or
browser pass that runs for more than about twenty minutes should re-mint before
its final measurements, or assert something that is only true when signed in and
fail loudly when it is not.** The same class as
[[guard-a-delegated-browser-pass-with-a-liveness-watch]]: the pass completes,
reports no defects, and the absence of defects is an artefact of the environment
rather than a fact about the app.

**How to apply:** regenerate as a lane-setup step, not a debugging step. This is the class
[[worktree-env-copies-drift]] describes, and it belongs in #363's guardrails as an
executable check rather than a remembered rule.
