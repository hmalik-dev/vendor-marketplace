---
name: route-landing-sweep-strictness-sources
description: What makes the e2e route-landing sweep strict for a gated route; isSessionGated is only a backstop, and helper gates are invisible to it
metadata:
  type: project
---

The route-landing sweep (`apps/web/e2e/route-landing.spec.ts`) treats a route as
strict (must refuse signed-out) when `isRoleGated` (a `ROLE_ROUTE_RULES` entry),
`isSessionGated` (a source scan of the render chain) or a hard-coded branch
(`VENDOR_GATE_PATHS`, VEN-589) says so; otherwise it accepts render-or-refuse.

**Why:** VEN-590 (2026-09-25) added a hand-rolled `getServerSession` + `if (!x)
redirect` detector, but the three VEN-512 pages were already strict via the
VEN-589 branch and a `roles: []` rule, so it changed no current expectation.
The scan misses helper gates (`requireNonAdmin`, `gateBookingRequest`,
`gateCheckout`, `gateConfirmedBooking`), `getCurrentUser()` + `if (!user)`,
`!session?.user`, compound conditions and `notFound()`/`forbidden()` refusals;
those routes are strict today only because the role table lists them.

**How to apply:** a new gated route outside `ROLE_ROUTE_RULES` that gates via a
helper or a non-canonical shape is swept leniently. OR'ing a detector into
`isSessionGated` can only tighten; a false positive fails loudly.
