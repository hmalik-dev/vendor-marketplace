# Revision brief — 2026-08-27

The design project was revised. **Six frames changed; eight did not.** This file
is the changelog of record: it names exactly what moved, so a ticket can be
scoped against it without re-diffing the frames.

The screen specs in this folder have already been rewritten to match. Where this
brief and a screen spec disagree, the screen spec is the newer of the two.

## Confirmed diff against the previous frame set

| Frame                      | Changed                     | Spec file                     |
| -------------------------- | --------------------------- | ----------------------------- |
| `01 Landing`               | **yes**                     | `10-landing.md`               |
| `02 Search & browse`       | **yes**                     | `11-search.md`                |
| `03 Vendor profile`        | **yes**                     | `12-vendor-profile.md`        |
| `04 Booking request`       | no                          | `13-booking-request.md`       |
| `05 Checkout`              | no                          | `14-checkout.md`              |
| `06 Booking confirmed`     | no                          | `15-confirmed.md`             |
| `07 Customer bookings hub` | **yes**                     | `20-customer-bookings-hub.md` |
| `08 Vendor dashboard`      | no                          | `16-vendor-dashboard.md`      |
| `09 Vendor profile editor` | no                          | `17-vendor-profile-editor.md` |
| `10 Messaging`             | no                          | `18-messaging.md`             |
| `11 Availability`          | no                          | `19-availability.md`          |
| `12 Sign up`               | **yes** (copy only)         | `21-sign-up.md`               |
| `13 Admin`                 | no                          | `22-admin.md`                 |
| `14 Adaptations`           | **yes** (follows the above) | `30-responsive.md`            |

Tokens, the logo mark, `BRAND_NAME`, and the component vocabulary are unchanged.

## Change 1 — There is no Event entity (frame `07`, `/bookings`)

Spec: `20-customer-bookings-hub.md`

An earlier version grouped bookings under named events with an "Event details →"
link, and the sidebar had a "My events" item. **There is no way to create an
event in the product, so nothing may assume one exists.**

- Remove every reference to an Event object: no event name as a group header, no `/events` route, no `/events/[id]`, no "My events" nav item, no "New event" CTA, no event foreign key in the bookings query.
- Group bookings by **month, derived from the booking date** — `groupBy(startOfMonth(booking.eventDate))`. Group header is an uppercase micro-label (`JUNE 2026`), a hairline rule filling the remaining width, and the booking count right-aligned ("3 bookings").
- Each booking card's second line is `Category · Occasion`, where occasion is the existing `event_type` field on the booking (e.g. "Photography · Wedding").
- Card sub-line carries amount, state and venue: `$1,450 paid · Barr Mansion`. A pending quote reads `$3,840 quoted · expires in 3d`.
- Card date line reads `Sun, Jun 14` — weekday included.
- Summary line under the title: "4 upcoming bookings. Next up is **[vendor]** in 49 days." Derived from the nearest future booking.
- Filter controls beside the tabs are **All categories ▾** and **Soonest first ▾** (previously "All events" / "Date").
- Sidebar bottom card: "Booking for something new? Search by vendor type, city and date — availability is live." → **Find a vendor**.
- Keep the Upcoming / History / All tabs, the rail, and the master–detail booking view.

Do not add an events table, migration, or model.

## Change 2 — Search is category-first (frames `01` and `02`)

Specs: `10-landing.md`, `11-search.md`

Users search by **vendor type, city and date** — never by vendor name on the main
path.

**Landing hero search bar** (`/`):

- Segment 1 label `Vendor type`, flex 1.3, a **select** over the eleven categories in seed `displayOrder`, with a `▾` affordance. It must not accept free text. Not a text input, not a combobox over vendor names.
- Segment 2 label `City` (was "Where"), typeahead over live markets.
- Segment 3 label `Event date` (was "When"), date picker, "Add a date" in `stone-600` when empty.
- Replace the "Popular: …" underlined-link row with **"Or jump straight to"** plus four category pills — Photography, Florals, Catering, Entertainment (`stone-0` fill, `stone-300` border, `rounded-full`, 12.5px/600). Each sets `?category=` and navigates.

**Search page** (`/search`):

- The header query is **three inputs: Vendor type ▾ | City | Event date**, then a Search button. Vendor type is a select/combobox over the eleven categories that **cannot hold an unrecognised value** — typing filters the list; a non-matching string shows "No matching type" plus the three closest categories; it resolves to a category id or stays empty.
- **Delete the 280px filter rail entirely.**
- **Do not add a category chip strip.** Category belongs to the header select and nowhere else — three controls for one value was the defect being fixed.
- **Add a horizontal "Refine" bar** below the header, prefixed by a `REFINE` micro-label: dropdown-trigger chips for `$500 – $3,200 ▾`, rating, `Style ▾` (category-specific tags, option set changes with the selected type), `Languages ▾`, `Cultural ▾`, `Dietary ▾`, a `Clear` ghost link, and Sort at the far right.
- **The date must not appear in the Refine bar.**
- An active filter is shown by its own chip's filled state and label value — **no separate active-filter pill row**.
- Facet counts move inside each popover, beside the options they belong to.
- Results grid: **4 columns at ≥1440**, 3 at 1280, 2 at 1024, 5 at ≥1728. Cards compact (132px cover, 12px padding, 19px name) so two full rows fit above the fold — 8 visible.
- Count sentence: "24 photographers in Austin · free on Sun, Jun 14", with the positioning line "Prices are what they charge — no quotes needed." beside it.
- Name search is a plain `clay-500` "Search by name" link beside the query bar. Deliberately the smallest affordance on the screen.
- URL shape: `?category=photography&city=austin-tx&date=2026-06-14` — all three are ids, not strings. Via `nuqs`.
- Keep the card component, skeletons and empty states; only the count changes (8 skeletons).

## Change 3 — Vendor profile header (frame `03`)

Spec: `12-vendor-profile.md`

- Cover `190px` → **`150px`**, with `box-sizing: border-box`.
- Avatar `80px` → **`72px`**.
- **The avatar no longer overlaps the cover.** The `margin-top:-32px` is removed; the content column opens with `padding-top:18px` and the identity row is `align-items:center`. The old negative margin crossed a pane's `overflow:hidden` boundary and the browser sliced the avatar's top edge.

## Change 4 — Sign-up marketing panel copy (frame `12`)

Spec: `21-sign-up.md`

Copy only. No layout, no styling changes.

- Headline (Serif 38px, three lines, last line italic in `#F3C98B`):
  `See the price.` / `See the open dates.` / `*Then decide.*`
- Body: "Every vendor publishes what they charge and when they're free — before you talk to anyone, and without asking for a quote."
- The three guarantee lines become:
  - Live calendars — if a date shows open, it is
  - Payment held until the event is complete
  - Published prices, and no service fee on top

Never use the word "transparent"; demonstrate it instead.

## Still correct, do not undo

**No platform statistics on public pages** — no vendor counts, no "events
booked", no average rating. If you find yourself adding a number to a public
page, stop — see `98-post-mvp.md`.

## Verification

- [ ] `grep -ri "still to book\|my events\|event details" apps/web/src` returns nothing
- [ ] No route, link or component references an event by id
- [ ] `/bookings` renders month group headers derived from booking dates
- [ ] `/` and `/search` have no free-text query input on the main path
- [ ] `grep -rn "280px\|filter-rail\|FilterRail" apps/web/src` returns nothing under search
- [ ] Vendor type is a select that cannot submit an unrecognised value
- [ ] Category is selectable in exactly one control on `/search`; no chip strip exists
- [ ] No date chip in the Refine bar
- [ ] 8 cards visible at 1440 × 900 with none sliced — assert each first- and second-row card's `getBoundingClientRect().bottom <= pane.bottom`
- [ ] Vendor-profile cover is 150px and the 72px avatar is fully below it
- [ ] Sign-up panel contains no numbers and matches the new three-line headline
- [ ] Every revised screen passes the five-axis parity gate in `04-laws.md`, **including the literal strings**
