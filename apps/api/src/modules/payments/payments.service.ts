import {
  ERROR_CODES,
  MIN_BOOKING_AMOUNT_CENTS,
  calculateFees,
  calculateRefund,
  isLegacyDestinationPayout,
  isUniversallyFutureDate,
  parseDurationHours,
  type Booking,
  type BookingStatus,
  type BookingWithContext,
  type CancelledBooking,
  type CheckoutIntent,
  type DisputeOutcome,
} from '@vendor-marketplace/shared';
import type { BookingRow } from '@vendor-marketplace/db/schema';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import { toBookingView, toBookingWithContext } from '../../lib/booking-view.js';
import {
  queueNotificationEmail,
  type NotificationEmailDeps,
} from '../notifications/notification-email.js';
import type { EventHub } from '../../lib/event-stream.js';
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import {
  PAYMENT_INTENT_SUCCEEDED,
  reversalAmountCents,
  transferGroupFor,
  type PaymentIntentSnapshot,
  type StripeConnectGateway,
} from '../../lib/stripe.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import {
  findVendorByUserId,
  findVendorContact,
  findVendorUserId,
} from '../booking-requests/booking-requests.dao.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { notificationHref } from '../messaging/messaging.service.js';
import {
  applyBookingTransition,
  cancelBookingAndFreeDate,
  confirmBooking,
  findBookingById,
  findAnyBookingByRequest,
  findBookingByRequest,
  findPayableRequest,
  recordPaymentIntent,
  type PayableRequestRow,
} from './payments.dao.js';

/**
 * What a booking action needs, whoever is taking it.
 *
 * Split from `PaymentContext` for `resolveDispute`, which is reached from the
 * admin plugin: an operator settling a complaint moves the same money through
 * the same code, but `AdminContext` has no `platformFeeRate` and should not
 * grow one for it. Only the paths that *price* a charge need the rate.
 */
export interface BookingContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  hub: EventHub;
  log: FastifyBaseLogger;
  /**
   * Everything the transactional email needs.
   *
   * Carried on the context beside `hub` because the email *is* the
   * notification: an event that rings the bell and does not reach the inbox has
   * drifted, and threading them separately is how that happens.
   */
  mail: NotificationEmailDeps;
}

/**
 * The one place a `BookingContext` is assembled.
 *
 * It was a literal copied into each plugin that needed one, defended by a
 * comment saying the copies must not diverge — which is the argument for
 * building it once. A field added to `BookingContext` or to the mail deps now
 * reaches every caller, instead of reaching the ones somebody remembered.
 */
export function bookingContextFor(
  app: BookingContextSource,
  log: FastifyBaseLogger,
  webOrigin: string,
): BookingContext {
  return {
    db: app.db,
    stripe: app.stripe,
    hub: app.events,
    log,
    mail: { db: app.db, email: app.email, log, webOrigin, background: app.background },
  };
}

/** The app decorators the context is built from. */
export interface BookingContextSource {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  events: EventHub;
  email: NotificationEmailDeps['email'];
  background: NotificationEmailDeps['background'];
}

/** A booking action that also has to price a charge. */
export interface PaymentContext extends BookingContext {
  /** `STRIPE_PLATFORM_FEE_RATE`, resolved at boot. */
  platformFeeRate: number;
}

/**
 * The price this request is paid at.
 *
 * `finalPriceCents` is the locked value and is what should always be there by
 * acceptance — the other two are read only so that a row missing it fails
 * loudly here rather than silently charging a package's *current* price, which
 * a vendor may have edited since.
 */
function payableAmount(row: PayableRequestRow): number {
  const amount = row.finalPriceCents ?? row.quotedPriceCents;

  if (amount === null) {
    throw new AppError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'That booking has no locked price and cannot be charged',
    );
  }

  return amount;
}

/**
 * Everything that must be true before money can move, checked in one place so
 * the pay route and the reconciliation read cannot disagree about it.
 */
async function requirePayableByCustomer(
  context: PaymentContext,
  user: AuthenticatedUser,
  requestId: string,
): Promise<PayableRequestRow> {
  const row = await findPayableRequest(context.db, requestId);

  if (!row) {
    throw notFound('That request does not exist');
  }

  // 404 rather than 403: a stranger probing ids learns nothing about which of
  // them exist — the same rule the request routes already apply.
  if (row.customerId !== user.id) {
    throw notFound('That request does not exist');
  }

  if (row.status !== 'accepted') {
    throw conflict(
      row.status === 'cancelled' || row.status === 'declined' || row.status === 'expired'
        ? 'That request is no longer open, so there is nothing to pay for'
        : 'That request has not been accepted yet',
    );
  }

  /*
   * Server-side, not merely hidden in the UI. Without the connected account
   * there is nowhere for the money to land, and Stripe would take the charge
   * onto the platform balance with no way to route it onward — a customer
   * charged for a booking the vendor can never be paid for.
   */
  if (!row.vendorStripeOnboarded || !row.vendorStripeAccountId) {
    throw new AppError(
      402,
      ERROR_CODES.PAYMENT_REQUIRED,
      `${row.vendorBusinessName} cannot take payment yet`,
    );
  }

  /*
   * The vendor agreement is what the platform pays a vendor *under*: it is
   * where the commission and the payout timing are agreed, and it is the
   * document a vendor would be shown if they later disputed either. A charge
   * taken against a vendor who has not accepted the version in force is money
   * moved under terms nobody agreed to — so the same 402 the missing Connect
   * account earns, for the same reason, and in the same place, so the pay
   * route and the reconciliation read cannot disagree about it.
   *
   * The customer's message is deliberately the same string either way. Which of
   * the two the vendor has not done is the vendor's business, and a customer
   * cannot act on the difference.
   */
  if (!row.vendorHoldsCurrentAgreement) {
    throw new AppError(
      402,
      ERROR_CODES.PAYMENT_REQUIRED,
      `${row.vendorBusinessName} cannot take payment yet`,
    );
  }

  return row;
}

/**
 * Opens checkout: returns the intent to confirm, creating it if this is the
 * first time.
 *
 * Idempotent twice over. Stripe replays the same intent for the same key, and
 * an already-paid request short-circuits before Stripe is called at all — so a
 * refreshed checkout tab cannot produce a second charge, and neither can a
 * double-submitted button.
 */
export async function openCheckout(
  context: PaymentContext,
  user: AuthenticatedUser,
  requestId: string,
): Promise<CheckoutIntent> {
  const row = await requirePayableByCustomer(context, user, requestId);
  const amountCents = payableAmount(row);

  if (amountCents < MIN_BOOKING_AMOUNT_CENTS) {
    throw validationFailed('That booking is below the minimum this platform can charge');
  }

  /*
   * An existing booking means the webhook already landed. Answering `succeeded`
   * rather than minting a fresh intent is what stops a customer who reopens the
   * checkout URL from being asked to pay a second time for a booking they
   * already hold.
   */
  const existing = await findBookingByRequest(context.db, requestId);

  if (existing) {
    return toCheckoutIntent(row, {
      id: existing.stripePaymentIntentId ?? '',
      status: PAYMENT_INTENT_SUCCEEDED,
      amountReceivedCents: existing.totalAmountCents,
      clientSecret: null,
      metadata: {},
    });
  }

  /*
   * The whole amount, into Orla's balance (#423). No fee and no destination:
   * `requirePayableByCustomer` still refuses a vendor who cannot receive a
   * transfer — there is no point charging a customer for a booking that can
   * never be paid out — but the account itself is not needed until the release,
   * a fixed window after the event date.
   */
  const intent = await context.stripe.createPaymentIntent({
    requestId,
    amountCents,
    customerId: row.customerId,
    vendorId: row.vendorId,
  });

  await recordPaymentIntent(context.db, requestId, intent.id);

  return toCheckoutIntent(row, intent);
}

function toCheckoutIntent(row: PayableRequestRow, intent: PaymentIntentSnapshot): CheckoutIntent {
  const amountCents = payableAmount(row);

  return {
    paymentIntentId: intent.id,
    clientSecret: intent.clientSecret,
    status: intent.status,
    amountCents,
    /*
     * Zero, and it is a real zero rather than a placeholder. D1 has the
     * platform absorb Stripe's processing fee out of its own commission, so
     * nothing is added to the quoted price — which is what makes the rail's
     * "Service fee: None" and the profile's "the price you're quoted is the
     * price you pay" the same promise. The platform's commission is a
     * different number, it comes out of the total, and it is none of the
     * customer's business on this screen.
     */
    customerFeeCents: 0,
    eventDate: row.eventDate,
    eventLocation: row.eventLocation,
    guestCount: row.guestCount,
    vendor: {
      slug: row.vendorSlug,
      businessName: row.vendorBusinessName,
      avatarUrl: row.vendorAvatarUrl,
    },
    servicePackage: toRailPackage(row),
    acceptedAt: row.acceptedAt,
  };
}

/**
 * The package the rail names, or `null` when there is none to name.
 *
 * The left join means a custom request produces a row with every package column
 * null, which is the same shape as "no package" — so the name is what decides,
 * not the presence of the row.
 */
function toRailPackage(row: PayableRequestRow): CheckoutIntent['servicePackage'] {
  if (row.packageName === null) {
    return null;
  }

  return {
    name: row.packageName,
    durationHours: parseDurationHours(row.packageDurationHours),
  };
}

/**
 * Turns a succeeded intent into a booking. Called by the webhook, and by the
 * reconciliation read when the webhook never arrives.
 *
 * Safe to call repeatedly: the unique index on `request_id` makes the second
 * call a no-op that reports the booking the first one made, which is what
 * Stripe's three-day retry schedule requires of it.
 */
export async function recordSuccessfulPayment(
  context: PaymentContext,
  intent: PaymentIntentSnapshot,
): Promise<{ booking: BookingRow; created: boolean }> {
  const requestId = intent.metadata.requestId;

  if (!requestId) {
    throw new AppError(
      422,
      ERROR_CODES.VALIDATION_ERROR,
      'That payment intent does not name a booking request',
    );
  }

  /*
   * Unfiltered, deliberately. This asks "have I already recorded this event",
   * not "is this request paid for" — and a booking that has since been
   * cancelled still means yes. Using the customer-facing read here made a
   * redelivery after a cancellation fall through and answer 409, which Stripe
   * retries for three days (#400).
   */
  const existing = await findAnyBookingByRequest(context.db, requestId);

  if (existing) {
    return { booking: existing, created: false };
  }

  const row = await findPayableRequest(context.db, requestId);

  if (!row) {
    throw notFound('That request does not exist');
  }

  /*
   * The charge is authoritative for the amount, not the request row. A vendor
   * cannot edit a locked price, but reading the total off the money that
   * actually moved means the booking can never claim a figure the customer was
   * not charged.
   */
  const totalAmountCents = intent.amountReceivedCents;
  const { platformFeeCents, vendorPayoutCents } = calculateFees(
    totalAmountCents,
    context.platformFeeRate,
  );

  const booking = await confirmBooking(context.db, {
    booking: {
      requestId,
      customerId: row.customerId,
      vendorId: row.vendorId,
      eventDate: row.eventDate,
      eventLocation: row.eventLocation,
      totalAmountCents,
      platformFeeCents,
      vendorPayoutCents,
      status: 'confirmed',
      /*
       * The only place `separate` is ever written, which is what makes the
       * column's `destination` default load-bearing: a booking recorded by the
       * *old* image during the deploy window is a destination charge Stripe has
       * already split, and it identifies itself by never having been through
       * this line.
       */
      payoutModel: 'separate',
      stripePaymentIntentId: intent.id,
      paidAt: new Date(),
    },
  });

  if (!booking) {
    /*
     * Two deliveries of the same event raced each other and the other one won.
     * Its row is the answer; this is not a failure and must not be reported as
     * one, or Stripe would keep retrying a webhook that already succeeded.
     */
    const settled = await findAnyBookingByRequest(context.db, requestId);

    if (!settled) {
      throw conflict('That booking could not be recorded');
    }

    return { booking: settled, created: false };
  }

  await bestEffortNotice(context, { bookingId: booking.id }, () =>
    announceBooking(context, booking, row.vendorBusinessName),
  );

  return { booking, created: true };
}

/**
 * Runs the notifications, and never lets them undo the booking they announce.
 *
 * **The booking has already committed** — `confirmBooking` returned — and this
 * is the one place where a throw afterwards is not merely rude but permanent.
 * The webhook would answer 500, Stripe would retry, and the retry
 * short-circuits at `existing` above and reports `already-booked`: so neither
 * party ever receives the `booking_confirmed` row or its email, and no
 * redelivery can repair it. The reconcile path had the milder version of the
 * same bug — `/confirmed` threw to the error boundary for a booking that
 * existed, and a reload fixed it.
 *
 * The specific cause was a notification title too long for its column (#408),
 * and that column is now wide enough; this is the general rule the specific one
 * revealed. Nothing is silent: the failure is logged against the booking.
 */
async function bestEffortNotice(
  context: BookingContext,
  subject: { bookingId: string },
  work: () => Promise<void>,
): Promise<void> {
  try {
    await work();
  } catch (error) {
    context.log.error(
      { ...subject, err: error },
      'The booking was recorded but its notifications could not be',
    );
  }
}

/** Both parties are told, because both have something to do next. */
async function announceBooking(
  context: PaymentContext,
  booking: BookingRow,
  businessName: string,
): Promise<void> {
  const vendorUserId = await findVendorUserId(context.db, booking.vendorId);

  await Promise.all([
    notify(context, booking.customerId, 'booking_confirmed', {
      title: `${businessName} is booked`,
      body: 'The date is yours. Payment is held until the event is done.',
      bookingId: booking.id,
    }),
    vendorUserId
      ? notify(
          context,
          vendorUserId,
          'booking_confirmed',
          {
            title: 'A booking is confirmed',
            body: 'The date is paid for and held. Payment reaches you after the event.',
            bookingId: booking.id,
          },
          // The vendor reads this on their own side; `/bookings` refuses them.
          'vendor',
        )
      : Promise.resolve(),
  ]);
}

async function notify(
  context: BookingContext,
  userId: string,
  type: 'booking_confirmed' | 'booking_completed' | 'booking_cancelled',
  copy: { title: string; body: string; bookingId: string },
  /*
   * Which half of the product the recipient reads this on, so the emailed link
   * lands on their own bookings rather than bouncing off the other side's.
   */
  audience: 'customer' | 'vendor' = 'customer',
): Promise<void> {
  const stored = await insertNotification(context.db, {
    userId,
    type,
    title: copy.title,
    body: copy.body,
    data: { bookingId: copy.bookingId },
  });

  if (stored) {
    context.hub.publish(userId, {
      type: 'new_notification',
      notification: {
        id: stored.id,
        type: stored.type,
        title: stored.title,
        body: stored.body,
        href: notificationHref(stored),
        readAt: stored.readAt,
        createdAt: stored.createdAt,
      },
    });

    /*
     * After the row and after the push, and unable to fail either: every
     * caller here is already outside its transaction — `announceBooking` runs
     * after `confirmBooking` commits — the send runs off the request path, and
     * it swallows its own failures so a booking that succeeded cannot appear
     * to fail.
     */
    queueNotificationEmail(context.mail, stored, audience);
  }
}

/**
 * Reconciliation: the booking this request produced, asking Stripe directly
 * when no booking row is there but an intent was recorded against it.
 *
 * Without this a customer whose webhook was dropped — a deploy mid-delivery, a
 * signature rotation, an endpoint paused — sits on a paid card and an unbooked
 * date with no path forward but support.
 */
export async function reconcileBooking(
  context: PaymentContext,
  user: AuthenticatedUser,
  requestId: string,
): Promise<BookingWithContext | null> {
  const existing = await findBookingByRequest(context.db, requestId);

  if (existing) {
    /*
     * Checked here and not only on the reconciliation path below. This branch
     * used to return whatever booking the request id named, to any signed-in
     * caller — amounts, payout split, Stripe intent id and all — so a stranger
     * walking request ids read other people's bookings. `null` rather than 403,
     * matching `requirePayableByCustomer`: a prober learns nothing about which
     * ids exist.
     */
    if (existing.customerId !== user.id) {
      return null;
    }

    return toBookingWithContext(existing, existing.eventType);
  }

  const row = await findPayableRequest(context.db, requestId);

  /*
   * `accepted` as well as the rest, because #400 gave this path a row it must
   * not act on. Cancelling now settles the parent request, so a cancelled
   * booking no longer answers the read above — and without this guard the
   * fall-through treated that as "paid, webhook never arrived", retrieved the
   * still-succeeded intent, and tried to recreate the booking the customer had
   * just cancelled. Reconciliation is for a request still waiting on its
   * booking; a settled one has nothing to reconcile.
   */
  if (
    !row ||
    row.customerId !== user.id ||
    !row.stripePaymentIntentId ||
    row.status !== 'accepted'
  ) {
    return null;
  }

  const intent = await context.stripe.retrievePaymentIntent(row.stripePaymentIntentId);

  if (intent.status !== PAYMENT_INTENT_SUCCEEDED) {
    return null;
  }

  context.log.warn(
    { requestId, paymentIntentId: intent.id },
    'Reconciled a paid booking whose webhook never arrived',
  );

  const { booking } = await recordSuccessfulPayment(context, intent);

  return toBookingWithContext(booking, row.eventType);
}

/**
 * Why an action on a booking is refused, one sentence per status it is already
 * in — three maps, one per action.
 *
 * Keyed on the enum rather than written as ternary chains, so adding a member
 * to `BOOKING_STATUSES` is a type error at all three sites instead of a booking
 * silently described as cancelled when it is not.
 */
const NOT_CANCELLABLE: Record<Exclude<BookingStatus, 'confirmed'>, string> = {
  completed: 'That event already happened, so it cannot be cancelled',
  cancelled: 'That booking is already cancelled',
  /*
   * The complaint is the live conversation about this booking, and cancelling
   * underneath it would settle the money on the tier the calendar happens to
   * give rather than on the outcome of the complaint. The resolution is what
   * refunds a disputed booking.
   */
  disputed: 'You have reported a problem with this booking, so it is being reviewed',
};

const NOT_COMPLETABLE: Record<Exclude<BookingStatus, 'confirmed'>, string> = {
  completed: 'That booking is already marked complete',
  cancelled: 'That booking was cancelled and cannot be completed',
  disputed:
    'The customer has raised a problem with this booking, so it is on hold until that is resolved',
};

const NOT_DISPUTABLE: Record<Exclude<BookingStatus, 'confirmed' | 'completed'>, string> = {
  cancelled: 'That booking was cancelled, so there is nothing to report',
  disputed: 'You have already reported a problem with this booking',
};

/**
 * What the vendor is told a cancellation does to their Stripe balance.
 *
 * Which sentence they get is a money claim rather than a copy choice — telling
 * a vendor their balance is being clawed back when it is not is as wrong as the
 * reverse — and it is decided by the booking, not by which path cancelled it.
 * Written once so the customer's cancellation and an upheld dispute cannot
 * drift into saying different things about the same fact.
 *
 * The reversal is named rather than left to be discovered on a Stripe statement
 * (D31): the full unwind takes the vendor's share back out of their connected
 * account, proportionally at either refund tier, and a vendor already paid out
 * is carried negative by it. Under #423 that can only happen after the event,
 * which is the whole reason the release moved.
 */
function unwindSentence(booking: BookingRow): string {
  return booking.stripeTransferId
    ? 'Their refund takes back the same share of your payout, out of your Stripe balance — ' +
        'which can leave it negative, because this booking had already been paid out.'
    : 'This booking had not been paid out yet, so nothing is taken back out of your Stripe ' +
        'balance.';
}

/** The two sides of a booking, and which one this caller is. */
async function participantIn(
  context: BookingContext,
  user: AuthenticatedUser,
  bookingId: string,
): Promise<{ booking: BookingRow; side: 'customer' | 'vendor' }> {
  const booking = await findBookingById(context.db, bookingId);

  if (!booking) {
    throw notFound('That booking does not exist');
  }

  if (booking.customerId === user.id) {
    return { booking, side: 'customer' };
  }

  const vendor = user.role === 'vendor' ? await findVendorByUserId(context.db, user.id) : null;

  if (vendor && vendor.id === booking.vendorId) {
    return { booking, side: 'vendor' };
  }

  throw notFound('That booking does not exist');
}

/**
 * The vendor marks the work done. **It moves no money, and it must not.**
 *
 * Not an omission and not a leftover from the destination charge this replaced
 * (#423): the release is keyed to the event date and to nothing else, and this
 * is the button the design exists to keep out of the predicate. The vendor is
 * the party who benefits from pressing it, so it evidences nothing about
 * whether the event happened — and a vendor who never presses it would strand
 * the money with no owner, which is why `RELEASABLE_STATUSES` covers `confirmed`
 * and `completed` alike. Completion is a status signal and the trigger for the
 * review invitation. Airbnb pays hosts about 24 hours after check-in for
 * exactly this reason.
 */
export async function completeBooking(
  context: PaymentContext,
  user: AuthenticatedUser,
  bookingId: string,
  now: Date,
): Promise<Booking> {
  const { booking, side } = await participantIn(context, user, bookingId);

  if (side !== 'vendor') {
    throw forbidden('Only the vendor can mark a booking complete');
  }

  if (booking.status !== 'confirmed') {
    /*
     * `disputed` is named rather than falling into the cancelled branch (#423).
     * A vendor whose customer has raised a problem would otherwise be told the
     * booking "was cancelled", which is untrue, sends them to the wrong screen,
     * and hides the one fact they need — that the payout is held pending a
     * complaint.
     */
    throw conflict(NOT_COMPLETABLE[booking.status]);
  }

  /*
   * Refused only while the event is still ahead **everywhere** (#409).
   *
   * This used to compare against the server's own UTC day, and the client's
   * guard — the one that decides whether the vendor is offered the button at
   * all — now reads the *browser's* day. East of UTC those are different days,
   * so a vendor who had just finished the event was shown `Mark complete` and
   * told "That event has not happened yet" on pressing it. A server cannot know
   * the vendor's day, so it refuses only what no vendor anywhere could have
   * reached yet; the widest honest reading, and the same one
   * `isUniversallyPastDate` gives at the other end.
   */
  if (isUniversallyFutureDate(booking.eventDate, now)) {
    throw conflict('That event has not happened yet');
  }

  const completed = await applyBookingTransition(context.db, bookingId, 'confirmed', {
    status: 'completed',
    completedAt: new Date(),
  });

  if (!completed) {
    throw conflict('That booking changed while you were completing it');
  }

  await bestEffortNotice(context, { bookingId: completed.id }, () =>
    notify(context, completed.customerId, 'booking_completed', {
      title: 'Your event is wrapped up',
      body: 'The vendor marked it complete. Leave them a review when you have a moment.',
      bookingId: completed.id,
    }),
  );

  return toBookingView(completed);
}

/**
 * Refunds a booking, unwinding the vendor's transfer only if there is one.
 *
 * **The boundary is the release, and both sides of it must exist** (#423).
 * Before the release nothing has been transferred, so a cancellation is a plain
 * `refunds.create` with nothing to reverse — no `reverse_transfer`, no
 * `refund_application_fee`, and no way to push a vendor negative, which is the
 * consequence D31 had to accept and which now applies only to bookings
 * cancelled *after* their event. After the release the unwind is still owed:
 * the vendor's proportional share is clawed back out of their connected
 * account, and Orla gives back its commission by keeping less of what it holds.
 *
 * The reversal is separate from the refund because it has to be. Both flags D31
 * expressed only ever applied to a destination charge, where the transfer
 * belongs to the charge; under separate charges and transfers the transfer is
 * its own object — see `reversalAmountCents`.
 *
 * The money is moved **before** the row does. A cancelled booking whose refund
 * then failed would tell the customer their money is coming back when nothing
 * was returned, with no way to notice from the row afterwards. A refund that
 * succeeded against a booking that then failed to update is the recoverable
 * direction: the money is where it should be and the row can be fixed.
 */
async function refundAndUnwind(
  context: BookingContext,
  booking: BookingRow,
  refundCents: number,
  /**
   * What names the idempotency keys — `cancel` for a customer cancellation,
   * `dispute` for an upheld report.
   *
   * A prefix rather than the two finished keys, because the caller's only real
   * input is which action this is: passing both strings meant four template
   * literals across two call sites, any one of which could drift a suffix. A
   * drifted suffix is not a test failure, it is an `idempotency_error` from
   * Stripe on a retry — the path nobody is watching.
   */
  keyPrefix: 'cancel' | 'dispute',
): Promise<UnwoundRefund> {
  if (!booking.stripePaymentIntentId) {
    throw new AppError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'That booking has no payment on record and cannot be refunded here',
    );
  }

  /*
   * A booking released with no transfer to show for it is a **destination
   * charge from before #423**, marked released by that migration's backfill
   * because Stripe had genuinely already paid the vendor. Refunding it here
   * would send the customer their money back and reverse nothing, leaving the
   * vendor holding their share of a booking that did not happen.
   *
   * Refused rather than unwound. Reversing it correctly means the old
   * `reverse_transfer` flag pair, which the current charge shape cannot carry
   * and the gateway now refuses outright — so serving it would mean a second
   * refund mode maintained forever on the money path, for a set of rows that is
   * empty in production and can never grow. A loud stop that reaches a human is
   * the smaller thing to own.
   */
  if (isLegacyDestinationPayout(booking)) {
    throw new AppError(
      409,
      ERROR_CODES.CONFLICT,
      'This booking was paid under an older arrangement and has to be refunded by support',
    );
  }

  /*
   * Stripe is asked what it already did before being told to do it again.
   *
   * The idempotency key covers concurrent and near-simultaneous retries, but
   * Stripe forgets a key after 24 hours — and the refund is sent *before* the
   * row moves, so an update that throws leaves the customer paid back on a
   * booking still reading `confirmed`, which they can cancel again tomorrow.
   * Without this read that second attempt is a second refund.
   */
  const alreadyRefunded = await context.stripe.findRefund(booking.stripePaymentIntentId);

  const refund =
    alreadyRefunded ??
    (await context.stripe.createRefund({
      paymentIntentId: booking.stripePaymentIntentId,
      amountCents: refundCents,
      reason: 'requested_by_customer',
      /*
       * Keyed on the booking, because the refund is sent *before* the guarded
       * update that decides who won. That update's status predicate means only
       * one of two concurrent cancels writes the row — but both reached this
       * line first, and without a key Stripe would have paid the customer twice
       * for one cancellation. The key makes the second call return the first
       * refund instead of creating another. One booking, one cancellation, one
       * refund. (#399)
       *
       * The `_direct` suffix is the request's version, not decoration. Stripe
       * refuses a key replayed with *different parameters*, so it changes
       * whenever the request under it does — it was `_unwind` while the refund
       * carried D31's two flags, and it is `_direct` now that the refund
       * carries neither (#423). A booking whose cancel was attempted in the
       * previous 24 hours under the old params would otherwise have its retry
       * refused with an `idempotency_error` rather than refunded.
       */
      idempotencyKey: `${keyPrefix}_${booking.id}_direct`,
    }));

  /*
   * The share the vendor keeps — the proportion of the total that was *not*
   * refunded, which at D3's 50% tier is half their payout and at the full tier
   * is nothing.
   *
   * Under the destination charge this needed no code: the money was already in
   * the vendor's balance and Stripe reversed only the refunded proportion, so
   * "the split survives the 50% tier" (D31) happened by itself. Under separate
   * charges **nobody holds that share but Orla**, so it has to be either paid
   * or written down — and a cancelled booking the sweep ignores would have made
   * the platform quietly keep it. Which of the two happens depends on whether
   * the payout has gone out yet.
   */
  const retainedPayoutCents =
    booking.vendorPayoutCents -
    reversalAmountCents({
      totalAmountCents: booking.totalAmountCents,
      vendorPayoutCents: booking.vendorPayoutCents,
      refundCents: refund.amountCents,
    });

  /*
   * After the release: the vendor has the whole payout, so the refunded
   * proportion is clawed back and they keep the rest where it already is.
   *
   * Before it: nothing was transferred, there is nothing to reverse and nobody
   * to carry negative — which is the cost D31 had to accept, now confined to
   * bookings cancelled after their event. The caller writes `retainedPayoutCents`
   * back to the row so the sweep still pays it out on the original schedule.
   */
  if (booking.stripeTransferId) {
    await reverseOutstanding(context, booking, {
      target: booking.vendorPayoutCents - retainedPayoutCents,
      idempotencyKey: `${keyPrefix}_${booking.id}_reversal`,
    });
  }

  return { ...refund, retainedPayoutCents };
}

/** A refund, and what of the vendor's share survives it. */
interface UnwoundRefund {
  refundId: string;
  amountCents: number;
  /**
   * The vendor's remaining claim after the refund — already reversed out of
   * their balance when the payout had gone out, still owed by Orla when it had
   * not.
   */
  retainedPayoutCents: number;
}

/**
 * Reverses only what has not been reversed already.
 *
 * The idempotency key guards a concurrent or near-simultaneous retry, and
 * Stripe forgets it after 24 hours — the same 24-hour hole `findRefund` exists
 * to cover on the refund. The reversal had no equivalent, and the state is
 * reachable: a post-release cancellation that reverses and then fails to write
 * the row leaves a `confirmed` booking the customer cancels again tomorrow.
 * `findRefund` correctly returns the first refund, but a second reversal is a
 * *fresh* request past the window, and Stripe refuses it as an over-reversal —
 * the rule `refusedReversalParams` models. That error escapes, and the booking
 * can then never be cancelled at all: refunded, still holding the date.
 *
 * Asking what is already reversed turns that into a no-op, exactly as asking
 * what is already refunded does.
 */
async function reverseOutstanding(
  context: BookingContext,
  booking: BookingRow,
  reversal: { target: number; idempotencyKey: string },
): Promise<void> {
  if (reversal.target <= 0 || !booking.stripeTransferId) {
    return;
  }

  const transfer = await context.stripe.findTransfer(transferGroupFor(booking.requestId));
  const outstanding = reversal.target - (transfer?.reversedCents ?? 0);

  if (outstanding <= 0) {
    return;
  }

  await context.stripe.reverseTransfer({
    transferId: booking.stripeTransferId,
    amountCents: outstanding,
    idempotencyKey: reversal.idempotencyKey,
  });
}

/**
 * The customer cancels, and the refund follows D3's fixed tiers.
 *
 * The tiers are untouched by #423 — only what a refund has to reverse changed.
 */
export async function cancelBooking(
  context: PaymentContext,
  user: AuthenticatedUser,
  bookingId: string,
  reason: string | undefined,
  now: Date,
): Promise<CancelledBooking> {
  const { booking, side } = await participantIn(context, user, bookingId);

  if (side !== 'customer') {
    throw forbidden('Only the customer can cancel a confirmed booking');
  }

  if (booking.status !== 'confirmed') {
    throw conflict(NOT_CANCELLABLE[booking.status]);
  }

  const quote = calculateRefund(booking.totalAmountCents, booking.eventDate, now);

  const refund = await refundAndUnwind(context, booking, quote.refundCents, 'cancel');

  const cancelled = await cancelBookingAndFreeDate(
    context.db,
    bookingId,
    {
      cancelledAt: now,
      cancellationReason: reason ?? null,
      /*
       * Written down rather than left to be inferred (#415). The customer's own
       * screen has to say who ended the booking and what came back, and neither
       * fact survives on the row otherwise: `cancellation_reason` is the
       * customer's free text here and an operator's sentence on the ban path, so
       * telling the two apart meant string-matching a copy edit, and the refund
       * figure existed only in this response.
       */
      cancelledBy: 'customer',
      refundAmountCents: refund.amountCents,
      /*
       * What the vendor keeps. Zero at the full-refund tier; half their share
       * inside the 48-hour cutoff, which the sweep pays out on the original
       * schedule rather than the platform quietly keeping it (D31, D3).
       */
      vendorPayoutCents: refund.retainedPayoutCents,
      disputeReason: null,
    },
    'confirmed',
    booking.payoutReleasedAt,
  );

  if (!cancelled) {
    /*
     * The refund is already out. Logged at error rather than thrown away,
     * because the money moved and the row did not — the one state that needs a
     * human to look at it.
     */
    context.log.error(
      { bookingId, refundId: refund.refundId, refundCents: refund.amountCents },
      'Refunded a booking whose row could not be cancelled',
    );
    throw conflict('That booking changed while you were cancelling it');
  }

  const vendorUserId = await findVendorUserId(context.db, cancelled.vendorId);

  if (vendorUserId) {
    await bestEffortNotice(context, { bookingId: cancelled.id }, () =>
      notify(
        context,
        vendorUserId,
        'booking_cancelled',
        {
          title: 'A booking was cancelled',
          body: `The date is free again on your calendar. ${unwindSentence(cancelled)}`,
          bookingId: cancelled.id,
        },
        'vendor',
      ),
    );
  }

  return {
    booking: toBookingView(cancelled),
    refundCents: refund.amountCents,
    /*
     * Read off the money that actually moved, not off the tier the quote would
     * have chosen. They agree on every first attempt. They part company on a
     * retry that finds an existing refund: a booking refunded in full yesterday
     * and cancelled again today past the cutoff would otherwise be announced as
     * a half refund while the customer has all of it back.
     */
    isFullRefund: refund.amountCents === booking.totalAmountCents,
  };
}

/**
 * One booking of the customer's own, by its id (#425).
 *
 * The report surface is reached by a URL anyone can paste, and it has to decide
 * from the row whether a hold is still possible — so it needs the booking, and
 * it needs the same 404 a stranger gets. `participantIn` gives both; the extra
 * refusal is that a **vendor** is not offered a control that is the customer's,
 * which is the rule `placeDisputeHold` applies to the send this read precedes.
 *
 * A point read and not the customer's booking list: the list is paginated, so a
 * booking past its first page resolved to nothing, and a pasted id that belongs
 * to nobody cost a full list fan-out on a public route.
 */
export async function findOwnBookingForReport(
  context: BookingContext,
  user: AuthenticatedUser,
  bookingId: string,
): Promise<Booking> {
  const { booking, side } = await participantIn(context, user, bookingId);

  if (side !== 'customer') {
    throw notFound('That booking does not exist');
  }

  return toBookingView(booking);
}

/**
 * The customer reports a problem, which **holds the payout** (#423).
 *
 * `disputed` was already in `BOOKING_STATUSES` and unused; nothing anywhere
 * wrote it and no surface could reach it. It is the hold state, and this is the
 * one place that sets it.
 *
 * Three refusals, and each is a different fact about what a report can still
 * change:
 *
 * - **Before the event**, there is nothing to report yet and cancelling is the
 *   right move — it comes with a refund tier and frees the date. Refused with
 *   the same universally-future test `completeBooking` uses, so a customer east
 *   of UTC is not told their event has not happened when it has. **This one is
 *   the customer's alone** — see `DisputeHoldOrigin`: it is advice about what
 *   they should do instead, and a card network's chargeback is not asking.
 * - **After the release**, the money is already with the vendor and a hold has
 *   nothing left to hold. #423 acceptance 11 offered a choice here and this
 *   takes the refusal: routing it into the post-release refund path would let a
 *   self-serve button claw a third party's balance negative on one party's
 *   say-so, which is an operator's judgement rather than a customer's. They are
 *   sent to support, where a human can still unwind it.
 * - **On a booking that is not theirs**, `participantIn` answers 404 — the same
 *   rule every read here applies, so a stranger walking ids learns nothing.
 *
 * **It is not an HTTP route, and deliberately (#425).** #423 shipped
 * `PUT /customer/bookings/:bookingId/dispute` for #425's surface to call; #425
 * routed the report through `/support/messages` instead, because the hold and
 * the complaint have to be one act. Leaving that route standing left a second
 * way to freeze a vendor's payout that filed no complaint at all — a hold an
 * operator finds with nothing to act on, and the exact half of acceptance 4
 * that must not be able to land alone. So the hold is a primitive now, with one
 * orchestrator: `sendSupportMessage`, which places it, sends the report, and
 * takes the hold back if it cannot.
 */
/**
 * The one `placeDisputeHold` refusal that is **retryable** (#431).
 *
 * Every other refusal it makes is a fact about the booking that will still
 * be true in a minute — the event has not happened, the payout has already
 * gone, the status cannot be disputed. This one means only that the row moved
 * between the read and the write, and the same request would very likely
 * succeed on a second attempt.
 *
 * A **type** rather than a message a caller matches on, because the caller
 * that needs to tell them apart is the chargeback webhook: it records the
 * permanent refusals on the operator's case and answers 200, and doing that
 * to a lost optimistic lock would file a retryable failure as a settled fact
 * and stop Stripe ever retrying it. Matching on the prose would have worked
 * until somebody edited the prose. The wire shape is unchanged: it is still a
 * 409 `CONFLICT` with the same sentence.
 */
export class StaleBookingError extends AppError {}

/**
 * Who is disputing — and therefore **which of the hold's refusals apply**.
 *
 * Not a flag to loosen a check. Two of `placeDisputeHold`'s three refusals are
 * facts about the money and hold for everybody: a booking whose payout has
 * already been transferred cannot be frozen, and one that is `cancelled` or
 * already `disputed` has nothing to freeze. The third is different in kind — it
 * is a judgement about **what a customer should do instead**, and it is the one
 * that has to know who is asking.
 *
 * - `customer` — the report form. Before the event there is nothing to report
 *   yet and cancelling is the right move: it comes with a refund tier and frees
 *   the date. That refusal is the product's advice and it stays.
 * - `network` — a chargeback (#431). A card network does not take advice. The
 *   money is at the platform, the customer's bank has claimed it back, and the
 *   sweep will otherwise pay the vendor the moment the event date passes —
 *   `RELEASABLE_STATUSES` includes `confirmed`, so a booking left unheld because
 *   its event was three months out is paid out on schedule with the chargeback
 *   still live. That is the exact loss #423's hold-until-the-event design
 *   exists to prevent, arriving through the one door that had opted out of it.
 *
 * **The consequence, stated rather than discovered later.** Before this,
 * `disputed` implied the event had happened, because this was its only writer
 * and it refused a future one. It no longer does, and the two pre-event
 * consumers see the difference:
 *
 * - `NOT_CANCELLABLE.disputed` refuses the customer's self-serve cancellation on
 *   a future booking a chargeback has frozen. **That is correct, and not a
 *   regression to fix.** They have already claimed the money back through their
 *   bank; letting them cancel on D3's tiers as well would refund one charge
 *   twice from a platform that has been debited once. The vendor's date stays
 *   blocked until an operator rules, which is the cost of a live chargeback
 *   rather than a defect in handling one.
 * - A second report from the customer on that booking is **not** refused.
 *   `AlreadyHeldError` below exists for exactly that case, because the
 *   alternative locked them out of support for the one booking they most needed
 *   to talk about.
 */
export type DisputeHoldOrigin = 'customer' | 'network';

/**
 * The booking is already on hold, so there is nothing for this caller to place.
 *
 * **Not a failure, and that is the point.** It used to be refused with
 * `NOT_DISPUTABLE.disputed` — *"You have already reported a problem with this
 * booking"* — which `sendSupportMessage` raises **before** the send, so the
 * message was never delivered. After #431 a chargeback can place the hold, and
 * then that sentence is told to a customer who filed nothing through the product
 * and who is now unable to reach support about that booking at all. The person
 * most likely to need the support form is the one who cannot get through, which
 * is the whole reason the route is public.
 *
 * A type rather than a message the caller matches on, for the same reason
 * `StaleBookingError` is one: the copy will be edited and a prose match would
 * not follow it.
 */
export class AlreadyHeldError extends AppError {}

export async function placeDisputeHold(
  context: BookingContext,
  user: AuthenticatedUser,
  bookingId: string,
  reason: string | undefined,
  now: Date,
  /** See `DisputeHoldOrigin`. Required rather than defaulted: a hold placed on
   *  the wrong rule set is a payout that moves when it should not, and a
   *  default is exactly the code no call site reads. */
  origin: DisputeHoldOrigin,
): Promise<BookingRow> {
  const { booking, side } = await participantIn(context, user, bookingId);

  if (side !== 'customer') {
    throw forbidden('Only the customer can report a problem with a booking');
  }

  if (booking.status === 'disputed') {
    /*
     * Distinguished from the other undisputable statuses because it is the one
     * that means "already done" rather than "cannot be done" — see
     * `AlreadyHeldError`. A second report on a held booking is a second message
     * to send, not a refusal to hand the sender.
     */
    throw new AlreadyHeldError(409, ERROR_CODES.CONFLICT, NOT_DISPUTABLE.disputed);
  }

  if (booking.status !== 'confirmed' && booking.status !== 'completed') {
    throw conflict(NOT_DISPUTABLE[booking.status]);
  }

  if (origin === 'customer' && isUniversallyFutureDate(booking.eventDate, now)) {
    throw conflict('That event has not happened yet — cancel the booking instead');
  }

  if (booking.payoutReleasedAt) {
    throw conflict(
      'This booking has already been paid out, so it cannot be put on hold. ' +
        'Contact support and we will look into it.',
    );
  }

  /*
   * Through `applyBookingTransition` like every other booking move, so the
   * customer's completed-bookings counter is refreshed in the same transaction.
   * A `completed` booking going on hold changes that figure, and a dispute
   * writer of its own would have been the fourth booking writer to forget.
   */
  const held = await applyBookingTransition(
    context.db,
    bookingId,
    booking.status,
    { status: 'disputed', disputeReason: reason ?? null },
    /*
     * The payout state the refusal above was decided on, re-asserted at write
     * time. `participantIn` reads without a lock, and the sweep changes
     * `payout_released_at` without changing `status` — so a hold placed while a
     * sweep was mid-transfer would otherwise land on a booking that had just
     * been paid out, which is precisely the state the guard exists to prevent
     * and which `resolveDispute` would then unwind by reversing a live transfer.
     */
    booking.payoutReleasedAt,
  );

  if (!held) {
    throw new StaleBookingError(
      409,
      ERROR_CODES.CONFLICT,
      'That booking changed while you were reporting it',
    );
  }

  return held;
}

/**
 * Takes a booking back out of `disputed`, whoever is lifting the hold.
 *
 * **The prior status is derived, never remembered.** The vendor either marked
 * the booking complete before the hold or they did not, and that fact is
 * already written down in `completed_at` — a `previousStatus` carried through
 * the caller would be a second copy of it, free to disagree. `resolveDispute`
 * settled that reasoning; this is the same lift, so it is the same function.
 *
 * `false` means the booking moved underneath us and the hold is no longer ours
 * to lift.
 */
export async function liftDisputeHold(
  context: BookingContext,
  booking: Pick<BookingRow, 'id' | 'completedAt'>,
  /**
   * `updated_at` as the caller last saw it, for a caller lifting **its own**
   * hold rather than whichever one is current.
   *
   * `resolveDispute` passes nothing, and should: an operator's ruling settles
   * the complaint that is open now. #425's unwind passes the row it wrote,
   * because between its hold and its failure an operator could have resolved
   * that complaint and the customer filed a second one — and lifting *that*
   * would release a payout against a report already in the inbox.
   */
  updatedBefore?: Date,
): Promise<BookingRow | null> {
  return applyBookingTransition(
    context.db,
    booking.id,
    'disputed',
    { status: booking.completedAt ? 'completed' : 'confirmed', disputeReason: null },
    undefined,
    updatedBefore,
  );
}

/** Who a hold has to be announced to, read once for the two things it feeds. */
export interface DisputeHoldAudience {
  bookingId: string;
  /** `null` for a vendor profile deleted since the booking. */
  vendorUserId: string | null;
  vendorBusinessName: string | null;
}

/**
 * The vendor behind a held booking, in one read.
 *
 * Both callers want the same row for two different reasons — the notification
 * needs the account, and #425's support report names the business in the email
 * a human triages — and asking twice was two round trips on the money path for
 * one primary-key lookup.
 */
export async function disputeHoldAudience(
  context: BookingContext,
  held: BookingRow,
): Promise<DisputeHoldAudience> {
  const vendor = await findVendorContact(context.db, held.vendorId);

  return {
    bookingId: held.id,
    vendorUserId: vendor?.userId ?? null,
    vendorBusinessName: vendor?.businessName ?? null,
  };
}

/**
 * The vendor is told their payout is frozen. Best effort, as every notice here
 * is — the hold is already written, and a bell that did not ring must not undo
 * money that did move.
 */
export async function announceDisputeHold(
  context: BookingContext,
  audience: DisputeHoldAudience,
): Promise<void> {
  const { bookingId, vendorUserId } = audience;

  if (!vendorUserId) {
    return;
  }

  await bestEffortNotice(context, { bookingId }, () =>
    notify(
      context,
      vendorUserId,
      'booking_cancelled',
      {
        title: 'A customer reported a problem',
        body: 'Your payout for this booking is on hold until we have looked into it.',
        bookingId,
      },
      'vendor',
    ),
  );
}

/**
 * An operator settles the complaint, and the money follows.
 *
 * In the **vendor's** favour the hold is simply lifted: the booking goes back
 * to whichever status it was in — `completed` if the vendor had marked it so,
 * `confirmed` otherwise, read off `completed_at` rather than remembered
 * separately — and the next sweep releases it, because the date has long since
 * passed. Nothing is transferred here; the sweep remains the only thing that
 * moves a payout.
 *
 * In the **customer's** favour the booking is cancelled and refunded **in
 * full**. Not on D3's tiers: those price a customer changing their mind against
 * how much notice they gave, and this is an operator's ruling that the service
 * was not delivered — a 50% refund because the complaint happened to be about
 * an event two days ago would price the vendor's failure as the customer's
 * lateness. Nothing has been transferred, so the refund is plain and no
 * vendor's balance is touched, which is the whole benefit of holding the money
 * until the event has happened.
 */
export async function resolveDispute(
  context: BookingContext,
  bookingId: string,
  outcome: DisputeOutcome,
  now: Date,
): Promise<Booking> {
  const booking = await findBookingById(context.db, bookingId);

  if (!booking) {
    throw notFound('That booking does not exist');
  }

  if (booking.status !== 'disputed') {
    throw conflict('That booking has no open report to resolve');
  }

  if (outcome === 'vendor') {
    /*
     * The prior status is **derived from `completed_at`** rather than remembered
     * in a column of its own: the vendor either marked the booking complete
     * before the dispute or they did not, and that fact is already written
     * down. A column holding "the status before the dispute" would be a second
     * copy of it, free to disagree.
     */
    const restored = await liftDisputeHold(context, booking);

    if (!restored) {
      throw conflict('That booking changed while you were resolving it');
    }

    await bestEffortNotice(context, { bookingId: restored.id }, () =>
      notify(context, restored.customerId, 'booking_completed', {
        title: 'We have reviewed your report',
        body: 'We were not able to uphold it, so the booking stands. Contact support to discuss it.',
        bookingId: restored.id,
      }),
    );

    return toBookingView(restored);
  }

  const refund = await refundAndUnwind(context, booking, booking.totalAmountCents, 'dispute');

  /*
   * `admin`, because an operator ended it and not the customer. The distinction
   * is what the customer's own screen reads to choose its words (#415), and a
   * booking somebody asked to have reviewed is not one they cancelled.
   */
  const cancelled = await cancelBookingAndFreeDate(
    context.db,
    bookingId,
    {
      cancelledAt: now,
      cancellationReason: "Resolved in the customer's favour after a reported problem",
      cancelledBy: 'admin',
      refundAmountCents: refund.amountCents,
      // A full refund, so the vendor keeps nothing and the sweep never pays it.
      vendorPayoutCents: refund.retainedPayoutCents,
      disputeReason: null,
    },
    'disputed',
    booking.payoutReleasedAt,
  );

  if (!cancelled) {
    context.log.error(
      { bookingId, refundId: refund.refundId, refundCents: refund.amountCents },
      'Refunded a disputed booking whose row could not be cancelled',
    );
    throw conflict('That booking changed while you were resolving it');
  }

  const vendorUserId = await findVendorUserId(context.db, cancelled.vendorId);

  await bestEffortNotice(context, { bookingId: cancelled.id }, async () => {
    await notify(context, cancelled.customerId, 'booking_cancelled', {
      title: 'Your report was upheld',
      body: 'The booking is cancelled and your payment has been refunded in full.',
      bookingId: cancelled.id,
    });

    if (vendorUserId) {
      await notify(
        context,
        vendorUserId,
        'booking_cancelled',
        {
          title: 'A reported booking was refunded',
          body: `The customer's report was upheld. ${unwindSentence(cancelled)}`,
          bookingId: cancelled.id,
        },
        'vendor',
      );
    }
  });

  return toBookingView(cancelled);
}
