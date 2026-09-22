---
name: db-changes-are-last-resort-after-launch
description: "Once the app is live nobody edits the database by hand; every fix, grant and recovery is an app feature, and a DB change is the last option"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 92ff5dfd-2c93-437c-ab92-fa23c08f447e
  modified: 2026-09-21T00:08:16.170Z
---

Once the app is live, the goal is to **never make manual database changes**: every resolution, grant, repair and concern is handled through the app (operator console, API, a deploy-time migration), and a hand-run DB change is the last option.

**Why:** stated by the account holder on 2026-09-20 while working out how to make the first admin (SQL `update users set role = 'admin'`). A hand edit leaves no audit row, bypasses the API's invariants, and cannot be reviewed or tested.

**How to apply:**
- Before launch, a one-time bootstrap (the first admin row, seeds) is fine. Name it as the single exception, in the runbook, not as a habit.
- After launch, when a ticket or runbook says "an operator runs SQL", that is a missing feature: file a ticket for an in-app control with an audit row (and step-up for a privileged action) instead of documenting the SQL.
- Schema changes still ship as migrations through the deploy pipeline; that is a release, not a hand edit. Never point local or lane work at Neon production ([[neon-dev-and-staging-are-safe-production-is-not]]).
- Follow-ups already filed from this: an in-app grant and revoke of operator access (see the ticket for it), and RLS (VEN-504, VEN-505) as the database-side backstop.
