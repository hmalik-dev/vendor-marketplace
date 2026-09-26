---
name: every-forbidden-is-read-as-a-suspension
description: terminalRefusal still maps every 403 but TERMS_REQUIRED/VENDOR_NOT_INVITED to 'suspended'; useApi narrows it to ACCOUNT_SUSPENDED, the server twin does not
metadata:
  type: project
---

`terminalRefusal` (`apps/web/src/lib/terms-gate-paths.ts:47`) answers
`'suspended'` for **any** 403 whose code is not `TERMS_REQUIRED` or
`VENDOR_NOT_INVITED` — including VEN-701's `NAME_REQUIRED`. `/suspended` is a
static page with no verification.

**Current state (checked 2026-09-24, VEN-701):** `useRefusalRedirect`
(`apps/web/src/lib/use-api.ts:65`) now treats only `ERROR_CODES.ACCOUNT_SUSPENDED`
as terminal, so the client funnel is safe for new 403 codes (`NAME_REQUIRED` is
tested there). The unfixed reach is the **server** twin
(`signedInFailurePath`) and `accept-terms-screen`.

**Why:** the classifier was written for one screen where the only 403s were the
gate's; `forbidden()` carries `FORBIDDEN` at ~25 ordinary tenancy/state refusals.

**How to apply:** a new 403 code is safe on `useApi`; check whether any server
read (RSC) can receive it before it reaches `terminalRefusal`. Only writes are
gated by `NAME_REQUIRED`, so no server read hits it today.

**VEN-763 (2026-09-25, PASS):** `/suspended` is now dynamic and reads
`details.role` off the auth plugin's `ACCOUNT_SUSPENDED` for one refund sentence.
The refusal fires only after token verify, the deleted-row 401 and the
`sessions_invalidated_at` 401, so only the token's own account sees its own role
(admin included) — not a leak. Other throwers (stream, vendor publish) carry no
details and the page falls back to no refund claim. Do not re-raise.

Related: [[terms-gate-is-a-five-state-session]],
[[role-bounce-self-loop-admin-bookings]],
[[validate-before-normalize-return-path]].
