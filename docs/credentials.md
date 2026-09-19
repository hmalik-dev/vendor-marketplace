# Credentials — inventory, rotation, and how to set them without handing them over

Companion to `docs/pre-launch.md`. That file is the launch gate; this one is the
credential runbook.

**The rule worth keeping: never paste a secret into a chat, a ticket, a commit
message or an issue.** Not because any one reader is untrustworthy, but because
a transcript is a copy you no longer control — it is stored, scrollable, and
outlives the moment. Every credential this project needs can be set without a
secret ever appearing in conversation, and §5 gives the exact command for each.

---

## 1. Currently exposed — rotate these

Pasted into a chat transcript on **2026-08-27** while provisioning Railway.
Low risk today (empty bucket, development instances, no real users, no
money) but they must not survive to launch.

| Credential                  | How it was exposed       | Action                                                                        |
| --------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `S3_ACCESS_KEY_ID`          | Pasted in chat           | Rotate — §4.3                                                                 |
| `S3_SECRET_ACCESS_KEY`      | Pasted in chat           | Rotate — §4.3                                                                 |
| Retired auth webhook secret | Pasted in chat           | None — the variable and its endpoint went with the retired provider (VEN-448) |
| Webhook dashboard URL       | Printed by the assistant | Self-expiring one-time token; no action, do not re-share                      |

**Not exposed, for the record.** These were handled without ever being printed:
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` (piped from the Neon CLI straight
into Railway by you; every display was masked). The retired auth provider's key was
handled the same way and went with that provider (VEN-448).

---

## 2. Why some of this needed you and not the assistant

The agent sandbox refuses to read a credential from one place and write it to
another. That is why `DATABASE_URL` came back to you as a command to run rather than actions taken.

Treat that as the normal path, not an obstacle. The practical consequence:
**anything shaped like "move this secret from A to B" is yours to run.** The
assistant can still do everything around it — find which value is wrong, work
out where the real one lives, write the exact command, and verify the result
afterwards — none of which requires seeing the value.

---

## 3. Inventory

| Variable                                      | System of record           | Lives in            | Secret?                 |
| --------------------------------------------- | -------------------------- | ------------------- | ----------------------- |
| `DATABASE_URL` / `_UNPOOLED`                  | Neon (`production` branch) | Railway             | Yes                     |
| `NEON_AUTH_BASE_URL`                          | Neon Auth (branch)         | Railway, Vercel web | No (an endpoint)        |
| `NEON_AUTH_COOKIE_SECRET`                     | `openssl rand -base64 32`  | Vercel web          | Yes                     |
| `NEON_AUTH_DATABASE_URL`                      | Neon (the branch's DB)     | Railway             | Yes                     |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`   | Cloudflare R2 API token    | Railway             | Yes                     |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_PUBLIC_URL` | Cloudflare R2              | Railway             | No                      |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe                     | Railway             | Yes                     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`          | Stripe                     | Vercel web          | No (public)             |
| `RESEND_API_KEY`                              | Resend                     | Railway             | Yes                     |
| `SENTRY_DSN`                                  | Sentry (API project)       | API host            | Low — write-only ingest |
| `NEXT_PUBLIC_SENTRY_DSN`                      | Sentry (web project)       | Vercel web          | No (public)             |
| `SENTRY_AUTH_TOKEN`                           | Sentry organization token  | GitHub secret       | Yes                     |
| `DATABASE_URL_UNPOOLED`                       | Neon (direct endpoint)     | GitHub secret       | Yes                     |
| `API_HOST_TOKEN` / `VERCEL_TOKEN`             | API host / Vercel          | GitHub secrets      | Yes                     |

The canonical list of variables is `packages/shared/src/env/registry.ts`.
`.env.example` and `turbo.json` are generated from it by `pnpm env:example` —
never edit `.env.example` by hand.

---

## 4. Rotation runbooks

Order matters: **create the new credential, set it, verify, then revoke the
old one.** Revoking first causes an outage.

### 4.1 Neon — `DATABASE_URL`

Rotate by resetting the role password in the Neon console (Roles → reset), then:

```bash
railway variables --service vendor-marketplace \
  --set "DATABASE_URL=$(neonctl connection-string production --project-id dark-surf-79137727 --database-name neondb --pooled)" \
  --set "DATABASE_URL_UNPOOLED=$(neonctl connection-string production --project-id dark-surf-79137727 --database-name neondb)"
```

Pooled for runtime, direct for migrations — `packages/db/src/migration-url.ts`
prefers the unpooled URL for DDL because Neon's PgBouncer is unreliable for
`CREATE SCHEMA`.

### 4.2 Neon Auth — identity store connection

`NEON_AUTH_DATABASE_URL` is the connection string of the database that holds
the branch's `neon_auth` schema: the reconcile pass (`pnpm reconcile:auth`)
reads identities over it, and an account closure deletes one. On a Neon
deployment it is the same database as `DATABASE_URL`. Name the branch
**positionally** — `neon connection-string --branch-id` ignores the branch and
answers for production:

```bash
railway variables --service vendor-marketplace \
  --set "NEON_AUTH_DATABASE_URL=$(neonctl connection-string production --project-id dark-surf-79137727)"
```

**Always verify the branch matches.** `NEON_AUTH_BASE_URL` and this connection
must name the same branch, or the reconcile pass sees none of your users and
refuses to run (it never retires anyone on an empty answer). `pnpm launch:check`
compares the two hosts. Neon Auth has no webhook secret: it sends no update or
delete events, so `pnpm reconcile:auth` is how a changed name and a deleted
identity reach the local row.

### 4.3 Cloudflare R2 — access key pair

R2 keys cannot be rotated in place; you create a new token and delete the old.

1. Cloudflare → R2 → **Manage R2 API Tokens** → create, **Object Read & Write**,
   scoped to `vendor-marketplace-uploads`. The secret is shown once.
2. Set both values on Railway (§5).
3. Redeploy and confirm `/ready` reports `storage: up`.
4. **Only then** delete the old token.

The account ID and bucket are not secrets:
`S3_ENDPOINT=https://dbcf2b1ac71a135a8191e3c9f84667a6.r2.cloudflarestorage.com`,
`S3_BUCKET=vendor-marketplace-uploads`.

### 4.4 Stripe, Resend, Sentry

All still placeholders; the first "rotation" is provisioning them.

- **Stripe** — roll the secret key in the dashboard; the webhook signing secret
  is per-endpoint and rolls separately. Test and live keys are different
  credentials, not different modes of one.
- **Resend** — API keys are create/delete, like R2. The **verified sending
  domain** matters more than the key: without SPF and DKIM, mail is delivered to
  spam and nothing in the app will tell you.
- **Sentry** — the DSN is write-only ingest, so a leak is low severity; rotate by
  creating a new client key and retiring the old.

---

## 5. Setting a secret without exposing it

Every form below keeps the value out of the transcript and out of shell history
(note the leading space in the `read` form, which most shells exclude from
history when `HIST_IGNORE_SPACE` / `HISTCONTROL=ignorespace` is set).

**Prompt for it, never type it as an argument:**

```bash
 read -rs -p "value: " V && railway variables --service vendor-marketplace --set "NAME=$V"; unset V
```

**Pipe it straight from its source** (best — the value never exists as text you
hold):

```bash
railway variables --service vendor-marketplace \
  --set "DATABASE_URL=$(neonctl connection-string production --project-id dark-surf-79137727 --pooled)"
```

**Vercel** takes the value on stdin:

```bash
 printf '%s' "$V" | vercel env add NEON_AUTH_COOKIE_SECRET production
```

Avoid: pasting into chat, committing to `.env` (git-ignored, but a hook and CI
both scan for it — `pnpm secrets:scan:all`), and putting a secret in a Railway
or Vercel **variable name**.

---

## 6. After any rotation

```bash
curl -s https://vendor-marketplace-production.up.railway.app/ready
```

Expect `{"status":"ready","database":"up","storage":"up"}`. `/ready` exercises
the database and storage credentials for real; `/health` does not, so it will
report healthy with a dead credential.

Then confirm the credential-specific path actually works:

| Rotated   | Verify by                                                                   |
| --------- | --------------------------------------------------------------------------- |
| Database  | `/ready` shows `database: up`, and a real read returns rows                 |
| R2        | `/ready` shows `storage: up`, then upload an image and load it              |
| Neon Auth | Sign in, hit an authenticated endpoint, run `pnpm reconcile:auth --dry-run` |
| Stripe    | A test payment, capture and refund                                          |
| Resend    | A real send, checked in the inbox — not the spam folder                     |

If the project's credential scan ever fires on a committed value, **rotate it
rather than only deleting the line.** The commit is still in history, and on a
pushed branch it is public. The rules live in
`packages/preflight/src/secrets/`.
