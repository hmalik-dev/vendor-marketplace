---
name: ven677-change-password-trips-legacy-provider-surface-guard
description: VEN-677's proxied /change-password call and its component filename both trip the pre-existing auth-account-surfaces.test.ts guard, a real test-suite regression to check for on any ticket that adds a Better-Auth-named endpoint
metadata:
  type: project
---

`apps/web/src/app/auth-account-surfaces.test.ts` (VEN-403/447) source-scans for
`FORBIDDEN_ENDPOINTS = /\/(?:change-email|change-password|delete-user|...)\b/g`
to stop a direct client fetch to a Better-Auth-hosted account endpoint. The
regex has no way to tell "calling our own proxy at `/api/auth/change-password`"
from "calling the raw upstream directly" — both contain the literal substring
`/change-password` — so VEN-677's legitimate, allowlisted, proxied call in
`auth-requests.ts` (`post('/change-password', input)`, where `post` prepends
`/api/auth`) fails this guard. A second, unrelated false hit comes from the
component's own filename, `change-password-form.tsx`, imported as
`@/components/account/change-password-form` — `\b` fires on the `-` before
`form`, so the import path alone matches `/change-password\b` too.

**Why this matters:** `pnpm exec vitest run src/app/auth-account-surfaces.test.ts`
was still red on `worktree-ven-677b` at verification time (confirmed via
`git log -- <file>`: the ticket's own commits `57702377`/`60c8a179` introduced
the collision, the guard test itself was untouched). Every other targeted
suite for this ticket was green (`no-raw-upstream-message.test.ts`,
`proxy-allowlist.test.ts`, the `route.test.ts` revokeOtherSessions/
forgetSessionsFor assertions, `auth-requests.test.ts`,
`change-password-form.test.tsx` — 36+87+36 tests, all passing), so this one
regression is easy to miss if a verification pass only runs the tests the
ticket names instead of the surrounding suite.

**How to apply:** for any ticket that adds a route or literal path matching
one of Better Auth's own endpoint names (`change-email`, `delete-user`,
`update-user`, `link-social`, `unlink-account`, `set-password`, and now
`change-password`), also run `auth-account-surfaces.test.ts` — it is not named
by the ticket's own acceptance criteria but the collision is exactly on-topic.
The fix belongs to the guard, not the feature: drop the newly-allowlisted verb
from `FORBIDDEN_ENDPOINTS` (the proxy allowlist + no-raw-upstream-message
tests already cover its safety) rather than renaming the legitimate call.
