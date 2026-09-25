import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAdminReviews = vi.fn();

vi.mock('@/lib/admin-data', () => ({ getAdminReviews }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/reviews',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: AdminReviewsPage } = await import('./page');

const EMPTY = { items: [], total: 0, page: 1, pageSize: 15 };

afterEach(() => {
  cleanup();
  getAdminReviews.mockReset();
});

/** The search box (VEN-749). */
describe('the reviews page search', () => {
  it('sends the trimmed term to the API and keeps it in the field', async () => {
    getAdminReviews.mockResolvedValue({ ...EMPTY, widenings: [] });

    render(
      await AdminReviewsPage({ searchParams: Promise.resolve({ q: '  golden  ', page: '3' }) }),
    );

    expect(getAdminReviews).toHaveBeenCalledWith('?q=golden&page=3');
    expect(screen.getByRole('searchbox', { name: 'Search' }).getAttribute('value')).toBe('golden');
  });

  it('names the search and the direction when both leave nothing', async () => {
    getAdminReviews.mockResolvedValue({ ...EMPTY, widenings: [{ key: 'type', count: 4 }] });

    render(
      await AdminReviewsPage({
        searchParams: Promise.resolve({ q: 'golden', type: 'vendor_to_customer' }),
      }),
    );

    expect(screen.getByText('No reviews match "golden" and About a customer')).toBeDefined();
    // Dropping the direction keeps the search, with the widening API's count.
    expect(screen.getByRole('link', { name: 'Both directions (4)' }).getAttribute('href')).toBe(
      '/admin/reviews?q=golden',
    );
  });

  it('names the search alone when it is the only filter', async () => {
    getAdminReviews.mockResolvedValue({ ...EMPTY, widenings: [] });

    render(await AdminReviewsPage({ searchParams: Promise.resolve({ q: 'golden' }) }));

    expect(screen.getByText('No reviews match "golden"')).toBeDefined();
    expect(screen.queryByText('No reviews yet')).toBeNull();
  });

  // A JavaScript-off `Apply filters` submits the empty field too (VEN-752).
  it('treats an empty q as no search, and carries it into no link', async () => {
    getAdminReviews.mockResolvedValue({ ...EMPTY, widenings: [] });

    render(
      await AdminReviewsPage({
        searchParams: Promise.resolve({ type: 'vendor_to_customer', q: '' }),
      }),
    );

    expect(getAdminReviews).toHaveBeenCalledWith('?type=vendor_to_customer&page=1');
    expect(screen.queryByText(/^Search:/)).toBeNull();
    expect(screen.queryByText(/Ignored/)).toBeNull();
    expect(screen.queryByText(/No reviews match "/)).toBeNull();
    expect(screen.getByText(/^One filter is narrowing this\./)).toBeDefined();
    expect(
      screen
        .getByRole('link', { name: 'Remove Direction filter: About a customer' })
        .getAttribute('href'),
    ).toBe('/admin/reviews');
  });
});
