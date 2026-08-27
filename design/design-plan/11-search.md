# 11 — Search (`/search`) — **MVP**

**Purpose:** the core discovery surface.
**Shell:** `app-shell` — the page does not scroll. The results grid scrolls in its own pane.

## The query is three inputs

```
Vendor type ▾   |   City   |   Event date   |   [ Search ]
```

Nobody arrives knowing a vendor's name — they arrive knowing **what kind of vendor,
where, and when**. Those three values are the entire query, and each is
constrained, so a search can only ever resolve to something the platform
recognises.

| Input           | Control                                      | Normalisation                                                                                                                                                                                                              |
| --------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor type** | Select / combobox over the eleven categories | **Cannot hold an unrecognised value.** Typing filters the list; a non-matching string shows "No matching type" plus the three closest categories. It resolves to a category id or the field stays empty — never free text. |
| **City**        | Typeahead over live markets                  | Resolves to a market id. Unmatched input returns the nearest market plus a "we're not in [city] yet" state.                                                                                                                |
| **Event date**  | Single date picker                           | Optional. When set, every card carries an availability chip.                                                                                                                                                               |

### Why the type field is a select, not a search box

A text query has to guess intent from strings like "wedding photographer near me"
or "someone to do flowers", and it fails silently and differently for each. A
select can't be phrased wrong, it teaches the taxonomy on first use, it makes the
query URL-addressable and cacheable, and it means the result count sentence can
always name the category truthfully.

Free-text search over **vendor names** exists as a separate, deliberately small
affordance — a `clay-500` "Search by name" link beside the bar — for the one real
case: someone was handed a business card or a referral. It is not on the main path.

## One control per value

An earlier draft had category selectable in the header bar, a chip strip, _and_ a
rail checkbox group at once — three controls that could disagree. Now:

| Control               | Owns                                               |
| --------------------- | -------------------------------------------------- |
| **Header search bar** | The query: vendor type, city, date.                |
| **Refine bar**        | Refinement only: price, rating, style, tag groups. |
| **"Search by name"**  | The referral case.                                 |

**Date never appears as a filter chip.** It's a search input; echoing it in Refine
would be a second control for a value the bar already owns.

## Composition at 1440 — no filter rail

```
header 64px — logo | [ Vendor type ▾ | City | Date | Search ] | by name | account
┌───────────────────────────────────────────────────────────────────────┐
│ REFINE  [$500–$3,200 ▾] [4★ & up ✕] [Style ▾] [Languages ▾]           │ sticky
│         [Cultural ▾] [Dietary ▾]  Clear                    Sort ▾     │
├───────────────────────────────────────────────────────────────────────┤
│ 24 photographers in Austin · free on Sun, Jun 14                      │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                          │
│ └────┘ └────┘ └────┘ └────┘   4 columns                               │ scrolls
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                          │
└───────────────────────────────────────────────────────────────────────┘
```

**The 280px filter rail is gone.** It held a permanent column of the viewport for
controls touched once or twice per session, and capped results at three across.
Filters are one horizontal **Refine** bar, which returns the full width to what the
page is for: **8 vendors visible instead of 3**, four across, two full rows with
the third peeking to signal there's more.

This is the one place the "a persistent rail beats a modal" law in `04-laws.md`
yields — a rail earns its width when its contents are referenced _while_ working in
the main pane (the booking rail, the vendor checklist, the messaging context).
Search filters aren't: you set them, then you read results.

Grid: 2 columns at 1024–1279, 3 at 1280–1439, **4 at ≥1440**, 5 at ≥1728.

## Refine bar

One row, wrapping to two if needed, prefixed by a `REFINE` micro-label so it
reads as secondary to the query above it. Each chip is a dropdown trigger:

| Chip                                   | Behaviour                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `$500 – $3,200 ▾`                      | Dual-handle range popover; the label carries the live range                                      |
| `4★ & up ✕`                            | Active state — `clay-100` fill, `clay-600` text, `✕` clears                                      |
| `Style ▾`                              | Category-specific tags (documentary, editorial…) — the option set changes with the selected type |
| `Languages ▾` `Cultural ▾` `Dietary ▾` | Multi-select popovers, options in seed `displayOrder`                                            |
| `Clear`                                | Ghost link, only when a filter is set                                                            |

Sort sits at the far right of the same row. **An active filter is shown by its own
chip** (filled state + value in the label), so there's no separate active-pill row —
that was a second representation of one state. Facet counts live inside each
popover beside their options.

## Results

Count sentence names category, city and date. Beside it, one quiet positioning
line: "Prices are what they charge — no quotes needed."

Cards per `03-components.md` at the compact end: 132px cover, 12px padding, one
availability chip, name at 19px.

## States

- **Loading:** 8 `VendorCardSkeleton` in the live grid; bar and Refine row stay put.
- **Empty:** `SearchX` glyph, "No vendors match your search", the two filters most worth loosening named explicitly, then a fallback row from the same category with the date dropped — an empty result on a date is usually a date problem.
- **No market:** "We're not in Tulsa yet" plus email capture.

## Behaviour

`?category=photography&city=austin-tx&date=2026-06-14` via `nuqs`. All three are
ids, not strings. Shareable, back button works, SWR revalidates.

## Acceptance

- [ ] Three query inputs: vendor type, city, date — no more, no fewer
- [ ] **Vendor type cannot hold an unrecognised value** — it resolves to a category id or stays empty
- [ ] Category is selectable in exactly one control
- [ ] Date does not appear in the Refine bar
- [ ] No filter rail; filters are a horizontal bar
- [ ] 8 cards visible at 1440 × 900 with none sliced — assert each first- and second-row card's `getBoundingClientRect().bottom <= pane.bottom`
- [ ] Name search present as the smallest affordance on the screen
- [ ] No separate active-filter pill row
- [ ] Page height exactly one viewport; only the results grid scrolls
- [ ] 4 columns at 1440, 3 at 1280, 2 at 1024

## Post-MVP

- Saved searches and email alerts for a type + city + date
- Map view alongside the grid
- Semantic search as an _additional_ entry point once there's enough profile text to index — never replacing the select
- "Similar vendors" on an empty result set — needs behavioural data
