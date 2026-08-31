import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NextPayout } from './next-payout';

afterEach(cleanup);

describe('NextPayout', () => {
  it('states the amount and whose event it is for', () => {
    render(
      <NextPayout
        payout={{
          bookingId: '0b6d6e6a-7f1d-4a5f-9a2c-2e2a0f2a1b3c',
          eventDate: '2026-06-15',
          customerFirstName: 'Anjali',
          vendorPayoutCents: 175_000,
        }}
      />,
    );

    expect(screen.getByText('$1,750')).toBeDefined();
    expect(screen.getByText('Anjali · after the event on Jun 15')).toBeDefined();
  });

  /*
   * The recorded deviation from frame `27 Vendor dashboard — 1024`, asserted so
   * a later edit "back to the frame" fails here. The frame writes
   * `pays out Jun 15`; there is no payout schedule to read that date from until
   * #10, and the money rules forbid inventing one.
   */
  it('never claims a payout date', () => {
    const { container } = render(
      <NextPayout
        payout={{
          bookingId: '0b6d6e6a-7f1d-4a5f-9a2c-2e2a0f2a1b3c',
          eventDate: '2026-06-15',
          customerFirstName: 'Anjali',
          vendorPayoutCents: 175_000,
        }}
      />,
    );

    expect(container.textContent).not.toContain('pays out');
  });

  /*
   * An em dash rather than `$0.00`. A vendor with nothing booked is owed
   * nothing *yet*, which is a different claim from being owed zero.
   */
  it('reports an absent payout as absent, not as zero', () => {
    render(<NextPayout payout={null} />);

    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('Paid out after each event')).toBeDefined();
    expect(screen.queryByText('$0')).toBeNull();
  });
});
