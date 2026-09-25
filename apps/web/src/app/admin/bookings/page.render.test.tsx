import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const getAdminBookings = vi.fn();

vi.mock('@/lib/admin-data', () => ({ getAdminBookings }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/bookings',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const { default: AdminBookingsPage } = await import('./page');

const VENDOR_ID = '22222222-2222-4222-8222-222222222222';

const ROW = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'confirmed',
  eventDate: '2099-06-01',
  totalCents: 120_000,
  customerName: 'Anjali Rao',
  vendorName: 'Sunlit Studio',
  vendorSlug: 'sunlit-studio',
  vendorId: VENDOR_ID,
  refundStuck: true,
  createdAt: new Date('2026-09-01T00:00:00Z'),
};

afterEach(() => {
  cleanup();
  getAdminBookings.mockReset();
});

describe('the bookings page', () => {
  it('links a vendor to the console, not to a storefront a banned vendor no longer has', async () => {
    getAdminBookings.mockResolvedValue({
      items: [ROW],
      total: 1,
      page: 1,
      pageSize: 15,
      widenings: [],
    });

    render(await AdminBookingsPage({ searchParams: Promise.resolve({ flag: 'refund-stuck' }) }));

    expect(screen.getAllByRole('link', { name: 'Sunlit Studio' })[0]!.getAttribute('href')).toBe(
      `/admin/vendors/${VENDOR_ID}`,
    );
  });

  it('says a page past the end is past the end, not that there are no bookings', async () => {
    getAdminBookings.mockResolvedValue({
      items: [],
      total: 16,
      page: 99,
      pageSize: 15,
      widenings: [],
    });

    render(await AdminBookingsPage({ searchParams: Promise.resolve({ page: '99' }) }));

    expect(screen.getByText('Page 99 is past the end')).toBeDefined();
    expect(screen.queryByText('No bookings yet')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to page 1' }).getAttribute('href')).toBe(
      '/admin/bookings',
    );
  });

  it('names the search and the other filter when both leave nothing', async () => {
    getAdminBookings.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 15,
      widenings: [{ key: 'status', count: 2 }],
    });

    render(
      await AdminBookingsPage({
        searchParams: Promise.resolve({ q: 'kessler', status: 'completed' }),
      }),
    );

    expect(screen.getByText('No bookings match "kessler" and Completed')).toBeDefined();
    expect(screen.getByText('2 filters are narrowing this.')).toBeDefined();
    // Dropping the status keeps the search, and the count is the widening API's.
    expect(screen.getByRole('link', { name: 'Any status (2)' }).getAttribute('href')).toBe(
      '/admin/bookings?q=kessler',
    );
    expect(getAdminBookings).toHaveBeenCalledWith('?status=completed&q=kessler&page=1');
  });

  it('sends the search to the API and keeps it through the pager', async () => {
    getAdminBookings.mockResolvedValue({
      items: [ROW],
      total: 40,
      page: 1,
      pageSize: 15,
      widenings: [],
    });

    render(await AdminBookingsPage({ searchParams: Promise.resolve({ q: '  Sunlit  ' }) }));

    expect(getAdminBookings).toHaveBeenCalledWith('?q=Sunlit&page=1');
    expect(
      screen.getAllByRole('link').some((link) => link.getAttribute('href')?.includes('q=Sunlit')),
    ).toBe(true);
  });
});
