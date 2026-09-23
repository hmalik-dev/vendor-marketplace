import type { AuthOutcome } from '@/lib/auth/auth-requests';

/**
 * The strings the sign-in and sign-up forms write, from frame `12 Sign up` and
 * `21-sign-up.md`. App-owned: no provider supplies or overrides any of them, and
 * none is ever taken from an upstream response.
 */
export const AUTH_COPY = {
  emailLabel: 'Email',
  passwordLabel: 'Password',
  passwordHelper: 'At least 10 characters',
  signUpSubmit: 'Create my account',
  signInSubmit: 'Sign in',
  signUpAlt: 'Already with us?',
  signInAlt: 'New here?',
  roleHint: 'Pick one above to continue',
  codeLabel: 'Verification code',
  codeHelper: 'We emailed you a six-digit code.',
  codeSubmit: 'Verify email',
  codeResend: 'Send a new code',
  codeResent: 'A new code is on its way.',
  codeWrong: 'That code did not work. Check it and try again.',
  codeExhausted: 'That code can no longer be used. Send a new one below.',
  signUpFailed:
    'We could not create that account. Check the details, or sign in if you already have one.',
  signInFailed: 'That email and password did not match.',
  forgotLink: 'Forgot password?',
  forgotSubmit: 'Email me a code',
  forgotBack: 'Back to sign in',
  resetCodeSent: 'If that address has an account, we have emailed it a six-digit code.',
  resetPasswordLabel: 'New password',
  resetSubmit: 'Set new password',
  resetDone: 'Your password is changed. Sign in with the new one.',
  resetFailed: 'That code did not work, or it has expired. Check it, or ask for a new one.',
  currentPasswordLabel: 'Current password',
  confirmPasswordLabel: 'Confirm new password',
  changeSubmit: 'Change password',
  changeWrongCurrent: 'That is not your current password. Check it and try again.',
  changeSameAsCurrent: 'Choose a new password that is different from your current one.',
  changeTooShort: 'Your new password needs at least 10 characters.',
  changeTooLong: 'Your new password can be at most 128 characters.',
  changeMismatch: 'The two new passwords do not match.',
  changeDone:
    'Your password is changed. You are still signed in here, and signed out everywhere else.',
  throttled: "This isn't going through right now. Wait a few minutes and try again.",
  unreachable: 'We could not reach the sign-in service. Try again in a moment.',
} as const;

/**
 * `unreachable` and `throttled` always read the same way; `fallback` is the
 * caller's copy for whatever specific outcome is left (a wrong code, a
 * refused password, ...).
 */
export function failureCopy(outcome: Exclude<AuthOutcome, 'ok'>, fallback: string): string {
  if (outcome === 'unreachable') {
    return AUTH_COPY.unreachable;
  }

  if (outcome === 'throttled') {
    return AUTH_COPY.throttled;
  }

  return fallback;
}
