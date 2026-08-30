---
name: stored-auth-state-needs-marker-wait-not-fixed-sleep
description: A freshly-loaded .auth/*.json storage state can render the client-side header as signed-out for several seconds/reloads even though the server-side session is valid — wait for a DOM marker, not a fixed timeout, and don't let a script sit idle between e2e:auth and first use
metadata:
  type: feedback
---

On lane 215, loading `.auth/customer.json` into a fresh `chromium.newContext({
storageState })` and navigating to an authenticated page (`/bookings`)
repeatedly rendered the **client-side** header as signed-out (`Sign up` link
visible, no `Dashboard` link) even though the sidebar/content was clearly the
real authenticated page. A fixed `waitForTimeout` of 4-8s was not reliable — one
run needed a `page.reload()` after the initial `goto` before Clerk's client SDK
settled into signed-in state; another run needed the storage state to be
regenerated (`pnpm lane:exec <id> -- pnpm e2e:auth customer`) immediately before
use, right before the verification script, rather than reusing a `.auth/`
snapshot that had been sitting for 20+ minutes.

**Why:** Clerk's client-side session token is short-lived and refreshed
transparently, but the refresh/handshake race against Next dev-server
first-compile latency (routes compile on first hit) is inconsistent — sometimes
one `domcontentloaded` navigation is enough, sometimes it silently renders
signed-out and only a reload (which re-runs clerk-js init against
already-warmed cookies) recovers it. There is no reliable fixed sleep duration.

**How to apply:** After loading a storage state and navigating, `waitForSelector`
on a DOM marker that only appears in one auth state (e.g. `a:has-text("Dashboard")`
vs `a:has-text("Sign up")` in this app's header) rather than sleeping a fixed
duration. If the marker says signed-out, don't treat that as ground truth
immediately — retry with `page.reload()` up to a few times before concluding the
session is actually dead. If retries exhaust, regenerate the storage state
(`pnpm lane:exec <id> -- pnpm e2e:auth <role>`) and re-run the check
immediately afterward rather than reusing an older `.auth/*.json`. See
[[clerk-session-lapse-can-500-whole-app]] for the more severe cousin of this
(dev-server middleware wedging into 500s, which a reload does NOT fix).
