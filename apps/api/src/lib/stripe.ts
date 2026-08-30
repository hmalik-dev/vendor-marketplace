import Stripe from 'stripe';
import type { ApiEnv } from '../config/env.js';

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
 * Where Stripe returns the vendor to. Derived from `WEB_URL` — which is already
 * the CORS allow-list — rather than from a second variable that could disagree
 * with it. The first origin wins, because `WEB_URL` is comma-separated and the
 * canonical origin is written first.
 *
 * Stripe accepts an `http://localhost` return URL in test mode, which is what
 * makes the redirect leg verifiable locally, but a deployed platform must send
 * vendors somewhere encrypted. Rather than trust that the deployment was
 * configured correctly, production refuses to mint a link at all against a
 * plaintext origin.
 */
export function onboardingReturnOrigin(env: Pick<ApiEnv, 'WEB_URL' | 'NODE_ENV'>): string {
  const origin = env.WEB_URL.split(',')[0]?.trim().replace(/\/+$/, '') ?? '';

  if (origin.length === 0) {
    throw new Error('WEB_URL is empty, so Stripe has nowhere to return the vendor to');
  }

  if (env.NODE_ENV === 'production' && !origin.startsWith('https://')) {
    throw new Error(
      `WEB_URL must be an https origin in production; Stripe onboarding would return the vendor to ${origin}`,
    );
  }

  return origin;
}

/**
 * Reads the recipient configuration off a v2 account. The capabilities hash is
 * only present when `configuration.recipient` was included in the request, and
 * a capability is absent until it has been requested, so both are treated as
 * "not active" rather than as an error — an account mid-onboarding legitimately
 * has neither.
 */
function readRecipientStatus(account: Stripe.V2.Core.Account): StripeAccountStatus {
  const balance = account.configuration?.recipient?.capabilities?.stripe_balance;

  return {
    transfersActive: balance?.stripe_transfers?.status === 'active',
    payoutsActive: balance?.payouts?.status === 'active',
  };
}

export function createStripeConnectGateway(
  env: Pick<ApiEnv, 'STRIPE_SECRET_KEY' | 'STRIPE_WEBHOOK_SECRET'>,
): StripeConnectGateway {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  return {
    async createRecipientAccount(input) {
      const account = await stripe.v2.core.accounts.create({
        contact_email: input.contactEmail,
        display_name: input.displayName,
        dashboard: 'express',
        identity: { country: 'us', entity_type: 'individual' },
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
      const notification = stripe.parseEventNotification(
        payload,
        signature,
        env.STRIPE_WEBHOOK_SECRET,
      );

      /*
       * `EventNotification` is a union, and the one v1 member the SDK models
       * explicitly carries no `related_object`. Narrowing by presence rather
       * than by type keeps this correct as Stripe adds members, and the `in`
       * check is what tells TypeScript the property is there at all.
       */
      const relatedObject =
        'related_object' in notification ? notification.related_object : undefined;

      return {
        type: notification.type,
        accountId: relatedObject?.id ?? null,
      };
    },
  };
}
