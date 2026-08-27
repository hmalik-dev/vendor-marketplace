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

## Post-MVP

- Recurring blocks (every Sunday, holidays)
- Two-way calendar sync
- Dynamic pricing suggestions by demand — the "Saturdays are 80% booked" panel needs real market data before it ships; until then either omit it or state only this vendor's own numbers
