import Stripe from 'stripe';

/**
 * Stripe, reduced to the things this codebase actually does with it. The narrow
 * port is what lets the route suites run the real handler, the real service and
 * real SQL without reaching the network — the same seam the Clerk token
 * verifier and the object store already use.
 *
 * The name covers the payment path too, and under #423 it earns it literally:
 * the platform charges into its own balance and makes the vendor's transfer
 * itself, a fixed window after the event date. Both halves are Connect
 * operations and both are on this port.
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
   * The charge, into **Orla's own balance** — no `transfer_data`, no
   * `application_fee_amount` (#423).
   *
   * It was a destination charge until then, which split the money at the
   * instant the card succeeded: a vendor booked for an event in March was paid
   * in January, and the event date was not involved. Separate charges and
   * transfers is what lets the release be keyed to the date instead — the money
   * sits with the platform, and `createTransfer` moves the vendor's share a
   * fixed window after the event.
   *
   * **Idempotent on the request id.** Stripe returns the *same* intent for a
   * repeated key rather than minting a second one, which is what makes a
   * double-submitted checkout impossible to charge twice at the source rather
   * than only in the UI.
   */
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentSnapshot>;

  /**
   * Moves the vendor's stored share out of the platform balance and into their
   * connected account. The other half of separate charges and transfers.
   *
   * **Idempotent on the booking id and the attempt number.** The transfer is
   * sent inside the transaction that claims the booking, so a commit that never
   * lands leaves the money moved and the row unchanged; the key makes that
   * retry return the first transfer rather than sending a second. The attempt
   * number is what keeps a *failed* attempt from being replayed forever — see
   * `CreateTransferInput.attempt`.
   */
  createTransfer(input: CreateTransferInput): Promise<{ transferId: string; amountCents: number }>;

  /**
   * The transfer already made for a transfer group, or `null` if there is none.
   *
   * The 24-hour half of the guard above, and the same lesson `findRefund`
   * records: Stripe forgets an idempotency key after a day, and a payout whose
   * transfer succeeded while its row failed to commit is retried by every
   * subsequent sweep. Past that day the key is no guard at all and the retry is
   * a *second* transfer of the vendor's whole share, out of the platform's
   * balance, with nothing to say it happened. Asking first turns that from
   * unrecoverable into self-healing.
   */
  findTransfer(transferGroup: string): Promise<{ transferId: string; amountCents: number } | null>;

  /**
   * Claws a share of a transfer back out of the vendor's connected account.
   *
   * This is what `reverse_transfer: true` on a refund used to do, and it no
   * longer can: that flag only applies to a *destination* charge, where the
   * transfer belongs to the charge. Under separate charges and transfers the
   * transfer is its own object and the platform reverses it explicitly. The
   * policy either flag expressed is unchanged (D31) — see `reversalAmountCents`.
   */
  reverseTransfer(
    input: ReverseTransferInput,
  ): Promise<{ reversalId: string; amountCents: number }>;

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

  /**
   * The refund already made against an intent, or `null` if there is none.
   *
   * The idempotency key on `createRefund` is the guard for concurrent and
   * near-simultaneous retries, and it is the right one — but Stripe only
   * remembers a key for **24 hours**. The refund is deliberately sent before
   * the row moves, so a booking whose update then *throws* is left paid back
   * but still `confirmed`, and the customer can press Cancel again. Past the
   * 24-hour window that second attempt is a second refund: Stripe accepts it
   * while the running total stays inside the charge, so two 50%-tier refunds
   * both succeed and add up to 100% — and under D31 they reverse the vendor's
   * transfer twice, taking a third party's account negative.
   *
   * Asking Stripe first turns that state from unrecoverable into self-healing:
   * the retry finds the money already sent and finishes the cancellation
   * instead of paying it out again.
   */
  findRefund(paymentIntentId: string): Promise<{ refundId: string; amountCents: number } | null>;
}

export interface CreatePaymentIntentInput {
  /** The accepted request being paid for. Doubles as the idempotency key. */
  requestId: string;
  amountCents: number;
  customerId: string;
  vendorId: string;
}

export interface CreateTransferInput {
  /** The booking being paid out. The idempotency key is derived from it. */
  bookingId: string;
  /**
   * How many times this payout has already failed — part of the idempotency
   * key, so a **retry is a new request rather than a replay of the failure**.
   *
   * Found against real Stripe, not reasoned about: the sweep's first attempt
   * was refused `balance_insufficient`, and every later attempt came back with
   * the identical error *and the original request's log URL* even after the
   * balance was funded. Stripe caches the result of an idempotent request for
   * 24 hours and that includes the failure, so a key fixed at
   * `payout_<bookingId>` meant one transient refusal — a Stripe blip, funds not
   * yet settled — froze that payout for a day while the sweep dutifully asked
   * for the same cached "no" every quarter of an hour. A fresh key succeeded
   * immediately.
   *
   * Nothing is given up by varying it. Only one sweep can be working a booking
   * at a time (`FOR UPDATE SKIP LOCKED`), so there is no concurrent duplicate
   * for the key to catch here; and the case it *did* protect — a transfer that
   * reached Stripe under a transaction that never committed — is unaffected,
   * because a rolled-back transaction never incremented the attempt count, so
   * the retry replays under the same key and gets the original **success**.
   * `findTransfer` is the durable guard behind both, and it has no expiry.
   */
  attempt: number;
  /**
   * The vendor's share, **read from `bookings.vendor_payout_cents`** and never
   * recomputed here.
   *
   * The rate in force when the card succeeded is already written to that row.
   * Recomputing the split at release time would silently reprice every
   * unreleased booking the moment `STRIPE_PLATFORM_FEE_RATE` changed — months
   * of bookings paid at a fee their customers were never quoted.
   */
  amountCents: number;
  /** The vendor's connected account. */
  destinationAccountId: string;
  /** `transferGroupFor(requestId)` — ties the transfer back to its charge. */
  transferGroup: string;
}

export interface ReverseTransferInput {
  transferId: string;
  /** The share to claw back, proportional to the refund (D31). */
  amountCents: number;
  /** One reversal per booking per cancellation, whatever the request timing. */
  idempotencyKey: string;
}

/**
 * The label that ties a charge to the transfer it eventually funds.
 *
 * Sent on the intent at checkout and on the transfer at release, so the two
 * appear as one unit in the Stripe dashboard and in a payout reconciliation —
 * which under a destination charge came for free and under separate charges and
 * transfers has to be asked for. It is also the handle `findTransfer` searches
 * on, which is why it is derived from the request id rather than being random:
 * a sweep that has lost its row can still find the money it moved.
 */
export function transferGroupFor(requestId: string): string {
  return `booking_${requestId}`;
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
 * The vendor's proportional share of a refund — what a post-release
 * cancellation reverses out of their connected account, and **the whole of
 * D31's unwind policy now that the two flags that used to express it are
 * gone.**
 *
 * D31: a booking that will not happen puts all three parties back where they
 * started — the customer made whole, the vendor giving back their share, Orla
 * giving back its commission, each proportionally so the split survives the 50%
 * tier as well as the 100% one. The policy is unchanged under #423; the
 * mechanism had to move. `reverse_transfer` and `refund_application_fee` only
 * mean anything on a *destination* charge, where the transfer and the fee
 * belong to the charge. The charge is now a plain one into the platform
 * balance, so there is no fee on it to give back and no transfer on it to
 * reverse: Orla gives its commission back by keeping less of what it still
 * holds, and the vendor's share is clawed back with an explicit reversal of
 * this amount. The old constant is deliberately deleted rather than left
 * exported — an unreferenced `reverseTransfer: true` on the money path is an
 * invitation to a 400.
 *
 * **Which is also why the boundary is the release, and why it makes refunds
 * safer.** Before the release nothing has been transferred, so a cancellation
 * is a plain refund with nothing to reverse, and the cost D31 had to accept — a
 * vendor already paid out carried to a negative balance they must fund — now
 * applies only to a booking cancelled after its event.
 *
 * Proportional to the refund rather than to the whole booking, so a 50%-tier
 * cancellation takes back half of the vendor's share and leaves Orla half of
 * its commission. The arithmetic closes exactly at both ends: refunding the
 * full total reverses the full payout and leaves the platform at zero, and
 * refunding nothing reverses nothing.
 *
 * This is what `reverse_transfer: true` computed inside Stripe on a destination
 * charge. Under separate charges and transfers the platform states the amount,
 * so it is stated here where a test can read it.
 */
export function reversalAmountCents(booking: {
  totalAmountCents: number;
  vendorPayoutCents: number;
  refundCents: number;
}): number {
  if (booking.totalAmountCents <= 0) {
    return 0;
  }

  return Math.min(
    Math.round((booking.refundCents * booking.vendorPayoutCents) / booking.totalAmountCents),
    booking.vendorPayoutCents,
  );
}

/**
 * The exact request `createRefund` sends, built where a test can read it.
 *
 * **No unwind flags** (#423). The charge is a plain charge into the platform
 * balance, so `refund_application_fee` names a fee that is not on it and
 * `reverse_transfer` names a transfer that is not on it — Stripe answers 400
 * for the second and the first is meaningless. The vendor's share comes back
 * through `reverseTransfer` instead, when there is one to come back from.
 *
 * Extracted from the gateway so the params are assertable without a network
 * call, and so the in-process double can validate the very request the real
 * adapter would have sent rather than a paraphrase of it.
 */
export function refundParams(input: CreateRefundInput): Stripe.RefundCreateParams {
  return {
    payment_intent: input.paymentIntentId,
    amount: input.amountCents,
    reason: input.reason,
  };
}

/**
 * Stripe's own refusal for a refund it will not perform, or `null` when it
 * would accept the request.
 *
 * Both branches are unreachable from `refundParams` above, and that is the
 * point of keeping them: they are the *gateway's* rules, and the double applies
 * them, so reintroducing either flag fails in the suite rather than in
 * production. #416 is the reason the habit exists — for two months every
 * cancellation this product offered was answered 400 by Stripe on the first
 * pair, and the suite stayed green because the double recorded the call instead
 * of judging it.
 */
export function refusedRefundParams(params: Stripe.RefundCreateParams): string | null {
  if (params.refund_application_fee && !params.reverse_transfer) {
    return (
      `The application fee for charge ${String(params.payment_intent)} was taken on the ` +
      'associated transfer, so to refund the application fee you must also set ' +
      'reverse_transfer=true'
    );
  }

  /*
   * The #423 half. A charge with no `transfer_data` has no transfer to reverse,
   * and Stripe refuses rather than ignoring the flag — which is exactly the
   * shape of the mistake a reader who remembers the destination charge would
   * make while moving a refund across the release boundary.
   */
  if (params.reverse_transfer) {
    return (
      `Charge for ${String(params.payment_intent)} has no associated transfer to reverse. ` +
      'Reverse the transfer object directly instead.'
    );
  }

  return null;
}

/**
 * The exact request `createPaymentIntent` sends, built where a test can read
 * it.
 *
 * Extracted for #423 acceptance 1, which is a statement about two fields that
 * are **absent**: no `application_fee_amount`, no `transfer_data`. An absence
 * cannot be asserted against a recorded call — the double would have to promise
 * it was faithfully not-recording something — so the params themselves are the
 * subject, and the same object is what the adapter posts and what the double
 * judges.
 */
export function paymentIntentParams(
  input: CreatePaymentIntentInput,
): Stripe.PaymentIntentCreateParams {
  return {
    amount: input.amountCents,
    currency: 'usd',
    transfer_group: transferGroupFor(input.requestId),
    /*
     * Card only, and no redirect methods. A redirect method would send the
     * customer to a bank page and back through `return_url`, and the confirmed
     * screen is reached from the intent's own status rather than from a return
     * trip — so offering one would open a path the product does not finish.
     */
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: {
      requestId: input.requestId,
      customerId: input.customerId,
      vendorId: input.vendorId,
    },
  };
}

/**
 * The idempotency key one payout attempt is sent under.
 *
 * Built here rather than inline so the adapter and the double cannot disagree
 * about it, and so the attempt number's role is assertable — see
 * `CreateTransferInput.attempt` for why a retry must not reuse the key.
 */
export function transferIdempotencyKey(input: CreateTransferInput): string {
  return `payout_${input.bookingId}_${input.attempt}`;
}

/** The exact request `createTransfer` sends, built where a test can read it. */
export function transferParams(input: CreateTransferInput): Stripe.TransferCreateParams {
  return {
    amount: input.amountCents,
    currency: 'usd',
    destination: input.destinationAccountId,
    transfer_group: input.transferGroup,
    metadata: { bookingId: input.bookingId },
  };
}

/**
 * Stripe's own refusal for a transfer it will not make, or `null` when it would
 * accept the request. The capability check is not here — the gateway holds the
 * account state, so the double applies that one where it knows the answer.
 *
 * A zero-amount transfer is the branch that matters. It is reachable from real
 * data: a booking whose total rounds its whole value into the platform fee has
 * `vendor_payout_cents = 0`, and a sweep that sent it would answer 400 every
 * quarter of an hour forever against a payout that can never succeed.
 */
export function refusedTransferParams(params: Stripe.TransferCreateParams): string | null {
  if (!Number.isInteger(params.amount) || Number(params.amount) < 1) {
    return `Invalid integer: ${String(params.amount)}. Transfer amount must be at least 1 cent.`;
  }

  if (!params.destination) {
    return 'Missing required param: destination.';
  }

  return null;
}

/** The exact request `reverseTransfer` sends, built where a test can read it. */
export function reversalParams(input: ReverseTransferInput): Stripe.TransferCreateReversalParams {
  return { amount: input.amountCents };
}

/**
 * Stripe's own refusal for a reversal it will not make, given what is left
 * unreversed on the transfer.
 *
 * The over-reversal branch is the one a cancellation can actually reach: two
 * refunds against one booking inside the 24-hour idempotency window are already
 * guarded, but a second cancellation the day after a first would reverse the
 * vendor's share twice — and taking a third party's balance negative twice over
 * is the failure D31 accepted once and never twice.
 */
export function refusedReversalParams(
  params: Stripe.TransferCreateReversalParams,
  unreversedCents: number,
): string | null {
  if (!Number.isInteger(params.amount) || Number(params.amount) < 1) {
    return `Invalid integer: ${String(params.amount)}. Reversal amount must be at least 1 cent.`;
  }

  if (Number(params.amount) > unreversedCents) {
    return (
      `Reversal amount (${String(params.amount)}) is greater than the unreversed amount ` +
      `(${String(unreversedCents)}) on the transfer.`
    );
  }

  return null;
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

/**
 * The refund statuses that mean the customer's money is coming back.
 *
 * `pending` is included: it is a refund in flight, and treating it as absent
 * would send a second one. `failed` and `canceled` are not — the money is back
 * in the platform balance and the customer has none of it.
 */
const USABLE_REFUND_STATUSES = new Set(['succeeded', 'pending', 'requires_action']);

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

/**
 * How long a single Stripe request may take before it is abandoned.
 *
 * stripe-node defaults to **80 seconds**, which became a problem the moment
 * #423 put a Stripe call inside the transaction that holds a booking's row
 * lock. The sweep makes two calls per booking — `findTransfer`, then
 * `createTransfer` — so a degraded Stripe could hold that lock, and one of ten
 * pooled connections, for nearly three minutes.
 *
 * The failure that produces is not the sweep's own. A customer cancelling or
 * reporting that same booking issues a plain `UPDATE`, which gets no
 * `SKIP LOCKED`: it queues behind the sweep for the full timeout and their
 * request dies at the browser. Bounding the call bounds the lock, and the sweep
 * loses nothing by giving up early — the booking stays releasable and the next
 * tick retries it a quarter of an hour later.
 */
const STRIPE_REQUEST_TIMEOUT_MS = 10_000;

export function createStripeConnectGateway(credentials: StripeCredentials): StripeConnectGateway {
  const stripe = new Stripe(credentials.secretKey, { timeout: STRIPE_REQUEST_TIMEOUT_MS });

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
        /*
         * No `application_fee_amount` and no `transfer_data` (#423). The whole
         * amount lands in the platform balance and stays there until the event
         * has happened; `createTransfer` moves the vendor's share afterwards.
         * The absence is asserted against `paymentIntentParams` itself, which
         * is why the object is built there rather than inline here.
         */
        paymentIntentParams(input),
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

    async createTransfer(input) {
      const transfer = await stripe.transfers.create(transferParams(input), {
        idempotencyKey: transferIdempotencyKey(input),
      });

      return { transferId: transfer.id, amountCents: transfer.amount };
    },

    async findTransfer(transferGroup) {
      const { data } = await stripe.transfers.list({ transfer_group: transferGroup, limit: 10 });
      const transfer = data[0];

      return transfer ? { transferId: transfer.id, amountCents: transfer.amount } : null;
    },

    async reverseTransfer(input) {
      const reversal = await stripe.transfers.createReversal(
        input.transferId,
        reversalParams(input),
        { idempotencyKey: input.idempotencyKey },
      );

      return { reversalId: reversal.id, amountCents: reversal.amount };
    },

    async createRefund(input) {
      const refund = await stripe.refunds.create(
        refundParams(input),
        input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined,
      );

      return { refundId: refund.id, amountCents: refund.amount };
    },

    async findRefund(paymentIntentId) {
      const { data } = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 10 });
      /*
       * Only a refund that is on its way to the customer counts as one (#415).
       *
       * `refunds.list` returns `failed` and `canceled` refunds too, with
       * `amount` populated — a failed refund puts the money back in the
       * platform balance, not in the customer's account. Reading one of those
       * as "already refunded" used only to skip a retry; it is now written to
       * `bookings.refund_amount_cents` and rendered to both parties as money
       * returned, so a bank rejection would have the product state a refund
       * that never landed.
       */
      const refund = data.find((candidate) => USABLE_REFUND_STATUSES.has(candidate.status ?? ''));

      return refund ? { refundId: refund.id, amountCents: refund.amount } : null;
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
