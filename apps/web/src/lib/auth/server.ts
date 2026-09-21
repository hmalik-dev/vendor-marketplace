import { createNeonAuth } from '@neondatabase/auth/next/server';
import { cookies } from 'next/headers';
import { cache } from 'react';
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
 * Reads the signed-in caller on the server, or `null`.
 *
 * Never throws for "nobody is signed in": the Neon SDK answers `{ data: null }`
 * for that, and every caller here treats it as the redirect-to-sign-in case.
 * `cache()`d because the header, the footer and the page each ask in one render.
 */
export const getServerSession = cache(
  async function getServerSession(): Promise<ServerSession | null> {
    const cookieValue = await sessionCookieValue();

    if (cookieValue === null) {
      return null;
    }

    const remembered = mintedSessions.get(cookieValue);

    if (remembered && remembered.expiresAtMs - Date.now() > REFRESH_WINDOW_MS) {
      return { userId: remembered.userId, token: remembered.token };
    }

    const auth = neonAuth();
    const { data: session } = await auth.getSession();

    if (!session?.user) {
      return null;
    }

    const { data } = await auth.token();

    if (!data?.token) {
      return null;
    }

    const minted: ServerSession = { userId: session.user.id, token: data.token };
    remember(cookieValue, minted);

    return minted;
  },
);

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
 * already honours that token for, so nothing outlives what a token in the
 * browser could do anyway. Keyed by the session cookie, which is the credential
 * the caller already holds: a sign-out deletes the cookie, so the entry is
 * never asked for again.
 */
const REFRESH_WINDOW_MS = 60_000;
const MAX_REMEMBERED_SESSIONS = 5_000;

interface MintedSession extends ServerSession {
  expiresAtMs: number;
}

const mintedSessions = new Map<string, MintedSession>();

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

function remember(cookieValue: string, session: ServerSession): void {
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

  if (mintedSessions.size < MAX_REMEMBERED_SESSIONS) {
    mintedSessions.set(cookieValue, { ...session, expiresAtMs });
  }
}

/**
 * Forgets what this process remembers for one user. A revoke at the provider
 * leaves the cookie value unchanged, so without this a revoked cookie keeps its
 * remembered token until it lapses (VEN-518). Other server instances lapse on
 * their own within the JWT's life.
 */
export function forgetSessionsFor(userId: string): void {
  for (const [key, minted] of mintedSessions) {
    if (minted.userId === userId) {
      mintedSessions.delete(key);
    }
  }
}

/** Test seam: forgets every remembered session. */
export function clearServerSessions(): void {
  mintedSessions.clear();
}
