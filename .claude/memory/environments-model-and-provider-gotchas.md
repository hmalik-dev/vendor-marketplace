---
name: environments-model-and-provider-gotchas
description: "Local/staging/production tiers, branch promotion, and the Railway/Vercel/Neon quirks hit while setting them up on 2026-09-20"
metadata: 
  node_type: memory
  type: project
  originSessionId: 55a5e167-a9bf-464c-8644-ed282d3c83cc
  modified: 2026-09-20T19:24:51.459Z
---

Three tiers (full table in `docs/environments.md`): local + lanes on `main` (Docker Postgres, Neon `dev` for auth/storage), staging = `staging` branch, production = `production` branch, promoted by fast-forward only. The friends beta runs on the production stack and is treated as a real launch; test-mode Stripe is a ruling that may change (VEN-377 first line).

**Why:** `main` requires linear history, so branch merges would diverge; staging is the manual-test environment.

**How to apply:**
- Railway sealed variables vanish from `railway variable list --json`, not just their value; a "missing" sealed key is not proof it is unset. Compare by boot log, not listing.
- A saved Railway variable redeploys the *same snapshot*; a service with no GitHub source needs `railway up` from a clean `git archive` export. Both services are now repo-linked to their branch.
- The permission classifier blocks secret-store writes (Railway/Vercel variables) until the user grants a rule; do not work around a denial. Writes via stdin (`printf | vercel env add --sensitive`, `railway variable set --stdin`) keep values out of the transcript; use `--skip-deploys` on production so it does not deploy by accident.
- Vercel Hobby has no custom environments; staging web is Preview scoped to git branch `staging` (`--git-branch staging`), URL `vendor-marketplace-web-git-staging-<scope>.vercel.app`, behind Vercel login. PR previews fail their build on missing env (not a required check).
- Neon Auth trusted domains are per branch (`neon neon-auth domain add <origin> --branch <name>`), empty by default.
- The GitHub repo is public, so branch rulesets need no plan upgrade.
