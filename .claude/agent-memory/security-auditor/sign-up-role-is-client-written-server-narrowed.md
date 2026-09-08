---
name: sign-up-role-is-client-written-server-narrowed
description: unsafeMetadata.role is client-writable and admin is refused only by normalizeRole in the API; everything on the sign-up screen is chrome, including #464's bounded challenge wait
metadata:
  type: project
---

`SignUpForm` passes `unsafeMetadata={{ role }}` to Clerk's `<SignUp>`. That
field is writable by whoever holds the browser — a person can set
`role: 'admin'` from the console without touching our code at all. The only
thing that refuses it is `normalizeRole` in
`apps/api/src/modules/users/users.service.ts`:

```ts
USER_ROLES.includes(value as UserRole) && value !== 'admin' ? value : 'customer';
```

It is called from exactly one place — `toNewUserRow`, on initial row creation —
and both readers of the hint (`plugins/clerk-auth.ts`, the Clerk webhook's
`clerk.service.ts`) pass the raw value through to it unnarrowed on purpose. The
client-side `asSignUpRole` in `sign-up-form.tsx` is a second, weaker copy that
exists to keep the picker honest; it is not the gate.

**Why:** the sign-up screen keeps growing client state — a role picker, a
read-back off the in-flight attempt, and since #464 a bounded challenge wait
with a `key` bump that remounts `<SignUp>`. Every one of those is chrome. The
bot challenge is enforced by Clerk's backend on `POST /v1/client/sign_ups`, and
the role is enforced by `normalizeRole`; nothing this component does can mint a
Turnstile token or widen a role. See [[canbook-is-chrome-not-a-gate]] for the
same shape on the booking side.

**How to apply:** a diff on `apps/web/src/components/auth/` is a UX change until
it changes what `unsafeMetadata` carries or adds a direct `useSignUp()`
`.create()` / `.update()` call. Those two are the boundary. If a
challenge-free sign-up path is ever added (email-code without a password — still
open in `design/design-plan/99-open-questions.md` as of 2026-09-08), that _is_
the bot-protection change and it is a Clerk dashboard setting, not a code one.

Two smaller things established while auditing #464, worth not re-deriving:

- CSP already allows `https://challenges.cloudflare.com` on `script-src`,
  `frame-src` and `connect-src` via `CLERK_HOSTS` in
  `apps/web/src/config/security-headers.ts`, so a blocked challenge is never
  our policy's doing. See [[csp-unsafe-inline-is-a-recorded-tradeoff]] before
  touching that list.
- `challenge-stall.ts` reads `performance.getEntriesByType('resource')`. Entry
  _names_ on the Clerk **development** instance can carry `__clerk_db_jwt` in
  the query string (Clerk's cross-domain session handoff), and this repo's
  deployed origin runs on that dev instance
  ([[deployed-origin-shares-the-dev-clerk-instance]]). The current code only
  regex-tests names and discards them — never log, render or report a resource
  entry from this page.
