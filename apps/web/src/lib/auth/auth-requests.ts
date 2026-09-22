import { clearSessionToken } from './client';

/**
 * The browser's calls to the same-origin Neon Auth proxy (`/api/auth/*`, Better
 * Auth's endpoints). Results are a closed set of outcomes rather than the
 * upstream body: an upstream `message` is never rendered (see
 * `no-raw-upstream-message.test.ts`), so nothing here returns one.
 */
export type AuthOutcome = 'ok' | 'unverified' | 'rejected' | 'throttled' | 'unreachable';

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

/**
 * A 403 is usually Neon's `EMAIL_NOT_VERIFIED`, but Better Auth's own per-code
 * attempt limiter answers 403 too, body `{ code: 'TOO_MANY_ATTEMPTS' }` — a
 * second, address-independent throttle on top of the proxy's own 429 (seen
 * live: 5 wrong codes in a row can draw one before the proxy's budget is
 * spent). Peeking at the body is what tells the two apart; the clone leaves
 * the body unread for whoever reads `response` next (`signInWithEmail`'s own
 * `emailVerified` check).
 */
async function outcomeOf(response: Response | null): Promise<AuthOutcome> {
  if (!response || response.status >= 500) {
    return 'unreachable';
  }

  if (response.ok) {
    return 'ok';
  }

  if (response.status === 429) {
    return 'throttled';
  }

  if (response.status === 403) {
    const body = (await response
      .clone()
      .json()
      .catch(() => null)) as { code?: unknown } | null;

    return body?.code === 'TOO_MANY_ATTEMPTS' ? 'throttled' : 'unverified';
  }

  return 'rejected';
}

/**
 * Creates the account, then asks Neon for the six-digit code: on dev Neon Auth
 * a sign-up alone emails nothing, only `send-verification-otp` does. A failed
 * send does not fail the sign-up, because the code step offers "Send a new
 * code" and the account already exists.
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  name: string;
}): Promise<AuthOutcome> {
  const outcome = await outcomeOf(await post('/sign-up/email', input));
  if (outcome === 'ok') {
    await resendVerificationCode(input.email);
  }
  return outcome;
}

/**
 * `unverified` is Neon's 403 `EMAIL_NOT_VERIFIED` on most branches — the caller
 * routes to the code step. **This dev branch instead answers 200** for an
 * unverified sign-in, with `user.emailVerified: false` in the body and a
 * session the API refuses on every subsequent call: unchecked, that reads as
 * `'ok'` and silently strands the caller at `/after-sign-in`. Treat the body
 * the same as the 403, so both branches route the same address the same way.
 */
export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthOutcome> {
  const response = await post('/sign-in/email', input);
  const outcome = await outcomeOf(response);
  clearSessionToken();

  if (outcome !== 'ok' || !response) {
    return outcome;
  }

  const body: { user?: { emailVerified?: unknown } } = await response.json().catch(() => ({}));
  return body.user?.emailVerified === false ? 'unverified' : 'ok';
}

export async function verifyEmailCode(input: { email: string; otp: string }): Promise<AuthOutcome> {
  return outcomeOf(await post('/email-otp/verify-email', input));
}

export async function resendVerificationCode(email: string): Promise<AuthOutcome> {
  return outcomeOf(
    await post('/email-otp/send-verification-otp', { email, type: 'email-verification' }),
  );
}

/**
 * Asks Neon to email a reset code. The proxy answers every address the same, so
 * `ok` says nothing about whether an account exists; only `unreachable` and a
 * caller-level refusal (`throttled`, the per-caller 429) are ever different.
 */
export async function requestPasswordReset(email: string): Promise<AuthOutcome> {
  return outcomeOf(await post('/email-otp/request-password-reset', { email }));
}

/** `rejected` covers a wrong, used or expired code, and a password Neon refuses. */
export async function resetPasswordWithCode(input: {
  email: string;
  otp: string;
  password: string;
}): Promise<AuthOutcome> {
  return outcomeOf(await post('/email-otp/reset-password', input));
}

export async function signOut(): Promise<void> {
  await post('/sign-out', null);
  clearSessionToken();
}
