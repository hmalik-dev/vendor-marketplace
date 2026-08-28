import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CustomerHistory, CustomerReviews } from './customer-history';
import type { WireBooking, WireBookingRequest, WireCustomerReview } from '@/lib/wire-schemas';

afterEach(cleanup);

function request(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2026-11-14',
    eventStartTime: '14:00',
    eventType: 'wedding',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    customDetails: null,
    status: 'pending',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 145_000,
    expiresAt: new Date('2026-09-04'),
    createdAt: new Date('2026-08-28'),
    updatedAt: new Date('2026-08-28'),
    vendor: {
      id: 'ven-1',
      slug: 'june-harlow',
      businessName: 'June Harlow',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: null,
    ...overrides,
  } as WireBookingRequest;
}

function booking(overrides: Partial<WireBooking> = {}): WireBooking {
  return {
    id: 'bok-1',
    requestId: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2026-11-14',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 145_000,
    platformFeeCents: 17_400,
    vendorPayoutCents: 127_600,
    status: 'confirmed',
    stripePaymentIntentId: null,
    stripeTransferId: null,
    paidAt: new Date('2026-08-28'),
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: new Date('2026-08-28'),
    updatedAt: new Date('2026-08-28'),
    eventType: 'wedding',
    venue: 'Barr Mansion',
    ...overrides,
  } as WireBooking;
}

describe('CustomerHistory', () => {
  it('offers somewhere to go when nothing is in flight', () => {
    render(<CustomerHistory requests={[]} bookings={[]} scope="active" />);

    expect(screen.getByText('Nothing in flight')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Browse vendors' }).getAttribute('href')).toBe(
      '/search',
    );
  });

  /* Past is a record, not a prompt — there is nothing to do about it. */
  it('offers no CTA on the past tab', () => {
    render(<CustomerHistory requests={[]} bookings={[]} scope="past" />);

    expect(screen.getByText('Nothing here yet')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Browse vendors' })).toBeNull();
  });

  it('splits live requests from settled ones', () => {
    const requests = [
      request({ id: 'a', status: 'pending' }),
      request({ id: 'b', status: 'declined' }),
    ];

    const { unmount } = render(
      <CustomerHistory requests={requests} bookings={[]} scope="active" />,
    );
    expect(screen.getByText('Waiting on the vendor')).toBeDefined();
    expect(screen.queryByText('Declined')).toBeNull();
    unmount();

    render(<CustomerHistory requests={requests} bookings={[]} scope="past" />);
    expect(screen.getByText('Declined')).toBeDefined();
    expect(screen.queryByText('Waiting on the vendor')).toBeNull();
  });

  /*
   * A request that was paid for is the same event further along, not a second
   * one — rendering both would double every booking in the list.
   */
  it('renders a paid request once, as the booking', () => {
    render(
      <CustomerHistory
        requests={[request({ id: 'req-1', status: 'accepted' })]}
        bookings={[booking({ requestId: 'req-1' })]}
        scope="active"
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByText('$1,450 paid')).toBeDefined();
    expect(screen.queryByText('Accepted')).toBeNull();
  });

  it('writes the date the way a person reads it, and names the occasion', () => {
    render(<CustomerHistory requests={[request()]} bookings={[]} scope="active" />);

    expect(screen.getByText(/Wedding · November 14, 2026/)).toBeDefined();
  });

  it('says a custom request has no price yet rather than showing nothing', () => {
    render(
      <CustomerHistory
        requests={[request({ finalPriceCents: null })]}
        bookings={[]}
        scope="active"
      />,
    );

    expect(screen.getByText('To be quoted')).toBeDefined();
  });

  /* `quoted` is the customer's move, and reads differently from waiting. */
  it('distinguishes a quote to review from waiting on the vendor', () => {
    render(
      <CustomerHistory requests={[request({ status: 'quoted' })]} bookings={[]} scope="active" />,
    );

    expect(screen.getByText('Quote to review')).toBeDefined();
  });
});

describe('CustomerReviews', () => {
  it('uses the specified empty copy when no vendor has reviewed them', () => {
    render(<CustomerReviews reviews={[]} />);

    expect(
      screen.getByText('Reviews from vendors will appear here after completed events.'),
    ).toBeDefined();
  });

  it('credits the business, never the reviewer as a person', () => {
    const review: WireCustomerReview = {
      id: 'rev-1',
      rating: 5,
      title: null,
      content: 'Clear about what they wanted and ready on the day.',
      vendorBusinessName: 'June Harlow',
      createdAt: new Date('2026-08-28'),
    };

    render(<CustomerReviews reviews={[review]} />);

    expect(screen.getByText('June Harlow')).toBeDefined();
    expect(screen.getByText('Clear about what they wanted and ready on the day.')).toBeDefined();
  });
});
