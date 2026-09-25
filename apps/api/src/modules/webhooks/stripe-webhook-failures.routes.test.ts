import { adminAlerts, stripeWebhookFailures } from '@vendor-marketplace/db/schema';
import {
  ADMIN_ALERT_DEDUPE_MS,
  STRIPE_WEBHOOK_FAILURE_WINDOW_MS,
} from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';

/**
 * VEN-430: the webhook's own failures reach the admin even when they are
 * spaced out or drowned in junk traffic.
 */
describe('Stripe webhook failure alerts', () => {
  let harness: TestHarness;
  let now = new Date('2026-09-19T12:00:00Z');

  const subjects = () =>
    harness.email.sent
      .filter((message) => message.to === TEST_ENV.ADMIN_ALERT_EMAIL)
      .map((message) => message.subject);

  async function post(headers: Record<string, string>) {
    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json', ...headers },
      payload: JSON.stringify({ id: 'evt_x', object: 'event' }),
    });
    await harness.flushEmail();
    return response;
  }

  beforeAll(async () => {
    harness = await createTestHarness({ clock: () => now });
  });

  afterEach(async () => {
    await harness.database.db.delete(adminAlerts);
    await harness.database.db.delete(stripeWebhookFailures);
    harness.email.sent.length = 0;
    harness.stripe.nextEvent = { type: 'v2.core.account.updated', accountId: null, objectId: null };
    now = new Date('2026-09-19T12:00:00Z');
  });

  afterAll(async () => {
    await harness.close();
  });

  it('alerts on a single event that keeps failing, hours apart, inside the persisted window', async () => {
    harness.stripe.nextEvent = {
      type: 'charge.dispute.created',
      accountId: null,
      objectId: 'dp_never_found',
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post({ 'stripe-signature': 'valid-signature' })).statusCode).toBe(500);
      expect(subjects()).toHaveLength(attempt === 2 ? 1 : 0);
      // Well past the in-process window, well inside Stripe's redelivery schedule.
      now = new Date(now.getTime() + 4 * STRIPE_WEBHOOK_FAILURE_WINDOW_MS);
    }

    expect(subjects()).toEqual(['[Orla ops] Stripe webhook failed 3 times in 24 hours']);
  });

  it('does not let anonymous no-signature requests suppress an invalid-signature alert', async () => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post({})).statusCode).toBe(401);
    }
    expect(subjects()).toEqual([
      '[Orla ops] Stripe webhook refused without a signature 3 times in 10 minutes',
    ]);

    now = new Date(now.getTime() + ADMIN_ALERT_DEDUPE_MS / 2);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await post({ 'stripe-signature': 'forged-signature' })).statusCode).toBe(401);
    }

    expect(subjects()).toEqual([
      '[Orla ops] Stripe webhook refused without a signature 3 times in 10 minutes',
      '[Orla ops] Stripe webhook refused 3 times in 10 minutes',
    ]);
  });
});
