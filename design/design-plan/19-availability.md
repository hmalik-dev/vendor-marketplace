# 19 — Availability (`/availability`) — **MVP**

**Purpose:** let a vendor see and edit a booking horizon without clicking through
months.
**Shell:** `app-shell`. Three months side by side + 300px rail.

## Calendar

Three months across at ≥1280 (two at 1024–1439, one below), which covers a
typical booking horizon with no month navigation. Month name in Serif 18px;
weekday initials in 10px `stone-600`; day cells 12px, 7px vertical padding,
7px radius.

| State             | Cell                                     | Interactive                            |
| ----------------- | ---------------------------------------- | -------------------------------------- |
| Available         | `stone-0`                                | yes — click to block                   |
| Booked            | `clay-100` / `clay-600` bold             | no — locked, tooltip shows the booking |
| Pending request   | `gold-50` / `gold-600`                   | no — resolves when the request does    |
| Blocked by vendor | `stone-200` / `stone-600`, strikethrough | yes — click to clear                   |
| Selecting         | `clay-400` / white                       | drag range                             |
| Out of month      | `stone-500`, no background               | no                                     |

Click toggles; click-and-drag selects a range. Today carries a `clay-400` ring.

## The past is a record, not a setting

The calendar's editable floor is **today**, not tomorrow. A vendor who wakes up
ill blocks the day they are standing in; offering tomorrow while refusing today
fails at the one moment the calendar matters most.

Every date **before** today is read-only and keeps the status it actually had —
`booked`, `blocked`, `available`, `pending`. A past cell is rendered on the inert
token (`stone-500`, the one value allowed to fail AA, and a past date is exactly
what it is reserved for) and names its status in its accessible name followed by
"in the past". It is never blanked: the calendar is the record of what
transpired, and rewriting it would lose the vendor's own history.

A drag that starts before today is an ordinary gesture, so the past days in it
are dropped silently and the rest of the range applies. The API drops them again
on the way in — same rule, both sides — rather than failing the whole request.

Both sides measure "today" from the **server's** calendar day, which is also the
day this page builds its month window and its today-ring from, so the guard and
the grid cannot disagree.

## Rail

**Selected** — the range in Serif ("Jul 17 — 19"), what it currently is, then
"Block these" (primary) and Clear.

**Legend** — all five states with swatches. Colour is never the only signal:
booked cells are bold, blocked cells are struck through.

**This quarter** — booked / blocked / open-Saturdays counts. The last one is in
`clay-600` because it's the number that drives behaviour.

**Market note** — one `stone-150` panel with a real insight ("Saturdays in June
and July are 80% booked across Austin. Yours are worth quoting high."). Real
data or it doesn't ship.

## Acceptance

- [ ] Three months visible at 1440 with no month navigation
- [ ] Booked dates cannot be cleared from this screen
- [ ] Drag-select works across a month boundary
- [ ] Rail counts recompute live as dates are blocked
- [ ] Mobile: one month, swipe between, tap to toggle
- [ ] Today is editable; every earlier date is disabled
- [ ] A past date shows the status it actually had, not an empty cell
- [ ] A range drag spanning today keeps today and drops what precedes it

## Post-MVP

- Recurring blocks (every Sunday, holidays)
- Two-way calendar sync
- Dynamic pricing suggestions by demand — the "Saturdays are 80% booked" panel needs real market data before it ships; until then either omit it or state only this vendor's own numbers
