---
paths:
  - 'packages/shared/src/env/**'
  - 'apps/api/src/config/env.ts'
  - 'apps/web/src/config/env.ts'
  - '.env.example'
  - 'turbo.json'
---

# Environment variables live once

The registry is `packages/shared/src/env/registry.ts`. `.env.example` and
`turbo.json`'s `globalPassThroughEnv` are **generated** from it by
`pnpm env:example`, and a test in `packages/shared` fails if either has drifted.

**Never add a variable to `.env.example` by hand.** Add the row to the registry
and regenerate.

`apps/api/src/config/env.ts` and `apps/web/src/config/env.ts` derive their Zod
schemas from the same rows, so presence, shape and defaults cannot disagree.

## Capabilities

Every ticket declares its capabilities — `core`, `auth`, `storage`, `stripe`,
`email`, `sentry`; `e2e` is implicit — in `packages/shared/src/env/tickets.ts`.
`pnpm preflight --ticket <n>` checks only those, so a ticket that never touches
Stripe is never blocked on Stripe keys.

## A development default must never be able to reach production

A fallback that keeps a laptop working — a localhost origin, a permissive flag, a
stub key — is silently wrong once deployed, and nothing fails loudly to say so.
When you add or touch one, make the deployed environment either supply the real
value or fail: derive it from something the platform sets, or throw. Assert the
production branch in a test; a default is exactly the code no test covers.

The mechanism is already built, so use it rather than a new conditional
(**#406**). `packages/shared/src/env/deployment.ts` answers "am I deployed?" —
`isDeployedBuild` for a build, `isDeployedRuntime` for a booting server, plus a
`DEPLOYMENT_PLATFORM` declaration for a host it does not name. The `'deployed'`
`ShapeTarget` is what both apps validate against there: it refuses every
per-environment default and every loopback URL, and applies no live-key
restriction, because staging is a deployment too. A new platform is one entry in
that file's table, not a second `RAILWAY_PUBLIC_DOMAIN`-style read somewhere.
