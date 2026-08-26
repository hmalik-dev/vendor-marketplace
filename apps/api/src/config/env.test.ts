import { describe, expect, it } from 'vitest';
import { allowedOrigins, parseEnv } from './env.js';

const REQUIRED: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgres://localhost:5432/vendorhub',
  CLERK_SECRET_KEY: 'sk_test_key',
  CLERK_WEBHOOK_SECRET: 'whsec_key',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'vendorhub',
  S3_SECRET_ACCESS_KEY: 'vendorhub_dev',
  S3_BUCKET: 'vendorhub',
  S3_PUBLIC_URL: 'http://localhost:9000/vendorhub',
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
      expect(message).toContain('S3_BUCKET');
    }
  });

  it('rejects a port outside the valid range', () => {
    expect(() => parseEnv({ ...REQUIRED, PORT: '70000' })).toThrow(/PORT/);
  });
});

describe('allowedOrigins', () => {
  it('splits a comma-separated list and trims each entry', () => {
    const env = parseEnv({
      ...REQUIRED,
      WEB_URL: 'http://localhost:3000, https://vendorhub.app ',
    });

    expect(allowedOrigins(env)).toEqual(['http://localhost:3000', 'https://vendorhub.app']);
  });

  it('drops empty segments from a trailing comma', () => {
    const env = parseEnv({ ...REQUIRED, WEB_URL: 'https://vendorhub.app,' });

    expect(allowedOrigins(env)).toEqual(['https://vendorhub.app']);
  });
});

describe('parseEnv storage configuration', () => {
  it('strips trailing slashes from the public object URL', () => {
    const env = parseEnv({ ...REQUIRED, S3_PUBLIC_URL: 'http://localhost:9000/vendorhub//' });

    expect(env.S3_PUBLIC_URL).toBe('http://localhost:9000/vendorhub');
  });

  it('defaults to path-style bucket addressing', () => {
    expect(parseEnv(REQUIRED).S3_FORCE_PATH_STYLE).toBe(true);
  });

  it('reads path-style addressing off as a string', () => {
    expect(parseEnv({ ...REQUIRED, S3_FORCE_PATH_STYLE: 'false' }).S3_FORCE_PATH_STYLE).toBe(false);
  });
});
