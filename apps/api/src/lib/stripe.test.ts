import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import {
  createStripeClient,
  createStripeConnectGateway,
  STRIPE_API_VERSION,
  describeAccountEvent,
  isForeignEnvIntent,
  isMissingPayoutsOnly,
  isOnboarded,
  isRefusedAccountCreation,
  paymentIntentIdempotencyKey,
  paymentIntentParams,
  pickTransfer,
  readAccountStatusFrom,
  refundParams,
  refusedRefundParams,
  refusedReversalParams,
  refusedTransferParams,
  reversalAmountCents,
  reversalParams,
  sumUsableRefunds,
  transferGroupFor,
  transferParams,
  usdCents,
  type StripeConnectGateway,
} from './stripe.js';

describe('usdCents', () => {
  it('adds up the USD entries of a balance and ignores other currencies', () => {
    expect(
      usdCents([
        { amount: 120_000, currency: 'usd' },
        { amount: 9_999, currency: 'eur' },
        { amount: -2_500, currency: 'usd' },
      ]),
    ).toBe(117_500);
  });

  it('reads an empty balance as zero', () => {
    expect(usdCents([])).toBe(0);
  });
});

describe('isRefusedAccountCreation', () => {
  it('counts a v1 invalid_request_error and a v2 invalid_fields body as refusals', () => {
    const v1 = Stripe.errors.StripeError.generate({
      type: 'invalid_request_error',
      message: 'bad',
    });
    const v2 = Stripe.errors.generateV2Error({ code: 'invalid_fields', message: 'bad' });

    expect(v1.rawType).toBe('invalid_request_error');
    expect(v2.rawType).toBeUndefined();
    expect(isRefusedAccountCreation(v1)).toBe(true);
    expect(isRefusedAccountCreation(v2)).toBe(true);
  });

  it('does not count a concurrent-key conflict, a 5xx or a dropped connection', () => {
    const conflict = Stripe.errors.StripeError.generate({
      type: 'idempotency_error',
      message: 'in flight',
    });
    const outage = Stripe.errors.StripeError.generate({ type: 'api_error', message: 'oops' });

    expect(isRefusedAccountCreation(conflict)).toBe(false);
    expect(isRefusedAccountCreation(outage)).toBe(false);
    expect(isRefusedAccountCreation(new Error('socket hang up'))).toBe(false);
  });
});

describe('paymentIntentParams', () => {
  const INPUT = {
    requestId: 'req_one',
    replacements: 0,
    amountCents: 145_000,
    customerId: 'cus_one',
    vendorId: 'ven_one',
  } as const;

  /**
   * #423 acceptance 1, and it is a statement about two fields that are
   * **absent**. The charge is a plain charge into Orla's balance: a
   * `transfer_data` would split the money as the card succeeded and pay a
   * vendor booked for March in January, and an `application_fee_amount` is
   * meaningless without one.
   */
  it('charges into the platform balance, with no fee and no destination', () => {
    const params = paymentIntentParams(INPUT, 'staging');

    expect(params.transfer_data).toBeUndefined();
    expect(params.application_fee_amount).toBeUndefined();
    expect(params.amount).toBe(145_000);
    expect(params.transfer_group).toBe('booking_req_one');
  });

  /** VEN-529: staging and production share one test account, so the tier rides on the intent. */
  it.each(['staging', 'production'])('tags the intent with its %s environment', (tier) => {
    expect(paymentIntentParams(INPUT, tier).metadata).toEqual({
      requestId: 'req_one',
      customerId: 'cus_one',
      vendorId: 'ven_one',
      env: tier,
    });
  });

  it('recognises only a tag naming another environment as foreign', () => {
    expect(isForeignEnvIntent({ metadata: { env: 'production' } }, 'staging')).toBe(true);
    expect(isForeignEnvIntent({ metadata: { env: 'staging' } }, 'staging')).toBe(false);
    expect(isForeignEnvIntent({ metadata: {} }, 'staging')).toBe(false);
  });

  /** VEN-547: the first key is the one intents were opened under before it, then one per replacement. */
  it('keeps the first creation key and suffixes each replacement', () => {
    expect(paymentIntentIdempotencyKey(INPUT)).toBe('pay_req_one_separate');
    expect(paymentIntentIdempotencyKey({ requestId: 'req_one', replacements: 2 })).toBe(
      'pay_req_one_separate_r2',
    );
  });

  /** The group is what ties the charge to the transfer it eventually funds. */
  it('labels the charge with the transfer group the release will search on', () => {
    expect(paymentIntentParams(INPUT, 'staging').transfer_group).toBe(transferGroupFor('req_one'));
  });
});

describe('refundParams', () => {
  const INPUT = { paymentIntentId: 'pi_platform', amountCents: 72_500 } as const;

  /*
   * #416 shipped `refund_application_fee: true` with `reverse_transfer: false`,
   * which Stripe answers 400 for — so no refund this product offered had ever
   * succeeded. #423 removed both: there is no destination charge left to carry
   * either flag, and the vendor's share comes back through a transfer reversal
   * instead. D31's policy is unchanged; only the mechanism moved.
   */
  it('sends a plain refund, with neither unwind flag', () => {
    expect(refundParams(INPUT)).toEqual({
      payment_intent: 'pi_platform',
      amount: 72_500,
      reason: undefined,
      metadata: { orla_refund: '1' },
    });
  });

  /**
   * The guard that keeps the double honest: the fake refuses whatever
   * `refusedRefundParams` refuses, so a request Stripe cannot perform turns
   * every refund route test red rather than passing against a call that 400s.
   */
  it('ships a request Stripe accepts', () => {
    expect(refusedRefundParams(refundParams(INPUT))).toBeNull();
  });
});

describe('sumUsableRefunds', () => {
  it('sums usable refunds and ignores failed and canceled ones', () => {
    expect(
      sumUsableRefunds([
        { id: 're_1', amount: 1_000, status: 'succeeded' },
        { id: 're_2', amount: 20_000, status: 'failed' },
        { id: 're_3', amount: 30_000, status: 'canceled' },
        { id: 're_4', amount: 4_000, status: 'pending' },
      ]),
    ).toEqual({ refundIds: ['re_1', 're_4'], amountCents: 5_000, platformCents: 0 });
  });

  it('counts only the refunds carrying the platform marker as its own', () => {
    expect(
      sumUsableRefunds([
        { id: 're_1', amount: 4_000, status: 'succeeded', metadata: { orla_refund: '1' } },
        { id: 're_2', amount: 1_000, status: 'succeeded', metadata: {} },
        { id: 're_3', amount: 9_000, status: 'failed', metadata: { orla_refund: '1' } },
      ]),
    ).toEqual({ refundIds: ['re_1', 're_2'], amountCents: 5_000, platformCents: 4_000 });
  });

  it('is null when no refund is usable', () => {
    expect(sumUsableRefunds([])).toBeNull();
    expect(sumUsableRefunds([{ id: 're_1', amount: 500, status: 'failed' }])).toBeNull();
  });
});

describe('refusedRefundParams', () => {
  const params = (unwind: { reverseTransfer: boolean; refundApplicationFee: boolean }) => ({
    ...refundParams({ paymentIntentId: 'pi_one', amountCents: 100 }),
    reverse_transfer: unwind.reverseTransfer,
    refund_application_fee: unwind.refundApplicationFee,
  });

  it('refuses refunding the fee without reversing the transfer, as Stripe does', () => {
    expect(
      refusedRefundParams(params({ reverseTransfer: false, refundApplicationFee: true })),
    ).toBe(
      'The application fee for charge pi_one was taken on the associated transfer, so to ' +
        'refund the application fee you must also set reverse_transfer=true',
    );
  });

  /*
   * The #423 half. A plain charge has no transfer on it, so Stripe refuses the
   * flag rather than ignoring it — which is exactly the mistake a reader who
   * remembers the destination charge would make while moving a refund across
   * the release boundary.
   */
  it('refuses reversing a transfer the charge does not have', () => {
    expect(
      refusedRefundParams(params({ reverseTransfer: true, refundApplicationFee: false })),
    ).toBe(
      'Charge for pi_one has no associated transfer to reverse. Reverse the transfer object ' +
        'directly instead.',
    );
    expect(refusedRefundParams(params({ reverseTransfer: true, refundApplicationFee: true }))).toBe(
      'Charge for pi_one has no associated transfer to reverse. Reverse the transfer object ' +
        'directly instead.',
    );
  });

  it('accepts a refund carrying neither flag', () => {
    expect(
      refusedRefundParams(params({ reverseTransfer: false, refundApplicationFee: false })),
    ).toBe(null);
  });
});

describe('transferParams', () => {
  const INPUT = {
    bookingId: 'bkg_one',
    amountCents: 127_600,
    destinationAccountId: 'acct_vendor',
    transferGroup: 'booking_req_one',
    attempt: 0,
  } as const;

  it('sends the stored payout to the vendor account, tagged with its group', () => {
    expect(transferParams(INPUT)).toEqual({
      amount: 127_600,
      currency: 'usd',
      destination: 'acct_vendor',
      transfer_group: 'booking_req_one',
      metadata: { bookingId: 'bkg_one' },
    });
  });

  it('ships a request Stripe accepts', () => {
    expect(refusedTransferParams(transferParams(INPUT))).toBeNull();
  });

  /*
   * Reachable from real data: a booking whose total rounds its whole value into
   * the platform fee has `vendor_payout_cents = 0`, and a sweep that sent it
   * would 400 every quarter of an hour forever against a payout that can never
   * succeed.
   */
  it('refuses a zero-cent transfer, as Stripe does', () => {
    expect(refusedTransferParams(transferParams({ ...INPUT, amountCents: 0 }))).toBe(
      'Invalid integer: 0. Transfer amount must be at least 1 cent.',
    );
  });

  it('refuses a transfer with no destination, as Stripe does', () => {
    expect(refusedTransferParams(transferParams({ ...INPUT, destinationAccountId: '' }))).toBe(
      'Missing required param: destination.',
    );
  });
});

describe('reversalAmountCents', () => {
  /* A full refund puts all three parties back where they started (D31). */
  it('reverses the whole payout for a full refund', () => {
    expect(
      reversalAmountCents({
        totalAmountCents: 100_000,
        vendorPayoutCents: 88_000,
        refundCents: 100_000,
      }),
    ).toBe(88_000);
  });

  /* And half of it at the 50% tier, leaving Orla half its commission. */
  it('reverses proportionally at the late-cancellation tier', () => {
    expect(
      reversalAmountCents({
        totalAmountCents: 100_000,
        vendorPayoutCents: 88_000,
        refundCents: 50_000,
      }),
    ).toBe(44_000);
  });

  it('reverses nothing when nothing is refunded', () => {
    expect(
      reversalAmountCents({ totalAmountCents: 100_000, vendorPayoutCents: 88_000, refundCents: 0 }),
    ).toBe(0);
  });

  /*
   * Rounding must never ask for more than was transferred. A one-cent booking
   * whose payout rounds up is the shape that would otherwise produce a reversal
   * Stripe refuses, on the retry path where nobody is watching.
   */
  it('never asks for more than the payout, whatever the rounding', () => {
    expect(reversalAmountCents({ totalAmountCents: 3, vendorPayoutCents: 3, refundCents: 3 })).toBe(
      3,
    );
    expect(reversalAmountCents({ totalAmountCents: 0, vendorPayoutCents: 0, refundCents: 0 })).toBe(
      0,
    );
  });
});

describe('refusedReversalParams', () => {
  const params = reversalParams({
    transferId: 'tr_one',
    amountCents: 5_000,
    idempotencyKey: 'k',
  });

  it('accepts a reversal inside the unreversed balance', () => {
    expect(refusedReversalParams(params, 5_000)).toBeNull();
  });

  /*
   * A booking cancelled twice, a day apart, is past Stripe's idempotency
   * window — and reversing the vendor's share twice takes a third party's
   * balance negative twice over, which D31 accepted once and never twice.
   */
  it('refuses reversing more than is left on the transfer, as Stripe does', () => {
    expect(refusedReversalParams(params, 4_999)).toBe(
      'Reversal amount (5000) is greater than the unreversed amount (4999) on the transfer.',
    );
  });

  it('refuses a zero-cent reversal, as Stripe does', () => {
    expect(
      refusedReversalParams(
        reversalParams({ transferId: 'tr_one', amountCents: 0, idempotencyKey: 'k' }),
        5_000,
      ),
    ).toBe('Invalid integer: 0. Reversal amount must be at least 1 cent.');
  });
});

describe('isOnboarded', () => {
  /*
   * `stripe_onboarded` is one column standing for two Stripe capabilities. A
   * vendor who can receive a transfer but cannot be paid out has money arriving
   * in a balance they cannot empty, which is worse than being told they are not
   * set up yet — so this is an AND, and these four cases are the whole of it.
   */
  it('requires both capabilities, not either', () => {
    expect(isOnboarded({ transfersActive: true, payoutsActive: true })).toBe(true);
    expect(isOnboarded({ transfersActive: true, payoutsActive: false })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: true })).toBe(false);
    expect(isOnboarded({ transfersActive: false, payoutsActive: false })).toBe(false);
  });
});

describe('isMissingPayoutsOnly', () => {
  /*
   * Both capabilities are granted together, and only `external_account`
   * restricts payouts on its own — so this state means exactly "identity done,
   * no bank account", and nothing else does.
   */
  it('names only the identity-done, no-bank-account state', () => {
    expect(isMissingPayoutsOnly({ transfersActive: true, payoutsActive: false })).toBe(true);
    expect(isMissingPayoutsOnly({ transfersActive: true, payoutsActive: true })).toBe(false);
    expect(isMissingPayoutsOnly({ transfersActive: false, payoutsActive: false })).toBe(false);
    // Not reachable through onboarding, and deliberately not claimed as this state.
    expect(isMissingPayoutsOnly({ transfersActive: false, payoutsActive: true })).toBe(false);
  });
});

describe('readAccountStatusFrom', () => {
  /**
   * A restricted recipient account **as Stripe sends it** — the payload the
   * `account.updated` handler re-reads, not a row shaped like this codebase's
   * own interface (#432).
   *
   * Every field here is one Stripe owns: `status_details[].code` from its
   * closed vocabulary, and `requirements.entries[]` with the two properties
   * that decide whether an entry is worth showing an operator —
   * `awaiting_action_from` and `minimum_deadline.status`.
   */
  const RESTRICTED = {
    id: 'acct_restricted',
    configuration: {
      recipient: {
        applied: true,
        capabilities: {
          stripe_balance: {
            payouts: {
              status: 'restricted',
              status_details: [{ code: 'requirements_past_due', resolution: 'provide_info' }],
            },
            stripe_transfers: {
              status: 'restricted',
              status_details: [{ code: 'requirements_past_due', resolution: 'provide_info' }],
            },
          },
        },
      },
    },
    requirements: {
      entries: [
        {
          awaiting_action_from: 'user',
          description: 'individual.id_number',
          errors: [],
          impact: {},
          minimum_deadline: { status: 'past_due' },
          requested_reasons: [{ code: 'routine_verification' }],
        },
        {
          awaiting_action_from: 'user',
          description: 'individual.verification.document',
          errors: [],
          impact: {},
          minimum_deadline: { status: 'currently_due' },
          requested_reasons: [{ code: 'routine_verification' }],
        },
        {
          // Stripe is verifying this one; nobody here can act on it.
          awaiting_action_from: 'stripe',
          description: 'individual.address',
          errors: [],
          impact: {},
          minimum_deadline: { status: 'currently_due' },
          requested_reasons: [{ code: 'routine_verification' }],
        },
        {
          // Every account carries some of these from the day it is created.
          awaiting_action_from: 'user',
          description: 'business_profile.url',
          errors: [],
          impact: {},
          minimum_deadline: { status: 'eventually_due' },
          requested_reasons: [{ code: 'routine_onboarding' }],
        },
      ],
    },
  } as unknown as Stripe.V2.Core.Account;

  it('reads the capabilities, the reason and only the actionable requirements', () => {
    expect(readAccountStatusFrom(RESTRICTED)).toEqual({
      transfersActive: false,
      payoutsActive: false,
      disabledReason: 'requirements_past_due',
      requirementsDue: ['individual.id_number', 'individual.verification.document'],
    });
  });

  /*
   * `status_details` is documented as empty while a capability is active, so an
   * onboarded vendor must carry no reason at all — a leftover code beside two
   * active capabilities would render "restricted" on a vendor Stripe is happy
   * with.
   */
  it('reports no reason and nothing outstanding for an active account', () => {
    const active = {
      id: 'acct_active',
      configuration: {
        recipient: {
          applied: true,
          capabilities: {
            stripe_balance: {
              payouts: { status: 'active', status_details: [] },
              stripe_transfers: { status: 'active', status_details: [] },
            },
          },
        },
      },
      requirements: { entries: [] },
    } as unknown as Stripe.V2.Core.Account;

    expect(readAccountStatusFrom(active)).toEqual({
      transfersActive: true,
      payoutsActive: true,
      disabledReason: null,
      requirementsDue: [],
    });
  });

  /*
   * An account mid-onboarding legitimately has neither hash: a capability is
   * absent until it has been requested, and `requirements` is absent unless it
   * was included in the retrieve. Both are "nothing known yet", not an error.
   */
  it('treats a bare account as inactive with nothing known about it', () => {
    expect(readAccountStatusFrom({ id: 'acct_new' } as unknown as Stripe.V2.Core.Account)).toEqual({
      transfersActive: false,
      payoutsActive: false,
      disabledReason: null,
      requirementsDue: [],
    });
  });
});

describe('describeAccountEvent', () => {
  /*
   * The shape that actually arrives today. A v2 account still emits the v1
   * snapshot Connect events, and thin `v2.core.*` delivery needs an event
   * destination provisioned before it produces anything — so a handler that
   * reads only the v2 shape is a webhook that never fires, and a vendor who
   * never leaves the payout gate. Probed against this platform's test account:
   * one onboarding attempt produced three v1 events and no thin ones.
   */
  it('reads the connected account off a v1 snapshot Connect event', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'account.updated',
        account: 'acct_live_one',
        data: { object: { id: 'acct_live_one' } },
      }),
    ).toEqual({
      type: 'account.updated',
      accountId: 'acct_live_one',
      objectId: 'acct_live_one',
      livemode: null,
    });
  });

  /**
   * A signing secret carries no mode, so the event's own `livemode` is what
   * the webhook compares to the API key's (VEN-491). One case per return branch.
   */
  it.each([true, false])('carries livemode %s through every event shape', (livemode) => {
    const v1 = describeAccountEvent({
      type: 'account.updated',
      livemode,
      account: 'acct_1',
      data: { object: { id: 'acct_1' } },
    });
    const thin = describeAccountEvent({
      type: 'v2.core.account.updated',
      livemode,
      related_object: { id: 'acct_2' },
    });
    const fallback = describeAccountEvent({
      type: 'account.updated',
      livemode,
      data: { object: { id: 'acct_3' } },
    });

    expect([v1.livemode, thin.livemode, fallback.livemode]).toEqual([livemode, livemode, livemode]);
  });

  it('reports no livemode for a payload whose livemode is not a boolean', () => {
    expect(describeAccountEvent({ type: 'account.updated', livemode: 'true' }).livemode).toBeNull();
  });

  /** `capability.updated` carries a Capability in `data`, so `account` is the only source. */
  it('reads it off a capability event, whose payload object is not the account', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'capability.updated',
        account: 'acct_live_two',
        data: { object: { id: 'transfers' } },
      }),
    ).toEqual({
      type: 'capability.updated',
      accountId: 'acct_live_two',
      objectId: 'transfers',
      livemode: null,
    });
  });

  it('reads it off a v2 thin notification', () => {
    expect(
      describeAccountEvent({
        object: 'v2.core.event',
        type: 'v2.core.account[configuration.recipient].capability_status_updated',
        related_object: { id: 'acct_thin', type: 'v2.core.account' },
      }),
    ).toEqual({
      type: 'v2.core.account[configuration.recipient].capability_status_updated',
      accountId: 'acct_thin',
      objectId: 'acct_thin',
      livemode: null,
    });
  });

  it('falls back to the payload object when there is no separate account field', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'account.updated',
        data: { object: { id: 'acct_from_data' } },
      }),
    ).toEqual({
      type: 'account.updated',
      accountId: 'acct_from_data',
      objectId: 'acct_from_data',
      livemode: null,
    });
  });

  it('names no account for an event that is about something else', () => {
    expect(
      describeAccountEvent({ object: 'event', type: 'charge.succeeded', data: { object: {} } }),
    ).toEqual({ type: 'charge.succeeded', accountId: null, objectId: null, livemode: null });
  });

  /*
   * The payment branch's whole input. A destination charge's intent lives on
   * the platform, so `event.account` is absent — the intent is reachable only
   * through `data.object.id`, and reading `accountId` for it would look up a
   * `pi_…` as though it were a vendor.
   */
  it('names the payment intent an intent event is about', () => {
    expect(
      describeAccountEvent({
        object: 'event',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_live_one', amount_received: 145_000 } },
      }),
    ).toEqual({
      type: 'payment_intent.succeeded',
      accountId: 'pi_live_one',
      objectId: 'pi_live_one',
      livemode: null,
    });
  });

  it('survives a body with nothing in it rather than throwing', () => {
    const empty = { type: '', accountId: null, objectId: null, livemode: null };
    expect(describeAccountEvent(null)).toEqual(empty);
    expect(describeAccountEvent({})).toEqual(empty);
  });
});

describe('parseEventNotification', () => {
  /*
   * A webhook endpoint listens either to the platform's own events or to
   * connected accounts', and each signs with its own key — so the two streams
   * `HANDLED_STRIPE_EVENT_TYPES` spans arrive under two of them. Assembled at
   * runtime so no signing literal sits in the source.
   */
  const keyNamed = (name: string): string => ['whsec', name].join('_');
  const own = keyNamed('own');
  const joint = keyNamed('joint');
  const PAYLOAD = JSON.stringify({
    id: 'evt_1',
    type: 'account.updated',
    account: 'acct_1',
    livemode: true,
  });
  const PARSED = { type: 'account.updated', accountId: 'acct_1', objectId: null, livemode: true };

  const gateway = (extra?: string): StripeConnectGateway =>
    createStripeConnectGateway({
      secretKey: 'sk_test_unused',
      deployEnv: 'staging',
      webhookSecret: own,
      ...(extra ? { connectWebhookSecret: extra } : {}),
    });

  const signedWith = (signer: string): string =>
    new Stripe('sk_test_unused').webhooks.generateTestHeaderString({
      payload: PAYLOAD,
      secret: signer,
    });

  it('accepts a delivery signed with the platform endpoint key', () => {
    expect(gateway(joint).parseEventNotification(PAYLOAD, signedWith(own))).toEqual(PARSED);
  });

  it('accepts a delivery signed with the connected-account endpoint key', () => {
    expect(gateway(joint).parseEventNotification(PAYLOAD, signedWith(joint))).toEqual(PARSED);
  });

  it('refuses a delivery signed with neither', () => {
    expect(() =>
      gateway(joint).parseEventNotification(PAYLOAD, signedWith(keyNamed('other'))),
    ).toThrow(/signature/i);
  });

  it('refuses the connected-account key while none is configured', () => {
    expect(() => gateway().parseEventNotification(PAYLOAD, signedWith(joint))).toThrow(
      /signature/i,
    );
  });
});

describe('pickTransfer', () => {
  const transfer = (
    id: string,
    amount: number,
    amountReversed: number,
    metadata: Record<string, string> = {},
  ): Pick<Stripe.Transfer, 'id' | 'amount' | 'amount_reversed' | 'metadata'> => ({
    id,
    amount,
    amount_reversed: amountReversed,
    metadata,
  });

  /* VEN-473 acceptance 3. */
  it('skips a fully reversed transfer and returns the live one behind it', () => {
    expect(
      pickTransfer([transfer('tr_reversed', 127_600, 127_600), transfer('tr_live', 127_600, 0)], {
        live: true,
      }),
    ).toEqual({ transferId: 'tr_live', amountCents: 127_600, reversedCents: 0 });
  });

  it('returns null when only reversed transfers exist, so the sweep creates one', () => {
    expect(pickTransfer([transfer('tr_reversed', 127_600, 127_600)], { live: true })).toBeNull();
    expect(pickTransfer([], { live: true })).toBeNull();
  });

  /* VEN-473 acceptance 4. */
  it('still returns a partly reversed transfer, with what was reversed', () => {
    expect(pickTransfer([transfer('tr_half', 127_600, 63_800)], { live: true })).toEqual({
      transferId: 'tr_half',
      amountCents: 127_600,
      reversedCents: 63_800,
    });
  });

  /* An unwind finishing a reversal must still see the fully reversed transfer. */
  it('returns a fully reversed transfer when the caller did not ask for a live one', () => {
    expect(pickTransfer([transfer('tr_reversed', 127_600, 127_600)])).toEqual({
      transferId: 'tr_reversed',
      amountCents: 127_600,
      reversedCents: 127_600,
    });
  });

  it('prefers the transfer the platform made for a booking over a manual one', () => {
    expect(
      pickTransfer(
        [
          transfer('tr_manual', 50_000, 0),
          transfer('tr_platform', 127_600, 0, { bookingId: 'bk_1' }),
        ],
        { live: true },
      )?.transferId,
    ).toBe('tr_platform');
  });

  /* VEN-499: `data[0]` was whichever transfer Stripe listed first. */
  it('prefers the platform transfer over a manual one that is listed first, live or not', () => {
    const listed = [
      transfer('tr_manual', 50_000, 50_000),
      transfer('tr_platform', 127_600, 63_800, { bookingId: 'bk_1' }),
    ];

    expect(pickTransfer(listed)).toEqual({
      transferId: 'tr_platform',
      amountCents: 127_600,
      reversedCents: 63_800,
    });
    expect(pickTransfer(listed, { live: true })?.transferId).toBe('tr_platform');
  });
});

describe('the Stripe API version', () => {
  it('is pinned to the exact SDK release and sent by the gateway client', () => {
    const client = createStripeClient('sk_test_unused');

    expect(STRIPE_API_VERSION).toBe('2026-08-26.dahlia');
    expect(client.getApiField('version')).toBe(STRIPE_API_VERSION);
  });
});
