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
