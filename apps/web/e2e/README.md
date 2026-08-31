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
3. **`seed:e2e` has run against the lane database.** `lane:up` does this.

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

## Not here yet

Vendor profile, search, payment, reviews and admin. Each is deferred for a named
reason — see the follow-up ticket rather than assuming they were forgotten. CI
wiring is also absent: `ci.yml` runs on in-process PGlite with _placeholder_
Clerk keys and never reaches Clerk, so real-auth E2E needs GitHub secrets the
account holder must add.
