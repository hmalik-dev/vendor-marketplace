---
name: users-never-access-clerk
description: "Product ruling — end users never reach Clerk account management; every account change goes through the app, and the owner alone uses Clerk"
metadata: 
  node_type: memory
  type: project
  originSessionId: a367b1cd-3164-466f-a7e6-ceed58b158b3
  modified: 2026-09-14T22:55:31.623Z
---

Ruled by the account holder 2026-09-14: users sign up and in via the app's embedded Clerk forms, but never reach Clerk-hosted account management (no `UserButton` / `UserProfile`, no Account Portal, no self-serve delete). Any account change a user makes is handled via the app; the owner operates Clerk.

**Why:** Clerk-side changes bypass app rules (D39 closure refusal) and are the only user-caused source of email-mirror divergence.

**How to apply:** never add a Clerk account-management component; don't treat "user changed email/deleted account in Clerk" as a normal user path in tickets. Code side VEN-403, console side VEN-377, residual safety net VEN-386. Related: [[vendor-marketplace-linear-tracker]].
