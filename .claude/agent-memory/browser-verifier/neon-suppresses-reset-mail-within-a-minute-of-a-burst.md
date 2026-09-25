---
name: neon-suppresses-reset-mail-within-a-minute-of-a-burst
description: after 5 request-password-reset sends in a burst, an allowed (200, recorded, not proxy-refused) request within ~60s gets no mail; the provider, not the proxy, drops it
metadata:
  type: project
---

VEN-718 pass (2026-09-24): a stranger's 5 sends for one address, then the owner's allowed request 15s and 40s later (page showed success, `throttle_hits` recorded the owner caller) delivered NO Mailosaur message; the same request 77s after the burst delivered. Two callers 1s apart, and 5 in 0.15s, all delivered, so it is a ~60s window after a burst, not a per-second cooldown. Cannot be told from a proxy refusal by the page alone: read `throttle_hits` (bucket `pair|<route>|sha256(addr)|sha256(caller)`, via a `/tmp` script using `createRequire` on packages/db's `postgres`, run by `pnpm lane:exec`).

**How to apply:** when a criterion says "the owner's mail arrives after a stranger's burst", wait 70s+ between burst and owner request (check `date -u`, not the tool's reported wait; parallel tool calls make the wait start earlier than it looks). Mailosaur's message listing also lags 1-15s, recount before calling a mail missing. Also: `browser_run_code_unsafe` listeners using `new URL()` throw "URL is not defined" and reset the page to about:blank and the viewport to 1280.
