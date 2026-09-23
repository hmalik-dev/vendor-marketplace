import { describe, expect, it } from 'vitest';
import { prePaymentRefundClause } from './refund-deadline';

const iso = (instant: Date): string => instant.toISOString();

describe('prePaymentRefundClause', () => {
  it('names the full-refund deadline while it is still ahead', () => {
    expect(prePaymentRefundClause('2026-10-10', iso, new Date('2026-10-08T00:00:00.000Z'))).toBe(
      "you're refunded in full if you cancel by 2026-10-08T00:00:00.000Z",
    );
  });

  it('says the full refund has ended once it has, and when online cancellation closes', () => {
    expect(prePaymentRefundClause('2026-10-10', iso, new Date('2026-10-08T00:00:00.001Z'))).toBe(
      'the full-refund window ended 2026-10-08T00:00:00.000Z, so cancelling before 2026-10-09T00:00:00.000Z refunds part of the total',
    );
  });

  it('promises no cancellation once online cancellation has closed', () => {
    expect(prePaymentRefundClause('2026-10-10', iso, new Date('2026-10-09T00:00:00.000Z'))).toBe(
      "online cancellation closed 2026-10-09T00:00:00.000Z, so once paid it can't be cancelled here",
    );
  });

  it('returns null for a date the parser rejects', () => {
    expect(prePaymentRefundClause('10/10/2026', iso)).toBeNull();
  });
});
