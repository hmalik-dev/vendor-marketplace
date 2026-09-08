---
name: board-rows-lack-a-trailing-pipe
description: Not every Status Board row ends with `|`, so `parts[-2]` writes into Capabilities instead of Notes
metadata:
  type: project
---

Status Board rows in `vendor-marketplace-tickets.md` are **not** uniform: most
end with a trailing `|`, so `line.split('|')` yields 12 cells and `parts[-2]` is
Notes — but some rows have no trailing pipe, yield 11, and `parts[-2]` is the
**Capabilities** column.

**Why:** appending a closing note through `parts[-2]` therefore lands in the
wrong column on those rows, silently. It is not visible in the rendered table
and the note reads fine; what catches it is `tickets.board.test.ts`, which
parses the Capabilities cell and fails with the backticked words from the prose
("#400: cancelled", "#400: completed") as if they were capability names. That
error names the ticket and looks like a registry mismatch, so the first instinct
is to edit `tickets.ts` — which is the wrong file.

**How to apply:** address the Notes cell by index from the left (`parts[10]`)
after asserting the cell count, or append with
`line.rstrip()[:-1] + note + ' |'` only after checking the row actually ends in
a pipe. Then run `pnpm test --force` — the board is not a turbo task input, so a
cached green proves nothing (see [[filing-a-ticket-is-a-three-file-change]]).
Related: [[tracker-board-rows-are-bold]], which is the other place this table's
irregular formatting has produced a confident wrong answer.

## `awk`'s `$n` is python's `parts[n-1]` — never carry a column index between tools

Lane #462, 2026-09-08. It inspected the board with `awk` to find the Status
column, then wrote the edit in python using the same number. `awk`'s `$7` is
python's `parts[6]`, so the write was aimed one column left.

**The assertion is what caught it.** The script asserted the old value before
replacing — `parts[7] == '**Backlog**'` returned `' — '` and it stopped. Without
that, it would have written `**Done**` into the **Branch** column and the branch
name into **Blocked By**, on a row that still looks plausible at a glance and
that no test reads closely enough to reject.

**Same family as the `parts[-2]` note above, in a new disguise:** not off the end
this time, but **off by one between two tools that both call it "field 7"**.

**How to apply:** never carry a column index from one tool to another —
**re-derive it in the tool doing the write**, and **assert the old value before
replacing it**. The index alone is never trustworthy; the assertion is what makes
the mistake loud. Verify afterwards that the row still has 12 fields and that the
cell the off-by-one would have eaten still reads what it should.
