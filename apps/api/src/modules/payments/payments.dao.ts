import { and, eq, sql } from 'drizzle-orm';
import {
  availability,
  bookingRequests,
  bookings,
  servicePackages,
  vendorProfiles,
  type BookingRow,
  type NewBookingRow,
} from '@vendor-marketplace/db/schema';
import type { AppDatabase } from '../../lib/database.js';

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
  acceptedAt: Date | null;
  /** The intent recorded when checkout was opened, for reconciliation. */
  stripePaymentIntentId: string | null;
  vendorSlug: string;
  vendorBusinessName: string;
  vendorAvatarUrl: string | null;
  vendorStripeAccountId: string | null;
  vendorStripeOnboarded: boolean;
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
      acceptedAt: bookingRequests.acceptedAt,
      stripePaymentIntentId: bookingRequests.stripePaymentIntentId,
      vendorSlug: vendorProfiles.slug,
      vendorBusinessName: vendorProfiles.businessName,
      vendorAvatarUrl: vendorProfiles.profileImageUrl,
      vendorStripeAccountId: vendorProfiles.stripeAccountId,
      vendorStripeOnboarded: vendorProfiles.stripeOnboarded,
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
 */
export async function findBookingByRequest(
  db: AppDatabase,
  requestId: string,
): Promise<BookingWithEventTypeRow | null> {
  const rows = await db
    .select({ booking: bookings, eventType: bookingRequests.eventType })
    .from(bookings)
    .innerJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .where(eq(bookings.requestId, requestId))
    .limit(1);

  const row = rows?.[0];

  return row ? { ...row.booking, eventType: row.eventType } : null;
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

    return row;
  });
}

/** Moves a booking between statuses, but only from the one the caller read. */
export async function applyBookingTransition(
  db: AppDatabase,
  bookingId: string,
  from: BookingRow['status'],
  patch: Partial<NewBookingRow>,
): Promise<BookingRow | null> {
  const updated = await db
    .update(bookings)
    .set({ ...patch, updatedAt: sql`now()` })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, from)))
    .returning();

  return updated?.[0] ?? null;
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
export async function cancelBookingAndFreeDate(
  db: AppDatabase,
  bookingId: string,
  patch: Partial<NewBookingRow>,
): Promise<BookingRow | null> {
  return db.transaction(async (tx) => {
    const updated = await tx
      .update(bookings)
      .set({ ...patch, status: 'cancelled', updatedAt: sql`now()` })
      .where(and(eq(bookings.id, bookingId), eq(bookings.status, 'confirmed')))
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

    return row;
  });
}
