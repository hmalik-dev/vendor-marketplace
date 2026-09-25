import { PASSWORD_MIN_LENGTH } from '@vendor-marketplace/shared';
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

/** VEN-733: short, one fact per sentence, US English; numbers read from their constants. */
describe('AUTH_COPY wording', () => {
  it('reads the password floor from PASSWORD_MIN_LENGTH', () => {
    expect(AUTH_COPY.passwordHelper).toBe(`At least ${PASSWORD_MIN_LENGTH} characters`);
    expect(AUTH_COPY.changeTooShort).toBe(
      `Your new password needs at least ${PASSWORD_MIN_LENGTH} characters.`,
    );
  });

  it('pins the rewritten lines', () => {
    expect(AUTH_COPY.codeExhausted).toBe('That code no longer works. Send a new one below.');
    expect(AUTH_COPY.resetCodeSent).toBe(
      'If that email has an account, we sent it a six-digit code.',
    );
    expect(AUTH_COPY.resetFailed).toBe(
      'That code did not work or has expired. Check it or send a new one.',
    );
    expect(AUTH_COPY.changeSameAsCurrent).toBe(
      'Your new password must differ from your current one.',
    );
    expect(AUTH_COPY.changeDone).toBe(
      'Your password is changed. Every other device is signed out.',
    );
    expect(AUTH_COPY.resetMailPaced).toBe(
      'Too many codes were requested for this email. Wait a minute and try again.',
    );
  });

  it('carries no justifying tail', () => {
    const tails = Object.values(AUTH_COPY).filter((line) =>
      /\b(so that|which means|rather than|because)\b/i.test(line),
    );

    expect(tails).toEqual([]);
  });
});
