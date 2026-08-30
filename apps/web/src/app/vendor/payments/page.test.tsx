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
vi.mock('@/components/vendor/connect-payouts-form', () => ({
  ConnectPayoutsForm: ({ isResuming }: { isResuming: boolean }) => (
    <button type="button">{isResuming ? 'Continue setup' : 'Set up payouts'}</button>
  ),
}));

const { default: VendorPaymentsPage } = await import('./page');

async function renderPage(
  status: WireVendorPayoutStatus | null,
  search: { resume?: string } = {},
): Promise<void> {
  getPayoutStatus.mockResolvedValue(status);
  render(await VendorPaymentsPage({ searchParams: Promise.resolve(search) }));
}

/**
 * The payout gate a vendor lands on. Its whole job is to be honest about which
 * of three states they are in — never started, started and stopped, or done —
 * and to say the one sentence `31-content-voice.md` approved for the gate.
 */
describe('VendorPaymentsPage', () => {
  beforeEach(() => {
    requireRole.mockReset();
    requireRole.mockResolvedValue(undefined);
    getPayoutStatus.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('sends a vendor with no profile to create one instead of 500ing', async () => {
    getPayoutStatus.mockResolvedValue(null);

    await expect(VendorPaymentsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/vendor/profile/edit',
    );
    expect(redirect).toHaveBeenCalledWith('/vendor/profile/edit');
  });

  it('states the payout gate in the approved words, in gold', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    const banner = screen.getByText(/You can’t take payment until payouts are connected\./);
    expect(banner.textContent).toContain('It takes about five minutes.');

    // Gold: this is waiting on the vendor, and nothing has failed.
    const surface = screen.getAllByRole('status')[0]!;
    expect(surface.className).toContain('gold');
    expect(surface.className).not.toContain('error');
  });

  it('offers first-time wording to a vendor who has never started', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    expect(screen.getByRole('button').textContent).toBe('Set up payouts');
  });

  it('offers resumed wording to a vendor who started and stopped', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false });

    expect(screen.getByRole('button').textContent).toBe('Continue setup');
  });

  /*
   * `?resume=1` is verbatim the `refresh_url` handed to Stripe, so this is what
   * every vendor with an expired link sees — not an edge case. One banner, per
   * the component's own contract, and it explains the link rather than the setup.
   */
  it('explains an expired link with one banner, not two stacked', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false }, { resume: '1' });

    const banners = screen.getAllByRole('status');
    expect(banners).toHaveLength(1);
    expect(banners[0]!.textContent).toContain('That link had expired');
    expect(banners[0]!.className).toContain('steel');
  });

  it('shows no gate and no button once payouts are connected', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: true });

    expect(screen.queryByText(/You can’t take payment/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status').className).toContain('sage');
  });

  /** MVP takes no vendor fee, so no rate may appear anywhere in this flow. */
  it('makes no fee claim', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    const copy = document.body.textContent ?? '';
    expect(copy).not.toMatch(/\d+\s*%/);
    expect(copy.toLowerCase()).not.toContain('fee');
  });
});
