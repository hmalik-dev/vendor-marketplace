---
name: lane-web-404s-every-route-while-wait-http-reports-up
description: wait-http.sh treats a 404 as "up"; a lane next-server can answer 404 on every route (/, /sign-in, /terms) with static chunks 200 and API /ready 200
metadata:
  type: feedback
---

`wait-http.sh` printed `up (404)` for the lane web port and I nearly proceeded. Every page route 404'd (curl `/`, `/sign-in`, `/sign-up`, `/terms`) while `/_next/static/...` was 200 and API `/ready` was 200: a broken/stale `next-server` (dev), not a product 404.

**Why:** the harness counts any HTTP answer as up. **How to apply:** curl `/` and `/sign-in` for 200 before any browser pass; if 404, report BLOCKED (verifier may not restart servers). Also: no documented way to mint a verified disposable Neon Auth account without an inbox (only the persistent newcomer exists).
