---
name: killing-api-port-can-take-down-web-too
description: lsof -ti tcp:<api-port> | xargs kill to drive the 500 error boundary can leave the web port dead too, with no obvious shared parent process
metadata:
  type: project
---

On VEN-739's lane (web 3023, API 4023, both started as separate detached
`pnpm lane:exec ... &` background jobs), killing the listener on the API port
twice left the web port unreachable seconds later too (`curl` on both ports
went to `000`, `lsof` showed no listener on either) — with no shared parent
PID visible in `ps aux` at the time. A third attempt, using freshly
independently-launched processes, killed only the API and web survived,
confirming they are not inherently coupled — but the collateral failure is
real and reproducible often enough to plan for.

**Why:** unclear root cause (resource contention across ~20 concurrently
running lanes on the same machine, or a stale bg process from lane setup
sharing something incidental) — not a code defect in the ticket under test,
so don't report it as one.

**How to apply:** when a ticket's instructions have you stop the lane API to
drive an error boundary, immediately re-check the web port too
(`curl -o /dev/null -w '%{http_code}' <web>/`) before concluding only the API
went down. If web is also dead, restart it the same way it was started
(check the job's `web.log` for the exact `lane:exec ... next start --port
<port>` invocation) before continuing, and budget 2-3 extra Bash calls for
this in any pass that stops a lane server mid-run.
