import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireCurrentUser = vi.fn();
const requireRole = vi.fn();
const getPublicVendorProfile = vi.fn();
const getPublicVendorAvailability = vi.fn();

vi.mock('@/lib/current-user', () => ({
  requireCurrentUser: (returnTo?: string) => requireCurrentUser(returnTo),
  requireRole: (role: string, returnTo?: string) => requireRole(role, returnTo),
}));

vi.mock('@/lib/vendor-data', () => ({
  getPublicVendorProfile: (slug: string) => getPublicVendorProfile(slug),
  getPublicVendorAvailability: (slug: string) => getPublicVendorAvailability(slug),
}));

vi.mock('@/components/booking/booking-request-screen', () => ({
  BookingRequestScreen: (): ReactNode => null,
}));

const { default: BookingRequestPage } = await import('./page.js');

const VENDOR = {
  id: 'vendor-1',
  slug: 'sunlit-studio',
  businessName: 'Sunlit Studio',
  profileImageUrl: null,
  avgRating: 4.8,
  reviewCount: 12,
  responseTimeHours: 4,
  categories: [{ name: 'Photography' }],
  packages: [],
};

function props(): Parameters<typeof BookingRequestPage>[0] {
  return {
    params: Promise.resolve({ slug: 'sunlit-studio' }),
    searchParams: Promise.resolve({}),
  };
}

describe('BookingRequestPage role gate', () => {
  beforeEach(() => {
    getPublicVendorProfile.mockResolvedValue(VENDOR);
    getPublicVendorAvailability.mockResolvedValue([]);
    requireRole.mockResolvedValue({ id: 'user-1', role: 'customer' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /*
   * #401: the page bounced `role === 'vendor'` by hand and let everything else
   * through, so an admin rendered the two-step form and only learned the API
   * refuses them — `requireRole('customer')` — when the submit answered 403.
   * The gate has to be the same one the API applies, not a subset of it.
   */
  it('asks for the role the API requires, not just "not a vendor"', async () => {
    await BookingRequestPage(props());

    expect(requireRole).toHaveBeenCalledWith('customer', '/vendors/sunlit-studio/request');
    expect(requireCurrentUser).not.toHaveBeenCalled();
  });

  /*
   * Named for what it measures: the guard is awaited *before* the page does
   * any of its own work, so a role it turns away never reaches the form or the
   * reads behind it. Which roles those are is `requireRole`'s own test.
   */
  it('runs the guard before anything the page would render', async () => {
    requireRole.mockRejectedValue(new Error('NEXT_REDIRECT:/admin'));

    await expect(BookingRequestPage(props())).rejects.toThrow('NEXT_REDIRECT:/admin');
    expect(getPublicVendorAvailability).not.toHaveBeenCalled();
  });

  it('carries the chosen package and date through the sign-in round trip', async () => {
    await BookingRequestPage({
      params: Promise.resolve({ slug: 'sunlit-studio' }),
      searchParams: Promise.resolve({ package: 'pkg-1', date: '2026-12-25' }),
    });

    expect(requireRole).toHaveBeenCalledWith(
      'customer',
      '/vendors/sunlit-studio/request?package=pkg-1&date=2026-12-25',
    );
  });
});
