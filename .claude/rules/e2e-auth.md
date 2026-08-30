---
paths:
  - 'scripts/e2e-auth.mjs'
  - '.claude/agents/*.md'
  - 'apps/web/src/app/sign-in/**'
  - 'apps/web/src/app/sign-up/**'
---

# Browser agents never type a password

**Sign in once, reuse the session.** `pnpm e2e:auth` signs in as both E2E accounts
and writes Playwright storage state to `.auth/customer.json` and
`.auth/vendor.json`. Every browser agent loads that instead of authenticating:

```js
const context = await browser.newContext({ storageState: '.auth/vendor.json' });
```

**Why this exists.** Before it, every pass had to get a password out of
`.env.e2e.local` and into a page. Each route for doing that was blocked or left
the secret in a transcript — on 2026-08-29 an agent tried a loopback relay,
`pbcopy`, a helper copied into the Playwright root, and a `file://` read, then
gave up and signed up a throwaway account instead. With stored state the
credential is never handled at all.

## The new-device challenge

Clerk challenges every new browser: `/sign-in/client-trust`, _"You're signing in
from a new device."_ Both accounts are **`+clerk_test` addresses on a development
instance**, so the code is always **`424242`** and no real email is sent — that is
Clerk's documented test mode, not a workaround.

Two mechanics the script had to learn, worth keeping:

- The OTP is a **segmented input**. `fill()` does not register and
  `inputValue()` reports nothing — type it with `pressSequentially`.
- It **submits itself on the sixth digit**. Waiting for a `Continue` button
  times out.

## Rules

- **`.auth/` is gitignored and must stay so** — those files are live session
  cookies. A committed one is a credential leak; rotate the account if it happens.
- **Never print a credential**, and never write one into a scratchpad file. If a
  session is expired or invalid, re-run `pnpm e2e:auth` — do not fall back to
  typing a password.
- **Sessions expire.** A pass that lands on `/sign-in` should re-run
  `pnpm e2e:auth` once and retry, then report the failure rather than working
  around it.
- **Do not create throwaway accounts** to get past auth. It pollutes the database
  and consumes fixtures the next pass depends on.

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

It needs `CLERK_SECRET_KEY` for the same Clerk instance the accounts live in: it
resolves their **real** Clerk ids rather than inventing them. A `users` row
carrying an E2E email under a made-up id makes that account's next sign-in
collide on the email unique index, and the account can no longer sign in at all.
