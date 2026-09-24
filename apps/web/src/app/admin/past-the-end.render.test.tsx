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

type Params = Record<string, string>;

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

const CASES = [
  {
    path: '/admin/customers',
    heading: 'No customers yet',
    filter: { q: 'ada' },
    filteredHref: '/admin/customers?q=ada',
    setup: () => getAdminCustomers.mockResolvedValue(PAST_END),
    page: (raw: Params) => CustomersPage({ searchParams: Promise.resolve(raw) }),
  },
  {
    path: '/admin/vendors',
    heading: 'No vendors yet',
    filter: { status: 'review' },
    filteredHref: '/admin/vendors?status=review',
    setup: () => {
      getAdminVendors.mockResolvedValue({ ...PAST_END, awaitingReview: 0 });
      getAdminVendorFacets.mockResolvedValue({ categories: [], cities: [] });
    },
    page: (raw: Params) => VendorsPage({ searchParams: Promise.resolve(raw) }),
  },
  {
    path: '/admin/requests',
    heading: 'No requests yet',
    filter: { status: 'pending' },
    filteredHref: '/admin/requests?status=pending',
    setup: () => getAdminRequests.mockResolvedValue(PAST_END),
    page: (raw: Params) => RequestsPage({ searchParams: Promise.resolve(raw) }),
  },
  {
    path: '/admin/reviews',
    heading: 'No reviews yet',
    filter: { type: 'customer_to_vendor' },
    filteredHref: '/admin/reviews?type=customer_to_vendor',
    setup: () => getAdminReviews.mockResolvedValue(PAST_END),
    page: (raw: Params) => ReviewsPage({ searchParams: Promise.resolve(raw) }),
  },
  {
    path: '/admin/activity',
    heading: 'No console activity yet',
    filter: { range: '7d' },
    filteredHref: '/admin/activity?range=7d',
    setup: () => {
      getAdminActivity.mockResolvedValue(PAST_END);
      getAdminActivityActors.mockResolvedValue({ actors: [] });
    },
    page: (raw: Params) => ActivityPage({ searchParams: Promise.resolve(raw) }),
  },
];

describe.each(CASES)('$path past the last page', (c) => {
  it('says the page is past the end, with the way back, not that there are none', async () => {
    c.setup();

    render(await c.page({ page: '999' }));

    expect(screen.getByText('Page 999 is past the end')).toBeDefined();
    expect(screen.getByText('31 rows match, on 3 pages.')).toBeDefined();
    expect(screen.queryByText(c.heading)).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to page 1' }).getAttribute('href')).toBe(c.path);
  });

  it('keeps the filter on the way back and does not call the page filtered-empty', async () => {
    c.setup();

    render(await c.page({ ...c.filter, page: '999' }));

    expect(screen.getByText('Page 999 is past the end')).toBeDefined();
    expect(screen.queryByText(/^No .* match/)).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to page 1' }).getAttribute('href')).toBe(
      c.filteredHref,
    );
  });
});
