import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn<() => Promise<unknown>>();
const getOwnBookingRequests = vi.fn<() => Promise<{ status: string }[]>>();
const getPayoutStatus = vi.fn<() => Promise<{ stripeOnboarded: boolean } | null>>();

vi.mock('@/lib/current-user', () => ({ requireRole: () => requireRole() }));
vi.mock('@/lib/vendor-requests', () => ({ getOwnBookingRequests: () => getOwnBookingRequests() }));
vi.mock('@/lib/vendor-data', () => ({ getPayoutStatus: () => getPayoutStatus() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/vendor/availability' }));

const { default: VendorLayout } = await import('./layout');

async function renderLayout(): Promise<void> {
  render(await VendorLayout({ children: <p>page</p> }));
}

describe('VendorLayout', () => {
  beforeEach(() => {
    requireRole.mockReset();
    requireRole.mockResolvedValue({});
    getOwnBookingRequests.mockReset();
    getOwnBookingRequests.mockResolvedValue([]);
    getPayoutStatus.mockReset();
    getPayoutStatus.mockResolvedValue({ stripeOnboarded: true });
  });

  it('counts only the pending requests onto the Bookings row', async () => {
    getOwnBookingRequests.mockResolvedValue([
      { status: 'pending' },
      { status: 'accepted' },
      { status: 'pending' },
      { status: 'declined' },
      { status: 'pending' },
    ]);

    await renderLayout();

    expect(screen.getByRole('link', { name: 'Bookings, 3 waiting' }).textContent).toBe('Bookings3');
  });

  it('draws no pill when nothing is pending', async () => {
    getOwnBookingRequests.mockResolvedValue([{ status: 'accepted' }]);

    await renderLayout();

    expect(screen.getByRole('link', { name: 'Bookings' }).textContent).toBe('Bookings');
  });

  it('dots Payments for a vendor whose payouts are not connected', async () => {
    getPayoutStatus.mockResolvedValue({ stripeOnboarded: false });

    await renderLayout();

    expect(screen.getByRole('link', { name: 'Payments, payouts not connected' })).toBeDefined();
  });

  it('dots Payments for a vendor with no payout state yet', async () => {
    getPayoutStatus.mockResolvedValue(null);

    await renderLayout();

    expect(screen.getByRole('link', { name: 'Payments, payouts not connected' })).toBeDefined();
  });

  it('leaves Payments plain and still renders the page when the status cannot be read', async () => {
    getPayoutStatus.mockRejectedValue(new Error('api down'));

    await renderLayout();

    expect(screen.getByRole('link', { name: 'Payments' }).textContent).toBe('Payments');
    expect(screen.getByText('page')).toBeDefined();
  });
});
