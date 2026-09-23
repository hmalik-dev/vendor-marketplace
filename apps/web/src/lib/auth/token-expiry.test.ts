import { describe, expect, it } from 'vitest';
import { tokenExpiryMs } from './token-expiry';

function jwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${body}.signature`;
}

describe('tokenExpiryMs', () => {
  it('reads exp as epoch milliseconds, and null without a numeric one', () => {
    expect(tokenExpiryMs(jwt({ exp: 1_700_000_000 }))).toBe(1_700_000_000_000);
    expect(tokenExpiryMs(jwt({ exp: '1700000000' }))).toBeNull();
    expect(tokenExpiryMs('not-a-jwt')).toBeNull();
  });
});
