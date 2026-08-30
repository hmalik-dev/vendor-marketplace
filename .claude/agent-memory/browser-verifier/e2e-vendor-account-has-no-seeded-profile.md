---
name: e2e-vendor-account-has-no-seeded-profile
description: The E2E vendor test account (vendor+clerk_test@example.com) is not linked to any of the 16 seeded demo vendor_profiles / 918 bookings — it starts as a brand-new, profile-less vendor
metadata:
  type: project
---

On lane 307 (2026-08-30), signing in as the documented E2E vendor account and
navigating to `/vendor/dashboard`, `/vendor/bookings` or `/vendor/availability`
all client-side redirected to `/vendor/profile/edit` ("Create profile", every
field empty). A DB check confirmed why: `vendor_profiles` had 16 rows, all
under synthetic `*@orla-demo.example` emails with 918 total `bookings`, but
`vendor+clerk_test@example.com` had zero `vendor_profiles` rows — it's a
freshly-provisioned `users` row (role `vendor`) with no linkage to the seed
data at all. `packages/db/src/seed.ts` and `seed-marketing.ts` never reference
the `+clerk_test` accounts.

**Why:** the marketing/reference seed (16 vendors, 918 bookings) and the E2E
auth accounts (`pnpm e2e:auth`, see [[vendor-marketplace-e2e-credentials]]) are
two independent fixture systems that were never wired together. Seeding
creates realistic demo data under its own vendor identities; signing in as the
E2E account via Clerk creates a separate, empty `users` row the first time it
authenticates.

**How to apply:** Any ticket whose acceptance criteria require the E2E vendor
account to already have packages, bookings, or availability data (accept/decline
flows, calendar "Booked" state, request queues, customer-name display, etc.)
cannot be verified out of the box — report it `BLOCKED`, don't try to paper
over it. Building the fixture live through the UI (create profile → package →
have the E2E customer request it) is possible in principle, but the auto-mode
permission classifier blocked even a profile-creation form-fill during this
run (reasonable — a verifier shouldn't be fabricating business data), so route
this back to the caller rather than working around the denial. Confirm the
same gap doesn't affect other lanes before assuming it's fixed.
