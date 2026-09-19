import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { neonAuth } from '@/lib/auth/server';
import { isProxiedAuthCall } from '@/lib/auth/proxy-allowlist';
import { callerAddress, isThrottled } from '@/lib/auth/proxy-throttle';

/**
 * Same-origin proxy to Neon Auth. The browser talks to this, never to the
 * provider's host, so the session cookie is first-party and the sign-in
 * screens never need a provider-hosted page (users never reach the provider's
 * own UI — VEN-403).
 *
 * **Only the calls the screens make are forwarded.** Better Auth serves account
 * management too — change email, change password, delete user — and forwarding
 * everything would let any signed-in browser reach them directly, past the
 * app's own rules for closing or changing an account. Anything not listed is a
 * 404 here.
 *
 * **Throttled per caller** (`proxy-throttle.ts`): the API's limiter never sees
 * these calls, and Neon would see them all from this server's one address.
 *
 * Built per request, because `neonAuth()` reads the environment on first use
 * and a module-level `auth.handler()` would read it at build.
 */
type RouteContext = { params: Promise<{ path: string[] }> };

const forward =
  (method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') =>
  async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const { path } = await context.params;

    if (!isProxiedAuthCall(method, path)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    if (isThrottled(callerAddress(request.headers), path)) {
      return NextResponse.json(
        { message: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    return neonAuth().handler()[method](request, context);
  };

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const DELETE = forward('DELETE');
export const PATCH = forward('PATCH');
