import { NextResponse } from 'next/server';
import { REFUSED_TOKEN_HEADER } from '@/lib/auth/refused-token-header';
import { authConfigured, getServerSession, refreshRefusedToken } from '@/lib/auth/server';

/**
 * The bearer token for the signed-in browser, for `use-api` and the event
 * stream. The cookie that proves the session is httpOnly, so client code cannot
 * read it — it asks here instead, and gets a 15-minute JWT the API verifies.
 *
 * `no-store` because the answer is per caller and per moment; a shared cache
 * holding one visitor's token would hand it to the next.
 *
 * A caller whose token the API refused names it in `x-refused-token` and gets
 * a re-minted one (VEN-717), which reaches a device on an instance whose cache
 * holds a token from before another device's revoke.
 *
 * A missing auth configuration is a 503 `AUTH_UNAVAILABLE` (VEN-635), so the
 * outage is visible on the wire; `client.ts` reads that code as signed out,
 * matching how the server renders the same caller.
 */
export async function GET(request: Request): Promise<NextResponse> {
  if (!authConfigured()) {
    return NextResponse.json(
      { code: 'AUTH_UNAVAILABLE' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const refused = request.headers.get(REFUSED_TOKEN_HEADER);
  const session = refused ? await refreshRefusedToken(refused) : await getServerSession();

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
