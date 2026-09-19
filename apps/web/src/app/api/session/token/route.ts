import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/server';

/**
 * The bearer token for the signed-in browser, for `use-api` and the event
 * stream. The cookie that proves the session is httpOnly, so client code cannot
 * read it — it asks here instead, and gets a 15-minute JWT the API verifies.
 *
 * `no-store` because the answer is per caller and per moment; a shared cache
 * holding one visitor's token would hand it to the next.
 */
export async function GET(): Promise<NextResponse> {
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
