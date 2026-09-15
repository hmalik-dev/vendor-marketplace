---
name: next-route-announcer-is-role-alert
description: Next.js App Router injects a hidden role=alert route announcer on every page; a bare getByRole('alert') count assertion always finds it
metadata:
  type: project
---

Next.js's built-in accessibility feature renders `<div id="__next-route-announcer__"
aria-live="assertive" role="alert">` on **every** App Router page, visually
hidden via clip-rect. It is framework plumbing for screen-reader route-change
announcements, not application state.

**Why:** VEN-391's `admin-operator-closure.spec.ts` asserted
`page.getByRole('alert')).toHaveCount(0)` after a successful confirm, expecting
"no error banner." It failed deterministically — 100% reproducible, not flaky —
because that locator always matches the route announcer regardless of whether
the app rendered a real error. Confirmed by querying `[role="alert"]` directly:
one match, `outerHTML` is the announcer div, empty text content. The underlying
feature (dialog copy, near-miss guard, closure, admin_actions row) all worked
correctly; only the test's own assertion was broken.

**How to apply:** when a spec asserts "no alert appeared" as proof an action
succeeded without error, scope the locator to the actual error element (its
class, a parent test id, or `.filter({ hasText: ... })`) — never a bare
`getByRole('alert')` count on the whole page. Report this as a spec-authoring
defect distinct from a product regression: the manual browser drive is the
source of truth when the two disagree, but the broken assertion is still a
finding worth filing (it will fail every future run of that spec, including
CI, until scoped).
