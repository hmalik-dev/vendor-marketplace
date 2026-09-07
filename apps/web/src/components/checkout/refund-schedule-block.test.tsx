import { cleanup, render, screen } from '@testing-library/react';
import {
  calculateRefund,
  formatPrice,
  refundSchedule,
  type RefundScheduleRow,
} from '@vendor-marketplace/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { currentRow, RefundScheduleBlock } from './refund-schedule-block';

/**
 * Frame `33` — the refund schedule at checkout.
 *
 * The assertion that matters is the last one: **the rendered schedule equals
 * what `calculateRefund` would actually return**. Everything above it is
 * composition; that one is the reason the block exists, because a policy the
 * refund code will not honour is the failure #374 warns about.
 */
const EVENT_DATE = '2027-06-14';
const TOTAL_CENTS = 205_000;
const MS_PER_HOUR = 60 * 60 * 1000;

afterEach(cleanup);

function block(props: Partial<Parameters<typeof RefundScheduleBlock>[0]> = {}) {
  return render(
    <RefundScheduleBlock
      totalCents={TOTAL_CENTS}
      eventDate={EVENT_DATE}
      vendorName="June"
      {...props}
    />,
  );
}

describe('the refund schedule block', () => {
  it('resolves the boundaries into the booking own dates', () => {
    block();

    // 48 hours before midnight UTC on 14 June is midnight UTC on 12 June.
    expect(screen.getByText('Before June 12')).toBeDefined();
    expect(screen.getByText('From June 12')).toBeDefined();
    expect(screen.getByText('After June 14')).toBeDefined();
  });

  it('resolves the money into real amounts, never a percentage', () => {
    const { container } = block();

    expect(screen.getByText(/\$2,050 back/)).toBeDefined();
    expect(screen.getByText(/\$1,025 back/)).toBeDefined();
    expect(container.textContent).not.toContain('50%');
    expect(container.textContent).not.toContain('30 days');
  });

  /** Acceptance 14, on the surface the design got wrong. */
  it('draws no non-refundable tier, because the code has none', () => {
    const { container } = block();

    expect(container.textContent?.toLowerCase()).not.toContain('non-refundable');
  });

  it('draws three windowed rows and the vendor-cancels row', () => {
    block();

    expect(screen.getByText('If June cancels')).toBeDefined();
    expect(screen.getByText(/Full refund/)).toBeDefined();
    expect(screen.getAllByRole('definition')).toHaveLength(4);
  });

  it('names the day the payment is released, from the constant', () => {
    block();

    // 72 hours after midnight UTC on 14 June is 17 June.
    expect(screen.getByText(/released to June on June 17/)).toBeDefined();
  });

  it('captions the schedule with the date it was calculated from', () => {
    block();

    expect(screen.getByText('Dates calculated from June 14, 2027.')).toBeDefined();
  });

  it('links the full policy at the terms anchor people paste into email', () => {
    block();

    expect(screen.getByRole('link', { name: 'Full policy' }).getAttribute('href')).toBe(
      '/terms#cancellations-and-refunds',
    );
  });

  it('renders nothing for a date the parser rejects, rather than Invalid Date', () => {
    const { container } = block({ eventDate: '14/06/2027' });

    expect(container.textContent).toBe('');
  });

  /**
   * The customer hub's density: the row that applies today, plus the
   * vendor-cancels row. A customer looking at a live booking needs their
   * current position, not a schedule.
   */
  it('shows only the applicable row and the vendor row when asked', () => {
    block({ onlyCurrent: true, now: new Date('2027-06-13T00:00:00Z') });

    expect(screen.getByText('From June 12')).toBeDefined();
    expect(screen.getByText('If June cancels')).toBeDefined();
    expect(screen.queryByText('Before June 12')).toBeNull();
    expect(screen.getAllByRole('definition')).toHaveLength(2);
  });

  it('keeps the full-refund label pointing at the next window in that mode', () => {
    block({ onlyCurrent: true, now: new Date('2027-01-01T00:00:00Z') });

    expect(screen.getByText('Before June 12')).toBeDefined();
  });
});

/**
 * Acceptance 13, and the one this whole component is for: the schedule a
 * customer is shown has to be what the refund function will actually pay them.
 * Asserted against `calculateRefund`'s own output rather than against numbers
 * written here — if the two can disagree, eventually they will.
 */
describe('what the block draws is what calculateRefund returns', () => {
  const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];
  const event = new Date(`${EVENT_DATE}T00:00:00Z`).getTime();

  const samples: [string, Date][] = [
    ['a year out', new Date(event - 8_760 * MS_PER_HOUR)],
    ['a week out', new Date(event - 168 * MS_PER_HOUR)],
    ['at the cutoff', new Date(event - 48 * MS_PER_HOUR)],
    ['a millisecond past it', new Date(event - 48 * MS_PER_HOUR + 1)],
    ['the day before', new Date(event - 24 * MS_PER_HOUR)],
    ['on the day', new Date(event)],
    ['after the event', new Date(event + 96 * MS_PER_HOUR)],
  ];

  it.each(samples)('renders the amount the function would pay %s', (_when, now) => {
    cleanup();
    block({ onlyCurrent: true, now });

    const governing = currentRow(rows, now) as RefundScheduleRow;
    const quoted = calculateRefund(TOTAL_CENTS, EVENT_DATE, now).refundCents;

    if (governing.kind === 'release') {
      /*
       * The release row makes no refund claim, so there is no figure to
       * compare — because past the release a cancellation is D31's unwind,
       * driven by an operator, rather than the schedule. The claim to check is
       * therefore the *absence* of a figure: a number here would be one the
       * block owes and `calculateRefund` alone cannot honour.
       */
      expect(governing.refundCents).toBeNull();
      expect(screen.getByText(/released to June/).textContent).not.toMatch(/\$/);
      return;
    }

    expect(governing.refundCents).toBe(quoted);
    expect(screen.getByText(new RegExp(`\\${formatPrice(quoted)} back`))).toBeDefined();
  });
});
