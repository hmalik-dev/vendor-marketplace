import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireAdminCloseBlocker } from '@/lib/wire-schemas';

vi.mock('@/lib/use-api', () => ({ useApi: () => vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { DataRightsActions } = await import('./data-rights-actions');

afterEach(cleanup);

const BLOCKER: WireAdminCloseBlocker = {
  bookingId: '44444444-4444-4444-8444-444444444444',
  eventDate: '2099-06-01',
  counterpartyName: 'Sunlit Studio',
};

function renderActions(
  overrides: Partial<{
    closedAt: Date | null;
    closeBlockers: readonly WireAdminCloseBlocker[];
    bookingsRefundedOnClose: number;
    isSelf: boolean;
  }>,
): void {
  render(
    <DataRightsActions
      userId="33333333-3333-4333-8333-333333333333"
      name="Dana Okafor"
      closedAt={overrides.closedAt ?? null}
      closeBlockers={overrides.closeBlockers ?? []}
      bookingsRefundedOnClose={overrides.bookingsRefundedOnClose ?? 0}
      isSelf={overrides.isSelf ?? false}
    />,
  );
}

/** The dialog is behind the trigger, and its copy is the thing under test. */
function openConfirmation(): HTMLElement {
  fireEvent.click(closeButton());

  return screen.getByRole('alertdialog');
}

/** `disabled` read off the element, since this suite has no jest-dom matchers. */
function closeButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: 'Close account' }) as HTMLButtonElement;
}

/**
 * The three states of the closure control, which is the part of this component
 * that decides something (#438).
 *
 * The refusal is stated **before** it is attempted: an operator on a support
 * call needs to know a closure will be refused without clicking to find out, so
 * the disabled branch and the sentence naming the bookings are the behaviour,
 * not decoration. The API's 409 remains the guarantee — these assertions are
 * that the page agrees with it rather than that it enforces anything.
 */
describe('the data-rights closure control', () => {
  it('offers the closure when nothing blocks it', () => {
    renderActions({});

    expect(closeButton().disabled).toBe(false);
    expect(screen.queryByText(/cannot be closed while it holds/)).toBeNull();
  });

  it('disables it and names every blocking booking when one stands (D39)', () => {
    renderActions({ closeBlockers: [BLOCKER] });

    expect(closeButton().disabled).toBe(true);

    const warning = screen.getByText(/cannot be closed while it holds/);
    expect(warning.textContent).toContain('an upcoming confirmed booking');
    expect(warning.textContent).toContain('2099-06-01 with Sunlit Studio');
  });

  it('pluralises and lists each booking when several stand', () => {
    renderActions({
      closeBlockers: [
        BLOCKER,
        { ...BLOCKER, bookingId: 'other', eventDate: '2099-07-04', counterpartyName: 'Ada Pell' },
      ],
    });

    const warning = screen.getByText(/cannot be closed while it holds/);
    expect(warning.textContent).toContain('upcoming confirmed bookings');
    expect(warning.textContent).toContain('2099-06-01 with Sunlit Studio');
    expect(warning.textContent).toContain('2099-07-04 with Ada Pell');
  });

  /**
   * The confirmation has to say what the closure will actually do, and that
   * differs by which side of the booking this account is on (D39).
   *
   * A closure never prices the account holder's own bookings — those refuse it
   * outright. A **vendor's** closure refunds their customers in full and pays
   * the vendor nothing, through #433's shared unwind. Telling an operator
   * "it refunds nothing" while five refunds are about to issue is the failure
   * this asserts against.
   */
  it('promises no refund when the account holds no vendor-side bookings', () => {
    renderActions({});

    expect(openConfirmation().textContent).toContain('It refunds nothing and prices nothing.');
  });

  it('names the refunds a vendor closure will issue, and the zeroed payout', () => {
    renderActions({ bookingsRefundedOnClose: 3 });

    const dialog = openConfirmation();

    expect(dialog.textContent).toContain('cancels the 3 upcoming confirmed bookings');
    expect(dialog.textContent).toContain('refunds them in full');
    expect(dialog.textContent).toContain('paying this vendor nothing');
    expect(dialog.textContent).not.toContain('It refunds nothing');
    /* And it does not promise a refund the unwind may decline to make. */
    expect(dialog.textContent).toContain('Any refund Stripe refuses is reported back here');
  });

  it('says booking, not bookings, when exactly one would be refunded', () => {
    renderActions({ bookingsRefundedOnClose: 1 });

    const dialog = openConfirmation();

    expect(dialog.textContent).toContain('cancels the 1 upcoming confirmed booking their');
    expect(dialog.textContent).toContain('refunds it in full');
  });

  /**
   * The API answers 403 to an operator closing their own account — it would
   * take the `admin_actions` log that names them with it — and the page has to
   * refuse it too. A control that offers what the server will refuse is a
   * control that lies, and the browser pass found this one enabled.
   */
  it('refuses the operator their own account, and says why', () => {
    renderActions({ isSelf: true });

    expect(closeButton().disabled).toBe(true);

    const reason = screen.getByText(/cannot close your own account/);
    expect(reason.textContent).toContain('recorded against the operator who took it');
    expect(screen.queryByText(/cannot be closed while it holds/)).toBeNull();
  });

  it('still offers the export on the operator own record', () => {
    renderActions({ isSelf: true });

    expect(
      (screen.getByRole('button', { name: 'Export their record' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  /**
   * A closed account keeps its export control and loses only the closure — the
   * page exists to show what is still held, so it must not read as an empty
   * screen implying the person is gone.
   */
  it('shows the closing date instead of the control once the account is closed', () => {
    renderActions({ closedAt: new Date('2026-09-07T11:31:00.000Z'), closeBlockers: [BLOCKER] });

    expect(screen.queryByRole('button', { name: 'Close account' })).toBeNull();
    expect(screen.getByText('Closed 2026-09-07').textContent).toBe('Closed 2026-09-07');
    expect(screen.queryByText(/cannot be closed while it holds/)).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'Export their record' }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});
