# 16 — Vendor dashboard (`/dashboard`, vendor role) — **MVP**

**Purpose:** the vendor's command centre. Incoming requests come first because a
slow reply is the only thing that loses them work.
**Shell:** `app-shell`, no page scroll. Sidebar 240px + content + 340px rail.

## Header

Logo with a `sage-50` "Vendor" chip, and "View my public profile" — vendors check
it constantly and hunting for it is a papercut.

## Sidebar

Dashboard · Requests (count as a `clay-400` pill when >0) · Bookings · Messages
(unread dot) · Availability · Packages · Edit profile · Payments.

## Content column

**Title states the number:** "Maya, you have 4 new requests" — not "Dashboard".
**Nothing sits beside it.** See the omission below.

### Reply time is omitted from MVP — a recorded frame deviation

Frame `08 Vendor dashboard` renders **"Median reply time 2h · keep it under 4h to
stay ranked"** beside the title. **Do not build it.** This is the one deliberate
deviation from that frame, and it is recorded here so the parity gate reads it as
correct rather than as drift.

Two independent reasons, either of which is sufficient:

1. **The number does not exist.** Median reply time needs a history of answered
   messages. On day one a vendor has none, so the figure would be invented — and
   it would be invented on the vendor's own dashboard, where they can tell.
2. **The mechanic does not exist.** "to stay ranked" promises that replying faster
   improves search position. There is no ranking signal that reads reply time.
   Shipping the sentence would be a claim the product cannot keep.

**Reply time is now absent from every surface in the MVP** — public and private.
The vendor profile dropped it earlier (`12-vendor-profile.md`); this was the last
place it survived. There is no softened variant: a plain nudge would still need
the median, and the median is the part that does not exist.

**What replaces it: nothing.** The title carries the request count, which is the
number that actually drives the vendor's next action. An empty space beside a
title is not a gap to fill.

`98-post-mvp.md` holds the unblock condition.

**Response rate stays.** It is in the stats row, it is the vendor's own private
metric about themselves, and it starts at zero honestly rather than at an
invented value. It makes no claim about ranking.

**Stats row** — four cards across, never stacked: Bookings this month · Response
rate · Rating · Earnings this month. Serif 30px number over a 10.5px uppercase
label, with a `sage-600` or `stone-600` delta line beneath.

**Requests list** — the working surface. Each row: avatar · name + status pill ·
one line of event facts (type, date, venue, guests, package) · price and expiry ·
then the two actions. The topmost row carries `inset 3px 0 0 clay-400` and a
"Needs you" pill.

Actions are contextual: a package request gets **Accept** + Send quote; a custom
request gets **Send quote** + Ask a question. Accepting from this row must not
require opening the request.

## Rail

**Publish checklist** while unpublished — a progress bar, then six rows with sage
checks or open circles. The unmet row is bold with a `clay-500` "Finish →" link.
Below it, a `gold-50` panel stating the consequence: "You can't take payment
until payouts are connected. It takes about five minutes."

It's a rail and not a banner because the vendor refers back to it while working
on other pages.

Once published, the rail becomes **today's schedule** — a timeline with times and
event names.

## Acceptance

- [ ] Page never scrolls; the requests list scrolls internally
- [ ] Request count in the page title and the sidebar agree
- [ ] Every request row is actionable without navigation
- [ ] Stats are one row at every width ≥1024
- [ ] Checklist state matches the real publish gate exactly
- [ ] **No reply-time figure and no ranking claim anywhere on this screen** — `grep` for "reply", "ranked" and "4h" in the dashboard surface returns nothing
- [ ] Response rate renders from real data and shows an honest zero for a new vendor

## Post-MVP

- **Reply time, in any form** — the median figure and the ranking nudge both return together, and only once a vendor has ~10 answered inquiries _and_ a ranking signal that genuinely reads reply time exists. Until both hold, neither ships. See `98-post-mvp.md`
- Earnings trend chart and payout history
- Benchmark comparisons ("vendors like you reply in 3h") — needs a cohort to compare against
- Calendar sync (Google / iCal)
