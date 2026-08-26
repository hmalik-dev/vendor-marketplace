import { registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { assertWebEnv, publicEnvKeys, requirePublicValue } from './env';

const VALID: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_c3RpcnJpbmctZ2F6ZWxsZS0x',
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/after-sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/after-sign-in',
};

/** `VALID` with the one defaulted key removed. */
function withoutApiUrl(): NodeJS.ProcessEnv {
  const source = { ...VALID };
  delete source.NEXT_PUBLIC_API_URL;
  return source;
}

describe('assertWebEnv', () => {
  it('accepts a complete configuration', () => {
    expect(assertWebEnv(VALID).NEXT_PUBLIC_API_URL).toBe('http://localhost:4000');
  });

  it('rejects a Clerk key left as its placeholder', () => {
    expect(() =>
      assertWebEnv({ ...VALID, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_...' }),
    ).toThrow(/NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
  });

  it('names every problem at once and points at preflight', () => {
    try {
      assertWebEnv({
        ...VALID,
        NEXT_PUBLIC_API_URL: 'not-a-url',
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_...',
      });
      expect.unreachable('assertWebEnv should have thrown');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toContain('NEXT_PUBLIC_API_URL');
      expect(message).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
      expect(message).toContain('pnpm preflight');
    }
  });

  it('falls back to the localhost default outside production', () => {
    expect(assertWebEnv(withoutApiUrl()).NEXT_PUBLIC_API_URL).toBe('http://localhost:4000');
  });

  it('does not treat a local `next build` as a production deployment', () => {
    // next build sets NODE_ENV=production for every build, so the localhost
    // defaults must still apply; `preflight --env production` is the release gate.
    expect(assertWebEnv({ ...withoutApiUrl(), NODE_ENV: 'production' }).NEXT_PUBLIC_API_URL).toBe(
      'http://localhost:4000',
    );
  });

  it('does not require a capability the web app has not wired up yet', () => {
    expect(() => assertWebEnv(VALID)).not.toThrow();
    expect(Object.keys(assertWebEnv(VALID))).not.toContain('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  });
});

describe('publicEnv', () => {
  it('covers every browser-facing key the registry declares for the web', () => {
    // The literal `process.env.X` map cannot be generated, so this is the drift
    // gate that keeps it in step with the registry.
    const declared = registryKeys({ consumer: 'web', capabilities: ['core', 'auth'] }).filter(
      (key) => key.startsWith('NEXT_PUBLIC_'),
    );

    expect(publicEnvKeys().sort()).toEqual([...declared].sort());
  });

  it('returns a value that is present', () => {
    expect(requirePublicValue('NEXT_PUBLIC_API_URL', 'http://localhost:4000')).toBe(
      'http://localhost:4000',
    );
  });

  it('throws a traceable error instead of rendering "undefined"', () => {
    expect(() => requirePublicValue('NEXT_PUBLIC_API_URL', undefined)).toThrow(
      /NEXT_PUBLIC_API_URL is not set[\s\S]*pnpm preflight/,
    );
  });
});
