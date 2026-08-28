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
Low risk today (empty bucket, Clerk development instance, no real users, no
money) but they must not survive to launch.

| Credential             | How it was exposed       | Action                                                           |
| ---------------------- | ------------------------ | ---------------------------------------------------------------- |
| `S3_ACCESS_KEY_ID`     | Pasted in chat           | Rotate — §4.3                                                    |
| `S3_SECRET_ACCESS_KEY` | Pasted in chat           | Rotate — §4.3                                                    |
| `CLERK_WEBHOOK_SECRET` | Pasted in chat           | Rotate — §4.2. Moot if the Clerk production instance replaces it |
| Svix dashboard URL     | Printed by the assistant | Self-expiring one-time token; no action, do not re-share         |

**Not exposed, for the record.** These were handled without ever being printed:
`DATABASE_URL` and `DATABASE_URL_UNPOOLED` (piped from the Neon CLI straight
into Railway by you; every display was masked), and `CLERK_SECRET_KEY` (pulled
by the Clerk CLI and piped into Railway by you — never printed, never read by
the assistant, which only verified its length and that it was not a
placeholder).

---

## 2. Why some of this needed you and not the assistant

The agent sandbox refuses to read a credential from one place and write it to
another. That is why `DATABASE_URL` and `CLERK_SECRET_KEY` came back to you as
commands to run rather than actions taken.

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
| `CLERK_SECRET_KEY`                            | Clerk                      | Railway, Vercel web | Yes                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`           | Clerk                      | Vercel web          | No (public)             |
| `CLERK_WEBHOOK_SECRET`                        | Clerk → Svix endpoint      | Railway             | Yes                     |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`   | Cloudflare R2 API token    | Railway             | Yes                     |
| `S3_ENDPOINT` / `S3_BUCKET` / `S3_PUBLIC_URL` | Cloudflare R2              | Railway             | No                      |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe                     | Railway             | Yes                     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`          | Stripe                     | Vercel web          | No (public)             |
| `RESEND_API_KEY`                              | Resend                     | Railway             | Yes                     |
| `SENTRY_DSN`                                  | Sentry                     | Railway, Vercel web | Low — write-only ingest |

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

### 4.2 Clerk — secret key and webhook secret

```bash
clerk env pull --app app_3ISNDGyof237HdYg2FndWSK8uTx --file /tmp/.ck.env >/dev/null
railway variables --service vendor-marketplace \
  --set "CLERK_SECRET_KEY=$(grep '^CLERK_SECRET_KEY=' /tmp/.ck.env | cut -d= -f2- | tr -d '"')"
rm /tmp/.ck.env
```

The **webhook** secret is not in the Clerk API — it belongs to the Svix
endpoint. Get a fresh dashboard link with:

```bash
clerk api /webhooks/svix_url -X POST --yes
```

Then rotate the endpoint's signing secret there and set
`CLERK_WEBHOOK_SECRET` on Railway to match.

**Always verify the instance matches.** A `sk_` from one instance and a `pk_`
from another fails every token verification with an unhelpful error. Production
web currently runs `stirred-flea-3295.clerk.accounts.dev` — decode the
publishable key to confirm before swapping either half.

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
 printf '%s' "$V" | vercel env add CLERK_SECRET_KEY production
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

| Rotated          | Verify by                                                      |
| ---------------- | -------------------------------------------------------------- |
| Database         | `/ready` shows `database: up`, and a real read returns rows    |
| R2               | `/ready` shows `storage: up`, then upload an image and load it |
| Clerk secret key | Sign in, and hit an authenticated endpoint                     |
| Clerk webhook    | Trigger a `user.updated` and confirm the local row changes     |
| Stripe           | A test payment, capture and refund                             |
| Resend           | A real send, checked in the inbox — not the spam folder        |

If the project's credential scan ever fires on a committed value, **rotate it
rather than only deleting the line.** The commit is still in history, and on a
pushed branch it is public. The rules live in
`packages/preflight/src/secrets/`.
