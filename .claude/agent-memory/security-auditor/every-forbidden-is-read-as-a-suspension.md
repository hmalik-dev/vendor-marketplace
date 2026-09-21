---
name: every-forbidden-is-read-as-a-suspension
description: terminalRefusal maps every 403 FORBIDDEN to 'suspended', and the API throws that code at ~25 ordinary tenancy and state refusals — widening its reach routes an account in good standing to /suspended
metadata:
  type: project
---

`terminalRefusal` (`apps/web/src/lib/terms-gate-paths.ts:45`) answers
`'suspended'` for **any** 403 whose code is not `TERMS_REQUIRED` or
`VENDOR_NOT_INVITED`. `ERROR_CODES` has no suspension-specific code: the API's
`forbidden()` helper carries `FORBIDDEN` at the two real suspension sites
(`plugins/neon-auth.ts`, `modules/users/users.service.ts`) **and** at ~25
tenancy and state refusals — "Only the customer can cancel", "The customer
accepts the quote", the moderation hold, "You cannot ban your own account",
"That image belongs to another account".

`/suspended` is a **static page with no verification**: whoever lands there
reads "Your account is suspended".

**Why:** the classifier was written for one screen (`accept-terms-screen`),
where the only 403s really are the gate's. VEN-540 wired it into `useApi`, so
it now judges every client call in the app and every stale-tab action becomes a
false suspension.

**How to apply:** the blast radius is the caller set, not the function. Any
change that moves `terminalRefusal` (or `signedInFailurePath`, its server twin)
to a wider funnel needs a suspension-specific error code first — the two throw
sites are the whole change. Treat a new `forbidden()` in a service as a new way
to tell a good account it is banned until that code exists.

Related: [[terms-gate-is-a-five-state-session]],
[[role-bounce-self-loop-admin-bookings]],
[[validate-before-normalize-return-path]].
