---
name: ac12-waitlist-read-path-also-gated
description: VEN-512/582 waitlist submit-and-reload behavior is gate-dependent too, not just the refusal/routing parts
metadata:
  type: project
---

`readMyVendorApplication` (apps/api/src/modules/vendor-invites/vendor-invites.service.ts)
gates on `wouldRefuseVendor`, which is unconditionally `false` whenever
`platform_settings.vendor_invite_only` is off — regardless of whether an
application row exists. So with the gate off: `POST /vendor-applications`
still writes a row and returns `{received:true}` (200), but `GET
/vendor-applications/me` always reports `complete: false`, and both
`/waitlist` and `/sign-up/vendor-details` (which redirect on that flag) can
never show the "you're on the waitlist" terminal screen or recognize a
submission as complete. Confirmed by filling and submitting the real form
(category + state selected, valid payload) and watching it bounce straight
back to the empty form every time.

**Why:** the calling agent (and a first pass of this agent) assumed the
submit-and-land-on-`/waitlist` and reload-redirect checks were
gate-independent, unlike the refusal/auto-routing ones ([[e2e-vendor-blocked-on-payout-setup]]-style
prior finding was about a different gate). They are not — all of AC12's
"terminal screen" behavior needs the gate ON just like AC8/13/18.

**How to apply:** on any future verification pass of VEN-512/VEN-582 in a
lane where `GET /vendor-applications/gate` returns `{vendorInviteOnly:false}`,
report the submit-lands-on-waitlist and reload-shows-waitlist parts of AC12
as BLOCKED (cite `wouldRefuseVendor` and `readMyVendorApplication`), not
PASSED or FAILED. Only the "never-submitted session bounces off /waitlist"
direction is safely testable gate-off, and even that passes for the wrong
reason (gate-off makes `complete` always false, not real incompleteness
detection) — say so rather than presenting it as a clean pass.
