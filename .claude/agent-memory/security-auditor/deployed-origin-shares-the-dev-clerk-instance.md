---
name: deployed-origin-shares-the-dev-clerk-instance
description: The Vercel deployment authenticates against the same Clerk dev instance as localhost, so any E2E_BASE_URL aimed at it signs the E2E accounts into production data
metadata:
  type: project
---

`docs/pre-launch.md` §1.2: production authenticates against
**`stirred-flea-3295.clerk.accounts.dev`** with `pk_test_`/`sk_test_` keys —
the same instance localhost uses. The E2E accounts therefore exist on the
deployed origin, and `.auth/*.json` minted there carries real authority over
production data.

`scripts/e2e-base-url.mjs` puts `E2E_BASE_URL` at the top of the chain
explicitly so a run can be aimed at a deployed origin;
`scripts/e2e-base-url.test.mjs:24` uses `https://web-gules-eta-41.vercel.app`
as its example. So aiming a sign-in script at production is a supported,
tested, one-variable act with no origin guard anywhere downstream.

Since #392 the default role list includes `admin`, so a no-argument run mints
an **admin console** session and not just customer/vendor — and #392 therefore
also **added the guard**: `resolveRoles` in `scripts/e2e-roles.mjs` refuses to
choose roles at all when `new URL(BASE).hostname` is not loopback, exiting 1
before Chromium launches and printing the explicit form to type instead. Roles
named on argv still work against any origin, because that is somebody's
decision rather than a default's. `scripts/e2e-auth.test.mjs` covers the
loopback list, the deployed refusal, the explicit override, and four hostnames
a substring match would have wrongly accepted.

**Do not re-report the default.** What remains open is the shared instance
itself — `docs/pre-launch.md` §1.2 is the tracking item, and no guard here can
substitute for production getting its own Clerk instance.

**Why:** the repo law "a development default must never be able to reach
production" is normally satisfied by a marker check (see
[[deployment-gate-detects-by-marker-and-fails-open]]); this path has none, and
the usual `NODE_ENV=production` / protected-Neon-branch refusals in
`seed-e2e.ts` do not apply because the script never touches the database — it
drives a browser at whatever origin `resolveBaseUrl` returns.

**The committed suite drives sign-up as of #464.** `auth.spec.ts`'s docblock
records the older ruling — no sign-up journey, because it "would mint real
users in the shared Clerk development instance on every run" — and
`e2e/sign-up-challenge.spec.ts` reverses it for two cases that stop short of an
account: one blackholes `challenges.cloudflare.com` so clerk-js never sends the
create, and one aborts it so Clerk refuses the create with no captcha token.
The second rests on bot protection staying **on** in the Clerk dashboard. It
fails loudly rather than silently if that changes — a successful create
navigates to the verification card and `input[name="emailAddress"]` disappears,
so the spec's `toBeEnabled()` times out — but the attempt would already have
been made against the instance production shares. Addresses are `@example.com`
(IANA-reserved), so the verification mail goes nowhere.

**How to apply:** any change that widens what an E2E script does by default is
a production-privilege question, not a fixtures question. Ask what the default
does when `E2E_BASE_URL` names the deployed origin. If a guard is added, parse
`new URL(BASE).hostname` — a substring match on "localhost" is the mistake
recorded in [[webhook-endpoint-guard-string-matches-localhost]].
