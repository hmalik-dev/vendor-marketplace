---
name: clerk-session-lapse-can-500-whole-app
description: A lapsed Clerk dev session can cascade into a full app-wide 500 (even public routes), not just a sign-in bounce
metadata:
  type: feedback
---

A lane's Clerk dev session lapsing mid-verification does not always show up as the
documented symptom (bouncing a protected route to `/sign-in` or `/vendor/dashboard`).
Observed once on lane 153: after ~10-15 minutes of driving `/vendor/availability`,
every route — including the public root `/`, which needs no auth — started
returning HTTP 500 with a root-layout error: `Clerk: auth() was called but Clerk
can't detect usage of clerkMiddleware()`. The dev server log
(`apps/web` `next dev`) showed the same error repeating on every request.

Re-running the documented recovery (`pnpm lane:exec <id> -- pnpm e2e:auth`) did
**not** fix it — the script itself timed out waiting for the sign-in email field,
because the app it was trying to sign into was already wedged and serving 500s.
Waiting (up to ~20s) and re-navigating did not self-heal it either.

**Why:** Next.js dev server middleware can apparently get stuck in a bad
compiled state where every `auth()` call fails, independent of whether the
session token itself is still valid. This is a dev-server process problem, not
just an expired-token problem — the two look identical at first (both make
`/vendor/availability` fail) but only the token case is fixed by `e2e:auth`.

**How to apply:** If `/vendor/availability` (or any route) starts 500ing and
`e2e:auth` also fails/times out against it, don't keep retrying `e2e:auth` —
diagnose whether the *public* root route also 500s. If it does, the web dev
process itself needs a restart, which is outside a browser-verifier's
permissions (killing lane processes gets blocked by the auto-mode classifier).
Report this as a `BLOCKED` environment issue for the caller to restart the lane's
dev server, rather than treating it as a verification failure of the feature
under test. See [[vendor-marketplace-e2e-credentials]] for the normal
session-refresh flow this supplements.
