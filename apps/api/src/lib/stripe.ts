import Stripe from 'stripe';

/**
 * Stripe Connect, reduced to the four things this codebase actually does with
 * it. The narrow port is what lets the route suites run the real handler, the
 * real service and real SQL without reaching the network — the same seam the
 * Clerk token verifier and the object store already use.
 *
 * **Accounts v2, not v1.** `POST /v1/accounts` answers 400 for this platform —
 * *"Stripe no longer recommends Accounts v1 for new Connect integrations.
 * Create connected accounts with `POST /v2/core/accounts` instead."* — so v1 is
 * not a choice that is still open. Under v2 the old `type: 'express'` archetype
 * is spelled out as three independent fields, and a payout-receiving
 * marketplace seller is `dashboard: 'express'` with the platform owning both
 * fees and losses.
 */
export interface StripeConnectGateway {
  /**
   * Creates the connected account a vendor is paid through. `recipient` rather
   * than `merchant`: Orla takes the payment and pays the vendor out of it, so
   * the vendor never needs to be merchant of record. Requesting `merchant` or
   * `card_payments` here would lengthen onboarding for a capability the
   * product does not use.
   */
  createRecipientAccount(input: CreateRecipientAccountInput): Promise<{ accountId: string }>;

  /**
   * A fresh hosted-onboarding link for an account. Links are single-use and
   * expire five minutes after they are minted, so one is created per click
   * rather than stored.
   */
  createOnboardingLink(input: CreateOnboardingLinkInput): Promise<{ url: string }>;

  /** The authoritative capability state, read from Stripe rather than cached. */
  readAccountStatus(accountId: string): Promise<StripeAccountStatus>;

  /**
   * Verifies a webhook signature over the exact bytes Stripe sent and names
   * the account the notification is about. Throws when the signature does not
   * verify.
   */
  parseEventNotification(payload: string, signature: string): StripeEventNotification;
}

export interface CreateRecipientAccountInput {
  /** Stored on the Stripe account so a support question can be traced back. */
  vendorId: string;
  contactEmail: string;
  displayName: string;
}

export interface CreateOnboardingLinkInput {
  accountId: string;
  /** Where Stripe sends the vendor when they finish or abandon the form. */
  returnUrl: string;
  /** Where Stripe sends them when the link has expired or was already used. */
  refreshUrl: string;
}

/**
 * The two capabilities a vendor needs before money can move: `stripe_transfers`
 * to receive a transfer from the platform at all, and `payouts` to have that
 * balance reach their bank. A vendor holding one but not the other cannot
 * complete a booking, so both are read and both are required.
 */
export interface StripeAccountStatus {
  transfersActive: boolean;
  payoutsActive: boolean;
}

export interface StripeEventNotification {
  type: string;
  /** The connected account the event concerns, when the event names one. */
  accountId: string | null;
}

/**
 * `stripe_onboarded` is one column, and this is the only place the two Stripe
 * capabilities collapse into it. Both must be active: a vendor who can receive
 * a transfer but cannot be paid out has money arriving in a balance they cannot
 * empty, which is worse than being told they are not set up yet.
 */
export function isOnboarded(status: StripeAccountStatus): boolean {
  return status.transfersActive && status.payoutsActive;
}

/**
 * The one half-state worth naming out loud.
 *
 * Both capabilities are granted together by the recipient configuration, and
 * only the `external_account` requirement restricts payouts on its own — so a
 * vendor in this state has finished identity and attached no bank account. They
 * are stuck behind the payment gate with nothing on any surface saying which of
 * the two is missing, which is a day of guessing unless the logs say it.
 */
export function isMissingPayoutsOnly(status: StripeAccountStatus): boolean {
  return status.transfersActive && !status.payoutsActive;
}

/**
 * Reads the recipient configuration off a v2 account. The capabilities hash is
 * only present when `configuration.recipient` was included in the request, and
 * a capability is absent until it has been requested, so both are treated as
 * "not active" rather than as an error — an account mid-onboarding legitimately
 * has neither.
 */
/**
 * Names the account a verified webhook body is about, whichever shape it
 * arrived in.
 *
 * **Both shapes are real and both have to be handled.** A v2 account still
 * emits the v1 snapshot Connect events - `account.updated`, `capability.updated`
 * - and those are what actually arrive today: probed against this platform's
 * test account, a full onboarding attempt produced three v1 events and no thin
 * ones, because thin `v2.core.*` delivery needs an event destination to be
 * provisioned separately. Listening only for the v2 shape is therefore a
 * webhook that never fires, and a vendor who never leaves the payout gate.
 *
 * Accepting both costs nothing: the handler re-reads the account from Stripe
 * rather than trusting the payload, so an event is only ever a nudge saying
 * "look again". Whichever shape does the nudging, the answer is the same.
 */
export function describeAccountEvent(verified: unknown): StripeEventNotification {
  const event = (verified ?? {}) as {
    type?: unknown;
    account?: unknown;
    related_object?: { id?: unknown } | null;
    data?: { object?: { id?: unknown } | null } | null;
  };

  const type = typeof event.type === 'string' ? event.type : '';

  // v2 thin: the affected object is named in `related_object`.
  const relatedId = event.related_object?.id;
  if (typeof relatedId === 'string') {
    return { type, accountId: relatedId };
  }

  /*
   * v1 snapshot Connect: the connected account is the top-level `account`.
   * `data.object.id` is the fallback for `account.updated`, where the object in
   * the payload *is* the account and there is no separate `account` field.
   */
  if (typeof event.account === 'string') {
    return { type, accountId: event.account };
  }

  const objectId = event.data?.object?.id;

  return { type, accountId: typeof objectId === 'string' ? objectId : null };
}

function readRecipientStatus(account: Stripe.V2.Core.Account): StripeAccountStatus {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;

  return {
    transfersActive: balance?.stripe_transfers?.status === 'active',
    payoutsActive: balance?.payouts?.status === 'active',
  };
}

export interface StripeCredentials {
  secretKey: string;
  webhookSecret: string;
}

export function createStripeConnectGateway(credentials: StripeCredentials): StripeConnectGateway {
  const stripe = new Stripe(credentials.secretKey);

  return {
    async createRecipientAccount(input) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: input.contactEmail,
        display_name: input.displayName,
        dashboard: 'express',
        /*
         * Country only. `entity_type` is deliberately not sent: Stripe uses it
         * to decide which identity fields apply and how the account is
         * validated, and this product's vendors are as often a catering LLC or
         * a DJ company as a sole trader. Asserting `individual` for all of them
         * would ask a company for a personal identity it cannot supply, stall
         * verification, and leave the capabilities restricted forever. The
         * hosted form asks instead.
         */
        identity: { country: 'us' },
        configuration: {
          recipient: {
            capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
          },
        },
        defaults: {
          currency: 'usd',
          responsibilities: { fees_collector: 'application', losses_collector: 'application' },
        },
        metadata: { vendorId: input.vendorId },
      });

      return { accountId: account.id };
    },

    async createOnboardingLink(input) {
      const link = await stripe.v2.core.accountLinks.create({
        account: input.accountId,
        use_case: {
          type: 'account_onboarding',
          account_onboarding: {
            configurations: ['recipient'],
            return_url: input.returnUrl,
            refresh_url: input.refreshUrl,
          },
        },
      });

      return { url: link.url };
    },

    async readAccountStatus(accountId) {
      const account = await stripe.v2.core.accounts.retrieve(accountId, {
        include: ['configuration.recipient'],
      });

      return readRecipientStatus(account);
    },

    parseEventNotification(payload, signature) {
      /*
       * Both event shapes are signed the same way, so the signature is checked
       * once and the shape is read afterwards. `constructEvent` verifies the
       * HMAC over the exact bytes and enforces its timestamp tolerance, then
       * JSON-parses — it does not care which shape it got.
       */
      const verified: unknown = stripe.webhooks.constructEvent(
        payload,
        signature,
        credentials.webhookSecret,
      );

      return describeAccountEvent(verified);
    },
  };
}
