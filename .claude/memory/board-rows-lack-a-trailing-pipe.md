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
