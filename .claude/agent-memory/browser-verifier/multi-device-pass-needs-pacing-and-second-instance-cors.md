---
name: multi-device-pass-needs-pacing-and-second-instance-cors
description: A three-device session-revoke pass hammered the lane API into 429s and a wave of 500 server renders; a second web instance on another port also gets no CORS from the API, so its client-side API calls always fail
metadata:
  type: project
---

VEN-717 pass: three contexts signing in as the shared E2E customer (sign-in POST to
`/api/auth/sign-in/email` from `context.request`, 12s apart for the 3-per-10s throttle),
driven from a `/tmp` node script that reads `.env.e2e.local` itself (the Write hook blocks a
literal `PASSWORD = env.X`; read via a helper `cred('PASSWORD')`).

- First unpaced run: `POST /v1/events/stream-ticket` 429s, then server renders on both web
  origins turned 500 for one device. A rerun that paced navigations (6s) and waited 65s after
  the revoke had zero 500s. Same shape as [[lane-429-renders-as-500]]: pace, do not read a 500
  under load as a finding.
- A second web instance (port 3012) is not in the API's CORS allow-list, so every client-side
  `v1/*` fetch from it is blocked (console error, `Failed to fetch`). Environmental, not the
  ticket; only server renders and `/api/session/token` are testable on the second origin.
- Device names in the sessions list come from `deviceLabel(userAgent)` (browser + OS), so use
  UAs that yield distinct labels (Firefox/Linux, Edge/Windows, Safari/iOS) and assert exactly one
  matching revoke button before clicking.
