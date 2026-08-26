import { describe, expect, it } from 'vitest';
import { extractBearerToken } from './clerk-auth.js';

describe('extractBearerToken', () => {
  it('reads the token out of a well-formed header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('trims surrounding whitespace', () => {
    expect(extractBearerToken('Bearer  abc.def.ghi  ')).toBe('abc.def.ghi');
  });

  it('returns null when the header is absent', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for a non-bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('is case-sensitive about the scheme, matching Clerk clients', () => {
    expect(extractBearerToken('bearer abc')).toBeNull();
  });

  it('returns null when the scheme carries no token', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
    expect(extractBearerToken('Bearer    ')).toBeNull();
  });
});
