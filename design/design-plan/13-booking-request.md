# 13 — Booking request (`/vendors/[slug]/request`) — **MVP**

**Purpose:** collect everything the vendor needs to quote, in one pass, so the
thread that follows is a confirmation rather than an interrogation.
**A page, not a modal** — the vendor and package stay in a rail while the form is filled.
**Scroll budget:** ≤ 1.5×.

## Composition at 1440

Two columns inside `--container-app`: form (flexible) + 400px summary rail.

Stepper across the top of the form column, three states:
`1 Event details` (current, `clay-400` filled circle) → `2 Review & send` →
`3 Vendor confirms`. 26px circles, 44px × 2px connectors in `stone-300`.

## Fields — two-column grid, ordered by what the vendor needs first

| Row | Fields                                                                                                |
| --- | ----------------------------------------------------------------------------------------------------- |
| 1   | Event date (pre-filled from search/rail, validated against the vendor calendar) · Event type (select) |
| 2   | Start time · Guest count                                                                              |
| 3   | Venue or location (spans both)                                                                        |
| 4   | "Anything else she should know?" textarea, min-height 96px (spans both)                               |

The date field shows a `sage-600` confirmation under it — "Maya is free on this
date" — because that's the question the customer is actually asking. If the date
is taken, it becomes a `gold-600` line offering the nearest free dates.

Textarea helper: "Optional, but it speeds up the quote" with a live character
count. Placeholder copy is a real example, not "Enter text".

For a custom request (no package) the package block in the rail is replaced by a
required "Describe what you need" textarea.

## Summary rail

Vendor mini-card (54px thumbnail, name in Serif, rating + category) · the
selected package with its inclusions in one `stone-600` line · estimated total in
Serif 26px · then the reassurance block:

> `gold-50` panel, gold dot: "You're requesting, not paying. [Vendor] has 48
> hours to confirm or send a revised quote — you approve before any card is charged."

Then **Continue to review** (primary) and "Ask a question first" (ghost) — the
escape hatch for someone not ready to commit, which stops them bouncing to email.

## Step 2 — review & send

Same shell; the form column becomes a read-only summary with an Edit affordance
per section. Primary becomes "Send request". After submission: a success panel
naming what happens next and the median response time, with a link into the
thread — not a dead-end confirmation page.

## Acceptance

- [ ] Vendor, package and total visible throughout without scrolling
- [ ] Date validated against real availability before submit
- [ ] Reassurance copy sits directly above the primary action
- [ ] Paired fields share rows; nothing is a single-field row except the two textareas
- [ ] ≤ 1.5 viewports

## Post-MVP

- One request to several vendors at once (multi-vendor)
- Saved event details pre-filling every subsequent request for the same event
- Attachments (mood boards, run sheets)
