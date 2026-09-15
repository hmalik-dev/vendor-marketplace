---
name: e2e-auth-session-ages-out-within-one-pass
description: A .auth/<role>.json minted by pnpm e2e:auth can go from working to a real server-side sign-in redirect within a few minutes of the same verification pass, not just across lanes/days
metadata:
  type: project
---

On lane 402, `pnpm lane:exec 402 -- pnpm e2e:auth` minted all three roles at
once. A scratch-script check of `vendor.json` succeeded immediately after
(home read signed-in, `/vendor/agreement` rendered). The same script, re-run a
few minutes later with no change to the file, showed `Sign in` links on the
warm-up navigation, and — after the two-navigation-plus-reload sequence
[[stored-auth-state-needs-marker-wait-not-fixed-sleep]] calls for — `/vendor/agreement`
did a real **server-side redirect to `/sign-in?returnTo=...`**. That is not the
first-paint artifact #321 describes (which clears after a second render): the
redirect target proves the session was genuinely rejected, not just
unresolved yet.

**Why:** the stored `__session` cookie is a short-lived JWT (the one captured
in lane 402 had a 60-second `iat`/`exp` window); a real browser keeps it alive
via clerk-js's background silent-refresh network calls, which a short-lived
headless script exercising just a handful of `page.goto()` calls apparently
doesn't reliably trigger before the window closes.

**How to apply:** don't mint auth once and assume it's good for an entire
multi-role verification pass. Mint (or re-mint) the specific role's storage
state immediately before the script that consumes it — `pnpm lane:exec <n> --
pnpm e2e:auth <role>` — and run the check right away rather than batching
several roles' scripts back-to-back with edits/reads in between. If a script
shows `Sign in` links after the warm-up-navigate-then-reload sequence, or a
protected route server-redirects to `/sign-in`, that's a stale session to
re-mint, not a product defect — but don't reflexively blame this for every
signed-out reading; confirm via the redirect target (`/sign-in` = expired
session; a redirect to some other authenticated route = real role-based
denial, which **is** evidence).
