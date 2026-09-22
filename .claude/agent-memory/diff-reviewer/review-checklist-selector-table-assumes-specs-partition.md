---
name: review-checklist-selector-table-assumes-specs-partition
description: A CI test-selection table (path prefix -> spec list) walked with Array.find is silently wrong wherever two specs drive the same route, or one spec enumerates the whole app
metadata:
  type: feedback
---

A changed-path -> spec-list table (VEN-411 `SPEC_SELECTORS` in
`scripts/e2e-ci.mjs`) is only correct if specs **partition** by route. They
never do. Three probes, in order:

1. **`find` returns the first match, so later patterns are dead.** Sort the
   entries and look for one prefix containing another: `bookings/` (label
   `booking`) precedes `bookings/[requestId]/checkout/` (label `payments`), so
   the payments patterns can never fire. Same for `sign-up/` vs
   `sign-up/vendor-details/`. Run the function over one real path per entry and
   print the answer — do not read the table.
2. **Invert the map: grep every `goto(` in `apps/web/e2e/*.spec.ts`.** A route
   named by a spec that is not in that route's `specs` list is a spec the diff
   just stopped running. `paid-booking` and `launch-switches` both drive
   `/vendor/bookings` and `/bookings/<id>`, which the table gives to
   `vendor-refusal-routing` and `booking-request` alone.
3. **A spec that enumerates routes at runtime cannot be keyed on a route.**
   `route-landing.spec.ts` walks `apps/web/src/app` (VEN-379, so a route added
   tomorrow is swept with no list to maintain); pinning it to two landing
   prefixes deletes that guarantee for every new segment.

**Why:** the failure is a false green in CI — nothing in the diff's own suite
can go red, because the tests assert the table against a copy of itself.

**How to apply:** the missing test is a completeness guard — every
`apps/web/e2e/*.spec.ts` on disk is reachable from at least one selector entry.
Ask for it whenever a diff adds a hand-written coverage map. Also check the CLI
branch that renders the map (`selectionOutputs`, `GITHUB_OUTPUT` lines): if it
is not exported it is not tested. See [[review-checklist-source-grep-substring-collisions]].
