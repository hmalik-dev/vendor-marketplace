import type { Booking, BookingWithContext } from '@vendor-marketplace/shared';
import type { BookingRow } from '@vendor-marketplace/db/schema';

/**
 * The booking row as the two hubs and the confirmed screen read it.
 *
 * **An explicit projection, not a spread (#407).** The row carries the
 * platform's commission, the vendor's payout split and the two Stripe
 * identifiers; the reads that answer `bookingWithContextSchema` are reached by
 * the customer, for whom `payments.service.ts` already records that the
 * commission "is none of their business". Listing the fields is what makes the
 * omission survive: `{ ...booking }` hands the serializer everything and leaves
 * the boundary one widened response schema away from publishing it again.
 *
 * `eventType` lives on the request rather than the booking, and `venue` mirrors
 * `eventLocation`, so both reads assemble the same shape from the same place.
 */
export function toBookingWithContext(
  booking: BookingRow,
  eventType: string | null,
): BookingWithContext {
  return { ...toBookingView(booking), eventType, venue: booking.eventLocation };
}

/** The same projection for the routes that answer a booking with no context. */
export function toBookingView(booking: BookingRow): Booking {
  return {
    id: booking.id,
    requestId: booking.requestId,
    customerId: booking.customerId,
    vendorId: booking.vendorId,
    eventDate: booking.eventDate,
    eventLocation: booking.eventLocation,
    totalAmountCents: booking.totalAmountCents,
    status: booking.status,
    paidAt: booking.paidAt,
    completedAt: booking.completedAt,
    cancelledAt: booking.cancelledAt,
    cancellationReason: booking.cancellationReason,
    cancelledBy: booking.cancelledBy,
    refundAmountCents: booking.refundAmountCents,
    payoutReleasedAt: booking.payoutReleasedAt,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}
