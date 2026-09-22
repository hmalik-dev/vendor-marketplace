---
name: vendor-invite-gate-checks-before-the-row-it-creates
description: the vendor invite gate decides on a Neon snapshot before the row it commits; since VEN-512 a vendor_applications row is itself a gate — it diverts /accept-terms, and it is written by a GET
metadata:
  type: project
---

> Auth provider names from VEN-406/441 are pre-Neon-Auth and historical.

**A gate must decide on the row it commits, inside the transaction that commits
it.** `admitVendor` runs first inside the acceptance transaction and locks the
invite; a refusal rolls the account back. `seedApplicationOnRefusal` must stay
**outside** that transaction or the waitlist row rolls back with it.

`hasLiveAccount(db, email)` guards three entry points and is not uniform:
`decideVendorApplication` runs it on `tx` after `lockApplication`;
`createVendorInvite` and `POST /vendor-applications` run it unlocked. Inert only
because a `users` row implies terms already accepted — **that is the invariant to
re-check**, not the race.

**VEN-512 made the waitlist row load-bearing, and that is the live risk.**
`accept-terms/page.tsx` redirects on `status.vendorWaitlist.exists` alone, before
the role picker renders. So a `vendor_applications` row is now a permanent
diversion away from account creation, and three writers can produce one for an
address that never chose vendor:

- `readMyVendorApplication` seeds on **`GET /vendor-applications/me`** — any
  verified session, no account required, reached by merely opening
  `/sign-up/vendor-details` (gate-exempt, linked from `/for-vendors`);
- the client skip in `accept-terms-screen.tsx` routes there off `readSignUpRole()`,
  a 24h **localStorage** hint — a reversible client value becoming irreversible
  server state;
- pre-VEN-512 rows, written **unauthenticated** for arbitrary typed emails
  (`upsertApplication(..., verified=false)`, now dead code), are not backfilled.

Result: the address can never accept the Terms, so never gets a `users` row, in
any role. Reported as VEN-512's blocker; fix is to distinguish a refusal-seeded
row from an arrival-seeded/legacy one and divert only on the first.

**VEN-513's bulk invite (`POST /admin/vendor-applications/invite`) audited
clean.** It is the shape to copy for any later multi-id admin action: one
transaction per id, `lockApplication(tx, id)` then every decision read off the
locked row, `inviteAddress(tx, actorId, row.email)` so no address ever comes
from the body, and a per-id result enum instead of a throw. What makes the lock
real is `vendor_applications_email_key` + the `email = lower(email)` CHECK —
`markApplicationInvited` keys on email, so without that uniqueness it would
write outside the row it locked. The 1–50 body cap sits above the fixed
`ADMIN_PAGE_SIZE` 15 (the console never reads `pageSize` from the URL), so
"select all on this page" cannot 400. Deliberate and not defects: no route
limiter (its admin neighbours have none either; the cap is the guard), and the
sends run on the request path rather than `queueInviteEmail` so `emailFailed`
can be reported synchronously.

Reviewed clean and not to be re-reported: `neon-auth.ts:114` refuses
`emailVerified !== true` in `verifiedClaims`, used by both the verifier and the
loader; the waitlist email is always `snapshot.email`, `existing.email` or
`sessionEmail` (`{...body, email: sessionEmail}` — spread order is the guard);
no id-addressable application read or write exists; the `category` UUID check
precedes the write and the value is `uuidSchema` so it cannot 500 the cast;
`decideVendorApplication`'s completeness guard composes with admin-only.

**`preParsing`, not `onRequest`, is settled for any rate-limited route**
(`lib/rate-limit.ts`): @fastify/rate-limit **appends** its route hook after any
route-level `onRequest`, so a guard there refuses a signed-out caller uncounted.
Global hooks still precede route hooks, so neon-auth's 401 on a garbage token
beats the route limiter — `countBearer` at `server.ts:454` is what counts those.

Related: [[signup-role-is-confirmed-not-narrowed]],
[[email-uniqueness-is-partial-nothing-joins-by-email]],
[[closed-account-address-is-released]], [[idempotency-guards-orphan-side-effects]].
