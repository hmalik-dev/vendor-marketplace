# Prompt for Claude Code — legal & money surfaces (frames 31–33)

Three surfaces that do not exist yet. Two of them gate money: Stripe Connect
onboarding asks for the `/terms` and `/privacy` URLs, and a vendor cannot be paid
until they have accepted the vendor agreement.

Reference design: `Orla - Legal Surfaces.dc.html` (frames 31, 32, 33).

There are **three prompts** below. They are independent — paste one, land it,
then paste the next. Prompt 1 is the only one with new layout primitives in it,
so do it first.

---

## Prompt 1 — The reading layout, and the three legal pages

Paste everything below the line into Claude Code.

---

I need three new static pages — `/terms`, `/privacy`, `/cookies` — plus one new
layout they share. Nothing else in the app is long-form prose, so this layout
does not exist yet. **Add only what is listed here; do not touch any existing
screen, component or token besides the footer change in step 5.**

### Read first

- `design-plan/00-README.md` — conventions and the MVP/post-MVP split
- `design-plan/01-foundations.md` — the type scale and colour tokens
- `design-plan/31-content-voice.md` — register and sentence length

### 1. New layout: `LegalPage`

A reading layout, not an app shell. Unlike every other screen in Orla, **the page
scrolls, not a pane** — there is no fixed shell here.

- Public site header (signed-out variant: Browse · How it works · For vendors, then Sign in and the Sign up pill). Signed-in users get the signed-in header; the body is identical either way.
- Content column: **660px measure**, centred, `52px` top padding.
- Prose type is its own scale, used nowhere else: **15px / 1.85**, colour `stone-800 #3A352E`. Do not reuse the 13.5px/1.6 app body size — it is unreadable at this length.
- Section headings: Instrument Serif 24px, `stone-900`, **numbered** (`1  Who we are`). The numbers are load-bearing: Stripe, vendors and support all cite these by number, so they must be stable and visible, not decorative.
- Title block: micro-label `LEGAL`, then Instrument Serif 44px/1.06 with `-.015em` tracking, then a last-updated line, then a `stone-300` hairline with 34px below it.
- Last-updated line is required on every legal page: `Last updated <strong>4 June 2026</strong>` in 12.5px `stone-600`, with an optional second clause after a `·` separator.
- Section spacing: 30px after a section's last paragraph, 12px between a heading and its first paragraph, 16px between paragraphs inside a section.
- `text-wrap: pretty` on prose blocks.

### 2. Jump rail

- A 212px column to the **left** of the measure, 56px gutter, `position: sticky`, offset so it aligns with the first section heading rather than the title.
- One row per top-level section, prefixed by its number. `stone-700` at 12.5px; the section in view is `clay-text #A34A28`, 600 weight, with a 2px clay `inset` box-shadow on the left edge. A 1px `stone-300` left border runs the full list.
- Active section tracked with `IntersectionObserver`, not scroll maths.
- **Render the rail only when the page has 6 or more top-level sections.** `/terms` and `/privacy` get it; `/cookies` does not, and must not render an empty column — the measure re-centres.
- Every heading gets a stable slug id (`#cancellations-and-refunds`), and the rail links to it. These ids are public URLs people will paste into emails: do not change or auto-generate them from a counter.

### 3. Content blocks available inside a legal page

Three, and no more:

- **Emphasis panel** — `stone-100 #F1ECE4`, `rounded-12`, `17px 19px`, prose at 14.5px/1.75. For a clause with commercial consequence. `/terms` section 4 uses it for the hold-and-release mechanism and the 12% commission.
- **Data table** — `1px stone-300` border, `rounded-12`, header row on `stone-100` with `lbl` micro-labels, body rows 13px/1.6 separated by `1px #EFE9DF`. First column 600 weight. Reuse the admin table idiom; do not invent a new one.
- **Sage note** — `sage-50 #EDF0E9`, `rounded-12`, a 17px sage shield-check glyph, prose 13.5px/1.7. For a reassurance that is a statement of fact. Used once, at the end of `/privacy`.

### 4. The three pages

**`/terms`** — 11 numbered sections, jump rail on: Who we are · What Orla does ·
Your account · Bookings and payment · Cancellations and refunds · If you are a
vendor · Reviews · Files you upload · Liability · Changes to these terms ·
Contact. Section 4 carries the emphasis panel with the hold-until-event mechanism
and the **12% commission**. Section 5 states that the refund schedule applying to
a booking is **shown at checkout before payment** and repeated in the confirmation
email — it defers to prompt 3 by reference and must not restate a schedule, or the
two will drift.

**`/privacy`** — same layout, jump rail on. The one page-specific element is the
data map, which is a data table because it is genuinely tabular — _what · held by ·
why_. The rows are the real stack and must stay accurate:

| What                 | Held by       | Why                                                     |
| -------------------- | ------------- | ------------------------------------------------------- |
| Card details         | Stripe        | Taking the payment. These never reach an Orla server.   |
| Name, email, session | Clerk         | Signing you in and keeping you signed in.               |
| Photos and files     | Cloudflare R2 | Vendor covers and portfolio images.                     |
| Bookings, messages   | Orla          | The record of what was agreed, and the thread about it. |
| Payout details       | Stripe        | Vendors only. Collected by Stripe Connect, not by us.   |

Ends with the sage note: no advertising networks, no analytics vendors, no data
brokers.

**`/cookies`** — deliberately thin. **No jump rail.** One opening line, one
single-row data table (`__session`, set by Clerk, strictly necessary — your
sign-in), and one closing paragraph stating that Orla sets no cookies of its own,
loads no analytics/advertising/session-recording scripts, and that a strictly
necessary cookie needs no consent, which is why there is no banner. **Do not add a
consent banner, a cookie preferences modal, or a consent state in storage.** They
would be theatre — there is nothing to consent to. If analytics are ever added,
this page changes first and the banner arrives with it.

### 5. Footer — one change on every page

The footer currently has four columns and no legal links. Add a **thin bottom line
under the existing grid**, separated by a `rgba(248,245,239,.13)` hairline: `Terms ·
Privacy · Cookies` on the left, `© Orla 2026` on the right, 12px, `stone-400
#A79D8C`, hover to `stone-0`. **Not a fifth column** — a column gives three links
the same visual weight as Browse, which is wrong.

### 6. Copy

The copy in the reference design is written to the right length and register and
every factual claim in it matches the real stack, but **it is not reviewed legal
copy**. Ship it as the placeholder it is, in a location that is trivial to replace:
one MDX or Markdown file per page under `content/legal/`, with the last-updated date
in frontmatter. The page reads the frontmatter date — nobody edits a date in JSX.

### Do not

- Do not add a cookie consent mechanism of any kind.
- Do not put the refund schedule in `/terms`. It lives at checkout (prompt 3) and is referenced from here.
- Do not use the app's 13.5px body size for prose.
- Do not add a fifth footer column.

---

## Prompt 2 — Vendor agreement (a flow step, not a page)

Paste everything below the line into Claude Code.

---

I need the vendor agreement surface. It is **not** a static page behind a footer
link: it is step 3 of 5 in vendor onboarding, it has an accept action, and
acceptance leaves a durable record. A vendor cannot take payments until it is
accepted.

### Read first

- `design-plan/17-vendor-profile-editor.md` — the vendor's own surfaces
- `design-plan/16-vendor-dashboard.md` — the blocker-banner idiom (screen 20's empty state)

### 1. Where it sits

Onboarding order, which is deliberate and must not be reordered:

1. **Create account** — Clerk. Terms of Service accepted here, at sign-up.
2. **Profile basics** — name, category, city, prices. Saveable as a draft.
3. **Vendor agreement** — this surface.
4. **Connect payouts** — Stripe Connect, hosted.
5. **Publish** — listing goes live.

The agreement precedes Stripe Connect because the commission and payout timing are
agreed _before_ a payout rail exists to implement them. Accepting after Connect
would mean a vendor hands over bank details before knowing the commission, and a
refusal at step 4 would leave a verified Connect account attached to an unusable
listing.

Render a 5-step rail at the top of the step: completed steps get a sage check
disc, the current step a clay disc with its number and clay-text label, future
steps a `stone-300` outlined disc with `stone-500` label. 26px hairline connectors.
The header shows `Step 3 of 5`.

### 2. Unaccepted state — the blocking state

Content column max 700px, page title Instrument Serif 34px/1.1: _The vendor
agreement_. Sub-line: read this once and accept it; you cannot take payments until
you have, because it is the agreement Stripe pays you under.

**The four terms that cost a vendor money get the display treatment, above the
prose.** A `stone-100` panel, `rounded-14`, micro-label _THE FOUR TERMS THAT COST
YOU MONEY_, a 2×2 grid at `18px 26px` gaps:

- **Commission — `12%`** (Instrument Serif 27px). Deducted from each booking when it is released. Nothing monthly, nothing for listing.
- **Payout timing — `Event + 2 days`** (Instrument Serif 27px). Released two business days after the event date, then Stripe's own transfer time to the bank. ⚠️ **Confirm this interval before shipping** — see "open questions" below.
- **Cancellations** (13px prose, no display figure). If the vendor cancels a confirmed booking the customer is refunded in full and no commission is taken.
- **Your prices** (13px prose). The vendor sets them and keeps them accurate; Orla adds no fee on top, so the customer pays exactly what was published.

A vendor who reads only this panel has still read the commercially material terms.
That is the design intent — do not demote it into the agreement body.

Below it, the **full agreement** in a bordered card: header strip on `stone-50`
with `Full agreement` and `11 sections · v1.0 · 4 Jun 2026`, then a **150px-tall
clipped body** with a 56px bottom gradient fade to the card fill, then a
`Read all 11 sections` clay-text link with the note that it opens in this step so
the vendor does not lose their place. Expand in place; do not navigate away and do
not open a modal that loses onboarding state.

Accept control: a checkbox whose label **names the business**, not just "I agree" —
_I have read the vendor agreement and I accept it on behalf of **[Business name]**.
I understand Orla retains 12% of each booking._ Then `Accept and continue`,
**disabled until the box is ticked** (disabled fill `#D9BFAF`, not a grey), with the
note that the next step is connecting payouts.

### 3. Accepted state — a record, not a banner

Acceptance is **not** a toast that disappears. It becomes a permanent row under
**Settings → Legal**:

- A sage card (`sage-50`, `1px #DDE3D6`, `rounded-14`): white check disc, _Vendor agreement v1.0 — accepted_, then `Accepted 8 June 2026 at 2:14 PM CDT by June Harlow, for June Harlow Photography` — person, version, timestamp with timezone. Then `View agreement` and `Download PDF` clay-text links.
- A `stone-100` strip beneath with a sage `PAYOUTS LIVE` pill and one line confirming Stripe Connect is verified and releases run automatically two business days after each event.
- An agreements table: _Document · Version · Accepted_, with rows for the vendor agreement (`v1.0`) and the Terms of Service (accepted at sign-up).

### 4. Versioning

A new version **adds a row; it never replaces one**. "Which version did I agree to"
is a real question the moment the agreement changes. When a vendor's accepted
version is behind the current one, the vendor dashboard carries a blocker banner
until they accept the new one — the same idiom as the Stripe-not-connected blocker
on screen 20. Re-acceptance is the same unaccepted state, with a diff summary above
the panel where the four-terms grid sits.

### 5. Data

Store one row per acceptance: `vendor_id`, `document` (`vendor_agreement` |
`terms_of_service`), `version`, `accepted_at`, `accepted_by_user_id`,
`accepted_by_name`, `business_name`, `ip`, `user_agent`. Immutable — no updates, no
deletes. The PDF download renders the exact stored version, not the current one.

### Open questions — do not invent answers silently

- **Payout interval.** "Event + 2 business days" is a design placeholder. The plan says payment is held until the event and then released, but not how long after. Read the interval from one config constant referenced in all three places it appears (this panel, the accepted-state strip, `/terms` section 4) so it changes in one edit.
- **Cancellation enforcement.** The reference design says "repeated cancellations can end your listing", which implies an enforcement process nothing else in the plan describes. If there is no process, cut the sentence rather than shipping a threat you cannot execute.

---

## Prompt 3 — Refund schedule at checkout (an in-flow block)

Paste everything below the line into Claude Code.

---

I need the refund schedule **shown** above the pay control on
`/bookings/[requestId]/checkout` — not linked in the footer, not behind a
disclosure. A customer committing $2,050 to a date eleven months out is entitled to
know what happens if the date moves, at the moment they commit.

### Read first

- `design-plan/14-checkout.md` — the existing checkout composition

### 1. Placement

**Do not change the checkout layout.** The right rail already carries the
commitments: summary card, then this block, then the pay button. Insert the block
between the summary card and the button, 16px gaps either side.

At 390 it sits below the total card and **above** the sticky pay bar, inside the
scrolling pane. The pane keeps ≥96px bottom padding so the last row clears the bar.
It is never the element collapsed to save vertical space.

### 2. The block

`stone-100 #F1ECE4` fill, `1px stone-300`, `rounded-14`, `16px 17px`. A clock glyph
and the micro-label _IF PLANS CHANGE_. Then four rows, each `9px 0`, separated by
`1px stone-300` hairlines, with the label column fixed at 112px:

| Label                            | Consequence                                 |
| -------------------------------- | ------------------------------------------- |
| Before 15 May                    | Cancel for a **full refund** — 30+ days out |
| 15 May – 31 May                  | 50% refunded — $1,025 back                  |
| From 1 June                      | Non-refundable — June has held the date     |
| **If June cancels** (sage label) | **Full refund**, whenever it happens        |

Caption underneath: `Dates calculated from 14 June 2026.` plus a `Full policy`
clay-text link.

**The schedule is resolved into this booking's actual dates and amounts.** Do not
render "30 days before the event" or "50%" abstractly — compute the boundary dates
from `booking.eventDate` and the money from the booking total. A customer should not
have to do date arithmetic to find out whether they can still get their money back.
The vendor's first name is used in the copy, so it reads as this vendor's terms
rather than platform boilerplate.

The pay button's subline references the block, not a page: _By paying you accept the
Terms and the refund schedule above._

### 3. Where else the same component goes

Once it exists it belongs in three more places — same component, different density:

- **Confirmation screen** (screen 15) and the confirmation email. Full four rows.
- **Booking detail in the customer hub** (screen 20). **Only the row that applies today**, plus the vendor-cancels row. A customer looking at a live booking needs the current position, not a schedule.
- **`/terms` section 5**, which defers to this by reference and must not restate the numbers.

### Open questions — get these answered before the schedule is treated as real

- **The schedule itself is a guess.** 30 days / 50% / non-refundable is a plausible events-industry default, not something in the plan. It is drawn concretely because a vague block is worse than none. Put it in one config module with the boundaries and percentages named, so replacing it is one edit.
- **Platform-wide or per-vendor?** Per-vendor means the vendor profile editor grows a field, the vendor agreement must reference it, and the search card should probably surface a stricter-than-usual policy. Platform-wide is one constant. This decision changes three screens, so do not guess it in code — ask.
- **Does "non-refundable" release the full amount to the vendor,** or does Orla waive commission on a cancelled booking? The 12% depends on the answer, and so does the vendor-side copy.
