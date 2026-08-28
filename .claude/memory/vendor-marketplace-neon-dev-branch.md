---
name: vendor-marketplace-neon-dev-branch
description: "The app database is a Neon branch; the pre-#17 Docker working data was deleted in the 2026-08-26 rename"
metadata: 
  node_type: memory
  type: project
  originSessionId: f28db367-56b4-4c7c-8109-9f5fab513cb3
  modified: 2026-08-26T18:50:36.423Z
---

The application database is **Neon**, project `dark-surf-79137727`.
Local development runs on the `dev` branch (created 2026-08-26 off `production`);
`pnpm preflight` fails if `DATABASE_URL` resolves to `production` while
`NODE_ENV` is not `production`.

The Postgres service in `docker-compose.yml` is **not** the app database — it is
kept only for offline work. MinIO in the same compose file *is* used on every
run, as the local stand-in for Cloudflare R2.

**Gone:** the working data from tickets #2 and #3 (6 users, the "Sunlit Studio"
vendor profile) lived in the Docker Postgres volume, never in Neon — those
tickets were browser-verified against Docker before `.env` was switched, and
nothing noticed the data did not follow. On 2026-08-26 the `vendorhub-*` volumes
were deleted as part of the rename, at the user's explicit instruction. It is
not recoverable. Neon `dev` has migrations plus reference seed only — 11
categories, 43 tags, zero users.

**Why:** this is exactly the failure [[vendor-marketplace-local-ticket-tracker]]'s
ticket #17 was built to prevent, and it is why the branch-safety check exists.

**How to apply:** do not assume vendor/user fixtures exist on the Neon `dev`
branch — create whatever a flow needs. There is no longer any older data to
migrate from. Related: [[vendor-marketplace-no-docker]],
[[vendor-marketplace-playwright-verification]].
