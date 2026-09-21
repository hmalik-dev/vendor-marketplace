import { NextResponse } from 'next/server';

/**
 * The commit this web build is, for the release gate (VEN-519).
 *
 * The API names its commit at `/ready`; without this the web could stay on a
 * stale build while the API moved and the release would still read green. The
 * value is `NEXT_PUBLIC_SENTRY_RELEASE`, inlined at build by `next.config.ts`,
 * so it is what the bundle *is*, not what the running environment says.
 *
 * Public and unauthenticated on purpose, and it answers one key: no env names,
 * no dependency versions. `no-store` because a cached answer would name the
 * previous release to the poll that exists to notice it.
 */
export function GET(): NextResponse {
  return NextResponse.json(
    { commit: process.env.NEXT_PUBLIC_SENTRY_RELEASE || null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
