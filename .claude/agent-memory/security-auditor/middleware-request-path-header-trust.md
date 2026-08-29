---
name: middleware-request-path-header-trust
description: x-orla-request-path is forgeable on any path the middleware matcher skips (a dotted extension), but no reader is reachable there and safeReturnPath bounds it — audited, not a finding
metadata:
  type: project
---

`apps/web/src/middleware.ts` stamps `x-orla-request-path` with
`nextUrl.pathname + nextUrl.search` using `headers.set` on a copy of the request
headers, then `NextResponse.next({ request: { headers } })`. `set` overwrites, so
on any **matched** path a client-supplied header of the same name cannot survive.

The matcher does not cover everything, and the gap was checked rather than
assumed. `'/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|...)).*)'` skips any path
whose prefix contains a listed extension — `/bookings.css`, `/customer/profile.css`,
`/vendors/a.png/request` all skip the middleware, so a client's own
`x-orla-request-path` reaches the render intact.

**Why this is not exploitable (verified 2026-08-29):**

1. No route that calls `requestedPath()` / `signInPathReturningHere()` is
   reachable at a skipped path. Every skipped path either 404s (no route file
   matches `/bookings.css`) or hits `/vendors/[slug]/...`, where
   `getPublicVendorProfile` runs `slugSchema.safeParse` first — the regex is
   `^[a-z0-9]+(?:-[a-z0-9]+)*$`, which forbids the dot the skip requires — and
   `notFound()` fires before any auth gate.
2. Every reader routes the value through `safeReturnPath`, so the ceiling on a
   forged header is a **same-origin** path, not an open redirect.
3. The `[^?]*` in the matcher already blocks query smuggling: `/bookings?x=y.png`
   still matches, because `[^?]*` cannot cross the `?`.

**How to apply:** if a future route ever renders at a path that can contain a dot
(a user-chosen slug that permits `.`, a catch-all, a file-ish route), re-run
point 1 — the header becomes attacker-seeded there. `safeReturnPath` is the load
bearing control, not the middleware; treat any reader that skips it as the
finding. Note also that `middleware.test.ts` mocks `clerkMiddleware` away, so
nothing in the suite proves Clerk preserves the handler's response headers — that
failure mode is fail-closed (destination lost, no unsafe redirect).

Related: [[validate-before-normalize-return-path]]
