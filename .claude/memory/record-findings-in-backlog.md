---
name: record-findings-in-backlog
description: Every bug or finding must be filed in Linear, not just reported in chat
metadata:
  type: feedback
---

Every bug, defect or finding discovered during a ticket run must be **recorded
in the backlog** — Linear team `VEN`, project **Vendor Marketplace** — as a new
issue (`/file-ticket`, one per surface) or as a comment on the issue it belongs
to. Reporting it in the chat response is not enough.

**Why:** the chat scrolls away and the loop runs unattended across many runs. A
finding that lives only in a response is lost the moment the session ends, and
the tracker is the only durable queue — see [[vendor-marketplace-linear-tracker]].

**How to apply:** when a run surfaces something — a defect outside the current
ticket's scope, a frame-vs-plan deviation, an unexplained change in the tree, a
false positive in a ticket's own premise — write it into Linear before finishing
the run. Deviations that were deliberately *not* built go in a comment on the
owning issue; new defects get their own issue, sized per
[[ticket-granularity-feature-sized]]. State given 2026-08-27, re-homed to Linear
2026-09-14.

Related: [[adhoc-work-single-commit]], [[playwright-parity-gate-every-fe-ticket]]
