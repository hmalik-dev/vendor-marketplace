import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PayoutHealthAlert } from './payout-health-alert';

afterEach(cleanup);

const FAILING_PAYOUTS_PATH = '/admin/payments?flag=payout-failing';

describe('the payout health alert', () => {
  /**
   * Silence is the healthy state.
   *
   * A permanent line reading zero beside four metric cards is a sentence about
   * nothing, and it would teach an operator to stop reading the one banner that
   * only ever appears when money is stuck.
   */
  it('renders nothing at all when no transfer is failing', () => {
    const { container } = render(<PayoutHealthAlert blockedVendors={0} failingBookings={0} />);

    expect(container.innerHTML).toBe('');
  });

  it('leads to the list its number was counted over', () => {
    render(<PayoutHealthAlert blockedVendors={1} failingBookings={1} />);

    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe(FAILING_PAYOUTS_PATH);
    expect(link.textContent).toContain('1 transfer is failing');
  });

  it('pluralises the transfers', () => {
    render(<PayoutHealthAlert blockedVendors={1} failingBookings={4} />);

    expect(screen.getByRole('link').textContent).toContain('4 transfers are failing');
  });

  /*
   * The vendor count is the same set counted a second way, so it earns a clause
   * only when it says something the first number does not — four transfers
   * across one vendor is one story, across three vendors is another.
   */
  it('names the vendor spread only when there is more than one', () => {
    render(<PayoutHealthAlert blockedVendors={3} failingBookings={4} />);
    expect(screen.getByRole('link').textContent).toContain('across 3 vendors');

    cleanup();

    render(<PayoutHealthAlert blockedVendors={1} failingBookings={4} />);
    expect(screen.getByRole('link').textContent).not.toContain('across');
  });

  it('says the state clears itself, because the sweep keeps trying', () => {
    render(<PayoutHealthAlert blockedVendors={1} failingBookings={1} />);

    expect(screen.getByRole('status').textContent).toContain(
      'The scheduled release keeps trying, so this clears itself once the accounts are in order.',
    );
  });
});
