# Vendor Marketplace — Project Plan

## 1. Product Brief

**VenMatch** is a two-sided web marketplace connecting customers with event service vendors (photographers, DJs, makeup artists, decorators, caterers, florists, etc.). Think "Airbnb for event vendors."

**Problem:** Booking event vendors today involves trust gaps (no verified reviews), pricing opacity (opaque quotes with no baseline), and coordination friction (phone/email tag, lost threads, manual payment).

**Solution:** A platform that provides preset packages with transparent pricing, verified reviews tied to real bookings, secure payment via Stripe Connect, and in-app messaging with booking context.

**Target users:**
- **Customers:** People planning events (weddings, corporate events, birthday parties, etc.) in a local market. Non-technical, expect consumer-grade UX.
- **Vendors:** Independent event service professionals and small businesses. Need a simple onboarding flow, profile builder, and booking management dashboard. May not be tech-savvy.

**Primary user journeys:**
1. **Vendor onboarding:** Sign up → create profile → add packages → upload portfolio → set availability → connect Stripe → publish profile
2. **Customer discovery:** Browse/search vendors → filter by category/location/price/date → view vendor profile → see packages, portfolio, reviews, availability
3. **Booking flow:** Select package (or submit custom request) → vendor quotes/accepts → customer pays → event occurs → vendor marks complete → both leave reviews
4. **Messaging:** Customer and vendor communicate in context of a booking request

**Success measures (MVP):**
- A vendor can go from zero to published profile in under 15 minutes
- A customer can find, book, and pay a vendor in a single session
- Complete booking lifecycle works end-to-end with real Stripe test payments
- Zero payment-related data inconsistencies under concurrent usage

**Operating environment:**
- **Built 100% via Claude Code orchestration** — stack and architecture optimized for agentic development: strong types, convention-heavy patterns, co-located code, shared schemas
- **Solo developer** — no team coordination overhead; optimize for velocity and correctness
- **Timeline:** Ship within 4 weeks
- **Budget:** Reasonable spend; free tiers preferred but not required
- **Scale:** Small local market at launch (50-200 vendors, ~1000 customers), architected for growth without rewrites

---

## 2. Requirements & Non-Goals

### Requirements

**Functional:**
- Customer and vendor registration with role selection
- Vendor profile management (business info, photos, location, service radius)
- Service package CRUD with pricing (fixed, starting-at, hourly)
- Portfolio image management with ordering
- Availability calendar management
- Vendor search with filters: category, city/state, price range, availability date, minimum rating
- Booking request flow: package-based and custom requests
- Vendor quoting and acceptance workflow
- Stripe Connect vendor onboarding (hosted, Express accounts)
- Payment via Stripe PaymentIntent with platform commission (12%)
- Booking lifecycle: pending → quoted → accepted → confirmed (paid) → completed → reviewed
- In-app messaging tied to booking context (SSE for real-time)
- Two-way reviews (customer→vendor public, vendor→customer private)
- In-app notifications for key events
- Transactional email for critical events (booking confirmation, payment receipt, new request)

**Non-functional:**
- Page loads under 2 seconds on 3G (Server Components + optimized images)
- API response times under 200ms for read operations, under 500ms for writes
- Payment operations are transactional — no partial state (paid but not confirmed)
- Structured logging with Pino, error tracking with Sentry
- All user input validated at API boundary via Zod
- **Desktop-first** responsive design: designed and reviewed at the 1440×900 reference viewport first, then adapted down to Laptop 1280×800, Tablet 768×1024, and Mobile 390×844 (see `design/design-plan/04-laws.md` and `design/design-plan/30-responsive.md`)
- All frontend work must pass the **Desktop Review Checklist** at 1440×900 — including the per-surface scroll budget — before the adaptation checklist is run at the narrower widths (see `design/design-plan/04-laws.md` and `design/design-plan/30-responsive.md`)

**Compliance (minimal viable):**
- Terms of Service and Privacy Policy pages (static content)
- Cookie consent banner
- Stripe handles PCI compliance for payment data
- No direct storage of payment card details
- HTTPS everywhere (enforced by deployment platforms)

### Non-Goals (explicit MVP exclusions)

These are deliberately excluded and will NOT be built in MVP:

- **Mobile app** — web is responsive; native app is post-MVP if traction warrants
- **Social login** (Google/Apple) — Clerk supports it, but email/password is sufficient for MVP
- **Admin dashboard** — manage via database/Stripe dashboard directly for MVP
- **Dispute resolution workflow** — handle manually via Stripe's dispute tools
- **Calendar integrations** (Google Calendar, iCal sync)
- **Map-based search** / PostGIS geospatial queries — city/state text filter for MVP
- **Multi-vendor booking** (booking multiple vendors for one event as a package)
- **Vendor subscription tiers** / featured listings
- **Internationalization / multi-currency** — USD only
- **Customer favorites/wishlists** — deferred to post-MVP
- **AI-powered matching/recommendations**
- **GDPR-specific features** (data export, automated account deletion) — handle manually if requested
- **Vendor analytics dashboard** — deferred; vendors see booking counts on their dashboard

---

## 3. Technology Stack & Rationale

### Decisions

| Decision | Choice | Rejected Alternatives |
|----------|--------|----------------------|
| Platform | Web-first (Next.js 15, responsive) | — |
| Backend | Separate Fastify 5 API | Next.js API Routes, Express, Hono, NestJS |
| ORM | Drizzle ORM | Prisma, Knex, raw SQL |
| Database | PostgreSQL 16 (Neon prod, Docker local) | Supabase, PlanetScale |
| Auth | Clerk | Custom JWT, NextAuth/Auth.js, Lucia (deprecated) |
| Payment | Stripe Connect (Express, 12% commission) | — |
| Monorepo | Turborepo + pnpm | Nx |
| Styling | Tailwind CSS 4 + shadcn/ui | CSS Modules, Styled Components |
| Validation | Zod (shared FE + BE) | Yup, Joi |
| File storage | Cloudflare R2 | AWS S3, Supabase Storage |
| Email | Resend | SendGrid, AWS SES, Postmark |
| Real-time | SSE (MVP) | WebSocket, Pusher, Socket.IO |
| Error tracking | Sentry | LogRocket, Datadog |
| CI/CD | GitHub Actions | — |
| Testing | Vitest + RTL + Supertest + Playwright | Jest |

### Rationale for Key Decisions

**Fastify over Express/Hono/NestJS:**
Fastify's type-provider-zod gives end-to-end type safety from Zod schema through route handler to response — Claude Code cannot produce type errors that silently pass. Built-in Pino logger handles structured logging without additional dependencies. Plugin system handles cross-cutting concerns (CORS, rate limiting, auth verification) cleanly. Express lacks built-in TypeScript support and async-first design. Hono is promising but has a thinner ecosystem for Stripe webhooks, file uploads, and SSE. NestJS is too verbose and decorator-heavy for a solo agentic build.

**Drizzle over Prisma:**
SQL-like query builder means generated queries read like SQL — easier to verify correctness, especially for complex joins (vendor search with category filters, availability intersection). Schema-as-TypeScript gives Claude direct read/modify access without a separate `.prisma` DSL. Lighter runtime with no query engine binary. Prisma's higher abstraction is better for teams but adds indirection that makes agentic debugging harder.

**Clerk over custom JWT / NextAuth / Lucia:**
Custom JWT auth is the #1 source of security bugs in web apps. Clerk eliminates the entire auth attack surface: password hashing, session management, CSRF, token rotation, email verification, password reset. Free tier covers 10k MAU. Works cleanly with separate frontend/backend architecture — React SDK on frontend, `@clerk/backend` JWT verification on Fastify. NextAuth is designed for Next.js API routes, creating friction with a separate Fastify backend; its credentials provider is discouraged for production. Lucia was deprecated/archived in early 2025.

**R2 over S3/Supabase Storage:**
S3-compatible API means zero code changes if migrating later. No egress fees — critical for an image-heavy marketplace. Pairs with Cloudflare DNS/CDN already in the deploy plan. S3 is more battle-tested but egress costs scale unpredictably.

**SSE over WebSocket for messaging:**
Messaging in a vendor marketplace has hours-scale response times, not seconds. SSE handles "new message" notifications with one fewer protocol to manage, no WebSocket connection lifecycle, and better proxy/CDN compatibility. Client sends messages via POST; receives notifications via SSE. WebSocket upgrade is a post-MVP concern if real-time typing indicators ever matter.

**Turborepo over Nx:**
Simpler configuration for a 4-package monorepo. `turbo.json` is ~20 lines. Nx's power (affected-project detection, custom generators) is unnecessary overhead. Vercel maintains Turborepo — good ecosystem fit with Next.js.

**Resend over SendGrid/SES:**
Best DX: single API call, TypeScript SDK, React Email for templates. 3k emails/mo free covers MVP. No DNS verification complexity like SES. Migration to SES is straightforward if volume grows.

**Vitest over Jest:**
Vitest is faster, natively supports ESM and TypeScript without babel transforms, and has a compatible API with Jest. Better DX with watch mode. The ecosystem has largely moved to Vitest for new projects.

**Playwright for E2E:**
Browser-level smoke tests for critical user journeys. Runs headless in CI, enables fully agentic verification — no manual browser testing required. Playwright's auto-wait and locator APIs make tests deterministic without sleep hacks.

---

## 4. Architecture

### Monorepo Package Boundaries

```
vendor-marketplace/
├── apps/
│   ├── web/          → Next.js 15 frontend (depends on: shared, db types)
│   └── api/          → Fastify 5 backend (depends on: shared, db)
├── packages/
│   ├── shared/       → Zod schemas, types, constants, utilities (no deps on apps)
│   ├── db/           → Drizzle schema, client, migrations, seed (depends on: shared for enums)
│   └── config/       → ESLint, TypeScript, Tailwind shared configs (no runtime deps)
```

**Dependency direction:** `apps → packages`, never the reverse. `packages/shared` has no dependency on `packages/db`. `packages/db` may import enums/constants from `packages/shared`.

### Frontend Architecture — `apps/web/`

**Framework:** Next.js 15 App Router with React Server Components.

**Rendering strategy:**
- **Public pages** (vendor profile, search, landing, categories): Server Components fetch from Fastify API. SEO-critical, fast initial load.
- **Dashboard pages** (vendor/customer): Server Components for initial data load, client components for interactive elements (forms, real-time updates).
- **Mutations** (forms, actions): Client-side fetch to Fastify API. Clerk session token included automatically via `useAuth().getToken()`.
- **Real-time** (messages): Client-side SSE connection directly to Fastify.

**Auth flow (frontend):**
- `<ClerkProvider>` wraps the app in root layout
- Public routes: no auth required
- Auth routes: `<SignIn>` and `<SignUp>` Clerk components (or custom forms with `useSignIn`/`useSignUp` hooks)
- Protected routes: `<SignedIn>` gate or middleware-based redirect
- API calls: Clerk provides session token via `getToken()`, sent as `Authorization: Bearer <token>`

**State management:** No global state library. Server Components for server state, React Hook Form for form state, `nuqs` for URL params, local `useState`/`useReducer` for component state. SWR or `useSWR` for client-side data fetching with revalidation.

**Route structure:**
```
app/
├── (public)/                    # No auth required
│   ├── page.tsx                 # Landing page
│   ├── search/page.tsx          # Search/browse vendors
│   ├── vendors/[slug]/page.tsx  # Public vendor profile
│   └── categories/[slug]/page.tsx
├── (auth)/                      # Clerk sign-in/sign-up
│   ├── sign-in/[[...sign-in]]/page.tsx
│   └── sign-up/[[...sign-up]]/page.tsx
├── (customer)/                  # Auth: customer role
│   ├── dashboard/page.tsx
│   ├── bookings/page.tsx
│   ├── bookings/[id]/page.tsx
│   └── messages/page.tsx
├── (vendor)/                    # Auth: vendor role
│   ├── dashboard/page.tsx
│   ├── profile/edit/page.tsx
│   ├── packages/page.tsx
│   ├── availability/page.tsx
│   ├── bookings/page.tsx
│   └── messages/page.tsx
└── layout.tsx
```

**Component organization:**
```
components/
├── ui/          # shadcn/ui primitives (Button, Card, Dialog, etc.)
├── forms/       # Domain form components (BookingRequestForm, PackageForm, etc.)
├── layout/      # Header, Footer, Sidebar, DashboardShell
└── vendor/      # VendorCard, VendorProfile, PackageCard, PortfolioGrid, etc.
```

### Backend Architecture — `apps/api/`

**Framework:** Fastify 5 with TypeScript and `fastify-type-provider-zod`.

**Module structure:** Route → Controller → Service → DAO

- **Routes:** Register Fastify route handlers, define Zod schemas for request/response. No business logic.
- **Controllers:** Extract validated params/body/query from request, call service methods, return structured responses. Handle HTTP concerns (status codes, headers).
- **Services:** Business logic, authorization checks, transaction orchestration. Services call DAOs and external integrations (Stripe, R2, email).
- **DAOs:** Data access via Drizzle. One DAO per aggregate root. All queries parameterized. Return typed objects, never raw rows.

**Auth flow (backend):**
1. Fastify plugin extracts Clerk session token from `Authorization` header
2. Verifies token via Clerk's JWKS endpoint (`@clerk/backend`)
3. Resolves `clerk_user_id` → local `users` record
4. If no local user exists (first API call after Clerk signup), creates one via lazy sync
5. Attaches `{ userId, role, vendorId? }` to `request.user`
6. Role guard middleware checks `request.user.role` against route requirements

**Webhook handlers:**
- `POST /webhooks/clerk` — `user.created`, `user.updated`, `user.deleted` events. Creates/syncs local user records. Verifies webhook signature via `svix`.
- `POST /webhooks/stripe` — `payment_intent.succeeded`, `account.updated`, `charge.dispute.created`. Verifies Stripe signature. Handles payment confirmation, onboarding completion, dispute notification.

**Structured errors:**
```typescript
{
  statusCode: number;
  error: string;       // Machine-readable: "NOT_FOUND", "VALIDATION_ERROR", "UNAUTHORIZED"
  message: string;     // Human-readable description
  details?: unknown;   // Validation errors, field-level info
}
```
All errors follow this shape. Never leak internals (stack traces, SQL, file paths).

**Background work:**
No job queue for MVP. Stripe webhooks handle async payment confirmation. Email sending is fire-and-forget with structured error logging on failure (Resend is fast enough for synchronous calls). If email delivery becomes unreliable, add a simple retry table — but don't prematurely build a queue.

### API Client Pattern — `apps/web/lib/api-client.ts`

Typed fetch wrapper with Clerk token injection:

- **Server Components:** Call `auth()` from `@clerk/nextjs/server`, pass token to fetch.
- **Client Components:** Use `useAuth().getToken()` to get session token, include in fetch headers.
- **Error handling:** Parse error responses into typed `ApiError`, surface user-friendly messages.
- **Base URL:** `API_URL` env var (`http://localhost:4000` dev, production URL in prod).

### External Integrations

| Integration | Purpose | SDK/Client | Critical Path? |
|------------|---------|------------|---------------|
| Clerk | Authentication, identity | `@clerk/nextjs`, `@clerk/backend` | Yes — blocks all authed features |
| Stripe Connect | Payments, vendor onboarding, payouts | `stripe` SDK | Yes — blocks payment flow |
| Cloudflare R2 | Image storage (portfolio, profile photos) | `@aws-sdk/client-s3` | Yes — blocks image upload |
| Resend | Transactional email | `resend` SDK | No — graceful degradation |
| Sentry | Error tracking, alerting | `@sentry/nextjs`, `@sentry/node` | No — monitoring only |

### Configuration & Secrets

All configuration arrives as environment variables. No secrets in code, ever.

#### One registry, everything else generated

The variable list was originally maintained by hand in four places — `.env.example`,
the Zod schema in `apps/api/src/config/env.ts`, `globalPassThroughEnv` in
`turbo.json`, and the deployment platform's dashboard. Four hand-maintained copies
of one list drift, and they did: `DATABASE_URL_UNPOOLED` and `NEON_BRANCH` reached
`.env` without ever appearing in the other three.

The fix is a single declarative registry — `packages/shared/src/env/registry.ts` —
that owns the list. Every other representation is derived from it. A registry entry
carries the key, the capability it belongs to, whether it is server-only or exposed
to the browser, a regex describing what a *real* value looks like, the placeholder
that must be rejected, and the human steps to obtain one:

```ts
{
  key: 'STRIPE_SECRET_KEY',
  capability: 'stripe',
  audience: 'server',                              // 'server' | 'browser'
  environments: 'per-environment',                 // value differs dev vs prod
  shape: /^sk_(test|live)_[A-Za-z0-9]{20,}$/,
  placeholder: 'sk_test_...',
  setup: {
    url: 'https://dashboard.stripe.com/test/apikeys',
    steps: [
      'Enable Connect (Express) under Settings → Connect',
      'Copy the test-mode secret key',
    ],
  },
}
```

Derived artifacts, none of them hand-edited:

| Artifact | Derivation | Drift protection |
|----------|-----------|------------------|
| `.env.example` | `pnpm env:example` | Vitest asserts the committed file equals the generated output |
| `globalPassThroughEnv` in `turbo.json` | same generator | same test |
| `apps/api/src/config/env.ts` Zod schema | rows where `audience === 'server'` | compile-time — the schema *is* the registry |
| `apps/web/src/config/env.ts` Zod schema | rows reachable from the browser bundle | same |
| Preflight checks | the whole registry | §8, Environment Gating |

`shape` is what makes the gate meaningful. The original schema validated presence
only — `z.string().min(1)` — so `STRIPE_SECRET_KEY=sk_test_...` passed validation and
failed at the first API call instead of at startup. A shape regex rejects the
placeholder itself.

#### Capabilities

Variables are grouped into capabilities. A capability is the unit that a ticket
declares a dependency on, so a ticket that never touches Stripe is never blocked on
Stripe credentials.

| Capability | Variables | Required by |
|-----------|-----------|-------------|
| `core` | `NODE_ENV`, `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `WEB_URL`, `API_URL`, `NEXT_PUBLIC_API_URL`, `PORT`, `HOST`, `LOG_LEVEL`, `RATE_LIMIT_MAX` | every ticket |
| `auth` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`, the four `NEXT_PUBLIC_CLERK_*_URL` routes | #2 and everything after |
| `storage` | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_PUBLIC_URL`, `S3_FORCE_PATH_STYLE` | #3, #4, #16 |
| `stripe` | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLATFORM_FEE_RATE` | #9, #10 |
| `email` | `RESEND_API_KEY`, `EMAIL_FROM` | #11 |
| `sentry` | `SENTRY_DSN`, `SENTRY_AUTH_TOKEN` (release upload) | #15 |
| `e2e` | `.env.e2e.local` test-account credentials | every ticket — browser verification is mandatory |

The ticket → capability map lives beside the registry in
`packages/shared/src/env/tickets.ts`. It replaces the prose `PREREQ:` notes that
previously sat in the tracker's Notes column, where nothing could enforce them.

#### Values differ per environment

The single flat variable list this plan originally carried implied that development
and production share values. They do not, and the ones that differ are exactly the
ones that fail silently when confused:

| Variable | Development | Production | Consequence of reusing the dev value |
|----------|------------|-----------|--------------------------------------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` | Clerk **development** instance | Clerk **production** instance — a separate instance with its own user pool | Production users authenticate against the dev instance; sessions break on the real domain |
| `CLERK_WEBHOOK_SECRET` | endpoint registered at the tunnel URL | endpoint registered at `https://api.<domain>` | Every production webhook fails signature verification — user rows are never created |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `sk_test_` / `pk_test_` | `sk_live_` / `pk_live_` | Real bookings charge nothing, or test cards are accepted in production |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` ephemeral secret | the production endpoint's own signing secret | Payment confirmations never land; customers are charged with no booking record |
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon `dev` branch | Neon `production` branch | Development writes to live customer data |
| `S3_*` | MinIO or an R2 dev bucket | R2 production bucket + public domain | Production uploads land in a bucket no CDN serves |
| `SENTRY_DSN` | usually unset | production project DSN | Local noise pollutes production error budgets |

Registry entries marked `environments: 'per-environment'` are the rows in this table.
`pnpm preflight --env production` (§8) checks a production value set against the same
shapes before a release, which is what catches a `sk_test_` key configured on the
production platform.

`.env.example` documents every variable with its local value or placeholder. It is
generated, so it can never fall behind the schema again.

### Environments & Release Path

| Environment | Purpose | Database | Auth | Payments | Storage |
|-------------|---------|----------|------|----------|---------|
| Local | Development | Neon `dev` branch | Clerk development instance | Stripe test mode + `stripe listen` | MinIO via `docker compose` |
| Production | Live users | Neon `production` branch | Clerk production instance | Stripe live mode + Connect | Cloudflare R2 + public domain |

No staging environment for MVP.

**Local development runs against a Neon `dev` branch, not the `production` branch.**
Neon branches are copy-on-write and near-free, so the dev branch is a full-fidelity
copy that can be reset at will, and a bad migration or a `seed` run cannot reach live
data. Preflight hard-fails when `NEON_BRANCH` resolves to `production` while
`NODE_ENV=development` — the one guard that cannot be reasoned around.

The `docker compose` Postgres service remains available for fully offline work and is
what the `db` package's PGlite test harness approximates, but it is no longer the
documented default: developing against Neon keeps pooled-connection and SSL behaviour
identical between local and production, which is where connection-level bugs hide.

**Release process:**
1. Feature branch (`feat/<name>`) off `main`
2. `pnpm preflight --ticket <n>` — gate passes before work starts
3. Build, test, and verify locally, including browser verification
4. Push, create PR via `gh pr create`
5. GitHub Actions CI runs: format check, typecheck, lint, build, test
6. Squash-merge to `main`
7. `deploy.yml` runs on `main`, gated on CI: migrations against the **unpooled**
   connection, then Vercel (web) and Railway (api)
8. Post-deploy smoke check against `GET /ready`
---

## 5. Data Model

### Core Tables

```
users
  id                  uuid PK default gen_random_uuid()
  clerk_user_id       varchar(255) unique not null    -- Clerk identity link
  email               varchar(255) unique not null
  role                enum('customer','vendor','admin') not null
  first_name          varchar(100) not null
  last_name           varchar(100) not null
  phone               varchar(20)
  avatar_url          varchar(500)
  stripe_customer_id  varchar(255)                    -- Stripe Customer (for payments)
  bio                 varchar(300)                     -- short intro ("Planning my wedding!")
  city                varchar(100)                     -- customer's city
  state               varchar(100)                     -- customer's state
  budget_tier         enum('budget','mid_range','premium','luxury')  -- helps vendors self-select
  typical_guest_count_min  integer                     -- typical event size range
  typical_guest_count_max  integer
  avg_customer_rating decimal(3,2) default 0           -- derived from vendor→customer reviews
  customer_review_count integer default 0              -- derived, count of vendor→customer reviews
  total_bookings_count integer default 0               -- derived, all bookings
  completed_bookings_count integer default 0           -- derived
  cancelled_bookings_count integer default 0           -- derived
  is_banned           boolean default false            -- admin-set, blocks all API access
  banned_at           timestamp                        -- when the ban was applied
  created_at          timestamp default now()
  updated_at          timestamp default now()

vendor_profiles
  id                  uuid PK default gen_random_uuid()
  user_id             uuid FK(users.id) unique not null
  business_name       varchar(200) not null
  slug                varchar(200) unique not null    -- URL-safe, auto-generated
  bio                 text
  profile_image_url   varchar(500)
  cover_image_url     varchar(500)
  address             varchar(500)
  city                varchar(100)
  state               varchar(100)
  latitude            decimal(10,8)
  longitude           decimal(11,8)
  service_radius_km   integer default 50
  response_time_hours integer
  stripe_account_id   varchar(255)                    -- Stripe Connect Express account
  stripe_onboarded    boolean default false
  is_published        boolean default false            -- vendor controls visibility
  is_deleted          boolean default false            -- soft delete
  avg_rating          decimal(3,2) default 0           -- derived, never directly writable
  review_count        integer default 0                -- derived, never directly writable
  created_at          timestamp default now()
  updated_at          timestamp default now()

categories
  id                  uuid PK default gen_random_uuid()
  name                varchar(100) unique not null
  slug                varchar(100) unique not null
  description         text
  icon                varchar(50)                      -- Lucide icon name
  display_order       integer default 0
  is_active           boolean default true

vendor_categories
  vendor_id           uuid FK(vendor_profiles.id) not null
  category_id         uuid FK(categories.id) not null
  PK(vendor_id, category_id)

portfolio_items
  id                  uuid PK default gen_random_uuid()
  vendor_id           uuid FK(vendor_profiles.id) not null
  image_url           varchar(500) not null
  thumbnail_url       varchar(500)
  caption             varchar(500)
  display_order       integer default 0
  created_at          timestamp default now()

service_packages                                       -- renamed from "packages" to avoid monorepo collision
  id                  uuid PK default gen_random_uuid()
  vendor_id           uuid FK(vendor_profiles.id) not null
  name                varchar(200) not null
  description         text not null
  price_cents         integer not null                 -- stored in cents, always
  price_type          enum('fixed','starting_at','hourly') default 'fixed'
  duration_hours      decimal(4,1)
  max_guests          integer
  inclusions          jsonb                            -- ["4 hours coverage", "100 edited photos", ...]
  is_active           boolean default true
  display_order       integer default 0
  created_at          timestamp default now()
  updated_at          timestamp default now()

availability
  id                  uuid PK default gen_random_uuid()
  vendor_id           uuid FK(vendor_profiles.id) not null
  date                date not null
  status              enum('available','booked','blocked') default 'available'
  note                varchar(500)
  UNIQUE(vendor_id, date)

booking_requests
  id                  uuid PK default gen_random_uuid()
  customer_id         uuid FK(users.id) not null
  vendor_id           uuid FK(vendor_profiles.id) not null
  package_id          uuid FK(service_packages.id)     -- null for custom requests
  event_date          date not null
  event_type          varchar(200)                     -- "Wedding", "Corporate Event", etc.
  event_location      varchar(500)
  guest_count         integer
  custom_details      text                             -- free-text custom request description
  status              enum('pending','quoted','accepted','declined','expired','cancelled') default 'pending'
  quoted_price_cents  integer                          -- vendor's quote for custom requests
  quote_note          text                             -- vendor's message with quote
  final_price_cents   integer                          -- locked price: package price or accepted quote
  expires_at          timestamp                        -- auto-expire pending requests (7 days)
  created_at          timestamp default now()
  updated_at          timestamp default now()

bookings
  id                  uuid PK default gen_random_uuid()
  request_id          uuid FK(booking_requests.id) unique not null
  customer_id         uuid FK(users.id) not null
  vendor_id           uuid FK(vendor_profiles.id) not null
  event_date          date not null
  event_location      varchar(500)
  total_amount_cents  integer not null
  platform_fee_cents  integer not null                 -- commission (12%)
  vendor_payout_cents integer not null                 -- total - platform_fee
  status              enum('confirmed','completed','cancelled','disputed') default 'confirmed'
  stripe_payment_intent_id  varchar(255)
  stripe_transfer_id        varchar(255)               -- vendor payout
  paid_at             timestamp
  completed_at        timestamp
  cancelled_at        timestamp
  cancellation_reason text
  created_at          timestamp default now()
  updated_at          timestamp default now()

conversations
  id                  uuid PK default gen_random_uuid()
  customer_id         uuid FK(users.id) not null
  vendor_id           uuid FK(vendor_profiles.id) not null
  booking_request_id  uuid FK(booking_requests.id)     -- context link, nullable
  last_message_at     timestamp
  created_at          timestamp default now()
  UNIQUE(customer_id, vendor_id)                       -- one conversation per customer-vendor pair

messages
  id                  uuid PK default gen_random_uuid()
  conversation_id     uuid FK(conversations.id) not null
  sender_id           uuid FK(users.id) not null
  content             text not null
  read_at             timestamp
  created_at          timestamp default now()

reviews
  id                  uuid PK default gen_random_uuid()
  booking_id          uuid FK(bookings.id) not null
  reviewer_id         uuid FK(users.id) not null
  vendor_id           uuid FK(vendor_profiles.id) not null  -- denormalized for query perf
  type                enum('customer_to_vendor','vendor_to_customer') not null
  rating              integer not null CHECK(rating >= 1 AND rating <= 5)
  title               varchar(200)
  content             text not null
  is_public           boolean default true             -- vendor→customer reviews are public (visible to other vendors)
  created_at          timestamp default now()
  UNIQUE(booking_id, reviewer_id)                      -- one review per user per booking

tags
  id                  uuid PK default gen_random_uuid()
  name                varchar(100) not null             -- display name ("Korean", "Kosher")
  slug                varchar(100) unique not null      -- category-prefixed, globally unique (e.g. "language-korean", "cultural-korean")
  category            enum('language','cultural','dietary') not null
  display_order       integer default 0
  is_active           boolean default true
  created_at          timestamp default now()
  UNIQUE(category, name)                                -- same name allowed across categories (e.g. "Korean" in both language and cultural)

vendor_tags
  vendor_id           uuid FK(vendor_profiles.id) not null
  tag_id              uuid FK(tags.id) not null
  PK(vendor_id, tag_id)

tag_suggestions
  id                  uuid PK default gen_random_uuid()
  vendor_id           uuid FK(users.id) not null        -- who suggested it
  suggested_name      varchar(100) not null
  category            enum('language','cultural','dietary') not null
  status              enum('pending','approved','rejected') default 'pending'
  resolved_tag_id     uuid FK(tags.id)                  -- set when approved and linked to new/existing tag
  admin_note          varchar(500)                      -- reason for rejection or merge note
  created_at          timestamp default now()
  resolved_at         timestamp

notifications
  id                  uuid PK default gen_random_uuid()
  user_id             uuid FK(users.id) not null
  type                varchar(50) not null             -- 'new_request','new_message','booking_confirmed', etc.
  title               varchar(200) not null
  body                text
  data                jsonb                            -- {bookingId, vendorSlug, conversationId, etc.}
  read_at             timestamp
  created_at          timestamp default now()
```

### Design Decisions in the Data Model

**`final_price_cents` on booking_requests:** Price is locked when the request transitions to ACCEPTED. For package requests, this is the package price at request time. For custom requests, this is the vendor's quote. This prevents race conditions where a vendor changes a package price while a customer is mid-booking.

**`service_packages` table name:** Renamed from `packages` to avoid confusion with the monorepo's `packages/` directory. The Zod schema, types, and API routes all use "package" in the domain language (e.g., `ServicePackage` type, `/vendor/packages` routes).

**Soft delete on `vendor_profiles`:** `is_deleted` flag instead of hard delete. Preserves booking history integrity — completed bookings reference the vendor profile. Active booking requests are auto-cancelled on vendor deletion.

**Derived fields (`avg_rating`, `review_count`):** Updated via a trigger or in the review service after each review insert. Never directly writable by any endpoint. Denormalized for query performance (avoids JOIN + AVG on every vendor list/search query).

**`customization_options` removed from `service_packages`:** The original plan had per-package customization options with price modifiers. This adds significant complexity (dynamic pricing, option validation, UI for option selection). For MVP, vendors describe customization in the package description text, and customers use custom requests for modifications. Can be added post-MVP.

**`request_type` removed from `booking_requests`:** Simplified to: if `package_id` is present, it's a package request; if null, it's a custom request. No need for a separate enum.

### Indexes

```
-- Identity lookups
users(clerk_user_id)                     -- unique, Clerk → local user resolution
vendor_profiles(slug)                    -- unique, URL lookups
vendor_profiles(user_id)                 -- unique, user → vendor profile

-- Search & filtering
vendor_profiles(city, state) WHERE is_published = true AND is_deleted = false  -- location filter
vendor_profiles(is_published, is_deleted)  -- published vendor listing
vendor_categories(category_id)           -- category-based search
vendor_categories(vendor_id)             -- vendor's categories
service_packages(vendor_id, is_active)   -- active packages per vendor

-- Tags
tags(category, name)                     -- unique, same name allowed across categories
tags(slug)                               -- unique, category-prefixed slug for URL lookups

-- Availability
availability(vendor_id, date)            -- unique, availability lookups

-- Booking management
booking_requests(customer_id, status)    -- customer dashboard
booking_requests(vendor_id, status)      -- vendor dashboard
booking_requests(expires_at) WHERE status = 'pending'  -- expiration job
bookings(customer_id)                    -- customer booking history
bookings(vendor_id)                      -- vendor booking history

-- Messaging
conversations(customer_id)              -- customer conversation list
conversations(vendor_id)                -- vendor conversation list
messages(conversation_id, created_at)    -- message history (ordered)

-- Reviews
reviews(vendor_id, type) WHERE type = 'customer_to_vendor'  -- public vendor reviews
reviews(booking_id)                      -- reviews for a booking

-- Notifications
notifications(user_id, read_at)          -- unread count + notification list
```

---

## 6. API Contracts

### Route Map

**Webhooks (no auth — signature verification):**
- `POST /webhooks/clerk` — Clerk user lifecycle events
- `POST /webhooks/stripe` — Stripe payment and account events

**Public (no auth):**
- `GET  /health` — health check (returns `{ status: "ok" }`)
- `GET  /categories` — list active categories
- `GET  /vendors` — search/list published vendors (query params: `category`, `city`, `state`, `minPrice`, `maxPrice`, `date`, `minRating`, `page`, `limit`, `sort`)
- `GET  /vendors/:slug` — vendor public profile (includes packages, portfolio, reviews summary)
- `GET  /vendors/:slug/availability?from=YYYY-MM-DD&to=YYYY-MM-DD` — availability calendar
- `GET  /vendors/:slug/reviews?page=1&limit=10` — paginated public reviews

**Auth: any authenticated user:**
- `GET  /users/me` — current user profile + vendor profile if vendor role
- `PUT  /users/me` — update basic user info (name, phone, avatar)
- `GET  /conversations` — list own conversations
- `GET  /conversations/:id/messages?page=1&limit=50` — paginated messages
- `POST /conversations/:id/messages` — send message
- `GET  /conversations/sse` — SSE stream for real-time updates
- `GET  /notifications?page=1&limit=20` — list own notifications
- `PUT  /notifications/:id/read` — mark notification as read
- `PUT  /notifications/read-all` — mark all notifications as read

**Auth: vendor role:**
- `POST   /vendor/profile` — create vendor profile (first-time setup)
- `PUT    /vendor/profile` — update vendor profile
- `POST   /vendor/portfolio` — upload portfolio image
- `DELETE /vendor/portfolio/:id` — remove portfolio image
- `PUT    /vendor/portfolio/reorder` — reorder portfolio items
- `GET    /vendor/packages` — list own packages
- `POST   /vendor/packages` — create package
- `PUT    /vendor/packages/:id` — update package
- `DELETE /vendor/packages/:id` — soft-deactivate package
- `GET    /vendor/availability?from=YYYY-MM-DD&to=YYYY-MM-DD` — own availability
- `PUT    /vendor/availability` — bulk update availability dates (body: `[{date, status, note}]`)
- `GET    /vendor/bookings?status=pending,quoted,accepted` — list booking requests + bookings
- `PUT    /vendor/bookings/:id/quote` — send quote for custom request (body: `{priceCents, note}`)
- `PUT    /vendor/bookings/:id/accept` — accept booking request
- `PUT    /vendor/bookings/:id/decline` — decline booking request (body: `{reason?}`)
- `PUT    /vendor/bookings/:id/complete` — mark booking as completed (triggers payout)
- `POST   /vendor/stripe/connect` — initiate Stripe Connect onboarding → returns redirect URL
- `GET    /vendor/stripe/status` — check Stripe account status

**Auth: customer role:**
- `GET  /customer/bookings?status=pending,confirmed` — list own requests + bookings
- `POST /customer/bookings/request` — create booking request
- `PUT  /customer/bookings/:id/accept-quote` — accept vendor's quote
- `PUT  /customer/bookings/:id/cancel` — cancel request or booking
- `POST /customer/bookings/:id/pay` — create Stripe PaymentIntent → returns client secret

**Auth: either role (with booking ownership validation):**
- `POST /reviews` — create review (only if booking completed, reviewer was party to booking)
- `GET  /reviews/booking/:bookingId` — get reviews for a specific booking

**Auth: any role:**
- `POST /upload/image` — upload image to R2 → returns `{url, thumbnailUrl}`

**Auth: admin role:**
- `GET    /admin/dashboard` — platform metrics (revenue, booking volume, user/vendor counts, signups over time)
- `GET    /admin/vendors` — list all vendors (filters: status, category, city, search query, page/limit)
- `GET    /admin/vendors/:id` — vendor detail (profile + bookings + revenue + reviews)
- `PUT    /admin/vendors/:id/publish` — toggle vendor publish status
- `GET    /admin/users` — list all users (filters: role, banned status, search, page/limit)
- `PUT    /admin/users/:id/ban` — ban/unban user (sets `is_banned`, cancels active bookings if vendor)
- `GET    /admin/bookings` — list all bookings (filters: status, date range, vendor, customer, page/limit)
- `GET    /admin/bookings/:id` — booking detail with full payment info (Stripe IDs, amounts, timeline)
- `GET    /admin/reviews` — list all reviews (filters: rating, flagged, vendor, page/limit)
- `DELETE /admin/reviews/:id` — delete review + recalculate vendor avg_rating/review_count
- `GET    /admin/categories` — list all categories (including inactive)
- `POST   /admin/categories` — create category
- `PUT    /admin/categories/:id` — update category (name, slug, description, icon, display_order, is_active)
- `DELETE /admin/categories/:id` — deactivate category (soft — preserves vendor associations)

### Response Conventions

- `POST` that creates → `201` + `Location` header + created object
- `POST` action (e.g., send message) → `200` + result
- `PUT/PATCH` update → `200` + updated object
- `DELETE` → `204` no content
- All list endpoints → `{ data: T[], pagination: { page, limit, total, totalPages } }`
- All error responses → `{ statusCode, error, message, details? }`

### Booking & Payment Flow

```
1. CUSTOMER selects vendor package (or submits custom request)
   → POST /customer/bookings/request
   → Validates: vendor is published, date is available, package is active (if package request)
   → Creates booking_request (status: PENDING, final_price_cents set for package requests)
   → Creates/reuses conversation
   → Sends notification to vendor
   → Sends email to vendor

2. VENDOR reviews request
   a) Package request → can accept directly (price already locked in final_price_cents)
      → PUT /vendor/bookings/:id/accept → status: ACCEPTED
   b) Custom request → vendor sends quote
      → PUT /vendor/bookings/:id/quote → status: QUOTED, quoted_price_cents set
   c) Decline → PUT /vendor/bookings/:id/decline → status: DECLINED
   → Notification + email to customer

3. CUSTOMER accepts quote (if custom)
   → PUT /customer/bookings/:id/accept-quote
   → status: ACCEPTED, final_price_cents = quoted_price_cents

4. CUSTOMER pays (request must be ACCEPTED)
   → POST /customer/bookings/:id/pay
   → Validates: vendor is Stripe-onboarded, request is ACCEPTED, date still available
   → Creates Stripe PaymentIntent (amount = final_price_cents)
   → Returns clientSecret for Stripe.js to collect payment
   → On payment_intent.succeeded webhook:
     → Creates booking record (status: CONFIRMED) in DB transaction:
       - booking row created
       - booking_request status → ACCEPTED (already is, but confirmed)
       - availability date → BOOKED
       - platform_fee and vendor_payout calculated
     → Sends confirmation email + notification to both parties

5. EVENT occurs (out-of-band)
   → Vendor marks complete: PUT /vendor/bookings/:id/complete
   → In DB transaction:
     - booking status → COMPLETED
     - Stripe Transfer to vendor's Connect account (vendor_payout_cents)
   → Both parties can now leave reviews
   → Sends email + notification

6. REVIEWS (only when booking.status === COMPLETED)
   → POST /reviews
   → Validates: reviewer is party to booking, booking is COMPLETED, no existing review
   → Creates review
   → Updates vendor_profiles.avg_rating and review_count
```

### Commission Calculation

```
PLATFORM_FEE_RATE = 0.12  // 12%, configurable via env var

total_amount = final_price_cents (from booking_request)
platform_fee = Math.round(total_amount * PLATFORM_FEE_RATE)
vendor_payout = total_amount - platform_fee

// Stripe processing fee (~2.9% + 30c) is absorbed by the platform from the commission.
// At 12% commission on a $500 booking:
//   platform_fee = $60, stripe_fee ≈ $14.80, net platform revenue ≈ $45.20
// This works as long as the booking amount is > ~$11 (break-even point).
// Enforce minimum booking amount of $25 to maintain margin.
```

---

## 7. Authorization Matrix

### Role-Based Access

| Resource | Customer | Vendor (own data) | Vendor (other's data) | Admin |
|----------|----------|-------------------|----------------------|-------|
| Own user profile | Read, Update | Read, Update | — | Read, Update |
| Vendor profile (published) | Read | Read, Update | Read | Read, Update |
| Vendor profile (unpublished) | — | Read, Update | — | Read |
| Service packages (active) | Read | CRUD | Read | CRUD |
| Service packages (inactive) | — | Read, Update | — | Read |
| Portfolio | Read | CRUD | Read | CRUD |
| Availability (published vendor) | Read | CRUD | Read | Read |
| Availability (unpublished vendor) | — | CRUD | — | Read |
| Booking requests (own) | Read, Create, Cancel | Read, Quote, Accept, Decline | — | Read |
| Booking requests (other's) | — | — | — | Read |
| Bookings (own) | Read, Pay, Cancel | Read, Complete | — | Read |
| Conversations (own) | Read, Send | Read, Send | — | Read |
| Messages (own conversation) | Read | Read | — | Read |
| Reviews (create) | Own completed booking | Own completed booking | — | — |
| Reviews (read) | All public | All public + received | All public | All |
| Reviews (delete) | — | — | — | Delete |
| Notifications (own) | Read, Mark read | Read, Mark read | — | — |
| Stripe Connect | — | Own account only | — | — |
| Payment | Own booking only | — | — | Read |
| Image upload | Yes | Yes | — | — |

### Authorization Rules (Enforced in Service Layer)

1. **Conversation access:** A user can only read/send messages in conversations where they are either the `customer_id` or the vendor's `user_id`. Conversations are auto-created only via booking request flow — no arbitrary messaging.

2. **Vendor isolation:** A vendor cannot see another vendor's bookings, revenue, customer details from other bookings, or unpublished profile. Every vendor-scoped DAO query includes `WHERE vendor_id = :currentVendorId`.

3. **Review eligibility:** A user can only create a review for a booking where (a) they are `customer_id` or the vendor's `user_id`, (b) `booking.status = 'completed'`, and (c) no existing review by this user for this booking exists (`UNIQUE(booking_id, reviewer_id)`).

4. **Stripe onboarding gate:** Vendor cannot accept booking requests (transition to ACCEPTED) unless `vendor_profiles.stripe_onboarded = true`. Enforced in the booking service, not just the UI.

5. **Payment authorization:** Only the booking request's `customer_id` can create a PaymentIntent for that request. Enforced in the booking service.

6. **Derived field protection:** `avg_rating` and `review_count` on `vendor_profiles` are never directly writable via any API endpoint. Updated only by the review service after review creation.

7. **Soft delete cascading:** When a vendor soft-deletes their profile: `is_published = false`, `is_deleted = true`, all PENDING/QUOTED booking requests auto-cancelled with notification to customers. CONFIRMED bookings remain active (vendor must complete or cancel them first). Vendor cannot delete profile with CONFIRMED bookings.

8. **Booking state transitions (enforced):**
   - PENDING → QUOTED (vendor, custom request only)
   - PENDING → ACCEPTED (vendor, package request only)
   - PENDING → DECLINED (vendor)
   - PENDING → CANCELLED (customer)
   - PENDING → EXPIRED (system, on expiry check)
   - QUOTED → ACCEPTED (customer accepts quote)
   - QUOTED → CANCELLED (customer)
   - QUOTED → DECLINED (vendor, withdraw quote)
   - ACCEPTED → CONFIRMED (system, on payment success)
   - CONFIRMED → COMPLETED (vendor)
   - CONFIRMED → CANCELLED (either party, with cancellation policy)
   - No other transitions are valid. Service layer rejects invalid transitions.

9. **Request expiry:** Booking requests in PENDING status for > 7 days auto-expire. Checked on access (lazy) or via scheduled job.

---

## 8. Security & Operations

### Security

**Authentication:** Clerk handles identity. All API endpoints except public routes and webhook handlers require a valid Clerk session token. Token verification uses Clerk's JWKS endpoint — no shared secret for token validation.

**Authorization:** Role-based access with resource ownership checks (see Authorization Matrix). All ownership checks happen in the service layer, not middleware — middleware only checks role.

**Input validation:** Every request body, query param, and path param validated via Zod schemas at the route level (Fastify type provider). No unvalidated input reaches the service layer.

**SQL injection:** Impossible via Drizzle ORM (parameterized queries). No raw SQL interpolation. Any future raw SQL must use parameterized placeholders only.

**XSS:** React's default escaping handles output. No `dangerouslySetInnerHTML` or user-content injection. User-submitted text (bios, reviews, messages) stored and rendered as plain text, never HTML.

**CSRF:** Clerk's session management handles CSRF protection via `__clerk_db_jwt` cookie attributes (SameSite, httpOnly, Secure).

**Rate limiting:** `@fastify/rate-limit` on all routes. Stricter limits on auth-related and payment endpoints.

**File upload security:**
- Validate MIME type (image/* only) and file size (max 10MB) server-side
- Process with Sharp (strip EXIF metadata, resize, convert to WebP)
- Upload processed image to R2, never serve user-uploaded files directly from the server
- Generate unique filenames (UUID-based), never use user-provided filenames

**Webhook security:** Clerk webhooks verified via `svix` signature. Stripe webhooks verified via `stripe.webhooks.constructEvent`. Both reject unverified payloads.

**Secrets:** All secrets in environment variables, declared once in the env registry (§4). No secrets in code, logs, or error responses. `.env` is gitignored, `.env.example` is generated and contains placeholders only, and `gitleaks` scans every push (§9).

### Operations

**Logging:**
- Pino (built into Fastify) for structured JSON logging to stdout
- Log format: `{ level, time, msg, reqId, userId, ...context }`
- Log levels: `error` (failures), `warn` (anomalies), `info` (request/response, key business events), `debug` (development only)
- Never log: secrets, tokens, passwords, PII, full request/response bodies, SQL values
- Do log: user IDs, operation names, status codes, durations, error codes

**Error tracking:**
- Sentry for both frontend (`@sentry/nextjs`) and backend (`@sentry/node`)
- Capture unhandled exceptions and rejected promises
- Attach user context (userId, role) to Sentry events
- Payment-related errors get highest severity
- Alert on: error rate spike, payment failures, webhook delivery failures

**Health & readiness probes:**

Two endpoints, because a platform probe needs to distinguish "the process is wedged,
restart it" from "the process is fine, its dependencies are not":

- `GET /health` — **liveness**. Returns `200 { status, timestamp }` with no I/O. Only
  fails when the event loop is dead. Restarting on this signal is correct.
- `GET /ready` — **readiness**. Round-trips the database *and* object storage, and
  reports each dependency separately: `{ status, database, storage, timestamp }`.
  Answers `503` when a dependency is down so the platform withholds traffic instead
  of routing into failing requests, and so the post-deploy smoke check has one
  authoritative endpoint to poll.

Neither requires auth. Railway probes `/health` for restarts and `/ready` for traffic
admission; the deploy workflow's smoke check polls `/ready`.

**Environment gating (`pnpm preflight`):**

Missing or placeholder configuration is the most common way a local build fails
confusingly: the failure surfaces deep inside a feature, as a 500 or an SDK error,
long after the real cause. Preflight moves that failure to the start of the ticket
and names the fix.

`pnpm preflight [--ticket <n>] [--env production]` resolves a ticket to its declared
capabilities (§4) and checks only those, so a ticket that never touches Stripe is
never blocked on Stripe credentials:

| # | Check | Hard-fails when |
|---|-------|-----------------|
| 1 | Toolchain | Node < 20, pnpm does not match `packageManager`, Docker not running *and* a required capability needs a compose service |
| 2 | Environment | A variable for a required capability is absent, still equal to its placeholder, or fails its `shape` regex |
| 3 | Database — safety | `NEON_BRANCH` resolves to `production` while `NODE_ENV=development` |
| 4 | Database — reachability | The pooled URL will not connect |
| 5 | Database — migrations | `drizzle/meta/_journal.json` contains entries absent from the `__drizzle_migrations` table |
| 6 | Database — seed | Reference data (categories, tags) is missing |
| 7 | Object storage | The bucket does not exist or is not readable |
| 8 | Webhook forwarding | A capability with inbound webhooks is required and its forwarding CLI is not installed |
| 9 | Browser verification | Playwright browsers not installed, or `.env.e2e.local` absent |
| 10 | Ports | 3000 or 4000 held by a foreign process |

Every failure prints the literal command or URL that fixes it, drawn from the
registry's `setup` field — `Run: docker compose up -d`, or
`Create a key at https://resend.com/api-keys, then set RESEND_API_KEY in .env`. The
command exits non-zero, so it composes into any gate.

`--env production` runs checks 1, 2, and 7 against a production value set, which is
what catches a `sk_test_` key configured on the production platform before a release
rather than after one.

**Where the gate fires:** the ticket workflow. `/ticket` and `/next-ticket` run
`pnpm preflight --ticket <n>` and refuse to move a ticket to `In Progress` until it
passes. A local `pnpm dev` is deliberately *not* gated — feature-scoped checks cannot
know which code path a dev server will reach, and a dev server that refuses to start
over a credential the current work never touches trains you to bypass the gate.

Two protections ride along in CI rather than locally, because that is where they
belong: the generated-artifact drift test (§4) runs in the normal suite, and secret
scanning runs on push, since a leaked credential is the one failure that cannot be
undone locally.


**Backup & recovery:**
- Neon provides automatic daily backups with point-in-time recovery (7-day retention on free tier)
- Drizzle migrations are versioned SQL files in git — schema is always reproducible
- R2 has no automatic backup — accept risk for MVP; portfolio images are replaceable
- Recovery runbook: restore Neon backup → apply any missing migrations → verify data integrity

**Monitoring (MVP):**
- Sentry alerts for errors (email notification)
- Railway/Render dashboard for container metrics (CPU, memory, restarts)
- Stripe Dashboard for payment monitoring
- Manual health check after each deploy

---

## 9. Testing & Delivery

### Testing Strategy

**Unit tests (Vitest):**
- Service layer: business logic, state transitions, authorization checks, edge cases
- DAO layer: query correctness (test against a real Postgres engine, not mocks)
- Shared package: Zod schema validation, utility functions
- Coverage target: services and DAOs at 80%+, shared at 90%+

**Integration tests (Supertest + Vitest):**
- API routes end-to-end: request → validation → service → DAO → response
- Auth middleware: valid token, invalid token, missing token, wrong role
- Booking state machine: valid and invalid transitions
- Payment flow: mock Stripe SDK, verify correct API calls and DB state
- Test against a real Postgres engine via `@vendor-marketplace/db/testing`, which boots PGlite
  in-process — a real engine, no Docker required, no mocks

**Frontend tests (React Testing Library + Vitest):**
- Component rendering with expected props
- Form validation (submit with invalid data, verify error messages)
- User interactions (click buttons, fill forms, verify API calls)
- Mock API calls at the fetch level (MSW or manual mocks)

**End-to-end tests (Playwright):**
- Critical user journeys: discovery, onboarding, booking, payment, messaging, reviews, admin
- Run headless in CI, headed locally for debugging
- Use seeded demo dataset — deterministic, not dependent on manual setup
- Playwright tests validate real browser behavior: navigation, form submission, Stripe Elements, SSE
- All E2E tests added in ticket #14 after all features are built

**What NOT to test:**
- Clerk's authentication internals (tested by Clerk)
- Stripe's payment processing (tested by Stripe, verified via webhook handling)
- shadcn/ui component internals
- Simple pass-through components with no logic

**Test conventions:**
- Tests co-located with source: `foo.ts` → `foo.test.ts` (or `__tests__/foo.test.ts` for larger modules)
- Every code change ships with tests in the same commit
- A bug fix includes a test that fails before and passes after the fix
- No `.skip`, `.only`, `xit`, `xdescribe` in committed tests
- No `console.*` in tests — use the test framework's output
- Deterministic: no real clock, network, random, or order-dependence
- E2E tests use Playwright's `waitFor`/`waitForResponse` — never fixed `sleep` delays

### CI/CD Pipeline (GitHub Actions)

**`ci.yml` — verification, on every PR and push to `main`.**

The suites boot an in-process Postgres (PGlite) through `@vendor-marketplace/db/testing`, so
CI needs no service container. It does need syntactically valid placeholder values
for the variables consumed at build time — `next build` instantiates `ClerkProvider`,
which refuses to load without a well-formed publishable key — but CI never reaches a
third-party server.

```
format:check → typecheck → lint → build → test
```

Two checks are added to this workflow:

- **Generated-artifact drift.** The `.env.example` and `turbo.json` drift test (§4)
  runs inside `pnpm test`, so a registry change that skips the generator fails CI
  rather than reaching a developer's machine as a confusing missing variable.
- **Secret scanning.** `gitleaks` runs on every push. `.env` is gitignored, but
  gitignore protects only against the accident it anticipates; a credential pasted
  into a test fixture, a migration, or a commit message is not covered. This is the
  one failure that cannot be repaired locally — once pushed, the credential must be
  rotated — so it is gated where the irreversible step happens.

E2E tests are added to this workflow in ticket #14, once a seeded demo dataset exists
to run them against.

**`deploy.yml` — release, on push to `main`, gated on `ci.yml` succeeding.**

```
migrate (unpooled) → deploy api (Railway) → deploy web (Vercel) → smoke check /ready
```

Three details matter:

1. **Migrations run against `DATABASE_URL_UNPOOLED`.** Neon's pooled endpoint is
   PgBouncer in transaction mode, which does not hold session state across
   statements. Drizzle's migrator takes a session-level advisory lock and issues DDL
   — both need a session-pinned connection. Running migrations through the pooled URL
   works often enough to look correct and fails non-deterministically under
   concurrency, which is the worst failure mode available. `drizzle.config.ts` and
   `src/scripts/migrate.ts` currently read `DATABASE_URL`; ticket #18 changes both to
   prefer the unpooled URL and fall back only when it is absent.
2. **Migrations precede both deploys.** The schema must be ahead of the code that
   reads it. This makes every migration necessarily backwards-compatible with the
   currently-running release — additive columns, no destructive renames in a single
   step — which is the constraint that makes zero-downtime deploys possible at all.
3. **The smoke check polls `GET /ready`, not `GET /health`.** Liveness passes while
   the database is unreachable; readiness is the endpoint that would actually catch a
   broken connection string.

Migrations are no longer run manually before deploy. A manual step that must happen
between merge and deploy is a step that will eventually be skipped.

### Pre-Commit Gate (per CLAUDE.md section 12)

Before every commit, Claude Code runs:
1. `git diff --staged` — review each hunk, justify its presence
2. `git diff --staged --stat` — verify proportionality
3. `pnpm build` — zero errors
4. `pnpm typecheck` (via `tsc --noEmit`) — zero errors in changed files
5. `pnpm lint` — zero errors in changed files
6. `pnpm test` — suite green, new tests execute
7. Sweep: no `any`, subscriptions cleaned up, no `console.*`, no deprecated APIs, no duplicates, dead code removed, no secrets in diff

### Delivery Workflow

Per ticket:
1. **Gate:** `pnpm preflight --ticket <n>` — passes before the ticket moves to
   `In Progress`. Every prerequisite the ticket declares is present and real.
2. **Branch:** `feat/<ticket-slug>` from `main`
3. **Build:** Implement in dependency order (schema → shared → API → frontend)
4. **Test:** Tests alongside code, same commit
5. **Verify:** Pre-commit gate + browser verification of the ticket's flow (Playwright)
6. **Commit:** Conventional commit, atomic
7. **Push + PR:** `gh pr create --fill`
8. **CI:** `ci.yml` runs format/typecheck/lint/build/test, drift, and secret scanning
9. **Merge:** Squash-merge to `main`, delete branch
10. **Deploy:** `deploy.yml` migrates and deploys; smoke check polls `GET /ready`
---

## 10. Milestones

Each milestone produces a demonstrable product state. Milestones are organized by user capability — all user-facing functionality ships first, operational/admin features follow. Every milestone includes API + frontend + tests. The entire build, test, and verification process is 100% agentic via Claude Code.

### Phase 0: Repository Setup

#### M0: Repo Init (Day 0)

**Demonstrable state:** Empty monorepo created at `~/Documents/vendor-marketplace`, initialized with git, linked to GitHub remote, initial commit pushed.

**Tickets:** #0

### Phase 1: Complete User Loop

**Goal:** A real user can sign up, build a vendor profile, be discovered, get booked, get paid, and communicate — the full marketplace loop.

#### M1: Foundation (Days 1-3)

**Demonstrable state:** App runs. Users can sign up as customer or vendor and see role-appropriate dashboard shells. Monorepo builds, database migrates, CI passes.

**Tickets:** #1, #2

#### M1.5: Environment Contract (Day 3)

**Demonstrable state:** `pnpm preflight --ticket 4` prints a per-capability checklist
and exits non-zero with the exact fix command when anything is missing, placeholder,
or malformed. `.env.example` and `turbo.json`'s passthrough list are generated from
one registry and a test fails if either drifts. Local development runs against a Neon
`dev` branch, and preflight refuses to run against `production`.

**Tickets:** #17

This milestone sits ahead of the remaining M2 work deliberately. It gates every
ticket after it, so each feature ticket built before it is one more that skipped the
gate — and #3 already shipped needing object storage that nothing had flagged.

#### M2: Vendor Profile (Days 4-8)

**Demonstrable state:** A vendor can build a complete, published profile with packages, portfolio, and availability calendar. The profile is viewable at a public URL.

**Tickets:** #3, #4, #16  *(#5 Availability merged into #4)*

#### M3: Discovery (Days 9-11)

**Demonstrable state:** A customer can search for vendors by category, location, and price. Browse vendor profiles with packages, portfolio, availability. Landing page showcases categories.

**Tickets:** #6a, #6b, #6c  *(#6 was split)*

#### M4: Transaction Loop (Days 12-20)

**Demonstrable state:** Complete booking lifecycle works end-to-end: customer discovers vendor → requests booking → vendor accepts/quotes → customer pays → event completes → payout to vendor. Messaging between parties.

**Tickets:** #9, #7, #10, #8 (Stripe Connect first since it unblocks payment; messaging after payment since the booking loop is the critical path)

#### M4.5: Production Launch (Days 21-23)

**Demonstrable state:** The marketplace is live on a real domain. A customer can sign
up, discover a vendor, and complete a booking request in production. Merging to `main`
migrates and deploys automatically, and a failed readiness probe stops the release.

**Tickets:** #18, #19, #20

**Why here and not at the end.** The instinct is to deploy once everything is built.
That concentrates every unknown — Clerk production instance behaviour, CORS between
two origins on real domains, R2 public URLs, webhook endpoints that must be
re-registered against production URLs, cold-start behaviour on Railway — into a single
session, at the point in the project where the surface area is largest and the
remaining schedule is smallest. Deploying immediately after M4 means the first
production deploy carries a thin, well-understood product, and every ticket after it
gets continuously delivered rather than accumulating into one release. The reviews,
email, notification, and admin work in M5 and M6 then ships to a running system.

### Phase 2: Trust Layer

**Goal:** Post-transaction trust signals that make the marketplace self-reinforcing.

#### M5: Reviews (Days 24-26)

**Demonstrable state:** After a completed booking, both parties can leave reviews. Customer reviews are public on vendor profiles with star ratings and distribution chart. Vendor ratings aggregate correctly.

**Tickets:** #12

### Phase 3: Operations, Admin & Launch Readiness

**Goal:** Operational infrastructure, admin control plane, demo dataset for stress testing, and production hardening. None of this blocks user-facing functionality — it makes the platform operable.

#### M6: Operations & Admin (Days 27-31)

**Demonstrable state:** Email notifications fire for all booking events. In-app notification center with unread badge. Admin portal for platform oversight. Fully populated demo dataset for stress testing. Sentry error tracking across FE + BE.

**Tickets:** #11, #14, #15  *(#13 Notification Center merged into #8)*

---

## 11. Feature-Sized Backlog

**The backlog lives in `.claude/plans/vendor-marketplace-tickets.md`.** Its Status Board
is the queue and its Ticket Details are the executable specification.

A full copy of the ticket specifications previously lived here and drifted badly — the
same failure, and the same remedy, as the duplicate status table recorded under
*Ticket Tracker* below. By the time it was removed on 2026-08-27 it:

- still defined **#5 Availability Management** and **#13 Notification Center** as
  `Backlog` tickets, months after #5 was merged into **#4** and #13 into **#8**;
- still described availability as unbuilt, when it had shipped and been re-verified sound;
- defined **#6** as one ticket after it had been split into **#6a / #6b / #6c**;
- predated the Orla design import entirely, so not one of its specs carried a frame, a
  parity gate, or the states vocabulary in `design/design-plan/40-states.md`;
- omitted twelve real tickets — **#16, #21, #22a, #22b, #23, #24, #25, #26, #28, #29,
  #30, #31**.

Two copies of a mutable specification is the same failure as two copies of the status
table, and it is resolved the same way: one owner, no copies. The durable design context
those tickets were written against is not lost — it lives in §4 Architecture, §5 Data
Model, §6 API Contracts, §7 Authorization Matrix and §8 Security & Operations above,
which remain the plan's own material.

---

## 12. Risks & Open Decisions

### High-Risk Areas

**1. Stripe Connect onboarding drop-off**
- *Risk:* Stripe's KYC process is multi-step and vendors may abandon mid-flow.
- *Mitigation:* Use Express accounts (simplest onboarding). Show clear progress indicators. Allow incomplete onboarding — vendor can browse/build profile but can't accept bookings until complete. Persistent dashboard banner reminding them to finish.
- *Monitoring:* Track vendors with `stripe_account_id` set but `stripe_onboarded = false` — if high ratio, investigate UX friction.

**2. Payment → booking atomicity**
- *Risk:* Payment succeeds at Stripe but DB transaction fails → customer charged but no booking record.
- *Mitigation:* Webhook-based confirmation (not frontend redirect). DB transaction for booking creation + availability update. If transaction fails, log PaymentIntent ID to Sentry for manual reconciliation. Idempotent webhook handler (re-processing same webhook is safe).
- *Monitoring:* Sentry alert on any booking creation failure after payment success.

**3. Concurrent booking for same date**
- *Risk:* Two customers book the same vendor for the same date simultaneously.
- *Mitigation:* Availability update is inside the DB transaction triggered by payment webhook. The `UNIQUE(vendor_id, date)` constraint on availability table + `status = 'booked'` check in the transaction prevents double-booking. Second transaction fails → automatic refund → customer notified.
- *Verification:* Integration test with simulated concurrent webhooks.

**4. Image processing blocking event loop**
- *Risk:* Sharp image resize/optimization is CPU-intensive. Processing large images in the Fastify request handler could block other requests.
- *Mitigation:* For MVP scale (50-200 vendors, infrequent uploads), synchronous processing is acceptable. If latency becomes an issue: move to `worker_threads` or a separate image processing endpoint. Max file size (10MB) limits worst-case processing time.
- *Monitoring:* Track upload endpoint response times in Sentry.

**5. SSE connection management**
- *Risk:* Each connected user holds an open SSE connection. At MVP scale this is fine, but hundreds of connections could exhaust Railway's connection limits.
- *Mitigation:* SSE connections timeout after 30 minutes with client reconnection. Railway's free tier supports sufficient concurrent connections for MVP. If scaling needed: switch to WebSocket with connection pooling, or use a managed service (Pusher/Ably).

**6. Vendor account deletion with active bookings**
- *Risk:* Vendor deletes their account while bookings are in flight.
- *Mitigation:* Soft delete. Cannot delete with CONFIRMED bookings (must complete or cancel them first). PENDING/QUOTED requests auto-cancelled. Completed bookings and reviews remain for history.

**7. Development and production credential divergence**
- *Risk:* Every Clerk key, Stripe key, and webhook signing secret differs between the
  development and production instances (§4). Reusing a development value in production
  fails silently rather than loudly: production webhooks fail signature verification, so
  user rows are never created and payments never confirm, while the UI shows no error.
- *Mitigation:* The env registry marks these rows `per-environment`, and
  `pnpm preflight --env production` validates a production value set against the same
  shape regexes before release — a `sk_test_` key configured on the production platform
  fails the gate. Ticket #19 provisions each one explicitly rather than by copying.
- *Monitoring:* Sentry alert on any webhook handler returning a signature-verification
  failure; the rate should be zero, so any occurrence is actionable.

**8. Migrations executed through the connection pooler**
- *Risk:* Neon's `DATABASE_URL` is PgBouncer in transaction mode. Drizzle's migrator
  takes a session-level advisory lock and issues DDL, neither of which survives a pooler
  that does not pin sessions. It succeeds often enough to appear correct and fails
  non-deterministically under concurrency — the hardest failure mode to diagnose.
- *Mitigation:* Ticket #18 changes `drizzle.config.ts` and `src/scripts/migrate.ts` to
  prefer `DATABASE_URL_UNPOOLED`; the deploy workflow supplies only the unpooled URL to
  the migration step.
- *Verification:* A migration run against a pooled URL should fail loudly, not silently
  — assert the config selects the unpooled URL when both are present.

**9. Development against live customer data**
- *Risk:* Local `.env` pointed at the Neon `production` branch, so any `db:migrate`,
  `db:seed`, or exploratory query ran against live data. Neon's point-in-time recovery
  bounds the damage but does not prevent it.
- *Mitigation:* Local development moves to a Neon `dev` branch (#17). Preflight
  hard-fails when `NEON_BRANCH` resolves to `production` while `NODE_ENV=development`,
  and this check has no opt-out flag — a bypassable guard against an irreversible action
  is not a guard.

**10. Placeholder credentials passing validation**
- *Risk:* Presence-only validation (`z.string().min(1)`) accepts a placeholder such as
  `sk_test_...`, deferring the failure to the first API call inside a feature, where it
  surfaces as an opaque SDK error far from its cause.
- *Mitigation:* Per-variable `shape` regexes in the env registry (#17) reject the
  placeholder at the gate and print the setup URL and steps needed to obtain a real one.

**11. Big-bang first deployment**
- *Risk:* Deploying only after all features are built concentrates every deployment
  unknown — Clerk production behaviour, cross-origin requests between real domains, R2
  public URLs, webhook re-registration, container cold starts — into one session, at
  maximum surface area and minimum remaining schedule.
- *Mitigation:* M4.5 deploys immediately after the booking loop works (#18–#20), so the
  first production release carries a thin, well-understood product and everything after
  it ships continuously.

### Deferred Decisions

Recorded rather than resolved. None blocks launch; each is cheap to add once the
pipeline exists.

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| D6 | Rollback automation | Deferred to post-launch | Vercel and Railway both support one-click rollback from their dashboards. Automating it in `deploy.yml` requires a failure signal worth trusting — the `/ready` smoke check is that signal, so revisit once it has a track record. |
| D7 | Preview environments | Deferred to post-launch | Vercel gives preview deploys for `apps/web` free; the value only arrives when `apps/api` and a Neon branch are provisioned per-PR too. Worth doing when more than one person is contributing. |
| D8 | Migration rollback strategy | Deferred | Forward-only migrations with backwards-compatible steps (§9) make rollback rarely necessary. Neon PITR is the recovery path until it is not enough. |

### Resolved Decisions

All open decisions have been resolved. Full rationale in `.claude/plans/vendor-marketplace-decisions.md`.

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Stripe processing fee | Absorb from 12% commission. Customer sees one clean price. |
| D2 | Minimum booking amount | $25 minimum (`price_cents >= 2500`). |
| D3 | Cancellation policy | Fixed: 100% refund >48h, 50% <48h. Not vendor-configurable. |
| D4 | Vendor-as-customer dual role | Single role per account. Vendor creates second account to book. |
| D5 | Review moderation | Basic profanity filter (`bad-words`/`leo-profanity`). Reject flagged reviews with 422. |

---

## Ticket Tracker

**The tracker lives in `.claude/plans/vendor-marketplace-tickets.md`.** It is the
single source of truth for ticket status, branch, blocking relationships, and
executable specification.

A duplicate status table previously lived here and drifted — it still listed tickets
#1, #2, and #3 as `Backlog` after all three had shipped. Two copies of a mutable status
table is the same failure as four copies of the environment variable list, and it is
resolved the same way: one owner, no copies.

Push the completed backlog to Linear as a historical record after MVP ships.

---

## Claude Code Orchestration Strategy

### Agent Setup (`~/.claude/agents/`)

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `explore` | haiku | Read, Grep, Glob | Codebase discovery, dependency checks. Keeps main context clean. |
| `implementer` | sonnet | All | Feature implementation. Workhorse agent. |
| `test-author` | sonnet | All | Writes tests. Separate mindset from implementer. |
| `reviewer` | sonnet | Read, Grep, Glob, Bash (read-only) | Runs pre-commit sweeps. No edit tools = sharper feedback. |
| `architect` | opus | Read, Grep, Glob | Design passes, complex debugging. Read-only, expensive, use sparingly. |

### Build Loop (per ticket)

The entire build, test, demo, and verification process is 100% agentic via Claude Code. No manual human coding, no manual browser testing — everything is automated.

0. **Gate** — `pnpm preflight --ticket <n>`; every declared prerequisite is present and real before any work begins
1. **Plan** (Opus or opusplan) — design the ticket's implementation, list files, identify dependencies
2. **Branch** — `feat/<ticket-slug>` off `main`
3. **Build** (Sonnet implementer) — dependency order: schema → shared → API → frontend. Each step leaves tree green.
4. **Test** (Sonnet test-author) — same commit, covers the change (Vitest unit/integration + RTL components)
5. **Smoke Test** (Sonnet) — Supertest for API, Playwright for browser journeys. No manual browser verification.
6. **Verify** (Sonnet/Haiku reviewer) — pre-commit gate: diff review, build, typecheck, lint, test suite, sweeps
7. **Commit** — conventional commit, atomic, tree stays green
8. **Push + PR** — `gh pr create`, CI runs
9. **Merge** — squash-merge to `main`, delete branch, auto-deploy

### Session Strategy

- Start each session scoped to the current ticket
- Use `explore` (Haiku) subagents for "find X" / "how does Y work" — burns their context, not main
- Plan multi-file changes with opusplan, execute with Sonnet
- Keep main session for synthesis and decisions; delegate mechanical work
- Verification is agentic: Playwright for browser smoke tests, Supertest for API contracts, `pnpm test` for unit/integration
- Demo validation: after seeding, agent runs Playwright suite to confirm the full dataset renders and all journeys work

### Ticket Tracking

Tracked in `.claude/plans/vendor-marketplace-tickets.md`, which is the single source of truth for status and specification. No Linear MCP calls during development — push the full backlog to Linear as a historical record after MVP ships.

Each session:
1. Reads the tracker to find the next eligible ticket
2. Runs `pnpm preflight --ticket <n>` — the ticket does not start until the gate passes
3. Sets status to `In Progress`, fills in branch name
4. Executes the build loop
5. Sets status to `Done` after merge

### Project CLAUDE.md

Created in ticket #1, includes:
- Build/test/lint commands (`pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`)
- Architecture overview (monorepo structure, dependency direction)
- Database migration workflow (`pnpm db:generate`, `pnpm db:migrate`)
- Branch/commit conventions

---

## Local Development Setup

**Project location:** `~/Documents/vendor-marketplace`
**GitHub remote:** `https://github.com/hmalik-dev/vendor-marketplace.git`

### First-time setup

```bash
# Prerequisites: Node 20+, pnpm 10+, Docker, the Neon CLI

git clone https://github.com/hmalik-dev/vendor-marketplace.git
cd vendor-marketplace
pnpm install

# Create a personal Neon development branch off `production`.
# Never point local development at the `production` branch — preflight rejects it.
neon branches create --name dev
neon connection-string dev            # → DATABASE_URL (pooled)
neon connection-string dev --pooled false   # → DATABASE_URL_UNPOOLED

cp .env.example .env                  # then fill in the values preflight asks for

docker compose up -d                  # MinIO object storage (+ optional Postgres)

pnpm db:migrate
pnpm db:seed                          # reference data: categories, tags

pnpm preflight                        # verifies everything above; fix anything red
pnpm dev                              # web :3000, api :4000
```

`.env.example` is generated from the env registry (§4) — never edit it by hand. Run
`pnpm env:example` after changing the registry, or CI will fail the drift test.

### Everyday commands

| Task | Command |
|------|---------|
| Gate the ticket you are about to start | `pnpm preflight --ticket <n>` |
| Verify a production value set pre-release | `pnpm preflight --env production` |
| Regenerate `.env.example` + turbo passthrough | `pnpm env:example` |
| Start dev servers | `pnpm dev` |
| Generate a migration after a schema edit | `pnpm db:generate` |
| Apply migrations | `pnpm db:migrate` |
| Seed reference data | `pnpm db:seed` |
| Seed the full demo dataset (after #14) | `pnpm --filter @vendor-marketplace/db seed:demo` |
| Browse data | `pnpm db:studio` |
| Reset the dev branch to production's schema + data | `neon branches reset dev --parent` |
| Forward Stripe webhooks (#9, #10) | `stripe listen --forward-to localhost:4000/webhooks/stripe` |
| Run all tests | `pnpm test` |
| Run E2E tests (after #14) | `pnpm --filter @vendor-marketplace/web test:e2e` |

### Where the database lives

Local development runs against a **Neon `dev` branch**, not the `production` branch and
not Docker Postgres by default. Neon branches are copy-on-write, so a dev branch is a
full-fidelity copy that costs almost nothing and resets instantly — and pooled-connection
and SSL behaviour stay identical to production, which is where connection-level bugs
hide.

`docker compose` still provides Postgres for fully offline work; point `DATABASE_URL` at
it and leave `DATABASE_URL_UNPOOLED` unset when you need that. The DB and API suites are
unaffected either way — they boot an in-process Postgres (PGlite) through
`@vendor-marketplace/db/testing`.

Migrations and `drizzle-kit` use `DATABASE_URL_UNPOOLED` when it is set: DDL through a
transaction-mode pooler is the classic Neon migration failure.

### docker-compose.yml

Provides MinIO (S3-compatible object storage standing in for Cloudflare R2, with a
bucket-creation init container) and a Postgres 16 service for offline work. See the file
in the repository root; it is the source of truth for credentials and ports.

---

## Deployment (Production)

### Platforms

| Service | Platform | Cost | Notes |
|---------|----------|------|-------|
| Frontend (Next.js) | Vercel | Free tier | Deployed by `deploy.yml` from `main` |
| Backend (Fastify) | Railway | ~$5/mo | Container from `apps/api/Dockerfile` (#18) |
| Database | Neon (PostgreSQL) | Free tier | `production` branch; PITR, branching |
| File Storage | Cloudflare R2 | ~$0 | S3-compatible, no egress fees |
| Email | Resend | Free (3k/mo) | Requires a verified sending domain |
| Error Tracking | Sentry | Free (5k events/mo) | FE + BE |
| Auth | Clerk | Free (10k MAU) | **Production instance — separate from development** |
| DNS + CDN | Cloudflare | Free | DNS, plus the public domain for R2 assets |
| CI/CD | GitHub Actions | Free (2k min/mo private) | `ci.yml` verify, `deploy.yml` release |

**Estimated monthly cost at MVP scale: $5-10/mo**

Fastify stays on Railway rather than moving to a serverless platform: it runs unmodified
in a container, so neither the codebase nor the agentic build loop has to reason about a
serverless adapter, cold-start semantics, or a split execution model. The cost of that
simplicity is roughly $5/month.

### Provisioning checklist (ticket #19)

Every item produces a value that differs from its development counterpart. Copying a
development value into any of these fails silently — see §12, risk 7.

**Neon**
- [ ] `production` branch is the deploy target; `dev` branch exists for local work
- [ ] Pooled connection string → `DATABASE_URL` on Railway
- [ ] Direct connection string → `DATABASE_URL_UNPOOLED` on Railway and in GitHub Actions secrets

**Clerk**
- [ ] Create the **production instance** (a separate instance with its own user pool)
- [ ] Production `pk_live_` / `sk_live_` keys → Vercel and Railway
- [ ] Configure the production domain and its DNS records
- [ ] Register the webhook endpoint at `https://api.<domain>/webhooks/clerk`
- [ ] Copy **that endpoint's** signing secret → `CLERK_WEBHOOK_SECRET` (a new value)
- [ ] Verify a real sign-up creates a `users` row in the production database

**Stripe**
- [ ] Activate the account and enable Connect (Express) in **live** mode
- [ ] Live `sk_live_` / `pk_live_` keys → Railway and Vercel
- [ ] Register the webhook endpoint at `https://api.<domain>/webhooks/stripe`
- [ ] Subscribe it to `account.updated`, `payment_intent.succeeded`, `charge.refunded`
- [ ] Copy **that endpoint's** signing secret → `STRIPE_WEBHOOK_SECRET` (a new value)
- [ ] Confirm `STRIPE_PLATFORM_FEE_RATE` matches the commission in §6

**Cloudflare R2**
- [ ] Create the production bucket
- [ ] Create a scoped API token → `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`
- [ ] Attach a public domain → `S3_PUBLIC_URL`
- [ ] Set the CORS policy to allow uploads from the production web origin

**Resend**
- [ ] Verify the sending domain (DKIM + SPF records) — until verified, delivery is
      limited to the account owner
- [ ] Production API key → `RESEND_API_KEY`; `EMAIL_FROM` on the verified domain

**Sentry**
- [ ] Separate projects for `apps/web` and `apps/api` → their DSNs
- [ ] `SENTRY_AUTH_TOKEN` for release creation and sourcemap upload

**Platform + DNS**
- [ ] Vercel project linked, environment variables set, domain attached
- [ ] Railway service created from `apps/api/Dockerfile`, health probe `/health`,
      readiness probe `/ready`, environment variables set
- [ ] `WEB_URL` / `API_URL` / `NEXT_PUBLIC_API_URL` set to production origins on both
      platforms — CORS on the API is derived from `WEB_URL`
- [ ] DNS records for the web and API subdomains

**Gate**
- [ ] `pnpm preflight --env production` passes against the production value set

