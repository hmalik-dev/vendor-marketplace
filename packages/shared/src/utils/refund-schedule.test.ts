import { describe, expect, it } from 'vitest';
import {
  FULL_REFUND_CUTOFF_HOURS,
  LATE_CANCELLATION_REFUND_RATE,
  PAYOUT_RELEASE_HOURS,
} from '../constants/index.js';
import { calculateRefund, refundSchedule, type RefundScheduleRow } from './index.js';

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
    expect(refundSchedule(TOTAL_CENTS, '14/06/2026')).toBeNull();
  });

  it('draws three windowed rows and a vendor-cancels row, and no non-refundable tier', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE);

    expect(rows?.map((row) => row.kind)).toEqual(['full', 'late', 'release', 'vendor-cancels']);
  });

  it('opens the late window one millisecond after the full-refund cutoff', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];
    const cutoff = EVENT_START.getTime() - FULL_REFUND_CUTOFF_HOURS * MS_PER_HOUR;

    expect(rowOf(rows, 'late').from?.getTime()).toBe(cutoff + 1);
  });

  it('opens the release row PAYOUT_RELEASE_HOURS after the start of the event day', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];

    expect(rowOf(rows, 'release').from?.getTime()).toBe(
      EVENT_START.getTime() + PAYOUT_RELEASE_HOURS * MS_PER_HOUR,
    );
  });

  it('makes no refund claim on the release row', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];

    expect(rowOf(rows, 'release').refundCents).toBeNull();
  });

  it('refunds the vendor-cancels row in full, whenever it happens', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];

    expect(rowOf(rows, 'vendor-cancels').refundCents).toBe(TOTAL_CENTS);
  });

  /**
   * Acceptance 13 of #427, and the reason this function exists at all: the
   * schedule a customer is shown has to be what `calculateRefund` will
   * actually pay them, at every instant inside every window it draws.
   */
  it('agrees with calculateRefund at every instant of every window it labels', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];
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
      new Date(EVENT_START.getTime() - 1),
      EVENT_START,
      new Date(EVENT_START.getTime() + PAYOUT_RELEASE_HOURS * MS_PER_HOUR),
      new Date(EVENT_START.getTime() + 5_000 * MS_PER_HOUR),
    ];

    for (const now of insideFull) {
      expect([
        now.toISOString(),
        calculateRefund(TOTAL_CENTS, EVENT_DATE, now).refundCents,
      ]).toEqual([now.toISOString(), full.refundCents]);
    }

    for (const now of insideLate) {
      expect([
        now.toISOString(),
        calculateRefund(TOTAL_CENTS, EVENT_DATE, now).refundCents,
      ]).toEqual([now.toISOString(), late.refundCents]);
    }
  });

  it('follows the constants rather than restating them', () => {
    const rows = refundSchedule(TOTAL_CENTS, EVENT_DATE) ?? [];

    expect(rowOf(rows, 'full').refundCents).toBe(TOTAL_CENTS);
    expect(rowOf(rows, 'late').refundCents).toBe(
      Math.round(TOTAL_CENTS * LATE_CANCELLATION_REFUND_RATE),
    );
  });
});
