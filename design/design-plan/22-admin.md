# 22 — Admin (`/admin/*`) — **MVP**

**Purpose:** an operations tool. Same typography and palette, denser layout.
Scannability beats airiness; the whitespace moves to the gutters.

## Shell

The header inverts to `stone-900` with a translucent "Admin" chip — an
unmistakable signal you're on the ops side of the product. Sidebar 210px:
Overview · Vendors · Customers · Bookings · Payments · Cases (count) ·
Reviews (count) · Categories & tags · Activity.

**Cases is a ninth row and carries the second count — ruled 2026-09-07
(#431).** It sits between `Payments` and `Reviews`, in the order an operator
works: it is money, and it is the only row on the rail where the platform owes
somebody an answer. The count is open cases, and it earns the badge for a
sharper reason than Reviews does — an unreviewed review is somebody waiting for
an opinion, an open case is somebody's payout frozen. Read the same cheap way,
`pageSize=1` for the `total`, never through `/admin/metrics`.

**Activity is an eighth row and frame `13` draws seven — ruled 2026-09-07
(#434).** The frame yields, the same direction D30 settled: this file is the
spec, and an operations console whose whole surface acts on other people's
accounts needs its own record reachable from the rail rather than only by typing
a URL. It sits **last** because it is the only item that is not a working
surface — nothing on it is acted on, it is what the other seven leave behind.
The rail already scrolls at every viewport, so the row costs no composition.

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

**Activity** — the console's own record (#434). The same table as `13 Admin`
over `admin_actions`: When · Operator · Action · Subject · What changed. Its
Refine bar carries one dropdown, Action, because the other two filters are ids
rather than vocabulary — the Operator and Subject cells are links that filter by
themselves, which is what makes "what else did this operator do" and "what else
happened to this account" one click from any row rather than a dropdown of every
uuid the platform holds. **No row carries an action**, and that is not an
omission: the table is append-only in the database, so a control here would
offer something Postgres refuses.

**Cases** — the operations queue (#431), and the only console list ordered
**oldest first**. Reference · Who · Subject · Booking · Age · Filed · Status,
filtered by open/resolved and by whether a booking is attached, defaulting to
open. The count line carries the age of the oldest open case, because that
number is money somebody is not being paid; every other list's newest-first
order would put exactly that row on the last page. One inbox for both doors — a
customer's report and a card network's chargeback — because an operator working
two queues works neither.

**Detail views** — card-based groupings with the actions prominent. Every
destructive action goes through an AlertDialog naming the consequence.

The case detail is the worked example: the message in full, the sender, the
chargeback's Stripe id and network outcome where there is one, and the booking
with every money field the list rows omit — total, fee, payout, refund, paid-at,
payout-released-at and the hold's reason. Then the two-position control, each
side of it naming its consequence **in money**: "$1,200 goes back to the
customer and the booking is cancelled", never "Are you sure?".

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
