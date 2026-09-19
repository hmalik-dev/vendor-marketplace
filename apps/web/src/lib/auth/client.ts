/**
 * The browser's one door to the API bearer token.
 *
 * The session cookie is httpOnly, so client code cannot read it; it asks
 * `/api/session/token` instead and gets a short-lived JWT. The answer is cached
 * in module memory and refetched when it is within a minute of expiring, so a
 * form left open past the token's lifetime still submits and a burst of calls
 * costs one round trip.
 */

/** Refetch when the cached token has this long or less left. */
export const REFRESH_WINDOW_MS = 60_000;

const SESSION_TOKEN_PATH = '/api/session/token';

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

let cached: CachedToken | null = null;
let inflight: Promise<string | null> | null = null;

/**
 * Reads `exp` from the JWT payload. Not verified — the API verifies; this only
 * decides when to ask again. A token with no readable `exp` is never cached.
 */
function expiryOf(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) {
    return null;
  }

  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

async function fetchToken(): Promise<string | null> {
  const response = await fetch(SESSION_TOKEN_PATH, {
    cache: 'no-store',
    credentials: 'same-origin',
  });

  if (response.status === 401) {
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

  const expiresAtMs = expiryOf(body.token);
  cached = expiresAtMs === null ? null : { token: body.token, expiresAtMs };

  return body.token;
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
