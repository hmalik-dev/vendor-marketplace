---
name: ready-probe-is-unthrottled-and-now-reads-a-file
description: /ready is unauthenticated and config rateLimit:false by design; VEN-495 added a per-request readFileSync of drizzle's journal and a public "behind" state
metadata:
  type: project
---

`GET /ready` (`apps/api/src/modules/health/health.routes.ts`) carries
`config: { rateLimit: false }` deliberately — a throttled probe takes the
service down by itself — so every byte of work it does is anonymous,
unmetered work. It already round-trips the database and object storage per
request; VEN-495 added `expectedMigrationCount()`, a **synchronous**
`readFileSync` + `JSON.parse` of `packages/db/drizzle/meta/_journal.json` on
the event loop, per request, for a value that cannot change while the process
lives.

**Why:** the DB/storage probes are async and only occupy the loop briefly; a
sync read blocks every other in-flight request for its duration. It is the
first blocking syscall on the one route the limiter cannot protect.

**How to apply:** anything new added to `/health` or `/ready` must be async or
computed once at module load. Also check the throw path — the journal read is
outside `probe()`, so an unreadable journal makes `/ready` a 500 (opaque body,
path in the log only) rather than a 503 naming a dependency.

Disclosure side is settled: the response publishes `database: 'behind'` and
`commit` to anonymous callers (commit was already public); the applied/expected
counts stay in `request.log.error` as integers. See
[[err-serializer-is-the-log-sink]] and
[[error-handler-4xx-passthrough-leaks-sdk-messages]] for why the 500 body is safe.

**The web's `/api/ready` publishes `runtimeEnv` presence booleans** (VEN-632,
audited PASS 2026-09-22): five names, `Boolean(process.env[name])`, never a
value. Accepted: constant `true` on a healthy tier; a `false` only discloses a
misconfiguration the release gate already refuses (e.g. `WEB_TIER_KEY` false
means the auth proxy throttle fell back to per-instance counts). Do not
re-report; do re-open if a value, length or prefix is ever added.
