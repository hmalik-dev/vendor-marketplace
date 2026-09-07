import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NextPayout } from './next-payout';
import type { WireVendorDashboard } from '@/lib/wire-schemas';

afterEach(cleanup);

/** Jun 15's event under D35's window — the release date frame `27` draws beside. */
const RELEASE_AT = new Date('2026-06-18T00:00:00.000Z');
const TODAY = '2026-06-15';

function payouts(
  overrides: Partial<WireVendorDashboard['payouts']> = {},
): WireVendorDashboard['payouts'] {
  return { pendingCents: 0, pendingCount: 0, next: null, heldCents: 0, heldCount: 0, ...overrides };
}

function next(
  overrides: Partial<NonNullable<WireVendorDashboard['payouts']['next']>> = {},
): NonNullable<WireVendorDashboard['payouts']['next']> {
  return {
    cents: 175_000,
    customerFirstName: 'Anjali',
    releaseAt: RELEASE_AT,
    isDue: false,
    ...overrides,
  };
}

describe('NextPayout', () => {
  /*
   * The frame's own composition: one payout, one customer, one date. This is
   * the case the deviation recorded in `16-vendor-dashboard.md` was open on —
   * the card wrote `after the event on Jun 15` because no payout schedule
   * existed to date it. #423 built one, so the frame's line is now buildable.
   */
  it('names the customer and the release date for a single pending payout', () => {
    const { container } = render(
      <NextPayout
        payouts={payouts({ pendingCents: 175_000, pendingCount: 1, next: next() })}
        serverToday={TODAY}
      />,
    );

    expect(screen.getByText('$1,750')).toBeDefined();
    expect(screen.getByText('Anjali · pays out Jun 18')).toBeDefined();
    // One payout is its own total; the card does not restate it.
    expect(container.textContent).not.toContain('pending in total');
  });

  /**
   * **The figure and the date describe the same booking.**
   *
   * $500 pays out on the 18th and $9,000 a month later. A card printing
   * `$9,500 · pays out Jun 18` would promise the whole sum on the earliest
   * date — the disagreement between the shown figure and what Stripe moves
   * that acceptance 7 exists to make impossible. The total is a separate,
   * undated line.
   */
  it('prints the next payout alone, and the total on its own undated line', () => {
    const { container } = render(
      <NextPayout
        payouts={payouts({
          pendingCents: 950_000,
          pendingCount: 2,
          next: next({ cents: 50_000, customerFirstName: 'Anjali' }),
        })}
        serverToday={TODAY}
      />,
    );

    expect(screen.getByText('$500')).toBeDefined();
    expect(screen.getByText('Anjali · pays out Jun 18')).toBeDefined();
    expect(screen.getByText('$9,500 pending in total')).toBeDefined();
    // The sum must never appear as the dated figure.
    expect(container.querySelector('.font-display')?.textContent).toBe('$500');
  });

  /*
   * A release window that has already closed. The date is real, but a transfer
   * that keeps failing stays pending and its date recedes — "pays out Aug 20"
   * on September 6th is the card asserting a future that has passed.
   */
  it('says the money is moving once the release date is behind us', () => {
    const { container } = render(
      <NextPayout
        payouts={payouts({ pendingCents: 175_000, pendingCount: 1, next: next({ isDue: true }) })}
        serverToday="2026-09-06"
      />,
    );

    expect(screen.getByText('Anjali · paying out now')).toBeDefined();
    expect(container.textContent).not.toContain('Jun 18');
  });

  /* A release date outside the viewer's year needs one, or `Mar 4` in September
   * reads six months behind rather than eighteen ahead. */
  it('carries the year when the payout does not land in this one', () => {
    render(
      <NextPayout
        payouts={payouts({
          pendingCents: 175_000,
          pendingCount: 1,
          next: next({ releaseAt: new Date('2028-03-04T00:00:00.000Z') }),
        })}
        serverToday={TODAY}
      />,
    );

    expect(screen.getByText('Anjali · pays out Mar 4, 2028')).toBeDefined();
  });

  /*
   * `users.first_name` is written as `firstName ?? ''` at both Clerk entry
   * points, so a customer who signed up without one yields an empty string. The
   * separator has to go with it.
   */
  it('drops the separator when the customer has no first name', () => {
    render(
      <NextPayout
        payouts={payouts({
          pendingCents: 175_000,
          pendingCount: 1,
          next: next({ customerFirstName: '' }),
        })}
        serverToday={TODAY}
      />,
    );

    expect(screen.getByText('pays out Jun 18')).toBeDefined();
  });

  /*
   * `40-states.md`: gold is waiting on someone, red is a failure. A dispute is
   * waiting. The held amount is its own line and is **never** added to either
   * figure — a total that included it would tell the vendor money is on its way
   * while it is frozen.
   */
  it('reports held money in gold, apart from the figures that are moving', () => {
    const { container } = render(
      <NextPayout
        payouts={payouts({
          pendingCents: 900_000,
          pendingCount: 1,
          next: next({ cents: 900_000 }),
          heldCents: 50_000,
          heldCount: 1,
        })}
        serverToday={TODAY}
      />,
    );

    expect(screen.getByText('$9,000')).toBeDefined();
    const held = screen.getByText('$500 held while a reported problem is reviewed');
    expect(held.className.split(' ')).toContain('text-gold-600');
    // The sum of the two, which the card must never print.
    expect(container.textContent).not.toContain('$9,500');
  });

  it('shows no release date when every payout is held', () => {
    const { container } = render(
      <NextPayout payouts={payouts({ heldCents: 50_000, heldCount: 1 })} serverToday={TODAY} />,
    );

    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('$500 held while a reported problem is reviewed')).toBeDefined();
    expect(container.textContent).not.toContain('pays out');
    // The mechanism sentence is the empty state, not the held state.
    expect(container.textContent).not.toContain('Paid out after each event');
  });

  /*
   * An em dash rather than `$0.00`, and the mechanism rather than a date. A
   * vendor with nothing booked is owed nothing *yet*, which is a different
   * claim from being owed zero — and there is no date to state.
   */
  it('reports an absent payout as absent, not as zero and not as a date', () => {
    const { container } = render(<NextPayout payouts={payouts()} serverToday={TODAY} />);

    expect(screen.getByText('—')).toBeDefined();
    expect(screen.getByText('Paid out after each event')).toBeDefined();
    expect(screen.queryByText('$0')).toBeNull();
    expect(container.textContent).not.toContain('pays out');
  });
});
