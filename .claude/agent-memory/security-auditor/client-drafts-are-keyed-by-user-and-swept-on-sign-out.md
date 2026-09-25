---
name: client-drafts-are-keyed-by-user-and-swept-on-sign-out
description: Booking-request drafts in localStorage are partitioned by user id (the boundary) and swept on sign-out (defence in depth); residue at rest after expiry is accepted
metadata:
  type: project
---

VEN-617 (audited 2026-09-25, PASS): `lib/booking-request-draft.ts` keys drafts
`orla:booking-request:<userId>:<vendorId>`, userId from the page's server-side
`requireRole('customer')`. **The key is the trust boundary**, not the sweep: a
second person on the same browser reads only their own key, whatever was left.

`signOut()` sweeps every `orla:booking-request:` key (legacy vendor-only keys
too) only on success, inside a try/catch, before `announceSessionEnded`.

Residue at rest is accepted, not a finding: session expiry, another device's
sign-out, a close-account whose `signOut()` 5xxs, and a keystroke in another tab
before its broadcast lands all leave a draft under the old user's key
(devtools-readable, `read()` ignores it after 30 days but never deletes it).
Surviving expiry is the product promise (frame 26's session-expired dialog).

**Why:** re-raising the residue relitigates that promise.
**How to apply:** re-open only if a draft key stops naming the user, the id
comes from the client, or a new localStorage consumer stores PII unkeyed.
