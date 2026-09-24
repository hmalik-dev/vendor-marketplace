/**
 * The browser's one door to the API bearer token.
 *
 * The session cookie is httpOnly, so client code cannot read it; it asks
 * `/api/session/token` instead and gets a short-lived JWT. The answer is cached
 * in module memory and refetched when it is within a minute of expiring, so a
 * form left open past the token's lifetime still submits and a burst of calls
 * costs one round trip.
 */

import { setRefusedTokenHandler } from '../api-client';
import { REFUSED_TOKEN_HEADER } from './refused-token-header';
import { tokenExpiryMs } from './token-expiry';

/** Refetch when the cached token has this long or less left. */
export const REFRESH_WINDOW_MS = 60_000;

export const SESSION_TOKEN_PATH = '/api/session/token';

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<string | null> | null = null;

async function fetchToken(refused?: string): Promise<string | null> {
  const response = await fetch(SESSION_TOKEN_PATH, {
    cache: 'no-store',
    credentials: 'same-origin',
    ...(refused ? { headers: { [REFUSED_TOKEN_HEADER]: refused } } : {}),
  });

  if (response.status === 401 || (await authUnavailable(response))) {
    cached = null;
    return null;
  }

  if (!response.ok) {
    throw new Error(`Session token request failed with ${response.status}.`);
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== 'string' || !body.token) {
    cached = null;
    return null;
  }

  const expiresAtMs = tokenExpiryMs(body.token);
  cached = expiresAtMs === null ? null : { token: body.token, expiresAtMs };

  return body.token;
}

/**
 * The route's 503 `AUTH_UNAVAILABLE` (VEN-635): with no auth configuration the
 * server already renders every caller signed out, so the browser reads it the
 * same way and public calls still go out unauthenticated. Any other 5xx stays
 * a retryable failure.
 */
async function authUnavailable(response: Response): Promise<boolean> {
  if (response.status !== 503) {
    return false;
  }

  // No catch: an unreadable 503 body rejects, the same retryable failure as any other 5xx.
  const body = (await response.json()) as { code?: unknown } | null;
  return body?.code === 'AUTH_UNAVAILABLE';
}

/**
 * The bearer token for the signed-in browser, or `null` when signed out.
 * Rejects on a network failure or a 5xx so callers can retry; a refusal is
 * `null`, never an error.
 */
export async function getSessionToken(): Promise<string | null> {
  if (cached && cached.expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
    return cached.token;
  }

  inflight ??= fetchToken().finally(() => {
    inflight = null;
  });

  return inflight;
}

/** Forgets the cached token; called on sign-in and sign-out. */
export function clearSessionToken(): void {
  cached = null;
}

/**
 * A 401 on the cached token (VEN-717): another device ended a session, and the
 * web instance that minted this token has no marker to tell it so. Ask the route
 * for a re-mint, once at a time, and hand the caller the new token.
 */
setRefusedTokenHandler((refused) => {
  if (cached?.token === refused) {
    cached = null;
  }

  inflight ??= fetchToken(refused).finally(() => {
    inflight = null;
  });

  return inflight;
});
