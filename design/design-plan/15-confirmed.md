# 15 — Booking confirmed — **MVP**

**Purpose:** the one celebration moment in the product — then straight back to
something useful.

Full-bleed `linear-gradient(150deg, #627653, #4B623E 55%, #3A4E31)` with two
low-opacity white circles for depth. This is the only gradient on any
non-marketing surface, and the only place sage becomes a full field. The frame
draws the same three stops 20% lighter (`#7A9468 / #5E7A4E / #49613D`); they
were deepened so the white type over them clears the contrast floor at every
width, not only at the reference one — see the rulings below. Full-bleed means
the shell below the header: `app-field`, 836px at the reference viewport.

## Sequence

1. 70px translucent circle with a white check — spring in, damping 20 / stiffness 300.
2. **"June 14 is yours."** Serif 48px, white. Names the date, not the transaction — "Booking confirmed" is a receipt; the date is what they bought.
3. One line: what was paid, and when the vendor will next be in touch.
4. Detail card on `stone-0`: vendor thumbnail + name + event line · Paid (Serif) · Booking id in JetBrains Mono.
5. **Message [vendor]** (white fill, sage text) + **View booking** (white outline).
6. A divider, then **"Still need someone for [date]?"** with four category chips — **names only, no counts** — linking into search pre-filtered to this event's date and city. The old "Couples who booked Maya also booked" framing needs pairing data that doesn't exist yet; post-MVP.

One sparkle burst, not continuous. Respects `prefers-reduced-motion` — the check
appears without spring, the burst is skipped.

## Rulings recorded here (#413)

Frame `06` was measured against the built screen at 1440x900 for the first time
by #386's parity pass. Three of its findings are answered by a ruling rather
than by a measurement, so the answers live here rather than only in the code.

**The field fills the shell below the header, not the whole viewport.** The
frame draws no header at all — it and `12 Sign up` are the only two that do
not — but `04-laws.md` fixes the reference viewport at 1440x900 "with a 64px
header", which makes **836px** the first-screen budget every app surface
spends, and law 2 keeps the header fixed rather than scrolled away. The frame is
omitting chrome, not specifying its absence. Before this the field carried
`flex-1` against `main#main`, which is a block, so it sized to its content: the
gradient stopped 321px short, all four cross-sell chips' focus rings were
clipped 4px by the field's own `overflow:hidden` edge, and `justify-center` had
no slack to give the check circle its air.

**It is `app-field`, a `min-height`, and not `app-shell`.** `app-shell` is a
fixed height with `overflow: hidden`, which is right for a surface whose panes
scroll inside it and wrong for one whose content is a single centred stack:
nothing here scrolls, so a fixed height clips that stack at _both_ ends with no
scrollbar in any short window and at 200% zoom — the defect this file's own
checklist names ("no pane clips its own content mid-element"). The
scroll-budget table lists the 1.0x surfaces by name and this screen is not one
of them, so it may scroll rather than clip. `app-field` states the height once
in the theme, against `--header-height`, so nothing on the screen re-derives
64px.

**Contrast: the ground moved, and so did the ink — each as little as it could.**
D30 refused a large-text carve-out and kept the 4.5:1 floor blanket, which left
this screen the two options D30 names: move the colour, or move the ground.
Both moved.

- The two dimmed lines over the field — the sub-line at `stone-0/88` and
  `Still need someone for …` at `stone-0/75` — go to **full `stone-0`**. D30's
  own rule: the table bans dimming anything that carries meaning.
- The gradient goes **20% deeper**: `#627653 / #4B623E / #3A4E31`, the same
  three stops at the same 0% / 55% / 100% on the same 150° line, scaled in
  sRGB so every hue relationship in the field is unchanged. It had to move
  because white is already the lightest ink the system has, so the 48px
  headline had nowhere else to go. **The depth is set by the narrowest width,
  not by the reference one**: a `150deg` line is `0.5W + 0.866H`, so a narrow
  field is a short line and the centred headline spreads across more of it —
  21% of it at 1440, 35% at 390. 6.5% deeper cleared 4.62 at 1440 and still
  measured 3.66 at 390.
- The four chips' `rgba(255,255,255,.14)` wash becomes `stone-900/14`. A
  translucent **white** pill lightens the exact ground its white label needs
  dark, and cost those four labels ~1.1 ratio points on their own; the pill
  keeps its shape, size, padding and white label, and only the direction of the
  wash inverts. Rescuing them by darkening the field further would have taken
  the whole gradient to ~80% to save four chips — the trade D30 refused for the
  sign-up photograph.

Measured in a browser against the composited backdrop under each text box.
Worst sample anywhere on the screen: **4.56** at 320x568, 4.62 at 390x844,
4.81 at 720x450 (the 400% reflow case), 5.68 at 1024x640, **5.90** at
1440x900. Per node at the reference viewport: headline 5.90, sub-line 5.94,
`View booking` 6.77, `Still need …` 6.53, the four chips 7.71 — against 4.04 /
3.58 / — / 3.40 / 3.72–3.98 before. The `✓` glyph is `aria-hidden` and
decorative, so it is exempt and is not measured. Everything inside the white
card already passed. Full table in `01-foundations.md`.

**The booking id stays the real id.** The frame draws `ORL-4821`, 66px wide;
the screen renders the row's UUID at 281px, which is what widens the card to
730px against the frame's ~600. `ORL-4821` is **sample data, like "Maya" and
"$1,450"** — no artefact anywhere specifies a booking-reference format, and
minting one is a column, a migration and a uniqueness guarantee, none of which
is MVP. The id on this card is what a support request is about, so it stays
whole and selectable, and the card is as wide as a real id makes it. Recorded
so it is not re-filed.

## Acceptance

- [ ] Entire moment fits one viewport with no scroll
- [ ] Booking id present and copyable
- [ ] Next-step chips are real categories with no counts, filtered to the same date and city
- [ ] Reachable again from the booking detail — it is a state, not a one-shot page

## Post-MVP

- "Couples who booked X also booked" — needs real pairing data
- Counts on the category chips
- Add-to-calendar and a shareable event summary
