---
name: background-work-queue-carries-no-session
description: app.background (#408) runs work after the response; today the only member is the notification email, whose recipient comes from notifications.userId, so nothing queued makes an authorization decision — that invariant is what a new queued task must preserve
metadata:
  type: project
---

`apps/api/src/lib/background.ts` + `apps/api/src/plugins/background.ts` decorate
the instance with `run(work)` / `drain()`. `drain` is wired to `onClose` and is
also what `TestHarness.flushEmail()` calls, so suites wait on the production
path rather than a test-only one.

**The trust-boundary fact:** the only thing queued is
`queueNotificationEmail` → `sendNotificationEmail`, which closes over
`NotificationEmailDeps` (`db`, `email`, `log`, `webOrigin`) and one
`NotificationEmailRow`. It captures **no `AuthenticatedUser`, no bearer token and
no transaction handle** — the recipient address is re-derived from
`notifications.userId` at send time via `findUserEmail`. Every route builds the
deps from `app.db` / `app.email`, never from a `tx`, so the task cannot outlive a
transaction it was reading inside.

**Why:** work that runs after the response is exactly where a captured session
becomes stale authority — the caller may be banned, role-changed or deleted by
the time it runs, and nothing re-checks. Today no queued task branches on the
caller at all, which is why that never bites.

**How to apply:** if a diff adds a second `background.run(...)` caller, confirm
it re-derives every authorization input at execution time instead of closing over
the request's `authenticated(request.auth)`. Also confirm it does not close over a
`tx` — `db.transaction` handles are dead once the callback returns, and the
dispatch is synchronous so a `run` inside a transaction fires before commit.

Related: [[idempotency-guards-orphan-side-effects]].
