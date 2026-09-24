import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError } from '@/lib/api-client';

const requireRole = vi.fn();
const getOwnCustomerReviews = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
}));
vi.mock('@/lib/customer-data', () => ({
  getOwnCustomerReviews: (options?: unknown) => getOwnCustomerReviews(options),
}));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));
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
  ['a 429', () => new ApiClientError(429, 'RATE_LIMITED', 'slow down')],
  ['a network error', () => new TypeError('fetch failed')],
];

/*
 * VEN-711: the reviews read used to degrade to `[]`, so a failed read said "No
 * reviews yet". A failed read is an error state with a retry, and the profile
 * form stays usable. (VEN-706 removed the Active and Past tabs; the bookings
 * hub reads in required mode since VEN-668.)
 */
describe('CustomerProfilePage when the reviews read fails', () => {
  beforeEach(() => {
    requireRole.mockReset().mockResolvedValue(customer);
    getOwnCustomerReviews.mockReset().mockResolvedValue([]);
    refresh.mockReset();
  });

  afterEach(cleanup);

  it('reads the reviews in required mode', async () => {
    await renderTab('reviews');

    expect(getOwnCustomerReviews).toHaveBeenCalledWith({ required: true });
    expect(screen.getByText('No reviews yet')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe.each(FAILURES)('with %s', (_label, makeError) => {
    beforeEach(() => {
      getOwnCustomerReviews.mockRejectedValue(makeError());
    });

    it('the reviews tab shows an error, not the empty state', async () => {
      await renderTab('reviews');

      expect(screen.getByRole('alert').textContent).toContain("We couldn't load your reviews");
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
      expect(screen.queryByText('No reviews yet')).toBeNull();
    });

    it('leaves the profile form usable', async () => {
      await renderTab('profile');

      expect(screen.getByRole('form', { name: 'Profile form' })).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('Try again re-runs the route once', async () => {
    getOwnCustomerReviews.mockRejectedValue(new ApiClientError(500, 'INTERNAL_ERROR', 'boom'));
    await renderTab('reviews');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('lets a redirect out rather than drawing an error', async () => {
    const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
      digest: 'NEXT_REDIRECT;/sign-in',
    });
    getOwnCustomerReviews.mockRejectedValue(redirect);

    await expect(renderTab('reviews')).rejects.toBe(redirect);
  });
});
