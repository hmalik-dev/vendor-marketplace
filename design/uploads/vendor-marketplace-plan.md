# VendorHub — Project Plan

## 1. Product Brief

**VendorHub** is a two-sided web marketplace connecting customers with event service vendors (photographers, DJs, makeup artists, decorators, caterers, florists, etc.). Think "Airbnb for event vendors."

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
- **Desktop-first** responsive design: designed and reviewed at the 1440×900 reference viewport first, then adapted down to Laptop 1280×800, Tablet 768×1024, and Mobile 390×844 (see design system §9)
- All frontend work must pass the **Desktop Review Checklist** at 1440×900 — including the per-surface scroll budget — before the adaptation checklist is run at the narrower widths (see design system §9)

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
vendorhub/
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
- Test against a real Postgres engine via `@vendorhub/db/testing`, which boots PGlite
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

The suites boot an in-process Postgres (PGlite) through `@vendorhub/db/testing`, so
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

**Tickets:** #3, #4, #5, #16

#### M3: Discovery (Days 9-11)

**Demonstrable state:** A customer can search for vendors by category, location, and price. Browse vendor profiles with packages, portfolio, availability. Landing page showcases categories.

**Tickets:** #6

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

**Tickets:** #11, #13, #14, #15

---

## 11. Feature-Sized Backlog

### Ticket #0: Repository Init + GitHub Link

**Milestone:** M0 | **Priority:** P0 (Critical — prerequisite for everything) | **State:** Backlog

**User value:** Project exists on disk and on GitHub, ready for ticket #1 to scaffold the monorepo.

**Scope:**
- Create directory at `~/Documents/vendor-marketplace`
- `git init`
- Add `.gitignore` (Node.js template: `node_modules/`, `dist/`, `.env`, `.turbo/`, `.next/`, `*.tsbuildinfo`)
- Add empty `README.md` with project name
- Initial commit: `chore: Init repository`
- Add GitHub remote: `git remote add origin https://github.com/hmalik-dev/vendor-marketplace.git`
- Push: `git push -u origin main`

**Non-goals:**
- No monorepo scaffold (ticket #1)
- No package.json or dependencies

**Behavioral requirements:**
- `git remote -v` shows the GitHub remote
- `git log` shows one commit
- GitHub repo has the initial commit

**Blocked by:** None

---

### Ticket #1: Monorepo Foundation + Database Schema

**Milestone:** M1 | **Priority:** P0 (Critical — blocks everything) | **State:** Backlog

**User value:** Infrastructure that enables all subsequent features. Not user-visible but produces a buildable, testable, deployable skeleton.

**Scope:**
- Turborepo + pnpm workspace scaffold with all 5 packages
- Shared TypeScript, ESLint (flat config), and Tailwind configs in `packages/config`
- `packages/db`: Full Drizzle schema for all 13 tables (users through notifications), indexes, enums
- `packages/db`: Drizzle Kit migration config, initial migration generation
- `packages/db`: Seed script (categories: Photography, DJ/Music, Makeup/Beauty, Decoration, Catering, Floristry, Videography, Event Planning, Lighting, Rentals/Equipment)
- `packages/shared`: Zod schemas for all domain entities, inferred TypeScript types, constants (booking statuses, category slugs, error codes), utility functions (slug generation, price formatting, date helpers)
- `docker-compose.yml` for local Postgres
- `.env.example` with all variables documented
- `.gitignore`, root `package.json` with workspace scripts (`dev`, `build`, `test`, `lint`, `typecheck`)
- `turbo.json` pipeline config
- Project-level `CLAUDE.md` with build/test/lint commands and architecture overview

**Non-goals:**
- No application code (API routes, frontend pages)
- No Clerk, Stripe, or R2 integration
- No CI/CD pipeline (added with ticket #2)

**Behavioral requirements:**
- `pnpm install` succeeds
- `pnpm build` compiles all packages without errors
- `pnpm typecheck` passes
- `pnpm lint` passes
- `docker compose up -d` starts Postgres
- `pnpm --filter db migrate` applies all migrations
- `pnpm --filter db seed` populates categories
- Zod schemas in `packages/shared` correctly validate sample data and reject invalid data
- Types inferred from Zod schemas match the Drizzle schema column types

**Edge cases:**
- Seed script is idempotent (running twice doesn't duplicate categories)
- Migration handles existing database (doesn't fail if tables exist)
- All enum values in Drizzle match enum values in Zod schemas and constants

**Affected packages:** `packages/db`, `packages/shared`, `packages/config`, root config files

**Verification:**
- All workspace scripts run without errors
- Database schema matches the data model specification
- Zod schema validates/rejects correctly (unit tests in shared package)
- `pnpm build && pnpm typecheck && pnpm lint && pnpm test` all pass

**Blocked by:** #0

---

### Ticket #2: Authentication + App Shell

**Milestone:** M1 | **Priority:** P0 (Critical — blocks all authed features) | **State:** Backlog

**User value:** Users can sign up as customer or vendor, sign in, and see a role-appropriate dashboard shell. The foundation for all protected features.

**Scope:**
- `apps/web`: Next.js 15 scaffold with App Router, Tailwind CSS 4, shadcn/ui setup
- `apps/web`: Clerk integration — `<ClerkProvider>`, sign-in page, sign-up page (with role selection: customer or vendor)
- `apps/web`: Root layout with responsive header (logo, navigation, auth state), footer
- `apps/web`: Middleware for route protection (redirect unauthenticated users from dashboard routes)
- `apps/web`: Customer dashboard shell (empty, with sidebar navigation placeholder)
- `apps/web`: Vendor dashboard shell (empty, with sidebar navigation)
- `apps/web`: API client wrapper (`lib/api-client.ts`) with Clerk token injection for server and client components
- `apps/api`: Fastify 5 setup (`server.ts`) with Pino logger, CORS, helmet, rate limiting
- `apps/api`: Clerk auth plugin (verify session token, resolve local user, lazy-create if first visit)
- `apps/api`: Role guard middleware
- `apps/api`: Structured error handler plugin
- `apps/api`: Health check endpoint (`GET /health`)
- `apps/api`: User routes (`GET /users/me`, `PUT /users/me`)
- `apps/api`: Clerk webhook handler (`POST /webhooks/clerk` — user.created, user.updated)
- `.github/workflows/ci.yml` — GitHub Actions CI pipeline
- *Sentry integration deferred to ticket #15 (Phase 3 — Operations & Admin)*

**Non-goals:**
- No vendor profile creation (ticket #3)
- No Stripe integration
- No business logic beyond auth

**Behavioral requirements:**
- New user signs up via Clerk → sees role selection → Clerk webhook creates local user record
- If webhook is delayed, first API call creates local user via lazy sync
- Sign-in redirects to role-appropriate dashboard
- Unauthenticated access to `/dashboard` redirects to sign-in
- Customer cannot access `/vendor/*` routes
- Vendor cannot access `/customer/*` routes (but vendors ARE customers too — see edge cases)
- `GET /users/me` returns local user profile with role
- `PUT /users/me` updates name, phone, avatar
- Invalid/expired Clerk token → `401 Unauthorized`
- Missing Clerk token on protected route → `401 Unauthorized`
- Wrong role for route → `403 Forbidden`
- Health check returns `200` with database connectivity status
- *Note: Sentry integration moved to ticket #15. Ticket #2 focuses on auth + app shell only.*

**Edge cases:**
- **Vendor-as-customer:** A vendor may also want to book other vendors. For MVP, a user has one role. If this becomes a requirement, role can be made an array. Document this decision.
- **Race condition: webhook vs first API call.** Both attempt to create the local user. Use `ON CONFLICT (clerk_user_id) DO NOTHING` to handle safely.
- **Clerk outage:** If Clerk's JWKS endpoint is unreachable, cache the last-known JWKS keys (Clerk SDK does this automatically).

**Affected packages:** `apps/web`, `apps/api`, `packages/shared` (user schemas), `packages/db` (user DAO)

**Verification:**
- Sign-up flow end-to-end (manual: Clerk test mode)
- Sign-in/sign-out (manual)
- Protected route redirect (manual + frontend test)
- API auth middleware (integration tests: valid token, invalid token, missing token, wrong role)
- Webhook handler (integration test: simulate Clerk event, verify user created in DB)
- CI pipeline passes on PR

**Blocked by:** #1

---

### Ticket #3: Vendor Registration + Profile Management

**Milestone:** M2 | **Priority:** P1 (High) | **State:** Backlog

**User value:** A vendor can create and edit their business profile including business name, bio, location, photos, and control whether their profile is publicly visible.

**Scope:**
- `apps/api`: Vendor profile routes — `POST /vendor/profile` (create), `PUT /vendor/profile` (update)
- `apps/api`: Image upload route — `POST /upload/image` (R2 integration with Sharp processing)
- `apps/api`: Vendor profile service + DAO
- `apps/api`: R2 storage client (`lib/storage.ts`) — upload, delete, generate public URL
- `apps/api`: Image processing — resize to max 1920px wide, generate 400px thumbnail, convert to WebP, strip EXIF
- `apps/web`: Vendor onboarding page (first-time profile creation form)
- `apps/web`: Vendor profile edit page (full form with image uploads)
- `apps/web`: Image upload component (drag-and-drop, preview, progress)
- `apps/web`: Vendor dashboard — show profile completeness, publish/unpublish toggle
- `packages/shared`: Vendor profile Zod schemas (create, update)

**Non-goals:**
- No service packages (ticket #4)
- No portfolio gallery (ticket #4)
- No availability management (ticket #5)
- No public-facing vendor profile page (ticket #6)

**Behavioral requirements:**
- Vendor signs up → redirected to profile creation page
- Profile creation requires: business name, at least one category, city, state
- Slug auto-generated from business name (e.g., "Jane's Photography" → "janes-photography"), editable
- Slug uniqueness validated (suggest alternatives if taken)
- Profile image and cover image upload via drag-and-drop or click
- Images processed server-side (resize, WebP, strip EXIF) before R2 upload
- Vendor can toggle `is_published` (profile visible in search)
- Cannot publish without: business name, at least one category, city, state, at least one active package (enforced in ticket #4, but the publish validation should be extensible)
- Profile edit saves immediately on submit (no auto-save)

**Edge cases:**
- Business name with special characters → slug generation handles unicode, strips non-alphanumeric
- Image upload failure → show error, profile retains previous image
- Image upload succeeds but profile update fails → orphaned image in R2 (acceptable, log warning)
- Very large image (>10MB) → reject at upload endpoint with clear error
- Non-image file uploaded → reject with MIME type validation error
- Concurrent profile updates → last-write-wins (acceptable for single-user resource)

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Create vendor profile end-to-end (manual)
- Edit profile fields and verify persistence (manual + integration test)
- Image upload, resize, R2 storage (integration test with mock R2 or localstack)
- Slug generation and uniqueness (unit test)
- Validation: missing required fields, invalid data (integration test)
- Publish/unpublish toggle (integration test)

**Blocked by:** #2

---

### Ticket #4: Service Packages + Portfolio Management

**Milestone:** M2 | **Priority:** P1 (High) | **State:** Backlog

**User value:** A vendor can create service packages with pricing and manage a portfolio gallery, making their offering concrete and visually compelling to customers.

**Scope:**
- `apps/api`: Package routes — CRUD (`GET/POST/PUT/DELETE /vendor/packages`, `GET /vendor/packages/:id`)
- `apps/api`: Portfolio routes — `POST /vendor/portfolio`, `DELETE /vendor/portfolio/:id`, `PUT /vendor/portfolio/reorder`
- `apps/api`: Package service + DAO, Portfolio service + DAO
- `apps/web`: Package manager page (list, create, edit, deactivate)
- `apps/web`: Package form (name, description, price, price type, duration, max guests, inclusions list)
- `apps/web`: Portfolio manager (grid of images, drag-to-reorder, upload, delete, caption edit)
- `apps/web`: Vendor dashboard — show package count, portfolio preview
- `packages/shared`: Package and portfolio Zod schemas

**Non-goals:**
- No package customization options with price modifiers (deferred — too complex for MVP)
- No package duplication feature
- No customer-facing package display (ticket #6)

**Behavioral requirements:**
- Create package: name, description, price (in dollars, stored as cents), price type (fixed/starting_at/hourly), optional duration and max guests
- Inclusions: dynamic list of text items (add/remove)
- Edit package: all fields editable, changes take effect immediately
- Deactivate package: soft-delete (is_active = false), not visible to customers, vendor can reactivate
- Package ordering: drag-to-reorder (display_order field)
- Portfolio: upload images (reuses image upload from ticket #3), add captions, reorder
- Portfolio images get thumbnails generated automatically
- Minimum one active package required before vendor can publish profile
- Price displayed as dollars in UI, stored as cents in DB (conversion in shared utils)

**Edge cases:**
- Price of $0 → rejected (minimum $25 enforced — see commission calculation)
- Price over $100,000 → rejected (sanity limit)
- Deactivating the last active package → warn vendor their profile will be unpublished
- Deleting a portfolio image while it's uploading → handle gracefully
- Portfolio reorder with concurrent changes → accept last-write

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Package CRUD end-to-end (manual + integration tests)
- Price validation (unit test: cents conversion, min/max)
- Portfolio upload, reorder, delete (manual + integration test)
- Deactivation and reactivation (integration test)
- Publish gate: cannot publish without active package (integration test)

**Blocked by:** #3

---

### Ticket #5: Availability Management

**Milestone:** M2 | **Priority:** P1 (High) | **State:** Backlog

**User value:** A vendor can manage their availability calendar, blocking dates they're unavailable and seeing which dates are booked.

**Scope:**
- `apps/api`: Availability routes — `GET /vendor/availability`, `PUT /vendor/availability` (bulk update)
- `apps/api`: Availability service + DAO
- `apps/web`: Availability calendar page (month view, click to toggle available/blocked)
- `apps/web`: Bulk actions (block a range, clear a range)
- `apps/web`: Visual indicators for available (green), booked (red, non-editable), blocked (gray)
- `packages/shared`: Availability Zod schemas

**Non-goals:**
- No recurring availability patterns (e.g., "block every Monday")
- No integration with external calendars
- No public-facing availability display (ticket #6)

**Behavioral requirements:**
- Calendar shows current month + next 11 months (12 months total)
- Vendor can click a date to toggle between available and blocked
- Vendor can select a date range and bulk-set to available or blocked
- Booked dates (from confirmed bookings) shown as non-editable
- `PUT /vendor/availability` accepts array of `{date, status}` — upserts via `ON CONFLICT`
- Default: dates without an availability record are treated as available
- Only future dates can be modified

**Edge cases:**
- Vendor tries to block a date that has a confirmed booking → reject with error
- Vendor tries to set past dates → reject silently (ignore past dates in bulk update)
- Timezone handling: all dates are calendar dates (no timezone conversion), stored as `DATE` type
- Very large bulk update (365 dates) → should complete within timeout

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Calendar render with correct month navigation (frontend test)
- Toggle date availability (manual + integration test)
- Bulk update (integration test)
- Cannot modify booked dates (integration test)
- Cannot modify past dates (integration test)

**Blocked by:** #3

---

### Ticket #6: Vendor Search + Discovery + Landing Page

**Milestone:** M3 | **Priority:** P1 (High) | **State:** Backlog

**User value:** Customers can discover vendors by browsing categories, searching with filters, and viewing detailed vendor profiles. Landing page introduces the platform.

**Scope:**
- `apps/api`: Search route — `GET /vendors` with filters (category, city, state, minPrice, maxPrice, date, minRating, sort, page, limit)
- `apps/api`: Vendor profile route — `GET /vendors/:slug` (public, includes packages, portfolio, review summary)
- `apps/api`: Availability route — `GET /vendors/:slug/availability?from=&to=`
- `apps/api`: Category route — `GET /categories`
- `apps/api`: Search service (builds dynamic Drizzle queries with filters)
- `apps/web`: Search page with filter sidebar/bar (category chips, city/state input, price range slider, date picker, rating filter, sort dropdown)
- `apps/web`: Search results grid (VendorCard: image, name, categories, rating, price range, city)
- `apps/web`: Pagination
- `apps/web`: Public vendor profile page — hero (cover image), bio, packages list, portfolio gallery (lightbox), availability mini-calendar, reviews section (placeholder until ticket #12)
- `apps/web`: Category listing page (`/categories/:slug` → filtered search)
- `apps/web`: Landing page — hero section, category grid, featured vendors (highest rated), how-it-works section, CTA
- `apps/web`: SEO: meta tags, Open Graph, structured data (LocalBusiness schema) for vendor profile pages
- `packages/shared`: Search query params schema, vendor public response schema
- URL state management with `nuqs` for search filters (shareable/bookmarkable search URLs)

**Non-goals:**
- No map-based search (PostGIS deferred)
- No "available this weekend" quick filter
- No AI recommendations
- No booking from this page (ticket #7)

**Behavioral requirements:**
- Search returns only published, non-deleted vendors
- Filters are AND-combined (category=photography AND city=Austin → photographers in Austin)
- Date filter: only shows vendors who don't have that date blocked or booked
- Price filter: based on vendor's cheapest active package `price_cents`
- Sort options: relevance (default), rating (high to low), price (low to high), price (high to low), newest
- Pagination: 20 vendors per page, shows total count
- Vendor profile page: Server Component (SEO), includes all public info
- Portfolio images open in a lightbox/carousel
- Availability shows 3 months with available/unavailable indicators (no detailed status for non-vendors)
- Empty search results: helpful message with suggestions
- URL params persist filter state (`/search?category=photography&city=Austin`)

**Edge cases:**
- Search with no results → "No vendors found" with suggestion to broaden filters
- Vendor with no packages → still appears in search but shows "Contact for pricing"
- Vendor profile for non-existent slug → 404 page
- Vendor profile for unpublished/deleted vendor → 404 page
- Date filter for past date → ignored (only future dates)
- Very long category list → horizontal scroll on mobile
- Search query SQL injection → impossible via Drizzle parameterized queries, but test anyway

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Search with various filter combinations (integration tests)
- Search returns only published vendors (integration test)
- Date availability filter correctness (integration test)
- Vendor profile page renders all sections (frontend test + manual)
- Landing page renders (frontend test + manual)
- URL state persistence (manual: copy URL, paste in new tab, same filters)
- SEO: meta tags present on vendor profile (manual inspection)
- Mobile responsiveness (manual: resize browser)

**Blocked by:** #4, #5

---

### Ticket #7: Booking Request Lifecycle

**Milestone:** M4 | **Priority:** P0 (Critical — core transaction) | **State:** Backlog

**User value:** A customer can request to book a vendor's package (or submit a custom request). The vendor can review, quote, accept, or decline. The customer can accept quotes or cancel.

**Scope:**
- `apps/api`: Booking request routes — `POST /customer/bookings/request`, `GET /customer/bookings`, `PUT /customer/bookings/:id/accept-quote`, `PUT /customer/bookings/:id/cancel`, `GET /vendor/bookings`, `PUT /vendor/bookings/:id/quote`, `PUT /vendor/bookings/:id/accept`, `PUT /vendor/bookings/:id/decline`
- `apps/api`: Booking request service — state machine enforcement, validation, price locking
- `apps/api`: Booking request DAO
- `apps/api`: Auto-create conversation on booking request
- `apps/api`: Notification creation for booking events
- `apps/web`: Booking request form on vendor profile page (package selection → event details → submit)
- `apps/web`: Custom request form (event details + free-text description)
- `apps/web`: Customer bookings page (list of requests with status badges, actions per status)
- `apps/web`: Vendor bookings page (incoming requests, actions: quote/accept/decline)
- `apps/web`: Quote form (vendor enters price + note for custom requests)
- `apps/web`: Quote acceptance UI (customer sees quoted price, can accept or counter via message)
- `packages/shared`: Booking request schemas (create, quote, state transitions)

**Non-goals:**
- No payment (ticket #10)
- No messaging UI (ticket #8 — but conversations are auto-created here)
- No email notifications (ticket #11)
- No expiry automation (manual check for MVP; automated in ticket #11)

**Behavioral requirements:**
- Customer selects a package → booking request form pre-fills package name, price
- Customer can also submit a custom request (no package selected) with free-text description
- On request creation:
  - Validate: vendor is published, date is in the future, date is not booked/blocked
  - For package requests: lock `final_price_cents` = package's current `price_cents`
  - Create conversation (or reuse existing one for same customer-vendor pair)
  - Create notification for vendor
  - Set `expires_at` = now + 7 days
- Vendor sees incoming requests on their bookings page
- For package requests: vendor can accept directly (price is locked)
- For custom requests: vendor must quote first (enters price + optional note)
- Customer sees quoted price, can accept (locks `final_price_cents` = `quoted_price_cents`)
- Either party can cancel a PENDING or QUOTED request
- Vendor can decline any PENDING or QUOTED request
- State machine strictly enforced (see Authorization Matrix, rule #8)

**Edge cases:**
- **Customer requests same vendor for same date twice:** Allow — vendor sees both and can accept one, decline the other. The unique constraint is on availability, not requests.
- **Vendor changes package price after request:** Doesn't affect existing request — `final_price_cents` is locked at request time.
- **Vendor not Stripe-onboarded tries to accept:** Reject with clear error message ("Set up payments before accepting bookings").
- **Request for a date that gets booked between request and acceptance:** Date availability re-checked when vendor accepts. If now booked, reject the accept action.
- **Expired request:** If `expires_at` has passed and status is still PENDING, treat as EXPIRED on next access. Vendor cannot accept/quote expired requests.
- **Vendor has no active packages but receives custom request:** Allowed — custom requests don't require a package.
- **Empty custom_details on custom request:** Rejected — customer must describe what they want.
- **Quote of $0:** Rejected — minimum $25 enforced.

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Package booking request flow end-to-end (integration test)
- Custom booking request + quote + accept flow (integration test)
- All valid state transitions (integration test per transition)
- All invalid state transitions rejected (integration test)
- Date validation (future, not booked/blocked) (integration test)
- Price locking correctness (integration test: change package price after request, verify locked price unchanged)
- Stripe onboarding gate on accept (integration test)
- Customer and vendor dashboard views (frontend test + manual)

**Blocked by:** #6

---

### Ticket #8: Messaging System

**Milestone:** M4 | **Priority:** P1 (High) | **State:** Backlog

**User value:** Customers and vendors can exchange messages in the context of a booking, discussing event details, customizations, and logistics.

**Scope:**
- `apps/api`: Message routes — `GET /conversations`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages`, `GET /conversations/sse`
- `apps/api`: Message service + DAO
- `apps/api`: SSE implementation for real-time message delivery
- `apps/api`: Notification creation on new message
- `apps/web`: Messages page (shared between customer and vendor dashboards)
- `apps/web`: Conversation list sidebar (contact name, last message preview, unread indicator, timestamp)
- `apps/web`: Message thread view (chat-style, newest at bottom, auto-scroll)
- `apps/web`: Message input (text area + send button)
- `apps/web`: SSE client for real-time updates (new message toast + conversation refresh)
- `apps/web`: Unread message count in header navigation
- `packages/shared`: Message schemas (send, conversation list response)

**Non-goals:**
- No file/image attachments in messages
- No typing indicators
- No message editing or deletion
- No read receipts beyond "read_at" timestamp
- No message search

**Behavioral requirements:**
- Conversations are 1:1 between a customer and a vendor (created in ticket #7 on booking request)
- Only participants can view/send messages in a conversation
- Messages paginated (50 per page), ordered by `created_at` ascending
- Sending a message updates `conversations.last_message_at`
- SSE connection: authenticated, sends event on new message for any of user's conversations
- SSE reconnection: client auto-reconnects on disconnect, fetches missed messages via API
- `read_at` set when conversation is opened (batch update all unread messages in conversation)
- Conversation list sorted by `last_message_at` descending

**Edge cases:**
- **SSE connection drop:** Client detects via `EventSource.onerror`, reconnects with exponential backoff, fetches messages since last received `created_at`
- **Concurrent messages:** Two users send at the same time → both succeed, ordering by `created_at` (database-assigned)
- **Empty conversation (no messages yet):** Show conversation with "No messages yet" placeholder
- **User not participant in conversation:** `403 Forbidden`
- **Very long message:** Max 5000 characters, enforced by Zod schema
- **XSS in message content:** Stored as plain text, React auto-escapes on render

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Send and receive message (integration test)
- Conversation list with correct ordering (integration test)
- Participant-only access (integration test: non-participant gets 403)
- SSE event delivery (integration test: send message, verify SSE client receives event)
- Read status update (integration test)
- Message pagination (integration test)
- UI: conversation list, thread view, send message (frontend test + manual)

**Blocked by:** #7

---

### Ticket #9: Stripe Connect Vendor Onboarding

**Milestone:** M4 | **Priority:** P0 (Critical — blocks payment) | **State:** Backlog

**User value:** A vendor can connect their bank account via Stripe to receive payouts from bookings.

**Scope:**
- `apps/api`: Stripe Connect routes — `POST /vendor/stripe/connect`, `GET /vendor/stripe/status`
- `apps/api`: Stripe webhook handler — `account.updated` event (update `stripe_onboarded` status)
- `apps/api`: Stripe client setup (`lib/stripe.ts`)
- `apps/web`: Stripe Connect onboarding UI — "Set up payments" button on vendor dashboard, status indicator, redirect flow
- `apps/web`: Stripe return page (success/refresh handling)
- `apps/web`: Dashboard banner for vendors without Stripe setup ("Complete payment setup to start accepting bookings")

**Non-goals:**
- No payment processing (ticket #10)
- No payout management UI (vendors use Stripe Express Dashboard)
- No multiple bank accounts

**Behavioral requirements:**
- Vendor clicks "Set up payments" → `POST /vendor/stripe/connect`
- Backend creates Stripe Connect Express account (if none exists) or creates new Account Link for existing incomplete account
- Returns Stripe-hosted onboarding URL → frontend redirects vendor
- Vendor completes KYC, banking info on Stripe's hosted pages
- On completion, Stripe redirects back to app's return URL
- Return page checks account status via `GET /vendor/stripe/status`
- `account.updated` webhook updates `stripe_onboarded` flag based on `charges_enabled` and `payouts_enabled`
- Dashboard shows onboarding status: Not started → In progress → Complete
- Vendor cannot accept bookings until `stripe_onboarded = true`

**Edge cases:**
- **Vendor abandons onboarding mid-flow:** `stripe_account_id` is set but `stripe_onboarded = false`. On return, "Set up payments" generates a new Account Link for the existing account.
- **Stripe account gets disabled after onboarding:** `account.updated` webhook detects `charges_enabled = false`, sets `stripe_onboarded = false`. Vendor notified, cannot accept new bookings. Existing confirmed bookings remain (Stripe handles).
- **Webhook arrives before redirect return:** Frontend polls or checks status on page load — both paths handled.
- **Multiple clicks on "Set up payments":** Idempotent — same Stripe account, new Account Link each time.

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Full onboarding flow with Stripe test mode (manual)
- Account creation idempotency (integration test: call connect twice, verify same account)
- Webhook handling: account.updated with charges_enabled true/false (integration test with mock)
- Status endpoint returns correct state (integration test)
- Accept-booking gate with unonboarded vendor (integration test — should fail)
- Dashboard UI states (frontend test)

**Blocked by:** #2

---

### Ticket #10: Payment + Booking Completion Lifecycle

**Milestone:** M4 | **Priority:** P0 (Critical — core transaction) | **State:** Backlog

**User value:** A customer can pay for an accepted booking via Stripe. On event completion, the vendor receives their payout. Either party can cancel with appropriate handling.

**Scope:**
- `apps/api`: Payment route — `POST /customer/bookings/:id/pay` (creates PaymentIntent, returns client secret)
- `apps/api`: Completion route — `PUT /vendor/bookings/:id/complete` (marks complete, initiates transfer)
- `apps/api`: Cancellation route — `PUT /customer/bookings/:id/cancel` (with refund logic)
- `apps/api`: Stripe webhook handler — `payment_intent.succeeded` (confirm booking in DB transaction)
- `apps/api`: Payment service — PaymentIntent creation, commission calculation, Transfer creation
- `apps/api`: Booking DAO (bookings table CRUD)
- `apps/web`: Payment page (Stripe Elements — card input, order summary, pay button)
- `apps/web`: Payment confirmation page (success/failure state)
- `apps/web`: Booking detail page (shows status, actions based on current status)
- `apps/web`: Cancel booking UI (confirmation dialog, reason input)
- `apps/web`: Vendor "Mark Complete" button on confirmed bookings (post-event)
- `packages/shared`: Booking schemas, payment schemas

**Non-goals:**
- No partial payments or installments
- No tipping
- No refund arbitration — refunds are automatic based on cancellation policy
- No Stripe invoice generation

**Behavioral requirements:**
- Customer clicks "Pay" on an ACCEPTED booking request:
  - Backend validates: request status is ACCEPTED, vendor is Stripe-onboarded, date is still available
  - Creates PaymentIntent with: `amount = final_price_cents`, `currency = 'usd'`, `application_fee_amount = platform_fee_cents`, `transfer_data.destination = vendor_stripe_account_id`
  - Returns `clientSecret` to frontend
- Frontend uses Stripe Elements to collect card and confirm payment
- On `payment_intent.succeeded` webhook (critical path):
  - **In a single DB transaction:**
    - Create `bookings` row (status: CONFIRMED, amounts, Stripe IDs)
    - Update `booking_requests` status if needed
    - Update `availability` for the event date → status: BOOKED
  - If DB transaction fails after Stripe payment succeeds: log error to Sentry with payment_intent_id for manual reconciliation. Do NOT attempt automatic refund in the error handler.
  - Send confirmation notification + email to both parties
- Vendor marks booking as COMPLETED (after event):
  - Booking status → COMPLETED
  - Create Stripe Transfer to vendor's Connect account for `vendor_payout_cents`
  - If Transfer fails: log error, set booking to `payment_pending` internal state, alert via Sentry. Retry manually.
  - Send review invitation notification to both parties
- Cancellation:
  - CONFIRMED booking cancelled > 48 hours before event: full refund via Stripe Refund
  - CONFIRMED booking cancelled < 48 hours before event: 50% refund
  - COMPLETED booking: cannot cancel
  - Refund creates Stripe Refund, updates booking status to CANCELLED, frees availability date

**Edge cases:**
- **Double-pay attempt:** PaymentIntent is created once per booking request. Subsequent calls return the existing PaymentIntent's client secret (idempotent).
- **Two customers pay for same vendor-date simultaneously:** The first `payment_intent.succeeded` webhook claims the availability date in a transaction. The second webhook's transaction fails on availability update (date already BOOKED) → refund the second payment automatically, notify customer.
- **Payment succeeds but webhook never arrives:** Implement a webhook reconciliation check — on booking detail page load, if status is ACCEPTED and a PaymentIntent exists, check its status via Stripe API.
- **Vendor marks complete before event date:** Allow — vendor knows their schedule better. Log but don't block.
- **Stripe Transfer fails (vendor account issue):** Booking status remains COMPLETED. Transfer failure logged to Sentry with high severity. Manual retry via Stripe Dashboard.
- **Customer cancels PENDING/QUOTED request:** No payment involved, just status update.
- **Refund for a $25 booking (minimum):** Stripe refund fees may make this unprofitable. Accept the loss — it's rare at MVP scale.

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Full payment flow with Stripe test cards (manual: `4242424242424242` for success, `4000000000000002` for decline)
- PaymentIntent creation with correct amounts and fees (integration test with Stripe mock)
- Webhook handling: payment_intent.succeeded creates booking in DB transaction (integration test)
- Availability date marked as BOOKED after payment (integration test)
- Double-pay prevention (integration test: two webhooks for same request)
- Booking completion + Transfer creation (integration test with Stripe mock)
- Cancellation + refund (integration test for >48h and <48h cases)
- Commission calculation accuracy (unit test)
- Payment page UI with Stripe Elements (manual)

**Blocked by:** #7, #9

---

### Ticket #11: Transactional Email Notifications

**Milestone:** M4 | **Priority:** P2 (Medium) | **State:** Backlog

**User value:** Users receive email notifications for critical events so they don't miss important booking updates.

**Scope:**
- `apps/api`: Email service (`lib/email.ts`) — Resend client, template rendering
- `apps/api`: Email templates (React Email or HTML strings) for:
  - New booking request (to vendor)
  - Booking request accepted/declined (to customer)
  - Quote received (to customer)
  - Quote accepted (to vendor)
  - Payment confirmation (to both parties)
  - Booking completed (to both parties)
  - Booking cancelled (to the other party)
  - Review invitation (to both parties, after completion)
- `apps/api`: Integrate email sending into existing service methods (booking, payment, review)
- `apps/api`: Booking request expiry check — scheduled or lazy check, send expiry notification

**Non-goals:**
- No email preferences/unsubscribe (MVP — all critical emails)
- No marketing emails
- No email templates editor
- No queued email delivery (synchronous via Resend)

**Behavioral requirements:**
- Emails sent synchronously in service methods, after the primary DB operation succeeds
- If email sending fails: log error to Sentry, do NOT fail the operation (email is non-critical)
- Emails include: VendorHub branding, clear subject line, action button (deep link to relevant page), relevant details (booking date, vendor name, amount)
- From address: `noreply@vendorhub.com` (configured via env var)
- Booking request expiry: check on vendor dashboard load (lazy) — if request expired, update status and send expiry notification to customer

**Edge cases:**
- Resend API down: operation succeeds, email silently fails with Sentry alert
- Invalid email address: Resend handles bounce, no action needed for MVP
- Rapid re-sends (e.g., vendor accepts then cancels quickly): each event sends its own email, no dedup needed

**Affected packages:** `apps/api`, `packages/shared` (email template types)

**Verification:**
- Each email template renders correctly (unit test with snapshot)
- Email sent on each trigger event (integration test: verify Resend SDK called with correct params)
- Email failure doesn't break the primary operation (integration test: mock Resend to throw)
- Expiry check and notification (integration test)

**Blocked by:** #7

---

### Ticket #12: Review System

**Milestone:** M5 | **Priority:** P1 (High) | **State:** Backlog

**User value:** After a completed booking, both customer and vendor can leave reviews. Customer reviews are public and build vendor trust. Vendor reviews are private feedback on customers.

**Scope:**
- `apps/api`: Review routes — `POST /reviews`, `GET /reviews/booking/:bookingId`, `GET /vendors/:slug/reviews` (already partially in ticket #6 — full implementation here)
- `apps/api`: Review service — creation, eligibility validation, profanity filter, rating aggregation
- `apps/api`: Rating aggregation — update `vendor_profiles.avg_rating` and `review_count` after each review
- `apps/web`: Review submission page/modal (accessed from completed booking detail)
- `apps/web`: Review form (star rating 1-5, optional title, required content text)
- `apps/web`: Review display on vendor profile page (list with rating, title, content, reviewer name, date)
- `apps/web`: Rating summary on vendor profile (average, distribution bar chart)
- `apps/web`: Review prompts on completed bookings ("Leave a review" CTA)
- `packages/shared`: Review schemas (create, response)

**Non-goals:**
- No review responses (vendor replying to a review)
- No manual moderation queue or admin review approval
- No photo reviews
- No review editing after submission

**Behavioral requirements:**
- Only users who are party to a COMPLETED booking can create a review
- One review per user per booking (enforced by `UNIQUE(booking_id, reviewer_id)`)
- Customer reviews (`customer_to_vendor`): public, visible on vendor profile, affect `avg_rating`
- Vendor reviews (`vendor_to_customer`): private, only visible to the vendor who wrote it (future: visible to other vendors considering this customer)
- Rating: 1-5 stars (integer), required
- Content: required, 10-2000 characters. Passed through profanity filter (`bad-words` or `leo-profanity` npm package) before saving — if flagged, reject with 422 and "Your review contains inappropriate language. Please revise and resubmit."
- Title: optional, max 200 characters (also filtered)
- After review creation: recalculate `avg_rating` as weighted average, increment `review_count`
- Rating recalculation: `avg_rating = SUM(rating) / COUNT(*) WHERE type = 'customer_to_vendor'`
- Vendor profile page shows reviews paginated (10 per page), newest first

**Edge cases:**
- **Booking completed but event hasn't happened yet** (vendor marked complete early): Allow review — vendor chose to complete it.
- **Review content with only whitespace:** Rejected by Zod (trim + min length check).
- **Rating aggregation race condition** (two reviews submitted simultaneously for different bookings): Use `UPDATE vendor_profiles SET avg_rating = (SELECT AVG(rating) FROM reviews WHERE vendor_id = ... AND type = 'customer_to_vendor'), review_count = (SELECT COUNT(*) FROM reviews WHERE ...)` — derived from source data, not increment. Idempotent.
- **Vendor profile deleted after review:** Reviews remain in DB but are not displayed (vendor profile page 404s).

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Review creation for completed booking (integration test)
- Review rejected for non-completed booking (integration test)
- Review rejected for non-participant (integration test)
- Duplicate review rejected (integration test)
- Rating aggregation accuracy (integration test: create multiple reviews, verify avg)
- Review display on vendor profile (frontend test + manual)
- Rating distribution chart (frontend test)

**Blocked by:** #10

---

### Ticket #13: Notification Center

**Milestone:** M5 | **Priority:** P2 (Medium) | **State:** Backlog

**User value:** Users see in-app notifications for booking events, messages, and reviews, with an unread count badge in the header.

**Scope:**
- `apps/api`: Notification routes — `GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`
- `apps/api`: Notification service + DAO
- `apps/api`: Integrate notification creation into all event services (most already create notifications from earlier tickets — this ticket ensures completeness and adds the retrieval/management layer)
- `apps/web`: Notification bell icon in header with unread count badge
- `apps/web`: Notification dropdown/panel (list of notifications, click to navigate to relevant page)
- `apps/web`: Mark as read on click, "Mark all as read" button
- `apps/web`: Notification types with appropriate icons and formatting:
  - New booking request
  - Booking accepted/declined/quoted
  - Quote accepted
  - Payment confirmed
  - Booking completed
  - New message
  - New review received
- `packages/shared`: Notification schemas

**Non-goals:**
- No push notifications (browser or mobile)
- No notification preferences (all notifications enabled)
- No email digest of notifications
- No real-time notification delivery (poll on page load + message SSE covers it)

**Behavioral requirements:**
- Notifications fetched on page load (header component)
- Unread count shown as badge on bell icon (max display "99+")
- Notification list paginated (20 per page), newest first
- Each notification has: title, body, timestamp, read/unread status, data (links to relevant page)
- Clicking a notification: marks it as read, navigates to the linked page (e.g., booking detail, conversation)
- "Mark all as read" updates all user's notifications
- Notifications created by services in earlier tickets — this ticket ensures all events have notifications and the retrieval layer works

**Edge cases:**
- Zero notifications: bell shows no badge, dropdown shows "No notifications"
- Very old notifications: no auto-cleanup for MVP (monitor DB size)
- Notification for a deleted resource (e.g., vendor deleted): notification still shows but link may 404 — acceptable for MVP

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Notification creation for each event type (integration test)
- Notification list retrieval with pagination (integration test)
- Mark as read / mark all as read (integration test)
- Unread count accuracy (integration test)
- Header badge + dropdown UI (frontend test + manual)
- Click-to-navigate (manual)

**Blocked by:** #7

---

### Ticket #14: Demo Dataset + Test Accounts + Playwright Smoke Tests

**Milestone:** M6 | **Priority:** P1 (High — validates everything before real users) | **State:** Backlog

**User value:** A fully populated, realistic marketplace that can be stress-tested end-to-end before any real user touches the platform. All testing is agentic — Playwright drives browser-level smoke tests, Supertest validates API contracts, seed scripts populate deterministic data.

**Scope:**
- `packages/db`: `seed:demo` script — deterministic, idempotent full-dataset seeder
- `apps/api`: Programmatic Stripe Connect test account creation for seeded vendors (Stripe test mode)
- `apps/web` + `apps/api`: Playwright end-to-end test suite for critical user journeys
- Test account documentation in project README

**Demo dataset (seeded via `pnpm --filter @vendorhub/db seed:demo`):**

**Users (created in local DB with matching Clerk test-mode accounts):**
- 1 admin account (`admin@vendorhub.test`, role: admin)
- 3 customer accounts (`customer1@vendorhub.test`, `customer2@vendorhub.test`, `customer3@vendorhub.test`)
- 12-15 vendor accounts (one email per vendor, e.g., `luminous.photo@vendorhub.test`)

**Vendors (12-15 across all 10 categories, realistic data):**

| Vendor | Category | City | Packages | Price Range |
|--------|----------|------|----------|-------------|
| Luminous Photography | Photography | Austin, TX | 3 (Elopement $800, Half-Day $1,500, Full-Day $2,800) | $800-$2,800 |
| BeatDrop DJ Services | DJ/Music | Austin, TX | 3 (Reception $500, Full Event $1,200, Premium $2,000) | $500-$2,000 |
| Glow Beauty Studio | Makeup/Beauty | Dallas, TX | 4 (Bridal $250, Party $150, Group 4+ $400, Trial $75) | $75-$400 |
| Enchanted Decor | Decoration | Houston, TX | 3 (Basic $600, Premium $1,500, Luxury $3,500) | $600-$3,500 |
| Savory Bites Catering | Catering | Austin, TX | 3 (Appetizers $25/pp, Full Service $55/pp, Premium $85/pp) | $625-$2,125 (25 guest min) |
| Petal & Bloom | Floristry | San Antonio, TX | 3 (Bouquets Only $300, Ceremony $800, Full Venue $2,200) | $300-$2,200 |
| Cinematic Stories | Videography | Dallas, TX | 3 (Highlight Reel $1,000, Half-Day $2,000, Full-Day $3,500) | $1,000-$3,500 |
| Harmony Events | Event Planning | Houston, TX | 3 (Day-Of Coord $800, Partial $2,500, Full Planning $5,000) | $800-$5,000 |
| Radiance Lighting | Lighting | Austin, TX | 3 (Uplighting $400, Dance Floor $800, Full Production $2,000) | $400-$2,000 |
| Premier Rentals | Rentals/Equipment | Houston, TX | 3 (Tables/Chairs $300, Tent $1,200, Full Setup $3,000) | $300-$3,000 |
| Shutter & Frame | Photography | Dallas, TX | 2 (Portrait Session $400, Event Coverage $1,800) | $400-$1,800 |
| Velvet Vibes DJ | DJ/Music | San Antonio, TX | 2 (Standard $600, Premium $1,500) | $600-$1,500 |

- Each vendor: realistic bio (2-3 sentences), profile image (placeholder), cover image (placeholder)
- Each vendor: 5-10 portfolio items with captions (placeholder image URLs with descriptive alt text)
- Each vendor: availability for next 3 months (80% available, 10% blocked, 10% booked)
- 10 vendors: `stripe_onboarded = true` (Stripe test Express accounts created programmatically)
- 2 vendors: `stripe_onboarded = false` (onboarding incomplete — tests the gate)
- 2 vendors: `is_published = false` (one with no packages, one voluntarily unpublished — tests search exclusion)

**Bookings (across all statuses):**
- 5 PENDING requests (mix of package and custom, across different customer-vendor pairs)
- 3 QUOTED requests (custom requests with vendor quotes)
- 2 ACCEPTED requests (awaiting payment)
- 6 CONFIRMED bookings (paid, event upcoming)
- 8 COMPLETED bookings (event done, vendor paid out)
- 3 CANCELLED bookings (1 full refund >48h, 1 partial <48h, 1 cancelled before payment)
- 2 EXPIRED requests (past `expires_at`)

**Conversations & Messages:**
- One conversation per booking request (auto-created)
- COMPLETED/CONFIRMED bookings: 5-15 messages each (realistic back-and-forth about event details)
- PENDING/QUOTED requests: 1-3 messages each

**Reviews (for COMPLETED bookings):**
- 15-20 customer-to-vendor reviews (rating distribution: 2x 3-star, 5x 4-star, 8-10x 5-star — skewed positive, realistic)
- 5-8 vendor-to-customer reviews (private)
- Realistic review text per category ("The photos were stunning, captured every moment..." not lorem ipsum)
- Vendor `avg_rating` and `review_count` correctly derived

**Notifications:**
- 30-50 notifications across all users (mix of read/unread)

**Playwright End-to-End Tests (`apps/web/e2e/`):**

Critical user journeys automated via Playwright (run headless in CI, headed locally):
1. **Customer discovery flow:** Landing page → search with filters → vendor profile → view packages/portfolio/availability
2. **Vendor onboarding flow:** Sign up as vendor → create profile → add packages → upload portfolio → set availability → publish
3. **Booking flow:** Customer selects package → submits request → vendor accepts → customer pays (Stripe test card) → booking confirmed
4. **Custom request flow:** Customer submits custom request → vendor quotes → customer accepts quote → pays
5. **Messaging flow:** Customer sends message → vendor sees in conversation → vendor replies
6. **Review flow:** Vendor marks complete → customer leaves review → review appears on vendor profile with updated rating
7. **Admin flow:** Admin logs in → views dashboard metrics → moderates a review → manages vendor publish status
8. **Auth guards:** Unauthenticated access redirects, wrong role gets 403, banned user blocked

**Clerk Test Mode Setup:**
- All test accounts created in Clerk's test mode via Clerk Backend API during seed
- Deterministic passwords for all test accounts (e.g., `TestPass123!`) documented in `.env.example`
- Seed script creates Clerk users + local DB records in one pass, handles existing accounts idempotently

**Non-goals:**
- No load testing / performance benchmarks (use k6 post-MVP if needed)
- No visual regression testing
- No mobile device emulation beyond responsive viewport sizes

**Behavioral requirements:**
- `pnpm --filter @vendorhub/db seed:demo` populates the entire dataset in under 60 seconds
- Running seed:demo twice produces identical state (idempotent — upserts, not inserts)
- `pnpm --filter @vendorhub/web test:e2e` runs all Playwright tests against local dev servers
- All 8 Playwright test suites pass with seeded data
- Stripe test accounts created programmatically (no manual Stripe Dashboard steps)

**Edge cases:**
- Seed script handles pre-existing data (upsert via `ON CONFLICT`)
- Seed script handles missing Clerk/Stripe credentials gracefully (skips external account creation, logs warning, still seeds local DB)
- Playwright tests resilient to SSE timing (use `waitForResponse`/polling, not fixed timeouts)

**Affected packages:** `packages/db`, `apps/web`, `apps/api`

**Verification:**
- Seed script runs clean from empty DB (integration test)
- Seed script is idempotent (run twice, verify same row counts)
- All 8 Playwright suites pass
- Seeded data visible in the app (Playwright screenshots for visual audit)
- Stripe test accounts queryable via Stripe API

**Blocked by:** #12 (needs all features to exist before seeding full dataset)

---

### Ticket #15: Admin Portal + Sentry Integration

**Milestone:** M6 | **Priority:** P1 (High — needed for platform operation) | **State:** Backlog

**User value:** Platform operator (you) has a control plane to monitor the marketplace, manage vendors/users, moderate reviews, and track revenue. Sentry integration catches errors across FE + BE before users report them.

**Scope:**
- `apps/api`: Admin route group — all `/admin/*` routes (see Section 6: API Contracts)
- `apps/api`: Admin service + DAOs (aggregation queries for dashboard metrics)
- `apps/api`: Ban middleware — check `is_banned` on every authenticated request, return 403 if banned
- `apps/api`: Sentry integration (`@sentry/node`) — unhandled exceptions, rejected promises, user context, payment error severity
- `apps/web`: Admin layout (`/admin/*` route group) — sidebar navigation, protected by admin role
- `apps/web`: Admin dashboard page — key metrics cards (total revenue, total bookings, active vendors, total users, signups this week/month), revenue chart (last 30 days), booking volume chart
- `apps/web`: Vendor management page — data table (all vendors, filterable by status/category/city), toggle publish, view detail (profile + booking history + revenue)
- `apps/web`: User management page — data table (all users, filterable by role/banned), ban/unban with confirmation dialog
- `apps/web`: Booking management page — data table (all bookings, filterable by status/date), view detail with full payment timeline (Stripe IDs, amounts, refunds)
- `apps/web`: Review moderation page — data table (all reviews, sortable by rating/date, filter by vendor), delete with confirmation (recalculates vendor rating)
- `apps/web`: Category management page — editable table (name, slug, icon, display order, active toggle), create new category
- `apps/web`: Sentry integration (`@sentry/nextjs`) — error boundary, user context, route performance
- `packages/shared`: Admin response schemas (dashboard metrics, list responses)
- `packages/db`: Migration for `is_banned` and `banned_at` columns on `users` table

**Non-goals:**
- No admin user creation UI (admin account created via seed script or direct DB update)
- No audit log (defer post-MVP)
- No export/CSV functionality
- No real-time dashboard updates (refresh on page load)
- No granular admin permissions (single admin role has full access)

**Behavioral requirements:**
- Only users with `role = 'admin'` can access `/admin/*` routes — others get 403
- Admin routes use the same Clerk auth flow as other protected routes
- Dashboard metrics are computed on request (no caching for MVP — dataset is small)
- Revenue calculations: `SUM(platform_fee_cents)` for bookings with status COMPLETED
- Ban action: sets `is_banned = true` + `banned_at = now()`. If banned user is a vendor with CONFIRMED bookings, those bookings are auto-cancelled with refunds. PENDING/QUOTED requests auto-cancelled. Profile unpublished.
- Unban action: sets `is_banned = false`, `banned_at = null`. Vendor must manually re-publish.
- Review deletion: removes review, recalculates vendor `avg_rating` and `review_count` from remaining reviews
- Category create: validates unique name and slug, assigns next display_order
- Sentry: captures all unhandled errors, attaches `userId` and `role` context, payment errors tagged as `severity: critical`

**Dashboard metrics cards:**
- Total Platform Revenue (sum of `platform_fee_cents` for COMPLETED bookings, formatted as dollars)
- Total Bookings (count of `bookings` rows)
- Active Vendors (count of published, non-deleted, non-banned `vendor_profiles`)
- Total Users (count of `users` rows, excluding admin)
- New Signups (last 7 days, last 30 days)

**Dashboard charts:**
- Revenue by day (last 30 days) — bar chart
- Bookings by day (last 30 days) — line chart
- Signups by day (last 30 days) — line chart

**Edge cases:**
- Admin bans themselves → rejected (cannot self-ban)
- Admin deletes only review for a vendor → `avg_rating` resets to 0, `review_count` to 0
- Banning a vendor mid-payment (ACCEPTED request, customer hasn't paid yet) → request auto-cancelled, customer notified
- Category deactivation with active vendors in that category → vendors keep the association but category hidden from search filters. Vendor profile still shows the category name.
- Zero data state (fresh install, no bookings/vendors) → dashboard shows zeros, empty tables with "No data" states

**Affected packages:** `apps/api`, `apps/web`, `packages/shared`, `packages/db`

**Verification:**
- Admin dashboard renders with correct metrics (Playwright test with seeded data — verify numbers match seed counts)
- Non-admin user gets 403 on admin routes (integration test)
- Ban/unban flow (integration test: ban vendor → verify 403 on their API calls → verify bookings cancelled → unban → verify access restored)
- Review deletion + rating recalculation (integration test)
- Category CRUD (integration test)
- Sentry captures test error (integration test: trigger error, verify Sentry SDK called)
- All admin pages render and data tables paginate (Playwright test)

**Blocked by:** #12 (reviews must exist for moderation), #14 (demo data for meaningful dashboard)

---

### Ticket #17: Environment Contract + Preflight Gate

**Milestone:** M1.5 | **Priority:** P0 (Critical — gates every subsequent ticket) | **State:** Backlog

**Design intent.** Three separate failures share one root cause, and #17 removes the
cause rather than patching the symptoms.

*The list has no owner.* `.env.example`, the API's Zod schema, `turbo.json`'s
`globalPassThroughEnv`, and `.env` each carry a hand-maintained copy of the variable
list. Nothing reconciles them, so they drift silently — `DATABASE_URL_UNPOOLED` and
`NEON_BRANCH` exist in `.env` and in none of the other three. #17 makes
`packages/shared/src/env/registry.ts` the owner and generates the rest, with a test
that fails on drift. A registry is a declarative catalogue of constants, which is
exactly the role `packages/shared` already plays, so the one-way `apps → packages`
dependency direction is preserved.

*Validation checks presence, not validity.* `z.string().min(1)` accepts
`STRIPE_SECRET_KEY=sk_test_...`, so a placeholder passes startup validation and fails
later as an opaque SDK error inside a feature. Adding a `shape` regex per variable
moves that failure to the gate and names it.

*Prerequisites are prose.* Tickets #9, #11, and #15 carry `PREREQ:` notes in a Notes
column that no tool reads. #3 shipped needing object storage that no note mentioned at
all. Encoding ticket → capability in `packages/shared/src/env/tickets.ts` makes the
prerequisite executable and makes the omission impossible to repeat.

**Why feature-scoped rather than global.** A global gate — nothing runs until every
credential is real — is simpler to build and wrong in practice: it blocks work on
ticket #4 behind a Stripe signup that #4 never touches, and the predictable response is
to bypass the gate, after which it protects nothing. Scoping checks to the capabilities
a ticket declares keeps every gate failure genuinely relevant, which is what keeps the
gate trusted.

**Neon reconciliation is inside this ticket, not adjacent to it.** Local development
currently points at the Neon `production` branch while `.env.example`, `docker-compose.yml`,
and `CLAUDE.md` all describe Docker Postgres. The safety check ("refuse to run
development against `production`") and the correction of the three documents are the
same change: the check is meaningless until a `dev` branch exists, and the documents
are actively misleading until they describe it.

**Non-goals:** boot-time gating of `pnpm dev` (see §8 — feature-scoped checks cannot
know which code path a dev server will reach); any deployment work (#18–#20); any
product feature.

Full executable spec — scope, behavioural requirements, edge cases, verification —
lives in the ticket tracker.

---

### Ticket #18: API Containerization + Release Readiness

**Milestone:** M4.5 | **Priority:** P0 (Critical — blocks first deploy) | **State:** Backlog

**Design intent.** `apps/api` has never been packaged to run anywhere but a developer's
machine. Three things are missing, and each is a correctness issue rather than a
packaging chore:

*No container image.* Railway builds from a Dockerfile. A pnpm workspace needs a
multi-stage build — install with the full lockfile, build, then `pnpm deploy --filter`
a pruned production tree into the runtime stage — or the image ships the entire
monorepo including devDependencies. Runtime concerns that are easy to omit and painful
to diagnose: a non-root user, `HOST=0.0.0.0` (binding `localhost` inside a container
makes the service unreachable while appearing healthy), and correct signal handling so
deploys drain rather than drop connections.

*Liveness and readiness are conflated.* `GET /health` currently round-trips the
database and answers `200 { status: "degraded" }` when that fails. A platform reading
that as a restart signal restarts a healthy process during a database blip; a platform
reading it as a traffic signal routes requests into a broken backend. Splitting into
`/health` (no I/O) and `/ready` (database + storage, `503` on failure) gives each
consumer the signal it actually needs, and gives the deploy smoke check an endpoint
whose success means something.

*Migrations run through the connection pooler.* `drizzle.config.ts` and
`src/scripts/migrate.ts` both read `DATABASE_URL`, which on Neon is PgBouncer in
transaction mode. Drizzle's migrator takes a session-level advisory lock and issues
DDL, neither of which survives a pooler that does not pin sessions. This works often
enough to look correct and fails non-deterministically under concurrency. Both must
prefer `DATABASE_URL_UNPOOLED`.

**Non-goals:** provisioning any production account (#19); the deploy workflow itself
(#20).

---

### Ticket #19: Production Environment Provisioning

**Milestone:** M4.5 | **Priority:** P0 (Critical — blocks first deploy) | **State:** Backlog

**Design intent.** This plan originally carried one flat list of environment variables,
which implied development and production share values. The variables that differ are
precisely the ones whose confusion fails silently, and §4's per-environment table
enumerates them. Ticket #19 is the work of standing up the production side of that
table.

The failures this prevents are all quiet ones. A Clerk **production instance** is a
separate instance with its own user pool and its own keys — reusing development keys
yields an app that authenticates nobody on the real domain. Every webhook endpoint
(Clerk, Stripe) must be re-registered against the production URL and issues **a new
signing secret**; reusing the development secret means signature verification rejects
every production webhook, so user rows are never created and payments never confirm,
with no error visible to the user. Stripe must be moved to live mode with Connect
enabled. R2 needs a bucket and a public domain, or uploads succeed into a bucket
nothing serves. Resend will only deliver to the account owner until a sending domain
is verified.

`pnpm preflight --env production` (built in #17) is what verifies the result, which is
why #17 precedes this and why the same shape regexes catch a `sk_test_` key configured
on a production platform.

**Non-goals:** the deploy workflow (#20); any DNS provider migration beyond pointing
records at Vercel and Railway.

---

### Ticket #20: Deploy Pipeline

**Milestone:** M4.5 | **Priority:** P0 (Critical) | **State:** Backlog

**Design intent.** With the image (#18) and the production environment (#19) in place,
#20 makes releases automatic and ordered. `deploy.yml` runs on `main`, gated on
`ci.yml`, and performs: migrate against the unpooled connection → deploy the API →
deploy the web app → poll `GET /ready`.

Ordering carries the constraint. Migrations run before either deploy, so the schema is
always ahead of the code reading it — which requires every migration to be
backwards-compatible with the currently-running release (additive columns, no
destructive rename in a single step). That is the discipline that makes zero-downtime
deploys possible, and it is worth adopting at the first deploy rather than discovering
during an outage.

The plan previously specified "database migrations run manually before deploy". A
manual step between merge and deploy is a step that will eventually be skipped, and the
failure mode is production code reading columns that do not exist.

**Non-goals:** rollback automation and preview environments — both are worth having and
neither blocks launch; recorded in §12.

---

> **Note on §11 coverage.** Tickets #0–#15 carry full specifications above. Tickets
> #16–#20 carry design intent here and their executable specification — scope,
> behavioural requirements, edge cases, verification — in
> `~/.claude/plans/vendor-marketplace-tickets.md`, which is the operational source of
> truth for status and detail. Duplicating full specs across both files is what let the
> in-plan tracker table drift out of date; it is not repeated.

### Dependency Graph

```
PHASE 0: Repo Setup
─────────────────────────────
#0 Repo Init + GitHub Link
 │
PHASE 1: Complete User Loop
─────────────────────────────
#1 Foundation (blocked by #0)
 └─► #2 Auth + App Shell
      └─► #3 Vendor Profile
           └─► #17 Environment Contract + Preflight Gate
                │   (gates every ticket below)
                ├─► #4 Packages + Portfolio ──┐
                ├─► #5 Availability ──────────┤
                ├─► #16 Customer Profile ─────┤
                │                             ▼
                ├─► #9 Stripe Connect ──► #6 Search + Discovery
                │         │                    │
                │         │               #7 Booking Requests
                │         │               ├─► #8 Messaging
                │         └──────────────►└─► #10 Payment + Completion
                                               │
PHASE 1.5: Production Launch                   │
─────────────────────────────                  │
                          #18 Containerization ─┤
                          #19 Provisioning ─────┤
                                                └─► #20 Deploy Pipeline
                                                     │
PHASE 2: Trust Layer                                 │
─────────────────────────────                        │
                          #10 ──► #12 Reviews ───────┘
                                   │
PHASE 3: Operations & Admin        │
─────────────────────────────      │
       #7 ├─► #11 Email Notifications
          └─► #13 Notification Center
      #12 └─► #14 Demo Dataset + Playwright
                └─► #15 Admin Portal + Sentry
```

**Critical path:** #0 → #1 → #2 → #3 → #17 → #4 → #6 → #7 → #10 → #20 → #12 → #14 → #15

**Build order (user-first priority, gate-first sequencing):**
0. #0 Repo Init — creates the project
1. #1 Foundation — blocks everything
2. #2 Auth + App Shell — blocks all features
3. #3 Vendor Profile — first user-visible feature
4. **#17 Environment Contract — gates every ticket after it, so it precedes them all**
5. #4 + #5 + #16 in parallel (all depend on #3, all gated by #17)
6. #9 Stripe Connect (depends on #2 and #17; can parallel with #4/#5/#16)
7. #6 Search + Discovery (depends on #4, #5)
8. #7 Booking Requests (depends on #6)
9. #10 Payment + Completion (depends on #7, #9)
10. #8 Messaging (depends on #7 — can parallel with #10)
11. **#18 + #19 in parallel, then #20 — first production deploy after the booking loop works**
12. #12 Reviews (depends on #10)
13. #11 + #13 in parallel (both depend on #7 — can parallel with #12)
14. #14 Demo Dataset (depends on #12 — all features must exist)
15. #15 Admin Portal + Sentry (depends on #12, #14)

#18 and #19 touch disjoint surfaces — #18 is repository code, #19 is external account
configuration — so they parallelize cleanly. #20 requires both.
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

All open decisions have been resolved. Full rationale in `~/.claude/plans/vendor-marketplace-decisions.md`.

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Stripe processing fee | Absorb from 12% commission. Customer sees one clean price. |
| D2 | Minimum booking amount | $25 minimum (`price_cents >= 2500`). |
| D3 | Cancellation policy | Fixed: 100% refund >48h, 50% <48h. Not vendor-configurable. |
| D4 | Vendor-as-customer dual role | Single role per account. Vendor creates second account to book. |
| D5 | Review moderation | Basic profanity filter (`bad-words`/`leo-profanity`). Reject flagged reviews with 422. |

---

## Ticket Tracker

**The tracker lives in `~/.claude/plans/vendor-marketplace-tickets.md`.** It is the
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

Tracked in `~/.claude/plans/vendor-marketplace-tickets.md`, which is the single source of truth for status and specification. No Linear MCP calls during development — push the full backlog to Linear as a historical record after MVP ships.

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
| Seed the full demo dataset (after #14) | `pnpm --filter @vendorhub/db seed:demo` |
| Browse data | `pnpm db:studio` |
| Reset the dev branch to production's schema + data | `neon branches reset dev --parent` |
| Forward Stripe webhooks (#9, #10) | `stripe listen --forward-to localhost:4000/webhooks/stripe` |
| Run all tests | `pnpm test` |
| Run E2E tests (after #14) | `pnpm --filter @vendorhub/web test:e2e` |

### Where the database lives

Local development runs against a **Neon `dev` branch**, not the `production` branch and
not Docker Postgres by default. Neon branches are copy-on-write, so a dev branch is a
full-fidelity copy that costs almost nothing and resets instantly — and pooled-connection
and SSL behaviour stay identical to production, which is where connection-level bugs
hide.

`docker compose` still provides Postgres for fully offline work; point `DATABASE_URL` at
it and leave `DATABASE_URL_UNPOOLED` unset when you need that. The DB and API suites are
unaffected either way — they boot an in-process Postgres (PGlite) through
`@vendorhub/db/testing`.

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

