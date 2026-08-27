# 20 — Customer bookings hub (`/bookings`) — **MVP**

**Purpose:** the customer's standing home for **every vendor booking they ever
make**, across any number of events, now and in future. This is not a
single-event planner.

**Shell:** `app-shell`, sidebar + content + 340px rail. No page scroll.

## What changed and why

An earlier draft framed this as a one-event dashboard: a countdown to _the_
wedding and a "Still to book" grid of open categories. That was wrong for this
product. A customer may book a photographer for a wedding this June, a taco cart
for a birthday in September, and a DJ two years from now. There is no single
event to count down to, and there is no fixed checklist of categories an event
"should" have — so **"Still to book" is not a valid concept** and has been removed.

The organising unit is the **event**, and the customer may have many.

## Content

**Title:** "Your bookings". Summary line states the real shape of the account —
"4 bookings across 2 upcoming events. Next up is **Kessler & Co.** in 49 days."
The countdown is to the next _booking_, derived, not to a hardcoded life event.

### Tabs — MVP

| Tab          | Contains                                              |
| ------------ | ----------------------------------------------------- |
| **Upcoming** | Anything with an event date in the future, any status |
| **History**  | Past events: completed, cancelled, declined, expired  |
| **All**      | Everything, newest event first                        |

Tab state in `?tab=`. Beside the tabs, two filter controls: **All events ▾**
(scopes to one event) and **Date ▾** (sort). Counts sit next to the tab labels.

### Grouping

Within a tab, bookings group under their event with a group header:

```
Nandakumar wedding      Sun, June 14 · Barr Mansion · 120 guests   Event details →
[ booking ] [ booking ] [ booking ]

Dad's 60th              Sat, Sept 5 · Home · 40 guests             Event details →
[ booking ] [ + Add a vendor ]
```

Group header: event name in Instrument Serif 19px, facts in 12px `stone-600`, and
a right-aligned link to the event. Three booking cards per row.

**Booking card** — thumbnail, status pill, vendor name (Serif 17px), category,
then the date in Serif 21px with the amount or state beneath. The date is the
largest thing on the card because it's what the customer scans for.

**"Add a vendor" card** — a dashed peer at the end of each event group, linking
into search pre-filtered to that event's date and city. This replaces "Still to
book": it's an invitation, not a checklist, and it never implies the customer has
forgotten something.

An event with no bookings yet still renders its group header and the add card.

## Rail

**Needs you** — clay panel per item, action inline ("Casa Verde sent a quote —
$3,840 for 120 guests, expires in 3 days" + Review quote / Decline). Gold panels
for softer nudges (leave a review). Items are drawn from all events, not one.

**Recent messages** — three rows, then "View all".

## Sidebar

My bookings (active) · My events (count) · Messages (unread dot) · Saved vendors ·
My profile. Bottom card: "Planning something new? Start an event and keep its
vendors, dates and messages together." → **New event**.

## Events — MVP scope

An event is a lightweight container: name, date, location, guest count. Creating
one is optional — a booking made without an event is filed under an
auto-created one named for its date, and can be renamed later. Do not gate
booking behind event creation.

`/events/[id]` shows one event's bookings, dates, and messages. `/events` lists
them.

## Booking detail

Master–detail at ≥1280: 380px list + detail pane, independent scroll, selection
in the URL. Below 1280 they're separate pages. Detail carries the status stepper,
full price breakdown, cancellation policy in plain language, and a link into the
thread.

Contextual actions by status: Quoted → Review quote + Decline · Accepted → Pay
now · Confirmed → Message + Cancel · Completed → Leave a review.

## Acceptance

- [ ] Nothing in the UI assumes one event, one date, or a fixed set of categories
- [ ] Upcoming / History / All present, counted, and URL-addressable
- [ ] Bookings visibly grouped by event; group header names the event
- [ ] "Add a vendor" routes to search pre-filtered to that event's date and city
- [ ] The word "dashboard" appears nowhere in the UI — this is "Your bookings"
- [ ] Zero-state renders the sidebar prompt and an empty-state CTA, never a blank pane
- [ ] No page scroll

## Post-MVP

- **Event templates / suggested categories.** Once there's booking data showing what people actually pair, a per-event-type suggestion row becomes honest. Until then it would be guesswork dressed as guidance.
- **Shared events** — co-planners on one event, with roles.
- **Budget tracking across an event's bookings.**
