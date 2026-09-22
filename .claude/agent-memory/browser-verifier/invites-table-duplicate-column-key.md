---
name: invites-table-duplicate-column-key
description: The admin Invites DataTable (vendor-applications-panel.tsx) has two columns both literally key:'email' — a React duplicate-key console warning on every render, pre-existing and out of scope for VEN-513
metadata:
  type: project
---

`apps/web/src/components/admin/vendor-applications-panel.tsx`'s Invites
`DataTable` columns array (around line 433) declares two columns with
`key: 'email'` — the invite address column and the email-send-status column.
React logs "Encountered two children with the same key" every time this table
renders (confirmed via console listener during a VEN-513 bulk-invite pass,
2026-09-22: 8 warnings, no functional breakage observed in that pass).

**Why it matters:** confirmed via `git diff HEAD` that VEN-513's actual diff to
this file never touches the columns array — this predates that ticket (VEN-512
or earlier). It is not a VEN-513 regression; report it as an out-of-scope
finding, don't block the ticket's own criteria on it.

**How to apply:** if a future pass touches this file or this table, rename one
key (e.g. `'email-status'`) while fixing something else nearby; otherwise just
flag it in the out-of-scope list rather than re-discovering it from scratch.
