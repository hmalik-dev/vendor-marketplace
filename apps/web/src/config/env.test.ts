import { findVariable, registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { assertWebEnv, servesOverTls, siteOrigin } from './env';
import {
  LOCAL_API_ORIGIN,
  LOCAL_WEB_ORIGIN,
  publicEnvKeys,
  requirePublicValue,
} from './public-env';

/** Shaped like the real rows, built here so no fixture reads as a credential. */
const NEON_AUTH_ENV: Record<string, string> = Object.fromEntries([
  ['NEON_AUTH_BASE_URL', `https://${'ep-test'}.neonauth.example.neon.tech/neondb/auth`],
  ['NEON_AUTH_COOKIE_SECRET', 'k'.repeat(44)],
]);

const VALID: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  ...NEON_AUTH_ENV,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_test_51QabcdefghijklmnopQR',
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

  it('rejects a Neon Auth base URL left as its placeholder', () => {
    expect(() => assertWebEnv({ ...VALID, NEON_AUTH_BASE_URL: '<neon-auth-base-url>' })).toThrow(
      /NEON_AUTH_BASE_URL/,
    );
  });

  it('rejects a cookie signing key too short to sign anything', () => {
    expect(() => assertWebEnv({ ...VALID, NEON_AUTH_COOKIE_SECRET: 'short' })).toThrow(
      /NEON_AUTH_COOKIE_SECRET/,
    );
  });

  it('names every problem at once and points at preflight', () => {
    try {
      assertWebEnv({
        ...VALID,
        NEXT_PUBLIC_API_URL: 'not-a-url',
        NEON_AUTH_BASE_URL: '<neon-auth-base-url>',
      });
      expect.unreachable('assertWebEnv should have thrown');
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toContain('NEXT_PUBLIC_API_URL');
      expect(message).toContain('NEON_AUTH_BASE_URL');
      expect(message).toContain('pnpm preflight');
    }
  });

  it('falls back to the localhost default outside production', () => {
    expect(assertWebEnv(withoutApiUrl()).NEXT_PUBLIC_API_URL).toBe('http://localhost:4000');
  });

  it('does not treat a local `next build` as a production deployment', () => {
    // next build sets NODE_ENV=production for every build, so the localhost
    // defaults must still apply; only a platform marker says otherwise.
    expect(assertWebEnv({ ...withoutApiUrl(), NODE_ENV: 'production' }).NEXT_PUBLIC_API_URL).toBe(
      'http://localhost:4000',
    );
  });

  it('refuses to bake a localhost API origin into a deployed bundle', () => {
    /*
     * The defect this closes: a Vercel build with `NEXT_PUBLIC_API_URL` unset
     * inlined `http://localhost:4000`, so every browser call went to the
     * visitor's own machine and every server-side loader to its own container.
     */
    expect(() => assertWebEnv({ ...withoutApiUrl(), VERCEL: '1' })).toThrow(
      /NEXT_PUBLIC_API_URL is required on a deployment/,
    );
  });

  it('refuses every per-environment development default on a deployment', () => {
    const bare: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      VERCEL: '1',
      ...NEON_AUTH_ENV,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: VALID.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    };

    let message = '';
    try {
      assertWebEnv(bare);
      expect.unreachable('assertWebEnv should have thrown');
    } catch (error) {
      message = (error as Error).message;
    }

    for (const key of ['NEXT_PUBLIC_API_URL', 'WEB_URL', 'NEXT_PUBLIC_STORAGE_PUBLIC_URL']) {
      expect(message).toContain(key);
    }
  });

  it('keeps the shared defaults on a deployment, which are not per-environment', () => {
    expect(
      assertWebEnv({
        ...VALID,
        VERCEL: '1',
        DEPLOY_ENV: 'production',
        WEB_URL: 'https://orla.test',
        API_URL: 'https://api.orla.test',
        NEXT_PUBLIC_API_URL: 'https://api.orla.test',
        NEXT_PUBLIC_STORAGE_PUBLIC_URL: 'https://cdn.orla.test/uploads',
        NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/42',
        WEB_TIER_KEY: 'k'.repeat(40),
      }).NEXT_PUBLIC_SENTRY_DSN,
    ).toBe('https://abc123@o1.ingest.sentry.io/42');
  });

  it('refuses a deployed build with no WEB_TIER_KEY, and builds locally without one', () => {
    const deployed = {
      ...VALID,
      VERCEL: '1',
      DEPLOY_ENV: 'production',
      WEB_URL: 'https://orla.test',
      API_URL: 'https://api.orla.test',
      NEXT_PUBLIC_API_URL: 'https://api.orla.test',
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: 'https://cdn.orla.test/uploads',
      NEXT_PUBLIC_SENTRY_DSN: 'https://abc123@o1.ingest.sentry.io/42',
    };

    expect(() => assertWebEnv(deployed)).toThrow(/WEB_TIER_KEY/);
    expect(assertWebEnv({ ...deployed, WEB_TIER_KEY: 'k'.repeat(40) }).WEB_TIER_KEY).toBe(
      'k'.repeat(40),
    );
    expect(assertWebEnv({ ...VALID }).WEB_TIER_KEY).toBeUndefined();
  });

  /*
   * VEN-397: a deployed build with no DSN would ship a web app that reports
   * none of its errors, and a laptop build must not need one.
   */
  it('refuses a deployed build with a missing or malformed Sentry DSN, and builds locally without one', () => {
    const deployed = {
      ...VALID,
      VERCEL: '1',
      DEPLOY_ENV: 'production',
      WEB_URL: 'https://orla.test',
      API_URL: 'https://api.orla.test',
      NEXT_PUBLIC_API_URL: 'https://api.orla.test',
      NEXT_PUBLIC_STORAGE_PUBLIC_URL: 'https://cdn.orla.test/uploads',
    };

    expect(() => assertWebEnv(deployed)).toThrow(/NEXT_PUBLIC_SENTRY_DSN is required/);
    expect(() =>
      assertWebEnv({ ...deployed, NEXT_PUBLIC_SENTRY_DSN: 'https://...@sentry.io/...' }),
    ).toThrow(/NEXT_PUBLIC_SENTRY_DSN does not look like a real value/);
    expect(assertWebEnv(VALID).NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it('requires the Stripe key, so no deploy ships a checkout with no card field', () => {
    /*
     * `loadStripe('')` is rejected by Stripe.js: the card field never mounts
     * and the Pay button does nothing, after the server has already opened a
     * real PaymentIntent. The build is the only place that can stop it.
     */
    const source = { ...VALID };
    delete source.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    expect(() => assertWebEnv(source)).toThrow(/NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
  });
});

describe('publicEnv', () => {
  it('covers every browser-facing key the registry declares for the web', () => {
    // The literal `process.env.X` map cannot be generated, so this is the drift
    // gate that keeps it in step with the registry.
    const declared = registryKeys({
      consumer: 'web',
      capabilities: ['core', 'auth', 'storage', 'stripe'],
    }).filter((key) => key.startsWith('NEXT_PUBLIC_'));

    expect(publicEnvKeys().sort()).toEqual([...declared].sort());
  });

  /*
   * `public-env.ts` restates the two development fallbacks rather than reading
   * them from the registry, because importing the registry would pull the whole
   * validation table into the browser bundle. This is the drift guarantee that
   * buys back: the copies are asserted against their rows here, where the test
   * runner may import anything.
   */
  it.each([
    ['NEXT_PUBLIC_API_URL', LOCAL_API_ORIGIN],
    ['WEB_URL', LOCAL_WEB_ORIGIN],
  ])('keeps its %s fallback equal to the registry default', (key, fallback) => {
    expect(findVariable(key)?.defaultValue).toBe(fallback);
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

/*
 * #452. `next start` runs a laptop with `NODE_ENV=production`, so answering
 * "is this origin TLS?" with `NODE_ENV` advertised `upgrade-insecure-requests`
 * and HSTS from a plain `http://localhost:<port>` origin — and Chromium applies
 * that directive to a redirect target even on `localhost`, which it exempts for
 * the initial request.
 *
 * The answer is read only from what the platform announces. `WEB_URL` sits in
 * turbo's `globalPassThroughEnv` and so is absent from the build's cache key,
 * while `headers()` is frozen into `routes-manifest.json` at build time: a
 * decision keyed on it hashed identically for an http build and an https one,
 * and a warm cache then replayed the wrong manifest in either direction.
 */
describe('servesOverTls', () => {
  it('is false on a laptop, whatever NODE_ENV says', () => {
    expect(servesOverTls(env({ NODE_ENV: 'production', WEB_URL: 'http://localhost:3033' }))).toBe(
      false,
    );
  });

  it('is false for the unconfigured laptop', () => {
    expect(servesOverTls(env({}))).toBe(false);
  });

  /*
   * The production branch, pinned: a header that is right on a laptop and wrong
   * behind TLS is the same defect facing the other way.
   */
  it("is true on a deployment, even when WEB_URL still holds the laptop's default", () => {
    expect(
      servesOverTls(
        env({
          WEB_URL: 'http://localhost:3000',
          VERCEL_PROJECT_PRODUCTION_URL: 'project.vercel.app',
        }),
      ),
    ).toBe(true);
  });

  /** `deployment.ts`'s escape hatch: a container that announces no platform. */
  it('is true for a bare DEPLOYMENT_ORIGIN, which announces no platform', () => {
    expect(servesOverTls(env({ DEPLOYMENT_ORIGIN: 'orla.example' }))).toBe(true);
  });

  /*
   * `WEB_URL` may not decide it in either direction — that is what keeps the
   * built manifest a function of the cache key. It cannot turn the headers on
   * for a laptop, and it cannot rescue a deployment that announced nothing:
   * that one throws instead.
   */
  it('does not let an https WEB_URL alone turn the headers on', () => {
    expect(servesOverTls(env({ WEB_URL: 'https://bookings.example' }))).toBe(false);
  });

  /*
   * `httpsOrigin` only *prepends* a scheme to a bare host, so an explicit
   * `http://` announced origin survives it. An operator who declares a
   * plaintext origin is believed: a proxy-terminated deployment's public origin
   * is `https://`, and declaring it is how it says so.
   */
  it('believes an operator who announces a plaintext origin', () => {
    expect(servesOverTls(env({ DEPLOYMENT_ORIGIN: 'http://orla.example' }))).toBe(false);
  });

  /*
   * A deployed build that announces no https origin would bake an artefact with
   * no HSTS in it, and the headers are frozen at build time, so there is no
   * later chance to notice. Derive it from something the platform sets, or
   * throw — and an https `WEB_URL` does not buy it out.
   */
  it('refuses a deployed build that announces no https origin', () => {
    expect(() =>
      servesOverTls(env({ DEPLOYMENT_PLATFORM: 'fly', WEB_URL: 'https://orla.example' })),
    ).toThrow(/announced no https origin/);
  });

  it('does not refuse a laptop, which is the whole point of the change', () => {
    expect(() => servesOverTls(env({ WEB_URL: 'http://localhost:3033' }))).not.toThrow();
  });
});

describe('assertWebEnv Stripe mode', () => {
  const LIVE_PK = ['pk', 'live', '51Qabcdefghijklmnop'].join('_');
  const LIVE_SK = ['sk', 'live', '51Qabcdefghijklmnop'].join('_');
  const TEST_SK = ['sk', 'test', '51Qabcdefghijklmnop'].join('_');

  it.each(['local', 'staging'])('refuses a live publishable key with DEPLOY_ENV=%s', (tier) => {
    expect(() =>
      assertWebEnv({ ...VALID, DEPLOY_ENV: tier, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: LIVE_PK }),
    ).toThrow(
      `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is live-mode but DEPLOY_ENV is ${tier}; only production may hold a live key`,
    );
  });

  it('accepts a live publishable key for production, and a test key there too (the beta)', () => {
    const production = { ...VALID, DEPLOY_ENV: 'production' };

    expect(
      assertWebEnv({ ...production, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: LIVE_PK })
        .NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    ).toBe(LIVE_PK);
    expect(assertWebEnv(production).DEPLOY_ENV).toBe('production');
  });

  it('refuses a live secret beside a test publishable key where both are visible', () => {
    expect(() =>
      assertWebEnv({ ...VALID, DEPLOY_ENV: 'production', STRIPE_SECRET_KEY: LIVE_SK }),
    ).toThrow(
      'STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are in different Stripe modes',
    );
    expect(assertWebEnv({ ...VALID, STRIPE_SECRET_KEY: TEST_SK }).DEPLOY_ENV).toBe('local');
  });

  it('refuses a deployed build with DEPLOY_ENV unset, naming it', () => {
    expect(() => assertWebEnv({ ...VALID, VERCEL: '1' })).toThrow(/DEPLOY_ENV is required/);
  });
});
