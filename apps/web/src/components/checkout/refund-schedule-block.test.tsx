import { cleanup, render, screen } from '@testing-library/react';
import {
  CURRENT_REFUND_TERMS,
  calculateRefund,
  formatPrice,
  isUniversallyFutureDate,
  refundSchedule,
  type RefundScheduleRow,
} from '@vendor-marketplace/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
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
  it('resolves the boundaries into the booking own instants, zone named', () => {
    block();

    // The suite runs in UTC: 48 hours before midnight UTC on 14 June, then the
    // midnight UTC a day before the event, when online cancellation closes.
    expect(screen.getByText(/^Until Jun 12, 12:00\sAM UTC$/)).toBeDefined();
    expect(screen.getByText(/^Until Jun 13, 12:00\sAM UTC$/)).toBeDefined();
    expect(screen.getByText(/^From Jun 13, 12:00\sAM UTC$/)).toBeDefined();
    expect(screen.getByText('After June 14')).toBeDefined();
  });

  it('says online cancellation closes, with no refund figure on that row', () => {
    block();

    const closed = screen.getByText(/Online cancellation closes/);

    expect(closed.textContent).not.toMatch(/\$/);
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

  /*
   * VEN-659 reverses VEN-615 ruling 2: a vendor now cancels from their own
   * bookings page, so the row no longer sends the customer's vendor to support.
   */
  it('says the customer is refunded in full whenever the vendor cancels', () => {
    const { container } = block();

    expect(screen.getByText('If June cancels')).toBeDefined();
    expect(screen.getByText(/whenever it happens/).textContent).toBe(
      'Full refund, whenever it happens',
    );
    expect(container.textContent).not.toContain('through support');
    expect(screen.getAllByRole('definition')).toHaveLength(5);
  });

  /* Frame `39b`: 12.5px rows, a 13px gap under the heading, 8px beside its glyph. */
  it('sets the rows and heading at the frame values', () => {
    block();

    const heading = screen.getByRole('heading', { name: /If plans change/ });
    const classes = (element: Element) => element.className.split(/\s+/);

    expect(classes(heading)).toEqual(expect.arrayContaining(['mb-3.25', 'gap-2']));
    for (const cell of [...screen.getAllByRole('term'), ...screen.getAllByRole('definition')]) {
      expect(classes(cell)).toContain('text-sm');
    }
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
    block({ onlyCurrent: true, now: new Date('2027-06-12T12:00:00Z') });

    expect(screen.getByText(/^Until Jun 13/)).toBeDefined();
    expect(screen.getByText('If June cancels')).toBeDefined();
    expect(screen.queryByText(/^Until Jun 12/)).toBeNull();
    expect(screen.getAllByRole('definition')).toHaveLength(2);
  });

  it('shows the closed row, not the late tier, on the day before the event', () => {
    block({ onlyCurrent: true, now: new Date('2027-06-13T00:00:00Z') });

    expect(screen.getByText(/Online cancellation closes/)).toBeDefined();
    expect(screen.queryByText(/\$1,025 back/)).toBeNull();
  });
});

/*
 * VEN-615 acceptance 2. The viewer's own zone, not UTC: a Pacific customer's
 * full-refund window for an Oct 10 event ends at 5 PM on Oct 7, which a
 * date-only UTC label drew as "Oct 8".
 */
describe('in the viewer own time zone', () => {
  let previous: string | undefined;

  beforeAll(() => {
    previous = process.env.TZ;
    process.env.TZ = 'America/Los_Angeles';
  });

  afterAll(() => {
    process.env.TZ = previous;
  });

  it('states each boundary as a Pacific date and time', () => {
    block({ eventDate: '2026-10-10' });

    expect(screen.getByText(/^Until Oct 7, 5:00\sPM PDT$/)).toBeDefined();
    expect(screen.getByText(/^Until Oct 8, 5:00\sPM PDT$/)).toBeDefined();
    expect(screen.getByText(/^From Oct 8, 5:00\sPM PDT$/)).toBeDefined();
    expect(screen.queryByText(/Oct 8, 12:00/)).toBeNull();
  });
});

/*
 * VEN-615 acceptance 3. Across a grid of instants around every boundary, the
 * row the block says governs agrees with both halves of the server: the
 * refund `calculateRefund` pays, and whether `cancelBooking` accepts at all
 * (`isUniversallyFutureDate`).
 */
describe('what the block claims is what the server does', () => {
  const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];
  const event = new Date(`${EVENT_DATE}T00:00:00Z`).getTime();
  const fullEnds = event - 48 * MS_PER_HOUR;
  const closes = event - 24 * MS_PER_HOUR;
  const release = event + 72 * MS_PER_HOUR;

  const grid = [
    event - 8_760 * MS_PER_HOUR,
    fullEnds - 1,
    fullEnds,
    fullEnds + 1,
    closes - 1,
    closes,
    closes + 1,
    event,
    release - 1,
    release,
    release + 1,
  ].map((ms) => [new Date(ms).toISOString(), new Date(ms)] as const);

  it.each(grid)('agrees at %s', (_iso, now) => {
    cleanup();
    block({ onlyCurrent: true, now });

    const governing = currentRow(rows, now) as RefundScheduleRow;
    const quote = calculateRefund(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS, now);
    const eligible = isUniversallyFutureDate(EVENT_DATE, now);

    if (governing.kind === 'full' || governing.kind === 'late') {
      expect(eligible).toBe(true);
      expect(quote.isFullRefund).toBe(governing.kind === 'full');
      expect(governing.refundCents).toBe(quote.refundCents);
      expect(
        screen.getByText(new RegExp(`\\${formatPrice(quote.refundCents)} back`)),
      ).toBeDefined();
      return;
    }

    expect(eligible).toBe(false);
    expect(governing.refundCents).toBeNull();
    expect(screen.queryByText(/ back/)).toBeNull();
  });
});
