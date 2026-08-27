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
│ │ badge · 412 vendors in Austin      │  photo cluster      │ │
│ │ H1 54px Instrument Serif           │  3 overlapping      │ │
│ │ sub-line 16px stone-700 max-450    │  cards, rotated     │ │
│ │ [ search bar, rounded-full ]       │  −4° / +3° / +2°    │ │
│ │ Popular: Florals · Taco carts ·    │  + floating vendor  │ │
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

## Search bar

The hero's centrepiece. `bg-stone-0 rounded-full shadow-lg`, 7px padding with a
24px left inset. Three segments — What (1.25fr) / Where (1fr) / When (0.8fr) —
divided by 1px × 32px `stone-300` rules, then a `clay-400` pill button.
Each segment: uppercase micro-label over a 15px value. Empty state shows "Add a
date" in `stone-600`, never a greyed-out placeholder that reads as disabled.

Values carry into `/search` as URL params.

## Photo cluster

Three placeholder cards at 236×292 (−4°), 254×316 (+3°), 188×150 (+2°), shadows
increasing with elevation, plus a floating vendor chip (avatar + name + "★ 4.9 ·
replies in 2h"). This is the proof that real vendors exist and it is what fills
the width — it is not decoration, so it ships with real vendor work at launch.

## Category row

Six cards — the first six by `displayOrder`, which doubles as landing priority.
The full eleven live on search, where a category is a filter you can click.

Card: `bg-stone-0 rounded-xl p-3.5`; a 36px `clay-100` circle holding the
category's lucide glyph in `clay-500`; name in Instrument Serif 17px; then a
plain description of what the category covers in 11.5px `stone-600` — "Photo &
film", "DJs, bands, hosts", "Hair & makeup".

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
- [ ] Category row's top edge visible in the first 836px
- [ ] Total document height ≤ 4 viewports
- [ ] Hero is two columns at ≥1024; the cluster never stacks above that
- [ ] **No number on this page that isn't read from the database** — and in MVP that means no platform stats at all
- [ ] Category cards describe the category; they do not count vendors

## Post-MVP

- Vendor-count badge scoped to the visitor's city
- Category counts and from-prices, computed per city
- A stats band (events booked · average rating · median reply)
- City picker in the hero once there's more than one live market

All gated on the condition in `98-post-mvp.md`.
