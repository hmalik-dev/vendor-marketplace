---
name: an-empty-fixture-table-is-an-unverified-requirement
description: A browser pass over a screen whose table is empty verifies the headers and nothing else; seed rows chosen so the requirement is decidable, not merely present
metadata:
  type: project
---

**A screen with no rows verifies its column headers and nothing else.** Every
requirement about what a *cell* renders — a two-part Subject, a colour
threshold, a date format — is unverified against an empty table, and the pass
reports PASS on the half it could see.

Found 2026-09-07 on #454. `/admin/activity`'s headers were confirmed in the
right order, and the two requirements that actually mattered — the Subject cell
drawn as type + id in one cell, and the 24-hour absolute timestamp — went
undriven because `admin_actions` held zero rows. The 24-hour clock was the
requirement most at risk and the one no unit test reaches, since jsdom renders
the same `Intl` output the browser does.

**Seed the rows directly; do not manufacture them through the UI.** Every action
that writes an `admin_actions` row suspends, deletes or moderates something
real, the table is append-only, and a browser agent driving one mutates shared
fixture data for every later pass. The verifier was right to refuse and report
the gap instead.

**Choose fixture values that make the requirement decidable, not merely
present.** A timestamp at `23:24` renders `11:24 PM` on a 12-hour clock and
`23:24` on a 24-hour one, so the assertion can fail. A row at `09:00` reads
identically either way and proves nothing — the same trap as
[[verify-with-a-differently-shaped-check]] and the zero-count fixture in #454's
own widening tests. Pick three subject *types* for a cell that renders a type,
one row per colour band for a threshold.

**How to apply:** before delegating a browser pass, ask of each requirement
*which row would show this*, and seed that row. If the answer is "any row", the
table still needs one. When a pass comes back PASS on headers and silent on
cells, read it as unverified rather than verified.
