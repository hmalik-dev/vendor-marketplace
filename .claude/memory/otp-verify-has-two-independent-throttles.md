---
name: otp-verify-has-two-independent-throttles
description: email-otp/verify-email (and reset-password) can 429 from our own proxy OR 403 with code TOO_MANY_ATTEMPTS from Better Auth itself — both must map to the same client outcome
metadata:
  node_type: memory
  type: project
  originSessionId: c10cdd63-9acc-4c75-98a2-e5bcb594ed64
  modified: 2026-09-22T23:57:26.213Z
---

`apps/web/src/lib/auth/auth-requests.ts`'s `outcomeOf` used to fold any HTTP 429
from the same-origin Neon Auth proxy into the same `'rejected'` outcome as a
genuinely wrong/expired code, so a rate-limited customer saw "That code did not
work" instead of a wait-and-retry message (fixed in #418, VEN report
2026-09-22). The fix added a distinct `'throttled'` `AuthOutcome`.

**There are two independent throttles on this endpoint, not one.** Our own
proxy (`proxy-throttle.ts`) enforces a per-address budget (5 calls / 10 min) and
answers 429. But Better Auth's own per-code attempt limiter *separately*
answers **HTTP 403** with body `{"code":"TOO_MANY_ATTEMPTS"}` — this was only
found by live-driving the browser through 5 wrong-code submissions in a lane; no
unit test surfaced it, because the unit tests mock the fetch response and
nobody had seen this shape before. The fix inspects the 403 body for that code
and treats it the same as the 429.

**Why:** unit/component tests (188+ passing) gave full confidence the 429 path
was fixed, but the reported bug was still reproducible live via this second
path — matches [[verify-with-a-differently-shaped-check]] and
[[guard-a-delegated-browser-pass-with-a-liveness-watch]]'s spirit: a passing
test suite proved the mechanism you thought of, not the one you didn't.

**How to apply:** any future auth-proxy throttle/rate-limit work on this
endpoint family (`email-otp/verify-email`, `email-otp/reset-password`) should
be verified live (5+ rapid wrong submissions in a running lane), not just
against mocked fetch responses — the 403/`TOO_MANY_ATTEMPTS` shape is
undocumented behavior from Better Auth itself, not something in this repo's own
code you'd find by reading `proxy-throttle.ts`.
