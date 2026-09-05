# 22 — Admin (`/admin/*`) — **MVP**

**Purpose:** an operations tool. Same typography and palette, denser layout.
Scannability beats airiness; the whitespace moves to the gutters.

## Shell

The header inverts to `stone-900` with a translucent "Admin" chip — an
unmistakable signal you're on the ops side of the product. Sidebar 210px:
Overview · Vendors · Customers · Bookings · Payments · Reviews (count) ·
Categories & tags.

## Table

Title row: "Vendors" (Serif 23px) with the count line in `stone-600`
("412 total · 38 awaiting review · updated 2m ago").

Filter bar above the table, never a modal: search input, then the active
saved-filter as a `clay-400` filled button ("Awaiting review (38)"), then
Category / City / Payouts dropdowns, then "Export CSV" as a ghost link, right-aligned.

Table: `bg-stone-0`, 1px `stone-300`, 12px radius, `overflow:hidden`.
Header row `bg-stone-100`, 10.5px uppercase `stone-600`, **fixed**; the body
scrolls internally. Rows 44px, zebra with `#FDFAF4`, 1px `stone-150` separators.
Row-select checkbox first column, overflow menu last.

**Fifteen rows fit at 1440 × 900.** Count them against the real header height
before claiming a number — a table that promises eighteen and clips three is a bug.

**The frame did not, and got the 4px it was short — ruled 2026-09-04 (D30).**
Measured at 1440×900: the pane wrapper resolved to 705px of content, the fixed
header row takes 34 and each row 45, so `(705 − 34) / 45 = 14.9` — fourteen rows
and 93% of a fifteenth, clipped by exactly 4px. The app reproduces it because the
app matches the frame. The blurb was not the thing to correct: this file is spec
and it says fifteen, so the frame yielded. The title block's bottom padding goes
`14px → 12px` and the pane's `20px → 16px`; the table then measures 709px of
content for 15 × 45 + 34 = 709, with 4px of slack. **Fifteen rows, measured.**

`admin/data-table.tsx`'s pane is `px-6 pb-5`, which is the frame's old `0 24px
20px`; matching the new number belongs to **#392**, which owns frame `13`'s
geometry.

Columns: Business · Category · City · Rating · Bookings · Status · actions.
Status uses the standard pills: Live (sage), Review (gold), Flagged (clay),
Paused (stone).

## Other views

**Overview** — four metric cards, then line charts for bookings and revenue
(Recharts). Colour-coded by meaning: revenue gold, bookings clay, users steel,
completion sage.

**Detail views** — card-based groupings with the actions prominent. Every
destructive action goes through an AlertDialog naming the consequence.

## Acceptance

- [ ] Table header fixed; body scrolls; the page does not
- [ ] Row count fits without clipping — verify, don't assume
- [ ] Filters in the bar, not a modal
- [ ] Bulk actions appear only when rows are selected
- [ ] Every status uses the shared pill vocabulary

## Post-MVP

- Cohort and retention analytics
- Automated flag triage
- Vendor quality scoring
- Bulk messaging to vendor segments
