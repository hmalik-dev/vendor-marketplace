---
name: wait-http-passes-on-404-dev-server-with-no-routes
description: wait-http.sh prints "up (404)" for a lane web server that 404s every route incl. /sign-in; curl 3-4 real routes before starting a pass
metadata:
  type: project
---

VEN-706 pass (2026-09-24): `wait-http.sh` reported `up http://localhost:3009 (404)`; every
route (`/`, `/sign-in`, `/bookings`, `/search`, `/icon.svg`) rendered the branded not-found
page with HTTP 404, `next dev` had started ~1 min earlier, `.next-dev` existed (trace file open)
but never routed. The API on 4009 was healthy (`/ready` 200).

**Why:** the script treats any HTTP answer as "up"; a 404 on `/` is not a healthy signal.

**How to apply:** right after wait-http, `curl -o /dev/null -w '%{http_code}'` `/`, `/sign-in`,
`/search`. If all 404, report BLOCKED (do not start/restart servers) with those codes; the
`.next-dev` dir is denied to Bash `ls`/`find`, so you cannot inspect it.
