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

## `Send a message` on the vendor profile is disabled until #310 (2026-08-30, #110 via #298) — **spent, #310 landed**

> **Spent on 2026-08-30.** #310 built the thread, so the control is enabled and
> both the `disabled` attribute and the `sr-only` description are gone, as the
> closing paragraph below required. Kept because the reasoning is the record of
> why an enabled frame shipped disabled for two days, and because the shape —
> a frame draws the finished product, not the build order — recurs. See
> **A thread is scoped to one booking request** below for what #310 built.

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

## A thread is scoped to one booking request (2026-08-30, #310 for #219/#229)

**Decision:** a conversation belongs to **one booking request**, plus at most one
**unattached** thread per customer/vendor pair — the one `Send a message` on a
profile opens. Not one thread per pair.

**Why this needed deciding.** The model was one per pair, and #219 measured what
that costs: three requests to the same vendor produced one thread, carrying the
*first* request's context line for all three. The deciding argument is the
design's, not an implementation preference. `18-messaging.md` heads the context
rail **This request** and gives it three actions — `Send revised quote`, `Accept
as-is`, `Decline politely`. Each acts on exactly one request. A thread spanning
three of them cannot draw that rail at all, and the list's booking context line
("Re: Jun 14 wedding"), which is what makes thirty threads navigable, would name
whichever request came first forever.

**The unattached thread is the profile button's.** A customer with questions
*before* they pick a date has somewhere to ask them, and its rail has no request
to show, which is honest. The first request they send opens its own thread beside
it rather than absorbing it.

**How it is enforced.** Two **partial** unique indexes, not one composite: under
Postgres's default `NULLS DISTINCT` a three-column key would treat every
unattached thread as distinct from every other, so a pair could accumulate one
per click of `Send a message`. `conversations_request_key` is unique on the
request id; `conversations_customer_vendor_open_key` is unique on the pair
`WHERE booking_request_id IS NULL`.

**A new message notifies once per unread run, not once per message.** Thirty
messages in a back-and-forth are one thing to be told about; thirty rows would
bury every other notification under a conversation the reader can already see.
Reading the thread re-arms it.

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

**4. The taxonomy, ruled the same evening.** The carts question turned out to be three
instances of one defect: **Catering** said `carts`, **Photography** said `film`, and
**Florals** said `decor` — every one a category advertising a sibling in its own tagline.

The ruling, against an example list the user supplied:

- **`Decor` merges into `Florals`** as **Decor & Florals**. The only merge taken.
- **Photography/Videography and Catering/Carts stay separate** — a videographer is a
  different booking from a photographer, and a coffee cart from a caterer, even where one
  vendor does both. Their taglines are reworded so neither sells a neighbour.
- **`Other` is added**, ordered last and never on the landing row. It is what makes a short
  taxonomy safe: attire, jewelry, transport and officiants have nowhere else to go.
- **Attire gets no category.** The user's example listed Jewelry and Clothing separately;
  no vendor sells attire today, and an empty tile is worse than a missing one — the same
  reasoning that dropped the Style filter. `Other` absorbs it until that changes.
- **Henna needed nothing.** Beauty's description already reads "Makeup artists, hair
  stylists, henna, and grooming"; only its tagline was hiding it.

**The finding that will cost someone a day if missed:** `CATEGORY_SLUG_SUCCESSORS` already
maps `decoration → decor` and `lighting → decor`. Retiring `decor` leaves both pointing at a
slug the seeds no longer describe, and `seedCategories` resolves no chains — for a retired
row whose successor is absent it takes the **rename** branch and would resurrect `decor` as
a live category. It breaks or not depending on object key insertion order. Both entries are
repointed at `florals` directly, and a test walks the map for any successor that is itself
retired.

All four parts landed in **#323** as one ticket rather than four, because they rewrite the
same constant and the same component; separate lanes would have collided on both.

---

### D16: The #335 Ruling Round — Chips, the Hero, Sort and Sign-up — *2026-08-30*

**What this is.** #335 put four questions to the account holder; #339 and #313 added
three more. All seven are answered here, and **every one is written into
`design-plan/` in the same pass** — which is the part D12 skipped and the reason two of
its rulings had to be asked twice.

**The propagation failure, recorded so it is not repeated.** D12 ruled the booking
deadline back to 7 days on 2026-08-30 and granted a one-off exception to edit
`31-content-voice.md`. The edit was never made. The file still read *"Maya has 48
hours"* — the approved-strings table every ticket copies from — so the next screen to
quote it would have promised a deadline the API refuses, at the moment of commitment.
D12 also ruled #299's two fields relocated rather than deleted, and the backlog
consolidation nonetheless re-filed that same question as #335-D. **A ruling that lives
only in this file is not landed.** It is landed when the `design-plan/` file a ticket
actually reads says it.

**1 — The hero seeds nothing** (#327). All three segments render empty, in the
placeholder tone `#6B6459`. Frame `01` draws the City segment as the literal
`Austin, TX` in `#23201C`, the *filled* tone, and templates the vendor type — so the
frame reads as a seeded query and live reads as three empty fields. **The frame is
corrected, not the code.** Rejected: hard-coding `Austin, TX`, which is a claim about
where the marketplace operates that no query result supports; deriving a seed from the
live-market list, which is honest but builds machinery for a state (two or more
markets) that does not exist; and drawing the empty value in the filled tone, which
reads as a value that is not there. The hero *badge* still reads "Now booking in
Austin" — naming the market out loud is a different act from pre-filling a stranger's
query. Landed in `10-landing.md`, `99-open-questions.md`.

**2 — "Scarce" is never defined, because the gold chip is dropped** (#324).
`03-components.md` said the availability chip is "gold when scarce ("2 dates left")"
and never said what scarce was. The count is a real query result; the *threshold* —
free dates in what window, below what number — is an invented number. Rejected: ≤2 free
days in the next 30, and ≤3 in the searched month; both are defensible and both are
made up. Nothing shipped the tone anyway — `vendor-card.tsx` only ever rendered sage.

**3 — And the sage chip goes too, on the results grid** (#324). The sharper ruling, and
the user's: a dated query is *filtered* on availability, so every card that survives one
is free on that date by construction. `vendor-search.dao.ts` hard-codes
`availableOnDate: true` on every row of a dated query and says so in its own comment.
The chip was a tautology.

**The carve-out that keeps this from breaking a screen:** the sage chip survives on the
**"free on a nearby date instead" band** that closes frame `18 Search no results`, where
`nearby-dates-band.tsx` passes `nearestAvailableDate` and the chip names a *different*
date than the one searched. There it is the only thing that unsticks a dead-end query.
Frame `18`'s two gold chips become that sage nearby-date form rather than disappearing.

**4 — The stone `New` chip is a "joined recently" badge** (#324). Vendor published
within the last 30 days. It is in no plan file and frame `02` puts it on a vendor
already showing ★ 5.0 (17), so it is neither "unreviewed" nor an availability state.
Rejected: reading it as a third availability tone ("no calendar set"), which fits the
slot but not the frame's own example. With sage and gold gone from the grid it is the
only chip a search card carries, so the collision question answers itself.

**5 — Search sort defaults to `Most relevant`** (#339). No plan file had ever fixed a
default; frame `02` draws `Top rated ▾`. The frame draws a *chosen* sort exactly as it
draws a chosen price and a chosen rating, so it is not evidence the default is wrong —
`parity-checker` was right not to call it a deviation. Rejected: matching the frame,
because a new marketplace defaulting to `Top rated` ranks its thinnest review counts
first and one 5★ review outranks forty. Revisit against real review volume.

**6 — `Create my account`, and the plan was already right** (#313). Frame `12` draws it
and `21-sign-up.md` has specified it since it was written; the live button reads Clerk's
default `Continue`. A code defect, not a plan gap.

**7 — The sign-up photograph is fixed, so no scrim** (#313). The panel sets copy over a
600px full-bleed photograph with no automatic contrast guarantee. Safe because the asset
is a single committed, hand-picked image the account holder validates — **not vendor
content, never rotated, never dynamic**. Rejected: a gradient scrim, which costs a
deviation from frame `12` and dims the art direction for a risk that the rule removes.
Any ticket that makes the image dynamic must add the scrim in the same change.

**8 — The role picker reappearing after email verification is a defect** (#313), and
carrying the role is possible. The role is read from `?role=` server-side
(`sign-up/[[...sign-up]]/page.tsx`) and handed to Clerk as `unsafeMetadata`
(`sign-up-form.tsx`) before verification; Clerk's verification step is a path navigation
that remounts the page, and the picker — local state seeded from the query string —
resets to unselected. The role is already in `unsafeMetadata`, so it is read back from
there, or the picker is suppressed once verification is pending. **No larger
select-role-after-verification flow is needed.** Rejected: treating the second ask as a
deliberate confirmation — the screen's own subhead promises the choice cannot be changed
later, so asking again contradicts it.

**Also corrected in this pass**, under D12's granted exception: `31-content-voice.md`'s
**Request reassurance** row. It is split into **packaged** (confirm or decline — the
price is immutable) and **custom** (confirm or send a quote), per #308, and both read
`{expiryDays}` rather than a typed literal. A note under the table states the law: **no
approved string hard-codes a duration the code derives.** The table's other two
durations were checked and stay — "4 bookings across 2 upcoming events" counts rows, and
the payout gate's "about five minutes" estimates Stripe's onboarding rather than a
deadline this codebase enforces.

**What this unblocks.** #327, #324, #299 and #313 lose their `Deferred` status; #339 and
#320 are closed by the ruling itself. The code halves are ordinary work: remove a chip
and a tone, correct four frames, change one button string, and carry one value across a
redirect.

---

### D17: Three More Design Rulings — Avatar Tint, Missing Covers, the 500 CTA — *2026-08-30*

**What this is.** Lanes 302 and 305 landed while D16 was being written and filed three
more `[DESIGN] … needs a human` rows — #342, #348, #350. All three are answered here and
written into `design-plan/` in the same pass, per D16's rule that a ruling living only in
this file is not landed.

**1 — `clay-150: #EADCCB` is added to the ramp** (#342). The frames draw the clay avatar
fallback fill at **42 sites across 20 frames**; the ramp went `clay-100` (`#F7E7E0`)
straight to `clay-200` (`#EFD8CC`) and had no step for it. Everything else about the
avatar already resolved exactly — the clay initials are `#8E3F20` = `clay-600`, and the
sage pair is `#E4E9DE` / `#4B5940` — so the fill was the single off-token value. **The
ramp was incomplete, not the frame wrong**, which is the same finding #306 made about
`#C4D6A8` / `#5C4A18`. `sage-150` and `stone-150` gave the step its name. Rejected:
correcting 42 frame sites down to `clay-100`, which is more work and lowers contrast
under the `clay-600` initials; and reusing `clay-200`, whose documented role is borders
on clay surfaces and which still is not the drawn value. `avatar.tsx:17`'s
`FALLBACK_TONES` changes one string.

**2 — A published vendor with no cover gets a designed empty state** (#348). Two
documents disagreed: `03-components.md` defines the labelled hatch as standing in "until
real photography exists", and `web-design-parity.md` permits real photos in place of
labelled placeholders — both about the *product* lacking imagery before launch. #228 was
about a different absence: a live vendor's empty field, rendered by
`vendor-card.tsx` and `profile-header.tsx` on `/search` and `/vendors/[slug]`, **shown to
that vendor's own customers**. The hatch reads as an unfinished product rather than an
unfinished profile, and it is addressed to a developer. So the placeholder is now
explicitly a **build-time device** — frames and pre-launch seed rows only — and the live
surface gets a neutral tone block at the cover's exact dimensions, no hatch and no label.
**The cause and the fix belong in the editor, where the vendor is** (#299 builds the drop
zone), not on the page their customers read. Rejected: making a cover a publish
requirement, which solves the public surface by adding a publish blocker and a migration
for every already-published vendor without one.

**3 — The 500 page says "Browse vendors"** (#350), going to `/search`, and **frame `16`
is corrected**. It drew `Go to my bookings`, offering a visitor who has never signed in a
link to bookings they cannot have. #305 changed the string as a ticket, correctly
reverted it — the words are the design and a ticket may not edit approved copy — and
filed the question. This is the design pass that may. Rejected: an auth-aware pair of
strings, because `global-error.tsx` renders **outside the Clerk provider** and cannot know
who is reading, so it needs a signed-out default anyway and two strings on one screen
drift apart; and accepting the inaccuracy, since it is a dead end on a page that is
already a failure. Landed in `40-states.md`, `31-content-voice.md`, `99-open-questions.md`.

**Board effect.** #342, #348 and #350 move `Deferred — needs a human` → `Backlog`. With
D16, **nothing on the board is blocked on a design decision.** What remains needing a
human is the launch-prep block alone: #19, #62, #46, #206 and #15's `SENTRY_DSN` half.

---

### D18: The Admin Table Zebra Gets a Token — *2026-08-31*

**Filed by #15**, which builds the admin portal and is the first surface to need it.

`design/design-plan/22-admin.md:24` specifies the table's zebra stripe as a **raw hex**,
`#FDFAF4`, and frame `13 Admin` draws it on every even row. No token carries that value:
the warm stone ramp runs `stone-0 #FFFDF9` → `stone-50 #F8F5EF`, and the zebra sits
between them. Every other value on the frame resolves — `stone-100` is literally commented
*"table header"*, the four status pills are the existing `confirmed` / `pending` /
`needsYou` / `inert` tones — so this is the one hole.

**Ruling: add `--color-stone-25: #fdfaf4`**, commented as the admin table zebra.

**Why this is not the thing #373 forbids.** #373's non-goal is *"adding a `stone-800`
token to the ramp"* — and that is a different situation in the way that matters.
`stone-800` is a step somebody **wrote by mistake**, which Tailwind then silently resolved
to its own cool built-in; the fix is to stop using it, and adding it would bless the
error. `stone-25` is a value the **design plan states in writing** and the frame draws,
which has no name. Naming it is what lets the surface be built without an inline hex, and
it makes #373's undefined-step guard *easier* to satisfy, not harder: after this, every
colour on frame `13` is a defined token and the guard can run clean over the admin tree.

**Rejected:**

- **`stone-50` for the zebra.** It is `#F8F5EF` against the frame's `#FDFAF4` — a visible
  step, and the parity Colour axis requires the same token value, not a near one. A screen
  that reproduces the composition in the wrong colour has failed.
- **An inline `bg-[#FDFAF4]`.** Forbidden outright: *"any hex, width or radius written
  inline in a component"* is old-design debt, and #373 is adding a guard that would fail on
  it.
- **Leaving the zebra off.** The stripe is what makes a 15-row 44px table scannable, which
  is the stated purpose of the screen — *"scannability beats airiness"*.

**Collision note.** This edits `packages/config/tailwind/theme.css`, which **#373 also
owns**. #373 adds the 12px radius step and the undefined-step guard to the same file.
Whichever lands second rebases; the two changes are additive and do not overlap by line,
but they must not run concurrently in two lanes.

---

### D24: The Serif Floor Beats the Frames on Avatar Monograms — *2026-08-31*

**Ruled by #373.** `01-foundations.md:118` states "**Never below 16px**" for Instrument
Serif as a rule of the type system, and `display-type.test.ts` enforces it across the whole
tree. `avatar.tsx` was exempt — not licensed, but unreadable: the glyph size comes from a
numeric prop through the `style` attribute, so no class states it and the guard could not
see the number.

Four of the six sizes were below the floor: `xs` 13px, `row` 13px, `sm` 13px and `md`
15.96px. And the frames genuinely draw all four in the serif —
`font-family:'Instrument Serif',serif;font-size:13px` on frame `13 Admin`'s 30px circle,
14px on the 32px circles in `02`, `03` and `07`. So this is **frame versus law**, not code
versus frame.

**The law wins, and the face changes rather than the size.** Below the floor the monogram
is set in Instrument Sans; at or above it, in Instrument Serif as before.

**Rejected: raising the four glyphs to 16px.** It satisfies the floor on paper and breaks
four frames' geometry — the monogram's ratio to its circle goes from the frames' 0.43 to
0.53 on a 30px avatar, which the Layout and Style axes both read as a miss. Changing the
face deviates on the **Font axis alone**, at exactly the size range the floor exists to
forbid, and every measured circle and glyph size survives untouched.

**The guard moves with it.** `avatar.test.tsx` now renders each of the six sizes and
asserts the face against the component's own `SERIF_FLOOR_PX`, plus a non-vacuity check
that four sizes fall below the floor and two above. The class-based guard still cannot read
an inline `style`; this is the check that closes the gap it names.

---

### D25: The Disclosure Caret Comes Off Every Trigger — *2026-08-31*

**A user override of the design contract, not a parity finding.** Recorded here because
that distinction is the whole point: `Orla - Screens.dc.html` draws `▾` on its dropdown
triggers and `42-dropdowns.md` specifies it in writing. The user overrides both and is
correcting the frames themselves. For once the code leads the contract, which is the
reverse of this repository's standing rule that design passes edit the plan and tickets
write the code.

Fourteen render sites came out in #373. Twelve were a separate `aria-hidden` span. Two —
`bookings-refine-chips.tsx:99,115` — built the glyph into a **template literal inside the
button**, so it was part of the accessible name: a screen reader announced *"All categories
black down-pointing small triangle, button."* Those two chips are now named `All
categories` and `Soonest first`, and six test assertions were rewritten to name them
explicitly rather than loosened to a substring match.

Every trigger keeps `aria-expanded` and stays visually identifiable as a control. No
trigger was left with an empty span or padding reserving space for a glyph that is gone;
`ChipLabel` and `SelectCaret` both existed only to pair a label with a caret and are
deleted.

**Why it needs an assertion.** It has already come back twice, as #228 and again as #338,
because nothing recorded the override — a parity pass reads the frame, sees a caret the app
does not draw, and correctly files it. `dropdown-caret.test.ts` states the override as a
check, and `frame-13-parity.test.ts` inverts its own `toContain('▾')` rather than deleting
it, keeping the frame half intact because the frame really does still draw one.

---

### D26: The Hatch Is an Editor Primitive; the Labelled `Placeholder` Is Retired — *2026-08-31*

**Ruled by #373**, closing the question #369 left open.

`03-components.md:176` already states the principle — "The labelled placeholder is a
build-time device, not a live empty state" — and D17 ruling 2 settled the public half: a
coverless vendor gets a neutral tone block, never a hatch and never a developer-facing
label naming the shot the product is waiting for.

What was left was a component nobody rendered. `<Placeholder>` had **zero** call sites, so
the only way it could return was by accident, on the surface where it is forbidden: the
frames draw hatched swatches, and the obvious way to reproduce one is to reach for the
component named after it. `placeholder.tsx` is deleted.

**`@utility placeholder-hatch` stays.** `image-upload.tsx` draws the frames' own gradient
in the empty drop zone, which is the legitimate build-time use — an editor surface, seen by
the vendor filling it in.

`placeholder-hatch.test.ts` enforces both halves: the hatch appears only on the editor
surfaces named in the test, and no labelled `Placeholder` ships. The second is asserted by
the file's absence rather than by scanning for its name, because a name scan passes right
up until the moment someone writes one.
