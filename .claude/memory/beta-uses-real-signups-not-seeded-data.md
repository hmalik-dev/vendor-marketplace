---
name: beta-uses-real-signups-not-seeded-data
description: The friends beta runs on real sign-ups (a few friends as vendors, a few as customers), never the fabricated demo seed
metadata:
  type: project
---

Decided 2026-09-19: the deferral of a hosted beta is lifted. Friends test as
real users on a deployment (Railway API, Vercel web, Neon `staging`, Stripe test
mode). Reference data only (`pnpm db:seed`); do **not** run `db:seed:demo`.

**Why:** fabricated vendors with invented ratings would hide the real
onboarding flow (invite/application, terms, Stripe Connect) that the beta exists
to exercise.

**How to apply:** vendors join by admin invite or approved application, so an
admin account is needed on the deployment. Derive required env from the registry, not from old docs. The Render demo
was removed with VEN-461; Railway is the one API host. The auth provider
was retired with VEN-447/448/449.

Related: [[vendor-marketplace-neon-dev-branch]].
