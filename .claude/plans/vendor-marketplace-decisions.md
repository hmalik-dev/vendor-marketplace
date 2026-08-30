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
