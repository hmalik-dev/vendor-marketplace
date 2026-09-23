import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Context = { params: Promise<{ path: string[] }> };
const upstreamPost = vi.fn<(request: Request, context: Context) => Promise<Response>>();
const afterTasks: Array<() => Promise<void>> = [];

const forgetSessionsFor = vi.fn();
const mintedUserIdForCaller = vi.fn<() => Promise<string | undefined>>();
const getSession = vi.fn();
const authConfigured = vi.fn<() => boolean>();
vi.mock('@/lib/auth/server', () => ({
  authConfigured: () => authConfigured(),
  forgetSessionsFor: (userId: string) => forgetSessionsFor(userId),
  mintedUserIdForCaller: () => mintedUserIdForCaller(),
  neonAuth: () => ({
    handler: () => ({ POST: upstreamPost, GET: vi.fn() }),
    getSession: () => getSession(),
  }),
}));
const captureException = vi.fn();
const captureMessage = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  captureException: (error: unknown) => captureException(error),
  captureMessage: (message: string, hint: unknown) => captureMessage(message, hint),
}));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (task: () => Promise<void>) => afterTasks.push(task),
}));

const { POST } = await import('./route');
const { resetThrottle } = await import('@/lib/auth/proxy-throttle');

/*
 * No web tier key unless a suite sets one: with a key the throttle and the
 * internal calls reach a real API, and a lane's env (VEN-662) carries one.
 */
beforeEach(() => {
  vi.stubEnv('WEB_TIER_KEY', '');
  authConfigured.mockReset().mockReturnValue(true);
  mintedUserIdForCaller.mockReset().mockResolvedValue(undefined);
  getSession.mockReset().mockResolvedValue({ data: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const REQUEST = 'email-otp/request-password-reset';
const RESET = 'email-otp/reset-password';
const SIGN_OUT = 'sign-out';

function call(path: string, body: unknown, ip = '1.1.1.1'): Promise<Response> {
  const request = new Request(`http://localhost/api/auth/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  });

  return POST(request as never, { params: Promise.resolve({ path: path.split('/') }) });
}

async function drain(): Promise<void> {
  await Promise.all(afterTasks.splice(0).map((task) => task()));
}

describe('password reset through the auth proxy', () => {
  beforeEach(() => {
    resetThrottle();
    afterTasks.length = 0;
    upstreamPost.mockReset();
    captureException.mockReset();
    captureMessage.mockReset();
    forgetSessionsFor.mockReset();
  });
  afterEach(() => afterTasks.splice(0));

  it('answers a reset request identically for a registered and an unregistered address', async () => {
    upstreamPost.mockImplementation(async (request) => {
      const { email } = (await request.json()) as { email: string };
      return email === 'known@example.com'
        ? Response.json({ success: true })
        : Response.json({ message: 'User not found' }, { status: 404 });
    });

    const known = await call(REQUEST, { email: 'known@example.com', type: 'forget-password' });
    const unknown = await call(REQUEST, { email: 'nobody@example.com', type: 'forget-password' });

    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(await known.json()).toEqual({ success: true });
    expect(await unknown.json()).toEqual({ success: true });
  });

  it('does not wait for the provider, so a slow send cannot be told from a fast refusal', async () => {
    upstreamPost.mockReturnValue(new Promise(() => undefined));

    const response = await call(REQUEST, { email: 'known@example.com' });

    expect(response.status).toBe(200);
    expect(upstreamPost).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);
  });

  it('forwards the original body to the provider once the response is out', async () => {
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    await call(REQUEST, { email: 'known@example.com', type: 'forget-password' });
    await drain();

    expect(upstreamPost).toHaveBeenCalledOnce();
    expect(await upstreamPost.mock.calls[0]?.[0].json()).toEqual({
      email: 'known@example.com',
      type: 'forget-password',
    });
  });

  it('reports a provider failure after the response instead of losing it', async () => {
    const failure = new Error('down');
    upstreamPost.mockRejectedValue(failure);

    await call(REQUEST, { email: 'known@example.com' });
    await drain();

    expect(captureException).toHaveBeenCalledWith(failure);
  });

  it('reports a refused send after the response', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'BAD' }, { status: 400 }));

    await call(REQUEST, { email: 'known@example.com' });
    await drain();

    expect(captureMessage).toHaveBeenCalledWith(
      'Password reset mail was refused by the auth provider',
      { level: 'error', extra: { status: 400 } },
    );
  });

  it('throttles requests per address: the sixth from many callers looks the same but is not sent', async () => {
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await call(REQUEST, { email: 'Known@Example.com' }, `9.9.9.${i}`);
      statuses.push(response.status);
    }
    await drain();

    expect(statuses).toEqual([200, 200, 200, 200, 200, 200]);
    expect(upstreamPost).toHaveBeenCalledTimes(5);
  });

  it('throttles requests per caller: the eleventh in a minute is a 429', async () => {
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      statuses.push((await call(REQUEST, { email: `p${i}@example.com` })).status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200));
    expect(statuses[10]).toBe(429);
  });

  it('returns the provider answer for a code check, and refuses the sixth guess at one address', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_OTP' }, { status: 400 }));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await call(
        RESET,
        { email: 'known@example.com', otp: '000000', password: 'a-long-password' },
        `8.8.8.${i}`,
      );
      statuses.push(response.status);
    }

    expect(statuses).toEqual([400, 400, 400, 400, 400, 429]);
    expect(upstreamPost).toHaveBeenCalledTimes(5);
  });

  it.each([
    ['a form body', 'email=known%40example.com'],
    ['an array address', JSON.stringify({ email: ['known@example.com'] })],
    ['no address', JSON.stringify({ otp: '000000' })],
    ['a body that is not JSON', 'nope'],
  ])('refuses %s instead of forwarding it off-budget', async (_name, body) => {
    for (const path of [REQUEST, RESET]) {
      const response = await POST(
        new Request(`http://localhost/api/auth/${path}`, {
          method: 'POST',
          headers: { 'x-forwarded-for': '2.2.2.2' },
          body,
        }) as never,
        { params: Promise.resolve({ path: path.split('/') }) },
      );

      expect(response.status).toBe(400);
    }
    await drain();

    expect(upstreamPost).not.toHaveBeenCalled();
  });

  it('collapses every provider refusal of a code check to one answer', async () => {
    const answers: Array<[number, unknown]> = [];
    for (const upstream of [
      Response.json({ code: 'USER_NOT_FOUND' }, { status: 404 }),
      Response.json({ code: 'INVALID_OTP' }, { status: 400 }),
    ]) {
      upstreamPost.mockResolvedValueOnce(upstream);
      const response = await call(RESET, { email: `p${answers.length}@example.com`, otp: '1' });
      answers.push([response.status, await response.json()]);
    }

    expect(answers).toEqual([
      [400, { message: 'Invalid' }],
      [400, { message: 'Invalid' }],
    ]);
  });

  it('passes a successful code check through', async () => {
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    const response = await call(RESET, { email: 'a@example.com', otp: '123456', password: 'x' });

    expect([response.status, await response.json()]).toEqual([200, { success: true }]);
  });

  describe('ending the account’s sessions after a reset (VEN-518)', () => {
    const reset = { email: 'a@example.com', otp: '123456', password: 'a-new-long-password' };
    // The real handler routes on `params`, never on the request URL.
    const route = async (context: Context): Promise<string> =>
      (await context.params).path.join('/');
    const answers = (
      signIn: Response | Error,
      revoke: Response = Response.json({ status: true }),
    ) =>
      upstreamPost.mockImplementation(async (_request, context) => {
        const path = await route(context);
        if (path === 'sign-in/email') {
          if (signIn instanceof Error) throw signIn;
          return signIn;
        }
        if (path === 'revoke-sessions') return revoke;
        return Response.json({ success: true });
      });
    const paths = (): Promise<string[]> =>
      Promise.all(upstreamPost.mock.calls.map(([, context]) => route(context)));

    function sessionResponse(): Response {
      const headers = new Headers();
      headers.append('set-cookie', '__Secure-neon-auth.session_token=abc; Path=/; HttpOnly');
      headers.append('set-cookie', '__Secure-neon-auth.session_data=xyz; Path=/');
      return new Response(JSON.stringify({ token: 'abc', user: { id: 'user-9' } }), { headers });
    }

    it('signs in with the new password, then revokes every session with that session', async () => {
      answers(sessionResponse());

      const response = await call(RESET, reset);

      expect([response.status, await response.json()]).toEqual([200, { success: true }]);
      expect(await paths()).toEqual([
        'email-otp/reset-password',
        'sign-in/email',
        'revoke-sessions',
      ]);
      expect(await upstreamPost.mock.calls[1]?.[0].json()).toEqual({
        email: 'a@example.com',
        password: 'a-new-long-password',
      });
      expect(upstreamPost.mock.calls[2]?.[0].headers.get('cookie')).toBe(
        '__Secure-neon-auth.session_token=abc; __Secure-neon-auth.session_data=xyz',
      );
      expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-9');
    });

    it('bounds every earlier JWT at the API once the sessions are ended (VEN-670)', async () => {
      vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
      answers(sessionResponse());
      const fetchMock = vi.fn().mockResolvedValue(Response.json({ invalidated: true }));
      vi.stubGlobal('fetch', fetchMock);

      const response = await call(RESET, reset);

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/internal/session-generation'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ authUserId: 'user-9' }),
        }),
      );
    });

    it('reports a failed session-generation call after a reset, and still answers the reset', async () => {
      vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
      answers(sessionResponse());
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({}, { status: 500 })));

      const response = await call(RESET, reset);

      expect(response.status).toBe(200);
      expect(captureMessage).toHaveBeenCalledWith("Could not bound a signed-out session's JWT", {
        level: 'warning',
        extra: { status: 500 },
      });
    });

    it('does not sign in or revoke when the code check is refused', async () => {
      upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_OTP' }, { status: 400 }));

      const response = await call(RESET, reset);

      expect(response.status).toBe(400);
      expect(await paths()).toEqual(['email-otp/reset-password']);
    });

    it('reports a failed revoke and still answers that the password was reset', async () => {
      answers(sessionResponse(), Response.json({}, { status: 500 }));

      const response = await call(RESET, reset);

      expect([response.status, await response.json()]).toEqual([200, { success: true }]);
      expect(captureException).toHaveBeenCalledWith(
        new Error('Other sessions were not ended (500)'),
      );
      expect(forgetSessionsFor).not.toHaveBeenCalled();
    });

    it('reports a sign-in that opens no session and never calls revoke', async () => {
      answers(Response.json({ code: 'INVALID' }, { status: 401 }));

      const response = await call(RESET, reset);

      expect(response.status).toBe(200);
      expect(await paths()).not.toContain('revoke-sessions');
      expect(captureException).toHaveBeenCalledWith(
        new Error('Could not open a session to end the others (401)'),
      );
    });

    it('reports a sign-in that sets no session cookie and never calls revoke', async () => {
      answers(Response.json({ token: 'abc', user: { id: 'user-9' } }));

      const response = await call(RESET, reset);

      expect(response.status).toBe(200);
      expect(await paths()).not.toContain('revoke-sessions');
      expect(captureException).toHaveBeenCalledWith(
        new Error('Signing in to end the other sessions set no session cookie'),
      );
    });

    it('reports a sign-in that throws and still answers that the password was reset', async () => {
      const failure = new Error('down');
      answers(failure);

      const response = await call(RESET, reset);

      expect([response.status, await response.json()]).toEqual([200, { success: true }]);
      expect(captureException).toHaveBeenCalledWith(failure);
    });

    it('does not carry the caller’s cookie or bearer token into the internal calls', async () => {
      answers(sessionResponse());
      const request = new Request('http://localhost/api/auth/email-otp/reset-password', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '3.3.3.3',
          cookie: 'planted=1',
          authorization: 'Bearer attacker',
        },
        body: JSON.stringify(reset),
      });
      await POST(request as never, { params: Promise.resolve({ path: RESET.split('/') }) });

      const signIn = upstreamPost.mock.calls[1]?.[0].headers;
      expect([signIn?.get('cookie'), signIn?.get('authorization')]).toEqual([null, null]);
      expect(upstreamPost.mock.calls[2]?.[0].headers.get('authorization')).toBeNull();
    });
  });

  it('drops the length and encoding headers of the original bytes when forwarding', async () => {
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    await call(RESET, { email: 'a@example.com', otp: '123456', password: 'x' });

    const forwarded = upstreamPost.mock.calls[0]?.[0].headers;
    expect(forwarded?.get('content-length')).toBeNull();
    expect(forwarded?.get('content-encoding')).toBeNull();
  });

  it('refuses the link-based reset calls, which the allowlist does not name', async () => {
    const response = await call('reset-password', { newPassword: 'a-long-password' });

    expect(response.status).toBe(404);
    expect(upstreamPost).not.toHaveBeenCalled();
  });
});

describe('signing out through the auth proxy (VEN-628)', () => {
  beforeEach(() => {
    resetThrottle();
    upstreamPost.mockReset();
    forgetSessionsFor.mockReset();
    captureMessage.mockReset();
    captureException.mockReset();
    // Every sign-out revokes every session first; unless a test cares which
    // path got which answer, both calls succeed.
    upstreamPost.mockResolvedValue(Response.json({ success: true }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('forgets the caller’s cached session once the provider confirms sign-out', async () => {
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    const response = await call(SIGN_OUT, {});

    expect(response.status).toBe(200);
    expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-9');
    // The cache already named the caller; no need to ask Neon Auth again.
    expect(getSession).not.toHaveBeenCalled();
  });

  it('asks Neon Auth for the caller’s id when nothing is cached for their cookie', async () => {
    mintedUserIdForCaller.mockResolvedValue(undefined);
    getSession.mockResolvedValue({ data: { user: { id: 'user-cold' } } });
    upstreamPost.mockResolvedValue(Response.json({ success: true }));

    await call(SIGN_OUT, {});

    expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-cold');
  });

  it('forgets nothing and reports it when the caller cannot be identified either way', async () => {
    await call(SIGN_OUT, {});

    expect(forgetSessionsFor).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledWith(
      'Signed out a caller this process could not identify',
      { level: 'warning' },
    );
  });

  it('revokes every session for the account before ending the caller’s own, with their cookie', async () => {
    mintedUserIdForCaller.mockResolvedValue('user-9');
    const calls: Array<{ path: string; cookie: string | null }> = [];
    upstreamPost.mockImplementation(async (request, context) => {
      const { path } = await context.params;
      calls.push({ path: path.join('/'), cookie: request.headers.get('cookie') });
      return Response.json({ success: true });
    });

    const request = new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '1.1.1.1',
        cookie: '__Secure-neon-auth.session_token=abc',
      },
    });
    await POST(request as never, { params: Promise.resolve({ path: SIGN_OUT.split('/') }) });

    expect(calls).toEqual([
      { path: 'revoke-sessions', cookie: '__Secure-neon-auth.session_token=abc' },
      { path: 'sign-out', cookie: '__Secure-neon-auth.session_token=abc' },
    ]);
  });

  it('still ends the caller’s own session, and reports it, when revoking every other one fails', async () => {
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockImplementation(async (request, context) => {
      const { path } = await context.params;
      return path.join('/') === 'revoke-sessions'
        ? Response.json({ message: 'down' }, { status: 500 })
        : Response.json({ success: true });
    });

    const response = await call(SIGN_OUT, {});

    expect(response.status).toBe(200);
    expect(captureMessage).toHaveBeenCalledWith('Could not end every session on sign-out', {
      level: 'warning',
      extra: { status: 500 },
    });
    expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-9');
  });

  it('does not touch the cache when the provider refuses to sign out', async () => {
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockResolvedValue(Response.json({ message: 'down' }, { status: 500 }));

    const response = await call(SIGN_OUT, {});

    expect(response.status).toBe(500);
    expect(forgetSessionsFor).not.toHaveBeenCalled();
  });

  it('bounds the minted JWT at the API once a web tier key is configured', async () => {
    vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockResolvedValue(Response.json({ success: true }));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ invalidated: true }));
    vi.stubGlobal('fetch', fetchMock);

    await call(SIGN_OUT, {});

    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      expect.stringContaining('/internal/session-generation'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ authUserId: 'user-9' }),
      }),
    );
  });

  it('reports, rather than fails on, an unreachable session-generation call', async () => {
    vi.stubEnv('WEB_TIER_KEY', 'k'.repeat(40));
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockResolvedValue(Response.json({ success: true }));
    const failure = new Error('down');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(failure));

    const response = await call(SIGN_OUT, {});

    expect(response.status).toBe(200);
    expect(captureException).toHaveBeenCalledWith(failure);
  });

  it('never calls the internal endpoint with no web tier key configured', async () => {
    vi.stubEnv('WEB_TIER_KEY', '');
    mintedUserIdForCaller.mockResolvedValue('user-9');
    upstreamPost.mockResolvedValue(Response.json({ success: true }));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await call(SIGN_OUT, {});

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sign-in through the auth proxy', () => {
  const SIGN_IN = 'sign-in/email';

  // The in-process floor is what this suite drives; a stray key must not reach a real API.
  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
    upstreamPost.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('does not spend the budget on the provider being down', async () => {
    upstreamPost.mockResolvedValue(Response.json({}, { status: 503 }));

    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) {
      statuses.push(
        (await call(SIGN_IN, { email: 'down@example.com', password: 'p' }, `4.4.4.${i}`)).status,
      );
    }

    expect(statuses).toEqual(Array(12).fill(503));
  });

  it('refuses the eleventh attempt once ten wrong passwords for one email came from ten addresses', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID' }, { status: 401 }));

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await call(
        SIGN_IN,
        { email: 'Victim@Example.com', password: 'guess' },
        `7.7.7.${i}`,
      );
      statuses.push(response.status);
    }

    expect(statuses.slice(0, 10)).toEqual(Array(10).fill(401));
    expect(statuses[10]).toBe(429);
    expect(upstreamPost).toHaveBeenCalledTimes(10);
  });

  it('never locks out successful sign-ins, so naming an address cannot deny its owner', async () => {
    upstreamPost.mockResolvedValue(Response.json({ token: 't' }));

    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) {
      statuses.push(
        (await call(SIGN_IN, { email: 'owner@example.com', password: 'right' }, `5.5.5.${i}`))
          .status,
      );
    }

    expect(statuses).toEqual(Array(15).fill(200));
  });

  it('hands the body on intact and returns the provider answer unchanged', async () => {
    upstreamPost.mockImplementation(async (request) =>
      Response.json({ echoed: await request.json() }, { status: 401 }),
    );

    const response = await call(SIGN_IN, { email: 'a@example.com', password: 'p' });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ echoed: { email: 'a@example.com', password: 'p' } });
  });

  it('does not forward a sign-in that names no address', async () => {
    const response = await call(SIGN_IN, { password: 'p' });

    expect(response.status).toBe(400);
    expect(upstreamPost).not.toHaveBeenCalled();
  });

  it('budgets a code check per address too', async () => {
    upstreamPost.mockResolvedValue(Response.json({ status: true }));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (
          await call(
            'email-otp/verify-email',
            { email: 'c@example.com', otp: '123456' },
            `6.6.6.${i}`,
          )
        ).status,
      );
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

describe('sign-up through the auth proxy (VEN-662)', () => {
  const SIGN_UP = 'sign-up/email';
  const KEY = 'k'.repeat(40);
  const EMAIL = 'new.person@example.com';
  const created = () =>
    Response.json(
      { token: 't', user: { id: 'auth-new-1', email: EMAIL } },
      { headers: { 'set-cookie': 'session=abc; Path=/' } },
    );

  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', KEY);
    resetThrottle();
    upstreamPost.mockReset();
    captureException.mockReset();
    captureMessage.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /**
   * `fetch` as the proxy sees it: with a web tier key the throttle counts at
   * the API too, so its calls are answered "not throttled" and only the
   * record calls reach `record`.
   */
  function stubApi(record: (url: string, init: RequestInit) => Promise<Response>): void {
    vi.stubGlobal('fetch', (url: string, init: RequestInit) =>
      url.endsWith('/internal/throttle')
        ? Promise.resolve(Response.json({ throttled: false }))
        : record(url, init),
    );
  }

  const NO_ROLE = Symbol('no role');

  function signUp(role: unknown): Promise<Response> {
    return call(SIGN_UP, {
      email: EMAIL,
      password: 'correct horse',
      name: 'new.person',
      ...(role === NO_ROLE ? {} : { role }),
    });
  }

  it('forwards the sign-up without its role, then records the role against the new id', async () => {
    upstreamPost.mockResolvedValue(created());
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ recorded: true }));
    stubApi(fetchMock);

    const response = await signUp('vendor');

    expect(response.status).toBe(200);
    expect(await upstreamPost.mock.calls[0]?.[0].json()).toEqual({
      email: EMAIL,
      password: 'correct horse',
      name: 'new.person',
    });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/v1\/internal\/sign-up-role$/),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-web-tier-key': KEY }),
        body: JSON.stringify({ authUserId: 'auth-new-1', role: 'vendor' }),
      }),
    );
  });

  it.each([['admin'], ['Vendor'], [''], [null], [NO_ROLE]])(
    'refuses the role %s with a 400 before the provider is called',
    async (role) => {
      const fetchMock = vi.fn();
      stubApi(fetchMock);

      const response = await signUp(role);

      expect(response.status).toBe(400);
      expect(upstreamPost).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('retries a failed record once, and answers the sign-up when the retry lands', async () => {
    upstreamPost.mockResolvedValue(created());
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(Response.json({ recorded: true }));
    stubApi(fetchMock);

    const response = await signUp('customer');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it('answers a failure, not the sign-up’s 200, when the record fails twice — and reports the id, never the address', async () => {
    upstreamPost.mockResolvedValue(created());
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({}, { status: 500 }))
      .mockRejectedValueOnce(new Error('down'));
    stubApi(fetchMock);

    const response = await signUp('vendor');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'SIGN_UP_UNRECORDED' });
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Each attempt carries its own two-second deadline.
    const deadlines = timeout.mock.results.filter((_, i) => timeout.mock.calls[i]?.[0] === 2_000);
    for (const [, init] of fetchMock.mock.calls as [string, RequestInit][]) {
      expect(deadlines.map((result) => result.value)).toContain(init.signal);
    }
    expect(captureMessage).toHaveBeenCalledExactlyOnceWith(
      'Could not record the role chosen at sign-up',
      { level: 'error', extra: { authUserId: 'auth-new-1' } },
    );
    expect(JSON.stringify(captureMessage.mock.calls)).not.toContain(EMAIL);
  });

  it('answers a failure when the provider’s sign-up answer names no account id', async () => {
    upstreamPost.mockResolvedValue(Response.json({ token: 't' }));
    const fetchMock = vi.fn();
    stubApi(fetchMock);

    const response = await signUp('vendor');

    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(captureMessage).toHaveBeenCalledExactlyOnceWith(
      'A sign-up answer named no account id, so its role was not recorded',
      { level: 'error' },
    );
  });

  it('passes a refused sign-up through and records nothing', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'USER_ALREADY_EXISTS' }, { status: 422 }));
    const fetchMock = vi.fn();
    stubApi(fetchMock);

    const response = await signUp('vendor');

    expect(response.status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers 503 AUTH_UNAVAILABLE and creates no account with no web tier key to record with', async () => {
    vi.stubEnv('WEB_TIER_KEY', '');

    const response = await signUp('vendor');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'AUTH_UNAVAILABLE' });
    expect(upstreamPost).not.toHaveBeenCalled();
  });
});

describe('the auth proxy without an auth configuration (VEN-635)', () => {
  beforeEach(() => {
    resetThrottle();
    afterTasks.length = 0;
    upstreamPost.mockReset();
    authConfigured.mockReturnValue(false);
  });

  it('answers a sign-in 503 AUTH_UNAVAILABLE, so the form can say so', async () => {
    const response = await call('sign-in/email', { email: 'a@example.com', password: 'p' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'AUTH_UNAVAILABLE' });
    expect(upstreamPost).not.toHaveBeenCalled();
  });

  it('answers a reset request 503 and schedules no send, rather than claiming one went out', async () => {
    const response = await call(REQUEST, { email: 'nobody@example.invalid' });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: 'AUTH_UNAVAILABLE' });
    expect(afterTasks).toHaveLength(0);
  });

  it('still answers 200 for an unknown address once auth is configured again', async () => {
    authConfigured.mockReturnValue(true);
    upstreamPost.mockResolvedValue(Response.json({ message: 'User not found' }, { status: 404 }));

    const response = await call(REQUEST, { email: 'nobody@example.invalid' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(afterTasks).toHaveLength(1);
  });
});

describe('changing a password through the auth proxy (VEN-677)', () => {
  const CHANGE = 'change-password';
  const PASSWORDS = { currentPassword: 'the-old-password', newPassword: 'a-new-password' };

  beforeEach(() => {
    vi.stubEnv('WEB_TIER_KEY', '');
    resetThrottle();
    upstreamPost.mockReset();
    forgetSessionsFor.mockReset();
    mintedUserIdForCaller.mockResolvedValue('user-9');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('forwards revokeOtherSessions: true even when the client asked to keep them', async () => {
    upstreamPost.mockResolvedValue(Response.json({ token: 't', user: { id: 'user-9' } }));

    const response = await call(CHANGE, { ...PASSWORDS, revokeOtherSessions: false });

    expect(response.status).toBe(200);
    expect(upstreamPost).toHaveBeenCalledOnce();
    expect(await upstreamPost.mock.calls[0]?.[0].json()).toEqual({
      ...PASSWORDS,
      revokeOtherSessions: true,
    });
  });

  it('forgets every cached session of the account once the change lands', async () => {
    upstreamPost.mockResolvedValue(Response.json({ token: 't', user: { id: 'user-9' } }));

    await call(CHANGE, PASSWORDS);

    expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-9');
  });

  it('asks Neon Auth for the caller when nothing is cached for their cookie', async () => {
    mintedUserIdForCaller.mockResolvedValue(undefined);
    getSession.mockResolvedValue({ data: { user: { id: 'user-cold' } } });
    upstreamPost.mockResolvedValue(Response.json({ token: 't' }));

    await call(CHANGE, PASSWORDS);

    expect(forgetSessionsFor).toHaveBeenCalledExactlyOnceWith('user-cold');
  });

  it('refuses a caller with no session before the provider is called', async () => {
    mintedUserIdForCaller.mockResolvedValue(undefined);

    const response = await call(CHANGE, PASSWORDS);

    expect(response.status).toBe(401);
    expect(upstreamPost).not.toHaveBeenCalled();
  });

  it.each([
    ['no current password', { newPassword: 'a-new-password' }],
    ['a non-string new password', { currentPassword: 'x', newPassword: 12 }],
    ['a body that is not an object', 'nope'],
  ])('refuses %s without forwarding it', async (_name, body) => {
    const response = await call(CHANGE, body);

    expect(response.status).toBe(400);
    expect(upstreamPost).not.toHaveBeenCalled();
  });

  it('forgets nothing when the provider refuses the current password', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_PASSWORD' }, { status: 400 }));

    const response = await call(CHANGE, PASSWORDS);

    expect(response.status).toBe(400);
    expect(forgetSessionsFor).not.toHaveBeenCalled();
  });

  it('charges wrong current passwords to the account, whoever sends them, then throttles', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_PASSWORD' }, { status: 400 }));

    const statuses: number[] = [];
    for (let i = 0; i < 7; i++) {
      statuses.push((await call(CHANGE, PASSWORDS, `6.6.6.${i}`)).status);
    }

    expect(statuses).toEqual([400, 400, 400, 400, 400, 429, 429]);
    expect(upstreamPost).toHaveBeenCalledTimes(5);
  });

  it('keeps one account’s budget apart from another’s', async () => {
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_PASSWORD' }, { status: 400 }));
    for (let i = 0; i < 5; i++) {
      await call(CHANGE, PASSWORDS, `6.6.7.${i}`);
    }

    mintedUserIdForCaller.mockResolvedValue('user-other');

    expect((await call(CHANGE, PASSWORDS, '6.6.8.1')).status).toBe(400);
  });

  /*
   * Only a 400 is a wrong current password. A 401 is a session revoked
   * elsewhere that this instance still has cached, and charging it would let a
   * revoked session spend its owner's budget.
   */
  it.each([401, 403])('does not charge a provider %i to the account', async (status) => {
    upstreamPost.mockResolvedValue(Response.json({}, { status }));
    for (let i = 0; i < 6; i++) {
      await call(CHANGE, PASSWORDS, `7.7.7.${i}`);
    }
    upstreamPost.mockResolvedValue(Response.json({ code: 'INVALID_PASSWORD' }, { status: 400 }));

    expect((await call(CHANGE, PASSWORDS, '7.7.8.1')).status).toBe(400);
  });

  it('forwards the re-encoded body as JSON whatever type the client named', async () => {
    upstreamPost.mockResolvedValue(Response.json({ token: 't' }));

    await POST(
      new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { 'content-type': 'text/plain', 'x-forwarded-for': '3.3.3.3' },
        body: JSON.stringify(PASSWORDS),
      }) as never,
      { params: Promise.resolve({ path: [CHANGE] }) },
    );

    expect(upstreamPost.mock.calls[0]?.[0].headers.get('content-type')).toBe('application/json');
  });

  it('never charges a change that lands, or the provider being down', async () => {
    upstreamPost.mockResolvedValue(Response.json({}, { status: 503 }));
    for (let i = 0; i < 6; i++) {
      await call(CHANGE, PASSWORDS, `5.5.5.${i}`);
    }
    upstreamPost.mockResolvedValue(Response.json({ token: 't' }));

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await call(CHANGE, PASSWORDS, `5.5.6.${i}`)).status);
    }

    expect(statuses).toEqual(Array(6).fill(200));
  });
});
