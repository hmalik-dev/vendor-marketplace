# Vendor Marketplace — Design System & Frontend Specification

Reference document for all frontend implementation across all tickets. Built for
Next.js 15 + Tailwind CSS 4 + shadcn/ui — but pushed far beyond the default aesthetic.

## How this document is used

**This document is the contract; the tickets are the implementation.** Design
work changes this file. It does not change application code — no page, no
component, no route is written as part of a design pass. A ticket implementer
reads this document and builds their surface against it.

That makes one thing this document's job: to be **concrete enough to build from
without inventing anything**. Every variable, font, icon, breakpoint, container
width, spacing rule, and layout law a ticket needs is named here, with the value,
the token name, and the file the token lives in:

| What | Where it is specified | Where it lives in code |
|---|---|---|
| Colour, radius, shadow, font tokens | §2, §3, §4 | `packages/config/tailwind/theme.css` |
| Layout variables (containers, chrome, density) | §4, §10 | `packages/config/tailwind/theme.css` |
| Shared utilities (`app-shell`, `app-pane`, `field-grid`) | §10 | `packages/config/tailwind/theme.css` |
| shadcn semantic slot bindings | §10 | `apps/web/src/app/globals.css` |
| Icon library, sizes, and the category icon registry | §7 | `lucide-react`, seeds in `packages/shared/src/constants` |
| Per-surface layout | §8 | The ticket that owns the surface |
| Viewport rules and review checklists | §9 | Every FE ticket's acceptance criteria |

If a ticket needs a value that is not here, the answer is to add it here first —
never to invent one in a component. A hex, a width, or an icon chosen inside a
page is a second source of truth, and it drifts.

---

## 1. Design Philosophy

**Concept: "The Curated Introduction"**

This marketplace is about *people*, not products. Every design decision answers: "Does this make the vendor feel like a skilled professional being personally introduced, and the customer feel like they're discovering someone special?"

Think of it as walking into a beautifully designed boutique event planning studio — warm materials, carefully curated recommendations, personal touches everywhere. Not a sterile catalog. Not a generic listing site.

**Guiding Principles:**
- **Photo-forward**: Vendor work should dominate the visual hierarchy. The platform is the frame, not the painting.
- **Warm over clinical**: Cream backgrounds, organic shapes, and soft shadows instead of stark white and hard edges.
- **Trustworthy simplicity**: Clean layouts with generous breathing room. Complexity in the booking/payment flow is managed through progressive disclosure, not cramming.
- **Human scale**: Real names, real photos, conversational copy. No corporate jargon. Buttons say "Send a message" not "Initiate contact".
- **Celebration-ready**: This platform facilitates joyful events — the design should carry that emotional undertone without being childish.
- **Desktop-first**: The people using this are at a laptop — a couple comparing four photographers across tabs, a vendor working through the week's requests between gigs. Design every surface at 1440 × 900 first and let narrower viewports be the adaptation. **Width is a resource**: spend it on columns, rails, and panes instead of pushing content down the page.

**Anti-patterns (never do these):**
- Purple-to-blue gradients on white backgrounds
- Cards with identical padding, border-radius, and shadow everywhere
- Generic hero sections with stock-photo-style overlays
- SaaS-style pricing tables for vendor packages
- Dashboard layouts that look like admin panels
- Gray-on-white text that strains readability
- Cookie-cutter component patterns with no contextual variation
- A phone layout stretched across a 1440px display — one narrow centre column with empty gutters on both sides
- Three screenfuls of scrolling for content that fits in one at desktop width
- The primary action of a page sitting below the fold on the surface whose whole purpose it is
- Reaching for a modal when a persistent rail would hold the same content without hiding the page

---

## 2. Typography

### Font Stack

**Source of truth**: the stacks live in `packages/config/tailwind/theme.css` as
`--font-display` / `--font-sans` / `--font-mono`; `apps/web/src/app/layout.tsx`
binds the `next/font` faces to `--font-display-face`, `--font-body-face`, and
`--font-mono-face`. Change them there, and reflect the change here.

**Display / Headlines: Fraunces**
- Source: Google Fonts (variable)
- Use for: hero headlines, section headings, vendor business names, page titles, pull quotes, large metric numbers
- Character: warm, organic, slightly soft-wobbled serif — handcrafted and editorial rather than corporate. It carries the boutique-studio half of the concept.
- Best above 18px, where its personality is legible as character rather than noise. Never for dense UI text.

**Body / UI: Albert Sans**
- Source: Google Fonts (variable)
- Weight range: 300 — 700
- Use for: body copy, navigation, buttons, form labels, metadata, card descriptions, table content
- Character: friendly geometric sans with open apertures — clean and modern, warm enough not to feel clinical, quiet enough not to compete with Fraunces.

**Monospace (data): JetBrains Mono**
- Use for: prices in tables, booking ids, admin data views
- Minimal use — only where monospace is semantically meaningful

### Type Scale (rem-based, 16px root)

```
--text-xs:    0.75rem / 1rem      (12px) — metadata, timestamps, badges
--text-sm:    0.875rem / 1.25rem  (14px) — secondary labels, helper text
--text-base:  1rem / 1.5rem       (16px) — body copy, form inputs, buttons
--text-lg:    1.125rem / 1.75rem  (18px) — card titles, nav items
--text-xl:    1.25rem / 1.75rem   (20px) — section subheadings
--text-2xl:   1.5rem / 2rem       (24px) — section headings
--text-3xl:   1.875rem / 2.25rem  (30px) — page titles
--text-4xl:   2.25rem / 2.5rem    (36px) — hero subheadings
--text-5xl:   3rem / 1.1          (48px) — hero headlines
--text-6xl:   3.75rem / 1.05      (60px) — landing page hero (desktop only)
```

### Typography Rules

- **Headlines** (h1-h3): Fraunces, weights 500-700. Letter-spacing: -0.02em for large sizes, normal for smaller.
- **Body text**: Albert Sans 400, line-height 1.6. Max 65ch for readability.
- **UI elements** (buttons, labels, nav): Albert Sans 500-600, letter-spacing 0.01em.
- **Emphasis**: Use weight variation (Albert Sans 600) over italics. Reserve italics for Fraunces in editorial contexts (testimonials, vendor bios).
- **Vendor business names**: Always Fraunces 600, regardless of context (card, profile, search result).
- **Prices**: Albert Sans 700. Dollar sign slightly smaller (0.8em). Cents separated by period, not shown if .00.
- **No all-caps** except: category badges, status pills, button text in specific high-emphasis CTAs.
- **Two densities, one scale.** *Marketing surfaces* (landing, auth, the public vendor profile) use the scale above at a 16px base. *App surfaces* (dashboards, search, messaging, forms, admin) step UI text down one notch — `text-sm` for labels and metadata, `text-base` for body — and cap page titles at `text-2xl`. A `text-4xl` heading inside an app frame is 60px of vertical budget spent on a word the user already knows.

### Font Tokens

Tailwind 4 is CSS-first, so the stacks are `@theme` variables, not a
`tailwind.config.ts` entry (`packages/config/tailwind/theme.css`):

```css
@theme {
  --font-display: var(--font-display-face, 'Fraunces'), ui-serif, Georgia, serif;
  --font-sans:    var(--font-body-face, 'Albert Sans'), ui-sans-serif, system-ui, sans-serif;
  --font-mono:    var(--font-mono-face, 'JetBrains Mono'), ui-monospace, monospace;
}
```

Which gives tickets `font-display`, `font-sans` (the body default), and `font-mono`.
The fallback must sit **inside** `var()` — see §10 Font Loading.

---

## 3. Color System

### Philosophy

**Scheme: Terracotta + Sage** (Scheme A in `vendor-marketplace-color-schemes.md`).

Warm terracotta as the primary brand and action colour — energetic, celebratory,
and distinctly not the generic AI/tech blue. Deep sage as the secondary grounds
it with a calm, natural counterweight and carries every success state. The
background ecosystem is warm cream and stone, never stark white. Gold is
reserved for stars, ratings, and premium moments.

**Brand reference**: terracotta + sage on cream reads handcrafted boutique —
Anthropologie meets Airbnb — which is exactly the "curated introduction" concept.

**Mechanical source of truth**: `packages/config/tailwind/theme.css` (Tailwind 4
is CSS-first — there is no `tailwind.config.ts` palette). `apps/web/src/app/globals.css`
binds these to shadcn's semantic slots. The table below must match that file;
`apps/web/src/app/theme-tokens.test.ts` guards the binding.

### Palette

```css
@theme {
  /* --- Primary: Terracotta --- */
  --color-primary-50:  #fef3ee;
  --color-primary-100: #fce4d6;
  --color-primary-200: #f9c5a8;
  --color-primary-300: #f4a070;
  --color-primary-400: #ee7b3f;   /* main action: buttons, links, active states */
  --color-primary-500: #e05e20;   /* hover */
  --color-primary-600: #c44a16;   /* pressed, and primary text on light surfaces */
  --color-primary-700: #a33814;
  --color-primary-800: #832e17;
  --color-primary-900: #6b2816;

  /* --- Secondary: Sage --- */
  --color-sage-50:  #f2f5f0;
  --color-sage-100: #e1e8dc;
  --color-sage-200: #c4d1ba;
  --color-sage-300: #9fb38f;
  --color-sage-400: #7a9468;      /* vendor badges, secondary accents */
  --color-sage-500: #5e7a4e;      /* secondary buttons, success */
  --color-sage-600: #49613d;
  --color-sage-700: #3a4d33;
  --color-sage-800: #313f2c;
  --color-sage-900: #2a3526;

  /* --- Accent: Gold --- */
  --color-gold-100: #fbf3e0;
  --color-gold-200: #f5e2b8;
  --color-gold-300: #eece84;
  --color-gold-400: #d4a853;      /* stars, featured badges, pending states */
  --color-gold-500: #c49530;
  --color-gold-600: #a57a1e;

  /* --- Neutrals: Warm Stone (deliberately shadows Tailwind's cool `stone`) --- */
  --color-stone-0:   #ffffff;     /* cards on the cream page, modals */
  --color-stone-50:  #faf7f2;     /* page background — warm cream */
  --color-stone-100: #f0ebe3;     /* input bg, nested/secondary cards */
  --color-stone-150: #e8e2d8;     /* subtle borders, dividers */
  --color-stone-200: #e2dcd2;     /* stronger borders */
  --color-stone-300: #c9c1b5;     /* disabled, placeholder */
  --color-stone-400: #a89e90;     /* muted icons */
  --color-stone-500: #8b8178;     /* secondary text */
  --color-stone-600: #6e655c;     /* body text (light) */
  --color-stone-700: #524b44;     /* body text */
  --color-stone-800: #3a3530;     /* headings */
  --color-stone-900: #2c2825;     /* maximum contrast */

  /* --- Semantic --- */
  --color-success:     #5e7a4e;   /* sage-500 — booking confirmed, payment success */
  --color-warning:     #d4a853;   /* gold-400 — pending, attention needed */
  --color-error:       #c4453d;   /* warm red — form errors, cancellations */
  --color-error-light: #fef2f1;
  --color-info:        #4a7fa5;   /* muted steel blue — informational banners */
  --color-info-light:  #eff6fb;
}
```

**Colour carries meaning on app surfaces.** Terracotta means *you can act here*;
sage means *this is settled*; gold means *this is waiting on someone*; steel blue
is neutral information. On a dense desktop screen a user scans for colour before
they read — never spend terracotta on decoration.

### Gradients

Gradients are used **surgically** — only in four high-impact moments, all of them
on marketing or celebration surfaces. App surfaces (dashboards, search, forms,
messaging, admin) are flat: a gradient behind a dense working screen is visual
noise, and it fights the panes and rails that structure the layout.

1. **Hero section background** — atmospheric depth behind the landing headline
   ```css
   --gradient-hero: linear-gradient(135deg, #FAF7F2 40%, #FEF3EE 70%, #FCE4D6 100%);
   ```

2. **Primary CTA buttons** — subtle dimensionality at large sizes
   ```css
   --gradient-cta: linear-gradient(135deg, #EE7B3F, #E05E20);
   /* hover: */ --gradient-cta-hover: linear-gradient(135deg, #E05E20, #C44A16);
   ```

3. **Dark trust/feature bands** — full-bleed marketing sections
   ```css
   --gradient-dark: linear-gradient(135deg, #3A3530, #6B2816);
   ```

4. **Success celebration moment** — payment confirmed, booking confirmed
   ```css
   --gradient-success: linear-gradient(135deg, #7A9468, #5E7A4E, #49613D);
   ```

**Where gradients are NEVER used:**
- Cards, card backgrounds, card images
- Navigation bar, sidebar, filter rail, summary rail
- Form elements, inputs, selects
- Status pills, badges
- Body content areas and every app surface
- Anywhere vendor photography is displayed (gradients compete with images)

### Usage Rules

- **Page backgrounds**: Always `stone-50`, never pure white. The warm tint in the neutral scale harmonizes with the terracotta primary.
- **Card backgrounds**: `stone-0` (white) when on tinted bg — creates subtle lift. `stone-100` for nested/secondary cards.
- **Primary buttons**: `gradient-cta` bg, white text. Hover: `gradient-cta-hover`. Pressed: `primary-600` (flat). For non-hero contexts, flat `primary-400` bg is acceptable.
- **Secondary buttons**: `stone-0` bg, `stone-800` text, `stone-200` border. Hover: `stone-100` bg.
- **Ghost buttons**: Transparent bg, `primary-400` text. Hover: `primary-50` bg.
- **Links**: `primary-500` text with underline-offset-2. Hover: `primary-600`.
- **Body text**: `stone-700` for standard, `stone-500` for secondary/muted, `stone-800` for emphasis.
- **Stars/ratings**: `gold-400` fill.
- **Status indicators**: sage for confirmed/completed, gold for pending/quoted, error red for declined/cancelled, info blue for informational, terracotta for *needs your action*.
- **Never**: Pure black text (#000). Always use `stone-800` or `stone-900`.

### Dark Mode (post-MVP)

Not in scope. The warm cream palette is the brand identity. A dark theme would be implemented as a true inversion — rich warm charcoal (`#241F1C`) backgrounds with terracotta-shifted accents and warm-shifted text.

---

## 4. Spacing, Layout & Grid

### Spacing Scale

Follow Tailwind's default 4px grid, but favor generous spacing:

```
4   (1)   — tight padding (badge internal)
8   (2)   — compact gaps (icon + text)
12  (3)   — form element internal padding
16  (4)   — standard card padding (mobile), compact gaps
20  (5)   — standard gaps between related items
24  (6)   — card padding (desktop), section element spacing
32  (8)   — spacing between card groups
40  (10)  — section padding top/bottom (mobile)
48  (12)  — desktop section padding
64  (16)  — major section separators
80  (20)  — hero vertical padding (mobile)
96  (24)  — hero vertical padding (desktop)
128 (32)  — landing page section spacing
```

**Rule: spend space horizontally, ration it vertically.** Generous whitespace is
what separates a premium feel from a cramped listing site — but on a 900px-tall
display the vertical axis is the scarce one and the horizontal axis is abundant.
Widen gutters, gaps, and column counts freely. Treat every vertical gap over
48px on an app surface as a decision that has to justify itself.

**Vertical budget by surface class:**

| Surface class | Section padding (y) | Card padding | Row height | Notes |
|---|---|---|---|---|
| **Marketing** — landing, auth | 64–96px | 24–32px | — | The one place a large vertical rhythm belongs |
| **App** — dashboards, search, bookings, forms | 24–32px | 20–24px | 56px | Page header *and* the first row of real content inside the first 900px |
| **Dense** — admin tables, message list, filter rail | 16–20px | 12–16px | 44–48px | Scannability beats airiness; the whitespace moves to the gutters |

### Layout Containers

Desktop-first means width is the primary design resource, so surfaces do not all
share one ceiling. A single 1280px column applied to everything starves app
surfaces and over-stretches prose.

| Token | Max width | Used by |
|---|---|---|
| `--container-prose` | 720px | Vendor bio, legal copy, any long-form reading |
| `--container-form` | 1040px | Standalone forms — as a **two-column field grid**, not a 520px queue |
| `--container-app` | 1440px | Dashboards, booking detail, checkout, profile edit |
| `--container-wide` | 1680px | Search results, messaging, availability, admin tables |
| `--container-full` | none | App shells that own the viewport (messaging, search, admin) |

```
padding-x: 16px (<640) / 24px (≥640) / 32px (≥1024) / 40px (≥1280) / 48px (≥1600)
centered with mx-auto
```

**The gutter test**: if more than ~30% of the viewport width is empty margin on
an app surface at 1440px, the layout is wrong. The fix is a second column, a
rail, or a wider ceiling — never a wider centred blob of text.

### Desktop Layout Laws

These are what make the product feel like a desktop application rather than a
phone page on a monitor. They hold at ≥1280px; below that they degrade in the
order set out in §9.

1. **Columns before stacking.** Two blocks that are read together sit side by
   side. Stacking is what happens when the viewport runs out of width — it is
   not the default composition.
2. **Fixed chrome, scrolling content.** App surfaces fill the viewport
   (`h-[calc(100dvh-var(--header-h))]`) and scroll *inside* panes. Sidebars,
   page headers, filter rails, summary rails, and primary CTAs never scroll away.
3. **Master–detail over navigate-away.** A list that leads to a detail view
   renders both at once at ≥1280px — bookings, messages, packages, admin tables.
   The detail pane scrolls; the list does not.
4. **A persistent rail beats a modal.** Filters, order summaries, booking
   context, publish checklists, and key details belong in a sticky rail. Modals
   are for genuinely interruptive, single-decision moments only.
5. **Forms are grids, not queues.** Related short fields pair up on one row
   (City/State, min/max guests, price/duration, profile photo/cover image).
   Multi-section forms get a sticky section nav on the left and the form pane on
   the right — never a 3000px scroll of stacked cards.
6. **Panes and tabs over anchor-scrolling.** Sections that are alternatives
   rather than a narrative become tabs or panes on desktop.
7. **Density scales up with width.** More width means more columns and more rows
   visible — not bigger cards and wider margins.
8. **Importance is vertical order.** The information a user needs to decide or
   act comes first; the optional, the enriching, and the rarely-changed come
   last. On a form, that means identity and location before taste and tags.
9. **Pair the inputs that describe one thing.** The two images that make up a
   vendor's visual identity, the two halves of a guest range, the price and the
   duration — one row, not two stacked blocks.

### Grid System

| Surface | 1024–1279 | 1280–1599 | ≥1600 |
|---|---|---|---|
| Vendor search results | 2 col (filter bar) | 3 col + 280px filter rail | 4 col + 280px filter rail |
| Category cards | 4 col | 5 col | 6 col |
| Featured vendors | 3 col | 4 col | 4 col |
| Package cards | 2 col | 2 col | 3 col |
| Portfolio masonry | 3 columns | 4 columns | 4 columns |
| Dashboard content | 8-col grid | 12-col grid | 12-col grid |
| Form field grid | 2 col | 2 col | 2 col (3 for short fields) |
| Admin metric cards | 4 col | 4 col | 6 col |

- **Vendor profile gallery**: masonry (CSS columns) per the table above; 2 columns on mobile.
- **Dashboard layouts**: fixed 240px sidebar + content area that fills the rest of the viewport.
- **Landing page**: full-bleed bands alternating with contained sections for rhythm — the one surface with a narrative scroll.
- **Forms**: two-column field grid inside `--container-form`, with a sticky section nav at ≥1280px.

### Breakpoints

Written desktop-down, because that is the order the design is made in. The
**base** design is `xl` (1280) and up; everything below it is an adaptation.

```
2xl: 1536px  — large desktop: gain columns and rail width, not margins
xl:  1280px  — the baseline desktop layout: rails, panes, master–detail
lg:  1024px  — small laptop: rails narrow, grids drop one column
md:  768px   — tablet: rails become drawers, master–detail becomes navigation
sm:  640px   — phone landscape
(base)       — phone portrait: single column, bottom sheets
```

**Reference viewport: 1440 × 900.** Every layout in §8 describes that size.

### Border Radius

```
--radius-sm:  6px   — badges, tags, small elements
--radius-md:  10px  — buttons, inputs, small cards
--radius-lg:  14px  — cards, modals, dropdowns
--radius-xl:  20px  — hero cards, feature sections, large images
--radius-full: 9999px — avatars, pills, circular buttons
```

**Not** the default 8px-everywhere approach. Varied radii create visual hierarchy.

### Shadows

Warm-tinted shadows — never pure black/gray. Tinted with the neutral stone to feel cohesive:

```css
--shadow-sm:  0 1px 2px rgba(36, 40, 38, 0.04);
--shadow-md:  0 2px 8px rgba(36, 40, 38, 0.06), 0 1px 2px rgba(36, 40, 38, 0.04);
--shadow-lg:  0 4px 16px rgba(36, 40, 38, 0.08), 0 2px 4px rgba(36, 40, 38, 0.04);
--shadow-xl:  0 8px 32px rgba(36, 40, 38, 0.10), 0 4px 8px rgba(36, 40, 38, 0.04);
--shadow-hover: 0 8px 24px rgba(36, 40, 38, 0.12);  /* card hover lift */
```

---

## 5. Component Design Language

### Buttons

**Primary (CTA):**
- Standard: `bg-primary-400 text-white font-sans font-semibold`
- Hero/large: `bg-gradient-cta text-white font-sans font-semibold` (gradient adds premium feel at larger sizes)
- Rounded: `radius-md` (10px)
- Padding: `px-6 py-3` (standard), `px-8 py-4` (large/hero)
- Hover: scale(1.02) + shadow-md + gradient-cta-hover (or bg-primary-500 for flat). Transition: 200ms ease
- Active: scale(0.98) + bg-primary-600
- Icon + text: 8px gap, icon 18px

**Secondary:**
- `bg-stone-0 text-stone-800 border border-stone-200 font-sans font-medium`
- Hover: bg-stone-100, border-stone-300
- Same sizing as primary

**Ghost / Tertiary:**
- No bg, no border. `text-primary-500 font-sans font-medium`
- Hover: bg-primary-50, underline
- Use for: "View all", "See more", secondary actions in cards

**Destructive:**
- `bg-error text-white` — only for irreversible actions (cancel booking, delete package)
- Always paired with a confirmation modal
- Never as the primary action on a page

**Button copy**: Conversational, imperative. "Book this vendor", "Send message", "Save changes", "Get started". Never "Submit", "Proceed", "Continue" without context.

### Cards

**Vendor Card (search results, category pages):**
- White bg (`stone-0`) on cream page
- `radius-xl` (20px) — generously rounded, feels approachable
- `shadow-sm` resting → `shadow-hover` + translateY(-2px) on hover
- Structure:
  ```
  ┌─────────────────────────────┐
  │         [Cover Image]       │  aspect-ratio: 4/3, object-cover, radius-xl top
  │                             │
  ├─────────────────────────────┤
  │  [Avatar] Business Name     │  Fraunces 600, text-lg
  │  ★ 4.8 (127 reviews)       │  gold stars, stone-500 count
  │  📍 Austin, TX              │  stone-500, text-sm
  │                             │
  │  Category Badge  Category   │  stone-100 bg, stone-700 text, radius-sm
  │                             │
  │  Starting at $150           │  Albert Sans 700, primary-500
  └─────────────────────────────┘
  ```
- Avatar: 36px circle, overlapping the image/content boundary by 12px (partially over the cover image bottom edge) — creates depth and personality
- No explicit border — shadow provides edge definition against cream bg

**Booking Card (dashboard):**
- Horizontal layout on desktop (image left, details right)
- Status pill prominent (colored per status mapping)
- Event date in Fraunces, large — it's the most important info
- Action buttons right-aligned

**Package Card (vendor profile page):**
- Vertical layout
- Subtle left border accent: 3px solid, color varies by package tier (use primary-200, primary-300, primary-400 for visual variety)
- Inclusions as a checklist with primary-400 checkmark icons
- Price prominent, Fraunces 700
- "Select this package" button at bottom

**Message Card:**
- No card chrome for own messages — just a subtle bg tint (`primary-50`)
- Other party: `stone-100` bg
- Rounded bubbles (`radius-lg`) — but not fully rounded like iMessage. Marketplace, not chat app.
- Timestamp below, text-xs, stone-400

### Form Elements

**Form layout (desktop-first):**
- Inside `--container-form` (1040px), fields sit on a **two-column grid** (`grid-cols-2 gap-x-6 gap-y-5`). A field spans both columns only when its content genuinely needs the width: business name, bio/textarea, an image drop zone, a full address line.
- Short and semantically paired fields share a row: City + State, min + max guests, price + duration, phone + response time.
- Media inputs pair too — profile photo and cover image sit **side by side**, identity first (the photo *is* the vendor) and context second.
- Multi-section forms (vendor profile edit, package form) get a **sticky left section nav** (200px) at ≥1280px listing the section headings with the active one marked, and the form pane to its right. The nav doubles as a completion indicator: a section with an unmet publish requirement carries a gold dot.
- The submit bar is **sticky to the bottom of the form pane**, not parked after the last field. It carries the primary action, the save state, and any blocking validation summary.
- Field order follows importance, not implementation convenience: identity → location → what you offer → how you are found (tags) → operational settings → publish. A user should be able to stop halfway and still have supplied the things that matter most.

**Text Inputs:**
- `bg-stone-100 border border-stone-200 rounded-[10px] px-4 py-3`
- Focus: `border-primary-400 ring-2 ring-primary-100` — warm orange glow, not blue
- Placeholder: `stone-400`, Albert Sans 400
- Label: `stone-700`, Albert Sans 500, text-sm, mb-1.5
- Helper text: `stone-500`, text-xs, mt-1
- Error state: `border-error ring-error/20`, error message in error color below

**Selects / Dropdowns:**
- Same styling as inputs
- Dropdown panel: `stone-0` bg, `shadow-lg`, `radius-lg`
- Selected item: `primary-50` bg
- Hover: `stone-100` bg

**Textareas:**
- Same base as inputs but min-h-[120px]
- Character count (if limited) in bottom-right, stone-400

**Checkboxes / Radio:**
- Custom styled: rounded-[4px] checkbox, circle radio
- Checked: `primary-400` fill with white checkmark
- Focus ring same as inputs

**Date Picker:**
- Calendar grid with warm styling
- Available dates: `stone-0` bg, clickable
- Booked/blocked: `stone-200` bg, `stone-400` text, not clickable, subtle strikethrough
- Selected: `primary-400` bg, white text
- Today: `primary-100` bg, `primary-600` text
- Hover: `primary-50` bg

### Navigation

**Main Header:**
- `stone-0` bg with `shadow-sm` — subtle separation from cream body
- Logo (left): Brand wordmark in Fraunces 700 + primary-400 color
- Nav links (center at ≥1024px, hamburger below): Albert Sans 500, stone-700
- Active nav: primary-400 text + 2px bottom border
- Right side: Search icon, notifications bell (with unread badge), avatar dropdown
- Mobile: Hamburger → full-height slide-in drawer from right, cream bg

**Dashboard Sidebar:**
- `stone-0` bg, right border `stone-150`
- Width: 240px at ≥1280px, 200px at 1024–1279, 72px icon rail on tablet, full-width overlay drawer on mobile
- Nav items: px-4 py-2.5, rounded-md
- Active item: `primary-50` bg, `primary-500` text, font-semibold
- Hover: `stone-100` bg
- Section dividers with labels: text-xs uppercase tracking-wide stone-400
- Collapsible on tablet (icons only, 72px width)

### Status System

Consistent status pills across all contexts:

```
PENDING     → bg-gold-100  text-gold-600    — awaiting action
QUOTED      → bg-info-light text-info       — vendor sent quote
ACCEPTED    → bg-primary-50 text-primary-600 — agreed, awaiting payment
CONFIRMED   → bg-primary-50 text-primary-600 — paid, event upcoming (different icon from accepted)
COMPLETED   → bg-primary-100 text-primary-700 — event done
DECLINED    → bg-stone-100 text-stone-600   — vendor declined
CANCELLED   → bg-error-light text-error     — either party cancelled
EXPIRED     → bg-stone-100 text-stone-500   — timed out
```

Pill styling: `text-xs font-semibold uppercase tracking-wide px-2.5 py-1 rounded-full`

### Empty States

Never show a blank page. Every empty state gets:
- An illustration or contextual icon (large, muted, stone-300)
- A warm headline in Fraunces (e.g., "No bookings yet")
- A helpful description in Albert Sans, stone-600 (e.g., "When you book a vendor, your bookings will appear here")
- A relevant CTA button if applicable ("Browse vendors")

### Loading States

A single, consistent loading system used across the entire app. Three tiers based on scope — pick the right one for the context.

**Tier 1 — Inline / Element Loading (buttons, form submissions, small actions):**
- Spinner: 16px circle, 2px `primary-400` border with transparent top quarter, `spin` animation (1s linear infinite)
- Button loading: spinner replaces icon (or appears left of text), text dims to `opacity-60`, button disabled, cursor `not-allowed`
- Inline indicators: spinner next to text like "Saving..." or "Sending..." — Albert Sans 400, `stone-500`
- Never block the full page for a single-element action

**Tier 2 — Content / Section Loading (cards, lists, data regions):**
- **Skeleton screens** — always preferred over spinners for content areas
- Skeleton base: `stone-150` bg, `radius-md`, with shimmer animation
- Shimmer: CSS `@keyframes shimmer` — linear gradient sweep from left to right (`stone-150` → `stone-100` → `stone-150`), 1.5s ease-in-out infinite
- Skeleton shapes mirror the real content layout exactly:
  - **Text line**: `h-4 rounded-md` (body), `h-6 rounded-md` (heading), width varies (100%, 75%, 60%) for natural look
  - **Avatar**: `rounded-full`, matches real avatar size (36px, 40px, 80px)
  - **Image**: matches real aspect ratio (`aspect-4/3` for vendor cards, `aspect-21/9` for cover)
  - **Badge/pill**: `h-5 w-16 rounded-full`
  - **Button**: `h-10 w-28 rounded-[10px]`
- Pre-built skeleton variants (one component per content type):
  - `VendorCardSkeleton` — matches VendorCard layout: image block + avatar circle + 3 text lines + badge row + price line
  - `BookingCardSkeleton` — horizontal: image thumbnail left + 4 text lines + status pill + button right
  - `MessageSkeleton` — alternating left/right bubbles, 2-3 lines each
  - `ProfileHeaderSkeleton` — cover image + avatar + name line + detail lines
  - `TableRowSkeleton` — horizontal cells matching column widths
  - `FormSkeleton` — label + input pairs, stacked
- Grid skeletons: render 3-6 skeleton cards in the same grid layout as real content (respects viewport columns: 1/2/3)
- Section skeletons: heading skeleton + content skeletons grouped together

**Tier 3 — Full Page Loading (initial app load, route transitions):**
- Centered on page, vertically and horizontally
- Brand wordmark "VendorHub" in Fraunces 700, `primary-400`, `text-2xl`
- Gentle pulse animation: `opacity` 0.4 → 1 → 0.4, 2s ease-in-out infinite
- Below wordmark: single `stone-300` text line "Loading..." in Albert Sans 400, `text-sm`, `mt-4`
- Use only for: first app load, auth redirects, full-page data dependencies. Never for in-page navigation.

**Tailwind utilities (shared):**
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  @apply bg-stone-150 rounded-md;
  background-image: linear-gradient(
    90deg,
    theme(colors.stone.150) 0%,
    theme(colors.stone.100) 50%,
    theme(colors.stone.150) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}
```

**Rules:**
- Skeleton layout must match real content dimensions closely — a skeleton that shifts to a different size on load feels broken
- Show skeletons immediately (no delay) — perceived performance is better when something is visible instantly
- Minimum display time: 200ms — avoid flash-of-skeleton for fast loads (use a `setTimeout` guard or CSS `animation-delay`)
- Skeletons respect `prefers-reduced-motion` — disable shimmer animation, show static `stone-150` blocks
- Never combine a spinner and skeleton on the same screen — pick one tier
- Loading text is optional and contextual: "Finding vendors..." (search), "Loading your bookings..." (dashboard). Never generic "Please wait"

### Toasts / Notifications

- Bottom-right position (desktop), bottom-center (mobile)
- `stone-0` bg, `shadow-xl`, `radius-lg`
- Left accent border (4px) colored by type (sage=success, gold=info, error=error)
- Auto-dismiss: 5 seconds, manual close via X
- Slide-up entrance, fade-out exit

### Error Pages

Consistent error pages for unrecoverable states. Same warm aesthetic — errors shouldn't feel cold or broken.

**404 — Not Found:**
- Centered layout, generous vertical padding (py-24)
- Large "404" in Fraunces 700, `text-6xl`, `primary-200` (subtle, decorative — not alarming)
- Heading: "We couldn't find that page" — Fraunces 600, `text-2xl`, `stone-800`
- Body: "The page you're looking for may have been moved or no longer exists." — Albert Sans 400, `stone-600`, max-w-md
- CTA: "Back to home" primary button + "Browse vendors" secondary button
- Optional: decorative blob shape behind the 404 number

**500 / Generic Error:**
- Same centered layout
- Icon: AlertTriangle from Lucide, 48px, `stone-400`
- Heading: "Something went wrong" — Fraunces 600, `text-2xl`
- Body: "We're working on it. Please try again in a moment." — Albert Sans 400, `stone-600`
- CTA: "Try again" primary button (calls `router.refresh()`) + "Go home" secondary button

**Offline / Network Error (client-side):**
- Icon: WifiOff from Lucide, 48px, `stone-400`
- Heading: "You're offline"
- Body: "Check your connection and try again."
- CTA: "Retry" primary button

**403 — Forbidden:**
- Icon: ShieldX from Lucide, 48px, `stone-400`
- Heading: "You don't have access"
- Body: "You may need to sign in or check your permissions."
- CTA: "Sign in" primary button + "Go home" secondary button

### Confirmation Dialogs

Standard pattern for destructive or significant actions. Never use `window.confirm()`.

- Use shadcn `AlertDialog` (not `Dialog`) — enforces action, no backdrop-click dismiss
- Title: Fraunces 600, `text-lg`, `stone-800`. Direct question: "Cancel this booking?" not "Confirmation"
- Description: Albert Sans 400, `stone-600`. Explain consequences: "This will notify the vendor and you won't be able to undo this."
- Actions: right-aligned, gap-3
  - Cancel: secondary button, "Keep booking" (affirmative phrasing, not just "Cancel")
  - Confirm: destructive button (`bg-error text-white`) for destructive actions, primary button for non-destructive
- Destructive confirm text should name the action: "Yes, cancel booking" not "OK" or "Confirm"

### Pagination

Consistent pagination across search results, booking lists, review lists, admin tables.

- Centered below content, `mt-8`
- Layout: `< Prev` | `1` `2` `3` `...` `10` | `Next >`
- Page numbers: `w-10 h-10 rounded-md`, Albert Sans 500
  - Active page: `primary-400` bg, white text
  - Inactive: `stone-0` bg, `stone-700` text. Hover: `stone-100` bg
  - Ellipsis: `stone-400` text, non-interactive
- Prev/Next: secondary button style, disabled when at first/last page (`stone-300` text, `cursor-not-allowed`)
- Show max 7 page buttons: `1 2 3 ... 8 9 10` or `1 ... 4 5 6 ... 10` (current page centered in window)
- Mobile: simplify to `< Prev` | `Page 3 of 10` | `Next >` — no individual page numbers
- Results count above: "Showing 21-40 of 87 results" — `stone-500`, `text-sm`

### Progress Stepper

Reusable horizontal stepper for multi-step flows (booking lifecycle, vendor onboarding).

- Horizontal on desktop, vertical on mobile
- Each step: circle indicator (32px) + label below (Albert Sans 500, `text-sm`)
- Step states:
  - **Completed**: `primary-400` bg circle, white Check icon (16px), label in `primary-600`
  - **Current**: `primary-400` bg circle, white step number (Albert Sans 700), label in `primary-600` font-semibold
  - **Upcoming**: `stone-200` bg circle, `stone-400` step number, label in `stone-400`
- Connector lines between circles: 2px height
  - Completed→Current: `primary-400`
  - Current→Upcoming: `stone-200`
- Mobile vertical: circles left-aligned, labels right of circles, connector is vertical line

### Bottom Sheet / Mobile Drawer

Used for mobile filters, mobile navigation, and any mobile-only interaction panels.

- Triggered by button tap (not swipe-to-open)
- Slides up from bottom with spring animation (Framer Motion: damping 25, stiffness 300)
- Backdrop: `stone-900/40`, tap to dismiss
- Sheet: `stone-0` bg, `radius-xl` on top corners only, `shadow-xl`
- Drag handle: centered, `w-10 h-1 rounded-full bg-stone-300 mt-3 mb-2` — visual affordance, swipe-to-dismiss
- Max height: `85vh` — never covers full screen (shows backdrop peek)
- Content: scrollable if overflow, with `-webkit-overflow-scrolling: touch`
- Close: drag down past threshold (30% of height), tap backdrop, or explicit X button (top-right, `stone-400`)
- Use shadcn `Sheet` component with `side="bottom"` on mobile breakpoints

### Lightbox

For portfolio image galleries on vendor profile pages.

- Full-viewport overlay: `stone-900/90` backdrop (darker than modals — images need dark surround)
- Image: centered, `max-w-[90vw] max-h-[85vh]`, `object-contain`, `radius-lg`
- Navigation: left/right arrow buttons (48px circles, `stone-0/20` bg, white ChevronLeft/ChevronRight icons). Hover: `stone-0/40` bg. Position: vertically centered, 16px from viewport edge.
- Close: X button top-right (same style as nav arrows)
- Caption: below image, Albert Sans 400, `stone-300`, `text-sm`, max-w-lg centered
- Counter: "3 of 12" — top-left, `stone-400`, `text-sm`
- Keyboard: Left/Right arrows navigate, Escape closes
- Mobile: swipe left/right to navigate, tap image to toggle caption/controls
- Preload adjacent images for instant navigation
- Entrance: fade in backdrop 200ms + image scale(0.95)→scale(1) 300ms spring
- Exit: reverse of entrance

### Tooltips

For supplementary info on icons, truncated text, and data values.

- Use shadcn `Tooltip` component
- Styling: `stone-800` bg, `stone-0` text, Albert Sans 400, `text-xs`, `radius-sm` (6px), `px-3 py-1.5`
- Arrow: 6px, matches bg color
- Delay: 300ms open (avoids accidental triggers), 0ms close
- Position: top by default, auto-flip if near viewport edge
- Max width: 240px, word-wrap
- Mobile: tooltips don't show on hover — use a tap-to-reveal pattern or inline text instead
- Use for: icon-only buttons (always pair with `aria-label`), truncated vendor names, price breakdowns, stat explanations ("Based on 127 verified bookings")

### Scroll Behavior

**Sticky header:**
- Main header sticks at top on all viewports; height is a token (`--header-h`, 64px) because every full-height app shell is measured against it
- **Desktop (≥1024px): the header never hides.** Hide-on-scroll is a mobile technique for reclaiming a scarce 60px; on a 1440px display it just makes navigation unpredictable
- Mobile/tablet: on scroll down the header slides up and hides; on scroll up it returns. Transition `transform 300ms ease`, GPU-accelerated (`translateY`)
- Dashboard sidebar: fixed on desktop (`position: sticky; top: var(--header-h); height: calc(100dvh - var(--header-h))`), overlay drawer on mobile
- On app surfaces the *page* does not scroll at all — panes scroll independently, so the header, sidebar, and rails are always in place

**Scroll-to-top:**
- Floating button appears after scrolling 400px down
- Position: bottom-right, 24px from edge (above toast area)
- Style: `stone-0` bg, `shadow-md`, `rounded-full`, 40px, ChevronUp icon `stone-600`
- Hover: `stone-100` bg
- Entrance: fade-in + slide-up 200ms
- Smooth scroll to top on click

**Infinite scroll (review lists, "Show more"):**
- Prefer "Show more" button over true infinite scroll — gives user control
- Button: ghost style, "Show more reviews" with ChevronDown icon
- Loading state: button text changes to spinner + "Loading..."
- When no more items: button disappears, subtle "That's everything" text in `stone-400`

---

### Modern Styling Details

Contemporary design touches that elevate the platform beyond generic marketplace templates. Apply these consistently — they're what make the app feel designed, not assembled.

**Glassmorphism (selective):**
- Sticky header on scroll: `background: rgba(246, 247, 246, 0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);`
- Mobile bottom sheet overlay: same treatment
- Never on cards or body content — reserve for overlaying layers only

**Soft glow on focus:**
- Inputs on focus: `box-shadow: 0 0 0 3px rgba(238, 123, 63, 0.18); border-color: var(--color-primary-400);` — a terracotta glow ring instead of the default browser blue
- Applied to all interactive elements (inputs, selects, textareas, buttons via `:focus-visible`)

**Subtle noise texture (landing page only):**
- Very light grain overlay on hero and full-bleed sections: CSS `background-image: url("data:image/svg+xml,...")` with a tiny noise pattern at 2-4% opacity
- Adds tactile depth to the gradient backgrounds without competing with content
- Skip on dashboard/form pages — keep those clean

**Micro-border accents:**
- Cards on hover: add a faint `border-color: var(--primary-200)` transition (200ms) — the card "acknowledges" interaction without dramatic lifts
- Active sidebar item: 3px left border in `primary-400` instead of just a background change
- Package cards: subtle left border accent (3px) in `sage-200/300/400` varying by tier

**Text gradient (logo/hero only):**
- The "VendorHub" wordmark can use a subtle text gradient: `background: linear-gradient(135deg, #EE7B3F, #C44A16); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`
- Only on the logo and landing page hero headline — never on body text or UI labels

**Scroll-aware shadows:**
- Header shadow appears only after scrolling: `box-shadow: none` at top, transitions to `shadow-sm` after 10px scroll. Keeps the top of the page clean.

**Number/stat animations:**
- Dashboard metric cards: numbers count up from 0 on first render (CSS `@keyframes countUp` or Framer Motion). Duration 600ms, eased. One-time only (not on re-renders).

**Image hover parallax (vendor cards):**
- Cover images shift slightly on card hover: `transform: scale(1.03) translateY(-2px)` with `overflow: hidden` on the container. Creates depth without lifting the whole card.

---

## 6. Motion & Interaction

### Philosophy

Purposeful motion that feels organic, never mechanical. One well-orchestrated entrance sequence beats scattered micro-interactions. Motion should confirm actions and guide attention, not distract.

### Library

Use **Framer Motion** (`motion` package) for React component animations. CSS transitions for simple hover/focus states.

### Core Animations

**Page entrance (search results, dashboard content):**
- Staggered fade-up for card grids: each card `opacity: 0 → 1, y: 16 → 0`, stagger 50ms, duration 400ms, ease: `[0.25, 0.46, 0.45, 0.94]`
- Content sections: `opacity: 0 → 1, y: 24 → 0`, duration 500ms

**Card hover:**
- `translateY(-2px)`, shadow-sm → shadow-hover, transition 200ms ease
- Cover image: subtle `scale(1.03)` with overflow-hidden masking, transition 400ms ease

**Button interactions:**
- Hover: `scale(1.02)`, transition 150ms
- Active/click: `scale(0.98)`, transition 100ms
- Loading: gentle pulse on opacity

**Modal / Dialog:**
- Backdrop: fade in 200ms, `bg-stone-900/40` (warm tint)
- Panel: scale(0.95) + opacity(0) → scale(1) + opacity(1), spring-based (damping 20, stiffness 300)

**Sidebar navigation:**
- Active indicator slides between items (shared layout animation via Framer Motion `layoutId`)

**Scroll-triggered (landing page only):**
- Sections fade-up when entering viewport (Intersection Observer or Framer Motion `whileInView`)
- Trigger once, 20% threshold
- Keep it subtle — no dramatic slides or zooms

### Micro-interactions

- **Star rating input**: Stars scale up slightly (1.15) on hover, fill with gold on click with a brief bounce
- **Checkbox/toggle**: spring animation on state change, slight overshoot
- **Toast entrance**: slide-up + fade from bottom, spring-based
- **Image upload**: progress ring around thumbnail, checkmark bounce on complete
- **Message sent**: brief scale(0.97) → scale(1) pulse on the message bubble

### Performance Rules

- All animations respect `prefers-reduced-motion` — disable non-essential animations, keep functional transitions (modals opening/closing)
- No animation on scroll jank — use `will-change` judiciously, `transform` and `opacity` only for GPU-accelerated properties
- Page transitions: keep under 500ms total including stagger. Users should never wait for animations.

---

## 7. Imagery & Visual Texture

### Photo Treatment

- **Vendor cover images**: Always `aspect-ratio: 4/3` in cards, `aspect-ratio: 21/9` on profile hero. Object-cover with gentle `brightness(0.97)` to ensure consistency across varying photo quality.
- **Portfolio images**: Variable aspect ratios in masonry grid. Subtle hover overlay with eye icon for "view full"
- **Avatars**: Circle crop, 2px solid `stone-200` border. Default avatar: initials on `primary-100` bg in Fraunces
- **All images**: `radius-xl` (20px) unless in a card (inherits card radius). Use Next.js `<Image>` with blur placeholder.

### Decorative Elements (Landing Page & Auth Pages)

- **Organic blob shapes**: Subtle, large, positioned behind content sections. `primary-100` and `sage-100` fills, very low opacity (0.4-0.6). Created with CSS `border-radius` hacks or inline SVG. 2-3 per page max.
- **Dot grid pattern**: Very subtle `stone-200` dots (2px, 24px gap) as a section background texture. Applied via CSS radial-gradient pattern. Used on 1-2 landing page sections.
- **Warm gradient wash**: Hero section background can use a very subtle diagonal gradient from `stone-50` to `primary-50` — almost imperceptible but adds warmth.

### Icons

- **Icon library**: `lucide-react` (already in the shadcn/ui dependency tree). No other icon set, and no inline SVG paths in components.
- **Sizing**: `size-4` (16px, inline with text) · `size-5` (20px, nav and buttons) · `size-6` (24px, feature and section icons) · `size-8` (32px, empty states).
- **Colour**: inherits text colour by default. `stone-400` for decorative or muted icons.
- **Accessibility**: an icon beside a label is always `aria-hidden="true"`. An icon-only control carries `aria-label` and a 44×44px hit area on touch. An icon is never the only carrier of meaning — status colour plus icon plus text.

**Category icons.** Every category carries a lucide icon name in its seed data
(`CATEGORY_SEEDS` in `packages/shared/src/constants`), so the same mark appears on
the landing card, in the picker, on the filter, and on the profile badge. Surfaces
read the seed; they never pick an icon inline.

| Category | `slug` | `icon` | Lucide component |
|---|---|---|---|
| Photography | `photography` | `camera` | `Camera` |
| DJ/Music | `dj-music` | `music` | `Music` |
| Makeup/Beauty | `makeup-beauty` | `sparkles` | `Sparkles` |
| Decoration | `decoration` | `palette` | `Palette` |
| Catering | `catering` | `utensils` | `Utensils` |
| Floristry | `floristry` | `flower` | `Flower` |
| Videography | `videography` | `video` | `Video` |
| Planning | `planning` | `clipboard-list` | `ClipboardList` |
| Lighting/AV | `lighting-av` | `lightbulb` | `Lightbulb` |
| Rentals | `rentals` | `package` | `Package` |

- The mapping from icon name → component belongs in **one** shared module (`apps/web/src/components/category-icon.tsx`), built by the first ticket that needs it. It exports a `<CategoryIcon icon={category.icon} />` glyph and a `<CategoryIconBadge />` (glyph in a `primary-100` circle: 40px badge / 20px glyph on landing cards, 28px badge / 14px glyph inline).
- An unknown or `null` icon name falls back to `Shapes` rather than rendering nothing — a new seed must never leave a hole in a layout.
- **A category rendered as bare text is a bug**, wherever it appears.

**Standard icon vocabulary** — one meaning, one icon, everywhere:

| Meaning | Icon | Used on |
|---|---|---|
| Confirmed / complete | `CheckCircle2` (sage) | Status pills, publish checklist, success states |
| Pending / awaiting someone | `Clock` (gold) | Booking status, response time, suggestions under review |
| Needs your action | `AlertCircle` (terracotta) | Action-needed rail, publish blockers |
| Declined / cancelled / error | `XCircle` (error) | Status pills, form errors |
| Information | `Info` (info blue) | Banners, cancellation policy, fee explanations |
| Rating | `Star` (gold, filled) | Reviews, vendor cards, rating summaries |
| Money / payout | `Wallet` | Stripe Connect, earnings, price breakdown |
| Message | `MessageSquare` | Conversations, message CTAs |
| Booking / date | `CalendarDays` | Bookings, availability, event dates |
| Location / service area | `MapPin` | Vendor location, search filters |
| Upload | `ImagePlus` | Image drop zones |
| Remove a selection | `X` | Removable pills |
| Multi-select trigger | `ChevronsUpDown` | Comboboxes |
| Empty state (no results) | `SearchX` | Search, filtered lists |

---

## 8. Page-by-Page Design Specifications

**Every layout below describes 1440 × 900.** Each spec names the desktop
composition first; narrower viewports follow the degradation table in §9. Where a
spec gives a scroll budget, it is measured at the reference viewport.

### 8.1 Landing Page (`/`)

**Purpose**: First impression. Convert visitors into browsers (search) or sign-ups.

**Layout** (top to bottom):

**Scroll budget**: ≤ 4 screens — the one surface allowed a narrative scroll. The
hero *and* the search bar *and* the top of the category row must all be inside
the first 900px; a visitor should be able to start searching without scrolling.

1. **Hero Section** — Full-bleed, `py-20` at 1440 (not `py-24` — the search bar has to clear the fold)
   - Left content (58%) + Right image cluster (42%), side by side from 1024px up. Stacked only below that.
   - The right cluster is not decoration: it is the proof that real vendors are here, and it is what fills the width the current implementation leaves empty.
   - Headline: Fraunces 700, text-5xl (desktop) / text-3xl (mobile). E.g., *"Find the perfect vendor for your next event"*
   - Subtext: Albert Sans 400, text-lg, stone-600. One sentence max.
   - **Inline search bar**: Large, prominent, white bg with shadow-lg. Contains: text input ("What are you looking for?") + location input ("Where?") + primary CTA button ("Search"). Rounded-full treatment. This is the hero's centerpiece.
   - Right image cluster: 3 overlapping photos of vendor work (different categories) at slight rotations (rotate-2, -rotate-1, rotate-3), with shadow-lg. Creates dynamism and showcases real vendor work.
   - Background: `gradient-hero` (135deg from `stone-50` through `primary-50` to `primary-100`) — creates atmospheric depth. One large blob shape behind the image cluster.

2. **Category Browse** — Container width
   - Section heading: Fraunces 600, text-2xl. "Browse by category"
   - **The landing grid is a taste, not the taxonomy.** It features
     `LANDING_CATEGORY_COUNT` (6) categories — the first six by `displayOrder`,
     which doubles as landing priority. The full set lives on search, where a
     category is a filter you can click; a landing grid of eleven inert cards is
     bloat, not browse. 3 across at `lg`, 2 at `sm`, 1 below.
   - Category card: `stone-0` bg, `radius-xl`, **icon** in a `primary-100` circle (40px) beside the name (Fraunces 600) and a one-line description (stone-600, text-sm) saying which vendors sit inside. Hover: shadow-md. The description stands in for the vendor count until search (#6) can supply real counts.
   - **Every category has an icon, everywhere it appears** — landing card, search filter, category picker in the vendor form, category badge on a profile. The icon name is part of the category's seed data in `packages/shared/src/constants` (a `lucide-react` icon name), never chosen ad hoc per surface. A category rendered as a bare text row is a bug.
   - **Category names are one word.** The grid reads as a row of nouns and the
     description underneath carries the detail; a two-word name is a sign the
     category is really two categories.
   - Category set (11, in `displayOrder`): Photography, Entertainment, Catering,
     Venues, Beauty, Carts, Florals, Decor, Videography, Planning, Rentals. The
     first six are the landing feature set. Entertainment absorbs DJs, bands,
     and performers; Beauty absorbs makeup and hair; Decor absorbs lighting;
     Carts is coffee/ice cream/dessert/cocktail carts, distinct from Catering.
     Retired slugs map to their successor in `CATEGORY_SLUG_SUCCESSORS`, which
     `seedCategories` applies before its upsert.

3. **Featured Vendors** — Container width
   - Section heading: "Top-rated vendors near you"
   - 3-4 vendor cards in a row (standard VendorCard component)
   - "View all vendors →" ghost link below

4. **How It Works** — Full-bleed `stone-100` bg section
   - 3 steps, horizontal on desktop, vertical on mobile
   - Each step: Large number (Fraunces 700, text-4xl, primary-200 color — very subtle), heading (Fraunces 600), description (Albert Sans, stone-600)
   - Steps: "1. Discover — Browse vendors by category, location, and availability" → "2. Book — Select a package or request a custom quote" → "3. Celebrate — Pay securely and enjoy your event"
   - Connecting line or dots between steps (desktop only, decorative)

5. **Trust Section** — Container width
   - 3 trust signals in a row: "Verified reviews from real bookings", "Secure payments via Stripe", "No hidden fees — transparent pricing"
   - Each: Sage-400 icon (24px) + heading (Albert Sans 600) + short description (stone-600)

6. **CTA Banner** — Full-bleed, `gradient-dark` bg
   - Split: Left side for customers ("Ready to find your vendor?", CTA: "Get started — it's free"), Right side for vendors ("Grow your business", CTA: "Join as a vendor")
   - White text on `gradient-dark` bg. CTAs as white buttons with primary-400 text.

7. **Footer** — `stone-900` bg, cream/white text
   - Logo (Fraunces, stone-300), nav links grouped (For Customers, For Vendors, Company), social links, legal links (Terms, Privacy)
   - Copyright bottom bar
   - Warm, not corporate. "Made with love for the event community" or similar in stone-500

### 8.2 Search / Browse Vendors (`/search`)

**Purpose**: The core discovery experience. Must handle filtering without feeling heavy.

**Layout:**

- **Search bar** at top: Same style as hero but fixed-width (container). Carries over values from landing page.
**Layout at 1440**: full-height app shell — `--container-wide`, no page scroll.
A sticky **280px filter rail** on the left, results grid on the right scrolling
independently. The filter rail is always visible: filtering is the primary
activity on this surface, and burying it behind a button is a phone compromise.

- **Filter rail** (desktop) / filter bar (tablet) / "Filters" bottom sheet (mobile). Controls, each collapsible with its state summarised in the header when collapsed:
  - Category (multi-select dropdown)
  - Location (city/state inputs)
  - Price range (dual slider)
  - Date (date picker — check availability)
  - Rating (minimum stars)
  - Language (multi-select dropdown from active language tags)
  - Cultural (multi-select dropdown from cultural tags)
  - Dietary (multi-select dropdown from dietary tags)
  - Sort (relevance, price low-high, price high-low, top rated, newest)
  - Active filters shown as removable pills below the bar
  - "Clear all" ghost link

- **Results grid**: VendorCard components — 4-col at ≥1600, 3-col at 1280–1599, 2-col at 1024–1279, 1-col below. The grid scrolls inside its pane; the rail, search bar, and result count do not.
- **Results count**: "Showing 24 photographers in Austin, TX" — above grid, stone-600
- **Pagination**: Page numbers + prev/next, centered below grid. Active page: primary-400 bg. Simple and clear.
- **No results**: Warm empty state — "No vendors match your search" + suggestions to broaden filters + featured vendors fallback

**Key UX details:**
- Filters update results without full page reload (URL params via `nuqs`, SWR revalidation)
- Skeleton loading for cards during filter changes (not a full-page spinner)
- Filter state persisted in URL — shareable, back-button works
- On mobile: filters collapse into a "Filters" button that opens a bottom sheet/drawer

### 8.3 Vendor Profile (`/vendors/[slug]`)

**Purpose**: The most important page. This is where a customer decides to book. Must showcase the vendor's work beautifully and build trust.

**Layout:**

**Layout at 1440**: cover + header full width, then a two-column body —
content column (flexible) + **sticky 380px booking rail** on the right holding
price-from, the CTAs, response time, and key details. The rail is the page's
whole purpose; it should never scroll out of view. Scroll budget ≤ 2.5 screens.

1. **Hero / Cover**: Full-bleed cover image, `aspect-ratio: 21/9` (capped at 400px tall so it cannot eat the fold), with a subtle dark gradient overlay at bottom for text legibility. If no cover image, use a warm gradient (`primary-100` to `sage-100`).

2. **Profile header** (overlapping cover bottom by ~40px):
   - Avatar (80px, circle, white border) positioned left
   - Business name (Fraunces 700, text-3xl)
   - Category badges (pill style)
   - Vendor tags below categories — grouped inline: language tags (info-light bg, info text), cultural tags (primary-50 bg, primary-600 text), dietary tags (sage-50 bg, sage-600 text). Pill style, text-xs, radius-sm, gap-1.5. Max 6 shown, "+3 more" overflow pill expands on click.
   - Location + response time (stone-600, text-sm)
   - Rating: Gold stars + "4.8 (127 reviews)" linked to reviews section
   - Right side (desktop): Two CTAs — "Send a message" (secondary) + "Request booking" (primary)
   - Sticky on scroll (desktop): When user scrolls past the header, a slim sticky bar appears with vendor name + CTAs

3. **Tab navigation**: About | Packages | Portfolio | Reviews | Availability
   - At ≥1280px these are **real tabs that swap the content pane** — five sections stacked into one long anchor-scroll is a mobile pattern, and it buries the reviews a customer came to read.
   - Sticky under the profile header; underline-style active indicator; state in the URL (`?tab=`) so tabs are shareable and the back button works.
   - Below 1280px they degrade to anchored sections with a scroll-spy indicator, scrollable horizontally on mobile.

4. **About section**:
   - Vendor bio in clean prose. Max-width 720px for readability.
   - Key details sidebar (desktop) or below (mobile): Years of experience, events completed (derived from completed bookings), service area, response time
   - If vendor has a tagline, show it as a Fraunces italic pull-quote above the bio

5. **Packages section**:
   - Package cards (2-col desktop, 1-col mobile), as described in component spec
   - Each card: Name (Fraunces 600), price (Albert Sans 700, primary-500), duration, description, inclusions checklist
   - "Select" button on each → opens booking request flow
   - If no packages, show "Contact for pricing" message + message CTA

6. **Portfolio section**:
   - Masonry grid of portfolio images (CSS columns: 3 desktop, 2 mobile)
   - Click opens a lightbox (full-screen overlay with prev/next navigation)
   - Image captions visible on hover (desktop) or below image (mobile)
   - If <3 images, show them in a clean row instead of masonry

7. **Reviews section**:
   - Overall rating: Large star display (Fraunces 700, text-4xl rating number + gold stars) with rating distribution bar chart (5 horizontal bars showing percentage at each star level, `primary-400` fill)
   - Individual review cards:
     - Reviewer first name + initial (privacy), avatar if available
     - Star rating + date
     - Review title (Albert Sans 600) + content
     - Event type badge (e.g., "Wedding", "Corporate Event")
   - Pagination: "Show more reviews" button (not page numbers — infinite-scroll-style append)
   - "Write a review" link only visible if the logged-in user has a completed booking with this vendor

8. **Availability section**:
   - Calendar view (current month + next month side by side on desktop)
   - Color-coded: Available (white/clickable), Booked (primary-100, not clickable), Blocked (stone-200, not clickable)
   - Legend below calendar
   - Clicking an available date pre-fills it in the booking request form

### 8.4 Sign Up & Sign In (`/sign-up`, `/sign-in`)

**Purpose**: Quick, frictionless entry. Role selection for sign-up is critical — it's irreversible per D4.

**Layout at 1440**: a **split screen**, not a card floating in a field of cream.
Left half (≥1280px): the auth panel on `stone-50`. Right half: a full-bleed
marketing panel — one vendor photograph under a `gradient-dark` wash, with a
single line of proof over it ("2,400 events booked this year") in Fraunces. It
uses the width honestly and it is the last thing a hesitant sign-up sees.
Below 1280px the marketing panel drops and the auth panel centres.

**Sign Up Layout (auth panel):**
- Centered card (`max-w-md`) — deliberately narrow: this is the one surface where a single focused column beats using the width, because the decision is one field at a time. Fill the space beside it at ≥1280px with the marketing panel described below rather than leaving empty gutters.
- Logo at top center (Fraunces wordmark)
- **Role selection first** (before Clerk form): Two large clickable cards side by side:
  - "I'm planning an event" — icon (PartyPopper or Calendar), description, → sets `customer` role
  - "I'm an event vendor" — icon (Briefcase or Store), description, → sets `vendor` role
  - Selected card: `primary-50` bg, `primary-400` border (3px), scale(1.02)
  - Unselected: `stone-100` bg, `stone-200` border
- Role cards sit **side by side** on one row at every width above 640px — they are a comparison, and stacking them turns a choice into a scroll
- After role selection, show Clerk `<SignUp>` with the appearance below. The chosen role stays visible with a "Change" affordance, so the decision (irreversible per D4) is never made blind
- Subtle decorative blob shape behind the card
- The whole panel — role choice and form — must fit inside 836px without scrolling

**Sign In Layout:**
- Same centered card approach
- Clerk `<SignIn>` component with custom appearance
- "Don't have an account? Sign up" link below

**Clerk Appearance Customization:**

The app wraps `<ClerkProvider appearance={{ theme: shadcn }}>` (`@clerk/ui/themes`),
so Clerk inherits the shadcn slots already bound to the VendorHub palette in
`globals.css`. Do not hand-write brand hexes into a Clerk appearance object —
that is a second source of truth that silently drifts. Override individual
elements only where Clerk's defaults fight the design system:

```ts
appearance: {
  theme: shadcn,
  elements: {
    card: { boxShadow: 'none', border: 'none' },  // the page already provides the card
  },
}
```

### 8.5 Customer Dashboard (`/dashboard`)

**Purpose**: Home base after login. Quick status of active bookings, messages, and actions needed.

**Layout at 1440**: full-height app shell, **no page scroll** (budget 1.0×).
Fixed 240px sidebar + a 12-column content grid:

```
┌────────┬──────────────────────────────────────┬───────────────────┐
│        │  Welcome + date + next-event count   │                   │
│ Side   ├──────────────────────────────────────┤  Action needed    │
│ bar    │  Upcoming bookings (3-up cards)      │  (rail, 340px)    │
│ 240px  ├──────────────────────────────────────┤  Recent messages  │
│        │  Quick actions                       │  Quick stats      │
└────────┴──────────────────────────────────────┴───────────────────┘
```

- Sidebar nav items: Dashboard, My Bookings, Messages, Account Settings
- Notification bell with unread count in header
- The right rail carries everything time-sensitive, so "what needs me" is visible without scrolling or hunting

**Dashboard content:**
- **Welcome banner**: "Welcome back, [First Name]" — Fraunces 600, text-2xl. Below: today's date, upcoming event countdown if any.
- **Action needed cards** (top priority): If any bookings need attention (quoted — needs response, upcoming event). Styled with gold-100 bg, gold-400 left border.
- **Upcoming bookings**: Horizontal scrollable cards showing next 3 upcoming events. Card shows: vendor name, event date (large, Fraunces), event type, status pill.
- **Recent messages**: Last 2-3 conversations with preview. "View all →" link.
- **Quick actions**: "Find a vendor" (primary), "Browse categories" (secondary)

### 8.5b Customer Profile (`/profile`)

**Purpose**: Customer manages their profile, preferences, booking history, and reviews. Also defines the mini-profile card vendors see when evaluating booking requests.

**Layout**: Dashboard shell with "My Profile" in sidebar nav. Tabbed content area.

**Tabs**: Profile | Bookings | Reviews

**Profile tab:**
- **Profile header**: Avatar (80px circle, Clerk default or uploaded photo, click to change), name (Fraunces 600, text-2xl), "Member since [year]" (stone-500, text-sm), email-verified badge (primary-400 checkmark)
- **Profile form** (below header, `--container-form`, two-column field grid per §5):
  - Bio (textarea, 300 char max, placeholder: "Tell vendors a bit about yourself")
  - City + State (one row) — placed directly under the bio, before preferences: where someone is planning shapes every vendor they see
  - Budget tier: Radio group styled as selectable cards (2x2 grid):
    - `$` Budget — "Under $500 per vendor" (stone-100 bg, stone-700 text)
    - `$$` Mid-range — "$500 – $2,000 per vendor"
    - `$$$` Premium — "$2,000 – $10,000 per vendor"
    - `$$$$` Luxury — "$10,000+ per vendor"
    - Selected: primary-50 bg, primary-400 border (3px), scale(1.02)
    - Dollar signs: Fraunces 700, primary-400 color, text-xl
    - Label + range: Albert Sans, text-sm
  - Typical guest count: Two number inputs side-by-side ("Minimum" / "Maximum") with "guests" suffix text
  - "Save changes" primary button

**Bookings tab:**
- Matches §8.6 spec exactly — tabs for Active/Past, booking cards with vendor thumbnails
- Empty state: Calendar icon (stone-300, 48px), "No bookings yet" (Fraunces 600), "When you book a vendor, your bookings will appear here" (stone-600), "Browse vendors" primary CTA

**Reviews tab:**
- Shows vendor→customer reviews (public reviews about this customer)
- Stats header (if 5+ reviews): Average rating (Fraunces 700, text-4xl + gold stars), review count, rating distribution bars (same pattern as §8.3.7)
- Review cards: Vendor business name (Fraunces 600, linked), star rating (gold-400), event date, review content. Newest first, paginated (10/page).
- Empty state: Star icon (stone-300, 48px), "No reviews yet" (Fraunces 600), "Reviews from vendors will appear here after completed events" (stone-600)

**Customer Mini-Profile Card** (component, used inline on vendor booking request view):
```
┌─────────────────────────────────────┐
│  [Avatar 40px]  First Name          │  Albert Sans 600, text-lg
│                 Member since 2026   │  stone-500, text-xs
│                 ✓ Email verified    │  primary-400, text-xs
├─────────────────────────────────────┤
│  12 bookings · 95% completed       │  stone-700, text-sm, Albert Sans 500
│  ★ 4.7 (8 reviews)                 │  gold-400 star, stone-600, text-sm
├─────────────────────────────────────┤
│  "Planning events in the Bay Area"  │  stone-600, text-sm, italic (bio)
├─────────────────────────────────────┤
│  $$ Mid-range · 50–150 guests      │  stone-500, text-xs
├─────────────────────────────────────┤
│  Recent reviews:                    │  stone-500, text-xs, uppercase
│  ★★★★★ "Great communicator, paid   │  stone-700, text-sm
│  on time" — Jane's Photography     │  stone-500, text-xs
│  ★★★★☆ "Clear on requirements"     │
│  — DJ Marcus                        │
└─────────────────────────────────────┘
```
- Card: stone-0 bg, radius-lg, shadow-sm, max-w-sm
- "New member" badge (gold-100 bg, gold-600 text, text-xs, rounded-full) replaces stats row when zero bookings
- No photo shown pre-acceptance — use initials avatar (primary-100 bg, primary-600 text, Fraunces)

### 8.6 Customer Bookings (`/bookings`, `/bookings/[id]`)

**Layout at 1440**: master–detail in a full-height shell — a 380px booking list
on the left, the selected booking's detail in the pane on the right, each
scrolling independently. Selecting a booking updates the URL
(`/bookings/[id]`) so the detail is still linkable; visiting that URL directly
at desktop renders both panes with the booking selected. Below 1280px the list
and the detail become separate pages.

**Bookings list (left pane):**
- Tabs: "Active" (pending, quoted, accepted, confirmed) | "Past" (completed, cancelled, declined, expired)
- Booking cards: Horizontal layout, vendor cover image thumbnail left, details right
  - Vendor name (Fraunces 600), event date, event type, status pill
  - Price (if set)
  - Action buttons contextual to status:
    - Quoted: "Review quote" (primary), "Decline" (ghost)
    - Accepted: "Pay now" (primary)
    - Confirmed: "Message vendor" (secondary), "Cancel" (ghost destructive)
    - Completed: "Leave a review" (primary, if not yet reviewed)

**Booking detail (`/bookings/[id]`):**
- Full booking info card:
  - Vendor info: Avatar + name + link to profile
  - Event details: Date (Fraunces, large), type, location, guest count
  - Package details (if package booking): Name, inclusions
  - Custom request details (if custom): Original request text
  - Quote info (if quoted): Vendor's quoted price + note
  - Price breakdown: Package/quote price, platform info, total
  - Status timeline: Visual stepper showing booking lifecycle progression (pending → quoted → accepted → confirmed → completed). Current step highlighted in primary-400, past steps in primary-400 with check icons, future steps in stone-300.
- **Payment section** (when status=ACCEPTED): Stripe Elements embedded, styled to match. Primary CTA: "Pay $X.XX — Confirm Booking"
- **Cancellation policy** shown above payment: Clear text, not buried. "> 48h: full refund. < 48h: 50% refund."
- **Conversation link**: "View messages with [Vendor Name]" — links to conversation

### 8.7 Booking Request Flow

**Triggered from**: Vendor profile page ("Request booking" or package "Select" button)

**Step 1 — Event Details** (modal or dedicated page):
- Selected package shown at top (if package booking) with price
- Form fields:
  - Event date (date picker, only shows available dates from vendor calendar)
  - Event type (text input with suggestions: Wedding, Birthday, Corporate, etc.)
  - Event location (text input)
  - Guest count (number input)
  - Additional details (textarea — "Tell the vendor about your event")
- For custom requests (no package): same form but with a "Describe what you need" textarea instead of package selection

**Step 2 — Review & Send**:
- Summary card showing all details
- "You're requesting, not paying yet" reassurance text
- "Send Request" primary button
- After submission: Success state with "What happens next: The vendor will review your request and respond within [X] hours" + link to messages

### 8.8 Vendor Dashboard (`/dashboard` for vendor role)

**Purpose**: Vendor's command center. Prioritizes incoming requests and booking management.

**Layout at 1440**: same full-height shell as the customer dashboard, **no page
scroll**. Fixed 240px sidebar + 12-col content + a 340px right rail that holds
the **publish checklist** for as long as the profile is unpublished, and the
day's schedule afterwards. The checklist is a rail, not a banner: it is
referenced repeatedly while the vendor works through other pages.

- Sidebar: Dashboard, Edit Profile, Packages, Availability, Bookings, Messages, Stripe Payments, Account Settings

**Dashboard content:**
- **Onboarding progress** (shown until all steps complete): Horizontal stepper or checklist:
  - Create profile ✓
  - Add packages ✓
  - Upload portfolio (3+ photos) □
  - Set availability □
  - Connect Stripe □
  - Publish profile □
  - Each step links to the relevant page. Incomplete steps have primary-400 "Complete" button.
  - Styled as a prominent card with primary-50 bg when in progress, primary-100 bg when complete

- **Action needed**: New booking requests (gold-100 bg card). Count + "Review requests" link.
- **Stats row**: 4 metric cards across the content grid — "Bookings this month", "Response rate", "Rating", "Earnings this month". Numbers in Fraunces, label above in `text-xs` uppercase. One row, never a stacked column.
- **Upcoming bookings**: Same horizontal scroll as customer dashboard but from vendor perspective.
- **Recent messages**: Preview cards.

### 8.9 Vendor Profile Edit (`/profile/edit`)

**Purpose**: The vendor's first real experience of the product, and the surface
they return to most. It is a form, but it is also the pitch — it should feel like
setting up a storefront, not filling in a tax return.

**Layout at 1440**: `--container-form` (1040px) with a **sticky 200px section
nav** on the left at ≥1280px, and the form pane to its right on a two-column
field grid. A sticky submit bar at the bottom of the pane carries the primary
action, the save state, and the publish blockers. **Scroll budget: ≤ 1.5
screens** — this page is the worst offender in the current build at 3.0 screens
with a 520px column inside a 1440px viewport, and roughly half the width empty.

```
┌───────────────┬──────────────────────────────────────────────────┐
│ Business      │  [ Profile photo ]  [ Cover image             ]  │
│ Location   ●  │  ─────────────────────────────────────────────   │
│ Tags          │  Business name          │  Profile link          │
│ Response      │  About your business (full width)                │
│ Publish    ●  │  Categories (full width, icon chips)             │
│               │  ─────────────────────────────────────────────   │
│ (gold dot =   │  Address (full width)                            │
│  blocks       │  City                   │  State                 │
│  publishing)  │  Service radius (miles) │  Response time         │
└───────────────┴──────────────────────────────────────────────────┘
                   [ sticky: save state · Create/Save profile ]
```

**Sections, in importance order** — a vendor who stops halfway must already have
given the things that matter most (who they are, where they work):

1. **Business information**
   - **Media pair, first row**: profile photo and cover image **side by side**, profile photo **first** (left, 160px circle), cover image to its right (`aspect-21/9` drop zone filling the remaining width). They describe one thing — the vendor's visual identity — so they belong on one row. A full-width cover zone above a lone circle reads as an orphaned row and wastes a third of the screen.
   - Business name + profile link (one row; the slug preview sits under its field)
   - About your business (textarea, full width, min-h-[140px])
   - Categories (full width): multi-select shown as **icon chips** — each category's `lucide-react` icon in a `primary-100` circle plus its name, selected state filled in `primary-50` with a `primary-400` border. Category identity is visual everywhere in the product (§8.1), and this is where a vendor first meets it.
2. **Location & service area** — *before* tags. Where a vendor works decides whether a customer ever sees them; it is a harder, more consequential answer than a taste tag, and it belongs with the rest of the business's facts.
   - Address (full width) · City + State (one row)
   - **Service radius in miles.** The audience is US-based, so miles is the unit at every display boundary — the slider, the value label, the profile, and search. It is stored as `service_radius_km` and converted with the helpers in `packages/shared/src/utils`, exactly as money is stored in cents and formatted at the edge. Slider range 5–125 miles in 5-mile steps.
3. **Tags** — languages, cultural specialties, dietary. Three grouped multi-selects on one row at ≥1280px (they are peers, and stacking them costs a screen of height).
   - Options render in the **`displayOrder` from the tag seeds**, never alphabetically and never in database insertion order. Dietary is *Vegan, Vegetarian, Halal, Kosher*; that order is defined once in `packages/shared/src/constants` and every surface — picker, profile, search filter — reads it from there.
   - Each section keeps its "Don't see yours?" suggestion flow (dedup on submit, toast on match) described in the tag component spec.
4. **Response time** — paired on the location row's remaining column rather than given a card of its own; one select does not deserve 160px of vertical space.
5. **Publish** — the toggle lives in the sticky submit bar, not at the bottom of a scroll. Unmet prerequisites are listed beside it and mirrored as gold dots in the section nav, so a vendor can see *what* is blocking and *where* to fix it without scrolling the form.

**Save behavior**: explicit "Save changes" in the sticky bar (safer than autosave
for an agentic build), with an inline "Saved" confirmation that fades after 2s.
The bar reflects unsaved-changes state so the vendor can leave the page knowingly.

### 8.10 Package Management (`/packages`)

**Layout at 1440**: master–detail — package list on the left (360px), the
selected package's editor in the pane on the right. Creating a package opens the
editor pane with empty fields; it does not open a modal, because a vendor edits
several packages in one sitting and a modal makes them re-enter the surface each
time. Below 1280px the editor becomes a full-page route.

**Package list (left pane):**
- Cards showing: Name, price, status (active/inactive toggle), drag handle for reordering
- Edit/delete actions per card
- "Add a package" card: Dashed border, `stone-200`, plus icon, center-aligned text. Hover: `primary-50` bg.

**Package form** (modal or inline expansion):
- Name (text input)
- Description (textarea)
- Price (currency input — dollar sign prefix, cents handled, min $25 enforced)
- Price type (radio group: Fixed price, Starting at, Per hour)
- Duration (number input, hours)
- Max guests (number input, optional)
- Inclusions (dynamic list — add/remove items, each is a text input)
- Active toggle

### 8.11 Availability Calendar (`/availability`)

**Layout at 1440**: full-height shell showing **three months side by side**
(two at 1024–1439, one below), which covers a typical booking horizon without a
single click of month navigation. A 300px rail on the right holds the legend,
bulk actions, and the selected range summary.

**Calendar design:**
- Month grid with day cells
- Navigation: < Month Year > (Fraunces 600 for month/year)
- Day cells show status via color (same as defined in component spec)
- Click to toggle: Available → Blocked → Available
- Booked days (from confirmed bookings) shown differently — locked, with booking info tooltip
- Bulk actions: "Block dates" range selector, "Clear blocked dates"
- Today highlighted with primary-400 ring

**Key interaction**: Click-and-drag to select a range of dates, then apply status. Mobile: tap individual dates.

### 8.12 Messaging (`/messages`)

**Layout at 1440**: three panes in a full-height shell, none of which scroll the
page — conversation list (300px) + thread (flexible) + **booking context rail**
(320px) showing the linked request: event date, package, status, price, and the
actions available in that status. The context rail is the difference between a
chat app and a booking tool; it removes the tab-switching that otherwise sits
between a vendor and a reply.

At 1024–1279 the context rail collapses to a toggle. On tablet: two panes
(40/60). On mobile: list → thread with a back arrow.

**Conversation list:**
- Each item: Other party avatar + name (Albert Sans 600) + last message preview (truncated, stone-500) + timestamp (stone-400)
- Unread: Bold name, primary-400 dot indicator, stone-0 bg (stands out from stone-50 list bg)
- Active conversation: `primary-50` bg
- Booking context badge on conversations linked to a booking request

**Conversation view:**
- Header: Other party name + avatar, booking context link ("Re: Wedding Photography — June 15"), status pill
- Message bubbles: As described in component spec
- Input area: Textarea (auto-resize) + send button (primary, icon only on mobile)
- Typing indicator: not MVP (SSE doesn't support it cleanly). Just show new messages appearing.
- Scroll: Auto-scroll to bottom on new messages. "New messages ↓" floating button if user has scrolled up.

### 8.13 Reviews (`/reviews` — submission flow)

**Review submission** (triggered after booking completed):

- Banner on completed booking card: "How was your experience with [Vendor]? Leave a review" (primary-100 bg, Fraunces heading)
- Form in modal or inline:
  - Star rating: Interactive 5-star input, large (32px stars), gold fill animation on selection
  - Title (text input, optional but encouraged)
  - Review text (textarea, min 20 chars guidance)
  - "Submit review" primary button
- After submission: "Thank you!" success state, review appears on vendor profile

**Review display** (on vendor profile):
- As described in vendor profile page spec (section 8.3.7)

### 8.14 Stripe Connect Onboarding (`/stripe/connect`)

**Layout**: Simple, informational page explaining what happens

- Headline: "Connect your payment account" (Fraunces)
- Explanation: "We use Stripe to process payments securely. You'll earn [88]% of each booking. Setup takes about 5 minutes."
- Commission breakdown: Visual bar showing 88% vendor / 12% platform
- "Connect with Stripe" primary button → redirects to Stripe hosted onboarding
- After return: Status card showing "Connected" with a sage badge, or "Incomplete — finish setup" with a gold warning badge
- Payout info: "Payouts are sent to your bank account after each completed event"

### 8.15 Checkout / Payment (`/bookings/[id]/pay`)

**Layout at 1440**: two columns inside `--container-app` — payment form on the
left (the thing being acted on), **sticky order summary rail** on the right
(420px). The total and the "what am I paying for" summary stay visible through
the whole form. Scroll budget ≤ 1.5 screens. On mobile the summary collapses to
an accordion above the form with the total always shown.

**Order summary (left):**
- Vendor card (mini): Avatar + name + category + rating
- Event details: Date, type, location
- Package name (or "Custom request")
- Price breakdown:
  - Package price: $XXX
  - Service fee: $0 (absorbed — show "No service fee" in primary text as a trust signal)
  - **Total: $XXX** (Fraunces 700, text-xl)
- Cancellation policy summary (stone-600, text-sm)

**Payment form (right):**
- Stripe Elements (CardElement or PaymentElement), styled to match:
  ```ts
  elements.create('payment', {
    style: {
      base: {
        fontFamily: "'Albert Sans', sans-serif",
        fontSize: '16px',
        color: '#242826',
        '::placeholder': { color: '#9A9E98' },
      }
    }
  })
  ```
- "Pay $XXX — Confirm Booking" primary button (large)
- Stripe badge / "Powered by Stripe" below for trust
- Lock icon + "Your payment info is encrypted" reassurance

**Success state** (after payment):
- Full-page celebration moment:
  - Large white checkmark icon with spring animation, `gradient-success` (sage) background
  - "Booking confirmed!" (Fraunces 700, text-3xl, white text on gradient)
  - Event summary card
  - "Message your vendor" + "View booking" CTAs
  - Subtle confetti or sparkle animation (small, tasteful — one burst, not continuous)

### 8.16 Admin Portal (`/admin/*`)

**Design approach**: Functional but still warm. Same typography and color system but denser layouts. This is a tool, not a consumer experience — prioritize scannability over aesthetics.

**Layout**: Sidebar + main content, same full-height shell, admin-specific nav.
Tables fill the viewport with a **fixed header row and internal scrolling** —
never a page-scrolling table — and target ~18 rows visible at 1440 × 900 using
the dense row height from §4. Filters live in a bar above the table, not a modal.

**Dashboard**: Metric cards (4-up grid), charts for bookings/revenue over time (simple line charts, use a lightweight chart lib like Recharts). Color-code metrics: revenue in gold, bookings in primary, users in info, completion in sage.

**List views** (vendors, users, bookings, reviews): Data tables with:
- Search input at top
- Filter dropdowns
- Sortable columns
- Row actions (dropdown menu)
- Status pills
- Pagination
- Bulk actions where relevant

**Detail views**: Card-based layouts grouping related info. Action buttons prominent.

---

## 9. Target Viewports & Responsive Testing

**This is a desktop-first product.** The people using it are at a laptop: a
couple comparing four photographers across browser tabs, a vendor working
through a week of requests between gigs. Design, build, and review every surface
at **1440 × 900 first**. Tablet and mobile are adaptations of a finished desktop
composition — they must work, and they must not break, but they never dictate
the desktop layout.

### Reference & Test Viewports

| Viewport | Width × Height | Role |
|---|---|---|
| **Desktop — reference** | 1440 × 900 | The design target. Every layout in §8 describes this size. |
| **Large desktop** | 1728 × 1080 | Must gain *density* — more columns, wider rails — not wider margins. |
| **Laptop** | 1280 × 800 | The narrowest full-desktop layout: rails and panes still present. |
| **Tablet** | 768 × 1024 | Adaptation: rails become drawers, master–detail becomes navigation. |
| **Mobile** | 390 × 844 | Adaptation: single column, bottom sheets, back-arrow navigation. |

### The Vertical Budget

At 1440 × 900 with a 64px header, a surface has **836px of first screen**. That
is the budget, and it is spent before anything else.

- **Every surface delivers its purpose in the first screen**: the page's subject, its most important status, and its primary action are visible without scrolling.
- **Scroll budget** — total document height as a multiple of the viewport at 1440 × 900:

| Surface | Budget |
|---|---|
| App shells — dashboards, search, messaging, availability, packages, admin | **1.0×** — the page never scrolls; panes scroll internally |
| Forms — profile edit, package editor, checkout | ≤ 1.5× |
| Detail views — booking detail, vendor profile | ≤ 2.5× |
| Landing page | ≤ 4× — a narrative, and the only surface allowed one |

If a surface is over budget, the fix is **a layout change** — a second column, a
rail, a pane, a tab — not smaller type, not tighter padding, and never a
scrollbar the user is expected to accept.

### Responsive Degradation (desktop → down)

| Element | **Desktop 1440 (design target)** | Laptop 1280 | Tablet 768 | Mobile 390 |
|---|---|---|---|---|
| Nav | Horizontal links, header always visible | Horizontal links | Hamburger → drawer | Hamburger → drawer |
| Dashboards | Sidebar + 12-col content + 340px rail, no page scroll | Sidebar + content, rail wraps under | Icon rail sidebar | Full width, no sidebar |
| Search | 280px filter rail + 3-col results (4-col ≥1600) | Same, 3-col | Filter bar, 2-col | "Filters" sheet, 1-col |
| Vendor profile | Content + sticky 380px booking rail, tabbed sections | Same, 340px rail | Rail becomes an inline card, anchored sections | Stacked, sticky bottom CTA bar |
| Bookings | Master–detail, 380px list + detail pane | Same | List → detail page | List → detail page |
| Messages | 3 panes: list / thread / booking context | 2 panes + context toggle | 2 panes 40/60 | List → thread |
| Forms | 2-col field grid + sticky section nav + sticky submit bar | Same, nav collapses to a rail of dots | 2-col fields, nav on top | 1 col, submit bar sticky |
| Calendar | 3 months side by side + actions rail | 2 months | 1 month | 1 month, swipe |
| Checkout | Form + sticky 420px summary rail | Same | Same, narrower | Summary accordion above form |
| Packages | List + inline editor pane | Same | List, full-page editor | List, full-page editor |
| Admin tables | Fixed header, internal scroll, ~18 rows visible | ~14 rows | Horizontal scroll | Card list |
| Footer | 4-col | 4-col | 2-col | Stacked |

### Desktop Review Checklist (per FE ticket)

Run this at **1440 × 900 first**. A surface that fails here is not shippable
however well it behaves at 390px.

- [ ] The page's purpose, primary status, and primary action are visible without scrolling
- [ ] The surface is within its scroll budget (measure it: `document.documentElement.scrollHeight / innerHeight`)
- [ ] No centred column leaving >30% of the viewport as empty gutter
- [ ] Related fields and paired media sit side by side, not stacked
- [ ] Sidebars, filter rails, summary rails, section navs, and submit bars stay fixed while content scrolls
- [ ] Nothing important is hidden in a modal that a persistent rail could hold
- [ ] Information is ordered by importance — the consequential answers come before the optional ones
- [ ] At 1728 the layout gains columns/rows, not margins
- [ ] Type follows the two-density rule (§2) — no `text-4xl` headings inside an app frame

### Adaptation Checklist (1280 / 768 / 390)

Only after the desktop review passes:

- [ ] Renders without horizontal overflow at each width
- [ ] Nothing clipped, overlapped, or unreachable
- [ ] Touch targets ≥ 44 × 44px at 768 and 390
- [ ] Rails, panes, and master–detail degrade per the table above — not by simply stacking everything
- [ ] Modals/drawers use the right pattern for the width (bottom sheet on mobile, centred modal above it)
- [ ] Images keep their aspect ratios and do not overflow
- [ ] Interactive states suit the input method (hover is pointer-only)


## 10. Tailwind & shadcn/ui Customization Notes

### Tailwind Config Overrides

**Tailwind 4 is CSS-first — there is no `tailwind.config.ts` palette.** All
design tokens live in `packages/config/tailwind/theme.css` under `@theme`, and
each app imports it after `@import 'tailwindcss'`. The colour, radius, shadow,
and font values in §2–§4 are that file's contents; keep the two in step.

**The layout variables tickets read.** These belong in the same `@theme` block
as the colour and type tokens. A ticket that needs a chrome width, a container
ceiling, or a row height takes it from here — it does not measure one into a
class name.

```css
@theme {
  /* --- Container ceilings (§4) — Tailwind emits max-w-prose/form/app/wide --- */
  --container-prose: 45rem;    /* 720px  — long-form reading */
  --container-form:  65rem;    /* 1040px — two-column form pane */
  --container-app:   90rem;    /* 1440px — dashboards, detail views, checkout */
  --container-wide:  105rem;   /* 1680px — search, messaging, admin tables */

  /* --- Chrome the full-height app shells are measured against (§9) --- */
  --header-height:      4rem;      /* 64px  — sticky site header */
  --sidebar-width:      15rem;     /* 240px — dashboard sidebar at >=1280 */
  --sidebar-width-sm:   12.5rem;   /* 200px — 1024-1279 */
  --sidebar-width-icon: 4.5rem;    /* 72px  — tablet icon rail */
  --rail-width:         21.25rem;  /* 340px — dashboard/context rails */
  --rail-width-filter:  17.5rem;   /* 280px — search filter rail */
  --rail-width-booking: 23.75rem;  /* 380px — vendor profile booking rail */
  --rail-width-summary: 26.25rem;  /* 420px — checkout order summary */
  --section-nav-width:  12.5rem;   /* 200px — sticky form section nav */

  /* --- Density (§4) — row heights by surface class --- */
  --row-height:       3.5rem;   /* 56px — app surfaces */
  --row-height-dense: 2.75rem;  /* 44px — admin tables, message list */

  /* --- Motion (§6) --- */
  --duration-fast:   150ms;  /* hover, focus, colour change */
  --duration-base:   200ms;  /* buttons, cards, pills */
  --duration-slow:   300ms;  /* panels, drawers, sticky chrome */
  --ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
  --ease-out-soft:   cubic-bezier(0.16, 1, 0.3, 1);

  /* --- Layering — never a bare z-index in a component --- */
  --z-sticky:  10;   /* sticky submit bars, table header rows */
  --z-header:  40;   /* site header */
  --z-drawer:  50;   /* mobile drawers, bottom sheets */
  --z-modal:   60;   /* dialogs */
  --z-toast:   70;   /* toasts, above everything */
}
```

**Shared utilities.** Three utilities carry laws from §4 that would otherwise be
re-derived (and re-broken) on every surface. Define them once, in the same file:

```css
/* Fills the viewport below the header; the page itself never scrolls */
@utility app-shell {
  height: calc(100dvh - var(--header-height));
  overflow: hidden;
}

/* A pane inside the shell that scrolls on its own */
@utility app-pane {
  height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* "Forms are grids, not queues" — a field spans both columns with col-span-2 */
@utility field-grid {
  display: grid;
  gap: 1.25rem 1.5rem;          /* y 20px, x 24px */
  grid-template-columns: 1fr;
  @media (width >= 40rem) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
```

**Units and formatting at the display boundary** — the values a ticket renders
are not the values the database stores, and the conversion is always a shared
helper, never inline arithmetic in a component:

| Value | Stored as | Displayed as | Helper |
|---|---|---|---|
| Money | integer cents | `$1,250` (cents hidden when `.00`) | `formatPrice` |
| Service radius | `service_radius_km` | **miles** — the audience is US-based | `kmToMiles` / `milesToKm` |
| Event dates | Postgres `DATE`, `YYYY-MM-DD` string | locale date, never round-tripped through a local-time `Date` | date helpers in `packages/shared/src/utils` |
| Ratings | numeric average | one decimal + gold stars | — |
| Seeded lists (categories, tags) | `displayOrder` column | **that order, always** — never alphabetical, never insertion order | — |

### shadcn/ui Theming

shadcn's semantic slots are bound to the VendorHub palette in `apps/web/src/app/globals.css`, so every shadcn component — and Clerk's shadcn theme — renders in brand without per-component overrides. `apps/web/src/app/theme-tokens.test.ts` guards that binding. The mapping (do not duplicate hexes here — bind to the token):

```css
:root {
  --background: var(--color-stone-50);        /* warm cream, never stark white */
  --foreground: var(--color-stone-800);
  --card: var(--color-stone-0);                 /* white cards lift off the cream page */
  --primary: var(--color-primary-400);          /* terracotta */
  --secondary: var(--color-stone-100);
  --muted: var(--color-stone-100);
  --muted-foreground: var(--color-stone-500);
  --accent: var(--color-sage-50);
  --accent-foreground: var(--color-sage-700);
  --destructive: var(--color-error);
  --border: var(--color-stone-150);
  --input: var(--color-stone-200);
  --ring: var(--color-primary-400);
  --radius: var(--radius-md);
}
```

### shadcn/ui Components to Install

Install and customize these (ticket #1 Foundation):
- Button, Card, Badge, Dialog, DropdownMenu, Input, Label, Select, Textarea, Tabs, Toast, Avatar, Separator, Sheet (mobile drawers), Skeleton, Tooltip, Calendar, Popover, Command (for search)

### Font Loading

In `app/layout.tsx`, load via `next/font/google` and bind each face to the
variable the shared theme reads (`--font-display-face`, `--font-body-face`,
`--font-mono-face`):

```tsx
import { Albert_Sans, Fraunces, JetBrains_Mono } from 'next/font/google'

const fraunces = Fraunces({ variable: '--font-display-face', subsets: ['latin'], display: 'swap' })
const albertSans = Albert_Sans({ variable: '--font-body-face', subsets: ['latin'], display: 'swap' })
const jetBrainsMono = JetBrains_Mono({ variable: '--font-mono-face', subsets: ['latin'], display: 'swap' })
```

The fallback must live *inside* `var()` in `theme.css` — an undefined custom
property invalidates the whole declaration and drops the stack to the browser
default rather than to the next family listed.

---

## 11. Copywriting Voice

The platform's voice is **warm, clear, and encouraging**. Not corporate. Not overly casual. Think: a friendly, experienced event planner helping you.

### Examples:

| Context | Bad | Good |
|---------|-----|------|
| Empty bookings | "No data found" | "No bookings yet — find a vendor to get started" |
| Booking confirmed | "Transaction complete" | "You're all set! Your booking is confirmed" |
| Error message | "Error 422: Validation failed" | "Something doesn't look right — please check the highlighted fields" |
| Vendor CTA | "Submit profile" | "Save and preview your profile" |
| Search placeholder | "Enter search query" | "What kind of vendor are you looking for?" |
| Review prompt | "Create review" | "How was your experience?" |
| Loading | "Loading..." | "Finding the best vendors for you..." (on search) |
| Cancellation | "Confirm cancellation" | "Are you sure? Here's what happens next" |

### Rules:
- Address users as "you", never "the user"
- Use contractions (you're, it's, we'll)
- Vendor names are always proper — use the business_name as-is, never lowercase
- Error messages: say what went wrong AND what to do about it
- Button text: 2-4 words, imperative, specific ("Send request" not "Submit")
- No technical jargon visible to users (no "API", "webhook", "session", "null")

---

## 12. Accessibility Checklist

Applied to every component and page:

- [ ] All interactive elements reachable via keyboard (Tab order logical)
- [ ] Focus styles visible: `ring-2 ring-primary-400/30 ring-offset-2 ring-offset-stone-50` (offset matches page bg)
- [ ] Color contrast: All text meets WCAG AA (4.5:1 for body, 3:1 for large text). Verified for stone-700 on stone-50 (passes), stone-500 on stone-50 (verify — may need stone-600 for small text)
- [ ] Images: All `<img>` have `alt` text (vendor photos: business name + context; decorative: `alt=""`)
- [ ] Forms: Every input has a visible `<label>` with `htmlFor`. Placeholder is not a substitute.
- [ ] Buttons: Icon-only buttons have `aria-label`. E.g., `<button aria-label="Close dialog">✕</button>`
- [ ] Status pills: Color is not the only indicator — text label always present
- [ ] Modals: Focus trapped, Escape to close, `aria-modal="true"`, restore focus on close
- [ ] Toast notifications: `role="status"` for success, `role="alert"` for errors
- [ ] Reduced motion: All animations respect `prefers-reduced-motion: reduce`
- [ ] Star ratings: Accessible — use radio group pattern, not just visual stars
