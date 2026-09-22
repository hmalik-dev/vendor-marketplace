---
name: neon-github-actions-branch-per-pr
description: "Neon's GitHub Actions workflow (neon_workflow.yml) creates a database branch per PR and deletes it on close; noted from Neon console setup text, not yet adopted"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 79723015-3e6f-49b6-93b8-c393bae74fd3
  modified: 2026-09-20T16:34:54.178Z
---

Neon Console's "Setting up your GitHub Actions workflow" guide: add a `.yml` (e.g. `neon_workflow.yml`) under `.github/workflows/`, commit it, and each pull request gets its own Neon database branch (visible on the Branches page in the Neon Console). Closing the PR deletes the branch.

The pasted text did not include the YAML itself. Fetch it from the Neon Console or the neon skill/docs before adopting; do not invent it.

**Why:** user asked to note it on 2026-09-20 while wiring up Railway/production. Not decided or ticketed yet. Related to per-lane and per-preview Neon branches (VEN-457) and to [[neon-dev-and-staging-are-safe-production-is-not]].

**How to apply:** if PR/preview database branches come up, this is the candidate mechanism. Any adoption is a ticket, and any Neon credentials for it live in GitHub secrets, never in the repo ([[credentials-env-files-only]]).
