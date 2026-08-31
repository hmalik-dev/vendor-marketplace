---
name: demo-deployment-deferred
description: The free showcase deployment is built but deliberately not stood up until the queue and MVP features are complete
metadata:
  type: project
---

**Decided 2026-08-31: do not stand up the demo deployment until the ticket queue
and the MVP feature set are complete.** The account holder would rather wait than
put a half-built product in front of friends for feedback.

The work to do it is already on `main` and current — `render.yaml` (a Render free
blueprint building `apps/api/Dockerfile`) and `docs/demo.md` (the runbook). What
is missing is only the running of it: a Render service, a Vercel project pointed
at `main`, and a migrated and seeded Neon `staging` branch.

**Why:** the app was reachable but inert — the web tier is deployed on Vercel and
the API tier is not, so `/search` returns HTTP 200 with 72 skeletons and zero
vendors. Standing it up is ~20 minutes of dashboard work, but a demo of an
incomplete product buys feedback about known gaps.

**How to apply:** do not re-propose the deployment as a next step, and do not
treat `docs/demo.md` as describing something that exists. When the queue does
empty, read that file's **Before you run this** section first — deferring is what
makes its two caveats stale rather than wrong: #11 makes `RESEND_API_KEY`
required at API boot with a shape a placeholder cannot satisfy, and the web
project still builds from the `production` git branch, which was 26 commits
behind `main`.

Related: [[vendor-marketplace-vercel-deployment]],
[[production-api-intentionally-down]], [[vendor-marketplace-neon-dev-branch]],
[[record-findings-in-backlog]].
