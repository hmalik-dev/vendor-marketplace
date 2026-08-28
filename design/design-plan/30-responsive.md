# 30 — Responsive adaptation

The desktop composition is the design. These are adaptations — they must work,
they must not break, and they never dictate the desktop layout.

| Viewport                | Size           | Role                                                                                                                          |
| ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Large desktop           | 1728 × 1080    | Gains **density** — columns and rail width, not margins                                                                       |
| **Desktop — reference** | **1440 × 900** | Every spec in this folder describes this                                                                                      |
| Laptop                  | 1280 × 800     | Narrowest full-desktop layout: rails and panes still present                                                                  |
| Small laptop            | 1024 × 768     | **Narrowest width that still renders the desktop composition.** Nothing collapses here that has not already collapsed at 1280 |
| Tablet                  | 768 × 1024     | Rails become drawers; master–detail becomes navigation                                                                        |
| Mobile                  | 390 × 844      | Single column, bottom sheets, back-arrow navigation                                                                           |

## Degradation table

| Screen                | 1440 (design target)                             | 1280                     | 1024                                                                       | 768                                                                       | 390                                                                                 |
| --------------------- | ------------------------------------------------ | ------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Header                | Full nav, never hides                            | Same                     | Full nav; query bar sits in the header and must still fit its three inputs | Hamburger → drawer                                                        | Hamburger, 56px tall                                                                |
| Landing               | Hero 56/44 split                                 | Same                     | Same as 1280                                                               | Stacked, cluster → 2 photos                                               | Stacked, search becomes a stacked card                                              |
| Search                | 3-input query bar + horizontal Refine bar, 4 col | 3 col                    | **3 col.** Refine stays **one row**; Sort is the only right-aligned item   | Query bar keeps 3 inputs; Refine wraps to 2 rows, 2 col                   | Query bar stacks to a 3-row card; sticky bottom "Filters · 3" + "Sort", 1 col       |
| Vendor profile        | Content + 380px sticky rail, tabs                | 340px rail               | 320px rail, still sticky                                                   | Rail → inline card above the tabs                                         | Stacked; **rail becomes a sticky bottom bar** with from-price + Request booking     |
| Booking request       | Form + 400px rail                                | Same                     | Same, narrower rail                                                        | Rail → summary card above the form                                        | Summary accordion, sticky Continue                                                  |
| Checkout              | Form + 420px rail                                | Same                     | Same, narrower rail                                                        | Same, narrower                                                            | Summary accordion above, total always visible                                       |
| Vendor dashboard      | Sidebar + content + 340px rail                   | Rail wraps under content | Rail wraps under content                                                   | Icon rail 72px                                                            | Bottom tab bar; **rail content leads** — requests first, then stats, then checklist |
| Customer bookings hub | Sidebar + content + rail                         | Rail wraps under         | Rail wraps under                                                           | Icon rail; tabs stay, month groups stack                                  | Bottom tabs; month groups stack, tabs become a scrollable row                       |
| Editor                | 200px nav + 2-col grid + submit bar              | Nav → dots rail          | Nav → dots rail                                                            | Nav on top, 2-col fields                                                  | 1 col, submit bar sticky                                                            |
| Messaging             | 3 panes                                          | 2 panes + context toggle | 2 panes + context toggle                                                   | **2 panes 40/60**, context as a collapsible strip under the thread header | List → thread with back arrow; context behind a "Booking ▾" chip                    |
| Availability          | 3 months + rail                                  | 2 months                 | 2 months                                                                   | 1 month + rail below                                                      | 1 month, swipe, tap to toggle                                                       |
| Sign up               | Split screen                                     | Split                    | Split                                                                      | Auth column centred, photo drops                                          | Single column; role cards stack                                                     |
| Admin                 | Fixed header, 15 rows                            | ~13 rows                 | ~13 rows                                                                   | Horizontal scroll                                                         | Card list, not a table                                                              |

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

## 1024 — the width the contract used to skip

1024 was named once, in the marketing-header table, and appeared in no other
row. That omission is why three defects clustered there: **1024 is exactly the
`lg` boundary**, the width at which this app moves the query bar into the header
and switches its grids — so it is the width where the most changes at once, and
the only one no spec described.

The rule is deliberately conservative:

- **1024 renders the desktop composition.** It is 1280 with less room, not a
  half-step toward tablet. Every rail, pane and multi-column grid that exists at
  1280 exists at 1024.
- **Nothing may collapse between 1280 and 1024.** The collapse points are 768
  and 390.
- **A control that gains responsibility at 1024 must fit at 1024.** The query
  bar moves into the header at `lg`; that is precisely where its three inputs
  are most cramped, so the placeholders must render in full — never truncated,
  never overflowing. If they cannot fit, the bar's widths change, not its
  content.
- **A wrapping row wraps for width, never for alignment.** An item pushed right
  with an auto margin must not strand a sibling on a second row that had space
  for it. Right-alignment is the last item's job only when the row has room to
  spare.

Verify every screen at 1024 alongside 1280 / 768 / 390.

## Vendor cards below the fold at 768

The **featured vendor row** on the landing page and any other secondary vendor
grid drops its **cover image at 768**, keeping name, rating, location and
from-price. At two columns the 4:3 cover is roughly 260px tall, so four cards
become two tall rows of photography stacked under the search — which reads as
the page's subject rather than as a supporting row, and pushes the real content
down.

This applies to the **vendor** cards only. The landing **category** cards keep
their photographs at every width: their image _is_ the content, and they are
already sized for it (94px, not 4:3).

## Rules that survive every width

- The primary action stays reachable. On mobile that means a **sticky bottom bar**, not a button pushed below a scroll.
- Touch targets ≥ 44 × 44 at 768 and 390.
- **Nothing collapses between 1280 and 1024.** The collapse points are 768 and 390. A layout that degrades at 1024 is a bug, not an adaptation.
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
