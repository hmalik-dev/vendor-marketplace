# Pre-launch checklist — everything that must change before real users

**Status as of 2026-08-27: development only. No real users, no real money, no
real vendors.** Every item below is safe _because_ that is true, and becomes a
defect the moment it stops being true.

This file is the gate. Nothing here is optional; items marked **BLOCKER** would
cause user-visible harm, legal exposure, or data loss on day one.

The ticket tracker (`.claude/plans/vendor-marketplace-tickets.md`) holds the
build queue. This file holds the things that are _not_ tickets — configuration,
credentials, data and legal — plus pointers to the tickets that are.

---

## 1. BLOCKERS — do not launch with these

### 1.1 Production is serving fabricated vendors and fabricated reviews

**Verified 2026-08-27.** `GET /vendors` on the live site returns **16 invented
photography vendors** — "June Harlow", rating **4.9**, **127 reviews** — seeded
by `pnpm db:seed:marketing` (ef8b341), together with **918 reviews behind 918
fabricated completed bookings**.

**They are not in the `production` database.** The deployed API reads the Neon
**`dev`** branch — see ticket **#48**, found by comparing the two APIs during the
Railway cutover: `production` holds 0 vendors and 10 categories, `dev` holds 16
and 11. This is deliberate for now, so the deployment keeps usable design-parity
data while there are no real users, and the `production` branch stays clean.
**The launch swap is therefore a data _and_ a connection-string change**, and
both must happen together.

This is the single most serious item in this file. A real customer cannot tell
these from real supply; they carry ratings, review counts and prices that no
transaction ever produced. Shipping it is misrepresentation, and it directly
contradicts the project's own rule that _no number on a public page is unread
from the database_.

- [ ] **Purge the marketing seed from the production branch** before the first
      real user, or
- [ ] launch with real vendor supply only and keep the seed to `dev`.
- [ ] Add a guard that fails a production deploy when seeded demo rows are
      present — this is exactly the kind of thing that survives by accident.
- [ ] Confirm `pnpm db:seed:marketing` cannot be pointed at `production`.

### 1.2 Clerk is a development instance

Production currently authenticates against **`stirred-flea-3295.clerk.accounts.dev`**
with `pk_test_` / `sk_test_` keys. Clerk development instances are rate-limited,
carry dev-only session behaviour, and are not supported for production traffic.

- [ ] Create the Clerk **production instance**, on the real domain.
- [ ] Swap `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (`pk_live_`) and
      `CLERK_SECRET_KEY` (`sk_live_`) on **both** Vercel and Railway.
- [ ] Re-create the webhook endpoint on the production instance and set the new
      `CLERK_WEBHOOK_SECRET` — see §2.3 and ticket **#46**.
- [ ] Verify sign-up, sign-in and role assignment end to end against the
      production instance.

### 1.3 Stripe is in test mode

`sk_test_` / `pk_test_`, and `STRIPE_WEBHOOK_SECRET` is still the literal
placeholder. No money can move.

- [ ] Live Stripe keys and a live Connect platform (**#9**).
- [ ] Live webhook endpoint + signing secret, pointed at the production API.
- [ ] Complete the payment lifecycle (**#10**) — it does not exist yet.
- [ ] Verify a real end-to-end booking, capture, payout and refund before
      opening to customers.

### 1.4 No security headers on the web tier

`apps/web/next.config.ts` sets no `headers()` at all — no HSTS, CSP,
`X-Content-Type-Options`, `Referrer-Policy` or frame protections. The API is
properly hardened (helmet, cors, rate-limit); the web tier is not. Ticket **#30**.

- [ ] Add the header set and verify against a real response, not the config.

### 1.5 No terms of service and no privacy policy

`apps/web/src/app/` has no `terms` or `privacy` route. A marketplace taking
payments and storing personal data cannot launch without them, and Stripe
Connect onboarding expects them.

- [ ] ToS + privacy policy pages, linked from the footer and from sign-up.
- [ ] State the cancellation and refund policy the product actually enforces:
      **100% refund over 48h, 50% under 48h** (decision D3), platform commission
      **12%** (D4).

---

## 2. Credentials and environment

### 2.1 Rotate everything exposed during setup

These were pasted into a chat transcript on 2026-08-27 while provisioning
Railway. Harmless today — empty bucket, dev instance, no users — but they must
not reach launch.

- [ ] **R2 access key id + secret access key** — create a new R2 API token,
      update the two Railway vars, delete the old token.
- [ ] **`CLERK_WEBHOOK_SECRET`** — rotate in Svix, update Railway. Moot if
      §1.2 replaces the instance entirely, which it should.

### 2.2 Placeholder values still in the production API environment

Railway was provisioned from `.env.example` verbatim. Fixed on 2026-08-27:
`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NODE_ENV`, `WEB_URL`, `API_URL`,
`CLERK_WEBHOOK_SECRET`, `CLERK_SECRET_KEY`, and all four `S3_*` values. Still
literal placeholders, and only unblocked because nothing consumes them yet:

- [ ] `RESEND_API_KEY` (`re_...`) and a **verified sending domain** with SPF and
      DKIM — without this every transactional email lands in spam (**#11**).
- [ ] `EMAIL_FROM` — currently `noreply@ve…`, must be on the verified domain.
- [ ] `SENTRY_DSN` (`https://...`) — no error reporting exists until this is real
      (**#15**).
- [ ] `STRIPE_*` — see §1.3.

### 2.3 Webhook endpoints must point at the production API

- [ ] **Clerk** — was pointed at a `clerk webhooks listen` **CLI relay**, so
      `user.updated` / `user.deleted` were silently dropped in production
      (**#46**). Repointed at Railway during cutover; re-do on the production
      instance.
- [ ] **Stripe** — endpoint + signing secret against the production API.
- [ ] Add a check that fails if a configured webhook target is not a real API
      origin. Nothing guards this today, which is how #46 survived unnoticed.

### 2.4 Domain and DNS

Everything is on `*.vercel.app` and `*.up.railway.app` today.

- [ ] Real domain, on Cloudflare.
- [ ] `WEB_URL`, `API_URL`, `NEXT_PUBLIC_API_URL` and `BRAND_DOMAIN` all on it.
- [ ] Clerk production instance on the domain (§1.2).
- [ ] `cdn.` subdomain for R2 — see §3.1.

---

## 3. Storage and data

### 3.1 R2 is on the public development URL

`S3_PUBLIC_URL` is `https://pub-f0933b41….r2.dev`. Cloudflare **rate-limits**
this URL, excludes it from its cache, and does not recommend it for production —
no caching means slower LCP and more billed Class B operations, on exactly the
image-heavy vendor pages the product depends on for organic traffic.

**This is time-sensitive.** Image URLs are stored **absolute** in the database
(`storage.ts:41`), so changing `S3_PUBLIC_URL` later does not repoint existing
images — it leaves rows split across two hosts and needs a data migration. The
bucket is empty today. Ticket **#47**.

- [ ] Attach a Cloudflare **custom domain** to the bucket **before real vendors
      upload**, or
- [ ] store the **object key** and resolve the base URL at render time — the
      better long-term shape, but it touches every image-bearing column and its
      wire schema.

### 3.2 Database

- [ ] **Switch the API off the `dev` branch onto `production`** (**#48**) — it
      reads `dev` today, by decision, and nothing enforces the direction.
- [ ] Re-run the reference seed on `production`: it is **stale**, carrying 10
      categories where `dev` has 11.
- [ ] Extend preflight so a _production_ target refuses a non-production branch.
      It enforces only the opposite direction today.
- [ ] Point-in-time recovery / backup retention confirmed and tested by doing a
      real restore, not by reading the setting.
- [ ] Migrations run as a gated pre-deploy step and roll back cleanly on failure.
- [ ] Review the `max: 10` connection pool against the real replica count.

### 3.3 Upload limits disagree across the stack

Spec says **JPG or PNG · 12 MB · min 1200px · 20 files**; the app says "JPEG,
PNG, or WebP, up to 10MB" in three places and enforces no minimum dimension and
no batch limit (**#29**). Separately, if any part of the API ever runs on Vercel,
its **4.5 MB body cap** silently breaks uploads (**#34**, resolved by D10 —
API on Railway).

---

## 4. Product completeness

The marketplace cannot take a booking today. Every ticket below is MVP; see the
tracker for detail.

- [ ] **#7** Booking request — the spine everything hangs off
- [ ] **#22a / #22b** Vendor dashboard and customer bookings hub
- [ ] **#8** Messaging + notifications
- [ ] **#9 / #10** Stripe onboarding and the payment lifecycle
- [ ] **#12** Reviews — the landing page promises "reviews from real bookings"
      and every card renders a rating
- [ ] **#11** Transactional email
- [ ] **#16** Customer profile
- [ ] **#29** Search and upload states
- [ ] **#33** Front-door resilience — one failed reference read currently 500s
      every route
- [ ] **#14** Demo dataset and E2E suites — note the tension with §1.1: demo data
      must never reach production

---

## 5. Correctness and polish

- [ ] **#42** Soft 404 — `notFound()` returns **HTTP 200** in production, so
      every removed vendor URL gets indexed as a live page
- [ ] **#30** No `robots.ts`, `sitemap.ts`, `opengraph-image`, `manifest.ts` or
      `metadataBase` — the site is uncrawlable and every shared link renders a
      blank card
- [ ] **#45** Mid-width layout defects at 768 and 1024
- [ ] **#26** Responsive header parity; **#25** style tags; **#37** search button
      discipline; **#39** state library; **#41** vendor tagline and experience
- [ ] Accessibility pass: keyboard traversal, focus order, contrast, and screen
      reader labels on every shipped surface
- [ ] Design parity gate re-run at 1440 / 1280 / **1024** / 768 / 390

---

## 6. Operations

- [ ] **#20** Deploy pipeline — gated, with rollback
- [ ] **#35** Post-deploy smoke check. The API answered **500 on every route for
      19 hours** while the platform reported the deployment healthy; a build that
      never invokes a route cannot detect a broken runtime
- [ ] **#19** Production environment provisioning, completed and documented
- [ ] Sentry alerting wired to somewhere a human actually reads
- [ ] Uptime monitoring on `/ready`, not `/health`
- [ ] An on-call path and a documented rollback procedure
- [ ] Rate limiting: `@fastify/rate-limit` is **per-instance and in memory**.
      Correct on a bounded Railway replica count; revisit before scaling out

---

## 7. Legal and business

- [ ] ToS, privacy policy, cookie notice (§1.5)
- [ ] Stripe Connect terms accepted; platform account fully verified
- [ ] Vendor agreement covering the 12% commission and payout timing
- [ ] Refund and cancellation policy shown before payment, matching what the
      code enforces
- [ ] A support contact route that reaches a human
- [ ] Confirm the licensing of every shipped marketing image and the landing
      category photography

---

## 8. Launch-day sequence

1. Freeze `main`.
2. Purge demo data (§1.1) and verify `GET /vendors` returns only real supply.
3. Swap Clerk, Stripe, Resend and Sentry to production credentials.
4. Cut DNS to the real domain; verify Clerk and CORS on it.
5. Run migrations; verify `/ready` reports `database: up, storage: up`.
6. Smoke test: sign up as customer and as vendor, publish a profile, upload an
   image, send a booking request, pay, message, review, refund.
7. Verify security headers, `robots.txt`, `sitemap.xml` and a share card on a
   real URL.
8. Confirm error reporting and uptime alerts fire — by deliberately breaking
   something, not by assuming.
9. Rotate every credential touched during setup (§2.1).
10. Unfreeze.
