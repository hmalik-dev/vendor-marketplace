import { afterEach, describe, expect, it, vi } from 'vitest';
import { signInWithEmail, signUpWithEmail } from './auth-requests';

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
  it('requests the verification code after the account is created', async () => {
    const fetchMock = stubFetch(200, 200);

    await expect(signUpWithEmail(INPUT)).resolves.toBe('ok');

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/auth/sign-up/email',
      '/api/auth/email-otp/send-verification-otp',
    ]);
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body as string)).toEqual({
      email: 'new@example.com',
      type: 'email-verification',
    });
  });

  it('still reports ok when only the code send fails', async () => {
    stubFetch(200, 500);

    await expect(signUpWithEmail(INPUT)).resolves.toBe('ok');
  });

  it('requests no code when the sign-up is refused', async () => {
    const fetchMock = stubFetch(422);

    await expect(signUpWithEmail(INPUT)).resolves.toBe('rejected');
    expect(fetchMock).toHaveBeenCalledTimes(1);
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
