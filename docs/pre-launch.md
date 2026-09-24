# Pre-launch — what must be true before real users and real money

**The gate is a command, not this page:**

```sh
pnpm launch:check
```

It reads the production values from `.env.production.local` (gitignored; real
process environment variables win over it), asks each provider what is actually
configured, and prints one line per item: `PASS`, `FAIL` or `MANUAL` (no provider API can answer). It exits
non-zero while anything is `FAIL`. It is read-only — every provider call is a
`GET`, the database session is `READ ONLY` — and it prints no secret beyond its
prefix and last four characters. It needs production credentials, so it is run
by the operator before a release and never in CI.

Launch readiness is a run with no `FAIL`, every `MANUAL` line confirmed by hand,
and every item below done.

**Current state:** not launched. The deployment authenticates against a Neon Auth
**development** branch and Stripe is in **test mode**, so `launch:check` fails
on both today — correctly.

---

## What `launch:check` covers

| Group       | Check                                                    | Passes when                                                                                                                                                                                                                                                                                                                               |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon Auth   | `neon auth endpoint`                                     | `NEON_AUTH_BASE_URL` serves a JWKS with at least one signing key                                                                                                                                                                                                                                                                          |
| Neon Auth   | `neon auth identity store`                               | `NEON_AUTH_DATABASE_URL` names the same database host as `DATABASE_URL` — a source on another branch answers empty and the reconcile pass refuses to run                                                                                                                                                                                  |
| Stripe      | `stripe key`                                             | `STRIPE_SECRET_KEY` is `sk_live_`                                                                                                                                                                                                                                                                                                         |
| Stripe      | `stripe publishable key`                                 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` is `pk_live_` — checkout confirms an intent made with the secret key, and keys from different modes fail with "No such payment_intent"                                                                                                                                                               |
| Stripe      | `stripe webhook endpoint`                                | one enabled endpoint at `API_URL/webhooks/stripe` per configured signing secret (`STRIPE_WEBHOOK_SECRET`, plus `STRIPE_CONNECT_WEBHOOK_SECRET` for the connected-account endpoint) subscribes, between them, to every type in `HANDLED_STRIPE_EVENT_TYPES` (`apps/api/src/modules/webhooks/stripe.routes.ts`); the missing ones are named |
| Stripe      | `stripe connected-account events`                        | `PASS` once `STRIPE_CONNECT_WEBHOOK_SECRET` is set and the second endpoint exists; otherwise `MANUAL`: the endpoint list does not say which endpoint listens to connected accounts, and vendor `account.updated` arrives only there                                                                                                       |
| Stripe      | `charges_enabled`, `payouts_enabled`                     | both `true` on the platform account                                                                                                                                                                                                                                                                                                       |
| Stripe      | `stripe statement descriptor`                            | set, at least 5 characters, not a placeholder — nothing in `apps/api` sets one, so it is configured in the Dashboard                                                                                                                                                                                                                      |
| Stripe      | `stripe business name`                                   | equals `BRAND_NAME`                                                                                                                                                                                                                                                                                                                       |
| Stripe      | `stripe payout schedule`                                 | the platform account's `settings.payouts.schedule.interval` is `manual` — customers' payments wait in its balance until the vendor's share is transferred after the event, so an automatic payout spends vendors' money; commission goes out by hand (`docs/runbook-platform-balance.md`)                                                 |
| Resend      | `resend sending domain`                                  | the domain of `EMAIL_FROM` is `verified` (`MANUAL` when a sending-only key cannot list domains)                                                                                                                                                                                                                                           |
| Storage     | `STORAGE_PUBLIC_URL`                                     | a Neon Object Storage bucket URL, not a local address                                                                                                                                                                                                                                                                                     |
| Database    | `database branch`                                        | `DATABASE_URL` is a Neon endpoint and `NEON_BRANCH` is `production`                                                                                                                                                                                                                                                                       |
| Database    | `seeded rows`                                            | zero rows carry the marketing, demo or E2E seed markers — fabricated vendors and reviews on a public production site are misrepresentation                                                                                                                                                                                                |
| Database    | `migrations`                                             | every migration in the repository journal is applied                                                                                                                                                                                                                                                                                      |
| Environment | `SENTRY_DSN`, `OPERATOR_ALERT_EMAIL`, `SUPPORT_EMAIL_TO` | set, not the registry placeholder, and matching the production shape                                                                                                                                                                                                                                                                      |
| Environment | `RATE_LIMIT_MAX`                                         | between 30 and 1000 requests per minute per IP                                                                                                                                                                                                                                                                                            |
| App         | `api /ready`                                             | `API_URL/ready` answers 200 (database and storage both up)                                                                                                                                                                                                                                                                                |
| App         | `web security headers`                                   | a real response from `WEB_URL` carries HSTS, an enforcing CSP, `X-Content-Type-Options`, `X-Frame-Options` and `Referrer-Policy`                                                                                                                                                                                                          |
| Database    | `platform_settings.maxBookingCents`                      | set — a closed beta caps what one booking can charge (VEN-404, set in `/admin/settings`)                                                                                                                                                                                                                                                  |
| Database    | `platform_settings.vendorInviteOnly`                     | `true` — vendors join by invitation, so the initial vendors are curated (VEN-406, set in `/admin/settings`); `FAIL` while it is off or the settings row was never written                                                                                                                                                                 |

---

## Migration rehearsal

**Migration rehearsal (VEN-474, 2026-09-20).** Migrations 0010–0056 (47 files)
were first run on the Neon `dev` branch and then `staging`, over the unpooled
endpoint, so the production migrate in the deploy is the second run and not the
first. Both branches were empty of user rows and both held 0000–0009.

| Branch    | Started (UTC) | Duration | Lock waits                  | Result                                          |
| --------- | ------------- | -------- | --------------------------- | ----------------------------------------------- |
| `dev`     | 15:44:01      | 11 s     | none (one session, no rows) | 57 rows in `drizzle.__drizzle_migrations`       |
| `staging` | 15:44:17      | 13 s     | none (one session, no rows) | 57 rows; schema diff against a fresh 0056 empty |

- **The first attempt failed, and would have failed on production.** `0015` adds
  `'style'` to `tag_category` and `0016` compared against it; drizzle applies
  every pending migration in one transaction, where Postgres refuses to use an
  enum value it has just added (`55P04`). `0016` now compares `category::text`,
  and a test replays 0015–0017 in one transaction. The failed run rolled back and
  left the branch at 10 rows.
- After the run, `staging` has `users.auth_user_id` and `users_auth_user_id_key`
  and no pre-rename auth id column or its unique key; tables, columns,
  constraints, indexes, enums and triggers match a database built from the
  journal (27 tables, 273 columns, 249 constraints, 91 indexes, 179 enum labels,
  6 triggers).
- The reference seed ran on `staging` (10 categories, 43 tags, 35,618 US cities),
  and the API built from this tree and started against it answered `/ready` 200
  with `database` and `storage` up and `commit` set to the commit it ran.
- **Empty tables prove the DDL, not the data steps.** Production is empty too
  today; if a real row exists by cutover, the destructive statements in 0003,
  0008, 0010, 0016 and 0017 (VEN-463) run against it. Take the Neon snapshot
  first (VEN-408).

## What only a person can do

- [ ] **Release build secrets** (VEN-575). Add the GitHub environment secrets
      `WEB_TIER_KEY` and `NEON_AUTH_COOKIE_SECRET` to both `staging` and
      `production` (on each environment, never at repository or organization
      level), with the same values as the runtime ones. Vercel Secret
      variables are unreadable to `vercel pull`, so the release build cannot
      see them otherwise, and preflight fails by name without them. On
      rotation, change all three places: Vercel, Railway (`WEB_TIER_KEY`) and
      GitHub.
- [ ] **A web tier key per environment** (VEN-649). `WEB_TIER_KEY` must
      differ between `staging` and `production`: a staging key that also works
      on production lets whoever reads it choose the address production's rate
      limiter counts. If both were set from one `openssl rand -hex 32`, generate
      a new one for production and set it in all three places (Vercel, Railway,
      the `production` GitHub environment secret) in one sitting; a mismatch
      between the API and web now reports to Sentry.
- [ ] **Neon Auth self-service account changes** (VEN-649). In the Neon
      console, confirm the auth branch does not let a signed-in user call
      `delete-user` or `change-email` directly. The web proxy refuses both
      (`proxy-allowlist.ts`), but a call made straight to the Neon Auth URL
      never passes the proxy; a deletion there is only caught by the daily
      reconcile, and an email change there bypasses the lowercase rule until
      the reconcile mirrors it.
- [ ] **Release sender check** (VEN-609). On both `staging` and `production`,
      add the variable `EMAIL_FROM` (the same value Railway's API has) and
      the secret `RESEND_API_KEY`, a full-access Resend key so it can list
      domains. Resend has no read-only scope, so this key can send, read
      sent mail and mint keys: create one per environment, used nowhere
      else, and note that on a Resend team both tiers share, staging's key
      reaches production's mail too. Every release fails at the sender step until Resend reports
      that domain `verified`. The deployed API also refuses to boot without
      its own `EMAIL_FROM` now; the `orla.com` default is not ours.
      Exception for the friends beta (VEN-626): `EMAIL_FROM=onboarding@resend.dev`,
      Resend's shared test sender, passes this step with no domain of our
      own — mail then reaches only the Resend account owner. It is not an
      option once real users are on the platform (VEN-595); buy and verify a
      domain first (VEN-563).
- [ ] **Legal wording** (VEN-378). The terms, privacy and cookie pages exist, but
      their wording is placeholder nobody has relied on. A lawyer reads them —
      above all the staff-message-access clause (#436) under _Who else sees it_
      in the privacy policy, the one paragraph asserting that staff can read a
      user's private messages — and the legal entity and a monitored support
      destination are named.
- [ ] **Provider accounts** (VEN-377): the Neon Auth production branch on the real
      domain, the live Stripe Connect platform, the Resend domain's DNS, and the **Neon upgrade from
      Free to Launch** — on Free, `production` has a 6-hour history window, no
      branch protection and a storage cap whose breach makes writes fail. After
      the upgrade: protect the `production` branch and widen its history
      retention.
- [ ] **Production admin account** (VEN-502): sign up on production, then grant
      the role with the transaction under _First operator grant_ below. A plain
      `UPDATE users SET role` is refused by the database (VEN-533).
- [ ] **Image licensing.** Confirm the licence of every shipped marketing image
      and the landing-page category photography.
- [ ] **A real end-to-end transaction** on live keys before opening to customers:
      book, pay, message, cancel with a refund, and see the payout arrive.
- [ ] **Row level security** (VEN-504). `launch:check` does not read it: after the deploy migrates, confirm no public base table has `relrowsecurity = false`, with the query in `docs/schema-review.md`.
- [ ] **Restore drill.** Backups are Neon-native only (VEN-408): the
      `production` branch needs its snapshot schedule on (paid plan, VEN-443; read
      it back), and the
      drill in `docs/runbook-restore.md` must run once into a scratch branch.
      Loss of the Neon account is an accepted, unprotected risk.
- [ ] **Rollback drill.** Read [runbook-rollback.md](runbook-rollback.md) and
      confirm you can promote the previous Vercel deployment and redeploy the API
      host's previous image before the first real release.
- [ ] **Rotate every credential touched during setup**.

### First operator grant

Once, from a `psql` session on the owner URL (`DATABASE_URL_UNPOOLED`, read from
your env, never pasted), after the account has signed up. Run exactly this, with
the sign-up address:

```sql
BEGIN;
SET LOCAL app.operator_role_grant = 'on';
UPDATE users SET role = 'admin' WHERE email = '<the address you signed up with>' AND deleted_at IS NULL;
COMMIT;
```

It must report `UPDATE 1`; roll back on anything else. The setting is
transaction-local and reserved for this step and the in-app operator grant
(VEN-506): nothing else sets it, and the fixture seeds never do.

**This is the single pre-launch exception, not a routine.** Every later operator
is granted and revoked in the console at `/admin/operators` (step-up, audit row,
never the last live operator). An operator created by the transaction above has
no recorded earlier role, so the console will not revoke them: that is
deliberate, and it is why the first operator is the founder who keeps the
account.

## Scheduled-job monitors (VEN-671)

Every in-process sweep checks in to a Sentry Cron Monitor through `runTick`
(`apps/api/src/lib/sweep.ts`), which also abandons a tick that outlives its
deadline and reports it. The monitors create themselves on the first check-in
from each environment, with the schedule and margin the code sends. Beside the
alert rules of VEN-567, route each monitor's **missed** and **failed** issues to
the same alert as an API error, and alert on `payout-release` first: a stopped
payout sweep means vendors are not paid.

| Monitor slug       | Job                                         | Runs every | Deadline |
| ------------------ | ------------------------------------------- | ---------- | -------- |
| `payout-release`   | vendor payout release                       | 15 min     | 10 min   |
| `expiry-sweep`     | booking request expiry, stream tickets      | 5 min      | 4 min    |
| `email-retry`      | failed email retry                          | 5 min      | 4 min    |
| `auth-reconcile`   | Neon Auth account reconcile                 | 24 h       | 60 min   |
| `platform-balance` | platform balance reconcile                  | 24 h       | 30 min   |
| `upload-sweep`     | orphaned upload sweep                       | 60 min     | 30 min   |
| `admin-digest`     | poll for the daily digest (sends every day) | 5 min      | 4 min    |

The daily digest is sent on quiet days too, so **no digest email by mid-morning
is itself an alarm**: the API is down or its timers have stopped. It also
reports how many payouts were due more than one sweep interval ago and are still
unreleased.

`/ready` reports `rowLevelSecurity` and, on staging and production, answers 503
with a `reason` while the API's `DATABASE_URL` is a role that owns the tables or
has `BYPASSRLS` (see [app-api-role.md](app-api-role.md)); the release's smoke
check prints that reason. Object storage is reported in the body but does not
gate readiness.

## Deploy constraints

**The API runs as exactly one replica** (`railway.json` sets
`deploy.numReplicas: 1`, and `apps/api/src/config/railway.test.ts` fails if it
does not). Above one, these break, because each keeps its state in one process:

- **Stream tickets** (`apps/api/src/lib/stream-tickets.ts`) are issued and
  redeemed in memory, so a ticket minted by one replica is unknown to the other
  and the live stream refuses it.
- **Rate-limit counters** are per process (see below).

The payout and expiry timers also run in every process. Their row locks keep an
overlap correct, and the in-process guard only stops ticks piling up, so a second
replica does duplicated work rather than wrong work; it is not a reason on its own
to pin one.

The web sign-in throttle (`apps/web/src/lib/auth/proxy-throttle.ts`) is not on
this list because `railway.json` cannot bound it: it counts per Vercel function
instance, so its budget is multiplied by instance count by design and is a floor,
not a limit.

**One replica is not the whole constraint.** A rolling deploy starts the new
container before it stops the old one, so two containers overlap for the length
of the release whatever `numReplicas` says. Each of them is
therefore briefly split at each deploy; a ticket or a counter lost to it is
expected, and the payout and expiry sweeps must stay safe to run twice.

Lifting this is VEN-462, and the same pull request removes the constraint.
Rolling back is in [runbook-rollback.md](runbook-rollback.md).

## Known limits to revisit before scaling out

- **Image URLs are stored absolute.** `apps/api/src/lib/storage.ts` writes
  `publicUrlFor(STORAGE_PUBLIC_URL, key)` into rows, so changing `STORAGE_PUBLIC_URL` after
  vendors upload does not repoint existing images. Set the Neon bucket URL
  before the first real upload — which is why `launch:check` fails a legacy
  object-storage host.
- **Uploaded images bill on Vercel image optimization (VEN-456).** Neon Object
  Storage has no CDN, so every upload is served through `/_next/image`, whose
  cache is the CDN. Cost is one source image and one transformation per upload
  (one width each — `optimizedImageProps` asks for a single URL, and
  `images.qualities` is pinned so a request cannot multiply variants), plus cache
  reads per view. **Read the plan's included source-image and transformation
  quota off the Vercel dashboard (Usage → Image Optimization) and write it here
  before launch; it is not knowable from the repo.** Watch it on VEN-443's caps.
  The optimizer accepts nine widths (64-2400, `DEVICE_SIZES` and `IMAGE_SIZES` in
  `apps/web/src/config/image-optimizer.ts`) and only the four upload prefixes, so
  one stored URL can force at most nine transformations. Usage is read at Vercel
  → Usage → Image Optimization; alert at 80% of the plan's included
  transformations (VEN-486).
- **The rate limiter is in memory, per instance.** `@fastify/rate-limit` in
  `apps/api/src/server.ts` keeps its counters in each process, so N replicas
  allow N × `RATE_LIMIT_MAX`. Correct on a bounded replica count.
