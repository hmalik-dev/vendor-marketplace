---
name: linear-has-an-archived-sibling-project
description: "Team VEN holds a second, archived project named `vendor-marketplace` (lowercase, March 2026, Prisma/Supabase era) — its ~200 layer-split issues are not the backlog"
metadata: 
  node_type: memory
  type: project
  originSessionId: ea562f11-42df-4dce-bc57-6fa726c2f237
  modified: 2026-09-14T21:45:23.700Z
---

Linear team `VEN` has two projects: **Vendor Marketplace** (the live one,
`project.json`'s `tracker.project`, created 2026-08-26) and `vendor-marketplace`
(lowercase, created 2026-03-22, from an earlier Prisma + Supabase incarnation).
The lowercase project's issues — `[Shared] TypeScript types — vendors`,
`[Email] …`, `[Admin] GET /admin/disputes`, roughly 200 rows — are all
**archived** and only appear with `includeArchived: true`.

**Why:** seen 2026-09-14 during the backlog cleanup; a team-wide `list_issues`
with archived rows included reads as a 200-ticket fragmented backlog that no one
filed. It is history, not a queue.

**How to apply:** always filter `list_issues` to the project named in
`project.json`; never "clean up" or re-home the lowercase project's rows. See
[[vendor-marketplace-linear-tracker]] and [[ticket-granularity-feature-sized]].
