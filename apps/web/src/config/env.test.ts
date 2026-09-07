import { findVariable, registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { assertWebEnv, servesOverTls, siteOrigin } from './env';
import {
  LOCAL_API_ORIGIN,
  LOCAL_WEB_ORIGIN,
  publicEnvKeys,
  requirePublicValue,
} from './public-env';

const VALID: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_API_URL: 'http://localhost:4000',
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_c3RpcnJpbmctZ2F6ZWxsZS0x',
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: '/sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: '/sign-up',
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL: '/after-sign-in',
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL: '/after-sign-in',
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
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: VALID.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: VALID.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    };

    let message = '';
    try {
      assertWebEnv(bare);
      expect.unreachable('assertWebEnv should have thrown');
    } catch (error) {
      message = (error as Error).message;
    }

    for (const key of ['NEXT_PUBLIC_API_URL', 'WEB_URL', 'NEXT_PUBLIC_S3_PUBLIC_URL']) {
      expect(message).toContain(key);
    }
  });

  it('keeps the shared defaults on a deployment, which are not per-environment', () => {
    expect(
      assertWebEnv({
        ...VALID,
        VERCEL: '1',
        WEB_URL: 'https://orla.test',
        API_URL: 'https://api.orla.test',
        NEXT_PUBLIC_API_URL: 'https://api.orla.test',
        NEXT_PUBLIC_S3_PUBLIC_URL: 'https://cdn.orla.test/uploads',
      }).NEXT_PUBLIC_CLERK_SIGN_IN_URL,
    ).toBe('/sign-in');
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
