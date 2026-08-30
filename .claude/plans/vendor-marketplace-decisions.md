# Vendor Marketplace — Finalized Decisions

Cross-reference document for the project plan at `.claude/plans/vendor-marketplace-plan.md`. Any model reviewing or implementing from the plan should treat these decisions as settled unless the user explicitly reopens them.

---

## Decision Log

### D1: Stripe Processing Fee — Absorb

**Decision:** Platform absorbs Stripe's processing fee (~2.9% + $0.30) from the 12% commission. Customer sees a single clean price.

**Rationale:** Simpler UX, better price transparency. At a $500 booking, the platform nets ~$45 after Stripe fees — viable. Passing the fee to customers feels extractive (Ticketmaster model) and hurts conversion.

**Break-even point:** ~$11 booking. With the $25 minimum (D2), every transaction is profitable.

**Economics at key price points:**

| Booking | Stripe Fee | Commission (12%) | Net Platform | Vendor Gets |
|---------|-----------|-------------------|-------------|-------------|
| $25     | $1.03     | $3.00             | $1.97       | $22.00      |
| $100    | $3.20     | $12.00            | $8.80       | $88.00      |
| $500    | $14.80    | $60.00            | $45.20      | $440.00     |
| $1,000  | $29.30    | $120.00           | $90.70      | $880.00     |

**Implementation:** `application_fee_amount` on PaymentIntent = `platform_fee_cents`. Stripe deducts its processing fee from the platform's share automatically when using Connect with `transfer_data.destination`.

**Revisit if:** Average booking value drops below $50 consistently (net drops under $4.25, may need to raise commission rate or add customer fee).

---

### D2: Minimum Booking Amount — $25

**Decision:** Enforce a $25 minimum for all bookings (`final_price_cents >= 2500`).

**Rationale:** At $25, the platform nets $1.97 after Stripe fees — barely profitable but prevents loss-making micro-transactions. A $10 booking would lose money ($1.59 Stripe fee > $1.20 commission). Most event vendors price well above $25 (photographers: $200+, DJs: $300+, caterers: per-person pricing).

**Implementation:** Validate `price_cents >= 2500` in:
- `service_packages` creation/update (Zod schema)
- `booking_requests.quoted_price_cents` (vendor quote validation)
- Display as "$25.00 minimum" in package creation UI

**Revisit if:** A vendor category legitimately needs sub-$25 pricing (unlikely for event services).

---

### D3: Cancellation Policy — Fixed Platform-Wide

**Decision:** Fixed cancellation rules, not vendor-configurable.

**Rules:**
- **> 48 hours before event:** 100% refund to customer, vendor receives $0
- **< 48 hours before event:** 50% refund to customer, vendor receives 50% of their payout
- **After event (COMPLETED):** No cancellation possible
- **PENDING/QUOTED requests:** Can be cancelled by either party at any time, no payment involved

**Rationale:** Vendor-configurable policies add significant scope: policy creation UI, per-booking refund calculation, policy display at checkout, edge cases around policy changes after booking. Fixed policy is clear, predictable, and implementable in a single conditional.

**Implementation:**
```
if (hoursUntilEvent > 48) {
  refundAmount = totalAmountCents;          // full refund
  vendorAmount = 0;
} else {
  refundAmount = Math.round(totalAmountCents / 2);  // 50% refund
  vendorAmount = Math.round(vendorPayoutCents / 2); // vendor keeps 50% of their cut
}
```
Create Stripe Refund for `refundAmount`. If vendor already received a Transfer, this needs a reversal — for MVP, payouts only happen on COMPLETED status (not at booking confirmation), so this scenario doesn't arise.

**Display:** Show cancellation policy on the payment/checkout page before the customer confirms.

**Revisit if:** Vendor feedback indicates the 48-hour window is insufficient for their business (e.g., wedding vendors who need 30+ days notice). Post-MVP: allow vendors to choose from preset tiers (Flexible/Moderate/Strict) like Airbnb.

---

### D4: User Roles — Single Role Per Account

**Decision:** Each user has exactly one role (`customer`, `vendor`, or `admin`), set at registration. No role switching.

**Rationale:** Dual roles add significant complexity: role-switcher UI, context-aware dashboards, "which role am I in?" confusion, dual notification streams, auth middleware that checks active role not just assigned role. For MVP, a vendor who wants to book another vendor creates a second Clerk account with a different email.

**Data model:** `users.role` is `enum('customer','vendor','admin')`, single value, immutable after registration (no role-change endpoint).

**UX implication:** Registration page asks "I want to hire vendors" (→ customer) or "I'm a vendor" (→ vendor). Clear and irreversible within the account.

**Revisit if:** Multiple vendors report wanting to book through the platform. Signal: support requests or user feedback. Post-MVP solution: add `roles` array + `activeRole` session state + role-switcher component.

---

### D5: Review Moderation — Basic Automated Filter

**Decision:** Run review content through an automated profanity/spam filter before publishing. Flagged reviews are rejected with a message asking the user to revise.

**Rationale:** Immediate publishing without any filter risks abusive content appearing on vendor profiles. A manual approval queue adds operational burden and delays review visibility. A lightweight profanity filter catches obvious abuse without adding significant complexity.

**Implementation:**
- Use a profanity filter library (e.g., `bad-words` or `leo-profanity` npm package) in the review service
- Check both `title` and `content` fields before saving
- If flagged: reject with HTTP 422 and message "Your review contains inappropriate language. Please revise and resubmit."
- No manual review queue — filter is pass/fail
- Log filtered attempts to Sentry for monitoring (pattern detection, false positive rate)

**Limitations accepted:**
- False positives may frustrate users (e.g., "Scunthorpe problem"). Monitor via Sentry logs and tune the word list.
- Sophisticated abuse (coded language, personal attacks without profanity) won't be caught. Handle manually via database delete if reported.
- No "report review" button for MVP — users contact support (email).

**Revisit if:** False positive rate > 5% of submissions (tune filter or switch to AI-based moderation). Or if abuse gets past the filter frequently (add manual review queue or AI content moderation API).

---

### D6: Search is Category-First, Not a Text Query — *2026-08-27*

**Decision:** the search query is exactly three enumerable inputs — **vendor type,
city, event date**. The vendor-type field is a select over the eleven categories and
**cannot hold an unrecognised value**. There is no free-text query on the main path on
either the landing page or `/search`.

**Rationale:** nobody arrives knowing a vendor's name; they know what kind of vendor,
where, and when. A text box has to guess intent from "wedding photographer near me" and
fails silently and differently for each phrasing. A select cannot be phrased wrong, it
teaches the taxonomy on first use, it makes the query URL-addressable and cacheable, and
it lets the result-count sentence name the category truthfully.

**Consequence:** the API's free-text `q` parameter is removed. A `name` parameter
replaces it, matching **business name only**, surfaced as a small "Search by name" link
for the referral case (someone was handed a business card).

**Revisit if:** there is enough profile copy to index for semantic search — and even
then it is an *additional* entry point beside the pickers, never a replacement.

---

### D7: No Search Filter Rail — *2026-08-27*

**Decision:** the 280px filter rail on `/search` is deleted. Filters are a single
horizontal **Refine** bar, and the reclaimed width goes to results: **8 vendor cards at
1440 × 900**, four across, instead of three.

**Rationale:** a persistent rail earns its width when its contents are referenced *while*
working in the main pane — the booking rail, the publish checklist, the messaging context
all qualify. Search filters do not: you set them, then you read results. Holding a
permanent column of the viewport for controls touched once or twice a session, at the
cost of a third of the result grid, is a bad trade.

**Consequence:** this is a named exception to the "a persistent rail beats a modal" law
in `design/design-plan/04-laws.md`, and the law is reworded rather than quietly broken.
The category chip strip goes too — category is selectable in **exactly one** control,
and the date never appears as a filter chip.

---

### D8: No Event Entity in MVP — *2026-08-27*

**Decision:** there is **no Event object**. No `events` table, no `bookings.event_id`, no
`/events` route, no "My events" nav item, no "New event" CTA. `/bookings` groups by
**month, derived from the booking date**.

**Rationale:** an earlier revision made events real because the bookings hub grouped
under them. But there is no way for a customer to *create* an event, so the entity had
only auto-created rows named after dates — a table earning nothing. Month grouping is a
`groupBy(startOfMonth(date))` over rows that already exist: no new object, no new step
for the user, and the same scannability.

**Consequence:** the occasion is the existing `event_type` field on the booking, rendered
as "Photography · Wedding"; the venue is a plain field, rendered in the card sub-line.
Both are already collected by the booking request form. "Still to book" stays removed —
there is no fixed set of categories an event should have.

**Revisit if:** enough customers hold multiple bookings on the same date that month
grouping stops being sufficient. Month grouping remains the default view even then.

---

### D9: Design Parity Is 1:1 on Five Axes — *2026-08-27*

**Decision:** a screen is `Done` only when it matches its frame in
`design/Orla - Screens.dc.html` on **layout, style, colour, font, and the literal text**.
The strings are part of the design: headings, labels, button copy, helper lines,
micro-labels, empty states and count sentences must read word for word, including
capitalisation and punctuation.

**Rationale:** the previous gate covered composition and tokens but treated copy as
paraphrasable, and copy drifted on every screen. The frame is the acceptance criterion or
it isn't one.

**Consequence:** only real content, real data volume and real photography may differ from
a frame. Verification reads the strings out of the frame markup — never the `sc-d` caption
blurbs, which are commentary and go stale — and diffs them against the live DOM.

---

## Technology Decisions (Settled)

These are documented with full rationale in the project plan (Section 3). Summarized here for quick reference:

| Decision | Choice | Key Reason |
|----------|--------|-----------|
| Frontend | Next.js 15 (App Router, RSC) | SEO + SSR for public pages, React ecosystem |
| Backend | Fastify 5 (separate service) | Type-safe routes via Zod provider, built-in Pino, clean plugin system |
| ORM | Drizzle | SQL-like queries Claude can verify, schema-as-TypeScript |
| Database | PostgreSQL 16 (Neon prod) | Proven, free tier, daily backups, point-in-time recovery |
| Auth | Clerk | Eliminates auth attack surface, free 10k MAU, works with separate backend |
| Payment | Stripe Connect Express (12%) | Hosted onboarding, platform fee support, industry standard |
| Monorepo | Turborepo + pnpm | Simple config, Vercel-maintained, good enough for 4 packages |
| Styling | Tailwind CSS 4 + shadcn/ui | Claude can read/modify component source directly |
| Validation | Zod (shared FE+BE) | Single schema → types + validation, works with Fastify type provider |
| File storage | Cloudflare R2 | S3-compatible, no egress fees, pairs with Cloudflare CDN |
| Email | Resend | Best DX, free 3k/mo, TypeScript SDK |
| Real-time | SSE (MVP) | Simpler than WebSocket, sufficient for marketplace messaging cadence |
| Error tracking | Sentry | Free 5k events/mo, FE + BE SDKs |
| CI/CD | GitHub Actions | Lint + typecheck + test on PR, auto-deploy on merge |
| Testing | Vitest + RTL + Supertest + Playwright | Faster than Jest, native ESM/TS, compatible API. Playwright for agentic E2E browser smoke tests |


### D10: Runtime Split — Web on Vercel, API on Railway — *2026-08-27*

**Decision:** `apps/web` (Next.js 15) deploys to **Vercel**. `apps/api` (Fastify 5)
deploys to **Railway** as the Docker image `apps/api/Dockerfile` already builds.
There is **one** API runtime; the Vercel API deployment is decommissioned.

**Status of the drift this resolves:** the API had been deployed to Vercel as well,
which #34 recorded as "the tracker and production disagree". It was drift, not design —
`railway.json` and the Dockerfile have targeted Railway since #18.

**Rationale — the two tiers have opposite scaling shapes, and one platform can only be
good at one of them.** The web tier is bursty, cacheable and read-mostly, and lives on
CDN and SEO (#30); that is Vercel's design centre. The API tier is long-lived,
CPU-heavy on image work, and needs a *bounded* instance count for its connection pool
and rate limiter to mean anything; that is a container.

Four concrete things in the current and planned code fight serverless:

| Constraint | Why Vercel is wrong for it |
| --- | --- |
| Uploads at 12 MB (#29) | Vercel caps request bodies at **4.5 MB**. The workaround is presigned direct-to-R2, which removes the server-side `sharp` re-encode that `apps/api/src/lib/images.ts` relies on as a **security boundary** — what is served is a WebP the server produced, never client bytes |
| `sharp`, two pipelines per upload | Cold starts, memory ceilings and CPU-second billing, against steady container CPU already paid for |
| SSE messaging (#8) | Long-lived connections are the worst fit for max-duration functions; containers hold them indefinitely |
| In-memory `@fastify/rate-limit`, `createDatabase` `max: 10` | Both assume a bounded instance count. Unbounded serverless instances make the limiter decorative and exhaust connections without Redis and the Neon pooler |

The Dockerfile already implements SIGTERM draining, `HEALTHCHECK` and `/ready` — that is
container-shaped code, and it is dead weight on Vercel.

**Rejected — all-Vercel:** would require rewriting the upload path, adding Redis, and
rethinking SSE: three architectural detours inside #29, #8 and #10. Defensible only if
the API stayed a thin CRUD layer over Neon with no image processing and no realtime,
which #29 and #8 rule out.

**Rejected — all-Railway:** loses the CDN, ISR/PPR and `next/image`, and would need
Cloudflare in front to recover what #30 depends on.

**Secondary benefit — reversibility.** The API is a plain Docker image and can move to
Fly, Render, ECS or a VPS in an afternoon. The Next app is the piece with real platform
lock-in, and it is also the piece where that lock-in buys the most.

**Agent-workflow benefit:** the Docker build is reproducible locally. On 2026-08-27 that
is what proved the Dockerfile innocent on both arm64 and `linux/amd64` before any Railway
config was touched, turning #44 into a one-setting fix instead of a guessing loop.

**Follow-on work:** #44 (Railway `DATABASE_URL` still points at `localhost`), #19
(production provisioning), #34 (now answered — decommission the Vercel API and point
`NEXT_PUBLIC_API_URL` at the Railway domain), #20 (deploy pipeline).

---

## `Send a message` on the vendor profile is disabled until #310 (2026-08-30, #110 via #298)

**Decision:** the rail's `Send a message` control ships **disabled**, and stays
disabled until **#310** builds the conversation it would open.

**Why this needed deciding.** Frame `03` draws the control as an ordinary
enabled secondary button, and the parity rule says the frame is the acceptance
criterion. #110 was filed against exactly that mismatch. But the frame draws the
finished product, not the build order: `/messages` can only open a conversation
that already **exists** — it reads `?conversation=<id>` — and nothing in the
product creates one from a vendor profile. Enabling the button would land the
customer on an empty thread list with no indication that anything failed, which
is the "dead control" defect #302 is open against elsewhere on this screen.
Creating the thread is #310's work and is an explicit **non-goal of #298**.

**What this is not.** It is not a ruling that the frame is wrong. When #310
lands, the control is enabled and this decision is spent — the frame already
describes the end state, so no design change is needed then.

**How it is applied.** `40-states.md` requires the blocker to be named beside
the control it blocks. It is named to assistive technology via
`aria-describedby` rather than as visible copy, because frame `03` draws no
helper line under that button and adding one would fail the Text axis in order
to satisfy the Access axis. **#310 removes both the `disabled` attribute and
the description in the same change** — leaving the description behind an
enabled control would be worse than never having added it.

---

### D11: Acceptance Is What Discloses the Customer's Contact Details — *2026-08-30*

**Decision.** A vendor sees a customer's **first name and last initial** while deciding
whether to take the work, and their **full name, email and phone** from the moment they
accept. Nothing in between, and nothing after a decline.

**Why it needed deciding.** #211 found the vendor never learns who the customer is, and
#307 required the rule be "explicit, not an accident". The old behaviour was not a rule at
all — `toDetail` truncated the surname unconditionally and a code comment asserted that
"the full name arrives with acceptance", which nothing implemented. Three layers enforced
the truncation (the DAO projection, the mapper, the Zod response schema) and they agreed
only by coincidence.

**Where it lives.** `CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES` in
`packages/shared/src/constants`, read in exactly one place — `toDetail`. Adding a status
to that array is the whole of changing the policy.

**The reasoning.**

1. **Before acceptance the vendor is judging the work, not the person.** A name and an
   initial are enough to write a reply that does not read like a form letter. Contact
   details at this stage would let anyone with a vendor profile harvest the address book
   by sending nothing and declining everything.
2. **Acceptance is a commitment to turn up.** From that point the vendor has an obligation
   to a specific person on a specific date, and needs a channel that does not depend on
   the customer opening the app. Messaging alone is not that channel — it fails exactly
   when it matters, the week of the event.
3. **`declined`, `cancelled` and `expired` disclose nothing.** A vendor who turned the
   work down has no reason to retain the details, and a lapsed request never created the
   obligation that justified them. The fields go back to `null` rather than persisting.

**What this is not.** It is not a GDPR posture — the Constraints table sets compliance at
"minimal viable". It is the smallest rule that makes an accepted booking usable without
handing out contact details for free.

**Consequence for #10.** Payment turns an accepted request into a `bookings` row. That
must not narrow the disclosure back — a paid booking is at least as committed as an
accepted one.

---
---

## Constraints (Settled)

| Constraint | Value | Notes |
|-----------|-------|-------|
| Timeline | 4 weeks from start | Ship ASAP within this window |
| Budget (hosting) | ~$5-10/mo | Free tiers wherever possible |
| Scale (MVP) | 50-200 vendors, ~1000 customers | Small local market, growth-ready architecture |
| Compliance | Minimal viable | ToS + privacy page, Stripe handles PCI, no GDPR features |
| Failure policy | Graceful + fix fast | User-friendly errors, Sentry alerts, extra rigor on payment paths |
| Build method | 100% Claude Code | Agentic build, test, and verification — no human coding or manual browser testing. Playwright for E2E smoke tests. |
| Repo location | `~/Documents/vendor-marketplace` | GitHub: `https://github.com/hmalik-dev/vendor-marketplace.git` |
| Min booking | $25 | Ensures positive margin after Stripe fees |
| Commission | 12% | Configurable via env var, absorbs Stripe fee |
| Cancellation | Fixed: 100% >48h, 50% <48h | Platform-wide, not vendor-configurable |
| Roles | Single per account | No dual customer+vendor role |

---

### D12: The Eight Human Decisions — *2026-08-30*

**What this is.** Every ticket sitting in `Deferred — needs a human` or
`Blocked — needs a human` was put to the account holder in one pass and answered.
This entry is the record; the Status Board rows carry the same rulings inline.

**Two rulings unblock work now.**

**#299 — `Your line` and `Years in business` are relocated, not deleted.** They move into
`About your business`. The contradiction was frame-vs-frame, which the repo's usual
tie-breaker does not arbitrate: frame `03` and `12-vendor-profile.md` require the data,
frame `09` and `17-vendor-profile-editor.md` omit the inputs. Deleting them would have made
public-profile content permanently unsettable — a regression dressed as a parity fix — so
**frame `09`'s ordered field list is recorded as non-exhaustive** and that is the deviation.
Relocating also serves #141's scroll budget.

**#299 (from #152) — the character counters stay, and spread.** `0 / 80`, `57 / 1200` and
`1 of 5 chosen.` are affordances on `maxLength`-capped inputs, not prose; the alternative to
a counter is silent truncation at the cap, and `03-components.md:92` already provides for a
helper line under a field. Frame `09` shows no counter because it shows no vendor mid-typing.
**They are additionally to be added to every other capped input in the product**, so the
affordance is consistent rather than present on three fields by accident. That widens #299's
scope deliberately.

**#320 — 7 days stands, and one file may be edited.** `BOOKING_REQUEST_EXPIRY_DAYS` is
correct; 48 hours was judged too quick a turnaround to ask of a vendor, and is revisitable
later against real reply-time data. Because `31-content-voice.md` is `design-plan/` and
*design passes edit the plan, tickets write the code, never the reverse*, #320 is granted a
**one-off, scoped exception** to correct the Request reassurance row. The exception covers
that correction and the same-pass sweep of other rows quoting a duration. It does not
generalise.

**One ruling closes a ticket.**

**#25 — the Style refine chip is dropped from MVP.** Answered as a product question rather
than a vocabulary one: a P2 filter sitting behind a schema change and an unvalidated public
taxonomy has to earn its place, and it cannot until there are enough vendors for the filter
to mean anything. A seeded taxonomy is expensive to change once customers filter on it.
#23's recorded deviation on the Refine bar stands. Revisit post-launch with real data.

**Four are held for launch prep, as one block.**

| Ticket | Ruling |
| --- | --- |
| **#19** Production provisioning | Hold **all** of it, Stripe live-mode activation included |
| **#62** Stripe public business name | Hold — sandbox renders `VendYou` harmlessly, #9/#10 verify with it in place |
| **#11** Transactional email | Hold — in-app notifications already cover every event row; domain verification needs DNS that does not exist until #19 |
| **#46** Clerk secret rotation | Hold — scopes 1 and 2 already shipped; only the rotation remains |
| **#206** Neon Launch plan | Unchanged — already ruled 2026-08-29, lives in `docs/pre-launch.md` §3.2 |

**Two consequences, accepted explicitly rather than discovered later.**

1. **Stripe's live-mode activation is a review, not a toggle.** Holding it means that review
   time lands on the critical path at launch instead of running in the background now.
2. **`CLERK_WEBHOOK_SECRET` is a known-leaked value that stays live.** It was pasted into a
   chat transcript on 2026-08-27. The webhook endpoint is repointed and signature
   verification is enforced, so nothing is actively broken, but per `CLAUDE.md` a leaked
   credential is rotated rather than merely deleted — this is a standing exposure with a
   deferral date, not a closed item.

**What this leaves.** Nothing on the board is blocked on a human. The remaining queue is
code, and the launch-prep block is a single session with the account holder rather than five
scattered interruptions.

---

### D13: One Dropdown, One Focus Cue, and the Ring Token — *2026-08-30*

**How this came up.** The user, looking at the live landing hero, objected to three things:
the filter box inside the vendor-type panel, the focus treatment on the City field, and the
calendar glyph crowding the Search button. All three were checked against the design contract
and all three were right. Measured at 1440x900, the panel was further off than reported —
233.33px wide against a specified 330px, 28px rows against 44px, 10px radius against 12px.

**1. Single-select dropdowns have no search field.** `42-dropdowns.md` already said so, with
its reasoning: eleven categories fit one screen, and a filter box on a list that short is
friction rather than help. Type-ahead on the field replaces it. The shipped `CommandInput`
was a shadcn default that arrived with the component, not a decision anyone made.

**2. The date field loses its native control.** `input[type="date"]` renders a browser
glyph that appears in no frame, and at 1440 it abuts the Search pill at **0.00px**. The
collision is the visible symptom; the real defect is that the picker itself is un-designed
and looks different on every OS. #167's body 4 — a single-month popover reusing the
availability cell marks from #301 — is the replacement.

**3. One focus cue on the search bar, not three.** The bar had accumulated a bar-wide halo,
a per-segment tint (#89) and a per-segment inset ring (#73 law 2). Each was added for a real
reason and nobody ever removed the previous one. **The inset ring survives** because it is
the only one that says *which* segment has focus — the thing #89 and #73 were each
protecting. The halo and the tint go.

**4. The focus-ring token is raised to alpha >= 0.80, and `04-laws.md` is edited to say so.**

This is the ruling **#306 was explicitly asked to make and closed without making**.
`ring-clay-400/30` measures **1.49:1** where WCAG 2.2 SC 1.4.11 requires **3:1** for a
non-text indicator; `clay-400` needs alpha >= 0.80 to clear it on `stone-50` (3.24:1).

**#167 carries a scoped `design-plan/` exception** for that one line, on the same terms as
#320's. **This changes the focus ring on every focused control in the product** — buttons,
cards, chips, not only the search bar. That is the intended outcome, because the failure was
never local to the hero, but it means the Access axis has to be re-run on frames already
closed.

**The pattern worth naming.** This is the second ruling in one day found abandoned at a
ticket boundary: #308 closed without the `31-content-voice.md` edit #216 asked for (#320),
and #306 closed without the ring-alpha edit #73 asked for. Both had the same cause — the
edit lands in `design-plan/`, which the closing ticket had no standing to touch, so the
requirement quietly evaporated. **A ticket that cannot make a ruling it depends on must not
close without leaving that ruling somewhere that blocks.** Two exceptions have now been
granted rather than one process fix; if a third appears, fix the process instead.

---

### D14: The Focus Re-Import — What It Settled, and What It Nearly Deleted — *2026-08-30*

**What arrived.** A design update covering three plan files (`03-components.md`,
`04-laws.md`, `42-dropdowns.md`) and three parts of `Orla - Screens.dc.html` — screen `26`'s
focus blocks, screen `28`'s open segments, and the 390 search frame's scroll position.

**It was merged, not applied.** Per the standing rule that design re-imports are merges, the
incoming files were diffed against the repo first. **Three local refinements would have been
silently deleted**, all of them earned in the last three days:

| Would have been lost | Where it came from |
| --- | --- |
| The **sixth `Access` parity axis** — incoming reverts to "five axes and all five are hard gates" | #73, 2026-08-28 |
| `### The focus ring has to be **visible**, not merely declared` — the clipped-ring and styleless-outline failure modes | #73 |
| `### Decorative text is exempt from 4.5:1 — narrowly, and it must be `aria-hidden`` | #306 |

All three are preserved. **This is the second time an import would have reverted the parity
gate**; the incoming bundle is generated from a snapshot that does not carry local rulings,
so a diff before every future re-import is not optional.

**What it settles: focus is three mechanisms, chosen by what the element already has.**

| Element | Treatment |
| --- | --- |
| Standalone bordered field | `border-clay-400` + `ring-3 ring-clay-400/15`, no offset |
| Segment inside a joined bar or panel | `bg-stone-200` fill + clay label, no outline of any kind |
| Unbordered control | `ring-2 ring-clay-400/40` + `ring-offset-2` |

`03-components.md` § Inputs is now the single source; `04-laws.md` points at it. This ends a
conflict that had stood since both files were written, and it is the actual reason focus
"felt wrong" in the build — not a value being off, but two mechanisms rendering at once.

**D13 is partly superseded.** Yesterday's ruling on the hero bar chose "inset ring only, at
a stronger alpha", made before this spec existed. The answer is now a **fill and no ring at
all** on bar segments, which dissolves the WCAG contrast question there rather than
answering it — there is no longer an indicator whose contrast is in question. **D13's other
three parts stand**: the vendor-type filter box goes, the date loses its native control, and
`04-laws.md`'s ring token still governs unbordered controls. The alpha it raises is now
`clay-400/40` per this import, which is **still below the 3:1 that #73 measured as needing
alpha >= 0.80** — that gap is real, unresolved, and belongs to whoever takes **#321**.

**A ticket was mid-flight against the superseded text.** #167 is being built in a worktree
against the old `42-dropdowns.md`, which said type-ahead **jumps to first letter** and open
**replaces** focus. Both were reversed by this import: typing now **narrows the list in
place**, and open **adds to** the focused state. #167's board row and detail section carry
the warning; the work is not wasted, but two behaviours in it are now wrong.

**Filed from this import:** **#321** (three focus mechanisms replacing the blanket ring) and
**#322** (retire every native `date`, `time` and `select`, and place the calendar glyph).

**Not filed, deliberately:** the 390 search frame's frosted bar bisecting a price is a
**frame** defect, not an app one — the README's own diagnosis is that the padding was
already correct at 76px against a 68px bar and the frame was frozen at a bad scroll
position. Filing a ticket for it would have sent someone to fix working code.

---

### D15: Tags — Where They Live, and What They Are Offered For — *2026-08-30*

**Prompted by** the user asking, reasonably, where tags even are.

**They have two surfaces and neither announces itself.** Vendors claim tags in the profile
editor's **Tags** section; customers filter by them in the **Refine bar** on `/search`.
Three groups, seeded in `packages/shared/src/constants`: **language (23)**, **cultural
(16)**, **dietary (4)**.

**Rulings, all user-directed:**

1. **No search field over a tag list.** Not in the vendor picker, not anywhere. Typing
   narrows the list in place. 23 languages is exactly the case that makes a search box feel
   necessary, and it is still the wrong answer — narrowing gives the same reach with nothing
   to focus and no ring to get wrong. This closes the question **#322** had left open rather
   than deferring it again.
2. **Dietary is scoped to food.** It appears for **Catering** and **Carts** and nowhere
   else. Language and cultural stay category-agnostic, because a photographer who speaks
   Spanish is a genuine filter while a photographer who is Halal is not a coherent claim.
   The scope must come from a `servesFood` flag on the category seed rows — a slug list
   inside the Refine bar would be a second source of truth that rots the next time a food
   category is added.
3. **Style stays out, and the frames now agree.** #25 ruled it out of the MVP yesterday;
   it never reached the data model. Four frames were still drawing a `Style ▾` refine chip
   (`02`, `17`, and both 1024 variants), which would have failed every future parity run
   against tickets that are correct. Removed. Screen `28`'s multi-select example moved off
   Style onto **Languages**, since an example body has to demonstrate a filter that exists.

**Filed:** **#323**, carrying rulings 1 and 2. Ruling 3 needed no code.

**Open, and deliberately not decided here:** `Catering`'s short description reads
**"Food, bar, carts"** while **Carts is its own category** (`carts`, "Coffee & dessert").
The landing card therefore advertises carts on the tile that does not contain them. Both the
constant and frame `01` carry the string, so it is a taxonomy question rather than a typo,
and it has two defensible answers — reword Catering, or fold Carts back in. Put to the user
rather than guessed.
