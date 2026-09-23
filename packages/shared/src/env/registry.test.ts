import { BRAND_DOMAIN } from '../constants/brand.js';
import { describe, expect, it } from 'vitest';
import {
  BASELINE_CAPABILITIES,
  CAPABILITIES,
  CAPABILITY_LABELS,
  COMPOSE_SERVICES,
  WEBHOOK_FORWARDERS,
  isCapability,
  variablesFor,
  variablesForAll,
} from './capabilities.js';
import {
  ENV_REGISTRY,
  type EnvVariable,
  exampleValue,
  findVariable,
  requiresExplicitValue,
  shapeFor,
} from './registry.js';
import { registryKeys, registrySchemaShape } from './schema.js';

/**
 * The widened view of the registry. `ENV_REGISTRY` is a `const` tuple, so
 * TypeScript can prove some of these invariants outright and rejects the
 * comparison as unreachable — asserting them at runtime too keeps the guarantee
 * if a row is ever added with a wider type.
 */
const ALL_VARIABLES: readonly EnvVariable[] = ENV_REGISTRY;

describe('ENV_REGISTRY integrity', () => {
  it('declares every key exactly once', () => {
    const keys = ENV_REGISTRY.map((variable) => variable.key);
    const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

    expect(duplicates).toEqual([]);
  });

  it('gives every row exactly one of placeholder or defaultValue', () => {
    const malformed = ALL_VARIABLES.filter(
      (variable) => (variable.placeholder === undefined) === (variable.defaultValue === undefined),
    ).map((variable) => variable.key);

    expect(malformed).toEqual([]);
  });

  it('makes every placeholder fail its own shape', () => {
    // The property the whole gate rests on: if a placeholder could satisfy its
    // shape, `STRIPE_SECRET_KEY=sk_test_...` would pass validation and fail
    // later, deep inside a feature — the exact failure this ticket removes.
    const accepted = ALL_VARIABLES.filter(
      (variable) =>
        variable.placeholder !== undefined && variable.shape?.test(variable.placeholder) === true,
    ).map((variable) => variable.key);

    expect(accepted).toEqual([]);
  });

  it('makes every defaultValue satisfy its own shape', () => {
    const rejected = ALL_VARIABLES.filter(
      (variable) =>
        variable.defaultValue !== undefined &&
        variable.shape?.test(variable.defaultValue) === false,
    ).map((variable) => variable.key);

    expect(rejected).toEqual([]);
  });

  /*
   * The guard that keeps a deployment from returning vendors over plaintext.
   * Nothing in the API asserts this on `NODE_ENV` — `next build` and `tsc` set
   * it too — so the production value set is the only thing standing between an
   * http `WEB_URL` and a release, and it is worth an explicit test rather than
   * only the generic shape-pairing ones below.
   */
  it('refuses a plaintext WEB_URL under the production value set', () => {
    const webUrl = findVariable('WEB_URL')!;
    const production = shapeFor(webUrl, 'production')!;

    expect(production.test('https://orla.app')).toBe(true);
    expect(production.test('https://orla.app, https://www.orla.app')).toBe(true);
    expect(production.test('http://orla.app')).toBe(false);
    expect(production.test('http://localhost:3000')).toBe(false);
    // One plaintext origin in an otherwise https list still fails the whole value.
    expect(production.test('https://orla.app, http://localhost:3000')).toBe(false);
  });

  it('only declares productionShape where a shape exists to tighten', () => {
    const orphans = ALL_VARIABLES.filter(
      (variable) => variable.productionShape !== undefined && variable.shape === undefined,
    ).map((variable) => variable.key);

    expect(orphans).toEqual([]);
  });

  it('gives every row at least one consumer', () => {
    const orphans = ALL_VARIABLES.filter((variable) => variable.consumers.length === 0).map(
      (variable) => variable.key,
    );

    expect(orphans).toEqual([]);
  });

  it('only lets the web consume a browser-facing key', () => {
    const leaked = ALL_VARIABLES.filter(
      (variable) => variable.audience === 'browser' && variable.consumers.includes('api'),
    ).map((variable) => variable.key);

    expect(leaked).toEqual([]);
  });

  it('gives every row a capability from the union and a setup route', () => {
    for (const variable of ALL_VARIABLES) {
      expect(isCapability(variable.capability), variable.key).toBe(true);
      expect(variable.setup.url, variable.key).toMatch(/^https:\/\//);

      if (variable.setup.productionUrl !== undefined) {
        // A live-mode route that still points at a test-mode page is worse than
        // none: it reads as deliberate.
        expect(variable.setup.productionUrl, variable.key).toMatch(/^https:\/\//);
        expect(variable.setup.productionUrl, variable.key).not.toContain('/test/');
      }
      expect(variable.setup.steps.length, variable.key).toBeGreaterThan(0);
      expect(variable.description.length, variable.key).toBeGreaterThan(0);
    }
  });

  it('labels every capability', () => {
    for (const capability of CAPABILITIES) {
      expect(CAPABILITY_LABELS[capability]).toBeTruthy();
    }
  });

  it('keeps browser-facing keys under the NEXT_PUBLIC_ prefix', () => {
    const leaked = ALL_VARIABLES.filter(
      (variable) => variable.audience === 'browser' && !variable.key.startsWith('NEXT_PUBLIC_'),
    ).map((variable) => variable.key);

    expect(leaked).toEqual([]);
  });

  it('never marks a NEXT_PUBLIC_ key as server-only', () => {
    const misfiled = ALL_VARIABLES.filter(
      (variable) => variable.key.startsWith('NEXT_PUBLIC_') && variable.audience !== 'browser',
    ).map((variable) => variable.key);

    expect(misfiled).toEqual([]);
  });

  it('rejects the placeholder Stripe key and accepts a real-looking one', () => {
    const stripe = findVariable('STRIPE_SECRET_KEY');

    expect(stripe).toBeDefined();
    expect(stripe?.shape?.test('sk_test_...')).toBe(false);
    expect(stripe?.shape?.test('sk_test_51ABCdefGHIjklMNO')).toBe(true);
  });

  it('rejects a test Stripe key under the production shape', () => {
    const stripe = findVariable('STRIPE_SECRET_KEY');

    expect(stripe).toBeDefined();
    expect(shapeFor(stripe!, 'local')?.test('sk_test_51ABCdefGHIjklMNO')).toBe(true);
    expect(shapeFor(stripe!, 'production')?.test('sk_test_51ABCdefGHIjklMNO')).toBe(false);
    expect(shapeFor(stripe!, 'production')?.test('sk_live_51ABCdefGHIjklMNO')).toBe(true);
  });

  /*
   * VEN-609. Nothing in the app sets `ssl`, so TLS rests on the URL alone: a
   * production connection string that does not demand it could connect in
   * plaintext to anything that is not Neon.
   */
  it.each(['DATABASE_URL', 'DATABASE_URL_UNPOOLED'])(
    'requires a production %s to demand TLS',
    (key) => {
      const production = shapeFor(findVariable(key)!, 'production')!;
      const neon = 'postgresql://app:secret@ep-x-123.us-east-2.aws.neon.tech/neondb';

      expect(production.test(`${neon}?sslmode=require`)).toBe(true);
      expect(production.test(`${neon}?sslmode=require&channel_binding=require`)).toBe(true);
      expect(production.test(`${neon}?channel_binding=require&sslmode=verify-full`)).toBe(true);
      expect(production.test(neon)).toBe(false);
      expect(production.test(`${neon}?sslmode=prefer`)).toBe(false);
      expect(production.test(`${neon}?sslmode=disable`)).toBe(false);
      expect(production.test(`${neon}?sslmode=required`)).toBe(false);
      expect(production.test(`${neon}?xsslmode=require`)).toBe(false);
      // The driver takes the last `sslmode`, decodes names, and ignores the fragment.
      expect(production.test(`${neon}?sslmode=require&sslmode=disable`)).toBe(false);
      expect(production.test(`${neon}?sslmode=require&ssl%6Dode=disable`)).toBe(false);
      expect(production.test(`${neon}#?sslmode=require`)).toBe(false);
      expect(production.test(`${neon}?a=b#&sslmode=require`)).toBe(false);
      expect(production.test(`${neon}?sslmode=disable&sslmode=require`)).toBe(true);
      // Local development keeps the Docker Postgres, which has no TLS.
      expect(shapeFor(findVariable(key)!, 'local')!.test(neon)).toBe(true);
    },
  );

  it('declares localShape, productionShape and modes as one unit', () => {
    // A mode restriction that is declared in only one direction is the defect
    // this ticket removes; it must not be reintroducible one field at a time.
    const partial = ALL_VARIABLES.filter(
      (variable) =>
        (variable.modes !== undefined) !==
        (variable.localShape !== undefined && variable.productionShape !== undefined),
    ).map((variable) => variable.key);

    expect(partial).toEqual([]);
  });

  it('gives each target its own tightened shape, and baseline none of them', () => {
    for (const variable of ALL_VARIABLES.filter((row) => row.productionShape !== undefined)) {
      expect(shapeFor(variable, 'production'), variable.key).toBe(variable.productionShape);
      expect(shapeFor(variable, 'local'), variable.key).toBe(variable.localShape ?? variable.shape);
      expect(shapeFor(variable, 'baseline'), variable.key).toBe(variable.shape);
    }
  });

  it('confines every mode-carrying credential to its target, in both directions', () => {
    const moded = ALL_VARIABLES.filter((variable) => variable.modes !== undefined);

    expect(moded.map((variable) => variable.key)).toEqual([
      'STRIPE_SECRET_KEY',
      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    ]);

    for (const variable of moded) {
      // Built from the row itself, so a fifth mode-carrying credential is
      // covered the moment it is declared rather than when someone remembers.
      const localValue = variable.placeholder!.replace('...', '51ABCdefGHIjklMNO');
      const productionValue = localValue.replace(
        `_${variable.modes!.local}_`,
        `_${variable.modes!.production}_`,
      );

      expect(shapeFor(variable, 'local')?.test(localValue), variable.key).toBe(true);
      expect(shapeFor(variable, 'local')?.test(productionValue), variable.key).toBe(false);
      expect(shapeFor(variable, 'production')?.test(productionValue), variable.key).toBe(true);
      expect(shapeFor(variable, 'production')?.test(localValue), variable.key).toBe(false);
    }
  });

  it('leaves a credential with no mode in its prefix unrestricted by target', () => {
    for (const key of ['STRIPE_WEBHOOK_SECRET', 'DATABASE_URL', 'STORAGE_ACCESS_KEY_ID']) {
      const variable = findVariable(key);

      expect(variable, key).toBeDefined();
      expect(variable!.modes, key).toBeUndefined();
      expect(shapeFor(variable!, 'local'), key).toBe(variable!.shape);
    }
  });

  it('falls back to the local shape in production when none is tightened', () => {
    const webhook = findVariable('STRIPE_WEBHOOK_SECRET');

    expect(webhook).toBeDefined();
    expect(shapeFor(webhook!, 'production')).toBe(webhook?.shape);
  });

  it('leaves a free-form value without a shape but still with an example', () => {
    const from = findVariable('EMAIL_FROM');

    expect(from).toBeDefined();
    expect(from?.shape).toBeUndefined();
    expect(exampleValue(from!)).toBe(`noreply@${BRAND_DOMAIN}`);
  });

  it('keeps the end-to-end credentials out of the .env contract', () => {
    expect(findVariable('E2E_TEST_EMAIL')).toBeUndefined();
    expect(findVariable('E2E_TEST_PASSWORD')).toBeUndefined();
  });
});

describe('capability index', () => {
  it('partitions the registry with no row lost or duplicated', () => {
    const indexed = CAPABILITIES.flatMap((capability) => variablesFor(capability));

    expect(indexed).toHaveLength(ENV_REGISTRY.length);
    expect(new Set(indexed.map((variable) => variable.key)).size).toBe(ENV_REGISTRY.length);
  });

  it('returns an empty list for a capability with no variables', () => {
    expect(variablesFor('e2e')).toEqual([]);
  });

  it('preserves registry order across several capabilities', () => {
    const keys = variablesForAll(['auth', 'core']).map((variable) => variable.key);

    expect(keys[0]).toBe('NODE_ENV');
    expect(keys).toContain('NEON_AUTH_BASE_URL');
    expect(keys).not.toContain('STRIPE_SECRET_KEY');
  });
});

describe('BASELINE_CAPABILITIES', () => {
  // Every ticket touches the app and every ticket is browser-verified, so a bare
  // `pnpm preflight` checks exactly these two and demands no paid credential.
  it('is core and e2e, in registry order', () => {
    expect(BASELINE_CAPABILITIES).toEqual(['core', 'e2e']);
    expect(BASELINE_CAPABILITIES.every(isCapability)).toBe(true);
  });
});

describe('service metadata', () => {
  it('points every webhook forwarder and compose service at a known capability', () => {
    for (const key of [...Object.keys(WEBHOOK_FORWARDERS), ...Object.keys(COMPOSE_SERVICES)]) {
      expect(isCapability(key), key).toBe(true);
    }
  });
});

describe('registrySchemaShape', () => {
  it('includes only the rows the consumer reads', () => {
    const shape = registrySchemaShape({ consumer: 'api', capabilities: ['auth'] });

    expect(Object.keys(shape).sort()).toEqual(['NEON_AUTH_BASE_URL', 'NEON_AUTH_DATABASE_URL']);
  });

  it('keeps tooling-only rows out of the API contract', () => {
    // NEON_BRANCH and the unpooled URL are operator concerns; requiring them at
    // API boot would refuse to start the server over a value it never reads.
    const shape = registrySchemaShape({ consumer: 'api', capabilities: ['core'] });

    expect(Object.keys(shape)).not.toContain('NEON_BRANCH');
    expect(Object.keys(shape)).not.toContain('DATABASE_URL_UNPOOLED');
    expect(Object.keys(shape)).toContain('DATABASE_URL');
  });

  it('applies the row shape and its default', () => {
    const shape = registrySchemaShape({ consumer: 'api', capabilities: ['core'] });
    const logLevel = shape.LOG_LEVEL;

    expect(logLevel).toBeDefined();
    expect(logLevel.parse(undefined)).toBe('info');
    expect(() => logLevel.parse('chatty')).toThrow(/LOG_LEVEL/);
  });

  it('accepts either mode by default, so a production boot is not rejected', () => {
    /*
     * The regression guard for the whole `localShape` mechanism. Both apps
     * derive this schema at build and boot time in every environment — neither
     * can tell a release from `pnpm build` on a laptop, because `next build`
     * and `tsc` both set `NODE_ENV=production`. Defaulting to the local set
     * would fail the Vercel build and the production API boot on exactly the
     * live keys that are correct there.
     */
    const key = findVariable('STRIPE_SECRET_KEY')!;
    const local = key.placeholder!.replace('...', '51ABCdefGHIjklMNO');
    const production = local.replace(`_${key.modes!.local}_`, `_${key.modes!.production}_`);
    const shape = registrySchemaShape({ consumer: 'api', capabilities: ['stripe'] });

    expect(shape.STRIPE_SECRET_KEY.parse(local)).toBe(local);
    expect(shape.STRIPE_SECRET_KEY.parse(production)).toBe(production);
  });

  it('rejects a live key only when the caller names the local target', () => {
    const key = findVariable('STRIPE_SECRET_KEY')!;
    const production = key
      .placeholder!.replace('...', '51ABCdefGHIjklMNO')
      .replace(`_${key.modes!.local}_`, `_${key.modes!.production}_`);
    const shape = registrySchemaShape({
      consumer: 'api',
      capabilities: ['stripe'],
      target: 'local',
    });

    expect(() => shape.STRIPE_SECRET_KEY.parse(production)).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('applies the production shape when asked for one', () => {
    const shape = registrySchemaShape({
      consumer: 'api',
      capabilities: ['stripe'],
      target: 'production',
    });

    expect(() => shape.STRIPE_SECRET_KEY.parse('sk_test_51ABCdefGHIjklMNO')).toThrow(
      /STRIPE_SECRET_KEY/,
    );
    expect(shape.STRIPE_SECRET_KEY.parse('sk_live_51ABCdefGHIjklMNO')).toBe(
      'sk_live_51ABCdefGHIjklMNO',
    );
  });

  /*
   * `WEB_URL` joined this list in #30: the web tier builds `metadataBase`, the
   * sitemap and robots from its own origin, and it reads the same value the
   * API allow-lists rather than a second one that could disagree.
   * `CSP_ENFORCE` joined in #396: it existed only as an undocumented read in
   * `next.config.ts`, and the browser pass that would have caught the Stripe
   * CSP block never knew to turn it on.
   */
  it('lists the keys the web build reads for a capability', () => {
    expect(registryKeys({ consumer: 'web', capabilities: ['core'] })).toEqual([
      'NODE_ENV',
      'DEPLOY_ENV',
      'WEB_URL',
      'API_URL',
      'CSP_ENFORCE',
      'NEXT_PUBLIC_API_URL',
      'WEB_TIER_KEY',
    ]);
  });

  /*
   * `deployed` is the value set the apps apply once they can tell they are one.
   * It refuses per-environment defaults — the whole of *a development default
   * must never be able to reach production* — and deliberately stops there:
   * staging is a deployment too, and `productionShape` would demand a live
   * Stripe key for a branch that must never move real money.
   */
  describe("the 'deployed' target", () => {
    const shape = registrySchemaShape({
      consumer: 'api',
      capabilities: ['core', 'storage', 'stripe', 'email'],
      target: 'deployed',
    });

    it('refuses a per-environment row that would fall back to its default', () => {
      expect(() => shape.STORAGE_ENDPOINT.parse(undefined)).toThrow(
        /STORAGE_ENDPOINT is required on a deployment/,
      );
    });

    it('names the default in the message, so the fix is the value to replace', () => {
      expect(() => shape.WEB_URL.parse(undefined)).toThrow(/http:\/\/localhost:3000/);
    });

    it('keeps a shared row on its default, which is identical everywhere', () => {
      expect(shape.LOG_LEVEL.parse(undefined)).toBe('info');
      expect(shape.STRIPE_PLATFORM_FEE_RATE.parse(undefined)).toBe('0.12');
    });

    it('applies no mode restriction, because staging is a deployment too', () => {
      const key = findVariable('STRIPE_SECRET_KEY')!;
      const testMode = key.placeholder!.replace('...', '51ABCdefGHIjklMNO');

      expect(shape.STRIPE_SECRET_KEY.parse(testMode)).toBe(testMode);
    });

    it('still enforces the row shape', () => {
      expect(() => shape.STORAGE_ENDPOINT.parse('not-a-url')).toThrow(/STORAGE_ENDPOINT/);
    });

    /*
     * The excused rows, written out rather than derived — so adding a fourth
     * has to be a deliberate edit here, where somebody reads why. Deriving the
     * list from `optionalFor` would restate `requiresExplicitValue`'s own
     * branch, and an assertion that mirrors the implementation cannot fail for
     * any change made consistently in both.
     *
     * `EMAIL_DAILY_SEND_CAP` (VEN-661) has a per-tier default the API derives
     * from `DEPLOY_ENV`, so unset is a decision on every target, never a gap.
     *
     * The two Sentry upload rows (VEN-397) are read by the web build, but only
     * the production build uploads source maps; a preview deployment has none
     * to send, and the deploy workflow refuses to start without them.
     *
     * `RESEND_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` and
     * `WEB_TIER_KEY` are **not** here: a deployment serves real users, and
     * without them a bounce is never learned, no vendor's onboarding completes,
     * and every visitor shares one rate-limit address. They are excused only on
     * a laptop, and the test after this one pins that.
     */
    const EXCUSED_ON_DEPLOYED = [
      'EMAIL_SINK_ADDRESS',
      'EMAIL_DAILY_SEND_CAP',
      'SENTRY_AUTH_TOKEN',
      'SENTRY_WEB_PROJECT',
    ];

    const REQUIRED_FOR_REAL_USERS = [
      'RESEND_WEBHOOK_SECRET',
      'STRIPE_CONNECT_WEBHOOK_SECRET',
      'WEB_TIER_KEY',
    ];

    it('requires the keys real users depend on on a deployment and in production', () => {
      for (const key of REQUIRED_FOR_REAL_USERS) {
        const variable = (ENV_REGISTRY as readonly EnvVariable[]).find((row) => row.key === key);

        expect(variable, key).toBeDefined();
        expect(requiresExplicitValue(variable as EnvVariable, 'deployed'), key).toBe(true);
        expect(requiresExplicitValue(variable as EnvVariable, 'production'), key).toBe(true);
        expect(requiresExplicitValue(variable as EnvVariable, 'local'), key).toBe(false);
        expect(requiresExplicitValue(variable as EnvVariable, 'baseline'), key).toBe(false);
      }
    });

    it('requires EMAIL_FROM on a deployment and keeps its default on a laptop', () => {
      const from = findVariable('EMAIL_FROM')!;

      expect(requiresExplicitValue(from, 'deployed')).toBe(true);
      expect(requiresExplicitValue(from, 'production')).toBe(true);
      expect(requiresExplicitValue(from, 'local')).toBe(false);
      expect(() => shape.EMAIL_FROM.parse(undefined)).toThrow(/EMAIL_FROM is required/);
    });

    it('requires exactly the per-environment rows, and every one of them', () => {
      for (const variable of ENV_REGISTRY as readonly EnvVariable[]) {
        const expected =
          !EXCUSED_ON_DEPLOYED.includes(variable.key) &&
          (variable.environments === 'per-environment' || variable.defaultValue === undefined);

        expect(requiresExplicitValue(variable, 'deployed'), variable.key).toBe(expected);
      }
    });

    /*
     * The other half of that exemption, and the one that matters: a row excused
     * anywhere must have **no default to fall back into**. A row with both
     * would be a development default reaching production with the gate turned
     * off for it, which is exactly what this file exists to prevent.
     */
    it('never excuses a row that has a default to fall back into', () => {
      const excused = ALL_VARIABLES.filter((variable) => variable.optionalFor !== undefined);

      expect(excused.length).toBeGreaterThan(0);
      for (const variable of excused) {
        expect(variable.defaultValue, variable.key).toBeUndefined();
      }
    });

    /*
     * `FieldFor` in `schema.ts` decides optionality in the **type** from a
     * hardcoded `baseline`, while `schemaFor` decides it at runtime from the
     * caller's actual target. The two agree only while every excused row
     * includes `baseline` — so that is asserted rather than assumed. A row
     * excused on `deployed` alone would type as required and parse as optional,
     * and nothing else in the suite would notice.
     */
    it('excuses no row that a baseline schema would still type as required', () => {
      for (const variable of ALL_VARIABLES) {
        if (variable.optionalFor === undefined) {
          continue;
        }

        expect(variable.optionalFor, variable.key).toContain('baseline');
      }
    });
  });
});

/*
 * VEN-397's contract for the DSNs, stated per target rather than inferred from
 * `optionalFor`: a deployment that cannot report its errors must refuse to boot
 * or build, and a laptop must run with reporting simply off.
 */
describe('the Sentry DSNs', () => {
  const DSN = 'https://abc123@o1.ingest.sentry.io/42';

  for (const [consumer, key] of [
    ['api', 'SENTRY_DSN'],
    ['web', 'NEXT_PUBLIC_SENTRY_DSN'],
  ] as const) {
    const shapeFor = (target: 'baseline' | 'local' | 'deployed' | 'production') =>
      registrySchemaShape({ consumer, capabilities: ['sentry'], target }) as Record<
        string,
        { parse: (value: unknown) => unknown }
      >;

    for (const target of ['deployed', 'production'] as const) {
      it(`${key}: refuses a missing value on the ${target} target`, () => {
        expect(() => shapeFor(target)[key]!.parse(undefined)).toThrow(`${key} is required`);
        expect(() => shapeFor(target)[key]!.parse('')).toThrow(`${key} is required`);
      });

      it(`${key}: refuses a malformed value and the placeholder on the ${target} target`, () => {
        for (const bad of [
          'http://abc123@o1.ingest.sentry.io/42',
          'not-a-dsn',
          findVariable(key)!.placeholder,
        ]) {
          expect(() => shapeFor(target)[key]!.parse(bad), bad).toThrow(
            `${key} does not look like a real value`,
          );
        }
      });

      it(`${key}: accepts a real DSN on the ${target} target`, () => {
        expect(shapeFor(target)[key]!.parse(DSN)).toBe(DSN);
      });
    }

    for (const target of ['baseline', 'local'] as const) {
      it(`${key}: tolerates absence in development (${target})`, () => {
        expect(shapeFor(target)[key]!.parse(undefined)).toBeUndefined();
        expect(shapeFor(target)[key]!.parse('')).toBeUndefined();
      });

      it(`${key}: still refuses a malformed value in development (${target})`, () => {
        expect(() => shapeFor(target)[key]!.parse('not-a-dsn')).toThrow(key);
      });
    }
  }
});
