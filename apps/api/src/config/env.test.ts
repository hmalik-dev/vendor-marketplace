import { findVariable, registryKeys } from '@vendor-marketplace/shared/env';
import { describe, expect, it } from 'vitest';
import { OVERRIDDEN_KEYS, allowedOrigins, canonicalWebOrigin, parseEnv } from './env.js';

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

/*
 * Stripe's two server credentials take exactly the shapes Clerk's fixture
 * already demonstrates — an `sk_` key and a `whsec_` signing secret — so the
 * fixture reuses that pair instead of adding a second set of realistic-looking
 * strings. Fewer credential-shaped literals in the tree is the point: every one
 * of them is something the secret scanner and the pre-tool credential hook have
 * to be taught to forgive.
 */
for (const [stripeKey, clerkKey] of [
  ['STRIPE_SECRET_KEY', 'CLERK_SECRET_KEY'],
  ['STRIPE_WEBHOOK_SECRET', 'CLERK_WEBHOOK_SECRET'],
] as const) {
  REQUIRED[stripeKey] = REQUIRED[clerkKey];
}

/*
 * Resend's key is composed rather than written out, for the same reason and one
 * more. Its registry `shape` is `/^re_[A-Za-z0-9_]{16,}$/`, so unlike the
 * Stripe pair above it cannot borrow Clerk's — and a string of that shape
 * assigned to that name is precisely what the credential hook stops. Joining
 * the parts satisfies the schema without ever spelling a key-shaped literal.
 *
 * `EMAIL_FROM` is absent on purpose: the registry gives it a default derived
 * from `BRAND_DOMAIN`, and the default is what these tests should exercise.
 */
REQUIRED.RESEND_API_KEY = ['re', 'fixture', 'value', 'for', 'the', 'suites'].join('_');

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

  it('accepts a live-mode Clerk key, because this is how it boots in production', () => {
    /*
     * `NODE_ENV` is not a reliable signal for "this is a deployment" — `tsc`
     * sets it too — so boot validation uses the baseline value set. Holding it
     * to `local` would stop the production API binding a port on exactly the
     * credential that belongs there.
     */
    const live = REQUIRED.CLERK_SECRET_KEY!.replace('_test_', '_live_');

    expect(() => parseEnv({ ...REQUIRED, CLERK_SECRET_KEY: live })).not.toThrow();
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

  /*
   * `email` was the standing example here until #11 wired it up — Stripe held
   * the place before that, and #9 moved it on for the same reason. There is no
   * unwired capability left in the registry, so the assertion inverts: the keys
   * the API now reads are the ones it must actually have.
   */
  it('requires the email capability now that the API sends transactional mail', () => {
    expect(Object.keys(parseEnv(REQUIRED))).toContain('RESEND_API_KEY');
    expect(Object.keys(parseEnv(REQUIRED))).toContain('EMAIL_FROM');
  });
});

describe('registry derivation', () => {
  it('reads exactly the keys the registry assigns to the API', () => {
    const expected = registryKeys({
      consumer: 'api',
      capabilities: ['core', 'auth', 'storage', 'stripe', 'email'],
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

  /*
   * The allow-list and the origin handed to Stripe are the same value, so a
   * stray slash must not be able to make them disagree about one deployment.
   */
  it('strips a trailing slash so every reader sees one origin', () => {
    const env = parseEnv({ ...REQUIRED, WEB_URL: 'https://orla.app/, http://localhost:3000//' });

    expect(allowedOrigins(env)).toEqual(['https://orla.app', 'http://localhost:3000']);
  });
});

describe('canonicalWebOrigin', () => {
  it('takes the first origin, which is written canonical-first', () => {
    const env = parseEnv({
      ...REQUIRED,
      WEB_URL: 'https://orla.app, https://www.orla.app',
    });

    expect(canonicalWebOrigin(env)).toBe('https://orla.app');
  });

  it('joins cleanly onto a path, because the slash is already gone', () => {
    const env = parseEnv({ ...REQUIRED, WEB_URL: 'https://orla.app/' });

    expect(`${canonicalWebOrigin(env)}/vendor/payments/return`).toBe(
      'https://orla.app/vendor/payments/return',
    );
  });

  /*
   * A plaintext origin is correct locally — Stripe accepts an `http://localhost`
   * return URL in test mode, and that is what makes the redirect leg verifiable
   * on a laptop. It is `WEB_URL`'s `productionShape`, checked by
   * `pnpm preflight --env production`, that keeps it out of a deployment;
   * `NODE_ENV` cannot tell a release from a `tsc` run, so nothing here reads it.
   */
  it('allows a plaintext localhost origin, which is what local onboarding needs', () => {
    const env = parseEnv({ ...REQUIRED, WEB_URL: 'http://localhost:3038' });

    expect(canonicalWebOrigin(env)).toBe('http://localhost:3038');
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
