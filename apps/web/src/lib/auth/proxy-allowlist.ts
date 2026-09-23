/**
 * The Better Auth calls the app's own screens make through `/api/auth/*`.
 *
 * Deliberately a short list: everything else the provider serves — change
 * email, delete user, session listing, organisation calls — is an account
 * operation the product does through its own API or not at all.
 * `change-password` is the one signed-in account call (VEN-677): the proxy
 * forwards it only as `forwardChangePassword` shapes it, budgeted per account
 * and always ending the account's other sessions.
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
  ['change-password', 'POST'],
  ['get-session', 'GET'],
  ['token', 'GET'],
]);

export function isProxiedAuthCall(method: string, path: readonly string[]): boolean {
  return ALLOWED.get(path.join('/')) === method;
}
