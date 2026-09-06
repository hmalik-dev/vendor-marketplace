---
name: error-screen-chrome-is-hidden-not-unmounted
description: The 500 screen hides the site header and footer with a body:has([data-error-screen]) CSS rule, so the chrome — Clerk's UserButton and the NotificationBell's event stream — still mounts and runs on a crashed page
metadata:
  type: project
---

`apps/web/src/components/errors/error-screen.tsx` marks its root
`data-error-screen`, and `apps/web/src/app/globals.css` hides
`[data-slot='site-header']` and `[data-slot='site-footer']` from it. Landed
2026-09-06 (#372), following the `data-auth-screen` rule already in that file.

**Why:** `error.tsx` renders _underneath_ the root layout, so the header and
footer are its siblings and nothing the component returns can remove them. CSS
was chosen over a React flag so the first server paint is already correct.

**How to apply:**

- Hidden is not unmounted. `display: none` takes both landmarks out of the
  accessibility tree and out of the tab order, so nothing there is clickable or
  focusable on a crashed page — but the layout's server render still ran
  (`readRoleForChrome` → `/users/me`, `getCategories`), and the client children
  inside the header still hydrate: `NotificationBell` opens its `/events/stream`
  connection and Clerk's `UserButton` mounts. If a future change must _not_ run
  on the error screen, hiding it here will not stop it.
- `data-error-screen` is a document-wide switch: any element carrying it removes
  the chrome for the whole page. Only `ErrorScreen` sets it today, and the only
  raw-HTML sink in web is `serialiseJsonLd`, so it is not attacker-reachable —
  re-check that if a second HTML sink ever appears ([[json-ld-is-the-only-raw-html-sink]]).

**The `Contact support` href is a closed boundary, verified 2026-09-06.**
`supportLink()` puts `window.location.pathname + search` of the crashed page into
`/support?from=`, and `supportErrorContextSchema` in `packages/shared` refuses
anything that is not a same-origin path (`^/(?![/\\])[^\s\\]*$`) before it
renders; `support-email.ts` escapes it into the mail and the API never logs it.
No app route carries a token in its query. The residual is a third-party param
that lands in a URL (Clerk's `__clerk_ticket`) being echoed into support mail if
a crash happens on exactly that URL — noted, not filed.

Related: [[public-mail-endpoint-echoes-to-any-address]],
[[client-component-props-are-public-html]]
