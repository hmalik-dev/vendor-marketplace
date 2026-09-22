---
name: review-checklist-e2e-branch-gated-on-a-row-the-spec-plants
description: An e2e spec whose meaningful branch sits behind `if (pathname === X)` goes inert from run 2 when the run itself plants the row that makes a server redirect skip X
metadata:
  type: feedback
---

An `if (await locator.count() > 0)` or `if (pathname === '/gate')` wrapper around
the only interesting half of an e2e spec is a run-order dependency, not a
convenience. Ask: **what does the first run write that changes the second run's
entry state?**

VEN-585's `vendor-refusal-routing.spec.ts` gated the role picker on
`pathname === '/accept-terms'`. Reaching `/sign-up/vendor-details` seeds a
`vendor_applications` row (`getMyVendorApplication()`), and
`accept-terms/page.tsx` server-redirects whenever `vendorWaitlist.exists`. So
run 1 exercised the client `VENDOR_NOT_INVITED` bounce and every later run
resolved by the server redirect with the branch skipped — green with the catch
deleted. The author's own manual repro had already planted the row, so the
green they reported was the degenerate path.

**Why:** the lane database persists between runs and `db:seed:e2e` tops up
rather than resets, so "I ran it and it passed" says nothing about which branch
ran.

**How to apply:** for any new spec, name the row/setting the run leaves behind,
then re-derive the entry state of run 2. A spec must assert the mechanism it
claims (the 403 code, the request) rather than infer it from a landing URL that
two different mechanisms produce. Pairs with
[[review-checklist-pglite-serialises-transactions]].
