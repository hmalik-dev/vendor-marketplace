import type { SignUpRole } from '@vendor-marketplace/shared';
import { reportSwallowedError } from '@/lib/report-error';
import { clearSessionToken } from './client';

/**
 * The browser's calls to the same-origin Neon Auth proxy (`/api/auth/*`, Better
 * Auth's endpoints). Results are a closed set of outcomes rather than the
 * upstream body: an upstream `message` is never rendered (see
 * `no-raw-upstream-message.test.ts`), so nothing here returns one.
 */
export type AuthOutcome =
  'ok' | 'unverified' | 'rejected' | 'throttled' | 'codeInvalid' | 'unreachable';

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
 * A 403 is usually Neon's `EMAIL_NOT_VERIFIED`, but Better Auth's own
 * `emailOTP` plugin answers 403 too, body `{ code: 'TOO_MANY_ATTEMPTS' }`,
 * once a single code has been guessed wrong `allowedAttempts` times (Better
 * Auth's own default: 3 — Neon's managed service does not expose raising it).
 * That is a *different* failure from either proxy throttle above: this one
 * has already invalidated the code and needs no wait at all — Better Auth's
 * own docs say the fix is simply to request a new one, which is why this is
 * `'codeInvalid'` rather than `'throttled'`; the two throttles above mean
 * "the same code may still work, try again after a wait", which is false
 * here. Peeking at the body is what tells the three apart; the clone leaves
 * the body unread for whoever reads `response` next (`signInWithEmail`'s own
 * `emailVerified` check).
 *
 * Only `verifyEmailCode` can actually surface `'codeInvalid'`:
 * `resetPasswordWithCode` goes through the proxy's `forwardReset`, which
 * flattens every 4xx on that path to a plain 400 before this ever sees it
 * (`route.ts`), so the same Better Auth refusal reaches `resetPasswordWithCode`
 * as `'rejected'` instead — already covered correctly by `resetFailed`'s own
 * "...or it has expired... ask for a new one" copy, no special case needed.
 *
 * Unverified: Better Auth's plugin source deletes the verification row before
 * throwing `TOO_MANY_ATTEMPTS`, so resubmitting the same dead code afterward
 * may draw a plain `INVALID_OTP` 400 (→ `'rejected'`, the ordinary wrong-code
 * copy) rather than this outcome again. That is not a regression — it is what
 * every call already showed before this fix — but it means the corrected copy
 * is not guaranteed to survive a second wrong submission of the same code.
 */
async function outcomeOf(response: Response | null): Promise<AuthOutcome> {
  // A 5xx includes the proxy's own 503 `AUTH_UNAVAILABLE` for a missing auth
  // configuration (VEN-635), which the forms explain with the same copy.
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
    // A malformed body here is the proxy or Better Auth itself misbehaving —
    // exactly what #368 exists to catch, since the fallback below reads as
    // an ordinary "email not verified" rather than an infra problem.
    const body = (await response
      .clone()
      .json()
      .catch((error: unknown) => {
        reportSwallowedError('auth-requests: could not read a 403 body', error);
        return null;
      })) as { code?: unknown } | null;

    return body?.code === 'TOO_MANY_ATTEMPTS' ? 'codeInvalid' : 'unverified';
  }

  return 'rejected';
}

export interface SignUpResult {
  outcome: AuthOutcome;
  /**
   * Whether Neon already mailed the code as part of the sign-up. Better Auth
   * sends one on sign-up exactly when the branch requires verification
   * (`sendOnSignUp` defaults to `requireEmailVerification`), and that same
   * setting is what makes it answer `token: null` instead of opening a session.
   * Production requires it; dev and staging do not, and mail nothing.
   *
   * A second request would rotate the code: Better Auth keeps one per address,
   * so the first mail's code stops working while it is usually the one read
   * first — a correctly typed code refused (VEN-620's real cause).
   */
  codeSent: boolean;
}

/**
 * Creates the account. The role travels with it: the proxy takes it out of
 * what reaches Neon and records it at the API against the new account
 * (VEN-662), and answers a sign-up whose role it could not record as failed
 * (a 5xx, so `unreachable`). When Neon did not mail a code itself the caller
 * asks for one (`resendVerificationCode`) and shows that send's outcome, since
 * Neon's own limiter can refuse it (VEN-620).
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  name: string;
  role: SignUpRole;
}): Promise<SignUpResult> {
  const response = await post('/sign-up/email', input);
  const outcome = await outcomeOf(response);

  if (outcome !== 'ok' || !response) {
    return { outcome, codeSent: false };
  }

  const body: { token?: unknown } = await response.json().catch(() => ({}));
  return { outcome, codeSent: body.token === null };
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

/**
 * Ends the session through the proxy. Rejects only when the outcome is
 * genuinely unknown — a network failure, the proxy's own throttle, or the
 * provider erroring — so a caller can tell a real failure from one that only
 * looked like it (VEN-628): `post` swallows a network error into `null`,
 * which this checks for alongside the response.
 *
 * An ordinary 4xx (other than 429) is **not** a failure here: Better Auth
 * answers one when the caller has no live session to end — the double
 * sign-out from a second tab, or a stale button clicked twice — and by then
 * there is nothing this browser is still signed into either way. Resolving
 * lets the caller proceed exactly as it would for a real sign-out; treating
 * it as a failure would strand that caller on the page, unable to leave no
 * matter how many times they click the same control.
 */
export async function signOut(): Promise<void> {
  const response = await post('/sign-out', null);

  if (response === null || response.status === 429 || response.status >= 500) {
    throw new Error('Could not sign out');
  }

  clearSessionToken();
}
