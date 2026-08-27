# 10 — Landing (`/`) — **MVP**

**Purpose:** convert a visitor into a searcher. Everything else is secondary.
**Scroll budget:** ≤ 4× — the only narrative scroll in the product.
**Above the fold at 1440 × 900:** headline, sub-line, search bar, and the top of
the category row. A visitor must be able to start searching without scrolling.

## Composition

```
header 64px                                                    bg-stone-0
┌──────────────────────────────────────────────────────────────┐
│ hero — gradient(155deg, stone-50 0%, #F7F0E8 52%, #F2E4D8)   │
│ ┌────────────────── 56% ─────────────┬───── 44% ───────────┐ │
│ │ badge · Now booking in Austin      │  photo cluster      │ │
│ │ H1 54px Instrument Serif           │  3 overlapping      │ │
│ │ sub-line 16px stone-700 max-450    │  cards, rotated     │ │
│ │ [ Vendor type ▾ | City | Date ]    │  −4° / +3° / +2°    │ │
│ │ Or jump straight to · 4 pills      │  cards only         │ │
│ └────────────────────────────────────┴─────────────────────┘ │
│ Browse by category — 6 cards across                          │
└──────────────────────────────────────────────────────────────┘
```

A single `rgba(180,85,47,.06)` circle, 440px, sits behind the cluster at
`right:-130px; top:-110px` inside `overflow:hidden`. One blob per page maximum.

## Copy — final

- **H1:** "Book your vendors" / _"without the back-and-forth."_ — the second line is Instrument Serif italic in `clay-500`.
- **Sub:** "Compare real availability and pricing from vendors near you, send one request, and pay securely once the date is locked in."
- **Badge:** "Now booking in Austin" with a 5px `clay-400` dot. **No vendor count** — see the metrics note below.

The headline names the friction the product removes. It deliberately does **not**
promise meeting anyone — not meeting them is the point.

## Header

Left: logo, then `Browse` · `How it works` · `For vendors`.
Right: **List your services** (text) · 1px divider · **Sign in** (text) ·
**Sign up** (ink pill).

Both account types are reachable from the first screen. The pill is the customer
path because that's the volume; the vendor path is **named** rather than styled
as a peer button — "List your services" says what it does, where a second pill
would ask the visitor to pick a door before they know the building. Both land on
`/sign-up`, whose role cards make the actual fork; the vendor link arrives with
`?role=vendor` pre-selected. Full reasoning in `21-sign-up.md`.

The former single **Join as a vendor** pill is gone: it offered the low-volume
path as the page's only account action and left customers with nothing but
"Sign in".

At 390 the header keeps a compact **Sign up** pill beside the hamburger — sign-up
is too important to bury in a drawer. "List your services" drops out of the bar.

## Search bar — category-first

The hero's centrepiece. `bg-stone-0 rounded-full shadow-lg`, 7px padding with a
24px left inset. Three segments divided by 1px × 32px `stone-300` rules, then a
`clay-400` pill button:

| Segment         | Flex | Label         | Control                                                    |
| --------------- | ---- | ------------- | ---------------------------------------------------------- |
| **Vendor type** | 1.3  | `Vendor type` | **Select** over the eleven categories, with a ▾ affordance |
| **City**        | 1    | `City`        | Typeahead over live markets                                |
| **Event date**  | 0.8  | `Event date`  | Date picker; "Add a date" in `stone-600` when empty        |

Labels are exactly `Vendor type` / `City` / `Event date`. The former
`What` / `Where` / `When` are gone — they described a text box, and the first
field is no longer one.

**The first field is a picker, not a text box.** A visitor knows they need a
photographer in Austin on June 14 — they do not know a vendor's name, and asking
them to phrase a query invites "wedding photographer near me cheap" and a bad
result set. Three enumerable values also make the query shareable and cacheable.
Full reasoning in `11-search.md`.

Below the bar: **"Or jump straight to"** with four category pills — Photography,
Florals, Catering, Entertainment. `stone-0` fill, 1px `stone-300` border,
`rounded-full`, 12.5px / 600 ink, 6px × 12px padding. They set `?category=` and
go. This replaces the old "Popular: Florals · Taco carts · Live bands"
underlined-link row, which pointed at free-text queries that no longer exist.

Values carry into `/search` as URL params.

## Photo cluster

Three placeholder cards at 236×292 (−4°), 254×316 (+3°), 188×150 (+2°), shadows
increasing with elevation. This is the proof that real vendors exist and it is
what fills the width — it is not decoration, so it ships with real vendor work
at launch.

**No floating vendor chip in MVP.** An earlier version overlaid a card showing a
named vendor with a rating and "replies in 2h". All three are history the app
doesn't have on day one, and a fabricated one in the most prominent position on
the site is the worst possible placeholder. Deferred — see `98-post-mvp.md`.

## Category row

Six cards — the first six by `displayOrder`, which doubles as landing priority.
The full eleven live on search, where a category is a value the select carries.

Card: `bg-stone-0 rounded-xl p-3.5`; a 36px `clay-100` circle holding the
category's lucide glyph in `clay-500`; name in Instrument Serif 17px; then a
plain description of what the category covers in 11.5px `stone-600` — "Photo &
film", "DJs, bands, hosts", "Food, bar, carts", "Halls & outdoor", "Bouquets &
decor", "Hair & makeup".

**Not a vendor count and not a from-price.** Both are deferred (below).

Category names are one word. A two-word name means it's really two categories.

## Below the fold

1. **Featured vendors** — 4 vendor cards + "View all vendors →" ghost link.
2. **How it works** — 3 steps on `stone-100`, full-bleed. Large Serif numerals in `clay-200`, heading, one line each: Discover / Book / Celebrate.
3. **Trust** — 3 signals with sage glyphs: reviews only from bookings that actually happened · payment held until the event · no service fee. This section does the work the stats band would have done.
4. **Split CTA** — full-bleed `stone-900`; left for customers, right for vendors.
5. **Footer** — `stone-900`, cream text, 4 columns, logo, "Made for the people who make the day."

## Metrics — deferred post-MVP

No platform statistics anywhere on this page: no vendor count, no "events
booked", no average rating, no median reply time. There is **no stats band** in
the MVP page — the trust section replaces it.

The hero's photo cluster and the trust signals carry the proof instead. See
`98-post-mvp.md` for the unblock condition and exactly what returns.

## Acceptance

- [ ] Search bar fully visible at 1440 × 900 without scrolling
- [ ] Vendor type is a select over categories — no free-text query field on this page
- [ ] Segment labels read exactly `Vendor type`, `City`, `Event date`
- [ ] "Or jump straight to" + four category pills; no "Popular:" link row
- [ ] Category row's top edge visible in the first 836px
- [ ] Total document height ≤ 4 viewports
- [ ] Hero is two columns at ≥1024; the cluster never stacks above that
- [ ] **No number on this page that isn't read from the database** — and in MVP that means no platform stats at all
- [ ] Category cards describe the category; they do not count vendors
- [ ] Both sign-up paths present in the header, customer as the pill
- [ ] No vendor chip, rating or reply-time claim anywhere on the page

## Post-MVP

- Vendor-count badge scoped to the visitor's city
- Category counts and from-prices, computed per city
- A stats band (events booked · average rating · median reply)
- City picker in the hero once there's more than one live market
- Free-text / semantic search as an additional entry point beside the pickers
- The floating vendor chip, once there are real vendors with real ratings to feature

All gated on the condition in `98-post-mvp.md`.
