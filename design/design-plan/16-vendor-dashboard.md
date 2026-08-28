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
Beside it, the reply-time nudge: "Median reply time 2h · keep it under 4h to stay ranked."

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

## Post-MVP

- **Reply-time ranking must exist before the "keep it under 4h to stay ranked" line ships.** Either build the signal or soften the copy to a plain nudge — see `99-open-questions.md` #2
- Earnings trend chart and payout history
- Benchmark comparisons ("vendors like you reply in 3h") — needs a cohort to compare against
- Calendar sync (Google / iCal)
