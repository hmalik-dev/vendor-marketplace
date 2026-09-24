import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const requireRole = vi.fn();
const getOwnBookingRequests = vi.fn();
const getOwnBookings = vi.fn();
const getOwnCustomerReviews = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
}));
vi.mock('@/lib/customer-data', () => ({
  getOwnBookingRequests: (options?: unknown) => getOwnBookingRequests(options),
  getOwnBookings: (options?: unknown) => getOwnBookings(options),
  getOwnCustomerReviews: (options?: unknown) => getOwnCustomerReviews(options),
}));
vi.mock('@/lib/messaging-data', () => ({
  getOwnConversationBand: async () => ({ conversations: [], hasUnread: false }),
}));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));
vi.mock('@/components/bookings/bookings-sidebar', () => ({
  BookingsSidebar: (props: { bookingCount: number | null }): ReactNode => (
    <span data-testid="sidebar-count">{String(props.bookingCount)}</span>
  ),
}));
vi.mock('@/components/customer/customer-profile-form', () => ({
  CustomerProfileForm: (): ReactNode => <form aria-label="Profile form" />,
}));

const { default: CustomerProfilePage } = await import('./page.js');

const customer = {
  id: 'user-1',
  role: 'customer',
  firstName: 'Pat',
  lastName: 'Okafor',
  email: 'pat@example.com',
  avatarUrl: null,
  budgetTier: null,
  totalBookingsCount: 0,
  completedBookingsCount: 0,
  cancelledBookingsCount: 0,
};

async function renderTab(tab: string): Promise<void> {
  const page = await CustomerProfilePage({ searchParams: Promise.resolve({ tab }) });
  render(page);
}

const FAILURES: [string, () => Error][] = [
  ['a 500', () => new ApiClientError(500, 'INTERNAL_ERROR', 'boom')],
  ['a network error', () => new TypeError('fetch failed')],
];

/*
 * VEN-711: the three history reads used to degrade to `[]`, so a failed read
 * said "Nothing in flight" to a customer with a paid booking. A failed read is
 * an error state with a retry, and the profile form stays usable.
 */
describe('CustomerProfilePage when the history reads fail', () => {
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue(customer);
    getOwnBookingRequests.mockReset().mockResolvedValue([]);
    getOwnBookings.mockReset().mockResolvedValue([]);
    getOwnCustomerReviews.mockReset().mockResolvedValue([]);
    refresh.mockReset();
  });

  afterEach(cleanup);

  it('reads the three lists in required mode', async () => {
    await renderTab('active');

    expect(getOwnBookingRequests).toHaveBeenCalledWith({ required: true });
    expect(getOwnBookings).toHaveBeenCalledWith({ required: true });
    expect(getOwnCustomerReviews).toHaveBeenCalledWith({ required: true });
  });

  describe.each(FAILURES)('with %s', (_label, makeError) => {
    beforeEach(() => {
      getOwnBookingRequests.mockRejectedValue(makeError());
      getOwnBookings.mockRejectedValue(makeError());
      getOwnCustomerReviews.mockRejectedValue(makeError());
    });

    it.each(['active', 'past', 'reviews'])(
      'the %s tab shows an error, not an empty state',
      async (tab) => {
        await renderTab(tab);

        expect(screen.getByRole('alert').textContent).toContain("couldn't load");
        expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
        expect(screen.queryByText('Nothing in flight')).toBeNull();
        expect(screen.queryByText('Nothing here yet')).toBeNull();
        expect(screen.queryByText('No reviews yet')).toBeNull();
      },
    );

    it('leaves the profile form and an unknown booking count', async () => {
      await renderTab('profile');

      expect(screen.getByRole('form', { name: 'Profile form' })).toBeTruthy();
      expect(screen.getByTestId('sidebar-count').textContent).toBe('null');
    });
  });

  it('a failed reviews read does not take down the bookings tabs', async () => {
    getOwnCustomerReviews.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));

    await renderTab('active');

    expect(screen.getByText('Nothing in flight')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('lets a redirect out rather than drawing an error', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;/sign-in',
    });
    getOwnBookings.mockRejectedValue(redirect);

    await expect(renderTab('active')).rejects.toBe(redirect);
  });
});
