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

## Header

Left: logo, then `Browse` · `How it works` · `For vendors`.
Right: **Sign in** (text) · **Sign up** (ink pill).

**One sign-up control, not two.** Both account types are created on `/sign-up`,
whose role cards are the fork — a separate vendor button in the header would
duplicate that decision and make a visitor read two labels to find themselves.
Vendors reach the same screen via `For vendors` in the nav, which deep-links with
the role pre-selected. Full reasoning in `21-sign-up.md`.

At 390 the header keeps a compact **Sign up** pill beside the hamburger — sign-up
is too important to bury in a drawer.

## Search bar — category-first

The hero's centrepiece. `bg-stone-0 rounded-full shadow-lg`, 7px padding with a
24px left inset. Three segments divided by 1px × 32px `stone-300` rules, then a
`clay-400` pill button:

| Segment         | Flex | Control                                                    |
| --------------- | ---- | ---------------------------------------------------------- |
| **Vendor type** | 1.3  | **Select** over the eleven categories, with a ▾ affordance |
| **City**        | 1    | Typeahead over live markets                                |
| **Event date**  | 0.8  | Date picker; "Add a date" in `stone-600` when empty        |

**The first field is a picker, not a text box.** A visitor knows they need a
photographer in Austin on June 14 — they do not know a vendor's name, and asking
them to phrase a query invites "wedding photographer near me cheap" and a bad
result set. Three enumerable values also make the query shareable and cacheable.
Full reasoning in `11-search.md`.

Below the bar: **"Or jump straight to"** with four category pills — the direct
path for someone who only knows the category. They set `?category=` and go.

Values carry into `/search` as URL params.

## Photo cluster

Three placeholder cards at 236×292 (−4°), 254×316 (+3°), 188×150 (+2°), shadows
increasing with elevation. This is the proof that real vendors exist and it is what
fills the width — not decoration, so it ships with real vendor work at launch.

**No floating vendor chip in MVP.** An earlier version overlaid a card showing a
named vendor with a rating and "replies in 2h". All three of those are history the
app doesn't have on day one, and a fabricated one on the hero is the worst possible
placeholder. Deferred — see `98-post-mvp.md`.

## Category row

Six cards — the first six by `displayOrder`, which doubles as landing priority.
The full eleven live on search, where a category is a filter you can click.

Card: `bg-stone-0 rounded-xl overflow-hidden` — no padding on the card itself.
A 94px cover photograph fills the top, edge to edge, under `object-fit:cover`;
an inner `11px 13px 13px` block then holds the name in Instrument Serif 17px
and a plain description of what the category covers in 11.5px `stone-600` —
"Photo & film", "DJs, bands, hosts", "Hair & makeup".

`overflow-hidden` on the card is what makes the radius clip the photograph.
Without it the image corners escape the card.

**These six photographs are the only imagery the platform owns.** Every
vendor-side cover, portfolio item and avatar stays a labelled placeholder,
because that photography arrives from the vendor at publish time. A surface
that "fixes" a hatched vendor placeholder with stock art has broken this rule,
not satisfied it.

This replaced a 36px `clay-100` circle holding the lucide glyph. A photograph
shows what a category is; a glyph only labels it — and the six categories are
the one place the product can afford to show rather than tell.

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
- [ ] Category row's top edge visible in the first 836px
- [ ] Total document height ≤ 4 viewports
- [ ] Hero is two columns at ≥1024; the cluster never stacks above that
- [ ] **No number on this page that isn't read from the database** — and in MVP that means no platform stats at all
- [ ] Category cards describe the category; they do not count vendors
- [ ] Every category card carries its photograph — no glyph circle remains
- [ ] No vendor-side cover, portfolio item or avatar has been given stock art
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
