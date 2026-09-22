---
name: newcomer-identity-is-single-use-per-lane-pass
description: VEN-512/584 - inviting the no-row newcomer from admin is a one-way progression; test every pre-invite AC first
metadata:
  type: project
---

The `E2E_NEWCOMER_EMAIL` identity (VEN-447) is a persistent **Neon Auth**
account shared across every lane, but its local `users` /
`vendor_applications` / `vendor_invites` rows are lane-private (fresh Docker
Postgres per lane). Signing up fresh with it always 422s ("We could not
create that account") because the Neon Auth identity already exists globally
— the literal "fresh email, enter the emailed code" step of AC8-style tickets
is **not reproducible**; use Sign In instead (the accurate equivalent for an
already-registered-but-no-app-row identity) and say so.

Once you click **Invite** in `/admin/vendor-applications` and then sign the
newcomer back in as the invited vendor, the local `users` row is created
(`role: vendor`) and there is **no safe way back**: auto-mode denies both a
scoped `DELETE` of the newcomer's `users`/`vendor_applications`/
`vendor_invites`/`legal_acceptances` rows (classified "Irreversible Local
Destruction") and a plain signed-out `browser.newContext()` navigation
attempted right after (classified "Modify Shared Resources", apparently
state carried over from the prior denial). So the "waitlisted vendor,
already complete, not yet invited" state — needed for AC18's
`/vendor/*`, `/dashboard`, `/bookings`, `/messages` → `/waitlist` redirect
matrix and for "signing in lands on `/waitlist`" — is gone the moment you
invite.

**Why:** discovered 2026-09-22 verifying VEN-584 (gate-on lane for VEN-512).
I inherited a pristine no-row newcomer, drove AC8 end-to-end (submit details
→ admin invite → sign back in → becomes vendor) before realizing AC18 needed
the pre-invite waitlisted state I had just consumed.

**How to apply:** on any pass using this identity, plan the full AC list
first and **test every "waitlisted, not yet invited" criterion (the route
redirect matrix, "signing in lands on /waitlist", reload-redirect
directions) before ever clicking Invite in the admin panel** — invite last,
since it is the one irreversible step in the flow and there is no in-session
recovery from it.
