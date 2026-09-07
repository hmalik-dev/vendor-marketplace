---
name: identity-read-is-cached-and-route-dynamism-is-inherited
description: getCurrentUser is React cache()'d (per-request, verified safe) and every public page's dynamism is inherited from SiteHeader's auth() read — remove that and role-derived HTML becomes full-route-cacheable
metadata:
  type: project
---

`apps/web/src/lib/current-user.ts`'s `getCurrentUser` is wrapped in React
`cache()` (#412). **This does not leak one visitor's `/users/me` to another**,
and a later audit should not re-open it:

- react 19.2.8's `cache` reads `ReactSharedInternals.A` and, when no dispatcher
  is present, calls the function straight through with no memoization — the
  fallback is "uncached", never "globally cached". Verified in
  `node_modules/.pnpm/react@19.2.8/.../react.react-server.development.js`.
- The dispatcher that does exist is created by the RSC renderer per render, so
  the memo is per request. Route handlers (`/dashboard`, `/after-sign-in`,
  `/admin/vendors/export`) get either a per-request scope or none.
- Nothing calls it at module scope, in `generateMetadata`, in middleware, or
  from a server action (there are none in this app).
- `apiRequest` sends `/users/me` with `cache: 'no-store'`; only the `revalidate`
  option opts a call into the shared Data Cache, and that is documented as
  public-reference-data only.

**Why this matters going forward:** `/vendors/[slug]` renders role-derived HTML
(`canBook`) and carries **no** `export const dynamic`. It is dynamic only
because the root layout renders `SiteHeader`, which calls `readRoleForChrome()`
→ Clerk `auth()` → `headers()`, and a dynamic API anywhere in the route's server
tree opts the whole route out of the Full Route Cache.

**t428 escalated the stake on `/`.** `apps/web/src/app/page.tsx` now reads the
signed-in customer's own rows (`getOwnBookingRequests` / `getOwnBookings`) and
renders the soonest confirmed booking's **vendor name, event date and paid
amount** into the landing HTML — both in `StatusStrip`'s client props and in the
trust band's `trustCopyFor` copy. What a mis-cache of `/` would publish stopped
being a boolean. `/` still declares no `dynamic`; it inherits it from its own
`redirectVendorToDashboard()` → `auth()` at the top of `HomePage`, and from
`SiteHeader`. Twelve peer routes that render per-user data
(`/bookings`, `/bookings/[requestId]`, `/messages`, `/vendor/*`,
`/admin/layout`) all declare `force-dynamic`; `/` is the outlier.

Note that **`readIdentityOnPublicRoute` and `readRoleForChrome` swallow
`DynamicServerError`** along with everything else that is not a navigation
signal. Next 15.5 still bails out correctly — `headers()` marks the work store
before it throws, so a userland catch does not restore staticness — but that is
a framework implementation detail this route is resting on, not a guarantee it
states.

**How to apply:** if a change ever makes `SiteHeader` static, moves it out of
the root layout, or adds `generateStaticParams`/`revalidate`/PPR to a page that
renders per-viewer content, that page's HTML becomes shareable between visitors
and the role-derived boolean is baked into it. Any such page needs its own
`export const dynamic = 'force-dynamic'` — most protected pages already declare
one; the public ones deliberately do not.

Related: [[client-component-props-are-public-html]],
[[route-handlers-do-not-inherit-layout-gates]].
