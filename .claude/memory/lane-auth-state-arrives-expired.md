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

**How to apply:** regenerate as a lane-setup step, not a debugging step. This is the class
[[worktree-env-copies-drift]] describes, and it belongs in #363's guardrails as an
executable check rather than a remembered rule.
