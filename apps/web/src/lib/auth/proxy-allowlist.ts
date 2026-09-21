/**
 * The Better Auth calls the app's own screens make through `/api/auth/*`.
 *
 * Deliberately a short list: everything else the provider serves — change
 * email, change password (the signed-in call; the signed-out reset is the two
 * `email-otp` entries), delete user, session listing, organisation calls —
 * is an account operation the product does through its own API or not at all.
 * `token` is here for the session-token route's client cousin and `get-session`
 * for the SDK's own reads.
 */
type AllowedMethod = 'GET' | 'POST';

const ALLOWED: ReadonlyMap<string, AllowedMethod> = new Map([
  ['sign-up/email', 'POST'],
  ['sign-in/email', 'POST'],
  ['sign-out', 'POST'],
  ['email-otp/verify-email', 'POST'],
  ['email-otp/send-verification-otp', 'POST'],
  ['email-otp/request-password-reset', 'POST'],
  ['email-otp/reset-password', 'POST'],
  ['get-session', 'GET'],
  ['token', 'GET'],
]);

export function isProxiedAuthCall(method: string, path: readonly string[]): boolean {
  return ALLOWED.get(path.join('/')) === method;
}
