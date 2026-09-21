import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const upstreamPost = vi.fn<(request: Request) => Promise<Response>>();
const afterTasks: Array<() => Promise<void>> = [];

vi.mock('@/lib/auth/server', () => ({
  neonAuth: () => ({
    handler: () => ({ POST: upstreamPost, GET: vi.fn() }),
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

const REQUEST = 'email-otp/request-password-reset';
const RESET = 'email-otp/reset-password';

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
