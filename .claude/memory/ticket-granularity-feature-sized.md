---
name: ticket-granularity-feature-sized
description: File few, detailed, feature- or fix-shaped tickets — never one ticket per measurement or finding
metadata:
  type: feedback
---

Tickets must be **feature- or fix-shaped and few**: one ticket per user-visible
capability or per defect, written with enough detail to implement without asking.
Never file one ticket per parity measurement, per lint finding, or per audit hit —
batch those into the ticket for the surface they belong to.

**Why:** stated 2026-08-31. The user runs tickets autonomously and cannot tell what
each one changes when the queue is 300+ micro-rows. The board proves the cost: of
315 closed rows, **138 were `Superseded`** — consolidated away rather than worked.
That is ~44% of all filed tickets spent on filing and re-filing.

**How to apply:** before filing, ask "is this a feature or a fix a human would
recognise?" If it is a measurement, an axis, or one line of copy, append it to an
existing surface ticket instead. Audit and parity sweeps report **grouped by
surface**, one ticket per surface, not one per finding. See
[[record-findings-in-backlog]] and [[filing-a-ticket-is-a-three-file-change]].
