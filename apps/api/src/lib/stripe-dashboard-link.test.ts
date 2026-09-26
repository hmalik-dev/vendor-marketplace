import type * as StripeModule from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Calls {
  dashboard: 'express' | 'full' | 'none';
  loginLinks: string[];
  accountLinks: unknown[];
  refusal: Error | null;
}

const calls = vi.hoisted<Calls>(() => ({
  dashboard: 'none',
  loginLinks: [],
  accountLinks: [],
  refusal: null,
}));

vi.mock('stripe', async () => {
  const actual = await vi.importActual<typeof StripeModule>('stripe');

  class FakeStripe {
    static API_VERSION = actual.default.API_VERSION;
    static errors = actual.default.errors;
    accounts = {
      createLoginLink: async (accountId: string): Promise<{ url: string }> => {
        calls.loginLinks.push(accountId);

        if (calls.refusal) {
          throw calls.refusal;
        }

        return { url: `https://connect.stripe.com/express/${accountId}/login` };
      },
    };
    v2 = {
      core: {
        accounts: {
          retrieve: async (accountId: string) => ({ id: accountId, dashboard: calls.dashboard }),
        },
        accountLinks: {
          create: async (params: unknown): Promise<{ url: string }> => {
            calls.accountLinks.push(params);

            if (calls.refusal) {
              throw calls.refusal;
            }

            return { url: 'https://connect.stripe.com/setup/e/acct_1/update' };
          },
        },
      },
    };
  }

  return { default: FakeStripe };
});

const { default: RealStripe } = await vi.importActual<typeof StripeModule>('stripe');
const { createStripeConnectGateway, DashboardLinkUnavailableError } = await import('./stripe.js');

const INPUT = {
  accountId: 'acct_1',
  returnUrl: 'https://orla.test/vendor/payments',
  refreshUrl: 'https://orla.test/vendor/payments',
};

/** What Stripe answered for the E2E vendor's account (VEN-782, request `req_oSjCfk89xkJad4`). */
const NO_EXPRESS_DASHBOARD = {
  type: 'invalid_request_error',
  statusCode: 400,
  message:
    'Cannot create an edit link for the account acct_1, which does not have access to the Express Dashboard.',
} as const;

function gateway() {
  return createStripeConnectGateway({
    secretKey: 'sk_test_unused',
    deployEnv: 'development',
    webhookSecret: 'unused',
  });
}

beforeEach(() => {
  calls.dashboard = 'none';
  calls.loginLinks.length = 0;
  calls.accountLinks.length = 0;
  calls.refusal = null;
});

describe('the link a vendor manages their payout account through (VEN-725, VEN-782)', () => {
  it('logs an Express account into its dashboard', async () => {
    calls.dashboard = 'express';

    await expect(gateway().createDashboardLink(INPUT)).resolves.toEqual({
      url: 'https://connect.stripe.com/express/acct_1/login',
    });
    expect(calls.accountLinks).toEqual([]);
  });

  it('sends an account with no Stripe dashboard to the hosted update form', async () => {
    await expect(gateway().createDashboardLink(INPUT)).resolves.toEqual({
      url: 'https://connect.stripe.com/setup/e/acct_1/update',
    });
    expect(calls.loginLinks).toEqual([]);
    expect(calls.accountLinks).toEqual([
      {
        account: 'acct_1',
        use_case: {
          type: 'account_update',
          account_update: {
            configurations: ['recipient'],
            return_url: 'https://orla.test/vendor/payments',
            refresh_url: 'https://orla.test/vendor/payments',
          },
        },
      },
    ]);
  });

  it('turns a 400 refusing the login link into DashboardLinkUnavailableError', async () => {
    calls.dashboard = 'express';
    calls.refusal = new RealStripe.errors.StripeInvalidRequestError(NO_EXPRESS_DASHBOARD);

    const failure = await gateway()
      .createDashboardLink(INPUT)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DashboardLinkUnavailableError);
    expect((failure as Error).message).toBe(NO_EXPRESS_DASHBOARD.message);
  });

  it('turns a 400 refusing the update link into DashboardLinkUnavailableError', async () => {
    calls.refusal = new RealStripe.errors.StripeInvalidRequestError({
      ...NO_EXPRESS_DASHBOARD,
      message: 'You cannot create an account_update link for this account.',
    });

    await expect(gateway().createDashboardLink(INPUT)).rejects.toBeInstanceOf(
      DashboardLinkUnavailableError,
    );
  });

  it('lets an outage through unchanged, so the page still offers a retry', async () => {
    calls.dashboard = 'express';
    const outage = new RealStripe.errors.StripeAPIError({
      type: 'api_error',
      statusCode: 500,
      message: 'Internal error',
    });
    calls.refusal = outage;

    await expect(gateway().createDashboardLink(INPUT)).rejects.toBe(outage);
  });
});
