---
name: terms-gate-is-a-five-state-session
description: request.auth is null for a signed-in account that has not accepted the Terms, and for a locked-out account on an openToLockedOut route; requireClerkSubject is a deliberate weaker guard for exactly two routes
metadata:
  type: project
---

> **Clerk is retired** (VEN-447/448/449 moved auth to Neon Auth). Clerk names below describe the pre-cutover code and are historical; do not act on them as live.

`apps/api/src/plugins/neon-auth.ts` (was `clerk-auth.ts` before VEN-447)
resolves a bearer token into one of five states and the order is load-bearing:
retired (`deleted_at`) -> 401, **no local row -> gated**, banned -> 403
`FORBIDDEN`, not-accepted -> gated, otherwise `request.auth`. Banned is checked
_before_ the acceptance check, so a suspended account can never present as
merely gated.

**`openToLockedOut` is the sixth state (VEN-435).** A route may set
`config.openToLockedOut = true`; the retired and banned branches then `return`
instead of throwing. Audited: `auth` stays null, `termsRequired` stays false, so
the route reads a suspended or retired caller as a visitor, and every downstream
refusal that keys on `!auth` still fires (a `bookingId` on `/support/messages`
gets 401, so no dispute hold and no payout freeze). Two things make it safe and
both are the finding if they change: **`request.authIdentity` is still set
before those returns**, so this flag on a route that calls `requireClerkSubject`
/ `authSubject` would authorise a banned account; and the flag is per-route
config, so it must never appear on anything but a route whose whole purpose is
reachability while locked out — today only `POST /support/messages`. Fastify's
404 context carries `config: {}`, so the unconditional `routeOptions.config`
read cannot throw on an unmatched path.

Two consequences a later diff must not undo:

- **`request.auth` is `null` for a signed-in-but-gated account.** Every route
  that reads `request.auth?` optionally — `/support/messages`, `/tags`,
  `GET /vendors/:slug/reviews` — therefore reads a gated caller as anonymous.
  That is fail-closed everywhere (the support dispute-hold path throws 401), but
  it means `/support` tells a signed-in gated user to sign in, and `useApi`
  cannot funnel a 401 to the gate.
- **`requireClerkSubject` (`lib/guards.ts`) authorises on a verified Clerk
  subject with no local account.** It is the only guard that does not call
  `assertTermsAccepted`, and it exists solely because `POST /legal/terms/accept`
  is what _creates_ the `users` row. It must stay on those two routes only. The
  plugin's global `onRequest` runs before any route-level `onRequest`, which is
  what keeps banned and retired refusals ahead of it.

The gate itself is `assertTermsAccepted` inside all four real guards, and a
sweep of `app.post|put|patch|delete` shows only `/support/messages` and the two
signature-verified webhooks have no guard — so no state-changing route escapes
it.

**Why:** the gate had to be reachable by a session with no account row, and the
usual answer (relax `requireAuth`) would have put every route behind the
exception. Splitting the state out is what keeps the exception to two routes.

**How to apply:** if a new route needs `requireClerkSubject`, that is the
finding. If a diff makes `request.auth` non-null for a gated session, or moves
the ban check after the acceptance check, that is the finding. The web-side
`GATE_EXEMPT_PATHS` in `apps/web/src/lib/terms-gate-paths.ts` only suppresses a
redirect — bypassing it grants nothing, because the API refuses regardless.
Related: [[legal-acceptance-record-is-undeletable-pii]],
[[schema-validation-runs-before-prehandler-guards]].
