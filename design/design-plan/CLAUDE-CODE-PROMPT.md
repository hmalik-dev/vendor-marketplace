# Prompt for Claude Code — targeted revision

Paste everything below the line into Claude Code. It scopes the work to four
screens and explicitly protects everything else.

---

I have an existing implementation built from the specs in `design-plan/`. Three
product decisions have changed. **Revise only the four screens listed below.**
Every other screen, component and token is correct as built — do not touch,
refactor, "improve", or reformat anything outside the scope below.

## Read first

- `design-plan/00-README.md` — conventions and the MVP/post-MVP split
- `design-plan/98-post-mvp.md` — what is deliberately deferred and why
- The four screen specs named below (they are already rewritten to match these changes)

Do not read or modify the other screen specs; they are unchanged.

## Change 1 — There is no Event entity (screen 20, `/bookings`)

Spec: `design-plan/20-customer-bookings-hub.md`

An earlier version grouped bookings under named events with an "Event details →"
link, and the sidebar had a "My events" item. **There is no way to create an
event in the product, so nothing may assume one exists.**

- Remove every reference to an Event object: no event name as a group header, no `/events` route, no `/events/[id]`, no "My events" nav item, no "New event" CTA, no event foreign key in the bookings query.
- Group bookings by **month, derived from the booking date** — `groupBy(startOfMonth(booking.eventDate))`. Group header is an uppercase micro-label (`June 2026`), a hairline rule filling the remaining width, and the booking count right-aligned.
- Each booking card's second line is `Category · Occasion` where occasion is the existing `event_type` field on the booking (e.g. "Photography · Wedding").
- Card sub-line carries amount, state and venue: `$1,450 paid · Barr Mansion`. Venue is the existing venue field on the booking.
- Card date line reads `Sun, Jun 14` — weekday included.
- Summary line under the title: "4 upcoming bookings. Next up is **[vendor]** in 49 days." Derived from the nearest future booking.
- Filter controls beside the tabs are **All categories ▾** and **Soonest first ▾** (previously "All events" / "Date").
- Keep the Upcoming / History / All tabs, the rail, and the master–detail booking view exactly as they are.
- Sidebar: `My bookings` (with count, active) · `Messages` · `Saved vendors` · `My profile`. Bottom card: "Booking for something new? Search by vendor type, city and date — availability is live." → **Find a vendor**.

Do not add an events table, migration, or model. If one exists, leave it unused
rather than deleting it, and remove only the UI that depends on it.

## Change 2 — Search is category-first (screens 10 and 11)

Specs: `design-plan/10-landing.md`, `design-plan/11-search.md`

Users search by **vendor type, city and date** — never by vendor name. Replace
the free-text query field on the main path with a category select.

**Landing hero search bar** (`/`):

- Segment 1 label `Vendor type`, flex 1.3, a **select** over the eleven categories in seed `displayOrder`, with a `▾` affordance. It must not accept free text — typing filters the list and a non-match offers the closest categories. Not a text input, not a combobox over vendor names.
- Segment 2 label `City` (was "Where"), typeahead over live markets.
- Segment 3 label `Event date` (was "When"), date picker, "Add a date" in `stone-600` when empty.
- Replace the "Popular: …" underlined-link row with **"Or jump straight to"** plus four category pills (`stone-0` fill, `stone-300` border, `rounded-full`, 12.5px/600). Each sets `?category=` and navigates.

**Search page** (`/search`):

- The header query is **three inputs: Vendor type ▾ | City | Event date**, then a Search button. Vendor type is a **select/combobox over the eleven categories that cannot hold an unrecognised value** — typing filters the list; a non-matching string shows "No matching type" plus the three closest categories; it resolves to a category id or stays empty. Never a free-text query field.
- **Delete the 280px filter rail entirely.** It held a permanent column for controls touched once a session and capped results at 3 across.
- **Do not add a category chip strip.** Category belongs to the header select and nowhere else — three controls for one value was the defect being fixed.
- **Add a horizontal "Refine" bar** below the header, prefixed by a `REFINE` micro-label: dropdown-trigger chips for `$500 – $3,200 ▾`, rating, `Style ▾` (category-specific tags, option set changes with the selected type), `Languages ▾`, `Cultural ▾`, `Dietary ▾`, a `Clear` ghost link, and Sort at the far right.
- **The date must not appear in the Refine bar.** It is a search input; a filter chip for it would be a second control for the same value.
- An active filter is shown by its own chip's filled state and label value — **do not render a separate active-filter pill row**.
- Facet counts move inside each popover, beside the options they belong to.
- Results grid: **4 columns at ≥1440**, 3 at 1280, **3 at 1024**, 5 at ≥1728. Cards compact (`aspect-ratio: 3/2` cover, 12px padding, 19px name) so two full rows fit above the fold — 8 visible.
- Name search is a plain `clay-500` "Search by name" link beside the query bar, opening a name typeahead. Deliberately the smallest affordance on the screen; referral case only.
- URL shape: `?category=photography&city=austin-tx&date=2026-06-14` — all three are ids, not strings. Via `nuqs`.
- Keep the card component, skeletons and empty states as built; only the count changes (8 skeletons).
- URL shape: `?category=photography&city=austin-tx&date=2026-06-14`, via `nuqs`.
- Keep price range, minimum rating, tag groups, result grid, card component and all skeleton/empty states as built.

## Change 3 — Dual sign-up in the marketing header (screens 10, 21)

Specs: `design-plan/10-landing.md`, `design-plan/21-sign-up.md`

Both user types need accounts, and only the vendor path had a header CTA.

- Marketing header right side becomes: **Sign in** (plain text) · **Sign up** (ink pill, `stone-900` fill, `rounded-full`). Remove the old "Join as a vendor" pill.
- **One sign-up control only.** Do not add a vendor-specific header CTA — the role cards on `/sign-up` are the fork, and a second button duplicates that decision.
- **Sign up** → `/sign-up` with no role pre-selected.
- Vendors reach the same screen through `For vendors` in the nav → vendor marketing page → `/sign-up?role=vendor`. Keep `?role=` support as a deep-link optimisation.
- On `/sign-up`, read `?role=` and pre-select the matching card. **No param leaves both unselected — that is the default state and it needs the neutral panel from Change 5.**
- At 390, keep a compact **Sign up** pill in the header beside the hamburger. Do not bury sign-up in the drawer.
- **Auth walls stay where they are:** browsing, searching and viewing profiles are public. Gate exactly two actions — requesting a booking, and publishing a vendor profile. When an anonymous user hits either, send them to `/sign-up` with the role pre-selected and their intent preserved, then return them to where they were.

## Change 4 — Remove reply-time claims and the hero vendor chip (screens 10, 12)

Specs: `design-plan/10-landing.md`, `design-plan/12-vendor-profile.md`, `design-plan/98-post-mvp.md`

Both need history the app doesn't have on day one.

- **Delete the floating vendor chip** from the landing hero (the card overlaying the photo cluster with avatar, "Maya Kessler", "★ 4.9 · replies in 2h"). The photo cluster carries the hero alone.
- **Vendor profile:** remove "Replies in ~2h" from the meta line, leaving two segments — `★ 4.9 (127 reviews) · Austin, TX`. **Do not substitute the category there**; it is already the first chip in the row directly beneath, and one value gets one control. Remove the **Replies** stat tile; the grid goes from four columns to three (Experience / Events / Travels) at `max-width: 520px`. Remove any reply-time promise from the booking rail. Same on the mobile profile.
- **Keep** the vendor's own reply metric on their private dashboard — that's their data about themselves and it starts empty honestly.
- Do not reintroduce reply time as a platform average or as a default for a new profile.

## Change 5 — Role-aware sign-up panel (screen 21)

Spec: `design-plan/21-sign-up.md`

The right panel currently pitches the customer regardless of the selected role.
Make it swap with the role selection. **The form column is identical for both
roles — email and password only. Do not add a business-name or any other profile
field to the auth form**; that data belongs to the profile editor, which is the
next step of the vendor flow. Coupling profile creation to identity creation
breaks SSO and leaves no clean resume state.

**Default panel** (no role chosen — the most common entry, neutral warm-grey wash
`linear-gradient(200deg, rgba(35,32,28,.14), rgba(45,40,32,.62) 55%, rgba(30,28,24,.86))`):

- Headline, three lines, last italic in `#F3C98B`: `Clear prices.` / `Open calendars.` / `*No back-and-forth.*`
- Body: "Event vendors and the people who hire them — with the price and the date settled before anyone picks up the phone."
- Three rows, each prefixed by a 9.5px uppercase 64px-wide label instead of a dot: `BOOKING` (`#F3C98B`) "See what a vendor charges and when they're free" · `VENDING` (`#C4D6A8`) "Publish your prices and own your calendar" · `BOTH` (`rgba(255,253,249,.55)`) "Payment held until the event is complete".
- The per-side labels are load-bearing — do not replace them with generic shared copy.
- In this state both role cards are unselected, **Create my account** is disabled (`stone-200` fill, `stone-500` text) with "Pick one above to continue" beneath it in 11.5px `stone-600`. Email and password stay editable.

**Customer panel** (customer card selected or `?role=customer`, clay accent) — copy as in Change 6 below.

**Vendor panel** (`?role=vendor` or the vendor card selected, sage accent):

- Headline, Serif 38px, three lines, last italic in `#D9E2C8`: `Set your prices.` / `Set your dates.` / `*Get booked.*`
- Body: "Inquiries arrive already knowing what you charge and that your date is free — so you spend your evenings working, not writing quotes."
- Three guarantees with pale-sage (`#C4D6A8`) dots:
  - You publish your own packages and prices
  - Your calendar decides which dates you're offered
  - Paid out after the event — no chasing invoices
- Wash: `linear-gradient(200deg, rgba(35,32,28,.12), rgba(40,48,34,.62) 55%, rgba(28,32,24,.86))`
- Selected vendor card: `bg-sage-50`, 2px `sage-400` border, `stone-0` glyph circle. The customer card keeps clay when it's the selected one.
- Swapping is client-side — no page load, and the form column must not shift.

**Do not put any fee language on the vendor panel** — no "no fees", no rate, no
hint. Vendors pay something and the model isn't decided; the panel describes the
payment mechanism instead. The customer panel's "no service fee on top" line is
customer-side truth and must not be mirrored or negated onto the vendor side.

## Change 6 — Customer sign-up panel copy (screen 21)

Spec: `design-plan/21-sign-up.md`

Copy only. No layout, no styling changes.

- Headline (Serif 38px, three lines, last line italic in `#F3C98B`):
  `See the price.` / `See the open dates.` / `*Then decide.*`
- Body: "Every vendor publishes what they charge and when they're free — before you talk to anyone, and without asking for a quote."
- The three guarantee lines become:
  - Live calendars — if a date shows open, it is
  - Payment held until the event is complete
  - Published prices, and no service fee on top

The premise is published pricing **and** published availability — both halves.
Never use the word "transparent"; demonstrate it instead.

## Out of scope — do not change

Screens 13 (booking request), 14
(checkout), 15 (confirmation), 16 (vendor dashboard), 17 (profile editor), 18
(messaging), 19 (availability), 22 (admin). Design tokens, the logo component,
the brand-name constant, the component library, and all responsive behaviour not
named above.

Screen 12 (vendor profile) is in scope **only** for the reply-time removals in
Change 4 — do not touch its layout, tabs, or booking rail otherwise.

Also unchanged and still correct: **no platform statistics on public pages** (no
vendor counts, no "events booked", no average rating). If you find yourself adding
a number to a public page, stop — see `98-post-mvp.md`.

## Verify before you finish

- [ ] `grep -ri "still to book\|my events\|event details" apps/web/src` returns nothing
- [ ] No route, link or component references an event by id
- [ ] `/bookings` renders month group headers derived from booking dates
- [ ] `/` and `/search` have no free-text query input on the main path
- [ ] `grep -rn "280px\|filter-rail\|FilterRail" apps/web/src/app/search` returns nothing
- [ ] Vendor type is a select that cannot submit an unrecognised value
- [ ] Category is selectable in exactly one control on `/search`; no chip strip exists
- [ ] No date chip in the Refine bar
- [ ] 8 cards visible at 1440 × 900 with none sliced — assert each first- and second-row card's `getBoundingClientRect().bottom <= pane.bottom`
- [ ] Sign-up panel contains no numbers
- [ ] Selecting each role swaps the panel copy, guarantees and accent colour
- [ ] `grep -rn "no service fee\|no fees\|fee-free" apps/web/src` returns only customer-facing surfaces
- [ ] `grep -rn "replies in\|Replies in\|reply time" apps/web/src/app/\(marketing\|vendors\)` returns nothing
- [ ] Header shows both sign-up paths; `/sign-up?role=vendor` pre-selects the vendor card
- [ ] Search, category and profile pages still render fully for a signed-out visitor
- [ ] Requesting a booking while signed out routes to sign-up and returns to the request afterwards
- [ ] `git diff --stat` touches only the bookings page, the two search surfaces, the marketing header, the sign-up screen, the vendor profile's meta/stat block, and their tests
