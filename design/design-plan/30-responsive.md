# 30 — Responsive adaptation

The desktop composition is the design. These are adaptations — they must work,
they must not break, and they never dictate the desktop layout.

| Viewport                | Size           | Role                                                                                             |
| ----------------------- | -------------- | ------------------------------------------------------------------------------------------------ |
| Large desktop           | 1728 × 1080    | Gains **density** — columns and rail width, not margins                                          |
| **Desktop — reference** | **1440 × 900** | Every spec in this folder describes this                                                         |
| Laptop                  | 1280 × 800     | Narrowest full-desktop layout: rails and panes still present                                     |
| **Small laptop**        | **1024 × 640** | **A standard design viewport, drawn in section 27.** Height is the binding constraint, not width |
| Tablet                  | 768 × 1024     | Rails become drawers; master–detail becomes navigation                                           |
| Mobile                  | 390 × 844      | Single column, bottom sheets, back-arrow navigation                                              |

## Degradation table

| Screen                | 1440 (design target)                                 | 1280                                | 1024                                                                                                                                     | 768                                                                                                                     | 390                                                                                                        |
| --------------------- | ---------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Header                | Full nav, never hides                                | Same                                | Full nav, labels intact; the query bar sits in the header and must still fit its three inputs in full                                    | **Nav stays in the bar, no hamburger on landing** — see the table below                                                 | Hamburger, 56px tall                                                                                       |
| Landing               | Hero 56/44 split                                     | Same                                | **Drawn.** Hero split kept; all **three** photo cards stay _beside_ the headline at 0.73 scale; category row visible at 640              | **Drawn. Two columns, not stacked** — cluster _beside_ the copy at 0.62 with 2 photos, search bar full width below both | Stacked, search becomes a stacked card                                                                     |
| Search                | 3-input query bar + horizontal Refine bar, 4 col     | 3 col                               | **Drawn. 3 col** — 310px cards, 3:2 cover 207px. Refine stays **one row**; Sort is the only right-aligned item                           | Query bar keeps 3 inputs; Refine wraps to 2 rows, 2 col                                                                 | Query bar stacks to a 3-row card; sticky bottom "Filters · 3" + "Sort", 1 col                              |
| Vendor profile        | Identity card + 380px sticky rail, tabs              | Card + 320px rail                   | **Drawn.** Card + **320px** sticky rail — never stacks; cover 280px                                                                      | Card + rail → sticky bottom bar                                                                                         | Card stacks (identity above cover); **rail becomes a sticky bottom bar** with from-price + Request booking |
| Booking request       | Form + 400px rail                                    | Same                                | Rail narrows to **340px**, never stacks                                                                                                  | Rail → summary card above the form                                                                                      | Summary accordion, sticky Continue                                                                         |
| Checkout              | Form + 420px rail                                    | Same                                | **Drawn.** Rail 420 → **340px**; **Due today stays above the fold** — the hard constraint on this screen                                 | Same, narrower                                                                                                          | Summary accordion above, total always visible                                                              |
| Vendor dashboard      | Sidebar + content + 340px rail                       | Rail wraps under content            | **Drawn.** Sidebar stays **220px with labels**; right column 300px, **never wraps**; calendar shows the booking week, not the month grid | Icon rail 72px                                                                                                          | Bottom tab bar; **rail content leads** — requests first, then stats, then checklist                        |
| Customer bookings hub | Sidebar + content + rail                             | Rail wraps under                    | Sidebar **220px with labels**; rail narrows to 340px rather than wrapping                                                                | Icon rail; tabs stay, month groups stack                                                                                | Bottom tabs; month groups stack, tabs become a scrollable row                                              |
| Editor                | 200px nav + fields + 308px preview rail + submit bar | Nav → dots rail, preview rail 280px | Section nav **keeps its labels** — no dots rail, no icon rail; preview rail **280px**                                                    | Nav on top, preview → panel above the fields, 2-col fields                                                              | 1 col, preview panel above the fields, submit bar sticky                                                   |
| Messaging             | 3 panes                                              | 2 panes + context toggle            | 2 panes + context toggle, per `18-messaging.md`                                                                                          | **2 panes 40/60**, context as a collapsible strip under the thread header                                               | List → thread with back arrow; context behind a "Booking ▾" chip                                           |
| Availability          | 3 months + rail                                      | 2 months                            | 2 months, per `19-availability.md`                                                                                                       | 1 month + rail below                                                                                                    | 1 month, swipe, tap to toggle                                                                              |
| Sign up               | Split screen                                         | Split                               | Split                                                                                                                                    | Auth column centred, photo drops                                                                                        | Single column                                                                                              |
| Admin                 | Fixed header, 15 rows                                | ~13 rows                            | ~13 rows                                                                                                                                 | Horizontal scroll                                                                                                       | Card list, not a table                                                                                     |

## Marketing header

The header carries a single sign-up control, and it never degrades: the **Sign
up** pill stays a pill at 390, beside the hamburger, because sign-up is too
important to bury in a drawer. The vendor path travels with "For vendors" in the
nav, so it degrades into the drawer with the rest of the nav.

**Corrected 2026-08-30 (#304).** Two rows of the degradation table above were
corrected in the same pass and for the same reason: `14 Landing tablet` had not
been read against them. Header/768 said "Hamburger → drawer" and Landing/768
said "Stacked, cluster → 2 photos"; the frame draws the nav in the bar with no
hamburger, and a two-column hero with the cluster beside the copy. A ticket
reading the stale rows would have re-stacked 768 and put the hamburger back.

This table used to put 768 and 390 in one column, sending the whole nav and `Sign in` to the drawer at both. Frame
`14 Landing tablet` draws neither: at 768 the signed-out landing bar carries
**two** nav links, `Sign in` and `Sign up`, and **no hamburger at all**. 768 is a
width with room for navigation; 390 is not.

| Control           | 1440 · 1280 | 1024       | 768                    | 390                           |
| ----------------- | ----------- | ---------- | ---------------------- | ----------------------------- |
| Browse            | In the bar  | In the bar | In the bar             | Drawer                        |
| How it works      | In the bar  | In the bar | **Drawer** — see below | Drawer                        |
| For vendors       | In the bar  | In the bar | In the bar             | Drawer                        |
| **Sign in**       | In the bar  | In the bar | **In the bar**         | Drawer                        |
| **Sign up** (ink) | In the bar  | In the bar | In the bar             | **Stays in the bar**, compact |

`How it works` is the one link 768 sheds, and it is the right one: it is an
in-page anchor, so what a visitor loses is a scroll shortcut rather than a
destination. The drawer below 768 still carries all three.

**The hamburger is per screen, not per width.** `14 Search tablet` _does_ draw one
at 768 — that frame is signed in and fills the nav space with the search bar, so
it has nowhere to put links. `14 Landing tablet` has the room and draws none.
A single global breakpoint contradicts one of the two frames whichever way it is
set, which is exactly the bug #304 found: the nav hid its links at `max-[768px]`
while the trigger appeared at `min-[769px]`, so 768 — the one width both frames
are drawn at — rendered every link _and_ a hamburger whose drawer duplicated
them.

## Vendor cards below the fold at 768

The **featured vendor row** on the landing page and any other secondary vendor
grid drops its **cover image at 768**, keeping name, rating, location and
from-price. At two columns the 3:2 cover is roughly 260px tall, so four cards
become two tall rows of photography stacked under the search — which reads as
the page's subject rather than as a supporting row, and pushes the real content
down.

This applies to the **vendor** cards only. The landing **category** cards keep
their photographs at every width: their image _is_ the content, and they are
already sized for it (94px, not 3:2).

## Rules that survive every width

- The primary action stays reachable. On mobile that means a **sticky bottom bar**, not a button pushed below a scroll.
- Touch targets ≥ 44 × 44 at 768 and 390.
- No horizontal overflow at any width.
- Images keep their aspect ratios.
- Hover states are pointer-only.
- A rail that becomes a drawer keeps its content and its order — it is not an excuse to drop information.
- Bottom sheets on mobile, centred modals above it.
- **1024 renders the desktop composition, not a tablet one.** Sidebars keep their
  labels, right rails narrow (420 → 340px) rather than stacking, and grids lose a
  column before a card loses information. A sidebar that becomes an icon rail at
  1024, or a rail that wraps under the content, is a bug. The one screen that
  genuinely cannot hold its full desktop composition here is **messaging** — three
  panes do not fit in 1024 — and its collapse is specified in `18-messaging.md`.

## Mobile-specific patterns

**Search** — filters in a bottom sheet, max-height 85vh, drag handle, backdrop
`stone-900/40`. Trigger is a sticky bar showing the active filter count.

**Vendor profile** — the booking rail collapses into a bar: from-price on the
left (Serif 24px), "Request booking" filling the rest. It is always visible.

**Vendor dashboard** — bottom tab bar: Home · Requests · Messages · Calendar.
The publish checklist stays, compressed to the progress bar plus the single
unmet step.

## Adaptation checklist — run only after the desktop review passes

- [ ] No horizontal overflow at 1280 / **1024** / 768 / 390
- [ ] Nothing clipped, overlapped or unreachable
- [ ] Touch targets ≥ 44px
- [ ] Rails and master–detail degrade per the table — not by stacking everything
- [ ] Right pattern for the width (bottom sheet vs modal)
- [ ] Primary action reachable without scrolling on every screen

## The three query inputs survive every width

Vendor type, city and date stay together as one control group at every breakpoint.
At 390 they stack into a three-row card rather than collapsing into the filter
sheet — they are the query, not a refinement, and the vendor-type select is the
single most important control on the page.

The **Refine bar** is what collapses: at 390 its chips move into a bottom sheet
behind a "Filters · 3" trigger. The query never joins them, and the date never
appears there at any width.

There is no 280px filter rail at any width — it was deleted from the desktop
composition, so there is nothing for the narrower widths to degrade.

## Card covers (added)

Vendor-card covers declare **`aspect-ratio: 3/2`**, never a fixed height. A
fixed height against a fluid card width crops the same vendor's photo
differently at every breakpoint, which vendors cannot design their cover
against; 3:2 is also the native ratio of essentially every camera, so an
uploaded portfolio image needs no re-crop. The upload screen should show a 3:2
crop frame with the card's safe area marked.

Consequence to respect: a full-width mobile card's cover is ~245px on a 390pt
screen, so **any pane with a fixed bottom action bar needs bottom padding equal
to the bar's height** (76px on the mobile search screen) or the last card's
price row lands underneath it.

## Landing hero imagery

The rule is **beside, or not at all** — the hero cluster is a composition only
while it sits next to the headline. The moment it falls _under_ the headline it
becomes two or three more screens of vertical scroll ahead of the search bar,
which is the one thing the landing page exists to reach.

Within that, a second rule decides _how many_ cards survive:

> **No hero card below ~140px on its short edge.** Drop cards until the
> survivors clear the floor; when none can, drop the cluster.

A photograph smaller than that is texture, not content — you cannot read a face,
a tablescape or a dance floor at 85px tall, so it stops doing the cluster's only
job (_real people, real work_) while still costing its full height in scroll.

| Width   | Hero cluster        | Why                                                   |
| ------- | ------------------- | ----------------------------------------------------- |
| 1440    | 3 cards, full scale | all clear the floor                                   |
| 1024    | 3 cards at 0.73     | smallest is 137×110 — at the floor                    |
| **768** | **2 cards at 0.62** | a third would be 105×85 — below the floor, so it goes |
| 390     | **removed**         | nothing left to sit beside                            |

The floor derives the count per width automatically, instead of the count being
re-decided per breakpoint.

At 768 the search bar moves _below_ the split so it can run the full frame width,
and categories go three across in two rows. At 390 the page leads with headline,
sub-line, search, then a 2×2 category grid.

## 1024 — small laptop (added, real breakpoint)

Frames live in section 27 of `Orla - Screens.dc.html` at **1024 × 640** — a 13"
laptop's usable area once browser chrome is subtracted. **Height is the binding
constraint at this width, not width**, which is why it earns its own rules rather
than inheriting a squeezed 1440.

### Rules

| Element      | At 1024                                                       |
| ------------ | ------------------------------------------------------------- |
| Page padding | 40 → 24–28px                                                  |
| Sidebars     | stay 220px **with labels** — no icon rail                     |
| Right rails  | narrow 420 → **340px**, never stack                           |
| Grids        | lose a column before a card loses information (results 4 → 3) |
| Hero cluster | all three cards stay beside the text, uniform **0.73 scale**  |
| Display type | 54 → 40px; body 15 → 13.5px; nothing below 11px               |

An icon rail was considered and rejected: it returns ~150px of width on screens
whose problem is vertical, and costs label recognition on a product a vendor uses
weekly, not hourly.

### Screens drawn

Only the four that genuinely broke — **landing, search results, checkout, vendor
dashboard** — plus three states (search loading, no results, empty dashboard).
Everything else inherits the 1440 composition with padding reduced; if a screen
is not in section 27, it has no 1024-specific rules.

The drawn frames carry these `data-screen-label`s, which are what a parity check
names:

`27 Landing — 1024` · `27 Search results — 1024` · `27 Checkout — 1024` ·
`27 Vendor dashboard — 1024` · `27 Search — loading · 1024` ·
`27 Search — no results · 1024` · `27 Vendor dashboard — empty · 1024` ·
`27 Vendor profile — 1024`

### Per-screen notes

- **Landing** — all three photo cards kept beside the headline at 0.73 scale:
  236×292 → 172×213, 254×316 → 185×231, 188×150 → 137×110, cluster 392 → 286px,
  rotations unchanged. Cards only fail when they fall _below_ the headline, which
  is why tablet drops to two and mobile drops the cluster entirely. The category
  row is the fold marker: it must be visible at 640.
- **Search** — 3 columns at 14px gaps = 310px cards, 3:2 cover 207px tall. One
  full row plus the next row's top edge shows, which is the scroll affordance.
- **Checkout** — the 340px rail must keep **Due today above the fold**. This is
  the hard constraint on the screen; if anything else has to give, it gives first.
- **Vendor dashboard** — right column 300px and the calendar shows the booking
  week, not the month grid. Three request cards fit; the fourth peeks.

## Mobile landing — imagery split (390)

Two separate decisions, easy to conflate:

- **Hero portraits: removed below 1024.** Beside the headline they are a
  composition; under it they are two more screens of scroll ahead of the search
  bar, which is the one thing that page exists to reach.
- **Category cards: keep their photography at every width.** They are not
  decoration — the image _is_ the category label, and a shape glyph in a 30px
  circle communicates less than the photo it replaced. At 390 the grid is 2×2
  with 74px-tall covers, four categories visible, the rest behind "All 11
  categories".

The room freed by dropping the hero portraits is what pays for the fourth
category card.

## Parity audit — 2026-08-28

Every change from this working session, checked across all 40 frames:

| Change                                                   | 1440                             | 1024             | 768                | 390                |
| -------------------------------------------------------- | -------------------------------- | ---------------- | ------------------ | ------------------ |
| Cover `aspect-ratio: 3/2`                                | ✓                                | ✓                | ✓                  | ✓                  |
| One cover file per vendor (search card = profile header) | ✓                                | ✓                | ✓                  | ✓                  |
| Editor preview on its own `stone-100` surface            | rail, right edge                 | rail, right edge | panel above fields | panel above fields |
| Upload previews at 3:2                                   | ✓                                | n/a              | n/a                | n/a                |
| Category cards carry photography                         | ✓ 6                              | ✓ 6              | ✓ 6                | ✓ 4                |
| Hero portraits present                                   | ✓ 3                              | ✓ 3              | ✓ 2 (size floor)   | removed            |
| Search control                                           | clay "Search" pill               | clay pill        | clay pill          | summary pill       |
| Compact-bar circle carries a glyph                       | ✓                                | ✓                | n/a                | n/a                |
| ~~Avatar overlaps banner, ringed + shadowed~~            | retired — no banner at any width | —                | —                  | —                  |
| Ring loader (no wordmark pulse)                          | ✓                                | —                | —                  | —                  |
| Availability state marks                                 | ✓                                | n/a              | n/a                | n/a                |

Two gaps this audit caught and closed:

- **Upload previews were fixed-height** (104px / 100px) while card covers declare
  3:2. Since portfolio uploads _become_ those covers, the vendor could not see
  the crop they were about to publish. Both upload frames now preview at 3:2.
- **Mobile vendor profile avatar** had the overlap but not the ring shadow or
  explicit stacking context. Both are now moot: **the banner is gone at every
  width** and the avatar never sits on an image — see `12-vendor-profile.md`.
  The ringed-overlap rule in `CHANGE-ORDER-2026-08-28.md` §B2 and
  `-part2.md` § mobile header is **superseded**; do not reinstate it.

### Vendor profile card — one composition, four widths

The profile header is the vendor's search card, unpacked horizontally: identity
left, the 3:2 cover flush to the card's top, right and bottom edges. It narrows
rather than re-laying out — cover 300 → 280 → 268 → full width. **390 is the only
width that stacks**, and it stacks identity _above_ cover so the business still
leads. There is no device-specific cover asset and no second image field.

### Editor preview — always a separate surface

The card preview is never a field. At ≥1024 it is a right-edge rail
(`stone-100`, `stone-300` left border) with an _In search / Your profile_ toggle.
Below 1024 the rail cannot fit, so it becomes a **panel above the fields** on the
same `stone-100` surface, card and toggle side by side. It stays separated from
the form at every width — the reason it moved out of the media row in the first
place was that inline it read as a third input and asserted a business name above
the field where that name is typed.

Closed after the audit: the **768 landing frame now exists** (`14 Landing tablet`).

### Rotated art needs clearance on both axes

Hero cards are rotated 2–4°, which grows their **bounding box** past their width
and height. Authoring a rotated card flush to its container therefore clips it,
or lets it spill under the next sibling.

**Corrected 2026-08-30 (#304).** This section used to claim a 158px-wide card at
3° "gains roughly 30px of horizontal box". That figure is wrong by 3x. The
bounding box of a `w × h` rectangle at angle `θ` is
`w·cos θ + h·sin θ` wide, so the real growth for 158×196 at 3° is
`158·cos3° + 196·sin3° − 158` = **+10.0px** horizontally and
`196·cos3° + 158·sin3° − 196` = **+8.0px** vertically. 30px would need roughly
9°, which no frame draws. Measured against the running page at 768, the two
cards grow +12.3/+9.7 and +10.0/+8.0 — matching the arithmetic, not the claim.

The number mattered: #304's acceptance inherited it and asked for ~30px of
clearance that the frames never had. Read the slack off the frame instead.

Rule: **size the cluster box to the tallest card's
`top + height + rotation slack`, not to `top + height`**, and take the slack from
the frame rather than from a rule of thumb. At 768 the cluster box is 250px for a
196px card at `top:38px` — 16px of authored slack — and the cards stop 18px short
of the 288px column.

Those two numbers _are_ the spec. They leave the rotated edges 12–13px clear on
the inside axes and let card 1 overhang the box by ~2px on the left and card 2 by
~5px on the right, which is intended: the box is `overflow:visible` and the
overhang lands in the 20px column gap, so nothing clips and nothing overlaps.
A blanket "≥16px on every side" would have forced the cluster wider than the
column the frame draws.
