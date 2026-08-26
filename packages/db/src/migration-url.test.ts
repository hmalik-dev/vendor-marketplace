import { describe, expect, it } from 'vitest';
import { resolveMigrationUrl } from './migration-url.js';

const POOLED = 'postgresql://user:pw@pooler.example.com/db';
const DIRECT = 'postgresql://user:pw@direct.example.com/db';

describe('resolveMigrationUrl', () => {
  it('prefers the direct connection when both are set', () => {
    expect(resolveMigrationUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: DIRECT })).toBe(
      DIRECT,
    );
  });

  it('falls back to the pooled connection when only it is set', () => {
    expect(resolveMigrationUrl({ DATABASE_URL: POOLED })).toBe(POOLED);
  });

  it('uses the direct connection when only it is set', () => {
    expect(resolveMigrationUrl({ DATABASE_URL_UNPOOLED: DIRECT })).toBe(DIRECT);
  });

  it('treats a blank direct connection as absent rather than as an empty URL', () => {
    expect(resolveMigrationUrl({ DATABASE_URL: POOLED, DATABASE_URL_UNPOOLED: '  ' })).toBe(POOLED);
  });

  it('fails with a message naming both variables when neither is set', () => {
    expect(() => resolveMigrationUrl({})).toThrowError(/DATABASE_URL_UNPOOLED.*DATABASE_URL/s);
  });
});
