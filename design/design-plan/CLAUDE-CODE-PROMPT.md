# Revision brief — 2026-08-27

The design project was revised twice on this date. Changes 1–4 are the first
pass; changes 5–7 are the second, which added frame `12b`. This file
is the changelog of record: it names exactly what moved, so a ticket can be
scoped against it without re-diffing the frames.

The screen specs in this folder have already been rewritten to match. Where this
brief and a screen spec disagree, the screen spec is the newer of the two.

## Confirmed diff against the previous frame set

| Frame                      | Changed                     | Spec file                     |
| -------------------------- | --------------------------- | ----------------------------- |
| `01 Landing`               | **yes** (both passes)       | `10-landing.md`               |
| `02 Search & browse`       | **yes**                     | `11-search.md`                |
| `03 Vendor profile`        | **yes** (both passes)       | `12-vendor-profile.md`        |
| `04 Booking request`       | no                          | `13-booking-request.md`       |
| `05 Checkout`              | no                          | `14-checkout.md`              |
| `06 Booking confirmed`     | no                          | `15-confirmed.md`             |
| `07 Customer bookings hub` | **yes**                     | `20-customer-bookings-hub.md` |
| `08 Vendor dashboard`      | no                          | `16-vendor-dashboard.md`      |
| `09 Vendor profile editor` | no                          | `17-vendor-profile-editor.md` |
| `10 Messaging`             | no                          | `18-messaging.md`             |
| `11 Availability`          | no                          | `19-availability.md`          |
| `12 Sign up`               | **yes** (both passes)       | `21-sign-up.md`               |
| `12b Sign up — vendor`     | **new** (second pass)       | `21-sign-up.md`               |
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

## Change 5 — Dual sign-up in the marketing header (frames `01`, `12`)

Specs: `10-landing.md`, `21-sign-up.md`

Both user types need accounts, and only the vendor path had a header CTA.

- Header right side becomes **List your services** (plain text, `stone-700`) · 1px `stone-300` divider · **Sign in** (plain text) · **Sign up** (ink pill, `stone-900`, `rounded-full`).
- Remove the old "Join as a vendor" pill. The pill is now the **customer** path because that is the volume path; the vendor path is a named text link so it is unambiguous which side you are joining.
- **Sign up** → `/sign-up` with no role pre-selected. **List your services** → `/sign-up?role=vendor`.
- On `/sign-up`, read `?role=` and pre-select the matching card. No param leaves both unselected. Do not remove the role cards — they remain the actual fork; the header must not duplicate that decision.
- At 390, keep a compact **Sign up** pill in the bar beside the hamburger. Do not bury sign-up in the drawer.
- Auth walls stay where they are: browsing, searching and viewing profiles are public. Gate exactly two actions — requesting a booking, and publishing a vendor profile.

## Change 6 — Remove reply-time claims and the hero vendor chip (frames `01`, `03`)

Specs: `10-landing.md`, `12-vendor-profile.md`, `98-post-mvp.md`

Both need history the app does not have on day one.

- **Delete the floating vendor chip** from the landing hero. The photo cluster carries the hero alone.
- **Vendor profile:** remove "Replies in ~2h" from the meta line, leaving `★ 4.9 (127 reviews) · Austin, TX`. Do not substitute the category there — it is already the first chip in the row beneath, and one value gets one control. Remove the **Replies** stat tile; the grid goes four → three columns at `max-width: 520px`. Same on the mobile profile.
- **Keep** the vendor's own reply metric on their private dashboard — their data about themselves, and it starts empty honestly. Its "keep it under 4h to stay ranked" line loses the ranking claim, because no such signal exists.

## Change 7 — Role-aware sign-up panel (frames `12`, `12b`)

Spec: `21-sign-up.md`

The right panel pitched the customer regardless of the selected role. It now
swaps with the role selection.

**The form column is identical for both roles — email and password only. Do not
add a business-name or any other profile field to the auth form.** That data
belongs to the profile editor, which is the next step of the vendor flow.
Coupling profile creation to identity creation breaks SSO sign-up (there is no
field to attach it to), complicates the confirm-email round trip, and leaves a
partially-created vendor with no clean state to resume from.

The vendor flow is: **sign up (role + credentials) → profile editor (09/17) →
publish checklist → live.**

**Vendor panel** (`?role=vendor` or the vendor card selected, sage accent):

- Headline, Serif 38px, three lines, last italic in `#D9E2C8`: `Set your prices.` / `Set your dates.` / `*Get booked.*`
- Body: "Inquiries arrive already knowing what you charge and that your date is free — so you spend your evenings working, not writing quotes."
- Three guarantees with pale-sage dots: You publish your own packages and prices · Your calendar decides which dates you're offered · Paid out after the event — no chasing invoices
- Wash: `linear-gradient(200deg, rgba(35,32,28,.12), rgba(40,48,34,.62) 55%, rgba(28,32,24,.86))`
- Selected vendor card: `bg-sage-50`, 2px `sage-400` border, `stone-0` glyph circle. The customer card keeps clay when it is the selected one.
- Swapping is client-side — no page load, and the form column must not shift.

**No fee language on the vendor panel** — no "no fees", no rate, no hint. Vendors
pay something and the model is not decided; the panel describes the payment
mechanism instead. The customer panel's "no service fee on top" is customer-side
truth and must not be mirrored or negated onto the vendor side.

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
- [ ] Header shows both sign-up paths; `/sign-up?role=vendor` pre-selects the vendor card
- [ ] Selecting each role swaps the panel copy, guarantees and accent colour
- [ ] The sign-up form column is identical for both roles — email and password only, no profile fields
- [ ] `grep -rn "no service fee\|no fees\|fee-free" apps/web/src` returns only customer-facing surfaces
- [ ] `grep -rni "replies in\|reply time" apps/web/src` returns nothing outside the vendor's private dashboard
- [ ] Every revised screen passes the five-axis parity gate in `04-laws.md`, **including the literal strings**
