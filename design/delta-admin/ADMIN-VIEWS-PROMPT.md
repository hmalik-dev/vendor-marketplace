# Admin views — build prompt (delta)

Scope: the admin routes not yet drawn. Frame 13's shell, table, filter bar and
pill vocabulary are unchanged and are the base for everything here. Drawn in
`delta-admin/Orla-Admin-Views.html`. Supersedes the single line in
`22-admin.md` §Detail views.

## Corrections — ruled 2026-09-07 while landing this bundle (#454)

Three things this bundle raised were put to the account holder rather than
guessed at in a lane. All three are answered, and the answers are recorded
**here, in the bundle**, so the artifact and the code cannot be read as
disagreeing. They are not open questions and are not to be re-asked.

1. **`/admin/activity` keeps its `What changed` column — five columns, not the
   four Pattern A lists.** The bundle was written at pattern level and the
   column was not considered. The same paragraph that forbids rounding a
   timestamp settles it: a trail that records _that_ something changed but not
   _what_ fails that test harder than a rounded clock does. The grid is
   `Actor 1.2fr · Action 1fr · Subject 1.6fr · What changed 1.7fr · When .9fr`.

2. **The route stays `/admin/tags`.** This bundle names it `/admin/categories`
   and nothing drawn depends on the path. A rename breaks operator bookmarks
   and every `admin_actions` subject link already written against the old one,
   for no drawn difference. Read every `/admin/categories` below as
   `/admin/tags`; the rail label is unchanged (`Categories & tags`).

3. **Suspending a vendor refunds in full. It does not hold payouts.** The
   drawn Actions card read _"Unpublishes, cancels 2 pending requests and holds
   payouts"_ — that is loose copy about an action it was summarising, and the
   consequence line has been corrected in the frame. **D31 (#416) is
   unchanged**: a suspension declines every open request, cancels every future
   confirmed booking and **refunds it in full**, reversing the vendor's share
   out of their Stripe balance, which can leave it negative. Holding and
   refunding are not the same action — a hold is reversible and leaves the
   customer's money where it is; a full refund is neither — so this correction
   is the difference between two outcomes for somebody's money, not a wording
   preference. Nothing here changes what a suspension does.

## 0 — Shell corrections

**The rail is nine rows, not eight.** The brief lists eight ending in Activity
but also gives Cases a count badge; a badge needs a row. Order:

    Overview · Vendors · Customers · Bookings · Cases (badge) · Payments ·
    Reviews (badge) · Categories & tags · Activity

Cases sits after Bookings because a case is always about one. Badges on Cases
(open count) and Reviews (pending count) only — a badge on a row that is never
zero is decoration.

**`/admin/requests` has no rail row.** It is a tab inside Bookings
(`Bookings · Requests`). A request is a booking before it exists; operators
reach it while looking at bookings.

Everything else as built: `#23201C` header, Admin chip, operator email, avatar
monogram; 210px rail; 34px row pitch; active row `clay-100` bg + `clay-600`
text + inset 3px clay bar; content on a 12px gutter with a 1px right border.

**Colour is fixed by `40-states.md` and is not re-litigated per screen.**
steel = information · gold = waiting on someone · red = failed · sage = settled.
Consequences for the statuses in this delta:

| Status                                            | Colour | Why                                     |
| ------------------------------------------------- | ------ | --------------------------------------- |
| pending, quoted                                   | gold   | waiting on someone                      |
| accepted                                          | sage   | settled                                 |
| declined, cancelled, expired                      | stone  | resolved, nothing failed, no clock left |
| payout attempt failed, chargeback, dispute reason | red    | it failed                               |
| case open                                         | gold   | waiting on us                           |
| case resolved                                     | sage   | settled                                 |
| case age ≥72h                                     | red    | the SLA failed (not the case)           |

Expired is **not** red. A clock running out is not a failure.

---

## Pattern A — list routes (ruling, no new frame)

Reuse frame 13 exactly. Only these differ.

### `/admin/activity`

- Columns: `Actor 1.2fr · Action 1fr · Subject 1.6fr · What changed 1.7fr ·
When .9fr` — five, per correction 1; `What changed` is kept.
- **No checkbox column, no overflow menu, no bulk bar.** Nothing here is acted
  on; removing both action columns is what makes it read as a log.
- Subject is type + id in one cell: type in `stone-600`, id in mono
  `stone-900` — `booking · BKG-8821`.
- Default newest first. Filters: Actor ▾, Subject type ▾, date range. No search.
- Timestamps absolute to the minute (`7 Sep 2026, 14:02`). Never relative — an
  audit trail that rounds is not an audit trail.

### `/admin/cases`

- Columns: `Reference .9fr · Sender 1.2fr · Subject 1.8fr · Booking .9fr ·
Age .6fr · Status .8fr`
- Default filter **open**, sort **oldest first**. Rail badge = open count.
- Reference is mono and is the row link. No linked booking renders `—` in
  `stone-500`, never blank.
- Age is the pressure column: stone <24h, gold ≥24h, red ≥72h.
- Two status pills only: Open (gold), Resolved (sage).

### `/admin/requests`

- Columns: `Vendor 1.4fr · Customer 1.2fr · Event date 1fr · Quoted .8fr ·
Expires .9fr · Status .9fr`
- Six statuses do not become six filter pills. The bar carries a segmented
  control of three groups — **Live** (pending, quoted) · **Closed** (accepted,
  declined) · **Lapsed** (expired, cancelled) — and the row still prints its
  exact status.
- `Expires` counts down **only** while pending or quoted (`6h 20m`, gold under
  12h). On the other four it prints the resolution date in `stone-600`. A dead
  countdown is a lie.
- Quoted price right-aligned, tabular mono; unquoted `—`.

### `/admin/categories` — served at `/admin/tags` (correction 2)

- The existing tag table, plus: `⠿ 22px · Name 1.6fr · Slug 1.4fr ·
Active 80px · Order 80px · ··· 70px`
- Slug in mono `stone-600` — it is an identifier and should look like one.
- Rows drag-order; Order renumbers on drop; steel toast `Order saved`. Toggle
  writes on release, no save button.
- Deactivating a category with live vendors → ConfirmAction naming the count:
  _"14 vendors are listed under Florals. They stay live and stay searchable,
  but Florals disappears from browse."_

### Empty states (both drawn)

**True empty** — no button. Nothing an operator does creates a case or an
activity row. The copy's job is to say where rows come from, so silence reads
as calm, not broken. Serif 21px line + one `stone-600` line.

**Filtered-empty — this closes #443.** Requirements, and they are hard:

1. The heading recites the active filters in the operator's own words —
   _"No resolved chargeback cases for 'kessler' in the last 7 days."_
2. One line stating how many filters are narrowing the view.
3. **One button per filter, each dropping exactly that filter and carrying the
   count it would reveal** (`Open cases instead (4)`, `Any origin (2)`,
   `All time (9)`). Highest count is the primary. A route that would reveal
   zero is never offered as a button.
4. `Clear all filters` last, as a ghost link — the escape, not the suggestion.

The counted routes are the whole point: an operator picks the widening that
pays instead of clearing everything and rebuilding the query.

---

## Pattern B — detail views (one frame, four routes)

Two columns: **left = the record** (wide, read-only, ordered as the operator's
questions arrive), **right = 320px identity + actions**. Everything that
changes state lives in the right column and nowhere else.

What the frame settles, and these are the rulings:

1. **Card order is question order.** Money and platform state first, then what
   they sell, then what they show, then what their calendar owes. Identity is
   small and right, because whoever arrives here already knows who they clicked.
2. **Label/value typography.** Label 10.5px uppercase 600 `stone-600` in a
   fixed 150px column; value 13px `stone-900` in `minmax(0,1fr)`. Identifiers,
   dates and money are mono 12px — anything paste-worthy looks pasteable.
3. **Long fields wrap, never truncate.** Value column is
   `overflow-wrap:anywhere` and grows the row. No ellipsis, no tooltip: a
   truncated Stripe id is a call to support. Multi-part values stack one line
   each under the label.
4. **Destructive actions never sit inside read-only data.** One Actions card,
   right column, below Identity, ordered least → most severe with a hairline
   between tiers, each with one line naming the consequence _before_ the press.
   Destructive is outlined red, never filled — filled red in a corner is a
   mis-click waiting.
5. **Empty within a detail keeps its card.** A vendor with no packages shows
   `Packages · 0` and one `stone-600` line — _"No packages yet. Customers can
   still request a custom quote."_ Never drop the card; a missing card reads
   as a loading bug.

### `/admin/vendors/[id]` — the drawn one

Left: **Stripe** (account id, onboarded, disabled reason, outstanding
requirements — labelled read-only, mirrored, with sync age) → **Packages**
(name · price · active) → **Portfolio** (horizontal strip, cover badged, remove
per image) → **Availability locks** (date · hold · held by; booked = sage,
pending = gold with its expiry, blocked = stone with the vendor's note).
Right: Identity, Actions (Unpublish profile → Suspend vendor). The suspend
consequence line names the **full refund**, per correction 3 — never a payout
hold.

### `/admin/customers/[id]`

Bookings → Reviews (written · received, tabbed in one card) → Notifications
sent. Notifications carry **two** status columns and they are not the same
thing: Delivered/Bounced is the delivery outcome (sage/red), Read/Unread is
state (steel/stone).

### `/admin/bookings/[id]`

**One card, not five.** The money story reads top to bottom in event order:
total → platform fee → vendor payout → `paid_at` → `payout_released_at` →
payout attempts each with its failure reason (red) → refund amount →
cancellation reason → `cancelled_by` → dispute reason. Rows that don't apply
are **omitted, not dashed**, so the card's length is the story's length. Money
right-aligned mono tabular; sub-totals indented.

### `/admin/users/[userId]`

Retained-data counts by category (table) → Legal acceptance (read-only:
version, timestamp, IP). Actions: Export data, then Close account.
**Close account is drawn with its refusal in place** — with a future confirmed
booking the button is disabled and a gold panel above it reads _"Can't close:
1 confirmed booking on 12 Sep 2026. Cancel or complete it first."_ linking the
booking. The 409 is shown as prevention, never as an error after the press.

---

## Pattern C — `/admin/cases/[caseId]`

Three numbered regions, and the numbers are visible. The resolve control is
**last** and reachable only past the evidence: the scroll is half the
safeguard, the copy is the other half.

**1 · The complaint.** Sender with role and id, origin chip
(`support_message` · `chargeback` · `report`), reference and age in the title
line. Message body **in full, never clamped**, on a `stone-50` inset with a
character count beneath.

**2 · The booking it froze.** Right column. Label/value from Pattern B: total,
platform fee, vendor payout (with `· held` in gold), `paid_at`,
`payout_released_at`, `refund_amount_cents`, `cancelled_by`, `dispute_reason`
(red value), chargeback Stripe id (mono, wraps). Below it, the **case-scoped
read of the reported thread** — read-only, scoped to the event date, with a
line saying so. Operators see the messages the case is about, not the
relationship's whole history.

**3 · Resolve.** Clay-edged card. Two positions, side by side, **equal
weight** — not a primary and a secondary. The operator's job is to judge; a
filled clay button on one side would be the product voting.

Each position names its consequence in money before it is pressed:

- **Resolve for the vendor** — "The hold lifts. **$2,314.00** pays out to
  Kessler & Co. on the next sweep, **Tue 8 Sep**. The customer is refunded
  nothing and is told why in writing."
- **Resolve for the customer** — "**$2,600.00** is refunded to the card ending
  4417 and the booking is cancelled. Kessler & Co. receives **$0.00**; the
  **$286.00** platform fee is returned too."

Exact figures, the payout date by name, and **what the other party gets** —
the second question an operator is asked afterwards is always "and what did
the vendor get?"

### ConfirmAction (both positions)

The confirm **restates, it does not summarise**:

- Amount in the title: _"Refund $2,600.00 and cancel this booking?"_
- The counterparty's zero in the body.
- The field that will be written: `cancelled_by = admin`.
- The thing operators get wrong, in a gold panel: _"Refunds settle in 5–10
  days. Stripe's dispute stays open until the bank closes it — refunding does
  not withdraw it."_
- Cancel reads **"Keep the case open"** — it names the state you return to.
  "Cancel" on this screen is a verb about money.

Irreversible from this screen; a resolved case reopens only via a new case on
the same booking. Both positions log to `/admin/activity` before the toast
clears.

## Acceptance

- [ ] Rail is nine rows; badges on Cases and Reviews only
- [ ] Requests is a tab of Bookings, not a rail row
- [ ] Expired is stone; red appears only on failure
- [ ] Activity has no checkbox and no overflow column
- [ ] Cases defaults to open, oldest first
- [ ] Every filtered-empty offers per-filter widenings **with counts**, and
      never offers a zero-count route
- [ ] No detail value truncates; long ids wrap
- [ ] No destructive control sits inside a read-only card
- [ ] Booking money card omits inapplicable rows rather than dashing them
- [ ] Close account refuses before the press, not after
- [ ] Both resolve positions state a figure and the other party's figure
- [ ] Both confirms name `cancelled_by` / payout sweep date explicitly
