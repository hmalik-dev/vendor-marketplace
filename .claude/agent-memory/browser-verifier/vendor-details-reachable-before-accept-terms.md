---
name: vendor-details-reachable-before-accept-terms
description: /sign-up/vendor-details is reachable right after email verification, before accept-terms, regardless of the vendor invite gate
metadata:
  type: feedback
---

A fresh vendor's normal `Continue` click on the first-run `/accept-terms`
screen creates the account immediately (no invite gate needed in this lane's
default config) and lands on `/vendor/dashboard` — it never visits
`/sign-up/vendor-details`. That page only renders when: a session exists, no
`users` row exists yet for it, and the vendor application isn't complete — all
true in the window right after verification and **before** accept-terms is ever
touched.

**Why:** the page's own comment says it is "where a verified vendor session the
gate refused lands... never the Terms screen," which reads as gate-dependent,
but the code's actual guard is just "no account yet," which is satisfied
without ever flipping `E2E_VENDOR_INVITE_ONLY` (a platform-wide setting not
worth mutating for a single lane-shared verification pass).

**How to apply:** to test this screen, sign up a fresh identity, verify the
code, then navigate directly to `/sign-up/vendor-details` instead of clicking
Continue on `/accept-terms`. Do not enable the invite gate to reach it.
