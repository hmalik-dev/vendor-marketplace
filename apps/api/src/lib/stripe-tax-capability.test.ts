import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Calls {
  created: unknown[][];
  updated: unknown[][];
  retrieved: string[];
  account: unknown;
  updateRefusal: Error | null;
}

const calls = vi.hoisted<Calls>(() => ({
  created: [],
  updated: [],
  retrieved: [],
  account: {},
  updateRefusal: null,
}));

vi.mock('stripe', () => {
  class FakeStripe {
    static API_VERSION = '2026-08-26.dahlia';
    accounts = {
      retrieve: async (accountId: string): Promise<unknown> => {
        calls.retrieved.push(accountId);

        return calls.account;
      },
      update: async (...args: unknown[]): Promise<unknown> => {
        calls.updated.push(args);

        if (calls.updateRefusal) {
          throw calls.updateRefusal;
        }

        return {};
      },
    };
    v2 = {
      core: {
        accounts: {
          create: async (...args: unknown[]): Promise<{ id: string }> => {
            calls.created.push(args);

            return { id: 'acct_new' };
          },
        },
      },
    };
  }

  return { default: FakeStripe };
});

const { createStripeConnectGateway, taxIdStateFrom, TAX_REPORTING_CAPABILITY } =
  await import('./stripe.js');

const REQUEST = { capabilities: { tax_reporting_us_1099_k: { requested: true } } };

function gateway(deployEnv: 'production' | 'staging' | 'development') {
  return createStripeConnectGateway({
    secretKey: 'sk_test_unused',
    deployEnv,
    webhookSecret: 'unused',
  });
}

/** A partial payload: the function under test reads only the fields a case names. */
const account = (fields: Record<string, unknown>): Stripe.Account =>
  fields as unknown as Stripe.Account;

beforeEach(() => {
  calls.created.length = 0;
  calls.updated.length = 0;
  calls.retrieved.length = 0;
  calls.account = {};
  calls.updateRefusal = null;
});

describe('requesting the 1099-K capability (VEN-723, D49)', () => {
  it.each(['production', 'staging', 'development'] as const)(
    'does not ask for it inside the v2 create in %s: the onboarding flow does, once the account is saved',
    async (deployEnv) => {
      const created = await gateway(deployEnv).createRecipientAccount({
        vendorId: 'vendor-1',
        contactEmail: 'grace@example.com',
        displayName: 'Sunlit Studio',
        idempotencyKey: 'recipient-account:vendor-1:0',
      });

      expect(created).toEqual({ accountId: 'acct_new' });
      expect(calls.updated).toEqual([]);
    },
  );

  it.each(['production', 'staging', 'development'] as const)(
    'requests it in %s for an account without it, with no idempotency key that could replay a refusal, and leaves one that already carries it alone',
    async (deployEnv) => {
      const stripe = gateway(deployEnv);

      calls.account = { capabilities: { transfers: 'inactive' } };
      expect(await stripe.ensureTaxReportingCapability('acct_old')).toBe('requested');
      expect(calls.updated).toEqual([['acct_old', REQUEST]]);

      calls.updated.length = 0;
      calls.account = {
        capabilities: { [TAX_REPORTING_CAPABILITY]: 'inactive', transfers: 'active' },
      };
      expect(await stripe.ensureTaxReportingCapability('acct_old')).toBe('already');
      expect(calls.updated).toEqual([]);
    },
  );
});

describe('taxIdStateFrom', () => {
  it('is Missing until an individual or company tax ID has been given', () => {
    expect(taxIdStateFrom(account({ individual: { id_number_provided: false } }))).toBe('missing');
    expect(taxIdStateFrom(account({}))).toBe('missing');
  });

  it('is Provided once given, while the IRS check has not finished', () => {
    expect(
      taxIdStateFrom(
        account({
          company: { tax_id_provided: true },
          capabilities: { [TAX_REPORTING_CAPABILITY]: 'pending' },
        }),
      ),
    ).toBe('provided');
    expect(
      taxIdStateFrom(
        account({
          individual: { id_number_provided: true },
          capabilities: { [TAX_REPORTING_CAPABILITY]: 'active' },
          requirements: { pending_verification: ['individual.id_number'] },
        }),
      ),
    ).toBe('provided');
  });

  it('is Verified when given, nothing about it is outstanding and the capability is active', () => {
    expect(
      taxIdStateFrom(
        account({
          individual: { id_number_provided: true },
          capabilities: { [TAX_REPORTING_CAPABILITY]: 'active' },
          requirements: { currently_due: ['external_account'], errors: [] },
        }),
      ),
    ).toBe('verified');
  });

  it('is Mismatch when Stripe reports an error against the tax ID, whichever entity type', () => {
    for (const requirement of ['individual.id_number', 'company.tax_id', 'individual.ssn_last_4']) {
      expect(
        taxIdStateFrom(
          account({
            individual: { id_number_provided: true },
            capabilities: { [TAX_REPORTING_CAPABILITY]: 'active' },
            requirements: {
              errors: [{ code: 'verification_failed_tax_id_match', requirement, reason: 'x' }],
            },
          }),
        ),
      ).toBe('mismatch');
    }
  });

  it('is not Mismatch for an error about something else', () => {
    expect(
      taxIdStateFrom(
        account({
          individual: { id_number_provided: true },
          requirements: {
            errors: [{ code: 'invalid_street_address', requirement: 'individual.address.line1' }],
          },
        }),
      ),
    ).toBe('provided');
  });
});
