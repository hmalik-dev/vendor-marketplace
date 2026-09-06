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

Since #392 `DEFAULT_ROLES` in `scripts/e2e-auth.mjs` includes `admin`, so the
no-argument run mints an **admin console** session, not just customer/vendor.

**Why:** the repo law "a development default must never be able to reach
production" is normally satisfied by a marker check (see
[[deployment-gate-detects-by-marker-and-fails-open]]); this path has none, and
the usual `NODE_ENV=production` / protected-Neon-branch refusals in
`seed-e2e.ts` do not apply because the script never touches the database — it
drives a browser at whatever origin `resolveBaseUrl` returns.

**How to apply:** any change that widens what an E2E script does by default is
a production-privilege question, not a fixtures question. Ask what the default
does when `E2E_BASE_URL` names the deployed origin. If a guard is added, parse
`new URL(BASE).hostname` — a substring match on "localhost" is the mistake
recorded in [[webhook-endpoint-guard-string-matches-localhost]].
