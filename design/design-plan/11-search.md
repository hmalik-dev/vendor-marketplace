# 11 — Search (`/search`) — **MVP**

**Purpose:** the core discovery surface. Filtering is the primary activity, so
the filters are never behind a button at desktop.
**Shell:** `app-shell` — the page does not scroll. Rail and results scroll independently.

## Composition at 1440

```
header 64px — logo + compact search bar (inherits landing values) + account
┌── filter rail 280px ──┬──────────── results pane ──────────────┐
│ Filters   Clear all   │ 24 photographers in Austin   Sort ▾    │  sticky
│ active pills          ├────────────────────────────────────────┤
│ Category  (counts)    │  ┌────┐ ┌────┐ ┌────┐                  │
│ Price range (dual)    │  └────┘ └────┘ └────┘   3 columns      │  scrolls
│ Minimum rating        │  ┌────┐ ┌────┐ ┌────┐                  │
│ Languages       ▾     │                                        │
│ Cultural        ▾     │                                        │
│ Dietary         ▾     │                                        │
└───────────────────────┴────────────────────────────────────────┘
```

Grid: 2 columns at 1024–1279, **3 at 1280–1599**, 4 at ≥1600. The rail width is
constant; extra width buys columns.

## Filter rail

`bg-stone-0`, 1px `stone-300` right border. Header row: "Filters" + a
`clay-500` "Clear all" ghost link. Then active filters as removable pills
(`clay-100` / `clay-600`, "✕" affordance).

Each group is collapsible and summarises its state in the header when collapsed
("Category · 1 selected"). Open by default: Category, Price, Rating. Collapsed
by default: Languages, Cultural, Dietary — they're long and rarely used.

- **Category** — checkbox list with live result counts. Checked box: `clay-400` fill, white check, 4px radius.
- **Price** — dual-handle slider, `clay-400` track between handles, handles `stone-0` with a 2px clay ring. Values below.
- **Rating** — three segmented buttons (4★+ / 4.5★+ / Any); selected is `clay-400` filled.
- **Tag groups** — multi-select, options in seed `displayOrder`, never alphabetical.

## Results pane

Sticky header row: count in Instrument Serif 22px ("24 photographers in Austin")
with the date qualifier in `stone-600` beside it, and the sort control right-aligned.
Neither the header nor the rail scrolls.

Cards per `03-components.md`. When a date is in the query, every card carries an
availability chip — that's the answer to the question the user actually asked.

## States

- **Loading:** 6 `VendorCardSkeleton` in the live grid. Never a full-page spinner.
- **Empty:** `SearchX` glyph, "No vendors match your search", the two filters most worth loosening named explicitly ("try widening the price range or clearing the date"), then a fallback row of top-rated vendors in the category.
- **Filtering:** skeletons swap in inside the grid; rail and header stay put.

## Behaviour

Filter state lives in URL params via `nuqs` — shareable, and the back button
works. SWR revalidates; no full page reload.

## Acceptance

- [ ] Page height exactly one viewport; only the two panes scroll
- [ ] Rail, search bar and result count remain fixed while results scroll
- [ ] 3 columns at 1440, 4 at 1600, 2 at 1024
- [ ] Result count sentence names the category, the city, and the date filter
- [ ] Every card is a complete decision unit: photo, name, rating, location, availability, from-price

## Post-MVP

- Saved searches and email alerts for a date + category
- Map view alongside the grid
- "Similar vendors" row on an empty result set (needs behavioural data)
- Facet counts stay in MVP — they're query results, not marketing
