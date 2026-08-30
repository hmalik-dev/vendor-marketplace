# 04 — Layout laws & review checklist

Reference viewport **1440 × 900**. With a 64px header that leaves **836px of
first screen**. That is the budget, and it is spent before anything else.

## The laws

1. **Columns before stacking.** Two blocks read together sit side by side. Stacking is what happens when width runs out.
2. **Fixed chrome, scrolling content.** App surfaces fill the viewport and scroll _inside_ panes. Header, sidebar, rails, section navs and submit bars never scroll away.
3. **Master–detail over navigate-away.** A list that leads to a detail renders both at ≥1280 (bookings, messages, packages, admin).
4. **A persistent rail beats a modal — when its contents are referenced _while_ working in the main pane.** Order summaries, booking context, the publish checklist and the messaging context earn their width that way. **Search filters do not** — you set them, then you read results — so `/search` has no filter rail; its filters are a horizontal Refine bar and the width goes to results. Modals remain for interruptive single decisions only.
5. **Forms are grids, not queues.** Paired short fields share a row. Multi-section forms get a sticky section nav and a sticky submit bar.
6. **Panes and tabs over anchor-scrolling.** Alternatives become tabs; narratives become scroll.
7. **Density scales with width.** More width means more columns and rows — not bigger cards and wider margins.
8. **Importance is vertical order.** What the user needs to decide comes first; the optional and rarely-changed come last.
9. **Pair the inputs that describe one thing.** Profile photo + cover. Min + max guests. Price + duration. City + state.

## Scroll budgets

| Surface      | Budget                            | Screens                                                         |
| ------------ | --------------------------------- | --------------------------------------------------------------- |
| App shells   | **1.0×** — the page never scrolls | search, both dashboards, messaging, availability, editor, admin |
| Forms        | ≤ 1.5×                            | booking request, checkout                                       |
| Detail views | ≤ 2.5×                            | vendor profile                                                  |
| Landing      | ≤ 4×                              | the only narrative scroll in the product                        |

Over budget? The fix is a layout change — a column, a rail, a pane, a tab. Never
smaller type, never tighter padding, never a scrollbar the user is expected to accept.

## Desktop review checklist — run at 1440 × 900 before anything else

- [ ] Purpose, primary status and primary action are visible without scrolling
- [ ] Within scroll budget: `document.documentElement.scrollHeight / innerHeight`
- [ ] No centred column leaving >30% of the viewport as empty gutter
- [ ] Paired fields and paired media sit side by side
- [ ] Sidebars, rails, section navs and submit bars stay fixed while content scrolls
- [ ] Nothing important hidden in a modal a rail could hold
- [ ] Information ordered by importance
- [ ] At 1728 the layout gains columns, not margins
- [ ] No display-lg heading inside an app frame
- [ ] **No pane clips its own content mid-element.** A fixed-height pane whose content overflows must either fit or scroll — a sliced glyph is a bug, and it was the most common defect in review
- [ ] Every text node clears 4.5:1

## Design parity — the gate every screen passes before it is Done

The implementation must match its frame in `../Orla - Screens.dc.html`. Not
"inspired by", not "the same components arranged differently" — **1:1 parity**.
The frame is the acceptance criterion, and it is checked in a real browser, not
by reading the diff.

Parity is checked on six axes and **all six are hard gates**: **layout**,
**style**, **colour**, **font**, **the literal text**, and **access**. A screen
whose copy paraphrases the frame has failed just as surely as one whose
composition differs — the words are part of the design.

**Access** is the sixth gate: the accessibility laws below and the contrast table
in `01-foundations.md`. They were written as law and then left with no checker,
which is how a focus ring can compute correctly and render invisibly, or a
heading can be drawn over a photograph with no scrim. The parity pass is the only
place either is caught, so it is checked there, on the same footing as colour.

**Precedence when sources disagree:**

1. **The rendered frame** — the markup in `Orla - Screens.dc.html`. This wins.
2. **This design plan** — the values and the reasoning behind them.
3. **The frame's caption** — the `sc-d` blurb above each frame. **Not spec**, and
   it goes stale: the pre-revision frame `03` was captioned "cover capped at
   340px" while rendering `height:190px`. Read the markup, never the caption.

Where 1 and 2 disagree, build 1 and correct 2 in the same ticket, so the next
implementer doesn't rediscover the same conflict.

### The procedure

1. Open the screen's frame from `Orla - Screens.dc.html` at **1440 x 900**. Each
   frame carries a `data-screen-label` (`01 Landing`, `07 Customer bookings hub`,
   ...) and an MVP / Revised / Rebuilt badge.
2. Drive the real implementation with Playwright at the same viewport, signed in
   as the role the screen belongs to, on data that populates it — an empty
   surface proves nothing.
3. Screenshot both. Compare them side by side across all six axes.
4. **Diff the strings.** Pull the frame's visible text out of its markup and
   compare it to the live DOM's text content. Headings, field labels, button
   copy, helper lines, micro-labels, empty states and count sentences must read
   word for word — same wording, same capitalisation, same punctuation.
   `31-content-voice.md` records the approved strings.
5. Run the desktop review checklist below against the live page, then the
   adaptation checklist in `30-responsive.md` at 1280 / **1024** / 768 / 390.
   A screen drawn in section 27 is additionally compared 1:1 against its own
   **1024 × 640** frame, on the same six axes.

### What parity means, concretely

| Must match exactly                                                                    | Allowed to differ                                                |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Layout: column counts, pane and rail widths, what is fixed vs what scrolls            | Placeholder imagery replaced by real vendor photography          |
| Every colour, resolved to the tokens in `01-foundations.md`                           | Row counts that follow from real data volume                     |
| Type: family, size, weight per the scale in `01-foundations.md`                       | Copy naming real vendors, prices and dates instead of the mock's |
| Component vocabulary from `03-components.md` — a screen never invents a local variant | Scrollbar rendering and font hinting across platforms            |
| Order and grouping of information                                                     |                                                                  |
| Presence of every element in the frame, including empty and loading states            |                                                                  |

A screen that reproduces the frame's _content_ in a different _composition_ has
failed. The composition is the design. A screen that reproduces the composition
with reworded copy has failed too. The words are the design.

**Six frames were revised on 2026-08-27** — `01 Landing`, `02 Search & browse`,
`03 Vendor profile`, `07 Customer bookings hub`, `12 Sign up`, and
`14 Adaptations`. Any screen built against the earlier version of one of those
frames is out of parity and carries a redesign ticket. The eight unchanged frames
(`04`, `05`, `06`, `08`, `09`, `10`, `11`, `13`) are untouched by that revision.

### Evidence

A ticket is not Done until the parity screenshots exist and the checklists below
pass on the live page. Record the frames verified in the ticket's Notes column.

## Motion

Framer Motion for component animation; CSS transitions for hover and focus.

- Card grid entrance: `opacity 0→1, y 16→0`, 50ms stagger, 400ms, `cubic-bezier(.25,.46,.45,.94)`
- Card hover: `translateY(-2px)`, shadow-sm → shadow-hover, 200ms; cover image `scale(1.03)` under `overflow:hidden`, 400ms
- Buttons: hover `scale(1.02)` 150ms; active `scale(.98)` 100ms
- Dialogs: backdrop fade 200ms over `stone-900/40`; panel spring, damping 20 / stiffness 300
- Sidebar active indicator slides via shared `layoutId`
- Confirmation: one checkmark spring, one sparkle burst. Not continuous.
- All of it respects `prefers-reduced-motion`; functional transitions survive, decorative ones don't

## Accessibility

- Focus ring: `ring-2 ring-clay-400/30 ring-offset-2 ring-offset-stone-50`
- Icon-only controls carry `aria-label` and a 44×44 hit area
- Status is never colour alone — pill text always present
- Modals trap focus, close on Escape, restore focus
- Star ratings use a radio-group pattern
- Every input has a visible `<label htmlFor>`; placeholder is not a label

### The focus ring has to be **visible**, not merely declared

Two ways it computes correctly and renders nothing, both found in the product:

1. **Clipped.** An outward ring on an element that exactly fills an
   `overflow:hidden` ancestor is 100% outside that ancestor's rect. The vendor
   card did this on landing and search — the primary interaction of the whole
   app had no keyboard indicator while `:focus-visible` matched and the
   `box-shadow` was correct.
2. **Styleless.** Tailwind's `outline-none` sets `--tw-outline-style: none`, and
   the width utilities read their line style from that variable — so
   `outline-none focus-visible:outline-2` paints nothing at all. Pair a width
   with `focus-visible:outline-solid`.

**A test that asserts the class or the computed value cannot see either
failure.** Assert the ring is rendered _and within its nearest `overflow:hidden`
ancestor's rect_.

### Decorative text is exempt from 4.5:1 — narrowly, and it must be `aria-hidden`

`01-foundations.md` requires every text node to clear **4.5:1**. That rule is
about text a person has to _read_. It is not about a glyph that happens to be a
character, and holding ornament to it forces a design change that buys no one
anything — which is the question the landing "How it works" numerals raised
(`clay-200` on `stone-100`, **1.20:1**).

The exemption, and it is the whole of it:

> Text is exempt from the 4.5:1 minimum only when it is `aria-hidden="true"`,
> conveys **no** information that is unavailable elsewhere on the screen, and is
> not part of any control. Every fact it depicts must also be present in a form
> that clears 4.5:1.

This is WCAG 1.4.3's own "incidental / pure decoration" carve-out, stated
locally so a parity pass can apply it without arguing about it. The numerals
qualify: they are `aria-hidden`, and the steps they number are themselves
headings in `stone-900`, so removing the numerals loses nothing.

**What it does not cover:** anything a sighted user reads for meaning. Low
contrast is not made lawful by adding `aria-hidden` — that hides the text from
assistive technology while leaving it just as unreadable on screen, which is
worse than the original defect. If removing the element would lose information,
it is not decorative.
