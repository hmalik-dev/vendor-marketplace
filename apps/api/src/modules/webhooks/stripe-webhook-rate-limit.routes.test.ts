import { operatorAlerts, stripeWebhookFailures } from '@vendor-marketplace/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';

describe('Stripe webhook rate limiting', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createTestHarness({ env: { RATE_LIMIT_MAX: 2 } });
  });

  afterAll(async () => {
    await harness.database.db.delete(operatorAlerts);
    await harness.database.db.delete(stripeWebhookFailures);
    await harness.close();
  });

  it('counts a burst of 429s as webhook failures and alerts on the threshold', async () => {
    harness.stripe.nextEvent = { type: 'customer.created', accountId: null, objectId: null };
    const statuses: number[] = [];

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await harness.app.inject({
        method: 'POST',
        url: '/webhooks/stripe',
        headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
        payload: JSON.stringify({ id: 'evt_burst', object: 'event' }),
      });
      statuses.push(response.statusCode);
    }
    await harness.flushEmail();

    expect(statuses).toEqual([200, 200, 429, 429, 429]);
    expect(
      harness.email.sent
        .filter((message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL)
        .map((message) => message.subject),
    ).toEqual(['[Orla ops] Stripe webhook rate limited 3 times in 10 minutes']);
  });
});
