---
name: route-handlers-do-not-inherit-layout-gates
description: A Next route handler under a gated segment runs with no layout, so /admin/vendors/export authorizes itself; that self-gate is the pattern to check on every new route.ts in apps/web
metadata:
  type: project
---

`apps/web/src/app/admin/layout.tsx` calls `requireRole('admin')` and every page
below it is covered. `apps/web/src/app/admin/vendors/export/route.ts` sits under
that segment and is **not** covered — layouts do not run for route handlers — so
it re-implements the gate inline (`getCurrentUser()` → 401, `user.role !== 'admin'`
→ 403) before touching any data. Verified correct 2026-08-31.

Two things that gate depends on, both easy to break:

- The role comes from `getCurrentUser()`, which reads the API's `/users/me` and
  therefore the local `users.role` column — never Clerk metadata. `normalizeRole`
  (`modules/users/users.service.ts:48`) refuses `admin` from
  `unsafeMetadata.role`, so `admin` exists only where an operator wrote it to the
  database. Nothing in the product grants it.
- `getCurrentUser()` swallows 401/404 and **propagates 403**. A route handler that
  calls it directly turns a suspended operator into an unhandled 500; the pages
  avoid this by going through `requireCurrentUser` → `getCurrentUserOrSuspend` →
  `redirect('/suspended')`.

The console is also the one place the web app _fans out_ to the API in a loop:
the CSV export walks pages until `MAX_PAGES = 50` × `MAX_PAGE_SIZE = 100`. The
bound is real (no unbounded loop) but it silently truncates past 5 000 rows.

**Why:** this repo protects surfaces at the resource, deliberately — the
middleware attaches the Clerk session and guards nothing
(`apps/web/src/middleware.ts`). So a new `route.ts` is unprotected by default and
nothing in the segment above it will say so.

**How to apply:** on any diff adding a `route.ts` under a gated segment, read its
first ten lines for its own auth check before anything else. Do not accept "the
layout handles it".
