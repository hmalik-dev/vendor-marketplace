# 12 — Vendor profile (`/vendors/[slug]`) — **MVP**

**Purpose:** the page where the decision happens. The most important surface in
the product.
**Scroll budget:** ≤ 2.5×. **The booking rail never scrolls out of view.**

## Composition at 1440

```
header 64px
cover — 21:9, capped at 150px so it cannot eat the fold
┌───────────────── content column ─────────────┬── booking rail 380px ──┐
│ avatar 72px + name, fully BELOW the cover    │  From $1,450           │  sticky
│ Business name  Instrument Serif 33px         │  Free on June 14       │
│ ★ 4.9 (127) · Austin, TX · Replies in ~2h    │  [date] [guests]       │
│ [category] [languages] [style] [+3 more]     │  [package ▾]           │
│ ── About | Packages | Portfolio | Reviews |  │  Request booking       │
│    Availability ────────────────────────────  │  Send a message        │
│ tagline (Serif italic 20px)                  │  ───────────────       │
│ bio, max 640px                               │  · payment held        │
│ 4 stat tiles                                 │  · full refund 48h+    │
│ Recent work — 4 thumbnails + See all 34 →    │  · 127 verified        │
└──────────────────────────────────────────────┴────────────────────────┘
```

## Header — no overlap

**Changed from an earlier draft.** The cover is **150px** (was 190px) and the
avatar is **72px** (was 80px). The avatar and the name sit **below** the cover,
not overlapping it.

The earlier version pulled the avatar up 32px with a negative margin, but that
margin crossed a pane's `overflow: hidden` boundary and the browser sliced the
avatar's top edge along with part of the name. The overlap flourish is not worth
a clipped identity block, and the flat version reads cleaner at this cover height
anyway.

Concretely, per the frame: the cover box is `box-sizing: border-box; height:150px`,
the content column below it opens with `padding-top: 18px`, and the identity row
is `display:flex; gap:16px; align-items:center` with **no negative margin**.

If an overlap is ever wanted back, it has to live **inside** one positioned
wrapper containing both the cover and the identity row — never as a negative
margin reaching out of a clipping container.

## Tabs, not anchors

At ≥1280 the five tabs **swap the content pane**. Five sections stacked into one
long scroll is a phone pattern and it buries the reviews people came to read.
Active tab: 13.5px / 600 ink with `inset 0 -2px 0 clay-400`. State in `?tab=` so
tabs are shareable and the back button works. Below 1280 they become anchored
sections with a scroll-spy indicator.

## Tab content

**About** — tagline as a Serif italic pull-quote, bio at max 640px, four stat
tiles (Experience / Events / Travels / Replies) each a `stone-0` 12px-radius
card with an uppercase label over a 22px Serif number, then a 4-up recent-work
strip linking into the portfolio.

**Packages** — 2 columns. Each card: name (Serif), price (Serif, large),
duration, inclusions as a checklist with `clay-400` checks, and "Select this
package" which pre-fills the booking rail. A 3px left border in `clay-200/300/400`
distinguishes tiers. No packages → "Contact for pricing" plus the message CTA.

**Portfolio** — masonry via CSS columns, 4 at ≥1280. Click opens a lightbox:
`stone-900/90` backdrop, image `max-w-[90vw] max-h-[85vh] object-contain`,
48px circular nav buttons, counter top-left, caption below, arrow keys and Escape.

**Reviews** — overall rating as a large Serif number with gold stars and a
five-bar distribution chart (`clay-400` fill). Review cards: reviewer first name

- initial, star row, date, title, body, event-type badge. "Show more reviews"
  appends; no page numbers. "Write a review" appears only for a user with a
  completed booking with this vendor.

**Availability** — current month + next, side by side. Colour coding matches
screen 19. Clicking a free date pre-fills the rail's date field.

## Booking rail — the page's purpose

`bg-stone-0 rounded-2xl shadow-md`, sticky, 380px. Order is fixed:

1. From-price (Serif 36px) with the duration beside it, and the availability line for the searched date in `sage-600`.
2. Date + Guests on one row; package select below.
3. **Request booking** (primary, full width) then **Send a message** (secondary).
4. "You won't be charged yet — [Vendor] confirms the date first." 11.5px, centred.
5. Three trust lines with sage dots: payment held until the event · full refund at 48h+ · N reviews from verified bookings.

On scroll past the profile header a slim sticky bar appears with the vendor name
and both CTAs, so the action is never off-screen.

## Acceptance

- [ ] Name, rating, from-price and both CTAs visible without scrolling
- [ ] **Cover is 150px tall** and `box-sizing: border-box`
- [ ] **Avatar is 72px and sits entirely below the cover** — no negative margin, no overlap
- [ ] Avatar and name render fully — nothing clipped by the cover or by a pane boundary
- [ ] Rail sticky through the whole page
- [ ] Tabs swap the pane at ≥1280 and write to the URL
- [ ] Document height ≤ 2.5 viewports on the longest tab

## Post-MVP

- "Similar vendors" strip at the bottom of the profile
- Video in the portfolio lightbox
- Vendor response to a review
- Note: the vendor's own rating, review count and reply time **stay in MVP** — they're that vendor's facts, not platform marketing, and they're absent until earned rather than faked
