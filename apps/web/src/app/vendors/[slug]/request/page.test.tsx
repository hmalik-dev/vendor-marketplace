import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicVendorProfile = vi.fn();
const getPublicVendorAvailability = vi.fn();
const getVendorSlugSuccessor = vi.fn();
const requireRole = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
  permanentRedirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT 308 ${path}`);
  },
}));
vi.mock('@/lib/vendor-data', () => ({
  getVendorSlugSuccessor: (slug: string) => getVendorSlugSuccessor(slug),
  getPublicVendorProfile: (slug: string) => getPublicVendorProfile(slug),
  getPublicVendorAvailability: (slug: string) => getPublicVendorAvailability(slug),
}));

vi.mock('@/lib/current-user', () => ({
  requireRole: (role: string) => requireRole(role),
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

/*
 * VEN-715: the customer gate (#401), the 404 and the 308 for a changed slug
 * (VEN-648) moved to `layout.tsx` (`layout.test.tsx`), above the loading
 * boundary. The page draws the form for a vendor it is given.
 */
describe('BookingRequestPage', () => {
  beforeEach(() => {
    getPublicVendorProfile.mockResolvedValue(VENDOR);
    getPublicVendorAvailability.mockResolvedValue([]);
    requireRole.mockResolvedValue({ id: 'customer-1', role: 'customer' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seeds the form from the vendor’s own package and the calendar', async () => {
    const element = await BookingRequestPage({
      params: Promise.resolve({ slug: 'sunlit-studio' }),
      searchParams: Promise.resolve({}),
    });

    // VEN-617: the draft is keyed by the signed-in customer, read from the same gate the layout runs.
    expect(element.props).toMatchObject({
      userId: 'customer-1',
      vendorId: 'vendor-1',
      vendorSlug: 'sunlit-studio',
    });
    expect(requireRole).toHaveBeenCalledWith('customer');
    expect(getPublicVendorAvailability).toHaveBeenCalledWith('sunlit-studio');
  });

  it('raises the gate’s not-found beside the layout, not an error of its own', async () => {
    getPublicVendorProfile.mockResolvedValue(null);
    getVendorSlugSuccessor.mockResolvedValue(null);

    await expect(
      BookingRequestPage({
        params: Promise.resolve({ slug: 'gone' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
