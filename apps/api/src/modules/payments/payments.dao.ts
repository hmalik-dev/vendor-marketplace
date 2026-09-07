import { and, eq, isNull, ne, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  legalAcceptances,
  servicePackages,
  vendorProfiles,
  type BookingRow,
  type NewBookingRow,
} from '@vendor-marketplace/db/schema';
import { refreshCustomerBookingCounts } from '@vendor-marketplace/db';
import {
  CURRENT_VENDOR_AGREEMENT_VERSION,
  type BookingCancelledBy,
  type LegalAcceptanceDocument,
} from '@vendor-marketplace/shared';
import type { AppDatabase } from '../../lib/database.js';

/**
 * Typed rather than written into the SQL as a bare string, so a rename of the
 * enum member is a compile error here instead of an `EXISTS` that silently
 * matches nothing and refuses every charge.
 */
const VENDOR_AGREEMENT: LegalAcceptanceDocument = 'vendor_agreement';

/**
 * Everything the checkout needs about one accepted request, in one read.
 *
 * The vendor's payout account and onboarding flag travel with it because the
 * payment cannot be created without the first and must be refused without the
 * second — and asking for them separately would leave a window where the answer
 * changed between the two reads.
 */
export interface PayableRequestRow {
  requestId: string;
  customerId: string;
  vendorId: string;
  status: string;
  eventDate: string;
  eventLocation: string | null;
  /** The occasion, which the confirmed screen renders beside the venue. */
  eventType: string | null;
  guestCount: number | null;
  /** The price locked when the request was made or quoted. */
  finalPriceCents: number | null;
  quotedPriceCents: number | null;
  packagePriceCents: number | null;
  /** What the rail names under the vendor — `null` for a custom request. */
  packageName: string | null;
  /** NUMERIC, so the driver hands it back as a string. */
  packageDurationHours: string | null;
  acceptedAt: Date | null;
  /** The intent recorded when checkout was opened, for reconciliation. */
  stripePaymentIntentId: string | null;
  vendorSlug: string;
  vendorBusinessName: string;
  vendorAvatarUrl: string | null;
  vendorStripeAccountId: string | null;
  vendorStripeOnboarded: boolean;
  /**
   * Whether the vendor holds the **current** vendor agreement.
   *
   * Travels with the row for the same reason the two Stripe columns do: the
   * charge must be refused without it, and a second read would leave a window
   * in which the answer changed. An `EXISTS` rather than a join, because the
   * table is append-only and a vendor can hold several rows — a join would
   * multiply the request row by however many times they have accepted.
   */
  vendorHoldsCurrentAgreement: boolean;
}

export async function findPayableRequest(
  db: AppDatabase,
  requestId: string,
): Promise<PayableRequestRow | null> {
  const rows = await db
    .select({
      requestId: bookingRequests.id,
      customerId: bookingRequests.customerId,
      vendorId: bookingRequests.vendorId,
      status: bookingRequests.status,
      eventDate: bookingRequests.eventDate,
      eventLocation: bookingRequests.eventLocation,
      eventType: bookingRequests.eventType,
      guestCount: bookingRequests.guestCount,
      finalPriceCents: bookingRequests.finalPriceCents,
      quotedPriceCents: bookingRequests.quotedPriceCents,
      packagePriceCents: servicePackages.priceCents,
      packageName: servicePackages.name,
      packageDurationHours: servicePackages.durationHours,
      acceptedAt: bookingRequests.acceptedAt,
      stripePaymentIntentId: bookingRequests.stripePaymentIntentId,
      vendorSlug: vendorProfiles.slug,
      vendorBusinessName: vendorProfiles.businessName,
      vendorAvatarUrl: vendorProfiles.profileImageUrl,
      vendorStripeAccountId: vendorProfiles.stripeAccountId,
      vendorStripeOnboarded: vendorProfiles.stripeOnboarded,
      vendorHoldsCurrentAgreement: sql<boolean>`EXISTS (
        SELECT 1 FROM ${legalAcceptances}
        WHERE ${legalAcceptances.vendorId} = ${vendorProfiles.id}
          AND ${legalAcceptances.document} = ${VENDOR_AGREEMENT}
          AND ${legalAcceptances.version} = ${CURRENT_VENDOR_AGREEMENT_VERSION}
      )`,
    })
    .from(bookingRequests)
    .innerJoin(vendorProfiles, eq(bookingRequests.vendorId, vendorProfiles.id))
    .leftJoin(servicePackages, eq(bookingRequests.packageId, servicePackages.id))
    .where(eq(bookingRequests.id, requestId))
    .limit(1);

  return rows?.[0] ?? null;
}

/** A booking with the occasion the confirmed screen renders beside the venue. */
export interface BookingWithEventTypeRow extends BookingRow {
  eventType: string | null;
}

/**
 * The booking a request produced, or `null` if payment has not landed yet.
 *
 * Joined to the request for `event_type`, which lives there rather than on the
 * booking — the same join `findBookings` makes for the hub, and for the same
 * reason: frame `06` reads "Wedding · Barr Mansion", and a second round trip
 * per booking to say so is not worth it.
 *
 * **A cancelled booking is not the answer to this question** (#400). Without the
 * filter, every read built on this one kept reporting a cancelled booking as
 * the request's payment: checkout redirected to the confirmation, and the
 * detail page told the customer who had just cancelled that the vendor "is
 * booked", showed the amount paid, and offered `Cancel booking` a second time —
 * which then answered 409. `completed` is deliberately still found: the event
 * happened and was paid for, and the confirmation is the record of it.
 */
export async function findBookingByRequest(
  db: AppDatabase,
  requestId: string,
): Promise<BookingWithEventTypeRow | null> {
  const rows = await db
    .select({ booking: bookings, eventType: bookingRequests.eventType })
    .from(bookings)
    .innerJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .where(and(eq(bookings.requestId, requestId), ne(bookings.status, 'cancelled')))
    .limit(1);

  const row = rows?.[0];

  return row ? { ...row.booking, eventType: row.eventType } : null;
}

/**
 * The booking a request produced, **whatever became of it**.
 *
 * The filtered read above is for the customer's surfaces: it answers "is this
 * request paid for", and a cancelled booking is not. This one answers "has a
 * booking row ever been written for this request", which is a different
 * question and the only correct one for idempotency.
 *
 * They were the same function until #400 narrowed it, and that broke the Stripe
 * webhook: `recordSuccessfulPayment` uses this read twice — once to recognise a
 * delivery it has already handled, once when two deliveries race and the other
 * wins — and with the filter, a redelivery after a cancellation found nothing,
 * fell through to `confirmBooking`, conflicted on `bookings_request_id_key`,
 * and answered 409. Stripe retries a non-2xx for three days and disables an
 * endpoint that keeps failing, so the customer-facing narrowing would have cost
 * the webhook endpoint itself.
 */
export async function findAnyBookingByRequest(
  db: AppDatabase,
  requestId: string,
): Promise<BookingRow | null> {
  const rows = await db.select().from(bookings).where(eq(bookings.requestId, requestId)).limit(1);

  return rows?.[0] ?? null;
}

export async function findBookingById(
  db: AppDatabase,
  bookingId: string,
): Promise<BookingRow | null> {
  const rows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);

  return rows?.[0] ?? null;
}

/**
 * Records the intent on the request so a webhook that never arrives can still
 * be reconciled: without this, a paid customer and an unpaid-looking request
 * are indistinguishable from a customer who opened checkout and walked away.
 *
 * Scoped to `accepted` for the same reason `applyTransition` is scoped: a
 * cancellation racing a checkout must not have an intent written onto it.
 */
export async function recordPaymentIntent(
  db: AppDatabase,
  requestId: string,
  paymentIntentId: string,
): Promise<void> {
  await db
    .update(bookingRequests)
    .set({ stripePaymentIntentId: paymentIntentId, updatedAt: sql`now()` })
    .where(and(eq(bookingRequests.id, requestId), eq(bookingRequests.status, 'accepted')));
}

/** What a successful charge writes, as one row. */
export interface ConfirmBookingInput {
  booking: NewBookingRow;
}

/**
 * The booking, the held date and nothing else — in **one transaction**.
 *
 * Both writes or neither. A booking row without its `booked` availability row
 * is a Saturday the vendor can still be asked for and has already sold; an
 * availability row without its booking is a date held for a payment that was
 * never recorded. Neither half is recoverable by a retry, because the retry
 * would find the half that committed and take the "already done" branch.
 *
 * Returns `null` when the booking already exists — `bookings_request_id_key`
 * makes that the second delivery of the same webhook rather than an error, and
 * Stripe retries a webhook it could not confirm for three days.
 */
export async function confirmBooking(
  db: AppDatabase,
  input: ConfirmBookingInput,
): Promise<BookingRow | null> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(bookings)
      .values(input.booking)
      .onConflictDoNothing({ target: bookings.requestId })
      .returning();

    const row = inserted?.[0];

    if (!row) {
      return null;
    }

    /*
     * `booked`, not `blocked`. The distinction is the product's: a `blocked`
     * date is one the vendor held for themselves and may still say yes to, and
     * `createBookingRequest` lets a customer ask anyway. A `booked` date is
     * sold, and it is a hard refusal.
     *
     * `DO UPDATE` rather than `DO NOTHING`: a vendor who marked the day
     * `blocked` for a hold and then sold it must end up `booked`, and a
     * conflict that silently kept `blocked` would leave the day requestable by
     * the next customer.
     */
    await tx
      .insert(availability)
      .values({ vendorId: row.vendorId, date: row.eventDate, status: 'booked' })
      .onConflictDoUpdate({
        target: [availability.vendorId, availability.date],
        set: { status: 'booked' },
      });

    await refreshCustomerBookingCounts(tx, row.customerId);

    return row;
  });
}

/** Moves a booking between statuses, but only from the one the caller read. */
export async function applyBookingTransition(
  db: AppDatabase,
  bookingId: string,
  from: BookingRow['status'],
  patch: Partial<NewBookingRow>,
  /**
   * The payout state the caller decided on, when it decided on one.
   *
   * `undefined` leaves the write guarded by `status` alone, which is right for
   * a transition that does not care — `markComplete`. The dispute hold does
   * care: the payout sweep moves `payout_released_at` **without touching
   * `status`**, so a hold whose refusal check ran before a sweep committed
   * would otherwise be written onto a booking that had just been paid out.
   */
  releasedBefore?: Date | null,
): Promise<BookingRow | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ ...patch, updatedAt: sql`now()` })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, from),
          releasedBefore === undefined
            ? undefined
            : releasedBefore === null
              ? isNull(bookings.payoutReleasedAt)
              : eq(bookings.payoutReleasedAt, releasedBefore),
        ),
      )
      .returning();

    const row = updated?.[0];

    if (!row) {
      return null;
    }

    /*
     * In the transaction with the move, like the other two writers. `completed`
     * is terminal, so a recompute that failed on its own would leave this
     * customer's counters stale until some *other* booking of theirs moved.
     */
    await refreshCustomerBookingCounts(tx, row.customerId);

    return row;
  });
}

/**
 * Cancels the booking and frees the date, together.
 *
 * The date is released to `available` rather than deleted: a vendor who had
 * marked it `blocked` before it sold gets `available` back either way, which is
 * the wrong answer for them but the right one for the customer looking at their
 * calendar — and re-deriving the pre-sale state is not possible from this row.
 * Deleting instead would be identical in effect, since an absent date already
 * reads as available; the explicit row is kept so the calendar shows the vendor
 * that something happened to that day.
 */
/**
 * What every cancellation must record about itself (#415).
 *
 * Required, not an open `Partial<NewBookingRow>`. Both screens that describe a
 * cancelled booking read these four, and the two that matter cannot be
 * recovered afterwards: who acted is otherwise only a sentence in
 * `cancellation_reason`, and the refund figure exists nowhere but the response
 * of the call that sent it. Making them a parameter puts the invariant in the
 * one function every cancellation goes through, rather than in two call sites'
 * comments — a third path would have to write nulls on purpose.
 */
export interface CancellationRecord {
  cancelledAt: Date;
  /** The customer's own words, the operator's sentence, or nothing. */
  cancellationReason: string | null;
  cancelledBy: BookingCancelledBy;
  /** What Stripe actually moved. `null` when there was no payment to return. */
  refundAmountCents: number | null;
  /**
   * What the vendor is still owed after the refund — zero for a full one.
   *
   * Required rather than optional for the reason the four fields above are: it
   * is the figure the payout sweep pays, and a cancellation path that forgot to
   * state it would leave the vendor's whole pre-release share sitting with the
   * platform, silently.
   */
  vendorPayoutCents: number;
  /**
   * Cleared, because the complaint is settled once the booking is cancelled.
   *
   * The vendor-favour branch of `resolveDispute` clears it; this is the other
   * branch, and without it the text survives on a resolved row — so any later
   * reader treating `dispute_reason` as "there is an open complaint" would be
   * wrong for every upheld dispute.
   */
  disputeReason: null;
}

export async function cancelBookingAndFreeDate(
  db: AppDatabase,
  bookingId: string,
  patch: CancellationRecord,
  /**
   * The status the caller read, and the only one this write will move from.
   *
   * A parameter rather than a hard-coded `'confirmed'` because a dispute upheld
   * in the customer's favour cancels a **`disputed`** booking (#423), and the
   * alternative was a second copy of this transaction differing in one word —
   * with the availability release, the parent request settlement and the
   * counter refresh duplicated alongside it. The guard is unchanged in kind:
   * only a booking still in the state the caller saw is moved.
   */
  from: BookingRow['status'] = 'confirmed',
  /**
   * The payout state the caller read before it moved money, re-asserted here.
   *
   * `status` alone is not enough any more, because #423 added a **second money
   * mover that never changes it**: the payout sweep claims a booking on
   * `status in (confirmed, completed)` and `payout_released_at is null`, and
   * commits a transfer without touching `status`. A cancellation whose two
   * Stripe calls overlap a sweep tick would otherwise refund on the strength of
   * "nothing has been transferred", have that stop being true underneath it,
   * and still match this predicate — paying the refund *and* the payout.
   *
   * Passing the value the decision was made on turns that into an ordinary
   * conflict: the loser gets "that booking changed while you were cancelling
   * it", and its retry re-reads the row, sees the transfer, and reverses.
   */
  releasedBefore: Date | null = null,
): Promise<BookingRow | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ ...patch, status: 'cancelled', updatedAt: sql`now()` })
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.status, from),
          releasedBefore === null
            ? isNull(bookings.payoutReleasedAt)
            : eq(bookings.payoutReleasedAt, releasedBefore),
        ),
      )
      .returning();

    const row = updated?.[0];

    if (!row) {
      return null;
    }

    await tx
      .insert(availability)
      .values({ vendorId: row.vendorId, date: row.eventDate, status: 'available' })
      .onConflictDoUpdate({
        target: [availability.vendorId, availability.date],
        set: { status: 'available' },
      });

    /*
     * And the request the booking came from, in the same transaction (#400).
     *
     * Without this the row stayed `accepted`, and `syncHeldDate` derives a
     * vendor's calendar cell from the statuses on that date — so the next
     * transition touching the day found an accepted request and wrote `booked`
     * again, for a booking that no longer exists. Nothing could undo it:
     * `setOwnAvailability` refuses a booked cell, and `setHeldDate(null)`
     * would not delete one while a `bookings` row sat on the date. The date was
     * sold, refunded, and then permanently unsellable.
     *
     * Written here rather than through `BOOKING_REQUEST_TRANSITIONS` because
     * this is not a party's move: opening `accepted -> cancelled` on that map
     * would also let a customer withdraw an accepted request through the
     * transition endpoint, with no refund and no booking cancelled. The
     * predicate is what keeps it honest — only an `accepted` row settles, so a
     * request already declined or expired is left as it is.
     */
    await tx
      .update(bookingRequests)
      .set({ status: 'cancelled', updatedAt: sql`now()` })
      .where(and(eq(bookingRequests.id, row.requestId), eq(bookingRequests.status, 'accepted')));

    await refreshCustomerBookingCounts(tx, row.customerId);

    return row;
  });
}
