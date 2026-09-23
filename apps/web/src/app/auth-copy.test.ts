import { describe, expect, it } from 'vitest';
import { AUTH_COPY } from './auth-copy';

/**
 * VEN-627: Neon Auth's own OTP rate limit is one budget shared by every
 * visitor, so a `throttled` outcome is often another visitor exhausting it,
 * not this one making too many attempts. Neon does not expose a way to raise
 * or re-key that limit (recorded in vendor-marketplace-decisions.md), so the
 * copy must stay accurate without knowing which caused it.
 */
describe('AUTH_COPY.throttled', () => {
  it('does not claim the visitor made too many attempts', () => {
    expect(AUTH_COPY.throttled.toLowerCase()).not.toContain('too many attempts');
  });

  it('still tells the visitor to wait and retry', () => {
    expect(AUTH_COPY.throttled.toLowerCase()).toContain('wait');
    expect(AUTH_COPY.throttled.toLowerCase()).toContain('try again');
  });
});
