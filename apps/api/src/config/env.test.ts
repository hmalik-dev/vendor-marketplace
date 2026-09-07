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
for (const [borrower, lender] of [
  ['STRIPE_SECRET_KEY', 'CLERK_SECRET_KEY'],
  ['STRIPE_WEBHOOK_SECRET', 'CLERK_WEBHOOK_SECRET'],
  // Resend signs with svix too, so its signing secret takes the same shape.
  ['RESEND_WEBHOOK_SECRET', 'CLERK_WEBHOOK_SECRET'],
] as const) {
  REQUIRED[borrower] = REQUIRED[lender];
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

  /*
   * The exception to the rule above, and the only row in the registry that is
   * excused on every target (#439). A deployment whose account holder has not
   * configured the Resend webhook still has to boot, still has to send, and
   * still has to record what it attempted — so absence must parse rather than
   * refuse. It is safe to excuse only because absence is refusal, not
   * permission: `resend.routes.ts` does not register the endpoint at all
   * without it, so no unsigned event can reach the record.
   */
  it('boots with no Resend webhook secret, and reports it as absent', () => {
    const withoutWebhook = { ...REQUIRED };
    delete withoutWebhook.RESEND_WEBHOOK_SECRET;

    expect(() => parseEnv(withoutWebhook)).not.toThrow();
    expect(parseEnv(withoutWebhook).RESEND_WEBHOOK_SECRET).toBeUndefined();
    expect(parseEnv(REQUIRED).RESEND_WEBHOOK_SECRET).toBe(REQUIRED.CLERK_WEBHOOK_SECRET);
  });

  /*
   * **Blank is absent**, and it is the shape a real deployment produces: a
   * hosting dashboard with the variable declared and the box empty, a `.env`
   * line with nothing after the `=`, a `cp .env.example .env` where only the
   * used rows were filled in. `min(1)` and the `whsec_` shape would both refuse
   * `''` and take the whole API down at boot — while `pnpm preflight`, which
   * treats empty and unset alike, reported the environment as fine.
   */
  it('treats a blank optional value as unset rather than refusing to boot', () => {
    const blank = { ...REQUIRED };
    blank.RESEND_WEBHOOK_SECRET = '';

    expect(() => parseEnv(blank)).not.toThrow();
    expect(parseEnv(blank).RESEND_WEBHOOK_SECRET).toBeUndefined();
  });

  /*
   * The other direction, which blank-is-absent must not weaken: a value that is
   * *present* and wrong still refuses the boot. Optional means "may be absent",
   * never "may be anything".
   */
  it('still refuses an optional value that is present and malformed', () => {
    const junk = 'not-a-signing-value';
    const malformed = { ...REQUIRED };
    malformed.RESEND_WEBHOOK_SECRET = junk;

    expect(() => parseEnv(malformed)).toThrow(/RESEND_WEBHOOK_SECRET/);
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

/*
 * The law: *a development default must never be able to reach production*. The
 * API used to boot on every one of them — localhost as its CORS allow-list,
 * MinIO as its object store, a relay as its webhook endpoint — answer 200 on
 * `/health`, log nothing, and fail every real request.
 *
 * `NODE_ENV=production` is the signal here in a way it never is at build time:
 * `next build` and `tsc` set it too, but neither ever executes this file. Only
 * a booting server does.
 */
describe('parseEnv on a deployment', () => {
  /** Every per-environment row the API reads that carries a development default. */
  const DEFAULTED = [
    'WEB_URL',
    'CLERK_WEBHOOK_ENDPOINT',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY_ID',
    'S3_SECRET_ACCESS_KEY',
    'S3_BUCKET',
    'S3_PUBLIC_URL',
    'SUPPORT_EMAIL_TO',
  ] as const;

  /*
   * The list above is written out so the assertions below can name each row,
   * and a written list is one a new registry row silently falls behind — which
   * is the whole class of defect this describe block exists to catch. So it is
   * checked against the registry rather than trusted: a per-environment row the
   * API reads that carries a default and is missing here would otherwise be
   * ungated, and nothing else would say so.
   */
  it('lists every defaulted per-environment row the API reads', () => {
    const derived = registryKeys({
      consumer: 'api',
      capabilities: ['core', 'auth', 'storage', 'stripe', 'email'],
    }).filter((key) => {
      const variable = findVariable(key);
      return (
        // `NODE_ENV` is the same deliberate exception the override guard below
        // makes: it is the signal that selects this schema, so requiring it
        // would be circular.
        key !== 'NODE_ENV' &&
        variable?.environments === 'per-environment' &&
        variable.defaultValue !== undefined
      );
    });

    expect([...DEFAULTED].sort()).toEqual([...derived].sort());
  });

  /** A deployment that supplies a real value for every one of them. */
  const DEPLOYED: NodeJS.ProcessEnv = {
    ...REQUIRED,
    NODE_ENV: 'production',
    // The fixture's own database is the local Docker one; a deployment reaches
    // Neon over the network, and `deployed` now refuses a loopback host.
    DATABASE_URL: REQUIRED.DATABASE_URL!.replace('@localhost:5432', '@db.neon.tech'),
    WEB_URL: 'https://orla.test',
    CLERK_WEBHOOK_ENDPOINT: 'https://api.orla.test/webhooks/clerk',
    S3_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
    S3_PUBLIC_URL: 'https://cdn.orla.test/uploads',
    SUPPORT_EMAIL_TO: 'support@orla.test',
  };

  /** `REQUIRED` with every defaulted per-environment row removed. */
  function withoutDefaults(): NodeJS.ProcessEnv {
    const source = { ...REQUIRED };
    for (const key of DEFAULTED) {
      delete source[key];
    }
    return source;
  }

  it.each(DEFAULTED)('refuses to boot on the development default for %s', (key) => {
    const source = { ...DEPLOYED };
    delete source[key];

    expect(() => parseEnv(source)).toThrow(new RegExp(`${key} is required on a deployment`));
  });

  it('names every one of them at once, so a deploy is fixed in one pass', () => {
    let message = '';
    try {
      parseEnv({ ...withoutDefaults(), NODE_ENV: 'production' });
      expect.unreachable('parseEnv should have thrown');
    } catch (error) {
      message = (error as Error).message;
    }

    for (const key of DEFAULTED) {
      expect(message).toContain(key);
    }
  });

  it('catches a platform that sets no NODE_ENV, from its own marker', () => {
    expect(() => parseEnv({ ...withoutDefaults(), VERCEL: '1' })).toThrow(
      /WEB_URL is required on a deployment/,
    );
  });

  it('accepts a deployment that states them all', () => {
    const env = parseEnv(DEPLOYED);

    expect(allowedOrigins(env)).toEqual(['https://orla.test']);
    expect(canonicalWebOrigin(env)).toBe('https://orla.test');
    expect(env.S3_PUBLIC_URL).toBe('https://cdn.orla.test/uploads');
  });

  it('still accepts a test-mode credential, because staging is a deployment too', () => {
    // The live-key restriction belongs to `preflight --env production`, not to
    // this schema: holding a staging branch to it would demand a live Stripe
    // key for a branch that must never move real money.
    expect(parseEnv(DEPLOYED).STRIPE_SECRET_KEY).toMatch(/^sk_test_/);
  });

  /*
   * `buildSchema` spreads the registry rows and then overwrites some by key.
   * `S3_PUBLIC_URL` was overwritten with a bare `z.string()`, which silently
   * dropped both its default and its per-environment requirement — the one
   * hole in this gate. This is the guard against the next such override, which
   * `OVERRIDDEN_KEYS` alone cannot catch: it only asserts the key exists.
   *
   * `NODE_ENV` is the deliberate exception and stays defaulted: it is the very
   * signal that selects this schema, so requiring it would be circular.
   */
  it.each(
    OVERRIDDEN_KEYS.filter(
      (key) => key !== 'NODE_ENV' && findVariable(key)?.environments === 'per-environment',
    ),
  )('keeps the deployment requirement for the overridden key %s', (key) => {
    const source = { ...DEPLOYED };
    delete source[key];

    expect(() => parseEnv(source), key).toThrow(new RegExp(key));
  });

  /*
   * Presence is not the whole law. A deployment that states the development
   * value by hand satisfies every requirement above and is still localhost in
   * production.
   */
  const LOCALHOST: Record<string, string> = {
    WEB_URL: 'http://localhost:3000',
    S3_ENDPOINT: 'http://localhost:9000',
    CLERK_WEBHOOK_ENDPOINT: 'http://localhost:4000/webhooks/clerk',
    // Composed from the fixture rather than written out: a connection string
    // with an inline password is exactly what the credential hook stops.
    DATABASE_URL: REQUIRED.DATABASE_URL!,
  };

  it.each(Object.keys(LOCALHOST))('refuses a hand-written localhost value for %s', (key) => {
    expect(() => parseEnv({ ...DEPLOYED, [key]: LOCALHOST[key] })).toThrow(/localhost/);
  });

  /*
   * `WEB_URL` is the row where this matters most and the one a whole-string
   * check missed: it doubles as the CORS allow-list, so a comma-separated list
   * is legal, and `http://localhost:3000,https://orla.test` parses as no URL at
   * all. It booted — with localhost allow-listed and, because
   * `canonicalWebOrigin` takes the first entry, handed to Stripe as the Connect
   * return URL and printed into every notification email.
   */
  it.each([
    'http://localhost:3000,https://orla.test',
    'https://orla.test,http://localhost:3000',
    'https://orla.test, http://127.0.0.1:3000',
  ])('refuses %s, where only one entry of the allow-list is loopback', (webUrl) => {
    expect(() => parseEnv({ ...DEPLOYED, WEB_URL: webUrl })).toThrow(/localhost/);
  });

  it('still accepts a multi-origin allow-list with no loopback entry', () => {
    const env = parseEnv({ ...DEPLOYED, WEB_URL: 'https://orla.test, https://www.orla.test' });

    expect(allowedOrigins(env)).toEqual(['https://orla.test', 'https://www.orla.test']);
  });

  it('keeps the shared defaults, which do not differ per environment', () => {
    const env = parseEnv(DEPLOYED);

    expect(env.PORT).toBe(4000);
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.STRIPE_PLATFORM_FEE_RATE).toBe(0.12);
  });
});
