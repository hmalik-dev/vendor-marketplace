import { cleanup, render, screen } from '@testing-library/react';
import { BRAND_NAME } from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { CancelledBookingCard } from './cancelled-booking-card';
import type { WireBookingRequest } from '@/lib/wire-schemas';

afterEach(cleanup);

function cancelled(
  settlement: Partial<NonNullable<WireBookingRequest['settlement']>> = {},
): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2027-02-13',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Zilker Park Clubhouse',
    guestCount: 120,
    customDetails: null,
    status: 'cancelled',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 120_000,
    expiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    /*
     * `lastName` and the contact fields are `null`, which is the only shape
     * this card ever sees: `toDetail` discloses them on `accepted` alone
     * (`CONTACT_DISCLOSING_BOOKING_REQUEST_STATUSES`), and every row here is
     * `cancelled`. A fixture carrying a surname would test a shape the API
     * cannot produce, and would stay green if the fallback broke for the one
     * it can.
     */
    customer: {
      firstName: 'Priya',
      lastInitial: 'N',
      lastName: null,
      email: null,
      phone: null,
    },
    vendor: {
      id: 'ven-1',
      slug: 'kessler-co',
      businessName: 'Kessler & Co.',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: null,
    settlement: {
      bookingId: 'bkg-1',
      status: 'cancelled',
      totalAmountCents: 120_000,
      paidAt: new Date('2026-12-01T00:00:00Z'),
      cancelledAt: new Date('2027-01-04T12:00:00Z'),
      cancelledBy: 'customer',
      refundAmountCents: 120_000,
      ...settlement,
    },
  } as unknown as WireBookingRequest;
}

/*
 * The vendor half of #415. `/vendor/bookings` filters `accepted`, and #400
 * settles the parent request when a booking is cancelled — so a date the
 * vendor had committed to and lost appeared on no vendor surface at all. They
 * got a notification and a freed calendar cell, and that was the record.
 */
describe('CancelledBookingCard', () => {
  it('names the customer, the date it was for, and that it is cancelled', () => {
    render(<CancelledBookingCard request={cancelled()} />);

    expect(screen.getByText('Priya')).toBeDefined();
    expect(screen.getByText(/Saturday, February 13, 2027/)).toBeDefined();
    expect(screen.getByText('Cancelled')).toBeDefined();
  });

  it('says the customer cancelled it, and when', () => {
    render(<CancelledBookingCard request={cancelled()} />);

    expect(
      screen.getByText('The customer cancelled this booking on January 4, 2027.'),
    ).toBeDefined();
  });

  /*
   * D31: a refund reverses the vendor's share out of their Stripe balance, and
   * the ruling requires the product to say so rather than leave it to be found
   * on a statement. The notification says it; so does the surface they can go
   * back and read.
   */
  it('names the payout reversal rather than only the customer’s refund', () => {
    render(<CancelledBookingCard request={cancelled()} />);

    expect(
      screen.getByText(
        'They paid $1,200 and were refunded all of it. Your share was reversed out of your Stripe balance.',
      ),
    ).toBeDefined();
  });

  it('attributes an unwound booking to the operator, not to the customer', () => {
    render(<CancelledBookingCard request={cancelled({ cancelledBy: 'admin' })} />);

    expect(
      screen.getByText(
        `${BRAND_NAME} cancelled this booking on January 4, 2027, because an account involved was suspended.`,
      ),
    ).toBeDefined();
    expect(screen.queryByText(/the customer cancelled/i)).toBeNull();
  });

  /*
   * Not `BookingCard` with a different pill. Completing a booking that will not
   * happen is not an action that exists, and the contact block is a privacy
   * line the API draws at acceptance — which this row is past.
   */
  it('offers no work to do on a booking that will not happen', () => {
    render(<CancelledBookingCard request={cancelled()} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
  });
});
