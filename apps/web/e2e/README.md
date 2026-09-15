# Committed E2E suites

Playwright journeys that defend the critical paths. **Not** the same thing as the
MCP-driven Playwright the `browser-verifier` and `parity-checker` agents use:
that is an agent steering a page during a ticket, this is a runner defending
journeys afterwards. They share only the `.auth/` storage state — deliberately,
because an agent never types a password and neither do these.

## Running them

Always through the lane, so the port resolves:

```
pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/web test:e2e
```

Three things must be true first, and each fails with its own named message
rather than as a mystery:

1. **The lane's web and API servers are up.** The suites do not start a server —
   they drive the one the lane is already running.
2. **`.auth/` has been regenerated _inside this lane_.**
   `pnpm lane:exec <n> -- pnpm e2e:auth` — `.worktreeinclude` copies `.auth/`
   from the main checkout, where it was minted against port 3000 and has usually
   expired, so a fresh worktree inherits a session that is wrong for its port.
3. **The lane database is seeded by the contract below.** `lane:up` does this.

### The seeding contract

One contract, and both runners follow it: `lane:up` (`LANE_SEEDS` in
`packages/preflight/src/lane/lane.ts`) and CI's `Migrate and seed` step, which
`lane.test.ts` holds to the same list and order.

```
db:migrate → db:seed → db:seed:marketing → db:seed:e2e
```

- **`db:seed:marketing` is in, and required.** `admin-closed-customers.spec.ts`
  closes one of its customers, so the suite cannot run without it. Every spec is
  written to pass with the marketing vendors present: a spec that counts rows,
  reads the first page of a list, or measures a grid is measuring the marketing
  data too, and must hold at that volume (VEN-414).
- **`db:seed:e2e` runs last.** Besides the vendor's storefront, package and live
  request, it writes one **completed booking reviewed in each direction**, so
  the console's review lists and the `Direction` filter in
  `admin-filters.spec.ts` have rows to narrow with no manual precondition.
- **Not `db:seed:demo`.** Nothing in the suite may need it.
- Every seed tops up rather than resets, so a second run on the same database is
  the ordinary case and every spec must pass it: dates come from `e2e:dates`,
  names from `uniqueVenue`.

A lane created before this contract has no marketing data; run
`pnpm lane:exec <n> -- pnpm db:seed:marketing` (idempotent) rather than
recreating it.

### Raise the rate limit

A full pass makes more than `RATE_LIMIT_MAX` requests a minute (**120** by
default), and the API then answers **429**. The app renders that as the generic
500 page — _"Something broke on our end… We've been notified"_ — so a throttled
run looks exactly like a broken feature. Start the lane's API with the limit
raised:

```
RATE_LIMIT_MAX=100000 pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/api dev
```

The fixtures watch for 429 and fail with this instruction, so you get told rather
than having to read the server log. Two runs of this suite were misdiagnosed as
flaky messaging tests before that existed.

## The two rules the specs follow

**Assert the resolved pathname before anything else.** A signed-out run does not
look broken: Clerk redirects to `/sign-in`, which renders cleanly, logs nothing
to the console and does not overflow. Every content-shaped assertion passes on
it. The URL check is the one that fires.

**Select on seed identity, never on copy.** Business names, headings and
placeholders are content that a wording ticket moves. `fixtures-data.ts` holds
the seed values the journeys navigate by, and `fixtures-data.test.ts` — which
runs under Vitest, and _can_ import `@vendor-marketplace/db` — fails by name when
one drifts.

> Specs cannot import `@vendor-marketplace/db` themselves: `apps/web` is not
> `"type": "module"`, so Playwright transpiles them to CJS where that package's
> `import.meta` is a syntax error. Hence the literals plus the guard.

## Layout

|               |                                                                 |
| ------------- | --------------------------------------------------------------- |
| `*.spec.ts`   | Playwright journeys — need a live server                        |
| `*.test.ts`   | Vitest unit tests over the harness's own helpers                |
| `fixtures.ts` | Role fixtures that **prove** the session before yielding a page |
| `base-url.ts` | Origin resolution that refuses to guess                         |

## The route-landing sweep

`route-landing.spec.ts` visits every route and every literal redirect
destination as five personas — signed out, customer, vendor, admin, and a
freshly minted Clerk identity with **no `users` row** (`no-row-account.ts`,
deleted afterwards). The targets come from `route-targets.ts`, which walks
`src/app` and greps the redirect calls, so a new route is covered without
editing the spec. Run it against `next start`, not `next dev`, with the rate
limit raised; the no-row persona needs `CLERK_SECRET_KEY` from the environment
or the root `.env`.

## The paid booking journey

`paid-booking.spec.ts` drives the money path against Stripe test mode: request,
accept, pay with `4242`, a 3-D Secure card and a declined card, a cancellation
refunded in full, and completion followed by a public review. It needs one more
thing running than the rest — Stripe's webhooks forwarded to **this lane's** API:

```
stripe listen --forward-to localhost:<api port>/webhooks/stripe --forward-connect-to localhost:<api port>/webhooks/stripe
pnpm lane:exec <n> -- pnpm --filter @vendor-marketplace/web test:e2e paid-booking
```

Pass the file name **without** a `--`: pnpm forwards the `--` to Playwright,
which then ignores the filter and runs every suite.

Scenario 1 holds the customer's arrival on `/bookings/<id>/confirmed` until the
vendor's bookings page reads `Booked`, because that screen's read reconciles
with Stripe directly and would book the date with no webhook at all. So a
missing forwarder fails there, naming the webhook, rather than passing.

Dates come from `pnpm --filter @vendor-marketplace/db e2e:dates`, which picks an
untouched day per scenario and moves a paid event to yesterday for completion.
It is a command, not a route, so nothing deployed can move an event date; and it
refuses a production database exactly as `seed:e2e` does. Refund and completion
pay server-side with `pm_card_visa` and read refunds from Stripe, so the run
needs the test-mode `STRIPE_SECRET_KEY` from the environment or the root `.env`.

## Not here yet

Vendor profile and search. (The console lists are covered by
`admin-filters.spec.ts` and `admin-lists.spec.ts`.) Each is deferred for a named
reason — see the follow-up ticket rather than assuming they were forgotten.

## On CI

`ci.yml`'s `End-to-end journeys` job (VEN-411) boots this whole stack after
`verify` — seeded by [the contract](#the-seeding-contract), `next start`, `stripe listen` — and runs every suite with
**one retry, reported**: a test that passed only on its retry is named in the
job summary by `scripts/e2e-ci.mjs`. It skips with a warning until the
repository has its `E2E_*` secrets (VEN-377); set the variable `E2E_GATE=required`
once they exist. Traces are off on CI, because the repository is public and a
trace carries the accounts' Clerk sessions — reproduce a CI failure on a lane.
