import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminPaymentRow, WireAdminPayoutRetryResult } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const { canRetryPayout, PaymentTable, retryNotice } = await import('./payment-table');

afterEach(cleanup);

const EMPTY = { headline: 'No payments yet', description: 'Nothing has been charged.' };

const BASE: WireAdminPaymentRow = {
  bookingId: '11111111-1111-4111-8111-111111111111',
  status: 'confirmed',
  totalAmountCents: 145_000,
  platformFeeCents: 17_400,
  vendorPayoutCents: 127_600,
  stripePaymentIntentId: 'pi_test_1',
  vendorName: 'Sunlit Studio',
  vendorSlug: 'sunlit-studio',
  customerName: 'Anjali Rao',
  paidAt: new Date('2026-05-01T00:00:00.000Z'),
  payoutStatus: 'pending',
  payoutReleasedAt: null,
  payoutAttempts: 0,
  payoutFailureReason: null,
  stripeTransferId: null,
  payoutFailing: false,
};

const row = (overrides: Partial<WireAdminPaymentRow>): WireAdminPaymentRow => ({
  ...BASE,
  ...overrides,
});

const FAILING = row({
  payoutAttempts: 3,
  payoutFailureReason: 'Stripe refused the transfer',
  payoutFailing: true,
});

const retryResult = (
  overrides: Partial<WireAdminPayoutRetryResult>,
): WireAdminPayoutRetryResult => ({
  outcome: 'failed',
  payoutStatus: 'pending',
  payoutAttempts: 4,
  payoutFailureReason: 'Stripe refused the transfer',
  payoutReleasedAt: null,
  stripeTransferId: null,
  payoutFailing: true,
  ...overrides,
});

describe('the payments table', () => {
  it('draws the payout state each row is in, in the shared vocabulary', () => {
    render(
      <PaymentTable
        empty={EMPTY}
        rows={[
          row({ bookingId: 'a', payoutStatus: 'released' }),
          row({ bookingId: 'b', payoutStatus: 'held' }),
          row({ bookingId: 'c', payoutStatus: 'pending' }),
        ]}
      />,
    );

    expect(screen.getAllByText('Released').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Held').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awaiting release').length).toBeGreaterThan(0);
  });

  /**
   * The flag replaces the state pill rather than sitting beside it, and carries
   * the count and Stripe's reason — an operator scanning the unfiltered table
   * has to find these without knowing the filter exists (#415's lesson).
   */
  it('replaces the state pill with the failing flag, and says how often and why', () => {
    render(<PaymentTable empty={EMPTY} rows={[FAILING]} />);

    expect(screen.getAllByText('Transfer failing').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3 attempts · Stripe refused the transfer/).length).toBeGreaterThan(
      0,
    );
    expect(screen.queryByText('Awaiting release')).toBeNull();
  });

  it('says attempt in the singular for the first failure', () => {
    render(<PaymentTable empty={EMPTY} rows={[row({ ...FAILING, payoutAttempts: 1 })]} />);

    expect(screen.getAllByText(/1 attempt ·/).length).toBeGreaterThan(0);
  });

  /*
   * Counted rather than pinned: `DataTable` renders the same row twice — the
   * grid above the card breakpoint and the card list below it — and both mount
   * under jsdom, so an exact count would assert the table's layout rather than
   * this component's rule.
   */
  it('offers the retry on a failing row', () => {
    render(<PaymentTable empty={EMPTY} rows={[FAILING]} />);

    expect(screen.getAllByRole('button', { name: 'Retry payout' }).length).toBeGreaterThan(0);
  });

  /*
   * A cancelled booking's residual is failing and owed, so the row keeps its
   * flag — but only the sweep may release it, so the button that would be
   * answered 409 is not drawn.
   */
  it('offers it nowhere else, including on a failing but cancelled booking', () => {
    render(
      <PaymentTable
        empty={EMPTY}
        rows={[
          row({ bookingId: 'a', payoutStatus: 'released' }),
          row({ bookingId: 'b', payoutStatus: 'held' }),
          row({ bookingId: 'c' }),
          row({ ...FAILING, bookingId: 'd', status: 'cancelled' }),
        ]}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Retry payout' })).toBeNull();
    // The flag itself is still drawn on that cancelled row.
    expect(screen.getAllByText('Transfer failing').length).toBeGreaterThan(0);
  });

  it('renders the empty state it is given', () => {
    render(<PaymentTable empty={EMPTY} rows={[]} />);

    expect(screen.getAllByText('No payments yet').length).toBeGreaterThan(0);
  });
});

describe('canRetryPayout', () => {
  it('is true only for a failing payout the sweep has not been given sole charge of', () => {
    expect(canRetryPayout(FAILING)).toBe(true);
    expect(canRetryPayout(row({ ...FAILING, status: 'cancelled' }))).toBe(false);
    expect(canRetryPayout(BASE)).toBe(false);
  });
});

describe('retryNotice', () => {
  /**
   * **The state is read before the outcome, and that ordering is the point.**
   *
   * A retry whose claim found the row locked answers `busy` — and the thing
   * holding the lock may have been the scheduled sweep releasing this very
   * payout. Reporting the outcome first would put "the scheduled release is
   * already working this payout" beside a row that has just redrawn as
   * Released.
   */
  it('reports a release even when the outcome says another worker got there first', () => {
    const notice = retryNotice(
      FAILING,
      retryResult({
        outcome: 'busy',
        payoutStatus: 'released',
        payoutReleasedAt: new Date('2026-09-07T00:00:00.000Z'),
        payoutFailing: false,
      }),
    );

    expect(notice.status).toBe('settled');
    expect(notice.message).toBe('Sunlit Studio has been paid $1,276.');
  });

  /* And a hold is not a release the operator should be told to wait for. */
  it('reports a hold rather than promising a release that will never run', () => {
    const notice = retryNotice(
      FAILING,
      retryResult({ outcome: 'busy', payoutStatus: 'held', payoutFailing: false }),
    );

    expect(notice.status).toBe('pending');
    expect(notice.message).toBe(
      "A problem was reported on Sunlit Studio's booking, so the payout is on hold.",
    );
  });

  it('says who is already working it when nothing about the money changed', () => {
    const notice = retryNotice(FAILING, retryResult({ outcome: 'busy' }));

    expect(notice.status).toBe('informational');
    expect(notice.message).toBe(
      "The scheduled release is already working Sunlit Studio's payout. Check back in a few minutes.",
    );
  });

  it('reports the new reason and the new attempt when Stripe refuses again', () => {
    const notice = retryNotice(FAILING, retryResult({}));

    expect(notice.status).toBe('failed');
    expect(notice.message).toBe(
      "Stripe refused Sunlit Studio's transfer again: Stripe refused the transfer. That is attempt 4.",
    );
  });

  it('still says something when the gateway gave no reason', () => {
    const notice = retryNotice(FAILING, retryResult({ payoutFailureReason: null }));

    expect(notice.message).toContain('no reason given');
  });

  /*
   * Every branch names the vendor. The filter exists to put several failing
   * rows on screen at once, so a banner about no particular row is one an
   * operator can misread as the answer for the row they just acted on.
   */
  it('names the vendor on every branch', () => {
    const outcomes: WireAdminPayoutRetryResult[] = [
      retryResult({ payoutStatus: 'released', payoutFailing: false }),
      retryResult({ payoutStatus: 'held', payoutFailing: false }),
      retryResult({ outcome: 'busy' }),
      retryResult({}),
    ];

    for (const result of outcomes) {
      expect(retryNotice(FAILING, result).message).toContain('Sunlit Studio');
    }
  });
});
