import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const token = vi.fn();
const getAll = vi.fn();
const setCookie = vi.fn();

vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: () => ({ getSession, token }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll, set: setCookie }) }));
// `cache()` memoises per request; each call here stands for a fresh request.
vi.mock('react', () => ({ cache: <T>(fn: T): T => fn }));
const captureMessage = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureMessage: (message: string, hint: unknown) => captureMessage(message, hint),
}));

import { z } from 'zod';
import { API_REQUEST_TIMEOUT_MS, ApiClientError, apiRequest } from '@/lib/api-client';
import {
  authConfigured,
  clearServerSessions,
  forgetSessionsFor,
  getServerSession,
  markSessionsRevoked,
  mintedUserIdForCaller,
  REVOKE_MARKER_COOKIE,
} from './server';

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);

/** An unsigned JWT-shaped string whose payload carries `exp` (seconds). */
function jwt(expSeconds: number): string {
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `header.${payload}.signature`;
}

function signedInAs(userId: string, sessionCookie: string): void {
  getSession.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: sessionCookie }]);
}

describe('getServerSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    getSession.mockReset();
    token.mockReset();
    getAll.mockReset();
    setCookie.mockReset();
    clearServerSessions();
  });

  it('asks Neon Auth once, not on every render of the same session', async () => {
    signedInAs('user-1', 'cookie-a');
    const minted = jwt(NOW / 1000 + 900);
    token.mockResolvedValue({ data: { token: minted }, error: null });

    const first = await getServerSession();
    const second = await getServerSession();
    const third = await getServerSession();

    expect(getSession).toHaveBeenCalledTimes(1);
    expect(token).toHaveBeenCalledTimes(1);
    expect([first, second, third]).toEqual([
      { userId: 'user-1', token: minted },
      { userId: 'user-1', token: minted },
      { userId: 'user-1', token: minted },
    ]);
  });

  it('forgets one user’s remembered sessions and no one else’s (VEN-518)', async () => {
    token.mockResolvedValue({ data: { token: jwt(NOW / 1000 + 900) }, error: null });
    signedInAs('user-1', 'cookie-a');
    await getServerSession();
    signedInAs('user-2', 'cookie-b');
    await getServerSession();
    expect(getSession).toHaveBeenCalledTimes(2);

    forgetSessionsFor('user-1');

    getSession.mockResolvedValue({ data: null, error: null });
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'cookie-a' }]);
    expect(await getServerSession()).toBeNull();
    expect(getSession).toHaveBeenCalledTimes(3);

    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'cookie-b' }]);
    expect((await getServerSession())?.userId).toBe('user-2');
    expect(getSession).toHaveBeenCalledTimes(3);
  });

  it('re-mints a token cached before another instance handled a revoke (VEN-713)', async () => {
    const stale = jwt(NOW / 1000 + 900);
    const fresh = jwt(NOW / 1000 + 901);
    const sessionCookie = { name: '__Secure-neon-auth.session_token', value: 'cookie-a' };
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token
      .mockResolvedValueOnce({ data: { token: stale }, error: null })
      .mockResolvedValueOnce({ data: { token: fresh }, error: null });

    // This process is instance X: it caches the caller's token.
    getAll.mockReturnValue([sessionCookie]);
    expect((await getServerSession())?.token).toBe(stale);

    // Instance Y handled the revoke and handed the surviving device a marker; its next request lands here.
    const marker = { name: REVOKE_MARKER_COOKIE, value: 'marker-1' };
    getAll.mockReturnValue([sessionCookie, marker]);
    expect((await getServerSession())?.token).toBe(fresh);

    // Minted under the marker, so it is served from the cache from here on.
    expect((await getServerSession())?.token).toBe(fresh);
    expect(token).toHaveBeenCalledTimes(2);

    // A second revoke changes the marker and forces one more mint.
    token.mockResolvedValueOnce({ data: { token: jwt(NOW / 1000 + 902) }, error: null });
    getAll.mockReturnValue([sessionCookie, { ...marker, value: 'marker-2' }]);
    await getServerSession();
    expect(token).toHaveBeenCalledTimes(3);
  });

  it('hands a revoked device nothing once the provider has ended its session (VEN-713)', async () => {
    const sessionCookie = { name: '__Secure-neon-auth.session_token', value: 'cookie-b' };
    getSession.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    token.mockResolvedValue({ data: { token: jwt(NOW / 1000 + 900) }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    await getServerSession();

    forgetSessionsFor('user-1');
    getSession.mockResolvedValue({ data: null, error: null });

    expect(await getServerSession()).toBeNull();
  });

  it('hands a revoked device nothing on another instance, whatever marker it presents (VEN-713)', async () => {
    const sessionCookie = { name: '__Secure-neon-auth.session_token', value: 'cookie-c' };
    getSession.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    token.mockResolvedValue({ data: { token: jwt(NOW / 1000 + 900) }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    await getServerSession();

    // The provider ended this session; a planted marker only forces the re-mint, which finds no session.
    getSession.mockResolvedValue({ data: null, error: null });
    getAll.mockReturnValue([sessionCookie, { name: REVOKE_MARKER_COOKIE, value: 'planted' }]);

    expect(await getServerSession()).toBeNull();
    expect(token).toHaveBeenCalledTimes(1);
  });

  it('replaces a full cache’s stale entry for a caller instead of re-minting on every request (VEN-713)', async () => {
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token.mockResolvedValue({ data: { token: jwt(NOW / 1000 + 900) }, error: null });

    for (let index = 0; index < 5_000; index += 1) {
      getAll.mockReturnValue([{ name: 'neon-auth.session_token', value: `cookie-${index}` }]);
      await getServerSession();
    }

    const sessionCookie = { name: 'neon-auth.session_token', value: 'cookie-0' };
    getAll.mockReturnValue([sessionCookie, { name: REVOKE_MARKER_COOKIE, value: 'marker-1' }]);
    await getServerSession();
    const mintsBefore = token.mock.calls.length;
    await getServerSession();

    expect(token).toHaveBeenCalledTimes(mintsBefore);
  });

  it('marks the caller with an httpOnly, random, expiring marker cookie', async () => {
    await markSessionsRevoked();
    await markSessionsRevoked();

    expect(setCookie).toHaveBeenCalledTimes(2);
    const [name, value, options] = setCookie.mock.calls[0] as [string, string, object];
    expect(name).toBe(REVOKE_MARKER_COOKIE);
    expect(value).toMatch(/^[0-9a-f-]{36}$/);
    expect(setCookie.mock.calls[1]?.[1]).not.toBe(value);
    expect(options).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 1200,
    });
  });

  it('asks again once the remembered token is inside the refresh window', async () => {
    signedInAs('user-1', 'cookie-a');
    token
      .mockResolvedValueOnce({ data: { token: jwt(NOW / 1000 + 900) }, error: null })
      .mockResolvedValueOnce({ data: { token: jwt(NOW / 1000 + 1800) }, error: null });

    await getServerSession();
    vi.setSystemTime(NOW + 841_000);
    await getServerSession();

    expect(getSession).toHaveBeenCalledTimes(2);
    expect(token).toHaveBeenCalledTimes(2);
  });

  it('never hands one session the token minted for another', async () => {
    const tokenA = jwt(NOW / 1000 + 900);
    const tokenB = jwt(NOW / 1000 + 901);
    token
      .mockResolvedValueOnce({ data: { token: tokenA }, error: null })
      .mockResolvedValueOnce({ data: { token: tokenB }, error: null });

    signedInAs('user-1', 'cookie-a');
    const a = await getServerSession();
    signedInAs('user-2', 'cookie-b');
    const b = await getServerSession();

    expect(a).toEqual({ userId: 'user-1', token: tokenA });
    expect(b).toEqual({ userId: 'user-2', token: tokenB });
  });

  it('cannot be reached by a cookie an attacker wrote under a lookalike name', async () => {
    const victimToken = jwt(NOW / 1000 + 900);
    token.mockResolvedValue({ data: { token: victimToken }, error: null });

    // The victim's render, with a planted cookie sorting ahead of the real one.
    getSession.mockResolvedValue({ data: { user: { id: 'victim' } }, error: null });
    getAll.mockReturnValue([
      { name: 'evil.session_token', value: 'ATTACKER' },
      { name: '__Secure-neon-auth.session_token', value: 'victim-cookie' },
    ]);
    await getServerSession();

    // The attacker replays only the planted cookie, and Neon Auth knows nothing of it.
    getSession.mockResolvedValue({ data: null, error: null });
    getAll.mockReturnValue([{ name: 'evil.session_token', value: 'ATTACKER' }]);

    expect(await getServerSession()).toBeNull();
  });

  it('does not key a session on an empty cookie value', async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: '' }]);

    expect(await getServerSession()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('does not cache a token whose expiry it cannot read', async () => {
    signedInAs('user-1', 'cookie-a');
    token.mockResolvedValue({ data: { token: 'opaque' }, error: null });

    await getServerSession();
    await getServerSession();

    expect(token).toHaveBeenCalledTimes(2);
  });

  it('reads signed out, and caches nothing, when Neon Auth refuses the token', async () => {
    signedInAs('user-1', 'cookie-a');
    token.mockResolvedValueOnce({
      data: null,
      error: { status: 429, code: 'over_request_rate_limit' },
    });
    const minted = jwt(NOW / 1000 + 900);
    token.mockResolvedValueOnce({ data: { token: minted }, error: null });

    expect(await getServerSession()).toBeNull();
    expect(await getServerSession()).toEqual({ userId: 'user-1', token: minted });
  });

  it('is signed out without a session cookie, and asks Neon Auth nothing', async () => {
    getAll.mockReturnValue([]);

    expect(await getServerSession()).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
    expect(token).not.toHaveBeenCalled();
  });

  it('is signed out when Neon Auth no longer knows the session, and asks for no token', async () => {
    getSession.mockResolvedValue({ data: null, error: null });
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'revoked' }]);

    expect(await getServerSession()).toBeNull();
    expect(token).not.toHaveBeenCalled();
  });

  // VEN-619: a `getSession`/`token` call with no deadline held `/` and
  // `/accept-terms` open until CI's own runner timeout ended the job.
  it('reads signed out, within the deadline, when getSession never answers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'cookie-a' }]);
    getSession.mockReturnValue(new Promise(() => {})); // stalls forever

    const pending = getServerSession();
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    expect(await pending).toBeNull();
    expect(token).not.toHaveBeenCalled();
    // AC2: the stalled call names itself in `web.log`, which CI uploads on
    // failure — without this, a hang here reads exactly like a real sign-out.
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('getSession'));
    errorSpy.mockRestore();
  });

  it('reads signed out, within the deadline, when token never answers', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    signedInAs('user-1', 'cookie-a');
    token.mockReturnValue(new Promise(() => {})); // stalls forever

    const pending = getServerSession();
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);

    expect(await pending).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('token'));
    errorSpy.mockRestore();
  });

  it('asks Neon Auth again on the next render after a stall, and caches nothing from it', async () => {
    // A stall must not poison the per-request memo: the next render is a
    // fresh `getServerSession()` call (`cache()` is mocked to a passthrough
    // here, matching what a new request gets in production), so it must ask
    // upstream again rather than replaying whatever the stalled call never
    // returned.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    signedInAs('user-1', 'cookie-a');
    token.mockReturnValueOnce(new Promise(() => {})); // stalls forever, once

    const stalled = getServerSession();
    await vi.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    expect(await stalled).toBeNull();

    const minted = jwt(NOW / 1000 + 900);
    token.mockResolvedValueOnce({ data: { token: minted }, error: null });
    expect(await getServerSession()).toEqual({ userId: 'user-1', token: minted });
    expect(token).toHaveBeenCalledTimes(2);
  });
});

describe('mintedUserIdForCaller', () => {
  beforeEach(() => {
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    getSession.mockReset();
    token.mockReset();
    getAll.mockReset();
    clearServerSessions();
  });

  it('reads the user id cached under the caller’s own cookie, with no call to Neon Auth', async () => {
    signedInAs('user-1', 'cookie-a');
    token.mockResolvedValue({ data: { token: jwt(NOW / 1000 + 900) }, error: null });
    await getServerSession();
    getSession.mockClear();

    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'cookie-a' }]);
    await expect(mintedUserIdForCaller()).resolves.toBe('user-1');
    expect(getSession).not.toHaveBeenCalled();
  });

  it('answers undefined for a cookie nothing is cached under', async () => {
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'never-rendered' }]);

    await expect(mintedUserIdForCaller()).resolves.toBeUndefined();
  });

  it('answers undefined with no session cookie at all', async () => {
    getAll.mockReturnValue([]);

    await expect(mintedUserIdForCaller()).resolves.toBeUndefined();
  });
});

describe('getServerSession without an auth configuration (VEN-635)', () => {
  beforeEach(() => {
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', '');
    getSession.mockReset();
    token.mockReset();
    getAll.mockReset();
    captureMessage.mockReset();
    clearServerSessions();
  });

  it('reads a caller holding a cookie as signed out, and reports the outage to Sentry once', async () => {
    getAll.mockReturnValue([{ name: '__Secure-neon-auth.session_token', value: 'stale' }]);

    const answers = [await getServerSession(), await getServerSession(), await getServerSession()];

    expect(answers).toEqual([null, null, null]);
    expect(getSession).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledOnce();
    expect(captureMessage).toHaveBeenCalledWith(
      'Neon Auth is not configured; every caller is read as signed out',
      { level: 'error', fingerprint: ['auth-config-missing'] },
    );
  });

  it('reports nothing for a caller with no cookie, who needs no auth at all', async () => {
    getAll.mockReturnValue([]);

    expect(await getServerSession()).toBeNull();
    expect(captureMessage).not.toHaveBeenCalled();
  });
});

describe('a third device on an instance holding a pre-revoke token (VEN-717)', () => {
  const sessionCookie = { name: '__Secure-neon-auth.session_token', value: 'cookie-third' };
  const schema = z.object({ ok: z.boolean() });
  const fetchMock = vi.fn();

  /** The API accepts only tokens minted after the revoke. */
  function apiAccepts(accepted: string): void {
    fetchMock.mockImplementation(async (_url: string, init: { headers: Record<string, string> }) =>
      init.headers.authorization === `Bearer ${accepted}`
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(
            JSON.stringify({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Session ended' }),
            { status: 401 },
          ),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    getSession.mockReset();
    token.mockReset();
    getAll.mockReset();
    clearServerSessions();
  });

  it('re-mints once and serves the API a token it accepts, though no marker was handed out', async () => {
    const stale = jwt(NOW / 1000 + 900);
    const fresh = jwt(NOW / 1000 + 901);
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token
      .mockResolvedValueOnce({ data: { token: stale }, error: null })
      .mockResolvedValueOnce({ data: { token: fresh }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    const session = await getServerSession();
    apiAccepts(fresh);

    await expect(apiRequest('/users/me', { schema, token: session?.token })).resolves.toEqual({
      ok: true,
    });

    expect(token).toHaveBeenCalledTimes(2);
    expect((await getServerSession())?.token).toBe(fresh);
  });

  it('mints once for a render whose several calls all carry the refused token', async () => {
    const stale = jwt(NOW / 1000 + 900);
    const fresh = jwt(NOW / 1000 + 901);
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token
      .mockResolvedValueOnce({ data: { token: stale }, error: null })
      .mockResolvedValueOnce({ data: { token: fresh }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    await getServerSession();
    apiAccepts(fresh);

    await Promise.all([
      apiRequest('/a', { schema, token: stale }),
      apiRequest('/b', { schema, token: stale }),
    ]);

    expect(token).toHaveBeenCalledTimes(2);
  });

  it('hands the ended device nothing: the provider mints no token, so the refusal stands', async () => {
    const stale = jwt(NOW / 1000 + 900);
    getSession.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null });
    token.mockResolvedValue({ data: { token: stale }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    await getServerSession();
    getSession.mockResolvedValue({ data: null, error: null });
    apiAccepts('none');

    const refused = apiRequest('/users/me', { schema, token: stale });

    await expect(refused).rejects.toBeInstanceOf(ApiClientError);
    await expect(refused).rejects.toMatchObject({ statusCode: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await getServerSession()).toBeNull();
  });

  it('retries only once when the fresh token is refused too', async () => {
    const stale = jwt(NOW / 1000 + 900);
    getSession.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    token
      .mockResolvedValueOnce({ data: { token: stale }, error: null })
      .mockResolvedValueOnce({ data: { token: jwt(NOW / 1000 + 902) }, error: null });
    getAll.mockReturnValue([sessionCookie]);
    await getServerSession();
    apiAccepts('none');

    await expect(apiRequest('/users/me', { schema, token: stale })).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('two web instances holding different pre-revoke tokens (VEN-717)', () => {
  const sessionCookie = { name: '__Secure-neon-auth.session_token', value: 'cookie-third' };

  it('never answers a refusal with the other instance’s pre-revoke token', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubEnv('NEON_AUTH_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', 'x'.repeat(32));
    getSession.mockReset().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    getAll.mockReset().mockReturnValue([sessionCookie]);
    const onA = jwt(NOW / 1000 + 900);
    const onB = jwt(NOW / 1000 + 901);
    const fresh = jwt(NOW / 1000 + 902);
    token
      .mockReset()
      .mockResolvedValueOnce({ data: { token: onA }, error: null })
      .mockResolvedValueOnce({ data: { token: onB }, error: null })
      .mockResolvedValueOnce({ data: { token: fresh }, error: null });

    vi.resetModules();
    const instanceA = await import('./server');
    vi.resetModules();
    const instanceB = await import('./server');
    expect((await instanceA.getServerSession())?.token).toBe(onA);
    expect((await instanceB.getServerSession())?.token).toBe(onB);

    // The API refused `onA`; the retry lands on instance B, whose entry is refused too.
    expect((await instanceB.refreshRefusedToken(onA))?.token).toBe(fresh);
    expect((await instanceB.getServerSession())?.token).toBe(fresh);
  });
});

describe('authConfigured', () => {
  it.each([
    ['https://auth.example.test', 'x'.repeat(32), true],
    ['https://auth.example.test', '', false],
    ['', 'x'.repeat(32), false],
  ])('base URL %j and secret %j → %s', (baseUrl, secret, expected) => {
    vi.stubEnv('NEON_AUTH_BASE_URL', baseUrl);
    vi.stubEnv('NEON_AUTH_COOKIE_SECRET', secret);

    expect(authConfigured()).toBe(expected);
  });
});
