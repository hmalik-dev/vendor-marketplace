import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  vendorId: '22222222-2222-4222-8222-222222222222',
  customerName: 'Anjali Rao',
  paidAt: new Date('2026-05-01T00:00:00.000Z'),
  payoutStatus: 'pending',
  payoutReleasedAt: null,
  payoutAttempts: 0,
  payoutFailureReason: null,
  stripeTransferId: null,
  payoutFailing: false,
  payoutStranded: false,
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
  it('links the vendor to the console, not to a storefront a banned vendor no longer has', () => {
    render(<PaymentTable empty={EMPTY} rows={[BASE]} />);

    const link = screen.getAllByRole('link', { name: 'Sunlit Studio' })[0]!;
    expect(link.getAttribute('href')).toBe('/admin/vendors/22222222-2222-4222-8222-222222222222');
  });

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
   * the count and Stripe's reason — an admin scanning the unfiltered table
   * has to find these without knowing the filter exists (#415's lesson).
   */
  it('replaces the state pill with the failing flag, and says how often and why', () => {
    render(<PaymentTable empty={EMPTY} rows={[FAILING]} />);

    expect(screen.getAllByText('Transfer failing').length).toBeGreaterThan(0);
    expect(screen.getAllByText('3 attempts').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Stripe refused the transfer').length).toBeGreaterThan(0);
    expect(screen.queryByText('Awaiting release')).toBeNull();
  });

  /*
   * The trigger exists only where the two-line clamp actually hides text. jsdom
   * performs no layout, so the overflow is stated by stubbing the element's
   * measured heights — the real clamp is checked in a browser.
   */
  describe('the reason clamp', () => {
    const REASON =
      'The vendor has not accepted the vendor agreement yet, so the transfer could not be made';
    const LONG = row({ payoutAttempts: 208, payoutFailureReason: REASON, payoutFailing: true });

    function measure(scrollHeight: number): void {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(32);
    }

    afterEach(() => vi.restoreAllMocks());

    it('splits the count from the reason, each on its own', () => {
      measure(80);
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      expect(screen.getAllByText('208 attempts').length).toBeGreaterThan(0);
      expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
    });

    it('offers a named trigger when the reason is cut, and opens the whole text in a dialog', async () => {
      measure(80);
      const user = userEvent.setup();
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      const trigger = screen.getAllByRole('button', { name: 'Read full reason' })[0]!;
      await user.click(trigger);

      const dialog = await screen.findByRole('dialog', { name: 'Full reason' });
      expect(dialog.textContent).toBe(REASON);

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });

    it('opens from the keyboard', async () => {
      measure(80);
      const user = userEvent.setup();
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      screen.getAllByRole('button', { name: 'Read full reason' })[0]!.focus();
      await user.keyboard('{Enter}');

      const dialog = await screen.findByRole('dialog', { name: 'Full reason' });
      expect(dialog.textContent).toBe(REASON);
    });

    it('opens on Space too', async () => {
      measure(80);
      const user = userEvent.setup();
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      screen.getAllByRole('button', { name: 'Read full reason' })[0]!.focus();
      await user.keyboard(' ');

      expect(await screen.findByRole('dialog', { name: 'Full reason' })).toBeTruthy();
    });

    it('opens from a touch tap, which has no hover to lean on', async () => {
      measure(80);
      const user = userEvent.setup({ pointerEventsCheck: 0 });
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      const trigger = screen.getAllByRole('button', { name: 'Read full reason' })[0]!;
      await user.pointer({ keys: '[TouchA]', target: trigger });

      expect((await screen.findByRole('dialog', { name: 'Full reason' })).textContent).toBe(REASON);
    });

    it('peeks on a mouse hover without taking focus, and closes when the mouse leaves', async () => {
      measure(80);
      const user = userEvent.setup();
      render(
        <>
          <input aria-label="Search" />
          <PaymentTable empty={EMPTY} rows={[LONG]} />
        </>,
      );
      const field = screen.getByRole('textbox', { name: 'Search' });
      field.focus();

      const trigger = screen.getAllByRole('button', { name: 'Read full reason' })[0]!;
      await user.hover(trigger);
      expect(await screen.findByRole('dialog', { name: 'Full reason' })).toBeTruthy();
      expect(document.activeElement).toBe(field);

      await user.unhover(trigger);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(field);
    });

    it('keeps a clicked panel open when the mouse leaves', async () => {
      measure(80);
      const user = userEvent.setup();
      render(<PaymentTable empty={EMPTY} rows={[LONG]} />);

      const trigger = screen.getAllByRole('button', { name: 'Read full reason' })[0]!;
      await user.click(trigger);
      await user.unhover(trigger);

      expect(screen.getByRole('dialog', { name: 'Full reason' })).toBeTruthy();
    });

    it('draws no trigger for a reason that fits', () => {
      measure(32);
      render(<PaymentTable empty={EMPTY} rows={[FAILING]} />);

      expect(screen.queryByRole('button', { name: 'Read full reason' })).toBeNull();
      expect(screen.getAllByText('Stripe refused the transfer').length).toBeGreaterThan(0);
    });
  });

  it('says stranded, never Awaiting release, for a payout owed to a banned or closed vendor', () => {
    const stranded = row({ payoutStatus: 'pending', payoutFailing: true, payoutStranded: true });
    render(<PaymentTable empty={EMPTY} rows={[stranded]} />);

    expect(screen.getAllByText('Stranded — vendor banned or closed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Awaiting release')).toBeNull();
    expect(screen.queryByText('Retry payout')).toBeNull();
    expect(canRetryPayout(stranded)).toBe(false);
  });

  it('says attempt in the singular for the first failure', () => {
    render(<PaymentTable empty={EMPTY} rows={[row({ ...FAILING, payoutAttempts: 1 })]} />);

    expect(screen.getAllByText('1 attempt').length).toBeGreaterThan(0);
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

  /* And a hold is not a release the admin should be told to wait for. */
  it('reports a hold rather than promising a release that will never run', () => {
    const notice = retryNotice(
      FAILING,
      retryResult({ outcome: 'busy', payoutStatus: 'held', payoutFailing: false }),
    );

    expect(notice.status).toBe('pending');
    expect(notice.message).toBe(
      "A problem was reported on Sunlit Studio's booking. The payout is on hold.",
    );
  });

  it('says who is already working it when nothing about the money changed', () => {
    const notice = retryNotice(FAILING, retryResult({ outcome: 'busy' }));

    expect(notice.status).toBe('informational');
    expect(notice.message).toBe("The scheduled release is already working Sunlit Studio's payout.");
  });

  it('reports the new reason and the new attempt when Stripe refuses again', () => {
    const notice = retryNotice(FAILING, retryResult({}));

    expect(notice.status).toBe('failed');
    expect(notice.message).toBe(
      "Stripe refused Sunlit Studio's transfer again: Stripe refused the transfer. Attempt 4.",
    );
  });

  it('still says something when the gateway gave no reason', () => {
    const notice = retryNotice(FAILING, retryResult({ payoutFailureReason: null }));

    expect(notice.message).toContain('no reason given');
  });

  /*
   * Every branch names the vendor. The filter exists to put several failing
   * rows on screen at once, so a banner about no particular row is one an
   * admin can misread as the answer for the row they just acted on.
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
