# Orla — the D16/D17 frame corrections (2026-08-30)

Only the files that changed. Everything else in `design-plan/` is unchanged.

**This is the frame half of the D16 and D17 rulings.** Those rulings were taken
on 2026-08-30 and written into `99-open-questions.md` and the screen files the
same day; six of them ended in an edit to `Orla - Screens.dc.html`, which had not
happened yet. It has now. The plan text that read _"the frame is what gets
corrected"_ has been rewritten as fact, and the two places where a screen file
still described the uncorrected frame are fixed.

## Files

| File                                      | What changed                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Orla - Screens.dc.html`                  | Six corrections across frames `01`, `02`, `09`, `16`, `18`, `26` and their 1024 variants. 46 frames, unchanged. |
| `design-plan/01-foundations.md`           | `stone-250 #ECE6DC` minted into the neutral ramp.                                                               |
| `design-plan/03-components.md`            | Card chip row, the densities table, the availability-chip ruling in past tense, the placeholder pair in `26`.   |
| `design-plan/10-landing.md`               | Hero placeholder tone recorded as landed; the three approved strings named; `02` carved out.                    |
| `design-plan/11-search.md`                | Frames now match the no-availability-chip rule.                                                                 |
| `design-plan/12-vendor-profile.md`        | The header chip no longer inherits from the search card — new reasoning, same chip.                             |
| `design-plan/17-vendor-profile-editor.md` | The preview rail mirrors the corrected card at all three widths.                                                |
| `design-plan/19-availability.md`          | The "`stone-250` was never minted" note corrected in place.                                                     |
| `design-plan/31-content-voice.md`         | Hero placeholder strings added to the approved-copy table.                                                      |
| `design-plan/40-states.md`                | The coverless block gets a frame and a token; frame `16`'s CTA recorded as corrected.                           |
| `design-plan/99-open-questions.md`        | New ruling: `stone-250` (D18).                                                                                  |

## The six corrections

| #   | Frames                                    | What changed                                                                                                                                                                                                |
| --- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `02`, `27 Search results — 1024`, `09` ×2 | **Availability chips off every result card**, and off both editor preview cards, which mirror them. The 768/390 search cards never had one.                                                                 |
| 2   | `02` (line 297)                           | **The stone `New` chip stays** on `Wildbloom Films` — it is a joined-recently badge, not an availability state, and now the only chip a search card carries.                                                |
| 3   | `18` ×2 (1722, 1744)                      | The gold `2 dates left` chip becomes the sage **`Free Jun 18`** — the nearby-dates band names a date _other_ than the one searched, which is the one place sage still earns its place on a results surface. |
| 4   | `01` at 1440 / 1024 / 768 / 390           | The hero seeds nothing: **`Any vendor type` · `Anywhere` · `Add a date`**, all three in `stone-600 #6B6459`.                                                                                                |
| 5   | `16`                                      | Recovery CTA **`Browse vendors` → `/search`**, replacing `Go to my bookings`.                                                                                                                               |
| 6   | `26 State library`                        | New two-tile group, **Missing cover photo** — the live `stone-250` block beside the hatch, the hatch marked _never on a public page_.                                                                       |

## Rules a rebuild must not break

1. **A result card carries no availability chip, at any width or density.**
   Surviving a dated filter _is_ the answer; a chip repeating it is a tautology.
   The only chip a search card carries is the stone `New` badge.
2. **Sage survives in exactly two places** — the `03` profile header, and the
   nearby-dates band on `18`. Both name something the visitor did not already ask
   for.
3. **The editor preview mirrors the card.** Whatever comes off the card comes off
   the preview in the same change, at all three widths.
4. **The hero seeds nothing.** No hard-coded city, and no empty value drawn in the
   filled tone. The badge names the market; the fields do not.
5. **The labelled hatch never reaches a public page.** A published vendor with no
   cover gets the `stone-250` block at the cover's exact 3:2 and the card's own
   radius, with nothing inside it.
6. **`stone-250` is the image ground, not the hatch.** The hatch stripes stay
   `stone-200` / `stone-300`.

## What this does **not** change

- **Frame `03`'s sage chip stays.** A profile is not a filtered result. What
  changed is the reason, not the pixel.
- **Frame `02`'s header search bar stays filled** — `Photography`, `Austin, TX`,
  `Sun, Jun 14`. That is a query the visitor ran.
- **The category pill stays**, on the card and in the frames. It was briefly filed
  for removal on 2026-08-30 and that filing was withdrawn the same day —
  **confirmed by the user: the caret goes, the chip does not.** It is a non-goal
  of `#364` and must not be re-filed by a later consolidation.
- **The `▾` disclosure caret is untouched here.** Removing it everywhere is
  `#364`, a user override, and the frames still draw it at every site.
- **No token was retired.** `stone-250` is an addition between `stone-200` and
  `stone-300`; `#E0D8CA` remains unminted.

## Known divergence, to fix in the next drop

Frame `03`'s caption still reads _"The sage `Free Jun 14` chip persists from the
card too"_. The chip persists; the **lineage** no longer does, because the card it
came from has none. `12-vendor-profile.md` overrides that half-sentence and
carries the current reasoning. Nothing else in the caption is wrong.

## Tickets this affects

- **`#357`** — its frame half is done. What remains is the four code sites it
  names: `avatar.tsx:17` `FALLBACK_TONES` → `clay-150`, `vendor-card.tsx:149` and
  `profile-header.tsx:199` → the neutral coverless block (now `stone-250`), and
  `error-screen.tsx:74` → `Browse vendors` / `/search`. Plus the guard test on
  derived durations.
- **`#358`** — unblocked on the frame side: `02` and `18` now draw what it is
  measured against. Removing the sage chip from `vendor-card.tsx` is still code
  work.
- **`#364`** — unaffected. The `▾` carets are still drawn at every site, on all
  four widths.

## Ticket ids renumbered — 2026-08-30

The ids above were shifted **+3** after this change order was written. Lane 322 merged to
`origin/main` while the backlog consolidation was being written, and both sides independently
filed **#354, #355 and #356** for unrelated work. Lane 322's are pushed and keep their ids;
the consolidation's block moved to **#357-#364**. So `#354`->`#357`, `#355`->`#358`,
`#361`->`#364` throughout this file.

Recorded because this file is the fifth surface of that renumber and the only one outside the
tracker and the registry — nothing in git would have flagged it, and left alone it would have
silently repointed at lane 322's tickets.
