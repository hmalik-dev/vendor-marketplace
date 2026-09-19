---
name: neon-dev-and-staging-are-safe-production-is-not
description: "Neon has dev, staging and production branches; lanes may work in dev or staging (Neon Auth, Object Storage, spikes), never production"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 6be10981-584c-4523-aa1e-5e7193e3b9ff
  modified: 2026-09-19T03:23:45.743Z
---

The Neon project has three branches: `dev` (Neon Auth enabled, `br-silent-queen-ax78ksii`), `staging`, `production`. The account holder (2026-09-19) said `dev` and `staging` are both safe to work in, so a lane needing Neon-only features (Auth, Object Storage) may use either without asking.

**Why:** Neon Auth and Object Storage have no local emulator, so a spike or migration ticket has to run against a real branch.

**How to apply:** always pass the branch positionally and assert the host before any SQL. `neon connection-string --branch-id` ignores the flag and defaults to **production** (VEN-444 ran two SELECTs and two no-op DELETEs there by mistake). Ordinary app work still runs on Docker Postgres ([[vendor-marketplace-no-docker]], [[vendor-marketplace-neon-dev-branch]]).
