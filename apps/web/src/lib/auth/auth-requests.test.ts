import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  requestPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  verifyEmailCode,
} from './auth-requests';

const INPUT = {
  email: 'new@example.com',
  password: 'a-long-password',
  name: 'new',
  role: 'vendor',
} as const;

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
    const fetchMock = stubFetchBody(200, { token: 'session-token', user: { id: 'u1' } });

    await expect(signUpWithEmail(INPUT)).resolves.toEqual({ outcome: 'ok', codeSent: false });

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(['/api/auth/sign-up/email']);
  });

  /*
   * Production requires verification, so Neon answers `token: null` and has
   * already mailed a code; asking again rotated it and the first mail's code
   * was refused when typed.
   */
  it('reports the code as sent when Neon opened no session', async () => {
    stubFetchBody(200, { token: null, user: { id: 'u1' } });

    await expect(signUpWithEmail(INPUT)).resolves.toEqual({ outcome: 'ok', codeSent: true });
  });

  it('does not assume a code was sent when the answer names no token', async () => {
    stubFetch(200);

    await expect(signUpWithEmail(INPUT)).resolves.toEqual({ outcome: 'ok', codeSent: false });
  });

  it('sends the chosen role with the sign-up, for the proxy to record (VEN-662)', async () => {
    const fetchMock = stubFetch(200);

    await signUpWithEmail(INPUT);

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(INPUT);
  });

  it('reads a sign-up whose role could not be recorded as unreachable', async () => {
    stubFetch(503);

    await expect(signUpWithEmail(INPUT)).resolves.toEqual({
      outcome: 'unreachable',
      codeSent: false,
    });
  });

  it('reports a refused sign-up', async () => {
    stubFetch(422);

    await expect(signUpWithEmail(INPUT)).resolves.toEqual({ outcome: 'rejected', codeSent: false });
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

describe('changePassword (VEN-677)', () => {
  const CHANGE = { currentPassword: 'the-old-password', newPassword: 'a-new-password' };

  it('asks the proxy to change it, and sends only the two passwords', async () => {
    const fetchMock = stubFetch(200);

    await expect(changePassword(CHANGE)).resolves.toBe('ok');

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/auth/change-password');
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual(CHANGE);
  });

  /*
   * Better Auth answers a wrong current password 400 `INVALID_PASSWORD`; a 403
   * must not read as `unverified`, which would send a signed-in person to a
   * code step.
   */
  it.each([400, 403])('reads a %i as a refused current password', async (status) => {
    stubFetchBody(status, { code: 'INVALID_PASSWORD' });

    await expect(changePassword(CHANGE)).resolves.toBe('rejected');
  });

  // The session ended elsewhere (a sign-out in another tab): not a wrong password.
  it('reads a 401 as signed out', async () => {
    stubFetch(401);

    await expect(changePassword(CHANGE)).resolves.toBe('signedOut');
  });

  it('reads the per-account budget running out as throttled, not as a wrong password', async () => {
    stubFetch(429);

    await expect(changePassword(CHANGE)).resolves.toBe('throttled');
  });

  it.each([500, 503])('reads a %i as unreachable', async (status) => {
    stubFetch(status);

    await expect(changePassword(CHANGE)).resolves.toBe('unreachable');
  });

  it('reads a request that never reaches the proxy as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(changePassword(CHANGE)).resolves.toBe('unreachable');
  });
});
