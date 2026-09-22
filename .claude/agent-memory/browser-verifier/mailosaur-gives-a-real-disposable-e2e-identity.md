---
name: mailosaur-gives-a-real-disposable-e2e-identity
description: pnpm e2e:mail-code + any <local>@<E2E_MAIL_SERVER>.mailosaur.net address lets a pass drive a genuinely fresh sign-up, avoiding the shared-newcomer-identity trap
metadata:
  type: project
---

`packages/db/src/scripts/e2e-mail-code.ts` / `pnpm e2e:mail-code <address>`
reads the six-digit code Neon Auth mails to **any** address of the form
`<local-part>@<E2E_MAIL_SERVER>.mailosaur.net` (a Mailosaur catch-all inbox),
gated on `DEPLOY_ENV=local` plus `E2E_MAIL_API_KEY`/`E2E_MAIL_SERVER` from
`.env.e2e.local`. Inventing a fresh local-part per pass (e.g.
`<ticket>-<random>@<server>.mailosaur.net`) gives a genuinely new Neon Auth
identity — supersedes
[[newcomer-identity-is-single-use-per-lane-pass]]'s workaround of reusing
`E2E_NEWCOMER_EMAIL` and running out of states to test.

**Why:** VEN-584/VEN-512 needed a truly fresh "sign up, enter the emailed
code" flow, which the persistent `E2E_NEWCOMER_EMAIL` identity cannot do (it
already exists in Neon Auth globally, so `POST /sign-up` 422s on it in every
lane). A coordinator correction pointed at this script after a first pass had
already invited the newcomer past the state it needed to test.

**How to apply:**

1. Read `E2E_MAIL_API_KEY`/`E2E_MAIL_SERVER` from `.env.e2e.local` yourself,
   never print them.
2. Invent an address `<anything>@<E2E_MAIL_SERVER>.mailosaur.net` — no
   pre-registration needed, Mailosaur accepts any local-part.
3. Sign up through the real UI, then run
   `pnpm lane:exec <id> -- pnpm --silent e2e:mail-code <address>` — it polls
   up to 60s and prints just the code (or errors after; read the script's own
   docstring for the exact failure shape).
4. This identity is throwaway and lane-private (no global Neon Auth
   footprint to protect), so — unlike the shared newcomer — there is nothing
   to preserve afterward. Order still matters: any state you need to
   observe (pre-invite waitlist redirects, "signing in lands on X") must be
   driven **before** an admin Invite click, which is still one-way with no
   safe in-session reset (auto-mode blocks scoped `DELETE`s of your own test
   rows — confirmed twice, see
   [[newcomer-identity-is-single-use-per-lane-pass]]).
