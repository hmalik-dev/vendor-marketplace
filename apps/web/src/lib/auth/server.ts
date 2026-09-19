import { createNeonAuth } from '@neondatabase/auth/next/server';
import { cache } from 'react';

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
    const auth = neonAuth();
    const { data: session } = await auth.getSession();

    if (!session?.user) {
      return null;
    }

    const { data } = await auth.token();

    return data?.token ? { userId: session.user.id, token: data.token } : null;
  },
);
