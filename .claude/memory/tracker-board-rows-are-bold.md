---
name: tracker-board-rows-are-bold
description: "Status Board rows from #65 up wrap every cell in ** — strip markup before matching or you silently drop 154 tickets"
metadata: 
  node_type: memory
  type: project
  originSessionId: f7d4e3c0-af07-4ed8-a6e0-ad54b3f32626
  modified: 2026-08-29T06:06:26.982Z
---

In `.claude/plans/vendor-marketplace-tickets.md`, Status Board rows from **#65
upward wrap every cell in `**`** — the id cell reads `| **165** |`, not `| 165 |`.
Rows #0–#64 are unbolded. Both styles are live in the same table.

**Strip `*` and backticks from a cell before matching anything.** Fold lettered
ids (`6a`, `22a`) onto the parent number.

**Why:** on 2026-08-29 a parse using `^\| *[0-9]` (requiring a bare digit right
after the pipe) silently dropped all 154 bolded rows. That produced a confident,
wrong headline finding — "the board stops at #64, 155 tickets are invisible to
`/next-ticket`, promoting them is required work" — which was reported to the user
as a blocker before a peer session caught it. The board was always complete. The
real numbers: **229 rows, max #229, ~98 eligible.** A second session made the
same mistake independently with a `^[0-9]+$` extractor, so this trips people
twice.

**How to apply:** use the parser in `scripts/overnight.sh` (`eligible_tickets`)
rather than writing a new one — it strips markup and does the two-pass Done/
Blocked-By resolution. If you must write one, verify the row count against
`grep -c '^### #'` (ticket detail sections) before trusting it; a large gap
between detail sections and board rows means the parse is broken, not the board.

Also: a `Blocked By` that names **no ticket number** is a human gate written in
prose (`Resend API key`, `Stripe dashboard`, `style taxonomy`). Keying eligibility
on `Blocked By` alone dispatches work at a credential nobody has — test the
status string too. See [[vendor-marketplace-local-ticket-tracker]] and
[[record-findings-in-backlog]].
