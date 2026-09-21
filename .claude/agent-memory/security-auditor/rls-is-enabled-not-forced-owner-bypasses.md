---
name: rls-is-enabled-not-forced-owner-bypasses
description: VEN-504 enabled RLS on all 28 public tables with no policies and no FORCE; enforcement rests entirely on the connecting role not being the table owner, and the new failure mode is silent emptiness
metadata:
  type: project
---

`ENABLE ROW LEVEL SECURITY` on every `public` table (0059) plus
`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC` (0060). No policies, no
`FORCE`, no `GRANT` anywhere in the repo — only the PGlite test creates a role.

**Why:** defence in depth only. The API connects as the table owner
(`neondb_owner`, `rolbypassrls = true` on dev/staging), and an owner bypasses
non-forced RLS, so today the change enforces nothing. It binds the day a second
role appears.

**How to apply:**

- Any future non-owner role (Neon Data API `authenticated`/`anonymous`, a
  read-only analytics role, a replica user) reads **zero rows with no error** —
  `/ready`'s `select 1` still passes. Before, the same role got a loud
  `permission denied`. A role change is now a silent empty-data outage; pair one
  with a policy or an ownership assertion at boot.
- `pg_dump` is the loud exception: it sets `row_security = off` and errors for a
  role that cannot bypass, so backups fail visibly rather than dumping nothing.
- A `FORCE` later is a real cutover: it would bind the API's own connection, and
  `rolbypassrls` on the connecting role decides whether it binds at all.
- The guard `packages/db/src/schema/row-level-security.test.ts` reads
  `relkind = 'r'` in `public` only — a partitioned table (`'p'`), a view or a
  matview escapes it, and so does any other schema. Related:
  [[backup-integrity-is-not-authenticity]].
