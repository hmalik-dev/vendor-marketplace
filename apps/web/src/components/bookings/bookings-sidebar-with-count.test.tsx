import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WireBooking, WireBookingRequest } from '@/lib/wire-schemas';

const getOwnBookingRequests = vi.fn();
const getOwnBookings = vi.fn();
const reportSwallowedError = vi.fn();

vi.mock('@/lib/customer-data', () => ({
  getOwnBookingRequests: (options: unknown) => getOwnBookingRequests(options),
  getOwnBookings: (options: unknown) => getOwnBookings(options),
}));
vi.mock('@/lib/report-error', () => ({
  reportSwallowedError: (...args: unknown[]) => reportSwallowedError(...args),
}));

const { BookingsSidebarWithCount } = await import('./bookings-sidebar-with-count');
const { readOwnBookingEntries } = await import('@/lib/own-booking-entries');

const NOW = new Date('2026-04-26T12:00:00Z');

function request(id: string, status: WireBookingRequest['status']): WireBookingRequest {
  return {
    id,
    customerId: 'cus-1',
    vendorId: 'ven-1',
    packageId: 'pkg-1',
    eventDate: '2026-06-14',
    eventStartTime: null,
    eventType: 'wedding',
    eventLocation: 'Barr Mansion',
    guestCount: 120,
    customDetails: null,
    status,
    quotedPriceCents: null,
    quoteNote: null,
    finalPriceCents: 145_000,
    expiresAt: new Date('2026-04-29T12:00:00Z'),
    createdAt: NOW,
    updatedAt: NOW,
    vendor: {
      id: 'ven-1',
      slug: 'kessler-co',
      businessName: 'Kessler & Co.',
      city: 'Austin',
      state: 'TX',
      avatarUrl: null,
      categoryName: 'Photography',
      avgRating: 4.9,
      reviewCount: 127,
    },
    package: null,
  } as WireBookingRequest;
}

function booking(requestId: string): WireBooking {
  return {
    id: `bok-${requestId}`,
    requestId,
    customerId: 'cus-1',
    vendorId: 'ven-1',
    eventDate: '2026-06-14',
    eventLocation: 'Barr Mansion',
    totalAmountCents: 145_000,
    status: 'confirmed',
    paidAt: NOW,
    completedAt: null,
    cancelledAt: null,
    cancellationReason: null,
    createdAt: NOW,
    updatedAt: NOW,
    eventType: 'wedding',
    venue: 'Barr Mansion',
  } as WireBooking;
}

beforeEach(() => {
  getOwnBookingRequests.mockReset().mockResolvedValue([]);
  getOwnBookings.mockReset().mockResolvedValue([]);
  reportSwallowedError.mockReset();
});

afterEach(cleanup);

describe('BookingsSidebarWithCount', () => {
  /*
   * VEN-745. `req-paid` is in both lists — accepted, then paid — so summing the
   * two lengths reads 3. The hub shows two cards (the booking and the pending
   * request), and the count is the hub's own number.
   */
  it('counts the deduplicated hub entries, not the sum of both lists', async () => {
    getOwnBookingRequests.mockResolvedValue([
      request('req-paid', 'accepted'),
      request('req-open', 'pending'),
    ]);
    getOwnBookings.mockResolvedValue([booking('req-paid')]);

    render(await BookingsSidebarWithCount({ current: 'messages' }));

    const rows = within(screen.getByRole('navigation', { name: 'Your account' })).getAllByRole(
      'link',
    );
    expect(rows[0]?.textContent).toBe('My bookings2');
    expect((await readOwnBookingEntries()).length).toBe(2);
  });

  it('reads both lists in required mode, the page beside it does the same', async () => {
    await BookingsSidebarWithCount({ current: 'bookings' });

    expect(getOwnBookingRequests).toHaveBeenCalledWith({ required: true });
    expect(getOwnBookings).toHaveBeenCalledWith({ required: true });
  });

  it('still draws the nav, without a number, when the read fails', async () => {
    const failure = new Error('upstream 500');
    getOwnBookings.mockRejectedValue(failure);

    render(await BookingsSidebarWithCount({ current: 'messages' }));

    expect(screen.getByRole('link', { name: 'My bookings' }).textContent).toBe('My bookings');
    expect(reportSwallowedError).toHaveBeenCalledWith(
      'sidebar: reading the bookings count failed',
      failure,
    );
  });

  it('lets a redirect through rather than swallowing it', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;replace' });
    getOwnBookingRequests.mockRejectedValue(redirect);

    await expect(BookingsSidebarWithCount({ current: 'bookings' })).rejects.toBe(redirect);
    expect(reportSwallowedError).not.toHaveBeenCalled();
  });
});
