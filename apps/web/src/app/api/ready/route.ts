import { NextResponse } from 'next/server';

/**
 * The variables the running web reads per request, not only at build time
 * (VEN-632). A build can see every one of these and still ship to a runtime
 * that has none of them — that is what left staging's auth down behind a
 * green release (VEN-631). Listed here, in `scripts/deploy.mjs`'s
 * `RUNTIME_VARS`, and nowhere else; keep the two in sync.
 */
const RUNTIME_VARS = [
  'NEON_AUTH_BASE_URL',
  'NEON_AUTH_COOKIE_SECRET',
  'WEB_TIER_KEY',
  'DEPLOY_ENV',
  'WEB_URL',
] as const;

/**
 * The commit this web build is, for the release gate (VEN-519), and whether
 * each runtime-read variable is actually set in this process.
 *
 * The API names its commit at `/ready`; without this the web could stay on a
 * stale build while the API moved and the release would still read green. The
 * value is `NEXT_PUBLIC_SENTRY_RELEASE`, inlined at build by `next.config.ts`,
 * so it is what the bundle *is*, not what the running environment says.
 * `runtimeEnv` is the opposite axis: it reports what `process.env` actually
 * holds right now, as booleans only — never a value, so a leaked variable can
 * never leak through this route.
 *
 * Public and unauthenticated on purpose. `no-store` because a cached answer
 * would name the previous release to the poll that exists to notice it.
 */
export function GET(): NextResponse {
  const runtimeEnv = Object.fromEntries(
    RUNTIME_VARS.map((name) => [name, Boolean(process.env[name])]),
  );

  return NextResponse.json(
    { commit: process.env.NEXT_PUBLIC_SENTRY_RELEASE || null, runtimeEnv },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
