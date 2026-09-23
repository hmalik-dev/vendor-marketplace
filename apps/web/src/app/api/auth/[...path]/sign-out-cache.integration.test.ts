import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * AC1 and AC2 of VEN-628, proved end to end rather than against a mocked
 * `@/lib/auth/server`: the only boundary faked here is the Neon Auth SDK
 * itself and `next/headers`' cookie jar, exactly as `server.test.ts` does.
 * Everything in between — the sign-out proxy, the minted-session cache, and
 * the session-token route — is the real code.
 */

type Context = { params: Promise<{ path: string[] }> };

const getSession = vi.fn();
const token = vi.fn();
let cookieJar: Array<{ name: string; value: string }> = [];

vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: () => ({
    getSession,
    token,
    handler: () => ({
      POST: async (_request: Request, context: Context) => {
        const { path } = await context.params;
        // Both the caller's own sign-out and the revoke-every-session call
        // (VEN-628) succeed; neither carries a body the caller reads.
        return path.join('/') === 'revoke-sessions' || path.join('/') === 'sign-out'
          ? Response.json({ success: true })
          : Response.json({ message: 'unexpected call' }, { status: 500 });
      },
      GET: vi.fn(),
    }),
  }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => cookieJar }) }));
// `cache()` memoises per request; each call here stands for a fresh request.
vi.mock('react', () => ({ cache: <T>(fn: T): T => fn }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

const { POST: signOutPost } = await import('./route');
const { GET: tokenGet } = await import('../../session/token/route');
const { clearServerSessions } = await import('@/lib/auth/server');
const { resetThrottle } = await import('@/lib/auth/proxy-throttle');

const COOKIE_NAME = '__Secure-neon-auth.session_token';

function withCookie(value: string): void {
  cookieJar = [{ name: COOKIE_NAME, value }];
}

/** A JWT-shaped string carrying `exp` (seconds), unsigned — `getServerSession` never verifies it itself. */
function jwt(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `header.${payload}.signature`;
}

function signOutRequest(cookie: string): Request {
  return new Request('http://localhost/api/auth/sign-out', {
    method: 'POST',
    headers: { 'x-forwarded-for': '1.1.1.1', cookie: `${COOKIE_NAME}=${cookie}` },
  });
}

describe('sign-out actually clears the cache it reads (VEN-628)', () => {
  beforeEach(() => {
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    vi.stubEnv('WEB_TIER_KEY', '');
    getSession.mockReset();
    token.mockReset();
    cookieJar = [];
    clearServerSessions();
    resetThrottle();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('AC1/AC2: after sign-out, the same cookie gets 401 from /api/session/token, with nothing left cached for it', async () => {
    const cookie = 'live-session-value';

    // Mint and cache the session, the way a normal render does.
    withCookie(cookie);
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token.mockResolvedValue({ data: { token: jwt(Date.now() / 1000 + 900) }, error: null });
    const before = await tokenGet();
    expect(before.status).toBe(200);
    // The cache satisfied this read without asking Neon Auth again.
    expect(getSession).toHaveBeenCalledTimes(1);

    // Sign out with the same cookie.
    const signedOut = await signOutPost(signOutRequest(cookie) as never, {
      params: Promise.resolve({ path: ['sign-out'] }),
    });
    expect(signedOut.status).toBe(200);

    // Neon Auth now disowns the cookie too — the same answer a real revoke gives.
    getSession.mockResolvedValue({ data: null, error: null });

    const after = await tokenGet();

    expect(after.status).toBe(401);
    // A live cache entry would have answered 200 from memory, regardless of
    // what Neon Auth was just told to say — so this also proves AC2: nothing
    // was left cached for the cookie sign-out just ended.
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('leaves an unrelated cookie’s cached session alone', async () => {
    getSession.mockImplementation(async () => ({
      data: { user: { id: cookieJar[0]?.value === 'cookie-a' ? 'user-a' : 'user-b' } },
      error: null,
    }));
    token.mockResolvedValue({ data: { token: jwt(Date.now() / 1000 + 900) }, error: null });

    withCookie('cookie-a');
    await tokenGet();
    withCookie('cookie-b');
    await tokenGet();
    expect(getSession).toHaveBeenCalledTimes(2);

    // `mintedUserIdForCaller` reads the caller's cookie off the (mocked)
    // request context, the same as a real sign-out POST for cookie-a would.
    withCookie('cookie-a');
    await signOutPost(signOutRequest('cookie-a') as never, {
      params: Promise.resolve({ path: ['sign-out'] }),
    });

    withCookie('cookie-b');
    const stillIn = await tokenGet();

    expect(stillIn.status).toBe(200);
    // Answered from the cache user-b was minted into — no extra Neon Auth call.
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
