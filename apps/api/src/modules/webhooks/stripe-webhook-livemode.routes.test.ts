import { operatorAlerts } from '@vendor-marketplace/db/schema';
import { Writable } from 'node:stream';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createTestHarness, TEST_ENV, type TestHarness } from '../../testing/test-server.js';

/** Assembled at runtime so no literal here reads as a real credential. */
const keyFor = (mode: 'live' | 'test'): string => ['sk', mode, 'FAKEabcdefghijklmn9009'].join('_');

/**
 * A signing secret carries no mode, so a test-mode secret beside a live key
 * verifies real test events that every `retrieve*` then 404s. The mode has to
 * be read off the verified event (VEN-491).
 */
describe.each([
  { keyMode: 'test', eventLivemode: true },
  { keyMode: 'live', eventLivemode: false },
] as const)('POST /webhooks/stripe with a $keyMode key', ({ keyMode, eventLivemode }) => {
  let harness: TestHarness;
  const lines: string[] = [];
  const collector = new Writable({
    write(chunk: Buffer | string, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });

  beforeAll(async () => {
    harness = await createTestHarness({
      env: { STRIPE_SECRET_KEY: keyFor(keyMode), LOG_LEVEL: 'warn' },
      loggerStream: collector,
    });
  });

  afterEach(async () => {
    lines.length = 0;
    harness.email.sent.length = 0;
    await harness.database.db.delete(operatorAlerts);
  });

  afterAll(async () => {
    await harness.close();
  });

  function post() {
    return harness.app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'stripe-signature': 'valid-signature', 'content-type': 'application/json' },
      payload: JSON.stringify({ id: 'evt_test' }),
    });
  }

  it(`acknowledges and ignores a livemode: ${eventLivemode} event, logging both modes`, async () => {
    harness.stripe.nextEvent = {
      type: 'payment_intent.succeeded',
      accountId: null,
      objectId: 'pi_x',
      livemode: eventLivemode,
    };

    const response = await post();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true, outcome: 'ignored' });
    const record = lines
      .map((line) => JSON.parse(line) as Record<string, unknown>)
      .find(
        (entry) =>
          entry.msg === 'Ignored a Stripe webhook whose livemode disagrees with the API key',
      );
    expect(record).toMatchObject({
      eventMode: eventLivemode ? 'live' : 'test',
      keyMode,
    });

    // Only the direction that drops real money pages the operator.
    await harness.flushEmail();
    const paged = harness.email.sent.filter(
      (message) => message.to === TEST_ENV.OPERATOR_ALERT_EMAIL,
    );
    expect(paged).toHaveLength(eventLivemode ? 1 : 0);
    if (eventLivemode) {
      expect(paged[0]!.subject).toContain('Live Stripe events are being ignored');
    }
  });

  it('handles a matching event as before', async () => {
    harness.stripe.nextEvent = {
      type: 'charge.refunded',
      accountId: null,
      objectId: 'ch_pi_unknown',
      livemode: keyMode === 'live',
    };

    const response = await post();

    expect(response.statusCode).toBe(200);
    expect(response.json().outcome).not.toBe('ignored');
    expect(lines.join('')).not.toContain('livemode disagrees');
  });
});
