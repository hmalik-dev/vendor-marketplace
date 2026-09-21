---
name: ci-e2e-artifacts-are-public
description: The repo is PUBLIC, so any CI artifact (Playwright traces, stack logs) is downloadable by any signed-in GitHub user; ::add-mask:: never applies to artifacts
metadata:
  type: project
---

> **The auth provider is retired** (VEN-447/448/449 moved auth to Neon Auth). The auth provider names below describe the pre-cutover code and are historical; do not act on them as live.

VEN-411 added a CI `e2e` job that signs the real E2E accounts (admin included) into the dev auth instance and, on failure, uploads `playwright-report/`, `test-results/` (trace zips with Cookie headers and storage state) and `stripe-listen.log` (prints `whsec_`) for 14 days.

**Why:** `gh repo view` reports `visibility: PUBLIC`. Log masking covers the console only. The dev the auth provider instance also backs the deployed origin (deployed-origin-shares-the-dev-auth-provider-instance), so a traced admin session is a production admin session until it expires or is revoked.

**How to apply:** any CI step that uploads artifacts from a job holding secrets or signed-in browser state is a finding unless traces are off or stripped and sessions are revoked in an `always()` step. The `::add-mask::` after `$(stripe listen --print-secret)` ordering is sound; do not re-report it.
