import { registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { assertWebEnv, publicEnvKeys, requirePublicValue, siteOrigin } from './env';

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

  it('accepts a live-mode Clerk key, because this runs on Vercel too', () => {
    /*
     * `next build` sets `NODE_ENV=production` for every build, so this schema
     * cannot tell a release from `pnpm build` on a laptop and must accept the
     * value that is correct in production. Holding it to the `local` value set
     * would fail the Vercel build on a live key — and the cheapest way out of
     * that failure is to put a development credential into production.
     */
    const live = VALID.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY!.replace('_test_', '_live_');

    expect(() => assertWebEnv({ ...VALID, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: live })).not.toThrow();
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

/*
 * `WEB_URL` carries a localhost default so a laptop needs no configuration,
 * and that default reached production: every sitemap `<loc>`, the robots
 * `Host` line and every OG image URL pointed at localhost, which makes the
 * sitemap useless to a crawler and every shared link a blank card.
 */
/** Next augments `ProcessEnv` so `NODE_ENV` is required; these tests do not care. */
function env(values: Record<string, string>): NodeJS.ProcessEnv {
  return { NODE_ENV: 'production', ...values };
}

describe('siteOrigin', () => {
  it('uses an explicitly configured origin', () => {
    expect(siteOrigin(env({ WEB_URL: 'https://canonical.example' }))).toBe(
      'https://canonical.example',
    );
  });

  it('takes the first entry, because WEB_URL doubles as the CORS allow-list', () => {
    expect(
      siteOrigin(env({ WEB_URL: ' https://canonical.example/ , https://admin.example ' })),
    ).toBe('https://canonical.example');
  });

  it('falls back to localhost off a deployment', () => {
    expect(siteOrigin(env({}))).toBe('http://localhost:3000');
  });

  it("prefers Vercel's production domain when WEB_URL is unset", () => {
    expect(siteOrigin(env({ VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app' }))).toBe(
      'https://project.vercel.app',
    );
  });

  it('never serves a localhost canonical from a deployment', () => {
    expect(
      siteOrigin(
        env({
          WEB_URL: 'http://localhost:3000',
          VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
        }),
      ),
    ).toBe('https://project.vercel.app');
  });

  it('lets a real WEB_URL beat the Vercel domain, for a custom domain', () => {
    expect(
      siteOrigin(
        env({
          WEB_URL: 'https://bookings.example',
          VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
        }),
      ),
    ).toBe('https://bookings.example');
  });

  it('uses the per-deployment host only when the project domain is absent', () => {
    expect(siteOrigin(env({ VERCEL_URL: 'project-abc123.vercel.app' }))).toBe(
      'https://project-abc123.vercel.app',
    );
  });
});
