---
name: vendor-marketplace-local-ticket-tracker
description: "This project uses a local markdown ticket tracker file, not Linear, despite the orchestration policy naming Linear"
metadata: 
  node_type: memory
  type: project
  originSessionId: b1069b8f-eb56-4bcc-ae39-04751cc2fd20
  modified: 2026-08-26T06:40:05.844Z
---

For the `vendor-marketplace` repo, the ticket queue lives at `.claude/plans/vendor-marketplace-tickets.md`, not Linear. `/next-ticket` and `/ticket` must read status/priority/blocked-by from that file's Status Board table and write status transitions back to it (Backlog → In Progress → Done, filling the Branch and Notes columns).

**The tracker carries open rows only, since 2026-08-30.** Every `Done` and `Superseded` row and detail section lives in `.claude/plans/vendor-marketplace-tickets-archive.md` — 311 of the 334 rows, moved whole. When a Notes cell names a ticket the tracker does not hold, read the archive; do not conclude the row was lost. `packages/shared/src/env/tickets.ts` still registers every archived number, so `pnpm preflight --ticket <old n>` gates unchanged, and `tickets.board.test.ts` parses **both** files — a new row must still get a registry entry, wherever it lives.

Companion planning docs in the same directory: `vendor-marketplace-plan.md` (architecture, data model, API contracts), `vendor-marketplace-decisions.md` (settled tech + business decisions). The design plan is **not** in this directory — it lives in the repo at `design/design-plan/`.

**Why:** the user explicitly designated the markdown file as the tracker; there is no Linear project and the Linear plugin is disabled (2026-09-11).

**How to apply:** since 2026-09-11 every read and write goes through `node scripts/board.mjs` (`depth`, `list --ready`, `get`, `next`, `set`, `add`), which applies the queue order, treats a ticket with an active lane manifest as in flight, and records branch, SHA and PR when marking Done. Never grep or sed the board file.

Related: [[vendor-marketplace-no-docker]]
