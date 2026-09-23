import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  verifyEmailCode,
} from './auth-requests';

const INPUT = { email: 'new@example.com', password: 'a-long-password', name: 'new' };

function stubFetch(...statuses: number[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  for (const status of statuses) {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
  }
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubFetchBody(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('signUpWithEmail', () => {
  /*
   * The code request is the caller's (VEN-620): folded in here, a refused send
   * read as a successful sign-up and the code step waited on a mail never sent.
   */
  it('creates the account and asks for no code itself', async () => {
    const fetchMock = stubFetch(200);

    await expect(signUpWithEmail(INPUT)).resolves.toBe('ok');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/api/auth/sign-up/email']);
  });

  it('reports a refused sign-up', async () => {
    stubFetch(422);

    await expect(signUpWithEmail(INPUT)).resolves.toBe('rejected');
  });
});

describe('verifyEmailCode', () => {
  /*
   * The proxy's per-address budget on this path answers 429 (proxy-throttle.ts).
   * `outcomeOf` used to fold that into the same 'rejected' bucket as an
   * actually wrong code, so a throttled call must read as 'throttled' here,
   * distinct from a genuine refusal.
   */
  it('reports throttled for a 429, distinct from a rejected code', async () => {
    stubFetch(429);

    await expect(verifyEmailCode({ email: 'new@example.com', otp: '000000' })).resolves.toBe(
      'throttled',
    );
  });

  it('still reports rejected for an actual refusal', async () => {
    stubFetch(400);

    await expect(verifyEmailCode({ email: 'new@example.com', otp: '000000' })).resolves.toBe(
      'rejected',
    );
  });

  /*
   * Observed live: Better Auth's `emailOTP` plugin answers 403 with this body
   * once a single code has been guessed wrong `allowedAttempts` times (the
   * plugin's own default is 3 — Neon's managed service does not expose
   * raising it). Without the body check this fell into the same 403 bucket as
   * `EMAIL_NOT_VERIFIED` and read as 'unverified', which the code step's
   * `codeWrong` fallback then showed as an ordinary wrong code. It is
   * `'codeInvalid'`, not `'throttled'`: Better Auth's own docs say the code
   * is already dead and the fix is to request a new one, not to wait.
   */
  it('reports codeInvalid for a 403 carrying Better Auth’s own attempt-limit code', async () => {
    stubFetchBody(403, { code: 'TOO_MANY_ATTEMPTS' });

    await expect(verifyEmailCode({ email: 'new@example.com', otp: '000000' })).resolves.toBe(
      'codeInvalid',
    );
  });

  it('still reports unverified for an ordinary 403', async () => {
    stubFetchBody(403, { code: 'SOME_OTHER_REASON' });

    await expect(verifyEmailCode({ email: 'new@example.com', otp: '000000' })).resolves.toBe(
      'unverified',
    );
  });
});

describe('signInWithEmail', () => {
  /*
   * This dev Neon Auth branch answers 200 for an unverified sign-in instead of
   * the 403 `outcomeOf` otherwise relies on — reproduced live against the lane
   * (VEN-507): `user.emailVerified: false` in an `ok`-shaped body. Unchecked,
   * that reads as `'ok'` and the caller lands the person on `/after-sign-in`
   * with a session the API refuses on every following call — a silent dead
   * end, never the code step the docstring promises.
   */
  it('reports unverified for a 200 whose body says the email is not verified', async () => {
    stubFetchBody(200, { user: { emailVerified: false } });

    await expect(
      signInWithEmail({ email: 'new@example.com', password: 'a-long-password' }),
    ).resolves.toBe('unverified');
  });

  it('still reports ok for a verified sign-in', async () => {
    stubFetchBody(200, { user: { emailVerified: true } });

    await expect(
      signInWithEmail({ email: 'new@example.com', password: 'a-long-password' }),
    ).resolves.toBe('ok');
  });

  it('reports unverified for the 403 shape too', async () => {
    stubFetch(403);

    await expect(
      signInWithEmail({ email: 'new@example.com', password: 'a-long-password' }),
    ).resolves.toBe('unverified');
  });
});

describe('signOut', () => {
  it('resolves once the proxy confirms the session ended', async () => {
    stubFetch(200);

    await expect(signOut()).resolves.toBeUndefined();
  });

  // VEN-628: a caller has to be able to tell this apart from a real sign-out,
  // rather than being told it worked when the cookie is still live.
  it('rejects when the provider errors', async () => {
    stubFetch(500);

    await expect(signOut()).rejects.toThrow();
  });

  it('rejects when the proxy throttles the call', async () => {
    stubFetch(429);

    await expect(signOut()).rejects.toThrow();
  });

  it('rejects when the request never reaches the proxy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(signOut()).rejects.toThrow();
  });

  // A second tab signing out after the first has nothing left to end, and
  // Better Auth answers a 4xx for it — that is not a failure this browser
  // needs to hear about, since it has nothing to stay signed into either way.
  it('resolves for an ordinary 4xx, since there is no live session left either way', async () => {
    stubFetch(400);

    await expect(signOut()).resolves.toBeUndefined();
  });
});

describe('an auth proxy with no auth configuration (VEN-635)', () => {
  it('reads a sign-in answered 503 AUTH_UNAVAILABLE as unreachable', async () => {
    stubFetchBody(503, { code: 'AUTH_UNAVAILABLE' });

    await expect(
      signInWithEmail({ email: 'new@example.com', password: 'a-long-password' }),
    ).resolves.toBe('unreachable');
  });

  it('reads a reset request answered 503 AUTH_UNAVAILABLE as unreachable, not sent', async () => {
    stubFetchBody(503, { code: 'AUTH_UNAVAILABLE' });

    await expect(requestPasswordReset('nobody@example.invalid')).resolves.toBe('unreachable');
  });
});
