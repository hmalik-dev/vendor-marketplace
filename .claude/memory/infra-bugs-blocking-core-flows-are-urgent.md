---
name: infra-bugs-blocking-core-flows-are-urgent
description: "Infra/deploy bugs that break auth or core flows on a deployed tier are Urgent and must be found by probing the deployed runtime, not by reading code or trusting a green release"
metadata:
  node_type: memory
  type: feedback
  originSessionId: ca6f4644-9c80-432b-85ab-1742d6f5b979
  modified: 2026-09-23T01:18:38.790Z
---

An infrastructure or deploy-pipeline defect that blocks auth or a core flow on staging or production is Urgent, and that is not negotiable. Such defects have to be found before the user runs into them.

**Why:** on 2026-09-22 the user found for themselves that staging auth was down, with every `/api/auth/*` call returning 500 (VEN-631). The cause was a branch-scoped Vercel Secret that never reached the `--prebuilt` runtime. Two earlier fixes (VEN-573, VEN-575) and a green release had all missed it, because the release's readiness gate only checks the API's `/ready`, never the web runtime. Code-level audits and lane passes cannot see this class of bug.

**How to apply:**
- Every audit or hunt includes live probes of each deployed tier: auth endpoints must return a 4xx refusal, never a 5xx. Also check SSR pages, CORS and webhooks, and read `vercel logs` / Railway logs for thrown errors.
- Compare staging with production. A difference between them is a finding.
- File these as priority Urgent, and fix them ahead of feature work.

Related: [[environments-model-and-provider-gotchas]], [[vercel-deploy-check-always-fails]], [[friends-beta-needs-no-domain]].
