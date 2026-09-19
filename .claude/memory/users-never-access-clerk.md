---
name: users-never-access-clerk
description: "Product ruling — end users never reach Clerk account management; every account change goes through the app, and the owner alone uses Clerk"
metadata: 
  node_type: memory
  type: project
  originSessionId: a367b1cd-3164-466f-a7e6-ceed58b158b3
  modified: 2026-09-18T23:28:32.175Z
---

Ruled by the account holder 2026-09-14, reaffirmed 2026-09-18: sign-up and sign-in are the app's own screens (embedded Clerk forms on our routes), and users never reach Clerk itself under any circumstance — no Clerk-hosted sign-in or sign-up, no Account Portal, no `UserButton` / `UserProfile`, no self-serve delete. Every account change and every failure path (an address Clerk already holds, a retired row, a verification dead end) is resolved in the app; the owner alone operates Clerk.

**Why:** Clerk-side changes bypass app rules (D39 closure refusal) and are the only user-caused source of email-mirror divergence. A fix that hands a stuck user off to Clerk trades one dead end for a worse one.

**How to apply:** never add a Clerk account-management component; don't treat "user changed email/deleted account in Clerk" as a normal user path in tickets. Code side VEN-403, console side VEN-377, residual safety net VEN-386. Related: [[vendor-marketplace-linear-tracker]].
