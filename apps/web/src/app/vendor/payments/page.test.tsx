import { CURRENT_VENDOR_AGREEMENT_VERSION, PAYOUT_RELEASE_HOURS } from '@vendor-marketplace/shared';
import type { WireVendorAgreementStatus, WireVendorPayoutStatus } from '@/lib/wire-schemas';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.fn<() => Promise<void>>();
const getPayoutStatus = vi.fn<() => Promise<WireVendorPayoutStatus | null>>();
const getAgreementStatus = vi.fn<() => Promise<WireVendorAgreementStatus | null>>();
const getTaxStatementYears = vi.fn<() => Promise<number[]>>();
const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock('@/lib/current-user', () => ({ requireRole: () => requireRole() }));
vi.mock('@/lib/vendor-data', () => ({
  getPayoutStatus: () => getPayoutStatus(),
  getAgreementStatus: () => getAgreementStatus(),
  getTaxStatementYears: () => getTaxStatementYears(),
}));
vi.mock('@/components/vendor/stripe-dashboard-link', () => ({
  StripeDashboardLink: () => <button type="button">Open your Stripe dashboard</button>,
}));
vi.mock('@/components/vendor/tax-statement-downloads', () => ({
  // The real component's root is a `div`, which is what a paragraph must never hold.
  TaxStatementDownloads: ({ years }: { years: number[] }) => (
    <div>
      {years.map((year) => (
        <button key={year} type="button">{`${year} statement (CSV)`}</button>
      ))}
    </div>
  ),
}));
vi.mock('next/navigation', () => ({ redirect: (path: string) => redirect(path) }));
vi.mock('@/components/vendor/connect-payouts-form', () => ({
  ConnectPayoutsForm: ({ isResuming }: { isResuming: boolean }) => (
    <button type="button">{isResuming ? 'Continue setup' : 'Set up payouts'}</button>
  ),
}));

const { default: VendorPaymentsPage } = await import('./page');

/** A vendor holding the current agreement — step 3 done, so step 4 renders. */
function accepted(isCurrent = true): WireVendorAgreementStatus {
  return {
    current: CURRENT_VENDOR_AGREEMENT_VERSION,
    businessName: 'First Light',
    accepted: null,
    isCurrent,
    history: [],
  };
}

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
    getAgreementStatus.mockReset();
    getAgreementStatus.mockResolvedValue(accepted());
    getTaxStatementYears.mockReset();
    getTaxStatementYears.mockResolvedValue([]);
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

  /**
   * Step 3 before step 4 (#427, frame `32`). The commission and the payout
   * timing are agreed before there is a payout rail to implement them, so a
   * vendor who has not accepted goes back rather than handing Stripe their
   * bank details first. `POST /vendor/stripe/connect` refuses for the same
   * reason, which is what makes this a signpost rather than the enforcement.
   */
  it('sends a vendor who has not accepted the agreement to step 3 first', async () => {
    getPayoutStatus.mockResolvedValue({ stripeAccountId: null, stripeOnboarded: false });
    getAgreementStatus.mockResolvedValue(accepted(false));

    await expect(VendorPaymentsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'REDIRECT:/vendor/agreement',
    );
  });

  it('states the payout gate in the approved words, in gold', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    const banner = screen.getByText(/You can't take payment until payouts are connected\./);
    expect(banner.textContent).toBe("You can't take payment until payouts are connected.");

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
    // No lifetime is stated: nothing in this repo decides how long Stripe's link lasts.
    expect(banners[0]!.textContent).toContain("Stripe's setup links expire.");
    expect(banners[0]!.textContent).not.toMatch(/minute|hour/);
    expect(banners[0]!.className).toContain('steel');
  });

  it('shows no gate and no setup button once payouts are connected', async () => {
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: true });

    expect(screen.queryByText(/You can't take payment/)).toBeNull();
    expect(screen.queryByText('Set up payouts')).toBeNull();
    expect(screen.queryByText('Continue setup')).toBeNull();
    expect(screen.getByRole('status').className).toContain('sage');
    expect(screen.getByRole('status').textContent).toContain(
      `pays it out to you ${PAYOUT_RELEASE_HOURS} hours after the event date.`,
    );
    expect(document.body.textContent).not.toContain('until the event is complete');
  });

  it('opens the Stripe dashboard from the connected banner and lists a statement per year (VEN-725)', async () => {
    getTaxStatementYears.mockResolvedValue([2027, 2026]);
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: true });

    expect(screen.getByRole('button', { name: 'Open your Stripe dashboard' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2027 statement (CSV)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '2026 statement (CSV)' })).toBeTruthy();
    expect(document.body.textContent).not.toContain(
      ['There is nothing', 'else to do here.'].join(' '),
    );
  });

  /*
   * `Banner` puts its sentence in a `<p>`. A `<div>` inside it makes the browser
   * close the paragraph while parsing the server markup, so the page fails to
   * hydrate (React error 418) — which jsdom's client render never shows and the
   * route-landing journey does. Assert the invalid nesting itself, for both
   * states the statement list can sit in.
   */
  it.each([
    ['payouts connected', true],
    ['payouts not connected', false],
  ])(
    'keeps the statement list out of any paragraph when %s (VEN-725)',
    async (_label, onboarded) => {
      getTaxStatementYears.mockResolvedValue([2027, 2026]);
      await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: onboarded });

      expect(screen.getByRole('button', { name: '2027 statement (CSV)' })).toBeTruthy();
      expect(document.querySelectorAll('p div, p ul, p ol, p table, p section')).toHaveLength(0);
      expect(screen.getByRole('status').textContent).not.toContain('statement (CSV)');
    },
  );

  it('offers no dashboard link before payouts are connected, but keeps a past year statement', async () => {
    getTaxStatementYears.mockResolvedValue([2026]);
    await renderPage({ stripeAccountId: 'acct_1', stripeOnboarded: false });

    expect(screen.queryByText('Open your Stripe dashboard')).toBeNull();
    expect(screen.getByText('2026 statement (CSV)')).toBeTruthy();
  });

  it('does not ask for statements before an account exists', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    expect(getTaxStatementYears).not.toHaveBeenCalled();
  });

  /** MVP takes no vendor fee, so no rate may appear anywhere in this flow. */
  it('makes no fee claim', async () => {
    await renderPage({ stripeAccountId: null, stripeOnboarded: false });

    const copy = document.body.textContent ?? '';
    expect(copy).not.toMatch(/\d+\s*%/);
    expect(copy.toLowerCase()).not.toContain('fee');
  });
});
