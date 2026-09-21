import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const token = vi.fn();
const getAll = vi.fn();

vi.mock('@neondatabase/auth/next/server', () => ({
  createNeonAuth: () => ({ getSession, token }),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll }) }));
// `cache()` memoises per request; each call here stands for a fresh request.
vi.mock('react', () => ({ cache: <T>(fn: T): T => fn }));

import { clearServerSessions, forgetSessionsFor, getServerSession } from './server';

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
});
