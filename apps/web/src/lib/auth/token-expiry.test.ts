import { describe, expect, it } from 'vitest';
import { readSignUpRole, SIGN_UP_ROLE_KEY } from './signup-role';
import { tokenEmail, tokenExpiryMs } from './token-expiry';

function jwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${body}.signature`;
}

describe('tokenEmail', () => {
  it('reads the email claim', () => {
    expect(tokenEmail(jwt({ sub: 'u1', email: 'ada@example.com' }))).toBe('ada@example.com');
  });

  it('is null for a missing, empty or non-string claim, and for a malformed token', () => {
    expect(tokenEmail(jwt({ sub: 'u1' }))).toBeNull();
    expect(tokenEmail(jwt({ email: '' }))).toBeNull();
    expect(tokenEmail(jwt({ email: 42 }))).toBeNull();
    expect(tokenEmail('not-a-jwt')).toBeNull();
    expect(tokenEmail('header.%%%.signature')).toBeNull();
  });
});

describe('readSignUpRole', () => {
  it('matches a stored address that differs only in case and surrounding space', () => {
    window.localStorage.setItem(
      SIGN_UP_ROLE_KEY,
      JSON.stringify({ role: 'vendor', email: '  Ada@Example.COM ', at: Date.now() }),
    );

    expect(readSignUpRole('ada@example.com')).toBe('vendor');
    expect(readSignUpRole('grace@example.com')).toBeNull();
  });
});

describe('tokenExpiryMs', () => {
  it('reads exp as epoch milliseconds, and null without a numeric one', () => {
    expect(tokenExpiryMs(jwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
    expect(tokenExpiryMs(jwt({ exp: '1700000000' }))).toBeNull();
    expect(tokenExpiryMs('not-a-jwt')).toBeNull();
  });
});
