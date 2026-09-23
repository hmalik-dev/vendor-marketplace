import * as Sentry from '@sentry/node';
import { categories, users, vendorProfiles } from '@vendor-marketplace/db/schema';
import { CURRENT_VENDOR_AGREEMENT_VERSION, PAYMENT_ERROR_TAGS } from '@vendor-marketplace/shared';
import Fastify from 'fastify';
import fp from 'fastify-plugin';
import { afterAll, describe, expect, it } from 'vitest';
import { errorHandlerPlugin } from '../plugins/error-handler.js';
import { payoutReleasePlugin } from '../plugins/payout-release.js';
import { bearer, createTestHarness } from '../testing/test-server.js';
import {
  type ErrorContext,
  type ErrorReporter,
  sentryErrorReporter,
  sentryOptions,
} from './error-reporting.js';

const DSN = 'https://abc123@o1.ingest.sentry.io/42';
const EMAIL = ['vendor', 'example.com'].join('@');

function recordingReporter(): ErrorReporter & {
  captured: { error: unknown; context: ErrorContext }[];
} {
  const captured: { error: unknown; context: ErrorContext }[] = [];
  return { captured, capture: (error, context = {}) => captured.push({ error, context }) };
}

describe('sentryOptions', () => {
  it('turns reporting off when there is no DSN, which only a laptop may have', () => {
    expect(sentryOptions({ SENTRY_DSN: undefined, DEPLOY_ENV: 'local' }, {})).toBeNull();
  });

  it('samples explicitly and sends no default PII', () => {
    const options = sentryOptions({ SENTRY_DSN: DSN, DEPLOY_ENV: 'local' }, {})!;

    expect(options.sampleRate).toBe(1);
    expect(options.tracesSampleRate).toBe(0.05);
    expect(options.sendDefaultPii).toBe(false);
  });

  /*
   * The deploy workflow sets `SENTRY_RELEASE: ${{ github.event.workflow_run.head_sha }}`
   * on the API deploy step (`scripts/deploy.test.mjs` pins that), and this is
   * the value the SDK reports as the release.
   */
  it('reports the release identifier the deploy workflow sets', () => {
    const options = sentryOptions(
      { SENTRY_DSN: DSN, DEPLOY_ENV: 'production' },
      { SENTRY_RELEASE: 'a1b2c3d', RAILWAY_GIT_COMMIT_SHA: 'platform-sha', NODE_ENV: 'production' },
    )!;

    expect(options.release).toBe('a1b2c3d');
    expect(options.environment).toBe('production');
  });

  it.each(['local', 'staging', 'production'])(
    'reports the declared tier %s as the Sentry environment, whatever the platform says',
    (tier) => {
      // A deployed staging sees NODE_ENV=production too; only DEPLOY_ENV tells it apart.
      const options = sentryOptions(
        { SENTRY_DSN: DSN, DEPLOY_ENV: tier },
        { NODE_ENV: 'production' },
      )!;

      expect(options.environment).toBe(tier);
    },
  );
});

describe('what the API scrubs, at beforeSend', () => {
  const TICKET = 'Zk3xQ9vL2mN8pR4tY7wB1cD5fG6hJ0kA_s-Ue3XoIiE';
  const KEY = ['sk', 'live', 'fixtureLiveKeyValue0123'].join('_');
  const SIGNING = ['whsec', 'fixtureSigningSecret0123'].join('_');
  const PHONE = '(415) 555-0132';
  const ACCOUNT = ['acct', '1Fixture0Account'].join('_');

  it('leaves no email, phone, credential, cookie or stream ticket in the event', () => {
    const options = sentryOptions({ SENTRY_DSN: DSN, DEPLOY_ENV: 'local' }, {})!;
    const event: Sentry.ErrorEvent = {
      type: undefined,
      message: `${EMAIL} ${PHONE} ${KEY} ${SIGNING}`,
      request: {
        url: `https://api.example.test/stream?ticket=${TICKET}`,
        headers: { Authorization: `Bearer ${KEY}`, Cookie: '__session=abc' },
        cookies: { __session: 'abc' },
      },
      breadcrumbs: [
        { category: 'http', data: { url: `/v1/stream?ticket=${TICKET}` } },
        { message: `paid out to ${ACCOUNT}` },
      ],
    };
    const serialized = JSON.stringify(options.beforeSend!(event, {}));

    for (const leaked of [EMAIL, PHONE, KEY, SIGNING, TICKET, ACCOUNT, '__session=abc']) {
      expect(serialized).not.toContain(leaked);
    }
    expect(serialized).toContain('[redacted]');
  });
});

/*
 * Through the real SDK, asserted at the scrubbing hook: `beforeSend` sees the
 * event exactly as it would leave the process, and returning `null` from the
 * recorder means nothing is sent — no network, and no mock of Sentry.
 */
describe('what the API reports, at the scrubbing hook', () => {
  it('carries the user id and payment tags, the workflow release, and no email or token', async () => {
    const options = sentryOptions(
      { SENTRY_DSN: DSN, DEPLOY_ENV: 'local' },
      { SENTRY_RELEASE: 'a1b2c3d' },
    )!;
    const seen: Sentry.ErrorEvent[] = [];

    Sentry.init({
      ...options,
      defaultIntegrations: false,
      beforeSend: (event, hint) => {
        const scrubbed = options.beforeSend!(event, hint) as Sentry.ErrorEvent;
        seen.push(scrubbed);
        return null;
      },
    });
    Sentry.getIsolationScope().setUser({
      id: 'user_2abc',
      email: EMAIL,
      ip_address: '203.0.113.9',
    });

    const session = ['eyJhbGciOiJSUzI1NiJ9', 'eyJzdWIiOiJ1c2VyIn0', 'c2ln'].join('.');
    sentryErrorReporter().capture(new Error(`Transfer failed for ${EMAIL} using ${session}`), {
      userId: 'user_2abc',
      payment: true,
      route: '/v1/vendor/stripe/connect',
    });
    await Sentry.flush(2_000);

    expect(seen).toHaveLength(1);
    const [event] = seen;
    expect(event!.user).toEqual({ id: 'user_2abc' });
    expect(event!.release).toBe('a1b2c3d');
    expect(event!.level).toBe('fatal');
    expect(event!.tags).toMatchObject({
      ...PAYMENT_ERROR_TAGS,
      route: '/v1/vendor/stripe/connect',
    });
    expect(JSON.stringify(event)).not.toContain(EMAIL);
    expect(JSON.stringify(event)).not.toContain(session);
    expect(JSON.stringify(event)).not.toContain('203.0.113.9');

    await Sentry.close();
  });

  /*
   * Sentry is a second log sink, and #445's guard sits on the first one.
   * `DrizzleQueryError`'s message is `Failed query: <sql>\nparams: <every bound
   * value>`, and its stack quotes the same string; the SDK reads both off the
   * error object, so without the same withholding a stranger who makes the
   * public support form's insert fail chooses when their 4,000 characters — and
   * every other value in that statement — are shipped to a third party. The
   * event scrubber cannot catch it: a name or an address is none of the four
   * shapes it knows.
   */
  it("withholds a failed statement's bound values, and keeps what says what broke", async () => {
    const typed = 'Ada Lovelace, 10 Downing Street, 555-0100';
    const sql = 'insert into "support_messages" ("body") values ($1)';
    const options = sentryOptions({ SENTRY_DSN: DSN, DEPLOY_ENV: 'local' }, {})!;
    const seen: Sentry.ErrorEvent[] = [];

    Sentry.init({
      ...options,
      defaultIntegrations: false,
      beforeSend: (event, hint) => {
        seen.push(options.beforeSend!(event, hint) as Sentry.ErrorEvent);
        return null;
      },
    });

    const failed = Object.assign(new Error(`Failed query: ${sql}\nparams: ${typed}`), {
      query: sql,
      params: [typed],
    });
    sentryErrorReporter().capture(failed, { userId: 'user_2abc' });
    await Sentry.flush(2_000);

    expect(seen).toHaveLength(1);
    const serialized = JSON.stringify(seen[0]);
    expect(serialized).not.toContain(typed);
    expect(serialized).not.toContain('555-0100');
    // The half a reader needs survives: the statement and the error's type.
    expect(seen[0]!.exception?.values?.[0]?.value).toBe(`Failed query: ${sql}`);
    expect(seen[0]!.exception?.values?.[0]?.type).toBe('Error');

    await Sentry.close();
  });
});

describe('the error handler reports what the client is not told', () => {
  async function serve(reporter: ErrorReporter) {
    const app = Fastify({ logger: false });
    app.decorateRequest('auth', null);
    app.addHook('onRequest', async (request) => {
      request.auth = { id: 'row-id', authUserId: 'user_2abc', role: 'customer' };
    });
    await app.register(errorHandlerPlugin, {
      reporter,
      paymentRoutes: new Set(['/v1/customer/bookings/:bookingId/cancel']),
    });
    app.post('/v1/customer/bookings/:bookingId/cancel', async () => {
      throw new Error('stripe exploded');
    });
    app.get('/v1/categories', async () => {
      throw new Error('db exploded');
    });
    app.get('/refused', async () => {
      throw Object.assign(new Error('Request file too large'), {
        statusCode: 413,
        code: 'FST_REQ_FILE_TOO_LARGE',
      });
    });
    await app.ready();
    return app;
  }

  it('tags a failure on a payment route as critical, with the caller', async () => {
    const reporter = recordingReporter();
    const app = await serve(reporter);

    const response = await app.inject({ method: 'POST', url: '/v1/customer/bookings/b1/cancel' });

    expect(response.statusCode).toBe(500);
    expect(reporter.captured).toHaveLength(1);
    expect(reporter.captured[0]!.context).toEqual({
      userId: 'user_2abc',
      route: '/v1/customer/bookings/:bookingId/cancel',
      payment: true,
    });
    await app.close();
  });

  it('reports any other 500 untagged, and a refusal the caller caused not at all', async () => {
    const reporter = recordingReporter();
    const app = await serve(reporter);

    await app.inject({ method: 'GET', url: '/v1/categories' });
    await app.inject({ method: 'GET', url: '/v1/refused' });

    expect(reporter.captured.map((entry) => entry.context)).toEqual([
      { userId: 'user_2abc', route: '/v1/categories', payment: false },
    ]);
    await app.close();
  });
});

/*
 * The payment route set is collected from registration, not written out, so
 * this goes through `buildServer`: a Connect call that throws must arrive as a
 * payment error, which only holds if the wiring put that route in the set.
 */
describe('buildServer marks the money routes', () => {
  const reporter = recordingReporter();
  let harness: Awaited<ReturnType<typeof createTestHarness>>;

  afterAll(async () => {
    await harness.database.db.delete(vendorProfiles);
    await harness.database.db.delete(users);
    await harness.close();
  });

  it('reports a failed Connect onboarding as a payment error for the signed-in vendor', async () => {
    harness = await createTestHarness({ errorReporter: reporter });
    harness.authUsers.set('vendor_err', {
      authUserId: 'vendor_err',
      email: EMAIL,
      firstName: 'Test',
      lastName: 'Vendor',
      roleHint: 'vendor',
      avatarUrl: null,
    });
    const [photography] = await harness.database.db.select().from(categories).limit(1);
    const profile = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/profile',
      headers: bearer('vendor_err'),
      payload: {
        businessName: 'First Light',
        categoryIds: [photography!.id],
        city: 'Austin',
        state: 'TX',
        bio: 'First Light does good work.',
        responseTimeHours: 24,
      },
    });
    expect(profile.statusCode).toBe(201);
    const agreed = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/agreement/accept',
      headers: bearer('vendor_err'),
      payload: { version: CURRENT_VENDOR_AGREEMENT_VERSION },
    });
    expect(agreed.statusCode).toBe(200);

    harness.stripe.createRecipientAccount = async () => {
      throw new Error('Stripe is down');
    };
    const response = await harness.app.inject({
      method: 'POST',
      url: '/v1/vendor/stripe/connect',
      headers: bearer('vendor_err'),
    });

    expect(response.statusCode).toBe(500);
    expect(reporter.captured.map((entry) => entry.context)).toEqual([
      { userId: 'vendor_err', route: '/v1/vendor/stripe/connect', payment: true },
    ]);
  });
});

describe('the payout sweep', () => {
  it('reports a failed sweep as a payment error', async () => {
    const reporter = recordingReporter();
    const app = Fastify({ logger: false });
    await app.register(
      fp(
        async (instance) => {
          instance.decorate('clock', () => new Date());
        },
        { name: 'clock' },
      ),
    );
    await app.register(fp(async () => undefined, { name: 'operator-alerts' }));
    // No database decorated, so the sweep's first query throws.
    await app.register(payoutReleasePlugin, {
      intervalMs: 5,
      reporter,
      webOrigin: 'https://web.test',
    });
    await app.ready();

    await expect.poll(() => reporter.captured.length, { timeout: 2_000 }).toBeGreaterThan(0);
    await app.close();

    expect(reporter.captured[0]!.context).toEqual({ payment: true });
  });
});
