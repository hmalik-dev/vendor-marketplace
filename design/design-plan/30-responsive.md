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

| Screen                | 1440 (design target)                             | 1280                     | 1024                                                                                                                                     | 768                                                                       | 390                                                                                 |
| --------------------- | ------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Header                | Full nav, never hides                            | Same                     | Full nav, labels intact; the query bar sits in the header and must still fit its three inputs in full                                    | Hamburger → drawer                                                        | Hamburger, 56px tall                                                                |
| Landing               | Hero 56/44 split                                 | Same                     | **Drawn.** Hero split kept; all **three** photo cards stay _beside_ the headline at 0.73 scale; category row visible at 640              | Hero split kept; cluster scales to **0.65**, still beside the headline    | Stacked; **cluster removed entirely**, search becomes a stacked card                |
| Search                | 3-input query bar + horizontal Refine bar, 4 col | 3 col                    | **Drawn. 3 col** — 310px cards, 3:2 cover 207px. Refine stays **one row**; Sort is the only right-aligned item                           | Query bar keeps 3 inputs; Refine wraps to 2 rows, 2 col                   | Query bar stacks to a 3-row card; sticky bottom "Filters · 3" + "Sort", 1 col       |
| Vendor profile        | Content + 380px sticky rail, tabs                | 340px rail               | Rail narrows to **340px, still sticky — never stacks**                                                                                   | Rail → inline card above the tabs                                         | Stacked; **rail becomes a sticky bottom bar** with from-price + Request booking     |
| Booking request       | Form + 400px rail                                | Same                     | Rail narrows to **340px**, never stacks                                                                                                  | Rail → summary card above the form                                        | Summary accordion, sticky Continue                                                  |
| Checkout              | Form + 420px rail                                | Same                     | **Drawn.** Rail 420 → **340px**; **Due today stays above the fold** — the hard constraint on this screen                                 | Same, narrower                                                            | Summary accordion above, total always visible                                       |
| Vendor dashboard      | Sidebar + content + 340px rail                   | Rail wraps under content | **Drawn.** Sidebar stays **220px with labels**; right column 300px, **never wraps**; calendar shows the booking week, not the month grid | Icon rail 72px                                                            | Bottom tab bar; **rail content leads** — requests first, then stats, then checklist |
| Customer bookings hub | Sidebar + content + rail                         | Rail wraps under         | Sidebar **220px with labels**; rail narrows to 340px rather than wrapping                                                                | Icon rail; tabs stay, month groups stack                                  | Bottom tabs; month groups stack, tabs become a scrollable row                       |
| Editor                | 200px nav + 2-col grid + submit bar              | Nav → dots rail          | Section nav **keeps its labels** — no dots rail, no icon rail                                                                            | Nav on top, 2-col fields                                                  | 1 col, submit bar sticky                                                            |
| Messaging             | 3 panes                                          | 2 panes + context toggle | 2 panes + context toggle, per `18-messaging.md`                                                                                          | **2 panes 40/60**, context as a collapsible strip under the thread header | List → thread with back arrow; context behind a "Booking ▾" chip                    |
| Availability          | 3 months + rail                                  | 2 months                 | 2 months, per `19-availability.md`                                                                                                       | 1 month + rail below                                                      | 1 month, swipe, tap to toggle                                                       |
| Sign up               | Split screen                                     | Split                    | Split                                                                                                                                    | Auth column centred, photo drops                                          | Single column                                                                       |
| Admin                 | Fixed header, 15 rows                            | ~13 rows                 | ~13 rows                                                                                                                                 | Horizontal scroll                                                         | Card list, not a table                                                              |

## Marketing header

The header carries a single sign-up control, and it never degrades: the **Sign
up** pill stays a pill at 390, beside the hamburger, because sign-up is too
important to bury in a drawer. The vendor path travels with "For vendors" in the
nav, so it degrades into the drawer with the rest of the nav.

| Control                             | 1440 · 1280 · 1024 | 768 · 390                     |
| ----------------------------------- | ------------------ | ----------------------------- |
| Browse / How it works / For vendors | In the bar         | Drawer                        |
| **Sign in**                         | In the bar         | Drawer                        |
| **Sign up** (ink)                   | In the bar         | **Stays in the bar**, compact |

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
- **1024 renders the desktop composition, not a tablet one.** Sidebars keep their
  labels, right rails narrow (420 → 340px) rather than stacking, and grids lose a
  column before a card loses information. A sidebar that becomes an icon rail at
  1024, or a rail that wraps under the content, is a bug. The one screen that
  genuinely cannot hold its full desktop composition here is **messaging** — three
  panes do not fit in 1024 — and its collapse is specified in `18-messaging.md`.
- No horizontal overflow at any width.
- Images keep their aspect ratios.
- Hover states are pointer-only.
- A rail that becomes a drawer keeps its content and its order — it is not an excuse to drop information.
- Bottom sheets on mobile, centred modals above it.

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

## Landing hero imagery (added)

The desktop hero's photo cluster — **three** overlapping cards, per
`10-landing.md` — is a composition, and a composition only works beside the
headline. So the rule is binary: **the cluster sits beside the text, or it does
not ship.** It never falls underneath.

That gives one threshold, at 390. The hero keeps its two-column split from 1728
all the way down to **768**, and the cluster scales uniformly at each step
rather than shedding a card:

| Width   | Hero  | Cluster scale | Cluster box |
| ------- | ----- | ------------- | ----------- |
| 1440    | 56/44 | 1.0           | 444 × 392   |
| 1024    | 56/44 | **0.73**      | 324 × 286   |
| 768     | 56/44 | **0.65**      | 289 × 255   |
| **390** | 1 col | **removed**   | —           |

At 390 there is no column to sit beside, so the cluster goes. **Removed means
removed — not reduced to a stacked pair.** Two photographs under the search card
are the same failure as three: a screen of photography between the search the
visitor came for and the categories that let them start. The 390 frame carries
**no hero imagery at all** and reads headline → sub-line → search card →
categories, which puts the first category card's bottom edge at 612px inside the
844 viewport.

**768 is specified here but not yet drawn.** Section 14 has no landing frame at
768, so these numbers are the spec, not a measured frame; a parity check at 768
compares against this table until a frame exists.

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

The seven drawn frames carry these `data-screen-label`s, which are what a parity
check names:

`27 Landing — 1024` · `27 Search results — 1024` · `27 Checkout — 1024` ·
`27 Vendor dashboard — 1024` · `27 Search — loading · 1024` ·
`27 Search — no results · 1024` · `27 Vendor dashboard — empty · 1024`
Everything else inherits the 1440 composition with padding reduced; if a screen
is not in section 27, it has no 1024-specific rules.

### Per-screen notes

- **Landing** — all three photo cards kept beside the headline at 0.73 scale:
  236×292 → 172×213, 254×316 → 185×231, 188×150 → 137×110, cluster 392 → 286px,
  rotations unchanged. Cards only fail when they fall _below_ the headline, which
  is why tablet and mobile drop the cluster entirely rather than shrinking it
  further. The category row is the fold marker: it must be visible at 640.
- **Search** — 3 columns at 14px gaps = 310px cards, 3:2 cover 207px tall. One
  full row plus the next row's top edge shows, which is the scroll affordance.
- **Checkout** — the 340px rail must keep **Due today above the fold**. This is
  the hard constraint on the screen; if anything else has to give, it gives first.
- **Vendor dashboard** — right column 300px and the calendar shows the booking
  week, not the month grid. Three request cards fit; the fourth peeks.
