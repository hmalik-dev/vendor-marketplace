import { describe, expect, it } from 'vitest';
import {
  CURRENT_REFUND_TERMS,
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  PAYOUT_RELEASE_HOURS,
} from '../constants/index.js';
import {
  calculateRefund,
  isUniversallyFutureDate,
  refundBoundaries,
  refundSchedule,
  type RefundScheduleRow,
} from './index.js';

const MS_PER_HOUR = 60 * 60 * 1000;
const EVENT_DATE = '2026-06-14';
const EVENT_START = new Date('2026-06-14T00:00:00Z');
const TOTAL_CENTS = 205_000;

function rowOf(rows: readonly RefundScheduleRow[], kind: RefundScheduleRow['kind']) {
  const row = rows.find((candidate) => candidate.kind === kind);

  if (!row) {
    throw new Error(`no ${kind} row`);
  }

  return row;
}

describe('refundSchedule', () => {
  it('returns null for a date the parser rejects', () => {
    expect(refundSchedule(TOTAL_CENTS, '14/06/2026', CURRENT_REFUND_TERMS)).toBeNull();
  });

  it('draws four windowed rows and a vendor-cancels row, and no non-refundable tier', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS);

    expect(rows?.map((row) => row.kind)).toEqual([
      'full',
      'late',
      'closed',
      'release',
      'vendor-cancels',
    ]);
  });

  /*
   * VEN-615 acceptance 1. The two instants a customer acts on, as instants:
   * the full tier ends 48 hours before midnight UTC on the event date, and
   * online cancellation closes at midnight UTC the day before, when the
   * server's `isUniversallyFutureDate` stops holding.
   */
  it('states each boundary as an exact instant', () => {
    const rows = refundSchedule(TOTAL_CENTS, '2026-10-10', CURRENT_REFUND_TERMS) ?? [];

    expect(refundBoundaries('2026-10-10', CURRENT_REFUND_TERMS)).toEqual({
      fullRefundEndsAt: '2026-10-08T00:00:00.000Z',
      onlineCancellationClosesAt: '2026-10-09T00:00:00.000Z',
      eventStartsAt: '2026-10-10T00:00:00.000Z',
    });
    expect(rowOf(rows, 'full').until?.toISOString()).toBe('2026-10-08T00:00:00.000Z');
    expect(rowOf(rows, 'late').until?.toISOString()).toBe('2026-10-09T00:00:00.000Z');
    expect(rowOf(rows, 'closed').from?.toISOString()).toBe('2026-10-09T00:00:00.000Z');
  });

  it('closes online cancellation at the instant the server starts refusing it', () => {
    const closes = new Date(
      refundBoundaries('2026-10-10', CURRENT_REFUND_TERMS)?.onlineCancellationClosesAt ?? '',
    );

    expect(isUniversallyFutureDate('2026-10-10', new Date(closes.getTime() - 1))).toBe(true);
    expect(isUniversallyFutureDate('2026-10-10', closes)).toBe(false);
  });

  it('returns no boundaries for a date the parser rejects', () => {
    expect(refundBoundaries('10/10/2026', CURRENT_REFUND_TERMS)).toBeNull();
  });

  /*
   * Terms sold under a cutoff wider than a day would leave a late window that
   * opens after online cancellation has closed. The full tier then runs to
   * the close and no late row is drawn, rather than a window nobody can use.
   */
  it('draws no late row when the cutoff falls after online cancellation closes', () => {
    const rows =
      refundSchedule(TOTAL_CENTS, EVENT_DATE, {
        fullRefundCutoffHours: 12,
        lateRefundRateBps: 5_000,
      }) ?? [];

    expect(rows.map((row) => row.kind)).toEqual(['full', 'closed', 'release', 'vendor-cancels']);
    expect(rowOf(rows, 'full').until?.toISOString()).toBe('2026-06-13T00:00:00.000Z');
  });

  it('opens the late window one millisecond after the full-refund cutoff', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];
    const cutoff = EVENT_START.getTime() - FULL_REFUND_CUTOFF_HOURS * MS_PER_HOUR;

    expect(rowOf(rows, 'late').from?.getTime()).toBe(cutoff + 1);
  });

  it('opens the release row PAYOUT_RELEASE_HOURS after the start of the event day', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];

    expect(rowOf(rows, 'release').from?.getTime()).toBe(
      EVENT_START.getTime() + PAYOUT_RELEASE_HOURS * MS_PER_HOUR,
    );
  });

  it('makes no refund claim on the release row', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];

    expect(rowOf(rows, 'release').refundCents).toBeNull();
  });

  it('refunds the vendor-cancels row in full, whenever it happens', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];

    expect(rowOf(rows, 'vendor-cancels').refundCents).toBe(TOTAL_CENTS);
  });

  /**
   * Acceptance 13 of #427, and the reason this function exists at all: the
   * schedule a customer is shown has to be what `calculateRefund` will
   * actually pay them, at every instant inside every window it draws.
   */
  it('agrees with calculateRefund at every instant of every window it labels', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];
    const full = rowOf(rows, 'full');
    const late = rowOf(rows, 'late');
    const cutoff = EVENT_START.getTime() - FULL_REFUND_CUTOFF_HOURS * MS_PER_HOUR;

    const insideFull = [
      new Date(cutoff - 400 * MS_PER_HOUR),
      new Date(cutoff - MS_PER_HOUR),
      new Date(cutoff - 1),
      new Date(cutoff),
    ];
    const insideLate = [
      new Date(cutoff + 1),
      new Date(cutoff + MS_PER_HOUR),
      new Date(EVENT_START.getTime() - 24 * MS_PER_HOUR - 1),
    ];

    for (const now of insideFull) {
      expect([
        now.toISOString(),
        calculateRefund(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS, now).refundCents,
      ]).toEqual([now.toISOString(), full.refundCents]);
    }

    for (const now of insideLate) {
      expect([
        now.toISOString(),
        calculateRefund(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS, now).refundCents,
      ]).toEqual([now.toISOString(), late.refundCents]);
    }
  });

  it('follows the constants rather than restating them', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE, CURRENT_REFUND_TERMS) ?? [];

    expect(rowOf(rows, 'full').refundCents).toBe(TOTAL_CENTS);
    expect(rowOf(rows, 'late').refundCents).toBe(
      Math.round(TOTAL_CENTS * LATE_CANCELLATION_REFUND_RATE),
    );
  });
});
