import { BRAND_NAME, PAYOUT_RELEASE_HOURS } from '@vendor-marketplace/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { WireVendorPayouts } from '@/lib/wire-schemas';

vi.mock('@/components/vendor/stripe-dashboard-link', () => ({
  StripeDashboardLink: ({ label }: { label?: string }) => <button type="button">{label}</button>,
}));

const { PayoutsOverview } = await import('./payouts-overview');

const HELD_SOON = '11111111-1111-4111-8111-111111111111';
const HELD_LATER = '22222222-2222-4222-8222-222222222222';
const PAID = '33333333-3333-4333-8333-333333333333';

const EMPTY: WireVendorPayouts = {
  summary: {
    pendingCents: 0,
    pendingCount: 0,
    next: null,
    heldCents: 0,
    heldCount: 0,
    debtOutstandingCents: 0,
    debtRecoveredCents: 0,
    backupWithholding: false,
  },
  nextBookingId: null,
  account: null,
  rows: [],
};

/** Frame `49`'s rows: two held and one paid, newest event first as the API sends them. */
const OWED: WireVendorPayouts = {
  summary: {
    ...EMPTY.summary,
    pendingCents: 415_000,
    pendingCount: 2,
    next: {
      cents: 175_000,
      customerFirstName: 'Priya',
      releaseAt: new Date('2026-06-17T00:00:00.000Z'),
      isDue: false,
    },
  },
  nextBookingId: HELD_SOON,
  account: { bankName: 'Chase', last4: '4821' },
  rows: [
    {
      bookingId: HELD_LATER,
      customerName: 'Reyes',
      eventType: 'corporate',
      eventDate: '2026-07-02',
      cents: 240_000,
      payoutStatus: 'pending',
      releaseAt: new Date('2026-07-05T00:00:00.000Z'),
      paidAt: null,
    },
    {
      bookingId: HELD_SOON,
      customerName: 'Nandakumar',
      eventType: 'wedding',
      eventDate: '2026-06-14',
      cents: 175_000,
      payoutStatus: 'pending',
      releaseAt: new Date('2026-06-17T00:00:00.000Z'),
      paidAt: null,
    },
    {
      bookingId: PAID,
      customerName: 'Schultz',
      eventType: 'engagement',
      eventDate: '2026-04-11',
      cents: 98_000,
      payoutStatus: 'released',
      releaseAt: new Date('2026-04-14T00:00:00.000Z'),
      paidAt: new Date('2026-04-14T00:15:00.000Z'),
    },
  ],
};

function card(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('section')!;
}

describe('PayoutsOverview', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the next payout amount, date and booking', () => {
    render(<PayoutsOverview payouts={OWED} />);

    expect(card('Next payout').textContent).toBe(
      'Next payout$1,750Jun 17, 2026 · Nandakumar wedding',
    );
  });

  it('says nothing is paying out when nothing is held', () => {
    render(<PayoutsOverview payouts={EMPTY} />);

    expect(card('Next payout').textContent).toBe('Next payout—Nothing to pay out yet');
    expect(card('On hold').textContent).toBe('On hold$0Nothing on hold');
    expect(screen.getByText('No payouts yet')).toBeTruthy();
  });

  it('sums every held payout, a disputed one included', () => {
    render(
      <PayoutsOverview
        payouts={{ ...OWED, summary: { ...OWED.summary, heldCents: 50_000, heldCount: 1 } }}
      />,
    );

    expect(card('On hold').textContent).toBe(
      `On hold$4,6502 bookings, each released ${PAYOUT_RELEASE_HOURS} hours after its event$500 held while a reported problem is reviewed`,
    );
  });

  it('gives a disputed payout no release promise', () => {
    render(
      <PayoutsOverview
        payouts={{ ...EMPTY, summary: { ...EMPTY.summary, heldCents: 50_000, heldCount: 1 } }}
      />,
    );

    expect(card('On hold').textContent).toBe(
      'On hold$500$500 held while a reported problem is reviewed',
    );
  });

  it('names the payout bank when Stripe returns it, else says it is managed in Stripe', () => {
    render(<PayoutsOverview payouts={OWED} />);
    expect(within(card('Payout account')).getByText('Chase ···· 4821')).toBeTruthy();
    cleanup();

    render(<PayoutsOverview payouts={EMPTY} />);
    expect(within(card('Payout account')).getByText('Managed in Stripe')).toBeTruthy();
    expect(
      within(card('Payout account')).getByRole('button', { name: 'Manage in Stripe' }),
    ).toBeTruthy();
  });

  it('lists held and paid rows newest first with booking, event, amount, release and status', () => {
    render(<PayoutsOverview payouts={OWED} />);

    const rows = screen.getAllByRole('row').map((row) =>
      within(row)
        .getAllByRole(row.querySelector('th') ? 'columnheader' : 'cell')
        .map((cell) => cell.textContent),
    );

    expect(rows).toEqual([
      ['Booking', 'Event', 'Amount', 'Release', 'Status'],
      ['Reyes corporate event', 'Jul 2, 2026', '$2,400', 'Jul 5, 2026', 'Held'],
      ['Nandakumar wedding', 'Jun 14, 2026', '$1,750', 'Jun 17, 2026', 'Held'],
      ['Schultz engagement', 'Apr 11, 2026', '$980', 'Apr 14, 2026', 'Paid'],
    ]);
  });

  it('gives a disputed row no release date', () => {
    const disputed = {
      ...OWED.rows[1]!,
      payoutStatus: 'held' as const,
      releaseAt: null,
    };
    render(<PayoutsOverview payouts={{ ...OWED, rows: [disputed] }} />);

    expect(screen.getByRole('cell', { name: 'After review' })).toBeTruthy();
  });

  it('explains the hold from config, not a literal', () => {
    render(<PayoutsOverview payouts={EMPTY} />);

    expect(screen.getByRole('status').textContent).toBe(
      `Why payouts waitEach payment is held by ${BRAND_NAME} until ${PAYOUT_RELEASE_HOURS} hours after the event, then transferred to your account. That window is when a customer can report a problem.`,
    );
  });
});
