---
name: production-api-intentionally-down
description: The Railway production API is deliberately removed — `Application not found` is expected, not an outage
metadata:
  type: project
---

**The production API is intentionally down, as of 2026-08-31.** The user removed
the Railway service because the app has no users yet and does not need to be on
production, and a running service costs usage.

So `https://vendor-marketplace-production.up.railway.app` answers **404
`{"status":"error","code":404,"message":"Application not found"}` on every
path** — `/ready`, `/health`, `/`, anything. That is Railway's edge response for
a hostname with no application bound to it. It is the expected state.

**Why:** on 2026-08-31 two sessions independently probed it, confirmed the 404
across five paths with distinct request ids, correctly established that nothing
was bound to the hostname, and then both concluded "production is down" and
raised it — one of them to the user's phone. Every measurement was right; the
sentence built on them was wrong, because a deliberate teardown and a failed
deploy are indistinguishable from outside the repo. Nothing in the codebase
records the decision, so there was nothing to check it against.

**How to apply:** treat the 404 as expected. Do not file it, do not notify, do
not try to redeploy or restore the service, and do not read it as #20's deploy
pipeline failing or as #362 needing a console action — there is nothing to
restore unless the user decides to bring it back. If a check depends on the
production API answering, that check cannot pass right now and that is not a
defect either.

**The generalisation worth keeping.** Before calling an absence a defect, ask
**who would have had to act for this state to be intentional.** A removed
service, a disabled key, a paused deployment and a broken one all look identical
from a probe. That question is for the user, not for another measurement — and
it is the one that would have prevented the false alarm.

`Post-deploy smoke` fails as a consequence, but it was **already failing before
the teardown** — 60 consecutive runs, gating nothing. That is a separate, real
finding and belongs to #340's CI wiring; do not treat this memory as covering it.

Related: [[vendor-marketplace-vercel-deployment]],
[[vendor-marketplace-neon-dev-branch]]
