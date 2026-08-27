import { BRAND_DOMAIN } from '../constants/brand.js';
import { describe, expect, it } from 'vitest';
import {
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
  shapeFor,
} from './registry.js';
import { BASELINE_CAPABILITIES, TICKET_CAPABILITIES, capabilitiesForTicket } from './tickets.js';
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

  it('falls back to the local shape in production when none is tightened', () => {
    const webhook = findVariable('CLERK_WEBHOOK_SECRET');

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
    expect(keys).toContain('CLERK_SECRET_KEY');
    expect(keys).not.toContain('STRIPE_SECRET_KEY');
  });
});

describe('capabilitiesForTicket', () => {
  it('always includes the implicit core and e2e capabilities', () => {
    expect(capabilitiesForTicket(17)).toEqual(['core', 'e2e']);
    expect(BASELINE_CAPABILITIES).toEqual(['core', 'e2e']);
  });

  it('adds the declared capabilities for a payments ticket', () => {
    expect(capabilitiesForTicket(9)).toEqual(['core', 'auth', 'stripe', 'e2e']);
  });

  it('resolves a ticket that needs every capability', () => {
    expect(capabilitiesForTicket(19)).toEqual([...CAPABILITIES]);
  });

  it('resolves the two design-revision tickets added on 2026-08-27', () => {
    // #23 rebuilds the search screen and touches uploaded vendor imagery;
    // #24 is a copy-only change behind auth. Neither needs a paid service, so
    // both must start without Stripe, Resend or Sentry keys.
    expect(capabilitiesForTicket(23)).toEqual(['core', 'auth', 'storage', 'e2e']);
    expect(capabilitiesForTicket(24)).toEqual(['core', 'auth', 'e2e']);
    expect(capabilitiesForTicket(25)).toEqual(['core', 'auth', 'e2e']);
  });

  it('fails loudly on an unknown ticket rather than checking nothing', () => {
    expect(() => capabilitiesForTicket(999)).toThrow(/Unknown ticket #999/);
  });

  it('declares only known capabilities for every ticket', () => {
    for (const [ticket, capabilities] of Object.entries(TICKET_CAPABILITIES)) {
      for (const capability of capabilities) {
        expect(isCapability(capability), `ticket ${ticket}`).toBe(true);
      }
    }
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

    expect(Object.keys(shape).sort()).toEqual(['CLERK_SECRET_KEY', 'CLERK_WEBHOOK_SECRET']);
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

  it('lists the keys the web build reads for a capability', () => {
    expect(registryKeys({ consumer: 'web', capabilities: ['core'] })).toEqual([
      'NODE_ENV',
      'API_URL',
      'NEXT_PUBLIC_API_URL',
    ]);
  });
});
