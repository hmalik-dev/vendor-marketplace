# 20 — Customer bookings hub (`/bookings`) — **MVP**

**Purpose:** the customer's standing home for **every vendor booking they ever
make**. Not a single-event planner, and — importantly — **not dependent on an
Event entity, which does not exist in MVP.**

**Shell:** `app-shell`, sidebar + content + 340px rail. No page scroll.

## Two corrections from earlier drafts

**1. It is not one event.** An earlier draft counted down to _the_ wedding and
showed a "Still to book" grid of open categories. A customer may book a
photographer for a wedding in June, a taco cart for a birthday in September, and
a DJ two years out. There is no single event to count down to and no fixed
checklist of categories an event "should" have. **"Still to book" is removed.**

**2. There is no Event object to group by.** A later draft grouped bookings under
named events ("Nandakumar wedding") with an "Event details →" link. **There is no
way to create an event in MVP**, so nothing in this screen may assume one.

## What groups bookings in MVP

**Month, derived from the booking date.** No new entity, no new step for the user:

```
JUNE 2026 ──────────────────────────────── 3 bookings
[ booking ] [ booking ] [ booking ]

SEPTEMBER 2026 ─────────────────────────── 1 booking
[ booking ] [ + Book another vendor ]
```

Group header: uppercase micro-label, a hairline rule filling the width, and the
count right-aligned. Purely presentational — it's a `groupBy(startOfMonth(date))`
over the bookings the user already has.

**Occasion lives on the booking itself.** Each card reads "Photography · Wedding"
— category plus the occasion the customer already typed into the booking request.
It's a free-text field on the booking, not a foreign key. Same for the venue, which
appears in the card's sub-line ("$1,450 paid · Barr Mansion").

This gives the customer the context they need to tell two bookings apart, with
zero new data model.

## Content

**Title:** "Your bookings". Summary: "4 upcoming bookings. Next up is **Kessler &
Co.** in 49 days." The countdown is derived from the nearest booking date.

### Tabs

| Tab          | Contains                                      |
| ------------ | --------------------------------------------- |
| **Upcoming** | Booking date in the future, any status        |
| **History**  | Past: completed, cancelled, declined, expired |
| **All**      | Everything, soonest first                     |

State in `?tab=`. Beside them: **All categories ▾** and **Soonest first ▾**
(these replace the earlier "All events ▾" and "Date ▾"). Counts next to the tab
labels.

**Booking card** — thumbnail, status pill, vendor name (Serif 17px), "Category ·
Occasion", the date in Serif 21px ("Sun, Jun 14" — weekday included), and a sub-line with amount,
state and venue. The date is the largest element because it's what gets scanned.

**"Book another vendor"** — a dashed peer at the end of the last group, linking
into search pre-filled with that month's date and the customer's city. Its
sub-line reads "Search Sept 5 in Austin". An invitation, not a checklist.

## Rail

**Needs you** — clay panel per item with the action inline ("Casa Verde sent a
quote — $3,840 for 120 guests, expires in 3 days" + Review quote / Decline). Gold
panels for softer nudges. Drawn from all bookings.

**Recent messages** — three rows, then "View all".

## Sidebar

My bookings (count, active) · Messages (unread dot) · Saved vendors · My profile.
Bottom card: "Booking for something new? Search by vendor type, city and date —
availability is live." → **Find a vendor**.

**No "My events" item. No "New event" CTA. Nothing links to an event page.**

## Booking detail

Master–detail at ≥1280: 380px list + detail pane, independent scroll, selection in
the URL. Below 1280 they're separate pages. Detail carries the status stepper,
full price breakdown, cancellation policy in plain language, and a link to the thread.

Contextual actions: Quoted → Review quote + Decline · Accepted → Pay now ·
Confirmed → Message + Cancel · Completed → Leave a review.

## Acceptance

- [ ] **No reference to an Event entity anywhere** — no event name as a link, no event page, no "create an event"
- [ ] Grouping is by month and derived from booking dates alone
- [ ] Occasion and venue render from fields on the booking
- [ ] Upcoming / History / All present, counted, URL-addressable
- [ ] Nothing assumes one event, one date, or a fixed set of categories
- [ ] The word "dashboard" appears nowhere in the UI
- [ ] Zero-state shows the sidebar prompt and an empty-state CTA, never a blank pane
- [ ] Group header renders `JUNE 2026` + rule + "3 bookings"
- [ ] Filter controls read "All categories ▾" and "Soonest first ▾"
- [ ] No page scroll

## Post-MVP

- **Events as a real entity** — name a group of bookings, give it a page, a date, a venue and a guest count, and let the customer file bookings into it. The month grouping is the honest stand-in until then, and it stays as the default view afterwards.
- Event templates / suggested categories — needs real pairing data
- Shared events with co-planners and roles
- Budget tracking across a group of bookings

## One shell, one hub — frame `19` is the empty **pane**, not a second screen

Ruled 2026-09-06 (#372). Frames `07` and `19` draw two different shells around
the same hub, and every parity pass since has re-found the disagreement because
nothing recorded which one wins. **Frame `07`'s shell is the record; frame `19`
is stale from the shell outward.**

It is not a close call, because frame `19` contradicts _this file_ in three
places, and this file is the specification the hub was rebuilt from:

| Axis    | Frame `19` draws                                                           | This file (and frame `07`) specifies                                                                         |
| ------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Title   | `My bookings`, with a `Nothing booked yet` sub-line                        | **`Your bookings`** — and `31-content-voice.md` approves that string by name ("Dashboard" → "Your bookings") |
| Tabs    | `All` · `Pending` · `Confirmed` · `Past` — pill filters over **status**    | **`Upcoming` · `History` · `All`**, counted and URL-addressable in `?tab=` — the Tabs table above            |
| Sidebar | `Booking` section label, a `Payments` row, an `Account` / `Settings` block | **My bookings · Messages · Saved vendors · My profile**, plus the "Booking for something new?" card          |

`Payments` compounds it: there is no customer payments surface in MVP, so frame
`19`'s sidebar draws a control that opens nothing — the thing #31 exists to
forbid.

**What frame `19` is still authoritative for is its pane**, and the app already
matches it exactly: the dashed `stone-400` panel at radius 18, the 58×36
two-circle mark, `No bookings yet` at 26px Instrument Serif, the body sentence,
`Find a vendor`, and the `01` / `02` / `03` steps in JetBrains Mono at
`500 10.5px` with `.1em` tracking.

So the hub renders **one shell** and swaps the pane inside it, which is what the
acceptance line above already asks for — _"Zero-state shows the sidebar prompt
and an empty-state CTA, never a blank pane."_ A customer whose first booking
lands does not watch the page's title, tabs and navigation change under them.

**Frame `19`'s shell is corrected by a design pass, not by a ticket.** Until that
drop lands, a parity pass over frame `19` reports the shell as an expected
deviation and compares only the pane.
