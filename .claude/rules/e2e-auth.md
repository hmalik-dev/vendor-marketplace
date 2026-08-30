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

## First-paint auth chrome cannot be asserted from a restored context

**#321, confirmed.** The `__session` cookie `storageState` captures is a
short-lived Clerk session JWT, minted at the moment `pnpm e2e:auth` runs. By
the time a later pass restores `.auth/*.json`, that token has typically aged
past its TTL — this is a **timing** defect, not a missing-cookie one; the
cookie is present, just too old to use without a refresh. A development Clerk
instance has no first-party cookie domain shared with the app (its Frontend
API lives on a separate `*.accounts.dev` host), so it cannot refresh an
expired `__session` silently on the server: the browser has to round-trip
through `/v1/client/handshake` and an `__clerk_handshake` callback leg before
the app's own document reflects the real session. **Until that settles, the
server's very first render for the load reads signed-out** — the header
cluster, the `Vendor` role chip, `Show when="signed-in"` sections, all of it —
even though the account is genuinely signed in. A real in-context sign-in
never shows this: the token is minted at the moment of use, nowhere near its
TTL, so the very first render resolves correctly with **zero** handshake hops.

Measured, unnamed, twice before this was diagnosed (lanes 153 and 215 — see
`.claude/agent-memory/browser-verifier/`), then measured and named on lane 313.
It is the entire cause of **#259**, which was filed as a product defect and
closed as not reproducible, superseded by this ticket (#321).

**The rule this becomes:** never assert first-paint auth chrome — anything
Clerk's own control components render (`<Show>`, `<UserButton>`, the signed-in
vs signed-out branches in `site-header.tsx`) — from the very first navigation
after loading a restored `storageState`. Instead:

1. Load the storage state and navigate once as a **throwaway warm-up**. Discard
   whatever that render shows.
2. Navigate again (or reload). **Only this render, and everything after it in
   the same context, is evidence.** The ticket's own measurement showed a
   second navigation always resolves correctly.
3. If the header still reads signed-out after the warm-up, that is a real
   finding, not this ticket — reload once more, and if it still does not
   clear, treat the storage state as stale and regenerate it
   (`pnpm e2e:auth <role>`) before continuing.

What is **still safe** to assert on the very first navigation: anything not
rendered by Clerk's control components — a server-side `requireRole` redirect
(reads the local `users.role` column directly, unaffected by this), the page
body behind an already-resolved layout, URL and status-code behaviour.

`scripts/e2e-handshake.mjs` is the mechanical version of this check —
`countHandshakeHops` / `handshakeVerdict` turn an observed navigation's
document-request URLs into exactly the zero-vs-nonzero read this rule asks
for, so "warm" does not have to be eyeballed from a screenshot.

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
