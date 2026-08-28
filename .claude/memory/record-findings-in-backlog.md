---
name: record-findings-in-backlog
description: Every bug or finding must be written into the ticket backlog, not just reported in chat
metadata:
  type: feedback
---

Every bug, defect or finding discovered during a ticket run must be **recorded
in the ticket backlog** (`~/.claude/plans/vendor-marketplace-tickets.md`) — as a
new ticket, or as a note on the ticket it belongs to. Reporting it in the chat
response is not enough.

**Why:** the chat scrolls away and the loop runs unattended across many runs. A
finding that lives only in a response is lost the moment the session ends, and
the backlog is the only durable queue — see
[[vendor-marketplace-local-ticket-tracker]].

**How to apply:** when a run surfaces something — a defect outside the current
ticket's scope, a frame-vs-plan deviation, an unexplained change in the tree,
a false-positive in a ticket's own premise — write it into the tracker before
finishing the run. Deviations that were deliberately *not* built go in the
owning ticket's Notes column; new defects get their own row. State given
2026-08-27.

Related: [[adhoc-work-single-commit]], [[playwright-parity-gate-every-fe-ticket]]
