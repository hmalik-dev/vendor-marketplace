---
name: lane-429-renders-as-500
description: A browser or E2E pass trips RATE_LIMIT_MAX and the 429 renders as the generic 500 page
metadata:
  type: project
---

A browser or E2E pass exceeds `RATE_LIMIT_MAX` (120/min), the API answers **429**, and the
web app renders it as the generic 500 screen — *"Something broke on our end… We've been
notified"*. A throttled run is indistinguishable from a broken feature.

Raise it for the run: `RATE_LIMIT_MAX=100000 pnpm lane:exec <n> -- pnpm --filter
@vendor-marketplace/api dev`.

**The 429 is only visible in the lane's API server log.** The page renders the ordinary
500 screen and **the browser console stays clean**, so nothing at the surface says
"throttled". That is what makes it a misdiagnosis rather than a nuisance.

**Why:** measured 2026-08-31 by a peer session, after two misdiagnosed test failures.

**How to apply:** set it before any browser or E2E pass in a lane. If a whole flow starts
failing at once part-way through a pass, **read the lane's API log before reading the diff** —
the browser will not tell you. Related:
[[vendor-marketplace-playwright-verification]], [[worktree-env-copies-drift]].
