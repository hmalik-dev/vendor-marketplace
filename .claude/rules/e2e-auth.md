---
paths:
  - 'scripts/e2e-auth.mjs'
  - '.claude/agents/*.md'
  - 'apps/web/src/app/sign-in/**'
  - 'apps/web/src/app/sign-up/**'
---

# Browser agents never type a password

**Sign in once, reuse the session.** `pnpm e2e:auth` signs in as **all three** E2E
accounts and writes Playwright storage state to `.auth/customer.json`,
`.auth/vendor.json` and `.auth/admin.json`. Every browser agent loads that
instead of authenticating:

```js
const context = await browser.newContext({ storageState: '.auth/vendor.json' });
```

**Why this exists.** Before it, every pass had to get a password out of
`.env.e2e.local` and into a page. Each route for doing that was blocked or left
the secret in a transcript — on 2026-08-29 an agent tried a loopback relay,
`pbcopy`, a helper copied into the Playwright root, and a `file://` read, then
gave up and signed up a throwaway account instead. With stored state the
credential is never handled at all.

## The accounts

Customer and vendor are **Neon Auth** identities on the `dev` branch
(`br-silent-queen-ax78ksii`), created once with a verified address, so signing in
is an email and a password: no challenge, no code, no inbox. A third persistent
account, `E2E_NEWCOMER_EMAIL`, has **no `users` row** and must never accept the
Terms — it is the no-row persona (`e2e/no-row-account.ts`). The admin account
is the fourth, `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`: an identity like the
others, but the one that `db:seed:e2e` gives `users.role = 'admin'` — the role
is never reachable by signing up. `db:seed:e2e` resolves its id by signing in
as it, exactly as it does the customer and vendor, so all three roles come from
one mechanism. **Never close it**: closing an account deletes its Neon Auth
identity, the seed resolves ids and cannot rebuild one, and `/admin` is then
unreachable until a person recreates it. The admin-closure spec closes a
disposable `seed_e2e_…` admin row instead.

## Rules

- **`.auth/` is gitignored and must stay so** — those files are live session
  cookies. A committed one is a credential leak; rotate the account if it happens.
  Since #392 the secret scanner bans the path too, because an ignore rule stops
  an accidental `git add` and not a deliberate `git add -f`, and no content rule
  reaches a JWT filed under `"value"`.
- **Never print a credential**, and never write one into a scratchpad file. If a
  session is expired or invalid, re-run `pnpm e2e:auth` — do not fall back to
  typing a password. The session cookie is httpOnly and lasts days; the 15-minute
  bearer JWT is minted from it on demand by `/api/session/token`, so a stored
  state does not "age out" between a warm-up and a check.
- **Sessions expire.** A pass that lands on `/sign-in` should re-run
  `pnpm e2e:auth` once and retry, then report the failure rather than working
  around it.
- **Every role, or none.** The default list omitted `admin` until #392 — it
  predated the persistent admin account (D27) — so a no-argument refresh renewed
  two of three sessions and left `.auth/admin.json` stale in every lane that
  copied it. `scripts/e2e-auth.test.mjs` now pins the list to the roles
  `db:seed:e2e` provisions, so a role added to the seed cannot be left out of the
  refresh. A role whose credentials are absent is **skipped and logged**, not
  failed — `E2E_ADMIN_EMAIL` is optional in the seed — unless you named that role
  on argv, which is asking for it by name. So a lane whose `.worktreeinclude`
  snapshot of `.env.e2e.local` predates the admin key gets **exit 0 and a stale
  `.auth/admin.json`**: read the per-role lines, not the exit code. `skipped` on
  a role you need means the env copy has drifted — recopy it and re-run.
- **Off localhost there is no default.** `resolveBaseUrl` puts `E2E_BASE_URL` at
  the top of its chain precisely so a run can be aimed at a deployed origin, and
  `docs/pre-launch.md` records that production still authenticates against the
  **same Neon Auth branch** — so the E2E passwords work there and
  `admin` carries authority over the real console. `pnpm e2e:auth` therefore
  refuses to choose roles for a non-loopback origin and makes you name them
  (`scripts/e2e-roles.mjs`). Signing in against a deployment stays possible; it
  just cannot be something a default did on your behalf. The refusal is
  **exit 1 before any browser launches** and prints what to type instead — it is
  not a failed sign-in, so do not retry it or regenerate storage state.
- **Do not create throwaway accounts** to get past auth. It pollutes the database
  and consumes fixtures the next pass depends on.

## First-paint auth chrome

The header's signed-in cluster is rendered on the server from the session
cookie, so a restored `storageState` is right on the very first navigation and
needs no warm-up. (Under the auth provider it did — a handshake made the first render read
signed-out, #321; that class is gone with the provider.) If a header reads
signed-out for a stored state, the cookie is expired or on the wrong port:
regenerate it with `pnpm e2e:auth <role>`.

# A signed-in account is not yet a usable one

`pnpm e2e:auth` gets you a session. It does **not** get you a vendor who can be
verified: signing in creates a `users` row and nothing else, because
`vendor_profiles` is only ever written by `POST /vendor/profile`. So the vendor
account lands on an empty profile form and **every** `/vendor` route redirects
there — which reads exactly like the ticket under test being broken.

**`pnpm db:seed:e2e` is the other half.** It gives the E2E vendor a published
storefront, one package, one live booking request, and `stripe_onboarded`, so
`accept` is not refused with a 402. `lane:up` runs it for every lane, and
`pnpm preflight` fails — not warns — when the accounts cannot reach their
surfaces, so a pass should never begin against a database that cannot answer.

If a browser pass finds every vendor route redirecting to `/vendor/profile/edit`,
that is this, not the ticket. Run `pnpm lane:exec <n> -- pnpm db:seed:e2e` and
re-check rather than reporting the feature broken.

It needs `NEON_AUTH_BASE_URL` for the same Neon Auth branch the accounts live
on: it resolves their **real** Neon user ids by signing in as them rather than
inventing them. A `users` row carrying an E2E email under a made-up id makes that
account's next sign-in collide on the email unique index, and the account can no
longer sign in at all.
