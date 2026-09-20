import { describe, expect, it } from 'vitest';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { REPO_ROOT } from '../context.js';
import type { LaunchDatabase } from './database.js';
import { readOnlyGet, type HttpGet } from './http.js';
import { mask } from './mask.js';
import { loadHandledStripeEvents, loadSeedMarkers } from './repo-modules.js';
import { renderLaunchReport, runLaunchChecks, type LaunchOptions } from './run.js';
import type { LaunchResult } from './types.js';

const API = 'https://api.orla.test';
const WEB = 'https://orla.test';
const NEON_UPLOADS = 'https://br-x.storage.c-4.us-east-2.aws.neon.tech/uploads';
const AUTH_HOST = 'ep-x.neonauth.orla.test';
const HANDLED = ['account.updated', 'payment_intent.succeeded', 'charge.dispute.created'];

/** Assembled at runtime so no literal in this file reads as a real credential. */
function fakeKey(prefix: string, mode: 'live' | 'test', lastFour: string): string {
  return [prefix, mode, `FAKEabcdefghijklmn${lastFour}`].join('_');
}

const LIVE_STRIPE = fakeKey('sk', 'live', '9003');
const TEST_STRIPE = fakeKey('sk', 'test', '9004');
const LIVE_PUBLISHABLE = fakeKey('pk', 'live', '9006');
const TEST_PUBLISHABLE = fakeKey('pk', 'test', '9007');
const RESEND = ['re', 'FAKEabcdefghijklmnop9005'].join('_');

const SECURE_HEADERS = {
  'strict-transport-security': 'max-age=63072000',
  'content-security-policy': "default-src 'self'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'strict-origin-when-cross-origin',
};

type Mode = 'live' | 'test';

function envFor(mode: Mode): NodeJS.ProcessEnv {
  const live = mode === 'live';
  return {
    API_URL: API,
    WEB_URL: WEB,
    NEON_AUTH_BASE_URL: `https://${AUTH_HOST}/neondb/auth`,
    NEON_AUTH_DATABASE_URL: live
      ? 'postgresql://ep-x-pooler.us-east-2.aws.neon.tech/db'
      : 'postgresql://ep-other.us-east-2.aws.neon.tech/db',
    STRIPE_SECRET_KEY: live ? LIVE_STRIPE : TEST_STRIPE,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: live ? LIVE_PUBLISHABLE : TEST_PUBLISHABLE,
    RESEND_API_KEY: RESEND,
    EMAIL_FROM: `${BRAND_NAME} <noreply@orla.test>`,
    STORAGE_PUBLIC_URL: live ? NEON_UPLOADS : 'https://pub-x.r2.dev',
    DATABASE_URL: 'postgresql://ep-x.us-east-2.aws.neon.tech/db',
    NEON_BRANCH: live ? 'production' : 'dev',
    SENTRY_DSN: live ? 'https://abc123@o1.ingest.sentry.io/42' : 'https://...@sentry.io/...',
    OPERATOR_ALERT_EMAIL: live ? 'ops@orla.test' : 'operator@...',
    SUPPORT_EMAIL_TO: live ? 'help@orla.test' : '',
    RATE_LIMIT_MAX: live ? '120' : '100000',
  };
}

interface Call {
  readonly method: string;
  readonly url: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Provider doubles: one fake `fetch` answering Neon Auth, Stripe, Resend and the app. */
function doubles(mode: Mode, events: readonly string[] = HANDLED): { get: HttpGet; calls: Call[] } {
  const live = mode === 'live';
  const calls: Call[] = [];

  const fetchDouble = async (url: string, init: RequestInit): Promise<Response> => {
    calls.push({ method: init.method ?? 'GET', url });
    const { hostname, pathname } = new URL(url);

    if (hostname === AUTH_HOST && pathname === '/neondb/auth/.well-known/jwks.json') {
      return json({ keys: live ? [{ kty: 'OKP', kid: 'k1' }] : [] });
    }
    if (hostname === 'api.stripe.com' && pathname === '/v1/webhook_endpoints') {
      return json({
        data: [
          {
            url: live ? `${API}/webhooks/stripe` : 'https://old.example/webhooks/stripe',
            status: 'enabled',
            enabled_events: events,
          },
        ],
      });
    }
    if (hostname === 'api.stripe.com' && pathname === '/v1/account') {
      return json({
        charges_enabled: live,
        payouts_enabled: live,
        settings: { payments: { statement_descriptor: live ? 'ORLA EVENTS' : null } },
        business_profile: { name: live ? BRAND_NAME : 'Sandbox' },
      });
    }
    if (hostname === 'api.resend.com' && pathname === '/domains') {
      return json({ data: [{ name: 'orla.test', status: live ? 'verified' : 'pending' }] });
    }
    if (url === `${API}/ready`) {
      return json({ status: live ? 'ready' : 'not_ready' }, live ? 200 : 503);
    }
    if (url === WEB) {
      return new Response('<html></html>', { status: 200, headers: live ? SECURE_HEADERS : {} });
    }
    return json({ error: 'not found' }, 404);
  };

  return { get: readOnlyGet(fetchDouble), calls };
}

function databaseDouble(mode: Mode): LaunchDatabase {
  const live = mode === 'live';
  return {
    seedRowCounts: async () =>
      live ? { marketing: 0, demo: 0, e2e: 0 } : { marketing: 16, demo: 0, e2e: 1 },
    pendingMigrations: async () => (live ? [] : ['0043_past_joshua_kane']),
    maxBookingCents: async () => (live ? 500_000 : null),
  };
}

function options(mode: Mode, overrides: Partial<LaunchOptions> = {}): LaunchOptions {
  return {
    env: envFor(mode),
    get: doubles(mode).get,
    database: databaseDouble(mode),
    handledStripeEvents: HANDLED,
    ...overrides,
  };
}

function find(results: readonly LaunchResult[], name: string): LaunchResult {
  const result = results.find((entry) => entry.name === name);
  if (!result) {
    throw new Error(`no result named ${name}`);
  }
  return result;
}

describe('launch:check against test-mode doubles', () => {
  it('fails every provider check, naming the value it found', async () => {
    const results = await runLaunchChecks(options('test'));

    expect(find(results, 'neon auth endpoint')).toMatchObject({
      status: 'FAIL',
      detail: `no signing keys (HTTP 200) (expected a JWKS with a key)`,
    });
    expect(find(results, 'neon auth identity store')).toMatchObject({
      status: 'FAIL',
      detail:
        'identities read from ep-other.us-east-2.aws.neon.tech (expected the API database host)',
    });
    expect(find(results, 'stripe key')).toMatchObject({
      status: 'FAIL',
      detail: 'sk_test_…9004 (expected sk_live_)',
    });
    expect(find(results, 'stripe webhook endpoint')).toMatchObject({
      status: 'FAIL',
      detail: `no enabled endpoint at ${API}/webhooks/stripe (found https://old.example/webhooks/stripe)`,
    });
    expect(find(results, 'stripe charges_enabled').detail).toBe('false (expected true)');
    expect(find(results, 'stripe payouts_enabled').detail).toBe('false (expected true)');
    expect(find(results, 'stripe statement descriptor')).toMatchObject({
      status: 'FAIL',
      detail: 'unset (expected the name customers see on their card statement)',
    });
    expect(find(results, 'stripe business name')).toMatchObject({
      status: 'FAIL',
      detail: `Sandbox (expected ${BRAND_NAME})`,
    });
    expect(find(results, 'resend sending domain')).toMatchObject({
      status: 'FAIL',
      detail: 'orla.test is pending (expected verified)',
    });
    expect(find(results, 'database branch')).toMatchObject({
      status: 'FAIL',
      detail: 'dev (expected production)',
    });
    expect(find(results, 'seeded rows').detail).toBe('marketing 16, demo 0, e2e 1 (expected 0)');
    expect(find(results, 'migrations').detail).toBe('1 pending: 0043_past_joshua_kane');
    expect(find(results, 'SENTRY_DSN').detail).toBe(
      'still the placeholder https://...@sentry.io/...',
    );
    expect(find(results, 'OPERATOR_ALERT_EMAIL').detail).toBe('still the placeholder operator@...');
    expect(find(results, 'SUPPORT_EMAIL_TO').detail).toBe('unset');
    expect(find(results, 'RATE_LIMIT_MAX').detail).toBe('100000 (expected 30–1000)');
    expect(find(results, 'api /ready').detail).toBe('503 (expected 200)');
    expect(find(results, 'web security headers').detail).toBe(
      'missing strict-transport-security, content-security-policy, x-content-type-options, x-frame-options, referrer-policy',
    );

    const report = renderLaunchReport(results);
    expect(report.failures).toBeGreaterThan(0);
    expect(report.lines).toContain('  FAIL    stripe key: sk_test_…9004 (expected sk_live_)');
  });

  it('fails a loopback image host', async () => {
    const env = { ...envFor('live'), STORAGE_PUBLIC_URL: 'http://localhost:9000/uploads' };
    const results = await runLaunchChecks(options('live', { env }));

    expect(find(results, 'STORAGE_PUBLIC_URL')).toMatchObject({
      status: 'FAIL',
      detail: 'http://localhost:9000/uploads is a local address (expected the Neon storage host)',
    });
  });

  it('fails a storage endpoint that is still on R2', async () => {
    const env = {
      ...envFor('live'),
      STORAGE_ENDPOINT: 'https://acct.r2.cloudflarestorage.com',
    };
    const results = await runLaunchChecks(options('live', { env }));

    expect(find(results, 'STORAGE_PUBLIC_URL')).toMatchObject({
      status: 'FAIL',
      detail:
        'STORAGE_ENDPOINT https://acct.r2.cloudflarestorage.com is an R2 host (writes would miss the Neon bucket)',
    });
  });

  it('fails an image host that is still on R2', async () => {
    const results = await runLaunchChecks(options('test'));

    expect(find(results, 'STORAGE_PUBLIC_URL')).toMatchObject({
      status: 'FAIL',
      detail: 'https://pub-x.r2.dev is an R2 host (uploads are stored on Neon Object Storage)',
    });
  });
});

describe('the Stripe browser and server keys', () => {
  it('fails a live secret key beside a test-mode publishable key', async () => {
    const env = { ...envFor('live'), NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: TEST_PUBLISHABLE };
    const results = await runLaunchChecks(options('live', { env }));

    expect(find(results, 'stripe key').status).toBe('PASS');
    expect(find(results, 'stripe publishable key')).toMatchObject({
      status: 'FAIL',
      detail: 'pk_test_…9007 (expected pk_live_)',
    });
  });

  it('fails an unset publishable key', async () => {
    const env = { ...envFor('live'), NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: undefined };
    const results = await runLaunchChecks(options('live', { env }));

    expect(find(results, 'stripe publishable key')).toMatchObject({
      status: 'FAIL',
      detail: 'unset (expected pk_live_)',
    });
  });

  it('passes a live pair', async () => {
    const results = await runLaunchChecks(options('live'));

    expect(find(results, 'stripe publishable key')).toMatchObject({
      status: 'PASS',
      detail: 'pk_live_…9006',
    });
  });
});

describe('launch:check against correctly configured doubles', () => {
  it('passes everything and reports no failures', async () => {
    const results = await runLaunchChecks(options('live'));
    const report = renderLaunchReport(results);

    expect(results.filter((result) => result.status === 'FAIL')).toEqual([]);
    expect(report.failures).toBe(0);
    expect(find(results, 'stripe key').detail).toBe('sk_live_…9003');
    expect(find(results, 'neon auth endpoint').detail).toBe('1 signing key(s) served');
    expect(find(results, 'neon auth identity store').detail).toBe(
      'identities read from ep-x.us-east-2.aws.neon.tech',
    );
  });

  it('reads the booking cap, and reports invite-only as SKIP until VEN-406 lands', async () => {
    const results = await runLaunchChecks(options('live'));

    expect(find(results, 'platform_settings.vendorInviteOnly').status).toBe('SKIP');
    expect(find(results, 'platform_settings.maxBookingCents')).toMatchObject({
      status: 'PASS',
      detail: '500000',
    });
  });

  it('fails an uncapped platform for a beta release', async () => {
    const results = await runLaunchChecks(options('test'));

    expect(find(results, 'platform_settings.maxBookingCents')).toMatchObject({
      status: 'FAIL',
      detail: 'unset (expected a booking cap for a beta release)',
    });
  });

  it('turns an unreachable provider into a failure rather than a crash', async () => {
    const get: HttpGet = async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    };
    const results = await runLaunchChecks(options('live', { get }));

    expect(find(results, 'neon auth endpoint')).toMatchObject({
      status: 'FAIL',
      detail: 'getaddrinfo ENOTFOUND',
    });
    expect(find(results, 'stripe account').status).toBe('FAIL');
    expect(find(results, 'resend sending domain').status).toBe('FAIL');
    // A read that needs no network still reports on its own.
    expect(find(results, 'stripe key').status).toBe('PASS');
  });

  it('fails the database checks when no database is configured', async () => {
    const results = await runLaunchChecks(options('live', { database: null }));

    expect(find(results, 'database')).toMatchObject({
      status: 'FAIL',
      detail: 'DATABASE_URL is unset, so seeded rows and migrations cannot be read',
    });
  });
});

describe('the Stripe webhook subscription', () => {
  it('names the one handled type an endpoint is missing', async () => {
    const results = await runLaunchChecks(
      options('live', { get: doubles('live', HANDLED.slice(1)).get }),
    );

    expect(find(results, 'stripe webhook endpoint')).toMatchObject({
      status: 'FAIL',
      detail: 'missing account.updated',
    });
  });

  const endpointsGet = (...events: string[][]): HttpGet => {
    const data = events.map((enabled_events) => ({
      url: `${API}/webhooks/stripe`,
      status: 'enabled',
      enabled_events,
    }));

    return async () => ({ status: 200, headers: new Headers(), body: { data } });
  };

  /**
   * The environment of a deployment that has created the second endpoint. Key
   * and value are assembled here so no signing-secret literal sits in the source.
   */
  const withSecondEndpoint = (): Record<string, string | undefined> => ({
    ...envFor('live'),
    [['STRIPE_CONNECT', 'WEBHOOK', 'SECRET'].join('_')]: ['whsec', 'second', 'endpoint'].join('_'),
  });

  it('fails two endpoints at the API URL while no connected-account secret is configured', async () => {
    const results = await runLaunchChecks(options('live', { get: endpointsGet(['*'], ['*']) }));

    expect(find(results, 'stripe webhook endpoint')).toMatchObject({
      status: 'FAIL',
      detail: `2 enabled endpoints at ${API}/webhooks/stripe (expected 1 — the API verifies one STRIPE_WEBHOOK_SECRET; set STRIPE_CONNECT_WEBHOOK_SECRET for a connected-account endpoint)`,
    });
    expect(find(results, 'stripe connected-account events').status).toBe('MANUAL');
  });

  it('counts endpoints per configured secret: two endpoints covering the types between them pass', async () => {
    const results = await runLaunchChecks(
      options('live', {
        env: withSecondEndpoint(),
        get: endpointsGet(HANDLED.slice(0, 2), HANDLED.slice(2)),
      }),
    );

    expect(find(results, 'stripe webhook endpoint').status).toBe('PASS');
    expect(find(results, 'stripe connected-account events').status).toBe('PASS');
  });

  it('names the types neither of two endpoints receives', async () => {
    const results = await runLaunchChecks(
      options('live', {
        env: withSecondEndpoint(),
        get: endpointsGet(HANDLED.slice(0, 1), HANDLED.slice(1, 2)),
      }),
    );

    expect(find(results, 'stripe webhook endpoint')).toMatchObject({
      status: 'FAIL',
      detail: `missing ${HANDLED.slice(2).join(', ')}`,
    });
    expect(find(results, 'stripe connected-account events').status).toBe('MANUAL');
  });

  it('fails a single endpoint once a connected-account secret says there should be two', async () => {
    const results = await runLaunchChecks(
      options('live', { env: withSecondEndpoint(), get: endpointsGet(['*']) }),
    );

    expect(find(results, 'stripe webhook endpoint')).toMatchObject({
      status: 'FAIL',
      detail: `1 enabled endpoints at ${API}/webhooks/stripe (expected 2 — the API verifies STRIPE_WEBHOOK_SECRET and STRIPE_CONNECT_WEBHOOK_SECRET, one per endpoint)`,
    });
  });

  it('asks for a manual look when a sending-only Resend key cannot list domains', async () => {
    const live = doubles('live').get;
    const get: HttpGet = async (url, headers) =>
      url.startsWith('https://api.resend.com/')
        ? { status: 401, headers: new Headers(), body: { name: 'restricted_api_key' } }
        : live(url, headers);
    const results = await runLaunchChecks(options('live', { get }));

    expect(find(results, 'resend sending domain')).toMatchObject({
      status: 'MANUAL',
      detail:
        'RESEND_API_KEY cannot list domains (HTTP 401) — confirm orla.test is verified in the Resend dashboard',
    });
  });

  it('accepts the registry default support address when production states it', async () => {
    const results = await runLaunchChecks(
      options('live', { env: { ...envFor('live'), SUPPORT_EMAIL_TO: 'support@orla.com' } }),
    );

    expect(find(results, 'SUPPORT_EMAIL_TO')).toMatchObject({ status: 'PASS', detail: 'set' });
  });

  it('accepts a wildcard subscription', async () => {
    const results = await runLaunchChecks(options('live', { get: doubles('live', ['*']).get }));

    expect(find(results, 'stripe webhook endpoint').status).toBe('PASS');
  });

  /*
   * These two import real source from other workspaces, and the first import
   * transforms the API's whole module graph. That took 5.0s on a CI runner
   * sharing the turbo test fan-out (PR #181) — bounded compile work with no
   * waiting in it, so the budget is widened rather than the import faked.
   */
  const IMPORTS_REPO_SOURCE = { timeout: 30_000 };

  it(
    'requires every type the route module handles, read from the module itself',
    IMPORTS_REPO_SOURCE,
    async () => {
      const handled = await loadHandledStripeEvents(REPO_ROOT);

      expect(handled).toEqual([
        'account.updated',
        'capability.updated',
        'payment_intent.succeeded',
        'charge.refunded',
        'charge.dispute.created',
        'charge.dispute.closed',
        'charge.dispute.funds_reinstated',
        'refund.failed',
        'refund.updated',
        'charge.refund.updated',
      ]);

      // Mutation: a type added to the route's set is one the check now demands.
      const results = await runLaunchChecks(
        options('live', {
          handledStripeEvents: [...handled, 'invoice.paid'],
          get: doubles('live', handled).get,
        }),
      );

      expect(find(results, 'stripe webhook endpoint').detail).toBe('missing invoice.paid');
    },
  );

  it('reads the seed markers from the seed modules', IMPORTS_REPO_SOURCE, async () => {
    await expect(loadSeedMarkers(REPO_ROOT)).resolves.toEqual({
      marketingPrefix: 'seed_mkt_',
      demoPrefix: 'seed_demo_',
      e2eVendorSlug: 'e2e-test-studio',
    });
  });
});

describe('secrets and read-only access', () => {
  it('never prints a secret, only its prefix and last four', async () => {
    const text = [
      ...renderLaunchReport(await runLaunchChecks(options('test'))).lines,
      ...renderLaunchReport(await runLaunchChecks(options('live'))).lines,
    ].join('\n');

    expect(text).not.toContain('FAKEabcdefghijklmn');
    expect(text).toContain('sk_live_…9003');
    expect(text).toContain('sk_test_…9004');
  });

  it('masks to the prefix and the last four', () => {
    expect(mask(LIVE_STRIPE)).toBe('sk_live_…9003');
    expect(mask(RESEND)).toBe('re_…9005');
    expect(mask(['sk', 'live', 'short'].join('_'))).toBe('sk_live_…');
  });

  it('sends only GET requests to every provider double', async () => {
    for (const mode of ['test', 'live'] as const) {
      const { get, calls } = doubles(mode);
      await runLaunchChecks(options(mode, { get }));

      expect(calls.length).toBeGreaterThan(5);
      expect(new Set(calls.map((call) => call.method))).toEqual(new Set(['GET']));
    }
  });
});
