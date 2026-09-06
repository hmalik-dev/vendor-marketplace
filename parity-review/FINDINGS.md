# Search parity — verified 2026-09-06

Driven in a real browser at **1440×900** against `main` @ `1334c05`, compared to
`design/Orla - Screens.dc.html` frames `02 Search` and `18 Search no results`.

Every row below was re-measured. **5 of the 8 previously-recorded findings are
stale or wrong** and are struck out at the bottom.

---

## Real — worth fixing

| #        | Finding                                                                                                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                  | Screenshot                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **BUG1** | **Vendor-type dropdown does not close on selection.** Value becomes `Photography` but `aria-expanded` stays `true` and all 12 options remain rendered. A programmatic `.click()` _does_ close it, so it is a pointer-event race (refocus reopening the list), not a missing handler.                                                                                                                                          | `aria-expanded: "true"`, 12 options still in DOM after a real mouse click | `BUG1-dropdown-stays-open-after-selecting-photography.png` |
| **F1**   | **Empty-state mark is the wrong glyph.** App draws a 32×32 `lucide-search-x`. Frame `18` draws the Orla twin-ring mark: 62×38, two 38×38 circles offset 24px, one `1.5px solid #D5CEC2`, one `1.5px dashed`.                                                                                                                                                                                                                  | measured in DOM vs frame markup                                           | `F1-F2-no-results-mark-and-missing-alternatives.png`       |
| **F2**   | **Alternatives band is absent.** Frame `18` draws `See all 14 in the region →` plus three 3:2 vendor cards of nearby alternatives ("Free on a nearby date instead"). App shows only the relaxation buttons (`Any price`, `Any rating`, `Clear all`). NOTE: the frame's alternatives are distance-based ("within 100 mi", "41 mi"), and there is no distance filter in MVP — so this needs a **ruling**, not a straight build. | frame text vs rendered `main`                                             | `F1-F2-no-results-mark-and-missing-alternatives.png`       |

## Needs your ruling — app and frame disagree, app may be right

| #      | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Evidence                                                          | Screenshot                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------ |
| **F4** | **`New` is inline text, frame draws a pill.** App renders `New · Austin, TX` as plain meta text _replacing_ the rating for vendors with 0 reviews. Frame `02` draws `New` as a pill — `10.5px/600`, `background #F0EAE1`, `color #4A443C`, `padding 3px 8px`, `radius 5px` — in its own row _beside_ a real rating (`★ 5.0 (17)`). You said you removed `New` intentionally; it is still rendering, just as text rather than a pill. Confirm which you want. | `<p class="mt-0.5 text-meta text-stone-600">New · Austin, TX</p>` | `F4-new-as-inline-text-not-pill.png` |

---

## Stale / wrong — no action

| Previously recorded                                                 | Reality                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~Price chip has no dismiss — inconsistent with rating~~            | **Correct as built.** Frame `02` draws `$500 – $3,200 ▾` (caret) for price and `4★ & up ✕` for rating. The distinction is deliberate and documented in `refine-bar.tsx`: _"a range is a value you adjust, not a filter you tick off."_ Rating and the tag groups get `✕`; price gets the caret. App matches the frame. See `F3-...png`. |
| ~~Count sentence reads `all two filters`~~                          | **Already fixed.** Renders `No photographers match both filters`. Pluralises correctly.                                                                                                                                                                                                                                                 |
| ~~`Clear all` sits in the action row rather than the Refine bar~~   | **Correct as built**, and ruled appropriate. App has `Clear` in the Refine bar (matching frame `02`) _and_ `Clear all` in the relaxation row.                                                                                                                                                                                           |
| ~~Card `New` badge renders as inline meta text rather than a pill~~ | Superseded by **F4** above — same observation, but it needs your ruling rather than a fix.                                                                                                                                                                                                                                              |
| ~~Price presets wrap 3+1 in a 230px panel~~                         | Presets are `Under $1k` / `$1–2k` / `$2–4k` / `$4k+`. Wrap is a consequence of the recorded panel-width ruling; not a defect.                                                                                                                                                                                                           |
| ~~Line-height ~26px vs frame 22/28px~~                              | Could not reproduce as stated. Prose line measures `12.5px / normal`, meta `12px / normal`. The original note was a `--leading-prose` _token_ question, not a screen defect.                                                                                                                                                            |
| ~~Header submit `ring-offset-0`~~                                   | **Deliberate.** Documented in `search-bar.tsx`, tracked under #306/#73. Reported 5 times by successive parity passes. **Do not re-file.**                                                                                                                                                                                               |

---

## Separately verified while here

- **Price filtering works correctly.** `minPriceCents=150000` → 5 vendors, `maxPriceCents=100000` → 4. #403's starting-rate fix is genuine.
- The app's URL params are `minPriceCents` / `maxPriceCents`. `minPrice` / `maxPrice` are _not_ app params and are correctly ignored.
- Vendor cards render real 3:2 covers (335×223), matching the frame.
