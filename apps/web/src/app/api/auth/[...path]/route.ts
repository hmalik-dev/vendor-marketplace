import * as Sentry from '@sentry/nextjs';
import type { NextRequest } from 'next/server';
import { after, NextResponse } from 'next/server';
import {
  PASSWORD_MIN_LENGTH,
  SIGN_UP_ROLES,
  type SignUpRole,
  WEB_TIER_KEY_HEADER,
} from '@vendor-marketplace/shared';
import {
  authConfigured,
  forgetSessionsFor,
  markSessionsRevoked,
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

    if (method === 'GET' && joined === LIST_SESSIONS) {
      return forwardListSessions(request);
    }

    if (method === 'POST' && joined === REVOKE_SESSION) {
      return forwardRevokeSession(request, path);
    }

    if (method === 'POST' && joined === REVOKE_OTHER_SESSIONS) {
      return forwardRevokeOtherSessions(request, path);
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

  return (await readSession()).data?.user?.id;
}

/** The caller's session at the provider, bounded and never throwing: `data` is `null` when unknown. */
async function readSession(): Promise<
  Awaited<ReturnType<ReturnType<typeof neonAuth>['getSession']>>
> {
  const unknown = { data: null, error: null } as const;

  return Promise.race([
    neonAuth()
      .getSession()
      .catch(() => unknown),
    new Promise<typeof unknown>((resolve) => {
      setTimeout(() => resolve(unknown), CALLER_ID_TIMEOUT_MS);
    }),
  ]);
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
const SIGN_IN = 'sign-in/email';
const SIGN_UP_ROLE_TIMEOUT_MS = 2_000;
const SIGN_UP_ROLE_ATTEMPTS = 2;
const REQUEST_RESET = 'email-otp/request-password-reset';
const RESET_PATHS: ReadonlySet<string> = new Set([REQUEST_RESET, 'email-otp/reset-password']);

/**
 * The request body as text, or `null` when it is over `MAX_BODY_BYTES`. The
 * header is only a hint a chunked request omits, so the stream is counted as it
 * is read and cancelled at the cap, and the rest is never buffered.
 */
async function readBounded(request: NextRequest): Promise<string | null> {
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return null;
  }

  const reader = request.body?.getReader();

  if (reader === undefined) {
    return '';
  }

  const decoder = new TextDecoder();
  let text = '';
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      return text + decoder.decode();
    }

    received += value.byteLength;

    if (received > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }

    text += decoder.decode(value, { stream: true });
  }
}

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
  let body = await readBounded(request);
  const email = emailIn(body ?? '');

  if (body === null || email === '') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  // The floor is refused before the provider is called, and before the address budget is touched.
  if (path.join('/') === SIGN_UP && !meetsPasswordFloor(body)) {
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
  const failuresOnly = path.join('/') === SIGN_IN;

  if (await chargeAddress(email, path, Date.now(), !failuresOnly)) {
    return NextResponse.json(
      { message: 'Too many attempts' },
      { status: 429, headers: { 'Retry-After': '600' } },
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  // The body was checked as JSON, so it reaches the provider as JSON and nothing else.
  headers.set('content-type', 'application/json');
  const upstream = new Request(request.url, { method: 'POST', headers, body });
  const response = await neonAuth()
    .handler()
    .POST(upstream as NextRequest, context);

  // Only the provider's refusal of the credential counts; its outage must not spend anyone's budget.
  if (failuresOnly && (response.status === 401 || response.status === 403)) {
    await chargeAddress(email, path);
  }

  const mintsSession = await mintsUnusedSession(path, response);

  if (role !== undefined && response.ok && !(await recordSignUpRole(response, role))) {
    // The browser is told the sign-up failed and keeps no cookie, so the session it opened is ended too.
    await endMintedSession(request, response);
    return NextResponse.json({ code: 'SIGN_UP_UNRECORDED' }, { status: 503 });
  }

  if (mintsSession) {
    return discardMintedSession(request, response);
  }

  return response;
}

const VERIFY_EMAIL = 'email-otp/verify-email';

/**
 * Whether this answer opened a provider session the browser must not keep
 * (VEN-714): a sign-up and an address verification are followed by a sign-in
 * with the credentials the form already holds, and a sign-in the provider
 * answers 200 for an unverified address is followed by the code step and a
 * second sign-in. The session cookie of the last is the one the device uses;
 * the others would list as devices nobody used.
 */
async function mintsUnusedSession(path: string[], response: Response): Promise<boolean> {
  const joined = path.join('/');

  if (!response.ok) {
    return false;
  }

  if (joined === SIGN_IN) {
    return isUnverifiedSignIn(response);
  }

  return joined === SIGN_UP || joined === VERIFY_EMAIL;
}

/**
 * Ends the session a provider answer just opened, with its own cookie, and
 * reports a failure rather than throwing (VEN-714). Nothing happens when the
 * answer set no cookie.
 */
async function endMintedSession(request: NextRequest, response: Response): Promise<void> {
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');

  if (cookie === '') {
    return;
  }

  try {
    const headers = callerHeaders(request);
    headers.delete('authorization');
    headers.set('cookie', cookie);
    const signOut = segments(SIGN_OUT);
    const ended = await neonAuth()
      .handler()
      .POST(authCall(request, signOut, headers, '{}') as NextRequest, {
        params: Promise.resolve({ path: signOut }),
      });

    if (!ended.ok) {
      Sentry.captureMessage('Could not end a session the browser will not keep', {
        level: 'warning',
        extra: { status: ended.status },
      });
    }
  } catch (error) {
    Sentry.captureException(error);
  }
}

/**
 * Ends the session a sign-up, verification or unverified sign-in just opened
 * and answers without any `Set-Cookie`, so the browser never holds it
 * (VEN-714). Best-effort: the answer is returned either way, since the account
 * itself was created.
 */
async function discardMintedSession(request: NextRequest, response: Response): Promise<Response> {
  await endMintedSession(request, response);

  // Copied one by one, cookies left out: the product writes no cookie of its own (`no-cookie-consent.test.ts`).
  const headers = new Headers();
  for (const [name, value] of response.headers) {
    if (!/^set-cookie$/i.test(name)) {
      headers.append(name, value);
    }
  }
  headers.delete('content-length');
  headers.delete('content-encoding');

  return new Response(await response.text(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** A sign-in answer that names an account whose address is not verified. */
async function isUnverifiedSignIn(response: Response): Promise<boolean> {
  try {
    const body = (await response.clone().json()) as { user?: { emailVerified?: unknown } } | null;
    return body?.user?.emailVerified === false;
  } catch {
    // An answer that is not JSON names no unverified account, so it is left as it came.
    return false;
  }
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

    headers.set('cookie', cookie);
    const revoke = segments('revoke-sessions');
    let revoked: Response;

    try {
      revoked = await neonAuth()
        .handler()
        .POST(authCall(request, revoke, headers, '{}') as NextRequest, {
          params: Promise.resolve({ path: revoke }),
        });
    } finally {
      // After the provider revoke, so no session is left to mint a JWT past the
      // bump, and whether or not it threw, so an issued one is bounded anyway
      // (VEN-670); a failure here is reported inside.
      await invalidateSessionsAtApi(userId);
    }

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
  const body = await readBounded(request);
  const email = emailIn(body ?? '');

  // Both calls need an address, and the per-address budget only works if every
  // forwarded call is charged to one: a body this cannot read is not forwarded.
  if (body === null || email === '') {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  // The code check sets the new password, so the floor holds here as at sign-up.
  if (path.join('/') !== REQUEST_RESET && !meetsPasswordFloor(body)) {
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
  // The body was checked as JSON, so it reaches the provider as JSON and nothing else.
  headers.set('content-type', 'application/json');
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

function isLongEnough(value: unknown): value is string {
  return typeof value === 'string' && value.length >= PASSWORD_MIN_LENGTH;
}

/** Whether the body's `password` is a string at or over the product's password floor. */
function meetsPasswordFloor(body: string): boolean {
  try {
    return isLongEnough((JSON.parse(body) as { password?: unknown } | null)?.password);
  } catch {
    return false;
  }
}

/** The two passwords a change carries, and nothing else the client sent; `null` when either is missing. */
function passwordsIn(body: string): PasswordChange | null {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const current = parsed.currentPassword;
    const next = parsed.newPassword;

    return isFilled(current) && isLongEnough(next)
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
  const text = await readBounded(request);
  const change = text === null ? null : passwordsIn(text);

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
    await markSessionsRevoked();
  }

  return response;
}

const LIST_SESSIONS = 'list-sessions';
const REVOKE_SESSION = 'revoke-session';
const REVOKE_OTHER_SESSIONS = 'revoke-other-sessions';

/** A provider session, cut down to what the proxy may use. `token` never leaves this file. */
interface ProviderSession {
  id: string;
  token: string;
  userAgent: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** What the browser gets for one device: an opaque id and what helps recognise it, never a secret. */
interface SessionRow {
  id: string;
  userAgent: string | null;
  createdAt: string | null;
  lastActiveAt: string | null;
  current: boolean;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return null;
  }

  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
}

/** The sessions in Better Auth's `list-sessions` answer, or `null` when the body is not a list. */
function providerSessionsIn(body: unknown): ProviderSession[] | null {
  const list = Array.isArray(body) ? body : (body as { sessions?: unknown } | null)?.sessions;

  if (!Array.isArray(list)) {
    return null;
  }

  return list.flatMap((entry: unknown): ProviderSession[] => {
    const row = entry as Record<string, unknown> | null;

    if (typeof row?.id !== 'string' || typeof row.token !== 'string') {
      return [];
    }

    return [
      {
        id: row.id,
        token: row.token,
        userAgent: typeof row.userAgent === 'string' ? row.userAgent : null,
        createdAt: isoOrNull(row.createdAt),
        updatedAt: isoOrNull(row.updatedAt),
      },
    ];
  });
}

function callerHeaders(request: NextRequest): Headers {
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  headers.set('content-type', 'application/json');
  return headers;
}

/** Every session the caller's account holds at the provider, or the response to answer with instead. */
async function providerSessions(request: NextRequest): Promise<ProviderSession[] | Response> {
  try {
    const headers = callerHeaders(request);
    headers.delete('content-type');
    const response = await neonAuth()
      .handler()
      .GET(
        new Request(new URL(`/api/auth/${LIST_SESSIONS}`, request.url), {
          method: 'GET',
          headers,
        }) as NextRequest,
        { params: Promise.resolve({ path: segments(LIST_SESSIONS) }) },
      );

    if (response.status === 401) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const sessions = response.ok ? providerSessionsIn(await response.json()) : null;

    return sessions ?? NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  }
}

/**
 * The devices the caller's account is signed in on (VEN-681). Better Auth's
 * answer carries each session's `token`, which is the credential itself, so it
 * is rebuilt field by field: the browser gets an opaque id, the user agent,
 * two times and whether the row is this device. No IP address (VEN-681's
 * ruling: nothing that does not help recognise a device).
 */
async function forwardListSessions(request: NextRequest): Promise<Response> {
  const [found, current] = await Promise.all([providerSessions(request), readSession()]);

  if (found instanceof Response) {
    return found;
  }

  const currentId = current.data?.session?.id;

  // With no current session known, no row could be marked, and this device would offer to end itself.
  if (currentId === undefined) {
    return NextResponse.json({ message: 'Unavailable' }, { status: 502 });
  }

  /*
   * The provider caps its list (100 rows, oldest first), so an account that
   * has piled up sessions may not list this one. It is drawn from what the
   * provider says about the caller's own session, so it is still marked and
   * still cannot be ended from here. The empty token is never read or sent.
   */
  const own = current.data?.session;
  const listed = found.some((session) => session.id === currentId);
  const rows: ProviderSession[] = listed
    ? found
    : [
        {
          id: currentId,
          token: '',
          userAgent: typeof own?.userAgent === 'string' ? own.userAgent : null,
          createdAt: isoOrNull(own?.createdAt),
          updatedAt: isoOrNull(own?.updatedAt),
        },
        ...found,
      ];

  const sessions: SessionRow[] = rows
    .map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt,
      lastActiveAt: session.updatedAt ?? session.createdAt,
      current: session.id === currentId,
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? ''),
    );

  return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } });
}

/**
 * After sessions end at the provider: forget this process's minted tokens for
 * the account and bound every JWT issued before now at the API, as sign-out
 * does (VEN-628, VEN-670). This device re-mints on its next read, after the
 * bump, so it stays signed in.
 */
async function afterSessionsEnded(userId: string): Promise<void> {
  forgetSessionsFor(userId);
  await invalidateSessionsAtApi(userId);
  await markSessionsRevoked();
}

function sessionIdIn(body: string): string | null {
  try {
    const id = (JSON.parse(body) as { id?: unknown } | null)?.id;
    return typeof id === 'string' && id !== '' ? id : null;
  } catch {
    return null;
  }
}

/**
 * Ending sessions is budgeted per account, whichever address asks, and every
 * attempt is charged: a guessed id spends the budget too.
 */
async function refuseOverRevokeBudget(userId: string, path: string[]): Promise<Response | null> {
  if (!(await chargeAddress(userId, path))) {
    return null;
  }

  return NextResponse.json(
    { message: 'Too many attempts' },
    { status: 429, headers: { 'Retry-After': '600' } },
  );
}

/**
 * Ends one other device. The browser names a session by the opaque id the list
 * gave it; the token the provider wants is looked up here, in the caller's own
 * list, so an id belonging to another account is simply not found (404) and the
 * caller's own session is refused (400: that is sign-out).
 */
async function forwardRevokeSession(request: NextRequest, path: string[]): Promise<Response> {
  const text = await readBounded(request);
  const id = text === null ? null : sessionIdIn(text);

  if (id === null) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const [userId, current] = await Promise.all([resolveCallerId(), readSession()]);
  const currentId = current.data?.session?.id;

  if (userId === undefined || currentId === undefined) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const refused = await refuseOverRevokeBudget(userId, path);

  if (refused) {
    return refused;
  }

  const found = await providerSessions(request);

  if (found instanceof Response) {
    return found;
  }

  const target = found.find((session) => session.id === id);

  if (target === undefined) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }

  if (target.id === currentId) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const revoke = segments(REVOKE_SESSION);
  const body = JSON.stringify({ token: target.token });
  const response = await neonAuth()
    .handler()
    .POST(authCall(request, revoke, callerHeaders(request), body) as NextRequest, {
      params: Promise.resolve({ path: revoke }),
    });

  return finishRevoke(response, userId);
}

/** Ends every device but this one. Better Auth keeps the caller's own session. */
async function forwardRevokeOtherSessions(request: NextRequest, path: string[]): Promise<Response> {
  // A live session is required before anything is charged, so a revoked cookie
  // this instance still has cached cannot spend the owner's budget.
  const [userId, current] = await Promise.all([resolveCallerId(), readSession()]);

  if (userId === undefined || current.data?.session?.id === undefined) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const refused = await refuseOverRevokeBudget(userId, path);

  if (refused) {
    return refused;
  }

  const revoke = segments(REVOKE_OTHER_SESSIONS);
  const response = await neonAuth()
    .handler()
    .POST(authCall(request, revoke, callerHeaders(request), '{}') as NextRequest, {
      params: Promise.resolve({ path: revoke }),
    });

  return finishRevoke(response, userId);
}

async function finishRevoke(response: Response, userId: string): Promise<Response> {
  if (!response.ok) {
    return NextResponse.json(
      { message: 'Not ended' },
      { status: response.status === 401 ? 401 : 502 },
    );
  }

  await afterSessionsEnded(userId);
  return NextResponse.json({ success: true });
}

export const GET = forward('GET');
export const POST = forward('POST');
export const PUT = forward('PUT');
export const DELETE = forward('DELETE');
export const PATCH = forward('PATCH');
