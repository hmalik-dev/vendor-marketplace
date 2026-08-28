---
paths:
  - 'packages/shared/**/*.ts'
  - 'packages/db/**/*.ts'
  - 'apps/api/**/*.ts'
  - 'apps/web/**/*.{ts,tsx}'
---

# Shared contracts

These three rules exist because the database, the API contract and the frontend
can otherwise drift apart silently. Each one has a single source of truth.

## Enums live once

Every domain enum is an `as const` array in `packages/shared/src/constants`.
`pgEnum` in `packages/db` and `z.enum` in `packages/shared/src/schemas` both
derive from it. **Never redeclare a literal union** — a hand-written
`'pending' | 'confirmed'` anywhere is a defect even when it currently matches.

## Money is always integer cents

`price_cents`, `total_amount_cents`, and friends. Convert at the display
boundary with `formatPrice`, nowhere else. A float that holds money is a defect.

## Event dates are Postgres `DATE` and stay `YYYY-MM-DD` strings end to end

Never round-trip one through a `Date` in local time — that is how an event moves
a day when the user is west of UTC. Use the helpers in
`packages/shared/src/utils`.

## Dependency direction is one-way

`apps -> packages`. `packages/shared` never imports from `packages/db` or from an
app. `packages/db` may import enums and constants from `packages/shared`.
`packages/preflight` is a leaf: it depends on `packages/shared`, and nothing
depends on it.
