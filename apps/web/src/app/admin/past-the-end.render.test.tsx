import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** The five lists that used to answer a page past the end with their first-run empty state. */
const getAdminCustomers = vi.fn();
const getAdminVendors = vi.fn();
const getAdminVendorFacets = vi.fn();
const getAdminRequests = vi.fn();
const getAdminReviews = vi.fn();
const getAdminActivity = vi.fn();
const getAdminActivityActors = vi.fn();

vi.mock('@/lib/admin-data', () => ({
  getAdminCustomers,
  getAdminVendors,
  getAdminVendorFacets,
  getAdminRequests,
  getAdminReviews,
  getAdminActivity,
  getAdminActivityActors,
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: CustomersPage } = await import('./customers/page');
const { default: VendorsPage } = await import('./vendors/page');
const { default: RequestsPage } = await import('./requests/page');
const { default: ReviewsPage } = await import('./reviews/page');
const { default: ActivityPage } = await import('./activity/page');

/** 31 rows at 15 a page is three pages; page 999 has none of them. */
const PAST_END = { items: [], total: 31, page: 999, pageSize: 15, widenings: [] };

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const CASES = [
  {
    path: '/admin/customers',
    heading: 'No customers yet',
    setup: () => getAdminCustomers.mockResolvedValue(PAST_END),
    render: () => CustomersPage({ searchParams: Promise.resolve({ page: '999' }) }),
  },
  {
    path: '/admin/vendors',
    heading: 'No vendors yet',
    setup: () => {
      getAdminVendors.mockResolvedValue({ ...PAST_END, awaitingReview: 0 });
      getAdminVendorFacets.mockResolvedValue({ categories: [], cities: [] });
    },
    render: () => VendorsPage({ searchParams: Promise.resolve({ page: '999' }) }),
  },
  {
    path: '/admin/requests',
    heading: 'No requests yet',
    setup: () => getAdminRequests.mockResolvedValue(PAST_END),
    render: () => RequestsPage({ searchParams: Promise.resolve({ page: '999' }) }),
  },
  {
    path: '/admin/reviews',
    heading: 'No reviews yet',
    setup: () => getAdminReviews.mockResolvedValue(PAST_END),
    render: () => ReviewsPage({ searchParams: Promise.resolve({ page: '999' }) }),
  },
  {
    path: '/admin/activity',
    heading: 'No console activity yet',
    setup: () => {
      getAdminActivity.mockResolvedValue(PAST_END);
      getAdminActivityActors.mockResolvedValue({ actors: [] });
    },
    render: () => ActivityPage({ searchParams: Promise.resolve({ page: '999' }) }),
  },
] as const;

describe.each(CASES)('$path past the last page', ({ path, heading, setup, render: page }) => {
  it('says the page is past the end, with the way back, not that there are none', async () => {
    setup();

    render(await page());

    expect(screen.getByText('Page 999 is past the end')).toBeDefined();
    expect(screen.getByText('31 rows match, on 3 pages.')).toBeDefined();
    expect(screen.queryByText(heading)).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to page 1' }).getAttribute('href')).toBe(path);
  });
});
