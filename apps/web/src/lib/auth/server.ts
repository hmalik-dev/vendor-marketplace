import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';
import * as Sentry from '@sentry/nextjs';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { API_REQUEST_TIMEOUT_MS, setRefusedTokenHandler } from '@/lib/api-client';
import { tokenExpiryMs } from './token-expiry';

/**
 * The web app's one door to Neon Auth on the server: the `/api/auth/*` proxy
 * that sign-in and sign-up talk to, and the session read that turns a cookie
 * into the bearer token the API verifies.
 *
 * Built on first use rather than at import so `next build` and the unit suites
 * that never sign anyone in do not need the two variables. A missing one fails
 * the first real call, by name — `assertWebEnv` already refuses to boot without
 * them, so this is the backstop and not the gate.
 */
let instance: ReturnType<typeof createNeonAuth> | null = null;

/**
 * Whether both variables {@link neonAuth} needs are set. A deploy missing one
 * (VEN-631) must not take down every page for anyone holding a cookie, so
 * session reads and the `/api/auth/*` proxy ask this first and degrade —
 * signed out, or a 503 `AUTH_UNAVAILABLE` — instead of throwing (VEN-635).
 */
export function authConfigured(): boolean {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

let reportedMissingConfig = false;

/** Tells Sentry once per process; every render after the first would repeat it. */
function reportMissingConfig(): void {
  if (reportedMissingConfig) {
    return;
  }

  reportedMissingConfig = true;
  Sentry.captureMessage('Neon Auth is not configured; every caller is read as signed out', {
    level: 'error',
    fingerprint: ['auth-config-missing'],
  });
}

export function neonAuth(): ReturnType<typeof createNeonAuth> {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;

    if (!baseUrl || !secret) {
      throw new Error(
        'NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set. Run `pnpm preflight` for the fix.',
      );
    }

    instance = createNeonAuth({ baseUrl, cookies: { secret } });
  }

  return instance;
}

/** The caller's session as the API and Sentry need it, or `null` when signed out. */
export interface ServerSession {
  /** Neon Auth's user id — the value `users.auth_user_id` holds. */
  userId: string;
  /** A short-lived JWT the API verifies against the branch's JWKS. */
  token: string;
}

/**
 * Races `auth.getSession()`/`auth.token()` against {@link API_REQUEST_TIMEOUT_MS}
 * and answers `{ data: null }` if it loses — the same shape the Neon SDK itself
 * answers for "nobody is signed in", so a caller here needs no separate timeout
 * case. The timer is cleared either way, so a fast upstream leaves nothing
 * running past this call, and a rejection that isn't the timeout still
 * propagates.
 *
 * The Neon Auth SDK's `getSession`/`token` take no `AbortSignal`, so this
 * cannot cancel the underlying request the way `api-client.ts` cancels its own
 * `fetch` — it only stops *this render* from waiting on it. A render that gave
 * up while the upstream is still wedged is still the fix: without a deadline
 * here, `/` and `/accept-terms` held an open connection until CI's own runner
 * timeout ended the job (VEN-619).
 *
 * `label` is logged only on the timeout path, to `stderr` — which CI's
 * `next start` redirects to `web.log`, uploaded by the `stack-logs` artifact
 * step on failure. Before this, that log named nothing: a stuck render's only
 * trace was Next's own `[ResponseAborted: ]`, printed once the platform ended
 * the connection, with no hint of which upstream call it was still waiting on.
 */
function withDeadline<T>(
  promise: Promise<{ data: T | null }>,
  label: string,
): Promise<{ data: T | null }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      console.error(
        `[auth-timeout] Neon Auth's ${label} did not answer within ${API_REQUEST_TIMEOUT_MS}ms`,
      );
      resolve({ data: null });
    }, API_REQUEST_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Reads the signed-in caller on the server, or `null`.
 *
 * Never throws for "nobody is signed in": the Neon SDK answers `{ data: null }`
 * for that, and every caller here treats it as the redirect-to-sign-in case.
 * A missing auth configuration reads the same way, so public pages still
 * render and gated ones still redirect (VEN-635).
 * `withDeadline` answers the same shape when the call blows its deadline, so
 * that case needs no separate handling here either — matching how a 429 from
 * Neon Auth is already read as signed out below.
 * `cache()`d because the header, the footer and the page each ask in one render.
 */
export const getServerSession = cache(
  async function getServerSession(): Promise<ServerSession | null> {
    const cookieValue = await sessionCookieValue();

    if (cookieValue === null) {
      return null;
    }

    const marker = await revokeMarkerValue();
    const remembered = mintedSessions.get(cookieValue);

    if (
      remembered &&
      remembered.marker === marker &&
      remembered.expiresAtMs - Date.now() > REFRESH_WINDOW_MS
    ) {
      return { userId: remembered.userId, token: remembered.token };
    }

    return mintSession(cookieValue, marker);
  },
);

/** Asks Neon Auth who the caller is and for a fresh JWT, and remembers the answer. */
async function mintSession(
  cookieValue: string,
  marker: string | null,
  refreshedFrom?: string,
): Promise<ServerSession | null> {
  if (!authConfigured()) {
    reportMissingConfig();
    return null;
  }

  const auth = neonAuth();

  const sessionResult = await withDeadline(auth.getSession(), 'getSession');

  if (!sessionResult.data?.user) {
    return null;
  }
  const { user } = sessionResult.data;

  const tokenResult = await withDeadline(auth.token(), 'token');

  if (!tokenResult.data?.token) {
    return null;
  }
  const { token } = tokenResult.data;

  const minted: ServerSession = { userId: user.id, token };
  remember(cookieValue, minted, marker, refreshedFrom);

  return minted;
}

/**
 * Neon Auth rate-limits `/get-session` and `/token` (429
 * `over_request_rate_limit`) per caller, and every request this server makes
 * arrives from its one address. Once the SDK's five-minute `session_data`
 * cookie lapses, each render — the header, the page and the browser's own
 * `/api/session/token` — asked upstream for both, which spent the budget in a
 * minute of ordinary browsing; and the refusal read as "signed out", so a live
 * session bounced to `/sign-in` (VEN-460). A server component cannot set the
 * cookie that would refresh it, so the answer is kept here instead.
 *
 * It is kept for the life of the JWT it holds — the same 15 minutes the API
 * already honours that token for. That bound assumed the browser's own copy
 * was the only copy: a value captured elsewhere (a shared device, a
 * compromised proxy) can still be replayed after the browser signs out and
 * deletes its cookie, so nothing here deletes *itself* on sign-out. Instead
 * the sign-out proxy calls {@link forgetSessionsFor} explicitly, by the user
 * id it read off this same cache before forwarding the call (VEN-628) — the
 * entry cannot outlive that request.
 */
const REFRESH_WINDOW_MS = 60_000;
const MAX_REMEMBERED_SESSIONS = 5_000;

interface MintedSession extends ServerSession {
  expiresAtMs: number;
  /** The {@link REVOKE_MARKER_COOKIE} value the caller carried when this was minted. */
  marker: string | null;
  /** The refused token whose refusal minted this entry (VEN-717), when one did. */
  refreshedFrom?: string;
}

const mintedSessions = new Map<string, MintedSession>();
const refreshing = new Map<string, Promise<ServerSession | null>>();

/**
 * The two names the SDK writes its session cookie under: `__Secure-` over
 * HTTPS, bare over plain HTTP. Matched exactly — a suffix match would let a
 * cookie planted under a lookalike name become the key.
 */
const SESSION_COOKIE_NAMES: ReadonlySet<string> = new Set([
  '__Secure-neon-auth.session_token',
  'neon-auth.session_token',
]);

/**
 * The key a remembered session is filed under: every real session cookie, name
 * and value, and nothing else. A hit skips the SDK's signature check, so the
 * key has to be something only the session's holder can present — a planted
 * cookie only changes the key, and an empty value never makes one.
 */
async function sessionCookieValue(): Promise<string | null> {
  const jar = await cookies();
  const present = jar
    .getAll()
    .filter((cookie) => SESSION_COOKIE_NAMES.has(cookie.name) && cookie.value !== '')
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .sort();

  return present.length === 0 ? null : present.join(';');
}

function remember(
  cookieValue: string,
  session: ServerSession,
  marker: string | null,
  refreshedFrom?: string,
): void {
  const expiresAtMs = tokenExpiryMs(session.token);

  if (expiresAtMs === null) {
    return;
  }

  if (mintedSessions.size >= MAX_REMEMBERED_SESSIONS) {
    const now = Date.now();
    for (const [key, minted] of mintedSessions) {
      if (minted.expiresAtMs <= now) {
        mintedSessions.delete(key);
      }
    }
  }

  if (mintedSessions.has(cookieValue) || mintedSessions.size < MAX_REMEMBERED_SESSIONS) {
    mintedSessions.set(cookieValue, { ...session, expiresAtMs, marker, refreshedFrom });
  }
}

/**
 * Carries a revoke across instances (VEN-713). A revoke bumps the account's
 * `sessions_invalidated_at`, which the API enforces on every instance, but
 * {@link forgetSessionsFor} clears only the map of the process that handled it;
 * the surviving device's next request can land on another instance still
 * holding a token minted before the bump, and the API refuses it. The device
 * that ended its other sessions is the one that survives, so the instance that
 * handled the revoke hands it a fresh random marker cookie (a third device left
 * signed in by ending one named device is not reached this way), and every instance
 * serves a remembered token only if it was minted under the marker the caller
 * now carries. A marker is compared for equality, never ordered, so no two
 * clocks are involved. It outlives the JWT's own 15 minutes, after which every
 * token in circulation postdates the revoke anyway.
 */
export const REVOKE_MARKER_COOKIE = 'session-revoke-marker';
const REVOKE_MARKER_MAX_AGE_SECONDS = 20 * 60;

async function revokeMarkerValue(): Promise<string | null> {
  const jar = await cookies();
  const marker = jar.getAll().find((cookie) => cookie.name === REVOKE_MARKER_COOKIE)?.value;

  return marker ? marker : null;
}

/** Marks the caller as having ended sessions, so no instance serves them a pre-revoke token. */
export async function markSessionsRevoked(): Promise<void> {
  (await cookies()).set(REVOKE_MARKER_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REVOKE_MARKER_MAX_AGE_SECONDS,
  });
}

/**
 * The user id this process has cached the caller's own session cookie under,
 * or `undefined` when nothing is cached for it — a cold cache, or no session
 * cookie at all. The sign-out proxy uses this to know whose entries to forget
 * with {@link forgetSessionsFor} without an extra round trip to Neon Auth just
 * to ask (VEN-628): the cache is already keyed by this exact cookie value.
 */
export async function mintedUserIdForCaller(): Promise<string | undefined> {
  const cookieValue = await sessionCookieValue();

  return cookieValue === null ? undefined : mintedSessions.get(cookieValue)?.userId;
}

/**
 * Forgets what this process remembers for one user. A revoke at the provider
 * leaves the cookie value unchanged, so without this a revoked cookie keeps its
 * remembered token until it lapses (VEN-518). Other server instances are reached
 * through {@link markSessionsRevoked} instead.
 */
export function forgetSessionsFor(userId: string): void {
  for (const [key, minted] of mintedSessions) {
    if (minted.userId === userId) {
      mintedSessions.delete(key);
    }
  }
}

/**
 * The answer to a 401 on a token this process handed out (VEN-717). A revoke
 * bumps the account's `sessions_invalidated_at`, and only the device that asked
 * carries {@link REVOKE_MARKER_COOKIE}; a third device signed in on another
 * instance's cache has no marker, so that instance serves it a pre-revoke JWT
 * the API refuses. The refusal is the one signal every device gets, so it
 * drops every entry holding that token and mints again from the provider. A
 * session the provider has ended mints nothing, so a revoked device still gets
 * none. An entry this instance minted for a refusal of the same token (the
 * render's other calls) is returned as is; any other entry, even one that differs
 * from the refused token, may predate the revoke too and is replaced.
 */
export async function refreshRefusedToken(refused: string): Promise<ServerSession | null> {
  const cookieValue = await sessionCookieValue();

  if (cookieValue === null) {
    return null;
  }

  const marker = await revokeMarkerValue();
  const remembered = mintedSessions.get(cookieValue);

  if (remembered?.refreshedFrom === refused && remembered.expiresAtMs > Date.now()) {
    return { userId: remembered.userId, token: remembered.token };
  }

  for (const [key, minted] of mintedSessions) {
    if (minted.token === refused) {
      mintedSessions.delete(key);
    }
  }

  // Calls that refused the same token at once share one mint.
  const refreshKey = `${cookieValue}\n${refused}`;
  const inflight = refreshing.get(refreshKey);

  if (inflight) {
    return inflight;
  }

  const minting = mintSession(cookieValue, marker, refused).finally(() => {
    refreshing.delete(refreshKey);
  });
  refreshing.set(refreshKey, minting);

  return minting;
}

setRefusedTokenHandler(async (refused) => (await refreshRefusedToken(refused))?.token ?? null);

/** Test seam: forgets every remembered session, and that the outage was reported. */
export function clearServerSessions(): void {
  mintedSessions.clear();
  reportedMissingConfig = false;
}
