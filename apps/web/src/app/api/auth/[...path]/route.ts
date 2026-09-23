import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { after, NextResponse } from 'next/server';
import { SIGN_UP_ROLES, type SignUpRole, WEB_TIER_KEY_HEADER } from '@vendor-marketplace/shared';
import {
  authConfigured,
  forgetSessionsFor,
  mintedUserIdForCaller,
  neonAuth,
} from '@/lib/auth/server';
import { isProxiedAuthCall } from '@/lib/auth/proxy-allowlist';
import { apiBaseUrl } from '@/lib/api-base-url';
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
 *
 * **A missing auth configuration is a 503 `AUTH_UNAVAILABLE`**, answered before
 * any budget is charged or any `after()` send is scheduled (VEN-635): the
 * forms show their "could not reach" copy, and a reset request no longer
 * claims a mail went out. A config outage says nothing about whether an
 * address has an account, so this answer is the same for every address.
 * An upstream outage (Neon Auth itself down or slow) still answers whatever
 * the SDK does; extending this 503 to that is a separate change.
 *
 * **A sign-up carries the role chosen on the form, and the proxy records it**
 * (VEN-662): Neon Auth has no field for it, so the role is taken out of the
 * body before it is forwarded and stored at the API against the id the
 * provider's answer names (`recordSignUpRole`). A sign-up whose role cannot be
 * stored is answered as failed rather than as created.
 */
type RouteContext = { params: Promise<{ path: string[] }> };

const forward =
  (method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') =>
  async (request: NextRequest, context: RouteContext): Promise<Response> => {
    const { path } = await context.params;

    if (!isProxiedAuthCall(method, path)) {
      return NextResponse.json({ message: 'Not found' }, { status: 404 });
    }

    if (!authConfigured()) {
      return NextResponse.json({ code: 'AUTH_UNAVAILABLE' }, { status: 503 });
    }

    if (await chargeCaller(callerAddress(request.headers), path)) {
      return NextResponse.json(
        { message: 'Too many attempts' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    const joined = path.join('/');
    if (method === 'POST' && joined === SIGN_OUT) {
      return forwardSignOut(request, context);
    }

    if (method === 'POST' && RESET_PATHS.has(joined)) {
      return forwardReset(request, context, path);
    }

    if (method === 'POST' && joined === 'change-password') {
      return forwardChangePassword(request, context, path);
    }

    if (method === 'POST' && addressLimit(path) !== null) {
      return forwardBudgeted(request, context, path);
    }

    return neonAuth().handler()[method](request, context);
  };

const SIGN_OUT = 'sign-out';
const SESSION_GENERATION_TIMEOUT_MS = 2_000;
const CALLER_ID_TIMEOUT_MS = 2_000;

/**
 * Ends every session the account holds at the provider, then closes the two
 * windows a revoked cookie could otherwise still be replayed through
 * (VEN-628):
 *
 * 1. This process's own minted-token cache (`server.ts`) — read the caller's
 *    user id off the cache entry the cookie is already keyed by, no extra
 *    round trip to Neon needed, then forget every entry for that user.
 * 2. The JWT itself, which stays verifiable at the API regardless of
 *    sign-out — bumping `sessions_invalidated_at` bounds how long one minted
 *    before this call keeps working. Best-effort: a failure here is reported
 *    rather than turned into a failed sign-out, since the cookie is already
 *    gone and the cache already cleared.
 *
 * Signing out revokes every session the account holds, not just the caller's
 * own cookie — the ticket's title is "ends the session everywhere", and the
 * JWT bound above only makes sense once every device's underlying session is
 * actually gone at the provider too, rather than merely refused locally
 * while Neon still thinks it is live. `revokeEverySessionForCaller` runs
 * first, while the caller's cookie is still valid.
 */
async function forwardSignOut(request: NextRequest, context: RouteContext): Promise<Response> {
  const userId = await resolveCallerId();

  await revokeEverySessionForCaller(request);

  const response = await neonAuth().handler().POST(request, context);

  if (!response.ok) {
    return response;
  }

  if (userId !== undefined) {
    forgetSessionsFor(userId);
  } else {
    // Nothing local to clear, but worth knowing how often this happens: it
    // is the one case `invalidateSessionsAtApi` below also skips.
    Sentry.captureMessage('Signed out a caller this process could not identify', {
      level: 'warning',
    });
  }

  await invalidateSessionsAtApi(userId);

  return response;
}

/**
 * The caller's own user id, from the cache their cookie is already keyed
 * under when this process minted it — no round trip needed — or, on a cache
 * miss (a cold instance, or a session this instance never rendered), one call
 * to Neon Auth with the same cookie, bounded so a wedged upstream cannot hold
 * sign-out open (VEN-619 is the same argument for `server.ts`'s own reads).
 * Never throws: an unreachable provider here means the id is unknown, not
 * that sign-out failed.
 */
async function resolveCallerId(): Promise<string | undefined> {
  const cached = await mintedUserIdForCaller();
  if (cached !== undefined) {
    return cached;
  }

  const session = await Promise.race([
    neonAuth()
      .getSession()
      .catch(() => ({ data: null })),
    new Promise<{ data: null }>((resolve) => {
      setTimeout(() => resolve({ data: null }), CALLER_ID_TIMEOUT_MS);
    }),
  ]);

  return session.data?.user?.id;
}

/**
 * Ends every session this account holds at the provider — not only the
 * caller's own — reusing the exact mechanism `endEverySession` below already
 * proved for password reset (VEN-518). The difference is this caller is
 * already authenticated, so their own live cookie is the credential
 * `revoke-sessions` needs, forwarded as-is; `endEverySession` has to sign in
 * fresh first because it starts from an unauthenticated reset request.
 * Best-effort and silent either way: sign-out below still runs and still
 * answers the browser regardless, and a caller with no live cookie (a second
 * tab signing out after the first already did) simply has nothing to revoke.
 */
async function revokeEverySessionForCaller(request: NextRequest): Promise<void> {
  try {
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('content-type', 'application/json');

    const revoke = segments('revoke-sessions');
    const revoked = await neonAuth()
      .handler()
      .POST(authCall(request, revoke, headers, '{}') as NextRequest, {
        params: Promise.resolve({ path: revoke }),
      });

    if (!revoked.ok) {
      Sentry.captureMessage('Could not end every session on sign-out', {
        level: 'warning',
        extra: { status: revoked.status },
      });
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

async function invalidateSessionsAtApi(userId: string | undefined): Promise<void> {
  const key = process.env.WEB_TIER_KEY;

  if (userId === undefined || !key) {
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl()}/internal/session-generation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', [WEB_TIER_KEY_HEADER]: key },
      body: JSON.stringify({ authUserId: userId }),
      signal: AbortSignal.timeout(SESSION_GENERATION_TIMEOUT_MS),
    });

    if (!response.ok) {
      Sentry.captureMessage("Could not bound a signed-out session's JWT", {
        level: 'warning',
        extra: { status: response.status },
      });
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

const MAX_BODY_BYTES = 4096;
const SIGN_UP = 'sign-up/email';
const SIGN_UP_ROLE_TIMEOUT_MS = 2_000;
const SIGN_UP_ROLE_ATTEMPTS = 2;
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

  let body = await request.text();
  const email = emailIn(body);

  if (email === '') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  let role: SignUpRole | undefined;

  if (path.join('/') === SIGN_UP) {
    const split = splitSignUpRole(body);

    // No role, or one that is not a sign-up role: refused before the provider is called.
    if (split === null) {
      return NextResponse.json({ message: 'Bad request' }, { status: 400 });
    }

    // Without the key the role cannot be stored, so no account is created to lack one.
    if (!process.env.WEB_TIER_KEY) {
      return NextResponse.json({ code: 'AUTH_UNAVAILABLE' }, { status: 503 });
    }

    role = split.role;
    body = split.forwarded;
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

  if (role !== undefined && response.ok && !(await recordSignUpRole(response, role))) {
    return NextResponse.json({ code: 'SIGN_UP_UNRECORDED' }, { status: 503 });
  }

  return response;
}

/** The sign-up body with its role taken out, or `null` when it carries no sign-up role. */
function splitSignUpRole(body: string): { role: SignUpRole; forwarded: string } | null {
  try {
    const { role, ...rest } = JSON.parse(body) as Record<string, unknown>;
    const chosen = SIGN_UP_ROLES.find((candidate) => candidate === role);

    return chosen ? { role: chosen, forwarded: JSON.stringify(rest) } : null;
  } catch {
    return null;
  }
}

/**
 * Stores the role against the account the provider just created, at the API's
 * `/internal/sign-up-role`, trying twice with a short deadline each. Unlike
 * `invalidateSessionsAtApi`, a failure is not swallowed: the caller answers the
 * sign-up as failed, so no account is knowingly created without its role.
 *
 * That leaves one orphan window, named in VEN-662: the identity now exists at
 * the provider with no role on our side, and a retry meets "already exists".
 * It is the size of an internal API outage, and the error below carries the
 * account's id — never its address — so support can find it.
 */
async function recordSignUpRole(response: Response, role: SignUpRole): Promise<boolean> {
  const authUserId = await userIdIn(response);

  if (authUserId === undefined) {
    Sentry.captureMessage('A sign-up answer named no account id, so its role was not recorded', {
      level: 'error',
    });
    return false;
  }

  for (let attempt = 0; attempt < SIGN_UP_ROLE_ATTEMPTS; attempt++) {
    try {
      const recorded = await fetch(`${apiBaseUrl()}/internal/sign-up-role`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WEB_TIER_KEY_HEADER]: process.env.WEB_TIER_KEY ?? '',
        },
        body: JSON.stringify({ authUserId, role }),
        signal: AbortSignal.timeout(SIGN_UP_ROLE_TIMEOUT_MS),
      });

      if (recorded.ok) {
        return true;
      }
    } catch {
      // Timed out or unreachable: the next attempt, or the error below, covers it.
    }
  }

  Sentry.captureMessage('Could not record the role chosen at sign-up', {
    level: 'error',
    extra: { authUserId },
  });
  return false;
}

function authCall(request: NextRequest, path: string[], headers: Headers, body: string): Request {
  return new Request(new URL(`/api/auth/${path.join('/')}`, request.url), {
    method: 'POST',
    headers,
    body,
  });
}

/**
 * A reset is often done because the account may be compromised, and Better Auth
 * leaves other sessions alive after one unless the project setting
 * `revokeSessionsOnPasswordReset` is on — a console value this repo cannot see
 * (VEN-518). So the proxy ends them itself, as defence in depth: it signs in
 * with the password just set, which yields the one session `revoke-sessions`
 * needs a caller for, and that call ends every session the account holds,
 * the throwaway one included. The caller is signed out either way and signs in
 * again; the reset has already succeeded, so a failure here is reported, never
 * turned into a failed reset.
 */
async function endEverySession(request: NextRequest, email: string, body: string): Promise<void> {
  try {
    const password = (JSON.parse(body) as { password?: unknown }).password;
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('cookie');
    headers.delete('authorization');
    headers.set('content-type', 'application/json');

    const signIn = segments('sign-in/email');
    const signedIn = await neonAuth()
      .handler()
      .POST(
        authCall(request, signIn, headers, JSON.stringify({ email, password })) as NextRequest,
        { params: Promise.resolve({ path: signIn }) },
      );
    const userId = await userIdIn(signedIn);
    const cookie = signedIn.headers
      .getSetCookie()
      .map((line) => line.split(';')[0])
      .join('; ');

    if (!signedIn.ok) {
      throw new Error(`Could not open a session to end the others (${signedIn.status})`);
    }

    if (cookie === '') {
      throw new Error('Signing in to end the other sessions set no session cookie');
    }

    // Before the provider revoke, so a failure there cannot leave an already
    // issued JWT valid at the API (VEN-670); a failure here is reported inside.
    await invalidateSessionsAtApi(userId);

    headers.set('cookie', cookie);
    const revoke = segments('revoke-sessions');
    const revoked = await neonAuth()
      .handler()
      .POST(authCall(request, revoke, headers, '{}') as NextRequest, {
        params: Promise.resolve({ path: revoke }),
      });

    if (!revoked.ok) {
      throw new Error(`Other sessions were not ended (${revoked.status})`);
    }

    if (userId !== undefined) {
      forgetSessionsFor(userId);
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

/** The account's id from a sign-in or sign-up answer, or `undefined` when the body says none. */
async function userIdIn(response: Response): Promise<string | undefined> {
  try {
    const id = ((await response.clone().json()) as { user?: { id?: unknown } } | null)?.user?.id;
    return typeof id === 'string' ? id : undefined;
  } catch {
    // Each caller decides what an unknown id means for it.
    return undefined;
  }
}

const segments = (joined: string): string[] => joined.split('/');

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

    if (response.ok) {
      await endEverySession(request, email, body);
    }

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

type PasswordChange = { currentPassword: string; newPassword: string };

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** The two passwords a change carries, and nothing else the client sent; `null` when either is missing. */
function passwordsIn(body: string): PasswordChange | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const current = parsed.currentPassword;
    const next = parsed.newPassword;

    return isFilled(current) && isFilled(next)
      ? { currentPassword: current, newPassword: next }
      : null;
  } catch {
    return null;
  }
}

/**
 * A signed-in password change (VEN-677). Three things the client does not get
 * to decide:
 *
 * - **Every other session ends.** `revokeOtherSessions` is always `true`,
 *   whatever was sent: a change is often made because the account may be
 *   compromised, the same reason a reset ends them (VEN-518). Better Auth then
 *   issues this device a fresh session, so the caller stays signed in here.
 * - **Wrong current passwords are budgeted per account**, not per address:
 *   the body names no email, so the bucket is the session's user id. Only the
 *   provider's refusal of the current password is charged, as for a password
 *   sign-in, so an outage spends nobody's budget and a successful change is
 *   never locked out.
 * - **This process forgets the account's minted tokens** once the change
 *   lands, as sign-out and reset do, so a revoked cookie's cached JWT does not
 *   outlive it here. The API side of a live JWT is VEN-670's.
 */
async function forwardChangePassword(
  request: NextRequest,
  context: RouteContext,
  path: string[],
): Promise<Response> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const change = passwordsIn(await request.text());

  if (change === null) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const userId = await resolveCallerId();

  if (userId === undefined) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  // Read-only: the budget is spent by refusals below, never by asking.
  if (await chargeAddress(userId, path, Date.now(), false)) {
    return NextResponse.json(
      { message: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/json');
  const upstream = new Request(request.url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...change, revokeOtherSessions: true }),
  });
  const response = await neonAuth()
    .handler()
    .POST(upstream as NextRequest, context);

  /*
   * Only a 400 (`INVALID_PASSWORD`) is a guess. A 401 is a session revoked
   * elsewhere that this instance still had cached: charging it would let a
   * revoked session spend its owner's budget.
   */
  if (response.status === 400) {
    await chargeAddress(userId, path);
  }

  if (response.ok) {
    forgetSessionsFor(userId);
  }

  return response;
}

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const DELETE = forward('DELETE');
export const PATCH = forward('PATCH');
