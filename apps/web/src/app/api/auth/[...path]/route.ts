import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { after, NextResponse } from 'next/server';
import { neonAuth } from '@/lib/auth/server';
import { isProxiedAuthCall } from '@/lib/auth/proxy-allowlist';
import {
  addressLimit,
  callerAddress,
  chargeAddress,
  chargeCaller,
} from '@/lib/auth/proxy-throttle';

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
 * **The password reset request is answered the same for every address**
 * (`email-otp/request-password-reset`): Neon mails only a real account and takes
 * longer doing it, so the browser gets a fixed 200 at once and the call to Neon
 * finishes after the response. Status, body and timing then say nothing about
 * whether the address has an account. That call and the code check are also
 * budgeted per address (`chargeAddress`).
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

    if (await chargeCaller(callerAddress(request.headers), path)) {
      return NextResponse.json(
        { message: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    const joined = path.join('/');
    if (method === 'POST' && RESET_PATHS.has(joined)) {
      return forwardReset(request, context, path);
    }

    if (method === 'POST' && addressLimit(path) !== null) {
      return forwardBudgeted(request, context, path);
    }

    return neonAuth().handler()[method](request, context);
  };

const MAX_BODY_BYTES = 4096;
const REQUEST_RESET = 'email-otp/request-password-reset';
const RESET_PATHS: ReadonlySet<string> = new Set([REQUEST_RESET, 'email-otp/reset-password']);

function emailIn(body: string): string {
  try {
    const email = (JSON.parse(body) as { email?: unknown } | null)?.email;
    return typeof email === 'string' ? email : '';
  } catch {
    return '';
  }
}

/**
 * A sign-in, sign-up or code call: budgeted per account address whoever sends
 * it (VEN-462), so rotating addresses does not buy a fresh budget. The body is
 * read to find the address and handed on re-encoded; what the provider answers
 * is passed back unchanged.
 */
async function forwardBudgeted(
  request: NextRequest,
  context: RouteContext,
  path: string[],
): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const body = await request.text();
  const email = emailIn(body);

  if (email === '') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  /*
   * A password sign-in is charged for its failures only: the budget is shared
   * and durable, so charging every attempt would let anyone lock an account out
   * by naming its address. Codes and mail are charged as they are asked for.
   */
  const failuresOnly = path.join('/') === 'sign-in/email';

  if (await chargeAddress(email, path, Date.now(), !failuresOnly)) {
    return NextResponse.json(
      { message: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  const upstream = new Request(request.url, { method: 'POST', headers, body });
  const response = await neonAuth()
    .handler()
    .POST(upstream as NextRequest, context);

  // Only the provider's refusal of the credential counts; its outage must not spend anyone's budget.
  if (failuresOnly && (response.status === 401 || response.status === 403)) {
    await chargeAddress(email, path);
  }

  return response;
}

async function forwardReset(
  request: NextRequest,
  context: RouteContext,
  path: string[],
): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const body = await request.text();
  const email = emailIn(body);

  // Both calls need an address, and the per-address budget only works if every
  // forwarded call is charged to one: a body this cannot read is not forwarded.
  if (email === '') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const overBudget = await chargeAddress(email, path);
  const isRequest = path.join('/') === REQUEST_RESET;

  if (overBudget && !isRequest) {
    return NextResponse.json(
      { message: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  // The body was re-encoded, so the headers describing the original bytes go.
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  const upstream = new Request(request.url, { method: 'POST', headers, body });
  const call = (): Promise<Response> =>
    neonAuth()
      .handler()
      .POST(upstream as NextRequest, context);

  if (!isRequest) {
    // One refusal for every 4xx, so a code check cannot tell "no such account"
    // from "wrong code" even if the provider words them differently.
    const response = await call();
    return response.status >= 400 && response.status < 500
      ? NextResponse.json({ message: 'Invalid' }, { status: 400 })
      : response;
  }

  if (!overBudget) {
    after(async () => {
      try {
        const response = await call();
        if (!response.ok) {
          Sentry.captureMessage('Password reset mail was refused by the auth provider', {
            level: 'error',
            extra: { status: response.status },
          });
        }
      } catch (error) {
        // The caller already has the fixed answer; asking again retries the send.
        Sentry.captureException(error);
      }
    });
  }

  return NextResponse.json({ success: true });
}

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const DELETE = forward('DELETE');
export const PATCH = forward('PATCH');
