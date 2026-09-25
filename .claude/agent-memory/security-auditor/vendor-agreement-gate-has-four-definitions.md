---
name: vendor-agreement-gate-has-four-definitions
description: The vendor agreement gates publish, checkout, request-accept and payout release through four separate "has accepted" predicates that disagree on version and on the correlation column
metadata:
  type: project
---

VEN-509 made the vendor agreement a gate on publishing and on payout release.
There are now **four** independent predicates for "this vendor has accepted",
and no shared helper:

| Gate                                                            | Where                                                                                                       | Correlates on                                      | Version                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------ |
| Publish (vendor + admin republish) + dashboard/profile blockers | `holdsCurrentAgreement` → `findLatestAcceptance`, `apps/api/src/modules/vendors/legal-agreement.service.ts` | `accepted_by_user_id`                              | newest row must **be** the current version |
| Checkout 402                                                    | `findPayableRequest` EXISTS, `apps/api/src/modules/payments/payments.dao.ts`                                | `legal_acceptances.vendor_id = vendor_profiles.id` | `= CURRENT`                                |
| Request accept                                                  | `apps/api/src/modules/booking-requests/booking-requests.dao.ts`                                             | `vendor_id`                                        | `= CURRENT`                                |
| Payout release (sweep **and** operator retry, one claim)        | `claimReleasableBooking` EXISTS, `apps/api/src/modules/payments/payouts.dao.ts`                             | `accepted_by_user_id = vendor_profiles.user_id`    | **any version**                            |

**Why:** the payout one is version-agnostic on purpose — money captured under an
older version is owed under it, and checkout already refused a stale vendor. The
two correlation columns are equivalent only because `vendor_profiles_user_id_key`
is unique and `acceptVendorAgreement` always writes the profile owner.

**How to apply:** a version bump, a second profile per user, or a nullable
`vendor_id` acceptance row desynchronises these four. Both EXISTS subqueries
correlate to an **unaliased** `vendor_profiles` — aliasing that join silently
makes the subquery uncorrelated and true for everyone (see
[[messaging-tenancy-is-two-statements]]). Publishing writes through exactly two
callers — `updateVendorProfile` and admin `setVendorPublished` — everything else
in the codebase only sets `is_published = false`; keep it that way.
Acceptances are append-only and undeletable ([[legal-acceptance-record-is-undeletable-pii]]),
so between releases every one of these gates can only flip false→true, which is
what makes the locked re-check in `updateVendorProfile` sufficient.

VEN-708 (v1.0→v1.1, Terms too) was the first real bump: clean; VEN-730 (v1.2)
and VEN-740 (v1.3, copy trim) clean the same way. Every gate reads
the constant, so a bump re-gates publish/checkout/accept and leaves payout owed;
the only artefacts to check are the manifest hashes (`shasum -a 256` the two
`.md` files) and that `scripts/legal-manifest.mjs` refuses same-version repins.
A frontmatter-only edit still changes the bytes, so it forces a bump.
