import { BRAND_NAME } from '@vendor-marketplace/shared';
import { describe, expect, it } from 'vitest';
import { GENERIC_TRUST_COPY, landingStatus, trustCopyFor } from './landing-status';
import type { WireBooking, WireBookingRequest } from './wire-schemas';

const NOW = new Date('2026-04-26T12:00:00Z');

function request(overrides: Partial<WireBookingRequest> = {}): WireBookingRequest {
  return {
    id: 'req-1',
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2026-06-14',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    customDetails: null,
    status: 'pending',
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 205_000,
    expiresAt: new Date('2026-04-29T12:00:00Z'),
    createdAt: NOW,
    updatedAt: NOW,
    vendor: {
      id: 'ven-1',
      slug: 'june-harlow',
      businessName: 'June Harlow Photography',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      categoryName: 'Photography',
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
    eventDate: '2026-06-14',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 205_000,
    status: 'confirmed',
    paidAt: NOW,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    eventType: 'wedding',
    venue: 'Barr Mansion',
    ...overrides,
  } as WireBooking;
}

describe('landingStatus', () => {
  it('names the soonest confirmed booking still ahead, with the vendor it belongs to', () => {
    const status = landingStatus(
      [request({ id: 'req-1', status: 'accepted' })],
      [booking({ eventDate: '2026-09-01' }), booking({ id: 'bok-2', eventDate: '2026-06-14' })],
      NOW,
    );

    expect(status.next).toEqual({
      vendorName: 'June Harlow Photography',
      eventDate: '2026-06-14',
      totalAmountCents: 205_000,
    });
  });

  /*
   * The sage dot means settled, so a booking that was cancelled or disputed is
   * not a commitment the strip may announce.
   */
  it('ignores a booking that is not confirmed', () => {
    const status = landingStatus([request()], [booking({ status: 'cancelled' })], NOW);

    expect(status.next).toBeNull();
  });

  /*
   * #409: the server cannot know the reader's day, so the boundary is the one
   * that holds in every timezone. Yesterday's UTC date is still "ahead" for a
   * reader west of UTC and stays listed.
   */
  it('keeps a booking dated yesterday, which is still ahead west of UTC', () => {
    const status = landingStatus([request()], [booking({ eventDate: '2026-04-25' })], NOW);

    expect(status.next?.eventDate).toBe('2026-04-25');
  });

  it('drops a booking that is behind every reader on Earth', () => {
    const status = landingStatus([request()], [booking({ eventDate: '2026-04-01' })], NOW);

    expect(status.next).toBeNull();
  });

  it('counts only the requests still waiting on a vendor', () => {
    const status = landingStatus(
      [
        request({ id: 'req-1', status: 'pending' }),
        request({ id: 'req-2', status: 'pending' }),
        // Waiting on the customer, not on the vendor.
        request({ id: 'req-3', status: 'quoted' }),
        request({ id: 'req-4', status: 'declined' }),
        request({ id: 'req-5', status: 'accepted' }),
      ],
      [],
      NOW,
    );

    expect(status.requestsWaitingOnVendor).toBe(2);
  });

  it('does not count a pending request whose date has already gone', () => {
    const status = landingStatus([request({ eventDate: '2026-04-01' })], [], NOW);

    expect(status.requestsWaitingOnVendor).toBe(0);
  });

  it('reports nothing at all for a customer with no rows', () => {
    expect(landingStatus([], [], NOW)).toEqual({ next: null, requestsWaitingOnVendor: 0 });
  });

  /* A booking whose request the API did not return is still a real commitment. */
  it('names a booking generically rather than dropping it when its request is absent', () => {
    const status = landingStatus([], [booking()], NOW);

    expect(status.next?.vendorName).toBe('your vendor');
  });
});

describe('trustCopyFor', () => {
  it('falls back to the generic band when there is no booking to resolve against', () => {
    expect(trustCopyFor({ next: null, requestsWaitingOnVendor: 3 })).toBe(GENERIC_TRUST_COPY);
  });

  it('resolves the guarantees against the booking, and leads with the payment', () => {
    const copy = trustCopyFor({
      next: {
        vendorName: 'June Harlow Photography',
        eventDate: '2026-06-14',
        totalAmountCents: 205_000,
      },
      requestsWaitingOnVendor: 0,
    });

    expect(copy.map((signal) => signal.title)).toEqual([
      'Payment held until the event',
      'Reviews from real bookings',
      'No service fee',
    ]);
    expect(copy[0]?.body).toBe(
      'Your $2,050 for June Harlow Photography is held by Stripe until June 14, 2026, then released to them.',
    );
    expect(copy[1]?.body).toBe(
      `You can review June Harlow Photography once June 14, 2026 has passed. Every review on ${BRAND_NAME} comes from a booking that happened.`,
    );
  });

  /* There is nothing booking-specific to say about a fee that is not charged. */
  it('leaves the fee signal generic', () => {
    const copy = trustCopyFor({
      next: { vendorName: 'June Harlow Photography', eventDate: '2026-06-14', totalAmountCents: 1 },
      requestsWaitingOnVendor: 0,
    });

    expect(copy[2]).toBe(GENERIC_TRUST_COPY[2]);
  });

  /* The frames draw the name; the product reads it. Never a literal. */
  it('reads the brand name rather than writing it out', () => {
    const copy = trustCopyFor({
      next: { vendorName: 'June Harlow Photography', eventDate: '2026-06-14', totalAmountCents: 1 },
      requestsWaitingOnVendor: 0,
    });

    expect(copy[1]?.body).toContain(`Every review on ${BRAND_NAME}`);
  });
});
