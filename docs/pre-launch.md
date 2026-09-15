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

**Current state:** not launched. The deployment authenticates against a Clerk
**development** instance and Stripe is in **test mode**, so `launch:check` fails
on both today — correctly. `docs/demo.md` describes the showcase deployment,
which is not a launch; `docs/credentials.md` is the credential runbook.

---

## What `launch:check` covers

| Group       | Check                                                                     | Passes when                                                                                                                                                                                                                             |
| ----------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clerk       | `clerk key`                                                               | `CLERK_SECRET_KEY` is `sk_live_`                                                                                                                                                                                                        |
| Clerk       | `clerk instance`                                                          | the Backend API reports `environment_type: production`                                                                                                                                                                                  |
| Clerk       | `clerk webhook endpoint`                                                  | `CLERK_WEBHOOK_ENDPOINT` is `API_URL/webhooks/clerk` — Clerk has no read API for its webhook endpoints, so this is the declared value the API refuses to boot without                                                                   |
| Clerk       | `clerk self-serve deletion`                                               | the instance's `delete_self` is off (`MANUAL` when the instance settings cannot be read)                                                                                                                                                |
| Stripe      | `stripe key`                                                              | `STRIPE_SECRET_KEY` is `sk_live_`                                                                                                                                                                                                       |
| Stripe      | `stripe webhook endpoint`                                                 | exactly one enabled endpoint at `API_URL/webhooks/stripe` (the API verifies one signing secret) subscribes to every type in `HANDLED_STRIPE_EVENT_TYPES` (`apps/api/src/modules/webhooks/stripe.routes.ts`); the missing ones are named |
| Stripe      | `stripe connected-account events`                                         | `MANUAL`: the endpoint list does not say whether an endpoint listens to connected accounts, and vendor `account.updated` arrives only if it does                                                                                        |
| Stripe      | `charges_enabled`, `payouts_enabled`                                      | both `true` on the platform account                                                                                                                                                                                                     |
| Stripe      | `stripe statement descriptor`                                             | set, at least 5 characters, not a placeholder — nothing in `apps/api` sets one, so it is configured in the Dashboard                                                                                                                    |
| Stripe      | `stripe business name`                                                    | equals `BRAND_NAME`                                                                                                                                                                                                                     |
| Resend      | `resend sending domain`                                                   | the domain of `EMAIL_FROM` is `verified` (`MANUAL` when a sending-only key cannot list domains)                                                                                                                                         |
| Storage     | `S3_PUBLIC_URL`                                                           | a custom domain, not `*.r2.dev` or a local address                                                                                                                                                                                      |
| Database    | `database branch`                                                         | `DATABASE_URL` is a Neon endpoint and `NEON_BRANCH` is `production`                                                                                                                                                                     |
| Database    | `seeded rows`                                                             | zero rows carry the marketing, demo or E2E seed markers — fabricated vendors and reviews on a public production site are misrepresentation                                                                                              |
| Database    | `migrations`                                                              | every migration in the repository journal is applied                                                                                                                                                                                    |
| Environment | `SENTRY_DSN`, `OPERATOR_ALERT_EMAIL`, `SUPPORT_EMAIL_TO`                  | set, not the registry placeholder, and matching the production shape                                                                                                                                                                    |
| Environment | `RATE_LIMIT_MAX`                                                          | between 30 and 1000 requests per minute per IP                                                                                                                                                                                          |
| App         | `api /ready`                                                              | `API_URL/ready` answers 200 (database and storage both up)                                                                                                                                                                              |
| App         | `web security headers`                                                    | a real response from `WEB_URL` carries HSTS, an enforcing CSP, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`                                                                                                        |
| App         | `platform_settings.vendorInviteOnly`, `platform_settings.maxBookingCents` | `SKIP` until VEN-406 and VEN-404 land; a closed beta needs invite-only on and a booking cap set                                                                                                                                         |

---

## What only a person can do

- [ ] **Legal wording** (VEN-378). The terms, privacy and cookie pages exist, but
      their wording is placeholder nobody has relied on. A lawyer reads them —
      above all the staff-message-access clause under _Who else sees it_ in the
      privacy policy, the one paragraph asserting that staff can read a user's
      private messages — and the legal entity and a monitored support
      destination are named.
- [ ] **Provider accounts** (VEN-377): the Clerk production instance on the real
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
- [ ] **Restore drill.** Nightly encrypted off-platform backups exist (VEN-408);
      run the drill in `docs/runbook-restore.md` against the production backups
      once before launch, not only by reading the workflow.
- [ ] **Rotate every credential touched during setup** (`docs/credentials.md`).

## Known limits to revisit before scaling out

- **Image URLs are stored absolute.** `apps/api/src/lib/storage.ts` writes
  `publicUrlFor(S3_PUBLIC_URL, key)` into rows, so changing `S3_PUBLIC_URL` after
  vendors upload does not repoint existing images. Put the custom domain in
  place first — which is why `launch:check` fails `*.r2.dev`.
- **The rate limiter is in memory, per instance.** `@fastify/rate-limit` in
  `apps/api/src/server.ts` keeps its counters in each process, so N replicas
  allow N × `RATE_LIMIT_MAX`. Correct on a bounded replica count.
