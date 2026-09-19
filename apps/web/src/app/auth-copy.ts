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
  signUpFailed:
    'We could not create that account. Check the details, or sign in if you already have one.',
  signInFailed: 'That email and password did not match.',
  unreachable: 'We could not reach the sign-in service. Try again in a moment.',
} as const;
