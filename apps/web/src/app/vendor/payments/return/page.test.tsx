import type { WireVendorPayoutStatus } from '@/lib/wire-schemas';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn<() => Promise<void>>();
const getPayoutStatus = vi.fn<() => Promise<WireVendorPayoutStatus | null>>();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/lib/current-user', () => ({ requireRole: () => requireRole() }));
vi.mock('@/lib/vendor-data', () => ({ getPayoutStatus: () => getPayoutStatus() }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));

const { default: VendorPaymentsReturnPage } = await import('./page');

async function renderPage(status: WireVendorPayoutStatus | null): Promise<void> {
  getPayoutStatus.mockResolvedValue(status);
  render(await VendorPaymentsReturnPage());
}

/**
 * Where Stripe drops the vendor after the hosted form.
 *
 * The race this page exists to survive: returning here proves only that they
 * left Stripe, never that they finished, and the webhook that settles the
 * question arrives on its own schedule. So the two states are both real, and
 * claiming success it cannot see is the one thing it must never do.
 */
describe('VendorPaymentsReturnPage', () => {
  beforeEach(() => {
    requireRole.mockReset();
    requireRole.mockResolvedValue(undefined);
    getPayoutStatus.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('confirms success when the webhook has already landed', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: true });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('You’re set up');

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Nothing else to do here.');
    // Sage: settled.
    expect(banner.className).toContain('sage');
  });

  it('says Stripe is still checking when the webhook has not landed', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Stripe is still checking');

    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('You don’t need to do anything.');
    /*
     * Steel, never red and never gold: nothing failed, and nothing is waiting on
     * the vendor — it is waiting on Stripe. `40-states.md` does not bend here.
     */
    expect(banner.className).toContain('steel');
    expect(banner.className).not.toContain('error');
    expect(banner.className).not.toContain('gold');
  });

  it('never claims success it cannot see', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false });

    const copy = document.body.textContent ?? '';
    expect(copy).not.toContain('You’re set up');
    expect(copy).not.toContain('Payouts connected');
  });

  it('offers a way to re-check while it is still pending', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false });

    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(links).toContain('/vendor/payments');
    expect(links).toContain('/vendor/dashboard');
  });

  it('sends a vendor with no profile to create one instead of 500ing', async () => {
    getPayoutStatus.mockResolvedValue(null);

    await expect(VendorPaymentsReturnPage()).rejects.toThrow('REDIRECT:/vendor/profile/edit');
    expect(redirect).toHaveBeenCalledWith('/vendor/profile/edit');
  });
});
