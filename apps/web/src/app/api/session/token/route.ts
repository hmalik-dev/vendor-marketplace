import { NextResponse } from 'next/server';
import { authConfigured, getServerSession } from '@/lib/auth/server';

/**
 * The bearer token for the signed-in browser, for `use-api` and the event
 * stream. The cookie that proves the session is httpOnly, so client code cannot
 * read it — it asks here instead, and gets a 15-minute JWT the API verifies.
 *
 * `no-store` because the answer is per caller and per moment; a shared cache
 * holding one visitor's token would hand it to the next.
 *
 * A missing auth configuration is a 503 `AUTH_UNAVAILABLE` (VEN-635), so the
 * outage is visible on the wire; `client.ts` reads that code as signed out,
 * matching how the server renders the same caller.
 */
export async function GET(): Promise<NextResponse> {
  if (!authConfigured()) {
    return NextResponse.json(
      { code: 'AUTH_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const session = await getServerSession();

  if (!session) {
    return NextResponse.json(
      { token: null },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { token: session.token, userId: session.userId },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
