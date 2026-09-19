import { clearSessionToken } from './client';

/**
 * The browser's calls to the same-origin Neon Auth proxy (`/api/auth/*`, Better
 * Auth's endpoints). Results are a closed set of outcomes rather than the
 * upstream body: an upstream `message` is never rendered (see
 * `no-raw-upstream-message.test.ts`), so nothing here returns one.
 */
export type AuthOutcome = 'ok' | 'unverified' | 'rejected' | 'unreachable';

async function post(path: string, body: Record<string, string> | null): Promise<Response | null> {
  try {
    return await fetch(`/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    return null;
  }
}

function outcomeOf(response: Response | null): AuthOutcome {
  if (!response || response.status >= 500) {
    return 'unreachable';
  }

  if (response.ok) {
    return 'ok';
  }

  return response.status === 403 ? 'unverified' : 'rejected';
}

/** Creates the account and has Neon email a six-digit code. */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthOutcome> {
  return outcomeOf(await post('/sign-up/email', input));
}

/** `unverified` is Neon's 403 EMAIL_NOT_VERIFIED: the caller routes to the code step. */
export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthOutcome> {
  const outcome = outcomeOf(await post('/sign-in/email', input));
  clearSessionToken();
  return outcome;
}

export async function verifyEmailCode(input: { email: string; otp: string }): Promise<AuthOutcome> {
  return outcomeOf(await post('/email-otp/verify-email', input));
}

export async function resendVerificationCode(email: string): Promise<AuthOutcome> {
  return outcomeOf(
    await post('/email-otp/send-verification-otp', { email, type: 'email-verification' }),
  );
}

export async function signOut(): Promise<void> {
  await post('/sign-out', null);
  clearSessionToken();
}
