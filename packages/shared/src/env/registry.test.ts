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
import {
  BASELINE_CAPABILITIES,
  HIGHEST_REGISTERED_TICKET,
  TICKET_CAPABILITIES,
  capabilitiesForTicket,
  isRegisteredTicket,
} from './tickets.js';
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
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
      'CLERK_SECRET_KEY',
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
    for (const key of ['CLERK_WEBHOOK_SECRET', 'DATABASE_URL', 'S3_ACCESS_KEY_ID']) {
      const variable = findVariable(key);

      expect(variable, key).toBeDefined();
      expect(variable!.modes, key).toBeUndefined();
      expect(shapeFor(variable!, 'local'), key).toBe(variable!.shape);
    }
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
    // #26 and #27 merged into one Chrome Parity ticket on 2026-08-27. The merged
    // ticket carries `auth` because the Clerk pin half touches the auth screens;
    // #27 is retired but still resolves, so the old number cannot silently throw.
    expect(capabilitiesForTicket(26)).toEqual(['core', 'auth', 'e2e']);
    expect(capabilitiesForTicket(27)).toEqual(['core', 'auth', 'e2e']);
    expect(capabilitiesForTicket(28)).toEqual(['core', 'e2e']);
    expect(capabilitiesForTicket(29)).toEqual(['core', 'auth', 'storage', 'e2e']);
    expect(capabilitiesForTicket(30)).toEqual(['core', 'e2e']);
    expect(capabilitiesForTicket(31)).toEqual(['core', 'auth', 'e2e']);
    expect(capabilitiesForTicket(32)).toEqual(['core', 'e2e']);
  });

  // The three tickets opened by the 2026-08-27 production outage, when the API
  // answered 500 on every route for ~19h behind a deployment Vercel called Ready.
  it('resolves the tickets opened by the 2026-08-27 outage', () => {
    // #33 is a web-tier resilience change and #35 is a CI check; neither reaches
    // a paid service. #34 needs `storage` because half its scope is deciding how
    // uploads cross the platform's 4.5MB request-body cap.
    expect(capabilitiesForTicket(33)).toEqual(['core', 'e2e']);
    expect(capabilitiesForTicket(34)).toEqual(['core', 'storage', 'e2e']);
    expect(capabilitiesForTicket(35)).toEqual(['core', 'e2e']);
  });

  it('resolves the two design-revision tickets from the 2026-08-27 frame import', () => {
    // #36 and #37 carry frames `01` and `18`. Parity work on imagery and a
    // control shape needs no external service, so both start on `core` alone.
    expect(capabilitiesForTicket(36)).toEqual(['core', 'e2e']);
    expect(capabilitiesForTicket(37)).toEqual(['core', 'e2e']);
  });

  // #26 and #27 sat on the status board for a day with no registry row, so
  // `preflight --ticket 26` threw UnknownTicketError instead of gating the work.
  // A ticket that cannot be preflighted cannot be started, so the board and the
  // registry have to be checked against each other, not just each on its own.
  it('registers a contiguous ticket range with no gaps', () => {
    const numbers = Object.keys(TICKET_CAPABILITIES)
      .map(Number)
      .sort((a, b) => a - b);

    expect(numbers[0]).toBe(0);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_value, index) => index));
  });

  // Unknown numbers used to throw. That turned a stale registry into a hard stop
  // on starting any work, which is how it fell 192 rows behind the board without
  // anyone being forced to fix it. The fallback is the baseline — never nothing —
  // and `tickets.board.test.ts` is what now fails when a row is genuinely missing.
  it('falls back to the baseline on an unregistered ticket rather than throwing', () => {
    expect(isRegisteredTicket(999)).toBe(false);
    expect(capabilitiesForTicket(999)).toEqual(['core', 'e2e']);
  });

  it('reports a registered ticket as registered and keeps its declared capabilities', () => {
    expect(isRegisteredTicket(165)).toBe(true);
    expect(isRegisteredTicket(229)).toBe(true);
    expect(capabilitiesForTicket(68)).toEqual(['core', 'auth', 'stripe', 'e2e']);
    expect(capabilitiesForTicket(170)).toEqual(['core', 'storage', 'e2e']);
  });

  it('never returns fewer than the baseline, for any registered ticket', () => {
    for (const key of Object.keys(TICKET_CAPABILITIES)) {
      const resolved = capabilitiesForTicket(Number(key));
      expect(resolved, `ticket ${key}`).toContain('core');
      expect(resolved, `ticket ${key}`).toContain('e2e');
    }
  });

  it('tracks the highest registered ticket', () => {
    expect(HIGHEST_REGISTERED_TICKET).toBe(326);
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

    expect(Object.keys(shape).sort()).toEqual([
      'CLERK_SECRET_KEY',
      'CLERK_WEBHOOK_ENDPOINT',
      'CLERK_WEBHOOK_SECRET',
    ]);
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
   */
  it('lists the keys the web build reads for a capability', () => {
    expect(registryKeys({ consumer: 'web', capabilities: ['core'] })).toEqual([
      'NODE_ENV',
      'WEB_URL',
      'API_URL',
      'NEXT_PUBLIC_API_URL',
    ]);
  });
});
