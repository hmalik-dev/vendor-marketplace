---
name: route-landing-sweep-strictness-sources
description: What makes the e2e route-landing sweep strict for a gated route; isSessionGated can only tighten, and since VEN-757 it resolves src/lib wrapper gates
metadata:
  type: project
---

The route-landing sweep (`apps/web/e2e/route-landing.spec.ts`) treats a route as
strict (must refuse signed-out / no-row) when `isRoleGated` (a `ROLE_ROUTE_RULES`
entry), `isSessionGated` (a source scan of the render chain) or a hard-coded
branch (`VENDOR_GATE_PATHS`, VEN-589) says so; otherwise it accepts render-or-refuse.

**Why:** VEN-590 added the hand-rolled `getServerSession` + `if (!x) redirect`
shape; VEN-757 (2026-09-25) added `sessionGateNames`, a fixed-point resolver
over `src/lib` top-level declarations that wrap `requireCurrentUser`/`requireRole`
(`requireNonAdmin`, `gateBookingRequest`, `gateCheckout`, `gateConfirmedBooking`).
Audited PASS: `renders:false` removes the `sourceForwarded` escape and fails an
in-place HTML render, so a detector false positive (conditional gate, a
declaration slice running into trailing top-level code) fails loudly, never green.
Still missed: `getCurrentUser()` + `if (!user)`, `!session?.user`, compound
conditions, `notFound()`/`forbidden()` refusals, gates outside `src/lib`.

**How to apply:** do not re-audit "can the detector weaken the sweep" — it cannot
while `renders` only toggles true→false. Reopen if `isSessionGated` ever feeds
a leniency (an exemption, a `sourceForwarded` widening, a skipped check).
