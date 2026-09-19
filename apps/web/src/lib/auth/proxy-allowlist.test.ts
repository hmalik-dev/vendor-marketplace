import { describe, expect, it } from 'vitest';
import { isProxiedAuthCall } from './proxy-allowlist';

describe('isProxiedAuthCall', () => {
  it.each([
    ['POST', ['sign-up', 'email']],
    ['POST', ['sign-in', 'email']],
    ['POST', ['sign-out']],
    ['POST', ['email-otp', 'verify-email']],
    ['POST', ['email-otp', 'send-verification-otp']],
    ['GET', ['get-session']],
    ['GET', ['token']],
  ])('forwards %s %j', (method, path) => {
    expect(isProxiedAuthCall(method, path)).toBe(true);
  });

  it.each([
    ['POST', ['delete-user']],
    ['POST', ['change-email']],
    ['POST', ['change-password']],
    ['POST', ['update-user']],
    ['GET', ['list-sessions']],
    ['POST', ['admin', 'set-role']],
    ['GET', ['sign-in', 'email']],
    ['POST', ['token']],
    ['POST', ['sign-in', 'email', 'extra']],
    ['POST', []],
  ])('refuses %s %j', (method, path) => {
    expect(isProxiedAuthCall(method, path)).toBe(false);
  });
});
