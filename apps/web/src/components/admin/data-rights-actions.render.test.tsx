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
/** The refusal panel — the one gold surface this component draws. */
function panel(): HTMLElement {
  const found = document.querySelector<HTMLElement>('.bg-gold-50');
  expect(found, 'no refusal panel is drawn').not.toBeNull();

  return found as HTMLElement;
}

describe('the data-rights closure control', () => {
  it('offers the closure when nothing blocks it', () => {
    renderActions({});

    expect(closeButton().disabled).toBe(false);
    expect(screen.queryByText(/Can't close/)).toBeNull();
  });

  it('disables it and names every blocking booking when one stands (D39)', () => {
    renderActions({ closeBlockers: [BLOCKER] });

    expect(closeButton().disabled).toBe(true);

    /*
     * Pattern B's copy (#454): the refusal opens by *naming itself*, so the
     * first four words tell an operator this is a rule rather than a fault.
     */
    const warning = panel();
    expect(warning.textContent).toContain("Can't close: 1 confirmed booking on June 1, 2099.");
    expect(warning.textContent).toContain('Cancel or complete it first');
    expect(warning.textContent).toContain('June 1, 2099 with Sunlit Studio');
  });

  /**
   * The dates are **written out**, not printed as the column holds them.
   *
   * The panel rendered `2026-06-01` twice — once in the headline and once in
   * the list — on a console where every other date is formatted, and on the one
   * screen #454 ruled to US English. Found by a browser pass, in this ticket's
   * own code.
   *
   * `formatEventDate` is the single implementation for exactly this (#412 found
   * three private copies agreeing by coincidence), and it anchors at UTC
   * midnight because an event date is a Postgres `DATE` that must not be
   * re-read in the viewer's zone — a raw string cannot move a day, but a
   * carelessly formatted one can.
   *
   * The negative assertion is the half that can fail: the ISO form must not
   * survive anywhere in the panel.
   */
  it('writes the blocking booking dates out rather than printing the column', () => {
    renderActions({ closeBlockers: [BLOCKER] });

    const text = panel().textContent ?? '';

    expect(text).toContain('June 1, 2099');
    expect(text).not.toContain('2099-06-01');
  });

  /**
   * The panel is gold and sits **above** the control it refuses.
   *
   * Both halves matter and neither is decoration. The explanation used to sit
   * below the button, so an operator met a disabled control first and its
   * cause second — and a disabled button with no visible reason is
   * indistinguishable from a broken one. Gold because `40-states.md` reserves
   * it for waiting on someone: this account is waiting on a booking, and
   * nothing has failed.
   */
  it('draws the refusal in gold, above the button', () => {
    renderActions({ closeBlockers: [BLOCKER] });

    const gold = panel();
    expect(gold.className).toContain('bg-gold-50');
    expect(gold.compareDocumentPosition(closeButton()) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Not red: nothing has failed, so `40-states.md` reserves this for gold.
    expect(document.querySelectorAll('.bg-error-50')).toHaveLength(0);
  });

  it('pluralises and lists each booking when several stand', () => {
    renderActions({
      closeBlockers: [
        BLOCKER,
        { ...BLOCKER, bookingId: 'other', eventDate: '2099-07-04', counterpartyName: 'Ada Pell' },
      ],
    });

    const warning = panel();
    expect(warning.textContent).toContain('2 confirmed bookings');
    expect(warning.textContent).toContain('Cancel or complete them first');
    expect(warning.textContent).toContain('June 1, 2099 with Sunlit Studio');
    expect(warning.textContent).toContain('July 4, 2099 with Ada Pell');
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

    const reason = panel();
    expect(reason.textContent).toContain("Can't close: this is your own account.");
    expect(reason.textContent).toContain('recorded against the operator who took it');
    expect(reason.textContent).not.toContain('confirmed booking');
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
