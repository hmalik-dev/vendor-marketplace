import { afterEach, describe, expect, it, vi } from 'vitest';
import { signUpWithEmail } from './auth-requests';

const INPUT = { email: 'new@example.com', password: 'a-long-password', name: 'new' };

function stubFetch(...statuses: number[]): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn();
  for (const status of statuses) {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status }));
  }
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
