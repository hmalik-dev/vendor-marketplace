import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getOwnBookingRequests = vi.fn();
const getOwnBookings = vi.fn();

vi.mock('@/lib/customer-data', () => ({
  getOwnBookingRequests: (options: unknown) => getOwnBookingRequests(options),
  getOwnBookings: (options: unknown) => getOwnBookings(options),
}));

vi.mock('@/lib/messaging-data', () => ({
  getOwnConversationBand: async () => ({ conversations: [], hasUnread: false }),
}));

vi.mock('@/components/bookings/bookings-hub', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/components/bookings/bookings-hub')>()),
  BookingsHub: (): ReactNode => <section aria-label="Bookings" />,
}));
vi.mock('@/components/bookings/bookings-rail', () => ({
  BookingsRail: (): ReactNode => null,
}));

vi.mock('@/lib/current-user', () => ({
  requireRole: async () => ({ city: 'Austin' }),
}));

const { default: BookingsPage } = await import('./page');

const searchParams = Promise.resolve({});

/*
 * VEN-668. `customer-data.test.ts` proves what `required` does; this proves the
 * hub asks for it. Drop the option from either call and every other test stays
 * green while a failed read draws "No bookings yet" for a customer who paid.
 */
describe('the bookings hub reads', () => {
  beforeEach(() => {
    getOwnBookingRequests.mockReset().mockResolvedValue([]);
    getOwnBookings.mockReset().mockResolvedValue([]);
  });

  it('asks for both lists in required mode', async () => {
    await BookingsPage({ searchParams });

    expect(getOwnBookingRequests).toHaveBeenCalledWith({ required: true });
    expect(getOwnBookings).toHaveBeenCalledWith({ required: true });
  });

  it.each([
    ['booking requests', getOwnBookingRequests],
    ['bookings', getOwnBookings],
  ])('rejects, rather than rendering an empty hub, when the %s read fails', async (_name, read) => {
    const failure = new Error('upstream 500');
    read.mockRejectedValue(failure);

    await expect(BookingsPage({ searchParams })).rejects.toBe(failure);
  });
});

/*
 * VEN-706. The customer's `Your account` sidebar is gone: Messages and Bookings
 * are one click apart in the header, so the hub is a bookings page and nothing
 * else.
 */
describe('the bookings hub chrome', () => {
  beforeEach(() => {
    getOwnBookingRequests.mockReset().mockResolvedValue([]);
    getOwnBookings.mockReset().mockResolvedValue([]);
  });

  afterEach(cleanup);

  it('renders no navigation labelled Your account', async () => {
    render(await BookingsPage({ searchParams }));

    expect(screen.getByRole('region', { name: 'Bookings' })).toBeDefined();
    expect(screen.queryByRole('navigation', { name: 'Your account' })).toBeNull();
  });
});
