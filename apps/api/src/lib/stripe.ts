import Stripe from 'stripe';

/**
 * Stripe, reduced to the things this codebase actually does with it. The narrow
 * port is what lets the route suites run the real handler, the real service and
 * real SQL without reaching the network — the same seam the Clerk token
 * verifier and the object store already use.
 *
 * The name is historical: it covers the payment path too, because a destination
 * charge *is* a Connect operation — the fee and the payout account are fields on
 * the intent, not a separate transfer this platform makes.
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
   * the account or object the notification is about. Throws when the signature
   * does not verify.
   */
  parseEventNotification(payload: string, signature: string): StripeEventNotification;

  /**
   * The charge, as a destination charge: the customer pays the platform, Stripe
   * takes `application_fee_amount` for it, and the remainder lands in the
   * vendor's connected account. One Stripe object, not a charge plus a later
   * transfer — which is why there is no `createTransfer` on this port and why
   * completion moves no money.
   *
   * **Idempotent on the request id.** Stripe returns the *same* intent for a
   * repeated key rather than minting a second one, which is what makes a
   * double-submitted checkout impossible to charge twice at the source rather
   * than only in the UI.
   */
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentSnapshot>;

  /**
   * Reads an intent back. This is the reconciliation path: a webhook that never
   * arrives leaves a paid customer with no booking row, and the booking detail
   * asks Stripe directly rather than waiting for a delivery that is not coming.
   */
  retrievePaymentIntent(paymentIntentId: string): Promise<PaymentIntentSnapshot>;

  /**
   * Refunds part or all of an intent. The amount is always passed explicitly,
   * even for a full refund: the cancellation tiers are the product's rule, and
   * letting Stripe default to "everything" would make a 50% refund and a 100%
   * refund two different code paths.
   */
  createRefund(input: CreateRefundInput): Promise<{ refundId: string; amountCents: number }>;
}

export interface CreatePaymentIntentInput {
  /** The accepted request being paid for. Doubles as the idempotency key. */
  requestId: string;
  amountCents: number;
  applicationFeeCents: number;
  /** The vendor's connected account — where the remainder lands. */
  destinationAccountId: string;
  customerId: string;
  vendorId: string;
}

export interface CreateRefundInput {
  paymentIntentId: string;
  amountCents: number;
  /**
   * Distinguishes a customer cancellation from an operator-driven one.
   *
   * **Omitted for an operator-driven refund**, which is the accurate signal:
   * Stripe's vocabulary is `duplicate`, `fraudulent` and
   * `requested_by_customer`, and a refund the *platform* issued when it
   * suspended an account (#15) is none of the three. Sending
   * `requested_by_customer` would attribute the decision to a customer who did
   * not make it, and `fraudulent` would put a fraud signal on a card that did
   * nothing wrong — it feeds Stripe Radar and the issuer's own risk scoring.
   */
  reason?: 'requested_by_customer';
  /**
   * What makes this refund replayable exactly once.
   *
   * `createPaymentIntent` has always carried one; this did not, and the ban
   * unwind's only replay guard was a non-atomic `isBanned` read — so two
   * concurrent `PUT /admin/users/:id/ban` calls both entered the loop and both
   * asked Stripe to refund the same booking. The booking id is the natural key:
   * one refund per booking per ban, whatever the request timing.
   */
  idempotencyKey?: string;
}

/**
 * What the app needs off an intent, and nothing more.
 *
 * `status` is Stripe's own vocabulary rather than a mapped enum on purpose:
 * this is the one place a Stripe string is authoritative, and translating it
 * here would mean maintaining a second list of payment states that can drift
 * from the first.
 */
export interface PaymentIntentSnapshot {
  id: string;
  status: string;
  /** Only meaningful once the intent has succeeded. */
  amountReceivedCents: number;
  /** `null` once the intent is terminal — there is nothing left to confirm. */
  clientSecret: string | null;
  /** `requestId`, `customerId` and `vendorId`, as sent at creation. */
  metadata: Record<string, string>;
}

/** Stripe's terminal success state for an intent. */
export const PAYMENT_INTENT_SUCCEEDED = 'succeeded';

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
  /**
   * `data.object.id` — the payment intent a `payment_intent.*` event is about.
   *
   * Separate from `accountId` rather than reusing it, because for a destination
   * charge the two are genuinely different objects and the payload names only
   * one of them: the intent lives on the platform, so `event.account` is absent
   * and the account is reachable only *through* the intent.
   */
  objectId: string | null;
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

  const objectId = typeof event.data?.object?.id === 'string' ? event.data.object.id : null;

  // v2 thin: the affected object is named in `related_object`.
  const relatedId = event.related_object?.id;
  if (typeof relatedId === 'string') {
    return { type, accountId: relatedId, objectId: objectId ?? relatedId };
  }

  /*
   * v1 snapshot Connect: the connected account is the top-level `account`.
   * `data.object.id` is the fallback for `account.updated`, where the object in
   * the payload *is* the account and there is no separate `account` field.
   */
  if (typeof event.account === 'string') {
    return { type, accountId: event.account, objectId };
  }

  return { type, accountId: objectId, objectId };
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

    async createPaymentIntent(input) {
      const intent = await stripe.paymentIntents.create(
        {
          amount: input.amountCents,
          currency: 'usd',
          application_fee_amount: input.applicationFeeCents,
          transfer_data: { destination: input.destinationAccountId },
          /*
           * Card only, and no redirect methods. A redirect method would send
           * the customer to a bank page and back through `return_url`, and the
           * confirmed screen is reached from the intent's own status rather
           * than from a return trip — so offering one would open a path the
           * product does not finish.
           */
          automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
          metadata: {
            requestId: input.requestId,
            customerId: input.customerId,
            vendorId: input.vendorId,
          },
        },
        /*
         * The request id, not a random key. Stripe replays the *same* intent
         * for a repeated key for 24 hours, so a double-submitted checkout — or
         * a retry after a dropped response — reaches the same intent rather
         * than minting a second one against the same booking.
         */
        { idempotencyKey: `pay_${input.requestId}` },
      );

      return toSnapshot(intent);
    },

    async retrievePaymentIntent(paymentIntentId) {
      return toSnapshot(await stripe.paymentIntents.retrieve(paymentIntentId));
    },

    async createRefund(input) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: input.paymentIntentId,
          amount: input.amountCents,
          reason: input.reason,
          /*
           * The platform gives back its own fee too. Orla took a commission for
           * arranging a booking that is not happening, and keeping it out of a
           * refund the customer is owed in full would make the "100% refund" the
           * cancellation policy promises a 88% one.
           */
          refund_application_fee: true,
          /*
           * And it carries the loss rather than clawing it back from the vendor's
           * balance, which is what `losses_collector: 'application'` on the
           * account already says. Reversing the transfer would take money out of a
           * vendor who may have already been paid out and turn a cancellation into
           * a negative balance they have to fund.
           */
          reverse_transfer: false,
        },
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );

      return { refundId: refund.id, amountCents: refund.amount };
    },
  };
}

function toSnapshot(intent: Stripe.PaymentIntent): PaymentIntentSnapshot {
  return {
    id: intent.id,
    status: intent.status,
    amountReceivedCents: intent.amount_received,
    clientSecret: intent.client_secret,
    metadata: intent.metadata ?? {},
  };
}
