import Stripe from 'stripe';

/**
 * Stripe's own account-id shape: `acct_` followed by base62.
 *
 * The fixture this replaced wrote `acct_e2e_fixture_not_a_real_account`, which
 * fails this pattern on its underscores — deliberately, so that the id which
 * made **every** browser pass stop one click short of a payment can never be
 * mistaken for one Stripe would accept.
 */
const STRIPE_ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9]+$/;

/** The bank account Stripe documents as instantly verified in test mode. */
const TEST_BANK_ACCOUNT = 'btok_us_verified';

/** The prefix a test-mode secret key carries. Live keys are refused. */
const TEST_KEY_PREFIX = 'sk_test_';

/**
 * The identity Stripe's test mode accepts without a document upload.
 *
 * `address_full_match` is Stripe's own magic line-1 value, and the SSN and date
 * of birth are its documented test values. None of it is a real person, and
 * `assertSafeTarget` has already refused any database where it could reach one.
 */
const TEST_IDENTITY = {
  givenName: 'Jenny',
  surname: 'Rosen',
  dateOfBirth: { day: 1, month: 1, year: 1990 },
  address: {
    line1: 'address_full_match',
    city: 'Austin',
    state: 'TX',
    postal_code: '78701',
    country: 'US',
  },
  phone: '+14155552671',
  ssn: '000000000',
} as const;

/** How long to wait for Stripe to finish activating the capabilities. */
const ACTIVATION_ATTEMPTS = 10;
const ACTIVATION_INTERVAL_MS = 3000;

/** Whether a stored value is shaped like an id Stripe could actually resolve. */
export function isStripeAccountId(value: string | null | undefined): value is string {
  return typeof value === 'string' && STRIPE_ACCOUNT_ID_PATTERN.test(value);
}

/** What Stripe reports about a recipient account's two capabilities. */
export interface E2eAccountStatus {
  transfersActive: boolean;
  payoutsActive: boolean;
}

/**
 * The three Stripe calls this fixture makes, behind an interface so the
 * orchestration below can be tested without a network or a key.
 */
export interface StripeFixtureGateway {
  /** `null` when Stripe has no such account, rather than throwing. */
  readStatus(accountId: string): Promise<E2eAccountStatus | null>;
  createRecipientAccount(input: {
    contactEmail: string;
    displayName: string;
    businessUrl: string;
  }): Promise<string>;
  attachVerifiedBankAccount(accountId: string): Promise<void>;
}

export interface E2eStripeAccountInput {
  /** The id a previous run provisioned, from `.env.e2e.local` or the database. */
  existingAccountId: string | null;
  contactEmail: string;
  displayName: string;
  /**
   * A URL Stripe will accept. It checks that the business URL resolves, so
   * `example.com` is refused and the deployed origin is what works.
   */
  businessUrl: string;
}

export interface E2eStripeAccountResult {
  accountId: string;
  /** Both capabilities active — the same conjunction `isOnboarded` applies. */
  onboarded: boolean;
  /** Whether this run created the account, so the caller can say so. */
  created: boolean;
}

/**
 * Builds the gateway against the real Stripe API.
 *
 * Unlike the Clerk lookup in `scripts/seed-e2e.ts`, this goes through the SDK
 * rather than `fetch`. The v2 Accounts API **requires** a `Stripe-Version`
 * header, so a hand-rolled call means pinning an API version string in a second
 * place and letting it drift silently from the one `apps/api` sends. The SDK
 * owns that version; this module borrows it.
 *
 * Live keys are refused outright. `assertSafeTarget` guards the database, but
 * nothing there would stop a live key from creating a real connected account
 * while pointed at a local Postgres.
 */
export function createStripeFixtureGateway(secretKey: string): StripeFixtureGateway {
  if (!secretKey.startsWith(TEST_KEY_PREFIX)) {
    throw new Error(
      'the Stripe key is not a test-mode key, and the end-to-end fixture creates a connected ' +
        'account — which must never happen in live mode',
    );
  }

  const stripe = new Stripe(secretKey);

  return {
    async readStatus(accountId) {
      try {
        const account = await stripe.v2.core.accounts.retrieve(accountId, {
          include: ['configuration.recipient'],
        });
        const balance = account.configuration?.recipient?.capabilities?.stripe_balance;

        return {
          transfersActive: balance?.stripe_transfers?.status === 'active',
          payoutsActive: balance?.payouts?.status === 'active',
        };
      } catch (error: unknown) {
        /*
         * A key pointing at a different Stripe instance, or an account someone
         * removed, is a re-provision rather than a failure.
         */
        if (error instanceof Stripe.errors.StripeError && error.statusCode === 404) {
          return null;
        }

        throw error;
      }
    },

    async createRecipientAccount(input) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: input.contactEmail,
        display_name: input.displayName,
        /*
         * `none`, where the product's own onboarding uses `express`. Stripe
         * owns requirement collection for an Express account and refuses to let
         * the platform accept its terms of service on its behalf, so an Express
         * fixture can only ever be completed by a human clicking through the
         * hosted form — which is the manual step this seed exists to remove. A
         * platform-collected account can be filled in one call.
         */
        dashboard: 'none',
        identity: {
          country: 'us',
          entity_type: 'individual',
          individual: {
            given_name: TEST_IDENTITY.givenName,
            surname: TEST_IDENTITY.surname,
            email: input.contactEmail,
            date_of_birth: TEST_IDENTITY.dateOfBirth,
            address: TEST_IDENTITY.address,
            phone: TEST_IDENTITY.phone,
            id_numbers: [{ type: 'us_ssn', value: TEST_IDENTITY.ssn }],
          },
          attestations: {
            terms_of_service: { account: { date: new Date().toISOString(), ip: '127.0.0.1' } },
          },
        },
        configuration: {
          recipient: {
            capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
          },
        },
        defaults: {
          currency: 'usd',
          profile: { business_url: input.businessUrl },
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
        metadata: { fixture: 'e2e' },
      });

      return account.id;
    },

    async attachVerifiedBankAccount(accountId) {
      /*
       * `payouts` is not a capability the API lets you request: it is granted
       * once the account has somewhere to be paid out to. Without this the
       * account can receive a transfer while `isOnboarded` still reads false,
       * which is the half-state `isMissingPayoutsOnly` exists to name.
       */
      await stripe.accounts.createExternalAccount(accountId, {
        external_account: TEST_BANK_ACCOUNT,
      });
    },
  };
}

/**
 * The connected account the end-to-end vendor is payable through — reused when
 * a previous run left a working one, provisioned when it did not.
 *
 * Reuse is checked against **Stripe**, not against the column. A stored id is
 * kept only when Stripe still resolves it and reports transfers active; a key
 * pointing at a different instance, a removed account, or a placeholder left by
 * an older seed all fall through to a fresh one.
 */
export async function ensureE2eConnectedAccount(
  gateway: StripeFixtureGateway,
  input: E2eStripeAccountInput,
  wait: (ms: number) => Promise<void> = defaultWait,
): Promise<E2eStripeAccountResult> {
  if (isStripeAccountId(input.existingAccountId)) {
    const accountId = input.existingAccountId;
    const status = await gateway.readStatus(accountId);

    if (status?.transfersActive === true) {
      return {
        accountId,
        /*
         * Waited on rather than reported, when only payouts is missing. Stripe
         * grants payouts some seconds after transfers, so a run that caught the
         * account mid-activation would otherwise report a perfectly good
         * account as un-onboarded on every subsequent run too — the account is
         * reused, so nothing ever re-polls it.
         */
        onboarded: status.payoutsActive || (await waitForActivation(gateway, accountId, wait)),
        created: false,
      };
    }
  }

  const accountId = await gateway.createRecipientAccount({
    contactEmail: input.contactEmail,
    displayName: input.displayName,
    businessUrl: input.businessUrl,
  });

  await gateway.attachVerifiedBankAccount(accountId);

  return {
    accountId,
    onboarded: await waitForActivation(gateway, accountId, wait),
    created: true,
  };
}

/**
 * Stripe activates the capabilities asynchronously, and the account reads back
 * `restricted` for a few seconds after the bank account lands. Polling here
 * rather than in the caller is what keeps the seed's output honest: it prints
 * what Stripe actually reports, not what was requested.
 */
async function waitForActivation(
  gateway: StripeFixtureGateway,
  accountId: string,
  wait: (ms: number) => Promise<void>,
): Promise<boolean> {
  for (let attempt = 0; attempt < ACTIVATION_ATTEMPTS; attempt += 1) {
    const status = await gateway.readStatus(accountId);

    if (status?.transfersActive === true && status.payoutsActive) {
      return true;
    }

    await wait(ACTIVATION_INTERVAL_MS);
  }

  return false;
}

function defaultWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
