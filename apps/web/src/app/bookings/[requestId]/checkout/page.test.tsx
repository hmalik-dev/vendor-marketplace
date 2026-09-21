import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const REQUEST_ID = '1af86d43-0000-4000-8000-000000000000';

const openCheckout = vi.fn();
const getOwnBookingRequest = vi.fn();

vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock('@/lib/current-user', () => ({ requireRole: async () => undefined }));
vi.mock('@/lib/report-error', () => ({ reportSwallowedError: vi.fn() }));
vi.mock('@/components/checkout/checkout-screen', () => ({ CheckoutScreen: () => null }));
vi.mock('@/lib/customer-data', () => ({
  getBookingForRequest: async () => null,
  getOwnBookingRequest: (id: string) => getOwnBookingRequest(id),
  openCheckout: (id: string) => openCheckout(id),
}));

const { default: CheckoutPage } = await import('./page');

describe('CheckoutPage', () => {
  afterEach(() => {
    cleanup();
  });

  /*
   * VEN-555: `vendor-closed` must reach the vendor screen. Left out of the
   * page's mapping it falls through to `closed` — "cancelled, declined or it
   * expired" over a live booking — and the type system cannot see the omission.
   */
  it('renders the permanent vendor-closed screen, naming the vendor, with no retry', async () => {
    openCheckout.mockResolvedValue({ state: 'vendor-closed' });
    getOwnBookingRequest.mockResolvedValue({
      status: 'accepted',
      vendor: { businessName: 'E2E Test Studio' },
    });

    render(await CheckoutPage({ params: Promise.resolve({ requestId: REQUEST_ID }) }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'E2E Test Studio is no longer taking bookings',
    );
    expect(screen.queryByText(/isn't open any more/)).toBeNull();
    expect(screen.queryByRole('link', { name: 'Try this payment again' })).toBeNull();
  });

  /* VEN-559: a pulled vendor is temporary, so the screen retries and names the deadline. */
  it('renders the temporary vendor-paused screen with a retry and the deadline', async () => {
    openCheckout.mockResolvedValue({ state: 'vendor-paused' });
    getOwnBookingRequest.mockResolvedValue({
      status: 'accepted',
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      vendor: { businessName: 'E2E Test Studio' },
    });

    render(await CheckoutPage({ params: Promise.resolve({ requestId: REQUEST_ID }) }));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      "E2E Test Studio isn't taking bookings right now",
    );
    expect(screen.getByText(/Your booking expires in 3d/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Try this payment again' })).toBeDefined();
  });
});
