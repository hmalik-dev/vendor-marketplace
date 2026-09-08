---
name: restart-the-lane-api-after-a-rebase-too
description: A rebase that rebuilds dist leaves the lane API serving old code unless it is restarted; the symptom looks exactly like the diff under test breaking the admin layout
metadata:
  type: project
---

**After a rebase, restart *both* lane processes — the API as well as the web
server.** A rebase that pulls in other lanes' work rebuilds `apps/api/dist`, and
a `node dist/index.js` started before that is still running the old build.

Found 2026-09-07 on lane 454. The post-rebase `turbo build --force` rewrote
`apps/api/dist` at 21:01; only the web server was restarted, so the web ran
current code against an API process from 20:17. **Every `/admin` route answered
500** — because #436 had made `subjectType`, `subjectId` and `reportReason`
required-nullable on `adminCaseRowSchema`, the stale API omitted them, and the
web's `wireAdminCasePageSchema` parse threw inside the layout every console page
shares.

**The symptom is indistinguishable from the ticket being broken.** Nine
unrelated pages 500 with one shared error digest, on the diff that touched the
admin console. A browser pass reports the feature dead.

**This is [[rebase-auto-merges-are-not-compile-checked]] extended past compile
time into runtime.** The tree compiled, `pnpm test` was green across seven
packages, and the two running processes disagreed with each other — nothing in
the local gate can see that, because the gate never runs the built API against
the built web. It is the runtime sibling of
[[a-lane-web-build-must-be-made-under-the-lane-env]].

**Diagnose it with a differently-shaped check, per
[[verify-with-a-differently-shaped-check]]**: ask whether a *route* that landed
in the same commit as the schema change exists. `POST /reports` answered 404 on
the stale process and 400 on the restarted one — a question about routing rather
than a second read of the same serialized row.

**Why:** a lane owns its processes, and `lane:up` starts them once. Nothing
re-launches them when a later build replaces the artifact underneath, so the
staleness is silent until a schema contract crosses the two.

**How to apply:** after `git rebase` + `pnpm install` + `turbo build --force`,
restart the lane API *and* the lane web server before any browser pass. If a
browser pass reports every page of one surface 500-ing with a single digest,
check the API process's start time against `apps/api/dist/index.js`'s mtime
before believing the diff caused it.
