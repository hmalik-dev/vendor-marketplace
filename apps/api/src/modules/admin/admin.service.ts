import type { FastifyBaseLogger } from 'fastify';
import type {
  AdminBanResult,
  AdminVendorPage,
  AdminVendorQuery,
  AdminVendorRow,
  AdminVendorStatus,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';
import type { EventHub } from '../../lib/event-stream.js';
import type { StripeConnectGateway } from '../../lib/stripe.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { insertNotification } from '../messaging/messaging.dao.js';
import { cancelBookingAndFreeDate } from '../payments/payments.dao.js';
import {
  countAdminVendors,
  countVendorsAwaitingReview,
  declineOpenRequests,
  findAdminVendors,
  findConfirmedBookingsToUnwind,
  findUserById,
  findVendorOwnerId,
  findVendorProfileByUserId,
  setBanned,
  type AdminVendorFilters,
  type AdminVendorProjection,
} from './admin.dao.js';

/** Everything an admin operation needs. Mirrors `PaymentContext`, for the same reason. */
export interface AdminContext {
  db: AppDatabase;
  stripe: StripeConnectGateway;
  hub: EventHub;
  log: FastifyBaseLogger;
}

/**
 * The four statuses, derived from the three columns that actually record state.
 *
 * Order matters and is the same order `statusCondition` filters in: a banned
 * vendor is `flagged` whatever their publish flag says, because the ban is the
 * fact an operator needs to see first.
 */
export function deriveVendorStatus(row: {
  isBanned: boolean;
  isPublished: boolean;
  stripeOnboarded: boolean;
}): AdminVendorStatus {
  if (row.isBanned) {
    return 'flagged';
  }

  if (row.isPublished) {
    return 'live';
  }

  return row.stripeOnboarded ? 'paused' : 'review';
}

function toVendorRow(row: AdminVendorProjection): AdminVendorRow {
  return {
    id: row.id,
    userId: row.userId,
    businessName: row.businessName,
    slug: row.slug,
    categoryName: row.categoryName,
    city: row.city,
    state: row.state,
    avgRating: row.avgRating,
    reviewCount: row.reviewCount,
    bookingsCount: row.bookingsCount,
    status: deriveVendorStatus(row),
    stripeOnboarded: row.stripeOnboarded,
    createdAt: row.createdAt,
  };
}

export async function listVendors(
  db: AppDatabase,
  query: AdminVendorQuery,
): Promise<AdminVendorPage> {
  const filters: AdminVendorFilters = {
    q: query.q,
    category: query.category,
    city: query.city,
    payouts: query.payouts,
    status: query.status,
  };
  const offset = (query.page - 1) * query.pageSize;

  /*
   * The two counts run against the same filters as the page, so the count line
   * can never describe a different set from the rows under it. `awaitingReview`
   * deliberately ignores `status` — it is the saved filter's own badge, and it
   * has to keep reporting how many are waiting while the table shows `live`.
   */
  const [rows, total, awaitingReview] = await Promise.all([
    findAdminVendors(db, filters, query.pageSize, offset),
    countAdminVendors(db, filters),
    countVendorsAwaitingReview(db, { ...filters, status: undefined }),
  ]);

  return {
    items: rows.map(toVendorRow),
    total,
    awaitingReview,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/**
 * Bans or unbans an account.
 *
 * **A ban is not just a flag.** It has to leave the marketplace in a state where
 * nobody is waiting on an account that can no longer answer: open requests are
 * declined, future confirmed bookings are cancelled and refunded **in full**,
 * and a vendor's storefront comes down.
 *
 * The refund is deliberately full rather than D3's cancellation tiers. Those
 * tiers price a *customer's* change of mind. Here the platform is removing a
 * party from a transaction the other side did nothing wrong in, so charging
 * them a cancellation penalty for our moderation decision would be indefensible.
 *
 * Order is the same one `cancelBooking` argues for and for the same reason: the
 * money moves before the row does. A refund that succeeded against a booking
 * that then failed to update is recoverable; a cancelled booking whose refund
 * never happened tells someone their money is coming back when it is not.
 */
export async function setUserBanned(
  context: AdminContext,
  actorId: string,
  targetId: string,
  isBanned: boolean,
  now: Date,
): Promise<AdminBanResult> {
  if (actorId === targetId) {
    /*
     * 403 rather than 400: this is a refusal about who the caller is, not about
     * the shape of what they sent. An admin who could ban themselves could lock
     * the platform's only operator out of it, and nothing else could undo it.
     */
    throw forbidden('You cannot ban your own account');
  }

  const target = await findUserById(context.db, targetId);

  if (!target) {
    throw notFound('No account with that id');
  }

  if (target.isBanned === isBanned) {
    throw conflict(isBanned ? 'That account is already banned' : 'That account is not banned');
  }

  const profile = await findVendorProfileByUserId(context.db, targetId);

  if (!isBanned) {
    /*
     * Unban is only the flag. The vendor republishes themselves — reinstating an
     * account is not the same as reinstating a listing, and the operator does not
     * decide when a vendor is ready to trade again.
     */
    const { profileUnpublished } = await setBanned(
      context.db,
      targetId,
      profile?.id ?? null,
      false,
      now,
    );

    return {
      userId: targetId,
      isBanned: false,
      requestsDeclined: 0,
      bookingsCancelled: 0,
      refundsIssued: 0,
      profileUnpublished,
    };
  }

  const today = now.toISOString().slice(0, 10);
  const affected = await findConfirmedBookingsToUnwind(
    context.db,
    targetId,
    profile?.id ?? null,
    today,
  );

  let refundsIssued = 0;
  let bookingsCancelled = 0;

  for (const booking of affected) {
    if (booking.stripePaymentIntentId) {
      try {
        await context.stripe.createRefund({
          paymentIntentId: booking.stripePaymentIntentId,
          amountCents: booking.totalAmountCents,
        });
        refundsIssued += 1;
      } catch (error) {
        /*
         * One failed refund must not abandon the rest of the ban. The account is
         * still removed, the remaining bookings are still unwound, and this one
         * is logged loudly because the money did not move and only a human can
         * finish it.
         */
        context.log.error(
          { bookingId: booking.id, err: error },
          'Refund failed while banning an account',
        );
        continue;
      }
    }

    const cancelled = await cancelBookingAndFreeDate(context.db, booking.id, {
      cancelledAt: now,
      cancellationReason: 'The other party’s account was suspended',
    });

    if (!cancelled) {
      continue;
    }

    bookingsCancelled += 1;

    const vendorUserId = await findVendorOwnerId(context.db, booking.vendorId);
    const recipients = [booking.customerId, vendorUserId].filter(
      (id): id is string => typeof id === 'string' && id !== targetId,
    );

    for (const recipient of recipients) {
      const stored = await insertNotification(context.db, {
        userId: recipient,
        type: 'booking_cancelled',
        title: 'A booking was cancelled',
        body: 'The other party’s account was suspended. Your payment has been refunded in full.',
        data: { bookingId: booking.id },
      });

      if (stored) {
        context.hub.publish(recipient, {
          type: 'new_notification',
          notification: {
            id: stored.id,
            type: stored.type,
            title: stored.title,
            body: stored.body,
            href: '/bookings',
            isRead: false,
            createdAt: stored.createdAt,
          },
        });
      }
    }
  }

  const requestsDeclined = await declineOpenRequests(
    context.db,
    targetId,
    profile?.id ?? null,
    now,
  );
  const { profileUnpublished } = await setBanned(
    context.db,
    targetId,
    profile?.id ?? null,
    true,
    now,
  );

  return {
    userId: targetId,
    isBanned: true,
    requestsDeclined,
    bookingsCancelled,
    refundsIssued,
    profileUnpublished,
  };
}
