import { beforeEach, describe, expect, it, vi } from 'vitest';

const constructed = vi.hoisted(() => [] as unknown[][]);

vi.mock('stripe', () => {
  class FakeStripe {
    static API_VERSION = '2026-08-26.dahlia';
    constructor(...args: unknown[]) {
      constructed.push(args);
    }
  }
  return { default: FakeStripe };
});

const { STRIPE_API_VERSION, createStripeClient, createStripeConnectGateway } =
  await import('./stripe.js');

describe('the Stripe client construction', () => {
  beforeEach(() => {
    constructed.length = 0;
  });

  it('passes the pinned API version explicitly, not the SDK default', () => {
    createStripeClient('sk_test_unused');

    expect(constructed).toEqual([
      ['sk_test_unused', { apiVersion: STRIPE_API_VERSION, timeout: 10_000, maxNetworkRetries: 1 }],
    ]);
  });

  it('builds the gateway on that client', () => {
    const credentials: Parameters<typeof createStripeConnectGateway>[0] = {
      secretKey: 'sk_test_unused',
      deployEnv: 'staging',
      webhookSecret: 'unused',
    };
    createStripeConnectGateway(credentials);

    /*
     * The one client behind the payout claim, the dispute unwind and checkout,
     * so one retry at most holds for all three (VEN-607).
     */
    expect(constructed).toEqual([
      ['sk_test_unused', { apiVersion: STRIPE_API_VERSION, timeout: 10_000, maxNetworkRetries: 1 }],
    ]);
  });
});
