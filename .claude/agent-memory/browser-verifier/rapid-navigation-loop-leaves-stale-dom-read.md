---
name: rapid-navigation-loop-leaves-stale-dom-read
description: A page.evaluate() run right after a tight loop of several page.goto() calls (e.g. testing 6 status filters back to back) read an unrelated element's aria-current as null when a fresh, isolated navigation to the same URL showed it correctly set
metadata:
  type: feedback
---

On lane VEN-399, one script did a loop over six `?status=` filter values (six
`page.goto()` calls with no wait after the last one), then immediately
`page.goto('/admin/requests')` again and read every `<a>` on the page via
`document.querySelectorAll('a')` to check the admin rail's `aria-current`. The
rail's `Bookings` link came back `aria-current: null` on `/admin/requests` —
which would have been a real defect (the rail is supposed to light `Bookings`
for `/admin/requests`, per the comment in `admin-nav.tsx`).

A **second, isolated** script — nothing before it but the two warm-up hits,
one `goto('/admin/requests')`, a `waitForTimeout(500)`, then a scoped
`nav[aria-label="Admin"] a` query — showed `aria-current="page"` and the active
`bg-clay-100 text-clay-600` classes exactly as the source predicts.

**Why:** unconfirmed mechanism, but consistent with [[stored-auth-state-needs-marker-wait-not-fixed-sleep]]
and the parity rule's "sample twice and compare" guidance — a `'use client'`
nav component re-renders on each client-side transition, and reading the DOM in
the same tick as (or immediately after) a `goto()` that follows a burst of
other navigations can catch it between the old and new `aria-current` value,
or catch a stale document if `goto()` resolved on `load` before hydration
re-ran. The broader `querySelectorAll('a')` scan across the _whole_ page in the
first script may also have grabbed a leftover node from a not-yet-detached
previous render — same shape as [[search-bar-has-hidden-duplicate-inputs]].

**How to apply:** a negative finding (attribute missing, class absent) read
immediately after several rapid `goto()`/interaction calls is not trustworthy
on its own — re-run it as an **isolated** check: fresh navigation, a short
`waitForTimeout` (300-500ms), and a selector scoped to the specific container
rather than a page-wide query, before reporting a UI-highlighting or
active-state defect.
