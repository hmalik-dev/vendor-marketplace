import { bookings, adminAlerts, supportCases } from '@vendor-marketplace/db/schema';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, type TestHarness } from '../../testing/test-server.js';

const AMOUNT_CENTS = 120_000;

/**
 * VEN-529: staging and production share one Stripe test account, so every event
 * reaches both endpoints. This deployment is staging; `production` is the other.
 */
describe('POST /webhooks/stripe for an object another deployment created', () => {
  let harness: TestHarness;

  function seedIntent(id: string, metadata: Record<string, string>) {
    harness.stripe.paymentIntents.set(id, {
      id,
      status: 'succeeded',
      amountReceivedCents: AMOUNT_CENTS,
      clientSecret: null,
      metadata,
    });
  }

  async function deliver(type: string, objectId: string) {
    harness.stripe.nextEvent = { type, accountId: null, objectId };
    const response = await harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_foreign', object: 'event' }),
    });
    await harness.flushEmail();
    return response;
  }

  async function nobodyWasTold() {
    expect(await harness.database.db.select({ id: adminAlerts.id }).from(adminAlerts)).toEqual([]);
    expect(harness.email.sent).toEqual([]);
  }

  beforeAll(async () => {
    harness = await createTestHarness({ env: { DEPLOY_ENV: 'staging' } });
  });

  afterEach(async () => {
    await harness.database.db.delete(adminAlerts);
    await harness.database.db.delete(supportCases);
    harness.email.sent.length = 0;
    harness.stripe.paymentIntents.clear();
    harness.stripe.disputes.clear();
    harness.stripe.refunds.length = 0;
  });

  afterAll(async () => {
    await harness.close();
  });

  it('acknowledges a succeeded intent tagged for another environment, booking nothing', async () => {
    seedIntent('pi_other_env', { requestId: randomUUID(), env: 'production' });

    const response = await deliver('payment_intent.succeeded', 'pi_other_env');

    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).toBe('ignored');
    expect(await harness.database.db.select({ id: bookings.id }).from(bookings)).toEqual([]);
    await nobodyWasTold();
  });

  it('acknowledges a succeeded intent with no matching request and no environment tag', async () => {
    seedIntent('pi_untagged', { requestId: randomUUID() });

    const response = await deliver('payment_intent.succeeded', 'pi_untagged');

    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).toBe('ignored');
    await nobodyWasTold();
  });

  it('still refuses an intent tagged for this environment whose request is gone', async () => {
    seedIntent('pi_ours_orphan', { requestId: randomUUID(), env: 'staging' });

    const response = await deliver('payment_intent.succeeded', 'pi_ours_orphan');

    expect(response.statusCode).toBe(404);
  });

  it('opens no case and alerts nobody for a dispute on another environment’s charge', async () => {
    seedIntent('pi_other_env', { requestId: randomUUID(), env: 'production' });
    harness.stripe.disputes.set('dp_other_env', {
      id: 'dp_other_env',
      status: 'needs_response',
      reason: 'fraudulent',
      amountCents: AMOUNT_CENTS,
      paymentIntentId: 'pi_other_env',
    });

    const response = await deliver('charge.dispute.created', 'dp_other_env');

    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).toBe('ignored');
    expect(await harness.database.db.select({ id: supportCases.id }).from(supportCases)).toEqual(
      [],
    );
    await nobodyWasTold();
  });

  it('alerts nobody when a refund fails on another environment’s charge', async () => {
    seedIntent('pi_other_env', { requestId: randomUUID(), env: 'production' });
    harness.stripe.refunds.push({
      paymentIntentId: 'pi_other_env',
      amountCents: AMOUNT_CENTS,
      reason: 'requested_by_customer',
      idempotencyKey: undefined,
      reverseTransfer: false,
      refundApplicationFee: false,
      status: 'failed',
    });

    const response = await deliver('refund.failed', 're_test_1');

    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).toBe('refund-unchanged');
    await nobodyWasTold();
  });
});
