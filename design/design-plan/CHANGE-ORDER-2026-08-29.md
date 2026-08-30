# Orla — vendor cover rework (2026-08-29)

Only the files that changed. Everything else in `design-plan/` is unchanged.

## Files

| File                                      | What changed                                                                                                      |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `Orla - Screens.dc.html`                  | Full screens document, regrouped: one section per screen with its 1024 / 768 / 390 views side by side. 46 frames. |
| `design-plan/12-vendor-profile.md`        | Vendor profile respec'd — card-persistence header, one 3:2 cover, four widths.                                    |
| `design-plan/17-vendor-profile-editor.md` | Cover field respec'd; new 308px preview rail and its sub-1024 collapse.                                           |
| `design-plan/30-responsive.md`            | Vendor-profile and editor rows corrected; banner parity row retired; two new responsive sections.                 |

## The change in one paragraph

The vendor profile's full-bleed cover banner is gone. It asked for a 21:9 master
nobody shoots — at 2560px an ordinary wedding frame rendered as a slice of
waistband with both faces off-screen. The profile header is now **the vendor's
search card, unpacked horizontally**: identity left, one **3:2 cover** flush to
the card's top, right and bottom edges. A vendor uploads **one** photo; it is the
cover on their card in search _and_ the header of their profile. It carries no
link — every other photograph lives in the Portfolio tab.

## Rules a rebuild must not break

1. **One cover file per vendor, 3:2, `object-fit: cover`.** No second image
   field, no device-specific crop, no separate profile banner. Ever.
2. **Identity is never on the photograph.** No overlapping avatar, no negative
   margin crossing an `overflow: hidden` boundary, at any width.
3. **Identity reads before the cover** at all four widths. 390 is the only width
   that stacks, and it stacks identity _above_ cover.
4. **The editor's preview is never a field.** Right-edge rail at >=1024; a panel
   above the fields at 768; a preview strip that opens a bottom sheet at 390.
5. **Nothing sticky covers content.** Every scrolling pane carries bottom padding
   at least the height of its bar.

## Superseded — do not implement

If your copy of the change orders is older than this drop, these two sections are
dead and would rebuild the thing that was just removed:

- `CHANGE-ORDER-2026-08-28.md` **B2. Vendor profile header** — 196px banner,
  82px avatar overlapping by 16px, `margin-top:-34px`, z-index stacking.
- `CHANGE-ORDER-2026-08-28-part2.md` **2. Mobile vendor profile header parity** —
  same overlap treatment at <640.

No banner and no overlapping avatar exist at any width.

## Breakpoints drawn

| Screen         | 1440                        | 1024              | 768                        | 390                          |
| -------------- | --------------------------- | ----------------- | -------------------------- | ---------------------------- |
| Vendor profile | card + 380px rail           | card + 320px rail | card + bottom bar          | stacked card + bottom bar    |
| Profile editor | fields + 308px preview rail | rail, 280px       | preview panel above fields | preview strip + bottom sheet |

Cover width by breakpoint: 300 / 280 / 268 / full card width.

## Import notes — what this repo kept over the export (2026-08-29)

The export lags refinements that shipped tickets already wrote back, so this was
a **merge, not an overwrite**. `Orla - Screens.dc.html` and `support.js` are
byte-identical to the drop; the three `design-plan/*.md` files took the drop's
content with these local decisions restored:

| Restored                                                       | Where                                | Why                                                                                                                                                            |
| -------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inquiry` / `inquiries` (×3)                                   | `12-vendor-profile.md`               | `31-content-voice.md` fixes US spelling and says so explicitly overrides the frames                                                                            |
| "The dashboard's reply-time nudge is omitted from the MVP too" | `12-vendor-profile.md`               | The export reverted to the older "keep it under 4h to stay ranked" open question, a decision already made                                                      |
| The **1024** column and its viewport row                       | `30-responsive.md` degradation table | The export drops 1024 from both tables while its own section 27 draws eight frames there. `04-laws.md`'s parity gate and change order **B4** both bind at 1024 |
| "1024 renders the desktop composition, not a tablet one"       | `30-responsive.md` rules             | Same reason; it is the rule the 1024 frames exist to enforce                                                                                                   |
| `## Marketing header`                                          | `30-responsive.md`                   | The Sign-up pill degradation table exists nowhere else                                                                                                         |
| `## Vendor cards below the fold at 768`                        | `30-responsive.md`                   | Shipped in #45(a); dropping the prose would invite a rebuild                                                                                                   |
| "There is no 280px filter rail at any width"                   | `30-responsive.md`                   | Guards a composition already deleted                                                                                                                           |
| 1024 hero cluster: **three cards at 0.73**, with measurements  | `30-responsive.md` §1024             | The export's "both portraits at 124px, 3:4" is pre-#55 language and contradicts the drop's own Landing-hero table                                              |
| `1024` in the no-overflow checklist                            | `30-responsive.md`                   | Same                                                                                                                                                           |

Taken from the drop over the local copy, deliberately: the **768 hero cluster
drops to two cards** (the new `14 Landing tablet` frame draws two, so the older
"never sheds a card" rule loses to the frame).

**Two contradictions this drop introduces, left as filed tickets rather than
guessed at here:**

1. `12-vendor-profile.md` moves the tab-swap threshold to **≥1280**, but
   `27 Vendor profile — 1024` draws all five tabs and a 320px rail, and
   `30-responsive.md` §1024 says 1024 renders the desktop composition.
2. Frame `28 Dropdown open — hero` regressed `{{ brandName }}` to the literal
   `Orla`. The `.dc.html` is left byte-identical on purpose — the token is a
   repo law (`BRAND_NAME`), not a frame law, and must not be hardcoded in code.
