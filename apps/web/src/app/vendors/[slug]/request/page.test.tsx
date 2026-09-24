import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getPublicVendorProfile = vi.fn();
const getPublicVendorAvailability = vi.fn();

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

/*
 * VEN-715: the customer gate (#401), the 404 and the 308 for a changed slug
 * (VEN-648) moved to `layout.tsx` (`layout.test.tsx`), above the loading
 * boundary. The page draws the form for a vendor it is given.
 */
describe('BookingRequestPage', () => {
  beforeEach(() => {
    getPublicVendorProfile.mockResolvedValue(VENDOR);
    getPublicVendorAvailability.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('seeds the form from the vendor’s own package and the calendar', async () => {
    const element = await BookingRequestPage({
      params: Promise.resolve({ slug: 'sunlit-studio' }),
      searchParams: Promise.resolve({}),
    });

    expect(element.props).toMatchObject({ vendorId: 'vendor-1', vendorSlug: 'sunlit-studio' });
    expect(getPublicVendorAvailability).toHaveBeenCalledWith('sunlit-studio');
  });

  it('is a bug, not a 404, when the layout let a missing vendor through', async () => {
    getPublicVendorProfile.mockResolvedValue(null);

    await expect(
      BookingRequestPage({
        params: Promise.resolve({ slug: 'gone' }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('Vendor vanished between its layout and its page');
    expect(getPublicVendorAvailability).not.toHaveBeenCalled();
  });
});
