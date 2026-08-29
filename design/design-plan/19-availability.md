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

This is the original five-fill legend. It is superseded by **Cell states —
shape first, colour second** at the foot of this file, which is what ships.

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

**Legend** — every state from the revised table below, rendered as the actual
mark rather than a flat colour chip. Colour is never the only signal: booked
carries a dot, pending a dashed border, blocked a hatch and a strikethrough,
completed a check, today an ink outline.

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

## Cell states — shape first, colour second (revised)

The original legend encoded five states in five fills. Three of them —
booked `clay-100`, pending `gold-50`, blocked `stone-200` — sit within about
two points of luminance of one another: indistinguishable in greyscale, at a
glance, on a dim screen, or to the ~8% of men with red-green deficiency. Colour
was carrying the whole signal and could not.

**Every state now carries a shape as well as a fill. The fill is reinforcement.**

| State                | Fill                                                   | Shape                                                       | Interactive                      |
| -------------------- | ------------------------------------------------------ | ----------------------------------------------------------- | -------------------------------- |
| Available            | `stone-0`, hairline `stone-300`                        | none — absence reads as open once everything else is marked | click / drag to block            |
| Booked — locked      | `clay-100`, ink-clay number                            | **solid clay dot**, centred under the number                | opens the booking                |
| Pending request      | `gold-50`                                              | **1.5px dashed `gold-500` border**                          | opens the request                |
| Blocked by you       | `stone-200` + 45° hatch (`stone-200`/`stone-250`, 3px) | **strikethrough** on the number                             | click to unblock                 |
| Completed            | `sage-50`, `sage-600` number                           | **check glyph**                                             | **yes — opens the past booking** |
| Selecting now        | solid `clay-500`, cream number                         | fill is the signal (unambiguous at full saturation)         | drag continues                   |
| Today                | `stone-0`, 1.5px solid ink border                      | ink outline                                                 | normal for its state             |
| Past, nothing booked | `stone-50`, `stone-400` number                         | none, dimmed                                                | inert                            |

Notes that matter to the build:

- **No ✕ for blocked.** A cross means "close / dismiss" everywhere else in the
  product. Hatch plus strikethrough says "unavailable by choice" without
  borrowing another control's meaning.
- **Dashed = provisional** is the strongest available pairing: gold already means
  "waiting on someone" in the state rules, and dashed borders read as
  not-yet-settled in every calendar people have used.
- **Completed is sage and clickable.** Sage already means "settled". Delivered
  work should not vanish from the vendor's calendar — it is their record, and
  the click opens the past booking. It gets a hover state; other past dates do not.
- The legend renders the **actual marks**, not plain colour chips. A legend of
  flat swatches is the one place the distinction would be invisible.
- The dot and check need vertical room: those cells are `padding: 5px 0 10px`
  against `7px 0` elsewhere, so the number stays optically centred.

The customer-side date picker (section 42) inherits these marks exactly — one
visual language for dates on both sides of the product.
