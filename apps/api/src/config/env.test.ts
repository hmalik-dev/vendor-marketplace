import { findVariable, registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { OVERRIDDEN_KEYS, allowedOrigins, parseEnv } from './env.js';

// Shaped like real values, because the schema now enforces each row's shape —
// `sk_test_key` is indistinguishable from a placeholder and is rejected.
const REQUIRED: NodeJS.ProcessEnv = {
  DATABASE_URL:
    'postgresql://vendor_marketplace:vendor_marketplace_dev@localhost:5432/vendor_marketplace',
  CLERK_SECRET_KEY: 'sk_test_51ABCdefGHIjklMNOpqr',
  CLERK_WEBHOOK_SECRET: 'whsec_MfKQ9r8sTuVwXyZ0123456789',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'vendor-marketplace',
  S3_SECRET_ACCESS_KEY: 'vendor_marketplace_dev',
  S3_BUCKET: 'vendor-marketplace-uploads',
  S3_PUBLIC_URL: 'http://localhost:9000/vendor-marketplace-uploads',
};

describe('parseEnv', () => {
  it('fills in the development defaults', () => {
    const env = parseEnv(REQUIRED);

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.WEB_URL).toBe('http://localhost:3000');
  });

  it('coerces numeric variables that arrive as strings', () => {
    const env = parseEnv({ ...REQUIRED, PORT: '8080', RATE_LIMIT_MAX: '30' });

    expect(env.PORT).toBe(8080);
    expect(env.RATE_LIMIT_MAX).toBe(30);
  });

  it('names every missing variable rather than failing on the first', () => {
    try {
      parseEnv({});
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('CLERK_SECRET_KEY');
      expect(message).toContain('CLERK_WEBHOOK_SECRET');
      expect(message).toContain('DATABASE_URL');
    }
  });

  it('rejects a port outside the valid range', () => {
    expect(() => parseEnv({ ...REQUIRED, PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects a Clerk key still left as its placeholder', () => {
    // Presence alone used to pass here, which is how `sk_test_...` reached a
    // running server and failed on the first authenticated request instead.
    expect(() => parseEnv({ ...REQUIRED, CLERK_SECRET_KEY: 'sk_test_...' })).toThrow(
      /CLERK_SECRET_KEY/,
    );
  });

  it('points at preflight when something is wrong', () => {
    expect(() => parseEnv({})).toThrow(/pnpm preflight/);
  });

  it('does not require a variable only the tooling reads', () => {
    expect(() => parseEnv(REQUIRED)).not.toThrow();
    expect(Object.keys(parseEnv(REQUIRED))).not.toContain('NEON_BRANCH');
  });

  it('does not require a capability the API has not wired up yet', () => {
    expect(Object.keys(parseEnv(REQUIRED))).not.toContain('STRIPE_SECRET_KEY');
  });
});

describe('registry derivation', () => {
  it('reads exactly the keys the registry assigns to the API', () => {
    const expected = registryKeys({
      consumer: 'api',
      capabilities: ['core', 'auth', 'storage'],
    });

    expect(Object.keys(parseEnv(REQUIRED)).sort()).toEqual([...expected].sort());
  });

  it('overrides only keys the registry actually declares', () => {
    // An override for a key the registry does not carry would be a fifth
    // hand-maintained copy of the variable list, which is what #17 removed.
    for (const key of OVERRIDDEN_KEYS) {
      expect(findVariable(key), key).toBeDefined();
    }
  });
});

describe('allowedOrigins', () => {
  it('splits a comma-separated list and trims each entry', () => {
    const env = parseEnv({
      ...REQUIRED,
      WEB_URL: 'http://localhost:3000, https://orla.app ',
    });

    expect(allowedOrigins(env)).toEqual(['http://localhost:3000', 'https://orla.app']);
  });

  it('drops empty segments from a trailing comma', () => {
    const env = parseEnv({ ...REQUIRED, WEB_URL: 'https://orla.app,' });

    expect(allowedOrigins(env)).toEqual(['https://orla.app']);
  });
});

describe('parseEnv storage configuration', () => {
  it('strips trailing slashes from the public object URL', () => {
    const env = parseEnv({
      ...REQUIRED,
      S3_PUBLIC_URL: 'http://localhost:9000/vendor-marketplace-uploads//',
    });

    expect(env.S3_PUBLIC_URL).toBe('http://localhost:9000/vendor-marketplace-uploads');
  });

  it('defaults to path-style bucket addressing', () => {
    expect(parseEnv(REQUIRED).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('reads path-style addressing off as a string', () => {
    expect(parseEnv({ ...REQUIRED, S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE).toBe(false);
  });
});
