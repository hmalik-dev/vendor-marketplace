import {
  ERROR_CODES,
  MIN_BOOKING_AMOUNT_CENTS,
  calculateFees,
  calculateRefund,
  type CancelledBooking,
  type CheckoutIntent,
} from '@vendor-marketplace/shared';
import type { BookingRow } from '@vendor-marketplace/db/schema';
import type { FastifyBaseLogger } from 'fastify';
import type { AppDatabase } from '../../lib/database.js';
import {
  sendNotificationEmail,
  type NotificationEmailDeps,
} from '../notifications/notification-email.js';
import type { EventHub } from '../../lib/event-stream.js';
import { AppError, conflict, forbidden, notFound, validationFailed } from '../../lib/errors.js';
import {
  PAYMENT_INTENT_SUCCEEDED,
  type PaymentIntentSnapshot,
  type StripeConnectGateway,
} from '../../lib/stripe.js';
import type { AuthenticatedUser } from '../../plugins/clerk-auth.js';
import { findVendorByUserId, findVendorUserId } from '../booking-requests/booking-requests.dao.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { notificationHref } from '../messaging/messaging.service.js';
import {
  applyBookingTransition,
  cancelBookingAndFreeDate,
  confirmBooking,
  findBookingById,
  findBookingByRequest,
  findPayableRequest,
  recordPaymentIntent,
  type PayableRequestRow,
} from './payments.dao.js';

/** What every function here needs, so the shape is declared once. */
export interface PaymentContext {
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

  const { platformFeeCents } = calculateFees(amountCents, context.platformFeeRate);

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

  const intent = await context.stripe.createPaymentIntent({
    requestId,
    amountCents,
    applicationFeeCents: platformFeeCents,
    destinationAccountId: row.vendorStripeAccountId as string,
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
    acceptedAt: row.acceptedAt,
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

  const existing = await findBookingByRequest(context.db, requestId);

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
    const settled = await findBookingByRequest(context.db, requestId);

    if (!settled) {
      throw conflict('That booking could not be recorded');
    }

    return { booking: settled, created: false };
  }

  await announceBooking(context, booking, row.vendorBusinessName);

  return { booking, created: true };
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
  context: PaymentContext,
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
     * after `confirmBooking` commits — and `sendNotificationEmail` swallows its
     * own failures so a booking that succeeded cannot appear to fail.
     */
    await sendNotificationEmail(context.mail, stored, audience);
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
): Promise<BookingRow | null> {
  const existing = await findBookingByRequest(context.db, requestId);

  if (existing) {
    return existing;
  }

  const row = await findPayableRequest(context.db, requestId);

  if (!row || row.customerId !== user.id || !row.stripePaymentIntentId) {
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

  return booking;
}

/** The two sides of a booking, and which one this caller is. */
async function participantIn(
  context: PaymentContext,
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
 * The vendor marks the work done, which releases the money.
 *
 * No transfer is made here, and that is not an omission: the charge was a
 * destination charge, so Stripe already routed the payout share to the vendor's
 * account when it settled. Completion is the record that the event happened and
 * the trigger for the review invitation.
 */
export async function completeBooking(
  context: PaymentContext,
  user: AuthenticatedUser,
  bookingId: string,
  today: string,
): Promise<BookingRow> {
  const { booking, side } = await participantIn(context, user, bookingId);

  if (side !== 'vendor') {
    throw forbidden('Only the vendor can mark a booking complete');
  }

  if (booking.status !== 'confirmed') {
    throw conflict(
      booking.status === 'completed'
        ? 'That booking is already marked complete'
        : 'That booking was cancelled and cannot be completed',
    );
  }

  /*
   * String comparison on two `YYYY-MM-DD` values, deliberately: both are
   * calendar dates and neither has a time, so any comparison through `Date`
   * would introduce a timezone that is not in either of them.
   */
  if (booking.eventDate > today) {
    throw conflict('That event has not happened yet');
  }

  const completed = await applyBookingTransition(context.db, bookingId, 'confirmed', {
    status: 'completed',
    completedAt: new Date(),
  });

  if (!completed) {
    throw conflict('That booking changed while you were completing it');
  }

  await notify(context, completed.customerId, 'booking_completed', {
    title: 'Your event is wrapped up',
    body: 'The vendor marked it complete. Leave them a review when you have a moment.',
    bookingId: completed.id,
  });

  return completed;
}

/**
 * The customer cancels, and the refund follows D3's fixed tiers.
 *
 * The refund is taken **before** the row moves. A cancelled booking whose
 * refund then failed would tell the customer their money is coming back when
 * nothing was returned — and there is no way to notice from the row afterwards.
 * A refund that succeeded against a booking that then failed to update is the
 * recoverable direction: the money is where it should be and the row can be
 * fixed.
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
    throw conflict(
      booking.status === 'completed'
        ? 'That event already happened, so it cannot be cancelled'
        : 'That booking is already cancelled',
    );
  }

  const quote = calculateRefund(booking.totalAmountCents, booking.eventDate, now);

  if (!booking.stripePaymentIntentId) {
    throw new AppError(
      500,
      ERROR_CODES.INTERNAL_ERROR,
      'That booking has no payment on record and cannot be refunded here',
    );
  }

  const refund = await context.stripe.createRefund({
    paymentIntentId: booking.stripePaymentIntentId,
    amountCents: quote.refundCents,
    reason: 'requested_by_customer',
  });

  const cancelled = await cancelBookingAndFreeDate(context.db, bookingId, {
    cancelledAt: now,
    cancellationReason: reason ?? null,
  });

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
    await notify(
      context,
      vendorUserId,
      'booking_cancelled',
      {
        title: 'A booking was cancelled',
        body: 'The date is free again on your calendar.',
        bookingId: cancelled.id,
      },
      'vendor',
    );
  }

  return {
    booking: cancelled,
    refundCents: refund.amountCents,
    isFullRefund: quote.isFullRefund,
  };
}
