# 12 — Vendor profile (`/vendors/[slug]`) — **MVP**

**Purpose:** the page where the decision happens. The most important surface in
the product.
**Scroll budget:** ≤ 2.5×. **The booking rail never scrolls out of view.**

## Composition at 1440 — the card persists as the profile header

```
header 64px
┌───────────────── content column ─────────────┬── booking rail 380px ──┐
│╭─ vendor card ─────────────────────────╮│  From $1,450           │  sticky
││ (MK) Kessler & Co.       ███████████││  Free on June 14       │
││  ★ 4.9 (127) · Austin    █ cover 3:2 █││  [date] [guests]       │
││ [Free Jun 14][cat][style]█ flush to  █││  [package ▾]           │
││ “tagline”                █ 3 edges   █││  Request booking       │
│╰────────────────────────────────────╯│  Send a message        │
│ ── About | Packages | Portfolio | Reviews │  · trust lines         │
│ bio / 3 stat tiles / what's included     │                        │
└────────────────────────────────────────┴────────────────────────┘
shell max-width 1400px, centred — a wider window adds margin, not image height
```

## The card persists

The object a visitor recognises is the **card they tapped in search**, so that is
what the profile opens with — the same card, unpacked horizontally into the page
header. One surface: identity on the left, the cover flush to the card's top,
right and bottom edges. Nothing floats and nothing is stranded; the photograph's
edges _are_ the card's edges. The sage `Free Jun 14` chip persists from the card
too, so the recognisable object arrives intact.

Five directions were tried; four failed:

1. **Full-bleed banner** — asks for a 21:9 master nobody shoots. At 2560px an
   ordinary wedding frame became a slice of waistband with both faces off-screen.
2. **Matted uploads** (`object-fit: contain` on a stone mat) — the crop was
   honest, but letterbox bars around someone's wedding photo read as broken
   layout rather than a frame.
3. **3-up work strip** — better, but it opened the page with pictures. Someone
   landing here wants to know _who this is_ first.
4. **A bare photo beside the identity block** — correct order, but two unrelated
   objects competing at the top of the page, the photo stranded with no edge
   continuity to anything and dead space beside it.

## The cover photo is one asset with two jobs

A vendor uploads **one** cover at 3:2. It is the cover on their **card in search
results** and the cover inside the **card on their profile** — same file, same
crop. That continuity is the reason the ratio is fixed and the reason there is
only one image.

The cover carries **no link, no counter, no gallery affordance**. Every other
photograph lives in the **Portfolio tab**, reached by the tab like any other
section. A "view all" link on the cover invited people out of the page before
they had read who the vendor was, and made the cover look like a gallery entry
rather than the business's face.

3:2 is what every camera produces, so the frame crops almost nothing — a 3:2
upload loses nothing and a 4:3 trims a few percent off the sides. Nothing is
letterboxed and nothing is a band.

| width | card                          | cover                | rail              |
| ----- | ----------------------------- | -------------------- | ----------------- |
| 1440  | horizontal, min-height 200    | 300px flush right    | 380px sticky card |
| 1024  | horizontal, min-height 187    | 280px flush right    | 320px sticky card |
| 768   | horizontal, min-height 179    | 268px flush right    | bottom bar        |
| 390   | stacked: identity above cover | full card width, 3:2 | bottom bar        |

**One setup translates everywhere.** No second cover field, no device-specific
crop, no mobile hero asset. 390 is the only width that stacks, and it stacks
_identity above cover_ so the business still leads — the one place the profile
card deliberately differs from the search card, which puts its cover on top.

**Identity is never on the photograph.** No overlap, no negative margin, nothing
crossing an `overflow: hidden` boundary, and the name never competes with a white
dress for contrast. The old overlapping-avatar treatment is retired at every
width including mobile — do not reintroduce it.

The tagline lives in the card (it is part of who the vendor is), so the About
pane no longer repeats it: bio, three stat tiles, what's included.

## Tabs, not anchors

At ≥768 the five tabs **swap the content pane**. Five sections stacked into one
long scroll is a phone pattern and it buries the reviews people came to read.
Active tab: 13.5px / 600 ink with `inset 0 -2px 0 clay-400`. State in `?tab=` so
tabs are shareable and the back button works. Below 768 they become anchored
sections with a scroll-spy indicator.

**Ruled 2026-08-30 (#291 via #306) — this said `≥1280` and it was wrong. This
unblocks #304.** Two drawn frames contradicted it:

- `27 Vendor profile — 1024` draws **all five tabs**, `About` active with
  `inset 0 -2px 0 #B4552F`, beside a **320px** rail — and its content pane holds
  the About section **only**. Packages, Portfolio, Reviews and Availability are
  not stacked below it. That is tab-swap behaviour, drawn at 1024.
- `27 Vendor profile — 768` draws the same five tabs, same structure, same active
  treatment.

`30-responsive.md` independently requires it: _"1024 renders the desktop
composition, not a tablet one… a rail that wraps under the content is a bug."_
Anchored sections at 1024 would have been the tablet composition on the very
screen that file singles out as desktop.

**The 768 frame's caption says the opposite of its own markup** — _"Tabs become
anchored sections below 1280"_ — and a caption is not spec (`04-laws.md`
precedence: the rendered frame, then this plan, then the caption). The markup
twenty lines below it draws the tab row. Anchored sections survive only at 390,
where there is no room for five tabs and the phone pattern is the right one.

## Tab content

**About** — bio at max 640px, **three** stat tiles (Experience / Events /
Travels) each a `stone-0` 12px-radius card with an uppercase label over a 22px
Serif number, then "What's included" as three sage-dot lines and a
`See all packages →` link into the Packages tab. The tagline is not here — it
lives in the identity block. The old "Recent work" 4-up is removed: the hero's
photo and the Portfolio tab cover it.

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
- [ ] Profile header is one card object — identity and cover share a surface; the cover is flush to the card's edges, never a floating rectangle
- [ ] Exactly one photograph in the header — the cover, 3:2, byte-identical to the vendor's search-card cover — at every breakpoint
- [ ] The cover carries no link, counter or gallery affordance; Portfolio is reached only by its tab
- [ ] Identity (name, rating, location, chips, tagline) reads before the cover at all four widths
- [ ] Avatar and name never sit over an image; nothing clipped by a pane boundary
- [ ] No reply-time claim on any customer-facing part of this page
- [ ] Three stat tiles, all sourced from vendor-entered profile data
- [ ] Meta line is two segments — rating and location. Category is the chip row's job and appears once on the page
- [ ] Rail sticky through the whole page
- [ ] Tabs swap the pane at ≥768 and write to the URL
- [ ] Document height ≤ 2.5 viewports on the longest tab

## Post-MVP

- "Similar vendors" strip at the bottom of the profile
- Video in the portfolio lightbox
- Vendor response to a review
- Median reply time in the meta line and booking rail, once a vendor has ~10 answered inquiries
- Note: the vendor's own rating, review count and reply time **stay in MVP** — they're that vendor's facts, not platform marketing, and they're absent until earned rather than faked
