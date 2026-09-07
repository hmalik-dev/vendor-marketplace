---
name: review-checklist-gate-redirect-in-shared-client-helper
description: A redirect added inside useApi/apiRequest fires from every mounted client component, including the header, so it bounces the reader off the public pages the gate itself links to
metadata:
  type: feedback
---

When a diff adds a **navigation** inside a shared client request helper
(`use-api.ts`'s `useApi`, or any wrapper every client component calls), the
question is not "does the caller that motivated it navigate correctly" — it is
**which components are mounted on pages the redirect should not fire from**.

**Why:** #429 put `router.push(termsAcceptancePath(...))` in `useApi`'s catch for
a 403 `TERMS_REQUIRED`. `NotificationBell` lives in `SiteHeader`, which the root
layout renders on _every_ non-admin page, and it fetches `/notifications` on
mount. So a signed-in-but-un-accepted account is pushed to the gate one round
trip after opening any page — including `/terms`, which the gate's own checkbox
links with `target="_blank"`, and `/support`, which the codebase documents as
"public by design — the visitor most likely to need it is the one who cannot get
in". The gate closes its own escape hatches. Every test stayed green because the
hook's suite mocks `apiRequest` and renders the hook alone.

**How to apply:** for a redirect added to a shared client helper, grep the root
layout (and any always-mounted chrome: header, bell, stream hook, toaster) for
components that call it in a mount effect, then list the routes those chrome
components render on. Ask specifically: does the diff's own screen link to any
page in that set? A gate that links a document must leave that document
reachable. Related: [[review-checklist-layout-gate-checked-at-its-own-route]].
