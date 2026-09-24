---
name: server-side-fault-injection-via-proxy
description: How to fail one API route for a Next server-side read: outside-repo reverse proxy + web build baked with the proxy origin; API paths are /v1/*
metadata:
  type: reference
---

A Next server read cannot be intercepted by page.route. Working recipe (VEN-668): a node proxy in the job tmp dir (port lane+100, forwards to the lane API, 500s on a flag file), then `lane:exec <id> -- env NEXT_PUBLIC_API_URL=<proxy> API_URL=<proxy> pnpm --filter @vendor-marketplace/web build` and `next start --port <lane web port>`. Toggle the fault by touching/removing the flag, no restart.

- API routes are prefixed `/v1` (`/v1/bookings`, `/v1/booking-requests`); a proxy matching bare `/bookings` silently never fires. Check the proxy log shows PASS lines in the control run before trusting a fault run.
- The API runs without a build: `pnpm lane:exec <id> -- pnpm --filter @vendor-marketplace/api exec tsx src/index.ts` with RATE_LIMIT_MAX set.
- Don't `Read` `.env.lane`: it holds live storage keys and prints them. Ports are `PORT`/`WEB_PORT` and are derivable from the task.
- Next error boundary Try again on a server-render fault does re-fetch (reset + refresh works once the fault is gone).
