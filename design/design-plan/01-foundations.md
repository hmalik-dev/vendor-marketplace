# 01 — Foundations

All tokens live in `packages/config/tailwind/theme.css` under `@theme`.
Tailwind 4 is CSS-first; there is no palette in a JS config.

## Colour

```css
@theme {
  /* Clay — the action colour. FILL ONLY. */
  --color-clay-50: #fdf4ef;
  --color-clay-100: #f7e7e0; /* tinted surfaces: active nav, selected states */
  --color-clay-200: #efd8cc; /* borders on clay surfaces */
  --color-clay-300: #dda98c;
  --color-clay-400: #b4552f; /* PRIMARY FILL — buttons, sliders, selected days */
  --color-clay-500: #a34a28; /* CLAY AS TEXT — links, ghost buttons, accents */
  --color-clay-600: #8e3f20; /* text on clay-100 surfaces, pressed fill */

  /* Sage — settled, confirmed, complete */
  --color-sage-50: #edf0e9;
  --color-sage-100: #e4e9de;
  --color-sage-150: #d9e2c8; /* pale sage — the italic accent on an ink ground */
  --color-sage-200: #a8c08e; /* pale sage — decorative dots on an ink ground */
  --color-sage-400: #5e6b4f;
  --color-sage-600: #4b5940; /* sage as text */

  /* Gold — waiting on someone */
  --color-gold-50: #f5eedc;
  --color-gold-200: #f3c98b; /* pale gold — the italic accent on an ink ground */
  --color-gold-400: #c99a2e;
  --color-gold-600: #7a5a12; /* gold as text — do not use #8A6716, it fails AA */

  /* Steel — neutral information */
  --color-steel-50: #eef3fa;
  --color-steel-200: #d3e0ee; /* banner border */
  --color-steel-600: #3d6a8c;

  /* Error */
  --color-error-50: #fbeeec;
  --color-error-200: #efcec9; /* banner border */
  --color-error-500: #b23a30;

  /* Warm stone — the neutral ramp */
  --color-stone-0: #fffdf9; /* cards, header, rails */
  --color-stone-50: #f8f5ef; /* page background — never pure white */
  --color-stone-100: #f4f0e8; /* table header, deeper panels */
  --color-stone-150: #f1ece4; /* input fill, nested surfaces */
  --color-stone-200: #efe9e0; /* hairline dividers inside cards */
  --color-stone-300: #e4ddd1; /* borders */
  --color-stone-400: #d5cec2; /* stronger borders, unchecked controls */
  --color-stone-500: #c9c1b5; /* disabled text ONLY (fails AA by design) */
  --color-stone-600: #6b6459; /* MUTED TEXT — the minimum for any real label */
  --color-stone-700: #4a443c; /* body text */
  --color-stone-900: #23201c; /* headings, ink */
}
```

### Contrast rules — these were failures we already fixed, do not regress

| Use                                 | Token               | Never                                             |
| ----------------------------------- | ------------------- | ------------------------------------------------- |
| Small labels, metadata, helper text | `stone-600 #6B6459` | `#A79E90`, `#8E8578`, `#9A9184` — all below 4.5:1 |
| Clay as text on any cream           | `clay-500 #A34A28`  | `clay-400 #B4552F` — 4.32:1 on `stone-100`, fails |
| Gold as text on `gold-50`           | `gold-600 #7A5A12`  | `#8A6716` — 4.27:1, marginal                      |
| Disabled / out-of-month             | `stone-500 #C9C1B5` | anything carrying meaning                         |

Every text node must clear **4.5:1**. `stone-500` is the one exception and is
reserved for genuinely inert content (out-of-month calendar days).

## Type

```css
@theme {
  --font-display: var(--font-display-face, 'Instrument Serif'), ui-serif, Georgia, serif;
  --font-sans: var(--font-body-face, 'Instrument Sans'), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-mono-face, 'JetBrains Mono'), ui-monospace, monospace;
}
```

Load with `next/font/google` in `app/layout.tsx`; the fallback must sit **inside**
`var()` or an undefined property drops the whole stack.

**Instrument Serif** — display. Business names, page titles, prices, dates,
metric numbers, empty-state headlines. Regular weight only; it has one. Italic
for the accent phrase in a headline and for pull-quotes. Never below 16px.

**Instrument Sans** — everything else. 400 body, 500 nav and secondary, 600 UI
and emphasis, 700 prices in cards.

**JetBrains Mono** — booking ids, construction notes, placeholder labels. Almost
nothing else.

### Scale (two densities)

| Token       | Size / line-height    | Marketing use         | App use                               |
| ----------- | --------------------- | --------------------- | ------------------------------------- |
| `text-xs`   | 11px / `normal`       | badges, timestamps    | pill labels, helper text              |
| `text-sm`   | 12.5px / `normal`     | metadata              | the default for labels and metadata   |
| `text-base` | 13.5px / `normal`     | —                     | body, inputs, buttons, table cells    |
| `text-md`   | 15px / `normal`       | body                  | hero search values                    |
| `text-lg`   | 16px / `normal`       | hero sub-line         | —                                     |
| display-sm  | 21px Serif / `normal` | card titles           | pane headings (`.sh`)                 |
| display-md  | 26px Serif / `normal` | section headings      | page titles (`.h2`) — the app ceiling |
| display-lg  | 33–36px Serif / 1.15† | profile names, totals | confirmation only                     |
| display-xl  | 54px Serif / 1.04     | landing hero          | never                                 |

**Line-height was derived from the frame markup in `Orla - Screens.dc.html` on
2026-08-28** (#74), replacing the ratios this table previously carried. The frames
set no `line-height` on any UI class, so every control computes `normal`; the only
ratios they set are inline, on wrapping prose and on the hero headline. The old
ratios made every pill, chip, button and card 3–7px taller than its frame
counterpart.

† **`display-lg` is the one derived value, not a read one.** The frames never draw
34px, and the neighbouring sizes disagree — 33px at 1.1, 36px at 1.06, 32px and
38px at 1.15. 1.15 is the ratio the frames use most often across display type
(≥27px), which is what `type-scale-parity.test.ts` asserts. Every other row in
this table is read directly off a frame class or an inline declaration.

**This table describes the tokens, which is not the whole app.** A size written as
an arbitrary utility — `text-[26px]` rather than `text-display-md` — emits no
line-height and inherits `1.5` from Tailwind's Preflight instead. 96 such sites
exist; **#235** owns making the inherited default agree with the frames.

**Named exceptions.** A ratio belongs to the element that wraps, not to the scale
step, so text that wraps asks for a measure by name:

| Class            | Ratio | Derived from                                        | Use                                                |
| ---------------- | ----- | --------------------------------------------------- | -------------------------------------------------- |
| `leading-normal` | 1.5   | frame `.tn`, the one UI class that sets a ratio     | helper and hint lines under a control              |
| `leading-prose`  | 1.6   | the ratio the frames set most often on inline prose | body copy, descriptions, review and message bodies |

`leading-normal` is Tailwind's own step and already equals 1.5, so it gets no
second name. `leading-prose` is a new `--leading-*` token because no built-in
step is 1.6 — `relaxed` is 1.625.

**A display-lg heading inside an app frame is a bug.** App page titles cap at 26px.

Uppercase micro-labels: 10.5px, weight 600, `letter-spacing: .05em`, `stone-600`.

### Rendering details

The frame and the live app are rendered by the same browser, so any text-rendering
property applied to one and not the other shows up as a **font-axis parity
failure** even when every token matches.

- **Do not add `-webkit-font-smoothing: antialiased`.** The frames do not set it.
  Applying it to the app alone changes glyph weight and fails the font axis
  against every frame. If it is ever wanted, it goes in `Orla - Screens.dc.html`
  and the app in the same change, or in neither.
- **`font-variant-numeric: tabular-nums` on numbers that update in place** —
  availability counts, quarter totals, timers, any figure that re-renders while
  the user is looking at it. Proportional digits change width as the value
  changes and the row jitters. It is already applied ad hoc in
  `vendor-profile-form.tsx` and `availability-calendar.tsx`; those are correct,
  and the rule is now written down so the next one matches. Static prices in a
  card do not need it — the frames set them proportional, and the frame wins.
- **`text-wrap: balance` on display headings, `text-wrap: pretty` on body,
  captions and helper text.** Both only affect where lines break, never metrics,
  so neither moves a parity axis. Never on code, `JetBrains Mono` labels, or
  long prose.
- **Nested rounded surfaces: `outer radius = inner radius + padding`.** A
  `--radius-2xl` card with 14px padding wants `--radius-lg` on the control inside
  it, not another `2xl`. Where the padding is large enough that the maths gives
  something absurd, treat the two as separate surfaces instead. Optical
  coherence is the goal, not the formula.
- **Optically centre asymmetric glyphs.** Play triangles, chevrons, send arrows
  and stars are not visually centred by geometric centring. Correct the SVG
  where possible; a sub-pixel padding nudge otherwise.
- **Any user-supplied string in a heading needs a wrapping or truncation rule.**
  See `.claude/rules/web-route-boundaries.md` — an unbounded value produced a
  5386px `h1` in a 1440px viewport.

## Spacing, radius, shadow

4px grid. Spend width freely; ration height.

| Surface class               | Section padding-y | Card padding | Row height |
| --------------------------- | ----------------- | ------------ | ---------- |
| Marketing                   | 40–64px           | 24px         | —          |
| App                         | 18–24px           | 14–16px      | 56px       |
| Dense (admin, message list) | 12–16px           | 12–14px      | 44px       |

```css
--radius-sm: 6px; /* badges, category chips, small pills */
--radius-md: 8px; /* table controls, filter buttons */
--radius-lg: 10px; /* buttons, inputs */
--radius-xl: 14px; /* cards, panels, drop zones */
--radius-2xl: 18px; /* vendor cards, booking rail, modals */
--radius-full: 9999px; /* avatars, status pills, the hero search bar */

--shadow-sm: 0 2px 10px rgba(35, 32, 28, 0.06);
--shadow-md: 0 4px 18px rgba(35, 32, 28, 0.09);
--shadow-lg: 0 8px 28px rgba(35, 32, 28, 0.1);
--shadow-xl: 0 12px 40px rgba(35, 40, 38, 0.2);
--shadow-hover: 0 8px 24px rgba(35, 32, 28, 0.12);
```

Shadows are warm-tinted with the ink, never neutral grey, never black.

## Layout variables

```css
@theme {
  --header-height: 4rem; /* 64px, 56px below 768 */
  --sidebar-width: 15rem; /* 240px */
  --sidebar-width-sm: 12.5rem; /* 200px — also the form section nav */
  --sidebar-width-icon: 4.5rem; /* 72px tablet icon rail */
  --rail-width: 21.25rem; /* 340px — dashboard rails */
  --rail-filter: 17.5rem; /* 280px — search filters */
  --rail-booking: 23.75rem; /* 380px — vendor profile */
  --rail-summary: 26.25rem; /* 420px — checkout */
  --rail-context: 20rem; /* 320px — messaging booking context */
  --list-pane: 18.75rem; /* 300px — conversation list */
  --row-height: 3.5rem;
  --row-height-dense: 2.75rem;
  --duration-fast: 150ms;
  --duration-base: 200ms;
  --duration-slow: 300ms;
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --z-sticky: 10;
  --z-header: 40;
  --z-drawer: 50;
  --z-modal: 60;
  --z-toast: 70;
}
```

## Shared utilities

```css
@utility app-shell {
  height: calc(100dvh - var(--header-height));
  overflow: hidden;
}
@utility app-pane {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@utility field-grid {
  display: grid;
  gap: 0.8125rem 1.25rem;
  grid-template-columns: 1fr;
  @media (width >= 40rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

## shadcn slot bindings (`apps/web/src/app/globals.css`)

```css
:root {
  --background: var(--color-stone-50);
  --foreground: var(--color-stone-900);
  --card: var(--color-stone-0);
  --primary: var(--color-clay-400);
  --primary-foreground: var(--color-stone-0);
  --secondary: var(--color-stone-150);
  --muted: var(--color-stone-150);
  --muted-foreground: var(--color-stone-600);
  --accent: var(--color-sage-50);
  --accent-foreground: var(--color-sage-600);
  --destructive: var(--color-error-500);
  --border: var(--color-stone-300);
  --input: var(--color-stone-300);
  --ring: var(--color-clay-400);
  --radius: var(--radius-lg);
}
```

Guard the binding with a token test so a future refactor can't silently unpick it.

## Display-boundary conversions

| Value          | Stored                 | Displayed                                                    | Helper                    |
| -------------- | ---------------------- | ------------------------------------------------------------ | ------------------------- |
| Money          | integer cents          | `$1,450` — cents hidden when `.00`                           | `formatPrice`             |
| Service radius | `service_radius_km`    | **miles** (US audience)                                      | `kmToMiles` / `milesToKm` |
| Event date     | Postgres `DATE` string | locale date, never round-tripped through a local-time `Date` | date helpers              |
| Seeded lists   | `displayOrder` column  | that order always — never alphabetical                       | —                         |
