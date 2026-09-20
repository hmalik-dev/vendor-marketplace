# Pre-launch — what must be true before real users and real money

**The gate is a command, not this page:**

```sh
pnpm launch:check
```

It reads the production values from `.env.production.local` (gitignored; real
process environment variables win over it), asks each provider what is actually
configured, and prints one line per item: `PASS`, `FAIL`, `SKIP` (the thing it
checks has not landed yet) or `MANUAL` (no provider API can answer). It exits
non-zero while anything is `FAIL`. It is read-only — every provider call is a
`GET`, the database session is `READ ONLY` — and it prints no secret beyond its
prefix and last four characters. It needs production credentials, so it is run
by the operator before a release and never in CI.

Launch readiness is a run with no `FAIL`, every `MANUAL` line confirmed by hand,
and every item below done.

**Current state:** not launched. The deployment authenticates against a Neon Auth
**development** branch and Stripe is in **test mode**, so `launch:check` fails
on both today — correctly. `docs/demo.md` describes the showcase deployment,
which is not a launch.

---

## What `launch:check` covers

| Group       | Check                                                    | Passes when                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon Auth   | `neon auth endpoint`                                     | `NEON_AUTH_BASE_URL` serves a JWKS with at least one signing key                                                                                                                                                                                                                                                                          |
| Neon Auth   | `neon auth identity store`                               | `NEON_AUTH_DATABASE_URL` names the same database host as `DATABASE_URL` — a source on another branch answers empty and the reconcile pass refuses to run                                                                                                                                                                                  |
| Stripe      | `stripe key`                                             | `STRIPE_SECRET_KEY` is `sk_live_`                                                                                                                                                                                                                                                                                                         |
| Stripe      | `stripe webhook endpoint`                                | one enabled endpoint at `API_URL/webhooks/stripe` per configured signing secret (`STRIPE_WEBHOOK_SECRET`, plus `STRIPE_CONNECT_WEBHOOK_SECRET` for the connected-account endpoint) subscribes, between them, to every type in `HANDLED_STRIPE_EVENT_TYPES` (`apps/api/src/modules/webhooks/stripe.routes.ts`); the missing ones are named |
| Stripe      | `stripe connected-account events`                        | `PASS` once `STRIPE_CONNECT_WEBHOOK_SECRET` is set and the second endpoint exists; otherwise `MANUAL`: the endpoint list does not say which endpoint listens to connected accounts, and vendor `account.updated` arrives only there                                                                                                       |
| Stripe      | `charges_enabled`, `payouts_enabled`                     | both `true` on the platform account                                                                                                                                                                                                                                                                                                       |
| Stripe      | `stripe statement descriptor`                            | set, at least 5 characters, not a placeholder — nothing in `apps/api` sets one, so it is configured in the Dashboard                                                                                                                                                                                                                      |
| Stripe      | `stripe business name`                                   | equals `BRAND_NAME`                                                                                                                                                                                                                                                                                                                       |
| Resend      | `resend sending domain`                                  | the domain of `EMAIL_FROM` is `verified` (`MANUAL` when a sending-only key cannot list domains)                                                                                                                                                                                                                                           |
| Storage     | `S3_PUBLIC_URL`                                          | a custom domain, not `*.r2.dev` or a local address                                                                                                                                                                                                                                                                                        |
| Database    | `database branch`                                        | `DATABASE_URL` is a Neon endpoint and `NEON_BRANCH` is `production`                                                                                                                                                                                                                                                                       |
| Database    | `seeded rows`                                            | zero rows carry the marketing, demo or E2E seed markers — fabricated vendors and reviews on a public production site are misrepresentation                                                                                                                                                                                                |
| Database    | `migrations`                                             | every migration in the repository journal is applied                                                                                                                                                                                                                                                                                      |
| Environment | `SENTRY_DSN`, `OPERATOR_ALERT_EMAIL`, `SUPPORT_EMAIL_TO` | set, not the registry placeholder, and matching the production shape                                                                                                                                                                                                                                                                      |
| Environment | `RATE_LIMIT_MAX`                                         | between 30 and 1000 requests per minute per IP                                                                                                                                                                                                                                                                                            |
| App         | `api /ready`                                             | `API_URL/ready` answers 200 (database and storage both up)                                                                                                                                                                                                                                                                                |
| App         | `web security headers`                                   | a real response from `WEB_URL` carries HSTS, an enforcing CSP, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`                                                                                                                                                                                                          |
| Database    | `platform_settings.maxBookingCents`                      | set — a closed beta caps what one booking can charge (VEN-404, set in `/admin/settings`)                                                                                                                                                                                                                                                  |
| App         | `platform_settings.vendorInviteOnly`                     | `SKIP` until VEN-406 lands; a closed beta needs invite-only on                                                                                                                                                                                                                                                                            |

---

## What only a person can do

- [ ] **Legal wording** (VEN-378). The terms, privacy and cookie pages exist, but
      their wording is placeholder nobody has relied on. A lawyer reads them —
      above all the staff-message-access clause (#436) under _Who else sees it_
      in the privacy policy, the one paragraph asserting that staff can read a
      user's private messages — and the legal entity and a monitored support
      destination are named.
- [ ] **Provider accounts** (VEN-377): the Neon Auth production branch on the real
      domain, the live Stripe Connect platform, the Resend domain's DNS, the
      Cloudflare custom domain for the R2 bucket, and the **Neon upgrade from
      Free to Launch** — on Free, `production` has a 6-hour history window, no
      branch protection and a storage cap whose breach makes writes fail. After
      the upgrade: protect the `production` branch and widen its history
      retention.
- [ ] **Image licensing.** Confirm the licence of every shipped marketing image
      and the landing-page category photography.
- [ ] **A real end-to-end transaction** on live keys before opening to customers:
      book, pay, message, cancel with a refund, and see the payout arrive.
- [ ] **Restore drill.** Backups are Neon-native only (VEN-408): the
      `production` branch needs its snapshot schedule on (paid plan, VEN-443; read
      it back), and the
      drill in `docs/runbook-restore.md` must run once into a scratch branch.
      Loss of the Neon account is an accepted, unprotected risk.
- [ ] **Rotate every credential touched during setup**.

## Known limits to revisit before scaling out

- **Image URLs are stored absolute.** `apps/api/src/lib/storage.ts` writes
  `publicUrlFor(S3_PUBLIC_URL, key)` into rows, so changing `S3_PUBLIC_URL` after
  vendors upload does not repoint existing images. Put the custom domain in
  place first — which is why `launch:check` fails `*.r2.dev`.
- **Uploaded images bill on Vercel image optimization (VEN-456).** Neon Object
  Storage has no CDN, so every upload is served through `/_next/image`, whose
  cache is the CDN. Cost is one source image and one transformation per upload
  (one width each — `optimizedImageProps` asks for a single URL, and
  `images.qualities` is pinned so a request cannot multiply variants), plus cache
  reads per view. **Read the plan's included source-image and transformation
  quota off the Vercel dashboard (Usage → Image Optimization) and write it here
  before launch; it is not knowable from the repo.** Watch it on VEN-443's caps.
- **The rate limiter is in memory, per instance.** `@fastify/rate-limit` in
  `apps/api/src/server.ts` keeps its counters in each process, so N replicas
  allow N × `RATE_LIMIT_MAX`. Correct on a bounded replica count.
