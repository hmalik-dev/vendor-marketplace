---
name: ac4-assertwebenv-blocks-unset-cookie-secret-boot
description: next.config.ts's module-level assertWebEnv() requires NEON_AUTH_COOKIE_SECRET unconditionally, so a lane started with it genuinely empty/unset crashes next start before serving any page — a fixture that asks to boot without it cannot be driven live
metadata:
  type: project
---

`apps/web/next.config.ts` calls `assertWebEnv()` at module scope, which Next.js
re-evaluates on every `next start` boot (not just `next build`). `NEON_AUTH_COOKIE_SECRET`
(and `NEON_AUTH_BASE_URL`) have no `optionalFor` entry in
`packages/shared/src/env/registry.ts`, so they're required for every target
including `baseline`. Starting the web app with the var genuinely empty
(`env NEON_AUTH_COOKIE_SECRET= pnpm --filter @vendor-marketplace/web exec next
start`) throws `Invalid web environment configuration` and the whole process
exits — no page renders, nothing to drive in a browser.

VEN-635's own diff (`server.ts`, the `/api/auth` proxy, `/api/session/token`)
only handles the config vanishing at **request time** on an already-booted
process (matching the real VEN-631 staging bug: present at build, gone by the
time a serverless function ran). It never touches `next.config.ts` or the
registry, so that graceful-degradation code is reachable in production's
serverless model (config validated once at `next build`, not re-run per
request) but is dead code under a locally self-hosted `next start`, where
config reloads at boot.

**Why:** a verification fixture that says "start the lane without
`NEON_AUTH_COOKIE_SECRET` and drive `/`, `/sign-in`, `/bookings` in a browser"
cannot be produced this way — confirmed twice, deterministically, via the
exact override command. Setting it to empty (not omitting it) is still the
correct way to defeat `next.config.ts`'s own `dotenv.config()` refill from the
root `.env` (dotenv only skips a key it finds via `hasOwnProperty`, so empty
string sticks and unset gets silently refilled with the real secret) — that
part of the diagnostic worked as intended; the crash is a separate, deeper gate.

**How to apply:** don't spend budget hunting for another CLI incantation to
avoid this — it's not an invocation problem, the boot-time gate is real.
**Update:** a faithful repro IS possible without editing source — a
`NODE_OPTIONS=--require=<scratch.cjs>` preload that boots normally (var
present, `assertWebEnv` passes) then `delete process.env.NEON_AUTH_COOKIE_SECRET`
on a `setTimeout` reaches the same long-lived `next start` process (confirmed:
`NODE_OPTIONS` does propagate through `pnpm lane:exec ... env NODE_OPTIONS=... pnpm --filter web exec next start`).
Wait for the preload's own stderr line before driving, not a fixed sleep. With
this, AC4's full surface (`/`, `/sign-in` 200; sign-in submit → "We could not
reach the sign-in service" + 503 `{"code":"AUTH_UNAVAILABLE"}` on
`/api/auth/sign-in/email`; `/forgot-password` submit same copy on
`/api/auth/email-otp/request-password-reset`; `/bookings` → 307 to
`/sign-in?returnTo=...`; `/api/session/token` → 503; a public vendor profile
renders 200 with zero console/page errors) all passed cleanly. So: the
module-level gate blocks a _cold, always-missing_ boot, but not a
_present-then-removed_ one — always try the latter before calling an AC
unexecutable.
