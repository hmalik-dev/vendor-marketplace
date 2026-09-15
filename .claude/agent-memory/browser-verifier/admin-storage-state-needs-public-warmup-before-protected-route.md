---
name: admin-storage-state-needs-public-warmup-before-protected-route
description: A fresh context.newContext({ storageState }) redirected an admin/customer session to sign-in when navigated straight to a protected route twice — it only authenticated after a warm-up hit on a public route (e.g. `/`) first
metadata:
  type: feedback
---

On lane ven-383, loading `.auth/admin.json` (or `.auth/customer.json`) into a
fresh `browser.newContext({ storageState: '<path>' })` and navigating straight
to a protected route (`/admin/reviews`) **twice in a row** still redirected to
`/sign-in?returnTo=...` both times — a server-side (middleware) redirect, not
just a client-hydration lag. The cookies in the storage state were valid
(unexpired, right domain) and `context.cookies()` showed them present after the
first navigation. What fixed it: navigating to the **site root `/`** first,
waiting ~800ms, and only then navigating to the protected route — after that,
repeated navigations to the protected route stayed authenticated.

**Why:** unconfirmed mechanism, but consistent across the session — looks like
Clerk's middleware needs one round trip through a page that runs its
`clerkMiddleware`/client handshake before it will trust a `storageState`-seeded
session cookie on a route it protects directly. This is a stricter case than
[[stored-auth-state-needs-marker-wait-not-fixed-sleep]], which describes a
client-side header still reading signed-out — this one is a full server
redirect away from the page entirely.

**How to apply:** the repo's own instruction to "navigate once and discard that
render, then navigate again" is necessary but the _first_ navigation should
target a public route (`/`), not the same protected route — hitting the
protected route twice did not self-heal in this session. If a `storageState`
context still redirects to sign-in after a `/` warm-up, treat the storage state
as actually stale and regenerate it rather than retrying more navigations.
