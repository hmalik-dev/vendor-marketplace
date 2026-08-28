# 12 — Vendor profile (`/vendors/[slug]`) — **MVP**

**Purpose:** the page where the decision happens. The most important surface in
the product.
**Scroll budget:** ≤ 2.5×. **The booking rail never scrolls out of view.**

## Composition at 1440

```
header 64px
banner — full-bleed, 196px, box-sizing: border-box
┌───────────────── content column ─────────────┬── booking rail 380px ──┐
│ avatar 82px OVERLAPS the banner by 34px      │  From $1,450           │  sticky
│ Business name  Instrument Serif 33px         │  Free on June 14       │
│ ★ 4.9 (127 reviews) · Austin, TX             │  [date] [guests]       │
│ [category] [languages] [style] [+3 more]     │  [package ▾]           │
│   ^ category lives HERE only — never also in │                        │
│     the meta line above                      │                        │
│ ── About | Packages | Portfolio | Reviews |  │  Request booking       │
│    Availability ────────────────────────────  │  Send a message        │
│ tagline (Serif italic 20px)                  │  ───────────────       │
│ bio, max 640px                               │  · payment held        │
│ 4 stat tiles                                 │  · full refund 48h+    │
│ Recent work — 4 thumbnails + See all 34 →    │  · 127 verified        │
└──────────────────────────────────────────────┴────────────────────────┘
```

## Header — the overlap, done the safe way

**The avatar overlaps the banner again**, and frame `03 Vendor profile` is the
spec. An earlier build pulled the avatar up with a negative margin that crossed a
pane's `overflow: hidden` boundary, and the browser sliced the avatar's top edge
along with part of the name. That is why the previous revision flattened it. The
fix was never "no overlap" — it was to keep the overlap **inside one positioned
wrapper containing both the banner and the identity row**, which is exactly what
the frame now does:

| Element      | Value                                                            |
| ------------ | ---------------------------------------------------------------- |
| Banner       | full-bleed, `height: 196px`, `box-sizing: border-box`            |
| Identity row | `margin-top: -34px`, `position: relative`, `z-index: 2`          |
| Avatar       | 82px circle, `4px solid stone-50` ring, `box-sizing: border-box` |

The `z-index: 2` and `position: relative` on the identity row are load-bearing —
they are what lift it above the banner instead of letting a clipping ancestor cut
it. **A negative margin reaching out of a clipping container is still a bug**;
this one does not, because the wrapper contains both.

This also makes desktop consistent with the tablet and mobile treatments, which
already overlapped.

## Tabs, not anchors

At ≥1024 the five tabs **swap the content pane**. Five sections stacked into one
long scroll is a phone pattern and it buries the reviews people came to read.
Active tab: 13.5px / 600 ink with `inset 0 -2px 0 clay-400`. State in `?tab=` so
tabs are shareable and the back button works. Below 1024 they become anchored
sections with a scroll-spy indicator.

## Tab content

**About** — tagline as a Serif italic pull-quote, bio at max 640px, **three** stat
tiles (Experience / Events / Travels) each a `stone-0` 12px-radius card with an
uppercase label over a 22px Serif number, then a 4-up recent-work strip linking
into the portfolio.

All three read from what the vendor entered on their own profile — years in
business, events shot, travel radius — so they're true from the first day a
profile is published. **A "Replies" tile is not**, and is deferred.

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

1. From-price (Serif 36px) with the duration beside it, and the availability line for the searched date in `sage-600`. No reply-time promise here — deferred.
2. Date + Guests on one row; package select below.
3. **Request booking** (primary, full width) then **Send a message** (secondary).
4. "You won't be charged yet — [Vendor] confirms the date first." 11.5px, centred.
5. Three trust lines with sage dots: payment held until the event · full refund at 48h+ · N reviews from verified bookings.

On scroll past the profile header a slim sticky bar appears with the vendor name
and both CTAs, so the action is never off-screen.

## Reply time — deferred post-MVP

Median reply time appeared in the profile meta line, as a stat tile, and on the
hero chip. It requires a history of messages that doesn't exist at launch, and a
vendor's _first_ inquiry would be measured against a number invented for them.

Removed from every customer-facing surface. The vendor's **private dashboard**
keeps its own reply metric — that's their data about themselves, and it starts
empty honestly. **The dashboard's reply-time nudge is omitted from the MVP too** —
reply time now exists on no surface at all. See `16-vendor-dashboard.md` and
`98-post-mvp.md`.

**Unblock:** a vendor has enough answered inquiries for a median to mean
something — roughly ten. Then it returns to the meta line and the rail as a
per-vendor fact, shown only for vendors who have one.

## Acceptance

- [ ] Name, rating, from-price and both CTAs visible without scrolling
- [ ] Banner is 196px, `box-sizing: border-box`
- [ ] Avatar is 82px and overlaps the banner by 34px, with nothing clipped by a pane boundary
- [ ] No reply-time claim on any customer-facing part of this page
- [ ] Three stat tiles, all sourced from vendor-entered profile data
- [ ] Meta line is two segments — rating and location. Category is the chip row's job and appears once on the page
- [ ] Rail sticky through the whole page
- [ ] Tabs swap the pane at ≥1024 and write to the URL
- [ ] Document height ≤ 2.5 viewports on the longest tab

## Post-MVP

- "Similar vendors" strip at the bottom of the profile
- Video in the portfolio lightbox
- Vendor response to a review
- Median reply time in the meta line and booking rail, once a vendor has ~10 answered inquiries
- Note: the vendor's own rating, review count and reply time **stay in MVP** — they're that vendor's facts, not platform marketing, and they're absent until earned rather than faked
