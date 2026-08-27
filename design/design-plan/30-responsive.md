# 30 — Responsive adaptation

The desktop composition is the design. These are adaptations — they must work,
they must not break, and they never dictate the desktop layout.

| Viewport                | Size           | Role                                                         |
| ----------------------- | -------------- | ------------------------------------------------------------ |
| Large desktop           | 1728 × 1080    | Gains **density** — columns and rail width, not margins      |
| **Desktop — reference** | **1440 × 900** | Every spec in this folder describes this                     |
| Laptop                  | 1280 × 800     | Narrowest full-desktop layout: rails and panes still present |
| Tablet                  | 768 × 1024     | Rails become drawers; master–detail becomes navigation       |
| Mobile                  | 390 × 844      | Single column, bottom sheets, back-arrow navigation          |

## Degradation table

| Screen                | 1440 (design target)                             | 1280                     | 768                                                                       | 390                                                                                 |
| --------------------- | ------------------------------------------------ | ------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Header                | Full nav, never hides                            | Same                     | Hamburger → drawer                                                        | Hamburger, 56px tall                                                                |
| Landing               | Hero 56/44 split                                 | Same                     | Stacked, cluster → 2 photos                                               | Stacked, search becomes a stacked card                                              |
| Search                | 3-input query bar + horizontal Refine bar, 4 col | 3 col                    | Query bar keeps 3 inputs; Refine wraps to 2 rows, 2 col                   | Query bar stacks to a 3-row card; sticky bottom "Filters · 3" + "Sort", 1 col       |
| Vendor profile        | Content + 380px sticky rail, tabs                | 340px rail               | Rail → inline card above the tabs                                         | Stacked; **rail becomes a sticky bottom bar** with from-price + Request booking     |
| Booking request       | Form + 400px rail                                | Same                     | Rail → summary card above the form                                        | Summary accordion, sticky Continue                                                  |
| Checkout              | Form + 420px rail                                | Same                     | Same, narrower                                                            | Summary accordion above, total always visible                                       |
| Vendor dashboard      | Sidebar + content + 340px rail                   | Rail wraps under content | Icon rail 72px                                                            | Bottom tab bar; **rail content leads** — requests first, then stats, then checklist |
| Customer bookings hub | Sidebar + content + rail                         | Rail wraps under         | Icon rail; tabs stay, month groups stack                                  | Bottom tabs; month groups stack, tabs become a scrollable row                       |
| Editor                | 200px nav + 2-col grid + submit bar              | Nav → dots rail          | Nav on top, 2-col fields                                                  | 1 col, submit bar sticky                                                            |
| Messaging             | 3 panes                                          | 2 panes + context toggle | **2 panes 40/60**, context as a collapsible strip under the thread header | List → thread with back arrow; context behind a "Booking ▾" chip                    |
| Availability          | 3 months + rail                                  | 2 months                 | 1 month + rail below                                                      | 1 month, swipe, tap to toggle                                                       |
| Sign up               | Split screen                                     | Split                    | Auth column centred, photo drops                                          | Single column                                                                       |
| Admin                 | Fixed header, 15 rows                            | ~13 rows                 | Horizontal scroll                                                         | Card list, not a table                                                              |

## Rules that survive every width

- The primary action stays reachable. On mobile that means a **sticky bottom bar**, not a button pushed below a scroll.
- Touch targets ≥ 44 × 44 at 768 and 390.
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

- [ ] No horizontal overflow at 1280 / 768 / 390
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
