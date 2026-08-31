---
name: tracker-board-rows-are-bold
description: "Board rows mix bolded and plain ids in the same table — never key a match on bolding, in either direction"
metadata: 
  node_type: memory
  type: project
  originSessionId: f7d4e3c0-af07-4ed8-a6e0-ad54b3f32626
  modified: 2026-08-29T06:06:26.982Z
---

In `.claude/plans/vendor-marketplace-tickets.md`, the Status Board's id-cell style
has **changed three times**, and no rule by id range has stayed true:

- `#0`–`#64` — plain: `| 12 |`
- `#65`–`#356` — bolded: `| **165** |`
- the eight rows the 2026-08-30 consolidation filed (`#357`–`#364`) were written
  **plain**, then normalised to bolded later the same evening

**Never key a match on bolding, in either direction, and never trust this note's
list over the file.** Read the current style out of the table before matching:

    grep -cE '^\| [0-9]+ \|'      # plain-id rows
    grep -cE '^\| \*\*[0-9]+\*\* \|'  # bolded-id rows

Both counts being non-zero is the normal state, not a defect.

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

**And again, inverted, on 2026-08-30.** A session counting the consolidation's new
rows with `^\| \*\*[0-9]+\*\* \|` (requiring bold) got **zero** for #357–#364 and
was one message away from reporting that a rebase had dropped eight tickets. The
same fault undercounted the Superseded flips as 22, missing #19, #46 and #62 —
also unbolded. This memory, as previously written, is what led that session
astray: it said "#65 upward" wraps every cell, and the newest rows do not.

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
