---
name: stream-route-auth-is-hand-rolled
description: GET /events/stream deliberately carries no requireAuth — its ticket consume, ban check and identity all live inline in the handler, so guard-shaped reviews read it as unguarded
metadata:
  type: project
---

`GET /events/stream` (`apps/api/src/modules/messaging/messaging.routes.ts`) is
the one route in the API that sits beside guarded siblings with **no
`preHandler: requireAuth`**, and that is correct rather than an omission. #215
(landed on branch `worktree-215`) moved it off the session JWT-in-query scheme:
the auth plugin no longer reads a query token at all, so `requireAuth` would
reject every stream. The handler instead does inline what the guard used to do —
consume a single-use ticket from `StreamTicketStore`, re-read the account with
`findUserById`, and 403 a banned one.

Three properties hold the route together, and each is easy to delete by
accident:

- **The consume precedes every other check**, so a replay is spent even when the
  account is banned or gone. Moving the ban check first would make an expired
  ticket survive a failed attempt.
- **The identity comes only from the stored ticket**, never from a request
  parameter. `EventHub` keys on internal `users.id`, the same value
  `request.auth.id` carries and the same value `messaging.service` and
  `booking-requests.service` publish to. A ticket cannot name another user
  because the issuing route (`POST /events/stream-ticket`) takes the id from
  `authenticated(request.auth)` and accepts no input.
- **The ban re-check exists because the guard no longer runs.** A stream, once
  open, stays open forever — there is no re-authentication after connect, for a
  ticket or for the JWT before it.

**VEN-670 (audited 2026-09-23):** `/internal/session-generation` now calls
`closeFor(users.id)` after the `sessions_invalidated_at` bump (auth id → row id
via `RETURNING`, sound; web-tier-key-gated, so only the account's own sign-out
or reset can force a close — no third-party DoS). The gap: `stream_tickets` are
not cleared by the bump. Since fixed: the bump calls `streamTickets.revokeFor`,
and `resolveStreamSubject(db, id, openedAt)` refuses a stream opened before
`sessions_invalidated_at`.

**VEN-611 (audited 2026-09-24, accepted):** the re-read moved from every 30s
beat to every 5 min (checked on a beat, so the real bound is about 5m30s). Every
in-app revocation also calls `closeFor` on the instance it runs on: ban and
closure through `unwindAccountBookings`, the session bump directly. So only
another instance's write waits for the re-read, and `EventHub` is in-process, so
multi-instance delivery is already unsupported (VEN-462). Reopen if a ban or
delete path skips the unwind, or when VEN-462 adds replicas.

**Stream budget (VEN-706, 2026-09-24):** `useEventStream` opens one `EventSource`
per _hook call_ despite its "one for the whole app" doc; `MAX_STREAMS_PER_USER`
is 5 and the sixth gets a 429 the client backs off from, then gives up after
six attempts. Bell + `MessagesLink` + messages screen = 3 per tab on
`/messages`, 2 elsewhere, so the 3rd tab loses live updates. Count hook callers
whenever a diff adds one.

**Why:** a reviewer scanning for route guards, or a refactor that "restores
consistency" by adding `requireAuth`, breaks live updates outright and looks
like a security improvement while doing it.

**How to apply:** when auditing this route, read the handler body, not the route
options. Treat a `requireAuth` appearing on `/events/stream` as a regression, and
treat the removal of the `findUserById` / `isBanned` block as the real missing
guard. Related: [[log-redaction-covers-query-not-path]].
